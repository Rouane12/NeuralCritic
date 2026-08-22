#!/usr/bin/env python3
"""Generate SEO-native Neural Critic article routes and sitemap for GitHub Pages.

Supabase remains the source of truth. The generator tries the public CMS first,
then falls back to the checked-in article index if the network is unavailable.
Generated pages reuse article.html at runtime through <base href="../../"> and a
small slug compatibility bridge, so the publication keeps one article UI.
"""

from __future__ import annotations

import html
import json
import os
import re
import shutil
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
TEMPLATE_PATH = ROOT / "article.html"
CONFIG_PATH = ROOT / "assets" / "supabase-config.js"
FALLBACK_INDEX = ROOT / "data" / "articles.json"
MANIFEST_PATH = ROOT / ".generated-routes.json"
SITE_URL = os.environ.get("NC_SITE_URL", "https://rouane12.github.io/NeuralCritic/").rstrip("/") + "/"
GENERATED_MARKER = "<!-- NEURAL_CRITIC_GENERATED_ROUTE -->"
ROUTE_SECTIONS = ("reviews", "features", "guides", "news")


def read_supabase_config() -> tuple[str, str]:
    text = CONFIG_PATH.read_text(encoding="utf-8")
    url_match = re.search(r"url:\s*['\"]([^'\"]+)['\"]", text)
    key_match = re.search(r"publishableKey:\s*['\"]([^'\"]+)['\"]", text)
    if not url_match or not key_match:
        raise RuntimeError("Could not read Supabase public configuration.")
    return url_match.group(1).rstrip("/"), key_match.group(1)


def normalize_article(row: dict[str, Any]) -> dict[str, Any]:
    def pick(camel: str, snake: str, default: Any = None) -> Any:
        if camel in row and row[camel] is not None:
            return row[camel]
        if snake in row and row[snake] is not None:
            return row[snake]
        return default

    return {
        "id": row.get("id"),
        "slug": str(row.get("slug") or "").strip(),
        "title": str(row.get("title") or "Untitled story").strip(),
        "description": str(row.get("description") or "").strip(),
        "body": str(row.get("body") or "").strip(),
        "category": str(row.get("category") or "FEATURE").strip(),
        "author": str(pick("author", "author_name", "Rouane Mounssif")).strip(),
        "tags": pick("tags", "tags", []) if isinstance(pick("tags", "tags", []), list) else [],
        "imageAlt": str(pick("imageAlt", "image_alt", "") or "").strip(),
        "imageLocal": str(pick("imageLocal", "image_url", "") or "").strip(),
        "articleFormat": str(pick("articleFormat", "article_format", "standard") or "standard").strip(),
        "reviewMeta": pick("reviewMeta", "review_meta", {}) if isinstance(pick("reviewMeta", "review_meta", {}), dict) else {},
        "publishedAt": pick("publishedAt", "published_at", None),
        "contentBlocks": pick("contentBlocks", "content_blocks", []) if isinstance(pick("contentBlocks", "content_blocks", []), list) else [],
        "conclusion": str(row.get("conclusion") or "").strip(),
    }


