/* Synthetic PDFs and model classifications only. No student files or model calls. */
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
function cut(a, b) {
  const start = html.indexOf(a), end = html.indexOf(b, start + a.length);
  assert.ok(start >= 0 && end > start, a);
  return html.slice(start, end);
}
const src = cut('var KEY_SCAN_VERSION =', '/* =====================================================================\n   THE STUDY BUDDY');
const deadlines = cut('/* ================= AI request deadlines ================= */', '/* ================= End AI request deadlines ================= */');
const body = cut('function worksheetBody()', 'function bodyByteLength(');
const restore = cut('function applyWorksheetBody(', '/* 📄 THE ONE PLACE THE OPEN PAPER');
const flush = async () => { for (let i = 0; i < 80; i++) await Promise.resolve(); };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const plain = x => JSON.parse(JSON.stringify(x));
function harness(count = 10, kinds = {}, options = {}) {
  const calls = [], renders = [], saved = [], dom = new Map();
  const node = () => ({ style: {}, classList: { toggle() {}, add() {}, remove() {} }, setAttribute() {}, appendChild() {}, addEventListener() {} });
  dom.set('keyChip', node());
  dom.set('viewerArea', { ...node(), insertBefore(n) { dom.set(n.id, n); } });
  const c = vm.createContext({ console, AbortController, Promise, Set, Number, JSON, Error,
    setTimeout: (fn, ms) => setTimeout(fn, ms === 150 ? 0 : ms), clearTimeout,
    window: {}, document: { hidden: false, addEventListener() {}, createElement(kind) {
      if (kind !== 'canvas') return node();
      return { width: 600, height: 800, getContext: () => ({}), toDataURL: () => 'data:image/jpeg;base64,c3ludGhldGlj' };
    } }, $: id => dom.get(id), view: 'ws', currentUser: { uid: 'fixture-user' }, wsEpoch: 1,
    annotations: [], hints: [], marking: { items: [] }, chat: [], wsMeta: {}, pages: [],
    pdfDoc: { async getPage(n) { return {
      getViewport: ({ scale }) => ({ width: 600 * scale, height: 800 * scale }),
      render() { renders.push(n); return { promise: options.render ? options.render(n) : Promise.resolve(), cancel() {} }; }
    }; } },
    aiAvailable: () => true, _parseAIJson: JSON.parse, toast() {}, scheduleRaster() {}, tutorFocusSync() {},
    releasePageCanvas(p) { p.canvas.width = 0; }, renderAllOverlays() {}, renderKeyModal() {},
    setDirty() { saved.push(plain(c.wsKey)); }
  });
  vm.runInContext(deadlines + '\n' + src + '\n' + body + '\n' + restore, c);
  c.pages = Array.from({ length: count }, (_, i) => ({ num: i + 1, wrap: node(), canvas: { width: 600 },
    page: { getTextContent: async () => ({ items: [] }) } }));
  c.keyReset();
  c.keyRefreshRows = async () => {};
  c.window.askGemini = async (prompt, opts) => {
    const n = Number(prompt.match(/page (\d+)/)[1]); calls.push({ n, opts });
    const value = options.classify ? await options.classify(n, calls.length) : (kinds[n] || 'question');
    return JSON.stringify(typeof value === 'string' ? { kind: value, confidence: 0.98 } : value);
  };
  return { c, calls, renders, saved, dom };
}

test('starts at the real last page and crosses blank footer plus known key before headingless solutions', async () => {
  const h = harness(10, { 10: 'blank', 9: 'key', 7: 'key', 6: 'key' });
  h.c.wsKey.pages = [8]; h.c.wsKey.scanned = true; // pre-migration partial result
  await h.c.keyAutoScan(true);
  assert.deepEqual(h.calls.map(x => x.n), [10, 9, 7, 6, 5]);
  assert.deepEqual(plain(h.c.wsKey.pages), [6, 7, 8, 9]);
  assert.equal(h.c.wsKey.scanPending, false);
  assert.deepEqual(plain(h.c.studentPages().map(p => p.num)), [1, 2, 3, 4, 5, 10]);
  assert.match(h.calls[0].opts.system, /WITHOUT an Answer Key heading/);
  assert.match(h.calls[0].opts.system, /Student handwriting/);
});

test('highest known tail page cannot skip later worked-solution pages', async () => {
  const h = harness(12, { 12: 'key', 11: 'key', 10: 'key', 8: 'key', 7: 'key' });
  h.c.wsKey.pages = [9];
  await h.c.keyAutoScan(true);
  assert.deepEqual(h.calls.map(x => x.n), [12, 11, 10, 8, 7, 6]);
  assert.deepEqual(plain(h.c.wsKey.pages), [7, 8, 9, 10, 11, 12]);
});

