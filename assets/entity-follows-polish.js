(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const esc = (v = '') => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const slugify = (v = '') => String(v).trim().toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const specificity = { game: 3, series: 2, franchise: 1 };
  let articleIndex = null;
  let timer = 0;

  function ensureStyles() {
    if ($('style[data-nc-follow-polish]')) return;
    const style = document.createElement('style');
    style.dataset.ncFollowPolish = '1';
    style.textContent = `
      .nc-follow-feed-item[data-follow-context]{position:relative;padding-right:88px}.nc-follow-feed-context{position:absolute;right:9px;top:9px;max-width:72px;text-align:right;color:#55dcea!important;font:850 5.5px/1.35 Inter,system-ui,sans-serif!important;letter-spacing:.08em!important;text-transform:uppercase}.nc-follow-feed-note{margin:7px 0 0;color:#7e8ba3;font:550 7px/1.45 Inter,system-ui,sans-serif}.work-react-rail [data-entity-article-follow][data-covered-by-parent="true"] small:after{content:' · INCLUDED';color:#55dcea;font-size:.68em;letter-spacing:.05em}.work-react-rail [data-entity-article-follow][data-covered-by-parent="true"]{border-color:rgba(85,220,234,.32)}
      html[data-theme="light"] .nc-follow-feed-context{color:#087f99!important}html[data-theme="light"] .nc-follow-feed-note{color:#697989}
      @media(max-width:620px){.nc-follow-feed-item[data-follow-context]{padding-right:10px}.nc-follow-feed-context{position:static;display:block;max-width:none;text-align:left;margin-bottom:3px}}
    `;
    document.head.appendChild(style);
  }

  async function loadArticles() {
    if (articleIndex) return articleIndex;
    try {
      const response = await fetch('/data/articles.json', { cache:'no-cache' });
      articleIndex = response.ok ? await response.json() : [];
      if (!Array.isArray(articleIndex)) articleIndex = [];
    } catch (_) { articleIndex = []; }
    return articleIndex;
  }

  function currentArticleSlug() {
    return window.NEURAL_CRITIC_STATIC_SLUG || new URLSearchParams(location.search).get('slug') || location.pathname.match(/^\/stories\/([^/]+)\/?$/)?.[1] || '';
  }

  function entityValue(article, type) {
    if (type === 'game') return article.gameKey || article.game_key || '';
    return article[type] || '';
  }

  function matches(article, follow) {
    return slugify(entityValue(article, follow.entity_type)) === follow.entity_slug;
  }

  function matchForArticle(article, follows) {
    return follows.filter(row => matches(article, row)).sort((a,b) => (specificity[b.entity_type] || 0) - (specificity[a.entity_type] || 0))[0] || null;
  }

  function publishedAt(article) {
    return new Date(article.publishedAt || article.published_at || 0).getTime() || 0;
  }

  function dateLabel(value) {
    if (!value) return '';
    try { return new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(value)); } catch (_) { return ''; }
  }

  function balancedFeed(articles, follows, limit = 6) {
    const buckets = follows.map(follow => ({ follow, rows: articles.filter(article => matches(article, follow)).sort((a,b) => publishedAt(b) - publishedAt(a)), cursor:0 }));
    const used = new Set();
    const output = [];
    while (output.length < limit) {
      let added = false;
      for (const bucket of buckets) {
        while (bucket.cursor < bucket.rows.length && used.has(bucket.rows[bucket.cursor].slug)) bucket.cursor += 1;
        const article = bucket.rows[bucket.cursor++];
        if (!article) continue;
        used.add(article.slug);
        output.push({ article, match:matchForArticle(article, follows) || bucket.follow });
        added = true;
        if (output.length >= limit) break;
      }
      if (!added) break;
    }
    return output;
  }

  async function polishFeed() {
    const api = window.NeuralCriticEntityFollows;
    const section = $('.nc-following-account');
    if (!api?.list || !section) return false;
    try {
      const [follows, articles] = await Promise.all([api.list(), loadArticles()]);
      if (!follows.length) return false;
      const feed = balancedFeed(articles, follows, 6);
      let host = $('.nc-follow-feed', section);
      if (!feed.length) { host?.remove(); return false; }
      if (!host) {
        host = document.createElement('div');
        host.className = 'nc-follow-feed';
        section.appendChild(host);
      }
      host.dataset.followPolished = '1';
      host.innerHTML = `<small>LATEST FROM YOUR FOLLOWS</small><div class="nc-follow-feed-list">${feed.map(({article,match}) => `<a class="nc-follow-feed-item" data-follow-context="${esc(`${match.entity_type}:${match.entity_slug}`)}" href="/stories/${encodeURIComponent(article.slug)}/"><span class="nc-follow-feed-context">${esc(match.entity_type)} · ${esc(match.entity_name)}</span><small>${esc(String(article.category || 'STORY').toUpperCase())}</small><strong>${esc(article.title || '')}</strong><span>${esc(dateLabel(article.publishedAt || article.published_at))}</span></a>`).join('')}</div><p class="nc-follow-feed-note">Balanced across the games, series and franchises you follow so one topic does not crowd out the rest.</p>`;
      return true;
    } catch (error) {
      console.warn('Following feed polish failed.', error);
      return false;
    }
  }

  async function polishArticleFollowContext() {
    const api = window.NeuralCriticEntityFollows;
    const button = $('[data-entity-article-follow]');
    const slug = currentArticleSlug();
    if (!api?.list || !button || !slug) return false;
    try {
      const [follows, articles] = await Promise.all([api.list(), loadArticles()]);
      const article = articles.find(row => row.slug === slug);
      if (!article) return false;
      const directType = ['game','series','franchise'].find(type => String(entityValue(article, type) || '').trim());
      if (!directType) return false;
      const directSlug = slugify(entityValue(article, directType));
      const direct = follows.find(row => row.entity_type === directType && row.entity_slug === directSlug);
      const inherited = direct ? null : follows.filter(row => row.entity_type !== directType && matches(article, row)).sort((a,b) => (specificity[b.entity_type] || 0) - (specificity[a.entity_type] || 0))[0];
      button.dataset.coveredByParent = String(!!inherited);
      if (inherited) button.title = `Already included through your ${inherited.entity_name} ${inherited.entity_type} follow. Follow ${String(entityValue(article, directType)).trim()} too for a more specific signal.`;
      return !!inherited;
    } catch (error) {
      console.warn('Article follow context polish failed.', error);
      return false;
    }
  }

  function schedule(delay = 90) {
    clearTimeout(timer);
    timer = setTimeout(() => { polishFeed(); polishArticleFollowContext(); }, delay);
  }

  function watch() {
    document.addEventListener('click', event => { if (event.target.closest('.reader-account-button,[data-reader-auth-open]')) schedule(140); }, true);
    document.addEventListener('nc:entity-follows-changed', () => schedule(80));
    document.addEventListener('neuralcritic:community-refreshed', () => schedule(140));
    window.addEventListener('focus', () => schedule(100));
    document.addEventListener('visibilitychange', () => { if (!document.hidden) schedule(100); });
    const observer = new MutationObserver(mutations => {
      if (mutations.some(m => [...m.addedNodes].some(node => node.nodeType === 1 && (node.matches?.('.nc-following-account,.nc-follow-feed') || node.querySelector?.('.nc-following-account,.nc-follow-feed'))))) schedule(80);
    });
    observer.observe(document.documentElement, { childList:true, subtree:true });
    setTimeout(() => observer.disconnect(), 8000);
  }

  function init() { ensureStyles(); watch(); schedule(180); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true }); else init();
})();
