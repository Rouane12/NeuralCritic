#!/usr/bin/env node
'use strict';
const fs=require('fs');const path=require('path');const root=path.resolve(__dirname,'..');const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const template=read('topic.html');const js=read('assets/topic-hub-phase3.js');const css=read('assets/topic-hub-phase3.css');const builder=read('scripts/build_topic_pages.py');
const checks=[];const check=(name,ok)=>checks.push([name,Boolean(ok)]);
check('template loads Phase 3 topic assets',template.includes('assets/topic-hub-phase3.css?v=20260912-retention1')&&template.includes('assets/topic-hub-phase3.js?v=20260912-retention1'));
check('template owns Start Here and local navigation hosts',template.includes('id="topic-start-here-panel"')&&template.includes('id="topic-local-nav"')&&template.includes('id="topic-coverage-controls"'));
check('Phase 3 uses existing published content source',js.includes('NeuralCriticContentAPI?.publishedIndex?.()')&&js.includes("fetch('data/articles.json'"));
check('topic identity stays structured rather than headline matched',js.includes('identityValue(article, topicType)')&&js.includes('slugify(identityValue(article, topicType)) === topicSlug')&&!js.includes('title.includes('));
check('Start Here is editorially prioritized',js.includes('add(rows.find(isReview))')&&js.includes('add(rows.find(isGuide))')&&js.includes('add(rows[0])'));
check('coverage filtering spans core editorial formats',js.includes("filter === 'reviews'")&&js.includes("filter === 'guides'")&&js.includes("filter === 'news'")&&js.includes("filter === 'features'"));
check('Game Graph journeys resolve canonical game hubs from database rows',js.includes("client.from('games')")&&js.includes('gameUrl(game.slug)')&&js.includes('data-topic-game-hub'));
check('Phase 3 analytics cover retention actions',js.includes("'topic_hub_start_here_click'")&&js.includes("'topic_hub_filter_change'")&&js.includes("'topic_hub_game_hub_click'")&&js.includes("'topic_hub_story_click'"));
check('responsive and light-mode contracts exist',css.includes('@media(max-width:900px)')&&css.includes('@media(max-width:620px)')&&css.includes('html[data-theme="light"] body.nc-topic-page'));
check('reduced motion contract exists',css.includes('@media(prefers-reduced-motion:reduce)'));
check('canonical topic builder still hydrates shared topic template',builder.includes('TOPIC_TEMPLATE = ROOT / "topic.html"')&&builder.includes('window.NEURAL_CRITIC_STATIC_TOPIC')&&builder.includes('generated: neural-critic-topic-hub'));
const topicsRoot=path.join(root,'topics');const generated=fs.existsSync(topicsRoot)?[]:[];if(fs.existsSync(topicsRoot)){for(const type of fs.readdirSync(topicsRoot)){const typePath=path.join(topicsRoot,type);if(!fs.statSync(typePath).isDirectory())continue;for(const slug of fs.readdirSync(typePath)){const file=path.join(typePath,slug,'index.html');if(fs.existsSync(file))generated.push(file);}}}
check('generated topic shells exist after builder',generated.length>0);
check('generated topic shells include Phase 3 assets',generated.length>0&&generated.every(file=>{const html=fs.readFileSync(file,'utf8');return html.includes('assets/topic-hub-phase3.css?v=20260912-retention1')&&html.includes('assets/topic-hub-phase3.js?v=20260912-retention1')&&html.includes('window.NEURAL_CRITIC_STATIC_TOPIC');}));
let failed=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failed++;}if(failed){console.error(`Topic Hub Phase 3 regression suite failed: ${failed}/${checks.length} checks.`);process.exit(1);}console.log(`Topic Hub Phase 3 regression suite passed: ${checks.length}/${checks.length} checks.`);
