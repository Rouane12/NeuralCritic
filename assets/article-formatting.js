(() => {
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];

  async function loadArticle(){
    const slug=new URLSearchParams(location.search).get('slug');
    if(!slug)return null;

    /* Heading roles should follow the same live CMS record the reader sees.
       Prefer the public content API, then fall back to the generated JSON. */
    try{
      const api=window.NeuralCriticContentAPI;
      if(api?.publishedArticle){
        const live=await api.publishedArticle(slug);
        if(live)return live;
      }
    }catch(_){}

    try{
      const response=await fetch(`data/articles/${encodeURIComponent(slug)}.json`);
      return response.ok?await response.json():null;
    }catch(_){return null}
  }

  function waitForBody(){
    return new Promise(resolve=>{
      const ready=$('#article .article-body');
      if(ready)return resolve(ready);
      const host=$('#article');
      if(!host)return resolve(null);
      const observer=new MutationObserver(()=>{
        const body=$('.article-body',host);
        if(body){observer.disconnect();resolve(body)}
      });
      observer.observe(host,{childList:true,subtree:true});
      setTimeout(()=>{observer.disconnect();resolve($('#article .article-body'))},5000);
    });
  }

  function styledSections(body){
    return $$(':scope > section:not(.review-box):not(.review-details):not(.article-conclusion)',body)
      .filter(section=>section.querySelector(':scope > h2'));
  }

  function applyPublicationSystem(body){
    const host=body.closest('#article');
    if(!host)return;
    host.classList.add('nc-type-system');
    body.classList.add('nc-body');
    $(':scope > h1',host)?.classList.add('nc-display');
    $(':scope > .work-gradient-title',host)?.classList.add('nc-display');
    $(':scope > .article-deck',host)?.classList.add('nc-deck');
    $$('.work-breadcrumb,:scope > .article-kicker,.quick-read>span,.work-side-card>span',host)
      .forEach(node=>node.classList.add('nc-utility'));
  }

  function applyHeadingStyles(article,body){
    const sections=styledSections(body);
    (article.contentBlocks||[]).forEach((block,index)=>{
      const section=sections[index];
      if(!section)return;
      const style=['editorial','display','accent','statement'].includes(block.headingStyle)?block.headingStyle:'editorial';
      section.dataset.headingStyle=style;
      section.classList.remove('nc-heading-editorial','nc-heading-display','nc-heading-accent','nc-heading-statement');
      section.classList.add(`nc-heading-${style}`);
      const heading=section.querySelector(':scope > h2');
      heading?.classList.add('nc-editorial-heading','nc-section');
    });
  }

  /* app.js safely escapes prose before inserting the only supported inline
     tags (<strong>/<em>). Process highlight/accent tokens at the element HTML
     level so combinations such as ==**important**== remain nested correctly
     instead of leaving literal == markers around a <strong> node. */
  function replaceTokens(root){
    const html=root.innerHTML||'';
    if(!html.includes('==')&&!html.includes('^^'))return;
    const next=html
      .replace(/==([\s\S]+?)==/g,'<mark class="nc-text-highlight">$1</mark>')
      .replace(/\^\^([\s\S]+?)\^\^/g,'<span class="nc-text-accent">$1</span>');
    if(next!==html)root.innerHTML=next;
  }

  function applyInlineFormatting(body){
    $$('p,li,blockquote',body).forEach(replaceTokens);
  }

  async function init(){
    const [article,body]=await Promise.all([loadArticle(),waitForBody()]);
    if(!article||!body)return;
    applyPublicationSystem(body);
    applyHeadingStyles(article,body);
    applyInlineFormatting(body);
  }

  init();
})();
