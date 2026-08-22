(() => {
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const LOCAL_KEY = 'neural-critic-studio-stories-v1';

  /* Values stay backward-compatible with existing stored articles. The labels
     now describe Neural Critic's publication roles instead of abstract effects. */
  const headingOptions = [
    ['editorial','NC SECTION — CLEAN EDITORIAL (DEFAULT)'],
    ['display','NC DISPLAY — LARGE FEATURE MOMENT'],
    ['accent','NC ACCENT — CYAN / VIOLET SIGNAL'],
    ['statement','NC STATEMENT — RULE + EMPHASIS']
  ];

  const tools = [
    ['bold','BOLD','**','**'],
    ['italic','ITALIC','*','*'],
    ['highlight','HIGHLIGHT','==','=='],
    ['accent','ACCENT','^^','^^']
  ];

  function wrapSelection(textarea, before, after){
    const start=textarea.selectionStart ?? 0;
    const end=textarea.selectionEnd ?? start;
    const selected=textarea.value.slice(start,end);
    const fallback=selected || 'text';
    textarea.setRangeText(`${before}${fallback}${after}`,start,end,'end');
    textarea.dispatchEvent(new Event('input',{bubbles:true}));
    textarea.focus();
    if(!selected){
      const a=start+before.length;
      textarea.setSelectionRange(a,a+fallback.length);
    }
  }

  function enhanceCard(card){
    if(card.dataset.formattingReady) return;
    card.dataset.formattingReady='1';
    const heading=$('[data-field="heading"]',card);
    const text=$('[data-field="text"]',card);
    if(heading){
      const headingLabel=heading.closest('label');
      headingLabel?.insertAdjacentHTML('afterend',`<label class="wide studio-heading-style">NEURAL CRITIC HEADING ROLE<select data-field="headingStyle">${headingOptions.map(([value,label])=>`<option value="${value}">${label}</option>`).join('')}</select><small>NC Section is the publication default. Body typography and spacing are applied automatically on the public article.</small></label>`);
    }
    if(text){
      const label=text.closest('label');
      const toolbar=document.createElement('div');
      toolbar.className='studio-text-toolbar';
      toolbar.innerHTML=`<span>INLINE EMPHASIS</span>${tools.map(([key,label])=>`<button type="button" data-format-tool="${key}">${label}</button>`).join('')}<small>Keep prose mostly clean; use emphasis only where it improves reading.</small>`;
      label?.insertBefore(toolbar,text);
      toolbar.addEventListener('click',event=>{
        const btn=event.target.closest('[data-format-tool]');
        if(!btn)return;
        const tool=tools.find(([key])=>key===btn.dataset.formatTool);
        if(tool)wrapSelection(text,tool[2],tool[3]);
      });
    }
  }

  function enhanceAll(){ $$('.section-card').forEach(enhanceCard); }

  function readLocalStory(slug){
    try{return (JSON.parse(localStorage.getItem(LOCAL_KEY))||[]).find(x=>x.slug===slug)||null}catch(_){return null}
  }

  function applyStyles(blocks=[]){
    requestAnimationFrame(()=>{
      $$('.section-card').forEach((card,index)=>{
        enhanceCard(card);
        const select=$('[data-field="headingStyle"]',card);
        if(select)select.value=blocks[index]?.headingStyle||'editorial';
      });
    });
  }

  async function restoreStyles(slug){
    if(!slug)return;
    const local=readLocalStory(slug);
    if(local?.contentBlocks?.length){applyStyles(local.contentBlocks);return;}
    const client=window.neuralCriticSupabase;
    if(!client)return;
    try{
      const {data,error}=await client.from('articles').select('content_blocks').eq('slug',slug).maybeSingle();
      if(!error&&data)applyStyles(Array.isArray(data.content_blocks)?data.content_blocks:[]);
    }catch(_){}
  }

  const list=$('#sections-list');
  if(list){
    const observer=new MutationObserver(()=>enhanceAll());
    observer.observe(list,{childList:true,subtree:true});
  }
  enhanceAll();

  $('#story-library')?.addEventListener('click',event=>{
    const edit=event.target.closest('[data-edit]');
    if(!edit)return;
    setTimeout(()=>restoreStyles(edit.dataset.edit),420);
  });

  window.addEventListener('load',()=>{
    enhanceAll();
    const slug=$('#slug')?.value?.trim();
    if(slug)restoreStyles(slug);
  });
})();
