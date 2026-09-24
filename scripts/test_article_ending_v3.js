#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const article = read('article.html');
const extras = read('assets/article-extras.js');
const core = read('assets/community-core.js');
const likes = read('assets/article-likes.js');
const profile = read('assets/community-profile.js');
const recirculation = read('assets/recirculation.js');
const layoutV5 = read('assets/article-news-layout-v5.css');

const checks = [];
const check = (name, ok) => checks.push([name, Boolean(ok)]);

check('article shell no longer loads Reader Thread runtimes',
  !article.includes('assets/community-stable.js') &&
  !article.includes('assets/community-thread-recovery.js') &&
  !article.includes('assets/community-actions-v2.js'));

check('article shell no longer loads Reader Thread stable stylesheet',
  !article.includes('assets/community-stable.css'));

check('article action rail keeps Like, Follow and Share without Discuss',
  extras.includes('data-article-like') &&
  extras.includes('data-article-follow') &&
  extras.includes('data-article-share') &&
  !extras.includes('data-article-discuss'));

check('article extras no longer render a comment thread',
  !extras.includes('reader-thread') &&
  !extras.includes('article-thread') &&
  !extras.includes('data-thread-form') &&
  !extras.includes('JOIN DISCUSSION'));

check('article ending retains the Weekly Drop CTA',
  extras.includes('work-newsletter-band') &&
  extras.includes('Finished here? Keep the good reads coming.'));

check('reader account runtime no longer waits for comments or owns Likes',
  !core.includes("waitFor('#reader-thread')") &&
  !core.includes('neuralCriticRecoverThread') &&
  !core.includes("waitFor('[data-article-like]')") &&
  article.includes('assets/article-likes.js') &&
  likes.includes('[data-article-like]'));

check('reader account copy reflects reactions and follows, not commenting',
  core.includes('Sign in to like stories and follow writers across Neural Critic.') &&
  !core.includes('Sign in to comment'));

check('reader profile runtime no longer loads comment action code',
  !profile.includes('community-actions-v2.js') &&
  !profile.includes("from('article_comments')") &&
  !profile.includes('neuralcritic:thread-recovered'));

check('Continue Exploring anchors to the reading experience',
  recirculation.includes("const find = () => $('.work-reading-grid') || $('#article .article-body');") &&
  recirculation.includes("placement:'after_article'") &&
  recirculation.includes("module.dataset.placement = 'after-article'"));

check('active article layout no longer imports thread-only CSS',
  !layoutV5.includes('article-thread-spacing-v2.css') &&
  !layoutV5.includes('article-thread-experience-v2.css'));

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (!ok) failed++;
}
if (failed) {
  console.error(`Article ending retirement check failed: ${failed}/${checks.length} checks.`);
  process.exit(1);
}
console.log(`Article ending retirement check passed: ${checks.length}/${checks.length} checks.`);
