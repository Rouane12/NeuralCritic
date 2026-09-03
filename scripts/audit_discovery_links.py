#!/usr/bin/env python3
"""Fail when Neural Critic discovery regresses to legacy routes or loses Game Graph recirculation wiring."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    failures: list[str] = []
    article = (ROOT / "assets" / "article-discovery.js").read_text(encoding="utf-8")
    recirc = (ROOT / "assets" / "recirculation.js").read_text(encoding="utf-8")
    engine = (ROOT / "assets" / "discovery-intelligence.js").read_text(encoding="utf-8")
    game_page = (ROOT / "assets" / "game-page.js").read_text(encoding="utf-8")
    api = (ROOT / "assets" / "content-api.js").read_text(encoding="utf-8")

    canonical_surfaces = {
        "assets/app.js": "stories/${encodeURIComponent(a.slug)}/",
        "assets/search-parity.js": "stories/${encodeURIComponent(article.slug)}/",
        "assets/category-parity.js": "stories/${encodeURIComponent(article.slug)}/",
        "assets/category-editorial-v3.js": "stories/${encodeURIComponent(article.slug)}/",
        "assets/category-news.js": "stories/${encodeURIComponent(article.slug)}/",
        "assets/publication-nav.js": "stories/${encodeURIComponent(a.slug)}/",
        "assets/what-to-play-hub.js": "stories/${encodeURIComponent(article.slug)}/",
        "assets/curated-collections.js": "stories/${encodeURIComponent(a.slug)}/",
        "assets/collection-ranking-preview.js": "stories/${encodeURIComponent(a.slug)}/",
        "assets/home-what-to-play.js": "stories/${encodeURIComponent(a.slug)}/",
    }
    for relative, marker in canonical_surfaces.items():
        text = (ROOT / relative).read_text(encoding="utf-8")
        if marker not in text:
            failures.append(f"{relative} is missing canonical story route marker: {marker}")
        if "article.html?slug=${encodeURIComponent" in text:
            failures.append(f"{relative} still emits compatibility story URLs from a discovery surface")

    runtime_pages = {
        "index.html": (
            "assets/content-api.js?v=20260901-canonical1",
            "assets/app.js?v=20260901-canonical1",
            "assets/publication-nav.js?v=20260901-canonical1",
            "assets/home-what-to-play.js?v=20260901-canonical1",
        ),
        "category.html": (
            "assets/content-api.js?v=20260901-canonical1",
            "assets/app.js?v=20260901-canonical1",
            "assets/category-parity.js?v=20260901-canonical1",
            "assets/publication-nav.js?v=20260901-canonical1",
            "assets/category-editorial-v3.js?v=20260901-canonical1",
            "assets/category-news.js?v=20260901-canonical1",
            "assets/what-to-play-hub.js?v=20260901-canonical1",
            "assets/curated-collections.js?v=20260901-canonical1",
            "assets/collection-ranking-preview.js?v=20260901-canonical1",
        ),
        "search.html": (
            "assets/content-api.js?v=20260901-canonical1",
            "assets/app.js?v=20260901-canonical1",
            "assets/search-parity.js?v=20260901-canonical1",
            "assets/publication-nav.js?v=20260901-canonical1",
        ),
        "article.html": (
            "assets/content-api.js?v=20260901-canonical1",
            "assets/app.js?v=20260901-canonical1",
            "assets/publication-nav.js?v=20260901-canonical1",
        ),
        "game.html": (
            "assets/content-api.js?v=20260901-canonical1",
            "assets/app.js?v=20260901-canonical1",
            "assets/publication-nav.js?v=20260901-canonical1",
            "assets/game-page.js?v=20260903-gamehub2",
        ),
    }
    for relative, markers in runtime_pages.items():
        text = (ROOT / relative).read_text(encoding="utf-8")
        for marker in markers:
            if marker not in text:
                failures.append(f"{relative} is missing refreshed discovery runtime marker: {marker}")

    for pattern in ('href="article.html?slug=', "`article.html?slug="):
        if pattern in article:
            failures.append(f"assets/article-discovery.js still contains legacy discovery URL: {pattern}")

    article_required = (
        "stories/${encodeURIComponent(storySlug)}/",
        "games/${encodeURIComponent(gameSlug)}/",
        "data-discovery-target",
        "data-discovery-destination=\"game_hub\"",
        "NeuralCriticArticleGameContextReady=true",
        "discovery_click",
        "connected_coverage_click",
        "engine.related(current,all,3)",
    )
    for marker in article_required:
        if marker not in article:
            failures.append(f"assets/article-discovery.js is missing discovery marker: {marker}")

    engine_required = (
        "const articleHref = article => `stories/${encodeURIComponent(article.slug)}/`;",
        "function relatedRelation(",
        "function relatedScore(",
        "function selectRelated(",
        "function complementaryKindBonus(",
        "same_game",
        "same_series",
        "same_franchise",
        "shared_topic",
        "meaningfulTopics",
        "relatedScore,",
    )
    for marker in engine_required:
        if marker not in engine:
            failures.append(f"assets/discovery-intelligence.js is missing Game Graph recommendation marker: {marker}")

    recirc_required = (
        "topics/${encodeURIComponent(type)}/${encodeURIComponent(key)}/",
        "data-recirc-target",
        "data-recirc-hub",
        "data-recirc-hub-destination",
        "recirculation_click",
        "recirculation_hub_click",
        "recirculation_view",
        "after-reader-thread",
        "engine.related(current, index, 3)",
        "destination:'game_hub'",
        "recommendationKinds",
    )
    for marker in recirc_required:
        if marker not in recirc:
            failures.append(f"assets/recirculation.js is missing recirculation marker: {marker}")

    forbidden_recirc = (
        "topic.html?",
        "removeLegacyRelated",
        "cleanupObserver",
        "function scoreCandidate(",
        "function relationFor(",
    )
    for marker in forbidden_recirc:
        if marker in recirc:
            failures.append(f"assets/recirculation.js still contains deprecated or duplicate recommendation behavior: {marker}")

    game_required = (
        "function graphSeed(",
        "engine.related(graphSeed(game)",
        "same_game",
        "same_series",
        "same_franchise",
        "shared_topic",
        "game_page_recirculation_click",
        "recommendation_engine",
    )
    for marker in game_required:
        if marker not in game_page:
            failures.append(f"assets/game-page.js is missing Game Graph recirculation marker: {marker}")

    api_required = (
        "assets/discovery-intelligence.css?v=20260903-articlejourney1",
        "assets/discovery-intelligence.js?v=20260901-recirculation3",
        "assets/recirculation.css?v=20260828-discovery2",
        "assets/article-discovery.js?v=20260903-articlejourney1",
        "assets/recirculation.js?v=20260903-articlejourney1",
        "stories/${encodeURIComponent(latest.slug)}/",
        "data-nc-recirculation",
    )
    for marker in api_required:
        if marker not in api:
            failures.append(f"assets/content-api.js is missing discovery bootstrap marker: {marker}")

    category_editorial = (ROOT / "assets" / "category-editorial-v3.js").read_text(encoding="utf-8")
    for marker in ("#category-spotlight a[href],#category-feed a[href]", "/\\/stories\\/([^/]+)"):
        if marker not in category_editorial:
            failures.append(f"assets/category-editorial-v3.js is missing canonical-aware duplicate detection marker: {marker}")

    if failures:
        print("Discovery / Game Graph recirculation audit failed:")
        for failure in failures:
            print(f" - {failure}")
        return 1

    print(
        "Discovery / Game Graph recirculation audit passed: canonical story/game routes, shared ranking, "
        "diversified recommendations, article-to-Game-Hub journey, analytics, and fresh bootstrap wiring are present."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
