window.NEURAL_CRITIC_ANALYTICS = {
  /* GA4 web-stream Measurement ID for Neural Critic. */
  measurementId: 'G-F2VE99GLH5',
  consentKey: 'neural-critic-analytics-consent-v1',
  debug: false
};

(() => {
  if (document.querySelector('script[data-nc-signup-hardening]')) return;
  const script = document.createElement('script');
  script.src = 'assets/signup-hardening.js?v=20260824-launch1';
  script.async = true;
  script.dataset.ncSignupHardening = '1';
  document.head.appendChild(script);
})();
