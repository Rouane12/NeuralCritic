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
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "assets" / "supabase-config.js"
INDEX_PATH = ROOT / "data" / "articles.json"
REPOSITORY_INDEX_PATH = ROOT / "data" / "repository-articles.json"
DETAIL_DIR = ROOT / "data" / "articles"
MANUAL_DIR = ROOT / "data" / "manual-articles"
PAGE_SIZE = 20
REQUEST_TIMEOUT_SECONDS = 30
MAX_ATTEMPTS = 3
SELECT_FIELDS = ",".join(
    [
        "id",
        "slug",
        "title",
        "description",
        "body",
        "category",
        "author_name",
        "tags",
        "image_alt",
        "image_credit",
        "article_format",
        "review_meta",
        "content_blocks",
        "quick_read",
        "conclusion",
        "conclusion_heading",
        "conclusion_heading_style",
        "homepage_slot",
        "published_at",
        "updated_at",
        "image_url",
        "editorial_section",
        "platforms",
        "collection",
        "collection_year",
        "game_key",
        "series",
        "franchise",
        "news_meta",
    ]
)


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


def fetch_page(supabase_url: str, key: str, offset: int) -> list[dict[str, Any]]:
    query = urllib.parse.urlencode(
        {
            "select": SELECT_FIELDS,
            "status": "eq.published",
            "published_at": "lte.now()",
            "order": "published_at.desc,id.desc",
            "limit": str(PAGE_SIZE),
            "offset": str(offset),
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
                "User-Agent": "NeuralCritic-RuntimeFallback/1.1",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
                payload = json.loads(response.read().decode("utf-8"))
            if not isinstance(payload, list):
                raise RuntimeError("Supabase article response was not a list.")
            return [row for row in payload if isinstance(row, dict)]
        except Exception as exc:
            last_error = exc
            if attempt < MAX_ATTEMPTS:
                time.sleep(attempt * 2)
    raise RuntimeError(f"Supabase runtime fallback page at offset {offset} failed after {MAX_ATTEMPTS} attempts: {last_error}")


def fetch_published() -> list[dict[str, Any]]:
    supabase_url, key = read_supabase_config()
    payload: list[dict[str, Any]] = []
    offset = 0
    while True:
        page = fetch_page(supabase_url, key, offset)
        payload.extend(page)
        if len(page) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
        if offset >= 500:
            raise RuntimeError("Published article fallback exceeded the 500-row safety limit.")

    rows = [runtime_row(row) for row in payload if valid_slug(row.get("slug"))]
    if not rows:
        raise RuntimeError("Supabase returned no published articles; refusing to replace runtime fallback.")
    return rows


def discover_page_image(source_url: str) -> str:
    if not source_url.startswith(("https://", "http://")):
        return ""
    try:
        request = urllib.request.Request(
            source_url,
            headers={
                "User-Agent": "Mozilla/5.0 (compatible; NeuralCriticEditorialImageResolver/1.0)",
                "Accept": "text/html,application/xhtml+xml",
            },
        )
        with urllib.request.urlopen(request, timeout=25) as response:
            html = response.read(2_000_000).decode("utf-8", errors="ignore")
    except Exception as exc:
        print(f"WARNING: could not inspect editorial source image for {source_url}: {exc}")
        return ""

    patterns = (
        r'<meta[^>]+property=["\']og:image(?::secure_url)?["\'][^>]+content=["\']([^"\']+)["\']',
        r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image(?::secure_url)?["\']',
        r'<meta[^>]+name=["\']twitter:image(?::src)?["\'][^>]+content=["\']([^"\']+)["\']',
        r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+name=["\']twitter:image(?::src)?["\']',
    )
    def probe_image(url: str) -> bool:
        try:
            request = urllib.request.Request(
                url,
                method="HEAD",
                headers={
                    "User-Agent": "Mozilla/5.0 (compatible; NeuralCriticEditorialImageResolver/1.1)",
                    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
                },
            )
            with urllib.request.urlopen(request, timeout=15) as response:
                return response.status < 400 and str(response.headers.get_content_type() or "").startswith("image/")
        except Exception:
            return False

    for pattern in patterns:
        match = re.search(pattern, html, flags=re.I)
        if match:
            candidate = urllib.parse.urljoin(source_url, match.group(1).replace("&amp;", "&").strip())
            # WordPress commonly exposes a 1024×576 social derivative even when
            # the original 1920×1080 press image is available beside it. Probe
            # that original first; never replace a verified derivative with an
            # unverified URL.
            parsed = urllib.parse.urlsplit(candidate)
            original_path = re.sub(r"-\d{2,5}x\d{2,5}(?=\.[A-Za-z0-9]{2,5}$)", "", parsed.path)
            if original_path != parsed.path:
                original = urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, original_path, parsed.query, parsed.fragment))
                if probe_image(original):
                    print(f"Using full-size editorial image instead of CMS derivative: {original}")
                    return original
            return candidate
    return ""


def load_manual_articles() -> list[dict[str, Any]]:
    if not MANUAL_DIR.exists():
        return []
    rows: list[dict[str, Any]] = []
    for path in sorted(MANUAL_DIR.glob("*.json")):
        try:
            item = json.loads(path.read_text(encoding="utf-8"))
        except Exception as exc:
            raise RuntimeError(f"Invalid manual article {path.name}: {exc}") from exc
        if not isinstance(item, dict) or not valid_slug(item.get("slug")) or not str(item.get("title") or "").strip():
            raise RuntimeError(f"Manual article {path.name} is missing a valid slug/title.")
        item = dict(item)
        if not str(item.get("imageLocal") or "").strip():
            source_url = str((item.get("newsMeta") or {}).get("sourceUrl") or "").strip()
            discovered = discover_page_image(source_url)
            if discovered:
                item["imageLocal"] = discovered
                print(f"Resolved featured image for {item['slug']} from {source_url}")
            else:
                print(f"WARNING: no featured image could be resolved for {item['slug']}")
        rows.append(item)
    return rows


def merge_published(cms_rows: list[dict[str, Any]], manual_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    merged = {str(row.get("slug") or ""): row for row in cms_rows if valid_slug(row.get("slug"))}
    for row in manual_rows:
        slug = str(row.get("slug") or "")
        if slug not in merged:
            merged[slug] = row
    def sort_key(row: dict[str, Any]) -> str:
        return str(row.get("publishedAt") or row.get("published_at") or "")
    return sorted(merged.values(), key=sort_key, reverse=True)


def write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    if path.exists() and path.read_text(encoding="utf-8") == text:
        return
    path.write_text(text, encoding="utf-8")


def main() -> None:
    repository_rows = merge_published([], load_manual_articles())
    rows = merge_published(fetch_published(), repository_rows)
    write_json(REPOSITORY_INDEX_PATH, repository_rows)
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

    print(f"Runtime fallback synchronized with {len(rows)} published articles, including repository-published stories.")


if __name__ == "__main__":
    main()
