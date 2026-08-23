(() => {
  'use strict';

  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const SITE_ROOT = `${location.origin}/NeuralCritic/`;

  let panel;
  let lastReport = null;

  const value = selector => ($(selector)?.value || '').trim();
  const format = () => $('.format-card.active')?.dataset.format || 'standard';
  const sections = () => $$('.section-card');
  const lineCount = selector => value(selector).split(/\n+/).map(x=>x.trim()).filter(Boolean).length;
  const slugValid = slug => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= 100;

  function escapeHtml(input=''){
    return String(input).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }

  function item(state, title, detail){ return {state, title, detail}; }

  function report(mode='publish'){
    const title = value('#title');
    const slug = value('#slug');
    const description = value('#description');
    const intro = value('#body');
    const image = value('#featured-image');
    const imageAlt = value('#featured-alt');
    const author = value('#author');
    const category = value('#category').toUpperCase();
    const tags = value('#tags').split(',').map(x=>x.trim()).filter(Boolean);
    const currentFormat = format();
    const sectionCards = sections();
    const contentSections = sectionCards.filter(card => valueFrom(card,'[data-field="heading"]') || valueFrom(card,'[data-field="text"]'));
    const checks = [];

    if(!title) checks.push(item('block','Headline','Required before publishing.'));
    else if(title.length < 25 || title.length > 85) checks.push(item('warn','Headline','Works, but 25–85 characters is usually stronger for cards and search.'));
    else checks.push(item('ok','Headline','Clear publishing headline is present.'));

    if(!slug) checks.push(item('block','URL slug','A canonical story URL needs a slug.'));
    else if(!slugValid(slug)) checks.push(item('block','URL slug','Use lowercase words separated only by single hyphens.'));
    else checks.push(item('ok','URL slug','Canonical story path is clean.'));

    if(!description) checks.push(item('block','Summary','Needed for cards, search results, and social previews.'));
    else if(description.length < 70 || description.length > 170) checks.push(item('warn','Summary',`${description.length} characters. Around 70–170 usually previews best.`));
    else checks.push(item('ok','Summary',`${description.length} characters — healthy preview length.`));

    if(!intro && !contentSections.length) checks.push(item('block','Story content','Add an introduction or at least one written section.'));
    else checks.push(item('ok','Story content',`${contentSections.length} structured section${contentSections.length===1?'':'s'} plus the article introduction.`));

    if(!image) checks.push(item('block','Featured image','Required for homepage cards and large social previews.'));
    else checks.push(item('ok','Featured image','Primary editorial image is set.'));

    if(image && !imageAlt) checks.push(item('block','Image description','Describe the featured image for accessibility.'));
    else if(imageAlt) checks.push(item('ok','Image description','Featured image has accessibility text.'));

    if(!author) checks.push(item('block','Author','A published story needs a byline.'));
    else checks.push(item('ok','Author',author));

    if(tags.length < 2) checks.push(item('warn','Tags','Add at least two focused tags to improve discovery and recirculation.'));
    else checks.push(item('ok','Tags',`${tags.length} discovery tags set.`));

    if(category === 'NEWS'){
      const newsKind = $('[name="news-kind"]:checked')?.value || '';
      const source = value('#news-source-name');
      if(!newsKind) checks.push(item('block','News classification','Choose Breaking, Update, or Report so readers know what kind of signal this is.'));
      else checks.push(item('ok','News classification',`${newsKind.toUpperCase()} will power the News Desk and public trust label.`));
      if(!source) checks.push(item('block','News source','Published news needs a source / origin.'));
      else checks.push(item('ok','News source',source));
      if(newsKind === 'report' && !/\b(report|reportedly|according|alleged|rumou?r|leak)/i.test(`${title} ${description}`)){
        checks.push(item('warn','Report wording','Make the headline or summary explicitly signal attribution or uncertainty.'));
      }
    }

    if(currentFormat === 'review'){
      const score = Number(value('#review-score'));
      if(!Number.isFinite(score) || score < 0 || score > 10) checks.push(item('block','Review score','Enter a numerical score from 0 to 10.'));
      else checks.push(item('ok','Review score',`${score}/10 will power the review schema and score reactor.`));
      if(!value('#review-verdict')) checks.push(item('warn','Review verdict','Add a concise verdict for the review card.'));
      else checks.push(item('ok','Review verdict','Verdict copy is present.'));
      if(!lineCount('#review-pros') || !lineCount('#review-cons')) checks.push(item('warn','Pros & cons','Reviews are stronger with at least one pro and one con.'));
      else checks.push(item('ok','Pros & cons','Structured review takeaways are present.'));
    }

    if(currentFormat === 'ranked-list'){
      if(!sectionCards.length) checks.push(item('block','Ranked entries','A ranked list needs at least one entry.'));
      else if(sectionCards.some(card => !valueFrom(card,'[data-field="rank"]'))) checks.push(item('warn','Ranked entries','One or more entries are missing their rank number.'));
      else checks.push(item('ok','Ranked entries',`${sectionCards.length} ranked entries are structured.`));
    }

    if(currentFormat === 'game-guide' && !sectionCards.length) checks.push(item('warn','Guide steps','Add structured sections so readers can scan the guide.'));

    if(mode === 'schedule'){
      const schedule = value('#schedule-date');
      if(!schedule) checks.push(item('block','Schedule time','Choose when this story should publish.'));
      else if(new Date(schedule).getTime() <= Date.now()) checks.push(item('block','Schedule time','Choose a future date and time.'));
      else checks.push(item('ok','Schedule time',new Date(schedule).toLocaleString()));
    }

    const blockers = checks.filter(x=>x.state==='block');
    const warnings = checks.filter(x=>x.state==='warn');
    const ok = checks.filter(x=>x.state==='ok');
    const score = Math.round(((ok.length + warnings.length * .55) / Math.max(checks.length,1)) * 100);
    return {checks, blockers, warnings, score, title, slug, description, image, mode};
  }

  function valueFrom(root, selector){ return (root.querySelector(selector)?.value || '').trim(); }

  function canonical(slug){ return slugValid(slug) ? `${SITE_ROOT}stories/${encodeURIComponent(slug)}/` : `${SITE_ROOT}stories/your-story/`; }

  function ensurePanel(){
    if(panel) return panel;
    const actions = $('.studio-actions');
    if(!actions) return null;
    panel = document.createElement('section');
    panel.className = 'studio-readiness';
    panel.dataset.state = 'blocked';
    panel.innerHTML = `
      <div class="studio-readiness-head">
        <div><small>PUBLICATION CHECK</small><h2>Ready to publish?</h2><p>Live checks for search, social sharing, accessibility, sourcing, and Neural Critic’s structured article system.</p></div>
        <div class="studio-readiness-score"><b>0%</b><span>CHECKING</span></div>
      </div>
      <div class="studio-readiness-grid">
        <div class="studio-readiness-list"></div>
        <div class="studio-readiness-preview">
          <small>SOCIAL / SEARCH PREVIEW</small>
          <div class="studio-social-card"><div class="studio-social-image"></div><div class="studio-social-copy"><em>NEURAL CRITIC</em><h3>Story headline</h3><p>Your article summary will preview here.</p></div></div>
          <span class="studio-canonical"></span>
          <p class="studio-publish-note"><strong>Drafts are never blocked.</strong> Publish and Schedule only stop when a required production field is missing.</p>
        </div>
      </div>`;
    actions.parentNode.insertBefore(panel, actions);
    return panel;
  }

  function render(mode='publish'){
    const root = ensurePanel();
    if(!root) return;
    const data = report(mode);
    lastReport = data;
    root.dataset.state = data.blockers.length ? 'blocked' : 'ready';
    const score = $('.studio-readiness-score b', root);
    const label = $('.studio-readiness-score span', root);
    score.textContent = `${data.score}%`;
    label.textContent = data.blockers.length ? `${data.blockers.length} BLOCKER${data.blockers.length===1?'':'S'}` : data.warnings.length ? `${data.warnings.length} NOTE${data.warnings.length===1?'':'S'}` : 'READY';

    $('.studio-readiness-list', root).innerHTML = data.checks.map(check => `
      <div class="studio-check ${check.state}">
        <i>${check.state==='ok'?'✓':check.state==='warn'?'!':'×'}</i>
        <div><b>${escapeHtml(check.title)}</b><span>${escapeHtml(check.detail)}</span></div>
      </div>`).join('');

    const image = $('.studio-social-image', root);
    image.style.backgroundImage = data.image ? `url("${data.image.replace(/["\\]/g,'')}")` : 'linear-gradient(135deg,#111d29,#13142a)';
    $('.studio-social-copy h3', root).textContent = data.title || 'Story headline';
    $('.studio-social-copy p', root).textContent = data.description || 'Your article summary will preview here.';
    $('.studio-canonical', root).textContent = canonical(data.slug);
  }

  function showBlockerToast(message){
    const el = $('#studio-toast');
    if(!el) return;
    el.textContent = message;
    el.classList.add('error','show');
    clearTimeout(el._readinessTimer);
    el._readinessTimer = setTimeout(()=>el.classList.remove('show'),3200);
  }

  function blockIfNeeded(event, mode){
    const data = report(mode);
    render(mode);
    if(!data.blockers.length) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    panel?.classList.remove('flash-blocked');
    void panel?.offsetWidth;
    panel?.classList.add('flash-blocked');
    panel?.scrollIntoView({behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block:'center'});
    showBlockerToast(`Publishing paused: ${data.blockers[0].detail}`);
  }

  function wire(){
    ensurePanel();
    render();
    const refresh = () => requestAnimationFrame(()=>render());
    document.addEventListener('input', refresh, true);
    document.addEventListener('change', refresh, true);
    document.addEventListener('click', event => {
      if(event.target.closest('.format-card,[data-remove],[data-move],#add-section,#first-section,[name="news-kind"]')) setTimeout(refresh,0);
    });
    document.addEventListener('click', event => {
      if(event.target.closest('#publish-story')) blockIfNeeded(event,'publish');
      else if(event.target.closest('#schedule-story')) blockIfNeeded(event,'schedule');
    }, true);
    new MutationObserver(refresh).observe($('#sections-list') || document.body,{childList:true,subtree:true});
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded',wire,{once:true});
  else wire();
})();