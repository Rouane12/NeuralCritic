(() => {
  const $ = (s, root=document) => root.querySelector(s);

  function polishThreadCopy() {
    const thread = $('#reader-thread');
    if (!thread || thread.dataset.mainstreamCopy === '1') return;
    thread.dataset.mainstreamCopy = '1';

    const eyebrow = $('.thread-head>div:first-child>span', thread);
    const title = $('.thread-head h2', thread);
    const identityLabel = $('.thread-identity span', thread);
    const prompt = $('.thread-prompt', thread);
    const textarea = $('form[data-thread-form] textarea', thread);
    const submit = $('form[data-thread-form] button[type="submit"]', thread);

    if (eyebrow) eyebrow.textContent = 'COMMENTS';
    if (title) title.textContent = 'Join the discussion';
    if (identityLabel) identityLabel.textContent = 'Commenting as';
    if (prompt) prompt.textContent = 'Share your take with the Neural Critic community.';
    if (textarea) textarea.placeholder = 'Add a comment…';
    if (submit) submit.textContent = 'POST COMMENT';
  }

  function observe() {
    polishThreadCopy();
    const observer = new MutationObserver(() => polishThreadCopy());
    observer.observe(document.body, {childList:true, subtree:true});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observe, {once:true});
  else observe();
})();
