#!/usr/bin/env python3
"""Generate canonical Neural Critic writer profile pages from the author directory and published CMS stories."""

from __future__ import annotations

import html
import json
import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "assets" / "supabase-config.js"
AUTHOR_TEMPLATE = ROOT / "author.html"
AUTHORS_INDEX = ROOT / "data" / "authors.json"
AUTHORS_DIR = ROOT / "authors"
SITEMAP_PATH = ROOT / "sitemap.xml"
SITE_URL = "https://rouane12.github.io/NeuralCritic/"
GENERATED_MARKER = "<!-- generated: neural-critic-author-hub -->"
MEDIA_MARKER = "/media/editorial/"


def read_supabase_config() -> tuple[str, str]:
    text = CONFIG_PATH.read_text(encoding="utf-8")
    url_match = re.search(r"url:\s*['\"]([^'\"]+)['\"]", text)
    key_match = re.search(r"publishableKey:\s*['\"]([^'\"]+)['\"]", text)
    if not url_match or not key_match:
        raise RuntimeError("Could not read Supabase public configuration.")
    return url_match.group(1).rstrip("/"), key_match.group(1)


def slugify(value: object) -> str:
    raw = str(value or "").strip().lower()
    raw = re.sub(r"[^a-z0-9]+", "-", raw)
    return raw.strip("-")


def author_url(slug: str) -> str:
    return urllib.parse.urljoin(SITE_URL, f"authors/{urllib.parse.quote(slug, safe='-')}/")


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


def load_profiles() -> list[dict[str, Any]]:
    payload = json.loads(AUTHORS_INDEX.read_text(encoding="utf-8"))
    if not isinstance(payload, list):
        return []
    profiles = []
    for item in payload:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or "").strip()
        slug = str(item.get("slug") or slugify(name)).strip()
        if not name or not slug:
            continue
        profiles.append({**item, "name": name, "slug": slug})
    return profiles


def fetch_published() -> list[dict[str, Any]]:
    supabase_url, key = read_supabase_config()
    query = urllib.parse.urlencode(
        {
            "select": "slug,title,description,category,author_name,image_url,image_alt,article_format,review_meta,published_at,updated_at",
            "status": "eq.published",
            "published_at": "lte.now()",
            "order": "published_at.desc",
            "limit": "250",
        },
        safe=".*,:()+-",
    )
    request = urllib.request.Request(
        f"{supabase_url}/rest/v1/articles?{query}",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Accept": "application/json",
            "User-Agent": "NeuralCritic-AuthorBuilder/1.0",
        },
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        payload = json.loads(response.read().decode("utf-8"))
    if not isinstance(payload, list):
        raise RuntimeError("Supabase article response was not a list.")
    return [row for row in payload if isinstance(row, dict)]


def author_stories(rows: list[dict[str, Any]], name: str) -> list[dict[str, Any]]:
    target = " ".join(name.lower().split())
    matched = []
    for row in rows:
        author = str(row.get("author_name") or "Rouane Mounssif").strip()
        if " ".join(author.lower().split()) == target:
            matched.append(row)
    return matched


def profile_schema(profile: dict[str, Any], stories: list[dict[str, Any]], canonical: str) -> dict[str, Any]:
    avatar = stable_image(profile.get("avatar"))
    person = {
        "@type": "Person",
        "name": profile["name"],
        "url": canonical,
        "image": avatar or None,
        "jobTitle": profile.get("role") or "Writer & Editor",
        "description": profile.get("bio") or profile.get("shortBio") or None,
        "worksFor": {"@type": "Organization", "name": "Neural Critic", "url": SITE_URL},
    }
    return {
        "@context": "https://schema.org",
        "@type": "ProfilePage",
        "name": f"{profile['name']} · Neural Critic",
        "url": canonical,
        "description": profile.get("shortBio") or profile.get("bio") or f"{profile['name']} writes for Neural Critic.",
        "mainEntity": {key: value for key, value in person.items() if value not in (None, "")},
        "hasPart": [
            {"@type": "CreativeWork", "name": str(row.get("title") or ""), "url": story_url(str(row.get("slug") or ""))}
            for row in stories[:12]
            if row.get("slug") and row.get("title")
        ],
    }


