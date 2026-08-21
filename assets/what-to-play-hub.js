(() => {
  const params = new URLSearchParams(location.search);
  if (params.get('section') !== 'what-to-play' || params.get('platform') || params.get('collection')) return;

  document.body.classList.add('wtp-active');

  const esc = (value='') => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const categoryUrl = values => `category.html?${new URLSearchParams(values).toString()}`;
  const articleUrl = article => `article.html?slug=${encodeURIComponent(article.slug)}`;
  const platformNames = {pc:'PC',playstation:'PlayStation',xbox:'Xbox',nintendo:'Nintendo'};
  const collectionDefs = [
    {key:'game-of-the-year',title:'Game of the Year',eyebrow:'ANNUAL AWARDS',copy:'Finalists, winners, and the games that defined the year.'},
    {key:'best-games',title:'Best Games',eyebrow:'CURATED PICKS',copy:'Evolving lists built for players deciding what deserves their time.'},
    {key:'all-time-greats',title:'Best Games of All Time',eyebrow:'THE ESSENTIALS',copy:'The games Neural Critic believes every player should know.'},
    {key:'upcoming-games',title:'Upcoming Games',eyebrow:'ON THE RADAR',copy:'Promising releases worth watching before they arrive.'}
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
    if (article.articleFormat === 'review' || String(article.category).toLowerCase() === 'review') return 'REVIEW';
    if (article.articleFormat === 'ranked-list') return 'RANKED LIST';
    if (article.articleFormat === 'game-guide') return 'GUIDE';
    return String(article.category || 'FEATURE').toUpperCase();
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

  function chooseLead(all,curated){
    return curated[0]
      || all.find(a=>a.articleFormat === 'review')
      || all.find(a=>a.articleFormat === 'ranked-list')
      || all.find(a=>String(a.category).toLowerCase() !== 'news')
      || all[0];
  }

  function collectionCard(def,all){
    const count = all.filter(a=>a.collection === def.key).length;
    return `<a class="wtp-collection" href="${categoryUrl({collection:def.key})}">
      <small>${def.eyebrow}</small><b>${def.title}</b><p>${def.copy}</p>
      <footer><span class="wtp-desk-count ${count ? '' : 'empty'}">${count ? `${count} ${count===1?'STORY':'STORIES'}` : 'DESK READY'}</span><span>EXPLORE →</span></footer>
    </a>`;
  }

  function platformCard(key,label,all){
    const count = all.filter(a=>a.collection === 'best-games' && inferredPlatforms(a).includes(key)).length;
    return `<a class="wtp-platform" href="${categoryUrl({collection:'best-games',platform:key})}"><small>BEST ON</small><strong>${label}</strong><span>${count ? `${count} curated ${count===1?'pick':'picks'}` : 'Collection ready for picks'}</span><em>→</em></a>`;
  }

  function smallCard(article){
    return `<a class="wtp-card" href="${articleUrl(article)}"><div class="wtp-card-media">${image(article)}</div><div class="wtp-card-copy"><span>${esc(storyType(article))}</span><h3>${esc(article.title)}</h3><p>${esc(article.description)}</p><small>BY ${esc(article.author)} · ${readMinutes(article)} MIN READ · ${fmtDate(article.publishedAt)}</small></div></a>`;
  }

  function feedCard(article){
    return `<a class="wtp-story" href="${articleUrl(article)}"><div class="wtp-story-media">${image(article)}</div><div class="wtp-story-copy"><span>${esc(storyType(article))}</span><h3>${esc(article.title)}</h3><p>${esc(article.description)}</p><small>BY ${esc(article.author)} · ${readMinutes(article)} MIN READ · ${fmtDate(article.publishedAt)}</small></div></a>`;
  }

  function leadMarkup(article){
    if (!article) return `<div class="wtp-lead"><div class="wtp-lead-media"><div class="wtp-placeholder">NEURAL CRITIC</div></div><div class="wtp-lead-copy"><span>DISCOVERY DESK</span><h2>Your next favorite game starts here.</h2><p>The What to Play desk is ready for its first recommendation from Editorial Studio.</p><a class="wtp-lead-cta" href="studio.html">OPEN EDITORIAL STUDIO →</a></div></div>`;
    return `<a class="wtp-lead" href="${articleUrl(article)}"><div class="wtp-lead-media">${image(article)}</div><div class="wtp-lead-copy"><span>${isCurated(article)?'NEURAL CRITIC RECOMMENDS':storyType(article)}</span><h2>${esc(article.title)}</h2><p>${esc(article.description)}</p><div class="wtp-lead-byline">BY ${esc(article.author)} · ${readMinutes(article)} MIN READ · ${fmtDate(article.publishedAt)}</div><div class="wtp-lead-cta">READ THE STORY →</div></div></a>`;
  }

  function render(all){
    all.sort((a,b)=>new Date(b.publishedAt||0)-new Date(a.publishedAt||0));
    const curated = all.filter(isCurated);
    const lead = chooseLead(all,curated);
    const nonNews = all.filter(a=>String(a.category).toLowerCase() !== 'news');
    const startCandidates = [
      all.find(a=>a.articleFormat === 'review'),
      all.find(a=>a.articleFormat === 'ranked-list'),
      ...nonNews
    ];
    const start = uniqueStories(startCandidates,3,[lead]);
    const feedSource = curated.length ? curated : nonNews;
    const feed = uniqueStories(feedSource,6,[lead,...start]);
    const displayFeed = feed.length ? feed : uniqueStories(nonNews,6,[lead]);

    const main = document.querySelector('.category-work-page');
    if (!main) return;
    const oldHub = main.querySelector('.wtp-hub'); if (oldHub) oldHub.remove();
    document.title = 'What to Play · Neural Critic';
    const hub = document.createElement('div'); hub.className = 'wtp-hub';
    hub.innerHTML = `
      <section class="wtp-hero-copy"><small class="wtp-eyebrow">NEURAL CRITIC RECOMMENDS</small><h1>Find your next game.</h1><p>Reviews, rankings, essential picks, and upcoming releases — organized around one useful question: what is actually worth playing?</p><div class="wtp-hero-meta"><span>${all.length} PUBLISHED STORIES</span><span>·</span><a href="search.html">SEARCH THE ARCHIVE →</a></div></section>
      ${leadMarkup(lead)}
      <section class="wtp-section"><div class="wtp-section-head"><div><small>CURATED DESKS</small><h2>Go straight to the good stuff.</h2></div><p>These collections are editorially assigned in Studio. Empty desks stay honest until we publish a real pick.</p></div><div class="wtp-collections">${collectionDefs.map(def=>collectionCard(def,all)).join('')}</div></section>
      <section class="wtp-section"><div class="wtp-section-head"><div><small>CHOOSE YOUR PLATFORM</small><h2>What are you playing on?</h2></div><p>Platform collections grow automatically as Best Games stories are assigned in Editorial Studio.</p></div><div class="wtp-platforms">${Object.entries(platformNames).map(([key,label])=>platformCard(key,label,all)).join('')}</div></section>
      ${start.length ? `<section class="wtp-section"><div class="wtp-section-head"><div><small>START HERE</small><h2>Three strong places to begin.</h2></div><p>A useful mix from the current Neural Critic library while the dedicated recommendation collections grow.</p></div><div class="wtp-start-grid">${start.map(smallCard).join('')}</div></section>` : ''}
      <section class="wtp-section"><div class="wtp-section-head"><div><small>${curated.length?'LATEST RECOMMENDATIONS':'FROM THE CRITIC DESK'}</small><h2>${curated.length?'Fresh picks and rankings.':'More worth reading.'}</h2></div><p>${curated.length?'The newest stories explicitly published to What to Play and its collections.':'Current reviews, rankings, and features — without mislabeling them as curated picks.'}</p></div><div class="wtp-latest-layout"><div class="wtp-story-list">${displayFeed.map(feedCard).join('') || '<div class="wtp-side-card"><h3>The desk is ready.</h3><p class="wtp-side-note">Publish a review, ranking, or recommendation from Editorial Studio and it will appear here.</p></div>'}</div><aside class="wtp-side"><section class="wtp-side-card"><small>QUICK LINKS</small><h3>Browse the desks.</h3><div class="wtp-side-links"><a href="${categoryUrl({collection:'game-of-the-year'})}">Game of the Year <span>→</span></a><a href="${categoryUrl({collection:'all-time-greats'})}">All-Time Greats <span>→</span></a><a href="${categoryUrl({collection:'upcoming-games'})}">Upcoming Games <span>→</span></a><a href="${categoryUrl({collection:'best-games'})}">Best Games <span>→</span></a></div></section><section class="wtp-side-card"><small>EDITORIAL SYSTEM</small><h3>Built to grow.</h3><p class="wtp-side-note">The hub reads the same section, collection, and platform fields used by Editorial Studio. Publishing a curated story updates this page automatically.</p></section></aside></div></section>`;
    main.appendChild(hub);
  }

  async function init(){
    try { render(await loadArticles()); }
    catch (error) { console.error('What to Play hub failed:',error); render([]); }
  }

  init();
})();
