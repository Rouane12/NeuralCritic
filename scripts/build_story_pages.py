#!/usr/bin/env python3
"""Build crawler-visible Neural Critic story shells from published CMS metadata.

The generated pages do not duplicate the article renderer. Each shell reuses the
stable article.html runtime, but exposes article-specific canonical, Open Graph,
Twitter, and JSON-LD metadata before JavaScript runs. During bootstrap the shell
briefly presents itself to the existing runtime as article.html?slug=..., then the
shared story router restores the canonical /stories/<slug>/ URL after analytics
has initialized.
"""

from __future__ import annotations

import html
import json
import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any

from publication_config import BASE_PATH, SITE_URL, public_path

ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "assets" / "supabase-config.js"
ARTICLE_TEMPLATE = ROOT / "article.html"
FALLBACK_INDEX = ROOT / "data" / "articles.json"
FALLBACK_DIR = ROOT / "data" / "articles"
STORIES_DIR = ROOT / "stories"
SITEMAP_PATH = ROOT / "sitemap.xml"
FEED_PATH = ROOT / "feed.xml"
GENERATED_MARKER = "<!-- generated: neural-critic-story-shell -->"
MEDIA_MARKER = "/media/editorial/"
GENERIC_TAGS = {
    "review", "reviews", "feature", "features", "news", "guide", "guides",
    "pc", "playstation", "xbox", "nintendo", "mobile", "action rpg", "open world",
}


def read_supabase_config() -> tuple[str, str]:
    text = CONFIG_PATH.read_text(encoding="utf-8")
    url_match = re.search(r"url:\s*['\"]([^'\"]+)['\"]", text)
    key_match = re.search(r"publishableKey:\s*['\"]([^'\"]+)['\"]", text)
    if not url_match or not key_match:
        raise RuntimeError("Could not read Supabase public configuration.")
    return url_match.group(1).rstrip("/"), key_match.group(1)


def valid_slug(slug: str) -> bool:
    return bool(re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]*", slug))


def story_url(slug: str) -> str:
    return urllib.parse.urljoin(SITE_URL, f"stories/{urllib.parse.quote(slug, safe='-._~')}/")


def stable_image(value: object) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    if MEDIA_MARKER in raw:
        filename = raw.split(MEDIA_MARKER, 1)[1].split("?", 1)[0].split("#", 1)[0]
        if filename:
            return urllib.parse.urljoin(SITE_URL, f"images/editorial/{urllib.parse.quote(urllib.parse.unquote(filename), safe='-._~')}")
    return urllib.parse.urljoin(SITE_URL, raw)


def map_live_row(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "slug": row.get("slug") or "",
        "title": row.get("title") or "",
        "description": row.get("description") or "",
        "category": row.get("category") or "FEATURE",
        "author": row.get("author_name") or "Rouane Mounssif",
        "tags": row.get("tags") if isinstance(row.get("tags"), list) else [],
        "imageLocal": row.get("image_url") or "",
        "imageAlt": row.get("image_alt") or "",
        "articleFormat": row.get("article_format") or "standard",
        "reviewMeta": row.get("review_meta") if isinstance(row.get("review_meta"), dict) else {},
        "publishedAt": row.get("published_at") or "",
        "updatedAt": row.get("updated_at") or row.get("published_at") or "",
    }


def fetch_published() -> list[dict[str, Any]]:
    supabase_url, key = read_supabase_config()
    query = urllib.parse.urlencode(
        {
            "select": "slug,title,description,category,author_name,tags,image_url,image_alt,article_format,review_meta,published_at,updated_at",
            "status": "eq.published",
            "published_at": "lte.now()",
            "order": "published_at.desc",
            "limit": "200",
        },
        safe=".*,:()+-",
    )
    request = urllib.request.Request(
        f"{supabase_url}/rest/v1/articles?{query}",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Accept": "application/json",
            "User-Agent": "NeuralCritic-StoryBuilder/1.0",
        },
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        payload = json.loads(response.read().decode("utf-8"))
    if not isinstance(payload, list):
        raise RuntimeError("Supabase article response was not a list.")
    return [map_live_row(row) for row in payload if isinstance(row, dict)]


