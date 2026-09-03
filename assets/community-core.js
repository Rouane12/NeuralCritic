(() => {
  const config=window.NEURAL_CRITIC_SUPABASE;
  if(!config||!window.supabase)return;
  const client=window.neuralCriticPublicSupabase||window.supabase.createClient(config.url,config.publishableKey);
  window.neuralCriticCommunitySupabase=client;
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  let session=null,profile=null;
  const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function initials(name='Reader'){return name.trim().split(/\s+/).slice(0,2).map(x=>x[0]?.toUpperCase()||'').join('')||'R'}
  function authorName(){return $('.work-author-copy strong')?.textContent?.trim()||$('.work-author-card-row strong')?.textContent?.trim()||'Neural Critic'}
  function avatarMarkup(p,cls='community-avatar'){const name=p?.display_name||'Reader';return `<span class="${cls}">${p?.avatar_url?`<img src="${esc(p.avatar_url)}" alt="${esc(name)}">`:esc(initials(name))}</span>`}
  function waitFor(selector,ms=7000){return new Promise(resolve=>{const found=$(selector);if(found)return resolve(found);const observer=new MutationObserver(()=>{const next=$(selector);if(next){observer.disconnect();resolve(next)}});observer.observe(document.documentElement,{childList:true,subtree:true});setTimeout(()=>{observer.disconnect();resolve($(selector))},ms)})}

  function ensureModal(){
    if($('.reader-auth-modal'))return;
    document.body.insertAdjacentHTML('beforeend',`<div class="reader-auth-modal" hidden><section class="reader-auth-card" role="dialog" aria-modal="true" aria-labelledby="reader-auth-title"><button class="reader-auth-close" type="button" aria-label="Close">✕</button><small>NEURAL CRITIC COMMUNITY</small><h2 id="reader-auth-title">Reader sign in</h2><p data-reader-auth-copy>Sign in to comment, like stories, and follow writers across Neural Critic.</p><div class="reader-auth-tabs"><button type="button" class="active" data-auth-mode="signin">SIGN IN</button><button type="button" data-auth-mode="signup">CREATE ACCOUNT</button></div><form class="reader-auth-form"><input class="reader-auth-name" name="name" maxlength="40" placeholder="Display name" hidden><input name="email" type="email" autocomplete="email" placeholder="Email" required><input name="password" type="password" autocomplete="current-password" minlength="6" placeholder="Password" required><button type="submit">SIGN IN</button></form><div class="reader-auth-status"></div><button class="reader-auth-signout" type="button" hidden>SIGN OUT</button></section></div>`);
    const modal=$('.reader-auth-modal');
    $('.reader-auth-close',modal)?.addEventListener('click',closeModal);
    modal.addEventListener('click',e=>{if(e.target===modal)closeModal()});
    $$('.reader-auth-tabs button',modal).forEach(btn=>btn.addEventListener('click',()=>setAuthMode(btn.dataset.authMode)));
    $('.reader-auth-form',modal)?.addEventListener('submit',handleAuthSubmit);
    $('.reader-auth-signout',modal)?.addEventListener('click',async()=>{await client.auth.signOut();closeModal()});
  }
  function setAuthStatus(message='',cls=''){const el=$('.reader-auth-status');if(!el)return;el.textContent=message;el.className=`reader-auth-status ${cls}`.trim()}
  function setAuthMode(mode='signin'){
    const modal=$('.reader-auth-modal');if(!modal||session)return;
    $$('.reader-auth-tabs button',modal).forEach(x=>x.classList.toggle('active',x.dataset.authMode===mode));
    const name=$('.reader-auth-name',modal),button=$('.reader-auth-form button[type="submit"]',modal),title=$('#reader-auth-title',modal),copy=$('[data-reader-auth-copy]',modal);
    name.hidden=mode!=='signup';name.required=mode==='signup';button.textContent=mode==='signup'?'CREATE READER ACCOUNT':'SIGN IN';title.textContent=mode==='signup'?'Create your reader account':'Reader sign in';copy.textContent=mode==='signup'?'Choose a public display name, then join discussions and keep your reactions synced across devices.':'Sign in to comment, like stories, and follow writers across Neural Critic.';modal.dataset.mode=mode;setAuthStatus('');
  }
  function renderModalState(){
    const modal=$('.reader-auth-modal');if(!modal)return;const form=$('.reader-auth-form',modal),tabs=$('.reader-auth-tabs',modal),signout=$('.reader-auth-signout',modal),title=$('#reader-auth-title',modal),copy=$('[data-reader-auth-copy]',modal);
    if(session){tabs.hidden=true;form.hidden=true;signout.hidden=false;title.textContent=profile?.display_name||'Reader account';copy.textContent='Your Neural Critic reader account is active on this device.';setAuthStatus(session.user.email||'','success')}
    else{tabs.hidden=false;form.hidden=false;signout.hidden=true;setAuthMode('signin')}
  }
  function openModal(mode='signin'){ensureModal();renderModalState();if(!session)setAuthMode(mode);$('.reader-auth-modal').hidden=false;document.body.style.overflow='hidden'}
  function closeModal(){const modal=$('.reader-auth-modal');if(modal)modal.hidden=true;document.body.style.overflow=''}

  async function loadProfile(){if(!session?.user){profile=null;return}const {data,error}=await client.from('reader_profiles').select('user_id,display_name,avatar_url').eq('user_id',session.user.id).maybeSingle();if(error)throw error;profile=data}
  async function handleAuthSubmit(event){
    event.preventDefault();const form=event.currentTarget,mode=$('.reader-auth-modal')?.dataset.mode||'signin',email=form.elements.email.value.trim(),password=form.elements.password.value,displayName=form.elements.name.value.trim();setAuthStatus(mode==='signup'?'Creating account…':'Signing in…');
    try{
      if(mode==='signup'){
        if(displayName.length<2)throw new Error('Choose a display name of at least 2 characters.');
        const {data,error}=await client.auth.signUp({email,password,options:{data:{display_name:displayName},emailRedirectTo:location.href}});if(error)throw error;
        if(data.session){session=data.session;await loadProfile();await refreshCommunity();renderModalState()}else setAuthStatus('Account created. Check your email to confirm it, then return here and sign in.','success');
      }else{
        const {data,error}=await client.auth.signInWithPassword({email,password});if(error)throw error;session=data.session;await loadProfile();await refreshCommunity();closeModal();
      }
    }catch(error){setAuthStatus(error?.message||'Authentication failed.','error')}
  }

  function installAccountButton(){
    const tools=$('.header-tools');if(!tools||$('.reader-account-button',tools))return;
    const button=document.createElement('button');button.type='button';button.className='reader-account-button';button.innerHTML='<span class="reader-account-dot"></span><span data-reader-account-label>SIGN IN</span>';button.addEventListener('click',()=>openModal('signin'));tools.appendChild(button);
  }
  function updateAccountButton(){installAccountButton();const button=$('.reader-account-button'),label=$('[data-reader-account-label]',button||document);if(!button||!label)return;button.classList.toggle('signed-in',!!session);label.textContent=session?(profile?.display_name||'ACCOUNT'):'SIGN IN'}
  function updateIdentity(){
    const box=$('.thread-identity');if(!box)return;const name=profile?.display_name||'Reader';
    box.innerHTML=`<div class="community-identity">${avatarMarkup(profile)}<div><span>Your identity</span><strong data-reader-name>${esc(name)}</strong></div></div><button type="button" class="community-auth-action">${session?'ACCOUNT':'SIGN IN'}</button>`;
    $('.community-auth-action',box)?.addEventListener('click',()=>openModal('signin'));
    const form=$('[data-thread-form]'),oldName=$('.thread-name',form||document);if(oldName)oldName.hidden=true;
    let note=$('.community-login-note',form||document);
    if(!session&&form&&!note){form.insertAdjacentHTML('afterbegin','<p class="community-login-note">Sign in to join the Reader Thread. <button type="button">SIGN IN</button></p>');note=$('.community-login-note',form);$('button',note)?.addEventListener('click',()=>openModal('signin'))}else if(session&&note)note.remove();
  }

  async function syncArticleLike(){const button=$('[data-article-like]');if(!button)return;button.classList.remove('active','community-active');if(!session?.user)return;const {data}=await client.from('article_reactions').select('article_slug').eq('article_slug',new URLSearchParams(location.search).get('slug')||'').eq('user_id',session.user.id).eq('reaction_type','like').maybeSingle();button.classList.toggle('community-active',!!data)}
  function bindArticleLike(){const button=$('[data-article-like]');if(!button||button.dataset.communityBound)return;button.dataset.communityBound='1';button.addEventListener('click',async event=>{event.preventDefault();event.stopImmediatePropagation();if(!session?.user){openModal('signin');return}const slug=new URLSearchParams(location.search).get('slug')||'',active=button.classList.contains('community-active');if(active)await client.from('article_reactions').delete().eq('article_slug',slug).eq('user_id',session.user.id).eq('reaction_type','like');else await client.from('article_reactions').insert({article_slug:slug,user_id:session.user.id,reaction_type:'like'});await syncArticleLike()},true)}

  async function syncAuthorFollow(){const name=authorName(),buttons=$$('[data-author-follow],[data-article-follow]');buttons.forEach(button=>{button.classList.remove('active','community-active');button.setAttribute('aria-pressed','false');if(button.matches('[data-author-follow]'))button.textContent='FOLLOW';const small=$('small',button);if(small)small.textContent='FOLLOW'});if(!session?.user||!buttons.length)return;const {data}=await client.from('author_follows').select('author_name').eq('user_id',session.user.id).eq('author_name',name).maybeSingle();buttons.forEach(button=>{button.classList.toggle('community-active',!!data);button.setAttribute('aria-pressed',String(!!data));if(button.matches('[data-author-follow]'))button.textContent=data?'FOLLOWING':'FOLLOW';const small=$('small',button);if(small)small.textContent=data?'FOLLOWING':'FOLLOW'})}
  function bindAuthorFollow(){const name=authorName();$$('[data-author-follow],[data-article-follow]').forEach(button=>{if(button.dataset.communityBound)return;button.dataset.communityBound='1';button.addEventListener('click',async event=>{event.preventDefault();event.stopImmediatePropagation();if(!session?.user){openModal('signin');return}const active=button.classList.contains('community-active');if(active)await client.from('author_follows').delete().eq('user_id',session.user.id).eq('author_name',name);else await client.from('author_follows').insert({user_id:session.user.id,author_name:name});await syncAuthorFollow()},true)})}

  async function refreshCommunity(){updateAccountButton();updateIdentity();bindArticleLike();bindAuthorFollow();await Promise.all([syncArticleLike(),syncAuthorFollow()]);window.dispatchEvent(new CustomEvent('neuralcritic:community-refreshed'))}
  async function init(){
    ensureModal();const {data:{session:current}}=await client.auth.getSession();session=current;if(session){try{await loadProfile()}catch(_){}}
    await Promise.all([waitFor('.header-tools'),waitFor('#reader-thread'),waitFor('[data-article-like]')]);await refreshCommunity();
    client.auth.onAuthStateChange(async(_event,next)=>{session=next;profile=null;if(session){try{await loadProfile()}catch(_){}}await refreshCommunity();renderModalState();if(typeof window.neuralCriticRecoverThread==='function')window.neuralCriticRecoverThread()});
  }
  init();
})();
