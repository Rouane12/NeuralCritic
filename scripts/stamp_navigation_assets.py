#!/usr/bin/env python3
"""Stamp Neural Critic public HTML with fresh shared-navigation assets.

The publication is static at the edge, so changing a shared navigation asset without
changing its query string can leave returning readers on an older cached build. This
step uses content hashes and also mounts the bounded responsive/canonical hotfixes.
"""

from __future__ import annotations

import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NAV_CSS = ROOT / "assets" / "publication-nav.css"
NAV_JS = ROOT / "assets" / "publication-nav.js"
HOTFIX_CSS = ROOT / "assets" / "navigation-responsive-hotfix.css"
HOTFIX_JS = ROOT / "assets" / "navigation-canonical-hotfix.js"


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()[:12]


def stamp_text(text: str) -> str:
    nav_css_version = digest(NAV_CSS)
    nav_js_version = digest(NAV_JS)
    hotfix_css_version = digest(HOTFIX_CSS)
    hotfix_js_version = digest(HOTFIX_JS)

    # Remove previous hotfix mounts first so the operation stays idempotent.
    text = re.sub(
        r'<link rel="stylesheet" href="assets/navigation-responsive-hotfix\.css(?:\?v=[^"]*)?">',
        '',
        text,
    )
    text = re.sub(
        r'<script src="assets/navigation-canonical-hotfix\.js(?:\?v=[^"]*)?"></script>',
        '',
        text,
    )

    css_tag = f'<link rel="stylesheet" href="assets/publication-nav.css?v={nav_css_version}">'
    css_hotfix_tag = f'<link rel="stylesheet" href="assets/navigation-responsive-hotfix.css?v={hotfix_css_version}">'
    text, css_count = re.subn(
        r'<link rel="stylesheet" href="assets/publication-nav\.css(?:\?v=[^"]*)?">',
        css_tag + css_hotfix_tag,
        text,
        count=1,
    )

    js_tag = f'<script src="assets/publication-nav.js?v={nav_js_version}"></script>'
    js_hotfix_tag = f'<script src="assets/navigation-canonical-hotfix.js?v={hotfix_js_version}"></script>'
    text, js_count = re.subn(
        r'<script src="assets/publication-nav\.js(?:\?v=[^"]*)?"></script>',
        js_tag + js_hotfix_tag,
        text,
        count=1,
    )

    # Only public shells that already own publication navigation should be touched.
    if bool(css_count) != bool(js_count):
        raise RuntimeError("Navigation CSS/JS ownership mismatch while stamping HTML")
    return text


def public_html_files() -> list[Path]:
    ignored = {'.git', 'node_modules'}
    paths: list[Path] = []
    for path in ROOT.rglob('*.html'):
        if any(part in ignored for part in path.parts):
            continue
        paths.append(path)
    return sorted(paths)


def main() -> int:
    changed = 0
    stamped = 0
    for path in public_html_files():
        original = path.read_text(encoding='utf-8')
        if 'assets/publication-nav.css' not in original and 'assets/publication-nav.js' not in original:
            continue
        stamped += 1
        updated = stamp_text(original)
        if updated == original:
            continue
        path.write_text(updated, encoding='utf-8')
        changed += 1
    print(f"Navigation asset stamping complete: {changed} changed / {stamped} owned HTML shells.")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
