/* =====================================================================
   ✏️ THE MODEL SUITE, IN A REAL BROWSER (v1.88.0)
   ---------------------------------------------------------------------
   Ans Key's model suite (polymathlc/model's bar-model drawing board),
   brought into Study Buddy. tools/model-studio-tests.mjs pins what the
   source says; this drives the real board in Chromium on a worksheet
   built the way `loadPdf` builds one, signed in as a STUDENT:

   • the toolbar button opens the floating window with the whole drawing
     toolbar and no question, scenario or AI marking;
   • Bar, Split, Shade, Label and Brace really draw, and a letter pressed
     while drawing picks the board's tool, never the worksheet's;
   • 📌 puts ONE transparent picture of the model on the page in view, as an
     ordinary `image` annotation carrying the model, in one undo step;
   • ✎ on the picture's own row opens THAT model; a change is written back
     onto it and the picture redraws itself; 📌 updates the same picture;
   • New model lets go of it; Escape closes the window, and only the window;
   • worksheet undo / redo take the picture off and put it back;
   • the marking's page picture (`drawAnnsOnCtx`) carries the model;
   • a video solution playing over the page refuses a pin; leaving the
     worksheet closes the window; a new worksheet lets go of the picture;
   • on a phone the window and every tool stay on screen.

     PW=/path/to/playwright/index.mjs node tools/model-studio-browser-check.mjs
     MS_SCREENSHOTS=dir — also saves the window and the page
   ===================================================================== */
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const PW = process.env.PW || '/opt/node22/lib/node_modules/playwright/index.mjs';
let chromium;
try {
  ({ chromium } = await import(PW.startsWith('file:') ? PW : pathToFileURL(path.resolve(PW)).href));
} catch (e) {
  console.log('model-studio-browser-check: no Playwright at ' + PW + ' — skipped.');
  process.exit(0);
}

const FILE = pathToFileURL(path.resolve(process.argv[2] || 'index.html')).href;
const SHOTS = process.env.MS_SCREENSHOTS || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
const ok = (name, cond, note) => {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (note ? '\n      ' + note : '')); }
};

const browser = await chromium.launch({ ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const shot = async (name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'model-studio-' + name + '.png') }); };
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.route('https://**/*', r => r.abort());
await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
await page.goto(FILE);
await page.waitForTimeout(700);
ok('the model studio is loaded', await page.evaluate(() => !!(window.ModelStudio && typeof msPinToPage === 'function')));

/* ---------------- a two-page worksheet, the way loadPdf builds one ---------------- */
await page.evaluate(() => {
  scheduleRaster = function () {};
  const container = document.getElementById('pagesContainer');
  container.innerHTML = '';
  pages = [];
  const W = 595, H = 842;
  for (let n = 1; n <= 2; n++) {
    const wrap = document.createElement('div');
    wrap.className = 'pageWrap';
    wrap.style.width = W + 'px';
    wrap.style.height = H + 'px';
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const c2 = canvas.getContext('2d');
    c2.fillStyle = '#fff'; c2.fillRect(0, 0, W, H);
    c2.fillStyle = '#111'; c2.font = '16px serif';
    c2.fillText(n + '. Aisha has 3 times as many marbles as Ben. Draw a model.', 30, 60);
    const svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'none' });
    svg.classList.add('overlay');
    wrap.appendChild(canvas);
    wrap.appendChild(svg);
    container.appendChild(wrap);
    const pdfPage = {
      getViewport: ({ scale }) => ({ width: W * scale, height: H * scale, scale }),
      render: ({ canvasContext, viewport }) => ({ promise: Promise.resolve(canvasContext.drawImage(canvas, 0, 0, W * viewport.scale, H * viewport.scale)) }),
      getTextContent: async () => ({ items: [] })
    };
    const p = { num: n, baseW: W, baseH: H, wrap, canvas, svg, renderTask: null, page: pdfPage,
      viewport1: { width: W, height: H, scale: 1, convertToViewportPoint: (x, y) => [x, H - y] } };
    pages.push(p);
    attachOverlayHandlers(p);
  }
  scale = 1; currentDocId = 'model-studio-check'; docName = 'Fractions practice';
  currentUser = { uid: 'student-1', email: 'kid@example.com', displayName: 'Kid', getIdToken: async () => 't' };
  wsMeta.subject = 'math'; wsMeta.level = 'P5';
  showView('ws');
  annotations = []; undoStack = []; redoStack = [];
  renderAllOverlays();
  window.__dirty = 0;
  scheduleAutoSave = function () { window.__dirty++; };
  setTool('pen');
});
await page.waitForTimeout(200);

