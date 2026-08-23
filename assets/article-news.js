(() => {
  'use strict';

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const LABELS = {
    breaking: { label: 'BREAKING', status: 'CONFIRMED · TIME-SENSITIVE', className: 'is-breaking' },
    update: { label: 'UPDATE', status: 'CONFIRMED · DEVELOPING STORY', className: 'is-update' },
    report: { label: 'REPORT', status: 'REPORTED · NOT FULLY CONFIRMED', className: 'is-report' }
  };
  const esc = (value = '') => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

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

  function updateTime(value) {
    try {
      return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
      }).format(new Date(value)).toUpperCase();
    } catch (_) {
      return String(value || '').toUpperCase();
    }
  }

  function markDocumentImage(img) {
    if (!img || img.dataset.ncNewsDocumentChecked === '1') return;
    img.dataset.ncNewsDocumentChecked = '1';

    const apply = () => {
      const width = Number(img.naturalWidth || 0);
      const height = Number(img.naturalHeight || 0);
      if (!width || !height || height / width < 1.12) return;

      const figure = img.closest('figure');
      if (!figure || figure.classList.contains('nc-news-document-media')) return;

      figure.classList.add('nc-news-document-media');
      const frame = document.createElement('div');
      frame.className = 'nc-news-document-frame';
      img.parentNode.insertBefore(frame, img);
      frame.appendChild(img);

      const label = document.createElement('span');
      label.className = 'nc-news-document-label';
      label.textContent = 'SOURCE DOCUMENT · CLICK TO EXPAND';
      frame.appendChild(label);
    };

    if (img.complete && img.naturalWidth) apply();
    else img.addEventListener('load', apply, { once: true });
  }

  function polishDocumentMedia(article) {
    $$('.article-body figure img.article-hero', article).forEach(markDocumentImage);
  }

  function renderUpdateLog(article, meta, context) {
    const updates = Array.isArray(meta?.updates)
      ? meta.updates.filter(item => item && String(item.note || '').trim() && item.at)
        .sort((a, b) => new Date(b.at) - new Date(a.at))
      : [];
    if (!updates.length || article.querySelector('.nc-news-update-log')) return;

    const section = document.createElement('section');
    section.className = 'nc-news-update-log';
    section.innerHTML = `
      <header><div><small>DEVELOPING COVERAGE</small><h2>Update log</h2></div><span>${updates.length} ${updates.length === 1 ? 'UPDATE' : 'UPDATES'}</span></header>
      <div class="nc-news-update-items">
        ${updates.slice(0, 6).map((item, index) => `<article class="nc-news-update-entry${index === 0 ? ' is-latest' : ''}">
          <time datetime="${esc(item.at)}">${esc(updateTime(item.at))}</time>
          <p>${esc(item.note)}</p>
        </article>`).join('')}
      </div>`;
    context.insertAdjacentElement('afterend', section);
  }

  function render(article, meta) {
    const kind = meta?.kind;
    const config = LABELS[kind];
    if (!article || !config) return;

    const developing = Boolean(meta.developing);
    const updateCount = Array.isArray(meta.updates) ? meta.updates.filter(item => item && item.note).length : 0;
    article.classList.add('nc-news-article', config.className);
    article.classList.toggle('is-developing', developing);

    const kicker = article.querySelector('.article-kicker');
    if (kicker) {
      kicker.textContent = `NEWS · ${config.label}`;
      kicker.classList.add('nc-news-kicker');
    }

    let panel = article.querySelector('.nc-news-context');
    if (!panel) {
      const sourceName = String(meta.sourceName || '').trim();
      const sourceUrl = safeUrl(meta.sourceUrl || '');
      const dynamicStatus = developing
        ? config.status
        : (kind === 'report' ? config.status : 'CONFIRMED · STORY SETTLED');
      const trustCopy = kind === 'report'
        ? 'Neural Critic is presenting this as attributed reporting, not confirmed fact.'
        : developing
          ? 'Confirmed information. This story remains open to substantive updates as facts develop.'
          : 'Neural Critic is presenting this as confirmed information.';

      panel = document.createElement('section');
      panel.className = 'nc-news-context';
      panel.innerHTML = `
        <div class="nc-news-context-signal">
          <span>${config.label}</span>
          <div><b>${dynamicStatus}</b><small>${trustCopy}</small></div>
        </div>
        ${sourceName ? `<div class="nc-news-source"><small>SOURCE / ORIGIN</small>${sourceUrl ? `<a href="${sourceUrl}" target="_blank" rel="noopener noreferrer">${esc(sourceName)} ↗</a>` : `<strong>${esc(sourceName)}</strong>`}</div>` : ''}`;

      const metaRow = article.querySelector('.article-meta');
      if (metaRow) metaRow.insertAdjacentElement('afterend', panel);
      else article.querySelector('h1')?.insertAdjacentElement('afterend', panel);

      if (updateCount) {
        const badge = document.createElement('span');
        badge.className = 'nc-news-updated-badge';
        const latest = meta.updates.filter(item => item?.at).sort((a,b) => new Date(b.at) - new Date(a.at))[0];
        badge.textContent = latest ? `UPDATED ${updateTime(latest.at)}` : 'UPDATED';
        panel.appendChild(badge);
      }

      window.gtag?.('event', 'news_article_view', {
        news_kind: kind,
        source_present: sourceName ? 'yes' : 'no',
        developing_story: developing ? 'yes' : 'no',
        update_count: updateCount
      });
    }

    renderUpdateLog(article, meta, panel);
    polishDocumentMedia(article);
    setTimeout(() => polishDocumentMedia(article), 350);
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
