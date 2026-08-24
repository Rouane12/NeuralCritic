(() => {
  'use strict';

  const qs = (selector, root = document) => root.querySelector(selector);
  const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const FORMAT_CLASSES = ['standard', 'review', 'ranked-list', 'guide'];
  const CONTROLLER_VERSION = 'reading-map-v2';

  let runtimeContext = null;

  function safeFormat(value) {
    const normalized = String(value || 'standard').trim().toLowerCase();
    return FORMAT_CLASSES.includes(normalized) ? normalized : 'standard';
  }

  function currentSlug() {
    const staticSlug = String(window.NEURAL_CRITIC_STATIC_SLUG || '').trim();
    if (staticSlug) return staticSlug;
    return new URLSearchParams(location.search).get('slug') || '';
  }

  function waitFor(test, timeout = 7000) {
    return new Promise(resolve => {
      const immediate = test();
      if (immediate) return resolve(immediate);
      const observer = new MutationObserver(() => {
        const value = test();
        if (!value) return;
        observer.disconnect();
        resolve(value);
      });
      observer.observe(document.documentElement, { childList:true, subtree:true, attributes:true });
      setTimeout(() => {
        observer.disconnect();
        resolve(test() || null);
      }, timeout);
    });
  }

  async function liveArticle(slug) {
    if (!slug) return null;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const api = window.NeuralCriticContentAPI;
      if (api?.publishedArticle) {
        try {
          const article = await api.publishedArticle(slug);
          if (article) return article;
        } catch (_) {}
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 75));
    }
    try {
      const response = await fetch(`data/articles/${encodeURIComponent(slug)}.json`);
      return response.ok ? await response.json() : null;
    } catch (_) {
      return null;
    }
  }

  function slugify(value = '') {
    return String(value)
      .toLowerCase()
      .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'section';
  }

  function articleSections(body) {
    return qsa(':scope > section', body).filter(section => qs(':scope > h2', section));
  }

  function contentSections(body, article) {
    const sections = articleSections(body);
    if (safeFormat(article?.articleFormat) !== 'ranked-list') {
      return sections.filter(section => !section.classList.contains('review-box') && !section.classList.contains('review-details'));
    }
    const ranked = sections.filter(section => section.classList.contains('ranked-card') || qs('.rank-number', section));
    if (ranked.length) return ranked;
    return sections.filter(section => !section.classList.contains('article-conclusion')).slice(0, (article?.contentBlocks || []).length);
  }

  function ensureSectionIds(body) {
    const seen = new Set();
    articleSections(body).forEach((section, index) => {
      if (section.id) {
        seen.add(section.id);
        return;
      }
      const heading = qs(':scope > h2', section)?.textContent || `section-${index + 1}`;
      let id = slugify(heading);
      let suffix = 2;
      while (seen.has(id) || document.getElementById(id)) id = `${slugify(heading)}-${suffix++}`;
      section.id = id;
      seen.add(id);
    });
  }

  function ensureProgress(card, nav) {
    let progress = qs('.work-toc-progress', card);
    if (!progress) {
      progress = document.createElement('div');
      progress.className = 'work-toc-progress';
      progress.innerHTML = '<span></span>';
      nav.insertAdjacentElement('beforebegin', progress);
    }
    return qs('span', progress);
  }

  function decodeLinkId(link) {
    const raw = link?.getAttribute?.('href') || link?.hash || '';
    try { return decodeURIComponent(raw.replace(/^#/, '')); }
    catch (_) { return raw.replace(/^#/, ''); }
  }

  function ensureUniversalLinks(nav, body) {
    const sections = articleSections(body);
    let links = qsa('a[href^="#"]', nav);
    if (links.length === sections.length && links.every(link => document.getElementById(decodeLinkId(link)))) return links;

    nav.innerHTML = sections.map(section => {
      const heading = qs(':scope > h2', section)?.textContent?.trim() || 'Section';
      const label = heading.replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
      return `<a href="#${encodeURIComponent(section.id)}">${label}</a>`;
    }).join('');
    return qsa('a[href^="#"]', nav);
  }

  function normalizeRankedMap(article, body, nav, links) {
    if (safeFormat(article?.articleFormat) !== 'ranked-list') {
      nav.classList.remove('ranked-toc');
      return;
    }

    nav.classList.add('ranked-toc');
    const blocks = Array.isArray(article.contentBlocks) ? article.contentBlocks : [];
    const rankedSections = contentSections(body, article);

    rankedSections.forEach((section, index) => {
      const block = blocks[index] || {};
      const rank = String(block.rank || section.dataset.rank || qs('.rank-number', section)?.textContent || (blocks.length - index)).replace(/^#/, '').trim();
      if (rank) section.dataset.rank = rank;
      const heading = qs(':scope > h2', section)?.textContent?.trim();
      const link = links.find(item => decodeLinkId(item) === section.id) || links[index];
      if (!link) return;
      if (heading) link.textContent = heading;
      link.dataset.rankLabel = rank ? `#${rank}` : '';
      link.classList.remove('toc-conclusion');
    });

    const conclusion = qs(':scope > .article-conclusion', body);
    if (conclusion) {
      const link = links.find(item => decodeLinkId(item) === conclusion.id);
      if (link) {
        link.dataset.rankLabel = 'END';
        link.classList.add('toc-conclusion');
      }
    }
  }

  function activate(nav, id) {
    if (!nav || !id) return;
    qsa('a[href^="#"]', nav).forEach(link => {
      const active = decodeLinkId(link) === id;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }

  function scrollToTarget(target, behavior = reduceMotion ? 'auto' : 'smooth') {
    if (!target) return false;
    const top = window.scrollY + target.getBoundingClientRect().top - 86;
    window.scrollTo({ top:Math.max(0, top), behavior });
    return true;
  }

  function replaceHash(id) {
    if (!id) return;
    try {
      history.replaceState(history.state, '', `${location.pathname}${location.search}#${encodeURIComponent(id)}`);
    } catch (_) {}
  }

  function navigationForLink(link) {
    const nav = link?.closest?.('.work-toc nav');
    if (!nav) return null;
    const id = decodeLinkId(link);
    const target = id ? document.getElementById(id) : null;
    return target ? { nav, id, target } : null;
  }

  // Bind the authoritative click owner immediately, before article rendering or
  // legacy sidebar enhancers can attach. Hash changes are written with
  // replaceState, so section navigation never causes a document navigation or
  // hashchange-driven second scroll.
  function authoritativeClick(event) {
    if (event.defaultPrevented || event.button > 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target?.closest?.('#article .work-toc a[href^="#"]');
    if (!link) return;
    const destination = navigationForLink(link);
    if (!destination) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    scrollToTarget(destination.target);
    activate(destination.nav, destination.id);
    replaceHash(destination.id);
    runtimeContext?.sync?.();
  }

  document.addEventListener('click', authoritativeClick, true);
  window.NeuralCriticReadingMapController = Object.freeze({
    version: CONTROLLER_VERSION,
    navigate(id, behavior = reduceMotion ? 'auto' : 'smooth') {
      const target = id ? document.getElementById(id) : null;
      const nav = qs('#article .work-toc nav');
      if (!target || !nav) return false;
      scrollToTarget(target, behavior);
      activate(nav, id);
      replaceHash(id);
      return true;
    },
    sync() { runtimeContext?.sync?.(); }
  });

  function activeSectionForViewport(sections) {
    if (!sections.length) return null;
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) return sections[sections.length - 1];

    // Probe the upper-middle reading lane rather than relying on IntersectionObserver.
    // This stays stable with Neural Critic's desktop CSS zoom and while large ranked
    // cards enter/leave the viewport.
    const probe = Math.max(140, Math.min(360, window.innerHeight * .42));
    const rects = sections.map(section => ({ section, rect:section.getBoundingClientRect() }));
    const containing = rects.find(item => item.rect.top <= probe && item.rect.bottom > probe);
    if (containing) return containing.section;

    return rects.reduce((best, item) => {
      const distance = Math.abs(item.rect.top - probe);
      return !best || distance < best.distance ? { section:item.section, distance } : best;
    }, null)?.section || sections[0];
  }

  function bindNavigation(card, nav, body) {
    if (nav.dataset.runtimeNavigation === 'ready') return;
    nav.dataset.runtimeNavigation = 'ready';
    nav.dataset.navigationOwner = CONTROLLER_VERSION;

    const progress = ensureProgress(card, nav);
    let ticking = false;

    const sync = () => {
      ticking = false;
      const links = qsa('a[href^="#"]', nav);
      const sections = links.map(link => document.getElementById(decodeLinkId(link))).filter(Boolean);
      const active = activeSectionForViewport(sections);
      if (active) activate(nav, active.id);

      const rect = body.getBoundingClientRect();
      const start = window.scrollY + rect.top - window.innerHeight * .2;
      const end = start + Math.max(1, body.scrollHeight - window.innerHeight * .55);
      const value = Math.max(0, Math.min(1, (window.scrollY - start) / (end - start)));
      if (progress) progress.style.transform = `scaleX(${value})`;
    };

    const requestSync = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(sync);
    };

    window.addEventListener('scroll', requestSync, { passive:true });
    window.addEventListener('resize', requestSync, { passive:true });
    runtimeContext = { nav, body, sync:requestSync };
    sync();
  }

  function validateContract(article, host, body, nav, links) {
    const format = safeFormat(article?.articleFormat);
    const failures = [];
    if (!qs(':scope > .work-reading-grid', host)) failures.push('reading-layout');
    if (!nav || !links.length) failures.push('reading-map');

    if (format === 'ranked-list') {
      const blocks = Array.isArray(article.contentBlocks) ? article.contentBlocks : [];
      const ranked = contentSections(body, article);
      if (ranked.length !== blocks.length) failures.push('ranked-card-count');
      const labels = links.filter(link => !link.classList.contains('toc-conclusion')).map(link => link.dataset.rankLabel || '');
      if (blocks.length && labels.slice(0, blocks.length).some(label => !/^#\S+/.test(label))) failures.push('rank-labels');
    }

    if (format === 'review' && article.reviewMeta && !qs('.review-box', body)) failures.push('review-box');

    host.dataset.runtimeState = failures.length ? 'degraded' : 'ready';
    host.dataset.runtimeChecks = failures.length ? failures.join(',') : 'passed';
    return failures;
  }

  async function init() {
    const slug = currentSlug();
    if (!slug || !qs('#article')) return;

    const [article, body] = await Promise.all([
      liveArticle(slug),
      waitFor(() => qs('#article .article-body')),
    ]);
    if (!article || !body) return;

    const host = qs('#article');
    const format = safeFormat(article.articleFormat);
    host.dataset.articleFormat = format;
    FORMAT_CLASSES.forEach(name => host.classList.toggle(`article-format-${name}`, name === format));
    host.classList.toggle('ranked-list-page', format === 'ranked-list');

    ensureSectionIds(body);

    const nav = await waitFor(() => qs('#article .work-toc nav'));
    const card = nav?.closest('.work-toc');
    if (!nav || !card) {
      host.dataset.runtimeState = 'degraded';
      host.dataset.runtimeChecks = 'reading-map';
      window.dispatchEvent(new CustomEvent('neuralcritic:article-ready', { detail:{ slug, format, state:'degraded', failures:['reading-map'] } }));
      return;
    }

    let links = ensureUniversalLinks(nav, body);
    normalizeRankedMap(article, body, nav, links);

    // Legacy format enhancers may finish a fraction later. Reconcile once more
    // against the live CMS record before binding the authoritative scroll state.
    await new Promise(resolve => setTimeout(resolve, 120));
    ensureSectionIds(body);
    links = ensureUniversalLinks(nav, body);
    normalizeRankedMap(article, body, nav, links);
    bindNavigation(card, nav, body);

    // Late conclusion/format decoration should never leave the Reading Map stale.
    let reconcileQueued = false;
    const reconcile = () => {
      if (reconcileQueued) return;
      reconcileQueued = true;
      requestAnimationFrame(() => {
        reconcileQueued = false;
        ensureSectionIds(body);
        const liveLinks = ensureUniversalLinks(nav, body);
        normalizeRankedMap(article, body, nav, liveLinks);
        runtimeContext?.sync?.();
      });
    };
    const mutationObserver = new MutationObserver(reconcile);
    mutationObserver.observe(body, { childList:true, subtree:true });
    setTimeout(() => mutationObserver.disconnect(), 12000);

    const failures = validateContract(article, host, body, nav, qsa('a[href^="#"]', nav));
    const state = failures.length ? 'degraded' : 'ready';
    window.NeuralCriticArticleRuntime = { slug, format, state, failures, article, readingMapController:CONTROLLER_VERSION };
    window.dispatchEvent(new CustomEvent('neuralcritic:article-ready', { detail:{ slug, format, state, failures } }));
    window.dispatchEvent(new CustomEvent('neuralcritic:article-runtime-ready', { detail:{ slug, format, state, failures } }));

    if (failures.length) console.warn('Neural Critic article runtime contract degraded:', failures);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();
})();