/* ---------------- opening it ---------------- */
ok('the Model suite button is on the toolbar', await page.locator('#barModelBtn').isVisible());
await page.click('#barModelBtn');
await page.waitForTimeout(150);
ok('the button opens the drawing window', await page.locator('#msModal.open #msCard').isVisible());
const inside = await page.evaluate(() => {
  const card = $('msCard');
  return {
    tools: Array.from(card.querySelectorAll('.tool-btn[data-tool]')).map(b => b.getAttribute('data-tool')),
    text: card.textContent,
    areas: card.querySelectorAll('textarea').length,
    expanded: $('barModelBtn').getAttribute('aria-expanded'),
    pinOff: $('msPinBtn').disabled
  };
});
ok('it carries the whole drawing toolbar',
  ['select', 'bar', 'split', 'razor', 'shade', 'label', 'brace', 'arrow', 'divider', 'dotted', 'align', 'pen', 'eraser']
    .every(t => inside.tools.includes(t)), inside.tools.join(','));
ok('…and no question, scenario or AI marking', !/scenario|AI Check|Model Answer|New Scenario/i.test(inside.text) && inside.areas === 0);
ok('the toolbar button says it is open', inside.expanded === 'true');
ok('a student may put a model on their own page', inside.pinOff === false);

/* The page under the window is still live: the float takes no pointer
   outside its card. */
const through = await page.evaluate(() => {
  const r = pages[0].wrap.getBoundingClientRect(), c = $('msCard').getBoundingClientRect();
  // a point on page 1 that is outside the card, if there is one
  const x = r.left + 20, y = Math.min(r.bottom - 10, window.innerHeight - 10);
  const inCard = x >= c.left && x <= c.right && y >= c.top && y <= c.bottom;
  const hit = document.elementFromPoint(x, y);
  return { inCard, onPage: !!(hit && hit.closest && hit.closest('.pageWrap')) };
});
ok('the worksheet stays live round the window', through.inCard || through.onPage, JSON.stringify(through));

async function at(x, y) {
  return page.evaluate(([x, y]) => {
    const r = document.getElementById('msCanvas').getBoundingClientRect();
    return { x: r.left + x * r.width / 900, y: r.top + y * r.height / 460 };
  }, [x, y]);
}
async function drag(x1, y1, x2, y2) {
  const a = await at(x1, y1), b = await at(x2, y2);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(a.x + (b.x - a.x) * i / 8, a.y + (b.y - a.y) * i / 8);
  await page.mouse.up();
  await page.waitForTimeout(60);
}
async function click(x, y) {
  const a = await at(x, y);
  await page.mouse.click(a.x, a.y);
  await page.waitForTimeout(80);
}
const els = () => page.evaluate(() => ModelStudio.elements());

/* ---------------- drawing ---------------- */
await drag(120, 120, 600, 168);
let list = await els();
ok('dragging with Bar draws a bar', list.some(e => e.type === 'bar' && e.w > 300 && e.h > 20), JSON.stringify(list));

await page.click('#msCard .tool-btn[data-tool="split"]');
await click(300, 140);
const splitInput = page.locator('#msCard .split-popover input');
ok('Split asks how many units', await splitInput.isVisible());
await splitInput.fill('3');
await splitInput.press('Enter');
await page.waitForTimeout(80);
list = await els();
ok('…and splits the bar into 3 equal units', list.find(e => e.type === 'bar').units === 3, JSON.stringify(list));

