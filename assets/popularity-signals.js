(() => {
  'use strict';

  const WINDOW_DAYS = 7;
  const when = value => {
    const time = new Date(value || 0).getTime();
    return Number.isFinite(time) ? time : 0;
  };

  function popularityOf(article) {
    const data = article?.popularity || {};
    return {
      today: Math.max(0, Number(data.viewsToday) || 0),
      window: Math.max(0, Number(data.viewsWindow) || 0),
      lastViewAt: data.lastViewAt || null
    };
  }

  function popularityScore(article) {
    const views = popularityOf(article);
    if (!views.window && !views.today) return 0;
    const sevenDay = Math.log2(views.window + 1) * 11;
    const today = Math.log2(views.today + 1) * 9;
    return Math.min(72, sevenDay + today);
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

  function attachMetrics(rows) {
    if (typeof ARTICLES === 'undefined' || !Array.isArray(ARTICLES)) return false;
    const metrics = new Map((rows || []).map(row => [row.article_slug, row]));
    ARTICLES.forEach(article => {
      const row = metrics.get(article.slug);
      article.popularity = {
        viewsToday: Number(row?.views_today) || 0,
        viewsWindow: Number(row?.views_window) || 0,
        lastViewAt: row?.last_view_at || null,
        windowDays: WINDOW_DAYS
      };
    });
    return true;
  }

  function patchDiscovery(engine) {
    if (!engine || engine.__popularitySignalsV1) return;
    const baseTrending = engine.trending.bind(engine);
    const baseTrendScore = engine.trendScore.bind(engine);

    engine.mostRead = (articles = [], limit = 3) => articles
      .filter(article => article?.slug)
      .map(article => ({ article, score: popularityOf(article).window }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score || popularityOf(b.article).today - popularityOf(a.article).today || when(b.article.updatedAt || b.article.publishedAt) - when(a.article.updatedAt || a.article.publishedAt))
      .slice(0, limit);

    engine.trending = (articles = [], limit = 3) => {
      const hasMeasuredViews = articles.some(article => popularityOf(article).window > 0);
      if (!hasMeasuredViews) return baseTrending(articles, limit);

      const ranked = articles
        .filter(article => article?.slug)
        .map(article => {
          const editorialScore = baseTrendScore(article, articles);
          const measuredScore = popularityScore(article);
          return { article, score: editorialScore + measuredScore, editorialScore, measuredScore };
        })
        .sort((a, b) => b.score - a.score || popularityOf(b.article).window - popularityOf(a.article).window || when(b.article.updatedAt || b.article.publishedAt) - when(a.article.updatedAt || a.article.publishedAt));

      return diversify(engine, ranked, limit);
    };

    engine.__popularitySignalsV1 = true;
  }

  function slugFromHref(href) {
    try {
      const url = new URL(href, location.href);
      const querySlug = url.searchParams.get('slug');
      if (querySlug) return querySlug;
      const match = url.pathname.match(/\/NeuralCritic\/stories\/([^/]+)\/?$/i);
      return match?.[1] ? decodeURIComponent(match[1]) : '';
    } catch (_) {
      return '';
    }
  }

  function decorateTrending() {
    if (typeof ARTICLES === 'undefined' || !Array.isArray(ARTICLES)) return;
    const measured = ARTICLES.some(article => popularityOf(article).window > 0);
    const label = document.querySelector('.trending .sidetitle small');
    if (label) label.textContent = measured ? 'MOST READ + MOMENTUM' : 'EDITORIAL MOMENTUM';

    const bySlug = new Map(ARTICLES.map(article => [article.slug, article]));
    document.querySelectorAll('#trending a').forEach(anchor => {
      const article = bySlug.get(slugFromHref(anchor.href));
      if (!article) return;
      const views = popularityOf(article);
      if (!views.window) return;
      const meta = anchor.querySelector('small');
      if (!meta || meta.dataset.popularityDecorated === '1') return;
      meta.dataset.popularityDecorated = '1';
      meta.textContent += ` · ${views.window} READ${views.window === 1 ? '' : 'S'} / ${WINDOW_DAYS}D`;
    });
  }

  function patchRenderer() {
    if (typeof renderTrending !== 'function' || renderTrending.__popularitySignalsV1) return false;
    const baseRender = renderTrending;
    const wrapped = function(...args) {
      const result = baseRender.apply(this, args);
      decorateTrending();
      return result;
    };
    wrapped.__popularitySignalsV1 = true;
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
    const engine = await (window.NeuralCriticDiscoveryReady || Promise.resolve(window.NeuralCriticDiscovery || null));
    if (!engine || !(await waitForHomepageState())) return;

    try {
      const rows = await window.NeuralCriticContentAPI.articlePopularity(WINDOW_DAYS);
      if (!attachMetrics(rows)) return;
      patchDiscovery(engine);
      patchRenderer();
      renderTrending();
    } catch (error) {
      console.warn('Neural Critic popularity signals unavailable; keeping editorial momentum.', error);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();
})();
