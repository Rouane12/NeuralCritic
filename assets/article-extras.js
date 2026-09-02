(() => {
  const qs = (s, root = document) => root.querySelector(s);
  const qsa = (s, root = document) => [...root.querySelectorAll(s)];
  const esc = (value = '') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const inline = (value = '') => esc(value).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>');
  const paras = (text = '') => text.split(/\n\n+/).filter(Boolean).map(p => `<p>${inline(p).replace(/\n/g, '<br>')}</p>`).join('');
  const AUTHOR_AVATAR = 'images/editorial/499627ae-e4d1-40d6-be0d-45efc750a1d9.jpg';

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

  function slugifyHeading(value='') {
    return value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  }

  function readMinutes(article) {
    const all = [
      article.body || '',
      ...(article.contentBlocks || []).map(b => b.text || ''),
      article.conclusion || ''
    ].join(' ');
    const words = all.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(words / 220));
  }

  function enhanceHeader(article, host) {
    host.classList.add('work-article-page');
    const meta = qs(':scope > .article-meta', host);
    if (meta) {
      meta.classList.add('work-author-row');
      const published = article.publishedAt ? new Date(article.publishedAt) : null;
      const dateText = published && !Number.isNaN(published.valueOf())
        ? new Intl.DateTimeFormat('en-US', {month:'long', day:'numeric', year:'numeric', hour:'numeric', minute:'2-digit'}).format(published)
        : '';
      meta.innerHTML = `
        <img class="work-author-avatar" src="${AUTHOR_AVATAR}" alt="${esc(article.author || 'Neural Critic author')}">
        <div class="work-author-copy">
          <strong>${esc(article.author || 'Neural Critic')}</strong>
          <span>Published ${esc(dateText)}</span>
        </div>
        <span class="work-read-time">${readMinutes(article)} min read</span>`;
    }

    const hero = qs(':scope > .article-hero', host);
    if (hero && hero.tagName === 'IMG' && !hero.closest('.work-hero-figure')) {
      const figure = document.createElement('figure');
      figure.className = 'work-hero-figure';
      hero.parentNode.insertBefore(figure, hero);
      figure.appendChild(hero);
      figure.insertAdjacentHTML('beforeend', `<figcaption>${esc(article.imageAlt || article.title || '')}</figcaption>`);
    }
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

  function addQuickRead(article, body) {
    if (qs('.quick-read', body) || article.articleFormat === 'ranked-list') return;
    const firstSection = qs(':scope > section', body);
    const markup = `<aside class="quick-read work-quick-read"><span>THE QUICK READ</span><p>${esc(article.description || '')}</p></aside>`;
    if (firstSection) firstSection.insertAdjacentHTML('beforebegin', markup);
    else body.insertAdjacentHTML('afterbegin', markup);
  }

  function decorateFigures(article, body) {
    qsa(':scope > section', body).forEach((section, i) => {
      const block = (article.contentBlocks || [])[i];
      const figure = qs('figure', section);
      if (!figure || figure.dataset.workCaptioned) return;
      figure.dataset.workCaptioned = 'true';
      figure.classList.add('work-inline-figure');
      let caption = qs('figcaption', figure);
      if (!caption) {
        caption = document.createElement('figcaption');
        caption.textContent = block?.caption || block?.imageAlt || '';
        figure.appendChild(caption);
      }
      if (caption && !qs('.work-credit', caption)) {
        const text = caption.textContent.trim();
        caption.innerHTML = `${esc(text)}${text ? ' · ' : ''}<span class="work-credit">Official screenshot</span>`;
      }
    });
  }

  function buildReadingLayout(article, body) {
    const host = qs('#article');
    if (!host || qs('.work-reading-grid', host)) return;

    const sections = qsa(':scope > section', body);
    const tocLinks = sections.map((section, index) => {
      const h2 = qs('h2', section);
      if (!h2) return '';
      const id = slugifyHeading(h2.textContent) || `section-${index + 1}`;
      section.id = id;
      return `<a href="#${id}">${esc(h2.textContent)}</a>`;
    }).filter(Boolean).join('');

    const grid = document.createElement('div');
    grid.className = 'work-reading-grid';
    body.parentNode.insertBefore(grid, body);
    grid.appendChild(body);

    grid.insertAdjacentHTML('afterbegin', `
      <aside class="work-react-rail" aria-label="Article reactions">
        <span>REACT</span>
        <button type="button" data-article-like><b>♥</b><small>LIKE</small></button>
        <button type="button" data-article-follow><b>★</b><small>FOLLOW</small></button>
        <button type="button" data-article-discuss><b>◌</b><small>DISCUSS</small></button>
        <button type="button" data-article-share><b>↗</b><small>SHARE</small></button>
      </aside>`);

    grid.insertAdjacentHTML('beforeend', `
      <aside class="work-article-sidebar">
        <section class="work-side-card work-toc">
          <span>IN THIS ARTICLE</span>
          <nav>${tocLinks || '<p>No sections yet.</p>'}</nav>
        </section>
        <section class="work-side-card work-author-card">
          <span>AUTHOR</span>
          <div class="work-author-card-row">
            <img src="${AUTHOR_AVATAR}" alt="${esc(article.author || 'Neural Critic author')}">
            <div><strong>${esc(article.author || 'Neural Critic')}</strong><small>Neural Critic</small></div>
          </div>
          <p>Following this writer keeps their latest features and reviews close at hand.</p>
          <button type="button" data-author-follow>FOLLOW</button>
        </section>
        <section class="work-side-card work-weekly-card">
          <b>ϟ</b><span>THE WEEKLY DROP</span>
          <h3>One smart gaming email.</h3>
          <p>Our best stories, every Friday.</p>
          <form data-side-newsletter><input type="email" required placeholder="you@email.com"><button>JOIN FREE</button></form>
        </section>
      </aside>`);

    const likeBtn = qs('[data-article-like]', grid);
    const likeKey = `neural-critic-article-like:${article.slug}`;
    if (localStorage.getItem(likeKey) === '1') likeBtn?.classList.add('active');
    likeBtn?.addEventListener('click', () => {
      const next = likeBtn.classList.toggle('active');
      localStorage.setItem(likeKey, next ? '1' : '0');
    });
    qs('[data-article-discuss]', grid)?.addEventListener('click', () => qs('#reader-thread')?.scrollIntoView({behavior:'smooth'}));
    qs('[data-article-share]', grid)?.addEventListener('click', async event => {
      try {
        if (navigator.share) await navigator.share({title: document.title, url: location.href});
        else {
          await navigator.clipboard.writeText(location.href);
          const small = qs('small', event.currentTarget);
          if (small) { small.textContent = 'COPIED'; setTimeout(() => small.textContent = 'SHARE', 1400); }
        }
      } catch (_) {}
    });
    qsa('[data-author-follow],[data-article-follow]', grid).forEach(btn => {
      btn.addEventListener('click', () => {
        const active = !btn.classList.contains('active');
        qsa('[data-author-follow],[data-article-follow]', grid).forEach(x => {
          x.classList.toggle('active', active);
          if (x.matches('[data-author-follow]')) x.textContent = active ? 'FOLLOWING' : 'FOLLOW';
          const sm = qs('small', x); if (sm && x.matches('[data-article-follow]')) sm.textContent = active ? 'FOLLOWING' : 'FOLLOW';
        });
      });
    });
    qs('[data-side-newsletter]', grid)?.addEventListener('submit', event => {
      event.preventDefault();
      event.currentTarget.innerHTML = '<p class="work-signup-success">You’re in. Welcome to the Weekly Drop.</p>';
    });
  }

  const commentsKey = slug => `neural-critic-comments:${slug}`;
  const likesKey = slug => `neural-critic-comment-likes:${slug}`;
  const identityKey = 'neural-critic-reader-identity';

  function loadJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch (_) { return fallback; }
  }
  function saveJson(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {} }
  function initials(name) { return name.trim().split(/\s+/).slice(0,2).map(x => x[0]?.toUpperCase() || '').join('') || 'NC'; }
  function formatTime(iso) {
    try { return new Intl.DateTimeFormat('en', {dateStyle:'medium', timeStyle:'short'}).format(new Date(iso)); } catch (_) { return ''; }
  }

  async function renderRelated(article, sidebar) {
    let all = [];
    try { all = await fetch('data/articles.json').then(r => r.json()); } catch (_) {}
    const related = all.filter(x => x.slug !== article.slug)
      .sort((a,b) => Number((b.tags||[]).some(t => (article.tags||[]).includes(t))) - Number((a.tags||[]).some(t => (article.tags||[]).includes(t))))
      .slice(0,3);
    if (!related.length) return;
    sidebar.insertAdjacentHTML('afterbegin', `
      <section class="work-side-card work-related-card">
        <span>MORE FROM NEURAL CRITIC</span>
        ${related.map(x => `<a href="article.html?slug=${encodeURIComponent(x.slug)}"><b>${esc(x.title)}</b><small>${esc(x.category || '')}</small></a>`).join('')}
      </section>`);
  }

  function renderThread(articleHost, article) {
    if (qs('.article-thread', articleHost)) return;
    const slug = article.slug;
    const identity = loadJson(identityKey, {name:'Reader'});
    articleHost.insertAdjacentHTML('beforeend', `
      <section class="work-bottom-grid">
        <div>
          <section class="article-thread" id="reader-thread">
            <div class="thread-head">
              <div><span>READER THREAD</span><h2>Join the conversation</h2></div>
              <div class="thread-head-right"><b data-thread-count>0 COMMENTS</b><button type="button" data-thread-sort>NEWEST</button></div>
            </div>
            <div class="thread-identity">
              <div><img src="${AUTHOR_AVATAR}" alt=""><span>Your identity</span><strong data-reader-name>${esc(identity.name || 'Reader')}</strong></div>
              <button type="button" data-edit-identity>EDIT</button>
            </div>
            <p class="thread-prompt">What did you notice about ${esc(article.title)}?</p>
            <form data-thread-form>
              <input class="thread-name" name="name" maxlength="40" value="${esc(identity.name || '')}" placeholder="Display name" autocomplete="name" required>
              <textarea name="comment" maxlength="1200" placeholder="Share your perspective with other players..." required></textarea>
              <div><small><span data-thread-remaining>1200</span> characters remaining</small><button type="submit">JOIN DISCUSSION</button></div>
              <p class="thread-error" data-thread-error hidden></p>
            </form>
            <div class="thread-list" data-thread-list></div>
          </section>
        </div>
        <aside class="work-bottom-sidebar">
          <section class="work-side-card work-follow-card">
            <span>FOLLOW NEURAL CRITIC</span>
            <div><img src="${AUTHOR_AVATAR}" alt="${esc(article.author || 'Neural Critic author')}"><p><strong>${esc(article.author || 'Neural Critic')}</strong><small>Editor</small></p><button type="button">FOLLOWING</button></div>
          </section>
          <div data-related-slot></div>
          <section class="work-side-card work-weekly-card">
            <b>ϟ</b><span>THE WEEKLY DROP</span>
            <h3>One smart gaming email.</h3>
            <p>Our best stories, every Friday.</p>
            <form data-bottom-newsletter><input type="email" required placeholder="you@email.com"><button>JOIN FREE</button></form>
          </section>
        </aside>
      </section>
      <section class="work-newsletter-band">
        <div><span>THE WEEKLY DROP</span><h2>Gaming news, minus the noise.</h2><p>A sharp weekly digest of the stories worth your attention.</p></div>
        <form data-band-newsletter><input type="email" required placeholder="you@email.com"><button>JOIN FREE →</button></form>
      </section>`);

    const form = qs('[data-thread-form]', articleHost);
    const textarea = qs('textarea', form);
    const nameInput = qs('.thread-name', form);
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
    qs('[data-edit-identity]', articleHost)?.addEventListener('click', () => nameInput.focus());
    nameInput.addEventListener('change', () => {
      const name = nameInput.value.trim() || 'Reader';
      saveJson(identityKey, {name});
      qs('[data-reader-name]', articleHost).textContent = name;
    });
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
      saveJson(identityKey, {name});
      qs('[data-reader-name]', articleHost).textContent = name;
      error.hidden = true;
      comments.unshift({id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`, name, text, createdAt: new Date().toISOString(), likes: 0});
      saveJson(commentsKey(slug), comments);
      textarea.value = '';
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

    qsa('[data-bottom-newsletter],[data-band-newsletter]', articleHost).forEach(formEl => formEl.addEventListener('submit', event => {
      event.preventDefault();
      event.currentTarget.innerHTML = '<p class="work-signup-success">You’re in. See you Friday.</p>';
    }));

    const relatedSlot = qs('[data-related-slot]', articleHost);
    if (relatedSlot) renderRelated(article, relatedSlot);
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
    enhanceHeader(article, host);
    enhanceRankedArticle(article, body);
    enhanceReview(article, body);
    addQuickRead(article, body);
    decorateFigures(article, body);
    buildReadingLayout(article, body);
    renderThread(host, article);
  }

  init();
})();
