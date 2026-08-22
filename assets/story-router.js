(() => {
  'use strict';

  const SITE_ROOT = new URL('/NeuralCritic/', location.origin);
  const STATIC_SLUG = String(window.NEURAL_CRITIC_STATIC_SLUG || '').trim();

  function validSlug(value) {
    return /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(String(value || ''));
  }

  function currentSlug() {
    if (validSlug(STATIC_SLUG)) return STATIC_SLUG;
    const slug = new URLSearchParams(location.search).get('slug') || '';
    return validSlug(slug) ? slug : '';
  }

  function storyUrl(slug, hash = '') {
    if (!validSlug(slug)) return '';
    const url = new URL(`stories/${encodeURIComponent(slug)}/`, SITE_ROOT);
    url.hash = hash || '';
    return url.href;
  }

  function ensureMeta(property, value) {
    if (!value) return;
    let node = document.head.querySelector(`meta[property="${property}"]`);
    if (!node) {
      node = document.createElement('meta');
      node.setAttribute('property', property);
      document.head.appendChild(node);
    }
    node.setAttribute('content', value);
  }

  function enforceCanonical() {
    const slug = currentSlug();
    if (!slug) return '';
    const canonical = storyUrl(slug);
    let link = document.head.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.appendChild(link);
    }
    link.href = canonical;
    ensureMeta('og:url', canonical);
    return canonical;
  }

  function legacySlugFromAnchor(anchor) {
    if (!(anchor instanceof HTMLAnchorElement)) return '';
    try {
      const url = new URL(anchor.getAttribute('href') || '', document.baseURI);
      if (url.origin !== location.origin || !url.pathname.endsWith('/article.html')) return '';
      const slug = url.searchParams.get('slug') || '';
      return validSlug(slug) ? slug : '';
    } catch (_) {
      return '';
    }
  }

  function rewriteAnchor(anchor) {
    const slug = legacySlugFromAnchor(anchor);
    if (!slug) return;
    let hash = '';
    try { hash = new URL(anchor.href, document.baseURI).hash; } catch (_) {}
    anchor.href = storyUrl(slug, hash);
    anchor.dataset.ncCanonicalStory = '1';
  }

  function rewriteArticleLinks(root = document) {
    root.querySelectorAll?.('a[href]').forEach(rewriteAnchor);
  }

  function watchLinks() {
    rewriteArticleLinks();
    const observer = new MutationObserver(records => {
      records.forEach(record => record.addedNodes.forEach(node => {
        if (!(node instanceof Element)) return;
        if (node.matches('a[href]')) rewriteAnchor(node);
        rewriteArticleLinks(node);
      }));
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 20000);
  }

  function bindCanonicalShare() {
    document.addEventListener('click', async event => {
      const button = event.target.closest?.('[data-article-share]');
      if (!button) return;
      const canonical = enforceCanonical();
      if (!canonical) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      try {
        if (navigator.share) {
          await navigator.share({ title: document.title, url: canonical });
        } else {
          await navigator.clipboard.writeText(canonical);
          const small = button.querySelector('small');
          if (small) {
            small.textContent = 'COPIED';
            setTimeout(() => { small.textContent = 'SHARE'; }, 1400);
          }
        }
      } catch (_) {}
    }, true);
  }

  function restoreStaticStoryRoute() {
    if (!validSlug(STATIC_SLUG)) return;
    let restored = false;
    const restore = () => {
      if (restored) return;
      restored = true;
      const target = new URL(storyUrl(STATIC_SLUG));
      target.searchParams.set('slug', STATIC_SLUG);
      target.hash = location.hash;
      history.replaceState(null, '', `${target.pathname}${target.search}${target.hash}`);
      enforceCanonical();
    };

    window.addEventListener('neuralcritic:analytics-script-loaded', restore, { once: true });
    // Local analytics scripts normally initialize almost immediately. This
    // fallback only exists for unusually slow/blocked script loading, and gives
    // analytics enough time to classify the generated shell as an article.
    setTimeout(restore, 8000);
  }

  bindCanonicalShare();
  watchLinks();
  enforceCanonical();
  restoreStaticStoryRoute();
})();
