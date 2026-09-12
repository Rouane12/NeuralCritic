(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  let queued = false;
  let observer = null;

  function classifyThread() {
    const thread = $('#reader-thread.article-thread.standard-thread') || $('#reader-thread.article-thread');
    if (!thread) return false;

    const list = $('[data-thread-list]', thread);
    if (!list) return false;

    const comments = list.querySelectorAll('.community-comment[data-comment-id]').length;
    const emptyState = $('.community-empty', list);
    const loading = $('.community-loading', list);
    const isEmpty = comments === 0 && !!emptyState?.querySelector('b');
    const unavailable = comments === 0 && !!emptyState && !isEmpty;
    const hasComments = comments > 0;

    thread.classList.toggle('thread-is-empty', isEmpty);
    thread.classList.toggle('thread-has-comments', hasComments);
    thread.classList.toggle('thread-is-loading', !!loading && !hasComments);
    thread.classList.toggle('thread-is-unavailable', unavailable);
    thread.dataset.threadState = hasComments ? 'comments' : isEmpty ? 'empty' : unavailable ? 'unavailable' : 'loading';

    const sort = $('.standard-sort-row', thread);
    if (sort) sort.hidden = !hasComments;

    return true;
  }

  function queueSync() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      classifyThread();
    });
  }

  function attachObserver() {
    const thread = $('#reader-thread.article-thread');
    if (!thread || observer) return false;
    observer = new MutationObserver(queueSync);
    observer.observe(thread, { childList: true, subtree: true, characterData: true });
    return true;
  }

  function init() {
    classifyThread();
    attachObserver();

    const bodyObserver = new MutationObserver(() => {
      if (attachObserver()) {
        classifyThread();
        bodyObserver.disconnect();
      }
    });
    if (!observer) bodyObserver.observe(document.body, { childList: true, subtree: true });

    window.addEventListener('neuralcritic:thread-recovered', queueSync);
    setTimeout(queueSync, 450);
    setTimeout(queueSync, 1200);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
