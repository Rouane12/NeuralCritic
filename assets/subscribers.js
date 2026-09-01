(() => {
  const config = window.NEURAL_CRITIC_SUPABASE;
  if (!config || !window.supabase) return;
  const client = window.supabase.createClient(config.url, config.publishableKey);
  const deliveryUrl = `${config.url}/functions/v1/newsletter-admin`;
  let rows = [];
  let filter = 'all';
  let currentSession = null;
  let providerReady = false;
  const $ = s => document.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = value => { try { return new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(value)); } catch (_) { return ''; } };

  async function adminSession() {
    const { data: { session } } = await client.auth.getSession();
    if (!session?.user) return null;
    const { data, error } = await client.from('editor_profiles').select('display_name,role').eq('user_id',session.user.id).maybeSingle();
    if (error || !data || data.role !== 'admin') return null;
    return { session, profile:data };
  }

  async function newsletterAdmin(action, extra={}) {
    if (!currentSession?.access_token) throw new Error('Admin session required.');
    const response = await fetch(deliveryUrl, {
      method:'POST',
      headers:{
        'content-type':'application/json',
        'apikey':config.publishableKey,
        'authorization':`Bearer ${currentSession.access_token}`
      },
      body:JSON.stringify({action,...extra})
    });
    let data = null;
    try { data = await response.json(); } catch (_) {}
    if (!response.ok || data?.ok === false) throw new Error(data?.error || 'Newsletter delivery operation failed.');
    return data || {ok:true};
  }

  async function load() {
    const { data, error } = await client.from('newsletter_subscribers').select('*').order('joined_at',{ascending:false});
    if (error) throw error;
    rows = data || [];
    render();
  }

  function render() {
    const query = ($('#subscriber-search')?.value || '').trim().toLowerCase();
    const list = rows.filter(row => (filter === 'all' || row.status === filter) && (!query || row.email.includes(query) || String(row.source||'').toLowerCase().includes(query)));
    $('#stat-total').textContent = rows.length;
    $('#stat-active').textContent = rows.filter(x=>x.status==='active').length;
    $('#stat-unsubscribed').textContent = rows.filter(x=>x.status==='unsubscribed').length;
    $('#subscriber-empty').hidden = list.length > 0;
    $('#subscriber-list').innerHTML = list.map(row => `<tr><td><strong>${esc(row.email)}</strong></td><td>${esc(row.source||'unknown')}</td><td>${fmt(row.joined_at)}</td><td><span class="status-pill ${esc(row.status)}">${esc(row.status.toUpperCase())}</span></td><td><div class="subscriber-actions"><button type="button" data-id="${esc(row.id)}" data-next="${row.status==='active'?'unsubscribed':'active'}">${row.status==='active'?'UNSUBSCRIBE':'REACTIVATE'}</button></div></td></tr>`).join('');
  }

  function renderProvider(state={}) {
    const pill = $('#delivery-status');
    const copy = $('#delivery-copy');
    const detail = $('#delivery-detail');
    const sync = $('#sync-delivery');
    providerReady = Boolean(state.ready);
    if (!state.configured) {
      pill.textContent = 'NOT CONFIGURED';
      pill.dataset.state = 'blocked';
      copy.textContent = 'Subscriber capture is live, but outbound email delivery is still disabled.';
      detail.textContent = 'Add the verified Resend sending domain, API key, and Weekly Drop segment before sending.';
      sync.disabled = true;
      return;
    }
    if (!state.ready) {
      pill.textContent = 'NEEDS ATTENTION';
      pill.dataset.state = 'blocked';
      copy.textContent = 'Resend is configured, but the Weekly Drop segment could not be verified.';
      detail.textContent = 'Check the provider key, segment ID, and domain setup before sending.';
      sync.disabled = true;
      return;
    }
    pill.textContent = 'READY';
    pill.dataset.state = 'ready';
    copy.textContent = 'Resend is reachable. Sync before every Broadcast so provider unsubscribes and Supabase status stay aligned.';
    detail.textContent = 'Compose and send the Weekly Drop from the verified Resend Broadcast workflow after synchronization.';
    sync.disabled = false;
  }

  async function refreshProvider() {
    try { renderProvider(await newsletterAdmin('status')); }
    catch (err) {
      console.error(err);
      renderProvider({configured:true,ready:false});
    }
  }

  async function syncProvider() {
    const btn = $('#sync-delivery');
    if (!providerReady || !btn) return;
    const old = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'SYNCING…';
    try {
      const data = await newsletterAdmin('sync');
      await load();
      $('#delivery-detail').textContent = `Synced ${data.synced ?? 0} records · ${data.active ?? 0} active · ${data.unsubscribed ?? 0} unsubscribed${data.provider_unsubscribes_applied ? ` · ${data.provider_unsubscribes_applied} provider opt-out${data.provider_unsubscribes_applied===1?'':'s'} applied` : ''}.`;
    } catch (err) {
      alert(err.message || 'Could not sync the delivery list.');
    } finally {
      btn.disabled = false;
      btn.textContent = old;
    }
  }

  async function setStatus(id,status) {
    const result = await newsletterAdmin('set_status',{id,status});
    await load();
    if (result.provider_synced === false && providerReady) await refreshProvider();
  }

  function exportCsv() {
    const lines = [['email','source','joined_at','status'],...rows.map(x=>[x.email,x.source,x.joined_at,x.status])];
    const csv = lines.map(row=>row.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv],{type:'text/csv;charset=utf-8'}); const url = URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download=`neural-critic-subscribers-${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  async function init() {
    const auth = await adminSession();
    if (!auth) { $('#subscriber-gate').hidden = false; return; }
    currentSession = auth.session;
    $('#subscriber-gate').hidden = true;
    const user = document.querySelector('.subscriber-topbar nav span'); if (user) user.textContent = auth.profile.display_name || 'Admin';
    await load();
    await refreshProvider();
    $('#subscriber-search')?.addEventListener('input',render);
    $('#subscriber-tabs')?.addEventListener('click',e=>{const btn=e.target.closest('[data-status]'); if(!btn)return; filter=btn.dataset.status; document.querySelectorAll('#subscriber-tabs button').forEach(x=>x.classList.toggle('active',x===btn)); render();});
    $('#subscriber-list')?.addEventListener('click',async e=>{const btn=e.target.closest('[data-id]');if(!btn)return; btn.disabled=true; try{await setStatus(btn.dataset.id,btn.dataset.next)}catch(err){alert(err.message||'Could not update subscriber.');btn.disabled=false;}});
    $('#sync-delivery')?.addEventListener('click',syncProvider);
    $('#export-subscribers')?.addEventListener('click',exportCsv);
  }
  init().catch(err=>{console.error(err); $('#subscriber-gate').hidden=false;});
})();