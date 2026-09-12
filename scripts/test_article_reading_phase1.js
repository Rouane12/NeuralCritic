#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const phase1 = read('assets/article-reading-experience-v2.css');
const layoutV5 = read('assets/article-news-layout-v5.css');
const rail = read('assets/article-rail-spacing.css');
const formatting = read('assets/article-formatting.css');

const checks = [];
const check = (name, ok) => checks.push([name, Boolean(ok)]);

check('Phase 1 stylesheet is loaded through the existing article layout owner',
  layoutV5.includes('@import url("article-reading-experience-v2.css?v=20260912-phase1")'));
check('desktop prose returns from 780px expansion to requested 715px 110% canvas',
  rail.includes('minmax(0,780px)') && phase1.includes('minmax(0,715px)'));
check('desktop grid shrinks with the prose instead of leaving a dead outer canvas',
  phase1.includes('width:min(1167px,100%)') && phase1.includes('column-gap:26px'));
check('reaction rail keeps its existing 124px design while moving closer to prose',
  rail.includes('width:124px!important') && phase1.includes('justify-self:end!important'));
check('article typography sizes are not rewritten by Phase 1',
  formatting.includes('--nc-section-size:42px') && formatting.includes('--nc-body-size:16.5px') && !/font-size\s*:/i.test(phase1));
check('paragraph rhythm is tightened without changing content structure',
  phase1.includes('margin-bottom:22px!important'));
check('section rhythm is tightened',
  phase1.includes('margin-bottom:44px!important') && phase1.includes('margin-top:42px!important') && phase1.includes('margin-bottom:18px!important'));
check('supporting image rhythm is tightened',
  phase1.includes('margin-top:26px!important') && phase1.includes('margin-bottom:40px!important'));
check('intermediate desktop avoids falling back to the old 1240px geometry',
  phase1.includes('@media (min-width:1181px) and (max-width:1239px)') && phase1.includes('grid-template-columns:116px minmax(0,1fr) 250px'));
check('mobile keeps its one-column system and only receives rhythm refinement',
  phase1.includes('@media (max-width:720px)') && !phase1.includes('grid-template-columns:1fr!important'));
check('special review/detail/conclusion modules remain excluded from generic section rhythm',
  phase1.includes(':not(.review-box):not(.review-details):not(.article-conclusion)'));

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (!ok) failed++;
}
if (failed) {
  console.error(`Article Reading Experience Phase 1 failed: ${failed}/${checks.length} checks.`);
  process.exit(1);
}
console.log(`Article Reading Experience Phase 1 passed: ${checks.length}/${checks.length} checks.`);
