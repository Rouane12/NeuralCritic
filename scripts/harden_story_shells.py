#!/usr/bin/env python3
"""Harden canonical story shells against runtime/cache regressions."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ARTICLE_TEMPLATE = ROOT / "article.html"
STORIES_DIR = ROOT / "stories"
APP = ROOT / "assets" / "app.js"
ROUTER = ROOT / "assets" / "story-router.js"
WEEKLY_DROP = ROOT / "assets" / "article-weekly-drop-v2.js"
ARTICLE_FOOTER = ROOT / "assets" / "article-footer-v2.js"
SITE_URL = "https://www.neuralcritic.net/"
GENERATED_MARKER = "<!-- generated: neural-critic-story-shell -->"


def digest(path: Path) -> str:
    if not path.exists():
        raise SystemExit(f"Required runtime asset is missing: {path.relative_to(ROOT)}")
    return hashlib.sha256(path.read_bytes()).hexdigest()[:12]


def expected_tags() -> tuple[str, str, str, str]:
    router_tag = f'<script src="assets/story-router.js?v={digest(ROUTER)}"></script>'
    app_tag = f'<script src="assets/app.js?v={digest(APP)}"></script>'
    weekly_tag = (
        f'<script src="assets/article-weekly-drop-v2.js?v={digest(WEEKLY_DROP)}" '
        'data-nc-weekly-drop-v2="1"></script>'
    )
    footer_tag = (
        f'<script src="assets/article-footer-v2.js?v={digest(ARTICLE_FOOTER)}" '
        'data-nc-article-footer-v2="1"></script>'
    )
    return router_tag, app_tag, weekly_tag, footer_tag


def assert_router_contract() -> None:
    text = ROUTER.read_text(encoding="utf-8", errors="ignore")
    required = (
        "window.NeuralCriticStoryRouter",
        "function restoreStaticStoryRoute()",
        "history.replaceState(null, '', `${target.pathname}${target.hash}`);",
    )
    for marker in required:
        if marker not in text:
            raise SystemExit(f"Story router canonical restore contract is missing: {marker}")


def harden_html(html: str) -> str:
    router_tag, app_tag, weekly_tag, footer_tag = expected_tags()
    app_pattern = re.compile(r'<script src="assets/app\.js(?:\?v=[^"]*)?"></script>')
    router_pattern = re.compile(r'<script src="assets/story-router\.js(?:\?v=[^"]*)?"></script>')
    extras_pattern = re.compile(r'<script src="assets/article-extras\.js(?:\?v=[^"]*)?"></script>')
    weekly_pattern = re.compile(
        r'<script src="assets/article-weekly-drop-v2\.js(?:\?v=[^"]*)?"[^>]*></script>'
    )
    footer_pattern = re.compile(
        r'<script src="assets/article-footer-v2\.js(?:\?v=[^"]*)?"[^>]*></script>'
    )

    app_match = app_pattern.search(html)
    if not app_match:
        raise SystemExit("Could not locate assets/app.js in article runtime")

    if router_pattern.search(html):
        html = router_pattern.sub(router_tag, html, count=1)
    else:
        html = html[: app_match.start()] + router_tag + html[app_match.start() :]

    html, count = app_pattern.subn(app_tag, html, count=1)
    if count != 1:
        raise SystemExit("Could not pin assets/app.js in article runtime")

    if weekly_pattern.search(html):
        html = weekly_pattern.sub(weekly_tag, html, count=1)
    else:
        extras_match = extras_pattern.search(html)
        if not extras_match:
            raise SystemExit("Could not locate article-extras.js to pin Weekly Drop runtime")
        html = html[: extras_match.end()] + weekly_tag + html[extras_match.end() :]

    # Phase 5 must not rely on a cached Phase 4 script to discover the footer.
    # Pin the footer directly before Weekly Drop. The Phase 4 loader then sees
    # the declared footer runtime and becomes a harmless compatibility fallback.
    html = footer_pattern.sub('', html)
    weekly_match = weekly_pattern.search(html)
    if not weekly_match:
        raise SystemExit("Could not locate hardened Weekly Drop runtime")
    html = html[: weekly_match.start()] + footer_tag + html[weekly_match.start() :]
    return html


def validate_story(path: Path, slug: str, html: str) -> None:
    if GENERATED_MARKER not in html:
        raise SystemExit(f"{slug}: generated story marker is missing")

    canonical = f"{SITE_URL}stories/{slug}/"
    slug_marker = f"window.NEURAL_CRITIC_STATIC_SLUG={json.dumps(slug)}"
    router_tag, app_tag, weekly_tag, footer_tag = expected_tags()
    required = (
        canonical,
        slug_marker,
        router_tag,
        app_tag,
        footer_tag,
        weekly_tag,
        '<meta property="og:title"',
        '<link rel="canonical"',
    )
    for marker in required:
        if marker not in html:
            raise SystemExit(f"{slug}: hardened story shell is missing {marker}")


def harden_file(path: Path, slug: str | None = None) -> bool:
    html = path.read_text(encoding="utf-8")
    hardened = harden_html(html)
    if slug:
        validate_story(path, slug, hardened)
    if hardened == html:
        return False
    path.write_text(hardened, encoding="utf-8")
    return True


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--slug", help="Harden one canonical story shell")
    parser.add_argument("--all", action="store_true", help="Harden every generated story shell")
    parser.add_argument("--template", action="store_true", help="Also harden article.html")
    args = parser.parse_args()

    if not args.slug and not args.all and not args.template:
        parser.error("choose --slug, --all, and/or --template")
    if args.slug and args.all:
        parser.error("--slug and --all are mutually exclusive")
    if args.slug and not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]*", args.slug):
        parser.error("invalid story slug")

    assert_router_contract()
    changed = 0
    checked = 0

    if args.template:
        if not ARTICLE_TEMPLATE.exists():
            raise SystemExit("article.html is missing")
        changed += int(harden_file(ARTICLE_TEMPLATE))
        checked += 1

    if args.slug:
        target = STORIES_DIR / args.slug / "index.html"
        if not target.exists():
            raise SystemExit(f"Canonical story shell is missing: {target.relative_to(ROOT)}")
        changed += int(harden_file(target, args.slug))
        checked += 1

    if args.all:
        pages = sorted(STORIES_DIR.glob("*/index.html"))
        if not pages:
            raise SystemExit("No canonical story shells were found")
        for target in pages:
            slug = target.parent.name
            sample = target.read_text(encoding="utf-8", errors="ignore")
            if GENERATED_MARKER not in sample:
                continue
            changed += int(harden_file(target, slug))
            checked += 1

    router_tag, app_tag, weekly_tag, footer_tag = expected_tags()
    print(f"Story runtime hardening checked {checked} file(s); changed {changed}.")
    print(f"Pinned router runtime: {router_tag}")
    print(f"Pinned article runtime: {app_tag}")
    print(f"Pinned footer runtime: {footer_tag}")
    print(f"Pinned Weekly Drop runtime: {weekly_tag}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
