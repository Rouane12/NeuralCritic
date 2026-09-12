#!/usr/bin/env python3
"""Fail if Neural Critic's browser runtime can drift from generated publication state."""
from __future__ import annotations

import hashlib
import json
import py_compile
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import harden_story_shells as hardener

INDEX = ROOT / "data" / "articles.json"
DETAILS = ROOT / "data" / "articles"
STORIES = ROOT / "stories"
SITEMAP = ROOT / "sitemap.xml"
APP = ROOT / "assets" / "app.js"
ROUTER = ROOT / "assets" / "story-router.js"
WEEKLY_DROP = ROOT / "assets" / "article-weekly-drop-v2.js"
ARTICLE_FOOTER = ROOT / "assets" / "article-footer-v2.js"
ARTICLE_FOOTER_CSS = ROOT / "assets" / "article-footer-v2.css"
BUILD_WORKFLOW = ROOT / ".github" / "workflows" / "build-publication.yml"
FAST_WORKFLOW = ROOT / ".github" / "workflows" / "fast-publish-story.yml"


def fail(message: str) -> None:
    raise SystemExit(f"RUNTIME CONSISTENCY FAILED: {message}")


def digest(path: Path) -> str:
    if not path.exists():
        fail(f"required runtime asset is missing: {path.relative_to(ROOT)}")
    return hashlib.sha256(path.read_bytes()).hexdigest()[:12]


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


def validate_router_contract() -> None:
    text = ROUTER.read_text(encoding="utf-8", errors="ignore")
    required = (
        "window.NeuralCriticStoryRouter",
        "function restoreStaticStoryRoute()",
        "history.replaceState(null, '', `${target.pathname}${target.hash}`);",
    )
    for marker in required:
        if marker not in text:
            fail(f"canonical story router lost required contract: {marker}")


def compile_reliability_tools() -> None:
    for path in (
        ROOT / "scripts" / "harden_story_shells.py",
        ROOT / "scripts" / "fast_publish_runtime.py",
        ROOT / "scripts" / "check_live_story.py",
    ):
        try:
            py_compile.compile(str(path), doraise=True)
        except py_compile.PyCompileError as exc:
            fail(f"reliability tool does not compile: {path.name}: {exc.msg}")


def main() -> int:
    compile_reliability_tools()
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

    validate_router_contract()
    app_hash = digest(APP)
    router_hash = digest(ROUTER)
    weekly_hash = digest(WEEKLY_DROP)
    footer_hash = digest(ARTICLE_FOOTER)
    footer_css_hash = digest(ARTICLE_FOOTER_CSS)
    expected_app = f'<script src="assets/app.js?v={app_hash}"></script>'
    expected_router = f'<script src="assets/story-router.js?v={router_hash}"></script>'
    expected_weekly = (
        f'<script src="assets/article-weekly-drop-v2.js?v={weekly_hash}" '
        'data-nc-weekly-drop-v2="1"></script>'
    )
    expected_footer = (
        f'<script src="assets/article-footer-v2.js?v={footer_hash}" '
        'data-nc-article-footer-v2="1"></script>'
    )
    expected_footer_style = (
        f'<link rel="stylesheet" href="assets/article-footer-v2.css?v={footer_css_hash}" '
        'data-nc-article-footer-v2="1">'
    )

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

        # Change-audit workflows may regenerate raw shells immediately before this
        # audit. Validate the exact hardened output in memory; the production build
        # separately runs harden_story_shells.py before committing the files.
        try:
            shell_text = hardener.harden_html(shell.read_text(encoding="utf-8", errors="ignore"))
        except SystemExit as exc:
            fail(f"{slug}: canonical story shell cannot be hardened: {exc}")
        canonical = f"https://www.neuralcritic.net/stories/{slug}/"
        required_shell = (
            "<!-- generated: neural-critic-story-shell -->",
            canonical,
            f"window.NEURAL_CRITIC_STATIC_SLUG={json.dumps(slug)}",
            expected_router,
            expected_app,
            expected_footer_style,
            expected_footer,
            expected_weekly,
        )
        for marker in required_shell:
            if marker not in shell_text:
                fail(f"{slug}: canonical story shell lost runtime invariant: {marker}")

    app = APP.read_text(encoding="utf-8")
    if "const DATA_URL = 'data/articles.json';" not in app:
        fail("public app no longer declares same-origin data/articles.json as its article index")
    if "NEURAL_CRITIC_STATIC_SLUG" not in app:
        fail("public app no longer resolves generated canonical story slugs")
    if "neuralCriticPublicSupabase" in app or ".from('articles')" in app or '.from("articles")' in app:
        fail("public app directly queries Supabase articles; this can reintroduce browser split-brain")

    workflow = BUILD_WORKFLOW.read_text(encoding="utf-8")
    required_build = [
        "python scripts/build_runtime_fallback.py",
        "python scripts/harden_story_shells.py --template --all",
        "data/articles.json data/articles",
        "python scripts/audit_runtime_consistency.py",
        "assets/app.js",
        "assets/story-router.js",
        "assets/article-weekly-drop-v2.js",
        "assets/article-footer-v2.js",
        "assets/article-footer-v2.css",
        "group: neural-critic-publication-write",
    ]
    for marker in required_build:
        if marker not in workflow:
            fail(f"publication refresh is missing required consistency marker: {marker}")

    fast_workflow = FAST_WORKFLOW.read_text(encoding="utf-8")
    required_fast = [
        'python scripts/fast_publish_runtime.py --slug "$STORY_SLUG"',
        'python scripts/harden_story_shells.py --slug "$STORY_SLUG"',
        'python scripts/check_live_story.py --slug "$STORY_SLUG"',
        'data/articles/${STORY_SLUG}.json',
        "group: neural-critic-publication-write",
    ]
    for marker in required_fast:
        if marker not in fast_workflow:
            fail(f"fast publication path is missing required reliability marker: {marker}")

    print(
        f"Runtime consistency audit passed for {len(rows)} published stories "
        f"with app {app_hash}, router {router_hash}, Weekly Drop {weekly_hash}, "
        f"footer {footer_hash}, and footer CSS {footer_css_hash}."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