def fallback_published() -> list[dict[str, Any]]:
    payload = json.loads(FALLBACK_INDEX.read_text(encoding="utf-8"))
    if not isinstance(payload, list):
        return []
    rows: list[dict[str, Any]] = []
    for item in payload:
        if not isinstance(item, dict):
            continue
        slug = str(item.get("slug") or "").strip()
        if not valid_slug(slug):
            continue
        detail_path = FALLBACK_DIR / f"{slug}.json"
        detail = item
        if detail_path.exists():
            try:
                candidate = json.loads(detail_path.read_text(encoding="utf-8"))
                if isinstance(candidate, dict):
                    detail = {**item, **candidate}
            except Exception:
                pass
        rows.append(
            {
                "slug": slug,
                "title": detail.get("title") or "",
                "description": detail.get("description") or "",
                "category": detail.get("category") or "FEATURE",
                "author": detail.get("author") or "Rouane Mounssif",
                "tags": detail.get("tags") if isinstance(detail.get("tags"), list) else [],
                "imageLocal": detail.get("imageLocal") or "",
                "imageAlt": detail.get("imageAlt") or "",
                "articleFormat": detail.get("articleFormat") or "standard",
                "reviewMeta": detail.get("reviewMeta") if isinstance(detail.get("reviewMeta"), dict) else {},
                "publishedAt": detail.get("publishedAt") or detail.get("published_at") or "",
                "updatedAt": detail.get("updatedAt") or detail.get("updated_at") or detail.get("publishedAt") or "",
            }
        )
    return rows


def load_articles() -> tuple[list[dict[str, Any]], str]:
    try:
        rows = fetch_published()
        if rows:
            return rows, "supabase"
    except Exception as exc:
        print(f"Live story metadata unavailable ({exc}); using repository fallback.")
    return fallback_published(), "repository"


def game_name(article: dict[str, Any]) -> str:
    for tag in article.get("tags") or []:
        value = str(tag or "").strip()
        if value and value.lower() not in GENERIC_TAGS:
            return value
    title = str(article.get("title") or "").strip()
    title = re.sub(r"\s+review\s*:.*$", "", title, flags=re.I)
    title = re.sub(r"\s+review$", "", title, flags=re.I)
    return title or "Video game"


def publisher() -> dict[str, Any]:
    return {
        "@type": "Organization",
        "name": "Neural Critic",
        "url": SITE_URL,
        "logo": {"@type": "ImageObject", "url": urllib.parse.urljoin(SITE_URL, "favicon.svg")},
    }


def compact(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: compact(item) for key, item in value.items() if item not in (None, "", [], {})}
    if isinstance(value, list):
        return [compact(item) for item in value if item not in (None, "", [], {})]
    return value


def article_schema(article: dict[str, Any], canonical: str, image: str) -> dict[str, Any]:
    common: dict[str, Any] = {
        "@context": "https://schema.org",
        "name": article.get("title"),
        "headline": article.get("title"),
        "description": article.get("description"),
        "url": canonical,
        "inLanguage": "en",
        "isAccessibleForFree": True,
        "datePublished": article.get("publishedAt"),
        "dateModified": article.get("updatedAt"),
        "author": {"@type": "Person", "name": article.get("author") or "Rouane Mounssif"},
        "publisher": publisher(),
        "mainEntityOfPage": {"@type": "WebPage", "@id": canonical},
        "image": [image] if image else None,
        "thumbnailUrl": image or None,
        "keywords": ", ".join(str(tag) for tag in article.get("tags") or []) or None,
    }

    if article.get("articleFormat") == "review":
        meta = article.get("reviewMeta") or {}
        try:
            score = float(meta.get("score"))
        except (TypeError, ValueError):
            score = None
        game: dict[str, Any] = {"@type": "VideoGame", "name": game_name(article)}
        if meta.get("developer"):
            game["author"] = {"@type": "Organization", "name": str(meta["developer"])}
        if meta.get("publisher"):
            game["publisher"] = {"@type": "Organization", "name": str(meta["publisher"])}
        if meta.get("testedPlatform"):
            game["gamePlatform"] = str(meta["testedPlatform"])
        schema = {
            **common,
            "@type": "Review",
            "reviewBody": meta.get("verdict") or article.get("description"),
            "itemReviewed": game,
            "reviewRating": {
                "@type": "Rating",
                "ratingValue": score,
                "bestRating": 10,
                "worstRating": 0,
            } if score is not None else None,
            "positiveNotes": {
                "@type": "ItemList",
                "itemListElement": [
                    {"@type": "ListItem", "position": index + 1, "name": value}
                    for index, value in enumerate(meta.get("pros") or [])
                ],
            } if meta.get("pros") else None,
            "negativeNotes": {
                "@type": "ItemList",
                "itemListElement": [
                    {"@type": "ListItem", "position": index + 1, "name": value}
                    for index, value in enumerate(meta.get("cons") or [])
                ],
            } if meta.get("cons") else None,
        }
        return compact(schema)

    return compact(
        {
            **common,
            "@type": "NewsArticle" if str(article.get("category") or "").upper() == "NEWS" else "Article",
            "articleSection": article.get("category"),
        }
    )


