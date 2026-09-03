#!/usr/bin/env python3
"""Audit live Supabase, generated fallback, and canonical story-shell parity.

This is read-only. It deliberately imports the production fallback mapper so a
passing result proves that the same live rows the browser runtime consumes are
represented byte-for-value in the repository fallback.
"""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
from pathlib import Path

from build_runtime_fallback import fetch_published


ROOT = Path(__file__).resolve().parents[1]
INDEX_PATH = ROOT / "data" / "articles.json"
DETAIL_DIR = ROOT / "data" / "articles"
STORIES_DIR = ROOT / "stories"
SITE_ORIGIN = "https://www.neuralcritic.net"


def load_json(path: Path) -> object:
    return json.loads(path.read_text(encoding="utf-8"))


def attribute(source: str, pattern: str) -> str:
    match = re.search(pattern, source, flags=re.I)
    return html.unescape(match.group(1)) if match else ""


def fail(errors: list[str], message: str) -> None:
    errors.append(message)


def audit_static(fallback: list[dict[str, object]], errors: list[str]) -> None:
    expected_details = {f"{row.get('slug')}.json" for row in fallback}
    actual_details = {path.name for path in DETAIL_DIR.glob("*.json")}
    if actual_details != expected_details:
        fail(errors, "Per-story fallback files do not exactly match the fallback index slug set")

    for row in fallback:
        slug = str(row.get("slug") or "")
        detail_path = DETAIL_DIR / f"{slug}.json"
        if not detail_path.is_file():
            fail(errors, f"Missing fallback detail for {slug}")
            continue
        if load_json(detail_path) != row:
            fail(errors, f"Fallback detail differs from index row for {slug}")

        shell_path = STORIES_DIR / slug / "index.html"
        if not shell_path.is_file():
            fail(errors, f"Missing canonical story shell for {slug}")
            continue
        source = shell_path.read_text(encoding="utf-8")
        canonical = attribute(source, r'<link\s+rel="canonical"\s+href="([^"]+)"')
        og_url = attribute(source, r'<meta\s+property="og:url"\s+content="([^"]+)"')
        expected_url = f"{SITE_ORIGIN}/stories/{slug}/"
        if canonical != expected_url:
            fail(errors, f"Canonical mismatch for {slug}: {canonical!r}")
        if og_url != expected_url:
            fail(errors, f"Open Graph URL mismatch for {slug}: {og_url!r}")
        if f'window.NEURAL_CRITIC_STATIC_SLUG="{slug}"' not in source:
            fail(errors, f"Story shell runtime slug mismatch for {slug}")
        if "<!-- generated: neural-critic-story-shell -->" not in source:
            fail(errors, f"Story shell generation marker missing for {slug}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--static-only",
        action="store_true",
        help="Skip the live read and verify only repository fallback/shell parity.",
    )
    args = parser.parse_args()

    errors: list[str] = []
    payload = load_json(INDEX_PATH)
    if not isinstance(payload, list) or not all(isinstance(row, dict) for row in payload):
        print("ERROR: data/articles.json must be a list of objects", file=sys.stderr)
        return 1
    fallback = payload
    audit_static(fallback, errors)

    live_count: str | int = "skipped"
    if not args.static_only:
        try:
            live = fetch_published()
            live_count = len(live)
            if live != fallback:
                live_slugs = [str(row.get("slug") or "") for row in live]
                fallback_slugs = [str(row.get("slug") or "") for row in fallback]
                if set(live_slugs) != set(fallback_slugs):
                    fail(errors, "Live and fallback slug sets differ")
                elif live_slugs != fallback_slugs:
                    fail(errors, "Live and fallback ordering differs")
                else:
                    fail(errors, "Live and fallback rows differ despite matching slug order")
        except Exception as exc:
            fail(errors, f"Live Supabase parity read failed: {exc}")

    for error in errors:
        print(f"ERROR: {error}", file=sys.stderr)
    print(
        "Content parity audit: "
        f"{len(errors)} error(s); live={live_count}, fallback={len(fallback)}, "
        f"details={len(list(DETAIL_DIR.glob('*.json')))}, shells={len(list(STORIES_DIR.glob('*/index.html')))}"
    )
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
