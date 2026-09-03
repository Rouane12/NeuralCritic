(() => {
  'use strict';

  const pageName = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  if (pageName !== 'index.html') return;

  const esc = (value='') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtDate = iso => {
    try { return new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(iso)); }
    catch (_) { return ''; }
  };
  const imageOf = article => article?.imageLocal || article?.image_url || '';
  const titleOf = article => article?.title || '';
  const categoryOf = article => article?.category || 'FEATURE';
  const publishedOf = article => article?.publishedAt || article?.published_at || '';
  const slugOf = article => article?.slug || '';
  const slotOf = article => article?.homepageSlot || article?.homepage_slot || 'regular';

  function articleHref(article) {
    return `stories/${encodeURIComponent(slugOf(article))}/`;
  }

  function card(article) {
    const image = imageOf(article);
    const alt = article?.imageAlt || article?.image_alt || titleOf(article);
    return `<a class="feature-link" href="${articleHref(article)}" data-home-story="${esc(slugOf(article))}"><article>${image?`<img alt="${esc(alt)}" src="${esc(image)}">`:'<div class="placeholder-art">NEURAL CRITIC</div>'}<div class="shade"></div><div><label>${esc(categoryOf(article))}</label><h2>${esc(titleOf(article))}</h2><small>${fmtDate(publishedOf(article))} · READ STORY →</small></div></article></a>`;
  }

  async function loadArticles() {
    if (window.NeuralCriticContentAPI?.publishedIndex) {
      const rows = await window.NeuralCriticContentAPI.publishedIndex();
      if (rows?.length) return rows;
    }
    const response = await fetch('data/articles.json');
    if (!response.ok) return [];
    const rows = await response.json();
    return Array.isArray(rows) ? rows : [];
  }

  function waitForHero(ms=6000) {
    return new Promise(resolve => {
      const ready = document.querySelector('#hero .features');
      if (ready) return resolve(ready);
      const hero = document.getElementById('hero');
      if (!hero) return resolve(null);
      const observer = new MutationObserver(() => {
        const features = hero.querySelector('.features');
        if (features) { observer.disconnect(); resolve(features); }
      });
      observer.observe(hero,{childList:true,subtree:true});
      setTimeout(() => { observer.disconnect(); resolve(hero.querySelector('.features')); }, ms);
    });
  }

  async function apply() {
    try {
      const [articles, features] = await Promise.all([loadArticles(), waitForHero()]);
      if (!features || !articles.length) return;
      const top = articles.find(article => slotOf(article) === 'secondary-top');
      const bottom = articles.find(article => slotOf(article) === 'secondary-bottom');
      const selected = [top,bottom].filter(Boolean);
      if (!selected.length) return;
      features.innerHTML = selected.map(card).join('');
      features.dataset.ncCuratedSlots = '1';
      window.dispatchEvent(new CustomEvent('neuralcritic:homepage-slots-applied'));
    } catch (error) {
      console.warn('Neural Critic homepage curation guard skipped.', error);
    }
  }

  if (document.readyState === 'complete') apply();
  else window.addEventListener('load', apply, { once:true });
})();
