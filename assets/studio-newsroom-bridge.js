(() => {
  'use strict';

  if (!document.querySelector('script[data-nc-studio-commercial]')) {
    const script = document.createElement('script');
    script.src = 'assets/studio-commercial.js?v=20260824-commercial1';
    script.dataset.ncStudioCommercial = '1';
    document.head.appendChild(script);
  }

  if (!document.querySelector('link[data-nc-news-placement-style]')) {
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = 'assets/studio-news-placement.css?v=20260825-placement1';
    style.dataset.ncNewsPlacementStyle = '1';
    document.head.appendChild(style);
  }

  if (!document.querySelector('script[data-nc-news-placement]')) {
    const script = document.createElement('script');
    script.src = 'assets/studio-news-placement.js?v=20260825-placement1';
    script.dataset.ncNewsPlacement = '1';
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
