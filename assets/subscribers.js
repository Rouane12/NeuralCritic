(() => {
  const config = window.NEURAL_CRITIC_SUPABASE;
  if (!config || !window.supabase) return;
  const client = window.supabase.createClient(config.url, config.publishableKey);
  let rows = [];
  let filter = 'all';
  const $ = s => document.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = value => { try { return new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(value)); } catch (_) { return ''; } };

  async function editorSession() {
    const { data: { session } } = await client.auth.getSession();
    if (!session?.user) return null;
    const { data, error } = await client.from('editor_profiles').select('display_name,role').eq('user_id',session.user.id).maybeSingle();
    if (error || !data) return null;
    return { session, profile:data };
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
  async function setStatus(id,status) {
    const { error } = await client.rpc('set_newsletter_subscriber_status',{p_id:id,p_status:status});
    if (error) throw error;
    await load();
  }
  function exportCsv() {
    const lines = [['email','source','joined_at','status'],...rows.map(x=>[x.email,x.source,x.joined_at,x.status])];
    const csv = lines.map(row=>row.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv],{type:'text/csv;charset=utf-8'}); const url = URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download=`neural-critic-subscribers-${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
  }
  async function init() {
    const auth = await editorSession();
    if (!auth) { $('#subscriber-gate').hidden = false; return; }
    $('#subscriber-gate').hidden = true;
    const user = document.querySelector('.subscriber-topbar nav span'); if (user) user.textContent = auth.profile.display_name || 'Editor';
    await load();
    $('#subscriber-search')?.addEventListener('input',render);
    $('#subscriber-tabs')?.addEventListener('click',e=>{const btn=e.target.closest('[data-status]'); if(!btn)return; filter=btn.dataset.status; document.querySelectorAll('#subscriber-tabs button').forEach(x=>x.classList.toggle('active',x===btn)); render();});
    $('#subscriber-list')?.addEventListener('click',async e=>{const btn=e.target.closest('[data-id]');if(!btn)return; btn.disabled=true; try{await setStatus(btn.dataset.id,btn.dataset.next)}catch(err){alert(err.message||'Could not update subscriber.');btn.disabled=false;}});
    $('#export-subscribers')?.addEventListener('click',exportCsv);
  }
  init().catch(err=>{console.error(err); $('#subscriber-gate').hidden=false;});
})();
