/* 📲 Study Buddy on the Home Screen: the manifest, the icons, sw.js and
   install-app.js — the rules nobody sees until a student's iPad shows a
   blank tile or yesterday's build:

     • the manifest is valid, scoped to this folder and points at icons
       that exist at the sizes it claims;
     • the worker is NETWORK FIRST, answers only same-folder GETs, never a
       Range request, never Firebase or a CDN, keeps a page under its
       address without the query, and falls back to the cache, then to a
       plain offline page;
     • the worker's cache is named by the app's version, and the version is
       the same in sw.js, APP_VERSION and every ?v= that loads the feature;
     • the 📲 button is only offered where the device can act on it, and
       the worker is registered only on https.

   Run: node --test tools/pwa-tests.mjs */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = p => fs.readFileSync(new URL('../' + p, import.meta.url));
const HTML = read('index.html').toString('utf8');
const SW = read('sw.js').toString('utf8');
const INSTALL = read('install-app.js').toString('utf8');
const CSS = read('install-app.css').toString('utf8');
const MANIFEST = JSON.parse(read('manifest.webmanifest').toString('utf8'));

const APP_VERSION = (HTML.match(/var APP_VERSION = '(v[\d.]+)';/) || [])[1];
const SW_VERSION = (SW.match(/var VERSION = '(v[\d.]+)';/) || [])[1];

function pngSize(buf) {
  // The IHDR chunk: width and height are the two big-endian words at 16 and 20.
  assert.equal(buf.slice(1, 4).toString('latin1'), 'PNG', 'not a PNG');
  return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
}

/* ---------------- The manifest and the icons ---------------- */

test('the manifest is installable: name, standalone, scoped to this folder', () => {
  assert.equal(MANIFEST.short_name, 'Study Buddy');
  assert.ok(MANIFEST.name.startsWith('Study Buddy'));
  assert.equal(MANIFEST.display, 'standalone');
  // Relative on purpose: on GitHub Pages the app is /tutor/, and an absolute
  // "/" would claim every Polymath app on the origin.
  assert.equal(MANIFEST.start_url, './');
  assert.equal(MANIFEST.scope, './');
  assert.equal(MANIFEST.theme_color, '#FFE0B2');
  assert.match(HTML, /<meta name="theme-color" content="#FFE0B2">/);
});

test('every manifest icon exists, is a PNG, and is the size it says', () => {
  const sizes = new Set();
  for (const icon of MANIFEST.icons) {
    assert.ok(!/^https?:/.test(icon.src), icon.src + ' must sit next to the app');
    const [w, h] = pngSize(read(icon.src));
    assert.equal(icon.sizes, w + 'x' + h, icon.src);
    sizes.add(icon.sizes + ' ' + icon.purpose);
  }
  // Chrome asks for 192 and 512 before it offers to install; Android wants a
  // maskable one so the launcher does not shrink the logo inside a white disc.
  assert.ok(sizes.has('192x192 any'));
  assert.ok(sizes.has('512x512 any'));
  assert.ok(sizes.has('512x512 maskable'));
});

test('index.html links the manifest and the local icons, before any script', () => {
  const head = HTML.slice(0, HTML.indexOf('</head>'));
  assert.match(head, /<link rel="manifest" href="manifest\.webmanifest">/);
  assert.match(head, /<link rel="apple-touch-icon" sizes="192x192" href="logo-192\.png">/);
  assert.match(head, /<link rel="icon" type="image\/png" sizes="192x192" href="logo-192\.png">/);
  assert.match(head, /<meta name="apple-mobile-web-app-capable" content="yes">/);
  assert.match(head, /<meta name="apple-mobile-web-app-title" content="Study Buddy">/);
  // A home-screen icon on a host a school network can block is a blank tile.
  assert.doesNotMatch(head, /rel="apple-touch-icon"[^>]*dropbox/);
});

/* ---------------- One version everywhere ---------------- */

test('sw.js, APP_VERSION and the ?v= on the feature files agree', () => {
  assert.ok(APP_VERSION, 'APP_VERSION not found');
  assert.equal(SW_VERSION, APP_VERSION);
  const v = APP_VERSION.slice(1);
  assert.ok(HTML.includes('<script src="install-app.js?v=' + v + '"></script>'), 'install-app.js?v=' + v);
  assert.ok(HTML.includes('<link rel="stylesheet" href="install-app.css?v=' + v + '">'), 'install-app.css?v=' + v);
  assert.match(SW, /var CACHE = 'study-buddy-' \+ VERSION;/);
});

