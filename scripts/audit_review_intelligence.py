#!/usr/bin/env python3
"""Deterministic regression audit for the Reviews + Guides reader journey."""

from __future__ import annotations

import html as html_lib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def norm(value: object) -> str:
    return str(value or "").strip().casefold()


def field(row: dict, *names: str):
    for name in names:
        if name in row:
            return row.get(name)
    return None


def is_review(row: dict) -> bool:
    return (
        norm(field(row, "articleFormat", "article_format")) == "review"
        or norm(row.get("category")) == "review"
        or norm(field(row, "editorialSection", "editorial_section")) == "reviews"
    )


def is_guide(row: dict) -> bool:
    return (
        norm(field(row, "articleFormat", "article_format")) == "game-guide"
        or norm(row.get("category")) == "guide"
        or norm(field(row, "editorialSection", "editorial_section")) == "guides"
    )


def game_key(row: dict) -> str:
    return str(field(row, "gameKey", "game_key") or "").strip()


def generated_games() -> dict[str, str]:
    mapped: dict[str, str] = {}
    for page in sorted((ROOT / "games").glob("*/index.html")):
        text = page.read_text(encoding="utf-8", errors="ignore")
        match = re.search(r'<h1 id="game-title">([^<]+)</h1>', text)
        if not match:
            continue
        title = html_lib.unescape(match.group(1)).strip()
        if title:
            mapped[norm(title)] = page.parent.name
    return mapped


def require(condition: bool, message: str, failures: list[str]) -> None:
    if not condition:
        failures.append(message)


def main() -> int:
    failures: list[str] = []

    review_html = (ROOT / "reviews" / "index.html").read_text(encoding="utf-8")
    guide_html = (ROOT / "guides" / "index.html").read_text(encoding="utf-8")
    review_js = (ROOT / "assets" / "review-intelligence.js").read_text(encoding="utf-8")
    review_css = (ROOT / "assets" / "review-intelligence.css").read_text(encoding="utf-8")
    guide_js = (ROOT / "assets" / "guide-intelligence.js").read_text(encoding="utf-8")
    guide_css = (ROOT / "assets" / "guide-intelligence.css").read_text(encoding="utf-8")
    content_api = (ROOT / "assets" / "content-api.js").read_text(encoding="utf-8")
    category_html = (ROOT / "category.html").read_text(encoding="utf-8")
    sitemap_builder = (ROOT / "scripts" / "build_sitemap.py").read_text(encoding="utf-8")

    require('https://www.neuralcritic.net/reviews/' in review_html, "Reviews hub canonical is missing", failures)
    require('https://www.neuralcritic.net/guides/' in guide_html, "Guides hub canonical is missing", failures)
    require('assets/review-intelligence.js?v=20260904-reviewguide1' in review_html, "Reviews hub is not pinned to the M9 runtime", failures)
    require('assets/guide-intelligence.js?v=20260904-reviewguide1' in guide_html, "Guides hub is not pinned to the M9 runtime", failures)
    require('assets/content-api.js?v=20260904-reviewguide1' in review_html and 'assets/content-api.js?v=20260904-reviewguide1' in guide_html, "Reviews/Guides hubs must pin the shared M9 Content API", failures)

    require("async function publishedGames()" in content_api, "Content API must own Games Database index reads", failures)
    require("from('games')" in content_api and "publishedGames" in content_api, "Content API Games Database read/export is missing", failures)
    require("from('articles')" in content_api and "publishedIndex" in content_api, "Content API published article index is missing", failures)

    for label, script in (("review", review_js), ("guide", guide_js)):
        require("NeuralCriticContentAPI" in script, f"{label} hub must reuse the shared Content API", failures)
        require("publishedIndex" in script, f"{label} hub must reuse the shared published article index", failures)
        require("publishedGames" in script, f"{label} hub must reuse the shared Games Database index", failures)
        require("from('articles')" not in script and "from('games')" not in script, f"{label} hub must not create a second direct Supabase content owner", failures)
        require("stories/${encodeURIComponent(slug)}/" in script, f"{label} hub must use canonical story links", failures)
        require("games/${encodeURIComponent(slug)}/" in script, f"{label} hub must use stored canonical game slugs", failures)
        require("slugify(" not in script, f"{label} hub must not guess game slugs from titles", failures)

    require("data-review-game-target" in review_js and "review_game_hub_click" in review_js, "Review-to-Game-Hub action/analytics contract is missing", failures)
    require("data-guide-game-target" in guide_js and "guide_game_hub_click" in guide_js, "Guide-to-Game-Hub action/analytics contract is missing", failures)
    require("norm(r.article_format)==='game-guide'" in guide_js and "norm(r.editorial_section)==='guides'" in guide_js, "Guide classification must use structured metadata", failures)
    require("title.includes" not in guide_js.lower(), "Guide classification must not fall back to title keyword matching", failures)

    require("@media(max-width:620px)" in review_css and ":focus-visible" in review_css and "prefers-reduced-motion" in review_css, "Reviews responsive/focus/reduced-motion contract is incomplete", failures)
    require("@media(max-width:620px)" in guide_css and ":focus-visible" in guide_css and "prefers-reduced-motion" in guide_css, "Guides responsive/focus/reduced-motion contract is incomplete", failures)

    require('urllib.parse.urljoin(SITE_URL, "reviews/")' in sitemap_builder, "Sitemap builder must include clean /reviews/", failures)
    require('urllib.parse.urljoin(SITE_URL, "guides/")' in sitemap_builder, "Sitemap builder must include clean /guides/", failures)
    require('category.html?category=reviews' not in sitemap_builder and 'category.html?category=guides' not in sitemap_builder, "Sitemap builder must not prefer legacy Review/Guide category URLs", failures)
    require("cleanDeskRoute" in category_html and "direct==='reviews'||direct==='guides'" in category_html, "Review/Guide compatibility routes must resolve to clean hubs", failures)

    payload = json.loads((ROOT / "data" / "articles.json").read_text(encoding="utf-8"))
    require(isinstance(payload, list), "Published fallback index must be a list", failures)
    articles = [row for row in payload if isinstance(row, dict)] if isinstance(payload, list) else []
    reviews = [row for row in articles if is_review(row)]
    guides = [row for row in articles if is_guide(row)]
    games = generated_games()

    require(bool(reviews), "Published fallback must contain at least one review", failures)
    require(bool(guides), "Published fallback must contain at least one guide", failures)
    require(bool(games), "Generated publication must contain canonical Game Hubs", failures)

    for kind, rows in (("review", reviews), ("guide", guides)):
        for row in rows:
            key = game_key(row)
            slug = str(row.get("slug") or "").strip()
            require(bool(key), f"Published {kind} {slug or '<unknown>'} is missing game identity", failures)
            if key:
                require(norm(key) in games, f"Published {kind} {slug or '<unknown>'} does not map to a generated canonical Game Hub: {key}", failures)

    if failures:
        print("Reviews + Guides journey audit failed:")
        for failure in failures:
            print(f" - {failure}")
        return 1

    print(
        "Reviews + Guides journey audit passed: "
        f"{len(reviews)} reviews and {len(guides)} guides map to generated canonical Game Hubs; "
        "shared Content API, clean hub, story, sitemap, accessibility and analytics contracts are present."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
