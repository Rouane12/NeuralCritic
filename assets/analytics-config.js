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

  /* Load the current Reader Auth stylesheet explicitly so production visitors
     receive auth polish without depending on a hard refresh. */
  if (!document.querySelector('link[data-nc-reader-auth-v2]')) {
    const authStyle = document.createElement('link');
    authStyle.rel = 'stylesheet';
    authStyle.href = 'assets/reader-auth-v2.css?v=20260824-auth3';
    authStyle.dataset.ncReaderAuthV2 = '1';
    document.head.appendChild(authStyle);
  }

  /* Supabase Auth currently supports provider:"x", but /auth/v1/settings does
     not expose the new X OAuth 2.0 provider in its external provider map. Keep
     the intended Neural Critic provider visible until that endpoint catches up. */
  const ensureXProvider = () => {
    const modal = document.querySelector('.reader-auth-modal');
    const host = modal?.querySelector('.reader-auth-social');
    const divider = modal?.querySelector('.reader-auth-divider');
    if (!host || host.querySelector('[data-provider="x"]')) return false;
    host.insertAdjacentHTML('beforeend', `
      <button class="reader-auth-provider" type="button" data-provider="x" aria-label="Continue with X">
        <span class="reader-auth-provider-mark" aria-hidden="true">X</span>
        <span>X</span>
      </button>`);
    host.hidden = false;
    if (divider) divider.hidden = false;
    return true;
  };

  const auth = document.createElement('script');
  auth.src = 'assets/reader-auth-v2.js?v=20260824-auth3';
  auth.async = true;
  auth.dataset.ncReaderAuthV2 = '1';
  auth.addEventListener('load', () => {
    ensureXProvider();
    const observer = new MutationObserver(() => ensureXProvider());
    observer.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => {
      ensureXProvider();
      observer.disconnect();
    }, 2500);
  }, { once: true });
  document.head.appendChild(auth);
})();
