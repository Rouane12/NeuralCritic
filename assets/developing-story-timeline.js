(() => {
  'use strict';

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const esc = (value = '') => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

  const slugFromPage = () => window.NEURAL_CRITIC_STATIC_SLUG || new URLSearchParams(location.search).get('slug') || '';

  function safeUrl(value) {
    try {
      const url = new URL(value, location.href);
      return /^https?:$/.test(url.protocol) ? url.href : '';
    } catch (_) {
      return '';
    }
  }

  function fmtTime(value) {
    try {
      return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
      }).format(new Date(value)).toUpperCase();
    } catch (_) {
      return String(value || '').toUpperCase();
    }
  }

  function ensureStyles() {
    if (document.querySelector('style[data-nc-developing-timeline]')) return;
    const style = document.createElement('style');
    style.dataset.ncDevelopingTimeline = '1';
    style.textContent = `
      .nc-developing-summary{margin:0 0 18px;padding:16px 17px;border:1px solid rgba(34,199,232,.2);border-radius:14px;background:linear-gradient(125deg,rgba(34,199,232,.075),rgba(109,99,255,.055));box-shadow:0 10px 28px rgba(18,29,48,.04)}
      .nc-developing-summary>small{display:block;margin-bottom:7px;color:#19aeca;font:900 7px/1 Inter,system-ui,sans-serif;letter-spacing:.14em}.nc-developing-summary time{display:block;margin-bottom:8px;color:#7167ea;font:850 7px/1.2 Inter,system-ui,sans-serif;letter-spacing:.075em}.nc-developing-summary p{margin:0;color:#3f4d60;font:600 12px/1.55 Inter,system-ui,sans-serif;letter-spacing:-.01em}.nc-developing-summary a{display:inline-flex;margin-top:10px;color:#6570ef;font:850 7px/1 Inter,system-ui,sans-serif;letter-spacing:.05em;text-decoration:none}.nc-developing-summary a:hover{text-decoration:underline;text-underline-offset:3px}
      .nc-news-update-log[data-nc-timeline-ready="1"]{scroll-margin-top:120px}.nc-news-update-log[data-nc-timeline-ready="1"]>header h2{font-size:21px}.nc-news-update-log[data-nc-timeline-ready="1"]>header small{color:#19aeca}.nc-news-update-entry[hidden]{display:none!important}
      .nc-news-update-toggle{display:flex;justify-content:center;padding:13px 0 1px}.nc-news-update-toggle button{min-height:34px;padding:0 13px;border:1px solid rgba(109,99,255,.22);border-radius:999px;background:rgba(109,99,255,.055);color:#625fe5;font:850 7px/1 Inter,system-ui,sans-serif;letter-spacing:.075em;cursor:pointer}.nc-news-update-toggle button:hover,.nc-news-update-toggle button:focus-visible{border-color:rgba(34,199,232,.38);background:rgba(34,199,232,.07);color:#169fbc;outline:none}
      html[data-theme="dark"] .nc-developing-summary{border-color:rgba(34,199,232,.25);background:linear-gradient(125deg,rgba(34,199,232,.08),rgba(109,99,255,.085));box-shadow:0 14px 34px rgba(0,0,0,.13)}html[data-theme="dark"] .nc-developing-summary p{color:#c1cad9}html[data-theme="dark"] .nc-developing-summary a{color:#918aff}html[data-theme="dark"] .nc-news-update-toggle button{border-color:rgba(126,118,255,.28);background:rgba(126,118,255,.08);color:#9a93ff}
      @media(max-width:720px){.nc-developing-summary{padding:14px 15px}.nc-developing-summary p{font-size:11px}.nc-news-update-toggle button{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function sourceMarkup(item) {
    const name = String(item?.sourceName || '').trim();
    const url = safeUrl(item?.sourceUrl || '');
    if (!url) return '';
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${esc(name || 'VIEW SOURCE')} ↗</a>`;
  }

  function entryMarkup(item, index) {
    return `<article class="nc-news-update-entry${index === 0 ? ' is-latest' : ''}" data-nc-update-index="${index}">
      <time datetime="${esc(item.at)}">${esc(fmtTime(item.at))}</time>
      <div class="nc-news-update-copy"><p>${esc(item.note)}</p>${item.sourceName || item.sourceUrl ? `<div class="nc-news-update-source"><span>SOURCE</span>${sourceMarkup(item) || `<strong>${esc(item.sourceName || 'Source')}</strong>`}</div>` : ''}</div>
    </article>`;
  }

  function syncReadingMap(section) {
    const ensure = () => {
      const nav = document.querySelector('#article .work-toc nav');
      if (!nav || !section) return false;
      let link = nav.querySelector('a[href="#update-timeline"]');
      if (!link) {
        link = document.createElement('a');
        link.href = '#update-timeline';
        link.dataset.ncUpdateTimelineLink = '1';
        const first = nav.querySelector('a[href^="#"]');
        if (first) nav.insertBefore(link, first);
        else nav.appendChild(link);
      }
      link.textContent = 'Latest updates';
      window.NeuralCriticReadingMapController?.sync?.();
      return true;
    };
    if (ensure()) return;
    [180, 500, 1000, 1800].forEach(delay => setTimeout(ensure, delay));
  }

  function renderTimeline(meta) {
    const article = $('#article');
    if (!article || !article.classList.contains('nc-news-article')) return false;
    const updates = Array.isArray(meta?.updates)
      ? meta.updates.filter(item => item && item.at && String(item.note || '').trim()).sort((a,b) => new Date(b.at) - new Date(a.at))
      : [];
    if (!updates.length) return false;

    const existing = article.querySelector('.nc-news-update-log');
    const context = article.querySelector('.nc-news-context');
    if (!context) return false;

    const section = existing || document.createElement('section');
    section.id = 'update-timeline';
    section.className = 'nc-news-update-log';
    section.dataset.ncTimelineReady = '1';

    const latest = updates[0];
    const initialVisible = Math.min(4, updates.length);
    section.innerHTML = `
      <header><div><small>DEVELOPING COVERAGE</small><h2>Latest updates</h2></div><span>${updates.length} ${updates.length === 1 ? 'UPDATE' : 'UPDATES'}</span></header>
      <div class="nc-developing-summary">
        <small>WHAT CHANGED MOST RECENTLY</small>
        <time datetime="${esc(latest.at)}">UPDATED ${esc(fmtTime(latest.at))}</time>
        <p>${esc(latest.note)}</p>
        ${sourceMarkup(latest)}
      </div>
      <div class="nc-news-update-items">
        ${updates.map(entryMarkup).join('')}
      </div>
      ${updates.length > initialVisible ? `<div class="nc-news-update-toggle"><button type="button" aria-expanded="false">SHOW ${updates.length - initialVisible} EARLIER ${updates.length - initialVisible === 1 ? 'UPDATE' : 'UPDATES'} ↓</button></div>` : ''}`;

    if (!existing) context.insertAdjacentElement('afterend', section);

    const entries = $$('.nc-news-update-entry', section);
    const button = $('.nc-news-update-toggle button', section);
    if (button) {
      const collapse = () => entries.forEach((entry, index) => { entry.hidden = index >= initialVisible; });
      collapse();
      button.addEventListener('click', () => {
        const expanded = button.getAttribute('aria-expanded') === 'true';
        button.setAttribute('aria-expanded', String(!expanded));
        entries.forEach((entry, index) => { entry.hidden = expanded ? index >= initialVisible : false; });
        button.textContent = expanded
          ? `SHOW ${updates.length - initialVisible} EARLIER ${updates.length - initialVisible === 1 ? 'UPDATE' : 'UPDATES'} ↓`
          : 'SHOW FEWER UPDATES ↑';
        if (expanded) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        window.gtag?.('event', 'developing_timeline_toggle', { expanded: expanded ? 'no' : 'yes', update_count: updates.length });
      });
    }

    syncReadingMap(section);
    return true;
  }

  async function waitForClient(limit = 70) {
    for (let i = 0; i < limit; i++) {
      const client = window.neuralCriticPublicSupabase || window.neuralCriticSupabase;
      if (client) return client;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return null;
  }

  async function init() {
    const slug = slugFromPage();
    if (!slug) return;
    ensureStyles();
    const client = await waitForClient();
    if (!client) return;
    try {
      const { data, error } = await client.from('articles').select('category,news_meta').eq('slug', slug).eq('status', 'published').maybeSingle();
      if (error || !data || String(data.category || '').toUpperCase() !== 'NEWS') return;
      const meta = data.news_meta && typeof data.news_meta === 'object' ? data.news_meta : {};
      if (!Boolean(meta.developing) || !Array.isArray(meta.updates) || !meta.updates.length) return;
      for (let i = 0; i < 50; i++) {
        if (renderTimeline(meta)) break;
        await new Promise(resolve => setTimeout(resolve, 120));
      }
    } catch (error) {
      console.warn('Neural Critic developing timeline unavailable.', error);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
