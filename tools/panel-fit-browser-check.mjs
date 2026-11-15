/* =====================================================================
   📐 THE APP FITS THE SCREEN, IN A REAL BROWSER (v1.93.0)
   ---------------------------------------------------------------------
   "In portrait mode the side bar where the assistant lives is cut off."
   Opens index.html in Chromium with a three-page worksheet built the way
   `loadPdf` builds one, at the sizes students use, and checks:

   • an iPad STANDING UP (768, 820, 1024 wide) docks Chung GPT UNDER the
     page: the page and the panel are both on screen, side by side in
     height, nothing runs off any edge, and the worksheet opens WITH the
     panel (it opened closed before, behind "Open control panel");
   • an iPad lying down and a laptop keep the panel beside the page;
   • a phone keeps its sheet, which the worksheet opens without;
   • the handle makes the docked panel taller and shorter, is clamped so
     some page always shows, and the share is remembered after a reload;
   • with the on-screen keyboard up (a shrunken visualViewport, the way
     iPad Safari reports it) the panel's tabs and its Ask box are both
     above the keyboard, docked, on a phone and lying down;
   • the floating boxes stand on the docked panel, not over it;
   • a student's header is one row with 🧭 Apps on one line on an iPad
     standing up.

     PW=/path/to/playwright/index.mjs node tools/panel-fit-browser-check.mjs
     PANEL_SCREENSHOTS=dir — also saves each size
   ===================================================================== */
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const PW = process.env.PW || '/opt/node22/lib/node_modules/playwright/index.mjs';
let chromium;
try {
  ({ chromium } = await import(PW.startsWith('file:') ? PW : pathToFileURL(path.resolve(PW)).href));
} catch (e) {
  console.log('panel-fit-browser-check: no Playwright at ' + PW + ' — skipped.');
  process.exit(0);
}

const FILE = pathToFileURL(path.resolve(process.argv[2] || 'index.html')).href;
const SHOTS = process.env.PANEL_SCREENSHOTS || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
const ok = (name, cond, note) => {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (note ? '\n      ' + note : '')); }
};

const browser = await chromium.launch({ ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });

async function openWorksheet(width, height, extra) {
  const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: true, ...(extra || {}) });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(FILE);
  await page.waitForTimeout(600);
  await worksheet(page);
  return { ctx, page, errors };
}
/* The fixture, then exactly what opening a worksheet does with the panel. */
async function worksheet(page) {
  await page.evaluate(() => {
    scheduleRaster = function () {};
    const container = document.getElementById('pagesContainer');
    container.innerHTML = '';
    pages = [];
    const W = 595, H = 842;
    for (let n = 1; n <= 3; n++) {
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
    view = 'ws'; currentDocId = 'panel-fit-check';
    currentUser = currentUser || { uid: 'panel-fit', getIdToken: async () => 't' };
    showView('ws');
    annotations = [];
    renderAllOverlays();
    setDirty = function () {};
    if (!buddyCoversPage()) openBuddy('hints'); else closeBuddy();
  });
  await page.waitForTimeout(200);
}

const box = (page, sel) => page.evaluate(sel => {
  const e = document.querySelector(sel);
  if (!e) return null;
  const r = e.getBoundingClientRect();
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, w: r.width, h: r.height,
           shown: r.width > 0 && r.height > 0 && getComputedStyle(e).display !== 'none' };
}, sel);
const fits = page => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
const layout = page => page.evaluate(() => buddyLayoutName());

