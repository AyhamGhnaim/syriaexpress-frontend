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
   زر تحديث بالهيدر — يظهر فقط بالتطبيق المثبّت على الديسكتوب.
   بوابة مزدوجة: standalone + (hover:hover and pointer:fine).
   ديناميكي بكل الصفحات: يُدرَج داخل الهيدر (flex) فلا يتراكب ولا يكسر التوسيط:
     1) .header-left  (يمين بصرياً بالـRTL — اللوحات) → إلحاق
     2) .header-spacer (خانة فاضية موازِنة) → إدراج (اللوغو يظل بالنص)
     3) .header (إلحاق كآخر عنصر)
     4) لا هيدر (صفحات عامة/دخول/طباعة) → لا يظهر (ما بتلزمها)
   الضغط: دوران CSS + location.reload() (الـSW network-first للHTML ⇒ آخر نشر). */
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

  function ensureCss() {
    if (document.getElementById('sePwaRefreshFabCss')) return;
    var css = document.createElement('style');
    css.id = 'sePwaRefreshFabCss';
    css.textContent =
      '#sePwaRefreshFab{flex:0 0 auto;width:38px;height:38px;border-radius:8px;' +
      'border:1px solid var(--border-gold,rgba(201,168,76,0.35));' +
      'background:var(--bg3,#1C1A16);color:var(--gold,#C9A84C);' +
      'font-size:19px;line-height:1;display:inline-flex;align-items:center;' +
      'justify-content:center;cursor:pointer;padding:0;-webkit-tap-highlight-color:transparent;' +
      'transition:transform .15s ease,background .15s ease,border-color .15s ease;}' +
      '#sePwaRefreshFab:hover{background:var(--bg4,#221F19);border-color:var(--gold,#C9A84C);}' +
      '#sePwaRefreshFab:active{transform:scale(0.92);}' +
      '#sePwaRefreshFab .se-fab-ico{display:inline-block;transition:transform .2s ease;}' +
      '#sePwaRefreshFab.spinning .se-fab-ico{animation:se-fab-spin .7s linear infinite;}' +
      '@keyframes se-fab-spin{to{transform:rotate(360deg);}}';
    document.head.appendChild(css);
  }

  function buildBtn() {
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
    return btn;
  }

  // إدراج ديناميكي داخل الهيدر (flex) — لا تراكب. يرجّع true لو انحلّ محل.
  function placeBtn() {
    if (document.getElementById('sePwaRefreshFab')) return true;   // حارس عنصر مكرّر
    var target = document.querySelector('.header-left')            // يمين بصرياً (اللوحات)
              || document.querySelector('.header-spacer')          // خانة موازِنة
              || document.querySelector('.header');                // آخر عنصر بالهيدر
    if (!target) return false;                                     // لا هيدر → لا يظهر
    ensureCss();
    target.appendChild(buildBtn());
    return true;
  }

  function init() {
    if (placeBtn()) return;
    document.addEventListener('DOMContentLoaded', placeBtn, { once: true });  // احتياط
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
/* ===== SE-PWA-REFRESH-FAB END ===== */

/* ===== SE-PLATFORM-LOCK-GUARD START =====
   حارس القفل الكامل — يُحمَّل على كل الصفحات عبر pwa.js.
   عند تفعيل platform_locked من لوحة الأدمن، يحوّل الزائر غير الأدمن
   لصفحة «قريباً» بدل ما يصطدم برسائل خطأ من الـ API.

   قواعد التصميم:
   - نداء واحد رخيص لـ /api/health (لا يمرّ بالقفل، وإعداداته مكاشّة 60ث).
   - fail-open: أي خطأ شبكة/ردّ غير صالح → لا تحويل إطلاقاً.
   - التحويل فقط عند locked === true صراحةً.
   - الأدمن لا يُحوَّل (توكنه يتجاوز القفل بالباكند أصلاً).
   - صفحات مستثناة: صفحة «قريباً» نفسها (منعاً للدوران) وصفحة الدخول
     (لأنها المدخل الوحيد الذي يبقى مفتوحاً ليدخل الأدمن ويفكّ القفل).
   - كاش جلسة قصير يمنع نداءً على كل تنقّل داخل نفس الجلسة. */
(function () {
  'use strict';

  var SOON  = 'syriaexpress-soon.html';
  var API   = 'https://syriaexpress-backend.onrender.com';
  var TTL   = 60 * 1000;               // مطابق لكاش الإعدادات بالباكند

  var page = (location.pathname.split('/').pop() || '').toLowerCase();
  if (page === SOON || page === 'login.html') return;   // مستثناة

  // ── هل المستخدم الحالي أدمن؟ قراءة الحمولة فقط (بلا تحقّق توقيع —
  //    التحقّق الحقيقي بالباكند؛ هذا مجرّد تفادٍ لتحويل الأدمن بصرياً). ──
  function isAdmin() {
    try {
      var t = localStorage.getItem('token');
      if (!t) return false;
      var p = t.split('.')[1];
      if (!p) return false;
      p = p.replace(/-/g, '+').replace(/_/g, '/');
      while (p.length % 4) p += '=';
      var claims = JSON.parse(decodeURIComponent(escape(atob(p))));
      return claims && claims.user_type === 'admin';
    } catch (e) { return false; }
  }
  if (isAdmin()) return;

  function go() { location.replace(SOON); }

  // كاش جلسة: يتفادى نداء health على كل صفحة خلال نفس الدقيقة
  try {
    var c = JSON.parse(sessionStorage.getItem('se_locked') || 'null');
    if (c && (Date.now() - c.at) < TTL) { if (c.locked) go(); return; }
  } catch (e) { /* كاش تالف → تجاهل واستعلم */ }

  var ac = new AbortController();
  var timer = setTimeout(function () { ac.abort(); }, 20000);
  fetch(API + '/api/health', { signal: ac.signal, cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      clearTimeout(timer);
      if (!d || typeof d.locked !== 'boolean') return;    // fail-open
      try { sessionStorage.setItem('se_locked', JSON.stringify({ locked: d.locked, at: Date.now() })); } catch (e) {}
      if (d.locked) go();
    })
    .catch(function () { clearTimeout(timer); /* fail-open: لا تحويل */ });
})();
/* ===== SE-PLATFORM-LOCK-GUARD END ===== */
