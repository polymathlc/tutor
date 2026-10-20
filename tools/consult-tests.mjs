/* 🙋 The consult: the pure half of consult.js, the wiring in index.html, and
   the rules nobody can see from a screen — the client never names an email
   address, the teacher's ink never becomes an annotation, and the client
   and the server agree on the link and the endpoint.

   Run: node --test tools/consult-tests.mjs */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const SRC = fs.readFileSync(new URL('../consult.js', import.meta.url), 'utf8');
const CSS = fs.readFileSync(new URL('../consult.css', import.meta.url), 'utf8');
const HTML = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const server = require('../functions/consult-service.js');

function load(extra = {}) {
  const sandbox = { console, URLSearchParams, URL, JSON, Math, Date, Number, String, Array, Object, Uint8Array,
    setTimeout, clearTimeout, ...extra };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox, { filename: 'consult.js' });
  return sandbox;
}
const ctx = load();
const P = ctx.TutorConsult.pure;
// Arrays made inside the vm carry its own Array.prototype, which deepStrictEqual
// treats as a different type. JSON round-trips them into this realm.
const here = v => JSON.parse(JSON.stringify(v));

test('loads with no DOM at all and exposes its surface', () => {
  assert.equal(typeof ctx.TutorConsult, 'object');
  for (const k of ['wire', 'authChanged', 'syncButton', 'openRoom', 'leaveRoom', 'startConsult', 'endStudent', 'state'])
    assert.equal(typeof ctx.TutorConsult[k], 'function', k);
  const st = ctx.TutorConsult.state();
  assert.equal(st.student.id, '');
  assert.equal(st.teacher.id, '');
  assert.deepEqual(here(st.waiting), []);
});

test('the link, the endpoint and the collection agree with the server', () => {
  assert.equal(P.JOIN_BASE, server.JOIN_BASE);
  assert.equal(P.COLLECTION, server.CONSULT_COLLECTION);
  assert.ok(P.ENDPOINT.endsWith('/studyBuddyConsult'));
  assert.ok(P.ENDPOINT.startsWith('https://us-central1-mathgen--app.cloudfunctions.net/'));
  const id = 'AbCdEf1234567890xyZ1';
  assert.equal(P.consultLink(id), server.consultLink(id));
  assert.equal(P.consultLink('bad id'), '');
  assert.equal(P.consultLink(''), '');
});

test('consult ids and the ?consult= parameter', () => {
  assert.equal(P.consultIdOk('AbCdEf1234567890xyZ1'), true);
  for (const bad of ['', 'short', 'has space in it ok', 'a/b/c/d/e/f/g/h', 'x'.repeat(41), null, 7, '<script>alert</script>'])
    assert.equal(P.consultIdOk(bad), false, String(bad));
  assert.equal(P.readConsultParam('?consult=AbCdEf1234567890xyZ1&ws=1'), 'AbCdEf1234567890xyZ1');
  assert.equal(P.readConsultParam('?consult=../../etc'), '');
  assert.equal(P.readConsultParam(''), '');
  assert.equal(P.readConsultParam(undefined), '');
  // Both apps compute the same server/client id rule.
  for (const id of ['AbCdEf1234567890xyZ1', 'short', 'x'.repeat(41)])
    assert.equal(P.consultIdOk(id), /^[A-Za-z0-9]{12,40}$/.test(id));
});

test('text is one bounded line with no control characters', () => {
  assert.equal(P.cleanText('  Ada\n\tLovelace  ', 60), 'Ada Lovelace');
  assert.equal(P.cleanText('a b c', 60), 'a b c');
  assert.equal(P.cleanText(null, 60), '');
  assert.equal(P.cleanText('x'.repeat(200), 10).length, 10);
});

