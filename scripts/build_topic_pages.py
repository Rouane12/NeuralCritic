#!/usr/bin/env python3
"""Generate canonical Neural Critic Game Graph topic hubs from published CMS identity metadata."""

from __future__ import annotations

import html
import json
import re
import shutil
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "assets" / "supabase-config.js"
TOPIC_TEMPLATE = ROOT / "topic.html"
TOPICS_DIR = ROOT / "topics"
SITEMAP_PATH = ROOT / "sitemap.xml"
SITE_URL = "https://rouane12.github.io/NeuralCritic/"
GENERATED_MARKER = "<!-- generated: neural-critic-topic-hub -->"
MEDIA_MARKER = "/media/editorial/"
TOPIC_TYPES = ("game", "series", "franchise")


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


def stable_image(value: object) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    if MEDIA_MARKER in raw:
        filename = raw.split(MEDIA_MARKER, 1)[1].split("?", 1)[0].split("#", 1)[0]
        if filename:
            return urllib.parse.urljoin(SITE_URL, f"images/editorial/{urllib.parse.quote(urllib.parse.unquote(filename), safe='-._~')}")
    return urllib.parse.urljoin(SITE_URL, raw)


def topic_url(topic_type: str, name: str) -> str:
    return urllib.parse.urljoin(SITE_URL, f"topics/{topic_type}/{urllib.parse.quote(slugify(name), safe='-')}/")


