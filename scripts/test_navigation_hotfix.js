#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const exists = file => fs.existsSync(path.join(root, file));
const checks = [];
const check = (name, condition, detail='') => checks.push({name, ok:Boolean(condition), detail});

const css = read('assets/navigation-responsive-hotfix.css');
const canonical = read('assets/navigation-canonical-hotfix.js');
const stamp = read('scripts/stamp_navigation_assets.py');

check(
  'intermediate desktop range has an explicit collision guard',
  css.includes('@media (min-width:981px) and (max-width:1279px)') &&
    css.includes('grid-template-columns:minmax(140px,auto) minmax(0,1fr) max-content!important') &&
    css.includes('.publication-nav{gap:4px!important}') &&
    css.includes('.theme-toggle small{display:none!important}'),
  '981–1279px keeps brand, nav, and utilities in bounded columns'
);

check(
  'narrow desktop compacts account chrome instead of hiding navigation',
  css.includes('@media (min-width:981px) and (max-width:1080px)') &&
    css.includes('.reader-account-button.signed-in [data-reader-account-label]{display:none!important}') &&
    !css.includes('overflow-x:hidden'),
  'mobile drawer boundary remains 980px and no horizontal-overflow masking is introduced'
);

check(
  'legacy Review and Guide fallbacks canonicalize without touching other desks',
  canonical.includes("section === 'review' || section === 'reviews'") &&
    canonical.includes("section === 'guide' || section === 'guides'") &&
    canonical.includes("return `${desk}/${platform ? `?platform=${encodeURIComponent(platform)}` : ''}`;") &&
    canonical.includes('MutationObserver'),
  '/reviews/ and /guides/ preserve optional platform filters'
);

check(
  'asset stamping uses content hashes and is idempotent',
  stamp.includes("hashlib.sha256(path.read_bytes()).hexdigest()[:12]") &&
    stamp.includes('navigation-responsive-hotfix.css') &&
    stamp.includes('navigation-canonical-hotfix.js') &&
    stamp.includes('Remove previous hotfix mounts first') &&
    stamp.includes("ROOT.rglob('*.html')"),
  'shared nav CSS/JS and hotfix mounts are refreshed across owned HTML shells'
);

const representative = [
  'index.html',
  'article.html',
  'category.html',
  'game.html',
  'topic.html',
  'author.html',
  'search.html',
  'reviews/index.html',
  'guides/index.html',
  'games/index.html',
  'stories/intergalactic-heretic-prophet-wraps-cinematic-shoot/index.html'
].filter(exists);

const hashQuery = /assets\/publication-nav\.(?:css|js)\?v=[a-f0-9]{12}/;
check(
  'representative public shells receive fresh hashed navigation assets',
  representative.length >= 10 && representative.every(file => {
    const html = read(file);
    const hashed = html.match(new RegExp(hashQuery.source, 'g')) || [];
    return hashed.length >= 2 &&
      html.includes('assets/navigation-responsive-hotfix.css?v=') &&
      html.includes('assets/navigation-canonical-hotfix.js?v=');
  }),
  representative.join(', ')
);

const failed = checks.filter(item => !item.ok);
for (const item of checks) {
  console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.name}`);
  if (!item.ok && item.detail) console.log(`  ${item.detail}`);
}
if (failed.length) {
  console.error(`Navigation hotfix regression suite failed: ${failed.length}/${checks.length} checks.`);
  process.exit(1);
}
console.log(`Navigation hotfix regression suite passed: ${checks.length}/${checks.length} checks.`);
