// 📂 MY WORKSHEETS, BESIDE THE PAGE and 🗑 ASK BEFORE DELETING (v1.90.0).
// These pin the pure halves (what the box says, who may delete what, the
// rows of the side bar) by running the app's own functions, and pin what
// the source must keep saying. tools/files-panel-browser-check.mjs drives
// the real side bar and the real box in Chromium.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

function fn(name) {
  const at = html.search(new RegExp('\\n(async )?function ' + name + '\\('));
  assert.ok(at >= 0, name + ' exists');
  return html.slice(at + 1, html.indexOf('\n}\n', at) + 2);
}
function between(a, b) {
  const i = html.indexOf(a);
  assert.ok(i >= 0, a + ' is in the file');
  const j = html.indexOf(b, i);
  assert.ok(j > i, b + ' follows ' + a);
  return html.slice(i, j);
}
const BLOCK = between('/* 🗑 DELETING A WORKSHEET, from the bookcase card', '/* =====================================================================\n   🧹 START FRESH');
const code = BLOCK.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/* The pure functions, run for real in a sandbox with the app's own helpers. */
function sandbox() {
  const ctx = {
    ADMIN_DISPLAY_NAME: 'Mr Chung',
    SUBJECTS: [
      { value: 'science', label: 'Science' }, { value: 'math', label: 'Mathematics' },
      { value: 'english', label: 'English' }, { value: 'chinese', label: 'Chinese' }
    ],
    localStorage: { getItem() { return null; }, setItem() {} },
    console
  };
  vm.createContext(ctx);
  const src = [
    fn('levelLabel'), fn('subjectLabel'), fn('stampOf'), fn('shelfAgo'), fn('setterName'),
    fn('wsDeleteSpec'), fn('filesWhen'), fn('filesCanDelete'), fn('filesNorm'), fn('filesMatch'),
    fn('filesRows'), fn('filesSortRows'), fn('filesSafeUrl'), fn('filesSortPref'),
    'var FILES_SORT_KEY = "k"; var FILES_SORTS = ' + JSON.stringify([['recent', ''], ['name', ''], ['made', '']]) + ';'
  ].join('\n');
  vm.runInContext(src, ctx);
  return ctx;
}
const S = sandbox();
// The sandbox's arrays are another realm's: compare them as plain data.
const eq = (a, b, m) => assert.deepEqual(JSON.parse(JSON.stringify(a)), b, m);
const DAY = 864e5;
const NOW = Date.UTC(2026, 10, 13, 8, 0, 0);

test('the box says what goes, what stays, and that it cannot be undone — an upload of your own', () => {
  const w = { id: 'w1', name: 'Heat revision', level: 'P5', subject: 'science', pageCount: 6,
              score: { correct: 12, attempted: 20 }, attempts: 2, storagePath: 'tutor-worksheets/u/w1.pdf' };
  const s = S.wsDeleteSpec(w, { name: 'Heat revision', now: NOW, when: NOW - 2 * DAY });
  assert.equal(s.title, '🗑 Delete this worksheet?');
  assert.equal(s.name, 'Heat revision');
  assert.match(s.warn, /cannot be undone/);
  assert.ok(s.goes.includes('The PDF you uploaded'), 'your own upload goes with its PDF');
  assert.ok(s.goes.some(g => /written, typed and drawn/.test(g)));
  assert.ok(s.goes.some(g => /hints/.test(g) && /marking/.test(g)));
  assert.ok(s.keeps.some(k => /mistake book/.test(k)), 'the mistake book stays, and the box says so');
  assert.equal(s.yes, '🗑 Delete for ever');
  assert.equal(s.no, 'Keep it');
  eq(Array.from(s.facts), ['P5', 'Science', '6 pages', '✅ 12/20', '↻ Attempt 2', '🕒 2 days ago']);
  assert.equal(s.open, '', 'not open, so no sentence about closing it');
  assert.equal(s.done, 'Deleted.');
});

test('a student\'s copy of a set paper: only their copy goes, the paper stays in 📌 Set for you', () => {
  const w = { id: 'c1', name: 'P5 Fractions', sharedPdf: true, assignmentId: 'a1', storagePath: 'tutor-worksheets/teacher/a1.pdf' };
  const s = S.wsDeleteSpec(w, { name: 'P5 Fractions', setter: 'Mr Chung', classReads: true });
  assert.equal(s.title, '🗑 Delete your copy?');
  assert.equal(s.yes, '🗑 Delete my copy');
  assert.ok(!s.goes.includes('The PDF you uploaded'), 'the class\'s PDF is never said to go');
  assert.ok(s.keeps.some(k => /Mr Chung/.test(k) && /Set for you/.test(k) && /start it again/.test(k)));
  assert.match(s.done, /Set for you/);
  assert.equal(s.note, '', 'the teacher\'s withdraw note is not for a student');
});

