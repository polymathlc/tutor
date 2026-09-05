/* =====================================================================
   ✍️  IS IT ACTUALLY SMOOTH TO WRITE ON?
   ---------------------------------------------------------------------
   The one thing about handwriting that cannot be checked by reading the
   source: what it COSTS. `tools/tutor-tests.mjs` proves the pipeline is
   shaped right — one node, an incremental `d`, a palm refused. It cannot
   prove that a stroke on a page that already has thirty answers on it
   lands inside a frame, because that is a question about a browser doing
   real layout on real SVG.

   So this loads the REAL overlay handlers, the REAL renderer and the REAL
   stylus rules out of index.html, builds the same overlay the app builds,
   and then WRITES ON IT with synthetic pointer events — measuring the wall
   clock, the node count and the `d` attribute after every move.

   IT MEASURES THE OLD PIPELINE TOO, out of git, and prints both. A single
   number is unreadable ("is 40ms good?"); the two side by side are the
   whole finding. That is also the only honest way to claim an improvement:
   the comparison is against the code that was really there, not against a
   remembered version of it.

   Like tools/text-caret-check.mjs it needs a Chromium on the machine, so
   it is a tool you reach for rather than a gate:
       node tools/stylus-check.mjs
       node tools/stylus-check.mjs --selftest    (break it, require red)
   ===================================================================== */
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { chromium } from 'playwright-core';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function cut(src, a, b, what) {
  const i = src.indexOf(a);
  if (i === -1) throw new Error('could not find the start of ' + what);
  const j = src.indexOf(b, i + a.length);
  if (j === -1) throw new Error('could not find the end of ' + what);
  return src.slice(i, j);
}

/* ---- The real thing, cut out of the app ---- */
const HELPERS = cut(html, 'function el(name, attrs) {', 'function escHtml(s) {', 'the SVG helpers');
const SHAPES  = cut(html, '/* Unrotated frame of an x/y/w/h annotation.',
                          'function annNode(a) {', 'the annotation shapes');
const NODE    = cut(html, 'function annNode(a) {', '/* ================= Flattening a page', 'the renderer');
const STYLUS  = cut(html, 'var stylusOnly = (function () {', 'function setTool(t) {', 'the stylus rules');
const OVERLAY = cut(html, 'function attachOverlayHandlers(p) {', '\nfunction translateAnn(', 'the overlay handlers');
const ERASE   = cut(html, 'function eraseAlong(x1, y1, x2, y2) {', '/* ---- THE BOX BEING TYPED IN', 'the eraser');
const HLW     = cut(html, 'function highlightWidthFor(w)', '\n', 'the highlighter width');

/* ---- …and the pipeline as it was BEFORE, out of git ----
   NOT `HEAD`, which is this release the moment it is committed and would
   quietly turn the whole comparison into the new pipeline measured against
   itself — reported as "1.0× faster" rather than as a broken baseline. The
   newest commit whose handlers do NOT read `getCoalescedEvents` is the last
   one before the port, whatever has been rebased or merged since. */
let OLD_OVERLAY = null, OLD_REF = '';
try {
  const cwd = new URL('..', import.meta.url).pathname;
  const revs = execSync('git log --format=%h -40 -- index.html', { cwd })
    .toString().trim().split('\n').filter(Boolean);
  for (const rev of revs) {
    let src;
    try {
      src = execSync('git show ' + rev + ':index.html', { cwd, maxBuffer: 64 * 1024 * 1024 }).toString();
    } catch (e) { continue; }
    let handlers;
    try {
      handlers = cut(src, 'function attachOverlayHandlers(p) {', '\nfunction translateAnn(', 'the old handlers');
    } catch (e) { continue; }
    if (!handlers.includes('getCoalescedEvents')) { OLD_OVERLAY = handlers; OLD_REF = rev; break; }
  }
  if (!OLD_OVERLAY) console.log('  (no pre-port commit found in the last 40 — running the new pipeline alone)');
} catch (e) {
  console.log('  (could not read the previous pipeline out of git — running the new one alone)');
}

/* ---- The stand-ins ----
   Everything the pipeline TOUCHES but is not: the undo stack, the hint pins,
   the save flag. They are counted rather than performed, so what the clock
   measures is the drawing and nothing else. */
