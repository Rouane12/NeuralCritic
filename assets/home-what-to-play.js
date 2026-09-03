(() => {
  const host = document.getElementById('home-what-to-play');
  if (!host) return;

  const esc = (v='') => String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const slugify = (v='') => String(v).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const articleUrl = a => `stories/${encodeURIComponent(a.slug)}/`;
  const collectionUrl = collection => `category.html?collection=${encodeURIComponent(collection)}`;
  let cachedArticles = [];
  const defs = [
    ['all-time-greats','All-Time Greats','THE CANON'],
    ['game-of-the-year','Game of the Year','ANNUAL AWARDS'],
    ['best-games','Best Games','CURATED PICKS'],
    ['upcoming-games','Upcoming Games','ON THE RADAR']
  ];

  function normalize(a){
    return {
      ...a,
      imageLocal:a.imageLocal || a.image_url || '',
      imageAlt:a.imageAlt || a.image_alt || a.title || '',
      editorialSection:a.editorialSection || a.editorial_section || null,
      articleFormat:a.articleFormat || a.article_format || 'standard',
      contentBlocks:Array.isArray(a.contentBlocks) ? a.contentBlocks : (Array.isArray(a.content_blocks) ? a.content_blocks : []),
      publishedAt:a.publishedAt || a.published_at || '',
      collection:a.collection || null,
      author:a.author || a.author_name || 'Neural Critic',
      description:a.description || ''
    };
  }

  async function loadArticles(){
    try {
      if (window.NeuralCriticContentAPI?.publishedIndex) {
        const rows = await window.NeuralCriticContentAPI.publishedIndex();
        return (rows || []).map(normalize);
      }
    } catch (_) {}
    try {
      const rows = await fetch('data/articles.json').then(r => r.ok ? r.json() : []);
      return (rows || []).map(normalize);
    } catch (_) { return []; }
  }

  function fmtDate(iso){
    try { return new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(iso)); }
    catch (_) { return ''; }
  }

  function label(a){
    if (a.collection === 'all-time-greats') return 'ALL-TIME GREATS';
    if (a.collection === 'game-of-the-year') return 'GAME OF THE YEAR';
    if (a.collection === 'best-games') return 'BEST GAMES';
    if (a.collection === 'upcoming-games') return 'UPCOMING GAMES';
    return 'WHAT TO PLAY';
  }

  function rankedTopThree(article){
    if (article.articleFormat !== 'ranked-list') return [];
    return article.contentBlocks
      .filter(b => b?.heading && Number.isFinite(Number(b.rank)))
      .sort((a,b) => Number(a.rank) - Number(b.rank))
      .slice(0,3);
  }

  function topRow(block,article){
    const image = block.imageLocal
      ? `<img src="${esc(block.imageLocal)}" alt="${esc(block.imageAlt || block.heading)}">`
      : '<span class="home-wtp-rank-placeholder">NC</span>';
    return `<a class="home-wtp-rank-row rank-${esc(block.rank)}" href="${articleUrl(article)}#${slugify(block.heading)}">
      <span class="home-wtp-rank-number">#${esc(block.rank)}</span>
      <span class="home-wtp-rank-image">${image}</span>
      <span class="home-wtp-rank-copy"><strong>${esc(block.heading)}</strong><small>${esc(block.subtitle || block.developer || '')}</small></span>
      <em>→</em>
    </a>`;
  }

  function graphEntries(all){
    const engine = window.NeuralCriticDiscovery;
    if (!engine?.buildEntities) return [];
    return engine.buildEntities(all)
      .filter(entity => ['game','series','franchise'].includes(entity.type) && entity.href && entity.href !== '#')
      .slice(0,4);
  }

  function render(all){
    cachedArticles = all;
    const curatedAll = all
      .filter(a => a.editorialSection === 'what-to-play' || Boolean(a.collection))
      .sort((a,b) => new Date(b.publishedAt||0) - new Date(a.publishedAt||0));

    if (!curatedAll.length) { host.hidden = true; return; }
    const reserved = new Set([...(window.NeuralCriticHomepageState?.featuredSlugs || []),...(window.NeuralCriticHomepageState?.feedSlugs || [])]);
    const distinct = curatedAll.filter(article => !reserved.has(article.slug));
    const curated = distinct.length ? distinct : curatedAll;
    host.hidden = false;
    const lead = curated[0];
    const top = rankedTopThree(lead);
    const counts = Object.fromEntries(defs.map(([key]) => [key, curatedAll.filter(a => a.collection === key).length]));
    const more = curated.slice(1,4);
    const entities = graphEntries(all);

    const media = lead.imageLocal
      ? `<img src="${esc(lead.imageLocal)}" alt="${esc(lead.imageAlt)}">`
      : '<div class="home-wtp-placeholder">NEURAL CRITIC</div>';

    host.innerHTML = `<div class="shell home-wtp-shell">
      <div class="home-wtp-head">
        <div><small>NEURAL CRITIC RECOMMENDS</small><h2>What to Play</h2><p>Curated rankings, essential games, annual awards, and the releases worth keeping on your radar.</p></div>
        <a href="category.html?section=what-to-play">EXPLORE WHAT TO PLAY →</a>
      </div>

      <div class="home-wtp-grid">
        <a class="home-wtp-lead" href="${articleUrl(lead)}">
          <div class="home-wtp-lead-media">${media}<div class="home-wtp-lead-shade"></div><span>${esc(label(lead))}</span></div>
          <div class="home-wtp-lead-copy"><small>FEATURED CURATION</small><h3>${esc(lead.title)}</h3><p>${esc(lead.description)}</p><div>BY ${esc(lead.author)} · ${fmtDate(lead.publishedAt)} <b>READ THE FEATURE →</b></div></div>
        </a>

        <aside class="home-wtp-side">
          ${top.length ? `<div class="home-wtp-ranking"><div class="home-wtp-ranking-head"><small>CURRENT TOP 3</small><strong>${esc(lead.collection === 'all-time-greats' ? 'The Neural Critic canon.' : 'The ranking right now.')}</strong></div>${top.map(b=>topRow(b,lead)).join('')}<a class="home-wtp-ranking-all" href="${articleUrl(lead)}">SEE ALL ${lead.contentBlocks.length} ENTRIES →</a></div>` : ''}
          ${more.length ? `<div class="home-wtp-more"><small>MORE PICKS</small>${more.map(a=>`<a href="${articleUrl(a)}"><span>${esc(label(a))}</span><strong>${esc(a.title)}</strong></a>`).join('')}</div>` : ''}
        </aside>
      </div>

      <nav class="home-wtp-desks" aria-label="What to Play collections">
        ${defs.map(([key,title,eyebrow])=>`<a href="${collectionUrl(key)}"><small>${eyebrow}</small><strong>${title}</strong><span>${counts[key] ? `${counts[key]} LIVE` : 'DESK READY'} <b>→</b></span></a>`).join('')}
      </nav>

      <section class="home-wtp-explore" aria-labelledby="home-wtp-explore-title">
        <div><small>EXPLORE DEEPER</small><h3 id="home-wtp-explore-title">Games, series, and worlds in context.</h3><p>Move from a recommendation into every connected review, guide, feature, and update.</p></div>
        <nav aria-label="Game Graph entry points">
          <a href="games/" data-home-explore="games-directory"><small>GAME DIRECTORY</small><strong>Browse every game</strong><span>OPEN DIRECTORY →</span></a>
          ${entities.map(entity=>`<a href="${esc(entity.href)}" data-home-explore="${esc(entity.type)}" data-home-entity="${esc(entity.slug)}"><small>${esc(entity.type.toUpperCase())}</small><strong>${esc(entity.name)}</strong><span>${entity.count} ${entity.count===1?'STORY':'STORIES'} →</span></a>`).join('')}
        </nav>
      </section>
    </div>`;
  }

  host.addEventListener('click', event => {
    const link = event.target.closest?.('[data-home-explore]');
    if (!link) return;
    window.NeuralCriticAnalytics?.track?.('homepage_discovery_click', {
      discovery_type:link.dataset.homeExplore || '',
      entity_slug:link.dataset.homeEntity || ''
    });
  }, true);
  window.addEventListener('neuralcritic:homepage-slots-applied', () => {
    if (cachedArticles.length) render(cachedArticles);
  });
  window.addEventListener('neuralcritic:homepage-feed-rendered', () => {
    if (cachedArticles.length) render(cachedArticles);
  });

  loadArticles().then(async articles => {
    await (window.NeuralCriticDiscoveryReady || Promise.resolve(window.NeuralCriticDiscovery || null));
    render(articles);
  }).catch(() => { host.hidden = true; });
})();