(() => {
  function bootstrapDiscovery() {
    if (!document.querySelector('link[data-nc-discovery]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'assets/discovery-intelligence.css?v=20260828-discovery2';
      link.dataset.ncDiscovery = '1';
      document.head.appendChild(link);
    }

    if (!window.NeuralCriticDiscoveryReady) {
      window.NeuralCriticDiscoveryReady = window.NeuralCriticDiscovery
        ? Promise.resolve(window.NeuralCriticDiscovery)
        : new Promise(resolve => {
            const existing = document.querySelector('script[data-nc-discovery]');
            if (existing) {
              existing.addEventListener('load', () => resolve(window.NeuralCriticDiscovery || null), { once:true });
              existing.addEventListener('error', () => resolve(null), { once:true });
              return;
            }
            const script = document.createElement('script');
            script.src = 'assets/discovery-intelligence.js?v=20260828-discovery2';
            script.dataset.ncDiscovery = '1';
            script.onload = () => resolve(window.NeuralCriticDiscovery || null);
            script.onerror = () => resolve(null);
            document.head.appendChild(script);
          });
    }

    if (document.getElementById('article')) {
      if (!document.querySelector('link[data-nc-recirculation]')) {
        const recirculationStyle = document.createElement('link');
        recirculationStyle.rel = 'stylesheet';
        recirculationStyle.href = 'assets/recirculation.css?v=20260828-discovery2';
        recirculationStyle.dataset.ncRecirculation = '1';
        document.head.appendChild(recirculationStyle);
      }

      window.NeuralCriticDiscoveryReady.then(engine => {
        if (!engine) return;
        if (!document.querySelector('script[data-nc-article-discovery]')) {
          const script = document.createElement('script');
          script.src = 'assets/article-discovery.js?v=20260828-discovery2';
          script.dataset.ncArticleDiscovery = '1';
          document.body.appendChild(script);
        }
        if (!document.querySelector('script[data-nc-recirculation]')) {
          const recirculation = document.createElement('script');
          recirculation.src = 'assets/recirculation.js?v=20260828-discovery2';
          recirculation.dataset.ncRecirculation = '1';
          document.body.appendChild(recirculation);
        }
      });
    }

    if (document.getElementById('hero') && !document.querySelector('script[data-nc-popularity-signals]')) {
      window.NeuralCriticDiscoveryReady.then(engine => {
        if (!engine || document.querySelector('script[data-nc-popularity-signals]')) return;
        const script = document.createElement('script');
        script.src = 'assets/popularity-signals.js?v=20260824-popularity1';
        script.dataset.ncPopularitySignals = '1';
        document.body.appendChild(script);
      });
    }
  }

  bootstrapDiscovery();

  const config = window.NEURAL_CRITIC_SUPABASE;
  if (!config || !window.supabase || !window.fetch) return;

  const nativeFetch = window.fetch.bind(window);
  const client = window.supabase.createClient(config.url, config.publishableKey);
  window.neuralCriticPublicSupabase = client;

  const indexPath = 'data/articles.json';
  const articlePrefix = 'data/articles/';
  const CMS_TIMEOUT_MS = 2200;
  const POPULARITY_DEDUPE_MS = 30 * 60 * 1000;

  function mapRow(row) {
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description || '',
      body: row.body || '',
      category: row.category || 'FEATURE',
      author: row.author_name || 'Rouane Mounssif',
      tags: Array.isArray(row.tags) ? row.tags : [],
      imageAlt: row.image_alt || '',
      imageCredit: row.image_credit || '',
      articleFormat: row.article_format || 'standard',
      reviewMeta: row.review_meta && typeof row.review_meta === 'object' ? row.review_meta : {},
      contentBlocks: Array.isArray(row.content_blocks) ? row.content_blocks : [],
      quickRead: Array.isArray(row.quick_read) ? row.quick_read : [],
      conclusion: row.conclusion || '',
      conclusionHeading: row.conclusion_heading || '',
      conclusionHeadingStyle: row.conclusion_heading_style || 'editorial',
      featured: row.homepage_slot === 'lead',
      homepageSlot: row.homepage_slot || 'regular',
      publishedAt: row.published_at,
      updatedAt: row.updated_at || row.published_at,
      imageLocal: row.image_url || '',
      editorialSection: row.editorial_section || null,
      platforms: Array.isArray(row.platforms) ? row.platforms : [],
      collection: row.collection || null,
      collectionYear: row.collection_year || null,
      gameKey: row.game_key || '',
      series: row.series || '',
      franchise: row.franchise || '',
      newsMeta: row.news_meta && typeof row.news_meta === 'object' ? row.news_meta : {}
    };
  }

  function jsonResponse(payload) {
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'x-neural-critic-source': 'supabase'
      }
    });
  }

  function requestPath(input) {
    try {
      const raw = typeof input === 'string' ? input : input?.url || '';
      const url = new URL(raw, location.href);
      return url.pathname.replace(/^.*\/NeuralCritic\//, '').replace(/^\//, '');
    } catch (_) { return ''; }
  }

  function currentArticleSlug() {
    const staticSlug = String(window.NEURAL_CRITIC_STATIC_SLUG || '').trim();
    if (staticSlug) return staticSlug;
    const querySlug = new URLSearchParams(location.search).get('slug') || '';
    if (querySlug) return querySlug;
    const match = location.pathname.match(/\/NeuralCritic\/stories\/([^/]+)(?:\/index\.html)?\/?$/i);
    if (!match?.[1]) return '';
    try { return decodeURIComponent(match[1]); }
    catch (_) { return match[1]; }
  }

  function withTimeout(promise, ms = CMS_TIMEOUT_MS) {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`CMS read timed out after ${ms}ms`)), ms);
    });
    return Promise.race([Promise.resolve(promise), timeout]).finally(() => clearTimeout(timer));
  }

  async function publishedIndex() {
    const query = client.from('articles').select('*').eq('status', 'published').lte('published_at', new Date().toISOString()).order('published_at', { ascending: false });
    const { data, error } = await withTimeout(query);
    if (error) throw error;
    return (data || []).map(mapRow);
  }

  async function publishedArticle(slug) {
    const query = client.from('articles').select('*').eq('slug', slug).eq('status', 'published').lte('published_at', new Date().toISOString()).maybeSingle();
    const { data, error } = await withTimeout(query);
    if (error) throw error;
    return data ? mapRow(data) : null;
  }

  async function articlePopularity(days = 7) {
    const parsed = Number(days);
    const safeDays = Math.min(30, Math.max(1, Number.isFinite(parsed) ? Math.round(parsed) : 7));
    const { data, error } = await withTimeout(client.rpc('get_article_popularity', { p_days: safeDays }), 3200);
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  }

  async function recordArticleView(slug) {
    const clean = String(slug || '').trim();
    if (!clean) return false;
    const { error } = await withTimeout(client.rpc('record_article_view', { p_slug: clean }), 3200);
    if (error) throw error;
    return true;
  }

  window.NeuralCriticContentAPI = { publishedIndex, publishedArticle, articlePopularity, recordArticleView, nativeFetch };

  function popularitySessionKey(slug) { return `neural-critic-popularity-view:${slug}`; }
  function popularityAlreadyCounted(slug) {
    try {
      const last = Number(sessionStorage.getItem(popularitySessionKey(slug)) || 0);
      return last > 0 && Date.now() - last < POPULARITY_DEDUPE_MS;
    } catch (_) { return false; }
  }
  function markPopularityCounted(slug) {
    try { sessionStorage.setItem(popularitySessionKey(slug), String(Date.now())); }
    catch (_) {}
  }

  function scheduleConsentedPopularityRecord() {
    const slug = currentArticleSlug();
    if (!slug || popularityAlreadyCounted(slug)) return;
    let inFlight = false;
    let finished = false;
    const attempt = async () => {
      if (finished || inFlight || popularityAlreadyCounted(slug)) return;
      if (!window.NeuralCriticAnalytics?.enabled?.()) return;
      inFlight = true;
      try {
        await recordArticleView(slug);
        markPopularityCounted(slug);
        finished = true;
      } catch (error) { console.warn('Neural Critic popularity view was not recorded.', error); }
      finally { inFlight = false; }
    };
    let polls = 0;
    const timer = setInterval(() => {
      polls += 1;
      attempt();
      if (finished || polls >= 80) clearInterval(timer);
    }, 100);
    document.addEventListener('click', event => {
      const target = event.target instanceof Element ? event.target.closest('[data-accept]') : null;
      if (!target) return;
      setTimeout(attempt, 0);
    }, true);
    attempt();
  }

  scheduleConsentedPopularityRecord();

  async function hydrateLiveTicker() {
    try {
      const rows = await publishedIndex();
      const latest = rows[0];
      if (!latest) return;
      const apply = () => {
        const ticker = document.querySelector('.ticker');
        if (!ticker) return false;
        const badge = ticker.querySelector('b');
        const copy = ticker.querySelector('p');
        const status = ticker.querySelector('span');
        if (badge) badge.textContent = 'NEURAL FEED';
        if (copy) {
          const href = `article.html?slug=${encodeURIComponent(latest.slug)}`;
          copy.innerHTML = `<a href="${href}">${String(latest.title || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}</a>`;
        }
        if (status) status.textContent = `${String(latest.category || 'LATEST').toUpperCase()} · LIVE NOW ↗`;
        ticker.dataset.cmsLive = '1';
        return true;
      };
      if (apply()) return;
      const observer = new MutationObserver(() => { if (apply()) observer.disconnect(); });
      observer.observe(document.documentElement, { childList:true, subtree:true });
      setTimeout(() => observer.disconnect(), 5000);
    } catch (error) { console.warn('Neural Critic live feed hydration skipped; keeping fallback ticker.', error); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hydrateLiveTicker, { once:true });
  else hydrateLiveTicker();

  window.fetch = async (...args) => {
    const path = requestPath(args[0]);
    const isIndex = path === indexPath;
    const isArticle = path.startsWith(articlePrefix) && path.endsWith('.json');
    if (!isIndex && !isArticle) return nativeFetch(...args);
    try {
      if (isIndex) {
        const rows = await publishedIndex();
        if (rows.length) return jsonResponse(rows);
      } else {
        const slug = decodeURIComponent(path.slice(articlePrefix.length, -5));
        const article = await publishedArticle(slug);
        if (article) return jsonResponse(article);
      }
    } catch (error) { console.warn('Neural Critic CMS read failed quickly; using static fallback.', error); }
    return nativeFetch(...args);
  };

  function newsletterForm(form) {
    return form.matches('#newsletter-form,#category-newsletter,[data-side-newsletter],[data-newsletter]') || !!form.closest('.newsletter,.category-weekly,.work-weekly-card');
  }
  function newsletterSource() {
    const params = new URLSearchParams(location.search);
    const slug = params.get('slug');
    const category = params.get('category');
    const section = params.get('section');
    const platform = params.get('platform');
    const collection = params.get('collection');
    if (slug) return `article:${slug}`;
    if (section || platform || collection) return `discovery:${section || collection || 'all'}${platform ? `:${platform}` : ''}`;
    if (category) return `category:${category}`;
    if (location.pathname.endsWith('index.html') || location.pathname.endsWith('/')) return 'homepage';
    return location.pathname.split('/').pop() || 'unknown';
  }
  function newsletterMessage(form, message, error=false) {
    let note = form.parentElement?.querySelector('.newsletter-status');
    if (!note) {
      note = document.createElement('p');
      note.className = 'newsletter-status';
      note.style.cssText = 'margin:8px 0 0;font-size:11px;line-height:1.4';
      form.insertAdjacentElement('afterend', note);
    }
    note.dataset.error = error ? '1' : '0';
    note.textContent = message;
    note.style.color = error ? '#ff8fa5' : '#67edbd';
  }

  document.addEventListener('submit', async event => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !newsletterForm(form)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const input = form.querySelector('input[type="email"]');
    const button = form.querySelector('button[type="submit"],button:not([type])');
    const email = input?.value?.trim();
    if (!email) return;
    const source = form.dataset.newsletterSource || newsletterSource();
    const oldText = button?.textContent || 'JOIN FREE';
    if (button) { button.disabled = true; button.textContent = 'JOINING…'; }
    newsletterMessage(form, 'Adding you to the Weekly Drop…');
    try {
      const { error } = await withTimeout(client.rpc('subscribe_newsletter', { p_email: email, p_source: source }), 5000);
      if (error) throw error;
      if (input) { input.value = ''; input.disabled = true; }
      if (button) button.textContent = 'YOU’RE IN ✓';
      window.NeuralCriticAnalytics?.track?.('newsletter_signup', { signup_source: source });
      newsletterMessage(form, 'Weekly Drop confirmed. One email, no noise.');
    } catch (error) {
      if (button) { button.disabled = false; button.textContent = oldText; }
      newsletterMessage(form, error?.message || 'Could not subscribe right now. Try again.', true);
    }
  }, true);
})();
