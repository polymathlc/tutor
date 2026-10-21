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
const CA_SRC = fs.readFileSync(new URL('../consult-answer.js', import.meta.url), 'utf8');
const CA_CSS = fs.readFileSync(new URL('../consult-answer.css', import.meta.url), 'utf8');
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
  assert.deepEqual(here(v), { ws: 'w', page: 2, n: 5, aspect: 1.4142, title: 'A B', zoom: 0, box: null });
  assert.deepEqual(here(P.cleanView(null)), { ws: '', page: 0, n: 0, aspect: 1.4142, title: '', zoom: 0, box: null });
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
  assert.match(HTML, /<link rel="stylesheet" href="consult\.css\?v=1\.65\.0">/);
  assert.match(HTML, /<link rel="stylesheet" href="consult-answer\.css\?v=1\.65\.0">/);
  assert.match(HTML, /<script src="consult-answer\.js\?v=1\.65\.0"><\/script>\s*<script src="consult\.js\?v=1\.65\.0"><\/script>/,
    'the recorder loads first, so consult.js finds window.ConsultAnswer');
  assert.match(HTML, /id="consultBtn"[^>]*hidden/, 'hidden until consult.js decides who may see it');
  assert.match(HTML, /var APP_VERSION = 'v1\.(6[3-9]|[7-9]\d|\d{3})\.\d+';/);
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
  const watch = SRC.slice(SRC.indexOf('function startWatcher'), SRC.indexOf('function stopWatcher'));
  assert.match(watch, /admin\(\)/);
  assert.match(watch, /listen\('waiting', 'call'\)/, 'one equality listener for the calls');
  assert.match(watch, /listen\('question', 'question'\)/, 'and one for the questions left');
  assert.match(watch, /where\('status', '==', status\)/);
});

