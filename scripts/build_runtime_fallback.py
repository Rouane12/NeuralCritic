#!/usr/bin/env python3
"""Refresh browser runtime fallbacks from published Supabase articles.

The public runtime prefers live Supabase data, but browsers must render the same
publication if that request is slow or temporarily unavailable. This script keeps
`data/articles.json` and per-story fallback JSON synchronized with the published
CMS state so the fallback cannot drift months behind production.
"""

from __future__ import annotations

import json
import re
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "assets" / "supabase-config.js"
INDEX_PATH = ROOT / "data" / "articles.json"
DETAIL_DIR = ROOT / "data" / "articles"


def read_supabase_config() -> tuple[str, str]:
    text = CONFIG_PATH.read_text(encoding="utf-8")
    url_match = re.search(r"url:\s*['\"]([^'\"]+)['\"]", text)
    key_match = re.search(r"publishableKey:\s*['\"]([^'\"]+)['\"]", text)
    if not url_match or not key_match:
        raise RuntimeError("Could not read Supabase public configuration.")
    return url_match.group(1).rstrip("/"), key_match.group(1)


def valid_slug(value: object) -> bool:
    return bool(re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]*", str(value or "")))


def runtime_row(row: dict[str, Any]) -> dict[str, Any]:
    published_at = row.get("published_at")
    return {
        "id": row.get("id"),
        "slug": row.get("slug") or "",
        "title": row.get("title") or "",
        "description": row.get("description") or "",
        "body": row.get("body") or "",
        "category": row.get("category") or "FEATURE",
        "author": row.get("author_name") or "Rouane Mounssif",
        "tags": row.get("tags") if isinstance(row.get("tags"), list) else [],
        "imageAlt": row.get("image_alt") or "",
        "imageCredit": row.get("image_credit") or "",
        "articleFormat": row.get("article_format") or "standard",
        "reviewMeta": row.get("review_meta") if isinstance(row.get("review_meta"), dict) else {},
        "contentBlocks": row.get("content_blocks") if isinstance(row.get("content_blocks"), list) else [],
        "quickRead": row.get("quick_read") if isinstance(row.get("quick_read"), list) else [],
        "conclusion": row.get("conclusion") or "",
        "conclusionHeading": row.get("conclusion_heading") or "",
        "conclusionHeadingStyle": row.get("conclusion_heading_style") or "editorial",
        "featured": row.get("homepage_slot") == "lead",
        "homepageSlot": row.get("homepage_slot") or "regular",
        "publishedAt": published_at,
        "updatedAt": row.get("updated_at") or published_at,
        "imageLocal": row.get("image_url") or "",
        "editorialSection": row.get("editorial_section") or None,
        "platforms": row.get("platforms") if isinstance(row.get("platforms"), list) else [],
        "collection": row.get("collection") or None,
        "collectionYear": row.get("collection_year"),
        "gameKey": row.get("game_key") or "",
        "series": row.get("series") or "",
        "franchise": row.get("franchise") or "",
        "newsMeta": row.get("news_meta") if isinstance(row.get("news_meta"), dict) else {},
    }


def fetch_published() -> list[dict[str, Any]]:
    supabase_url, key = read_supabase_config()
    query = urllib.parse.urlencode(
        {
            "select": "*",
            "status": "eq.published",
            "published_at": "lte.now()",
            "order": "published_at.desc",
            "limit": "500",
        },
        safe=".*,:()+-",
    )
    request = urllib.request.Request(
        f"{supabase_url}/rest/v1/articles?{query}",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Accept": "application/json",
            "User-Agent": "NeuralCritic-RuntimeFallback/1.0",
        },
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        payload = json.loads(response.read().decode("utf-8"))
    if not isinstance(payload, list):
        raise RuntimeError("Supabase article response was not a list.")
    rows = [runtime_row(row) for row in payload if isinstance(row, dict) and valid_slug(row.get("slug"))]
    if not rows:
        raise RuntimeError("Supabase returned no published articles; refusing to replace runtime fallback.")
    return rows


def write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    if path.exists() and path.read_text(encoding="utf-8") == text:
        return
    path.write_text(text, encoding="utf-8")


def main() -> None:
    rows = fetch_published()
    write_json(INDEX_PATH, rows)

    DETAIL_DIR.mkdir(parents=True, exist_ok=True)
    expected = set()
    for row in rows:
        slug = str(row["slug"])
        detail_path = DETAIL_DIR / f"{slug}.json"
        expected.add(detail_path.name)
        write_json(detail_path, row)

    for path in DETAIL_DIR.glob("*.json"):
        if path.name not in expected:
            path.unlink()

    print(f"Runtime fallback synchronized with {len(rows)} published articles.")


if __name__ == "__main__":
    main()
