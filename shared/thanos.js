/**
 * shared/thanos.js — Snap disintegration animation library.
 *
 * Exposes one global function used by shared/content.js:
 *
 *   snapElement(element, options) → Promise<void>
 *
 *   options.permanent  (default: true)
 *     true  → remove element from DOM after animation (irreversible cleanup)
 *     false → hide in DOM via visibility:hidden so it can be restored later
 */
function snapElement(element, options = {}) {
  const { permanent = true } = options;

  if (!element || !document.body.contains(element)) {
    return Promise.resolve();
  }

  return new Promise(resolve => {
    const rect = element.getBoundingClientRect();

    if (rect.width < 1 || rect.height < 1) {
      if (permanent) {
        element.remove();
      } else {
        element.style.opacity       = '0';
        element.style.pointerEvents = 'none';
        element.style.visibility    = 'hidden';
        element.dataset.webSnapHidden = '1';
      }
      resolve();
      return;
    }

    // ── Canvas particle overlay (position:fixed — no scroll offset needed) ────
    const canvas = document.createElement('canvas');
    canvas.width  = Math.ceil(rect.width);
    canvas.height = Math.ceil(rect.height);
    canvas.style.cssText = `
      position:fixed;top:${rect.top}px;left:${rect.left}px;
      width:${rect.width}px;height:${rect.height}px;
      pointer-events:none;z-index:9999998;
    `;
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    // Purple/ash dust — hsl range 260–340
    const N = Math.min(Math.floor((rect.width * rect.height) / 80), 600);
    const particles = Array.from({ length: N }, () => ({
      x:     Math.random() * rect.width,
      y:     Math.random() * rect.height,
      r:     Math.random() * 3 + 1,
      color: `hsl(${260 + Math.random() * 80},${30 + Math.random() * 50}%,${50 + Math.random() * 30}%)`,
      vx:    Math.random() * 2.5 + 0.5,
      vy:   -(Math.random() * 1.5 + 0.3),
      alpha: 1,
    }));

    // ── Element exit transition ──────────────────────────────────────────────
    element.style.pointerEvents = 'none';
    element.style.transition =
      'transform 1.5s ease-in, opacity 1.5s ease-in, filter 1.5s ease-in';
    void element.offsetHeight; // force reflow

    element.style.transform = 'scale(0.85) translateY(-20px)';
    element.style.opacity   = '0';
    element.style.filter    = 'blur(4px)';

    // ── Particle draw loop ────────────────────────────────────────────────────
    const DURATION = 1500;
    let start = null;

    function draw(ts) {
      if (!start) start = ts;
      const p = Math.min((ts - start) / DURATION, 1);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const pt of particles) {
        pt.x += pt.vx * (1 + p * 2);
        pt.y += pt.vy;
        pt.alpha = Math.max(0, 1 - p * 1.4);
        ctx.globalAlpha = pt.alpha;
        ctx.fillStyle   = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.r * (1 - p * 0.4), 0, Math.PI * 2);
        ctx.fill();
      }

      if (p < 1) {
        requestAnimationFrame(draw);
      } else {
        canvas.remove();
        if (permanent) {
          element.remove();
        } else {
          element.style.visibility      = 'hidden';
          element.dataset.webSnapHidden = '1';
        }
        resolve();
      }
    }

    requestAnimationFrame(draw);
  });
}
