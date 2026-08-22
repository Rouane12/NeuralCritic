(() => {
  const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];

  function installUiRegressionGuards() {
    if (document.getElementById('nc-ui-regression-guards')) return;
    const style = document.createElement('style');
    style.id = 'nc-ui-regression-guards';
    style.textContent = `
      /* Keep homepage review scores such as 9.5 on one line. */
      .review-showcase-score{min-width:84px!important;overflow:visible!important}
      .review-showcase-score b{
        display:block!important;
        width:max-content!important;
        max-width:none!important;
        white-space:nowrap!important;
        word-break:normal!important;
        overflow-wrap:normal!important;
        hyphens:none!important;
      }

      /* The stable Reader Thread owns identity/account UI. Hide the retired
         identity shell, and collapse the composer to one clean sign-in notice
         while the reader is signed out. */
      #reader-thread.standard-thread .thread-identity{display:none!important}
      #reader-thread.standard-thread form[data-thread-form]:has(> .community-login-note){
        display:block!important;
        min-height:0!important;
        height:auto!important;
        margin-bottom:21px!important;
        padding:0!important;
        border:0!important;
        background:transparent!important;
      }
      #reader-thread.standard-thread form[data-thread-form]:has(> .community-login-note) > *:not(.community-login-note){
        display:none!important;
      }
      #reader-thread.standard-thread form[data-thread-form] > .community-login-note{
        box-sizing:border-box!important;
        width:100%!important;
        min-height:52px!important;
        margin:0!important;
        display:flex!important;
        align-items:center!important;
        gap:10px!important;
      }
    `;
    document.head.appendChild(style);
  }

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
    installUiRegressionGuards();
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
