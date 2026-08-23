(() => {
  'use strict';

  const PAGE_SIZE = 3;
  const state = { filter: 'latest', visible: PAGE_SIZE };

  function sortedArticles() {
    return [...ARTICLES].sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
  }

  function feedArticles(filter) {
    const all = sortedArticles();
    if (filter === 'latest') {
      return all.filter(a => !a.homepageSlot || a.homepageSlot === 'regular');
    }
    return all.filter(a => matchCategory(a, filter));
  }

  function categoryClass(a) {
    const category = String(a.category || 'FEATURE').toLowerCase();
    if (category === 'review') return 'is-review';
    if (category === 'news') return 'is-news';
    if (category === 'guide') return 'is-guide';
    return 'is-feature';
  }

  function cardMarkup(a, index) {
    return `<a class="story nc-feed-story ${categoryClass(a)}" href="${articleHref(a)}">
      <div class="thumb">${imageOf(a) ? `<img alt="${escapeHtml(a.imageAlt || a.title)}" src="${imageOf(a)}">` : '<div class="placeholder-art">NC</div>'}<b>${String(index + 1).padStart(2, '0')}</b></div>
      <div class="nc-feed-copy">
        <div class="nc-feed-meta"><label>${escapeHtml(a.category || 'FEATURE')}</label>${a.articleFormat === 'review' && a.reviewMeta?.score ? `<span>${escapeHtml(a.reviewMeta.score)}/10</span>` : ''}</div>
        <h3>${escapeHtml(a.title)}</h3>
        <p>${escapeHtml(a.description)}</p>
        <small>BY ${escapeHtml(a.author)} · ${fmtDate(a.publishedAt)} · READ STORY →</small>
      </div>
    </a>`;
  }

  function newsDeskMarkup(list) {
    if (!list.length) {
      return `<section class="nc-news-empty" role="status">
        <small>NEWS DESK · STANDING BY</small>
        <h3>No breaking signals right now.</h3>
        <p>Neural Critic’s news desk will collect announcements, release updates, industry moves, and stories worth interrupting your feed for. When the first NEWS story is published, it will appear here automatically.</p>
        <button type="button" id="nc-feed-show-latest">BACK TO LATEST STORIES →</button>
      </section>`;
    }
    const latest = list[0];
    return `<div class="nc-news-desk"><div><small>NEWS DESK</small><strong>${list.length} ${list.length === 1 ? 'LIVE SIGNAL' : 'LIVE SIGNALS'}</strong></div><span>Latest update · ${fmtDate(latest.publishedAt)}</span></div>`;
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
    }

    const list = feedArticles(state.filter);
    const visible = list.slice(0, state.visible);
    const newsDesk = state.filter === 'news' ? newsDeskMarkup(list) : '';

    if (!list.length) {
      el.innerHTML = state.filter === 'news' ? newsDesk : genericEmptyMarkup(state.filter);
    } else {
      el.innerHTML = `${newsDesk}<div class="nc-feed-list">${visible.map(cardMarkup).join('')}</div>${footerMarkup(list.length, visible.length)}`;
    }

    document.querySelectorAll('.filters button[data-filter]').forEach(btn => {
      const active = btn.dataset.filter === state.filter;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  };

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
      state.visible = Math.min(total, state.visible + PAGE_SIZE);
      renderFeed(state.filter);
      document.querySelector('.nc-feed-story:nth-last-child(-n+3)')?.focus?.({ preventScroll: true });
      window.gtag?.('event', 'homepage_feed_load_more', { feed_filter: state.filter, stories_visible: state.visible });
      return;
    }

    const latest = event.target.closest?.('#nc-feed-show-latest');
    if (latest) {
      state.filter = 'latest';
      state.visible = PAGE_SIZE;
      renderFeed('latest');
      document.querySelector('.filters [data-filter="latest"]')?.focus();
      return;
    }

    const filterButton = event.target.closest?.('.filters button[data-filter]');
    if (filterButton) {
      state.visible = PAGE_SIZE;
      window.gtag?.('event', 'homepage_feed_filter', { feed_filter: filterButton.dataset.filter || 'latest' });
    }
  }, true);
})();
