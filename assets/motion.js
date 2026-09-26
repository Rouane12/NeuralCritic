(() => {
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const STRUCTURAL = '.work-reading-grid, .work-bottom-grid, .category-work-content, .collection-page';

  function revealImmediately(el) {
    el.classList.remove('nc-reveal');
    el.classList.add('nc-visible');
    el.style.removeProperty('--nc-delay');
    el.dataset.ncMotion = 'structural';
  }

  const applyReveal = () => {
    /* Never animate an entire long-form layout container. A ranked article can
       be many viewports tall, which makes an IntersectionObserver ratio based
       reveal impossible to satisfy and leaves the whole story transparent. */
    document.querySelectorAll(STRUCTURAL).forEach(revealImmediately);

    const targets = [
      ...document.querySelectorAll('.hero > *, .story, .trending, .newsletter, .reviews-intro, .review-showcase, .category-card, .article-page > *:not(.work-reading-grid):not(.work-bottom-grid), .article-body > section, footer .footer > div')
    ];

    const observable = [];
    const intro = [];
    targets.forEach((el, index) => {
      // Reduced-motion readers remain immediate. Touch devices now receive the
      // same reveal choreography as other normal-motion readers; pointer-only
      // effects remain gated separately in heroGlow(). Structural long-form
      // containers always stay visible so an observer can never blank a page.
      if (reduce || el.matches(STRUCTURAL)) {
        revealImmediately(el);
        return;
      }
      if (el.dataset.ncMotion) return;

      const rect = el.getBoundingClientRect();
      el.dataset.ncMotion = '1';
      el.classList.add('nc-reveal');
      el.style.setProperty('--nc-delay', `${Math.min(index % 6, 5) * 55}ms`);

      /* Very tall elements should never depend on an intersection ratio. */
      if (rect.height > Math.max(window.innerHeight * 1.35, 1100)) {
        revealImmediately(el);
        return;
      }

      /* PR102 removed every above-the-fold and article reveal by making those
         targets visible immediately. Restore the original choreography on
         desktop, but promote in-view content on the next paint rather than
         waiting on an observer. This keeps the animation without risking a
         blank first frame. */
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        intro.push(el);
        return;
      }
      observable.push(el);
    });

    if (intro.length) {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        intro.forEach(el => el.classList.add('nc-visible'));
      }));
    }

    if (reduce || !('IntersectionObserver' in window)) {
      observable.forEach(el => el.classList.add('nc-visible'));
      return;
    }

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('nc-visible');
        observer.unobserve(entry.target);
      });
    }, {threshold: .02, rootMargin: '0px 0px -4% 0px'});
    observable.forEach(el => observer.observe(el));
  };

  const observeDynamicContent = () => {
    const roots = ['hero','story-feed','trending','review-showcase','article','category-grid','quick-results','search-page-results']
      .map(id => document.getElementById(id)).filter(Boolean);
    if (!roots.length) return;
    let queued = false;
    const mo = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        applyReveal();
      });
    });
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
    if (reduce || !window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) return;
    document.querySelectorAll('.lead, .feature-link article, .review-showcase').forEach(card => {
      if (card.dataset.ncGlow) return;
      card.dataset.ncGlow = '1';
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