const STUBS = `
var SVG_NS = 'http://www.w3.org/2000/svg';
var counters = { pushUndo: 0, renderOverlay: 0, annNode: 0, setDirty: 0 };
var annotations = [], undoStack = [], redoStack = [];
var hints = [], marking = { items: [] }, showMarkPins = false;
var tool = 'pen', color = '#1A1A1A', strokeW = 3, fontSize = 16;
var lineDash = 'solid', lineHeads = 'end';
var selectedId = null, editingId = null, scale = 1;
var nav = { mode: null, pts: new Map(), cx: 0, cy: 0, dist: 0, vx: 0, vy: 0, lastT: 0 };
var navMomentum = null;
function $(id) { return document.getElementById(id); }
function toast() {}
function snapshot() { return JSON.stringify(annotations); }
function pushUndo(s) { counters.pushUndo++; undoStack.push(s !== undefined ? s : snapshot()); }
function setDirty() { counters.setDirty++; }
function renderPinsOn() {} function renderMarksOn() {}
function renderAllOverlays() { counters.renderOverlay++; }
function commitActiveTextEdit() {}
function askHintAt() {} function startVoice() {} function startTextBox() {}
function syncSizeCtl() {}
function newAnnId() { return 'a' + (annotations.length) + '_' + Math.random().toString(36).slice(2, 7); }
function eventPoint(e, p) {
  var r = p.svg.getBoundingClientRect();
  return { x: round2((e.clientX - r.left) * (p.baseW / r.width)),
           y: round2((e.clientY - r.top) * (p.baseH / r.height)) };
}
function translateAnn(a, dx, dy) {
  if (a.type === 'pen' || a.type === 'highlight') {
    (a.points || []).forEach(function (q) { q.x = round2(q.x + dx); q.y = round2(q.y + dy); });
  } else if (a.type === 'line' || a.type === 'arrow') {
    a.x1 = round2(a.x1 + dx); a.y1 = round2(a.y1 + dy);
    a.x2 = round2(a.x2 + dx); a.y2 = round2(a.y2 + dy);
  } else { a.x = round2((a.x || 0) + dx); a.y = round2((a.y || 0) + dy); }
}
/* The REAL renderOverlay, counted. This is the function the old pipeline
   called on every single pointermove and the new one calls once. */
function renderOverlay(p) {
  counters.renderOverlay++;
  var svg = p.svg;
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  annotations.forEach(function (a) {
    if (a.page !== p.num) return;
    svg.appendChild(annNode(a));
  });
  renderPinsOn(p); renderMarksOn(p);
}
`;

/* A page is 595 x 842 — A4 at 72dpi, which is what pdf.js hands back. */
const BASE_W = 595, BASE_H = 842;

function pageHtml(overlaySrc, extra, mutateStylus) {
  return `<!doctype html><meta charset="utf-8">
<style>
  html,body{margin:0;padding:0}
  #viewerArea{width:700px;height:900px;overflow:auto;position:relative}
  .pageWrap{position:relative;background:#fff;width:${BASE_W}px;height:${BASE_H}px}
  .pageWrap svg.overlay{position:absolute;inset:0;width:100%;height:100%;touch-action:none}
</style>
<div id="viewerArea"><div id="pagesContainer"><div class="pageWrap" id="w1">
  <svg class="overlay" id="s1" viewBox="0 0 ${BASE_W} ${BASE_H}"></svg>
</div></div></div>
<div id="toast"></div>
<script>
${STUBS}
${HELPERS}
function escHtml(s){return String(s==null?'':s);}
${SHAPES}
${NODE.replace(/function annNode\(a\) \{/, 'function annNode(a) {\n  counters.annNode++;')}
${HLW}
${mutateStylus ? mutateStylus(STYLUS) : STYLUS}
${overlaySrc}
${extra || ''}
var _realRenderOverlay = renderOverlay;
renderOverlay = function (p) { counters.renderOverlay++; return _realRenderOverlay(p); };
var _realPushUndo = pushUndo;
pushUndo = function (x) { counters.pushUndo++; return _realPushUndo(x); };
var page = { num: 1, baseW: ${BASE_W}, baseH: ${BASE_H},
             wrap: document.getElementById('w1'), svg: document.getElementById('s1') };
var pages = [page];
attachOverlayHandlers(page);
</` + `script>`;
}

