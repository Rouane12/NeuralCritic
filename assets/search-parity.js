(() => {
  const esc = (value='') => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtDate = iso => {
    if (!iso) return '';
    try { return new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(iso)); }
    catch (_) { return ''; }
  };
  const href = article => `article.html?slug=${encodeURIComponent(article.slug)}`;
  const filters = ['all','news','feature','guide','review','pc','playstation','xbox','nintendo'];
  let articles = [];
  let activeFilter = 'all';

  const textOf = article => [
    article.title,
    article.description,
    article.category,
    article.author,
    ...(article.tags || []),
    article.body,
    ...(article.contentBlocks || []).flatMap(block => [block.heading, block.text]),
    article.conclusion
  ].filter(Boolean).join(' ').toLowerCase();

  const readMinutes = article => {
    const text = [
      article.body || '',
      ...(article.contentBlocks || []).map(block => block.text || ''),
      article.conclusion || ''
    ].join(' ');
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(words / 220));
  };

  const matchesFilter = article => {
    if (activeFilter === 'all') return true;
    const category = String(article.category || '').toLowerCase();
    const format = String(article.articleFormat || '').toLowerCase();
    const tags = (article.tags || []).map(tag => String(tag).toLowerCase());
    if (activeFilter === 'guide') return category === 'guide' || format === 'game-guide' || tags.includes('guide');
    if (activeFilter === 'review') return category === 'review' || format === 'review' || tags.includes('review');
    return category === activeFilter || tags.includes(activeFilter);
  };

  function render() {
    const input = document.getElementById('work-search-input');
    const results = document.getElementById('work-search-results');
    const count = document.getElementById('work-search-count');
    if (!input || !results || !count) return;

    const query = input.value.trim().toLowerCase();
    const hits = articles.filter(matchesFilter).filter(article => !query || textOf(article).includes(query));
    count.textContent = `${hits.length} RESULT${hits.length === 1 ? '' : 'S'}`;

    if (!hits.length) {
      results.innerHTML = `<div class="search-work-empty"><b>0</b><h2>No stories found</h2><p>Try another game, platform, author, tag, or article phrase.</p></div>`;
      return;
    }

    results.innerHTML = hits.map(article => {
      const tags = (article.tags || []).slice(0,3).join(' · ');
      const meta = `BY ${esc(article.author || 'Neural Critic')} · ${readMinutes(article)} MIN READ${tags ? ` · ${esc(tags)}` : ''}`;
      const image = article.imageLocal ? `<img src="${esc(article.imageLocal)}" alt="${esc(article.imageAlt || article.title)}">` : '<div class="placeholder-art">NEURAL CRITIC</div>';
      return `<a class="search-work-card" href="${href(article)}">
        <div class="search-work-card-media">${image}</div>
        <div class="search-work-card-copy">
          <span>${esc(article.category || 'STORY')}</span>
          <h2>${esc(article.title)}</h2>
          <p>${esc(article.description || '')}</p>
          <div class="search-work-meta">${meta}</div>
        </div>
      </a>`;
    }).join('');
  }

  async function load() {
    const summary = await fetch('data/articles.json').then(r => r.json());
    articles = await Promise.all(summary.map(async item => {
      try {
        const detail = await fetch(`data/articles/${encodeURIComponent(item.slug)}.json`).then(r => r.ok ? r.json() : null);
        return detail ? {...item, ...detail} : item;
      } catch (_) {
        return item;
      }
    }));
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
    });

    const initial = new URLSearchParams(location.search).get('q') || '';
    input.value = initial;
    form.addEventListener('submit', event => {
      event.preventDefault();
      const q = input.value.trim();
      history.replaceState(null,'',q ? `search.html?q=${encodeURIComponent(q)}` : 'search.html');
      render();
    });
    input.addEventListener('input', render);

    try {
      await load();
      render();
    } catch (error) {
      console.error(error);
      document.getElementById('work-search-results').innerHTML = '<div class="search-work-empty"><h2>Search is unavailable.</h2><p>Please refresh and try again.</p></div>';
    }
  }

  init();
})();
