#!/usr/bin/env python3
"""Neural Critic publication audit with canonical story-shell checks."""

from __future__ import annotations

import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import urlparse

import audit_publication as base

ROOT = Path(__file__).resolve().parents[1]
SITE_URL = "https://rouane12.github.io/NeuralCritic/"
STORY_PATTERN = re.compile(r"^/NeuralCritic/stories/([A-Za-z0-9][A-Za-z0-9_-]*)/$")
GENERATED_MARKER = "<!-- generated: neural-critic-story-shell -->"


def check_story_pages(static_slugs: set[str]) -> None:
    stories_root = ROOT / "stories"
    generated: set[str] = set()
    if not stories_root.exists():
        base.error("Missing stories directory for canonical article shells.")
        return

    for page in stories_root.glob("*/index.html"):
        slug = page.parent.name
        html = page.read_text(encoding="utf-8", errors="replace")
        if GENERATED_MARKER not in html[:1400]:
            continue
        generated.add(slug)
        canonical = f"{SITE_URL}stories/{slug}/"
        required = [
            GENERATED_MARKER,
            '<base href="/NeuralCritic/">',
            'window.NEURAL_CRITIC_STATIC_META=true',
            f'window.NEURAL_CRITIC_STATIC_SLUG="{slug}"',
            'name="description"',
            'name="robots" content="index,follow',
            'property="og:title"',
            'property="og:description"',
            'property="og:url"',
            'name="twitter:card"',
            'id="nc-structured-data"',
            'id="nc-breadcrumb-data"',
            f'rel="canonical" href="{canonical}"',
        ]
        for marker in required:
            if marker not in html:
                base.error(f"{slug}: canonical story shell is missing {marker}")
        if 'property="og:image"' not in html:
            base.warn(f"{slug}: story shell has no large social image.")

    missing = static_slugs - generated
    if missing:
        base.error("Canonical story shells missing for fallback articles: " + ", ".join(sorted(missing)))


def check_canonical_sitemap(static_slugs: set[str]) -> None:
    path = ROOT / "sitemap.xml"
    if not path.exists():
        base.error("Missing sitemap.xml")
        return
    try:
        tree = ET.parse(path)
    except Exception as exc:
        base.error(f"sitemap.xml is invalid XML: {exc}")
        return

    ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    locs = [node.text.strip() for node in tree.findall("sm:url/sm:loc", ns) if node.text]
    if SITE_URL not in locs:
        base.error("sitemap.xml does not include the homepage.")

    story_slugs: set[str] = set()
    for loc in locs:
        parsed = urlparse(loc)
        if parsed.netloc != "rouane12.github.io" or not parsed.path.startswith("/NeuralCritic/"):
            base.error(f"Unexpected sitemap host/path: {loc}")
            continue
        if parsed.path.endswith("/article.html"):
            base.error(f"Legacy query article URL remains in sitemap: {loc}")
        match = STORY_PATTERN.fullmatch(parsed.path)
        if match:
            story_slugs.add(match.group(1))

    missing = static_slugs - story_slugs
    if missing:
        base.error("Canonical stories missing from sitemap: " + ", ".join(sorted(missing)))


def check_canonical_feed(static_slugs: set[str]) -> None:
    path = ROOT / "feed.xml"
    if not path.exists():
        base.error("Missing feed.xml")
        return
    try:
        root = ET.parse(path).getroot()
    except Exception as exc:
        base.error(f"feed.xml is invalid XML: {exc}")
        return
    if root.tag != "rss":
        base.error("feed.xml must be an RSS document.")
        return

    feed_slugs: set[str] = set()
    for item in root.findall("./channel/item"):
        link = (item.findtext("link") or "").strip()
        if not link:
            base.error("RSS item is missing a link.")
            continue
        parsed = urlparse(link)
        if parsed.path.endswith("/article.html"):
            base.error(f"Legacy query article URL remains in RSS: {link}")
        match = STORY_PATTERN.fullmatch(parsed.path)
        if match:
            feed_slugs.add(match.group(1))

    missing = static_slugs - feed_slugs
    if missing:
        base.warn("Canonical stories missing from current RSS feed: " + ", ".join(sorted(missing)))

    home = base.text("index.html")
    if 'type="application/rss+xml"' not in home or 'href="feed.xml"' not in home:
        base.error("index.html is missing RSS autodiscovery metadata.")


