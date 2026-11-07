/* =====================================================================
   ⬆⬇ THE PAGE MOVES FROM THE TOOLBAR (v1.86.0)
   ---------------------------------------------------------------------
   The arithmetic behind ▲ ▼ ◀ ▶ − + is cut out of index.html between its
   markers and run here, and the wiring is read off the source. The real
   buttons are pressed in tools/nudge-browser-check.mjs.
   ===================================================================== */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const a = html.indexOf('/* ⬆⬇ NUDGE MATHS START */');
const b = html.indexOf('/* ⬆⬇ NUDGE MATHS END */');
assert(a > 0 && b > a, 'the nudge maths markers are in index.html');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(html.slice(a, b), ctx);
const { nudgeStep, nudgeSpeed, nudgeClamp, nudgeEase, nudgeRoom } = ctx;

test('a tap moves most of a screen, never all of it, never next to nothing', () => {
  assert.equal(nudgeStep(800), 600);
  assert(nudgeStep(1000) < 1000, 'the last line read stays in view');
  assert.equal(nudgeStep(20), 40);
  assert.equal(nudgeStep(0), 40);
  assert.equal(nudgeStep(undefined), 40);
  assert.equal(nudgeStep('nonsense'), 40);
});

test('a hold starts slow enough to stop on a question and speeds up', () => {
  const s0 = nudgeSpeed(0), s1 = nudgeSpeed(400), s2 = nudgeSpeed(1000), s3 = nudgeSpeed(1600), s4 = nudgeSpeed(60000);
  assert.equal(s0, ctx.NUDGE_SPEED_MIN);
  assert(s0 < s1 && s1 < s2 && s2 < s3, 'it only ever speeds up while held');
  assert.equal(s3, ctx.NUDGE_SPEED_MAX);
  assert.equal(s4, ctx.NUDGE_SPEED_MAX, 'and it tops out');
  assert.equal(nudgeSpeed(-50), ctx.NUDGE_SPEED_MIN, 'a clock that runs backwards is not a negative speed');
  assert.equal(nudgeSpeed(NaN), ctx.NUDGE_SPEED_MIN);
  // One second's hold at 60 frames: a few screens, not a few pixels and not the whole worksheet.
  let pos = 0;
  for (let t = 0; t < 1000; t += 1000 / 60) pos += nudgeSpeed(t) / 60;
  assert(pos > 500 && pos < 2500, 'one second of hold travelled ' + Math.round(pos) + 'px');
});

test('a step stops at the ends of the page', () => {
  assert.equal(nudgeClamp(-30, 900), 0);
  assert.equal(nudgeClamp(950, 900), 900);
  assert.equal(nudgeClamp(450, 900), 450);
  assert.equal(nudgeClamp(10, -5), 0, 'a page shorter than the screen has nowhere to go');
  assert.equal(nudgeClamp(NaN, 900), 0);
});

test('the glide eases out and lands exactly', () => {
  assert.equal(nudgeEase(0), 0);
  assert.equal(nudgeEase(1), 1);
  assert.equal(nudgeEase(3), 1, 'a late frame lands, it does not overshoot');
  assert.equal(nudgeEase(-1), 0);
  assert(nudgeEase(0.5) > 0.5, 'quick to leave, gentle to land');
  let last = -1;
  for (let t = 0; t <= 1; t += 0.05) { const v = nudgeEase(t); assert(v >= last); last = v; }
});

test('which ways the page can go, read off the scroller', () => {
  // scrollTop, scrollLeft, scrollHeight, scrollWidth, clientHeight, clientWidth
  const top = nudgeRoom(0, 0, 3000, 800, 700, 800);
  assert.deepEqual([top.up, top.down, top.left, top.right, top.wide], [false, true, false, false, false]);
  assert.equal(top.maxY, 2300);
  const bottom = nudgeRoom(2299.5, 0, 3000, 800, 700, 800);
  assert.equal(bottom.down, false, 'half a pixel short of the bottom is the bottom (fractional iPad scroll)');
  assert.equal(bottom.up, true);
  const zoomed = nudgeRoom(100, 0, 6000, 1600, 700, 800);
  assert.equal(zoomed.wide, true, '◀ ▶ appear once the page is wider than the screen');
  assert.equal(zoomed.left, false); assert.equal(zoomed.right, true);
  const mid = nudgeRoom(100, 400, 6000, 1600, 700, 800);
  assert.equal(mid.left, true); assert.equal(mid.right, true);
  const short = nudgeRoom(0, 0, 500, 800, 700, 800);
  assert.deepEqual([short.up, short.down, short.maxY], [false, false, 0]);
});

test('the buttons are in the toolbar, labelled, and the − + are hold-to-repeat too', () => {
  for (const [id, dir, label] of [['nudgeUpBtn', 'up', 'Scroll up'], ['nudgeDownBtn', 'down', 'Scroll down'],
                                  ['nudgeLeftBtn', 'left', 'Scroll left'], ['nudgeRightBtn', 'right', 'Scroll right'],
                                  ['zoomOutBtn', 'out', 'Zoom out'], ['zoomInBtn', 'in', 'Zoom in']]) {
    const re = new RegExp('<button class="toolBtn nudgeBtn" id="' + id + '" type="button" data-nudge="' + dir +
                          '" aria-label="' + label + '"');
    assert.match(html, re, id);
  }
  const bar = html.slice(html.indexOf('<div id="wsTop">'), html.indexOf('<div id="wsMain">'));
  assert(bar.includes('id="nudgeTools"'), 'the scroll buttons are in the worksheet toolbar');
  assert.match(html, /id="nudgeLeftBtn"[^>]*hidden/, '◀ starts hidden');
  assert.match(html, /id="nudgeRightBtn"[^>]*hidden/, '▶ starts hidden');
});

test('one tap zooms once — the old click listeners are gone', () => {
  assert.doesNotMatch(html, /\$\('zoomInBtn'\)\.addEventListener\('click'/);
  assert.doesNotMatch(html, /\$\('zoomOutBtn'\)\.addEventListener\('click'/);
  assert.match(html, /\nnudgeBind\(\);\n/, 'the buttons are wired once, at start-up');
  // A pointer's own click is ignored (pointerup acted); only the keyboard's click (detail 0) taps.
  assert.match(html, /if \(e\.detail === 0\) nudgeTap\(btn\.getAttribute\('data-nudge'\)\);/);
});

test('the toolbar zoom keeps the middle of the screen where it was', () => {
  const zb = html.slice(html.indexOf('function zoomBy(factor) {'), html.indexOf('function fitWidth() {'));
  assert.match(zb, /zoomAt\(r\.left \+ area\.clientWidth \/ 2, r\.top \+ area\.clientHeight \/ 2, factor\);/);
});

test('a hold stands down for a playing video solution, and a cancelled press is never a tap', () => {
  const blocked = html.slice(html.indexOf('function nudgeBlocked() {'), html.indexOf('function nudgeStopGlide() {'));
  assert.match(blocked, /lessonPlayback/); assert.match(blocked, /lessonOpening/);
  assert.match(html, /var wasTap = !nudge\.held && !cancelled;/);
  assert.match(html, /btn\.addEventListener\('pointercancel', function \(e\) \{ nudgeRelease\(e, true\); \}\);/);
  assert.match(html, /window\.addEventListener\('blur', function \(\) \{ nudgeRelease\(null, true\); \}\);/);
});

test('a zoom from anywhere updates ◀ ▶', () => {
  const as = html.slice(html.indexOf('function applyScale() {'), html.indexOf('function scheduleRaster() {'));
  assert.match(as, /nudgeSync\(\)/);
});