await page.click('#msCard .tool-btn[data-tool="shade"]');
await click(150, 140);
list = await els();
ok('Shade shades the unit that was clicked', (list.find(e => e.type === 'bar').shaded || []).length === 1, JSON.stringify(list));

await page.click('#msCard .tool-btn[data-tool="label"]');
await click(60, 150);
const labelInput = page.locator('#msCard .floating-input');
ok('Label opens a box to type in', await labelInput.isVisible());
await labelInput.fill('Aisha');
await labelInput.press('Enter');
await page.waitForTimeout(80);
await page.click('#msCard .tool-btn[data-tool="brace"]');
await drag(120, 110, 600, 100);
const braceInput = page.locator('#msCard .floating-input');
if (await braceInput.isVisible()) { await braceInput.fill('?'); await braceInput.press('Enter'); }
await page.waitForTimeout(80);
list = await els();
ok('a label and a brace are on the board', list.some(e => e.type === 'label' && e.text === 'Aisha') && list.some(e => e.type === 'brace'), JSON.stringify(list.map(e => e.type)));

/* Keys pressed in the window are the board's, never the worksheet's. */
const toolBefore = await page.evaluate(() => tool);
await page.focus('#msCard');
await page.keyboard.press('e');
await page.keyboard.press('t');
await page.keyboard.press('v');
const keyed = await page.evaluate(() => ({ worksheet: tool, board: document.querySelector('#msCard .tool-btn.active').getAttribute('data-tool') }));
ok('a letter pressed while drawing picks the board\'s tool, not the worksheet\'s', keyed.worksheet === toolBefore && keyed.board === 'select', JSON.stringify(keyed));
await page.waitForTimeout(700);
ok('the scratch board is remembered on the device', await page.evaluate(() => {
  const v = JSON.parse(localStorage.getItem('polymath.msBoard') || 'null');
  return !!(v && v.el && v.el.some(e => e.type === 'bar'));
}));
await shot('drawn');

/* ---------------- 📌 put on page ---------------- */
const undoBefore = await page.evaluate(() => undoStack.length);
await page.click('#msPinBtn');
await page.waitForTimeout(400);
const pinned = await page.evaluate(() => {
  const a = annotations.find(x => x.ms);
  return a && { id: a.id, type: a.type, page: a.page, n: a.ms.el.length, png: /^data:image\/png;base64,/.test(a.src), ratio: a.ratio, w: a.w, h: a.h,
    x: a.x, y: a.y, img: !!pages[a.page - 1].svg.querySelector('[data-id="' + a.id + '"] img'),
    alt: (pages[a.page - 1].svg.querySelector('[data-id="' + a.id + '"] img') || {}).alt,
    undo: undoStack.length, count: annotations.length, label: $('msPinBtn').textContent, tool, dirty: window.__dirty };
});
ok('📌 puts one picture on the page', pinned && pinned.count === 1 && pinned.type === 'image', JSON.stringify(pinned));
ok('…a PNG of the model, carrying the model itself', pinned && pinned.png && pinned.n === list.length, JSON.stringify(pinned));
ok('…sized to the model\'s own shape, on the page', pinned && Math.abs(pinned.w / pinned.h - pinned.ratio) < 0.05 && pinned.x >= 0 && pinned.x + pinned.w <= 595 && pinned.y + pinned.h <= 842, JSON.stringify(pinned));
ok('…drawn on the page as a picture called a bar model', pinned && pinned.img && pinned.alt === 'Bar model', JSON.stringify(pinned));
ok('…as one undo step, and the worksheet saves', pinned && pinned.undo === undoBefore + 1 && pinned.dirty > 0);
ok('…with the select tool in hand to move it', pinned && pinned.tool === 'select');
ok('…and the button now updates that picture', pinned && /Update on page/.test(pinned.label), pinned && pinned.label);

