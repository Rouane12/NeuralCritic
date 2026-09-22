(() => {
  'use strict';
  const esc=(value='')=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let indexPromise=null;
  let hideTimer=null;
  const hoverCapable=()=>window.matchMedia?.('(hover:hover) and (pointer:fine)').matches;

  function loadIndex(){
    if(indexPromise)return indexPromise;
    indexPromise=fetch('data/articles.json',{cache:'no-store'})
      .then(r=>r.ok?r.json():[])
      .then(rows=>Array.isArray(rows)?rows:[])
      .catch(()=>[]);
    return indexPromise;
  }

  function previewNode(){
    let node=document.querySelector('.nc-link-preview');
    if(node)return node;
    node=document.createElement('aside');
    node.className='nc-link-preview';
    node.setAttribute('aria-hidden','true');
    document.body.appendChild(node);
    return node;
  }

  function position(node,anchor){
    const rect=anchor.getBoundingClientRect();
    const gap=10;
    const width=Math.min(340,window.innerWidth-28);
    const left=Math.min(window.innerWidth-width-14,Math.max(14,rect.left));
    let top=rect.bottom+gap;
    if(top+250>window.innerHeight)top=Math.max(14,rect.top-242-gap);
    node.style.width=width+'px';
    node.style.left=Math.round(left)+'px';
    node.style.top=Math.round(top)+'px';
  }

  async function show(anchor){
    if(!hoverCapable())return;
    const slug=String(anchor?.dataset?.ncStoryLink||'').trim();
    if(!slug)return;
    clearTimeout(hideTimer);
    const rows=await loadIndex();
    if(!anchor.matches(':hover,:focus'))return;
    const story=rows.find(item=>item?.slug===slug);
    if(!story)return;
    const node=previewNode();
    const image=story.imageLocal?'<div class="nc-link-preview-media"><img src="'+esc(story.imageLocal)+'" alt=""></div>':'';
    const description=story.description?'<span>'+esc(story.description)+'</span>':'';
    node.innerHTML='<div class="nc-link-preview-card">'+image+'<div class="nc-link-preview-copy"><small>'+esc(String(story.category||'STORY').toUpperCase())+' · NEURAL CRITIC</small><strong>'+esc(story.title||slug)+'</strong>'+description+'</div></div>';
    position(node,anchor);
    node.dataset.open='1';
  }

  function hide(){
    clearTimeout(hideTimer);
    hideTimer=setTimeout(()=>{
      const node=document.querySelector('.nc-link-preview');
      if(node)node.dataset.open='0';
    },90);
  }

  document.addEventListener('pointerover',event=>{
    const link=event.target.closest?.('a[data-nc-story-link]');
    if(link)show(link);
  });
  document.addEventListener('pointerout',event=>{
    const link=event.target.closest?.('a[data-nc-story-link]');
    if(link)hide();
  });
  document.addEventListener('focusin',event=>{
    const link=event.target.closest?.('a[data-nc-story-link]');
    if(link)show(link);
  });
  document.addEventListener('focusout',event=>{
    const link=event.target.closest?.('a[data-nc-story-link]');
    if(link)hide();
  });
  document.addEventListener('click',event=>{
    const link=event.target.closest?.('a.nc-context-link,.nc-related-story>a');
    if(!link)return;
    window.gtag?.('event','editorial_context_click',{
      link_kind:link.classList.contains('nc-link-external')?'external_source':link.closest('.nc-related-story')?'related_story':'internal_story',
      target_slug:link.dataset.ncStoryLink||'',
      target_url:link.href||''
    });
  },true);
})();