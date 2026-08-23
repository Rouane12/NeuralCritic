(() => {
  'use strict';

  const $ = (s, root = document) => root.querySelector(s);
  const LABELS = {
    breaking: { label: 'BREAKING', status: 'CONFIRMED · TIME-SENSITIVE', className: 'is-breaking' },
    update: { label: 'UPDATE', status: 'CONFIRMED · DEVELOPING STORY', className: 'is-update' },
    report: { label: 'REPORT', status: 'REPORTED · NOT FULLY CONFIRMED', className: 'is-report' }
  };

  function slugFromPage() {
    return window.NEURAL_CRITIC_STATIC_SLUG || new URLSearchParams(location.search).get('slug') || '';
  }

  async function waitForClient(limit = 60) {
    for (let i = 0; i < limit; i++) {
      if (window.neuralCriticPublicSupabase) return window.neuralCriticPublicSupabase;
      if (window.neuralCriticSupabase) return window.neuralCriticSupabase;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return null;
  }

  async function waitForArticle(limit = 80) {
    for (let i = 0; i < limit; i++) {
      const article = $('#article');
      if (article && article.querySelector('h1') && !article.querySelector('.article-loading-state')) return article;
      await new Promise(resolve => setTimeout(resolve, 75));
    }
    return $('#article');
  }

  function safeUrl(value) {
    try {
      const url = new URL(value, location.href);
      return /^https?:$/.test(url.protocol) ? url.href : '';
    } catch (_) {
      return '';
    }
  }

  function render(article, meta) {
    const kind = meta?.kind;
    const config = LABELS[kind];
    if (!article || !config || article.querySelector('.nc-news-context')) return;

    article.classList.add('nc-news-article', config.className);
    const kicker = article.querySelector('.article-kicker');
    if (kicker) {
      kicker.textContent = `NEWS · ${config.label}`;
      kicker.classList.add('nc-news-kicker');
    }

    const sourceName = String(meta.sourceName || '').trim();
    const sourceUrl = safeUrl(meta.sourceUrl || '');
    const panel = document.createElement('section');
    panel.className = 'nc-news-context';
    panel.innerHTML = `
      <div class="nc-news-context-signal">
        <span>${config.label}</span>
        <div><b>${config.status}</b><small>${kind === 'report' ? 'Neural Critic is presenting this as attributed reporting, not confirmed fact.' : 'Neural Critic is presenting this as confirmed information.'}</small></div>
      </div>
      ${sourceName ? `<div class="nc-news-source"><small>SOURCE / ORIGIN</small>${sourceUrl ? `<a href="${sourceUrl}" target="_blank" rel="noopener noreferrer">${sourceName} ↗</a>` : `<strong>${sourceName}</strong>`}</div>` : ''}`;

    const metaRow = article.querySelector('.article-meta');
    if (metaRow) metaRow.insertAdjacentElement('afterend', panel);
    else article.querySelector('h1')?.insertAdjacentElement('afterend', panel);

    window.gtag?.('event', 'news_article_view', {
      news_kind: kind,
      source_present: sourceName ? 'yes' : 'no'
    });
  }

  async function init() {
    const slug = slugFromPage();
    if (!slug) return;
    const client = await waitForClient();
    if (!client) return;

    try {
      const { data, error } = await client.from('articles').select('category,news_meta').eq('slug', slug).eq('status', 'published').maybeSingle();
      if (error || !data || String(data.category || '').toUpperCase() !== 'NEWS') return;
      const meta = data.news_meta && typeof data.news_meta === 'object' ? data.news_meta : {};
      if (!LABELS[meta.kind]) return;
      const article = await waitForArticle();
      render(article, meta);
    } catch (error) {
      console.warn('Neural Critic news context unavailable.', error);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();