(() => {
  'use strict';

  const esc = (value='') => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const slug = () => window.NEURAL_CRITIC_STATIC_SLUG || new URLSearchParams(location.search).get('slug') || '';

  async function waitForEngine(limit=60) {
    for (let i=0;i<limit;i++) {
      if (window.NeuralCriticDiscovery) return window.NeuralCriticDiscovery;
      await new Promise(resolve=>setTimeout(resolve,75));
    }
    return null;
  }

  async function waitForArticleHost(limit=80) {
    for (let i=0;i<limit;i++) {
      const host=document.getElementById('article');
      if (host?.querySelector('h1') && !host.querySelector('.article-loading-state')) return host;
      await new Promise(resolve=>setTimeout(resolve,75));
    }
    return document.getElementById('article');
  }

  function graphLinks(article, engine) {
    const links=[];
    const seen=new Set();
    const add=(type,name) => {
      const key=engine.normalize(name || '');
      if (!key || seen.has(key)) return;
      seen.add(key);
      links.push([type,name,engine.entityHref(type.toLowerCase(),name)]);
    };
    add('GAME',article.gameKey);
    add('SERIES',article.series);
    add('FRANCHISE',article.franchise);
    add('AUTHOR',article.author);
    return links;
  }

  function renderGraphTrail(host, article, engine) {
    if (!host || host.querySelector('.nc-article-graph-trail')) return;
    const links=graphLinks(article,engine);
    if (!links.length) return;
    const meta=host.querySelector(':scope > .article-meta, :scope > .work-author-row');
    if (!meta) return;
    const trail=document.createElement('nav');
    trail.className='nc-article-graph-trail';
    trail.setAttribute('aria-label','Connected coverage');
    trail.innerHTML=`<small>CONNECTED COVERAGE</small><div>${links.map(([type,name,href])=>`<a href="${esc(href)}"><span>${esc(type)}</span><b>${esc(name)}</b></a>`).join('')}</div>`;
    meta.insertAdjacentElement('afterend',trail);
  }

  function renderRelated(host, current, all, engine) {
    const related=engine.related(current,all,3);
    if (!related.length) return;

    const markup=`<section class="work-side-card work-related-card nc-related-intelligent">
      <span>RELATED COVERAGE</span>
      ${related.map(({article,reason})=>`<a href="article.html?slug=${encodeURIComponent(article.slug)}"><b>${esc(article.title)}</b><small>${esc(article.category || 'STORY')}</small><small class="nc-related-reason">${esc(reason)}</small></a>`).join('')}
    </section>`;

    const existing=host.querySelector('.work-related-card');
    if (existing) {
      existing.outerHTML=markup;
      return;
    }
    const slot=host.querySelector('[data-related-slot]');
    if (slot) slot.innerHTML=markup;
  }

  async function init() {
    const storySlug=slug();
    if (!storySlug) return;
    const engine=await waitForEngine();
    if (!engine) return;

    try {
      const [currentResponse,indexResponse]=await Promise.all([
        fetch(`data/articles/${encodeURIComponent(storySlug)}.json`),
        fetch('data/articles.json')
      ]);
      if (!currentResponse.ok || !indexResponse.ok) return;
      const current=await currentResponse.json();
      const all=await indexResponse.json();
      const host=await waitForArticleHost();
      if (!host || !Array.isArray(all)) return;
      renderGraphTrail(host,current,engine);

      for (let i=0;i<50;i++) {
        if (host.querySelector('.work-related-card') || host.querySelector('[data-related-slot]')) break;
        await new Promise(resolve=>setTimeout(resolve,80));
      }
      renderRelated(host,current,all,engine);
    } catch (error) {
      console.warn('Neural Critic discovery context unavailable.',error);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
