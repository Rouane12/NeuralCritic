(() => {
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];

  function waitForToc(){
    return new Promise(resolve=>{
      const ready=$('#article .work-toc nav');
      if(ready)return resolve(ready);
      const host=$('#article');
      if(!host)return resolve(null);
      const observer=new MutationObserver(()=>{
        const nav=$('.work-toc nav',host);
        if(nav){observer.disconnect();resolve(nav)}
      });
      observer.observe(host,{childList:true,subtree:true});
      setTimeout(()=>{observer.disconnect();resolve($('#article .work-toc nav'))},5000);
    });
  }

  function installRankedMapStyle(){
    if($('#nc-ranked-reading-map-style'))return;
    const style=document.createElement('style');
    style.id='nc-ranked-reading-map-style';
    style.textContent=`
      #article.work-article-page .work-toc nav.ranked-toc a{counter-increment:none!important}
      #article.work-article-page .work-toc nav.ranked-toc a::before{
        content:attr(data-rank-label)!important;
        letter-spacing:0!important;
        white-space:nowrap;
      }
      #article.work-article-page .work-toc nav.ranked-toc a.toc-conclusion::before{
        color:#9b7cff!important;
        font-size:7px!important;
        font-weight:900!important;
        letter-spacing:.06em!important;
      }
    `;
    document.head.appendChild(style);
  }

  function syncRankedMap(nav,links,sections){
    const ranked=sections.some(section=>section.classList.contains('ranked-card')||$('.rank-number',section));
    if(!ranked)return;

    nav.classList.add('ranked-toc');
    installRankedMapStyle();

    links.forEach((link,index)=>{
      const section=sections[index];
      if(!section)return;

      const heading=$('h2',section);
      const headingText=heading?.textContent?.trim();
      if(headingText&&link.textContent.trim()!==headingText)link.textContent=headingText;

      const rank=$('.rank-number',section)?.textContent?.trim();
      if(rank){
        link.dataset.rankLabel=`#${rank.replace(/^#/,'')}`;
        link.classList.remove('toc-conclusion');
        return;
      }

      if(section.classList.contains('article-conclusion')){
        link.dataset.rankLabel='END';
        link.classList.add('toc-conclusion');
        return;
      }

      link.dataset.rankLabel='';
      link.classList.remove('toc-conclusion');
    });
  }

  async function init(){
    const nav=await waitForToc();
    if(!nav)return;
    const card=nav.closest('.work-toc');
    const body=$('#article .article-body');
    const links=$$('a[href^="#"]',nav);
    const sections=links.map(link=>{
      try{return document.getElementById(decodeURIComponent(link.hash.slice(1)))}catch(_){return null}
    }).filter(Boolean);
    if(!card||!body||!links.length)return;

    const syncMap=()=>syncRankedMap(nav,links,sections);
    syncMap();

    // Ranked presentation can rename the final heading after the Reading Map
    // has already been built. Keep the map synchronized with the live article.
    const headingObserver=new MutationObserver(syncMap);
    headingObserver.observe(body,{childList:true,subtree:true,characterData:true});
    window.addEventListener('neuralcritic:game-graph-ready',syncMap,{once:true});
    setTimeout(syncMap,250);
    setTimeout(syncMap,1000);
    setTimeout(()=>headingObserver.disconnect(),10000);

    if(!$('.work-toc-progress',card)){
      nav.insertAdjacentHTML('beforebegin','<div class="work-toc-progress"><span></span></div>');
    }
    const bar=$('.work-toc-progress span',card);

    const activate=id=>{
      links.forEach(link=>link.classList.toggle('active',decodeURIComponent(link.hash.slice(1))===id));
    };

    if('IntersectionObserver' in window&&sections.length){
      const observer=new IntersectionObserver(entries=>{
        const visible=entries.filter(entry=>entry.isIntersecting).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top);
        if(visible[0])activate(visible[0].target.id);
      },{rootMargin:'-18% 0px -64% 0px',threshold:0});
      sections.forEach(section=>observer.observe(section));
    }

    let ticking=false;
    const updateProgress=()=>{
      ticking=false;
      const rect=body.getBoundingClientRect();
      const start=window.scrollY+rect.top-window.innerHeight*.22;
      const end=start+Math.max(1,body.scrollHeight-window.innerHeight*.56);
      const progress=Math.max(0,Math.min(1,(window.scrollY-start)/(end-start)));
      if(bar)bar.style.transform=`scaleX(${progress})`;
    };
    window.addEventListener('scroll',()=>{if(!ticking){ticking=true;requestAnimationFrame(updateProgress)}},{passive:true});
    window.addEventListener('resize',updateProgress,{passive:true});
    updateProgress();
  }

  init();
})();
