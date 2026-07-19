/**
 * shared/modernise.js — UX4G Design System integration.
 *
 * Exposes two global functions called by shared/content.js
 * immediately after the snap animation completes:
 *
 *   injectUX4G()  — injects the official CDN stylesheet + JS bundles
 *   moderniseUI() — strips legacy HTML attributes and applies UX4G classes
 *                   to tables, form controls, and buttons
 *
 * CDN: https://cdn.ux4g.gov.in/UX4G@3.0.18/
 * Docs: https://ux4g.gov.in
 *
 * Note: <link> injection may be blocked by strict site CSP policies.
 * Class assignments and attribute stripping work regardless of CDN load.
 */

// ── Presentational attributes that UX4G CSS replaces ─────────────────────────
const _UX4G_LEGACY = [
  'bgcolor', 'background', 'cellspacing', 'cellpadding',
  'border', 'align', 'valign', 'hspace', 'vspace',
  'color', 'face', 'size',
];

function injectUX4G() {
  // ── Stylesheet ──────────────────────────────────────────────────────────────
  if (!document.getElementById('web-snap-ux4g-css')) {
    const link  = document.createElement('link');
    link.id     = 'web-snap-ux4g-css';
    link.rel    = 'stylesheet';
    link.href   = 'https://cdn.ux4g.gov.in/UX4G@3.0.18/index.css';
    document.head.appendChild(link);
  }

  // ── JS bundles (theme toggle, accessibility bar, skip links) ────────────────
  // Injected deferred so they never block rendering.
  ['ux4g.js', 'ux4g-custom.js'].forEach(file => {
    const src = `https://cdn.ux4g.gov.in/UX4G@3.0.18/${file}`;
    if (!document.querySelector(`script[src="${src}"]`)) {
      const s = document.createElement('script');
      s.src   = src;
      s.defer = true;
      document.head.appendChild(s);
    }
  });
}

function moderniseUI() {
  injectUX4G();

  // Tell UX4G components the language and colour theme
  if (!document.documentElement.getAttribute('lang')) {
    document.documentElement.setAttribute('lang', 'en');
  }
  document.documentElement.setAttribute('data-theme', 'light');

  // ── Tables ──────────────────────────────────────────────────────────────────
  document.querySelectorAll('table:not(.ux4g-table)').forEach(table => {
    _UX4G_LEGACY.forEach(a => table.removeAttribute(a));
    // Also strip width/height from tables specifically (not safe to remove from all)
    table.removeAttribute('width');
    table.removeAttribute('height');
    table.classList.add('ux4g-table');

    // Wrap in a responsive container (prevents overflow on small screens)
    if (!table.closest('.ux4g-table-responsive')) {
      const wrap = document.createElement('div');
      wrap.className = 'ux4g-table-responsive';
      table.parentNode.insertBefore(wrap, table);
      wrap.appendChild(table);
    }
  });

  // Strip legacy attrs from individual cells
  document.querySelectorAll('td, th').forEach(cell => {
    _UX4G_LEGACY.forEach(a => cell.removeAttribute(a));
    cell.removeAttribute('width');
    cell.removeAttribute('height');
    cell.removeAttribute('nowrap');
  });

  // ── Form controls ───────────────────────────────────────────────────────────
  document.querySelectorAll([
    'input[type="text"]',     'input[type="email"]',
    'input[type="password"]', 'input[type="tel"]',
    'input[type="number"]',   'input[type="search"]',
    'input[type="url"]',      'input[type="date"]',
    'textarea',               'select',
  ].join(',')).forEach(ctrl => {
    ctrl.classList.add('ux4g-form-control');
  });

  // ── Action buttons (submit, button) — skip our gauntlet ────────────────────
  document.querySelectorAll([
    'input[type="submit"]',
    'input[type="button"]',
    'button[type="submit"]',
  ].join(',')).forEach(btn => {
    if (btn.closest('#web-snap-container')) return;
    btn.classList.add('ux4g-btn', 'ux4g-btn-primary', 'ux4g-btn-md');
  });

  // ── Strip inline colour/font attributes from legacy elements ────────────────
  document.querySelectorAll('[color],[face],[size]').forEach(el => {
    ['color', 'face', 'size'].forEach(a => el.removeAttribute(a));
  });
}
