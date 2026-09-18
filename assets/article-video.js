(() => {
  const esc = (value='') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function youtubeId(raw) {
    try {
      const url = new URL(raw, location.href);
      if (url.hostname === 'youtu.be') return url.pathname.split('/').filter(Boolean)[0] || '';
      if (/(^|\.)youtube\.com$/.test(url.hostname) || /(^|\.)youtube-nocookie\.com$/.test(url.hostname)) {
        if (url.pathname === '/watch') return url.searchParams.get('v') || '';
        const match = url.pathname.match(/\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{6,})/);
        return match?.[1] || '';
      }
    } catch (_) {}
    return '';
  }

  function vimeoId(raw) {
    try {
      const url = new URL(raw, location.href);
      if (!/(^|\.)vimeo\.com$/.test(url.hostname)) return '';
      const match = url.pathname.match(/\/(?:video\/)?(\d{6,})/);
      return match?.[1] || '';
    } catch (_) { return ''; }
  }

  function directVideo(raw) {
    try {
      const url = new URL(raw, location.href);
      return /\.(mp4|webm|ogg)(?:$|[?#])/i.test(url.href) ? url.href : '';
    } catch (_) { return ''; }
  }

  function hydrate(node) {
    if (!node || node.dataset.videoReady === '1') return;
    node.dataset.videoReady = '1';
    const raw = node.dataset.videoUrl || '';
    const title = node.dataset.videoTitle || 'Article video';
    const caption = node.dataset.videoCaption || '';
    const poster = node.dataset.videoPoster || '';
    const yt = youtubeId(raw);
    const vm = vimeoId(raw);
    const direct = directVideo(raw);

    let player = '';
    if (yt) {
      player = `<iframe loading="lazy" src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(yt)}?rel=0" title="${esc(title)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
    } else if (vm) {
      player = `<iframe loading="lazy" src="https://player.vimeo.com/video/${encodeURIComponent(vm)}?dnt=1" title="${esc(title)}" allow="autoplay; fullscreen; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
    } else if (direct) {
      player = `<video controls playsinline preload="metadata"${poster ? ` poster="${esc(poster)}"` : ''}><source src="${esc(direct)}"></video>`;
    } else {
      player = `<div class="article-video-fallback"><a href="${esc(raw)}" target="_blank" rel="noopener noreferrer">OPEN VIDEO SOURCE ↗</a></div>`;
    }

    node.innerHTML = `<div class="article-video-frame">${player}</div>${caption ? `<p class="article-video-caption">${esc(caption)}</p>` : ''}`;
  }

  function scan(root=document) {
    root.querySelectorAll?.('[data-nc-video]').forEach(hydrate);
  }

  const article = document.getElementById('article');
  if (article) {
    scan(article);
    new MutationObserver(() => scan(article)).observe(article, { childList:true, subtree:true });
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => scan(), { once:true });
  } else scan();
})();