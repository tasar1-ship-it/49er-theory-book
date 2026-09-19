/* Offline cache for the 49er theory book. The file list and version are
   written in by build_web.py, so a rebuild invalidates the old cache. */
var VERSION = "19 September 2026-7";
var FILES = ["about.html", "app.css", "app.js", "ch1.html", "ch10.html", "ch11.html", "ch12.html", "ch13.html", "ch14.html", "ch15.html", "ch16.html", "ch2.html", "ch3.html", "ch4.html", "ch5.html", "ch6.html", "ch7.html", "ch8.html", "ch9.html", "chA.html", "chB.html", "chC.html", "data.js", "glossary.html", "icon-180.png", "icon-192.png", "icon-512.png", "index.html", "manifest.webmanifest", "marks.html", "sources.html"];
var CACHE = 'k49-' + VERSION;

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return c.addAll(FILES.map(function (f) { return './' + f; }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (res && res.status === 200 && res.type === 'basic') {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        return caches.match('./index.html');
      });
    })
  );
});