/* ---- Writing on it ----
   A stroke of `n` samples down the middle of the page, dispatched as real
   PointerEvents at the real element, with the clock read either side. */
const DRIVE = `
(function () {
  window.__drive = function (opts) {
    var svg = page.svg;
    var r = svg.getBoundingClientRect();
    var id = opts.pointerId || 1;
    function ev(type, x, y, more) {
      var init = Object.assign({
        pointerId: id, pointerType: opts.pointerType || 'pen', isPrimary: true,
        bubbles: true, cancelable: true, button: 0, buttons: 1,
        clientX: r.left + x, clientY: r.top + y, width: opts.width || 2, height: opts.height || 2
      }, more || {});
      svg.dispatchEvent(new PointerEvent(type, init));
    }
    // Pointer capture on a synthetic pointer throws; the handlers already
    // swallow that, and every event here is aimed at the element anyway.
    var t0 = performance.now();
    ev('pointerdown', opts.x0, opts.y0);
    for (var i = 1; i <= opts.samples; i++) {
      var f = i / opts.samples;
      ev('pointermove', opts.x0 + (opts.x1 - opts.x0) * f,
                        opts.y0 + Math.sin(f * 12) * 60 + (opts.y1 - opts.y0) * f);
    }
    ev('pointerup', opts.x1, opts.y1, { buttons: 0 });
    var t1 = performance.now();
    return {
      ms: t1 - t0,
      nodes: svg.childNodes.length,
      annotations: annotations.length,
      counters: JSON.parse(JSON.stringify(counters)),
      points: (annotations[annotations.length - 1] || {}).points
        ? annotations[annotations.length - 1].points.length : 0
    };
  };
  window.__seed = function (n, pts) {
    for (var k = 0; k < n; k++) {
      var a = { id: 'seed' + k, page: 1, type: 'pen', color: '#1A1A1A', width: 3, points: [] };
      for (var j = 0; j < pts; j++) a.points.push({ x: 20 + (j % 500), y: 30 + k * 12 + (j % 7) });
      annotations.push(a);
    }
    renderOverlay(page);
    counters.renderOverlay = 0; counters.annNode = 0;
  };
  window.__reset = function () {
    annotations.length = 0; undoStack.length = 0;
    drawing = null; erasing = null; moving = null;
    activePointerId = null; activePointerType = null;
    // A pen touching down ARMS pencil-only mode, so without this every test
    // after the first pen stroke would be running in it — and a finger test
    // would report "a fingertip cannot draw" about an app behaving correctly.
    stylusOnly = false; pencilSeen = false;
    nav.mode = null; nav.pts.clear();
    counters.pushUndo = 0; counters.renderOverlay = 0; counters.annNode = 0; counters.setDirty = 0;
    renderOverlay(page);
    counters.renderOverlay = 0; counters.annNode = 0;
  };
})();
`;

/* ---- THE MUTANTS ----
   A check that cannot fail is not a check. `--selftest` breaks the pipeline
   in the exact ways this release fixed and requires each break to be caught.
   `sub()` THROWS when a mutant matches nothing: a mutant is a string
   replacement against code that is being edited, so a rename turns it into a
   no-op — and a no-op reports "not caught", which reads as a hole in the
   measurement rather than as a stale test. */
