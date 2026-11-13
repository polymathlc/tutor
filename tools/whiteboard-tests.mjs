// 🗒 The whiteboard (v1.89.0) — the pure half of whiteboard.js, and what
// index.html's glue must keep saying. The board on screen is driven in a
// real Chromium by tools/whiteboard-browser-check.mjs.
//
//   node --test tools/whiteboard-tests.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const W = require('../whiteboard.js');
const P = W.pure;
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const js = fs.readFileSync(new URL('../whiteboard.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../whiteboard.css', import.meta.url), 'utf8');
const glueStart = html.indexOf('🗒 THE WHITEBOARD — the glue (v1.89.0)');
const glueEnd = html.indexOf('/* ================= End 🗒 the whiteboard');
const glue = html.slice(glueStart, glueEnd);

/* ---------------- the one door a board comes in by ---------------- */
test('cleanBoard: a board from nowhere is an empty board with a name', () => {
  const b = P.cleanBoard(null, { now: 1000 });
  assert.equal(b.v, 1);
  assert.equal(b.title, 'My whiteboard');
  assert.deepEqual(b.items, []);
  assert.deepEqual(b.strokes, []);
  assert.deepEqual(b.view, { x: 0, y: 0, z: 1 });
  assert.equal(b.created, 1000);
});

test('cleanBoard: the view is clamped to 10%–400%', () => {
  assert.equal(P.cleanBoard({ view: { x: 1, y: 2, z: 99 } }).view.z, P.Z_MAX);
  assert.equal(P.cleanBoard({ view: { x: 1, y: 2, z: 0 } }).view.z, P.Z_MIN);
  assert.equal(P.cleanBoard({ view: { x: 'a', y: NaN, z: 'b' } }).view.x, 0);
});

test('cleanStroke: points are rounded to a tenth and bad points dropped', () => {
  const s = P.cleanStroke({ id: 's1', c: '#C62828', w: 3, p: [1.234, 2.345, NaN, 4, 5, 6, 'x'] });
  assert.deepEqual(s.p, [1.2, 2.3, 5, 6]);
  assert.equal(s.c, '#c62828');
  assert.equal(s.hl, 0);
});
test('cleanStroke: refuses a stroke with no point, and a colour that is not a colour', () => {
  assert.equal(P.cleanStroke({ p: [] }), null);
  assert.equal(P.cleanStroke({ p: [NaN, NaN] }), null);
  assert.equal(P.cleanStroke(null), null);
  assert.equal(P.cleanStroke({ p: [1, 2], c: 'red;background:url(x)' }).c, P.PALETTE[0]);
  assert.equal(P.cleanStroke({ p: [1, 2], hl: true, c: 'nope' }).c, P.HL_PALETTE[0]);
});
test('cleanStroke: a stroke is capped', () => {
  const p = Array.from({ length: P.PTS_MAX + 500 }, (_, i) => i);
  assert.equal(P.cleanStroke({ p }).p.length, P.PTS_MAX);
});

