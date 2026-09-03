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
    const label = String(item?.reason || 'MORE COVERAGE').trim() || 'MORE COVERAGE';
    return { key:'related', type:'', value:'', label };
  }

  function relationLabel(item) {
    const relation = item?.relation || fallbackRelation(item);
    if (relation.key === 'same_game' && relation.value) return `More ${displayTag(relation.value)}`;
    if (relation.key === 'same_series' && relation.value) return `More ${displayTag(relation.value)}`;
    if (relation.key === 'same_franchise' && relation.value) return `More ${displayTag(relation.value)}`;
    if (relation.key === 'shared_topic' && relation.value) return `More ${displayTag(relation.value)}`;
    if (relation.key === 'same_collection' && relation.value) return `More ${displayTag(relation.value)}`;
    if (relation.key === 'same_desk') return `More ${String(item?.article?.category || 'stories').toLowerCase()}`;
    return 'Related coverage';
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

  function cardMarkup(item, position) {
    const article = item.article;
    const image = imageUrl(article.imageLocal || article.image || article.heroImage || '');
    const minutes = readTime(article);
    const category = String(article.category || 'STORY').toUpperCase();
    const reason = item.relation || fallbackRelation(item);
    const classes = position === 0 ? 'nc-recirc-card nc-recirc-lead' : 'nc-recirc-card nc-recirc-secondary';
    return `<a class="${classes}" href="${storyUrl(article.slug)}" data-recirc-target="${esc(article.slug)}" data-recirc-reason="${esc(reason.key)}"><div class="nc-recirc-media">${image ? `<img src="${esc(image)}" alt="${esc(article.imageAlt || article.title || '')}" loading="lazy" decoding="async">` : '<span>NEURAL<br>CRITIC</span>'}<i>${position === 0 ? 'NEXT READ' : esc(relationLabel(item).toUpperCase())}</i></div><div class="nc-recirc-copy"><div class="nc-recirc-meta"><span>${esc(category)}</span>${minutes ? `<b>${minutes} MIN READ</b>` : ''}</div><h3>${esc(article.title || '')}</h3>${position === 0 ? `<p>${esc(article.description || '')}</p>` : ''}<strong>${position === 0 ? 'KEEP READING' : 'READ STORY'} <span aria-hidden="true">→</span></strong></div></a>`;
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
          target_slug:link.dataset.recircTarget || '',
          recommendation_reason:link.dataset.recircReason || ''
        });
      }
      const hub = event.target.closest('[data-recirc-hub]');
      if (hub) {
        window.NeuralCriticAnalytics?.track?.('recirculation_hub_click', {
          placement:'after_thread',
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
        recommendation_count:module.querySelectorAll('[data-recirc-target]').length,
        primary_reason:module.dataset.primaryReason || ''
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

    const selected = engine.related(current, index, 3);
    if (!selected.length) return;

    const gameContext = current.gameKey ? await waitForArticleGameContext() : null;
    const identity = gameContext?.title || primaryIdentity(current, selected[0]);
    const eyebrow = identity ? `CONTINUE WITH ${displayTag(identity).toUpperCase()}` : 'KEEP READING';
    const hub = bestHub(current, selected[0], gameContext);
    const fallbackSection = current.editorialSection || (String(current.category || '').toLowerCase() === 'review' ? 'reviews' : String(current.category || 'features').toLowerCase());
    const exploreHref = hub.href || new URL(`category.html?section=${encodeURIComponent(fallbackSection)}`, SITE_ROOT).href;
    const exploreLabel = hub.destination === 'game_hub'
      ? 'OPEN GAME HUB →'
      : hub.href && identity ? `EXPLORE ${displayTag(identity).toUpperCase()} →` : 'EXPLORE MORE →';

    const module = document.createElement('section');
    module.id = 'nc-recirculation';
    module.className = 'nc-recirculation';
    module.setAttribute('aria-labelledby', 'nc-recirculation-title');
    module.innerHTML = `<header class="nc-recirc-head"><div><span>${esc(eyebrow)}</span><h2 id="nc-recirculation-title">Your next story is already here.</h2></div><a href="${esc(exploreHref)}"${hub.href ? ` data-recirc-hub="${esc(hub.type)}" data-recirc-hub-value="${esc(hub.value)}" data-recirc-hub-destination="${esc(hub.destination || 'topic_hub')}"` : ''}>${esc(exploreLabel)}</a></header><div class="nc-recirc-grid">${selected.map(cardMarkup).join('')}</div>`;
    insertionPoint.insertAdjacentElement('afterend', module);

    module.dataset.placement = 'after-reader-thread';
    module.dataset.primaryReason = selected[0]?.relation?.key || 'related';
    module.dataset.primaryScore = String(selected[0]?.score || 0);
    if (gameContext?.slug) module.dataset.gameHubSlug = gameContext.slug;
    trackClicks(module);

    window.dispatchEvent(new CustomEvent('neuralcritic:recirculation-ready', {
      detail:{
        sourceSlug:slug,
        primarySlug:selected[0]?.article?.slug || '',
        primaryReason:selected[0]?.relation?.key || 'related',
        primaryScore:selected[0]?.score || 0,
        recommendationKinds:selected.map(item => item.kind || '').filter(Boolean),
        gameHubSlug:gameContext?.slug || ''
      }
    }));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();
})();