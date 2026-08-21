(() => {
  const esc = (value='') => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  async function loadArticle() {
    const slug = new URLSearchParams(location.search).get('slug');
    if (!slug) return null;
    try {
      const response = await fetch(`data/articles/${encodeURIComponent(slug)}.json`);
      if (!response.ok) return null;
      return await response.json();
    } catch (_) {
      return null;
    }
  }

  function waitForHost() {
    return new Promise(resolve => {
      const immediate = document.querySelector('#article.work-article-page');
      if (immediate?.querySelector('.article-body')) return resolve(immediate);
      const root = document.getElementById('article');
      if (!root) return resolve(null);
      const observer = new MutationObserver(() => {
        if (root.classList.contains('work-article-page') && root.querySelector('.article-body')) {
          observer.disconnect();
          resolve(root);
        }
      });
      observer.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
      setTimeout(() => { observer.disconnect(); resolve(root.classList.contains('work-article-page') ? root : null); },5000);
    });
  }

  function detail(label, value) {
    return value ? `<div class="review-parity-detail"><small>${esc(label)}</small><strong>${esc(value)}</strong></div>` : '';
  }

  async function init() {
    const [article, host] = await Promise.all([loadArticle(), waitForHost()]);
    if (!article || !host || article.articleFormat !== 'review' || !article.reviewMeta) return;
    if (host.querySelector('.review-parity-card')) return;

    host.classList.add('work-review-page');
    const m = article.reviewMeta;
    const pros = (m.pros || []).map(item => `<li>${esc(item)}</li>`).join('');
    const cons = (m.cons || []).map(item => `<li>${esc(item)}</li>`).join('');

    const panel = document.createElement('section');
    panel.className = 'review-parity-card';
    panel.setAttribute('aria-label','Neural Critic review verdict');
    panel.innerHTML = `
      <div class="review-parity-score">
        <strong>${esc(m.score || '—')}</strong>
        <span>OUT OF 10</span>
      </div>
      <div class="review-parity-main">
        <span class="review-parity-eyebrow">NEURAL CRITIC VERDICT</span>
        <h2>${esc(m.verdict || article.description || '')}</h2>
        <div class="review-parity-details">
          ${detail('TESTED ON',m.testedPlatform)}
          ${detail('DEVELOPER',m.developer)}
          ${detail('PUBLISHER',m.publisher)}
          ${detail('RELEASE',m.releaseDate)}
        </div>
        <div class="review-parity-proscons">
          <section class="review-parity-pros">
            <span>PROS</span>
            <ul>${pros}</ul>
          </section>
          <section class="review-parity-cons">
            <span>CONS</span>
            <ul>${cons}</ul>
          </section>
        </div>
      </div>
      ${m.reviewCopy ? `<p class="review-parity-disclosure"><b>DISCLOSURE</b> · ${esc(m.reviewCopy)}</p>` : ''}`;

    const breadcrumb = host.querySelector(':scope > .work-breadcrumb');
    host.insertBefore(panel, breadcrumb || host.firstChild);
  }

  init();
})();