test('install-app.js loads after toast() is defined, so it can say so when it installs', () => {
  assert.ok(HTML.indexOf('<script src="install-app.js') > HTML.indexOf('function toast('));
});

/* ---------------- sw.js, driven with a fake worker scope ---------------- */

const ORIGIN = 'https://polymathlc.github.io';
const SCOPE = ORIGIN + '/tutor/';

function fakeCaches() {
  const stores = new Map();
  const keyOf = req => (typeof req === 'string' ? new URL(req, SCOPE).href : req.url);
  const strip = href => { const u = new URL(href); return u.origin + u.pathname; };
  function store(name) {
    if (!stores.has(name)) {
      const m = new Map();
      stores.set(name, {
        _m: m,
        put: async (req, res) => { m.set(keyOf(req), res); },
        match: async (req, opts) => {
          const k = keyOf(req);
          if (m.has(k)) return m.get(k);
          if (opts && opts.ignoreSearch) {
            for (const [kk, v] of m) if (strip(kk) === strip(k)) return v;
          }
          return undefined;
        }
      });
    }
    return stores.get(name);
  }
  return {
    stores,
    open: async name => store(name),
    keys: async () => [...stores.keys()],
    delete: async name => stores.delete(name)
  };
}

class FakeResponse {
  constructor(body, init = {}) {
    this.body = body;
    this.status = init.status == null ? 200 : init.status;
    this.ok = this.status >= 200 && this.status < 300;
    this.type = init.type || 'basic';
    this.headers = new Map(Object.entries(init.headers || {}));
  }
  clone() { return new FakeResponse(this.body, { status: this.status, type: this.type }); }
  static error() { const r = new FakeResponse(null, { status: 0, type: 'error' }); r.isError = true; return r; }
}

function request(url, { method = 'GET', mode = 'cors', headers = {} } = {}) {
  const h = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return { url: new URL(url, SCOPE).href, method, mode, headers: { has: k => h.has(k.toLowerCase()) } };
}

function loadWorker({ network } = {}) {
  const listeners = {};
  const caches = fakeCaches();
  const net = { mode: 'online', served: [], files: new Map() };
  const self = {
    location: new URL(SCOPE + 'sw.js'),
    registration: { scope: SCOPE },
    skipWaiting: async () => {},
    clients: { claim: async () => {} },
    addEventListener: (type, fn) => { listeners[type] = fn; }
  };
  const fetch = async (req) => {
    const url = typeof req === 'string' ? new URL(req, SCOPE).href : req.url;
    net.served.push(url);
    if (net.mode === 'offline') throw new TypeError('Failed to fetch');
    if (network) return network(url);
    return new FakeResponse('body of ' + url);
  };
  const sandbox = { self, caches, fetch, Response: FakeResponse, URL, Promise, console };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(SW, sandbox, { filename: 'sw.js' });
  return {
    sandbox, caches, net, listeners,
    async dispatch(type, extra = {}) {
      let waited = null, responded = null;
      const event = {
        ...extra,
        waitUntil: p => { waited = p; },
        respondWith: p => { responded = p; }
      };
      listeners[type](event);
      if (waited) await waited;
      return { responded: responded ? await responded : null, intercepted: !!responded };
    },
    async fetchEvent(req) {
      const out = await this.dispatch('fetch', { request: req });
      // Let the background cache.put land.
      await new Promise(r => setTimeout(r, 0));
      return out;
    }
  };
}

test('sw.js parses and listens for install, activate and fetch', () => {
  const w = loadWorker();
  for (const t of ['install', 'activate', 'fetch']) assert.equal(typeof w.listeners[t], 'function', t);
});

test('install keeps the shell; one missing file does not fail the install', async () => {
  const w = loadWorker({
    network: url => (url.endsWith('logo-512.png') ? new FakeResponse('', { status: 404 }) : new FakeResponse('ok ' + url))
  });
  await w.dispatch('install');
  const store = w.caches.stores.get('study-buddy-' + APP_VERSION);
  assert.ok(store, 'the versioned cache exists');
  assert.ok(store._m.has(SCOPE), 'the app page');
  assert.ok(store._m.has(SCOPE + 'manifest.webmanifest'));
  assert.ok(store._m.has(SCOPE + 'logo-192.png'));
  assert.ok(!store._m.has(SCOPE + 'logo-512.png'), 'a 404 is never kept');
});

test('activate drops every older study-buddy cache and nothing else', async () => {
  const w = loadWorker();
  await w.caches.open('study-buddy-v1.0.0');
  await w.caches.open('study-buddy-' + APP_VERSION);
  await w.caches.open('someone-elses-cache');
  await w.dispatch('activate');
  const names = await w.caches.keys();
  assert.deepEqual(names.sort(), ['someone-elses-cache', 'study-buddy-' + APP_VERSION].sort());
});