test('points are packed flat, rounded, clamped and thinned evenly', () => {
  assert.deepEqual(here(P.packPoints([[0.123456, 0.5], [2, -1], ['x', 0.2], [0.5]])), [0.1235, 0.5, 1, 0]);
  assert.deepEqual(here(P.unpackPoints([0.1, 0.2, 5, -3, 'n', 0.3, 0.9])), [[0.1, 0.2], [1, 0]]);
  assert.deepEqual(here(P.unpackPoints('nope')), []);
  const long = Array.from({ length: 2000 }, (_, i) => [i / 2000, 0.5]);
  const thin = P.decimate(long, 100);
  assert.equal(thin.length, 100);
  assert.deepEqual(here(thin[0]), long[0]);
  assert.deepEqual(here(thin[99]), long[1999], 'the last point is never cut off');
  assert.equal(P.packPoints(long).length, P.STROKE_MAX_POINTS * 2);
  assert.deepEqual(here(P.decimate([[0, 0]], 10)), [[0, 0]]);
});

test('cleanStroke is the one door a stroke comes in by', () => {
  const good = { id: 'stroke_123', ws: 'ws1', page: 2, c: '#1E88E5', w: 0.005, p: [0.1, 0.1, 0.2, 0.2], at: 5 };
  const s = P.cleanStroke(good);
  assert.equal(s.id, 'stroke_123');
  assert.equal(s.page, 2);
  assert.equal(s.c, '#1E88E5');
  assert.deepEqual(here(s.pts), [[0.1, 0.1], [0.2, 0.2]]);
  assert.equal(s.done, true);
  assert.equal(P.cleanStroke({ ...good, done: false }).done, false);
  assert.equal(P.cleanStroke({ ...good, c: 'red; background:url(x)' }).c, P.INK_COLORS[0].c);
  assert.equal(P.cleanStroke({ ...good, w: 99 }).w, P.INK_W_MAX);
  assert.equal(P.cleanStroke({ ...good, w: -1 }).w, P.INK_W_MIN);
  for (const bad of [null, 'x', { ...good, id: 'a' }, { ...good, id: '../x/../y' }, { ...good, page: 0 }, { ...good, page: 1.5 },
    { ...good, page: 99999 }, { ...good, p: [] }, { ...good, p: 'abc' }])
    assert.equal(P.cleanStroke(bad), null, JSON.stringify(bad));
});

test('a stroke path: a dot for a tap, a line for two points, curves for more', () => {
  assert.equal(P.strokePathD([], 100, 100), '');
  assert.equal(P.strokePathD([[0.5, 0.5]], 100, 200), 'M50 100l0.01 0');
  assert.equal(P.strokePathD([[0, 0], [1, 1]], 100, 200), 'M0 0L100 200');
  const d = P.strokePathD([[0, 0], [0.5, 0.5], [1, 0]], 100, 100);
  assert.ok(d.startsWith('M0 0Q50 50 75 25'));
  assert.ok(d.endsWith('L100 0'));
});

test('ICE candidates are tagged by negotiation and never replayed', () => {
  assert.equal(P.packCandidate(null, 1), '');
  assert.equal(P.packCandidate({ candidate: '' }, 1), '');
  const a = P.packCandidate({ candidate: 'candidate:1 1 udp 1 1.2.3.4 5 typ host', sdpMid: '0', sdpMLineIndex: 0 }, 2);
  const old = P.packCandidate({ candidate: 'candidate:old', sdpMid: '0', sdpMLineIndex: 0 }, 1);
  const seen = {};
  const out = P.unpackCandidates([a, old, 'garbage', 42, a], 2, seen);
  assert.equal(out.length, 1);
  assert.equal(out[0].candidate, 'candidate:1 1 udp 1 1.2.3.4 5 typ host');
  assert.equal(out[0].sdpMid, '0');
  assert.equal(out[0].sdpMLineIndex, 0);
  assert.equal(P.unpackCandidates([a], 2, seen).length, 0, 'a candidate already handed over is not handed over twice');
  assert.deepEqual(here(P.unpackCandidates('x', 2)), []);
});

test('the student answers each offer once', () => {
  const live = { status: 'live', offer: { type: 'offer', sdp: 'v=0' }, rev: 3 };
  assert.equal(P.needsAnswer(live, null), true);
  assert.equal(P.needsAnswer(live, 3), false);
  assert.equal(P.needsAnswer({ ...live, rev: 4 }, 3), true);
  assert.equal(P.needsAnswer({ ...live, status: 'waiting' }, null), false);
  assert.equal(P.needsAnswer({ ...live, offer: null }, null), false);
  assert.equal(P.needsAnswer({ ...live, rev: 0 }, null), false);
  assert.equal(P.needsAnswer(null, null), false);
});

