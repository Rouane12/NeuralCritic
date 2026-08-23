(() => {
  'use strict';

  const esc = (value='') => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtDate = iso => {
    if (!iso) return '';
    try { return new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(iso)); }
    catch (_) { return ''; }
  };
  const href = article => `article.html?slug=${encodeURIComponent(article.slug)}`;
  const filters = ['all','news','feature','guide','review','games','franchises','authors','pc','playstation','xbox','nintendo'];
  const entityOnlyFilters = new Set(['games','franchises','authors']);
  let articles = [];
  let activeFilter = 'all';

  const readMinutes = article => {
    const text = [
      article.body || '',
      ...(article.contentBlocks || []).map(block => block.text || ''),
      article.conclusion || ''
    ].join(' ');
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(words / 220));
  };

  function storyCard(article) {
    const tags = (article.tags || []).slice(0,3).join(' · ');
    const graph = [article.gameKey, article.franchise].filter(Boolean).slice(0,2).join(' · ');
    const meta = `BY ${esc(article.author || 'Neural Critic')} · ${readMinutes(article)} MIN READ${graph ? ` · ${esc(graph)}` : tags ? ` · ${esc(tags)}` : ''}`;
    const image = article.imageLocal ? `<img src="${esc(article.imageLocal)}" alt="${esc(article.imageAlt || article.title)}">` : '<div class="placeholder-art">NEURAL CRITIC</div>';
    const updated = article.updatedAt && article.updatedAt !== article.publishedAt ? ` · UPDATED ${fmtDate(article.updatedAt)}` : '';
    return `<a class="search-work-card" href="${href(article)}">
      <div class="search-work-card-media">${image}</div>
      <div class="search-work-card-copy">
        <span>${esc(article.category || 'STORY')}</span>
        <h2>${esc(article.title)}</h2>
        <p>${esc(article.description || '')}</p>
        <div class="search-work-meta">${meta}${updated}</div>
      </div>
    </a>`;
  }

  function entityTypeLabel(type) {
    if (type === 'game') return 'GAME HUB';
    if (type === 'series') return 'SERIES HUB';
    if (type === 'franchise') return 'FRANCHISE HUB';
    if (type === 'author') return 'WRITER';
    return String(type || 'TOPIC').toUpperCase();
  }

  function entityCard(entity) {
    const latest = [...(entity.stories || [])].sort((a,b) => new Date(b.updatedAt || b.publishedAt || 0) - new Date(a.updatedAt || a.publishedAt || 0))[0];
    const image = entity.image ? `<img src="${esc(entity.image)}" alt="">` : '<div class="placeholder-art">NC</div>';
    return `<a class="search-entity-card" href="${esc(entity.href)}">
      <div class="search-entity-media">${image}</div>
      <div class="search-entity-copy">
        <small>${esc(entityTypeLabel(entity.type))}</small>
        <h2>${esc(entity.name)}</h2>
        <p>${entity.count} CONNECTED ${entity.count === 1 ? 'STORY' : 'STORIES'}${latest ? ` · LATEST ${esc(fmtDate(latest.updatedAt || latest.publishedAt))}` : ''}</p>
        ${latest ? `<strong>${esc(latest.title)}</strong>` : ''}
        <span>EXPLORE COVERAGE →</span>
      </div>
    </a>`;
  }

  function emptyMarkup(query) {
    return `<div class="search-work-empty"><b>0</b><h2>No signals found</h2><p>${query ? 'Try another game, franchise, platform, writer, tag, or article phrase.' : 'This lane will populate as Neural Critic publishes more connected coverage.'}</p></div>`;
  }

  function dedupeEntityItems(items, engine) {
    const seen = new Set();
    return items.filter(item => {
      const entity = item.entity || item;
      const group = entity.type === 'author' ? 'author' : 'topic';
      const key = `${group}:${engine.normalize(entity.name)}`;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function render() {
    const input = document.getElementById('work-search-input');
    const results = document.getElementById('work-search-results');
    const count = document.getElementById('work-search-count');
    const summary = document.querySelector('.search-work-summary span');
    if (!input || !results || !count) return;

    const query = input.value.trim();
    const engine = window.NeuralCriticDiscovery;
    if (!engine?.search) {
      const fallback = articles.filter(article => !query || [article.title,article.description,article.category,...(article.tags||[])].join(' ').toLowerCase().includes(query.toLowerCase()));
      count.textContent = `${fallback.length} RESULT${fallback.length === 1 ? '' : 'S'}`;
      results.innerHTML = fallback.length ? fallback.map(storyCard).join('') : emptyMarkup(query);
      return;
    }

    const searchResult = engine.search(articles, query, activeFilter);
    let entityItems = dedupeEntityItems(searchResult.entities, engine);
    let storyItems = searchResult.stories;

    if (!query && activeFilter === 'all') {
      entityItems = dedupeEntityItems(
        engine.buildEntities(articles)
          .filter(entity => entity.type !== 'author')
          .map(entity => ({entity, score:0})),
        engine
      ).slice(0,6);
    }

    if (activeFilter === 'franchises') {
      entityItems = dedupeEntityItems(
        engine.buildEntities(articles)
          .filter(entity => entity.type === 'franchise' || entity.type === 'series')
          .filter(entity => !query || engine.normalize(entity.name).includes(engine.normalize(query)))
          .sort((a,b) => Number(b.type === 'franchise') - Number(a.type === 'franchise'))
          .map(entity => ({entity, score:0})),
        engine
      );
    }

    const entities = entityItems.map(item => item.entity || item);
    const stories = storyItems.map(item => item.article || item);
    const total = entities.length + stories.length;

    if (entityOnlyFilters.has(activeFilter)) {
      count.textContent = `${entities.length} ${activeFilter.toUpperCase()} RESULT${entities.length === 1 ? '' : 'S'}`;
    } else if (entities.length) {
      count.textContent = `${stories.length} ${stories.length === 1 ? 'STORY' : 'STORIES'} · ${entities.length} ${entities.length === 1 ? 'TOPIC' : 'TOPICS'}`;
    } else {
      count.textContent = `${stories.length} RESULT${stories.length === 1 ? '' : 'S'}`;
    }
    if (summary) summary.textContent = query ? 'Results ranked by title, Game Graph connection, and article relevance' : 'Browse stories and connected Game Graph hubs';

    if (!total) {
      results.innerHTML = emptyMarkup(query);
      return;
    }

    const entitySection = entities.length ? `<section class="search-entity-section" aria-label="Connected topics">
      <header><div><small>${query ? 'CONNECTED RESULTS' : 'EXPLORE THE GAME GRAPH'}</small><h2>${query ? 'Topics and people' : 'Coverage hubs'}</h2></div><span>${entities.length} ${entities.length === 1 ? 'HUB' : 'HUBS'}</span></header>
      <div class="search-entity-grid">${entities.slice(0, activeFilter === 'all' ? 6 : 20).map(entityCard).join('')}</div>
    </section>` : '';

    const storySection = stories.length ? `<section class="search-story-section" aria-label="Story results">
      ${entities.length ? `<header class="search-story-section-head"><small>STORIES</small><span>${stories.length} RESULT${stories.length === 1 ? '' : 'S'}</span></header>` : ''}
      ${stories.map(storyCard).join('')}
    </section>` : '';

    results.innerHTML = entitySection + storySection;
  }

  async function load() {
    const response = await fetch('data/articles.json');
    if (!response.ok) throw new Error(`Search index returned ${response.status}`);
    const summary = await response.json();
    articles = Array.isArray(summary) ? summary : [];
    articles.sort((a,b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
  }

  async function init() {
    const input = document.getElementById('work-search-input');
    const form = document.getElementById('work-search-form');
    const filterHost = document.getElementById('work-search-filters');
    if (!input || !form || !filterHost) return;

    filterHost.innerHTML = filters.map(filter => `<button type="button" data-search-filter="${filter}" class="${filter === 'all' ? 'active' : ''}">${filter.toUpperCase()}</button>`).join('');
    filterHost.addEventListener('click', event => {
      const button = event.target.closest('[data-search-filter]');
      if (!button) return;
      activeFilter = button.dataset.searchFilter;
      filterHost.querySelectorAll('button').forEach(btn => btn.classList.toggle('active', btn === button));
      render();
      window.gtag?.('event','search_filter',{search_filter:activeFilter,search_query:input.value.trim()});
    });

    const initial = new URLSearchParams(location.search).get('q') || '';
    input.value = initial;
    form.addEventListener('submit', event => {
      event.preventDefault();
      const q = input.value.trim();
      history.replaceState(null,'',q ? `search.html?q=${encodeURIComponent(q)}` : 'search.html');
      render();
      if (q) window.gtag?.('event','site_search',{search_term:q,search_filter:activeFilter});
    });
    input.addEventListener('input', render);

    try {
      await load();
      if (window.NeuralCriticDiscoveryReady) await window.NeuralCriticDiscoveryReady;
      render();
    } catch (error) {
      console.error(error);
      document.getElementById('work-search-results').innerHTML = '<div class="search-work-empty"><h2>Search is unavailable.</h2><p>Please refresh and try again.</p></div>';
    }
  }

  init();
})();
