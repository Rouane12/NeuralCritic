(() => {
  const client = window.neuralCriticSupabase;
  if (!client) return;

  const HYDRATE_KEY = 'neural-critic-studio-backend-hydrated-v1';
  let running = false;
  let finished = false;

  function status(message, cls = 'success') {
    const el = document.getElementById('studio-auth-status');
    if (!el) return;
    el.textContent = message;
    el.className = `studio-auth-status ${cls}`;
  }

  function normalizeSlot(slot) {
    if (slot === 'secondary_1') return 'secondary-bottom';
    if (slot === 'secondary_2') return 'secondary-top';
    if (slot === 'secondary') return 'secondary-top';
    return ['regular', 'lead', 'secondary-top', 'secondary-bottom'].includes(slot) ? slot : 'regular';
  }

  function toRow(article, userId) {
    return {
      slug: article.slug,
      title: article.title,
      description: article.description || '',
      body: article.body || '',
      category: article.category || 'FEATURE',
      author_name: article.author || 'Rouane Mounssif',
      tags: article.tags || [],
      article_format: article.articleFormat || 'standard',
      image_url: article.imageLocal || null,
      image_alt: article.imageAlt || null,
      image_credit: article.imageCredit || null,
      homepage_slot: normalizeSlot(article.homepageSlot),
      content_blocks: article.contentBlocks || [],
      review_meta: article.reviewMeta || {},
      quick_read: article.quickRead || [],
      conclusion: article.conclusion || '',
      status: 'published',
      scheduled_at: null,
      published_at: article.publishedAt || new Date().toISOString(),
      created_by: userId,
      updated_by: userId
    };
  }

  async function seed() {
    if (running || finished) return;
    running = true;
    try {
      const { data: { user } } = await client.auth.getUser();
      if (!user) return;

      const { data: profile, error: profileError } = await client
        .from('editor_profiles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();
      if (profileError || !profile) return;

      const { count, error: countError } = await client
        .from('articles')
        .select('id', { count: 'exact', head: true });
      if (countError) throw countError;
      if ((count || 0) > 0) {
        finished = true;
        return;
      }

      status('Importing the existing Neural Critic library into the database…');
      const index = await fetch('data/articles.json').then(r => {
        if (!r.ok) throw new Error('Could not read the existing article index.');
        return r.json();
      });

      const articles = await Promise.all(index.map(meta =>
        fetch(`data/articles/${encodeURIComponent(meta.slug)}.json`).then(r => {
          if (!r.ok) throw new Error(`Could not import ${meta.slug}.`);
          return r.json();
        })
      ));

      const rows = articles.map(article => toRow(article, user.id));
      const { error: seedError } = await client.from('articles').upsert(rows, { onConflict: 'slug' });
      if (seedError) throw seedError;

      finished = true;
      sessionStorage.removeItem(HYDRATE_KEY);
      status(`${rows.length} published stories imported. The CMS is now the source of truth.`);
    } catch (error) {
      console.error('Neural Critic CMS seed failed', error);
      status(error.message || 'Could not import the existing story library.', 'error');
    } finally {
      running = false;
    }
  }

  setTimeout(seed, 700);
  client.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') setTimeout(seed, 700);
  });
})();
