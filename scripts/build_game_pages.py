#!/usr/bin/env python3
"""Build crawler-visible Neural Critic game database shells from Supabase."""

from __future__ import annotations

import html
import json
import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any

from publication_config import BASE_PATH, SITE_URL

ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "assets" / "supabase-config.js"
GAME_TEMPLATE = ROOT / "game.html"
GAMES_DIR = ROOT / "games"
SITEMAP_PATH = ROOT / "sitemap.xml"
GENERATED_MARKER = "<!-- generated: neural-critic-game-shell -->"


def read_supabase_config() -> tuple[str, str]:
    text = CONFIG_PATH.read_text(encoding="utf-8")
    url_match = re.search(r"url:\s*['\"]([^'\"]+)['\"]", text)
    key_match = re.search(r"publishableKey:\s*['\"]([^'\"]+)['\"]", text)
    if not url_match or not key_match:
        raise RuntimeError("Could not read Supabase public configuration.")
    return url_match.group(1).rstrip("/"), key_match.group(1)


def valid_slug(slug: str) -> bool:
    return bool(re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]*", slug))


def game_url(slug: str) -> str:
    return urllib.parse.urljoin(SITE_URL, f"games/{urllib.parse.quote(slug, safe='-._~')}/")


def stable_image(value: object) -> str:
    raw = str(value or "").strip()
    return urllib.parse.urljoin(SITE_URL, raw) if raw else ""


def fetch_games() -> list[dict[str, Any]]:
    supabase_url, key = read_supabase_config()
    query = urllib.parse.urlencode(
        {
            "select": "slug,title,summary,release_status,primary_release_date,developer,publisher,franchise,series,genres,platforms,cover_image_url,cover_image_alt,official_url,neural_critic_score,score_article_slug,updated_at",
            "order": "sort_title.asc.nullslast,title.asc",
            "limit": "500",
        },
        safe=".*,:()+-",
    )
    request = urllib.request.Request(
        f"{supabase_url}/rest/v1/games?{query}",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Accept": "application/json",
            "User-Agent": "NeuralCritic-GameBuilder/1.0",
        },
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        payload = json.loads(response.read().decode("utf-8"))
    if not isinstance(payload, list):
        raise RuntimeError("Supabase games response was not a list.")
    return [row for row in payload if isinstance(row, dict)]


def compact(value: Any) -> Any:
    if isinstance(value, dict):
        return {k: compact(v) for k, v in value.items() if v not in (None, "", [], {})}
    if isinstance(value, list):
        return [compact(v) for v in value if v not in (None, "", [], {})]
    return value


def game_schema(game: dict[str, Any], canonical: str, image: str) -> dict[str, Any]:
    schema: dict[str, Any] = {
        "@context": "https://schema.org",
        "@type": "VideoGame",
        "name": game.get("title"),
        "description": game.get("summary"),
        "url": canonical,
        "image": image or None,
        "datePublished": game.get("primary_release_date"),
        "genre": game.get("genres") or None,
        "gamePlatform": game.get("platforms") or None,
        "author": {"@type": "Organization", "name": game.get("developer")} if game.get("developer") else None,
        "publisher": {"@type": "Organization", "name": game.get("publisher")} if game.get("publisher") else None,
        "sameAs": game.get("official_url") or None,
        "mainEntityOfPage": {"@type": "WebPage", "@id": canonical},
    }
    return compact(schema)


def breadcrumb_schema(game: dict[str, Any], canonical: str) -> dict[str, Any]:
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Neural Critic", "item": SITE_URL},
            {"@type": "ListItem", "position": 2, "name": "Games", "item": urllib.parse.urljoin(SITE_URL, "games/")},
            {"@type": "ListItem", "position": 3, "name": game.get("title"), "item": canonical},
        ],
    }


def json_script(value: dict[str, Any]) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")


