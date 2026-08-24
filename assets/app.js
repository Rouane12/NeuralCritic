const DATA_URL = 'data/articles.json';
let ARTICLES = [];

const fmtDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return new Intl.DateTimeFormat('en-GB', {day:'2-digit', month:'2-digit', year:'numeric'}).format(d);
};

const articleHref = (a) => `article.html?slug=${encodeURIComponent(a.slug)}`;
const imageOf = (a) => a?.imageLocal || '';
const escapeHtml = (value='') => String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const inlineMd = (s='') => escapeHtml(s).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\*(.+?)\*/g,'<em>$1</em>');
const discovery = () => window.NeuralCriticDiscovery || null;
const prose = (text='') => String(text || '').split(/\n\n+/).filter(Boolean).map(block => {
  if (/^- /m.test(block)) {
    const items = block.split('\n').filter(Boolean).map(x=>x.replace(/^-\s*/,''));
    return `<ul>${items.map(x=>`<li>${inlineMd(x)}</li>`).join('')}</ul>`;
  }
  return `<p>${inlineMd(block).replace(/\n/g,'<br>')}</p>`;
}).join('');

function sharedHeader(){
  return `<div class="ticker"><div class="shell"><b>NEURAL FEED</b><p>Fresh signals from across gaming — reveals, releases, reviews, and stories worth your time</p><span>LIVE NOW ↗</span></div></div>
  <header><div class="shell header"><button class="menu" aria-label="Menu">☰</button><a class="brand" href="index.html"><span>NEURAL</span><strong>CRITIC</strong><em>GAMING EDITORIAL</em></a><nav><a href="category.html?category=news">News</a><a href="category.html?category=features">Features</a><a href="category.html?category=guides">Guides</a><a href="category.html?category=reviews">Reviews</a><a href="category.html?category=pc">PC</a><a href="category.html?category=playstation">PlayStation</a><a href="category.html?category=xbox">Xbox</a><a href="category.html?category=nintendo">Nintendo</a></nav><div class="header-tools"><button class="theme-toggle" type="button"><span>☼</span><small>LIGHT</small></button><a class="search" href="search.html" aria-label="Search stories">⌕</a></div></div></header>`;
}
function sharedFooter(){
  return `<footer><div class="shell footer"><div><a class="brand" href="index.html"><span>NEURAL</span><strong>CRITIC</strong><em>GAMING EDITORIAL</em></a><p>Independent gaming news, reviews, and guides for players who want the signal—not the noise.</p></div><div><b>EXPLORE</b><a href="category.html?category=news">News</a><a href="category.html?category=reviews">Reviews</a><a href="category.html?category=guides">Guides</a><a href="search.html">Search</a><a href="feed.xml">RSS</a></div><div><b>ABOUT</b><a href="about.html">Our mission</a><a href="standards.html">Editorial standards</a><a href="privacy.html">Privacy</a><a href="terms.html">Terms</a></div></div><div class="shell copyright">© 2026 Neural Critic <span>Built for players.</span></div></footer>`;
}

function wireChrome(){
  document.querySelectorAll('.theme-toggle').forEach(btn => {
    const refresh = () => { const light=document.documentElement.dataset.theme==='light'; btn.querySelector('small').textContent = light?'DARK':'LIGHT'; btn.querySelector('span').textContent = light?'◐':'☼'; };
    refresh();
    btn.addEventListener('click',()=>{ const next=document.documentElement.dataset.theme==='light'?'dark':'light'; document.documentElement.dataset.theme=next; localStorage.setItem('neural-critic-theme',next); refresh(); });
  });
  document.querySelectorAll('.menu').forEach(btn=>btn.addEventListener('click',()=>document.body.classList.toggle('mobile-nav-open')));
}

function homepageLabel(article, isLead=false){
  if (String(article?.category || '').toUpperCase() === 'NEWS') {
    const kind = article.newsMeta?.kind;
    if (kind === 'breaking') return 'BREAKING';
    if (kind === 'update') return article.newsMeta?.developing ? 'DEVELOPING UPDATE' : 'UPDATE';
    if (kind === 'report') return 'REPORT';
    return 'NEWS';
  }
  if (article?.articleFormat === 'review') return 'LATEST REVIEW';
  return isLead ? 'LEAD SIGNAL' : (article?.category || 'FEATURE');
}