test('cleanItem: a picture needs somewhere to come from', () => {
  assert.equal(P.cleanItem({ t: 'img', x: 0, y: 0 }), null);
  assert.ok(P.cleanItem({ t: 'img', path: 'tutor-mistakes/u/boards/b/i.jpg' }));
  assert.ok(P.cleanItem({ t: 'img', src: 'data:image/jpeg;base64,AAAA' }));
});
test('cleanItem: only a data: picture or https may become an <img src>', () => {
  assert.equal(P.cleanItem({ t: 'img', src: 'javascript:alert(1)' }), null);
  assert.equal(P.cleanItem({ t: 'img', src: 'http://example.com/a.jpg' }), null);
  assert.equal(P.cleanItem({ t: 'img', src: 'data:text/html;base64,AAAA' }), null);
  assert.equal(P.cleanItem({ t: 'img', src: 'https://x.test/a.jpg" onerror="x' }), null);
  assert.equal(P.cleanItem({ t: 'img', src: 'blob:https://x/1' }), null, 'a blob: URL means nothing on another device');
  assert.ok(P.cleanItem({ t: 'img', src: 'blob:https://x/1' }, { allowBlob: true }));
});
test('cleanItem: a storage path is plain — no scheme, no "..", no leading slash', () => {
  assert.equal(P.cleanPath('../other/x.jpg'), '');
  assert.equal(P.cleanPath('/root.jpg'), '');
  assert.equal(P.cleanPath('https://x/y'), '');
  assert.equal(P.cleanPath('tutor-mistakes/u1/boards/b1/i1.jpg'), 'tutor-mistakes/u1/boards/b1/i1.jpg');
});
test('cleanItem: a note keeps its words and a known colour', () => {
  const n = P.cleanItem({ t: 'note', text: 'hi\u0000there', color: '#000000' });
  assert.equal(n.text, 'hithere');
  assert.equal(n.color, P.NOTE_COLORS[0]);
  assert.equal(P.cleanItem({ t: 'note', text: 'x'.repeat(9000) }).text.length, 4000);
});
test('cleanItem: a question card with nothing to ask is refused', () => {
  assert.equal(P.cleanItem({ t: 'q', text: '   ' }), null);
  assert.ok(P.cleanItem({ t: 'q', text: 'What is 3/4 of 20?' }));
  assert.ok(P.cleanItem({ t: 'q', mid: 'm1' }), 'the mistake book draws a card that names its mistake');
  const q = P.cleanItem({ t: 'q', text: 'Q', verdict: 'maybe', done: 'yes', shown: 0 });
  assert.equal(q.verdict, undefined);
  assert.equal(q.done, true);
  assert.equal(q.shown, false);
});
test('cleanItem: an unknown kind is not an item', () => {
  assert.equal(P.cleanItem({ t: 'script' }), null);
});

test('cleanBoard: two things sharing an id are both kept, under different ids', () => {
  const b = P.cleanBoard({ strokes: [{ id: 'a', p: [1, 1] }, { id: 'a', p: [2, 2] }], items: [{ t: 'note', id: 'a', text: 'x' }] });
  const ids = b.strokes.map(s => s.id).concat(b.items.map(i => i.id));
  assert.equal(new Set(ids).size, 3);
});
test('cleanBoard: the lists are capped', () => {
  const items = Array.from({ length: P.ITEMS_MAX + 20 }, (_, i) => ({ t: 'note', text: 'n' + i }));
  assert.equal(P.cleanBoard({ items }).items.length, P.ITEMS_MAX);
});

/* ---------------- what goes up to the cloud ---------------- */
test('forSave: an uploaded picture is named by PATH, never by its data: URL', () => {
  const b = P.forSave({ items: [
    { t: 'img', id: 'i1', path: 'tutor-mistakes/u/boards/b/i1.jpg', src: 'data:image/jpeg;base64,AAAA' },
    { t: 'img', id: 'i2', src: 'data:image/jpeg;base64,BBBB' },
    { t: 'img', id: 'i3', src: 'blob:https://x/1' }
  ] });
  assert.equal(b.items[0].src, undefined);
  assert.equal(b.items[0].path, 'tutor-mistakes/u/boards/b/i1.jpg');
  assert.equal(b.items[1].src, 'data:image/jpeg;base64,BBBB', 'a picture whose upload failed is still saved');
  assert.equal(b.items.length, 2, 'a blob: picture with no path never leaves the device');
});

test('summary counts what the list shows', () => {
  const s = P.summary({ items: [{ t: 'q', done: true }, { t: 'q' }, { t: 'img' }, { t: 'note' }], strokes: [{}, {}] });
  assert.deepEqual(s, { items: 4, pictures: 1, notes: 1, questions: 2, done: 1, strokes: 2 });
});

