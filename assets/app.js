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
  return `<footer><div class="shell footer"><div><a class="brand" href="index.html"><span>NEURAL</span><strong>CRITIC</strong><em>GAMING EDITORIAL</em></a><p>Independent gaming news, reviews, and guides for players who want the signal—not the noise.</p></div><div><b>EXPLORE</b><a href="category.html?category=news">News</a><a href="category.html?category=reviews">Reviews</a><a href="category.html?category=guides">Guides</a><a href="search.html">Search</a><a href="feed.xml">RSS</a></div><div><b>ABOUT</b><a href="about.html">Our mission</a><a href="standards.html">Editorial standards</a><a href="privacy.html">Privacy</a><a href="mailto:rouane.mounssif12@gmail.com">Contact</a></div></div><div class="shell copyright">© 2026 Neural Critic <span>Built for players.</span></div></footer>`;
}

function wireChrome(){
  document.querySelectorAll('.theme-toggle').forEach(btn => {
    const refresh = () => { const light=document.documentElement.dataset.theme==='light'; btn.querySelector('small').textContent = light?'DARK':'LIGHT'; btn.querySelector('span').textContent = light?'◐':'☼'; };
    refresh();
    btn.addEventListener('click',()=>{ const next=document.documentElement.dataset.theme==='light'?'dark':'light'; document.documentElement.dataset.theme=next; localStorage.setItem('neural-critic-theme',next); refresh(); });
  });
  document.querySelectorAll('.menu').forEach(btn=>btn.addEventListener('click',()=>document.body.classList.toggle('mobile-nav-open')));
}

function renderHero(){
  const el=document.getElementById('hero'); if(!el) return;
  if(!ARTICLES.length){el.innerHTML='<p class="notice">Stories are loading. Please refresh in a moment.</p>';return;}
  const lead=ARTICLES.find(a=>a.homepageSlot==='lead')||ARTICLES[0];
  const secondaryFeature=ARTICLES.find(a=>a.homepageSlot?.startsWith('secondary'));
  const latestReview=ARTICLES.find(a=>a.articleFormat==='review');
  const secondaries=[secondaryFeature,latestReview].filter(Boolean).slice(0,2);
  el.innerHTML=`<a href="${articleHref(lead)}" class="lead"><div class="${imageOf(lead)?'':'placeholder-art'}">${imageOf(lead)?`<img alt="${escapeHtml(lead.imageAlt)}" src="${imageOf(lead)}">`:'NEURAL CRITIC'}</div><div class="shade"></div><div class="leadcopy"><label>LEAD SIGNAL</label><h2>${escapeHtml(lead.title)}</h2><p>${escapeHtml(lead.description)}</p><small>BY ${escapeHtml(lead.author)} · ${fmtDate(lead.publishedAt)} · READ STORY →</small></div></a><div class="features">${secondaries.map(a=>`<a class="feature-link" href="${articleHref(a)}"><article>${imageOf(a)?`<img alt="${escapeHtml(a.imageAlt)}" src="${imageOf(a)}">`:'<div class="placeholder-art">NEURAL CRITIC</div>'}<div class="shade"></div><div><label>${escapeHtml(a.category)}</label><h2>${escapeHtml(a.title)}</h2><small>${fmtDate(a.publishedAt)} · READ STORY →</small></div></article></a>`).join('')}</div>`;
}

