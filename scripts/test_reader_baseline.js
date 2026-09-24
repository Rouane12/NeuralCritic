#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function source(relative) {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}

function testFlexibleArticleGrid() {
  const css = source('assets/article-sidebar-interactive.css');
  assert.match(
    css,
    /grid-template-columns:minmax\(108px,var\(--nc-reference-rail\)\) minmax\(0,var\(--nc-reference-copy\)\) minmax\(280px,var\(--nc-reference-sidebar\)\)!important;/,
    'desktop article tracks must be shrinkable beneath the 1240px reference width',
  );
  assert.doesNotMatch(
    css,
    /overflow-x\s*:\s*hidden/i,
    'the article fix must not hide page-level horizontal overflow',
  );
}

function testImageViewerFocusOwnership() {
  const viewer = source('assets/image-viewer.js');
  const viewerCss = source('assets/image-viewer.css');
  assert.match(viewer, /let opener=null;/, 'image viewer must retain its invoking control');
  assert.match(viewer, /opener=img;/, 'image viewer must record the image used to open it');
  assert.match(
    viewer,
    /const returnTarget=opener;[\s\S]*?returnTarget\?\.isConnected\) returnTarget\.focus\(\{preventScroll:true\}\);/,
    'every shared image-viewer close path must restore focus to a connected opener',
  );
  assert.match(
    viewerCss,
    /\.image-viewer-top,\.image-viewer-stage,\.image-viewer-footer\{box-sizing:border-box;width:100%;min-width:0;\}/,
    'viewer rows must stay inside the fixed viewport when public desktop scale is active',
  );
}

function testSearchFocusOwnership() {
  const accessibility = source('assets/public-accessibility.js');
  assert.match(
    accessibility,
    /lastSearchTrigger\?\.isConnected \? lastSearchTrigger : qs\('\.header-tools \.search'\)/,
    'search focus restoration must fall back to the current header trigger',
  );
  assert.match(
    accessibility,
    /if \(!isOpen && wasOpen\) setTimeout\(restoreSearchFocus, 0\);/,
    'search close restoration must not depend on a throttled animation frame',
  );
  assert.match(
    accessibility,
    /if \(event\.target\.closest\?\.\('\.search-close'\)\) \{\s*setTimeout\(\(\) => \{ syncSearchDialog\(\); restoreSearchFocus\(\); \}, 0\);/,
    'pointer and programmatic Close paths must schedule prompt trigger restoration',
  );
}

function testSignedOutAuthorFollowDefault() {
  const extras = source('assets/article-extras.js');
  const community = source('assets/community-core.js');
  assert.doesNotMatch(
    extras,
    /class="active" data-article-follow|data-author-follow>FOLLOWING/,
    'article markup must not claim a signed-out author follow',
  );
  assert.match(extras, /data-article-follow><b>★<\/b><small>FOLLOW<\/small>/);
  assert.match(extras, /data-author-follow>FOLLOW<\/button>/);

  const neutralState = community.indexOf("button.setAttribute('aria-pressed','false')");
  const sessionGuard = community.indexOf("if(!session?.user||!buttons.length)return", neutralState);
  assert.ok(neutralState >= 0, 'community owner must set a neutral signed-out follow state');
  assert.ok(sessionGuard > neutralState, 'neutral follow state must be applied before the signed-out return');
}

function testArticleLikeOwnership() {
  const controller = source('assets/article-likes.js');
  const extras = source('assets/article-extras.js');
  const community = source('assets/community-core.js');
  const shell = source('article.html');

  assert.match(shell, /assets\/article-likes\.js\?v=20260924-likes1/, 'article shell must load the dedicated Like owner');
  assert.doesNotMatch(extras, /neural-critic-article-like:/, 'article extras must not keep a localStorage Like shadow state');
  assert.doesNotMatch(community, /from\('article_reactions'\)/, 'community core must not compete for article Like writes');
  assert.match(controller, /function candidateClients\(\)/, 'Like owner must resolve the active reader client');
  assert.match(controller, /sb\.auth\.getUser\(\)/, 'Like owner must verify the authenticated user on the chosen client');
  assert.match(controller, /existing\.cloneNode\(true\)/, 'Like owner must remove stale cached click handlers before binding');
  assert.match(controller, /Article Like write could not be verified\./, 'Like writes must be re-read and verified');
  assert.match(controller, /state === 'error' \? 'RETRY'/, 'Like failures must surface a visible retry state');
  assert.match(controller, /story_liked/, 'Like changes must emit the established analytics signal');
}

const tests = [
  ['flexible desktop article grid', testFlexibleArticleGrid],
  ['image-viewer focus ownership', testImageViewerFocusOwnership],
  ['search focus ownership', testSearchFocusOwnership],
  ['signed-out author-follow default', testSignedOutAuthorFollowDefault],
  ['dedicated article-like ownership', testArticleLikeOwnership],
];

const failures = [];
for (const [name, test] of tests) {
  try {
    test();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures.push([name, error]);
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

if (failures.length) {
  console.error(`Reader baseline regression suite failed: ${failures.length}/${tests.length} checks.`);
  process.exitCode = 1;
} else {
  console.log(`Reader baseline regression suite passed: ${tests.length}/${tests.length} checks.`);
}
