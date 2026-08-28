(() => {
  'use strict';
  const $ = (s,r=document)=>r.querySelector(s);
  const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const root=new URL(location.hostname==='rouane12.github.io'?'/NeuralCritic/':'/',location.origin);
  const slugify=(v='')=>String(v).trim().toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
  const storyUrl=s=>new URL(`stories/${encodeURIComponent(s)}/`,root).href;
  const topicUrl=(t,v)=>new URL(`topics/${t}/${slugify(v)}/`,root).href;
  function slug(){const q=new URLSearchParams(location.search).get('slug');if(q)return q;const m=location.pathname.match(/\/games\/([^/]+)(?:\/index\.html)?\/?$/i);return m?.[1]?decodeURIComponent(m[1]):'';}
  function date(v){if(!v)return 'TBA';try{return new Intl.DateTimeFormat('en',{year:'numeric',month:'long',day:'numeric',timeZone:'UTC'}).format(new Date(`${v}T00:00:00Z`));}catch(_){return v;}}
  function image(v){if(!v)return '';try{return new URL(v,root).href}catch(_){return v}}
  async function init(){
    const key=slug(); const client=window.neuralCriticPublicSupabase;
    if(!key||!client){$('#game-title').textContent='Game unavailable';return;}
    const [{data:game,error},{data:releases}]=await Promise.all([
      client.from('games').select('*').eq('slug',key).maybeSingle(),
      client.from('games').select('id').eq('slug',key).maybeSingle().then(async r=>r.data?.id?client.from('game_releases').select('*').eq('game_id',r.data.id).order('release_date',{ascending:true}):{data:[]})
    ]);
    if(error||!game){$('#game-title').textContent='Game not found';$('#game-summary').textContent='This game has not been added to the Neural Critic database yet.';return;}
    document.title=`${game.title} | Neural Critic Game Database`;
    document.querySelector('meta[name="description"]')?.setAttribute('content',game.summary||`${game.title} release information, platforms and Neural Critic coverage.`);
    $('#game-title').textContent=game.title;
    $('#game-status').textContent=`${String(game.release_status||'GAME').toUpperCase()} · GAME DATABASE`;
    $('#game-summary').textContent=game.summary||'Neural Critic coverage and release intelligence.';
    const cover=$('#game-cover'); if(game.cover_image_url){cover.innerHTML=`<img src="${esc(image(game.cover_image_url))}" alt="${esc(game.cover_image_alt||`${game.title} cover art`)}">`;}
    const chips=[...(game.genres||[]),...(game.platforms||[])].slice(0,10); $('#game-chips').innerHTML=chips.map(x=>`<span>${esc(x)}</span>`).join('');
    if(game.neural_critic_score!=null){const score=$('#game-score');score.hidden=false;score.innerHTML=`<strong>${Number(game.neural_critic_score).toFixed(1)}</strong><span>NEURAL CRITIC<br>SCORE</span>${game.score_article_slug?`<a href="${storyUrl(game.score_article_slug)}">READ REVIEW →</a>`:''}`;}
    $('#game-facts').innerHTML=[['Release',date(game.primary_release_date)],['Developer',game.developer],['Publisher',game.publisher],['Platforms',(game.platforms||[]).join(' · ')]].filter(x=>x[1]).map(([k,v])=>`<div><small>${esc(k)}</small><strong>${esc(v)}</strong></div>`).join('');
    $('#game-releases').innerHTML=(releases||[]).map(r=>`<div><span>${esc(r.platform)}</span><strong>${esc(r.release_date?date(r.release_date):r.release_window||'TBA')}</strong><small>${esc(r.region||'worldwide')} · ${esc(r.status||'announced')}</small></div>`).join('')||'<p class="nc-game-empty">Platform-specific release records are coming soon.</p>';
    const articles=await window.NeuralCriticContentAPI?.publishedIndex?.()||[];
    const direct=articles.filter(a=>slugify(a.gameKey)===slugify(game.title)||slugify(a.gameKey)===slugify(game.slug)).slice(0,8);
    $('#game-stories').innerHTML=direct.map(a=>`<a href="${storyUrl(a.slug)}"><small>${esc(String(a.category||'STORY').toUpperCase())}</small><h3>${esc(a.title)}</h3><p>${esc(a.description||'')}</p><strong>READ STORY →</strong></a>`).join('')||'<p class="nc-game-empty">No directly connected stories yet.</p>';
    const relations=[];if(game.series)relations.push(['SERIES',game.series,topicUrl('series',game.series)]);if(game.franchise)relations.push(['FRANCHISE',game.franchise,topicUrl('franchise',game.franchise)]);
    $('#game-relations').innerHTML=relations.map(([k,v,u])=>`<a href="${u}"><small>${k}</small><strong>${esc(v)}</strong><span>EXPLORE →</span></a>`).join('')||'<p class="nc-game-empty">No wider series connections yet.</p>';
    $('#game-links').innerHTML=game.official_url?`<a href="${esc(game.official_url)}" target="_blank" rel="noopener noreferrer"><strong>Official game website</strong><span>VISIT ↗</span></a>`:'<p class="nc-game-empty">Official links have not been added yet.</p>';
    window.NeuralCriticAnalytics?.track?.('game_page_view',{game_slug:game.slug,release_status:game.release_status||'',connected_story_count:direct.length});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();