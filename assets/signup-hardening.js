(() => {
  'use strict';

  const MIN_NEW_PASSWORD = 8;
  const $ = (selector, root=document) => root.querySelector(selector);

  function setMessage(selector, message) {
    const el = $(selector);
    if (!el) return;
    el.textContent = message;
    el.classList.add('error');
  }

  function syncReaderPassword() {
    const modal = $('.reader-auth-modal');
    const input = $('.reader-auth-form input[name="password"]', modal || document);
    if (!modal || !input) return;
    const signup = modal.dataset.mode === 'signup';
    input.minLength = signup ? MIN_NEW_PASSWORD : 6;
    input.autocomplete = signup ? 'new-password' : 'current-password';
  }

  document.addEventListener('click', event => {
    const editorSignup = event.target.closest?.('#studio-signup');
    if (editorSignup) {
      const password = $('#studio-password')?.value || '';
      if (password.length < MIN_NEW_PASSWORD) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setMessage('#studio-auth-status', `Use a password of at least ${MIN_NEW_PASSWORD} characters to create an editor account.`);
        return;
      }
    }

    if (event.target.closest?.('[data-auth-mode]')) requestAnimationFrame(syncReaderPassword);
  }, true);

  document.addEventListener('submit', event => {
    const form = event.target.closest?.('.reader-auth-form');
    if (!form) return;
    const modal = form.closest('.reader-auth-modal');
    if (modal?.dataset.mode !== 'signup') return;
    const password = form.elements.password?.value || '';
    if (password.length >= MIN_NEW_PASSWORD) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const status = $('.reader-auth-status', modal);
    if (status) {
      status.textContent = `Use a password of at least ${MIN_NEW_PASSWORD} characters.`;
      status.className = 'reader-auth-status error';
    }
  }, true);

  const observer = new MutationObserver(() => syncReaderPassword());
  observer.observe(document.documentElement, {subtree:true, childList:true, attributes:true, attributeFilter:['data-mode']});

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', syncReaderPassword, {once:true});
  else syncReaderPassword();
})();
