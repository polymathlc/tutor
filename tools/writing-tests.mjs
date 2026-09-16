import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Exercise the real SVG renderer and the capture/overlay event handlers.
// Synthetic events verify event ordering and DOM work, not Apple Pencil feel.
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
function section(start, end) {
  const a = html.indexOf(start), b = html.indexOf(end, a + start.length);
  assert(a >= 0 && b > a, start);
  return html.slice(a, b);
}
const source = [
  section('/* Unrotated frame of an x/y/w/h annotation.', '/* ================= Undo / redo'),
  section('function renderOverlay(p) {', '/* ================= Flattening a page'),
  section('function drawAnnsOnCtx(ctx, kx, ky, anns, pageNum)', '/* The whole page, with every annotation'),
  section('function eventPoint(e, p, rect)', 'function setTool(t)'),
  section('var stylusOnly = (function () {', 'function translateAnn(a, dx, dy)'),
  section('function translateAnn(a, dx, dy)', '\n\n\n/* ====================================================================='),
].join('\n');

function setup(savedMode) {
  const frames = new Map(), store = new Map(), metrics = { nodes: 0, rects: 0, writes: 0 };
  let frameId = 0, clock = 1000, annId = 0;
  if (savedMode !== undefined) store.set('tutorStylusOnly', savedMode ? '1' : '0');
  class Node {
    constructor(tag) { this.tagName = tag; this.children = []; this.attrs = {}; this.listeners = {}; this.style = {}; this.captures = new Set(); metrics.nodes++; }
    get firstChild() { return this.children[0] || null; }
    appendChild(n) { if (n.parentNode) n.parentNode.removeChild(n); this.children.push(n); n.parentNode = this; return n; }
    removeChild(n) { this.children.splice(this.children.indexOf(n), 1); n.parentNode = null; }
    replaceChild(n, old) { const i = this.children.indexOf(old); assert(i >= 0); this.children[i] = n; old.parentNode = null; n.parentNode = this; }
    remove() { this.parentNode?.removeChild(this); }
    setAttribute(k, v) { this.attrs[k] = String(v); metrics.writes++; }
    getAttribute(k) { return this.attrs[k] ?? null; }
    querySelector(sel) {
      const id = /data-id="([^"]+)"/.exec(sel)?.[1];
      return this.children.find(n => id && n.attrs['data-id'] === id) || null;
    }
    closest(sel) { return sel === 'svg.overlay' ? this : null; }
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
    setPointerCapture(id) { this.captures.add(id); }
    hasPointerCapture(id) { return this.captures.has(id); }
    releasePointerCapture(id) { this.captures.delete(id); }
    getBoundingClientRect() { metrics.rects++; return { left: 0, top: 0, width: 600, height: 800 }; }
    getBBox() { return { x: 0, y: 0, width: 10, height: 10 }; }
  }
  const area = new Node('area'), svg = new Node('svg'), doc = new Node('document'), win = new Node('window');
  area.scrollLeft = 200; area.scrollTop = 200;
  const p = { num: 1, svg, baseW: 600, baseH: 800 };
  const S = {
    console, Map, Set, JSON, Math, Number, Array, Object, performance: { now: () => clock },
    document: doc, window: win,
    localStorage: { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) },
    $: id => id === 'viewerArea' ? area : null,
    el: (tag, attrs = {}) => { const n = new Node(tag); Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v)); return n; },
    requestAnimationFrame: fn => { frames.set(++frameId, fn); return frameId; },
    cancelAnimationFrame: id => frames.delete(id),
    pages: [p], annotations: [], undoStack: [], redoStack: [], selectedId: null, editingId: null,
    tool: 'pen', color: '#000', strokeW: 3, lineHeads: 'single', lineDash: 'solid', scale: 1,
    newAnnId: () => 'test-' + (++annId), round2: x => Math.round(x * 100) / 100,
    highlightWidthFor: x => x * 4,
    renderPinsOn: () => {}, renderMarksOn: () => {}, commitActiveTextEdit: () => {},
    scheduleRaster: () => {}, applyScale: () => {}, toast: () => {},
    askHintAt: () => S.hints++, startVoice: () => S.voices++, startTextBox: () => S.texts++,
    hints: 0, voices: 0, texts: 0, dirtyCalls: 0,
    setDirty: () => S.dirtyCalls++, snapshot: () => JSON.stringify(S.annotations),
    pushUndo: str => { S.undoStack.push(str); S.redoStack = []; },
    undo: () => S.undos++, redo: () => S.redos++, undos: 0, redos: 0,
    eraseAlong: () => {}, renderAllOverlays: () => S.renderOverlay(p),
  };
  vm.createContext(S); vm.runInContext(source, S);
  S.navBind(); S.attachOverlayHandlers(p);
  const emit = (node, type, event) => {
    event.currentTarget = node;
    for (const fn of node.listeners[type] || []) fn(event);
  };
  function pointer(type, opts = {}) {
    const e = { type, pointerType: 'pen', pointerId: 1, isPrimary: true, button: 0,
      clientX: 10, clientY: 10, width: 1, height: 1, timeStamp: clock, target: svg,
      preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.stopped = true; }, ...opts };
    if (type === 'pointerup' || type === 'pointercancel') emit(doc, type, e);
    else if (type === 'pointerdown' || type === 'pointermove') emit(area, type, e);
    if (!e.stopped) emit(svg, type, e);
    return e;
  }
  function touches(type, count, opts = {}) {
    const list = Array.from({ length: count }, (_, i) => ({ identifier: i + 50, clientX: i * 40, clientY: 10, radiusX: 10, radiusY: 10, ...opts }));
    emit(area, type, { type, timeStamp: clock, touches: type === 'touchend' ? [] : list,
      changedTouches: list, preventDefault() {} });
  }
  return { S, p, svg, area, doc, win, frames, metrics, store, pointer, touches, emit,
    time: ms => { clock = ms; },
    flush: () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn(clock)); } };
}

