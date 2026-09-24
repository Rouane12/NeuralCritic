(() => {
  'use strict';

  const TABLE = 'article_reactions';
  const REACTION = 'like';
  const $ = (selector, root = document) => root.querySelector(selector);
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  function slug() {
    const staticSlug = String(window.NEURAL_CRITIC_STATIC_SLUG || '').trim();
    if (staticSlug) return staticSlug;
    const querySlug = new URLSearchParams(location.search).get('slug');
    if (querySlug) return querySlug;
    const match = location.pathname.match(/\/stories\/([^/]+)\/?$/i);
    return match?.[1] ? decodeURIComponent(match[1]) : '';
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

  async function likedWithContext(sb, user, articleSlug) {
    if (!sb || !user || !articleSlug) return false;
    const { data, error } = await sb.from(TABLE)
      .select('article_slug')
      .eq('article_slug', articleSlug)
      .eq('user_id', user.id)
      .eq('reaction_type', REACTION)
      .maybeSingle();
    if (error) throw error;
    return !!data;
  }

  function paint(button, liked, state = 'ready') {
    if (!button) return;
    const on = liked === true;
    button.classList.remove('active');
    button.classList.toggle('community-active', on);
    button.setAttribute('aria-pressed', String(on));
    button.dataset.state = state;
    button.setAttribute('aria-label',
      state === 'error' ? 'Retry liking this story' :
      on ? 'Remove like from this story' : 'Like this story'
    );
    button.title =
      state === 'error' ? 'Like could not be saved. Click to retry.' :
      on ? 'You liked this story' : 'Like this story';

    const label = $('small', button);
    if (label) {
      label.textContent =
        state === 'saving' ? 'SAVING' :
        state === 'error' ? 'RETRY' :
        on ? 'LIKED' : 'LIKE';
    }
  }

  async function syncButton(options = {}) {
    const button = $('[data-article-like]');
    const articleSlug = slug();
    if (!button || !articleSlug) return false;

    const { sb, user } = await authContext(options.waitForAuth !== false);
    if (!sb || !user) {
      paint(button, false, 'signed-out');
      return false;
    }

    try {
      const liked = await likedWithContext(sb, user, articleSlug);
      paint(button, liked);
      return liked;
    } catch (error) {
      console.warn('Article Like state check failed.', error);
      paint(button, false, 'error');
      return false;
    }
  }

  async function toggleCurrent(event) {
    event?.preventDefault?.();
    event?.stopImmediatePropagation?.();

    const button = $('[data-article-like]');
    const articleSlug = slug();
    if (!button || !articleSlug || button.dataset.state === 'saving') return;

    const { sb, user } = await authContext(true);
    if (!sb || !user) {
      paint(button, false, 'signed-out');
      openLogin();
      return;
    }

    button.disabled = true;
    let before = false;

    try {
      before = await likedWithContext(sb, user, articleSlug);
      paint(button, before, 'saving');

      if (before) {
        const { error } = await sb.from(TABLE)
          .delete()
          .eq('article_slug', articleSlug)
          .eq('user_id', user.id)
          .eq('reaction_type', REACTION);
        if (error) throw error;
      } else {
        const { error } = await sb.from(TABLE)
          .insert({ article_slug:articleSlug, user_id:user.id, reaction_type:REACTION });
        if (error && error.code !== '23505') throw error;
      }

      const after = await likedWithContext(sb, user, articleSlug);
      if (after === before) throw new Error('Article Like write could not be verified.');

      paint(button, after);
      document.dispatchEvent(new CustomEvent('nc:article-like-changed', {
        detail:{ slug:articleSlug, liked:after }
      }));
      window.gtag?.('event', after ? 'story_liked' : 'story_unliked', { article_slug:articleSlug });
    } catch (error) {
      console.warn('Article Like action failed.', error);
      try {
        paint(button, await likedWithContext(sb, user, articleSlug), 'error');
      } catch (_) {
        paint(button, before, 'error');
      }
    } finally {
      button.disabled = false;
    }
  }

  function takeOwnership() {
    const existing = $('[data-article-like]');
    if (!existing || !slug()) return false;
    if (existing.dataset.articleLikesOwner === 'v1') return true;

    // Replace the node so cached legacy localStorage/community click handlers
    // cannot race the authenticated persistence owner.
    const button = existing.cloneNode(true);
    existing.replaceWith(button);
    button.dataset.articleLikesOwner = 'v1';
    button.dataset.communityBound = 'article-likes-v1';
    button.type = 'button';
    button.addEventListener('click', toggleCurrent, true);
    syncButton({ waitForAuth:false });
    return true;
  }

  function init() {
    let tries = 0;
    const timer = setInterval(() => {
      if (takeOwnership() || ++tries > 100) clearInterval(timer);
    }, 100);

    const observer = new MutationObserver(() => takeOwnership());
    observer.observe(document.documentElement, { childList:true, subtree:true });

    document.addEventListener('nc:reader-auth', () => syncButton({ waitForAuth:true }));
    window.addEventListener('neuralcritic:account-refreshed', () => syncButton({ waitForAuth:true }));
    window.addEventListener('neuralcritic:community-refreshed', () => syncButton({ waitForAuth:false }));
    window.addEventListener('focus', () => syncButton({ waitForAuth:false }));
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) syncButton({ waitForAuth:false });
    });
  }

  window.NeuralCriticArticleLikes = {
    isLiked: async articleSlug => {
      const { sb, user } = await authContext(true);
      return likedWithContext(sb, user, articleSlug);
    },
    sync: () => syncButton({ waitForAuth:true })
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once:true });
  } else {
    init();
  }
})();