test('only same-folder GETs are intercepted — never Firebase, a CDN, a POST, a Range or another app', async () => {
  const w = loadWorker();
  const skip = [
    request('https://firestore.googleapis.com/v1/projects/x'),
    request('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js'),
    request('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'),
    request('https://us-central1-mathgen--app.cloudfunctions.net/studyBuddyConsult', { method: 'POST' }),
    request(SCOPE + 'index.html', { method: 'POST' }),
    request(SCOPE + 'clip.webm', { headers: { Range: 'bytes=0-100' } }),
    request(ORIGIN + '/anskey/index.html', { mode: 'navigate' }),
    request(ORIGIN + '/cer/app.js')
  ];
  for (const r of skip) {
    const out = await w.fetchEvent(r);
    assert.equal(out.intercepted, false, r.method + ' ' + r.url);
  }
  const take = [request(SCOPE, { mode: 'navigate' }), request(SCOPE + 'consult.js?v=1.65.0'), request(SCOPE + 'logo-192.png')];
  for (const r of take) assert.equal((await w.fetchEvent(r)).intercepted, true, r.url);
});

test('network first: online, the network answers even when a cached copy exists', async () => {
  let build = 'old';
  const w = loadWorker({ network: () => new FakeResponse('build ' + build) });
  await w.fetchEvent(request(SCOPE, { mode: 'navigate' }));
  build = 'new';
  const out = await w.fetchEvent(request(SCOPE, { mode: 'navigate' }));
  assert.equal(out.responded.body, 'build new', 'a merge reaches the student on the next open');
});

test('offline: the last good page is served, under its address without the query', async () => {
  const w = loadWorker({ network: url => new FakeResponse('page ' + new URL(url).pathname) });
  await w.fetchEvent(request(SCOPE + '?consult=abc123', { mode: 'navigate' }));
  const store = w.caches.stores.get('study-buddy-' + APP_VERSION);
  assert.ok(store._m.has(SCOPE), 'kept as the bare folder');
  assert.ok(![...store._m.keys()].some(k => k.includes('consult=')), 'never one copy per consult id');
  w.net.mode = 'offline';
  const out = await w.fetchEvent(request(SCOPE + '?ws=xyz', { mode: 'navigate' }));
  assert.equal(out.responded.body, 'page /tutor/');
});

test('offline: index.html and the bare folder stand in for each other', async () => {
  const w = loadWorker({ network: () => new FakeResponse('the app') });
  await w.fetchEvent(request(SCOPE, { mode: 'navigate' }));
  w.net.mode = 'offline';
  const out = await w.fetchEvent(request(SCOPE + 'index.html', { mode: 'navigate' }));
  assert.equal(out.responded.body, 'the app');
});

test('offline: the sample page is never answered with the app', async () => {
  const w = loadWorker({ network: () => new FakeResponse('the app') });
  await w.fetchEvent(request(SCOPE, { mode: 'navigate' }));
  w.net.mode = 'offline';
  const out = await w.fetchEvent(request(SCOPE + 'sample.html', { mode: 'navigate' }));
  assert.match(out.responded.body, /You’re offline/);
});

test('offline with nothing kept: a plain offline page, not the browser error', async () => {
  const w = loadWorker();
  w.net.mode = 'offline';
  const out = await w.fetchEvent(request(SCOPE, { mode: 'navigate' }));
  assert.equal(out.responded.status, 200);
  assert.equal(out.responded.headers.get('Content-Type'), 'text/html; charset=utf-8');
  assert.match(out.responded.body, /You’re offline/);
  assert.match(out.responded.body, /location\.reload\(\)/);
});

test('offline: a file is served from the cache, the exact ?v= first', async () => {
  const w = loadWorker({ network: url => new FakeResponse('file ' + url) });
  await w.fetchEvent(request(SCOPE + 'consult.js?v=1.65.0'));
  w.net.mode = 'offline';
  const exact = await w.fetchEvent(request(SCOPE + 'consult.js?v=1.65.0'));
  assert.equal(exact.responded.body, 'file ' + SCOPE + 'consult.js?v=1.65.0');
  const other = await w.fetchEvent(request(SCOPE + 'consult.js?v=9.9.9'));
  assert.equal(other.responded.body, 'file ' + SCOPE + 'consult.js?v=1.65.0', 'any copy beats a failed load offline');
  const none = await w.fetchEvent(request(SCOPE + 'never-seen.js'));
  assert.equal(none.responded.isError, true);
});