/* ---------------- strokes ---------------- */
test('simplify keeps the ends and the corners and drops the straight middle', () => {
  const line = []; for (let i = 0; i <= 100; i++) line.push(i, 0);
  assert.deepEqual(P.simplify(line, 0.5), [0, 0, 100, 0]);
  const corner = []; for (let i = 0; i <= 50; i++) corner.push(i, 0); for (let i = 1; i <= 50; i++) corner.push(50, i);
  assert.deepEqual(P.simplify(corner, 0.5), [0, 0, 50, 0, 50, 50]);
  assert.deepEqual(P.simplify([3, 4], 1), [3, 4]);
});
test('strokePath: a dot, a line and a curve', () => {
  assert.match(P.strokePath([5, 5]), /^M5 5l0\.01 0$/);
  assert.equal(P.strokePath([0, 0, 10, 10]), 'M0 0L10 10');
  assert.match(P.strokePath([0, 0, 10, 10, 20, 0, 30, 10]), /^M0 0Q10 10 15 5Q20 0 25 5L30 10$/);
  assert.equal(P.strokePath([]), '');
});
test('hitStroke measures the segments, not only the points', () => {
  const s = { p: [0, 0, 100, 0], w: 2 };
  assert.equal(P.hitStroke(s, 50, 3, 3), true, 'the middle of a two-point line is still the line');
  assert.equal(P.hitStroke(s, 50, 10, 3), false);
  assert.equal(P.hitStroke({ p: [5, 5], w: 2 }, 6, 6, 1), true);
});
test('hitStrokeAlong catches a stroke a fast swipe jumped over', () => {
  const s = { p: [50, -10, 50, 10], w: 2 };
  assert.equal(P.hitStroke(s, 0, 0, 3) || P.hitStroke(s, 100, 0, 3), false);
  assert.equal(P.hitStrokeAlong(s, 0, 0, 100, 0, 3), true);
});
test('moveStroke makes a NEW point list — undo snapshots share the old one', () => {
  const s = { id: 's', p: [1, 2, 3, 4], w: 2 };
  const m = P.moveStroke(s, 10, 20);
  assert.deepEqual(m.p, [11, 22, 13, 24]);
  assert.deepEqual(s.p, [1, 2, 3, 4]);
  assert.notEqual(m.p, s.p);
});
test('strokeInRect and the bounds', () => {
  const s = { p: [0, 0, 10, 10], w: 4 };
  assert.deepEqual(P.strokeBounds(s), { x0: -2, y0: -2, x1: 12, y1: 12 });
  assert.equal(P.strokeInRect(s, { x0: 5, y0: 5, x1: 20, y1: 20 }), true);
  assert.equal(P.strokeInRect(s, { x0: 20, y0: 20, x1: 30, y1: 30 }), false);
  assert.deepEqual(P.boardBounds({ items: [{ x: 100, y: 100, w: 10, h: 10 }], strokes: [s] }), { x0: -2, y0: -2, x1: 110, y1: 110 });
  assert.deepEqual(P.boardBounds({ items: [{ x: 100, y: 100, w: 10, h: 10 }], strokes: [s] }, { noInk: true }), { x0: 100, y0: 100, x1: 110, y1: 110 });
  assert.equal(P.boardBounds({ items: [], strokes: [] }), null);
});

