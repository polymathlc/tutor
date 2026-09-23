/* =====================================================================
   🎬 VIDEO SOLUTIONS — the teacher records, the class watches  (v1.55.0)
   ---------------------------------------------------------------------
   Loads the REAL sections out of index.html and runs them against stubs:
   the one door a list of videos comes in by, which list a paper's copy
   reads, the one writer (against a Firestore that can be told to refuse
   either half), the live follow, the shelf's mark, the pill's label, the
   folder fallback, the replay's fitted zoom, the playlist's order and the
   question guess. Then it reads the shipped source for the rules no pure
   function can carry: who may record, move, rename, delete and export;
   that a video is never ink; that the recorder mixes the microphone and
   nothing else; and every hook that tears a replay, a playlist or a live
   list down when the worksheet or the account changes.

   tools/lesson-check.mjs is the other half: a real browser, a real camera,
   a real recording, a real student copy and a real 1080p file. It needs
   Playwright, so it is a tool you reach for; this one runs in CI.
   ===================================================================== */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

function cut(from, to, src) {
  const s = src || html;
  const a = s.indexOf(from), b = s.indexOf(to, a);
  assert.ok(a >= 0 && b > a, 'section must exist: ' + from);
  return s.slice(a, b);
}
/* A top-level function, from its declaration to the brace that closes it at
   column 0 — every top-level function in this file is written that way. A
   one-line function ends on its own line. Nothing here tries to parse the
   language: a hand-rolled stripper is the trap tools/tutor-tests.mjs names. */
function fnSrc(name, src) {
  const s = src || html;
  const m = new RegExp('\\n(?:async )?function ' + name + '\\(').exec(s);
  assert.ok(m, name + ' is declared');
  const start = m.index + 1;
  const lineEnd = s.indexOf('\n', start);
  const first = s.slice(start, lineEnd);
  const opens = (first.match(/\{/g) || []).length, closes = (first.match(/\}/g) || []).length;
  if (opens > 0 && opens === closes) return first + '\n';
  const end = s.indexOf('\n}', start);
  assert.ok(end > start, name + ' closes');
  return s.slice(start, end + 2) + '\n';
}
function literal(name, src) {
  const m = new RegExp('var ' + name + ' = ([^;\\n]+);').exec(src || html);
  assert.ok(m, name + ' is declared as a literal');
  return m[1];
}

const HELPERS = cut('/* ================= Recording helpers ================= */', '/* ================= Lesson replay core ================= */');
const CORE = cut('/* ================= Lesson replay core ================= */', '/* ================= End lesson replay core ================= */');
const BACKGROUNDS = cut('/* ================= Lesson recording backgrounds ================= */', '/* ================= End lesson recording backgrounds ================= */');
const FINALIZE = cut('/* ================= Seekable lesson audio ================= */', '/* ================= Lesson camera and microphone ================= */');
const CAMERA = cut('/* ================= Lesson camera and microphone ================= */', '/* ================= End lesson camera and microphone ================= */');
const RECORDING = cut('/* ================= Synchronized lesson recording ================= */', '/* ================= End synchronized lesson recording ================= */');
const VIDEOS = cut('/* ================= 🎬 The video solutions on a worksheet ================= */', '/* ================= End the video solutions on a worksheet ================= */');
const TITLE = cut('/* ================= 🏷 Which question a lesson is for ================= */', '/* ================= End which question a lesson is for ================= */');
const EXPORT = cut('/* ================= 🎞 Lesson export — the replay as a 1080p video ================= */', '/* ================= End lesson export ================= */');
const PLAYLIST = cut("/* ================= 🎬 The worksheet's videos, one after another ================= */", '/* ================= End worksheet playlist ================= */');
// The whole block, header to foot — what the census reads.
const BLOCK = cut('🎬 VIDEO SOLUTIONS — the teacher records, the class watches  (v1.55.0)', '/* ================= End video solutions ================= */');

// Objects made inside the vm carry the vm's own prototypes, which strict deep
// equality counts as a difference; compare their plain shape instead.
const plain = v => JSON.parse(JSON.stringify(v));

/* ---- A DOM that is just enough ---- */
function mkNode(tag) {
  const cls = new Set();
  const n = {
    tagName: String(tag || 'div').toUpperCase(), children: [], style: {}, attrs: {}, listeners: {},
    hidden: false, textContent: '', innerHTML: '', value: '', disabled: false, title: '', type: '',
    clientWidth: 0, clientHeight: 0, offsetHeight: 0, offsetTop: 0, offsetLeft: 0, offsetWidth: 0, scrollTop: 0, scrollLeft: 0,
    classList: {
      add: (...c) => c.forEach(x => cls.add(x)), remove: (...c) => c.forEach(x => cls.delete(x)),
      toggle: (c, on) => { const want = on === undefined ? !cls.has(c) : !!on; if (want) cls.add(c); else cls.delete(c); return want; },
      contains: c => cls.has(c)
    },
    addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); },
    removeEventListener() {},
    setAttribute(k, v) { this.attrs[k] = String(v); },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; },
    hasAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k); },
    removeAttribute(k) { delete this.attrs[k]; },
    appendChild(c) { this.children.push(c); c.parentNode = this; return c; },
    replaceChildren(...c) { this.children = c; },
    remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(x => x !== this); },
    querySelector() { return null; }, querySelectorAll() { return []; },
    contains() { return false; }, closest() { return null; },
    focus() {}, blur() {}, click() {}, play() { return Promise.resolve(); }, pause() {}, load() {},
    getContext() { return null; },
    rect: { left: 0, top: 0, width: 0, height: 0 },
    getBoundingClientRect() { const r = this.rect; return { left: r.left, top: r.top, width: r.width, height: r.height, right: r.left + r.width, bottom: r.top + r.height }; }
  };
  Object.defineProperty(n, 'className', {
    get() { return [...cls].join(' '); },
    set(v) { cls.clear(); String(v).split(/\s+/).filter(Boolean).forEach(x => cls.add(x)); }
  });
  return n;
}

/* ---- A Firestore that is just enough, and can be told to refuse ---- */
function fakeDb(docs, opts) {
  const o = opts || {};
  const calls = [], listeners = [];
  const copy = v => v === undefined ? undefined : JSON.parse(JSON.stringify(v));
  return {
    calls, listeners, docs,
    collection(col) {
      return {
        doc(id) {
          const key = col + '/' + id;
          return {
            async get() {
              calls.push(['get', key]);
              if (o.getFails) throw new Error('offline');
              const d = docs[key];
              return { exists: !!d, data: () => copy(d) };
            },
            async update(patch) {
              calls.push(['update', key, copy(patch)]);
              if (o.refuse && o.refuse[key]) throw o.refuse[key];
              if (!docs[key]) { const e = new Error('No document to update: projects/x/databases/(default)/documents/' + key); e.code = 'not-found'; throw e; }
              Object.assign(docs[key], copy(patch));
            },
            async set(v, how) { calls.push(['set', key, copy(v), how]); docs[key] = copy(v); },
            onSnapshot(cb, err) {
              const l = { key, cb, err, live: true };
              listeners.push(l);
              return () => { l.live = false; };
            }
          };
        }
      };
    }
  };
}

