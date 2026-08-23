(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  let loadedSlug = '';
  let savedSignature = '';
  let client = null;

  const defaults = Object.freeze({
    editorial: '',
    affiliate: 'This article contains affiliate links. Neural Critic may earn a commission from qualifying purchases, at no additional cost to the reader.',
    sponsored: 'This article is sponsored commercial content. The commercial relationship is disclosed to readers at the top of the story.'
  });

  function signature(meta) {
    return JSON.stringify({
      kind: meta.kind || 'editorial',
      sponsor_name: meta.sponsor_name || '',
      disclosure: meta.disclosure || '',
      affiliate_links: !!meta.affiliate_links
    });
  }

  function status(message, error = false) {
    const el = $('#commercial-meta-status');
    if (!el) return;
    el.textContent = message;
    el.classList.toggle('error', error);
  }

  function installStyles() {
    if ($('#studio-commercial-style')) return;
    const style = document.createElement('style');
    style.id = 'studio-commercial-style';
    style.textContent = `
      .studio-commercial-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.studio-commercial-grid .span-2{grid-column:1/-1}.studio-commercial-note{margin:0;color:#8190a8;font:500 10px/1.55 Inter,system-ui,sans-serif}.studio-commercial-actions{display:flex;align-items:center;gap:12px;margin-top:13px}.studio-commercial-actions button{min-height:38px;border:1px solid rgba(80,226,246,.34);border-radius:10px;background:linear-gradient(90deg,rgba(80,226,246,.08),rgba(122,108,255,.08));color:#55dff5;padding:0 14px;font:800 8px/1 Inter,system-ui,sans-serif;letter-spacing:.09em;cursor:pointer}.studio-commercial-status{color:#7d8ba1;font:700 8px/1.35 Inter,system-ui,sans-serif}.studio-commercial-status.error{color:#ff718c}.studio-commercial-sponsor[hidden]{display:none}.studio-commercial-badge{display:inline-flex;margin-left:8px;padding:4px 7px;border:1px solid rgba(80,226,246,.22);border-radius:999px;color:#55dff5;font:800 6.5px/1 Inter,system-ui,sans-serif;letter-spacing:.08em}@media(max-width:700px){.studio-commercial-grid{grid-template-columns:1fr}.studio-commercial-grid .span-2{grid-column:auto}}
    `;
    document.head.appendChild(style);
  }

  function installPanel() {
    if ($('#studio-commercial-panel')) return;
    const actions = $('.studio-actions');
    if (!actions) return;
    const panel = document.createElement('section');
    panel.id = 'studio-commercial-panel';
    panel.className = 'studio-panel';
    panel.innerHTML = `
      <span class="panel-label">COMMERCIAL STATUS <i class="studio-commercial-badge">PUBLIC DISCLOSURE</i></span>
      <div class="studio-commercial-grid">
        <label>STORY RELATIONSHIP<select id="commercial-kind"><option value="editorial">INDEPENDENT EDITORIAL</option><option value="affiliate">AFFILIATE-SUPPORTED</option><option value="sponsored">SPONSORED / PAID PARTNERSHIP</option></select></label>
        <label class="studio-commercial-sponsor" id="commercial-sponsor-wrap" hidden>SPONSOR NAME<input id="commercial-sponsor" placeholder="Company or partner name"></label>
        <label class="span-2">DISCLOSURE SHOWN TO READERS<textarea id="commercial-disclosure" rows="3" placeholder="No commercial disclosure is shown for independent editorial."></textarea></label>
      </div>
      <p class="studio-commercial-note">Commercial status is public story metadata. Sponsored and affiliate-supported stories cannot be published from Studio until this disclosure has been explicitly saved.</p>
      <div class="studio-commercial-actions"><button type="button" id="save-commercial-meta">SAVE COMMERCIAL STATUS</button><span class="studio-commercial-status" id="commercial-meta-status">Independent editorial by default.</span></div>`;
    actions.before(panel);
    $('#commercial-kind')?.addEventListener('change', () => {
      syncKindUI(true);
      savedSignature = '';
    });
    $('#commercial-sponsor')?.addEventListener('input', () => { savedSignature = ''; });
    $('#commercial-disclosure')?.addEventListener('input', () => { savedSignature = ''; });
    $('#save-commercial-meta')?.addEventListener('click', saveCommercialMeta);
  }

  function syncKindUI(useDefault = false) {
    const kind = $('#commercial-kind')?.value || 'editorial';
    const sponsorWrap = $('#commercial-sponsor-wrap');
    if (sponsorWrap) sponsorWrap.hidden = kind !== 'sponsored';
    const disclosure = $('#commercial-disclosure');
    if (disclosure && useDefault) disclosure.value = defaults[kind] || '';
  }

  function readForm() {
    const kind = $('#commercial-kind')?.value || 'editorial';
    const sponsorName = ($('#commercial-sponsor')?.value || '').trim();
    const disclosure = ($('#commercial-disclosure')?.value || '').trim();
    if (kind === 'sponsored' && !sponsorName) throw new Error('Add the sponsor name before saving sponsored content.');
    if (kind !== 'editorial' && !disclosure) throw new Error('Add a reader-facing commercial disclosure before saving.');
    return {
      kind,
      sponsor_name: kind === 'sponsored' ? sponsorName : '',
      disclosure: kind === 'editorial' ? '' : disclosure,
      affiliate_links: kind === 'affiliate',
      updated_at: new Date().toISOString()
    };
  }

  function applyMeta(meta = {}) {
    const kind = ['editorial','affiliate','sponsored'].includes(meta.kind) ? meta.kind : 'editorial';
    $('#commercial-kind').value = kind;
    $('#commercial-sponsor').value = meta.sponsor_name || '';
    $('#commercial-disclosure').value = meta.disclosure || defaults[kind] || '';
    syncKindUI(false);
    savedSignature = signature({
      kind,
      sponsor_name: meta.sponsor_name || '',
      disclosure: meta.disclosure || defaults[kind] || '',
      affiliate_links: kind === 'affiliate'
    });
  }

  async function loadCommercialMeta(slug) {
    if (!client || !slug) {
      loadedSlug = '';
      applyMeta({kind:'editorial'});
      status('Independent editorial by default.');
      return;
    }
    status('Loading commercial status…');
    const {data, error} = await client.from('articles').select('commercial_meta').eq('slug', slug).maybeSingle();
    if (error) {
      status(error.message || 'Could not load commercial status.', true);
      return;
    }
    if (!data) {
      loadedSlug = '';
      applyMeta({kind:'editorial'});
      status('Save the story as a draft before saving commercial status.');
      return;
    }
    loadedSlug = slug;
    applyMeta(data.commercial_meta || {kind:'editorial'});
    status((data.commercial_meta?.kind || 'editorial') === 'editorial' ? 'Independent editorial.' : 'Commercial disclosure is saved.');
  }

  async function saveCommercialMeta() {
    const slug = ($('#slug')?.value || '').trim();
    if (!slug) { status('Set the story URL slug first.', true); return; }
    let meta;
    try { meta = readForm(); }
    catch (error) { status(error.message, true); return; }
    status('Saving commercial status…');
    const {data, error} = await client.from('articles').update({commercial_meta: meta}).eq('slug', slug).select('slug,commercial_meta').maybeSingle();
    if (error) { status(error.message || 'Commercial status save failed.', true); return; }
    if (!data) { status('Save the story as a draft first, then save commercial status.', true); return; }
    loadedSlug = slug;
    savedSignature = signature(meta);
    status(meta.kind === 'editorial' ? 'Saved as independent editorial.' : 'Commercial disclosure saved and publish-safe.');
  }

  function publishGuard(event) {
    const publish = event.target.closest?.('#publish-story');
    if (!publish) return;
    let meta;
    try { meta = readForm(); }
    catch (error) {
      event.preventDefault();
      event.stopImmediatePropagation();
      status(error.message, true);
      return;
    }
    if (meta.kind === 'editorial') return;
    const slug = ($('#slug')?.value || '').trim();
    if (!slug || loadedSlug !== slug || savedSignature !== signature(meta)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      status('Save the commercial status before publishing this story.', true);
    }
  }

  function wireStoryChanges() {
    $('#story-library')?.addEventListener('click', event => {
      const edit = event.target.closest('[data-edit]');
      if (!edit) return;
      const slug = edit.dataset.edit || '';
      setTimeout(() => loadCommercialMeta(slug), 120);
    }, true);
    $('#slug')?.addEventListener('change', () => loadCommercialMeta(($('#slug')?.value || '').trim()));
    document.addEventListener('click', publishGuard, true);
  }

  async function init() {
    installStyles();
    installPanel();
    let attempts = 0;
    while (!window.neuralCriticSupabase && attempts < 80) {
      attempts += 1;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    client = window.neuralCriticSupabase || null;
    if (!client) { status('Commercial controls could not connect to the CMS.', true); return; }
    wireStoryChanges();
    const slug = ($('#slug')?.value || '').trim();
    if (slug) loadCommercialMeta(slug);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
