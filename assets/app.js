const DATA_URL = 'data/articles.json';
let ARTICLES = [];

const fmtDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return new Intl.DateTimeFormat('en-GB', {day:'2-digit', month:'2-digit', year:'numeric'}).format(d);
};

const articleHref = (a) => `stories/${encodeURIComponent(a.slug)}/`;
const imageOf = (a) => a?.imageLocal || '';
const escapeHtml = (value='') => String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const emphasisMd = (escaped='') => String(escaped).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\*(.+?)\*/g,'<em>$1</em>');
const storyHref = (slug='') => {
  const clean=String(slug||'').trim();
  if(!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(clean)) return '';
  const routed=window.NeuralCriticStoryRouter?.storyUrl?.(clean);
  if(routed) return routed;
  return new URL(`stories/${encodeURIComponent(clean)}/`,new URL('./',document.baseURI)).href;
};
const storySlugFromTarget = (target='') => {
  const raw=String(target||'').trim();
  if(raw.startsWith('story:')){
    const slug=raw.slice(6);
    return /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(slug)?slug:'';
  }
  try{
    const url=new URL(raw,document.baseURI);
    const match=url.pathname.match(/\/stories\/([^/]+)\/?$/i);
    if(!match?.[1]) return '';
    const slug=decodeURIComponent(match[1]);
    return /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(slug)?slug:'';
  }catch(_){ return ''; }
};
const safeSourceHref = (target='') => {
  try{
    const url=new URL(String(target||'').trim(),document.baseURI);
    return url.protocol==='https:'||url.protocol==='http:'?url.href:'';
  }catch(_){ return ''; }
};
const inlineMd = (s='') => {
  const source=String(s||'');
  const pattern=/\[([^\]\n]+)\]\(([^)\s]+)\)/g;
  let out='',last=0,match;
  while((match=pattern.exec(source))){
    out+=emphasisMd(escapeHtml(source.slice(last,match.index)));
    const label=emphasisMd(escapeHtml(match[1]));
    const slug=storySlugFromTarget(match[2]);
    if(slug){
      const href=storyHref(slug);
      out+=`<a class="nc-context-link nc-link-internal" href="${escapeHtml(href)}" data-nc-story-link="${escapeHtml(slug)}">${label}</a>`;
    }else{
      const href=safeSourceHref(match[2]);
      out+=href?`<a class="nc-context-link nc-link-external" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${label}</a>`:emphasisMd(escapeHtml(match[0]));
    }
    last=pattern.lastIndex;
  }
  out+=emphasisMd(escapeHtml(source.slice(last)));
  return out;
};
const discovery = () => window.NeuralCriticDiscovery || null;
const prose = (text='') => String(text || '').split(/\n\n+/).filter(Boolean).map(block => {
  if (/^- /m.test(block)) {
    const items = block.split('\n').filter(Boolean).map(x=>x.replace(/^-\s*/,''));
    return `<ul>${items.map(x=>`<li>${inlineMd(x)}</li>`).join('')}</ul>`;
  }
  return `<p>${inlineMd(block).replace(/\n/g,'<br>')}</p>`;
}).join('');