test('coalesced ink keeps every bend and the final up sample; one paint per frame', () => {
  const h = setup();
  // A heavily annotated page must retain every saved SVG node while writing.
  h.S.annotations = Array.from({ length: 1000 }, (_, i) => ({ id: 'saved-' + i, page: 1, type: 'pen', color: '#000', width: 3, points: [{ x: i, y: 0 }, { x: i, y: 1 }] }));
  h.S.renderOverlay(h.p);
  const saved = h.svg.children.slice(), nodesBefore = h.metrics.nodes;
  h.pointer('pointerdown');
  const rectsBefore = h.metrics.rects;
  for (let n = 1; n <= 100; n++) h.pointer('pointermove', { clientX: n + 10, clientY: 10, getCoalescedEvents: () => [{ clientX: n + 9.5, clientY: 12 }, { clientX: n + 10, clientY: 10 }] });
  assert.equal(h.frames.size, 1);
  assert.equal(h.metrics.rects - rectsBefore, 100, 'one geometry read per batch');
  assert.equal(h.metrics.nodes - nodesBefore, 2, 'only the active group/path is created');
  const a = h.S.drawing.ann;
  assert.equal(a.points.length, 201);
  h.flush();
  h.pointer('pointerup', { clientX: 125, clientY: 22 });
  assert.deepEqual({ ...a.points.at(-1) }, { x: 125, y: 22 });
  assert.match(h.svg.children.at(-1).firstChild.attrs.d, / L 125 22$/);
  assert.equal(h.frames.size, 0); assert.equal(h.S.undoStack.length, 1);
  assert.equal(h.S.dirtyCalls, 1);
  saved.forEach((node, i) => assert.equal(h.svg.children[i], node));
});

test('a synchronous pointerup flushes queued ink without needing a frame', () => {
  const h = setup(); h.pointer('pointerdown'); h.pointer('pointermove', { clientX: 30 });
  h.pointer('pointerup', { clientX: 40 });
  assert.match(h.svg.firstChild.firstChild.attrs.d, / L 40 10$/);
  assert.equal(h.frames.size, 0); h.flush(); assert.equal(h.svg.children.length, 1);
});

test('a pen tap produces a visible decimal point and one undo entry', () => {
  const h = setup(); h.pointer('pointerdown'); h.pointer('pointerup');
  const points = h.S.annotations[0].points;
  assert.equal(points.length, 2);
  assert(points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)));
  assert(Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y) < 0.02);
  assert.equal(h.svg.firstChild.firstChild.attrs.d, 'M 10 10 L 10.01 10');
  assert.equal(h.S.undoStack.length, 1); assert.equal(h.S.dirtyCalls, 1);
  const calls = [];
  h.S.drawAnnsOnCtx({ save() {}, restore() {}, beginPath() {},
    moveTo: (x, y) => calls.push(['move', x, y]), lineTo: (x, y) => calls.push(['line', x, y]),
    stroke: () => calls.push(['stroke']) }, 2, 2, h.S.annotations, 1);
  assert.deepEqual(calls, [['move', 20, 20], ['line', 20.02, 20], ['stroke']], 'the AI/export canvas receives a drawable dot too');
});

test('overlay refresh during a stroke reacquires its node and does not lose ink', () => {
  const h = setup(); h.pointer('pointerdown');
  const old = h.S.drawing.node;
  h.pointer('pointermove', { clientX: 30 }); h.S.renderOverlay(h.p);
  assert.equal(old.parentNode, null); h.flush();
  assert.equal(h.S.drawing.node, h.svg.firstChild);
  h.pointer('pointermove', { clientX: 50 }); h.pointer('pointerup', { clientX: 60 });
  assert.match(h.svg.firstChild.firstChild.attrs.d, / L 60 10$/);
});

