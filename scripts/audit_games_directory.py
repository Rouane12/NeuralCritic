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
    if failures:
        print('Games Directory audit failed:')
        for item in failures: print(' -',item)
        return 1
    print('Games Directory audit passed: canonical game links, release calendar, filters and analytics are wired.')
    return 0

if __name__=='__main__': raise SystemExit(main())
