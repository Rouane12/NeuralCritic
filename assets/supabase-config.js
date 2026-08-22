window.NEURAL_CRITIC_SUPABASE = {
  url: 'https://pchrrwfdcfbytggekuzs.supabase.co',
  publishableKey: 'sb_publishable_T8ObjS3Mab7Do5aCXnP8nA_jvgYkf8T'
};

/* Shared public hardening: canonical/social metadata, structured data,
   crawler directives, and lightweight image loading hints. Keep this loader
   here so every CMS-backed surface receives the same behavior. */
(() => {
  if (document.querySelector('script[data-nc-hardening]')) return;
  const script = document.createElement('script');
  script.src = 'assets/public-hardening.js?v=20260822-launch1';
  script.async = true;
  script.dataset.ncHardening = '1';
  document.head.appendChild(script);
})();