test('unknown tail is hidden from DOM, live page selection and export until classification finishes', async () => {
  const gate = deferred(), h = harness(3, {}, { classify: async n => n === 3 ? gate.promise : 'question' });
  const pending = h.c.keyAutoScan(true); await flush();
  assert.equal(h.c.studentPages().length, 0);
  assert.ok(h.c.pages.every(p => p.wrap.style.display === 'none'));
  assert.equal(h.dom.get('keyScanStatus').hidden, false);
  gate.resolve('key'); await pending;
  assert.deepEqual(plain(h.c.studentPages().map(p => p.num)), [1, 2]);
  assert.equal(h.c.pages[2].wrap.style.display, 'none');
});

test('uncertain, low-confidence question and provider failures get only two tries and keep tail held', async () => {
  for (const answer of ['uncertain', { kind: 'question', confidence: 0.5 }, 'failure']) {
    const h = harness(4, {}, { classify: () => { if (answer === 'failure') throw Error('fixture offline'); return answer; } });
    await h.c.keyAutoScan(true);
    assert.equal(h.calls.length, 2);
    assert.equal(h.c.wsKey.scanned, false);
    assert.equal(h.c.wsKey.scanPaused, true);
    assert.equal(h.c.wsKey.scanCursor, 4);
    assert.equal(h.c.studentPages().length, 0);
    await h.c.keyAutoScan(true); assert.equal(h.calls.length, 2, 'no automatic retry loop');
    await assert.rejects(h.c.keyEnsureReady(), e => e.code === 'ANSWER_KEY_NOT_READY');
  }
});

test('retry resumes the uncertain page and releases only question pages', async () => {
  let ready = false;
  const h = harness(4, {}, { classify: n => !ready ? 'uncertain' : n >= 3 ? 'key' : 'question' });
  await h.c.keyAutoScan(true); ready = true;
  await h.c.keyAutoScan(true, null, true);
  assert.deepEqual(h.calls.map(x => x.n), [4, 4, 4, 3, 2]);
  assert.deepEqual(plain(h.c.wsKey.pages), [3, 4]);
  assert.equal(h.c.wsKey.scanPending, false);
});

test('more than one batch continues automatically and never treats sixty pages as completion', async () => {
  const h = harness(132, {}, { classify: n => n >= 2 ? 'key' : 'question' });
  await h.c.keyAutoScan(true);
  assert.equal(h.calls.length, 132);
  assert.equal(h.c.wsKey.pages.length, 131);
  assert.equal(h.c.wsKey.scanned, true);
  assert.ok(h.saved.some(k => k.scanCursor === 72 && k.scanPending && !k.scanned));
});

test('saved cursor always includes provisional labels, including interruption in a later batch', async () => {
  const gate = deferred(), h = harness(80, {}, { classify: n => n === 17 ? gate.promise : n > 5 ? 'key' : 'question' });
  const first = h.c.keyAutoScan(true);
  for (let i = 0; i < 20 && h.calls.at(-1)?.n !== 17; i++) await new Promise(r => setTimeout(r, 2));
  assert.equal(h.calls.at(-1).n, 17);
  const savedBody = JSON.parse(h.c.worksheetBody());
  assert.equal(savedBody.key.scanCursor, 17);
  assert.ok(savedBody.key.scanFound.includes(18) && savedBody.key.scanFound.includes(80));
  h.c.wsEpoch++; gate.resolve('key'); await first;
  const resumed = harness(80, {}, { classify: n => n > 5 ? 'key' : 'question' });
  resumed.c.applyWorksheetBody(savedBody, {});
  await resumed.c.keyAutoScan(true);
  assert.equal(resumed.calls[0].n, 17);
  assert.equal(resumed.c.wsKey.pages.length, 75);
  assert.ok(resumed.c.wsKey.pages.includes(18));
});

test('old scanned saves repair once; current complete saves avoid duplicate model calls', async () => {
  const h = harness(4, { 4: 'key', 3: 'key' });
  h.c.applyWorksheetBody({ key: { pages: [3], rows: [], scanned: true } }, {});
  assert.equal(h.c.keyScanRequired(), true);
  await h.c.keyAutoScan(true);
  const saved = JSON.parse(h.c.worksheetBody());
  h.c.keyReset(); h.c.applyWorksheetBody(saved, {});
  assert.equal(h.c.keyScanRequired(), false);
  const n = h.calls.length; await h.c.keyAutoScan(true); assert.equal(h.calls.length, n);
});

test('all-key model predictions pause for review instead of committing every page as key', async () => {
  const h = harness(70, {}, { classify: () => 'key' });
  await h.c.keyAutoScan(true);
  assert.deepEqual(plain(h.c.wsKey.pages), []);
  assert.equal(h.c.wsKey.scanPaused, true);
  assert.equal(h.c.wsKey.scanned, false);
});

test('manual shown pages and student handwriting survive automatic classification', async () => {
  const h = harness(6, { 6: 'key', 5: 'key', 4: 'key', 3: 'key' });
  h.c.wsKey.manualShown = [5]; h.c.annotations = [{ page: 4, text: 'student work' }];
  await h.c.keyAutoScan(true);
  assert.deepEqual(plain(h.c.wsKey.pages), [3, 6]);
  assert.ok(!h.calls.some(x => x.n === 5));
  assert.ok(h.c.studentPages().some(p => p.num === 4));
  assert.ok(h.c.studentPages().some(p => p.num === 5));
});

