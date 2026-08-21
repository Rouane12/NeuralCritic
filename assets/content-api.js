(() => {
  const config = window.NEURAL_CRITIC_SUPABASE;
  if (!config || !window.supabase || !window.fetch) return;

  const nativeFetch = window.fetch.bind(window);
  const client = window.supabase.createClient(config.url, config.publishableKey);
  window.neuralCriticPublicSupabase = client;

  const indexPath = 'data/articles.json';
  const articlePrefix = 'data/articles/';

  function mapRow(row) {
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description || '',
      body: row.body || '',
      category: row.category || 'FEATURE',
      author: row.author_name || 'Rouane Mounssif',
      tags: row.tags || [],
      imageAlt: row.image_alt || '',
      imageCredit: row.image_credit || '',
      articleFormat: row.article_format || 'standard',
      reviewMeta: row.review_meta || {},
      contentBlocks: row.content_blocks || [],
      quickRead: row.quick_read || [],
      conclusion: row.conclusion || '',
      featured: row.homepage_slot === 'lead',
      homepageSlot: row.homepage_slot || 'regular',
      publishedAt: row.published_at,
      imageLocal: row.image_url || ''
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

  async function publishedIndex() {
    const { data, error } = await client
      .from('articles')
      .select('*')
      .eq('status', 'published')
      .lte('published_at', new Date().toISOString())
      .order('published_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapRow);
  }

  async function publishedArticle(slug) {
    const { data, error } = await client
      .from('articles')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'published')
      .lte('published_at', new Date().toISOString())
      .maybeSingle();
    if (error) throw error;
    return data ? mapRow(data) : null;
  }

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
      console.warn('Neural Critic CMS read failed; using static fallback.', error);
    }

    return nativeFetch(...args);
  };
})();
