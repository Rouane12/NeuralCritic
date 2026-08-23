(() => {
  'use strict';

  const SITE_ROOT = new URL('/NeuralCritic/', location.origin);
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = (value = '') => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const normalize = (value = '') => String(value).trim().toLowerCase().replace(/\s+/g, ' ');
  const slugify = (value = '') => String(value).trim().toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  const GENERIC_BEATS = new Set([
    'review','reviews','feature','features','news','guide','guides','gaming','game','games','pc',
    'playstation','xbox','nintendo','mobile','console','ranked list','what to play','best games',
    'best games of all time','all-time greats','gaming history','open world','open-world','action rpg'
  ]);

  function authorUrl(slug) {
    return new URL(`authors/${encodeURIComponent(slug)}/`, SITE_ROOT).href;
  }

  function storyUrl(slug) {
    return new URL(`stories/${encodeURIComponent(slug)}/`, SITE_ROOT).href;
  }

  function topicUrl(type, value) {
    const slug = slugify(value);
    return slug ? new URL(`topics/${type}/${slug}/`, SITE_ROOT).href : '#';
  }

  function imageUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) {
      const marker = '/media/editorial/';
      if (raw.includes(marker)) {
        const filename = raw.split(marker)[1]?.split(/[?#]/)[0];
        if (filename) return new URL(`images/editorial/${decodeURIComponent(filename)}`, SITE_ROOT).href;
      }
      return raw;
    }
    try { return new URL(raw, SITE_ROOT).href; } catch (_) { return raw; }
  }

  function fmtDate(value) {
    if (!value) return '';
    try {
      return new Intl.DateTimeFormat('en-GB', {day:'2-digit', month:'short', year:'numeric'}).format(new Date(value));
    } catch (_) { return ''; }
  }

  function reviewScore(article) {
    const raw = article?.reviewMeta?.score ?? article?.review_meta?.score;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  }

  async function profiles() {
    try {
      const response = await fetch(new URL('data/authors.json', SITE_ROOT));
      const payload = response.ok ? await response.json() : [];
      return Array.isArray(payload) ? payload : [];
    } catch (_) { return []; }
  }

  async function waitForContentApi(timeout = 5000) {
    const started = performance.now();
    while (performance.now() - started < timeout) {
      if (window.NeuralCriticContentAPI?.publishedIndex) return window.NeuralCriticContentAPI;
      await new Promise(resolve => setTimeout(resolve, 80));
    }
    return null;
  }

  async function publishedArticles() {
    try {
      const api = await waitForContentApi();
      if (api) {
        const rows = await api.publishedIndex();
        if (Array.isArray(rows)) return rows;
      }
    } catch (_) {}
    try {
      const response = await fetch(new URL('data/articles.json', SITE_ROOT));
      const payload = response.ok ? await response.json() : [];
      return Array.isArray(payload) ? payload : [];
    } catch (_) { return []; }
  }

  function setMeta(name, content, property = false) {
    if (!content) return;
    const selector = property ? `meta[property="${name}"]` : `meta[name="${name}"]`;
    let node = document.head.querySelector(selector);
    if (!node) {
      node = document.createElement('meta');
      node.setAttribute(property ? 'property' : 'name', name);
      document.head.appendChild(node);
    }
    node.setAttribute('content', String(content));
  }

  function setCanonical(url) {
    let link = document.head.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.appendChild(link);
    }
    link.href = url;
  }

  function setAuthorStructuredData(profile, articles, canonical) {
    let script = $('#nc-author-structured-data');
    if (!script) {
      script = document.createElement('script');
      script.id = 'nc-author-structured-data';
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify({
      '@context':'https://schema.org',
      '@type':'ProfilePage',
      name:`${profile.name} · Neural Critic`,
      url:canonical,
      mainEntity:{
        '@type':'Person',
        name:profile.name,
        url:canonical,
        image:imageUrl(profile.avatar),
        jobTitle:profile.role || 'Writer & Editor',
        description:profile.bio || profile.shortBio || '',
        worksFor:{'@type':'Organization',name:'Neural Critic',url:SITE_ROOT.href}
      },
      hasPart:articles.slice(0,12).map(article => ({
        '@type':'CreativeWork',
        name:article.title,
        url:storyUrl(article.slug)
      }))
    });
  }

  function updateAuthorMetadata(profile, articles) {
    if (window.NEURAL_CRITIC_STATIC_META) return;
    const canonical = authorUrl(profile.slug);
    const description = profile.shortBio || profile.bio || `${profile.name} writes for Neural Critic.`;
    document.title = `${profile.name} · Neural Critic`;
    setMeta('description', description);
    setMeta('robots', 'index,follow,max-image-preview:large');
    setMeta('og:site_name', 'Neural Critic', true);
    setMeta('og:type', 'profile', true);
    setMeta('og:title', `${profile.name} · Neural Critic`, true);
    setMeta('og:description', description, true);
    setMeta('og:url', canonical, true);
    setMeta('twitter:card', 'summary');
    setMeta('twitter:title', `${profile.name} · Neural Critic`);
    setMeta('twitter:description', description);
    const avatar = imageUrl(profile.avatar);
    if (avatar) {
      setMeta('og:image', avatar, true);
      setMeta('twitter:image', avatar);
    }
    setCanonical(canonical);
    setAuthorStructuredData(profile, articles, canonical);
  }

  function identityBeats(articles) {
    const weighted = new Map();
    const add = (label, type = '', weight = 1) => {
      const name = String(label || '').trim();
      if (!name || GENERIC_BEATS.has(normalize(name))) return;
      const key = `${type}:${normalize(name)}`;
      const current = weighted.get(key) || {name, type, score:0};
      current.score += weight;
      weighted.set(key, current);
    };

    articles.forEach(article => {
      add(article.franchise, 'franchise', 7);
      add(article.series, 'series', 6);
      add(article.gameKey || article.game_key, 'game', 5);
      (article.tags || []).forEach(tag => add(tag, '', 1));
    });

    return [...weighted.values()]
      .sort((a,b) => b.score - a.score || a.name.localeCompare(b.name))
      .slice(0,8);
  }

  function formatLabel(article) {
    return String(article.articleFormat || article.article_format || article.category || 'story').replace(/[-_]+/g, ' ').toUpperCase();
  }

  function storyCard(article, lead = false) {
    const image = imageUrl(article.imageLocal || article.image_url || '');
    const score = reviewScore(article);
    return `<a class="nc-author-story${lead ? ' is-lead' : ''}" href="${esc(storyUrl(article.slug))}">
      <div class="nc-author-story-media">${image ? `<img src="${esc(image)}" alt="${esc(article.imageAlt || article.image_alt || article.title || '')}" loading="${lead ? 'eager' : 'lazy'}" decoding="async">` : '<span>NEURAL CRITIC</span>'}${score !== null ? `<b>${esc(score)}<small>/10</small></b>` : ''}</div>
      <div class="nc-author-story-copy">
        <small>${esc(formatLabel(article))}</small>
        <h3>${esc(article.title || '')}</h3>
        <p>${esc(article.description || '')}</p>
        <footer><span>${esc(fmtDate(article.publishedAt || article.published_at))}</span><strong>READ STORY →</strong></footer>
      </div>
    </a>`;
  }

  function categoryMix(articles) {
    const values = new Map();
    articles.forEach(article => {
      const label = String(article.category || 'STORY').toUpperCase();
      values.set(label, (values.get(label) || 0) + 1);
    });
    return [...values.entries()].sort((a,b) => b[1] - a[1]);
  }

  function reviewSnapshot(reviews) {
    if (!reviews.length) return '<p class="nc-author-empty-copy">Published review scores will appear here.</p>';
    const scored = reviews.map(article => ({article, score:reviewScore(article)})).filter(item => item.score !== null);
    const average = scored.length ? (scored.reduce((sum,item) => sum + item.score, 0) / scored.length).toFixed(1) : '—';
    return `<div class="nc-author-review-average"><small>AVERAGE SCORE</small><strong>${esc(average)}${average !== '—' ? '<em>/10</em>' : ''}</strong></div>
      <div class="nc-author-review-list">${scored.slice(0,4).map(item => `<a href="${esc(storyUrl(item.article.slug))}"><span>${esc(item.article.title || '')}</span><b>${esc(item.score)}</b></a>`).join('')}</div>`;
  }

  function followState(slug) {
    try { return localStorage.getItem(`neural-critic-author-follow:${slug}`) === '1'; } catch (_) { return false; }
  }

  function setFollowState(slug, active) {
    try { localStorage.setItem(`neural-critic-author-follow:${slug}`, active ? '1' : '0'); } catch (_) {}
  }

  function syncFollowButtons(slug, active, root = document) {
    $$('[data-author-follow],[data-article-follow]', root).forEach(button => {
      button.classList.toggle('active', active);
      if (button.matches('[data-author-follow]')) button.textContent = active ? 'FOLLOWING' : 'FOLLOW';
      const small = $('small', button);
      if (small && button.matches('[data-article-follow]')) small.textContent = active ? 'FOLLOWING' : 'FOLLOW';
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  async function renderAuthorHub() {
    const host = $('#author-hub');
    if (!host) return;

    const directory = await profiles();
    const staticAuthor = window.NEURAL_CRITIC_STATIC_AUTHOR || null;
    const requested = staticAuthor?.slug || new URLSearchParams(location.search).get('author') || '';
    const profile = directory.find(item => item.slug === requested) || directory.find(item => normalize(item.name) === normalize(requested));
    if (!profile) {
      host.innerHTML = '<section class="nc-author-missing"><small>NEURAL CRITIC WRITERS</small><h1>Writer unavailable.</h1><p>This author profile could not be found.</p><a href="index.html">BACK TO NEURAL CRITIC →</a></section>';
      return;
    }

    const rows = await publishedArticles();
    const articles = rows.filter(article => normalize(article.author || article.author_name || 'Rouane Mounssif') === normalize(profile.name))
      .sort((a,b) => new Date(b.publishedAt || b.published_at || 0) - new Date(a.publishedAt || a.published_at || 0));
    const reviews = articles.filter(article => String(article.articleFormat || article.article_format || '').toLowerCase() === 'review' || String(article.category || '').toUpperCase() === 'REVIEW');
    const features = articles.filter(article => String(article.category || '').toUpperCase() === 'FEATURE');
    const news = articles.filter(article => String(article.category || '').toUpperCase() === 'NEWS');
    const beats = identityBeats(articles);
    const mix = categoryMix(articles);
    const avatar = imageUrl(profile.avatar);
    const latest = articles[0];

    updateAuthorMetadata(profile, articles);

    host.innerHTML = `
      <section class="nc-author-hero">
        <div class="nc-author-identity">
          <div class="nc-author-avatar-wrap">${avatar ? `<img src="${esc(avatar)}" alt="${esc(profile.name)}">` : '<span>NC</span>'}</div>
          <div class="nc-author-hero-copy">
            <small>NEURAL CRITIC WRITER</small>
            <h1>${esc(profile.name)}</h1>
            <strong>${esc(profile.role || 'Writer & Editor')}</strong>
            <p>${esc(profile.bio || profile.shortBio || '')}</p>
            <div class="nc-author-actions"><button type="button" data-author-follow>FOLLOW</button>${latest ? `<a href="${esc(storyUrl(latest.slug))}">LATEST STORY →</a>` : ''}</div>
          </div>
        </div>
        <div class="nc-author-stats">
          <div><small>PUBLISHED STORIES</small><strong>${articles.length}</strong></div>
          <div><small>REVIEWS</small><strong>${reviews.length}</strong></div>
          <div><small>FEATURES</small><strong>${features.length}</strong></div>
          <div><small>NEWS</small><strong>${news.length}</strong></div>
        </div>
        <div class="nc-author-beats"><span>COVERAGE BEATS</span>${beats.length ? beats.map(beat => beat.type ? `<a href="${esc(topicUrl(beat.type,beat.name))}">${esc(beat.name)} <i>→</i></a>` : `<b>${esc(beat.name)}</b>`).join('') : '<p>Coverage beats will grow with published work.</p>'}</div>
      </section>

      <section class="nc-author-grid">
        <div class="nc-author-main">
          <header class="nc-author-section-head"><div><small>FROM THIS WRITER</small><h2>Latest work</h2></div><span>${articles.length} ${articles.length === 1 ? 'STORY' : 'STORIES'}</span></header>
          <div class="nc-author-stories">${articles.length ? articles.slice(0,8).map((article,index) => storyCard(article,index === 0)).join('') : '<p class="nc-author-empty-copy">No published work yet.</p>'}</div>
        </div>
        <aside class="nc-author-sidebar">
          <section class="nc-author-side-card"><small>EDITORIAL MIX</small><h3>Coverage mix</h3><div class="nc-author-mix">${mix.length ? mix.map(([label,count]) => `<div><span>${esc(label)}</span><strong>${count}</strong></div>`).join('') : '<p class="nc-author-empty-copy">No published coverage yet.</p>'}</div></section>
          <section class="nc-author-side-card"><small>REVIEW DESK</small><h3>Score snapshot</h3>${reviewSnapshot(reviews)}</section>
        </aside>
      </section>`;

    const active = followState(profile.slug);
    syncFollowButtons(profile.slug, active, host);
    $('[data-author-follow]', host)?.addEventListener('click', event => {
      const next = !event.currentTarget.classList.contains('active');
      setFollowState(profile.slug, next);
      syncFollowButtons(profile.slug, next, host);
      window.NeuralCriticAnalytics?.track?.('author_follow_toggle', {author_slug:profile.slug, following:next ? 1 : 0});
    });

    window.NeuralCriticAnalytics?.track?.('author_hub_view', {
      author_slug:profile.slug,
      published_stories:articles.length,
      review_count:reviews.length,
      feature_count:features.length
    });
  }

  function installArticleIdentityStyle() {
    if ($('#nc-author-identity-style')) return;
    const style = document.createElement('style');
    style.id = 'nc-author-identity-style';
    style.textContent = `
      #article .work-author-copy strong a,#article .work-author-card-row strong a{color:inherit;text-decoration:none}
      #article .work-author-copy strong a:hover,#article .work-author-card-row strong a:hover{color:#55dff5}
      #article .nc-author-profile-link{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:36px;margin:-4px 0 12px;padding:0 1px;color:#55dff5;font:800 7.5px/1 Inter,system-ui,sans-serif;letter-spacing:.09em;text-decoration:none}
      #article .nc-author-profile-link::after{content:'→';color:#7b70ff;font-size:13px;transition:transform .18s ease}
      #article .nc-author-profile-link:hover::after{transform:translateX(3px)}
      html[data-theme="light"] #article .nc-author-profile-link{color:#22aeca}
      @media(prefers-reduced-motion:reduce){#article .nc-author-profile-link::after{transition:none}}
    `;
    document.head.appendChild(style);
  }

  async function waitForArticleAuthor(timeout = 6000) {
    const started = performance.now();
    while (performance.now() - started < timeout) {
      const byline = $('#article .work-author-copy strong');
      const card = $('#article .work-author-card');
      if (byline || card) return {byline, card};
      await new Promise(resolve => setTimeout(resolve, 90));
    }
    return {byline:null, card:null};
  }

  async function enhanceArticleAuthor() {
    if (!$('#article')) return;
    const {byline, card} = await waitForArticleAuthor();
    if (!byline && !card) return;

    const directory = await profiles();
    const name = byline?.textContent?.trim() || $('.work-author-card-row strong', card)?.textContent?.trim() || '';
    const profile = directory.find(item => normalize(item.name) === normalize(name));
    if (!profile) return;

    installArticleIdentityStyle();
    const url = authorUrl(profile.slug);

    if (byline && !byline.querySelector('a')) {
      const current = byline.textContent.trim();
      byline.innerHTML = `<a href="${esc(url)}">${esc(current)}</a>`;
    }

    const cardName = $('.work-author-card-row strong', card);
    if (cardName && !cardName.querySelector('a')) {
      const current = cardName.textContent.trim();
      cardName.innerHTML = `<a href="${esc(url)}">${esc(current)}</a>`;
    }

    if (card && !$('.nc-author-profile-link', card)) {
      const link = document.createElement('a');
      link.className = 'nc-author-profile-link';
      link.href = url;
      link.innerHTML = '<span>VIEW WRITER PROFILE</span>';
      const button = card.querySelector(':scope > button[data-author-follow], :scope > button');
      if (button) card.insertBefore(link, button); else card.appendChild(link);
    }

    const active = followState(profile.slug);
    syncFollowButtons(profile.slug, active, document);
    $$('[data-author-follow],[data-article-follow]').forEach(button => {
      if (button.dataset.ncAuthorPersist === '1') return;
      button.dataset.ncAuthorPersist = '1';
      button.addEventListener('click', () => {
        queueMicrotask(() => {
          const next = button.classList.contains('active');
          setFollowState(profile.slug, next);
          syncFollowButtons(profile.slug, next, document);
        });
      });
    });

    let person = $('#nc-article-author-person');
    if (!person) {
      person = document.createElement('script');
      person.id = 'nc-article-author-person';
      person.type = 'application/ld+json';
      document.head.appendChild(person);
    }
    person.textContent = JSON.stringify({
      '@context':'https://schema.org',
      '@type':'Person',
      name:profile.name,
      url,
      image:imageUrl(profile.avatar),
      jobTitle:profile.role || 'Writer & Editor',
      worksFor:{'@type':'Organization',name:'Neural Critic',url:SITE_ROOT.href}
    });
  }

  if ($('#author-hub')) renderAuthorHub();
  if ($('#article')) enhanceArticleAuthor();
})();
