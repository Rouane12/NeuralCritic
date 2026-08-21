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

  function presentation(article){
    const count = Math.max(1, (article.contentBlocks || []).length);
    if (article.collection === 'all-time-greats') {
      return {start:`#${count}`,end:'#1',conclusion:'A canon should stay open'};
    }
    if (article.collection === 'best-games') {
      return {start:`#${count}`,end:'#1',conclusion:'What belongs on your list?'};
    }
    if (article.collection === 'game-of-the-year') {
      return {start:'FINALISTS',end:'WINNER',conclusion:'The final word on the year'};
    }
    if (article.collection === 'upcoming-games') {
      return {start:'WATCHLIST',end:'TOP PICK',conclusion:'What we’re watching next'};
    }
    const difficulty = /difficulty|easiest|hardest/i.test(`${article.title || ''} ${article.slug || ''}`);
    return difficulty
      ? {start:'EASIEST',end:'HARDEST',conclusion:'Difficulty is personal'}
      : {start:`#${count}`,end:'#1',conclusion:'The final word'};
  }

  async function init(){
    const article = await articleData();
    if (!article || article.articleFormat !== 'ranked-list') return;
    const host = qs('#article');
    if (!host) return;
    host.classList.add('ranked-list-page');

    const cards = await waitForRankedCards();
    if (!cards.length) return;

    const ui = presentation(article);
    const first = cards[0];
    let scale = qs('.ranked-scale', first.parentElement);
    if (!scale) {
      first.insertAdjacentHTML('beforebegin',`<div class="ranked-scale"><span>${ui.start}</span><span>${ui.end}</span></div>`);
      scale = qs('.ranked-scale', first.parentElement);
    } else {
      const labels = qsa('span', scale);
      if (labels[0]) labels[0].textContent = ui.start;
      if (labels[1]) labels[1].textContent = ui.end;
    }

    cards.forEach((card,index) => {
      const block = (article.contentBlocks || [])[index] || {};
      if (block.rank) card.dataset.rank = block.rank;
      card.dataset.entry = block.heading || '';
    });

    const conclusionHeading = qs('.article-conclusion h2', host);
    if (conclusionHeading) conclusionHeading.textContent = ui.conclusion;
  }

  init();
})();
