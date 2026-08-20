(() => {
  const esc = (value = '') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

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

  function waitForRenderedArticle() {
    return new Promise(resolve => {
      const host = document.querySelector('#article.work-article-page');
      if (host?.querySelector('h1')) return resolve(host);
      const root = document.querySelector('#article');
      if (!root) return resolve(null);
      const observer = new MutationObserver(() => {
        if (root.classList.contains('work-article-page') && root.querySelector('h1')) {
          observer.disconnect();
          resolve(root);
        }
      });
      observer.observe(root, {childList:true, subtree:true, attributes:true, attributeFilter:['class']});
      setTimeout(() => { observer.disconnect(); resolve(root.classList.contains('work-article-page') ? root : null); }, 5000);
    });
  }

  async function init() {
    const [article, host] = await Promise.all([loadArticle(), waitForRenderedArticle()]);
    if (!article || !host) return;

    const title = host.querySelector(':scope > h1');
    if (title) title.classList.add('work-gradient-title');

    if (!host.querySelector('.work-breadcrumb')) {
      const category = article.category || 'Story';
      const crumb = document.createElement('nav');
      crumb.className = 'work-breadcrumb';
      crumb.setAttribute('aria-label', 'Breadcrumb');
      crumb.innerHTML = `<a href="index.html">HOME</a><i>/</i><a href="category.html?category=${encodeURIComponent(category.toLowerCase())}">${esc(category)}</a><i>/</i><strong>${esc(article.title)}</strong>`;
      const kicker = host.querySelector(':scope > .article-kicker');
      host.insertBefore(crumb, kicker || host.firstChild);
    }
  }

  init();
})();
