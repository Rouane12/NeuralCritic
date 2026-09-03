(() => {
  'use strict';

  const client = window.neuralCriticPrivateSupabase;
  if (!client) return;
  const $ = (s, root=document) => root.querySelector(s);
  const esc = (v='') => String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const priorityRank = {urgent:0,high:1,normal:2,low:3};
  const workflowLabels = {idea:'IDEA',reporting:'REPORTING',drafting:'DRAFTING',editing:'EDITING',ready:'READY',hold:'ON HOLD'};
  const verificationLabels = {not_required:'NOT REQUIRED',sourcing:'SOURCING',reported:'ATTRIBUTED / REPORTED',verified:'VERIFIED'};
  const homepageLabels = {inherit:'INHERIT CURRENT',regular:'REGULAR',lead:'LEAD STORY','secondary-top':'SECONDARY TOP','secondary-bottom':'SECONDARY BOTTOM'};

  let currentUser = null;
  let editorProfile = null;
  let articles = [];
  let workflowMap = new Map();
  let selectedId = null;

  function toast(message,error=false){
    const el=$('#newsroom-toast'); if(!el)return;
    el.textContent=message; el.classList.toggle('error',error); el.classList.add('show');
    clearTimeout(el._timer); el._timer=setTimeout(()=>el.classList.remove('show'),2600);
  }

  function authStatus(message,error=false){
    const el=$('#newsroom-auth-status'); if(!el)return;
    el.textContent=message; el.classList.toggle('error',error);
  }

  function fmtDate(iso,withTime=false){
    if(!iso)return '—';
    try{return new Intl.DateTimeFormat('en-GB',withTime?{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}:{day:'2-digit',month:'short',year:'numeric'}).format(new Date(iso))}catch(_){return '—'}
  }

  function localDateTime(iso){
    if(!iso)return '';
    const d=new Date(iso); if(Number.isNaN(d.getTime()))return '';
    const off=d.getTimezoneOffset()*60000;
    return new Date(d.getTime()-off).toISOString().slice(0,16);
  }

  function deskOf(article){
    const section=String(article.editorial_section||'').toLowerCase();
    if(section)return section;
    const category=String(article.category||'').toLowerCase();
    if(category==='review')return 'reviews';
    if(category==='guide')return 'guides';
    if(category==='news')return 'news';
    return 'features';
  }

  function deriveWorkflow(article){
    const existing=workflowMap.get(article.id);
    if(existing)return existing;
    const meta=article.news_meta&&typeof article.news_meta==='object'?article.news_meta:{};
    const verification=String(article.category||'').toUpperCase()==='NEWS'
      ? meta.verification==='confirmed'?'verified':meta.verification==='reported'?'reported':'sourcing'
      : 'not_required';
    return {
      article_id:article.id,
      workflow_state:article.status==='published'||article.status==='scheduled'?'ready':'drafting',
      priority:'normal',
      assignee_name:editorProfile?.display_name||'',
      verification_status:verification,
      source_count:meta.sourceName?1:0,
      source_notes:'',
      internal_notes:'',
      due_at:null,
      reviewed_at:null,
      homepage_intent:'inherit',
      created_by:null,
      updated_by:null,
      virtual:true
    };
  }

  function health(article,workflow=deriveWorkflow(article)){
    const checks=[];
    const add=(state,title,detail)=>checks.push({state,title,detail});
    const title=String(article.title||'').trim();
    const description=String(article.description||'').trim();
    const tags=Array.isArray(article.tags)?article.tags:[];
    if(!title)add('block','Headline','Missing publishing headline.');
    else if(title.length<25||title.length>85)add('warn','Headline',`${title.length} characters; 25–85 is a stronger target.`);
    else add('ok','Headline','Card/search length looks healthy.');
    if(!description)add('block','Summary','Cards, search and social previews need a summary.');
    else if(description.length<70||description.length>170)add('warn','Summary',`${description.length} characters; 70–170 is a stronger preview range.`);
    else add('ok','Summary','Preview copy is in range.');
    if(!article.image_url)add('block','Featured image','A primary editorial image is required.'); else add('ok','Featured image','Primary image is set.');
    if(article.image_url&&!article.image_alt)add('block','Image description','Add accessibility text for the featured image.'); else if(article.image_alt)add('ok','Image description','Accessibility text is present.');
    if(tags.length<2)add('warn','Discovery tags','Add at least two focused tags.'); else add('ok','Discovery tags',`${tags.length} tags connected.`);
    if(!deskOf(article))add('warn','Editorial desk','Assign a publication desk.'); else add('ok','Editorial desk',deskOf(article).toUpperCase());

    if(String(article.category||'').toUpperCase()==='NEWS'){
      const meta=article.news_meta&&typeof article.news_meta==='object'?article.news_meta:{};
      if(!meta.kind)add('block','News classification','Choose BREAKING, UPDATE, or REPORT in Studio.'); else add('ok','News classification',String(meta.kind).toUpperCase());
      if(!meta.sourceName)add('block','Source / origin','Published news needs a named source.'); else add('ok','Source / origin',meta.sourceName);
      const acceptable=meta.kind==='report'?['reported','verified']:['verified'];
      if(!acceptable.includes(workflow.verification_status))add('block','Verification',meta.kind==='report'?'Mark the report attributed/reported or verified.':'Breaking/Update stories should be verified before publish.');
      else add('ok','Verification',verificationLabels[workflow.verification_status]||workflow.verification_status);
    }

    if(article.status==='scheduled'){
      if(!article.scheduled_at)add('block','Schedule','Scheduled story has no publish time.');
      else if(new Date(article.scheduled_at).getTime()<=Date.now())add('warn','Schedule','The scheduled time has already passed.');
      else add('ok','Schedule',fmtDate(article.scheduled_at,true));
    }

    const blockers=checks.filter(x=>x.state==='block');
    const warnings=checks.filter(x=>x.state==='warn');
    const ok=checks.filter(x=>x.state==='ok');
    const score=Math.round(((ok.length+warnings.length*.55)/Math.max(1,checks.length))*100);
    return {checks,blockers,warnings,score,ready:!blockers.length};
  }

  function allRows(){ return articles.map(article=>({article,workflow:deriveWorkflow(article),health:health(article,deriveWorkflow(article))})); }

  function matchesFilters(row){
    const q=($('#newsroom-search')?.value||'').trim().toLowerCase();
    const status=$('#filter-status')?.value||'all';
    const workflow=$('#filter-workflow')?.value||'all';
    const priority=$('#filter-priority')?.value||'all';
    const desk=$('#filter-desk')?.value||'all';
    if(status!=='all'&&row.article.status!==status)return false;
    if(workflow!=='all'&&row.workflow.workflow_state!==workflow)return false;
    if(priority!=='all'&&row.workflow.priority!==priority)return false;
    if(desk!=='all'&&deskOf(row.article)!==desk)return false;
    if(q){
      const text=[row.article.title,row.article.slug,row.article.author_name,row.article.game_key,row.article.series,row.article.franchise,...(row.article.tags||[])].filter(Boolean).join(' ').toLowerCase();
      if(!text.includes(q))return false;
    }
    return true;
  }

  function sortRows(rows){
    return rows.sort((a,b)=>{
      const p=(priorityRank[a.workflow.priority]??2)-(priorityRank[b.workflow.priority]??2); if(p)return p;
      const aDue=a.workflow.due_at?new Date(a.workflow.due_at).getTime():Infinity;
      const bDue=b.workflow.due_at?new Date(b.workflow.due_at).getTime():Infinity;
      if(aDue!==bDue)return aDue-bDue;
      const statusRank={draft:0,scheduled:1,published:2};
      const s=(statusRank[a.article.status]??3)-(statusRank[b.article.status]??3); if(s)return s;
      return new Date(b.article.updated_at||0)-new Date(a.article.updated_at||0);
    });
  }

  function renderStats(){
    const rows=allRows();
    const drafts=rows.filter(x=>x.article.status==='draft').length;
    const progress=rows.filter(x=>['reporting','drafting','editing'].includes(x.workflow.workflow_state)&&x.article.status!=='published').length;
    const ready=rows.filter(x=>x.article.status==='draft'&&x.health.ready).length;
    const scheduled=rows.filter(x=>x.article.status==='scheduled').length;
    const developing=rows.filter(x=>String(x.article.category||'').toUpperCase()==='NEWS'&&x.article.news_meta?.developing).length;
    $('#stat-drafts').textContent=drafts; $('#stat-progress').textContent=progress; $('#stat-ready').textContent=ready; $('#stat-scheduled').textContent=scheduled; $('#stat-developing').textContent=developing;
  }

  function renderQueue(){
    const rows=sortRows(allRows().filter(matchesFilters));
    $('#newsroom-count').textContent=rows.length;
    const host=$('#newsroom-queue');
    if(!rows.length){host.innerHTML='<div class="newsroom-queue-empty">No stories match this newsroom view.</div>';return;}
    host.innerHTML=rows.map(({article,workflow,health:h})=>{
      const healthClass=h.blockers.length?'block':h.warnings.length?'warn':'';
      const due=workflow.due_at?`DUE ${fmtDate(workflow.due_at,true)}`:`UPDATED ${fmtDate(article.updated_at,true)}`;
      return `<button type="button" class="newsroom-story ${article.id===selectedId?'active':''}" data-story-id="${esc(article.id)}"><i class="newsroom-priority-dot ${esc(workflow.priority)}"></i><div class="newsroom-story-copy"><div class="newsroom-story-meta"><span class="${String(article.category||'').toUpperCase()==='NEWS'?'news':''}">${esc(String(article.category||'STORY').toUpperCase())}</span><span>${esc(String(article.status||'draft').toUpperCase())}</span><span>${esc(workflowLabels[workflow.workflow_state]||workflow.workflow_state)}</span></div><h3>${esc(article.title||'Untitled')}</h3><p>${esc(article.game_key||article.franchise||article.author_name||article.slug)}</p></div><div class="newsroom-story-side"><b class="newsroom-health ${healthClass}">${h.score}% READY</b><time>${esc(due)}</time></div></button>`;
    }).join('');
  }

  function selectOptions(values,current){ return Object.entries(values).map(([value,label])=>`<option value="${esc(value)}" ${value===current?'selected':''}>${esc(label)}</option>`).join(''); }

  function renderDetail(){
    const host=$('#newsroom-detail');
    const article=articles.find(x=>x.id===selectedId);
    if(!article){host.innerHTML='<div class="newsroom-empty"><b>NC</b><h2>Select a story</h2><p>Open any queue item to review its workflow, verification state, and publication health.</p></div>';return;}
    const workflow=deriveWorkflow(article); const h=health(article,workflow); const meta=article.news_meta||{};
    const healthClass=h.blockers.length?'block':h.warnings.length?'warn':'';
    const studioUrl=`studio.html?slug=${encodeURIComponent(article.slug)}`;
    const publicUrl=article.status==='published'?`stories/${encodeURIComponent(article.slug)}/`:'';
    host.innerHTML=`<div class="newsroom-detail-head"><small>${esc(deskOf(article).toUpperCase())} · ${esc(String(article.article_format||'standard').toUpperCase())}</small><h2>${esc(article.title||'Untitled')}</h2><p>${esc(article.description||'No summary yet.')}</p><div class="newsroom-detail-chips"><span>${esc(String(article.status||'draft').toUpperCase())}</span><span>${esc(workflowLabels[workflow.workflow_state]||workflow.workflow_state)}</span><span>${esc(String(workflow.priority||'normal').toUpperCase())}</span><span class="newsroom-health ${healthClass}">${h.score}% READY</span></div></div><div class="newsroom-detail-body"><div class="newsroom-mini-context"><article><span>CURRENT HOMEPAGE</span><b>${esc(String(article.homepage_slot||'regular').toUpperCase())}</b></article><article><span>${article.status==='scheduled'?'PUBLISH TIME':'LAST UPDATED'}</span><b>${esc(fmtDate(article.status==='scheduled'?article.scheduled_at:article.updated_at,true))}</b></article>${String(article.category||'').toUpperCase()==='NEWS'?`<article><span>NEWS DESK</span><b>${esc(String(meta.kind||'UNCLASSIFIED').toUpperCase())}${meta.developing?' · DEVELOPING':''}</b></article><article><span>PUBLIC SOURCE</span><b>${esc(meta.sourceName||'NOT SET')}</b></article>`:''}</div><div class="newsroom-form-grid"><label>WORKFLOW STATE<select id="workflow-state">${selectOptions(workflowLabels,workflow.workflow_state)}</select></label><label>PRIORITY<select id="workflow-priority">${selectOptions({urgent:'URGENT',high:'HIGH',normal:'NORMAL',low:'LOW'},workflow.priority)}</select></label><label>ASSIGNEE<input id="workflow-assignee" value="${esc(workflow.assignee_name||editorProfile?.display_name||'')}"></label><label>VERIFICATION<select id="workflow-verification">${selectOptions(verificationLabels,workflow.verification_status)}</select></label><label>SOURCE COUNT<input id="workflow-source-count" type="number" min="0" max="99" value="${Number(workflow.source_count||0)}"></label><label>DUE / REVIEW TARGET<input id="workflow-due" type="datetime-local" value="${esc(localDateTime(workflow.due_at))}"></label><label class="span-2">HOMEPAGE INTENT<select id="workflow-homepage">${selectOptions(homepageLabels,workflow.homepage_intent||'inherit')}</select></label><label class="span-2">SOURCE / VERIFICATION NOTES<textarea id="workflow-source-notes" placeholder="What sources have been checked? What remains unverified?">${esc(workflow.source_notes||'')}</textarea></label><label class="span-2">INTERNAL EDITORIAL NOTES<textarea id="workflow-internal-notes" placeholder="Angle, follow-up, edit notes, dependencies…">${esc(workflow.internal_notes||'')}</textarea></label></div><section class="newsroom-health-panel"><header><div><small>PUBLICATION HEALTH</small><h3>${h.blockers.length?`${h.blockers.length} blocker${h.blockers.length===1?'':'s'} before publish`:h.warnings.length?'Ready with editorial notes':'Ready for publication'}</h3></div><b class="newsroom-health ${healthClass}">${h.score}%</b></header><div class="newsroom-health-list">${h.checks.map(check=>`<div class="newsroom-health-item ${check.state}"><i>${check.state==='ok'?'✓':check.state==='warn'?'!':'×'}</i><div><b>${esc(check.title)}</b><span>${esc(check.detail)}</span></div></div>`).join('')}</div></section><div class="newsroom-actions"><button type="button" class="primary" id="save-workflow">SAVE WORKFLOW</button><button type="button" id="mark-reviewed">MARK REVIEWED</button><a href="${studioUrl}">OPEN IN STUDIO →</a>${publicUrl?`<a href="${publicUrl}" target="_blank" rel="noopener">VIEW LIVE ↗</a>`:'<a href="studio.html">PREPARE TO PUBLISH →</a>'}</div></div>`;
  }

  function renderAll(){renderStats();renderQueue();renderDetail();}

  function formPayload(article,markReviewed=false){
    const existing=workflowMap.get(article.id);
    return {
      article_id:article.id,
      workflow_state:$('#workflow-state')?.value||'drafting',
      priority:$('#workflow-priority')?.value||'normal',
      assignee_name:($('#workflow-assignee')?.value||'').trim(),
      verification_status:$('#workflow-verification')?.value||'not_required',
      source_count:Math.max(0,Number($('#workflow-source-count')?.value||0)),
      source_notes:($('#workflow-source-notes')?.value||'').trim(),
      internal_notes:($('#workflow-internal-notes')?.value||'').trim(),
      due_at:$('#workflow-due')?.value?new Date($('#workflow-due').value).toISOString():null,
      reviewed_at:markReviewed?new Date().toISOString():(existing?.reviewed_at||null),
      homepage_intent:$('#workflow-homepage')?.value||'inherit',
      created_by:existing?.created_by||currentUser.id,
      updated_by:currentUser.id
    };
  }

  async function saveWorkflow(markReviewed=false){
    const article=articles.find(x=>x.id===selectedId); if(!article||!currentUser)return;
    const payload=formPayload(article,markReviewed);
    const {data,error}=await client.from('editorial_workflow').upsert(payload,{onConflict:'article_id'}).select('*').single();
    if(error){toast(error.message||'Workflow save failed.',true);return;}
    workflowMap.set(article.id,data); renderAll(); toast(markReviewed?'Story marked reviewed.':'Workflow saved to the newsroom.');
  }

  async function loadData(){
    const {data:articleData,error:articleError}=await client.from('articles').select('id,slug,title,description,category,article_format,author_name,tags,image_url,image_alt,homepage_slot,status,scheduled_at,published_at,updated_at,editorial_section,platforms,collection,game_key,series,franchise,news_meta').order('updated_at',{ascending:false});
    if(articleError)throw articleError;
    const {data:workflowData,error:workflowError}=await client.from('editorial_workflow').select('*');
    if(workflowError)throw workflowError;
    articles=articleData||[]; workflowMap=new Map((workflowData||[]).map(row=>[row.article_id,row]));
    if(!selectedId&&articles.length)selectedId=articles[0].id;
    renderAll();
  }

  async function verifyEditor(user){
    const {data,error}=await client.from('editor_profiles').select('user_id,display_name,role').eq('user_id',user.id).maybeSingle();
    if(error)throw error;
    if(!data||!['editor','admin'].includes(data.role))throw new Error('This account is not approved for the Neural Critic newsroom.');
    return data;
  }

  async function authenticated(user){
    currentUser=user; editorProfile=await verifyEditor(user);
    $('#newsroom-user').textContent=editorProfile.display_name||'EDITOR'; $('#newsroom-signout').hidden=false;
    $('#newsroom-gate').hidden=true; document.body.classList.remove('newsroom-auth-pending');
    const live=$('.newsroom-live'); if(live)live.dataset.live='1'; $('#newsroom-connection').textContent='DATABASE LIVE';
    await loadData();
  }

  function wire(){
    ['#newsroom-search','#filter-status','#filter-workflow','#filter-priority','#filter-desk'].forEach(selector=>$(selector)?.addEventListener(selector==='#newsroom-search'?'input':'change',()=>{renderQueue();}));
    $('#newsroom-queue')?.addEventListener('click',event=>{const row=event.target.closest('[data-story-id]');if(!row)return;selectedId=row.dataset.storyId;renderQueue();renderDetail();});
    $('#newsroom-detail')?.addEventListener('click',event=>{if(event.target.closest('#save-workflow'))saveWorkflow(false);if(event.target.closest('#mark-reviewed'))saveWorkflow(true);});
    $('#newsroom-auth-form')?.addEventListener('submit',async event=>{event.preventDefault();authStatus('Signing in…');try{const {data,error}=await client.auth.signInWithPassword({email:$('#newsroom-email').value.trim(),password:$('#newsroom-password').value});if(error)throw error;await authenticated(data.user);authStatus('')}catch(error){authStatus(error.message||'Could not sign in.',true)}});
    $('#newsroom-signout')?.addEventListener('click',async()=>{await client.auth.signOut();location.reload();});
  }

  async function init(){
    wire();
    try{
      const {data:{session}}=await client.auth.getSession();
      if(session?.user)await authenticated(session.user); else {$('#newsroom-gate').hidden=false;authStatus('Sign in with an approved editor account.');}
    }catch(error){$('#newsroom-gate').hidden=false;authStatus(error.message||'Could not connect to the newsroom.',true);}
    client.auth.onAuthStateChange(async(event,session)=>{if(event==='SIGNED_IN'&&session?.user&&!currentUser){try{await authenticated(session.user)}catch(error){authStatus(error.message,true)}}});
  }

  init();
})();
