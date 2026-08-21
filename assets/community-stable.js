(() => {
  const config = window.NEURAL_CRITIC_SUPABASE;
  if (!config || !window.supabase) return;
  const client = window.neuralCriticCommunitySupabase || window.neuralCriticPublicSupabase || window.supabase.createClient(config.url, config.publishableKey);
  const $ = (s,r=document) => r.querySelector(s);
  const $$ = (s,r=document) => [...r.querySelectorAll(s)];
  const esc = (v='') => String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const slug = new URLSearchParams(location.search).get('slug') || '';
  let queued = false;
  let voteBusy = false;

  const icon = name => `<span class="material-symbols-rounded" aria-hidden="true">${name}</span>`;
  const requestSignIn = () => $('.reader-account-button')?.click();
  async function viewer(){ const {data} = await client.auth.getSession(); return data?.session?.user || null; }
  function signedInName(){
    const button=$('.reader-account-button');
    const label=$('[data-reader-account-label]',button||document)?.textContent?.trim();
    return button?.classList.contains('signed-in') && label && label!=='ACCOUNT' ? label : null;
  }
  function countValue(){ return parseInt($('[data-thread-count]')?.textContent || '0',10) || 0; }

  function syncCounts(){
    const n=countValue();
    $('[data-stable-thread-count]')?.replaceChildren(document.createTextNode(String(n)));
    $$('.standard-thread-count').forEach(x=>x.textContent=String(n));
  }

  function sourceAvatar(){
    const src=$('.thread-identity .community-avatar');
    if(!src) return null;
    const wrap=document.createElement('span'); wrap.className='standard-composer-avatar';
    const img=src.querySelector('img');
    if(img) wrap.appendChild(img.cloneNode(true)); else wrap.textContent=src.textContent?.trim() || 'NC';
    return wrap;
  }

  function syncComposerAvatar(form){
    let avatar=$('.standard-composer-avatar',form);
    const source=sourceAvatar();
    if(!source){ if(!avatar){avatar=document.createElement('span');avatar.className='standard-composer-avatar';avatar.textContent='NC';form.prepend(avatar);} return; }
    if(!avatar){ form.prepend(source); return; }
    avatar.innerHTML=source.innerHTML; if(!source.innerHTML) avatar.textContent=source.textContent;
  }

  function updateAccount(){
    const button=$('.standard-thread-account'); if(!button) return;
    const name=signedInName();
    button.innerHTML=name
      ? `<span>Signed in as <strong>${esc(name)}</strong></span><span class="account-dot">${icon('person')}</span>`
      : `<span>Sign in to your Neural Critic account</span><span class="account-dot">${icon('person')}</span>`;
  }

  function applySort(mode){
    const popular=$('[data-thread-popular]'), sort=$('[data-thread-sort]');
    if(!sort) return;
    if(mode==='popular'){
      if(popular && !popular.classList.contains('active')) popular.click();
      return;
    }
    if(popular?.classList.contains('active')) popular.click();
    const current=sort.textContent?.trim().toUpperCase();
    if(mode==='newest' && current!=='NEWEST') sort.click();
    if(mode==='oldest' && current!=='OLDEST') sort.click();
  }

  function installThread(){
    const thread=$('#reader-thread.article-thread') || $('.article-thread'); if(!thread) return false;
    thread.id = thread.id || 'reader-thread';
    thread.classList.add('standard-thread');
    if(!thread.querySelector(':scope > .standard-thread-shell')){
      const shell=document.createElement('div'); shell.className='standard-thread-shell';
      while(thread.firstChild) shell.appendChild(thread.firstChild);
      thread.appendChild(shell);
    }
    const shell=$('.standard-thread-shell',thread), head=$('.thread-head',shell);
    if(head && !$('.standard-thread-title',head)){
      const left=head.firstElementChild || document.createElement('div');
      if(!left.parentElement) head.prepend(left);
      left.insertAdjacentHTML('beforeend',`<div class="standard-thread-title"><span class="thread-bubbles">${icon('forum')}</span><strong>THREAD</strong><b data-stable-thread-count>0</b></div>`);
      const account=document.createElement('button'); account.type='button'; account.className='standard-thread-account'; account.addEventListener('click',requestSignIn); head.appendChild(account);
    }
    if(head && !$('.standard-thread-intro',shell)) head.insertAdjacentHTML('afterend','<p class="standard-thread-intro">We want to hear from you. Share your perspective in the comments below, and please keep the conversation respectful.</p>');

    const form=$('[data-thread-form]',shell);
    if(form){
      syncComposerAvatar(form);
      const ta=$('textarea[name="comment"]',form);
      if(ta){
        ta.rows=1; ta.placeholder='Reply / Post';
        if(ta.dataset.stableComposer!=='1'){
          ta.dataset.stableComposer='1';
          const sync=()=>form.classList.toggle('has-value',!!ta.value.trim());
          ta.addEventListener('input',sync); ta.addEventListener('blur',sync); sync();
        }
      }
      const submit=$('button[type="submit"]',form); if(submit && !submit.disabled) submit.textContent='POST COMMENT';
    }

    const list=$('[data-thread-list]',shell);
    if(list && !$('.standard-sort-row',shell)){
      const row=document.createElement('div'); row.className='standard-sort-row';
      row.innerHTML='<span>Sort by:</span><select aria-label="Sort comments"><option value="popular">Popular</option><option value="newest">Newest</option><option value="oldest">Oldest</option></select>';
      list.before(row); $('select',row)?.addEventListener('change',e=>applySort(e.target.value));
    }
    updateAccount(); syncCounts();
    return true;
  }

  function cleanMenu(comment){
    $$('.community-comment-edit,.community-comment-delete,.community-comment-report',comment).forEach(button=>{
      const label=button.classList.contains('community-comment-edit')?'Edit':button.classList.contains('community-comment-delete')?'Delete':'Report';
      const glyph=label==='Edit'?'edit':label==='Delete'?'delete':'flag';
      if(button.dataset.stableMenu==='1') return;
      button.dataset.stableMenu='1'; button.setAttribute('aria-label',label); button.title=label;
      button.innerHTML=`${icon(glyph)}<span>${label}</span>`;
    });
  }

  function permalink(id){ const url=new URL(location.href); url.hash=`comment-${id}`; return url.toString(); }
  function ensureCommentActions(comment){
    const id=comment.dataset.commentId; if(!id) return;
    comment.id=`comment-${id}`; cleanMenu(comment);
    let footer=$('.community-comment-footer',comment);
    if(!footer){ footer=document.createElement('div');footer.className='community-comment-footer';comment.appendChild(footer); }
    if(!$('.stable-votes',footer)){
      const wrap=document.createElement('span');wrap.className='stable-votes';wrap.style.display='contents';
      wrap.innerHTML=`<button type="button" class="standard-comment-action standard-vote vote-like" data-vote="like">${icon('thumb_up')}<span>Like</span><b class="count">0</b></button><button type="button" class="standard-comment-action standard-vote vote-dislike" data-vote="dislike">${icon('thumb_down')}<span>Dislike</span><b class="count">0</b></button>`;
      footer.prepend(wrap);
    }
    const nativeReply=$('.community-comment-native-actions .community-comment-reply',comment);
    if(nativeReply && !nativeReply.classList.contains('standard-reply')){
      nativeReply.classList.add('standard-comment-action','standard-reply'); nativeReply.innerHTML=`${icon('reply')}<span>Reply</span>`; footer.appendChild(nativeReply);
    }
    if(!$('.standard-copy',footer)){
      const copy=document.createElement('button'); copy.type='button'; copy.className='standard-comment-action standard-copy'; copy.innerHTML=`${icon('link')}<span>Copy</span>`;
      copy.addEventListener('click',async()=>{ try{await navigator.clipboard.writeText(permalink(id));copy.innerHTML=`${icon('check_circle')}<span>Copied</span>`;setTimeout(()=>copy.innerHTML=`${icon('link')}<span>Copy</span>`,1300)}catch(_){}});
      footer.appendChild(copy);
    }
  }

  function bindVote(button,id,type){
    if(button.dataset.stableVote==='1') return; button.dataset.stableVote='1';
    button.addEventListener('click',async()=>{
      const user=await viewer(); if(!user){requestSignIn();return;}
      const active=button.classList.contains('active'); button.disabled=true;
      try{
        const {error:delError}=await client.from('comment_reactions').delete().eq('comment_id',id).eq('user_id',user.id); if(delError) throw delError;
        if(!active){const {error}=await client.from('comment_reactions').insert({comment_id:id,user_id:user.id,reaction_type:type});if(error)throw error;}
        await refreshVotes();
      }catch(error){console.warn('Neural Critic comment vote failed.',error)}finally{button.disabled=false;}
    });
  }

  async function refreshVotes(){
    if(voteBusy) return; const comments=$$('.standard-thread .community-comment[data-comment-id]'); if(!comments.length) return;
    voteBusy=true;
    try{
      comments.forEach(ensureCommentActions);
      const ids=comments.map(c=>c.dataset.commentId).filter(Boolean), user=await viewer();
      const {data,error}=await client.from('comment_reactions').select('comment_id,user_id,reaction_type').in('comment_id',ids); if(error) throw error;
      const likes=new Map(), dislikes=new Map(), mine=new Map();
      (data||[]).forEach(r=>{const m=r.reaction_type==='dislike'?dislikes:likes;m.set(r.comment_id,(m.get(r.comment_id)||0)+1);if(user?.id===r.user_id)mine.set(r.comment_id,r.reaction_type)});
      comments.forEach(c=>{
        const id=c.dataset.commentId, like=$('[data-vote="like"]',c), dislike=$('[data-vote="dislike"]',c);
        if(like){$('.count',like).textContent=String(likes.get(id)||0);like.classList.toggle('active',mine.get(id)==='like');bindVote(like,id,'like');}
        if(dislike){$('.count',dislike).textContent=String(dislikes.get(id)||0);dislike.classList.toggle('active',mine.get(id)==='dislike');bindVote(dislike,id,'dislike');}
      });
    }catch(error){console.warn('Neural Critic vote refresh skipped.',error)}finally{voteBusy=false;}
  }

  function setRailIcon(button,name){
    const holder=$('b',button); if(!holder) return;
    holder.innerHTML=icon(name);
  }
  function installRail(){
    const rail=$('.work-react-rail'); if(!rail) return;
    rail.classList.add('standard-react-rail');
    const like=$('[data-article-like]',rail); if(like){$('small',like).textContent='Like';setRailIcon(like,'thumb_up');}
    const follow=$('[data-article-follow]',rail); if(follow){$('small',follow).textContent=follow.classList.contains('community-active')?'Following':'Follow';setRailIcon(follow,'bookmark');}
    const discuss=$('[data-article-discuss]',rail); if(discuss){$('small',discuss).textContent='Thread';setRailIcon(discuss,'forum');const holder=$('b',discuss);if(holder&&!$('.standard-thread-count',holder))holder.insertAdjacentHTML('beforeend','<span class="standard-thread-count">0</span>');}
    const share=$('[data-article-share]',rail); if(share){$('small',share).textContent='Share';setRailIcon(share,'share');}
    let account=$('.standard-rail-account',rail);
    if(!account){account=document.createElement('button');account.type='button';account.className='standard-rail-account';account.innerHTML=`<b>${icon('person')}</b><small>Account</small>`;account.addEventListener('click',requestSignIn);rail.appendChild(account);}
    $('small',account).textContent=signedInName()?'Account':'Log In'; setRailIcon(account,'person'); syncCounts();
  }

  async function decorate(){
    if(!installThread()) return;
    installRail();
    $$('.standard-thread .community-comment[data-comment-id]').forEach(ensureCommentActions);
    await refreshVotes(); updateAccount(); syncCounts();
  }
  function queue(){ if(queued)return;queued=true;requestAnimationFrame(async()=>{queued=false;await decorate();}); }

  async function waitRecover(max=8){
    for(let i=0;i<max;i++){if(typeof window.neuralCriticRecoverThread==='function')return true;await new Promise(r=>setTimeout(r,90));}return false;
  }

  /* Register before legacy community.js so posting uses the reliable recovery renderer. */
  document.addEventListener('submit',async event=>{
    const form=event.target;
    if(!(form instanceof HTMLFormElement)||!form.matches('[data-thread-form]')||!form.closest('.article-thread')) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const user=await viewer(); if(!user){requestSignIn();return;}
    const ta=$('textarea[name="comment"]',form), body=ta?.value.trim()||''; if(!body)return;
    const submit=$('button[type="submit"]',form), old=submit?.textContent||'POST COMMENT';
    if(submit){submit.disabled=true;submit.textContent='POSTING…';}
    try{
      const {error}=await client.from('article_comments').insert({article_slug:slug,user_id:user.id,body}); if(error)throw error;
      ta.value=''; form.classList.remove('has-value');
      const remaining=$('[data-thread-remaining]',form); if(remaining)remaining.textContent='1200';
      if(await waitRecover()) await window.neuralCriticRecoverThread();
    }catch(error){console.warn('Neural Critic comment post failed.',error);const box=$('[data-thread-error]',form);if(box){box.hidden=false;box.textContent=error.message||'Could not post comment.';}}
    finally{if(submit){submit.disabled=false;submit.textContent=old==='JOIN DISCUSSION'?'POST COMMENT':old;}}
  },true);

  function init(){
    queue();
    const observer=new MutationObserver(mutations=>{
      if(mutations.some(m=>[...m.addedNodes].some(n=>n instanceof Element&&(n.matches?.('.article-thread,.community-comment,.work-react-rail,.reader-account-button')||n.querySelector?.('.article-thread,.community-comment,.work-react-rail,.reader-account-button')))))queue();
    });
    observer.observe(document.body,{childList:true,subtree:true});
    window.addEventListener('neuralcritic:thread-recovered',queue);
    setTimeout(async()=>{if(await waitRecover(2))await window.neuralCriticRecoverThread();queue();},450);
    setTimeout(queue,1200);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();
