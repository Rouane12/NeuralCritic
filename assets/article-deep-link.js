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

  function installNewsSourceCompactStyle() {
    if (document.querySelector('style[data-nc-news-source-compact]')) return;
    const style = document.createElement('style');
    style.dataset.ncNewsSourceCompact = '1';
    style.textContent = `
      #article.nc-news-article .nc-news-source-library{
        width:min(100%,1320px)!important;
        margin:40px auto 28px!important;
        padding:16px 18px 18px!important;
      }
      #article.nc-news-article .nc-news-source-library-intro{margin:13px 1px 16px!important}
      #article.nc-news-article .nc-news-source-document>header{padding:15px 16px!important}
      #article.nc-news-article .nc-news-pdf-viewer{height:clamp(380px,32vw,520px)!important}
      #article.nc-news-article .nc-news-source-library + .work-bottom-grid{margin-top:22px!important}
      @media(max-width:720px){
        #article.nc-news-article .nc-news-source-library{
          width:calc(100% - 20px)!important;
          margin:30px auto 24px!important;
          padding:14px!important;
        }
        #article.nc-news-article .nc-news-pdf-viewer{height:400px!important}
        #article.nc-news-article .nc-news-source-library + .work-bottom-grid{margin-top:16px!important}
      }
    `;
    document.head.appendChild(style);
  }

  function placeNewsSourceLibrary() {
    installNewsSourceCompactStyle();
    const article = document.querySelector('#article');
    const library = article?.querySelector('.nc-news-source-library');
    if (!article || !library) return false;

    // Keep primary documents after the editorial body and immediately before
    // the reader discussion area. Recirculation owns the slot after comments.
    const readingGrid = article.querySelector('.work-reading-grid');
    if (readingGrid) {
      if (readingGrid.nextElementSibling !== library) readingGrid.insertAdjacentElement('afterend', library);
      library.dataset.ncDocumentPlacement = 'article-end-before-thread';
      return true;
    }

    const body = article.querySelector('.article-body');
    if (body) {
      if (body.nextElementSibling !== library) body.insertAdjacentElement('afterend', library);
      library.dataset.ncDocumentPlacement = 'article-end-before-thread';
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
      installNewsSourceCompactStyle();
      placeNewsSourceLibrary();
    }, { once: true });
  } else {
    restoreDeepLink();
    installNewsSourceCompactStyle();
    placeNewsSourceLibrary();
  }

  const article = document.querySelector('#article');
  if (article) {
    const observer = new MutationObserver(placeNewsSourceLibrary);
    observer.observe(article, { childList: true, subtree: true });
  }
  [120, 350, 800, 1600, 3200].forEach(delay => window.setTimeout(placeNewsSourceLibrary, delay));
})();
