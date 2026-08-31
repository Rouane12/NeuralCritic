(() => {
  const hashValue = () => {
    try { return decodeURIComponent(location.hash.replace(/^#/, '')); }
    catch (_) { return location.hash.replace(/^#/, ''); }
  };

  function targetForHash() {
    const id = hashValue();
    if (!id) return null;
    try { return document.getElementById(id); }
    catch (_) { return null; }
  }

  function alignTarget(target, behavior = 'auto') {
    if (!target) return false;
    target.classList.add('article-deep-link-target');
    target.scrollIntoView({ behavior, block: 'start', inline: 'nearest' });
    window.setTimeout(() => target.classList.remove('article-deep-link-target'), 1800);
    return true;
  }

  function restoreDeepLink({ behavior = 'auto', limit = 70 } = {}) {
    if (!location.hash) return;

    let tries = 0;
    const attempt = () => {
      const target = targetForHash();
      if (target) {
        alignTarget(target, behavior);
        window.setTimeout(() => {
          const current = targetForHash();
          if (current) alignTarget(current, 'auto');
        }, 320);
        return;
      }
      if (++tries < limit) window.setTimeout(attempt, 80);
    };
    attempt();
  }

  function loadDevelopingTimeline() {
    if (document.querySelector('script[data-nc-developing-timeline]')) return;
    const script = document.createElement('script');
    script.src = 'assets/developing-story-timeline.js?v=20260831-timeline1';
    script.dataset.ncDevelopingTimeline = '1';
    script.defer = true;
    document.head.appendChild(script);
  }

  window.addEventListener('hashchange', () => restoreDeepLink({ behavior: 'smooth', limit: 30 }));

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      restoreDeepLink();
      loadDevelopingTimeline();
    }, { once: true });
  } else {
    restoreDeepLink();
    loadDevelopingTimeline();
  }
})();