def metadata_markup(profile: dict[str, Any], stories: list[dict[str, Any]]) -> str:
    canonical = author_url(profile["slug"])
    title = f"{profile['name']} · Neural Critic"
    description = str(profile.get("shortBio") or profile.get("bio") or f"{profile['name']} writes for Neural Critic.")
    avatar = stable_image(profile.get("avatar"))
    esc = lambda value: html.escape(str(value), quote=True)
    context = {
        "slug": profile["slug"],
        "name": profile["name"],
        "canonical": canonical,
    }
    parts = [
        GENERATED_MARKER,
        '<base href="/NeuralCritic/">',
        f'<meta name="description" content="{esc(description)}">',
        '<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1">',
        '<meta property="og:site_name" content="Neural Critic">',
        '<meta property="og:type" content="profile">',
        f'<meta property="og:title" content="{esc(title)}">',
        f'<meta property="og:description" content="{esc(description)}">',
        f'<meta property="og:url" content="{esc(canonical)}">',
        f'<link rel="canonical" href="{esc(canonical)}">',
        '<meta name="twitter:card" content="summary">',
        f'<meta name="twitter:title" content="{esc(title)}">',
        f'<meta name="twitter:description" content="{esc(description)}">',
    ]
    if avatar:
        parts.extend(
            [
                f'<meta property="og:image" content="{esc(avatar)}">',
                f'<meta property="og:image:alt" content="{esc(profile["name"])}">',
                f'<meta name="twitter:image" content="{esc(avatar)}">',
                f'<meta name="twitter:image:alt" content="{esc(profile["name"])}">',
            ]
        )
    schema = json.dumps(profile_schema(profile, stories, canonical), ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    parts.append(f'<script id="nc-author-structured-data" type="application/ld+json">{schema}</script>')
    parts.append(
        '<script>'
        'window.NEURAL_CRITIC_STATIC_META=true;'
        f'window.NEURAL_CRITIC_STATIC_AUTHOR={json.dumps(context, ensure_ascii=False)};'
        '</script>'
    )
    return "".join(parts)


def render_author(template: str, profile: dict[str, Any], stories: list[dict[str, Any]]) -> str:
    output = template.replace("<head>", f"<head>{metadata_markup(profile, stories)}", 1)
    output = output.replace("<title>Writer · Neural Critic</title>", f"<title>{html.escape(profile['name'])} · Neural Critic</title>", 1)
    return output


def write_author_pages(profiles: list[dict[str, Any]], rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    template = AUTHOR_TEMPLATE.read_text(encoding="utf-8")
    AUTHORS_DIR.mkdir(parents=True, exist_ok=True)
    active: set[str] = set()
    published_profiles: list[dict[str, Any]] = []

    for profile in profiles:
        stories = author_stories(rows, profile["name"])
        if not stories:
            continue
        active.add(profile["slug"])
        latest = max((str(row.get("updated_at") or row.get("published_at") or "") for row in stories), default="")
        published_profiles.append({**profile, "lastmod": latest})
        directory = AUTHORS_DIR / profile["slug"]
        directory.mkdir(parents=True, exist_ok=True)
        (directory / "index.html").write_text(render_author(template, profile, stories), encoding="utf-8")

    for page in AUTHORS_DIR.glob("*/index.html"):
        slug = page.parent.name
        if slug in active:
            continue
        try:
            sample = page.read_text(encoding="utf-8", errors="ignore")[:1200]
        except Exception:
            continue
        if GENERATED_MARKER not in sample:
            continue
        page.unlink()
        try:
            page.parent.rmdir()
        except OSError:
            pass

    return published_profiles


def sync_sitemap(profiles: list[dict[str, Any]]) -> None:
    if not SITEMAP_PATH.exists():
        return
    ET.register_namespace("", "http://www.sitemaps.org/schemas/sitemap/0.9")
    tree = ET.parse(SITEMAP_PATH)
    root = tree.getroot()
    namespace = "{http://www.sitemaps.org/schemas/sitemap/0.9}"
    for node in list(root):
        loc = node.find(f"{namespace}loc")
        value = (loc.text or "").strip() if loc is not None else ""
        if "/authors/" in urllib.parse.urlparse(value).path:
            root.remove(node)
    for profile in profiles:
        node = ET.SubElement(root, f"{namespace}url")
        ET.SubElement(node, f"{namespace}loc").text = author_url(profile["slug"])
        if profile.get("lastmod"):
            ET.SubElement(node, f"{namespace}lastmod").text = str(profile["lastmod"])
    ET.indent(tree, space="  ")
    tree.write(SITEMAP_PATH, encoding="utf-8", xml_declaration=True)


def main() -> int:
    profiles = load_profiles()
    rows = fetch_published()
    published_profiles = write_author_pages(profiles, rows)
    sync_sitemap(published_profiles)
    print(f"Generated {len(published_profiles)} canonical Neural Critic writer hubs from {len(rows)} published stories.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
