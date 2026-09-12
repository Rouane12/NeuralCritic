(() => {
  'use strict';

  const SITE_ROOT = new URL(location.hostname === 'rouane12.github.io' ? '/NeuralCritic/' : '/', location.origin);
  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = (value = '') => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

  function currentSlug() {
    const staticSlug = String(window.NEURAL_CRITIC_STATIC_SLUG || '').trim();
    if (/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(staticSlug)) return staticSlug;
    return new URLSearchParams(location.search).get('slug') || '';
  }

  function storyUrl(slug) {
    return new URL(`stories/${encodeURIComponent(slug)}/`, SITE_ROOT).href;
  }

  function slugify(value = '') {
    return String(value).trim().toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function topicUrl(type, value) {
    const key = slugify(value);
    if (!key || !['game','series','franchise'].includes(type)) return '';
    return new URL(`topics/${encodeURIComponent(type)}/${encodeURIComponent(key)}/`, SITE_ROOT).href;
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

  function displayTag(value) {
    const raw = String(value || '').trim();
    if (/^fromsoftware$/i.test(raw)) return 'FromSoftware';
    return raw.replace(/\b\w/g, char => char.toUpperCase());
  }

  function readTime(article) {
    const value = Number(article?.readMinutes || article?.readTime || 0);
    return Number.isFinite(value) && value > 0 ? Math.round(value) : null;
  }

  function fallbackRelation(item) {
    const label = String(item?.reason || 'NEXT READ').trim() || 'NEXT READ';
    return { key:'related', type:'', value:'', label };
  }

  function relationshipLabel(item, slot) {
    const relation = item?.relation || fallbackRelation(item);
    if (relation.key === 'same_game') return 'SAME GAME';
    if (relation.key === 'same_series') return 'SAME SERIES';
    if (relation.key === 'same_franchise') return 'SAME FRANCHISE';
    if (relation.key === 'shared_topic') return relation.value ? `SHARED TOPIC · ${displayTag(relation.value).toUpperCase()}` : 'SHARED TOPIC';
    if (relation.key === 'same_collection') return 'SAME COLLECTION';
    if (relation.key === 'same_desk') return 'FROM THE DESK';
    return slot === 2 ? 'NEXT READ' : String(relation.label || 'RELATED').toUpperCase();
  }

  async function loadPublished() {
    try {
      if (window.NeuralCriticContentAPI?.publishedIndex) {
        const rows = await window.NeuralCriticContentAPI.publishedIndex();
        if (Array.isArray(rows) && rows.length) return rows;
      }
    } catch (_) {}
    try {
      const response = await fetch('data/articles.json');
      return response.ok ? await response.json() : [];
    } catch (_) { return []; }
  }

  async function loadCurrent(slug, index) {
    try {
      if (window.NeuralCriticContentAPI?.publishedArticle) {
        const article = await window.NeuralCriticContentAPI.publishedArticle(slug);
        if (article) return article;
      }
    } catch (_) {}
    try {
      const response = await fetch(`data/articles/${encodeURIComponent(slug)}.json`);
      if (response.ok) return await response.json();
    } catch (_) {}
    return index.find(article => article.slug === slug) || null;
  }

  async function discoveryEngine() {
    try {
      if (window.NeuralCriticDiscoveryReady) return await window.NeuralCriticDiscoveryReady;
    } catch (_) {}
    return window.NeuralCriticDiscovery || null;
  }

  function waitForArticleGameContext(timeout = 3200) {
    if (window.NeuralCriticArticleGameContextReady) {
      return Promise.resolve(window.NeuralCriticArticleGameContext || null);
    }
    return new Promise(resolve => {
      let settled = false;
      const finish = value => {
        if (settled) return;
        settled = true;
        window.removeEventListener('neuralcritic:article-game-context-ready', onReady);
        resolve(value || null);
      };
      const onReady = event => finish(event.detail || null);
      window.addEventListener('neuralcritic:article-game-context-ready', onReady, { once:true });
      setTimeout(() => finish(window.NeuralCriticArticleGameContext || null), timeout);
    });
  }

  function selectJourney(current, index, engine) {
    const ranked = engine.related(current, index, Math.min(12, Math.max(3, index.length - 1)));
    if (!ranked.length) return [];

    const selected = [];
    const seen = new Set([current.slug]);
    const take = predicate => {
      const item = ranked.find(candidate => !seen.has(candidate?.article?.slug) && predicate(candidate));
      if (!item?.article?.slug) return false;
      seen.add(item.article.slug);
      selected.push(item);
      return true;
    };

    /* The first two slots establish a clear editorial journey: stay with the
       game when possible, then broaden into its series/franchise. The third
       slot deliberately reaches beyond that core relationship when the shared
       Discovery Intelligence scorer has a useful option. */
    take(item => item?.relation?.key === 'same_game');
    take(item => ['same_series','same_franchise'].includes(item?.relation?.key));
    take(item => !['same_game','same_series','same_franchise'].includes(item?.relation?.key));

    ranked.forEach(item => {
      if (selected.length >= 3 || !item?.article?.slug || seen.has(item.article.slug)) return;
      seen.add(item.article.slug);
      selected.push(item);
    });
    return selected.slice(0, 3);
  }

  function cardMarkup(item, position) {
    const article = item.article;
    const image = imageUrl(article.imageLocal || article.image || article.heroImage || '');
    const minutes = readTime(article);
    const category = String(article.category || 'STORY').toUpperCase();
    const relation = item.relation || fallbackRelation(item);
    return `<a class="nc-recirc-card" href="${storyUrl(article.slug)}" data-recirc-target="${esc(article.slug)}" data-recirc-reason="${esc(relation.key)}" data-recirc-slot="${position + 1}"><div class="nc-recirc-media">${image ? `<img src="${esc(image)}" alt="${esc(article.imageAlt || article.title || '')}" loading="lazy" decoding="async">` : '<span class="nc-recirc-fallback"><b>NEURAL</b><strong>CRITIC</strong></span>'}<i>${esc(relationshipLabel(item, position))}</i></div><div class="nc-recirc-copy"><div class="nc-recirc-meta"><span>${esc(category)}</span>${minutes ? `<b>${minutes} MIN READ</b>` : ''}</div><h3>${esc(article.title || '')}</h3>${article.description ? `<p>${esc(article.description)}</p>` : ''}<strong>READ STORY <span aria-hidden="true">→</span></strong></div></a>`;
  }

  function waitForInsertionPoint(timeout = 7000) {
    return new Promise(resolve => {
      const find = () => $('#reader-thread')?.closest('.work-bottom-grid') || $('#reader-thread') || $('.work-bottom-grid');
      const immediate = find();
      if (immediate) return resolve(immediate);
      const host = $('#article');
      if (!host) return resolve(null);
      const observer = new MutationObserver(() => {
        const point = find();
        if (point) {
          observer.disconnect();
          resolve(point);
        }
      });
      observer.observe(host, { childList:true, subtree:true });
      setTimeout(() => {
        observer.disconnect();
        resolve(find());
      }, timeout);
    });
  }

  function trackClicks(module) {
    module.addEventListener('click', event => {
      const link = event.target.closest('[data-recirc-target]');
      if (link) {
        window.NeuralCriticAnalytics?.track?.('recirculation_click', {
          placement:'after_thread',
          surface:'continue_exploring',
          target_slug:link.dataset.recircTarget || '',
          recommendation_reason:link.dataset.recircReason || '',
          recommendation_slot:Number(link.dataset.recircSlot || 0) || null
        });
      }
      const hub = event.target.closest('[data-recirc-hub]');
      if (hub) {
        window.NeuralCriticAnalytics?.track?.('recirculation_hub_click', {
          placement:'after_thread',
          surface:'continue_exploring',
          hub_type:hub.dataset.recircHub || '',
          hub_value:hub.dataset.recircHubValue || '',
          destination:hub.dataset.recircHubDestination || 'topic_hub'
        });
      }
    });

    if (!('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      window.NeuralCriticAnalytics?.track?.('recirculation_view', {
        placement:'after_thread',
        surface:'continue_exploring',
        recommendation_count:module.querySelectorAll('[data-recirc-target]').length,
        primary_reason:module.dataset.primaryReason || '',
        relationship_mix:module.dataset.relationships || ''
      });
    }, { threshold:0.25 });
    observer.observe(module);
  }

  function bestHub(current, primary, gameContext) {
    if (gameContext?.href && gameContext?.slug) {
      return {
        href:gameContext.href,
        type:'game',
        value:gameContext.title || current?.gameKey || '',
        destination:'game_hub'
      };
    }
    const relation = primary?.relation;
    if (relation?.type && relation.value) {
      return { href:topicUrl(relation.type, relation.value), type:relation.type, value:relation.value, destination:'topic_hub' };
    }
    const series = String(current?.series || '').trim();
    if (series) return { href:topicUrl('series', series), type:'series', value:series, destination:'topic_hub' };
    const franchise = String(current?.franchise || '').trim();
    if (franchise) return { href:topicUrl('franchise', franchise), type:'franchise', value:franchise, destination:'topic_hub' };
    const game = String(current?.gameKey || '').trim();
    if (game) return { href:topicUrl('game', game), type:'game', value:game, destination:'topic_hub' };
    return { href:'', type:'', value:'', destination:'' };
  }

  function primaryIdentity(current, primary) {
    const relation = primary?.relation;
    if (relation?.value) return relation.value;
    return current?.gameKey || current?.series || current?.franchise || '';
  }

  async function init() {
    const slug = currentSlug();
    if (!slug || $('#nc-recirculation')) return;

    const [index, insertionPoint, engine] = await Promise.all([
      loadPublished(),
      waitForInsertionPoint(),
      discoveryEngine()
    ]);
    if (!insertionPoint || !Array.isArray(index) || index.length < 2 || !engine?.related) return;

    const current = await loadCurrent(slug, index);
    if (!current) return;

    const selected = selectJourney(current, index, engine);
    if (!selected.length) return;

    const gameContext = current.gameKey ? await waitForArticleGameContext() : null;
    const identity = gameContext?.title || primaryIdentity(current, selected[0]);
    const hub = bestHub(current, selected[0], gameContext);
    const fallbackSection = current.editorialSection || (String(current.category || '').toLowerCase() === 'review' ? 'reviews' : String(current.category || 'features').toLowerCase());
    const exploreHref = hub.href || new URL(`category.html?section=${encodeURIComponent(fallbackSection)}`, SITE_ROOT).href;
    const exploreLabel = hub.destination === 'game_hub'
      ? 'OPEN GAME HUB →'
      : hub.href && identity ? `EXPLORE ${displayTag(identity).toUpperCase()} →` : 'EXPLORE MORE →';

    const module = document.createElement('section');
    module.id = 'nc-recirculation';
    module.className = 'nc-recirculation nc-continue-exploring';
    module.setAttribute('aria-labelledby', 'nc-recirculation-title');
    module.innerHTML = `<header class="nc-recirc-head"><div><span>KEEP READING</span><h2 id="nc-recirculation-title">Continue exploring</h2><p>More from this game, its world, and what matters next.</p></div><a href="${esc(exploreHref)}"${hub.href ? ` data-recirc-hub="${esc(hub.type)}" data-recirc-hub-value="${esc(hub.value)}" data-recirc-hub-destination="${esc(hub.destination || 'topic_hub')}"` : ''}>${esc(exploreLabel)}</a></header><div class="nc-recirc-grid">${selected.map(cardMarkup).join('')}</div>`;
    insertionPoint.insertAdjacentElement('afterend', module);

    module.dataset.placement = 'after-reader-thread';
    module.dataset.primaryReason = selected[0]?.relation?.key || 'related';
    module.dataset.primaryScore = String(selected[0]?.score || 0);
    module.dataset.relationships = selected.map(item => item?.relation?.key || 'related').join(',');
    if (gameContext?.slug) module.dataset.gameHubSlug = gameContext.slug;
    trackClicks(module);

    window.dispatchEvent(new CustomEvent('neuralcritic:recirculation-ready', {
      detail:{
        sourceSlug:slug,
        primarySlug:selected[0]?.article?.slug || '',
        primaryReason:selected[0]?.relation?.key || 'related',
        primaryScore:selected[0]?.score || 0,
        recommendationKinds:selected.map(item => item.kind || '').filter(Boolean),
        recommendationRelationships:selected.map(item => item?.relation?.key || 'related'),
        gameHubSlug:gameContext?.slug || ''
      }
    }));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();
})();
