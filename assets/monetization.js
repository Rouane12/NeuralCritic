(() => {
  'use strict';

  const cfg = window.NEURAL_CRITIC_MONETIZATION || {};
  const PRIVATE_PAGES = new Set(['studio.html','subscribers.html']);
  const page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  if (PRIVATE_PAGES.has(page)) return;

  const $ = (selector, root = document) => root.querySelector(selector);

  function articleSlug() {
    const staticSlug = String(window.NEURAL_CRITIC_STATIC_SLUG || '').trim();
    if (staticSlug) return staticSlug;
    return new URLSearchParams(location.search).get('slug') || '';
  }

  function placementFor(link) {
    return link.dataset.affiliatePlacement ||
      (link.closest('#article') ? 'article' : link.closest('footer') ? 'footer' : link.closest('header') ? 'header' : 'site');
  }

  function hardenCommercialLink(link) {
    if (!(link instanceof HTMLAnchorElement)) return;
    const markedAffiliate = link.dataset.affiliate === 'true' || link.relList.contains('sponsored');
    if (!markedAffiliate) return;

    const rel = new Set(String(link.getAttribute('rel') || '').split(/\s+/).filter(Boolean));
    rel.add('sponsored');
    rel.add('noopener');
    rel.add('noreferrer');
    link.setAttribute('rel', [...rel].join(' '));
    link.dataset.ncCommercialLink = '1';
  }

  function hardenCommercialLinks(root = document) {
    root.querySelectorAll?.('a[data-affiliate="true"],a[rel~="sponsored"]').forEach(hardenCommercialLink);
  }

  function labelSponsoredContent(root = document) {
    root.querySelectorAll?.('[data-commercial-kind="sponsored"]').forEach(node => {
      if (node.querySelector(':scope > .nc-commercial-label')) return;
      const label = document.createElement('div');
      label.className = 'nc-commercial-label';
      label.innerHTML = `<strong>SPONSORED</strong><span>Paid commercial content · <a href="${cfg.disclosureUrl || 'commercial.html'}">How Neural Critic handles commercial relationships</a></span>`;
      node.prepend(label);
    });
  }

  function ensureDisclosureLink() {
    const footer = $('footer .footer');
    if (!footer || footer.querySelector('a[data-commercial-disclosure-link]')) return;
    const aboutColumn = [...footer.children].find(column => column.querySelector?.('a[href="standards.html"]'));
    if (!aboutColumn) return;
    const link = document.createElement('a');
    link.href = cfg.disclosureUrl || 'commercial.html';
    link.textContent = 'Commercial disclosure';
    link.dataset.commercialDisclosureLink = '1';
    const privacy = aboutColumn.querySelector('a[href="privacy.html"]');
    if (privacy) aboutColumn.insertBefore(link, privacy);
    else aboutColumn.appendChild(link);
  }

  function adSize(slot) {
    const key = String(slot.dataset.adSize || 'leaderboard').toLowerCase();
    if (key === 'rectangle') return '250px';
    if (key === 'mobile') return '100px';
    return '110px';
  }

  function prepareAdSlots(root = document) {
    if (!cfg.adsEnabled) return;
    root.querySelectorAll?.('[data-ad-slot]').forEach(slot => {
      if (slot.dataset.ncAdReady === '1') return;
      slot.dataset.ncAdReady = '1';
      slot.classList.add('nc-ad-slot');
      slot.setAttribute('aria-label', 'Advertisement');
      slot.style.setProperty('--nc-ad-reserved-height', adSize(slot));
      if (!slot.querySelector('.nc-ad-label')) slot.insertAdjacentHTML('afterbegin','<small class="nc-ad-label">ADVERTISEMENT</small>');
    });
  }

  function observeCommercialMarkup() {
    hardenCommercialLinks();
    labelSponsoredContent();
    prepareAdSlots();
    ensureDisclosureLink();
    const observer = new MutationObserver(records => {
      ensureDisclosureLink();
      records.forEach(record => record.addedNodes.forEach(node => {
        if (!(node instanceof Element)) return;
        if (node.matches('a[data-affiliate="true"],a[rel~="sponsored"]')) hardenCommercialLink(node);
        hardenCommercialLinks(node);
        labelSponsoredContent(node);
        prepareAdSlots(node);
      }));
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 20000);
  }

  function trackAffiliateClicks() {
    if (!cfg.affiliateTrackingEnabled) return;
    document.addEventListener('click', event => {
      const link = event.target.closest?.('a[data-nc-commercial-link="1"]');
      if (!link) return;
      let host = '';
      try { host = new URL(link.href, location.href).hostname; } catch (_) {}
      window.NeuralCriticAnalytics?.track?.('affiliate_click', {
        destination_host: host,
        placement: placementFor(link),
        article_slug: articleSlug()
      });
    }, true);
  }

  window.NeuralCriticMonetization = Object.freeze({
    enabled: () => !!cfg.adsEnabled,
    prepareAdSlots,
    hardenCommercialLinks
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observeCommercialMarkup, { once: true });
  else observeCommercialMarkup();
  trackAffiliateClicks();
})();
