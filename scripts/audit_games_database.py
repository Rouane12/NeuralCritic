#!/usr/bin/env python3
"""Regression checks for Neural Critic Game Hub / Games Database."""

from pathlib import Path
from build_game_pages import render_game

ROOT = Path(__file__).resolve().parents[1]


def require(path: Path, markers: tuple[str, ...], failures: list[str]) -> None:
    if not path.exists():
        failures.append(f"Missing {path.relative_to(ROOT)}")
        return
    text = path.read_text(encoding="utf-8")
    for marker in markers:
        if marker not in text:
            failures.append(f"{path.relative_to(ROOT)} missing marker: {marker}")


def verify_generated_metadata_contract(failures: list[str]) -> None:
    template_path = ROOT / "game.html"
    if not template_path.exists():
        failures.append("Missing game.html for generated metadata contract")
        return
    rendered = render_game(
        template_path.read_text(encoding="utf-8"),
        {
            "slug": "metadata-audit-game",
            "title": "Metadata Audit Game",
            "summary": "A deterministic game-shell metadata fixture.",
            "release_status": "released",
            "primary_release_date": "2026-01-01",
            "developer": "Neural Critic QA",
            "publisher": "Neural Critic QA",
            "genres": ["Test"],
            "platforms": ["PC"],
        },
    )
    if rendered.count('<meta name="description"') != 1:
        failures.append("generated game shell must contain exactly one meta description")
    if 'content="A deterministic game-shell metadata fixture."' not in rendered:
        failures.append("generated game shell must use the authoritative game summary as meta description")
    if 'content="Game information, release details and connected Neural Critic coverage."' in rendered:
        failures.append("generated game shell must not retain the generic template meta description")
    canonical = "https://www.neuralcritic.net/games/metadata-audit-game/"
    if f'<link rel="canonical" href="{canonical}">' not in rendered:
        failures.append("generated game shell must retain its canonical game URL")
    for marker in ('id="game-signal-strip"', 'id="game-start-here-panel"', 'id="game-timeline-panel"', 'id="game-related-games"'):
        if marker not in rendered:
            failures.append(f"generated game shell must retain Phase 2 hub marker: {marker}")


def main() -> int:
    failures: list[str] = []
    require(
        ROOT / "game.html",
        (
            'id="game-page"',
            'id="game-signal-strip"',
            'id="game-start-here-panel"',
            'id="game-coverage-panel"',
            'id="game-timeline-panel"',
            'id="game-related-games"',
            'class="nc-game-local-nav"',
            "assets/game-page.js?v=20260912-gamehub3",
            "assets/game-page.css?v=20260912-gamehub3",
            "assets/game-hub-phase2.css?v=20260912-retention1",
        ),
        failures,
    )
    require(
        ROOT / "assets" / "game-page.js",
        (
            "from('games')",
            "from('game_releases')",
            "game_page_view",
            "game_hub_start_here_click",
            "game_hub_timeline_click",
            "game_hub_related_game_click",
            "function directGameArticles(game, articles)",
            "function renderStartHere(game, articles)",
            "function renderTimeline(game, releases, articles)",
            "function renderRelatedGames(game, games)",
            "const gameUrl = slug => new URL(`games/${encodeURIComponent(slug)}/`, root).href;",
            "const storyUrl = slug => new URL(`stories/${encodeURIComponent(slug)}/`, root).href;",
            "const topicUrl = (type, value) => new URL(`topics/${type}/${slugify(value)}/`, root).href;",
        ),
        failures,
    )
    require(
        ROOT / "assets" / "game-hub-phase2.css",
        (
            ".nc-game-signal-strip",
            ".nc-game-local-nav",
            ".nc-game-start-here",
            ".nc-game-timeline",
            ".nc-game-related-games",
            '@media(max-width:560px)',
            'html[data-theme="light"] body.nc-game-page',
        ),
        failures,
    )
    require(ROOT / "scripts" / "build_game_pages.py", ("generated: neural-critic-game-shell", "games/{urllib.parse.quote", "VideoGame", "sync_sitemap", "NEURAL_CRITIC_STATIC_GAME_SLUG"), failures)
    require(ROOT / "supabase" / "migrations" / "20260828183000_games_database_v1.sql", ("create table if not exists public.games", "create table if not exists public.game_releases", "enable row level security", "Public can read games"), failures)
    require(ROOT / ".github" / "workflows" / "build-publication.yml", ("python scripts/build_game_pages.py", "stories topics games authors"), failures)
    verify_generated_metadata_contract(failures)

    if failures:
        print("Games Database / Game Hub audit failed:")
        for failure in failures:
            print(f" - {failure}")
        return 1
    print("Game Hub audit passed: canonical metadata, Start Here, release intelligence, connected coverage, timeline, related-game recirculation, responsive styling and analytics are wired.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
