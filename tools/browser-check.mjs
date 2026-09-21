/* =====================================================================
   THE PAGE ACTUALLY RUNS — and the 🅣 box actually takes words
   ---------------------------------------------------------------------
   Every other harness in this repo reads the source and asks what it SAYS.
   Three times now that has not been enough, because the fault was a name
   the source says and that does not RESOLVE:

     • v1.43.0  `syncTextEditValue` — the save threw on its first line and
                wrote nothing for forty-eight versions.
     • v1.46.0  `renderStylusBtn` — called at the top level of the classic
                script, so everything below it never ran: the one-letter
                tool shortcuts, Ctrl+Z, Ctrl+S, Escape, the `beforeunload`
                save, and the eight opening render calls. And ✍️ itself,
                which ships `hidden`, was never unhidden on any device.
     • v1.46.0  `bindTextEditNode` — called from `annNode`, so the FIRST
                tap of the text tool threw inside `renderOverlay` and the
                box never appeared at all.

   None of those threw anywhere a student could see, and the app went on
   looking perfectly right. A browser is the only thing that can tell a
   name that is there from a name that merely reads as though it is.

   Like `tools/text-caret-check.mjs` this needs a real Chromium, so it is a
   tool you reach for rather than a gate:

     node tools/browser-check.mjs
     PW=/path/to/playwright/index.mjs node tools/browser-check.mjs
   ===================================================================== */
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const PW = process.env.PW || '/opt/node22/lib/node_modules/playwright/index.mjs';
let chromium;
try {
  ({ chromium } = await import(PW));
} catch (e) {
  console.log('browser-check: no Playwright at ' + PW + ' — skipped.');
  console.log('  set PW=/path/to/playwright/index.mjs to run it.');
  process.exit(0);
}

const FILE = pathToFileURL(path.resolve(process.argv[2] || 'index.html')).href;
let pass = 0, fail = 0;
const ok = (name, cond, note) => {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (note ? '\n      ' + note : '')); }
};

const browser = await chromium.launch();
// `hasTouch` because ✍️ only unhides on a device that reports a touchscreen,
// and the whole palm/pencil engine turns on `pointerType`.
const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 }, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(FILE);
await page.waitForTimeout(900);

console.log('\nThe classic script runs to the end');
/* A name that does not resolve at the top level kills every line below it,
   and the app still paints because the auth callback re-runs the renders. */
ok('no uncaught error while the page loads', errors.length === 0,
   errors.join('\n      '));

const tail = await page.evaluate(() => {
  const t = n => { try { return typeof eval(n); } catch (e) { return 'unreachable'; } };
  return {
    version: t('APP_VERSION') === 'string' ? APP_VERSION : 'unreachable',
    bind: t('bindTextEditNode'),
    stylus: t('renderStylusBtn'),
    navBound: !!(document.getElementById('viewerArea') || {})._navBound
  };
});
ok('every name the page calls at load resolves',
   tail.bind === 'function' && tail.stylus === 'function',
   'bindTextEditNode=' + tail.bind + ' renderStylusBtn=' + tail.stylus);
ok('…and the touch navigation engine is bound exactly once', tail.navBound === true,
   'navBind() marks #viewerArea with _navBound');
console.log('    ' + tail.version);

console.log('\n✍️ The pencil-only switch is reachable');
/* Two things go wrong here and NEITHER shows on a screenshot.
   `document.getElementById` hands back the FIRST match, so a duplicate
   `id="stylusBtn"` is dead markup the eye cannot find — but `$('stylusBtn')`
   resolves to the same element for BOTH wirings, so a toggle bound twice
   runs twice and lands exactly where it started: a ✍️ that toasts at you
   and changes nothing. That is what v1.46.0 found and it is why this asks
   the DOM how many there are and then presses the thing. */
