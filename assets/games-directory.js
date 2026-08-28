(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s); const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const root=new URL(location.hostname==='rouane12.github.io'?'/NeuralCritic/':'/',location.origin);
  const gameUrl=s=>new URL(`games/${encodeURIComponent(s)}/`,root).href;
  const norm=v=>String(v||'').trim().toLowerCase();
  const fmtDate=v=>{if(!v)return 'TBA';try{return new Intl.DateTimeFormat('en',{year:'numeric',month:'short',day:'numeric',timeZone:'UTC'}).format(new Date(`${v}T00:00:00Z`));}catch(_){return v}};
  const yearOf=v=>v?String(v).slice(0,4):'';
  let games=[]; let releases=[]; let view='all';

  function gameCard(g){
    const score=g.neural_critic_score!=null?`<div class="nc-game-card-score"><strong>${Number(g.neural_critic_score).toFixed(1)}</strong><span>NC</span></div>`:'';
    const image=g.cover_image_url?`<img src="${esc(g.cover_image_url)}" alt="${esc(g.cover_image_alt||`${g.title} cover art`)}" loading="lazy" decoding="async">`:'<div class="nc-game-card-fallback">NEURAL<br>CRITIC</div>';
    return `<a class="nc-game-library-card" href="${gameUrl(g.slug)}" data-game-card="${esc(g.slug)}"><div class="nc-game-card-media">${image}${score}</div><div class="nc-game-card-copy"><small>${esc(String(g.release_status||'game').replaceAll('_',' ').toUpperCase())}</small><h3>${esc(g.title)}</h3><p>${esc([g.developer,g.primary_release_date?fmtDate(g.primary_release_date):''].filter(Boolean).join(' · '))}</p><div>${(g.platforms||[]).slice(0,3).map(p=>`<span>${esc(p)}</span>`).join('')}</div></div></a>`;
  }
  function releaseCard(r){
    const g=games.find(x=>x.id===r.game_id); if(!g)return '';
    const when=r.release_date?fmtDate(r.release_date):(r.release_window||'TBA');
    return `<a href="${gameUrl(g.slug)}" data-release-game="${esc(g.slug)}"><time>${esc(when)}</time><div><small>${esc(r.platform||'Platform TBA')}</small><strong>${esc(g.title)}</strong></div><span>${esc(String(r.status||'announced').replaceAll('_',' ').toUpperCase())}</span></a>`;
  }
  function uniqueValues(field){return [...new Set(games.flatMap(g=>Array.isArray(g[field])?g[field]:[]).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b)));}
  function hydrateFilters(){
    $('#games-platform').insertAdjacentHTML('beforeend',uniqueValues('platforms').map(v=>`<option>${esc(v)}</option>`).join(''));
    $('#games-genre').insertAdjacentHTML('beforeend',uniqueValues('genres').map(v=>`<option>${esc(v)}</option>`).join(''));
    const years=[...new Set(games.map(g=>yearOf(g.primary_release_date)).filter(Boolean))].sort((a,b)=>b-a);
    $('#games-year').insertAdjacentHTML('beforeend',years.map(v=>`<option>${v}</option>`).join(''));
  }
  function filteredGames(){
    const q=norm($('#games-search').value), platform=$('#games-platform').value, genre=$('#games-genre').value, year=$('#games-year').value;
    const now=new Date(); now.setHours(0,0,0,0);
    return games.filter(g=>{
      const hay=norm([g.title,g.developer,g.publisher,g.franchise,g.series,(g.genres||[]).join(' '),(g.platforms||[]).join(' ')].join(' '));
      if(q&&!hay.includes(q))return false;
      if(platform&&!(g.platforms||[]).includes(platform))return false;
      if(genre&&!(g.genres||[]).includes(genre))return false;
      if(year&&yearOf(g.primary_release_date)!==year)return false;
      if(view==='upcoming')return g.primary_release_date&&new Date(`${g.primary_release_date}T00:00:00`)>=now;
      if(view==='released')return g.release_status==='released';
      if(view==='scored')return g.neural_critic_score!=null;
      return true;
    }).sort((a,b)=>{
      if(view==='upcoming')return String(a.primary_release_date||'9999').localeCompare(String(b.primary_release_date||'9999'));
      if(view==='scored')return Number(b.neural_critic_score||0)-Number(a.neural_critic_score||0);
      return String(a.sort_title||a.title).localeCompare(String(b.sort_title||b.title));
    });
  }
  function renderGames(){const rows=filteredGames();$('#games-grid').innerHTML=rows.map(gameCard).join('')||'<p class="nc-games-empty">No games match these filters yet.</p>';$('#games-result-count').textContent=`${rows.length} ${rows.length===1?'GAME':'GAMES'}`;}
  function renderCalendar(){
    const today=new Date();today.setHours(0,0,0,0);
    const upcoming=releases.filter(r=>r.release_date&&new Date(`${r.release_date}T00:00:00`)>=today&&['confirmed','estimated','tba'].includes(String(r.status||''))).sort((a,b)=>String(a.release_date).localeCompare(String(b.release_date))).slice(0,12);
    $('#release-calendar').innerHTML=upcoming.map(releaseCard).join('')||'<p class="nc-games-empty">No dated upcoming releases are in the database yet.</p>';
    $('#calendar-count').textContent=`${upcoming.length} UPCOMING`;
  }
  function renderStats(){const scored=games.filter(g=>g.neural_critic_score!=null).length;const upcoming=games.filter(g=>g.primary_release_date&&new Date(`${g.primary_release_date}T00:00:00`)>new Date()).length;$('#games-directory-stats').innerHTML=`<div><strong>${games.length}</strong><span>GAMES</span></div><div><strong>${upcoming}</strong><span>UPCOMING</span></div><div><strong>${scored}</strong><span>SCORED</span></div>`;}
  function bind(){
    $$('.nc-games-tabs button').forEach(btn=>btn.addEventListener('click',()=>{$$('.nc-games-tabs button').forEach(x=>{x.classList.remove('is-active');x.setAttribute('aria-selected','false')});btn.classList.add('is-active');btn.setAttribute('aria-selected','true');view=btn.dataset.gamesView||'all';renderGames();window.NeuralCriticAnalytics?.track?.('games_directory_view_change',{view});}));
    ['games-search','games-platform','games-genre','games-year'].forEach(id=>$('#'+id)?.addEventListener(id==='games-search'?'input':'change',renderGames));
    document.addEventListener('click',e=>{const card=e.target instanceof Element?e.target.closest('[data-game-card]'):null;if(card)window.NeuralCriticAnalytics?.track?.('games_directory_click',{game_slug:card.dataset.gameCard||'',placement:'library'});const rel=e.target instanceof Element?e.target.closest('[data-release-game]'):null;if(rel)window.NeuralCriticAnalytics?.track?.('games_directory_click',{game_slug:rel.dataset.releaseGame||'',placement:'release_calendar'});});
  }
  async function init(){
    const client=window.neuralCriticPublicSupabase;if(!client)return;
    const [{data:g,error:ge},{data:r,error:re}]=await Promise.all([client.from('games').select('*').order('title'),client.from('game_releases').select('*').order('release_date',{ascending:true})]);
    if(ge||re){$('#games-grid').innerHTML='<p class="nc-games-empty">The game database is temporarily unavailable.</p>';return;}
    games=g||[];releases=r||[];hydrateFilters();renderStats();renderCalendar();renderGames();bind();window.NeuralCriticAnalytics?.track?.('games_directory_view',{game_count:games.length,release_count:releases.length});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();