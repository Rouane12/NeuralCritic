(() => {
  'use strict';
  const $=(s,root=document)=>root.querySelector(s);
  const $$=(s,root=document)=>[...root.querySelectorAll(s)];
  let storiesPromise=null;

  function studioToast(message,error=false){
    const el=$('#studio-toast');
    if(!el)return;
    el.textContent=message;
    el.classList.toggle('error',error);
    el.classList.add('show');
    clearTimeout(el._linkTimer);
    el._linkTimer=setTimeout(()=>el.classList.remove('show'),2600);
  }

  async function stories(){
    if(storiesPromise)return storiesPromise;
    storiesPromise=(async()=>{
      const merged=new Map();
      try{
        const response=await fetch('data/articles.json',{cache:'no-store'});
        const rows=response.ok?await response.json():[];
        (Array.isArray(rows)?rows:[]).forEach(row=>row?.slug&&merged.set(row.slug,row));
      }catch(_){}
      const client=window.neuralCriticSupabase;
      if(client){
        try{
          const {data,error}=await client.from('articles')
            .select('slug,title,description,category,image_url,published_at,status')
            .eq('status','published')
            .order('published_at',{ascending:false});
          if(!error)(data||[]).forEach(row=>{
            if(!row?.slug)return;
            merged.set(row.slug,{
              slug:row.slug,title:row.title||row.slug,description:row.description||'',
              category:row.category||'STORY',imageLocal:row.image_url||'',publishedAt:row.published_at||null
            });
          });
        }catch(_){}
      }
      return [...merged.values()];
    })();
    return storiesPromise;
  }

  function selection(textarea){
    const start=textarea.selectionStart??0,end=textarea.selectionEnd??0;
    const text=textarea.value.slice(start,end).trim();
    return {start,end,text};
  }

  function insertLink(textarea,target){
    const picked=selection(textarea);
    if(!picked.text){studioToast('Select the words you want readers to click first.',true);return false;}
    if(picked.text.includes('\n')||picked.text.includes(']')){studioToast('Select a short phrase on one line for an inline link.',true);return false;}
    const markup='['+picked.text+']('+target+')';
    textarea.setRangeText(markup,picked.start,picked.end,'end');
    textarea.dispatchEvent(new Event('input',{bubbles:true}));
    textarea.focus();
    return true;
  }

  function safeText(value=''){
    return String(value).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  }

  function resultButton(story){
    const button=document.createElement('button');
    button.type='button';
    button.className='studio-link-result';
    button.dataset.storySlug=story.slug;
    button.innerHTML='<b>'+safeText(story.title||story.slug)+'</b><small>'+safeText(String(story.category||'STORY').toUpperCase())+' · '+safeText(story.slug)+'</small>';
    return button;
  }

  async function renderStoryResults(panel,query=''){
    const host=$('.studio-link-results',panel);
    if(!host)return;
    const all=await stories();
    const q=String(query||'').trim().toLowerCase();
    const ranked=all.filter(story=>!q||[story.title,story.slug,story.category].join(' ').toLowerCase().includes(q)).slice(0,8);
    host.innerHTML='';
    ranked.forEach(story=>host.appendChild(resultButton(story)));
    if(!ranked.length)host.innerHTML='<span class="studio-link-status">No published story matched that search.</span>';
  }

  function decorateTextarea(textarea){
    if(!textarea||textarea.dataset.ncLinksReady==='1')return;
    textarea.dataset.ncLinksReady='1';
    const tools=document.createElement('div');
    tools.className='studio-link-tools';
    tools.innerHTML='<button type="button" data-link-story>LINK STORY</button>'+
      '<button type="button" data-link-source>LINK SOURCE</button>'+
      '<span class="studio-link-status">Select text, then attach context.</span>'+
      '<div class="studio-link-panel" data-story-panel hidden>'+
        '<input type="search" placeholder="Search published Neural Critic stories">'+
        '<div class="studio-link-results"></div>'+
      '</div>'+
      '<div class="studio-link-panel" data-source-panel hidden>'+
        '<input type="url" placeholder="https://official-source.example/article">'+
        '<button type="button" data-apply-source>APPLY SOURCE LINK</button>'+
      '</div>';
    textarea.insertAdjacentElement('afterend',tools);

    const storyPanel=$('[data-story-panel]',tools),sourcePanel=$('[data-source-panel]',tools);
    $('[data-link-story]',tools).addEventListener('click',async()=>{
      if(!selection(textarea).text){studioToast('Select the words you want readers to click first.',true);return;}
      sourcePanel.hidden=true;
      storyPanel.hidden=!storyPanel.hidden;
      if(!storyPanel.hidden){
        const input=$('input',storyPanel);
        input.value=selection(textarea).text;
        await renderStoryResults(storyPanel,input.value);
        input.focus();
        input.select();
      }
    });
    $('[data-link-source]',tools).addEventListener('click',()=>{
      if(!selection(textarea).text){studioToast('Select the words you want readers to click first.',true);return;}
      storyPanel.hidden=true;
      sourcePanel.hidden=!sourcePanel.hidden;
      if(!sourcePanel.hidden)$('input',sourcePanel).focus();
    });
    $('input',storyPanel).addEventListener('input',event=>renderStoryResults(storyPanel,event.target.value));
    storyPanel.addEventListener('click',event=>{
      const item=event.target.closest('[data-story-slug]');
      if(!item)return;
      if(insertLink(textarea,'story:'+item.dataset.storySlug)){
        storyPanel.hidden=true;
        studioToast('Internal Neural Critic link inserted.');
      }
    });
    $('[data-apply-source]',sourcePanel).addEventListener('click',()=>{
      const raw=$('input',sourcePanel).value.trim();
      let valid='';
      try{
        const url=new URL(raw);
        if(url.protocol==='https:'||url.protocol==='http:')valid=url.href;
      }catch(_){}
      if(!valid){studioToast('Use a valid HTTP or HTTPS source URL.',true);return;}
      if(insertLink(textarea,valid)){
        sourcePanel.hidden=true;
        studioToast('External source link inserted.');
      }
    });
  }

  async function decorateRelated(card){
    const input=$('[data-field="relatedStorySlug"]',card);
    if(!input||input.dataset.ncRelatedReady==='1')return;
    input.dataset.ncRelatedReady='1';
    const note=document.createElement('div');
    note.className='studio-related-note';
    note.textContent='Type a title or slug. Choose a published story to create a visual RELATED card after this section.';
    input.insertAdjacentElement('afterend',note);
    const results=document.createElement('div');
    results.className='studio-link-results';
    note.insertAdjacentElement('afterend',results);

    async function update(){
      const all=await stories();
      const q=input.value.trim().toLowerCase();
      if(!q){results.innerHTML='';return;}
      const matched=all.filter(story=>[story.title,story.slug,story.category].join(' ').toLowerCase().includes(q)).slice(0,6);
      results.innerHTML='';
      matched.forEach(story=>results.appendChild(resultButton(story)));
    }

    input.addEventListener('input',update);
    input.addEventListener('focus',update);
    results.addEventListener('click',event=>{
      const item=event.target.closest('[data-story-slug]');
      if(!item)return;
      input.value=item.dataset.storySlug;
      input.dispatchEvent(new Event('input',{bubbles:true}));
      results.innerHTML='';
      studioToast('Related story card linked.');
    });
  }

  function scan(root=document){
    const intro=root.matches?.('#body')?root:$('#body',root);
    if(intro)decorateTextarea(intro);
    $$('textarea[data-field="text"]',root).forEach(decorateTextarea);
    const cards=root.matches?.('.section-card')?[root]:$$('.section-card',root);
    cards.forEach(card=>decorateRelated(card));
  }

  function init(){
    scan();
    const list=$('#sections-list');
    if(list){
      const observer=new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(node=>{
        if(node instanceof Element)scan(node);
      })));
      observer.observe(list,{childList:true,subtree:true});
    }
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();