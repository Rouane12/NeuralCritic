#!/usr/bin/env python3
"""Read-only live checks for Neural Critic's anonymous Supabase boundary.

The audit uses only the browser publishable key already committed for public
clients. It performs GET requests, never provisions identities, never mutates
data, and never treats an empty UI state as proof of authorization.
"""

from __future__ import annotations

import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "assets" / "supabase-config.js"
PRIVATE_TABLES = (
    "article_reactions",
    "comment_reports",
    "editor_profiles",
    "editorial_workflow",
    "newsletter_subscribers",
    "reader_entity_follows",
    "reader_saved_stories",
)


def fail(message: str) -> None:
    raise SystemExit(f"LIVE AUTH BOUNDARY FAILED: {message}")


def configuration() -> tuple[str, str]:
    source = CONFIG.read_text(encoding="utf-8")
    url_match = re.search(r"url:\s*['\"](https://[a-z0-9-]+\.supabase\.co)['\"]", source)
    key_match = re.search(r"publishableKey:\s*['\"](sb_publishable_[A-Za-z0-9_-]+)['\"]", source)
    if not url_match or not key_match:
        fail("could not read the browser Supabase URL and publishable key")
    return url_match.group(1), key_match.group(1)


def get_json(base_url: str, key: str, path: str) -> tuple[int, object | None]:
    request = urllib.request.Request(
        f"{base_url}{path}",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Accept": "application/json",
            "User-Agent": "NeuralCritic-LiveAuthBoundaryAudit/1.0",
        },
        method="GET",
    )
    try:
        with urllib.request.urlopen(request, timeout=12) as response:
            raw = response.read().decode("utf-8")
        return response.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as exc:
        # Authentication/authorization denials prove the anonymous boundary.
        # A 404 is deliberately not accepted: an expected table disappearing
        # must fail loudly instead of being mistaken for a security success.
        # Do not print response bodies because they can contain deployment details.
        if exc.code in {401, 403}:
            return exc.code, None
        raise


def main() -> int:
    base_url, key = configuration()

    control_path = "/rest/v1/articles?select=slug&status=eq.published&limit=1"
    try:
        control_status, control = get_json(base_url, key, control_path)
    except (OSError, urllib.error.URLError, json.JSONDecodeError) as exc:
        fail(f"public control request failed: {exc}")
    if control_status != 200 or not isinstance(control, list) or not control:
        fail("public published-article control did not return a row")

    def audit_table(table: str) -> str:
        path = f"/rest/v1/{urllib.parse.quote(table)}?select=*&limit=1"
        try:
            status, payload = get_json(base_url, key, path)
        except (OSError, urllib.error.URLError, json.JSONDecodeError) as exc:
            fail(f"{table}: anonymous boundary request failed: {exc}")
        if status == 200:
            if payload == []:
                fail(f"{table}: anonymous read reached the protected table; an empty state is not authorization proof")
            fail(f"{table}: anonymous publishable-key read returned protected rows")
        if status in {401, 403}:
            return f"{table}=not-exposed-{status}"
        fail(f"{table}: unexpected HTTP {status}")
        return ""

    with ThreadPoolExecutor(max_workers=len(PRIVATE_TABLES)) as executor:
        results = list(executor.map(audit_table, PRIVATE_TABLES))

    print("Live anonymous auth boundary passed: " + ", ".join(results))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except urllib.error.URLError as exc:
        print(f"LIVE AUTH BOUNDARY FAILED: network error: {exc}", file=sys.stderr)
        raise SystemExit(1)
