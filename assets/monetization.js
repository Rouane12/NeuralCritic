(() => {
  'use strict';

  const cfg = window.NEURAL_CRITIC_MONETIZATION || {};
  const PRIVATE_PAGES = new Set(['studio.html','subscribers.html','newsroom.html']);
  const page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  if (PRIVATE_PAGES.has(page)) return;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  let articleCommercialMeta = null;

  function articleSlug() {
    const staticSlug = String(window.NEURAL_CRITIC_STATIC_SLUG || '').trim();
    if (staticSlug) return staticSlug;
    return new URLSearchParams(location.search).get('slug') || '';
  }

  function commercialKind() {
    return String(articleCommercialMeta?.kind || 'editorial').toLowerCase();
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

  function disclosureBanner(meta) {
    const kind = String(meta?.kind || 'editorial').toLowerCase();
    if (!['affiliate','sponsored'].includes(kind)) return null;
    const banner = document.createElement('aside');
    banner.className = `nc-commercial-disclosure is-${kind}`;
    banner.dataset.ncCommercialDisclosure = kind;
    banner.setAttribute('aria-label', kind === 'sponsored' ? 'Paid partnership disclosure' : 'Affiliate disclosure');

    const strong = document.createElement('strong');
    strong.textContent = kind === 'sponsored'
      ? `PAID PARTNERSHIP${meta.sponsor_name ? ` · ${meta.sponsor_name}` : ''}`
      : 'AFFILIATE DISCLOSURE';
    const copy = document.createElement('span');
    copy.textContent = String(meta.disclosure || '').trim() || (kind === 'affiliate'
      ? 'This article contains affiliate links. Neural Critic may earn a commission from qualifying purchases.'
      : 'This article is sponsored commercial content.');
    const link = document.createElement('a');
    link.href = cfg.disclosureUrl || 'commercial.html';
    link.textContent = 'Commercial policy →';
    banner.append(strong, copy, link);
    return banner;
  }

  async function waitForArticle(timeout = 6000) {
    const started = performance.now();
    while (performance.now() - started < timeout) {
      const root = $('#article');
      if (root?.querySelector('h1')) return root;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return null;
  }

  function publicClient() {
    if (window.neuralCriticPublicSupabase) return window.neuralCriticPublicSupabase;
    const supa = window.NEURAL_CRITIC_SUPABASE;
    if (!supa || !window.supabase) return null;
    try { return window.supabase.createClient(supa.url, supa.publishableKey); }
    catch (_) { return null; }
  }

  async function applyArticleCommercialMeta() {
    if (!cfg.commercialMetaEnabled) return;
    const slug = articleSlug();
    if (!slug) return;
    const client = publicClient();
    if (!client) return;
    const {data, error} = await client.from('articles')
      .select('commercial_meta')
      .eq('slug', slug)
      .eq('status', 'published')
      .lte('published_at', new Date().toISOString())
      .maybeSingle();
    if (error || !data) return;
    const meta = data.commercial_meta && typeof data.commercial_meta === 'object' ? data.commercial_meta : {};
    articleCommercialMeta = meta;
    const kind = commercialKind();
    document.documentElement.dataset.ncCommercialKind = kind;
    if (!['affiliate','sponsored'].includes(kind)) return;

    const article = await waitForArticle();
    if (!article || article.querySelector('[data-nc-commercial-disclosure]')) return;
    article.dataset.commercialKind = kind;
    const banner = disclosureBanner(meta);
    if (!banner) return;
    article.prepend(banner);
    window.NeuralCriticAnalytics?.track?.('commercial_disclosure_rendered', {
      commercial_kind: kind,
      sponsor_present: !!meta.sponsor_name
    });
  }

  function labelSponsoredContent(root = document) {
    root.querySelectorAll?.('[data-commercial-kind="sponsored"]').forEach(node => {
      if (node.querySelector(':scope > .nc-commercial-label') || node.querySelector(':scope > [data-nc-commercial-disclosure]')) return;
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

  function adsConfigured() {
    if (!cfg.adsEnabled || cfg.adProviderReady !== true) return false;
    const provider = String(cfg.adProvider || 'none').toLowerCase();
    if (!provider || provider === 'none') return false;
    if (provider === 'adsense') return /^pub-\d{16}$/.test(String(cfg.publisherId || ''));
    return !!String(cfg.publisherId || '').trim();
  }

  function canServeAds() {
    if (!adsConfigured()) return false;
    if (!cfg.requireConsentPlatform) return true;
    return window.NeuralCriticAdConsent?.canServeAds?.() === true;
  }

  function adSize(slot) {
    const key = String(slot.dataset.adSize || 'leaderboard').toLowerCase();
    if (key === 'rectangle') return '280px';
    if (key === 'mobile') return '110px';
    return '120px';
  }

  function prepareAdSlots(root = document) {
    if (!canServeAds()) return;
    root.querySelectorAll?.('[data-ad-slot]').forEach(slot => {
      if (slot.dataset.ncAdReady === '1') return;
      slot.dataset.ncAdReady = '1';
      slot.classList.add('nc-ad-slot');
      slot.setAttribute('aria-label', 'Advertisement');
      slot.style.setProperty('--nc-ad-reserved-height', adSize(slot));
      if (!slot.querySelector('.nc-ad-label')) slot.insertAdjacentHTML('afterbegin','<small class="nc-ad-label">ADVERTISEMENT</small>');
    });
  }

  function createSlot(name, size) {
    const slot = document.createElement('aside');
    slot.dataset.adSlot = name;
    slot.dataset.adSize = size;
    slot.dataset.adPlacement = name;
    return slot;
  }

  function installPlannedAdSlots() {
    if (!canServeAds()) return;
    const placements = cfg.placements || {};
    if (placements.articleInline && $('#article') && !$('[data-ad-slot="article-inline"]')) {
      const sections = $$('#article .article-body > section, #article .work-reading-grid > .article-body > section');
      const anchor = sections[1] || sections[0];
      if (anchor) anchor.after(createSlot('article-inline','leaderboard'));
    }
    if (placements.articleRail && $('.work-article-sidebar') && !$('[data-ad-slot="article-rail"]')) {
      $('.work-article-sidebar').append(createSlot('article-rail','rectangle'));
    }
    if (placements.homepageFeed && $('#story-feed') && !$('[data-ad-slot="homepage-feed"]')) {
      const stories = $$('#story-feed > .story, #story-feed > a.story');
      const anchor = stories[3] || stories[stories.length - 1];
      if (anchor) anchor.after(createSlot('homepage-feed','leaderboard'));
    }
    prepareAdSlots();
  }

  function trackAdViewability() {
    if (!('IntersectionObserver' in window)) return;
    const seen = new WeakSet();
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting || entry.intersectionRatio < .5 || seen.has(entry.target)) return;
        seen.add(entry.target);
        window.NeuralCriticAnalytics?.track?.('ad_slot_viewable', {
          ad_placement: entry.target.dataset.adPlacement || entry.target.dataset.adSlot || 'unknown'
        });
      });
    }, {threshold:[.5]});
    $$('[data-ad-slot]').forEach(slot => observer.observe(slot));
    setTimeout(() => observer.disconnect(), 60000);
  }

  function observeCommercialMarkup() {
    hardenCommercialLinks();
    labelSponsoredContent();
    ensureDisclosureLink();
    installPlannedAdSlots();
    prepareAdSlots();
    trackAdViewability();
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
        article_slug: articleSlug(),
        commercial_kind: commercialKind()
      });
    }, true);
  }

  window.NeuralCriticMonetization = Object.freeze({
    enabled: adsConfigured,
    canServeAds,
    commercialKind,
    prepareAdSlots,
    hardenCommercialLinks
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observeCommercialMarkup, { once: true });
  else observeCommercialMarkup();
  trackAffiliateClicks();
  applyArticleCommercialMeta().catch(error => console.warn('Neural Critic commercial metadata failed to load.', error));
})();
