window.NEURAL_CRITIC_SUPABASE = {
  url: 'https://pchrrwfdcfbytggekuzs.supabase.co',
  publishableKey: 'sb_publishable_T8ObjS3Mab7Do5aCXnP8nA_jvgYkf8T'
};

/* Public-action bridge: the browser keeps using the existing Supabase RPC API,
   but sensitive anonymous mutations are transparently routed through the
   rate-limited Edge gateway instead of executing privileged database RPCs. */
(() => {
  const config = window.NEURAL_CRITIC_SUPABASE;
  if (!config || !window.fetch || window.__neuralCriticPublicActionBridge) return;
  window.__neuralCriticPublicActionBridge = true;

  const nativeFetch = window.fetch.bind(window);
  const edgeUrl = `${config.url}/functions/v1/public-actions`;
  const actionMap = {
    subscribe_newsletter: body => ({ action:'subscribe', email:body.p_email || '', source:body.p_source || 'unknown' }),
    record_article_view: body => ({ action:'record_view', slug:body.p_slug || '' }),
    get_article_popularity: body => ({ action:'popularity', days:body.p_days ?? 7 })
  };

  const requestUrl = input => {
    try {
      if (typeof input === 'string') return input;
      if (input instanceof URL) return input.href;
      return input?.url || '';
    } catch (_) { return ''; }
  };

  const requestBody = async (input, init) => {
    try {
      if (typeof init?.body === 'string') return JSON.parse(init.body || '{}');
      if (input instanceof Request) {
        const text = await input.clone().text();
        return text ? JSON.parse(text) : {};
      }
    } catch (_) {}
    return {};
  };

  window.fetch = async (input, init={}) => {
    const url = requestUrl(input);
    let rpcName = '';
    try {
      const parsed = new URL(url, location.href);
      const match = parsed.pathname.match(/\/rest\/v1\/rpc\/([^/?#]+)$/);
      rpcName = match?.[1] || '';
    } catch (_) {}

    const map = actionMap[rpcName];
    if (!map) return nativeFetch(input, init);

    const body = await requestBody(input, init);
    const signal = init?.signal || (input instanceof Request ? input.signal : undefined);
    return nativeFetch(edgeUrl, {
      method:'POST',
      headers:{
        'content-type':'application/json',
        'apikey':config.publishableKey
      },
      body:JSON.stringify(map(body)),
      signal
    });
  };
})();

/* Shared public hardening: canonical/social metadata, structured data,
   crawler directives, canonical story routing, analytics, recirculation,
   configurable conclusions, structured news, Game Graph topic hubs,
   monetization readiness, public presentation scale, image hints,
   and newsletter acquisition. */
(() => {
  const pageName = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const STATIC_META_PAGES = new Set(['privacy.html', 'standards.html', 'commercial.html', 'topic.html', 'author.html']);

  const loadPublicScale = () => {
    if (pageName === 'studio.html' || pageName === 'subscribers.html') return;
    if (document.querySelector('link[data-nc-public-scale]')) return;
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = 'assets/public-scale.css?v=20260824-scale2';
    style.dataset.ncPublicScale = '1';
    document.head.appendChild(style);
  };

  const loadArticleThreadLayout = () => {
    if (!document.getElementById('article')) return;
    if (document.querySelector('link[data-nc-thread-layout]')) return;
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = 'assets/article-thread-layout.css?v=20260823-thread1';
    style.dataset.ncThreadLayout = '1';
    document.head.appendChild(style);
  };

  const loadStoryRouter = () => {
    if (pageName === 'studio.html' || pageName === 'subscribers.html') return;
    if (document.querySelector('script[data-nc-story-router]')) return;
    const router = document.createElement('script');
    router.src = 'assets/story-router.js?v=20260825-story8';
    router.async = true;
    router.dataset.ncStoryRouter = '1';
    document.head.appendChild(router);
  };

  const loadStoryReadinessGuard = () => {
    if (pageName === 'studio.html' || pageName === 'subscribers.html') return;
    if (document.querySelector('script[data-nc-story-readiness]')) return;
    const script = document.createElement('script');
    script.src = 'assets/story-readiness-guard.js?v=20260823-route1';
    script.async = true;
    script.dataset.ncStoryReadiness = '1';
    document.head.appendChild(script);
  };

  const loadHomepageCurationGuard = () => {
    if (pageName !== 'index.html') return;
    if (document.querySelector('script[data-nc-home-curation]')) return;
    const script = document.createElement('script');
    script.src = 'assets/home-curation-guard.js?v=20260823-home1';
    script.async = true;
    script.dataset.ncHomeCuration = '1';
    document.head.appendChild(script);
  };

  const loadNewsletter = () => {
    if (pageName === 'studio.html' || pageName === 'subscribers.html') return;
    if (document.querySelector('script[data-nc-newsletter]')) return;
    const script = document.createElement('script');
    script.src = 'assets/newsletter.js?v=20260901-newsletter1';
    script.async = true;
    script.dataset.ncNewsletter = '1';
    document.head.appendChild(script);
  };

  const loadStudioConclusion = () => {
    if (pageName !== 'studio.html') return;
    if (!document.querySelector('link[data-nc-studio-conclusion-style]')) {
      const style = document.createElement('link');
      style.rel = 'stylesheet';
      style.href = 'assets/studio-conclusion.css?v=20260823-conclusion1';
      style.dataset.ncStudioConclusionStyle = '1';
      document.head.appendChild(style);
    }
    if (!document.querySelector('script[data-nc-studio-conclusion]')) {
      const script = document.createElement('script');
      script.src = 'assets/studio-conclusion.js?v=20260823-conclusion1';
      script.async = true;
      script.dataset.ncStudioConclusion = '1';
      document.head.appendChild(script);
    }
  };

  const loadStudioNews = () => {
    if (pageName !== 'studio.html') return;
    if (!document.querySelector('link[data-nc-studio-news-style]')) {
      const style = document.createElement('link');
      style.rel = 'stylesheet';
      style.href = 'assets/studio-news.css?v=20260823-news1';
      style.dataset.ncStudioNewsStyle = '1';
      document.head.appendChild(style);
    }
    if (!document.querySelector('script[data-nc-studio-news]')) {
      const script = document.createElement('script');
      script.src = 'assets/studio-news.js?v=20260823-news1';
      script.async = true;
      script.dataset.ncStudioNews = '1';
      document.head.appendChild(script);
    }
  };

  const loadStudioNewsDuplicateGuard = () => {
    if (pageName !== 'studio.html') return;
    if (document.querySelector('script[data-nc-studio-news-duplicate-guard]')) return;
    const script = document.createElement('script');
    script.src = 'assets/studio-news-duplicate-guard.js?v=20260823-news2';
    script.async = true;
    script.dataset.ncStudioNewsDuplicateGuard = '1';
    document.head.appendChild(script);
  };

  const loadStudioGameGraph = () => {
    if (pageName !== 'studio.html') return;
    if (!document.querySelector('link[data-nc-studio-game-graph-style]')) {
      const style = document.createElement('link');
      style.rel = 'stylesheet';
      style.href = 'assets/studio-game-graph.css?v=20260823-graph1';
      style.dataset.ncStudioGameGraphStyle = '1';
      document.head.appendChild(style);
    }
    if (!document.querySelector('script[data-nc-studio-game-graph]')) {
      const script = document.createElement('script');
      script.src = 'assets/studio-game-graph.js?v=20260823-graph1';
      script.async = true;
      script.dataset.ncStudioGameGraph = '1';
      document.head.appendChild(script);
    }
  };

  const loadArticleConclusion = () => {
    if (!document.getElementById('article')) return;
    if (!document.querySelector('link[data-nc-article-conclusion-style]')) {
      const style = document.createElement('link');
      style.rel = 'stylesheet';
      style.href = 'assets/article-conclusion.css?v=20260823-conclusion1';
      style.dataset.ncArticleConclusionStyle = '1';
      document.head.appendChild(style);
    }
    if (!document.querySelector('script[data-nc-article-conclusion]')) {
      const script = document.createElement('script');
      script.src = 'assets/article-conclusion.js?v=20260823-conclusion1';
      script.async = true;
      script.dataset.ncArticleConclusion = '1';
      document.head.appendChild(script);
    }
  };

  const loadArticleNews = () => {
    if (!document.getElementById('article')) return;
    if (!document.querySelector('link[data-nc-article-news-style]')) {
      const style = document.createElement('link');
      style.rel = 'stylesheet';
      style.href = 'assets/article-news.css?v=20260823-news2';
      style.dataset.ncArticleNewsStyle = '1';
      document.head.appendChild(style);
    }
    if (!document.querySelector('script[data-nc-article-news]')) {
      const script = document.createElement('script');
      script.src = 'assets/article-news.js?v=20260823-news2';
      script.async = true;
      script.dataset.ncArticleNews = '1';
      document.head.appendChild(script);
    }
  };

  const loadArticleGameGraphIdentity = () => {
    if (!document.getElementById('article')) return;
    if (!document.querySelector('link[data-nc-game-graph-identity-style]')) {
      const style = document.createElement('link');
      style.rel = 'stylesheet';
      style.href = 'assets/game-graph-identity.css?v=20260823-graph1';
      style.dataset.ncGameGraphIdentityStyle = '1';
      document.head.appendChild(style);
    }
    if (!document.querySelector('script[data-nc-game-graph-identity]')) {
      const script = document.createElement('script');
      script.src = 'assets/game-graph-identity.js?v=20260823-graph1';
      script.async = true;
      script.dataset.ncGameGraphIdentity = '1';
      document.head.appendChild(script);
    }
  };

  const loadRecirculation = () => {
    if (!document.getElementById('article')) return;
    if (!document.querySelector('link[data-nc-recirculation-style]')) {
      const style = document.createElement('link');
      style.rel = 'stylesheet';
      style.href = 'assets/recirculation.css?v=20260823-recirc4';
      style.dataset.ncRecirculationStyle = '1';
      document.head.appendChild(style);
    }
    if (!document.querySelector('style[data-nc-recirculation-fine-tune]')) {
      const fineTune = document.createElement('style');
      fineTune.dataset.ncRecirculationFineTune = '1';
      fineTune.textContent = '.nc-recirc-head{padding:0 2px 10px!important}.nc-recirc-head>a{transform:translateY(-4px)}@media(max-width:720px){.nc-recirc-head{padding-bottom:8px!important}.nc-recirc-head>a{transform:none}}';
      document.head.appendChild(fineTune);
    }
    if (!document.querySelector('script[data-nc-recirculation]')) {
      const script = document.createElement('script');
      script.src = 'assets/recirculation.js?v=20260823-recirc4';
      script.async = true;
      script.dataset.ncRecirculation = '1';
      document.head.appendChild(script);
    }
  };

  const loadMonetization = () => {
    if (pageName === 'studio.html' || pageName === 'subscribers.html') return;
    if (!document.querySelector('link[data-nc-monetization-style]')) {
      const style = document.createElement('link');
      style.rel = 'stylesheet';
      style.href = 'assets/monetization.css?v=20260822-money1';
      style.dataset.ncMonetizationStyle = '1';
      document.head.appendChild(style);
    }
    if (document.querySelector('script[data-nc-monetization-config]')) return;
    const config = document.createElement('script');
    config.src = 'assets/monetization-config.js?v=20260822-money1';
    config.async = true;
    config.dataset.ncMonetizationConfig = '1';
    config.addEventListener('load', () => {
      if (document.querySelector('script[data-nc-monetization]')) return;
      const script = document.createElement('script');
      script.src = 'assets/monetization.js?v=20260822-money1';
      script.async = true;
      script.dataset.ncMonetization = '1';
      document.head.appendChild(script);
    }, { once: true });
    document.head.appendChild(config);
  };

  loadPublicScale();
  loadArticleThreadLayout();

  const shouldRuntimeHarden = !window.NEURAL_CRITIC_STATIC_META && !STATIC_META_PAGES.has(pageName);
  if (shouldRuntimeHarden && !document.querySelector('script[data-nc-hardening]')) {
    const hardening = document.createElement('script');
    hardening.src = 'assets/public-hardening.js?v=20260822-launch1';
    hardening.async = true;
    hardening.dataset.ncHardening = '1';
    hardening.addEventListener('load', loadStoryRouter, { once: true });
    hardening.addEventListener('error', loadStoryRouter, { once: true });
    document.head.appendChild(hardening);
  } else {
    loadStoryRouter();
  }

  loadStoryReadinessGuard();
  loadHomepageCurationGuard();
  loadNewsletter();
  loadStudioConclusion();
  loadStudioNews();
  loadStudioNewsDuplicateGuard();
  loadStudioGameGraph();
  loadArticleConclusion();
  loadArticleNews();
  loadArticleGameGraphIdentity();
  loadRecirculation();
  loadMonetization();

  if (document.querySelector('script[data-nc-analytics-config]')) return;
  const config = document.createElement('script');
  config.src = 'assets/analytics-config.js?v=20260822-analytics1';
  config.async = true;
  config.dataset.ncAnalyticsConfig = '1';
  config.addEventListener('load', () => {
    if (document.querySelector('script[data-nc-analytics]')) return;
    const analytics = document.createElement('script');
    analytics.src = 'assets/analytics.js?v=20260822-analytics2';
    analytics.async = true;
    analytics.dataset.ncAnalytics = '1';
    analytics.addEventListener('load', () => {
      window.dispatchEvent(new CustomEvent('neuralcritic:analytics-script-loaded'));
    }, { once: true });
    document.head.appendChild(analytics);
  }, { once: true });
  document.head.appendChild(config);
})();
