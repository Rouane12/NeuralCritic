(() => {
  const qs = (s,r=document) => r.querySelector(s);
  const qsa = (s,r=document) => [...r.querySelectorAll(s)];
  const esc = (value='') => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
  const slug = new URLSearchParams(location.search).get('slug') || '';

  async function articleData(){
    if (!slug) return null;
    try {
      if (window.NeuralCriticContentAPI?.publishedArticle) {
        const article = await window.NeuralCriticContentAPI.publishedArticle(slug);
        if (article) return article;
      }
      const r = await fetch(`data/articles/${encodeURIComponent(slug)}.json`);
      return r.ok ? await r.json() : null;
    } catch (_) { return null; }
  }

  async function publishedArticles(){
    try {
      if (window.NeuralCriticContentAPI?.publishedIndex) {
        const rows = await window.NeuralCriticContentAPI.publishedIndex();
        if (rows?.length) return rows;
      }
      const r = await fetch('data/articles.json');
      return r.ok ? await r.json() : [];
    } catch (_) { return []; }
  }

  function waitFor(selector,ms=6000){
    return new Promise(resolve=>{
      const immediate=qs(selector);if(immediate)return resolve(immediate);
      const observer=new MutationObserver(()=>{const found=qs(selector);if(found){observer.disconnect();resolve(found)}});
      observer.observe(document.documentElement,{childList:true,subtree:true});
      setTimeout(()=>{observer.disconnect();resolve(qs(selector))},ms);
    });
  }

  function waitForRankedCards(){
    return new Promise(resolve => {
      const ready = qsa('#article .ranked-card');
      if (ready.length) return resolve(ready);
      const host = qs('#article');
      if (!host) return resolve([]);
      const observer = new MutationObserver(() => {
        const cards = qsa('.ranked-card', host);
        if (cards.length) { observer.disconnect(); resolve(cards); }
      });
      observer.observe(host,{childList:true,subtree:true});
      setTimeout(()=>{observer.disconnect();resolve(qsa('.ranked-card',host));},5000);
    });
  }

  function presentation(article){
    const count = Math.max(1, (article.contentBlocks || []).length);
    if (article.collection === 'all-time-greats') return {start:`#${count}`,end:'#1',conclusion:'A canon should stay open'};
    if (article.collection === 'best-games') return {start:`#${count}`,end:'#1',conclusion:'What belongs on your list?'};
    if (article.collection === 'game-of-the-year') return {start:'FINALISTS',end:'WINNER',conclusion:'The final word on the year'};
    if (article.collection === 'upcoming-games') return {start:'WATCHLIST',end:'TOP PICK',conclusion:'What we’re watching next'};
    const difficulty = /difficulty|easiest|hardest/i.test(`${article.title || ''} ${article.slug || ''}`);
    return difficulty ? {start:'EASIEST',end:'HARDEST',conclusion:'Difficulty is personal'} : {start:`#${count}`,end:'#1',conclusion:'The final word'};
  }

  async function enhanceRankedPresentation(article){
    if (!article || article.articleFormat !== 'ranked-list') return [];
    const host = qs('#article');
    if (!host) return [];
    host.classList.add('ranked-list-page');
    const cards = await waitForRankedCards();
    if (!cards.length) return [];

    const ui = presentation(article);
    const first = cards[0];
    let scale = qs('.ranked-scale', first.parentElement);
    if (!scale) {
      first.insertAdjacentHTML('beforebegin',`<div class="ranked-scale"><span>${ui.start}</span><span>${ui.end}</span></div>`);
      scale = qs('.ranked-scale', first.parentElement);
    } else {
      const labels = qsa('span', scale);
      if (labels[0]) labels[0].textContent = ui.start;
      if (labels[1]) labels[1].textContent = ui.end;
    }

    cards.forEach((card,index) => {
      const block = (article.contentBlocks || [])[index] || {};
      if (block.rank) card.dataset.rank = block.rank;
      card.dataset.entry = block.heading || '';
    });

    const conclusionHeading = qs('.article-conclusion h2', host);
    if (conclusionHeading) conclusionHeading.textContent = ui.conclusion;
    return cards;
  }

  /* -----------------------------------------------------------------------
     NEURAL CRITIC GAME GRAPH
     Relationships are inferred from published content. Editors do not paste
     review URLs or scores into rankings; the graph resolves them at runtime.
     ----------------------------------------------------------------------- */

  function normalizeGame(value=''){
    return String(value)
      .normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
      .replace(/[®™©]/g,'').replace(/&/g,' and ')
      .replace(/[’'`]/g,'').toLowerCase()
      .replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
  }

  function editionBase(value=''){
    return normalizeGame(value)
      .replace(/\b(remastered|remake|definitive edition|complete edition|game of the year edition|goty edition)\b/g,' ')
      .replace(/\s+/g,' ').trim();
  }

  function reviewGameName(article){
    const title=String(article?.title||'').trim();
    let match=title.match(/^(.+?)\s+review\b/i);
    if(match?.[1]) return match[1].trim();
    match=title.match(/^review\s*[:\-–—]\s*(.+?)(?:\s*[:\-–—].*)?$/i);
    if(match?.[1]) return match[1].trim();
    const generic=new Set(['review','pc','playstation','xbox','nintendo','switch','ps5','ps4','action rpg','open world','feature','guide','news']);
    const tag=(article?.tags||[]).find(x=>{const n=normalizeGame(x);return n.length>3&&!generic.has(n)});
    return tag||'';
  }

  function findNode(nodes,name){
    const exact=normalizeGame(name);if(!exact)return null;
    if(nodes.has(exact))return nodes.get(exact);
    const base=editionBase(name);if(!base)return null;
    const matches=[...nodes.values()].filter(node=>editionBase(node.name)===base);
    return matches.length===1?matches[0]:null;
  }

  function ensureNode(nodes,name){
    const key=normalizeGame(name);if(!key)return null;
    let node=nodes.get(key);
    if(!node){node={key,name:String(name).trim(),review:null,appearances:[],coverage:[]};nodes.set(key,node)}
    return node;
  }

  function articleMentionsGame(article,node){
    const key=node.key;if(!key)return false;
    if(normalizeGame(article?.title||'').includes(key))return true;
    return (article?.tags||[]).some(tag=>normalizeGame(tag)===key || editionBase(tag)===editionBase(node.name));
  }

  function graphFor(articles){
    const nodes=new Map();

    articles.filter(a=>a.articleFormat==='ranked-list').forEach(article=>{
      (article.contentBlocks||[]).forEach(block=>{
        const node=ensureNode(nodes,block.heading||'');if(!node)return;
        node.appearances.push({article,rank:block.rank||'',subtitle:block.subtitle||''});
      });
    });

    articles.filter(a=>a.articleFormat==='review').forEach(article=>{
      const name=reviewGameName(article);if(!name)return;
      const node=findNode(nodes,name)||ensureNode(nodes,name);if(!node)return;
      const currentDate=new Date(node.review?.publishedAt||0),nextDate=new Date(article.publishedAt||0);
      if(!node.review||nextDate>=currentDate)node.review=article;
    });

    nodes.forEach(node=>{
      articles.forEach(article=>{
        if(article.articleFormat==='ranked-list')return;
        if(articleMentionsGame(article,node))node.coverage.push(article);
      });
      node.coverage.sort((a,b)=>new Date(b.publishedAt||0)-new Date(a.publishedAt||0));
    });
    return nodes;
  }

  function reviewScore(article){return article?.reviewMeta?.score??article?.review_meta?.score??''}
  function reviewVerdict(article){return article?.reviewMeta?.verdict??article?.review_meta?.verdict??article?.description??''}
  function articleUrl(article){return `article.html?slug=${encodeURIComponent(article.slug)}`}

  function reviewModule(node){
    const review=node?.review,score=reviewScore(review);if(!review||!score)return null;
    const link=document.createElement('a');
    link.className='game-graph-review';link.href=articleUrl(review);
    link.setAttribute('aria-label',`Read Neural Critic's ${node.name} review, scored ${score} out of 10`);
    link.innerHTML=`<span class="game-graph-score"><b>${esc(score)}</b><small>/10</small></span><span class="game-graph-review-copy"><small>NEURAL CRITIC REVIEW</small><strong>${esc(reviewVerdict(review))}</strong><em>READ REVIEW →</em></span>`;
    return link;
  }

  function enrichRankedCards(article,cards,nodes){
    if(article.articleFormat!=='ranked-list'||!cards.length)return;
    cards.forEach((card,index)=>{
      if(qs('.game-graph-review',card))return;
      const block=(article.contentBlocks||[])[index]||{};
      const node=findNode(nodes,block.heading||'');
      const module=reviewModule(node);if(!module)return;
      const subtitle=qs('.ranked-subtitle',card),heading=qs('h2',card);
      if(subtitle)subtitle.insertAdjacentElement('afterend',module);
      else if(heading)heading.insertAdjacentElement('afterend',module);
      else card.prepend(module);
      card.dataset.gameGraph='review-linked';
    });
  }

  function currentGameNode(article,nodes){
    if(!article||article.articleFormat==='ranked-list')return null;
    if(article.articleFormat==='review')return findNode(nodes,reviewGameName(article));
    const candidates=[...nodes.values()].filter(node=>articleMentionsGame(article,node));
    candidates.sort((a,b)=>b.key.length-a.key.length);
    return candidates[0]||null;
  }

  function connectionLabel(appearance){
    if(appearance.article.collection==='all-time-greats')return appearance.rank?`ALL-TIME RANK · #${appearance.rank}`:'ALL-TIME GREATS';
    if(appearance.article.collection==='game-of-the-year')return appearance.rank?`GAME OF THE YEAR · #${appearance.rank}`:'GAME OF THE YEAR';
    return appearance.rank?`RANKED · #${appearance.rank}`:'RANKED LIST';
  }

  async function renderGameIndex(article,nodes){
    const node=currentGameNode(article,nodes);if(!node)return;
    const sidebar=await waitFor('#article .work-article-sidebar');if(!sidebar||qs('.game-graph-side',sidebar))return;

    const links=[];
    if(node.review&&node.review.slug!==article.slug){
      const score=reviewScore(node.review);
      links.push(`<a class="game-graph-side-review" href="${articleUrl(node.review)}"><span><small>NEURAL CRITIC REVIEW</small><strong>Read our ${esc(node.name)} review</strong></span>${score?`<b>${esc(score)}<em>/10</em></b>`:''}</a>`);
    }

    node.appearances.filter(x=>x.article.slug!==article.slug).slice(0,3).forEach(item=>{
      links.push(`<a href="${articleUrl(item.article)}"><span><small>${esc(connectionLabel(item))}</small><strong>${esc(item.article.title)}</strong></span><i>→</i></a>`);
    });

    node.coverage.filter(x=>x.slug!==article.slug&&x.slug!==node.review?.slug).slice(0,2).forEach(item=>{
      links.push(`<a href="${articleUrl(item)}"><span><small>${esc(String(item.category||'FEATURE').toUpperCase())}</small><strong>${esc(item.title)}</strong></span><i>→</i></a>`);
    });
    if(!links.length)return;

    const uniqueCount=new Set([
      ...(node.review?[node.review.slug]:[]),
      ...node.appearances.map(x=>x.article.slug),
      ...node.coverage.map(x=>x.slug)
    ]).size;
    const card=document.createElement('section');
    card.className='work-side-card game-graph-side';
    card.innerHTML=`<span>NC GAME INDEX</span><div class="game-graph-side-head"><strong>${esc(node.name)}</strong><small>${uniqueCount} CONNECTED ${uniqueCount===1?'STORY':'STORIES'}</small></div><div class="game-graph-links">${links.join('')}</div>`;
    const toc=qs('.work-toc',sidebar);
    if(toc)toc.insertAdjacentElement('afterend',card);else sidebar.prepend(card);
  }

  async function init(){
    const [article,articles]=await Promise.all([articleData(),publishedArticles()]);
    if(!article)return;
    const cards=await enhanceRankedPresentation(article);
    if(!articles.length)return;
    const nodes=graphFor(articles);
    enrichRankedCards(article,cards,nodes);
    await renderGameIndex(article,nodes);
    const host=qs('#article');if(host)host.dataset.gameGraph='ready';
    window.dispatchEvent(new CustomEvent('neuralcritic:game-graph-ready',{detail:{games:nodes.size}}));
  }

  init();
})();
