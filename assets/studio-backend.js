(() => {
  const config = window.NEURAL_CRITIC_SUPABASE;
  if (!config || !window.supabase) return;
  const client = window.supabase.createClient(config.url, config.publishableKey);
  window.neuralCriticSupabase = client;
  const $ = (s, root=document) => root.querySelector(s);
  const LOCAL_KEY = 'neural-critic-studio-stories-v1';

  function setStatus(message, cls=''){
    const el=$('#studio-auth-status'); if(!el)return;
    el.textContent=message; el.className=`studio-auth-status ${cls}`.trim();
  }
  function showGate(){ document.body.classList.add('studio-auth-pending'); $('#studio-auth-gate')?.removeAttribute('hidden'); }
  function hideGate(){ document.body.classList.remove('studio-auth-pending'); $('#studio-auth-gate')?.setAttribute('hidden',''); }
  function readLocal(){ try{return JSON.parse(localStorage.getItem(LOCAL_KEY))||[]}catch(_){return[]} }
  function writeLocal(v){ localStorage.setItem(LOCAL_KEY,JSON.stringify(v)); }
  const lines = value => String(value||'').split(/\n+/).map(x=>x.trim()).filter(Boolean);

  function selectedPlatforms(){
    return [...document.querySelectorAll('.publication-platform-options input:checked')].map(x=>x.value);
  }

  function collectArticle(status){
    const q=id=>$(id)?.value?.trim?.()||'';
    const sections=[...document.querySelectorAll('.section-card')].map(card=>{
      const obj={}; card.querySelectorAll('[data-field]').forEach(input=>{if(input.value.trim())obj[input.dataset.field]=input.value.trim()}); return obj;
    });
    const article={
      slug:q('#slug'), title:q('#title'), description:q('#description'), body:q('#body'), category:q('#category')||'FEATURE',
      author:q('#author')||'Rouane Mounssif', tags:q('#tags').split(',').map(x=>x.trim()).filter(Boolean),
      articleFormat:document.querySelector('.format-card.active')?.dataset.format||'standard',
      imageLocal:q('#featured-image'), imageAlt:q('#featured-alt'), imageCredit:q('#featured-credit'),
      homepageSlot:q('#homepage-slot')||'regular', contentBlocks:sections, status,
      scheduleAt:q('#schedule-date')||null,
      editorialSection:q('#editorial-section')||null,
      platforms:selectedPlatforms(),
      collection:q('#article-collection')||null,
      collectionYear:q('#collection-year')||null
    };
    if(article.articleFormat==='review') article.reviewMeta={score:q('#review-score'),testedPlatform:q('#review-platform'),developer:q('#review-developer'),publisher:q('#review-publisher'),releaseDate:q('#review-release'),verdict:q('#review-verdict'),pros:lines(q('#review-pros')),cons:lines(q('#review-cons')),reviewCopy:q('#review-copy')};
    else article.reviewMeta={};
    if(article.articleFormat==='ranked-list') article.quickRead=sections.slice(0,3).map(x=>x.subtitle||x.heading).filter(Boolean);
    return article;
  }

  function toRow(a,userId){
    const publishedAt=a.status==='published' ? (a.publishedAt || new Date().toISOString()) : null;
    return {
      slug:a.slug,title:a.title,description:a.description||'',body:a.body||'',category:a.category||'FEATURE',author_name:a.author||'Rouane Mounssif',
      tags:a.tags||[],article_format:a.articleFormat||'standard',image_url:a.imageLocal||null,image_alt:a.imageAlt||null,image_credit:a.imageCredit||null,
      homepage_slot:a.homepageSlot||'regular',content_blocks:a.contentBlocks||[],review_meta:a.reviewMeta||{},quick_read:a.quickRead||[],conclusion:a.conclusion||'',
      status:a.status,scheduled_at:a.status==='scheduled'&&a.scheduleAt?new Date(a.scheduleAt).toISOString():null,published_at:publishedAt,created_by:a.createdBy||userId,updated_by:userId,
      editorial_section:a.editorialSection||null,platforms:Array.isArray(a.platforms)?a.platforms:[],collection:a.collection||null,collection_year:a.collectionYear?Number(a.collectionYear):null
    };
  }

  function fromRow(r){return {
    id:r.id,slug:r.slug,title:r.title,description:r.description,body:r.body,category:r.category,author:r.author_name,tags:r.tags||[],
    articleFormat:r.article_format,imageLocal:r.image_url||'',imageAlt:r.image_alt||'',imageCredit:r.image_credit||'',homepageSlot:r.homepage_slot||'regular',
    contentBlocks:r.content_blocks||[],reviewMeta:r.review_meta||{},quickRead:r.quick_read||[],conclusion:r.conclusion||'',status:r.status,
    scheduleAt:r.scheduled_at||null,publishedAt:r.published_at||null,editorialSection:r.editorial_section||null,
    platforms:Array.isArray(r.platforms)?r.platforms:[],collection:r.collection||null,collectionYear:r.collection_year||null,
    createdBy:r.created_by||null,local:true,backend:true
  };}

  async function getEditor(user){
    const {data,error}=await client.from('editor_profiles').select('user_id,display_name,role,avatar_url,avatar_alt').eq('user_id',user.id).maybeSingle();
    if(error) throw error; return data;
  }

  async function hydrateBackend(){
    const {data,error}=await client.from('articles').select('*').order('updated_at',{ascending:false});
    if(error) throw error;
    const backend=(data||[]).map(fromRow), existing=readLocal();
    const backendSlugs=new Set(backend.map(x=>x.slug).filter(Boolean));
    // In authenticated CMS mode Supabase is the source of truth for published
    // content. Keep local drafts/scheduled work, but discard stale published
    // cache records that no longer have a matching backend article.
    const preserved=existing.filter(x=>x?.status!=='published'||backendSlugs.has(x.slug));
    const map=new Map(preserved.map(x=>[x.slug,x]));
    backend.forEach(x=>map.set(x.slug,x));
    const merged=[...map.values()];
    const changed=JSON.stringify(existing)!==JSON.stringify(merged);
    if(changed) writeLocal(merged);
    return changed;
  }

  function installAuthenticatedChrome(profile){
    const nav=document.querySelector('.studio-topbar nav'); if(!nav)return;
    nav.querySelector('.studio-user-tools')?.remove();
    const wrap=document.createElement('span'); wrap.className='studio-user-tools'; wrap.innerHTML=`<span class="studio-backend-badge">DATABASE LIVE</span><button type="button" id="studio-signout">SIGN OUT</button>`; nav.append(wrap);
    $('#studio-signout').addEventListener('click',async()=>{await client.auth.signOut();location.reload()});
    const name=nav.querySelector(':scope > span:not(.studio-user-tools)'); if(name&&profile?.display_name) name.textContent=profile.display_name;
  }

  async function saveBackend(status){
    const {data:{user}}=await client.auth.getUser(); if(!user) throw new Error('Sign in first.');
    const article=collectArticle(status); if(!article.title||!article.slug) throw new Error('Headline and URL slug are required.');
    if(status==='scheduled'&&!article.scheduleAt) throw new Error('Choose a schedule date first.');

    const {data:existing,error:existingError}=await client.from('articles')
      .select('published_at,conclusion,created_by,editorial_section,platforms,collection,collection_year')
      .eq('slug',article.slug).maybeSingle();
    if(existingError) throw existingError;

    if(existing){
      article.publishedAt=existing.published_at||null;
      article.conclusion=existing.conclusion||'';
      article.createdBy=existing.created_by||user.id;
      if(!$('#editorial-section')) article.editorialSection=existing.editorial_section||null;
      if(!document.querySelector('.publication-platform-options')) article.platforms=Array.isArray(existing.platforms)?existing.platforms:[];
      if(!$('#article-collection')) article.collection=existing.collection||null;
      if(!$('#collection-year')) article.collectionYear=existing.collection_year||null;
    }

    const row=toRow(article,user.id);
    const {error}=await client.from('articles').upsert(row,{onConflict:'slug'}); if(error) throw error;
  }

  async function deleteBackendStory(slug){
    const {data:{user}}=await client.auth.getUser();
    if(!user) throw new Error('Sign in first.');
    const {data,error}=await client.from('articles').delete().eq('slug',slug).select('slug');
    if(error) throw error;
    if(!Array.isArray(data) || !data.some(row=>row.slug===slug)){
      throw new Error('The database did not delete this story. Check the editor DELETE policy in Supabase.');
    }
    writeLocal(readLocal().filter(x=>x.slug!==slug));
  }

  function installDeleteInterceptor(){
    const library=$('#story-library');
    if(!library || library.dataset.backendDeleteReady)return;
    library.dataset.backendDeleteReady='1';
    library.addEventListener('click',async e=>{
      const del=e.target.closest('[data-delete]');
      if(!del)return;
      const slug=del.dataset.delete;
      const record=readLocal().find(x=>x.slug===slug);
      if(!record?.backend)return;

      e.preventDefault();
      e.stopImmediatePropagation();
      const title=record.title||slug;
      if(!window.confirm(`Delete “${title}” from Neural Critic? This permanently removes the database article.`))return;

      del.disabled=true;
      setStatus('Deleting story from Neural Critic database…');
      try{
        await deleteBackendStory(slug);
        setStatus('Story deleted from Neural Critic database.','success');
        setTimeout(()=>location.reload(),350);
      }catch(err){
        del.disabled=false;
        setStatus(err.message||'Database delete failed.','error');
      }
    },true);
  }

  function interceptWrites(){
    [['#save-draft','draft'],['#schedule-story','scheduled'],['#publish-story','published']].forEach(([selector,status])=>{
      const btn=$(selector); if(!btn||btn.dataset.backendWriteReady)return;
      btn.dataset.backendWriteReady='1';
      btn.addEventListener('click',()=>{setTimeout(async()=>{try{await saveBackend(status);setStatus(status==='published'?'Published to Neural Critic database.':status==='scheduled'?'Scheduled in Neural Critic database.':'Draft saved to Neural Critic database.','success')}catch(e){setStatus(e.message||'Database save failed.','error')}},0)});
    });
    const profileButton=$('#save-profile');
    if(profileButton&&!profileButton.dataset.backendWriteReady){
      profileButton.dataset.backendWriteReady='1';
      profileButton.addEventListener('click',()=>setTimeout(async()=>{
        try{const {data:{user}}=await client.auth.getUser(); if(!user)return; const payload={display_name:document.querySelector('.studio-topbar nav>span')?.textContent||'Rouane Mounssif',avatar_url:$('#profile-image').value.trim()||null,avatar_alt:$('#profile-alt').value.trim()||null}; const {error}=await client.from('editor_profiles').update(payload).eq('user_id',user.id); if(error)throw error;setStatus('Author profile saved to database.','success')}catch(e){setStatus(e.message,'error')}} ,0));
    }
    installDeleteInterceptor();
  }

  async function authenticated(user){
    const profile=await getEditor(user);
    if(!profile){showGate();setStatus('Account created, but it has not been approved as a Neural Critic editor yet.','error');return;}
    installAuthenticatedChrome(profile); interceptWrites();
    const changed=await hydrateBackend();
    if(changed){location.reload();return;}
    hideGate(); setStatus(`Signed in as ${profile.display_name||'editor'}. Database sync is active.`,'success');
  }
  async function signIn(email,password){const {data,error}=await client.auth.signInWithPassword({email,password});if(error)throw error;return data;}
  async function signUp(email,password){const {data,error}=await client.auth.signUp({email,password});if(error)throw error;return data;}
  function wireGate(){
    $('#studio-auth-form')?.addEventListener('submit',async e=>{e.preventDefault();setStatus('Signing in…');try{const email=$('#studio-email').value.trim(),password=$('#studio-password').value;const {user}=await signIn(email,password);await authenticated(user)}catch(err){setStatus(err.message||'Could not sign in.','error')}});
    $('#studio-signup')?.addEventListener('click',async()=>{const email=$('#studio-email').value.trim(),password=$('#studio-password').value;if(!email||password.length<6){setStatus('Enter an email and a password of at least 6 characters.','error');return;}setStatus('Creating account…');try{const {user,session}=await signUp(email,password);if(!user)throw new Error('Could not create account.');setStatus(session?'Account created. Waiting for editor approval.':'Account created. Check your email to confirm it, then return and sign in.','success')}catch(err){setStatus(err.message||'Could not create account.','error')}});
  }
  async function init(){
    wireGate(); showGate();
    const {data:{session}}=await client.auth.getSession();
    if(session?.user){try{await authenticated(session.user)}catch(e){setStatus(e.message||'Could not verify editor access.','error')}}
    else setStatus('Sign in with your Neural Critic editor account.');
    client.auth.onAuthStateChange(async(event,session)=>{if(event==='SIGNED_IN'&&session?.user){try{await authenticated(session.user)}catch(e){setStatus(e.message,'error')}}});
  }
  init();
})();