def breadcrumb_schema(article: dict[str, Any], canonical: str) -> dict[str, Any]:
    category = str(article.get("category") or "FEATURE").lower()
    key = "reviews" if category == "review" else "guides" if category == "guide" else "news" if category == "news" else "features"
    label = key.replace("-", " ").title()
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Neural Critic", "item": SITE_URL},
            {"@type": "ListItem", "position": 2, "name": label, "item": urllib.parse.urljoin(SITE_URL, f"category.html?category={key}")},
            {"@type": "ListItem", "position": 3, "name": article.get("title"), "item": canonical},
        ],
    }


def json_script(value: dict[str, Any]) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")


def metadata_markup(article: dict[str, Any]) -> str:
    slug = str(article["slug"])
    canonical = story_url(slug)
    title = str(article.get("title") or "Story")
    page_title = f"{title} · Neural Critic"
    description = str(article.get("description") or "Gaming coverage from Neural Critic.")
    category = str(article.get("category") or "FEATURE")
    author = str(article.get("author") or "Rouane Mounssif")
    image = stable_image(article.get("imageLocal"))
    image_alt = str(article.get("imageAlt") or title)
    published = str(article.get("publishedAt") or "")
    modified = str(article.get("updatedAt") or published)

    esc = lambda value: html.escape(str(value), quote=True)
    parts = [
        GENERATED_MARKER,
        f'<base href="{esc(BASE_PATH)}">',
        f'<meta name="description" content="{esc(description)}">',
        '<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">',
        '<meta property="og:site_name" content="Neural Critic">',
        '<meta property="og:locale" content="en_US">',
        '<meta property="og:type" content="article">',
        f'<meta property="og:title" content="{esc(page_title)}">',
        f'<meta property="og:description" content="{esc(description)}">',
        f'<meta property="og:url" content="{esc(canonical)}">',
        f'<link rel="canonical" href="{esc(canonical)}">',
        '<meta name="twitter:card" content="summary_large_image">' if image else '<meta name="twitter:card" content="summary">',
        f'<meta name="twitter:title" content="{esc(page_title)}">',
        f'<meta name="twitter:description" content="{esc(description)}">',
        f'<meta property="article:section" content="{esc(category)}">',
        f'<meta property="article:author" content="{esc(author)}">',
    ]
    if published:
        parts.append(f'<meta property="article:published_time" content="{esc(published)}">')
    if modified:
        parts.append(f'<meta property="article:modified_time" content="{esc(modified)}">')
    for tag in article.get("tags") or []:
        if str(tag).strip():
            parts.append(f'<meta property="article:tag" content="{esc(tag)}">')
    if image:
        parts.extend(
            [
                f'<meta property="og:image" content="{esc(image)}">',
                f'<meta property="og:image:secure_url" content="{esc(image)}">',
                f'<meta property="og:image:alt" content="{esc(image_alt)}">',
                f'<meta name="twitter:image" content="{esc(image)}">',
                f'<meta name="twitter:image:alt" content="{esc(image_alt)}">',
            ]
        )

    parts.append(f'<script id="nc-structured-data" type="application/ld+json">{json_script(article_schema(article, canonical, image))}</script>')
    parts.append(f'<script id="nc-breadcrumb-data" type="application/ld+json">{json_script(breadcrumb_schema(article, canonical))}</script>')
    slug_json = json.dumps(slug)
    runtime_article_json = json.dumps(public_path("article.html"))
    parts.append(
        "<script>"
        f"window.NEURAL_CRITIC_STATIC_META=true;window.NEURAL_CRITIC_STATIC_SLUG={slug_json};"
        f"try{{const h=location.hash||'';history.replaceState(null,'',{runtime_article_json}+'?slug='+encodeURIComponent(window.NEURAL_CRITIC_STATIC_SLUG)+h);}}catch(_){{}}"
        "</script>"
    )
    return "".join(parts)


