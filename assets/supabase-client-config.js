window.NEURAL_CRITIC_SUPABASE = {
  url: 'https://pchrrwfdcfbytggekuzs.supabase.co',
  publishableKey: 'sb_publishable_T8ObjS3Mab7Do5aCXnP8nA_jvgYkf8T'
};

(() => {
  const config = window.NEURAL_CRITIC_SUPABASE;
  if (window.neuralCriticPrivateSupabase || !config || !window.supabase?.createClient) return;
  window.neuralCriticPrivateSupabase = window.supabase.createClient(config.url, config.publishableKey);
})();
