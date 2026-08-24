(() => {
  'use strict';

  const qs = (selector, root = document) => root.querySelector(selector);
  const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const FORMAT_CLASSES = ['standard', 'review', 'ranked-list', 'guide'];

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
    try { return decodeURIComponent((link.hash || '').replace(/^#/, '')); }
    catch (_) { return (link.hash || '').replace(/^#/, ''); }
  }

  function ensureUniversalLinks(nav, body) {
    const sections = articleSections(body);
    let links = qsa('a[href^="#"]', nav);
    if (links.length === sections.length && links.every(link => document.getElementById(decodeLinkId(link)))) return links;

    nav.innerHTML = sections.map(section => {
      const heading = qs(':scope > h2', section)?.textContent?.trim() || 'Section';
      return `<a href="#${encodeURIComponent(section.id)}">${heading.replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}</a>`;
    }).join('');
    links = qsa('a[href^="#"]', nav);
    return links;
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

  function bindNavigation(card, nav, links, body) {
    if (nav.dataset.runtimeNavigation === 'ready') return;
    nav.dataset.runtimeNavigation = 'ready';

    const liveLinks = () => qsa('a[href^="#"]', nav);
    const activate = id => {
      liveLinks().forEach(link => link.classList.toggle('active', decodeLinkId(link) === id));
    };

    nav.addEventListener('click', event => {
      const link = event.target.closest('a[href^="#"]');
      if (!link || !nav.contains(link)) return;
      const id = decodeLinkId(link);
      const target = id ? document.getElementById(id) : null;
      if (!target) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const top = window.scrollY + target.getBoundingClientRect().top - 86;
      window.scrollTo({ top:Math.max(0, top), behavior:reduceMotion ? 'auto' : 'smooth' });
      activate(id);
      try {
        history.replaceState(history.state, '', `${location.pathname}${location.search}#${encodeURIComponent(id)}`);
      } catch (_) {}
    }, true);

    const sections = links.map(link => document.getElementById(decodeLinkId(link))).filter(Boolean);
    if ('IntersectionObserver' in window && sections.length) {
      const observer = new IntersectionObserver(entries => {
        const visible = entries
          .filter(entry => entry.isIntersecting)
          .sort((a, b) => Math.abs(a.boundingClientRect.top - 100) - Math.abs(b.boundingClientRect.top - 100));
        if (visible[0]) activate(visible[0].target.id);
      }, { rootMargin:'-12% 0px -68% 0px', threshold:0 });
      sections.forEach(section => observer.observe(section));
    }

    const progress = ensureProgress(card, nav);
    let ticking = false;
    const updateProgress = () => {
      ticking = false;
      const rect = body.getBoundingClientRect();
      const start = window.scrollY + rect.top - window.innerHeight * .2;
      const end = start + Math.max(1, body.scrollHeight - window.innerHeight * .55);
      const value = Math.max(0, Math.min(1, (window.scrollY - start) / (end - start)));
      if (progress) progress.style.transform = `scaleX(${value})`;
    };
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(updateProgress);
    }, { passive:true });
    window.addEventListener('resize', updateProgress, { passive:true });
    updateProgress();
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
    // against the live CMS record before binding the authoritative interactions.
    await new Promise(resolve => setTimeout(resolve, 120));
    ensureSectionIds(body);
    links = ensureUniversalLinks(nav, body);
    normalizeRankedMap(article, body, nav, links);
    bindNavigation(card, nav, links, body);

    const failures = validateContract(article, host, body, nav, links);
    const state = failures.length ? 'degraded' : 'ready';
    window.NeuralCriticArticleRuntime = { slug, format, state, failures, article };
    window.dispatchEvent(new CustomEvent('neuralcritic:article-ready', { detail:{ slug, format, state, failures } }));
    window.dispatchEvent(new CustomEvent('neuralcritic:article-runtime-ready', { detail:{ slug, format, state, failures } }));

    if (failures.length) console.warn('Neural Critic article runtime contract degraded:', failures);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();
})();
