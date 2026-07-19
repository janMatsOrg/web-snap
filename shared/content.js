/**
 * shared/content.js — Web Snap orchestrator.
 *
 * Loads after shared/thanos.js and shared/modernise.js.
 * Site-specific cleaners in sites/*/cleaner.js register themselves via
 * window.__webSnapSite before any user click, so gatherClutter() picks
 * them up at snap time.
 *
 * Perpetual loop (button never disappears):
 *   idle (fresh)   →[click]→  snap + UX4G modernise  →  idle (cleaned)
 *   idle (cleaned) →[click]→  time-stone + restore    →  idle (fresh)
 */

(function () {
  'use strict';

  // ─── Local asset paths ───────────────────────────────────────────────────────
  const root = chrome.runtime.getURL('assets/');
  const ASSETS = {
    idleImg:      root + 'thanos_idle.png',
    snapImg:      root + 'thanos_snap.png',
    timeImg:      root + 'thanos_time.png',
    snapAudio:    root + 'thanos_snap_sound.mp3',
    reverseAudio: root + 'thanos_reverse_sound.mp3',
    dustAudio:    [1, 2, 3, 4].map(n => root + `thanos_dust_${n}.mp3`),
  };

  // ─── Sprite constants (both sheets: 3840×80 px = 48 frames of 80×80) ────────
  const SPRITE = { frameW: 80, frameH: 80, frames: 48, fps: 20 };

  // ─── State ───────────────────────────────────────────────────────────────────
  const state = {
    phase:      'idle',  // 'idle' | 'busy'
    hasSnapped: false,   // routes next click: false→snap, true→time-stone
    hidden:     [],      // elements kept in DOM (hidden) for restoration
    tsTimer:    null,    // setInterval for the time-stone sprite loop
  };

  // ─── Universal clutter selectors (site-specific ones live in sites/*) ────────
  const CLUTTER = [
    'marquee',
    '.ticker-wrap', '.news-ticker',
    '[class*="ticker"]', '[class*="marquee"]',
    '[id*="marquee"]',  '[id*="ticker"]',
    '.scroll-text', '.scrolling-text',
    '.notification-bar', '.alert-ticker', '.breaking-news',
  ];

  // ─── Element gathering ───────────────────────────────────────────────────────
  function gatherClutter() {
    const seen = new Set();
    const host = window.location.hostname;

    function addFromSelectors(selectors) {
      selectors.forEach(sel => {
        try {
          document.querySelectorAll(sel).forEach(el => {
            if (!el.closest('#web-snap-container') && !seen.has(el)) seen.add(el);
          });
        } catch (_) { /* ignore invalid selectors */ }
      });
    }

    // Universal selectors
    addFromSelectors(CLUTTER);

    // Site-specific selectors from plugin registry
    (window.__webSnapSite || [])
      .filter(site => site.matches.some(m => host.includes(m)))
      .forEach(site => addFromSelectors(site.selectors || []));

    return [...seen];
  }

  // Run optional custom cleanup functions registered by site plugins
  function runSiteExtras() {
    const host = window.location.hostname;
    (window.__webSnapSite || [])
      .filter(site => site.matches.some(m => host.includes(m)))
      .forEach(site => {
        if (typeof site.extraClean === 'function') {
          try { site.extraClean(); } catch (_) {}
        }
      });
  }

  // ─── Universal cosmetic fixes ────────────────────────────────────────────────
  function applyUniversalFixes() {
    if (document.getElementById('web-snap-universal')) return;
    const s = document.createElement('style');
    s.id = 'web-snap-universal';
    s.textContent = `
      body,p,div,span,td,th,li,a,input,select,textarea,label {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
                     'Helvetica Neue', Arial, sans-serif !important;
        line-height: 1.6 !important;
      }
    `;
    document.head.appendChild(s);
    document.querySelectorAll('marquee').forEach(m => { try { m.stop(); } catch (_) {} });
  }

  function revertUniversalFixes() {
    document.getElementById('web-snap-universal')?.remove();
    document.querySelectorAll('marquee').forEach(m => { try { m.start(); } catch (_) {} });
  }

  // ─── Sprite helpers ──────────────────────────────────────────────────────────

  function showFrame(el, url, idx) {
    el.style.backgroundImage    = `url('${url}')`;
    el.style.backgroundSize     = `${SPRITE.frameW * SPRITE.frames}px ${SPRITE.frameH}px`;
    el.style.backgroundRepeat   = 'no-repeat';
    el.style.backgroundPosition = `${-idx * SPRITE.frameW}px 0px`;
  }

  function playSprite(el, url) {
    return new Promise(resolve => {
      let f = 0;
      showFrame(el, url, 0);
      const t = setInterval(() => {
        if (++f >= SPRITE.frames) { clearInterval(t); resolve(); return; }
        showFrame(el, url, f);
      }, 1000 / SPRITE.fps);
    });
  }

  function loopSprite(el, url) {
    let f = 0;
    showFrame(el, url, 0);
    return setInterval(() => {
      f = (f + 1) % SPRITE.frames;
      showFrame(el, url, f);
    }, 1000 / SPRITE.fps);
  }

  function showIdleImage(el) {
    el.style.backgroundImage    = `url('${ASSETS.idleImg}')`;
    el.style.backgroundSize     = 'contain';
    el.style.backgroundRepeat   = 'no-repeat';
    el.style.backgroundPosition = 'center bottom';
  }

  // ─── Audio ───────────────────────────────────────────────────────────────────
  function playAudio(url) {
    try { new Audio(url).play().catch(() => {}); } catch (_) {}
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function clearStateClasses(...elements) {
    ['snapping', 'time-stone', 'reversing', 'cleaned'].forEach(c =>
      elements.forEach(el => el.classList.remove(c)));
  }

  function resetToIdle(gauntlet, ring, label, text) {
    clearInterval(state.tsTimer);
    state.tsTimer = null;
    clearStateClasses(gauntlet, ring, label);
    showIdleImage(gauntlet);
    label.textContent = text;
  }

  // ─── Gauntlet injection ──────────────────────────────────────────────────────
  function injectGauntlet() {
    if (document.getElementById('web-snap-container')) return;

    const container = document.createElement('div');
    container.id = 'web-snap-container';
    container.setAttribute('role', 'button');
    container.setAttribute('tabindex', '0');
    container.setAttribute('aria-label', 'Web Snap — click to clean this page');
    container.title = 'Web Snap';

    const ring     = document.createElement('div');  ring.id     = 'web-snap-ring';
    const gauntlet = document.createElement('div');  gauntlet.id = 'web-snap-gauntlet';
    const label    = document.createElement('span'); label.id    = 'web-snap-label';

    showIdleImage(gauntlet);
    label.textContent = 'web Snap';

    container.append(ring, gauntlet, label);
    document.body.appendChild(container);

    const activate = () => onActivate(container, ring, gauntlet, label);
    container.addEventListener('click', activate);
    container.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
    });
  }

  // ─── Click router ────────────────────────────────────────────────────────────
  function onActivate(container, ring, gauntlet, label) {
    if (state.phase !== 'idle') return;
    if (!state.hasSnapped) doSnap(container, ring, gauntlet, label);
    else                   doTimeStone(container, ring, gauntlet, label);
  }

  // ─── Sequence A: Snap + UX4G Modernise ───────────────────────────────────────
  async function doSnap(container, ring, gauntlet, label) {
    state.phase = 'busy';
    container.setAttribute('aria-disabled', 'true');

    gauntlet.classList.add('snapping');
    label.classList.add('snapping');
    label.textContent = '💨 Snapping…';

    playAudio(ASSETS.snapAudio);
    playSprite(gauntlet, ASSETS.snapImg); // fire-and-forget (2 400 ms)

    applyUniversalFixes();

    const targets = gatherClutter();
    state.hidden = targets;

    await sleep(400); // wait for snap peak in audio

    // Stagger all 4 dust SFX across the disintegration window
    ASSETS.dustAudio.forEach((url, i) => setTimeout(() => playAudio(url), i * 420));

    const gap = targets.length > 20 ? 50 : 80;
    targets.forEach((el, i) =>
      setTimeout(() => snapElement(el, { permanent: false }), i * gap));

    // Run any site-specific custom cleanup (stop animations, remove inline styles…)
    runSiteExtras();

    await sleep(targets.length * gap + 1600);

    // ── Apply UX4G design system to remaining page elements ──────────────────
    moderniseUI();

    // ── Return to idle (cleaned) ─────────────────────────────────────────────
    resetToIdle(gauntlet, ring, label, '↩ Restore');
    label.classList.add('cleaned');

    state.hasSnapped = true;
    state.phase = 'idle';
    container.removeAttribute('aria-disabled');
  }

  // ─── Sequence B: Time Stone — Restore ────────────────────────────────────────
  async function doTimeStone(container, ring, gauntlet, label) {
    state.phase = 'busy';
    container.setAttribute('aria-disabled', 'true');

    label.classList.remove('cleaned');
    gauntlet.classList.add('time-stone');
    ring.classList.add('time-stone');
    label.classList.add('time-stone');
    label.textContent = '⏪ Restoring…';

    playAudio(ASSETS.reverseAudio);
    state.tsTimer = loopSprite(gauntlet, ASSETS.timeImg);

    const gap = 55;
    state.hidden.forEach((el, i) =>
      setTimeout(() => restoreElement(el), i * gap));

    await sleep(state.hidden.length * gap + 900);

    revertUniversalFixes();

    // ── Return to fresh idle ─────────────────────────────────────────────────
    resetToIdle(gauntlet, ring, label, 'web Snap');

    state.hasSnapped = false;
    state.hidden = [];
    state.phase = 'idle';
    container.removeAttribute('aria-disabled');
  }

  // ─── Element restoration ─────────────────────────────────────────────────────
  function restoreElement(el) {
    if (!el || !document.body.contains(el)) return;
    el.style.visibility    = '';
    el.style.pointerEvents = '';
    delete el.dataset.webSnapHidden;
    el.style.transition =
      'opacity 0.7s ease-out, transform 0.7s ease-out, filter 0.7s ease-out';
    void el.offsetHeight; // force reflow — currently opacity:0, scaled down
    el.style.opacity = el.style.transform = el.style.filter = '';
    setTimeout(() => { el.style.transition = ''; }, 750);
  }

  // ─── Boot ────────────────────────────────────────────────────────────────────
  injectGauntlet();

})();