function sharedHeader(){
  return `<div class="ticker" role="region" aria-label="Neural Feed"><div class="shell"><b>NEURAL FEED</b><p>Fresh signals from across gaming — reveals, releases, reviews, and stories worth your time</p></div></div>
  <header><div class="shell header"><button class="menu" type="button" aria-label="Open navigation" aria-expanded="false"><span aria-hidden="true">☰</span></button><a class="brand" href="index.html" aria-label="Neural Critic home"><span>NEURAL</span><strong>CRITIC</strong><em>GAMING EDITORIAL</em></a><nav aria-label="Primary navigation"><a href="category.html?section=news">News</a><a href="category.html?section=reviews">Reviews</a><a href="category.html?section=guides">Guides</a><a href="category.html?section=features">Features</a><a href="category.html?section=what-to-play">What to Play</a><a href="games/">Games</a></nav><div class="header-tools" role="group" aria-label="Publication utilities"><button class="theme-toggle" type="button"><span aria-hidden="true">☼</span><small>LIGHT</small></button><a class="search" href="search.html" aria-label="Search Neural Critic"><span aria-hidden="true">⌕</span><small>SEARCH</small></a></div></div></header>`;
}
function sharedFooter(){
  return `<footer><div class="shell footer"><div><a class="brand" href="index.html" aria-label="Neural Critic home"><span>NEURAL</span><strong>CRITIC</strong><em>GAMING EDITORIAL</em></a><p>Independent gaming news, reviews, guides, and features for players who want the signal—not the noise.</p></div><div><b>EXPLORE</b><a href="category.html?section=news">News</a><a href="category.html?section=reviews">Reviews</a><a href="category.html?section=guides">Guides</a><a href="category.html?section=features">Features</a><a href="category.html?section=what-to-play">What to Play</a><a href="games/">Games</a></div><div><b>ABOUT</b><a href="search.html">Search</a><a href="feed.xml">RSS</a><a href="about.html">Our mission</a><a href="standards.html">Editorial standards</a><a href="privacy.html">Privacy</a><a href="about.html#contact">Contact</a></div></div><div class="shell copyright">© 2026 Neural Critic <span>Built for players.</span></div></footer>`;
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
    if (kind === 'breaking') return discovery()?.isRecent(article) ? 'BREAKING' : 'NEWS';
    if (kind === 'update') return discovery()?.isFreshDevelopingNews(article) ? 'DEVELOPING UPDATE' : 'UPDATE';
    if (kind === 'report') return 'REPORT';
    return 'NEWS';
  }
  if (article?.articleFormat === 'review') return 'LATEST REVIEW';
  return isLead ? 'LEAD SIGNAL' : (article?.category || 'FEATURE');
}

