#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = name => fs.readFileSync(path.join(root, 'assets', name), 'utf8');
const tests = [];
const test = (name, run) => tests.push({ name, run });
const now = Date.parse('2026-09-24T12:00:00Z');
class Clock extends Date { static now() { return now; } }
const discoveryContext = { window: {}, document: { getElementById: () => null }, Date: Clock, URL, console };
vm.runInNewContext(source('discovery-intelligence.js'), discoveryContext);
const engine = discoveryContext.window.NeuralCriticDiscovery;
const article = (slug, options = {}) => ({ slug, title: slug, category: 'NEWS', publishedAt: '2026-09-24T08:00:00Z', ...options });

test('Search excludes unrelated high-volume hubs, retains partial matches and browse mode', () => {
  const rows = [article('elden-review', { gameKey: 'Elden Ring', series: 'Elden Ring' }),
    ...Array.from({ length: 30 }, (_, i) => article('zelda-' + i, { gameKey: 'Zelda' }))];
  const matches = engine.search(rows, 'Elden Ring').entities;
  assert.ok(matches.length > 0);
  assert.ok(matches.every(item => (item.entity || item).name === 'Elden Ring'));
  assert.equal(engine.search(rows, 'no such game').entities.length, 0);
  assert.ok(engine.search(rows, 'elden').entities.length > 0);
  assert.ok(engine.search(rows, '', 'games').entities.length > 0);
});
test('Stale breaking/manual lead expires even after a metadata update', () => {
  const old = article('old', { publishedAt: '2026-09-09T10:00:00Z', updatedAt: '2026-09-24T11:00:00Z', homepageSlot: 'lead', newsMeta: { kind: 'breaking', developing: true } });
  const recent = article('new');
  assert.equal(engine.homepageProgram([old, recent]).lead.slug, 'new');
  assert.equal(engine.isFreshDevelopingNews(old), false);
  assert.equal(engine.isFreshDevelopingNews(article('urgent', { newsMeta: { kind: 'breaking', developing: true } })), true);
});
test('Fresh manual slots remain authoritative without duplicate placements', () => {
  const rows = [article('lead', { homepageSlot: 'lead' }), article('top', { homepageSlot: 'secondary-top' }), article('bottom', { homepageSlot: 'secondary-bottom' }), article('latest')];
  const program = engine.homepageProgram(rows);
  assert.equal(program.lead.slug, 'lead');
  assert.deepEqual(Array.from(program.secondaries, a => a.slug), ['top', 'bottom']);
  assert.equal(new Set(program.featuredSlugs).size, 3);
});