test('a pop-up only for a consult that is waiting, recent and still beating', () => {
  const now = 10_000_000;
  assert.equal(P.consultFresh({ status: 'waiting', at: now - 1000, seen: now - 1000 }, now), true);
  assert.equal(P.consultFresh({ status: 'live', at: now, seen: now }, now), false);
  assert.equal(P.consultFresh({ status: 'waiting', at: now - P.WAIT_FRESH_MS - 1, seen: now }, now), false);
  assert.equal(P.consultFresh({ status: 'waiting', at: now - 1000, seen: now - P.SEEN_FRESH_MS - 1 }, now), false);
  assert.equal(P.consultFresh({ status: 'waiting', at: 0 }, now), false);
  // A fast clock is read as now, never as fresh for ever.
  assert.equal(P.consultFresh({ status: 'waiting', at: now + 10 * P.WAIT_FRESH_MS, seen: now + 10 * P.WAIT_FRESH_MS }, now), true);
  assert.equal(P.consultFresh({ status: 'waiting', at: now - 1000 }, now), true, 'a missing seen reads as the ask');
  assert.equal(P.stampMs({ toMillis: () => 12 }), 12);
  assert.equal(P.stampMs(new Date(5)), 5);
  assert.equal(P.stampMs('9'), 9);
  assert.equal(P.stampMs(null), 0);
});

test('how long ago, and the line a pop-up says', () => {
  assert.equal(P.consultAgo(0), 'just now');
  assert.equal(P.consultAgo(59_000), 'just now');
  assert.equal(P.consultAgo(60_000), '1 min ago');
  assert.equal(P.consultAgo(5 * 60_000), '5 min ago');
  assert.equal(P.consultAgo(60 * 60_000), '1 hour ago');
  assert.equal(P.consultAgo(3 * 60 * 60_000), '3 hours ago');
  assert.equal(P.consultAgo(-5), 'just now');
  assert.equal(P.consultSummary({ level: 'P5', subject: 'science', worksheetName: 'Heat', view: { page: 2 } }), 'P5 Science · Heat · page 2');
  assert.equal(P.consultSummary({}), '');
  assert.equal(P.consultSummary(null), '');
  assert.equal(P.subjectWord('math'), 'Maths');
});

test('the stage keeps the shape of the page', () => {
  assert.deepEqual(here(P.fitStage(1000, 1000, 1.4142)), { w: 707, h: 1000 });
  assert.deepEqual(here(P.fitStage(500, 2000, 1.4142)), { w: 500, h: 707 });
  assert.deepEqual(here(P.fitStage(0, 100, 1.4)), { w: 0, h: 0 });
  assert.deepEqual(here(P.fitStage(100, 100, -1)), { w: 70, h: 100 }, 'a junk aspect is A4');
  assert.deepEqual(here(P.mirrorSize(595, 842)), { w: 1130, h: 1600 });
  const land = P.mirrorSize(842, 595);
  assert.equal(land.w, 1600);
  assert.equal(land.w % 2 + land.h % 2, 0, 'even sides');
  assert.deepEqual(here(P.mirrorSize(0, 0)), { w: 1132, h: 1600 });
});

test('a pointer on the stage is a point on the page, and off it is nothing', () => {
  const rect = { left: 100, top: 50, width: 200, height: 400 };
  assert.deepEqual(here(P.normFromRect(200, 250, rect)), [0.5, 0.5]);
  assert.deepEqual(here(P.normFromRect(101, 51, rect)), [0.005, 0.0025]);
  assert.deepEqual(here(P.normFromRect(99, 50, rect)), [0, 0], 'a hair past the edge is clamped');
  assert.equal(P.normFromRect(0, 0, rect), null);
  assert.equal(P.normFromRect(200, 250, { left: 0, top: 0, width: 0, height: 10 }), null);
});

