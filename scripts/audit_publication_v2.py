#!/usr/bin/env python3
"""Neural Critic publication audit with canonical story, topic, author, news, and routing checks."""

from __future__ import annotations

import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import urlparse

import audit_publication as base
from publication_config import BASE_PATH, SITE_URL

ROOT = Path(__file__).resolve().parents[1]
SITE_PARTS = urlparse(SITE_URL)
STORY_PATTERN = re.compile(rf"^{re.escape(BASE_PATH)}stories/([A-Za-z0-9][A-Za-z0-9_-]*)/$")
BASE_TAG = f'<base href="{BASE_PATH}">'
GENERATED_STORY_MARKER = "<!-- generated: neural-critic-story-shell -->"
GENERATED_TOPIC_MARKER = "<!-- generated: neural-critic-topic-hub -->"
GENERATED_AUTHOR_MARKER = "<!-- generated: neural-critic-author-hub -->"


def canonical_url_for_page(page: Path) -> str:
    relative = page.relative_to(ROOT).parent.as_posix().strip("/")
    return f"{SITE_URL}{relative}/"


def generated_pages(root_name: str, marker: str) -> list[Path]:
    root = ROOT / root_name
    if not root.exists():
        return []
    pages: list[Path] = []
    for page in root.rglob("index.html"):
        sample = page.read_text(encoding="utf-8", errors="ignore")[:2200]
        if marker in sample:
            pages.append(page)
    return sorted(pages)


