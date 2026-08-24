(() => {
  'use strict';

  const PRIVATE_PAGES = new Set(['studio.html', 'subscribers.html', 'newsroom.html']);
  const pageName = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  if (PRIVATE_PAGES.has(pageName)) return;

  const MIN_PASSWORD = 8;
  const ROOT_REDIRECT = `${location.origin}/`;
  const cfg = window.NEURAL_CRITIC_SUPABASE;
  if (!cfg?.url || !cfg?.publishableKey) return;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  let client = null;
  let providerState = null;
  let recoveryMode = false;
  let authSubscriptionBound = false;

  function loadStyles() {
    if (document.querySelector('link[data-nc-reader-auth-v2]')) return;
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = 'assets/reader-auth-v2.css?v=20260824-auth2';
    style.dataset.ncReaderAuthV2 = '1';
    document.head.appendChild(style);
  }

  async function resolveClient(timeout = 5000) {
    if (client) return client;
    const started = performance.now();
    while (performance.now() - started < timeout) {
      client = window.neuralCriticReaderSupabase || window.neuralCriticCommunitySupabase || window.neuralCriticPublicSupabase || null;
      if (client?.auth) return client;
      await sleep(60);
    }
    if (!client && window.supabase?.createClient) {
      client = window.supabase.createClient(cfg.url, cfg.publishableKey);
    }
    return client;
  }

  function status(message = '', type = '') {
    const modal = $('.reader-auth-modal');
    const el = $('.reader-auth-status', modal || document);
    if (!el) return;
    el.textContent = message;
    el.className = `reader-auth-status ${type}`.trim();
    el.setAttribute('aria-live', 'polite');
  }

  function subviewStatus(view, message = '', type = '') {
    const el = $(`.reader-auth-subview[data-view="${view}"] .reader-auth-subview-status`);
    if (!el) return;
    el.textContent = message;
    el.className = `reader-auth-subview-status ${type}`.trim();
    el.setAttribute('aria-live', 'polite');
  }

  function providerLabel(provider) {
    return ({google: 'Google', apple: 'Apple', x: 'X', discord: 'Discord'})[provider] || provider;
  }

  function providerMark(provider) {
    return ({google: 'G', apple: '●', x: 'X', discord: 'D'})[provider] || '•';
  }

  async function fetchProviderState() {
    if (providerState) return providerState;
    providerState = {google:false, apple:false, x:false, discord:false};
    try {
      const response = await fetch(`${cfg.url.replace(/\/$/, '')}/auth/v1/settings`, {
        headers: { apikey: cfg.publishableKey },
        cache: 'no-store'
      });
      if (!response.ok) return providerState;
      const payload = await response.json();
      const external = payload?.external || {};
      providerState.google = external.google === true;
      providerState.apple = external.apple === true;
      providerState.x = external.x === true || external.twitter === true;
      providerState.discord = external.discord === true;
    } catch (_) {}
    return providerState;
  }

  async function renderProviders(modal) {
    const host = $('.reader-auth-social', modal);
    const divider = $('.reader-auth-divider', modal);
    if (!host || !divider) return;
    const enabled = await fetchProviderState();
    const providers = ['google','apple','x','discord'].filter(key => enabled[key]);
    if (!providers.length) {
      host.hidden = true;
      divider.hidden = true;
      return;
    }
    host.innerHTML = providers.map(provider => `
      <button class="reader-auth-provider" type="button" data-provider="${provider}" aria-label="Continue with ${providerLabel(provider)}">
        <span class="reader-auth-provider-mark" aria-hidden="true">${providerMark(provider)}</span>
        <span>${providerLabel(provider)}</span>
      </button>`).join('');
    host.hidden = false;
    divider.hidden = false;
  }

  function mainNodes(modal) {
    return [
      $('.reader-auth-brandmark', modal),
      $(':scope > small', modal),
      $('#reader-auth-title', modal),
      $('[data-reader-auth-copy]', modal),
      $('.reader-auth-social', modal),
      $('.reader-auth-divider', modal),
      $('.reader-auth-tabs', modal),
      $('.reader-auth-form', modal),
      $('.reader-auth-status', modal),
      $('.reader-profile-slot', modal),
      $('.reader-auth-signout', modal)
    ].filter(Boolean);
  }

  function showSubview(name) {
    const modal = $('.reader-auth-modal');
    if (!modal) return;
    mainNodes(modal).forEach(node => { node.dataset.ncAuthWasHidden = node.hidden ? '1' : '0'; node.hidden = true; });
    $$('.reader-auth-subview', modal).forEach(view => { view.hidden = view.dataset.view !== name; });
    modal.dataset.ncAuthSubview = name;
    const focus = $(`.reader-auth-subview[data-view="${name}"] input`, modal);
    requestAnimationFrame(() => focus?.focus());
  }

  function closeSubview() {
    const modal = $('.reader-auth-modal');
    if (!modal) return;
    $$('.reader-auth-subview', modal).forEach(view => { view.hidden = true; });
    mainNodes(modal).forEach(node => {
      if (node.dataset.ncAuthWasHidden != null) {
        node.hidden = node.dataset.ncAuthWasHidden === '1';
        delete node.dataset.ncAuthWasHidden;
      }
    });
    delete modal.dataset.ncAuthSubview;
  }

  function buildSubviewMarkup() {
    return `
      <section class="reader-auth-subview" data-view="forgot" hidden>
        <button class="reader-auth-back" type="button" data-auth-back>← BACK TO SIGN IN</button>
        <small>ACCOUNT RECOVERY</small>
        <h3>Reset your password</h3>
        <p>Enter the email connected to your Reader account. We’ll send a secure reset link.</p>
        <form class="reader-auth-reset-request">
          <label class="reader-auth-field">EMAIL
            <input name="email" type="email" autocomplete="email" placeholder="you@example.com" required>
          </label>
          <button type="submit">SEND RESET LINK</button>
          <div class="reader-auth-subview-status" aria-live="polite"></div>
        </form>
      </section>
      <section class="reader-auth-subview" data-view="recovery" hidden>
        <small>SECURE PASSWORD RESET</small>
        <h3>Choose a new password</h3>
        <p>Use at least ${MIN_PASSWORD} characters. Your new password takes effect immediately.</p>
        <form class="reader-auth-password-update">
          <label class="reader-auth-field">NEW PASSWORD
            <div class="reader-auth-password-wrap">
              <input name="password" type="password" autocomplete="new-password" minlength="${MIN_PASSWORD}" placeholder="New password" required>
              <button class="reader-auth-password-toggle" type="button" data-password-toggle>SHOW</button>
            </div>
          </label>
          <label class="reader-auth-field">CONFIRM PASSWORD
            <div class="reader-auth-password-wrap">
              <input name="confirmPassword" type="password" autocomplete="new-password" minlength="${MIN_PASSWORD}" placeholder="Repeat password" required>
              <button class="reader-auth-password-toggle" type="button" data-password-toggle>SHOW</button>
            </div>
          </label>
          <button type="submit">UPDATE PASSWORD</button>
          <div class="reader-auth-subview-status" aria-live="polite"></div>
        </form>
      </section>`;
  }

  function enhanceForm(modal) {
    const form = $('.reader-auth-form', modal);
    if (!form || form.dataset.ncAuthV2 === '1') return;
    const oldEmail = form.elements.email?.value || '';
    const oldName = form.elements.name?.value || '';
    form.innerHTML = `
      <label class="reader-auth-field">DISPLAY NAME
        <input class="reader-auth-name" name="name" maxlength="40" autocomplete="nickname" placeholder="How you’ll appear on Neural Critic" hidden>
      </label>
      <label class="reader-auth-field">EMAIL
        <input name="email" type="email" autocomplete="email" placeholder="you@example.com" required>
      </label>
      <label class="reader-auth-field">
        <span class="reader-auth-field-head"><span>PASSWORD</span><button class="reader-auth-forgot" type="button">Forgot password?</button></span>
        <div class="reader-auth-password-wrap">
          <input name="password" type="password" autocomplete="current-password" minlength="6" placeholder="Your password" required>
          <button class="reader-auth-password-toggle" type="button" data-password-toggle>SHOW</button>
        </div>
      </label>
      <button type="submit">SIGN IN</button>`;
    form.dataset.ncAuthV2 = '1';
    if (form.elements.email) form.elements.email.value = oldEmail;
    if (form.elements.name) form.elements.name.value = oldName;
  }

  function enhanceModal(modal) {
    if (!modal || modal.dataset.ncAuthV2 === '1') return;
    modal.dataset.ncAuthV2 = '1';
    const card = $('.reader-auth-card', modal);
    if (!card) return;
    if (!$('.reader-auth-brandmark', card)) card.insertAdjacentHTML('afterbegin', '<span class="reader-auth-brandmark" aria-hidden="true">NC</span>');
    enhanceForm(modal);
    const tabs = $('.reader-auth-tabs', modal);
    if (tabs && !$('.reader-auth-social', modal)) tabs.insertAdjacentHTML('beforebegin', '<div class="reader-auth-social" hidden></div><div class="reader-auth-divider" hidden><span>or continue with email</span></div>');
    const statusNode = $('.reader-auth-status', modal);
    if (statusNode) statusNode.setAttribute('aria-live', 'polite');
    if (!$('.reader-auth-security-note', modal) && statusNode) statusNode.insertAdjacentHTML('afterend', '<p class="reader-auth-security-note"><b>Secure Reader account</b> · Powered by encrypted authentication</p>');
    if (!$('.reader-auth-subview', modal)) card.insertAdjacentHTML('beforeend', buildSubviewMarkup());
    renderProviders(modal);
    if (recoveryMode) {
      modal.hidden = false;
      document.body.style.overflow = 'hidden';
      showSubview('recovery');
    }
  }

  async function oauth(provider) {
    const auth = await resolveClient();
    if (!auth?.auth) throw new Error('Authentication is still loading. Please try again.');
    status(`Opening ${providerLabel(provider)}…`);
    const { error } = await auth.auth.signInWithOAuth({
      provider,
      options: { redirectTo: ROOT_REDIRECT }
    });
    if (error) throw error;
  }

  async function submitPrimary(form) {
    const modal = form.closest('.reader-auth-modal');
    const mode = modal?.dataset.mode || 'signin';
    const email = form.elements.email?.value.trim() || '';
    const password = form.elements.password?.value || '';
    const displayName = form.elements.name?.value.trim() || '';
    const auth = await resolveClient();
    if (!auth?.auth) throw new Error('Authentication is still loading. Please try again.');

    if (mode === 'signup') {
      if (displayName.length < 2) throw new Error('Choose a display name of at least 2 characters.');
      if (password.length < MIN_PASSWORD) throw new Error(`Use a password of at least ${MIN_PASSWORD} characters.`);
      status('Creating your Reader account…');
      const { data, error } = await auth.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName },
          emailRedirectTo: ROOT_REDIRECT
        }
      });
      if (error) throw error;
      if (!data?.session) {
        status('Account created. Check your email to confirm it, then return and sign in.', 'success');
        return;
      }
      status('Reader account created.', 'success');
      return;
    }

    status('Signing in…');
    const { error } = await auth.auth.signInWithPassword({ email, password });
    if (error) throw error;
    status('Signed in.', 'success');
    setTimeout(() => {
      if (modal) modal.hidden = true;
      document.body.style.overflow = '';
    }, 120);
  }

  async function requestReset(form) {
    const email = form.elements.email?.value.trim() || '';
    if (!email) throw new Error('Enter the email connected to your account.');
    const auth = await resolveClient();
    if (!auth?.auth) throw new Error('Authentication is still loading. Please try again.');
    subviewStatus('forgot', 'Sending reset link…');
    const { error } = await auth.auth.resetPasswordForEmail(email, { redirectTo: ROOT_REDIRECT });
    if (error) throw error;
    subviewStatus('forgot', 'If an account uses that email, a password reset link is on its way.', 'success');
  }

  async function updatePassword(form) {
    const password = form.elements.password?.value || '';
    const confirmPassword = form.elements.confirmPassword?.value || '';
    if (password.length < MIN_PASSWORD) throw new Error(`Use at least ${MIN_PASSWORD} characters.`);
    if (password !== confirmPassword) throw new Error('The two passwords do not match.');
    const auth = await resolveClient();
    if (!auth?.auth) throw new Error('Authentication is still loading. Please try again.');
    subviewStatus('recovery', 'Updating password…');
    const { error } = await auth.auth.updateUser({ password });
    if (error) throw error;
    recoveryMode = false;
    subviewStatus('recovery', 'Password updated. Your Reader account is ready.', 'success');
    setTimeout(() => closeSubview(), 850);
  }

  function togglePassword(button) {
    const wrap = button.closest('.reader-auth-password-wrap');
    const input = $('input', wrap || document);
    if (!input) return;
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    button.textContent = show ? 'HIDE' : 'SHOW';
    button.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  }

  function bindEvents() {
    document.addEventListener('submit', async event => {
      const primary = event.target.closest?.('.reader-auth-form');
      const resetRequest = event.target.closest?.('.reader-auth-reset-request');
      const passwordUpdate = event.target.closest?.('.reader-auth-password-update');
      if (!primary && !resetRequest && !passwordUpdate) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      try {
        if (primary) await submitPrimary(primary);
        else if (resetRequest) await requestReset(resetRequest);
        else await updatePassword(passwordUpdate);
      } catch (error) {
        const message = error?.message || 'Authentication failed. Please try again.';
        if (resetRequest) subviewStatus('forgot', message, 'error');
        else if (passwordUpdate) subviewStatus('recovery', message, 'error');
        else status(message, 'error');
      }
    }, true);

    document.addEventListener('click', async event => {
      const providerButton = event.target.closest?.('.reader-auth-provider');
      if (providerButton) {
        event.preventDefault();
        try { await oauth(providerButton.dataset.provider); }
        catch (error) { status(error?.message || 'Social sign-in could not start.', 'error'); }
        return;
      }
      const forgot = event.target.closest?.('.reader-auth-forgot');
      if (forgot) {
        event.preventDefault();
        const modal = forgot.closest('.reader-auth-modal');
        const email = $('.reader-auth-form input[name="email"]', modal || document)?.value || '';
        showSubview('forgot');
        const resetEmail = $('.reader-auth-reset-request input[name="email"]', modal || document);
        if (resetEmail && email) resetEmail.value = email;
        return;
      }
      if (event.target.closest?.('[data-auth-back]')) {
        event.preventDefault();
        closeSubview();
        return;
      }
      const toggle = event.target.closest?.('[data-password-toggle]');
      if (toggle) {
        event.preventDefault();
        togglePassword(toggle);
      }
    }, true);

    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      const modal = $('.reader-auth-modal:not([hidden])');
      if (!modal) return;
      if (modal.dataset.ncAuthSubview && !recoveryMode) {
        event.preventDefault();
        closeSubview();
      }
    }, true);
  }

  async function bindAuthState() {
    if (authSubscriptionBound) return;
    const auth = await resolveClient();
    if (!auth?.auth) return;
    authSubscriptionBound = true;
    auth.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        recoveryMode = true;
        const modal = $('.reader-auth-modal');
        if (modal) {
          enhanceModal(modal);
          modal.hidden = false;
          document.body.style.overflow = 'hidden';
          showSubview('recovery');
        }
      }
    });
  }

  function detectRecoveryFromUrl() {
    const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
    const query = new URLSearchParams(location.search);
    recoveryMode = hash.get('type') === 'recovery' || query.get('type') === 'recovery';
  }

  function observeModal() {
    const existing = $('.reader-auth-modal');
    if (existing) enhanceModal(existing);
    const observer = new MutationObserver(records => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (!(node instanceof Element)) continue;
          if (node.matches?.('.reader-auth-modal')) enhanceModal(node);
          node.querySelectorAll?.('.reader-auth-modal').forEach(enhanceModal);
        }
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  loadStyles();
  detectRecoveryFromUrl();
  bindEvents();
  observeModal();
  bindAuthState();
})();
