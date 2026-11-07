/* =====================================================================
   ⬆⬇ THE PAGE MOVES FROM THE TOOLBAR, IN A REAL BROWSER (v1.86.0)
   ---------------------------------------------------------------------
   Opens index.html in Chromium with a six-page worksheet built the way
   `loadPdf` builds one, then presses the real toolbar buttons with a real
   pointer — a mouse on a laptop-sized window and a TOUCH on an iPad-sized
   one, because the person this was made for is on an iPad:

   • a tap on ▼ moves the page down most of a screen and ▲ brings it back;
     ▲ is dimmed at the top and ▼ at the bottom;
   • PRESS AND HOLD on ▼ keeps scrolling, and letting go stops it dead;
   • two quick taps travel two steps, not one-and-a-bit;
   • a tap on + zooms ONE step (no second zoom from a stray click listener),
     about the middle of the screen; holding + keeps zooming; ◀ ▶ appear
     only once the page is wider than the screen, and move it sideways;
   • Enter on a focused ▼ moves the page (the keyboard's click);
   • a broad fingertip (80px contact, no pencil used) still pans the page
     — the palm rule that had been eating it;
   • while a video solution plays, the buttons do nothing.

     PW=/path/to/playwright/index.mjs node tools/nudge-browser-check.mjs
     NUDGE_SCREENSHOTS=dir — also saves the toolbar
   ===================================================================== */
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const PW = process.env.PW || '/opt/node22/lib/node_modules/playwright/index.mjs';
let chromium;
try {
  ({ chromium } = await import(PW.startsWith('file:') ? PW : pathToFileURL(path.resolve(PW)).href));
} catch (e) {
  console.log('nudge-browser-check: no Playwright at ' + PW + ' — skipped.');
  process.exit(0);
}

const FILE = pathToFileURL(path.resolve(process.argv[2] || 'index.html')).href;
const SHOTS = process.env.NUDGE_SCREENSHOTS || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
const ok = (name, cond, note) => {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (note ? '\n      ' + note : '')); }
};

const browser = await chromium.launch({ ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });

async function openWorksheet(opts) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(FILE);
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    scheduleRaster = function () {};
    const container = document.getElementById('pagesContainer');
    container.innerHTML = '';
    pages = [];
    const W = 595, H = 842;
    for (let n = 1; n <= 6; n++) {
      const wrap = document.createElement('div');
      wrap.className = 'pageWrap';
      const canvas = document.createElement('canvas');
      const svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'none' });
      svg.classList.add('overlay');
      wrap.appendChild(canvas); wrap.appendChild(svg);
      container.appendChild(wrap);
      const pdfPage = {
        getViewport: ({ scale }) => ({ width: W * scale, height: H * scale, scale }),
        render: () => ({ promise: Promise.resolve() }),
        getTextContent: async () => ({ items: [] })
      };
      const p = { num: n, baseW: W, baseH: H, wrap, canvas, svg, renderTask: null, page: pdfPage,
                  viewport1: { width: W, height: H, scale: 1, convertToViewportPoint: (x, y) => [x, H - y] } };
      pages.push(p);
      attachOverlayHandlers(p);
    }
    view = 'ws'; currentDocId = 'nudge-browser-check';
    currentUser = currentUser || { uid: 'nudge-fixture', getIdToken: async () => 't' };
    showView('ws');
    annotations = [];
    renderAllOverlays();
    setDirty = function () {};
  });
  await page.waitForTimeout(150);
  await page.evaluate(() => { fitWidth(); document.getElementById('viewerArea').scrollTop = 0; });
  await page.waitForTimeout(120);
  return { ctx, page, errors };
}

const st = page => page.evaluate(() => {
  const a = document.getElementById('viewerArea');
  const cls = id => document.getElementById(id).className;
  return { top: a.scrollTop, left: a.scrollLeft, h: a.clientHeight, w: a.clientWidth,
           maxY: a.scrollHeight - a.clientHeight, maxX: a.scrollWidth - a.clientWidth, scale,
           up: cls('nudgeUpBtn'), down: cls('nudgeDownBtn'),
           lHidden: document.getElementById('nudgeLeftBtn').hidden,
           rHidden: document.getElementById('nudgeRightBtn').hidden,
           label: document.getElementById('zoomLabel').textContent };
});
const centre = (page, id) => page.evaluate(id => {
  const r = document.getElementById(id).getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, visible: r.width > 0 && r.height > 0 };
}, id);

async function pressMouse(page, id, holdMs) {
  const c = await centre(page, id);
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.waitForTimeout(holdMs);
  await page.mouse.up();
}
/* A finger on the button, through CDP, because Playwright's `tap` cannot be held. */
async function pressTouch(page, cdp, id, holdMs) {
  const c = await centre(page, id);
  const pt = { x: c.x, y: c.y, radiusX: 20, radiusY: 20, id: 1 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pt] });
  await page.waitForTimeout(holdMs);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

