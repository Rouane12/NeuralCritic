(() => {
  const slug = new URLSearchParams(location.search).get('slug');
  if (!slug) return;

  const labels = {
    'game-of-the-year': {label:'NEURAL CRITIC GAME OF THE YEAR',icon:'emoji_events',className:'is-goty'},
    'best-games': {label:'NEURAL CRITIC BEST GAMES',icon:'stars',className:'is-best'},
    'all-time-greats': {label:'NEURAL CRITIC ALL-TIME GREATS',icon:'workspace_premium',className:'is-greats'},
    'upcoming-games': {label:'NEURAL CRITIC UPCOMING GAMES',icon:'event_upcoming',className:'is-upcoming'}
  };
  const platformNames = {pc:'PC',playstation:'PlayStation',xbox:'Xbox',nintendo:'Nintendo',mobile:'Mobile'};

  const esc = (v='') => String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const collectionUrl = article => {
    const values = {collection:article.collection};
    if (article.collection === 'best-games' && Array.isArray(article.platforms) && article.platforms.length === 1) values.platform = article.platforms[0];
    if (article.collectionYear) values.year = article.collectionYear;
    return `category.html?${new URLSearchParams(values).toString()}`;
  };

  function waitForHeading(limit=50){
    return new Promise(resolve => {
      let tries=0;
      const tick=()=>{
        const heading=document.querySelector('#article h1');
        if(heading) return resolve(heading);
        if(++tries>=limit) return resolve(null);
        setTimeout(tick,100);
      };
      tick();
    });
  }

  async function init(){
    const api=window.NeuralCriticContentAPI;
    if(!api?.publishedArticle) return;
    let article;
    try{article=await api.publishedArticle(slug);}catch(_){return;}
    if(!article?.collection || !labels[article.collection]) return;
    const heading=await waitForHeading();
    if(!heading || document.querySelector('.curated-article-badge')) return;

    const meta=labels[article.collection];
    const platforms=(article.platforms||[]).map(x=>platformNames[String(x).toLowerCase()]||x).slice(0,3);
    const badge=document.createElement('div');
    badge.className=`curated-article-badge ${meta.className}`;
    badge.innerHTML=`<span class="material-symbols-rounded" aria-hidden="true">${meta.icon}</span><a href="${collectionUrl(article)}"><strong>${esc(meta.label)}</strong></a>${article.collectionYear?`<span>${esc(article.collectionYear)}</span>`:''}${platforms.length?`<span>${esc(platforms.join(' · '))}</span>`:''}`;
    heading.insertAdjacentElement('beforebegin',badge);
    document.body.classList.add('has-curated-article');
  }

  if(document.readyState==='complete') init(); else window.addEventListener('load',init,{once:true});
})();