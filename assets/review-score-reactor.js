(() => {
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  function waitForScore(limit=70){
    return new Promise(resolve => {
      let tries=0;
      const tick=()=>{
        const score=document.querySelector('#article.work-review-page .review-parity-score');
        if(score) return resolve(score);
        if(++tries>=limit) return resolve(null);
        setTimeout(tick,100);
      };
      tick();
    });
  }

  function parseScore(raw){
    const normalized=String(raw||'').replace(',','.').match(/\d+(?:\.\d+)?/);
    if(!normalized) return null;
    const value=Math.max(0,Math.min(10,Number(normalized[0])));
    if(!Number.isFinite(value)) return null;
    return {value,decimals:normalized[0].includes('.') ? normalized[0].split('.')[1].length : 0};
  }

  function easeOutCubic(t){return 1-Math.pow(1-t,3);}

  function finalLabel(score){
    if(score>=9.5) return 'MASTERPIECE';
    if(score>=9) return 'EXCEPTIONAL';
    if(score>=8) return 'GREAT';
    if(score>=7) return 'GOOD';
    if(score>=6) return 'SOLID';
    if(score>=5) return 'MIXED';
    return 'NOT RECOMMENDED';
  }

  function decorate(host,parsed){
    if(host.dataset.scoreReactorReady) return;
    host.dataset.scoreReactorReady='1';
    const original=host.querySelector(':scope > strong');
    const label=host.querySelector(':scope > span');
    if(!original) return;

    const reactor=document.createElement('div');
    reactor.className='review-score-reactor';
    reactor.setAttribute('role','img');
    reactor.setAttribute('aria-label',`Neural Critic score ${parsed.value} out of 10`);
    reactor.innerHTML=`<span class="review-score-orbit" aria-hidden="true"></span><strong class="review-score-value">0</strong><small class="review-score-denominator">/ 10</small>`;
    original.replaceWith(reactor);
    if(label){
      label.classList.add('review-score-label');
      label.textContent='NEURAL SCORE';
    }
    const verdict=document.createElement('small');
    verdict.className='review-score-verdict';
    verdict.textContent=finalLabel(parsed.value);
    verdict.style.cssText='color:#55e7ff;font-size:8px;font-weight:950;letter-spacing:.14em;opacity:0;transform:translateY(4px);transition:opacity .3s ease .18s,transform .3s ease .18s';
    host.appendChild(verdict);
    host._scoreVerdict=verdict;
  }

  function finish(host,parsed){
    const value=host.querySelector('.review-score-value');
    const reactor=host.querySelector('.review-score-reactor');
    if(!value||!reactor) return;
    value.textContent=parsed.value.toFixed(parsed.decimals);
    reactor.style.setProperty('--score-progress',`${parsed.value/10*360}deg`);
    host.classList.remove('is-animating');
    host.classList.add('is-complete');
    if(host._scoreVerdict){host._scoreVerdict.style.opacity='1';host._scoreVerdict.style.transform='none';}
  }

  function animate(host,parsed){
    if(host.dataset.scorePlayed) return;
    host.dataset.scorePlayed='1';
    const value=host.querySelector('.review-score-value');
    const reactor=host.querySelector('.review-score-reactor');
    if(!value||!reactor) return;
    if(reduceMotion){finish(host,parsed);return;}

    host.classList.add('is-animating');
    const duration=1450;
    let start=null;
    const frame=timestamp=>{
      if(start===null) start=timestamp;
      const progress=Math.min(1,(timestamp-start)/duration);
      const eased=easeOutCubic(progress);
      const current=parsed.value*eased;
      value.textContent=current.toFixed(parsed.decimals);
      reactor.style.setProperty('--score-progress',`${current/10*360}deg`);
      if(progress<1) requestAnimationFrame(frame);
      else finish(host,parsed);
    };
    requestAnimationFrame(frame);
  }

  async function init(){
    const host=await waitForScore();
    if(!host) return;
    const original=host.querySelector(':scope > strong')?.textContent || host.dataset.score || '';
    const parsed=parseScore(original);
    if(!parsed) return;
    host.dataset.score=String(parsed.value);
    decorate(host,parsed);

    if(reduceMotion || !('IntersectionObserver' in window)){
      finish(host,parsed);
      return;
    }

    const observer=new IntersectionObserver(entries=>{
      for(const entry of entries){
        if(!entry.isIntersecting) continue;
        observer.disconnect();
        window.setTimeout(()=>animate(host,parsed),120);
        break;
      }
    },{threshold:.42,rootMargin:'0px 0px -5% 0px'});
    observer.observe(host);
  }

  if(document.readyState==='complete') init();
  else window.addEventListener('load',init,{once:true});
})();
