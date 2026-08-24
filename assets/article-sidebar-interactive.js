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

  function linkId(link){
    const raw=link?.getAttribute?.('href')||link?.hash||'';
    try{return decodeURIComponent(raw.replace(/^#/,''))}catch(_){return raw.replace(/^#/,'')}
  }

  function syncRankedMap(nav){
    const links=$$('a[href^="#"]',nav);
    const sections=links.map(link=>document.getElementById(linkId(link))).filter(Boolean);
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

  function hasAuthoritativeController(){
    if(window.NeuralCriticReadingMapController)return true;
    return Boolean(document.querySelector('script[src*="article-runtime-integrity.js"]'));
  }

  // Compatibility path only. Modern article pages are owned by
  // article-runtime-integrity.js; this exists solely for old standalone shells
  // that genuinely do not load the authoritative controller.
  function installLegacyFallback(nav,card,body){
    const activate=id=>{
      $$('a[href^="#"]',nav).forEach(link=>link.classList.toggle('active',linkId(link)===id));
    };

    nav.addEventListener('click',event=>{
      const link=event.target.closest('a[href^="#"]');
      if(!link||!nav.contains(link))return;
      const id=linkId(link);
      const target=id?document.getElementById(id):null;
      if(!target)return;

      event.preventDefault();
      event.stopPropagation();
      const top=window.scrollY+target.getBoundingClientRect().top-86;
      window.scrollTo({top:Math.max(0,top),behavior:reduceMotion?'auto':'smooth'});
      activate(id);
      try{history.replaceState(history.state,'',`${location.pathname}${location.search}#${encodeURIComponent(id)}`)}catch(_){}
    });

    if(!$('.work-toc-progress',card))nav.insertAdjacentHTML('beforebegin','<div class="work-toc-progress"><span></span></div>');
    const bar=$('.work-toc-progress span',card);
    let ticking=false;
    const sync=()=>{
      ticking=false;
      const links=$$('a[href^="#"]',nav);
      const sections=links.map(link=>document.getElementById(linkId(link))).filter(Boolean);
      const probe=Math.max(140,Math.min(360,window.innerHeight*.42));
      let active=sections.find(section=>{
        const rect=section.getBoundingClientRect();
        return rect.top<=probe&&rect.bottom>probe;
      });
      if(!active&&sections.length){
        active=sections.reduce((best,section)=>{
          const distance=Math.abs(section.getBoundingClientRect().top-probe);
          return !best||distance<best.distance?{section,distance}:best;
        },null)?.section;
      }
      if(active)activate(active.id);

      const rect=body.getBoundingClientRect();
      const start=window.scrollY+rect.top-window.innerHeight*.22;
      const end=start+Math.max(1,body.scrollHeight-window.innerHeight*.56);
      const progress=Math.max(0,Math.min(1,(window.scrollY-start)/(end-start)));
      if(bar)bar.style.transform=`scaleX(${progress})`;
    };
    const requestSync=()=>{if(!ticking){ticking=true;requestAnimationFrame(sync)}};
    window.addEventListener('scroll',requestSync,{passive:true});
    window.addEventListener('resize',requestSync,{passive:true});
    sync();
  }

  async function init(){
    const nav=await waitForToc();
    if(!nav)return;
    const card=nav.closest('.work-toc');
    const body=$('#article .article-body');
    if(!card||!body)return;

    const syncMap=()=>{
      syncRankedMap(nav);
      window.NeuralCriticReadingMapController?.sync?.();
    };
    syncMap();

    // Keep presentation labels in sync, but never bind navigation/active-state
    // behavior when the authoritative runtime is part of this article shell.
    const headingObserver=new MutationObserver(syncMap);
    headingObserver.observe(body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class','data-rank']});
    window.addEventListener('neuralcritic:game-graph-ready',syncMap,{once:true});
    window.addEventListener('neuralcritic:article-runtime-ready',syncMap,{once:true});
    [120,350,800,1600,2600].forEach(delay=>setTimeout(syncMap,delay));
    setTimeout(()=>headingObserver.disconnect(),12000);

    if(hasAuthoritativeController()){
      nav.dataset.legacyNavigation='deferred';
      window.NeuralCriticReadingMapController?.sync?.();
      return;
    }

    nav.dataset.legacyNavigation='fallback';
    installLegacyFallback(nav,card,body);
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
