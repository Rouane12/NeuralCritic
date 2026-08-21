(() => {
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const esc = (v='') => String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const params = new URLSearchParams(location.search);
  const collection = params.get('collection');
  const platform = params.get('platform');
  const platformNames = {pc:'PC',playstation:'PlayStation',xbox:'Xbox',nintendo:'Nintendo',mobile:'Mobile'};
  const collectionMeta = {
    'game-of-the-year': {eyebrow:'NEURAL CRITIC AWARDS',title:'Game of the Year',deck:'The annual Neural Critic awards — finalists, winners, and the games that defined each year.',empty:'Our first Game of the Year edition has not been published yet.'},
    'best-games': {eyebrow:'CURATED PICKS',title:'Best Games',deck:'Living recommendation lists built to answer one question: what is genuinely worth your time?',empty:'The Best Games desk is ready for its first curated list.'},
    'all-time-greats': {eyebrow:'THE ESSENTIALS',title:'Best Games of All Time',deck:'The permanent Neural Critic canon — landmark games we consider essential across generations.',empty:'The Neural Critic all-time canon has not been published yet.'},
    'upcoming-games': {eyebrow:'ON THE RADAR',title:'Upcoming Games',deck:'The releases we are watching before launch, from imminent arrivals to long-range standouts.',empty:'The Upcoming Games desk is ready for its first watchlist.'}
  };

  const articleUrl = a => `article.html?slug=${encodeURIComponent(a.slug)}`;
  const collectionUrl = values => `category.html?${new URLSearchParams(values).toString()}`;

  function mapArticle(r){return {slug:r.slug,title:r.title,description:r.description||'',category:r.category||'FEATURE',author:r.author_name||'Neural Critic',articleFormat:r.article_format||'standard',image:r.image_url||'',imageAlt:r.image_alt||r.title||'',platforms:Array.isArray(r.platforms)?r.platforms.map(x=>String(x).toLowerCase()):[],collection:r.collection||null,collectionYear:r.collection_year||null,publishedAt:r.published_at||''};}
  async function loadArticles(){
    const client=window.neuralCriticPublicSupabase;
    if(client){const {data,error}=await client.from('articles').select('slug,title,description,category,author_name,article_format,image_url,image_alt,platforms,collection,collection_year,published_at').eq('status','published').lte('published_at',new Date().toISOString()).order('published_at',{ascending:false});if(!error)return(data||[]).map(mapArticle);}
    return [];
  }
  function image(a){return a.image?`<img src="${esc(a.image)}" alt="${esc(a.imageAlt)}">`:'<div class="collection-placeholder">NEURAL CRITIC</div>'}
  function fmtDate(iso){try{return new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(iso))}catch(_){return''}}
  function type(a){if(a.articleFormat==='ranked-list')return'RANKED LIST';if(a.articleFormat==='review')return'REVIEW';if(a.articleFormat==='game-guide')return'GUIDE';return String(a.category||'FEATURE').toUpperCase()}
  function card(a){return `<a class="collection-story" href="${articleUrl(a)}"><div class="collection-story-media">${image(a)}</div><div class="collection-story-copy"><div class="collection-story-meta"><span>${esc(type(a))}</span>${a.collectionYear?`<b>${a.collectionYear}</b>`:''}</div><h3>${esc(a.title)}</h3><p>${esc(a.description)}</p><small>BY ${esc(a.author)} · ${fmtDate(a.publishedAt)}</small></div></a>`}
  function heroStory(a){return `<a class="collection-lead" href="${articleUrl(a)}"><div class="collection-lead-media">${image(a)}</div><div class="collection-lead-copy"><small>FEATURED ${esc(type(a))}</small><h2>${esc(a.title)}</h2><p>${esc(a.description)}</p><span>READ THE STORY →</span></div></a>`}
  function empty(meta){return `<section class="collection-empty"><div class="collection-empty-mark">NC</div><small>${meta.eyebrow}</small><h2>This desk is ready.</h2><p>${esc(meta.empty)}</p><span>Curated stories will appear here only after they are explicitly published to this collection.</span></section>`}

  function renderCollection(all){
    if(!collectionMeta[collection]) return;
    const page=$('.category-work-page'); if(!page)return;
    document.body.classList.add('curated-collection-active');
    const meta=collectionMeta[collection];
    let stories=all.filter(a=>a.collection===collection);
    if(platform)stories=stories.filter(a=>a.platforms.includes(platform));
    stories.sort((a,b)=>(b.collectionYear||0)-(a.collectionYear||0)||new Date(b.publishedAt||0)-new Date(a.publishedAt||0));
    const title=collection==='best-games'&&platform?`Best ${platformNames[platform]||platform} Games`:meta.title;
    const deck=collection==='best-games'&&platform?`Neural Critic's evolving recommendations for the best games to play on ${platformNames[platform]||platform}.`:meta.deck;
    document.title=`${title} · Neural Critic`;
    const years=[...new Set(stories.map(a=>a.collectionYear).filter(Boolean))].sort((a,b)=>b-a);
    const platformCounts=Object.entries(platformNames).map(([key,label])=>({key,label,count:all.filter(a=>a.collection==='best-games'&&a.platforms.includes(key)).length}));
    const lead=stories[0]; const rest=stories.slice(1);
    page.innerHTML=`<div class="collection-page">
      <section class="collection-hero"><small>${meta.eyebrow}</small><h1>${esc(title)}</h1><p>${esc(deck)}</p><div class="collection-hero-meta"><span>${stories.length} ${stories.length===1?'PUBLISHED STORY':'PUBLISHED STORIES'}</span>${years.length?`<span>·</span><span>${years.length} ${years.length===1?'EDITION':'EDITIONS'}</span>`:''}<a href="category.html?section=what-to-play">WHAT TO PLAY →</a></div></section>
      ${collection==='best-games'?`<nav class="collection-platform-nav"><a class="${!platform?'active':''}" href="${collectionUrl({collection:'best-games'})}">ALL</a>${platformCounts.slice(0,4).map(x=>`<a class="${platform===x.key?'active':''}" href="${collectionUrl({collection:'best-games',platform:x.key})}">${x.label}<span>${x.count}</span></a>`).join('')}</nav>`:''}
      ${years.length?`<div class="collection-years"><span>EDITIONS</span>${years.map(y=>`<a href="#edition-${y}">${y}</a>`).join('')}</div>`:''}
      ${lead?heroStory(lead):empty(meta)}
      ${rest.length?`<section class="collection-feed"><div class="collection-section-head"><small>${collection==='game-of-the-year'?'AWARDS ARCHIVE':'CURATED LIBRARY'}</small><h2>${collection==='game-of-the-year'?'Every published edition.':'More from this collection.'}</h2></div><div class="collection-story-grid">${rest.map(card).join('')}</div></section>`:''}
      ${collection==='game-of-the-year'&&years.length?`<section class="collection-editions"><div class="collection-section-head"><small>YEAR BY YEAR</small><h2>Game of the Year archive.</h2></div>${years.map(y=>`<div class="collection-edition" id="edition-${y}"><div><small>EDITION</small><strong>${y}</strong></div><div>${stories.filter(a=>a.collectionYear===y).map(card).join('')}</div></div>`).join('')}</section>`:''}
    </div>`;
  }

  async function initPublic(){if(!collectionMeta[collection])return;try{renderCollection(await loadArticles())}catch(e){console.error('Curated collection failed',e);renderCollection([])}}

  function showYearField(){const label=$('.collection-year-field');if(!label)return;const value=$('#article-collection')?.value||'';const show=Boolean(value);label.hidden=!show;const input=$('#collection-year');if(show&&input&&!input.value&&['game-of-the-year','best-games','upcoming-games'].includes(value))input.value=String(new Date().getFullYear());if(!show&&input)input.value='';}
  async function loadYear(slug){const client=window.neuralCriticSupabase;if(!client||!slug)return;const {data}=await client.from('articles').select('collection_year').eq('slug',slug).maybeSingle();const input=$('#collection-year');if(input&&data)input.value=data.collection_year||'';showYearField()}
  async function syncYear(attempt=0){const client=window.neuralCriticSupabase,slug=$('#slug')?.value?.trim();if(!client||!slug)return;try{const raw=$('#collection-year')?.value?.trim();const payload={collection_year:raw?Number(raw):null};const {data,error}=await client.from('articles').update(payload).eq('slug',slug).select('id').maybeSingle();if(error)throw error;if(!data&&attempt<4)setTimeout(()=>syncYear(attempt+1),450)}catch(e){console.error('Collection year sync failed',e)}}
  function initStudio(){
    const install=()=>{const grid=$('.publication-taxonomy-grid');if(!grid||$('.collection-year-field'))return false;const collectionSelect=$('#article-collection');if(!collectionSelect)return false;collectionSelect.closest('label')?.insertAdjacentHTML('afterend','<label class="collection-year-field" hidden>EDITION / YEAR<input id="collection-year" type="number" min="1970" max="2100" placeholder="2026"><small>Optional. Use this for GOTY editions, annual Best Games lists, and release-year collections.</small></label>');collectionSelect.addEventListener('change',showYearField);['#save-draft','#schedule-story','#publish-story'].forEach(sel=>$(sel)?.addEventListener('click',()=>setTimeout(()=>syncYear(),900)));$('#story-library')?.addEventListener('click',e=>{const edit=e.target.closest('[data-edit]');if(edit)setTimeout(()=>loadYear(edit.dataset.edit),350)});const slug=$('#slug')?.value?.trim();if(slug)loadYear(slug);showYearField();return true};
    if(install())return;let tries=0;const timer=setInterval(()=>{if(install()||++tries>30)clearInterval(timer)},150);
  }

  if(document.body.classList.contains('studio-body')){if(document.readyState==='complete')initStudio();else window.addEventListener('load',initStudio,{once:true});}
  else {if(document.readyState==='complete')initPublic();else window.addEventListener('load',initPublic,{once:true});}
})();