(function () {
  'use strict';

  (window.__webSnapSite = window.__webSnapSite || []).push({
    matches: ['uidai.gov.in', 'myaadhaar.uidai.gov.in', 'resident.uidai.gov.in'],

    selectors: [
      '.uidai-news-ticker',
      '#marqueeSection',
      '.home-slider',
      '.uidai-social-icons',
      '.uidai-banner',
      '#carouselHome',
      '.aadhaar-slider',
      '.notification-ticker',
      '[id*="news"]',
      '[id*="News"]',
      '[class*="news-ticker"]',
      '[class*="social-media"]',
      '.pop-notification',
      '#gdprBanner',
      '.cookie-banner',        // UIDAI cookie consent banners
    ],

    extraClean() {
      // Remove cookie consent / GDPR popups that overlay content
      document.querySelectorAll(
        '[class*="cookie"], [id*="cookie"], [id*="gdpr"], [class*="gdpr"]'
      ).forEach(el => {
        if (!el.closest('#web-snap-container')) el.style.display = 'none';
      });
      // Stop all auto-playing videos on UIDAI pages
      document.querySelectorAll('video[autoplay]').forEach(v => {
        try { v.pause(); v.removeAttribute('autoplay'); } catch (_) {}
      });
    },
  });
})();
