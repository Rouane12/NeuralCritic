(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const cfg = window.NEURAL_CRITIC_SUPABASE;
  const client = cfg && window.supabase ? window.supabase.createClient(cfg.url, cfg.publishableKey) : null;
  let reviewRefreshTimer = null;

  function showToast(message, error = false) {
    const el = $('#newsroom-toast');
    if (!el) return;
    el.textContent = message;
    el.classList.toggle('error', error);
    el.classList.add('show');
    clearTimeout(el._guardTimer);
    el._guardTimer = setTimeout(() => el.classList.remove('show'), 2800);
  }

  function readyWouldBeInvalid() {
    return $('#workflow-state')?.value === 'ready' && !!$('.newsroom-health-item.block');
  }

  document.addEventListener('click', event => {
    const action = event.target instanceof Element ? event.target.closest('#save-workflow,#mark-reviewed') : null;
    if (!action || !readyWouldBeInvalid()) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    showToast('Resolve the publication blockers before marking this story READY.', true);
    $('.newsroom-health-panel')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
  }, true);

  async function refreshReviewedChip() {
    clearTimeout(reviewRefreshTimer);
    reviewRefreshTimer = setTimeout(async () => {
      const active = $('.newsroom-story.active[data-story-id]');
      const chips = $('.newsroom-detail-chips');
      if (!active || !chips || !client) return;
      chips.querySelector('[data-reviewed-chip]')?.remove();
      try {
        const { data, error } = await client
          .from('editorial_workflow')
          .select('reviewed_at')
          .eq('article_id', active.dataset.storyId)
          .maybeSingle();
        if (error || !data?.reviewed_at) return;
        const reviewed = new Date(data.reviewed_at);
        if (Number.isNaN(reviewed.getTime())) return;
        const chip = document.createElement('span');
        chip.dataset.reviewedChip = '1';
        chip.textContent = `REVIEWED ${new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(reviewed)}`;
        chips.appendChild(chip);
      } catch (_) {}
    }, 120);
  }

  const detail = $('#newsroom-detail');
  if (detail) new MutationObserver(refreshReviewedChip).observe(detail, { childList: true, subtree: true });
  $('#newsroom-queue')?.addEventListener('click', () => setTimeout(refreshReviewedChip, 80));
  refreshReviewedChip();
})();
