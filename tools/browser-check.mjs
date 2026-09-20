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