const transparent = await page.evaluate(() => new Promise(res => {
  const a = annotations.find(x => x.ms);
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    res({ corner: g.getImageData(1, 1, 1, 1).data[3], w: img.width, h: img.height });
  };
  img.onerror = () => res(null);
  img.src = a.src;
}));
ok('the picture is transparent round the model and drawn sharp', transparent && transparent.corner === 0 && transparent.w >= 800, JSON.stringify(transparent));

/* The page picture the marking reads carries the model. */
const marked = await page.evaluate(async () => {
  await annPicsReady();
  const a = annotations.find(x => x.ms);
  const W = 595, H = 842;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  drawAnnsOnCtx(g, 1, 1, annotations, a.page);
  const d = g.getImageData(Math.round(a.x), Math.round(a.y), Math.round(a.w), Math.round(a.h)).data;
  let inked = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i] < 245 || d[i + 1] < 245 || d[i + 2] < 245) inked++;
  return inked;
});
ok('the marking\'s picture of the page carries the model (it is the student\'s own work)', marked > 200, String(marked));

await page.click('#msCloseBtn');
await page.waitForTimeout(250);
ok('closing lets go of the picture', await page.evaluate(() => !msOpen() && msAttachedId === null && $('barModelBtn').getAttribute('aria-expanded') === 'false'));

