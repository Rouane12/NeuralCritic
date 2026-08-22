(() => {
  const config = window.NEURAL_CRITIC_SUPABASE;
  if (!config || !window.supabase || !window.fetch) return;

  const nativeFetch = window.fetch.bind(window);
  const client = window.supabase.createClient(config.url, config.publishableKey);
  window.neuralCriticPublicSupabase = client;

  const indexPath = 'data/articles.json';
  const articlePrefix = 'data/articles/';
  const CMS_TIMEOUT_MS = 2200;

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
      featured: row.homepage_slot === 'lead',
      homepageSlot: row.homepage_slot || 'regular',
      publishedAt: row.published_at,
      imageLocal: row.image_url || '',
      editorialSection: row.editorial_section || null,
      platforms: Array.isArray(row.platforms) ? row.platforms : [],
      collection: row.collection || null,
      collectionYear: row.collection_year || null
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
    } catch (_) {
      return '';
    }
  }

  function withTimeout(promise, ms = CMS_TIMEOUT_MS) {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`CMS read timed out after ${ms}ms`)), ms);
    });
    return Promise.race([Promise.resolve(promise), timeout]).finally(() => clearTimeout(timer));
  }

  async function publishedIndex() {
    const query = client
      .from('articles')
      .select('*')
      .eq('status', 'published')
      .lte('published_at', new Date().toISOString())
      .order('published_at', { ascending: false });
    const { data, error } = await withTimeout(query);
    if (error) throw error;
    return (data || []).map(mapRow);
  }

  async function publishedArticle(slug) {
    const query = client
      .from('articles')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'published')
      .lte('published_at', new Date().toISOString())
      .maybeSingle();
    const { data, error } = await withTimeout(query);
    if (error) throw error;
    return data ? mapRow(data) : null;
  }

  window.NeuralCriticContentAPI = { publishedIndex, publishedArticle, nativeFetch };

  /* Keep the top Neural Feed meaningful: it is hydrated from the newest
     published Supabase article rather than behaving like decorative copy. */
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
      const observer = new MutationObserver(() => {
        if (apply()) observer.disconnect();
      });
      observer.observe(document.documentElement, { childList:true, subtree:true });
      setTimeout(() => observer.disconnect(), 5000);
    } catch (error) {
      console.warn('Neural Critic live feed hydration skipped; keeping fallback ticker.', error);
    }
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
    } catch (error) {
      console.warn('Neural Critic CMS read failed quickly; using static fallback.', error);
    }

    return nativeFetch(...args);
  };

  function newsletterForm(form) {
    return form.matches('#newsletter-form,#category-newsletter,[data-side-newsletter],[data-newsletter]') ||
      !!form.closest('.newsletter,.category-weekly,.work-weekly-card');
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

    const oldText = button?.textContent || 'JOIN FREE';
    if (button) { button.disabled = true; button.textContent = 'JOINING…'; }
    newsletterMessage(form, 'Adding you to the Weekly Drop…');

    try {
      const { error } = await withTimeout(client.rpc('subscribe_newsletter', {
        p_email: email,
        p_source: form.dataset.newsletterSource || newsletterSource()
      }), 5000);
      if (error) throw error;
      if (input) { input.value = ''; input.disabled = true; }
      if (button) button.textContent = 'YOU’RE IN ✓';
      newsletterMessage(form, 'Welcome to the Weekly Drop. One email, no noise.');
    } catch (error) {
      if (button) { button.disabled = false; button.textContent = oldText; }
      newsletterMessage(form, error?.message || 'Could not subscribe right now. Try again.', true);
    }
  }, true);
})();