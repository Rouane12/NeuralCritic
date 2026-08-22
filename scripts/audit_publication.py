#!/usr/bin/env python3
"""Fail-fast health checks for Neural Critic's public publication surface.

This audit is intentionally read-only. It protects the stable CMS-driven
article runtime and catches SEO/content regressions before deployment.
"""

from __future__ import annotations

import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parents[1]
SITE_URL = "https://rouane12.github.io/NeuralCritic/"
MEDIA_MARKER = "/media/editorial/"
ARTICLE_HOST = '<main class="article-page" id="article"></main>'

ERRORS: list[str] = []
WARNINGS: list[str] = []


def error(message: str) -> None:
    ERRORS.append(message)


def warn(message: str) -> None:
    WARNINGS.append(message)


def text(path: str) -> str:
    target = ROOT / path
    if not target.exists():
        error(f"Missing required file: {path}")
        return ""
    return target.read_text(encoding="utf-8", errors="replace")


def check_article_runtime() -> None:
    html = text("article.html")
    if not html:
        return
    if ARTICLE_HOST not in html:
        error("article.html must keep an empty #article host for the CMS renderer.")
    forbidden = [
        "NEURAL_CRITIC_GENERATED_ROUTE",
        "data-generated-article",
        "NEURAL_CRITIC_STATIC_SLUG",
        '<base href="../../">',
        "seo-article-fallback",
    ]
    for marker in forbidden:
        if marker in html:
            error(f"article.html contains retired generated-route marker: {marker}")

    required_scripts = [
        "assets/supabase-config.js",
        "assets/content-api.js",
        "assets/app.js",
        "assets/article-extras.js",
        "assets/article-formatting.js",
        "assets/review-parity.js",
        "assets/ranked-parity.js",
        "assets/community-core.js",
    ]
    positions = []
    for script in required_scripts:
        pos = html.find(script)
        if pos < 0:
            error(f"article.html is missing required runtime asset: {script}")
        positions.append(pos)
    valid_positions = [p for p in positions if p >= 0]
    if valid_positions and valid_positions != sorted(valid_positions):
        error("article.html runtime script order changed; review before deployment.")


def check_no_generated_routes() -> None:
    for section in ("reviews", "features", "guides", "news"):
        root = ROOT / section
        if not root.exists():
            continue
        for page in root.rglob("index.html"):
            sample = page.read_text(encoding="utf-8", errors="ignore")[:1000]
            if "NEURAL_CRITIC_GENERATED_ROUTE" in sample or "data-generated-article" in sample:
                error(f"Experimental generated article route returned: {page.relative_to(ROOT)}")


def load_static_articles() -> list[dict]:
    index_path = ROOT / "data/articles.json"
    if not index_path.exists():
        error("Missing data/articles.json fallback index.")
        return []
    try:
        payload = json.loads(index_path.read_text(encoding="utf-8"))
    except Exception as exc:
        error(f"data/articles.json is invalid JSON: {exc}")
        return []
    if not isinstance(payload, list):
        error("data/articles.json must be an array.")
        return []
    return [item for item in payload if isinstance(item, dict)]


def image_filename(value: object) -> str:
    if not isinstance(value, str) or MEDIA_MARKER not in value:
        return ""
    return value.split(MEDIA_MARKER, 1)[1].split("?", 1)[0].split("#", 1)[0]


def check_article_data() -> set[str]:
    articles = load_static_articles()
    slugs: set[str] = set()
    for article in articles:
        slug = str(article.get("slug") or "").strip()
        if not slug:
            error("Static article index contains an article without a slug.")
            continue
        if slug in slugs:
            error(f"Duplicate static article slug: {slug}")
        slugs.add(slug)
        for field in ("title", "description", "category"):
            if not str(article.get(field) or "").strip():
                error(f"{slug}: missing required field {field}")

        detail_path = ROOT / "data/articles" / f"{slug}.json"
        if not detail_path.exists():
            error(f"{slug}: missing fallback article file data/articles/{slug}.json")
            continue
        try:
            detail = json.loads(detail_path.read_text(encoding="utf-8"))
        except Exception as exc:
            error(f"{slug}: invalid article JSON: {exc}")
            continue

        if detail.get("slug") != slug:
            error(f"{slug}: detail JSON slug does not match filename/index slug.")
        if detail.get("articleFormat") == "review":
            meta = detail.get("reviewMeta") or {}
            if not str(meta.get("score") or "").strip():
                error(f"{slug}: review is missing a score.")
            if not str(meta.get("verdict") or "").strip():
                error(f"{slug}: review is missing a verdict.")

        image_values = [detail.get("imageLocal")]
        for block in detail.get("contentBlocks") or []:
            if isinstance(block, dict):
                image_values.append(block.get("imageLocal"))
        for value in image_values:
            filename = image_filename(value)
            if filename and not (ROOT / "images/editorial" / filename).exists():
                error(f"{slug}: localized editorial image is missing: images/editorial/{filename}")

    return slugs


