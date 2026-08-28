#!/usr/bin/env python3
"""Fail when article discovery regresses to legacy reader URLs."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGETS = {
    ROOT / "assets" / "article-discovery.js": (
        'href="article.html?slug=',
        "`article.html?slug=",
    ),
}


def main() -> int:
    failures: list[str] = []
    for path, forbidden in TARGETS.items():
        text = path.read_text(encoding="utf-8")
        for pattern in forbidden:
            if pattern in text:
                failures.append(f"{path.relative_to(ROOT)} still contains legacy discovery URL: {pattern}")

    discovery = (ROOT / "assets" / "article-discovery.js").read_text(encoding="utf-8")
    required = (
        "stories/${encodeURIComponent(storySlug)}/",
        "data-discovery-target",
        "discovery_click",
        "connected_coverage_click",
    )
    for marker in required:
        if marker not in discovery:
            failures.append(f"assets/article-discovery.js is missing V2 marker: {marker}")

    if failures:
        print("Discovery link audit failed:")
        for failure in failures:
            print(f" - {failure}")
        return 1

    print("Discovery link audit passed: canonical story links and analytics markers are present.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