test('teacher key rows and locked provenance are preserved during recovery', async () => {
  const h = harness(5, { 5: 'key', 3: 'key' });
  h.c.wsKey.pages = [4]; h.c.wsKey.shared = true;
  h.c.wsKey.rows = [{ number: '1', answer: 'teacher answer' }];
  await h.c.keyAutoScan(false);
  assert.equal(h.c.keyLocked(), true);
  assert.deepEqual(plain(h.c.wsKey.pages), [3, 4, 5]);
  assert.equal(h.c.wsKey.rows[0].answer, 'teacher answer');
});

test('closing the worksheet or changing accounts prevents late results and late save writes', async () => {
  for (const change of [c => { c.wsEpoch++; }, c => { c.currentUser = { uid: 'another-user' }; }, c => c.keyReset()]) {
    const gate = deferred(), h = harness(3, {}, { classify: () => gate.promise });
    const pending = h.c.keyAutoScan(true); await flush();
    const old = h.c.wsKey; change(h.c); const saves = h.saved.length;
    gate.resolve('key'); await pending;
    assert.equal(h.saved.length, saves);
    assert.deepEqual(plain(old.pages), []);
  }
});

test('background tabs stop before the next model call and resume at the saved cursor', async () => {
  const h = harness(5, {}, { classify: n => { if (n === 5) h.c.document.hidden = true; return n >= 3 ? 'key' : 'question'; } });
  await h.c.keyAutoScan(true);
  assert.deepEqual(h.calls.map(x => x.n), [5]);
  assert.equal(h.c.wsKey.scanPaused, false);
  assert.equal(h.c.wsKey.scanCursor, 4);
  h.c.document.hidden = false;
  await h.c.keyAutoScan(true);
  assert.deepEqual(h.calls.map(x => x.n), [5, 4, 3, 2]);
});

test('classification uses its own PDF render while viewer canvases are released', async () => {
  const gate = deferred(), h = harness(2, {}, { render: () => gate.promise });
  const pending = h.c.keyAutoScan(true); await flush();
  h.c.applyKeyVisibility();
  assert.ok(h.c.pages.every(p => p.canvas.width === 0));
  gate.resolve(); await pending;
  assert.deepEqual(h.renders, [2]);
  assert.equal(h.calls.length, 1);
  assert.equal(h.c.wsKey.scanPending, false);
});

test('model unavailable never falsely completes the scan', async () => {
  const h = harness(3); h.c.aiAvailable = () => false;
  await h.c.keyAutoScan(true);
  assert.equal(h.calls.length, 0);
  assert.equal(h.c.wsKey.scanPaused, true);
  assert.equal(h.c.wsKey.scanned, false);
});

test('a pending or legacy unchecked worksheet cannot be set for the class', async () => {
  const pushStart = html.indexOf('async function pushWorksheet(');
  const pushSource = html.slice(pushStart, html.indexOf('\n}\n', pushStart) + 3);
  for (const key of [{ pages: [8], rows: [], scanned: true }, { pages: [], rows: [], scanVersion: 2, scanned: false, scanPending: true }]) {
    const h = harness(); let writes = 0;
    Object.assign(h.c, {
      worksheets: [{ id: 'fixture', storagePath: 'synthetic.pdf' }], isAdmin: () => true, HINT_DEFAULT: 'nudge',
      currentDocId: null, COLLECTION: 'worksheet', ASSIGN_COLLECTION: 'assignment', ASSIGN_ROWS_MAX: 200,
      db: { collection: () => ({ doc: () => ({ get: async () => ({ exists: true, data: () => ({ storagePath: 'synthetic.pdf' }) }), set: async () => { writes++; } }) }) },
      readBody: async () => ({ key })
    });
    vm.runInContext(pushSource, h.c);
    const result = await h.c.pushWorksheet('fixture');
    assert.equal(result.ok, false);
    assert.match(result.reason, /answer-key check/);
    assert.equal(writes, 0);
  }
});

test('new class copies inherit a completed teacher scan while legacy assignments still recover', () => {
  const start = html.indexOf('async function startAssignment(');
  const objectStart = html.indexOf('key: {', start) + 'key: '.length;
  const objectEnd = html.indexOf('\n      }', objectStart) + '\n      }'.length;
  const keyObject = html.slice(objectStart, objectEnd);
  for (const version of [undefined, 2]) {
    const h = harness();
    h.c.a = { keyPages: [8, 9], keyRows: [{ number: '8', answer: '48' }], keyScanVersion: version };
    vm.runInContext('var copiedKey = ' + keyObject + ';', h.c);
    h.c.applyWorksheetBody({ key: h.c.copiedKey }, { sharedPdf: true });
    assert.equal(h.c.keyScanRequired(), version !== 2);
    assert.equal(h.c.wsKey.shared, true);
    assert.deepEqual(plain(h.c.wsKey.pages), [8, 9]);
  }
});