def fetch_published() -> list[dict[str, Any]]:
    supabase_url, key = read_supabase_config()
    query = urllib.parse.urlencode(
        {
            "select": "slug,title,description,category,image_url,image_alt,article_format,review_meta,content_blocks,published_at,updated_at,game_key,series,franchise",
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
            "User-Agent": "NeuralCritic-TopicBuilder/1.0",
        },
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        payload = json.loads(response.read().decode("utf-8"))
    if not isinstance(payload, list):
        raise RuntimeError("Supabase article response was not a list.")
    return [row for row in payload if isinstance(row, dict)]


def topic_records(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    records: dict[tuple[str, str], dict[str, Any]] = {}
    field_map = {"game": "game_key", "series": "series", "franchise": "franchise"}
    for row in rows:
        for topic_type, field in field_map.items():
            name = str(row.get(field) or "").strip()
            slug = slugify(name)
            if not name or not slug:
                continue
            key = (topic_type, slug)
            current = records.setdefault(
                key,
                {
                    "type": topic_type,
                    "slug": slug,
                    "name": name,
                    "image": "",
                    "image_alt": "",
                    "lastmod": "",
                    "stories": [],
                },
            )
            current["stories"].append(row)
            if not current["image"] and row.get("image_url"):
                current["image"] = stable_image(row.get("image_url"))
                current["image_alt"] = str(row.get("image_alt") or row.get("title") or name)
            candidate = str(row.get("updated_at") or row.get("published_at") or "")
            if candidate > current["lastmod"]:
                current["lastmod"] = candidate
    return sorted(records.values(), key=lambda item: (TOPIC_TYPES.index(item["type"]), item["name"].lower()))


def collection_schema(record: dict[str, Any], canonical: str) -> dict[str, Any]:
    return {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": f"{record['name']} · Neural Critic",
        "description": f"Reviews, features, rankings, and news connected to {record['name']} through Neural Critic's Game Graph.",
        "url": canonical,
        "about": {"@type": "Thing", "name": record["name"]},
        "isPartOf": {"@type": "WebSite", "name": "Neural Critic", "url": SITE_URL},
        "hasPart": [
            {
                "@type": "CreativeWork",
                "name": str(row.get("title") or ""),
                "url": urllib.parse.urljoin(SITE_URL, f"stories/{urllib.parse.quote(str(row.get('slug') or ''), safe='-._~')}/"),
            }
            for row in record["stories"][:12]
            if row.get("slug") and row.get("title")
        ],
    }


def metadata_markup(record: dict[str, Any]) -> str:
    canonical = topic_url(record["type"], record["name"])
    title = f"{record['name']} · Neural Critic"
    description = f"{record['name']} reviews, features, rankings, and news connected through Neural Critic's Game Graph."
    image = record.get("image") or ""
    image_alt = record.get("image_alt") or record["name"]
    esc = lambda value: html.escape(str(value), quote=True)
    context = {
        "type": record["type"],
        "slug": record["slug"],
        "name": record["name"],
        "canonical": canonical,
    }
    parts = [
        GENERATED_MARKER,
        '<base href="/NeuralCritic/">',
        f'<meta name="description" content="{esc(description)}">',
        '<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1">',
        '<meta property="og:site_name" content="Neural Critic">',
        '<meta property="og:type" content="website">',
        f'<meta property="og:title" content="{esc(title)}">',
        f'<meta property="og:description" content="{esc(description)}">',
        f'<meta property="og:url" content="{esc(canonical)}">',
        f'<link rel="canonical" href="{esc(canonical)}">',
        '<meta name="twitter:card" content="summary_large_image">' if image else '<meta name="twitter:card" content="summary">',
        f'<meta name="twitter:title" content="{esc(title)}">',
        f'<meta name="twitter:description" content="{esc(description)}">',
    ]
    if image:
        parts.extend(
            [
                f'<meta property="og:image" content="{esc(image)}">',
                f'<meta property="og:image:alt" content="{esc(image_alt)}">',
                f'<meta name="twitter:image" content="{esc(image)}">',
                f'<meta name="twitter:image:alt" content="{esc(image_alt)}">',
            ]
        )
    parts.append(f'<script id="nc-topic-structured-data" type="application/ld+json">{json.dumps(collection_schema(record, canonical), ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")}</script>')
    parts.append(
        '<script>'
        'window.NEURAL_CRITIC_STATIC_META=true;'
        f'window.NEURAL_CRITIC_STATIC_TOPIC={json.dumps(context, ensure_ascii=False)};'
        '</script>'
    )
    return "".join(parts)


def render_topic(template: str, record: dict[str, Any]) -> str:
    output = template.replace("<head>", f"<head>{metadata_markup(record)}", 1)
    output = output.replace("<title>Topic · Neural Critic</title>", f"<title>{html.escape(record['name'])} · Neural Critic</title>", 1)
    return output


def write_topic_pages(records: list[dict[str, Any]]) -> set[tuple[str, str]]:
    template = TOPIC_TEMPLATE.read_text(encoding="utf-8")
    TOPICS_DIR.mkdir(parents=True, exist_ok=True)
    active: set[tuple[str, str]] = set()
    for record in records:
        key = (record["type"], record["slug"])
        active.add(key)
        directory = TOPICS_DIR / record["type"] / record["slug"]
        directory.mkdir(parents=True, exist_ok=True)
        (directory / "index.html").write_text(render_topic(template, record), encoding="utf-8")

    for page in TOPICS_DIR.glob("*/*/index.html"):
        key = (page.parent.parent.name, page.parent.name)
        if key in active:
            continue
        try:
            sample = page.read_text(encoding="utf-8", errors="ignore")[:1000]
        except Exception:
            continue
        if GENERATED_MARKER not in sample:
            continue
        page.unlink()
        for directory in (page.parent, page.parent.parent):
            try:
                directory.rmdir()
            except OSError:
                pass
    return active


def sync_sitemap(records: list[dict[str, Any]]) -> None:
    if not SITEMAP_PATH.exists():
        return
    ET.register_namespace("", "http://www.sitemaps.org/schemas/sitemap/0.9")
    tree = ET.parse(SITEMAP_PATH)
    root = tree.getroot()
    namespace = "{http://www.sitemaps.org/schemas/sitemap/0.9}"
    for node in list(root):
        loc = node.find(f"{namespace}loc")
        value = (loc.text or "").strip() if loc is not None else ""
        if "/topics/" in urllib.parse.urlparse(value).path:
            root.remove(node)
    for record in records:
        node = ET.SubElement(root, f"{namespace}url")
        ET.SubElement(node, f"{namespace}loc").text = topic_url(record["type"], record["name"])
        if record.get("lastmod"):
            ET.SubElement(node, f"{namespace}lastmod").text = str(record["lastmod"])
    ET.indent(tree, space="  ")
    tree.write(SITEMAP_PATH, encoding="utf-8", xml_declaration=True)


def main() -> int:
    rows = fetch_published()
    records = topic_records(rows)
    active = write_topic_pages(records)
    sync_sitemap(records)
    print(f"Generated {len(active)} canonical Game Graph topic hubs from {len(rows)} published stories.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
