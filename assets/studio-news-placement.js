(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  let pendingPlacement = null;

  async function waitForClient(limit = 60) {
    for (let i = 0; i < limit; i++) {
      if (window.neuralCriticSupabase) return window.neuralCriticSupabase;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return null;
  }

  function sectionHeadings() {
    return $$('#sections-list .section-card [data-field="heading"]')
      .map(input => String(input.value || '').trim())
      .filter(Boolean);
  }

  function refreshPlacementOptions(preferred = null) {
    const select = $('#news-document-placement-heading');
    if (!select) return;
    const selected = preferred !== null ? String(preferred || '') : select.value;
    const headings = sectionHeadings();
    if (selected && !headings.includes(selected)) headings.push(selected);
    select.innerHTML = '<option value="">BEFORE FINAL VERDICT / ARTICLE END</option>' + headings
      .map(heading => `<option value="${heading.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}">AFTER: ${heading.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</option>`)
      .join('');
    select.value = selected;
  }

  function ensurePlacementUI() {
    if ($('#news-document-placement-controls')) return true;
    const documents = $('.studio-news-documents');
    const intro = $('.studio-news-document-intro', documents || document);
    if (!documents || !intro) return false;

    const controls = document.createElement('section');
    controls.id = 'news-document-placement-controls';
    controls.className = 'studio-news-document-placement';
    controls.innerHTML = `
      <div class="studio-news-document-placement-head">
        <div><small>ARTICLE INTEGRATION</small><h4>Primary-source section</h4></div>
        <span>READING MAP READY</span>
      </div>
      <p>Choose how the attached source material enters the story. The public article will render it as a normal editorial section instead of a detached utility block.</p>
      <div class="studio-news-placement-grid">
        <label>PUBLIC SECTION HEADING
          <input id="news-document-section-title" placeholder="Read the court filing">
        </label>
        <label>PLACE IN ARTICLE
          <select id="news-document-placement-heading"><option value="">BEFORE FINAL VERDICT / ARTICLE END</option></select>
        </label>
        <label class="span-2">SECTION INTRO · OPTIONAL
          <textarea id="news-document-section-description" rows="3" placeholder="Explain why this primary document matters before readers open it."></textarea>
        </label>
      </div>
      <small class="studio-news-placement-note">Section choices update from the Article Sections builder above. The section is automatically added to the public Reading Map.</small>
      <span class="studio-news-placement-status" data-news-placement-status></span>`;
    intro.insertAdjacentElement('afterend', controls);
    refreshPlacementOptions();
    return true;
  }

  function resetPlacement() {
    if ($('#news-document-section-title')) $('#news-document-section-title').value = '';
    if ($('#news-document-section-description')) $('#news-document-section-description').value = '';
    refreshPlacementOptions('');
    const status = $('[data-news-placement-status]');
    if (status) status.textContent = '';
  }

  async function loadPlacement(slug) {
    if (!slug || !ensurePlacementUI()) return;
    const client = await waitForClient();
    if (!client) return;
    try {
      const { data, error } = await client.from('articles').select('category,news_meta').eq('slug', slug).maybeSingle();
      if (error) throw error;
      const meta = data?.news_meta && typeof data.news_meta === 'object' ? data.news_meta : {};
      $('#news-document-section-title').value = meta.documentSectionTitle || '';
      $('#news-document-section-description').value = meta.documentSectionDescription || '';
      refreshPlacementOptions(meta.documentPlacementAfterHeading || '');
      const status = $('[data-news-placement-status]');
      if (status) status.textContent = meta.documentSectionTitle || meta.documentPlacementAfterHeading ? 'Primary-source placement loaded from Neural Critic.' : '';
      [300, 700, 1300].forEach(delay => setTimeout(() => refreshPlacementOptions(meta.documentPlacementAfterHeading || ''), delay));
    } catch (error) {
      const status = $('[data-news-placement-status]');
      if (status) status.textContent = error?.message || 'Could not load primary-source placement.';
    }
  }

  function snapshotPlacement() {
    const slug = $('#slug')?.value?.trim() || '';
    if (!slug || ($('#category')?.value || '').toUpperCase() !== 'NEWS') return null;
    return {
      slug,
      documentSectionTitle: $('#news-document-section-title')?.value?.trim() || '',
      documentSectionDescription: $('#news-document-section-description')?.value?.trim() || '',
      documentPlacementAfterHeading: $('#news-document-placement-heading')?.value?.trim() || ''
    };
  }

  async function persistPlacement(payload) {
    if (!payload) return;
    const client = await waitForClient();
    const status = $('[data-news-placement-status]');
    if (!client) {
      if (status) status.textContent = 'Primary-source placement could not connect to the CMS.';
      return;
    }
    try {
      const { data, error } = await client.from('articles').select('news_meta').eq('slug', payload.slug).maybeSingle();
      if (error) throw error;
      const meta = data?.news_meta && typeof data.news_meta === 'object' ? { ...data.news_meta } : {};
      meta.documentSectionTitle = payload.documentSectionTitle;
      meta.documentSectionDescription = payload.documentSectionDescription;
      meta.documentPlacementAfterHeading = payload.documentPlacementAfterHeading;
      const { error: updateError } = await client.from('articles').update({ news_meta: meta }).eq('slug', payload.slug);
      if (updateError) throw updateError;
      if (status) status.textContent = 'Primary-source section placement synced to Neural Critic.';
    } catch (error) {
      if (status) status.textContent = error?.message || 'Primary-source placement sync failed.';
    }
  }

  function wireSectionBuilder() {
    const list = $('#sections-list');
    if (!list) return;
    list.addEventListener('input', event => {
      if (event.target.matches('[data-field="heading"]')) refreshPlacementOptions();
    });
    const observer = new MutationObserver(() => refreshPlacementOptions());
    observer.observe(list, { childList: true, subtree: true });
  }

  function wireLibrary() {
    $('#story-library')?.addEventListener('click', event => {
      const edit = event.target.closest('[data-edit]');
      if (!edit) return;
      resetPlacement();
      setTimeout(() => loadPlacement(edit.dataset.edit), 650);
    });
  }

  function wireSaves() {
    ['#save-draft', '#schedule-story', '#publish-story'].forEach(selector => {
      $(selector)?.addEventListener('click', () => {
        pendingPlacement = snapshotPlacement();
        const status = $('[data-news-placement-status]');
        if (pendingPlacement && status) status.textContent = 'Primary-source placement waiting for article save…';
      });
    });

    const newsStatus = $('[data-news-status]');
    if (!newsStatus) return;
    const observer = new MutationObserver(() => {
      if (!pendingPlacement || !/metadata synced to Neural Critic/i.test(newsStatus.textContent || '')) return;
      const payload = pendingPlacement;
      pendingPlacement = null;
      persistPlacement(payload);
    });
    observer.observe(newsStatus, { childList: true, subtree: true, characterData: true });
  }

  function init() {
    if (!ensurePlacementUI()) {
      setTimeout(init, 120);
      return;
    }
    wireSectionBuilder();
    wireLibrary();
    wireSaves();
    refreshPlacementOptions();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
