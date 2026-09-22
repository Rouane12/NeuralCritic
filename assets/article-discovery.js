(() => {
  'use strict';

  const SITE_ROOT = new URL(location.hostname === 'rouane12.github.io' ? '/NeuralCritic/' : '/', location.origin);
  const esc = (value='') => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const slug = () => window.NEURAL_CRITIC_STATIC_SLUG || new URLSearchParams(location.search).get('slug') || '';
  const gameHref = gameSlug => new URL(`games/${encodeURIComponent(gameSlug)}/`, SITE_ROOT).href;

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

  async function resolveGameContext(article) {
    const gameKey=String(article?.gameKey || article?.game_key || '').trim();
    const client=window.neuralCriticPublicSupabase;
    if (!gameKey || !client) return null;
    try {
      const {data,error}=await client.from('games')
        .select('slug,title,release_status,platforms,primary_release_date')
        .eq('title',gameKey)
        .maybeSingle();
      if (error || !data?.slug) return null;
      return {
        slug:data.slug,
        title:data.title || gameKey,
        releaseStatus:data.release_status || '',
        platforms:Array.isArray(data.platforms) ? data.platforms : [],
        primaryReleaseDate:data.primary_release_date || '',
        href:gameHref(data.slug)
      };
    } catch (_) { return null; }
  }

  function publishGameContext(game) {
    const detail=game ? {...game} : null;
    window.NeuralCriticArticleGameContext=detail;
    window.NeuralCriticArticleGameContextReady=true;
    window.dispatchEvent(new CustomEvent('neuralcritic:article-game-context-ready',{detail}));
  }

  function graphLinks(article, engine, game) {
    const links=[];
    const seen=new Set();
    const add=(type,name) => {
      const key=engine.normalize(name || '');
      if (!key || seen.has(key)) return;
      seen.add(key);
      links.push([type,name,engine.entityHref(type.toLowerCase(),name)]);
    };
    if (!game) add('GAME',article.gameKey);
    add('SERIES',article.series);
    add('FRANCHISE',article.franchise);
    add('AUTHOR',article.author);
    return links;
  }

  function gameContextMeta(game) {
    const status=String(game?.releaseStatus || '').replaceAll('_',' ').trim().toUpperCase();
    const platforms=(game?.platforms || []).filter(Boolean).slice(0,3).join(' · ');
    return [status,platforms].filter(Boolean).join(' · ');
  }

  function graphPills(links) {
    return links.map(([type,name,href])=>`<a href="${esc(href)}" data-discovery-entity-type="${esc(type.toLowerCase())}" data-discovery-entity-name="${esc(name)}" data-discovery-destination="topic_hub"><span>${esc(type)}</span><b>${esc(name)}</b></a>`).join('');
  }

  function renderGraphTrail(host, article, engine, game) {
    if (!host || host.querySelector('.nc-article-graph-trail')) return;
    const links=graphLinks(article,engine,game);
    if (!links.length && !game) return;
    const meta=host.querySelector(':scope > .article-meta, :scope > .work-author-row');
    if (!meta) return;
    const trail=document.createElement('nav');
    trail.className=`nc-article-graph-trail${game ? ' has-game-hub' : ''}`;
    trail.setAttribute('aria-label','Connected coverage');
    if (game) {
      const secondary=graphPills(links);
      trail.dataset.gameHubSlug=game.slug;
      trail.innerHTML=`<a class="nc-article-game-hub" href="${esc(game.href)}" data-discovery-entity-type="game_hub" data-discovery-entity-name="${esc(game.title)}" data-discovery-destination="game_hub"><span>GAME HUB</span><b>${esc(game.title)}</b>${gameContextMeta(game) ? `<small>${esc(gameContextMeta(game))}</small>` : ''}<strong>OPEN GAME HUB <i aria-hidden="true">→</i></strong></a>${secondary ? `<div class="nc-article-graph-links"><small>CONNECTED COVERAGE</small><div>${secondary}</div></div>` : ''}`;
    } else {
      trail.innerHTML=`<small>CONNECTED COVERAGE</small><div>${graphPills(links)}</div>`;
    }
    meta.insertAdjacentElement('afterend',trail);
  }

  function trackDiscovery(host) {
    if (!host || host.dataset.discoveryTracking === '1') return;
    host.dataset.discoveryTracking='1';
    host.addEventListener('click',event=>{
      const entityLink=event.target.closest('[data-discovery-entity-type]');
      if (!entityLink) return;
      window.NeuralCriticAnalytics?.track?.('connected_coverage_click',{
        placement:'article_header',
        entity_type:entityLink.dataset.discoveryEntityType || '',
        entity_name:entityLink.dataset.discoveryEntityName || '',
        destination:entityLink.dataset.discoveryDestination || 'topic_hub'
      });
    });
  }

  async function init() {
    const storySlug=slug();
    if (!storySlug) return;
    const engine=await waitForEngine();
    if (!engine) return;

    try {
      const currentResponse=await fetch(`data/articles/${encodeURIComponent(storySlug)}.json`);
      if (!currentResponse.ok) return;
      const current=await currentResponse.json();
      const [host,game]=await Promise.all([waitForArticleHost(),resolveGameContext(current)]);
      publishGameContext(game);
      if (!host) return;
      trackDiscovery(host);
      renderGraphTrail(host,current,engine,game);
    } catch (error) {
      publishGameContext(null);
      console.warn('Neural Critic discovery context unavailable.',error);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();