#!/usr/bin/env python3
"""Audit the public Games Directory and release calendar surface."""
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]


def main()->int:
    failures=[]
    html=(ROOT/'games'/'index.html').read_text(encoding='utf-8')
    js=(ROOT/'assets'/'games-directory.js').read_text(encoding='utf-8')
    css=(ROOT/'assets'/'games-directory.css').read_text(encoding='utf-8')
    for marker in ('https://www.neuralcritic.net/games/','id="release-calendar"','id="games-grid"','data-games-view="upcoming"','data-games-view="scored"'):
        if marker not in html: failures.append(f'games/index.html missing {marker}')
    for marker in ("client.from('games')","client.from('game_releases')",'games_directory_view','games_directory_click','release_calendar','gameUrl'):
        if marker not in js: failures.append(f'assets/games-directory.js missing {marker}')
    for marker in ('.nc-games-grid','.nc-release-calendar-list','.nc-games-filter-row'):
        if marker not in css: failures.append(f'assets/games-directory.css missing {marker}')
    if 'game.html?slug=' in js: failures.append('Games Directory links regress to legacy game.html?slug= URLs')

    completeness_checks={
        'Games Directory completeness JS remains cache-pinned': 'assets/games-directory.js?v=20260904-complete1' in html,
        'Games Directory light-theme CSS is cache-pinned': 'assets/games-directory.css?v=20260904-lightfix1' in html,
        'no-cover games use text-first cards': "hasCover?'has-cover':'is-text-only'" in js and '.nc-game-library-card.is-text-only' in css,
        'directory does not render branded fake cover placeholders': 'nc-game-card-fallback' not in js,
        'scores remain visible on text-first cards': 'nc-game-card-score-inline' in js and '.nc-game-card-score-inline' in css,
        'platform chips have explicit ownership': 'nc-game-card-platforms' in js and '.nc-game-card-platforms' in css,
        'same-game same-date releases are grouped': 'function upcomingReleaseGroups()' in js and "const key=[r.game_id,r.release_date,r.status||'',r.region||''].join('|')" in js,
        'grouped release cards list verified platforms': "platforms.join(' · ')" in js,
        'real cover images remain supported': 'g.cover_image_url' in js and '<img src=' in js,
        'responsive directory layout remains present': '@media(max-width:980px)' in css and '@media(max-width:720px)' in css and '@media(max-width:520px)' in css,
        'reduced-motion contract remains present': '@media(prefers-reduced-motion:reduce)' in css,
        'light-mode cards use a light readable surface': 'html[data-theme="light"] body.nc-games-directory-page .nc-game-library-card' in css and 'var(--nc-light-text,#171b22)!important' in css,
        'light-mode filters use readable light controls': 'html[data-theme="light"] body.nc-games-directory-page .nc-games-filter-row input' in css and 'color-scheme:light' in css and 'var(--nc-light-white,#fff)!important' in css,
        'light-mode platform chips own foreground and background contrast': 'html[data-theme="light"] body.nc-games-directory-page .nc-game-card-platforms span' in css and 'var(--nc-light-text-soft,#303944)!important' in css,
        'image score overlays stay readable in light mode': '.nc-game-library-card.has-cover .nc-game-card-score{color:#f7f8ff!important}' in css,
        'light-mode focus visibility remains explicit': '.nc-games-filter-row input:focus-visible' in css and 'outline:2px solid var(--accent,#8c7cff)' in css,
    }
    for name,ok in completeness_checks.items():
        if not ok: failures.append(name)

    if failures:
        print('Games Directory audit failed:')
        for item in failures: print(' -',item)
        return 1
    print('Games Directory audit passed: canonical links, verified release grouping, text-first sparse cards, light-mode contrast, filters, responsive behavior and analytics are wired.')
    return 0

if __name__=='__main__': raise SystemExit(main())
