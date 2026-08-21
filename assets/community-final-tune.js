(() => {
  const $ = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>[...r.querySelectorAll(s)];
  let queued=false;

  function cleanUtilityButtons(root=document){
    $$('.community-comment-edit,.community-comment-delete,.community-comment-report',root).forEach(button=>{
      if(button.dataset.ncLabelClean==='1') return;
      const cls = button.classList;
      const label = cls.contains('community-comment-edit') ? 'Edit' : cls.contains('community-comment-delete') ? 'Delete' : 'Report';
      button.textContent='';
      button.setAttribute('aria-label',label);
      button.title=label;
      button.dataset.ncLabelClean='1';
    });
  }

  function normalizeComposer(){
    const form=$('.standard-thread form[data-thread-form]');
    const ta=$('textarea[name="comment"]',form||document);
    if(!form||!ta)return;
    const sync=()=>form.classList.toggle('has-value',!!ta.value.trim());
    if(ta.dataset.ncComposerTune!=='1'){
      ta.dataset.ncComposerTune='1';
      ta.rows=1;
      ta.addEventListener('input',sync);
      ta.addEventListener('blur',sync);
    }
    sync();
  }

  function tune(){
    cleanUtilityButtons();
    normalizeComposer();
  }
  function queue(){
    if(queued)return;queued=true;
    requestAnimationFrame(()=>{queued=false;tune()});
  }
  function init(){
    tune();
    const observer=new MutationObserver(mutations=>{
      if(mutations.some(m=>[...m.addedNodes].some(n=>n instanceof Element&&(n.matches?.('.community-comment,.standard-thread')||n.querySelector?.('.community-comment,.standard-thread')))))queue();
    });
    observer.observe(document.body,{childList:true,subtree:true});
    window.addEventListener('neuralcritic:thread-recovered',queue);
    setTimeout(queue,300);
    setTimeout(queue,1000);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
