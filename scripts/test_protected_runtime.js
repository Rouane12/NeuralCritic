#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');

function source(relative) {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}

class FakeNode {
  constructor(tagName, ownerDocument) {
    this.tagName = String(tagName || '').toUpperCase();
    this.ownerDocument = ownerDocument;
    this.attributes = new Map();
    this.dataset = {};
    this.textContent = '';
    this.id = '';
    this.type = '';
    this.rel = '';
  }

  setAttribute(name, value) {
    const normalized = String(name).toLowerCase();
    const text = String(value);
    this.attributes.set(normalized, text);
    if (normalized === 'id') this.id = text;
    if (normalized === 'rel') this.rel = text;
  }

  getAttribute(name) {
    return this.attributes.get(String(name).toLowerCase()) || '';
  }

  set href(value) {
    const absolute = new URL(String(value), this.ownerDocument.baseURI).href;
    this.attributes.set('href', absolute);
  }

  get href() {
    return this.attributes.get('href') || '';
  }

  remove() {
    const nodes = this.ownerDocument.head.nodes;
    const index = nodes.indexOf(this);
    if (index >= 0) nodes.splice(index, 1);
  }
}

class FakeHead {
  constructor(ownerDocument) {
    this.ownerDocument = ownerDocument;
    this.nodes = [];
  }

  appendChild(node) {
    this.nodes.push(node);
    return node;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    const metaName = selector.match(/^meta\[name="([^"]+)"\]$/);
    if (metaName) {
      return this.nodes.filter(node => node.tagName === 'META' && node.getAttribute('name') === metaName[1]);
    }
    const metaProperty = selector.match(/^meta\[property="([^"]+)"\]$/);
    if (metaProperty) {
      return this.nodes.filter(node => node.tagName === 'META' && node.getAttribute('property') === metaProperty[1]);
    }
    if (selector === 'link[rel="canonical"]') {
      return this.nodes.filter(node => node.tagName === 'LINK' && (node.rel === 'canonical' || node.getAttribute('rel') === 'canonical'));
    }
    return [];
  }
}

class FakeDocument {
  constructor({ url, title, homepage = false }) {
    this.baseURI = url;
    this.title = title;
    this.readyState = 'complete';
    this.homepage = homepage;
    this.head = new FakeHead(this);
    this.documentElement = {};
  }

  createElement(tagName) {
    return new FakeNode(tagName, this);
  }

  getElementById(id) {
    if (this.homepage && (id === 'hero' || id === 'story-feed')) return { id };
    return this.head.nodes.find(node => node.id === id) || null;
  }

  querySelectorAll() {
    return [];
  }

  addEventListener() {}
}

class FakeMutationObserver {
  observe() {}
  disconnect() {}
}

function browserSandbox({ url, title = '', homepage = false }) {
  const document = new FakeDocument({ url, title, homepage });
  const location = new URL(url);
  class Element {}
  class HTMLAnchorElement extends Element {}
  class HTMLImageElement extends Element {}
  class CustomEvent {
    constructor(type, options = {}) {
      this.type = type;
      this.detail = options.detail;
    }
  }

  const sandbox = {
    URL,
    URLSearchParams,
    document,
    location,
    history: { replaceState() {} },
    navigator: { clipboard: { async writeText() {} } },
    performance: { now: () => Date.now() },
    MutationObserver: FakeMutationObserver,
    Element,
    HTMLAnchorElement,
    HTMLImageElement,
    CustomEvent,
    console,
    fetch: async () => ({ ok: false, async json() { return null; } }),
    setTimeout: () => 0,
    clearTimeout() {},
    addEventListener() {},
    dispatchEvent() {},
  };
  sandbox.window = sandbox;
  return sandbox;
}

function runAsset(relative, sandbox) {
  vm.runInNewContext(source(relative), sandbox, { filename: relative });
}

function meta(document, selector) {
  return document.head.querySelector(selector)?.getAttribute('content') || '';
}

async function flushMicrotasks() {
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
}

async function testLegacyCanonicalMetadata() {
  const slug = 'protected-runtime-fixture';
  const canonical = `https://www.neuralcritic.net/stories/${slug}/`;
  const sandbox = browserSandbox({
    url: `https://www.neuralcritic.net/article.html?slug=${slug}`,
    title: 'Story · Neural Critic',
  });
  sandbox.NeuralCriticStoryRouter = {
    storyUrl(value) {
      return value === slug ? canonical : '';
    },
  };
  sandbox.NeuralCriticContentAPI = {
    async publishedArticle(value) {
      assert.equal(value, slug);
      return {
        slug,
        title: 'Protected Runtime Fixture',
        description: 'Deterministic metadata fixture.',
        category: 'NEWS',
        author: 'Neural Critic Test',
        publishedAt: '2026-09-02T00:00:00Z',
        tags: ['Fixture'],
      };
    },
  };

  runAsset('assets/public-hardening.js', sandbox);
  await flushMicrotasks();

  const canonicalLink = sandbox.document.head.querySelector('link[rel="canonical"]')?.href;
  assert.equal(canonicalLink, canonical, 'legacy article canonical must use the clean story route');
  assert.equal(meta(sandbox.document, 'meta[property="og:url"]'), canonical, 'legacy og:url must use the clean story route');

  const articleSchema = JSON.parse(sandbox.document.getElementById('nc-structured-data').textContent);
  const breadcrumbSchema = JSON.parse(sandbox.document.getElementById('nc-breadcrumb-data').textContent);
  assert.equal(articleSchema.url, canonical, 'article schema URL must match the clean canonical');
  assert.equal(articleSchema.mainEntityOfPage['@id'], canonical, 'mainEntityOfPage must match the clean canonical');
  assert.equal(
    breadcrumbSchema.itemListElement.at(-1).item,
    canonical,
    'article breadcrumb identity must match the clean canonical',
  );
}

