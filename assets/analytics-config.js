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

  if (!document.querySelector('style[data-nc-reader-social-polish]')) {
    const socialStyle = document.createElement('style');
    socialStyle.dataset.ncReaderSocialPolish = '1';
    socialStyle.textContent = [
      '.reader-auth-social{grid-template-columns:repeat(2,minmax(0,1fr))!important}',
      '.reader-auth-social[data-count="1"]{grid-template-columns:1fr!important}',
      '.reader-auth-social[data-count="2"]{grid-template-columns:repeat(2,minmax(0,1fr))!important}',
      '.reader-auth-social[data-count="3"]{grid-template-columns:repeat(3,minmax(0,1fr))!important}',
      '.reader-auth-social[data-count="4"]{grid-template-columns:repeat(2,minmax(0,1fr))!important}',
      '.reader-auth-provider{min-width:0!important;padding-inline:9px!important}',
      '.reader-auth-provider>span:last-child{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.reader-auth-provider[data-provider="facebook"] .reader-auth-provider-mark{color:#78a7ff}',
      '@media(max-width:560px){.reader-auth-social[data-count="3"]{grid-template-columns:repeat(2,minmax(0,1fr))!important}.reader-auth-social[data-count="3"] .reader-auth-provider:last-child{grid-column:1/-1}.reader-auth-social[data-count="4"]{grid-template-columns:repeat(2,minmax(0,1fr))!important}}'
    ].join('');
    document.head.appendChild(socialStyle);
  }

  if (!document.querySelector('link[data-nc-reader-auth-v2]')) {
    const authStyle = document.createElement('link');
    authStyle.rel = 'stylesheet';
    authStyle.href = 'assets/reader-auth-v2.css?v=20260826-social1';
    authStyle.dataset.ncReaderAuthV2 = '1';
    document.head.appendChild(authStyle);
  }

  let facebookEnabled = null;

  const syncSocialGrid = host => {
    if (!host) return 0;
    const count = host.querySelectorAll('.reader-auth-provider').length;
    host.dataset.count = String(count);
    return count;
  };

  const resolveFacebookEnabled = async () => {
    if (facebookEnabled !== null) return facebookEnabled;
    const cfg = window.NEURAL_CRITIC_SUPABASE;
    if (!cfg?.url || !cfg?.publishableKey) return false;
    try {
      const response = await fetch(`${cfg.url.replace(/\/$/, '')}/auth/v1/settings`, {
        headers: { apikey: cfg.publishableKey },
        cache: 'no-store'
      });
      if (!response.ok) return false;
      const payload = await response.json();
      facebookEnabled = payload?.external?.facebook === true;
    } catch (_) {
      facebookEnabled = false;
    }
    return facebookEnabled;
  };

  const ensureSocialProviders = async () => {
    const modal = document.querySelector('.reader-auth-modal');
    const host = modal?.querySelector('.reader-auth-social');
    const divider = modal?.querySelector('.reader-auth-divider');
    if (!host) return false;

    if (!host.querySelector('[data-provider="x"]')) {
      host.insertAdjacentHTML('beforeend', `
        <button class="reader-auth-provider" type="button" data-provider="x" aria-label="Continue with X">
          <span class="reader-auth-provider-mark" aria-hidden="true">X</span>
          <span>X</span>
        </button>`);
    }

    if (await resolveFacebookEnabled() && !host.querySelector('[data-provider="facebook"]')) {
      const markup = `
        <button class="reader-auth-provider" type="button" data-provider="facebook" aria-label="Continue with Facebook">
          <span class="reader-auth-provider-mark" aria-hidden="true">f</span>
          <span>Facebook</span>
        </button>`;
      const xButton = host.querySelector('[data-provider="x"]');
      if (xButton) xButton.insertAdjacentHTML('beforebegin', markup);
      else host.insertAdjacentHTML('beforeend', markup);
    }

    const count = syncSocialGrid(host);
    host.hidden = count === 0;
    if (divider) divider.hidden = count === 0;
    return count > 0;
  };

  const auth = document.createElement('script');
  auth.src = 'assets/reader-auth-v2.js?v=20260826-social1';
  auth.async = true;
  auth.dataset.ncReaderAuthV2 = '1';
  auth.addEventListener('load', () => {
    ensureSocialProviders();
    const observer = new MutationObserver(() => ensureSocialProviders());
    observer.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => {
      ensureSocialProviders();
      observer.disconnect();
    }, 3500);
  }, { once: true });
  document.head.appendChild(auth);
})();

(() => {
  const pageName = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const privatePages = new Set(['studio.html', 'subscribers.html', 'newsroom.html']);
  if (privatePages.has(pageName) || document.querySelector('script[data-nc-saved-stories]')) return;
  const saved = document.createElement('script');
  saved.src = 'assets/saved-stories.js?v=20260831-saved5';
  saved.async = true;
  saved.dataset.ncSavedStories = '1';
  document.head.appendChild(saved);
})();

(() => {
  const pageName = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const privatePages = new Set(['studio.html', 'subscribers.html', 'newsroom.html']);
  if (privatePages.has(pageName) || document.querySelector('script[data-nc-entity-follows]')) return;
  const follows = document.createElement('script');
  follows.src = 'assets/entity-follows-v2.js?v=20260831-follow2';
  follows.async = true;
  follows.dataset.ncEntityFollows = '1';
  document.head.appendChild(follows);
})();