def check_image_budget() -> None:
    image_dir = ROOT / "images/editorial"
    if not image_dir.exists():
        error("Missing images/editorial directory.")
        return
    for image in image_dir.iterdir():
        if not image.is_file() or image.name == ".gitkeep":
            continue
        size = image.stat().st_size
        if size > 1_000_000:
            warn(f"Large editorial image ({size / 1024 / 1024:.2f} MiB): {image.relative_to(ROOT)}")


def check_sitemap(static_slugs: set[str]) -> None:
    sitemap_path = ROOT / "sitemap.xml"
    if not sitemap_path.exists():
        error("Missing sitemap.xml")
        return
    try:
        tree = ET.parse(sitemap_path)
    except Exception as exc:
        error(f"sitemap.xml is invalid XML: {exc}")
        return

    ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    locs = [node.text.strip() for node in tree.findall("sm:url/sm:loc", ns) if node.text]
    if SITE_URL not in locs:
        error("sitemap.xml does not include the homepage.")

    sitemap_slugs: set[str] = set()
    for loc in locs:
        parsed = urlparse(loc)
        if parsed.netloc != "rouane12.github.io" or not parsed.path.startswith("/NeuralCritic/"):
            error(f"Unexpected sitemap host/path: {loc}")
        if re.search(r"/(reviews|features|guides|news)/[^/]+/?$", parsed.path):
            error(f"Retired pretty article route found in sitemap: {loc}")
        if parsed.path.endswith("/article.html"):
            slug = parse_qs(parsed.query).get("slug", [""])[0]
            if not slug:
                error(f"Article sitemap URL is missing slug: {loc}")
            else:
                sitemap_slugs.add(slug)

    missing = static_slugs - sitemap_slugs
    if missing:
        error("Static fallback articles missing from sitemap: " + ", ".join(sorted(missing)))


def check_robots() -> None:
    robots = text("robots.txt")
    for directive in (
        "Disallow: /studio.html",
        "Disallow: /subscribers.html",
        "Disallow: /data/",
        "Disallow: /scripts/",
        f"Sitemap: {SITE_URL}sitemap.xml",
    ):
        if directive not in robots:
            error(f"robots.txt missing directive: {directive}")


def check_page_metadata() -> None:
    public_pages = {
        "index.html": ("description", "robots"),
        "category.html": ("description", "robots"),
        "about.html": ("description", "robots"),
        "search.html": ("description", "noindex"),
    }
    for page, requirements in public_pages.items():
        html = text(page)
        for requirement in requirements:
            if requirement == "description" and 'name="description"' not in html:
                error(f"{page}: missing static meta description.")
            elif requirement == "robots" and 'name="robots"' not in html:
                error(f"{page}: missing robots metadata.")
            elif requirement == "noindex" and "noindex" not in html:
                error(f"{page}: search/private surface must be noindex.")

    for page in ("studio.html", "subscribers.html"):
        html = text(page)
        if "noindex" not in html or "nofollow" not in html:
            error(f"{page}: private CMS surface is missing noindex,nofollow protection.")


def main() -> int:
    check_article_runtime()
    check_no_generated_routes()
    static_slugs = check_article_data()
    check_image_budget()
    check_sitemap(static_slugs)
    check_robots()
    check_page_metadata()

    for message in WARNINGS:
        print(f"WARNING: {message}")
    if ERRORS:
        for message in ERRORS:
            print(f"ERROR: {message}", file=sys.stderr)
        print(f"Neural Critic publication audit failed with {len(ERRORS)} error(s).", file=sys.stderr)
        return 1
    print(f"Neural Critic publication audit passed ({len(static_slugs)} static fallback articles checked).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
