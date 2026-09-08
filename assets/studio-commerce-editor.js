(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const client = window.neuralCriticSupabase;
  if (!client) return;

  let games = [];
  let activeGame = null;
  let preservedAffiliateStorefronts = [];

  const esc = (value = '') => String(value).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  function ensureStyles() {
    if (document.querySelector('link[data-studio-commerce]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'assets/studio-commerce.css?v=20260908-editor1';
    link.dataset.studioCommerce = '1';
    document.head.appendChild(link);
  }

  function status(message, tone = '') {
    const el = $('#studio-commerce-status');
    if (!el) return;
    el.textContent = message;
    el.className = `studio-commerce-status ${tone}`.trim();
  }

  function mount() {
    const reviewFields = $('#review-fields');
    if (!reviewFields || $('#review-commerce-editor')) return false;
    reviewFields.insertAdjacentHTML('beforeend', `
      <div class="studio-commerce-editor" id="review-commerce-editor">
        <div class="studio-commerce-head">
          <div>
            <small>WHERE TO BUY</small>
            <h3>Review storefronts</h3>
            <p>Link the review to its canonical game, then manage verified direct storefronts once at the game level. Every review linked to that game inherits the same storefront data.</p>
          </div>
          <label class="studio-commerce-toggle"><input id="where-to-buy-enabled" type="checkbox" checked> Show Where to Buy on this review</label>
        </div>
        <div class="studio-commerce-game">
          <label>LINKED GAME
            <input id="game-key" list="studio-game-options" autocomplete="off" placeholder="Start typing a canonical game title">
            <datalist id="studio-game-options"></datalist>
          </label>
          <button type="button" id="studio-storefront-load">LOAD GAME</button>
        </div>
        <p class="studio-commerce-status" id="studio-commerce-status">Choose a linked game to manage its storefronts.</p>
        <div class="studio-storefront-list" id="studio-storefront-list"></div>
        <div class="studio-commerce-actions">
          <button type="button" id="studio-storefront-add">＋ ADD STOREFRONT</button>
          <button type="button" class="primary" id="studio-storefront-save">SAVE STOREFRONTS</button>
        </div>
        <p class="studio-commerce-note"><b>Trust rule:</b> this editor stores direct HTTPS storefront links only. It does not accept prices, stock claims, discounts, or affiliate destinations. Existing provider-managed affiliate storefront records are preserved but not editable here.</p>
      </div>`);
    return true;
  }

  function storefrontRow(entry = {}) {
    return `<article class="studio-storefront-row">
      <label>PLATFORM<input data-storefront-field="platform" value="${esc(entry.platform || '')}" placeholder="PC"></label>
      <label>STORE<input data-storefront-field="store" value="${esc(entry.store || '')}" placeholder="Steam"></label>
      <label>HTTPS STORE URL<input data-storefront-field="url" type="url" value="${esc(entry.url || '')}" placeholder="https://…"></label>
      <label>REGION<input data-storefront-field="region" value="${esc(entry.region || 'global')}" placeholder="global"></label>
      <label>VERIFICATION SOURCE<input data-storefront-field="source" value="${esc(entry.source || '')}" placeholder="Official store product page"></label>
      <button type="button" class="studio-storefront-remove" data-storefront-remove aria-label="Remove storefront">×</button>
    </article>`;
  }

  function renderStorefronts(storefronts = []) {
    const list = $('#studio-storefront-list');
    if (!list) return;
    list.innerHTML = storefronts.length
      ? storefronts.map(storefrontRow).join('')
      : '<div class="studio-storefront-empty">No direct storefronts are saved for this game yet.</div>';
  }

  function populateGames() {
    const datalist = $('#studio-game-options');
    if (!datalist) return;
    datalist.innerHTML = games.map(game => `<option value="${esc(game.title)}">${esc(game.slug)}</option>`).join('');
  }

  function selectedGame() {
    const key = String($('#game-key')?.value || '').trim().toLowerCase();
    if (!key) return null;
    return games.find(game => String(game.title || '').trim().toLowerCase() === key)
      || games.find(game => String(game.slug || '').trim().toLowerCase() === key)
      || null;
  }

  function normalizeDirectStorefronts(raw) {
    if (!Array.isArray(raw)) return [];
    preservedAffiliateStorefronts = raw.filter(entry => entry?.affiliate === true);
    return raw.filter(entry => entry?.affiliate !== true).map(entry => ({
      platform: String(entry?.platform || '').trim(),
      store: String(entry?.store || '').trim(),
      url: String(entry?.url || '').trim(),
      region: String(entry?.region || 'global').trim() || 'global',
      source: String(entry?.source || '').trim(),
      verifiedAt: String(entry?.verifiedAt || '').trim(),
      affiliate: false,
    }));
  }

  async function loadSelectedGame({ quiet = false } = {}) {
    const game = selectedGame();
    activeGame = game;
    preservedAffiliateStorefronts = [];

    if (!game) {
      renderStorefronts([]);
      if (!quiet) status($('#game-key')?.value?.trim() ? 'That game is not in the canonical Games database.' : 'Choose a linked game to manage its storefronts.', $('#game-key')?.value?.trim() ? 'error' : '');
      return false;
    }

    $('#game-key').value = game.title;
    const direct = normalizeDirectStorefronts(game.metadata?.storefronts);
    renderStorefronts(direct);
    const affiliateNote = preservedAffiliateStorefronts.length
      ? ` ${preservedAffiliateStorefronts.length} provider-managed affiliate storefront record${preservedAffiliateStorefronts.length === 1 ? ' is' : 's are'} preserved separately.`
      : '';
    status(`${direct.length} direct storefront${direct.length === 1 ? '' : 's'} loaded for ${game.title}.${affiliateNote}`, 'success');
    return true;
  }

  function safeHttps(value) {
    try {
      const url = new URL(String(value || '').trim());
      return url.protocol === 'https:' ? url.href : '';
    } catch (_) {
      return '';
    }
  }

  function collectStorefronts() {
    const rows = $$('.studio-storefront-row', $('#studio-storefront-list'));
    const today = new Date().toISOString().slice(0, 10);
    const storefronts = rows.map((row, index) => {
      const read = field => String($(`[data-storefront-field="${field}"]`, row)?.value || '').trim();
      const platform = read('platform');
      const store = read('store');
      const url = safeHttps(read('url'));
      const region = read('region') || 'global';
      const source = read('source');
      if (!platform || !store || !url || !source) {
        throw new Error(`Storefront ${index + 1} needs a platform, store, HTTPS URL, and verification source.`);
      }
      return { platform, store, url, region, source, verifiedAt: today, affiliate: false };
    });

    const seen = new Set();
    storefronts.forEach(entry => {
      const key = `${entry.platform.toLowerCase()}|${entry.store.toLowerCase()}|${entry.url.toLowerCase()}`;
      if (seen.has(key)) throw new Error(`Duplicate storefront: ${entry.platform} · ${entry.store}.`);
      seen.add(key);
    });
    return storefronts;
  }

  async function saveStorefronts() {
    if (!activeGame || selectedGame()?.id !== activeGame.id) {
      const loaded = await loadSelectedGame();
      if (!loaded) return;
    }

    let direct;
    try {
      direct = collectStorefronts();
    } catch (error) {
      status(error.message, 'error');
      return;
    }

    status('Saving canonical game storefronts…');
    const { data: current, error: readError } = await client.from('games')
      .select('id,slug,title,metadata')
      .eq('id', activeGame.id)
      .maybeSingle();
    if (readError || !current) {
      status(readError?.message || 'Could not reload the canonical game record.', 'error');
      return;
    }

    const currentStorefronts = Array.isArray(current.metadata?.storefronts) ? current.metadata.storefronts : [];
    const providerManaged = currentStorefronts.filter(entry => entry?.affiliate === true);
    const metadata = {
      ...(current.metadata || {}),
      storefronts: [...direct, ...providerManaged],
    };

    const { data: updated, error } = await client.from('games')
      .update({ metadata })
      .eq('id', activeGame.id)
      .select('id,slug,title,metadata')
      .maybeSingle();
    if (error || !updated) {
      status(error?.message || 'The database did not confirm the storefront update.', 'error');
      return;
    }

    games = games.map(game => game.id === updated.id ? updated : game);
    activeGame = updated;
    preservedAffiliateStorefronts = providerManaged;
    renderStorefronts(normalizeDirectStorefronts(updated.metadata?.storefronts));
    status(`Saved ${direct.length} verified direct storefront${direct.length === 1 ? '' : 's'} for ${updated.title}.`, 'success');
  }

  async function loadGames() {
    status('Loading canonical Games database…');
    const { data, error } = await client.from('games')
      .select('id,slug,title,metadata')
      .order('title', { ascending: true });
    if (error) {
      status(error.message || 'Could not load the Games database.', 'error');
      return;
    }
    games = data || [];
    populateGames();
    if ($('#game-key')?.value.trim()) await loadSelectedGame({ quiet: true });
    else status(`${games.length} canonical games available. Link a game to manage storefronts.`);
  }

  function wire() {
    $('#studio-storefront-load')?.addEventListener('click', () => loadSelectedGame());
    $('#game-key')?.addEventListener('change', () => loadSelectedGame());
    $('#game-key')?.addEventListener('blur', () => {
      if ($('#game-key')?.value.trim()) loadSelectedGame({ quiet: true });
    });
    $('#studio-storefront-add')?.addEventListener('click', () => {
      const list = $('#studio-storefront-list');
      if (!activeGame) {
        status('Link and load a canonical game before adding storefronts.', 'error');
        return;
      }
      list.querySelector('.studio-storefront-empty')?.remove();
      list.insertAdjacentHTML('beforeend', storefrontRow());
      list.querySelector('.studio-storefront-row:last-child input')?.focus();
    });
    $('#studio-storefront-list')?.addEventListener('click', event => {
      const remove = event.target.closest('[data-storefront-remove]');
      if (!remove) return;
      remove.closest('.studio-storefront-row')?.remove();
      if (!$('#studio-storefront-list .studio-storefront-row')) renderStorefronts([]);
    });
    $('#studio-storefront-save')?.addEventListener('click', saveStorefronts);

    document.addEventListener('nc:studio-article-loaded', () => setTimeout(() => loadSelectedGame({ quiet: true }), 0));
    document.addEventListener('nc:studio-format-changed', event => {
      if (event.detail?.format === 'review' && $('#game-key')?.value.trim()) loadSelectedGame({ quiet: true });
    });
  }

  async function init() {
    ensureStyles();
    if (!mount()) return;
    renderStorefronts([]);
    wire();
    await loadGames();
  }

  init().catch(error => status(error.message || 'Where to Buy editor could not start.', 'error'));
})();