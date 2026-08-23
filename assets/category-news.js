(() => {
  'use strict';

  const params = new URLSearchParams(location.search);
  if (params.get('section') !== 'news') return;

  const $ = (s, root = document) => root.querySelector(s);
  const platformNames = { pc:'PC', playstation:'PlayStation', xbox:'Xbox', nintendo:'Nintendo', mobile:'Mobile' };
  const kinds = {
    breaking: { label:'BREAKING', copy:'Confirmed, time-sensitive developments worth interrupting the normal feed for.' },
    update: { label:'UPDATES', copy:'Official changes, patches, delays, launches, and developing stories.' },
    report: { label:'REPORTS', copy:'Credible reporting, rumors, and leaks that are not fully confirmed.' }
  };
  let rendering = false;
  let allNews = [];

  const esc = (value='') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const href = article => `article.html?slug=${encodeURIComponent(article.slug)}`;
  const categoryUrl = values => `category.html?${new URLSearchParams(Object.entries(values).filter(([,v]) => v)).toString()}`;

  function fmtDate(iso){
    if(!iso) return '';
    try { return new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(iso)); }
    catch(_) { return ''; }
  }

  function readMinutes(article){
    const blocks = Array.isArray(article.content_blocks) ? article.content_blocks : [];
    const text = [article.body || '', ...blocks.map(x => x?.text || '')].join(' ').trim();
    return Math.max(1, Math.ceil((text ? text.split(/\s+/).length : 220) / 220));
  }

  function inferredPlatforms(article){
    const explicit = Array.isArray(article.platforms) ? article.platforms.map(x => String(x).toLowerCase()) : [];
    if(explicit.length) return explicit;
    const tags = Array.isArray(article.tags) ? article.tags.map(x => String(x).toLowerCase()) : [];
    const out = [];
    if(tags.includes('pc')) out.push('pc');
    if(tags.some(x => ['playstation','ps5','ps4'].includes(x))) out.push('playstation');
    if(tags.some(x => ['xbox','xbox series x','xbox series x/s'].includes(x))) out.push('xbox');
    if(tags.some(x => ['nintendo','switch','switch 2','nintendo switch','nintendo switch 2'].includes(x))) out.push('nintendo');
    if(tags.some(x => ['mobile','ios','android'].includes(x))) out.push('mobile');
    return out;
  }

  function newsKind(article){
    const kind = article.news_meta?.kind;
    return kinds[kind] ? kind : '';
  }

  function image(article){
    return article.image_url
      ? `<img src="${esc(article.image_url)}" alt="${esc(article.image_alt || article.title)}">`
      : '<div class="placeholder-art">NEURAL CRITIC</div>';
  }

  function storyLabel(article){
    const kind = newsKind(article);
    return kind ? kinds[kind].label.replace(/S$/, '') : 'NEWS';
  }

  function spotlightCard(article, side=false){
    const kind = newsKind(article);
    const source = String(article.news_meta?.sourceName || '').trim();
    return `<a class="${side ? '' : 'category-spotlight-main'} nc-news-story nc-news-${kind || 'standard'}" href="${href(article)}">
      ${image(article)}<div class="category-spotlight-shade"></div>
      <div class="category-spotlight-copy">
        <span>${esc(storyLabel(article))}${kind === 'report' ? ' · ATTRIBUTED' : ''}</span>
        <h2>${esc(article.title)}</h2>
        <p>${esc(article.description || '')}</p>
        <small>${source ? `SOURCE: ${esc(source)} · ` : ''}${readMinutes(article)} MIN READ · ${fmtDate(article.published_at)}</small>
      </div>
    </a>`;
  }

  function feedCard(article){
    const kind = newsKind(article);
    const source = String(article.news_meta?.sourceName || '').trim();
    return `<a class="category-feed-card nc-news-story nc-news-${kind || 'standard'}" href="${href(article)}">
      <div class="category-feed-media">${image(article)}</div>
      <div class="category-feed-copy">
        <span>${esc(storyLabel(article))}${kind === 'report' ? ' · ATTRIBUTED' : ''}</span>
        <h3>${esc(article.title)}</h3>
        <p>${esc(article.description || '')}</p>
        <small>${source ? `SOURCE: ${esc(source)} · ` : ''}${readMinutes(article)} MIN READ · ${fmtDate(article.published_at)}</small>
      </div>
    </a>`;
  }

  function countKind(kind){
    return kind === 'all' ? allNews.length : allNews.filter(a => newsKind(a) === kind).length;
  }

  function navMarkup(kind, platform){
    const kindButtons = [['all','ALL NEWS'],['breaking','BREAKING'],['update','UPDATES'],['report','REPORTS']];
    return `<div class="nc-news-category-nav">
      <div class="nc-news-kind-row" aria-label="News type filters">
        ${kindButtons.map(([key,label]) => `<a class="${kind === key ? 'active' : ''}" href="${categoryUrl({section:'news',kind:key === 'all' ? null : key,platform})}"><span>${label}</span><b>${countKind(key)}</b></a>`).join('')}
      </div>
      <div class="nc-news-platform-row" aria-label="News platform filters">
        <span>PLATFORM</span>
        <a class="${!platform ? 'active' : ''}" href="${categoryUrl({section:'news',kind:kind === 'all' ? null : kind})}">All</a>
        ${Object.entries(platformNames).map(([key,label]) => `<a class="${platform === key ? 'active' : ''}" href="${categoryUrl({section:'news',kind:kind === 'all' ? null : kind,platform:key})}">${label}</a>`).join('')}
      </div>
    </div>`;
  }

  function emptyAllMarkup(){
    return `<section class="nc-news-category-empty">
      <div class="nc-news-category-empty-head"><small>NEWS DESK · STANDING BY</small><h2>No live signals yet.</h2><p>Nothing worth interrupting your feed for right now. When Neural Critic publishes its first news story, it will enter one of these lanes automatically.</p></div>
      <div class="nc-news-category-lanes">
        ${Object.entries(kinds).map(([key,item]) => `<article data-kind="${key}"><b>${item.label}</b><span>${item.copy}</span></article>`).join('')}
      </div>
      <a class="nc-news-category-back" href="index.html#news">BACK TO LATEST STORIES →</a>
    </section>`;
  }

  function emptyFilteredMarkup(kind, platform){
    const label = kind !== 'all' ? kinds[kind]?.label : platformNames[platform] ? `${platformNames[platform]} NEWS` : 'NEWS';
    return `<section class="nc-news-filter-empty"><small>${esc(label || 'NEWS')}</small><h2>Nothing in this lane right now.</h2><p>The desk is live; there simply are no matching published stories at the moment.</p><a href="${categoryUrl({section:'news'})}">VIEW ALL NEWS →</a></section>`;
  }

  function render(){
    if(rendering) return;
    rendering = true;
    try {
      const kind = kinds[params.get('kind')] ? params.get('kind') : 'all';
      const platform = platformNames[params.get('platform')] ? params.get('platform') : '';
      let current = [...allNews];
      if(kind !== 'all') current = current.filter(a => newsKind(a) === kind);
      if(platform) current = current.filter(a => inferredPlatforms(a).includes(platform));

      document.body.classList.add('nc-news-category-page');
      document.title = `${kind === 'all' ? 'News' : kinds[kind].label.charAt(0) + kinds[kind].label.slice(1).toLowerCase()} · Neural Critic`;
      const title = $('#category-title');
      const deck = $('#category-deck');
      const count = $('#category-count');
      if(title) title.textContent = kind === 'all' ? 'News' : kinds[kind].label.charAt(0) + kinds[kind].label.slice(1).toLowerCase();
      if(deck) deck.textContent = kind === 'all'
        ? 'Confirmed developments, meaningful updates, and clearly attributed reporting — separated by certainty, not hype.'
        : kinds[kind].copy;
      if(count) count.textContent = `${current.length} ${current.length === 1 ? 'STORY' : 'STORIES'}`;

      const hero = $('.category-work-hero');
      if(hero){
        const old = $('.category-taxonomy-chips', hero);
        if(old) old.remove();
        let nav = $('.nc-news-category-nav-host', hero);
        if(!nav){ nav = document.createElement('div'); nav.className = 'nc-news-category-nav-host'; hero.appendChild(nav); }
        nav.innerHTML = navMarkup(kind, platform);
      }

      const spot = $('#category-spotlight');
      const feedSection = $('#category-feed-section');
      const feed = $('#category-feed');
      if(!spot) return;

      if(!allNews.length){
        spot.className = 'nc-news-category-spotlight';
        spot.innerHTML = emptyAllMarkup();
        if(feedSection) feedSection.hidden = true;
        return;
      }

      if(!current.length){
        spot.className = 'nc-news-category-spotlight';
        spot.innerHTML = emptyFilteredMarkup(kind, platform);
        if(feedSection) feedSection.hidden = true;
        return;
      }

      const top = current.slice(0,3);
      spot.className = `category-spotlight${top.length === 1 ? ' single' : ''}`;
      spot.innerHTML = spotlightCard(top[0]) + (top.length > 1 ? `<div class="category-spotlight-side${top.length === 2 ? ' one' : ''}">${top.slice(1).map(a => spotlightCard(a,true)).join('')}</div>` : '');
      const rest = current.slice(3);
      if(feedSection) feedSection.hidden = !rest.length;
      if(feed && rest.length) feed.innerHTML = rest.map(feedCard).join('');
      const label = $('#category-latest-label');
      if(label) label.textContent = kind === 'all' ? 'LATEST NEWS' : `LATEST ${kinds[kind].label}`;
    } finally {
      rendering = false;
    }
  }

  function ownsSpotlight(){
    const spot = $('#category-spotlight');
    return !!spot?.querySelector('.nc-news-category-empty,.nc-news-filter-empty,.nc-news-story');
  }

  async function waitForClient(limit=60){
    for(let i=0;i<limit;i++){
      if(window.neuralCriticPublicSupabase) return window.neuralCriticPublicSupabase;
      await new Promise(resolve => setTimeout(resolve,100));
    }
    return null;
  }

  async function load(){
    const client = await waitForClient();
    if(!client) return [];
    const {data,error} = await client.from('articles')
      .select('slug,title,description,body,tags,image_url,image_alt,content_blocks,platforms,news_meta,published_at')
      .eq('status','published').eq('category','NEWS').lte('published_at',new Date().toISOString()).order('published_at',{ascending:false});
    if(error) throw error;
    return data || [];
  }

  async function init(){
    try { allNews = await load(); }
    catch(error){ console.warn('Neural Critic News category could not load structured news metadata.', error); allNews = []; }

    const spot = $('#category-spotlight');
    let reassertTimer;
    const observer = spot ? new MutationObserver(() => {
      if(rendering || ownsSpotlight()) return;
      clearTimeout(reassertTimer);
      reassertTimer = setTimeout(render, 0);
    }) : null;
    observer?.observe(spot,{childList:true,subtree:true});

    render();
    // publication-nav renders taxonomy views on window.load; reassert once after that pass.
    window.addEventListener('load', () => setTimeout(() => { if(!ownsSpotlight()) render(); }, 0), { once:true });
    setTimeout(() => observer?.disconnect(), 10000);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
