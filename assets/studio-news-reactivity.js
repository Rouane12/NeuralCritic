(() => {
  'use strict';

  const $ = (s, root = document) => root.querySelector(s);
  let lastCategory = '';
  let lastNewsState = null;
  let attentionTimer = null;

  function categoryValue() {
    return String($('#category')?.value || '').trim().toUpperCase();
  }

  function applyNewsState({ attention = false, scroll = false } = {}) {
    const panel = $('#studio-news-panel');
    if (!panel) return;

    const isNews = categoryValue() === 'NEWS';
    panel.hidden = !isNews;
    document.body.classList.toggle('studio-editing-news', isNews);

    const cue = $('#studio-news-cue');
    if (cue) cue.hidden = !isNews;

    if (isNews && attention) {
      panel.classList.remove('studio-news-attention');
      requestAnimationFrame(() => panel.classList.add('studio-news-attention'));
      clearTimeout(attentionTimer);
      attentionTimer = setTimeout(() => panel.classList.remove('studio-news-attention'), 950);
    }

    if (isNews && scroll) {
      requestAnimationFrame(() => {
        panel.scrollIntoView({
          behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
          block: 'start'
        });
      });
    }

    if (lastNewsState !== isNews) {
      window.dispatchEvent(new CustomEvent('neuralcritic:studio-news-state', {
        detail: { active: isNews, category: categoryValue() }
      }));
      lastNewsState = isNews;
    }
  }

  function publicationDeskSelect(target) {
    if (!(target instanceof HTMLSelectElement)) return false;
    const label = target.closest('label');
    if (!label) return false;
    return /EDITORIAL\s+DESK/i.test(label.textContent || '');
  }

  function syncDeskToCategory(target) {
    if (!publicationDeskSelect(target)) return false;
    const value = String(target.value || '').trim().toUpperCase();
    const category = $('#category');
    if (!category || !['NEWS', 'FEATURE', 'GUIDE', 'REVIEW'].includes(value)) return false;
    if (category.value !== value) category.value = value;
    return true;
  }

  function handleControlEvent(event) {
    const target = event.target;
    if (!target) return;

    const categoryChanged = target.matches?.('#category');
    const deskChanged = syncDeskToCategory(target);
    if (!categoryChanged && !deskChanged) return;

    const current = categoryValue();
    const enteringNews = current === 'NEWS' && lastCategory !== 'NEWS';
    lastCategory = current;

    // A deliberate editor selection of NEWS should immediately surface the
    // Trust Layer instead of requiring the editor to discover a panel below.
    applyNewsState({ attention: enteringNews, scroll: enteringNews && event.isTrusted });

    if (deskChanged && !categoryChanged) {
      $('#category')?.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  function monitorProgrammaticChanges() {
    lastCategory = categoryValue();
    applyNewsState();

    // Studio modules load asynchronously and several of them set select.value
    // directly. Polling one tiny string prevents those programmatic changes
    // from leaving the Trust Layer stale without introducing DOM churn.
    setInterval(() => {
      const current = categoryValue();
      if (current === lastCategory) return;
      const enteringNews = current === 'NEWS' && lastCategory !== 'NEWS';
      lastCategory = current;
      applyNewsState({ attention: enteringNews, scroll: false });
    }, 180);

    const host = $('#article-form') || document.body;
    const observer = new MutationObserver(() => applyNewsState());
    observer.observe(host, { childList: true, subtree: true });
  }

  function init() {
    document.addEventListener('change', handleControlEvent, true);
    document.addEventListener('input', handleControlEvent, true);
    monitorProgrammaticChanges();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
