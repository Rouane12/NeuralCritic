(() => {
  'use strict';

  const SITE_ROOT = new URL(location.hostname === 'rouane12.github.io' ? '/NeuralCritic/' : '/', location.origin);
  const staticTopic = window.NEURAL_CRITIC_STATIC_TOPIC || null;
  const params = new URLSearchParams(location.search);
  const allowedTypes = ['game','series','franchise'];
  const requestedType = staticTopic?.type || allowedTypes.find(type => params.get(type)) || '';
  const requestedSlug = staticTopic?.slug || (requestedType ? params.get(requestedType) : '') || '';

  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = (value = '') => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

  function slugify(value = '') {
    return String(value).trim().toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function identityValue(article, type) {
    const fields = { game:['gameKey','game_key'], series:['series'], franchise:['franchise'] }[type] || [];
    for (const field of fields) {
      const value = String(article?.[field] || '').trim();
      if (value) return value;
    }
    return '';
  }

  function topicUrl(type, value) {
    const slug = slugify(value);
    return slug ? new URL(`topics/${type}/${slug}/`, SITE_ROOT).href : '#';
  }

  function storyUrl(slug) {
    return new URL(`stories/${encodeURIComponent(slug)}/`, SITE_ROOT).href;
  }

  function imageUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) {
      const marker = '/media/editorial/';
      if (raw.includes(marker)) {
        const filename = raw.split(marker)[1]?.split(/[?#]/)[0];
        if (filename) return new URL(`images/editorial/${decodeURIComponent(filename)}`, SITE_ROOT).href;
      }
      return raw;
    }
    try { return new URL(raw, SITE_ROOT).href; } catch (_) { return raw; }
  }

  function titleCase(value = '') {
    return String(value).replace(/[-_]+/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
  }

  function fmtDate(value) {
    if (!value) return '';
    try { return new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(value)); }
    catch (_) { return ''; }
  }

  function reviewScore(article) {
    const raw = article?.reviewMeta?.score ?? article?.review_meta?.score;
    const score = Number(raw);
    return Number.isFinite(score) ? score : null;
  }

  function rankOf(block, total, index) {
    const raw = String(block?.rank || '').trim();
    return raw || String(Math.max(1, total - index));
  }

  async function waitForContentApi(timeout = 5000) {
    const started = performance.now();
    while (performance.now() - started < timeout) {
      if (window.NeuralCriticContentAPI?.publishedIndex) return window.NeuralCriticContentAPI;
      await new Promise(resolve => setTimeout(resolve, 80));
    }
    return null;
  }

  async function loadPublished() {
    try {
      const api = await waitForContentApi();
      if (api) {
        const rows = await api.publishedIndex();
        if (Array.isArray(rows)) return rows;
      }
    } catch (_) {}
    try {
      const response = await fetch('data/articles.json');
      return response.ok ? await response.json() : [];
    } catch (_) { return []; }
  }

  function directMatches(rows, type, slug) {
    return rows.filter(article => slugify(identityValue(article, type)) === slug);
  }

  function rankedAppearances(rows, gameKeys) {
    const keys = new Set(gameKeys.map(slugify).filter(Boolean));
    if (!keys.size) return [];
    const appearances = [];
    rows.filter(article => article.articleFormat === 'ranked-list').forEach(article => {
      const blocks = Array.isArray(article.contentBlocks) ? article.contentBlocks : [];
      blocks.forEach((block,index) => {
        if (!keys.has(slugify(block?.heading || ''))) return;
        appearances.push({
          article,
          game: String(block.heading || '').trim(),
          rank: rankOf(block, blocks.length, index),
          subtitle: String(block.subtitle || '').trim()
        });
      });
    });
    return appearances.sort((a,b) => new Date(b.article.publishedAt || 0) - new Date(a.article.publishedAt || 0));
  }

  function tagMatches(rows, direct, rankings, names) {
    const used = new Set([...direct.map(a => a.slug), ...rankings.map(x => x.article.slug)]);
    const targets = new Set(names.map(slugify).filter(Boolean));
    return rows.filter(article => {
      if (used.has(article.slug)) return false;
      return (article.tags || []).some(tag => targets.has(slugify(tag)));
    });
  }

  function uniqueStories(items) {
    const seen = new Set();
    return items.filter(article => article?.slug && !seen.has(article.slug) && seen.add(article.slug));
  }

  function setMeta(name, content, property = false) {
    if (!content) return;
    const selector = property ? `meta[property="${name}"]` : `meta[name="${name}"]`;
    let node = document.head.querySelector(selector);
    if (!node) {
      node = document.createElement('meta');
      node.setAttribute(property ? 'property' : 'name', name);
      document.head.appendChild(node);
    }
    node.setAttribute('content', String(content));
  }

  function setCanonical(url) {
    let link = document.head.querySelector('link[rel="canonical"]');
    if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.appendChild(link); }
    link.href = url;
  }

  function setStructuredData(name, type, canonical, stories) {
    let script = $('#nc-topic-structured-data');
    if (!script) {
      script = document.createElement('script');
      script.id = 'nc-topic-structured-data';
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify({
      '@context':'https://schema.org',
      '@type':'CollectionPage',
      name:`${name} · Neural Critic`,
      url:canonical,
      description:`Reviews, features, rankings, and news connected to ${name} through Neural Critic's Game Graph.`,
      about:{'@type':'Thing',name},
      isPartOf:{'@type':'WebSite',name:'Neural Critic',url:SITE_ROOT.href},
      hasPart:stories.slice(0,12).map(article => ({'@type':'CreativeWork',name:article.title,url:storyUrl(article.slug)}))
    });
  }

  function updateMetadata(name, type, stories) {
    const canonical = staticTopic?.canonical || topicUrl(type, name);
    const description = `${name} reviews, features, rankings, and news connected through Neural Critic's Game Graph.`;
    document.title = `${name} · Neural Critic`;
    setMeta('description', description);
    setMeta('robots','index,follow,max-image-preview:large');
    setMeta('og:site_name','Neural Critic',true);
    setMeta('og:type','website',true);
    setMeta('og:title',`${name} · Neural Critic`,true);
    setMeta('og:description',description,true);
    setMeta('og:url',canonical,true);
    setMeta('twitter:card','summary_large_image');
    setMeta('twitter:title',`${name} · Neural Critic`);
    setMeta('twitter:description',description);
    const image = imageUrl(stories.find(article => article.imageLocal)?.imageLocal || '');
    if (image) {
      setMeta('og:image',image,true);
      setMeta('twitter:image',image);
    }
    setCanonical(canonical);
    setStructuredData(name,type,canonical,stories);
  }

  function relationPills(type, direct) {
    const values = [];
    if (type === 'game') {
      const series = direct.map(a => identityValue(a,'series')).find(Boolean);
      const franchise = direct.map(a => identityValue(a,'franchise')).find(Boolean);
      if (series) values.push({type:'series',value:series,label:`SERIES · ${series}`});
      if (franchise) values.push({type:'franchise',value:franchise,label:`FRANCHISE · ${franchise}`});
    } else if (type === 'series') {
      const franchise = direct.map(a => identityValue(a,'franchise')).find(Boolean);
      if (franchise) values.push({type:'franchise',value:franchise,label:`FRANCHISE · ${franchise}`});
    } else if (type === 'franchise') {
      [...new Set(direct.map(a => identityValue(a,'series')).filter(Boolean))].forEach(series => values.push({type:'series',value:series,label:`SERIES · ${series}`}));
    }
    return values.map(item => `<a href="${esc(topicUrl(item.type,item.value))}">${esc(item.label)} <span>→</span></a>`).join('');
  }

  function storyCard(article, lead = false) {
    const image = imageUrl(article.imageLocal || '');
    const score = reviewScore(article);
    const format = String(article.articleFormat || article.category || 'STORY').replace(/-/g,' ').toUpperCase();
    return `<a class="nc-topic-story${lead ? ' is-lead' : ''}" href="${esc(storyUrl(article.slug))}">
      <div class="nc-topic-story-media">${image ? `<img src="${esc(image)}" alt="${esc(article.imageAlt || article.title || '')}" loading="${lead ? 'eager' : 'lazy'}" decoding="async">` : '<span>NEURAL CRITIC</span>'}${score !== null ? `<b>${esc(score)}<small>/10</small></b>` : ''}</div>
      <div class="nc-topic-story-copy"><small>${esc(format)}</small><h3>${esc(article.title || '')}</h3><p>${esc(article.description || '')}</p><footer><span>${esc(fmtDate(article.publishedAt))}</span><strong>READ STORY →</strong></footer></div>
    </a>`;
  }

  function rankingCard(item) {
    const image = imageUrl(item.article.imageLocal || '');
    return `<a class="nc-topic-ranking" href="${esc(storyUrl(item.article.slug))}">
      <div>${image ? `<img src="${esc(image)}" alt="" loading="lazy" decoding="async">` : ''}<b>#${esc(item.rank)}</b></div>
      <section><small>RANKED APPEARANCE · ${esc(item.game)}</small><strong>${esc(item.article.title || '')}</strong>${item.subtitle ? `<p>${esc(item.subtitle)}</p>` : ''}<span>VIEW RANKING →</span></section>
    </a>`;
  }

  function renderGames(gameKeys, direct) {
    const host = $('#topic-games');
    if (!host) return;
    host.innerHTML = gameKeys.map(game => {
      const review = direct.filter(a => slugify(identityValue(a,'game')) === slugify(game) && a.articleFormat === 'review').sort((a,b) => new Date(b.publishedAt || 0)-new Date(a.publishedAt || 0))[0];
      const score = reviewScore(review);
      return `<a href="${esc(topicUrl('game',game))}"><span><small>CONNECTED GAME</small><strong>${esc(game)}</strong></span>${score !== null ? `<b>${esc(score)}<em>/10</em></b>` : '<i>→</i>'}</a>`;
    }).join('') || '<p class="nc-topic-empty-copy">Connected games will appear here as the graph grows.</p>';
  }

  function renderRankings(rankings) {
    const host = $('#topic-rankings');
    if (!host) return;
    host.innerHTML = rankings.length ? rankings.map(rankingCard).join('') : '<p class="nc-topic-empty-copy">No ranked appearances yet.</p>';
  }

  function fail(message) {
    const main = $('#topic-hub');
    if (main) main.innerHTML = `<section class="nc-topic-missing"><small>GAME GRAPH</small><h1>Topic unavailable.</h1><p>${esc(message)}</p><a href="index.html">BACK TO NEURAL CRITIC →</a></section>`;
  }

  async function init() {
    if (!allowedTypes.includes(requestedType) || !requestedSlug) return fail('This topic route is incomplete.');
    const rows = await loadPublished();
    const direct = directMatches(rows,requestedType,requestedSlug).sort((a,b) => new Date(b.publishedAt || 0)-new Date(a.publishedAt || 0));
    const name = staticTopic?.name || identityValue(direct[0],requestedType) || titleCase(requestedSlug);
    if (!direct.length && !staticTopic) return fail('No published stories currently define this topic.');

    const gameKeys = [...new Set((requestedType === 'game' ? [name] : direct.map(article => identityValue(article,'game'))).filter(Boolean))];
    const rankings = rankedAppearances(rows,gameKeys);
    const relatedNames = [name,...gameKeys];
    const tagged = tagMatches(rows,direct,rankings,relatedNames);
    const stories = uniqueStories([...direct,...tagged]).sort((a,b) => new Date(b.publishedAt || 0)-new Date(a.publishedAt || 0));
    const reviews = stories.filter(article => article.articleFormat === 'review');
    const news = stories.filter(article => String(article.category || '').toUpperCase() === 'NEWS');
    const latestScore = reviews.map(reviewScore).find(score => score !== null);
    const connectedStoryCount = new Set([...stories.map(a => a.slug),...rankings.map(x => x.article.slug)]).size;

    updateMetadata(name,requestedType,[...stories,...rankings.map(x => x.article)]);
    document.body.dataset.topicType = requestedType;
    const typeLabel = `${requestedType.toUpperCase()} HUB`;
    $('#topic-kind').textContent = typeLabel;
    $('#topic-title').textContent = name;
    $('#topic-deck').textContent = `${name} coverage connected through Neural Critic's Game Graph — reviews, rankings, features, and news in one living editorial hub.`;
    $('#topic-relations').innerHTML = relationPills(requestedType,direct);
    $('#topic-stats').innerHTML = [
      ['CONNECTED STORIES',connectedStoryCount],
      ['CONNECTED GAMES',gameKeys.length],
      ['REVIEWS',reviews.length],
      ['RANKED APPEARANCES',rankings.length],
      ['NEWS SIGNALS',news.length],
      ['LATEST REVIEW',latestScore !== undefined ? `${latestScore}/10` : '—']
    ].map(([label,value]) => `<div><small>${esc(label)}</small><strong>${esc(value)}</strong></div>`).join('');

    const storiesHost = $('#topic-stories');
    storiesHost.innerHTML = stories.length ? stories.map((article,index) => storyCard(article,index === 0)).join('') : '<p class="nc-topic-empty-copy">No direct coverage yet.</p>';
    $('#topic-story-count').textContent = `${stories.length} DIRECT ${stories.length === 1 ? 'STORY' : 'STORIES'}`;
    renderGames(gameKeys,direct);
    renderRankings(rankings);

    window.NeuralCriticAnalytics?.track?.('topic_hub_view', {
      topic_type: requestedType,
      topic_slug: requestedSlug,
      connected_stories: connectedStoryCount,
      connected_games: gameKeys.length
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();