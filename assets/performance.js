(() => {
  const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];

  function isCriticalImage(img) {
    return img.matches('#hero .lead img, #article > .article-hero, #article .work-hero-figure > img, #category-spotlight img');
  }

  function isAboveFoldImage(img) {
    return isCriticalImage(img) || !!img.closest('#hero') || img.matches('.work-author-avatar, .category-spotlight img');
  }

  function tuneImage(img) {
    if (!(img instanceof HTMLImageElement) || img.dataset.ncPerf === '1') return;
    img.dataset.ncPerf = '1';
    img.decoding = 'async';

    if (isCriticalImage(img)) {
      img.loading = 'eager';
      img.setAttribute('fetchpriority', 'high');
      return;
    }

    if (isAboveFoldImage(img)) {
      img.loading = 'eager';
      return;
    }

    if (!img.hasAttribute('loading')) img.loading = 'lazy';
  }

  function tuneMedia(root = document) {
    if (root instanceof HTMLImageElement) tuneImage(root);
    qsa('img', root).forEach(tuneImage);

    if (root instanceof HTMLIFrameElement && !root.hasAttribute('loading')) root.loading = 'lazy';
    qsa('iframe', root).forEach(frame => {
      if (!frame.hasAttribute('loading')) frame.loading = 'lazy';
    });
  }

  function init() {
    tuneMedia(document);

    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === 1) tuneMedia(node);
        }
      }
    });

    observer.observe(document.body, {childList: true, subtree: true});
    window.addEventListener('load', () => setTimeout(() => observer.disconnect(), 20000), {once: true});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once: true});
  else init();
})();
