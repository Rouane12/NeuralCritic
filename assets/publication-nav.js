(() => {
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const esc = (v='') => String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const platformNames = {pc:'PC',playstation:'PlayStation',xbox:'Xbox',nintendo:'Nintendo',mobile:'Mobile'};
  const sectionNames = {news:'News',reviews:'Reviews',guides:'Guides','what-to-play':'What to Play',features:'Features'};
  const collectionNames = {'game-of-the-year':'Game of the Year','best-games':'Best Games','upcoming-games':'Upcoming Games',recommendations:'Recommendations','all-time-greats':'Best Games of All Time'};

  function addStyles(){
    const existing = $$('link[rel="stylesheet"]').find(link => {
      try { return new URL(link.href, document.baseURI).pathname.endsWith('/assets/publication-nav.css'); }
      catch (_) { return false; }
    });
    if (existing) { existing.dataset.publicationNav='1'; return; }
    if ($('link[data-publication-nav]')) return;
    const link=document.createElement('link'); link.rel='stylesheet'; link.href='assets/publication-nav.css'; link.dataset.publicationNav='1'; document.head.appendChild(link);
  }

  const categoryUrl = params => {
    const section=String(params?.section||'').trim();
    if(section==='reviews'||section==='guides'){
      const platform=String(params?.platform||'').trim();
      return `${section}/${platform?`?platform=${encodeURIComponent(platform)}`:''}`;
    }
    return `category.html?${new URLSearchParams(params).toString()}`;
  };

  function navMarkup(){
    const platformLinks = section => Object.entries(platformNames).map(([key,label])=>`<a href="${categoryUrl({section,platform:key})}"><b>${label}</b><small>${label} ${sectionNames[section].toLowerCase()}</small></a>`).join('');
    const group = (key,label,featured,links) => `<div class="nav-group" data-nav-section="${key}">
      <a class="nav-primary" href="${categoryUrl({section:key})}">${label}</a>
      <button class="nav-trigger" type="button" aria-label="Open ${label} menu" aria-expanded="false" aria-controls="publication-submenu-${key}"><span aria-hidden="true">⌄</span></button>
      <div class="nav-menu" id="publication-submenu-${key}">${featured}<span class="nav-menu-label">EXPLORE</span>${links}</div>
    </div>`;
    return `
      ${group('news','News',`<a class="nav-featured" href="${categoryUrl({section:'news'})}"><b>Latest News</b><small>Releases, announcements, industry moves, and developing stories.</small></a>`,platformLinks('news'))}
      ${group('reviews','Reviews',`<a class="nav-featured" href="${categoryUrl({section:'reviews'})}"><b>Latest Reviews</b><small>Scores, verdicts, and criticism that explains the experience.</small></a>`,platformLinks('reviews'))}
      ${group('guides','Guides',`<a class="nav-featured" href="${categoryUrl({section:'guides'})}"><b>Game Guides</b><small>Walkthroughs, builds, tips, and focused player help.</small></a>`,platformLinks('guides'))}
      <a class="nav-direct" href="${categoryUrl({section:'features'})}">Features</a>
      ${group('what-to-play','What to Play',`<a class="nav-featured" href="${categoryUrl({section:'what-to-play'})}"><b>What to Play</b><small>Recommendations, rankings, awards, and essential games.</small></a>`,`
        <a href="${categoryUrl({collection:'game-of-the-year'})}"><b>Game of the Year</b><small>Annual awards and defining games.</small></a>
        <a href="${categoryUrl({collection:'all-time-greats'})}"><b>Best Games of All Time</b><small>The Neural Critic canon.</small></a>
        <a href="${categoryUrl({collection:'best-games'})}"><b>Best Games</b><small>Curated picks across platforms.</small></a>
        <a href="${categoryUrl({collection:'upcoming-games'})}"><b>Upcoming Games</b><small>Releases worth keeping on your radar.</small></a>`)}
      <a class="nav-direct" href="games/">Games</a>`;
  }

  function installNav(){
    const nav=$('#shared-header header nav'); if(!nav || nav.dataset.publicationReady) return;
    nav.dataset.publicationReady='1'; nav.className='publication-nav'; nav.innerHTML=navMarkup();
    const setOpen=(group,open)=>{
      if(!group)return;
      group.classList.toggle('open',open);
      const button=$('.nav-trigger',group);
      if(button){button.setAttribute('aria-expanded',String(open));button.setAttribute('aria-label',`${open?'Close':'Open'} ${$('.nav-primary',group)?.textContent?.trim()||'section'} menu`)}
    };
    $$('.nav-trigger',nav).forEach(button=>button.addEventListener('click',()=>{
      const owner=button.closest('.nav-group');
      const next=!owner?.classList.contains('open');
      $$('.nav-group',nav).forEach(group=>setOpen(group,group===owner&&next));
    }));
    nav.addEventListener('click',event=>{if(event.target.closest('.nav-menu a,.nav-primary,.nav-direct')) $$('.nav-group',nav).forEach(group=>setOpen(group,false))});
    document.addEventListener('click',event=>{if(!event.target.closest('.publication-nav')) $$('.nav-group',nav).forEach(group=>setOpen(group,false))});
    document.addEventListener('keydown',event=>{
      if(event.key!=='Escape')return;
      const open=$('.nav-group.open',nav);if(!open)return;
      event.preventDefault();const button=$('.nav-trigger',open);setOpen(open,false);button?.focus();
    });
  }

  function inferSection(article){
    if(article.editorialSection) return article.editorialSection;
    const cat=String(article.category||'').toLowerCase(), format=String(article.articleFormat||'').toLowerCase();
    if(format==='review'||cat==='review') return 'reviews';
    if(format==='game-guide'||cat==='guide') return 'guides';
    if(cat==='news') return 'news';
    return 'features';
  }
  function inferPlatforms(article){
    if(Array.isArray(article.platforms)&&article.platforms.length) return article.platforms.map(x=>String(x).toLowerCase());
    const tags=(article.tags||[]).map(x=>String(x).toLowerCase());
    const out=[];
    if(tags.some(x=>x==='pc')) out.push('pc');
    if(tags.some(x=>['playstation','ps5','ps4'].includes(x))) out.push('playstation');
    if(tags.some(x=>['xbox','xbox series x','xbox series x/s'].includes(x))) out.push('xbox');
    if(tags.some(x=>['nintendo','switch','switch 2','nintendo switch','nintendo switch 2'].includes(x))) out.push('nintendo');
    if(tags.some(x=>['mobile','ios','android'].includes(x))) out.push('mobile');
    return out;
  }
  function mapRow(r){return {slug:r.slug,title:r.title,description:r.description||'',category:r.category||'FEATURE',author:r.author_name||'Neural Critic',tags:r.tags||[],articleFormat:r.article_format||'standard',imageLocal:r.image_url||'',imageAlt:r.image_alt||'',publishedAt:r.published_at,contentBlocks:r.content_blocks||[],editorialSection:r.editorial_section||null,platforms:Array.isArray(r.platforms)?r.platforms:[],collection:r.collection||null};}

  async function loadTaxonomyArticles(){
    const client=window.neuralCriticPublicSupabase;
    if(client){
      const {data,error}=await client.from('articles').select('*').eq('status','published').lte('published_at',new Date().toISOString()).order('published_at',{ascending:false});
      if(!error) return (data||[]).map(mapRow);
    }
    try{return await fetch('data/articles.json').then(r=>r.json())}catch(_){return[]}
  }
  function readMinutes(article){const text=[article.body||'',...(article.contentBlocks||[]).map(x=>x.text||'')].join(' ');return Math.max(1,Math.ceil(text.trim().split(/\s+/).filter(Boolean).length/220));}
  function fmtDate(iso){try{return new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(iso))}catch(_){return''}}
  function cardImage(a){return a.imageLocal?`<img src="${esc(a.imageLocal)}" alt="${esc(a.imageAlt||a.title)}">`:'<div class="placeholder-art">NEURAL CRITIC</div>'}
  const href=a=>`stories/${encodeURIComponent(a.slug)}/`;
  function spotlightCard(a,side=false){return `<a class="${side?'':'category-spotlight-main'}" href="${href(a)}">${cardImage(a)}<div class="category-spotlight-shade"></div><div class="category-spotlight-copy"><span>${esc(sectionNames[inferSection(a)]||a.category||'STORY')}</span><h2>${esc(a.title)}</h2><p>${esc(a.description||'')}</p><small>BY ${esc(a.author||'Neural Critic')} · ${readMinutes(a)} MIN READ · ${fmtDate(a.publishedAt)}</small></div></a>`}

  function viewMeta(params){
    const section=params.get('section'), platform=params.get('platform'), collection=params.get('collection');
    if(collection==='game-of-the-year') return {title:'Neural Critic Game of the Year',deck:'Our annual awards, finalists, winners and the games that defined each year.'};
    if(collection==='all-time-greats') return {title:'Best Games of All Time',deck:'The essential games Neural Critic believes every player should know — across generations and platforms.'};
    if(collection==='upcoming-games') return {title:'Upcoming Games',deck:'The releases we are watching, from imminent launches to the most promising games on the horizon.'};
    if(collection==='best-games'&&platform) return {title:`Best ${platformNames[platform]||platform} Games`,deck:`Our evolving list of the best games to play on ${platformNames[platform]||platform}.`};
    if(collection==='best-games') return {title:'Best Games',deck:'Curated recommendations and ranked lists for players deciding what to play next.'};
    if(section&&platform) return {title:`${platformNames[platform]||platform} ${sectionNames[section]||section}`,deck:`The latest ${sectionNames[section]?.toLowerCase()||section} for ${platformNames[platform]||platform} players.`};
    if(section==='what-to-play') return {title:'What to Play',deck:'Neural Critic recommendations, rankings, awards and essential games worth your time.'};
    if(section) return {title:sectionNames[section]||section,deck:{news:'Fresh gaming news, announcements, releases and industry developments.',reviews:'Clear verdicts, useful context and criticism that explains the experience behind the score.',guides:'Focused walkthroughs, builds, tips and practical help for the games you play.',features:'Long-form analysis, rankings and stories about the ideas shaping games.'}[section]||'Neural Critic coverage.'};
    return null;
  }

  async function renderTaxonomyCategory(){
    const page=$('.category-work-page'); if(!page) return;
    const params=new URLSearchParams(location.search); const section=params.get('section'), platform=params.get('platform'), collection=params.get('collection');
    if(!section&&!platform&&!collection) return;
    const meta=viewMeta(params); if(!meta) return;
    page.querySelector('.category-work-hero')?.setAttribute('data-publication-view','1');
    document.title=`${meta.title} · Neural Critic`; $('#category-title').textContent=meta.title; $('#category-deck').textContent=meta.deck; $('#category-latest-label').textContent=`LATEST IN ${meta.title.toUpperCase()}`;
    let all=await loadTaxonomyArticles(); all.sort((a,b)=>new Date(b.publishedAt||0)-new Date(a.publishedAt||0));
    const current=all.filter(a=>{
      if(section&&inferSection(a)!==section) return false;
      if(platform&&!inferPlatforms(a).includes(platform)) return false;
      if(collection&&String(a.collection||'')!==collection) return false;
      return true;
    });
    $('#category-count').textContent=`${current.length} ${current.length===1?'STORY':'STORIES'}`;
    const hero=$('.category-work-hero'); let chips=$('.category-taxonomy-chips',hero); if(!chips){chips=document.createElement('div');chips.className='category-taxonomy-chips';hero.appendChild(chips)}
    if(section){chips.innerHTML=`<a class="${!platform?'active':''}" href="${categoryUrl({section})}">All</a>${Object.entries(platformNames).map(([key,label])=>`<a class="${platform===key?'active':''}" href="${categoryUrl({section,platform:key})}">${label}</a>`).join('')}`}
    else if(collection==='best-games'){chips.innerHTML=`<a class="${!platform?'active':''}" href="${categoryUrl({collection})}">All Platforms</a>${Object.entries(platformNames).slice(0,4).map(([key,label])=>`<a class="${platform===key?'active':''}" href="${categoryUrl({collection,platform:key})}">${label}</a>`).join('')}`}
    else chips.innerHTML='';
    const spot=$('#category-spotlight');
    if(!current.length){spot.className='category-empty';spot.innerHTML='<b>0</b><h2>This desk is ready.</h2><p>Publish the first story for this section from Editorial Studio.</p><a href="studio.html">OPEN EDITORIAL STUDIO →</a>';$('#category-feed-section').hidden=true;return}
    const top=current.slice(0,3);spot.className=`category-spotlight${top.length===1?' single':''}`;spot.innerHTML=spotlightCard(top[0])+(top.length>1?`<div class="category-spotlight-side${top.length===2?' one':''}">${top.slice(1).map(a=>spotlightCard(a,true)).join('')}</div>`:'');
    const rest=current.slice(3), feed=$('#category-feed'), sectionHost=$('#category-feed-section'); sectionHost.hidden=!rest.length; if(rest.length) feed.innerHTML=rest.map(a=>`<a class="category-feed-card" href="${href(a)}"><div class="category-feed-media">${cardImage(a)}</div><div class="category-feed-copy"><span>${esc(sectionNames[inferSection(a)]||a.category||'STORY')}</span><h3>${esc(a.title)}</h3><p>${esc(a.description||'')}</p><small>BY ${esc(a.author||'Neural Critic')} · ${readMinutes(a)} MIN READ · ${fmtDate(a.publishedAt)}</small></div></a>`).join('');
    const trending=$('#category-trending'); if(trending) trending.innerHTML=all.slice(0,3).map((a,i)=>`<a href="${href(a)}"><b>${String(i+1).padStart(2,'0')}</b><div><strong>${esc(a.title)}</strong><small>${fmtDate(a.publishedAt)}</small></div></a>`).join('');
  }

  function taxonomyPanel(){return `<section class="studio-panel publication-taxonomy-panel"><div class="publication-taxonomy-head"><div><small>PUBLICATION DESK</small><h2>Where this story lives</h2><p>Separate the story type from the platform. One review can belong to Reviews and still target PC, PlayStation, or several platforms.</p></div></div><div class="publication-taxonomy-grid"><label>EDITORIAL DESK<select id="editorial-section"><option value="features">Features</option><option value="news">News</option><option value="reviews">Reviews</option><option value="guides">Guides</option><option value="what-to-play">What to Play</option></select></label><label>COLLECTION<select id="article-collection"><option value="">None</option><option value="game-of-the-year">Game of the Year</option><option value="best-games">Best Games</option><option value="all-time-greats">Best Games of All Time</option><option value="upcoming-games">Upcoming Games</option><option value="recommendations">Recommendations</option></select></label><fieldset class="publication-platforms"><legend>PLATFORMS</legend><div class="publication-platform-options">${Object.entries(platformNames).map(([key,label])=>`<label><input type="checkbox" value="${key}">${label}</label>`).join('')}</div></fieldset><p class="publication-taxonomy-note"><b>Tip:</b> Game of the Year and Best Games articles work especially well with the Ranked List format. Platform choices now drive the public navigation automatically.</p></div><div class="publication-taxonomy-status" id="publication-taxonomy-status"></div></section>`}
  function selectedPlatforms(){return $$('.publication-platform-options input:checked').map(x=>x.value)}
  function setStudioTaxonomy(data={}){const section=$('#editorial-section'),collection=$('#article-collection');if(section)section.value=data.editorial_section||data.editorialSection||'features';if(collection)collection.value=data.collection||'';const platforms=Array.isArray(data.platforms)?data.platforms:[];$$('.publication-platform-options input').forEach(x=>x.checked=platforms.includes(x.value))}
  async function loadStoryTaxonomy(slug){const client=window.neuralCriticSupabase;if(!client||!slug)return;const {data}=await client.from('articles').select('editorial_section,platforms,collection').eq('slug',slug).maybeSingle();if(data)setStudioTaxonomy(data)}
  async function syncStoryTaxonomy(attempt=0){
    const client=window.neuralCriticSupabase, slug=$('#slug')?.value?.trim(); if(!client||!slug)return;
    const status=$('#publication-taxonomy-status'); if(status){status.textContent='Syncing publication taxonomy…';status.classList.remove('error')}
    try{const {data:{user}}=await client.auth.getUser();if(!user)return;const payload={editorial_section:$('#editorial-section')?.value||'features',platforms:selectedPlatforms(),collection:$('#article-collection')?.value||null,updated_by:user.id};const {data,error}=await client.from('articles').update(payload).eq('slug',slug).select('id').maybeSingle();if(error)throw error;if(!data&&attempt<4){setTimeout(()=>syncStoryTaxonomy(attempt+1),450);return}if(status)status.textContent='Publication desk synced to database.'}catch(error){if(status){status.textContent=error.message||'Taxonomy sync failed.';status.classList.add('error')}}
  }
  function installStudioTaxonomy(){
    const form=$('#article-form'); if(!form||$('.publication-taxonomy-panel')) return;
    const firstFields=$('.studio-fields',form); firstFields?.insertAdjacentHTML('beforebegin',taxonomyPanel());
    const suggest=()=>{const format=$('.format-card.active')?.dataset.format,cat=$('#category')?.value;if($('#article-collection')?.value){$('#editorial-section').value='what-to-play';return}if(format==='review')$('#editorial-section').value='reviews';else if(format==='game-guide')$('#editorial-section').value='guides';else if(cat==='NEWS')$('#editorial-section').value='news'};
    $$('.format-card').forEach(b=>b.addEventListener('click',()=>setTimeout(suggest,0)));$('#category')?.addEventListener('change',suggest);$('#article-collection')?.addEventListener('change',()=>{if($('#article-collection').value)$('#editorial-section').value='what-to-play'});
    $('#editorial-section')?.addEventListener('change',()=>{const s=$('#editorial-section').value;if(s==='reviews')$('#category').value='REVIEW';else if(s==='guides')$('#category').value='GUIDE';else if(s==='news')$('#category').value='NEWS';else if(['features','what-to-play'].includes(s)&&['REVIEW','GUIDE','NEWS'].includes($('#category').value))$('#category').value='FEATURE'});
    ['#save-draft','#schedule-story','#publish-story'].forEach(sel=>$(sel)?.addEventListener('click',()=>setTimeout(()=>syncStoryTaxonomy(),700)));
    $('#story-library')?.addEventListener('click',e=>{const edit=e.target.closest('[data-edit]');if(edit)setTimeout(()=>loadStoryTaxonomy(edit.dataset.edit),250)});
    const slug=$('#slug')?.value?.trim();if(slug)loadStoryTaxonomy(slug);
  }

  function init(){addStyles();if(document.body.classList.contains('studio-body'))installStudioTaxonomy();else{installNav();renderTaxonomyCategory();}}
  if(document.readyState==='complete') init(); else window.addEventListener('load',init,{once:true});
})();
