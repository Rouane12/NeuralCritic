#!/usr/bin/env python3
"""Audit the public Games Directory and release calendar surface."""
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]


def main()->int:
    failures=[]
    html=(ROOT/'games'/'index.html').read_text(encoding='utf-8')
    js=(ROOT/'assets'/'games-directory.js').read_text(encoding='utf-8')
    css=(ROOT/'assets'/'games-directory.css').read_text(encoding='utf-8')
    phase2=(ROOT/'assets'/'games-directory-phase2.css').read_text(encoding='utf-8') if (ROOT/'assets'/'games-directory-phase2.css').exists() else ''
    for marker in ('https://www.neuralcritic.net/games/','id="featured-games"','id="release-calendar"','id="games-grid"','id="games-sort"','data-games-view="featured"','data-games-view="upcoming"','data-games-view="scored"'):
        if marker not in html: failures.append(f'games/index.html missing {marker}')
    for marker in ("client.from('games')","client.from('game_releases')",'games_directory_view','games_directory_click','games_directory_sort_change','renderFeatured()','coverageCount(g)','release_calendar','gameUrl'):
        if marker not in js: failures.append(f'assets/games-directory.js missing {marker}')
    for marker in ('.nc-games-grid','.nc-release-calendar-list','.nc-games-filter-row'):
        if marker not in css: failures.append(f'assets/games-directory.css missing {marker}')
    for marker in ('.nc-games-featured-grid','.nc-game-card-coverage','@media(max-width:620px)','html[data-theme="light"] body.nc-games-directory-page'):
        if marker not in phase2: failures.append(f'assets/games-directory-phase2.css missing {marker}')
    if 'game.html?slug=' in js: failures.append('Games Directory links regress to legacy game.html?slug= URLs')

    completeness_checks={
        'Games Directory discovery JS is cache-pinned': 'assets/games-directory.js?v=20260912-discovery1' in html,
        'Games Directory Phase 2 CSS is cache-pinned': 'assets/games-directory-phase2.css?v=20260912-discovery1' in html,
        'Games Directory light-theme base CSS remains cache-pinned': 'assets/games-directory.css?v=20260904-lightfix1' in html,
        'all games use consistent text-first cards': 'nc-game-library-card is-text-only' in js and '.nc-game-library-card.is-text-only' in css,
        'directory does not render branded fake cover placeholders': 'nc-game-card-fallback' not in js,
        'directory does not switch to image-heavy cards when cover art exists': 'cover_image_url' not in js and 'nc-game-card-media' not in js,
        'scores remain visible on text-first cards': 'nc-game-card-score-inline' in js and '.nc-game-card-score-inline' in css,
        'platform chips have explicit ownership': 'nc-game-card-platforms' in js and '.nc-game-card-platforms' in css,
        'coverage counts support editorial discovery': 'nc-game-card-coverage' in js and "sortMode==='coverage'" in js,
        'featured games use CMS curation': 'games.filter(g=>g.featured)' in js,
        'same-game same-date releases are grouped': 'function upcomingReleaseGroups()' in js and "const key=[r.game_id,r.release_date,r.status||'',r.region||''].join('|')" in js,
        'grouped release cards list verified platforms': "platforms.join(' · ')" in js,
        'responsive directory layout remains present': '@media(max-width:980px)' in css and '@media(max-width:720px)' in css and '@media(max-width:520px)' in css,
        'reduced-motion contract remains present': '@media(prefers-reduced-motion:reduce)' in css,
        'light-mode cards use a light readable surface': 'html[data-theme="light"] body.nc-games-directory-page .nc-game-library-card' in css and 'var(--nc-light-text,#171b22)!important' in css,
        'light-mode filters use readable light controls': 'html[data-theme="light"] body.nc-games-directory-page .nc-games-filter-row input' in css and 'color-scheme:light' in css and 'var(--nc-light-white,#fff)!important' in css,
        'light-mode control placeholders and options remain readable': '.nc-games-filter-row input::placeholder{color:var(--nc-light-faint,#87919c)!important}' in css and '.nc-games-filter-row select option{background:#fff;color:#171b22}' in css,
        'light-mode platform chips own foreground and background contrast': 'html[data-theme="light"] body.nc-games-directory-page .nc-game-card-platforms span' in css and 'var(--nc-light-text-soft,#303944)!important' in css,
        'light-mode focus visibility remains explicit': '.nc-games-filter-row input:focus-visible' in css and 'outline:2px solid var(--accent,#8c7cff)' in css,
    }
    for name,ok in completeness_checks.items():
        if not ok: failures.append(name)

    if failures:
        print('Games Directory audit failed:')
        for item in failures: print(' -',item)
        return 1
    print('Games Directory audit passed: featured curation, coverage-aware sorting, canonical links, verified release grouping, text-first cards, light-mode contrast, filters, responsive behavior and analytics are wired.')
    return 0

if __name__=='__main__': raise SystemExit(main())
