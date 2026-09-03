#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const index = read('index.html');
const app = read('assets/app.js');
const feed = read('assets/home-feed.js');
const curation = read('assets/home-curation-guard.js');
const whatToPlay = read('assets/home-what-to-play.js');
const popularity = read('assets/popularity-signals.js');
const nav = read('assets/publication-nav.js');
const navCss = read('assets/publication-nav.css');
const homeCss = read('assets/homepage-v2.css');
const accessibility = read('assets/public-accessibility.js');

const checks = [];
const check = (name, condition, detail) => checks.push({ name, ok:Boolean(condition), detail });

const ownerScripts = [
  'assets/content-api.js',
  'assets/app.js',
  'assets/home-feed.js',
  'assets/home-commerce.js',
  'assets/publication-nav.js',
  'assets/home-what-to-play.js',
  'assets/public-accessibility.js'
];
check(
  'established homepage owners remain included once',
  ownerScripts.every(file => index.split(file).length - 1 === 1),
  ownerScripts.join(', ')
);

const order = ['id="hero"', 'id="news"', 'id="reviews"', 'id="home-what-to-play"', 'id="home-commerce"'].map(token => index.indexOf(token));
check(
  'homepage hierarchy follows the Milestone 5 contract',
  order.every(position => position >= 0) && order.every((position, i) => i === 0 || position > order[i - 1]),
  order.join(' < ')
);

const coreDestinations = [
  "group('news','News'",
  "group('reviews','Reviews'",
  "group('guides','Guides'",
  "section:'features'",
  "group('what-to-play','What to Play'",
  'href="games/"'
];
check(
  'six primary publication destinations are direct anchors',
  coreDestinations.every(token => nav.includes(token)) && nav.includes('class="nav-primary"') && nav.includes('class="nav-direct"'),
  'News, Reviews, Guides, Features, What to Play, Games'
);

check(
  'dropdown and mobile accordion semantics stay with publication-nav',
  nav.includes('class="nav-trigger"') && nav.includes('aria-expanded="false"') && nav.includes("event.key!=='Escape'") && navCss.includes('body.mobile-nav-open header .publication-nav'),
  'direct link + separate disclosure button + Escape handling'
);

check(
  'homepage cards retain canonical story URLs',
  app.includes('`stories/${encodeURIComponent(a.slug)}/`') && curation.includes('`stories/${encodeURIComponent(slugOf(article))}/`') && !curation.includes('article.html?slug='),
  '/stories/<slug>/'
);

check(
  'adjacent homepage modules honor visible-story de-duplication',
  feed.includes('NeuralCriticHomepageState.feedSlugs') &&
    app.includes('function homepageReservedSlugs()') &&
    app.includes('reviews.find(x=>!reserved.has(x.slug))') &&
    app.includes('guides.filter(a=>!reserved.has(a.slug))') &&
    app.includes("window.addEventListener('neuralcritic:homepage-feed-rendered',()=>{renderTrending();renderReview();renderGuides();});") &&
    whatToPlay.includes('NeuralCriticHomepageState?.feedSlugs') &&
    whatToPlay.includes("window.addEventListener('neuralcritic:homepage-feed-rendered'") &&
    popularity.includes('NeuralCriticHomepageState?.feedSlugs'),
  'Hero, visible Latest, Trending/Most Read, Reviews, Guides, and What to Play stay distinct when alternatives exist'
);

check(
  'homepage feed filters render through their established owner',
  feed.includes("const nextFilter = filterButton.dataset.filter || 'latest';") && feed.includes('renderFeed(nextFilter);') && !app.includes("document.querySelectorAll('.filters button')"),
  'one filter interaction owner in assets/home-feed.js'
);

check(
  'responsive hierarchy and focus-visible contracts are present',
  ['@media(max-width:1180px)', '@media(max-width:980px)', '@media(max-width:700px)', '@media(max-width:460px)'].every(token => homeCss.includes(token)) && navCss.includes('@media(max-width:980px)') && homeCss.includes('body.nc-home-v2:has(#hero) #reviews.home-service-desk') && navCss.includes('.publication-nav .nav-group.open>.nav-menu') && !navCss.includes('.nav-group:hover>.nav-menu') && !navCss.includes('.nav-group:focus-within>.nav-menu') && !homeCss.includes('overflow-x:hidden'),
  'wide, desktop/intermediate, tablet/mobile, narrow'
);

check(
  'mobile homepage keeps the lead, cards, filters, and entry points usable',
  homeCss.includes('body.nc-home-v2 .hero{grid-template-columns:1fr!important;height:auto!important}') &&
    homeCss.includes('body.nc-home-v2 .content{grid-template-columns:1fr!important') &&
    homeCss.includes('body.nc-home-v2 .features{grid-template-columns:1fr!important}') &&
    homeCss.includes('body.nc-home-v2 .filters{width:100%;overflow-x:auto') &&
    homeCss.includes('body.nc-home-v2 .home-wtp-explore nav{grid-template-columns:1fr}') &&
    !homeCss.includes('body.nc-home-v2 .lead p{display:none'),
  'single-column hierarchy with an intentionally scrollable filter row'
);

check(
  'mobile navigation owns its drawer, scrolling, disclosure, and touch targets',
  navCss.includes('body.mobile-nav-open') &&
    navCss.includes('max-height:min(67dvh,560px)!important') &&
    navCss.includes('overflow:auto!important') &&
    navCss.includes('grid-template-columns:minmax(0,1fr) 46px!important') &&
    navCss.includes('min-height:46px!important') &&
    navCss.includes('width:40px!important;height:40px!important') &&
    nav.includes("event.key!=='Escape'") &&
    nav.includes("setAttribute('aria-expanded'") &&
    app.includes("document.body.classList.toggle('mobile-nav-open')") &&
    accessibility.includes("closeMobileNav({focus:true})") &&
    accessibility.includes("menu.setAttribute('aria-expanded'"),
  'fixed publication drawer, accordion state, Escape, and body scroll lock'
);

check(
  'homepage landmarks and headings are explicit',
  index.includes('aria-label="Top stories"') && index.includes('aria-label="Latest and popular coverage"') && index.includes('aria-labelledby="home-service-title"') && app.includes('<h1 id="home-lead-title">'),
  'one story H1 plus named modules'
);

const failed = checks.filter(item => !item.ok);
for (const item of checks) {
  console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.name}`);
  if (!item.ok && item.detail) console.log(`  ${item.detail}`);
}

if (failed.length) {
  console.error(`Homepage/navigation regression suite failed: ${failed.length}/${checks.length} checks.`);
  process.exit(1);
}

console.log(`Homepage/navigation regression suite passed: ${checks.length}/${checks.length} checks.`);