/* Offline cache for the 49er theory book. The file list and version are
   written in by build_web.py, so a rebuild invalidates the old cache.
   Repairs of 26 September 2026: only this book's own old caches are
   removed, the cache is filled again when another app on this site has
   deleted it, and it is filled straight from the server. */
var VERSION = "5 November 2026-29a";
var FILES = ["about.html", "app.css", "app.js", "ch1.html", "ch10.html", "ch11.html", "ch12.html", "ch13.html", "ch14.html", "ch15.html", "ch16.html", "ch2.html", "ch3.html", "ch4.html", "ch5.html", "ch6.html", "ch7.html", "ch8.html", "ch9.html", "chA.html", "chB.html", "chC.html", "data.js", "glossary.html", "howto.html", "icon-180.png", "icon-192.png", "icon-512.png", "index.html", "manifest.webmanifest", "marks.html", "sources.html", "words.html"];
var CACHE = 'k49-' + VERSION;

function fill() {
  /* straight from the server, not from the browser's own short-term cache,
     so a new build never stores an older file */
  return caches.open(CACHE).then(function (c) {
    return c.addAll(FILES.map(function (f) {
      return new Request('./' + f, { cache: 'reload' });
    }));
  });
}

self.addEventListener('install', function (e) {
  e.waitUntil(fill().then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  /* Every book and app on tasar1-ship-it.github.io shares one cache store,
     so only this book's own old caches are removed, never another app's. */
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return (k.indexOf('k49-') === 0 && k !== CACHE) ? caches.delete(k) : null;
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

/* Whether every file of the book is in this book's cache. A file a page
   asks for is stored on its own (in the fetch handler below), so finding
   one file there does not show that the others are. */
function whole() {
  return caches.open(CACHE).then(function (c) { return c.keys(); }).then(function (keys) {
    var have = Object.create(null);
    keys.forEach(function (r) { have[r.url] = true; });
    return FILES.every(function (f) { return have[new URL('./' + f, location.href).href] === true; });
  });
}

var refill = null;            // a refill under way, which a page opened meanwhile waits on

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return;
  /* Another app on this site may have removed this cache when it updated
     (older service workers there delete every cache but their own). When a
     page is opened online and any file of the book is missing, the whole
     book is fetched again. A refill that fails is tried again when the next
     page is opened. */
  if (req.mode === 'navigate') {
    if (!refill) {
      refill = whole().then(function (ok) { return ok ? null : fill(); })
        .catch(function () { /* offline: try again next time */ })
        .then(function () { refill = null; });
    }
    e.waitUntil(refill);
  }
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
