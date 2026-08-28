/* =====================================================================
   ✒️  IS THE CARET DEAD ON THE I-BEAM?
   ---------------------------------------------------------------------
   The one thing about a text box that cannot be checked by reading the
   source: where the caret actually LANDS. Every number that decides it —
   the padding, the line height, the border, the font's own metrics, the
   zoom the page happens to be at — is resolved by the browser, so the only
   honest answer comes from asking a browser.

   So this loads the REAL `.annText` rule and the REAL placement functions
   out of index.html, builds the same foreignObject-inside-a-scaled-SVG the
   app builds, "clicks" at a known point, and then measures the caret's own
   rectangle with a Range. It passes only when the caret's middle is within
   TOL of the point that was clicked, at every zoom, every font size and
   every corner of the page.

   WHY A RANGE AND NOT THE DIV'S BOX: the div's box is what the placement
   code itself measured, so checking against it would be marking its own
   homework — it would agree even if the padding were read off the wrong
   edge. `Range.getClientRects()` is where the browser will really put the
   blinking bar, which is the thing the student sees.

   It needs playwright-core and the Chromium already on the machine, so —
   like scan's mobile-check — it is a tool you reach for rather than a gate.
       npm i playwright-core && node tools/text-caret-check.mjs
   ===================================================================== */
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

/* ---- The real thing, cut out of the app ---- */
function between(a, b, what) {
  const i = html.indexOf(a);
  if (i === -1) throw new Error('could not find the start of ' + what);
  const j = html.indexOf(b, i + a.length);
  if (j === -1) throw new Error('could not find the end of ' + what);
  return html.slice(i, j);
}
const CSS_TEXT = between('  .annText {', '  .handFont {', 'the .annText rule');
const CONSTS = between('var ANN_TEXT_PAD_X', '/* Unrotated frame', 'the text metrics');
// From the caret probe down: `textCaretRect` is what actually answers
// "where is the caret", so a cut that started at `textCaretDelta`
// would leave it out and the page would throw.
const PLACE = between('var ANN_CARET_PROBE', 'function attachOverlayHandlers', 'the placement maths');
const DRAW  = between('function drawAnnsOnCtx(ctx, kx, ky, anns, pageNum)', '\n/* ==', 'the flatten');
const FONTVAR = between('    --font:', ';', 'the font stack').replace('    --font:', '').trim();

/* A page is 595 x 842 (A4 at 72dpi), which is what pdf.js hands back. */
const BASE_W = 595, BASE_H = 842;
const TOL = 0.5;          // half a CSS pixel — below what any screen can show

/* 1.3333 is in here on purpose: a fractional zoom gives the wrap a
   non-integer CSS width, so the layout lands on sub-pixel boundaries the
   round numbers never reach. */
const ZOOMS = [0.5, 0.75, 1, 1.2, 1.3333, 1.6, 2.5, 4];
const SIZES = [9, 12, 16, 22, 34, 48];
/* Corners and edges as well as the middle: the width floor and any clamp
   show up there and nowhere else. */
const POINTS = [
  { x: 300, y: 400, at: 'the middle of the page' },
  { x: 2, y: 3, at: 'the top-left corner' },
  { x: BASE_W - 4, y: 40, at: 'hard against the right edge' },
  { x: 40, y: BASE_H - 3, at: 'the bottom edge' },
  { x: 594, y: 841, at: 'the very last pixel' },
  { x: 123.45, y: 456.78, at: 'a fractional point' },
  /* A big font at the bottom edge is the worst case for both halves at once:
     the half-line lift is largest, and there is least room below it. */
  { x: 300, y: BASE_H - 2, at: 'the very bottom, where a big box has no room' }
];

/* ---- THE MUTANTS ----
   A check that cannot fail is not a check, and the only way to know which
   kind you have is to try. `--selftest` breaks the placement in the exact
   way each one names and REQUIRES the measurement to go red. Add a rule to
   the placement, add its mutant here.

   `sub` THROWS when it matches nothing, and that is the load-bearing part.
   A mutant is a string replacement against code that is being edited, so a
   rename turns it into a no-op — and a no-op mutant reports "not caught",
   which reads as a hole in the measurement rather than as a stale test. It
   has already happened once here: two of these went on naming `caretX` and
   `caretY` after the placement stopped having either.

   The third one is the reason this file exists at all: mixing screen pixels
   with the SVG's user units is right at 100% zoom and wrong at every other
   one, so it is invisible on the machine it was written on and wrong on
   every iPad in the centre. */
