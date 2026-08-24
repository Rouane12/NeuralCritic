(() => {
  'use strict';

  const SITE_ROOT = new URL(location.hostname === 'rouane12.github.io' ? '/NeuralCritic/' : '/', location.origin);
  const GENERIC_TAGS = new Set([
    'review','reviews','feature','features','news','guide','guides','pc','playstation','xbox','nintendo','mobile',
    'action rpg','action-rpg','rpg','open world','open-world','gaming','game','games'
  ]);
  const STOP_WORDS = new Set(['the','a','an','and','or','of','to','in','on','for','from','with','why','how','what','is','are','still','best','games','game','review']);

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
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
    return new URL(`topic.html?${encodeURIComponent(type)}=${encodeURIComponent(key)}`, SITE_ROOT).href;
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

  function normalizedTags(article) {
    return (Array.isArray(article?.tags) ? article.tags : [])
      .map(tag => String(tag || '').trim().toLowerCase())
      .filter(Boolean);
  }

  function meaningfulTags(article) {
    return normalizedTags(article).filter(tag => !GENERIC_TAGS.has(tag));
  }

  function titleTokens(article) {
    return new Set(String(article?.title || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 2 && !STOP_WORDS.has(token)));
  }

  function freshness(article) {
    const time = new Date(article?.publishedAt || article?.updatedAt || 0).valueOf();
    if (!Number.isFinite(time) || !time) return 0;
    const ageDays = Math.max(0, (Date.now() - time) / 86400000);
    if (ageDays <= 7) return 3;
    if (ageDays <= 30) return 2;
    if (ageDays <= 90) return 1;
    return 0;
  }

  function identityValue(article, key) {
    const aliases = {
      game: ['gameKey','game_key'],
      series: ['series'],
      franchise: ['franchise']
    };
    for (const field of aliases[key] || []) {
      const value = String(article?.[field] || '').trim();
      if (value) return value;
    }
    return '';
  }

  function sameIdentity(a, b) {
    return !!a && !!b && slugify(a) === slugify(b);
  }

  function relationFor(current, candidate) {
    const currentGame = identityValue(current, 'game');
    const candidateGame = identityValue(candidate, 'game');
    if (sameIdentity(currentGame, candidateGame)) {
      return { key:'same_game', weight:60, type:'game', value:currentGame, label:`More ${displayTag(currentGame)}` };
    }

    const currentSeries = identityValue(current, 'series');
    const candidateSeries = identityValue(candidate, 'series');
    if (sameIdentity(currentSeries, candidateSeries)) {
      return { key:'same_series', weight:42, type:'series', value:currentSeries, label:`More ${displayTag(currentSeries)}` };
    }

    const currentFranchise = identityValue(current, 'franchise');
    const candidateFranchise = identityValue(candidate, 'franchise');
    if (sameIdentity(currentFranchise, candidateFranchise)) {
      return { key:'same_franchise', weight:24, type:'franchise', value:currentFranchise, label:`More ${displayTag(currentFranchise)}` };
    }

    return { key:'', weight:0, type:'', value:'', label:'' };
  }

  function scoreCandidate(current, candidate) {
    const relation = relationFor(current, candidate);
    const currentTags = normalizedTags(current);
    const candidateTags = normalizedTags(candidate);
    const currentMeaningful = meaningfulTags(current);
    const candidateMeaningful = meaningfulTags(candidate);
    const meaningfulOverlap = currentMeaningful.filter(tag => candidateMeaningful.includes(tag));
    const allOverlap = currentTags.filter(tag => candidateTags.includes(tag));
    const currentTokens = titleTokens(current);
    const candidateTokens = titleTokens(candidate);
    const titleOverlap = [...currentTokens].filter(token => candidateTokens.has(token)).length;

    let score = relation.weight;
    score += meaningfulOverlap.length * 14;
    score += Math.min(6, allOverlap.length * 2);
    if (String(current.category || '').toLowerCase() === String(candidate.category || '').toLowerCase()) score += 6;
    if (current.articleFormat && current.articleFormat === candidate.articleFormat) score += 4;
    if (current.collection && current.collection === candidate.collection) score += 7;
    score += Math.min(8, titleOverlap * 3);
    score += freshness(candidate);

    return { score, meaningfulOverlap, relation };
  }

  function reasonFor(current, candidate, scored) {
    if (scored.relation?.key) return scored.relation;
    if (scored.meaningfulOverlap.length) {
      const tag = String(scored.meaningfulOverlap[0] || '').trim();
      const studioLabel = /^fromsoftware$/i.test(tag);
      return { key:'topic', type:'', value:tag, label:studioLabel ? `More from ${displayTag(tag)}` : `More ${displayTag(tag)}` };
    }
    if (String(current.category || '').toLowerCase() === String(candidate.category || '').toLowerCase()) {
      return { key:'category', type:'', value:'', label:`More ${String(current.category || 'stories').toLowerCase()}` };
    }
    return { key:'related', type:'', value:'', label:'Related feature' };
  }

  function displayTag(value) {
    const raw = String(value || '').trim();
    if (/^fromsoftware$/i.test(raw)) return 'FromSoftware';
    return raw.replace(/\b\w/g, char => char.toUpperCase());
  }

  function readTime(article) {
    const value = Number(article?.readMinutes || article?.readTime || 0);
    if (Number.isFinite(value) && value > 0) return Math.round(value);
    return null;
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

  function cardMarkup(item, position) {
    const article = item.article;
    const image = imageUrl(article.imageLocal || article.image || article.heroImage || '');
    const minutes = readTime(article);
    const category = String(article.category || 'STORY').toUpperCase();
    const href = storyUrl(article.slug);
    const classes = position === 0 ? 'nc-recirc-card nc-recirc-lead' : 'nc-recirc-card nc-recirc-secondary';
    return `<a class="${classes}" href="${href}" data-recirc-target="${esc(article.slug)}" data-recirc-reason="${esc(item.reason.key)}">
      <div class="nc-recirc-media">${image ? `<img src="${esc(image)}" alt="${esc(article.imageAlt || article.title || '')}" loading="lazy" decoding="async">` : '<span>NEURAL<br>CRITIC</span>'}<i>${position === 0 ? 'NEXT READ' : esc(item.reason.label.toUpperCase())}</i></div>
      <div class="nc-recirc-copy">
        <div class="nc-recirc-meta"><span>${esc(category)}</span>${minutes ? `<b>${minutes} MIN READ</b>` : ''}</div>
        <h3>${esc(article.title || '')}</h3>
        ${position === 0 ? `<p>${esc(article.description || '')}</p>` : ''}
        <strong>${position === 0 ? 'KEEP READING' : 'READ STORY'} <span aria-hidden="true">→</span></strong>
      </div>
    </a>`;
  }

  function removeLegacyRelated() {
    $$('.work-related-card').forEach(card => card.remove());
  }

  function waitForInsertionPoint(timeout = 7000) {
    return new Promise(resolve => {
      const find = () => $('.work-bottom-grid') || $('#reader-thread')?.closest('.work-bottom-grid') || $('#reader-thread');
      const immediate = find();
      if (immediate) return resolve(immediate);
      const host = $('#article');
      if (!host) return resolve(null);
      const observer = new MutationObserver(() => {
        removeLegacyRelated();
        const point = find();
        if (point) { observer.disconnect(); resolve(point); }
      });
      observer.observe(host, { childList: true, subtree: true });
      setTimeout(() => { observer.disconnect(); resolve(find()); }, timeout);
    });
  }

  function trackClicks(module) {
    module.addEventListener('click', event => {
      const link = event.target.closest('[data-recirc-target]');
      if (!link) return;
      window.NeuralCriticAnalytics?.track?.('recirculation_click', {
        placement: 'article_end',
        target_slug: link.dataset.recircTarget || '',
        recommendation_reason: link.dataset.recircReason || ''
      });
    });

    if (!('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      window.NeuralCriticAnalytics?.track?.('recirculation_view', {
        placement: 'article_end',
        recommendation_count: module.querySelectorAll('[data-recirc-target]').length
      });
    }, { threshold: 0.25 });
    observer.observe(module);
  }

  function bestHub(current, primary) {
    if (primary?.relation?.type && primary.relation.value) return topicUrl(primary.relation.type, primary.relation.value);
    const series = identityValue(current, 'series');
    if (series) return topicUrl('series', series);
    const franchise = identityValue(current, 'franchise');
    if (franchise) return topicUrl('franchise', franchise);
    const game = identityValue(current, 'game');
    if (game) return topicUrl('game', game);
    return '';
  }

  async function init() {
    const slug = currentSlug();
    if (!slug || $('#nc-recirculation')) return;

    const [index, insertionPoint] = await Promise.all([loadPublished(), waitForInsertionPoint()]);
    if (!insertionPoint || !Array.isArray(index) || index.length < 2) return;

    const current = await loadCurrent(slug, index);
    if (!current) return;

    const ranked = index
      .filter(article => article?.slug && article.slug !== slug)
      .map(article => {
        const scored = scoreCandidate(current, article);
        return { article, ...scored, reason: reasonFor(current, article, scored) };
      })
      .sort((a, b) => b.score - a.score || new Date(b.article.publishedAt || 0) - new Date(a.article.publishedAt || 0));

    const selected = [];
    const seen = new Set();
    const directMatch = ranked.find(item => item.relation?.key);
    const topicMatch = ranked.find(item => item.meaningfulOverlap.length);
    const primary = directMatch || topicMatch || ranked[0];
    if (primary) { selected.push(primary); seen.add(primary.article.slug); }
    ranked.forEach(item => {
      if (selected.length >= 3 || seen.has(item.article.slug)) return;
      selected.push(item); seen.add(item.article.slug);
    });
    if (!selected.length) return;

    const primaryIdentity = selected[0]?.relation?.value || selected[0]?.meaningfulOverlap?.[0] || meaningfulTags(current)[0] || '';
    const eyebrow = primaryIdentity ? `CONTINUE WITH ${displayTag(primaryIdentity).toUpperCase()}` : 'KEEP READING';
    const hubHref = bestHub(current, selected[0]);
    const fallbackSection = current.editorialSection || (String(current.category || '').toLowerCase() === 'review' ? 'reviews' : String(current.category || 'features').toLowerCase());
    const exploreHref = hubHref || new URL(`category.html?section=${encodeURIComponent(fallbackSection)}`, SITE_ROOT).href;
    const exploreLabel = hubHref && primaryIdentity ? `EXPLORE ${displayTag(primaryIdentity).toUpperCase()} →` : 'EXPLORE MORE →';

    const module = document.createElement('section');
    module.id = 'nc-recirculation';
    module.className = 'nc-recirculation';
    module.setAttribute('aria-labelledby', 'nc-recirculation-title');
    module.innerHTML = `<header class="nc-recirc-head"><div><span>${esc(eyebrow)}</span><h2 id="nc-recirculation-title">Your next story is already here.</h2></div><a href="${esc(exploreHref)}">${esc(exploreLabel)}</a></header><div class="nc-recirc-grid">${selected.map(cardMarkup).join('')}</div>`;

    insertionPoint.insertAdjacentElement('beforebegin', module);
    removeLegacyRelated();
    trackClicks(module);

    module.dataset.primaryReason = selected[0]?.reason?.key || '';
    module.dataset.primaryScore = String(selected[0]?.score || 0);
    window.dispatchEvent(new CustomEvent('neuralcritic:recirculation-ready', {
      detail: {
        sourceSlug: slug,
        primarySlug: selected[0]?.article?.slug || '',
        primaryReason: selected[0]?.reason?.key || '',
        primaryScore: selected[0]?.score || 0
      }
    }));

    const cleanupObserver = new MutationObserver(removeLegacyRelated);
    cleanupObserver.observe($('#article') || document.body, { childList: true, subtree: true });
    setTimeout(() => cleanupObserver.disconnect(), 8000);
  }

  window.NeuralCriticRecirculation = { scoreCandidate, relationFor };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();