def fetch_live_articles() -> list[dict[str, Any]]:
    url, key = read_supabase_config()
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    query = urllib.parse.urlencode(
        {
            "select": "*",
            "status": "eq.published",
            "published_at": f"lte.{now}",
            "order": "published_at.desc",
        },
        safe=".*,:+-",
    )
    request = urllib.request.Request(
        f"{url}/rest/v1/articles?{query}",
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
    return [normalize_article(row) for row in payload if isinstance(row, dict)]


def fallback_articles() -> list[dict[str, Any]]:
    payload = json.loads(FALLBACK_INDEX.read_text(encoding="utf-8"))
    if not isinstance(payload, list):
        return []
    articles = [normalize_article(row) for row in payload if isinstance(row, dict)]
    # Enrich from checked-in detail JSON when available.
    for article in articles:
        detail_path = ROOT / "data" / "articles" / f"{article['slug']}.json"
        if detail_path.exists():
            try:
                detail = json.loads(detail_path.read_text(encoding="utf-8"))
                if isinstance(detail, dict):
                    article.update(normalize_article({**article, **detail}))
            except Exception:
                pass
    return articles


def load_articles() -> tuple[list[dict[str, Any]], str]:
    try:
        live = fetch_live_articles()
        if live:
            return live, "supabase"
        print("Supabase returned no published stories; using repository fallback.")
    except Exception as exc:
        print(f"Live CMS fetch unavailable ({exc}); using repository fallback.")
    return fallback_articles(), "repository"


def section_for(article: dict[str, Any]) -> str:
    fmt = str(article.get("articleFormat") or "").lower()
    cat = str(article.get("category") or "").lower()
    if fmt == "review" or cat == "review":
        return "reviews"
    if fmt == "game-guide" or cat == "guide":
        return "guides"
    if cat == "news":
        return "news"
    return "features"


def valid_slug(slug: str) -> bool:
    return bool(slug) and bool(re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]*", slug))


def route_url(article: dict[str, Any]) -> str:
    slug = urllib.parse.quote(article["slug"], safe="-._~")
    return urllib.parse.urljoin(SITE_URL, f"{section_for(article)}/{slug}/")


def social_image(article: dict[str, Any]) -> str:
    value = str(article.get("imageLocal") or "").strip()
    if not value:
        return ""
    if value.startswith("images/"):
        return urllib.parse.urljoin(SITE_URL, value)
    marker = "/media/editorial/"
    if value.startswith(("http://", "https://")) and marker in value:
        filename = value.split(marker, 1)[1].split("?", 1)[0].split("#", 1)[0]
        filename = urllib.parse.unquote(filename)
        local = ROOT / "images" / "editorial" / filename
        if local.is_file():
            return urllib.parse.urljoin(SITE_URL, f"images/editorial/{urllib.parse.quote(filename)}")
    if value.startswith(("http://", "https://")):
        return value
    return urllib.parse.urljoin(SITE_URL, value.lstrip("/"))


def game_name(article: dict[str, Any]) -> str:
    title = article.get("title", "")
    match = re.match(r"^(.+?)\s+review\b", title, flags=re.I)
    if match:
        return match.group(1).strip()
    generic = {
        "review", "reviews", "feature", "features", "news", "guide", "guides",
        "pc", "playstation", "xbox", "nintendo", "action rpg", "open world",
    }
    for tag in article.get("tags", []):
        if str(tag).strip().lower() not in generic:
            return str(tag).strip()
    return title


def schema_for(article: dict[str, Any], canonical: str, image: str) -> dict[str, Any]:
    publisher = {
        "@type": "Organization",
        "name": "Neural Critic",
        "url": SITE_URL,
        "logo": {"@type": "ImageObject", "url": urllib.parse.urljoin(SITE_URL, "favicon.svg")},
    }
    common: dict[str, Any] = {
        "@context": "https://schema.org",
        "name": article["title"],
        "headline": article["title"],
        "description": article.get("description") or "",
        "datePublished": article.get("publishedAt"),
        "author": {"@type": "Person", "name": article.get("author") or "Rouane Mounssif"},
        "publisher": publisher,
        "mainEntityOfPage": {"@type": "WebPage", "@id": canonical},
        "image": [image] if image else None,
        "keywords": ", ".join(map(str, article.get("tags") or [])) or None,
    }
    common = {k: v for k, v in common.items() if v not in (None, "", [])}

    if str(article.get("articleFormat") or "").lower() == "review":
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

        review: dict[str, Any] = {
            **common,
            "@type": "Review",
            "reviewBody": meta.get("verdict") or article.get("description") or "",
            "itemReviewed": game,
        }
        if score is not None:
            review["reviewRating"] = {
                "@type": "Rating",
                "ratingValue": score,
                "bestRating": 10,
                "worstRating": 0,
            }
        pros = meta.get("pros") if isinstance(meta.get("pros"), list) else []
        cons = meta.get("cons") if isinstance(meta.get("cons"), list) else []
        if pros:
            review["positiveNotes"] = {
                "@type": "ItemList",
                "itemListElement": [
                    {"@type": "ListItem", "position": i + 1, "name": str(value)}
                    for i, value in enumerate(pros)
                ],
            }
        if cons:
            review["negativeNotes"] = {
                "@type": "ItemList",
                "itemListElement": [
                    {"@type": "ListItem", "position": i + 1, "name": str(value)}
                    for i, value in enumerate(cons)
                ],
            }
        return review

    return {
        **common,
        "@type": "NewsArticle" if str(article.get("category") or "").upper() == "NEWS" else "Article",
        "articleSection": article.get("category") or None,
    }


def meta_markup(article: dict[str, Any]) -> str:
    canonical = route_url(article)
    title = f"{article['title']} · Neural Critic"
    description = article.get("description") or "Independent gaming editorial from Neural Critic."
    image = social_image(article)
    tags = "".join(
        f'<meta property="article:tag" content="{html.escape(str(tag), quote=True)}">'
        for tag in article.get("tags", [])
    )
    image_meta = ""
    preload = ""
    if image:
        image_meta = (
            f'<meta property="og:image" content="{html.escape(image, quote=True)}">'
            f'<meta property="og:image:alt" content="{html.escape(article.get("imageAlt") or article["title"], quote=True)}">'
            f'<meta name="twitter:card" content="summary_large_image">'
            f'<meta name="twitter:image" content="{html.escape(image, quote=True)}">'
        )
        preload = f'<link rel="preload" as="image" href="{html.escape(image, quote=True)}">'
    else:
        image_meta = '<meta name="twitter:card" content="summary">'

    schema = json.dumps(schema_for(article, canonical, image), ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    published = article.get("publishedAt") or ""
    return (
        f'<meta name="description" content="{html.escape(description, quote=True)}">'
        '<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">'
        f'<link rel="canonical" href="{html.escape(canonical, quote=True)}">'
        '<meta property="og:site_name" content="Neural Critic">'
        '<meta property="og:type" content="article">'
        f'<meta property="og:title" content="{html.escape(title, quote=True)}">'
        f'<meta property="og:description" content="{html.escape(description, quote=True)}">'
        f'<meta property="og:url" content="{html.escape(canonical, quote=True)}">'
        f'{image_meta}'
        f'<meta name="twitter:title" content="{html.escape(title, quote=True)}">'
        f'<meta name="twitter:description" content="{html.escape(description, quote=True)}">'
        f'<meta property="article:published_time" content="{html.escape(str(published), quote=True)}">'
        f'<meta property="article:section" content="{html.escape(str(article.get("category") or ""), quote=True)}">'
        f'<meta property="article:author" content="{html.escape(str(article.get("author") or "Rouane Mounssif"), quote=True)}">'
        f'{tags}{preload}'
        f'<script type="application/ld+json" id="nc-structured-data">{schema}</script>'
    )


def compatibility_script(slug: str) -> str:
    safe_slug = json.dumps(slug)
    return f"""<script>
window.NEURAL_CRITIC_STATIC_SLUG={safe_slug};
(()=>{{
  const Native=window.URLSearchParams;
  if(Native.__neuralCriticCompat)return;
  class NeuralCriticParams extends Native{{
    constructor(init){{
      super(init);
      const fromLocation=init===location.search||init==null||init==='';
      if(fromLocation&&!this.has('slug')&&window.NEURAL_CRITIC_STATIC_SLUG)this.set('slug',window.NEURAL_CRITIC_STATIC_SLUG);
    }}
  }}
  NeuralCriticParams.__neuralCriticCompat=true;
  window.URLSearchParams=NeuralCriticParams;
}})();
</script>"""


def fallback_markup(article: dict[str, Any], image: str) -> str:
    image_markup = ""
    if image:
        image_markup = f'<img class="article-hero" src="{html.escape(image, quote=True)}" alt="{html.escape(article.get("imageAlt") or article["title"], quote=True)}">'
    body = article.get("body") or ""
    intro = ""
    if body:
        first = re.split(r"\n\s*\n", body.strip(), maxsplit=1)[0]
        if first:
            intro = f'<p>{html.escape(first)}</p>'
    return (
        '<article class="seo-article-fallback">'
        f'<small class="article-kicker">{html.escape(str(article.get("category") or "STORY"))}</small>'
        f'<h1>{html.escape(article["title"])}</h1>'
        f'<p class="article-deck">{html.escape(article.get("description") or "")}</p>'
        f'{image_markup}<div class="article-body">{intro}</div>'
        '</article>'
    )


def generated_html(template: str, article: dict[str, Any]) -> str:
    title = f"{article['title']} · Neural Critic"
    image = social_image(article)
    result = template
    result = result.replace(
        '<html lang="en" data-theme="dark">',
        f'<html lang="en" data-theme="dark" data-generated-article="1" data-article-slug="{html.escape(article["slug"], quote=True)}">',
        1,
    )
    result = result.replace(
        '<meta name="viewport" content="width=device-width,initial-scale=1">',
        '<meta name="viewport" content="width=device-width,initial-scale=1"><base href="../../">',
        1,
    )
    result = re.sub(r"<title>.*?</title>", f"<title>{html.escape(title)}</title>{meta_markup(article)}", result, count=1, flags=re.S)
    result = result.replace('</head>', f'{compatibility_script(article["slug"])}</head>', 1)
    result = result.replace(
        '<main class="article-page" id="article"></main>',
        f'<main class="article-page" id="article">{fallback_markup(article, image)}</main>',
        1,
    )
    return GENERATED_MARKER + "\n" + result


def read_manifest() -> list[str]:
    if not MANIFEST_PATH.exists():
        return []
    try:
        payload = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
        return payload.get("files", []) if isinstance(payload, dict) else []
    except Exception:
        return []


def cleanup_previous() -> None:
    for relative in read_manifest():
        path = ROOT / relative
        try:
            if path.is_file() and GENERATED_MARKER in path.read_text(encoding="utf-8", errors="ignore")[:200]:
                path.unlink()
                parent = path.parent
                while parent != ROOT and parent.name not in ROUTE_SECTIONS:
                    try:
                        parent.rmdir()
                    except OSError:
                        break
                    parent = parent.parent
        except OSError:
            pass


def write_sitemap(articles: list[dict[str, Any]]) -> None:
    urls: list[tuple[str, str | None]] = [
        (SITE_URL, None),
        (urllib.parse.urljoin(SITE_URL, "about.html"), None),
        (urllib.parse.urljoin(SITE_URL, "category.html?category=news"), None),
        (urllib.parse.urljoin(SITE_URL, "category.html?category=features"), None),
        (urllib.parse.urljoin(SITE_URL, "category.html?category=guides"), None),
        (urllib.parse.urljoin(SITE_URL, "category.html?category=reviews"), None),
        (urllib.parse.urljoin(SITE_URL, "category.html?section=what-to-play"), None),
    ]
    for article in articles:
        urls.append((route_url(article), str(article.get("publishedAt") or "") or None))

    body = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for loc, lastmod in urls:
        body.append('  <url>')
        body.append(f'    <loc>{html.escape(loc)}</loc>')
        if lastmod:
            body.append(f'    <lastmod>{html.escape(lastmod)}</lastmod>')
        body.append('  </url>')
    body.append('</urlset>')
    (ROOT / "sitemap.xml").write_text("\n".join(body) + "\n", encoding="utf-8")

    robots = (
        "User-agent: *\n"
        "Allow: /\n"
        "Disallow: /studio.html\n"
        "Disallow: /subscribers.html\n\n"
        f"Sitemap: {urllib.parse.urljoin(SITE_URL, 'sitemap.xml')}\n"
    )
    (ROOT / "robots.txt").write_text(robots, encoding="utf-8")


def main() -> int:
    template = TEMPLATE_PATH.read_text(encoding="utf-8")
    articles, source = load_articles()
    articles = [article for article in articles if valid_slug(article.get("slug", ""))]
    if not articles:
        print("No publishable article routes were found.", file=sys.stderr)
        return 1

    cleanup_previous()
    generated: list[str] = []
    for article in articles:
        path = ROOT / section_for(article) / article["slug"] / "index.html"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(generated_html(template, article), encoding="utf-8")
        generated.append(path.relative_to(ROOT).as_posix())

    write_sitemap(articles)
    manifest = {
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "source": source,
        "siteUrl": SITE_URL,
        "files": generated,
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Generated {len(generated)} Neural Critic article routes from {source}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