def check_story_router() -> None:
    config = base.text("assets/supabase-config.js")
    router = base.text("assets/story-router.js")
    if "assets/story-router.js" not in config:
        base.error("supabase-config.js is not loading the canonical story router.")
    if "NEURAL_CRITIC_STATIC_META" not in config:
        base.error("supabase-config.js is not preserving generated static story metadata.")
    for marker in ("stories/", "data-article-share", "neuralcritic:analytics-script-loaded"):
        if marker not in router and marker not in config:
            base.error(f"Canonical story routing is missing integration marker: {marker}")


def check_recirculation() -> None:
    config = base.text("assets/supabase-config.js")
    script = base.text("assets/recirculation.js")
    style = base.text("assets/recirculation.css")
    for asset in ("assets/recirculation.js", "assets/recirculation.css"):
        if asset not in config:
            base.error(f"supabase-config.js is not loading article recirculation asset: {asset}")
    for marker in ("recirculation_click", "recirculation_view", "stories/", "work-related-card"):
        if marker not in script:
            base.error(f"recirculation.js is missing integration marker: {marker}")
    for marker in (".nc-recirculation", ".nc-recirc-grid", "prefers-reduced-motion"):
        if marker not in style:
            base.error(f"recirculation.css is missing required presentation marker: {marker}")


def check_trust_and_monetization() -> None:
    bootstrap = base.text("assets/supabase-config.js")
    config = base.text("assets/monetization-config.js")
    script = base.text("assets/monetization.js")
    style = base.text("assets/monetization.css")

    for page, canonical, robots in (
        ("standards.html", "standards.html", "index,follow"),
        ("commercial.html", "commercial.html", "index,follow"),
        ("privacy.html", "privacy.html", "noindex"),
    ):
        html = base.text(page)
        if 'name="description"' not in html:
            base.error(f"{page}: missing static meta description.")
        if f'rel="canonical" href="{canonical}"' not in html:
            base.error(f"{page}: missing self canonical.")
        if robots not in html:
            base.error(f"{page}: unexpected robots metadata.")

    for marker in ("privacy.html", "standards.html", "commercial.html"):
        if marker not in bootstrap:
            base.error(f"supabase-config.js is not preserving static metadata for {marker}.")

    for asset in ("assets/monetization-config.js", "assets/monetization.js", "assets/monetization.css"):
        if asset not in bootstrap:
            base.error(f"supabase-config.js is not loading monetization readiness asset: {asset}")

    if not re.search(r"adsEnabled:\s*false", config):
        base.error("Monetization config must keep ads disabled by default until explicitly launched.")
    if not re.search(r"affiliateTrackingEnabled:\s*true", config):
        base.error("Affiliate click measurement readiness is unexpectedly disabled.")

    for marker in ("sponsored", "affiliate_click", "destination_host", "data-ad-slot", "commercial.html"):
        if marker not in script:
            base.error(f"monetization.js is missing safety/integration marker: {marker}")
    if "window.NeuralCriticAnalytics?.track" not in script:
        base.error("monetization.js is not using the privacy-aware analytics wrapper.")
    for forbidden in ("googlesyndication", "doubleclick", "adsbygoogle"):
        if forbidden in script.lower() or forbidden in config.lower():
            base.error(f"Ad-network runtime was introduced before monetization launch: {forbidden}")
    if ".nc-ad-slot" not in style or ".nc-commercial-label" not in style:
        base.error("monetization.css is missing reserved-slot or disclosure styling.")

    commercial = base.text("commercial.html")
    for marker in ("Current status:", "Editorial independence", "Affiliate links", "Sponsored content", "Advertising", "Privacy page"):
        if marker not in commercial:
            base.error(f"commercial.html is missing disclosure section/content marker: {marker}")


def main() -> int:
    base.ERRORS.clear()
    base.WARNINGS.clear()

    base.check_article_runtime()
    base.check_no_generated_routes()
    static_slugs = base.check_article_data()
    base.check_image_budget()
    check_story_pages(static_slugs)
    check_canonical_sitemap(static_slugs)
    check_canonical_feed(static_slugs)
    check_story_router()
    check_recirculation()
    check_trust_and_monetization()
    base.check_robots()
    base.check_page_metadata()
    base.check_analytics()

    for message in base.WARNINGS:
        print(f"WARNING: {message}")
    if base.ERRORS:
        for message in base.ERRORS:
            print(f"ERROR: {message}", file=sys.stderr)
        print(f"Neural Critic publication audit failed with {len(base.ERRORS)} error(s).", file=sys.stderr)
        return 1
    print(f"Neural Critic publication audit passed ({len(static_slugs)} fallback articles + live CMS story shells checked).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
