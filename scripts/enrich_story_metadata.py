#!/usr/bin/env python3
"""Enrich generated Neural Critic story JSON-LD with canonical writer URLs.

Google recommends author URLs on Article structured data when a canonical writer
profile exists. This post-processing step keeps the story builder focused on CMS
metadata while connecting its Person author node to the canonical author hub.
"""

from __future__ import annotations

import json
import re
import urllib.parse
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
AUTHORS_INDEX = ROOT / "data" / "authors.json"
STORIES_DIR = ROOT / "stories"
SITE_URL = "https://rouane12.github.io/NeuralCritic/"
GENERATED_MARKER = "<!-- generated: neural-critic-story-shell -->"
STRUCTURED_DATA_RE = re.compile(
    r'(<script\s+id="nc-structured-data"\s+type="application/ld\+json">)(.*?)(</script>)',
    re.DOTALL,
)


def normalize_name(value: object) -> str:
    return " ".join(str(value or "").strip().lower().split())


def author_url(slug: str) -> str:
    return urllib.parse.urljoin(
        SITE_URL,
        f"authors/{urllib.parse.quote(slug, safe='-')}/",
    )


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
        if not name or not slug:
            continue
        result[normalize_name(name)] = author_url(slug)
    return result


def compact_json(value: dict[str, Any]) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")


def enrich_story(path: Path, authors: dict[str, str]) -> bool:
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

    author = schema.get("author")
    if not isinstance(author, dict):
        return False
    name = normalize_name(author.get("name"))
    canonical = authors.get(name)
    if not canonical or author.get("url") == canonical:
        return False

    author["url"] = canonical
    replacement = f"{match.group(1)}{compact_json(schema)}{match.group(3)}"
    output = text[: match.start()] + replacement + text[match.end() :]
    path.write_text(output, encoding="utf-8")
    return True


def main() -> int:
    authors = load_author_urls()
    changed = 0
    scanned = 0
    if STORIES_DIR.exists() and authors:
        for path in STORIES_DIR.glob("*/index.html"):
            scanned += 1
            if enrich_story(path, authors):
                changed += 1
    print(f"Enriched {changed} of {scanned} generated story shells with canonical author URLs.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
