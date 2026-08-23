(() => {
  const $ = (s, root=document) => root.querySelector(s);
  const slug = window.NEURAL_CRITIC_STATIC_SLUG || new URLSearchParams(location.search).get('slug') || '';
  if(!slug)return;

  const esc = (value='') => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function inline(value=''){
    return esc(value)
      .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
      .replace(/\*(.+?)\*/g,'<em>$1</em>')
      .replace(/==([\s\S]+?)==/g,'<mark class="nc-text-highlight">$1</mark>')
      .replace(/\^\^([\s\S]+?)\^\^/g,'<span class="nc-text-accent">$1</span>');
  }

  function prose(text=''){
    return String(text||'').split(/\n\n+/).filter(Boolean).map(block=>{
      if(/^- /m.test(block)){
        const items=block.split('\n').filter(Boolean).map(x=>x.replace(/^-\s*/,''));
        return `<ul>${items.map(item=>`<li>${inline(item)}</li>`).join('')}</ul>`;
      }
      return `<p>${inline(block).replace(/\n/g,'<br>')}</p>`;
    }).join('');
  }

  async function waitForClient(limit=70){
    for(let i=0;i<limit;i++){
      if(window.neuralCriticPublicSupabase)return window.neuralCriticPublicSupabase;
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    return null;
  }

  async function waitForBody(limit=70){
    for(let i=0;i<limit;i++){
      const body=$('#article .article-body');
      if(body)return body;
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    return null;
  }

  async function readConclusion(){
    const client=await waitForClient();
    if(!client)return null;
    try{
      const {data,error}=await client.from('articles')
        .select('title,article_format,collection,conclusion,conclusion_heading,conclusion_heading_style')
        .eq('slug',slug).eq('status','published').maybeSingle();
      if(error)throw error;
      return data||null;
    }catch(_){return null;}
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

  async function findExisting(body, article){
    let section=$('.article-conclusion',body);
    if(section||article.article_format!=='ranked-list')return section;
    for(let i=0;i<50;i++){
      await new Promise(resolve=>setTimeout(resolve,100));
      section=$('.article-conclusion',body);
      if(section)return section;
    }
    return null;
  }

  function apply(article,body,existing=null){
    if(!article?.conclusion)return;
    const previousHeading=existing?.querySelector('h2')?.textContent?.trim()||'';
    const heading=article.conclusion_heading||previousHeading||fallbackHeading(article);
    const style=['editorial','display','accent','statement'].includes(article.conclusion_heading_style)?article.conclusion_heading_style:'editorial';
    const section=existing||document.createElement('section');
    if(!existing)body.appendChild(section);
    section.className=`article-conclusion nc-conclusion-block nc-heading-${style}`;
    section.dataset.headingStyle=style;
    section.innerHTML=`<span>FINAL VERDICT</span><h2 class="nc-editorial-heading nc-section">${esc(heading)}</h2><div class="nc-conclusion-copy">${prose(article.conclusion)}</div>`;
  }

  async function init(){
    const [article,body]=await Promise.all([readConclusion(),waitForBody()]);
    if(!article?.conclusion||!body)return;
    const existing=await findExisting(body,article);
    apply(article,body,existing);
    setTimeout(()=>{
      const section=$('.article-conclusion',body);
      if(section)apply(article,body,section);
    },700);
  }

  init();
})();