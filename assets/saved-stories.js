(() => {
  'use strict';

  const TABLE = 'reader_saved_stories';
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (v = '') => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const slug = () => window.NEURAL_CRITIC_STATIC_SLUG || new URLSearchParams(location.search).get('slug') || location.pathname.match(/^\/stories\/([^/]+)\/?$/)?.[1] || '';
  let articleIndex = null;
  let busy = false;

  function ensureStyles() {
    if ($('style[data-nc-saved-stories]')) return;
    const style = document.createElement('style');
    style.dataset.ncSavedStories = '1';
    style.textContent = `
      .work-react-rail .nc-save-story[aria-pressed="true"]{color:#665dff}.work-react-rail .nc-save-story:disabled{opacity:.55;cursor:wait}
      .nc-saved-account{margin-top:18px;padding-top:17px;border-top:1px solid rgba(126,145,184,.18)}.nc-saved-account-head{display:flex;align-items:end;justify-content:space-between;gap:12px;margin-bottom:10px}.nc-saved-account-head small{display:block;color:#55dcea;font:850 7px/1 Inter,system-ui,sans-serif;letter-spacing:.14em}.nc-saved-account-head strong{display:block;margin-top:5px;color:#eef3ff;font:780 16px/1.1 Inter,system-ui,sans-serif}.nc-saved-count{color:#7e8ba3;font:800 7px/1 Inter,system-ui,sans-serif;letter-spacing:.08em}.nc-saved-list{display:grid;gap:8px}.nc-saved-card{display:grid;grid-template-columns:58px minmax(0,1fr) auto;gap:10px;align-items:center;padding:8px;border:1px solid rgba(126,145,184,.16);border-radius:11px;background:rgba(8,14,28,.55)}.nc-saved-card img{width:58px;height:44px;object-fit:cover;border-radius:8px}.nc-saved-card-copy{min-width:0}.nc-saved-card a{display:-webkit-box;overflow:hidden;-webkit-line-clamp:2;-webkit-box-orient:vertical;color:#e9eef9;font:700 9px/1.3 Inter,system-ui,sans-serif;text-decoration:none}.nc-saved-card a:hover{text-decoration:underline;text-underline-offset:2px}.nc-saved-card span{display:block;margin-top:4px;color:#77859f;font:650 7px/1 Inter,system-ui,sans-serif;letter-spacing:.06em}.nc-saved-remove{width:28px;height:28px;border:1px solid rgba(126,145,184,.2);border-radius:50%;background:transparent;color:#8996ac;cursor:pointer}.nc-saved-remove:hover,.nc-saved-remove:focus-visible{border-color:rgba(255,115,139,.4);color:#ff8299;outline:none}.nc-saved-empty{margin:0;color:#8996ac;font:500 9px/1.5 Inter,system-ui,sans-serif}
      html[data-theme="light"] .nc-saved-account-head strong,html[data-theme="light"] .nc-saved-card a{color:#1c2738}html[data-theme="light"] .nc-saved-card{background:rgba(245,248,252,.8)}
      @media(max-width:560px){.nc-saved-card{grid-template-columns:50px minmax(0,1fr) auto}.nc-saved-card img{width:50px;height:40px}}
    `;
    document.head.appendChild(style);
  }

  async function client() {
    for (let i = 0; i < 70; i++) {
      const sb = window.neuralCriticReaderSupabase || window.neuralCriticCommunitySupabase || window.neuralCriticPublicSupabase || window.neuralCriticSupabase;
      if (sb?.auth) return sb;
      await sleep(80);
    }
    return null;
  }

  async function user() {
    const sb = await client();
    if (!sb) return null;
    const { data } = await sb.auth.getUser();
    return data?.user || null;
  }

  function openLogin() {
    if (window.NeuralCriticReaderAuth?.openAuth) return window.NeuralCriticReaderAuth.openAuth('login');
    const trigger = $('[data-reader-auth-open],.reader-account-button');
    trigger?.click();
  }

  async function list() {
    const sb = await client();
    const current = await user();
    if (!sb || !current) return [];
    const { data, error } = await sb.from(TABLE).select('article_slug,created_at').order('created_at', { ascending:false });
    if (error) throw error;
    return data || [];
  }

  async function isSaved(articleSlug) {
    const sb = await client();
    const current = await user();
    if (!sb || !current || !articleSlug) return false;
    const { data, error } = await sb.from(TABLE).select('article_slug').eq('article_slug', articleSlug).maybeSingle();
    if (error) throw error;
    return !!data;
  }

  async function save(articleSlug) {
    const sb = await client();
    const current = await user();
    if (!current) { openLogin(); return false; }
    const { error } = await sb.from(TABLE).insert({ user_id: current.id, article_slug: articleSlug });
    if (error && error.code !== '23505') throw error;
    document.dispatchEvent(new CustomEvent('nc:saved-stories-changed', { detail:{ slug:articleSlug, saved:true } }));
    return true;
  }

  async function remove(articleSlug) {
    const sb = await client();
    const current = await user();
    if (!sb || !current) return false;
    const { error } = await sb.from(TABLE).delete().eq('article_slug', articleSlug).eq('user_id', current.id);
    if (error) throw error;
    document.dispatchEvent(new CustomEvent('nc:saved-stories-changed', { detail:{ slug:articleSlug, saved:false } }));
    return true;
  }

  async function loadArticles() {
    if (articleIndex) return articleIndex;
    try {
      const response = await fetch('/data/articles.json', { cache:'no-cache' });
      const rows = response.ok ? await response.json() : [];
      articleIndex = new Map((Array.isArray(rows) ? rows : []).map(item => [item.slug, item]));
    } catch (_) { articleIndex = new Map(); }
    return articleIndex;
  }

  async function syncButton() {
    const articleSlug = slug();
    const button = $('.nc-save-story');
    if (!button || !articleSlug) return;
    try {
      const current = await user();
      const saved = current ? await isSaved(articleSlug) : false;
      button.setAttribute('aria-pressed', String(saved));
      button.classList.toggle('active', saved);
      button.innerHTML = `<b aria-hidden="true">${saved ? '✓' : '▯'}</b><small>${saved ? 'SAVED' : 'SAVE'}</small>`;
      button.title = current ? (saved ? 'Remove from Saved Stories' : 'Save for later') : 'Sign in to save this story';
    } catch (_) {}
  }

  async function toggleCurrent() {
    if (busy) return;
    const articleSlug = slug();
    const button = $('.nc-save-story');
    if (!articleSlug || !button) return;
    busy = true; button.disabled = true;
    try {
      const current = await user();
      if (!current) { openLogin(); return; }
      const saved = await isSaved(articleSlug);
      if (saved) await remove(articleSlug); else await save(articleSlug);
      await syncButton();
      window.gtag?.('event', saved ? 'story_unsaved' : 'story_saved', { article_slug: articleSlug });
    } catch (error) { console.warn('Saved Stories action failed.', error); }
    finally { busy = false; button.disabled = false; }
  }

  function injectButton() {
    if (!slug() || $('.nc-save-story')) return !!$('.nc-save-story');
    const rail = $('.work-react-rail');
    if (!rail) return false;
    const button = document.createElement('button');
    button.className = 'nc-save-story';
    button.type = 'button';
    button.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-label', 'Save story for later');
    button.innerHTML = '<b aria-hidden="true">▯</b><small>SAVE</small>';
    const share = $('[data-article-share]', rail);
    if (share) rail.insertBefore(button, share); else rail.appendChild(button);
    button.addEventListener('click', toggleCurrent);
    syncButton();
    return true;
  }

  async function renderAccountSaved() {
    const slot = $('.reader-profile-slot');
    if (!slot) return false;
    const current = await user();
    let section = $('.nc-saved-account', slot);
    if (!current) { section?.remove(); return false; }
    if (!section) {
      section = document.createElement('section');
      section.className = 'nc-saved-account';
      slot.appendChild(section);
    }
    try {
      const [saved, articles] = await Promise.all([list(), loadArticles()]);
      const cards = saved.map(row => {
        const item = articles.get(row.article_slug) || {};
        const title = item.title || row.article_slug.replace(/-/g, ' ');
        const image = item.imageLocal || '';
        const category = item.category || 'STORY';
        return `<article class="nc-saved-card" data-saved-slug="${esc(row.article_slug)}">
          ${image ? `<img src="${esc(image)}" alt="" loading="lazy">` : '<span></span>'}
          <div class="nc-saved-card-copy"><a href="/stories/${encodeURIComponent(row.article_slug)}/">${esc(title)}</a><span>${esc(category)} · SAVED</span></div>
          <button class="nc-saved-remove" type="button" aria-label="Remove ${esc(title)} from Saved Stories">×</button>
        </article>`;
      }).join('');
      section.innerHTML = `<div class="nc-saved-account-head"><div><small>YOUR LIBRARY</small><strong>Saved Stories</strong></div><span class="nc-saved-count">${saved.length} SAVED</span></div>${cards ? `<div class="nc-saved-list">${cards}</div>` : '<p class="nc-saved-empty">Stories you save will appear here so you can come back to them from any signed-in device.</p>'}`;
      section.querySelectorAll('.nc-saved-remove').forEach(button => button.addEventListener('click', async () => {
        const card = button.closest('[data-saved-slug]');
        if (!card) return;
        button.disabled = true;
        try { await remove(card.dataset.savedSlug); await renderAccountSaved(); await syncButton(); }
        catch (_) { button.disabled = false; }
      }));
      return true;
    } catch (error) {
      section.innerHTML = '<p class="nc-saved-empty">Saved Stories are temporarily unavailable. Please try again shortly.</p>';
      return false;
    }
  }

  function init() {
    ensureStyles();
    let tries = 0;
    const articleTimer = setInterval(() => { if (injectButton() || ++tries > 100) clearInterval(articleTimer); }, 100);
    const observer = new MutationObserver(() => {
      injectButton();
      const slot = $('.reader-profile-slot');
      if (slot && !$('.nc-saved-account', slot)) renderAccountSaved();
    });
    observer.observe(document.documentElement, { childList:true, subtree:true });
    document.addEventListener('nc:reader-auth', () => { syncButton(); renderAccountSaved(); });
    document.addEventListener('nc:saved-stories-changed', () => { syncButton(); renderAccountSaved(); });
    window.addEventListener('neuralcritic:account-refreshed', renderAccountSaved);
    renderAccountSaved();
  }

  window.NeuralCriticSavedStories = { list, isSaved, save, remove, refresh:renderAccountSaved };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true }); else init();
})();
