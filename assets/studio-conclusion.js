(() => {
  const $ = (s, root=document) => root.querySelector(s);
  const headingOptions = [
    ['editorial','NC SECTION — CLEAN EDITORIAL'],
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
  let pendingSave = null;

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

  function panelStatus(message, error=false){
    const el=$('[data-conclusion-status]');
    if(!el)return;
    el.textContent=message;
    el.classList.toggle('error',error);
  }

  function fallbackHeading(article){
    const collection=article.collection||'';
    if(collection==='all-time-greats')return 'A canon should stay open';
    if(collection==='best-games')return 'What belongs on your list?';
    if(collection==='game-of-the-year')return 'The final word on the year';
    if(collection==='upcoming-games')return 'What we’re watching next';
    if(article.article_format==='review')return 'Final verdict';
    if(article.article_format==='game-guide')return 'The bottom line';
    return 'The final word';
  }

  function buildPanel(){
    if($('#conclusion-text'))return;
    const builder=$('.story-builder');
    if(!builder)return;
    const panel=document.createElement('section');
    panel.className='studio-panel studio-conclusion-panel';
    panel.innerHTML=`
      <div class="builder-head studio-conclusion-head">
        <div>
          <small>ENDING BLOCK · OPTIONAL</small>
          <h2>Conclusion / Final Verdict</h2>
          <p>Give the story a deliberate ending without building another manual section.</p>
        </div>
        <span class="studio-conclusion-badge">PUBLICATION BLOCK</span>
      </div>
      <div class="studio-conclusion-fields">
        <label class="wide">HEADING
          <input id="conclusion-heading" placeholder="Final verdict">
        </label>
        <label class="wide">NEURAL CRITIC HEADING ROLE
          <select id="conclusion-heading-style">${headingOptions.map(([value,label])=>`<option value="${value}">${label}</option>`).join('')}</select>
          <small>Uses the same heading personalities as a normal article section.</small>
        </label>
        <label class="wide studio-conclusion-text-label">TEXT
          <div class="studio-text-toolbar studio-conclusion-toolbar">
            <span>INLINE EMPHASIS</span>
            ${tools.map(([key,label])=>`<button type="button" data-conclusion-format="${key}">${label}</button>`).join('')}
            <small>Bold, italic, highlight, and accent work exactly like section text.</small>
          </div>
          <textarea id="conclusion-text" rows="7" placeholder="Close the story with a clear final thought, verdict, or takeaway."></textarea>
        </label>
      </div>
      <div class="studio-conclusion-foot">
        <span data-conclusion-status>Leave this empty if the story does not need a dedicated ending block.</span>
      </div>`;
    builder.insertAdjacentElement('afterend',panel);

    panel.addEventListener('click',event=>{
      const btn=event.target.closest('[data-conclusion-format]');
      if(!btn)return;
      const tool=tools.find(([key])=>key===btn.dataset.conclusionFormat);
      if(tool)wrapSelection($('#conclusion-text'),tool[2],tool[3]);
    });
  }

  function clearPanel(){
    if($('#conclusion-heading'))$('#conclusion-heading').value='';
    if($('#conclusion-heading-style'))$('#conclusion-heading-style').value='editorial';
    if($('#conclusion-text'))$('#conclusion-text').value='';
    panelStatus('Leave this empty if the story does not need a dedicated ending block.');
  }

  async function waitForClient(limit=60){
    for(let i=0;i<limit;i++){
      if(window.neuralCriticSupabase)return window.neuralCriticSupabase;
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    return null;
  }

  async function loadConclusion(slug){
    if(!slug)return;
    const client=await waitForClient();
    if(!client){panelStatus('Conclusion data could not connect to the CMS.',true);return;}
    try{
      const {data,error}=await client.from('articles')
        .select('conclusion,conclusion_heading,conclusion_heading_style,article_format,collection')
        .eq('slug',slug).maybeSingle();
      if(error)throw error;
      if(!data){clearPanel();return;}
      $('#conclusion-heading').value=data.conclusion_heading||(data.conclusion?fallbackHeading(data):'');
      $('#conclusion-heading-style').value=['editorial','display','accent','statement'].includes(data.conclusion_heading_style)?data.conclusion_heading_style:'editorial';
      $('#conclusion-text').value=data.conclusion||'';
      panelStatus(data.conclusion?'Conclusion loaded from Neural Critic.':'This story does not have a dedicated conclusion yet.');
    }catch(error){
      panelStatus(error?.message||'Could not load the conclusion.',true);
    }
  }

  function snapshot(){
    const slug=$('#slug')?.value?.trim()||'';
    if(!slug)return null;
    return {
      slug,
      conclusion:$('#conclusion-text')?.value?.trim()||'',
      conclusion_heading:$('#conclusion-heading')?.value?.trim()||null,
      conclusion_heading_style:$('#conclusion-heading-style')?.value||'editorial'
    };
  }

  async function persist(payload, attempts=5){
    const client=await waitForClient();
    if(!client){panelStatus('Conclusion could not sync to the CMS.',true);return;}
    for(let attempt=0;attempt<attempts;attempt++){
      try{
        const {data,error}=await client.from('articles')
          .update({
            conclusion:payload.conclusion,
            conclusion_heading:payload.conclusion_heading,
            conclusion_heading_style:payload.conclusion_heading_style
          })
          .eq('slug',payload.slug)
          .select('slug');
        if(error)throw error;
        if(Array.isArray(data)&&data.length){
          panelStatus(payload.conclusion?'Conclusion synced to Neural Critic.':'Conclusion cleared from Neural Critic.');
          return;
        }
      }catch(error){
        if(attempt===attempts-1){panelStatus(error?.message||'Conclusion sync failed.',true);return;}
      }
      await new Promise(resolve=>setTimeout(resolve,350));
    }
    panelStatus('Conclusion sync could not find the article row.',true);
  }

  function wireLibrary(){
    $('#story-library')?.addEventListener('click',event=>{
      const edit=event.target.closest('[data-edit]');
      if(!edit)return;
      clearPanel();
      setTimeout(()=>loadConclusion(edit.dataset.edit),650);
    });
  }

  function wireSaves(){
    ['#save-draft','#schedule-story','#publish-story'].forEach(selector=>{
      $(selector)?.addEventListener('click',()=>{
        pendingSave=snapshot();
        if(pendingSave)panelStatus('Conclusion waiting for the article save…');
      });
    });
    const status=$('#studio-auth-status');
    if(!status)return;
    const observer=new MutationObserver(()=>{
      if(!pendingSave||!status.classList.contains('success'))return;
      if(!/database/i.test(status.textContent||''))return;
      const payload=pendingSave;
      pendingSave=null;
      persist(payload);
    });
    observer.observe(status,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  }

  function init(){
    buildPanel();
    wireLibrary();
    wireSaves();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();