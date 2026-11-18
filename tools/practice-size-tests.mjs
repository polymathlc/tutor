/* ↔ A BIGGER PRACTICE WINDOW and 🔍 BIGGER DIAGRAMS (v1.100.0) — practice-size.js's
   pure half and the wiring in ✏️ Practise. Run: node --test tools/practice-size-tests.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
require('../practice-size.js');
const P = globalThis.PracSize;
const html = readFileSync(join(here, '..', 'index.html'), 'utf8');
const css = readFileSync(join(here, '..', 'practice-size.css'), 'utf8');

test('the zoom stays between its limits and anything odd is 100%', () => {
  assert.equal(P.cleanZoom(1), 1);
  assert.equal(P.cleanZoom(9), P.ZOOM_MAX);
  assert.equal(P.cleanZoom(0.1), P.ZOOM_MIN);
  ['x', null, undefined, -2, 0, NaN, Infinity].forEach(v => assert.equal(P.cleanZoom(v), 1, String(v)));
  assert.equal(P.cleanZoom('1.5'), 1.5);
});

test('a tap is one step, and a step that crosses 100% stops on it', () => {
  assert.equal(P.stepZoom(1, 1), 1.2);
  assert.equal(P.stepZoom(1.2, 1), 1.44);
  assert.equal(P.stepZoom(1, -1), 0.83);
  assert.equal(P.stepZoom(1.1, -1), 1, 'down across 100% lands on it');
  assert.equal(P.stepZoom(0.9, 1), 1, 'up across 100% lands on it');
  assert.equal(P.stepZoom(P.ZOOM_MAX, 1), P.ZOOM_MAX);
  assert.equal(P.stepZoom(P.ZOOM_MIN, -1), P.ZOOM_MIN);
  let z = 1;
  for (let i = 0; i < 3; i++) z = P.stepZoom(z, 1);
  assert.equal(P.zoomLabel(z), '173%');
});

test('holding speeds up, like the worksheet −/+', () => {
  assert.ok(P.holdRate(0) > 1);
  assert.ok(P.holdRate(800) > P.holdRate(0));
  assert.equal(P.holdRate(5000), P.holdRate(1600), 'and stops speeding up');
});

test('the window stays inside the screen and never too small to use', () => {
  const view = { w: 1180, h: 820 };
  assert.deepEqual(P.clampWin({ w: 5000, h: 5000 }, view), { w: 1164, h: 804 });
  assert.deepEqual(P.clampWin({ w: 10, h: 10 }, view), { w: P.WIN_MIN_W, h: P.WIN_MIN_H });
  assert.deepEqual(P.clampWin({ w: 700, h: 600 }, view), { w: 700, h: 600 });
  // A screen smaller than the minimum: the screen wins.
  assert.deepEqual(P.clampWin({ w: 10, h: 10 }, { w: 300, h: 280 }), { w: 284, h: 264 });
});

test('the size is kept as a share of the screen, so turning an iPad keeps it', () => {
  const pref = P.prefFromWin({ w: 738, h: 944 }, { w: 820, h: 1180 });
  assert.deepEqual(pref, { fw: 0.9, fh: 0.8 });
  assert.deepEqual(P.winFromPref(pref, { w: 1180, h: 820 }), { w: 1062, h: 656 });
  assert.deepEqual(P.winFromPref({ max: true }, { w: 1180, h: 820 }), { w: 1164, h: 804 });
  [null, 'x', {}, { fw: 2, fh: 0.5 }, { fw: -1, fh: 0.5 }, { max: 'yes' }].forEach(p =>
    assert.equal(P.winFromPref(p, { w: 1000, h: 800 }), null, JSON.stringify(p)));
});

test('at 100% a picture is the size the stylesheet gave it; the zoom multiplies that', () => {
  assert.equal(P.picWidth(true, 1600, 600, 1), 600, 'a cut-out fills the window');
  assert.equal(P.picWidth(true, 1600, 600, 1.5), 900);
  assert.equal(P.picWidth(false, 400, 600, 1), 400, 'a small figure keeps its own size');
  assert.equal(P.picWidth(false, 400, 600, 2), 800);
  assert.equal(P.picWidth(false, 1200, 600, 0.5), 300, 'a wide figure starts at the window width');
});

test('✏️ Practise is wired to it', () => {
  assert.match(html, /<script src="practice-size\.js\?v=/);
  assert.match(html, /<link rel="stylesheet" href="practice-size\.css\?v=/);
  assert.match(html, /id="pracGrip"/);
  assert.match(html, /id="pracMax"/);
  assert.match(html, /pracZoomMount\(body, drawn && drawn\.bar/, 'the zoom sits with the pen');
  assert.match(html, /pracSizeBind\(\);\s*if \(pracWin\) pracWin\.apply\(\);\s*pracRender\(\);/, 'pracStart puts the size back');
  assert.match(css, /\.psGrip[^}]*touch-action: none/, 'a finger drags the grip, not the page');
  assert.match(css, /\.psGrip[^}]*width: 44px[^}]*height: 44px/, 'a finger-sized grip');
});