/* ---------------- the view ---------------- */
test('toWorld and toScreen are inverses', () => {
  const v = { x: 30, y: -40, z: 1.7 };
  const w = P.toWorld(v, 200, 300), s = P.toScreen(v, w.x, w.y);
  assert.ok(Math.abs(s.x - 200) < 1e-9 && Math.abs(s.y - 300) < 1e-9);
});
test('zoomAt keeps the board under the pointer where it was', () => {
  const v = { x: 10, y: 20, z: 1 };
  const before = P.toWorld(v, 400, 300);
  const nv = P.zoomAt(v, 400, 300, 2);
  const after = P.toWorld(nv, 400, 300);
  assert.equal(nv.z, 2);
  assert.ok(Math.abs(before.x - after.x) < 1e-9 && Math.abs(before.y - after.y) < 1e-9);
  assert.equal(P.zoomAt(v, 0, 0, 1000).z, P.Z_MAX);
});
test('fitView shows the whole board, never closer than 100%', () => {
  const v = P.fitView({ x0: 0, y0: 0, x1: 2000, y1: 1000 }, 1000, 600, 40);
  const a = P.toScreen(v, 0, 0), c = P.toScreen(v, 2000, 1000);
  assert.ok(a.x >= 39 && c.x <= 961 && a.y >= 0 && c.y <= 600);
  assert.equal(P.fitView({ x0: 0, y0: 0, x1: 10, y1: 10 }, 1000, 600, 40).z, 1);
  assert.deepEqual(P.fitView(null, 1000, 600), { x: 500, y: 200, z: 1 });
});

/* ---------------- where new things go ---------------- */
test('freeSpot never drops a thing exactly on top of another', () => {
  const board = { items: [{ x: 0, y: 0, w: 200, h: 200 }] };
  const s = P.freeSpot(board, 0, 0, 200, 200);
  assert.ok(!P.rectsMeet({ x0: s.x, y0: s.y, x1: s.x + 200, y1: s.y + 200 }, { x0: 0, y0: 0, x1: 200, y1: 200 }));
  assert.deepEqual(P.freeSpot({ items: [] }, 5, 6, 10, 10), { x: 5, y: 6 });
});
test('placeBatch lays a batch out to the RIGHT of the board, in columns', () => {
  const board = { items: [{ x: 0, y: 50, w: 300, h: 100 }], strokes: [] };
  const spots = P.placeBatch(board, [{ w: 100, h: 100 }, { w: 100, h: 120 }, { w: 100, h: 100 }], { cols: 2, gap: 10 });
  assert.equal(spots[0].x, 380); assert.equal(spots[0].y, 50);
  assert.equal(spots[1].x, 490); assert.equal(spots[1].y, 50);
  assert.equal(spots[2].x, 380); assert.equal(spots[2].y, 180);
  assert.deepEqual(P.placeBatch({ items: [], strokes: [] }, [{ w: 1, h: 1 }])[0], { x: 0, y: 0 });
});
test('fitImageSize keeps the shape and the width in bounds', () => {
  assert.deepEqual(P.fitImageSize(400, 300, 560), { w: 400, h: 300 });
  assert.deepEqual(P.fitImageSize(1120, 600, 560), { w: 560, h: 300 });
});

/* ---------------- undo ---------------- */
test('History: undo, redo, and a new step clears the redo', () => {
  const h = new P.History(3);
  h.push('a'); h.push('b');
  assert.equal(h.undo('c'), 'b');
  assert.equal(h.redo('b'), 'c');
  h.push('d');
  assert.equal(h.canRedo(), false);
  h.push('e'); h.push('f'); h.push('g');
  assert.equal(h.undos.length, 3, 'capped');
});
test('snapshot copies every object and shares the heavy parts', () => {
  const pts = [1, 2, 3, 4];
  const b = { items: [{ id: 'i', t: 'img', src: 'data:image/png;base64,AAAA' }], strokes: [{ id: 's', p: pts }] };
  const s = P.snapshot(b);
  assert.notEqual(s.items[0], b.items[0]);
  assert.equal(s.strokes[0].p, pts, 'the point list is shared — which is why nothing may change it in place');
});