test('history or a worksheet replacement cannot repaint a removed annotation', () => {
  const h = setup(); h.pointer('pointerdown'); h.pointer('pointermove', { clientX: 30 });
  h.S.annotations = []; h.S.renderOverlay(h.p); h.flush();
  assert.equal(h.svg.children.length, 0);
  h.S.resetPointerInput(); assert.equal(h.S.drawing, null); assert.equal(h.frames.size, 0);
});

for (const type of ['pointercancel', 'lostpointercapture']) test(type + ' commits existing ink once without adding synthetic coordinates', () => {
  const h = setup(); h.pointer('pointerdown'); h.pointer('pointermove', { clientX: 30 });
  h.pointer(type, { clientX: 0, clientY: 0 });
  assert.equal(h.S.annotations[0].points.length, 2);
  assert.match(h.svg.firstChild.firstChild.attrs.d, / L 30 10$/);
  assert.equal(h.S.undoStack.length, 1); assert.equal(h.S.activePointerId, null);
  h.pointer('pointerup', { clientX: 100 }); assert.equal(h.S.undoStack.length, 1);
});

test('leaving an SVG while capture is held does not cut a pen stroke', () => {
  const h = setup(); h.pointer('pointerdown'); h.pointer('pointerleave');
  assert(h.S.drawing); h.pointer('pointermove', { clientX: 30 });
  h.pointer('pointerup', { clientX: 40 }); assert.equal(h.S.undoStack.length, 1);
});

test('a late up from an older pen cannot end the new pen stroke', () => {
  const h = setup(); h.pointer('pointerdown'); h.pointer('lostpointercapture');
  h.pointer('pointerdown', { pointerId: 2 }); h.pointer('pointerup', { pointerId: 1 });
  assert.equal(h.S.activePointerId, 2); assert(h.S.drawing);
});

test('pen-first: a small or unknown palm cannot navigate, draw or end the pen', () => {
  const h = setup(); h.pointer('pointerdown');
  h.pointer('pointerdown', { pointerType: 'touch', pointerId: 7 });
  h.pointer('pointermove', { pointerType: 'touch', pointerId: 7, clientY: 90 });
  h.pointer('pointerup', { pointerType: 'touch', pointerId: 7 });
  assert.equal(h.area.scrollTop, 200); assert.equal(h.S.nav.pts.size, 0);
  assert.equal(h.S.activePointerId, 1); assert.equal(h.S.annotations.length, 1);
});

test('touch-first: pen stops an existing pan and pending momentum/zoom', () => {
  const h = setup();
  h.pointer('pointerdown', { pointerType: 'touch', pointerId: 7 });
  h.pointer('pointermove', { pointerType: 'touch', pointerId: 7, clientY: 20 });
  assert.equal(h.S.nav.mode, 'pan');
  h.S.navZoom.ratio = 1.2; h.S.scheduleNavZoom();
  h.S.navMomentum = h.S.requestAnimationFrame(() => { throw Error('stale momentum'); });
  h.pointer('pointerdown'); const y = h.area.scrollTop;
  h.pointer('pointermove', { pointerType: 'touch', pointerId: 7, clientY: 80 });
  h.flush(); assert.equal(h.area.scrollTop, y); assert.equal(h.S.nav.mode, null);
  assert.equal(h.S.navZoom.ratio, 1); assert.equal(h.S.navMomentum, null);
});

test('first pen takes over a young touch stroke when finger drawing was enabled', () => {
  const h = setup(false);
  h.pointer('pointerdown', { pointerType: 'touch', pointerId: 7 });
  h.time(1010); h.pointer('pointerdown');
  assert.equal(h.S.activePointerId, 1); assert.equal(h.S.drawing.ptrType, 'pen');
  assert.equal(h.S.annotations.length, 1); assert.equal(h.S.stylusOnly, true);
  assert.equal(h.store.get('tutorStylusOnly'), '1');
});

test('resting contact stays rejected after pen-up until lift; fresh fingers can scroll', () => {
  const h = setup(); h.pointer('pointerdown');
  h.pointer('pointerdown', { pointerType: 'touch', pointerId: 7 }); h.pointer('pointerup');
  h.time(2000);
  h.pointer('pointermove', { pointerType: 'touch', pointerId: 7, clientY: 90 });
  assert.equal(h.area.scrollTop, 200);
  h.pointer('pointerup', { pointerType: 'touch', pointerId: 7 });
  h.pointer('pointerdown', { pointerType: 'touch', pointerId: 7 });
  h.pointer('pointermove', { pointerType: 'touch', pointerId: 7, clientY: 30 });
  assert.equal(h.area.scrollTop, 180);
});

