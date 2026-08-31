#!/usr/bin/env python3
"""Fail if Neural Critic's browser runtime can drift from generated publication state."""
from __future__ import annotations

import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "data" / "articles.json"
DETAILS = ROOT / "data" / "articles"
STORIES = ROOT / "stories"
SITEMAP = ROOT / "sitemap.xml"
APP = ROOT / "assets" / "app.js"
BUILD_WORKFLOW = ROOT / ".github" / "workflows" / "build-publication.yml"


def fail(message: str) -> None:
    raise SystemExit(f"RUNTIME CONSISTENCY FAILED: {message}")


def load_index() -> list[dict]:
    if not INDEX.exists():
        fail("data/articles.json is missing")
    try:
        payload = json.loads(INDEX.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        fail(f"data/articles.json is invalid JSON: {exc}")
    if not isinstance(payload, list) or not payload:
        fail("data/articles.json must contain at least one published story")
    rows = [row for row in payload if isinstance(row, dict)]
    if len(rows) != len(payload):
        fail("data/articles.json contains a non-object entry")
    return rows


def sitemap_story_slugs() -> set[str]:
    if not SITEMAP.exists():
        fail("sitemap.xml is missing")
    try:
        tree = ET.parse(SITEMAP)
    except ET.ParseError as exc:
        fail(f"sitemap.xml is malformed: {exc}")
    ns = "{http://www.sitemaps.org/schemas/sitemap/0.9}"
    slugs: set[str] = set()
    pattern = re.compile(r"^https://www\.neuralcritic\.net/stories/([^/]+)/$")
    for node in tree.findall(f".//{ns}loc"):
        value = (node.text or "").strip()
        match = pattern.match(value)
        if match:
            slugs.add(match.group(1))
    return slugs


def main() -> int:
    rows = load_index()
    slugs = [str(row.get("slug") or "").strip() for row in rows]
    if any(not slug for slug in slugs):
        fail("runtime fallback contains an empty slug")
    if len(slugs) != len(set(slugs)):
        fail("runtime fallback contains duplicate slugs")

    fallback_slugs = set(slugs)
    sitemap_slugs = sitemap_story_slugs()
    if fallback_slugs != sitemap_slugs:
        missing = sorted(sitemap_slugs - fallback_slugs)
        extra = sorted(fallback_slugs - sitemap_slugs)
        fail(f"fallback/sitemap story sets differ; missing={missing[:8]} extra={extra[:8]}")

    for row in rows:
        slug = str(row["slug"])
        detail = DETAILS / f"{slug}.json"
        shell = STORIES / slug / "index.html"
        if not detail.exists():
            fail(f"{slug}: per-story runtime fallback is missing")
        if not shell.exists():
            fail(f"{slug}: canonical story shell is missing")
        try:
            detail_payload = json.loads(detail.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            fail(f"{slug}: per-story runtime fallback is invalid JSON: {exc}")
        if not isinstance(detail_payload, dict) or detail_payload.get("slug") != slug:
            fail(f"{slug}: per-story runtime fallback does not match index")
        if detail_payload.get("title") != row.get("title"):
            fail(f"{slug}: index/detail title mismatch")
        if detail_payload.get("publishedAt") != row.get("publishedAt"):
            fail(f"{slug}: index/detail publishedAt mismatch")

    app = APP.read_text(encoding="utf-8")
    if "const DATA_URL = 'data/articles.json';" not in app:
        fail("public app no longer declares same-origin data/articles.json as its article index")
    if "neuralCriticPublicSupabase" in app or ".from('articles')" in app or '.from("articles")' in app:
        fail("public app directly queries Supabase articles; this can reintroduce browser split-brain")

    workflow = BUILD_WORKFLOW.read_text(encoding="utf-8")
    required = [
        "python scripts/build_runtime_fallback.py",
        "data/articles.json data/articles",
        "python scripts/audit_runtime_consistency.py",
    ]
    for marker in required:
        if marker not in workflow:
            fail(f"publication refresh is missing required consistency marker: {marker}")

    print(f"Runtime consistency audit passed for {len(rows)} published stories.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
