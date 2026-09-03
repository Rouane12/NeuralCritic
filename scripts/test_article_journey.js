#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const articleDiscovery = read('assets/article-discovery.js');
const recirculation = read('assets/recirculation.js');
const discoveryCss = read('assets/discovery-intelligence.css');
const discoveryEngine = read('assets/discovery-intelligence.js');

const checks = [];
const check = (name, condition, detail = '') => checks.push({ name, ok:Boolean(condition), detail });

check(
  'mapped article context resolves through the existing public Games Database',
  articleDiscovery.includes("window.neuralCriticPublicSupabase") &&
    articleDiscovery.includes("client.from('games')") &&
    articleDiscovery.includes(".select('slug,title,release_status,platforms,primary_release_date')") &&
    articleDiscovery.includes(".eq('slug',gameSlug)") &&
    !articleDiscovery.includes("from('reader_entity_follows')"),
  'read-only games lookup only; no new persistence owner'
);

check(
  'mapped games link to canonical Game Hub URLs',
  articleDiscovery.includes('games/${encodeURIComponent(gameSlug)}/') &&
    articleDiscovery.includes('data-discovery-destination="game_hub"') &&
    articleDiscovery.includes('OPEN GAME HUB') &&
    articleDiscovery.includes('trail.dataset.gameHubSlug=game.slug'),
  '/games/<slug>/ is the mapped-game destination'
);

check(
  'unmapped games retain the existing topic-hub fallback',
  articleDiscovery.includes("if (!game) add('GAME',article.gameKey)") &&
    recirculation.includes("topicUrl('game', game)") &&
    recirculation.includes("destination:'topic_hub'"),
  'no fake /games/ route is created for an unmapped gameKey'
);

check(
  'article context publishes one shared game-context signal for recirculation',
  articleDiscovery.includes('window.NeuralCriticArticleGameContext=detail') &&
    articleDiscovery.includes('window.NeuralCriticArticleGameContextReady=true') &&
    articleDiscovery.includes("new CustomEvent('neuralcritic:article-game-context-ready'") &&
    recirculation.includes('waitForArticleGameContext'),
  'recirculation consumes article-discovery context instead of making a second games query'
);

check(
  'after-thread exploration prefers a mapped Game Hub',
  recirculation.includes('if (gameContext?.href && gameContext?.slug)') &&
    recirculation.includes("destination:'game_hub'") &&
    recirculation.includes("? 'OPEN GAME HUB →'") &&
    recirculation.includes('data-recirc-hub-destination='),
  'mapped Game Hub wins before relation/topic fallback'
);

check(
  'existing Discovery Intelligence remains the recommendation owner',
  articleDiscovery.includes('engine.related(current,all,3)') &&
    recirculation.includes('engine.related(current, index, 3)') &&
    discoveryEngine.includes('function relatedScore(') &&
    !articleDiscovery.includes('function relatedScore(') &&
    !recirculation.includes('function relatedScore('),
  'no duplicate recommendation scorer'
);

check(
  'article recirculation still emits canonical story URLs',
  articleDiscovery.includes('stories/${encodeURIComponent(storySlug)}/') &&
    recirculation.includes('stories/${encodeURIComponent(slug)}/') &&
    !articleDiscovery.includes('href="article.html?slug=') &&
    !recirculation.includes('href="article.html?slug='),
  'reader-journey cards preserve /stories/<slug>/'
);

check(
  'series franchise and author exploration remain canonical existing hubs',
  articleDiscovery.includes("add('SERIES',article.series)") &&
    articleDiscovery.includes("add('FRANCHISE',article.franchise)") &&
    articleDiscovery.includes("add('AUTHOR',article.author)") &&
    recirculation.includes("topicUrl('series', series)") &&
    recirculation.includes("topicUrl('franchise', franchise)"),
  'Game Hub upgrade does not replace existing taxonomy hubs'
);

check(
  'Article Journey analytics extend existing event owners',
  articleDiscovery.includes("NeuralCriticAnalytics?.track?.('connected_coverage_click'") &&
    articleDiscovery.includes("destination:entityLink.dataset.discoveryDestination") &&
    recirculation.includes("NeuralCriticAnalytics?.track?.('recirculation_hub_click'") &&
    recirculation.includes("destination:hub.dataset.recircHubDestination"),
  'no second analytics implementation'
);

check(
  'mapped Game Hub context has responsive light dark and keyboard presentation',
  discoveryCss.includes('.nc-article-graph-trail.has-game-hub') &&
    discoveryCss.includes('.nc-article-game-hub') &&
    discoveryCss.includes('a:focus-visible') &&
    discoveryCss.includes('html[data-theme="light"] #article .nc-article-graph-trail.has-game-hub') &&
    discoveryCss.includes('@media(max-width:760px)') &&
    discoveryCss.includes('@media(prefers-reduced-motion:reduce)') &&
    !discoveryCss.includes('overflow-x:hidden'),
  'no page-level overflow masking'
);

const failed = checks.filter(item => !item.ok);
for (const item of checks) {
  console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.name}`);
  if (!item.ok && item.detail) console.log(`  ${item.detail}`);
}
if (failed.length) {
  console.error(`Article Journey regression suite failed: ${failed.length}/${checks.length} checks.`);
  process.exit(1);
}
console.log(`Article Journey regression suite passed: ${checks.length}/${checks.length} checks.`);