function sub(src, from, to, name) {
  if (!src.includes(from)) throw new Error('MUTANT "' + name + '" matched nothing — it has gone stale: ' + from.slice(0, 60));
  return src.replace(from, to);
}
const MUTANTS = [
  { name: 'the overlay is rebuilt on every move again (the bug this release exists for)',
    where: 'overlay',
    f: s => sub(s, '    redrawTemp();\n  });', '    renderOverlay(p);\n  });', 'rebuild per move') },
  /* NOT A MUTANT HERE, AND THE REASON MATTERS. Chromium never coalesces a
     SYNTHETIC pointer event: `getCoalescedEvents()` hands back the event
     itself, so deleting the call changes nothing this harness can see, and a
     mutant for it would sit here reporting a green tick for a measurement
     that is not happening. It is checked where it CAN be — against the source
     — by `tools/tutor-tests.mjs` ("the pen reads every coalesced sample the
     stylus gave us"). The only honest browser test of it needs a real pen on
     a real 120Hz screen. */
  { name: 'the points are no longer thinned',
    where: 'overlay',
    f: s => sub(s, 'if (Math.abs(sp.x - last.x) + Math.abs(sp.y - last.y) >= 1) an.points.push(sp);',
                   'an.points.push(sp);', 'no thinning') },
  { name: 'a palm may start a stroke',
    where: 'overlay',
    f: s => sub(s, 'if (isPalmTouch(e)) { e.preventDefault(); return; }', '', 'no palm rejection') },
  { name: 'a second pointer may hijack the stroke mid-word',
    where: 'overlay',
    f: s => sub(s, "    if (activePointerId !== null && e.pointerId !== activePointerId) return;\n\n    if (erasing",
                   "    if (false) return;\n\n    if (erasing", 'no move ownership') },
  { name: 'a second pointerdown may take the gesture over',
    where: 'overlay',
    f: s => sub(s, '    if (activePointerId !== null && e.pointerId !== activePointerId) {\n      if (e.isPrimary',
                   '    if (false) {\n      if (e.isPrimary', 'no down ownership') },
  /* NOT A MUTANT HERE EITHER. `drawing._d = null` only runs on a FORCED
     rebuild, and nothing in a real stroke forces one mid-stroke — so the
     break is invisible to anything that just writes on the page.
     `tools/tutor-tests.mjs` calls `redrawTemp(true)` directly and asserts the
     string is invalidated, which is the only place that can be seen. */
  { name: 'a one-point tap is dropped instead of kept as a visible dot',
    where: 'stylus',
    f: s => sub(s, "  if ((a.type === 'pen' || a.type === 'highlight') && a.points.length === 1) {",
                   '  if (false) {', 'no dot') },
  { name: 'the undo step is pushed AFTER the stroke lands (so undo keeps it)',
    where: 'stylus',
    f: s => sub(s, '  pushUndo();               // the page WITHOUT this stroke: one stroke, one undo\n  annotations.push(a);',
                   '  annotations.push(a);\n  pushUndo();', 'undo after push') },
  { name: 'a palm-sized contact is treated as a fingertip',
    where: 'stylus',
    f: s => sub(s, 'var PALM_CONTACT = 55;', 'var PALM_CONTACT = 5000;', 'palm threshold') }
];

/* Everything the check knows how to measure, in one run — so a mutant that
   only shows up in one scenario is still caught. */
