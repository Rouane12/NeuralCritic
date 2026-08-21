(() => {
  const config = window.NEURAL_CRITIC_SUPABASE;
  if (!config || !window.supabase) return;

  const client = window.neuralCriticCommunitySupabase || window.neuralCriticPublicSupabase || window.supabase.createClient(config.url, config.publishableKey);
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const slug = new URLSearchParams(location.search).get('slug') || '';
  let recovering = false;
  let queued = false;
  let popularMode = false;
  let viewerId = null;

  const esc = (value = '') => String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

  function initials(name = 'Reader') {
    return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase() || '').join('') || 'R';
  }

  function timeText(iso) {
    try {
      return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
    } catch (_) {
      return '';
    }
  }

  function wasEdited(comment) {
    if (!comment.updated_at || !comment.created_at) return false;
    return Math.abs(new Date(comment.updated_at) - new Date(comment.created_at)) > 2500;
  }

  function avatarMarkup(profile) {
    const name = profile?.display_name || 'Reader';
    if (profile?.avatar_url) {
      return `<span class="community-avatar"><img src="${esc(profile.avatar_url)}" alt="${esc(name)}"></span>`;
    }
    return `<span class="community-avatar">${esc(initials(name))}</span>`;
  }

  function sortAscending() {
    return $('[data-thread-sort]')?.textContent?.trim().toUpperCase() === 'OLDEST';
  }

  function updateCount(total) {
    const count = $('[data-thread-count]');
    if (count) count.textContent = `${total} COMMENT${total === 1 ? '' : 'S'}`;
  }

  function requestSignIn() {
    $('.reader-account-button')?.click();
  }

  async function getViewer() {
    const { data } = await client.auth.getSession();
    viewerId = data?.session?.user?.id || null;
    return data?.session || null;
  }

  function ensureReportModal() {
    if ($('.community-report-modal')) return $('.community-report-modal');
    document.body.insertAdjacentHTML('beforeend', `
      <div class="community-report-modal" hidden>
        <section class="community-report-card" role="dialog" aria-modal="true" aria-labelledby="community-report-title">
          <button type="button" class="community-report-close" aria-label="Close">✕</button>
          <small>READER SAFETY</small>
          <h3 id="community-report-title">Report comment</h3>
          <p>Tell us what needs attention. Reports are private and visible to Neural Critic moderators.</p>
          <form class="community-report-form">
            <input type="hidden" name="comment_id">
            <label>REASON
              <select name="reason" required>
                <option value="spam">Spam</option>
                <option value="harassment">Harassment</option>
                <option value="hate">Hateful content</option>
                <option value="spoiler">Unmarked spoiler</option>
                <option value="off_topic">Off topic</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label>DETAILS <span>OPTIONAL</span>
              <textarea name="details" maxlength="500" rows="4" placeholder="Add context for the moderator…"></textarea>
            </label>
            <div class="community-report-status"></div>
            <button type="submit">SEND REPORT</button>
          </form>
        </section>
      </div>`);

    const modal = $('.community-report-modal');
    const close = () => { modal.hidden = true; document.body.style.overflow = ''; };
    $('.community-report-close', modal)?.addEventListener('click', close);
    modal.addEventListener('click', event => { if (event.target === modal) close(); });
    $('.community-report-form', modal)?.addEventListener('submit', async event => {
      event.preventDefault();
      if (!viewerId) { close(); requestSignIn(); return; }
      const form = event.currentTarget;
      const status = $('.community-report-status', form);
      const submit = $('button[type="submit"]', form);
      submit.disabled = true;
      submit.textContent = 'SENDING…';
      status.textContent = '';
      const payload = {
        comment_id: form.elements.comment_id.value,
        reporter_id: viewerId,
        reason: form.elements.reason.value,
        details: form.elements.details.value.trim()
      };
      const { error } = await client.from('comment_reports').insert(payload);
      submit.disabled = false;
      submit.textContent = 'SEND REPORT';
      if (error) {
        status.textContent = error.code === '23505' ? 'You already reported this comment.' : (error.message || 'Could not send report.');
        status.className = 'community-report-status error';
        return;
      }
      status.textContent = 'Report sent. Thank you.';
      status.className = 'community-report-status success';
      setTimeout(close, 850);
    });
    return modal;
  }

  function openReport(commentId) {
    if (!viewerId) { requestSignIn(); return; }
    const modal = ensureReportModal();
    const form = $('.community-report-form', modal);
    form.reset();
    form.elements.comment_id.value = commentId;
    $('.community-report-status', form).textContent = '';
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function renderComment(comment, profile, replies = [], reactionCount = 0) {
    const own = viewerId === comment.user_id;
    const edited = wasEdited(comment);
    const replyMarkup = replies.length
      ? `<div class="community-replies">${replies.map(reply => renderComment(reply, reply.profile || {display_name:'Reader',avatar_url:null}, [], reply.reactionCount || 0)).join('')}</div>`
      : '';
    return `<article class="community-comment${comment.parent_comment_id ? ' community-reply' : ''}" data-comment-id="${esc(comment.id)}" data-user-id="${esc(comment.user_id)}" data-parent-id="${esc(comment.parent_comment_id || '')}">
      <div class="community-comment-head">
        <div class="community-comment-user">${avatarMarkup(profile)}<div><strong>${esc(profile.display_name || 'Reader')}</strong><small>${esc(timeText(comment.created_at))}${edited ? ' · EDITED' : ''}</small></div></div>
        <div class="community-comment-menu">
          ${own ? '<button type="button" class="community-comment-edit">EDIT</button><button type="button" class="community-comment-delete">DELETE</button>' : '<button type="button" class="community-comment-report">REPORT</button>'}
        </div>
      </div>
      <p class="community-comment-body">${esc(comment.body)}</p>
      <div class="community-comment-native-actions">
        ${comment.parent_comment_id ? '' : '<button type="button" class="community-comment-reply">REPLY</button>'}
      </div>
      ${replyMarkup}
    </article>`;
  }

  function bindDelete(button) {
    button.addEventListener('click', async () => {
      const id = button.closest('[data-comment-id]')?.dataset.commentId;
      if (!id || !confirm('Delete this comment? Replies to it will also be removed.')) return;
      button.disabled = true;
      const { error } = await client.from('article_comments').delete().eq('id', id);
      if (error) {
        button.disabled = false;
        console.warn('Neural Critic comment delete failed.', error);
        return;
      }
      await recoverThread(true);
    });
  }

  function bindEdit(button) {
    button.addEventListener('click', () => {
      const comment = button.closest('.community-comment');
      const id = comment?.dataset.commentId;
      const body = $('.community-comment-body', comment);
      if (!comment || !id || !body || $('.community-inline-editor', comment)) return;
      const original = body.textContent || '';
      body.hidden = true;
      const editor = document.createElement('form');
      editor.className = 'community-inline-editor';
      editor.innerHTML = `<textarea maxlength="1200" rows="4">${esc(original)}</textarea><div><small>Editing your comment</small><button type="button" data-cancel>CANCEL</button><button type="submit">SAVE EDIT</button></div>`;
      body.after(editor);
      const textarea = $('textarea', editor);
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      $('[data-cancel]', editor)?.addEventListener('click', () => { editor.remove(); body.hidden = false; });
      editor.addEventListener('submit', async event => {
        event.preventDefault();
        const nextBody = textarea.value.trim();
        if (!nextBody || nextBody.length > 1200) return;
        const save = $('button[type="submit"]', editor);
        save.disabled = true;
        save.textContent = 'SAVING…';
        const { error } = await client.from('article_comments').update({ body: nextBody }).eq('id', id);
        if (error) {
          save.disabled = false;
          save.textContent = 'SAVE EDIT';
          return;
        }
        await recoverThread(true);
      });
    });
  }

  function bindReply(button) {
    button.addEventListener('click', () => {
      if (!viewerId) { requestSignIn(); return; }
      const comment = button.closest('.community-comment');
      const id = comment?.dataset.commentId;
      if (!comment || !id) return;
      const existing = $('.community-reply-form', comment);
      if (existing) { existing.remove(); return; }
      const form = document.createElement('form');
      form.className = 'community-reply-form';
      form.innerHTML = `<textarea maxlength="1200" rows="3" placeholder="Write a reply…"></textarea><div><small>Replying in this thread</small><button type="button" data-cancel>CANCEL</button><button type="submit">POST REPLY</button></div>`;
      const anchor = $('.community-comment-native-actions', comment);
      anchor.after(form);
      $('textarea', form).focus();
      $('[data-cancel]', form)?.addEventListener('click', () => form.remove());
      form.addEventListener('submit', async event => {
        event.preventDefault();
        const body = $('textarea', form).value.trim();
        if (!body) return;
        const submit = $('button[type="submit"]', form);
        submit.disabled = true;
        submit.textContent = 'POSTING…';
        const { error } = await client.from('article_comments').insert({ article_slug: slug, user_id: viewerId, body, parent_comment_id: id });
        if (error) {
          submit.disabled = false;
          submit.textContent = 'POST REPLY';
          return;
        }
        await recoverThread(true);
      });
    });
  }

  function bindThreadActions(list) {
    $$('.community-comment-delete', list).forEach(bindDelete);
    $$('.community-comment-edit', list).forEach(bindEdit);
    $$('.community-comment-reply', list).forEach(bindReply);
    $$('.community-comment-report', list).forEach(button => button.addEventListener('click', () => {
      const id = button.closest('[data-comment-id]')?.dataset.commentId;
      if (id) openReport(id);
    }));
  }

  function installPopularSort() {
    const sort = $('[data-thread-sort]');
    const parent = sort?.parentElement;
    if (!sort || !parent || $('[data-thread-popular]', parent)) return;
    const popular = document.createElement('button');
    popular.type = 'button';
    popular.dataset.threadPopular = '1';
    popular.textContent = 'POPULAR';
    parent.appendChild(popular);
    popular.addEventListener('click', event => {
      event.preventDefault();
      popularMode = !popularMode;
      popular.classList.toggle('active', popularMode);
      recoverThread(true);
    });
    sort.addEventListener('click', () => {
      popularMode = false;
      popular.classList.remove('active');
    });
  }

  async function recoverThread(force = false) {
    const list = $('[data-thread-list]');
    if (!list || !slug || recovering) return;

    const failed = list.textContent?.includes('Could not load the Reader Thread.') || list.textContent?.includes('temporarily unavailable');
    if (!force && !failed) return;

    recovering = true;
    list.innerHTML = '<div class="community-loading">Refreshing Reader Thread…</div>';

    try {
      await getViewer();
      installPopularSort();

      const { data: comments, error: commentsError } = await client
        .from('article_comments')
        .select('id,body,created_at,updated_at,user_id,parent_comment_id')
        .eq('article_slug', slug);

      if (commentsError) throw commentsError;

      const rows = comments || [];
      const userIds = [...new Set(rows.map(row => row.user_id).filter(Boolean))];
      const profiles = new Map();
      const reactionCounts = new Map();

      if (userIds.length) {
        const { data: profileRows, error: profilesError } = await client
          .from('reader_profiles')
          .select('user_id,display_name,avatar_url')
          .in('user_id', userIds);

        if (profilesError) console.warn('Neural Critic profile lookup failed; rendering reader fallbacks.', profilesError);
        else (profileRows || []).forEach(profile => profiles.set(profile.user_id, profile));
      }

      if (rows.length) {
        const { data: reactionRows } = await client
          .from('comment_reactions')
          .select('comment_id,reaction_type')
          .in('comment_id', rows.map(row => row.id));
        (reactionRows || []).forEach(row => {
          if (row.reaction_type === 'like') reactionCounts.set(row.comment_id, (reactionCounts.get(row.comment_id) || 0) + 1);
        });
      }

      rows.forEach(row => {
        row.profile = profiles.get(row.user_id) || { display_name: 'Reader', avatar_url: null };
        row.reactionCount = reactionCounts.get(row.id) || 0;
      });

      updateCount(rows.length);

      if (!rows.length) {
        list.innerHTML = '<div class="community-empty"><b>0</b><strong>Be the first voice</strong><small>No comments yet. Start the thread.</small></div>';
        return;
      }

      const topLevel = rows.filter(row => !row.parent_comment_id);
      const repliesByParent = new Map();
      rows.filter(row => row.parent_comment_id).forEach(reply => {
        const list = repliesByParent.get(reply.parent_comment_id) || [];
        list.push(reply);
        repliesByParent.set(reply.parent_comment_id, list);
      });
      repliesByParent.forEach(replies => replies.sort((a,b) => new Date(a.created_at) - new Date(b.created_at)));

      if (popularMode) {
        topLevel.sort((a,b) => (b.reactionCount - a.reactionCount) || (new Date(b.created_at) - new Date(a.created_at)));
      } else {
        topLevel.sort((a,b) => sortAscending()
          ? new Date(a.created_at) - new Date(b.created_at)
          : new Date(b.created_at) - new Date(a.created_at));
      }

      list.innerHTML = topLevel.map(comment => renderComment(
        comment,
        comment.profile,
        repliesByParent.get(comment.id) || [],
        comment.reactionCount
      )).join('');

      bindThreadActions(list);
      window.dispatchEvent(new CustomEvent('neuralcritic:thread-recovered'));
    } catch (error) {
      console.warn('Neural Critic Reader Thread recovery failed.', error);
      list.innerHTML = '<div class="community-empty"><small>Reader Thread is temporarily unavailable. Please try again.</small></div>';
    } finally {
      recovering = false;
    }
  }

  window.neuralCriticRecoverThread = () => recoverThread(true);

  function queueRecovery() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      recoverThread();
    });
  }

  function observeThread() {
    const list = $('[data-thread-list]');
    if (!list) {
      setTimeout(observeThread, 120);
      return;
    }

    const observer = new MutationObserver(queueRecovery);
    observer.observe(list, { childList: true, subtree: true, characterData: true });
    queueRecovery();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeThread, { once: true });
  } else {
    observeThread();
  }
})();
