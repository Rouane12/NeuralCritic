window.NEURAL_CRITIC_ANALYTICS = {
  /* GA4 web-stream Measurement ID for Neural Critic. */
  measurementId: 'G-F2VE99GLH5',
  consentKey: 'neural-critic-analytics-consent-v1',
  debug: false
};

(() => {
  const pageName = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const privatePages = new Set(['studio.html', 'subscribers.html', 'newsroom.html']);

  if (!document.querySelector('script[data-nc-signup-hardening]')) {
    const script = document.createElement('script');
    script.src = 'assets/signup-hardening.js?v=20260824-launch1';
    script.async = true;
    script.dataset.ncSignupHardening = '1';
    document.head.appendChild(script);
  }

  if (privatePages.has(pageName) || document.querySelector('script[data-nc-reader-auth-v2]')) return;

  if (!document.querySelector('style[data-nc-reader-auth-v2-fixes]')) {
    const style = document.createElement('style');
    style.dataset.ncReaderAuthV2Fixes = '1';
    style.textContent = [
      '.reader-auth-modal[data-mode="signup"] .reader-auth-forgot{display:none!important}',
      '.reader-auth-modal[data-nc-auth-subview] .reader-auth-card>small,.reader-auth-modal[data-nc-auth-subview] .reader-auth-security-note{display:none!important}'
    ].join('');
    document.head.appendChild(style);
  }

  const auth = document.createElement('script');
  auth.src = 'assets/reader-auth-v2.js?v=20260824-auth2';
  auth.async = true;
  auth.dataset.ncReaderAuthV2 = '1';
  document.head.appendChild(auth);
})();
