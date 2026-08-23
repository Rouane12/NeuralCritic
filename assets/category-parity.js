(() => {
  const params = new URLSearchParams(location.search);
  // Modern publication taxonomy routes are owned by publication-nav.js.
  // Do not let this legacy ?category= renderer race section/platform/collection views.
  if (params.has('section') || params.has('platform') || params.has('collection')) return;

  const esc = (value='') => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtDate = iso => {
    if (!iso) return '';
    try { return new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(iso)); }
    catch (_) { return ''; }
  };
  const href = article => `article.html?slug=${encodeURIComponent(article.slug)}`;
  const config = {
    latest:{title:'Latest stories',deck:'The newest signals from across Neural Critic — features, reviews, guides, and platform coverage worth your time.'},
    news:{title:'News',deck:'Fresh gaming news, announcements, releases, and industry developments without the clutter.'},
    features:{title:'Features',deck:'Long-form analysis, design stories, rankings, and thoughtful looks at the games and ideas shaping the medium.'},
    guides:{title:'Guides',deck:'Useful, focused guidance built to help you play smarter without wasting your time.'},
    reviews:{title:'Reviews',deck:'Clear verdicts, useful context, and criticism that explains the experience behind the score.'},
    pc:{title:'PC Gaming',deck:'PC releases, performance, reviews, features, and stories from across the platform.'},
    playstation:{title:'PlayStation',deck:'Features, reviews, and coverage for PlayStation players.'},
    xbox:{title:'Xbox',deck:'Features, reviews, and coverage for Xbox players.'},
    nintendo:{title:'Nintendo',deck:'Nintendo games, design stories, reviews, and platform coverage.'}
  };
  let allArticles = [];
  let current = [];

  function matches(article, category){
    if (category === 'latest') return true;
    const cat = String(article.category || '').toLowerCase();
    const format = String(article.articleFormat || '').toLowerCase();
    const tags = (article.tags || []).map(tag => String(tag).toLowerCase());
    if (category === 'features') return cat === 'feature' || tags.includes('feature') || format === 'ranked-list';
    if (category === 'guides') return cat === 'guide' || tags.includes('guide') || format === 'game-guide';
    if (category === 'reviews') return cat === 'review' || tags.includes('review') || format === 'review';
    return cat === category || tags.includes(category);
  }

  function readMinutes(article){
    const text = [article.body || '', ...(article.contentBlocks || []).map(block => block.text || ''), article.conclusion || ''].join(' ');
    const count = text.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1,Math.ceil(count / 220));
  }

  function cardImage(article){
    return article.imageLocal
      ? `<img src="${esc(article.imageLocal)}" alt="${esc(article.imageAlt || article.title)}">`
      : '<div class="placeholder-art">NEURAL CRITIC</div>';
  }

  function spotlightCard(article,side=false){
    return `<a class="${side ? '' : 'category-spotlight-main'}" href="${href(article)}">
      ${cardImage(article)}
      <div class="category-spotlight-shade"></div>
      <div class="category-spotlight-copy">
        <span>${esc(article.category || 'STORY')}</span>
        <h2>${esc(article.title)}</h2>
        <p>${esc(article.description || '')}</p>
        <small>BY ${esc(article.author || 'Neural Critic')} · ${readMinutes(article)} MIN READ · ${fmtDate(article.publishedAt)}</small>
      </div>
    </a>`;
  }

  function renderSpotlight(){
    const host = document.getElementById('category-spotlight');
    if (!host) return;
    if (!current.length){
      host.className = 'category-empty';
      host.innerHTML = `<b>0</b><h2>No stories here yet.</h2><p>This category is ready for the next published Neural Critic story.</p><a href="search.html">BROWSE ALL PUBLISHED STORIES →</a>`;
      return;
    }
    const top = current.slice(0,3);
    host.className = `category-spotlight${top.length === 1 ? ' single' : ''}`;
    host.innerHTML = spotlightCard(top[0]) + (top.length > 1 ? `<div class="category-spotlight-side${top.length === 2 ? ' one' : ''}">${top.slice(1).map(article => spotlightCard(article,true)).join('')}</div>` : '');
  }

  function renderFeed(){
    const host = document.getElementById('category-feed');
    const section = document.getElementById('category-feed-section');
    if (!host || !section) return;
    const rest = current.slice(3);
    if (!rest.length){
      section.hidden = true;
      return;
    }
    section.hidden = false;
    host.innerHTML = rest.map(article => `<a class="category-feed-card" href="${href(article)}">
      <div class="category-feed-media">${cardImage(article)}</div>
      <div class="category-feed-copy">
        <span>${esc(article.category || 'STORY')}</span>
        <h3>${esc(article.title)}</h3>
        <p>${esc(article.description || '')}</p>
        <small>BY ${esc(article.author || 'Neural Critic')} · ${readMinutes(article)} MIN READ · ${fmtDate(article.publishedAt)}</small>
      </div>
    </a>`).join('');
  }

  function renderTrending(){
    const host = document.getElementById('category-trending');
    if (!host) return;
    const list = allArticles.slice(0,3);
    host.innerHTML = list.map((article,index) => `<a href="${href(article)}"><b>${String(index+1).padStart(2,'0')}</b><div><strong>${esc(article.title)}</strong><small>${fmtDate(article.publishedAt)}</small></div></a>`).join('');
  }

  async function load(){
    const summary = await fetch('data/articles.json').then(r=>r.json());
    allArticles = await Promise.all(summary.map(async item => {
      try {
        const detail = await fetch(`data/articles/${encodeURIComponent(item.slug)}.json`).then(r=>r.ok?r.json():null);
        return detail ? {...item,...detail} : item;
      } catch (_) { return item; }
    }));
    allArticles.sort((a,b)=>new Date(b.publishedAt || 0)-new Date(a.publishedAt || 0));
  }

  async function init(){
    const category = (params.get('category') || 'latest').toLowerCase();
    const meta = config[category] || {title:category.charAt(0).toUpperCase()+category.slice(1),deck:`The latest Neural Critic stories tagged ${category}.`};
    document.title = `${meta.title} · Neural Critic`;
    document.getElementById('category-title').textContent = meta.title;
    document.getElementById('category-deck').textContent = meta.deck;
    document.getElementById('category-latest-label').textContent = `LATEST IN ${meta.title.toUpperCase()}`;

    try {
      await load();
      current = allArticles.filter(article => matches(article,category));
      document.getElementById('category-count').textContent = `${current.length} ${current.length === 1 ? 'STORY' : 'STORIES'}`;
      renderSpotlight();
      renderFeed();
      renderTrending();
    } catch (error) {
      console.error(error);
      const host = document.getElementById('category-spotlight');
      host.className = 'category-empty';
      host.innerHTML = '<h2>Category unavailable.</h2><p>Please refresh and try again.</p>';
    }

    document.getElementById('category-newsletter')?.addEventListener('submit',event=>{
      event.preventDefault();
      event.currentTarget.innerHTML = '<p class="success">You’re on the list. Welcome to the Weekly Drop.</p>';
    });
  }

  init();
})();
