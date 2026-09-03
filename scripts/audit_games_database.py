#!/usr/bin/env python3
"""Static regression checks for Games Database V1."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def require(path: Path, markers: tuple[str, ...], failures: list[str]) -> None:
    if not path.exists():
        failures.append(f"Missing {path.relative_to(ROOT)}")
        return
    text = path.read_text(encoding="utf-8")
    for marker in markers:
        if marker not in text:
            failures.append(f"{path.relative_to(ROOT)} missing marker: {marker}")


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

    if failures:
        print("Games Database V1 audit failed:")
        for failure in failures:
            print(f" - {failure}")
        return 1
    print("Games Database V1 audit passed: schema, runtime, canonical builder and publication wiring are present.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
