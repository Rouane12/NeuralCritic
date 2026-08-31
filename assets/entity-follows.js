(() => {
  'use strict';

  const TABLE = 'reader_entity_follows';
  const TYPES = new Set(['game', 'series', 'franchise']);
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (v = '') => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const slugify = (v = '') => String(v).trim().toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  let currentEntity = null;
  let busy = false;
  let renderId = 0;
  let articleIndex = null;
  let accountTimer = 0;

  function ensureStyles() {
    if ($('style[data-nc-entity-follows]')) return;
    const style = document.createElement('style');
    style.dataset.ncEntityFollows = '1';
    style.textContent = `
      .nc-entity-follow-cta{display:inline-flex;align-items:center;gap:8px;margin-top:16px;padding:10px 14px;border:1px solid rgba(88,218,239,.42);border-radius:999px;background:rgba(8,22,38,.42);color:#dff8ff;font:800 10px/1 Inter,system-ui,sans-serif;letter-spacing:.08em;cursor:pointer;transition:.2s ease}.nc-entity-follow-cta:hover,.nc-entity-follow-cta:focus-visible{border-color:#55dcea;transform:translateY(-1px);outline:none}.nc-entity-follow-cta[aria-pressed="true"]{border-color:rgba(108,93,255,.55);background:rgba(91,77,225,.14);color:#c9c3ff}.nc-entity-follow-cta:disabled{opacity:.65;cursor:wait;transform:none}.nc-entity-follow-cta svg{width:16px;height:16px;display:block}
      .nc-following-account{margin-top:18px;padding-top:17px;border-top:1px solid rgba(126,145,184,.18)}.nc-following-head{display:flex;align-items:end;justify-content:space-between;gap:12px;margin-bottom:10px}.nc-following-head small{display:block;color:#55dcea;font:850 7px/1 Inter,system-ui,sans-serif;letter-spacing:.14em}.nc-following-head strong{display:block;margin-top:5px;color:#eef3ff;font:780 16px/1.1 Inter,system-ui,sans-serif}.nc-following-count{color:#7e8ba3;font:800 7px/1 Inter,system-ui,sans-serif;letter-spacing:.08em}.nc-following-list{display:grid;gap:7px}.nc-following-card{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:9px 10px;border:1px solid rgba(126,145,184,.16);border-radius:11px;background:rgba(8,14,28,.55)}.nc-following-card a{min-width:0;color:#e9eef9;text-decoration:none}.nc-following-card a:hover strong{text-decoration:underline;text-underline-offset:2px}.nc-following-card small{display:block;color:#55dcea;font:800 6px/1 Inter,system-ui,sans-serif;letter-spacing:.11em}.nc-following-card strong{display:block;margin-top:4px;font:720 9px/1.3 Inter,system-ui,sans-serif}.nc-following-remove{width:28px;height:28px;border:1px solid rgba(126,145,184,.2);border-radius:50%;background:transparent;color:#8996ac;cursor:pointer}.nc-following-remove:hover,.nc-following-remove:focus-visible{border-color:rgba(255,115,139,.4);color:#ff8299;outline:none}.nc-following-empty{margin:0;color:#8996ac;font:500 9px/1.5 Inter,system-ui,sans-serif}.nc-follow-feed{margin-top:14px}.nc-follow-feed>small{display:block;margin-bottom:8px;color:#7e8ba3;font:850 6px/1 Inter,system-ui,sans-serif;letter-spacing:.12em}.nc-follow-feed-list{display:grid;gap:7px}.nc-follow-feed-item{display:block;padding:9px 10px;border-radius:10px;background:rgba(100,90,255,.07);color:#e9eef9;text-decoration:none}.nc-follow-feed-item small{display:block;color:#8c83ff;font:800 6px/1 Inter,system-ui,sans-serif;letter-spacing:.1em}.nc-follow-feed-item strong{display:-webkit-box;margin-top:4px;overflow:hidden;-webkit-line-clamp:2;-webkit-box-orient:vertical;font:700 9px/1.35 Inter,system-ui,sans-serif}.nc-follow-feed-item span{display:block;margin-top:5px;color:#7e8ba3;font:650 6px/1 Inter,system-ui,sans-serif;letter-spacing:.05em}
      html[data-theme="light"] .nc-following-head strong,html[data-theme="light"] .nc-following-card a,html[data-theme="light"] .nc-follow-feed-item{color:#1c2738}html[data-theme="light"] .nc-following-card{background:rgba(245,248,252,.8)}html[data-theme="light"] .nc-entity-follow-cta{background:rgba(235,247,250,.9);color:#183244}
    `;
    document.head.appendChild(style);
  }

  function candidateClients() {
    return [...new Set([
      window.neuralCriticReaderSupabase,
      window.neuralCriticCommunitySupabase,
      window.neuralCriticPublicSupabase,
      window.neuralCriticSupabase,
    ].filter(client => client?.auth && typeof client.from === 'function'))];
  }

  async function authContext(wait = true) {
    const attempts = wait ? 70 : 1;
    let fallback = null;
    for (let i = 0; i < attempts; i++) {
      const clients = candidateClients();
      fallback ||= clients[0] || null;
      for (const sb of clients) {
        try {
          const { data, error } = await sb.auth.getUser();
          if (!error && data?.user) return { sb, user:data.user };
        } catch (_) {}
      }
      if (clients.length && !wait) return { sb:fallback, user:null };
      await sleep(80);
    }
    return { sb:fallback, user:null };
  }

  function openLogin() {
    if (window.NeuralCriticReaderAuth?.openAuth) return window.NeuralCriticReaderAuth.openAuth('login');
    $('[data-reader-auth-open],.reader-account-button')?.click();
  }

  function entityUrl(entity) {
    if (!entity) return '#';
    if (entity.type === 'game') return `/games/${encodeURIComponent(entity.slug)}/`;
    return `/topics/${encodeURIComponent(entity.type)}/${encodeURIComponent(entity.slug)}/`;
  }

  function resolveEntity() {
    const staticTopic = window.NEURAL_CRITIC_STATIC_TOPIC;
    if (staticTopic && TYPES.has(staticTopic.type) && staticTopic.slug && staticTopic.name) {
      return { type:staticTopic.type, slug:staticTopic.slug, name:staticTopic.name };
    }
    const gameSlug = window.NEURAL_CRITIC_STATIC_GAME_SLUG || location.pathname.match(/^\/games\/([^/]+)\/?$/)?.[1] || new URLSearchParams(location.search).get('slug');
    if (document.body.classList.contains('nc-game-page') && gameSlug) {
      const name = ($('#game-title')?.textContent || '').trim();
      if (name && !/^loading|game not found|game unavailable$/i.test(name)) return { type:'game', slug:decodeURIComponent(gameSlug), name };
    }
    const params = new URLSearchParams(location.search);
    for (const type of TYPES) {
      const value = params.get(type);
      if (!value) continue;
      const name = ($('#topic-title')?.textContent || '').trim();
      if (name && !/^loading topic/i.test(name)) return { type, slug:value, name };
    }
    return null;
  }

  async function list() {
    const { sb, user } = await authContext();
    if (!sb || !user) return [];
    const { data, error } = await sb.from(TABLE)
      .select('entity_type,entity_slug,entity_name,created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending:false });
    if (error) throw error;
    return data || [];
  }

  async function followedWithContext(sb, user, entity) {
    if (!sb || !user || !entity) return false;
    const { data, error } = await sb.from(TABLE)
      .select('entity_slug')
      .eq('user_id', user.id)
      .eq('entity_type', entity.type)
      .eq('entity_slug', entity.slug)
      .maybeSingle();
    if (error) throw error;
    return !!data;
  }

  async function isFollowing(entity = currentEntity) {
    const { sb, user } = await authContext();
    return followedWithContext(sb, user, entity);
  }

  async function follow(entity = currentEntity) {
    const { sb, user } = await authContext();
    if (!sb || !user) { openLogin(); return false; }
    const { error } = await sb.from(TABLE).insert({ user_id:user.id, entity_type:entity.type, entity_slug:entity.slug, entity_name:entity.name });
    if (error && error.code !== '23505') throw error;
    if (!await followedWithContext(sb, user, entity)) throw new Error('Follow could not be verified.');
    document.dispatchEvent(new CustomEvent('nc:entity-follows-changed', { detail:{ entity, following:true } }));
    return true;
  }

  async function unfollow(entity = currentEntity) {
    const { sb, user } = await authContext();
    if (!sb || !user) return false;
    const { error } = await sb.from(TABLE).delete()
      .eq('user_id', user.id).eq('entity_type', entity.type).eq('entity_slug', entity.slug);
    if (error) throw error;
    if (await followedWithContext(sb, user, entity)) throw new Error('Unfollow could not be verified.');
    document.dispatchEvent(new CustomEvent('nc:entity-follows-changed', { detail:{ entity, following:false } }));
    return true;
  }

  const bellIcon = on => `<svg viewBox="0 0 24 24" fill="${on ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path><path d="M10 21h4"></path></svg>`;

  function paintButton(on, state = 'ready') {
    const button = $('.nc-entity-follow-cta');
    if (!button || !currentEntity) return;
    button.setAttribute('aria-pressed', String(on));
    button.dataset.state = state;
    const type = currentEntity.type.toUpperCase();
    const label = state === 'saving' ? 'FOLLOWING…' : state === 'removing' ? 'UNFOLLOWING…' : state === 'error' ? 'RETRY' : on ? 'FOLLOWING' : `FOLLOW ${type}`;
    button.innerHTML = `${bellIcon(on)}<span>${label}</span>`;
    button.title = on ? `Unfollow ${currentEntity.name}` : `Follow ${currentEntity.name}`;
  }

  async function syncButton() {
    const button = $('.nc-entity-follow-cta');
    if (!button || !currentEntity) return;
    try {
      const { sb, user } = await authContext(false);
      if (!sb || !user) { paintButton(false); return; }
      paintButton(await followedWithContext(sb, user, currentEntity));
    } catch (error) {
      console.warn('Entity follow state check failed.', error);
      paintButton(false, 'error');
    }
  }

  async function toggleCurrent() {
    if (busy || !currentEntity) return;
    const button = $('.nc-entity-follow-cta');
    if (!button) return;
    busy = true;
    button.disabled = true;
    let before = false;
    try {
      const { sb, user } = await authContext();
      if (!sb || !user) { openLogin(); return; }
      before = await followedWithContext(sb, user, currentEntity);
      paintButton(before, before ? 'removing' : 'saving');
      if (before) await unfollow(currentEntity); else await follow(currentEntity);
      const after = await followedWithContext(sb, user, currentEntity);
      if (after === before) throw new Error('Follow state did not persist.');
      paintButton(after);
      refreshAccountSoon(0);
      window.gtag?.('event', after ? 'entity_followed' : 'entity_unfollowed', { entity_type:currentEntity.type, entity_slug:currentEntity.slug });
    } catch (error) {
      console.warn('Entity follow action failed.', error);
      paintButton(before, 'error');
    } finally {
      busy = false;
      button.disabled = false;
    }
  }

  function injectPageButton() {
    currentEntity = resolveEntity();
    if (!currentEntity) return false;
    if ($('.nc-entity-follow-cta')) { syncButton(); return true; }
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'nc-entity-follow-cta';
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', toggleCurrent);
    if (currentEntity.type === 'game') {
      const host = $('.nc-game-intro');
      const anchor = $('#game-score');
      if (!host) return false;
      if (anchor) host.insertBefore(button, anchor); else host.appendChild(button);
    } else {
      const host = $('#topic-relations')?.parentElement || $('.nc-topic-hero-head');
      if (!host) return false;
      host.appendChild(button);
    }
    paintButton(false);
    syncButton();
    return true;
  }

  function accountExtensionHost(create = true) {
    const card = $('.reader-auth-card');
    if (!card) return null;
    let host = $('.reader-account-extensions', card);
    if (!host && create) {
      host = document.createElement('div');
      host.className = 'reader-account-extensions';
      host.dataset.readerAccountExtensions = '1';
      const signout = $('.reader-auth-signout', card);
      if (signout) card.insertBefore(host, signout); else card.appendChild(host);
    }
    return host;
  }

  async function loadArticles() {
    if (articleIndex) return articleIndex;
    try {
      const response = await fetch('/data/articles.json', { cache:'no-cache' });
      articleIndex = response.ok ? await response.json() : [];
      if (!Array.isArray(articleIndex)) articleIndex = [];
    } catch (_) { articleIndex = []; }
    return articleIndex;
  }

  function articleMatchesFollow(article, followRow) {
    const value = followRow.entity_type === 'game' ? (article.gameKey || article.game_key || '') : article[followRow.entity_type] || '';
    return slugify(value) === followRow.entity_slug;
  }

  function storyUrl(article) { return `/stories/${encodeURIComponent(article.slug)}/`; }
  function dateLabel(value) {
    if (!value) return '';
    try { return new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(value)); } catch (_) { return ''; }
  }

  async function renderAccount() {
    const host = accountExtensionHost();
    if (!host) return false;
    const id = ++renderId;
    const { user } = await authContext(true);
    let section = $('.nc-following-account', host);
    if (!user) { section?.remove(); return false; }
    if (!section) {
      section = document.createElement('section');
      section.className = 'nc-following-account';
      section.dataset.readerAccountExtension = 'entity-follows';
      host.appendChild(section);
    }
    try {
      const [rows, articles] = await Promise.all([list(), loadArticles()]);
      if (id !== renderId) return false;
      const cards = rows.map(row => {
        const entity = { type:row.entity_type, slug:row.entity_slug, name:row.entity_name };
        return `<article class="nc-following-card" data-follow-type="${esc(row.entity_type)}" data-follow-slug="${esc(row.entity_slug)}" data-follow-name="${esc(row.entity_name)}"><a href="${esc(entityUrl(entity))}"><small>${esc(row.entity_type.toUpperCase())}</small><strong>${esc(row.entity_name)}</strong></a><button class="nc-following-remove" type="button" aria-label="Unfollow ${esc(row.entity_name)}">×</button></article>`;
      }).join('');
      const feed = articles.filter(article => rows.some(row => articleMatchesFollow(article,row))).sort((a,b) => new Date(b.publishedAt || 0)-new Date(a.publishedAt || 0)).slice(0,4);
      const feedMarkup = feed.length ? `<div class="nc-follow-feed"><small>LATEST FROM YOUR FOLLOWS</small><div class="nc-follow-feed-list">${feed.map(article => `<a class="nc-follow-feed-item" href="${storyUrl(article)}"><small>${esc(String(article.category || 'STORY').toUpperCase())}</small><strong>${esc(article.title || '')}</strong><span>${esc(dateLabel(article.publishedAt))}</span></a>`).join('')}</div></div>` : '';
      section.innerHTML = `<div class="nc-following-head"><div><small>YOUR INTERESTS</small><strong>Following</strong></div><span class="nc-following-count">${rows.length} FOLLOWING</span></div>${cards ? `<div class="nc-following-list">${cards}</div>` : '<p class="nc-following-empty">Follow games and franchises to keep their newest Neural Critic coverage close at hand.</p>'}${feedMarkup}`;
      section.querySelectorAll('.nc-following-remove').forEach(removeButton => removeButton.addEventListener('click', async () => {
        const card = removeButton.closest('[data-follow-slug]');
        if (!card) return;
        removeButton.disabled = true;
        try {
          await unfollow({ type:card.dataset.followType, slug:card.dataset.followSlug, name:card.dataset.followName });
          await renderAccount();
          await syncButton();
        } catch (_) { removeButton.disabled = false; }
      }));
      return true;
    } catch (error) {
      console.warn('Following account render failed.', error);
      section.innerHTML = '<p class="nc-following-empty">Following is temporarily unavailable. Please try again shortly.</p>';
      return false;
    }
  }

  function refreshAccountSoon(delay = 50) {
    clearTimeout(accountTimer);
    accountTimer = setTimeout(() => renderAccount(), delay);
  }

  function init() {
    ensureStyles();
    let tries = 0;
    const timer = setInterval(() => { if (injectPageButton() || ++tries > 100) clearInterval(timer); }, 100);
    const observer = new MutationObserver(() => {
      injectPageButton();
      const modal = $('.reader-auth-modal');
      if (modal && !modal.hidden) refreshAccountSoon(0);
    });
    observer.observe(document.documentElement, { childList:true, subtree:true, attributes:true, attributeFilter:['hidden','aria-hidden'] });
    document.addEventListener('click', event => {
      if (event.target.closest?.('[data-reader-auth-open],.reader-account-button,[data-article-account]')) refreshAccountSoon(80);
    }, true);
    document.addEventListener('nc:reader-auth', () => { syncButton(); refreshAccountSoon(0); });
    document.addEventListener('nc:entity-follows-changed', () => { syncButton(); refreshAccountSoon(0); });
    window.addEventListener('focus', () => { if ($('.reader-auth-modal:not([hidden])')) refreshAccountSoon(0); });
    renderAccount();
  }

  window.NeuralCriticEntityFollows = { list, isFollowing, follow, unfollow, refresh:renderAccount };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true }); else init();
})();
