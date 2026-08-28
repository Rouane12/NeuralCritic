(() => {
  'use strict';

  const SITE_ROOT = new URL(location.hostname === 'rouane12.github.io' ? '/NeuralCritic/' : '/', location.origin);
  const esc = (value='') => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const slug = () => window.NEURAL_CRITIC_STATIC_SLUG || new URLSearchParams(location.search).get('slug') || '';
  const storyHref = storySlug => new URL(`stories/${encodeURIComponent(storySlug)}/`, SITE_ROOT).href;

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
    trail.innerHTML=`<small>CONNECTED COVERAGE</small><div>${links.map(([type,name,href])=>`<a href="${esc(href)}" data-discovery-entity-type="${esc(type.toLowerCase())}" data-discovery-entity-name="${esc(name)}"><span>${esc(type)}</span><b>${esc(name)}</b></a>`).join('')}</div>`;
    meta.insertAdjacentElement('afterend',trail);
  }

  function relatedMarkup(current, all, engine) {
    const related=engine.related(current,all,3);
    if (!related.length) return '';
    return `<section class="work-side-card work-related-card nc-related-intelligent">
      <span>RELATED COVERAGE</span>
      ${related.map(({article,reason})=>`<a href="${esc(storyHref(article.slug))}" data-discovery-target="${esc(article.slug)}" data-discovery-reason="${esc(reason)}"><b>${esc(article.title)}</b><small>${esc(article.category || 'STORY')}</small><small class="nc-related-reason">${esc(reason)}</small></a>`).join('')}
    </section>`;
  }

  function renderRelated(host, current, all, engine) {
    const markup=relatedMarkup(current,all,engine);
    if (!markup) return false;

    const intelligent=host.querySelector('.work-related-card.nc-related-intelligent');
    const cards=[...host.querySelectorAll('.work-related-card')];
    cards.forEach(card => { if (card !== intelligent) card.remove(); });

    if (intelligent) return true;
    const slot=host.querySelector('[data-related-slot]');
    if (slot) {
      slot.innerHTML=markup;
      return true;
    }
    const sidebar=host.querySelector('.work-bottom-sidebar,.work-article-sidebar');
    if (sidebar) {
      sidebar.insertAdjacentHTML('afterbegin',markup);
      return true;
    }
    return false;
  }

  function stabilizeRelated(host, current, all, engine) {
    renderRelated(host,current,all,engine);
    const observer=new MutationObserver(() => {
      const cards=[...host.querySelectorAll('.work-related-card')];
      const hasLegacy=cards.some(card => !card.classList.contains('nc-related-intelligent'));
      if (hasLegacy || (!cards.length && host.querySelector('[data-related-slot]'))) {
        renderRelated(host,current,all,engine);
      }
    });
    observer.observe(host,{childList:true,subtree:true});
    setTimeout(() => {
      renderRelated(host,current,all,engine);
      observer.disconnect();
    },2500);
  }

  function trackDiscovery(host) {
    if (!host || host.dataset.discoveryTracking === '1') return;
    host.dataset.discoveryTracking='1';
    host.addEventListener('click',event=>{
      const storyLink=event.target.closest('[data-discovery-target]');
      if (storyLink) {
        window.NeuralCriticAnalytics?.track?.('discovery_click',{
          placement:'article_sidebar',
          target_slug:storyLink.dataset.discoveryTarget || '',
          recommendation_reason:storyLink.dataset.discoveryReason || ''
        });
        return;
      }
      const entityLink=event.target.closest('[data-discovery-entity-type]');
      if (!entityLink) return;
      window.NeuralCriticAnalytics?.track?.('connected_coverage_click',{
        placement:'article_header',
        entity_type:entityLink.dataset.discoveryEntityType || '',
        entity_name:entityLink.dataset.discoveryEntityName || ''
      });
    });
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
      trackDiscovery(host);
      renderGraphTrail(host,current,engine);

      for (let i=0;i<50;i++) {
        if (host.querySelector('.work-related-card') || host.querySelector('[data-related-slot]') || host.querySelector('.work-bottom-sidebar,.work-article-sidebar')) break;
        await new Promise(resolve=>setTimeout(resolve,80));
      }
      stabilizeRelated(host,current,all,engine);
    } catch (error) {
      console.warn('Neural Critic discovery context unavailable.',error);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