test('the part of the page on the student\'s screen', () => {
  const page = { left: 0, top: -500, right: 600, bottom: 300, width: 600, height: 800 };
  const area = { left: 0, top: 0, right: 600, bottom: 400 };
  assert.deepEqual(here(P.visibleBox(page, area)), [0, 0.625, 1, 1]);
  assert.equal(P.visibleBox({ ...page, top: 500, bottom: 1300 }, area), null);
  assert.equal(P.visibleBox(null, area), null);
});

test('the data channel accepts five shapes and nothing else', () => {
  const ink = P.parseMessage(JSON.stringify({ t: 'ink', id: 'stroke_1', page: 1, ws: 'w', c: '#1A1A1A', w: 0.003, p: [0.1, 0.1] }));
  assert.equal(ink.t, 'ink');
  assert.equal(ink.stroke.id, 'stroke_1');
  assert.deepEqual(here(P.parseMessage('{"t":"drop","id":"stroke_1"}')), { t: 'drop', id: 'stroke_1' });
  assert.equal(P.parseMessage('{"t":"drop","id":"x"}'), null);
  assert.deepEqual(here(P.parseMessage('{"t":"clear"}')), { t: 'clear' });
  assert.deepEqual(here(P.parseMessage('{"t":"laser","page":2,"ws":"w","x":3,"y":-1}')), { t: 'laser', ws: 'w', page: 2, x: 1, y: 0 });
  assert.equal(P.parseMessage('{"t":"laser","page":0}'), null);
  assert.equal(P.parseMessage('{"t":"view","view":{"page":3,"n":4,"aspect":1.3,"title":"T","ws":"w"}}').view.page, 3);
  for (const bad of ['', 'not json', '{"t":"eval","code":"x"}', '[]', 'null', 42, 'x'.repeat(70000)])
    assert.equal(P.parseMessage(bad), null, String(bad).slice(0, 20));
});

test('a view is cleaned, compared and matched to a stroke', () => {
  const v = P.cleanView({ ws: 'w', page: 2.7, n: 5, aspect: 99, title: ' A\nB ' });
  assert.deepEqual(here(v), { ws: 'w', page: 2, n: 5, aspect: 1.4142, title: 'A B' });
  assert.deepEqual(here(P.cleanView(null)), { ws: '', page: 0, n: 0, aspect: 1.4142, title: '' });
  assert.equal(P.sameView(v, { ...v }), true);
  assert.equal(P.sameView(v, { ...v, page: 3 }), false);
  assert.equal(P.sameView(null, v), false);
  assert.equal(P.strokeOnView({ ws: 'w', page: 2 }, v), true);
  assert.equal(P.strokeOnView({ ws: 'w', page: 1 }, v), false);
  assert.equal(P.strokeOnView({ ws: 'other', page: 2 }, v), false);
});

test('words for the student, and ids', () => {
  assert.equal(P.statusWords('waiting'), 'Waiting for Mr Chung…');
  assert.equal(P.statusWords('live'), 'Mr Chung is with you');
  assert.equal(P.statusWords('ended', 'teacher'), 'Mr Chung ended the consult.');
  assert.equal(P.statusWords('ended', 'student'), 'The consult has ended.');
  assert.equal(P.statusWords('nonsense'), '');
  assert.equal(P.notifyWords(null), '');
  assert.ok(P.notifyWords({ ok: true }).includes('emailed'));
  assert.ok(P.notifyWords({ ok: false, code: 'already' }).includes('a moment ago'));
  assert.ok(P.notifyWords({ ok: false, code: 'daily_limit' }).includes('pop-up'));
  assert.ok(P.notifyWords({ ok: false, code: 'network' }).includes('pop-up'), 'a failed email still points at the pop-up');
  const a = P.rid(20), b = P.rid(20);
  assert.equal(a.length, 20);
  assert.notEqual(a, b);
  assert.ok(/^[A-Za-z0-9]+$/.test(a));
});

/* ---------------- The rules nobody can see from a screen ---------------- */

