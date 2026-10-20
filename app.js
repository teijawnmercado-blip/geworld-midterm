(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let documents = [], currentDoc = 0, currentPage = 0, zoom = 1, paused = reducedMotion.matches;
  const tabs = Array.from(document.querySelectorAll('.doc-tab'));

  function renderPage() {
    const doc = documents[currentDoc];
    const page = doc.pages[currentPage];
    $('page-image').src = page.image;
    $('page-image').alt = `${doc.title}, page ${currentPage + 1} of ${doc.pages.length}`;
    $('page-image').hidden = false;
    $('image-error').hidden = true;
    $('page-text').textContent = page.text || 'This page contains images. Please view the page preview or original PDF.';
    $('reader-status').textContent = `${doc.title} · Page ${currentPage + 1} of ${doc.pages.length}`;
    $('page-select').value = String(currentPage);
    $('prev').disabled = currentPage === 0;
    $('next').disabled = currentPage === doc.pages.length - 1;
    document.querySelectorAll('.thumb').forEach((thumb, i) => {
      thumb.classList.toggle('active', i === currentPage);
      if (i === currentPage) thumb.setAttribute('aria-current', 'page');
      else thumb.removeAttribute('aria-current');
    });
    $('page-stage').scrollTop = 0;
    $('page-stage').scrollLeft = 0;
    const next = doc.pages[currentPage + 1];
    if (next) { const img = new Image(); img.src = next.image; }
    const hash = `#${doc.id}-page-${currentPage + 1}`;
    history.replaceState(null, '', hash);
  }
  function selectDocument(index, page = 0, focus = false) {
    if (!documents.length) return;
    currentDoc = index;
    currentPage = Math.max(0, Math.min(documents[index].pages.length - 1, page));
    const doc = documents[index];
    tabs.forEach((tab, i) => {
      tab.classList.toggle('active', i === index);
      tab.setAttribute('aria-selected', String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
    });
    $('reader').setAttribute('aria-labelledby', tabs[index].id);
    $('page-total').textContent = `/ ${doc.pages.length}`;
    for (const id of ['open-pdf', 'download-pdf', 'fallback-pdf']) $(id).href = doc.file;
    $('page-select').replaceChildren();
    $('thumbnails').replaceChildren();
    doc.pages.forEach((item, i) => {
      const option = document.createElement('option');
      option.value = String(i); option.textContent = `Page ${i + 1}`;
      $('page-select').append(option);
      const button = document.createElement('button');
      button.className = 'thumb'; button.setAttribute('aria-label', `Go to page ${i + 1}`);
      const image = document.createElement('img');
      image.src = item.thumb; image.alt = ''; image.loading = 'lazy'; image.width = 200; image.height = 280;
      button.append(image, document.createTextNode(String(i + 1).padStart(2, '0')));
      button.addEventListener('click', () => { currentPage = i; renderPage(); });
      $('thumbnails').append(button);
    });
    setZoom(1);
    renderPage();
    if (focus) tabs[index].focus();
  }
  function movePage(delta) {
    if (!documents.length) return;
    const target = currentPage + delta;
    if (target < 0 || target >= documents[currentDoc].pages.length) return;
    currentPage = target; renderPage();
  }
  function setZoom(value) {
    zoom = Math.max(0.75, Math.min(2.5, value));
    const stageWidth = Math.max(240, $('page-stage').clientWidth - (innerWidth < 760 ? 30 : 60));
    $('page-image').style.width = zoom === 1 ? '100%' : `${Math.round(Math.min(stageWidth, 720) * zoom)}px`;
    $('page-image').style.maxWidth = zoom === 1 ? '' : 'none';
    $('zoom-reset').textContent = `${Math.round(zoom * 100)}%`;
    $('zoom-in').disabled = zoom >= 2.5;
    $('zoom-out').disabled = zoom <= .75;
  }
  function visitReader(index, page = 0) {
    selectDocument(index, page);
    $('documents').scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth' });
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectDocument(index));
    tab.addEventListener('keydown', e => {
      if (['ArrowRight','ArrowLeft','Home','End'].includes(e.key)) {
        e.preventDefault();
        const next = e.key === 'Home' ? 0 : e.key === 'End' ? 1 : 1 - index;
        selectDocument(next, 0, true);
      }
    });
  });
  $('prev').addEventListener('click', () => movePage(-1));
  $('next').addEventListener('click', () => movePage(1));
  $('page-select').addEventListener('change', e => {currentPage = Number(e.target.value); renderPage();});
  $('zoom-in').addEventListener('click', () => setZoom(zoom + .25));
  $('zoom-out').addEventListener('click', () => setZoom(zoom - .25));
  $('zoom-reset').addEventListener('click', () => setZoom(1));
  $('page-image').addEventListener('error', () => { $('page-image').hidden = true; $('image-error').hidden = false; });
  $('reader').addEventListener('keydown', e => {
    if (['SELECT','INPUT','TEXTAREA'].includes(e.target.tagName)) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); movePage(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); movePage(-1); }
  });
  $('read-paper').addEventListener('click', e => {e.preventDefault(); visitReader(0);});
  $('read-disclosure').addEventListener('click', e => {e.preventDefault(); visitReader(1);});
  document.querySelectorAll('.journey-item').forEach(button => button.addEventListener('click', () => visitReader(0, Number(button.dataset.page)-1)));
  function fallbackExpand(close = false) {
    const expanded = !close && !$('reader').classList.contains('expanded');
    $('reader').classList.toggle('expanded', expanded);
    document.body.classList.toggle('reader-open', expanded);
    $('fullscreen').setAttribute('aria-label', expanded ? 'Exit expanded reader' : 'Expand reader');
  }
  $('fullscreen').addEventListener('click', async () => {
    if ($('reader').classList.contains('expanded')) return fallbackExpand(true);
    if (document.fullscreenElement) return document.exitFullscreen();
    if ($('reader').requestFullscreen) {try {await $('reader').requestFullscreen();} catch {fallbackExpand();}}
    else fallbackExpand();
  });
  document.addEventListener('fullscreenchange', () => $('fullscreen').setAttribute('aria-label', document.fullscreenElement ? 'Exit fullscreen' : 'Expand reader'));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') fallbackExpand(true); });
  let touchStart = null;
  $('page-stage').addEventListener('touchstart', e => {if (zoom === 1 && e.touches.length === 1) touchStart = [e.touches[0].clientX,e.touches[0].clientY];}, {passive:true});
  $('page-stage').addEventListener('touchend', e => {
    if (!touchStart) return;
    const x = e.changedTouches[0].clientX - touchStart[0], y = e.changedTouches[0].clientY - touchStart[1];
    if (Math.abs(x)>70 && Math.abs(x)>Math.abs(y)*1.5) movePage(x<0 ? 1 : -1);
    touchStart = null;
  }, {passive:true});
  fetch('documents.json').then(response => {if (!response.ok) throw Error('Documents unavailable'); return response.json();}).then(data => {
    documents = data;
    const match = location.hash.match(/^#(midterm|disclosure)-page-(\d+)$/);
    const oldHash = location.hash;
    selectDocument(match?.[1] === 'disclosure' ? 1 : 0, match ? Number(match[2])-1 : 0);
    if (!match) history.replaceState(null, '', oldHash || location.pathname);
    else $('documents').scrollIntoView();
  }).catch(() => {
    $('reader-status').textContent = 'Interactive reader unavailable. Open or download either original PDF using the links below.';
    const error = document.createElement('p');
    error.innerHTML = '<a href="GEWORLD_Midterm_Teijawn_Mercado.pdf">Open midterm PDF ↗</a> &nbsp; <a href="GEWORLD_AI_Use_Disclosure_Teijawn_Mercado.pdf">Open disclosure PDF ↗</a>';
    $('reader').after(error);
  });

  // Animated contour lines: warped concentric rings form a topographic field.
  const canvas = $('terrain'), ctx = canvas.getContext('2d');
  let width = 0, height = 0, frame = 0, animationId = null, lastDraw = 0;
  function resize() {
    const scale = Math.min(devicePixelRatio || 1, 1.5);
    width = innerWidth; height = innerWidth < 760 ? 1150 : 1050;
    canvas.style.height = height + 'px'; canvas.width = width * scale; canvas.height = height * scale;
    ctx.setTransform(scale,0,0,scale,0,0); draw(frame);
  }
  function draw(time) {
    ctx.clearRect(0,0,width,height);
    const cx = width*.77, cy = height*.35;
    for (let ring=0;ring<47;ring++) {
      ctx.beginPath();
      for (let point=0;point<=180;point++) {
        const a=point/180*Math.PI*2;
        const r=45+ring*20+Math.sin(a*3+ring*.07+time*.00012)*22+Math.cos(a*5+time*.00007)*12;
        const x=cx+Math.cos(a)*r*1.65+Math.sin(a*2+time*.00005)*30;
        const y=cy+Math.sin(a)*r*.8+Math.cos(a*3+ring*.12)*20;
        if(point===0)ctx.moveTo(x,y); else ctx.lineTo(x,y);
      }
      ctx.closePath(); ctx.strokeStyle=`rgba(128,191,38,${.12+Math.sin(ring*.23)*.04})`; ctx.lineWidth=.7;ctx.stroke();
    }
  }
  function animate(time) {
    if (paused || document.hidden) {animationId=null;return;}
    if(time-lastDraw>45) {frame=time;draw(time);lastDraw=time;}
    animationId=requestAnimationFrame(animate);
  }
  function syncMotion() {
    $('motion').setAttribute('aria-pressed', String(paused));
    $('motion').setAttribute('aria-label', paused ? 'Play background animation' : 'Pause background animation');
    $('motion').innerHTML=paused ? '▷ <span>Play motion</span>' : 'Ⅱ <span>Pause motion</span>';
    if(!paused && !animationId && !document.hidden) animationId=requestAnimationFrame(animate);
  }
  $('motion').addEventListener('click', () => {paused=!paused;syncMotion();});
  reducedMotion.addEventListener('change', e => {paused=e.matches;syncMotion();});
  document.addEventListener('visibilitychange', syncMotion);
  window.addEventListener('resize', () => {resize();setZoom(zoom);});
  resize();syncMotion();
})();