function renderHero(){
  const el=document.getElementById('hero'); if(!el) return;
  if(!ARTICLES.length){el.innerHTML='<p class="notice">Stories are loading. Please refresh in a moment.</p>';return;}

  const engine=discovery();
  const program=engine?.homepageProgram?.(ARTICLES) || null;
  const lead=program?.lead || ARTICLES.find(a=>a.homepageSlot==='lead') || ARTICLES[0];
  const secondaryFeature=ARTICLES.find(a=>a.homepageSlot?.startsWith('secondary'));
  const latestReview=ARTICLES.find(a=>a.articleFormat==='review');
  const secondaries=program?.secondaries || [secondaryFeature,latestReview].filter(Boolean).slice(0,2);
  const featuredSlugs=program?.featuredSlugs || [lead?.slug,...secondaries.map(a=>a.slug)].filter(Boolean);
  window.NeuralCriticHomepageState={ program, featuredSlugs };

  el.innerHTML=`<a href="${articleHref(lead)}" class="lead" data-home-program="${escapeHtml(homepageLabel(lead,true))}"><div class="${imageOf(lead)?'':'placeholder-art'}">${imageOf(lead)?`<img alt="${escapeHtml(lead.imageAlt)}" src="${imageOf(lead)}">`:'NEURAL CRITIC'}</div><div class="shade"></div><div class="leadcopy"><label>${escapeHtml(homepageLabel(lead,true))}</label><h2>${escapeHtml(lead.title)}</h2><p>${escapeHtml(lead.description)}</p><small>BY ${escapeHtml(lead.author)} · ${fmtDate(lead.publishedAt)} · READ STORY →</small></div></a><div class="features">${secondaries.map(a=>`<a class="feature-link" href="${articleHref(a)}"><article>${imageOf(a)?`<img alt="${escapeHtml(a.imageAlt)}" src="${imageOf(a)}">`:'<div class="placeholder-art">NEURAL CRITIC</div>'}<div class="shade"></div><div><label>${escapeHtml(homepageLabel(a))}</label><h2>${escapeHtml(a.title)}</h2><small>${fmtDate(a.updatedAt || a.publishedAt)} · READ STORY →</small></div></article></a>`).join('')}</div>`;

  window.gtag?.('event','homepage_program_render',{lead_slug:lead?.slug||'',lead_category:String(lead?.category||'').toLowerCase(),lead_news_kind:lead?.newsMeta?.kind||'',secondary_count:secondaries.length});
}

