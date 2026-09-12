#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const runtime = read('assets/article-weekly-drop-v2.js');
const css = read('assets/article-weekly-drop-v2.css');
const article = read('article.html');
const extras = read('assets/article-extras.js');
const recirculation = read('assets/recirculation.js');

const checks = [];
const check = (name, condition, detail = '') => checks.push({ name, ok:Boolean(condition), detail });

check(
  'article bootstrap loads the Phase 4 runtime after the legacy article extras owner',
  article.includes('assets/article-weekly-drop-v2.js?v=20260912-weeklydrop1') &&
    article.indexOf('assets/article-extras.js?v=20260824-runtime1') < article.indexOf('assets/article-weekly-drop-v2.js?v=20260912-weeklydrop1'),
  'Phase 4 must enhance the existing article ending instead of racing its markup owner'
);

check(
  'Phase 4 self-loads a cache-pinned stylesheet',
  runtime.includes("assets/article-weekly-drop-v2.css?v=20260912-weeklydrop1") &&
    runtime.includes("style.dataset.ncWeeklyDropV2 = '1'") &&
    css.includes('Article Experience 2.0 Phase 4'),
  'the redesign should arrive as one cache-safe article runtime'
);

check(
  'the existing full-width Weekly Drop band remains the only article subscription moment',
  runtime.includes("$$('.work-weekly-card').forEach(card => card.remove())") &&
    runtime.includes("$('.work-newsletter-band')") &&
    runtime.includes("band.classList.add('nc-weekly-drop-v2')"),
  'sidebar and hidden duplicate cards must not compete with the final conversion surface'
);

check(
  'Weekly Drop communicates a concrete editorial product',
  runtime.includes('The week in games, distilled.') &&
    runtime.includes('BIGGEST STORIES') &&
    runtime.includes("EDITOR'S PICKS") &&
    runtime.includes('WHAT TO PLAY') &&
    runtime.includes('EVERY FRIDAY'),
  'the CTA should explain what readers receive rather than behave like a generic email box'
);

check(
  'signup keeps the existing hardened newsletter owner',
  runtime.includes('data-newsletter data-band-newsletter') &&
    runtime.includes('data-newsletter-source=') &&
    runtime.includes("const source = slug ? `article:${slug}` : 'article'") &&
    !runtime.includes('fetch(') &&
    !runtime.includes(".rpc("),
  'Phase 4 may present the form, but must not create a second subscription backend'
);

check(
  'canonical article identity is preserved in newsletter attribution',
  runtime.includes('window.NEURAL_CRITIC_STATIC_SLUG') &&
    runtime.includes("location.pathname.match(/\\/stories\\/([^/]+)\\/?$/i)") &&
    runtime.includes('data-newsletter-source'),
  'canonical /stories/<slug>/ readers should still be attributed to the story'
);

check(
  'email capture has accessible and browser-friendly controls',
  runtime.includes('label class="nc-visually-hidden"') &&
    runtime.includes('autocomplete="email"') &&
    runtime.includes('inputmode="email"') &&
    runtime.includes('aria-describedby="weekly-drop-note"') &&
    runtime.includes('type="submit"'),
  'the compact form still needs an accessible name and mobile-friendly email input'
);

check(
  'article journey remains Thread then Continue Exploring then Weekly Drop',
  extras.indexOf('work-bottom-grid') < extras.indexOf('work-newsletter-band') &&
    recirculation.includes("insertionPoint.insertAdjacentElement('afterend', module)") &&
    runtime.includes("$('.work-newsletter-band')"),
  'Continue Exploring should be inserted after the Thread container while Weekly Drop upgrades the following band'
);

check(
  'Phase 4 extends existing analytics rather than replacing newsletter conversion tracking',
  runtime.includes("NeuralCriticAnalytics?.track?.('weekly_drop_view'") &&
    runtime.includes("NeuralCriticAnalytics?.track?.('weekly_drop_form_focus'") &&
    runtime.includes("window.addEventListener('neuralcritic:newsletter-subscribed'"),
  'impression and intent signals complement the existing newsletter signup event'
);

check(
  'desktop presentation is a deliberate split conversion module',
  css.includes('grid-template-columns:minmax(0,1.15fr) minmax(340px,.85fr)') &&
    css.includes('width:min(1180px,calc(100% - 40px))') &&
    css.includes('.nc-weekly-drop-signup'),
  'the end-of-article CTA should align with the 1180px Thread and Continue Exploring canvas'
);

check(
  'Weekly Drop is responsive through narrow mobile widths',
  css.includes('@media(max-width:900px)') &&
    css.includes('@media(max-width:560px)') &&
    css.includes('@media(max-width:340px)') &&
    css.includes('.nc-weekly-drop-form-row{grid-template-columns:1fr}'),
  'the form must stack cleanly at 390px and 320px-class widths'
);

check(
  'Weekly Drop has light theme focus and reduced-motion treatment',
  css.includes('html[data-theme="light"]') &&
    css.includes('input:focus') &&
    css.includes('button:focus-visible') &&
    css.includes('@media(prefers-reduced-motion:reduce)') &&
    !css.includes('overflow-x:hidden'),
  'visual polish must not rely on page-level overflow masking or motion'
);

const failed = checks.filter(item => !item.ok);
for (const item of checks) {
  console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.name}`);
  if (!item.ok && item.detail) console.log(`  ${item.detail}`);
}
if (failed.length) {
  console.error(`Weekly Drop Phase 4 regression suite failed: ${failed.length}/${checks.length} checks.`);
  process.exit(1);
}
console.log(`Weekly Drop Phase 4 passed: ${checks.length}/${checks.length} checks.`);
