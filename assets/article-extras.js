(() => {
  const qs = (s, root = document) => root.querySelector(s);
  const qsa = (s, root = document) => [...root.querySelectorAll(s)];
  const esc = (value = '') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const inline = (value = '') => esc(value).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>');
  const paras = (text = '') => text.split(/\n\n+/).filter(Boolean).map(p => `<p>${inline(p).replace(/\n/g, '<br>')}</p>`).join('');

  function waitForArticle() {
    return new Promise(resolve => {
      const existing = qs('#article .article-body');
      if (existing) return resolve(existing);
      const host = qs('#article');
      if (!host) return resolve(null);
      const observer = new MutationObserver(() => {
        const body = qs('.article-body', host);
        if (body) {
          observer.disconnect();
          resolve(body);
        }
      });
      observer.observe(host, {childList: true, subtree: true});
      setTimeout(() => { observer.disconnect(); resolve(qs('#article .article-body')); }, 5000);
    });
  }

  function enhanceRankedArticle(article, body) {
    if (article.articleFormat !== 'ranked-list' || body.dataset.rankedEnhanced) return;
    body.dataset.rankedEnhanced = 'true';

    if (article.quickRead?.length) {
      body.insertAdjacentHTML('afterbegin', `<aside class="quick-read"><span>QUICK READ</span><h2>The ranking at a glance</h2><ul>${article.quickRead.map(x => `<li>${esc(x)}</li>`).join('')}</ul></aside>`);
    }

    const sections = qsa(':scope > section', body);
    (article.contentBlocks || []).forEach((block, index) => {
      const section = sections[index];
      if (!section) return;
      section.classList.add('ranked-card');
      const h2 = qs('h2', section);
      if (h2) {
        h2.insertAdjacentHTML('beforebegin', `<span class="ranked-eyebrow">RANKED ENTRY</span><b class="rank-number">${esc(block.rank || String(article.contentBlocks.length - index))}</b>`);
        if (block.subtitle) h2.insertAdjacentHTML('afterend', `<p class="ranked-subtitle">${esc(block.subtitle)}</p>`);
        const meta = [block.developer, block.releaseYear, block.platforms, block.genre].filter(Boolean);
        if (meta.length) h2.parentElement.insertAdjacentHTML('beforeend', `<div class="ranked-meta">${meta.map(x => `<span>${esc(x)}</span>`).join('')}</div>`);
      }
    });

    if (article.conclusion) {
      body.insertAdjacentHTML('beforeend', `<section class="article-conclusion"><span>FINAL VERDICT</span><h2>Difficulty is personal</h2>${paras(article.conclusion)}</section>`);
    }
  }

  function enhanceReview(article, body) {
    if (article.articleFormat !== 'review' || !article.reviewMeta || body.dataset.reviewEnhanced) return;
    body.dataset.reviewEnhanced = 'true';
    const m = article.reviewMeta;
    const values = [
      ['Developer', m.developer],
      ['Publisher', m.publisher],
      ['Tested on', m.testedPlatform],
      ['Release date', m.releaseDate],
    ].filter(([, value]) => value);
    if (!values.length && !m.reviewCopy) return;
    const markup = `<section class="review-details"><span style="grid-column:1/-1">REVIEW DETAILS</span>${values.map(([label,value]) => `<div class="review-detail"><small>${esc(label)}</small><b>${esc(value)}</b></div>`).join('')}${m.reviewCopy ? `<div class="review-copy">${esc(m.reviewCopy)}</div>` : ''}</section>`;
    const box = qs('.review-box', body);
    if (box) box.insertAdjacentHTML('afterend', markup); else body.insertAdjacentHTML('afterbegin', markup);
  }

  const commentsKey = slug => `neural-critic-comments:${slug}`;
  const likesKey = slug => `neural-critic-comment-likes:${slug}`;

  function loadJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch (_) { return fallback; }
  }
  function saveJson(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {} }
  function initials(name) { return name.trim().split(/\s+/).slice(0,2).map(x => x[0]?.toUpperCase() || '').join('') || 'NC'; }
  function formatTime(iso) {
    try { return new Intl.DateTimeFormat('en', {dateStyle:'medium', timeStyle:'short'}).format(new Date(iso)); } catch (_) { return ''; }
  }

  function renderThread(articleHost, slug) {
    if (qs('.article-thread', articleHost)) return;
    articleHost.insertAdjacentHTML('beforeend', `
      <div class="reader-actions-inline">
        <span>READER ACTIONS</span>
        <button type="button" data-reader-share>↗ SHARE</button>
        <button type="button" data-reader-comments>💬 COMMENTS</button>
      </div>
      <section class="article-thread" id="reader-thread">
        <div class="thread-head"><div><span>READER THREAD</span><h2>Join the discussion</h2></div><b data-thread-count>0 COMMENTS</b></div>
        <p class="thread-prompt">What did you think? Add your take to the conversation.</p>
        <p class="thread-local-note">Migration preview: comments currently persist in this browser. Shared accounts and server-backed discussion will be reconnected in the next backend milestone.</p>
        <form data-thread-form>
          <input class="thread-name" name="name" maxlength="40" placeholder="Display name" autocomplete="name" required>
          <textarea name="comment" maxlength="1200" placeholder="Write a thoughtful comment…" required></textarea>
          <div><small><span data-thread-remaining>1200</span> characters remaining</small><button type="submit">POST COMMENT</button></div>
          <p class="thread-error" data-thread-error hidden></p>
        </form>
        <div class="thread-list" data-thread-list></div>
      </section>`);

    const form = qs('[data-thread-form]', articleHost);
    const textarea = qs('textarea', form);
    const list = qs('[data-thread-list]', articleHost);
    const count = qs('[data-thread-count]', articleHost);
    const remaining = qs('[data-thread-remaining]', articleHost);
    const error = qs('[data-thread-error]', articleHost);
    let comments = loadJson(commentsKey(slug), []);
    let likes = loadJson(likesKey(slug), {});

    const draw = () => {
      count.textContent = `${comments.length} COMMENT${comments.length === 1 ? '' : 'S'}`;
      if (!comments.length) {
        list.innerHTML = '<div class="thread-empty"><b>0</b><h3>Be the first voice</h3><p>No comments yet. Start the thread.</p></div>';
        return;
      }
      list.innerHTML = comments.map(item => `
        <article data-comment-id="${esc(item.id)}">
          <div class="thread-avatar">${esc(initials(item.name))}</div>
          <div>
            <header><b>${esc(item.name)}</b><time>${esc(formatTime(item.createdAt))}</time></header>
            <p>${esc(item.text).replace(/\n/g,'<br>')}</p>
            <div class="thread-actions">
              <button type="button" data-like class="${likes[item.id] ? 'liked' : ''}">♥ ${item.likes || 0}</button>
              <button type="button" class="thread-delete" data-delete>DELETE</button>
            </div>
          </div>
        </article>`).join('');
    };

    textarea.addEventListener('input', () => remaining.textContent = String(1200 - textarea.value.length));
    form.addEventListener('submit', event => {
      event.preventDefault();
      const data = new FormData(form);
      const name = String(data.get('name') || '').trim();
      const text = String(data.get('comment') || '').trim();
      if (!name || !text) {
        error.hidden = false;
        error.textContent = 'Add a display name and a comment first.';
        return;
      }
      error.hidden = true;
      comments.unshift({id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`, name, text, createdAt: new Date().toISOString(), likes: 0});
      saveJson(commentsKey(slug), comments);
      form.reset();
      remaining.textContent = '1200';
      draw();
    });

    list.addEventListener('click', event => {
      const row = event.target.closest('[data-comment-id]');
      if (!row) return;
      const id = row.dataset.commentId;
      if (event.target.closest('[data-like]')) {
        const comment = comments.find(x => x.id === id);
        if (!comment) return;
        if (likes[id]) { comment.likes = Math.max(0, (comment.likes || 0) - 1); delete likes[id]; }
        else { comment.likes = (comment.likes || 0) + 1; likes[id] = true; }
        saveJson(commentsKey(slug), comments); saveJson(likesKey(slug), likes); draw();
      }
      if (event.target.closest('[data-delete]')) {
        comments = comments.filter(x => x.id !== id);
        delete likes[id];
        saveJson(commentsKey(slug), comments); saveJson(likesKey(slug), likes); draw();
      }
    });

    qs('[data-reader-comments]', articleHost)?.addEventListener('click', () => qs('#reader-thread')?.scrollIntoView({behavior:'smooth'}));
    qs('[data-reader-share]', articleHost)?.addEventListener('click', async event => {
      const button = event.currentTarget;
      try {
        if (navigator.share) await navigator.share({title: document.title, url: location.href});
        else { await navigator.clipboard.writeText(location.href); button.textContent = '✓ LINK COPIED'; setTimeout(() => button.textContent = '↗ SHARE', 1600); }
      } catch (_) {}
    });

    draw();
  }

  async function init() {
    const host = qs('#article');
    if (!host) return;
    const slug = new URLSearchParams(location.search).get('slug');
    if (!slug) return;
    let article;
    try {
      const response = await fetch(`data/articles/${encodeURIComponent(slug)}.json`);
      if (!response.ok) return;
      article = await response.json();
    } catch (_) { return; }

    const body = await waitForArticle();
    if (!body) return;
    enhanceRankedArticle(article, body);
    enhanceReview(article, body);
    renderThread(host, slug);
  }

  init();
})();
