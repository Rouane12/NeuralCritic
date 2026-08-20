(() => {
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const applyReveal = () => {
    const targets = [
      ...document.querySelectorAll('.hero > *, .story, .trending, .newsletter, .reviews-intro, .review-showcase, .category-card, .article-page > *, .article-body > section, footer .footer > div')
    ];
    targets.forEach((el, index) => {
      if (el.dataset.ncMotion) return;
      el.dataset.ncMotion = '1';
      el.classList.add('nc-reveal');
      el.style.setProperty('--nc-delay', `${Math.min(index % 6, 5) * 55}ms`);
    });

    if (reduce || !('IntersectionObserver' in window)) {
      targets.forEach(el => el.classList.add('nc-visible'));
      return;
    }

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('nc-visible');
        observer.unobserve(entry.target);
      });
    }, {threshold: .09, rootMargin: '0px 0px -6% 0px'});
    targets.forEach(el => observer.observe(el));
  };

  const observeDynamicContent = () => {
    const roots = ['hero','story-feed','trending','review-showcase','article','category-grid','quick-results','search-page-results']
      .map(id => document.getElementById(id)).filter(Boolean);
    if (!roots.length) return;
    const mo = new MutationObserver(() => requestAnimationFrame(applyReveal));
    roots.forEach(root => mo.observe(root, {childList:true, subtree:true}));
  };

  const enhanceTheme = () => {
    document.addEventListener('click', event => {
      if (!event.target.closest('.theme-toggle')) return;
      document.documentElement.classList.add('theme-transition');
      window.setTimeout(() => document.documentElement.classList.remove('theme-transition'), 420);
    });
  };

  const heroGlow = () => {
    if (reduce) return;
    document.querySelectorAll('.lead, .feature-link article, .review-showcase').forEach(card => {
      card.addEventListener('pointermove', event => {
        const rect = card.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width - .5) * 2;
        const y = ((event.clientY - rect.top) / rect.height - .5) * 2;
        card.style.setProperty('--nc-x', `${50 + x * 8}%`);
        card.style.setProperty('--nc-y', `${50 + y * 8}%`);
      });
    });
  };

  const init = () => {
    applyReveal();
    observeDynamicContent();
    enhanceTheme();
    heroGlow();
    window.setTimeout(() => { applyReveal(); heroGlow(); }, 450);
  };

  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init, {once:true}) : init();
})();
