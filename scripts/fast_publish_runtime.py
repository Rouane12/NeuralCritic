#!/usr/bin/env python3
"""Synchronize one published CMS story into the browser runtime fallback."""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import build_runtime_fallback as runtime

INDEX_PATH = ROOT / "data" / "articles.json"
DETAIL_DIR = ROOT / "data" / "articles"
MAX_ATTEMPTS = 3
REQUEST_TIMEOUT_SECONDS = 15


def fetch_live_story(slug: str) -> dict:
    supabase_url, key = runtime.read_supabase_config()
    query = urllib.parse.urlencode(
        {
            "select": runtime.SELECT_FIELDS,
            "status": "eq.published",
            "published_at": "lte.now()",
            "slug": f"eq.{slug}",
            "limit": "1",
        },
        safe=".*,:()+-",
    )
    url = f"{supabase_url}/rest/v1/articles?{query}"
    last_error: Exception | None = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        request = urllib.request.Request(
            url,
            headers={
                "apikey": key,
                "Authorization": f"Bearer {key}",
                "Accept": "application/json",
                "User-Agent": "NeuralCritic-FastPublishRuntime/1.0",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
                payload = json.loads(response.read().decode("utf-8"))
            if not isinstance(payload, list):
                raise RuntimeError("Supabase article response was not a list")
            if not payload or not isinstance(payload[0], dict):
                raise RuntimeError(f"Published article not found for slug: {slug}")
            return runtime.runtime_row(payload[0])
        except Exception as exc:
            last_error = exc
            if attempt < MAX_ATTEMPTS:
                time.sleep(attempt * 2)
    raise RuntimeError(f"Live story fetch failed after {MAX_ATTEMPTS} attempts: {last_error}")


def existing_story(slug: str) -> dict | None:
    path = DETAIL_DIR / f"{slug}.json"
    if not path.exists():
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None
    if not isinstance(payload, dict) or str(payload.get("slug") or "").strip() != slug:
        return None
    return payload


def renderable(row: dict) -> bool:
    if not str(row.get("title") or "").strip():
        return False
    if str(row.get("body") or "").strip():
        return True
    blocks = row.get("contentBlocks") if isinstance(row.get("contentBlocks"), list) else []
    return any(isinstance(block, dict) and str(block.get("text") or "").strip() for block in blocks)


def load_index() -> list[dict]:
    if not INDEX_PATH.exists():
        return []
    try:
        payload = json.loads(INDEX_PATH.read_text(encoding="utf-8"))
    except Exception:
        return []
    return [row for row in payload if isinstance(row, dict)] if isinstance(payload, list) else []


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--slug", required=True)
    args = parser.parse_args()
    slug = str(args.slug or "").strip()
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]*", slug):
        parser.error("invalid story slug")

    source = "supabase"
    try:
        row = fetch_live_story(slug)
    except Exception as exc:
        row = existing_story(slug)
        source = "repository"
        if row is None:
            raise SystemExit(f"Fast publish refused to create a shell without runtime content: {exc}")
        print(f"Live story unavailable ({exc}); using existing repository runtime fallback.")

    if not renderable(row):
        raise SystemExit(f"Fast publish refused non-renderable story runtime for slug: {slug}")

    rows = [candidate for candidate in load_index() if str(candidate.get("slug") or "").strip() != slug]
    rows.insert(0, row)
    runtime.write_json(INDEX_PATH, rows)
    runtime.write_json(DETAIL_DIR / f"{slug}.json", row)
    print(f"Fast-publish runtime synchronized {slug} from {source}; index now contains {len(rows)} stories.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
