(() => {
  const config = window.NEURAL_CRITIC_SUPABASE;
  if (!config || !window.supabase) return;

  const client = window.neuralCriticPublicSupabase || window.supabase.createClient(config.url, config.publishableKey);
  window.neuralCriticReaderSupabase = client;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (v = '') => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const AVATAR_BUCKET = 'reader-avatars';
  const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
  const AVATAR_TYPES = new Set(['image/jpeg','image/png','image/webp','image/avif']);

  let session = null;
  let profile = null;

  function waitFor(selector, ms = 7000) {
    return new Promise(resolve => {
      const found = $(selector);
      if (found) return resolve(found);
      const observer = new MutationObserver(() => {
        const next = $(selector);
        if (next) { observer.disconnect(); resolve(next); }
      });
      observer.observe(document.documentElement, { childList:true, subtree:true });
      setTimeout(() => { observer.disconnect(); resolve($(selector)); }, ms);
    });
  }

  function initials(name = 'Reader') {
    return name.trim().split(/\s+/).slice(0,2).map(x => x[0]?.toUpperCase() || '').join('') || 'R';
  }

  async function loadProfile() {
    profile = null;
    if (!session?.user) return;
    const { data, error } = await client
      .from('reader_profiles')
      .select('user_id,display_name,avatar_url')
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (error) throw error;
    profile = data;
  }

  function ensureButton() {
    const tools = $('.header-tools');
    if (!tools) return null;
    let button = $('.reader-account-button', tools);
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'reader-account-button';
      button.innerHTML = '<span class="reader-account-dot"></span><span data-reader-account-label>SIGN IN</span>';
      button.addEventListener('click', () => openModal('signin'));
      tools.appendChild(button);
    }
    return button;
  }

  function updateButton() {
    const button = ensureButton();
    if (!button) return;
    const dot = $('.reader-account-dot', button);
    const label = $('[data-reader-account-label]', button);
    const signedIn = !!session?.user;
    button.classList.toggle('signed-in', signedIn);
    if (label) label.textContent = signedIn ? (profile?.display_name || 'ACCOUNT') : 'SIGN IN';
    if (dot) {
      if (signedIn && profile?.avatar_url) {
        dot.classList.add('reader-account-avatar');
        dot.style.backgroundImage = `url("${String(profile.avatar_url).replace(/"/g,'\\"')}")`;
      } else {
        dot.classList.remove('reader-account-avatar');
        dot.style.backgroundImage = '';
      }
    }
  }

  function setStatus(message = '', cls = '') {
    const el = $('.reader-auth-status');
    if (!el) return;
    el.textContent = message;
    el.className = `reader-auth-status ${cls}`.trim();
  }

  function ensureModal() {
    if ($('.reader-auth-modal')) return $('.reader-auth-modal');
    document.body.insertAdjacentHTML('beforeend', `
      <div class="reader-auth-modal" hidden>
        <section class="reader-auth-card" role="dialog" aria-modal="true" aria-labelledby="reader-auth-title">
          <button class="reader-auth-close" type="button" aria-label="Close">✕</button>
          <small>NEURAL CRITIC COMMUNITY</small>
          <h2 id="reader-auth-title">Reader sign in</h2>
          <p data-reader-auth-copy>Sign in to comment, like stories, and follow writers across Neural Critic.</p>
          <div class="reader-auth-tabs">
            <button type="button" class="active" data-auth-mode="signin">SIGN IN</button>
            <button type="button" data-auth-mode="signup">CREATE ACCOUNT</button>
          </div>
          <form class="reader-auth-form">
            <input class="reader-auth-name" name="name" maxlength="40" placeholder="Display name" hidden>
            <input name="email" type="email" autocomplete="email" placeholder="Email" required>
            <input name="password" type="password" autocomplete="current-password" minlength="6" placeholder="Password" required>
            <button type="submit">SIGN IN</button>
          </form>
          <div class="reader-auth-status"></div>
          <div class="reader-profile-slot"></div>
          <button class="reader-auth-signout" type="button" hidden>SIGN OUT</button>
        </section>
      </div>`);

    const modal = $('.reader-auth-modal');
    $('.reader-auth-close', modal)?.addEventListener('click', closeModal);
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
    $$('.reader-auth-tabs button', modal).forEach(btn => btn.addEventListener('click', () => setMode(btn.dataset.authMode)));
    $('.reader-auth-form', modal)?.addEventListener('submit', submitAuth);
    $('.reader-auth-signout', modal)?.addEventListener('click', async () => {
      await client.auth.signOut();
      closeModal();
    });
    return modal;
  }

  function setMode(mode = 'signin') {
    const modal = ensureModal();
    if (session?.user) return;
    modal.dataset.mode = mode;
    $$('.reader-auth-tabs button', modal).forEach(x => x.classList.toggle('active', x.dataset.authMode === mode));
    const name = $('.reader-auth-name', modal);
    const submit = $('.reader-auth-form button[type="submit"]', modal);
    const title = $('#reader-auth-title', modal);
    const copy = $('[data-reader-auth-copy]', modal);
    name.hidden = mode !== 'signup';
    name.required = mode === 'signup';
    submit.textContent = mode === 'signup' ? 'CREATE READER ACCOUNT' : 'SIGN IN';
    title.textContent = mode === 'signup' ? 'Create your reader account' : 'Reader sign in';
    copy.textContent = mode === 'signup'
      ? 'Choose a public display name, then join discussions and keep your reactions synced across devices.'
      : 'Sign in to comment, like stories, and follow writers across Neural Critic.';
    setStatus('');
  }

  function profileMarkup() {
    const name = profile?.display_name || session?.user?.user_metadata?.display_name || 'Reader';
    const avatar = profile?.avatar_url || '';
    return `<section class="reader-profile-editor">
      <div class="reader-profile-head">
        ${avatar ? `<img class="reader-profile-avatar" src="${esc(avatar)}" alt="${esc(name)}">` : `<span class="community-avatar">${esc(initials(name))}</span>`}
        <div><small>READER PROFILE</small><strong>${esc(name)}</strong><span>Neural Critic reader</span></div>
      </div>
      <label>DISPLAY NAME<input class="reader-profile-name" maxlength="40" value="${esc(name)}"></label>
      <div class="reader-profile-avatar-actions">
        <input class="reader-profile-file" type="file" accept="image/jpeg,image/png,image/webp,image/avif" hidden>
        <button type="button" class="reader-profile-upload">UPLOAD AVATAR</button>
        <span>JPG, PNG, WEBP or AVIF · max 5 MB</span>
      </div>
      <button type="button" class="reader-profile-save">SAVE PROFILE</button>
    </section>`;
  }

  function wireProfileEditor() {
    const editor = $('.reader-profile-editor');
    if (!editor || !session?.user) return;
    $('.reader-profile-upload', editor)?.addEventListener('click', () => $('.reader-profile-file', editor)?.click());
    $('.reader-profile-file', editor)?.addEventListener('change', uploadAvatar);
    $('.reader-profile-save', editor)?.addEventListener('click', saveProfile);
  }

  async function uploadAvatar(event) {
    const file = event.target.files?.[0];
    if (!file || !session?.user) return;
    const button = $('.reader-profile-upload');
    try {
      if (!AVATAR_TYPES.has(file.type)) throw new Error('Use JPG, PNG, WEBP, or AVIF for your avatar.');
      if (file.size > MAX_AVATAR_BYTES) throw new Error('Avatar must be 5 MB or smaller.');
      if (button) { button.disabled = true; button.textContent = 'UPLOADING…'; }
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g,'');
      const path = `${session.user.id}/${Date.now()}-${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}.${ext}`;
      const { data, error } = await client.storage.from(AVATAR_BUCKET).upload(path, file, { cacheControl:'31536000', contentType:file.type, upsert:false });
      if (error) throw error;
      const { data: pub } = client.storage.from(AVATAR_BUCKET).getPublicUrl(data.path);
      if (!pub?.publicUrl) throw new Error('Avatar uploaded, but no public URL was returned.');
      const { error: updateError } = await client.from('reader_profiles').update({ avatar_url: pub.publicUrl }).eq('user_id', session.user.id);
      if (updateError) throw updateError;
      profile = { ...(profile || {}), avatar_url: pub.publicUrl };
      updateButton();
      renderModalState();
      setStatus('Avatar updated.', 'success');
    } catch (error) {
      setStatus(error?.message || 'Avatar upload failed.', 'error');
    } finally {
      if (button) { button.disabled = false; button.textContent = 'UPLOAD AVATAR'; }
      event.target.value = '';
    }
  }

  async function saveProfile() {
    if (!session?.user) return;
    const name = $('.reader-profile-name')?.value.trim() || '';
    try {
      if (name.length < 2 || name.length > 40) throw new Error('Display name must be 2–40 characters.');
      const { error } = await client.from('reader_profiles').update({ display_name:name }).eq('user_id', session.user.id);
      if (error) throw error;
      await client.auth.updateUser({ data:{ display_name:name } });
      profile = { ...(profile || {}), display_name:name };
      updateButton();
      renderModalState();
      setStatus('Reader profile saved.', 'success');
    } catch (error) {
      setStatus(error?.message || 'Could not save profile.', 'error');
    }
  }

  function renderModalState() {
    const modal = ensureModal();
    const form = $('.reader-auth-form', modal);
    const tabs = $('.reader-auth-tabs', modal);
    const signout = $('.reader-auth-signout', modal);
    const slot = $('.reader-profile-slot', modal);
    const title = $('#reader-auth-title', modal);
    const copy = $('[data-reader-auth-copy]', modal);

    if (session?.user) {
      tabs.hidden = true;
      form.hidden = true;
      signout.hidden = false;
      title.textContent = profile?.display_name || 'Reader account';
      copy.textContent = 'Manage your public Neural Critic reader identity and account on this device.';
      slot.innerHTML = profileMarkup();
      wireProfileEditor();
      setStatus(session.user.email || '', 'success');
    } else {
      tabs.hidden = false;
      form.hidden = false;
      signout.hidden = true;
      slot.innerHTML = '';
      setMode('signin');
    }
  }

  function openModal(mode = 'signin') {
    const modal = ensureModal();
    renderModalState();
    if (!session?.user) setMode(mode);
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    const modal = $('.reader-auth-modal');
    if (modal) modal.hidden = true;
    document.body.style.overflow = '';
  }

  async function submitAuth(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const modal = ensureModal();
    const mode = modal.dataset.mode || 'signin';
    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;
    const displayName = form.elements.name.value.trim();
    setStatus(mode === 'signup' ? 'Creating account…' : 'Signing in…');
    try {
      if (mode === 'signup') {
        if (displayName.length < 2) throw new Error('Choose a display name of at least 2 characters.');
        const { data, error } = await client.auth.signUp({ email, password, options:{ data:{ display_name:displayName }, emailRedirectTo:location.href } });
        if (error) throw error;
        if (!data.session) {
          setStatus('Account created. Check your email to confirm it, then return and sign in.', 'success');
          return;
        }
        session = data.session;
      } else {
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        session = data.session;
      }
      await loadProfile();
      updateButton();
      renderModalState();
      if (mode === 'signin') closeModal();
    } catch (error) {
      setStatus(error?.message || 'Authentication failed.', 'error');
    }
  }

  async function refresh() {
    try { await loadProfile(); } catch (_) {}
    updateButton();
    window.dispatchEvent(new CustomEvent('neuralcritic:account-refreshed'));
  }

  async function init() {
    ensureModal();
    const { data:{ session:current } } = await client.auth.getSession();
    session = current;
    if (session?.user) { try { await loadProfile(); } catch (_) {} }
    await waitFor('.header-tools');
    updateButton();
    renderModalState();
    client.auth.onAuthStateChange(async (_event, next) => {
      session = next;
      profile = null;
      if (session?.user) { try { await loadProfile(); } catch (_) {} }
      await refresh();
      renderModalState();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();
})();
