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
