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

    for pattern in ('href="article.html?slug=', "`article.html?slug="):
        if pattern in article:
            failures.append(f"assets/article-discovery.js still contains legacy discovery URL: {pattern}")

    article_required = (
        "stories/${encodeURIComponent(storySlug)}/",
        "data-discovery-target",
        "discovery_click",
        "connected_coverage_click",
        "engine.related(current,all,3)",
    )
    for marker in article_required:
        if marker not in article:
            failures.append(f"assets/article-discovery.js is missing discovery marker: {marker}")

    engine_required = (
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
        "recirculation_click",
        "recirculation_hub_click",
        "recirculation_view",
        "after-reader-thread",
        "engine.related(current, index, 3)",
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
        "assets/discovery-intelligence.js?v=20260828-discovery2",
        "assets/recirculation.css?v=20260828-discovery2",
        "assets/recirculation.js?v=20260828-discovery2",
        "data-nc-recirculation",
    )
    for marker in api_required:
        if marker not in api:
            failures.append(f"assets/content-api.js is missing discovery bootstrap marker: {marker}")

    if failures:
        print("Discovery / Game Graph recirculation audit failed:")
        for failure in failures:
            print(f" - {failure}")
        return 1

    print(
        "Discovery / Game Graph recirculation audit passed: canonical routes, shared ranking, "
        "diversified article recommendations, game-page adoption, analytics, and bootstrap wiring are present."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
