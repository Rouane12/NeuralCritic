(() => {
  'use strict';

  const articleRoot = document.getElementById('article');
  if (!articleRoot) return;

  const esc = (value = '') => String(value).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  function slug() {
    return String(window.NEURAL_CRITIC_STATIC_SLUG || new URLSearchParams(location.search).get('slug') || '').trim();
  }

  function client() {
    if (window.neuralCriticPublicSupabase) return window.neuralCriticPublicSupabase;
    const cfg = window.NEURAL_CRITIC_SUPABASE;
    if (!cfg || !window.supabase) return null;
    try { return window.supabase.createClient(cfg.url, cfg.publishableKey); } catch (_) { return null; }
  }

  function money(value, currency = 'USD') {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: String(currency || 'USD').toUpperCase(),
        maximumFractionDigits: 2,
      }).format(Number(value));
    } catch (_) {
      return `${Number(value).toFixed(2)} ${currency}`;
    }
  }

  function stamp(iso) {
    const date = new Date(iso || '');
    if (!Number.isFinite(date.getTime())) return 'time unavailable';
    try {
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
      }).format(date);
    } catch (_) {
      return date.toISOString();
    }
  }

  function active(offer) {
    if (!['in_stock', 'preorder', 'backorder'].includes(String(offer.availability || ''))) return false;
    return !offer.expires_at || new Date(offer.expires_at).getTime() > Date.now();
  }

  function isReview(article) {
    return String(article?.article_format || '').toLowerCase() === 'review'
      || String(article?.category || '').toUpperCase() === 'REVIEW';
  }

  function safeHttpsUrl(value) {
    try {
      const url = new URL(String(value || ''));
      return url.protocol === 'https:' ? url.href : '';
    } catch (_) {
      return '';
    }
  }

  async function waitForArticle(timeout = 6000) {
    const start = performance.now();
    while (performance.now() - start < timeout) {
      if (articleRoot.querySelector('h1')) return true;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return false;
  }

  async function waitForReviewSidebar(timeout = 2500) {
    const start = performance.now();
    while (performance.now() - start < timeout) {
      const sidebar = articleRoot.querySelector('.work-article-sidebar');
      if (sidebar) return sidebar;
      await new Promise(resolve => setTimeout(resolve, 80));
    }
    return articleRoot.querySelector('.work-article-sidebar');
  }

  async function insertModule(module, article, { sidebarPreferred = false } = {}) {
    if (sidebarPreferred && isReview(article)) {
      const sidebar = await waitForReviewSidebar();
      if (sidebar) {
        module.classList.add('work-side-card', 'nc-where-to-buy--sidebar');
        const toc = sidebar.querySelector(':scope > .work-toc');
        if (toc) toc.insertAdjacentElement('afterend', module);
        else sidebar.prepend(module);
        return 'review-sidebar';
      }
    }

    const body = articleRoot.querySelector('.article-body');
    if (body) {
      body.prepend(module);
      return 'article-body';
    }
    const quick = articleRoot.querySelector('.quick-read');
    if (quick) {
      quick.after(module);
      return 'after-quick-read';
    }
    const deck = articleRoot.querySelector('.article-deck');
    if (deck) {
      deck.after(module);
      return 'after-deck';
    }
    articleRoot.appendChild(module);
    return 'article-root';
  }

  function renderOfferRows(rows) {
    return rows.slice(0, 4).map(({ product, offer, retailer }) => {
      const destination = offer.is_affiliate && offer.affiliate_url ? offer.affiliate_url : offer.destination_url;
      const reference = Number(offer.list_price) > Number(offer.price) ? Number(offer.list_price) : null;
      const discount = reference ? Math.round((1 - Number(offer.price) / reference) * 100) : 0;
      const attrs = offer.is_affiliate
        ? 'data-affiliate="true" data-affiliate-placement="article-where-to-buy" rel="sponsored noopener noreferrer"'
        : 'rel="noopener noreferrer"';

      return `<div class="nc-buy-row">
        <div class="nc-buy-product">
          <small>${esc(product.platform || product.category || 'game')}</small>
          <strong>${esc(product.name)}</strong>
        </div>
        <div class="nc-buy-price">
          <strong>${money(offer.price, offer.currency)}</strong>
          <span>${discount ? `-${discount}% · ` : ''}${esc(retailer.name)}</span>
        </div>
        <a class="nc-buy-action" href="${esc(destination)}" target="_blank" ${attrs}
          data-commerce-product="${esc(product.slug)}"
          data-commerce-retailer="${esc(retailer.slug)}">VIEW DEAL ↗</a>
      </div>`;
    }).join('');
  }

  async function renderLiveOfferModule(article, links, supa, storySlug) {
    if (!(links || []).length) return false;

    const productIds = links.map(x => x.product_id);
    const [productsRes, offersRes] = await Promise.all([
      supa.from('commerce_products')
        .select('id,slug,name,category,product_type,brand,platform,active')
        .in('id', productIds)
        .eq('active', true),
      supa.from('commerce_offers')
        .select('id,product_id,retailer_id,destination_url,affiliate_url,price,list_price,currency,availability,is_affiliate,fetched_at,expires_at')
        .in('product_id', productIds),
    ]);
    if (productsRes.error || offersRes.error) return false;

    const products = new Map((productsRes.data || []).map(row => [row.id, row]));
    const offers = (offersRes.data || []).filter(active);
    if (!offers.length) return false;

    const retailerIds = [...new Set(offers.map(x => x.retailer_id))];
    const retailersRes = await supa.from('commerce_retailers')
      .select('id,slug,name,affiliate_network,active')
      .in('id', retailerIds)
      .eq('active', true);
    if (retailersRes.error) return false;

    const retailers = new Map((retailersRes.data || []).map(row => [row.id, row]));
    const order = new Map(links.map((row, index) => [row.product_id, index]));
    const rows = [];

    productIds.forEach(productId => {
      const product = products.get(productId);
      if (!product) return;
      const candidates = offers
        .filter(offer => offer.product_id === productId && retailers.has(offer.retailer_id))
        .sort((a, b) => Number(a.price) - Number(b.price));
      if (!candidates.length) return;
      rows.push({
        product,
        offer: candidates[0],
        retailer: retailers.get(candidates[0].retailer_id),
        order: order.get(productId) || 0,
      });
    });

    rows.sort((a, b) => a.order - b.order);
    if (!rows.length) return false;

    const amazonRows = rows.filter(row => row.retailer?.affiliate_network === 'amazon-associates');
    const amazonFreshest = amazonRows.reduce(
      (latest, row) => !latest || new Date(row.offer.fetched_at) > new Date(latest) ? row.offer.fetched_at : latest,
      null
    );
    const amazonNotice = amazonRows.length
      ? ` Amazon price/availability as of ${esc(stamp(amazonFreshest))}. Product prices and availability are subject to change; the information displayed on Amazon.com at purchase time will apply.`
      : '';

    const module = document.createElement(isReview(article) ? 'section' : 'aside');
    module.className = 'nc-where-to-buy nc-where-to-buy--offers';
    module.dataset.ncWhereToBuy = 'offers';
    module.setAttribute('aria-label', 'Where to buy');
    module.innerHTML = `
      <div class="nc-where-to-buy-head">
        <div><small>PRICE INTELLIGENCE</small><h2>Where to buy</h2></div>
        <a href="deals.html">EXPLORE DEALS →</a>
      </div>
      <div class="nc-where-to-buy-list">${renderOfferRows(rows)}</div>
      <p class="nc-buy-disclosure">
        Prices and availability can change. Some outbound links may be affiliate links; Neural Critic may earn a commission from qualifying purchases.${amazonNotice}
        <a href="commercial.html">Commercial disclosure</a>.
      </p>`;

    const placement = await insertModule(module, article, { sidebarPreferred: true });

    module.addEventListener('click', event => {
      const link = event.target.closest?.('[data-commerce-product]');
      if (!link) return;
      window.NeuralCriticAnalytics?.track?.('commerce_offer_click', {
        product_slug: link.dataset.commerceProduct || '',
        retailer: link.dataset.commerceRetailer || '',
        placement: placement === 'review-sidebar' ? 'review-where-to-buy' : 'article-where-to-buy',
        article_slug: storySlug,
      });
    }, true);

    window.NeuralCriticAnalytics?.track?.('commerce_module_rendered', {
      placement: placement === 'review-sidebar' ? 'review-where-to-buy' : 'article-where-to-buy',
      article_slug: storySlug,
      product_count: rows.length,
      mode: 'verified-offers',
    });
    return true;
  }

  function storefrontsFromGame(game) {
    const raw = game?.metadata?.storefronts;
    if (!Array.isArray(raw)) return [];

    return raw.map((entry, index) => {
      const url = safeHttpsUrl(entry?.url);
      const platform = String(entry?.platform || '').trim();
      const store = String(entry?.store || '').trim();
      const affiliate = entry?.affiliate === true;
      if (!url || !platform || !store || affiliate) return null;
      return {
        index,
        platform,
        store,
        url,
        region: String(entry?.region || 'global').trim() || 'global',
        verifiedAt: String(entry?.verifiedAt || '').trim(),
        source: String(entry?.source || '').trim(),
      };
    }).filter(Boolean);
  }

  async function findGame(supa, gameKey) {
    const key = String(gameKey || '').trim();
    if (!key) return null;

    let response = await supa.from('games')
      .select('id,slug,title,platforms,official_url,metadata')
      .eq('title', key)
      .maybeSingle();
    if (!response.error && response.data) return response.data;

    response = await supa.from('games')
      .select('id,slug,title,platforms,official_url,metadata')
      .eq('slug', key)
      .maybeSingle();
    return response.error ? null : response.data;
  }

  function buildStorefrontOptions(storefronts) {
    return storefronts.map((entry, index) => {
      const label = entry.store.toLowerCase().includes(entry.platform.toLowerCase())
        ? entry.store
        : `${entry.platform} · ${entry.store}`;
      return `<option value="${index}">${esc(label)}</option>`;
    }).join('');
  }

  async function renderReviewStorefrontFallback(article, supa, storySlug) {
    if (!isReview(article) || !article.game_key) return false;

    const game = await findGame(supa, article.game_key);
    if (!game) return false;

    const storefronts = storefrontsFromGame(game);
    if (!storefronts.length) return false;

    const module = document.createElement('section');
    module.className = 'nc-where-to-buy nc-where-to-buy--storefront';
    module.dataset.ncWhereToBuy = 'storefront';
    module.setAttribute('aria-label', `Where to buy ${game.title}`);

    const selectId = `nc-buy-platform-${String(storySlug).replace(/[^a-z0-9_-]+/gi, '-')}`;
    const first = storefronts[0];
    module.innerHTML = `
      <div class="nc-where-to-buy-head">
        <div><small>OFFICIAL STOREFRONTS</small><h2>Where to buy</h2></div>
      </div>
      <div class="nc-storefront-game">
        <strong>${esc(game.title)}</strong>
        <span>Choose a direct store link</span>
      </div>
      ${storefronts.length > 1 ? `
        <label class="nc-storefront-label" for="${esc(selectId)}">Platform</label>
        <div class="nc-storefront-select-wrap">
          <select class="nc-storefront-select" id="${esc(selectId)}" data-storefront-select>
            ${buildStorefrontOptions(storefronts)}
          </select>
        </div>` : `
        <div class="nc-storefront-single">
          <small>PLATFORM</small>
          <strong>${esc(first.platform)} · ${esc(first.store)}</strong>
        </div>`}
      <a class="nc-buy-action nc-storefront-action" href="${esc(first.url)}" target="_blank" rel="noopener noreferrer"
        data-storefront-action
        data-commerce-product="${esc(game.slug)}"
        data-commerce-retailer="${esc(first.store)}"
        data-commerce-platform="${esc(first.platform)}">VIEW ON ${esc(first.store.toUpperCase())} ↗</a>
      <p class="nc-buy-disclosure nc-storefront-disclosure">
        Direct links to official storefronts. Prices and availability are set by the retailer and may vary by region.
        Neural Critic currently receives no commission from these links.
      </p>`;

    const placement = await insertModule(module, article, { sidebarPreferred: true });
    const select = module.querySelector('[data-storefront-select]');
    const action = module.querySelector('[data-storefront-action]');

    const applySelection = index => {
      const selected = storefronts[index] || storefronts[0];
      if (!action || !selected) return;
      action.href = selected.url;
      action.textContent = `VIEW ON ${selected.store.toUpperCase()} ↗`;
      action.dataset.commerceRetailer = selected.store;
      action.dataset.commercePlatform = selected.platform;
      action.setAttribute('aria-label', `Buy ${game.title} for ${selected.platform} on ${selected.store}`);
    };

    applySelection(0);

    select?.addEventListener('change', () => {
      const index = Number(select.value);
      applySelection(Number.isInteger(index) ? index : 0);
      const selected = storefronts[index] || storefronts[0];
      window.NeuralCriticAnalytics?.track?.('commerce_storefront_selected', {
        article_slug: storySlug,
        game_slug: game.slug,
        platform: selected.platform,
        store: selected.store,
        placement: placement === 'review-sidebar' ? 'review-where-to-buy' : 'article-where-to-buy',
      });
    });

    action?.addEventListener('click', () => {
      window.NeuralCriticAnalytics?.track?.('commerce_storefront_click', {
        article_slug: storySlug,
        game_slug: game.slug,
        platform: action.dataset.commercePlatform || '',
        store: action.dataset.commerceRetailer || '',
        placement: placement === 'review-sidebar' ? 'review-where-to-buy' : 'article-where-to-buy',
        affiliate: false,
      });
    }, true);

    window.NeuralCriticAnalytics?.track?.('commerce_storefront_rendered', {
      article_slug: storySlug,
      game_slug: game.slug,
      storefront_count: storefronts.length,
      placement: placement === 'review-sidebar' ? 'review-where-to-buy' : 'article-where-to-buy',
      affiliate: false,
    });
    return true;
  }

  async function init() {
    const storySlug = slug();
    if (!storySlug) return;

    const supa = client();
    if (!supa) return;

    const ready = await waitForArticle();
    if (!ready) return;

    const articleRes = await supa.from('articles')
      .select('id,slug,status,published_at,category,article_format,game_key')
      .eq('slug', storySlug)
      .eq('status', 'published')
      .lte('published_at', new Date().toISOString())
      .maybeSingle();
    if (articleRes.error || !articleRes.data) return;

    const article = articleRes.data;
    const linksRes = await supa.from('commerce_article_products')
      .select('product_id,placement,sort_order')
      .eq('article_id', article.id)
      .eq('placement', 'where_to_buy')
      .order('sort_order', { ascending: true });

    if (!linksRes.error && (linksRes.data || []).length) {
      const renderedOffers = await renderLiveOfferModule(article, linksRes.data, supa, storySlug);
      if (renderedOffers) return;
    }

    await renderReviewStorefrontFallback(article, supa, storySlug);
  }

  init().catch(error => console.warn('Article commerce module unavailable.', error));
})();
