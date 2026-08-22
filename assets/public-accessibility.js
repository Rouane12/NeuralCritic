(() => {
  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => [...r.querySelectorAll(s)];
  let lastDialogTrigger = null;

  function mobileNavOpen() {
    return document.body.classList.contains('mobile-nav-open');
  }

  function syncMobileNav() {
    const menu = qs('header .menu');
    const nav = qs('header nav');
    if (!menu || !nav) return;
    if (!nav.id) nav.id = 'publication-navigation';
    menu.type = 'button';
    menu.setAttribute('aria-controls', nav.id);
    menu.setAttribute('aria-expanded', String(mobileNavOpen()));
    menu.setAttribute('aria-label', mobileNavOpen() ? 'Close navigation' : 'Open navigation');
    nav.setAttribute('aria-label', 'Primary navigation');
  }

  function closeMobileNav({focus = false} = {}) {
    if (!mobileNavOpen()) return;
    document.body.classList.remove('mobile-nav-open');
    qsa('header .publication-nav .nav-group.open').forEach(group => group.classList.remove('open'));
    syncMobileNav();
    if (focus) qs('header .menu')?.focus();
  }

  function syncThemeControl() {
    const light = document.documentElement.dataset.theme === 'light';
    qsa('.theme-toggle').forEach(button => {
      button.type = 'button';
      button.setAttribute('aria-label', light ? 'Switch to dark mode' : 'Switch to light mode');
      button.setAttribute('aria-pressed', String(light));
    });
  }

  function dialogFocusable(dialog) {
    return qsa('a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])', dialog)
      .filter(el => !el.hidden && el.getClientRects().length);
  }

  function syncAccountDialog() {
    const modal = qs('.reader-auth-modal');
    const trigger = qs('.reader-account-button');
    if (!modal || !trigger) return;
    if (!modal.id) modal.id = 'reader-account-dialog';
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-controls', modal.id);
    trigger.setAttribute('aria-expanded', String(!modal.hidden));
    const card = qs('.reader-auth-card', modal);
    if (card) card.setAttribute('tabindex', '-1');
  }

  function focusOpenedDialog() {
    const modal = qs('.reader-auth-modal:not([hidden])');
    if (!modal) return;
    const card = qs('.reader-auth-card', modal);
    const preferred = qs('input:not([hidden]):not([disabled]),button:not([disabled])', card || modal);
    (preferred || card)?.focus({preventScroll:true});
  }

  function installObserver() {
    const observer = new MutationObserver(mutations => {
      let chromeChanged = false;
      let dialogChanged = false;
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.target === document.documentElement && mutation.attributeName === 'data-theme') syncThemeControl();
        if (mutation.type === 'attributes' && mutation.target.classList?.contains('reader-auth-modal') && mutation.attributeName === 'hidden') dialogChanged = true;
        if (mutation.type === 'childList') { chromeChanged = true; dialogChanged = true; }
      }
      if (chromeChanged) syncMobileNav();
      if (dialogChanged) {
        const wasOpen = qs('.reader-account-button')?.getAttribute('aria-expanded') === 'true';
        syncAccountDialog();
        const isOpen = !!qs('.reader-auth-modal:not([hidden])');
        if (isOpen && !wasOpen) requestAnimationFrame(focusOpenedDialog);
        if (!isOpen && wasOpen && lastDialogTrigger?.isConnected) lastDialogTrigger.focus({preventScroll:true});
      }
    });
    observer.observe(document.documentElement, {subtree:true, childList:true, attributes:true, attributeFilter:['hidden','data-theme']});
  }

  document.addEventListener('click', event => {
    const menu = event.target.closest?.('header .menu');
    if (menu) requestAnimationFrame(syncMobileNav);

    if (event.target.closest?.('header nav a')) closeMobileNav();

    const account = event.target.closest?.('.reader-account-button');
    if (account) {
      lastDialogTrigger = account;
      requestAnimationFrame(() => { syncAccountDialog(); focusOpenedDialog(); });
    }

    if (event.target.closest?.('.reader-auth-close')) requestAnimationFrame(syncAccountDialog);
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      if (mobileNavOpen()) {
        event.preventDefault();
        closeMobileNav({focus:true});
        return;
      }
      const modal = qs('.reader-auth-modal:not([hidden])');
      if (modal) {
        event.preventDefault();
        qs('.reader-auth-close', modal)?.click();
        return;
      }
      const overlay = qs('.search-overlay.open');
      if (overlay) {
        event.preventDefault();
        qs('.search-close', overlay)?.click();
      }
      return;
    }

    if (event.key !== 'Tab') return;
    const modal = qs('.reader-auth-modal:not([hidden])');
    if (!modal) return;
    const items = dialogFocusable(modal);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 980) closeMobileNav();
  }, {passive:true});

  function init() {
    syncMobileNav();
    syncThemeControl();
    syncAccountDialog();
    installObserver();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
