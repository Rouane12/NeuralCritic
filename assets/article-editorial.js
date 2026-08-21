(() => {
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];

  function normalizeSoftBreaks(root) {
    $$('.article-body p', root).forEach(p => {
      p.querySelectorAll('br').forEach(br => br.replaceWith(document.createTextNode(' ')));
    });
  }

  function removeDuplicateModules(root) {
    $$('.work-article-sidebar .work-weekly-card', root).forEach(node => node.remove());
    $$('.work-bottom-sidebar .work-weekly-card', root).forEach(node => node.remove());
    $$('.work-bottom-sidebar .work-follow-card', root).forEach(node => node.remove());

    const bottom = $('.work-bottom-sidebar', root);
    if (bottom && !bottom.querySelector('.work-side-card')) bottom.remove();
  }

  function labelEditorialLists(root) {
    $$('.article-body ul,.article-body ol', root).forEach(list => list.classList.add('editorial-list'));
  }

  function polish() {
    const article = $('#article.work-article-page');
    if (!article) return false;
    normalizeSoftBreaks(article);
    removeDuplicateModules(article);
    labelEditorialLists(article);
    article.dataset.editorialPolished = '1';
    return true;
  }

  function init() {
    if (polish()) return;
    const host = $('#article');
    if (!host) return;
    const observer = new MutationObserver(() => {
      if (polish()) observer.disconnect();
    });
    observer.observe(host, {childList:true, subtree:true});
    setTimeout(() => { polish(); observer.disconnect(); }, 7000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
