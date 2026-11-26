// node --test tools/tutor-voice-tests.mjs
//
// 📖 Study Buddy READS the answer book Ans Key writes (teacher-voice.js, byte
// for byte Ans Key's). These checks pin the glue: every AI call is grounded
// with the teacher's own answer, the cache is primed before it is needed, an
// account change drops it, and nothing in this app writes to the book.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const require = createRequire(import.meta.url);
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const TV = require(path.join(root, 'teacher-voice.js'));

function section() {
  const s = html.indexOf("📖 THE ANSWER BOOK — the teacher's own answers (v1.101.0)");
  const e = html.indexOf('End answer book', s);
  assert.ok(s > 0 && e > s, 'the answer book glue is marked');
  const open = html.lastIndexOf('/*', s);
  return html.slice(open, html.indexOf('*/', e) + 2);
}
function fnBody(name) {
  const s = html.search(new RegExp('(?:async )?function ' + name + '\\('));
  assert.ok(s >= 0, name + ' exists');
  const open = html.indexOf('{', s);
  let d = 0;
  for (let i = open; i < html.length; i++) {
    if (html[i] === '{') d++;
    else if (html[i] === '}') { d--; if (!d) return html.slice(open, i + 1); }
  }
  throw new Error('unbalanced ' + name);
}

test('teacher-voice.js is loaded, with the app version', () => {
  const v = (html.match(/var APP_VERSION = 'v([\d.]+)'/) || [])[1];
  assert.ok(v, 'APP_VERSION');
  assert.ok(html.includes('<script src="teacher-voice.js?v=' + v + '"'), 'script tag carries ?v=' + v);
});

test('aiGrounding appends the teacher\'s own answers for every kind', () => {
  const b = fnBody('aiGrounding');
  assert.match(b, /tvBlock\(kind, opts\)/);
  assert.match(b, /if \(!guide && !notes && !style && !voice\)/);
  assert.match(b, /guide \+ notes \+ style \+ voice \+ authority/);
});

test('the cache is primed before it is needed, and dropped on an account change', () => {
  assert.ok((html.match(/tvPrimeSoon\(\)/g) || []).length >= 3, 'both worksheet doors prime the paper');
  assert.match(fnBody('pracStart'), /tvPrimeQuestions\(/);
  assert.match(fnBody('stopTeachingNotes'), /tvReset\(\)/);
});

test('nothing here writes to the answer book', () => {
  const s = section();
  assert.ok(!/\.set\(|\.update\(|\.add\(|\.delete\(|runTransaction|batch\(/.test(s), 'the glue only reads');
  assert.ok(!/innerHTML/.test(s));
});

test('only the teacher lists every entry; a student reads question by question', () => {
  const s = section();
  assert.match(s, /isAdmin\(currentUser\)/);
  assert.match(s, /o !== currentUser\.uid/);
});

/* ---- The glue, run against the real teacher-voice.js and a fake Firestore ---- */
function harness({ admin, docs }) {
  const reads = [];
  const fakeDb = {
    doc(p) { return { get: async () => { reads.push(p); const d = docs[p]; return { exists: !!d, data: () => d }; } }; },
    collection(a) {
      return { doc: (b) => ({ collection: (c) => ({ doc: (d) => ({ collection: (e) => ({
        get: async () => { reads.push([a, b, c, d, e].join('/')); const list = docs[[a, b, c, d, e].join('/')] || [];
          return { forEach: (f) => list.forEach((x) => f({ data: () => x })) }; } }) }) }) }) };
    }
  };
  const ctx = {
    window: { TeacherVoice: TV }, db: fakeDb, console: { warn() {} },
    currentUser: { uid: admin ? 'T' : 'S', email: admin ? 'admin' : 'kid' },
    isAdmin: (u) => !!u && u.email === 'admin',
    notesOwner: () => 'T', currentDocId: 'doc1', wsEpoch: 1,
    wsMeta: { level: 'P5', subject: 'science' }, docName: 'Heat', pages: [],
    setTimeout, clearTimeout
  };
  vm.createContext(ctx);
  vm.runInContext(section(), ctx);
  return { ctx, reads };
}

function bookFor(entries) {
  const docs = {};
  const rows = entries.map((e) => P.cleanEntry(e)).filter(Boolean);
  const byBucket = {};
  rows.forEach((r) => { (byBucket[r.bucket] = byBucket[r.bucket] || []).push(r); });
  const base = 'users/T/' + TV.COLL + '/' + TV.BOOK_DOC;
  docs['users/T/' + TV.COLL + '/' + TV.INDEX_DOC] = { v: 1, buckets: Object.fromEntries(Object.keys(byBucket).map((k) => [k, byBucket[k].length])) };
  Object.keys(byBucket).forEach((b) => {
    docs['users/T/' + TV.COLL + '/' + P.indexDocId(b)] = { v: 1, rows: byBucket[b].map(P.rowOf) };
  });
  rows.forEach((r) => { docs[base + '/' + TV.ENTRIES + '/' + r.id] = r; });
  docs[base + '/' + TV.ENTRIES] = rows;
  return docs;
}
const P = TV.pure;

test('a question asked once is answered from the book the next time', async (t) => {
    const q = 'A metal spoon left in a cup of hot soup became hot. Explain why.';
  const docs = bookFor([{ k: P.slotKey('d', 'p1:q5'), n: '5', q, a: 'Metal is a good conductor of heat. The spoon gained heat from the hotter soup.', src: 'typed', lvl: 'P5', sub: 'science', ws: 'Heat', doc: 'd', page: 1, at: '2026-11-01T00:00:00Z' }]);
  const { ctx } = harness({ admin: false, docs });
  const first = vm.runInContext('tvBlock("hint", { q: ' + JSON.stringify(q) + ' })', ctx);
  assert.equal(typeof first, 'string');
  await new Promise((r) => setTimeout(r, 30));
  const second = vm.runInContext('tvBlock("hint", { q: ' + JSON.stringify(q) + ' })', ctx);
  assert.match(second, /good conductor of heat/);
  vm.runInContext('tvReset()', ctx);
  assert.ok(!/good conductor/.test(vm.runInContext('tvBlock("hint", {})', ctx)), 'an account change drops the cache');
});

test('a block for a kind the book does not ground is empty', () => {
  const { ctx } = harness({ admin: false, docs: {} });
  assert.equal(vm.runInContext('tvBlock("gen", { q: "anything" })', ctx), '');
});
