(() => {
  'use strict';

  const page = document.querySelector('.category-work-page');
  const host = document.getElementById('category-trending');
  if (!page || !host) return;

  const esc = (value='') => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const sectionNames = {news:'News',reviews:'Reviews',guides:'Guides','what-to-play':'What to Play',features:'Features'};
  const href = article => `article.html?slug=${encodeURIComponent(article.slug)}`;
  let selectedStories = [];
  let rendering = false;

  function inferSection(article){
    if (article.editorialSection) return article.editorialSection;
    const category = String(article.category || '').toLowerCase();
    const format = String(article.articleFormat || '').toLowerCase();
    if (format === 'review' || category === 'review') return 'reviews';
    if (format === 'game-guide' || category === 'guide') return 'guides';
    if (category === 'news') return 'news';
    return 'features';
  }

  function mapRow(row){
    return {
      slug: row.slug,
      title: row.title,
      category: row.category || 'FEATURE',
      articleFormat: row.article_format || row.articleFormat || 'standard',
      editorialSection: row.editorial_section || row.editorialSection || null,
      imageLocal: row.image_url || row.imageLocal || '',
      imageAlt: row.image_alt || row.imageAlt || '',
      publishedAt: row.published_at || row.publishedAt || null
    };
  }

  function fmtDate(iso){
    if (!iso) return '';
    try {
      return new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(iso));
    } catch (_) {
      return '';
    }
  }

  function currentStorySlugs(){
    const slugs = new Set();
    document.querySelectorAll('#category-spotlight a[href*="slug="],#category-feed a[href*="slug="]').forEach(link => {
      try {
        const url = new URL(link.href, location.href);
        const slug = url.searchParams.get('slug');
        if (slug) slugs.add(slug);
      } catch (_) {}
    });
    return slugs;
  }

  async function loadArticles(){
    const client = window.neuralCriticPublicSupabase;
    if (client) {
      const { data, error } = await client
        .from('articles')
        .select('slug,title,category,article_format,editorial_section,image_url,image_alt,published_at,status')
        .eq('status','published')
        .lte('published_at',new Date().toISOString())
        .order('published_at',{ascending:false});
      if (!error) return (data || []).map(mapRow);
    }

    try {
      const data = await fetch('data/articles.json',{cache:'no-store'}).then(response => response.ok ? response.json() : []);
      return (data || []).map(mapRow);
    } catch (_) {
      return [];
    }
  }

  function pickAcrossStories(all){
    const params = new URLSearchParams(location.search);
    const currentSection = params.get('section');
    const alreadyVisible = currentStorySlugs();
    const withImages = all.filter(article => article.imageLocal && !alreadyVisible.has(article.slug));
    const fallbackPool = all.filter(article => article.imageLocal);
    const pool = withImages.length >= 3 ? withImages : fallbackPool;
    const selected = [];
    const seenSections = new Set();

    for (const article of pool) {
      const section = inferSection(article);
      if (section === currentSection || seenSections.has(section)) continue;
      selected.push(article);
      seenSections.add(section);
      if (selected.length === 3) return selected;
    }

    for (const article of pool) {
      if (selected.some(item => item.slug === article.slug)) continue;
      selected.push(article);
      if (selected.length === 3) break;
    }

    return selected;
  }

  function render(stories){
    if (!stories.length) return;
    const card = host.closest('.category-side-card');
    if (card) card.classList.add('category-explore-card');
    rendering = true;
    host.innerHTML = stories.map(article => {
      const section = sectionNames[inferSection(article)] || article.category || 'Story';
      return `<a class="category-explore-story" href="${href(article)}">
        <span class="category-explore-media"><img src="${esc(article.imageLocal)}" alt="${esc(article.imageAlt || article.title)}" loading="lazy"></span>
        <span class="category-explore-copy">
          <small>${esc(section)}</small>
          <strong>${esc(article.title)}</strong>
          <small>${esc(fmtDate(article.publishedAt))}</small>
        </span>
      </a>`;
    }).join('');
    rendering = false;
  }

  function keepEnhancedMarkup(){
    const observer = new MutationObserver(() => {
      if (rendering || !selectedStories.length) return;
      if (!host.querySelector('.category-explore-story')) render(selectedStories);
    });
    observer.observe(host,{childList:true});
    setTimeout(() => {
      if (selectedStories.length && !host.querySelector('.category-explore-story')) render(selectedStories);
    },1200);
  }

  async function init(){
    keepEnhancedMarkup();
    try {
      const all = await loadArticles();
      all.sort((a,b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
      selectedStories = pickAcrossStories(all);
      render(selectedStories);
    } catch (_) {}
  }

  init();
})();
