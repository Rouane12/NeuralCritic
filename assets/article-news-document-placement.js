(() => {
  'use strict';

  const placeSourceLibrary = () => {
    const article = document.querySelector('#article');
    const library = article?.querySelector('.nc-news-source-library');
    if (!article || !library) return false;

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
  };

  const article = document.querySelector('#article');
  if (!article) return;

  const observer = new MutationObserver(() => placeSourceLibrary());
  observer.observe(article, { childList: true, subtree: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', placeSourceLibrary, { once: true });
  } else {
    placeSourceLibrary();
  }

  window.addEventListener('neuralcritic:article-ready', placeSourceLibrary);
  window.addEventListener('neuralcritic:article-runtime-ready', placeSourceLibrary);
  [120, 350, 800, 1600, 3200].forEach(delay => setTimeout(placeSourceLibrary, delay));
})();
