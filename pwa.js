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

/* ===== SE-PWA-REFRESH-FAB START =====
   زر تحديث عائم — يظهر فقط بالتطبيق المثبّت على الديسكتوب.
   بوابة مزدوجة: standalone + (hover:hover and pointer:fine).
   السبب: النافذة المثبّتة ما فيها زر تحديث؛ الـSW network-first للHTML فالـreload يجيب آخر نشر.
   الموبايل مستثنى (pull-to-refresh موجود) والمتصفح العادي مستثنى (زر تحديث أصلي). */
(function () {
  'use strict';
  if (window.__sePwaRefreshFabInit) return;      // حارس idempotent
  window.__sePwaRefreshFabInit = true;

  function isStandalone() {
    try {
      return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
             window.navigator.standalone === true;          // الثانية لـ iOS
    } catch (e) { return false; }
  }
  function isDesktopPrecise() {
    try {
      return !!(window.matchMedia &&
               window.matchMedia('(hover: hover) and (pointer: fine)').matches);
    } catch (e) { return false; }
  }

  // البوابة المزدوجة — لازم الشرطان معاً
  if (!isStandalone() || !isDesktopPrecise()) return;

  function injectFab() {
    if (document.getElementById('sePwaRefreshFab')) return; // حارس ثانٍ
    if (!document.body) return;

    if (!document.getElementById('sePwaRefreshFabCss')) {
      var css = document.createElement('style');
      css.id = 'sePwaRefreshFabCss';
      css.textContent =
        '#sePwaRefreshFab{position:fixed;bottom:22px;right:22px;width:46px;height:46px;' +
        'border-radius:50%;border:1px solid var(--border-gold,rgba(201,168,76,0.35));' +
        'background:var(--bg2,#161410);color:var(--gold,#C9A84C);font-size:22px;line-height:1;' +
        'display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;' +
        'box-shadow:0 6px 20px rgba(0,0,0,0.35);z-index:9990;' +
        '-webkit-tap-highlight-color:transparent;' +
        'transition:transform .15s ease,box-shadow .15s ease,background .15s ease;}' +
        '#sePwaRefreshFab:hover{background:var(--bg3,#1C1A16);transform:translateY(-1px);' +
        'box-shadow:0 8px 26px rgba(0,0,0,0.45);}' +
        '#sePwaRefreshFab:active{transform:scale(0.94);}' +
        '#sePwaRefreshFab .se-fab-ico{display:inline-block;transition:transform .2s ease;}' +
        '#sePwaRefreshFab.spinning .se-fab-ico{animation:se-fab-spin .7s linear infinite;}' +
        '@keyframes se-fab-spin{to{transform:rotate(360deg);}}';
      document.head.appendChild(css);
    }

    var btn = document.createElement('button');
    btn.id = 'sePwaRefreshFab';
    btn.type = 'button';
    btn.title = 'تحديث';
    btn.setAttribute('aria-label', 'تحديث');

    var ico = document.createElement('span');
    ico.className = 'se-fab-ico';
    ico.textContent = '\u21BB';                    // رمز التحديث — Unicode escape واحد
    btn.appendChild(ico);

    btn.addEventListener('click', function () {
      btn.classList.add('spinning');               // دوران CSS
      try { location.reload(); }                   // network-first ⇒ آخر نشر
      catch (e) { window.location.href = window.location.href; }
    });

    document.body.appendChild(btn);
  }

  if (document.body) injectFab();
  else document.addEventListener('DOMContentLoaded', injectFab, { once: true });
})();
/* ===== SE-PWA-REFRESH-FAB END ===== */