/* ---------------- A laptop window, a mouse ---------------- */
{
  console.log('A laptop window, pressed with a mouse');
  const { ctx, page, errors } = await openWorksheet({ viewport: { width: 1280, height: 860 } });
  let s = await st(page);
  ok('the worksheet is longer than the screen', s.maxY > s.h * 2, JSON.stringify(s));
  ok('▲ is dimmed at the top, ▼ is not', /nudgeEnd/.test(s.up) && !/nudgeEnd/.test(s.down), s.up + ' / ' + s.down);
  ok('◀ ▶ are hidden while the page fits', s.lHidden && s.rHidden);

  await pressMouse(page, 'nudgeDownBtn', 60);
  await page.waitForTimeout(450);
  const afterTap = await st(page);
  const step = Math.round(afterTap.h * 0.75);
  ok('a tap on ▼ moves the page down most of a screen', Math.abs(afterTap.top - step) <= 2,
     'moved ' + afterTap.top + ', step ' + step);
  ok('…and ▲ is no longer dimmed', !/nudgeEnd/.test(afterTap.up));

  await pressMouse(page, 'nudgeUpBtn', 60);
  await page.waitForTimeout(450);
  ok('a tap on ▲ brings it back to the top', (await st(page)).top <= 1);

  // Two quick taps: the second adds to where the first was GOING.
  await pressMouse(page, 'nudgeDownBtn', 30);
  await page.waitForTimeout(40);
  await pressMouse(page, 'nudgeDownBtn', 30);
  await page.waitForTimeout(500);
  ok('two quick taps travel two whole steps', Math.abs((await st(page)).top - 2 * step) <= 3,
     'got ' + (await st(page)).top + ', want ' + 2 * step);

  // Hold ▼ for a second: it keeps going.
  await page.evaluate(() => { document.getElementById('viewerArea').scrollTop = 0; });
  await page.waitForTimeout(80);
  const c = await centre(page, 'nudgeDownBtn');
  await page.mouse.move(c.x, c.y); await page.mouse.down();
  await page.waitForTimeout(1100);
  const mid = await st(page);
  const heldCls = await page.evaluate(() => document.getElementById('nudgeDownBtn').className);
  await page.mouse.up();
  const atRelease = (await st(page)).top;
  await page.waitForTimeout(400);
  const later = (await st(page)).top;
  ok('holding ▼ keeps scrolling, well past one step', mid.top > step * 1.2, 'after 1.1s held: ' + mid.top);
  ok('the held button looks pressed', /nudgeHeld/.test(heldCls), heldCls);
  ok('letting go stops it dead — no extra step from the release', Math.abs(later - atRelease) <= 2,
     'release ' + atRelease + ', later ' + later);
  ok('…and the pressed look goes', !/nudgeHeld/.test(await page.evaluate(() => document.getElementById('nudgeDownBtn').className)));

  // Hold to the bottom: ▼ dims there.
  await page.evaluate(() => { const a = document.getElementById('viewerArea'); a.scrollTop = a.scrollHeight; });
  await page.waitForTimeout(100);
  s = await st(page);
  ok('▼ is dimmed at the bottom', /nudgeEnd/.test(s.down), s.down);
  await pressMouse(page, 'nudgeDownBtn', 40); await page.waitForTimeout(350);
  ok('a tap at the bottom goes nowhere', Math.abs((await st(page)).top - s.maxY) <= 1);

  // ZOOM: one tap is one step, about the middle.
  await page.evaluate(() => { fitWidth(); document.getElementById('viewerArea').scrollTop = 1200; });
  await page.waitForTimeout(100);
  const z0 = await st(page);
  const midPageY0 = await page.evaluate(() => {
    const a = document.getElementById('viewerArea');
    return (a.scrollTop + a.clientHeight / 2) / scale;
  });
  await pressMouse(page, 'zoomInBtn', 50); await page.waitForTimeout(150);
  const z1 = await st(page);
  ok('one tap on + zooms exactly one step (×1.2), not two', Math.abs(z1.scale / z0.scale - 1.2) < 0.01,
     z0.scale + ' → ' + z1.scale);
  const midPageY1 = await page.evaluate(() => {
    const a = document.getElementById('viewerArea');
    return (a.scrollTop + a.clientHeight / 2) / scale;
  });
  ok('the zoom keeps the middle of the screen where it was', Math.abs(midPageY1 - midPageY0) < 8,
     midPageY0.toFixed(1) + ' → ' + midPageY1.toFixed(1));
  ok('the label says the new zoom', z1.label === Math.round(z1.scale * 100) + '%', z1.label);
  ok('◀ ▶ appear once the page is wider than the screen', !z1.lHidden && !z1.rHidden && z1.maxX > 2,
     JSON.stringify({ l: z1.lHidden, r: z1.rHidden, maxX: z1.maxX }));
  const leftBefore = z1.left;
  await pressMouse(page, 'nudgeRightBtn', 40); await page.waitForTimeout(400);
  ok('▶ moves the page sideways', (await st(page)).left > leftBefore, leftBefore + ' → ' + (await st(page)).left);
  await pressMouse(page, 'nudgeLeftBtn', 40); await page.waitForTimeout(400);
  ok('◀ moves it back', (await st(page)).left < (await st(page)).maxX);

  await page.mouse.move((await centre(page, 'zoomInBtn')).x, (await centre(page, 'zoomInBtn')).y);
  await page.mouse.down(); await page.waitForTimeout(900); await page.mouse.up();
  await page.waitForTimeout(100);
  const z2 = await st(page);
  ok('holding + keeps zooming', z2.scale > z1.scale * 1.4, z1.scale + ' → ' + z2.scale);
  await pressMouse(page, 'zoomOutBtn', 50); await page.waitForTimeout(100);
  ok('a tap on − zooms out one step', Math.abs((await st(page)).scale - z2.scale / 1.2) < 0.01);
  await page.evaluate(() => fitWidth()); await page.waitForTimeout(150);
  ok('⤢ fit hides ◀ ▶ again', (await st(page)).lHidden);

  // The keyboard: Enter on a focused ▼.
  await page.evaluate(() => { document.getElementById('viewerArea').scrollTop = 0; document.getElementById('nudgeDownBtn').focus(); });
  await page.keyboard.press('Enter'); await page.waitForTimeout(450);
  ok('Enter on a focused ▼ moves the page a step', Math.abs((await st(page)).top - step) <= 2, String((await st(page)).top));

  // A playing video solution owns the page.
  await page.evaluate(() => { document.getElementById('viewerArea').scrollTop = 0; lessonPlayback = { viewKey: '' }; });
  await page.evaluate(() => { nudgeTap('down'); });
  await page.waitForTimeout(350);
  ok('while a video solution plays, ▼ does nothing', (await st(page)).top <= 1);
  await page.evaluate(() => { lessonPlayback = null; });

  if (SHOTS) await page.locator('#wsTop').screenshot({ path: path.join(SHOTS, 'toolbar-laptop.png') });
  ok('no page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

/* ---------------- An iPad, a finger ---------------- */
{
  console.log('An iPad, pressed with a finger');
  const { ctx, page, errors } = await openWorksheet({ viewport: { width: 1024, height: 1366 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  const cdp = await ctx.newCDPSession(page);
  const c = await centre(page, 'nudgeDownBtn');
  ok('▼ is on screen in the iPad toolbar', c.visible);
  const size = await page.evaluate(() => document.getElementById('nudgeDownBtn').getBoundingClientRect().width);
  ok('…and big enough for a broad finger (44px)', size >= 44, size + 'px');
  const h = (await st(page)).h;
  await pressTouch(page, cdp, 'nudgeDownBtn', 60);
  await page.waitForTimeout(450);
  ok('a finger tap on ▼ moves the page a step', Math.abs((await st(page)).top - Math.round(h * 0.75)) <= 2,
     String((await st(page)).top));
  const before = (await st(page)).top;
  await pressTouch(page, cdp, 'nudgeDownBtn', 1000);
  const atRelease = (await st(page)).top;
  await page.waitForTimeout(400);
  ok('a finger held on ▼ keeps scrolling, well past one step', atRelease > before + h * 0.4, before + ' → ' + atRelease);
  ok('…and stops when it lifts', Math.abs((await st(page)).top - atRelease) <= 2);
  const sc0 = (await st(page)).scale;
  await pressTouch(page, cdp, 'zoomInBtn', 60); await page.waitForTimeout(150);
  ok('a finger tap on + zooms one step', Math.abs((await st(page)).scale / sc0 - 1.2) < 0.01);
  ok('no iOS-style callout / text selection on the buttons',
     await page.evaluate(() => getComputedStyle(document.getElementById('nudgeDownBtn')).userSelect === 'none'));

  // THE BROAD FINGERTIP. No pencil used; an 80px contact drags on the page.
  await page.evaluate(() => { fitWidth(); document.getElementById('viewerArea').scrollTop = 1500; });
  await page.waitForTimeout(150);
  const t0 = (await st(page)).top;
  const pr = await page.evaluate(() => {
    // The middle of the viewer, which at this scroll is on a page.
    const a = document.getElementById('viewerArea').getBoundingClientRect();
    return { x: a.left + a.width / 2, y: a.top + a.height * 0.6 };
  });
  const fat = (y) => ({ x: pr.x, y, radiusX: 40, radiusY: 40, id: 2 });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [fat(pr.y)] });
  for (let i = 1; i <= 12; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [fat(pr.y - i * 25)] });
    await page.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(500);
  const t1 = (await st(page)).top;
  const w = await page.evaluate(() => ({ pencil: pencilSeen, only: stylusOnly, lim: palmContactLimit() }));
  ok('a broad fingertip (80px contact, no pencil) drags the page', t1 > t0 + 100,
     t0 + ' → ' + t1 + ' ' + JSON.stringify(w));

  if (SHOTS) await page.locator('#wsTop').screenshot({ path: path.join(SHOTS, 'toolbar-ipad.png') });
  ok('no page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

await browser.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
