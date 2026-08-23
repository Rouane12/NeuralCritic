(() => {
  'use strict';

  const SITE_ROOT = new URL('/NeuralCritic/', location.origin);
  const checks = new Map();

  function storyFromUrl(value) {
    try {
      const url = new URL(value, location.href);
      if (url.origin !== location.origin) return null;
      const match = url.pathname.match(/\/NeuralCritic\/stories\/([^/]+)\/?$/);
      if (!match) return null;
      return { slug: decodeURIComponent(match[1]), url };
    } catch (_) {
      return null;
    }
  }

  function legacyUrl(slug, hash = '') {
    const url = new URL('article.html', SITE_ROOT);
    url.searchParams.set('slug', slug);
    url.hash = hash || '';
    return url.href;
  }

  function canonicalReady(href) {
    const url = new URL(href, location.href);
    url.hash = '';
    const key = url.href;
    if (checks.has(key)) return checks.get(key);
    const check = fetch(key, {
      method: 'HEAD',
      cache: 'no-store',
      credentials: 'same-origin'
    }).then(response => response.ok).catch(() => false);
    checks.set(key, check);
    return check;
  }

  async function verify(anchor) {
    if (!(anchor instanceof HTMLAnchorElement) || !anchor.dataset.ncCanonicalStory) return;
    const story = storyFromUrl(anchor.href);
    if (!story) return;
    const hash = story.url.hash;
    const ready = await canonicalReady(story.url.href);
    if (!ready && anchor.isConnected) {
      anchor.href = legacyUrl(story.slug, hash);
      anchor.dataset.ncCanonicalPending = '1';
      delete anchor.dataset.ncCanonicalStory;
    }
  }

  function scan(root = document) {
    root.querySelectorAll?.('a[data-nc-canonical-story]').forEach(verify);
    if (root instanceof HTMLAnchorElement && root.dataset.ncCanonicalStory) verify(root);
  }

  document.addEventListener('click', async event => {
    const anchor = event.target.closest?.('a[data-nc-canonical-story]');
    if (!anchor || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const story = storyFromUrl(anchor.href);
    if (!story) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    const ready = await canonicalReady(story.url.href);
    location.assign(ready ? story.url.href : legacyUrl(story.slug, story.url.hash));
  }, true);

  const observer = new MutationObserver(records => {
    records.forEach(record => {
      if (record.type === 'attributes') verify(record.target);
      record.addedNodes.forEach(node => {
        if (node instanceof Element) scan(node);
      });
    });
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['href', 'data-nc-canonical-story']
  });

  scan();
  setTimeout(() => scan(), 250);
  setTimeout(() => scan(), 1200);
})();