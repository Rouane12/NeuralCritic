(() => {
  'use strict';

  const cfg = window.NEURAL_CRITIC_ANALYTICS || {};
  const measurementId = String(cfg.measurementId || '').trim();
  const CONSENT_KEY = String(cfg.consentKey || 'neural-critic-analytics-consent-v1');
  const PRIVATE_PAGES = new Set(['studio.html', 'subscribers.html']);
  const pageName = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const validId = /^G-[A-Z0-9]+$/i.test(measurementId);
  const debug = !!cfg.debug;
  const trackedScroll = new Set();
  const newsletterTracked = new WeakSet();
  let tagLoaded = false;

  function log(...args) {
    if (debug) console.info('[Neural Critic Analytics]', ...args);
  }

  function pageType() {
    if (pageName === 'article.html') return 'article';
    if (pageName === 'category.html') return 'category';
    if (pageName === 'search.html') return 'search';
    if (pageName === 'about.html') return 'about';
    if (pageName === 'privacy.html') return 'privacy';
    return 'home';
  }

  function articleSlug() {
    return new URLSearchParams(location.search).get('slug') || '';
  }

  function safePageUrl() {
    const url = new URL(location.href);
    if (pageName === 'search.html') url.search = '';
    return url;
  }

  function safePageTitle() {
    return pageName === 'search.html' ? 'Search · Neural Critic' : document.title;
  }

  function safeParams(input = {}) {
    const output = {};
    Object.entries(input).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      if (typeof value === 'string') output[key] = value.slice(0, 120);
      else if (typeof value === 'number' || typeof value === 'boolean') output[key] = value;
    });
    return output;
  }

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag(){ window.dataLayer.push(arguments); };

  // Default to denied. Ad-related storage/signals remain denied even when
  // analytics is accepted because Neural Critic is measuring editorial use,
  // not advertising profiles.
  window.gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    wait_for_update: 500
  });

  function track(eventName, params = {}) {
    if (!tagLoaded || !eventName) return;
    const payload = safeParams({
      page_type: pageType(),
      article_slug: articleSlug(),
      ...params
    });
    window.gtag('event', eventName, payload);
    log(eventName, payload);
  }

  function storedConsent() {
    try { return localStorage.getItem(CONSENT_KEY) || 'unset'; }
    catch (_) { return 'unset'; }
  }

  window.NeuralCriticAnalytics = {
    track,
    enabled: () => tagLoaded,
    consent: storedConsent
  };

  function loadTag() {
    if (tagLoaded || !validId || PRIVATE_PAGES.has(pageName)) return;
    tagLoaded = true;

    window.gtag('consent', 'update', {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied'
    });
    window.gtag('js', new Date());
    window.gtag('config', measurementId, {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false
    });

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    script.dataset.ncAnalyticsTag = '1';
    document.head.appendChild(script);

    const safeUrl = safePageUrl();
    track('page_view', {
      page_title: safePageTitle(),
      page_location: safeUrl.href,
      page_path: `${safeUrl.pathname}${safeUrl.search}`
    });
    trackArticleContext();
    wireScrollDepth();
  }

  async function trackArticleContext() {
    const slug = articleSlug();
    if (!slug || pageName !== 'article.html') return;
    let article = null;
    const started = performance.now();
    while (performance.now() - started < 5000) {
      if (window.NeuralCriticContentAPI?.publishedArticle) {
        try { article = await window.NeuralCriticContentAPI.publishedArticle(slug); } catch (_) {}
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    track('article_view', {
      article_slug: slug,
      article_category: article?.category || '',
      article_format: article?.articleFormat || '',
      review_score: Number.isFinite(Number(article?.reviewMeta?.score)) ? Number(article.reviewMeta.score) : undefined
    });
  }

  function wireScrollDepth() {
    if (pageName !== 'article.html') return;
    const thresholds = [25, 50, 75, 90];
    const onScroll = () => {
      const root = document.documentElement;
      const max = Math.max(1, root.scrollHeight - innerHeight);
      const percent = Math.min(100, Math.round((scrollY / max) * 100));
      thresholds.forEach(threshold => {
        if (percent >= threshold && !trackedScroll.has(threshold)) {
          trackedScroll.add(threshold);
          track('article_scroll', { percent_scrolled: threshold });
        }
      });
      if (trackedScroll.size === thresholds.length) removeEventListener('scroll', onScroll);
    };
    addEventListener('scroll', onScroll, { passive: true });
  }

  function actionFromLabel(label) {
    const text = String(label || '').trim().toUpperCase();
    if (!text) return '';
    if (/\bLIKE\b/.test(text)) return 'article_like';
    if (/\bFOLLOW\b/.test(text)) return 'article_follow';
    if (/\bTHREAD\b|\bCOMMENT/.test(text)) return 'article_thread_open';
    if (/\bSHARE\b/.test(text)) return 'share';
    return '';
  }

  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target.closest('a,button') : null;
    if (!target) return;

    if (target.matches('.theme-toggle') || target.closest('.theme-toggle')) {
      setTimeout(() => track('theme_change', { theme: document.documentElement.dataset.theme || 'unknown' }), 0);
    }

    const action = pageName === 'article.html' ? actionFromLabel(target.textContent) : '';
    if (action) track(action);

    if (target instanceof HTMLAnchorElement) {
      let url;
      try { url = new URL(target.href, location.href); } catch (_) { return; }
      if (/^https?:$/.test(url.protocol) && url.hostname !== location.hostname) {
        track('outbound_click', { link_domain: url.hostname });
      }
      if (target.href.includes('article.html?slug=')) {
        const slug = new URL(target.href, location.href).searchParams.get('slug') || '';
        track('select_article', { selected_slug: slug });
      }
    }
  }, true);

  document.addEventListener('submit', event => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (form.matches('#work-search-form') || form.closest('.search-work-form')) {
      const input = form.querySelector('input[type="search"]');
      track('site_search', { query_length: String(input?.value || '').trim().length });
    }
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key !== 'Enter') return;
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    if (input.matches('#quick-search,input[type="search"]')) {
      track('site_search', { query_length: String(input.value || '').trim().length });
    }
  }, true);

  function watchNewsletterSuccess() {
    const observer = new MutationObserver(() => {
      document.querySelectorAll('.newsletter-status').forEach(note => {
        const form = note.closest('.newsletter,.category-weekly,.work-weekly-card')?.querySelector('form') || note.parentElement?.querySelector('form');
        if (!(form instanceof HTMLFormElement) || newsletterTracked.has(form)) return;
        const success = note.dataset.error !== '1' && /welcome|you.?re in|subscribed/i.test(note.textContent || '');
        if (!success) return;
        newsletterTracked.add(form);
        track('newsletter_signup', {
          signup_source: form.dataset.newsletterSource || (pageName === 'article.html' ? `article:${articleSlug()}` : pageType())
        });
      });
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  }

  function wireFooterLinks() {
    const apply = () => {
      const columns = [...document.querySelectorAll('footer .footer > div')];
      const about = columns.find(column => column.querySelector('b')?.textContent?.trim().toUpperCase() === 'ABOUT');
      if (!about) return false;
      if (!about.querySelector('a[href="privacy.html"]')) {
        const privacy = document.createElement('a');
        privacy.href = 'privacy.html';
        privacy.textContent = 'Privacy';
        about.appendChild(privacy);
      }
      if (!about.querySelector('a[href="feed.xml"]')) {
        const rss = document.createElement('a');
        rss.href = 'feed.xml';
        rss.textContent = 'RSS';
        about.appendChild(rss);
      }
      return true;
    };
    if (apply()) return;
    const observer = new MutationObserver(() => {
      if (apply()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 6000);
  }

  function injectConsentStyles() {
    if (document.getElementById('nc-analytics-consent-style')) return;
    const style = document.createElement('style');
    style.id = 'nc-analytics-consent-style';
    style.textContent = `
      .nc-analytics-consent{position:fixed;z-index:9999;left:50%;bottom:18px;transform:translateX(-50%);width:min(720px,calc(100% - 28px));padding:15px 16px;border:1px solid rgba(116,132,180,.34);border-radius:16px;background:rgba(8,13,27,.96);box-shadow:0 18px 60px rgba(0,0,0,.34);backdrop-filter:blur(18px);color:#f5f7ff;font:500 13px/1.5 Inter,system-ui,sans-serif}
      .nc-analytics-consent::before{content:"";position:absolute;inset:-1px auto auto 18px;width:110px;height:2px;background:linear-gradient(90deg,#55e7ff,#7c68ff);border-radius:999px}
      .nc-analytics-consent strong{display:block;margin:0 0 3px;font-size:14px}.nc-analytics-consent p{margin:0;color:#abb5ca}.nc-analytics-consent a{color:#70dff2}.nc-analytics-consent-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:12px}.nc-analytics-consent button{min-height:40px;padding:0 14px;border:1px solid rgba(124,140,182,.38);border-radius:10px;background:rgba(255,255,255,.035);color:#edf2ff;font:750 11px/1 Inter,system-ui,sans-serif;cursor:pointer}.nc-analytics-consent button[data-accept]{border-color:rgba(87,223,244,.6);background:linear-gradient(90deg,rgba(85,231,255,.18),rgba(124,104,255,.18))}
      html[data-theme="light"] .nc-analytics-consent{border-color:#d8deeb;background:rgba(255,255,255,.97);color:#182234;box-shadow:0 18px 60px rgba(32,45,72,.16)}html[data-theme="light"] .nc-analytics-consent p{color:#657187}html[data-theme="light"] .nc-analytics-consent button{border-color:#d6deeb;background:#f8faff;color:#273449}
      @media(max-width:620px){.nc-analytics-consent{bottom:10px;padding:14px}.nc-analytics-consent-actions{display:grid;grid-template-columns:1fr 1fr}.nc-analytics-consent button{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function showConsent() {
    if (!validId || PRIVATE_PAGES.has(pageName) || document.querySelector('.nc-analytics-consent')) return;
    injectConsentStyles();
    const banner = document.createElement('aside');
    banner.className = 'nc-analytics-consent';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Analytics preferences');
    banner.innerHTML = `<strong>Help improve Neural Critic</strong><p>Allow privacy-conscious analytics so we can understand which stories and features readers use. No email addresses, comments, account names, or search text are sent to analytics. <a href="privacy.html">Privacy details</a>.</p><div class="nc-analytics-consent-actions"><button type="button" data-essential>ESSENTIAL ONLY</button><button type="button" data-accept>ALLOW ANALYTICS</button></div>`;
    document.body.appendChild(banner);
    banner.querySelector('[data-essential]')?.addEventListener('click', () => {
      try { localStorage.setItem(CONSENT_KEY, 'denied'); } catch (_) {}
      banner.remove();
    });
    banner.querySelector('[data-accept]')?.addEventListener('click', () => {
      try { localStorage.setItem(CONSENT_KEY, 'granted'); } catch (_) {}
      banner.remove();
      loadTag();
    });
  }

  wireFooterLinks();

  if (PRIVATE_PAGES.has(pageName) || !validId) return;
  watchNewsletterSuccess();

  let consent = storedConsent();
  if (navigator.doNotTrack === '1') consent = 'denied';

  if (consent === 'granted') loadTag();
  else if (consent === 'unset') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showConsent, { once: true });
    else showConsent();
  }
})();
