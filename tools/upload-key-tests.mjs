/* Exercise the real upload continuation with deferred key discovery.
   Fixtures only: no files uploaded, accounts accessed, or model calls. */
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
function cut(startMarker, endMarker) {
  const start = html.indexOf(startMarker), end = html.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0 && end > start, startMarker);
  return html.slice(start, end);
}
const uploadSource = cut('async function uploadOne(', '/* THE ONE DOOR.');
const readinessSource = cut('function fastTutorReferencesReady()', 'async function fastTutorSource(');
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
function harness({ pending = false } = {}) {
  const scan = deferred(), scanStarted = deferred(), effects = [], saves = [];
  const c = vm.createContext({
    console, Uint8Array, Blob, window: { innerWidth: 1200 },
    currentUser: { uid: 'teacher-one', email: 'fixture@example.invalid' },
    currentDocId: '', wsEpoch: 1, wsMeta: {}, wsKey: { scanPending: true },
    docName: 'Fixture paper', pdfBytes: new Uint8Array([1]), pdfDoc: { numPages: 4 },
    COLLECTION: 'fixture-papers', STORAGE_DIR: 'fixture-storage',
    firebase: { firestore: { FieldValue: { serverTimestamp: () => 1 } } },
    db: { collection: () => ({ doc: () => ({ id: 'uploaded-paper', async set() {} }) }) },
    storage: { ref: () => ({ async put() {} }) },
    uploadName: () => ({ name: 'Fixture paper', typed: true }),
    toast() {}, usageNote() {}, setDirty() {}, setWsTitle(name) { c.docName = name; },
    renderHints() {}, renderMarking() {}, renderChat() {}, showView() {},
    openBuddy() {}, closeBuddy() {}, async loadWorksheets() {},
    async loadPdf() { c.wsEpoch++; },
    async paperReadEnds() { return { synthetic: true }; },
    paperApplyRead() { return { name: 'Fixture paper', level: 'P5', subject: 'math', filled: [] }; },
    async attachKeyPdf() {},
    async keyAutoScan() {
      scanStarted.resolve();
      await scan.promise;
      c.wsKey.scanPending = pending;
    },
    keyHasAnything: () => true,
    async keyRefreshRows() { effects.push('read-key'); },
    async performSave() {
      effects.push('save');
      saves.push({ doc: c.currentDocId, pending: c.wsKey.scanPending });
    },
    async ensureCover() { effects.push('cover'); },
    async pushWorksheet() { effects.push('push'); return { ok: true }; }
  });
  vm.runInContext(uploadSource, c);
  const result = c.uploadOne({ async arrayBuffer() { return new ArrayBuffer(1); } }, {
    level: 'P5', subject: 'math', grade: 'hints', step: '', push: true, shelf: '',
    levelFixed: true, subjects: ['math']
  }, null, false);
  return { c, scan, scanStarted, result, effects, saves };
}

for (const [label, change] of [
  ['another worksheet', c => { c.currentDocId = 'other-paper'; }],
  ['a new worksheet epoch', c => { c.wsEpoch++; }],
  ['another account', c => { c.currentUser = { uid: 'teacher-two' }; }],
  ['signing out', c => { c.currentUser = null; }]
]) {
  test(`upload stops after key discovery when the learner switches to ${label}`, async () => {
    const h = harness();
    await h.scanStarted.promise;
    assert.deepEqual(h.effects, [], 'no key read, save, cover, or publish before classification finishes');
    change(h.c);
    h.scan.resolve();
    assert.equal(await h.result, undefined, 'the batch receives no completion for the abandoned worksheet');
    assert.deepEqual(h.effects, [], 'the old upload must not act on the newly active identity');
  });
}

test('uncertain key discovery saves its pending state without reading answers, covering, or publishing', async () => {
  const h = harness({ pending: true });
  await h.scanStarted.promise;
  h.scan.resolve();
  const result = await h.result;
  assert.deepEqual(h.effects, ['save']);
  assert.deepEqual(h.saves, [{ doc: 'uploaded-paper', pending: true }]);
  assert.equal(result.id, 'uploaded-paper');
  assert.equal(result.pushed, false);
  assert.match(result.setSkip, /answer-key check needs to finish/);
});

test('completed key discovery continues reading, saving, making a cover, and publishing in order', async () => {
  const h = harness();
  await h.scanStarted.promise;
  h.scan.resolve();
  const result = await h.result;
  assert.deepEqual(h.effects, ['read-key', 'save', 'cover', 'push']);
  assert.equal(result.pushed, true);
  assert.equal(result.setSkip, '');
});

test('early tutor replies wait while key discovery is pending even with a previously read key', () => {
  const c = vm.createContext({
    wsKey: { scanPending: false, reading: false, pages: [4], rows: ['previous key'], path: '' },
    notesLoaded: true, notesLoading: false, notesBusy: false, _notesUnsub() {},
    notesWatching: 'teacher-one', notesOwner: () => 'teacher-one'
  });
  vm.runInContext(readinessSource, c);
  assert.equal(c.fastTutorReferencesReady(), true);
  c.wsKey.scanPending = true;
  assert.equal(c.fastTutorReferencesReady(), false);
  c.wsKey.scanPending = false;
  assert.equal(c.fastTutorReferencesReady(), true);
});
