(() => {
  const qs=(s,r=document)=>r.querySelector(s);
  const qsa=(s,r=document)=>[...r.querySelectorAll(s)];
  let items=[];
  let index=0;
  let opener=null;

  function captionFor(img){
    const fig=img.closest('figure');
    const cap=fig?.querySelector('figcaption');
    return (cap?.textContent || img.alt || '').trim();
  }

  function collect(){
    const selectors=[
      '#article .work-hero-figure img',
      '#article .article-body figure img',
      '#article .ranked-card figure img',
      '#article > img.article-hero'
    ].join(',');
    const seen=new Set();
    items=qsa(selectors).filter(img=>{
      if(!img.src || seen.has(img.src)) return false;
      seen.add(img.src);
      img.dataset.imageViewer='true';
      img.tabIndex=0;
      img.setAttribute('role','button');
      img.setAttribute('aria-label',`${img.alt || 'Article image'} — open fullscreen`);
      return true;
    });
  }

  function ensureViewer(){
    let viewer=qs('#image-viewer');
    if(viewer) return viewer;
    document.body.insertAdjacentHTML('beforeend',`
      <div class="image-viewer" id="image-viewer" aria-hidden="true" role="dialog" aria-modal="true" aria-label="Image viewer">
        <div class="image-viewer-top">
          <span class="image-viewer-count"></span>
          <button class="image-viewer-close" type="button" aria-label="Close image viewer">✕ CLOSE</button>
        </div>
        <div class="image-viewer-stage">
          <button class="image-viewer-nav image-viewer-prev" type="button" aria-label="Previous image">‹</button>
          <img class="image-viewer-image" alt="">
          <button class="image-viewer-nav image-viewer-next" type="button" aria-label="Next image">›</button>
        </div>
        <div class="image-viewer-footer"><div class="image-viewer-caption"></div></div>
      </div>`);
    viewer=qs('#image-viewer');
    qs('.image-viewer-close',viewer).addEventListener('click',close);
    qs('.image-viewer-prev',viewer).addEventListener('click',()=>step(-1));
    qs('.image-viewer-next',viewer).addEventListener('click',()=>step(1));
    viewer.addEventListener('click',e=>{if(e.target===viewer || e.target.classList.contains('image-viewer-stage')) close();});
    return viewer;
  }

  function render(){
    collect();
    if(!items.length) return;
    index=(index+items.length)%items.length;
    const item=items[index];
    const viewer=ensureViewer();
    const image=qs('.image-viewer-image',viewer);
    image.src=item.currentSrc || item.src;
    image.alt=item.alt || 'Article image';
    qs('.image-viewer-caption',viewer).textContent=captionFor(item);
    qs('.image-viewer-count',viewer).textContent=`${index+1} / ${items.length}`;
    const single=items.length<2;
    qs('.image-viewer-prev',viewer).hidden=single;
    qs('.image-viewer-next',viewer).hidden=single;
    if(!single){
      const prev=items[(index-1+items.length)%items.length];
      const next=items[(index+1)%items.length];
      [prev,next].forEach(img=>{const preload=new Image();preload.src=img.currentSrc||img.src;});
    }
  }

  function open(img){
    collect();
    const found=items.indexOf(img);
    if(found<0) return;
    opener=img;
    index=found;
    const viewer=ensureViewer();
    render();
    viewer.classList.add('open');
    viewer.setAttribute('aria-hidden','false');
    document.body.classList.add('image-viewer-lock');
    qs('.image-viewer-close',viewer).focus({preventScroll:true});
  }

  function close(){
    const viewer=qs('#image-viewer');
    if(!viewer?.classList.contains('open')) return;
    const returnTarget=opener;
    opener=null;
    viewer.classList.remove('open');
    viewer.setAttribute('aria-hidden','true');
    document.body.classList.remove('image-viewer-lock');
    if(returnTarget?.isConnected) returnTarget.focus({preventScroll:true});
  }

  function step(delta){index+=delta;render();}

  document.addEventListener('click',e=>{
    const img=e.target.closest('#article img[data-image-viewer]');
    if(img){e.preventDefault();open(img);}
  });
  document.addEventListener('keydown',e=>{
    const viewer=qs('#image-viewer');
    if(viewer?.classList.contains('open')){
      if(e.key==='Escape') close();
      if(e.key==='ArrowLeft') step(-1);
      if(e.key==='ArrowRight') step(1);
      return;
    }
    if((e.key==='Enter'||e.key===' ') && e.target.matches('#article img[data-image-viewer]')){
      e.preventDefault();open(e.target);
    }
  });

  const host=qs('#article');
  if(host){
    const observer=new MutationObserver(collect);
    observer.observe(host,{childList:true,subtree:true});
  }
  collect();
})();
