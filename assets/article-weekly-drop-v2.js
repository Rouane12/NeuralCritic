(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = (value = '') => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

  function ensureStyle() {
    if (document.querySelector('link[data-nc-weekly-drop-v2]')) return;
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = 'assets/article-weekly-drop-v2.css?v=20260912-weeklydrop1';
    style.dataset.ncWeeklyDropV2 = '1';
    document.head.appendChild(style);
  }

  function currentSlug() {
    const staticSlug = String(window.NEURAL_CRITIC_STATIC_SLUG || '').trim();
    if (staticSlug) return staticSlug;
    const querySlug = new URLSearchParams(location.search).get('slug') || '';
    if (querySlug) return querySlug;
    const match = location.pathname.match(/\/stories\/([^/]+)\/?$/i);
    try { return match?.[1] ? decodeURIComponent(match[1]) : ''; }
    catch (_) { return match?.[1] || ''; }
  }

  function removeDuplicateCards() {
    $$('.work-weekly-card').forEach(card => card.remove());
  }

  function trackView(band, slug) {
    if (!('IntersectionObserver' in window) || band.dataset.weeklyDropTracking === '1') return;
    band.dataset.weeklyDropTracking = '1';
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      window.NeuralCriticAnalytics?.track?.('weekly_drop_view', {
        placement:'article_end',
        source_slug:slug || ''
      });
    }, { threshold:0.35 });
    observer.observe(band);
  }

  function upgradeBand(band) {
    if (!band || band.dataset.weeklyDropV2 === '1') return false;

    const slug = currentSlug();
    const source = slug ? `article:${slug}` : 'article';
    removeDuplicateCards();

    band.dataset.weeklyDropV2 = '1';
    band.id = 'weekly-drop';
    band.classList.add('nc-weekly-drop-v2');
    band.setAttribute('aria-labelledby', 'weekly-drop-title');
    band.innerHTML = `
      <div class="nc-weekly-drop-copy">
        <div class="nc-weekly-drop-kicker"><i aria-hidden="true">ϟ</i><span>THE WEEKLY DROP</span><b>EVERY FRIDAY</b></div>
        <h2 id="weekly-drop-title">The week in games, distilled.</h2>
        <p>One sharp Friday email with the stories that mattered, the reads worth keeping, and what deserves your time next.</p>
        <div class="nc-weekly-drop-value" aria-label="What the Weekly Drop includes">
          <span><b aria-hidden="true">01</b> BIGGEST STORIES</span>
          <span><b aria-hidden="true">02</b> EDITOR'S PICKS</span>
          <span><b aria-hidden="true">03</b> WHAT TO PLAY</span>
        </div>
      </div>
      <div class="nc-weekly-drop-signup">
        <span>FREE WEEKLY BRIEF</span>
        <h3>Get the signal. Skip the scroll.</h3>
        <form data-newsletter data-band-newsletter data-newsletter-source="${esc(source)}">
          <label class="nc-visually-hidden" for="weekly-drop-email">Email address</label>
          <div class="nc-weekly-drop-form-row">
            <input id="weekly-drop-email" type="email" name="email" required autocomplete="email" inputmode="email" placeholder="you@email.com" aria-describedby="weekly-drop-note">
            <button type="submit">GET THE DROP <span aria-hidden="true">→</span></button>
          </div>
        </form>
        <small id="weekly-drop-note">One email every Friday. Free to join.</small>
      </div>`;

    const form = $('[data-newsletter]', band);
    form?.addEventListener('focusin', () => {
      if (form.dataset.focusTracked === '1') return;
      form.dataset.focusTracked = '1';
      window.NeuralCriticAnalytics?.track?.('weekly_drop_form_focus', {
        placement:'article_end',
        source_slug:slug || ''
      });
    });

    window.addEventListener('neuralcritic:newsletter-subscribed', event => {
      if (event.detail?.source && event.detail.source !== source) return;
      band.classList.add('is-subscribed');
    });

    trackView(band, slug);
    return true;
  }

  function init() {
    ensureStyle();
    removeDuplicateCards();
    const immediate = $('.work-newsletter-band');
    if (upgradeBand(immediate)) return;

    const host = $('#article') || document.body;
    const observer = new MutationObserver(() => {
      removeDuplicateCards();
      if (upgradeBand($('.work-newsletter-band'))) observer.disconnect();
    });
    observer.observe(host, { childList:true, subtree:true });
    setTimeout(() => observer.disconnect(), 9000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();
})();
