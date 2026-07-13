/* SyriaExpress PWA — سكربت مشترك يتحمّل بكل الصفحات (defer)
   - يسجّل Service Worker (/sw.js) — شرط أهلية التثبيت بكروم
   - يلتقط beforeinstallprompt ويخزّنه بـ window.AppPWA.deferredPrompt
   - يبثّ أحداث مخصّصة: pwa-install-ready / pwa-installed
   - كشوفات: standalone (منصَّب) + iOS (يشمل iPadOS المتنكر كـ Mac) */
(function () {
  'use strict';

  window.AppPWA = window.AppPWA || {};
  var P = window.AppPWA;
  if (!('deferredPrompt' in P)) P.deferredPrompt = null;

  // هل التطبيق يعمل حالياً بوضع منصَّب؟
  P.isStandalone = function () {
    try {
      return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
             window.navigator.standalone === true;
    } catch (e) { return false; }
  };

  // كشف iOS — بما فيه iPadOS الذي يتنكر كـ MacIntel (نفحص maxTouchPoints)
  P.isIOS = function () {
    try {
      var ua = navigator.userAgent || '';
      var classic = /iPhone|iPad|iPod/i.test(ua);
      var ipadOS = /Macintosh|MacIntel/i.test(navigator.platform || ua) &&
                   (navigator.maxTouchPoints || 0) > 1;
      return classic || ipadOS;
    } catch (e) { return false; }
  };

  // كشف تثبيت سابق (كروم/إيدج/بريف — يتطلب related_applications بالمانيفست).
  // يغطي حالة: التطبيق مثبّت لكن المستخدم حذف اختصار سطح المكتب فقط،
  // فلا يصل beforeinstallprompt وتظهر رسالة «غير متاح» المضلّلة.
  P.alreadyInstalled = false;
  (function checkInstalled() {
    if (!navigator.getInstalledRelatedApps) return;
    try {
      navigator.getInstalledRelatedApps().then(function (apps) {
        if (apps && apps.length > 0) {
          P.alreadyInstalled = true;
          try { window.dispatchEvent(new CustomEvent('pwa-already-installed')); } catch (err) {}
        }
      }).catch(function () {});
    } catch (e) {}
  })();

  // التقاط حدث التثبيت (كروم/إيدج/أندرويد)
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    P.deferredPrompt = e;
    try { window.dispatchEvent(new CustomEvent('pwa-install-ready')); } catch (err) {}
  });

  // بعد نجاح التثبيت
  window.addEventListener('appinstalled', function () {
    P.deferredPrompt = null;
    try { window.dispatchEvent(new CustomEvent('pwa-installed')); } catch (err) {}
  });

  // تسجيل الـ Service Worker (HTTPS أو localhost فقط — المتصفح يفرضه بنفسه)
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function () {
        /* فشل التسجيل غير مُفشِل — الموقع يعمل عادي بدونه */
      });
    });
  }
})();