/* ---------------- ✎ Edit model ---------------- */
await page.evaluate(() => { const a = annotations.find(x => x.ms); selectedId = a.id; renderAllOverlays(); });
await page.waitForTimeout(100);
const editBtn = page.locator('.picTools .picTool', { hasText: '✎' });
ok('the selected picture offers ✎ Edit model', await editBtn.count() === 1);
ok('…and an ordinary pasted picture does not', await page.evaluate(() => {
  annotations.push({ id: 'plain', page: 2, type: 'image', x: 40, y: 400, w: 100, h: 80, ratio: 1.25,
    src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', ts: 1 });
  selectedId = 'plain'; renderAllOverlays();
  const n = Array.from(document.querySelectorAll('.picTools .picTool')).filter(b => b.textContent === '✎').length;
  annotations = annotations.filter(x => x.id !== 'plain');
  selectedId = annotations.find(x => x.ms).id; renderAllOverlays();
  return n === 0;
}));
await shot('on-page');
const srcBefore = await page.evaluate(() => annotations.find(x => x.ms).src);
await page.locator('.picTools .picTool', { hasText: '✎' }).click();
await page.waitForTimeout(200);
list = await els();
ok('✎ opens THAT model, every bar still a bar', await page.evaluate(() => msOpen()) && list.some(e => e.type === 'bar' && e.units === 3), JSON.stringify(list.map(e => e.type)));
await page.click('#msCard .tool-btn[data-tool="bar"]');
await drag(120, 240, 440, 288);
await page.waitForTimeout(1800);    // written back after 0.5 s, the picture follows after 0.9 s more
const live = await page.evaluate(() => {
  const a = annotations.find(x => x.ms);
  return { bars: a.ms.el.filter(e => e.type === 'bar').length, src: a.src };
});
ok('a change is written back onto the picture\'s model as it is drawn', live.bars === 2, String(live.bars));
ok('…and the picture on the page follows it without a 📌', live.src !== srcBefore);
const undoMid = await page.evaluate(() => undoStack.length);
await page.click('#msPinBtn');
await page.waitForTimeout(400);
const updated = await page.evaluate(() => ({ count: annotations.length, pics: annotations.filter(x => x.ms).length,
  bars: annotations.find(x => x.ms).ms.el.filter(e => e.type === 'bar').length, ratio: annotations.find(x => x.ms).ratio, undo: undoStack.length }));
ok('📌 updates the same picture rather than stacking a second', updated.count === 1 && updated.pics === 1 && updated.bars === 2, JSON.stringify(updated));
ok('…with a picture of the taller model, in one undo step', updated.ratio < pinned.ratio && updated.undo === undoMid + 1, JSON.stringify(updated));

await page.click('#msNewBtn');
await page.waitForTimeout(150);
ok('New model empties the board and lets go of the picture',
  await page.evaluate(() => ModelStudio.isEmpty() && msAttachedId === null && annotations.filter(x => x.ms).length === 1 && /Put on page/.test($('msPinBtn').textContent)));
await page.focus('#msCard');
await page.keyboard.press('Control+z');
ok('…and Ctrl+Z on the board brings the drawing back', await page.evaluate(() => !ModelStudio.isEmpty()));
ok('…without touching the worksheet\'s own undo', await page.evaluate(() => annotations.filter(x => x.ms).length === 1));

await page.focus('#msCard');
await page.keyboard.press('Escape');
await page.waitForTimeout(150);
ok('Escape closes the window', await page.evaluate(() => !msOpen()));
ok('…and only the window (the worksheet is still open)', await page.evaluate(() => view === 'ws'));

/* ---------------- undo on the worksheet ---------------- */
const before = await page.evaluate(() => annotations.find(x => x.ms).ms.el.length);
await page.evaluate(() => { undo(); undo(); });
ok('worksheet undo takes the picture back off the page', await page.evaluate(() => annotations.filter(x => x.ms).length === 0));
await page.evaluate(() => { redo(); redo(); });
ok('…and redo puts it back with its model', await page.evaluate(n => annotations.filter(x => x.ms).length === 1 && annotations.find(x => x.ms).ms.el.length === n, before));

/* ---------------- a video solution playing over the page ---------------- */
await page.evaluate(() => { lessonPlayback = { fake: true }; openModelStudio(); });
await page.waitForTimeout(100);
const gate = await page.evaluate(async () => {
  const n = annotations.length, disabled = $('msPinBtn').disabled;
  await msPinToPage();
  return { disabled, same: annotations.length === n, note: $('msPinNote').textContent };
});
ok('a video solution playing over the page refuses a pin', gate.disabled && gate.same && /video solution/.test(gate.note), JSON.stringify(gate));
await page.evaluate(() => { lessonPlayback = null; closeModelStudio(); });

/* ---------------- leaving and changing the worksheet ---------------- */
await page.evaluate(() => { msEditAttached(annotations.find(x => x.ms).id); });
await page.waitForTimeout(100);
await page.evaluate(() => { msWorksheetClosing(); });
ok('a new worksheet lets go of the picture and keeps the window on this device\'s board',
  await page.evaluate(() => msOpen() && msAttachedId === null && /Put on page/.test($('msPinBtn').textContent)));
await page.evaluate(() => showView('home'));
await page.waitForTimeout(100);
ok('leaving the worksheet closes the window', await page.evaluate(() => !msOpen()));
await page.evaluate(() => showView('ws'));

/* ---------------- a phone ---------------- */
await page.setViewportSize({ width: 390, height: 844 });
await page.evaluate(() => { msWin = null; try { localStorage.removeItem('polymath.tutorMsWin'); } catch (e) {} openModelStudio(); });
await page.waitForTimeout(200);
const narrow = await page.evaluate(() => {
  const card = $('msCard').getBoundingClientRect();
  const btns = Array.from(document.querySelectorAll('#msCard .tool-btn'));
  const pin = $('msPinBtn').getBoundingClientRect();
  return { left: card.left, right: card.right, bottom: card.bottom, vw: window.innerWidth, vh: window.innerHeight,
    fits: card.left >= 0 && card.right <= window.innerWidth + 1 && card.bottom <= window.innerHeight + 1,
    reach: btns.every(b => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0; }),
    pin: pin.bottom <= window.innerHeight && pin.right <= window.innerWidth };
});
ok('on a phone the window, every tool and 📌 stay on screen', narrow.fits && narrow.reach && narrow.pin, JSON.stringify(narrow));
await shot('phone');
await page.evaluate(() => closeModelStudio());

ok('no uncaught error along the way', errors.length === 0, errors.join('\n      '));
await browser.close();
console.log('\nmodel-studio-browser-check: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