test('a heartbeat, a pagehide and an account change all let go', () => {
  assert.match(SRC, /addEventListener\('pagehide'/);
  const auth = SRC.slice(SRC.indexOf('function authChanged'), SRC.indexOf('function authChanged') + 700);
  assert.match(auth, /resetStudent\(true\)/);
  assert.match(auth, /teardownRoom\(\)/);
  assert.match(auth, /stopWatcher\(\)/);
});

/* ---------------- v1.64.0: the teacher's hand on the student's page ---------------- */

test('a nav is cleaned and clamped once, and a no-op is refused', () => {
  const id = 'nav_abcdef12';
  const z = here(P.cleanNav({ id, op: 'zoom', ws: 'w', at: 5, f: 9, page: 2, x: 1.4, y: -3 }));
  assert.deepEqual(z, { t: 'nav', id, op: 'zoom', ws: 'w', at: 5, f: P.NAV_ZOOM_MAX, page: 2, x: 1, y: 0 });
  assert.equal(P.cleanNav({ id, op: 'zoom', f: 0.01 }).f, P.NAV_ZOOM_MIN);
  assert.equal(P.cleanNav({ id, op: 'zoom', f: 1 }), null, 'a zoom by 1 does nothing and is not sent');
  assert.equal(P.cleanNav({ id, op: 'zoom', f: 'x' }), null);
  assert.equal(here(P.cleanNav({ id, op: 'fit' })).op, 'fit');
  assert.equal(P.cleanNav({ id, op: 'page', step: 1 }).step, 1);
  assert.equal(P.cleanNav({ id, op: 'page', step: -1 }).step, -1);
  assert.equal(P.cleanNav({ id, op: 'page', step: 3 }), null, 'one page at a time');
  assert.equal(P.cleanNav({ id, op: 'center', page: 0, x: 0.5, y: 0.5 }), null);
  assert.equal(P.cleanNav({ id, op: 'center', page: 3, x: 0.5, y: 0.25 }).y, 0.25);
  assert.equal(P.cleanNav({ id, op: 'scroll-to-hell' }), null);
  assert.equal(P.cleanNav({ id: 'x', op: 'fit' }), null, 'an id the dedupe cannot trust');
  assert.equal(P.cleanNav(null), null);
});

test('a pan keeps its SIGN — leftward and upward pans are not thrown away', () => {
  const id = 'nav_abcdef12';
  const left = P.cleanNav({ id, op: 'pan', dx: -0.2, dy: 0 });
  assert.ok(left, 'a leftward pan survives');
  assert.equal(left.dx, -0.2);
  const up = P.cleanNav({ id, op: 'pan', dx: 0, dy: -0.35 });
  assert.equal(up.dy, -0.35);
  assert.equal(P.cleanNav({ id, op: 'pan', dx: -9, dy: 9 }).dx, -P.NAV_PAN_MAX, 'clamped to one page');
  assert.equal(P.cleanNav({ id, op: 'pan', dx: 0.0001, dy: -0.0001 }), null, 'a tremor is not a pan');
  assert.equal(P.parseMessage(JSON.stringify({ t: 'nav', id, op: 'pan', dx: -0.1, dy: 0.1 })).dx, -0.1);
});

test('only a FRESH nav on the document moves a page', () => {
  assert.equal(P.navFresh({ at: 1000 }, 1000 + 5000), true);
  assert.equal(P.navFresh({ at: 1000 }, 1000 + P.NAV_FRESH_MS + 1), false);
  assert.equal(P.navFresh({ at: 0 }, 5), false);
  assert.equal(P.navFresh(null, 5), false);
});

test('continuous navs fold into one write when the channel is down', () => {
  const a = { t: 'nav', id: 'nav_aaaaaa', op: 'pan', ws: 'w', at: 1, dx: 0.1, dy: -0.2 };
  const b = { t: 'nav', id: 'nav_bbbbbb', op: 'pan', ws: 'w', at: 2, dx: -0.05, dy: -0.1 };
  const m = here(P.navMerge(a, b));
  assert.equal(m.id, 'nav_bbbbbb');
  assert.equal(m.at, 2);
  assert.equal(m.dx, 0.05);
  assert.equal(m.dy, -0.3);
  const far = P.navMerge({ ...a, dx: 0.9 }, { ...b, dx: 0.9 });
  assert.equal(far.dx, P.NAV_PAN_MAX, 'a long drag never folds past one page');
  const z1 = { t: 'nav', id: 'nav_zzzzz1', op: 'zoom', ws: 'w', at: 1, f: 1.5, page: 1, x: 0.1, y: 0.1 };
  const z2 = { t: 'nav', id: 'nav_zzzzz2', op: 'zoom', ws: 'w', at: 2, f: 1.2, page: 2, x: 0.6, y: 0.7 };
  const zm = here(P.navMerge(z1, z2));
  assert.equal(zm.f, 1.8);
  assert.equal(zm.page, 2, 'the latest point is where the fingers are now');
  assert.equal(zm.x, 0.6);
  assert.equal(P.navMerge({ ...z1, f: 2 }, { ...z2, f: 2 }).f, P.NAV_ZOOM_MAX);
  assert.equal(P.navMerge(a, z1), null, 'a pan and a zoom do not fold');
  assert.equal(P.navMerge(a, { ...b, ws: 'other' }), null, 'two worksheets do not fold');
  assert.equal(P.navMerge({ ...a, op: 'fit' }, { ...b, op: 'fit' }), null, 'a discrete nav is never folded');
  assert.equal(P.navMerge(null, b), null);
});

test('two fingers: the span and the point between them', () => {
  const s = here(P.pinchSpan({ x: 0, y: 0 }, { x: 3, y: 4 }));
  assert.deepEqual(s, { d: 5, x: 1.5, y: 2 });
  assert.equal(P.pinchSpan(null, { x: 1, y: 1 }), null);
});

test('stepping pages walks only the pages the student has', () => {
  assert.equal(P.stepPage([1, 2, 4], 2, 1), 4, 'a hidden key page is stepped over');
  assert.equal(P.stepPage([1, 2, 4], 4, 1), null, 'the last page says so');
  assert.equal(P.stepPage([1, 2, 4], 1, -1), null);
  assert.equal(P.stepPage([2, 4], 3, -1), 2, 'from a hidden page, the nearest one that way');
  assert.equal(P.stepPage([], 1, 1), null);
  assert.equal(P.zoomPercent(1.25), '125%');
  assert.equal(P.zoomPercent(0), '');
});

test('the student panel is dragged and always pulled back onto the screen', () => {
  assert.deepEqual(here(P.clampPanelPos({ x: 50, y: 60 }, 300, 200, 800, 600, 8)), { x: 50, y: 60 });
  assert.deepEqual(here(P.clampPanelPos({ x: 900, y: 900 }, 300, 200, 800, 600, 8)), { x: 492, y: 392 });
  assert.deepEqual(here(P.clampPanelPos({ x: -50, y: -9 }, 300, 200, 800, 600, 8)), { x: 8, y: 8 });
  // A tablet turned on its side: a panel taller than the screen still has its head on it.
  assert.deepEqual(here(P.clampPanelPos({ x: 10, y: 400 }, 300, 900, 800, 600, 8)), { x: 10, y: 8 });
  assert.equal(P.clampPanelPos({ x: NaN, y: 1 }, 1, 1, 10, 10), null);
  assert.equal(P.clampPanelPos(null, 1, 1, 10, 10), null);
});

test('the room has the zoom, fit, page and move controls, and they work by touch', () => {
  for (const s of ["'cGroup cNav'", "'cViewBox'", "roomToolBtn('✋'", "sendNav('fit'", "sendNav('page', { step: -1 })", "sendNav('page', { step: 1 })"])
    assert.ok(SRC.includes(s), s);
  // Touch: a second finger is a pinch, and the stroke it interrupted is dropped rather than left as a dot.
  assert.match(SRC, /function startPinch/);
  assert.match(SRC, /abandonStroke/);
  // Every listener the room adds comes down with it.
  assert.match(SRC, /orientationchange/);
  assert.match(SRC, /removeEventListener\('orientationchange'/);
  // The stage keeps the browser's own pinch and scroll off it.
  assert.match(CSS, /\.cInk \{[^}]*touch-action: none/);
  assert.match(CSS, /\.cInk\[data-mode="move"\]/);
  assert.match(CSS, /\.cViewBox \{[^}]*pointer-events: none/);
  assert.match(CSS, /@media \(pointer: coarse\)/);
  assert.match(CSS, /100dvh/);
  assert.match(CSS, /safe-area-inset-bottom/);
  assert.match(CSS, /orientation: landscape/);
});

test('the student obeys a nav only through their own app, once each', () => {
  assert.match(SRC, /function applyNav/);
  assert.match(SRC, /seenNav/);
  // Never a new way to scroll a child's page: the app's own zoomAt / fitWidth.
  assert.match(SRC, /zoomAt/);
  assert.match(SRC, /fitWidth/);
});

/* ---------------- v1.65.0: a question left, and the recorded answer ---------------- */

function loadCA() {
  const sandbox = { console, Math, Date, Number, String, Array, Object, JSON };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(CA_SRC, sandbox, { filename: 'consult-answer.js' });
  return sandbox.ConsultAnswer;
}
const CA = loadCA();

test('consult-answer.js loads with no DOM and the two files agree on the collection and the cap', () => {
  assert.equal(typeof CA.pure, 'object');
  assert.equal(CA.open, undefined, 'no window to open without a document');
  assert.equal(CA.pure.COLLECTION, P.COLLECTION);
  assert.equal(CA.pure.QUESTION_MAX, P.QUESTION_MAX);
  assert.equal(server.QUESTION_MAX, P.QUESTION_MAX, 'the server bounds the question the same');
});

test('consult-answer.js is byte for byte the Ans Key copy, when both are checked out', (t) => {
  const twinJs = new URL('../../anskey/consult-answer.js', import.meta.url);
  const twinCss = new URL('../../anskey/consult-answer.css', import.meta.url);
  if (!fs.existsSync(twinJs)) { t.skip('polymathlc/anskey is not checked out beside this repository'); return; }
  assert.equal(fs.readFileSync(twinJs, 'utf8'), CA_SRC, 'consult-answer.js differs from Ans Key\'s copy');
  assert.equal(fs.readFileSync(twinCss, 'utf8'), CA_CSS, 'consult-answer.css differs from Ans Key\'s copy');
});

test('the recorder keeps the consult\'s bans: no address, no annotations, no screen share, no markup', () => {
  // The header comment names the bans; the code is what must keep them.
  const CODE = CA_SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const addresses = CODE.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [];
  assert.deepEqual(addresses, []);
  assert.ok(!/mailto:|tutorCentreAdmin/.test(CODE));
  assert.ok(!/annotations\s*(\.\s*(push|splice|unshift)|=[^=])/.test(CODE), 'never writes annotations');
  assert.ok(!/pushUndo|setDirty|performSave/.test(CODE));
  assert.ok(!/getDisplayMedia\s*\(/.test(CODE), 'the video is a canvas, never the screen');
  assert.ok(!/\.innerHTML\s*=|insertAdjacentHTML/.test(CODE), 'every word is textContent');
  // Every door is the teacher's, asked in the handler.
  for (const fn of ['async function askLater', 'async function open', 'async function sendReply']) {
    const at = CA_SRC.indexOf(fn);
    assert.ok(at > 0, fn);
    assert.match(CA_SRC.slice(at, at + 200), /teacherHere\(\)/, fn + ' asks teacherHere first');
  }
  assert.match(CA_SRC, /runTransaction/, 'Not now and Send re-read the consult');
});

test('a reply link is Firebase Storage or nothing, and a reply path is a lesson folder', () => {
  const p = CA.pure;
  assert.equal(p.replyUrlOk('https://firebasestorage.googleapis.com/v0/b/x/o/a.mp4?alt=media'), true);
  for (const bad of ['javascript:alert(1)', 'https://evil.example/a.mp4', 'http://firebasestorage.googleapis.com/x', '', null, 5])
    assert.equal(p.replyUrlOk(bad), false, String(bad));
  assert.equal(p.cleanReply({ url: 'https://evil.example/a.mp4', mime: 'video/mp4' }), null);
});

test('a box is two corners in order, as fractions of the page; a tap is the whole page', () => {
  assert.equal(P.qBoxFrom(10, 10, 12, 13, 400, 600), null, 'a tap');
  assert.deepEqual(here(P.qBoxFrom(300, 450, 100, 150, 400, 600)), [0.25, 0.25, 0.75, 0.75], 'dragged up and left');
  assert.deepEqual(here(P.qBoxFrom(-50, 0, 500, 300, 400, 600)), [0, 0, 1, 0.5], 'clamped to the page');
  assert.equal(P.qBoxFrom(0, 0, 100, 100, 0, 600), null, 'a page with no size');
  assert.equal(P.qBoxFrom(0, 0, 400, 2, 400, 6000), null, 'a sliver is not a box');
  // What the student sends is what the teacher's side accepts.
  const box = P.qBoxFrom(40, 60, 200, 300, 400, 600);
  assert.deepEqual(here(CA.pure.cleanQBox(box)), here(box));
});

test('a question is text, bounded and folded', () => {
  assert.equal(P.qClean('  why   is\r\n\r\n\r\n\r\nthis  '), 'why is\n\nthis');
  assert.equal(P.qClean(null), '');
  assert.equal(P.qClean('x'.repeat(2000)).length, P.QUESTION_MAX);
});

test('what the teacher is told when a room is no longer a call', () => {
  const d = { studentName: 'Ada', endedBy: 'student' };
  assert.match(P.roomGoneText('question', d), /^Ada left a question/);
  assert.match(P.roomGoneText('later', d), /asked to leave a question/);
  assert.match(P.roomGoneText('ended', d), /^Ada ended/);
  assert.match(P.roomGoneText('ended', {}), /^The consult has ended/);
  assert.match(P.roomGoneText('cancelled', null), /^The student cancelled/);
  assert.match(P.roomGoneText('nonsense', d), /no longer there/);
  for (const k of ['question', 'answered', 'later', 'cancelled', 'ended', 'live', 'failed', 'gone'])
    assert.ok(P.roomGoneText(k, d).length > 10, k);
});

function fakeDb(status) {
  const doc = { status };
  const writes = [];
  const ref = { async update(p) { writes.push(['plain', p]); Object.assign(doc, p); } };
  const db = {
    async runTransaction(run) {
      return run({
        get: async () => ({ exists: doc.status != null, data: () => ({ ...doc }) }),
        update: (r, p) => { writes.push(['tx', p]); Object.assign(doc, p); }
      });
    }
  };
  return { doc, writes, ref, db };
}

test('guardedUpdate writes only over an allowed status, and never throws', async () => {
  const f = fakeDb('waiting');
  const c = load({ db: f.db });
  const g = c.TutorConsult._internals.guardedUpdate;
  assert.equal(await g(f.ref, ['waiting', 'later'], { status: 'question' }), 'ok');
  assert.equal(f.doc.status, 'question');
  // A teacher's offer landing a moment later finds the question and writes nothing.
  assert.equal(await g(f.ref, ['waiting', 'later', 'live'], { status: 'live', offer: 'x' }), 'question');
  assert.equal(f.doc.status, 'question');
  assert.equal(f.doc.offer, undefined);
  assert.equal(f.writes.length, 1);
  const gone = fakeDb(null);
  assert.equal(await load({ db: gone.db }).TutorConsult._internals.guardedUpdate(gone.ref, ['waiting'], { status: 'ended' }), 'gone');
  const broken = { async runTransaction() { throw new Error('offline'); } };
  assert.equal(await load({ db: broken }).TutorConsult._internals.guardedUpdate(f.ref, ['question'], {}), 'failed');
  assert.equal(await g(null, ['waiting'], {}), 'gone');
});

test('every write that could undo another is guarded', () => {
  const offer = SRC.slice(SRC.indexOf('async function negotiateOnce'), SRC.indexOf('function bindTeacherChannel'));
  assert.match(offer, /guardedUpdate\(T\.ref, allowed,/, 'the offer');
  assert.match(offer, /T\.firstOffer \? \['waiting', 'later', 'live'\] : \['waiting', 'live'\]/, 'only the first offer may be made over later');
  assert.ok(!/T\.ref\.update\(\{\s*status: 'live'/.test(SRC), 'no plain write of live');
  const leave = SRC.slice(SRC.indexOf('async function leaveRoom'), SRC.indexOf('function teardownRoom'));
  assert.match(leave, /guardedUpdate\(ref, \['waiting', 'live', 'later'\]/, 'End never closes a question');
  assert.match(leave, /guardedUpdate\(ref, \['live'\]/, 'leaving puts back only a live call');
  const hide = SRC.slice(SRC.indexOf('function teacherPageHide'), SRC.indexOf('function teacherPageHide') + 700);
  assert.match(hide, /T\.data\.status === 'live'/);
  assert.match(hide, /\.catch\(/);
  const send = SRC.slice(SRC.indexOf('async function sendQuestion'), SRC.indexOf('function voiceCanQ'));
  assert.match(send, /guardedUpdate\(ref, \['waiting', 'later'\]/, 'a question never cuts off a live call');
  const sup = SRC.slice(SRC.indexOf('function supervise'), SRC.indexOf('function pushSnapshot'));
  assert.match(sup, /guardedUpdate\(S\.ref, \['live'\]/);
});

test('a room ends on a question or an answer, and on later only after its own offer landed', () => {
  const room = SRC.slice(SRC.indexOf('function onRoomDoc'), SRC.indexOf('function setTeacherView'));
  assert.match(room, /data\.status === 'question' \|\| data\.status === 'answered'/);
  assert.match(room, /data\.status === 'later' && T\.docReady && \(Number\(data\.rev\) \|\| 0\) >= T\.rev/);
  const open = SRC.slice(SRC.indexOf('async function openRoom'), SRC.indexOf('async function openLocalMedia'));
  assert.match(open, /answerApi\(\)/, 'a question link opens the recorder, never a call');
  assert.match(open, /T\.firstOffer = true/);
  assert.match(open, /await negotiate\(\);\s*\/\/[^\n]*\n[^\n]*\n\s*if \(gen !== T\.gen \|\| T\.id !== id\) return false;/);
});

test('the pop-ups: Join, Not now and Hide for a call; Answer and Hide for a question; at most four', () => {
  assert.equal(P.ALERT_SHOW_MAX, 4);
  const call = SRC.slice(SRC.indexOf('function callCard'), SRC.indexOf('function questionCard'));
  assert.match(call, /'Join'/);
  assert.match(call, /'✋ Not now'/);
  assert.match(call, /api\.askLater\(item\.id\)/);
  assert.match(call, /'Hide'/);
  assert.ok(!/'Later'/.test(call), 'the old Later button is Hide now');
  const q = SRC.slice(SRC.indexOf('function questionCard'), SRC.indexOf('function updateTitle'));
  assert.match(q, /'📝 Answer'/);
  assert.match(q, /api\.open\(item\.id\)/);
  assert.match(SRC, /var key = doc\.id \+ ':' \+ kind;/, 'cards are keyed id:kind');
  assert.match(CSS, /\.consultAlertQ/);
});

test('the pick never writes on the page, and the box never prints', () => {
  const pick = SRC.slice(SRC.indexOf('function bindPick'), SRC.indexOf('function clearQBox'));
  for (const ev of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) assert.match(pick, new RegExp("'" + ev + "', \\w+, true"), ev + ' in the capture phase');
  assert.match(CSS, /\.consultQBox\s*\{[^}]*pointer-events:\s*none/);
  assert.match(CSS, /@media print\s*\{[^}]*\.consultQBox/);
  assert.match(CSS, /body\.consultPicking \.pageWrap\s*\{\s*cursor: crosshair/);
  assert.match(CSS, /\.consultReplies\s*\{/);
  assert.match(CSS, /\.consultReplyPlayer\s*\{/);
});

test('the answers come back to the student, and go with the account', () => {
  const auth = SRC.slice(SRC.indexOf('function authChanged'), SRC.indexOf('function wire'));
  assert.match(auth, /replyWatchStop\(\)/);
  assert.match(auth, /ConsultAnswer\.stop\(\)/);
  assert.match(auth, /replyWatchStart\(u\)/);
  const watch = SRC.slice(SRC.indexOf('function replyWatchStart'), SRC.indexOf('function replyWatchStop'));
  assert.match(watch, /where\('studentUid', '==', uid\)\.where\('status', '==', 'answered'\)/, 'only this student\'s own answers');
  assert.match(watch, /cleanReply\(x\.reply\)/, 'a reply comes in through the one door');
  assert.match(HTML, /consultQuestion:\s*\{ label:/);
  assert.match(HTML, /consultReply:\s*\{ label:/);
  assert.match(HTML, /consultAnswer:\s*\{ label:/);
});

test('the student\'s panel says "they", never "he"', () => {
  const strings = SRC.match(/'[^'\n]*'/g) || [];
  const gendered = strings.filter(t => /\b(he|He|him|his|His)\b/.test(t));
  assert.deepEqual(gendered, []);
});

/* ---------------- v1.66.0: where it is all kept ---------------- */

const J = v => JSON.parse(JSON.stringify(v));
const NOW = new Date(2026, 9, 21, 15, 0).getTime();
const REPLY = { url: 'https://firebasestorage.googleapis.com/v0/b/x/o/a.webm?alt=media', mime: 'video/webm', ms: 4000, note: 'Look at the units', at: NOW - 3600000 };
const base = (over) => Object.assign({ studentUid: 'u1', studentName: 'Ada', worksheetName: 'Heat', level: 'P5', subject: 'science', at: NOW - 7200000 }, over);

test('every consult has ONE state, read off its own document', () => {
  const L = CA.pure.logState;
  assert.equal(L(base({ status: 'waiting', at: NOW - 1000, seen: NOW - 1000 }), NOW), 'ringing');
  assert.equal(L(base({ status: 'waiting', at: NOW - 1000, seen: NOW - 10 * 60000 }), NOW), 'missed', 'a call whose tab stopped beating rang out');
  assert.equal(L(base({ status: 'waiting', at: NOW - 3600000, seen: NOW }), NOW), 'missed', 'a call left half an hour is not ringing');
  assert.equal(L(base({ status: 'ended', joinedAt: NOW - 100 }), NOW), 'talked');
  assert.equal(L(base({ status: 'ended' }), NOW), 'missed', 'ended with nobody joining is a missed call');
  assert.equal(L(base({ status: 'answered' }), NOW), 'answered');
  assert.equal(L(base({ status: 'answered', replySeen: NOW }), NOW), 'watched');
  for (const s of ['live', 'later', 'question', 'cancelled']) assert.equal(L(base({ status: s }), NOW), s);
  assert.equal(L(base({ status: 'nonsense' }), NOW), 'other');
});

test('a log row carries the words through the one door, and the reply only when it will play', () => {
  const r = CA.pure.logRow('abcdefghijkl12345678', base({ status: 'answered', studentName: 'Ada\u0000 <b>x</b>', reply: REPLY, question: { text: 'Why  is 1 unit 4?', page: 2, at: NOW - 7000000 } }), NOW);
  assert.equal(r.who, 'Ada <b>x</b>', 'control characters folded; markup is kept as text, painted with textContent');
  assert.equal(r.text, 'Why is 1 unit 4?');
  assert.equal(r.page, 2);
  assert.equal(r.reply.url, REPLY.url);
  assert.equal(CA.pure.logRow('bad id', base({ status: 'answered' }), NOW), null);
  const evil = CA.pure.logRow('abcdefghijkl12345678', base({ status: 'answered', reply: { url: 'javascript:alert(1)' } }), NOW);
  assert.equal(evil.reply, null, 'a link that is not Firebase Storage is never played');
  assert.equal(CA.pure.logRow('abcdefghijkl12345678', base({ status: 'question', reply: REPLY }), NOW).reply, null, 'a stale reply on a question is not shown as an answer');
});

test('the teacher\'s list: what waits on them first, then newest; filters and every-word search', () => {
  const P2 = CA.pure;
  const docs = [
    ['aaaaaaaaaaaa00000001', base({ status: 'answered', reply: REPLY, at: NOW - 100, question: { text: 'fractions please', page: 1 } })],
    ['aaaaaaaaaaaa00000002', base({ status: 'question', at: NOW - 5000000, studentName: 'Ben', question: { text: 'what is a unit', page: 3 } })],
    ['aaaaaaaaaaaa00000003', base({ status: 'ended', joinedAt: 1, at: NOW - 50 })],
    ['aaaaaaaaaaaa00000004', base({ status: 'later', at: NOW - 9000000 })]
  ];
  const rows = P2.logSort(docs.map(([id, d]) => P2.logRow(id, d, NOW)));
  assert.deepEqual(J(rows.map(r => r.state)), ['question', 'later', 'talked', 'answered']);
  assert.deepEqual(J(P2.logCounts(rows)), { todo: 2, answered: 1, calls: 2, all: 4 });
  assert.deepEqual(J(P2.logFilter(rows, 'answered', '').map(r => r.id)), ['aaaaaaaaaaaa00000001']);
  assert.deepEqual(J(P2.logFilter(rows, 'all', 'ben unit').map(r => r.id)), ['aaaaaaaaaaaa00000002']);
  assert.deepEqual(J(P2.logFilter(rows, 'all', 'ben fractions')), [], 'every word must match, so a second word narrows');
  assert.equal(P2.logFilter(rows, 'all', 'HEAT').length, 4, 'case does not matter');
});

test('the student\'s shelf keeps every playable answer, newest first, and the questions still waiting', () => {
  const lib = CA.pure.libraryRows([
    { id: 'bbbbbbbbbbbb00000001', data: base({ status: 'answered', reply: Object.assign({}, REPLY, { at: NOW - 50000 }), replySeen: NOW }) },
    { id: 'bbbbbbbbbbbb00000002', data: base({ status: 'answered', reply: Object.assign({}, REPLY, { at: 0 }), answeredAt: NOW - 1000 }) },
    { id: 'bbbbbbbbbbbb00000003', data: base({ status: 'question' }) },
    { id: 'bbbbbbbbbbbb00000004', data: base({ status: 'ended' }) },
    { id: 'bbbbbbbbbbbb00000005', data: base({ status: 'answered', reply: { url: 'http://evil' } }) }
  ], NOW);
  assert.deepEqual(J(lib.answers.map(r => [r.id, r.fresh])), [['bbbbbbbbbbbb00000002', true], ['bbbbbbbbbbbb00000001', false]],
    'a watched answer stays on the shelf; a link that will not play is left off');
  assert.deepEqual(J(lib.waiting.map(r => r.id)), ['bbbbbbbbbbbb00000003']);
});

test('when, in words a reader acts on', () => {
  const W = CA.pure.whenText;
  assert.equal(W(new Date(2026, 9, 21, 9, 5).getTime(), NOW), 'Today 9:05 am');
  assert.equal(W(new Date(2026, 9, 20, 13, 30).getTime(), NOW), 'Yesterday 1:30 pm');
  assert.match(W(new Date(2026, 9, 17, 12, 0).getTime(), NOW), /^Sat 12:00 pm$|^Saturday 12:00 pm$/);
  assert.equal(W(new Date(2026, 2, 3, 8, 0).getTime(), NOW), '3 Mar');
  assert.equal(W(new Date(2025, 8, 3, 8, 0).getTime(), NOW), '3 Sep 2025', 'a year that is not this one says so');
  assert.equal(W(0, NOW), '');
  assert.equal(W('junk', NOW), '');
});

test('the archive reads, never deletes, and its one write is the student\'s own "seen"', () => {
  const at = CA_SRC.indexOf('/* ---- The player ---- */');
  const end = CA_SRC.indexOf('/* ---- Closing ---- */');
  assert.ok(at > 0 && end > at);
  const ARCH = CA_SRC.slice(at, end);
  assert.ok(!/\.delete\(|\.set\(|runTransaction/.test(ARCH), 'nothing in the archive deletes or overwrites a consult');
  const updates = ARCH.match(/\.update\(/g) || [];
  assert.equal(updates.length, 1, 'one write: markSeen');
  assert.match(ARCH, /x\.update\(\{ replySeen: Date\.now\(\) \}\)/);
  assert.match(ARCH.slice(ARCH.indexOf('function markSeen')), /u\.uid !== s\.uid/, 'only on the student\'s own consult');
  assert.match(ARCH.slice(ARCH.indexOf('function openLog'), ARCH.indexOf('function openLog') + 120), /teacherHere\(\)/, 'the log is the teacher\'s, refused in the handler');
  assert.match(ARCH, /where\('studentUid', '==', s\.uid\)/, 'the library reads only the student\'s own consults');
  assert.ok(!/\.innerHTML\s*=|insertAdjacentHTML/.test(ARCH));
  assert.match(CA_SRC.slice(CA_SRC.indexOf('function stop(')), /archiveStop\(\)/, 'an account change takes the archive down too');
});

test('the header button is one per account, wired to the right window', () => {
  assert.match(HTML, /<button class="btn" id="consultLogBtn" type="button" hidden/);
  const fn = SRC.slice(SRC.indexOf('function logButtonFor'), SRC.indexOf('function onButton'));
  assert.match(fn, /admin\(\)\) return practice\(\) \? '' : 'teacher'/, 'the teacher practising as a student sees neither');
  assert.match(fn, /CA\.openLog\(/);
  assert.match(fn, /CA\.openLibrary\(\)/);
  assert.match(SRC, /consultAlertAll/, 'the pop-up stack names where the hidden ones went');
});
