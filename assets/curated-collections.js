(() => {
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const esc = (v='') => String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const params = new URLSearchParams(location.search);
  const collection = params.get('collection');
  const platform = params.get('platform');
  const requestedYear = Number(params.get('year')) || null;
  const platformNames = {pc:'PC',playstation:'PlayStation',xbox:'Xbox',nintendo:'Nintendo',mobile:'Mobile'};
  const collectionMeta = {
    'game-of-the-year': {eyebrow:'NEURAL CRITIC AWARDS',title:'Game of the Year',deck:'The annual Neural Critic awards — finalists, winners, and the games that defined each year.',empty:'Our first Game of the Year edition has not been published yet.'},
    'best-games': {eyebrow:'CURATED PICKS',title:'Best Games',deck:'Living recommendation lists built to answer one question: what is genuinely worth your time?',empty:'The Best Games desk is ready for its first curated list.'},
    'all-time-greats': {eyebrow:'THE ESSENTIALS',title:'Best Games of All Time',deck:'The permanent Neural Critic canon — landmark games we consider essential across generations.',empty:'The Neural Critic all-time canon has not been published yet.'},
    'upcoming-games': {eyebrow:'ON THE RADAR',title:'Upcoming Games',deck:'The releases we are watching before launch, from imminent arrivals to long-range standouts.',empty:'The Upcoming Games desk is ready for its first watchlist.'}
  };

  const articleUrl = a => `article.html?slug=${encodeURIComponent(a.slug)}`;
  const collectionUrl = values => `category.html?${new URLSearchParams(Object.entries(values).filter(([,v])=>v!==null&&v!==undefined&&v!=='')).toString()}`;

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
  function heroStory(a){return `<a class="collection-lead" href="${articleUrl(a)}"><div class="collection-lead-media">${image(a)}</div><div class="collection-lead-copy"><small>FEATURED ${esc(type(a))}${a.collectionYear?` · ${a.collectionYear}`:''}</small><h2>${esc(a.title)}</h2><p>${esc(a.description)}</p><span>READ THE STORY →</span></div></a>`}
  function empty(meta,title){return `<section class="collection-empty"><div class="collection-empty-mark">NC</div><small>${meta.eyebrow}</small><h2>${requestedYear?`${esc(title)} is ready.`:'This desk is ready.'}</h2><p>${requestedYear?`No curated stories have been published for ${requestedYear} yet.`:esc(meta.empty)}</p><span>Curated stories appear here only after they are explicitly published to this collection in Editorial Studio.</span></section>`}

  function titleAndDeck(meta){
    let title=collection==='best-games'&&platform?`Best ${platformNames[platform]||platform} Games`:meta.title;
    let deck=collection==='best-games'&&platform?`Neural Critic's evolving recommendations for the best games to play on ${platformNames[platform]||platform}.`:meta.deck;
    if(requestedYear){
      if(collection==='game-of-the-year'){title=`Game of the Year ${requestedYear}`;deck=`Neural Critic's ${requestedYear} awards edition — the games that defined the year and the final Game of the Year verdict.`;}
      else if(collection==='best-games'&&platform){title=`Best ${platformNames[platform]||platform} Games of ${requestedYear}`;deck=`Our curated ${requestedYear} recommendations for ${platformNames[platform]||platform} players.`;}
      else if(collection==='best-games'){title=`Best Games of ${requestedYear}`;deck=`The Neural Critic games we most recommend from ${requestedYear}.`;}
      else if(collection==='upcoming-games'){title=`Upcoming Games in ${requestedYear}`;deck=`The ${requestedYear} releases on Neural Critic's radar.`;}
    }
    return {title,deck};
  }

  function renderCollection(all){
    if(!collectionMeta[collection]) return;
    const page=$('.category-work-page'); if(!page)return;
    document.body.classList.add('curated-collection-active');
    const meta=collectionMeta[collection];
    let baseStories=all.filter(a=>a.collection===collection);
    if(platform)baseStories=baseStories.filter(a=>a.platforms.includes(platform));
    baseStories.sort((a,b)=>(b.collectionYear||0)-(a.collectionYear||0)||new Date(b.publishedAt||0)-new Date(a.publishedAt||0));
    const years=[...new Set(baseStories.map(a=>a.collectionYear).filter(Boolean))].sort((a,b)=>b-a);
    const stories=requestedYear?baseStories.filter(a=>a.collectionYear===requestedYear):baseStories;
    const {title,deck}=titleAndDeck(meta);
    document.title=`${title} · Neural Critic`;
    const platformCounts=Object.entries(platformNames).map(([key,label])=>({key,label,count:all.filter(a=>a.collection==='best-games'&&a.platforms.includes(key)).length}));
    const lead=stories[0]; const rest=stories.slice(1);
    const archiveLabel=requestedYear?`${requestedYear} EDITION`:(collection==='game-of-the-year'?'AWARDS ARCHIVE':'CURATED LIBRARY');
    const archiveHeading=requestedYear?`Published in ${requestedYear}.`:(collection==='game-of-the-year'?'Every published edition.':'More from this collection.');
    page.innerHTML=`<div class="collection-page">
      <section class="collection-hero"><small>${meta.eyebrow}</small><h1>${esc(title)}</h1><p>${esc(deck)}</p><div class="collection-hero-meta"><span>${stories.length} ${stories.length===1?'PUBLISHED STORY':'PUBLISHED STORIES'}</span>${years.length?`<span>·</span><span>${years.length} ${years.length===1?'EDITION':'EDITIONS'}</span>`:''}<a href="category.html?section=what-to-play">WHAT TO PLAY →</a></div></section>
      ${collection==='best-games'?`<nav class="collection-platform-nav"><a class="${!platform?'active':''}" href="${collectionUrl({collection:'best-games',year:requestedYear})}">ALL</a>${platformCounts.slice(0,4).map(x=>`<a class="${platform===x.key?'active':''}" href="${collectionUrl({collection:'best-games',platform:x.key,year:requestedYear})}">${x.label}<span>${x.count}</span></a>`).join('')}</nav>`:''}
      ${years.length?`<div class="collection-years"><span>EDITIONS</span><a class="${!requestedYear?'active':''}" href="${collectionUrl({collection,platform})}">ALL</a>${years.map(y=>`<a class="${requestedYear===y?'active':''}" href="${collectionUrl({collection,platform,year:y})}">${y}</a>`).join('')}</div>`:''}
      ${lead?heroStory(lead):empty(meta,title)}
      ${rest.length?`<section class="collection-feed"><div class="collection-section-head"><small>${archiveLabel}</small><h2>${archiveHeading}</h2></div><div class="collection-story-grid">${rest.map(card).join('')}</div></section>`:''}
      ${collection==='game-of-the-year'&&!requestedYear&&years.length?`<section class="collection-editions"><div class="collection-section-head"><small>YEAR BY YEAR</small><h2>Game of the Year archive.</h2></div>${years.map(y=>`<div class="collection-edition" id="edition-${y}"><div><small>EDITION</small><strong>${y}</strong><a href="${collectionUrl({collection:'game-of-the-year',year:y})}">OPEN EDITION →</a></div><div>${baseStories.filter(a=>a.collectionYear===y).map(card).join('')}</div></div>`).join('')}</section>`:''}
    </div>`;
  }

  async function initPublic(){if(!collectionMeta[collection])return;try{renderCollection(await loadArticles())}catch(e){console.error('Curated collection failed',e);renderCollection([])}}

  function collectionPreviewUrl(){
    const value=$('#article-collection')?.value||'';
    if(!value)return'';
    const raw=$('#collection-year')?.value?.trim();
    const checked=$$('.publication-platform-options input:checked').map(x=>x.value);
    const values={collection:value};
    if(value==='best-games'&&checked.length===1)values.platform=checked[0];
    if(raw)values.year=raw;
    return collectionUrl(values);
  }
  function updateStudioPreview(){
    const link=$('#collection-preview-link'); if(!link)return;
    const url=collectionPreviewUrl();
    link.hidden=!url;
    if(url)link.href=url;
  }
  function showYearField(){
    const label=$('.collection-year-field');if(!label)return;
    const value=$('#article-collection')?.value||'';
    const show=Boolean(value);label.hidden=!show;
    const input=$('#collection-year');
    const caption=$('.collection-year-label');
    if(caption)caption.textContent=value==='game-of-the-year'?'AWARDS YEAR':value==='upcoming-games'?'RELEASE YEAR':'EDITION / YEAR';
    if(show&&input&&!input.value&&['game-of-the-year','best-games','upcoming-games'].includes(value))input.value=String(new Date().getFullYear());
    if(!show&&input)input.value='';
    updateStudioPreview();
  }
  async function loadYear(slug){const client=window.neuralCriticSupabase;if(!client||!slug)return;const {data}=await client.from('articles').select('collection_year').eq('slug',slug).maybeSingle();const input=$('#collection-year');if(input&&data)input.value=data.collection_year||'';showYearField()}
  async function syncYear(attempt=0){
    const client=window.neuralCriticSupabase,slug=$('#slug')?.value?.trim();if(!client||!slug)return;
    try{
      const raw=$('#collection-year')?.value?.trim();
      const value=raw?Number(raw):null;
      if(value&&(value<1970||value>2100))throw new Error('Collection year must be between 1970 and 2100.');
      const {data,error}=await client.from('articles').update({collection_year:value}).eq('slug',slug).select('id').maybeSingle();
      if(error)throw error;
      if(!data&&attempt<4)setTimeout(()=>syncYear(attempt+1),450);
    }catch(e){console.error('Collection year sync failed',e)}
  }
  function initStudio(){
    const install=()=>{
      const grid=$('.publication-taxonomy-grid');if(!grid||$('.collection-year-field'))return false;
      const collectionSelect=$('#article-collection');if(!collectionSelect)return false;
      collectionSelect.closest('label')?.insertAdjacentHTML('afterend','<label class="collection-year-field" hidden><span class="collection-year-label">EDITION / YEAR</span><input id="collection-year" type="number" min="1970" max="2100" placeholder="2026"><small>Optional edition metadata for annual awards, Best Games lists, and release-year collections.</small></label>');
      const status=$('#publication-taxonomy-status');status?.insertAdjacentHTML('afterend','<a id="collection-preview-link" class="collection-preview-link" href="#" target="_blank" rel="noopener" hidden>PREVIEW COLLECTION PAGE →</a>');
      collectionSelect.addEventListener('change',showYearField);
      $('#collection-year')?.addEventListener('input',updateStudioPreview);
      $$('.publication-platform-options input').forEach(x=>x.addEventListener('change',updateStudioPreview));
      ['#save-draft','#schedule-story','#publish-story'].forEach(sel=>$(sel)?.addEventListener('click',()=>setTimeout(()=>syncYear(),900)));
      $('#story-library')?.addEventListener('click',e=>{const edit=e.target.closest('[data-edit]');if(edit)setTimeout(()=>loadYear(edit.dataset.edit),350)});
      const slug=$('#slug')?.value?.trim();if(slug)loadYear(slug);showYearField();return true;
    };
    if(install())return;let tries=0;const timer=setInterval(()=>{if(install()||++tries>30)clearInterval(timer)},150);
  }

  if(document.body.classList.contains('studio-body')){if(document.readyState==='complete')initStudio();else window.addEventListener('load',initStudio,{once:true});}
  else {if(document.readyState==='complete')initPublic();else window.addEventListener('load',initPublic,{once:true});}
})();