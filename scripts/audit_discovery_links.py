#!/usr/bin/env python3
"""Fail when Neural Critic discovery regresses to legacy routes or loses V2 wiring."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    failures: list[str] = []
    article_path = ROOT / "assets" / "article-discovery.js"
    recirc_path = ROOT / "assets" / "recirculation.js"
    api_path = ROOT / "assets" / "content-api.js"
    article = article_path.read_text(encoding="utf-8")
    recirc = recirc_path.read_text(encoding="utf-8")
    api = api_path.read_text(encoding="utf-8")

    for pattern in ('href="article.html?slug=', "`article.html?slug="):
        if pattern in article:
            failures.append(f"assets/article-discovery.js still contains legacy discovery URL: {pattern}")

    article_required = (
        "stories/${encodeURIComponent(storySlug)}/",
        "data-discovery-target",
        "discovery_click",
        "connected_coverage_click",
    )
    for marker in article_required:
        if marker not in article:
            failures.append(f"assets/article-discovery.js is missing V2 marker: {marker}")

    recirc_required = (
        "topics/${encodeURIComponent(type)}/${encodeURIComponent(key)}/",
        "data-recirc-target",
        "data-recirc-hub",
        "recirculation_click",
        "recirculation_hub_click",
        "recirculation_view",
        "after-reader-thread",
    )
    for marker in recirc_required:
        if marker not in recirc:
            failures.append(f"assets/recirculation.js is missing V2 marker: {marker}")

    forbidden_recirc = ("topic.html?", "removeLegacyRelated", "cleanupObserver")
    for marker in forbidden_recirc:
        if marker in recirc:
            failures.append(f"assets/recirculation.js still contains deprecated behavior: {marker}")

    api_required = (
        "assets/recirculation.css?v=20260828-discovery2",
        "assets/recirculation.js?v=20260828-discovery2",
        "data-nc-recirculation",
    )
    for marker in api_required:
        if marker not in api:
            failures.append(f"assets/content-api.js is missing recirculation bootstrap marker: {marker}")

    if failures:
        print("Discovery V2 audit failed:")
        for failure in failures:
            print(f" - {failure}")
        return 1

    print("Discovery V2 audit passed: canonical routes, sidebar preservation, recirculation wiring and analytics markers are present.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
