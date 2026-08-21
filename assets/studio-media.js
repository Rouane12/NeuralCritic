(() => {
  const BUCKET = 'editorial';
  const MAX_BYTES = 10 * 1024 * 1024;
  const ALLOWED = new Set(['image/jpeg','image/png','image/webp','image/avif','image/gif']);
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];

  function toast(message, error=false) {
    const el = $('#studio-toast');
    if (!el) return;
    el.textContent = message;
    el.classList.toggle('error', error);
    el.classList.add('show');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('show'), 3200);
  }

  function safeName(name='image') {
    const dot = name.lastIndexOf('.');
    const base = (dot > 0 ? name.slice(0, dot) : name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 70) || 'image';
    const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g,'') : '';
    return ext ? `${base}.${ext}` : base;
  }

  async function uploadFile(file, target, status) {
    const client = window.neuralCriticSupabase;
    if (!client) throw new Error('The CMS connection is not ready yet.');
    if (!ALLOWED.has(file.type)) throw new Error('Use JPG, PNG, WEBP, AVIF, or GIF images.');
    if (file.size > MAX_BYTES) throw new Error('Images must be 10 MB or smaller.');

    const { data: { user } } = await client.auth.getUser();
    if (!user) throw new Error('Sign in to Editorial Studio before uploading media.');

    const filename = safeName(file.name);
    const path = `${user.id}/${Date.now()}-${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}-${filename}`;
    status.textContent = 'UPLOADING…';
    status.dataset.state = 'busy';

    const { data, error } = await client.storage.from(BUCKET).upload(path, file, {
      cacheControl: '31536000',
      contentType: file.type,
      upsert: false,
    });
    if (error) throw error;

    const { data: publicData } = client.storage.from(BUCKET).getPublicUrl(data.path);
    const url = publicData?.publicUrl;
    if (!url) throw new Error('Upload succeeded but no public media URL was returned.');

    target.value = url;
    target.dispatchEvent(new Event('input', { bubbles: true }));
    target.dispatchEvent(new Event('change', { bubbles: true }));
    status.textContent = 'UPLOADED ✓';
    status.dataset.state = 'done';
    toast('Image uploaded to Neural Critic media storage.');
    return url;
  }

  function decorate(target, label='UPLOAD IMAGE') {
    if (!target || target.dataset.mediaUploadReady) return;
    target.dataset.mediaUploadReady = '1';

    const wrap = document.createElement('div');
    wrap.className = 'studio-media-upload';
    wrap.innerHTML = `
      <input class="studio-media-file" type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/gif" hidden>
      <button class="studio-media-button" type="button">${label}</button>
      <span class="studio-media-status">OR PASTE A URL</span>`;
    target.insertAdjacentElement('afterend', wrap);

    const fileInput = $('.studio-media-file', wrap);
    const button = $('.studio-media-button', wrap);
    const status = $('.studio-media-status', wrap);

    button.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      button.disabled = true;
      try {
        await uploadFile(file, target, status);
      } catch (error) {
        status.textContent = 'UPLOAD FAILED';
        status.dataset.state = 'error';
        toast(error?.message || 'Image upload failed.', true);
      } finally {
        button.disabled = false;
        fileInput.value = '';
      }
    });
  }

  function decorateAll() {
    decorate($('#featured-image'), 'UPLOAD FEATURED IMAGE');
    decorate($('#profile-image'), 'UPLOAD PROFILE IMAGE');
    $$('input[data-field="imageLocal"]').forEach(input => decorate(input, 'UPLOAD SECTION IMAGE'));
  }

  function init() {
    decorateAll();
    const sections = $('#sections-list');
    if (sections) {
      new MutationObserver(decorateAll).observe(sections, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
