/* SyriaExpress Service Worker
   الغرض الأساسي: أهلية تثبيت PWA (حدث fetch مسجَّل شرط إلزامي بكروم).
   caching محافظ: same-origin GET فقط — الـ API (onrender.com) وCloudinary
   والخطوط كلها cross-origin فلا تُلمَس إطلاقاً.
   عند تعديل أي أصل ثابت (js/css/صور): ارفع SW_VERSION ليُنظَّف الكاش القديم. */

const SW_VERSION = 'se-pwa-v3';
const PAGE_CACHE = SW_VERSION + '-pages';
const STATIC_CACHE = SW_VERSION + '-static';

self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (k) { return k.indexOf(SW_VERSION) !== 0; })
          .map(function (k) { return caches.delete(k); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  const req = event.request;

  // GET فقط — أي POST/PUT/PATCH/DELETE يمرّ للشبكة بلا تدخّل
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }

  // deny صريح: أي أصل خارجي (API على onrender.com، Cloudinary، خطوط Google...)
  // لا يُعترَض ولا يُكاش نهائياً
  if (url.origin !== self.location.origin) return;

  // deny احتياطي: أي مسار /api/ حتى لو صار يوماً same-origin
  if (url.pathname.indexOf('/api/') === 0) return;

  // الـ SW نفسه لا يُكاش (تحديثاته يديرها المتصفح)
  if (url.pathname === '/sw.js') return;

  const isHTML =
    req.mode === 'navigate' ||
    url.pathname === '/' ||
    /\.html$/.test(url.pathname);

  if (isHTML) {
    // HTML: الشبكة أولاً — الكاش يُستخدم فقط عند انقطاع الشبكة
    // (لا نتنافس مع Cloudflare على نضارة الصفحات)
    event.respondWith(networkFirst(req));
  } else {
    // أصول ثابتة (js/css/png...): stale-while-revalidate
    // سرعة فورية + تحديث بالخلفية (logos.js وحده 4.6MB — الكاش يفيده كثيراً)
    event.respondWith(staleWhileRevalidate(req));
  }
});

function networkFirst(req) {
  return caches.open(PAGE_CACHE).then(function (cache) {
    return fetch(req).then(function (res) {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    }).catch(function () {
      return cache.match(req).then(function (cached) {
        if (cached) return cached;
        return Response.error();
      });
    });
  });
}

function staleWhileRevalidate(req) {
  return caches.open(STATIC_CACHE).then(function (cache) {
    return cache.match(req).then(function (cached) {
      const refetch = fetch(req).then(function (res) {
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      }).catch(function () { return null; });
      return cached || refetch.then(function (res) {
        return res || Response.error();
      });
    });
  });
}