async function battery() {
  await page.evaluate(() => window.__reset());
  await page.evaluate(([n, p]) => window.__seed(n, p), [SEED_STROKES, SEED_POINTS]);
  const stroke = await page.evaluate(([s]) => window.__drive({
    x0: 40, y0: 400, x1: 555, y1: 430, samples: s, pointerType: 'pen'
  }), [SAMPLES]);

  await page.evaluate(() => window.__reset());
  const palm = await page.evaluate(() => window.__drive({
    x0: 100, y0: 200, x1: 400, y1: 260, samples: 40,
    pointerType: 'touch', width: 80, height: 90, pointerId: 9
  }));

  await page.evaluate(() => window.__reset());
  const finger = await page.evaluate(() => window.__drive({
    x0: 100, y0: 200, x1: 400, y1: 260, samples: 40,
    pointerType: 'touch', width: 40, height: 40, pointerId: 10
  }));

  await page.evaluate(() => window.__reset());
  const dot = await page.evaluate(() => {
    var svg = page.svg, r = svg.getBoundingClientRect();
    ['pointerdown', 'pointerup'].forEach(function (t) {
      svg.dispatchEvent(new PointerEvent(t, {
        pointerId: 5, pointerType: 'pen', isPrimary: true, bubbles: true, cancelable: true,
        button: 0, buttons: t === 'pointerup' ? 0 : 1,
        clientX: r.left + 120, clientY: r.top + 120, width: 2, height: 2
      }));
    });
    return { n: annotations.length,
             pts: (annotations[0] || {}).points ? annotations[0].points.length : 0 };
  });

  await page.evaluate(() => window.__reset());
  const hijack = await page.evaluate(() => {
    var svg = page.svg, r = svg.getBoundingClientRect();
    function ev(type, id, x, y, kind) {
      svg.dispatchEvent(new PointerEvent(type, {
        pointerId: id, pointerType: kind || 'pen', isPrimary: id === 1, bubbles: true,
        cancelable: true, button: 0, buttons: type.indexOf('up') > 0 ? 0 : 1,
        clientX: r.left + x, clientY: r.top + y, width: 2, height: 2
      }));
    }
    ev('pointerdown', 1, 50, 300);
    for (var i = 0; i < 20; i++) ev('pointermove', 1, 50 + i * 5, 300);
    // A second contact of the SAME KIND: pencil-only mode already refuses a
    // finger, so a touch here would be measuring that rule instead of this
    // one. Ownership is the only thing that can refuse this.
    ev('pointerdown', 2, 300, 500, 'pen');
    for (var j = 0; j < 20; j++) ev('pointermove', 2, 300 + j * 5, 500, 'pen');
    ev('pointerup', 2, 400, 500, 'pen');
    for (var k = 20; k < 40; k++) ev('pointermove', 1, 50 + k * 5, 300);
    ev('pointerup', 1, 250, 300);
    var a = annotations[annotations.length - 1];
    var ys = (a && a.points || []).map(function (q) { return q.y; });
    var p0 = a && a.points && a.points[0];
    // WHERE the surviving stroke STARTS is the half that matters. Let the
    // second contact take the gesture over and the count is still 1 and the
    // line is still straight — it is simply the WRONG stroke, and the child's
    // first one has been thrown away with nothing on screen to say so.
    return { n: annotations.length,
             spread: ys.length ? Math.max.apply(null, ys) - Math.min.apply(null, ys) : -1,
             x0: p0 ? p0.x : -1, y0: p0 ? p0.y : -1 };
  });

  await page.evaluate(() => window.__reset());
  const undone = await page.evaluate(() => {
    var svg = page.svg, r = svg.getBoundingClientRect();
    function ev(type, x, y) {
      svg.dispatchEvent(new PointerEvent(type, {
        pointerId: 4, pointerType: 'pen', isPrimary: true, bubbles: true, cancelable: true,
        button: 0, buttons: type === 'pointerup' ? 0 : 1,
        clientX: r.left + x, clientY: r.top + y, width: 2, height: 2
      }));
    }
    ev('pointerdown', 60, 320);
    for (var i = 0; i < 30; i++) ev('pointermove', 60 + i * 6, 320 + (i % 5));
    ev('pointerup', 240, 322);
    // The step pushed for this stroke has to be the page WITHOUT it.
    var restored = JSON.parse(undoStack[undoStack.length - 1] || '[]');
    return { after: annotations.length, undoneTo: restored.length };
  });

  return { stroke, palm, finger, dot, hijack, undone };
}

/* What a healthy pipeline answers. Anything else is a mutant caught. */
function healthy(b) {
  return b.stroke.counters.annNode === 1 &&
         b.stroke.counters.renderOverlay <= 1 &&
         b.stroke.counters.pushUndo === 1 &&
         b.stroke.points > 20 && b.stroke.points < SAMPLES &&
         b.stroke.annotations === SEED_STROKES + 1 &&
         b.palm.annotations === 0 &&
         b.finger.annotations === 1 &&
         b.dot.n === 1 && b.dot.pts === 2 &&
         b.hijack.n === 1 && b.hijack.spread >= 0 && b.hijack.spread < 30 &&
         Math.abs(b.hijack.x0 - 50) < 4 && Math.abs(b.hijack.y0 - 300) < 4 &&
         b.undone.after === 1 && b.undone.undoneTo === 0;
}

/* ===================================================================== */
const selftest = process.argv.includes('--selftest');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 900, height: 950 } });

let failures = 0, checks = 0;
function ok(name, cond, detail) {
  checks++;
  if (cond) { console.log('  ✓ ' + name); return true; }
  failures++;
  console.log('  ✗ ' + name + (detail ? '\n      ' + detail : ''));
  return false;
}

async function load(overlaySrc, mutate, mutateStylus) {
  const src = mutate ? mutate(overlaySrc) : overlaySrc;
  await page.setContent(pageHtml(src, DRIVE, mutateStylus), { waitUntil: 'load' });
  const err = await page.evaluate(() => (typeof attachOverlayHandlers === 'function' ? '' : 'the handlers did not load'));
  if (err) throw new Error(err);
}

/* A long line of working on a page that already has answers on it — which is
   the case that got slower and slower, and the one nobody tests. */
const SEED_STROKES = 30, SEED_POINTS = 300, SAMPLES = 600;

