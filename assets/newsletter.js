(() => {
  const config = window.NEURAL_CRITIC_SUPABASE;
  if (!config?.url || !config?.publishableKey || !window.fetch) return;

  const edgeUrl = `${config.url}/functions/v1/public-actions`;

  function isNewsletterForm(form) {
    return form.matches('#newsletter-form,#category-newsletter,[data-side-newsletter],[data-newsletter]') ||
      !!form.closest('.newsletter,.category-weekly,.work-weekly-card');
  }

  function cleanSegment(value = '') {
    return String(value).trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
  }

  function sourceFor(form) {
    const explicit = String(form.dataset.newsletterSource || '').trim();
    if (explicit) return explicit.slice(0, 160);

    const params = new URLSearchParams(location.search);
    const runtimeSlug = cleanSegment(params.get('slug') || '');
    if (runtimeSlug) return `article:${runtimeSlug}`;

    const canonicalMatch = location.pathname.match(/\/stories\/([^/]+)\/?$/i);
    const canonicalSlug = cleanSegment(canonicalMatch?.[1] || '');
    if (canonicalSlug) return `article:${canonicalSlug}`;

    const category = cleanSegment(params.get('category') || '');
    if (category) return `category:${category}`;

    if (document.getElementById('weekly-drop') || location.pathname === '/' || /\/index\.html?$/i.test(location.pathname)) {
      return 'homepage';
    }

    const page = cleanSegment(location.pathname.split('/').filter(Boolean).pop() || 'website');
    return page.slice(0, 160) || 'website';
  }

  function setState(form, message, error = false) {
    const host = form.parentElement || form;
    let note = host.querySelector('.newsletter-status');
    if (!note) {
      note = document.createElement('p');
      note.className = 'newsletter-status';
      note.setAttribute('role', 'status');
      note.setAttribute('aria-live', 'polite');
      host.appendChild(note);
    }
    note.textContent = message;
    note.dataset.error = error ? '1' : '0';
  }

  async function subscribe(email, source, signal) {
    const response = await fetch(edgeUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'apikey': config.publishableKey
      },
      body: JSON.stringify({ action: 'subscribe', email, source }),
      signal
    });

    let data = null;
    try { data = await response.json(); } catch (_) {}
    if (!response.ok || data?.ok === false || data?.error) {
      const message = data?.message || data?.error || (response.status === 429
        ? 'Too many signup attempts. Please try again later.'
        : 'Could not subscribe right now. Try again.');
      throw new Error(message);
    }
    return data || { ok: true };
  }

  document.addEventListener('submit', async event => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !isNewsletterForm(form)) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    if (form.dataset.newsletterSubmitting === '1' || form.dataset.newsletterSubscribed === '1') return;

    const input = form.querySelector('input[type="email"]');
    const button = form.querySelector('button[type="submit"],button:not([type])');
    const email = input?.value?.trim();
    if (!email) {
      input?.focus();
      return;
    }

    const oldLabel = button?.textContent || '';
    form.dataset.newsletterSubmitting = '1';
    if (button) {
      button.disabled = true;
      button.textContent = 'JOINING…';
    }
    setState(form, 'Adding you to the Weekly Drop…');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    try {
      const source = sourceFor(form);
      await subscribe(email, source, controller.signal);
      form.dataset.newsletterSubscribed = '1';
      if (input) {
        input.value = '';
        input.disabled = true;
      }
      if (button) button.textContent = 'YOU’RE IN ✓';
      setState(form, 'You’re on the Weekly Drop list.');
      window.dispatchEvent(new CustomEvent('neuralcritic:newsletter-subscribed', { detail: { source } }));
    } catch (err) {
      if (button) {
        button.disabled = false;
        button.textContent = oldLabel || 'JOIN FREE';
      }
      const message = err?.name === 'AbortError'
        ? 'Signup timed out. Please try again.'
        : (err?.message || 'Could not subscribe right now. Try again.');
      setState(form, message, true);
    } finally {
      clearTimeout(timeout);
      delete form.dataset.newsletterSubmitting;
    }
  }, true);
})();
