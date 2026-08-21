(() => {
  const config=window.NEURAL_CRITIC_SUPABASE;
  if(!config||!window.supabase)return;
  const client=window.neuralCriticCommunitySupabase||window.neuralCriticPublicSupabase||window.supabase.createClient(config.url,config.publishableKey);
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const AVATAR_BUCKET='reader-avatars', MAX_AVATAR_BYTES=5*1024*1024;
  const AVATAR_TYPES=new Set(['image/jpeg','image/png','image/webp','image/avif']);
  let session=null,profile=null,isAdmin=false,queued=false;
  const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function timeout(promise,ms=3500){let timer;const fail=new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Community request timed out')),ms)});return Promise.race([Promise.resolve(promise),fail]).finally(()=>clearTimeout(timer));}
  function toast(message,error=false){let el=$('.community-toast');if(!el){el=document.createElement('div');el.className='community-toast';document.body.appendChild(el)}el.textContent=message;el.classList.toggle('error',error);el.classList.add('show');clearTimeout(el._timer);el._timer=setTimeout(()=>el.classList.remove('show'),2600)}
  function avatarUrl(){return profile?.avatar_url||'images/editorial/499627ae-e4d1-40d6-be0d-45efc750a1d9.jpg'}

  async function loadViewer(){
    try{
      const {data:{session:next}}=await timeout(client.auth.getSession());session=next;profile=null;isAdmin=false;if(!session?.user)return;
      const [reader,editor]=await timeout(Promise.all([
        client.from('reader_profiles').select('user_id,display_name,avatar_url').eq('user_id',session.user.id).maybeSingle(),
        client.from('editor_profiles').select('role').eq('user_id',session.user.id).maybeSingle()
      ]));
      profile=reader?.data||null;isAdmin=editor?.data?.role==='admin';
    }catch(error){console.warn('Neural Critic reader profile load skipped.',error)}
  }

  function updateHeaderAccount(){
    const button=$('.reader-account-button');if(!button)return;
    const dot=$('.reader-account-dot',button),label=$('[data-reader-account-label]',button);
    if(label)label.textContent=session?(profile?.display_name||'ACCOUNT'):'SIGN IN';
    button.classList.toggle('signed-in',!!session);
    if(!dot)return;
    if(session?.user){dot.classList.add('reader-account-avatar');dot.style.backgroundImage=`url("${avatarUrl().replace(/"/g,'\\"')}")`;}
    else{dot.classList.remove('reader-account-avatar');dot.style.backgroundImage='';}
  }

  function ensureProfileEditor(force=false){
    const card=$('.reader-auth-card');if(!card)return;
    let editor=$('.reader-profile-editor',card);
    if(!session?.user){editor?.remove();return;}
    if(editor&&!force)return;
    if(!editor){editor=document.createElement('section');editor.className='reader-profile-editor';card.insertBefore(editor,$('.reader-auth-signout',card)||null);}
    editor.innerHTML=`<div class="reader-profile-head"><img class="reader-profile-avatar" src="${esc(avatarUrl())}" alt="Reader avatar"><div><small>READER PROFILE</small><strong>${esc(profile?.display_name||'Reader')}</strong><span>${isAdmin?'Neural Critic admin · Reader':'Neural Critic reader'}</span></div></div><label>DISPLAY NAME<input class="reader-profile-name" maxlength="40" value="${esc(profile?.display_name||'Reader')}"></label><div class="reader-profile-avatar-actions"><input class="reader-profile-file" type="file" accept="image/jpeg,image/png,image/webp,image/avif" hidden><button type="button" class="reader-profile-upload">UPLOAD AVATAR</button><span>JPG, PNG, WEBP or AVIF · max 5 MB</span></div><button type="button" class="reader-profile-save">SAVE PROFILE</button>`;
    $('.reader-profile-upload',editor)?.addEventListener('click',()=>$('.reader-profile-file',editor)?.click());
    $('.reader-profile-file',editor)?.addEventListener('change',async event=>{
      const file=event.target.files?.[0];if(!file)return;const button=$('.reader-profile-upload',editor);
      try{
        if(!AVATAR_TYPES.has(file.type))throw new Error('Use JPG, PNG, WEBP, or AVIF for your avatar.');
        if(file.size>MAX_AVATAR_BYTES)throw new Error('Avatar must be 5 MB or smaller.');
        const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'');
        const path=`${session.user.id}/${Date.now()}-${crypto.randomUUID?.()||Math.random().toString(36).slice(2)}.${ext}`;
        if(button){button.disabled=true;button.textContent='UPLOADING…'}
        const {data,error}=await timeout(client.storage.from(AVATAR_BUCKET).upload(path,file,{cacheControl:'31536000',contentType:file.type,upsert:false}),8000);if(error)throw error;
        const {data:publicData}=client.storage.from(AVATAR_BUCKET).getPublicUrl(data.path),url=publicData?.publicUrl;if(!url)throw new Error('Avatar uploaded, but no public URL was returned.');
        const {error:updateError}=await timeout(client.from('reader_profiles').update({avatar_url:url}).eq('user_id',session.user.id));if(updateError)throw updateError;
        profile={...(profile||{}),avatar_url:url};updateHeaderAccount();ensureProfileEditor(true);toast('Reader avatar updated.');
      }catch(error){toast(error?.message||'Avatar upload failed.',true)}finally{if(button){button.disabled=false;button.textContent='UPLOAD AVATAR'}event.target.value=''}
    });
    $('.reader-profile-save',editor)?.addEventListener('click',async()=>{
      try{
        const name=$('.reader-profile-name',editor).value.trim();if(name.length<2||name.length>40)throw new Error('Display name must be 2–40 characters.');
        const {error}=await timeout(client.from('reader_profiles').update({display_name:name}).eq('user_id',session.user.id));if(error)throw error;
        await timeout(client.auth.updateUser({data:{display_name:name}}));profile={...(profile||{}),display_name:name};$$('[data-reader-name]').forEach(el=>el.textContent=name);updateHeaderAccount();ensureProfileEditor(true);toast('Reader profile saved.');
      }catch(error){toast(error?.message||'Could not save profile.',true)}
    });
  }

  function ensureAdminModeration(){
    if(!isAdmin)return;
    $$('.community-comment[data-comment-id]').forEach(comment=>{
      if($('.community-comment-delete',comment)||$('.community-admin-remove',comment))return;
      const head=$('.community-comment-head',comment),id=comment.dataset.commentId;if(!head||!id)return;
      const remove=document.createElement('button');remove.type='button';remove.className='community-admin-remove';remove.textContent='MODERATE';remove.title='Remove this comment as Neural Critic admin';
      remove.addEventListener('click',async()=>{if(!confirm('Remove this comment from the Reader Thread?'))return;const {error}=await client.from('article_comments').delete().eq('id',id);if(error){toast(error.message,true);return;}if(typeof window.neuralCriticRecoverThread==='function')await window.neuralCriticRecoverThread();else comment.remove();toast('Comment removed.');});
      head.appendChild(remove);
    });
  }

  function refreshVisuals(){updateHeaderAccount();ensureProfileEditor();ensureAdminModeration();}
  function queue(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;refreshVisuals()})}
  async function init(){
    await loadViewer();refreshVisuals();
    const observer=new MutationObserver(ms=>{if(ms.some(m=>[...m.addedNodes].some(n=>n instanceof Element&&(n.matches?.('.reader-auth-card,.reader-account-button,.community-comment')||n.querySelector?.('.reader-auth-card,.reader-account-button,.community-comment')))))queue()});
    observer.observe(document.body,{childList:true,subtree:true});
    client.auth.onAuthStateChange(async()=>{await loadViewer();queue()});
    window.addEventListener('neuralcritic:thread-recovered',queue);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