/* ---- The box: the real sections, run against the stubs ---- */
function box(extra) {
  const nodes = {};
  const $ = id => nodes[id] || (nodes[id] = mkNode('div'));
  const ctx = vm.createContext({
    console, Math, Number, String, Array, Object, JSON, Date, Set, Map, RegExp, Error, TypeError, Promise, Symbol,
    isFinite, parseInt, parseFloat, encodeURIComponent, decodeURIComponent, setTimeout, clearTimeout, setInterval, clearInterval,
    URL, Blob, TextEncoder, TextDecoder, AbortController, Uint8Array, DataView, ArrayBuffer,
    $, __nodes: nodes,
    document: {
      addEventListener() {}, removeEventListener() {}, querySelectorAll() { return []; }, querySelector() { return null; },
      createElement: mkNode, createElementNS: (ns, t) => mkNode(t), body: mkNode('body'), hidden: false
    },
    window: { addEventListener() {}, removeEventListener() {}, MediaRecorder: null, innerWidth: 1280, innerHeight: 800, isSecureContext: true },
    navigator: {},
    HTMLCanvasElement: { prototype: {} },
    performance: { now: () => 0 },
    requestAnimationFrame: () => 0, cancelAnimationFrame() {},
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    prompt() { throw new Error('prompt() must not be reached here'); },
    confirm() { throw new Error('confirm() must not be reached here'); },
    ...(extra || {})
  });
  // The app's own globals these sections lean on — the REAL values and the
  // REAL small helpers, cut out of the file, so a rename there is a rename here.
  vm.runInContext([
    'var ADMIN_EMAIL = ' + literal('ADMIN_EMAIL') + ';',
    'var ADMIN_DISPLAY_NAME = ' + literal('ADMIN_DISPLAY_NAME') + ';',
    'var COLLECTION = ' + literal('COLLECTION') + ';',
    'var STORAGE_DIR = ' + literal('STORAGE_DIR') + ';',
    'var ASSIGN_COLLECTION = ' + literal('ASSIGN_COLLECTION') + ';',
    'var DRAG_SLOP_PX = ' + literal('DRAG_SLOP_PX') + ';',
    fnSrc('isAdmin'), fnSrc('round2'), fnSrc('pageIsKey'), fnSrc('keyPageHeld'), fnSrc('studentPages'), fnSrc('assignmentFor'),
    fnSrc('docMissingError'), fnSrc('chipNode'), fnSrc('setterName'),
    `var pages = [], annotations = [], wsKey = { pages: [], rows: [] }, wsEpoch = 1, currentDocId = null,
         currentUser = null, wsMeta = {}, view = 'home', scale = 1, fittedWidth = true, drawing = null,
         editingId = null, moving = null, erasing = null, resizingPic = null, voice = { on: false },
         assignments = [], worksheets = [], assignmentsLoaded = true, db = null, storage = null,
         docName = '', pdfBytes = null, dirty = false;
     var __toasts = [], __usage = [];
     function toast(m) { __toasts.push(String(m)); }
     function usageNote(k, d) { __usage.push([k, d]); }
     function renderWorksheets() {}
     function liveActive() { return false; }
     function stopLiveTutor() {}
     function cancelVoice() {}
     function commitActiveTextEdit() {}
     function closeBuddy() {}
     function applyScale() {}
     function annPastePic(a) { return !!a && a.type === 'image'; }
     function annFrame(a) { return { x: a.x || 0, y: a.y || 0, w: a.w || 0, h: a.h || 0 }; }
     function newAnnId() { return 'a' + Math.random().toString(36).slice(2, 10); }`,
    HELPERS, CORE, BACKGROUNDS, FINALIZE, CAMERA, RECORDING, VIDEOS, TITLE, EXPORT, PLAYLIST
  ].join('\n'), ctx);
  return ctx;
}

const TEACHER = { uid: 'teacher', email: vm.runInNewContext(literal('ADMIN_EMAIL')) };
const STUDENT = { uid: 'kid', email: 'kid@example.com' };
const LESSON_URL = (dir, file) => 'https://firebasestorage.googleapis.com/v0/b/mathgen--app.firebasestorage.app/o/' +
  encodeURIComponent(dir + '/' + file) + '?alt=media&token=t';
function vid(id, extra) {
  return Object.assign({
    id, type: 'video', page: 1, x: 40, y: 60, label: 'Q5 · video solution · 0:12', ts: 1700000000000,
    url: LESSON_URL('tutor-worksheets', 'lesson-T1-' + id + '.webm'),
    lessonRecording: { version: 1, manifestUrl: LESSON_URL('tutor-worksheets', 'lesson-T1-' + id + '.json'),
      manifestPath: 'tutor-worksheets/lesson-T1-' + id + '.json', audioPath: 'tutor-worksheets/lesson-T1-' + id + '.webm',
      duration: 12000, pdfHash: 'abc', video: true, title: 'Q5' }
  }, extra || {});
}
function page(num, w, h, top) {
  const wrap = mkNode('div');
  wrap.rect = { left: 0, top: top || 0, width: w, height: h };
  return { num, baseW: w, baseH: h, wrap, svg: mkNode('svg') };
}

/* ===================================================================== */

