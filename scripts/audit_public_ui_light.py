#!/usr/bin/env python3
"""Protect light-mode ownership on reader-facing intelligence surfaces."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSET = 'assets/intelligence-light-fixes.css?v=20260904-ui1'


def main() -> int:
    failures: list[str] = []
    pages = {
        'reviews/index.html': 'nc-reviews-page',
        'guides/index.html': 'nc-guides-page',
        'game.html': 'nc-game-page',
    }
    for relative, body_class in pages.items():
        text = (ROOT / relative).read_text(encoding='utf-8')
        if ASSET not in text:
            failures.append(f'{relative} is missing the post-component light-mode integrity asset')
        if f'class="{body_class}"' not in text:
            failures.append(f'{relative} is missing scoped body class {body_class}')

    css = (ROOT / 'assets' / 'intelligence-light-fixes.css').read_text(encoding='utf-8')
    required = (
        'html[data-theme="light"] body.nc-reviews-page .nc-review-toolbar',
        'html[data-theme="light"] body.nc-reviews-page .nc-review-card',
        'html[data-theme="light"] body.nc-reviews-page .nc-review-filter-row input',
        'html[data-theme="light"] body.nc-guides-page .nc-guide-toolbar',
        'html[data-theme="light"] body.nc-guides-page .nc-guide-card',
        'html[data-theme="light"] body.nc-guides-page .nc-guide-toolbar input',
        'html[data-theme="light"] body.nc-game-page .nc-game-panel',
        'html[data-theme="light"] body.nc-game-page .nc-game-facts div',
        'html[data-theme="light"] body.nc-game-page .nc-game-coverage-nav',
        'color-scheme:light',
        'input::placeholder',
        ':focus-visible',
    )
    for marker in required:
        if marker not in css:
            failures.append(f'intelligence-light-fixes.css missing {marker}')

    if failures:
        print('Public UI light-mode audit failed:')
        for failure in failures:
            print(' -', failure)
        return 1

    print('Public UI light-mode audit passed: Reviews, Guides and Game Hubs own readable light surfaces, controls and focus states.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
