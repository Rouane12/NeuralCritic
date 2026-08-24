(() => {
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const reduceMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

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
      #article.ranked-list-page .work-toc{padding-bottom:13px!important}
      #article.ranked-list-page .work-toc nav a{min-height:48px!important;padding:10px 0!important}
      #article.ranked-list-page .ranked-card figure{margin-top:32px!important}
      #article.ranked-list-page .ranked-card figcaption{
        padding-top:14px!important;
        padding-bottom:18px!important;
        line-height:1.45!important;
      }
    `;
    document.head.appendChild(style);
  }

  function rankForSection(section){
    const direct=section?.dataset?.rank?.trim();
    if(direct)return direct.replace(/^#/,'');
    const visible=$('.rank-number',section)?.textContent?.trim();
    return visible ? visible.replace(/^#/,'') : '';
  }

  function syncRankedMap(nav,links,sections){
    const host=$('#article');
    const ranked=host?.classList.contains('ranked-list-page')||sections.some(section=>section.classList.contains('ranked-card')||$('.rank-number',section)||section.dataset.rank);
    if(!ranked)return false;

    nav.classList.add('ranked-toc');
    installRankedMapStyle();

    links.forEach((link,index)=>{
      const section=sections[index];
      if(!section)return;

      const heading=$('h2',section);
      const headingText=heading?.textContent?.trim();
      if(headingText&&link.textContent.trim()!==headingText)link.textContent=headingText;

      const rank=rankForSection(section);
      if(rank){
        link.dataset.rankLabel=`#${rank}`;
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
    return true;
  }

  function bindTocNavigation(nav,links,activate){
    nav.addEventListener('click',event=>{
      const link=event.target.closest('a[href^="#"]');
      if(!link||!nav.contains(link))return;

      let id='';
      try{id=decodeURIComponent(link.hash.slice(1))}catch(_){id=link.hash.slice(1)}
      const target=id?document.getElementById(id):null;
      if(!target)return;

      event.preventDefault();
      event.stopPropagation();

      target.scrollIntoView({behavior:reduceMotion?'auto':'smooth',block:'start',inline:'nearest'});
      activate?.(id);

      const next=`${location.pathname}${location.search}#${encodeURIComponent(id)}`;
      try{history.replaceState(history.state,'',next)}catch(_){}
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

    // Ranked presentation can finish after the Reading Map is built. Keep the
    // labels synchronized with live rank data instead of section position.
    const headingObserver=new MutationObserver(syncMap);
    headingObserver.observe(body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class','data-rank']});
    window.addEventListener('neuralcritic:game-graph-ready',syncMap,{once:true});
    [120,350,800,1600,2600].forEach(delay=>setTimeout(syncMap,delay));
    setTimeout(()=>headingObserver.disconnect(),12000);

    if(!$('.work-toc-progress',card)){
      nav.insertAdjacentHTML('beforebegin','<div class="work-toc-progress"><span></span></div>');
    }
    const bar=$('.work-toc-progress span',card);

    const activate=id=>{
      links.forEach(link=>{
        let linkId='';
        try{linkId=decodeURIComponent(link.hash.slice(1))}catch(_){linkId=link.hash.slice(1)}
        link.classList.toggle('active',linkId===id);
      });
    };

    bindTocNavigation(nav,links,activate);

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

  function loadAuthorSystem(){
    if(document.querySelector('script[data-nc-author-system]'))return;
    const script=document.createElement('script');
    script.src='assets/author-system.js?v=20260823-author1';
    script.async=true;
    script.dataset.ncAuthorSystem='1';
    document.head.appendChild(script);
  }

  loadAuthorSystem();
  init();
})();
