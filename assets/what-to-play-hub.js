(() => {
  const params = new URLSearchParams(location.search);
  if (params.get('section') !== 'what-to-play' || params.get('platform') || params.get('collection')) return;

  document.body.classList.add('wtp-active');

  const esc = (value='') => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const categoryUrl = values => `category.html?${new URLSearchParams(values).toString()}`;
  const articleUrl = article => `article.html?slug=${encodeURIComponent(article.slug)}`;
  const platformNames = {pc:'PC',playstation:'PlayStation',xbox:'Xbox',nintendo:'Nintendo'};
  const collectionDefs = [
    {key:'game-of-the-year',title:'Game of the Year',eyebrow:'ANNUAL AWARDS',copy:'The year’s strongest games, tracked from contenders to the final verdict.',empty:'Awards desk opening soon'},
    {key:'best-games',title:'Best Games',eyebrow:'CURATED PICKS',copy:'Living recommendations for deciding what genuinely deserves your time.',empty:'Curated picks incoming'},
    {key:'all-time-greats',title:'Best Games of All Time',eyebrow:'THE ESSENTIALS',copy:'The essential games Neural Critic would put in any permanent library.',empty:'The canon is taking shape'},
    {key:'upcoming-games',title:'Upcoming Games',eyebrow:'ON THE RADAR',copy:'The releases worth keeping on your radar before they arrive.',empty:'Watchlist opening soon'}
  ];

  function mapArticle(row){
    return {
      slug:row.slug,
      title:row.title,
      description:row.description || '',
      category:row.category || 'FEATURE',
      author:row.author_name || row.author || 'Neural Critic',
      tags:Array.isArray(row.tags) ? row.tags : [],
      articleFormat:row.article_format || row.articleFormat || 'standard',
      imageLocal:row.image_url || row.imageLocal || row.image || '',
      imageAlt:row.image_alt || row.imageAlt || row.title || '',
      publishedAt:row.published_at || row.publishedAt || '',
      body:row.body || '',
      contentBlocks:row.content_blocks || row.contentBlocks || [],
      conclusion:row.conclusion || '',
      editorialSection:row.editorial_section || row.editorialSection || null,
      platforms:Array.isArray(row.platforms) ? row.platforms.map(x=>String(x).toLowerCase()) : [],
      collection:row.collection || null
    };
  }

  async function loadArticles(){
    const client = window.neuralCriticPublicSupabase;
    if (client){
      const {data,error} = await client.from('articles').select('*').eq('status','published').lte('published_at',new Date().toISOString()).order('published_at',{ascending:false});
      if (!error) return (data || []).map(mapArticle);
    }
    try {
      const summary = await fetch('data/articles.json').then(r=>r.json());
      return (summary || []).map(mapArticle).sort((a,b)=>new Date(b.publishedAt||0)-new Date(a.publishedAt||0));
    } catch (_) { return []; }
  }

  function inferredPlatforms(article){
    if (article.platforms.length) return article.platforms;
    const tags = article.tags.map(x=>String(x).toLowerCase());
    const out = [];
    if (tags.includes('pc')) out.push('pc');
    if (tags.some(x=>['playstation','ps5','ps4'].includes(x))) out.push('playstation');
    if (tags.some(x=>['xbox','xbox series x','xbox series x/s'].includes(x))) out.push('xbox');
    if (tags.some(x=>['nintendo','switch','switch 2','nintendo switch','nintendo switch 2'].includes(x))) out.push('nintendo');
    return out;
  }

  function readMinutes(article){
    const text = [article.body,...article.contentBlocks.map(x=>x?.text || ''),article.conclusion].join(' ').trim();
    return Math.max(1,Math.ceil((text ? text.split(/\s+/).length : 220) / 220));
  }

  function fmtDate(iso){
    try { return new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(iso)); }
    catch (_) { return ''; }
  }

  function image(article){
    return article.imageLocal
      ? `<img src="${esc(article.imageLocal)}" alt="${esc(article.imageAlt || article.title)}">`
      : '<div class="wtp-placeholder">NEURAL CRITIC</div>';
  }

  function storyType(article){
    if (article.collection === 'game-of-the-year') return 'GAME OF THE YEAR';
    if (article.collection === 'all-time-greats') return 'ALL-TIME GREATS';
    if (article.collection === 'best-games') return 'BEST GAMES';
    if (article.collection === 'upcoming-games') return 'UPCOMING';
    if (article.articleFormat === 'review' || String(article.category).toLowerCase() === 'review') return 'REVIEW';
    if (article.articleFormat === 'ranked-list') return 'RANKED LIST';
    if (article.articleFormat === 'game-guide') return 'GUIDE';
    return 'WHAT TO PLAY';
  }

  function isCurated(article){
    return article.editorialSection === 'what-to-play' || Boolean(article.collection);
  }

  function uniqueStories(candidates,limit,exclude=[]){
    const skip = new Set(exclude.map(x=>x?.slug).filter(Boolean));
    const seen = new Set();
    const out = [];
    for (const article of candidates){
      if (!article || skip.has(article.slug) || seen.has(article.slug)) continue;
      seen.add(article.slug); out.push(article);
      if (out.length >= limit) break;
    }
    return out;
  }

  function collectionCard(def,curated){
    const stories = curated.filter(a=>a.collection === def.key);
    const count = stories.length;
    const latest = stories[0] || null;
    const media = latest?.imageLocal
      ? `<div class="wtp-collection-media"><img src="${esc(latest.imageLocal)}" alt="${esc(latest.imageAlt || latest.title)}"><div class="wtp-collection-storyline"><small>LATEST DESK PICK</small><strong>${esc(latest.title)}</strong></div></div>`
      : `<div class="wtp-collection-media wtp-collection-media-empty" aria-hidden="true"><span>NC</span><strong>${esc(def.empty)}</strong></div>`;
    return `<a class="wtp-collection ${count ? 'is-live' : 'is-empty'}" href="${categoryUrl({collection:def.key})}">
      <div class="wtp-collection-copy"><small>${def.eyebrow}</small><b>${def.title}</b><p>${def.copy}</p></div>
      ${media}
      <div class="wtp-collection-footer"><span class="wtp-desk-count ${count ? '' : 'empty'}">${count ? `${count} ${count===1?'STORY':'STORIES'}` : 'OPENING SOON'}</span><span class="wtp-collection-action">${count ? 'EXPLORE DESK' : 'VIEW DESK'} <b>→</b></span></div>
    </a>`;
  }

  function platformCard(key,label,curated){
    const count = curated.filter(a=>a.collection === 'best-games' && inferredPlatforms(a).includes(key)).length;
    return `<a class="wtp-platform" href="${categoryUrl({collection:'best-games',platform:key})}"><small>BEST ON</small><strong>${label}</strong><span>${count ? `${count} curated ${count===1?'pick':'picks'}` : 'Collection ready for picks'}</span><em>→</em></a>`;
  }

  function feedCard(article){
    return `<a class="wtp-story" href="${articleUrl(article)}"><div class="wtp-story-media">${image(article)}</div><div class="wtp-story-copy"><span>${esc(storyType(article))}</span><h3>${esc(article.title)}</h3><p>${esc(article.description)}</p><small>BY ${esc(article.author)} · ${readMinutes(article)} MIN READ · ${fmtDate(article.publishedAt)}</small></div></a>`;
  }

  function leadMarkup(article){
    if (!article) return `<div class="wtp-lead wtp-lead-empty"><div class="wtp-lead-media"><div class="wtp-placeholder">WHAT TO PLAY</div></div><div class="wtp-lead-copy"><span>DISCOVERY DESK</span><h2>Your next favorite game starts here.</h2><p>No recommendations have been published to What to Play yet. The first real pick will take over this space automatically when it is assigned in Editorial Studio.</p><a class="wtp-lead-cta" href="studio.html">OPEN EDITORIAL STUDIO →</a></div></div>`;
    const ranked = article.articleFormat === 'ranked-list' && article.contentBlocks.length > 0;
    const rankingMeta = ranked ? `${article.contentBlocks.length}-GAME RANKING · ` : '';
    const cta = ranked ? 'EXPLORE THE RANKING →' : 'READ THE PICK →';
    return `<a class="wtp-lead" href="${articleUrl(article)}"><div class="wtp-lead-media">${image(article)}</div><div class="wtp-lead-copy"><span>${esc(storyType(article))}</span><h2>${esc(article.title)}</h2><p>${esc(article.description)}</p><div class="wtp-lead-byline">${rankingMeta}BY ${esc(article.author)} · ${readMinutes(article)} MIN READ · ${fmtDate(article.publishedAt)}</div><div class="wtp-lead-cta">${cta}</div></div></a>`;
  }

  function render(all){
    all.sort((a,b)=>new Date(b.publishedAt||0)-new Date(a.publishedAt||0));
    const curated = all.filter(isCurated);
    const lead = curated[0] || null;
    const feed = uniqueStories(curated,8,[lead]);

    const main = document.querySelector('.category-work-page');
    if (!main) return;
    const oldHub = main.querySelector('.wtp-hub'); if (oldHub) oldHub.remove();
    document.title = 'What to Play · Neural Critic';
    const hub = document.createElement('div'); hub.className = 'wtp-hub';
    hub.innerHTML = `
      <section class="wtp-hero-copy"><small class="wtp-eyebrow">NEURAL CRITIC RECOMMENDS</small><h1>Find your next game.</h1><p>Reviews, rankings, essential picks, and upcoming releases — but only when Neural Critic has explicitly published them to this desk.</p><div class="wtp-hero-meta"><span>${curated.length} CURATED ${curated.length===1?'STORY':'STORIES'}</span><span>·</span><a href="search.html">SEARCH THE ARCHIVE →</a></div></section>
      ${leadMarkup(lead)}
      <section class="wtp-section wtp-desks-section"><div class="wtp-section-head"><div><small>CURATED DESKS</small><h2>Go straight to the good stuff.</h2></div><p>Hand-built collections for readers who want a fast route to Neural Critic’s strongest recommendations.</p></div><div class="wtp-collections">${collectionDefs.map(def=>collectionCard(def,curated)).join('')}</div></section>
      <section class="wtp-section"><div class="wtp-section-head"><div><small>CHOOSE YOUR PLATFORM</small><h2>What are you playing on?</h2></div><p>Platform lanes only count Best Games stories deliberately published for that platform.</p></div><div class="wtp-platforms">${Object.entries(platformNames).map(([key,label])=>platformCard(key,label,curated)).join('')}</div></section>
      <section class="wtp-section"><div class="wtp-section-head"><div><small>LATEST RECOMMENDATIONS</small><h2>${curated.length?'Fresh picks and rankings.':'The desk is ready.'}</h2></div><p>${curated.length?'The newest stories explicitly published to What to Play and its collections.':'We have not published any What to Play stories yet. Existing News, Reviews, and Features remain in their original desks.'}</p></div><div class="wtp-latest-layout"><div class="wtp-story-list">${feed.map(feedCard).join('') || '<div class="wtp-side-card wtp-empty-desk"><small>NO CURATED STORIES YET</small><h3>Nothing has been published here.</h3><p class="wtp-side-note">Assign a new story to What to Play or one of its collections in Editorial Studio and it will appear here automatically.</p><a class="wtp-lead-cta" href="studio.html">OPEN EDITORIAL STUDIO →</a></div>'}</div><aside class="wtp-side"><section class="wtp-side-card"><small>QUICK LINKS</small><h3>Browse the desks.</h3><div class="wtp-side-links"><a href="${categoryUrl({collection:'game-of-the-year'})}">Game of the Year <span>→</span></a><a href="${categoryUrl({collection:'all-time-greats'})}">All-Time Greats <span>→</span></a><a href="${categoryUrl({collection:'upcoming-games'})}">Upcoming Games <span>→</span></a><a href="${categoryUrl({collection:'best-games'})}">Best Games <span>→</span></a></div></section><section class="wtp-side-card"><small>EDITORIAL RULE</small><h3>Curated means curated.</h3><p class="wtp-side-note">A story only appears in What to Play when we deliberately assign it there. Publishing elsewhere on Neural Critic does not automatically turn it into a recommendation.</p></section></aside></div></section>`;
    main.appendChild(hub);
  }

  async function init(){
    try { render(await loadArticles()); }
    catch (error) { console.error('What to Play hub failed:',error); render([]); }
  }

  init();
})();
