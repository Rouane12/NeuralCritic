#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const slug = 'cyberpunk-2077-beginners-guide';
const canonical = `https://www.neuralcritic.net/stories/${slug}/`;
const html = fs.readFileSync(path.join(root, 'stories', slug, 'index.html'), 'utf8');
const bootstrap = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
  .map(match => match[1]).find(source => source.includes('window.NEURAL_CRITIC_STATIC_SLUG='));
const generated = execFileSync('python3', ['-c',
  'import sys; sys.path.insert(0,"scripts"); import build_story_pages as b; print(b.metadata_markup({"slug":"' + slug + '","title":"Story"}))'
], { cwd: root, encoding: 'utf8' });
const generatedBootstrap = [...generated.matchAll(/<script>([\s\S]*?)<\/script>/g)]
  .map(match => match[1]).find(source => source.includes('window.NEURAL_CRITIC_STATIC_SLUG='));
assert.equal(bootstrap, generatedBootstrap, 'Checked-in shell must match the future publication builder');
const analytics = fs.readFileSync(path.join(root, 'assets/analytics.js'), 'utf8');
const campaign = '?utm_source=reddit&utm_medium=social&utm_campaign=nc_readership_01&utm_content=beginner_tip&utm_id=nc_r01';

async function measure(url, { shell = false, consent = 'denied', restoreBeforeAnalytics = false } = {}) {
  const scripts = [];
  const context = {
    URL, URLSearchParams, console,
    location: new URL(url),
    navigator: {},
    performance: { now: () => 0 },
    localStorage: { getItem: () => consent, setItem() { throw new Error('Attribution must not create storage'); } },
    setTimeout: () => 0, clearTimeout() {},
    addEventListener() {}, removeEventListener() {},
    MutationObserver: class { observe() {} disconnect() {} },
    document: {
      title: 'Cyberpunk guide · Neural Critic', baseURI: 'https://www.neuralcritic.net/', readyState: 'loading',
      documentElement: {}, addEventListener() {},
      querySelectorAll: () => [], getElementById: () => null,
      querySelector: selector => selector.includes('canonical') ? { href: canonical } : null,
      createElement: () => ({ dataset: {} }),
      head: { querySelector: () => ({ href: canonical }), appendChild: node => scripts.push(node) }
    },
    NEURAL_CRITIC_ANALYTICS: { measurementId: 'G-TEST12345' },
    NeuralCriticContentAPI: { publishedArticle: async () => ({ slug, title: 'Cyberpunk guide', category: 'GUIDE' }) }
  };
  context.window = context;
  context.history = { replaceState: (_, __, value) => { context.location = new URL(value, context.location); } };
  vm.createContext(context);
  if (shell) vm.runInContext(bootstrap, context);
  if (restoreBeforeAnalytics) context.location = new URL(canonical);
  vm.runInContext(analytics, context);
  // Resolve the article-context and initial-measurement promise chain.
  for (let i = 0; i < 8; i++) await Promise.resolve();
  const calls = Array.from(context.dataLayer, args => Array.from(args));
  return { context, scripts, calls, config: calls.find(args => args[0] === 'config')?.[2] };
}

(async () => {
  const tagged = await measure(canonical + campaign + '#builds', { shell: true });
  assert.equal(tagged.config.campaign_source, 'reddit', 'Generated story bootstrap must retain campaign source');
  assert.equal(tagged.config.campaign_medium, 'social');
  assert.equal(tagged.config.campaign_name, 'nc_readership_01');
  assert.equal(tagged.config.campaign_content, 'beginner_tip');
  assert.equal(tagged.config.campaign_id, 'nc_r01');
  assert.equal(tagged.context.location.hash, '#builds');
  const page = tagged.calls.find(args => args[0] === 'event' && args[1] === 'page_view');
  assert.equal(page[2].page_location, canonical);
  assert.equal(page[2].page_path, `/stories/${slug}/`);
  assert.equal(tagged.calls.filter(args => args[1] === 'page_view').length, 1);
  assert.equal(tagged.calls.filter(args => args[1] === 'article_view').length, 1);
  console.log('PASS: tagged story retains campaign with one canonical page/article event');

  const restored = await measure(canonical + campaign, { shell: true, restoreBeforeAnalytics: true });
  assert.equal(restored.config.campaign_source, 'reddit');
  console.log('PASS: attribution survives early canonical restoration');

  const legacy = await measure(`https://www.neuralcritic.net/article.html?slug=${slug}&${campaign.slice(1)}`);
  const home = await measure('https://www.neuralcritic.net/index.html' + campaign);
  assert.equal(legacy.config.campaign_name, 'nc_readership_01');
  assert.equal(home.config.campaign_name, 'nc_readership_01');
  console.log('PASS: legacy article and homepage campaign entry points');

  const clean = await measure(canonical, { shell: true });
  assert.ok(!Object.keys(clean.config).some(key => key.startsWith('campaign_')));
  const unsafe = await measure(canonical + '?utm_source=person%40example.com&utm_medium=social&utm_campaign=' + 'x'.repeat(101) + '&email=secret%40example.com&search=private&utm_term=private', { shell: true });
  assert.equal(unsafe.config.campaign_source, undefined);
  assert.equal(unsafe.config.campaign_name, undefined);
  assert.equal(unsafe.config.campaign_term, undefined);
  assert.ok(!JSON.stringify(unsafe.calls).includes('secret'));
  assert.ok(!JSON.stringify(unsafe.calls).includes('private'));
  assert.ok(!JSON.stringify(unsafe.context.NEURAL_CRITIC_ENTRY_CAMPAIGN).includes('example.com'));
  console.log('PASS: untagged visits stay untagged; unsupported, oversized and unsafe labels are excluded');

  assert.equal(tagged.calls[0][0], 'consent');
  assert.equal(tagged.calls[0][2].analytics_storage, 'denied');
  assert.equal(tagged.config.allow_google_signals, false);
  assert.equal(tagged.config.allow_ad_personalization_signals, false);
  const granted = await measure(canonical + campaign, { shell: true, consent: 'granted' });
  assert.ok(granted.calls.some(args => args[0] === 'consent' && args[1] === 'update' && args[2].analytics_storage === 'granted'));
  const studio = await measure('https://www.neuralcritic.net/studio.html' + campaign);
  assert.equal(studio.config, undefined);
  assert.equal(studio.scripts.length, 0);
  console.log('PASS: denied/granted consent and private-page exclusion remain intact');
})().catch(error => { console.error(error); process.exitCode = 1; });
