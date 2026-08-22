(() => {
  'use strict';

  const SITE_NAME = 'Neural Critic';
  const DEFAULT_DESCRIPTION = 'Gaming news, reviews, guides, and features for players who want the signal—not the noise.';
  const PRIVATE_PAGES = new Set(['studio.html', 'subscribers.html']);
  const GENERIC_TAGS = new Set(['review','reviews','feature','features','news','guide','guides','pc','playstation','xbox','nintendo','mobile','action rpg','open world']);
  const MEDIA_MARKER = '/media/editorial/';

  const page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const params = new URLSearchParams(location.search);
  const base = new URL('./', location.href);

  function absolute(value) {
    if (!value) return '';
    try { return new URL(value, base).href; } catch (_) { return ''; }
  }

  function seoImage(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw) && raw.includes(MEDIA_MARKER)) {
      const filename = raw.split(MEDIA_MARKER)[1]?.split(/[?#]/)[0];
      if (filename) return absolute(`images/editorial/${decodeURIComponent(filename)}`);
    }
    return absolute(raw);
  }

  function normalizeDate(value) {
    if (!value) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.valueOf()) ? undefined : date.toISOString().slice(0, 10);
  }

  function setMeta(name, content) {
    if (!content) return;
    let node = document.head.querySelector(`meta[name="${name}"]`);
    if (!node) {
      node = document.createElement('meta');
      node.setAttribute('name', name);
      document.head.appendChild(node);
    }
    node.setAttribute('content', String(content));
  }

  function setProperty(property, content) {
    if (!content) return;
    let node = document.head.querySelector(`meta[property="${property}"]`);
    if (!node) {
      node = document.createElement('meta');
      node.setAttribute('property', property);
      document.head.appendChild(node);
    }
    node.setAttribute('content', String(content));
  }

  function setCanonical(href) {
    let node = document.head.querySelector('link[rel="canonical"]');
    if (!node) {
      node = document.createElement('link');
      node.rel = 'canonical';
      document.head.appendChild(node);
    }
    node.href = href;
  }

  function setJsonLd(id, value) {
    let node = document.getElementById(id);
    if (!node) {
      node = document.createElement('script');
      node.id = id;
      node.type = 'application/ld+json';
      document.head.appendChild(node);
    }
    node.textContent = JSON.stringify(value);
  }

  function setSocial({ title, description, canonical, image, type = 'website', imageAlt = '' }) {
    document.title = title;
    setMeta('description', description || DEFAULT_DESCRIPTION);
    setCanonical(canonical);
    setProperty('og:site_name', SITE_NAME);
    setProperty('og:locale', 'en_US');
    setProperty('og:type', type);
    setProperty('og:title', title);
    setProperty('og:description', description || DEFAULT_DESCRIPTION);
    setProperty('og:url', canonical);
    if (image) {
      setProperty('og:image', image);
      if (image.startsWith('https://')) setProperty('og:image:secure_url', image);
      if (imageAlt) setProperty('og:image:alt', imageAlt);
      setMeta('twitter:card', 'summary_large_image');
      setMeta('twitter:image', image);
      if (imageAlt) setMeta('twitter:image:alt', imageAlt);
    } else {
      setMeta('twitter:card', 'summary');
    }
    setMeta('twitter:title', title);
    setMeta('twitter:description', description || DEFAULT_DESCRIPTION);
  }

  function cleanCategory(value) {
    return String(value || '').trim().replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  function gameNameFrom(article) {
    const tags = Array.isArray(article?.tags) ? article.tags : [];
    const tagged = tags.find(tag => tag && !GENERIC_TAGS.has(String(tag).trim().toLowerCase()));
    if (tagged) return String(tagged).trim();
    return String(article?.title || '')
      .replace(/\s+review\s*:.*/i, '')
      .replace(/\s+review$/i, '')
      .trim() || 'Video game';
  }

  function publisher() {
    return {
      '@type': 'Organization',
      name: SITE_NAME,
      url: base.href,
      logo: {
        '@type': 'ImageObject',
        url: absolute('favicon.svg')
      }
    };
  }

  function addArticleTags(tags) {
    document.head.querySelectorAll('meta[property="article:tag"]').forEach(node => node.remove());
    (Array.isArray(tags) ? tags : []).forEach(tag => {
      const node = document.createElement('meta');
      node.setAttribute('property', 'article:tag');
      node.setAttribute('content', String(tag));
      document.head.appendChild(node);
    });
  }

  function articleSchema(article, canonical, image) {
    const common = {
      '@context': 'https://schema.org',
      name: article.title,
      headline: article.title,
      description: article.description || DEFAULT_DESCRIPTION,
      url: canonical,
      inLanguage: 'en',
      isAccessibleForFree: true,
      datePublished: article.publishedAt || undefined,
      author: { '@type': 'Person', name: article.author || 'Rouane Mounssif' },
      publisher: publisher(),
      mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
      image: image ? [image] : undefined,
      thumbnailUrl: image || undefined,
      keywords: Array.isArray(article.tags) ? article.tags.join(', ') : undefined
    };

    if (article.articleFormat === 'review') {
      const meta = article.reviewMeta || {};
      const score = Number(meta.score);
      const pros = Array.isArray(meta.pros) ? meta.pros : [];
      const cons = Array.isArray(meta.cons) ? meta.cons : [];
      const game = {
        '@type': 'VideoGame',
        name: gameNameFrom(article)
      };
      if (meta.developer) game.author = { '@type': 'Organization', name: String(meta.developer) };
      if (meta.publisher) game.publisher = { '@type': 'Organization', name: String(meta.publisher) };
      if (meta.testedPlatform) game.gamePlatform = String(meta.testedPlatform);
      const releaseDate = normalizeDate(meta.releaseDate);
      if (releaseDate) game.datePublished = releaseDate;

      return {
        ...common,
        '@type': 'Review',
        reviewBody: meta.verdict || article.description || '',
        itemReviewed: game,
        reviewRating: Number.isFinite(score) ? {
          '@type': 'Rating',
          ratingValue: score,
          bestRating: 10,
          worstRating: 0
        } : undefined,
        positiveNotes: pros.length ? {
          '@type': 'ItemList',
          itemListElement: pros.map((name, index) => ({ '@type': 'ListItem', position: index + 1, name }))
        } : undefined,
        negativeNotes: cons.length ? {
          '@type': 'ItemList',
          itemListElement: cons.map((name, index) => ({ '@type': 'ListItem', position: index + 1, name }))
        } : undefined
      };
    }

    return {
      ...common,
      '@type': String(article.category || '').toUpperCase() === 'NEWS' ? 'NewsArticle' : 'Article',
      articleSection: article.category || undefined
    };
  }

  function breadcrumbSchema(article, canonical) {
    const category = String(article.category || 'FEATURE').toLowerCase();
    const categoryKey = category === 'review' ? 'reviews' : category === 'guide' ? 'guides' : category === 'news' ? 'news' : 'features';
    const categoryLabel = cleanCategory(categoryKey);
    const categoryUrl = new URL(`category.html?category=${encodeURIComponent(categoryKey)}`, base).href;
    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: SITE_NAME, item: base.href },
        { '@type': 'ListItem', position: 2, name: categoryLabel, item: categoryUrl },
        { '@type': 'ListItem', position: 3, name: article.title, item: canonical }
      ]
    };
  }

  async function waitForContentApi(timeout = 3200) {
    const started = performance.now();
    while (performance.now() - started < timeout) {
      if (window.NeuralCriticContentAPI?.publishedArticle) return window.NeuralCriticContentAPI;
      await new Promise(resolve => setTimeout(resolve, 80));
    }
    return null;
  }

  async function hardenArticle() {
    const slug = params.get('slug');
    if (!slug) {
      setMeta('robots', 'noindex,follow');
      return;
    }

    const canonical = new URL(`article.html?slug=${encodeURIComponent(slug)}`, base).href;
    let article = null;

    try {
      const api = await waitForContentApi();
      if (api) article = await api.publishedArticle(slug);
    } catch (error) {
      console.warn('Neural Critic SEO: live article metadata unavailable.', error);
    }

    if (!article) {
      try {
        const response = await fetch(`data/articles/${encodeURIComponent(slug)}.json`);
        if (response.ok) article = await response.json();
      } catch (_) {}
    }

    if (!article) {
      setMeta('robots', 'noindex,follow');
      setCanonical(canonical);
      return;
    }

    const image = seoImage(article.imageLocal || '');
    const title = `${article.title} · ${SITE_NAME}`;
    setSocial({
      title,
      description: article.description || DEFAULT_DESCRIPTION,
      canonical,
      image,
      type: 'article',
      imageAlt: article.imageAlt || article.title
    });
    setMeta('robots', 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1');
    if (article.publishedAt) setProperty('article:published_time', article.publishedAt);
    if (article.category) setProperty('article:section', article.category);
    if (article.author) setProperty('article:author', article.author);
    addArticleTags(article.tags);
    setJsonLd('nc-structured-data', articleSchema(article, canonical, image));
    setJsonLd('nc-breadcrumb-data', breadcrumbSchema(article, canonical));
  }

  function hardenHome() {
    const canonical = base.href;
    const title = 'Neural Critic | Gaming Reviews, Features & Guides';
    setSocial({ title, description: DEFAULT_DESCRIPTION, canonical });
    setMeta('robots', 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1');
    setJsonLd('nc-structured-data', {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      url: canonical,
      description: DEFAULT_DESCRIPTION,
      publisher: publisher(),
      potentialAction: {
        '@type': 'SearchAction',
        target: `${base.href}search.html?q={search_term_string}`,
        'query-input': 'required name=search_term_string'
      }
    });
  }

  function hardenCategory() {
    const allowed = ['category', 'section', 'platform', 'collection', 'year'];
    const canonicalUrl = new URL('category.html', base);
    allowed.forEach(key => {
      const value = params.get(key);
      if (value) canonicalUrl.searchParams.set(key, value);
    });
    const label = cleanCategory(params.get('collection') || params.get('section') || params.get('category') || params.get('platform') || 'Gaming');
    const title = `${label} | Neural Critic`;
    const description = `${label} stories, reviews, guides, and features from Neural Critic.`;
    setSocial({ title, description, canonical: canonicalUrl.href });
    setMeta('robots', 'index,follow,max-image-preview:large');
    setJsonLd('nc-structured-data', {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: title,
      description,
      url: canonicalUrl.href,
      isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: base.href }
    });
  }

  function hardenAbout() {
    const canonical = new URL('about.html', base).href;
    const title = `About · ${SITE_NAME}`;
    const description = 'Learn about Neural Critic, an independent gaming publication focused on thoughtful features, useful reviews, guides, and player-first editorial.';
    setSocial({ title, description, canonical });
    setMeta('robots', 'index,follow');
    setJsonLd('nc-structured-data', {
      '@context': 'https://schema.org',
      '@type': 'AboutPage',
      name: title,
      description,
      url: canonical,
      isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: base.href }
    });
  }

  function hardenSearch() {
    const q = params.get('q')?.trim();
    document.title = q ? `Search: ${q} · ${SITE_NAME}` : `Search · ${SITE_NAME}`;
    setMeta('description', 'Search Neural Critic stories, reviews, guides, games, platforms, authors, and tags.');
    setMeta('robots', 'noindex,follow');
    setCanonical(new URL('search.html', base).href);
  }

  function hardenPrivate() {
    setMeta('robots', 'noindex,nofollow,noarchive,nosnippet');
  }

  function tuneImage(img) {
    if (!(img instanceof HTMLImageElement)) return;
    img.decoding = 'async';
    const aboveFold = !!img.closest('.lead,.hero,.article-hero-wrap,.work-article-hero') || img.matches('#article > .article-hero');
    if (aboveFold) {
      img.loading = 'eager';
      try { img.fetchPriority = 'high'; } catch (_) {}
    } else if (!img.hasAttribute('loading')) {
      img.loading = 'lazy';
      try { img.fetchPriority = 'low'; } catch (_) {}
    }
  }

  function hardenImages() {
    document.querySelectorAll('img').forEach(tuneImage);
    const observer = new MutationObserver(records => {
      records.forEach(record => record.addedNodes.forEach(node => {
        if (!(node instanceof Element)) return;
        if (node.matches('img')) tuneImage(node);
        node.querySelectorAll?.('img').forEach(tuneImage);
      }));
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 12000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hardenImages, { once: true });
  else hardenImages();

  if (PRIVATE_PAGES.has(page)) {
    hardenPrivate();
    return;
  }
  if (page === 'search.html') {
    hardenSearch();
    return;
  }
  if (page === 'article.html') {
    hardenArticle();
    return;
  }
  if (page === 'category.html') {
    hardenCategory();
    return;
  }
  if (page === 'about.html') {
    hardenAbout();
    return;
  }
  hardenHome();
})();
