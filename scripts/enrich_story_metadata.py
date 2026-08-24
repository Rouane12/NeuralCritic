#!/usr/bin/env python3
"""Enrich generated Neural Critic story JSON-LD with canonical writer URLs and public commercial metadata."""

from __future__ import annotations

import json
import re
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

from publication_config import SITE_URL

ROOT = Path(__file__).resolve().parents[1]
AUTHORS_INDEX = ROOT / "data" / "authors.json"
CONFIG_PATH = ROOT / "assets" / "supabase-config.js"
STORIES_DIR = ROOT / "stories"
GENERATED_MARKER = "<!-- generated: neural-critic-story-shell -->"
STRUCTURED_DATA_RE = re.compile(
    r'(<script\s+id="nc-structured-data"\s+type="application/ld\+json">)(.*?)(</script>)',
    re.DOTALL,
)


def normalize_name(value: object) -> str:
    return " ".join(str(value or "").strip().lower().split())


def author_url(slug: str) -> str:
    return urllib.parse.urljoin(SITE_URL, f"authors/{urllib.parse.quote(slug, safe='-')}/")


def read_supabase_config() -> tuple[str, str]:
    text = CONFIG_PATH.read_text(encoding="utf-8")
    url_match = re.search(r"url:\s*['\"]([^'\"]+)['\"]", text)
    key_match = re.search(r"publishableKey:\s*['\"]([^'\"]+)['\"]", text)
    if not url_match or not key_match:
        raise RuntimeError("Could not read Supabase public configuration.")
    return url_match.group(1).rstrip("/"), key_match.group(1)


def load_author_urls() -> dict[str, str]:
    if not AUTHORS_INDEX.exists():
        return {}
    payload = json.loads(AUTHORS_INDEX.read_text(encoding="utf-8"))
    if not isinstance(payload, list):
        return {}
    result: dict[str, str] = {}
    for item in payload:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or "").strip()
        slug = str(item.get("slug") or "").strip()
        if name and slug:
            result[normalize_name(name)] = author_url(slug)
    return result


def load_commercial_meta() -> dict[str, dict[str, Any]]:
    try:
        supabase_url, key = read_supabase_config()
        query = urllib.parse.urlencode(
            {
                "select": "slug,commercial_meta",
                "status": "eq.published",
                "published_at": "lte.now()",
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
                "User-Agent": "NeuralCritic-MetadataEnricher/1.0",
            },
        )
        with urllib.request.urlopen(request, timeout=20) as response:
            payload = json.loads(response.read().decode("utf-8"))
        if not isinstance(payload, list):
            return {}
        result: dict[str, dict[str, Any]] = {}
        for row in payload:
            if not isinstance(row, dict):
                continue
            slug = str(row.get("slug") or "").strip()
            meta = row.get("commercial_meta")
            if slug and isinstance(meta, dict):
                result[slug] = meta
        return result
    except Exception as exc:
        print(f"Commercial metadata unavailable ({exc}); continuing without sponsor enrichment.")
        return {}


def compact_json(value: dict[str, Any]) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")


def enrich_story(
    path: Path,
    authors: dict[str, str],
    commercial: dict[str, dict[str, Any]],
) -> bool:
    text = path.read_text(encoding="utf-8")
    if GENERATED_MARKER not in text:
        return False
    match = STRUCTURED_DATA_RE.search(text)
    if not match:
        return False
    try:
        schema = json.loads(match.group(2))
    except json.JSONDecodeError:
        return False
    if not isinstance(schema, dict):
        return False

    changed = False
    author = schema.get("author")
    if isinstance(author, dict):
        canonical = authors.get(normalize_name(author.get("name")))
        if canonical and author.get("url") != canonical:
            author["url"] = canonical
            changed = True

    meta = commercial.get(path.parent.name, {})
    kind = str(meta.get("kind") or "editorial").lower()
    sponsor_name = str(meta.get("sponsor_name") or "").strip()
    if kind == "sponsored" and sponsor_name:
        sponsor = {"@type": "Organization", "name": sponsor_name}
        if schema.get("sponsor") != sponsor:
            schema["sponsor"] = sponsor
            changed = True
    elif "sponsor" in schema:
        schema.pop("sponsor", None)
        changed = True

    if not changed:
        return False
    replacement = f"{match.group(1)}{compact_json(schema)}{match.group(3)}"
    output = text[: match.start()] + replacement + text[match.end() :]
    path.write_text(output, encoding="utf-8")
    return True


def main() -> int:
    authors = load_author_urls()
    commercial = load_commercial_meta()
    changed = 0
    scanned = 0
    if STORIES_DIR.exists():
        for path in STORIES_DIR.glob("*/index.html"):
            scanned += 1
            if enrich_story(path, authors, commercial):
                changed += 1
    print(f"Enriched {changed} of {scanned} generated story shells with canonical author and commercial metadata.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())