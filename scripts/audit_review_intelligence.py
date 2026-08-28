#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
html = (ROOT / 'reviews' / 'index.html').read_text(encoding='utf-8')
js = (ROOT / 'assets' / 'review-intelligence.js').read_text(encoding='utf-8')
css = (ROOT / 'assets' / 'review-intelligence.css').read_text(encoding='utf-8')
sitemap_builder = (ROOT / 'scripts' / 'build_sitemap.py').read_text(encoding='utf-8')

checks = {
    'canonical reviews hub': 'https://www.neuralcritic.net/reviews/' in html,
    'review runtime bootstrapped': 'assets/review-intelligence.js' in html,
    'review styles bootstrapped': 'assets/review-intelligence.css' in html,
    'published review query': "from('articles')" in js and 'review_meta' in js,
    'canonical story links': 'stories/${encodeURIComponent(slug)}/' in js,
    'scoreboard': 'review-scoreboard' in html and 'renderScoreboard' in js,
    'score filtering': "view==='elite'" in js and "view==='recommended'" in js,
    'platform filtering': 'review-platform' in html and 'review-platform' in js,
    'analytics view': 'review_intelligence_view' in js,
    'analytics click': 'review_intelligence_click' in js,
    'sitemap reviews root': '"reviews/"' in sitemap_builder,
    'responsive CSS': '@media(max-width:620px)' in css,
}
failed = [name for name, ok in checks.items() if not ok]
if failed:
    raise SystemExit('Review Intelligence audit failed: ' + ', '.join(failed))
print(f'Review Intelligence V1 audit passed ({len(checks)} checks).')
