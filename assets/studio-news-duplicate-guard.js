(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const normalize = value => String(value || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const STOP = new Set(['the','a','an','and','or','of','to','in','on','for','with','as','at','by','from','is','are','was','were','this','that','its','it']);
  let lastSignature = '';
  let checking = false;
  let lastCategory = '';
  let lastNewsState = null;
  let attentionTimer = null;

  function tokens(value) {
    return new Set(normalize(value).split(' ').filter(token => token.length > 2 && !STOP.has(token)));
  }

  function overlap(a, b) {
    const left = tokens(a);
    const right = tokens(b);
    if (!left.size || !right.size) return 0;
    let shared = 0;
    left.forEach(token => { if (right.has(token)) shared += 1; });
    return shared / Math.max(1, Math.min(left.size, right.size));
  }

  function escapeHtml(value = '') {
    return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }

  function categoryValue() {
    return String($('#category')?.value || '').trim().toUpperCase();
  }

  function applyNewsTrustState({ attention = false, scroll = false } = {}) {
    const panel = $('#studio-news-panel');
    if (!panel) return;
    const isNews = categoryValue() === 'NEWS';

    panel.hidden = !isNews;
    document.body.classList.toggle('studio-editing-news', isNews);

    const cue = $('#studio-news-cue');
    if (cue) cue.hidden = !isNews;

    if (isNews && attention) {
      panel.classList.remove('studio-news-attention');
      requestAnimationFrame(() => panel.classList.add('studio-news-attention'));
      clearTimeout(attentionTimer);
      attentionTimer = setTimeout(() => panel.classList.remove('studio-news-attention'), 950);
    }

    if (isNews && scroll) {
      requestAnimationFrame(() => panel.scrollIntoView({
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start'
      }));
    }

    if (lastNewsState !== isNews) {
      window.dispatchEvent(new CustomEvent('neuralcritic:studio-news-state', {
        detail: { active: isNews, category: categoryValue() }
      }));
      lastNewsState = isNews;
    }
  }

  function isEditorialDeskSelect(target) {
    if (!(target instanceof HTMLSelectElement)) return false;
    const label = target.closest('label');
    return Boolean(label && /EDITORIAL\s+DESK/i.test(label.textContent || ''));
  }

  function syncEditorialDesk(target) {
    if (!isEditorialDeskSelect(target)) return false;
    const value = String(target.value || '').trim().toUpperCase();
    const category = $('#category');
    if (!category || !['NEWS','FEATURE','GUIDE','REVIEW'].includes(value)) return false;
    if (category.value !== value) category.value = value;
    return true;
  }

  function handleNewsStateEvent(event) {
    const target = event.target;
    if (!target) return;
    const categoryChanged = target.matches?.('#category');
    const deskChanged = syncEditorialDesk(target);
    if (!categoryChanged && !deskChanged) return;

    const current = categoryValue();
    const enteringNews = current === 'NEWS' && lastCategory !== 'NEWS';
    lastCategory = current;
    applyNewsTrustState({ attention: enteringNews, scroll: enteringNews && event.isTrusted });

    if (deskChanged && !categoryChanged) {
      $('#category')?.dispatchEvent(new Event('change', { bubbles: true }));
    }

    setTimeout(() => checkDuplicates(true), 100);
  }

  function monitorNewsState() {
    lastCategory = categoryValue();
    applyNewsTrustState();

    // Studio modules occasionally update select.value programmatically. Those
    // changes do not emit change/input, so keep one tiny state watcher alive.
    setInterval(() => {
      const current = categoryValue();
      if (current === lastCategory) return;
      const enteringNews = current === 'NEWS' && lastCategory !== 'NEWS';
      lastCategory = current;
      applyNewsTrustState({ attention: enteringNews, scroll: false });
      setTimeout(() => checkDuplicates(true), 100);
    }, 180);
  }

  function ensureNotice() {
    const panel = $('#studio-news-panel');
    if (!panel) return null;
    let notice = $('#studio-news-duplicate-guard');
    if (notice) return notice;
    notice = document.createElement('div');
    notice.id = 'studio-news-duplicate-guard';
    notice.className = 'studio-news-duplicate-guard';
    notice.hidden = true;
    const guidance = $('.studio-news-guidance', panel);
    if (guidance) guidance.insertAdjacentElement('afterend', notice);
    else panel.appendChild(notice);
    notice.addEventListener('click', event => {
      const button = event.target.closest('[data-open-existing-news]');
      if (!button) return;
      const slug = button.dataset.openExistingNews || '';
      const edit = [...document.querySelectorAll('[data-edit]')].find(node => node.dataset.edit === slug);
      if (edit) {
        edit.click();
        document.querySelector('#article-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        const library = $('#story-library');
        library?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
    return notice;
  }

  function hideNotice() {
    const notice = ensureNotice();
    if (!notice) return;
    notice.hidden = true;
    notice.innerHTML = '';
    document.body.classList.remove('studio-news-duplicate-risk');
  }

  function showNotice(match) {
    const notice = ensureNotice();
    if (!notice) return;
    const published = match.published_at ? new Intl.DateTimeFormat('en-GB', { day:'2-digit', month:'short', year:'numeric' }).format(new Date(match.published_at)) : 'recently';
    notice.innerHTML = `<div><small>POSSIBLE EXISTING STORY</small><strong>${escapeHtml(match.title || 'Existing news story')}</strong><p>A closely related NEWS story about <b>${escapeHtml(match.game_key || 'this topic')}</b> was published ${escapeHtml(published)}. If this is the same developing event, update the existing canonical story instead of creating another one.</p></div><button type="button" data-open-existing-news="${escapeHtml(match.slug || '')}">OPEN EXISTING STORY →</button>`;
    notice.hidden = false;
    document.body.classList.add('studio-news-duplicate-risk');
  }

  async function waitForClient(limit = 50) {
    for (let i = 0; i < limit; i += 1) {
      if (window.neuralCriticSupabase) return window.neuralCriticSupabase;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return null;
  }

  async function checkDuplicates(force = false) {
    if (checking) return;
    if (categoryValue() !== 'NEWS') {
      hideNotice();
      return;
    }

    const title = $('#title')?.value?.trim() || '';
    const gameKey = $('#game-graph-game')?.value?.trim() || '';
    const currentSlug = $('#slug')?.value?.trim() || '';
    if (title.length < 12) {
      hideNotice();
      return;
    }

    const signature = `${normalize(title)}|${normalize(gameKey)}|${currentSlug}`;
    if (!force && signature === lastSignature) return;
    lastSignature = signature;
    checking = true;

    try {
      const client = await waitForClient();
      if (!client) return;
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      let query = client.from('articles')
        .select('slug,title,game_key,news_meta,published_at,status,category')
        .eq('status', 'published')
        .eq('category', 'NEWS')
        .gte('published_at', since)
        .order('published_at', { ascending: false })
        .limit(20);
      if (gameKey) query = query.eq('game_key', gameKey);
      const { data, error } = await query;
      if (error) throw error;
      const rows = (Array.isArray(data) ? data : []).filter(row => row.slug && row.slug !== currentSlug);
      const ranked = rows.map(row => {
        const titleOverlap = overlap(title, row.title || '');
        const sameGame = gameKey && normalize(row.game_key) === normalize(gameKey);
        const developing = Boolean(row.news_meta?.developing);
        const score = titleOverlap + (sameGame ? 0.35 : 0) + (developing ? 0.12 : 0);
        return { ...row, titleOverlap, sameGame, developing, score };
      }).sort((a, b) => b.score - a.score);

      const match = ranked.find(row => row.titleOverlap >= 0.55 || (row.sameGame && row.titleOverlap >= 0.34 && row.developing));
      if (match) showNotice(match);
      else hideNotice();
    } catch (_) {
      hideNotice();
    } finally {
      checking = false;
    }
  }

  function installStyle() {
    if ($('#studio-news-duplicate-guard-style')) return;
    const style = document.createElement('style');
    style.id = 'studio-news-duplicate-guard-style';
    style.textContent = `
      .studio-news-duplicate-guard{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:18px;align-items:center;margin:14px 0 0;padding:16px 17px;border:1px solid rgba(255,188,78,.42);border-radius:14px;background:linear-gradient(100deg,rgba(255,188,78,.09),rgba(125,103,255,.06));box-shadow:0 10px 30px rgba(85,53,0,.05)}
      .studio-news-duplicate-guard[hidden]{display:none!important}.studio-news-duplicate-guard small{display:block;margin-bottom:6px;color:#c88913;font:900 8px/1 Inter,system-ui,sans-serif;letter-spacing:.13em}.studio-news-duplicate-guard strong{display:block;color:#17212f;font:760 13px/1.25 Inter,system-ui,sans-serif}.studio-news-duplicate-guard p{margin:6px 0 0;color:#6e7580;font:500 10px/1.45 Inter,system-ui,sans-serif}.studio-news-duplicate-guard p b{color:#49515e}.studio-news-duplicate-guard button{min-height:38px;padding:0 13px;border:1px solid rgba(199,137,19,.38);border-radius:10px;background:#fff9ec;color:#9b6809;font:850 8px/1 Inter,system-ui,sans-serif;letter-spacing:.08em;cursor:pointer;white-space:nowrap}.studio-news-duplicate-guard button:hover{border-color:#b47a0d;background:#fff4d7}
      html[data-theme="dark"] .studio-news-duplicate-guard{border-color:rgba(255,188,78,.34);background:linear-gradient(100deg,rgba(255,188,78,.08),rgba(113,95,255,.075))}html[data-theme="dark"] .studio-news-duplicate-guard strong{color:#f8f9ff}html[data-theme="dark"] .studio-news-duplicate-guard p{color:#a8b1c2}html[data-theme="dark"] .studio-news-duplicate-guard p b{color:#d9dfeb}html[data-theme="dark"] .studio-news-duplicate-guard button{border-color:rgba(255,188,78,.35);background:rgba(255,188,78,.08);color:#ffc966}
      @media(max-width:720px){.studio-news-duplicate-guard{grid-template-columns:1fr}.studio-news-duplicate-guard button{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function init() {
    installStyle();
    ensureNotice();
    monitorNewsState();
    document.addEventListener('change', handleNewsStateEvent, true);
    document.addEventListener('input', handleNewsStateEvent, true);
    $('#title')?.addEventListener('blur', () => checkDuplicates(true));
    $('#game-graph-game')?.addEventListener('blur', () => checkDuplicates(true));
    ['#publish-story','#schedule-story'].forEach(selector => $(selector)?.addEventListener('pointerdown', () => checkDuplicates(true), true));
    $('#story-library')?.addEventListener('click', event => {
      if (event.target.closest('[data-edit]')) setTimeout(() => {
        applyNewsTrustState();
        checkDuplicates(true);
      }, 850);
    });
    setTimeout(() => {
      applyNewsTrustState();
      checkDuplicates(true);
    }, 1200);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