function sub(src, from, to) {
  if (!src.includes(from)) {
    throw new Error('a mutant matched nothing — it is stale, not passing:\n  ' + from);
  }
  return src.split(from).join(to);
}

const NO_ESTIMATE = p =>
  sub(sub(p, 'var x = pt.x - ANN_TEXT_PAD_X;', 'var x = pt.x;'),
      'var y = pt.y - ANN_TEXT_PAD_Y - fontSize * ANN_TEXT_LINE / 2;', 'var y = pt.y;');

const DELTA_RETURN = 'return { dx: (wantX - caret.x) / kx, dy: (wantY - caret.mid) / ky };';

const MUTANTS = [
  { name: "the box's top-left is dropped on the pointer, as it used to be",
    place: p => NO_ESTIMATE(sub(p, DELTA_RETURN, 'return null;')) },
  { name: 'the estimate forgets to lift the box by half a line',
    place: p => sub(sub(p, DELTA_RETURN, 'return null;'),
                    'var y = pt.y - ANN_TEXT_PAD_Y - fontSize * ANN_TEXT_LINE / 2;',
                    'var y = pt.y - ANN_TEXT_PAD_Y;') },
  /* The rects are in SCREEN pixels and the box's own x/y are in the SVG's
     user units. Dividing by nothing is the whole bug, and with the estimate
     out of the way the correction is carrying the placement on its own. */
  { name: "the measurement mixes screen pixels with the SVG's user units",
    place: p => NO_ESTIMATE(sub(p, DELTA_RETURN,
                    'return { dx: (wantX - caret.x), dy: (wantY - caret.mid) };')) },
  /* Answers "would a systematic half-pixel error be caught?" — 0.55 must go
     red in EITHER direction now that the code is not already leaning one
     way. The boundary is inclusive (off <= TOL), so a drift of exactly 0.5
     would still pass: the tolerance is the loosest this file will ever be,
     not a target to sit on. */
  { name: 'a systematic 0.55-page-unit drift, to size the tolerance',
    place: p => sub(p, DELTA_RETURN,
                    'return { dx: (wantX - caret.x) / kx, dy: (wantY - caret.mid) / ky - 0.55 };') },
  { name: 'the same drift the other way, which must also go red',
    place: p => sub(p, DELTA_RETURN,
                    'return { dx: (wantX - caret.x) / kx, dy: (wantY - caret.mid) / ky + 0.55 };') },
  /* THE ONE THAT MATTERS MOST. Modelling the caret from padding plus half
     the line-height is what shipped, and it is wrong by a fraction of a
     pixel that no screenshot would show: Blink FLOORS the half-leading. If
     the harness ever stops measuring the real caret this goes quiet, and the
     bias comes back with 336 green ticks over it. */
  { name: 'the caret is MODELLED again instead of measured',
    place: p => sub(p, 'var caret = textCaretRect(div) || textCaretModel(div, kx, ky);',
                    'var caret = textCaretModel(div, kx, ky);') },
  /* The fix moves the foreignObject by hand rather than re-rendering, so the
     model and the DOM are updated in two separate places and can drift. Every
     hit test, the eraser, annBounds and the flattened picture read the MODEL,
     so a drift is a box you can see in one place and grab in another. */
  { name: 'the foreignObject is left behind when the model moves',
    place: p => sub(p, "        fo.setAttribute('x', a.x);", '') },
  { name: 'the width floor is gone, so a box at the right edge collapses',
    place: p => sub(p, 'return round2(Math.max(80, Math.min(320, p.baseW - x - 12)));',
                    'return round2(Math.min(320, p.baseW - x - 12));') }
];

const selftest = process.argv.includes('--selftest');

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
let page = await browser.newPage();
await page.setViewportSize({ width: 1400, height: 1000 });

/* A RETINA SCREEN IS A DIFFERENT LAYOUT, and it is the screen the centre's
   iPads actually have. Everything here is measured in CSS pixels, so a
   devicePixelRatio of 2 should change nothing at all — which is worth
   proving rather than assuming, because it is the one variable a laptop
   never exercises. */