test('the client never names an email address and never sends mail itself', () => {
  const addresses = SRC.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [];
  assert.deepEqual(addresses, [], 'consult.js names no address; the server holds the only one');
  assert.ok(!/mailto:/i.test(SRC));
  assert.ok(!/collection\(\s*['"]mail/i.test(SRC), 'the client never writes a mail queue');
  assert.ok(!/tutorCentreAdmin/.test(SRC), 'the client never touches the server-only path');
  // What the client posts is the id and nothing else.
  const post = SRC.slice(SRC.indexOf('async function notifyTeacher'), SRC.indexOf('async function openMic'));
  assert.match(post, /body: JSON\.stringify\(\{ consultId: id \}\)/);
});

test('the teacher\'s ink is never an annotation and never markup', () => {
  assert.ok(!/annotations\s*\.\s*(push|splice|unshift)/.test(SRC), 'never written into annotations');
  assert.ok(!/annotations\s*=/.test(SRC), 'never replaces annotations');
  assert.ok(!/pushUndo|setDirty|performSave/.test(SRC), 'never saves, never undoes');
  assert.ok(!/\.innerHTML\s*=/.test(SRC), 'every word is textContent');
  assert.ok(!/insertAdjacentHTML/.test(SRC));
  assert.match(CSS, /svg\.consultInk\s*\{[^}]*pointer-events:\s*none/, 'the layer over the page takes no pointer');
  assert.match(CSS, /@media print\s*\{[^}]*svg\.consultInk/, 'it never prints');
});

test('the page goes out as a canvas mirror, not a screen share', () => {
  assert.ok(!/getDisplayMedia\s*\(/.test(SRC), 'an iPad has no screen share');
  assert.match(SRC, /captureStream\(/);
  assert.match(SRC, /drawAnnsOnCtx\(/, 'the mirror carries the student\'s own ink');
  // The page mirrored is `visiblePage()`, which is drawn only from the pages
  // the student has — never a hidden answer-key page.
  assert.match(SRC, /global\.visiblePage\(\)/, 'the mirror reads the page the student is on, never a hidden key page');
});

test('index.html wires the button, the files, the account hook and the usage row', () => {
  assert.match(HTML, /<link rel="stylesheet" href="consult\.css\?v=1\.63\.0">/);
  assert.match(HTML, /<script src="consult\.js\?v=1\.63\.0"><\/script>/);
  assert.match(HTML, /id="consultBtn"[^>]*hidden/, 'hidden until consult.js decides who may see it');
  assert.match(HTML, /var APP_VERSION = 'v1\.63\.0';/);
  assert.match(HTML, /consult:\s*\{ label: 'Asked for a consult', count: 'consults' \}/);
  const hook = HTML.indexOf('TutorConsult.authChanged(currentUser)');
  assert.ok(hook > 0, 'the auth handler tells consult.js who is signed in');
  const handler = HTML.lastIndexOf('auth.onAuthStateChanged', hook);
  assert.ok(handler > 0 && hook - handler < 3000, 'inside the auth handler');
  assert.ok(HTML.lastIndexOf('currentUser = user || null;', hook) > handler, 'after currentUser is set');
  assert.match(HTML.slice(hook - 200, hook), /typeof TutorConsult !== 'undefined'/, 'guarded for a blocked file');
  // The script loads after the main app, whose globals it reads.
  assert.ok(HTML.indexOf('<script src="consult.js') > HTML.indexOf('var APP_VERSION'));
});

test('the watcher and the room are the teacher\'s alone, refused in the handler', () => {
  const open = SRC.slice(SRC.indexOf('async function openRoom'), SRC.indexOf('async function openRoom') + 900);
  assert.match(open, /if \(!admin\(\)\)/, 'openRoom asks isAdmin before anything');
  const watch = SRC.slice(SRC.indexOf('function startWatcher'), SRC.indexOf('function startWatcher') + 600);
  assert.match(watch, /admin\(\)/);
  assert.match(SRC, /where\('status', '==', 'waiting'\)/);
});

test('a heartbeat, a pagehide and an account change all let go', () => {
  assert.match(SRC, /addEventListener\('pagehide'/);
  const auth = SRC.slice(SRC.indexOf('function authChanged'), SRC.indexOf('function authChanged') + 700);
  assert.match(auth, /resetStudent\(true\)/);
  assert.match(auth, /teardownRoom\(\)/);
  assert.match(auth, /stopWatcher\(\)/);
});
