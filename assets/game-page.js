(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = (value = '') => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const root = new URL(location.hostname === 'rouane12.github.io' ? '/NeuralCritic/' : '/', location.origin);
  const slugify = (value = '') => String(value).trim().toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const storyUrl = slug => new URL(`stories/${encodeURIComponent(slug)}/`, root).href;
  const gameUrl = slug => new URL(`games/${encodeURIComponent(slug)}/`, root).href;
  const topicUrl = (type, value) => new URL(`topics/${type}/${slugify(value)}/`, root).href;
  const state = { view:'latest', game:null, games:[], releases:[], articles:[], coverage:[], directCoverage:[], deals:[] };

  function currentSlug() {
    const staticSlug = String(window.NEURAL_CRITIC_STATIC_GAME_SLUG || '').trim();
    if (staticSlug) return staticSlug;
    const query = new URLSearchParams(location.search).get('slug');
    if (query) return query;
    const match = location.pathname.match(/\/games\/([^/]+)(?:\/index\.html)?\/?$/i);
    return match?.[1] ? decodeURIComponent(match[1]) : '';
  }

  function date(value) {
    if (!value) return 'TBA';
    try {
      const raw = /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? `${value}T00:00:00Z` : value;
      return new Intl.DateTimeFormat('en', { year:'numeric', month:'long', day:'numeric', timeZone:'UTC' }).format(new Date(raw));
    } catch (_) { return String(value); }
  }

  function shortDate(value) {
    if (!value) return 'TBA';
    try {
      const raw = /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? `${value}T00:00:00Z` : value;
      return new Intl.DateTimeFormat('en', { year:'numeric', month:'short', day:'numeric', timeZone:'UTC' }).format(new Date(raw));
    } catch (_) { return String(value); }
  }

  function image(value) {
    if (!value) return '';
    try { return new URL(value, root).href; } catch (_) { return value; }
  }

  function money(value, currency = 'USD') {
    try {
      return new Intl.NumberFormat('en-US', { style:'currency', currency:String(currency || 'USD').toUpperCase(), maximumFractionDigits:2 }).format(Number(value));
    } catch (_) { return `${Number(value).toFixed(2)} ${currency}`; }
  }

  function offerDestination(offer) {
    return String(offer?.is_affiliate && offer?.affiliate_url ? offer.affiliate_url : offer?.destination_url || '').trim();
  }

  function isOfferActive(offer) {
    if (!['in_stock','preorder','backorder'].includes(String(offer.availability || ''))) return false;
    if (!Number.isFinite(Number(offer.price))) return false;
    if (!offerDestination(offer)) return false;
    if (offer.expires_at && new Date(offer.expires_at).getTime() <= Date.now()) return false;
    return true;
  }

  async function discoveryEngine() {
    try {
      if (window.NeuralCriticDiscoveryReady) return await window.NeuralCriticDiscoveryReady;
    } catch (_) {}
    return window.NeuralCriticDiscovery || null;
  }

  async function loadArticles() {
    try {
      const live = await window.NeuralCriticContentAPI?.publishedIndex?.();
      if (Array.isArray(live) && live.length) return live;
    } catch (error) {
      console.warn('Game Hub live article index unavailable; using generated fallback.', error);
    }
    try {
      const response = await fetch('data/articles.json');
      if (!response.ok) return [];
      const rows = await response.json();
      return Array.isArray(rows) ? rows : [];
    } catch (_) { return []; }
  }

  function graphSeed(game) {
    return {
      slug:'', category:'', articleFormat:'',
      gameKey:game.title || game.slug || '',
      series:game.series || '', franchise:game.franchise || '',
      tags:[game.title, game.series, game.franchise, ...(game.genres || [])].filter(Boolean),
      platforms:Array.isArray(game.platforms) ? game.platforms : []
    };
  }

  function sameGame(article, game) {
    const key = slugify(article?.gameKey || article?.game_key || '');
    return Boolean(key && (key === slugify(game.title) || key === slugify(game.slug)));
  }

  function articleTime(article) {
    return new Date(article?.updatedAt || article?.updated_at || article?.publishedAt || article?.published_at || 0).getTime() || 0;
  }

  function isReview(article) {
    return String(article?.articleFormat || article?.article_format || '').toLowerCase() === 'review';
  }

  function isGuide(article) {
    const format = String(article?.articleFormat || article?.article_format || '').toLowerCase();
    const category = String(article?.category || '').toLowerCase();
    const section = String(article?.editorialSection || article?.editorial_section || '').toLowerCase();
    return format === 'game-guide' || category === 'guide' || section === 'guides';
  }

  function directGameArticles(game, articles) {
    return articles.filter(article => sameGame(article, game)).sort((a,b) => articleTime(b) - articleTime(a));
  }

  function connectedRecommendations(game, articles, engine) {
    const direct = directGameArticles(game, articles);
    if (!engine?.related) {
      return direct.slice(0, 12).map(article => ({ article, reason:'SAME GAME', relation:{ key:'same_game' } }));
    }
    const allowed = new Set(['same_game','same_series','same_franchise','shared_topic']);
    const ranked = engine.related(graphSeed(game), articles, Math.min(40, articles.length)).filter(item => allowed.has(item.relation?.key));
    const selected = [];
    const seen = new Set();
    direct.forEach(article => {
      if (seen.has(article.slug)) return;
      selected.push({ article, reason:'SAME GAME', relation:{ key:'same_game' } });
      seen.add(article.slug);
    });
    ranked.forEach(item => {
      if (selected.length >= 12 || seen.has(item.article.slug)) return;
      selected.push(item);
      seen.add(item.article.slug);
    });
    return selected.slice(0,12);
  }

  function ensureFollowOwner() {
    if (window.NeuralCriticEntityFollows || document.querySelector('script[data-nc-entity-follows-v2]')) return;
    const existing = [...document.scripts].some(script => {
      try { return new URL(script.src, document.baseURI).pathname.endsWith('/assets/entity-follows-v2.js'); }
      catch (_) { return false; }
    });
    if (existing) return;
    const script = document.createElement('script');
    script.src = 'assets/entity-follows-v2.js?v=20260903-gamehub2';
    script.dataset.ncEntityFollowsV2 = '1';
    document.body.appendChild(script);
  }

  function renderFacts(game) {
    const facts = [
      ['Release', game.primary_release_date ? date(game.primary_release_date) : (game.release_status === 'released' ? 'Released' : 'TBA')],
      ['Developer', game.developer], ['Publisher', game.publisher],
      ['Platforms', (game.platforms || []).join(' · ')], ['Series', game.series], ['Franchise', game.franchise],
    ].filter(item => item[1]);
    $('#game-facts').innerHTML = facts.map(([label, value]) => `<div><small>${esc(label)}</small><strong>${esc(value)}</strong></div>`).join('');
  }

  function renderSignalStrip(game) {
    const host = $('#game-signal-strip');
    if (!host) return;
    const status = String(game.release_status || 'game').replaceAll('_',' ').toUpperCase();
    const directCount = state.directCoverage.length;
    const score = Number.isFinite(Number(game.neural_critic_score)) ? Number(game.neural_critic_score).toFixed(1) : '—';
    const release = game.primary_release_date ? shortDate(game.primary_release_date) : (game.release_status === 'released' ? 'Released' : 'TBA');
    const items = [
      ['STATUS', status],
      ['RELEASE', release],
      ['COVERAGE', `${directCount} ${directCount === 1 ? 'STORY' : 'STORIES'}`],
      ['NC SCORE', score],
    ];
    host.innerHTML = items.map(([label,value]) => `<div><small>${esc(label)}</small><strong>${esc(value)}</strong></div>`).join('');
  }

  function renderReleases(releases) {
    $('#game-releases').innerHTML = (releases || []).map(release => `<div>
      <span><b>${esc(release.platform)}</b>${release.region ? `<small>${esc(release.region)}</small>` : ''}</span>
      <strong>${esc(release.release_date ? date(release.release_date) : release.release_window || 'TBA')}</strong>
      <small>${esc(String(release.status || 'announced').replaceAll('_',' ').toUpperCase())}</small>
    </div>`).join('') || '<p class="nc-game-empty">No platform-specific release records are available yet.</p>';
  }

  function reviewArticle(game, articles) {
    if (game.score_article_slug) {
      const exact = articles.find(article => article.slug === game.score_article_slug);
      if (exact) return exact;
    }
    return articles.find(article => sameGame(article, game) && isReview(article)) || null;
  }

  function editorialLabel(article) {
    if (isReview(article)) return 'REVIEW';
    if (isGuide(article)) return 'GUIDE';
    const section = String(article?.editorialSection || article?.editorial_section || article?.category || 'STORY').trim();
    return section.toUpperCase();
  }

  function renderStartHere(game, articles) {
    const panel = $('#game-start-here-panel');
    const host = $('#game-start-here');
    if (!panel || !host) return;
    const direct = directGameArticles(game, articles);
    if (!direct.length) {
      panel.hidden = true;
      host.innerHTML = '';
      return;
    }
    const review = reviewArticle(game, direct);
    const primary = review || direct[0];
    const secondary = direct.filter(article => article.slug !== primary.slug).slice(0,2);
    panel.hidden = false;
    host.innerHTML = `<a class="nc-game-start-primary" href="${storyUrl(primary.slug)}" data-game-start-target="${esc(primary.slug)}">
      <small>${esc(editorialLabel(primary))} · START HERE</small>
      <h3>${esc(primary.title)}</h3>
      <p>${esc(primary.description || '')}</p>
      <span>${primary.publishedAt || primary.published_at ? esc(shortDate(primary.publishedAt || primary.published_at)) : ''}</span>
      <strong>READ STORY →</strong>
    </a>${secondary.length ? `<div class="nc-game-start-secondary">${secondary.map(article => `<a href="${storyUrl(article.slug)}" data-game-start-target="${esc(article.slug)}"><small>${esc(editorialLabel(article))}</small><strong>${esc(article.title)}</strong><span>${article.publishedAt || article.published_at ? esc(shortDate(article.publishedAt || article.published_at)) : ''}</span></a>`).join('')}</div>` : ''}`;
  }

  function renderReviewFeature(game, articles) {
    const host = $('#game-review-feature');
    if (!host) return;
    const review = reviewArticle(game, articles);
    if (!review) { host.hidden = true; host.innerHTML = ''; return; }
    const meta = review.reviewMeta || review.review_meta || {};
    const score = meta.score ?? game.neural_critic_score;
    const scoreMarkup = score != null && String(score).trim()
      ? `<div class="nc-game-review-score"><strong>${esc(score)}</strong><span>OUT OF 10</span></div>`
      : '<div class="nc-game-review-score"><span>NEURAL CRITIC<br>REVIEW</span></div>';
    host.hidden = false;
    host.innerHTML = `<section class="nc-game-review-card">${scoreMarkup}<div class="nc-game-review-copy">
      <small>NEURAL CRITIC REVIEW</small><h2>${esc(review.title)}</h2><p>${esc(meta.verdict || review.description || '')}</p>
      <div class="nc-game-review-meta">${meta.testedPlatform ? `<span>TESTED: ${esc(meta.testedPlatform)}</span>` : ''}${review.updatedAt || review.publishedAt ? `<span>${esc(date(review.updatedAt || review.publishedAt))}</span>` : ''}</div>
      <a href="${storyUrl(review.slug)}" data-game-review-target="${esc(review.slug)}">READ THE FULL REVIEW →</a>
    </div></section>`;
  }

  function storyCard(item) {
    const article = item.article || item;
    const relation = item.reason || item.relation?.label || (sameGame(article, state.game) ? 'SAME GAME' : 'CONNECTED');
    return `<a href="${storyUrl(article.slug)}" data-game-story-target="${esc(article.slug)}" data-game-rec-reason="${esc(item.relation?.key || (sameGame(article,state.game) ? 'same_game' : 'related'))}">
      <small>${esc(String(article.category || 'STORY').toUpperCase())} · ${esc(relation)}</small><h3>${esc(article.title)}</h3>
      <p>${esc(article.description || '')}</p><strong>READ STORY →</strong></a>`;
  }

  function dealCard(row) {
    const { product, offer, retailer } = row;
    const destination = offerDestination(offer);
    const reference = Number(offer.list_price) > Number(offer.price) ? Number(offer.list_price) : null;
    const discount = reference ? Math.round((1 - Number(offer.price) / reference) * 100) : 0;
    const attrs = offer.is_affiliate ? 'data-affiliate="true" data-affiliate-placement="game-hub-deals" rel="sponsored noopener noreferrer"' : 'rel="noopener noreferrer"';
    return `<a class="nc-game-deal-card" href="${esc(destination)}" target="_blank" ${attrs} data-game-commerce-product="${esc(product.slug)}" data-game-commerce-retailer="${esc(retailer.slug)}">
      <small>${esc(product.category || 'PRODUCT')} · ${esc(retailer.name)}</small><h3>${esc(product.name)}</h3>
      <p><strong>${money(offer.price, offer.currency)}</strong>${discount ? `<span>-${discount}%</span>` : ''}</p>
      ${offer.is_affiliate ? '<em>AFFILIATE LINK</em>' : ''}<b>VIEW DEAL ↗</b></a>`;
  }

  function coverageSets() {
    const same = state.directCoverage;
    return {
      latest:state.coverage,
      reviews:same.filter(isReview).map(article => ({article, reason:'SAME GAME', relation:{key:'same_game'}})),
      guides:same.filter(isGuide).map(article => ({article, reason:'SAME GAME', relation:{key:'same_game'}})),
      deals:state.deals
    };
  }

  function updateCoverageControls() {
    const sets = coverageSets();
    document.querySelectorAll('[data-game-view]').forEach(button => {
      const view = button.dataset.gameView;
      const count = Array.isArray(sets[view]) ? sets[view].length : 0;
      button.classList.toggle('active', view === state.view);
      button.setAttribute('aria-pressed', String(view === state.view));
      const countNode = button.querySelector('b');
      if (countNode) countNode.textContent = String(count);
    });
  }

  function renderCoverage(view = state.view) {
    state.view = ['latest','reviews','guides','deals'].includes(view) ? view : 'latest';
    const host = $('#game-stories');
    if (!host) return;
    const sets = coverageSets();
    const items = sets[state.view] || [];
    const titles = { latest:'Connected coverage', reviews:'Reviews', guides:'Guides', deals:'Deals' };
    const title = $('#game-coverage-title');
    if (title) title.textContent = titles[state.view];
    if (state.view === 'deals') {
      host.classList.add('is-deals');
      host.innerHTML = items.length
        ? `${items.map(dealCard).join('')}<p class="nc-game-commerce-disclosure">Prices and availability can change. Some outbound links may be affiliate links; Neural Critic may earn a commission from qualifying purchases. <a href="commercial.html">Commercial disclosure</a>.</p>`
        : '<div class="nc-game-empty-state"><small>DEALS</small><h3>No verified offers right now.</h3><p>We only show live retailer offers that are mapped to this game and pass Neural Critic commerce checks.</p></div>';
    } else {
      host.classList.remove('is-deals');
      host.innerHTML = items.length ? items.map(storyCard).join('') : `<div class="nc-game-empty-state"><small>${esc(state.view.toUpperCase())}</small><h3>No ${esc(state.view)} coverage yet.</h3><p>When Neural Critic publishes eligible ${esc(state.view)} coverage for this game, it will appear here automatically.</p></div>`;
    }
    updateCoverageControls();
  }

  async function loadDeals(client, game) {
    if (!client || !game?.id) return [];
    const productsRes = await client.from('commerce_products').select('id,slug,name,category,product_type,brand,platform,active').eq('game_id', game.id).eq('active', true);
    if (productsRes.error || !(productsRes.data || []).length) return [];
    const products = productsRes.data || [];
    const offersRes = await client.from('commerce_offers').select('id,product_id,retailer_id,destination_url,affiliate_url,price,list_price,currency,availability,is_affiliate,fetched_at,expires_at').in('product_id', products.map(product => product.id));
    if (offersRes.error) return [];
    const offers = (offersRes.data || []).filter(isOfferActive);
    if (!offers.length) return [];
    const retailersRes = await client.from('commerce_retailers').select('id,slug,name,affiliate_network,active').in('id', [...new Set(offers.map(offer => offer.retailer_id))]).eq('active', true);
    if (retailersRes.error) return [];
    const retailerMap = new Map((retailersRes.data || []).map(row => [row.id, row]));
    return products.flatMap(product => {
      const candidates = offers.filter(offer => offer.product_id === product.id && retailerMap.has(offer.retailer_id)).sort((a,b) => Number(a.price) - Number(b.price));
      return candidates.length ? [{ product, offer:candidates[0], retailer:retailerMap.get(candidates[0].retailer_id) }] : [];
    });
  }

  function renderRelations(game) {
    const relations = [];
    if (game.series) relations.push(['SERIES', game.series, topicUrl('series', game.series)]);
    if (game.franchise) relations.push(['FRANCHISE', game.franchise, topicUrl('franchise', game.franchise)]);
    $('#game-relations').innerHTML = relations.map(([label, value, url]) => `<a href="${url}" data-game-entity-type="${label.toLowerCase()}" data-game-entity-name="${esc(value)}"><small>${label}</small><strong>${esc(value)}</strong><span>EXPLORE CONNECTED COVERAGE →</span></a>`).join('') || '<p class="nc-game-empty">No wider series or franchise connections are mapped yet.</p>';
  }

  function relationScore(candidate, game) {
    let score = 0;
    const reasons = [];
    if (candidate.series && game.series && slugify(candidate.series) === slugify(game.series)) { score += 10; reasons.push('SAME SERIES'); }
    if (candidate.franchise && game.franchise && slugify(candidate.franchise) === slugify(game.franchise)) { score += 8; reasons.push('SAME FRANCHISE'); }
    const genres = (candidate.genres || []).filter(value => (game.genres || []).map(slugify).includes(slugify(value)));
    score += Math.min(3, genres.length) * 2;
    if (genres.length) reasons.push(genres[0].toUpperCase());
    const platforms = (candidate.platforms || []).filter(value => (game.platforms || []).map(slugify).includes(slugify(value)));
    score += Math.min(2, platforms.length) * .5;
    return { score, reason:reasons[0] || (platforms.length ? 'SHARED PLATFORM' : 'CONNECTED') };
  }

  function renderRelatedGames(game, games) {
    const host = $('#game-related-games');
    if (!host) return;
    const ranked = games.filter(candidate => candidate.id !== game.id && candidate.slug !== game.slug).map(candidate => ({ candidate, ...relationScore(candidate, game) })).filter(item => item.score > 0).sort((a,b) => b.score - a.score || String(a.candidate.title).localeCompare(String(b.candidate.title))).slice(0,4);
    host.innerHTML = ranked.length ? ranked.map(({candidate,reason}) => `<a href="${gameUrl(candidate.slug)}" data-related-game="${esc(candidate.slug)}"><small>${esc(reason)}</small><strong>${esc(candidate.title)}</strong><span>${candidate.neural_critic_score != null ? `NC ${Number(candidate.neural_critic_score).toFixed(1)} · ` : ''}${esc(String(candidate.release_status || '').replaceAll('_',' ').toUpperCase())}</span></a>`).join('') : '<p class="nc-game-empty">Related games will appear as the database grows.</p>';
  }

  function renderTimeline(game, releases, articles) {
    const host = $('#game-timeline');
    const panel = $('#game-timeline-panel');
    if (!host || !panel) return;
    const events = [];
    (releases || []).forEach(release => {
      const when = release.release_date || '';
      if (!when) return;
      events.push({ when, ts:new Date(`${when}T00:00:00Z`).getTime(), type:'RELEASE', title:`${release.platform} release`, detail:release.region && release.region !== 'global' ? release.region : String(release.status || 'confirmed').replaceAll('_',' ') });
    });
    directGameArticles(game, articles).slice(0,8).forEach(article => {
      const when = article.publishedAt || article.published_at || article.updatedAt || article.updated_at || '';
      events.push({ when, ts:articleTime(article), type:editorialLabel(article), title:article.title, detail:article.description || '', href:storyUrl(article.slug), slug:article.slug });
    });
    const deduped = [];
    const seen = new Set();
    events.sort((a,b) => b.ts - a.ts).forEach(event => {
      const key = `${event.type}|${event.title}|${String(event.when).slice(0,10)}`;
      if (seen.has(key)) return;
      seen.add(key); deduped.push(event);
    });
    panel.hidden = !deduped.length;
    host.innerHTML = deduped.slice(0,10).map(event => `<div class="nc-game-timeline-item"><time>${esc(shortDate(event.when))}</time><span></span><div><small>${esc(event.type)}</small>${event.href ? `<a href="${event.href}" data-game-timeline-target="${esc(event.slug || '')}">${esc(event.title)}</a>` : `<strong>${esc(event.title)}</strong>`}<p>${esc(event.detail || '')}</p></div></div>`).join('');
  }

  function wireInteractions(game) {
    const page = $('#game-page');
    if (!page || page.dataset.gameHubWired === '1') return;
    page.dataset.gameHubWired = '1';
    page.addEventListener('click', event => {
      const viewButton = event.target.closest?.('[data-game-view]');
      if (viewButton) { const view = viewButton.dataset.gameView || 'latest'; renderCoverage(view); window.NeuralCriticAnalytics?.track?.('game_hub_view_change', { game_slug:game.slug, content_view:view }); return; }
      const startLink = event.target.closest?.('[data-game-start-target]');
      if (startLink) { window.NeuralCriticAnalytics?.track?.('game_hub_start_here_click', { game_slug:game.slug, target_slug:startLink.dataset.gameStartTarget || '' }); return; }
      const reviewLink = event.target.closest?.('[data-game-review-target]');
      if (reviewLink) { window.NeuralCriticAnalytics?.track?.('game_hub_review_click', { game_slug:game.slug, target_slug:reviewLink.dataset.gameReviewTarget || '' }); return; }
      const storyLink = event.target.closest?.('[data-game-story-target]');
      if (storyLink) { window.NeuralCriticAnalytics?.track?.('game_page_recirculation_click', { game_slug:game.slug, target_slug:storyLink.dataset.gameStoryTarget || '', recommendation_reason:storyLink.dataset.gameRecReason || '', content_view:state.view }); return; }
      const timelineLink = event.target.closest?.('[data-game-timeline-target]');
      if (timelineLink) { window.NeuralCriticAnalytics?.track?.('game_hub_timeline_click', { game_slug:game.slug, target_slug:timelineLink.dataset.gameTimelineTarget || '' }); return; }
      const relatedGame = event.target.closest?.('[data-related-game]');
      if (relatedGame) { window.NeuralCriticAnalytics?.track?.('game_hub_related_game_click', { game_slug:game.slug, target_game_slug:relatedGame.dataset.relatedGame || '' }); return; }
      const commerceLink = event.target.closest?.('[data-game-commerce-product]');
      if (commerceLink) { window.NeuralCriticAnalytics?.track?.('commerce_offer_click', { product_slug:commerceLink.dataset.gameCommerceProduct || '', retailer:commerceLink.dataset.gameCommerceRetailer || '', placement:'game-hub-deals', game_slug:game.slug }); return; }
      const entityLink = event.target.closest?.('[data-game-entity-type]');
      if (entityLink) window.NeuralCriticAnalytics?.track?.('game_hub_entity_click', { game_slug:game.slug, entity_type:entityLink.dataset.gameEntityType || '', entity_name:entityLink.dataset.gameEntityName || '' });
    }, true);
  }

  async function init() {
    const key = currentSlug();
    const client = window.neuralCriticPublicSupabase;
    if (!key || !client) { $('#game-title').textContent = 'Game unavailable'; return; }

    const { data:game, error } = await client.from('games').select('*').eq('slug', key).maybeSingle();
    if (error || !game) { $('#game-title').textContent = 'Game not found'; $('#game-summary').textContent = 'This game has not been added to the Neural Critic database yet.'; return; }

    const [{ data:releases }, { data:games }, articles, engine] = await Promise.all([
      client.from('game_releases').select('*').eq('game_id', game.id).order('release_date', { ascending:true }),
      client.from('games').select('id,slug,title,release_status,primary_release_date,series,franchise,genres,platforms,neural_critic_score').neq('id', game.id).limit(250),
      loadArticles(), discoveryEngine()
    ]);

    state.game = game;
    state.games = Array.isArray(games) ? games : [];
    state.releases = Array.isArray(releases) ? releases : [];
    state.articles = Array.isArray(articles) ? articles : [];
    state.directCoverage = directGameArticles(game, state.articles);
    state.coverage = connectedRecommendations(game, state.articles, engine);
    const featuredReview = reviewArticle(game, state.articles);
    if (featuredReview) {
      const alternatives = state.coverage.filter(item => item.article?.slug !== featuredReview.slug);
      if (alternatives.length >= 3) state.coverage = alternatives;
    }
    state.deals = await loadDeals(client, game);

    document.title = `${game.title} | Neural Critic Game Database`;
    document.querySelector('meta[name="description"]')?.setAttribute('content', game.summary || `${game.title} release information, platforms and Neural Critic coverage.`);
    $('#game-title').textContent = game.title;
    $('#game-status').textContent = `${String(game.release_status || 'GAME').replaceAll('_',' ').toUpperCase()} · GAME HUB`;
    $('#game-summary').textContent = game.summary || 'Neural Critic coverage and release intelligence.';

    const cover = $('#game-cover');
    if (game.cover_image_url) cover.innerHTML = `<img src="${esc(image(game.cover_image_url))}" alt="${esc(game.cover_image_alt || `${game.title} cover art`)}">`;

    const chips = [...(game.genres || []), ...(game.platforms || [])].slice(0,10);
    $('#game-chips').innerHTML = chips.map(value => `<span>${esc(value)}</span>`).join('');

    const reviewMeta = featuredReview?.reviewMeta || featuredReview?.review_meta || {};
    const effectiveScore = game.neural_critic_score ?? reviewMeta.score ?? null;
    const effectiveReviewSlug = game.score_article_slug || featuredReview?.slug || '';
    if (effectiveScore != null && String(effectiveScore).trim() && Number.isFinite(Number(effectiveScore))) {
      const score = $('#game-score');
      score.hidden = false;
      score.innerHTML = `<strong>${Number(effectiveScore).toFixed(1)}</strong><span>NEURAL CRITIC<br>SCORE</span>${effectiveReviewSlug ? `<a href="${storyUrl(effectiveReviewSlug)}" data-game-review-target="${esc(effectiveReviewSlug)}">READ REVIEW →</a>` : ''}`;
    }

    renderSignalStrip(game);
    renderStartHere(game, state.articles);
    renderFacts(game);
    renderReleases(state.releases);
    renderReviewFeature(game, state.articles);
    renderRelations(game);
    renderRelatedGames(game, state.games);
    renderTimeline(game, state.releases, state.articles);
    $('#game-links').innerHTML = game.official_url
      ? `<a href="${esc(game.official_url)}" target="_blank" rel="noopener noreferrer"><strong>Official game website</strong><span>VISIT ↗</span></a>`
      : '<p class="nc-game-empty">Official links have not been added yet.</p>';

    renderCoverage('latest');
    wireInteractions(game);
    ensureFollowOwner();

    window.NeuralCriticAnalytics?.track?.('game_page_view', {
      game_slug:game.slug,
      release_status:game.release_status || '',
      direct_story_count:state.directCoverage.length,
      connected_story_count:state.coverage.length,
      review_count:coverageSets().reviews.length,
      guide_count:coverageSets().guides.length,
      related_game_count:$('#game-related-games')?.querySelectorAll('a').length || 0,
      verified_deal_count:state.deals.length,
      recommendation_engine:engine?.related ? 'game_graph' : 'direct_fallback'
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();
})();
