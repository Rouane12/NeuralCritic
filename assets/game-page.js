(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = (value = '') => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const root = new URL(location.hostname === 'rouane12.github.io' ? '/NeuralCritic/' : '/', location.origin);
  const slugify = (value = '') => String(value).trim().toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const storyUrl = s => new URL(`stories/${encodeURIComponent(s)}/`, root).href;
  const topicUrl = (t, v) => new URL(`topics/${t}/${slugify(v)}/`, root).href;

  function slug() {
    const query = new URLSearchParams(location.search).get('slug');
    if (query) return query;
    const match = location.pathname.match(/\/games\/([^/]+)(?:\/index\.html)?\/?$/i);
    return match?.[1] ? decodeURIComponent(match[1]) : '';
  }

  function date(value) {
    if (!value) return 'TBA';
    try {
      return new Intl.DateTimeFormat('en', { year:'numeric', month:'long', day:'numeric', timeZone:'UTC' }).format(new Date(`${value}T00:00:00Z`));
    } catch (_) { return value; }
  }

  function image(value) {
    if (!value) return '';
    try { return new URL(value, root).href; } catch (_) { return value; }
  }

  async function discoveryEngine() {
    try {
      if (window.NeuralCriticDiscoveryReady) return await window.NeuralCriticDiscoveryReady;
    } catch (_) {}
    return window.NeuralCriticDiscovery || null;
  }

  function graphSeed(game) {
    return {
      slug:'',
      category:'',
      articleFormat:'',
      gameKey:game.title || game.slug || '',
      series:game.series || '',
      franchise:game.franchise || '',
      tags:[game.title, game.series, game.franchise, ...(game.genres || [])].filter(Boolean),
      platforms:Array.isArray(game.platforms) ? game.platforms : []
    };
  }

  function connectedRecommendations(game, articles, engine) {
    const direct = articles.filter(article => slugify(article.gameKey) === slugify(game.title) || slugify(article.gameKey) === slugify(game.slug));
    if (!engine?.related) return direct.slice(0, 8).map(article => ({ article, reason:'SAME GAME', relation:{ key:'same_game' } }));

    const allowed = new Set(['same_game','same_series','same_franchise','shared_topic']);
    const ranked = engine.related(graphSeed(game), articles, Math.min(20, articles.length))
      .filter(item => allowed.has(item.relation?.key));

    const selected = [];
    const seen = new Set();
    ranked.forEach(item => {
      if (selected.length >= 8 || seen.has(item.article.slug)) return;
      selected.push(item);
      seen.add(item.article.slug);
    });
    direct.forEach(article => {
      if (selected.length >= 8 || seen.has(article.slug)) return;
      selected.push({ article, reason:'SAME GAME', relation:{ key:'same_game' } });
      seen.add(article.slug);
    });
    return selected;
  }

  async function init() {
    const key = slug();
    const client = window.neuralCriticPublicSupabase;
    if (!key || !client) {
      $('#game-title').textContent = 'Game unavailable';
      return;
    }

    const { data:game, error } = await client.from('games').select('*').eq('slug', key).maybeSingle();
    if (error || !game) {
      $('#game-title').textContent = 'Game not found';
      $('#game-summary').textContent = 'This game has not been added to the Neural Critic database yet.';
      return;
    }

    const [{ data:releases }, articles, engine] = await Promise.all([
      client.from('game_releases').select('*').eq('game_id', game.id).order('release_date', { ascending:true }),
      window.NeuralCriticContentAPI?.publishedIndex?.() || Promise.resolve([]),
      discoveryEngine()
    ]);

    document.title = `${game.title} | Neural Critic Game Database`;
    document.querySelector('meta[name="description"]')?.setAttribute('content', game.summary || `${game.title} release information, platforms and Neural Critic coverage.`);
    $('#game-title').textContent = game.title;
    $('#game-status').textContent = `${String(game.release_status || 'GAME').toUpperCase()} · GAME DATABASE`;
    $('#game-summary').textContent = game.summary || 'Neural Critic coverage and release intelligence.';

    const cover = $('#game-cover');
    if (game.cover_image_url) {
      cover.innerHTML = `<img src="${esc(image(game.cover_image_url))}" alt="${esc(game.cover_image_alt || `${game.title} cover art`)}">`;
    }

    const chips = [...(game.genres || []), ...(game.platforms || [])].slice(0, 10);
    $('#game-chips').innerHTML = chips.map(value => `<span>${esc(value)}</span>`).join('');

    if (game.neural_critic_score != null) {
      const score = $('#game-score');
      score.hidden = false;
      score.innerHTML = `<strong>${Number(game.neural_critic_score).toFixed(1)}</strong><span>NEURAL CRITIC<br>SCORE</span>${game.score_article_slug ? `<a href="${storyUrl(game.score_article_slug)}">READ REVIEW →</a>` : ''}`;
    }

    $('#game-facts').innerHTML = [
      ['Release', date(game.primary_release_date)],
      ['Developer', game.developer],
      ['Publisher', game.publisher],
      ['Platforms', (game.platforms || []).join(' · ')]
    ].filter(item => item[1]).map(([label, value]) => `<div><small>${esc(label)}</small><strong>${esc(value)}</strong></div>`).join('');

    $('#game-releases').innerHTML = (releases || []).map(release => `<div><span>${esc(release.platform)}</span><strong>${esc(release.release_date ? date(release.release_date) : release.release_window || 'TBA')}</strong><small>${esc(release.region || 'worldwide')} · ${esc(release.status || 'announced')}</small></div>`).join('') || '<p class="nc-game-empty">Platform-specific release records are coming soon.</p>';

    const coverage = connectedRecommendations(game, Array.isArray(articles) ? articles : [], engine);
    const coverageTitle = $('#game-stories')?.closest('.nc-game-panel')?.querySelector('h2');
    if (coverageTitle) coverageTitle.textContent = 'Recommended stories';
    $('#game-stories').innerHTML = coverage.map(item => {
      const article = item.article;
      const reason = item.reason || item.relation?.label || 'CONNECTED';
      return `<a href="${storyUrl(article.slug)}" data-game-rec-target="${esc(article.slug)}" data-game-rec-reason="${esc(item.relation?.key || 'related')}"><small>${esc(String(article.category || 'STORY').toUpperCase())} · ${esc(reason)}</small><h3>${esc(article.title)}</h3><p>${esc(article.description || '')}</p><strong>READ STORY →</strong></a>`;
    }).join('') || '<p class="nc-game-empty">No connected stories yet.</p>';

    const relations = [];
    if (game.series) relations.push(['SERIES', game.series, topicUrl('series', game.series)]);
    if (game.franchise) relations.push(['FRANCHISE', game.franchise, topicUrl('franchise', game.franchise)]);
    $('#game-relations').innerHTML = relations.map(([label, value, url]) => `<a href="${url}"><small>${label}</small><strong>${esc(value)}</strong><span>EXPLORE →</span></a>`).join('') || '<p class="nc-game-empty">No wider series connections yet.</p>';

    $('#game-links').innerHTML = game.official_url ? `<a href="${esc(game.official_url)}" target="_blank" rel="noopener noreferrer"><strong>Official game website</strong><span>VISIT ↗</span></a>` : '<p class="nc-game-empty">Official links have not been added yet.</p>';

    $('#game-stories')?.addEventListener('click', event => {
      const link = event.target.closest('[data-game-rec-target]');
      if (!link) return;
      window.NeuralCriticAnalytics?.track?.('game_page_recirculation_click', {
        game_slug:game.slug,
        target_slug:link.dataset.gameRecTarget || '',
        recommendation_reason:link.dataset.gameRecReason || ''
      });
    });

    window.NeuralCriticAnalytics?.track?.('game_page_view', {
      game_slug:game.slug,
      release_status:game.release_status || '',
      connected_story_count:coverage.length,
      recommendation_engine:engine?.related ? 'game_graph' : 'direct_fallback'
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();
})();
