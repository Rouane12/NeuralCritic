(() => {
  const qs = (s,r=document) => r.querySelector(s);
  const qsa = (s,r=document) => [...r.querySelectorAll(s)];

  async function articleData(){
    const slug = new URLSearchParams(location.search).get('slug');
    if (!slug) return null;
    try {
      const r = await fetch(`data/articles/${encodeURIComponent(slug)}.json`);
      return r.ok ? await r.json() : null;
    } catch (_) { return null; }
  }

  function waitForRankedCards(){
    return new Promise(resolve => {
      const ready = qsa('#article .ranked-card');
      if (ready.length) return resolve(ready);
      const host = qs('#article');
      if (!host) return resolve([]);
      const observer = new MutationObserver(() => {
        const cards = qsa('.ranked-card', host);
        if (cards.length) { observer.disconnect(); resolve(cards); }
      });
      observer.observe(host,{childList:true,subtree:true});
      setTimeout(()=>{observer.disconnect();resolve(qsa('.ranked-card',host));},5000);
    });
  }

  async function init(){
    const article = await articleData();
    if (!article || article.articleFormat !== 'ranked-list') return;
    const host = qs('#article');
    if (!host) return;
    host.classList.add('ranked-list-page');

    const cards = await waitForRankedCards();
    if (!cards.length) return;

    const first = cards[0];
    if (!qs('.ranked-scale', first.parentElement)) {
      first.insertAdjacentHTML('beforebegin','<div class="ranked-scale"><span>EASIEST</span><span>HARDEST</span></div>');
    }

    cards.forEach((card,index) => {
      const block = (article.contentBlocks || [])[index] || {};
      if (block.rank) card.dataset.rank = block.rank;
      card.dataset.entry = block.heading || '';
    });
  }

  init();
})();