async function usePage(dpr) {
  const np = await browser.newPage({ deviceScaleFactor: dpr });
  await np.setViewportSize({ width: 1400, height: 1000 });
  const old = page;
  page = np;
  if (old) await old.close();
}

async function load(PLACE, cssExtra) {
await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
  :root { --font: ${FONTVAR}; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #fff; }
  #stage { position: absolute; left: 40px; top: 30px; }
  .pageWrap { position: relative; background: #fff; }
  svg.overlay { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
${CSS_TEXT}
${cssExtra || ''}
</style></head><body>
<div id="stage"><div class="pageWrap" id="wrap"><svg class="overlay" id="svg"
   viewBox="0 0 ${BASE_W} ${BASE_H}" preserveAspectRatio="none"></svg></div></div>
<script>
var SVG_NS = 'http://www.w3.org/2000/svg';
function el(name, attrs) {
  var n = document.createElementNS(SVG_NS, name);
  if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]);
  return n;
}
function round2(n) { return Math.round(n * 100) / 100; }
${CONSTS}
var fontSize = 16, color = '#1A1A1A';
var annotations = [], editingId = null, selectedId = null;
function newAnnId() { return 'a' + (annotations.length + 1); }
function pushUndo() {}
function setDirty() {}
function annFrame(a) {
  var h = a.type === 'text' ? Math.max(a.h || 0, (a.fontSize || 16) * 1.8) : (a.h || 0);
  return { x: a.x || 0, y: a.y || 0, w: a.w || 0, h: h };
}
/* renderOverlay, cut down to the one branch this is about — byte for byte
   the same foreignObject + div the app builds. */
function renderOverlay(p) {
  p.svg.innerHTML = '';
  annotations.forEach(function (a) {
    var g = el('g', { 'data-id': a.id });
    var fr = annFrame(a);
    var fo = el('foreignObject', { x: fr.x, y: fr.y, width: Math.max(fr.w, 40), height: fr.h });
    fo.style.overflow = 'visible';
    var div = document.createElement('div');
    div.className = 'annText';
    div.style.fontSize = (a.fontSize || 16) + 'px';
    div.style.color = a.color;
    div.textContent = a.text || '';
    div.contentEditable = (editingId === a.id) ? 'true' : 'false';
    fo.appendChild(div);
    g.appendChild(fo);
    p.svg.appendChild(g);
  });
}
${PLACE}
window.__run = function (zoom, fs, px, py) {
  annotations = []; editingId = null; selectedId = null;
  fontSize = fs;
  var wrap = document.getElementById('wrap');
  wrap.style.width = (${BASE_W} * zoom) + 'px';
  wrap.style.height = (${BASE_H} * zoom) + 'px';
  var p = { num: 1, baseW: ${BASE_W}, baseH: ${BASE_H}, svg: document.getElementById('svg') };
  startTextBox(p, { x: px, y: py });
  var a = annotations[0];
  var div = p.svg.querySelector('.annText');
  if (!div) return { err: 'no box was drawn' };

  /* WHERE THE BROWSER WILL REALLY PUT THE BAR.
     A collapsed Range's client rect IS the caret rect — that is what the API
     is for. But in an EMPTY contenteditable Chromium returns no rects at all
     (measured: getClientRects().length === 0, and getBoundingClientRect()
     comes back 0/0/0/0), so the obvious call quietly gives nothing and any
     fallback beside it becomes the thing that is really being used.

     THAT IS THE TRAP THIS FILE WAS WRITTEN TO AVOID AND FELL INTO ANYWAY:
     the fallback below computes content-box top + line-height / 2, which is
     the very formula textCaretDelta uses, so the check agreed with the code
     because it was the code. So: a zero-width space is put in, which gives the
     first line box a real text fragment and therefore a real rect, and taken
     straight out again. It changes no geometry — the line box is already one
     line-height tall — and it is measured by the browser's own layout rather
     than by arithmetic this file shares with the app. */
  function measureCaret(div) {
    var probe = document.createTextNode('\u200b');
    div.appendChild(probe);
    var rc = null;
    try {
      var r1 = document.createRange();
      r1.selectNodeContents(probe);
      var rects = r1.getClientRects();
      if (rects.length && rects[0].height > 0) rc = rects[0];
      if (!rc) {
        // Second try: a real glyph, with the caret collapsed in front of it.
        probe.data = 'n';
        var r2 = document.createRange();
        r2.setStart(probe, 0); r2.collapse(true);
        var rr = r2.getClientRects();
        if (rr.length && rr[0].height > 0) rc = rr[0];
      }
    } catch (e) { rc = null; }
    var out = rc ? { left: rc.left, top: rc.top, height: rc.height, fallback: false } : null;
    probe.parentNode.removeChild(probe);
    return out;
  }
  var cr = measureCaret(div);
  if (!cr) {
    // Last resort, and it is REPORTED: this branch shares its arithmetic with
    // the code under test, so a run that takes it has proved nothing.
    var r = div.getBoundingClientRect();
    var cs = getComputedStyle(div);
    var pr0 = p.svg.getBoundingClientRect();
    var kx0 = pr0.width / ${BASE_W}, ky0 = pr0.height / ${BASE_H};
    var lh0 = parseFloat(cs.lineHeight) || (parseFloat(cs.fontSize) * ANN_TEXT_LINE);
    cr = { left: r.left + parseFloat(cs.paddingLeft) * kx0,
           top: r.top + parseFloat(cs.paddingTop) * ky0,
           height: lh0 * ky0, fallback: true };
  }
  var pr = p.svg.getBoundingClientRect();
  var kx = pr.width / ${BASE_W}, ky = pr.height / ${BASE_H};
  var wantX = pr.left + px * kx;
  var wantY = pr.top + py * ky;
  return {
    /* Reported in PAGE units, so the same tolerance means the same thing at
       every zoom — half a pixel out at 400% is two pixels out on paper. */
    dx: (cr.left - wantX) / kx,
    dy: ((cr.top + cr.height / 2) - wantY) / ky,
    caretH: cr.height / ky,
    boxW: a.w, boxX: a.x, boxY: a.y,
    fallback: !!cr.fallback,
    /* The fix moves the foreignObject's attributes by hand instead of
       re-rendering, so the model and the DOM can silently drift apart. Every
       hit test, the eraser and the flattened picture read the MODEL. */
    domX: +div.parentNode.getAttribute('x'),
    domY: +div.parentNode.getAttribute('y'),
    domW: +div.parentNode.getAttribute('width')
  };
};
</script></body></html>`);
}

/* Every placement, measured. Returns what was off, in page units. */
async function sweep(opts) {
  opts = opts || {};
  const zooms = opts.zooms || ZOOMS, sizes = opts.sizes || SIZES, points = opts.points || POINTS;
  const bad = [];
  const bySize = new Map();
  let n = 0, fellBack = 0, worst = { off: -1 };
  for (const zoom of zooms) {
    for (const fs of sizes) {
      for (const pt of points) {
        n++;
        const r = await page.evaluate(
          ([z, f, x, y]) => window.__run(z, f, x, y), [zoom, fs, pt.x, pt.y]);
        const where = `zoom ${Math.round(zoom * 100)}% · ${fs}px · ${pt.at}`;
        if (r.err) { bad.push(`${where}: ${r.err}`); continue; }
        if (r.fallback) fellBack++;
        const off = Math.max(Math.abs(r.dx), Math.abs(r.dy));
        if (off > worst.off) worst = { off, dx: r.dx, dy: r.dy, where };
        const prev = bySize.get(fs);
        if (!prev || Math.abs(r.dy) > Math.abs(prev)) bySize.set(fs, r.dy);
        // The model and the DOM must say the same thing about the box.
        if (Math.abs(r.domX - r.boxX) > 0.001 || Math.abs(r.domY - r.boxY) > 0.001 ||
            Math.abs(r.domW - Math.max(r.boxW, 40)) > 0.001) {
          bad.push(`${where}: the model says ${r.boxX},${r.boxY} ${r.boxW} wide but the ` +
                   `foreignObject says ${r.domX},${r.domY} ${r.domW} wide`);
          continue;
        }
        if (off <= TOL && r.boxW >= 80) continue;
        bad.push(`${where}: caret is ${r.dx.toFixed(2)} across / ${r.dy.toFixed(2)} down` +
                 (r.boxW < 80 ? `, and the box is only ${r.boxW} wide` : ''));
      }
    }
  }
  return { n, bad, fellBack, worst, bySize };
}

let code = 0;

await load(PLACE);
const real = await sweep();
console.log(`\n✒️  ${real.n} placements measured in a real browser` +
            `  (tolerance ${TOL}px, in page units)`);
console.log(`   worst: ${real.worst.dx.toFixed(3)} across / ${real.worst.dy.toFixed(3)} down` +
            `  at ${real.worst.where}`);
/* Per font size, because the error is a property of the SIZE and of nothing
   else: it is the fraction of a pixel the browser throws away when it splits
   the leading, so it does not move with zoom, with the point, or with the
   screen's pixel ratio. */
console.log('   worst down, by font size: ' + [...real.bySize.entries()]
  .sort((a, b) => a[0] - b[0])
  .map(([fs, dy]) => `${fs}px ${dy.toFixed(3)}${Math.abs(dy) > TOL ? ' ✗' : ''}`).join('   '));
if (real.fellBack) {
  console.log(`\n✗ ${real.fellBack} of ${real.n} could not measure a real caret and fell back to\n` +
              '  the content box — which is the formula the placement code itself uses, so\n' +
              '  those are the check marking its own homework and prove nothing.');
  code = 1;
}
if (real.bad.length) {
  console.log('\nNOT DEAD ON:');
  real.bad.slice(0, 24).forEach(b => console.log('  ✗ ' + b));
  if (real.bad.length > 24) console.log(`  … and ${real.bad.length - 24} more`);
  console.log(`\n✗ ${real.bad.length} of ${real.n} are off the pointer`);
  code = 1;
} else {
  console.log('✓ every one of them lands on the pointer');
}

/* ---- THE STYLESHEET IS NOT THE ONE THE CONSTANTS DESCRIBE ----
   The whole claim of textCaretDelta is that it MEASURES rather than models,
   so it should stay exact when the CSS moves out from under the constants.
   The second of these is the one that matters: padding and leading SMALLER
   than the fallback numbers, so the correction has to push the box back the
   other way — the estimate and the measurement disagree in opposite
   directions, which a correction applied with the wrong sign gets right by
   luck in every other case. */
const CSS_VARIANTS = [
  { name: 'padding and leading much BIGGER than the constants',
    css: '.annText { padding: 11px 17px; line-height: 2.4; }' },
  { name: 'padding and leading SMALLER — the correction must reverse',
    css: '.annText { padding: 0; line-height: 1; }' },
  { name: 'line-height: normal, which computes to a string and not a length',
    css: '.annText { line-height: normal; }' }
];
console.log('\n--- the same placements with the stylesheet moved ---');
for (const v of CSS_VARIANTS) {
  await load(PLACE, v.css);
  const r = await sweep({ zooms: [0.75, 1, 2.5], sizes: [12, 16, 34], points: POINTS.slice(0, 4) });
  if (r.bad.length) {
    console.log(`  ✗ ${v.name}`);
    console.log(`      ${r.bad.length}/${r.n} off — worst ${r.worst.dx.toFixed(2)} across / ` +
                `${r.worst.dy.toFixed(2)} down at ${r.worst.where}`);
    code = 1;
  } else {
    console.log(`  ✓ ${v.name}  (${r.n} placements, worst ${r.worst.dy.toFixed(2)} down)`);
  }
}

/* ---- A RETINA SCREEN ---- */
await usePage(2);
await load(PLACE);
const hi = await sweep({ zooms: [1, 1.3333, 2.5], sizes: [12, 16], points: POINTS });
console.log('\n--- devicePixelRatio 2 ---');
if (hi.bad.length) {
  console.log(`  ✗ ${hi.bad.length}/${hi.n} off — worst ${hi.worst.dx.toFixed(2)} across / ` +
              `${hi.worst.dy.toFixed(2)} down at ${hi.worst.where}`);
  code = 1;
} else {
  console.log(`  ✓ all ${hi.n} land, worst ${hi.worst.dy.toFixed(3)} down — the same as at dpr 1`);
}
await usePage(1);

/* ====================================================================
   AND THE FLATTENED PICTURE — the one the AI actually marks from.
   The screen lays the answer out with CSS; drawAnnsOnCtx lays the same
   answer out with arithmetic. Where those two disagree, the student is
   marked on a page nobody was looking at — so the DOM's own line boxes
   are read with a Range and compared, line by line, with what the real
   drawAnnsOnCtx would paint.

   The scale is the one compositeJpeg really uses: an A4 page capped at
   1400px on its long side, so ky is about 1.66 rather than a tidy 1.
   ==================================================================== */
const FLAT_KY = 1400 / BASE_H;
const FLAT_CASES = [
  { t: 'a short answer', w: 320, fs: 16, at: 'one line' },
  { t: 'The water evaporated from the beaker because the temperature of the ' +
       'surroundings was higher than the boiling point.', w: 320, fs: 16, at: 'a wrapped sentence' },
  { t: 'line one\nline two\nline three', w: 320, fs: 16, at: 'typed newlines' },
  /* KNOWN, and older than the caret fix. The screen is
     `white-space: pre-wrap; overflow-wrap: break-word`; the canvas splits on
     /\s+/. So the words and their order agree and the LINE BREAKS do not.
     They are listed rather than hidden, and `known` is an allowlist with a
     reason — anything NOT on it fails the run, and a case that starts
     PASSING fails too, because a stale note is how a fixed thing goes on
     being described as broken. Matching pre-wrap and break-word in canvas is
     its own change with its own risks; it is not what a misplaced caret is. */
  { t: 'double  spaced  words  here  in  the  answer  box  wrapping  over',
    w: 200, fs: 16, at: 'double spaces, which pre-wrap keeps on screen',
    known: 'the canvas collapses runs of spaces' },
  { t: 'supercalifragilisticexpialidociousandthensomemoreletters end',
    w: 160, fs: 16, at: 'a word longer than the box, which break-word splits on screen',
    known: 'the canvas never breaks inside a word' },
  { t: 'tab\tseparated\tvalues in the answer', w: 320, fs: 16,
    at: 'a tab, which pre-wrap keeps',
    known: 'the canvas turns a tab into one space' }
];

async function loadFlatten() {
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
  :root { --font: ${FONTVAR}; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #fff; }
  #host { position: absolute; left: 0; top: 0; visibility: hidden; }
${CSS_TEXT}
  </style></head><body><div id="host"></div><canvas id="cv" width="1200" height="900"></canvas>
<script>
function annDashPattern() { return null; }
function annHasHeadAtStart() { return false; }
function annHasHeadAtEnd() { return false; }
function arrowHeadPoints() { return [{x:0,y:0},{x:0,y:0}]; }
${CONSTS}
${DRAW}
window.__flat = function (text, w, fs, k) {
  // ---- what the SCREEN does ----
  var host = document.getElementById('host');
  host.innerHTML = '';
  var div = document.createElement('div');
  div.className = 'annText';
  div.style.width = w + 'px';
  div.style.fontSize = fs + 'px';
  div.textContent = text;
  host.appendChild(div);
  /* Note the doubled backslashes: this script is written inside a template
     literal, where \\s would collapse to a bare s and silently turn every
     whitespace test into a test for the letter "s".
     WHICH LINE A CHARACTER IS ON. Only a non-blank character answers that
     cleanly: a space at a wrap point belongs to both lines and comes back
     with two rects, so grouping on one would start the next line early and
     move the first letter of it onto the line before. Blanks are therefore
     carried along with whatever line is open and never open one. */
  var tn = div.firstChild, lines = [], cur = null;
  for (var i = 0; i < text.length; i++) {
    var ch = text[i];
    if (/\\s/.test(ch)) { if (cur) cur.s += ch; continue; }
    var r = document.createRange(); r.setStart(tn, i); r.setEnd(tn, i + 1);
    var rects = r.getClientRects();
    if (!rects.length) { if (cur) cur.s += ch; continue; }
    var rc = rects[0];
    for (var q = 1; q < rects.length; q++) if (rects[q].top < rc.top) rc = rects[q];
    if (!cur || Math.abs(rc.top - cur.top) > 0.6) { cur = { top: rc.top, h: rc.height, left: rc.left, s: ch }; lines.push(cur); }
    else cur.s += ch;
  }
  var dr = div.getBoundingClientRect(), cs = getComputedStyle(div);
  var cTop = dr.top + parseFloat(cs.paddingTop), cLeft = dr.left + parseFloat(cs.paddingLeft);
  var dom = lines.map(function (l) {
    return { text: l.s.replace(/^\\s+|\\s+$/g, ''), top: l.top - cTop, left: l.left - cLeft };
  });

  // ---- what the FLATTEN does. fillText is recorded, not painted. ----
  var ctx = document.getElementById('cv').getContext('2d');
  var drawn = [], real = ctx.fillText.bind(ctx);
  ctx.fillText = function (t, x, y) { drawn.push({ t: t, x: x, y: y }); };
  drawAnnsOnCtx(ctx, k, k, [{ page: 1, type: 'text', x: 0, y: 0, w: w, h: 100,
                              text: text, fontSize: fs, color: '#000' }], 1);
  ctx.fillText = real;
  ctx.font = Math.max(6, fs * k) + 'px ' + ANN_TEXT_FONT;
  var fm = ctx.measureText('Mg');
  var asc = fm.fontBoundingBoxAscent;
  var can = drawn.map(function (d) {
    return { text: d.t, top: (d.y - asc - ANN_TEXT_PAD_Y * k) / k, left: (d.x - ANN_TEXT_PAD_X * k) / k };
  });
  return { dom: dom, can: can };
};
</script></body></html>`);
}

