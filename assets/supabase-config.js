window.NEURAL_CRITIC_SUPABASE = {
  url: 'https://pchrrwfdcfbytggekuzs.supabase.co',
  publishableKey: 'sb_publishable_T8ObjS3Mab7Do5aCXnP8nA_jvgYkf8T'
};

/* Shared public hardening: canonical/social metadata, structured data,
   crawler directives, canonical story routing, analytics, and lightweight
   image loading hints. Generated story shells already contain static metadata,
   so they skip the runtime hardening pass while keeping analytics/content live. */
(() => {
  const loadStoryRouter = () => {
    if (document.querySelector('script[data-nc-story-router]')) return;
    const router = document.createElement('script');
    router.src = 'assets/story-router.js?v=20260822-story2';
    router.async = true;
    router.dataset.ncStoryRouter = '1';
    document.head.appendChild(router);
  };

  if (!window.NEURAL_CRITIC_STATIC_META && !document.querySelector('script[data-nc-hardening]')) {
    const hardening = document.createElement('script');
    hardening.src = 'assets/public-hardening.js?v=20260822-launch1';
    hardening.async = true;
    hardening.dataset.ncHardening = '1';
    hardening.addEventListener('load', loadStoryRouter, { once: true });
    hardening.addEventListener('error', loadStoryRouter, { once: true });
    document.head.appendChild(hardening);
  } else {
    loadStoryRouter();
  }

  if (document.querySelector('script[data-nc-analytics-config]')) return;
  const config = document.createElement('script');
  config.src = 'assets/analytics-config.js?v=20260822-analytics1';
  config.async = true;
  config.dataset.ncAnalyticsConfig = '1';
  config.addEventListener('load', () => {
    if (document.querySelector('script[data-nc-analytics]')) return;
    const analytics = document.createElement('script');
    analytics.src = 'assets/analytics.js?v=20260822-analytics2';
    analytics.async = true;
    analytics.dataset.ncAnalytics = '1';
    analytics.addEventListener('load', () => {
      window.dispatchEvent(new CustomEvent('neuralcritic:analytics-script-loaded'));
    }, { once: true });
    document.head.appendChild(analytics);
  }, { once: true });
  document.head.appendChild(config);
})();