test('the byte ceilings and the parser bound are one number each, written twice — and the recorder stops short of them', () => {
  const num = s => vm.runInNewContext(s);
  assert.equal(num(literal('LESSON_VIDEO_LIMIT', RECORDING)), num(literal('MAX_VIDEO_BYTES', FINALIZE)),
    'a finalizer stricter than the recorder throws a video lesson away at SAVE time');
  assert.equal(num(literal('LESSON_AUDIO_LIMIT', RECORDING)), num(literal('MAX_BYTES', FINALIZE)));
  const dur = /var LIMITS = Object\.freeze\(\{ duration: ([^,]+),/.exec(CORE);
  assert.ok(dur, 'the replay core states its duration bound');
  assert.equal(num(dur[1]), num(literal('MAX_MS', FINALIZE)), 'the finalizer repeats the replay core\'s duration');
  const slack = num(literal('LESSON_BYTES_SLACK', RECORDING));
  assert.ok(slack > 0 && slack < num(literal('LESSON_AUDIO_LIMIT', RECORDING)) / 10, 'a little short, never most of the file');
  assert.ok(num(literal('LESSON_VIDEO_LIMIT', RECORDING)) > num(literal('LESSON_AUDIO_LIMIT', RECORDING)));
  assert.match(RECORDING, /c\.bytes >= \(c\.limit \|\| LESSON_AUDIO_LIMIT\) - LESSON_BYTES_SLACK\) lessonStop\(/,
    'the tick stops the recorder the slack short of whichever ceiling it has');
  assert.match(RECORDING, /limit: choice\.camera \? LESSON_VIDEO_LIMIT : LESSON_AUDIO_LIMIT/);
});

test('the ported machinery is Ans Key\'s, byte for byte, wherever both repositories are side by side', (t) => {
  const sibling = new URL('../../anskey/index.html', import.meta.url);
  if (!fs.existsSync(sibling)) { t.skip('polymathlc/anskey is not checked out beside this repository'); return; }
  const ak = fs.readFileSync(sibling, 'utf8');
  const cutAk = (from, to) => cut(from, to, ak);
  assert.equal(CORE, cutAk('/* ================= Lesson replay core ================= */', '/* ================= End lesson replay core ================= */'),
    'the replay core — a timeline written by either app plays in the other');
  assert.equal(FINALIZE.trimEnd(), cutAk('/* ================= Seekable lesson audio ================= */', '/* ================= Lesson camera and microphone ================= */').trimEnd(),
    'the WebM finalizer');
  // The camera window says which live assistant it is kept away from — the
  // helper there, the tutor here — and is otherwise the same text.
  assert.equal(CAMERA, cutAk('/* ================= Lesson camera and microphone ================= */', '/* ================= End lesson camera and microphone ================= */')
    .replace('reaches the live helper.', 'reaches the live tutor.'), 'the camera and microphone window');
  for (const fn of ['lessonTitleClean', 'lessonQuestionGuess', 'lessonExportMime', 'lessonExportLayout', 'lessonExportStack',
    'lessonExportViewport', 'lessonExportTarget', 'lessonExportClamp', 'lessonExportEase', 'lessonExportRasterScale',
    'lessonExportBytes', 'lessonExportSizeText', 'lessonExportFileName', 'lessonExportPrefs', 'lessonExportDraw',
    'lessonExportCamera', 'lessonExportPanel', 'lessonExportCaption', 'recPickMime', 'recExt', 'recFmtTime']) {
    assert.equal(fnSrc(fn), fnSrc(fn, ak), fn + ' is the same function in both apps');
  }
  assert.equal(literal('LESSON_QNUM_RE', TITLE), literal('LESSON_QNUM_RE', ak));
});

test('lessonVideosClean is the ONE door: what cannot play is dropped, and nothing extra comes through', () => {
  const c = box();
  assert.deepEqual(plain(c.lessonVideosClean(null)), []);
  assert.deepEqual(plain(c.lessonVideosClean({ 0: vid('a') })), [], 'not a list is no list');
  const good = vid('a');
  const out = c.lessonVideosClean([
    good,
    vid('a', { label: 'the same id twice' }),
    vid('b c'),                                             // an id that is not an id
    vid('d', { lessonRecording: null }),
    vid('e', { lessonRecording: { manifestUrl: '' } }),
    vid('f', { url: '' }),
    vid('g', { page: 0 }), vid('h', { page: 1.5 }), vid('i', { page: 10001 }), vid('j', { page: '2' }),
    vid('k', { x: NaN }), vid('l', { y: Infinity }),
    null, 'a string', 7
  ]);
  assert.deepEqual(plain(out.map(v => v.id)), ['a'], 'one pill that cannot play is worse than none');
  assert.deepEqual(Object.keys(out[0]).sort(), ['id', 'label', 'lessonRecording', 'page', 'ts', 'type', 'url', 'x', 'y']);
  assert.deepEqual(Object.keys(out[0].lessonRecording).sort(), ['audioPath', 'duration', 'manifestPath', 'manifestUrl', 'pdfHash', 'title', 'version', 'video']);
  const odd = c.lessonVideosClean([vid('m', {
    type: 'ink', evil: '<img onerror=alert(1)>', label: 'x'.repeat(400), ts: 'soon',
    lessonRecording: { manifestUrl: 'm', duration: -5, video: 'yes', title: 'T'.repeat(90), extra: 1, version: 9 }
  })])[0];
  assert.equal(odd.type, 'video', 'whatever it called itself, it is read as a video entry');
  assert.equal(odd.evil, undefined, 'a field nobody reads is never carried');
  assert.equal(odd.label.length, 120);
  assert.equal(odd.ts, 0);
  assert.equal(odd.lessonRecording.version, 1);
  assert.equal(odd.lessonRecording.duration, 0);
  assert.equal(odd.lessonRecording.video, undefined, 'only a real `true` is a video lesson');
  assert.equal(odd.lessonRecording.extra, undefined);
  assert.equal(odd.lessonRecording.title.length, c.LESSON_TITLE_MAX);
  const audio = c.lessonVideosClean([vid('n', { lessonRecording: { manifestUrl: 'm' } })])[0].lessonRecording;
  assert.equal('video' in audio || 'title' in audio, false, 'an untitled voice-only lesson carries neither flag');
  const many = Array.from({ length: c.LESSON_VIDEOS_MAX + 15 }, (_, i) => vid('v' + i));
  assert.equal(c.lessonVideosClean(many).length, c.LESSON_VIDEOS_MAX, 'the list every copy reads is bounded');
});

test('a copy reads the ASSIGNMENT\'s videos; a set card and an own paper read their own; a withdrawn copy has none', () => {
  const c = box();
  c.assignments = [{ id: 'A1', videos: [vid('x'), vid('y')] }];
  assert.deepEqual(plain(c.lessonVideosOf({ id: 'T', videos: [vid('own')] }).map(v => v.id)), ['own'], 'the teacher\'s own worksheet');
  assert.deepEqual(plain(c.lessonVideosOf({ id: 'C', assignmentId: 'A1', videos: [vid('stale')] }).map(v => v.id)), ['x', 'y'],
    'a copy begun yesterday reads the video recorded today — never a list frozen on the copy');
  assert.deepEqual(plain(c.lessonVideosOf({ id: 'C', assignmentId: 'GONE', videos: [vid('stale')] })), [],
    'taken off the class list: its videos go with it (the Backup shelf\'s rule)');
  assert.deepEqual(plain(c.lessonVideosOf({ id: 'set:A1', set: { videos: [vid('s')] } }).map(v => v.id)), ['s'], 'an unstarted set entry');
  assert.deepEqual(plain(c.lessonVideosOf({ id: 'A1', videos: [vid('asg')] }).map(v => v.id)), ['asg'], 'an assignment handed straight to the set card');
  assert.deepEqual(plain(c.lessonVideosOf(null)), []);
});

test('the pill says which question and what kind of solution; a pill with no link says so', () => {
  const c = box();
  assert.equal(c.lessonVideoLabel('Q5', true, 192000), 'Q5 · video solution · 3:12');
  assert.equal(c.lessonVideoLabel('', true, 2000), 'Video solution · 0:02');
  assert.equal(c.lessonVideoLabel('  Q7   part (a) ', false, 64000), 'Q7 part (a) · worked solution · 1:04', 'no camera: the voice and the writing');
  assert.equal(c.lessonVideoLabel(null, false, 0), 'Worked solution · 0:00');
  assert.equal(c.lessonVideoLabel('Q1', true, 3723000), 'Q1 · video solution · 1:02:03', 'an hour is reachable, and reads as one');
  assert.equal(c.videoPillLabel({ label: 'Q2 · video solution · 0:30', url: 'u' }), 'Q2 · video solution · 0:30');
  assert.equal(c.videoPillLabel({ label: 'x', url: '' }), 'Video not uploaded');
  assert.equal(c.videoPillLabel({ url: 'u' }), 'Video solution');
  assert.equal(c.videoPillLabel(null), 'Video not uploaded');
  assert.match(VIDEOS, /text\.textContent = label;/, 'the label is a field off a document: painted as text');
  const html = VIDEOS.match(/\.innerHTML = ([^;]+);/g) || [];
  assert.ok(html.length > 0);
  html.forEach(line => assert.match(line, /\.innerHTML = (?:v\.lessonRecording\.video \? LESSON_ICON_CAM : LESSON_ICON_PLAY|LESSON_ICON_BADGE);/,
    'markup is only ever one of the app\'s own icons: ' + line));
});

test('the student sees the region the teacher saw — fitted to their screen, never the desk beside the page', () => {
  const c = box();
  // The teacher's viewer: 1000 × 700 at zoom 2 held 500 × 350 page units.
  assert.ok(Math.abs(c.lessonFitZoom(2, { w: 1000, h: 700 }, 600, 400, 300) - Math.min(400 / 500, 300 / 350)) < 1e-12,
    'on a phone the same region, smaller');
  assert.ok(Math.abs(c.lessonFitZoom(2, { w: 1000, h: 700 }, 600, 2000, 1400) - 4) < 1e-12, '…and on a big screen, bigger — up to the ceiling');
  // A teacher on a wide screen at zoom 1 saw desk either side of a 600-unit page.
  assert.ok(Math.abs(c.lessonFitZoom(1, { w: 1800, h: 700 }, 600, 1296, 1400) - Math.min(1296 / 648, 1400 / 700)) < 1e-12,
    'the width is the page\'s own, plus a margin — never the teacher\'s desk');
  assert.equal(c.lessonFitZoom(1.5, null, 600, 400, 300), 1.5, 'no viewer size remembered: the teacher\'s own zoom, as Ans Key replays it');
  assert.equal(c.lessonFitZoom(1.5, { w: 1000, h: 700 }, 600, 0, 300), 1.5, 'a viewer that measures nothing is not fitted to');
  assert.equal(c.lessonFitZoom(0.25, { w: 100000, h: 100000 }, 600, 300, 300), 0.25, 'bounded below');
  assert.match(RECORDING, /var z = raw \? v\.zoom : lessonFitZoom\(v\.zoom, pb && pb\.viewport, p\.baseW, area\.clientWidth, area\.clientHeight\);/,
    'the replay fits every view; the student\'s own view comes back as it was');
  assert.match(RECORDING, /viewport: lessonExportViewport\(manifest\.viewport\)/, 'the viewer size is read through the export\'s own validator');
  assert.match(RECORDING, /if \(lessonPlayback\) \{ lessonPlayback\.viewKey = ''; lessonReplayFrame\(\); \}/, 'a resized window is fitted again');
});

test('the playlist plays in question order — page, then row, then left to right — and only what can play', () => {
  const c = box();
  const items = c.lessonPlaylistItems([
    vid('p2-top', { page: 2, x: 50, y: 40 }),
    vid('p1-low', { page: 1, x: 50, y: 600 }),
    vid('p1-right', { page: 1, x: 400, y: 105 }),
    vid('p1-left', { page: 1, x: 60, y: 95, lessonRecording: Object.assign({}, vid('z').lessonRecording, { video: false }) }),
    { id: 'ink', type: 'pen', page: 1, points: [] },
    vid('no-url', { url: '' }),
    vid('no-lesson', { lessonRecording: undefined }),
    vid('no-page', { page: NaN })
  ]);
  assert.deepEqual(plain(items.map(i => i.id)), ['p1-left', 'p1-right', 'p1-low', 'p2-top']);
  assert.ok(items.every(i => i.kind === 'lesson'), 'every entry here is a lesson recording');
  assert.equal(items[0].video, false);
  assert.equal(items[1].video, true);
  assert.equal(items[0].label, 'Q5 · video solution · 0:12');
  const shuffled = c.lessonPlaylistItems([vid('c', { y: 500 }), vid('a', { y: 10 }), vid('b', { y: 250 })].reverse());
  assert.deepEqual(plain(shuffled.map(i => i.id)), ['a', 'b', 'c'], 'a real order: shuffled in, same out');
  // Rows are rounded, never compared with a tolerance — "within 12 units" is
  // not transitive, and a sort handed an intransitive comparator returns
  // whatever its engine happens to produce.
  const chain = c.lessonPlaylistItems([vid('r', { x: 300, y: 97 }), vid('m', { x: 200, y: 103 }), vid('l', { x: 100, y: 100 })]);
  assert.deepEqual(plain(chain.map(i => i.id)), ['l', 'm', 'r'], 'a line of pills a few units out of true is still one row, left to right');
  const rows = c.lessonPlaylistItems([vid('below', { x: 10, y: 130 }), vid('right', { x: 400, y: 100 }), vid('left', { x: 20, y: 110 })]);
  assert.deepEqual(plain(rows.map(i => i.id)), ['right', 'below', 'left'],
    'rows are whole bands of PLAYLIST_ROW units, so the order is the same every time: 100 is one band, 110 and 130 the next, read left to right');
  assert.match(PLAYLIST, /var rp = Math\.round\(p\.y \/ PLAYLIST_ROW\), rq = Math\.round\(q\.y \/ PLAYLIST_ROW\);/);
});

test('the question guess reads the left margin of what is on screen, and never an option or a quantity', () => {
  const c = box();
  const items = [
    { str: '3.', x: 40, y: 50 }, { str: '4.', x: 40, y: 400 }, { str: '5', x: 42, y: 700 },
    { str: '(1)', x: 90, y: 430 }, { str: '(2)', x: 30, y: 460 }, { str: '1.5 kg', x: 40, y: 480 },
    { str: '2021', x: 40, y: 500 }, { str: '12.', x: 400, y: 420 }, { str: 'Q9', x: 44, y: 1000 }
  ];
  assert.equal(c.lessonQuestionGuess(items, 300, 800, 600), 'Q4', 'the first question number on screen');
  assert.equal(c.lessonQuestionGuess(items, 100, 350, 600), 'Q3', 'none on screen: the nearest above');
  assert.equal(c.lessonQuestionGuess(items, 900, 1100, 600), 'Q9');
  assert.equal(c.lessonQuestionGuess([{ str: '(3)', x: 20, y: 10 }, { str: '0.5', x: 20, y: 20 }], 0, 100, 600), '');
  assert.equal(c.lessonQuestionGuess(null, 0, 100, 600), '');
  assert.equal(c.lessonTitleClean('  Q5   part  (a)  '), 'Q5 part (a)');
  assert.equal(c.lessonTitleClean('x'.repeat(99)).length, c.LESSON_TITLE_MAX);
  assert.match(TITLE, /if \(epoch !== wsEpoch \|\| !\$\('lessonModal'\)\.classList\.contains\('open'\) \|\| input\.value\) return;/,
    'a guess that arrives late, or after the teacher typed, is dropped');
  assert.match(html, /id="lessonTitleInput"[^>]*maxlength="40"/);
});

test('a video on a page this copy hides is never offered — the answer-key page is the one page a student is never taken to', () => {
  const c = box();
  c.pages = [page(1, 600, 800), page(2, 600, 800), page(3, 600, 800)];
  c.wsKey = { pages: [2], rows: [] };
  c.wsVideos = c.lessonVideosClean([vid('one', { page: 1 }), vid('key', { page: 2 }), vid('three', { page: 3 }), vid('far', { page: 9 })]);
  assert.deepEqual(plain(c.lessonVisibleVideos().map(v => v.id)), ['one', 'three']);
  assert.match(RECORDING, /if \(!p \|\| \(!raw && pageIsKey\(v\.page\)\)\) return;/, 'a recorded view on a key page is stepped over, never scrolled to');
  assert.match(EXPORT, /job\.infos = studentPages\(\)\.map\(/, 'the 1080p video stacks only the pages the student has');
  assert.match(EXPORT, /!pageIsKey\(n\)\) wanted\.add\(n\)/, 'and never rasterises a key page');
  assert.match(EXPORT, /drawings\.forEach\(function \(n\) \{ if \(!pageIsKey\(n\.page\)\) wanted\.add\(n\.page\); \}\);/);
  assert.match(PLAYLIST, /lessonPlaylistItems\(lessonVisibleVideos\(\)\)/, 'the playlist offers only what the page offers');
});

test('a new pill lands on the page in view, and steps down past one already sitting there', () => {
  const c = box();
  c.pages = [page(1, 600, 800, -900), page(2, 600, 800, 0)];
  const area = c.$('viewerArea');
  area.rect = { left: 0, top: 0, width: 800, height: 600 };
  area.clientHeight = 600;
  c.wsVideos = [];
  const first = c.recDropSpot();
  assert.equal(first.page.num, 2, 'the page the middle of the viewer is on');
  assert.equal(first.x, 225, 'centred: (600 − 150) / 2');
  assert.equal(first.y, 26, 'just inside the top of what is on screen');
  c.wsVideos = c.lessonVideosClean([vid('there', { page: 2, x: first.x, y: first.y })]);
  const second = c.recDropSpot();
  assert.equal(second.y, first.y + c.LESSON_PILL_H + 8, 'a second pill landing on the first reads as a recording that went nowhere');
  c.wsKey = { pages: [2], rows: [] };
  assert.equal(c.recDropSpot().page.num, 1, 'a hidden key page is never where a pill lands');
});

test('what the replay core would refuse is mended on a COPY, never on the page', () => {
  const c = box();
  const fine = { id: 'a', type: 'pen', page: 1, points: [[1, 2]], width: 3, color: '#123456' };
  assert.equal(c.lessonSafeAnn(fine), fine, 'an annotation that is already right is the same object');
  const broken = { id: 'b', type: 'pen', page: 1, width: 'wide' };
  const mended = c.lessonSafeAnn(broken);
  assert.notEqual(mended, broken);
  assert.deepEqual(plain(mended.points), []);
  assert.equal(mended.width, 2);
  assert.equal(broken.points, undefined, 'the page\'s own annotation is never touched');
  const box1 = c.lessonSafeAnn({ id: 'c', type: 'rect', page: 1, x: NaN, y: 4, w: -20, h: 10, width: 2, color: '#000' });
  assert.equal(box1.x, 0);
  assert.equal(box1.w, 20);
  const text = c.lessonSafeAnn({ id: 'd', type: 'text', page: 1, x: 1, y: 2, w: 100, h: 20, text: 42, fontSize: 0 });
  assert.equal(text.text, '42');
  assert.equal(text.fontSize, 16);
  assert.deepEqual(plain(c.LESSON_TYPES), ['pen', 'highlight', 'text', 'rect', 'ellipse', 'line', 'arrow'],
    'the timeline carries ink and typed words — a pasted picture is painted once, and a video is never ink');
});

test('only a lesson file in a lesson folder is ever fetched or played', () => {
  const c = box();
  const dirs = plain(c.LESSON_DIRS);
  assert.deepEqual(dirs, ['pdf-annotator', 'tutor-worksheets'],
    'the one folder the shared rules guard first — only the verified teacher writes a lesson there — then this app\'s own');
  for (const ok of [LESSON_URL('tutor-worksheets', 'lesson-T1-x.webm'), LESSON_URL('pdf-annotator', 'lesson-T1-x.json'),
    'https://firebasestorage.googleapis.com/v0/b/mathgen--app.appspot.com/o/tutor-worksheets%2Flesson-a.mp4?alt=media']) {
    assert.equal(c.lessonAssetUrl(ok), new URL(ok).href, ok);
  }
  for (const bad of [
    LESSON_URL('tutor-worksheets', 'T1.pdf'),                          // the worksheet itself
    LESSON_URL('users/kid/mistakes', 'lesson-x.jpg'),                 // somebody's book
    LESSON_URL('pdf-annotator', 'T1.annotations.json'),
    'http://firebasestorage.googleapis.com/v0/b/mathgen--app.firebasestorage.app/o/tutor-worksheets%2Flesson-a.webm',
    'https://evil.example.com/v0/b/mathgen--app.firebasestorage.app/o/tutor-worksheets%2Flesson-a.webm',
    'https://firebasestorage.googleapis.com/v0/b/another-app.appspot.com/o/tutor-worksheets%2Flesson-a.webm'
  ]) {
    assert.throws(() => c.lessonAssetUrl(bad), /Invalid lesson attachment/, bad);
  }
  assert.throws(() => c.lessonAssetUrl('javascript:alert(1)'));
  assert.match(RECORDING, /var mediaUrl = lessonAssetUrl\(a\.url\);/, 'the media goes through the door too, not only the manifest');
  assert.match(RECORDING, /var response = await fetch\(lessonAssetUrl\(url\), \{ signal: signal \}\);/);
});

test('only a lesson file in a lesson folder is ever deleted — and only from the teacher\'s device', async () => {
  const deleted = [];
  const storage = { ref: p => ({ delete: async () => { deleted.push(p); } }) };
  const c = box();
  c.storage = storage;
  const list = [{ lessonRecording: { audioPath: 'tutor-worksheets/lesson-T1-a.webm', manifestPath: 'pdf-annotator/lesson-T1-a.json' } },
    { lessonRecording: { audioPath: 'tutor-worksheets/T1.pdf', manifestPath: 'users/kid/mistakes/m.jpg' } },
    { lessonRecording: { audioPath: 7, manifestPath: '' } }, null, {}];
  c.currentUser = STUDENT;
  await c.lessonDeleteFiles(list);
  assert.deepEqual(deleted, [], 'a student\'s device deletes nothing, whatever a `videos` field on their own paper says');
  c.currentUser = TEACHER;
  await c.lessonDeleteFiles(list);
  assert.deepEqual(deleted.sort(), ['pdf-annotator/lesson-T1-a.json', 'tutor-worksheets/lesson-T1-a.webm']);
  assert.match(html, /if \(!w\.sharedPdf && !classReads\) await lessonDeleteFiles\(lessonVideosClean\(w\.videos\)\);/,
    'deleting a worksheet deletes its recordings only when no class reads it');
  assert.match(VIDEOS, /var r = await lessonVideosCommit\(currentDocId, function \(list\) \{ return list\.filter\(function \(x\) \{ return x\.id !== id; \}\); \}\);\n\s*\/\/ The files go only once no list points at them any more\.\n\s*lessonDeleteFiles\(\[v\]\);/,
    'a deleted video\'s files go only after the list stops pointing at them');
});

test('a refusal by the rules is tried in the other folder; a dropped network is not; the manifest follows the media', async () => {
  const c = box();
  const tried = [];
  const refuse = dir => Object.assign(new Error('User does not have permission to access this object.'), { code: 'storage/unauthorized', dir });
  const mkStorage = rule => ({
    ref(path) {
      return {
        fullPath: path,
        async put() { tried.push(path); const e = rule(path); if (e) throw e; },
        async getDownloadURL() { return 'https://files/' + path; }
      };
    }
  });
  c.storage = mkStorage(() => null);
  const plainJob = { docId: 'T1', id: 'L0' };
  assert.equal((await c.lessonPut(plainJob, 'webm', {}, {}, false)).path, 'pdf-annotator/lesson-T1-L0.webm', 'the guarded folder, when it takes it');
  tried.length = 0;
  c.storage = mkStorage(p => p.startsWith('pdf-annotator/') ? refuse() : null);
  const job = { docId: 'T1', id: 'L1' };
  const media = await c.lessonPut(job, 'webm', {}, {}, false);
  assert.equal(media.path, 'tutor-worksheets/lesson-T1-L1.webm');
  assert.equal(job.dir, 'tutor-worksheets');
  await c.lessonPut(job, 'json', {}, {}, false);
  assert.deepEqual(tried, ['pdf-annotator/lesson-T1-L1.webm', 'tutor-worksheets/lesson-T1-L1.webm', 'tutor-worksheets/lesson-T1-L1.json'],
    'the manifest goes straight to the folder the media landed in — never split across two');
  tried.length = 0;
  c.storage = mkStorage(p => p.startsWith('pdf-annotator/') ? Object.assign(new Error('network'), { code: 'storage/retry-limit-exceeded' }) : null);
  await assert.rejects(c.lessonPut({ docId: 'T1', id: 'L2' }, 'webm', {}, {}, false), /network/);
  assert.deepEqual(tried, ['pdf-annotator/lesson-T1-L2.webm'], 'a network that dropped is a retry, not a different folder');
  c.storage = mkStorage(() => refuse());
  await assert.rejects(c.lessonPut({ docId: 'T1', id: 'L3' }, 'webm', {}, {}, false), /permission/, 'refused everywhere is said, not swallowed');
  for (const [e, want] of [[{ code: 'storage/unauthorized' }, true], [{ message: 'Permission denied' }, true], [{ message: 'HTTP 403' }, true],
    [{ code: 'storage/retry-limit-exceeded' }, false], [{ message: 'network-request-failed' }, false], [null, false]]) {
    assert.equal(c.lessonStorageRefused(e), want, JSON.stringify(e));
  }
});

test('the entry written is the entry read: Ans Key\'s attachment, field for field, through the door unchanged', () => {
  const c = box();
  const job = { id: 'L1', spot: { page: 2, x: 225, y: 26 }, title: 'Q5', video: true, duration: 192000,
    audioUrl: LESSON_URL('tutor-worksheets', 'lesson-T1-L1.webm'), audioPath: 'tutor-worksheets/lesson-T1-L1.webm',
    manifestUrl: LESSON_URL('tutor-worksheets', 'lesson-T1-L1.json'), manifestPath: 'tutor-worksheets/lesson-T1-L1.json',
    manifest: { pdfHash: 'h' } };
  const entry = c.lessonVideoEntry(job);
  assert.equal(entry.type, 'video');
  assert.equal(entry.label, 'Q5 · video solution · 3:12');
  assert.deepEqual(plain(entry.lessonRecording), { version: 1, manifestUrl: job.manifestUrl, manifestPath: job.manifestPath,
    audioPath: job.audioPath, duration: 192000, pdfHash: 'h', video: true, title: 'Q5' });
  assert.deepEqual(plain(c.lessonVideosClean([entry])[0]), plain(entry), 'what the one writer writes, the one reader reads back unchanged');
  const quiet = c.lessonVideoEntry(Object.assign({}, job, { title: '', video: false }));
  assert.equal('video' in quiet.lessonRecording || 'title' in quiet.lessonRecording, false,
    'an untitled voice-only lesson is byte for byte what an Ans Key one is');
  assert.equal(quiet.label, 'Worked solution · 3:12');
});

test('ONE writer: it re-reads, it UPDATES and never sets, and the class half is reported apart', async () => {
  const c = box();
  const W = 'tutorWorksheets/T1', A = 'tutorAssignments/T1';
  const docs = { [W]: { name: 'P5 Maths', videos: [vid('old'), { junk: true }] }, [A]: { active: true, videos: [vid('old')] } };
  c.db = fakeDb(docs);
  c.currentUser = STUDENT;
  await assert.rejects(c.lessonVideosCommit('T1', l => l), /only the teacher/);
  assert.deepEqual(c.db.calls, [], 'a student\'s device reads nothing and writes nothing');

  c.currentUser = TEACHER;
  c.currentDocId = 'T1';
  c.view = 'ws';
  c.worksheets = [{ id: 'T1', videos: [] }];
  c.assignments = [{ id: 'T1', videos: [] }];
  c.wsVideos = c.lessonVideosClean([vid('stale-in-memory')]);
  let handed = null;
  const r = await c.lessonVideosCommit('T1', list => { handed = plain(list.map(v => v.id)); list.push(vid('new')); return list; });
  assert.deepEqual(handed, ['old'], 'the list handed to the change is the DOCUMENT\'s, cleaned — never what this tab was holding');
  assert.deepEqual(plain(r.list.map(v => v.id)), ['old', 'new']);
  assert.equal(r.classToo, true);
  assert.equal(r.classError, '');
  assert.deepEqual(c.db.calls.map(x => x[0] + ' ' + x[1]), ['get ' + W, 'update ' + W, 'update ' + A]);
  assert.ok(!c.db.calls.some(x => x[0] === 'set'), 'never a set: a document that has gone is not written back into existence');
  assert.deepEqual(plain(docs[A].videos.map(v => v.id)), ['old', 'new'], 'every copy reads this');
  assert.equal(docs[A].active, true, 'nothing else on the assignment is touched');
  assert.deepEqual(plain(c.worksheets[0].videos.map(v => v.id)), ['old', 'new']);
  assert.deepEqual(plain(c.assignments[0].videos.map(v => v.id)), ['old', 'new']);
  assert.deepEqual(plain(c.wsVideos.map(v => v.id)), ['old', 'new'], 'the open worksheet shows it at once');

  // Never set for a class: the worksheet is updated and no assignment is CREATED.
  const docs2 = { 'tutorWorksheets/T2': { videos: [] } };
  c.db = fakeDb(docs2);
  const r2 = await c.lessonVideosCommit('T2', list => list.concat([vid('a')]));
  assert.equal(r2.classToo, false);
  assert.equal(r2.classError, '', 'a paper nobody has been given is not a failure');
  assert.equal(docs2['tutorAssignments/T2'], undefined, '`worksheetReadByClass` reads whether it EXISTS — so it must not be made here');

  // The class half refused by the rules: said in words, and the teacher's half stands.
  const docs3 = { 'tutorWorksheets/T3': { videos: [] }, 'tutorAssignments/T3': { active: true } };
  c.db = fakeDb(docs3, { refuse: { 'tutorAssignments/T3': Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' }) } });
  const r3 = await c.lessonVideosCommit('T3', list => list.concat([vid('a')]));
  assert.equal(r3.classToo, false);
  assert.equal(r3.classError, 'the rules do not allow it yet.');
  assert.equal(docs3['tutorWorksheets/T3'].videos.length, 1);

  // A worksheet that has gone, and a copy, are refused before anything is written.
  c.db = fakeDb({});
  await assert.rejects(c.lessonVideosCommit('GONE', l => l), /no longer there/);
  assert.ok(!c.db.calls.some(x => x[0] === 'update'));
  c.db = fakeDb({ 'tutorWorksheets/C1': { assignmentId: 'A1', videos: [] } });
  await assert.rejects(c.lessonVideosCommit('C1', l => l), /copy of a set worksheet/);
  assert.ok(!c.db.calls.some(x => x[0] === 'update'));

  // Whatever the change hands back goes through the door on the way out too.
  c.db = fakeDb({ 'tutorWorksheets/T4': { videos: [] } });
  const r4 = await c.lessonVideosCommit('T4', () => Array.from({ length: 80 }, (_, i) => vid('m' + i)).concat([{ bad: 1 }]));
  assert.equal(r4.list.length, c.LESSON_VIDEOS_MAX);
  assert.doesNotMatch(fnSrc('lessonVideosCommit'), /\.set\(/);
});

test('a copy FOLLOWS the teacher\'s list live — a new video arrives by itself, and a withdrawn paper takes its videos with it', () => {
  const c = box();
  c.db = fakeDb({});
  c.currentUser = STUDENT;
  c.wsEpoch = 5;
  c.assignments = [{ id: 'A1', videos: [vid('one')] }];
  c.lessonVideosOpen({ id: 'C1', assignmentId: 'A1', videos: [] });
  assert.deepEqual(plain(c.wsVideos.map(v => v.id)), ['one'], 'what the shelf already read is on the page at once');
  assert.equal(c.db.listeners.length, 1);
  const l = c.db.listeners[0];
  assert.equal(l.key, 'tutorAssignments/A1', 'the assignment every copy already reads for its help level and its key pages');
  const snap = data => ({ exists: !!data, data: () => data });
  l.cb(snap({ active: true, videos: [vid('one'), vid('two')] }));
  assert.deepEqual(plain(c.wsVideos.map(v => v.id)), ['one', 'two']);
  assert.equal(c.__toasts.filter(t => /Mr Chung has added a video solution/.test(t)).length, 1, 'and the student is told, by the centre\'s name for its teacher');
  l.cb(snap({ active: true, videos: [vid('one'), vid('two')] }));
  assert.equal(c.__toasts.filter(t => /has added/.test(t)).length, 1, 'the same list twice says nothing twice');
  assert.deepEqual(plain(c.assignments[0].videos.map(v => v.id)), ['one', 'two'], 'the shelf reads the fresh list too');
  l.cb(snap({ active: false, videos: [vid('one'), vid('two')] }));
  assert.deepEqual(plain(c.wsVideos), [], 'taken off the class list: its videos go, as they do off the shelf');
  c.wsEpoch = 6;
  l.cb(snap({ active: true, videos: [vid('late')] }));
  assert.deepEqual(plain(c.wsVideos), [], 'a snapshot for a worksheet no longer open is dropped');
  c.lessonVideosUnwatch();
  assert.equal(l.live, false, 'the listener comes down');
  assert.equal(c.lessonVideosFor, '');
  // The teacher's own worksheet is the record itself: nothing to follow.
  c.currentUser = TEACHER;
  c.lessonVideosOpen({ id: 'T1', videos: [vid('mine')] });
  assert.equal(c.db.listeners.length, 1, 'no listener on an own worksheet');
  assert.deepEqual(plain(c.wsVideos.map(v => v.id)), ['mine']);
  // Every way off the worksheet or the account takes the listener down.
  for (const fn of ['lessonWorksheetClosing', 'lessonLeaveWs', 'lessonRoleChanged']) {
    assert.match(fnSrc(fn), /lessonVideosUnwatch\(\);/, fn + ' unwatches');
  }
  assert.match(fnSrc('lessonWorksheetClosing'), /wsVideos = \[\];/, 'another worksheet starts with none');
});

test('the shelf says so — a chip for anybody reading the card, a 🎬 on the cover for anybody running an eye along the shelf', () => {
  const c = box();
  c.assignments = [{ id: 'A1', videos: [vid('x'), vid('y')] }];
  const mark = (w, withCover) => {
    const meta = mkNode('div'), cover = withCover === false ? null : mkNode('div');
    c.lessonShelfMark(w, meta, cover);
    return { meta, cover };
  };
  const one = mark({ id: 'T1', videos: [vid('a')] });
  assert.equal(one.meta.children.length, 1);
  assert.equal(one.meta.children[0].textContent, '🎬 Video solution');
  assert.ok(one.meta.children[0].classList.contains('chipVideo'));
  const badge = one.cover.children[0];
  assert.ok(badge.classList.contains('vidBadge'));
  assert.equal(badge.children[0].textContent, 'Video');
  assert.equal(badge.getAttribute('aria-label'), 'This paper has a video solution');
  const copy = mark({ id: 'C1', assignmentId: 'A1' });
  assert.equal(copy.meta.children[0].textContent, '🎬 2 video solutions', 'a copy reads the assignment, exactly as its page does');
  assert.equal(copy.cover.children[0].children[0].textContent, '2');
  const none = mark({ id: 'T2' });
  assert.equal(none.meta.children.length + none.cover.children.length, 0, 'a paper with none is left exactly as it was');
  const row = mark({ id: 'T3', videos: [vid('a')] }, false);
  assert.equal(row.meta.children.length, 1, 'the folded register row has no cover, and still says so');
  assert.match(html, /lessonShelfMark\(w, meta, card\.firstChild\);/, 'every card on the bookcase');
  assert.match(html, /lessonShelfMark\(a, meta, row \? null : card\.firstChild\);/, 'every set card, and the register row');
});

test('🔒 only the teacher records, moves, renames, deletes and exports — asked in every handler, not only on the button', async () => {
  assert.match(RECORDING, /function lessonAdmin\(\) \{ return isAdmin\(currentUser\); \}/);
  assert.match(RECORDING, /function lessonTeacher\(\) \{ return lessonAdmin\(\) && !!currentDocId && !wsMeta\.assignmentId; \}/,
    'the teacher, on their OWN worksheet — never a copy, which is a child\'s document in every respect but whose it is');
  for (const fn of ['lessonStart', 'lessonVideoMove', 'lessonVideoRename', 'lessonVideoDelete', 'lessonPillMenu', 'lessonToolsSync', 'renderVideoPills']) {
    assert.match(fnSrc(fn), /lessonTeacher\(\)/, fn + ' asks lessonTeacher() itself');
  }
  for (const fn of ['lessonExportOpen', 'lessonExportGo', 'lessonExportChoose', 'lessonExportDownload', 'lessonExportShare', 'lessonVideosCommit', 'lessonDeleteFiles']) {
    assert.match(fnSrc(fn), /lessonAdmin\(\)/, fn + ' asks lessonAdmin() itself');
  }
  assert.match(fnSrc('lessonOpen'), /if \(!lessonAdmin\(\)\) \{ toast\('Only the teacher can record a video solution\.'\); return; \}\n\s*if \(wsMeta\.assignmentId\) \{/);
  assert.match(EXPORT, /\$\('lessonExportBtn'\)\.addEventListener\('click', function \(\) \{\n\s*var pb = lessonPlayback;\n\s*if \(!lessonAdmin\(\)\) return;/);
  assert.match(RECORDING, /\$\('lessonExportBtn'\)\.hidden = !lessonAdmin\(\);/, '⬇ 1080p is drawn for the teacher only');
  assert.match(PLAYLIST, /if \(lessonAdmin\(\)\) \{\n\s*var x = document\.createElement\('button'\);/, 'the playlist offers ⬇ 1080p to the teacher only');
  assert.match(VIDEOS, /if \(!teacher \|\| e\.button > 0 \|\| lessonCapture \|\| !lessonTeacher\(\)\) return;/, 'a pill is dragged by the teacher only');
  assert.match(VIDEOS, /pill\.appendChild\(go\);\n\s*lessonPillWire\(go, pill, p, v\.id, teacher\);\n\s*if \(teacher\) \{/, '⋯ is drawn for the teacher only');
  assert.match(html, /if \(e\.shiftKey && e\.key\.toLowerCase\(\) === 'r' && lessonTeacher\(\)\) \{ e\.preventDefault\(\); lessonOpen\(\); return; \}/);

  const c = box();
  c.db = fakeDb({});
  c.currentUser = STUDENT;
  c.currentDocId = 'C1';
  c.wsMeta = { assignmentId: 'A1' };
  c.view = 'ws';
  await c.lessonOpen();
  assert.match(c.__toasts.pop(), /Only the teacher can record/);
  assert.equal(c.$('lessonModal').classList.contains('open'), false);
  c.wsVideos = c.lessonVideosClean([vid('v1')]);
  c.lessonVideoMove('v1', 300, 300);
  assert.deepEqual(plain(c.wsVideos.map(v => [v.x, v.y])), [[40, 60]], 'a student cannot move the teacher\'s video');
  await c.lessonVideoRename('v1');     // prompt() would throw
  await c.lessonVideoDelete('v1');     // confirm() would throw
  assert.equal(c.db.calls.length, 0, 'nothing reached the database');
  await c.lessonExportOpen(vid('v1'));
  assert.equal(c.lessonExportJob, null, 'a student never gets an export');
  assert.match(c.__toasts.pop(), /Only the teacher can export/);
  c.currentUser = TEACHER;
  await c.lessonOpen();
  assert.match(c.__toasts.pop(), /This is a copy of a worksheet you set/, 'the teacher on a copy is sent to their own worksheet');
  assert.equal(c.lessonTeacher(), false);
  c.wsMeta = {};
  c.currentDocId = 'T1';
  assert.equal(c.lessonTeacher(), true);
  c.currentDocId = null;
  assert.equal(c.lessonTeacher(), false, 'no worksheet, no recording');
});

test('a save needs the teacher, not the worksheet — and a copy plays what its teacher recorded', () => {
  const c = box();
  const job = { uid: 'teacher', docId: 'T1' };
  c.currentUser = TEACHER;
  c.currentDocId = 'SOMETHING-ELSE';
  assert.equal(c.lessonSaveContextOK(job), true, 'the teacher opened the next paper: the save carries on');
  c.currentUser = { uid: 'other-admin-session', email: TEACHER.email };
  assert.equal(c.lessonSaveContextOK(job), false, 'another account never finishes this one\'s save');
  c.currentUser = STUDENT;
  assert.equal(c.lessonSaveContextOK(Object.assign({}, job, { uid: 'kid' })), false);
  c.currentUser = null;
  assert.equal(c.lessonSaveContextOK(job), false);
  c.currentDocId = 'C1';
  c.wsMeta = { assignmentId: 'A1' };
  assert.equal(c.lessonOwnerId(), 'A1', 'a copy names the teacher\'s worksheet as its assignment — the two share one id');
  c.wsMeta = {};
  assert.equal(c.lessonOwnerId(), 'C1');
  c.currentDocId = null;
  assert.equal(c.lessonOwnerId(), '');
  const play = fnSrc('lessonPlay');
  assert.match(play, /id = lessonOwnerId\(\);/);
  assert.match(play, /manifest\.worksheetId !== id \|\| manifest\.pdfHash !== result\[1\] \|\| manifest\.pageCount !== pages\.length/,
    'a recording made on another version of the paper is refused in words, never drawn on the wrong page');
  assert.match(EXPORT, /docId: lessonOwnerId\(\)/, 'the export checks the manifest against the same id');
  assert.match(fnSrc('lessonSavePending'), /if \(currentDocId === job\.docId && pdfBytes && await lessonPdfHash\(\) !== job\.manifest\.pdfHash\)/,
    'the PDF is checked against itself only while it is the one open');
});

test('a video is NEVER ink: not in the annotations, not in the flattened page the marking reads, not in the saved body', () => {
  assert.doesNotMatch(fnSrc('drawAnnsOnCtx'), /'video'|lessonRecording/, 'the marking run\'s picture carries no pill');
  assert.doesNotMatch(fnSrc('worksheetBody'), /videos|wsVideos/, 'the body a save writes carries no list');
  assert.doesNotMatch(fnSrc('performSave'), /videos|wsVideos/, 'an auto-save never writes a stale list over a fresh one');
  assert.doesNotMatch(BLOCK, /annotations\.push\(|annotations\.splice\(|annotations\.unshift\(|\bannotations\s*=[^=]/,
    'nothing in the block writes the page\'s own annotations');
  assert.doesNotMatch(fnSrc('lessonSavePending'), /annotations/);
  assert.match(RECORDING, /node\.removeAttribute\('data-id'\);/, 'a replayed stroke has no id, so the eraser and the hit test never find it');
  assert.match(RECORDING, /pb\.overlays\.forEach\(function \(n\) \{ n\.remove\(\); \}\);/, 'and the replay\'s layer is taken off the page when it ends');
  assert.match(RECORDING, /svg\.classList\.add\('lessonReplayOverlay'\)/);
  assert.match(html, /\.vidPills \{[^}]*pointer-events: none;/, 'the pill layer itself never swallows a stroke');
});

test('the recorder mixes the microphone and nothing else, lets the preview go first, and opens exactly what was chosen', () => {
  assert.doesNotMatch(RECORDING, /AnsKeyLive|onRemoteStream|createMediaElementSource|orbAudio/, 'the live tutor\'s voice cannot reach the recording');
  assert.equal(RECORDING.split('createMediaStreamSource(').length - 1, 1, 'one source: the microphone');
  assert.match(RECORDING, /new MediaStream\(c\.camStream\.getVideoTracks\(\)\.concat\(c\.destination\.stream\.getAudioTracks\(\)\)\)/, 'ONE file');
  const start = fnSrc('lessonStart');
  const choice = start.indexOf('lessonDevChoice()'), close = start.indexOf('lessonCloseModal()'), media = start.indexOf('lessonGetMedia(');
  assert.ok(choice > 0 && close > choice && media > close, 'the choice is read, THEN the previews let go, THEN the recording opens its own');
  assert.match(start, /lessonMicConstraints\(choice\.micId, false\)/, 'the microphone the teacher just heard, exactly');
  assert.match(start, /lessonCamConstraints\(choice\.camId, false\)/);
  assert.match(start, /choose “No camera” to record your voice and writing only/, 'a camera that will not open refuses the start, loudly');
  assert.match(start, /if \(liveActive\(\)\) stopLiveTutor\(\);/, 'the live tutor lets go of its microphone first');
  assert.match(fnSrc('lessonPlay'), /if \(liveActive\(\)\) stopLiveTutor\(\);/, '…and does not hear a replay and try to answer it');
  assert.match(start, /if \(choice\.camera && !choice\.camId && lessonDev\.camState === 'opening'\)/, 'never a camera nobody has seen yet');
  assert.match(fnSrc('lessonCaptureTick'), /var busy = !!\(drawing \|\| editingId \|\| moving \|\| erasing \|\| resizingPic\);/);
  assert.match(fnSrc('setDirty'), /if \(v && lessonCapture\) lessonCapture\.annotationsChanged = true;/, 'every committed change is caught on the next tick');
  assert.match(RECORDING, /indexedDB\.open\('tutorLessonRecovery', 1\)/, 'this app\'s own recovery store — the two apps share an origin');
});

test('every way off a worksheet or an account tears the replay, the playlist and the live list down', () => {
  const show = fnSrc('showView');
  assert.ok(show.indexOf("if (v !== 'ws') lessonLeaveWs();") >= 0 && show.indexOf("if (v !== 'ws') lessonLeaveWs();") < show.indexOf('view = v;'),
    'leaving the page ends a recording (and saves it), a replay and a playlist — before the view changes');
  assert.match(show, /lessonPlaylistSync\(\);\n\s*if \(v === 'ws'\) setTimeout/);
  const load = fnSrc('loadPdf');
  assert.ok(load.indexOf('lessonWorksheetClosing();') > 0 && load.indexOf('lessonWorksheetClosing();') < load.indexOf('wsEpoch++'),
    'a new worksheet closes the old one\'s videos before the epoch moves');
  const open = fnSrc('openWorksheet');
  assert.ok(open.indexOf("showView('ws');") > 0 && open.indexOf('lessonVideosOpen(w);') > open.indexOf("showView('ws');"));
  const auth = cut('if (auth) auth.onAuthStateChanged(function (user) {', 'stopTeachingNotes();');
  assert.ok(auth.indexOf('currentUser = user || null;') < auth.indexOf('lessonRoleChanged();'), 'the new account is known before the old one\'s things are dropped');
  const role = fnSrc('lessonRoleChanged');
  for (const call of ['lessonExitPlayback();', 'lessonPlaylistStop();', 'lessonPlaylistClosePanel();', 'lessonPillMenuClose();', 'lessonVideosUnwatch();',
    'lessonExportDrop();', 'lessonCloseModal();', "lessonStop('Recording stopped after the account changed.');"]) {
    assert.ok(role.includes(call), 'lessonRoleChanged: ' + call);
  }
  const esc = cut("if (e.key === 'Escape') {\n    kwQuizClose();", 'commitActiveTextEdit();\n    return;');
  for (const call of ["if ($('lessonModal').classList.contains('open')) lessonCloseModal();",
    "if ($('lessonExportModal').classList.contains('open')) { lessonExportClose(false); return; }", 'lessonPillMenuClose();', 'lessonPlaylistClosePanel();']) {
    assert.ok(esc.includes(call), 'Escape: ' + call);
  }
  const leave = fnSrc('lessonLeaveWs');
  assert.match(leave, /if \(lessonCapture\) lessonStop\(/, 'a recording is ended — and saved — never a way out refused');
  assert.match(leave, /lessonCloseModal\(\);/, 'the Record window lets go of the camera on the way out');
  assert.match(RECORDING, /document\.addEventListener\('visibilitychange', function \(\) \{ if \(document\.hidden && lessonCapture\) lessonStop\(/);
  assert.match(RECORDING, /window\.addEventListener\('pagehide', function \(\) \{ if \(lessonCapture\) lessonStop\(\); lessonExitPlayback\(\); \}\);/);
  assert.match(fnSrc('lessonCaptureTick'), /if \(view !== 'ws'\) \{ lessonStop\(/);
  assert.match(fnSrc('lessonReplayFrame'), /if \(pb\.epoch !== wsEpoch \|\| view !== 'ws'\) \{ lessonExitPlayback\(\); return; \}/);
});

test('🎬 the playlist: the button counts, closing the replay ends it, and its own switching does not', () => {
  const c = box();
  c.pages = [page(1, 600, 800)];
  c.view = 'ws';
  c.wsVideos = c.lessonVideosClean([vid('a'), vid('b', { y: 300 }), vid('c', { y: 600 })]);
  c.lessonPlaylistSync();
  const btn = c.$('playlistBtn');
  assert.equal(btn.hidden, false);
  assert.equal(btn.getAttribute('data-count'), '3');
  assert.match(btn.title, /All 3 video solutions on this worksheet/);
  c.wsVideos = [];
  c.lessonPlaylistSync();
  assert.equal(btn.hidden, true, 'nothing to play: no button');
  c.lessonPlaylist = { switching: true, timer: null, items: [] };
  c.lessonPlaylistExited();
  assert.ok(c.lessonPlaylist, 'the playlist changing videos is not the person watching closing one');
  c.lessonPlaylist.switching = false;
  c.lessonPlaylistExited();
  assert.equal(c.lessonPlaylist, null);
  assert.equal(c.$('playlistBar').hidden, true);
  assert.match(fnSrc('lessonExitPlayback'), /lessonPlaylistExited\(\);\n\s*if \(!pb\) return;/, 'closing a replay ends the playlist it was part of');
  assert.match(fnSrc('renderVideoPills'), /lessonPlaylistSync\(\);/, 'the count follows every change to the list');
  assert.match(fnSrc('lessonPlaylistStart'), /lessonBlessMedia\(\);\n\s*lessonPlaylistStop\(\);/, 'every media element is blessed inside the tap');
  assert.match(PLAYLIST, /if \(pl && pl\.phase === 'playing' && lessonPlayback && lessonMedia\(\) === \$\(key\)\) lessonPlaylistUpNext\(pl\);/,
    'the end of the video that is the clock — and only that — moves it on');
  assert.match(fnSrc('lessonPlaylistPlay'), /await lessonPlay\(a\);/, 'every video goes through the one replay a tap on its pill uses');
  assert.match(RECORDING, /e\.target\.closest\('#lessonPlayer, #lessonCamWin, #playlistBar'\)/, 'the playlist bar stays live during a replay');
});

test('🎞 the export is Ans Key\'s machine: a 1920 × 1080 frame, the region the teacher saw, a file named for the paper', () => {
  const c = box();
  const side = c.lessonExportLayout('side', 640, 360);
  assert.deepEqual(plain(side.page), { x: 0, y: 0, w: 1440, h: 1080 });
  assert.ok(Math.abs(side.cam.w / side.cam.h - 16 / 9) < 0.01);
  assert.equal(c.lessonExportLayout('page', 640, 360).cam, null);
  const stack = c.lessonExportStack([{ num: 1, baseW: 600, baseH: 800 }, { num: 3, baseW: 600, baseH: 800 }]);
  assert.equal(stack.rows[3].y, 800 + c.LESSON_EXPORT_GAP, 'a hidden page 2 leaves no gap in the video');
  const t = c.lessonExportTarget({ page: 1, x: 300, y: 200, zoom: 2 }, stack, { x: 0, y: 0, w: 1440, h: 1080 }, 'follow', { w: 1000, h: 700 });
  assert.ok(1440 / t.s >= 500 - 1e-6 && 1080 / t.s >= 350 - 1e-6, 'every unit the teacher saw is on the frame');
  assert.equal(c.lessonExportFileName('P5 Maths: Fractions', 'Q5 · video solution', 'video/mp4'), 'P5 Maths Fractions — Q5 · video solution (1080p).mp4');
  assert.match(EXPORT, /job\.name = lessonExportFileName\(job\.title, job\.subtitle\.replace\(\/\\s\*·\\s\*\[\\d:\]\+\$\/, ''\), type\);/,
    'the pill\'s running time is taken off the file name — "3:12" is not a name, and a colon is not allowed in one');
  assert.equal('Q5 · video solution · 1:02:03'.replace(/\s*·\s*[\d:]+$/, ''), 'Q5 · video solution', 'an hour-long one too');
  assert.match(EXPORT, /function lessonExportMediaNode\(\) \{[\s\S]*?document\.createElement\('video'\)/, 'a fresh <video> for every export');
  assert.doesNotMatch(EXPORT, /audioCtx\.destination/, 'the lesson\'s sound goes into the file, not into the room');
  const code = EXPORT.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(code, /scale\(\s*-1|mirror/i, 'the recording was never mirrored, and neither is the export');
  assert.match(EXPORT, /if \(!lessonAdmin\(\) \|\| currentUser\.uid !== job\.uid \|\| wsEpoch !== job\.epoch\) \{/, 'an export dies with the worksheet or the account');
  assert.match(fnSrc('lessonRoleChanged'), /if \(!lessonAdmin\(\)\) \{\n[\s\S]*?lessonExportDrop\(\);/);
});

test('a video watched is counted — by the worksheet\'s own name and the question, never anything a child wrote', () => {
  assert.match(html, /video:\s+\{ label: 'Watched a video solution', count: 'videos' \}/);
  assert.match(fnSrc('lessonPlay'), /usageNote\('video', \(docName \|\| 'a worksheet'\) \+ \(a\.lessonRecording\.title \? ' · ' \+ a\.lessonRecording\.title : ''\)\);/);
  assert.equal((BLOCK.match(/usageNote\(/g) || []).length, 1, 'one door, one event');
});

test('the set paper carries its list to every copy, and the markup the code reaches for is all there — once', () => {
  const push = fnSrc('pushWorksheet');
  const setCall = push.slice(push.indexOf('.doc(w.id).set({'), push.indexOf('active: true', push.indexOf('.doc(w.id).set({')));
  assert.match(setCall, /videos: lessonVideosClean\(w\.videos\),/, 'the assignment is a whole `set`: a list left out here is a list wiped');
  assert.ok(push.indexOf('var fresh = await db.collection(COLLECTION).doc(id).get();') < push.indexOf('videos: lessonVideosClean(w.videos)'),
    'read off the worksheet read LIVE, never a stale row of the list');
  // Every element the block reaches for by id is in the markup, exactly once —
  // a missing one is a click that throws, a duplicate is the ✍️ twin that
  // toggled twice per press. An element the block MAKES carries its id from
  // `.id = '…'` and must then NOT also be in the markup.
  const made = new Set([...BLOCK.matchAll(/\.id = '([A-Za-z][A-Za-z0-9_-]*)';/g)].map(m => m[1]));
  const ids = new Set();
  for (const m of BLOCK.matchAll(/\$\('([A-Za-z][A-Za-z0-9_-]*)'\)/g)) ids.add(m[1]);
  assert.ok(ids.size > 40, 'the census found the ids');
  for (const id of ids) {
    const n = html.split('id="' + id + '"').length - 1;
    assert.equal(n, made.has(id) ? 0 : 1, '#' + id + (made.has(id) ? ' is made by the code and not in the markup' : ' is in the markup exactly once') + ' (found ' + n + ')');
  }
  assert.deepEqual([...made], ['lessonExportVideo'], 'the one element the block makes for itself');
  const tools = cut('<div class="toolGroup" id="lessonTools" hidden>', '<div class="toolGroup" id="colorGroup">');
  assert.doesNotMatch(tools, /btnLabel/, 'the two toolbar buttons are icons — a label inside a 28px square spills over the next one');
  assert.match(tools, /id="lessonRecordBtn" hidden/, '⏺ ships hidden: lessonToolsSync draws it for the teacher only');
  const stack = cut('<div class="barStack" id="barStack">', '<div class="lessonCamWin" id="lessonCamWin"');
  assert.doesNotMatch(stack, /id="lessonCamWin"/, '#lessonCamWin lives OUTSIDE the translated stack, or it is placed against the stack');
  assert.match(html, /<div class="lessonCamWin" id="lessonCamWin" hidden/);
});