await loadFlatten();
console.log('\n--- the flattened picture against the screen ---');
const flatBad = [];
let flatWorst = { off: -1 };
for (const c of FLAT_CASES) {
  const r = await page.evaluate(([t, w, f, k]) => window.__flat(t, w, f, k),
                                [c.t, c.w, c.fs, FLAT_KY]);
  const n = Math.max(r.dom.length, r.can.length);
  const trouble = [];
  for (let i = 0; i < n; i++) {
    const d = r.dom[i], k = r.can[i];
    if (!d || !k) { trouble.push(`line ${i + 1}: the screen has ${r.dom.length} lines, the picture ${r.can.length}`); continue; }
    if (d.text !== k.text) { trouble.push(`line ${i + 1}: screen ${JSON.stringify(d.text)} vs picture ${JSON.stringify(k.text)}`); continue; }
    const off = Math.max(Math.abs(d.top - k.top), Math.abs(d.left - k.left));
    if (off > flatWorst.off) flatWorst = { off, dx: k.left - d.left, dy: k.top - d.top, at: c.at, line: i + 1 };
    if (off > TOL)
      trouble.push(`line ${i + 1}: ${(k.left - d.left).toFixed(2)} across / ${(k.top - d.top).toFixed(2)} down`);
  }
  if (trouble.length && c.known) {
    console.log(`  — known: ${c.at}`);
    console.log(`      ${c.known}; the words agree, the line breaks do not`);
    trouble.slice(0, 2).forEach(t => console.log('      ' + t));
  } else if (trouble.length) {
    flatBad.push(c.at);
    console.log(`  ✗ ${c.at}`);
    trouble.slice(0, 3).forEach(t => console.log('      ' + t));
  } else if (c.known) {
    // Somebody fixed it. Say so loudly rather than letting the note rot.
    flatBad.push(c.at);
    console.log(`  ✗ NO LONGER A KNOWN LIMIT: ${c.at}`);
    console.log(`      it agrees with the screen now — take "${c.known}" out of FLAT_CASES and out of CLAUDE.md`);
  } else console.log(`  ✓ ${c.at}`);
}
console.log(`   where the words agree, the picture puts them ${flatWorst.dx.toFixed(3)} across / ` +
            `${flatWorst.dy.toFixed(3)} down from the screen (worst, at ${FLAT_KY.toFixed(3)}x)`);
if (flatBad.length) code = 1;

if (selftest) {
  console.log('\n--- self-test: each of these must go RED ---');
  await load(PLACE);
  /* A mutant counts as caught only if it fails MORE than the unmutated code
     does. "Some placements are off" is not evidence once the baseline itself
     is off: it would mark every mutant caught, including one that changed
     nothing at all. */
  const baseFails = new Set(real.bad);
  for (const m of MUTANTS) {
    await load(m.place(PLACE));
    const r = await sweep();
    const fresh = r.bad.filter(b => !baseFails.has(b));
    if (fresh.length) {
      console.log(`  ✓ caught: ${m.name}`);
      console.log(`      ${fresh.length} placements newly off — e.g. ${fresh[0]}`);
    } else {
      console.log(`  ✗ NOT CAUGHT: ${m.name}`);
      console.log('      it broke nothing the unmutated code did not already break,');
      console.log('      so this check cannot fail and is not a check');
      code = 1;
    }
  }
}

await browser.close();
process.exit(code);