/* ---------------- the list ---------------- */
test('the list: newest first, one line a board, a thumbnail kept across saves', () => {
  let list = P.indexUpsert([], P.indexEntry({ id: 'b1', title: 'One', updated: 10, items: [{ t: 'q', done: true }, { t: 'img' }], strokes: [] }, { thumb: 'tutor-mistakes/u/boards/b1.thumb.jpg', thumbAt: 10 }));
  list = P.indexUpsert(list, P.indexEntry({ id: 'b2', title: 'Two', updated: 20, items: [], strokes: [] }));
  assert.deepEqual(list.map(e => e.id), ['b2', 'b1']);
  assert.equal(list[1].q, 1); assert.equal(list[1].d, 1); assert.equal(list[1].p, 1);
  list = P.indexUpsert(list, P.indexEntry({ id: 'b1', title: 'One again', updated: 30, items: [], strokes: [] }));
  assert.equal(list[0].id, 'b1');
  assert.equal(list[0].thumb, 'tutor-mistakes/u/boards/b1.thumb.jpg', 'a save with no new picture keeps the old one');
  assert.equal(list.length, 2);
  assert.deepEqual(P.indexRemove(list, 'b1').map(e => e.id), ['b2']);
});
test('the list file is read through the same door', () => {
  const l = P.cleanIndex({ boards: [{ id: 'ok', title: ' A  b ', updated: 1, thumb: '../x' }, { id: 'bad id!' }, null, { id: 'ok', updated: 0 }] });
  assert.equal(l.length, 1);
  assert.equal(l[0].title, 'A b');
  assert.equal(l[0].thumb, undefined);
  assert.deepEqual(P.cleanIndex(null), []);
});
test('wrapLines wraps to a width and caps the lines', () => {
  const m = s => s.length * 10;
  assert.deepEqual(P.wrapLines('aa bb cc', 50, m), ['aa bb', 'cc']);
  assert.deepEqual(P.wrapLines('a\n\nb', 50, m), ['a', '', 'b']);
  assert.equal(P.wrapLines('a b c d e f', 10, m, 2)[1], 'b …');
});
test('a new board is named for the day', () => {
  assert.match(P.defaultTitle(Date.UTC(2026, 10, 13, 6)), /^Whiteboard · 13 Nov$/);
  const b = P.newBoard('', { now: 5, who: 'Mia' });
  assert.equal(b.who, 'Mia');
  assert.equal(b.title, 'My whiteboard');
});