const stylus = await page.evaluate(() => {
  const all = document.querySelectorAll('#stylusBtn');
  const b = all[0];
  return {
    count: all.length,
    hidden: b ? b.hidden : null,
    pressed: b ? b.getAttribute('aria-pressed') : null,
    on: stylusOnly
  };
});
ok('there is exactly ONE ✍️ button', stylus.count === 1,
   'found ' + stylus.count + ' elements with id="stylusBtn"');
ok('the ✍️ button is shown on a touch device', stylus.hidden === false,
   '#stylusBtn is HIDDEN by renderStylusBtn on a machine with no touchscreen, ' +
   'never shipped hidden — pencil-only mode is on by default, so a painter ' +
   'that failed would leave a touchscreen nobody can draw on with a finger');
ok('…and says whether pencil-only mode is on',
   stylus.pressed === String(stylus.on), 'aria-pressed=' + stylus.pressed);

const toggled = await page.evaluate(() => {
  const was = stylusOnly;
  document.getElementById('stylusBtn').click();
  const now = stylusOnly;
  const shown = document.getElementById('stylusBtn').getAttribute('aria-pressed');
  document.getElementById('stylusBtn').click();   // put it back
  return { was: was, now: now, shown: shown, back: stylusOnly };
});
ok('…and pressing it really flips the mode', toggled.now === !toggled.was,
   'two click handlers on one button toggle it twice: ' +
   toggled.was + ' → ' + toggled.now);
ok('…and the button repaints with it', toggled.shown === String(toggled.now));
ok('…and pressing it again puts it back', toggled.back === toggled.was);

console.log('\n🅣 A finger tap makes a box that takes words');
/* One page of the worksheet, built the way `loadPdf` builds one — the real
   overlay and the real handlers, with no PDF behind it. */
await page.evaluate(() => {
  scheduleRaster = function () {};     // no PDF, so nothing to rasterise
  const container = document.getElementById('pagesContainer');
  container.innerHTML = '';
  pages = [];
  const W = 600, H = 800;
  const wrap = document.createElement('div');
  wrap.className = 'pageWrap';
  wrap.style.width = W + 'px';
  wrap.style.height = H + 'px';
  const canvas = document.createElement('canvas');
  const svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'none' });
  svg.classList.add('overlay');
  wrap.appendChild(canvas);
  wrap.appendChild(svg);
  container.appendChild(wrap);
  const p = { num: 1, baseW: W, baseH: H, wrap: wrap, canvas: canvas, svg: svg, renderTask: null };
  pages.push(p);
  attachOverlayHandlers(p);
  scale = 1; view = 'ws'; currentDocId = 'browser-check';
  showView('ws');
  setTool('text');
});

/* A TOUCH pointer, which is what an iPad sends — and what pencil-only mode
   hands to the pan engine for every tool that leaves a mark by dragging. 🅣
   is not one of those, so it has to reach the overlay. */
await page.evaluate(() => {
  const svg = pages[0].svg;
  const r = svg.getBoundingClientRect();
  const opts = {
    bubbles: true, cancelable: true, clientX: r.x + 120, clientY: r.y + 160,
    pointerId: 7, pointerType: 'touch', isPrimary: true, button: 0, buttons: 1
  };
  svg.dispatchEvent(new PointerEvent('pointerdown', opts));
  svg.dispatchEvent(new PointerEvent('pointerup', opts));
});
await page.waitForTimeout(150);

const tapped = await page.evaluate(() => {
  const div = document.querySelector('.annText');
  return {
    made: annotations.length === 1 && annotations[0].type === 'text',
    node: !!div,
    editable: div ? div.contentEditable : '',
    focused: document.activeElement === div,
    stylusOn: stylusOnly
  };
});
ok('the tap really was a finger in pencil-only mode', tapped.stylusOn === true);
ok('a text box appears on the page', tapped.made && tapped.node,
   'v1.45.0 made the annotation and never drew the node — bindTextEditNode threw first');
ok('…it is editable and has the caret', tapped.editable === 'true' && tapped.focused);

