/* =====================================================================
   📲 STUDY BUDDY ON THE HOME SCREEN, IN A REAL BROWSER
   ---------------------------------------------------------------------
   The real index.html, served over HTTPS under /tutor/ exactly as GitHub
   Pages serves it (a throwaway self-signed certificate, made by openssl
   for this run), in real Chromium. What it proves, none of which reading
   the source can:

     • the browser accepts the manifest and its icons;
     • sw.js registers, takes control of the page, and keeps the app;
     • with the network gone, the app still OPENS from the cache and says
       "You're offline" instead of blaming the school's wifi;
     • a page it has never kept gets the plain offline page, not the
       browser's error;
     • 📲 Install stays hidden on a desktop that has not been offered an
       install, appears when Chrome offers one, and opens the browser's
       real dialog exactly once;
     • on an iPhone it opens the "Add to Home Screen" steps, and a tap
       elsewhere closes them;
     • framed inside another page (the Science portal) it never shows.

   No account, student data, paid call or production service is contacted:
   every request to any other host is aborted.

     node tools/pwa-browser-check.mjs
     PW=/path/to/playwright/index.mjs node tools/pwa-browser-check.mjs
   ===================================================================== */
import { createServer } from 'node:https';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const modulePath = process.env.PW || '/opt/node22/lib/node_modules/playwright/index.mjs';
let chromium;
try {
  ({ chromium } = await import(modulePath.startsWith('file:') ? modulePath : pathToFileURL(modulePath).href));
} catch (e) {
  console.log('pwa-browser-check: no Playwright at ' + modulePath + ' — skipped.');
  process.exit(0);
}

let pass = 0, fail = 0;
const ok = (name, cond, note) => {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (note ? '\n      ' + note : '')); }
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms = 15000, step = 150) {
  const end = Date.now() + ms;
  let last;
  while (Date.now() < end) {
    try { last = await fn(); if (last) return last; } catch (e) { last = null; }
    await sleep(step);
  }
  return last;
}

/* ---------------- A throwaway certificate ---------------- */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pwa-check-'));
const keyFile = path.join(tmp, 'key.pem');
const certFile = path.join(tmp, 'cert.pem');
try {
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', keyFile, '-out', certFile,
    '-days', '1', '-subj', '/CN=127.0.0.1', '-addext', 'subjectAltName=IP:127.0.0.1'], { stdio: 'ignore' });
} catch (e) {
  console.log('pwa-browser-check: openssl could not make a certificate — skipped.');
  process.exit(0);
}

/* ---------------- The static server, under /tutor/ like GitHub Pages ---------------- */
const PREFIX = '/tutor/';
const served = [];
const server = createServer({ key: fs.readFileSync(keyFile), cert: fs.readFileSync(certFile) }, (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'https://localhost').pathname);
  served.push(pathname);
  if (!pathname.startsWith(PREFIX)) { res.writeHead(404).end(); return; }
  const file = path.resolve(root, '.' + pathname.slice(PREFIX.length - 1));
  if ((file !== root && !file.startsWith(root + path.sep)) || !fs.existsSync(file)) { res.writeHead(404).end(); return; }
  const target = fs.statSync(file).isDirectory() ? path.join(file, 'index.html') : file;
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
    '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
  res.setHeader('Content-Type', types[path.extname(target)] || 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.end(fs.readFileSync(target));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const ORIGIN = 'https://127.0.0.1:' + server.address().port;
const APP = ORIGIN + PREFIX;

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });

async function newContext(opts = {}) {
  const context = await browser.newContext({ ignoreHTTPSErrors: true, serviceWorkers: 'allow', ...opts });
  // Every other host — Firebase, gstatic, cdnjs, Dropbox, fonts — is refused,
  // so nothing real is ever contacted.
  await context.route(url => url.origin !== ORIGIN, route => route.abort());
  return context;
}

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