function contentContext({ live = [], fallback = [], detail = null, delay = 0, offline = false } = {}) {
  const calls = { cms: 0, paths: [] };
  const query = () => {
    const q = { select: () => q, eq: () => q, lte: () => q, order: () => q, maybeSingle: () => q,
      then(resolve, reject) { calls.cms++; return new Promise(done => setTimeout(() => done({ data: live, error: null }), delay)).then(resolve, reject); } };
    return q;
  };
  const document = { readyState: 'loading', querySelector: () => null, querySelectorAll: () => [], getElementById: () => null,
    createElement: () => ({ dataset: {} }), head: { appendChild() {} }, addEventListener() {} };
  const context = { window: null, document, location: new URL('https://www.neuralcritic.net/index.html'), URL, URLSearchParams, Response, console: { warn() {} }, setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {},
    fetch: async input => { calls.paths.push(input); return new Response(JSON.stringify(input === 'data/articles.json' ? fallback : input === 'data/repository-articles.json' ? [] : detail), { status: detail || !input.startsWith('data/articles/') ? 200 : 404 }); },
    NEURAL_CRITIC_SUPABASE: { url: 'https://example.invalid', publishableKey: 'test' },
    supabase: offline ? undefined : { createClient: () => ({ from: query }) } };
  context.window = context;
  vm.runInNewContext(source('content-api.js'), context);
  return { api: context.NeuralCriticContentAPI, calls };
}
test('Missing/invalid scores remain unscored; explicit zero is valid', () => {
  const { api } = contentContext();
  for (const value of [null, undefined, '', ' ', false, true, NaN, Infinity, -1, 11, 'oops']) assert.equal(api.normalizeScore(value), null);
  assert.equal(api.normalizeScore(0), 0);
  assert.equal(api.normalizeScore('9.6'), 9.6);
});
test('Matching published review is the score authority on game surfaces', () => {
  const { api } = contentContext();
  const game = { slug: 'breath-of-the-wild', title: 'Breath of the Wild', neural_critic_score: 7, score_article_slug: 'news' };
  const review = article('review', { articleFormat: 'review', gameKey: game.title, reviewMeta: { score: 9.6 } });
  const result = api.resolveGameReview(game, [article('news', { gameKey: game.title }), review]);
  assert.equal(result.score, 9.6);
  assert.equal(result.slug, 'review');
  assert.equal(api.resolveGameReview({ ...game, neural_critic_score: null }, []).score, null);
});
test('Concurrent and repeated index readers share one CMS/static request set', async () => {
  const { api, calls } = contentContext({ fallback: [article('static')], live: [{ slug: 'live', published_at: '2026-09-24' }] });
  const [a, b] = await Promise.all([api.publishedIndex(), api.publishedIndex()]);
  assert.equal(a, b);
  assert.equal(a[0].slug, 'static');
  assert.ok(a.some(row => row.slug === 'live'));
  await api.publishedIndex();
  assert.equal(calls.cms, 1);
  assert.equal(calls.paths.filter(x => x === 'data/articles.json').length, 1);
});
test('Slow CMS does not delay a valid generated index or direct story', async () => {
  const { api } = contentContext({ delay: 1500, fallback: [article('static')], detail: article('detail') });
  const started = Date.now();
  const [rows, story] = await Promise.all([api.publishedIndex(), api.publishedArticle('detail')]);
  assert.equal(rows[0].slug, 'static');
  assert.equal(story.slug, 'detail');
  assert.ok(Date.now() - started < 1000, 'valid static content must not wait for the CMS timeout');
});
test('Generated stories still load if the Supabase SDK is unavailable', async () => {
  const { api } = contentContext({ offline: true, fallback: [article('static')] });
  assert.ok(api);
  assert.equal((await api.publishedIndex())[0].slug, 'static');
});

test('Publication desks reuse the shared index without mutating its order', async () => {
  const rows = [article('first'), article('second')];
  let calls = 0;
  const context = { window: { NeuralCriticContentAPI: { publishedIndex: async () => { calls++; return rows; } } } };
  const nav = source('publication-nav.js');
  vm.runInNewContext(nav.slice(0, nav.lastIndexOf("  if(document.body.classList.contains('studio-body'))")) +
    '  window.loadDeskIndex=loadTaxonomyArticles;\n})();', context);
  const loaded = await context.window.loadDeskIndex();
  assert.equal(calls, 1);
  assert.equal(loaded[0], rows[0]);
  loaded.reverse();
  assert.equal(rows[0].slug, 'first');
});

test('Hero markup prioritizes the lead and defers supporting images before insertion', () => {
  const host = { innerHTML: '' };
  const context = { window: { addEventListener() {} }, document: { getElementById: () => host }, Intl, Date };
  const app = source('app.js').replace(/init\(\)\.catch\(error=>console\.error\('Neural Critic initialization failed\.',error\)\);/, '');
  vm.runInNewContext(app, context);
  context.rows = [article('lead', { imageLocal: 'lead.webp' }), article('support', { imageLocal: 'support.webp', homepageSlot: 'secondary-top' })];
  vm.runInNewContext('ARTICLES=rows;renderHero();', context);
  const images = [...host.innerHTML.matchAll(/<img\b[^>]*>/g)].map(match => match[0]);
  assert.equal(images.length, 2);
  assert.match(images[0], /loading="eager"/);
  assert.match(images[0], /fetchpriority="high"/);
  assert.match(images[1], /loading="lazy"/);
  assert.doesNotMatch(images[1], /fetchpriority="high"/);
});