/* ---------------- An iPad standing up ---------------- */
for (const [w, h] of [[768, 1024], [820, 1180], [1024, 1366]]) {
  console.log('An iPad standing up, ' + w + '×' + h);
  const { ctx, page, errors } = await openWorksheet(w, h);
  ok('the panel is docked', (await layout(page)) === 'dock');
  const b = await box(page, '#buddy'), v = await box(page, '#viewerArea');
  ok('the worksheet opens WITH Chung GPT', b && b.shown, JSON.stringify(b));
  ok('…the full width, under the page', b && Math.abs(b.left) < 1 && Math.abs(b.right - w) < 1 && Math.abs(b.top - v.bottom) < 2,
     JSON.stringify({ b, v }));
  ok('…reaching the bottom of the screen and no further', b && Math.abs(b.bottom - h) < 1, JSON.stringify(b));
  ok('…leaving a good part of the page in view', v.h > h * 0.3 && v.w >= w - 1, JSON.stringify(v));
  const tabs = await box(page, '.buddyTabs'), foot = await box(page, '#buddyFoot');
  ok('the tabs and the foot are on screen', tabs.top >= b.top && foot.bottom <= h + 1 && foot.top > tabs.bottom,
     JSON.stringify({ tabs, foot }));
  ok('nothing runs off the right-hand edge', await fits(page));
  ok('the handle shows', (await box(page, '#buddyGrip')).shown);
  const dock = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dock-h')));
  ok('--dock-h is the panel\'s height', Math.abs(dock - b.h) < 2, dock + ' vs ' + b.h);
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'portrait-' + w + '.png') });
  ok('no page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

/* ---------------- The handle ---------------- */
{
  console.log('The handle, on an iPad standing up');
  const { ctx, page } = await openWorksheet(820, 1180);
  const g = await box(page, '#buddyGrip');
  const before = (await box(page, '#buddy')).h;
  await page.mouse.move(g.left + g.w / 2, g.top + g.h / 2);
  await page.mouse.down();
  await page.mouse.move(g.left + g.w / 2, g.top + g.h / 2 - 180, { steps: 6 });
  await page.mouse.up();
  const taller = (await box(page, '#buddy')).h;
  ok('dragging it up makes the panel taller', Math.abs(taller - before - 180) < 4, before + ' → ' + taller);
  const g2 = await box(page, '#buddyGrip');
  await page.mouse.move(g2.left + g2.w / 2, g2.top + g2.h / 2);
  await page.mouse.down();
  await page.mouse.move(g2.left + g2.w / 2, 2, { steps: 6 });
  await page.mouse.up();
  const v = await box(page, '#viewerArea');
  ok('…but never over the whole page', v.h >= 118, 'page left ' + v.h);
  await page.focus('#buddyGrip');
  const k0 = (await box(page, '#buddy')).h;
  await page.keyboard.press('ArrowDown');
  const k1 = (await box(page, '#buddy')).h;
  ok('the down arrow on the handle makes it shorter', k1 < k0 - 20, k0 + ' → ' + k1);
  await page.reload();
  await page.waitForTimeout(500);
  await worksheet(page);
  const again = (await box(page, '#buddy')).h;
  ok('the height is remembered after a reload', Math.abs(again - k1) < 3, k1 + ' → ' + again);
  await page.evaluate(() => closeBuddy());
  await page.waitForTimeout(100);
  const dock = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--dock-h').trim());
  ok('closed, the panel gives the page all of the room', dock === '0px' && (await box(page, '#viewerArea')).bottom > 1170, dock);
  ok('…and "Open control panel" brings it back', (await box(page, '#buddyFab')).shown);
  await ctx.close();
}

/* ---------------- The floating boxes stand on the docked panel ---------------- */
{
  console.log('The floating boxes, on an iPad standing up');
  const { ctx, page } = await openWorksheet(820, 1180);
  const r = await page.evaluate(() => {
    const out = {};
    ['liveSubs', 'workStep', 'kwQuiz', 'mthPad', 'voiceBar'].forEach(id => {
      const e = document.getElementById(id);
      if (!e) return;
      e.hidden = false; e.classList.add('on'); e.style.display = id === 'workStep' || id === 'voiceBar' ? 'flex' : 'block';
      if (!e.textContent) e.textContent = 'A floating box';
      out[id] = e.getBoundingClientRect().bottom;
    });
    out.panel = document.getElementById('buddy').getBoundingClientRect().top;
    return out;
  });
  for (const id of ['liveSubs', 'workStep', 'kwQuiz', 'mthPad', 'voiceBar']) {
    if (r[id] == null) continue;
    ok(id + ' stands above the panel', r[id] <= r.panel + 1, r[id] + ' vs panel top ' + r.panel);
  }
  await ctx.close();
}

/* ---------------- Lying down, and a laptop: beside the page ---------------- */
for (const [w, h, name] of [[1180, 820, 'An iPad lying down'], [1366, 1024, 'A big iPad lying down'], [1280, 800, 'A laptop']]) {
  console.log(name + ', ' + w + '×' + h);
  const { ctx, page } = await openWorksheet(w, h);
  ok('the panel is beside the page', (await layout(page)) === 'side');
  const b = await box(page, '#buddy'), v = await box(page, '#viewerArea');
  ok('…400px wide, on the right, the full height', b.shown && Math.abs(b.w - 400) < 1 && Math.abs(b.right - w) < 1 &&
     Math.abs(b.bottom - h) < 1 && Math.abs(v.right - b.left) < 1, JSON.stringify(b));
  ok('…with no handle', !(await box(page, '#buddyGrip')).shown);
  ok('nothing runs off the right-hand edge', await fits(page));
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'side-' + w + '.png') });
  await ctx.close();
}

