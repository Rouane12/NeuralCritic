#!/usr/bin/env python3
"""Regression checks for Neural Critic Trending + Most Read V2."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def require(text: str, markers: tuple[str, ...], label: str, failures: list[str]) -> None:
    for marker in markers:
        if marker not in text:
            failures.append(f"{label} is missing required marker: {marker}")


def main() -> int:
    failures: list[str] = []
    popularity_path = ROOT / "assets" / "popularity-signals.js"
    style_path = ROOT / "assets" / "popularity-signals.css"
    api_path = ROOT / "assets" / "content-api.js"

    for path in (popularity_path, style_path, api_path):
        if not path.exists():
            failures.append(f"Missing required file: {path.relative_to(ROOT)}")

    if failures:
        for failure in failures:
            print(f" - {failure}")
        return 1

    popularity = popularity_path.read_text(encoding="utf-8")
    styles = style_path.read_text(encoding="utf-8")
    api = api_path.read_text(encoding="utf-8")

    require(popularity, (
        "SHORT_WINDOW_DAYS = 7",
        "LONG_WINDOW_DAYS = 30",
        "SHORT_WINDOW_SIGNAL_FLOOR",
        "engine.mostRead",
        "engine.trending",
        'data-popularity-mode="trending"',
        'data-popularity-mode="most-read"',
        "popularity_tab_switch",
        "popularity_story_click",
        "popularity_module_view",
        "stories/${encodeURIComponent(slug)}/",
        "AUDIENCE SIGNALS ARE WARMING UP",
    ), "assets/popularity-signals.js", failures)

    require(styles, (
        ".nc-popularity-tabs",
        '[aria-selected="true"]',
        'html[data-theme="light"]',
        '@media(max-width:760px)',
        '@media(prefers-reduced-motion:reduce)',
    ), "assets/popularity-signals.css", failures)

    require(api, (
        "assets/popularity-signals.js?v=20260828-popularity2",
        "data-nc-popularity-signals",
        "articlePopularity",
        "recordArticleView",
    ), "assets/content-api.js", failures)

    for deprecated in ("__popularitySignalsV1", "MOST READ + MOMENTUM"):
        if deprecated in popularity:
            failures.append(f"assets/popularity-signals.js still contains V1 behavior: {deprecated}")

    if failures:
        print("Popularity V2 audit failed:")
        for failure in failures:
            print(f" - {failure}")
        return 1

    print("Popularity V2 audit passed: separate Trending/Most Read modes, adaptive reader windows, canonical links and analytics are wired.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
