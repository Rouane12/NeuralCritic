(() => {
  'use strict';

  if (!document.querySelector('script[data-nc-studio-commercial]')) {
    const script = document.createElement('script');
    script.src = 'assets/studio-commercial.js?v=20260824-commercial1';
    script.dataset.ncStudioCommercial = '1';
    document.head.appendChild(script);
  }

  const requested = new URLSearchParams(location.search).get('slug');
  if (!requested) return;
  let attempts = 0;
  const openRequested = () => {
    const button = [...document.querySelectorAll('#story-library [data-edit]')].find(el => el.dataset.edit === requested);
    if (button) {
      button.click();
      const heading = document.querySelector('.studio-heading small');
      if (heading) heading.textContent = 'EDITING FROM NEWSROOM';
      return;
    }
    attempts += 1;
    if (attempts < 80) setTimeout(openRequested, 125);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', openRequested, {once:true});
  else openRequested();
})();
