(() => {
  const config=window.NEURAL_CRITIC_SUPABASE;
  if(!config||!window.supabase)return;
  const client=window.neuralCriticCommunitySupabase||window.neuralCriticPublicSupabase||window.supabase.createClient(config.url,config.publishableKey);
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  let busy=false,queued=false;
  const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const requestSignIn=()=>$('.reader-account-button')?.click();
  const signedInLabel=()=>{const b=$('.reader-account-button'),l=$('[data-reader-account-label]',b||document)?.textContent?.trim();return b?.classList.contains('signed-in')&&l&&l!=='ACCOUNT'?l:null};
  async function viewer(){const {data}=await client.auth.getSession();return data?.session?.user||null}

  function composerAvatar(){
    const source=$('.thread-identity .community-avatar'),wrap=document.createElement('span');
    wrap.className='standard-composer-avatar';
    const img=source?.querySelector('img');
    if(img)wrap.appendChild(img.cloneNode(true));else wrap.textContent=source?.textContent?.trim()||'NC';
    return wrap;
  }

  function updateCount(){
    const n=parseInt($('[data-thread-count]')?.textContent||'0',10)||0;
    const badge=$('[data-standard-thread-count]');if(badge)badge.textContent=String(n);
    $$('.standard-thread-count').forEach(x=>x.textContent=String(n));
  }
  function updateAccount(){
    const b=$('.standard-thread-account');if(!b)return;const name=signedInLabel();
    b.innerHTML=name?`<span>Signed in as <strong>${esc(name)}</strong></span><span class="account-dot">●</span>`:'<span>Sign in to your Neural Critic account</span><span class="account-dot">●</span>';
  }

  function applySort(mode){
    const pop=$('[data-thread-popular]'),sort=$('[data-thread-sort]');if(!sort)return;
    if(mode==='popular'){if(pop&&!pop.classList.contains('active'))pop.click();return}
    if(pop?.classList.contains('active'))pop.click();
    const current=sort.textContent?.trim().toUpperCase();
    if(mode==='newest'&&current!=='NEWEST')sort.click();
    if(mode==='oldest'&&current!=='OLDEST')sort.click();
  }

  function installThread(thread){
    thread.classList.add('standard-thread');
    if(!thread.querySelector(':scope > .standard-thread-shell')){
      const shell=document.createElement('div');shell.className='standard-thread-shell';
      while(thread.firstChild)shell.appendChild(thread.firstChild);thread.appendChild(shell);
    }
    const shell=$('.standard-thread-shell',thread),head=$('.thread-head',shell);
    if(head&&!$('.standard-thread-title',head)){
      const left=head.firstElementChild||document.createElement('div');
      left.insertAdjacentHTML('beforeend','<div class="standard-thread-title"><span class="thread-bubbles">▣</span><strong>THREAD</strong><b data-standard-thread-count>0</b></div>');
      const account=document.createElement('button');account.type='button';account.className='standard-thread-account';account.addEventListener('click',requestSignIn);head.appendChild(account);
    }
    if(head&&!$('.standard-thread-intro',shell))head.insertAdjacentHTML('afterend','<p class="standard-thread-intro">We want to hear from you. Share your perspective in the comments below, and please keep the conversation respectful.</p>');
    const form=$('[data-thread-form]',shell);
    if(form&&!$('.standard-composer-avatar',form)){
      form.prepend(composerAvatar());const ta=$('textarea[name="comment"]',form);if(ta){ta.placeholder='Reply / Post';const sync=()=>form.classList.toggle('has-value',!!ta.value.trim());ta.addEventListener('input',sync);sync()}
      const submit=$('button[type="submit"]',form);if(submit)submit.textContent='POST COMMENT';
    }
    const list=$('[data-thread-list]',shell);
    if(list&&!$('.standard-sort-row',shell)){
      const row=document.createElement('div');row.className='standard-sort-row';row.innerHTML='<span>Sort by:</span><select aria-label="Sort comments"><option value="popular">Popular</option><option value="newest">Newest</option><option value="oldest">Oldest</option></select>';list.before(row);$('select',row).addEventListener('change',e=>applySort(e.target.value));
    }
    updateAccount();updateCount();
  }

  function permalink(id){const u=new URL(location.href);u.hash=`comment-${id}`;return u.toString()}
  function ensureActions(comment){
    const id=comment.dataset.commentId;if(!id)return;comment.id=`comment-${id}`;
    let footer=$('.community-comment-footer',comment);if(!footer){footer=document.createElement('div');footer.className='community-comment-footer';comment.appendChild(footer)}
    if(!$('.standard-vote-wrap',footer)){
      const votes=document.createElement('span');votes.className='standard-vote-wrap';votes.style.display='contents';votes.innerHTML='<button type="button" class="standard-comment-action standard-vote vote-like" data-vote="like">👍 <span class="count">0</span></button><button type="button" class="standard-comment-action standard-vote vote-dislike" data-vote="dislike">👎 <span class="count">0</span></button>';footer.prepend(votes);
    }
    const reply=$('.community-comment-native-actions .community-comment-reply',comment);if(reply&&!$('.standard-reply',footer)){reply.classList.add('standard-comment-action','standard-reply');reply.textContent='↩ Reply';footer.appendChild(reply)}
    if(!$('.standard-copy',footer)){
      const copy=document.createElement('button');copy.type='button';copy.className='standard-comment-action copy standard-copy';copy.textContent='🔗 Copy';copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(permalink(id));copy.classList.add('copied');copy.textContent='✓ Copied';setTimeout(()=>{copy.classList.remove('copied');copy.textContent='🔗 Copy'},1400)}catch(_){}});footer.appendChild(copy);
    }
  }

  function bindVote(button,id,type){
    if(button.dataset.standardBound==='1')return;button.dataset.standardBound='1';
    button.addEventListener('click',async()=>{const user=await viewer();if(!user){requestSignIn();return}const active=button.classList.contains('active');button.disabled=true;try{const {error:d}=await client.from('comment_reactions').delete().eq('comment_id',id).eq('user_id',user.id);if(d)throw d;if(!active){const {error:i}=await client.from('comment_reactions').insert({comment_id:id,user_id:user.id,reaction_type:type});if(i)throw i}await refreshVotes()}catch(e){console.warn('Neural Critic vote update failed.',e)}finally{button.disabled=false}});
  }

  async function refreshVotes(){
    const comments=$$('.standard-thread .community-comment[data-comment-id]');if(!comments.length)return;comments.forEach(ensureActions);
    const ids=comments.map(c=>c.dataset.commentId).filter(Boolean),user=await viewer();
    const {data,error}=await client.from('comment_reactions').select('comment_id,user_id,reaction_type').in('comment_id',ids);if(error)return console.warn('Vote load failed.',error);
    const likes=new Map(),dislikes=new Map(),mine=new Map();
    (data||[]).forEach(r=>{const map=r.reaction_type==='dislike'?dislikes:likes;map.set(r.comment_id,(map.get(r.comment_id)||0)+1);if(user?.id===r.user_id)mine.set(r.comment_id,r.reaction_type)});
    comments.forEach(c=>{const id=c.dataset.commentId,like=$('[data-vote="like"]',c),dislike=$('[data-vote="dislike"]',c);if(like){$('.count',like).textContent=String(likes.get(id)||0);like.classList.toggle('active',mine.get(id)==='like');bindVote(like,id,'like')}if(dislike){$('.count',dislike).textContent=String(dislikes.get(id)||0);dislike.classList.toggle('active',mine.get(id)==='dislike');bindVote(dislike,id,'dislike')}});
  }

  function installRail(){
    const rail=$('.work-react-rail');if(!rail)return;rail.classList.add('standard-react-rail');
    const like=$('[data-article-like]',rail);if(like)$('small',like).textContent='Like';
    const follow=$('[data-article-follow]',rail);if(follow)$('small',follow).textContent=follow.classList.contains('active')?'Following':'Follow';
    const discuss=$('[data-article-discuss]',rail);if(discuss){$('small',discuss).textContent='Thread';const icon=$('b',discuss);if(icon&&!$('.standard-thread-count',icon))icon.insertAdjacentHTML('beforeend','<span class="standard-thread-count">0</span>')}
    const share=$('[data-article-share]',rail);if(share)$('small',share).textContent='Share';
    if(!$('.standard-rail-account',rail)){const a=document.createElement('button');a.type='button';a.className='standard-rail-account';a.innerHTML='<b>●</b><small>Log In</small>';a.addEventListener('click',requestSignIn);rail.appendChild(a)}
    const label=$('.standard-rail-account small',rail);if(label)label.textContent=signedInLabel()?'Account':'Log In';updateCount();
  }

  async function decorate(){if(busy)return;const thread=$('.article-thread');if(!thread)return;busy=true;try{installThread(thread);installRail();await refreshVotes();updateAccount();updateCount()}finally{busy=false}}
  function queue(){if(queued)return;queued=true;requestAnimationFrame(async()=>{queued=false;await decorate()})}
  function init(){const obs=new MutationObserver(ms=>{if(ms.some(m=>[...m.addedNodes].some(n=>n instanceof Element&&(n.matches?.('.article-thread,.community-comment,.work-react-rail,.reader-account-button')||n.querySelector?.('.article-thread,.community-comment,.work-react-rail,.reader-account-button')))))queue()});obs.observe(document.body,{childList:true,subtree:true});window.addEventListener('neuralcritic:thread-recovered',queue);setTimeout(queue,50);setTimeout(queue,600);setTimeout(queue,1600)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
