(() => {
  'use strict';

  const PAGE_SIZE = 3;
  const state = { filter: 'latest', visible: PAGE_SIZE, newsKind: 'all' };
  const DESK_COPY = {
    latest: ['THE LATEST', 'Latest coverage', 'Newly published reporting, criticism, and practical help.'],
    news: ['LIVE SIGNALS', 'News desk', 'Confirmed releases, announcements, updates, and attributed reports.'],
    feature: ['DEEP READS', 'Features', 'Analysis, reporting, and ideas worth spending time with.'],
    review: ['THE VERDICT', 'Reviews', 'Scored criticism with a clear verdict and useful context.'],
    pc: ['PLATFORM WATCH', 'PC stories', 'The latest Neural Critic coverage for PC players.']
  };
  const NEWS_KINDS = {
    breaking: { label: 'BREAKING', copy: 'Confirmed, time-sensitive developments.' },
    update: { label: 'UPDATES', copy: 'Official changes, patches, delays, releases, and developing stories.' },
    report: { label: 'REPORTS', copy: 'Credible reporting, rumors, and leaks that are not fully confirmed.' }
  };

  function sortedArticles() {
    return [...ARTICLES].sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
  }

  function allNewsArticles() {
    return sortedArticles().filter(a => matchCategory(a, 'news'));
  }

  function feedArticles(filter) {
    const all = sortedArticles();
    if (filter === 'latest') {
      const featured = new Set(window.NeuralCriticHomepageState?.featuredSlugs || []);
      return all.filter(a => !featured.has(a.slug));
    }
    const matched = all.filter(a => matchCategory(a, filter));
    if (filter === 'news' && state.newsKind !== 'all') {
      return matched.filter(a => a.newsMeta?.kind === state.newsKind);
    }
    return matched;
  }

  function syncDeskHeading(filter) {
    const head = document.querySelector('#news .sectionhead > div:first-child');
    if (!head) return;
    const [eyebrow, title, description] = DESK_COPY[filter] || [String(filter).toUpperCase(), 'Stories', 'Published Neural Critic coverage.'];
    const small = head.querySelector('small');
    const h2 = head.querySelector('h2');
    const paragraph = head.querySelector('p');
    if (small) small.textContent = eyebrow;
    if (h2) h2.textContent = title;
    if (paragraph) paragraph.textContent = description;
  }

  function categoryClass(a) {
    const category = String(a.category || 'FEATURE').toLowerCase();
    if (category === 'review') return 'is-review';
    if (category === 'news') return `is-news ${a.newsMeta?.kind ? `is-news-${a.newsMeta.kind}` : ''}`;
    if (category === 'guide') return 'is-guide';
    return 'is-feature';
  }

  function newsLabel(a) {
    const kind = a.newsMeta?.kind;
    return kind && NEWS_KINDS[kind] ? NEWS_KINDS[kind].label.replace(/S$/, '') : 'NEWS';
  }

  function cardMarkup(a, index) {
    const isNews = String(a.category || '').toUpperCase() === 'NEWS';
    const label = isNews ? newsLabel(a) : (a.category || 'FEATURE');
    const auxiliary = a.articleFormat === 'review' && a.reviewMeta?.score
      ? `${escapeHtml(a.reviewMeta.score)}/10`
      : isNews && a.newsMeta?.kind === 'report'
        ? 'ATTRIBUTED'
        : isNews && Array.isArray(a.newsMeta?.updates) && a.newsMeta.updates.length
          ? `${a.newsMeta.updates.length} UPDATE${a.newsMeta.updates.length === 1 ? '' : 'S'}`
          : '';
    return `<a class="story nc-feed-story ${categoryClass(a)}" href="${articleHref(a)}" data-home-story="${escapeHtml(a.slug)}">
      <div class="thumb">${imageOf(a) ? `<img alt="${escapeHtml(a.imageAlt || a.title)}" src="${imageOf(a)}">` : '<div class="placeholder-art">NC</div>'}<b>${String(index + 1).padStart(2, '0')}</b></div>
      <div class="nc-feed-copy">
        <div class="nc-feed-meta"><label>${escapeHtml(label)}</label>${auxiliary ? `<span>${escapeHtml(auxiliary)}</span>` : ''}</div>
        <h3>${escapeHtml(a.title)}</h3>
        <p>${escapeHtml(a.description)}</p>
        <small>BY ${escapeHtml(a.author)} · ${fmtDate(a.updatedAt || a.publishedAt)} · READ STORY →</small>
      </div>
    </a>`;
  }

  function newsKindControls(list) {
    const count = kind => kind === 'all' ? list.length : list.filter(a => a.newsMeta?.kind === kind).length;
    const buttons = [
      ['all', 'ALL NEWS'],
      ['breaking', 'BREAKING'],
      ['update', 'UPDATES'],
      ['report', 'REPORTS']
    ];
    return `<div class="nc-news-kinds" aria-label="News type filters">${buttons.map(([kind, label]) => `<button type="button" data-news-kind="${kind}" class="${state.newsKind === kind ? 'active' : ''}" aria-pressed="${state.newsKind === kind ? 'true' : 'false'}"><span>${label}</span><b>${count(kind)}</b></button>`).join('')}</div>`;
  }

  function emptyNewsDeskMarkup() {
    return `<section class="nc-news-empty" role="status">
      <small>NEWS DESK · STANDING BY</small>
      <h3>No live signals yet.</h3>
      <p>News on Neural Critic is structured by certainty and purpose. The first published NEWS story will enter one of these lanes automatically.</p>
      <div class="nc-news-lanes">
        ${Object.entries(NEWS_KINDS).map(([kind, item]) => `<article data-kind="${kind}"><b>${item.label}</b><span>${item.copy}</span></article>`).join('')}
      </div>
      <button type="button" id="nc-feed-show-latest">BACK TO LATEST STORIES →</button>
    </section>`;
  }

  function newsDeskMarkup(allNews) {
    if (!allNews.length) return emptyNewsDeskMarkup();
    const latest = [...allNews].sort((a,b) => new Date(b.updatedAt || b.publishedAt || 0) - new Date(a.updatedAt || a.publishedAt || 0))[0];
    return `<div class="nc-news-desk"><div><small>NEWS DESK</small><strong>${allNews.length} ${allNews.length === 1 ? 'LIVE SIGNAL' : 'LIVE SIGNALS'}</strong></div><span>Latest update · ${fmtDate(latest.updatedAt || latest.publishedAt)}</span></div>${newsKindControls(allNews)}`;
  }

  function newsKindEmptyMarkup(kind) {
    const config = NEWS_KINDS[kind];
    return `<section class="nc-feed-empty nc-news-kind-empty" role="status"><small>${escapeHtml(config?.label || 'NEWS')}</small><h3>Nothing in this lane right now.</h3><p>${escapeHtml(config?.copy || 'Matching news stories will appear here automatically.')}</p></section>`;
  }

  function genericEmptyMarkup(filter) {
    const label = String(filter || 'stories').toUpperCase();
    return `<section class="nc-feed-empty" role="status"><small>${escapeHtml(label)} DESK</small><h3>No published stories here yet.</h3><p>This filter is ready; matching stories will appear automatically as the library grows.</p><button type="button" id="nc-feed-show-latest">BACK TO LATEST STORIES →</button></section>`;
  }

  function footerMarkup(total, shown) {
    if (!total) return '';
    const remaining = Math.max(0, total - shown);
    const progress = Math.min(100, Math.round((shown / total) * 100));
    return `<div class="nc-feed-footer" aria-live="polite">
      <div class="nc-feed-progress"><div><span>SHOWING ${shown} OF ${total}</span><b>${remaining ? `${remaining} MORE IN THIS VIEW` : 'YOU’RE CAUGHT UP'}</b></div><div class="nc-feed-track" aria-hidden="true"><i style="width:${progress}%"></i></div></div>
      ${remaining ? `<button type="button" id="nc-feed-load-more">LOAD MORE STORIES <span>+${Math.min(PAGE_SIZE, remaining)}</span></button>` : ''}
    </div>`;
  }

  renderFeed = function(filter = state.filter) {
    const el = document.getElementById('story-feed');
    if (!el) return;

    const nextFilter = String(filter || 'latest').toLowerCase();
    if (nextFilter !== state.filter) {
      state.filter = nextFilter;
      state.visible = PAGE_SIZE;
      state.newsKind = 'all';
    }

    syncDeskHeading(state.filter);
    const list = feedArticles(state.filter);
    const visible = list.slice(0, state.visible);
    const allNews = state.filter === 'news' ? allNewsArticles() : [];
    const newsDesk = state.filter === 'news' ? newsDeskMarkup(allNews) : '';

    if (state.filter === 'news' && !allNews.length) {
      el.innerHTML = newsDesk;
    } else if (!list.length) {
      el.innerHTML = state.filter === 'news' && state.newsKind !== 'all' ? `${newsDesk}${newsKindEmptyMarkup(state.newsKind)}` : genericEmptyMarkup(state.filter);
    } else {
      el.innerHTML = `${newsDesk}<div class="nc-feed-list">${visible.map(cardMarkup).join('')}</div>${footerMarkup(list.length, visible.length)}`;
    }

    document.querySelectorAll('.filters button[data-filter]').forEach(btn => {
      const active = btn.dataset.filter === state.filter;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    if (window.NeuralCriticHomepageState) window.NeuralCriticHomepageState.feedSlugs = visible.map(article => article.slug);
    window.dispatchEvent(new CustomEvent('neuralcritic:homepage-feed-rendered', { detail:{ filter:state.filter, slugs:visible.map(article => article.slug) } }));
  };

  async function hydrateNewsMeta() {
    for (let attempt = 0; attempt < 50; attempt++) {
      const client = window.neuralCriticPublicSupabase;
      if (client && Array.isArray(ARTICLES) && ARTICLES.length) {
        try {
          const { data, error } = await client.from('articles').select('slug,news_meta,updated_at').eq('status', 'published').eq('category', 'NEWS');
          if (error) throw error;
          const map = new Map((data || []).map(row => [row.slug, row]));
          ARTICLES.forEach(article => {
            const row = map.get(article.slug);
            if (!row) return;
            article.newsMeta = row.news_meta && typeof row.news_meta === 'object' ? row.news_meta : {};
            article.updatedAt = row.updated_at || article.updatedAt;
          });
          if (document.getElementById('hero')) {
            renderHero?.();
            renderTrending?.();
          }
          renderFeed(state.filter);
          return;
        } catch (error) {
          console.warn('Neural Critic News Desk metadata unavailable.', error);
          return;
        }
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  const filters = document.querySelector('.filters');
  if (filters && !filters.querySelector('[data-filter="review"]')) {
    const reviews = document.createElement('button');
    reviews.type = 'button';
    reviews.dataset.filter = 'review';
    reviews.textContent = 'REVIEWS';
    reviews.setAttribute('aria-pressed', 'false');
    const pc = filters.querySelector('[data-filter="pc"]');
    filters.insertBefore(reviews, pc || null);
  }

  document.addEventListener('click', event => {
    const loadMore = event.target.closest?.('#nc-feed-load-more');
    if (loadMore) {
      const total = feedArticles(state.filter).length;
      const previouslyVisible = state.visible;
      state.visible = Math.min(total, state.visible + PAGE_SIZE);
      renderFeed(state.filter);
      document.querySelectorAll('.nc-feed-story')[previouslyVisible]?.focus?.({ preventScroll: true });
      window.gtag?.('event', 'homepage_feed_load_more', { feed_filter: state.filter, news_kind: state.filter === 'news' ? state.newsKind : undefined, stories_visible: state.visible });
      return;
    }

    const latest = event.target.closest?.('#nc-feed-show-latest');
    if (latest) {
      state.filter = 'latest';
      state.visible = PAGE_SIZE;
      state.newsKind = 'all';
      renderFeed('latest');
      document.querySelector('.filters [data-filter="latest"]')?.focus();
      return;
    }

    const newsKind = event.target.closest?.('[data-news-kind]');
    if (newsKind) {
      state.newsKind = newsKind.dataset.newsKind || 'all';
      state.visible = PAGE_SIZE;
      renderFeed('news');
      window.gtag?.('event', 'homepage_news_kind_filter', { news_kind: state.newsKind });
      return;
    }

    const filterButton = event.target.closest?.('.filters button[data-filter]');
    if (filterButton) {
      state.visible = PAGE_SIZE;
      state.newsKind = 'all';
      window.gtag?.('event', 'homepage_feed_filter', { feed_filter: filterButton.dataset.filter || 'latest' });
    }
  }, true);

  hydrateNewsMeta();

  setTimeout(() => {
    if (document.getElementById('story-feed') && Array.isArray(ARTICLES) && ARTICLES.length) {
      renderFeed(state.filter);
    }
  }, 0);
})();
