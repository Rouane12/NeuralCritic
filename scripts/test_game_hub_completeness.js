#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const template = read('game.html');
const polish = read('assets/game-page-completeness.css');
const runtime = read('assets/game-page.js');

const checks = [
  ['template loads completeness stylesheet', template.includes('assets/game-page-completeness.css?v=20260904-complete1')],
  ['unverified cover placeholder is hidden', polish.includes('.nc-game-cover:not(:has(img)){display:none}')],
  ['hero expands when no verified cover exists', polish.includes('.nc-game-hero:not(:has(.nc-game-cover img)){grid-template-columns:minmax(0,1fr)}')],
  ['empty platform-release placeholder is hidden', polish.includes('#game-releases:has(> .nc-game-empty){display:none}')],
  ['real cover art still renders through established runtime', runtime.includes('if (game.cover_image_url)') && runtime.includes('game.cover_image_alt')],
  ['top-level verified release facts remain visible', runtime.includes("['Release', game.primary_release_date") && runtime.includes("['Platforms', (game.platforms || []).join(' · ')")],
  ['no fabricated release fallback added', !polish.includes('TBA') && !polish.includes('Coming soon')]
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (!ok) failed += 1;
}

if (failed) {
  console.error(`Game Hub completeness regression failed: ${failed}/${checks.length} checks.`);
  process.exit(1);
}
console.log(`Game Hub completeness regression passed: ${checks.length}/${checks.length} checks.`);
