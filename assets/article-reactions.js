(() => {
  'use strict';

  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const icon=name=>'<span class="material-symbols-rounded" aria-hidden="true">'+name+'</span>';

  function setButton(button,label,glyph){
    if(!button)return;
    const holder=$('b',button);
    const small=$('small',button);
    if(holder&&glyph&&holder.dataset.ncGlyph!==glyph){
      holder.innerHTML=icon(glyph);
      holder.dataset.ncGlyph=glyph;
    }
    if(small&&label&&small.textContent!==label)small.textContent=label;
  }

  function normalizeRail(){
    const rail=$('#article .work-react-rail');
    if(!rail)return false;

    rail.classList.add('standard-react-rail');
    rail.setAttribute('data-reaction-owner','article-reactions-v1');

    $$('[data-article-discuss]',rail).forEach(node=>node.remove());

    setButton($('[data-article-like]',rail),'Like','thumb_up');
    setButton($('[data-article-follow]',rail),
      $('[data-article-follow]',rail)?.classList.contains('community-active')?'Following':'Follow',
      'bookmark');
    setButton($('[data-article-share]',rail),'Share','share');

    const save=$('.nc-save-story',rail);
    if(save){
      const small=$('small',save);
      if(small&&!small.textContent.trim())small.textContent='Save';
    }

    const entity=$('[data-entity-article-follow]',rail);
    if(entity){
      const small=$('small',entity);
      if(small&&!small.textContent.trim())small.textContent='Follow Game';
    }

    return true;
  }

  function removeRetiredSurfaces(){
    $$('#reader-thread,.article-thread,.work-bottom-grid,.work-related-card.nc-related-intelligent').forEach(node=>node.remove());
  }

  function sync(){
    removeRetiredSurfaces();
    normalizeRail();
  }

  function init(){
    sync();
    if(!$('#article'))return;
    [100,350,900,1800,3500,6000,10000].forEach(delay=>setTimeout(sync,delay));
    window.addEventListener('neuralcritic:community-refreshed',sync);
    document.addEventListener('nc:saved-stories-changed',sync);
    document.addEventListener('nc:entity-follows-changed',sync);
    window.dispatchEvent(new CustomEvent('neuralcritic:article-reactions-ready'));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();