/* Everything below needs the box the tap was supposed to make. On a build
   where it never appeared these steps would THROW out of the harness, which
   reads as a broken check rather than as a broken app — so they report
   instead, and every one of them goes red. */
const bornH = await page.evaluate(() => annotations[0] && annotations[0].h);
/* Three lines, so the box has to GROW rather than merely have been born tall
   enough. A one-line answer fits the box the tap makes, so asserting a number
   against it is a tick that passes on a build where nothing was typed at all
   — which is exactly the sort of green this harness exists to stop. */
if (tapped.node) await page.keyboard.type('24 grams\nof ice\nmelted');
await page.waitForTimeout(150);
const typed = await page.evaluate(() => ({
  shown: (document.querySelector('.annText') || {}).innerText,
  height: annotations[0] && annotations[0].h
}));
ok('the words go in', typed.shown === '24 grams\nof ice\nmelted',
   'saw: ' + JSON.stringify(typed.shown));
ok('…and the box grows to hold them', typed.height > bornH,
   'h went ' + bornH + ' → ' + typed.height + ' over three lines');

console.log('\nThe box commits when the child moves on — and not before');
await page.evaluate(() => {
  const div = document.querySelector('.annText');
  if (div) div.blur();
});
await page.waitForTimeout(150);
const after = await page.evaluate(() => ({
  editing: !!editingId,
  text: annotations[0] ? annotations[0].text : null,
  dirty: dirty
}));
ok('a blur commits what was typed',
   after.editing === false && after.text === '24 grams\nof ice\nmelted' && after.dirty === true,
   'editingId set? ' + after.editing + '  text=' + JSON.stringify(after.text));

const mid = await page.evaluate(() => {
  try {
    setTool('text');
    const p = pages[0];
    startTextBox(p, { x: 90, y: 300 });
    const div = document.querySelector('g[data-id="' + editingId + '"] .annText');
    if (!div) return { stillEditing: false, why: 'no box was drawn' };
    div.textContent = 'half a word';
    renderOverlay(p);          // the wipe that lifts the live node out and back
    return { stillEditing: !!editingId, why: '' };
  } catch (e) {
    return { stillEditing: false, why: e.message };
  }
});
ok('…but the rebuild\'s own blur does not close a box mid-word', mid.stillEditing === true,
   mid.why || 'overlayRebuilding exists for this one test and nothing else');


/* =====================================================================
   📎 A PASTED PICTURE, AND NO WINDOW ROUND IT
   ---------------------------------------------------------------------
   Reading the source can say the frame is gone. Only a browser can say the
   picture is really on the page, really picks up, really resizes by a corner
   and really refuses to move once it is locked — and that the page shows
   NOTHING round it while nobody is holding it, which is the whole request.
   ===================================================================== */
console.log('\n📎 A pasted picture is the picture and nothing else');

/* Everything below needs a page, a pdfDoc (`pasteGoesToWorksheet` refuses
   without one) and the select tool. A 2 : 1 picture, so a corner drag that
   kept the ratio is visible in the numbers rather than being a guess. */
