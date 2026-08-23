(() => {
  'use strict';

  const $ = (s, root = document) => root.querySelector(s);
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
  let pendingSave = null;

  function status(message, error = false) {
    const el = $('[data-news-status]');
    if (!el) return;
    el.textContent = message;
    el.classList.toggle('error', error);
  }

  function selectedKind() {
    return $('[name="news-kind"]:checked')?.value || '';
  }

  function setKind(kind = '') {
    document.querySelectorAll('[name="news-kind"]').forEach(input => {
      input.checked = input.value === kind;
      input.closest('.studio-news-kind')?.classList.toggle('active', input.checked);
    });
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
      <div class="studio-news-foot"><span data-news-status>News metadata is saved with the article.</span></div>`;

    anchor.insertAdjacentElement('afterend', panel);
    panel.addEventListener('change', event => {
      if (event.target.matches('[name="news-kind"]')) setKind(event.target.value);
    });
  }

  function togglePanel() {
    const panel = $('#studio-news-panel');
    if (!panel) return;
    const isNews = ($('#category')?.value || '').toUpperCase() === 'NEWS';
    panel.hidden = !isNews;
    document.body.classList.toggle('studio-editing-news', isNews);
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
      setKind(meta.kind || '');
      if ($('#news-source-name')) $('#news-source-name').value = meta.sourceName || '';
      if ($('#news-source-url')) $('#news-source-url').value = meta.sourceUrl || '';
      togglePanel();
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
        sourceUrl: $('#news-source-url')?.value?.trim() || ''
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

  function wireCategory() {
    $('#category')?.addEventListener('change', togglePanel);
  }

  function wireLibrary() {
    $('#story-library')?.addEventListener('click', event => {
      const edit = event.target.closest('[data-edit]');
      if (!edit) return;
      setKind('');
      if ($('#news-source-name')) $('#news-source-name').value = '';
      if ($('#news-source-url')) $('#news-source-url').value = '';
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
    wireCategory();
    wireLibrary();
    wireSaves();
    togglePanel();
    refreshGuidance();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();