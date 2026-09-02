#!/usr/bin/env python3
"""Sync Google Search Console performance data into Neural Critic's private Supabase tables.

This is server-side tooling. Keep GOOGLE_SEARCH_CONSOLE_CREDENTIALS_JSON and
SUPABASE_SERVICE_ROLE_KEY in GitHub Secrets; never expose either value to browser code.

The sync is intentionally idempotent: finalized Search Console rows are upserted
by date + property + search type + query + page URL. The default lookback window
re-reads recent finalized days so late Search Console data is picked up safely.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import date, datetime, timedelta, timezone
from typing import Any, Iterable
from urllib.parse import parse_qs, quote, unquote, urlparse

import requests
from google.auth.transport.requests import AuthorizedSession
from google.oauth2 import service_account

SEARCH_CONSOLE_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly"
SEARCH_ANALYTICS_URL = "https://www.googleapis.com/webmasters/v3/sites/{site}/searchAnalytics/query"
DEFAULT_LOOKBACK_DAYS = 10
ROW_LIMIT = 25_000
UPSERT_CHUNK_SIZE = 500
STORY_SLUG_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]*$")


def parse_story_slug(page_url: str) -> str | None:
    """Return a Neural Critic story slug for canonical or legacy article URLs."""
    try:
        parsed = urlparse(str(page_url or "").strip())
    except ValueError:
        return None

    parts = [unquote(part) for part in parsed.path.split("/") if part]
    if len(parts) == 2 and parts[0] == "stories" and STORY_SLUG_RE.fullmatch(parts[1]):
        return parts[1]

    if parsed.path.rstrip("/").endswith("/article.html") or parsed.path == "/article.html":
        slug = (parse_qs(parsed.query).get("slug") or [""])[0].strip()
        if STORY_SLUG_RE.fullmatch(slug):
            return slug
    return None


def parse_iso_date(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(f"Expected YYYY-MM-DD, got {value!r}") from exc


def resolve_window(start_date: date | None, end_date: date | None, lookback_days: int) -> tuple[date, date]:
    if (start_date is None) != (end_date is None):
        raise ValueError("--start-date and --end-date must be provided together")
    if start_date and end_date:
        if start_date > end_date:
            raise ValueError("--start-date cannot be after --end-date")
        return start_date, end_date
    if lookback_days < 1 or lookback_days > 90:
        raise ValueError("--lookback-days must be between 1 and 90")

    # Search Console dates are reported in Pacific Time. Asking for finalized
    # data means unavailable recent dates are simply omitted; the rolling
    # lookback will collect them on a later run once Google finalizes them.
    resolved_end = datetime.now(timezone.utc).date() - timedelta(days=1)
    return resolved_end - timedelta(days=lookback_days - 1), resolved_end


def load_google_credentials(raw_json: str):
    try:
        info = json.loads(raw_json)
    except json.JSONDecodeError as exc:
        raise RuntimeError("GOOGLE_SEARCH_CONSOLE_CREDENTIALS_JSON is not valid JSON") from exc
    if not isinstance(info, dict) or info.get("type") != "service_account":
        raise RuntimeError("Google credentials must be a service-account JSON object")
    return service_account.Credentials.from_service_account_info(
        info,
        scopes=[SEARCH_CONSOLE_SCOPE],
    )


def fetch_search_console_rows(
    session: AuthorizedSession,
    site_url: str,
    start_date: date,
    end_date: date,
    search_type: str,
) -> list[dict[str, Any]]:
    endpoint = SEARCH_ANALYTICS_URL.format(site=quote(site_url, safe=""))
    start_row = 0
    normalized: list[dict[str, Any]] = []
    synced_at = datetime.now(timezone.utc).isoformat()

    while True:
        body = {
            "startDate": start_date.isoformat(),
            "endDate": end_date.isoformat(),
            "dimensions": ["date", "query", "page"],
            "type": search_type,
            "aggregationType": "auto",
            "dataState": "final",
            "rowLimit": ROW_LIMIT,
            "startRow": start_row,
        }
        response = session.post(endpoint, json=body, timeout=60)
        response.raise_for_status()
        payload = response.json()
        rows = payload.get("rows") or []
        if not isinstance(rows, list):
            raise RuntimeError("Search Console returned an unexpected rows payload")

        for row in rows:
            keys = row.get("keys") or []
            if len(keys) != 3:
                raise RuntimeError(f"Search Console row had {len(keys)} keys; expected date, query, page")
            metric_date, query_value, page_url = (str(value) for value in keys)
            normalized.append(
                {
                    "metric_date": metric_date,
                    "site_url": site_url,
                    "search_type": search_type,
                    "query": query_value,
                    "page_url": page_url,
                    "story_slug": parse_story_slug(page_url),
                    "clicks": float(row.get("clicks") or 0),
                    "impressions": float(row.get("impressions") or 0),
                    "ctr": float(row.get("ctr") or 0),
                    "position": float(row.get("position") or 0),
                    "synced_at": synced_at,
                }
            )

        if len(rows) < ROW_LIMIT:
            break
        start_row += len(rows)

    return normalized


class SupabaseSearchConsoleStore:
    def __init__(self, url: str, service_key: str) -> None:
        self.endpoint = url.rstrip("/") + "/rest/v1/search_console_daily"
        self.headers = {
            "apikey": service_key,
            "authorization": f"Bearer {service_key}",
            "content-type": "application/json",
            "prefer": "resolution=merge-duplicates,return=minimal",
        }

    def upsert(self, rows: Iterable[dict[str, Any]]) -> int:
        buffered = list(rows)
        written = 0
        params = {
            "on_conflict": "metric_date,site_url,search_type,query,page_url",
        }
        for offset in range(0, len(buffered), UPSERT_CHUNK_SIZE):
            chunk = buffered[offset : offset + UPSERT_CHUNK_SIZE]
            response = requests.post(
                self.endpoint,
                params=params,
                headers=self.headers,
                json=chunk,
                timeout=60,
            )
            if not response.ok:
                detail = response.text[:1000]
                raise RuntimeError(f"Supabase upsert failed ({response.status_code}): {detail}")
            written += len(chunk)
        return written


def run_self_test() -> None:
    cases = {
        "https://www.neuralcritic.net/stories/gta-6-extended-look/": "gta-6-extended-look",
        "https://www.neuralcritic.net/stories/gta-6-extended-look": "gta-6-extended-look",
        "https://www.neuralcritic.net/article.html?slug=gta-6-extended-look": "gta-6-extended-look",
        "https://www.neuralcritic.net/games/grand-theft-auto-vi/": None,
        "not a url": None,
    }
    for source, expected in cases.items():
        actual = parse_story_slug(source)
        if actual != expected:
            raise AssertionError(f"parse_story_slug({source!r}) returned {actual!r}, expected {expected!r}")

    start, end = resolve_window(date(2026, 8, 1), date(2026, 8, 7), 10)
    if (start, end) != (date(2026, 8, 1), date(2026, 8, 7)):
        raise AssertionError("Explicit date window changed unexpectedly")
    print(json.dumps({"ok": True, "self_test": "passed"}))


def main() -> int:
    parser = argparse.ArgumentParser(description="Sync Google Search Console data into Neural Critic")
    parser.add_argument("--start-date", type=parse_iso_date, help="Backfill start date (YYYY-MM-DD)")
    parser.add_argument("--end-date", type=parse_iso_date, help="Backfill end date (YYYY-MM-DD)")
    parser.add_argument(
        "--lookback-days",
        type=int,
        default=DEFAULT_LOOKBACK_DAYS,
        help=f"Rolling finalized-data window when explicit dates are omitted (default: {DEFAULT_LOOKBACK_DAYS})",
    )
    parser.add_argument("--dry-run", action="store_true", help="Fetch and summarize without writing to Supabase")
    parser.add_argument("--self-test", action="store_true", help="Run offline parser/date tests and exit")
    args = parser.parse_args()

    try:
        if args.self_test:
            run_self_test()
            return 0

        site_url = os.environ.get("GSC_SITE_URL", "").strip()
        search_type = os.environ.get("GSC_SEARCH_TYPE", "web").strip() or "web"
        credentials_json = os.environ.get("GOOGLE_SEARCH_CONSOLE_CREDENTIALS_JSON", "").strip()
        if not site_url:
            raise RuntimeError("GSC_SITE_URL is required")
        if not credentials_json:
            raise RuntimeError("GOOGLE_SEARCH_CONSOLE_CREDENTIALS_JSON is required")
        if search_type not in {"web", "image", "video", "news", "discover", "googleNews"}:
            raise RuntimeError(f"Unsupported GSC_SEARCH_TYPE: {search_type!r}")

        start_date, end_date = resolve_window(args.start_date, args.end_date, args.lookback_days)
        credentials = load_google_credentials(credentials_json)
        session = AuthorizedSession(credentials)
        rows = fetch_search_console_rows(session, site_url, start_date, end_date, search_type)
        story_rows = sum(1 for row in rows if row["story_slug"])

        summary: dict[str, Any] = {
            "ok": True,
            "mode": "dry-run" if args.dry_run else "sync",
            "site_url": site_url,
            "search_type": search_type,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "rows_fetched": len(rows),
            "story_rows": story_rows,
        }

        if args.dry_run:
            summary["rows_written"] = 0
        else:
            supabase_url = os.environ.get("SUPABASE_URL", "").strip()
            service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
            if not supabase_url or not service_key:
                raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for writes")
            summary["rows_written"] = SupabaseSearchConsoleStore(supabase_url, service_key).upsert(rows)

        print(json.dumps(summary, indent=2))
        return 0
    except requests.RequestException as exc:
        detail = getattr(exc.response, "text", "")[:1000] if getattr(exc, "response", None) is not None else ""
        message = f"{exc} {detail}".strip()
        print(json.dumps({"ok": False, "error": message}, indent=2), file=sys.stderr)
        return 1
    except Exception as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, indent=2), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