test('the teacher\'s own copy of a paper the class reads keeps its PDF, and says how to withdraw it', () => {
  const w = { id: 't1', name: 'Prelim', storagePath: 'x.pdf', videos: [{ id: 'v' }] };
  const s = S.wsDeleteSpec(w, { name: 'Prelim', classReads: true, teacher: true });
  assert.equal(s.title, '🗑 Delete your copy?');
  assert.ok(!s.goes.includes('The PDF you uploaded'));
  assert.ok(!s.goes.some(g => /video/.test(g)), 'a set paper\'s videos are every copy\'s');
  assert.ok(s.keeps.some(k => /PDF and its videos/.test(k)));
  assert.ok(s.keeps.some(k => /Every student/.test(k)));
  assert.match(s.note, /Take off the list/);
  assert.equal(s.done, 'Deleted your copy. The class still has it.');
});

test('the teacher\'s own paper that no class reads takes its videos with it, and says so', () => {
  const s = S.wsDeleteSpec({ id: 't2', videos: [{ id: 'v1' }] }, { name: 'Draft', teacher: true });
  assert.ok(s.goes.some(g => /video solutions/.test(g)));
  const st = S.wsDeleteSpec({ id: 't3', videos: [{ id: 'v1' }] }, { name: 'Draft', teacher: false });
  assert.ok(!st.goes.some(g => /video/.test(g)), 'a student is never told videos go');
});

test('deleting the paper that is open says it will close', () => {
  const s = S.wsDeleteSpec({ id: 'w1' }, { name: 'X', open: true });
  assert.match(s.open, /open now/);
  assert.match(s.open, /go back to your worksheets/);
});

test('who may delete what: the account\'s own papers, never the class\'s', () => {
  const me = { uid: 'u1' };
  assert.equal(S.filesCanDelete({ id: 'w1', ownerUid: 'u1' }, me), true);
  assert.equal(S.filesCanDelete({ id: 'w0' }, me), true, 'the oldest uploads carry no owner field');
  assert.equal(S.filesCanDelete({ id: 'w2', ownerUid: 'u2' }, me), false, 'somebody else\'s');
  assert.equal(S.filesCanDelete({ id: 'set:a1', set: { id: 'a1' } }, me), false, 'a set paper not started is the class\'s');
  assert.equal(S.filesCanDelete({ id: 'set:a2' }, me), false);
  assert.equal(S.filesCanDelete({ id: 'w1', ownerUid: 'u1' }, null), false, 'signed out');
  assert.equal(S.filesCanDelete(null, me), false);
});

const ENTRIES = [
  { id: 'w1', name: 'Heat revision', level: 'P5', subject: 'science', topic: 'Heat', ownerUid: 'u1',
    createdAt: NOW - 30 * DAY, updatedAt: NOW - 5 * DAY, lastOpenedAt: NOW - 1 * DAY, score: { correct: 3, attempted: 4 } },
  { id: 'w2', name: 'Fractión drill 2', level: 'P5', subject: 'math', ownerUid: 'u1',
    createdAt: NOW - 2 * DAY, updatedAt: NOW - 2 * DAY },
  { id: 'w3', name: 'Fraction drill 10', level: 'P5', subject: 'math', ownerUid: 'u1', school: 'Nanyang',
    createdAt: NOW - 10 * DAY, updatedAt: NOW - 3 * DAY, lastOpenedAt: { seconds: (NOW - 0.5 * DAY) / 1000 } },
  { id: 'set:a1', set: { id: 'a1', name: 'Set: Light' }, name: 'Set: Light', level: 'P5', subject: 'science', updatedAt: NOW - 4 * DAY },
  { id: 'set:a2', set: { id: 'a2', name: 'Set: Area' }, name: 'Set: Area', level: 'P5', subject: 'math', updatedAt: NOW - 1 * DAY }
];

test('the rows: my worksheets by last worked on, the open one marked, set papers apart with no 🗑', () => {
  const r = S.filesRows(ENTRIES, { sort: 'recent', openId: 'w1', user: { uid: 'u1' } });
  assert.equal(r.total, 5);
  assert.equal(r.shown, 5);
  eq(r.mine.map(x => x.id), ['w3', 'w1', 'w2'], 'lastOpenedAt or updatedAt, whichever is later');
  eq(r.mine.map(x => x.open), [false, true, false]);
  assert.ok(r.mine.every(x => x.del), 'every paper of my own has a 🗑');
  eq(r.set.map(x => x.id), ['a2', 'a1'], 'a set row carries the ASSIGNMENT id, newest first');
  assert.ok(r.set.every(x => !x.del && x.set), 'a set paper never has a 🗑');
  assert.equal(r.mine[1].score.correct, 3);
});

