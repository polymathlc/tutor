/* =====================================================================
   sw.js — Study Buddy's service worker (v1.71.0)
   ---------------------------------------------------------------------
   It exists so the app can be INSTALLED (Android and desktop Chrome ask
   for one before they offer "Install app") and so a student who opens it
   with no signal sees the app and a plain "you're offline" rather than
   the browser's dinosaur. It is deliberately NOT an offline copy of the
   app's data: the worksheets, the marking and the buddy all live in the
   cloud and need the network anyway.

   • NETWORK FIRST, ALWAYS. index.html changes with every merge and is
     served by GitHub Pages the moment a PR lands. A cache-first worker
     would keep a student on yesterday's build until some second visit —
     the stale-code bug every PWA ships once. Here the network answers
     whenever it can, and the cache is only the fallback when it cannot.
   • SAME ORIGIN, GET, NO RANGE — AND NOTHING ELSE IS TOUCHED. Firebase,
     Firestore, Storage, the AI calls, gstatic and cdnjs go straight to the
     network exactly as before; a worker that answered one of those from a
     cache would be answering a sign-in or a marking call with an old one.
     A Range request (a video seeking) is left alone too: a cached whole
     body is the wrong answer to "bytes 2000–4000".
   • ONLY A GOOD, PLAIN ANSWER IS KEPT (`res.ok && res.type === 'basic'`),
     so an error page is never saved as the app.
   • THE CACHE IS NAMED BY VERSION and every older `study-buddy-` cache is
     dropped on activate, so the storage never grows build by build.
   ===================================================================== */
'use strict';

var VERSION = 'v1.71.0';
var CACHE = 'study-buddy-' + VERSION;
var CACHE_PREFIX = 'study-buddy-';

/* The shell kept from the first visit, so the app opens with no signal
   even if the student never got past the sign-in screen. Each is added on
   its own: one file that fails must not stop the worker installing. */
var SHELL = [
  './',
  'manifest.webmanifest',
  'logo-192.png',
  'logo-512.png'
];

var OFFLINE_HTML =
  '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">' +
  '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
  '<title>Study Buddy — offline</title>' +
  '<style>body{margin:0;min-height:100vh;display:grid;place-items:center;' +
  'font-family:"Century Gothic",CenturyGothic,AppleGothic,"Segoe UI",sans-serif;' +
  'background:#F7F6F4;color:#1A1A1A;padding:24px;box-sizing:border-box}' +
  '.card{max-width:420px;background:#fff;border:1px solid #ECECEA;border-radius:16px;' +
  'padding:28px;box-shadow:0 4px 12px rgba(0,0,0,.06);text-align:center}' +
  'h1{font-size:1.25rem;margin:0 0 10px}p{color:#55554F;line-height:1.5;margin:0 0 18px}' +
  'button{font:inherit;font-weight:600;background:#FFE0B2;border:1px solid #FFCC80;' +
  'border-radius:11px;padding:10px 18px;cursor:pointer}</style></head><body>' +
  '<div class="card"><h1>📶 You’re offline</h1>' +
  '<p>Study Buddy needs the internet to open your worksheets and to talk to Chung GPT. ' +
  'Connect to wifi or mobile data, then try again.</p>' +
  '<button onclick="location.reload()">Try again</button></div></body></html>';

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return Promise.all(SHELL.map(function (url) {
        return fetch(url, { cache: 'reload' }).then(function (res) {
          if (keepable(res)) return cache.put(url, res);
        }).catch(function () { /* one missing file is not a failed install */ });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key.indexOf(CACHE_PREFIX) === 0 && key !== CACHE) return caches.delete(key);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

function keepable(res) {
  return !!res && res.ok && res.type === 'basic';
}

/* The ONE test of which requests this worker answers. Everything it
   returns false for is never intercepted at all — not passed through, not
   looked at: `respondWith` is simply not called. */
function handles(request) {
  if (request.method !== 'GET') return false;
  if (request.headers.has('range')) return false;
  var url;
  try { url = new URL(request.url); } catch (e) { return false; }
  if (url.origin !== self.location.origin) return false;
  // Stay inside our own folder: on GitHub Pages the other Polymath apps
  // share this origin (/anskey/, /cer/, /math/) and are none of ours.
  var scope = new URL(self.registration.scope);
  if (url.pathname.indexOf(scope.pathname) !== 0) return false;
  return true;
}

function pageKey(href) {
  var url = new URL(href);
  return url.origin + url.pathname;
}
function isAppPage(href) {
  var path = new URL(href).pathname;
  var scope = new URL(self.registration.scope).pathname;
  return path === scope || path === scope + 'index.html';
}

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (!handles(request)) return;
  var isPage = request.mode === 'navigate';
  event.respondWith(
    fetch(request).then(function (res) {
      if (keepable(res)) {
        var copy = res.clone();
        // A page is kept under its address WITHOUT the query: `?consult=…`
        // and `?ws=…` are one-off links, and keeping one per id would fill
        // the cache with copies of the same file.
        var key = isPage ? pageKey(request.url) : request;
        caches.open(CACHE).then(function (cache) { return cache.put(key, copy); }).catch(function () {});
      }
      return res;
    }).catch(function () {
      return caches.open(CACHE).then(function (cache) {
        if (isPage) {
          return cache.match(pageKey(request.url)).then(function (hit) {
            // `index.html` and the bare folder are the same page.
            if (hit || !isAppPage(request.url)) return hit;
            return cache.match(new URL('./', self.registration.scope).href).then(function (h) {
              return h || cache.match(new URL('index.html', self.registration.scope).href);
            });
          }).then(function (hit) {
            return hit || new Response(OFFLINE_HTML, {
              status: 200,
              headers: { 'Content-Type': 'text/html; charset=utf-8' }
            });
          });
        }
        return cache.match(request, { ignoreSearch: false }).then(function (hit) {
          return hit || cache.match(request, { ignoreSearch: true });
        }).then(function (hit) {
          return hit || Response.error();
        });
      });
    })
  );
});
