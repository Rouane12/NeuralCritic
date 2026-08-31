(() => {
  'use strict';

  const TABLE = 'reader_entity_follows';
  const TYPES = new Set(['game', 'series', 'franchise']);
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (v = '') => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const slugify = (v = '') => String(v).trim().toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  let pageEntity = null;
  let articleEntity = null;
  let busyKey = '';
  let renderId = 0;
  let articleIndex = null;
  let accountTimer = 0;

  function ensureStyles() {
    if ($('style[data-nc-entity-follows-v2]')) return;
    const style = document.createElement('style');
    style.dataset.ncEntityFollowsV2 = '1';
    style.textContent = `
      .nc-entity-follow-cta{display:inline-flex;align-items:center;gap:8px;margin-top:16px;padding:10px 14px;border:1px solid rgba(88,218,239,.42);border-radius:999px;background:rgba(8,22,38,.42);color:#dff8ff;font:800 10px/1 Inter,system-ui,sans-serif;letter-spacing:.08em;cursor:pointer;transition:.2s ease}.nc-entity-follow-cta:hover,.nc-entity-follow-cta:focus-visible{border-color:#55dcea;transform:translateY(-1px);outline:none}.nc-entity-follow-cta[aria-pressed="true"]{border-color:rgba(108,93,255,.55);background:rgba(91,77,225,.14);color:#c9c3ff}.nc-entity-follow-cta[data-state="error"]{border-color:rgba(255,115,139,.48);color:#ff8da2}.nc-entity-follow-cta:disabled{opacity:.65;cursor:wait;transform:none}.nc-entity-follow-cta svg{width:16px;height:16px;display:block}
      .work-react-rail [data-entity-article-follow] b{display:grid;place-items:center}.work-react-rail [data-entity-article-follow] b svg{display:block;width:18px;height:18px}.work-react-rail [data-entity-article-follow][aria-pressed="true"]{color:#665dff}.work-react-rail [data-entity-article-follow][data-state="error"]{color:#c04d67}.work-react-rail [data-entity-article-follow]:disabled{opacity:.62;cursor:wait}
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

  function resolvePageEntity() {
    const staticTopic = window.NEURAL_CRITIC_STATIC_TOPIC;
    if (staticTopic && TYPES.has(staticTopic.type) && staticTopic.slug && staticTopic.name) {
      return { type:staticTopic.type, slug:staticTopic.slug, name:staticTopic.name };
    }
    const gameSlug = window.NEURAL_CRITIC_STATIC_GAME_SLUG || location.pathname.match(/^\/games\/([^/]+)\/?$/)?.[1] || new URLSearchParams(location.search).get('slug');
    if (document.body.classList.contains('nc-game-page') && gameSlug) {
      const name = ($('#game-title')?.textContent || '').trim();
      if (name && !/^loading|game not found|game unavailable$/i.test(name)) return { type:'game', slug:decodeURIComponent(gameSlug), name };
    }
    return null;
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

  function currentArticleSlug() {
    return window.NEURAL_CRITIC_STATIC_SLUG || new URLSearchParams(location.search).get('slug') || location.pathname.match(/^\/stories\/([^/]+)\/?$/)?.[1] || '';
  }

  async function resolveArticleEntity() {
    const slug = currentArticleSlug();
    if (!slug) return null;
    const rows = await loadArticles();
    const article = rows.find(row => row.slug === slug);
    if (!article) return null;
    const candidates = [
      ['game', article.gameKey || article.game_key],
      ['series', article.series],
      ['franchise', article.franchise],
    ];
    const [type, name] = candidates.find(([, value]) => String(value || '').trim()) || [];
    return type && name ? { type, slug:slugify(name), name:String(name).trim() } : null;
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

  async function setFollowStateWithContext(sb, user, entity, following) {
    if (!sb || !user || !entity) throw new Error('Authenticated follow context unavailable.');
    if (following) {
      const { error } = await sb.from(TABLE).insert({
        user_id:user.id,
        entity_type:entity.type,
        entity_slug:entity.slug,
        entity_name:entity.name,
      });
      if (error && error.code !== '23505') throw error;
    } else {
      const { error } = await sb.from(TABLE).delete()
        .eq('user_id', user.id)
        .eq('entity_type', entity.type)
        .eq('entity_slug', entity.slug);
      if (error) throw error;
    }
    const persisted = await followedWithContext(sb, user, entity);
    if (persisted !== following) throw new Error(`Entity follow ${following ? 'save' : 'removal'} could not be verified.`);
    document.dispatchEvent(new CustomEvent('nc:entity-follows-changed', { detail:{ entity, following } }));
    return persisted;
  }

  const bellIcon = on => `<svg viewBox="0 0 24 24" fill="${on ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path><path d="M10 21h4"></path></svg>`;

  function paintPageButton(on, state = 'ready') {
    const button = $('.nc-entity-follow-cta');
    if (!button || !pageEntity) return;
    button.setAttribute('aria-pressed', String(on));
    button.dataset.state = state;
    const type = pageEntity.type.toUpperCase();
    const label = state === 'saving' ? 'FOLLOWING…' : state === 'removing' ? 'UNFOLLOWING…' : state === 'error' ? 'RETRY' : on ? 'FOLLOWING' : `FOLLOW ${type}`;
    button.innerHTML = `${bellIcon(on)}<span>${label}</span>`;
    button.title = state === 'error' ? `Retry follow action for ${pageEntity.name}` : on ? `Unfollow ${pageEntity.name}` : `Follow ${pageEntity.name}`;
  }

  function paintArticleButton(on, state = 'ready') {
    const button = $('[data-entity-article-follow]');
    if (!button || !articleEntity) return;
    button.setAttribute('aria-pressed', String(on));
    button.dataset.state = state;
    const label = state === 'saving' ? 'SAVING' : state === 'removing' ? 'REMOVING' : state === 'error' ? 'RETRY' : on ? `${articleEntity.type.toUpperCase()} ✓` : `FOLLOW ${articleEntity.type.toUpperCase()}`;
    button.innerHTML = `<b aria-hidden="true">${bellIcon(on)}</b><small>${label}</small>`;
    button.title = state === 'error' ? `Retry follow action for ${articleEntity.name}` : on ? `Following ${articleEntity.name}` : `Follow ${articleEntity.name}`;
  }

  async function syncEntityButton(entity, paint) {
    if (!entity) return false;
    try {
      const { sb, user } = await authContext(false);
      if (!sb || !user) { paint(false); return false; }
      const following = await followedWithContext(sb, user, entity);
      paint(following);
      return following;
    } catch (error) {
      console.warn('Entity follow state check failed.', error);
      paint(false, 'error');
      return false;
    }
  }

  async function toggleEntity(entity, paint) {
    if (!entity) return;
    const key = `${entity.type}:${entity.slug}`;
    if (busyKey) return;
    busyKey = key;
    const button = entity === pageEntity ? $('.nc-entity-follow-cta') : $('[data-entity-article-follow]');
    if (button) button.disabled = true;
    let before = false;
    try {
      const { sb, user } = await authContext();
      if (!sb || !user) { openLogin(); return; }
      before = await followedWithContext(sb, user, entity);
      paint(before, before ? 'removing' : 'saving');
      const after = await setFollowStateWithContext(sb, user, entity, !before);
      paint(after);
      refreshAccountSoon(0);
      syncAllButtons();
      window.gtag?.('event', after ? 'entity_followed' : 'entity_unfollowed', { entity_type:entity.type, entity_slug:entity.slug });
    } catch (error) {
      console.warn('Entity follow action failed.', error);
      paint(before, 'error');
    } finally {
      busyKey = '';
      if (button) button.disabled = false;
    }
  }

  function injectPageButton() {
    pageEntity = resolvePageEntity();
    if (!pageEntity) return false;
    if ($('.nc-entity-follow-cta')) { syncEntityButton(pageEntity, paintPageButton); return true; }
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'nc-entity-follow-cta';
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => toggleEntity(pageEntity, paintPageButton));
    if (pageEntity.type === 'game') {
      const host = $('.nc-game-intro');
      const anchor = $('#game-score');
      if (!host) return false;
      if (anchor) host.insertBefore(button, anchor); else host.appendChild(button);
    } else {
      const host = $('#topic-relations')?.parentElement || $('.nc-topic-hero-head');
      if (!host) return false;
      host.appendChild(button);
    }
    paintPageButton(false);
    syncEntityButton(pageEntity, paintPageButton);
    return true;
  }

  async function takeOverArticleFollow() {
    articleEntity = await resolveArticleEntity();
    if (!articleEntity) return false;
    let button = $('[data-entity-article-follow]');
    if (!button) {
      const old = $('[data-article-follow]');
      if (!old) return false;
      button = old.cloneNode(true);
      old.replaceWith(button);
      button.removeAttribute('data-article-follow');
      button.dataset.entityArticleFollow = '1';
      button.dataset.communityBound = '';
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        toggleEntity(articleEntity, paintArticleButton);
      });
    }
    paintArticleButton(false);
    await syncEntityButton(articleEntity, paintArticleButton);
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
    section.innerHTML = '<p class="nc-following-empty">Syncing your follows…</p>';
    try {
      const [follows, articles] = await Promise.all([list(), loadArticles()]);
      if (id !== renderId) return false;
      const cards = follows.map(row => {
        const entity = { type:row.entity_type, slug:row.entity_slug, name:row.entity_name };
        return `<article class="nc-following-card" data-follow-key="${esc(`${entity.type}:${entity.slug}`)}"><a href="${esc(entityUrl(entity))}"><small>${esc(entity.type.toUpperCase())}</small><strong>${esc(entity.name)}</strong></a><button type="button" class="nc-following-remove" data-unfollow-type="${esc(entity.type)}" data-unfollow-slug="${esc(entity.slug)}" data-unfollow-name="${esc(entity.name)}" aria-label="Unfollow ${esc(entity.name)}">×</button></article>`;
      }).join('');
      const feed = articles.filter(article => follows.some(row => articleMatchesFollow(article, row)))
        .sort((a,b) => new Date(b.publishedAt || b.published_at || 0) - new Date(a.publishedAt || a.published_at || 0))
        .slice(0,5);
      section.innerHTML = `<header class="nc-following-head"><div><small>YOUR INTERESTS</small><strong>Following</strong></div><span class="nc-following-count">${follows.length} FOLLOWING</span></header><div class="nc-following-list">${cards || '<p class="nc-following-empty">Follow games, series, or franchises to build your personal Neural Critic feed.</p>'}</div>${feed.length ? `<div class="nc-follow-feed"><small>LATEST FROM YOUR FOLLOWS</small><div class="nc-follow-feed-list">${feed.map(article => `<a class="nc-follow-feed-item" href="${storyUrl(article)}"><small>${esc(String(article.category || 'STORY').toUpperCase())}</small><strong>${esc(article.title || '')}</strong><span>${esc(dateLabel(article.publishedAt || article.published_at))}</span></a>`).join('')}</div></div>` : ''}`;
      $$('.nc-following-remove', section).forEach(button => button.addEventListener('click', async () => {
        const entity = { type:button.dataset.unfollowType, slug:button.dataset.unfollowSlug, name:button.dataset.unfollowName };
        button.disabled = true;
        try {
          const { sb, user } = await authContext();
          if (!sb || !user) return;
          await setFollowStateWithContext(sb, user, entity, false);
          await renderAccount();
          syncAllButtons();
        } catch (error) {
          console.warn('Account unfollow failed.', error);
          button.disabled = false;
        }
      }));
      return true;
    } catch (error) {
      console.warn('Following account render failed.', error);
      section.innerHTML = '<p class="nc-following-empty">Following could not be synced. Close and reopen your account to retry.</p>';
      return false;
    }
  }

  function accountModalIsOpen() {
    const modal = $('.reader-auth-modal');
    return !!modal && !modal.hidden && modal.getAttribute('aria-hidden') !== 'true';
  }

  function refreshAccountSoon(delay = 30) {
    clearTimeout(accountTimer);
    accountTimer = setTimeout(() => { if (accountModalIsOpen()) renderAccount(); }, delay);
  }

  async function syncAllButtons() {
    if (pageEntity) syncEntityButton(pageEntity, paintPageButton);
    if (articleEntity) syncEntityButton(articleEntity, paintArticleButton);
  }

  function watchAccount() {
    document.addEventListener('click', event => {
      if (event.target.closest('.reader-account-button,[data-reader-auth-open]')) setTimeout(renderAccount, 60);
    }, true);
    document.addEventListener('nc:entity-follows-changed', () => refreshAccountSoon(0));
    document.addEventListener('neuralcritic:community-refreshed', () => { syncAllButtons(); refreshAccountSoon(40); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { syncAllButtons(); refreshAccountSoon(30); } });
    window.addEventListener('focus', () => { syncAllButtons(); refreshAccountSoon(30); });
  }

  async function init() {
    ensureStyles();
    let attempts = 0;
    while (attempts++ < 80) {
      injectPageButton();
      await takeOverArticleFollow();
      if (pageEntity || articleEntity) break;
      await sleep(100);
    }
    watchAccount();
    window.NeuralCriticEntityFollows = { list, follow: async entity => {
      const { sb, user } = await authContext();
      if (!sb || !user) { openLogin(); return false; }
      return setFollowStateWithContext(sb, user, entity, true);
    }, unfollow: async entity => {
      const { sb, user } = await authContext();
      if (!sb || !user) return false;
      return setFollowStateWithContext(sb, user, entity, false);
    }, renderAccount };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true }); else init();
})();
