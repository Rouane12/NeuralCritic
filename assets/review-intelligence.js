(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const storyHref=slug=>`stories/${encodeURIComponent(slug)}/`;
  const gameHref=slug=>`games/${encodeURIComponent(slug)}/`;
  const norm=v=>String(v||'').trim().toLowerCase();
  const scoreOf=r=>{const n=Number(r.review_meta?.score);return Number.isFinite(n)?n:null};
  const fmtDate=v=>{try{return new Intl.DateTimeFormat('en',{year:'numeric',month:'short',day:'numeric'}).format(new Date(v))}catch(_){return''}};
  const platformLabel=v=>({pc:'PC',playstation:'PlayStation',xbox:'Xbox',nintendo:'Nintendo',mobile:'Mobile'}[norm(v)]||v);
  let reviews=[], view='all', gamesByTitle=new Map();

  function mapRow(r){return {slug:r.slug,title:r.title||'',description:r.description||'',gameKey:r.gameKey||r.game_key||'',platforms:Array.isArray(r.platforms)?r.platforms:[],review_meta:r.reviewMeta&&typeof r.reviewMeta==='object'?r.reviewMeta:(r.review_meta&&typeof r.review_meta==='object'?r.review_meta:{}),published_at:r.publishedAt||r.published_at||'',image_url:r.imageLocal||r.image_url||'',category:r.category||'',article_format:r.articleFormat||r.article_format||''};}
  async function loadReviews(){
    const api=window.NeuralCriticContentAPI;
    if(!api?.publishedIndex) return [];
    try{
      const data=await api.publishedIndex();
      return (data||[]).map(mapRow).filter(r=>norm(r.category)==='review'||norm(r.article_format)==='review').filter(r=>scoreOf(r)!=null);
    }catch(_){return []}
  }
  async function loadGames(){
    const api=window.NeuralCriticContentAPI;
    if(!api?.publishedGames) return [];
    try{return (await api.publishedGames()).filter(g=>g?.slug&&g?.title)}catch(_){return []}
  }
  function gameFor(review){return gamesByTitle.get(norm(review?.gameKey))||null;}
  function fillFilters(){
    const platforms=[...new Set(reviews.flatMap(r=>r.platforms.map(norm)).filter(Boolean))].sort();
    $('#review-platform').innerHTML='<option value="">All platforms</option>'+platforms.map(p=>`<option value="${esc(p)}">${esc(platformLabel(p))}</option>`).join('');
    const requested=norm(new URLSearchParams(location.search).get('platform'));
    if(requested&&platforms.includes(requested)) $('#review-platform').value=requested;
  }
  function renderStats(){
    const scores=reviews.map(scoreOf).filter(x=>x!=null), avg=scores.length?scores.reduce((a,b)=>a+b,0)/scores.length:0, elite=scores.filter(x=>x>=9.5).length;
    $('#review-stats').innerHTML=`<div><strong>${reviews.length}</strong><span>PUBLISHED<br>REVIEWS</span></div><div><strong>${avg.toFixed(1)}</strong><span>AVERAGE<br>SCORE</span></div><div><strong>${elite}</strong><span>SCORES<br>9.5+</span></div>`;
  }
  function renderScoreboard(){
    const top=[...reviews].sort((a,b)=>(scoreOf(b)||0)-(scoreOf(a)||0)||new Date(b.published_at)-new Date(a.published_at)).slice(0,5);
    $('#review-scoreboard-count').textContent=`${reviews.length} SCORED REVIEWS`;
    $('#review-scoreboard').innerHTML=top.map((r,i)=>`<a href="${storyHref(r.slug)}" data-review-target="${esc(r.slug)}" data-review-placement="scoreboard"><b>${String(i+1).padStart(2,'0')}</b><div><small>${esc(r.gameKey||r.title.replace(/\s+Review:.*/i,''))}</small><strong>${esc(r.review_meta.verdict||r.description)}</strong></div><span>${scoreOf(r).toFixed(1)}</span></a>`).join('');
  }
  function matchesView(r){const s=scoreOf(r)||0;if(view==='elite')return s>=9.5;if(view==='recommended')return s>=9;if(view==='latest')return true;return true}
  function filtered(){
    const q=norm($('#review-search').value), platform=norm($('#review-platform').value), sort=$('#review-sort').value;
    let out=reviews.filter(r=>matchesView(r)).filter(r=>!platform||r.platforms.map(norm).includes(platform)).filter(r=>!q||norm([r.title,r.gameKey,r.review_meta.developer,r.review_meta.publisher,r.review_meta.verdict,...r.platforms].join(' ')).includes(q));
    if(view==='latest'||sort==='newest')out.sort((a,b)=>new Date(b.published_at)-new Date(a.published_at));
    else if(sort==='oldest')out.sort((a,b)=>new Date(a.published_at)-new Date(b.published_at));
    else if(sort==='score-asc')out.sort((a,b)=>(scoreOf(a)||0)-(scoreOf(b)||0));
    else out.sort((a,b)=>(scoreOf(b)||0)-(scoreOf(a)||0));
    return out;
  }
  function card(r){
    const score=scoreOf(r), game=gameFor(r);
    const gameLink=game?`<a class="nc-review-game-link" href="${gameHref(game.slug)}" data-review-game-target="${esc(game.slug)}" data-review-source="${esc(r.slug)}">OPEN GAME HUB <span aria-hidden="true">→</span></a>`:'';
    return `<article class="nc-review-card"><a class="nc-review-card-media" href="${storyHref(r.slug)}" data-review-target="${esc(r.slug)}" data-review-placement="archive">${r.image_url?`<img src="${esc(r.image_url)}" alt="${esc(r.gameKey||r.title)}">`:'<div>NEURAL CRITIC</div>'}<span>${score.toFixed(1)}</span></a><div class="nc-review-card-copy"><small>${esc(r.platforms.map(platformLabel).join(' · ')||'REVIEW')}</small><h3><a href="${storyHref(r.slug)}" data-review-target="${esc(r.slug)}" data-review-placement="archive">${esc(r.gameKey||r.title.replace(/\s+Review:.*/i,''))}</a></h3><p>${esc(r.review_meta.verdict||r.description)}</p><div class="nc-review-card-meta"><span>${esc(r.review_meta.developer||'')}</span><time>${esc(fmtDate(r.published_at))}</time></div><div class="nc-review-card-actions"><a class="nc-review-read-link" href="${storyHref(r.slug)}" data-review-target="${esc(r.slug)}" data-review-placement="archive_cta">READ REVIEW <span aria-hidden="true">→</span></a>${gameLink}</div></div></article>`;
  }
  function renderGrid(){const out=filtered();$('#review-result-count').textContent=`${out.length} ${out.length===1?'REVIEW':'REVIEWS'}`;$('#review-grid').innerHTML=out.length?out.map(card).join(''):'<p class="nc-review-empty">No reviews match these filters.</p>'}
  function track(name,params={}){window.NeuralCriticAnalytics?.track?.(name,params)}
  function bind(){
    $$('.nc-review-tabs button').forEach(btn=>btn.addEventListener('click',()=>{view=btn.dataset.reviewView||'all';$$('.nc-review-tabs button').forEach(x=>{const active=x===btn;x.classList.toggle('is-active',active);x.setAttribute('aria-selected',String(active))});renderGrid();track('review_intelligence_view_change',{view});}));
    ['review-search','review-platform','review-sort'].forEach(id=>$('#'+id)?.addEventListener(id==='review-search'?'input':'change',renderGrid));
    document.addEventListener('click',e=>{
      const game=e.target instanceof Element?e.target.closest('[data-review-game-target]'):null;
      if(game){track('review_game_hub_click',{game_slug:game.dataset.reviewGameTarget||'',source_review_slug:game.dataset.reviewSource||'',placement:'review_archive'});return;}
      const a=e.target instanceof Element?e.target.closest('[data-review-target]'):null;
      if(a)track('review_intelligence_click',{target_slug:a.dataset.reviewTarget||'',placement:a.dataset.reviewPlacement||''});
    });
  }
  async function init(){
    const [loadedReviews,games]=await Promise.all([loadReviews(),loadGames()]);
    reviews=loadedReviews;
    gamesByTitle=new Map(games.map(game=>[norm(game.title),game]));
    fillFilters();renderStats();renderScoreboard();renderGrid();bind();track('review_intelligence_view',{review_count:reviews.length,scored_count:reviews.filter(r=>scoreOf(r)!=null).length,mapped_game_count:reviews.filter(r=>gameFor(r)).length});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();