def render_story(template: str, article: dict[str, Any]) -> str:
    title = html.escape(f"{article.get('title') or 'Story'} · Neural Critic", quote=False)
    output = template.replace("<head>", f"<head>{metadata_markup(article)}", 1)
    output = output.replace("<title>Story · Neural Critic</title>", f"<title>{title}</title>", 1)
    return output


def write_story_pages(rows: list[dict[str, Any]]) -> set[str]:
    template = ARTICLE_TEMPLATE.read_text(encoding="utf-8")
    STORIES_DIR.mkdir(parents=True, exist_ok=True)
    active: set[str] = set()
    for article in rows:
        slug = str(article.get("slug") or "").strip()
        title = str(article.get("title") or "").strip()
        if not valid_slug(slug) or not title or slug in active:
            continue
        active.add(slug)
        directory = STORIES_DIR / slug
        directory.mkdir(parents=True, exist_ok=True)
        (directory / "index.html").write_text(render_story(template, article), encoding="utf-8")

    for page in STORIES_DIR.glob("*/index.html"):
        slug = page.parent.name
        if slug in active:
            continue
        try:
            sample = page.read_text(encoding="utf-8", errors="ignore")[:1000]
        except Exception:
            continue
        if GENERATED_MARKER not in sample:
            continue
        page.unlink()
        try:
            page.parent.rmdir()
        except OSError:
            pass
    return active


def sync_sitemap(rows: list[dict[str, Any]]) -> None:
    if not SITEMAP_PATH.exists():
        return
    ET.register_namespace("", "http://www.sitemaps.org/schemas/sitemap/0.9")
    tree = ET.parse(SITEMAP_PATH)
    root = tree.getroot()
    namespace = "{http://www.sitemaps.org/schemas/sitemap/0.9}"

    for node in list(root):
        loc = node.find(f"{namespace}loc")
        value = (loc.text or "").strip() if loc is not None else ""
        parsed = urllib.parse.urlparse(value)
        if parsed.path.endswith("/article.html") or "/stories/" in parsed.path:
            root.remove(node)

    seen: set[str] = set()
    for article in rows:
        slug = str(article.get("slug") or "").strip()
        if not valid_slug(slug) or slug in seen:
            continue
        seen.add(slug)
        node = ET.SubElement(root, f"{namespace}url")
        ET.SubElement(node, f"{namespace}loc").text = story_url(slug)
        lastmod = str(article.get("updatedAt") or article.get("publishedAt") or "").strip()
        if lastmod:
            ET.SubElement(node, f"{namespace}lastmod").text = lastmod

    ET.indent(tree, space="  ")
    tree.write(SITEMAP_PATH, encoding="utf-8", xml_declaration=True)


def sync_feed() -> None:
    if not FEED_PATH.exists():
        return
    ET.register_namespace("atom", "http://www.w3.org/2005/Atom")
    tree = ET.parse(FEED_PATH)
    root = tree.getroot()
    for item in root.findall("./channel/item"):
        for tag in ("link", "guid"):
            node = item.find(tag)
            if node is None or not node.text:
                continue
            parsed = urllib.parse.urlparse(node.text.strip())
            if not parsed.path.endswith("/article.html"):
                continue
            slug = urllib.parse.parse_qs(parsed.query).get("slug", [""])[0]
            if valid_slug(slug):
                node.text = story_url(slug)
    ET.indent(tree, space="  ")
    tree.write(FEED_PATH, encoding="utf-8", xml_declaration=True)


def main() -> int:
    rows, source = load_articles()
    active = write_story_pages(rows)
    sync_sitemap(rows)
    sync_feed()
    print(f"Built {len(active)} canonical Neural Critic story shells from {source} metadata.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
