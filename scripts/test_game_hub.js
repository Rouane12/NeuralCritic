#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const gameJs = read('assets/game-page.js');
const gameCss = read('assets/game-page.css');
const followJs = read('assets/entity-follows-v2.js');
const template = read('game.html');
const builder = read('scripts/build_game_pages.py');
const contentApi = read('assets/content-api.js');

const checks = [];
const check = (name, condition, detail = '') => checks.push({ name, ok:Boolean(condition), detail });

check(
  'Game Hub reuses the established Game Graph ranking owner',
  gameJs.includes('engine.related(graphSeed(game), articles') &&
    gameJs.includes("new Set(['same_game','same_series','same_franchise','shared_topic'])") &&
    !gameJs.includes('recommendationScore'),
  'NeuralCriticDiscovery.related() remains the ranking owner'
);

check(
  'same-game coverage uses structured game identity',
  gameJs.includes('article?.gameKey || article?.game_key') &&
    gameJs.includes('sameGame(article, game)') &&
    !gameJs.includes('title.includes('),
  'gameKey/game_key, not headline keyword matching'
);

check(
  'coverage views are Latest Reviews Guides and Deals with explicit states',
  ['latest','reviews','guides','deals'].every(view => gameJs.includes(`'${view}'`)) &&
    gameJs.includes('data-game-view=') &&
    gameJs.includes('aria-pressed') &&
    gameJs.includes('No verified offers right now.') &&
    gameJs.includes('No ${esc(state.view)} coverage yet.'),
  'button group with counts and empty states'
);

check(
  'review feature uses real review metadata and canonical story links',
  gameJs.includes('game.score_article_slug') &&
    gameJs.includes('review.reviewMeta || review.review_meta') &&
    gameJs.includes('meta.verdict || review.description') &&
    gameJs.includes('storyUrl(review.slug)') &&
    !gameJs.includes('Metacritic'),
  'mapped Neural Critic review only'
);

check(
  'commerce is game-mapped and verified-offer gated',
  gameJs.includes(".eq('game_id', game.id)") &&
    gameJs.includes(".eq('active', true)") &&
    gameJs.includes("['in_stock','preorder','backorder']") &&
    gameJs.includes('offer.expires_at') &&
    gameJs.includes('affiliate_url') &&
    gameJs.includes('rel="sponsored noopener noreferrer"'),
  'existing commerce tables, active products/retailers, current eligible offers'
);

check(
  'existing entity-follow owner is loaded rather than reimplemented',
  gameJs.includes('assets/entity-follows-v2.js?v=20260903-gamehub2') &&
    followJs.includes("const TABLE = 'reader_entity_follows'") &&
    !gameJs.includes("from('reader_entity_follows')"),
  'game page loads entity-follows-v2.js and contains no duplicate follow persistence'
);

check(
  'article to game journey remains owned by Game Graph content identity',
  contentApi.includes('gameKey: row.game_key ||') &&
    gameJs.includes("topicUrl('series', game.series)") &&
    gameJs.includes("topicUrl('franchise', game.franchise)"),
  'structured game/series/franchise identities are preserved'
);

check(
  'canonical game shell generator remains the SEO owner',
  builder.includes('"@type": "VideoGame"') &&
    builder.includes('"@type": "BreadcrumbList"') &&
    builder.includes('rel=\\"canonical\\"') === false &&
    builder.includes('<link rel="canonical" href=') &&
    builder.includes('window.NEURAL_CRITIC_STATIC_GAME_SLUG') &&
    template.includes('id="game-page"'),
  '/games/<slug>/ canonical, VideoGame schema, Breadcrumb schema'
);

const generatedRoot = path.join(root, 'games');
const generated = fs.existsSync(generatedRoot)
  ? fs.readdirSync(generatedRoot, { withFileTypes:true })
      .filter(entry => entry.isDirectory())
      .map(entry => path.join('games', entry.name, 'index.html'))
      .filter(file => fs.existsSync(path.join(root, file)))
  : [];

check('generated game shells exist', generated.length > 0, `${generated.length} generated game pages`);
check(
  'generated game shells preserve canonical/schema/runtime ownership',
  generated.length > 0 && generated.every(file => {
    const html = read(file);
    return html.includes('generated: neural-critic-game-shell') &&
      html.includes('rel="canonical"') &&
      html.includes('"@type":"VideoGame"') &&
      html.includes('"@type":"BreadcrumbList"') &&
      (html.match(/assets\/game-page\.js/g) || []).length === 1;
  }),
  'every generated game page is canonical and loads the game runtime once'
);

check(
  'responsive Game Hub contract covers desktop tablet and narrow mobile',
  gameCss.includes('@media(max-width:980px)') &&
    gameCss.includes('@media(max-width:820px)') &&
    gameCss.includes('@media(max-width:560px)') &&
    gameCss.includes('.nc-game-coverage-nav{grid-template-columns:repeat(2,minmax(0,1fr))}') &&
    !gameCss.includes('overflow-x:hidden'),
  'no page-level overflow suppression'
);

check(
  'Game Hub interactions use the existing analytics owner',
  gameJs.includes("NeuralCriticAnalytics?.track?.('game_hub_view_change'") &&
    gameJs.includes("NeuralCriticAnalytics?.track?.('game_hub_review_click'") &&
    gameJs.includes("NeuralCriticAnalytics?.track?.('game_page_recirculation_click'") &&
    gameJs.includes("NeuralCriticAnalytics?.track?.('commerce_offer_click'"),
  'no second analytics implementation'
);

check(
  'game-page listener ownership is single-init guarded',
  gameJs.includes("page.dataset.gameHubWired === '1'") &&
    gameJs.includes("page.dataset.gameHubWired = '1'"),
  'one delegated interaction owner per game page'
);

const failed = checks.filter(item => !item.ok);
for (const item of checks) {
  console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.name}`);
  if (!item.ok && item.detail) console.log(`  ${item.detail}`);
}
if (failed.length) {
  console.error(`Game Hub regression suite failed: ${failed.length}/${checks.length} checks.`);
  process.exit(1);
}
console.log(`Game Hub regression suite passed: ${checks.length}/${checks.length} checks.`);
