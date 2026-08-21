(() => {
  const config = window.NEURAL_CRITIC_SUPABASE;
  if (!config || !window.supabase) return;

  const client = window.neuralCriticCommunitySupabase || window.neuralCriticPublicSupabase || window.supabase.createClient(config.url, config.publishableKey);
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  let session = null;
  let profile = null;
  let isAdmin = false;
  let decorating = false;

  const AVATAR_BUCKET = 'reader-avatars';
  const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
  const AVATAR_TYPES = new Set(['image/jpeg','image/png','image/webp','image/avif']);

  function esc(v='') { return String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function toast(message, error=false) {
    let el = $('.community-toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'community-toast';
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.toggle('error', error);
    el.classList.add('show');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('show'), 2800);
  }
  function requestSignIn() { $('.reader-account-button')?.click(); }

  async function loadViewer() {
    const {data:{session:next}} = await client.auth.getSession();
    session = next;
    profile = null;
    isAdmin = false;
    if (!session?.user) return;
    const [{data:p}, {data:editor}] = await Promise.all([
      client.from('reader_profiles').select('user_id,display_name,avatar_url').eq('user_id', session.user.id).maybeSingle(),
      client.from('editor_profiles').select('role').eq('user_id', session.user.id).maybeSingle()
    ]);
    profile = p || null;
    isAdmin = editor?.role === 'admin';
  }

  function avatarPreviewUrl() {
    return profile?.avatar_url || 'images/editorial/499627ae-e4d1-40d6-be0d-45efc750a1d9.jpg';
  }

  function updateAccountVisual() {
    const button = $('.reader-account-button');
    if (!button) return;
    const dot = $('.reader-account-dot', button);
    const label = $('[data-reader-account-label]', button);
    if (label && session) label.textContent = profile?.display_name || 'ACCOUNT';
    if (!dot) return;
    if (session?.user) {
      dot.classList.add('reader-account-avatar');
      dot.style.backgroundImage = `url("${avatarPreviewUrl().replace(/"/g,'\\"')}")`;
    } else {
      dot.classList.remove('reader-account-avatar');
      dot.style.backgroundImage = '';
    }
  }

  function ensureProfileEditor() {
    const card = $('.reader-auth-card');
    if (!card) return;
    let editor = $('.reader-profile-editor', card);
    if (!session?.user) {
      editor?.remove();
      return;
    }
    if (!editor) {
      editor = document.createElement('section');
      editor.className = 'reader-profile-editor';
      const signout = $('.reader-auth-signout', card);
      card.insertBefore(editor, signout || null);
    }
    editor.innerHTML = `
      <div class="reader-profile-head">
        <img class="reader-profile-avatar" src="${esc(avatarPreviewUrl())}" alt="Reader avatar">
        <div><small>READER PROFILE</small><strong>${esc(profile?.display_name || 'Reader')}</strong><span>${isAdmin ? 'Neural Critic admin · Reader' : 'Neural Critic reader'}</span></div>
      </div>
      <label>DISPLAY NAME<input class="reader-profile-name" maxlength="40" value="${esc(profile?.display_name || 'Reader')}"></label>
      <div class="reader-profile-avatar-actions">
        <input class="reader-profile-file" type="file" accept="image/jpeg,image/png,image/webp,image/avif" hidden>
        <button type="button" class="reader-profile-upload">UPLOAD AVATAR</button>
        <span>JPG, PNG, WEBP or AVIF · max 5 MB</span>
      </div>
      <button type="button" class="reader-profile-save">SAVE PROFILE</button>`;

    $('.reader-profile-upload', editor).addEventListener('click', () => $('.reader-profile-file', editor).click());
    $('.reader-profile-file', editor).addEventListener('change', async event => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        if (!AVATAR_TYPES.has(file.type)) throw new Error('Use JPG, PNG, WEBP, or AVIF for your avatar.');
        if (file.size > MAX_AVATAR_BYTES) throw new Error('Avatar must be 5 MB or smaller.');
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g,'');
        const path = `${session.user.id}/${Date.now()}-${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}.${ext}`;
        const button = $('.reader-profile-upload', editor);
        button.disabled = true; button.textContent = 'UPLOADING…';
        const {data,error} = await client.storage.from(AVATAR_BUCKET).upload(path, file, {cacheControl:'31536000',contentType:file.type,upsert:false});
        if (error) throw error;
        const {data:publicData} = client.storage.from(AVATAR_BUCKET).getPublicUrl(data.path);
        const url = publicData?.publicUrl;
        if (!url) throw new Error('Avatar uploaded, but no public URL was returned.');
        const {error:updateError} = await client.from('reader_profiles').update({avatar_url:url}).eq('user_id',session.user.id);
        if (updateError) throw updateError;
        profile = {...(profile || {}), avatar_url:url};
        $('.reader-profile-avatar', editor).src = url;
        updateAccountVisual();
        toast('Reader avatar updated.');
        button.disabled = false; button.textContent = 'UPLOAD AVATAR';
      } catch (error) {
        const button = $('.reader-profile-upload', editor);
        if (button) { button.disabled = false; button.textContent = 'UPLOAD AVATAR'; }
        toast(error?.message || 'Avatar upload failed.', true);
      }
      event.target.value = '';
    });
    $('.reader-profile-save', editor).addEventListener('click', async () => {
      try {
        const name = $('.reader-profile-name', editor).value.trim();
        if (name.length < 2 || name.length > 40) throw new Error('Display name must be 2–40 characters.');
        const {error} = await client.from('reader_profiles').update({display_name:name}).eq('user_id',session.user.id);
        if (error) throw error;
        await client.auth.updateUser({data:{display_name:name}});
        profile = {...(profile || {}), display_name:name};
        $$('[data-reader-name]').forEach(el => el.textContent = name);
        $('.reader-profile-head strong', editor).textContent = name;
        updateAccountVisual();
        toast('Reader profile saved.');
      } catch (error) { toast(error?.message || 'Could not save profile.', true); }
    });
  }

  async function refreshCommentDecorations() {
    if (decorating) return;
    const comments = $$('.community-comment[data-comment-id]');
    if (!comments.length) return;
    decorating = true;
    try {
      const ids = comments.map(x => x.dataset.commentId).filter(Boolean);
      const {data,error} = await client.from('comment_reactions').select('comment_id,user_id,reaction_type').in('comment_id', ids);
      if (error) throw error;
      const rows = data || [];
      const counts = new Map();
      const mine = new Set();
      rows.forEach(row => {
        counts.set(row.comment_id, (counts.get(row.comment_id) || 0) + 1);
        if (session?.user?.id === row.user_id) mine.add(row.comment_id);
      });

      comments.forEach(comment => {
        const id = comment.dataset.commentId;
        let footer = $('.community-comment-footer', comment);
        if (!footer) {
          footer = document.createElement('div');
          footer.className = 'community-comment-footer';
          comment.appendChild(footer);
        }
        const liked = mine.has(id);
        footer.innerHTML = `<button type="button" class="community-comment-like ${liked ? 'active' : ''}"><span>♥</span><b>${counts.get(id) || 0}</b><small>LIKE</small></button>`;
        const like = $('.community-comment-like', footer);
        like.addEventListener('click', async () => {
          if (!session?.user) { requestSignIn(); return; }
          like.disabled = true;
          if (like.classList.contains('active')) {
            await client.from('comment_reactions').delete().eq('comment_id',id).eq('user_id',session.user.id).eq('reaction_type','like');
          } else {
            await client.from('comment_reactions').insert({comment_id:id,user_id:session.user.id,reaction_type:'like'});
          }
          like.disabled = false;
          refreshCommentDecorations();
        });

        if (isAdmin && !$('.community-comment-delete', comment) && !$('.community-admin-remove', comment)) {
          const head = $('.community-comment-head', comment);
          const remove = document.createElement('button');
          remove.type = 'button';
          remove.className = 'community-admin-remove';
          remove.textContent = 'MODERATE';
          remove.title = 'Remove this comment as Neural Critic admin';
          remove.addEventListener('click', async () => {
            if (!confirm('Remove this comment from the Reader Thread?')) return;
            const {error} = await client.from('article_comments').delete().eq('id',id);
            if (error) { toast(error.message, true); return; }
            comment.remove();
            const remaining = $$('.community-comment[data-comment-id]').length;
            const count = $('[data-thread-count]');
            if (count) count.textContent = `${remaining} COMMENT${remaining === 1 ? '' : 'S'}`;
            toast('Comment removed.');
          });
          head?.appendChild(remove);
        }
      });
    } catch (error) {
      console.warn('Neural Critic comment reaction polish failed.', error);
    } finally { decorating = false; }
  }

  function watchCommunity() {
    const observer = new MutationObserver(() => {
      ensureProfileEditor();
      updateAccountVisual();
      refreshCommentDecorations();
    });
    observer.observe(document.body, {childList:true, subtree:true});
  }

  async function init() {
    await loadViewer();
    ensureProfileEditor();
    updateAccountVisual();
    refreshCommentDecorations();
    watchCommunity();
    client.auth.onAuthStateChange(async () => {
      await loadViewer();
      ensureProfileEditor();
      updateAccountVisual();
      setTimeout(refreshCommentDecorations, 50);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
