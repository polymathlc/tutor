/* ⚡ QUICK PRACTICE (v1.94.0): which questions a quick practice picks.
   The block is lifted out of index.html (from its banner to `pracCurrent`)
   and run alone, so the choosing is pinned without a browser.
   Run: node --test tools/quick-practice-tests.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const start = html.indexOf('/* =====================================================================\n   ⚡ QUICK PRACTICE');
const end = html.indexOf('function pracCurrent()', start);
assert.ok(start > 0 && end > start, 'the ⚡ block is found in index.html');
const src = html.slice(start, end);

function load(extra = {}) {
  const store = {};
  const ctx = {
    console, Math, JSON, Number, String, Object, Array, isFinite,
    currentUser: { uid: 'u1' },
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); }
    },
    Date,
    ...extra
  };
  vm.createContext(ctx);
  vm.runInContext(src + '\n;this.__qp = { qpPick, qpCounts, qpInterleave, qpCleanN, qpStamp, qpSeen, qpPool, QP_MAX };', ctx);
  return { qp: ctx.__qp, store, ctx };
}

const book = [
  { id: 'a', subject: 'math', topic: 'Fractions' },
  { id: 'b', subject: 'math', topic: 'Fractions' },
  { id: 'c', subject: 'math', topic: 'Decimals' },
  { id: 'd', subject: 'science', topic: 'Heat' },
  { id: 'e', subject: 'science', topic: 'Light', cleared: true },
  { id: 'f', subject: 'math', topic: 'Decimals', cleared: true }
];
const plain = x => JSON.parse(JSON.stringify(x));
const fixedRng = () => { let i = 0; return () => (i++ % 10) / 10; };
const topicOf = m => m.topic;

test('still-to-redo questions come before sorted ones', () => {
  const { qp } = load();
  const r = qp.qpPick(book, 4, { rng: fixedRng(), topicOf });
  assert.equal(r.ids.length, 4);
  assert.deepEqual([...r.ids].sort(), ['a', 'b', 'c', 'd']);
  assert.equal(r.open, 4);
  assert.equal(r.sorted, 0);
});

test('never practised beats practised, and the oldest practised goes first', () => {
  const { qp } = load();
  const seen = { a: 3000, b: 1000, c: 2000 };
  const r = qp.qpPick(book, 2, { seen, rng: fixedRng(), topicOf });
  assert.ok(r.ids.includes('d'), 'the never-practised one is in');
  assert.ok(r.ids.includes('b'), 'then the one practised longest ago');
  assert.ok(!r.ids.includes('a'), 'the one just practised waits');
});

test('sorted ones only top up when there are not enough to redo', () => {
  const { qp } = load();
  const r = qp.qpPick(book, 6, { rng: fixedRng(), topicOf });
  assert.equal(r.ids.length, 6);
  assert.equal(r.open, 4);
  assert.equal(r.sorted, 2);
  const more = qp.qpPick(book, 99, { rng: fixedRng(), topicOf });
  assert.equal(more.ids.length, 6, 'never more than the book holds');
});

test('a subject keeps to that subject', () => {
  const { qp } = load();
  const r = qp.qpPick(book, 10, { subject: 'science', rng: fixedRng(), topicOf });
  assert.deepEqual([...r.ids].sort(), ['d', 'e']);
  assert.equal(r.open, 1);
  const c = qp.qpCounts(book, 'math');
  assert.deepEqual({ open: c.open, sorted: c.sorted, total: c.total }, { open: 3, sorted: 1, total: 4 });
  assert.deepEqual(plain(c.subjects).map(s => [s.key, s.open, s.total]), [['math', 3, 4], ['science', 1, 2]]);
});

test('no repeats, and nothing chosen when the book is empty', () => {
  const { qp } = load();
  const r = qp.qpPick(book, 6, { rng: Math.random, topicOf });
  assert.equal(new Set(r.ids).size, r.ids.length);
  assert.deepEqual(plain(qp.qpPick([], 5, {}).ids), []);
  assert.deepEqual(plain(qp.qpPick(book, 0, {}).ids), []);
});

test('the chosen questions are dealt out topic by topic', () => {
  const { qp } = load();
  const list = [
    { id: '1', topic: 'F' }, { id: '2', topic: 'F' }, { id: '3', topic: 'F' },
    { id: '4', topic: 'D' }, { id: '5', topic: 'H' }
  ];
  assert.deepEqual(plain(qp.qpInterleave(list, topicOf).map(m => m.id)), ['1', '4', '5', '2', '3']);
});

test('ties are shuffled, so two presses are not always the same set', () => {
  const { qp } = load();
  const many = Array.from({ length: 30 }, (_, i) => ({ id: 'm' + i, subject: 'math', topic: 'T' }));
  const sets = new Set();
  for (let i = 0; i < 8; i++) sets.add(qp.qpPick(many, 5, { topicOf }).ids.sort().join());
  assert.ok(sets.size > 1);
});

test('their own number is cleaned: whole, at least 1, at most the book and 50', () => {
  const { qp } = load();
  assert.equal(qp.qpCleanN('7', 20), 7);
  assert.equal(qp.qpCleanN(' 12 ', 8), 8);
  assert.equal(qp.qpCleanN('3.9', 20), 3);
  assert.equal(qp.qpCleanN('0', 20), 0);
  assert.equal(qp.qpCleanN('-4', 20), 0);
  assert.equal(qp.qpCleanN('abc', 20), 0);
  assert.equal(qp.qpCleanN('500', 999), qp.QP_MAX);
});

test('a practised question is stamped on this device, per account', () => {
  const { qp, store } = load();
  qp.qpStamp('a');
  const seen = qp.qpSeen();
  assert.ok(seen.a > 0);
  assert.ok(Object.keys(store).some(k => k.endsWith('.u1')), 'the key names the account');
});

test('a device that refuses storage still picks', () => {
  const { qp } = load({ localStorage: { getItem() { throw new Error('no'); }, setItem() { throw new Error('no'); } } });
  qp.qpStamp('a');
  assert.deepEqual(plain(qp.qpSeen()), {});
  assert.equal(qp.qpPick(book, 3, { seen: qp.qpSeen(), topicOf }).ids.length, 3);
});

test('every practice answer stamps, and the session is the book’s own', () => {
  assert.equal((html.match(/prac\.done\+\+;\n\s*qpStamp\(m\.id\);/g) || []).length, 3, 'the three places an answer is counted');
  assert.match(src, /pracStart\(picked\.ids, \{ quick:/, 'quick practice goes through pracStart');
  assert.match(html, /id="quickPracBtn"/, 'the home button');
  assert.match(html, /quickpractice: \{ label:/, 'the usage panel can name the event');
});
