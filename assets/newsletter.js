(() => {
  const config = window.NEURAL_CRITIC_SUPABASE;
  if (!config || !window.supabase) return;
  const client = window.neuralCriticPublicSupabase || window.supabase.createClient(config.url, config.publishableKey);
  window.neuralCriticPublicSupabase = client;

  function isNewsletterForm(form) {
    return form.matches('#newsletter-form,#category-newsletter,[data-side-newsletter],[data-newsletter]') ||
      !!form.closest('.newsletter,.category-weekly,.work-weekly-card');
  }
  function sourceFor(form) {
    const explicit = form.dataset.newsletterSource;
    if (explicit) return explicit;
    const slug = new URLSearchParams(location.search).get('slug');
    const category = new URLSearchParams(location.search).get('category');
    if (slug) return `article:${slug}`;
    if (category) return `category:${category}`;
    if (location.pathname.endsWith('index.html') || location.pathname.endsWith('/')) return 'homepage';
    return location.pathname.split('/').pop() || 'unknown';
  }
  function setState(form, message, error=false) {
    const host = form.parentElement || form;
    let note = host.querySelector('.newsletter-status');
    if (!note) {
      note = document.createElement('p');
      note.className = 'newsletter-status';
      host.appendChild(note);
    }
    note.textContent = message;
    note.dataset.error = error ? '1' : '0';
  }

  document.addEventListener('submit', async event => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !isNewsletterForm(form)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const input = form.querySelector('input[type="email"]');
    const button = form.querySelector('button[type="submit"],button:not([type])');
    const email = input?.value?.trim();
    if (!email) return;
    const old = button?.textContent;
    if (button) { button.disabled = true; button.textContent = 'JOINING…'; }
    setState(form, 'Adding you to the Weekly Drop…');
    try {
      const { error } = await client.rpc('subscribe_newsletter', { p_email: email, p_source: sourceFor(form) });
      if (error) throw error;
      if (input) { input.value = ''; input.disabled = true; }
      if (button) button.textContent = 'YOU’RE IN ✓';
      setState(form, 'Welcome to the Weekly Drop. One email, no noise.');
    } catch (err) {
      if (button) { button.disabled = false; button.textContent = old || 'JOIN FREE'; }
      setState(form, err?.message || 'Could not subscribe right now. Try again.', true);
    }
  }, true);
})();