async function measure(label) {
  const runs = [];
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.__reset());
    await page.evaluate(([n, p]) => window.__seed(n, p), [SEED_STROKES, SEED_POINTS]);
    runs.push(await page.evaluate(([s]) => window.__drive({
      x0: 40, y0: 400, x1: 555, y1: 430, samples: s, pointerType: 'pen'
    }), [SAMPLES]));
  }
  const best = runs.reduce((a, b) => (a.ms <= b.ms ? a : b));
  console.log('    ' + label.padEnd(26) +
    String(Math.round(best.ms)).padStart(6) + ' ms   ' +
    String(best.counters.annNode).padStart(7) + ' nodes built   ' +
    String(best.counters.renderOverlay).padStart(5) + ' page rebuilds');
  return best;
}

console.log('\n✍️  Writing a ' + SAMPLES + '-sample line on a page that already holds ' +
            SEED_STROKES + ' answers (' + SEED_STROKES * SEED_POINTS + ' points)\n');

await load(OVERLAY);
const now = await measure('now');

let before = null;
if (OLD_OVERLAY) {
  await load(OLD_OVERLAY);
  before = await measure('before (' + OLD_REF + ')');
}

console.log('');
if (!before) {
  // Said out loud. A run that quietly drops three checks and still reports
  // "all N passed" is a run that reads as a clean bill of health.
  console.log('  ! NO BASELINE — the three comparison checks below were SKIPPED.\n');
}
if (before) {
  /* THE BASELINE HAS TO BE THE OLD PIPELINE, asserted rather than assumed.
     The walk looks for the newest commit whose handlers do not mention
     `getCoalescedEvents` — an implementation token, not an invariant. Move
     the coalescing into a helper one day (the natural thing to do when
     `pointerrawupdate` is added) and THIS release becomes the newest commit
     "without coalescing": the harness would then compare the new pipeline
     against a slightly older new pipeline. The comparison checks below do
     already fail in that case, but they fail saying the wrong thing —
     "it stopped tearing the overlay down" rather than "your baseline is not
     the old code". This says it. */
  ok('the baseline really is the pre-port pipeline (' + OLD_REF + ')',
     before.counters.renderOverlay > 100 && before.counters.annNode > 1000,
     'it rebuilt the page ' + before.counters.renderOverlay + ' times and built ' +
     before.counters.annNode + ' nodes — the OLD pipeline does that per sample, so this is not it. ' +
     'The commit walk found the wrong commit; every comparison below is meaningless.');
  const speedup = before.ms / Math.max(0.01, now.ms);
  ok('the stroke is faster than it was', now.ms < before.ms,
     Math.round(now.ms) + 'ms now against ' + Math.round(before.ms) + 'ms before');
  console.log('    → ' + speedup.toFixed(1) + '× faster, ' +
              (before.counters.annNode - now.counters.annNode).toLocaleString() +
              ' fewer nodes built for ONE stroke');
  ok('…and it stopped rebuilding every annotation on the page per sample',
     now.counters.annNode === 1 && before.counters.annNode > 1000,
     now.counters.annNode + ' nodes built now, ' + before.counters.annNode + ' before');
  ok('…and stopped tearing the overlay down per sample',
     now.counters.renderOverlay <= 1 && before.counters.renderOverlay > 100,
     now.counters.renderOverlay + ' rebuilds now, ' + before.counters.renderOverlay + ' before');
}

await load(OVERLAY);
const b = await battery();

/* THE BUDGET. A frame is 16.7ms at 60Hz and 8.3ms on a 120Hz iPad. 600
   samples is roughly five seconds of writing, so the whole stroke has to fit
   inside a few frames' worth of work or the ink lags behind the nib. */
ok('a whole line of working costs less than one 60Hz frame per 100 samples',
   now.ms / (SAMPLES / 100) < 16.7,
   (now.ms / (SAMPLES / 100)).toFixed(2) + 'ms per 100 samples');
ok('one stroke builds ONE node, whatever is already on the page',
   b.stroke.counters.annNode === 1, 'built ' + b.stroke.counters.annNode);
ok('…and rebuilds the page at most once, at the end',
   b.stroke.counters.renderOverlay <= 1, b.stroke.counters.renderOverlay + ' rebuilds');
ok('the stroke landed in annotations', b.stroke.annotations === SEED_STROKES + 1);
ok('…thinned, not one point per sample',
   b.stroke.points > 20 && b.stroke.points < SAMPLES,
   'kept ' + b.stroke.points + ' of ' + SAMPLES);