test('an error page or an opaque answer is never kept as the app', async () => {
  const w = loadWorker({ network: () => new FakeResponse('Server error', { status: 500 }) });
  const out = await w.fetchEvent(request(SCOPE, { mode: 'navigate' }));
  assert.equal(out.responded.status, 500, 'the real answer still goes to the page');
  const store = w.caches.stores.get('study-buddy-' + APP_VERSION);
  assert.ok(!store || !store._m.has(SCOPE));
});

/* ---------------- install-app.js ---------------- */

function loadInstall(extra = {}) {
  const sandbox = { console, URL, JSON, Math, String, Object, ...extra };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(INSTALL, sandbox, { filename: 'install-app.js' });
  return sandbox;
}

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const IPAD_OS = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36';
const MAC = IPAD_OS;

test('install-app.js loads with no DOM at all and exposes its surface', () => {
  const ctx = loadInstall();
  for (const k of ['installCase', 'isAppleTouch', 'shouldRegister', 'currentCase', 'render', 'register', 'openPanel', 'closePanel'])
    assert.equal(typeof ctx.StudyBuddyInstall[k], 'function', k);
});

test('the 📲 button is offered only where the device can act on it', () => {
  const I = loadInstall().StudyBuddyInstall;
  const c = env => I.installCase(env);
  assert.equal(c({ ua: ANDROID, hasPrompt: true }), 'prompt');
  assert.equal(c({ ua: ANDROID }), 'none', 'Chrome has not offered yet');
  assert.equal(c({ ua: IPHONE, maxTouchPoints: 5 }), 'ios');
  assert.equal(c({ ua: IPAD_OS, maxTouchPoints: 5 }), 'ios', 'iPadOS says Macintosh');
  assert.equal(c({ ua: MAC, maxTouchPoints: 0 }), 'none', 'a real Mac is not an iPad');
  assert.equal(c({ ua: IPHONE, standalone: true }), 'installed');
  assert.equal(c({ ua: ANDROID, hasPrompt: true, standalone: true }), 'installed');
  assert.equal(c({ ua: IPHONE, framed: true }), 'framed', 'inside the Science portal the install is the portal’s');
  assert.equal(c({ ua: ANDROID, hasPrompt: true, framed: true }), 'framed');
});

test('the worker is registered only on https', () => {
  const I = loadInstall().StudyBuddyInstall;
  assert.equal(I.shouldRegister('https:', true), true);
  assert.equal(I.shouldRegister('https:', false), false);
  assert.equal(I.shouldRegister('http:', true), false, 'the local harnesses stay worker-free');
  assert.equal(I.shouldRegister('file:', true), false);
});

test('the header carries the button hidden, and the panel is never a modal', () => {
  assert.match(HTML, /<button class="btn" id="installBtn" type="button" hidden[^>]*>📲 Install<\/button>/);
  assert.match(HTML, /<div class="installPanel" id="installPanel"[^>]*hidden><\/div>/);
  const header = HTML.slice(HTML.indexOf('<header>'), HTML.indexOf('</header>'));
  assert.ok(header.includes('id="installBtn"'), 'it lives in the header');
  assert.ok(header.indexOf('id="installBtn"') < header.indexOf('id="signInBtn"'));
  assert.doesNotMatch(CSS, /\.installPanel[^{]*\{[^}]*position:\s*fixed;[^}]*inset:\s*0/);
  assert.doesNotMatch(INSTALL, /aria-modal/);
  assert.match(CSS, /@media print \{ \.installMenu \{ display: none !important; \} \}/);
});

test('the browser’s own mini-bar is held back and the prompt is used once', () => {
  assert.match(INSTALL, /e\.preventDefault\(\);\s*deferredPrompt = e;/);
  assert.match(INSTALL, /deferredPrompt = null;\s*try \{\s*p\.prompt\(\);/);
});

test('install-app.js never touches the app’s data', () => {
  for (const bad of ['firebase', 'firestore', 'localStorage', 'indexedDB', 'annotations', 'fetch('])
    assert.ok(!INSTALL.includes(bad), bad);
});

test('offline, the "could not finish loading" card says offline instead of blaming the network', () => {
  const i = HTML.indexOf('function renderMissingLibs()');
  const body = HTML.slice(i, HTML.indexOf('\n}\n', i));
  assert.match(body, /navigator\.onLine === false/);
  assert.ok(body.indexOf('You\\u2019re offline') < body.indexOf('could not finish loading'));
});
