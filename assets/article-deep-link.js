(() => {
  const hashValue = () => {
    try { return decodeURIComponent(location.hash.replace(/^#/, '')); }
    catch (_) { return location.hash.replace(/^#/, ''); }
  };

  function targetForHash() {
    const id = hashValue();
    if (!id) return null;
    try { return document.getElementById(id); }
    catch (_) { return null; }
  }

  function alignTarget(target, behavior = 'auto') {
    if (!target) return false;
    target.classList.add('article-deep-link-target');
    target.scrollIntoView({ behavior, block: 'start', inline: 'nearest' });
    window.setTimeout(() => target.classList.remove('article-deep-link-target'), 1800);
    return true;
  }

  function restoreDeepLink({ behavior = 'auto', limit = 70 } = {}) {
    if (!location.hash) return;

    let tries = 0;
    const attempt = () => {
      const target = targetForHash();
      if (target) {
        alignTarget(target, behavior);
        // Re-align once after late layout/enhancement work settles.
        window.setTimeout(() => {
          const current = targetForHash();
          if (current) alignTarget(current, 'auto');
        }, 320);
        return;
      }
      if (++tries < limit) window.setTimeout(attempt, 80);
    };
    attempt();
  }

  function placeNewsSourceLibrary() {
    const article = document.querySelector('#article');
    const library = article?.querySelector('.nc-news-source-library');
    if (!article || !library) return false;

    // Keep primary documents after the editorial body. If the enhanced reading
    // grid already exists, place the source library immediately after it. If it
    // has not been built yet, placing it after .article-body means the later
    // grid wrapper naturally leaves the document library at article end.
    const readingGrid = article.querySelector('.work-reading-grid');
    if (readingGrid) {
      if (readingGrid.nextElementSibling !== library) readingGrid.insertAdjacentElement('afterend', library);
      library.dataset.ncDocumentPlacement = 'article-end';
      return true;
    }

    const body = article.querySelector('.article-body');
    if (body) {
      if (body.nextElementSibling !== library) body.insertAdjacentElement('afterend', library);
      library.dataset.ncDocumentPlacement = 'article-end';
      return true;
    }

    return false;
  }

  window.addEventListener('hashchange', () => restoreDeepLink({ behavior: 'smooth', limit: 30 }));
  window.addEventListener('neuralcritic:article-ready', placeNewsSourceLibrary);
  window.addEventListener('neuralcritic:article-runtime-ready', placeNewsSourceLibrary);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      restoreDeepLink();
      placeNewsSourceLibrary();
    }, { once: true });
  } else {
    restoreDeepLink();
    placeNewsSourceLibrary();
  }

  const article = document.querySelector('#article');
  if (article) {
    const observer = new MutationObserver(placeNewsSourceLibrary);
    observer.observe(article, { childList: true, subtree: true });
  }
  [120, 350, 800, 1600, 3200].forEach(delay => window.setTimeout(placeNewsSourceLibrary, delay));
})();
