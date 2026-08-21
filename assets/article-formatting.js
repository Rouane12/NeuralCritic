(() => {
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];

  async function loadArticle(){
    const slug=new URLSearchParams(location.search).get('slug');
    if(!slug)return null;
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

  function applyHeadingStyles(article,body){
    const sections=styledSections(body);
    (article.contentBlocks||[]).forEach((block,index)=>{
      const section=sections[index];
      if(!section)return;
      const style=['editorial','display','accent','statement'].includes(block.headingStyle)?block.headingStyle:'editorial';
      section.dataset.headingStyle=style;
      section.classList.add(`nc-heading-${style}`);
      const heading=section.querySelector(':scope > h2');
      heading?.classList.add('nc-editorial-heading');
    });
  }

  function replaceTokens(root){
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    const nodes=[];
    while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(node=>{
      const text=node.nodeValue||'';
      if(!text.includes('==')&&!text.includes('^^'))return;
      const regex=/(==(.+?)==|\^\^(.+?)\^\^)/g;
      let match,last=0,changed=false;
      const fragment=document.createDocumentFragment();
      while((match=regex.exec(text))){
        changed=true;
        if(match.index>last)fragment.append(document.createTextNode(text.slice(last,match.index)));
        if(match[2]!==undefined){
          const mark=document.createElement('mark');
          mark.className='nc-text-highlight';
          mark.textContent=match[2];
          fragment.append(mark);
        }else{
          const span=document.createElement('span');
          span.className='nc-text-accent';
          span.textContent=match[3];
          fragment.append(span);
        }
        last=regex.lastIndex;
      }
      if(!changed)return;
      if(last<text.length)fragment.append(document.createTextNode(text.slice(last)));
      node.parentNode?.replaceChild(fragment,node);
    });
  }

  function applyInlineFormatting(body){
    $$('p,li,blockquote',body).forEach(replaceTokens);
  }

  async function init(){
    const [article,body]=await Promise.all([loadArticle(),waitForBody()]);
    if(!article||!body)return;
    applyHeadingStyles(article,body);
    applyInlineFormatting(body);
  }

  init();
})();
