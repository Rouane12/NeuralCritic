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

  const homeMarkSvg = `
    <svg viewBox="0 0 256 256" width="30" height="30" aria-hidden="true" focusable="false" style="display:block;width:30px;height:30px;max-width:30px;max-height:30px;overflow:visible">
      <g stroke-linejoin="round" stroke-linecap="round">
        <path d="M24 60 Q24 48 38 48 H91 L128 94 V205 L94 164 V210 L68 232 V194 H38 Q24 194 24 180 Z" fill="#ffffff" stroke="#7f8996" stroke-width="3"/>
        <path d="M128 54 H202 Q230 54 230 82 V98 H166 Q146 98 146 118 V138 Q146 158 166 158 H230 V174 Q230 202 202 202 H128 Z" fill="#19bfd8"/>
        <path d="M53 111 H69 V95 H85 V111 H101 V127 H85 V143 H69 V127 H53 Z" fill="#171b22"/>
        <circle cx="183" cy="118" r="10" fill="#171b22"/>
        <circle cx="205" cy="132" r="10" fill="#171b22"/>
        <circle cx="183" cy="146" r="10" fill="#171b22"/>
        <circle cx="161" cy="132" r="10" fill="#171b22"/>
        <path d="M128 20 V43 M98 31 L113 48 M158 31 L143 48" fill="none" stroke="#19bfd8" stroke-width="10"/>
      </g>
    </svg>`;

  const installHomeMark = root => {
    const brand = root.querySelector?.('header .brand') || (root.matches?.('header .brand') ? root : null);
    if (!brand || brand.querySelector('.nc-home-mark')) return;

    const mark = document.createElement('span');
    mark.className = 'nc-home-mark';
    mark.setAttribute('aria-hidden', 'true');
    mark.style.cssText = 'display:inline-flex;width:30px;height:30px;min-width:30px;min-height:30px;max-width:30px;max-height:30px;align-items:center;justify-content:center;overflow:visible;line-height:0;flex:0 0 30px;';
    mark.innerHTML = homeMarkSvg;

    const tagline = brand.querySelector('em');
    if (tagline) brand.insertBefore(mark, tagline);
    else brand.appendChild(mark);
  };

  const repair = root => {
    root.querySelectorAll?.('a[href*="category.html"]').forEach(anchor => {
      const next = canonicalDeskHref(anchor);
      if (next) anchor.setAttribute('href', next);
    });
    installHomeMark(root);
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
