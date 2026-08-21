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
  let decorationQueued = false;

  const AVATAR_BUCKET = 'reader-avatars';
  const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
  const AVATAR_TYPES = new Set(['image/jpeg','image/png','image/webp','image/avif']);

  function esc(v='') { return String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function timeout(promise, ms=3000) {
    let timer;
    const fail = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Community request timed out')), ms); });
    return Promise.race([Promise.resolve(promise), fail]).finally(() => clearTimeout(timer));
  }
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
    try {
      const {data:{session:next}} = await timeout(client.auth.getSession());
      session = next;
      profile = null;
      isAdmin = false;
      if (!session?.user) return;
      const [profileResult, editorResult] = await timeout(Promise.all([
        client.from('reader_profiles').select('user_id,display_name,avatar_url').eq('user_id', session.user.id).maybeSingle(),
        client.from('editor_profiles').select('role').eq('user_id', session.user.id).maybeSingle()
      ]));
      profile = profileResult?.data || null;
      isAdmin = editorResult?.data?.role === 'admin';
    } catch (error) {
      console.warn('Neural Critic reader profile load skipped.', error);
    }
  }

  function avatarPreviewUrl() {
    return profile?.avatar_url || 'images/editorial/499627ae-e4d1-40d6-be0d-45efc750a1d9.jpg';
  }

  function updateAccountVisual() {
    const button = $('.reader-account-button');
    if (!button) return;
    const dot = $('.reader-account-dot', button);
    const label = $('[data-reader-account-label]', button);
    if (label) label.textContent = session ? (profile?.display_name || 'ACCOUNT') : 'SIGN IN';
    if (!dot) return;
    if (session?.user) {
      dot.classList.add('reader-account-avatar');
      dot.style.backgroundImage = `url("${avatarPreviewUrl().replace(/"/g,'\\"')}")`;
    } else {
      dot.classList.remove('reader-account-avatar');
      dot.style.backgroundImage = '';
    }
  }

  function ensureProfileEditor(force=false) {
    const card = $('.reader-auth-card');
    if (!card) return;
    let editor = $('.reader-profile-editor', card);
    if (!session?.user) {
      editor?.remove();
      return;
    }
    if (editor && !force) return;
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

    $('.reader-profile-upload', editor)?.addEventListener('click', () => $('.reader-profile-file', editor)?.click());
    $('.reader-profile-file', editor)?.addEventListener('change', async event => {
      const file = event.target.files?.[0];
      if (!file) return;
      const button = $('.reader-profile-upload', editor);
      try {
        if (!AVATAR_TYPES.has(file.type)) throw new Error('Use JPG, PNG, WEBP, or AVIF for your avatar.');
        if (file.size > MAX_AVATAR_BYTES) throw new Error('Avatar must be 5 MB or smaller.');
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g,'');
        const path = `${session.user.id}/${Date.now()}-${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}.${ext}`;
        if (button) { button.disabled = true; button.textContent = 'UPLOADING…'; }
        const {data,error} = await timeout(client.storage.from(AVATAR_BUCKET).upload(path, file, {cacheControl:'31536000',contentType:file.type,upsert:false}), 8000);
        if (error) throw error;
        const {data:publicData} = client.storage.from(AVATAR_BUCKET).getPublicUrl(data.path);
        const url = publicData?.publicUrl;
        if (!url) throw new Error('Avatar uploaded, but no public URL was returned.');
        const {error:updateError} = await timeout(client.from('reader_profiles').update({avatar_url:url}).eq('user_id',session.user.id));
        if (updateError) throw updateError;
        profile = {...(profile || {}), avatar_url:url};
        updateAccountVisual();
        ensureProfileEditor(true);
        toast('Reader avatar updated.');
      } catch (error) {
        toast(error?.message || 'Avatar upload failed.', true);
      } finally {
        if (button) { button.disabled = false; button.textContent = 'UPLOAD AVATAR'; }
        event.target.value = '';
      }
    });
    $('.reader-profile-save', editor)?.addEventListener('click', async () => {
      try {
        const name = $('.reader-profile-name', editor).value.trim();
        if (name.length < 2 || name.length > 40) throw new Error('Display name must be 2–40 characters.');
        const {error} = await timeout(client.from('reader_profiles').update({display_name:name}).eq('user_id',session.user.id));
        if (error) throw error;
        await timeout(client.auth.updateUser({data:{display_name:name}}));
        profile = {...(profile || {}), display_name:name};
        $$('[data-reader-name]').forEach(el => el.textContent = name);
        updateAccountVisual();
        ensureProfileEditor(true);
        toast('Reader profile saved.');
      } catch (error) { toast(error?.message || 'Could not save profile.', true); }
    });
  }

  function bindCommentLike(button, id) {
    if (button.dataset.bound === '1') return;
    button.dataset.bound = '1';
    button.addEventListener('click', async () => {
      if (!session?.user) { requestSignIn(); return; }
      button.disabled = true;
      try {
        if (button.classList.contains('active')) {
          await timeout(client.from('comment_reactions').delete().eq('comment_id',id).eq('user_id',session.user.id).eq('reaction_type','like'));
        } else {
          await timeout(client.from('comment_reactions').insert({comment_id:id,user_id:session.user.id,reaction_type:'like'}));
        }
        await refreshCommentDecorations();
      } catch (error) {
        toast('Could not update that reaction.', true);
      } finally { button.disabled = false; }
    });
  }

  function ensureAdminModeration(comment, id) {
    if (!isAdmin || $('.community-comment-delete', comment) || $('.community-admin-remove', comment)) return;
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

  async function refreshCommentDecorations() {
    if (decorating) return;
    const comments = $$('.community-comment[data-comment-id]');
    if (!comments.length) return;
    decorating = true;
    try {
      const ids = comments.map(x => x.dataset.commentId).filter(Boolean);
      const {data,error} = await timeout(client.from('comment_reactions').select('comment_id,user_id,reaction_type').in('comment_id', ids));
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
        let like = $('.community-comment-like', footer);
        if (!like) {
          like = document.createElement('button');
          like.type = 'button';
          like.className = 'community-comment-like';
          like.innerHTML = '<span>♥</span><b>0</b><small>LIKE</small>';
          footer.appendChild(like);
        }
        like.classList.toggle('active', mine.has(id));
        const number = $('b', like); if (number) number.textContent = String(counts.get(id) || 0);
        bindCommentLike(like, id);
        ensureAdminModeration(comment, id);
      });
    } catch (error) {
      console.warn('Neural Critic comment reaction polish skipped.', error);
    } finally { decorating = false; }
  }

  function queueDecorations() {
    if (decorationQueued) return;
    decorationQueued = true;
    requestAnimationFrame(async () => {
      decorationQueued = false;
      updateAccountVisual();
      ensureProfileEditor();
      await refreshCommentDecorations();
    });
  }

  function nodeNeedsCommunityWork(node) {
    if (!(node instanceof Element)) return false;
    return node.matches('.community-comment,.reader-auth-card,.reader-account-button') ||
      !!node.querySelector?.('.community-comment,.reader-auth-card,.reader-account-button');
  }

  function watchCommunity() {
    const observer = new MutationObserver(mutations => {
      if (mutations.some(m => [...m.addedNodes].some(nodeNeedsCommunityWork))) queueDecorations();
    });
    observer.observe(document.body, {childList:true, subtree:true});
  }

  async function init() {
    await loadViewer();
    updateAccountVisual();
    ensureProfileEditor();
    await refreshCommentDecorations();
    watchCommunity();
    client.auth.onAuthStateChange(async () => {
      await loadViewer();
      queueDecorations();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
