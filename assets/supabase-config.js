window.NEURAL_CRITIC_SUPABASE = {
  url: 'https://pchrrwfdcfbytggekuzs.supabase.co',
  publishableKey: 'sb_publishable_T8ObjS3Mab7Do5aCXnP8nA_jvgYkf8T'
};

/* Shared public hardening: canonical/social metadata, structured data,
   crawler directives, and lightweight image loading hints. Keep this loader
   here so every CMS-backed surface receives the same behavior. */
(() => {
  if (!document.querySelector('script[data-nc-hardening]')) {
    const hardening = document.createElement('script');
    hardening.src = 'assets/public-hardening.js?v=20260822-launch1';
    hardening.async = true;
    hardening.dataset.ncHardening = '1';
    document.head.appendChild(hardening);
  }

  if (document.querySelector('script[data-nc-analytics-config]')) return;
  const config = document.createElement('script');
  config.src = 'assets/analytics-config.js?v=20260822-analytics1';
  config.async = true;
  config.dataset.ncAnalyticsConfig = '1';
  config.addEventListener('load', () => {
    if (document.querySelector('script[data-nc-analytics]')) return;
    const analytics = document.createElement('script');
    analytics.src = 'assets/analytics.js?v=20260822-analytics1';
    analytics.async = true;
    analytics.dataset.ncAnalytics = '1';
    document.head.appendChild(analytics);
  }, { once: true });
  document.head.appendChild(config);
})();
