(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = (value = '') => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const root = new URL(location.hostname === 'rouane12.github.io' ? '/NeuralCritic/' : '/', location.origin);
  const staticTopic = window.NEURAL_CRITIC_STATIC_TOPIC || null;
  const params = new URLSearchParams(location.search);
  const allowedTypes = ['game','series','franchise'];
  const topicType = staticTopic?.type || allowedTypes.find(type => params.get(type)) || '';
  const topicSlug = staticTopic?.slug || (topicType ? params.get(topicType) : '') || '';
  const state = { rows:[], direct:[], games:[], originalStories:'', filter:'all' };

  function slugify(value = '') {
    return String(value).trim().toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
  }

  function identityValue(article, type) {
    const fields = { game:['gameKey','game_key'], series:['series'], franchise:['franchise'] }[type] || [];
    for (const field of fields) {
      const value = String(article?.[field] || '').trim();
      if (value) return value;
    }
    return '';
  }

  const storyUrl = slug => new URL(`stories/${encodeURIComponent(slug)}/`, root).href;
  const gameUrl = slug => new URL(`games/${encodeURIComponent(slug)}/`, root).href;

  function articleTime(article) {
    return new Date(article?.updatedAt || article?.updated_at || article?.publishedAt || article?.published_at || 0).getTime() || 0;
  }

  function fmtDate(value) {
    if (!value) return '';
    try { return new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(value)); }
    catch (_) { return ''; }
  }

  function formatOf(article) {
    return String(article?.articleFormat || article?.article_format || '').trim().toLowerCase();
  }

  function categoryOf(article) {
    return String(article?.category || '').trim().toLowerCase();
  }

  const isReview = article => formatOf(article) === 'review';
  const isGuide = article => formatOf(article) === 'game-guide' || categoryOf(article) === 'guide' || String(article?.editorialSection || article?.editorial_section || '').toLowerCase() === 'guides';
  const isNews = article => categoryOf(article) === 'news' || String(article?.editorialSection || article?.editorial_section || '').toLowerCase() === 'news';
  const isFeature = article => !isReview(article) && !isGuide(article) && !isNews(article);

  function labelOf(article) {
    if (isReview(article)) return 'REVIEW';
    if (isGuide(article)) return 'GUIDE';
    if (isNews(article)) return 'NEWS';
    return String(article?.articleFormat || article?.category || 'FEATURE').replace(/[-_]+/g,' ').toUpperCase();
  }

  function directMatches(rows) {
    return rows.filter(article => slugify(identityValue(article, topicType)) === topicSlug).sort((a,b) => articleTime(b) - articleTime(a));
  }

  async function loadPublished() {
    try {
      const rows = await window.NeuralCriticContentAPI?.publishedIndex?.();
      if (Array.isArray(rows)) return rows;
    } catch (_) {}
    try {
      const response = await fetch('data/articles.json', { cache:'no-cache' });
      const rows = response.ok ? await response.json() : [];
      return Array.isArray(rows) ? rows : [];
    } catch (_) { return []; }
  }

  async function loadGames() {
    const client = window.neuralCriticPublicSupabase;
    if (!client?.from) return [];
    try {
      const { data, error } = await client.from('games').select('id,slug,title,release_status,primary_release_date,neural_critic_score,series,franchise').order('title');
      if (error) return [];
      return Array.isArray(data) ? data : [];
    } catch (_) { return []; }
  }

  function reviewScore(article) {
    const raw = article?.reviewMeta?.score ?? article?.review_meta?.score;
    const score = Number(raw);
    return Number.isFinite(score) ? score : null;
  }

  function storyCard(article) {
    const score = reviewScore(article);
    return `<a class="nc-topic-story nc-topic-story-filtered" href="${esc(storyUrl(article.slug))}" data-topic-story-target="${esc(article.slug)}"><div class="nc-topic-story-copy"><small>${esc(labelOf(article))}</small><h3>${esc(article.title || '')}</h3><p>${esc(article.description || '')}</p><footer><span>${esc(fmtDate(article.publishedAt || article.published_at))}</span><strong>${score !== null ? `NC ${esc(score)} · ` : ''}READ STORY →</strong></footer></div></a>`;
  }

  function startCard(article, primary = false) {
    const score = reviewScore(article);
    if (primary) {
      return `<a class="nc-topic-start-primary" href="${esc(storyUrl(article.slug))}" data-topic-start-target="${esc(article.slug)}"><small>${esc(labelOf(article))} · START HERE</small><h3>${esc(article.title || '')}</h3><p>${esc(article.description || '')}</p><footer><span>${esc(fmtDate(article.publishedAt || article.published_at))}</span><strong>${score !== null ? `NC ${esc(score)} · ` : ''}READ STORY →</strong></footer></a>`;
    }
    return `<a class="nc-topic-start-secondary" href="${esc(storyUrl(article.slug))}" data-topic-start-target="${esc(article.slug)}"><small>${esc(labelOf(article))}</small><strong>${esc(article.title || '')}</strong><span>${esc(fmtDate(article.publishedAt || article.published_at))}</span></a>`;
  }

  function editorialPicks(rows) {
    const picks = [];
    const add = article => { if (article?.slug && !picks.some(item => item.slug === article.slug)) picks.push(article); };
    add(rows.find(isReview));
    add(rows.find(isGuide));
    add(rows[0]);
    add(rows.find(isFeature));
    return picks.slice(0,3);
  }

  function renderStartHere() {
    const panel = $('#topic-start-here-panel');
    const host = $('#topic-start-here');
    if (!panel || !host) return;
    const picks = editorialPicks(state.direct);
    if (!picks.length) { panel.hidden = true; return; }
    panel.hidden = false;
    host.innerHTML = `${startCard(picks[0], true)}${picks.length > 1 ? `<div class="nc-topic-start-secondary-list">${picks.slice(1).map(article => startCard(article)).join('')}</div>` : ''}`;
    const count = $('#topic-start-count');
    if (count) count.textContent = `${picks.length} ${picks.length === 1 ? 'PICK' : 'PICKS'}`;
  }

  function filteredRows(filter) {
    if (filter === 'reviews') return state.direct.filter(isReview);
    if (filter === 'guides') return state.direct.filter(isGuide);
    if (filter === 'news') return state.direct.filter(isNews);
    if (filter === 'features') return state.direct.filter(isFeature);
    return state.direct;
  }

  function renderControls() {
    const host = $('#topic-coverage-controls');
    if (!host || !state.direct.length) return;
    const counts = {
      all:state.direct.length,
      reviews:state.direct.filter(isReview).length,
      guides:state.direct.filter(isGuide).length,
      news:state.direct.filter(isNews).length,
      features:state.direct.filter(isFeature).length,
    };
    const labels = {all:'ALL',reviews:'REVIEWS',guides:'GUIDES',news:'NEWS',features:'FEATURES'};
    const order = ['all','reviews','guides','news','features'];
    const visible = order.filter(key => key === 'all' || counts[key] > 0);
    host.hidden = visible.length < 2;
    host.innerHTML = visible.map(key => `<button type="button" data-topic-filter="${key}" aria-pressed="${key === 'all'}"><span>${labels[key]}</span><b>${counts[key]}</b></button>`).join('');
  }

  function applyFilter(filter) {
    const host = $('#topic-stories');
    if (!host) return;
    state.filter = filter;
    if (filter === 'all') {
      host.innerHTML = state.originalStories;
    } else {
      const rows = filteredRows(filter);
      host.innerHTML = rows.length ? rows.map(storyCard).join('') : '<p class="nc-topic-empty-copy">No matching coverage yet.</p>';
    }
    $('#topic-coverage-controls')?.querySelectorAll('[data-topic-filter]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.topicFilter === filter)));
    window.NeuralCriticAnalytics?.track?.('topic_hub_filter_change', { topic_type:topicType, topic_slug:topicSlug, coverage_filter:filter, result_count:filteredRows(filter).length });
  }

  function gameMatch(name) {
    const key = slugify(name);
    return state.games.find(game => slugify(game.title) === key || slugify(game.slug) === key) || null;
  }

  function upgradeGameJourneys() {
    const name = staticTopic?.name || $('#topic-title')?.textContent?.trim() || '';
    const relationHost = $('#topic-relations');
    if (topicType === 'game' && relationHost) {
      const game = gameMatch(name);
      if (game && !relationHost.querySelector('[data-topic-game-hub-cta]')) {
        relationHost.insertAdjacentHTML('afterbegin', `<a class="nc-topic-game-hub-cta" data-topic-game-hub-cta="${esc(game.slug)}" href="${esc(gameUrl(game.slug))}">GAME HUB · ${esc(game.title)} <span>→</span></a>`);
      }
    }
    $('#topic-games')?.querySelectorAll('a').forEach(link => {
      const title = link.querySelector('strong')?.textContent?.trim() || '';
      const game = gameMatch(title);
      if (!game) return;
      link.href = gameUrl(game.slug);
      link.dataset.topicGameHub = game.slug;
      const small = link.querySelector('small');
      if (small) small.textContent = 'OPEN GAME HUB';
    });
  }

  function renderLocalNav() {
    const nav = $('#topic-local-nav');
    if (!nav) return;
    const items = [];
    if (!$('#topic-start-here-panel')?.hidden) items.push(['#topic-start-here-panel','Start here']);
    items.push(['#topic-coverage-panel','Coverage']);
    if ($('#topic-games')?.querySelector('a')) items.push(['#topic-games-panel','Games']);
    if ($('#topic-rankings')?.querySelector('a')) items.push(['#topic-rankings-panel','Rankings']);
    items.push(['games/','All games']);
    nav.innerHTML = items.map(([href,label]) => `<a href="${href}">${esc(label)}</a>`).join('');
    nav.hidden = false;
  }

  function bind() {
    $('#topic-coverage-controls')?.addEventListener('click', event => {
      const button = event.target.closest?.('[data-topic-filter]');
      if (button) applyFilter(button.dataset.topicFilter || 'all');
    });
    document.addEventListener('click', event => {
      const start = event.target.closest?.('[data-topic-start-target]');
      if (start) window.NeuralCriticAnalytics?.track?.('topic_hub_start_here_click',{topic_type:topicType,topic_slug:topicSlug,target_slug:start.dataset.topicStartTarget || ''});
      const game = event.target.closest?.('[data-topic-game-hub],[data-topic-game-hub-cta]');
      if (game) window.NeuralCriticAnalytics?.track?.('topic_hub_game_hub_click',{topic_type:topicType,topic_slug:topicSlug,target_game_slug:game.dataset.topicGameHub || game.dataset.topicGameHubCta || ''});
      const story = event.target.closest?.('[data-topic-story-target]');
      if (story) window.NeuralCriticAnalytics?.track?.('topic_hub_story_click',{topic_type:topicType,topic_slug:topicSlug,target_slug:story.dataset.topicStoryTarget || '',coverage_filter:state.filter});
    }, true);
  }

  async function waitForBaseRuntime(timeout = 6000) {
    const started = performance.now();
    while (performance.now() - started < timeout) {
      const title = $('#topic-title')?.textContent?.trim() || '';
      const stories = $('#topic-stories');
      if (title && !/^loading topic/i.test(title) && stories) return true;
      await new Promise(resolve => setTimeout(resolve, 80));
    }
    return false;
  }

  async function init() {
    if (!allowedTypes.includes(topicType) || !topicSlug) return;
    const ready = await waitForBaseRuntime();
    if (!ready) return;
    [state.rows, state.games] = await Promise.all([loadPublished(), loadGames()]);
    state.direct = directMatches(state.rows);
    state.originalStories = $('#topic-stories')?.innerHTML || '';
    renderStartHere();
    renderControls();
    upgradeGameJourneys();
    renderLocalNav();
    bind();
    window.NeuralCriticAnalytics?.track?.('topic_hub_retention_ready',{topic_type:topicType,topic_slug:topicSlug,direct_story_count:state.direct.length,game_hub_links:document.querySelectorAll('[data-topic-game-hub],[data-topic-game-hub-cta]').length});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();
})();
