(() => {
  'use strict';
  const host = document.getElementById('home-commerce');
  if (!host) return;
  const esc = (value='') => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function client(){
    if (window.neuralCriticPublicSupabase) return window.neuralCriticPublicSupabase;
    const cfg=window.NEURAL_CRITIC_SUPABASE;
    if (!cfg || !window.supabase) return null;
    try{return window.supabase.createClient(cfg.url,cfg.publishableKey)}catch(_){return null}
  }
  function money(value,currency='USD'){
    try{return new Intl.NumberFormat('en-US',{style:'currency',currency:String(currency||'USD').toUpperCase(),maximumFractionDigits:2}).format(Number(value))}catch(_){return `${Number(value).toFixed(2)} ${currency}`}
  }
  function active(offer){
    if (!['in_stock','preorder'].includes(String(offer.availability||''))) return false;
    return !offer.expires_at || new Date(offer.expires_at).getTime()>Date.now();
  }

  async function init(){
    const supa=client(); if(!supa) return;
    const offersRes=await supa.from('commerce_offers').select('id,product_id,retailer_id,price,list_price,currency,availability,is_affiliate,affiliate_url,destination_url,fetched_at,expires_at').order('fetched_at',{ascending:false}).limit(60);
    if(offersRes.error) return;
    const offers=(offersRes.data||[]).filter(active);
    if(!offers.length) return;
    const productIds=[...new Set(offers.map(x=>x.product_id))];
    const retailerIds=[...new Set(offers.map(x=>x.retailer_id))];
    const [productsRes,retailersRes]=await Promise.all([
      supa.from('commerce_products').select('id,slug,name,category,image_url,image_alt,active').in('id',productIds).eq('active',true),
      supa.from('commerce_retailers').select('id,slug,name,active').in('id',retailerIds).eq('active',true)
    ]);
    if(productsRes.error||retailersRes.error) return;
    const products=new Map((productsRes.data||[]).map(x=>[x.id,x]));
    const retailers=new Map((retailersRes.data||[]).map(x=>[x.id,x]));
    const best=[];
    offers.forEach(offer=>{
      if(!products.has(offer.product_id)||!retailers.has(offer.retailer_id)) return;
      const current=best.find(x=>x.product_id===offer.product_id);
      if(!current||Number(offer.price)<Number(current.price)){
        if(current) best.splice(best.indexOf(current),1);
        best.push(offer);
      }
    });
    best.sort((a,b)=>{
      const da=Number(a.list_price)>Number(a.price)?1-Number(a.price)/Number(a.list_price):0;
      const db=Number(b.list_price)>Number(b.price)?1-Number(b.price)/Number(b.list_price):0;
      return db-da || new Date(b.fetched_at)-new Date(a.fetched_at);
    });
    const picks=best.slice(0,3);
    if(!picks.length) return;
    host.innerHTML=`<div class="home-commerce-shell"><div class="home-commerce-head"><div><small>PRICE INTELLIGENCE</small><h2>Deals worth your attention.</h2><p>Verified game and hardware prices with useful context. Retailer pricing never changes Neural Critic's editorial verdicts.</p></div><a href="deals.html">EXPLORE ALL DEALS →</a></div><div class="home-commerce-grid">${picks.map(offer=>{
      const product=products.get(offer.product_id), retailer=retailers.get(offer.retailer_id);
      const reference=Number(offer.list_price)>Number(offer.price)?Number(offer.list_price):null;
      const discount=reference?Math.round((1-Number(offer.price)/reference)*100):0;
      const url=offer.is_affiliate&&offer.affiliate_url?offer.affiliate_url:offer.destination_url;
      const attrs=offer.is_affiliate?'data-affiliate="true" data-affiliate-placement="homepage-price-intelligence" rel="sponsored noopener noreferrer"':'rel="noopener noreferrer"';
      return `<a class="home-commerce-card" href="${esc(url)}" target="_blank" ${attrs} data-commerce-product="${esc(product.slug)}" data-commerce-retailer="${esc(retailer.slug)}"><div class="home-commerce-media">${product.image_url?`<img loading="lazy" src="${esc(product.image_url)}" alt="${esc(product.image_alt||product.name)}">`:'NC'}</div><div class="home-commerce-copy"><small>${esc(product.category||'deal')}</small><strong>${esc(product.name)}</strong><span>${esc(retailer.name)}</span></div><div class="home-commerce-price"><strong>${money(offer.price,offer.currency)}</strong>${discount?`<span>-${discount}%</span>`:''}</div></a>`;
    }).join('')}</div><p class="home-commerce-note">Some outbound links may be affiliate links. Neural Critic may earn a commission from qualifying purchases. <a href="commercial.html">Commercial disclosure</a>.</p></div>`;
    host.hidden=false;
    host.addEventListener('click',event=>{
      const link=event.target.closest?.('[data-commerce-product]'); if(!link)return;
      window.NeuralCriticAnalytics?.track?.('commerce_offer_click',{product_slug:link.dataset.commerceProduct||'',retailer:link.dataset.commerceRetailer||'',placement:'homepage-price-intelligence'});
    },true);
  }
  init().catch(error=>console.warn('Homepage commerce module unavailable.',error));
})();