/* ---------------- what the source must keep saying ---------------- */
test('the file knows nothing of Firebase, the mistake book or an AI call', () => {
  assert.ok(!/firebase|firestore|storage\.ref|askGemini|fetch\(/i.test(js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')));
});
test('the ink is its own layer, and 👁 Workings hides that layer alone', () => {
  assert.match(css, /\.wbInkOff \.wbInk \{ visibility: hidden; \}/);
  assert.ok(!/\.wbInkOff \.wbItems/.test(css), 'the pictures and cards stay when the workings go');
});
test('index.html loads the board and keeps its ?v= on APP_VERSION', () => {
  const ver = /var APP_VERSION = 'v([\d.]+)'/.exec(html)[1];
  assert.ok(html.includes('<script src="whiteboard.js?v=' + ver + '"></script>'));
  assert.ok(html.includes('<link rel="stylesheet" href="whiteboard.css?v=' + ver + '">'));
});
test('the glue saves boards in the student\'s own folder, which the rules already allow', () => {
  assert.ok(glueStart > 0 && glueEnd > glueStart);
  assert.match(glue, /function wbDir\(uid\) \{ return MISTAKE_DIR \+ '\/' \+/);
  assert.ok(!/collection\(/.test(glue), 'no Firestore collection the rules have never heard of');
});
test('the glue uploads pictures FIRST and never saves a data: picture that has a path', () => {
  const save = glue.slice(glue.indexOf('async function wbSaveNow'), glue.indexOf('/* ---- The board, full screen'));
  assert.ok(save.indexOf('wbUploadPic(') < save.indexOf('wbWriteJson(wbBodyPath('), 'pictures before the board');
  assert.match(save, /Whiteboard\.pure\.forSave\(b\)/);
  assert.match(save, /if \(wb\.saving\) \{ wb\.again = true; return wb\.saving; \}/, 'one save at a time');
});
test('the glue reads the list fresh before it writes it', () => {
  const ch = glue.slice(glue.indexOf('async function wbIndexChange'), glue.indexOf('/* ---- The draft'));
  assert.ok(ch.indexOf('wbReadJson(') < ch.indexOf('wbWriteJson('));
});
test('the glue only ever deletes inside the student\'s own boards folder', () => {
  assert.match(glue, /async function wbDeletePath\(path\) \{\n  if \(!path \|\| !wbIsMine\(path\)\) return;/);
  assert.ok(!/storage\.ref\([^)]*\)\.delete\(\)/.test(glue.replace(/async function wbDeletePath[\s\S]*?\n\}/, '')));
});
test('👁 Workings on the worksheet hides the overlay, deletes nothing, and a new worksheet resets it', () => {
  assert.match(html, /body\.wsInkHidden \.pageWrap > svg\.overlay,/);
  const set = glue.slice(glue.indexOf('function wsInkSet'), glue.indexOf('/* ---- Accounts'));
  assert.ok(!/annotations\s*=/.test(set) && !/pushUndo|scheduleAutoSave/.test(set), 'hiding is a look, never an edit');
  assert.match(html, /if \(typeof wsInkSet === 'function' && wsInkHidden\) wsInkSet\(false\);/);
});
test('📸 a cut is drawn WITH the ink only when asked', () => {
  const r = glue.slice(glue.indexOf('async function wbRenderPage'), glue.indexOf('function wbCutFrom'));
  assert.match(r, /if \(withInk\) \{[\s\S]*drawAnnsOnCtx\(/);
  assert.match(glue, /ink: !wsInkHidden/, 'the box starts on what the page shows');
});
test('every canvas the cut makes is given back', () => {
  const c = glue.slice(glue.indexOf('async function wbCapture'), glue.indexOf('var wbSnipUi'));
  assert.match(c, /finally \{\n    cuts\.forEach\(function \(c\) \{ c\.width = 0; c\.height = 0; \}\);/);
  assert.match(c, /full\.width = 0; full\.height = 0;/);
});
test('the usage events the glue raises all have words', () => {
  const raised = [...glue.matchAll(/usageNote\('(\w+)'/g)].map(m => m[1]).concat([...glue.matchAll(/, '(board\w*)'\);/g)].map(m => m[1]));
  for (const k of new Set(raised)) assert.match(html, new RegExp('\\n  ' + k + ':\\s+\\{ label: '), k);
});
test('an account change drops the last account\'s boards', () => {
  assert.match(html, /if \(typeof wbAuthChanged === 'function'\) wbAuthChanged\(\);/);
  const a = glue.slice(glue.indexOf('function wbAuthChanged'), glue.indexOf('function wbBind'));
  assert.match(a, /wb\.list = null;/);
  assert.match(a, /wb\.inst\.load\(Whiteboard\.pure\.newBoard\(''\)\)/);
});
test('the board view is one of the views, and leaving it saves', () => {
  assert.match(html, /\['home', 'ws', 'mistake', 'board'\]\.forEach/);
  assert.match(html, /if \(v !== 'board' && typeof wbLeaveView === 'function'\) wbLeaveView\(\);/);
});
test('the editor sits under every dialog, so ▶ Practise and the pickers open over it', () => {
  const z = Number(/#wbEditor \{\n    position: fixed; inset: 0; z-index: (\d+)/.exec(html)[1]);
  assert.ok(z < 200, 'below .modalBack (200)');
});
test('Ctrl+Z on the whiteboard never undoes the worksheet loaded behind it', () => {
  assert.match(html, /if \(view === 'board' && \(e\.ctrlKey \|\| e\.metaKey\) && \/\^\[zys\]\$\/i\.test\(e\.key\)\) \{/);
});