def metadata_markup(game: dict[str, Any]) -> str:
    slug = str(game["slug"])
    canonical = game_url(slug)
    title = str(game.get("title") or "Game")
    page_title = f"{title} | Neural Critic Game Database"
    description = str(game.get("summary") or f"{title} release information, platforms and connected Neural Critic coverage.")
    image = stable_image(game.get("cover_image_url"))
    image_alt = str(game.get("cover_image_alt") or f"{title} cover art")
    esc = lambda value: html.escape(str(value), quote=True)
    parts = [
        GENERATED_MARKER,
        f'<base href="{esc(BASE_PATH)}">',
        f'<meta name="description" content="{esc(description)}">',
        '<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">',
        '<meta property="og:site_name" content="Neural Critic">',
        '<meta property="og:type" content="website">',
        f'<meta property="og:title" content="{esc(page_title)}">',
        f'<meta property="og:description" content="{esc(description)}">',
        f'<meta property="og:url" content="{esc(canonical)}">',
        f'<link rel="canonical" href="{esc(canonical)}">',
        '<meta name="twitter:card" content="summary_large_image">' if image else '<meta name="twitter:card" content="summary">',
        f'<meta name="twitter:title" content="{esc(page_title)}">',
        f'<meta name="twitter:description" content="{esc(description)}">',
    ]
    if image:
        parts.extend([
            f'<meta property="og:image" content="{esc(image)}">',
            f'<meta property="og:image:alt" content="{esc(image_alt)}">',
            f'<meta name="twitter:image" content="{esc(image)}">',
            f'<meta name="twitter:image:alt" content="{esc(image_alt)}">',
        ])
    parts.append(f'<script id="nc-game-structured-data" type="application/ld+json">{json_script(game_schema(game, canonical, image))}</script>')
    parts.append(f'<script id="nc-game-breadcrumb-data" type="application/ld+json">{json_script(breadcrumb_schema(game, canonical))}</script>')
    parts.append(f'<script>window.NEURAL_CRITIC_STATIC_GAME_SLUG={json.dumps(slug)};</script>')
    return "".join(parts)


def render_game(template: str, game: dict[str, Any]) -> str:
    title = html.escape(f"{game.get('title') or 'Game'} | Neural Critic Game Database", quote=False)
    summary = html.escape(str(game.get("summary") or "Neural Critic game intelligence."), quote=False)
    output = re.sub(
        r'<meta name="description" content="Game information, release details and connected Neural Critic coverage\.">',
        "",
        template,
        count=1,
    )
    output = output.replace("<head>", f"<head>{metadata_markup(game)}", 1)
    output = output.replace("<title>Game · Neural Critic</title>", f"<title>{title}</title>", 1)
    output = output.replace("<h1 id=\"game-title\">Loading game…</h1>", f'<h1 id="game-title">{html.escape(str(game.get("title") or "Game"))}</h1>', 1)
    output = output.replace("<p id=\"game-summary\">Loading Neural Critic game intelligence.</p>", f'<p id="game-summary">{summary}</p>', 1)
    return output


def write_game_pages(rows: list[dict[str, Any]]) -> set[str]:
    template = GAME_TEMPLATE.read_text(encoding="utf-8")
    GAMES_DIR.mkdir(parents=True, exist_ok=True)
    active: set[str] = set()
    for game in rows:
        slug = str(game.get("slug") or "").strip()
        title = str(game.get("title") or "").strip()
        if not valid_slug(slug) or not title or slug in active:
            continue
        active.add(slug)
        directory = GAMES_DIR / slug
        directory.mkdir(parents=True, exist_ok=True)
        (directory / "index.html").write_text(render_game(template, game), encoding="utf-8")

    for page in GAMES_DIR.glob("*/index.html"):
        if page.parent.name in active:
            continue
        sample = page.read_text(encoding="utf-8", errors="ignore")[:1200]
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
    namespace = "{http://www.sitemaps.org/schemas/sitemap/0.9)}"
    games_root = urllib.parse.urljoin(SITE_URL, "games/")
    for node in list(root):
        loc = node.find(f"{namespace}loc")
        value = (loc.text or "").strip() if loc is not None else ""
        path = urllib.parse.urlparse(value).path
        if "/games/" in path and value != games_root:
            root.remove(node)
    if not any((node.find(f"{namespace}loc") is not None and (node.find(f"{namespace}loc").text or "").strip() == games_root) for node in root):
        node = ET.SubElement(root, f"{namespace}url")
        ET.SubElement(node, f"{namespace}loc").text = games_root
    seen: set[str] = set()
    for game in rows:
        slug = str(game.get("slug") or "").strip()
        if not valid_slug(slug) or slug in seen:
            continue
        seen.add(slug)
        node = ET.SubElement(root, f"{namespace}url")
        ET.SubElement(node, f"{namespace}loc").text = game_url(slug)
        updated = str(game.get("updated_at") or "").strip()
        if updated:
            ET.SubElement(node, f"{namespace}lastmod").text = updated
    ET.indent(tree, space="  ")
    tree.write(SITEMAP_PATH, encoding="utf-8", xml_declaration=True)


def main() -> int:
    rows = fetch_games()
    active = write_game_pages(rows)
    sync_sitemap(rows)
    print(f"Built {len(active)} canonical Neural Critic game pages from Supabase metadata.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())