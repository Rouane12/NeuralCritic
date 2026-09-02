(() => {
  'use strict';

  const config = window.NEURAL_CRITIC_SUPABASE;
  if (!config || !window.supabase) return;

  const client = window.neuralCriticCommunitySupabase
    || window.neuralCriticPublicSupabase
    || window.supabase.createClient(config.url, config.publishableKey);

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  let refreshQueued = false;
  let refreshing = false;

  function validSlug(value) {
    return /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(String(value || ''));
  }

  function currentSlug() {
    const staticSlug = String(window.NEURAL_CRITIC_STATIC_SLUG || '').trim();
    if (validSlug(staticSlug)) return staticSlug;

    const querySlug = new URLSearchParams(location.search).get('slug') || '';
    if (validSlug(querySlug)) return querySlug;

    const match = location.pathname.match(/\/stories\/([^/]+)\/?$/i);
    if (!match?.[1]) return '';
    try {
      const pathSlug = decodeURIComponent(match[1]);
      return validSlug(pathSlug) ? pathSlug : '';
    } catch (_) {
      return validSlug(match[1]) ? match[1] : '';
    }
  }

  async function viewer() {
    const { data } = await client.auth.getSession();
    return data?.session?.user || null;
  }

  function requestSignIn() {
    $('.reader-account-button')?.click();
  }

  function commentId(button) {
    return button.closest('.community-comment[data-comment-id]')?.dataset.commentId || '';
  }

  // Nested replies live inside their parent comment in the DOM. querySelector()
  // on a parent therefore sees reply controls before the parent's own controls.
  // Always scope actions to the element whose nearest comment is the comment
  // currently being processed.
  function belongsToComment(element, comment) {
    return !!element && element.closest('.community-comment[data-comment-id]') === comment;
  }

  function localOne(selector, comment) {
    return $$(selector, comment).find(element => belongsToComment(element, comment)) || null;
  }

  function localAll(selector, comment) {
    return $$(selector, comment).filter(element => belongsToComment(element, comment));
  }

  function permalink(id) {
    const canonical = $('link[rel="canonical"]')?.href || location.href;
    const url = new URL(canonical, location.href);
    url.hash = `comment-${id}`;
    return url.toString();
  }

  async function copyText(value) {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(value);
        return true;
      } catch (_) {}
    }

    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    let copied = false;
    try { copied = document.execCommand('copy'); } catch (_) {}
    textarea.remove();
    return copied;
  }

  function setCopyState(button, copied) {
    const label = $('span:not(.material-symbols-rounded)', button);
    const icon = $('.material-symbols-rounded', button);
    if (label) label.textContent = copied ? 'Copied' : 'Copy failed';
    if (icon) icon.textContent = copied ? 'check_circle' : 'error';
    window.setTimeout(() => {
      if (label) label.textContent = 'Copy';
      if (icon) icon.textContent = 'link';
    }, 1400);
  }

  async function refreshVotes() {
    if (refreshing) return;
    const comments = $$('#reader-thread .community-comment[data-comment-id]');
    if (!comments.length) return;

    const ids = [...new Set(comments.map(comment => comment.dataset.commentId).filter(Boolean))];
    if (!ids.length) return;

    refreshing = true;
    try {
      const [user, response] = await Promise.all([
        viewer(),
        client.from('comment_reactions').select('comment_id,user_id,reaction_type').in('comment_id', ids)
      ]);
      if (response.error) throw response.error;

      const likes = new Map();
      const dislikes = new Map();
      const mine = new Map();

      (response.data || []).forEach(row => {
        const target = row.reaction_type === 'dislike' ? dislikes : likes;
        target.set(row.comment_id, (target.get(row.comment_id) || 0) + 1);
        if (user?.id === row.user_id) mine.set(row.comment_id, row.reaction_type);
      });

      comments.forEach(comment => {
        const id = comment.dataset.commentId;
        const like = localOne('[data-vote="like"]', comment);
        const dislike = localOne('[data-vote="dislike"]', comment);
        if (like) {
          const count = $('.count', like);
          if (count) count.textContent = String(likes.get(id) || 0);
          like.classList.toggle('active', mine.get(id) === 'like');
          like.setAttribute('aria-pressed', mine.get(id) === 'like' ? 'true' : 'false');
        }
        if (dislike) {
          const count = $('.count', dislike);
          if (count) count.textContent = String(dislikes.get(id) || 0);
          dislike.classList.toggle('active', mine.get(id) === 'dislike');
          dislike.setAttribute('aria-pressed', mine.get(id) === 'dislike' ? 'true' : 'false');
        }
      });
    } catch (error) {
      console.warn('Neural Critic comment reactions could not refresh.', error);
    } finally {
      refreshing = false;
    }
  }

  function queueVoteRefresh(delay = 0) {
    if (refreshQueued) return;
    refreshQueued = true;
    window.setTimeout(async () => {
      refreshQueued = false;
      await refreshVotes();
    }, delay);
  }

  async function handleVote(button) {
    const id = commentId(button);
    const type = button.dataset.vote;
    if (!id || !['like', 'dislike'].includes(type)) return;

    const user = await viewer();
    if (!user) {
      requestSignIn();
      return;
    }

    const comment = button.closest('.community-comment[data-comment-id]');
    if (!comment) return;
    const voteButtons = localAll('[data-vote]', comment);
    voteButtons.forEach(item => { item.disabled = true; });

    try {
      const wasActive = button.classList.contains('active');
      const { error: deleteError } = await client
        .from('comment_reactions')
        .delete()
        .eq('comment_id', id)
        .eq('user_id', user.id);
      if (deleteError) throw deleteError;

      if (!wasActive) {
        const { error: insertError } = await client.from('comment_reactions').insert({
          comment_id: id,
          user_id: user.id,
          reaction_type: type
        });
        if (insertError) throw insertError;
      }

      await refreshVotes();
    } catch (error) {
      console.warn('Neural Critic comment vote failed.', error);
      button.title = 'Could not save reaction. Try again.';
      window.setTimeout(() => { button.removeAttribute('title'); }, 1800);
    } finally {
      voteButtons.forEach(item => { item.disabled = false; });
    }
  }

  function removeReplyForm(comment) {
    localOne('.community-reply-form[data-actions-v2="1"]', comment)?.remove();
  }

  async function openReply(button) {
    const comment = button.closest('.community-comment[data-comment-id]');
    const id = comment?.dataset.commentId || '';
    if (!comment || !id) return;

    const existing = localOne('.community-reply-form[data-actions-v2="1"]', comment);
    if (existing) {
      existing.remove();
      return;
    }

    const user = await viewer();
    if (!user) {
      requestSignIn();
      return;
    }

    const form = document.createElement('form');
    form.className = 'community-reply-form';
    form.dataset.actionsV2 = '1';
    form.innerHTML = '<textarea maxlength="1200" rows="3" placeholder="Write a reply…"></textarea><div><small data-reply-status>Replying in this thread</small><button type="button" data-cancel>CANCEL</button><button type="submit">POST REPLY</button></div>';

    const anchor = localOne('.community-comment-native-actions', comment) || localOne('.community-comment-footer', comment);
    if (anchor) anchor.after(form);
    else comment.appendChild(form);

    const textarea = $('textarea', form);
    textarea?.focus();
    $('[data-cancel]', form)?.addEventListener('click', () => form.remove());

    form.addEventListener('submit', async event => {
      event.preventDefault();
      const body = textarea?.value.trim() || '';
      if (!body) return;

      const slug = currentSlug();
      const status = $('[data-reply-status]', form);
      const submit = $('button[type="submit"]', form);
      if (!slug) {
        if (status) status.textContent = 'Could not identify this article. Refresh and try again.';
        return;
      }

      submit.disabled = true;
      submit.textContent = 'POSTING…';
      if (status) status.textContent = 'Posting reply…';

      try {
        const currentUser = await viewer();
        if (!currentUser) {
          form.remove();
          requestSignIn();
          return;
        }
        const { error } = await client.from('article_comments').insert({
          article_slug: slug,
          user_id: currentUser.id,
          body,
          parent_comment_id: id
        });
        if (error) throw error;
        form.remove();
        if (typeof window.neuralCriticRecoverThread === 'function') {
          await window.neuralCriticRecoverThread();
        }
        queueVoteRefresh(80);
      } catch (error) {
        console.warn('Neural Critic reply failed.', error);
        submit.disabled = false;
        submit.textContent = 'POST REPLY';
        if (status) status.textContent = error?.message || 'Could not post reply. Try again.';
      }
    });
  }

  document.addEventListener('click', async event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const vote = target.closest('#reader-thread .standard-vote[data-vote]');
    if (vote) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      await handleVote(vote);
      return;
    }

    const copy = target.closest('#reader-thread .standard-copy');
    if (copy) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const id = commentId(copy);
      if (!id) return;
      setCopyState(copy, await copyText(permalink(id)));
      return;
    }

    const reply = target.closest('#reader-thread .standard-reply, #reader-thread .community-comment-reply');
    if (reply) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      await openReply(reply);
    }
  }, true);

  function init() {
    queueVoteRefresh(120);
    window.addEventListener('neuralcritic:thread-recovered', () => queueVoteRefresh(80));
    window.addEventListener('neuralcritic:community-refreshed', () => queueVoteRefresh(80));

    const observer = new MutationObserver(records => {
      const relevant = records.some(record => [...record.addedNodes].some(node => {
        if (!(node instanceof Element)) return false;
        return node.matches?.('.community-comment,.standard-vote,.stable-votes')
          || !!node.querySelector?.('.community-comment,.standard-vote,.stable-votes');
      }));
      if (relevant) queueVoteRefresh(50);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.setTimeout(() => queueVoteRefresh(0), 650);
    window.setTimeout(() => queueVoteRefresh(0), 1500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
