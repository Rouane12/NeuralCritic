(() => {
  'use strict';

  const root = document.getElementById('commerce-page');
  if (!root) return;

  const $ = (selector, host=document) => host.querySelector(selector);
  const escapeHtml = (value='') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const state = { products:[], retailers:new Map(), offers:[], history:[], query:'', category:'all', sort:'signal' };

  function client(){
    if (window.neuralCriticPublicSupabase) return window.neuralCriticPublicSupabase;
    const cfg = window.NEURAL_CRITIC_SUPABASE;
    if (!cfg || !window.supabase) return null;
    try { return window.supabase.createClient(cfg.url, cfg.publishableKey); }
    catch (_) { return null; }
  }

  function money(value, currency='USD'){
    const amount = Number(value);
    if (!Number.isFinite(amount)) return '—';
    try { return new Intl.NumberFormat('en-US',{style:'currency',currency:String(currency||'USD').toUpperCase(),maximumFractionDigits:2}).format(amount); }
    catch (_) { return `${amount.toFixed(2)} ${currency||'USD'}`; }
  }

  function freshness(iso){
    if (!iso) return 'Update time unavailable';
    const ms = Date.now() - new Date(iso).getTime();
    if (!Number.isFinite(ms)) return 'Update time unavailable';
    const minutes = Math.max(0, Math.floor(ms / 60000));
    if (minutes < 2) return 'Updated moments ago';
    if (minutes < 60) return `Updated ${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Updated ${hours} ${hours===1?'hour':'hours'} ago`;
    const days = Math.floor(hours / 24);
    return `Updated ${days} ${days===1?'day':'days'} ago`;
  }

  function absoluteStamp(iso){
    if (!iso) return 'time unavailable';
    const date = new Date(iso);
    if (!Number.isFinite(date.getTime())) return 'time unavailable';
    try {
      return new Intl.DateTimeFormat('en-US',{
        year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'
      }).format(date);
    } catch (_) {
      return date.toISOString();
    }
  }

  function activeOffer(offer){
    if (!['in_stock','preorder','backorder'].includes(String(offer.availability||''))) return false;
    if (!offer.expires_at) return true;
    return new Date(offer.expires_at).getTime() > Date.now();
  }

  function productView(product){
    const offers = state.offers.filter(offer => offer.product_id === product.id && activeOffer(offer));
    const sortedOffers = [...offers].sort((a,b) => Number(a.price)-Number(b.price));
    const best = sortedOffers[0] || null;
    const historyPrices = sortedOffers.flatMap(offer => state.history.filter(row => row.offer_id === offer.id).map(row => Number(row.price))).filter(Number.isFinite);
    const historicalLow = historyPrices.length ? Math.min(...historyPrices) : null;
    const current = best ? Number(best.price) : null;
    const reference = best && Number(best.list_price) > current ? Number(best.list_price) : Number(product.msrp) > current ? Number(product.msrp) : null;
    const discount = reference && current != null ? Math.max(0, Math.round((1 - current/reference) * 100)) : 0;
    const atHistoricalLow = current != null && historicalLow != null && current <= historicalLow + 0.01;
    const freshest = sortedOffers.reduce((latest,offer) => !latest || new Date(offer.fetched_at) > new Date(latest) ? offer.fetched_at : latest, null);
    return { product, offers:sortedOffers, best, historicalLow, current, reference, discount, atHistoricalLow, freshest };
  }

  function signalScore(view){
    let score = view.product.featured ? 20 : 0;
    score += Math.min(view.discount, 50);
    if (view.atHistoricalLow) score += 30;
    if (view.best?.availability === 'in_stock') score += 8;
    const ageHours = view.freshest ? (Date.now()-new Date(view.freshest).getTime())/36e5 : 999;
    score += Math.max(0, 10-Math.min(10,ageHours));
    return score;
  }

  function filteredViews(){
    const q = state.query.trim().toLowerCase();
    const views = state.products.map(productView).filter(view => view.best).filter(view => {
      if (state.category !== 'all' && view.product.category !== state.category) return false;
      if (!q) return true;
      const haystack = [view.product.name,view.product.brand,view.product.model,view.product.product_type,view.product.platform,view.product.category].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });
    if (state.sort === 'discount') views.sort((a,b)=>b.discount-a.discount || a.current-b.current);
    else if (state.sort === 'price-asc') views.sort((a,b)=>a.current-b.current);
    else if (state.sort === 'fresh') views.sort((a,b)=>new Date(b.freshest||0)-new Date(a.freshest||0));
    else views.sort((a,b)=>signalScore(b)-signalScore(a) || a.current-b.current);
    return views;
  }

  function card(view){
    const {product,best,current,reference,discount,atHistoricalLow,historicalLow,freshest} = view;
    const retailer = state.retailers.get(best.retailer_id);
    const isAmazon = retailer?.affiliate_network === 'amazon-associates';
    const destination = best.is_affiliate && best.affiliate_url ? best.affiliate_url : best.destination_url;
    const affiliateAttrs = best.is_affiliate
      ? 'data-affiliate="true" data-affiliate-placement="deals-grid" rel="sponsored noopener noreferrer"'
      : 'rel="noopener noreferrer"';
    const badges = [
      atHistoricalLow ? '<span class="commerce-badge low">Historical low</span>' : '',
      discount > 0 ? `<span class="commerce-badge discount">-${discount}%</span>` : '',
      best.availability === 'preorder' ? '<span class="commerce-badge">Preorder</span>' : ''
    ].join('');
    const media = product.image_url
      ? `<img loading="lazy" decoding="async" src="${escapeHtml(product.image_url)}" alt="${escapeHtml(product.image_alt||product.name)}">`
      : '<div class="commerce-placeholder">PRICE INTELLIGENCE</div>';
    const meta = [product.brand,product.product_type,product.platform].filter(Boolean).join(' · ');
    const lowText = historicalLow != null ? ` · Recorded low ${money(historicalLow,best.currency)}` : '';
    const providerDisclosure = isAmazon
      ? `<p class="commerce-provider-disclosure"><strong>Amazon price/availability as of ${escapeHtml(absoluteStamp(freshest))}.</strong> Product prices and availability are subject to change. Any price and availability information displayed on Amazon.com at the time of purchase will apply.</p>`
      : '';
    return `<article class="commerce-card ${atHistoricalLow?'is-historical-low':''}" data-product-slug="${escapeHtml(product.slug)}">
      <div class="commerce-card-media">${media}<div class="commerce-badges">${badges}</div></div>
      <div class="commerce-card-body">
        <span class="commerce-card-kicker">${escapeHtml(product.category||'product')}</span>
        <h2>${escapeHtml(product.name)}</h2>
        <p class="commerce-card-meta">${escapeHtml(meta||'Gaming product')}</p>
        <div class="commerce-price-row">
          <div class="commerce-price"><strong>${money(current,best.currency)}</strong>${reference?`<del>${money(reference,best.currency)}</del>`:''}</div>
          <div class="commerce-retailer"><strong>${escapeHtml(retailer?.name||'Retailer')}</strong><span>${escapeHtml(String(best.availability||'unknown').replaceAll('_',' '))}</span></div>
        </div>
        <div class="commerce-card-actions"><a href="${escapeHtml(destination)}" target="_blank" ${affiliateAttrs} data-commerce-product="${escapeHtml(product.slug)}" data-commerce-retailer="${escapeHtml(retailer?.slug||'unknown')}">View deal ↗</a></div>
        <div class="commerce-freshness">${escapeHtml(freshness(freshest))}${escapeHtml(lowText)}</div>
        ${providerDisclosure}
      </div>
    </article>`;
  }

  function render(){
    const grid = $('#commerce-grid');
    const views = filteredViews();
    const allViews = state.products.map(productView).filter(view=>view.best);
    const offers = allViews.reduce((sum,view)=>sum+view.offers.length,0);
    const lows = allViews.filter(view=>view.atHistoricalLow).length;
    const summary = $('#commerce-summary');
    summary.hidden = !allViews.length;
    $('#commerce-product-count').textContent = String(allViews.length);
    $('#commerce-offer-count').textContent = String(offers);
    $('#commerce-low-count').textContent = String(lows);

    if (!allViews.length) {
      grid.innerHTML = `<div class="commerce-empty"><small>PRICE FEED WARMING UP</small><h2>The infrastructure is live. The retailer feed isn't.</h2><p>Neural Critic will not invent sample discounts to make this page look populated. Verified game and hardware offers will appear here as soon as a retailer or affiliate feed is connected.</p><a href="index.html">Browse current coverage →</a></div>`;
      $('#commerce-feed-status').textContent = 'Price engine ready';
      $('#commerce-feed-freshness').textContent = 'Waiting for the first verified retailer feed. No placeholder prices are being shown.';
      return;
    }

    $('#commerce-feed-status').textContent = `${offers} live ${offers===1?'offer':'offers'}`;
    const newest = allViews.reduce((latest,view)=>!latest || new Date(view.freshest)>new Date(latest)?view.freshest:latest,null);
    $('#commerce-feed-freshness').textContent = newest ? freshness(newest) : 'Verified offers available.';

    if (!views.length) {
      grid.innerHTML = `<div class="commerce-empty"><small>NO MATCHES</small><h2>No verified offers match those filters.</h2><p>Try another search or category. Neural Critic only shows products with active price data.</p></div>`;
      return;
    }
    grid.innerHTML = views.map(card).join('');
  }

  function bindControls(){
    $('#commerce-search')?.addEventListener('input', event => { state.query=event.target.value||''; render(); });
    $('#commerce-category')?.addEventListener('change', event => { state.category=event.target.value||'all'; render(); });
    $('#commerce-sort')?.addEventListener('change', event => { state.sort=event.target.value||'signal'; render(); });
    document.addEventListener('click', event => {
      const link = event.target.closest?.('a[data-commerce-product]');
      if (!link) return;
      window.NeuralCriticAnalytics?.track?.('commerce_offer_click', {
        product_slug: link.dataset.commerceProduct || '',
        retailer: link.dataset.commerceRetailer || '',
        placement: 'deals-grid'
      });
    }, true);
  }

  async function load(){
    const supa = client();
    if (!supa) throw new Error('Public price client unavailable');
    const [productsRes,retailersRes,offersRes] = await Promise.all([
      supa.from('commerce_products').select('id,slug,name,category,product_type,brand,model,platform,image_url,image_alt,msrp,currency,featured,active').eq('active',true),
      supa.from('commerce_retailers').select('id,slug,name,region,affiliate_network,active').eq('active',true),
      supa.from('commerce_offers').select('id,product_id,retailer_id,destination_url,affiliate_url,price,list_price,currency,availability,item_condition,region,is_affiliate,fetched_at,expires_at')
    ]);
    if (productsRes.error) throw productsRes.error;
    if (retailersRes.error) throw retailersRes.error;
    if (offersRes.error) throw offersRes.error;
    state.products = productsRes.data || [];
    state.retailers = new Map((retailersRes.data||[]).map(row=>[row.id,row]));
    state.offers = (offersRes.data||[]).filter(activeOffer);

    const offerIds = state.offers.map(row=>row.id);
    if (offerIds.length) {
      const historyRes = await supa.from('commerce_price_history').select('offer_id,price,captured_at').in('offer_id',offerIds).order('captured_at',{ascending:false}).limit(5000);
      if (!historyRes.error) state.history = historyRes.data || [];
    }
  }

  async function init(){
    bindControls();
    try {
      await load();
      render();
      window.NeuralCriticAnalytics?.track?.('commerce_page_loaded', {
        product_count: state.products.length,
        live_offer_count: state.offers.length
      });
    } catch (error) {
      console.warn('Neural Critic commerce feed failed to load.',error);
      $('#commerce-grid').innerHTML = `<div class="commerce-empty"><small>PRICE SIGNAL INTERRUPTED</small><h2>The price feed couldn't be loaded.</h2><p>The editorial site is fine. This commerce layer failed independently and can be retried later without affecting Neural Critic stories or reviews.</p><a href="index.html">Return to Neural Critic →</a></div>`;
      $('#commerce-feed-status').textContent = 'Price feed unavailable';
      $('#commerce-feed-freshness').textContent = 'Commerce data failed independently from the editorial runtime.';
    }
  }

  init();
})();
