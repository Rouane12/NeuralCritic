(() => {
  'use strict';

  const SITE_ROOT = new URL('/NeuralCritic/', location.origin);
  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = (value = '') => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

  function slugify(value = '') {
    return String(value).trim().toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
      .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
  }

  function same(a,b) { return !!a && !!b && slugify(a) === slugify(b); }
  function topicUrl(type,value) { const slug=slugify(value); return slug ? new URL(`topics/${type}/${slug}/`,SITE_ROOT).href : '#'; }
  function storyUrl(slug) { return new URL(`stories/${encodeURIComponent(slug)}/`,SITE_ROOT).href; }

  function currentSlug() {
    const staticSlug = String(window.NEURAL_CRITIC_STATIC_SLUG || '').trim();
    return staticSlug || new URLSearchParams(location.search).get('slug') || '';
  }

  async function waitForApi(timeout=5000) {
    const started=performance.now();
    while(performance.now()-started<timeout){
      if(window.NeuralCriticContentAPI?.publishedArticle&&window.NeuralCriticContentAPI?.publishedIndex)return window.NeuralCriticContentAPI;
      await new Promise(resolve=>setTimeout(resolve,80));
    }
    return null;
  }

  async function waitForSidebar(timeout=7000) {
    const immediate=$('#article .work-article-sidebar');if(immediate)return immediate;
    return new Promise(resolve=>{
      const host=$('#article');if(!host)return resolve(null);
      const observer=new MutationObserver(()=>{const sidebar=$('.work-article-sidebar',host);if(sidebar){observer.disconnect();resolve(sidebar)}});
      observer.observe(host,{childList:true,subtree:true});
      setTimeout(()=>{observer.disconnect();resolve($('#article .work-article-sidebar'))},timeout);
    });
  }

  function relationMarkup(article) {
    const entries=[
      ['game',article.gameKey,'GAME'],
      ['series',article.series,'SERIES'],
      ['franchise',article.franchise,'FRANCHISE']
    ].filter(([,value])=>String(value||'').trim());
    return entries.map(([type,value,label])=>`<a href="${esc(topicUrl(type,value))}"><small>${label}</small><strong>${esc(value)}</strong><i>→</i></a>`).join('');
  }

  function siblingCandidates(article,articles) {
    return articles.filter(candidate=>candidate.slug!==article.slug).map(candidate=>{
      let strength=0,label='';
      if(article.series&&same(article.series,candidate.series)){strength=2;label='SAME SERIES'}
      else if(article.franchise&&same(article.franchise,candidate.franchise)){strength=1;label='SAME FRANCHISE'}
      return {candidate,strength,label};
    }).filter(item=>item.strength).sort((a,b)=>b.strength-a.strength||new Date(b.candidate.publishedAt||0)-new Date(a.candidate.publishedAt||0)).slice(0,3);
  }

  function siblingMarkup(items) {
    if(!items.length)return '';
    return `<div class="nc-game-identity-siblings"><span>CONNECTED COVERAGE</span>${items.map(item=>`<a href="${esc(storyUrl(item.candidate.slug))}"><div><small>${esc(item.label)}</small><strong>${esc(item.candidate.title||'')}</strong></div><i>→</i></a>`).join('')}</div>`;
  }

  function installIntoExisting(card,article,siblings) {
    if($('.nc-game-identity',card))return;
    const head=$('.game-graph-side-head',card);
    const identity=document.createElement('div');
    identity.className='nc-game-identity';
    identity.innerHTML=relationMarkup(article);
    if(head)head.insertAdjacentElement('afterend',identity);else card.prepend(identity);
    const links=$('.game-graph-links',card);
    if(siblings.length&&links)links.insertAdjacentHTML('beforebegin',siblingMarkup(siblings));
  }

  function createCard(sidebar,article,siblings) {
    if(!article.gameKey&&!article.series&&!article.franchise)return;
    const card=document.createElement('section');
    card.className='work-side-card game-graph-side nc-game-graph-identity-card';
    const name=article.gameKey||article.series||article.franchise;
    const connected=new Set([article.slug,...siblings.map(item=>item.candidate.slug)]).size;
    card.innerHTML=`<span>NC GAME INDEX</span><div class="game-graph-side-head"><strong>${esc(name)}</strong><small>${connected} CONNECTED ${connected===1?'STORY':'STORIES'}</small></div><div class="nc-game-identity">${relationMarkup(article)}</div>${siblingMarkup(siblings)}`;
    const toc=$('.work-toc',sidebar);if(toc)toc.insertAdjacentElement('afterend',card);else sidebar.prepend(card);
  }

  async function init() {
    const slug=currentSlug();if(!slug)return;
    const [api,sidebar]=await Promise.all([waitForApi(),waitForSidebar()]);
    if(!api||!sidebar)return;
    let article,articles;
    try{[article,articles]=await Promise.all([api.publishedArticle(slug),api.publishedIndex()])}catch(_){return}
    if(!article||(!article.gameKey&&!article.series&&!article.franchise))return;
    const siblings=siblingCandidates(article,articles||[]);

    const apply=()=>{
      const existing=$('.game-graph-side',sidebar);
      if(existing)installIntoExisting(existing,article,siblings);else createCard(sidebar,article,siblings);
    };
    apply();
    const observer=new MutationObserver(()=>{if(!$('.nc-game-identity',sidebar))apply()});
    observer.observe(sidebar,{childList:true,subtree:true});
    setTimeout(()=>observer.disconnect(),8000);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();