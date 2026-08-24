#!/usr/bin/env python3
"""Generate robots.txt from Neural Critic's configured public origin/base path."""

from __future__ import annotations

from pathlib import Path

from publication_config import BASE_PATH, public_path, public_url

ROOT = Path(__file__).resolve().parents[1]
ROBOTS_PATH = ROOT / "robots.txt"

PRIVATE_PATHS = (
    "studio.html",
    "newsroom.html",
    "subscribers.html",
    "data/",
    "scripts/",
)


def render() -> str:
    lines = [
        "User-agent: *",
        f"Allow: {BASE_PATH}",
        *[f"Disallow: {public_path(path)}" for path in PRIVATE_PATHS],
        "",
        f"Sitemap: {public_url('sitemap.xml')}",
        "",
    ]
    return "\n".join(lines)


def main() -> int:
    ROBOTS_PATH.write_text(render(), encoding="utf-8")
    print(f"Generated robots.txt for {public_url('')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
