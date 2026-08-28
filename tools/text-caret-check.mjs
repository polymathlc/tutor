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
const PLACE = between('function textCaretDelta(p, div, pt)', 'function attachOverlayHandlers', 'the placement maths');
const FONTVAR = between('    --font:', ';', 'the font stack').replace('    --font:', '').trim();

/* A page is 595 x 842 (A4 at 72dpi), which is what pdf.js hands back. */
const BASE_W = 595, BASE_H = 842;
const TOL = 0.5;          // half a CSS pixel — below what any screen can show

const ZOOMS = [0.5, 0.75, 1, 1.2, 1.6, 2.5, 4];
const SIZES = [12, 16, 22, 34];
/* Corners and edges as well as the middle: the width floor and any clamp
   show up there and nowhere else. */
const POINTS = [
  { x: 300, y: 400, at: 'the middle of the page' },
  { x: 2, y: 3, at: 'the top-left corner' },
  { x: BASE_W - 4, y: 40, at: 'hard against the right edge' },
  { x: 40, y: BASE_H - 3, at: 'the bottom edge' },
  { x: 594, y: 841, at: 'the very last pixel' },
  { x: 123.45, y: 456.78, at: 'a fractional point' }
];

/* ---- THE MUTANTS ----
   A check that cannot fail is not a check, and the only way to know which
   kind you have is to try. `--selftest` breaks the placement in the exact
   way each one names and REQUIRES the measurement to go red. Add a rule to
   the placement, add its mutant here.

   The third one is the reason this file exists at all: mixing screen pixels
   with the SVG's user units is right at 100% zoom and wrong at every other
   one, so it is invisible on the machine it was written on and wrong on
   every iPad in the centre. */
const MUTANTS = [
  { name: "the box's top-left is dropped on the pointer, as it used to be",
    place: p => p.replace(/return \{ dx: [\s\S]*?\};/, 'return null;')
                 .replace('var x = pt.x - ANN_TEXT_PAD_X;', 'var x = pt.x;')
                 .replace('var y = pt.y - ANN_TEXT_PAD_Y - fontSize * ANN_TEXT_LINE / 2;', 'var y = pt.y;') },
  { name: 'the estimate forgets to lift the box by half a line',
    place: p => p.replace(/return \{ dx: [\s\S]*?\};/, 'return null;')
                 .replace('var y = pt.y - ANN_TEXT_PAD_Y - fontSize * ANN_TEXT_LINE / 2;',
                          'var y = pt.y - ANN_TEXT_PAD_Y;') },
  { name: "the measurement mixes screen pixels with the SVG's user units",
    place: p => p.replace('var caretX = r.left + (bL + padL) * kx;', 'var caretX = r.left + (bL + padL);')
                 .replace('var caretY = r.top + (bT + padT + lh / 2) * ky;', 'var caretY = r.top + (bT + padT + lh / 2);')
                 .replace('var x = pt.x - ANN_TEXT_PAD_X;', 'var x = pt.x;')
                 .replace('var y = pt.y - ANN_TEXT_PAD_Y - fontSize * ANN_TEXT_LINE / 2;', 'var y = pt.y;') },
  { name: 'the width floor is gone, so a box at the right edge collapses',
    place: p => p.replace('return round2(Math.max(80, Math.min(320, p.baseW - x - 12)));',
                          'return round2(Math.min(320, p.baseW - x - 12));') }
];

const selftest = process.argv.includes('--selftest');

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage();
await page.setViewportSize({ width: 1400, height: 1000 });

async function load(PLACE) {
await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
  :root { --font: ${FONTVAR}; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #fff; }
  #stage { position: absolute; left: 40px; top: 30px; }
  .pageWrap { position: relative; background: #fff; }
  svg.overlay { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
${CSS_TEXT}
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

  /* WHERE THE BROWSER WILL REALLY PUT THE BAR. An empty contenteditable has
     no text node, so the range is collapsed on the div itself — which is
     exactly the caret's own box. */
  var range = document.createRange();
  range.setStart(div, 0);
  range.collapse(true);
  var rects = range.getClientRects();
  var cr = rects.length ? rects[0] : null;
  if (!cr || !(cr.height > 0)) {
    // Safari and Chromium both give a collapsed range in an empty editable
    // a zero-width rect; if this browser gives nothing at all, fall back to
    // the content box, which is where the caret sits in an empty box.
    var r = div.getBoundingClientRect();
    var cs = getComputedStyle(div);
    var pr0 = p.svg.getBoundingClientRect();
    var kx0 = pr0.width / ${BASE_W}, ky0 = pr0.height / ${BASE_H};
    var lh0 = parseFloat(cs.lineHeight) || (parseFloat(cs.fontSize) * ANN_TEXT_LINE);
    cr = { left: r.left + parseFloat(cs.paddingLeft) * kx0,
           top: r.top + parseFloat(cs.paddingTop) * ky0,
           height: lh0 * ky0, __fallback: true };
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
    fallback: !!cr.__fallback
  };
};
</script></body></html>`);
}

/* Every placement, measured. Returns what was off, in page units. */
async function sweep() {
  const bad = [];
  let n = 0;
  for (const zoom of ZOOMS) {
    for (const fs of SIZES) {
      for (const pt of POINTS) {
        n++;
        const r = await page.evaluate(
          ([z, f, x, y]) => window.__run(z, f, x, y), [zoom, fs, pt.x, pt.y]);
        const where = `zoom ${Math.round(zoom * 100)}% · ${fs}px · ${pt.at}`;
        if (r.err) { bad.push(`${where}: ${r.err}`); continue; }
        const off = Math.max(Math.abs(r.dx), Math.abs(r.dy));
        if (off <= TOL && r.boxW >= 80) continue;
        bad.push(`${where}: caret is ${r.dx.toFixed(2)} across / ${r.dy.toFixed(2)} down` +
                 (r.boxW < 80 ? `, and the box is only ${r.boxW} wide` : ''));
      }
    }
  }
  return { n, bad };
}

let code = 0;

await load(PLACE);
const real = await sweep();
console.log(`\n✒️  ${real.n} placements measured in a real browser` +
            `  (tolerance ${TOL}px, in page units)`);
if (real.bad.length) {
  console.log('\nNOT DEAD ON:');
  real.bad.slice(0, 24).forEach(b => console.log('  ✗ ' + b));
  if (real.bad.length > 24) console.log(`  … and ${real.bad.length - 24} more`);
  console.log(`\n✗ ${real.bad.length} of ${real.n} are off the pointer`);
  code = 1;
} else {
  console.log('✓ every one of them lands on the pointer');
}

if (selftest) {
  console.log('\n--- self-test: each of these must go RED ---');
  for (const m of MUTANTS) {
    await load(m.place(PLACE));
    const r = await sweep();
    if (r.bad.length) {
      console.log(`  ✓ caught: ${m.name}  (${r.bad.length}/${r.n} off — e.g. ${r.bad[0]})`);
    } else {
      console.log(`  ✗ NOT CAUGHT: ${m.name}`);
      console.log('      this check cannot fail, so it is not a check');
      code = 1;
    }
  }
}

await browser.close();
process.exit(code);
