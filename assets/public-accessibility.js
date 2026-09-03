(() => {
  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => [...r.querySelectorAll(s)];
  let lastDialogTrigger = null;
  let lastSearchTrigger = null;

  function mobileNavOpen() {
    return document.body.classList.contains('mobile-nav-open');
  }

  function installAccessibilityStyles() {
    if (document.getElementById('nc-accessibility-chrome')) return;
    const style = document.createElement('style');
    style.id = 'nc-accessibility-chrome';
    style.textContent = `
      .nc-skip-link{position:fixed;z-index:12000;left:16px;top:14px;transform:translateY(-140%);padding:10px 14px;border:2px solid #55dff5;border-radius:9px;background:#07111f;color:#fff;font:800 11px/1 Inter,system-ui,sans-serif;letter-spacing:.04em;text-decoration:none;box-shadow:0 10px 28px rgba(0,0,0,.28);transition:transform .15s ease}
      .nc-skip-link:focus{transform:none}
      :where(a,button,input,textarea,select,[tabindex]):focus-visible{outline:3px solid rgba(85,223,245,.92);outline-offset:3px}
      html[data-theme="light"] .nc-skip-link{background:#fff;color:#17212f}
      @media(prefers-reduced-motion:reduce){.nc-skip-link{transition:none}}
    `;
    document.head.appendChild(style);
  }

  function installSkipLink() {
    if (qs('.nc-skip-link')) return;
    const main = qs('main');
    if (!main) return;
    if (!main.id) main.id = 'main-content';
    const link = document.createElement('a');
    link.className = 'nc-skip-link';
    link.href = `#${main.id}`;
    link.textContent = 'Skip to main content';
    link.addEventListener('click', event => {
      event.preventDefault();
      if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
      main.focus({ preventScroll: true });
      main.scrollIntoView({ block: 'start' });
    });
    document.body.prepend(link);
  }

  function syncSubmenus() {
    qsa('header .publication-nav .nav-group').forEach((group, index) => {
      const button = qs('.nav-trigger', group);
      const menu = qs('.nav-menu', group);
      if (!button || !menu) return;
      if (!menu.id) menu.id = `publication-submenu-${index + 1}`;
      button.setAttribute('aria-controls', menu.id);
      button.setAttribute('aria-expanded', String(group.classList.contains('open')));
    });
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
    syncSubmenus();
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

  function syncSearchDialog() {
    const overlay = qs('.search-overlay');
    const panel = qs('.search-panel', overlay || document);
    const trigger = qs('.header-tools .search');
    if (!overlay || !panel || !trigger) return;
    if (!panel.id) panel.id = 'neural-critic-search-dialog';
    const open = overlay.classList.contains('open');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', 'Search Neural Critic');
    overlay.setAttribute('aria-hidden', String(!open));
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-controls', panel.id);
    trigger.setAttribute('aria-expanded', String(open));
    const close = qs('.search-close', panel);
    if (close) {
      close.type = 'button';
      close.setAttribute('aria-label', 'Close search');
    }
  }

  function focusSearchDialog() {
    const overlay = qs('.search-overlay.open');
    if (!overlay) return;
    const input = qs('#quick-search,input[type="search"]', overlay);
    const panel = qs('.search-panel', overlay);
    (input || panel)?.focus({preventScroll:true});
  }

  function restoreSearchFocus() {
    const trigger = lastSearchTrigger?.isConnected ? lastSearchTrigger : qs('.header-tools .search');
    if (!trigger) return;
    lastSearchTrigger = trigger;
    trigger.focus({preventScroll:true});
  }

  function installObserver() {
    const observer = new MutationObserver(mutations => {
      let chromeChanged = false;
      let dialogChanged = false;
      let searchChanged = false;
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.target === document.documentElement && mutation.attributeName === 'data-theme') syncThemeControl();
        if (mutation.type === 'attributes' && mutation.target.classList?.contains('reader-auth-modal') && mutation.attributeName === 'hidden') dialogChanged = true;
        if (mutation.type === 'attributes' && mutation.target.classList?.contains('search-overlay') && mutation.attributeName === 'class') searchChanged = true;
        if (mutation.type === 'childList') { chromeChanged = true; dialogChanged = true; searchChanged = true; }
      }
      if (chromeChanged) {
        syncMobileNav();
        installSkipLink();
      }
      if (dialogChanged) {
        const wasOpen = qs('.reader-account-button')?.getAttribute('aria-expanded') === 'true';
        syncAccountDialog();
        const isOpen = !!qs('.reader-auth-modal:not([hidden])');
        if (isOpen && !wasOpen) requestAnimationFrame(focusOpenedDialog);
        if (!isOpen && wasOpen && lastDialogTrigger?.isConnected) lastDialogTrigger.focus({preventScroll:true});
      }
      if (searchChanged) {
        const wasOpen = qs('.header-tools .search')?.getAttribute('aria-expanded') === 'true';
        syncSearchDialog();
        const isOpen = !!qs('.search-overlay.open');
        if (isOpen && !wasOpen) requestAnimationFrame(focusSearchDialog);
        if (!isOpen && wasOpen) setTimeout(restoreSearchFocus, 0);
      }
    });
    observer.observe(document.documentElement, {subtree:true, childList:true, attributes:true, attributeFilter:['hidden','data-theme','class']});
  }

  document.addEventListener('click', event => {
    const menu = event.target.closest?.('header .menu');
    if (menu) requestAnimationFrame(syncMobileNav);

    const trigger = event.target.closest?.('header .publication-nav .nav-trigger');
    if (trigger) requestAnimationFrame(syncSubmenus);

    if (event.target.closest?.('header nav a')) closeMobileNav();

    if (mobileNavOpen() && !event.target.closest?.('header .header')) {
      closeMobileNav();
    }

    const account = event.target.closest?.('.reader-account-button');
    if (account) {
      lastDialogTrigger = account;
      requestAnimationFrame(() => { syncAccountDialog(); focusOpenedDialog(); });
    }

    if (event.target.closest?.('.reader-auth-close')) requestAnimationFrame(syncAccountDialog);

    const searchTrigger = event.target.closest?.('.header-tools .search');
    if (searchTrigger) {
      lastSearchTrigger = searchTrigger;
      requestAnimationFrame(() => { syncSearchDialog(); focusSearchDialog(); });
    }

    if (event.target.closest?.('.search-close')) {
      setTimeout(() => { syncSearchDialog(); restoreSearchFocus(); }, 0);
    }
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
    const search = qs('.search-overlay.open .search-panel');
    const activeDialog = modal || search;
    if (!activeDialog) return;
    const items = dialogFocusable(activeDialog);
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
    installAccessibilityStyles();
    installSkipLink();
    syncMobileNav();
    syncThemeControl();
    syncAccountDialog();
    syncSearchDialog();
    installObserver();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