function matchCategory(a, filter){
  if(filter==='latest') return true;
  const f=filter.toLowerCase();
  if(a.category?.toLowerCase()===f) return true;
  return (a.tags||[]).some(t=>String(t).toLowerCase()===f);
}
function renderFeed(filter='latest'){
  const el=document.getElementById('story-feed'); if(!el) return;
  const list=ARTICLES.filter(a=>a.homepageSlot!=='lead' && !a.homepageSlot?.startsWith('secondary') && a.articleFormat!=='review').filter(a=>matchCategory(a,filter));
  el.innerHTML=list.map((a,i)=>`<a class="story" href="${articleHref(a)}"><div class="thumb">${imageOf(a)?`<img alt="${escapeHtml(a.imageAlt||a.title)}" src="${imageOf(a)}">`:'<div class="placeholder-art">NC</div>'}<b>${String(i+1).padStart(2,'0')}</b></div><div><label style="color:#b8ff38">${escapeHtml(a.category)}</label><h3>${escapeHtml(a.title)}</h3><p>${escapeHtml(a.description)}</p><small>BY ${escapeHtml(a.author)} · ${fmtDate(a.publishedAt)} · READ STORY →</small></div></a>`).join('') || '<p class="notice">No published stories in this filter yet.</p>';
}
function renderTrending(){
  const el=document.getElementById('trending'); if(!el) return;
  const list=[...ARTICLES].sort((a,b)=>new Date(b.publishedAt)-new Date(a.publishedAt)).slice(0,3);
  el.innerHTML=list.map((a,i)=>`<a href="${articleHref(a)}"><b>${String(i+1).padStart(2,'0')}</b><div><p>${escapeHtml(a.title)}</p><small>${fmtDate(a.publishedAt)}</small></div></a>`).join('');
}
function renderReview(){
  const el=document.getElementById('review-showcase'); if(!el) return;
  const a=ARTICLES.find(x=>x.articleFormat==='review'); if(!a) return;
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
  const q=(query||'').trim().toLowerCase();
  if(!q){el.innerHTML='';return;}
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
    el.innerHTML=`<small class="article-kicker">${escapeHtml(a.category)}${a.articleFormat==='review'?' · REVIEW':''}</small><h1>${escapeHtml(a.title)}</h1><p class="article-deck">${escapeHtml(a.description)}</p><div class="article-meta">BY ${escapeHtml(a.author)} · ${fmtDate(a.publishedAt)} · ${tags.map(escapeHtml).join(' · ')}</div>${imageOf(a)?`<img class="article-hero" src="${imageOf(a)}" alt="${escapeHtml(a.imageAlt)}">`:'<div class="placeholder-art">NEURAL CRITIC</div>'}<div class="article-body">${prose(a.body||'')}${review}${bodyBlocks}</div>`;
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
  grid.innerHTML=list.map(a=>`<a class="category-card" href="${articleHref(a)}">${imageOf(a)?`<img src="${imageOf(a)}" alt="${escapeHtml(a.imageAlt||a.title)}">`:'<div class="placeholder-art">NC</div>'}<div><label>${escapeHtml(a.category)}</label><h2>${escapeHtml(a.title)}</h2><p>${escapeHtml(a.description)}</p><small>${fmtDate(a.publishedAt)}</small></div></a>`).join('')||'<p class="notice">No published stories in this category yet.</p>';
}
function renderSearchPage(){
  const input=document.getElementById('search-page-input'), results=document.getElementById('search-page-results'); if(!input) return;
  const q=new URLSearchParams(location.search).get('q')||''; input.value=q; renderSearchResults(q,results); input.addEventListener('input',()=>renderSearchResults(input.value,results));
}
async function init(){
  document.getElementById('shared-header')?.insertAdjacentHTML('beforeend',sharedHeader());
  document.getElementById('shared-footer')?.insertAdjacentHTML('beforeend',sharedFooter());
  wireChrome();
  try{
    const response=await fetch(DATA_URL);
    if(!response.ok) throw new Error(`article index returned ${response.status}`);
    const data=await response.json();
    ARTICLES=Array.isArray(data)?data:[];
  }catch(e){
    console.warn('Neural Critic article index unavailable; direct story rendering will continue.',e);
    ARTICLES=[];
  }
  renderHome();
  await renderArticle();
  renderCategory();
  renderSearchPage();
}
init().catch(error=>console.error('Neural Critic initialization failed.',error));
