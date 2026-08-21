(() => {
  const nativeFetch = window.fetch.bind(window);
  const mediaMarker = '/media/editorial/';

  function localize(value) {
    if (typeof value === 'string' && /^https?:\/\//i.test(value) && value.includes(mediaMarker)) {
      const filename = value.split(mediaMarker)[1]?.split(/[?#]/)[0];
      return filename ? `images/editorial/${filename}` : value;
    }
    if (Array.isArray(value)) return value.map(localize);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, localize(item)]));
    }
    return value;
  }

  window.fetch = async (...args) => {
    const response = await nativeFetch(...args);
    const requestUrl = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
    const isArticleData = requestUrl.includes('data/articles.json') || requestUrl.includes('data/articles/');
    if (!isArticleData || !response.ok) return response;

    try {
      const payload = await response.clone().json();
      const localized = localize(payload);
      return new Response(JSON.stringify(localized), {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } catch (_) {
      return response;
    }
  };

  if (!document.querySelector('script[data-publication-nav]')) {
    const script = document.createElement('script');
    script.src = 'assets/publication-nav.js';
    script.dataset.publicationNav = '1';
    document.head.appendChild(script);
  }
})();