await page.evaluate(async () => {
  window.__pic = (function () {
    const cv = document.createElement('canvas');
    cv.width = 80; cv.height = 40;
    const cx = cv.getContext('2d');
    cx.fillStyle = '#c00080'; cx.fillRect(0, 0, 80, 40);
    const url = cv.toDataURL('image/png');
    const bin = atob(url.split(',')[1]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new File([bytes], 'pic.png', { type: 'image/png' });
  })();
  try { commitActiveTextEdit(); } catch (e) {}
  annotations = [];
  pdfDoc = {};
  setTool('select');
  renderAllOverlays();
});

/* THE REAL LISTENER, through a real ClipboardEvent — so `pasteGoesToWorksheet`
   and the image sniffing are exercised rather than stepped over. */
const pasted = await page.evaluate(async () => {
  const dt = new DataTransfer();
  dt.items.add(window.__pic);
  document.dispatchEvent(new ClipboardEvent('paste', {
    clipboardData: dt, bubbles: true, cancelable: true
  }));
  // The listener does not await its own work.
  for (let i = 0; i < 60 && !annotations.length; i++) await new Promise(r => setTimeout(r, 25));
  const a = annotations[0];
  return {
    n: annotations.length,
    type: a && a.type,
    ratio: a && a.ratio,
    hasSrc: !!(a && a.src),
    selected: selectedId === (a && a.id),
    tool: tool
  };
});
ok('Ctrl+V really puts a picture on the page', pasted.n === 1 && pasted.type === 'image',
   'saw ' + pasted.n + ' annotation(s), type ' + pasted.type);
ok('…carrying the picture and its own shape',
   pasted.hasSrc && Math.abs((pasted.ratio || 0) - 2) < 0.02, 'ratio=' + pasted.ratio);
ok('…selected, with the tool that moves it in hand',
   pasted.selected && pasted.tool === 'select');

/* NO WINDOW. The old card was a heading bar, a border and a coloured spine;
   what is asked for is the picture. So: one child, an <img>, and nothing
   painted round it. */
const bare = await page.evaluate(() => {
  const g = document.querySelector('g[data-id="' + annotations[0].id + '"]');
  const box = g && g.querySelector('.pastePic');
  const img = box && box.querySelector('img');
  if (!box || !img) return { drawn: false };
  const cs = getComputedStyle(box);
  const ics = getComputedStyle(img);
  return {
    drawn: true,
    children: box.children.length,
    tag: img.tagName,
    bg: cs.backgroundColor,
    border: cs.borderTopWidth + ' ' + cs.borderLeftWidth,
    shadow: cs.boxShadow,
    fit: ics.objectFit,
    draggable: img.draggable,
    chrome: g.querySelectorAll('button, .aiNoteHead, .aiNoteTitle').length
  };
});
ok('the picture is drawn', bare.drawn);
ok('…as ONE <img> and nothing else',
   bare.children === 1 && bare.tag === 'IMG' && bare.chrome === 0,
   JSON.stringify(bare));
ok('…with no background, no border and no shadow round it',
   /rgba\(0, 0, 0, 0\)|transparent/.test(bare.bg || '') &&
   bare.border === '0px 0px' && bare.shadow === 'none',
   JSON.stringify(bare));
ok('…fitted rather than stretched', bare.fit === 'contain', bare.fit);
ok('…and the browser’s own image drag switched off', bare.draggable === false);

/* WHAT IT WEARS WHILE IT IS HELD, and only while it is held. */
const held = await page.evaluate(() => {
  const svg = pages[0].svg;
  const withSel = {
    handles: svg.querySelectorAll('[data-handle]').length,
    tools: svg.querySelectorAll('.picTool').length
  };
  selectedId = null;
  renderAllOverlays();
  const without = {
    handles: svg.querySelectorAll('[data-handle]').length,
    tools: svg.querySelectorAll('.picTool').length
  };
  selectedId = annotations[0].id;
  renderAllOverlays();
  return { withSel, without };
});
ok('a selected picture grows four corner handles and its own two buttons',
   held.withSel.handles === 8 && held.withSel.tools === 2,
   JSON.stringify(held.withSel) + ' (4 visible handles + 4 finger-sized twins)');
ok('…and tapping away leaves NOTHING on the page but the picture',
   held.without.handles === 0 && held.without.tools === 0,
   JSON.stringify(held.without));

/* The row is a transparent strip WIDER than the two buttons in it, and a
   transparent div still swallows taps: without `pointer-events: none` on it a
   band above every selected picture catches the stylus and the page cannot be
   written on there. */
const strip = await page.evaluate(() => {
  const row = pages[0].svg.querySelector('.picTools');
  const btns = row ? row.querySelectorAll('.picTool') : [];
  const btn = btns[btns.length - 1];
  if (!row || !btn) return { got: false };
  const rr = row.getBoundingClientRect(), br = btn.getBoundingClientRect();
  // A point on the row, well past the last button.
  const x = Math.min(rr.right - 2, br.right + 24), y = rr.top + rr.height / 2;
  const hit = document.elementFromPoint(x, y);
  return { got: true, onRow: !!(hit && hit.closest && hit.closest('.picTools')) };
});
ok('the empty part of the button row does not swallow a tap',
   strip.got && strip.onRow === false, JSON.stringify(strip));

/* ---- Moving it ---- */
/* The pointerdown has to land on the REAL element — the picture's own <img>,
   or a corner handle — because the select tool reads `e.target` to decide what
   was tapped, and a down on the bare SVG deselects everything. The move and the
   up go to the svg, which is where the listeners are. */
async function drag(from, to, id) {
  const missing = await page.evaluate(({ from, to, id }) => {
    const svg = pages[0].svg;
    const pic = annotations.find(a => a.type === 'image');
    const target = svg.querySelector(id || ('g[data-id="' + (pic && pic.id) + '"] img'));
    if (!target) return id || 'the picture';
    const o = n => ({ bubbles: true, cancelable: true, clientX: n.x, clientY: n.y,
                      pointerId: 21, pointerType: 'mouse', isPrimary: true, button: 0, buttons: 1 });
    target.dispatchEvent(new PointerEvent('pointerdown', o(from)));
    svg.dispatchEvent(new PointerEvent('pointermove', o(to)));
    svg.dispatchEvent(new PointerEvent('pointerup', Object.assign(o(to), { buttons: 0 })));
    return '';
  }, { from, to, id });
  if (missing) ok('the drag had something to grab (' + missing + ')', false);
  await page.waitForTimeout(80);
}
/* A page unit is a CLIENT pixel only while the svg is drawn at its own viewBox
   size. `geom()` measures the conversion rather than assuming it — the two
   coordinate systems are the trap the text caret's own section documents at
   length, and a harness that mixes them reports a working drag as a failure. */
async function geom() {
  return page.evaluate(() => {
    const p = pages[0], r = p.svg.getBoundingClientRect(), a = annotations[0];
    const kx = r.width / p.baseW, ky = r.height / p.baseH;
    return { x: a.x, y: a.y, w: a.w, h: a.h, kx, ky,
             cx: r.x + (a.x + a.w / 2) * kx, cy: r.y + (a.y + a.h / 2) * ky,
             sx: r.x + (a.x + a.w) * kx, sy: r.y + (a.y + a.h) * ky };
  });
}
const centreOf = await geom();
/* It is NOT 1 here — this page is fitted to the viewer's width, so a page unit
   is about 1.09 client pixels, and every drag below would be that much out if
   it went on assuming otherwise. What has to hold is that the conversion is
   measurable and UNIFORM: a skewed overlay would put every client point below
   somewhere else on the page, in a way nothing else here would catch. */
ok('the page-to-client scale is measurable and the same on both axes',
   centreOf.kx > 0.05 && centreOf.kx < 20 && Math.abs(centreOf.kx - centreOf.ky) < 0.01,
   'kx ' + centreOf.kx.toFixed(3) + ' · ky ' + centreOf.ky.toFixed(3));
await drag({ x: centreOf.cx, y: centreOf.cy }, { x: centreOf.cx + 40, y: centreOf.cy + 25 });
const moved = await page.evaluate(() => ({ x: annotations[0].x, y: annotations[0].y }));
/* The client delta converted back into page units: what has to be true is that
   the picture followed the pointer, in both directions, by the distance the
   pointer really travelled. */
const dx = moved.x - centreOf.x, dy = moved.y - centreOf.y;
ok('dragging the picture moves it',
   Math.abs(dx - 40 / centreOf.kx) < 2 && Math.abs(dy - 25 / centreOf.ky) < 2,
   JSON.stringify({ from: [centreOf.x, centreOf.y], to: moved, by: [dx, dy] }));

/* ---- Resizing it, by a corner, keeping its shape ---- */
const preSize = await geom();
await drag({ x: preSize.sx, y: preSize.sy },
           { x: preSize.sx - 90 * preSize.kx, y: preSize.sy - 45 * preSize.ky },
           '[data-handle="se"]');
const sized = await page.evaluate(() => {
  const a = annotations[0];
  return { w: a.w, h: a.h, x: a.x, y: a.y, ratio: a.ratio };
});
ok('dragging a corner resizes it', sized.w < preSize.w - 40,
   preSize.w + ' → ' + sized.w);
ok('…keeping the picture’s own shape', Math.abs(sized.w / sized.h - 2) < 0.05,
   sized.w + ' x ' + sized.h + ' = ' + (sized.w / sized.h).toFixed(3));
ok('…anchored to the opposite corner, so it does not creep away',
   Math.abs(sized.x - preSize.x) < 0.02 && Math.abs(sized.y - preSize.y) < 0.02,
   JSON.stringify({ was: [preSize.x, preSize.y], now: [sized.x, sized.y] }));

/* And the two SINGLE-AXIS drags, which is the whole reason the scale is a
   projection onto the shape's own diagonal: whichever way the corner is
   pulled, the picture has to answer. A "larger axis wins" rule leaves the
   first of these dead and a "smaller axis wins" rule the second, and a handle
   that does nothing reads as a feature that does not work. */
const inFrom = await geom();
await drag({ x: inFrom.sx, y: inFrom.sy }, { x: inFrom.sx - 60 * inFrom.kx, y: inFrom.sy },
           '[data-handle="se"]');
const pulledIn = await page.evaluate(() => ({ w: annotations[0].w, h: annotations[0].h }));
ok('…and a corner pulled straight IN along the long edge still shrinks it',
   pulledIn.w < inFrom.w - 8 && Math.abs(pulledIn.w / pulledIn.h - 2) < 0.05,
   inFrom.w + ' → ' + pulledIn.w);

const outFrom = await geom();
await drag({ x: outFrom.sx, y: outFrom.sy }, { x: outFrom.sx + 60 * outFrom.kx, y: outFrom.sy },
           '[data-handle="se"]');
const pulledOut = await page.evaluate(() => ({ w: annotations[0].w, h: annotations[0].h }));
ok('…and one pulled straight OUT along it still grows it',
   pulledOut.w > outFrom.w + 8 && Math.abs(pulledOut.w / pulledOut.h - 2) < 0.05,
   outFrom.w + ' → ' + pulledOut.w);

/* ---- 🔒 Locked in position ---- */
const locked = await page.evaluate(() => {
  const btns = Array.from(pages[0].svg.querySelectorAll('.picTool'));
  const lock = btns.find(b => b.textContent === '🔒');
  if (!lock) return { pressed: false };
  lock.click();
  const a = annotations[0];
  return {
    pressed: true, locked: !!a.locked,
    handles: pages[0].svg.querySelectorAll('[data-handle]').length,
    tools: pages[0].svg.querySelectorAll('.picTool').length,
    unlockShown: Array.from(pages[0].svg.querySelectorAll('.picTool')).some(b => b.textContent === '🔓'),
    selected: selectedId === a.id,
    box: { x: a.x, y: a.y, w: a.w, h: a.h }
  };
});
ok('the 🔒 button is there and locks it', locked.pressed && locked.locked === true);
ok('…and a locked picture has no handles to drag', locked.handles === 0, 'saw ' + locked.handles);
ok('…but keeps its row, now offering 🔓', locked.tools === 2 && locked.unlockShown);
ok('…and is still SELECTED, or the 🔓 could never be reached', locked.selected === true);

const lockedDrag = await page.evaluate(async () => {
  const r = pages[0].svg.getBoundingClientRect();
  const a = annotations[0];
  return { cx: r.x + a.x + a.w / 2, cy: r.y + a.y + a.h / 2 };
});
await drag({ x: lockedDrag.cx, y: lockedDrag.cy }, { x: lockedDrag.cx + 60, y: lockedDrag.cy + 60 });
const stillThere = await page.evaluate(() => {
  const a = annotations[0];
  return { x: a.x, y: a.y, w: a.w, h: a.h };
});
ok('a locked picture does not move when it is dragged',
   JSON.stringify(stillThere) === JSON.stringify(locked.box),
   JSON.stringify(locked.box) + ' → ' + JSON.stringify(stillThere));

/* The eraser is the reason locking is worth having: rubbing a stroke off a
   picture must not take the picture with it. */
const erased = await page.evaluate(() => {
  const svg = pages[0].svg;
  const r = svg.getBoundingClientRect();
  const a = annotations[0];
  erasing = { page: pages[0], snap: snapshot(), removed: false, lastX: 0, lastY: 0 };
  const x = r.x + a.x + a.w / 2, y = r.y + a.y + a.h / 2;
  eraseAlong(x, y, x, y);
  erasing = null;
  return { n: annotations.length, removed: !annotations.some(q => q.type === 'image') };
});
ok('…and the eraser steps over it', erased.removed === false, 'annotations left: ' + erased.n);

/* A lock nothing can undo is a picture nobody can take off the page. */
const removed = await page.evaluate(() => {
  const x = Array.from(pages[0].svg.querySelectorAll('.picTool')).find(b => b.textContent === '✕');
  if (!x) return { pressed: false };
  x.click();
  return { pressed: true, left: annotations.filter(a => a.type === 'image').length };
});
ok('a locked picture can still be removed from its own ✕',
   removed.pressed && removed.left === 0, JSON.stringify(removed));

/* THE FLATTENED PAGE is what the marking run reads, what goes into the mistake
   book and what comes out of the printer. A picture missing from it is a page
   the AI marks that the student is not looking at. */
const flat = await page.evaluate(async () => {
  annotations = [];
  await pasteImageOntoPage(window.__pic);
  await annPicsReady();
  const drawn = [];
  const ctx = {
    save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
    strokeRect() {}, ellipse() {}, fillText() {}, measureText: () => ({ width: 10 }),
    setLineDash() {}, drawImage(img, x, y, w, h) { drawn.push([Math.round(w), Math.round(h)]); }
  };
  drawAnnsOnCtx(ctx, 1, 1, annotations, 1);
  const a = annotations[0];
  return { drawn: drawn, box: [Math.round(a.w), Math.round(a.h)] };
});
ok('the picture is in the page the AI reads', flat.drawn.length === 1,
   JSON.stringify(flat));
ok('…fitted to its own box, not stretched to it',
   flat.drawn.length === 1 &&
   Math.abs(flat.drawn[0][0] / flat.drawn[0][1] - 2) < 0.05 &&
   flat.drawn[0][0] <= flat.box[0] + 1 && flat.drawn[0][1] <= flat.box[1] + 1,
   JSON.stringify(flat));

await page.evaluate(() => { annotations = []; selectedId = null; renderAllOverlays(); });

/* One-letter tool shortcuts live BELOW `renderStylusBtn()` in the file, so a
   throw there took the whole keyboard with it. */
console.log('\nThe keyboard is wired up');
await page.evaluate(() => {
  try { commitActiveTextEdit(); } catch (e) {}
  setTool('pen');
  document.body.focus();
});
await page.keyboard.press('v');
await page.waitForTimeout(80);
const shortcut = await page.evaluate(() => tool);
ok('a one-letter tool shortcut reaches the page', shortcut === 'select',
   'tool is "' + shortcut + '" after pressing v');

await browser.close();
console.log('\n' + (fail ? '✗ ' + fail + ' failed, ' + pass + ' passed' : '✓ all ' + pass + ' passed'));
process.exit(fail ? 1 : 0);
