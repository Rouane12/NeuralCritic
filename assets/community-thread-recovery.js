(() => {
  const config = window.NEURAL_CRITIC_SUPABASE;
  if (!config || !window.supabase) return;

  const client = window.neuralCriticCommunitySupabase || window.neuralCriticPublicSupabase || window.supabase.createClient(config.url, config.publishableKey);
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const slug = new URLSearchParams(location.search).get('slug') || '';
  let recovering = false;
  let queued = false;

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

  function bindRecoveredDeletes(list) {
    $$('.community-comment-delete', list).forEach(button => {
      button.addEventListener('click', async () => {
        const id = button.closest('[data-comment-id]')?.dataset.commentId;
        if (!id) return;
        button.disabled = true;
        const { error } = await client.from('article_comments').delete().eq('id', id);
        if (error) {
          button.disabled = false;
          console.warn('Neural Critic comment delete failed.', error);
          return;
        }
        await recoverThread(true);
      });
    });
  }

  async function recoverThread(force = false) {
    const list = $('[data-thread-list]');
    if (!list || !slug || recovering) return;

    const failed = list.textContent?.includes('Could not load the Reader Thread.');
    if (!force && !failed) return;

    recovering = true;
    list.innerHTML = '<div class="community-loading">Refreshing Reader Thread…</div>';

    try {
      const { data: comments, error: commentsError } = await client
        .from('article_comments')
        .select('id,body,created_at,user_id')
        .eq('article_slug', slug)
        .order('created_at', { ascending: sortAscending() });

      if (commentsError) throw commentsError;

      const rows = comments || [];
      const userIds = [...new Set(rows.map(row => row.user_id).filter(Boolean))];
      const profiles = new Map();

      if (userIds.length) {
        const { data: profileRows, error: profilesError } = await client
          .from('reader_profiles')
          .select('user_id,display_name,avatar_url')
          .in('user_id', userIds);

        if (profilesError) {
          console.warn('Neural Critic profile lookup failed; rendering reader fallbacks.', profilesError);
        } else {
          (profileRows || []).forEach(profile => profiles.set(profile.user_id, profile));
        }
      }

      updateCount(rows.length);

      if (!rows.length) {
        list.innerHTML = '<div class="community-empty"><b>0</b><strong>Be the first voice</strong><small>No comments yet. Start the thread.</small></div>';
        return;
      }

      const { data: authData } = await client.auth.getSession();
      const viewerId = authData?.session?.user?.id || null;

      list.innerHTML = rows.map(comment => {
        const profile = profiles.get(comment.user_id) || { display_name: 'Reader', avatar_url: null };
        const own = viewerId === comment.user_id;
        return `<article class="community-comment" data-comment-id="${esc(comment.id)}">
          <div class="community-comment-head">
            <div class="community-comment-user">${avatarMarkup(profile)}<div><strong>${esc(profile.display_name || 'Reader')}</strong><small>${esc(timeText(comment.created_at))}</small></div></div>
            ${own ? '<button type="button" class="community-comment-delete">DELETE</button>' : ''}
          </div>
          <p class="community-comment-body">${esc(comment.body)}</p>
        </article>`;
      }).join('');

      bindRecoveredDeletes(list);
      window.dispatchEvent(new CustomEvent('neuralcritic:thread-recovered'));
    } catch (error) {
      console.warn('Neural Critic Reader Thread recovery failed.', error);
      list.innerHTML = '<div class="community-empty"><small>Reader Thread is temporarily unavailable. Please try again.</small></div>';
    } finally {
      recovering = false;
    }
  }

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
