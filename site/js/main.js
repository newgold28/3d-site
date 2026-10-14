/* ════════════════════════════════════════════════════════════════
   POWERBANK — scroll engine
   One 240-frame sequence per section · scroll-driven storytelling.
   The hero keeps the full-screen video; every later section scrubs
   its own sequence on the left while you scroll through it.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const FRAME_COUNT = 240;
  const SEQ_SECONDS = 8.0;
  const IMG_W = 1280;
  const IMG_H = 720;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const pad = (n) => String(n).padStart(3, '0');
  const smooth = (t) => t * t * (3 - 2 * t);

  const els = {
    canvas: $('seq'),
    loader: $('loader'),
    loaderPct: $('loader-pct'),
    loaderFill: $('loader-fill'),
    loaderFrames: $('loader-frames'),
    stage: $('stage'),
    nav: $('nav'),
    frameCur: $('frame-cur'),
    frameTotal: $('frame-total'),
    timeReadout: $('time-readout'),
    progressFill: $('progress-fill'),
    rotateHint: $('rotate-hint'),
    year: $('year'),
  };

  const copyEls = Array.from(document.querySelectorAll('.copy'));
  const labelEls = Array.from(document.querySelectorAll('.label'));
  const lastCopy = new Map();
  const lastLabel = new Map();

  /* ── Sections ─────────────────────────────────────────────
     One frame set per copy section. Section 0 is the hero and
     keeps the full-screen video; every other section scrubs its
     own sequence on the left within its data-in/out window. */
  const SECTION_DIRS = [
    'frames/',
    'sets/01/',
    'sets/02/',
    'sets/03/',
    'sets/04/',
    'sets/05/',
  ];

  const sets = SECTION_DIRS.map((dir, i) => {
    const sec = copyEls[i];
    let canvas = i === 0 ? els.canvas : null;
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.className = 'seq';
      canvas.setAttribute('aria-hidden', 'true');
      canvas.setAttribute('role', 'presentation');
      sec.insertBefore(canvas, sec.firstChild);
    }
    return {
      dir,
      full: i === 0,
      el: canvas,
      ctx: canvas.getContext('2d', { alpha: false }),
      in: parseFloat(sec.dataset.in),
      out: parseFloat(sec.dataset.out),
      images: new Array(FRAME_COUNT),
      loaded: 0,
      loading: false,
      view: null,
      cur: 0,
      target: 0,
      drawn: -1,
    };
  });

  const state = { progress: 0, ready: false, revealTimer: null, lastProgress: null };

  let stageHeight = els.stage.offsetHeight;
  let maxScroll = Math.max(1, stageHeight - window.innerHeight);
  const startedAt = performance.now();

  /* ───────────── Canvas sizing ───────────── */

  function drawSection(s, force) {
    const v = s.view;
    if (!v) return;
    const f = s.cur;
    if (!force && Math.abs(f - s.drawn) < 0.004) return;
    s.drawn = f;

    const c = s.ctx;
    if (s.full) {
      const g = c.createRadialGradient(
        v.w / 2, v.h * 0.42, 0,
        v.w / 2, v.h * 0.42, Math.max(v.w, v.h) * 0.78
      );
      g.addColorStop(0, 'rgba(244, 122, 50, 0.055)');
      g.addColorStop(0.5, 'rgba(10, 12, 14, 0.4)');
      g.addColorStop(1, '#050607');
      c.fillStyle = g;
    } else {
      c.fillStyle = '#050607';
    }
    c.fillRect(0, 0, v.w, v.h);

    const a = Math.floor(f);
    const t = f - a;
    const imgA = s.images[a];
    const imgB = s.images[a + 1];

    if (t < 0.001 || a >= FRAME_COUNT - 1 || !imgB || !imgB.complete) {
      if (imgA && imgA.complete) c.drawImage(imgA, v.dx, v.dy, v.dw, v.dh);
    } else if (imgA && imgA.complete) {
      c.globalAlpha = 1 - t;
      c.drawImage(imgA, v.dx, v.dy, v.dw, v.dh);
      c.globalAlpha = t;
      c.drawImage(imgB, v.dx, v.dy, v.dw, v.dh);
      c.globalAlpha = 1;
    }
  }

  function sizeSet(s) {
    const r = s.el.getBoundingClientRect();
    const vw = r.width > 0 ? r.width : window.innerWidth;
    const vh = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, reducedMotion ? 1 : 1.75);
    let bw = Math.round(vw * dpr);
    let bh = Math.round(vh * dpr);
    const maxPx = 4.2e6;
    if (bw * bh > maxPx) {
      const k = Math.sqrt(maxPx / (bw * bh));
      bw = Math.round(bw * k);
      bh = Math.round(bh * k);
    }
    if (s.el.width !== bw || s.el.height !== bh) {
      s.el.width = bw;
      s.el.height = bh;
    }
    const ar = IMG_W / IMG_H;
    const car = bw / bh;
    let dw, dh;
    if (car > ar) {
      dh = bh;
      dw = bh * ar;
    } else {
      dw = bw;
      dh = bw / ar;
    }
    s.view = { w: bw, h: bh, dx: (bw - dw) / 2, dy: (bh - dh) / 2, dw, dh };
    drawSection(s, true);
  }

  function sizeAll() {
    stageHeight = els.stage.offsetHeight;
    maxScroll = Math.max(1, stageHeight - window.innerHeight);
    for (let i = 0; i < sets.length; i++) sizeSet(sets[i]);
  }

  /* ───────────── Preload ───────────── */

  function loadSet(s) {
    if (s.loading) return;
    s.loading = true;
    for (let i = 0; i < FRAME_COUNT; i++) {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        s.loaded++;
        if (s === sets[0]) {
          const pct = Math.round((s.loaded / FRAME_COUNT) * 100);
          els.loaderPct.textContent = String(pct).padStart(2, '0');
          els.loaderFill.style.width = pct + '%';
          els.loaderFrames.textContent = pad(s.loaded) + ' / ' + FRAME_COUNT;
          if (reducedMotion) drawSection(s, true);
          maybeReveal();
        } else if (state.ready) {
          if (s.loaded === FRAME_COUNT) drawSection(s, true);
        }
      };
      img.src = s.dir + 'ezgif-frame-' + pad(i + 1) + '.jpg';
      s.images[i] = img;
    }
  }

  function loadRemaining() {
    for (let k = 1; k < sets.length; k++) {
      setTimeout(() => loadSet(sets[k]), 250 * k);
    }
  }

  function maybeReveal() {
    if (state.ready) return;
    if (!reducedMotion && sets[0].loaded < 36) return;
    if (reducedMotion && sets[0].loaded < 1) return;
    const elapsed = performance.now() - startedAt;
    if (elapsed < 650) {
      clearTimeout(state.revealTimer);
      state.revealTimer = setTimeout(maybeReveal, 650 - elapsed + 20);
      return;
    }
    state.ready = true;
    els.loader.classList.add('hide');
    document.body.classList.add('loaded');
    loadRemaining();
  }

  /* ───────────── Copy / label reveal ───────────── */

  function fadeWindow(p, a, b) {
    const edge = 0.035;
    const r = b >= 0.999
      ? (p - a) / edge
      : Math.min((p - a) / edge, (b - p) / edge);
    return clamp(smooth(clamp(r, 0, 1)), 0, 1);
  }

  function applyCopy(el) {
    const a = parseFloat(el.dataset.in);
    const b = parseFloat(el.dataset.out);
    const o = fadeWindow(state.progress, a, b);
    const prev = lastCopy.get(el);
    if (prev !== undefined && Math.abs(prev - o) < 0.004) return;
    lastCopy.set(el, o);
    if (o >= 0.999) {
      el.style.opacity = '1';
      el.style.transform = 'none';
      el.style.filter = 'none';
      el.style.visibility = 'visible';
    } else {
      el.style.opacity = o.toFixed(3);
      el.style.transform = 'translateY(' + ((1 - o) * 18).toFixed(1) + 'px)';
      el.style.filter = 'blur(' + ((1 - o) * 8).toFixed(1) + 'px)';
      if (o <= 0.001) el.style.visibility = 'hidden';
      else el.style.visibility = 'visible';
    }
  }

  function applyLabel(el) {
    const a = parseFloat(el.dataset.in);
    const b = parseFloat(el.dataset.out);
    const o = fadeWindow(state.progress, a, b);
    const prev = lastLabel.get(el);
    if (prev !== undefined && Math.abs(prev - o) < 0.006) return;
    lastLabel.set(el, o);
    if (o >= 0.999) {
      el.style.opacity = '1';
      el.style.transform = 'none';
    } else {
      el.style.opacity = o.toFixed(3);
      el.style.transform = 'translateY(' + ((1 - o) * 8).toFixed(1) + 'px)';
    }
  }

  /* ───────────── Scroll → progress ───────────── */

  function updateProgress() {
    const p = clamp(window.scrollY / maxScroll, 0, 1);
    state.progress = p;

    for (let i = 0; i < sets.length; i++) {
      const s = sets[i];
      const span = s.out - s.in;
      const t = span > 0 ? (p - s.in) / span : 1;
      s.target = reducedMotion ? 0 : clamp(t, 0, 1) * (FRAME_COUNT - 1);
    }

    if (window.scrollY > 24) els.nav.classList.add('visible');
    if (window.scrollY > 60) els.nav.classList.add('scrolled');

    els.progressFill.style.width = (p * 100).toFixed(2) + '%';

    /* hero video stays full-screen only through the hero copy,
       then fades out to hand over to the section panels */
    const ho = 1 - clamp((p - 0.085) / 0.08, 0, 1);
    const os = smooth(clamp(ho, 0, 1));
    els.canvas.style.opacity = os.toFixed(3);
    els.canvas.style.visibility = os <= 0.001 ? 'hidden' : 'visible';
  }

  function renderChrome() {
    const cur = sets[0].cur;
    const secs = (cur / (FRAME_COUNT - 1)) * SEQ_SECONDS;
    const m = String(Math.floor(secs / 60)).padStart(2, '0');
    const s = (secs % 60).toFixed(1);
    els.timeReadout.textContent = m + ':' + String(s).padStart(4, '0');
    els.frameCur.textContent = pad(Math.round(cur) + 1);
  }

  /* ───────────── Main loop ───────────── */

  let last = performance.now();

  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1;
    const ease = 1 - Math.exp(-dt * 14);

    for (let i = 0; i < sets.length; i++) {
      const s = sets[i];
      s.cur += (s.target - s.cur) * ease;
      if (Math.abs(s.target - s.cur) < 0.02) s.cur = s.target;
      drawSection(s, false);
    }

    renderChrome();
    for (let i = 0; i < copyEls.length; i++) applyCopy(copyEls[i]);
    for (let i = 0; i < labelEls.length; i++) applyLabel(labelEls[i]);

    requestAnimationFrame(frame);
  }

  /* ───────────── Nav smooth scroll ───────────── */

  function goTo(target) {
    if (target === 'specs') {
      const s = document.getElementById('specs');
      if (s) s.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const p = clamp(parseFloat(target), 0, 1);
    window.scrollTo({ top: p * maxScroll, behavior: 'smooth' });
  }

  document.querySelectorAll('[data-goto]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      goTo(el.dataset.goto);
    });
  });

  /* ───────────── Intersection reveals ───────────── */

  if ('IntersectionObserver' in window && !reducedMotion) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add('in');
            io.unobserve(en.target);
          }
        });
      },
      { threshold: 0.18 }
    );
    document.querySelectorAll('.spec-card, .footer-inner').forEach((el) => io.observe(el));
  } else {
    document.querySelectorAll('.spec-card, .footer-inner').forEach((el) => el.classList.add('in'));
  }

  /* ───────────── Init ───────────── */

  els.frameTotal.textContent = FRAME_COUNT;
  if (els.year) els.year.textContent = new Date().getFullYear();

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(sizeAll, 150);
  });

  window.addEventListener('scroll', updateProgress, { passive: true });

  sizeAll();
  loadSet(sets[0]);
  updateProgress();
  if (els.rotateHint) els.rotateHint.style.opacity = '0';

  if (reducedMotion) {
    for (let i = 0; i < sets.length; i++) {
      sets[i].cur = 0;
      sets[i].target = 0;
    }
    drawSection(sets[0], true);
  }

  requestAnimationFrame(frame);
})();
