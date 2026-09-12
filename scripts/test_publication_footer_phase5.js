#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const runtime = read('assets/article-footer-v2.js');
const css = read('assets/article-footer-v2.css');
const weekly = read('assets/article-weekly-drop-v2.js');
const article = read('article.html');

const checks = [];
const check = (name, condition, detail = '') => checks.push({ name, ok:Boolean(condition), detail });

check(
  'Phase 4 sequences the cache-pinned Phase 5 footer runtime',
  weekly.includes("assets/article-footer-v2.js?v=20260912-footer1") &&
    weekly.includes("script.dataset.ncArticleFooterV2 = '1'") &&
    weekly.includes('loadPublicationFooter();'),
  'the final article step should load after the already-established Weekly Drop bootstrap'
);

check(
  'Phase 5 self-loads a cache-pinned stylesheet',
  runtime.includes("assets/article-footer-v2.css?v=20260912-footer1") &&
    runtime.includes("link.dataset.ncArticleFooterV2 = '1'") &&
    css.includes('Article Experience 2.0 Phase 5'),
  'the footer runtime and presentation should version together'
);

check(
  'the existing shared footer remains the single DOM owner',
  runtime.includes("document.getElementById('shared-footer')") &&
    runtime.includes("host.querySelector('footer')") &&
    runtime.includes("footer.dataset.ncFooterV2 = '1'") &&
    !runtime.includes('document.body.appendChild(footer)') &&
    !runtime.includes('document.body.insertAdjacentHTML'),
  'Phase 5 should upgrade the shared footer rather than append a competing footer'
);

check(
  'Weekly Drop remains the only article subscription conversion surface',
  weekly.includes('data-newsletter data-band-newsletter') &&
    !runtime.includes('type="email"') &&
    !runtime.includes('data-newsletter') &&
    !runtime.includes('subscribe'),
  'the footer should close the journey with discovery and trust, not another signup form'
);

check(
  'publication identity and trust destinations are explicit',
  runtime.includes('INDEPENDENT GAMING PUBLICATION') &&
    runtime.includes('Independent editorial coverage') &&
    runtime.includes('/about.html') &&
    runtime.includes('/standards.html') &&
    runtime.includes('/commercial.html') &&
    runtime.includes('/privacy.html') &&
    runtime.includes('/about.html#contact'),
  'the footer should make ownership, standards and policy paths easy to find'
);

check(
  'footer discovery links are canonical root-relative destinations',
  runtime.includes('href="/category.html?section=news"') &&
    runtime.includes('href="/category.html?section=reviews"') &&
    runtime.includes('href="/category.html?section=guides"') &&
    runtime.includes('href="/category.html?section=features"') &&
    runtime.includes('href="/category.html?section=what-to-play"') &&
    runtime.includes('href="/games/"') &&
    runtime.includes('href="/search.html"') &&
    runtime.includes('href="/feed.xml"'),
  'canonical /stories/<slug>/ readers must not inherit broken story-relative footer links'
);

check(
  'Back to top is an accessible progressive enhancement',
  runtime.includes('type="button" class="nc-footer-top" data-footer-top') &&
    runtime.includes("matchMedia?.('(prefers-reduced-motion: reduce)')") &&
    runtime.includes("window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' })"),
  'the article closer should offer a keyboard-safe return path and respect reduced motion'
);

check(
  'footer analytics extend the existing article journey',
  runtime.includes("NeuralCriticAnalytics?.track?.('publication_footer_view'") &&
    runtime.includes("NeuralCriticAnalytics?.track?.('publication_footer_navigate'") &&
    runtime.includes("NeuralCriticAnalytics?.track?.('publication_footer_back_to_top'") &&
    runtime.includes('source_slug: slug ||'),
  'completion and onward-navigation signals should retain story attribution'
);

check(
  'article architecture still places the shared footer after the article journey',
  article.indexOf('<main class="article-page" id="article"></main>') < article.indexOf('<div id="shared-footer"></div>') &&
    weekly.includes("$('.work-newsletter-band')") &&
    runtime.includes("document.getElementById('shared-footer')"),
  'the DOM should remain Article → journey modules → shared publication footer'
);

check(
  'desktop footer uses the same 1180px publication canvas',
  css.includes('width:min(1180px,calc(100% - 40px))') &&
    css.includes('grid-template-columns:minmax(260px,.9fr) minmax(0,1.6fr)') &&
    css.includes('grid-template-columns:repeat(3,minmax(0,1fr))'),
  'the footer should align with Thread, Continue Exploring and Weekly Drop instead of shrinking back to legacy geometry'
);

check(
  'footer is responsive through narrow mobile widths',
  css.includes('@media(max-width:900px)') &&
    css.includes('@media(max-width:560px)') &&
    css.includes('@media(max-width:340px)') &&
    css.includes('grid-template-columns:1fr 1fr') &&
    css.includes('grid-template-columns:1fr;') &&
    !css.includes('overflow-x:hidden'),
  '390px and 320px-class layouts should reflow instead of masking horizontal overflow'
);

check(
  'footer supports light theme keyboard focus and reduced motion',
  css.includes('html[data-theme="light"] #shared-footer .nc-publication-footer') &&
    css.includes(':focus-visible') &&
    css.includes('@media(prefers-reduced-motion:reduce)') &&
    css.includes('transition:none!important'),
  'the final article step should preserve the accessibility and theme contracts from prior phases'
);

check(
  'footer uses semantic navigation and a dynamic copyright year',
  runtime.includes('<nav class="nc-footer-directory" aria-label="Neural Critic footer navigation">') &&
    runtime.includes('data-footer-year') &&
    runtime.includes('new Date().getFullYear()') &&
    !runtime.includes('© 2026'),
  'the footer should age cleanly and expose a meaningful navigation landmark'
);

const failed = checks.filter(item => !item.ok);
for (const item of checks) {
  console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.name}`);
  if (!item.ok && item.detail) console.log(`  ${item.detail}`);
}

if (failed.length) {
  console.error(`Publication Footer Phase 5 regression suite failed: ${failed.length}/${checks.length} checks.`);
  process.exit(1);
}

console.log(`Publication Footer Phase 5 passed: ${checks.length}/${checks.length} checks.`);