test('the rows: name order is natural (2 before 10), newest upload is the upload date', () => {
  const byName = S.filesRows(ENTRIES, { sort: 'name', user: { uid: 'u1' } });
  eq(byName.mine.map(x => x.id), ['w2', 'w3', 'w1']);
  eq(byName.set.map(x => x.id), ['a2', 'a1']);
  const made = S.filesRows(ENTRIES, { sort: 'made', user: { uid: 'u1' } });
  eq(made.mine.map(x => x.id), ['w2', 'w3', 'w1']);
});

test('the search: every word must match the name, topic, school, level or subject, accents ignored', () => {
  const f = q => S.filesRows(ENTRIES, { q, sort: 'name', user: { uid: 'u1' } });
  eq(f('fraction').mine.map(x => x.id), ['w2', 'w3'], '"Fractión" is found by "fraction"');
  eq(f('fraction nanyang').mine.map(x => x.id), ['w3'], 'every word, not any word');
  eq(f('HEAT').mine.map(x => x.id), ['w1'], 'case is ignored');
  eq(f('mathematics').set.map(x => x.id), ['a2'], 'the subject\'s own name');
  const none = f('zzz');
  assert.equal(none.shown, 0);
  assert.equal(none.total, 5, 'the total still counts everything, so the bar can say "0 of 5"');
  assert.equal(f('   ').shown, 5, 'blank is everything');
});

test('a row\'s picture is a cover the app made, never any URL a field holds', () => {
  assert.equal(S.filesSafeUrl('data:image/jpeg;base64,AAAA'), true);
  assert.equal(S.filesSafeUrl('https://firebasestorage.googleapis.com/x'), true);
  assert.equal(S.filesSafeUrl('javascript:alert(1)'), false);
  assert.equal(S.filesSafeUrl('data:text/html,<b>'), false);
  assert.equal(S.filesSafeUrl(''), false);
});

test('a sort that is not one of ours falls back to "last worked on"', () => {
  assert.equal(S.filesSortPref(), 'recent');
});

/* ---- What the source must keep saying ---- */