ok('…with exactly one undo step for the stroke',
   b.stroke.counters.pushUndo === 1, 'got ' + b.stroke.counters.pushUndo);
ok('…and that step is the page WITHOUT it, so one undo takes it back',
   b.undone.after === 1 && b.undone.undoneTo === 0,
   'undo would restore ' + b.undone.undoneTo + ' annotation(s)');

ok('a palm-sized contact leaves NO ink on the page', b.palm.annotations === 0,
   'it drew ' + b.palm.annotations + " annotation(s) — in the child's own ink, on a page that is then marked from a picture of it");
ok('…while an ordinary fingertip still writes', b.finger.annotations === 1,
   'a threshold that eats normal fingers is a worse bug than the one it fixes');
ok('a second contact cannot drag the stroke away with it',
   b.hijack.n === 1 && b.hijack.spread >= 0 && b.hijack.spread < 30,
   'the stroke wandered ' + b.hijack.spread + ' units off its line — a second contact was writing into it');
ok('…nor take the gesture over and leave the first stroke behind',
   Math.abs(b.hijack.x0 - 50) < 4 && Math.abs(b.hijack.y0 - 300) < 4,
   'the surviving stroke starts at ' + b.hijack.x0 + ',' + b.hijack.y0 +
   ' — that is the SECOND contact\'s stroke; the child\'s own was dropped');
ok('a tap leaves a VISIBLE dot, not invisible ink',
   b.dot.n === 1 && b.dot.pts === 2,
   'one point draws nothing at all, and the child then rubs out something they cannot see');

/* ---- A pen touching down ARMS pencil-only mode ---- */
await page.evaluate(() => window.__reset());
const armed = await page.evaluate(() => {
  var svg = page.svg, r = svg.getBoundingClientRect();
  function ev(type, x, y, kind, id, w) {
    svg.dispatchEvent(new PointerEvent(type, {
      pointerId: id, pointerType: kind, isPrimary: true, bubbles: true, cancelable: true,
      button: 0, buttons: type === 'pointerup' ? 0 : 1,
      clientX: r.left + x, clientY: r.top + y, width: w, height: w
    }));
  }
  var was = stylusOnly;
  ev('pointerdown', 60, 300, 'pen', 1, 2);
  for (var i = 0; i < 10; i++) ev('pointermove', 60 + i * 8, 300, 'pen', 1, 2);
  ev('pointerup', 140, 300, 'pen', 1, 2);
  var armedNow = stylusOnly;
  var n1 = annotations.length;
  // …and now a finger, which must pan rather than write.
  ev('pointerdown', 60, 500, 'touch', 2, 40);
  for (var j = 0; j < 10; j++) ev('pointermove', 60 + j * 8, 500, 'touch', 2, 40);
  ev('pointerup', 140, 500, 'touch', 2, 40);
  return { was: was, armedNow: armedNow, afterPen: n1, afterFinger: annotations.length };
});
ok('a stylus touching down arms pencil-only mode by itself',
   armed.was === false && armed.armedNow === true,
   'palm rejection a child has to find in a toolbar is palm rejection nobody has on');
ok('…and from then on a finger no longer writes on the page',
   armed.afterPen === 1 && armed.afterFinger === 1,
   'the finger left ' + (armed.afterFinger - armed.afterPen) + ' extra annotation(s)');

/* ---- The selftest ---- */
if (selftest) {
  console.log('\n🧪 Breaking it on purpose — each of these MUST be caught\n');
  for (const m of MUTANTS) {
    await load(m.where === 'stylus' ? OVERLAY : m.f(OVERLAY),
               null, m.where === 'stylus' ? m.f : null);
    const bad = await battery();
    ok('caught: ' + m.name, !healthy(bad),
       'the mutant ran clean — this check does not measure what it claims to');
  }
  // …and the healthy pipeline must NOT be reported as broken, or every tick
  // above is meaningless.
  await load(OVERLAY);
  ok('…and the unbroken pipeline is still called healthy', healthy(await battery()));
}

await browser.close();
console.log('\n' + (failures
  ? '✗ ' + failures + ' of ' + checks + ' checks failed'
  : '✓ all ' + checks + ' checks passed'));
process.exit(failures ? 1 : 0);
