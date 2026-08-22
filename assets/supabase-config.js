window.NEURAL_CRITIC_SUPABASE = {
  url: 'https://pchrrwfdcfbytggekuzs.supabase.co',
  publishableKey: 'sb_publishable_T8ObjS3Mab7Do5aCXnP8nA_jvgYkf8T'
};

/* Canonical Neural Critic routing. Query-string article URLs remain supported,
   while generated publication routes use /reviews|features|guides|news/slug/. */
(() => {
  function sectionFor(article = {}) {
    const format = String(article.articleFormat || article.article_format || '').toLowerCase();
    const category = String(article.category || '').toLowerCase();
    if (format === 'review' || category === 'review') return 'reviews';
    if (format === 'game-guide' || category === 'guide') return 'guides';
    if (category === 'news') return 'news';
    return 'features';
  }

  function baseUrl() {
    return new URL('./', document.baseURI || location.href);
  }

  function articleSlug() {
    const query = new URLSearchParams(location.search).get('slug');
    if (query) return query;
    const declared = document.documentElement.dataset.articleSlug || window.NEURAL_CRITIC_STATIC_SLUG;
    if (declared) return declared;
    const match = location.pathname.match(/\/(?:reviews|features|guides|news)\/([^/]+)\/?(?:index\.html)?$/i);
    return match?.[1] ? decodeURIComponent(match[1]) : '';
  }

  function articleHref(article) {
    if (!article?.slug) return 'article.html';
    return new URL(`${sectionFor(article)}/${encodeURIComponent(article.slug)}/`, baseUrl()).href;
  }

  window.NeuralCriticRoutes = { sectionFor, baseUrl, articleSlug, articleHref };
})();

/* Shared public hardening: canonical/social metadata, structured data,
   crawler directives, and lightweight image loading hints. Generated article
   routes already contain crawler-ready metadata in their HTML, so they skip
   the runtime metadata pass. */
(() => {
  if (document.documentElement.dataset.generatedArticle === '1') return;
  if (document.querySelector('script[data-nc-hardening]')) return;
  const script = document.createElement('script');
  script.src = 'assets/public-hardening.js?v=20260822-launch1';
  script.async = true;
  script.dataset.ncHardening = '1';
  document.head.appendChild(script);
})();

/* Progressive route upgrade. Existing renderers can keep producing legacy
   article.html?slug= links; once the published index is available we replace
   them with the canonical publication route without changing CMS behavior. */
(() => {
  const routes = window.NeuralCriticRoutes;
  if (!routes) return;

  async function waitForIndex(timeout = 6000) {
    const started = performance.now();
    while (performance.now() - started < timeout) {
      if (window.NeuralCriticContentAPI?.publishedIndex) {
        try { return await window.NeuralCriticContentAPI.publishedIndex(); }
        catch (_) { return []; }
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return [];
  }

  function slugFromLegacyAnchor(anchor) {
    try {
      const url = new URL(anchor.getAttribute('href') || '', document.baseURI || location.href);
      if (!/\/article\.html$/i.test(url.pathname)) return '';
      return url.searchParams.get('slug') || '';
    } catch (_) { return ''; }
  }

  function rewriteLinks(map, root = document) {
    root.querySelectorAll?.('a[href*="article.html"][href*="slug="]').forEach(anchor => {
      const slug = slugFromLegacyAnchor(anchor);
      const article = map.get(slug);
      if (article) anchor.href = routes.articleHref(article);
    });
  }

  async function init() {
    const articles = await waitForIndex();
    if (!articles.length) return;
    const map = new Map(articles.map(article => [String(article.slug || ''), article]));
    rewriteLinks(map);

    const currentSlug = routes.articleSlug();
    const current = map.get(currentSlug);
    if (current && /\/article\.html$/i.test(location.pathname)) {
      const canonical = routes.articleHref(current);
      let link = document.head.querySelector('link[rel="canonical"]');
      if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.appendChild(link); }
      link.href = canonical;
      const og = document.head.querySelector('meta[property="og:url"]');
      if (og) og.content = canonical;
    }

    const observer = new MutationObserver(records => {
      records.forEach(record => record.addedNodes.forEach(node => {
        if (!(node instanceof Element)) return;
        if (node.matches?.('a[href*="article.html"][href*="slug="]')) rewriteLinks(map, node.parentElement || document);
        else rewriteLinks(map, node);
      }));
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 15000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