def check_story_pages(static_slugs: set[str]) -> set[str]:
    pages = generated_pages("stories", GENERATED_STORY_MARKER)
    if not pages:
        base.error("Missing generated canonical article shells.")
        return set()

    generated: set[str] = set()
    for page in pages:
        slug = page.parent.name
        generated.add(slug)
        html = page.read_text(encoding="utf-8", errors="replace")
        canonical = f"{SITE_URL}stories/{slug}/"
        required = [
            GENERATED_STORY_MARKER,
            BASE_TAG,
            "window.NEURAL_CRITIC_STATIC_META=true",
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
    return generated


def check_generated_hubs() -> tuple[set[str], set[str]]:
    topic_template = base.text("topic.html")
    author_template = base.text("author.html")

    for marker in ('id="topic-hub"', "assets/topic-hub.js", "assets/topic-hub.css"):
        if marker not in topic_template:
            base.error(f"topic.html is missing topic hub integration marker: {marker}")
    for marker in ('id="author-hub"', "assets/author-system.js", "assets/author-hub.css"):
        if marker not in author_template:
            base.error(f"author.html is missing writer hub integration marker: {marker}")

    topic_urls: set[str] = set()
    for page in generated_pages("topics", GENERATED_TOPIC_MARKER):
        html = page.read_text(encoding="utf-8", errors="replace")
        canonical = canonical_url_for_page(page)
        topic_urls.add(canonical)
        for marker in (
            GENERATED_TOPIC_MARKER,
            BASE_TAG,
            "window.NEURAL_CRITIC_STATIC_META=true",
            "window.NEURAL_CRITIC_STATIC_TOPIC=",
            'name="description"',
            'name="robots" content="index,follow',
            'id="nc-topic-structured-data"',
            f'rel="canonical" href="{canonical}"',
        ):
            if marker not in html:
                base.error(f"{page.relative_to(ROOT)} is missing topic marker: {marker}")

    author_urls: set[str] = set()
    for page in generated_pages("authors", GENERATED_AUTHOR_MARKER):
        html = page.read_text(encoding="utf-8", errors="replace")
        canonical = canonical_url_for_page(page)
        author_urls.add(canonical)
        for marker in (
            GENERATED_AUTHOR_MARKER,
            BASE_TAG,
            "window.NEURAL_CRITIC_STATIC_META=true",
            "window.NEURAL_CRITIC_STATIC_AUTHOR=",
            'name="description"',
            'name="robots" content="index,follow',
            'id="nc-author-structured-data"',
            '"@type":"ProfilePage"',
            f'rel="canonical" href="{canonical}"',
        ):
            if marker not in html:
                base.error(f"{page.relative_to(ROOT)} is missing author marker: {marker}")

    if not topic_urls:
        base.warn("No generated Game Graph topic hubs were found.")
    if not author_urls:
        base.warn("No generated writer hubs were found.")
    return topic_urls, author_urls


def sitemap_locations() -> set[str]:
    path = ROOT / "sitemap.xml"
    if not path.exists():
        base.error("Missing sitemap.xml")
        return set()
    try:
        tree = ET.parse(path)
    except Exception as exc:
        base.error(f"sitemap.xml is invalid XML: {exc}")
        return set()
    ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    return {node.text.strip() for node in tree.findall("sm:url/sm:loc", ns) if node.text}


def check_canonical_sitemap(
    static_slugs: set[str],
    generated_story_slugs: set[str],
    topic_urls: set[str],
    author_urls: set[str],
) -> None:
    locs = sitemap_locations()
    if not locs:
        return
    if SITE_URL not in locs:
        base.error("sitemap.xml does not include the homepage.")

    story_slugs: set[str] = set()
    for loc in locs:
        parsed = urlparse(loc)
        if parsed.scheme != SITE_PARTS.scheme or parsed.netloc != SITE_PARTS.netloc or not parsed.path.startswith(BASE_PATH):
            base.error(f"Unexpected sitemap host/path: {loc}")
            continue
        if parsed.path.endswith("/article.html"):
            base.error(f"Legacy query article URL remains in sitemap: {loc}")
        match = STORY_PATTERN.fullmatch(parsed.path)
        if match:
            story_slugs.add(match.group(1))

    expected_stories = static_slugs | generated_story_slugs
    missing_stories = expected_stories - story_slugs
    if missing_stories:
        base.error("Canonical stories missing from sitemap: " + ", ".join(sorted(missing_stories)))

    missing_hubs = (topic_urls | author_urls) - locs
    if missing_hubs:
        base.error("Generated hubs missing from sitemap: " + ", ".join(sorted(missing_hubs)))


def check_canonical_feed(generated_story_slugs: set[str]) -> None:
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
        if parsed.scheme != SITE_PARTS.scheme or parsed.netloc != SITE_PARTS.netloc or not parsed.path.startswith(BASE_PATH):
            base.error(f"Unexpected RSS host/path: {link}")
            continue
        if parsed.path.endswith("/article.html"):
            base.error(f"Legacy query article URL remains in RSS: {link}")
        match = STORY_PATTERN.fullmatch(parsed.path)
        if match:
            feed_slugs.add(match.group(1))

    missing = generated_story_slugs - feed_slugs
    if missing:
        base.warn("Generated canonical stories missing from current RSS feed: " + ", ".join(sorted(missing)))

    home = base.text("index.html")
    if 'type="application/rss+xml"' not in home or 'href="feed.xml"' not in home:
        base.error("index.html is missing RSS autodiscovery metadata.")


def check_routing_recovery() -> None:
    config = base.text("assets/supabase-config.js")
    router = base.text("assets/story-router.js")
    readiness = base.text("assets/story-readiness-guard.js")
    not_found = base.text("404.html")

    if "assets/story-router.js" not in config:
        base.error("supabase-config.js is not loading the canonical story router.")
    if "NEURAL_CRITIC_STATIC_META" not in config:
        base.error("supabase-config.js is not preserving generated static metadata.")
    for marker in ("stories/", "data-article-share", "neuralcritic:analytics-script-loaded"):
        if marker not in router and marker not in config:
            base.error(f"Canonical story routing is missing integration marker: {marker}")
    for marker in ("HEAD", "data-nc-canonical-story", "article.html"):
        if marker not in readiness:
            base.error(f"Story readiness guard is missing recovery marker: {marker}")
    for marker in (
        "NEURAL_CRITIC_404_ROOT",
        "article.html?slug=",
        "topic.html?",
        "author.html?author=",
    ):
        if marker not in not_found:
            base.error(f"404.html is missing canonical recovery marker: {marker}")


def check_recirculation_and_graph() -> None:
    config = base.text("assets/supabase-config.js")
    content = base.text("assets/content-api.js")
    script = base.text("assets/recirculation.js")
    style = base.text("assets/recirculation.css")
    identity = base.text("assets/game-graph-identity.js")
    topic = base.text("assets/topic-hub.js")

    for asset in ("assets/recirculation.js", "assets/recirculation.css"):
        if asset not in config:
            base.error(f"supabase-config.js is not loading article recirculation asset: {asset}")
    for marker in ("recirculation_click", "recirculation_view", "stories/", "same_game", "same_series", "same_franchise"):
        if marker not in script:
            base.error(f"recirculation.js is missing relationship marker: {marker}")
    for marker in (".nc-recirculation", ".nc-recirc-grid", "prefers-reduced-motion"):
        if marker not in style:
            base.error(f"recirculation.css is missing presentation marker: {marker}")
    for marker in ("gameKey", "series", "franchise", "newsMeta"):
        if marker not in content:
            base.error(f"content-api.js is missing structured CMS field mapping: {marker}")
    for asset in ("assets/game-graph-identity.js", "assets/game-graph-identity.css"):
        if asset not in config:
            base.error(f"supabase-config.js is not loading Game Graph identity asset: {asset}")
    for marker in ("topics/", "CONNECTED COVERAGE", "game", "series", "franchise"):
        if marker not in identity and marker not in topic:
            base.error(f"Game Graph runtime is missing integration marker: {marker}")


def check_newsroom() -> None:
    bootstrap = base.text("assets/supabase-config.js")
    studio = base.text("assets/studio-news.js")
    article = base.text("assets/article-news.js")
    home = base.text("assets/home-feed.js")
    index = base.text("index.html")
    category_page = base.text("category.html")
    category = base.text("assets/category-news.js")

    for asset in ("assets/studio-news.js", "assets/studio-news.css", "assets/article-news.js", "assets/article-news.css"):
        if asset not in bootstrap:
            base.error(f"supabase-config.js is not loading newsroom asset: {asset}")
    for marker in ("breaking", "update", "report", "sourceName", "sourceUrl"):
        if marker not in studio:
            base.error(f"studio-news.js is missing structured newsroom marker: {marker}")
    for marker in ("CONFIRMED", "NOT FULLY CONFIRMED", "SOURCE / ORIGIN", "Update log", "news_article_view"):
        if marker not in article:
            base.error(f"article-news.js is missing reader trust marker: {marker}")
    for marker in ("PAGE_SIZE = 3", "nc-feed-load-more", "data-news-kind", "homepage_feed_load_more"):
        if marker not in home:
            base.error(f"home-feed.js is missing progressive feed marker: {marker}")
    if "assets/home-feed.js" not in index:
        base.error("index.html is not loading the progressive homepage feed.")
    for marker in ("assets/category-news.js", "assets/category-news.css"):
        if marker not in category_page:
            base.error(f"category.html is not loading newsroom category asset: {marker}")
    for marker in ("breaking", "update", "report"):
        if marker not in category:
            base.error(f"category-news.js is missing news lane marker: {marker}")


def check_author_system() -> None:
    author = base.text("assets/author-system.js")
    directory = base.text("data/authors.json")
    for marker in ("ProfilePage", "Person", "author_hub_view", "VIEW WRITER PROFILE", "authors/"):
        if marker not in author:
            base.error(f"author-system.js is missing writer identity marker: {marker}")
    if '"slug"' not in directory or '"name"' not in directory:
        base.error("data/authors.json is missing canonical writer identity fields.")


def check_newsletter_conversion() -> None:
    content = base.text("assets/content-api.js")
    analytics = base.text("assets/analytics.js")
    for marker in ("subscribe_newsletter", "newsletter_signup", "signup_source"):
        if marker not in content:
            base.error(f"content-api.js is missing newsletter success marker: {marker}")
    if "newsletter_signup" not in analytics:
        base.error("analytics.js is missing newsletter conversion fallback tracking.")


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

    generated_story_slugs = check_story_pages(static_slugs)
    topic_urls, author_urls = check_generated_hubs()
    check_canonical_sitemap(static_slugs, generated_story_slugs, topic_urls, author_urls)
    check_canonical_feed(generated_story_slugs)
    check_routing_recovery()
    check_recirculation_and_graph()
    check_newsroom()
    check_author_system()
    check_newsletter_conversion()
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

    print(
        "Neural Critic publication audit passed "
        f"({len(generated_story_slugs)} canonical stories, {len(topic_urls)} topic hubs, "
        f"{len(author_urls)} writer hubs checked)."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
