#!/usr/bin/env python3
"""Static regression checks for Games Database V1."""

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


def main() -> int:
    failures: list[str] = []
    require(
        ROOT / "game.html",
        (
            'id="game-page"',
            "assets/game-page.js?v=20260903-gamehub2",
            "assets/game-page.css?v=20260903-gamehub2",
        ),
        failures,
    )
    require(
        ROOT / "assets" / "game-page.js",
        (
            "from('games')",
            "from('game_releases')",
            "game_page_view",
            "const storyUrl = slug => new URL(`stories/${encodeURIComponent(slug)}/`, root).href;",
            "const topicUrl = (type, value) => new URL(`topics/${type}/${slugify(value)}/`, root).href;",
        ),
        failures,
    )
    require(ROOT / "scripts" / "build_game_pages.py", ("generated: neural-critic-game-shell", "games/{urllib.parse.quote", "VideoGame", "sync_sitemap", "NEURAL_CRITIC_STATIC_GAME_SLUG"), failures)
    require(ROOT / "supabase" / "migrations" / "20260828183000_games_database_v1.sql", ("create table if not exists public.games", "create table if not exists public.game_releases", "enable row level security", "Public can read games"), failures)
    require(ROOT / ".github" / "workflows" / "build-publication.yml", ("python scripts/build_game_pages.py", "stories topics games authors"), failures)
    verify_generated_metadata_contract(failures)

    if failures:
        print("Games Database V1 audit failed:")
        for failure in failures:
            print(f" - {failure}")
        return 1
    print("Games Database V1 audit passed: schema, runtime, canonical builder, metadata contract and publication wiring are present.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())