(() => {
  'use strict';

  const $ = (s, root = document) => root.querySelector(s);
  const esc = (value='') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const KINDS = {
    breaking: {
      label: 'BREAKING',
      eyebrow: 'CONFIRMED · TIME-SENSITIVE',
      copy: 'A confirmed development important enough to interrupt the normal feed.'
    },
    update: {
      label: 'UPDATE',
      eyebrow: 'CONFIRMED · DEVELOPING STORY',
      copy: 'An official or substantive change to an existing game, release, patch, studio, or story.'
    },
    report: {
      label: 'REPORT',
      eyebrow: 'CREDIBLE · NOT FULLY CONFIRMED',
      copy: 'Credible reporting, rumors, leaks, or claims that still require explicit attribution and careful wording.'
    }
  };
  const DOCUMENT_TYPES = ['application/pdf','text/plain','text/csv','application/json'];
  const DOCUMENT_MAX_BYTES = 20 * 1024 * 1024;

  let pendingSave = null;
  let currentUpdates = [];
  let currentDocuments = [];

  function status(message, error = false) {
    const el = $('[data-news-status]');
    if (!el) return;
    el.textContent = message;
    el.classList.toggle('error', error);
  }

  function selectedKind() {
    return $('[name="news-kind"]:checked')?.value || '';
  }

  function updateTime(value) {
    try {
      return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
      }).format(new Date(value));
    } catch (_) {
      return String(value || '');
    }
  }

  function fileSize(value) {
    const bytes = Number(value || 0);
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 102.4) / 10} KB`;
    return `${Math.round(bytes / 1024 / 102.4) / 10} MB`;
  }

  function setKind(kind = '', fromLoad = false) {
    document.querySelectorAll('[name="news-kind"]').forEach(input => {
      input.checked = input.value === kind;
      input.closest('.studio-news-kind')?.classList.toggle('active', input.checked);
    });
    const developing = $('#news-developing');
    if (developing && !fromLoad && !developing.dataset.touched && (kind === 'breaking' || kind === 'update')) {
      developing.checked = true;
    }
    refreshGuidance();
  }

  function refreshGuidance() {
    const kind = selectedKind();
    const note = $('.studio-news-guidance');
    if (!note) return;
    if (!kind || !KINDS[kind]) {
      note.innerHTML = '<b>Choose the kind of news before publishing.</b><span>This controls the public label and the News Desk hierarchy.</span>';
      return;
    }
    const item = KINDS[kind];
    note.innerHTML = `<b>${item.eyebrow}</b><span>${item.copy}</span>${kind === 'report' ? '<em>Headline rule: use “reportedly”, “according to”, “alleged”, or another clear attribution when the claim is not confirmed.</em>' : ''}`;
  }

  function renderUpdates() {
    const host = $('#news-update-list');
    if (!host) return;
    if (!currentUpdates.length) {
      host.innerHTML = '<p>No timestamped updates yet. The story will publish normally until something changes.</p>';
      return;
    }
    host.innerHTML = currentUpdates
      .slice()
      .sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0))
      .map((item, index) => {
        const source = String(item.sourceName || '').trim();
        const sourceUrl = String(item.sourceUrl || '').trim();
        return `<div class="studio-news-update-item" data-update-id="${esc(item.id || item.at || index)}">
          <div><small>${updateTime(item.at)}</small><p>${esc(item.note || '')}</p>${source || sourceUrl ? `<div class="studio-news-update-source"><span>SOURCE</span>${sourceUrl ? `<a href="${esc(sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(source || 'Open source')} ↗</a>` : `<b>${esc(source)}</b>`}</div>` : ''}</div>
          <button type="button" data-remove-news-update="${esc(item.id || item.at || index)}">REMOVE</button>
        </div>`;
      }).join('');
  }

  function renderDocuments() {
    const host = $('#news-document-list');
    if (!host) return;
    if (!currentDocuments.length) {
      host.innerHTML = '<p>No source documents attached. Upload a filing, release, transcript, or other primary document when it materially helps readers.</p>';
      return;
    }
    host.innerHTML = currentDocuments.map((doc, index) => `
      <div class="studio-news-document-item" data-document-id="${esc(doc.id || index)}">
        <div class="studio-news-document-icon">${String(doc.mime || '').includes('pdf') ? 'PDF' : 'FILE'}</div>
        <div class="studio-news-document-copy">
          <small>${esc(doc.sourceName || 'SOURCE DOCUMENT')}${doc.size ? ` · ${esc(fileSize(doc.size))}` : ''}</small>
          <strong>${esc(doc.title || doc.fileName || 'Source document')}</strong>
          ${doc.description ? `<p>${esc(doc.description)}</p>` : ''}
          <a href="${esc(doc.url || '')}" target="_blank" rel="noopener noreferrer">OPEN FILE ↗</a>
        </div>
        <button type="button" data-remove-news-document="${esc(doc.id || index)}">REMOVE</button>
      </div>`).join('');
  }

  async function uploadSourceDocument(file) {
    const media = window.NeuralCriticStudioMedia;
    if (!media?.uploadAsset) throw new Error('Studio media uploader is not ready yet.');
    const title = $('#news-document-title')?.value?.trim() || file.name.replace(/\.[^.]+$/, '');
    const description = $('#news-document-description')?.value?.trim() || '';
    const sourceName = $('#news-document-source')?.value?.trim() || '';
    const button = $('#news-document-upload');
    const uploadStatus = $('#news-document-upload-status');
    if (button) button.disabled = true;
    try {
      const result = await media.uploadAsset(file, {
        allowedTypes: DOCUMENT_TYPES,
        maxBytes: DOCUMENT_MAX_BYTES,
        label: 'Source document',
        pathPrefix: 'documents',
        onStatus: (message, state) => {
          if (!uploadStatus) return;
          uploadStatus.textContent = message;
          uploadStatus.dataset.state = state;
        },
      });
      currentDocuments.push({
        id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        title,
        description,
        sourceName,
        url: result.url,
        path: result.path || '',
        fileName: result.fileName || file.name,
        mime: file.type,
        size: file.size,
        uploadedAt: new Date().toISOString(),
      });
      if ($('#news-document-title')) $('#news-document-title').value = '';
      if ($('#news-document-description')) $('#news-document-description').value = '';
      if ($('#news-document-source')) $('#news-document-source').value = '';
      renderDocuments();
      status('Source document attached. Save or publish the article to sync it.');
      media.toast?.('Source document uploaded to Neural Critic storage.');
    } finally {
      if (button) button.disabled = false;
    }
  }

  function buildPanel() {
    if ($('#studio-news-panel')) return;
    const reviewPanel = $('#review-fields');
    const anchor = reviewPanel || $('.studio-fields');
    if (!anchor) return;

    const panel = document.createElement('section');
    panel.id = 'studio-news-panel';
    panel.className = 'studio-panel studio-news-panel';
    panel.hidden = true;
    panel.innerHTML = `
      <div class="builder-head studio-news-head">
        <div>
          <small>NEWS DESK · STRUCTURED REPORTING</small>
          <h2>News classification</h2>
          <p>Tell readers what is confirmed, what changed, and where the information came from.</p>
        </div>
        <span class="studio-news-badge">TRUST LAYER</span>
      </div>
      <div class="studio-news-kinds" role="radiogroup" aria-label="News classification">
        ${Object.entries(KINDS).map(([key, value]) => `<label class="studio-news-kind" data-kind="${key}"><input type="radio" name="news-kind" value="${key}"><span><b>${value.label}</b><small>${value.eyebrow}</small><em>${value.copy}</em></span></label>`).join('')}
      </div>
      <div class="studio-news-source-grid">
        <label>SOURCE / ORIGIN<input id="news-source-name" placeholder="Rockstar Games, Nintendo, Bloomberg…"></label>
        <label>SOURCE URL · OPTIONAL<input id="news-source-url" type="url" placeholder="https://…"></label>
      </div>
      <div class="studio-news-guidance" aria-live="polite"></div>
      <div class="studio-news-developing">
        <label><input id="news-developing" type="checkbox"><span><b>DEVELOPING STORY</b><small>Keep this on while material facts may still change. Turn it off when the story is settled.</small></span></label>
      </div>
      <div class="studio-news-update-builder">
        <div class="studio-news-update-head"><div><small>DEVELOPING COVERAGE</small><h3>Update log</h3></div><span>CANONICAL STORY HISTORY</span></div>
        <label>LATEST UPDATE NOTE<textarea id="news-update-note" rows="3" placeholder="What changed? Keep this concise and factual."></textarea></label>
        <div class="studio-news-update-source-grid">
          <label>UPDATE SOURCE · OPTIONAL<input id="news-update-source-name" placeholder="Court filing, Discord, Rockstar Games…"></label>
          <label>UPDATE SOURCE URL · OPTIONAL<input id="news-update-source-url" type="url" placeholder="https://…"></label>
        </div>
        <div class="studio-news-update-actions"><p>Updates are timestamped when added and can carry their own source link.</p><button id="news-add-update" type="button">ADD TIMESTAMPED UPDATE +</button></div>
        <div id="news-update-list" class="studio-news-update-list"></div>
      </div>
      <div class="studio-news-documents">
        <div class="studio-news-update-head"><div><small>SOURCE LIBRARY</small><h3>Primary documents</h3></div><span>PDF / SOURCE FILES</span></div>
        <p class="studio-news-document-intro">Attach filings, press releases, transcripts, datasets, or other primary material when the source itself adds useful context. PDFs appear in an inline reader on the published story.</p>
        <div class="studio-news-document-fields">
          <label>DOCUMENT TITLE<input id="news-document-title" placeholder="Take-Two DMCA subpoena to Discord"></label>
          <label>SOURCE / ISSUER · OPTIONAL<input id="news-document-source" placeholder="U.S. District Court, Rockstar Games…"></label>
          <label class="span-2">DOCUMENT CONTEXT · OPTIONAL<input id="news-document-description" placeholder="What this document establishes and why it matters."></label>
        </div>
        <div class="studio-news-document-upload-row">
          <input id="news-document-file" type="file" accept="application/pdf,text/plain,text/csv,application/json" hidden>
          <button id="news-document-upload" type="button">UPLOAD SOURCE DOCUMENT +</button>
          <span id="news-document-upload-status">PDF, TXT, CSV OR JSON · 20 MB MAX</span>
        </div>
        <div id="news-document-list" class="studio-news-document-list"></div>
      </div>
      <div class="studio-news-foot"><span data-news-status>News metadata is saved with the article.</span></div>`;

    anchor.insertAdjacentElement('afterend', panel);
    panel.addEventListener('change', event => {
      if (event.target.matches('[name="news-kind"]')) setKind(event.target.value);
      if (event.target.matches('#news-developing')) event.target.dataset.touched = '1';
    });

    $('#news-add-update')?.addEventListener('click', () => {
      const note = $('#news-update-note')?.value?.trim() || '';
      if (!note) {
        status('Write a concise update note before adding it to the timeline.', true);
        return;
      }
      const at = new Date().toISOString();
      const sourceName = $('#news-update-source-name')?.value?.trim() || '';
      const sourceUrl = $('#news-update-source-url')?.value?.trim() || '';
      currentUpdates.push({ id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`, at, note, sourceName, sourceUrl });
      $('#news-update-note').value = '';
      if ($('#news-update-source-name')) $('#news-update-source-name').value = '';
      if ($('#news-update-source-url')) $('#news-update-source-url').value = '';
      const developing = $('#news-developing');
      if (developing) developing.checked = true;
      renderUpdates();
      status('Timestamped update added. Save or publish the article to sync it.');
    });

    $('#news-update-list')?.addEventListener('click', event => {
      const button = event.target.closest('[data-remove-news-update]');
      if (!button) return;
      const id = button.dataset.removeNewsUpdate;
      currentUpdates = currentUpdates.filter((item, index) => String(item.id || item.at || index) !== id);
      renderUpdates();
      status('Update removed locally. Save the article to sync the change.');
    });

    $('#news-document-upload')?.addEventListener('click', () => $('#news-document-file')?.click());
    $('#news-document-file')?.addEventListener('change', async event => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        await uploadSourceDocument(file);
      } catch (error) {
        const uploadStatus = $('#news-document-upload-status');
        if (uploadStatus) {
          uploadStatus.textContent = 'UPLOAD FAILED';
          uploadStatus.dataset.state = 'error';
        }
        window.NeuralCriticStudioMedia?.toast?.(error?.message || 'Source document upload failed.', true);
        status(error?.message || 'Source document upload failed.', true);
      } finally {
        event.target.value = '';
      }
    });

    $('#news-document-list')?.addEventListener('click', event => {
      const button = event.target.closest('[data-remove-news-document]');
      if (!button) return;
      const id = button.dataset.removeNewsDocument;
      currentDocuments = currentDocuments.filter((item, index) => String(item.id || index) !== id);
      renderDocuments();
      status('Document removed from this story. Save the article to sync the change.');
    });

    renderUpdates();
    renderDocuments();
  }

  function buildCategoryCue() {
    if ($('#studio-news-cue')) return;
    const category = $('#category');
    const label = category?.closest('label');
    if (!category || !label) return;
    const cue = document.createElement('button');
    cue.id = 'studio-news-cue';
    cue.className = 'studio-news-cue';
    cue.type = 'button';
    cue.hidden = true;
    cue.innerHTML = '<span>NEWS DESK ACTIVE</span><b>OPEN SETTINGS ↓</b>';
    cue.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      const panel = $('#studio-news-panel');
      if (!panel) return;
      panel.hidden = false;
      panel.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      panel.classList.remove('studio-news-attention');
      requestAnimationFrame(() => panel.classList.add('studio-news-attention'));
      setTimeout(() => panel.classList.remove('studio-news-attention'), 900);
    });
    label.appendChild(cue);
  }

  function togglePanel() {
    const panel = $('#studio-news-panel');
    if (!panel) return;
    const isNews = ($('#category')?.value || '').toUpperCase() === 'NEWS';
    panel.hidden = !isNews;
    document.body.classList.toggle('studio-editing-news', isNews);
    const cue = $('#studio-news-cue');
    if (cue) cue.hidden = !isNews;
    if (isNews && !selectedKind()) refreshGuidance();
  }

  async function waitForClient(limit = 60) {
    for (let i = 0; i < limit; i++) {
      if (window.neuralCriticSupabase) return window.neuralCriticSupabase;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return null;
  }

  async function loadNewsMeta(slug) {
    if (!slug) return;
    const client = await waitForClient();
    if (!client) {
      status('News metadata could not connect to the CMS.', true);
      return;
    }
    try {
      const { data, error } = await client.from('articles').select('category,news_meta').eq('slug', slug).maybeSingle();
      if (error) throw error;
      const meta = data?.news_meta && typeof data.news_meta === 'object' ? data.news_meta : {};
      currentUpdates = Array.isArray(meta.updates) ? meta.updates.filter(item => item && item.note) : [];
      currentDocuments = Array.isArray(meta.documents) ? meta.documents.filter(item => item && item.url) : [];
      setKind(meta.kind || '', true);
      if ($('#news-source-name')) $('#news-source-name').value = meta.sourceName || '';
      if ($('#news-source-url')) $('#news-source-url').value = meta.sourceUrl || '';
      if ($('#news-developing')) {
        $('#news-developing').checked = typeof meta.developing === 'boolean' ? meta.developing : (meta.kind === 'breaking' || meta.kind === 'update');
        $('#news-developing').dataset.touched = '1';
      }
      renderUpdates();
      renderDocuments();
      togglePanel();
      $('#category')?.dispatchEvent(new Event('change', { bubbles: true }));
      status(data?.category === 'NEWS' && meta.kind ? `${KINDS[meta.kind]?.label || 'News'} metadata loaded from Neural Critic.` : 'This story has no structured news metadata yet.');
    } catch (error) {
      status(error?.message || 'Could not load news metadata.', true);
    }
  }

  function snapshot() {
    const slug = $('#slug')?.value?.trim() || '';
    if (!slug) return null;
    const isNews = ($('#category')?.value || '').toUpperCase() === 'NEWS';
    if (!isNews) return { slug, meta: {} };
    const kind = selectedKind();
    return {
      slug,
      meta: kind ? {
        kind,
        verification: kind === 'report' ? 'reported' : 'confirmed',
        sourceName: $('#news-source-name')?.value?.trim() || '',
        sourceUrl: $('#news-source-url')?.value?.trim() || '',
        developing: Boolean($('#news-developing')?.checked),
        updates: currentUpdates.map(item => ({
          id: item.id || '',
          at: item.at || new Date().toISOString(),
          note: String(item.note || '').trim(),
          sourceName: String(item.sourceName || '').trim(),
          sourceUrl: String(item.sourceUrl || '').trim(),
        })).filter(item => item.note),
        documents: currentDocuments.map(doc => ({
          id: doc.id || '',
          title: String(doc.title || '').trim(),
          description: String(doc.description || '').trim(),
          sourceName: String(doc.sourceName || '').trim(),
          url: String(doc.url || '').trim(),
          path: String(doc.path || '').trim(),
          fileName: String(doc.fileName || '').trim(),
          mime: String(doc.mime || '').trim(),
          size: Number(doc.size || 0),
          uploadedAt: doc.uploadedAt || '',
        })).filter(doc => doc.url)
      } : {}
    };
  }

  function validateForPublish() {
    if (($('#category')?.value || '').toUpperCase() !== 'NEWS') return '';
    const kind = selectedKind();
    const source = $('#news-source-name')?.value?.trim() || '';
    if (!kind) return 'Choose BREAKING, UPDATE, or REPORT before publishing news.';
    if (!source) return 'Published news needs a source / origin so readers know where the information came from.';
    return '';
  }

  async function persist(payload, attempts = 6) {
    const client = await waitForClient();
    if (!client) {
      status('News metadata could not sync to the CMS.', true);
      return;
    }
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        const { data, error } = await client.from('articles').update({ news_meta: payload.meta }).eq('slug', payload.slug).select('slug');
        if (error) throw error;
        if (Array.isArray(data) && data.length) {
          status(payload.meta.kind ? `${KINDS[payload.meta.kind]?.label || 'News'} metadata synced to Neural Critic.` : 'News metadata cleared from this story.');
          return;
        }
      } catch (error) {
        if (attempt === attempts - 1) {
          status(error?.message || 'News metadata sync failed.', true);
          return;
        }
      }
      await new Promise(resolve => setTimeout(resolve, 350));
    }
    status('News metadata sync could not find the article row.', true);
  }

  function resetNewsFields() {
    currentUpdates = [];
    currentDocuments = [];
    setKind('', true);
    if ($('#news-source-name')) $('#news-source-name').value = '';
    if ($('#news-source-url')) $('#news-source-url').value = '';
    if ($('#news-developing')) {
      $('#news-developing').checked = false;
      delete $('#news-developing').dataset.touched;
    }
    ['#news-update-note','#news-update-source-name','#news-update-source-url','#news-document-title','#news-document-source','#news-document-description'].forEach(selector => {
      const input = $(selector); if (input) input.value = '';
    });
    renderUpdates();
    renderDocuments();
  }

  function wireCategory() {
    $('#category')?.addEventListener('change', togglePanel);
    $('#category')?.addEventListener('input', togglePanel);
  }

  function wireLibrary() {
    $('#story-library')?.addEventListener('click', event => {
      const edit = event.target.closest('[data-edit]');
      if (!edit) return;
      resetNewsFields();
      setTimeout(() => loadNewsMeta(edit.dataset.edit), 650);
    });
  }

  function wireSaves() {
    ['#schedule-story', '#publish-story'].forEach(selector => {
      $(selector)?.addEventListener('click', event => {
        const error = validateForPublish();
        if (!error) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        status(error, true);
        const auth = $('#studio-auth-status');
        if (auth) {
          auth.textContent = error;
          auth.className = 'studio-auth-status error';
        }
      }, true);
    });

    ['#save-draft', '#schedule-story', '#publish-story'].forEach(selector => {
      $(selector)?.addEventListener('click', () => {
        pendingSave = snapshot();
        if (pendingSave) status('News metadata waiting for the article save…');
      });
    });

    const auth = $('#studio-auth-status');
    if (!auth) return;
    const observer = new MutationObserver(() => {
      if (!pendingSave || !auth.classList.contains('success') || !/database/i.test(auth.textContent || '')) return;
      const payload = pendingSave;
      pendingSave = null;
      persist(payload);
    });
    observer.observe(auth, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }

  function init() {
    buildPanel();
    buildCategoryCue();
    wireCategory();
    wireLibrary();
    wireSaves();
    togglePanel();
    refreshGuidance();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
