(() => {
  'use strict';

  const canonicalDeskHref = anchor => {
    const raw = String(anchor.getAttribute('href') || '').trim();
    if (!raw) return '';
    let url;
    try { url = new URL(raw, document.baseURI); }
    catch (_) { return ''; }
    if (!url.pathname.endsWith('/category.html') && !url.pathname.endsWith('category.html')) return '';

    const section = String(url.searchParams.get('section') || url.searchParams.get('category') || '').trim().toLowerCase();
    const desk = section === 'review' || section === 'reviews'
      ? 'reviews'
      : section === 'guide' || section === 'guides'
        ? 'guides'
        : '';
    if (!desk) return '';

    const platform = String(url.searchParams.get('platform') || '').trim();
    return `${desk}/${platform ? `?platform=${encodeURIComponent(platform)}` : ''}`;
  };

  const repair = root => {
    root.querySelectorAll?.('a[href*="category.html"]').forEach(anchor => {
      const next = canonicalDeskHref(anchor);
      if (next) anchor.setAttribute('href', next);
    });
  };

  const run = () => repair(document);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once:true });
  else run();

  const observer = new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches?.('a[href*="category.html"]')) {
          const next = canonicalDeskHref(node);
          if (next) node.setAttribute('href', next);
        }
        repair(node);
      }
    }
  });
  observer.observe(document.documentElement, { childList:true, subtree:true });
  window.setTimeout(() => observer.disconnect(), 10000);
})();