test('every delete ASKS, through the app\'s own box — no confirm(), nothing can skip it', () => {
  const del = fn('deleteWorksheet');
  assert.ok(!/confirm\(/.test(del), 'never the browser\'s confirm(), which Safari lets a page switch off');
  assert.match(del, /return askDelete\(spec\);/, 'the box is the delete\'s only way in');
  assert.ok(!/skip|noAsk|dontAsk|force/i.test(del), 'no argument can skip the question');
  assert.equal((del.match(/^async function deleteWorksheet\(id\)/m) || []).length, 1, 'it takes the id and nothing else');
  assert.ok(!/confirm\(/.test(code), 'nothing in the side bar or the box uses confirm()');
  assert.ok(!/don.t ask|ask again/i.test(BLOCK.replace(/\/\*[\s\S]*?\*\//g, '')), 'no "don\'t ask again"');
  // The work only runs from the yes path, after the box.
  const answer = fn('askDeleteAnswer');
  assert.ok(answer.indexOf('if (!yes)') < answer.indexOf('ask.spec.work()'), 'a no returns before any work');
  assert.match(answer, /if \(\$\('delYes'\) && \$\('delYes'\)\.disabled\) return;/, 'an unarmed yes is not an answer');
});

test('the red button is armed a moment late, Keep it has the focus, the box starts disabled', () => {
  const arm = Number((html.match(/var DEL_ARM_MS = (\d+);/) || [])[1]);
  assert.ok(arm >= 400 && arm <= 1200, 'a double tap on 🗑 cannot also be the yes (' + arm + ' ms)');
  assert.match(html, /<button class="btn freshGo" id="delYes" type="button" disabled>/);
  const ask = fn('askDelete');
  assert.match(ask, /yes\.disabled = true;/);
  assert.match(ask, /no\.focus\(/);
  assert.match(html, /id="delModal" role="alertdialog" aria-modal="true"/);
});

test('Escape and the backdrop are a NO; a delete half done cannot be closed', () => {
  const bind = fn('askDeleteBind');
  assert.match(bind, /if \(e\.target === modal\) askDeleteAnswer\(false\)/);
  assert.match(bind, /e\.key !== 'Escape'[\s\S]*askDeleteAnswer\(false\);[\s\S]*\}, true\);/, 'answered in the capture phase');
  assert.match(html, /\.modalBack\.open:not\(#onboardModal\):not\(\.freshBusy\):not\(\.delBusy\):not\(#delModal\)/,
    'the Escape sweep never takes the box away without its answer');
  const answer = fn('askDeleteAnswer');
  assert.match(answer, /if \(!ask \|\| ask\.busy\) return;/);
});

test('every word in the box and the side bar is text, never markup', () => {
  for (const name of ['askDeletePaint', 'filesRowNode']) {
    const f = fn(name);
    assert.ok(!/innerHTML\s*=(?!\s*'';)/.test(f) && !/innerHTML\s*\+=/.test(f), name + ' never builds markup from data');
    assert.match(f, /textContent = /);
  }
  assert.match(fn('askDeletePaint'), /body\.innerHTML = '';/);
});

test('the open paper lets go BEFORE anything is deleted, so auto-save cannot write it back', () => {
  const now = fn('deleteWorksheetNow');
  const letGo = now.indexOf('await wsDeleteLetGo(id)');
  assert.ok(letGo > 0);
  for (const step of ['storage.ref(w.storagePath).delete()', 'storage.ref(w.bodyPath).delete()',
                      'db.collection(COLLECTION).doc(id).delete()']) {
    assert.ok(now.indexOf(step) > letGo, step + ' comes after the let-go');
  }
  const g = fn('wsDeleteLetGo');
  assert.match(g, /clearTimeout\(autoSaveTimer\);/);
  assert.match(g, /currentDocId = null;/);
  assert.match(g, /while \(savingNow && Date\.now\(\) < until\)/, 'a write in flight lands first');
  assert.ok(g.indexOf('currentDocId = null;') < g.indexOf('while (savingNow'), 'nothing new can start while it waits');
  // Both savers return at once with no document.
  assert.match(fn('performSave'), /if \(!currentDocId \|\| !currentUser\) return false;/);
  assert.match(fn('scheduleAutoSave'), /if \(!currentDocId\) return;/);
});

test('the file rules are the ones they always were', () => {
  const now = fn('deleteWorksheetNow');
  assert.match(now, /w\.storagePath && !w\.sharedPdf && !classReads/);
  assert.match(now, /w\.keyPath && !w\.sharedPdf && !classReads/);
  assert.match(now, /if \(!w\.sharedPdf && !classReads\) await lessonDeleteFiles/);
  const del = fn('deleteWorksheet');
  assert.ok(del.indexOf('filesCanDelete(w, currentUser)') < del.indexOf('askDelete'), 'the owner rule is asked in the handler too');
  assert.ok(del.indexOf('worksheetReadByClass(w)') < del.indexOf('askDelete'));
});

test('both doors are the one delete: the bookcase card and the side bar', () => {
  assert.match(fn('wsCardNode'), /del\.addEventListener\('click', function \(\) \{ deleteWorksheet\(w\.id\); \}\);/);
  assert.match(fn('filesRowNode'), /deleteWorksheet\(r\.id\);/);
  assert.match(fn('filesRowNode'), /if \(r\.del\) \{/, '🗑 only where the row may be deleted');
});

test('the side bar sits in the worksheet screen, beside ←, and is wired once', () => {
  const bar = html.slice(html.indexOf('<div id="wsTop">'), html.indexOf('<div id="wsMain">'));
  assert.ok(bar.indexOf('id="backBtn"') < bar.indexOf('id="filesBtn"'), '📂 stands beside ←');
  assert.match(bar, /id="filesBtn" type="button" aria-controls="filesPanel" aria-expanded="false"/);
  const main = html.slice(html.indexOf('<div id="wsMain">'), html.indexOf('<!-- ============ MISTAKE BOOK'));
  assert.match(main, /<aside class="filesPanel" id="filesPanel" aria-labelledby="filesTitle" hidden>/);
  assert.match(html, /\naskDeleteBind\(\);\nfilesBind\(\);\n/);
});

test('it is repainted with the bookcase and closed with the worksheet', () => {
  assert.match(fn('renderWorksheets'), /filesSync\(\)/);
  assert.match(fn('showView'), /if \(v !== 'ws' && typeof filesClose === 'function'\) filesClose\(false\);/);
  assert.match(html, /if \(filesState\.open && !document\.querySelector\('\.modalBack\.open'\)\) \{ filesClose\(\); return; \}/);
});

test('opening from the side bar saves the open paper first, through the shelf\'s own doors', () => {
  const go = fn('filesGo');
  assert.ok(go.indexOf('performSave(true)') < go.indexOf('openWorksheet(r.id)'));
  assert.match(go, /if \(r\.set\) await startAssignment\(r\.id\);/);
  assert.match(go, /if \(!r\.set && r\.id === currentDocId\) \{ filesClose\(\); return; \}/);
});

test('the side bar layers under every dialog and over the page', () => {
  const z = sel => Number((html.match(new RegExp('\\.' + sel + ' \\{[^}]*z-index: (\\d+)')) || [])[1]);
  assert.equal(z('filesPanel'), 110);
  assert.equal(z('filesScrim'), 109);
  assert.ok(z('filesPanel') < 120 && z('filesPanel') < 200);
});
