(() => {
  const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];
  const pendingVitals = new Map();
  const interactionDurations = [];
  let lcpValue = 0;
  let clsValue = 0;
  let clsWindowValue = 0;
  let clsWindowStart = 0;
  let clsLastEntry = 0;
  let vitalsFinalized = false;
  let flushTimer = null;

  function installUiRegressionGuards() {
    if (document.getElementById('nc-ui-regression-guards')) return;
    const style = document.createElement('style');
    style.id = 'nc-ui-regression-guards';
    style.textContent = `
      /* Keep homepage review scores such as 9.5 on one line. */
      .review-showcase-score{min-width:84px!important;overflow:visible!important}
      .review-showcase-score b{
        display:block!important;
        width:max-content!important;
        max-width:none!important;
        white-space:nowrap!important;
        word-break:normal!important;
        overflow-wrap:normal!important;
        hyphens:none!important;
      }

      /* The stable Reader Thread owns identity/account UI. Hide the retired
         identity shell, and collapse the composer to one clean sign-in notice
         while the reader is signed out. */
      #reader-thread.standard-thread .thread-identity{display:none!important}
      #reader-thread.standard-thread form[data-thread-form]:has(> .community-login-note){
        display:block!important;
        min-height:0!important;
        height:auto!important;
        margin-bottom:21px!important;
        padding:0!important;
        border:0!important;
        background:transparent!important;
      }
      #reader-thread.standard-thread form[data-thread-form]:has(> .community-login-note) > *:not(.community-login-note){
        display:none!important;
      }
      #reader-thread.standard-thread form[data-thread-form] > .community-login-note{
        box-sizing:border-box!important;
        width:100%!important;
        min-height:52px!important;
        margin:0!important;
        display:flex!important;
        align-items:center!important;
        gap:10px!important;
      }
    `;
    document.head.appendChild(style);
  }

  function isCriticalImage(img) {
    return img.matches('#hero .lead img, #article > .article-hero, #article .work-hero-figure > img, #category-spotlight img');
  }

  function isAboveFoldImage(img) {
    return isCriticalImage(img) || !!img.closest('#hero') || img.matches('.work-author-avatar, .category-spotlight img');
  }

  function tuneImage(img) {
    if (!(img instanceof HTMLImageElement) || img.dataset.ncPerf === '1') return;
    img.dataset.ncPerf = '1';
    img.decoding = 'async';

    if (isCriticalImage(img)) {
      img.loading = 'eager';
      img.setAttribute('fetchpriority', 'high');
      return;
    }

    if (isAboveFoldImage(img)) {
      img.loading = 'eager';
      return;
    }

    if (!img.hasAttribute('loading')) img.loading = 'lazy';
  }

  function tuneMedia(root = document) {
    if (root instanceof HTMLImageElement) tuneImage(root);
    qsa('img', root).forEach(tuneImage);

    if (root instanceof HTMLIFrameElement && !root.hasAttribute('loading')) root.loading = 'lazy';
    qsa('iframe', root).forEach(frame => {
      if (!frame.hasAttribute('loading')) frame.loading = 'lazy';
    });
  }

  function rating(name, value) {
    if (name === 'LCP') return value <= 2500 ? 'good' : value <= 4000 ? 'needs_improvement' : 'poor';
    if (name === 'CLS') return value <= 0.1 ? 'good' : value <= 0.25 ? 'needs_improvement' : 'poor';
    if (name === 'INP') return value <= 200 ? 'good' : value <= 500 ? 'needs_improvement' : 'poor';
    return 'unknown';
  }

  function navigationType() {
    try {
      return performance.getEntriesByType('navigation')[0]?.type || 'navigate';
    } catch (_) {
      return 'navigate';
    }
  }

  function queueVital(name, value) {
    if (!Number.isFinite(value) || value < 0) return;
    const normalized = name === 'CLS' ? Math.round(value * 10000) / 10000 : Math.round(value);
    pendingVitals.set(name, {
      metric_name: name,
      metric_value: normalized,
      metric_rating: rating(name, value),
      navigation_type: navigationType()
    });
    flushVitals();
  }

  function flushVitals() {
    const analytics = window.NeuralCriticAnalytics;
    if (!analytics?.enabled?.() || !analytics?.track || !pendingVitals.size) return false;
    pendingVitals.forEach(payload => analytics.track('web_vital', payload));
    pendingVitals.clear();
    return true;
  }

  function startConsentAwareFlush() {
    if (flushTimer) return;
    let attempts = 0;
    const tryFlush = () => {
      attempts += 1;
      const complete = flushVitals();
      if ((complete && vitalsFinalized) || attempts >= 30) {
        clearInterval(flushTimer);
        flushTimer = null;
      }
    };
    flushTimer = setInterval(tryFlush, 2000);
    window.addEventListener('neuralcritic:analytics-script-loaded', tryFlush, { once: true });
  }

  function observeLcp() {
    if (!('PerformanceObserver' in window)) return;
    try {
      const observer = new PerformanceObserver(list => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1];
        if (last) lcpValue = last.startTime;
      });
      observer.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (_) {}
  }

  function observeCls() {
    if (!('PerformanceObserver' in window)) return;
    try {
      const observer = new PerformanceObserver(list => {
        list.getEntries().forEach(entry => {
          if (entry.hadRecentInput) return;
          const time = entry.startTime;
          if (!clsWindowStart || time - clsLastEntry > 1000 || time - clsWindowStart > 5000) {
            clsWindowStart = time;
            clsWindowValue = entry.value;
          } else {
            clsWindowValue += entry.value;
          }
          clsLastEntry = time;
          clsValue = Math.max(clsValue, clsWindowValue);
        });
      });
      observer.observe({ type: 'layout-shift', buffered: true });
    } catch (_) {}
  }

  function observeInp() {
    if (!('PerformanceObserver' in window)) return;
    try {
      const observer = new PerformanceObserver(list => {
        list.getEntries().forEach(entry => {
          if (!entry.interactionId || !Number.isFinite(entry.duration)) return;
          interactionDurations.push(entry.duration);
        });
      });
      observer.observe({ type: 'event', buffered: true, durationThreshold: 40 });
    } catch (_) {}
  }

  function inpValue() {
    if (!interactionDurations.length) return 0;
    const sorted = interactionDurations.slice().sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * 0.98) - 1));
    return sorted[index];
  }

  function finalizeVitals() {
    if (vitalsFinalized) return;
    vitalsFinalized = true;
    if (lcpValue) queueVital('LCP', lcpValue);
    queueVital('CLS', clsValue);
    const inp = inpValue();
    if (inp) queueVital('INP', inp);
    startConsentAwareFlush();
    flushVitals();
  }

  function installVitalsObservers() {
    observeLcp();
    observeCls();
    observeInp();
    startConsentAwareFlush();

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') finalizeVitals();
    }, { passive: true });
    window.addEventListener('pagehide', finalizeVitals, { once: true });
  }

  function init() {
    installUiRegressionGuards();
    tuneMedia(document);
    installVitalsObservers();

    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === 1) tuneMedia(node);
        }
      }
    });

    observer.observe(document.body, {childList: true, subtree: true});
    window.addEventListener('load', () => setTimeout(() => observer.disconnect(), 20000), {once: true});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
