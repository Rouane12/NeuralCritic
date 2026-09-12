#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const phase2 = read('assets/article-thread-experience-v2.css');
const layoutV5 = read('assets/article-news-layout-v5.css');
const spacingV2 = read('assets/article-thread-spacing-v2.css');
const article = read('article.html');
const recovery = read('assets/community-thread-recovery.js');

const checks = [];
const check = (name, ok) => checks.push([name, Boolean(ok)]);

check('Phase 2 Thread stylesheet loads after Phase 1 reading canvas',
  layoutV5.indexOf('article-reading-experience-v2.css?v=20260912-phase1') < layoutV5.indexOf('article-thread-experience-v2.css?v=20260912-phase2'));
check('discussion canvas tightens from legacy 1120px to 980px',
  spacingV2.includes('width:min(1120px') && phase2.includes('width:min(980px,calc(100% - 72px))'));
check('sort controls default hidden and appear only for real comments',
  phase2.includes('#reader-thread .standard-sort-row') && phase2.includes('display:none!important') && phase2.includes(':has(.community-comment[data-comment-id]) .standard-sort-row'));
check('zero-comment state is distinguished structurally rather than by copied text',
  phase2.includes('.community-empty:has(b)') && recovery.includes('<div class="community-empty"><b>0</b><strong>Be the first voice</strong>'));
check('empty Thread composer collapses its trailing spacing',
  phase2.includes(':has([data-thread-list] .community-empty b) form[data-thread-form]') && phase2.includes('margin-bottom:9px!important'));
check('loading and unavailable Thread states remain compact',
  phase2.includes('.community-loading') && phase2.includes('.community-empty:not(:has(b))') && phase2.includes('padding:11px 4px 2px!important'));
check('existing community action runtimes remain loaded',
  article.includes('assets/community-stable.js') && article.includes('assets/community-thread-recovery.js') && article.includes('assets/community-actions-v2.js'));
check('Phase 2 does not replace comment behavior with a second JS owner',
  !fs.existsSync(path.join(root, 'assets/article-thread-experience-v2.js')));
check('light-theme Thread contracts exist',
  phase2.includes('html[data-theme="light"] #reader-thread.article-thread.standard-thread') && phase2.includes('background:linear-gradient(180deg,#ffffff 0%,#fbfcfd 100%)'));
check('desktop composer focus treatment exists',
  phase2.includes('form[data-thread-form]:focus-within') && phase2.includes('border-color:rgba(85,231,255,.45)'));
check('mobile gutters and compact shell are explicitly protected',
  phase2.includes('@media(max-width:900px)') && phase2.includes('@media(max-width:620px)') && phase2.includes('width:min(100% - 24px,980px)'));

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (!ok) failed++;
}
if (failed) {
  console.error(`Article Thread Phase 2 failed: ${failed}/${checks.length} checks.`);
  process.exit(1);
}
console.log(`Article Thread Phase 2 passed: ${checks.length}/${checks.length} checks.`);
