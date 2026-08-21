(() => {
  if (!window.supabase?.createClient) return;
  const createClient = window.supabase.createClient.bind(window.supabase);

  window.supabase.createClient = (...args) => {
    const client = createClient(...args);
    const signUp = client.auth.signUp.bind(client.auth);

    client.auth.signUp = (credentials = {}) => {
      const redirect = new URL('studio.html', location.href);
      redirect.hash = '';
      redirect.search = '';
      return signUp({
        ...credentials,
        options: {
          ...(credentials.options || {}),
          emailRedirectTo: credentials.options?.emailRedirectTo || redirect.href
        }
      });
    };

    return client;
  };
})();
