(() => {
  'use strict';

  const SHORT_WINDOW_DAYS = 7;
  const LONG_WINDOW_DAYS = 30;
  const SHORT_WINDOW_SIGNAL_FLOOR = 12;
  const SITE_ROOT = new URL(location.hostname === 'rouane12.github.io' ? '/NeuralCritic/' : '/', location.origin);
  const state = { ready:false, mode:'trending', mostReadDays:LONG_WINDOW_DAYS, engine:null, viewTracked:false };

  const when = value => {
    const time = new Date(value || 0).getTime();
    return Number.isFinite(time) ? time : 0;
  };
  const esc = (value='') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const storyUrl = slug => new URL(`stories/${encodeURIComponent(slug)}/`, SITE_ROOT).href;

  function injectStyle() {
    if (document.querySelector('link[data-nc-popularity-v2]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'assets/popularity-signals.css?v=20260828-popularity2';
    link.dataset.ncPopularityV2 = '1';
    document.head.appendChild(link);
  }

  function popularityOf(article) {
    const data = article?.popularity || {};
    return {
      today: Math.max(0, Number(data.viewsToday) || 0),
      seven: Math.max(0, Number(data.views7) || 0),
      thirty: Math.max(0, Number(data.views30) || 0),
      lastViewAt: data.lastViewAt || null
    };
  }

  function selectedWindowViews(article) {
    const views = popularityOf(article);
    return state.mostReadDays === SHORT_WINDOW_DAYS ? views.seven : views.thirty;
  }

  function measuredMomentum(article) {
    const views = popularityOf(article);
    if (!views.seven && !views.today) return 0;
    let score = Math.log2(views.seven + 1) * 12 + Math.log2(views.today + 1) * 14;
    const ageHours = Math.max(0, (Date.now() - when(views.lastViewAt)) / 3600000);
    if (views.lastViewAt && ageHours <= 6) score += 8;
    else if (views.lastViewAt && ageHours <= 24) score += 4;
    return Math.min(84, score);
  }

  function topicKey(engine, article) {
    return engine.normalize(article?.gameKey || article?.franchise || article?.series || article?.category || article?.slug || '');
  }

  function diversify(engine, ranked, limit) {
    const picked = [];
    const topicUse = new Map();
    for (const item of ranked) {
      const topic = topicKey(engine, item.article);
      const used = topicUse.get(topic) || 0;
      if (used >= 1 && picked.length < Math.max(2, limit - 1)) continue;
      picked.push(item);
      topicUse.set(topic, used + 1);
      if (picked.length >= limit) break;
    }
    return picked;
  }

  function attachMetrics(rows7, rows30) {
    if (typeof ARTICLES === 'undefined' || !Array.isArray(ARTICLES)) return false;
    const seven = new Map((rows7 || []).map(row => [row.article_slug, row]));
    const thirty = new Map((rows30 || []).map(row => [row.article_slug, row]));
    ARTICLES.forEach(article => {
      const shortRow = seven.get(article.slug);
      const longRow = thirty.get(article.slug);
      article.popularity = {
        viewsToday: Number(shortRow?.views_today ?? longRow?.views_today) || 0,
        views7: Number(shortRow?.views_window) || 0,
        views30: Number(longRow?.views_window) || 0,
        lastViewAt: shortRow?.last_view_at || longRow?.last_view_at || null
      };
    });
    const totalSeven = ARTICLES.reduce((sum, article) => sum + popularityOf(article).seven, 0);
    state.mostReadDays = totalSeven >= SHORT_WINDOW_SIGNAL_FLOOR ? SHORT_WINDOW_DAYS : LONG_WINDOW_DAYS;
    return true;
  }

  function patchDiscovery(engine) {
    if (!engine || engine.__popularitySignalsV2) return;
    const baseTrending = engine.trending.bind(engine);
    const baseTrendScore = engine.trendScore.bind(engine);

    engine.mostRead = (articles = [], limit = 3) => articles
      .filter(article => article?.slug)
      .map(article => ({ article, score:selectedWindowViews(article) }))
      .filter(item => item.score > 0)
      .sort((a,b) => b.score - a.score || popularityOf(b.article).today - popularityOf(a.article).today || when(b.article.updatedAt || b.article.publishedAt) - when(a.article.updatedAt || a.article.publishedAt))
      .slice(0, limit);

    engine.trending = (articles = [], limit = 3) => {
      const measured = articles.some(article => popularityOf(article).seven > 0 || popularityOf(article).today > 0);
      if (!measured) return baseTrending(articles, limit);
      const ranked = articles
        .filter(article => article?.slug)
        .map(article => {
          const editorialScore = Math.min(62, Math.max(0, baseTrendScore(article, articles)));
          const audienceScore = measuredMomentum(article);
          return { article, score:editorialScore + audienceScore, editorialScore, audienceScore };
        })
        .sort((a,b) => b.score - a.score || popularityOf(b.article).seven - popularityOf(a.article).seven || when(b.article.updatedAt || b.article.publishedAt) - when(a.article.updatedAt || a.article.publishedAt));
      return diversify(engine, ranked, limit);
    };

    engine.__popularitySignalsV2 = true;
  }

  function formatReads(value) {
    const n = Math.max(0, Number(value) || 0);
    if (n < 1000) return String(n);
    if (n < 1000000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '')}K`;
    return `${(n / 1000000).toFixed(n >= 10000000 ? 0 : 1).replace(/\.0$/, '')}M`;
  }

  function ensureTabs() {
    const section = document.querySelector('.trending');
    const list = document.getElementById('trending');
    if (!section || !list) return null;
    let tabs = section.querySelector('.nc-popularity-tabs');
    if (!tabs) {
      tabs = document.createElement('div');
      tabs.className = 'nc-popularity-tabs';
      tabs.setAttribute('role', 'tablist');
      tabs.setAttribute('aria-label', 'Popular stories view');
      tabs.innerHTML = '<button id="popularity-tab-trending" type="button" role="tab" data-popularity-mode="trending" aria-controls="trending" aria-selected="true">TRENDING</button><button id="popularity-tab-most-read" type="button" role="tab" data-popularity-mode="most-read" aria-controls="trending" aria-selected="false">MOST READ</button>';
      list.insertAdjacentElement('beforebegin', tabs);
      const selectMode = next => {
        if (!['trending','most-read'].includes(next) || next === state.mode) return;
        state.mode = next;
        renderPopularity();
        window.NeuralCriticAnalytics?.track?.('popularity_tab_switch', { popularity_mode:next, most_read_window_days:state.mostReadDays });
      };
      tabs.addEventListener('click', event => {
        const button = event.target.closest('[data-popularity-mode]');
        if (!button) return;
        selectMode(button.dataset.popularityMode);
      });
      tabs.addEventListener('keydown', event => {
        if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
        event.preventDefault();
        const buttons = [...tabs.querySelectorAll('[data-popularity-mode]')];
        const current = Math.max(0, buttons.indexOf(document.activeElement));
        const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : event.key === 'ArrowRight' ? (current + 1) % buttons.length : (current - 1 + buttons.length) % buttons.length;
        buttons[nextIndex]?.focus();
        selectMode(buttons[nextIndex]?.dataset.popularityMode);
      });
    }
    let definition = section.querySelector('.nc-popularity-definition');
    if (!definition) {
      definition = document.createElement('p');
      definition.className = 'nc-popularity-definition';
      tabs.insertAdjacentElement('afterend', definition);
    }
    return section;
  }

  function metaFor(article, mode) {
    const views = popularityOf(article);
    const category = String(article.category || 'STORY').toUpperCase();
    if (mode === 'most-read') {
      const reads = selectedWindowViews(article);
      return `${category} · ${formatReads(reads)} READ${reads === 1 ? '' : 'S'} / ${state.mostReadDays}D`;
    }
    if (views.seven > 0) return `${category} · ${formatReads(views.seven)} READ${views.seven === 1 ? '' : 'S'} / 7D`;
    const kind = article.newsMeta?.kind ? ` · ${String(article.newsMeta.kind).toUpperCase()}` : '';
    return `${category}${kind} · MOMENTUM`;
  }

  function renderPopularity() {
    if (!state.ready || !state.engine || typeof ARTICLES === 'undefined' || !Array.isArray(ARTICLES)) return;
    const section = ensureTabs();
    const listEl = document.getElementById('trending');
    if (!section || !listEl) return;

    const isMostRead = state.mode === 'most-read';
    const reserved = new Set([...(window.NeuralCriticHomepageState?.featuredSlugs || []),...(window.NeuralCriticHomepageState?.feedSlugs || [])]);
    const distinct = ARTICLES.filter(article => !reserved.has(article.slug));
    const candidates = distinct.length >= 3 ? distinct : ARTICLES;
    const ranked = isMostRead ? state.engine.mostRead(candidates, 3) : state.engine.trending(candidates, 3);
    const items = ranked.map(item => item.article || item).filter(Boolean);
    const eyebrow = section.querySelector('.sidetitle small');
    const title = section.querySelector('.sidetitle h2');
    const definition = section.querySelector('.nc-popularity-definition');
    if (eyebrow) eyebrow.textContent = isMostRead ? `READER SIGNAL · ${state.mostReadDays} DAYS` : 'LIVE MOMENTUM';
    if (title) title.textContent = isMostRead ? 'Most read' : 'Trending now';
    if (definition) definition.textContent = isMostRead ? `Measured reader activity across the last ${state.mostReadDays} days.` : 'Fresh coverage gaining editorial and reader momentum now.';

    section.querySelectorAll('[data-popularity-mode]').forEach(button => {
      const selected = button.dataset.popularityMode === state.mode;
      button.setAttribute('aria-selected', selected ? 'true' : 'false');
      button.setAttribute('tabindex', selected ? '0' : '-1');
      button.classList.toggle('active', selected);
    });
    listEl.setAttribute('role','tabpanel');
    listEl.setAttribute('aria-labelledby',isMostRead ? 'popularity-tab-most-read' : 'popularity-tab-trending');

    if (!items.length && isMostRead) {
      listEl.innerHTML = '<div class="nc-popularity-warmup"><b>AUDIENCE SIGNALS ARE WARMING UP</b><p>Most Read appears as real reader activity accumulates.</p></div>';
    } else {
      listEl.innerHTML = items.map((article, index) => `<a href="${storyUrl(article.slug)}" data-popularity-target="${esc(article.slug)}" data-popularity-rank="${index + 1}"><b>${String(index + 1).padStart(2,'0')}</b><div><p>${esc(article.title)}</p><small>${esc(metaFor(article, state.mode))}</small></div></a>`).join('');
    }

    section.dataset.popularityMode = state.mode;
    section.dataset.mostReadWindow = String(state.mostReadDays);
    trackModuleView(section);
  }

  function installClickTracking() {
    const section = document.querySelector('.trending');
    if (!section || section.dataset.popularityTracking === '1') return;
    section.dataset.popularityTracking = '1';
    section.addEventListener('click', event => {
      const link = event.target.closest('[data-popularity-target]');
      if (!link) return;
      window.NeuralCriticAnalytics?.track?.('popularity_story_click', {
        popularity_mode:state.mode,
        target_slug:link.dataset.popularityTarget || '',
        rank:Number(link.dataset.popularityRank || 0),
        most_read_window_days:state.mostReadDays
      });
    });
  }

  function trackModuleView(section) {
    if (state.viewTracked || !section || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      state.viewTracked = true;
      window.NeuralCriticAnalytics?.track?.('popularity_module_view', {
        default_mode:'trending',
        most_read_window_days:state.mostReadDays
      });
    }, { threshold:0.3 });
    observer.observe(section);
  }

  function patchRenderer() {
    if (typeof renderTrending !== 'function' || renderTrending.__popularitySignalsV2) return false;
    const baseRender = renderTrending;
    const wrapped = function(...args) {
      if (!state.ready) return baseRender.apply(this, args);
      return renderPopularity();
    };
    wrapped.__popularitySignalsV2 = true;
    renderTrending = wrapped;
    return true;
  }

  async function waitForHomepageState(limit = 80) {
    for (let i = 0; i < limit; i++) {
      if (typeof ARTICLES !== 'undefined' && Array.isArray(ARTICLES) && ARTICLES.length && window.NeuralCriticContentAPI?.articlePopularity && typeof renderTrending === 'function') return true;
      await new Promise(resolve => setTimeout(resolve, 75));
    }
    return false;
  }

  async function init() {
    if (!document.getElementById('hero')) return;
    injectStyle();
    const engine = await (window.NeuralCriticDiscoveryReady || Promise.resolve(window.NeuralCriticDiscovery || null));
    if (!engine || !(await waitForHomepageState())) return;
    try {
      const [rows7, rows30] = await Promise.all([
        window.NeuralCriticContentAPI.articlePopularity(SHORT_WINDOW_DAYS),
        window.NeuralCriticContentAPI.articlePopularity(LONG_WINDOW_DAYS)
      ]);
      if (!attachMetrics(rows7, rows30)) return;
      patchDiscovery(engine);
      state.engine = engine;
      state.ready = true;
      patchRenderer();
      ensureTabs();
      installClickTracking();
      renderPopularity();
    } catch (error) {
      console.warn('Neural Critic audience signals unavailable; keeping editorial momentum.', error);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();
})();