test('Quick Read renders authored takeaways and omits repeated deck text', () => {
  const context = { window: {}, document: {} };
  // Expose this renderer inside its existing closure without starting page bootstrap.
  vm.runInNewContext(source('article-extras.js').replace('  init();\n})();', '  window.renderSummary = addQuickRead;\n})();'), context);
  let markup = '';
  const body = { querySelector: () => null, insertAdjacentHTML: (_, html) => { markup += html; } };
  context.window.renderSummary({ description: 'The standfirst.', quickRead: [] }, body);
  assert.equal(markup, '');
  context.window.renderSummary({ description: 'The standfirst.', quickRead: ['The standfirst.', 'Upgrade your weapon first.', 'Upgrade your weapon first.', ''] }, body);
  assert.ok(markup.includes('<li>Upgrade your weapon first.</li>'));
  assert.equal((markup.match(/<li>/g) || []).length, 1);
  assert.ok(!markup.includes('The standfirst.'));
});

test('Conclusion labels preserve authored copy without claiming a universal verdict', () => {
  const context = { window: { NEURAL_CRITIC_STATIC_SLUG: 'test' }, document: {}, URLSearchParams, location: { search: '' } };
  vm.runInNewContext(source('article-conclusion.js').replace('  init();\n})();', '  window.renderConclusion = apply;\n})();'), context);
  const section = { dataset: {}, querySelector: () => null };
  context.window.renderConclusion({ article_format: 'review', conclusion: 'Mystery makes quests hard to follow.', conclusion_heading: 'Mystery and frustration' }, {}, section);
  assert.ok(section.innerHTML.includes('REVIEW CONCLUSION'));
  assert.ok(section.innerHTML.includes('Mystery and frustration'));
  assert.ok(!section.innerHTML.includes('FINAL VERDICT'));
  context.window.renderConclusion({ article_format: 'game-guide', conclusion: 'Keep exploring.' }, {}, section);
  assert.ok(section.innerHTML.includes('TAKEAWAYS'));
});

test('Article lead media keeps the cinematic scale while prose remains constrained', () => {
  const css = source('article-layout-recovery.css');
  assert.match(css, /aspect-ratio:16\/8\.25!important/);
  assert.match(css, /max-height:none!important/);
  assert.doesNotMatch(css, /max-height:440px!important/);
});

test('Desktop publication navigation restores hover motion and hover-open menus', () => {
  const css = source('publication-nav.css');
  assert.match(css, /\(hover:hover\) and \(pointer:fine\)/);
  assert.match(css, /transform:translateY\(-2px\)/);
  assert.match(css, /\.publication-nav \.nav-group:hover>\.nav-menu/);
});

test('Reader Auth V2 owns a bounded signed-in profile editor', () => {
  const css = source('reader-auth-v2.css');
  assert.match(css, /\.reader-profile-editor\{/);
  assert.match(css, /max-width:58px!important/);
  assert.match(css, /\.reader-profile-avatar-actions/);
  assert.match(css, /\.reader-profile-save/);
});

test('Article like writes are verified instead of failing silently', () => {
  const runtime = source('community-core.js');
  assert.match(runtime, /async function articleLikeState/);
  assert.match(runtime, /if\(error\)throw error/);
  assert.match(runtime, /Like state was not persisted/);
  assert.match(runtime, /neuralcritic:article-like-changed/);
  assert.match(runtime, /Like could not be saved\. Click to retry\./);
});

(async () => {
  let failures = 0;
  for (const { name, run } of tests) {
    try { await run(); console.log('PASS', name); }
    catch (error) { failures++; console.error('FAIL', name, '\n ', error.message); }
  }
  process.exitCode = failures ? 1 : 0;
})();
