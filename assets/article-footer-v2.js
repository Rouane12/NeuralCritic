(() => {
  'use strict';

  const STYLE_HREF = 'assets/article-footer-v2.css?v=20260912-footer1';
  const host = document.getElementById('shared-footer');
  if (!host) return;

  const currentSlug = () => {
    const staticSlug = String(window.NEURAL_CRITIC_STATIC_SLUG || '').trim();
    if (staticSlug) return staticSlug;
    const querySlug = new URLSearchParams(location.search).get('slug') || '';
    if (querySlug) return querySlug;
    const match = location.pathname.match(/\/stories\/([^/]+)\/?$/i);
    try { return match?.[1] ? decodeURIComponent(match[1]) : ''; }
    catch (_) { return match?.[1] || ''; }
  };

  function ensureStyles() {
    if (document.querySelector('link[data-nc-article-footer-v2]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = STYLE_HREF;
    link.dataset.ncArticleFooterV2 = '1';
    document.head.appendChild(link);
  }

  function trackView(footer, slug) {
    if (!('IntersectionObserver' in window) || footer.dataset.footerViewTracked === '1') return;
    footer.dataset.footerViewTracked = '1';
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      window.NeuralCriticAnalytics?.track?.('publication_footer_view', {
        surface: 'article',
        source_slug: slug || ''
      });
    }, { threshold: 0.22 });
    observer.observe(footer);
  }

  function upgradeFooter() {
    const footer = host.querySelector('footer');
    if (!footer || footer.dataset.ncFooterV2 === '1') return false;

    const slug = currentSlug();
    footer.dataset.ncFooterV2 = '1';
    footer.className = 'nc-publication-footer';
    footer.setAttribute('aria-label', 'Neural Critic publication footer');
    footer.innerHTML = `
      <div class="nc-footer-accent" aria-hidden="true"></div>
      <div class="nc-footer-shell">
        <section class="nc-footer-identity" aria-labelledby="nc-footer-brand-name">
          <a class="nc-footer-brand" href="/" aria-label="Neural Critic home">
            <span id="nc-footer-brand-name">NEURAL <strong>CRITIC</strong></span>
            <small>INDEPENDENT GAMING PUBLICATION</small>
          </a>
          <p>Reader-first gaming news, reviews, guides and features for players who want the signal—not the noise.</p>
          <div class="nc-footer-independence"><i aria-hidden="true"></i><span>Independent editorial coverage</span></div>
        </section>

        <nav class="nc-footer-directory" aria-label="Neural Critic footer navigation">
          <section>
            <h2>EXPLORE</h2>
            <a href="/category.html?section=news">News</a>
            <a href="/category.html?section=reviews">Reviews</a>
            <a href="/category.html?section=guides">Guides</a>
            <a href="/category.html?section=features">Features</a>
            <a href="/category.html?section=what-to-play">What to Play</a>
            <a href="/games/">Games</a>
          </section>
          <section>
            <h2>PUBLICATION</h2>
            <a href="/about.html">Our mission</a>
            <a href="/standards.html">Editorial standards</a>
            <a href="/commercial.html">Commercial policy</a>
            <a href="/privacy.html">Privacy</a>
            <a href="/about.html#contact">Contact</a>
          </section>
          <section>
            <h2>KEEP EXPLORING</h2>
            <a href="/search.html">Search Neural Critic</a>
            <a href="/feed.xml" type="application/rss+xml">RSS feed</a>
            <a href="/category.html?section=latest">Latest stories</a>
            <button type="button" class="nc-footer-top" data-footer-top>Back to top <span aria-hidden="true">↑</span></button>
          </section>
        </nav>
      </div>

      <div class="nc-footer-bottom">
        <div class="nc-footer-bottom-inner">
          <p>© <span data-footer-year></span> Neural Critic. Built for players.</p>
          <div>
            <a href="/standards.html">Standards</a>
            <a href="/privacy.html">Privacy</a>
            <a href="/commercial.html">Disclosure</a>
          </div>
        </div>
      </div>`;

    const year = footer.querySelector('[data-footer-year]');
    if (year) year.textContent = String(new Date().getFullYear());

    footer.querySelector('[data-footer-top]')?.addEventListener('click', () => {
      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
      window.NeuralCriticAnalytics?.track?.('publication_footer_back_to_top', {
        surface: 'article',
        source_slug: slug || ''
      });
    });

    footer.addEventListener('click', event => {
      const link = event.target.closest('a[href]');
      if (!link) return;
      let destination = link.getAttribute('href') || '';
      try { destination = new URL(link.href, location.href).pathname; } catch (_) {}
      window.NeuralCriticAnalytics?.track?.('publication_footer_navigate', {
        surface: 'article',
        source_slug: slug || '',
        destination
      });
    });

    trackView(footer, slug);
    return true;
  }

  function init() {
    ensureStyles();
    if (upgradeFooter()) return;

    const observer = new MutationObserver(() => {
      if (upgradeFooter()) observer.disconnect();
    });
    observer.observe(host, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 9000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