try {
  /* ---------------- 1. The manifest, the worker, the cache ---------------- */
  console.log('\nThe manifest and the worker');
  const context = await newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e && e.message || e)));
  await page.goto(APP, { waitUntil: 'load' });

  const manifest = await page.evaluate(async () => {
    const link = document.querySelector('link[rel="manifest"]');
    const res = await fetch(link.href);
    const json = await res.json();
    const icons = await Promise.all(json.icons.map(async i => {
      const r = await fetch(new URL(i.src, link.href));
      const blob = await r.blob();
      const bmp = await createImageBitmap(blob);
      return { src: i.src, sizes: i.sizes, real: bmp.width + 'x' + bmp.height, type: blob.type };
    }));
    return { ok: res.ok, start: new URL(json.start_url, link.href).href, scope: new URL(json.scope, link.href).href, icons };
  });
  ok('the manifest loads', manifest.ok);
  ok('…its start_url and scope are this folder, not the whole origin',
     manifest.start === APP && manifest.scope === APP, JSON.stringify(manifest));
  ok('…and every icon decodes at the size the manifest claims',
     manifest.icons.every(i => i.real === i.sizes && i.type === 'image/png'), JSON.stringify(manifest.icons));

  const reg = await until(() => page.evaluate(async () => {
    const r = await navigator.serviceWorker.getRegistration();
    return r && r.active ? { scope: r.scope, state: r.active.state, script: r.active.scriptURL } : null;
  }));
  ok('sw.js registers and activates', !!reg && reg.state === 'activated', JSON.stringify(reg));
  ok('…scoped to /tutor/ and no wider', reg && reg.scope === APP);

  await page.reload({ waitUntil: 'load' });
  const controlled = await until(() => page.evaluate(() => !!navigator.serviceWorker.controller));
  ok('after a reload the page is controlled by it', controlled);

  const cacheNames = await page.evaluate(() => caches.keys());
  const appVersion = await page.evaluate(() => typeof APP_VERSION === 'string' ? APP_VERSION : '');
  ok('the cache is named by the app’s version', cacheNames.includes('study-buddy-' + appVersion), JSON.stringify(cacheNames));
  const kept = await page.evaluate(async (v) => {
    const c = await caches.open('study-buddy-' + v);
    return (await c.keys()).map(r => new URL(r.url).pathname);
  }, appVersion);
  ok('…and it keeps the app and its icons', kept.includes('/tutor/') && kept.includes('/tutor/logo-192.png'), JSON.stringify(kept));
  ok('…but nothing from another host', (await page.evaluate(async (v) => {
    const c = await caches.open('study-buddy-' + v);
    return (await c.keys()).every(r => r.url.startsWith(location.origin));
  }, appVersion)));

  /* ---------------- 2. Network first ---------------- */
  console.log('\nNetwork first');
  const before = served.filter(p => p === '/tutor/').length;
  await page.reload({ waitUntil: 'load' });
  const after = served.filter(p => p === '/tutor/').length;
  ok('online, a reload still asks the server for the page (never a stale build)', after > before);

  /* ---------------- 3. Offline ---------------- */
  console.log('\nOffline');
  await context.setOffline(true);
  await page.reload({ waitUntil: 'load' }).catch(() => {});
  const offlineTitle = await page.title();
  ok('with no network, the app still opens from the cache', /Study Buddy/.test(offlineTitle), offlineTitle);
  const card = await until(() => page.evaluate(() => {
    const c = document.getElementById('signedOutCard');
    return c && !c.classList.contains('hidden') && /offline/i.test(c.textContent) ? c.textContent : '';
  }), 8000);
  ok('…and says "You’re offline", not "ask for gstatic.com to be allowed"',
     !!card && !/gstatic/.test(card), card || '(no card)');

  const sample = await context.newPage();
  await sample.goto(APP + 'sample.html?subject=math', { waitUntil: 'load' }).catch(() => {});
  const sampleText = await sample.evaluate(() => document.body ? document.body.textContent : '');
  ok('a page never kept gets the plain offline page, not the browser’s error',
     /You’re offline/.test(sampleText), sampleText.slice(0, 120));
  await sample.close();
  await context.setOffline(false);

  /* ---------------- 4. 📲 Install on a desktop ---------------- */
  console.log('\n📲 Install, Chrome');
  await page.reload({ waitUntil: 'load' });
  const hiddenAtFirst = await page.evaluate(() => document.getElementById('installBtn').hidden);
  ok('hidden until the browser offers an install', hiddenAtFirst);

  await page.evaluate(() => {
    window.__prompts = 0;
    const e = new Event('beforeinstallprompt', { cancelable: true });
    e.prompt = () => { window.__prompts++; return Promise.resolve(); };
    e.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(e);
    window.__defaultPrevented = e.defaultPrevented;
  });
  ok('when Chrome offers, the button appears', await page.isVisible('#installBtn'));
  ok('…and the browser’s own mini-bar is held back', await page.evaluate(() => window.__defaultPrevented));
  await page.click('#installBtn');
  ok('pressing it opens the browser’s real install dialog', await page.evaluate(() => window.__prompts === 1));
  await sleep(100);
  ok('…once: the button goes until the browser offers again', !(await page.isVisible('#installBtn')));
  await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
  const toastText = await until(() => page.evaluate(() => {
    const t = document.getElementById('toast');
    return t && t.classList.contains('show') ? t.textContent : '';
  }), 3000);
  ok('when the install finishes it says so', /Home Screen/.test(toastText || ''), toastText);
  ok('no script error on the page', errors.length === 0, errors.join(' | '));
  await context.close();

  /* ---------------- 5. 📲 Install on an iPhone ---------------- */
  console.log('\n📲 Install, iPhone');
  const phone = await newContext({ userAgent: IPHONE, viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const p2 = await phone.newPage();
  await p2.goto(APP, { waitUntil: 'load' });
  ok('on an iPhone the button is there from the start', await p2.isVisible('#installBtn'));
  await p2.click('#installBtn');
  if (process.env.SHOT) await p2.screenshot({ path: process.env.SHOT });
  const steps = await p2.textContent('#installPanel');
  ok('…and opens the Add to Home Screen steps', /Share/.test(steps) && /Add to Home Screen/.test(steps), steps);
  const box = await p2.locator('#installPanel').boundingBox();
  ok('…on screen at phone width', !!box && box.x >= 0 && box.x + box.width <= 390, JSON.stringify(box));
  await p2.mouse.click(200, 700);
  ok('a tap elsewhere closes them', !(await p2.isVisible('#installPanel')));
  await p2.click('#installBtn');
  await p2.click('#installClose');
  ok('…and so does ✕', !(await p2.isVisible('#installPanel')));
  await phone.close();

  /* ---------------- 6. Framed inside another page ---------------- */
  console.log('\n📲 Install, framed');
  const framed = await newContext({ userAgent: IPHONE, hasTouch: true, isMobile: true });
  const p3 = await framed.newPage();
  // A host page OUTSIDE /tutor/, as the Science portal is, framing the app.
  await framed.route(ORIGIN + '/portal.html', route => route.fulfill({
    contentType: 'text/html',
    body: '<!DOCTYPE html><iframe id="f" src="' + APP + '" style="width:900px;height:600px"></iframe>'
  }));
  await p3.goto(ORIGIN + '/portal.html', { waitUntil: 'domcontentloaded' });
  const frame = await until(async () => {
    const f = p3.frames().find(fr => fr.url().startsWith(APP));
    if (!f) return null;
    const ready = await f.evaluate(() => !!document.getElementById('installBtn') && document.readyState !== 'loading');
    return ready ? f : null;
  });
  const framedHidden = frame ? await frame.evaluate(() => document.getElementById('installBtn').hidden) : null;
  ok('inside another app’s frame the button never shows', framedHidden === true, String(framedHidden));
  await framed.close();
} catch (e) {
  fail++;
  console.log('  ✗ the check itself threw: ' + (e && e.stack || e));
} finally {
  await browser.close();
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
