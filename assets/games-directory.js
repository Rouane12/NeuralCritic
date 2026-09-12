(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s); const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const root=new URL(location.hostname==='rouane12.github.io'?'/NeuralCritic/':'/',location.origin);
  const gameUrl=s=>new URL(`games/${encodeURIComponent(s)}/`,root).href;
  const norm=v=>String(v||'').trim().toLowerCase();
  const slugify=v=>norm(v).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
  const fmtDate=v=>{if(!v)return 'TBA';try{return new Intl.DateTimeFormat('en',{year:'numeric',month:'short',day:'numeric',timeZone:'UTC'}).format(new Date(`${String(v).slice(0,10)}T00:00:00Z`));}catch(_){return v}};
  const yearOf=v=>v?String(v).slice(0,4):'';
  let games=[]; let releases=[]; let articles=[]; let view='all'; let sortMode='az';

  function sameGame(article,g){const key=slugify(article?.gameKey||article?.game_key||'');return Boolean(key&&(key===slugify(g.title)||key===slugify(g.slug)));}
  function coverageCount(g){return articles.filter(a=>sameGame(a,g)).length;}
  function scoreBadge(g,inline=false){if(g.neural_critic_score==null)return '';const cls=inline?'nc-game-card-score-inline':'nc-game-card-score';return `<span class="${cls}"><strong>${Number(g.neural_critic_score).toFixed(1)}</strong><span>NC</span></span>`;}
  function gameCard(g,placement='library'){
    const status=String(g.release_status||'game').replaceAll('_',' ').toUpperCase(); const stories=coverageCount(g);
    return `<a class="nc-game-library-card is-text-only" href="${gameUrl(g.slug)}" data-game-card="${esc(g.slug)}" data-game-placement="${esc(placement)}"><div class="nc-game-card-copy"><div class="nc-game-card-heading"><small>${esc(status)}</small>${scoreBadge(g,true)}</div><h3>${esc(g.title)}</h3><p>${esc([g.developer,g.primary_release_date?fmtDate(g.primary_release_date):''].filter(Boolean).join(' · '))}</p><div class="nc-game-card-footer"><div class="nc-game-card-platforms">${(g.platforms||[]).slice(0,3).map(p=>`<span>${esc(p)}</span>`).join('')}</div><b class="nc-game-card-coverage">${stories} ${stories===1?'STORY':'STORIES'}</b></div></div></a>`;
  }
  function releaseCard(r){const g=games.find(x=>x.id===r.game_id);if(!g)return '';const when=r.release_date?fmtDate(r.release_date):(r.release_window||'TBA');const platforms=(r.platforms||[r.platform]).filter(Boolean);return `<a href="${gameUrl(g.slug)}" data-release-game="${esc(g.slug)}"><time>${esc(when)}</time><div><small>${esc(platforms.join(' · ')||'Platform TBA')}</small><strong>${esc(g.title)}</strong></div><span>${esc(String(r.status||'announced').replaceAll('_',' ').toUpperCase())}</span></a>`;}
  function uniqueValues(field){return [...new Set(games.flatMap(g=>Array.isArray(g[field])?g[field]:[]).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b)));}
  function hydrateFilters(){
    $('#games-platform').insertAdjacentHTML('beforeend',uniqueValues('platforms').map(v=>`<option>${esc(v)}</option>`).join(''));
    $('#games-genre').insertAdjacentHTML('beforeend',uniqueValues('genres').map(v=>`<option>${esc(v)}</option>`).join(''));
    const years=[...new Set(games.map(g=>yearOf(g.primary_release_date)).filter(Boolean))].sort((a,b)=>b-a);$('#games-year').insertAdjacentHTML('beforeend',years.map(v=>`<option>${v}</option>`).join(''));
  }
  function filteredGames(){
    const q=norm($('#games-search').value),platform=$('#games-platform').value,genre=$('#games-genre').value,year=$('#games-year').value;const today=new Date();today.setHours(0,0,0,0);
    const rows=games.filter(g=>{const hay=norm([g.title,g.developer,g.publisher,g.franchise,g.series,(g.genres||[]).join(' '),(g.platforms||[]).join(' ')].join(' '));if(q&&!hay.includes(q))return false;if(platform&&!(g.platforms||[]).includes(platform))return false;if(genre&&!(g.genres||[]).includes(genre))return false;if(year&&yearOf(g.primary_release_date)!==year)return false;if(view==='featured')return Boolean(g.featured);if(view==='upcoming')return g.primary_release_date&&new Date(`${g.primary_release_date}T00:00:00`)>=today;if(view==='released')return g.release_status==='released';if(view==='scored')return g.neural_critic_score!=null;return true;});
    return rows.sort((a,b)=>{
      if(view==='upcoming')return String(a.primary_release_date||'9999').localeCompare(String(b.primary_release_date||'9999'));
      if(view==='scored')return Number(b.neural_critic_score||0)-Number(a.neural_critic_score||0);
      if(sortMode==='coverage')return coverageCount(b)-coverageCount(a)||String(a.sort_title||a.title).localeCompare(String(b.sort_title||b.title));
      if(sortMode==='score')return Number(b.neural_critic_score??-1)-Number(a.neural_critic_score??-1)||String(a.title).localeCompare(String(b.title));
      if(sortMode==='release')return String(b.primary_release_date||'0000').localeCompare(String(a.primary_release_date||'0000'));
      return String(a.sort_title||a.title).localeCompare(String(b.sort_title||b.title));
    });
  }
  function renderGames(){const rows=filteredGames();$('#games-grid').innerHTML=rows.map(g=>gameCard(g,'library')).join('')||'<p class="nc-games-empty">No games match these filters yet.</p>';$('#games-result-count').textContent=`${rows.length} ${rows.length===1?'GAME':'GAMES'}`;}
  function renderFeatured(){const host=$('#featured-games');if(!host)return;const featured=games.filter(g=>g.featured).sort((a,b)=>coverageCount(b)-coverageCount(a)||String(a.title).localeCompare(String(b.title))).slice(0,4);host.innerHTML=featured.map(g=>gameCard(g,'featured')).join('')||'<p class="nc-games-empty">Featured games are being curated.</p>';const count=$('#featured-games-count');if(count)count.textContent=`${featured.length} CURATED`;}
  function upcomingReleaseGroups(){const today=new Date();today.setHours(0,0,0,0);const grouped=new Map();releases.filter(r=>r.release_date&&new Date(`${r.release_date}T00:00:00`)>=today&&['confirmed','estimated','tba'].includes(String(r.status||''))).forEach(r=>{const key=[r.game_id,r.release_date,r.status||'',r.region||''].join('|');if(!grouped.has(key))grouped.set(key,{...r,platforms:[]});const row=grouped.get(key);if(r.platform&&!row.platforms.includes(r.platform))row.platforms.push(r.platform);});return [...grouped.values()].sort((a,b)=>String(a.release_date).localeCompare(String(b.release_date))||String(a.game_id).localeCompare(String(b.game_id))).slice(0,12);}
  function renderCalendar(){const upcoming=upcomingReleaseGroups();$('#release-calendar').innerHTML=upcoming.map(releaseCard).join('')||'<p class="nc-games-empty">No dated upcoming releases are in the database yet.</p>';$('#calendar-count').textContent=`${upcoming.length} UPCOMING`;}
  function renderStats(){const scored=games.filter(g=>g.neural_critic_score!=null).length;const today=new Date();today.setHours(0,0,0,0);const upcoming=games.filter(g=>g.primary_release_date&&new Date(`${g.primary_release_date}T00:00:00`)>=today).length;$('#games-directory-stats').innerHTML=`<div><strong>${games.length}</strong><span>GAMES</span></div><div><strong>${upcoming}</strong><span>UPCOMING</span></div><div><strong>${scored}</strong><span>SCORED</span></div>`;}
  async function loadArticles(){try{const live=await window.NeuralCriticContentAPI?.publishedIndex?.();if(Array.isArray(live))return live;}catch(_){}try{const r=await fetch('data/articles.json');const rows=r.ok?await r.json():[];return Array.isArray(rows)?rows:[];}catch(_){return [];}}
  function bind(){
    $$('.nc-games-tabs button').forEach(btn=>btn.addEventListener('click',()=>{$$('.nc-games-tabs button').forEach(x=>{x.classList.remove('is-active');x.setAttribute('aria-selected','false')});btn.classList.add('is-active');btn.setAttribute('aria-selected','true');view=btn.dataset.gamesView||'all';renderGames();window.NeuralCriticAnalytics?.track?.('games_directory_view_change',{view});}));
    ['games-search','games-platform','games-genre','games-year'].forEach(id=>$('#'+id)?.addEventListener(id==='games-search'?'input':'change',renderGames));
    $('#games-sort')?.addEventListener('change',event=>{sortMode=event.target.value||'az';renderGames();window.NeuralCriticAnalytics?.track?.('games_directory_sort_change',{sort:sortMode});});
    document.addEventListener('click',e=>{const card=e.target instanceof Element?e.target.closest('[data-game-card]'):null;if(card)window.NeuralCriticAnalytics?.track?.('games_directory_click',{game_slug:card.dataset.gameCard||'',placement:card.dataset.gamePlacement||'library'});const rel=e.target instanceof Element?e.target.closest('[data-release-game]'):null;if(rel)window.NeuralCriticAnalytics?.track?.('games_directory_click',{game_slug:rel.dataset.releaseGame||'',placement:'release_calendar'});});
  }
  async function init(){
    const client=window.neuralCriticPublicSupabase;if(!client)return;
    const [{data:g,error:ge},{data:r,error:re},articleRows]=await Promise.all([client.from('games').select('*').order('title'),client.from('game_releases').select('*').order('release_date',{ascending:true}),loadArticles()]);
    if(ge||re){$('#games-grid').innerHTML='<p class="nc-games-empty">The game database is temporarily unavailable.</p>';return;}
    games=g||[];releases=r||[];articles=articleRows||[];hydrateFilters();renderStats();renderFeatured();renderCalendar();renderGames();bind();window.NeuralCriticAnalytics?.track?.('games_directory_view',{game_count:games.length,release_count:releases.length,linked_story_count:articles.filter(a=>a.gameKey||a.game_key).length,featured_count:games.filter(g=>g.featured).length});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