test('the short pen-up guard rejects new palm contacts between letters', () => {
  const h = setup(); h.pointer('pointerdown'); h.pointer('pointerup');
  h.time(1100); h.pointer('pointerdown', { pointerType: 'touch', pointerId: 7 });
  assert.equal(h.S.nav.mode, null); assert(h.S.rejectedTouches.has(7));
});

test('growing touch patch cancels navigation before the palm moves the page', () => {
  const h = setup(); h.pointer('pointerdown', { pointerType: 'touch', pointerId: 7, width: 30 });
  h.pointer('pointermove', { pointerType: 'touch', pointerId: 7, width: 80, clientY: 90 });
  assert.equal(h.area.scrollTop, 200); assert.equal(h.S.nav.mode, null);
  assert.equal(h.S.nav.pts.size, 0);
});

test('a growing palm removes its accidental ink, and rolls back an unfinished erase', () => {
  const h = setup(false); h.pointer('pointerdown', { pointerType: 'touch', pointerId: 7 });
  h.pointer('pointermove', { pointerType: 'touch', pointerId: 7, width: 80, clientY: 90 });
  assert.equal(h.S.annotations.length, 0); assert.equal(h.S.undoStack.length, 0);
  const saved = { id: 'saved', page: 1, type: 'pen', points: [{ x: 1, y: 1 }] };
  h.S.annotations = [saved]; h.S.tool = 'eraser';
  h.S.eraseAlong = () => { h.S.annotations = []; h.S.erasing.removed = true; };
  h.pointer('pointerdown', { pointerType: 'touch', pointerId: 9 });
  assert.equal(h.S.annotations.length, 0);
  h.pointer('pointermove', { pointerType: 'touch', pointerId: 9, width: 80 });
  assert.equal(h.S.annotations[0].id, 'saved'); assert.equal(h.S.erasing, null);
});

test('large palms cannot start hint, voice, selection or text actions', () => {
  for (const tool of ['hint', 'speak', 'select', 'text']) {
    const h = setup(); h.S.tool = tool;
    const e = h.pointer('pointerdown', { pointerType: 'touch', pointerId: 7, width: 80 });
    assert(e.defaultPrevented); assert(e.stopped);
    assert.equal(h.S.hints + h.S.voices + h.S.texts, 0); assert.equal(h.S.activePointerId, null);
  }
});

test('deliberate two-finger double-tap still undoes, but palm taps during writing do not', () => {
  const h = setup(); h.S.undoStack.push('[]');
  h.touches('touchstart', 2); h.time(1050); h.touches('touchend', 2);
  h.time(1200); h.touches('touchstart', 2); h.time(1250); h.touches('touchend', 2);
  assert.equal(h.S.undos, 1);
  h.pointer('pointerdown');
  for (const t of [1300, 1400]) { h.time(t); h.touches('touchstart', 2); h.time(t + 40); h.touches('touchend', 2); }
  h.pointer('pointerup'); h.time(3000); h.touches('touchend', 2);
  assert.equal(h.S.undos, 1);
});

test('touchcancel does not turn a later tap into undo or launch scroll momentum', () => {
  const h = setup(); h.S.undoStack.push('[]');
  h.touches('touchstart', 2); h.time(1050); h.touches('touchend', 2);
  h.emit(h.area, 'touchcancel', {});
  h.time(1200); h.touches('touchstart', 2); h.time(1250); h.touches('touchend', 2);
  assert.equal(h.S.undos, 0);
  h.pointer('pointerdown', { pointerType: 'touch', pointerId: 7 });
  h.pointer('pointermove', { pointerType: 'touch', pointerId: 7, clientY: 50 });
  h.pointer('pointercancel', { pointerType: 'touch', pointerId: 7 });
  assert.equal(h.S.navMomentum, null);
});

test('a fresh down can reuse an ID whose previous rejected contact never ended', () => {
  const h = setup(); h.pointer('pointerdown');
  h.pointer('pointerdown', { pointerType: 'touch', pointerId: 7 }); h.pointer('pointerup');
  h.time(2000); h.pointer('pointerdown', { pointerType: 'touch', pointerId: 7 });
  assert.equal(h.S.nav.mode, 'pan'); assert.equal(h.S.rejectedTouches.has(7), false);
});

test('blur commits current ink once, cancels frames and clears navigation and pen state', () => {
  const h = setup(); h.pointer('pointerdown'); h.pointer('pointermove', { clientX: 40 });
  h.emit(h.win, 'blur', {});
  assert.equal(h.S.drawing, null); assert.equal(h.S.activePointerId, null);
  assert.equal(h.S.penPointerId, null); assert.equal(h.S.nav.pts.size, 0);
  assert.equal(h.frames.size, 0); assert.equal(h.S.undoStack.length, 1);
  h.pointer('pointerup'); assert.equal(h.S.undoStack.length, 1);
});
