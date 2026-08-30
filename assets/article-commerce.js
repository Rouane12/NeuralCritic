(() => {
  'use strict';
  const articleRoot=document.getElementById('article');
  if(!articleRoot) return;
  const esc=(value='')=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function slug(){return String(window.NEURAL_CRITIC_STATIC_SLUG||new URLSearchParams(location.search).get('slug')||'').trim()}
  function client(){
    if(window.neuralCriticPublicSupabase) return window.neuralCriticPublicSupabase;
    const cfg=window.NEURAL_CRITIC_SUPABASE;
    if(!cfg||!window.supabase)return null;
    try{return window.supabase.createClient(cfg.url,cfg.publishableKey)}catch(_){return null}
  }
  function money(value,currency='USD'){
    try{return new Intl.NumberFormat('en-US',{style:'currency',currency:String(currency||'USD').toUpperCase(),maximumFractionDigits:2}).format(Number(value))}catch(_){return `${Number(value).toFixed(2)} ${currency}`}
  }
  function stamp(iso){
    const date=new Date(iso||'');
    if(!Number.isFinite(date.getTime())) return 'time unavailable';
    try{return new Intl.DateTimeFormat('en-US',{year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(date)}catch(_){return date.toISOString()}
  }
  function active(offer){
    if(!['in_stock','preorder','backorder'].includes(String(offer.availability||'')))return false;
    return !offer.expires_at||new Date(offer.expires_at).getTime()>Date.now();
  }
  async function waitForArticle(timeout=6000){
    const start=performance.now();
    while(performance.now()-start<timeout){
      if(articleRoot.querySelector('h1'))return true;
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    return false;
  }
  function insertModule(module){
    const body=articleRoot.querySelector('.article-body');
    if(body){body.prepend(module);return}
    const quick=articleRoot.querySelector('.quick-read');
    if(quick){quick.after(module);return}
    const deck=articleRoot.querySelector('.article-deck');
    if(deck){deck.after(module);return}
    articleRoot.appendChild(module);
  }

  async function init(){
    const storySlug=slug(); if(!storySlug)return;
    const supa=client(); if(!supa)return;
    const ready=await waitForArticle(); if(!ready)return;

    const articleRes=await supa.from('articles').select('id,slug,status,published_at').eq('slug',storySlug).eq('status','published').lte('published_at',new Date().toISOString()).maybeSingle();
    if(articleRes.error||!articleRes.data)return;
    const linksRes=await supa.from('commerce_article_products').select('product_id,placement,sort_order').eq('article_id',articleRes.data.id).eq('placement','where_to_buy').order('sort_order',{ascending:true});
    if(linksRes.error||!(linksRes.data||[]).length)return;
    const productIds=linksRes.data.map(x=>x.product_id);
    const [productsRes,offersRes]=await Promise.all([
      supa.from('commerce_products').select('id,slug,name,category,product_type,brand,platform,active').in('id',productIds).eq('active',true),
      supa.from('commerce_offers').select('id,product_id,retailer_id,destination_url,affiliate_url,price,list_price,currency,availability,is_affiliate,fetched_at,expires_at').in('product_id',productIds)
    ]);
    if(productsRes.error||offersRes.error)return;
    const products=new Map((productsRes.data||[]).map(row=>[row.id,row]));
    const offers=(offersRes.data||[]).filter(active);
    if(!offers.length)return;
    const retailerIds=[...new Set(offers.map(x=>x.retailer_id))];
    const retailersRes=await supa.from('commerce_retailers').select('id,slug,name,affiliate_network,active').in('id',retailerIds).eq('active',true);
    if(retailersRes.error)return;
    const retailers=new Map((retailersRes.data||[]).map(row=>[row.id,row]));

    const order=new Map(linksRes.data.map((row,index)=>[row.product_id,index]));
    const rows=[];
    productIds.forEach(productId=>{
      const product=products.get(productId); if(!product)return;
      const candidates=offers.filter(offer=>offer.product_id===productId&&retailers.has(offer.retailer_id)).sort((a,b)=>Number(a.price)-Number(b.price));
      if(!candidates.length)return;
      rows.push({product,offer:candidates[0],retailer:retailers.get(candidates[0].retailer_id),order:order.get(productId)||0});
    });
    rows.sort((a,b)=>a.order-b.order);
    if(!rows.length)return;

    const amazonRows=rows.filter(row=>row.retailer?.affiliate_network==='amazon-associates');
    const amazonFreshest=amazonRows.reduce((latest,row)=>!latest||new Date(row.offer.fetched_at)>new Date(latest)?row.offer.fetched_at:latest,null);
    const amazonNotice=amazonRows.length
      ? ` Amazon price/availability as of ${esc(stamp(amazonFreshest))}. Product prices and availability are subject to change; the information displayed on Amazon.com at purchase time will apply.`
      : '';

    const module=document.createElement('aside');
    module.className='nc-where-to-buy';
    module.dataset.ncWhereToBuy='1';
    module.setAttribute('aria-label','Where to buy');
    module.innerHTML=`<div class="nc-where-to-buy-head"><div><small>PRICE INTELLIGENCE</small><h2>Where to buy</h2></div><a href="deals.html">EXPLORE DEALS →</a></div><div class="nc-where-to-buy-list">${rows.slice(0,4).map(({product,offer,retailer})=>{
      const destination=offer.is_affiliate&&offer.affiliate_url?offer.affiliate_url:offer.destination_url;
      const reference=Number(offer.list_price)>Number(offer.price)?Number(offer.list_price):null;
      const discount=reference?Math.round((1-Number(offer.price)/reference)*100):0;
      const attrs=offer.is_affiliate?'data-affiliate="true" data-affiliate-placement="article-where-to-buy" rel="sponsored noopener noreferrer"':'rel="noopener noreferrer"';
      return `<div class="nc-buy-row"><div class="nc-buy-product"><small>${esc(product.category||'product')}</small><strong>${esc(product.name)}</strong></div><div class="nc-buy-price"><strong>${money(offer.price,offer.currency)}</strong><span>${discount?`-${discount}% · `:''}${esc(retailer.name)}</span></div><a class="nc-buy-action" href="${esc(destination)}" target="_blank" ${attrs} data-commerce-product="${esc(product.slug)}" data-commerce-retailer="${esc(retailer.slug)}">VIEW DEAL ↗</a></div>`;
    }).join('')}</div><p class="nc-buy-disclosure">Prices and availability can change. Some outbound links may be affiliate links; Neural Critic may earn a commission from qualifying purchases.${amazonNotice} <a href="commercial.html">Commercial disclosure</a>.</p>`;
    insertModule(module);

    module.addEventListener('click',event=>{
      const link=event.target.closest?.('[data-commerce-product]'); if(!link)return;
      window.NeuralCriticAnalytics?.track?.('commerce_offer_click',{product_slug:link.dataset.commerceProduct||'',retailer:link.dataset.commerceRetailer||'',placement:'article-where-to-buy',article_slug:storySlug});
    },true);
    window.NeuralCriticAnalytics?.track?.('commerce_module_rendered',{placement:'article-where-to-buy',article_slug:storySlug,product_count:rows.length});
  }

  init().catch(error=>console.warn('Article commerce module unavailable.',error));
})();
