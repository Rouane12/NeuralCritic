(() => {
  'use strict';

  const STATUS_SELECTOR = '#studio-auth-status';
  const PUBLISH_SELECTOR = '#publish-story';
  let pendingSlug = '';
  let inFlight = false;

  function statusElement() {
    return document.querySelector(STATUS_SELECTOR);
  }

  function setStatus(message, cls = 'success') {
    const el = statusElement();
    if (!el) return;
    el.textContent = message;
    el.className = `studio-auth-status ${cls}`.trim();
  }

  async function queueCanonicalRefresh(slug) {
    if (inFlight || !slug) return;
    const client = window.neuralCriticSupabase;
    if (!client?.functions?.invoke) return;

    inFlight = true;
    try {
      const { data, error } = await client.functions.invoke('refresh-publication', {
        body: { slug },
      });

      if (error || !data?.ok) {
        console.warn('[Neural Critic] Immediate publication refresh unavailable; scheduled fallback remains active.', error || data);
        setStatus('Published to Neural Critic database. Canonical refresh will use the scheduled fallback.', 'success');
        return;
      }

      setStatus('Published to Neural Critic database. Clean story URL refresh queued.', 'success');
      window.dispatchEvent(new CustomEvent('neuralcritic:publication-refresh-queued', {
        detail: { slug, canonicalUrl: data.canonical_url || '' },
      }));
    } catch (error) {
      console.warn('[Neural Critic] Publication refresh request failed; scheduled fallback remains active.', error);
      setStatus('Published to Neural Critic database. Canonical refresh will use the scheduled fallback.', 'success');
    } finally {
      inFlight = false;
    }
  }

  function wirePublishIntent() {
    const button = document.querySelector(PUBLISH_SELECTOR);
    if (!button || button.dataset.publicationRefreshReady) return;
    button.dataset.publicationRefreshReady = '1';
    button.addEventListener('click', () => {
      pendingSlug = document.querySelector('#slug')?.value?.trim?.() || '';
    });
  }

  function watchBackendPublishSuccess() {
    const el = statusElement();
    if (!el || el.dataset.publicationRefreshWatchReady) return;
    el.dataset.publicationRefreshWatchReady = '1';

    const observer = new MutationObserver(() => {
      const message = String(el.textContent || '').trim();
      if (!pendingSlug || message !== 'Published to Neural Critic database.') return;
      const slug = pendingSlug;
      pendingSlug = '';
      queueCanonicalRefresh(slug);
    });
    observer.observe(el, { childList: true, subtree: true, characterData: true });
  }

  function init() {
    wirePublishIntent();
    watchBackendPublishSuccess();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
