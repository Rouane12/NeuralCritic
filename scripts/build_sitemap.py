#!/usr/bin/env python3
"""Refresh Neural Critic's crawler/discovery files from published Supabase stories.

This script is intentionally publication-metadata-only. It writes sitemap.xml
and feed.xml, and never creates, edits, or deletes article HTML. The proven
article.html?slug= runtime remains the only reader-facing article renderer.
"""

from __future__ import annotations

import json
import re
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from email.utils import format_datetime
from pathlib import Path
from typing import Any
from xml.sax.saxutils import escape

from publication_config import SITE_URL

ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "assets" / "supabase-config.js"
FALLBACK_INDEX = ROOT / "data" / "articles.json"
SITEMAP_PATH = ROOT / "sitemap.xml"
FEED_PATH = ROOT / "feed.xml"
FEED_URL = urllib.parse.urljoin(SITE_URL, "feed.xml")

STATIC_URLS = [
    SITE_URL,
    urllib.parse.urljoin(SITE_URL, "about.html"),
    urllib.parse.urljoin(SITE_URL, "standards.html"),
    urllib.parse.urljoin(SITE_URL, "commercial.html"),
    urllib.parse.urljoin(SITE_URL, "category.html?category=news"),
    urllib.parse.urljoin(SITE_URL, "category.html?category=features"),
    urllib.parse.urljoin(SITE_URL, "category.html?category=guides"),
    urllib.parse.urljoin(SITE_URL, "category.html?category=reviews"),
    urllib.parse.urljoin(SITE_URL, "category.html?section=what-to-play"),
]


def read_supabase_config() -> tuple[str, str]:
    text = CONFIG_PATH.read_text(encoding="utf-8")
    url_match = re.search(r"url:\s*['\"]([^'\"]+)['\"]", text)
    key_match = re.search(r"publishableKey:\s*['\"]([^'\"]+)['\"]", text)
    if not url_match or not key_match:
        raise RuntimeError("Could not read Supabase public configuration.")
    return url_match.group(1).rstrip("/"), key_match.group(1)


def fetch_published() -> list[dict[str, Any]]:
    supabase_url, key = read_supabase_config()
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    query = urllib.parse.urlencode(
        {
            "select": "slug,title,description,category,published_at,status",
            "status": "eq.published",
            "published_at": f"lte.{now}",
            "order": "published_at.desc",
            "limit": "100",
        },
        safe=".*,:+-",
    )
    request = urllib.request.Request(
        f"{supabase_url}/rest/v1/articles?{query}",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Accept": "application/json",
            "User-Agent": "NeuralCritic-PublicationBuilder/1.0",
        },
    )
    with urllib.request.urlopen(request, timeout=15) as response:
        payload = json.loads(response.read().decode("utf-8"))
    if not isinstance(payload, list):
        raise RuntimeError("Supabase article response was not a list.")
    return [row for row in payload if isinstance(row, dict)]


def fallback_published() -> list[dict[str, Any]]:
    payload = json.loads(FALLBACK_INDEX.read_text(encoding="utf-8"))
    if not isinstance(payload, list):
        return []
    rows: list[dict[str, Any]] = []
    for article in payload:
        if not isinstance(article, dict):
            continue
        slug = str(article.get("slug") or "").strip()
        if not slug:
            continue
        rows.append(
            {
                "slug": slug,
                "title": article.get("title") or "",
                "description": article.get("description") or "",
                "category": article.get("category") or "FEATURE",
                "published_at": article.get("publishedAt") or article.get("published_at") or "",
            }
        )
    return rows


def load_articles() -> tuple[list[dict[str, Any]], str]:
    try:
        return fetch_published(), "supabase"
    except Exception as exc:
        print(f"Live publication fetch unavailable ({exc}); using repository fallback.")
        return fallback_published(), "repository"


def valid_slug(slug: str) -> bool:
    return bool(re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]*", slug))


def article_url(slug: str) -> str:
    encoded = urllib.parse.quote(slug, safe="-._~")
    return urllib.parse.urljoin(SITE_URL, f"article.html?slug={encoded}")


def parse_published(value: object) -> datetime | None:
    raw = str(value or "").strip()
    if not raw:
        return None
    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except ValueError:
        return None


def render_sitemap(rows: list[dict[str, Any]]) -> str:
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]

    for url in STATIC_URLS:
        lines.extend(["  <url>", f"    <loc>{escape(url)}</loc>", "  </url>"])

    seen: set[str] = set()
    for row in rows:
        slug = str(row.get("slug") or "").strip()
        if not valid_slug(slug) or slug in seen:
            continue
        seen.add(slug)
        lines.append("  <url>")
        lines.append(f"    <loc>{escape(article_url(slug))}</loc>")
        published = str(row.get("published_at") or row.get("publishedAt") or "").strip()
        if published:
            lines.append(f"    <lastmod>{escape(published)}</lastmod>")
        lines.append("  </url>")

    lines.append("</urlset>")
    return "\n".join(lines) + "\n"


def render_feed(rows: list[dict[str, Any]]) -> str:
    now = datetime.now(timezone.utc)
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
        "  <channel>",
        "    <title>Neural Critic</title>",
        f"    <link>{escape(SITE_URL)}</link>",
        "    <description>Gaming news, reviews, guides, and features for players who want the signal—not the noise.</description>",
        "    <language>en</language>",
        f"    <lastBuildDate>{escape(format_datetime(now))}</lastBuildDate>",
        "    <generator>Neural Critic publication pipeline</generator>",
        f'    <atom:link href="{escape(FEED_URL)}" rel="self" type="application/rss+xml" />',
    ]

    seen: set[str] = set()
    emitted = 0
    for row in rows:
        slug = str(row.get("slug") or "").strip()
        title = str(row.get("title") or "").strip()
        if not valid_slug(slug) or slug in seen or not title:
            continue
        seen.add(slug)
        url = article_url(slug)
        description = str(row.get("description") or "").strip()
        category = str(row.get("category") or "").strip()
        published = parse_published(row.get("published_at") or row.get("publishedAt"))
        lines.extend(
            [
                "    <item>",
                f"      <title>{escape(title)}</title>",
                f"      <link>{escape(url)}</link>",
                f'      <guid isPermaLink="true">{escape(url)}</guid>',
            ]
        )
        if description:
            lines.append(f"      <description>{escape(description)}</description>")
        if category:
            lines.append(f"      <category>{escape(category)}</category>")
        if published:
            lines.append(f"      <pubDate>{escape(format_datetime(published))}</pubDate>")
        lines.append("    </item>")
        emitted += 1
        if emitted >= 30:
            break

    lines.extend(["  </channel>", "</rss>"])
    return "\n".join(lines) + "\n"


def main() -> int:
    rows, source = load_articles()
    SITEMAP_PATH.write_text(render_sitemap(rows), encoding="utf-8")
    FEED_PATH.write_text(render_feed(rows), encoding="utf-8")
    print(f"Refreshed Neural Critic sitemap/RSS with {len(rows)} published rows from {source}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