/* ---------------- A phone ---------------- */
{
  console.log('A phone, 390×844');
  const { ctx, page } = await openWorksheet(390, 844, { isMobile: true });
  ok('the panel is the sheet', (await layout(page)) === 'sheet');
  ok('the worksheet opens without it', !(await box(page, '#buddy')).shown && (await box(page, '#buddyFab')).shown);
  await page.evaluate(() => openBuddy('marking'));
  await page.waitForTimeout(150);
  const b = await box(page, '#buddy');
  ok('opened, it rises from the bottom and leaves the top of the screen', b.shown && Math.abs(b.bottom - 844) < 1 && b.top >= 40,
     JSON.stringify(b));
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'phone.png') });
  await ctx.close();
}

/* ---------------- The on-screen keyboard ---------------- */
for (const [w, h, kb, name] of [[820, 1180, 420, 'docked'], [390, 844, 330, 'a phone\'s sheet'], [1180, 820, 380, 'beside the page']]) {
  console.log('The on-screen keyboard over ' + name + ', ' + w + '×' + h);
  const { ctx, page } = await openWorksheet(w, h, w < 600 ? { isMobile: true } : {});
  await page.evaluate(() => openBuddy('chat'));
  await page.waitForTimeout(150);
  // iPad Safari leaves innerHeight alone and shrinks the VISUAL viewport.
  await page.evaluate(kb => {
    const fake = new EventTarget();
    Object.assign(fake, { height: innerHeight - kb, width: innerWidth, scale: 1, offsetTop: 0, offsetLeft: 0 });
    Object.defineProperty(window, 'visualViewport', { value: fake, configurable: true });
    appFitSync();
  }, kb);
  await page.waitForTimeout(150);
  const seen = h - kb;
  const tabs = await box(page, '.buddyTabs'), foot = await box(page, '#buddyFoot'), head = await box(page, '.buddyHead');
  ok('the panel\'s ✕ and tabs are on screen', head.top >= 0 && tabs.bottom <= seen, JSON.stringify({ head, tabs }));
  ok('the Ask box sits just above the keyboard', foot.bottom <= seen + 1 && foot.bottom >= seen - 2, foot.bottom + ' vs ' + seen);
  // The keyboard goes away again: everything goes back.
  await page.evaluate(() => { window.visualViewport.height = innerHeight; appFitSync(); });
  await page.waitForTimeout(120);
  const back = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--app-h').trim());
  ok('when the keyboard goes, the app takes the whole screen again', back === '' && Math.abs((await box(page, '#buddyFoot')).bottom - h) < 2,
     JSON.stringify(back));
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'keyboard-' + w + '.png') });
  await ctx.close();
}

/* ---------------- A pinch-zoomed page is left alone ---------------- */
{
  console.log('A page the browser has zoomed into');
  const { ctx, page } = await openWorksheet(820, 1180);
  const r = await page.evaluate(() => {
    const fake = new EventTarget();
    Object.assign(fake, { height: innerHeight / 2, width: innerWidth / 2, scale: 2, offsetTop: 0, offsetLeft: 0 });
    Object.defineProperty(window, 'visualViewport', { value: fake, configurable: true });
    appFitSync();
    return getComputedStyle(document.documentElement).getPropertyValue('--app-h').trim();
  });
  ok('a zoom is not mistaken for a keyboard', r === '', r);
  await ctx.close();
}

/* ---------------- The header on an iPad standing up ---------------- */
for (const w of [768, 820]) {
  console.log('A student\'s header, ' + w + ' wide');
  const ctx = await browser.newContext({ viewport: { width: w, height: 1100 } });
  const page = await ctx.newPage();
  await page.goto(FILE);
  await page.waitForTimeout(500);
  const r = await page.evaluate(() => {
    const show = id => { const e = document.getElementById(id); if (!e) return; e.hidden = false; e.classList.remove('hidden'); e.removeAttribute('data-pwa-hidden'); };
    ['adventureNav', 'mistakesBtn', 'consultLogBtn', 'installAppBtn', 'signOutBtn'].forEach(show);
    document.getElementById('signInBtn').classList.add('hidden');
    document.getElementById('whoAmI').textContent = 'Chloe Tan · P5 ▾';
    const hd = document.querySelector('header');
    return { h: hd.offsetHeight, apps: document.getElementById('appsBtn').offsetHeight, over: hd.scrollWidth > hd.clientWidth,
             last: document.getElementById('signOutBtn').getBoundingClientRect().right };
  });
  ok('one row, 🧭 Apps on one line, Sign out on screen', r.h < 70 && r.apps < 48 && !r.over && r.last <= w, JSON.stringify(r));
  await ctx.close();
}

await browser.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