function matchCategory(a, filter){
  if(filter==='latest') return true;
  const f=String(filter||'').toLowerCase();
  if(a.category?.toLowerCase()===f) return true;
  if(a.editorialSection?.toLowerCase()===f) return true;
  if((a.platforms||[]).some(t=>String(t).toLowerCase()===f)) return true;
  return (a.tags||[]).some(t=>String(t).toLowerCase()===f);
}
function renderFeed(filter='latest'){
  const el=document.getElementById('story-feed'); if(!el) return;
  const featured=new Set(window.NeuralCriticHomepageState?.featuredSlugs || []);
  const list=ARTICLES.filter(a=>!featured.has(a.slug) && a.articleFormat!=='review').filter(a=>matchCategory(a,filter));
  el.innerHTML=list.map((a,i)=>`<a class="story" href="${articleHref(a)}"><div class="thumb">${imageOf(a)?`<img alt="${escapeHtml(a.imageAlt||a.title)}" src="${imageOf(a)}">`:'<div class="placeholder-art">NC</div>'}<b>${String(i+1).padStart(2,'0')}</b></div><div><label style="color:#b8ff38">${escapeHtml(a.category)}</label><h3>${escapeHtml(a.title)}</h3><p>${escapeHtml(a.description)}</p><small>BY ${escapeHtml(a.author)} · ${fmtDate(a.publishedAt)} · READ STORY →</small></div></a>`).join('') || '<p class="notice">No published stories in this filter yet.</p>';
}
function renderTrending(){
  const el=document.getElementById('trending'); if(!el) return;
  const engine=discovery();
  const ranked=engine?.trending?.(ARTICLES,3) || [...ARTICLES].sort((a,b)=>new Date(b.publishedAt)-new Date(a.publishedAt)).slice(0,3).map(article=>({article}));
  const list=ranked.map(item=>item.article || item).filter(Boolean);
  const label=document.querySelector('.trending .sidetitle small');
  if(label) label.textContent='EDITORIAL MOMENTUM';
  el.innerHTML=list.map((a,i)=>{
    const kind=a.newsMeta?.kind ? ` · ${String(a.newsMeta.kind).toUpperCase()}` : '';
    return `<a href="${articleHref(a)}"><b>${String(i+1).padStart(2,'0')}</b><div><p>${escapeHtml(a.title)}</p><small>${escapeHtml(a.category || 'STORY')}${kind} · ${fmtDate(a.updatedAt || a.publishedAt)}</small></div></a>`;
  }).join('');
}
function renderReview(){
  const el=document.getElementById('review-showcase'); if(!el) return;
  const a=[...ARTICLES].filter(x=>x.articleFormat==='review').sort((x,y)=>new Date(y.publishedAt||0)-new Date(x.publishedAt||0))[0]; if(!a) return;
  el.innerHTML=`<a class="review-showcase" href="${articleHref(a)}"><div class="review-showcase-image">${imageOf(a)?`<img alt="${escapeHtml(a.imageAlt)}" src="${imageOf(a)}">`:'<div class="placeholder-art">REVIEW</div>'}<span>LATEST REVIEW</span></div><div class="review-showcase-copy"><div class="review-showcase-score"><b>${escapeHtml(a.reviewMeta?.score||'—')}</b><small>OUT OF 10</small></div><div><small>NEURAL CRITIC VERDICT</small><h3>${escapeHtml(a.title)}</h3><p>${escapeHtml(a.reviewMeta?.verdict||a.description)}</p><strong>READ REVIEW →</strong></div></div></a>`;
}
function renderHome(){
  if(!document.getElementById('hero')) return;
  renderHero(); renderFeed(); renderTrending(); renderReview();
  document.querySelectorAll('.filters button').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.filters button').forEach(x=>x.classList.remove('active'));btn.classList.add('active');renderFeed(btn.dataset.filter)}));
  const overlay=document.getElementById('search-overlay'), q=document.getElementById('quick-search'), results=document.getElementById('quick-results');
  document.querySelector('.header-tools .search')?.addEventListener('click',e=>{e.preventDefault();overlay?.classList.add('open');setTimeout(()=>q?.focus(),10)});
  document.querySelector('.search-close')?.addEventListener('click',()=>overlay?.classList.remove('open'));
  q?.addEventListener('input',()=>renderSearchResults(q.value,results));
}
function renderSearchResults(query,el){
  if(!el) return;
  const raw=(query||'').trim();
  if(!raw){el.innerHTML='';return;}
  const engine=discovery();
  if(engine?.search){
    const result=engine.search(ARTICLES,raw,'all');
    const entities=result.entities.slice(0,3);
    const stories=result.stories.slice(0,6);
    const entityMarkup=entities.map(({entity})=>`<a class="search-result nc-quick-entity" href="${escapeHtml(entity.href)}"><small>${escapeHtml(entity.type.toUpperCase())} · ${entity.count} ${entity.count===1?'STORY':'STORIES'}</small><h3>${escapeHtml(entity.name)}</h3><p>Explore connected Neural Critic coverage →</p></a>`).join('');
    const storyMarkup=stories.map(({article:a})=>`<a class="search-result" href="${articleHref(a)}"><small>${escapeHtml(a.category)}</small><h3>${escapeHtml(a.title)}</h3><p>${escapeHtml(a.description)}</p></a>`).join('');
    el.innerHTML=entityMarkup+storyMarkup || '<p class="notice">No matching stories or topics yet.</p>';
    return;
  }
  const q=raw.toLowerCase();
  const hits=ARTICLES.filter(a=>[a.title,a.description,a.category,...(a.tags||[])].join(' ').toLowerCase().includes(q));
  el.innerHTML=hits.map(a=>`<a class="search-result" href="${articleHref(a)}"><small>${escapeHtml(a.category)}</small><h3>${escapeHtml(a.title)}</h3><p>${escapeHtml(a.description)}</p></a>`).join('')||'<p class="notice">No matching stories yet.</p>';
}

function articleFailure(el, message='This story could not be loaded right now.'){
  el.innerHTML=`<div class="article-load-error"><small class="article-kicker">SIGNAL INTERRUPTED</small><h1>${escapeHtml(message)}</h1><p><button type="button" onclick="location.reload()">RETRY STORY</button> <a href="index.html">BACK TO HOME →</a></p></div>`;
}

