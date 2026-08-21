(() => {
  const params = new URLSearchParams(location.search);
  const collection = params.get('collection');
  if (!collection) return;

  const platform = params.get('platform');
  const requestedYear = Number(params.get('year')) || null;
  const esc = (v='') => String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const slugify = (v='') => String(v).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const articleUrl = a => `article.html?slug=${encodeURIComponent(a.slug)}`;

  function copyForCollection(){
    if (collection === 'all-time-greats') return {
      eyebrow:'THE CURRENT CANON',
      title:'The ranking at a glance.',
      deck:'The complete order, from the first entry to Neural Critic’s current number one. Open any game to jump directly to its full argument.'
    };
    if (collection === 'best-games') return {
      eyebrow:'THE SHORTLIST',
      title:'See the ranking before you dive in.',
      deck:'A quick view of the full order. Each position links directly to the reasoning behind it.'
    };
    return {
      eyebrow:'RANKING SNAPSHOT',
      title:'The list at a glance.',
      deck:'See the full order, then open any entry for the complete editorial reasoning.'
    };
  }

  function waitForLead(limit=60){
    return new Promise(resolve => {
      let tries=0;
      const tick=()=>{
        const lead=document.querySelector('.collection-lead');
        if(lead) return resolve(lead);
        if(++tries>=limit) return resolve(null);
        setTimeout(tick,100);
      };
      tick();
    });
  }

  async function loadLeadArticle(){
    const client=window.neuralCriticPublicSupabase;
    if(!client) return null;
    const {data,error}=await client.from('articles')
      .select('slug,title,article_format,content_blocks,collection,collection_year,platforms,published_at')
      .eq('status','published')
      .eq('collection',collection)
      .lte('published_at',new Date().toISOString())
      .order('collection_year',{ascending:false,nullsFirst:false})
      .order('published_at',{ascending:false});
    if(error) throw error;
    let rows=data||[];
    if(platform) rows=rows.filter(r=>Array.isArray(r.platforms)&&r.platforms.map(x=>String(x).toLowerCase()).includes(platform));
    if(requestedYear) rows=rows.filter(r=>Number(r.collection_year)===requestedYear);
    return rows[0]||null;
  }

  function normalizedBlocks(article){
    const blocks=Array.isArray(article?.content_blocks)?article.content_blocks.filter(x=>x&&x.heading):[];
    if(!blocks.length) return [];
    const numeric=blocks.every(x=>Number.isFinite(Number(x.rank)));
    return numeric ? [...blocks].sort((a,b)=>Number(b.rank)-Number(a.rank)) : blocks;
  }

  function row(block,article){
    const rank=block.rank ? `#${esc(block.rank)}` : '—';
    const image=block.imageLocal
      ? `<img src="${esc(block.imageLocal)}" alt="${esc(block.imageAlt||block.heading||'')}">`
      : '<span class="collection-rank-placeholder">NC</span>';
    const meta=[block.developer,block.releaseYear].filter(Boolean).map(esc).join(' · ');
    const rankNumber=Number(block.rank);
    const topClass=Number.isFinite(rankNumber)&&rankNumber<=3?' is-top-three':'';
    return `<a class="collection-rank-row${topClass}" href="${articleUrl(article)}#${slugify(block.heading)}">
      <span class="collection-rank-number">${rank}</span>
      <span class="collection-rank-media">${image}</span>
      <span class="collection-rank-copy"><strong>${esc(block.heading)}</strong>${block.subtitle?`<small>${esc(block.subtitle)}</small>`:''}</span>
      <span class="collection-rank-meta">${meta}</span>
      <em aria-hidden="true">→</em>
    </a>`;
  }

  async function init(){
    try{
      const [lead,article]=await Promise.all([waitForLead(),loadLeadArticle()]);
      if(!lead||!article||article.article_format!=='ranked-list'||document.querySelector('[data-ranking-preview]')) return;
      const blocks=normalizedBlocks(article);
      if(blocks.length<2) return;
      const meta=copyForCollection();
      const section=document.createElement('section');
      section.className='collection-ranking-preview';
      section.dataset.rankingPreview='1';
      section.innerHTML=`
        <div class="collection-ranking-preview-head">
          <div><small>${meta.eyebrow}</small><h2>${meta.title}</h2></div>
          <p>${meta.deck}</p>
        </div>
        <div class="collection-ranking-list">${blocks.map(block=>row(block,article)).join('')}</div>
        <div class="collection-ranking-footer"><span>${blocks.length} ENTRIES · LIVE EDITORIAL RANKING</span><a href="${articleUrl(article)}">READ THE FULL RANKING →</a></div>`;
      lead.insertAdjacentElement('afterend',section);
    }catch(error){console.error('Collection ranking preview failed:',error);}
  }

  if(document.readyState==='complete') init(); else window.addEventListener('load',init,{once:true});
})();
