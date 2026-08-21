(() => {
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const LOCAL_KEY = 'neural-critic-studio-stories-v1';
  const PROFILE_KEY = 'neural-critic-studio-profile-v1';
  const DEFAULT_AVATAR = 'images/editorial/499627ae-e4d1-40d6-be0d-45efc750a1d9.jpg';
  let publishedIndex = [];
  let activeTab = 'all';
  let activeFormat = 'standard';
  let editingSource = null;
  let sectionCounter = 0;

  const esc = (v='') => String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const slugify = (v='') => v.toLowerCase().trim().replace(/['’]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,100);
  const readLocal = () => { try { return JSON.parse(localStorage.getItem(LOCAL_KEY)) || []; } catch(_) { return []; } };
  const writeLocal = value => localStorage.setItem(LOCAL_KEY, JSON.stringify(value));
  const toast = (message, error=false) => { const el=$('#studio-toast'); el.textContent=message; el.classList.toggle('error',error); el.classList.add('show'); clearTimeout(el._timer); el._timer=setTimeout(()=>el.classList.remove('show'),2600); };
  const lines = value => String(value||'').split(/\n+/).map(x=>x.trim()).filter(Boolean);

  function formatLabel(format){ return ({standard:'STANDARD', 'ranked-list':'RANKED LIST', 'game-guide':'GAME GUIDE', review:'GAME REVIEW'})[format] || format.toUpperCase(); }
  function statusLabel(status){ return String(status||'draft').toUpperCase(); }

  function setFormat(format){
    activeFormat = format;
    $$('.format-card').forEach(btn=>btn.classList.toggle('active',btn.dataset.format===format));
    $('#review-fields').hidden = format !== 'review';
    $$('.rank-fields').forEach(el=>el.hidden = format !== 'ranked-list');
    if(format==='review') $('#category').value='REVIEW';
    else if(format==='game-guide') $('#category').value='GUIDE';
    else if($('#category').value==='REVIEW' || $('#category').value==='GUIDE') $('#category').value='FEATURE';
  }

  function sectionTemplate(data={}){
    const id=++sectionCounter;
    const rank = data.rank || '';
    const html=`<article class="section-card" data-section-id="${id}">
      <div class="section-top"><b>SECTION <span class="section-number"></span></b><div class="section-actions"><button type="button" data-move="up">↑</button><button type="button" data-move="down">↓</button><button type="button" data-remove>REMOVE</button></div></div>
      <div class="section-fields">
        <label class="wide">HEADING<input data-field="heading" value="${esc(data.heading||'')}" placeholder="Focused section heading"></label>
        <label class="wide">TEXT<textarea data-field="text" rows="7" placeholder="Write this section…">${esc(data.text||'')}</textarea></label>
        <label>IMAGE URL<input data-field="imageLocal" value="${esc(data.imageLocal||'')}" placeholder="images/editorial/…"></label>
        <label>IMAGE DESCRIPTION<input data-field="imageAlt" value="${esc(data.imageAlt||'')}" placeholder="Accessibility description"></label>
        <label class="wide">CAPTION<input data-field="caption" value="${esc(data.caption||'')}" placeholder="Visible caption / source context"></label>
        <div class="rank-fields" ${activeFormat==='ranked-list'?'':'hidden'}>
          <label>RANK<input data-field="rank" value="${esc(rank)}" placeholder="7"></label>
          <label>SUBTITLE<input data-field="subtitle" value="${esc(data.subtitle||'')}" placeholder="Why this position matters"></label>
          <label>DEVELOPER<input data-field="developer" value="${esc(data.developer||'')}"></label>
          <label>RELEASE YEAR<input data-field="releaseYear" value="${esc(data.releaseYear||'')}"></label>
          <label>PLATFORMS<input data-field="platforms" value="${esc(data.platforms||'')}"></label>
          <label>GENRE<input data-field="genre" value="${esc(data.genre||'')}"></label>
        </div>
      </div>
    </article>`;
    $('#sections-list').insertAdjacentHTML('beforeend',html);
    renumberSections();
    updateEmptyBuilder();
  }

  function renumberSections(){ $$('.section-card').forEach((card,i)=>$('.section-number',card).textContent=String(i+1).padStart(2,'0')); }
  function updateEmptyBuilder(){ $('#first-section').hidden = $$('.section-card').length>0; }
  function clearSections(){ $('#sections-list').innerHTML=''; sectionCounter=0; updateEmptyBuilder(); }

  function sectionData(card){
    const result={};
    $$('[data-field]',card).forEach(input=>{ if(input.value.trim()) result[input.dataset.field]=input.value.trim(); });
    return result;
  }

  function collectArticle(status='draft'){
    const title=$('#title').value.trim();
    const slug=$('#slug').value.trim() || slugify(title);
    const publishedAt = editingSource?.publishedAt || (status==='published' ? new Date().toISOString() : null);
    const obj={
      id: editingSource?.id || Date.now(), slug, title,
      description:$('#description').value.trim(), body:$('#body').value.trim(),
      category:$('#category').value, author:$('#author').value.trim() || 'Rouane Mounssif',
      tags:$('#tags').value.split(',').map(x=>x.trim()).filter(Boolean),
      imageAlt:$('#featured-alt').value.trim(), articleFormat:activeFormat,
      contentBlocks:$$('.section-card').map(sectionData),
      featured:$('#homepage-slot').value!=='regular', homepageSlot:$('#homepage-slot').value,
      publishedAt,
      imageLocal:$('#featured-image').value.trim(),
      status, scheduleAt:$('#schedule-date').value || null,
      imageCredit:$('#featured-credit').value.trim()
    };
    if(activeFormat==='review') obj.reviewMeta={
      score:$('#review-score').value.trim(), verdict:$('#review-verdict').value.trim(),
      pros:lines($('#review-pros').value), cons:lines($('#review-cons').value),
      testedPlatform:$('#review-platform').value.trim(), developer:$('#review-developer').value.trim(),
      publisher:$('#review-publisher').value.trim(), releaseDate:$('#review-release').value.trim(),
      reviewCopy:$('#review-copy').value.trim()
    }; else obj.reviewMeta={};
    if(activeFormat==='ranked-list'){
      obj.quickRead=obj.contentBlocks.slice(0,3).map(x=>x.subtitle||x.heading).filter(Boolean);
      obj.conclusion='';
    }
    return obj;
  }

  function validateArticle(article, status){
    if(!article.title) return 'Headline is required.';
    if(!article.slug) return 'A URL slug is required.';
    if(status==='scheduled' && !article.scheduleAt) return 'Choose a schedule date first.';
    if(article.articleFormat==='review' && !article.reviewMeta?.score) return 'Game reviews need a score.';
    if(article.articleFormat==='ranked-list' && !article.contentBlocks.length) return 'Ranked lists need at least one ranked entry.';
    return '';
  }

  function saveLocal(status){
    const article=collectArticle(status);
    const error=validateArticle(article,status); if(error){toast(error,true);return;}
    const records=readLocal();
    const idx=records.findIndex(x=>x.slug===article.slug);
    if(idx>=0) records[idx]=article; else records.unshift(article);
    writeLocal(records); editingSource={...article,local:true};
    renderLibrary();
    toast(status==='draft'?'Draft saved in this browser.':status==='scheduled'?'Story scheduled locally.':'Story marked published locally — backend connection comes next.');
  }

  function resetForm(){
    $('#article-form').reset(); $('#author').value='Rouane Mounssif'; $('#category').value='FEATURE'; $('#homepage-slot').value='regular';
    clearSections(); setFormat('standard'); editingSource=null; $('#title').focus();
  }

  function fillForm(article, local=false){
    editingSource={...article,local};
    setFormat(article.articleFormat||'standard');
    $('#title').value=article.title||''; $('#slug').value=article.slug||''; $('#category').value=article.category||'FEATURE';
    $('#description').value=article.description||''; $('#body').value=article.body||''; $('#author').value=article.author||'Rouane Mounssif';
    $('#tags').value=(article.tags||[]).join(', '); $('#featured-image').value=article.imageLocal||''; $('#featured-alt').value=article.imageAlt||'';
    $('#featured-credit').value=article.imageCredit||''; $('#homepage-slot').value=article.homepageSlot||'regular'; $('#schedule-date').value=article.scheduleAt||'';
    if(article.reviewMeta){
      $('#review-score').value=article.reviewMeta.score||''; $('#review-verdict').value=article.reviewMeta.verdict||'';
      $('#review-pros').value=(article.reviewMeta.pros||[]).join('\n'); $('#review-cons').value=(article.reviewMeta.cons||[]).join('\n');
      $('#review-platform').value=article.reviewMeta.testedPlatform||''; $('#review-developer').value=article.reviewMeta.developer||'';
      $('#review-publisher').value=article.reviewMeta.publisher||''; $('#review-release').value=article.reviewMeta.releaseDate||''; $('#review-copy').value=article.reviewMeta.reviewCopy||'';
    }
    clearSections(); (article.contentBlocks||[]).forEach(sectionTemplate); window.scrollTo({top:0,behavior:'smooth'}); toast(`Loaded “${article.title}” into the editor.`);
  }

  async function editStory(slug, local){
    try{
      if(local){ const item=readLocal().find(x=>x.slug===slug); if(item) return fillForm(item,true); }
      const article=await fetch(`data/articles/${encodeURIComponent(slug)}.json`).then(r=>{if(!r.ok)throw new Error();return r.json()});
      fillForm(article,false);
    }catch(_){toast('Could not load that story.',true);}
  }

  function exportJson(){
    const article=collectArticle(editingSource?.status||'draft');
    const error=validateArticle(article,'draft'); if(error){toast(error,true);return;}
    const clean={...article}; delete clean.status; delete clean.scheduleAt; delete clean.imageCredit;
    const blob=new Blob([JSON.stringify(clean,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download=`${article.slug}.json`; a.click(); URL.revokeObjectURL(url); toast('Article JSON exported.');
  }

  function combinedStories(){
    const local=readLocal(); const map=new Map(publishedIndex.map(x=>[x.slug,{...x,status:'published',local:false}]));
    local.forEach(x=>map.set(x.slug,{...x,local:true}));
    return [...map.values()].sort((a,b)=>new Date(b.publishedAt||b.scheduleAt||0)-new Date(a.publishedAt||a.scheduleAt||0));
  }

  function renderLibrary(){
    const all=combinedStories(); const list=activeTab==='all'?all:all.filter(x=>(x.status||'published')===activeTab);
    $('#story-count').textContent=all.length;
    $('#story-library').innerHTML=list.map(x=>`<article class="library-story" data-status="${esc(x.status||'published')}"><small>${statusLabel(x.status||'published')}</small><h3>${esc(x.title||'Untitled')}</h3><p>${esc(x.category||'')} · ${esc(x.publishedAt?new Date(x.publishedAt).toLocaleDateString():x.scheduleAt?`Scheduled ${x.scheduleAt}`:'Not published')}</p><div class="story-tags"><span>${formatLabel(x.articleFormat||'standard')}</span><span>${esc(x.homepageSlot||'regular')}</span></div><div class="story-actions"><button type="button" data-edit="${esc(x.slug)}" data-local="${x.local?'1':'0'}">EDIT</button>${(x.status||'published')==='published'?`<a href="article.html?slug=${encodeURIComponent(x.slug)}">VIEW</a>`:''}${x.local?`<button type="button" class="danger" data-delete="${esc(x.slug)}">DELETE</button>`:''}</div></article>`).join('') || '<p style="color:#718092;font-size:10px;padding:18px 0">No stories in this view yet.</p>';
  }

  function saveProfile(){
    const image=$('#profile-image').value.trim()||DEFAULT_AVATAR, alt=$('#profile-alt').value.trim();
    localStorage.setItem(PROFILE_KEY,JSON.stringify({image,alt})); $('#profile-preview').src=image; $('#profile-preview').alt=alt||'Author profile'; toast('Author profile saved locally.');
  }
  function loadProfile(){ try{const p=JSON.parse(localStorage.getItem(PROFILE_KEY)); if(!p)return; $('#profile-image').value=p.image||''; $('#profile-alt').value=p.alt||''; $('#profile-preview').src=p.image||DEFAULT_AVATAR;}catch(_){} }

  function wire(){
    $$('.format-card').forEach(btn=>btn.addEventListener('click',()=>setFormat(btn.dataset.format)));
    $('#title').addEventListener('input',()=>{ if(!editingSource || !$('#slug').dataset.touched) $('#slug').value=slugify($('#title').value); });
    $('#slug').addEventListener('input',()=>$('#slug').dataset.touched='1');
    $('#add-section').addEventListener('click',()=>sectionTemplate()); $('#first-section').addEventListener('click',()=>sectionTemplate());
    $('#sections-list').addEventListener('click',e=>{ const card=e.target.closest('.section-card'); if(!card)return; if(e.target.closest('[data-remove]')){card.remove();renumberSections();updateEmptyBuilder();return;} const move=e.target.closest('[data-move]')?.dataset.move; if(move==='up'&&card.previousElementSibling) card.parentNode.insertBefore(card,card.previousElementSibling); if(move==='down'&&card.nextElementSibling) card.parentNode.insertBefore(card.nextElementSibling,card); renumberSections(); });
    $('#save-draft').addEventListener('click',()=>saveLocal('draft')); $('#schedule-story').addEventListener('click',()=>saveLocal('scheduled')); $('#publish-story').addEventListener('click',()=>saveLocal('published')); $('#export-json').addEventListener('click',exportJson); $('#save-profile').addEventListener('click',saveProfile);
    $('#profile-image').addEventListener('input',()=>{const v=$('#profile-image').value.trim();if(v)$('#profile-preview').src=v});
    $('#library-tabs').addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(!b)return;activeTab=b.dataset.tab;$$('#library-tabs button').forEach(x=>x.classList.toggle('active',x===b));renderLibrary();});
    $('#story-library').addEventListener('click',e=>{const edit=e.target.closest('[data-edit]');if(edit)return editStory(edit.dataset.edit,edit.dataset.local==='1');const del=e.target.closest('[data-delete]');if(del){const records=readLocal().filter(x=>x.slug!==del.dataset.delete);writeLocal(records);renderLibrary();toast('Local Studio copy deleted.');}});
    window.addEventListener('beforeunload',()=>{ if($('#title').value.trim()){ try{localStorage.setItem('neural-critic-studio-autosave',JSON.stringify(collectArticle('draft')))}catch(_){} } });
  }

  async function init(){
    loadProfile(); wire(); setFormat('standard'); updateEmptyBuilder();
    try{publishedIndex=await fetch('data/articles.json').then(r=>r.json())}catch(_){publishedIndex=[]}
    renderLibrary();
    try{const auto=JSON.parse(localStorage.getItem('neural-critic-studio-autosave')); if(auto?.title && !readLocal().some(x=>x.slug===auto.slug)) toast('Studio is ready. Your browser also has an unsaved autosave available from a previous session.'); else toast('Editorial Studio ready.');}catch(_){toast('Editorial Studio ready.');}
  }
  init();
})();