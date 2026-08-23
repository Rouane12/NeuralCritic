(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  function esc(value = '') {
    return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }

  function slugify(value = '') {
    return String(value).trim().toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function topicUrl(type, value) {
    const slug = slugify(value);
    return slug ? `/NeuralCritic/topics/${type}/${slug}/` : '';
  }

  function panelMarkup() {
    return `<section class="studio-panel nc-game-graph-panel">
      <div class="nc-game-graph-head">
        <div><small>NC GAME GRAPH · OPTIONAL</small><h2>Story identity</h2><p>Connect this story to a specific game, series, and franchise. These fields power recirculation, topic hubs, ranked-list relationships, and future news connections.</p></div>
        <span>GAME → SERIES → FRANCHISE</span>
      </div>
      <div class="nc-game-graph-fields">
        <label><span>GAME</span><input id="game-graph-game" type="text" maxlength="120" placeholder="Example: Super Mario Galaxy 2"><small>The exact game this story is primarily about.</small></label>
        <label><span>SERIES</span><input id="game-graph-series" type="text" maxlength="120" placeholder="Example: Mario Galaxy"><small>The immediate series or sub-series connecting closely related games.</small></label>
        <label><span>FRANCHISE</span><input id="game-graph-franchise" type="text" maxlength="120" placeholder="Example: Super Mario"><small>The broader franchise used for wider editorial relationships.</small></label>
      </div>
      <div class="nc-game-graph-preview" id="game-graph-preview"><span>GRAPH PREVIEW</span><p>Add identity fields to preview the connections this story will create.</p></div>
      <div class="nc-game-graph-status" id="game-graph-status"></div>
    </section>`;
  }

  function values() {
    return {
      game_key: $('#game-graph-game')?.value.trim() || null,
      series: $('#game-graph-series')?.value.trim() || null,
      franchise: $('#game-graph-franchise')?.value.trim() || null
    };
  }

  function setValues(data = {}) {
    if ($('#game-graph-game')) $('#game-graph-game').value = data.game_key || data.gameKey || '';
    if ($('#game-graph-series')) $('#game-graph-series').value = data.series || '';
    if ($('#game-graph-franchise')) $('#game-graph-franchise').value = data.franchise || '';
    renderPreview();
  }

  function renderPreview() {
    const host = $('#game-graph-preview');
    if (!host) return;
    const v = values();
    const nodes = [
      ['game',v.game_key,'GAME'],
      ['series',v.series,'SERIES'],
      ['franchise',v.franchise,'FRANCHISE']
    ].filter(([,value]) => value);
    if (!nodes.length) {
      host.innerHTML = '<span>GRAPH PREVIEW</span><p>Add identity fields to preview the connections this story will create.</p>';
      return;
    }
    host.innerHTML = `<span>GRAPH PREVIEW</span><div>${nodes.map(([type,value,label]) => `<a href="${esc(topicUrl(type,value))}" target="_blank" rel="noopener"><small>${label}</small><strong>${esc(value)}</strong><i>↗</i></a>`).join('<b>→</b>')}</div>`;
  }

  function suggestReviewGame() {
    const game = $('#game-graph-game');
    const title = $('#title')?.value.trim() || '';
    if (!game || game.value.trim() || !title) return;
    const format = $('.format-card.active')?.dataset.format || '';
    const category = $('#category')?.value || '';
    if (format !== 'review' && category !== 'REVIEW') return;
    let candidate = title.replace(/\s+review\s*:.*$/i,'').replace(/\s+review$/i,'').trim();
    if (/^review\s*[:\-–—]/i.test(title)) candidate = title.replace(/^review\s*[:\-–—]\s*/i,'').split(/\s*[:\-–—]\s*/)[0].trim();
    if (candidate) {
      game.value = candidate;
      renderPreview();
    }
  }

  async function loadIdentity(slug) {
    const client = window.neuralCriticSupabase;
    if (!client || !slug) return;
    try {
      const {data,error} = await client.from('articles').select('game_key,series,franchise').eq('slug',slug).maybeSingle();
      if (error) throw error;
      setValues(data || {});
    } catch (error) {
      const status = $('#game-graph-status');
      if (status) { status.textContent = error?.message || 'Could not load Game Graph identity.'; status.classList.add('error'); }
    }
  }

  async function syncIdentity(attempt = 0) {
    const client = window.neuralCriticSupabase;
    const slug = $('#slug')?.value.trim();
    if (!client || !slug) return;
    const status = $('#game-graph-status');
    if (status) { status.textContent = 'Syncing Game Graph identity…'; status.classList.remove('error'); }
    try {
      const {data:{user}} = await client.auth.getUser();
      if (!user) return;
      const payload = {...values(),updated_by:user.id};
      const {data,error} = await client.from('articles').update(payload).eq('slug',slug).select('id').maybeSingle();
      if (error) throw error;
      if (!data && attempt < 4) { setTimeout(() => syncIdentity(attempt + 1),450); return; }
      if (status) status.textContent = 'Game Graph identity synced.';
      renderPreview();
    } catch (error) {
      if (status) { status.textContent = error?.message || 'Game Graph sync failed.'; status.classList.add('error'); }
    }
  }

  function resetPanel() {
    setValues({});
    const status = $('#game-graph-status');
    if (status) { status.textContent = ''; status.classList.remove('error'); }
  }

  function install() {
    const form = $('#article-form');
    if (!form || $('.nc-game-graph-panel')) return;
    const taxonomy = $('.publication-taxonomy-panel',form);
    if (taxonomy) taxonomy.insertAdjacentHTML('afterend',panelMarkup());
    else $('.studio-fields',form)?.insertAdjacentHTML('beforebegin',panelMarkup());

    ['#game-graph-game','#game-graph-series','#game-graph-franchise'].forEach(selector => $(selector)?.addEventListener('input',renderPreview));
    $('#title')?.addEventListener('blur',suggestReviewGame);
    $$('.format-card').forEach(card => card.addEventListener('click',() => setTimeout(suggestReviewGame,0)));
    $('#category')?.addEventListener('change',suggestReviewGame);

    ['#save-draft','#schedule-story','#publish-story'].forEach(selector => $(selector)?.addEventListener('click',() => setTimeout(() => syncIdentity(),850)));
    $('#story-library')?.addEventListener('click',event => {
      const edit = event.target.closest('[data-edit]');
      if (edit) setTimeout(() => loadIdentity(edit.dataset.edit),300);
    });

    form.addEventListener('reset',() => setTimeout(resetPanel,0));
    const slug = $('#slug')?.value.trim();
    if (slug) loadIdentity(slug);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();