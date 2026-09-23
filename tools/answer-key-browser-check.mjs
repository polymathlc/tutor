/* Real browser, synthetic worksheet pixels, local files and mocked model replies only. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const modulePath = process.env.PW || '/opt/node22/lib/node_modules/playwright/index.mjs';
const { chromium } = await import(modulePath.startsWith('file:') ? modulePath : pathToFileURL(modulePath).href);
const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const file = path.resolve(root, '.' + (url.pathname === '/' ? '/index.html' : url.pathname));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return res.writeHead(404).end();
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
  res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
const page = await context.newPage(), errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.route('https://**/*', route => route.abort());

async function install({ count = 10, known = [8], kinds = {}, held = 0 } = {}) {
  await page.evaluate(({ count, known, kinds, held }) => {
    currentUser = { uid: 'answer-key-fixture', email: 'fixture@example.invalid' };
    currentDocId = 'answer-key-fixture'; wsEpoch++; view = 'ws';
    wsMeta = { subject: 'math', guidance: 'nudge', assignmentId: '' };
    keyReset(); annotations = []; hints = []; marking = { items: [] }; chat = [];
    window.__calls = []; window.__renders = []; window.__saved = []; window.__finished = false;
    window.__kinds = kinds; window.__held = held; window.__release = null;
    setDirty = () => window.__saved.push(JSON.parse(worksheetBody()));
    toast = () => {}; scheduleRaster = () => {}; tutorFocusSync = () => {};
    keyRefreshRows = async () => {}; aiAvailable = () => true;
    const area = $('pagesContainer'); area.replaceChildren();
    pages = Array.from({ length: count }, (_, i) => {
      const num = i + 1, wrap = document.createElement('div'), canvas = document.createElement('canvas');
      wrap.className = 'pageWrap'; wrap.style.width = '400px'; wrap.style.height = '500px';
      wrap.dataset.testPage = String(num); canvas.width = 400; canvas.height = 500;
      wrap.appendChild(canvas); area.appendChild(wrap);
      return { num, baseW: 400, baseH: 500, wrap, canvas, renderTask: null, page: { getTextContent: async () => ({ items: [] }) } };
    });
    pdfDoc = { getPage: async num => ({
      getViewport: ({ scale }) => ({ width: 600 * scale, height: 800 * scale }),
      render({ canvasContext, viewport }) {
        window.__renders.push({ num, width: viewport.width, height: viewport.height });
        let cancelled = false;
        return { cancel() { cancelled = true; }, promise: new Promise(resolve => setTimeout(() => {
          // Simulate the viewer's eviction while the private PDF render is pending.
          pages.forEach(releasePageCanvas);
          if (!cancelled) {
            canvasContext.fillStyle = 'white'; canvasContext.fillRect(0, 0, viewport.width, viewport.height);
            canvasContext.fillStyle = 'black'; canvasContext.font = '24px sans-serif';
            canvasContext.fillText(num >= 6 ? 'Q8. 48 / 3 = 16. Q9. 16 x 4 = 64.' : 'Question 1. Show your working: ______', 30, 80);
            canvasContext.fillText('synthetic fixture, no student data', 30, viewport.height - 25);
          }
          resolve();
        }, 15)) };
      }
    }) };
    window.askGemini = async (prompt, options) => {
      const num = Number(prompt.match(/page (\d+)/)[1]);
      window.__calls.push({ num, hasPicture: options.images[0].data.length > 100, prompt: options.system });
      if (window.__held === num) await new Promise(resolve => { window.__release = resolve; });
      return JSON.stringify({ kind: window.__kinds[num] || 'question', confidence: 0.99 });
    };
    // Reopen an older saved worksheet with an incomplete, already-scanned key.
    applyWorksheetBody({ key: { pages: known, rows: [], scanned: true } }, {});
    applyKeyVisibility();
    window.__scan = keyAutoScan(true).then(() => { window.__finished = true; });
  }, { count, known, kinds, held });
}

try {
  await page.goto('http://127.0.0.1:' + server.address().port, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof keyAutoScan === 'function');
  await install({ kinds: { 10: 'blank', 9: 'key', 7: 'key', 6: 'key' }, held: 10 });
  await page.waitForFunction(() => !!window.__release);
  assert.equal(await page.evaluate(() => studentPages().length), 0);
  assert.equal(await page.locator('[data-test-page]:not([style*="display: none"])').count(), 0);
  assert.match(await page.locator('#keyScanStatus').textContent(), /Checking backwards/);
  await page.evaluate(() => { window.__held = 0; window.__release(); });
  await page.waitForFunction(() => window.__finished);
  const recovered = await page.evaluate(() => ({ calls: window.__calls, key: wsKey, visible: studentPages().map(p => p.num) }));
  assert.deepEqual(recovered.calls.map(c => c.num), [10, 9, 7, 6, 5]);
  assert.deepEqual(recovered.key.pages, [6, 7, 8, 9]);
  assert.deepEqual(recovered.visible, [1, 2, 3, 4, 5, 10]);
  assert.ok(recovered.calls.every(c => c.hasPicture), 'viewer canvas eviction cannot erase classifier pictures');
  assert.equal(await page.locator('[data-test-page="9"]').evaluate(e => e.style.display), 'none');
  assert.equal(await page.locator('[data-test-page="5"]').evaluate(e => e.style.display), '');
  assert.equal(await page.locator('#keyScanStatus').evaluate(e => e.hidden), true);

  await install({ count: 5, known: [], kinds: { 5: 'uncertain' } });
  await page.waitForFunction(() => window.__finished);
  assert.equal(await page.evaluate(() => window.__calls.length), 2);
  assert.equal(await page.evaluate(() => wsKey.scanPaused && !wsKey.scanned && studentPages().length === 0), true);
  assert.match(await page.locator('#keyChip').textContent(), /Retry/);
  await page.evaluate(async () => {
    wsKey.shared = true; wsKey.rows = [{ number: '8', answer: 'teacher answer' }];
    window.__kinds = { 5: 'key', 4: 'key' };
    openKeyModal();
    await keyScanJob.promise;
  });
  assert.deepEqual(await page.evaluate(() => wsKey.pages), [4, 5]);
  assert.equal(await page.evaluate(() => wsKey.rows[0].answer), 'teacher answer');
  assert.equal(await page.evaluate(() => keyLocked()), true);
  assert.equal(await page.evaluate(() => wsKey.scanPending), false);

  await install({ count: 4, known: [], kinds: { 4: 'key' }, held: 4 });
  await page.waitForFunction(() => !!window.__release);
  await page.evaluate(() => {
    currentUser = { uid: 'different-fixture-account' };
    window.__held = 0; window.__release();
  });
  await page.waitForFunction(() => window.__finished);
  assert.deepEqual(await page.evaluate(() => wsKey.pages), []);
  assert.equal(await page.evaluate(() => window.__saved.length), 0);
  assert.equal(await page.evaluate(() => studentPages().length), 0);
  assert.deepEqual(errors, []);
  console.log('Answer-key browser checks passed: recovery, continued solutions, blank tail, pending DOM privacy, private raster, bounded retry, teacher lock and stale account.');
} finally {
  await context.close(); await browser.close(); await new Promise(resolve => server.close(resolve));
}
