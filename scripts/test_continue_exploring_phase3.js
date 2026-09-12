#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const runtime = read('assets/recirculation.js');
const css = read('assets/recirculation.css');
const article = read('article.html');
const contentApi = read('assets/content-api.js');
const engine = read('assets/discovery-intelligence.js');

const checks = [];
const check = (name, ok) => checks.push([name, Boolean(ok)]);

check('Continue Exploring keeps Discovery Intelligence as the only scorer',
  runtime.includes('engine.related(current, index, Math.min(12') &&
  engine.includes('function relatedScore(') &&
  !runtime.includes('function relatedScore('));
check('journey selection prefers same game then series or franchise',
  runtime.includes("item?.relation?.key === 'same_game'") &&
  runtime.includes("['same_series','same_franchise'].includes(item?.relation?.key)"));
check('third slot deliberately broadens beyond core game relationships',
  runtime.includes("!['same_game','same_series','same_franchise'].includes(item?.relation?.key)"));
check('current story and duplicate picks are guarded',
  runtime.includes('const seen = new Set([current.slug])') && runtime.includes('seen.has(item.article.slug)'));
check('Continue Exploring has a clear editorial identity',
  runtime.includes("module.className = 'nc-recirculation nc-continue-exploring'") &&
  runtime.includes('>Continue exploring</h2>') &&
  runtime.includes('More from this game, its world, and what matters next.'));
check('cards expose relationship labels and canonical story URLs',
  runtime.includes("return new URL(`stories/${encodeURIComponent(slug)}/`, SITE_ROOT).href") &&
  runtime.includes("return 'SAME GAME'") && runtime.includes("return 'SAME SERIES'") && runtime.includes("return 'SAME FRANCHISE'"));
check('after-thread Game Hub and topic Hub journey remains intact',
  runtime.includes("destination:'game_hub'") && runtime.includes("destination:'topic_hub'") && runtime.includes('OPEN GAME HUB →'));
check('recirculation analytics retain the established event owner with surface and slot context',
  runtime.includes("NeuralCriticAnalytics?.track?.('recirculation_click'") &&
  runtime.includes("surface:'continue_exploring'") && runtime.includes('recommendation_slot:'));
check('desktop presentation is a compact three-card row',
  css.includes('grid-template-columns:repeat(3,minmax(0,1fr))') && css.includes('min-height:338px'));
check('Continue Exploring is responsive and theme-aware',
  css.includes('@media(max-width:960px)') && css.includes('@media(max-width:680px)') &&
  css.includes('html[data-theme="dark"] .nc-continue-exploring') && css.includes('@media(prefers-reduced-motion:reduce)'));
check('article bootstrap pins Phase 3 recirculation assets ahead of content API fallback',
  article.includes('assets/recirculation.css?v=20260912-continue1') &&
  article.includes('assets/recirculation.js?v=20260912-continue1') &&
  article.indexOf('assets/recirculation.js?v=20260912-continue1') < article.indexOf('assets/content-api.js?v=20260903-articlejourney1'));
check('content API keeps the existing fallback owner for non-article bootstrap compatibility',
  contentApi.includes("recirculationStyle.href = 'assets/recirculation.css?v=20260828-discovery2'") &&
  contentApi.includes("recirculation.src = 'assets/recirculation.js?v=20260903-articlejourney1'"));

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (!ok) failed++;
}
if (failed) {
  console.error(`Continue Exploring Phase 3 failed: ${failed}/${checks.length} checks.`);
  process.exit(1);
}
console.log(`Continue Exploring Phase 3 passed: ${checks.length}/${checks.length} checks.`);