async function testNestedDirectoryTitles() {
  for (const [route, expectedTitle] of [
    ['/games/', 'Games Database & Release Calendar | Neural Critic'],
    ['/reviews/', 'Reviews & Scores | Neural Critic'],
  ]) {
    const sandbox = browserSandbox({ url: `https://www.neuralcritic.net${route}`, title: expectedTitle });
    runAsset('assets/public-hardening.js', sandbox);
    await flushMicrotasks();
    assert.equal(sandbox.document.title, expectedTitle, `${route} must retain its directory-owned title`);
  }

  const homepage = browserSandbox({
    url: 'https://www.neuralcritic.net/',
    title: 'Initial title',
    homepage: true,
  });
  runAsset('assets/public-hardening.js', homepage);
  assert.equal(
    homepage.document.title,
    'Neural Critic | Gaming Reviews, Features & Guides',
    'homepage hardening must still run on the real homepage surface',
  );
}

function testStoryRouterContract() {
  const slug = 'protected-runtime-fixture';
  const sandbox = browserSandbox({
    url: `https://www.neuralcritic.net/article.html?slug=${slug}`,
    title: 'Protected Runtime Fixture · Neural Critic',
  });

  runAsset('assets/story-router.js', sandbox);
  const contract = sandbox.NeuralCriticStoryRouter;
  assert.ok(contract, 'story-router must publish the canonical route contract');
  assert.equal(
    contract.storyUrl(slug),
    `https://www.neuralcritic.net/stories/${slug}/`,
    'story-router must own clean story URL construction',
  );
  assert.equal(
    sandbox.document.head.querySelector('link[rel="canonical"]')?.href,
    `https://www.neuralcritic.net/stories/${slug}/`,
    'story-router must enforce the clean canonical at runtime',
  );
  assert.equal(
    meta(sandbox.document, 'meta[property="og:url"]'),
    `https://www.neuralcritic.net/stories/${slug}/`,
    'story-router must keep og:url aligned with canonical',
  );
}

function testRouterBeforeHardening() {
  const config = source('assets/supabase-config.js');
  assert.match(
    config,
    /loadStoryRouter\(loadRuntimeHardening\)/,
    'Supabase bootstrap must load the canonical router before runtime hardening',
  );
  assert.match(
    config,
    /const loadRuntimeHardening\s*=\s*\(\)\s*=>/,
    'runtime hardening must have an explicit ordered loader',
  );
  assert.match(
    config,
    /pageName === 'studio\.html' \|\| pageName === 'subscribers\.html'\) \{\s*ready\(\);\s*return;/,
    'private pages must retain hardening even though they intentionally skip Story Router',
  );
}

function testPrivateSupabaseSingleton() {
  let createCount = 0;
  const sandbox = {
    window: null,
    supabase: {
      createClient() {
        createCount += 1;
        return { instance: createCount };
      },
    },
  };
  sandbox.window = sandbox;

  runAsset('assets/supabase-client-config.js', sandbox);
  const first = sandbox.neuralCriticPrivateSupabase;
  runAsset('assets/supabase-client-config.js', sandbox);
  assert.ok(first, 'private bootstrap must create the shared client');
  assert.equal(sandbox.neuralCriticPrivateSupabase, first, 'private bootstrap must preserve its singleton');
  assert.equal(createCount, 1, 'private bootstrap must create exactly one auth client');

  for (const relative of ['assets/newsroom-dashboard.js', 'assets/newsroom-guards.js']) {
    const consumer = source(relative);
    assert.ok(
      consumer.includes('window.neuralCriticPrivateSupabase'),
      `${relative} must consume the private singleton`,
    );
    assert.ok(!consumer.includes('.createClient('), `${relative} must not construct a second auth client`);
  }

  const html = source('newsroom.html');
  const configIndex = html.indexOf('assets/supabase-client-config.js');
  const dashboardIndex = html.indexOf('assets/newsroom-dashboard.js');
  const guardsIndex = html.indexOf('assets/newsroom-guards.js');
  assert.ok(configIndex >= 0 && configIndex < dashboardIndex && dashboardIndex < guardsIndex, 'Newsroom must load the singleton before its consumers');
}

const tests = [
  ['legacy canonical metadata', testLegacyCanonicalMetadata],
  ['nested directory title isolation', testNestedDirectoryTitles],
  ['story-router canonical contract', testStoryRouterContract],
  ['router-before-hardening order', testRouterBeforeHardening],
  ['private Supabase singleton', testPrivateSupabaseSingleton],
];

(async () => {
  const failures = [];
  for (const [name, test] of tests) {
    try {
      await test();
      console.log(`PASS ${name}`);
    } catch (error) {
      failures.push([name, error]);
      console.error(`FAIL ${name}: ${error.message}`);
    }
  }
  if (failures.length) {
    console.error(`Protected runtime regression suite failed: ${failures.length}/${tests.length} checks.`);
    process.exitCode = 1;
    return;
  }
  console.log(`Protected runtime regression suite passed: ${tests.length}/${tests.length} checks.`);
})();