function renderHero(){
  const el=document.getElementById('hero'); if(!el) return;
  if(!ARTICLES.length){el.innerHTML='<p class="notice" role="status">'+(window.NeuralCriticContentLoaded ? 'Stories are temporarily unavailable. Please refresh to try again.' : 'Loading the latest stories…')+'</p>';return;}

  const engine=discovery();
  const program=engine?.homepageProgram?.(ARTICLES) || null;
  const lead=program?.lead || ARTICLES.find(a=>a.homepageSlot==='lead') || ARTICLES[0];
  const secondaryFeature=ARTICLES.find(a=>a.homepageSlot?.startsWith('secondary'));
  const latestReview=ARTICLES.find(a=>a.articleFormat==='review');
  const secondaries=program?.secondaries || [secondaryFeature,latestReview].filter(Boolean).slice(0,2);
  const featuredSlugs=program?.featuredSlugs || [lead?.slug,...secondaries.map(a=>a.slug)].filter(Boolean);
  window.NeuralCriticHomepageState={ program, featuredSlugs };

  el.innerHTML=`<a href="${articleHref(lead)}" class="lead" data-home-program="${escapeHtml(homepageLabel(lead,true))}" data-home-story="${escapeHtml(lead.slug)}"><div class="${imageOf(lead)?'':'placeholder-art'}">${imageOf(lead)?`<img alt="${escapeHtml(lead.imageAlt)}" src="${imageOf(lead)}" loading="eager" decoding="async" fetchpriority="high">`:'NEURAL CRITIC'}</div><div class="shade"></div><div class="leadcopy"><label>${escapeHtml(homepageLabel(lead,true))}</label><h1 id="home-lead-title">${escapeHtml(lead.title)}</h1><p>${escapeHtml(lead.description)}</p><small>BY ${escapeHtml(lead.author)} · ${fmtDate(lead.updatedAt || lead.publishedAt)} · READ STORY →</small></div></a><div class="features" aria-label="Supporting stories">${secondaries.map(a=>`<a class="feature-link" href="${articleHref(a)}" data-home-story="${escapeHtml(a.slug)}"><article>${imageOf(a)?`<img alt="${escapeHtml(a.imageAlt)}" src="${imageOf(a)}" loading="lazy" decoding="async">`:'<div class="placeholder-art">NEURAL CRITIC</div>'}<div class="shade"></div><div><label>${escapeHtml(homepageLabel(a))}</label><h2>${escapeHtml(a.title)}</h2><small>${fmtDate(a.updatedAt || a.publishedAt)} · READ STORY →</small></div></article></a>`).join('')}</div>`;

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
  el.innerHTML=list.map((a,i)=>`<a class="story" href="${articleHref(a)}"><div class="thumb">${imageOf(a)?`<img alt="${escapeHtml(a.imageAlt||a.title)}" src="${imageOf(a)}" loading="lazy" decoding="async">`:'<div class="placeholder-art">NC</div>'}<b>${String(i+1).padStart(2,'0')}</b></div><div><label style="color:#b8ff38">${escapeHtml(a.category)}</label><h3>${escapeHtml(a.title)}</h3><p>${escapeHtml(a.description)}</p><small>BY ${escapeHtml(a.author)} · ${fmtDate(a.publishedAt)} · READ STORY →</small></div></a>`).join('') || '<p class="notice">No published stories in this filter yet.</p>';
}
function renderTrending(){
  const el=document.getElementById('trending'); if(!el) return;
  const engine=discovery();
  const reserved=new Set([...(window.NeuralCriticHomepageState?.featuredSlugs || []),...(window.NeuralCriticHomepageState?.feedSlugs || [])]);
  const distinct=ARTICLES.filter(article=>!reserved.has(article.slug));
  const candidates=distinct.length>=3 ? distinct : ARTICLES;
  const ranked=engine?.trending?.(candidates,3) || [...candidates].sort((a,b)=>new Date(b.publishedAt)-new Date(a.publishedAt)).slice(0,3).map(article=>({article}));
  const list=ranked.map(item=>item.article || item).filter(Boolean);
  const label=document.querySelector('.trending .sidetitle small');
  if(label) label.textContent='EDITORIAL MOMENTUM';
  el.innerHTML=list.map((a,i)=>{
    const kind=a.newsMeta?.kind ? ` · ${String(a.newsMeta.kind).toUpperCase()}` : '';
    return `<a href="${articleHref(a)}"><b>${String(i+1).padStart(2,'0')}</b><div><p>${escapeHtml(a.title)}</p><small>${escapeHtml(a.category || 'STORY')}${kind} · ${fmtDate(a.updatedAt || a.publishedAt)}</small></div></a>`;
  }).join('');
}
function homepageReservedSlugs(){
  return new Set([...(window.NeuralCriticHomepageState?.featuredSlugs || []),...(window.NeuralCriticHomepageState?.feedSlugs || [])]);
}
function renderReview(){
  const el=document.getElementById('review-showcase'); if(!el) return;
  const reserved=homepageReservedSlugs();
  const reviews=[...ARTICLES].filter(x=>x.articleFormat==='review').sort((x,y)=>new Date(y.publishedAt||0)-new Date(x.publishedAt||0));
  const a=reviews.find(x=>!reserved.has(x.slug)) || reviews[0]; if(!a) return;
  el.innerHTML=`<a class="review-showcase" href="${articleHref(a)}" data-home-service="review" data-home-story="${escapeHtml(a.slug)}"><div class="review-showcase-image">${imageOf(a)?`<img alt="${escapeHtml(a.imageAlt)}" src="${imageOf(a)}" loading="lazy" decoding="async">`:'<div class="placeholder-art">REVIEW</div>'}<span>LATEST REVIEW</span></div><div class="review-showcase-copy"><div class="review-showcase-score"><b>${escapeHtml(window.NeuralCriticContentAPI.normalizeScore(a.reviewMeta?.score)??'—')}</b><small>OUT OF 10</small></div><div><small>NEURAL CRITIC VERDICT</small><h3>${escapeHtml(a.title)}</h3><p>${escapeHtml(a.reviewMeta?.verdict||a.description)}</p><strong>READ REVIEW →</strong></div></div></a>`;
}
function renderGuides(){
  const el=document.getElementById('guide-showcase'); if(!el) return;
  const section=el.closest('.home-guide-showcase');
  const reserved=homepageReservedSlugs();
  const guides=[...ARTICLES]
    .filter(a=>a.articleFormat==='game-guide' || String(a.category||'').toLowerCase()==='guide' || String(a.editorialSection||'').toLowerCase()==='guides')
    .sort((a,b)=>new Date(b.publishedAt||0)-new Date(a.publishedAt||0));
  const distinct=guides.filter(a=>!reserved.has(a.slug));
  const selected=(distinct.length ? distinct : guides).slice(0,2);
  if(!selected.length){if(section)section.hidden=true;return;}
  if(section)section.hidden=false;
  el.innerHTML=selected.map(a=>`<a class="home-guide-card" href="${articleHref(a)}" data-home-service="guide" data-home-story="${escapeHtml(a.slug)}"><span class="home-guide-media">${imageOf(a)?`<img alt="${escapeHtml(a.imageAlt||a.title)}" src="${imageOf(a)}" loading="lazy" decoding="async">`:'<span class="placeholder-art">GUIDE</span>'}</span><span class="home-guide-copy"><small>GUIDE</small><strong>${escapeHtml(a.title)}</strong><span>${escapeHtml(a.description)}</span><b>OPEN GUIDE →</b></span></a>`).join('');
}
function renderHome(){
  if(!document.getElementById('hero')) return;
  renderHero(); renderFeed();
  if(!window.NeuralCriticHomepageState?.feedSlugs) renderTrending();
  renderReview(); renderGuides();
  const overlay=document.getElementById('search-overlay'), q=document.getElementById('quick-search'), results=document.getElementById('quick-results');
  document.querySelector('.header-tools .search')?.addEventListener('click',e=>{e.preventDefault();overlay?.classList.add('open');setTimeout(()=>q?.focus(),10)});
  document.querySelector('.search-close')?.addEventListener('click',()=>overlay?.classList.remove('open'));
  q?.addEventListener('input',()=>renderSearchResults(q.value,results));
}
window.addEventListener('neuralcritic:homepage-feed-rendered',()=>{renderTrending();renderReview();renderGuides();});
window.addEventListener('neuralcritic:homepage-slots-applied',()=>{
  const slugs=[...document.querySelectorAll('#hero [data-home-story]')].map(node=>node.dataset.homeStory).filter(Boolean);
  if(window.NeuralCriticHomepageState) window.NeuralCriticHomepageState.featuredSlugs=[...new Set(slugs)];
  renderFeed?.();
  renderReview();
  renderGuides();
});
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
  const slug=String(window.NEURAL_CRITIC_STATIC_SLUG || '').trim() || new URLSearchParams(location.search).get('slug');
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
    const review=a.articleFormat==='review'&&a.reviewMeta?`<section class="review-box"><div><div class="review-score">${escapeHtml(window.NeuralCriticContentAPI.normalizeScore(a.reviewMeta.score)??'—')}</div><small>OUT OF 10</small></div><div><small class="article-kicker">NEURAL CRITIC VERDICT</small><h2>${escapeHtml(a.reviewMeta.verdict||'')}</h2><div class="proscons"><div><h3>WHAT WORKS</h3><ul>${(Array.isArray(a.reviewMeta.pros)?a.reviewMeta.pros:[]).map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul></div><div><h3>WHAT DOESN’T</h3><ul>${(Array.isArray(a.reviewMeta.cons)?a.reviewMeta.cons:[]).map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul></div></div></div></section>`:'';
    const bodyBlocks=blocks.map(b=>{
      const image=b.imageLocal?`<figure><img class="article-hero" src="${escapeHtml(b.imageLocal)}" alt="${escapeHtml(b.imageAlt||'')}" loading="lazy" decoding="async"><figcaption>${escapeHtml(b.caption||'')}</figcaption></figure>`:'';
      const videoUrl=String(b.videoUrl||'').trim();
      const video=videoUrl?`<div class="article-video-shell" data-nc-video data-video-url="${escapeHtml(videoUrl)}" data-video-title="${escapeHtml(b.videoTitle||b.heading||a.title||'Article video')}" data-video-caption="${escapeHtml(b.videoCaption||'')}" data-video-poster="${escapeHtml(b.videoPoster||'')}"></div>`:'';
      const relatedSlug=String(b.relatedStorySlug||'').trim();
      const related=relatedSlug&&relatedSlug!==a.slug?ARTICLES.find(item=>item.slug===relatedSlug):null;
      const relatedImage=related?.imageLocal?`<span class="nc-related-story-media"><img src="${escapeHtml(related.imageLocal)}" alt="${escapeHtml(related.imageAlt||related.title||'')}" loading="lazy" decoding="async"></span>`:'<span class="nc-related-story-media" aria-hidden="true"></span>';
      const relatedCard=related?`<aside class="nc-related-story" aria-label="Related Neural Critic story"><a href="${escapeHtml(storyHref(related.slug))}" data-nc-story-link="${escapeHtml(related.slug)}">${relatedImage}<span class="nc-related-story-copy"><small>RELATED · ${escapeHtml(String(related.category||'STORY').toUpperCase())}</small><strong>${escapeHtml(related.title||'')}</strong>${related.description?`<span>${escapeHtml(related.description)}</span>`:''}<b>READ NEXT →</b></span></a></aside>`:'';
      return `<section><h2>${escapeHtml(b.heading||'')}</h2>${prose(b.text||'')}${image}${video}${relatedCard}</section>`;
    }).join('');
    el.innerHTML=`<small class="article-kicker">${escapeHtml(a.category)}${a.articleFormat==='review'?' · REVIEW':''}</small><h1>${escapeHtml(a.title)}</h1><p class="article-deck">${escapeHtml(a.description)}</p><div class="article-meta">BY ${escapeHtml(a.author)} · ${fmtDate(a.publishedAt)} · ${tags.map(escapeHtml).join(' · ')}</div>${imageOf(a)?`<img class="article-hero" src="${imageOf(a)}" alt="${escapeHtml(a.imageAlt)}" loading="eager" decoding="async" fetchpriority="high">`:'<div class="placeholder-art">NEURAL CRITIC</div>'}<div class="article-body">${prose(a.body||'')}${review}${bodyBlocks}</div>`;
  }catch(error){
    console.error('Neural Critic article rendering failed.',error);
    articleFailure(el,'This story hit a rendering error.');
  }
}
function renderCategory(){
  const grid=document.getElementById('category-grid'); if(!grid) return;
  const cat=(new URLSearchParams(location.search).get('category')||'latest').toLowerCase();
  const title=document.getElementById('category-title'); if(title) title.textContent=cat==='latest'?'Latest stories':cat.charAt(0).toUpperCase()+cat.slice(1);
  const list=ARTICLES.filter(a=>matchCategory(a,cat));
  grid.innerHTML=list.map(a=>`<a class="category-card" href="${articleHref(a)}">${imageOf(a)?`<img src="${imageOf(a)}" alt="${escapeHtml(a.imageAlt||a.title)}" loading="lazy" decoding="async">`:'<div class="placeholder-art">NC</div>'}<div><label>${escapeHtml(a.category)}</label><h2>${escapeHtml(a.title)}</h2><p>${escapeHtml(a.description)}</p><small>${fmtDate(a.publishedAt)}</small></div></a>`).join('')||'<p class="notice">No published stories in this category yet.</p>';
}
function renderSearchPage(){
  const input=document.getElementById('search-page-input'), results=document.getElementById('search-page-results'); if(!input) return;
  const q=new URLSearchParams(location.search).get('q')||''; input.value=q; renderSearchResults(q,results); input.addEventListener('input',()=>renderSearchResults(input.value,results));
}
async function init(){
  document.getElementById('shared-header')?.insertAdjacentHTML('beforeend',sharedHeader());
  document.getElementById('shared-footer')?.insertAdjacentHTML('beforeend',sharedFooter());
  wireChrome();
  const articleHost = document.getElementById('article');
  if (articleHost) articleHost.innerHTML='<div class="article-loading-state" role="status"><span></span><strong>Loading story…</strong></div>';
  try{
    const response=await fetch(DATA_URL);
    if(!response.ok) throw new Error(`article index returned ${response.status}`);
    const data=await response.json();
    ARTICLES=Array.isArray(data)?data:[];
  }catch(e){
    console.warn('Neural Critic article index unavailable; direct story rendering will continue.',e);
    ARTICLES=[];
  }
  window.NeuralCriticContentLoaded=true;
  if (window.NeuralCriticDiscoveryReady) await window.NeuralCriticDiscoveryReady;
  renderHome();
  await renderArticle();
  renderCategory();
  renderSearchPage();
}
init().catch(error=>console.error('Neural Critic initialization failed.',error));