async function renderArticle(){
  const el=document.getElementById('article'); if(!el) return;
  const slug=new URLSearchParams(location.search).get('slug');
  if(!slug){articleFailure(el,'Story not found.');return;}

  el.innerHTML='<div class="article-loading-state"><span></span><strong>Loading story…</strong></div>';
  let a=ARTICLES.find(x=>x.slug===slug) || null;
  if(!a){
    try{
      a=await fetch(`data/articles/${encodeURIComponent(slug)}.json`).then(r=>{if(!r.ok) throw new Error('not found'); return r.json();});
    }catch(error){
      console.warn('Neural Critic article load failed.',error);
      articleFailure(el,'This story could not be loaded right now.');
      return;
    }
  }

  try{
    document.title=`${a.title} · Neural Critic`;
    const tags=Array.isArray(a.tags)?a.tags:[];
    const blocks=Array.isArray(a.contentBlocks)?a.contentBlocks:[];
    const review=a.articleFormat==='review'&&a.reviewMeta?`<section class="review-box"><div><div class="review-score">${escapeHtml(a.reviewMeta.score||'—')}</div><small>OUT OF 10</small></div><div><small class="article-kicker">NEURAL CRITIC VERDICT</small><h2>${escapeHtml(a.reviewMeta.verdict||'')}</h2><div class="proscons"><div><h3>WHAT WORKS</h3><ul>${(Array.isArray(a.reviewMeta.pros)?a.reviewMeta.pros:[]).map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul></div><div><h3>WHAT DOESN’T</h3><ul>${(Array.isArray(a.reviewMeta.cons)?a.reviewMeta.cons:[]).map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul></div></div></div></section>`:'';
    const bodyBlocks=blocks.map(b=>`<section><h2>${escapeHtml(b.heading||'')}</h2>${prose(b.text||'')}${b.imageLocal?`<figure><img class="article-hero" src="${b.imageLocal}" alt="${escapeHtml(b.imageAlt||'')}"><figcaption>${escapeHtml(b.caption||'')}</figcaption></figure>`:''}</section>`).join('');
    el.innerHTML=`<small class="article-kicker">${escapeHtml(a.category)}${a.articleFormat==='review'?' · REVIEW':''}</small><h1>${escapeHtml(a.title)}</h1><p class="article-deck">${escapeHtml(a.description)}</p><div class="article-meta"><span>BY ${escapeHtml(a.author)}</span><span>${fmtDate(a.publishedAt)}</span></div>${a.imageLocal?`<figure><img class="article-hero" src="${a.imageLocal}" alt="${escapeHtml(a.imageAlt||'')}"><figcaption>${escapeHtml(a.imageCredit||'')}</figcaption></figure>`:''}<div class="article-layout"><aside><div class="toc"><b>IN THIS ARTICLE</b><a href="#story">Story</a>${review?'<a href="#verdict">Verdict</a>':''}</div></aside><article class="article-body" id="story">${prose(a.body||'')}${bodyBlocks}${review?`<div id="verdict">${review}</div>`:''}${a.conclusion?`<section><h2>${escapeHtml(a.conclusionHeading||'Final thoughts')}</h2>${prose(a.conclusion)}</section>`:''}<div class="tags">${tags.map(t=>`<a href="category.html?tag=${encodeURIComponent(t)}">${escapeHtml(t)}</a>`).join('')}</div></article></div>`;
  }catch(error){
    console.error('Neural Critic article render failed.',error);
    articleFailure(el);
  }
}

async function boot(){
  const header=document.getElementById('shared-header'),footer=document.getElementById('shared-footer'); if(header) header.innerHTML=sharedHeader(); if(footer) footer.innerHTML=sharedFooter(); wireChrome();
  try{
    const response=await fetch(DATA_URL,{cache:'no-store'});
    if(response.ok) ARTICLES=await response.json();
  }catch(e){console.warn('Static article feed unavailable.',e)}
  try{
    if(window.NeuralCriticContent?.listPublished) {
      const live=await window.NeuralCriticContent.listPublished();
      if(Array.isArray(live)&&live.length) ARTICLES=live;
    }
  }catch(e){console.warn('Live content API unavailable.',e)}
  renderHome(); renderArticle();
}

document.addEventListener('DOMContentLoaded',boot);
