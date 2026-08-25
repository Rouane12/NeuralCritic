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

  function fileSize(value) {
    const bytes = Number(value || 0);
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 102.4) / 10} KB`;
    return `${Math.round(bytes / 1024 / 102.4) / 10} MB`;
  }

  function downloadUrl(value, filename = 'source-document') {
    const url = safeUrl(value);
    if (!url) return '';
    try {
      const parsed = new URL(url);
      parsed.searchParams.set('download', filename || 'source-document');
      return parsed.href;
    } catch (_) {
      return url;
    }
  }

  function pdfEmbedUrl(value) {
    const url = safeUrl(value);
    if (!url) return '';
    try {
      const parsed = new URL(url);
      parsed.hash = 'view=FitH&toolbar=1&navpanes=0';
      return parsed.href;
    } catch (_) {
      return url;
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

  function renderUpdateSource(item) {
    const sourceName = String(item?.sourceName || '').trim();
    const sourceUrl = safeUrl(item?.sourceUrl || '');
    if (!sourceName && !sourceUrl) return '';
    const label = sourceName || 'View source';
    return `<div class="nc-news-update-source"><span>SOURCE</span>${sourceUrl ? `<a href="${sourceUrl}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>` : `<strong>${esc(label)}</strong>`}</div>`;
  }

  function renderUpdateLog(article, meta, context) {
    const updates = Array.isArray(meta?.updates)
      ? meta.updates.filter(item => item && String(item.note || '').trim() && item.at)
        .sort((a, b) => new Date(b.at) - new Date(a.at))
      : [];
    const existing = article.querySelector('.nc-news-update-log');
    if (existing) return existing;
    if (!updates.length) return null;

    const section = document.createElement('section');
    section.className = 'nc-news-update-log';
    section.innerHTML = `
      <header><div><small>DEVELOPING COVERAGE</small><h2>Update log</h2></div><span>${updates.length} ${updates.length === 1 ? 'UPDATE' : 'UPDATES'}</span></header>
      <div class="nc-news-update-items">
        ${updates.slice(0, 8).map((item, index) => `<article class="nc-news-update-entry${index === 0 ? ' is-latest' : ''}">
          <time datetime="${esc(item.at)}">${esc(updateTime(item.at))}</time>
          <div class="nc-news-update-copy"><p>${esc(item.note)}</p>${renderUpdateSource(item)}</div>
        </article>`).join('')}
      </div>`;
    context.insertAdjacentElement('afterend', section);
    return section;
  }

  function renderDocumentCard(doc) {
    const url = safeUrl(doc?.url || '');
    if (!url) return '';
    const title = String(doc.title || doc.fileName || 'Source document').trim();
    const sourceName = String(doc.sourceName || '').trim();
    const description = String(doc.description || '').trim();
    const mime = String(doc.mime || '').toLowerCase();
    const fileName = String(doc.fileName || title || 'source-document').trim();
    const isPdf = mime === 'application/pdf' || /\.pdf(?:$|[?#])/i.test(url);
    const size = fileSize(doc.size);
    const meta = [sourceName || 'PRIMARY SOURCE', isPdf ? 'PDF' : (mime ? mime.split('/').pop()?.toUpperCase() : 'FILE'), size].filter(Boolean).join(' · ');
    const download = downloadUrl(url, fileName);

    return `<article class="nc-news-source-document${isPdf ? ' is-pdf' : ''}">
      <header>
        <div><small>${esc(meta)}</small><h3>${esc(title)}</h3>${description ? `<p>${esc(description)}</p>` : ''}</div>
        <nav aria-label="Source document actions">
          <a href="${url}" target="_blank" rel="noopener noreferrer">OPEN ORIGINAL ↗</a>
          <a href="${download || url}" download="${esc(fileName)}">DOWNLOAD ${isPdf ? 'PDF' : 'FILE'} ↓</a>
        </nav>
      </header>
      ${isPdf ? `<div class="nc-news-pdf-viewer"><iframe src="${pdfEmbedUrl(url)}" title="${esc(title)}" loading="lazy"></iframe><div class="nc-news-pdf-fallback"><span>PDF SOURCE DOCUMENT</span><p>If the inline reader is unavailable on this device, open the original document instead.</p><a href="${url}" target="_blank" rel="noopener noreferrer">OPEN PDF ↗</a></div></div>` : `<div class="nc-news-file-preview"><b>${esc((mime.split('/').pop() || 'FILE').toUpperCase())}</b><div><span>SOURCE FILE</span><p>${esc(fileName)}</p></div><a href="${url}" target="_blank" rel="noopener noreferrer">OPEN ↗</a></div>`}
    </article>`;
  }

  function normalizeHeading(value = '') {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function documentSectionTitle(meta, documents) {
    const explicit = String(meta?.documentSectionTitle || '').trim();
    if (explicit) return explicit;
    const courtMaterial = documents.some(doc => /court|filing|subpoena/i.test(`${doc?.title || ''} ${doc?.sourceName || ''}`));
    return courtMaterial ? 'Read the court filing' : 'Read the primary source';
  }

  function documentSectionDescription(meta) {
    const explicit = String(meta?.documentSectionDescription || '').trim();
    if (explicit) return explicit;
    return 'The material below is part of the primary-source record behind this story. Open or download the original document for the full context.';
  }

  function placeDocumentSection(article, section, meta) {
    const body = article.querySelector('.article-body');
    if (!body || !section) return false;

    const preferredHeading = normalizeHeading(meta?.documentPlacementAfterHeading || '');
    if (preferredHeading) {
      const target = $$(':scope > section', body).find(candidate => {
        if (candidate === section) return false;
        return normalizeHeading(candidate.querySelector(':scope > h2')?.textContent) === preferredHeading;
      });
      if (target) {
        target.insertAdjacentElement('afterend', section);
        section.dataset.ncDocumentPlacement = 'after-heading';
        return true;
      }
    }

    const conclusion = body.querySelector(':scope > .article-conclusion');
    if (conclusion) conclusion.insertAdjacentElement('beforebegin', section);
    else body.appendChild(section);
    section.dataset.ncDocumentPlacement = 'before-conclusion';
    return true;
  }

  function syncDocumentReadingMap(article, section) {
    if (!article || !section) return;
    const title = section.querySelector(':scope > h2')?.textContent?.trim() || 'Primary source';
    const ensureLink = () => {
      const nav = article.querySelector('.work-toc nav');
      if (!nav) return false;
      let link = nav.querySelector('a[href="#source-documents"]');
      if (!link) {
        link = document.createElement('a');
        link.href = '#source-documents';
        link.dataset.ncSourceDocumentLink = '1';
        const links = $$('a[href^="#"]', nav);
        const conclusionLink = links.find(item => {
          const id = String(item.getAttribute('href') || '').replace(/^#/, '');
          return document.getElementById(id)?.classList.contains('article-conclusion');
        });
        if (conclusionLink) nav.insertBefore(link, conclusionLink);
        else nav.appendChild(link);
      }
      link.textContent = title;
      window.NeuralCriticReadingMapController?.sync?.();
      return true;
    };

    if (ensureLink()) return;
    [120, 350, 800, 1600, 2600].forEach(delay => setTimeout(ensureLink, delay));
  }

  function renderDocuments(article, meta) {
    const documents = Array.isArray(meta?.documents) ? meta.documents.filter(doc => doc && safeUrl(doc.url || '')) : [];
    let section = article.querySelector('.nc-news-source-library');
    if (!documents.length) return section || null;

    if (!section) {
      section = document.createElement('section');
      section.id = 'source-documents';
      section.className = 'nc-news-source-library nc-news-primary-section';
      section.innerHTML = `
        <span class="nc-news-primary-eyebrow">PRIMARY SOURCE · ${documents.length} ${documents.length === 1 ? 'DOCUMENT' : 'DOCUMENTS'}</span>
        <h2>${esc(documentSectionTitle(meta, documents))}</h2>
        <p class="nc-news-source-library-intro">${esc(documentSectionDescription(meta))}</p>
        <div class="nc-news-source-documents">${documents.map(renderDocumentCard).join('')}</div>`;
    }

    if (placeDocumentSection(article, section, meta)) syncDocumentReadingMap(article, section);
    return section;
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
        update_count: updateCount,
        source_document_count: Array.isArray(meta.documents) ? meta.documents.length : 0
      });
    }

    renderUpdateLog(article, meta, panel);
    renderDocuments(article, meta);
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
