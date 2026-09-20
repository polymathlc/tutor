#!/usr/bin/env node
/* =====================================================================
   tools/tutor-tests.mjs — the harness for Study Buddy
   ---------------------------------------------------------------------
   It loads the REAL sections out of index.html and runs them against
   stubs, because every single failure in here is SILENT and the app goes
   on looking perfectly right:

   • A help ceiling that stops being applied is an app that hands a
     ten-year-old the answer their parent switched off, on a screen that
     still says "Nudges only".
   • A ceiling applied to the hints and not to the chat, or not to the
     marking, is the same thing one press further along.
   • A verdict left on a blank is a red cross on a question nobody
     attempted — the one mistake this app can make.
   • A page number read batch-local rather than global cites the wrong page
     on every question after the third, and files every mistake picture
     from the wrong page with it.
   • A digest that comes back empty is an ungrounded answer, and nothing
     throws.
   • An `askGemini` call site that forgets `aiGrounding` grounds one button
     and not the next — which is exactly what the one-door rule exists to
     prevent, and nothing anywhere would say so.

   Run: node tools/tutor-tests.mjs
   ===================================================================== */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const FILE = join(here, '..', 'index.html');
const html = readFileSync(FILE, 'utf8').replace(/\r\n/g, '\n');

let failures = 0;
let checks = 0;
function ok(name, cond, detail) {
  checks++;
  if (cond) { console.log('  ✓ ' + name); return; }
  failures++;
  console.log('  ✗ ' + name + (detail ? '\n      ' + detail : ''));
}
function eq(name, got, want) {
  ok(name, JSON.stringify(got) === JSON.stringify(want),
     'got ' + JSON.stringify(got) + ', wanted ' + JSON.stringify(want));
}
function section(t) { console.log('\n' + t); }

/* ---- Pull the real source out of the file ---- */
function between(startMarker, endMarker, what) {
  const a = html.indexOf(startMarker);
  if (a === -1) throw new Error('could not find the start of ' + what + ' (' + startMarker.slice(0, 48) + '…)');
  const b = html.indexOf(endMarker, a + startMarker.length);
  if (b === -1) throw new Error('could not find the end of ' + what + ' (' + endMarker.slice(0, 48) + '…)');
  return html.slice(a, b);
}

/* The end markers start at their own `/*` on purpose: cut a block in the
   middle of a comment and what comes out has an unterminated /* in it, and
   the harness dies on a syntax error in code that is perfectly fine. */
const BAR = '/* =====================================================================';
const SRC_DEADLINES = between('/* ================= AI request deadlines ================= */',
                             '/* ================= End AI request deadlines ================= */', 'request deadlines');
const SRC_CORE   = between('/* ================= Small helpers ================= */',
                           BAR + '\n   THE ANNOTATION ENGINE', 'the helpers, the ladder and the grounding');
const SRC_ANN    = between('/* Unrotated frame of an x/y/w/h annotation.',
                           '/* ================= Undo / redo ================= */', 'the annotation shapes');
const SRC_KEY    = between(BAR + '\n   🔑 THE ANSWER KEY', BAR + '\n   THE STUDY BUDDY', 'the answer key');
const SRC_BUDDY  = between('var hints = [];', BAR + '\n   THE SCREENS', 'the buddy');
const SRC_SIZE   = between('/* ================= HOW BIG THE MARK IS =================',
                           '/* Stroke eraser: drag across ink', 'the size control');
const SRC_BODY   = between('/* THE ONE PLACE A SAVED BODY BECOMES',
                           'async function openWorksheet', 'the body reader');
const SRC_STAMP  = between('/* A Firestore timestamp, a Date, a number or nothing',
                           'async function deleteWorksheet', 'the timestamp reader');
const SRC_SAVE   = between('/* ================= AUTO-SAVE =================',
                           'async function loadWorksheets', 'auto-save');
const SRC_PRAC   = between('var pracSel = {};',
                           '/* THE ONE PLACE ANYTHING IN THIS APP IS COPIED', 'practising the mistakes');
const SRC_PEOPLE = between('var PEOPLE_COL =', 'function renderAuth() {', 'the first sign-in and the roster');
const SRC_GUIDE  = between('/* ---- WHOSE HELP LEVEL IS IT? ----', 'function openGradeModal(', 'the help-level lock');
const SRC_COVER  = between('var COVER_W =', "/* ---- The worksheet list ---- */", 'the worksheet cover');
/* The rebuild: the crop machinery ported from Scan & Answer under the SAME
   identifiers, so that a fix in either app copies straight across. */
const SRC_REBUILD = between('var MB_BUILD_MAX = 10;',
                            '/* ================= The mistake book =================', 'the question rebuild');
const SRC_TIERS   = between('/* ---- WHICH TIER THIS ONE IS',
                            'async function loadMistakes(quiet) {', 'the three tiers');
/* The teacher's copy of a student's book: what may travel off the device,
   and what the panel makes of it. */
const SRC_MIRROR  = between('var MIST_MIRROR_MAX =',
                            'async function mistakeImageUrl(m) {', 'the mistake mirror');
/* The ONE renderer the card, the practice session and the printed sheet all
   build the question with. The practice tests below drive it for real. */
const SRC_QNODES  = between('/* =====================================================================\n   THE ONE PLACE A MISTAKE\'S QUESTION IS DRAWN',
                            'function mistakeCard(m) {', 'the question renderer');

/* The ruler drawn on the copy of a page that goes to the model, and the
   crosshair on the spot the student tapped. Cut short of `pageJpegForModel`,
   which needs a real canvas — what is testable here is the ARITHMETIC that
   decides where the crosshair lands. */
const SRC_RULER  = between('/* ================= THE RULER AND THE CROSSHAIR',
                           '/* The whole page as the MODEL reads it', 'the ruler and the crosshair');

const SRC_PALM   = between('var stylusOnly = (function () {',
                           'function attachOverlayHandlers(p) {', 'palm rejection and touch navigation');

/* ---- A sandbox with just enough world to evaluate them ---- */
const noop = () => {};
const domStub = {
  getElementById: () => null,
  querySelectorAll: () => [],
  createElement: () => ({ style: {}, classList: { add: noop, remove: noop, toggle: noop },
                          appendChild: noop, setAttribute: noop, addEventListener: noop, focus: noop,
                          remove: noop }),
  addEventListener: noop
};
/* A real map, because the local backup's whole job is what it keeps and what
   it clears — a stub that swallows both would agree with any behaviour. */
const store = new Map();
const localStorageStub = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: k => { store.delete(k); }
};
const sandbox = {
  console,
  document: domStub,
  window: { addEventListener: noop, confirm: () => false },
  localStorage: localStorageStub,
  db: null, auth: null, storage: null, firebase: null,
  // The answer-key block reads these at CALL time; they are declared in
  // parts of the file this harness deliberately does not evaluate.
  pages: [], annotations: [], wsEpoch: 0, view: '', currentDocId: '', pdfDoc: null,
  STORAGE_DIR: 'tutor-worksheets', ADMIN_DISPLAY_NAME: 'Mr Chung',
  // The usage door asks who is signed in; the teacher is never recorded.
  ADMIN_EMAIL: 'chungzhikai@gmail.com',
  // The size control and auto-save reach these at CALL time.
  selectedId: null, editingId: null, tool: 'pen', strokeW: 3, fontSize: 16,
  dirty: false, docName: 'Worksheet', currentUser: null, wsKey: {},
  renderAllOverlays: noop, pushUndo: noop, setDirty: noop, toast: noop,
  applyKeyVisibility: noop, renderHints: noop, renderMarking: noop, renderChat: noop,
  performSave: noop, round2: v => Math.round(v * 100) / 100,
  worksheetBody: () => '{}',
  // The practice session and the printed sheet reach these at CALL time.
  mistakes: [], mistFilter: 'open', levelLabel: v => v, subjectLabel: () => 'Science',
  // The rebuild reads these at CALL time only; nothing here calls it.
  MISTAKE_DIR: 'tutor-mistakes', marking: { items: [] },
  // The cover reads the pages the STUDENT has, and writes one small field.
  worksheets: [], COLLECTION: 'tutorWorksheets', studentPages: () => [],
  // The two locks on a worksheet the teacher SET.
  assignments: [], assignmentsLoaded: false,
  mistakeImageUrl: () => Promise.resolve(''), setMistakeCleared: noop, renderMistakes: noop,
  aiAvailable: () => true, loadTeachingNotes: () => Promise.resolve(),
  chungAvatar: () => ({ style: {}, classList: { add: noop } }), chungSays: n => n,
  boxNode: () => ({}), escHtml: v => String(v),
  bodyByteLength: j => String(j).length,
  setTimeout, clearTimeout, Blob: class { constructor(p) { this.size = String(p).length; } },
  Math, JSON, Date, String, Number, Array, Object, parseInt, parseFloat, isNaN, Promise,
  // The touch-navigation engine keeps its live fingers in a Map.
  Map, Set, AbortController
};
vm.createContext(sandbox);
vm.runInContext(SRC_DEADLINES + '\n' + SRC_CORE + '\n' + SRC_ANN + '\n' + SRC_KEY + '\n' + SRC_BUDDY +
                '\n' + SRC_SIZE + '\n' + SRC_BODY + '\n' + SRC_STAMP + '\n' + SRC_SAVE +
                '\n' + SRC_PRAC + '\n' + SRC_PEOPLE + '\n' + SRC_COVER + '\n' + SRC_GUIDE +
                '\n' + SRC_REBUILD + '\n' + SRC_TIERS + '\n' + SRC_MIRROR + '\n' + SRC_QNODES + '\n' + SRC_PALM +
                '\n' + SRC_RULER,
                sandbox, { filename: 'index.html' });
const S = sandbox;

/* =====================================================================
   1. THE HELP CEILING — the thing the whole app turns on
   ===================================================================== */
section('The help ceiling');

eq('"nudge" allows one rung', S.rungsAllowed('nudge').map(r => r.key), ['nudge']);
eq('"concepts" allows two', S.rungsAllowed('concepts').map(r => r.key), ['nudge', 'concepts']);
eq('"method" allows three', S.rungsAllowed('method').map(r => r.key), ['nudge', 'concepts', 'method']);
eq('"answer" allows all four', S.rungsAllowed('answer').map(r => r.key),
   ['nudge', 'concepts', 'method', 'answer']);

/* A worksheet saved by a later version with a help level this build has
   never heard of must NOT quietly become one that gives out full answers. */
eq('an unknown help level falls back to the DEFAULT, never to the top',
   S.rungsAllowed('supercharged').map(r => r.key), S.rungsAllowed(S.HINT_DEFAULT).map(r => r.key));
ok('…and the default is not the top rung', S.HINT_DEFAULT !== 'answer',
   'HINT_DEFAULT is "' + S.HINT_DEFAULT + '"');
eq('a missing help level falls back the same way',
   S.rungsAllowed(undefined).map(r => r.key), S.rungsAllowed(S.HINT_DEFAULT).map(r => r.key));

/* Every grade the picker offers must name a rung that exists, or a parent
   picks a level the ladder cannot honour. */
ok('every grade in the picker names a real rung',
   S.GUIDANCE_GRADES.every(g => S.HINT_RUNG_KEYS.indexOf(g.key) !== -1),
   'grades: ' + S.GUIDANCE_GRADES.map(g => g.key).join(', '));
ok('there is one grade per rung', S.GUIDANCE_GRADES.length === S.HINT_RUNGS.length);

/* The prompt only ever ASKS for the allowed rungs — that is what makes the
   ceiling real rather than a thing the page hides. */
const askedNudge = S.hintPromptFor(S.rungsAllowed('nudge'));
ok('the hint prompt asks only for the allowed rungs',
   askedNudge.includes('"nudge"') && !askedNudge.includes('"answer"'), askedNudge);

/* =====================================================================
   2. …and it is applied in all three places
   ===================================================================== */
section('The ceiling reaches the chat and the marking too');

S.wsMeta = { level: '', subject: '', guidance: 'nudge' };
ok('the chat is told the answer is off at a low level', /NUDGE/.test(S.buddyCeilingRule()));
ok('a blank question keeps its answer back at a low level', /BLANK/.test(S.markBlankRule()));
S.wsMeta.guidance = 'answer';
eq('at full help the chat rule falls away', S.buddyCeilingRule(), '');
eq('…and so does the blank rule', S.markBlankRule(), '');
S.wsMeta.guidance = 'method';
ok('at "method" the chat is still held back', S.buddyCeilingRule().length > 0);

/* =====================================================================
   3. Reading the ladder back — a rung nobody asked for never lands
   ===================================================================== */
section('Reading a ladder out of a reply');

S.wsMeta = { level: 'P5', subject: 'science', guidance: 'concepts' };
S.pages = [];
const modelReply = {
  question: 'Explain why the puddle dried up.',
  number: '7',
  rungs: [
    { key: 'answer',   text: 'The water evaporated.', keywords: [] },     // NOT asked for
    { key: 'concepts', text: 'This is about the water cycle.', keywords: ['evaporation', 'water vapour'] },
    { key: 'nudge',    text: 'Look at where the water went.', keywords: [] },
    { key: 'invented', text: 'nonsense', keywords: [] }
  ]
};
S.window.askGemini = async () => JSON.stringify(modelReply);
const ladder = await S.hintLadderFor({ num: 1, baseH: 800, canvas: { width: 0, height: 0 } }, { x: 10, y: 100 });

eq('a rung the help level locks is DROPPED even when the model sends it',
   ladder.rungs.map(r => r.key), ['nudge', 'concepts']);
ok('…and its text never reaches the page',
   !JSON.stringify(ladder).includes('The water evaporated'), JSON.stringify(ladder));
ok('a key nobody asked for is dropped', !JSON.stringify(ladder).includes('nonsense'));
eq('the rungs come back in LADDER order, not reply order',
   ladder.rungs.map(r => r.key), ['nudge', 'concepts']);
eq('keywords ride on the concepts rung', ladder.rungs[1].keywords, ['evaporation', 'water vapour']);
eq('and nowhere else', ladder.rungs[0].keywords, []);
eq('the question comes back for the card', ladder.question, 'Explain why the puddle dried up.');

S.window.askGemini = async () => JSON.stringify({ question: '', rungs: [] });
const empty = await S.hintLadderFor({ num: 1, baseH: 800, canvas: { width: 0, height: 0 } }, { x: 10, y: 100 });
eq('a reply with no rungs comes back empty rather than throwing', empty.rungs, []);

/* =====================================================================
   4. Marking — a blank is NEVER marked wrong
   ===================================================================== */
section('Marking');

const blank = S._markFields({ studentAnswer: '', verdict: 'wrong', marks: '0/2', feedback: 'You got it wrong' });
eq('a blank is not marked', blank.marked, false);
eq('…its verdict is dropped', blank.verdict, '');
eq('…its feedback goes with it', blank.feedback, '');
/* The marks are the ONE thing that survives a blank, and they are not an
   exception to the rule: "0 out of 2" is the allocation the paper printed,
   not a judgement on an answer nobody wrote. The verdict, the feedback and
   the cross on the page all still stand down. */
eq('…but the marks it was worth stand, awarded 0', blank.marks, '0/2');
eq('…and the telling-off with it', blank.feedback, '');

/* =====================================================================
   🕳 …and the ONE blank that IS a mistake
   ---------------------------------------------------------------------
   The rule above does not move: a skipped question still gets no verdict,
   no feedback and no cross, and the report still counts it blank. What
   changes is whether it reaches the MISTAKE BOOK, and BOTH directions of
   that are silent. File none of them and the questions a child is most
   stuck on are quietly lost, on a screen saying the book is up to date.
   File the tail as well and the book fills with questions nobody has
   failed at, which is a book nobody opens twice.
   ===================================================================== */
const paper = str => str.split('').map(c => ({ marked: c === 'a', verdict: c === 'a' ? 'wrong' : '' }));
const skips = str => paper(str).map((it, i, all) => (S.markSkipped(all, i) ? i : -1)).filter(i => i >= 0);

eq('a blank with an answered question after it was SKIPPED', skips('a.a'), [1]);
/* It is the LAST answered question that ends the paper, never the next
   one: "is the question after this answered?" files only the final blank
   of a run and loses every one before it. */
eq('a RUN of blanks before an answer is every one of them', skips('a..a'), [1, 2]);
eq('the blanks at the END are the tail — out of time, not stuck', skips('aa..'), []);
eq('…and a paper blank from question one is all tail', skips('....'), []);
eq('gone past, then stopped: only the first is filed', skips('a.a..'), [1]);
eq('an attempted question is never a skip, whatever its verdict',
   S.markSkipped([{ marked: true, verdict: 'wrong' }, { marked: true, verdict: 'correct' }], 0), false);
/* A CORRECT answer ends the tail just as a wrong one does. The test is
   whether they CARRIED ON past the blank; how the questions after it went
   has nothing to do with it. */
eq('a correct answer after a blank makes it a skip too',
   S.markSkipped([{ marked: false, verdict: '' }, { marked: true, verdict: 'correct' }], 0), true);
eq('the tail is measured from the last answered question', S.markLastAnswered(paper('a..a..')), 3);
eq('a paper nobody attempted has none', S.markLastAnswered(paper('...')), -1);
eq('…and nothing at all is not a crash',
   [S.markLastAnswered(), S.markSkipped(undefined, 0), S.markSkipped([], 3)], [-1, false, false]);

const written = S._markFields({ studentAnswer: '1.4', verdict: 'PARTIAL', marks: '1/2', feedback: 'Nearly.' });
eq('a written answer is marked', written.marked, true);
eq('the verdict is read case-insensitively', written.verdict, 'partial');
eq('the marks survive', written.marks, '1/2');

const invented = S._markFields({ studentAnswer: '1.4', verdict: 'almost there', feedback: 'Nearly.' });
eq('a verdict the model invented is dropped', invented.verdict, '');
eq('…but the student\'s work still shows as marked', invented.marked, true);
eq('…with the feedback kept', invented.feedback, 'Nearly.');

/* The page a question is on is GLOBAL, not batch-local: the model numbers
   the pictures 1..n within the batch it was handed. Get this wrong and
   every question after the third cites the wrong page — and every mistake
   picture is cropped from it. */
const it3 = S._markNewItem({ question: 'Q', answer: 'A', page: 2 }, [4, 5, 6]);
eq('the 2nd picture of a batch of pages 4,5,6 is page 5', it3.page, 5);
const itBad = S._markNewItem({ question: 'Q', answer: 'A', page: 9 }, [4, 5, 6]);
eq('a picture outside the batch falls back to the batch\'s first page', itBad.page, 4);
const itNone = S._markNewItem({ question: 'Q', answer: 'A' }, [1, 2]);
eq('a missing page falls back the same way', itNone.page, 1);
eq('an empty row is not a question', S._markNewItem({}, [1]), null);
/* THE PAGE NUMBERS ARE THE REAL ONES, not an index into the run. With an
   answer key hidden the pages a student has are not consecutive, so the
   3rd picture of a run can be page 6 — and a mistake picture cropped from
   "page 3" would then be a picture of a different question entirely. */
const itSkip = S._markNewItem({ question: 'Q', answer: 'A', page: 3 }, [1, 2, 6]);
eq('a run that skips a hidden key page still names the real page', itSkip.page, 6);

/* A question straddling a batch boundary is ONE question, not two halves
   each with half an answer. */
const into = [];
S._markFoldRows([{ number: '8', question: 'The first half', answer: '', page: 1 }], [1], into);
S._markFoldRows([{ continuation: true, question: 'the second half.', answer: '42 cm', page: 1,
                   explanation: 'Because…', studentAnswer: '40', verdict: 'wrong', feedback: 'Check the units.' }],
                [2], into);
eq('a continuation folds into the question before it', into.length, 1);
eq('…its wording is joined', into[0].question, 'The first half the second half.');
eq('…the answer comes from the half that could see the whole question', into[0].answer, '42 cm');
eq('…the page it ENDS on is remembered', into[0].endPage, 2);
eq('…and the marking is merged in', into[0].verdict, 'wrong');

const two = [];
S._markFoldRows([{ number: '1', question: 'A', answer: 'a', page: 1 },
                 { continuation: true, question: 'B', answer: 'b', page: 1 }], [1], two);
eq('a continuation that is NOT the first row of a batch is its own question', two.length, 2);

/* =====================================================================
   5. The grounding — one door, four kinds
   ===================================================================== */
section('The grounding');

S.currentUser = null;
S.wsMeta = { level: 'P5', subject: 'science', guidance: 'method' };
S.teachingNotes = [{
  id: 'n1', title: 'Heat', subjects: [], levels: [],
  guidance: 'Never accept "it dries up" — the answer must name evaporation.',
  keywords: ['evaporation', 'water vapour'],
  markingStandards: 'A missing keyword is at best a partial mark.',
  keyFacts: 'Evaporation happens at the surface of a liquid.'
}];
S.aiStyle = {
  profileSamples: 12,
  profile: {
    styleRules: 'Short full sentences.',
    markingStandards: 'Be strict about units.',
    keywords: ['evaporation'],
    exemplars: [{ q: 'Why did it dry?', a: 'The water evaporated into water vapour.' }]
  }
};

const gMark  = S.aiGrounding('mark');
const gHint  = S.aiGrounding('hint');
const gTeach = S.aiGrounding('teach');
const gAns   = S.aiGrounding('answer');

ok('the hand-typed guidance reaches EVERY kind, marking included',
   [gMark, gHint, gTeach, gAns].every(g => g.includes('it dries up')));

ok('marking gets the marking standards', gMark.includes('A missing keyword'));
ok('marking never gets the key facts', !gMark.includes('surface of a liquid'));
ok('marking never gets the exemplar answers', !gMark.includes('evaporated into water vapour'),
   'a marker handed the answer stops marking against the paper');
/* The profile's `markingStandards` is a GUESS a model drew from the teacher's
   answers, and an inference must never decide a mark: the standard a student
   is held to is the typed notes and guidance. It used to reach marking. */
ok("marking never gets the profile's INFERRED marking standard", !gMark.includes('Be strict about units'));
ok("'How this teacher marks' is never in a marking digest", !gMark.includes('How this teacher marks'));
ok('marking still gets the rules and the keywords', gMark.includes('Short full sentences') && gMark.includes('evaporation'));

ok('a hint gets the key facts it is built from', gHint.includes('surface of a liquid'));
ok('a hint gets the keywords to steer towards', gHint.includes('evaporation'));
ok('a hint does NOT get the marking standards', !gHint.includes('A missing keyword'),
   'a hint is not a mark');
ok('a hint DOES get the exemplars, so it sounds like this teacher',
   gHint.includes('evaporated into water vapour'));

ok('every kind states an authority order', [gMark, gHint, gTeach, gAns].every(g => g.includes('AUTHORITY ORDER')));
ok('the hint authority order puts the worksheet first', /worksheet itself prints/.test(gHint));

S.teachingNotes = [];
S.aiStyle = null;
eq('no notes and no style is an EMPTY digest, not an empty heading', S.aiGrounding('hint'), '');

/* =====================================================================
   The teacher's corrections reach this app (v1.14.0)
   Document A is read WHOLE (per-bucket profiles, the corpus, the edits and
   their lessons) and document C — the Science portal's corrections — beside
   it. Every failure here is silent: the hint still comes back, it simply
   goes on making the mistake the teacher corrected yesterday.
   ===================================================================== */
section("The teacher's corrections reach this app");
S.wsMeta = { level: 'P5', subject: 'science', guidance: 'method' };
S.teachingNotes = [];
S.cerStyle = null;
S.aiStyle = {
  samples: [{ k: 's1', q: 'Why did the water level in the beaker fall?', a: 'The water evaporated into water vapour and escaped.', lvl: 'p5', sub: 'science' }],
  edits: [{ k: 'e1', q: 'Why did the ice melt?', wrote: 'It got hot.', a: 'The ice gained heat from the surroundings and melted.',
            lvl: 'p5', sub: 'science', note: 'Always name the direction of heat flow.' }]
};
const nulBlk = S.styleBlock('hint', 'Why did the water level fall?');
ok('with NO profile the exemplars still reach a hint (no early return)', nulBlk.includes('evaporated into water vapour'));
ok('…and the lessons', nulBlk.includes('direction of heat flow'));
ok('…and the raw pairs', nulBlk.includes('the teacher rewrote it as: The ice gained heat'));
ok('…and the heading counts the corrections being followed', /following 1 correction\b/.test(nulBlk));
ok('the pairs go LAST, nearest the question', nulBlk.indexOf('rewrote it as') > nulBlk.indexOf('direction of heat flow'));
ok('the summary says the loop is in force with no profile at all',
   S.groundingSummary().some(b => /learned style/.test(b)) && S.groundingSummary().some(b => /^1 correction$/.test(b)));
const mkBlk = S.styleBlock('mark', 'Why did the water level fall?');
ok("'mark' gets no exemplars", !mkBlk.includes('evaporated'));
ok("'mark' gets no lessons and no pairs", !mkBlk.includes('direction of heat flow') && !mkBlk.includes('rewrote it as'));
ok("'mark' with nothing but corrections is an EMPTY block", mkBlk === '');
S.aiStyle = { samples: [], edits: [], profiles: { _global: {
  styleRules: 'Full sentences.', markingStandards: 'Inferred: no mark without the keyword.',
  fixes: ['Name the process.'], keywords: ['evaporation'] } } };
const mkBlk2 = S.styleBlock('mark', '');
ok("'mark' never contains 'How this teacher marks'", !mkBlk2.includes('How this teacher marks') && !mkBlk2.includes('no mark without the keyword'));
ok("'mark' gets no fixes", !mkBlk2.includes('Name the process'));
ok("'mark' still gets the rules and the keywords", mkBlk2.includes('Full sentences') && mkBlk2.includes('evaporation'));
ok("a hint gets the fixes", S.styleBlock('hint', '').includes('Name the process'));
ok('…but never the inferred marking standard', !S.styleBlock('hint', '').includes('no mark without the keyword'));
ok('the practice retry is marked, so it is grounded as mark', S.aiGrounding('mark').indexOf('Name the process') === -1);

/* The bucket fallback chain: lvl:sub (≥30 answers) → any:sub → _global. */
const mkSamples = n => Array.from({ length: n }, (_, i) => ({ k: 'p' + i, q: 'q' + i, a: 'a' + i, lvl: 'p5', sub: 'science' }));
let stDoc = { samples: mkSamples(30), profiles: {
  'p5:science': { styleRules: 'P5 SCIENCE VOICE' }, 'any:science': { styleRules: 'ANY SCIENCE VOICE' }, _global: { styleRules: 'GLOBAL VOICE' } } };
S.aiStyle = stDoc;
ok('the exact bucket wins with 30 answers behind it', S.styleBlock('hint', '').includes('P5 SCIENCE VOICE'));
ok('…and the heading says which', /learned from 30 of their own P5 Science answers/.test(S.styleBlock('hint', '')));
eq('the pick is reported', S.styleProfilePick('P5', 'science').bucket, 'p5:science');
ok('the summary names the bucket', S.groundingSummary().some(b => /learned style \(P5 Science\)/.test(b)));
stDoc.samples = mkSamples(29);
ok('a thin bucket (29) falls to the subject at any level', S.styleBlock('hint', '').includes('ANY SCIENCE VOICE'));
ok('…and says it fell', S.styleProfilePick('P5', 'science').fell === true);
delete stDoc.profiles['any:science'];
ok('…and then to the global profile', S.styleBlock('hint', '').includes('GLOBAL VOICE'));
S.aiStyle = { samples: [], profiles: { 'p5:science': { styleRules: 'P5 SCIENCE VOICE', n: 40 }, _global: { styleRules: 'GLOBAL VOICE' } } };
ok('with no samples in hand the bucket counts itself (profile.n)', S.styleBlock('hint', '').includes('P5 SCIENCE VOICE'));
S.aiStyle = { samples: [], profiles: { 'p5:science': { styleRules: 'P5 SCIENCE VOICE', n: 12 }, _global: { styleRules: 'GLOBAL VOICE' } } };
ok('…and a thin one still falls through', S.styleBlock('hint', '').includes('GLOBAL VOICE'));
S.aiStyle = { samples: [], profile: { styleRules: 'FLAT MIRROR' } };
ok('a document holding only the flat mirror still grounds', S.styleBlock('hint', '').includes('FLAT MIRROR'));
S.wsMeta = { level: 'P6', subject: 'math', guidance: 'method' };
S.aiStyle = { samples: mkSamples(30), profiles: { 'p5:science': { styleRules: 'P5 SCIENCE VOICE' }, _global: { styleRules: 'GLOBAL VOICE' } } };
ok('another worksheet is never served a bucket that is not its own', !S.styleBlock('hint', '').includes('P5 SCIENCE VOICE'));
eq('an untagged worksheet is the global profile', S.styleProfilePick('', '').bucket, '_global');

/* Document C — the Science portal's own corrections. */
S.wsMeta = { level: 'P5', subject: 'science', guidance: 'method' };
S.aiStyle = { samples: [], edits: [{ k: 'a1', q: 'Why did the ice melt?', wrote: 'It got hot.', a: 'The ice gained heat.', lvl: 'p5', sub: 'science', at: '2026-08-01T00:00:00Z' }] };
S.cerStyle = { v: 2, edits: [{ slot: 'q1', q: 'Why does the puddle disappear?', wrote: 'It dries.', a: 'The water evaporates into water vapour.',
                               sub: 'science', lvl: 'p5', src: 'cer', note: 'Name evaporation, never "dries up".', at: '2026-09-01T00:00:00Z' }] };
const cbBlk = S.styleBlock('hint', 'Why does a puddle disappear on a hot day?');
ok("the Science portal's corrections reach the block", cbBlk.includes('evaporates into water vapour'));
ok('…and their lessons', cbBlk.includes('never "dries up"'));
ok('…and the union is keyed apart', S.styleEditsAll().some(e => e.k === 'cer:q1' && e.src === 'cer') && S.styleEditsAll().some(e => e.k === 'a1' && e.src === 'anskey'));
ok('…and the summary counts both', S.groundingSummary().some(b => /^2 corrections$/.test(b)));
eq('…and the newest is newest whichever document holds it', S.styleRecentEdits('', 'P5', 'science')[0].k, 'cer:q1');
ok('…but none of it reaches marking', !S.styleBlock('mark', '').includes('evaporates') && !S.styleBlock('mark', '').includes('dries up'));
S.cerStyle = { v: 2, edits: [{ slot: 'q2', q: 'Q', wrote: 'W', a: 'A', sub: 'science', note: 'Same lesson twice.' }, { slot: 'q3', q: 'Q', wrote: 'W', a: 'A', sub: 'science', note: 'SAME LESSON TWICE.' }] };
eq('the same lesson twice is one lesson', S.styleLessons('P5', 'science').length, 1);

/* Retrieval by the question, this bucket first. */
S.cerStyle = null;
S.aiStyle = { samples: [
  { k: 'a', q: 'Why does a metal spoon feel colder than a wooden one?', a: 'METAL CONDUCTS heat away from the hand faster.', lvl: 'p5', sub: 'science' },
  { k: 'b', q: 'How many quarters make a whole?', a: 'FOUR quarters make one whole.', lvl: 'p4', sub: 'math' },
  { k: 'c', q: 'Why does a metal spoon feel colder than a wooden one in the morning?', a: 'MATHS METAL red herring.', lvl: 'p6', sub: 'math' }
], edits: [] };
const rqBlk = S.styleBlock('hint', 'Why does a metal spoon feel colder than a plastic one?');
ok('the exemplars are retrieved for the question', rqBlk.includes('METAL CONDUCTS') && !rqBlk.includes('FOUR quarters'));
ok("this worksheet's bucket comes before another subject's stronger match", rqBlk.indexOf('METAL CONDUCTS') < rqBlk.indexOf('MATHS METAL'));
ok('omitting the question is the old behaviour, byte for byte', S.styleBlock('hint') === S.styleBlock('hint', ''));
ok('aiGrounding hands the question through', S.aiGrounding('hint', { q: 'metal spoon colder' }).includes('METAL CONDUCTS'));

/* What a HINT retrieves for: an earlier hint on the same spot, else the
   level/subject line (which matches nothing and so hands back the newest). */
S.hints = [
  { id: 'h1', page: 2, x: 100, y: 400, question: 'Why does the metal spoon feel colder?' },
  { id: 'h2', page: 2, x: 100, y: 900, question: 'How many legs does an insect have?' },
  { id: 'h3', page: 3, x: 100, y: 410, question: 'A hint on another page' },
  { id: 'h4', page: 2, x: 110, y: 405, question: '' }
];
eq('a hint retrieves on the earlier hint at the same spot', S.hintRetrievalQuery({ num: 2 }, { x: 105, y: 410 }), 'Why does the metal spoon feel colder?');
eq('…never one further down the page', S.hintRetrievalQuery({ num: 2 }, { x: 100, y: 700 }), 'P5 Science');
eq('…never one on another page', S.hintRetrievalQuery({ num: 3 }, { x: 100, y: 900 }), 'P5 Science');
S.hints = [];

/* Fair-share pots: the second standing rule REACHES the prompt. */
S.aiStyle = null; S.cerStyle = null;
const longRuleA = 'A'.repeat(1500), longRuleB = 'B'.repeat(1500);
S.teachingNotes = [{ id: 'g1', guidance: longRuleA, subjects: [], levels: [] }, { id: 'g2', guidance: longRuleB, subjects: [], levels: [] }];
const fsBlk = S.aiGrounding('hint');
ok('the second standing rule reaches the prompt', fsBlk.includes('BBBBBBBB'));
ok('a long one is trimmed and SAYS so', fsBlk.includes(S.NOTES_TRIM_MARK));
S.teachingNotes = [{ id: 'g1', guidance: 'Short rule.', subjects: [], levels: [] }, { id: 'g2', guidance: longRuleB, subjects: [], levels: [] }];
ok('a short note is never trimmed', S.aiGrounding('hint').includes('Short rule.'));
S.teachingNotes = [{ id: 'g1', guidance: 'Name the process.', subjects: [], levels: [] }, { id: 'g2', guidance: 'name the process', subjects: [], levels: [] }];
ok('the same rule typed in two apps is one rule', (S.aiGrounding('hint').match(/ame the process/g) || []).length === 1);
ok('notesTrimTo cuts on a word and marks the cut', S.notesTrimTo('one two three four five six', 20).endsWith(S.NOTES_TRIM_MARK));
S.teachingNotes = [];

/* Which notes apply here. 'both' is Ans Key's old maths-and-science pairing
   and must not quietly grow to cover subjects that did not exist when it
   was written. */
section('Which notes apply');
eq("'both' spells out as maths and science", S.noteSubjects({ subjects: ['both'] }), ['math', 'science']);
ok("…and never reaches English", S.noteSubjects({ subjects: ['both'] }).indexOf('english') === -1);
S.wsMeta = { level: 'P5', subject: 'english', guidance: 'method' };
eq('a maths-and-science note does not ground an English paper',
   S.noteAppliesHere({ subjects: ['both'], levels: [] }), false);
eq('a note with no tags applies everywhere', S.noteAppliesHere({ subjects: [], levels: [] }), true);
eq('a P3 note does not ground a P5 worksheet',
   S.noteAppliesHere({ subjects: [], levels: ['P3'] }), false);

/* If nothing matches, the WHOLE notebook is used rather than none of it — a
   teacher who uploaded notes expects them to be read. */
S.teachingNotes = [{ id: 'x', subjects: ['chinese'], levels: [], guidance: 'A rule' }];
eq('nothing matching falls back to the whole notebook, not to nothing',
   S.notesRelevant().length, 1);

/* =====================================================================
   6. The annotation shapes — the fallbacks that keep old work right
   ===================================================================== */
section('The annotation shapes');

eq('an arrow with no `heads` field still has a head at the end', S.annHeads({ type: 'arrow' }), 'end');
eq('a line with no `heads` field still has none', S.annHeads({ type: 'line' }), 'none');
eq('a line CAN be given two heads', S.annHeads({ type: 'line', heads: 'both' }), 'both');
ok('…which makes it a double-headed arrow',
   S.annHasHeadAtStart({ type: 'line', heads: 'both' }) && S.annHasHeadAtEnd({ type: 'line', heads: 'both' }));
eq('a heads value nobody recognises falls back to the type', S.annHeads({ type: 'arrow', heads: 'wat' }), 'end');

eq('no `dash` field is a solid line', S.annDashName({}), 'solid');
eq('a dash style nobody recognises is solid too', S.annDashName({ dash: 'wavy' }), 'solid');
eq('solid has no pattern at all', S.annDashPattern({ dash: 'solid' }), null);

/* The pattern scales with the pen: a fixed one reads as dashed at 1px and
   as a solid line at 12px. */
const thin = S.annDashPattern({ dash: 'dashed', width: 1 });
const fat  = S.annDashPattern({ dash: 'dashed', width: 8 });
ok('the dash pattern is a multiple of the stroke width', fat[0] === thin[0] * 8,
   JSON.stringify(thin) + ' vs ' + JSON.stringify(fat));

/* annBounds is what the marking and the crop measure with — a shape it does
   not know would be measured at the top of the page. */
eq('a pen stroke is bounded by its points',
   S.annBounds({ type: 'pen', points: [{ x: 10, y: 20 }, { x: 30, y: 5 }] }),
   { x: 10, y: 5, x2: 30, y2: 20 });
eq('a line is bounded whichever way it was drawn',
   S.annBounds({ type: 'line', x1: 30, y1: 40, x2: 10, y2: 20 }),
   { x: 10, y: 20, x2: 30, y2: 40 });
eq('a text box is never bounded shorter than one line',
   S.annBounds({ type: 'text', x: 0, y: 0, w: 100, h: 0, fontSize: 10 }).y2, 18);

/* =====================================================================
   6b. 🔑 THE ANSWER KEY — hidden from the student, read by the buddy
   ---------------------------------------------------------------------
   Every failure in here is silent and the app carries on looking right: a
   key page left showing is the whole worksheet given away by scrolling, a
   question page wrongly hidden is a question that has vanished, and a key
   that stops reaching the prompts is a buddy marking against its own guess
   while the card says it has the answers.
   ===================================================================== */
section('The answer key');

/* =====================================================================
   THE KEY THAT TRAVELS IS THE ONE ON SCREEN
   ---------------------------------------------------------------------
   Setting a worksheet read its body off `worksheets` — a list FETCHED
   EARLIER, whose entries carry the body as it was then. A key marked since
   was simply not in the object being read, so the assignment went out with
   `keyPages: []` and every student in the class could scroll through the
   marking scheme. It failed silently and looked like success: the teacher
   saw "Set at…", and the chip on the student's copy still said whose key
   it was while showing every page of it.
   ===================================================================== */
/* Bounded by the function's OWN closing brace rather than by a character
   count. A fixed length silently stops covering the tail the moment the
   function grows — so the catch block's assertions read an empty string and
   pass or fail for a reason that has nothing to do with the code. */
const pushSrc = (function () {
  const a = html.indexOf('async function pushWorksheet');
  const b = html.indexOf('\n}\n', a);
  if (a === -1 || b === -1) throw new Error('could not bound pushWorksheet');
  return html.slice(a, b + 3);
})();
ok('a pending save is flushed before the key is read',
   /if \(currentDocId === id && dirty\) await performSave\(true\);/.test(pushSrc),
   'ticking key pages only SCHEDULES a save, and setting it straight afterwards is the obvious thing to do');
ok('the worksheet is re-read LIVE, never taken from the list',
   /db\.collection\(COLLECTION\)\.doc\(id\)\.get\(\)/.test(pushSrc) &&
   /w = Object\.assign\(\{\}, w, fresh\.data\(\), \{ id: id \}\)/.test(pushSrc),
   'openWorksheet already opens from the live document; the push has to as well');
ok('…and the read happens BEFORE the body is taken',
   pushSrc.indexOf('fresh.data()') < pushSrc.indexOf('var body = await readBody(w)'));
/* Between "hide it" and "show the marking scheme", hiding is the only safe
   way to be wrong — so an empty list never overrides one that names pages. */
ok('an empty key list never overrides a summary that names pages',
   /\(Array\.isArray\(key\.pages\) && key\.pages\.length\)/.test(pushSrc));
/* A worksheet whose key we are no longer sure of is not set at all. */
ok('a read that failed refuses to set the worksheet',
   /Could not read that worksheet just now[\s\S]{0,160}return \{ ok: false/.test(pushSrc));

/* A copy is made with the key pages frozen in, so a page marked afterwards
   would stay readable on every copy already begun — and those are exactly
   the students who have the paper open. */
ok('a key marked later reaches copies already started',
   /function keyPagesFromAssignment\(w\)/.test(html) &&
   /keyPagesFromAssignment\(w\);/.test(html));
ok('…read live from the assignment, like the locked help level',
   /function keyPagesFromAssignment[\s\S]{0,200}assignmentFor\(w\)/.test(html));
ok('…and it only ever ADDS a page, never un-hides one',
   /function keyPagesFromAssignment[\s\S]{0,600}if \(wsKey\.pages\.indexOf\(n\) === -1\) \{ wsKey\.pages\.push\(n\)/.test(html) &&
   !/wsKey\.pages = a\.keyPages/.test(html),
   'one stale read putting the marking scheme back on screen is the worse fault');


ok('a page that announces itself is a key page',
   S.keyPageLooksLikeKey('ANSWER KEY\n\n1  (3)\n2  (1)\n3  (4)'));
ok('…in Chinese too', S.keyPageLooksLikeKey('答案\n\n1 （3）\n2 （1）'));
ok('a marking scheme is a key page',
   S.keyPageLooksLikeKey('Paper 1 Marking Scheme\n1. B\n2. C'));
/* The SHAPE of a key, with no heading anywhere on it — the back page of a
   past paper, which is most of them. */
ok('a dense column of numbered answers is a key page',
   S.keyPageLooksLikeKey(['1 (3)', '2 (1)', '3 (4)', '4 (2)', '5 (3)',
                          '6 (1)', '7 (4)', '8 (2)', '9 (3)', '10 (1)'].join('\n')));

/* …and the other way, which matters more: a question page wrongly called a
   key disappears out of the student's worksheet, and they have no way of
   knowing a question was ever there. */
ok('an ordinary question page is NOT a key page',
   !S.keyPageLooksLikeKey('1. A beaker of water was left on a windowsill for three days.\n' +
                          'Explain what happened to the water level and why.\n\n' +
                          '2. Name the process in question 1.'));
ok('a question page that MENTIONS an answer key is not one',
   !S.keyPageLooksLikeKey('Section B\n\nWork through every question. The answer key is on page 12, ' +
                          'but do not look at it until you have finished.\n\n1. What is 24 x 3?'));
ok('a blank page is not a key page', !S.keyPageLooksLikeKey('   \n \n'));
ok('a handful of numbered lines is not a key page',
   !S.keyPageLooksLikeKey('1 (3)\n2 (1)\n3 (4)\nNow turn over.'));

/* THE TWO GUARDS THAT MAKE HIDING PAGES SAFE AT ALL. Neither can be
   unit-tested without a PDF, so they are pinned against the source: a
   worksheet with every page hidden is not a worksheet, and ink on a page is
   proof it was the student's to answer whatever it looks like. */
const scanSrc = SRC_KEY.slice(SRC_KEY.indexOf('async function keyScanPdf'));
ok('the scan never hides EVERY page', /found\.length\s*>=\s*pages\.length/.test(scanSrc),
   scanSrc.slice(0, 400).replace(/\s+/g, ' '));
ok('…and never hides a page the student has written on',
   /annotations\.forEach[\s\S]{0,120}inked\[a\.page\]/.test(scanSrc) && /!inked\[n\]/.test(scanSrc),
   scanSrc.slice(0, 900).replace(/\s+/g, ' '));

/* =====================================================================
   📖 THE PAPER, READ AT UPLOAD — subject, level, name and key pages off
   the first and last pages. Every failure here is silent: a level
   overridden files a student's worksheet where they cannot see it, a
   subject they do not take does the same, and a key page the model
   invented for a page it never saw is a question page gone.
   ===================================================================== */
section('The paper, read at upload');

eq('the window is the first three and the last four pages, in order',
   S.paperReadWindow(12), [1, 2, 3, 9, 10, 11, 12]);
eq('a short paper is every page once, never twice', S.paperReadWindow(5), [1, 2, 3, 4, 5]);
eq('a one-page paper is one page', S.paperReadWindow(1), [1]);
eq('no pages is no window', S.paperReadWindow(0), []);
eq('the head and the tail can be chosen', S.paperReadWindow(20, 1, 2), [1, 19, 20]);
ok('the window covers a paper no bigger than head plus tail, which is what stops the eye pass running twice',
   S.paperReadWindow(7).length >= 7 && S.paperReadWindow(8).length < 8);

/* What the model wrote, made ours. */
eq('"Mathematics" is math', S.paperReadSubject('Mathematics'), 'math');
eq('"Maths" is math', S.paperReadSubject('maths'), 'math');
eq('"Science (Primary)" is science', S.paperReadSubject('Science (Primary)'), 'science');
eq('华文 is chinese', S.paperReadSubject('华文'), 'chinese');
eq('a subject the centre does not teach is nothing', S.paperReadSubject('Social Studies'), '');
eq('"Primary 5" is P5', S.paperReadLevel('Primary 5'), 'P5');
eq('"p6" is P6', S.paperReadLevel('p6'), 'P6');
eq('"Secondary 1" and "Sec 1" are S1', [S.paperReadLevel('Secondary 1'), S.paperReadLevel('Sec 1')], ['S1', 'S1']);
eq('a level off the ladder is nothing — "Grade 5", "5", "hard"',
   [S.paperReadLevel('Grade 5'), S.paperReadLevel('5'), S.paperReadLevel('hard')], ['', '', '']);
eq('P1 is not a level this centre takes', S.paperReadLevel('P1'), '');

const cleaned = S.paperReadClean(
  { subject: 'MATHS', level: 'primary 5', title: '  P5   Maths  SA2 2024 ', keyPages: ['12', 11, 11, 4, 99, 'x'] },
  [1, 2, 3, 9, 10, 11, 12]);
eq('the clean read carries our subject, our level and a tidied title',
   [cleaned.subject, cleaned.level, cleaned.title], ['math', 'P5', 'P5 Maths SA2 2024']);
eq('key pages are only the pages that were SHOWN, deduped and sorted — 4 and 99 were never on screen',
   cleaned.keyPages, [11, 12]);
ok('a title is cut to a line', S.paperReadClean({ title: 'x'.repeat(300) }, []).title.length <= S.PAPER_READ_TITLE_MAX);
eq('a reply that is not an object is an empty read',
   S.paperReadClean(null, [1, 2]), { subject: '', level: '', title: '', school: '', exam: false, topic: '', keyPages: [] });
/* The school, the exam flag and the topic. */
const rich = S.paperReadClean({ school: '  Nan Hua   Primary School ', exam: 'true', topic: ' Heat ' }, []);
eq('the school is tidied to a line', rich.school, 'Nan Hua Primary School');
ok('exam is a real boolean, read from true or "true" and nothing else', rich.exam === true &&
   S.paperReadClean({ exam: 'yes' }, []).exam === false && S.paperReadClean({ exam: 1 }, []).exam === false);
eq('the topic is tidied', rich.topic, 'Heat');
ok('a school name is cut to a line', S.paperReadClean({ school: 'x'.repeat(200) }, []).school.length <= S.PAPER_READ_SCHOOL_MAX);
/* THE NAME: an exam paper carries its school; a worksheet does not. */
eq('an exam paper is named with its school in front', S.paperReadName({ title: 'P6 Science SA2 2024', school: 'Nan Hua Primary School', exam: true }),
   'Nan Hua Primary School — P6 Science SA2 2024');
eq('a topical worksheet is NOT given the school', S.paperReadName({ title: 'Heat revision', school: 'Nan Hua Primary School', exam: false }), 'Heat revision');
eq('a title that already names the school is left alone',
   S.paperReadName({ title: 'Nan Hua Primary School P6 Prelim', school: 'nan hua primary school', exam: true }), 'Nan Hua Primary School P6 Prelim');
eq('an exam paper with a school and no title is still named', S.paperReadName({ title: '', school: 'Rosyth School', exam: true }), 'Rosyth School exam paper');
eq('no school is just the title', S.paperReadName({ title: 'P5 Maths CA1', school: '', exam: true }), 'P5 Maths CA1');
eq('no read at all is no name', S.paperReadName(null), '');
eq('keyPages that is not a list is no key pages', S.paperReadClean({ keyPages: 'all' }, [1, 2]).keyPages, []);

/* THE RULE THAT MATTERS: nothing chosen is overridden, and a blank is only
   ever filled with a value this account may hold. */
const readP6 = { subject: 'math', level: 'P6', title: 'P6 Maths Prelim', keyPages: [10] };
let ap = S.paperApplyRead(readP6, { level: 'P4', levelFree: false, subject: 'science', subjects: ['science'], name: 'Heat', nameTyped: true });
eq('a STUDENT\'s own level is never overridden by the paper', ap.level, 'P4');
eq('…nor a subject already chosen', ap.subject, 'science');
eq('…nor a name the uploader typed', ap.name, 'Heat');
eq('…so nothing was filled', ap.filled, []);
ap = S.paperApplyRead(readP6, { level: '', levelFree: true, subject: '', subjects: null, name: 'scan0042', nameTyped: false });
eq('the teacher\'s blank level is filled from the paper', ap.level, 'P6');
eq('…and the blank subject', ap.subject, 'math');
eq('…and a file name is replaced by what the paper calls itself', ap.name, 'P6 Maths Prelim');
eq('…and each is named back', ap.filled, ['P6', 'Mathematics', '“P6 Maths Prelim”']);
ap = S.paperApplyRead({ subject: 'science', level: 'P6', title: 'P6 Science Prelim 2024', school: 'Nan Hua Primary School', exam: true, topic: '' },
                      { level: '', levelFree: true, subject: '', subjects: null, name: 'scan0042.pdf', nameTyped: false });
eq('an exam paper\'s file name becomes school — title', ap.name, 'Nan Hua Primary School — P6 Science Prelim 2024');
eq('…and the school and the exam flag travel with it', [ap.school, ap.exam, ap.topic], ['Nan Hua Primary School', true, '']);
ap = S.paperApplyRead({ subject: 'science', level: 'P5', title: 'Heat', school: 'Nan Hua Primary School', exam: false, topic: 'Heat' },
                      { level: '', levelFree: true, subject: '', subjects: null, name: 'x', nameTyped: true });
eq('a topic is carried and named back', [ap.topic, ap.filled[ap.filled.length - 1]], ['Heat', 'topic Heat']);
eq('…and a typed name is still kept, school or no school', ap.name, 'x');
ap = S.paperApplyRead(readP6, { level: '', levelFree: false, subject: '', subjects: ['science'], name: 'x', nameTyped: true });
eq('a level that is not free stays blank even when the paper names one', ap.level, '');
eq('a subject the student does not take is refused, and their own stands in', ap.subject, 'science');
ap = S.paperApplyRead({ subject: 'science', level: 'P5' }, { level: '', levelFree: true, subject: '', subjects: ['math', 'science'], name: 'x', nameTyped: true });
eq('a student who takes both is filed under the one the paper says', ap.subject, 'science');
ap = S.paperApplyRead(null, { level: '', levelFree: true, subject: '', subjects: ['math', 'science'], name: 'x', nameTyped: true });
eq('with NO read at all a two-subject student still gets a subject they take', ap.subject, 'math');
eq('…and nothing else moves', [ap.level, ap.name, ap.filled], ['', 'x', []]);
ap = S.paperApplyRead({ subject: 'Social Studies', level: 'Grade 9' }, { level: '', levelFree: true, subject: '', subjects: null, name: 'x', nameTyped: false });
eq('a read the cleaner would refuse fills nothing', [ap.level, ap.subject, ap.filled], ['', '', []]);

/* Against the file: the read is ADDED to the scan, the tail is walked
   backwards, and the whole-paper eye stands down when the read saw it all. */
ok('the scan UNIONS the read\'s key pages with what the text found',
   /readPages\.forEach\(function \(n\) \{ if \(found\.indexOf\(n\) < 0\) found\.push\(n\); \}\);/.test(scanSrc));
ok('…and only looks at the whole paper when the read has not already',
   /if \(!anyText && !found\.length && !readSawAll && aiAvailable\(true\)\)/.test(scanSrc));
ok('…and walks the key backwards from the last page, one page at a time', /found = await keyWalkBack\(found\);/.test(scanSrc));
ok('…whenever the paper was read at all, never with the AI off', /if \(\(found\.length \|\| read\) && aiAvailable\(true\)\)/.test(scanSrc));
ok('the whole-paper look goes through the one eye', /async function keyScanByEye\(\) \{\n\s*return keyEyeOn\(pages\.map/.test(SRC_KEY));
ok('the walk is bounded', /asked < KEY_WALK_MAX/.test(SRC_KEY));
ok('the walk asks ONE page per call', /var hit = await keyEyeOn\(\[n\]\);/.test(SRC_KEY));

/* THE WALK, driven by hand: a stubbed eye that knows which pages are the
   key, and a count of what it was asked. */
{
  const eyeLog = [];
  const savedEye = S.keyEyeOn, savedPages = S.pages;
  const withKey = (n, keySet) => {
    S.pages = Array.from({ length: n }, (_, i) => ({ num: i + 1 }));
    eyeLog.length = 0;
    S.keyEyeOn = async nums => { eyeLog.push(nums.slice()); return nums.filter(x => keySet.indexOf(x) >= 0); };
  };
  // A 12-page paper whose key is pages 5–12: the read saw 9–12, so the
  // walk starts at 8 and asks 8, 7, 6, 5, then 4 — which is not a key.
  withKey(12, [5, 6, 7, 8, 9, 10, 11, 12]);
  eq('the walk carries on down from the lowest key page the read found until a page is NOT a key',
     await S.keyWalkBack([9, 10, 11, 12]), [5, 6, 7, 8, 9, 10, 11, 12]);
  eq('…asking one page per call, in order, and stopping at the first that is not a key',
     eyeLog, [[8], [7], [6], [5], [4]]);
  // The read found nothing: the walk asks the last page itself first.
  withKey(6, [5, 6]);
  eq('with nothing known it starts at the last page', await S.keyWalkBack([]), [5, 6]);
  eq('…and stops at the first page that is not', eyeLog, [[6], [5], [4]]);
  // A blank back cover: the read saw the last four, called 8–9 the key and
  // 10 not, so the walk starts at 7 and never re-asks page 10.
  withKey(10, [6, 7, 8, 9]);
  eq('a page the read has already ruled out is not asked again', await S.keyWalkBack([8, 9]), [6, 7, 8, 9]);
  eq('…the walk starts just above the lowest known key page', eyeLog[0], [7]);
  // A page the text scan already called a key is stepped over, not asked.
  withKey(8, [4, 5, 6, 7, 8]);
  eq('a page the text scan already called a key is stepped over', await S.keyWalkBack([5, 7, 8]), [4, 5, 6, 7, 8]);
  ok('…and never asked about', !eyeLog.some(a => a[0] === 5 || a[0] === 7), JSON.stringify(eyeLog));
  // A paper that is ALL key walks to page 1 and hands the never-every-page
  // guard the whole lot to refuse.
  withKey(5, [1, 2, 3, 4, 5]);
  eq('a paper that is all key comes back whole for the guard in keyScanPdf to refuse', await S.keyWalkBack([5]), [1, 2, 3, 4, 5]);
  // The bound: a very long key stops asking at KEY_WALK_MAX.
  const many = Array.from({ length: 200 }, (_, i) => i + 1);
  withKey(200, many);
  await S.keyWalkBack([200]);
  ok('the walk never asks more than KEY_WALK_MAX pages', eyeLog.length === S.KEY_WALK_MAX, 'asked ' + eyeLog.length);
  eq('a paper with no pages walks nowhere', await (async () => { S.pages = []; return S.keyWalkBack([3]); })(), [3]);
  S.keyEyeOn = savedEye; S.pages = savedPages;
}
ok('the read is ONE call over small pictures, with a deadline',
   /system: PAPER_READ_SYS, maxOutputTokens: 500, temperature: 0, json: true, thinkingLevel: 'low',\n\s*images: imgs, timeoutMs: 45000/.test(SRC_KEY));
ok('the read swallows its own failure at upload', /try \{ read = await paperReadEnds\(\); \}\n\s*catch/.test(html));
ok('what the read changed is applied only to the worksheet still open', /if \(currentDocId === id\) \{\n\s*wsMeta\.level = got\.level;/.test(html));
ok('the upload dialog offers the blank the read fills — the level', /<option value="">✨ Let Chung GPT read it off the paper<\/option>/.test(html));
ok('…and the subject, only where there is more than one to choose from',
   /if \(subs\.length >= 2\) \{\n\s*var auto = document\.createElement\('option'\);\n\s*auto\.value = '';/.test(html));
ok('the prompt says to LEAVE OUT a page it is not sure of', /LEAVE IT OUT/.test(S.PAPER_READ_SYS));
ok('…and never to guess a level from how hard the questions look', /never guess a level/.test(S.PAPER_READ_SYS));
ok('…and that handwriting is not a key', /handwriting is the student/.test(S.PAPER_READ_SYS));

/* What actually reaches the model. The rows are TEXT, so they can travel in
   every batch — the difference between "the key is considered" and "the key
   is considered on the first page". */
S.wsKey = { pages: [], rows: [], path: '', name: '', scanned: false, reading: false };
eq('no key, nothing said to the model', S.keyContext(), '');
eq('…and no rule either', S.keyRuleBlock(), '');
S.wsKey.rows = [{ number: '7', answer: '24 g', working: '3 x 8 = 24' },
                { number: '8', answer: 'evaporation', working: '' }];
const ctx = S.keyContext();
ok('the key rows reach the prompt', /24 g/.test(ctx) && /evaporation/.test(ctx), ctx);
ok('…with the paper\'s own numbering', /(^|\n)7 — /.test(ctx), ctx);
ok('…and the working where the key printed any', /3 x 8 = 24/.test(ctx), ctx);

const rule = S.keyRuleBlock();
ok('the key is the authority on WHAT the answer is', /authority on WHAT the answer is/i.test(rule), rule);
ok('…and NOT on how it must be worded', /NOT the authority on how an answer must be WORDED/i.test(rule), rule);
/* THE ONE THAT MATTERS MOST. Handing the model the answers and then asking
   for a nudge is precisely the door the ladder exists to shut, so the
   ceiling is restated wherever the key is used. Without this line the key
   quietly turns "Nudges only" into full answers — which looks, from the
   outside, exactly like the buddy working unusually well. */
ok('…and it never lifts the help ceiling',
   /DOES NOT CHANGE WHAT YOU MAY SAY/.test(rule) && /still holds/.test(rule), rule);
ok('the marking standard still outranks the key\'s shorthand',
   /marking standard above/.test(rule), rule);

/* A page ticked as key is out of the student's worksheet — out of the
   viewer, out of the marking, and out of the mistake pictures. */
S.wsKey.pages = [3];
S.pages = [{ num: 1 }, { num: 2 }, { num: 3 }, { num: 4 }];
ok('a key page is a key page', S.pageIsKey(3));
eq('…and is not one of the student\'s pages',
   S.studentPages().map(p => p.num), [1, 2, 4]);
S.wsKey = { pages: [], rows: [], path: '', name: '', scanned: false, reading: false };
S.pages = [];

/* =====================================================================
   6c. 🎤 SPEAKING AN ANSWER
   ===================================================================== */
section('Speaking an answer');

S.wsMeta = { level: 'P5', subject: 'science', guidance: 'method' };
const hintPage = S.voiceHint('page');
ok('the transcriber is told it is a school answer being spoken',
   /answering|ANSWER/i.test(hintPage), hintPage);
/* IT WRITES DOWN, IT NEVER ANSWERS. A mic that quietly improved an answer
   on the way in would mark the student on words they never said. */
ok('…and told not to answer, correct or finish it',
   /do not answer the question/i.test(hintPage) && /do not correct them/i.test(hintPage), hintPage);
ok('units and terms are kept as the student said them',
   /units/i.test(hintPage), hintPage);
const hintChat = S.voiceHint('chat');
ok('asking the buddy is a different job from answering', hintChat !== hintPage, hintChat);
ok('…and that one is not answered either', /do not answer it/i.test(hintChat), hintChat);

/* The one thing this app knows and the model cannot. A 华文 answer
   transcribed as English phonetics comes back as nonsense. */
S.wsMeta.subject = 'chinese';
const hintZh = S.voiceHint('page');
ok('a 华文 worksheet is transcribed in Chinese characters',
   /Simplified Chinese/i.test(hintZh), hintZh);
ok('…never in pinyin and never translated',
   /never in pinyin/i.test(hintZh) && /never translated/i.test(hintZh), hintZh);
S.wsMeta.subject = 'science';


/* =====================================================================
   🧩 REPRODUCING THE QUESTION — the rebuild, and the three tiers
   ---------------------------------------------------------------------
   Every failure in here is SILENT and the mistake is still filed: the app
   quietly drops back a tier and hands the student a photocopy of a whole
   page instead of the question set out properly, with nothing on any
   screen to say so. And the failures in the other direction are worse —
   a rectangle nobody checked keeps somebody else's question and looks
   exactly like a working crop, a build with no wording in it is a
   question made of pictures asking nothing, and a picture-options
   question that loses its band is four choices nobody can see.
   ===================================================================== */
section('The rebuild — what may be cropped at all');

/* A FIGURE that fills the page is a selection that failed: nothing was
   picked out. A whole QUESTION that fills the page is perfectly ordinary —
   an open question with a big diagram and six ruled lines really is the
   whole sheet, and refusing it throws away exactly the questions worth
   trying again. */
ok('a sane figure box is accepted', S._mbBoxOk([100, 100, 500, 700]));
ok('a missing box is refused', !S._mbBoxOk(null) && !S._mbBoxOk(undefined));
ok('a box of the wrong length is refused', !S._mbBoxOk([1, 2, 3]));
ok('a box off the page is refused', !S._mbBoxOk([0, 0, 500, 1400]));
ok('a box with a word in it is refused', !S._mbBoxOk([0, 'x', 500, 700]));
ok('a minute box is refused', !S._mbBoxOk([500, 500, 510, 510]));
ok('a FIGURE box filling the page is refused', !S._mbBoxOk([2, 2, 998, 998]));
ok('…but the same box as a whole QUESTION is accepted', S._mbBoxOk([2, 2, 998, 998], true));

section('The rebuild — four picture options are ONE picture');

eq('one box comes straight back', S._mbUnionBox([[100, 100, 300, 300]]), [100, 100, 300, 300]);
eq('two boxes side by side union',
   S._mbUnionBox([[700, 100, 900, 400], [700, 420, 900, 700]]), [700, 100, 900, 700]);
ok('boxes in opposite corners are refused — that is a failed reading, not a row of options',
   S._mbUnionBox([[20, 20, 120, 120], [880, 880, 980, 980]]) === null);
ok('a union that is most of the page is refused',
   S._mbUnionBox([[10, 10, 480, 480], [520, 520, 990, 990]]) === null);
ok('a union built out of junk is refused', S._mbUnionBox([null, [1, 2, 3]]) === null);
ok('nothing in, nothing out', S._mbUnionBox([]) === null);

section('The rebuild — reading a reply back');

/* A build with NO WORDING is refused OUTRIGHT: the tiers under it are
   better than a question made of pictures with nothing asking anything,
   and finding that out on the printed page is far too late. */
eq('a reply with no wording at all is refused',
   S._mbCleanBlocks({ blocks: [{ type: 'image', page: 1, box_2d: [100, 100, 400, 400] }] }), []);
eq('an empty reply is refused', S._mbCleanBlocks({}), []);
eq('junk is refused', S._mbCleanBlocks(null), []);

const built = S._mbCleanBlocks({
  blocks: [
    { type: 'text', text: 'Look at the circuit below.' },
    { type: 'image', page: 1, box_2d: [200, 100, 500, 700] },
    { type: 'image', page: 1, box_2d: [0, 0, 5, 5] },          // minute — dropped
    { type: 'text', text: '  (a) Name the part labelled X. [2]  ' }
  ]
});
eq('the blocks come back in the order they were printed',
   built.map(b => b.type), ['text', 'image', 'text']);
eq('a figure keeps its own page and rectangle',
   [built[1].page, built[1].box], [1, [200, 100, 500, 700]]);
eq('the wording is trimmed but kept', built[2].text, '(a) Name the part labelled X. [2]');

/* `_mkStr` folds every newline away, which is right for a marking field
   and WRONG here: a text block listing labelled statements is one line
   each, and run together it stops being a list at all. */
ok('a statement list keeps its line breaks',
   S._mbText('A: it melts\nB: it boils', 900) === 'A: it melts\nB: it boils');
eq('…and a run of blank lines is one gap, not a hole in the question',
   S._mbText('one\n\n\n\ntwo', 900), 'one\n\ntwo');
eq('…and it is capped like every other stored field', S._mbText('abcdef', 3), 'abc');

/* The options are held back and merged, because "ONE rectangle round all
   of them" is a rule a model can be ASKED to follow and cannot be made to.
   And they go LAST whatever order they arrived in: that is where they are
   printed, and a block asking the question has to come before them. */
const withOpts = S._mbCleanBlocks({
  blocks: [
    { type: 'options', page: 1, box_2d: [700, 100, 900, 400] },
    { type: 'options', page: 1, box_2d: [700, 420, 900, 700] },
    { type: 'text', text: 'Which shape has one line of symmetry?' }
  ]
});
eq('the options land LAST, as one image block', withOpts.map(b => b.type), ['text', 'image']);
eq('…covering all of them', withOpts[1].box, [700, 100, 900, 700]);
eq('…and wearing the role that says not to print the words as well',
   withOpts[1].role, 'options');

/* An options block whose rectangles do not sit together is a failed
   reading; dropping it leaves an ordinary question rather than a crop of
   half the sheet filed as the choices. */
const scattered = S._mbCleanBlocks({
  blocks: [
    { type: 'text', text: 'Which one?' },
    { type: 'options', page: 1, box_2d: [20, 20, 120, 120] },
    { type: 'options', page: 1, box_2d: [880, 880, 980, 980] }
  ]
});
eq('a scattered options reading is dropped, not filed', scattered.map(b => b.type), ['text']);

/* The question box is asked for in the SAME call, and it is validated as a
   WHOLE box — a question that fills its page is ordinary. */
const build1 = S._mbCleanBuild({
  blocks: [{ type: 'text', text: 'Work it out.' }],
  questionBox: [5, 5, 995, 995], questionPage: 2
});
eq('a whole-question rectangle covering the page is kept', build1.qbox, [5, 5, 995, 995]);
eq('…on the page it says it is on', build1.qpage, 2);
ok('a malformed question rectangle is dropped rather than guessed at',
   S._mbCleanBuild({ blocks: [{ type: 'text', text: 'x' }], questionBox: [1, 2] }).qbox === null);
eq('a missing question page falls back to the first picture',
   S._mbCleanBuild({ blocks: [{ type: 'text', text: 'x' }] }).qpage, 1);

section('The rebuild — the ink threshold is MEASURED, not assumed');

/* THE ONE THING THAT COULD NOT BE PORTED AS IT STOOD. A PDF re-rendered
   here is white at 255 and a fixed "darker than 190" would do — but the
   PDF is very often a SCAN of a paper worksheet, where the paper is grey.
   A fixed line then reads the whole page as ink: the trimmer finds one
   band covering everything and does nothing at all, on every scanned
   paper, with nothing on screen to say it has stopped working. */
function hist(map) {
  const h = new Array(256).fill(0);
  let total = 0;
  Object.keys(map).forEach(v => { h[+v] = map[v]; total += map[v]; });
  return { hist: h, total };
}
const white = hist({ 252: 9800, 20: 200 });
const grey  = hist({ 186: 9800, 20: 200 });
const wThr = S._mbInkLevel(white.hist, white.total);
const gThr = S._mbInkLevel(grey.hist, grey.total);
ok('a white page reads its ink line off its own white', wThr > gThr,
   'white ' + wThr + ' vs grey ' + gThr);
ok('a grey scan gets a LOWER line, or the whole page reads as ink', gThr < 186,
   'the paper itself is 186 and the line came back ' + gThr);
ok('the line never rises above the paper', wThr <= S.MB_INK_CEIL && gThr <= S.MB_INK_CEIL);
ok('…and never falls to almost-black-only', wThr >= S.MB_INK_FLOOR && gThr >= S.MB_INK_FLOOR);
ok('nothing to measure falls back rather than throwing', S._mbInkLevel(null, 0) === S.MB_INK_CEIL);

section('The rebuild — the figure, and not the sentence above it');

/* Rows are the ink profile the pixel pass builds. Prose is one line tall,
   spans most of the width, is not solid, has NO long stroke in it and
   breaks into many short pieces — and a framed table is not trimmed at
   all, because every one of its rows reads as prose on its own. */
function rowsOf(spec, w) {
  return spec.map(k => {
    if (k === 'blank') return { n: 0, minX: -1, maxX: -1, runs: 0, maxRun: 0 };
    if (k === 'prose') return { n: w * 0.35, minX: 2, maxX: w - 3, runs: 30, maxRun: 4 };
    if (k === 'rule')  return { n: w * 0.02, minX: 0, maxX: w - 1, runs: 1, maxRun: w - 1 };
    return { n: w * 0.30, minX: 5, maxX: w - 6, runs: 2, maxRun: w * 0.5 };   // 'fig'
  });
}
const W = 400, PAGE = 1000;
const proseThenFig = rowsOf(
  [].concat(Array(9).fill('prose'), Array(14).fill('blank'), Array(160).fill('fig')), W);
const cut = S._mbTrimTextRows(proseThenFig, W, proseThenFig.length, PAGE);
ok('a line of prose above the figure is cut off', cut.top > 0,
   'top came back ' + cut.top + ' of ' + proseThenFig.length);
ok('…and the figure itself is kept', cut.bot >= proseThenFig.length - 2);

const table = rowsOf(
  [].concat(['rule'], Array(6).fill('prose'), ['rule'], Array(6).fill('prose'),
            ['rule'], Array(6).fill('prose'), ['rule'], Array(6).fill('prose')), W);
const tcut = S._mbTrimTextRows(table, W, table.length, PAGE);
eq('a framed table is not trimmed at all — every row of it reads as prose',
   [tcut.top, tcut.bot], [0, table.length - 1]);

const allFig = rowsOf(Array(120).fill('fig'), W);
const fcut = S._mbTrimTextRows(allFig, W, allFig.length, PAGE);
eq('a figure with no prose on it is left exactly as it was',
   [fcut.top, fcut.bot], [0, allFig.length - 1]);
eq('something too small to analyse is handed straight back',
   S._mbTrimTextRows(rowsOf(['fig'], 10), 10, 1, PAGE), { top: 0, bot: 0 });

section('The three tiers, and the ONE place the choice is made');

/* A question shown as blocks must NOT also show its picture — that is the
   same question asked twice, on the card and on the printed sheet alike.
   And a picture that is not on screen must not carry a ✂️ Crop button. */
const blocky = { blocks: [{ type: 'text', text: 'Q' }, { type: 'image', path: 'p/a.jpg' }],
                 imagePath: 'p/whole.jpg', shot: 'question', question: 'Q' };
eq('blocks beat every picture', S.mistakeTier(blocky), 'blocks');
eq('a whole-question crop beats the page',
   S.mistakeTier({ imagePath: 'p/q.jpg', shot: 'question' }), 'question');
eq('the whole page is the last picture tier',
   S.mistakeTier({ imagePath: 'p/w.jpg', shot: 'page' }), 'page');
eq('a mistake filed before any of this reads as the page it kept',
   S.mistakeTier({ imagePath: 'p/w.jpg' }), 'page');
eq('with no picture at all the wording does the asking',
   S.mistakeTier({ question: 'Q' }), 'text');

/* A block that would not draw is not a block. Validating on the way OUT as
   well as on the way in is what stops a half-written document rendering as
   an empty frame in the middle of a question. */
eq('a text block with no text is not a block',
   S.mistakeBlocks({ blocks: [{ type: 'text', text: '' }] }).length, 0);
eq('an image block with no path is not a block',
   S.mistakeBlocks({ blocks: [{ type: 'image', path: '' }] }).length, 0);
eq('…so a document full of them falls back a tier',
   S.mistakeTier({ blocks: [{ type: 'image', path: '' }], imagePath: 'p/w.jpg' }), 'page');
eq('blocks that are not an array are no blocks', S.mistakeBlocks({ blocks: 'x' }).length, 0);

section('The options travel with the question');

/* A multiple-choice question printed with nothing to choose between is a
   question nobody can answer — and the rebuild is TOLD to leave word
   options out of its blocks precisely because they are held here and
   printed under them. */
const mcq = { type: 'mcq', options: [{ label: '1', text: 'melts' }, { label: '2', text: 'boils' }] };
eq('an mcq offers its options', S.mistakeOptions(mcq).length, 2);
eq('an open question offers none', S.mistakeOptions({ type: 'open', options: mcq.options }).length, 0);
eq('a mistake filed before options were kept offers none', S.mistakeOptions({ type: 'mcq' }).length, 0);
eq('an empty option is not an option',
   S.mistakeOptions({ type: 'mcq', options: [{ label: '', text: '' }] }).length, 0);

/* WHEN A PICTURE ALREADY HOLDS THE CHOICES the words must not be printed
   as well: for a picture question they are four empty strings, and printed
   they read as four choices nobody filled in. */
const picOpts = { type: 'mcq', options: [{ label: '1', text: '' }, { label: '2', text: '' }],
                  blocks: [{ type: 'text', text: 'Which one?' },
                           { type: 'image', path: 'p/o.jpg', role: 'options' }] };
ok('a picture-options question says so', S.mistakeHasPictureOptions(picOpts));
eq('…and its word options are not printed underneath', S.mistakeOptions(picOpts).length, 0);
ok('an ordinary figure is not an options band',
   !S.mistakeHasPictureOptions({ blocks: [{ type: 'image', path: 'p/f.jpg' }] }));


section('The rebuild, against index.html itself');

/* THE PROMPT IS A TRANSCRIBER WITH A RULER. A reproducer that starts
   answering, correcting or rewording puts a question into the mistake book
   that is not the question the student got wrong — and it prints and
   practises perfectly. */
const RBSYS = between('var MB_BUILD_SYS =', "/* The pages this question is printed on", 'the rebuild prompt');
ok('it says it is NOT answering, marking or rewording',
   /NOT answering it, NOT marking it and NOT rewording it/.test(RBSYS));
ok('…and never writing an answer in', /NEVER write in an answer/.test(RBSYS));
ok('it asks for the whole-question rectangle in the SAME call',
   /"questionBox"/.test(RBSYS) && /"questionPage"/.test(RBSYS));
ok('every rectangle is the family\'s own 0–1000 convention',
   /\[ymin, xmin, ymax, xmax\], four whole numbers from 0 to 1000/.test(RBSYS));
ok('picture options are ONE rectangle round the lot, never one per option',
   /NEVER one rectangle per option/.test(RBSYS));
ok('a lettered part carries its shared stem', /INCLUDE THE SHARED STEM/.test(RBSYS));
ok('word options are left out, because they are held separately',
   /LEAVE OUT the multiple-choice options WHEN THEY ARE WORDS OR NUMBERS/.test(RBSYS));
ok('a figure it cannot place is omitted rather than guessed at',
   /wrong rectangle keeps somebody else\\'s picture/.test(RBSYS));

/* THE RATION IS PER RUN, and it is spent BEFORE the call so a failure
   cannot buy another try. Left unbounded, a paper where every question is
   wrong quietly spends a vision call on every one of them. */
const RBCALL = between('async function _mbBuildBlocks(it, context) {', 'async function _mbUpload', 'the rebuild call');
ok('the budget is spent BEFORE the call',
   RBCALL.indexOf('_mbBuildBudget--') >= 0 &&
   RBCALL.indexOf('_mbBuildBudget--') < RBCALL.indexOf('_mbBuildFrom(it, shots, context)'),
   'the ask itself is _mbBuildFrom, shared with the button that sets a filed mistake out again');
/* …and the SHARED ask never touches the ration. `_mbBuildBudget` governs the
   marking RUN, and a student asking for one question is not that run — but
   a ration decremented inside the shared ask would be spent by the button
   too, so a press in the book would quietly take a rebuild away from the
   next paper marked. */
const RBASK = between('async function _mbBuildFrom(it, shots, context) {', 'function mbStoredPage(', 'the shared rebuild ask');
ok('…and the shared ask spends none of it', !/_mbBuildBudget/.test(RBASK));
ok('…and it is the ONE ask: the marking run and the button share it',
   (html.match(/system: MB_BUILD_SYS,/g) || []).length === 1,
   'two asks is a question set out one way by the marking and another by the button');
ok('…and refused outright once it is gone', /if \(_mbBuildBudget <= 0\) return null;/.test(RBCALL));
ok('the budget is refilled in fileMistakes and NOWHERE else',
   (html.match(/_mbBuildBudget = MB_BUILD_MAX/g) || []).length === 2,
   'once as the declaration, once in fileMistakes');
ok('the rebuild reads a CLEAN page, never the canvas the student is writing on',
   /await rbCleanPage\(nums\[i\]\)/.test(RBCALL));

/* A PDF page is transparent where nothing is drawn, and a transparent
   canvas flattens to BLACK in a JPEG — the whole page, ink and all. The
   cover already learned this; so has every crop here. */
const RBPAGE = between('async function rbCleanPage(num) {', 'function rbJpeg(', 'the clean page');
ok('the clean page is painted white before the PDF is drawn on it',
   /ctx\.fillStyle = '#fff';\s*\n\s*ctx\.fillRect\(0, 0, c\.width, c\.height\);/.test(RBPAGE));
ok('…and it waits for the on-screen raster rather than racing it',
   /if \(p\.renderTask\) \{ try \{ await p\.renderTask\.promise; \}/.test(RBPAGE));
ok('at most two pages are held, or a twelve-page paper is the tab Safari discards',
   /while \(_rbPages\.length > RB_PAGE_CACHE\) _rbPages\.shift\(\);/.test(RBPAGE));

/* EVERY TIER IS CLEAN. The whole-page picture used to be `compositeJpeg` —
   the page as it was MARKED. Right for looking back at what you wrote,
   useless for doing the question again, and worse on a sheet handed to a
   class: last week's wrong answer is written across it. */
const SHOTFOR = between('async function mistakeShotFor(it) {', '/* ---- WHICH TIER THIS ONE IS', 'the page shot');
ok('the whole-page tier is the CLEAN page', /rbCleanPage\(it\.page\)/.test(SHOTFOR));
ok('…and never the composited one, which carries the student\'s own answer',
   !/compositeJpeg/.test(SHOTFOR));

/* THE DOCUMENT IS WRITTEN FIRST and every picture is an extra on it: a
   Storage bucket that is not there, or rules that refuse the write, must
   cost the picture and never the mistake. */
const FILING = between('async function fileMistakes() {', '/* ③ THE LAST TIER', 'filing a mistake');
ok('the document is added before anything is uploaded',
   FILING.indexOf('await coll.add(doc)') < FILING.indexOf('mbRebuild('));
ok('a rebuild that failed cannot cost the mistake',
   /try \{\s*\n\s*var built = await mbRebuild/.test(FILING));
ok('the whole page stands in when no question crop was made',
   /if \(!patch\.imagePath\) \{/.test(FILING));

/* A multiple-choice question printed with nothing to choose between is a
   question nobody can answer — and the rebuild is TOLD to leave word
   options out of its blocks precisely because they are held here. */
ok('the options are filed with the question', /options: \(it\.options \|\| \[\]\)\.slice\(0, 8\)/.test(FILING));
ok('…along with which of them was right', /option: _mkStr\(it\.option, 8\)/.test(FILING));
ok('…and whether it is an mcq at all', /type: it\.type === 'mcq' \? 'mcq' : 'open'/.test(FILING));

/* A block figure left behind on a delete is a file in the bucket nothing
   will ever point at again, and nothing anywhere would say so. */
const DEL = between('async function deleteMistake(id) {', '/* ================= Cropping a mistake', 'deleting a mistake');
ok('deleting takes every picture the mistake owns, not only the one on the card',
   /\[m\.imagePath\]\.concat\(mistakeBlocks\(m\)\.map/.test(DEL));

/* ONE RENDERER. The card, the practice session and the sheet all show the
   same question; a second copy of it is free to drift, and the drift is
   silent — the card shows the question set out properly and the sheet
   prints a photograph of the page. */
ok('the card builds its question through the one renderer',
   /questionNodes\(m, 'card', \{ noPic: true \}\)/.test(html));
ok('the practice session does too', /questionNodes\(m, 'prac'\)/.test(html));
ok('and so does the printed sheet', /questionNodes\(m, 'sheet'\)/.test(html));
ok('✂️ Crop is offered only where the picture is actually on screen',
   /if \(m\.imagePath && tier !== 'blocks'\)/.test(html));

/* 🕳 A BLANK THEY WENT PAST IS FILED TOO, and the FLAG is what says so:
   the document carries no verdict and no feedback to infer it from, so a
   card left to guess would read an unjudged ANSWER as a skip the day one is
   ever filed. */
ok('a blank the student went past is filed beside the wrong answers',
   /\} else if \(markSkipped\(marking\.items, i\)\) \{/.test(FILING),
   'the one blank that belongs in the book');
ok('…gathered in ONE walk, so the loop never decides it a second time',
   /var it = due\[i\]\.it;\n\s*var skipped = due\[i\]\.skipped;/.test(FILING));
ok('…and the document carries which it was', /\n      skipped: skipped,/.test(FILING));
ok('…and the toast names them rather than folding them in with the crosses',
   /you skipped past/.test(FILING),
   'a book that quietly grew is one nobody trusts');
/* A SKIPPED QUESTION MUST NOT WEAR THE RED OF A WRONG ANSWER. That is the
   cross the marking refuses to put on a blank, moved into the book — and a
   child reading it is told they got wrong a question they never tried. */
ok('the card colours a skipped question apart from a wrong one',
   /mistSkipped\(m\) \? ' mSkip' : m\.verdict === 'partial' \? ' mPartial' : ' mWrong'/.test(html));
ok('…and its chip says Skipped, not Not quite', /v\.className = 'verdict mSkip';/.test(html));
ok('…and ONE predicate decides it on every surface',
   (html.match(/function mistSkipped\(/g) || []).length === 1,
   'two readings is a card coloured one way and searched another');
ok('a skipped card says how it got into the book', /You went past this one/.test(html),
   'no answer of its own and no feedback: without a word it is a bare question among marked ones');
/* A blank below the top help level comes back with a place to START where
   its answer would be (`markBlankRule`) — and a skipped question meets that
   case far more often than a wrong one ever did. */
ok('…and its explanation is labelled for what it is',
   /boxNode\(m\.answer \? 'Why' : 'Where to start', m\.explanation, 'whyBox'\)/.test(html));
/* "A big improvement on last time" said to a child who left it blank is
   praise for something that never happened. */
ok('the practice marker is told a skipped question was never attempted',
   /else if \(mistSkipped\(m\)\) lines\.push\('They LEFT THIS QUESTION BLANK/.test(html));
ok('…and the prompt knows both cases', /Where it says they LEFT IT BLANK/.test(html));
ok('"skipped" finds them in the book', /skipped blank went past not attempted/.test(html),
   'a skipped card has no answer and no feedback, so it has least of its own to be found by');

/* Everything in this app's mistake book is stored as a PATH and resolved on
   demand, so a download URL stored here would be the one row the deleting
   and the caching could not see. */
ok('a block figure is stored as a path, never a download URL',
   /var path = MISTAKE_DIR \+ '\/' \+ currentUser\.uid \+ '\/' \+ name \+ ext;/.test(html));
/* …and the extension follows the PICTURE. A redrawn crop comes back as a
   PNG (line work re-encoded as JPEG rings along every edge), so a path
   that always said `.jpg` would name a PNG as a JPEG for ever. */
ok('…and it is named for what it really is',
   /var ext = \/\^data:image\\\/png\/i\.test\(String\(dataUrl\)\) \? '\.png' : '\.jpg';/.test(html));

/* =====================================================================
   🖼 THE PICTURE IS REDRAWN, THE WAY ⚡ RAPID ADD DOES IT
   ---------------------------------------------------------------------
   Every failure here is silent and the question is still filed — it is
   simply a grey crop of a photograph again, which is what a student was
   practising from before. The failures in the OTHER direction are worse:
   a clean-up that throws costs the question itself, and a prompt that
   stops forbidding invention puts a number into a maths question that
   the paper never printed.
   ===================================================================== */
section('The picture clean-up');

/* The 98th percentile, never the MAXIMUM: one blown-out specular pixel is
   255 on any glossy sheet, so the maximum sets the white point highest on
   exactly the pictures that need it lowest. */
function buf(spec) {                       // [[count, r, g, b, a?], …] -> RGBA
  const out = [];
  spec.forEach(([count, r, g, b, a]) => {
    for (let i = 0; i < count; i++) out.push(r, g, b, a === undefined ? 255 : a);
  });
  return new Uint8ClampedArray(out);
}
eq('the white point is the 98th percentile, not the brightest pixel',
   S._paperWhitePoint(buf([[1, 255, 255, 255], [999, 240, 240, 240]])).white, 240);

const px = buf([[100, 10, 10, 10], [900, 248, 248, 248]]);
const rep1 = S._paperCleanPixels(px);
ok('a near-white weave over line work is cleaned', rep1.ok && rep1.changed === 900, JSON.stringify(rep1));
eq('…the background is snapped to pure white', [px[400], px[401], px[402]], [255, 255, 255]);
/* THE ONE FAILURE THAT WOULD LOOK LIKE A BEAUTIFULLY CLEAN PICTURE. */
eq('…and the drawing is not touched', [px[0], px[1], px[2]], [10, 10, 10]);

/* Three refusals, and each is a picture this must not touch. A refusal is
   ALL-OR-NOTHING on purpose: half-cleaned is worse than left alone. */
const dark = S._paperCleanPixels(buf([[1000, 100, 100, 100]]));
eq('a picture with no white in it is refused — it is not paper', [dark.ok, dark.changed], [false, 0]);
const noInk = S._paperCleanPixels(buf([[1000, 250, 250, 250]]));
eq('…so is one with no line work to protect', [noInk.ok, noInk.reason], [false, 'no-ink']);
const notPaper = S._paperCleanPixels(buf([[250, 255, 255, 255], [750, 150, 150, 150]]));
eq('…and one whose background is a bright PATCH rather than a page',
   [notPaper.ok, notPaper.reason], [false, 'not-paper']);

/* A pale wash of real COLOUR is part of the drawing — the blue of water in
   a beaker — whatever its brightness. */
const wash = buf([[100, 10, 10, 10], [800, 248, 248, 248], [100, 255, 230, 230]]);
S._paperCleanPixels(wash);
eq('a pale wash of real colour is kept', [wash[3600], wash[3601], wash[3602]], [255, 230, 230]);
const hole = buf([[100, 10, 10, 10], [800, 248, 248, 248], [100, 250, 250, 250, 0]]);
S._paperCleanPixels(hole);
eq('…and a hole stays a hole', hole[3603], 0);

/* THE DOOR NEVER THROWS. The picture IS the question; the clean-up is a
   luxury on top of it, so a rebuild that died because an image model was
   busy, capped or simply not in this project would cost the student the
   question itself. */
const RAW = 'data:image/jpeg;base64,AAAA';
/* It must not THROW, so the harness must not die when it does — a crash
   reports nothing about which rule broke. */
async function enhanced(url, ctx) {
  try { return await S.mbEnhance(url, ctx); }
  catch (e) { return 'IT THREW: ' + ((e && e.message) || e); }
}
S._mbEnhanceBudget = 5;
S.window.imageAiReady = undefined;
S.window.askGeminiImage = undefined;
eq('no image model in the project hands the crop straight back',
   await enhanced(RAW, null), RAW);
S.window.imageAiReady = () => true;
S.window.askGeminiImage = async () => { throw new Error('busy'); };
eq('a model that refused hands the crop straight back', await enhanced(RAW, null), RAW);
S.window.askGeminiImage = async () => 'sorry, I cannot do that';
eq('…and so does a reply with no picture in it', await enhanced(RAW, null), RAW);
S.window.askGeminiImage = async () => 'data:image/png;base64,BBBB';
ok('a redrawn picture comes back', (await enhanced(RAW, null)).indexOf('BBBB') > -1);
/* Spent BEFORE the call, so a failure cannot buy another try — and an
   empty budget is the raw crop, never a wait. */
S._mbEnhanceBudget = 1;
await enhanced(RAW, null);
eq('the budget is spent whether or not the call worked', S._mbEnhanceBudget, 0);
eq('…and an empty budget is the crop, not a refusal', await enhanced(RAW, null), RAW);
S._mbEnhanceBudget = 5;
S.window.askGeminiImage = async () => 'data:image/png;base64,BBBB';
eq('a worksheet closed mid-call keeps the crop it already had',
   await enhanced(RAW, { epoch: -1, docId: 'gone', uid: 'x' }), RAW);

ok('the budget is spent before the call, never after',
   /_mbEnhanceBudget--;[\s\S]{0,200}askGeminiImage\(MB_ENHANCE_PROMPT/.test(html));
ok('…and refilled at BOTH doors that start a batch of rebuilds',
   (html.match(/_mbEnhanceBudget = MB_ENHANCE_MAX/g) || []).length === 2,
   'the marking run and 🧩 Set it out again');
/* ONE crop, cut and redrawn in ONE place: the day the marking run learned
   to redraw the picture and the button did not, the same card set out two
   ways would be two different pictures. */
ok('every figure is redrawn before it is stored', /crop = await mbEnhance\(crop, context\);/.test(html));
ok('…and the whole-question crop through the ONE shared cut',
   (html.match(/_mbQuestionCrop\(/g) || []).length === 3,
   'the declaration, the marking run and the button');
ok('…and the shared cut is what redraws it',
   /return enhance === false \? crop : await mbEnhance\(crop, context\);/.test(html));
/* ② is only ever SHOWN when the blocks did not come out, so redrawing it
   anyway is an image call the next question does not get — and on a paper
   where every question set out properly, it is the whole ration. */
ok('the whole-question crop is redrawn only when it will be SEEN',
   /out\.qcrop = await _mbQuestionCrop\(built, context, !out\.blocks\.length\);/.test(html) &&
   /_mbQuestionCrop\(built, null, !patch\.blocks\);/.test(html),
   'the marking run and the button both weigh it');
ok('…but it is still CUT either way, as the fallback behind the blocks',
   /var crop = _mbCropBox\(s\.canvas, built\.qbox, true\);/.test(html));
/* ③ THE WHOLE PAGE IS DELIBERATELY LEFT ALONE. A whole page handed to an
   image model is where invention is likeliest and least checkable, and it
   is the tier nobody chose. */
ok('the whole-page tier is not redrawn', !/mbEnhance/.test(SHOTFOR));

/* The prompt is the other half of the safety. An image model told only
   "clean this up" renders the scanning damage beautifully, or invents the
   axis value the scan destroyed — and a number added to a maths question
   on its way into the book is one the student then gets wrong twice. */
ok('the prompt says what is DAMAGE and what is the drawing', /TREAT ALL OF THAT AS DAMAGE/.test(html));
ok('…and forbids inventing anything', /BUT DO NOT INVENT ANYTHING/.test(html));
ok('…and never guessing at text the scan destroyed', /Never guess at text you cannot/.test(html));
ok('…and asks for black-and-white line work, not a render',
   /BLACK-AND-WHITE line diagram/.test(html) && /do NOT add shading/.test(html));
ok('…and forbids ANSWERING the question it is redrawing',
   /Do NOT answer it,/.test(html) && /tick anything or write on it/.test(html),
   'a question that comes back with its answer written on it is a question nobody can practise');

/* =====================================================================
   📕 THE TEACHER'S COPY OF THE BOOK
   ---------------------------------------------------------------------
   This is the one path in the app that carries a child's own words off
   their own device, so what it carries is pinned here by NAME: anything
   added to the row is added to what leaves, and the census below fails on
   a field nobody decided to send.
   ===================================================================== */
section('What the teacher can see');

const mrow = S.mistakeMirrorRow({
  question: 'Explain why the puddle dried up.', number: '7', docName: 'P5 Science SA2',
  level: 'P5', subject: 'science', topic: 'Water', lo: 'water-cycle', verdict: 'wrong',
  marks: '0/2', studentAnswer: 'it went away', answer: 'The water evaporated.',
  feedback: 'You have not said where the water went.', explanation: 'Evaporation is…',
  imagePath: 'tutor-mistakes/uid/abc.jpg', blocks: [{ type: 'image', path: 'x.jpg' }],
  cleared: false, createdAt: 1700000000000
});
eq('a row carries the question, what they put and the answer',
   [mrow.q, mrow.mine, mrow.ans], ['Explain why the puddle dried up.', 'it went away', 'The water evaporated.']);
/* THE CENSUS. A picture is a Storage path under the STUDENT's own uid that
   the admin cannot read without a Storage rule this app is not going to
   ask for — so sending one would put a grid of broken images in front of a
   teacher. Everything else here is a decision about a child's privacy. */
eq('…and nothing else at all', Object.keys(mrow).sort(),
   ['ans', 'at', 'doc', 'done', 'lo', 'lvl', 'mine', 'mk', 'n', 'q', 'sub', 'top', 'v']);
ok('no picture travels', !JSON.stringify(mrow).includes('tutor-mistakes') && !JSON.stringify(mrow).includes('x.jpg'));
eq('every field is clipped', S.mistakeMirrorRow({ question: 'x'.repeat(900), studentAnswer: 'y'.repeat(900) }).q.length,
   S.MIST_MIRROR_Q);
/* 🕳 A skipped blank must not arrive with an empty verdict the panel
   would have to read as "wrong": they are different lessons. */
eq('a skipped blank says so', S.mistakeMirrorRow({ question: 'Q', skipped: true, verdict: '' }).v, 'skipped');
eq('a row with neither a question nor a number is not a row',
   S.mistakeMirrorRow({ studentAnswer: 'something' }), null);
eq('nothing at all is not a crash', S.mistakeMirrorRow(null), null);

eq('a profile from before this existed reads as nothing, never as an error',
   [S.mistakesOf(null), S.mistakesOf({}), S.mistakesOf({ tutorMistakes: 'junk' })], [[], [], []]);
eq('…and a junk entry inside a real list is dropped',
   S.mistakesOf({ tutorMistakes: [{ q: 'a' }, null, 'x', 7] }).length, 1);

/* The question a teacher opens this to ask is what the class gets wrong
   MOST — so biggest first, and an unlabelled question under its own
   heading and never folded into somebody else's topic. */
const mgroups = S.mistMirrorGroups([
  { top: 'Heat', _who: 'Amy' }, { top: 'Heat', _who: 'Ben' }, { top: 'heat', _who: 'Amy' },
  { top: '', _who: 'Amy' }, { top: '', _who: 'Ben' }, { top: '', _who: 'Cal' }, { top: '', _who: 'Dee' },
  { top: 'Forces', _who: 'Cal' }
]);
eq('topics come biggest first', mgroups.map(g => g.label), ['Heat', 'Forces', 'Not labelled']);
eq('…however big it is, Not labelled is always last', mgroups[mgroups.length - 1].rows.length, 4);
eq('…a topic spelled two ways is one topic', mgroups[0].rows.length, 3);
eq('…and it counts the students, not the questions', mgroups[0].students, 2);

/* IT IS THE TEACHER'S AND NOBODY ELSE'S, and the write is a MERGE on the
   centre's shared roster document — a plain set would take the level, the
   subject and the onboarding answers off it. */
const MIRROR = between('function mistakeMirrorSync() {', 'function mistakesOf(p) {', 'the mirror write');
ok('the teacher\u2019s own papers are never mirrored', /isAdmin\(currentUser\)/.test(MIRROR));
ok('…and the write is a merge onto the roster document',
   /peopleRef\(currentUser\.uid\)\.set\(\{[\s\S]*\}, \{ merge: true \}\)/.test(MIRROR));
ok('…and a refused write never interrupts the student',
   /write\.catch\(function \(e\) \{ console\.warn\('mistake mirror/.test(MIRROR));
ok('the class-wide panel refuses anyone but the admin IN THE HANDLER',
   /function openClassMistakes\(\) \{\n  if \(!isAdmin\(currentUser\)\) return;/.test(html),
   'hiding the button has never been the lock in this app');
/* The mirror is a copy of the book AS IT NOW STANDS, so it is written
   after the reload — written before, a paper's worth of mistakes is
   invisible to the teacher until the next paper is marked. */
ok('the mirror is written after the book is reloaded',
   /await loadMistakes\(true\);[\s\S]{0,500}mistakeMirrorSync\(\);/.test(FILING));
ok('…and again whenever the book CHANGES',
   (html.match(/mistakeMirrorSync\(\);/g) || []).length === 3,
   'filed, sorted and removed — or the teacher reads a book that no longer exists');
ok('a student with a book and no counters still shows it',
   /if \(!u\.any && !r\.mistakes\.length\) \{/.test(html));
ok('the panel paints a child\u2019s words as TEXT, never as markup',
   /l\.appendChild\(document\.createTextNode\(bit\[1\]\)\);/.test(html));

/* =====================================================================
   🧩 THE KEYWORD CHECK — the syllabus it reads, the cleaner and the hook
   ===================================================================== */
section('The science syllabus');

const kqLos = [].concat(...S.SYLLABUS_TOPICS.map(t => t.los));
eq('79 objectives across 18 topics', [S.SYLLABUS_TOPICS.length, kqLos.length], [18, 79]);
ok('every objective has an id, a title, an objective and keywords',
   kqLos.every(lo => lo.id && lo.title && lo.obj && Array.isArray(lo.kw) && lo.kw.length));
ok('the ids are unique', new Set(kqLos.map(lo => lo.id)).size === kqLos.length);
ok('every topic is on the P3–P6 ladder', S.SYLLABUS_TOPICS.every(t => /^P[3-6]$/.test(t.level)));
ok('no objective carries questions — this is the syllabus and nothing else', kqLos.every(lo => !('questions' in lo)));

const kqEvap = S.sylObjectivesFor('Explain why the puddle dried up. The water changed into water vapour by evaporation.', 'science', 'P5');
ok('a water-cycle question finds the water objectives first',
   kqEvap.length >= 2 && /^wat-/.test(kqEvap[0].id), JSON.stringify(kqEvap.map(m => m.id)));
ok('…scored by the keywords the text really uses, a two-word phrase counting double',
   kqEvap[0].score >= 3 && kqEvap[0].hits.indexOf('water vapour') >= 0, JSON.stringify(kqEvap[0]));
eq('a maths worksheet matches nothing — this is the SCIENCE syllabus',
   S.sylObjectivesFor('The water tank holds 24 litres of water. Find the total cost of 3 tanks at $2 each', 'math', 'P5'), []);
eq('a question about nothing on the syllabus matches nothing, even with no subject set',
   S.sylObjectivesFor('Find the total cost of 3 pens at 2 dollars each', '', 'P5'), []);
eq('nothing to read is nothing matched', S.sylObjectivesFor('', 'science', 'P5'), []);
const kqP6 = S.SYLLABUS_TOPICS.filter(t => t.level === 'P6')[0];
const kqP6Text = kqP6.los[0].kw.join(' ') + ' ' + kqP6.los[0].kw.join(' ');
ok('a P6 objective is found for its own keywords',
   S.sylObjectivesFor(kqP6Text, 'science', 'P6').some(m => m.id === kqP6.los[0].id));
ok('a P4 worksheet is never told it tests a P5 or P6 objective',
   S.sylObjectivesFor(kqP6Text, 'science', 'P4').every(m => m.level === 'P3' || m.level === 'P4'));
ok('…and a worksheet outside the ladder is not narrowed by it',
   S.sylObjectivesFor(kqP6Text, 'science', 'S1').some(m => m.id === kqP6.los[0].id));
ok('a P6 child is still reminded of P3 science — that is what a P6 question builds on',
   S.sylObjectivesFor('Living things grow, respond and reproduce; they need food, water and air to survive', 'science', 'P6').some(m => m.level === 'P3'));
ok('at most three objectives travel',
   S.sylObjectivesFor(kqLos.slice(0, 12).map(lo => lo.kw.join(' ')).join(' '), 'science', '').length <= 3);
eq('plurals fold onto their singular', S.sylNorm('Living things and their properties'), 'living thing and their property');
const kqBlock = S.sylPromptBlock(kqEvap);
ok('the prompt kqBlock names the objective, its level and its keywords',
   /THE SYLLABUS \(MOE Primary Science Syllabus 2023/.test(kqBlock) && /\(P5\)/.test(kqBlock) && /Keywords:/.test(kqBlock));
ok('…and says the teacher\'s notes win', /the notes win/.test(kqBlock));
eq('no matches, no kqBlock', S.sylPromptBlock([]), '');

section('🧩 The keyword check — what a quiz may hold');

S.wsMeta = { level: 'P5', subject: 'science', guidance: 'concepts' };
S.wsKey = { rows: [] };
eq('allowed exactly when the concepts rung is',
   ['nudge', 'concepts', 'method', 'answer'].map(g => { S.wsMeta.guidance = g; return S.kwQuizAllowed(); }),
   [false, true, true, true]);
S.wsMeta.guidance = 'nudge';
ok('the locked note names the level', /Nudges only/.test(S.kwQuizLockedNote()));
S.wsMeta.guidance = 'concepts';
const kqGood = {
  concept: 'Water changes state when it gains or loses heat.',
  sentence: 'Water turns into [1] by [2].',
  blanks: [{ n: 1, answer: 'water vapour', alt: ['vapour'], clue: 'water as a gas' }, { n: 2, answer: 'evaporation', clue: 'the process' }],
  praise: 'Well done!'
};
const kqQ1 = S.kwQuizClean(kqGood, {});
ok('a well-formed reply is kept whole', kqQ1 && kqQ1.blanks.length === 2 && kqQ1.sentence === 'Water turns into [1] by [2].', JSON.stringify(kqQ1));
eq('…with its concept, its praise and its clues', [kqQ1.concept, kqQ1.praise, kqQ1.blanks[0].clue, kqQ1.blanks[0].alt], ['Water changes state when it gains or loses heat.', 'Well done!', 'water as a gas', ['vapour']]);
eq('…not yet done', kqQ1.done, false);
S.wsMeta.guidance = 'nudge';
eq('the same reply is refused when the rung it sits on is locked', S.kwQuizClean(kqGood, {}), null);
S.wsMeta.guidance = 'concepts';
eq('a hole with no blank refuses the quiz — the box cannot check a word it was not kqGiven',
   S.kwQuizClean({ sentence: 'Water turns into [1] by [2].', blanks: [{ n: 1, answer: 'water vapour' }] }, {}), null);
eq('a blank with no hole is simply dropped',
   S.kwQuizClean({ sentence: 'Water turns into [1].', blanks: [{ n: 1, answer: 'water vapour' }, { n: 2, answer: 'evaporation' }] }, {}).blanks.length, 1);
eq('a sentence with no holes is no quiz', S.kwQuizClean({ sentence: 'Water evaporates.', blanks: [] }, {}), null);
eq('a reply that is not an object is no quiz', [S.kwQuizClean(null, {}), S.kwQuizClean('x', {}), S.kwQuizClean([], {})], [null, null, null]);
const kqMany = S.kwQuizClean({ sentence: '[1] [2] [3] [4] [5] [6]', blanks: [1, 2, 3, 4, 5, 6].map(n => ({ n, answer: 'w' + n })) }, {});
eq('more than four blanks is a test, not a reminder: the later holes are filled in as kqGiven',
   [kqMany.blanks.length, kqMany.sentence], [4, '[1] [2] [3] [4] w5 w6']);
const kqGiven = S.kwQuizClean({ sentence: 'Photosynthesis makes food: plants use [1] for photosynthesis and give out [2].',
                              blanks: [{ n: 1, answer: 'photosynthesis' }, { n: 2, answer: 'oxygen' }] }, {});
eq('an answer word printed beside its own hole is filled in and dropped from the check',
   [kqGiven.blanks.length, kqGiven.blanks[0].answer, kqGiven.blanks[0].n, kqGiven.sentence],
   [1, 'oxygen', 1, 'Photosynthesis makes food: plants use photosynthesis for photosynthesis and give out [1].']);
const kqRenum = S.kwQuizClean({ sentence: 'First [3], then [7].', blanks: [{ n: 7, answer: 'b' }, { n: 3, answer: 'a' }] }, {});
eq('holes are renumbered 1..k in order of appearance, and the blanks follow',
   [kqRenum.sentence, kqRenum.blanks.map(b => b.answer), kqRenum.blanks.map(b => b.n)], ['First [1], then [2].', ['a', 'b'], [1, 2]]);
eq('a five-word "keyword" is not a keyword',
   S.kwQuizClean({ sentence: 'It is [1].', blanks: [{ n: 1, answer: 'because the water gets hotter' }] }, {}), null);
eq('a hole used twice is one blank', S.kwQuizClean({ sentence: '[1] and [1] again', blanks: [{ n: 1, answer: 'heat' }] }, {}).blanks.length, 1);

/* THE KEY NEVER LIFTS THE CEILING. A blank whose word IS the paper's answer
   is the answer with a box round it, so the whole quiz is refused below full
   help — filling that hole in would state the answer, and leaving it empty
   would be a hole the student cannot fill. */
S.wsKey = { rows: [{ number: '7', answer: 'Evaporation.', working: '' }, { number: '8', answer: '24 g', working: '' }] };
eq('a blank that IS the paper\'s answer refuses the whole quiz below full help',
   S.kwQuizClean({ sentence: 'The puddle dried up because of [1].', blanks: [{ n: 1, answer: 'evaporation' }] }, { number: '7' }), null);
eq('…through an accepted form of it too',
   S.kwQuizClean({ sentence: 'The puddle dried up because of [1].', blanks: [{ n: 1, answer: 'evaporating', alt: ['evaporation'] }] }, { number: '7' }), null);
eq('…and against every row on the paper when the number is not known',
   S.kwQuizClean({ sentence: 'The mass is [1].', blanks: [{ n: 1, answer: '24 g' }] }, {}), null);
ok('a blank that is a keyword and not the answer is kept',
   !!S.kwQuizClean({ sentence: 'The puddle dried up because the water gained [1].', blanks: [{ n: 1, answer: 'heat' }] }, { number: '7' }));
ok('another question\'s answer is not this question\'s',
   !!S.kwQuizClean({ sentence: 'The mass is measured in [1].', blanks: [{ n: 1, answer: '24 g' }] }, { number: '7' }));
S.wsMeta.guidance = 'answer';
ok('at full help the key guard stands down — the answer is allowed there anyway',
   !!S.kwQuizClean({ sentence: 'The puddle dried up because of [1].', blanks: [{ n: 1, answer: 'evaporation' }] }, { number: '7' }));
S.wsMeta.guidance = 'concepts';
S.wsKey = { rows: [] };

section('🧩 The keyword check — marking a blank');
const kqWv = { n: 1, answer: 'water vapour', alt: ['vapour'] };
eq('exact, case, spacing and punctuation are forgiven',
   ['water vapour', 'WATER  VAPOUR.', 'Water-Vapour', 'vapour'].map(t => S.kwQuizMatch(kqWv, t)), [true, true, true, true]);
eq('a plural or a tense ending is the same keyword',
   [S.kwQuizMatch(kqWv, 'water vapours'), S.kwQuizMatch({ n: 1, answer: 'condense' }, 'condenses'),
    S.kwQuizMatch({ n: 1, answer: 'evaporate' }, 'evaporated'), S.kwQuizMatch({ n: 1, answer: 'gases' }, 'gas')],
   [true, true, true, true]);
eq('…but a different word, or a different form the model did not list, is not',
   [S.kwQuizMatch(kqWv, 'condensation'), S.kwQuizMatch({ n: 1, answer: 'evaporation' }, 'evaporating'), S.kwQuizMatch(kqWv, ''), S.kwQuizMatch(kqWv, '   ')],
   [false, false, false, false]);
ok('the ceiling is restated where the blanks are decided, below full help',
   /CONCEPT & KEYWORDS/.test(S.kwQuizCeilingRule()) && /never the answer/.test(S.kwQuizCeilingRule()));
S.wsMeta.guidance = 'answer';
eq('…and falls away at full help', S.kwQuizCeilingRule(), '');
S.wsMeta.guidance = 'concepts';

section('🧩 The keyword check on a hint');
/* The real `toast` was evaluated with the helpers and paints a node this
   sandbox does not have; a refused build says so through it. */
S.toast = noop;
let kqCall = null;
S.window.askGemini = async (prompt, opts) => { kqCall = { prompt, opts }; return JSON.stringify(kqGood); };
S.hints = [{ id: 'h1', page: 1, x: 1, y: 1, number: '7',
             question: 'Explain why the puddle dried up after the water vapour formed by evaporation.',
             rungs: [{ key: 'nudge', text: 'Look at the sun.', keywords: [] },
                     { key: 'concepts', text: 'Water cycle.', keywords: ['evaporation', 'water vapour'] }],
             shown: 1, working: false }];
S.wsEpoch = 0;
const kqBuilt = await S.kwQuizForHint('h1', {});
ok('the quiz is kqBuilt off the hint\'s question and the keywords the ladder found',
   !!kqBuilt && /puddle dried up/.test(kqCall.prompt) && /evaporation, water vapour/.test(kqCall.prompt), kqCall && kqCall.prompt);
ok('…and only the rungs the student has been SHOWN go along as context',
   /Look at the sun/.test(kqCall.prompt) && !/Water cycle\./.test(kqCall.prompt));
ok('the call is grounded as a HINT, then the key, then the syllabus, then the ceiling — in that order',
   (() => {
     const sys = kqCall.opts.system;
     const at = ['fill-in-the-blank reminder', 'THE SYLLABUS (MOE', 'STOPS AT "CONCEPT & KEYWORDS"'].map(m => sys.indexOf(m));
     return at.every(x => x >= 0) && at[0] < at[1] && at[1] < at[2];
   })(), kqCall && kqCall.opts.system.slice(0, 160));
ok('it is text only and cheap', !kqCall.opts.images && kqCall.opts.json === true && kqCall.opts.thinkingLevel === 'low');
ok('the quiz is remembered ON the hint, so it is saved with the worksheet',
   S.hints[0].quiz && S.hints[0].quiz.sentence === kqGood.sentence && S.hints[0].quiz.done === false);
ok('…with the syllabus objectives it drew on, by name only',
   Array.isArray(S.hints[0].quiz.syllabus) && S.hints[0].quiz.syllabus.length > 0 &&
   S.hints[0].quiz.syllabus.every(m => m.id && m.title && m.level && !m.obj));
kqCall = null;
await S.kwQuizForHint('h1', {});
eq('a second press reopens the same quiz — no second call', kqCall, null);
S.wsMeta.guidance = 'nudge';
S.hints.push({ id: 'h2', page: 1, x: 1, y: 1, question: 'q', number: '', rungs: [{ key: 'nudge', text: 't', keywords: [] }], shown: 1, working: false });
eq('a locked level builds nothing at all', await S.kwQuizForHint('h2', {}), null);
eq('…and the model was never asked', kqCall, null);
S.wsMeta.guidance = 'concepts';
S.window.askGemini = async () => { S.wsEpoch = 99; return JSON.stringify(kqGood); };
eq('a quiz that comes back after another worksheet was opened is dropped', await S.kwQuizForHint('h2', {}), null);
ok('…and never attached', !S.hints[1].quiz);
S.wsEpoch = 0;
S.window.askGemini = async () => { S.hints = S.hints.filter(x => x.id !== 'h2'); return JSON.stringify(kqGood); };
eq('a hint removed while its quiz was being kqBuilt gets nothing attached', await S.kwQuizForHint('h2', {}), null);
S.window.askGemini = async () => JSON.stringify({ question: '', rungs: [] });
S.hints = [];

/* =====================================================================
   7. Against the FILE itself — the things no unit test can see
   ===================================================================== */
section('Against index.html itself');

/* THE ONE DOOR. `askGemini` is transport: its system prompt has to arrive
   already grounded from the feature that called it. A call site that
   forgets is a feature that quietly stops speaking in the teacher's voice,
   and no other check in this file can see it. */
/* …and the two calls that are ungrounded ON PURPOSE, each with its reason
   written down. This is the same shape as the Science portal's census: an
   exemption is a named system prompt and a sentence, so a NEW call site
   that forgets its grounding cannot hide behind somebody else's exemption.
   A stale one fails too — that is how a renamed prompt slips back through. */
const UNGROUNDED_BY_DESIGN = {
  KEY_READ_SYS: 'transcribes the paper\'s own answer key. A transcriber told what the answer ought to say ' +
                'writes that down instead of what is printed, and a key rewritten on the way in is a whole ' +
                'class marked against something the paper never said.',
  KEY_EYE_SYS:  'asks which PAGES are the answer key. It returns page numbers, not science said to anybody.',
  PAPER_READ_SYS: 'reads what a paper IS — its subject, its level, its name and which of its pages are its ' +
                  'answer key — off its first and last pages. Metadata about the paper, not science said to ' +
                  'anybody; grounded, it would file every paper under whatever the notes happen to be about.',
  MB_BUILD_SYS: 'REPRODUCES a printed question so it can be tried again. It is a transcriber with a ruler: it ' +
                'sets out what is on the page and draws rectangles round the figures. A reproducer told how ' +
                'this teacher words an answer rewords the QUESTION, and a question quietly improved on the way ' +
                'into the mistake book is not the question the student got wrong.'
};
const callSites = [...html.matchAll(/window\.askGemini\(/g)].map(m => m.index);
ok('there are askGemini call sites to check at all', callSites.length >= 3,
   'found ' + callSites.length);
const exemptSeen = {};
callSites.forEach((idx, i) => {
  const chunk = html.slice(idx, idx + 900);
  // The bridge's own definition is not a call site.
  if (/window\.askGemini\s*=/.test(html.slice(Math.max(0, idx - 40), idx + 40))) return;
  const exempt = Object.keys(UNGROUNDED_BY_DESIGN)
    .find(sys => new RegExp('system:\\s*' + sys + '\\b').test(chunk));
  if (exempt) { exemptSeen[exempt] = 1; return; }
  ok('askGemini call site ' + (i + 1) + ' passes aiGrounding(', /aiGrounding\(/.test(chunk),
     chunk.slice(0, 220).replace(/\s+/g, ' '));
});
Object.keys(UNGROUNDED_BY_DESIGN).forEach(sys => {
  ok('the exemption for ' + sys + ' is still used by a real call site', !!exemptSeen[sys],
     'nothing calls askGemini with system: ' + sys + ' any more — take the exemption out');
});

/* 🧩 The keyword check, against the file: the one builder's prompt, the
   moment the live quiz is built, and the doors that close the box. */
const kqSrc = between('/* ================= THE KEYWORD QUIZ =================', '/* ================= End the keyword quiz', 'the keyword quiz');
ok('the keyword check is grounded as a hint, with the key, the syllabus and the ceiling beside it',
   /system: KWQ_SYS \+ aiGrounding\('hint'\) \+ keyRuleBlock\(source\.question\) \+ sylPromptBlock\(matches\) \+ kwQuizCeilingRule\(\)/.test(kqSrc));
/* The reply is STREAMED now, so "on its way" means both doors it can leave
   by: the flush that sends whatever is left of a part-spoken answer, and the
   fallback line for a reply that was all filler. The quiz must follow both. */
const kqQuiz = html.indexOf('kwQuizForLive(generation, spokenQuestion, spoken)');
ok('the live quiz is built AFTER the spoken reply is on its way, never before it',
   kqQuiz > html.indexOf('var sent = liveFlush(true);') &&
   kqQuiz > html.indexOf("content: 'I could not read that clearly."),
   'a box that delayed the tutor\'s answer would be a box that made the tutor slow');
ok('the hint hook builds the quiz in the background, off the hint that just landed', /kwQuizAfterHint\(h, epoch\);/.test(html));
ok('a new worksheet closes the box', /wsEpoch\+\+;\n\s*kwQuizClose\(\);/.test(html));
ok('leaving the worksheet closes BOTH floating boxes — and takes the tutor\'s marks with them',
   /if \(v !== 'ws'\) \{ stopLiveTutor\(\); liveTutor\.transcript = \[\]; kwQuizClose\(\); mthClose\(\); tutorMarksClear\(\); \}/.test(html),
   'a quiz — or a working line, or a gesture — about a worksheet nobody has open is drawn over the wrong page');
ok('Escape closes the box', /if \(e\.key === 'Escape'\) \{\n\s*kwQuizClose\(\);/.test(html));
ok('the box paints model output as TEXT, never as markup', !/\.innerHTML\s*=/.test(kqSrc) && /textContent = q\.concept/.test(kqSrc));
ok('the box is a floating card with no backdrop, and it never prints',
   /#kwQuiz \{\s*\n\s*position: fixed;/.test(html) && /@media print \{ #kwQuiz \{ display: none !important; \} \}/.test(html));
ok('a busy hint is tracked OFF the hint object, which is saved into the body', /var kwQuizBusyHints = \{\};/.test(kqSrc) && !/h\.quizBusy/.test(html));

section('✏️ The maths pad — what the source has to keep saying');

const mthSrc = between(BAR + '\n   ✏️ THE MATHS PAD', '/* ================= End the maths pad', 'the maths pad');

/* THE ONE PREDICATE. A second `subject === 'math'` test anywhere is a second
   place for the two helpers to disagree about which worksheet this is — and
   the failure is a student offered both boxes, or neither. */
const mathTests = html.match(/subject === 'math'/g) || [];
ok('“is this maths” is decided in exactly ONE place',
   mathTests.length === 1 && /function mathWorksheet\(\) \{ return wsMeta\.subject === 'math'; \}/.test(html),
   'found ' + mathTests.length + ' subject tests');
ok('…and every door asks THAT function',
   /if \(mathWorksheet\(\)\) return 'maths';/.test(html) &&      // the keyword check standing down
   /function mthAllowed\(\) \{ return mathWorksheet\(\); \}/.test(mthSrc) &&
   /qline\.className = mathWorksheet\(\) \? 'hintMathLine'/.test(html) &&   // the hints line
   /var mathsHere = mathWorksheet\(\);/.test(html) &&                        // the live card's switch
   /if \(mathWorksheet\(\)\) toggleMthPref\(\); else toggleKwQuizPref\(\);/.test(html));

/* THE WIRING. Both hooks are one line each and neither is reachable from
   the harness that runs the pad, so a hook quietly deleted is a feature
   that simply never appears — with nothing anywhere to say so. */
ok('the hint hook raises the working line off the hint that just landed', /mthAfterHint\(h, epoch\);/.test(html),
   'a hint on a maths worksheet with no working line under it is the keyword check removed and nothing put in its place');
const mthLive = html.indexOf('mthAfterLive(generation, spokenQuestion, spoken)');
ok('the live hook raises it AFTER the spoken reply is on its way, never before it',
   mthLive > html.indexOf('var sent = liveFlush(true);') &&
   mthLive > html.indexOf("content: 'I could not read that clearly."),
   'a box that delayed the tutor\'s answer would be a box that made the tutor slow');

/* THE CEILING, in all three places it has to hold. */
ok('a drawn model sits on the "How to do it" rung and nowhere else',
   /var MTH_MODEL_RUNG = 'method';/.test(mthSrc) &&
   /rungsAllowed\(wsMeta\.guidance\)\.some\(function \(r\) \{ return r\.key === MTH_MODEL_RUNG; \}\)/.test(mthSrc));
ok('…and the refusal is in the HANDLER, not only on the button',
   /if \(!mthModelAllowed\(\)\) \{ toast\(mthModelLockedNote\(\), 7000\); return null; \}/.test(mthSrc),
   'a hidden button is never the lock');
ok('the model prompt carries the ceiling into the DRAWING',
   /mthModelCeilingRule\(\)/.test(mthSrc) && /Every segment the question asks for must read "\?"/.test(mthSrc));
ok('the step check is grounded as a hint, with the key, the method rule and the ceiling beside it',
   /system: MTH_WORK_SYS \+ aiGrounding\('hint', \{ q: mthPad\.question \|\| text \}\) \+\s*\n\s*keyRuleBlock\(mthPad\.question\) \+ tutorMethodRule\(\) \+ buddyCeilingRule\(\)/.test(mthSrc),
   'the marking standards are for a mark; this is the next step');
/* The working line is gated on the SUBJECT and on nothing else. Every door
   into it asks `mthAllowed()`, which is `mathWorksheet()` — so no rung of
   the ladder can take away the one tool a maths student has. */
const mthWorkDoors = ['mthShow', 'mthAfterHint', 'mthAfterLive'].map(name => {
  const at = mthSrc.indexOf('function ' + name + '(');
  return at === -1 ? '' : mthSrc.slice(at, mthSrc.indexOf('\n}', at));
});
ok('the working line is offered at EVERY help level',
   mthWorkDoors.every(body => body && /mthAllowed\(\)/.test(body) && !/rungsAllowed|mthModelAllowed|mthAnswerAllowed/.test(body)),
   'asking a student to attempt the next step tells them nothing at all, so no rung may forbid it');

/* THE BOX. Same rules as the keyword check it stands in for. */
ok('the pad paints model output as TEXT, never as markup',
   !/\.innerHTML\s*=/.test(mthSrc) && /ask\.textContent = mthPad\.ask;/.test(mthSrc));
ok('it is a floating card with no backdrop, and it never prints',
   /#mthPad \{\s*\n\s*position: fixed;/.test(html) && /@media print \{ #mthPad \{ display: none !important; \} \}/.test(html));
ok('a new worksheet closes it, and so does Escape',
   /wsEpoch\+\+;\n\s*kwQuizClose\(\);[^\n]*\n\s*mthClose\(\);/.test(html) &&
   /if \(e\.key === 'Escape'\) \{\n\s*kwQuizClose\(\);\n\s*mthClose\(\);/.test(html));
ok('a busy hint is tracked OFF the hint object, which is saved into the body',
   /var mthBusyHints = \{\};/.test(mthSrc) && !/h\.modelBusy/.test(html));
ok('the subtitle bar is lifted clear of WHICHEVER box is open',
   /function floatBoxLayout\(\)/.test(html) && /kwQuiz\.open && kq[\s\S]{0,120}mthPad\.open && mp/.test(html) &&
   !/kwQuizLayout/.test(html),
   'a maths student reading their subtitles under their own working line is the layout knowing about one box');

/* A PLACED MODEL IS ORDINARY INK. A new annotation type has to be taught to
   both renderers, the bounds, the hit test, the eraser, the resize handles
   and the print path, and the one that gets missed is silent. */
const mthTypes = (mthSrc.match(/type: '([a-z]+)'/g) || []).map(t => t.slice(7, -1));
ok('a placed model is built from types both renderers already know',
   mthTypes.length > 0 && mthTypes.every(t => ['rect', 'text', 'line'].indexOf(t) !== -1),
   'found ' + JSON.stringify([...new Set(mthTypes)]));
ok('…in ONE undo step, so one Ctrl+Z takes the whole model back off',
   /pushUndo\(\);\n\s*var made = \[\];/.test(mthSrc));
ok('placing is a one-shot mode that hands the tool back',
   /setTool\(mthPad\.prevTool && mthPad\.prevTool !== 'model' \? mthPad\.prevTool : 'pen'\);/.test(html),
   'a student left in a mode they never chose is a student whose pen has stopped working');

/* ONE LAYOUT. The pad grows its segments with flexbox on `units` and the
   page places them from the same number, so the two drawings are the same
   drawing — and a model a student is shown is the model they are given. */
ok('the pad and the page both grow a segment on its own `units`',
   /seg\.style\.flexGrow = String\(s\.units\);/.test(mthSrc) &&
   /round2\(barW \* s\.units \/ total\)/.test(mthSrc));

/* Both ceiling rules go into the SYSTEM prompt, beside the grounding. A
   hard constraint carried in the user message is one the next question can
   talk over, and the two call sites drifting apart is exactly how the chat
   ends up locked and the marking wide open. */
const markCall = html.slice(html.indexOf('var raw = await window.askGemini(markPrompt'), html.indexOf('var raw = await window.askGemini(markPrompt') + 900);
ok('the marking sends its blank rule in the SYSTEM prompt', /system:\s*MARK_SYS \+ markBlankRule\(\)/.test(markCall),
   markCall.replace(/\s+/g, ' ').slice(0, 240));
const chatCall = html.slice(html.indexOf('var out = await window.askGemini('), html.indexOf('var out = await window.askGemini(') + 700);
ok('the chat sends its ceiling rule in the SYSTEM prompt', /system:\s*CHAT_SYS \+ buddyCeilingRule\(\)/.test(chatCall),
   chatCall.replace(/\s+/g, ' ').slice(0, 240));

/* The model and its thinking floor move together: a level the model does
   not know is a 400 on every AI call in the app — not a worse answer, no
   answer at all. */
ok('the Gemini model is named once, as a constant', /const AI_MODEL = "gemini-[\d.]+-flash"/.test(html));
ok('the thinking floor is a named constant beside it', /const AI_THINK_MIN = "(low|medium|high)"/.test(html));
ok('the floor is one Gemini 3.7 accepts', !/AI_THINK_MIN = "minimal"/.test(html),
   '3.7 dropped "minimal" — sending it is 400 INVALID_ARGUMENT on every call');

/* No key may ever live in this file: it is served to every student's
   browser and it is in the repository history for good. */
ok('there is no OpenAI-style key in the file', !/\bsk-[A-Za-z0-9_-]{16,}/.test(html));

/* CSS that fails silently. A single-class .tnWide loses to `.modalCard`'s
   own max-width, which is declared later in the sheet — the window comes
   out 520px wide and nothing anywhere says why. */
ok('the wide window rule carries BOTH classes', /\.modalCard\.tnWide\s*\{/.test(html));
ok('the list screens are blocks when they are on, not flex containers',
   /#homeView\.on,\s*#mistakeView\.on\s*\{\s*display:\s*block/.test(html));

/* The picker's value is cleared BEFORE the file is used, or the same PDF
   picked twice fires no change event and the second try does nothing. */
const fileInput = html.slice(html.indexOf("$('fileInput').addEventListener"), html.indexOf("$('fileInput').addEventListener") + 600);
ok('the file picker is cleared before the PDF is used',
   fileInput.indexOf('e.target.value') < fileInput.indexOf('handleUpload'), fileInput.replace(/\s+/g, ' '));

/* crossOrigin has to be set BEFORE src or it does nothing, and the crop
   then dies on a SecurityError when it is SAVED rather than when it is
   opened. */
const crop = html.slice(html.indexOf('function openCrop'), html.indexOf('function openCrop') + 1200);
ok('the crop picture gets crossOrigin before its src',
   crop.indexOf('crossOrigin') < crop.indexOf('img.src'), crop.replace(/\s+/g, ' ').slice(0, 300));

/* The notebook is LIVE. A one-shot read looks exactly like a live one until
   the day a rule is typed in Ans Key mid-lesson, and then this app is
   quietly answering against yesterday's notebook. */
ok('the notes are read with a live listener, not a one-shot get',
   /notesCollRef\(owner\)\.onSnapshot\(/.test(html));
ok('the style profile is watched too', /styleDocRef\(owner\)\.onSnapshot\(/.test(html));
ok('the listeners come down on every account change', /stopTeachingNotes\(\);/.test(html) &&
   /onAuthStateChanged/.test(html));
ok('taking them down RELEASES anyone waiting on the first snapshot',
   /_notesPending = \[\];[\s\S]{0,120}waiting\.forEach/.test(html),
   'a waiter holding a promise whose listener has just gone is never answered, and the hint never arrives');

/* `topics` is the Learning Portal's syllabus list. A note written here must
   go in as a general note there, not as one tagged with topics that app has
   never heard of. */
const note = html.slice(html.indexOf('async function quickNoteSave'), html.indexOf('async function quickNoteSave') + 1400);
ok('a note written here leaves `topics` empty for the Portal', /topics:\s*\[\]/.test(note));
ok('…and says which app it came from', /source:\s*'tutor'/.test(note));

/* ---- 🔑 The key reaches all three things that talk to the student ----
   The hint, the chat and the marking each build their own system prompt,
   and a key that reaches two of them is a buddy that marks against the
   paper and hints against a guess — with nothing on screen to say which. */
const hintCall = html.slice(html.indexOf('var raw = await window.askGemini(lines.join'),
                            html.indexOf('var raw = await window.askGemini(lines.join') + 700);
ok('the hint prompt carries the answer key', /aiGrounding\('hint', \{ q: q \}\)\s*\+\s*keyRuleBlock\(\)/.test(hintCall),
   hintCall.replace(/\s+/g, ' ').slice(0, 240));
ok('the marking prompt carries the answer key', /aiGrounding\('mark'\)\s*\+\s*keyRuleBlock\(\)/.test(markCall),
   markCall.replace(/\s+/g, ' ').slice(0, 260));
ok('the chat carries it too, behind the ceiling rule',
   /buddyCeilingRule\(\)\s*\+\s*aiGrounding\('teach', \{ q: text \}\)\s*\+\s*keyRuleBlock\(text\)/.test(chatCall),
   chatCall.replace(/\s+/g, ' ').slice(0, 260));
ok('the corrections document is watched beside the profile, and comes down with it',
   /_cerStyleUnsub = cerStyleDocRef\(owner\)\.onSnapshot\(/.test(html) &&
   /\[_notesUnsub, _styleUnsub, _cerStyleUnsub\]\.forEach/.test(html) &&
   /cerStyle = null;\n\}/.test(html.slice(html.indexOf('function stopTeachingNotes'), html.indexOf('function stopTeachingNotes') + 400)));
ok('the note budgets are pots, not a slice',
   !/function notesJoinField\(rel, field, cap\) \{\n  var s = rel\.map/.test(html) && /function notesFairShare\(/.test(html),
   chatCall.replace(/\s+/g, ' ').slice(0, 260));

/* THE KEY IS NOT THE STUDENT'S WORK. Marking the pages at the back of the
   paper puts the paper's own answers into the score as questions they "got
   right", and into the mistake book with a picture of the key beside them. */
const runMark = html.slice(html.indexOf('async function runMarking'),
                           html.indexOf('async function runMarking') + 3200);
ok('marking runs over the student\'s pages, not the key\'s', /var work = studentPages\(\)/.test(runMark),
   runMark.replace(/\s+/g, ' ').slice(0, 260));
ok('…and the picture and its page number are pushed together',
   /imgs\.push\([^)]*\);\s*pageNums\.push\(batch\[b\]\.num\)/.test(runMark.replace(/\s+/g, ' ')) ||
   /pageNums\.push\(batch\[b\]\.num\)/.test(runMark),
   runMark.replace(/\s+/g, ' ').slice(0, 400));

/* The key is remembered with the worksheet, or every reopen reads the
   marking scheme again — which costs an AI call a page and makes the pages
   reappear in the viewer meanwhile. */
const body = html.slice(html.indexOf('function worksheetBody'), html.indexOf('function worksheetBody') + 900);
ok('the key is saved with the worksheet', /key:\s*\{\s*pages: wsKey\.pages/.test(body),
   body.replace(/\s+/g, ' ').slice(0, 300));

/* A worksheet the teacher set shares ONE PDF with the whole class, so a
   student tidying up their own copy must not delete the file every other
   student is reading. */
const del = between('async function deleteWorksheet', '/* ---- Uploading ---- */',
                    'the worksheet delete');
ok('deleting a copy never deletes the class\'s shared PDF',
   /w\.storagePath && !w\.sharedPdf/.test(del), del.replace(/\s+/g, ' ').slice(0, 300));

/* …AND NEITHER DOES DELETING THE TEACHER'S OWN COPY (v1.23.1). The
   teacher's original is the one the file BELONGS to and it never carries
   `sharedPdf`, so before this the teacher tidying up after setting a
   worksheet deleted the one PDF every student's copy read — the assignment
   stayed on every home screen and every Start / Carry on came back
   "Object 'tutor-worksheets/…pdf' does not exist". */
const delFull = html.slice(html.indexOf('async function deleteWorksheet'),
                           html.indexOf('/* ---- Uploading ---- */'));
ok('deleting the TEACHER\'s copy asks whether the class reads it first',
   /var classReads = await worksheetReadByClass\(w\);/.test(delFull) &&
   delFull.indexOf('worksheetReadByClass') < delFull.indexOf('storage.ref(w.storagePath).delete()'),
   'the class check has to come before the file goes');
ok('…and keeps the PDF and the key file when it does',
   /w\.storagePath && !w\.sharedPdf && !classReads/.test(delFull) &&
   /w\.keyPath && !w\.sharedPdf && !classReads/.test(delFull));
const readByClass = html.slice(html.indexOf('async function worksheetReadByClass'),
                               html.indexOf('async function deleteWorksheet'));
ok('the answer is read LIVE off the assignment, not only off `pushed`',
   /db\.collection\(ASSIGN_COLLECTION\)\.doc\(w\.id\)\.get\(\)/.test(readByClass) &&
   /return a\.exists;/.test(readByClass),
   '`pushed` is cleared by Take off the list, and the copies started before that still read the file');
ok('…and a read that FAILS keeps the file',
   /catch \(e\) \{[\s\S]{0,200}return true;[\s\S]{0,20}\}/.test(readByClass));
ok('a student\'s copy never asks — it is never theirs to delete',
   /if \(w\.sharedPdf\) return true;/.test(readByClass));

/* A set worksheet whose file has gone must not leave a copy behind that can
   never be opened: the file is checked BEFORE the copy is written. */
const startA = html.slice(html.indexOf('async function startAssignment'),
                          html.indexOf('async function startAssignment') + 2600);
ok('Start it checks the PDF exists before a copy is written',
   /getDownloadURL\(\)/.test(startA) &&
   startA.indexOf('getDownloadURL()') < startA.indexOf('db.collection(COLLECTION).doc(docId).set('),
   'the check has to come before the write');
ok('…and a missing file is said in words, naming the teacher',
   /pdfMissingError\(e\)[\s\S]{0,400}setterName\(\)[\s\S]{0,200}return;/.test(startA));

/* "Object … does not exist" is true and no use to a child. */
const openFail = html.slice(html.indexOf('function openFailureText'), html.indexOf('function openFailureText') + 900);
ok('a missing PDF on a set worksheet is explained, and the work is said to be kept',
   /pdfMissingError\(e\)/.test(openFail) && /sharedPdf \|\| w\.assignmentId/.test(openFail) &&
   /Your work on this copy is kept/.test(openFail));
ok('…and any other failure still reads as it always did',
   /return 'Could not open it: ' \+ msg;/.test(openFail));
ok('openWorksheet reports through it', /toast\(openFailureText\(e, w\)/.test(html));

/* The teacher is told which set worksheets have lost their file — and only
   the teacher, because a student's device may not be allowed to read
   metadata at all. */
const chk = html.slice(html.indexOf('function checkAssignmentPdfs'), html.indexOf('function chipNode'));
ok('the set-worksheet file check is the teacher\'s only',
   /if \(!isAdmin\(currentUser\) \|\| !assignments\.length\) return;/.test(chk));
ok('…asks Storage once per assignment per sitting',
   /a\.pdfChecked = true/.test(chk) && /getMetadata\(\)/.test(chk));
ok('…flags only a file that is GONE, never a refused read',
   /if \(pdfMissingError\(e\)\) \{ a\.pdfMissing = true;/.test(chk));
ok('…and the card says so and disables Start',
   /a\.pdfMissing[\s\S]{0,200}assignWarn/.test(html) && /go\.disabled = !!a\.pdfMissing;/.test(html));

/* Setting work for the class writes to a collection every student reads, so
   hiding the button is not the lock. */
ok('only the teacher can set a worksheet, checked in the handler',
   /async function pushWorksheet\([^)]*\) \{[\s\S]{0,900}if \(!isAdmin\(currentUser\)\) return \{ ok: false/.test(html),
   'pushWorksheet does not re-check isAdmin');
/* 📌 A QUIET PUSH MUST STILL REPORT. `opts.quiet` is what lets a whole
   shelf be set in one press without ten toasts, and the one way it could
   go wrong is by swallowing the refusal as well as the noise — so every
   exit hands an outcome back, and the batch is what names it. */
ok('…and a quiet push still hands its refusal back',
   /var say = function \(msg, ms\) \{ if \(!opts\.quiet\) toast\(msg, ms\); \};/.test(pushSrc) &&
   /return \{\n?\s*ok: false,\n?\s*denied: denied,/.test(pushSrc),
   'a quiet pushWorksheet must still return why it refused');
/* A write that landed on a paper with no level or subject put it on NOBODY's
   shelf. Counting that as a success is how a teacher is told nine papers
   went out when no child can see one of them. */
ok('a paper set onto nobody\'s shelf is reported as a refusal, not a success',
   /it has no level or subject, so it is on nobody\u2019s shelf/.test(pushSrc));
ok('…and in the dialog that opens it',
   /function openPushModal\([^)]*\) \{[\s\S]{0,80}if \(!isAdmin\(currentUser\)\) return;/.test(html));

/* ---- 🎙️ One transcription door, and one model ---- */
/* Named once in CODE. The comment above it names it too, which is the
   point of the comment, so only assignments are counted. */
ok('the speech model is a constant, assigned exactly once',
   (html.match(/=\s*"gemini-3\.5-transcribe"/g) || []).length === 1,
   'found ' + (html.match(/=\s*"gemini-3\.5-transcribe"/g) || []).length + ' assignments');
ok('there is a transcription door on window', /window\.transcribeAudio\s*=/.test(html));
/* THE FALLBACK IS THE POINT. A model id gets renamed under us, and an id
   this project cannot reach is a 400 on every recording — which reads as
   "the mic is broken" rather than "that id is out of date". */
const door = html.slice(html.indexOf('window.transcribeAudio ='),
                        html.indexOf('window.transcribeAudio =') + 1400);
ok('…with the ordinary model behind it', /if \(!geminiModel\)/.test(door) && /runTranscribe\(geminiModel/.test(door),
   door.replace(/\s+/g, ' ').slice(0, 300));
ok('…and a refusal is remembered rather than paid for on every recording',
   /_transcribeDownUntil = Date\.now\(\) \+ AI_TRANSCRIBE_DOWN_MS/.test(door),
   door.replace(/\s+/g, ' ').slice(0, 300));
/* No thinkingConfig on a speech model: a level a model does not know is a
   400, not a worse answer, and transcription is reading rather than
   reasoning. */
ok('the transcription call sends no thinking level',
   !/thinking/i.test(html.slice(html.indexOf('async function runTranscribe'),
                                html.indexOf('async function runTranscribe') + 400)));
/* A mic that is not going to work is not drawn: a button that silently does
   nothing is worse than no button. */
ok('the speak tool is in the toolbar, hidden until it is known to work',
   /data-tool="speak" id="speakToolBtn" hidden/.test(html));
ok('…and both mics are painted from one function',
   /function renderMicBtns/.test(html) && /speakToolBtn/.test(html) && /chatMicBtn/.test(html));



/* =====================================================================
   HOW BIG THE MARK IS
   One control for two numbers. Every way it goes wrong is quiet: the wrong
   number shown against the selection, the pen reset by a trip through the
   text tool, a highlighter tripled every time it is touched.
   ===================================================================== */
section('The size control');

S.tool = 'pen'; S.selectedId = null; S.editingId = null; S.annotations = [];
eq('a drawing tool sizes a STROKE', S.annSizeKind(), 'stroke');
S.tool = 'text';
eq('the 🅣 sizes a FONT', S.annSizeKind(), 'font');
S.tool = 'speak';
eq('…and so does the 🎤, because it writes a text box too', S.annSizeKind(), 'font');

/* THE TWO NUMBERS ARE REMEMBERED APART. Sharing one is a pen that comes back
   from the text tool 16px thick, which reads as the app forgetting. */
S.tool = 'pen'; S.strokeW = 3; S.fontSize = 16;
S.setAnnSize(9);
eq('setting the size with a pen in hand moves the pen', S.strokeW, 9);
eq('…and leaves the text size alone', S.fontSize, 16);
S.tool = 'text';
S.setAnnSize(28);
eq('setting it with the 🅣 in hand moves the text size', S.fontSize, 28);
eq('…and leaves the pen alone', S.strokeW, 9);
S.tool = 'pen';
eq('so going pen → text → pen finds the pen where it was left', S.annSizeValue(), 9);

/* IT DESCRIBES THE SELECTION FIRST. A control that only ever described the
   pen would leave a student redrawing something to resize it. */
S.annotations = [{ id: 'a1', type: 'text', page: 1, fontSize: 40, h: 60 },
                 { id: 'a2', type: 'pen', page: 1, width: 5 },
                 { id: 'a3', type: 'highlight', page: 1, width: 27 }];
S.selectedId = 'a1';
eq('a selected text box shows ITS size, not the pen', S.annSizeKind(), 'font');
eq('…and its own number', S.annSizeValue(), 40);
S.selectedId = 'a2';
eq('a selected stroke shows its own width', S.annSizeValue(), 5);

/* A HIGHLIGHTER'S WIDTH IS DERIVED, so the control shows the PEN number it
   was derived from. Showing 27 and then setting it back to 3 would silently
   triple it — and doing that twice would take it to 81. */
S.selectedId = 'a3'; S.strokeW = 9;
eq('a selected highlighter shows the pen number behind it', S.annSizeValue(), 9);
S.setAnnSize(4);
eq('…and setting 4 gives it the highlighter width for 4', S.annotations[2].width, 12);
S.setAnnSize(9);
eq('…and 9 gives 27, not 81', S.annotations[2].width, 27);

/* A BOX BEING TYPED IN IS NOT SOMETHING TO RESIZE out from under the caret. */
S.selectedId = 'a1'; S.editingId = 'a1'; S.tool = 'pen';
eq('the box being typed in is not the control\'s target', S.annSizeTarget(), null);
eq('…so the control falls back to the tool in hand', S.annSizeKind(), 'stroke');
S.editingId = null;

/* THE CLAMP. A typed box can hold anything at all. */
S.selectedId = null; S.tool = 'pen';
S.setAnnSize(999);   eq('a pen size past the top clamps', S.strokeW, S.ANN_SIZE_KINDS.stroke.max);
S.setAnnSize(0);     eq('…and below the bottom', S.strokeW, S.ANN_SIZE_KINDS.stroke.min);
S.setAnnSize(-40);   eq('a negative size never gets through', S.strokeW, S.ANN_SIZE_KINDS.stroke.min);
S.strokeW = 7;
S.setAnnSize('abc'); eq('nonsense leaves the size where it was', S.strokeW, 7);
S.setAnnSize(4.6);   eq('a fraction rounds rather than drawing at 4.6', S.strokeW, 5);
S.tool = 'text';
S.setAnnSize(4);     eq('a font clamps to its OWN floor, not the pen\'s', S.fontSize, S.ANN_SIZE_KINDS.font.min);
ok('a font may be bigger than any pen', S.ANN_SIZE_KINDS.font.max > S.ANN_SIZE_KINDS.stroke.max);

/* A TEXT BOX GROWS WITH ITS SIZE. A size put up on a box that does not grow
   clips the answer the marking then never sees. */
S.tool = 'select'; S.selectedId = 'a1'; S.annotations[0].fontSize = 12; S.annotations[0].h = 21;
S.setAnnSize(48);
ok('a text box grows when its size does', S.annotations[0].h >= 48 * 1.8,
   'h is ' + S.annotations[0].h);

ok('the highlighter draws through the ONE width function',
   /a\.width = highlightWidthFor\(strokeW\)/.test(html));
ok('the slider is gone and the arrows and the box are there',
   !/id="strokeRange"/.test(html) &&
   /id="sizeDown"/.test(html) && /id="sizeUp"/.test(html) &&
   /id="sizeInput"[^>]*type="number"|type="number" id="sizeInput"/.test(html));
ok('…and the control says which size it is changing',
   /id="sizeLabel"/.test(html) && /label\.textContent = k\.label/.test(html));
/* Sync from the ONE repaint every selection change already goes through:
   hooking the dozen places that set `selectedId` is how one gets missed and
   the control goes stale on exactly one route. */
ok('the control is repainted from renderAllOverlays, not per call site',
   /function renderAllOverlays\(\) \{ pages\.forEach\(renderOverlay\); syncSizeCtl\(\); \}/.test(html));
ok('…and from setTool, because the meaning changes with the tool',
   /renderMicBtns\(\);\s*\n\s*syncSizeCtl\(\);/.test(html));
/* Writing the value back mid-keystroke is what turns "24" into "2". */
ok('the box is never written to while it is being typed in',
   /document\.activeElement !== input/.test(html));

/* =====================================================================
   AUTO-SAVE
   The work on the page IS the lesson, and every failure here is a student
   who did the work and has nothing to show for it.
   ===================================================================== */
section('Auto-save');

/* =====================================================================
   🐛 THE SAVE CALLED A FUNCTION THAT DOES NOT EXIST — v1.43.0
   ---------------------------------------------------------------------
   `performSave`'s first statement was `syncTextEditValue()`. The function
   in this file is `syncActiveTextEditValue`; the other name has never
   existed. So EVERY save threw a ReferenceError on its very first line —
   the auto-save timer, the flush on the way out of the tab, and the Save
   button alike — and nothing was written for forty-eight versions. No ink,
   no marking, no hints, no score.

   IT WAS SILENT BECAUSE NOBODY HELD THE PROMISE. `performSave` is async,
   so the throw was a rejected promise, and the timer, `flushSave` and the
   button all call it without awaiting: an unhandled rejection is a line in
   a console no student opens, and the button simply sat on "Save".

   THE CENSUS BELOW IS WHAT WOULD HAVE CAUGHT IT, and it is the half worth
   keeping. Every one of the old pins passed the whole time, because each
   of them asked what the source SAYS rather than whether the names it says
   resolve. So: every function the save path calls must be DEFINED in this
   file. A regex that reads the text cannot see a name that is not there;
   this can.
   ===================================================================== */
section('The save actually resolves');

/* Definitions, read out of the page's own script blocks rather than out of
   a slice: a function the save calls may be declared anywhere in the file. */
const SCRIPTS = [...html.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const DEFINED = new Set();
for (const js of SCRIPTS) {
  for (const m of js.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g)) DEFINED.add(m[1]);
  for (const m of js.matchAll(/\b(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=/g)) DEFINED.add(m[1]);
  for (const m of js.matchAll(/\bwindow\.([A-Za-z_$][\w$]*)\s*=/g)) DEFINED.add(m[1]);
}

/* What the browser and the two libraries bring. Anything NOT here and not
   defined above is this app's own name — and if the save calls it, it has
   to exist. Keep this list short: a name added to it to make a red tick go
   away is the guard being switched off. */
const BROWSER = new Set([
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame',
  'cancelAnimationFrame', 'parseInt', 'parseFloat', 'isFinite', 'isNaN', 'String', 'Number',
  'Boolean', 'Array', 'Object', 'JSON', 'Math', 'Date', 'Promise', 'Error', 'RegExp', 'Map',
  'Set', 'fetch', 'alert', 'confirm', 'prompt', 'encodeURIComponent', 'decodeURIComponent',
  'btoa', 'atob', 'matchMedia', 'getComputedStyle', 'structuredClone', 'queueMicrotask',
  'function', 'return', 'if', 'for', 'while', 'switch', 'catch', 'typeof', 'new', 'await',
  'else', 'do', 'try'
]);

/* The whole save path, in the file's own words. If a name appears here and
   nowhere else in the app, the save dies on it. */
const SAVE_PATH = [
  html.slice(html.indexOf('async function performSave('), html.indexOf('/* ================= AUTO-SAVE =================')),
  between('function scheduleAutoSave() {', 'function setSaveState(', 'scheduleAutoSave'),
  between('function flushSave() {', "window.addEventListener('pagehide'", 'flushSave'),
  between('function saveCrashed(e) {', '/* ================= AUTO-SAVE', 'saveCrashed')
].join('\n');

function bareCalls(src) {
  // strip comments and strings, so prose and message text are not read as calls
  let t = src.replace(/\/\*[\s\S]*?\*\//g, ' ')
             .replace(/(^|[^:\\])\/\/[^\n]*/gm, (m, a) => a)
             .replace(/'(?:\\.|[^'\\])*'/g, "''")
             .replace(/"(?:\\.|[^"\\])*"/g, '""')
             .replace(/`(?:\\.|[^`\\])*`/g, '``');
  const out = new Set();
  for (const m of t.matchAll(/(^|[^\w$.])([A-Za-z_$][\w$]*)\s*\(/g)) out.add(m[2]);
  return [...out];
}

const unresolved = bareCalls(SAVE_PATH).filter(n => !DEFINED.has(n) && !BROWSER.has(n));
ok('every function the save path calls really exists',
   unresolved.length === 0,
   unresolved.length
     ? 'the save dies on its first call to: ' + unresolved.join(', ')
     : '');

/* THE ONE THAT WAS WRONG, named, so a rename cannot put it back quietly. */
ok('…and the box being typed in is read by its real name',
   DEFINED.has('syncActiveTextEditValue') && !DEFINED.has('syncTextEditValue') &&
   /syncActiveTextEditValue\(\);/.test(SAVE_PATH),
   'the words a child is still typing reach the save through this and nothing else');
ok('…and it is still the non-destructive half, never the full commit',
   !/^\s*commitActiveTextEdit\(\);/m.test(
     html.slice(html.indexOf('async function performSave('), html.indexOf('await writeBody('))),
   'the save runs on a timer armed the moment a box is made — committing here closes it under a child still typing');

/* READING THAT BOX MUST NEVER COST THE SAVE. It is ONE annotation; the
   worksheet is the whole lesson — and for forty-eight versions it cost all
   of it. Its own try/catch is what makes that impossible. */
const SYNC_ARM = between('try {\n    syncActiveTextEditValue();', 'try {\n    await writeBody(', 'the wrapped sync');
ok('a read of the open box that throws costs the box and never the save',
   /catch \(e\) \{[\s\S]{0,200}console\.error/.test(SYNC_ARM));

/* NOTHING THAT CALLS THE SAVE MAY DROP ITS FAILURE ON THE FLOOR. */
ok('the auto-save timer catches',
   /performSave\(true\)\.catch\(saveCrashed\);\s*\}, autoSaveDelay\(\)\);/.test(html));
ok('…the flush on the way out of the tab catches',
   /localBackupWrite\(currentDocId\);[^\n]*\n\s*performSave\(true\)\.catch\(saveCrashed\);/.test(html));
ok('…and so does the Save button',
   /\$\('saveBtn'\)\.addEventListener\('click', function \(\) \{ performSave\(\)\.catch\(saveCrashed\); \}\);/.test(html));
ok('a save that THREW is reported exactly as a refused write is',
   /function saveCrashed\(e\) \{[\s\S]{0,400}saveFails\+\+;[\s\S]{0,300}localBackupWrite\(currentDocId\)[\s\S]{0,200}setSaveState\('failed'\)[\s\S]{0,200}scheduleAutoSave\(\);/.test(html),
   'to the student a throw and a refusal are the same thing — their work is not on the server');

/* AND THE CLAIM IS RELEASED WHATEVER HAPPENS. `savingNow` left true is a
   second way for this app to stop saving and say nothing: every later save
   returns false at the gate. */
ok('the one-write-at-a-time claim is released in a `finally`',
   /\} finally \{[\s\S]{0,400}savingNow = false;/.test(html));
ok('…and a toolbar that is not there cannot strand it',
   /var btn = \$\('saveBtn'\);\s*\n\s*(?:\/\/[^\n]*\n\s*)*if \(btn\) btn\.disabled = true;/.test(html) &&
   /if \(btn\) btn\.disabled = false;/.test(html));

/* THE STUDENT IS TOLD IT SAVES BY ITSELF. A child pressing Save every few
   minutes is a child who does not know it is already happening — and the
   word is in TWO places, the markup's first paint and `setSaveState`'s own
   repaint, so both are pinned: one of them alone is a button that says it
   on the first render and stops the moment anything is saved. */
ok('the button says it saves by itself from its first paint',
   /<button class="btn btnSm" id="saveBtn" title="Saves by itself as you work — tap to save now">Save<\/button>/.test(html));
ok('…and still says it every time it is repainted',
   /btn\.title = 'Saves by itself as you work — tap to save now';/.test(html) &&
   /btn\.title = 'Saved — it saves by itself as you work';/.test(html));

S.saveFails = 0;
eq('the ordinary wait is short', S.autoSaveDelay(), S.AUTOSAVE_DELAY);
S.saveFails = 1;
ok('a failure waits longer', S.autoSaveDelay() > S.AUTOSAVE_DELAY);
S.saveFails = 2;
ok('…and longer again', S.autoSaveDelay() > S.AUTOSAVE_DELAY * 2);
S.saveFails = 40;
eq('…but never past the ceiling, or a phone spends the lesson retrying',
   S.autoSaveDelay(), S.AUTOSAVE_MAX_DELAY);
ok('a failed save RE-ARMS the timer rather than giving up',
   /scheduleAutoSave\(\);[\s\S]{0,400}?\} catch|catch \(e\) \{[\s\S]{0,700}?scheduleAutoSave\(\);/.test(html));
ok('…and keeps what it could not send on the device',
   /catch \(e\) \{[\s\S]{0,500}?localBackupWrite\(currentDocId\)/.test(html));
ok('a save that lands clears that copy',
   /dirty = false;[\s\S]{0,200}?localBackupClear\(currentDocId\)/.test(html));

/* BOTH EVENTS. Safari on iOS very often gives a swiped-away tab `pagehide`
   and nothing else; a desktop tab switched away gets `visibilitychange` long
   before it is closed. */
ok('the save is flushed on the way out, by both events',
   /visibilitychange[\s\S]{0,200}?flushSave/.test(html) &&
   /addEventListener\('pagehide', flushSave\)/.test(html));

/* ---- The copy on the device ---- */
store.clear();
S.docName = 'Fractions';
S.worksheetBody = () => JSON.stringify({ annotations: [{ id: 'x' }] });
S.localBackupWrite('doc1');
ok('a refused save leaves a copy on the device', !!S.localBackupRead('doc1'));
S.localBackupClear('doc1');
eq('…and a save that lands takes it away', S.localBackupRead('doc1'), null);

/* localStorage is a few megabytes for the WHOLE origin. A body past the cap
   is dropped rather than allowed to evict everything else in there. */
S.worksheetBody = () => 'x'.repeat(S.LOCAL_BACKUP_MAX + 1);
S.localBackupWrite('big');
eq('a body too big for localStorage is not written', S.localBackupRead('big'), null);
S.worksheetBody = () => JSON.stringify({ annotations: [] });

/* IT IS OFFERED, NEVER APPLIED — and only when it is genuinely ahead of what
   the server holds. Quietly overwriting newer server work with whatever this
   browser was holding is a worse bug than the one it rescues. */
store.clear();
S.currentDocId = 'doc2';
S.localBackupWrite('doc2');
var kept = JSON.parse(store.get('polymath.tutor.unsaved:doc2'));
S.offerLocalBackup('doc2', kept.at + 60000);      // the server is NEWER
eq('a backup older than the server is dropped without asking',
   S.localBackupRead('doc2'), null);

/* A timestamp arrives as a Firestore stamp, a Date, a number or nothing,
   depending on whether the document has been round-tripped yet. */
eq('a Firestore timestamp reads', S.stampOf({ toMillis: () => 1234 }), 1234);
eq('a seconds-only stamp reads', S.stampOf({ seconds: 2 }), 2000);
eq('a Date reads', S.stampOf(new Date(5000)), 5000);
eq('a number reads', S.stampOf(7), 7);
eq('nothing reads as 0, so the backup is OFFERED rather than assumed stale',
   S.stampOf(undefined), 0);

/* ---- One door from a saved body to the open worksheet ---- */
S.annotations = []; S.hints = []; S.chat = [];
S.applyWorksheetBody({ annotations: [{ id: 'z' }], hints: [{ id: 'h' }],
                       marking: { items: [1, 2], runAt: 9 }, chat: [{ t: 'hi' }],
                       key: { pages: [3], rows: [{ n: '1' }], shared: false } }, {});
eq('the body puts the ink back', S.annotations.length, 1);
eq('…the hints', S.hints.length, 1);
eq('…the marking', S.marking.items.length, 2);
eq('…and the answer key', S.wsKey.pages, [3]);
ok('a body with nothing in it does not throw',
   (function () { try { S.applyWorksheetBody({}, {}); return true; } catch (e) { return false; } })());
eq('…and leaves no ink behind from the last one', S.annotations.length, 0);
ok('opening a worksheet and putting a rescued copy back share ONE reader',
   (html.match(/applyWorksheetBody\(/g) || []).length >= 2);

/* The status is three states, because a student acts on them differently. */
ok('"not saved" is its own state, not the same word as "nothing to save"',
   /'⚠ Not saved'/.test(html) && /saveBad/.test(html));

ok('the logo is in the top-left corner, with a fallback that needs no network',
   /class="brandLogo"/.test(html) && /onerror=/.test(html) &&
   /polymath-logo-sticker/.test(html));
ok('…and it is the tab and home-screen icon too',
   /rel="icon"/.test(html) && /rel="apple-touch-icon"/.test(html));


/* =====================================================================
   THE MARKS — what a question was worth, and what it earned
   ===================================================================== */
section('The marks');

eq('a correct answer earns the lot, whatever the model said',
   S._markPair('1/3', 'correct', true), { awarded: 3, total: 3 });
eq('a wrong answer earns nothing, whatever the model said',
   S._markPair('2/3', 'wrong', true), { awarded: 0, total: 3 });
/* An answer that earns neither 0 nor the full total is what "partial" MEANS,
   so a partial the model scored at either end is pulled off it — otherwise
   the chip says "partly right" and the number beside it says "wrong". */
eq('a partial is neither nothing nor everything', S._markPair('0/2', 'partial', true),
   { awarded: 1, total: 2 });
eq('…including from the other end', S._markPair('2/2', 'partial', true), { awarded: 1, total: 2 });
eq('…and one the model got right is left alone', S._markPair('2/4', 'partial', true),
   { awarded: 2, total: 4 });
eq('half marks are real and survive', S._markPair('1.5/2', 'partial', true), { awarded: 1.5, total: 2 });
eq('awarded above the total is clamped', S._markPair('9/2', 'partial', true), { awarded: 1, total: 2 });
eq('a blank earns nothing but keeps what it was worth',
   S._markPair('2/2', '', false), { awarded: 0, total: 2 });
/* A worksheet marked before the marks existed has none, and must show none —
   never a zero, which reads as a mark against the student. */
eq('a marks string that will not parse is no marks at all', S._markPair('two out of three', 'correct', true), null);
eq('…and so is a missing one', S._markPair(undefined, 'correct', true), null);
eq('a nonsense total is refused', S._markPair('1/9999', 'correct', true), null);
eq('a zero total is refused', S._markPair('0/0', 'correct', true), null);

eq('reading a stored marks string back does not re-mark it',
   S.markPairOf({ marks: '1/2' }), { awarded: 1, total: 2 });
eq('…and an old worksheet with none reads as none', S.markPairOf({ marks: '' }), null);

/* =====================================================================
   THE TICK ON THE PAGE
   ===================================================================== */
section('The ticks and crosses on the page');

eq('a point on the page reads', S._markAt([520, 180]), { y: 520, x: 180 });
eq('the corners read', S._markAt([0, 1000]), { y: 0, x: 1000 });
/* NEVER clamped. A clamped point is a guess, and a tick against the wrong
   question is worse than no tick — which is what the prompt says too. */
eq('a point off the page is refused rather than clamped', S._markAt([1400, 180]), null);
eq('…in either direction', S._markAt([-5, 180]), null);
eq('a malformed point is refused', S._markAt([180]), null);
eq('…and so is one that is not a point at all', S._markAt('middle'), null);

ok('a marked wrong answer gets a cross',
   S.markPinFor({ marked: true, verdict: 'wrong', at: { y: 1, x: 1 }, marks: '0/2' }).sym === '✗');
ok('a correct one gets a tick',
   S.markPinFor({ marked: true, verdict: 'correct', at: { y: 1, x: 1 }, marks: '2/2' }).sym === '✓');
/* The symbol says the verdict on its own and the marks say how much: a
   partial that shared BOTH with a correct answer would be telling them apart
   by colour alone, which is exactly what a mono printer and a colour-blind
   reader cannot do. */
const half = S.markPinFor({ marked: true, verdict: 'partial', at: { y: 1, x: 1 }, marks: '1/2' });
const full = S.markPinFor({ marked: true, verdict: 'correct', at: { y: 1, x: 1 }, marks: '2/2' });
ok('a partial is told from a correct one WITHOUT its colour', half.marks !== full.marks);
ok('…and the two do not share a class either', half.cls !== full.cls);
eq('a BLANK gets no tick and no cross, even with a position',
   S.markPinFor({ marked: false, verdict: '', at: { y: 1, x: 1 }, marks: '0/2' }), null);
eq('a question with no position gets no pin', S.markPinFor({ marked: true, verdict: 'wrong', marks: '0/2' }), null);
eq('a marked answer with no verdict gets no pin either',
   S.markPinFor({ marked: true, verdict: '', at: { y: 1, x: 1 } }), null);

/* The ticks are NOT annotations, which is the load-bearing part: put one in
   `annotations` and the next marking run reads a page already covered in
   ticks, agrees with them, and nothing on any screen says why the second
   marking is so much kinder than the first. */
ok('the ticks are drawn from `marking.items`, never from `annotations`',
   /function renderMarksOn[\s\S]{0,600}marking\.items\.forEach/.test(html) &&
   !/function renderMarksOn[\s\S]{0,900}annotations\.push/.test(html));
ok('…and the flatten the marker re-reads draws only annotations',
   /drawAnnsOnCtx\(ctx, out\.width \/ p\.baseW, out\.height \/ p\.baseH, annotations, p\.num\)/.test(html));

/* =====================================================================
   THE REPORT
   ===================================================================== */
section('The report');

function mk(o) {
  return Object.assign({ number: '1', page: 1, endPage: 1, type: 'open', question: 'q',
                         options: [], option: '', answer: 'a', explanation: '',
                         topic: '', objective: '', at: null, atPage: 1,
                         marked: true, studentAnswer: 'x', verdict: 'correct',
                         marks: '1/1', feedback: '' }, o);
}
function setItems(items) { S.marking = { items: items, runAt: 0, running: false }; }

eq('two spellings of one topic are one topic',
   S.reportTopicKey('  Fractions:  Addition '), S.reportTopicKey('fractions: addition'));
eq('…and a trailing full stop does not make a third',
   S.reportTopicKey('Photosynthesis.'), S.reportTopicKey('Photosynthesis'));

setItems([
  mk({ number: '1', topic: 'Fractions', objective: 'Add two fractions.', verdict: 'wrong', marks: '0/2' }),
  mk({ number: '2', topic: 'fractions ', objective: 'Add two fractions.', verdict: 'partial', marks: '1/2' }),
  mk({ number: '3', topic: 'Fractions', objective: 'Simplify a fraction.', verdict: 'correct', marks: '2/2' }),
  mk({ number: '4', topic: 'Area', objective: 'Find the area of a rectangle.', verdict: 'correct', marks: '2/2' }),
  mk({ number: '5', topic: 'Volume', objective: 'Find a volume.', marked: false, verdict: '',
       studentAnswer: '', marks: '0/3' }),
  mk({ number: '6', topic: '', objective: '', verdict: 'wrong', marks: '0/1' })
]);

const groups = S.reportTopics();
eq('the topics group case- and space-insensitively', groups.length, 4);
eq('…and the group keeps the first spelling it saw', groups[0].name, 'Fractions');
eq('the same objective twice is listed once', groups[0].objectives.length, 2);
eq('a question with no topic gets its own group and is never merged into one',
   groups[3].name, S.REPORT_UNLABELLED);

const rev = S.reportRevise();
eq('a topic that went perfectly is not on the revise list',
   rev.weak.map(g => g.name).indexOf('Area'), -1);
eq('…it is named as a strength instead', rev.strong.map(g => g.name), ['Area']);
/* A topic nobody attempted is not a weakness — it is untried, which is a
   different thing to tell a student. */
eq('a topic left entirely blank is untried, not weak', rev.untried.map(g => g.name), ['Volume']);
eq('…and it is not on the weak list', rev.weak.map(g => g.name).indexOf('Volume'), -1);
ok('the topic that lost the most comes first', rev.weak[0].name === 'Fractions',
   'got ' + JSON.stringify(rev.weak.map(g => g.name)));

/* A partial is HALF a misunderstanding: counting it whole would put a topic
   the student nearly has above one they do not have at all. */
eq('a partial counts half towards what was lost',
   S.reportLost({ wrong: 1, partial: 1 }), 1.5);

/* Three wrong out of six is more work than one out of one, so the ranking is
   by what was LOST and only then by the rate. */
setItems([
  mk({ topic: 'Big', verdict: 'wrong', marks: '0/1' }),
  mk({ topic: 'Big', verdict: 'wrong', marks: '0/1' }),
  mk({ topic: 'Big', verdict: 'wrong', marks: '0/1' }),
  mk({ topic: 'Big', verdict: 'correct', marks: '1/1' }),
  mk({ topic: 'Big', verdict: 'correct', marks: '1/1' }),
  mk({ topic: 'Big', verdict: 'correct', marks: '1/1' }),
  mk({ topic: 'Small', verdict: 'wrong', marks: '0/1' })
]);
eq('three wrong out of six outranks one out of one',
   S.reportRevise().weak.map(g => g.name), ['Big', 'Small']);

/* "Go and revise Not labelled" is not advice anybody can act on, so the
   questions the marking could not place go last however much was lost on
   them — they are still listed, because a wrong answer is a wrong answer. */
setItems([
  mk({ topic: '', verdict: 'wrong', marks: '0/1' }),
  mk({ topic: '', verdict: 'wrong', marks: '0/1' }),
  mk({ topic: 'Angles', verdict: 'wrong', marks: '0/1' })
]);
const unl = S.reportRevise().weak.map(g => g.name);
eq('an unlabelled group never outranks a real topic, whatever it lost',
   unl, ['Angles', S.REPORT_UNLABELLED]);

/* Written against a plain object, so a topic called "constructor" must not
   find one on the prototype and count its questions into something that is
   not a group. */
setItems([mk({ topic: 'constructor', verdict: 'wrong', marks: '0/1' })]);
const proto = S.reportTopics();
eq('a topic called "constructor" is a topic like any other', proto.length, 1);
eq('…with its own count', proto[0].wrong, 1);

setItems([
  mk({ verdict: 'correct', marks: '2/2' }),
  mk({ verdict: 'wrong', marks: '0/3' }),
  mk({ marked: false, verdict: '', studentAnswer: '', marks: '0/4' })
]);
const mt = S.markMarkTally();
eq('the marks total over the paper', mt.total, 9);
eq('…what was earned', mt.awarded, 2);
/* "2 out of 9" reads as a poor paper when 4 of those marks are a question
   nobody reached, so the two are split and the report says both. */
eq('…what was on offer for what was attempted', mt.attempted, 5);
eq('…and what was never attempted at all', mt.blank, 4);

setItems([mk({ marks: '' }), mk({ marks: '' })]);
eq('a worksheet marked before the marks existed reports no score, not zero',
   S.markMarkTally().has, false);

/* =====================================================================
   THE DIAGNOSTIC — the paper filed under the syllabus, kept for the long
   run. Every failure here is silent: a question filed under the wrong
   objective prints perfectly and is wrong in the record for years.
   ===================================================================== */
section('The diagnostic — the syllabus catalogue');

/* The two lists are COPIES of the sibling apps' own — cer's
   SYLLABUS_LO_TOPICS and the Maths app's MOE_SYLLABUS (P3–P6) — and the
   ids have to stay theirs byte for byte, or a weak objective here stops
   naming the question bank's objective there. The counts and a sample of
   ids pin the copy. */
const sci = S.syllabusEntries('science');
const mth = S.syllabusEntries('math');
eq('science carries every one of the portal\'s 79 objectives', sci.length, 79);
eq('…under its 18 syllabus headings', S.SYLLABUS.science.length, 18);
eq('maths carries the 171 P3–P6 objectives of the maths app', mth.length, 171);
ok('a science id is cer\'s own', !!S.syllabusLo('science', 'heat-flow'));
ok('a maths id is the maths app\'s own', !!S.syllabusLo('math', 'P5.FR.2.6'));
eq('…and reads level.sub-strand.number', S.syllabusLo('math', 'P5.FR.2.6').level, 'P5');
ok('every id is unique within its subject',
   new Set(sci.map(e => e.id)).size === 79 && new Set(mth.map(e => e.id)).size === 171);
/* The TOPIC a student reads is the portal's rapid-add topic, not the
   syllabus's own heading: "Heat", not "Energy Forms and Uses (Heat)". */
eq('a science topic is the rapid-add name', S.syllabusLo('science', 'heat-flow').topic, 'Heat');
eq('…with the syllabus heading kept as its group', S.syllabusLo('science', 'heat-flow').group,
   'Energy Forms and Uses (Heat)');
eq('a heading spanning several rapid-add topics files each objective under its own',
   S.syllabusLo('science', 'env-food').topic, 'Food Chains and Webs');
eq('…and the rest under the heading\'s default', S.syllabusLo('science', 'env-adapt').topic, 'Living Together');
eq('a maths topic carries its sub-strand, because "Four Operations" is two topics at P5',
   S.syllabusLo('math', 'P5.FR.2.6').topic, 'Fractions: Four Operations');
ok('…and the two are different keys',
   S.syllabusLo('math', 'P5.FR.2.6').tkey !== S.syllabusLo('math', 'P5.WN.2.4').tkey);
ok('the entries come out in syllabus order',
   sci.every((e, i) => i === 0 || e.order > sci[i - 1].order));
eq('a subject with no list has no entries', S.syllabusEntries('english').length, 0);
eq('…and neither does nothing at all', S.syllabusEntries('').length, 0);

section('The diagnostic — the selector');
/* The list is narrowed to the worksheet's level, the way ⚡ Rapid add's
   batch level narrows the topics the AI may choose from. */
const p5 = S.diagChoices('science', 'P5');
ok('a P5 science worksheet is offered the P5 objectives only',
   p5.entries.length > 0 && p5.entries.every(e => e.level === 'P5'));
eq('…and says which level was offered', p5.level, 'P5');
eq('no level is the whole subject — the picker\'s "Any level" row', S.diagChoices('science', '').entries.length, 79);
eq('a level the list does not know falls back to the whole subject', S.diagChoices('science', 'S1').entries.length, 79);
eq('…and says no level was applied', S.diagChoices('science', 'S1').level, '');
eq('a subject with no list offers nothing', S.diagChoices('english', 'P5').entries.length, 0);

const blk = S.markSyllabusBlock('science', 'P5');
ok('the prompt block names the P5 objectives', blk.indexOf('wat-evap') !== -1 && blk.indexOf('elec-cond') !== -1);
ok('…and not the P4 ones', blk.indexOf('heat-flow') === -1);
ok('…and says the year is not in question', /year is not in question/.test(blk));
ok('…and says to leave both empty rather than force a fit', /leave both empty/.test(blk));
ok('the whole subject goes when there is no level',
   S.markSyllabusBlock('science', '').indexOf('heat-flow') !== -1 && S.markSyllabusBlock('science', '').indexOf('wat-evap') !== -1);
eq('a subject with no list gets NO block, so the generic topic rule stands', S.markSyllabusBlock('english', 'P5'), '');
ok('the block puts each objective beside its topic',
   /• Water and its 3 States \[P5\]: wat-three — /.test(blk));

section('The diagnostic — where a reply lands');
/* A real id wins outright, whatever the topic said. */
let pl = S.diagPlace('science', 'P5', 'Heat', 'wat-evap');
eq('an objective id wins over the topic beside it', pl.topic, 'Water and its 3 States');
eq('…and files the objective', pl.lo, 'wat-evap');
eq('…on the list', pl.onList, true);
eq('an id is matched whatever its case', S.diagPlace('science', 'P5', '', 'WAT-EVAP').lo, 'wat-evap');
/* A topic that matches a name is placed under it with no objective. */
pl = S.diagPlace('science', 'P5', '  electrical   systems ', '');
eq('a topic matching a name on the list is placed, case and space aside', pl.sylTopic, 'Electrical Systems');
eq('…with no objective', pl.lo, '');
eq('…and the list\'s own spelling', pl.topic, 'Electrical Systems');
/* "Angles" is a topic at P3, P4 and P5 in maths; the worksheet's level
   decides, and the strand may be left off. */
pl = S.diagPlace('math', 'P5', 'Angles', '');
ok('a bare maths topic is placed under the worksheet\'s own level', /^P5\.GEO /.test(pl.sylTopic), pl.sylTopic);
ok('…where the level has it', /^P3\.GEO /.test(S.diagPlace('math', 'P3', 'Angles', '').sylTopic));
ok('…and under the first level that does otherwise', /^P3\.GEO /.test(S.diagPlace('math', 'P6', 'Angles', '').sylTopic));
eq('the strand spelled out matches too', S.diagPlace('math', 'P5', 'Geometry: Angles', '').lo, '');
ok('…', /^P5\.GEO /.test(S.diagPlace('math', 'P5', 'Geometry: Angles', '').sylTopic));
/* NEVER SNAPPED: a reply off the list keeps its own wording, unplaced. */
pl = S.diagPlace('science', 'P5', 'Photosynthesis in the dark', 'not-an-id');
eq('an unknown topic and id are kept as the model wrote them', pl.topic, 'Photosynthesis in the dark');
eq('…unplaced', pl.onList, false);
eq('…with no objective', pl.lo, '');
eq('…and no topic key', pl.sylTopic, '');
ok('the model\'s own wording is clipped, not dropped', S.diagPlace('science', 'P5', 'x'.repeat(200), '').topic.length === 70);
pl = S.diagPlace('english', 'P5', 'Subject-verb agreement', 'anything');
eq('a subject with no list keeps the raw topic', pl.topic, 'Subject-verb agreement');
eq('…and is never on a list', pl.onList, false);

section('The diagnostic — the item carries its filing');
const dctx = { subject: 'science', level: 'P5' };
let it = S._markNewItem({ question: 'q', answer: 'a', topic: 'Water', lo: 'wat-evap', marks: '2/2',
                          studentAnswer: 'x', verdict: 'correct' }, [1], dctx);
eq('a marked item carries its objective', it.lo, 'wat-evap');
eq('…its topic key', it.sylTopic, 'Water and its 3 States');
eq('…and the list\'s own topic name', it.topic, 'Water and its 3 States');
it = S._markNewItem({ question: 'q', answer: 'a', topic: 'Water', lo: 'wat-evap' }, [1]);
eq('without a context the topic is raw, exactly as before', it.topic, 'Water');
eq('…and nothing is filed', it.lo + it.sylTopic, '');
/* A question over a page break is filed by the half that saw all of it. */
const run = [];
S._markFoldRows([{ question: 'first half', answer: '', topic: 'Heat', lo: 'heat-flow' }], [1], run, { subject: 'science', level: '' });
S._markFoldRows([{ continuation: true, question: 'second half', answer: 'a', topic: 'Water', lo: 'wat-evap' }], [2], run, { subject: 'science', level: '' });
eq('a continuation is one question', run.length, 1);
eq('…filed by the half that saw the whole of it', run[0].lo, 'wat-evap');
eq('…topic key and all', run[0].sylTopic, 'Water and its 3 States');

section('The diagnostic — the table');
S.wsMeta.subject = 'science';
S.wsMeta.level = 'P5';
function dk(o) {
  return mk(Object.assign({ lo: '', sylTopic: '' }, o));
}
setItems([
  dk({ number: '1', topic: 'Electrical Systems', sylTopic: 'Electrical Systems', lo: 'elec-cond', verdict: 'wrong', marks: '0/2' }),
  dk({ number: '2', topic: 'Water and its 3 States', sylTopic: 'Water and its 3 States', lo: 'wat-evap', verdict: 'correct', marks: '2/2' }),
  dk({ number: '3', topic: 'Water and its 3 States', sylTopic: 'Water and its 3 States', lo: 'wat-evap', verdict: 'partial', marks: '1/2' }),
  dk({ number: '4', topic: 'Water and its 3 States', sylTopic: 'Water and its 3 States', lo: '', objective: 'Read a graph of temperature.', verdict: 'correct', marks: '1/1' }),
  dk({ number: '5', topic: 'Water and its 3 States', sylTopic: 'Water and its 3 States', lo: 'wat-three', marked: false, verdict: '', studentAnswer: '', marks: '0/3' }),
  dk({ number: '6', topic: 'Kitchen chemistry', verdict: 'wrong', marks: '0/1' }),
  dk({ number: '7', topic: '', verdict: 'wrong', marks: '0/1' }),
  dk({ number: '8', topic: 'Electrical Systems', sylTopic: 'Electrical Systems', lo: 'elec-cond', verdict: 'correct', marks: '2/2' })
]);
let dg = S.reportDiagnostic();
eq('the table knows the subject has a list', dg.hasList, true);
eq('the topics come out in SYLLABUS order — Water before Electrical, the paper\'s order aside',
   dg.groups.map(g => g.topic), ['Water and its 3 States', 'Electrical Systems', 'Kitchen chemistry', S.REPORT_UNLABELLED]);
eq('a question off the list keeps its own heading, after every listed topic', dg.groups[2].onList, false);
eq('a question with no topic at all is last of all', dg.groups[3].labelled, false);
const water = dg.groups[0];
eq('the objectives under a topic are in syllabus order, with the topic-only row last',
   water.rows.map(r => r.lo), ['wat-three', 'wat-evap', '']);
eq('an objective row names the objective', water.rows[1].objective, 'What affects the rate of evaporation');
eq('a topic-only row shows what the marking said the question tests', water.rows[2].objective, 'Read a graph of temperature.');
eq('the objective\'s full marks add up', water.rows[1].total, 4);
eq('…and the marks obtained', water.rows[1].awarded, 3);
eq('…and the topic\'s subtotal over all its rows', [water.total, water.awarded, water.n], [8, 4, 4]);
eq('a blank keeps its full marks and adds nothing obtained', [water.rows[0].total, water.rows[0].awarded, water.rows[0].blankMarks], [3, 0, 3]);
eq('…and is counted as blank, never wrong', [water.rows[0].blank, water.rows[0].wrong], [1, 0]);
eq('the rate is over what was ATTEMPTED', S.diagPct(water), 80);
eq('a row nothing was attempted on has no rate, not nought', S.diagPct(water.rows[0]), null);
eq('…and reads as untried', S.diagResult(water.rows[0]).text, 'Untried');
eq('80% is strong', S.diagResult(water).text, 'Strong');
eq('50% is getting there', S.diagResult(dg.groups[1]).text, 'Getting there');
eq('under 50% is revise', S.diagResult(dg.groups[2]).text, 'Revise');
eq('the same objective on two questions is one row', dg.groups[1].rows.length, 1);
eq('…counting both', dg.groups[1].rows[0].n, 2);
/* A worksheet marked BEFORE this existed carries no filing; its topics are
   placed by name at render time, so an old paper is not all "unlisted". */
setItems([mk({ topic: 'heat', verdict: 'wrong', marks: '0/1' }), mk({ topic: 'Something else', verdict: 'wrong', marks: '0/1' })]);
dg = S.reportDiagnostic();
eq('an old marking whose topic is a syllabus name is placed at render time', dg.groups[0].sylTopic, 'Heat');
eq('…with the list\'s spelling', dg.groups[0].topic, 'Heat');
eq('…and one that is not stays unlisted', dg.groups[1].onList, false);
S.wsMeta.subject = 'english';
dg = S.reportDiagnostic();
eq('a subject with no list has no list, and every topic is simply a topic', dg.hasList, false);
eq('…in the order the marking named them', dg.groups.map(g => g.topic), ['heat', 'Something else']);
S.wsMeta.subject = 'science';

/* The text copy is built from the same groups as the screen. */
const lines = S.diagAsText(S.reportDiagnostic().groups, { hasList: true });
ok('the text lists every topic', lines.length >= 2 && /Heat/.test(lines[0]));
ok('…with its marks and rate', /0\/1 marks/.test(lines[0]) && /0% · Revise/.test(lines[0]));
ok('…and says when a topic is off the list', /Not on the syllabus list/.test(lines[1]));
eq('the trend line runs oldest to newest', S.diagTrendText([{ awarded: 1, attempted: 2 }, { awarded: 0, attempted: 0 }, { awarded: 4, attempted: 4 }]), '50% → – → 100%');

section('The diagnostic — what is saved, and the long run');
setItems([
  dk({ number: '1', topic: 'Electrical Systems', sylTopic: 'Electrical Systems', lo: 'elec-cond', verdict: 'wrong', marks: '0/2' }),
  dk({ number: '2', topic: 'Kitchen chemistry', verdict: 'correct', marks: '1/1' })
]);
S.marking.runAt = 1700000000000;
let sum = S.diagSummary();
eq('the summary names the subject and level', [sum.subject, sum.level], ['science', 'P5']);
eq('…when it was marked', sum.at, 1700000000000);
eq('…one small row per topic-and-objective', sum.rows.length, 2);
eq('…with the topic key and objective id', [sum.rows[0].t, sum.rows[0].lo], ['Electrical Systems', 'elec-cond']);
eq('…and the numbers', [sum.rows[0].q, sum.rows[0].tot, sum.rows[0].got, sum.rows[0].att, sum.rows[0].no], [1, 2, 0, 2, 1]);
eq('an unlisted row keeps the model\'s wording so the long run can still name it', [sum.rows[1].t, sum.rows[1].n], ['', 'Kitchen chemistry']);
ok('a row is a handful of short fields, never the items', !('items' in sum.rows[0]) && JSON.stringify(sum).length < 400);
setItems([]);
eq('no marking is no summary, not an empty one', S.diagSummary(), null);
setItems(Array.from({ length: 200 }, (_, i) => dk({ number: String(i), topic: 'T' + i, verdict: 'wrong', marks: '0/1' })));
eq('the rows are capped, because the summary rides a document that also holds the body',
   S.diagSummary().rows.length, S.DIAG_ROWS_MAX);

/* Added up across worksheets, off the list's own fields. */
const list = [
  { name: 'Paper A', subject: 'science', diagnostic: { v: 1, subject: 'science', level: 'P5', at: 100, rows: [
      { t: 'Electrical Systems', n: 'Electrical Systems', lo: 'elec-cond', q: 1, tot: 2, got: 0, att: 2, ok: 0, half: 0, no: 1, blank: 0 },
      { t: 'Water and its 3 States', n: 'Water and its 3 States', lo: 'wat-evap', q: 2, tot: 4, got: 4, att: 4, ok: 2, half: 0, no: 0, blank: 0 },
      { t: '', n: 'Kitchen chemistry', lo: '', q: 1, tot: 1, got: 0, att: 1, ok: 0, half: 0, no: 1, blank: 0 } ] } },
  { name: 'Paper B', subject: 'science', diagnostic: { v: 1, subject: 'science', level: 'P5', at: 300, rows: [
      { t: 'Electrical Systems', n: 'Electrical Systems', lo: 'elec-cond', q: 2, tot: 4, got: 3, att: 4, ok: 1, half: 1, no: 0, blank: 0 },
      'junk', null ] } },
  { name: 'Sums', subject: 'math', diagnostic: { v: 1, subject: 'math', level: 'P5', at: 200, rows: [
      { t: 'P5.FR Fractions: Four Operations', n: 'Fractions: Four Operations', lo: 'P5.FR.2.6', q: 1, tot: 3, got: 1, att: 3, ok: 0, half: 1, no: 0, blank: 0 } ] } },
  { name: 'Unmarked', subject: 'science' },
  { name: 'Old', subject: 'science', diagnostic: { rows: [] } }
];
const subs = S.progressRows(list);
eq('one block per subject, science first', subs.map(s => s.subject), ['science', 'math']);
eq('a worksheet with no summary is not a paper', subs[0].papers, 2);
const elec = subs[0].rows.find(r => r.lo === 'elec-cond');
eq('an objective is added up across papers', [elec.papers, elec.n, elec.total, elec.awarded, elec.attempted], [2, 3, 6, 3, 6]);
eq('…with every verdict counted', [elec.correct, elec.partial, elec.wrong], [1, 1, 1]);
eq('…and its history oldest first', elec.history.map(h => h.name), ['Paper A', 'Paper B']);
eq('the rows come out in syllabus order', subs[0].rows.map(r => r.lo || r.topic), ['wat-evap', 'elec-cond', 'Kitchen chemistry']);
eq('a row the summary could not place is still there, by name', subs[0].rows[2].onList, false);
eq('a row that is not a row is skipped, not the paper', subs[0].rows.length, 3);
eq('the objective reads from the catalogue, never from the summary', elec.objective, 'Electrical conductors and insulators');
eq('a maths objective is placed the same way', subs[1].rows[0].topic, 'Fractions: Four Operations');
eq('what to work on is the weakest first', S.progressFocus(subs[0].rows).map(r => r.lo || r.topic), ['Kitchen chemistry', 'elec-cond']);
ok('…and never a strong one', S.progressFocus(subs[0].rows).every(r => S.diagPct(r) < S.DIAG_FOCUS_PCT));
eq('nothing at all is nothing', S.progressRows([]).length, 0);

section('The diagnostic — against index.html itself');
const runSrc = html.slice(html.indexOf('async function runMarking()'), html.indexOf('function markTally()'));
ok('the marking\'s system prompt carries the syllabus list',
   /system: MARK_SYS \+ markBlankRule\(\) \+ aiGrounding\('mark'\) \+ keyRuleBlock\(\) \+ tutorMethodRule\(\) \+\s*markSyllabusBlock\(wsMeta\.subject, wsMeta\.level\)/.test(runSrc));
ok('…and the fold is told the subject and level, or nothing is filed',
   /_markFoldRows\(\(res && res\.questions\) \|\| \[\], pageNums, marking\.items,\s*\{ subject: wsMeta\.subject, level: wsMeta\.level \}\)/.test(runSrc));
ok('the reply shape asks for the objective id', /"lo":"the learning objective/.test(html));
const saveSrc = html.slice(html.indexOf('async function performSave('), html.indexOf('function applyWorksheetBody('));
ok('the summary rides every save beside the score', /score: scoreOf\(\),[\s\S]{0,300}diagnostic: diagSummary\(\),/.test(saveSrc));
ok('a filed mistake carries its objective', /lo: it\.lo \|\| '',\s*sylTopic: it\.sylTopic \|\| '',/.test(html));
ok('the report draws the table', /body\.appendChild\(diagTableNode\(dg\.groups/.test(html));
ok('…and the copy prints it', /DIAGNOSTIC — BY TOPIC AND LEARNING OBJECTIVE/.test(html));
ok('📈 My progress is on the home screen and wired', /id="progressBtn"/.test(html) && /\$\('progressBtn'\)\.addEventListener\('click', openProgress\)/.test(html));
ok('…prints through the ONE door', /printThis\(\$\('progressModal'\)\)/.test(html));
ok('the print rules key off .printMe, never the report\'s id',
   !/#reportModal[^\n]*\{/.test(html.slice(html.indexOf('@media print'), html.indexOf('@media print') + 4000)) &&
   /\.modalBack\.printMe \.modalFoot \{ display: none !important; \}/.test(html));
ok('there is still no second AI call anywhere in the diagnostic',
   !/askGemini/.test(html.slice(html.indexOf('THE DIAGNOSTIC — every question filed'), html.indexOf('/* ================= The mistake book'))));

/* =====================================================================
   👉 THE TUTOR POINTS AT THE PAGE
   ===================================================================== */
section('The tutor\'s finger');

/* THE ONE READER OF A POSITION. A gesture goes through the marking's own
   `_markAt`, so a point the tick would refuse this refuses too — and neither
   is ever clamped, because a clamped point is a guess and a finger on the
   wrong question is worse than no finger at all. */
eq('a good point becomes a gesture',
   S.tutorPointMake({ at: [400, 300], shape: 'underline' }, 2),
   { page: 2, shape: 'underline', at: { y: 400, x: 300 }, to: null });
eq('…and a second point rides with it',
   S.tutorPointMake({ at: [400, 300], to: [400, 700], shape: 'box' }, 1).to, { y: 400, x: 700 });
ok('a point off the page is REFUSED, never clamped onto it',
   S.tutorPointMake({ at: [400, 1400] }, 1) === null &&
   S.tutorPointMake({ at: [-1, 300] }, 1) === null,
   'a finger on the wrong question is worse than no finger');
ok('a malformed point is refused',
   S.tutorPointMake({ at: 'somewhere' }, 1) === null &&
   S.tutorPointMake({}, 1) === null &&
   S.tutorPointMake(null, 1) === null);
ok('a gesture with no page is refused',
   S.tutorPointMake({ at: [400, 300] }, 0) === null &&
   S.tutorPointMake({ at: [400, 300] }, undefined) === null,
   'a page nobody named is a gesture that would be drawn on every page or none');
eq('an invented shape becomes the circle, which claims the least',
   S.tutorPointShape('spiral'), 'circle');
eq('…and so does a missing one', S.tutorPointShape(undefined), 'circle');
eq('…while a real one survives, however it was written',
   ['CIRCLE', ' Underline ', 'arrow', 'box'].map(S.tutorPointShape),
   ['circle', 'underline', 'arrow', 'box']);

/* ONE POINT STILL HAS TO LOOK DELIBERATE. A model that names a spot and no
   second point is the ordinary case — it knows where the question is, not
   how wide the words are — so every shape has a fallback size, and a shape
   that came out as a dot would read as one that failed. */
const tpW = 1000, tpH = 1400;
const geom = (spec, page) => S.tutorPointGeom(S.tutorPointMake(spec, page || 1), tpW, tpH);

const uOne = geom({ at: [500, 100], shape: 'underline' });
ok('a one-point underline is a rule of real width', uOne.x2 - uOne.x1 > tpW * 0.1, JSON.stringify(uOne));
ok('…and it is LEVEL', uOne.y1 === uOne.y2);
const uBox = geom({ at: [500, 100], to: [560, 600], shape: 'underline' });
ok('an underline handed the far corner of a BOX still runs level, on the first point\'s line',
   uBox.y1 === uBox.y2 && uBox.y1 === tpH * 0.5 && uBox.x2 === tpW * 0.6,
   'a rule that sloped down the page reads as a line struck THROUGH the words');
const uBack = geom({ at: [500, 600], to: [500, 100], shape: 'underline' });
ok('…and one given back-to-front is turned round rather than drawn backwards',
   uBack.x1 < uBack.x2 && uBack.x1 === tpW * 0.1);

const aOne = geom({ at: [500, 500], shape: 'arrow' });
ok('an arrow\'s HEAD is the spot, always', aOne.x2 === tpW * 0.5 && aOne.y2 === tpH * 0.5,
   'an arrow points AT the thing; a tail that had to be supplied would make every one-point arrow useless');
ok('…and its tail is somewhere else', Math.abs(aOne.x1 - aOne.x2) > tpW * 0.05);
const aFlat = geom({ at: [500, 500], to: [500, 501], shape: 'arrow' });
ok('an arrow whose two points are the same point is still an arrow',
   Math.abs(aFlat.x1 - aFlat.x2) > tpW * 0.05, JSON.stringify(aFlat));

const bOne = geom({ at: [500, 500], shape: 'box' });
ok('a one-point box is centred on the spot',
   Math.abs((bOne.x + bOne.w / 2) - tpW * 0.5) < 0.001 && Math.abs((bOne.y + bOne.h / 2) - tpH * 0.5) < 0.001);
ok('…and has a real size', bOne.w > tpW * 0.1 && bOne.h > tpH * 0.01);
const bTwo = geom({ at: [400, 700], to: [300, 200], shape: 'box' });
ok('a box given its corners the wrong way round still has positive sides',
   bTwo.w > 0 && bTwo.h > 0 && bTwo.x === tpW * 0.2 && bTwo.y === tpH * 0.3, JSON.stringify(bTwo));

const cOne = geom({ at: [500, 500], shape: 'circle' });
ok('the circle is an ELLIPSE, wider than it is tall', cOne.rx > cOne.ry,
   'what it goes round is a line of words, not a dot');
ok('…centred on the spot', cOne.cx === tpW * 0.5 && cOne.cy === tpH * 0.5);

ok('a gesture on a page of no size is refused rather than drawn at the origin',
   S.tutorPointGeom(S.tutorPointMake({ at: [500, 500] }, 1), 0, 0) === null);
ok('every shape yields a path', ['circle', 'underline', 'arrow', 'box']
   .every(k => { const d = S.tutorPointPaths(geom({ at: [500, 500], shape: k })); return d && d.shaft.length > 8; }));
ok('…and only the arrow grows a head',
   !!S.tutorPointPaths(geom({ at: [500, 500], shape: 'arrow' })).head &&
   !S.tutorPointPaths(geom({ at: [500, 500], shape: 'circle' })).head);

/* THE ONE WRITER. The epoch stamp is what stops a gesture about the last
   worksheet standing over this one — the rule the quiz and the maths pad
   already carry — and it is stamped on SHOW rather than on MAKE, so a
   gesture saved on a hint can be put back up months later. */
S.wsEpoch = 7;
ok('showing a gesture stamps it with the worksheet it is on',
   S.tutorPointShow(S.tutorPointMake({ at: [100, 100] }, 1)) === true && S.tutorPoint.epoch === 7);
ok('…and the maker itself carries no epoch at all',
   S.tutorPointMake({ at: [100, 100] }, 1).epoch === undefined,
   'a hint keeps its gesture for months; an epoch baked in would be stale the next time it opened');
ok('a gesture that could not be read leaves the one on the page alone',
   S.tutorPointShow(null) === false && S.tutorPoint !== null,
   'a marker nobody could parse must not take down the finger already pointing');
S.tutorPointClear();
ok('…and clearing takes it down', S.tutorPoint === null);

/* =====================================================================
   …and against index.html itself
   ===================================================================== */
section('The tutor\'s finger, against index.html itself');

const POINT_SRC = between('\n   \u{1F449} THE TUTOR POINTS AT THE PAGE',
                          '/* ================= End the tutor\'s finger', 'the tutor\'s finger');

/* THE ONE THAT MATTERS. A gesture in `annotations` is read by the NEXT
   marking run as the student's own work — the paper marks itself against a
   circle the tutor drew, and no screen anywhere says why. */
ok('the gesture is NEVER pushed into annotations',
   !/annotations\.push|annotations\s*=/.test(POINT_SRC),
   'a tutor\'s circle in `annotations` is marked as the student\'s own answer');
ok('…and the flatten the marking reads never draws it',
   !/data-point|tutorPoint/.test(html.slice(html.indexOf('function drawAnnsOnCtx('),
                                            html.indexOf('/* A full-width band of the page'))),
   'drawAnnsOnCtx is what the marking run and the mistake book see');
ok('…and it is not in what gets SAVED',
   !/tutorPoint/.test(html.slice(html.indexOf('function worksheetBody('),
                                 html.indexOf('function worksheetBody(') + 1600)));
ok('it lives in the page SVG as its own node, beside the marking\'s ticks',
   /g\[data-point\]/.test(POINT_SRC) && /'data-point': want/.test(POINT_SRC));
/* `renderOverlay` rebuilds the whole layer on EVERY committed stroke. A node
   rebuilt with it restarts its fade-in, so the finger flashes each time the
   child writes a word — which reads as the app blinking at them. */
ok('a gesture already on the page is left alone when the overlay rebuilds',
   /had\[0\]\.getAttribute\('data-point'\) === want\) return;/.test(POINT_SRC));
/* …and being left alone is only worth anything if the node was never
   DETACHED: taking one out of the document cancels its CSS animation, so
   lifting it out and putting it back flashes exactly as a rebuild does. */
ok('…and the overlay\'s wipe steps over it rather than detaching it',
   /var tutorNodes = Array\.prototype\.slice\.call\(svg\.querySelectorAll\('g\[data-point\], g\[data-work\]'\)\);/.test(html) &&
   /if \(tutorNodes\.indexOf\(n\) === -1\) svg\.removeChild\(n\);/.test(html) &&
   !/while \(svg\.firstChild\) svg\.removeChild\(svg\.firstChild\);/.test(html),
   'a detached node flashes its way back in every time the child commits a stroke');
ok('…and it is drawn UNDER the student\'s own ink',
   /svg\.insertBefore\(g, svg\.firstChild\);/.test(POINT_SRC) && !/svg\.appendChild\(g\);/.test(POINT_SRC),
   'a finger over a child\'s answer covers the work it is meant to be helping with');
ok('…and the zoom is part of what it is, because the stroke width is baked in',
   /pt\.made \+ ':' \+ Math\.round\(Math\.max\(0\.25, scale\) \* 100\)/.test(POINT_SRC));
ok('…and the breathe SETTLES rather than pulsing for ever',
   /animation: tpBreathe [\d.]+s ease-in-out 3 both;/.test(html),
   'a shape pulsing beside the question a child is working on is one they stop being able to ignore');

/* `pointer-events: none` is the rule `#liveSubs` carries, and for the same
   reason: this sits over a page a child writes on with a stylus. */
ok('it can never swallow a stroke',
   /'pointer-events': 'none'/.test(POINT_SRC) && /\.tutorPoint \{ pointer-events: none;/.test(html));
ok('NOTHING here sets a timer',
   !/setTimeout|setInterval/.test(POINT_SRC),
   'it comes down when the tutor MOVES ON, which is what a real finger does');
ok('the epoch is checked before it is painted',
   /pt\.epoch === wsEpoch && pt\.page === p\.num/.test(POINT_SRC),
   'a gesture about the last worksheet standing over this one is the fault every floating box here guards against');
ok('the ink is sized in screen pixels over the zoom, like the pins',
   /3\.6 \/ Math\.max\(0\.25, scale\)/.test(POINT_SRC),
   'a finger that grew with the zoom would cover the question at 400%');
ok('it is painted from renderOverlay, the one function every rebuild goes through',
   /renderPinsOn\(p\);\n\s*renderMarksOn\(p\);\n\s*renderTutorPointOn\(p\);/.test(html));

/* IT COMES DOWN WHEN THE TUTOR MOVES ON, and every one of these is a moment
   it has. Miss one and a finger points at a question nobody is on. */
ok('a new worksheet takes it off', /wsEpoch\+\+;[\s\S]{0,400}?tutorMarksClear\(\);/.test(html));
ok('leaving the worksheet takes it off', /if \(v !== 'ws'\)[^\n]*tutorMarksClear\(\);/.test(html));
ok('the session ending takes it off',
   /liveTutor\.phase = 'closing';\n\s*liveSubsClear\(\);\n\s*tutorMarksClear\(\);/.test(html));
ok('asking for a new hint takes it off BEFORE the new one is built',
   html.indexOf('tutorMarksClear();', html.indexOf('async function askHintAt')) <
   html.indexOf('hints.push(h);', html.indexOf('async function askHintAt')),
   'a finger on the last question while "Thinking…" is up points at the wrong thing');
ok('and a new spoken question takes it off too',
   /liveStatus\('Thinking…'\);[\s\S]{0,400}?tutorMarksClear\(\);/.test(html));
/* ONE clear for BOTH marks, and every one of those five call sites reaches it.
   Two clear functions with five call sites each is ten chances to forget one,
   and what is forgotten is silent. */
ok('…and that ONE clear takes BOTH the finger and the working down',
   /function tutorMarksClear\(\) \{\n\s*tutorPointClear\(\);\n\s*tutorWorkClear\(\);\n\}/.test(html),
   'a note about a step, left standing beside a question nobody is on any more');
ok('…and nothing but that one function calls either half',
   (html.match(/tutorPointClear\(\)/g) || []).length === 2 &&
   (html.match(/tutorWorkClear\(\)/g) || []).length === 2,
   'one declaration and exactly one caller each — the shared clear');

/* THE TWO PRODUCERS. A hint carries its gesture in the JSON it already asks
   for; the live tutor opens its spoken reply with a marker. Both are told
   the same thing about being sure. */
ok('the hint ladder asks for a point',
   /"point":\{"at":\[412,300\]/.test(html) && /POINTING AT THE PAGE/.test(html));
ok('…and reads it back through the ONE maker',
   /point: tutorPointMake\(res\.point, p\.num\)/.test(html));
ok('…and keeps it ON the hint, so it is saved and can be shown again',
   /h\.point = out\.point; tutorPointShow\(out\.point\);/.test(html) &&
   /\u{1F449} Show me where to look/u.test(html));
ok('…and the hints are saved WHOLE, so the gesture travels with them',
   /hints: hints,/.test(html.slice(html.indexOf('function worksheetBody()'),
                                   html.indexOf('function bodyByteLength'))));
/* Only the BUTTON scrolls. A live reply points at the page the student is
   already looking at, and a worksheet that scrolled itself while a child was
   writing on it would be the app taking the page away from them. */
ok('only an explicit "show me where" brings the page into view',
   /var shown = tutorPointShow\(h\.point\);[\s\S]{0,160}?if \(shown\) tutorPointReveal\(\);/.test(html) &&
   (html.match(/tutorPointReveal\(\)/g) || []).length === 2,
   'tutorPointReveal is its own declaration plus exactly one caller');
ok('…and the button puts the WORKING back with the finger',
   /if \(h\.work\) tutorWorkShow\(h\.work\);/.test(html),
   'half an explanation put back is a note about a step with nothing pointing at the question');
const HINT_SYS_SRC = between('var HINT_SYS =', 'function hintPromptFor(', 'the hint system prompt');
const LIVE_SYS_SRC = between('You support a live voice tutor.', 'onProgress: function ()', 'the live system prompt');
ok('BOTH prompts refuse to guess',
   /a finger on the wrong question is worse/.test(HINT_SYS_SRC) &&
   /a finger on the wrong question is worse/.test(LIVE_SYS_SRC),
   'a gesture placed on a guess teaches the wrong question with a straight face');
ok('\u2026and both measure on the same 0\u20131000 grid the marking\'s ticks use',
   /0 to 1000/.test(HINT_SYS_SRC) && /0\u20131000 grid/.test(LIVE_SYS_SRC) && /0 to 1000/.test(html.slice(html.indexOf('var MARK_WHERE_RULE'), html.indexOf('var MARK_SYS'))),
   'two grids is a finger that lands somewhere else on one of the two paths');
ok('\u2026and both offer the same four shapes',
   /"circle", "underline", "arrow" or "box"/.test(HINT_SYS_SRC) &&
   /circle, underline, arrow or box/.test(LIVE_SYS_SRC));
ok('the hint is told to point at the QUESTION, never the answer',
   /Point at the QUESTION, never at the answer/.test(html));


/* =====================================================================
   WHY LIVE TUTORING SAID NO
   ===================================================================== */
section('Why live tutoring said no');

ok('the endpoint\u2019s own reason wins over the status map',
   /throw new Error\(liveErrorText\(data\) \|\| messages\[response\.status\]/.test(html),
   'three different 429s all read "busy, try again in a little while" and after the sixth lesson that was never going to come true');
ok('\u2026and the map is still there for a refusal with no body of ours',
   /429: 'Live tutoring is busy\. Please try again in a little while\.'/.test(html),
   'a proxy page, a 502, a blocked response');
ok('what comes back off the network is bounded before it is shown',
   /\.replace\(\/\\s\+\/g, ' '\)\.trim\(\)\.slice\(0, 240\)/.test(
     between('function liveErrorText(data) {', 'function closeLiveRemote(', 'the live error reader')));

/* =====================================================================
   ⏱ THE RATIONS ARE OFF, AND THE CARD READS THE SERVER'S OWN NUMBER
   =====================================================================
   Three numbers stood between a child and the live tutor and all three
   are `0` now. The fourth — how long ONE lesson lasts — is not a ration
   and is not removed: the lease expiry, the scheduled sweep and the
   stale-slot rule are all built on it, so an endless one is a paid call
   nothing ever closes.
   ===================================================================== */
const LIVE_SVC = readFileSync(new URL('../functions/live-service.js', import.meta.url), 'utf8');
const LIVE_REPO = readFileSync(new URL('../functions/live-repository.js', import.meta.url), 'utf8');

ok('the three rations are written off, as 0',
   /startsPerDay:\s*0\b/.test(LIVE_SVC) && /globalStartsPerDay:\s*0\b/.test(LIVE_SVC) &&
   /concurrent:\s*0\b/.test(LIVE_SVC),
   'a student told to come back at midnight is the fault this removes');
ok('…and the session’s own length is NOT one of them',
   /durationSeconds:\s*(?!0\b)\d+/.test(LIVE_SVC),
   'a lease with no end is a paid call nobody closes and a bill that runs all night');
ok('every refusal asks capOn first, so a 0 really is off',
   (LIVE_REPO.match(/capOn\(policy\./g) || []).length === 3,
   'one refusal left unguarded is the whole change quietly not happening');
ok('the duration is CLAMPED rather than trusted, and by typeof',
   /typeof n !== 'number' \|\| !Number\.isFinite\(n\)/.test(LIVE_SVC) &&
   /Math\.min\(DURATION_MAX, Math\.max\(DURATION_MIN/.test(LIVE_SVC),
   'Number(null) is 0, so coercing a missing field hands every child a one-minute lesson');
ok('the account’s own lock carries the moment it was taken',
   /leaseAt: now/.test(LIVE_REPO) && /Number\(ownerData\.leaseAt\) > staleBefore/.test(LIVE_REPO),
   'a tab closed mid-lesson left currentLease set, and every later start on that account was refused for ever');
/* Read off the THROWS, never the whole file: this section's own comments
   quote the wording being retired, and a check that matched its own
   documentation would go red on the fix and green on the fault. */
const LIVE_THROWS = (LIVE_REPO.match(/throw new LiveError\([\s\S]*?\);/g) || []).join('\n');
ok('the two centre-wide ceilings answer differently',
   /'live_busy'/.test(LIVE_THROWS) && /'daily_limit'/.test(LIVE_THROWS) &&
   !/busy or has reached today/.test(LIVE_THROWS),
   '"in a few minutes" and "at midnight" are different things to be told');

ok('the reply reports the CLAMPED length, never the raw constant',
   /maxDurationSeconds: liveDuration\(/.test(LIVE_SVC),
   'the card would then count towards a number the lease does not end at');
ok('the card reads how long a lesson is off the start reply',
   /liveTutor\.maxSeconds = Number\(answer\.maxDurationSeconds\)/.test(html),
   'maxDurationSeconds was in the reply all along and was thrown away');
const CLOCK_SRC = between("$('liveClock').textContent =", "$('liveHelpLevel').textContent", 'the live clock');
ok('…and no literal ceiling is typed into the clock',
   !/10:00|Up to 10 minutes/.test(CLOCK_SRC) && /liveClockText\(liveMaxSeconds\(\)\)/.test(CLOCK_SRC),
   'the lesson became an hour and the clock still counted towards ten minutes');
ok('a junk length can never SHRINK the clock',
   /Number\.isFinite\(n\) && n >= 1 \? Math\.floor\(n\) : LIVE_MAX_SECONDS_DEFAULT/.test(html),
   'a caption counting towards a number the session does not end at is worse than no caption');

/* ---------------------------------------------------------------------
   …AND MERGING IS WHAT DEPLOYS THE OTHER HALF (v1.33.1)
   ---------------------------------------------------------------------
   Pages ships `index.html` the moment a pull request merges. `functions/`
   only ever reached students through somebody remembering to run
   `firebase deploy`, so the two halves drifted — and drifted silently: the
   card said "Up to 1 hour" while the endpoint was still refusing a seventh
   lesson with wording v1.32.0 had replaced. The whole of the block above
   was live on the page and none of it was live on the server.

   The one change here that could do real damage is the SCOPE.
   `mathgen--app` is shared: the Maths repo's askOpenAi / askKimi run on
   the same project, so a deploy that stopped naming this codebase — or
   that gained `--force` — would take another app's functions off it with
   nothing in this repository to say why.
   --------------------------------------------------------------------- */
const WF_DEPLOY = readFileSync(new URL('../.github/workflows/deploy-functions.yml', import.meta.url), 'utf8');
const WF_CHECKS = readFileSync(new URL('../.github/workflows/checks.yml', import.meta.url), 'utf8');

/* Read the deploy STEP, never the whole file — this block's own comments
   name the flag they forbid, and a check that matched its documentation
   would go green on the fault and red on the fix. Twice now this harness
   has had to learn that (LIVE_THROWS, CLOCK_SRC), and once out loud.
   It is the WHOLE step and not `npx …--non-interactive`: a slice that
   stops at whichever flag happens to be last is a slice a new flag falls
   outside of, and the --force mutant went straight through it. */
const DEPLOY_RUN = ((WF_DEPLOY.match(/name: Deploy the study-buddy-live codebase[\s\S]*?(?=\n      - name:|$)/) || [''])[0])
  .split('\n').filter(l => !l.trim().startsWith('#')).join('\n');

ok('merging main deploys the functions too',
   /branches:\s*\[main\]/.test(WF_DEPLOY) && /'functions\/\*\*'/.test(WF_DEPLOY) &&
   /firebase-tools@\d+\s+deploy/.test(DEPLOY_RUN),
   'the card was a version ahead of the server it was talking to, and nothing said so');
ok('…scoped to this codebase, on a SHARED project',
   /--only\s+'functions:study-buddy-live'/.test(DEPLOY_RUN) &&
   /--project mathgen--app/.test(DEPLOY_RUN),
   'an unscoped deploy reaches the Maths repo’s askOpenAi / askKimi on the same project');
ok('…and never --force',
   !/--force/.test(DEPLOY_RUN),
   '--force deletes whatever the run did not name, which here is another app’s functions');
ok('a missing deploy key WARNS and skips, and never fails the run',
   /::warning title=Functions not deployed/.test(WF_DEPLOY) &&
   /steps\.key\.outputs\.ready == 'yes'/.test(WF_DEPLOY),
   'a red tick on every merge is a red tick people learn to ignore');
ok('the key is shredded whatever happened',
   /if: always\(\)[\s\S]*?rm -f "\$RUNNER_TEMP\/sa\.json"/.test(WF_DEPLOY),
   'a service-account JSON left on a runner is a key left on a runner');
ok('and the functions’ own tests run on every pull request',
   /node --test functions\/test\/\*\.test\.js/.test(WF_CHECKS),
   'they had never run in CI at all, so the half that decides whether a child gets a lesson was unchecked');

/* =====================================================================
   📕 THE MISTAKE BOOK, FILED UNDER THE SYLLABUS
   =====================================================================
   The book was one grid, newest first, behind three chips. After a term
   that is forty cards in no order at all — a list nobody can find anything
   in, which is the same fault the book itself exists to answer.
   ===================================================================== */
section('The mistake book, filed');

const BOOK_SRC = between('\u{1F4D5} THE MISTAKE BOOK, FILED UNDER THE SYLLABUS',
                         'function pracPruneSel()', 'the filed mistake book');

/* A mistake filed by THIS version carries the objective the marking placed
   it under; one filed before carries a topic the marking NAMED and nothing
   else, and `diagItemPlace` places that BY NAME at read time. That is what
   files a whole term's book with no migration running anywhere. */
const heatLo = S.syllabusEntries('science').find(e => e.id === 'heat-flow') ||
               S.syllabusEntries('science').find(e => e.level === 'P5');
const book = (over) => Object.assign({
  id: 'm1', subject: 'science', level: 'P5', docName: 'Term 1 Paper 2',
  number: '12', question: 'Why did the metal spoon feel cold?',
  studentAnswer: 'because metal is cold', feedback: 'Think about where the heat went.',
  verdict: 'wrong', cleared: false, blocks: [], options: []
}, over || {});

S.mistakes = [book({ id: 'a', lo: heatLo.id, sylTopic: heatLo.tkey })];
ok('a mistake filed with its objective keeps it',
   S.mistPlace(S.mistakes[0]).lo === heatLo.id && S.mistPlace(S.mistakes[0]).onList === true);
ok('…and the wording comes from the CATALOGUE, never from the stored row',
   S.mistPlace(S.mistakes[0]).topic === heatLo.topic &&
   S.mistPlace(S.mistakes[0]).loTitle === heatLo.title,
   'an objective renamed in the syllabus is renamed on every card ever filed under it');

S.mistakes = [book({ id: 'b', lo: '', sylTopic: '', topic: heatLo.topic })];
ok('a mistake filed BEFORE any of this is placed by name at read time',
   S.mistPlace(S.mistakes[0]).sylTopic === heatLo.tkey,
   'a term’s book files itself the first time it is opened, with no migration');

S.mistakes = [book({ id: 'c', lo: 'not-a-real-objective', sylTopic: '', topic: 'Something nobody taught' })];
ok('an objective this build has never heard of is shown UNPLACED',
   S.mistPlace(S.mistakes[0]).onList === false && S.mistPlace(S.mistakes[0]).topic === 'Something nobody taught',
   'a row filed under a heading somebody else’s question is in is a lesson filed wrongly for good');

S.mistakes = [book({ id: 'd', subject: '' })];
ok('a mistake with no subject files under one heading of its own',
   S.mistSubjectKey(S.mistakes[0]) === S.MIST_NO_SUBJECT &&
   S.mistSubjectLabel(S.MIST_NO_SUBJECT) === 'No subject');

/* THE SEARCH reads everything the card can SHOW. A question set out in
   BLOCKS keeps its wording there rather than in `question`, so a haystack
   that stopped at `question` would make every rebuilt question — the good
   ones — the only ones nobody can find. */
S.mistakes = [book({ id: 'e', question: '', blocks: [{ type: 'text', text: 'The beaker was heated gently.' }] })];
ok('the search reads a question set out in blocks',
   S.mistHaystack(S.mistakes[0]).indexOf('beaker') >= 0);
S.mistakes = [book({ id: 'f' })];
const hay = S.mistHaystack(S.mistakes[0]);
ok('…and what they wrote, what the buddy said, the paper and the topic',
   ['metal is cold', 'where the heat went', 'term 1 paper 2', heatLo.topic.toLowerCase()]
     .every(t => hay.indexOf(t) >= 0));

S.mistakes = [book({ id: 'g', question: 'heat travels through metal' })];
S.mistQuery = 'heat metal';
ok('every term has to appear, so a second word NARROWS',
   S.mistakesShown().length === 1);
S.mistQuery = 'heat rabbit';
ok('…and a term that appears nowhere leaves nothing',
   S.mistakesShown().length === 0,
   'a second word that WIDENED is a search box nobody uses twice');
S.mistQuery = '';

/* THE ORDER THE BOOK READS IN, and the flat list is that same order: the
   practice session then works DOWN the book rather than hopping about it. */
const maths = S.syllabusEntries('math')[0];
S.mistakes = [
  book({ id: 'm-new', subject: 'math', level: maths.level, lo: maths.id, sylTopic: maths.tkey, cleared: false }),
  book({ id: 's-late', subject: 'science', lo: '', sylTopic: '', topic: 'Not on any list' }),
  book({ id: 's-first', subject: 'science', lo: heatLo.id, sylTopic: heatLo.tkey })
];
eq('subjects come in the app’s own order, and an unplaced topic is LAST',
   S.mistakesShown().map(m => m.id), ['s-first', 's-late', 'm-new']);
ok('the sections are cut out of that SAME ordered list',
   JSON.stringify(S.mistGroups(S.mistakesShown()).map(g => [g.key, g.n])) ===
   JSON.stringify([['science', 2], ['math', 1]]));
ok('…and `mistGroups` filters nothing at all',
   S.mistGroups(S.mistakesShown()).reduce((n, g) => n + g.n, 0) === 3,
   'a group that quietly dropped a card is a book that prints more questions than it shows');
ok('…and it is PURE — no DOM, no filtering, no re-reading the filters',
   !/document\.|mistFilter|mistQuery|mistakes\b/.test(
     between('function mistGroups(list, flat) {', 'function mistFacet(', 'mistGroups')));

/* =====================================================================
   🕒 NEWEST FIRST — the other question the book is opened with
   ---------------------------------------------------------------------
   📚 By topic is the syllabus's own order and is what revising reads DOWN.
   It is the wrong shape entirely for "what did I just get wrong?", because
   the paper marked a minute ago is scattered across whichever headings its
   questions belong to. Every failure here is silent and the book still
   paints.
   ===================================================================== */
section('The mistake book, newest first');

const stamp = (ms) => ({ toMillis: () => ms });
S.mistakes = [
  book({ id: 'newest', subject: 'math', level: maths.level, lo: maths.id, sylTopic: maths.tkey,
         createdAt: stamp(3000) }),
  book({ id: 'middle', subject: 'science', lo: '', sylTopic: '', topic: 'Not on any list',
         createdAt: stamp(2000) }),
  book({ id: 'oldest', subject: 'science', lo: heatLo.id, sylTopic: heatLo.tkey,
         createdAt: stamp(1000) })
];

eq('the default is still the syllabus order, byte for byte',
   S.mistakesShown().map(m => m.id), ['oldest', 'middle', 'newest']);

S.mistSort = 'new';
eq('🕒 newest first puts the paper just marked at the top',
   S.mistakesShown().map(m => m.id), ['newest', 'middle', 'oldest'],
   'a student opens the book to see what they have just got wrong');

/* IT READS THE STAMP, NOT THE ORDER THE READ ARRIVED IN. `loadMistakes`
   asks for `createdAt` descending, so the array index already IS that order
   today — and a sort leaning on it would quietly become something else the
   day that query changed, under a chip still reading "Newest first". */
S.mistakes = [
  book({ id: 'b-old', createdAt: stamp(1000) }),
  book({ id: 'a-new', createdAt: stamp(9000) })
];
eq('…off the STAMP, even when the list arrives the other way round',
   S.mistakesShown().map(m => m.id), ['a-new', 'b-old'],
   'the stamp is the fact; the index is only the tie-break');

/* TWO QUESTIONS FILED IN ONE MARKING RUN share a stamp, so the tie-break is
   what keeps them in PAPER order under it rather than in whatever order the
   read happened to hand them back. */
S.mistakes = [
  book({ id: 'q7', number: '7', createdAt: stamp(5000) }),
  book({ id: 'q9', number: '9', createdAt: stamp(5000) })
];
eq('…and one marking run stays in paper order under it',
   S.mistakesShown().map(m => m.id), ['q7', 'q9']);

/* A MISTAKE FILED BEFORE `createdAt` EVER RESOLVED still has to sort. A
   stamp that will not read is 0, which files it LAST rather than throwing
   the render — the rule `shelfStamp` already follows for the bookcase. */
S.mistakes = [
  book({ id: 'no-stamp' }),
  book({ id: 'stamped', createdAt: stamp(1) })
];
eq('a row with no readable stamp sorts last, never throws',
   S.mistakesShown().map(m => m.id), ['stamped', 'no-stamp']);

/* ONE LIST, NEVER GROUPED. Cut into subjects and topics, the card the
   student opened the book to see is buried under whichever heading it
   belongs to — which is the whole thing this sort exists to avoid. */
S.mistakes = [
  book({ id: 'n-math', subject: 'math', level: maths.level, lo: maths.id, sylTopic: maths.tkey,
         createdAt: stamp(3000) }),
  book({ id: 'n-sci', subject: 'science', lo: heatLo.id, sylTopic: heatLo.tkey,
         createdAt: stamp(2000) })
];
const flatG = S.mistGroups(S.mistakesShown(), true);
ok('the chronological list is ONE nameless section, so no heading is drawn',
   flatG.length === 1 && flatG[0].topics.length === 1 && flatG[0].label === '' &&
   flatG[0].topics[0].label === '',
   'renderMistList draws a heading only when there is more than one — a flat list needs no second renderer');
eq('…in exactly the order it was handed, and filtering nothing',
   flatG[0].topics[0].items.map(m => m.id), ['n-math', 'n-sci']);
ok('an empty list is no section at all', S.mistGroups([], true).length === 0);
ok('called WITHOUT the flag it is byte-for-byte the grouped book it was',
   JSON.stringify(S.mistGroups(S.mistakesShown()).map(g => g.key)) ===
   JSON.stringify(S.mistGroups(S.mistakesShown(), false).map(g => g.key)) &&
   S.mistGroups(S.mistakesShown()).length === 2,
   'every centre that never touches the chip must read the same book it always did');

/* A SORT HIDES NOTHING, so ✕ Clear the filters must not light up for one,
   and the empty state must not blame a filter nobody set. */
ok('a sort is NOT a filter', S.mistFiltered() === false);

ok('the two sorts are offered as chips, on a row of their own',
   /var MIST_SORTS = \[\['topic', '📚 By topic'\], \['new', '🕒 Newest first'\]\];/.test(html) &&
   /MIST_SORTS\.forEach\(function \(f\) \{\s*mistChip\(sortRow, f\[1\], mistSort === f\[0\]/.test(html),
   'folded in beside the status chips, "Sorted" and "Newest first" are two kinds of answer wearing one shape');
ok('…drawn only when there is something to order',
   /if \(mistakes\.length > 1\) \{\s*var sortRow/.test(html));
ok('…and the renderer passes the flag through',
   /var groups = mistGroups\(show, mistSort === 'new'\);/.test(html));
ok('the sort is remembered NOWHERE, the rule the filters follow',
   !/localStorage[^\n]*mistSort|mistSort[^\n]*localStorage/.test(html));
S.mistSort = 'topic';

// Back to the book the filter cases below were written against.
S.mistakes = [
  book({ id: 'm-new', subject: 'math', level: maths.level, lo: maths.id, sylTopic: maths.tkey, cleared: false }),
  book({ id: 's-late', subject: 'science', lo: '', sylTopic: '', topic: 'Not on any list' }),
  book({ id: 's-first', subject: 'science', lo: heatLo.id, sylTopic: heatLo.tkey })
];

/* THE FILTERS all go through `mistakesShown`, which is still the ONE place
   the visible set is worked out — ✏️ Practise all and 🖨 the sheet both read
   it, and every button that says "all" means every card the student can
   SEE. */
S.mistSubject = 'math';
eq('the subject filter narrows the ONE visible set', S.mistakesShown().map(m => m.id), ['m-new']);
S.mistSubject = 'all';
S.mistTopic = heatLo.tkey;
eq('…and so does the topic', S.mistakesShown().map(m => m.id), ['s-first']);
S.mistTopic = 'all';
S.mistLo = heatLo.id;
eq('…and the objective', S.mistakesShown().map(m => m.id), ['s-first']);
S.mistLo = 'all';

/* A PICKER IS COUNTED AGAINST THE FILTERS ABOVE IT AND NEVER ITS OWN, or
   choosing a topic hides every other topic out of the very list it was
   chosen from. */
S.mistTopic = heatLo.tkey;
ok('the topic picker still offers every topic once one is chosen',
   S.mistTopicFacet().length === 3, JSON.stringify(S.mistTopicFacet().map(f => f.key)));
S.mistTopic = 'all';
S.mistSubject = 'math';
ok('…but it is narrowed by the SUBJECT above it',
   S.mistTopicFacet().length === 1);
S.mistSubject = 'all';

/* A CHOICE THAT IS NO LONGER ON OFFER FALLS BACK, rather than leaving a
   book that shows nothing and says only "try another filter". */
S.mistTopic = 'a topic no card carries any more';
S.mistPruneFilters();
ok('a topic that has gone falls back to "all"', S.mistTopic === 'all');
S.mistSubject = 'english';
S.mistPruneFilters();
ok('…and so does a subject', S.mistSubject === 'all');
/* AND IT IS DONE ON EVERY PAINT, BEFORE THE BAR IS DRAWN. Deleting the
   last card of a topic is the ordinary way a filter goes stale, and it
   goes stale in the one place nobody is looking — so a prune that is only
   ever called by hand is one that never runs, and the book shows nothing
   under a heading no card is filed under any more. */
ok('the prune runs on every paint, before the bar is drawn',
   /function renderMistakes\(\)[\s\S]{0,240}?mistPruneFilters\(\);\s*\n\s*renderMistFilters\(\);\s*\n\s*renderMistList\(\);/.test(html),
   'a filter left standing over a topic that has gone is a book that shows nothing and says only "try another filter"');

ok('the filters are NOT remembered anywhere',
   !/localStorage|sessionStorage/.test(BOOK_SRC),
   'a topic filter that survived a reload is one somebody set last Tuesday and never noticed again');
ok('…and clearing them clears every one',
   /mistSubject = 'all'; mistTopic = 'all'; mistLo = 'all'; mistQuery = '';/.test(BOOK_SRC));
ok('the search is bounded before it is read',
   /MIST_SEARCH_MAX/.test(BOOK_SRC) && /input\.value\.slice\(0, MIST_SEARCH_MAX\)/.test(html));
/* Typing re-runs the LIST and nothing else: the input is never destroyed,
   so the caret stays put and forty cards' worth of pictures are not torn
   down and rebuilt on every letter. It is honest as well as cheap, because
   no count in the bar reads the query — `mistFacet` stops at its own axis
   and the search is applied after all three. */
ok('typing repaints the list and not the bar',
   /renderMistList\(\);\n\s*syncMistClear\(\);/.test(html) &&
   !/mistQuery = input\.value[\s\S]{0,120}renderMistakes\(\)/.test(html),
   'a search box destroyed on every keystroke takes the caret with it');
ok('…and no facet count reads the query',
   /if \(stage === 'lo'\) return true;/.test(BOOK_SRC),
   'a chip reading "Science (12)" must mean twelve in the book, not twelve matching what is half-typed');
ok('a topic a MODEL named is painted as text, never as markup',
   /op\.textContent = o\.label/.test(html) && !/\.innerHTML = o\.label/.test(html));
S.mistakes = [];
S.mistQuery = ''; S.mistSubject = 'all'; S.mistTopic = 'all'; S.mistLo = 'all';

/* =====================================================================
   🧩 SETTING A MISTAKE OUT AGAIN
   =====================================================================
   The rebuild runs once, inside the marking run, with a ration for the
   whole paper — so a question that missed it lands on the whole-page tier
   and stays there for ever. A book of photographs of whole pages is what
   the blocks were built to replace.
   ===================================================================== */
section('Setting a mistake out again');

const REDO_SRC = between('/* ---- SETTING A MISTAKE OUT AGAIN, after it has been filed ----',
                         '   THE DIAGNOSTIC \u2014 every question filed under the SYLLABUS',
                         'setting a mistake out again');

ok('it is offered only on a card that is still a photograph',
   /function mbRedoWanted\(list\) \{[\s\S]{0,220}mistakeTier\(m\) !== 'blocks'/.test(REDO_SRC),
   'a read spent redoing work that is done is the one way this button costs something and changes nothing');
ok('the OPEN worksheet’s own PDF is preferred, and the stored page is the fallback',
   /m\.docId === currentDocId && pages\.length/.test(REDO_SRC) &&
   /await rbCleanPage\(nums\[i\]\)/.test(REDO_SRC) &&
   /mbStoredPage\(await mistakeImageUrl\(m\)\)/.test(REDO_SRC),
   'the book is opened from Home, where no PDF is to hand — and the stored page is clean, because mistakeShotFor renders it out of the PDF');
ok('crossOrigin is set BEFORE src',
   REDO_SRC.indexOf("img.crossOrigin = 'anonymous';") >= 0 &&
   REDO_SRC.indexOf("img.crossOrigin = 'anonymous';") < REDO_SRC.indexOf('img.src = url;'),
   'set afterwards it does nothing, the picture loads tainted, and the crop dies when it is CUT rather than when it is loaded');
ok('the OLD picture is deleted only after the new one is written',
   REDO_SRC.indexOf('await mistakesCollRef().doc(m.id).set(patch') < REDO_SRC.indexOf('storage.ref(oldPath).delete()'),
   'the other order leaves a card with no picture at all when the upload fails');
ok('…and a refused tidy-up is swallowed',
   /catch \(e\) \{ \/\* a tidy-up is never worth the card \*\/ \}/.test(REDO_SRC));
ok('nothing is written when the read gave neither blocks nor a crop',
   /if \(!patch\.blocks && !patch\.imagePath\) return 'failed';/.test(REDO_SRC));
ok('a run that finds the engine off STOPS rather than saying so once per card',
   /if \(r === 'ai'\) break;/.test(REDO_SRC));
ok('one press is bounded', /MB_REDO_MAX/.test(REDO_SRC) && /i < MB_REDO_MAX/.test(REDO_SRC));
ok('two presses cannot overlap', /if \(_mbRedoBusy\)/.test(REDO_SRC));
ok('more than one asks first, naming the count',
   /confirm\('Set ' \+ want\.length \+ ' question'/.test(REDO_SRC));
ok('the button says how many are waiting',
   /'\u{1F9E9} Set out ' \+ Math\.min\(wants\.length, MB_REDO_MAX\)/u.test(html),
   'a button pressed to find out whether it had anything to do is one nobody presses');

/* =====================================================================
   THE RULER AND THE CROSSHAIR — how a model is told WHERE
   =====================================================================
   Two bugs the tutor's first finger shipped with, and both were silent.

   (1) A child tapped question 12 and was handed a hint about question 11.
       The close-up band runs 220 page units ABOVE the tap and 320 below, so
       the tap sits about two fifths of the way down — and the request said
       "they tapped near the top". The model dutifully read the question at
       the top of the band, which is the question BEFORE the one that was
       tapped, while the pin on screen sat perfectly correctly on 12.

   (2) The underline landed on the wrong line, because the position was being
       ESTIMATED on a photograph carrying no reference marks at all — and
       because HINT_SYS named the picture to measure on by ORDINAL ("the
       second picture") while `hintImagesFor` builds its list conditionally.
       A page whose close-up could not be made puts the PREVIOUS PAGE second.
   ===================================================================== */
section('The ruler and the crosshair');

/* THE CROSSHAIR IS ARITHMETIC, and getting it wrong puts it on a different
   question on a picture that still looks perfectly convincing. */
const tapAt = (pt, kx, ky, off) => S.tapMarkSpot(pt, kx, ky, off);
ok('the tap is converted into the picture’s own pixels',
   JSON.stringify(tapAt({ x: 100, y: 200 }, 2, 2, 0)) === JSON.stringify({ x: 200, y: 400 }));
ok('…and the BAND’s own top is subtracted',
   JSON.stringify(tapAt({ x: 100, y: 200 }, 2, 2, 150)) === JSON.stringify({ x: 200, y: 250 }),
   'a crosshair measured from the page rather than from the band lands off the bottom of the close-up');
ok('a tap that is not a tap is refused rather than drawn at the origin',
   S.tapMarkSpot(null, 2, 2, 0) === null && S.tapMarkSpot({ x: 'x', y: 1 }, 2, 2, 0) === null);

/* THE RULER GOES ON THE COPY AND NOWHERE ELSE. `compositeJpeg` is what the
   marking run, the mistake book, the cover and the printer all read, and a
   grid drawn across a child's printed worksheet would be the same leak
   through a side door the whole answer-key section exists to shut. */
const COMPOSITE_SRC = between('function compositeJpeg(p, maxDim, quality)', 'function bandDataUrl(', 'compositeJpeg');
ok('compositeJpeg is left ALONE — no grid and no crosshair on the picture everything else reads',
   !/drawPageGrid|drawTapMark/.test(COMPOSITE_SRC),
   'a ruler on the marking run’s picture is a ruler on the mistake book’s and on the printer’s');
ok('…so the ruler has a function of its OWN',
   /function pageJpegForModel\(p, maxDim, quality, tap\)/.test(html) &&
   /drawPageGrid\(ctx, out\.width, out\.height\);/.test(html));
ok('the band takes its mark as an OPTIONAL argument, so every older caller is unchanged',
   /function bandDataUrl\(p, yTop, yBottom, quality, mark\)/.test(html) &&
   /mark \? tapMarkSpot\(mark, kx, ky, y0\) : null/.test(html));

/* THE PICTURES A HINT IS ASKED ABOUT. */
const HIMG_SRC = between('function hintImagesFor(p, pt)', '/* WHAT THE TEACHER\'S EXEMPLARS', 'hintImagesFor');
ok('the close-up carries the crosshair',
   /bandJpeg\(p, Math\.max\(0, pt\.y - 220\), Math\.min\(p\.baseH, pt\.y \+ 320\), pt\)/.test(HIMG_SRC),
   'a band with no mark on it leaves the model guessing which of the two questions in it was tapped');
ok('the whole page carries the grid AND the crosshair',
   /pageJpegForModel\(p, 1400, null, pt\)/.test(HIMG_SRC));
ok('…and the page BEFORE carries neither',
   /var pv = compositeJpeg\(prev, 1100\);/.test(HIMG_SRC),
   'nothing is measured on the previous page, and a ruler drawn there is an invitation to measure');
ok('every picture is tagged with its ROLE',
   /role: 'band'/.test(HIMG_SRC) && /role: 'page'/.test(HIMG_SRC) && /role: 'prev'/.test(HIMG_SRC));

/* …and the role is what the request reads, so the number it states is the
   number the picture really has. */
const LADDER_SRC = between('async function hintLadderFor(p, pt)', 'var raw = await window.askGemini', 'the hint ladder request');
ok('the whole-page picture is named by the index it REALLY has',
   /indexOf\('page'\)/.test(LADDER_SRC) && /'Measure "point" and "work" on image ' \+ \(pageIdx \+ 1\)/.test(LADDER_SRC),
   'an ordinal is the PREVIOUS PAGE on any worksheet whose close-up could not be built');
ok('…and the prompt itself no longer names a picture by ordinal at all',
   !/the second picture/.test(HINT_SYS_SRC),
   'the gesture was measured against one page’s layout and drawn on another’s, in silence');
ok('THE FALSE LINE IS GONE',
   !/lines\.push\('They tapped near the top/.test(html),
   'the band puts the tap two fifths down, so "near the top" pointed the model at the question BEFORE it');
ok('…and the ring is described as the exact spot instead',
   /The magenta RING drawn on the pictures is the exact spot the student tapped/.test(LADDER_SRC));
ok('…and the request says which question that makes it, both ways round',
   /the question whose number and wording the ring sits inside/.test(LADDER_SRC) &&
   /the question DIRECTLY ABOVE the ring/.test(LADDER_SRC) &&
   /Never the question above that one/.test(LADDER_SRC),
   'a tap on a blank answer line belongs to the question above it, and to nothing further up');

/* THE GRID IS THE APP'S AND NOT THE PAPER'S, and both prompts have to say so:
   a model that reads "300" off the margin into the question it transcribes
   has invented a number in a maths question — and that question then travels
   into the hint, the keyword check and the mistake book. */
ok('the hint prompt says the grid is not part of the worksheet',
   /ARE DRAWN BY THIS APP AND ARE NOT PART OF THE WORKSHEET/.test(HINT_SYS_SRC) &&
   /Never copy a grid number/.test(HINT_SYS_SRC));
ok('…and so does the live one',
   /it is NOT part of the worksheet, so never read a grid number out/.test(html));
ok('both prompts send the model to the grid rather than to an estimate',
   /READ IT OFF THE TEAL GRID/.test(HINT_SYS_SRC) && /READ IT OFF THE GRID LINES rather than estimating/.test(LIVE_SYS_SRC));
ok('the live pages go through the ruler, not the plain composite',
   /var data = pageJpegForModel\(p, LIVE_PAGE_PX, LIVE_PAGE_QUALITY, null\);/.test(html),
   'a live reply’s marker is measured in 0–1000 on whatever picture was sent');
ok('the labels are drawn in a colour no worksheet prints, on their own plate',
   /var GRID_TEXT = '#0091aa';/.test(SRC_RULER) && /rgba\(255,255,255,0\.9\)/.test(SRC_RULER),
   'black-on-white numbers in the margin read as something the paper printed');
ok('\u2026and a label always sits ON the line it names',
   /for \(var j = GRID_STEP; j <= 1000 - GRID_STEP; j \+= GRID_STEP\)/.test(SRC_RULER) &&
   /gridLabel\(ctx, String\(j\), w \* j \/ 1000, fs \* 1\.1, fs, 'center'\)/.test(SRC_RULER),
   'a "0" nudged clear of the other "0" in the corner is a calibration mark a few per cent from the line it names');

/* =====================================================================
   THE TUTOR WRITES WORKING ON THE PAGE
   =====================================================================
   "Human teachers can do working on the paper to help the students." So the
   tutor does — two or three lines in the blank space beside the question,
   stopping one step short of the answer.
   ===================================================================== */
section('The tutor\'s working, against index.html itself');

const WORK_SRC = between('\n   ✍️ THE TUTOR WRITES WORKING ON THE PAGE',
                         '/* ================= End the tutor\'s working', 'the tutor\'s working');

/* THE ONE THAT MATTERS, and it is the finger's own rule: working in
   `annotations` is read by the NEXT marking run as the student's own work. */
ok('the working is NEVER an annotation',
   !/annotations\.push|annotations\.splice|annotations\s*=[^=]/.test(WORK_SRC) &&
   /'data-work': want/.test(WORK_SRC),
   'the tutor half-solves the question, the marking agrees with it, and no screen says why');
ok('…and the flattened picture never draws it',
   !/data-work/.test(between('function drawAnnsOnCtx(ctx, kx, ky, anns, pageNum)', '/* The whole page, with every annotation', 'the canvas flatten')),
   'it would be composited into the very picture the marking run reads');
ok('it can never swallow a stroke',
   /'pointer-events': 'none'/.test(WORK_SRC) && /\.tutorWork \{ pointer-events: none;/.test(html));
ok('NOTHING here sets a timer',
   !/setTimeout|setInterval/.test(WORK_SRC),
   'it comes down when the tutor MOVES ON, which is what a pencil does');
ok('the epoch is checked before it is painted',
   /w\.epoch === wsEpoch && w\.page === p\.num/.test(WORK_SRC));
ok('it is drawn UNDER the student’s own ink',
   /svg\.insertBefore\(g, svg\.firstChild\);/.test(WORK_SRC) && !/svg\.appendChild\(g\);/.test(WORK_SRC));
ok('a note already on the page is left alone when the overlay rebuilds',
   /had\[0\]\.getAttribute\('data-work'\) === want\) return;/.test(WORK_SRC),
   'a node rebuilt with the overlay restarts its fade-in, so the note flashes on every word written');
ok('it is painted from renderOverlay, the one function every rebuild goes through',
   /renderMarksOn\(p\);\n\s*renderTutorPointOn\(p\);\n\s*renderTutorWorkOn\(p\);/.test(html));
ok('model output is painted as TEXT, never as markup',
   /t\.textContent = line;/.test(WORK_SRC) && !/innerHTML/.test(WORK_SRC));

/* IT SITS ON THE METHOD RUNG — the very rung the drawn bar model sits on. */
ok('the rung is the method rung, and it is the maths pad’s own',
   S.WORK_RUNG === 'method' && S.WORK_RUNG === S.MTH_MODEL_RUNG,
   'working set out IS the method');
const wkAtLevel = level => { S.wsMeta.guidance = level; return S.tutorWorkAllowed(); };
ok('"Nudges only" gets no working', wkAtLevel('nudge') === false);
ok('"Concept & keywords" gets no working', wkAtLevel('concepts') === false);
ok('"How to do it" gets working', wkAtLevel('method') === true);
ok('"The answer" gets working', wkAtLevel('answer') === true);
/* …and the DOOR asks again, because a prompt is not a lock. */
S.wsMeta.guidance = 'nudge';
ok('the ONE door refuses below the method rung, whatever a model returned',
   S.tutorWorkShow({ page: 1, at: { x: 100, y: 100 }, lines: ['1 unit = ?'] }) === false,
   'a hidden field has never been the lock in this app');
S.wsMeta.guidance = 'method';
ok('…and accepts at it',
   S.tutorWorkShow({ page: 1, at: { x: 100, y: 100 }, lines: ['1 unit = ?'] }) === true);
S.tutorWorkClear();

/* IT ALWAYS STOPS ONE STEP SHORT. */
const wkJoin = (v, answerOk) => S.tutorWorkLines(v, answerOk).join(' | ');
ok('below the answer rung the last line must carry a "?"',
   wkJoin(['3 units = 12', '1 unit = ?'], false) === '3 units = 12 | 1 unit = ?');
ok('…and working that ran to the answer is REFUSED, not trimmed',
   wkJoin(['3 units = 12', '1 unit = 4', '5 units = 20'], false) === '',
   'a chain cut short still ends one step further on than it should, and nobody wrote what is left');
ok('…while the top rung may finish the sum',
   wkJoin(['3 units = 12', '1 unit = 4'], true) === '3 units = 12 | 1 unit = 4');
ok('an empty block is nothing at all', wkJoin([], true) === '' && wkJoin(null, true) === '');
ok('blank rows are dropped rather than drawn',
   wkJoin(['3 units = 12', '   ', '1 unit = ?'], false) === '3 units = 12 | 1 unit = ?');
ok('a line longer than the cap is cut to it',
   S.tutorWorkLines(['x'.repeat(200) + ' ?'], true)[0].length === S.WORK_CHARS_MAX);
const wkMany = S.tutorWorkLines(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h ?'], false);
ok('past the line cap the FIRST rows and the LAST one are kept',
   wkMany.length === S.WORK_LINES_MAX && wkMany[wkMany.length - 1] === 'h ?' && wkMany[0] === 'a',
   'dropping the last row takes away the "?" the student was meant to finish, turning an invitation into a lecture');

/* THE ANCHOR IS NEVER CLAMPED and goes through the marking's own reader. */
const wkMake = (at, ls, answerOk) => S.tutorWorkMake({ at: at, lines: ls }, 1, answerOk);
ok('a position outside the page is REFUSED, never pulled in',
   wkMake([1400, 300], ['1 unit = ?'], false) === null && wkMake([-5, 300], ['1 unit = ?'], false) === null,
   'working beside the wrong question is worse than no working at all');
ok('…and it is the marking’s own reader that says so',
   /var at = _markAt\(spec\.at\);/.test(WORK_SRC));
ok('a page number that is not a page is refused',
   wkMake([100, 100], ['1 unit = ?'], false) !== null &&
   S.tutorWorkMake({ at: [100, 100], lines: ['1 unit = ?'] }, 0, false) === null);
ok('the maker carries NO epoch, so a hint can put its own back months later',
   !/epoch/.test(between('function tutorWorkMake(spec, page, answerOk)', 'function tutorWorkGeom(', 'the working maker')) &&
   /epoch: wsEpoch/.test(WORK_SRC));
ok('a caller that forgets the answer rung gets the STRICT answer',
   S.tutorWorkMake({ at: [100, 100], lines: ['1 unit = 4'] }, 1) === null,
   'the safe default is the one that cannot hand over the answer');

/* THE BOX, on the other hand, IS nudged — a note half off the page is simply
   unreadable, and a centimetre cannot change which question it is beside. */
const wkGeom = (at, ls) => S.tutorWorkGeom(S.tutorWorkMake({ at: at, lines: ls }, 1, true), 1000, 1400);
const wkFar = wkGeom([990, 990], ['3 units = 12', '1 unit = 12 ÷ 3']);
ok('a note asked for in the bottom-right corner still lands ON the page',
   wkFar.x >= 0 && wkFar.y >= 0 && wkFar.x + wkFar.w <= 1000.001 && wkFar.y + wkFar.h <= 1400.001,
   JSON.stringify(wkFar));
const wkNear = wkGeom([100, 100], ['3 units = 12']);
ok('…and one with room is left where it was asked for',
   Math.abs(wkNear.x - 100) < 0.001 && Math.abs(wkNear.y - 140) < 0.001, JSON.stringify(wkNear));
ok('the box is as wide as its longest row',
   wkGeom([100, 100], ['xxxxxxxxxxxxxxxxxxxxxxxxxxxx ?']).w > wkGeom([100, 100], ['x ?']).w);
ok('…and as tall as it has rows',
   wkGeom([100, 100], ['a', 'b', 'c ?']).h > wkGeom([100, 100], ['a ?']).h);
ok('a geometry with no page is refused rather than drawn at nothing',
   S.tutorWorkGeom({ at: { x: 1, y: 1 }, lines: ['?'] }, 0, 100) === null);

/* THE TWO PRODUCERS. */
ok('the hint ladder asks for working only where the ladder allows it',
   /if \(tutorWorkAllowed\(\)\) \{/.test(LADDER_SRC) &&
   /Do NOT include "work": the student/.test(LADDER_SRC));
ok('…and states the "?" rule when the answer rung is shut',
   /mthAnswerAllowed\(\) \? '' : 'Its LAST line must contain/.test(LADDER_SRC));
ok('…and reads it back through the ONE maker',
   /work: tutorWorkMake\(res\.work, p\.num, mthAnswerAllowed\(\)\)/.test(html),
   'the ladder is read in the ONE place that reads it, never tested a second time here');
/* ↻ PRACTISE AGAIN is the tutor moving on too: it clears the hints, and a
   finger or a note from one of them left on the page belongs to a hint that
   no longer exists. */
ok('starting the worksheet again takes both marks off with the hints',
   /tutorMarksClear\(\);\s*\/\/ the hints have gone/.test(html));
ok('a hint that carries working and NO gesture still gets its button',
   /if \(h\.point \|\| h\.work\) \{/.test(html) &&
   /h\.point \? '\u{1F449} Show me where to look' : '\u270D\uFE0F Show the working again'/u.test(html),
   'a button drawn only for the finger leaves that working with no way back onto the page');
ok('the hint saves its working only when the door really drew it',
   /if \(out\.work && tutorWorkShow\(out\.work\)\) h\.work = out\.work;/.test(html),
   'a block saved on a hint the ceiling refused comes back the next time the worksheet opens');
ok('HINT_SYS asks for the field, with the white-space and the "?" rules',
   /"work":\{"at":\[560,120\]/.test(HINT_SYS_SRC) &&
   /EMPTY WHITE SPACE/.test(HINT_SYS_SRC) &&
   /IT MUST STOP/.test(HINT_SYS_SRC) &&
   /LAST line always contains a "\\u003f"|LAST line always contains a "\?"/.test(HINT_SYS_SRC));
ok('the live tutor is given a working marker of its own',
   /\[\[work p3 560,120 \| 3 units = 12/.test(LIVE_SYS_SRC) &&
   /LAST line always contains a "\?"/.test(LIVE_SYS_SRC));
ok('…and both prompts put the working in WHITE SPACE, never over the question',
   /EMPTY WHITE SPACE/.test(HINT_SYS_SRC) && /EMPTY WHITE SPACE/.test(LIVE_SYS_SRC),
   'a note printed over the question is the question taken away');

/* =====================================================================
   CHUNG GPT
   ===================================================================== */
section('Chung GPT');

ok('the assistant is called Chung GPT', /function aiEngineName\(\)\s*\{\s*return 'Chung GPT'/.test(html));
ok('…and every student-facing surface goes through that one function',
   !/Your buddy|your buddy/.test(html), 'the old name is still in the file');
ok('the face is drawn in code, so it needs no network at all',
   /var CHUNG_SVG\s*=/.test(html) && !/CHUNG_SVG[\s\S]{0,2000}<image/.test(html));

const svg = html.slice(html.indexOf('var CHUNG_SVG'), html.indexOf('function chungAvatar'));
/* The avatar is on screen a dozen times at once, so an `id` in it means
   every `url(#…)` after the first resolves against the wrong element — and
   the shape wearing it comes out as nothing at all. */
ok('the drawing carries no id, so a dozen copies cannot collide', !/\bid=/.test(svg));
ok('…and no gradient or filter that would need one',
   !/<(linear|radial)Gradient|<filter|url\(#/.test(svg));
/* Pinned on WHAT IS THERE rather than on a coordinate, so the drawing can
   be redrawn without the harness going red for a face that is simply
   better. */
ok('the face has two lenses, a frame and a collared shirt',
   (svg.match(/<rect x="/g) || []).length >= 2 && /stroke="#C7A47F"/.test(svg) && /#3E7C6B/.test(svg));
ok('it blinks, and the lid is scaled from its OWN top rather than the canvas’s',
   /\.cgLid\s*\{[^}]*transform-box:\s*fill-box/.test(html) &&
   /@keyframes cgBlink/.test(html));
ok('…and everything that moves stops for prefers-reduced-motion',
   /@media \(prefers-reduced-motion: reduce\)[\s\S]{0,400}\.cgFace/.test(html));
/* THE LIVE ORB (v1.20.0): the tutor drawn as the centre's logo in SAND — a
   particle model stepped in JS and drawn on a canvas. What is pinned here is
   what the live harness cannot see: the stylesheet still knows the states
   the JS paints, the colours are the logo's own, the shape is the ARTWORK (a
   mask read off the logo, not a sketch), the motion is a frame loop and
   never a timer, the float never takes a pointer, and reduced motion is
   honoured. */
const orbBlock = html.slice(html.indexOf('/* ---- THE LIVE ORB'), html.indexOf('/* ---- NO "LET ME CHECK"'));
ok('the live orb has a state for idle, thinking, talking, listening, connecting, muted and closing',
   orbBlock.length > 2000 && ['logo', 'thinking', 'talking', 'listening', 'connecting', 'muted', 'closing'].every(st => orbBlock.includes("'" + st + "'")) &&
   /\.liveOrb\[data-state="thinking"\] \.orbCap \{ opacity: 1; \}/.test(html));
ok('…its sand wears the logo’s teal and magenta, and its shape is the logo’s own mask',
   /LIVE_ORB_TEAL = '#5090a0'/.test(html) && /LIVE_ORB_MAGENTA = '#c00080'/.test(html) &&
   /LIVE_ORB_MASK = '[0-9a-f.|]{500,}'/.test(html) && /LIVE_ORB_STRIDE = 1;/.test(html) && /LIVE_ORB_STRIDE_FLOAT = 2;/.test(html));
ok('…the settled logo is SOLID: one grain per cell at the cell\'s centre, drawn wide enough to cover it, no jitter at rest, snapped exactly home, and no idle gust',
   /LIVE_ORB_GRAIN_COVER = 0\.7[1-9]\d*;/.test(html) && /LIVE_ORB_IDLE_GUSTS = false;/.test(html) && /LIVE_ORB_SNAP = 0\.0\d+;/.test(html) &&
   /if \(cell\.px % stride \|\| cell\.py % stride\) continue;/.test(orbBlock) && /\(cell\.px \+ stride \/ 2\) \* scale/.test(orbBlock) &&
   /var jitter = ring \? 60 : state === 'talking' \? 40 : 0;/.test(orbBlock) && /if \(state === 'logo' && LIVE_ORB_IDLE_GUSTS\)/.test(orbBlock) &&
   /function liveOrbBroken\(state\)/.test(orbBlock) && /radius \* \(1 \+ \(g\.sz - 1\) \* sandy\)/.test(orbBlock) &&
   /LIVE_ORB_GRAIN_COVER \* unit/.test(orbBlock));
ok('…and the sand sits inside a floating GLASS SPHERE with a shadow beneath it, both still under reduced motion',
   ['.liveOrb .orbBody {', '.liveOrb .orbGlass {', '.liveOrb .orbGloss {', '.liveOrb .orbShadow {', '@keyframes orbFloat {', '@keyframes orbShadow {'].every(rule => html.includes(rule)) &&
   /\.liveOrb \.orbGlass \{[^}]*radial-gradient/.test(html) && /\.liveOrb \.orbGlass \{[^}]*backdrop-filter: blur/.test(html) &&
   /\.liveOrb \.orbShadow \{[^}]*top: calc\(98 \* var\(--u\)\)/.test(html) && /\.liveOrb\[data-state="thinking"\] \{ --halo: /.test(html) &&
   /\.liveOrb\[data-state="talking"\] \{ --halo: /.test(html) && /\.liveOrb \.orbBody, \.liveOrb \.orbShadow \{ animation: none; \}/.test(html) &&
   (html.match(/<span class="orbShadow"><\/span><span class="orbBody"><span class="orbGlass"><\/span><canvas class="orbStage"(?: id="liveOrbStage")?><\/canvas><span class="orbGloss"><\/span><span class="orbCap">Thinking<\/span><\/span>/g) || []).length === 2);
ok('…it is drawn on a canvas by ONE requestAnimationFrame loop, never a timer',
   /<canvas class="orbStage" id="liveOrbStage"><\/canvas>/.test(html) && /<canvas class="orbStage"><\/canvas>/.test(html) &&
   /function liveOrbFrame\(/.test(orbBlock) && !/setTimeout|setInterval/.test(orbBlock) &&
   (orbBlock.match(/requestAnimationFrame\(liveOrbFrame\)/g) || []).length === 2);
ok('…the floating orb never takes a pointer, and never prints',
   /#liveOrbFloat \{[^}]*pointer-events: none/.test(html) && /@media print \{ #liveOrbFloat \{ display: none !important; \} \}/.test(html));
ok('…and it stands still for prefers-reduced-motion',
   /function liveOrbMotionOk\(\) \{[^}]*prefers-reduced-motion: reduce/.test(orbBlock) && /if \(alive && liveOrbMotionOk\(\)\)/.test(orbBlock) &&
   /if \(!motion\) \{ liveOrbSettle\(/.test(orbBlock));
ok('a speech bubble has a tail, drawn as two triangles so it keeps its outline',
   /\.speech::before[\s\S]{0,200}border-right-color/.test(html) &&
   /\.speech::after[\s\S]{0,200}border-right-color/.test(html));
/* One face per RUN of messages. A column of five identical faces down the
   side of a panel is a sheet of stickers, not somebody talking. */
ok('the face is drawn once per run of replies, not once per bubble',
   /chungSays\(b, !prev \|\| prev\.who === 'me'/.test(html));
ok('…and once per hint card rather than once per rung',
   /chungSays\(txt, ri === 0\)/.test(html));


/* =====================================================================
   PRACTISING THE MISTAKES, AND THE PRINTED SHEET
   ===================================================================== */
section('Practising the mistakes');

/* The session paints as it goes, so it is given a screen to paint on and a
   toast that goes nowhere — this section is about WHICH questions it
   practises, not what the panel looks like. */
S.$ = () => ({ innerHTML: '', textContent: '', style: {}, value: '',
               classList: { add: noop, remove: noop }, appendChild: noop,
               addEventListener: noop, focus: noop });
S.toast = noop;

S.mistakes = [
  { id: 'a', cleared: false, marks: '0/2', question: 'one' },
  { id: 'b', cleared: false, marks: '1/3', question: 'two' },
  { id: 'c', cleared: true,  marks: '0/1', question: 'three' }
];
S.mistFilter = 'open';
S.pracSel = {};

eq('"still to redo" shows only what is not cleared', S.mistakesShown().map(m => m.id), ['a', 'b']);
S.mistFilter = 'all';
eq('"everything" shows the lot', S.mistakesShown().map(m => m.id), ['a', 'b', 'c']);

/* Every button that says "all" means every card the student can SEE.
   Practising or printing questions hidden behind a filter is the one
   outcome nobody could have predicted from the button they pressed. */
S.mistFilter = 'open';
S.pracSel = { a: 1, c: 1 };
eq('a tick on a card the filter has hidden is not in the selection',
   S.pracSelectedIds(), ['a']);
S.pracPruneSel();
eq('…and it is pruned away rather than left to come back',
   Object.keys(S.pracSel), ['a']);

S.pracSelectAll(true);
eq('pick every one picks what is on screen and nothing else',
   Object.keys(S.pracSel).sort(), ['a', 'b']);
S.pracSelectAll(false);
eq('…and clearing clears', Object.keys(S.pracSel), []);

/* A question with nothing chosen must not open an empty session. */
S.pracStart([]);
eq('practising nothing does not start a session', S.prac, null);
S.pracStart(['a', 'zzz']);
eq('an id whose mistake has gone is dropped rather than crashing the session',
   S.prac.ids, ['a']);
S.prac = null;

/* Ruled space sized by what the question was WORTH — a 1-mark answer must
   not get the room a 4-mark one needs, and a 4-mark one must not be given
   two lines. */
eq('a 1-mark question still gets two lines to write on', S.mwsLines({ marks: '0/1' }), 2);
eq('a 4-mark question gets four', S.mwsLines({ marks: '0/4' }), 4);
eq('a question with no marks recorded falls back to two', S.mwsLines({ marks: '' }), 2);
eq('a huge allocation is capped rather than filling a page with rules',
   S.mwsLines({ marks: '0/40' }), 6);

/* "Export as a PDF" is the browser's own Save as PDF. There is no PDF
   WRITER in this app — pdf.js reads them — so a print stylesheet is the
   whole mechanism, and the ONE element being printed is the one carrying
   `.printMe`. Naming the report by its id worked while it was the only
   printable thing in the app and hid the worksheet the moment there were
   two. */
ok('the print stylesheet shows the ONE element being printed, by class',
   /body > \*:not\(\.printMe\)\s*\{\s*display:\s*none/.test(html));
ok('…and both printable things go through the one door',
   (html.match(/printThis\(/g) || []).length >= 3);
ok('the pictures are AWAITED before the print dialog opens',
   /await Promise\.all\(list\.map/.test(html) && /printThis\(\$\('mistSheet'\)\)/.test(html));
/* EVERY picture the sheet will print, at every tier: the whole-page or
   whole-question crop AND every figure inside a rebuilt question. A block
   figure left unawaited is a diagram missing off the printed page — the
   same failure the crop already learned, one tier further in. */
ok('the block figures are awaited too, not only the whole-page picture',
   /mistakeBlocks\(m\)\.map\(function \(b\) \{ return mistakeBlockUrl\(b\)\.then\(warm\); \}\)/.test(html));
ok('a picture that will not load takes itself off the sheet',
   /im\.onerror = res;/.test(html) &&
   /img\.addEventListener\('error', function \(\) \{ if \(img\.parentNode\) img\.parentNode\.removeChild\(img\); \}\)/.test(html));
/* Getting it right is what the book is for, so a correct retry files it
   under Sorted — and it must be reversible, which is the card's own ↩︎. */
ok('a correct retry clears the mistake',
   /prac\.result\.verdict === 'correct'[\s\S]{0,400}setMistakeCleared\(m\.id, true\)/.test(html));
ok('a blank retry is never marked wrong',
   /if \(!mine\) \{ toast\('Have a go first/.test(html));
ok('the answer is not on screen until the question has been answered',
   /if \(prac\.revealed\) \{[\s\S]{0,900}boxNode\('The answer'/.test(html));

/* =====================================================================
   THE FIRST SIGN-IN, AND WHO HAS SIGNED IN
   ===================================================================== */
section('The first sign-in');

/* A profile that could NOT be read comes in as null, and the answer must be
   "ask" — letting somebody through on a read error is an account that
   silently skips the fee question for good. */
eq('a profile that could not be read is asked', S.onboardNeeds(null), true);
eq('a profile with no answers is asked', S.onboardNeeds({ name: 'Wei Ling' }), true);
eq('an answer to an OLDER version is asked again',
   S.onboardNeeds({ tutorOnboard: { v: 0, parent: 'a', students: ['b'] } }), true);
eq('an answer to THIS version is not asked again',
   S.onboardNeeds({ tutorOnboard: { v: S.ONBOARD_VERSION, parent: 'a', students: ['b'] } }), false);
eq('rubbish where the answers should be is asked',
   S.onboardNeeds({ tutorOnboard: 'yes' }), true);

/* Since v1.9.0 a student is { name, level, subject } rather than a bare
   name — and both shapes still go in, because a row answered before that is
   read back through the same door. */
const c1 = S.onboardClean({ parent: '  Mrs Tan  ',
  students: [{ name: 'Wei Ling', level: 'P5', subject: 'math' }, { name: '   ' }, { name: '' },
             { name: 'Wei Jie', level: 'P4', subject: 'science' }],
  enrolled: true });
eq('the parent is trimmed', c1.parent, 'Mrs Tan');
/* A roster row reading "Student:" is worse than one that says nothing. */
eq('blank student names are dropped rather than stored',
   c1.students.map(function (x) { return x.name; }), ['Wei Ling', 'Wei Jie']);
eq('…and each one keeps their level and subject',
   c1.students.map(function (x) { return x.level + ' ' + x.subject; }), ['P5 math', 'P4 science']);
/* A P3 student cannot be WRITTEN as maths in the first place. */
eq('a P3 student is stored as Science whatever was picked',
   S.onboardClean({ parent: 'p', students: [{ name: 'Ken', level: 'P3', subject: 'both' }], enrolled: true })
    .students[0].subject, 'science');
/* Plain names from before v1.9.0 still read, with no level — which is what
   makes the version bump ask them the new question. */
eq('a row answered before the levels existed still reads',
   S.onboardClean({ parent: 'p', students: ['Old Name'], enrolled: true }).students,
   [{ name: 'Old Name', level: '', subject: '' }]);
eq('an enrolled family is not paying anything', c1.payingFee, false);
eq('…and no fee is recorded against them', c1.fee, '');
eq('the version it was answered under is stored with it', c1.v, S.ONBOARD_VERSION);

const c2 = S.onboardClean({ parent: 'Mr Lim', students: ['Jun Hao'], enrolled: false });
/* This is a billing commitment, so it is stored as its own flag rather than
   inferred from `enrolled` somewhere else later. */
eq('a family that is not enrolled is on the fee', c2.payingFee, true);
eq('…and the amount they agreed to is recorded', c2.fee, S.APP_FEE);
ok('the fee is a real amount, not an empty string', /\$\d/.test(S.APP_FEE), 'APP_FEE is "' + S.APP_FEE + '"');

eq('eight students is the most that can be added',
   S.onboardClean({ parent: 'p', students: Array(20).fill('x'), enrolled: true }).students.length, 8);

/* Neither route may be arrived at by default: an agreement to pay something
   has to be chosen. */
const okStu = [{ name: 'a', level: 'P5', subject: 'math' }];
eq('no parent name is not a complete answer',
   S.onboardValid({ parent: '', students: okStu, enrolled: true }), false);
eq('no student name is not a complete answer',
   S.onboardValid({ parent: 'p', students: [{ name: '  ', level: 'P5', subject: 'math' }], enrolled: true }), false);
eq('not saying whether you are enrolled is not a complete answer',
   S.onboardValid({ parent: 'p', students: okStu, enrolled: null }), false);
/* EVERY STUDENT MUST HAVE A LEVEL. One without is one whose worksheet list
   can never match anything, so there is no point letting them past. */
eq('a student with no level is not a complete answer',
   S.onboardValid({ parent: 'p', students: [{ name: 'a' }], enrolled: false }), false);
eq('…and neither is one with no subject',
   S.onboardValid({ parent: 'p', students: [{ name: 'a', level: 'P5' }], enrolled: false }), false);
eq('…and one of SEVERAL missing a level holds the whole thing up',
   S.onboardValid({ parent: 'p', students: okStu.concat([{ name: 'b' }]), enrolled: false }), false);
eq('everything answered is', S.onboardValid({ parent: 'p', students: okStu, enrolled: false }), true);

/* =====================================================================
   EVERY STUDENT HAS A LEVEL, AND P3 IS SCIENCE ONLY
   ---------------------------------------------------------------------
   A student tagged P3 Mathematics is a student whose worksheet list is
   empty for ever with nothing on any screen saying why: the filter simply
   never matches, and an empty list looks exactly like somebody who has not
   uploaded anything yet.
   ===================================================================== */
section('The levels, and what each one takes');

eq('the centre takes P3 to P6', S.STUDENT_LEVELS, ['P3', 'P4', 'P5', 'P6']);
eq('three subjects are offered', S.STUDENT_SUBJECTS.map(function (x) { return x.value; }),
   ['science', 'math', 'both']);
eq('P3 offers Science and nothing else', S.levelSubjects('P3'), ['science']);
eq('P4 offers all three', S.levelSubjects('P4'), ['science', 'math', 'both']);
eq('P6 offers all three', S.levelSubjects('P6'), ['science', 'math', 'both']);
ok('P6 + Mathematics is allowed', S.subjectOkForLevel('P6', 'math'));
ok('P6 + Both is allowed', S.subjectOkForLevel('P6', 'both'));
ok('P3 + Mathematics is refused', !S.subjectOkForLevel('P3', 'math'));
ok('P3 + Both is refused', !S.subjectOkForLevel('P3', 'both'));
ok('P5 + Mathematics is allowed', S.subjectOkForLevel('P5', 'math'));
/* ONLY P3 is special. A level from outside the range — a Sec 1 row set up
   in Ans Key — keeps every subject rather than being silently re-tagged. */
eq('a level from outside the range keeps all three', S.levelSubjects('S1'),
   ['science', 'math', 'both']);
eq('a P6 student stored as "both" is left alone',
   S.studentSubject({ level: 'P6', subject: 'both' }), 'both');

eq('a P3 student stored as "both" MEANS Science',
   S.studentSubject({ level: 'P3', subject: 'both' }), 'science');
eq('a P5 student stored as "math" is left alone',
   S.studentSubject({ level: 'P5', subject: 'math' }), 'math');
eq('no subject stays empty rather than being guessed at',
   S.studentSubject({ level: 'P5', subject: '' }), '');
eq('"both" is spelled out for the filter and the upload picker',
   S.studentSubjectList({ level: 'P5', subject: 'both' }), ['math', 'science']);
eq('a P3 student takes Science whatever is stored',
   S.studentSubjectList({ level: 'P3', subject: 'both' }), ['science']);
ok('a student with no level is not complete', !S.studentComplete({ name: 'a' }));
ok('a student with no name is not complete', !S.studentComplete({ level: 'P5', subject: 'math' }));
ok('a full one is', S.studentComplete({ name: 'a', level: 'P5', subject: 'math' }));

/* ONE reader for both shapes, or a row answered before v1.9.0 reads as no
   students at all and the teacher's list empties itself. */
eq('plain names from before v1.9.0 still read',
   S.normStudents(['Ana', ' ', 'Ben']),
   [{ name: 'Ana', level: '', subject: '' }, { name: 'Ben', level: '', subject: '' }]);
eq('objects read too',
   S.normStudents([{ name: ' Ana ', level: 'P4', subject: 'both' }]),
   [{ name: 'Ana', level: 'P4', subject: 'both' }]);
eq('rubbish reads as nobody', S.normStudents('yes'), []);

section('Only your own level and subject');
S.currentUser = { email: 'kid@example.com' };
S.myStudents = [{ name: 'Ana', level: 'P5', subject: 'science' }];
S.setActiveIdx(0);
ok('a P5 Science worksheet is theirs', S.canSeeWorksheet({ level: 'P5', subject: 'science' }));
ok('a P4 Science worksheet is not', !S.canSeeWorksheet({ level: 'P4', subject: 'science' }));
ok('a P5 Maths worksheet is not', !S.canSeeWorksheet({ level: 'P5', subject: 'math' }));
S.myStudents = [{ name: 'Ana', level: 'P5', subject: 'both' }];
ok('a "both" student gets the maths one', S.canSeeWorksheet({ level: 'P5', subject: 'math' }));
ok('…and the science one', S.canSeeWorksheet({ level: 'P5', subject: 'science' }));
S.myStudents = [{ name: 'Ken', level: 'P3', subject: 'both' }];
ok('a P3 student stored as "both" does NOT get the maths worksheet',
   !S.canSeeWorksheet({ level: 'P3', subject: 'math' }),
   'the centre teaches no P3 maths — reading the stored word raw is what hands it over');
/* Hiding somebody's own work with no explanation is worse than showing it,
   and every new upload is tagged, so this case dies out. */
S.myStudents = [{ name: 'Ana', level: 'P5', subject: 'science' }];
ok('a worksheet uploaded before the rule is still shown to its owner',
   S.canSeeWorksheet({ name: 'old one' }));
S.currentUser = { email: 'chungzhikai@gmail.com' };
ok('the teacher sees everything', S.canSeeWorksheet({ level: 'P3', subject: 'math' }));
S.currentUser = null;

/* THE SET LIST GOES THROUGH THE SAME RULE (v1.23.1). It never did: every
   active assignment was painted for every student, and pressing Start on
   one set for another level wrote a copy the list then filtered out — a
   worksheet that "got ready" and never opened, one more hidden copy per
   press. */
section('The set list is this student\'s too');
S.currentUser = { email: 'kid@example.com' };
S.myStudents = [{ name: 'Ana', level: 'P6', subject: 'science' }];
S.setActiveIdx(0);
S.assignments = [
  { id: 'a5', name: 'P5 paper', level: 'P5', subject: 'math' },
  { id: 'a6', name: 'P6 paper', level: 'P6', subject: 'science' },
  { id: 'a0', name: 'old one' }
];
/* STRICT (v1.25.0): a SET worksheet is on a shelf only when it names the
   level and the subject the shelf is for. An untagged one used to reach
   every student in the school — the very thing the shelves exist to stop —
   so it now reaches none, and the TEACHER's card says so in words. A
   student's OWN untagged upload is still theirs (`canSeeWorksheet`, above):
   the two rules are deliberately different. */
eq('a P6 Science student sees the P6 Science one only — never the P5 Maths one, never the untagged one',
   S.assignmentsForMe().map(a => a.id), ['a6']);
ok('a set worksheet with a level and no subject is on nobody\'s shelf',
   !S.canSeeAssignment({ id: 'x', level: 'P6' }) && !S.canSeeAssignment({ id: 'y', subject: 'science' }));
S.myStudents = [{ name: 'Ana', level: 'P6', subject: 'both' }];
ok('a "both" student is shown the maths one and the science one',
   S.canSeeAssignment({ id: 'm', level: 'P6', subject: 'math' }) && S.canSeeAssignment({ id: 's', level: 'P6', subject: 'science' }));
S.myStudents = [{ name: 'Ken', level: 'P3', subject: 'both' }];
ok('…but a P3 student stored as "both" is never shown a maths one',
   !S.canSeeAssignment({ id: 'm', level: 'P3', subject: 'math' }));
S.myStudents = [{ name: 'Ana', level: 'P6', subject: 'science' }];
ok('junk is nobody\'s', !S.canSeeAssignment(null) && !S.canSeeAssignment(undefined));

/* 📌 HAS THE CLASS GOT IT? — the fault a whole term's papers sat on.
   A teacher uploads a shelf of papers believing each one goes to their
   students, and when one does not, NOTHING said so: the only signal was
   whether a button read "Set for my students" or "Set — take it off". So
   a paper no child was ever given looked exactly like one every child
   has, and a level's worth of work sat on the teacher's own shelf. */
section('Whether a paper has reached the class');
/* This section stands between two that share the surrounding state, so it
   SAVES and RESTORES rather than tearing down to empty — a teardown that
   guesses at the starting state is how the test after it fails for a
   reason that has nothing to do with the code it is checking. */
const _setStateWas = { user: S.currentUser, assigns: S.assignments, loaded: S.assignmentsLoaded, students: S.myStudents };
S.currentUser = { email: 'chungzhikai@gmail.com' };
S.assignmentsLoaded = true;
S.assignments = [
  { id: 'live', level: 'P5', subject: 'math' },
  { id: 'bare', level: '', subject: '' }
];
eq('a paper with a live assignment is SET', S.worksheetSetState({ id: 'live', level: 'P5', subject: 'math' }), 'set');
/* The write landed and no child can see it. Reporting that as a success is
   how a teacher is told nine papers went out when none of them did. */
eq('…one set with no level or subject is on NOBODY\'s shelf, which is not the same thing',
   S.worksheetSetState({ id: 'bare', level: '', subject: '' }), 'nobody');
eq('…and one with no assignment at all is simply not set',
   S.worksheetSetState({ id: 'never', level: 'P5', subject: 'math' }), 'off');
/* `w.pushed` is a flag on the teacher's own copy, written SECOND —
   `unpushWorksheet` clears the assignment first — so a refused second write
   leaves a paper whose flag says set when it is not. The assignment list is
   the truth wherever it has arrived. */
eq('the LIVE list beats a stale flag on the copy',
   S.worksheetSetState({ id: 'never', level: 'P5', subject: 'math', pushed: true }), 'off');
/* …but "not arrived yet" and "taken off the list" want opposite answers,
   which is the distinction `assignmentsLoaded` exists to make. */
S.assignmentsLoaded = false;
eq('…and until the list is in, the copy\'s own flag stands',
   S.worksheetSetState({ id: 'never', level: 'P5', subject: 'math', pushed: true }), 'set');
S.assignmentsLoaded = true;
/* A copy of somebody else's assignment is not a paper to set — the 📌
   button is not drawn on one either. */
eq('a copy of a set worksheet is not the teacher\'s to set',
   S.worksheetSetState({ id: 'copy', assignmentId: 'live', level: 'P5', subject: 'math' }), '');
S.currentUser = { email: 'kid@example.com' };
eq('and a student is never shown any of it',
   S.worksheetSetState({ id: 'live', level: 'P5', subject: 'math' }), '');
S.currentUser = { email: 'chungzhikai@gmail.com' };
ok('junk is not set', S.worksheetSetState(null) === '' && S.worksheetSetState(undefined) === '');

/* The chip is what puts that state on the card, so the three that mean
   something each get their own wording and the fourth draws nothing. */
ok('every state that means something has a chip, and the rest have none',
   /Set for the class/.test(S.worksheetSetChip('set').text) &&
   /nobody/.test(S.worksheetSetChip('nobody').text) &&
   /Not set/.test(S.worksheetSetChip('off').text) &&
   S.worksheetSetChip('') === null);
/* `.chipSet` ALREADY means "📌 Set by Mr Chung" on a student's copy, and it
   is declared at TWO classes (`.chip.chipSet`) — so a class-state chip
   borrowing that name loses to it and comes out in the setter's blue, on a
   card that otherwise looks perfectly right. It is the trap `.shelfBtn`
   documents, one rule further down the same stylesheet. */
ok('the class-state chips do not borrow the SETTER\'s chip class',
   ['set', 'nobody', 'off'].every(k => !/\bchipSet\b/.test(S.worksheetSetChip(k).cls)));
ok('…and each one is declared at two classes, so it outranks the plain .chip',
   /\.chip\.chipSetOut \{/.test(html) && /\.chip\.chipSetNone \{/.test(html) &&
   ['set', 'nobody', 'off'].every(k => {
     const own = S.worksheetSetChip(k).cls.split(' ').filter(c => c !== 'chip')[0];
     return new RegExp('\\.chip\\.' + own + ' \\{').test(html);
   }),
   'a class-state chip whose CSS is written at one class is one the .chip rule beats');

/* WHY a paper cannot go out, in the teacher's words. One wording, read by
   the "set them all" pass and by the batch upload's summary, so a paper
   skipped in a pile of ten is named the same way whichever let it through. */
eq('a paper with no PDF cannot be set', S.worksheetSetBlocker({ level: 'P5', subject: 'math' }), 'it has no PDF');
eq('…nor one with neither tag',
   S.worksheetSetBlocker({ storagePath: 'x' }), 'it has no level or subject');
eq('…nor one missing just the level',
   S.worksheetSetBlocker({ storagePath: 'x', subject: 'math' }), 'it has no level');
eq('…nor one missing just the subject',
   S.worksheetSetBlocker({ storagePath: 'x', level: 'P5' }), 'it has no subject');
eq('…and a paper that is ready is not blocked at all',
   S.worksheetSetBlocker({ storagePath: 'x', level: 'P5', subject: 'math' }), '');
S.currentUser = _setStateWas.user;
S.assignments = _setStateWas.assigns;
S.assignmentsLoaded = _setStateWas.loaded;
S.myStudents = _setStateWas.students;
S.currentUser = { email: 'chungzhikai@gmail.com' };
eq('the teacher sees every set worksheet, which is how one is taken off',
   S.assignmentsForMe().map(a => a.id), ['a5', 'a6', 'a0']);
ok('the teacher is told, in words, which tag an untagged one is missing',
   /no a level or a subject/.test(S.assignmentUntaggedNote({ id: 'a0' })) &&
   /no a subject,/.test(S.assignmentUntaggedNote({ id: 'a1', level: 'P5' })) &&
   S.assignmentUntaggedNote({ id: 'a2', level: 'P5', subject: 'math' }) === '',
   S.assignmentUntaggedNote({ id: 'a1', level: 'P5' }));
ok('…and that note is drawn only for the admin',
   /var untagged = isAdmin\(currentUser\) \? assignmentUntaggedNote\(a\) : '';/.test(html));
S.currentUser = { email: 'kid@example.com' };
const notMine = S.assignmentNotMineText({ id: 'a5', name: 'P5 paper', level: 'P5', subject: 'math' });
ok('the refusal names the level it was set for and the student it is not',
   /set for P5 Mathematics/.test(notMine) && /Ana is P6 Science/.test(notMine) && /Mr Chung/.test(notMine),
   notMine);
ok('…and an untagged one is refused in its own words',
   /without a level and subject/.test(S.assignmentNotMineText({ id: 'a0', name: 'old one' })));
ok('the class list is the TEACHER\'s and is drawn from the filtered list',
   /var list = isAdmin\(currentUser\) \? assignmentsForMe\(\) : \[\];/.test(html) &&
   /list\.forEach\(function \(a\) \{ rows\.appendChild\(setCardNode\(a, \{ row: true \}\)\); \}\);/.test(html));

/* =====================================================================
   📌 THE SET LIST IS FOLDED AWAY (v1.41.0)
   ---------------------------------------------------------------------
   Every failure here is silent and the home screen still paints. Fold it
   without the count and the ⚠ and a paper no child can open sits set for
   a term with nothing anywhere saying so; open it by default and the wall
   of cover cards the teacher asked to be rid of is back; let the compact
   ROW drift from the CARD and the register quietly stops offering “Take
   off the list” — which is the one thing this section exists for.
   ===================================================================== */
section('📌 The set list is folded away');

const SRC_ASSIGN = between('var ASSIGN_OPEN_KEY =',
  '/* THE TEACHER IS TOLD WHICH SET WORKSHEETS HAVE LOST THEIR FILE.', 'the folded set list') +
  '\n' + between('function assignmentUntaggedNote(a) {',
  '\n/* 📌 HAS THIS PAPER REACHED THE CLASS?', 'the untagged note');

/* A DOM small enough to read and real enough to answer the one question a
   regex cannot: does the compact ROW still carry both warnings and both
   buttons? */
function mkEl(tag) {
  const el = { tag, className: '', textContent: '', title: '', disabled: false,
               kids: [], attrs: {}, ev: [], html: '' };
  el.classList = {
    add: c => { if (!el.classList.contains(c)) el.className = (el.className + ' ' + c).trim(); },
    remove: c => { el.className = el.className.split(/\s+/).filter(x => x && x !== c).join(' '); },
    toggle: (c, on) => { if (on) el.classList.add(c); else el.classList.remove(c); },
    contains: c => el.className.split(/\s+/).indexOf(c) >= 0
  };
  el.appendChild = k => { el.kids.push(k); return k; };
  el.setAttribute = (k, v) => { el.attrs[k] = v; };
  el.addEventListener = (t, f) => { el.ev.push([t, f]); };
  Object.defineProperty(el, 'innerHTML', { get: () => el.html, set: v => { el.html = v; el.kids = []; } });
  return el;
}
function flat(el) { return [el].concat(el.kids.reduce((a, k) => a.concat(flat(k)), [])); }
function textsOf(el) { return flat(el).map(n => String(n.textContent || '')).filter(Boolean); }
function classesOf(el) { return flat(el).map(n => n.className).filter(Boolean); }

const asgDom = {
  assignList: mkEl('div'), assignSection: mkEl('div'), assignBody: mkEl('div'),
  assignCount: mkEl('span'), assignFlag: mkEl('span'), assignCaret: mkEl('span'),
  assignToggle: mkEl('button')
};
asgDom.assignSection.className = 'hidden';
asgDom.assignBody.className = 'hidden';
const asgStore = new Map();
let asgList = [];
let asgChecked = 0;
const asgSand = {
  console, JSON, Math, String, Number, Array, Object, Boolean, RegExp,
  document: { createElement: mkEl },
  localStorage: {
    getItem: k => (asgStore.has(k) ? asgStore.get(k) : null),
    setItem: (k, v) => { asgStore.set(k, String(v)); },
    removeItem: k => { asgStore.delete(k); }
  },
  $: id => asgDom[id] || null,
  currentUser: { email: 'chungzhikai@gmail.com' },
  isAdmin: u => !!u && u.email === 'chungzhikai@gmail.com',
  myCopyOf: a => (a && a.startedCopy) || null,
  coverNode: () => { const c = mkEl('div'); c.className = 'wsCover'; return c; },
  chipNode: (t, cls) => { const c = mkEl('span'); c.className = cls; c.textContent = t; return c; },
  setterName: () => 'Mr Chung',
  guidanceLabel: () => 'Show me how',
  HINT_DEFAULT: 'method',
  levelLabel: v => v, subjectLabel: () => 'Science',
  startAssignment: () => {}, unpushWorksheet: () => {},
  assignmentsForMe: () => asgList,
  checkAssignmentPdfs: () => { asgChecked++; }
};
vm.createContext(asgSand);
vm.runInContext(SRC_ASSIGN, asgSand, { filename: 'index.html' });
const A = asgSand;

/* ---- Folded by default, and remembered per device ---- */
ok('the list is FOLDED by default — the wall of cover cards is what was asked to go',
   A.assignOpen === false);
ok('…and a device that refuses storage gets that same default',
   /catch \(e\) \{ return false; \}/.test(SRC_ASSIGN));
A.setAssignOpen(true);
ok('opening it is remembered per device', asgStore.get('tutorAssignOpen') === '1');
A.setAssignOpen(false);
ok('…and so is folding it again', asgStore.get('tutorAssignOpen') === '0');
ok('a write that throws never stops the fold',
   /try \{ localStorage\.setItem\(ASSIGN_OPEN_KEY/.test(SRC_ASSIGN));

/* ---- What a folded header still says ---- */
const okPaper = { id: 'a1', name: 'P5 SA2', level: 'P5', subject: 'science' };
const noFile  = { id: 'a2', name: 'Lost one', level: 'P5', subject: 'science', pdfMissing: true };
const noClass = { id: 'a3', name: 'Untagged' };
eq('nothing needs attention when every paper is tagged and its file is there',
   A.assignAttention([okPaper]), 0);
eq('a paper whose PDF has gone needs attention', A.assignAttention([okPaper, noFile]), 1);
eq('…and so does one on no shelf', A.assignAttention([okPaper, noFile, noClass]), 2);
eq('a paper is counted ONCE however many ways it is broken',
   A.assignAttention([{ id: 'a4', name: 'both', pdfMissing: true }]), 1);
eq('an empty list needs nothing', A.assignAttention([]), 0);
eq('…and neither does no list at all', A.assignAttention(null), 0);
ok('the ⚠ reads the SAME note the row prints, so the two can never disagree',
   /a\.pdfMissing \|\| assignmentUntaggedNote\(a\)/.test(SRC_ASSIGN));

asgList = [okPaper, noFile, noClass];
asgChecked = 0;
A.assignOpen = false;
A.renderAssignments();
ok('a folded section still says how many papers are set',
   asgDom.assignCount.textContent === '3 papers', asgDom.assignCount.textContent);
ok('…and still shouts when one of them needs the teacher',
   asgDom.assignFlag.textContent === '⚠ 2 need attention' &&
   !asgDom.assignFlag.classList.contains('hidden'), asgDom.assignFlag.textContent);
ok('…and the PDF check runs whether the body is drawn or not', asgChecked === 1);
ok('folded, the body is hidden and NOTHING is drawn into it',
   asgDom.assignBody.classList.contains('hidden') && asgDom.assignList.kids.length === 0);
ok('the caret says which way it is', asgDom.assignCaret.textContent === '▸');
ok('…and so does aria-expanded', asgDom.assignToggle.attrs['aria-expanded'] === 'false');

asgList = [okPaper];
A.renderAssignments();
ok('one paper is not "1 papers"', asgDom.assignCount.textContent === '1 paper');
ok('…and nothing needing attention hides the ⚠ rather than saying "0"',
   asgDom.assignFlag.classList.contains('hidden'));

asgList = [];
A.renderAssignments();
ok('a teacher with nothing set sees no section at all, folded or not',
   asgDom.assignSection.classList.contains('hidden'));

/* ---- Open, it is a register ---- */
asgList = [okPaper, noFile, noClass];
A.setAssignOpen(true);
ok('opening it draws the rows', asgDom.assignList.kids.length === 1 &&
   asgDom.assignList.kids[0].className === 'setRows' &&
   asgDom.assignList.kids[0].kids.length === 3);
ok('…and unhides the body', !asgDom.assignBody.classList.contains('hidden'));
ok('…and turns the caret', asgDom.assignCaret.textContent === '▾');
ok('…and says so to a screen reader', asgDom.assignToggle.attrs['aria-expanded'] === 'true');

const setRow = asgDom.assignList.kids[0].kids[0];
const setCard = A.setCardNode(okPaper);
ok('a ROW is a setCard wearing setRow', setRow.className === 'wsCard setCard setRow');
ok('…and the CARD with no opts is byte-for-byte the one the shelf has always drawn',
   setCard.className === 'wsCard setCard');
ok('the card keeps its cover; the row drops it — a register is read by name',
   classesOf(setCard).indexOf('wsCover') >= 0 && classesOf(setRow).indexOf('wsCover') < 0);
ok('…and the card keeps "📌 Set by Mr Chung" while the row, where every line is, does not',
   textsOf(setCard).some(t => /Set by Mr Chung/.test(t)) &&
   !textsOf(setRow).some(t => /Set by Mr Chung/.test(t)));
ok('BOTH still name the paper',
   textsOf(setCard).indexOf('P5 SA2') >= 0 && textsOf(setRow).indexOf('P5 SA2') >= 0);
ok('…and both still say which class it is for and what help it gives',
   ['P5', 'Science'].every(t => textsOf(setRow).indexOf(t) >= 0) &&
   textsOf(setRow).some(t => /Show me how/.test(t)));
ok('…and both still offer Start it AND Take off the list',
   ['Start it', 'Take off the list'].every(t => textsOf(setRow).indexOf(t) >= 0) &&
   ['Start it', 'Take off the list'].every(t => textsOf(setCard).indexOf(t) >= 0));

const rowLost = asgDom.assignList.kids[0].kids[1];
const rowUntagged = asgDom.assignList.kids[0].kids[2];
ok('THE ROW KEEPS THE WARNING A TIDIER ROW WOULD HAVE DROPPED FIRST — the lost PDF',
   textsOf(rowLost).some(t => /no longer in Storage/.test(t)) &&
   classesOf(rowLost).some(c => /assignWarn/.test(c)));
ok('…and the one about reaching no shelf',
   textsOf(rowUntagged).some(t => /on no student’s shelf/.test(t)) &&
   classesOf(rowUntagged).some(c => /assignWarn/.test(c)));
ok('…and a paper with no file cannot be started from the row either',
   flat(rowLost).some(n => n.textContent === 'Start it' && n.disabled === true));

/* A student never reaches this list at all, but they DO reach `setCardNode`
   through their own shelf — so the node must go on standing down there. */
A.currentUser = { email: 'kid@example.com' };
const kidCard = A.setCardNode(okPaper);
ok('a student\'s shelf card is never offered Take off the list',
   textsOf(kidCard).indexOf('Take off the list') < 0 &&
   textsOf(kidCard).indexOf('Start it') >= 0);
A.currentUser = { email: 'chungzhikai@gmail.com' };

/* ---- The wiring and the markup ---- */
ok('the header IS the switch — one control, and it is bound once',
   (html.match(/\$\('assignToggle'\)\.addEventListener\('click', toggleAssignOpen\);/g) || []).length === 1);
ok('the markup carries the button, the caret, the count and the ⚠',
   /<button class="assignToggle" id="assignToggle"[^>]*aria-controls="assignBody">/.test(html) &&
   /id="assignCaret"/.test(html) && /id="assignCount"/.test(html) && /id="assignFlag"/.test(html));
ok('…and the blurb, the list and its spacer are all INSIDE the body that folds',
   /<div id="assignBody" class="hidden">[\s\S]{0,900}<div id="assignList"><\/div>[\s\S]{0,120}<\/div>\n\s*<\/div>/.test(html));
ok('the section is still the ONE place a worksheet is taken off the class list',
   /off\.addEventListener\('click', function \(\) \{ unpushWorksheet\(a\.id\); \}\);/.test(html));
ok('the row and the fold have styles of their own rather than borrowing the grid\'s',
   /\.setRows \{ display: flex; flex-direction: column;/.test(html) &&
   /\.wsCard\.setRow \{/.test(html) && /\.assignToggle \{/.test(html));
ok('…and a flagged row\'s warning wraps to a line of its own',
   /\.wsCard\.setRow \.assignWarn \{ flex: 1 1 100%;/.test(html));

/* The order inside the render is the whole safety story: the header is
   painted, the check is fired, and only THEN does the fold return early. */
const asgRender = between('function renderAssignments() {',
  '\n/* THE TEACHER IS TOLD WHICH SET', 'renderAssignments');
ok('the header is painted BEFORE the fold returns',
   asgRender.indexOf("$('assignCount')") < asgRender.indexOf('if (!assignOpen) return;') &&
   asgRender.indexOf("$('assignFlag')") < asgRender.indexOf('if (!assignOpen) return;'));
ok('…and so is the PDF check, or a folded list never learns a file has gone',
   asgRender.indexOf('checkAssignmentPdfs();') < asgRender.indexOf('if (!assignOpen) return;'));
ok('…and a non-admin still gets nothing, before any of it',
   asgRender.indexOf('isAdmin(currentUser) ? assignmentsForMe()') <
   asgRender.indexOf("$('assignCount')"));
const startGate = html.slice(html.indexOf('async function startAssignment'),
                             html.indexOf('async function startAssignment') + 900);
ok('Start it asks the strict rule again in the handler, before anything is written',
   /if \(!canSeeAssignment\(a\)\) \{ toast\(assignmentNotMineText\(a\), 8000\); return; \}/.test(startGate) &&
   startGate.indexOf('canSeeAssignment(a)') < startGate.indexOf('myCopyOf(a)'),
   'a hidden card is never the lock');
ok('openWorksheet says so when the id is not in the list, instead of returning in silence',
   /var w = worksheets\.find\(function \(x\) \{ return x\.id === id; \}\);[\s\S]{0,300}if \(!w\) \{ toast\('That worksheet is not in your list\.'/.test(html));

/* The copies the bug wrote: blank, hidden, one per press. Only a DUPLICATE
   of a blank starter copy is dropped — never the sole copy, never one with
   work on it, never the file. */
const blankBody = JSON.stringify({ annotations: [], hints: [], marking: { items: [] }, chat: [],
  key: { pages: [], rows: [], path: '', name: '', scanned: true, shared: true } });
const inkedBody = JSON.stringify({ annotations: [{ type: 'pen' }], hints: [], marking: { items: [] }, chat: [] });
const c = (id, extra) => Object.assign({ id, assignmentId: 'a5', sharedPdf: true, body: blankBody,
  score: { correct: 0, attempted: 0 } }, extra || {});
ok('a starter copy is blank', S.blankStarterCopy(c('x')));
ok('a copy with ink on it is not', !S.blankStarterCopy(c('x', { body: inkedBody })));
ok('…nor one that was marked', !S.blankStarterCopy(c('x', { score: { correct: 1, attempted: 2 } })));
ok('…nor a second attempt', !S.blankStarterCopy(c('x', { attempts: 2 })));
ok('…nor one whose body overflowed to Storage', !S.blankStarterCopy(c('x', { bodyPath: 'p' })));
ok('…nor a worksheet of the student\'s own', !S.blankStarterCopy(c('x', { assignmentId: '' })));
/* newest first, as loadWorksheets sorts them */
eq('of three blank copies of one assignment the two newer ones go and the oldest stays',
   S.duplicateBlankCopies([c('n3'), c('n2'), c('n1')]).map(w => w.id), ['n2', 'n3']);
eq('a sole blank copy is never dropped', S.duplicateBlankCopies([c('n1')]), []);
eq('a newer copy WITH work on it stays, whatever came before it',
   S.duplicateBlankCopies([c('n2', { body: inkedBody }), c('n1')]), []);
eq('copies of different assignments are not each other\'s duplicates',
   S.duplicateBlankCopies([c('n2', { assignmentId: 'a6' }), c('n1')]), []);
const loadWs = html.slice(html.indexOf('async function loadWorksheets'),
                          html.indexOf('async function loadWorksheets') + 2200);
ok('loadWorksheets drops only what duplicateBlankCopies names, the document alone, and never the PDF',
   /var dupes = duplicateBlankCopies\(out\);/.test(loadWs) &&
   /db\.collection\(COLLECTION\)\.doc\(w\.id\)\.delete\(\)/.test(loadWs) &&
   !/storage\.ref/.test(loadWs));
ok('…before the list is filtered, so a duplicate the student can see is gone from the screen at once',
   loadWs.indexOf('duplicateBlankCopies(out)') < loadWs.indexOf('worksheets = out.filter(canSeeWorksheet)'));
S.assignments = [];
S.currentUser = null;

section('Who is working right now');
S.myStudents = [{ name: 'Ana', level: 'P5', subject: 'science' },
                { name: 'Ben', level: 'P3', subject: 'science' }];
S.setActiveIdx(1);
eq('the active student is the one chosen', S.activeStudent().name, 'Ben');
/* A student taken off the roster leaves a stored index pointing past the
   end, and a filter reading `undefined.level` would show nothing at all. */
S.myStudents = [{ name: 'Ana', level: 'P5', subject: 'science' }];
eq('an index past the end falls back to the first, never undefined',
   S.activeStudent().name, 'Ana');
S.myStudents = [];
eq('no students at all is null rather than a throw', S.activeStudent(), null);

section('The rule, against index.html itself');
ok('the version bump is what asks everyone again',
   /var ONBOARD_VERSION = 2;/.test(html),
   'a student answered under v1 has no level, so the gate has to re-ask');
ok('the chips are built from the rule, not typed into the markup',
   !/<button[^>]*class="pickChip"/.test(html));
ok('a subject the new level does not offer is dropped when the level changes',
   /allow\.indexOf\(st\.subject\) === -1\) st\.subject = ''/.test(html));
ok('…and a level with one subject picks it outright',
   /if \(allow\.length === 1\) st\.subject = allow\[0\]/.test(html));
/* The row's own level/subject are what Ans Key and the Scan app read. */
ok('the answer is mirrored onto the fields the other apps read',
   /patch\.level = lead\.level; patch\.subject = lead\.subject;/.test(html));
ok('a student already set up in Ans Key does not retype their level',
   /known\.length === 1 && !known\[0\]\.level && p_level\(profile\)/.test(html));
ok('the list is filtered by the rule', /worksheets = out\.filter\(canSeeWorksheet\);/.test(html));
/* A worksheet tagged with a level the student is not is one that vanishes
   from their own list the moment it is saved. */
ok('an upload takes the level off the active student, never a picker',
   /var levelFixed = !!\(!isAdmin\(currentUser\) && st && st\.level\);\n\s*return \{[\s\S]{0,200}level: levelFixed \? st\.level : \$\('upLevel'\)\.value,/.test(html));
ok('…and the paper read at upload is TOLD that level is not free',
   /paperApplyRead\(read, \{\n\s*level: level, levelFree: !s\.levelFixed,/.test(html));
ok('the students are dropped on every account change, and the list is made to WAIT for the next ones',
   /rosterReset\(\);[\s\S]{0,120}currentDocId = null;/.test(html) &&
   /function rosterReset\(\) \{\n\s*myStudents = \[\];/.test(html));

/* =====================================================================
   👤 A P5 ACCOUNT MUST NOT BE READING P6 AND P4 PAPERS (v1.25.2)
   ---------------------------------------------------------------------
   The sign-in fired `loadWorksheets()` and `onboardRequire()` side by side
   with `myStudents` freshly emptied, so the whole list was filtered against
   NOBODY — and both filters read "no active student" as "show everything".
   For an account that had already answered, no gate ever appeared and
   `adoptStudents` repainted the header alone, so it was never filtered
   again. Every set worksheet at every level stood on a P5 child's shelves.
   ===================================================================== */
section('The roster is settled before a single row is filtered');
S.currentUser = { email: 'kid@example.com' };
S.myStudents = [];
S.setActiveIdx(0);
/* ① THE RULE ITSELF: an unknown student is shown no SET worksheet at all. */
ok('with nobody adopted yet, a set worksheet reaches nobody',
   !S.canSeeAssignment({ id: 'p6', name: 'P6 paper', level: 'P6', subject: 'science' }) &&
   !S.canSeeAssignment({ id: 'p4', name: 'P4 paper', level: 'P4', subject: 'math' }),
   'a set worksheet belongs to a CLASS, so "we do not know who this is" must never mean "show every class\'s paper"');
ok('…not even one tagged for the level they will turn out to be',
   !S.canSeeAssignment({ id: 'p5', level: 'P5', subject: 'science' }));
/* …and the OTHER way round is deliberately NOT symmetrical: a student's own
   uploads are their own work, and hiding those with no explanation is the
   worse fault. */
ok('a student\'s OWN worksheet is still shown while the roster is unknown',
   S.canSeeWorksheet({ level: 'P6', subject: 'science' }),
   'your own uploads are yours — canSeeWorksheet stays permissive on purpose');
/* Once the roster IS in, the ordinary rule decides. */
S.myStudents = [{ name: 'Ana', level: 'P5', subject: 'both' }];
S.setActiveIdx(0);
eq('once the roster is in, a P5 both-subjects student gets P5 science and P5 maths and nothing else',
   ['P5|science', 'P5|math', 'P6|science', 'P4|math', 'P5|english']
     .filter(k => S.canSeeAssignment({ id: k, level: k.split('|')[0], subject: k.split('|')[1] })),
   ['P5|science', 'P5|math']);
S.currentUser = { email: 'chungzhikai@gmail.com' };
ok('the teacher is never held up by it', S.canSeeAssignment({ id: 'x', level: 'P6', subject: 'math' }));
S.currentUser = null;

/* ② THE PROMISE the list waits on. */
S.myStudents = [{ name: 'Ana', level: 'P5', subject: 'science' }];
eq('with no account change yet, nothing is waited for at all', await Promise.race([
     S.rosterReady().then(() => 'ready'), Promise.resolve().then(() => 'pending')
   ]), 'ready');
S.rosterReset();
eq('a fresh account empties the roster and starts a fresh wait', S.myStudents, []);
eq('…and the list waits', await Promise.race([
     S.rosterReady().then(() => 'ready'), Promise.resolve().then(() => 'pending')
   ]), 'pending');
S.rosterSettled();
eq('…until who is working is known', await S.rosterReady().then(() => 'ready'), 'ready');
S.rosterSettled();
eq('settling twice is harmless, so every path may call it and the finally may call it again',
   await S.rosterReady().then(() => 'ready'), 'ready');

/* ③ EVERY PATH SETTLES IT. A waiter holding a promise nothing resolves is a
   home screen that stays empty for ever. */
S.rosterReset();
S.renderAuth = () => {};   // the header is not what is under test here
S.adoptStudents({ tutorOnboard: { students: [{ name: 'Ana', level: 'P5', subject: 'science' }] } });
eq('adopting the roster settles it', await S.rosterReady().then(() => 'ready'), 'ready');
eq('…with the students really adopted', S.myStudents.map(x => x.name + ' ' + x.level), ['Ana P5']);
ok('the sign-in settles it whichever way the gate went, teacher included',
   /onboardRequire\(user\)\.catch\(function \(e\) \{[\s\S]{0,240}\}\)\.then\(rosterSettled, rosterSettled\);/.test(html));
ok('…and signing out settles it, because nothing is coming',
   /_peopleRows = null;\n\s*onboardFinish\(\);\n[\s\S]{0,120}rosterSettled\(\);/.test(html));
ok('…and answering the gate settles it BEFORE the list is asked for again',
   /rosterSettled\(\);\n\s*onboardFinish\(\);\n\s*renderAuth\(\);\n\s*loadWorksheets\(\);/.test(html));
ok('the wait is BOUNDED, so the home screen can never hang on it',
   /var ROSTER_WAIT_MS = \d+;/.test(html) && /setTimeout\(function \(\) \{[\s\S]{0,200}\}, ROSTER_WAIT_MS\)/.test(html));

/* ④ AND THE LIST REALLY AWAITS IT, before it filters anything. */
{
  const load = html.slice(html.indexOf('async function loadWorksheets()'),
                          html.indexOf('async function loadWorksheets()') + 2600);
  ok('loadWorksheets awaits the roster', /await rosterReady\(\);/.test(load));
  ok('…BEFORE it reads or filters a single row',
     load.indexOf('await rosterReady()') < load.indexOf('.where(\'ownerUid\'') &&
     load.indexOf('await rosterReady()') < load.indexOf('worksheets = out.filter(canSeeWorksheet)'),
     'filtering first and repainting afterwards is a flash of another class\'s papers');
  ok('…and an account signed out while it waited paints nothing',
     /await rosterReady\(\);\n[\s\S]{0,160}if \(!currentUser\) \{ worksheets = \[\]; assignments = \[\]; renderWorksheets\(\); return; \}/.test(load));
}
S.currentUser = null;
S.myStudents = [];

section('Who has signed in');

const r1 = S.personRow('u1', {
  name: 'Wei Ling', email: 'a@b.c', tutorLastSeen: { seconds: 1700000000 },
  tutorOnboard: { v: 1, parent: 'Mrs Tan', students: ['Wei Ling', 'Wei Jie'], enrolled: true, payingFee: false }
});
eq('a row reads the students off the answers', r1.students, ['Wei Ling', 'Wei Jie']);
eq('…and the parent', r1.parent, 'Mrs Tan');
eq('…and knows they are enrolled', r1.enrolled, true);
eq('…and that they owe nothing', r1.paying, false);

/* Somebody who signed in and closed the dialog is exactly the person a
   teacher wants to see, so the row is shown and says so. */
const r2 = S.personRow('u2', { email: 'x@y.z', tutorLastSeen: { seconds: 1700000100 } });
eq('an account that has not answered yet is still a row', r2.email, 'x@y.z');
eq('…and it says it has not answered', r2.answered, false);
eq('…and is not counted as enrolled', r2.enrolled, false);

const sorted = S.peopleSort([
  { name: 'old', email: '', seen: 1000 },
  { name: 'never', email: '', seen: 0 },
  { name: 'newest', email: '', seen: 9000 }
]);
eq('the most recent sign-in comes first', sorted.map(r => r.name), ['newest', 'old', 'never']);

/* The rules for this collection live in another repository and are shared
   with four other apps, so this one writes ONE namespaced field and merges. */
ok('the roster is the centre\'s existing one, not a second list',
   /var PEOPLE_COL = 'studentProfiles'/.test(html));
ok('every write to it is a MERGE',
   !/peopleRef\([^)]*\)\.set\((?![^;]*\{ merge: true \})/.test(html));
/* A name a teacher typed in Ans Key must not be replaced by whatever a
   parent typed here. */
ok('a name is only ever written into an EMPTY one',
   /if \(!known\)/.test(html) && (html.match(/var known = String\(/g) || []).length >= 2);
ok('the gate cannot be dismissed with Esc',
   /\.modalBack\.open:not\(#onboardModal\)/.test(html));
/* Trapping somebody behind a dialog they have already answered — on a
   dropped connection, of all things — is worse than asking twice. */
ok('a write that failed lets them through and asks again next time',
   /roster: answers could not be saved[\s\S]{0,600}onboardFinish\(\)/.test(html));
ok('a gate that throws is not a gate nobody can get past',
   /onboardRequire\(user\)\.catch[\s\S]{0,200}onboardFinish\(\)/.test(html));
ok('the teacher is not asked, and does not get a row',
   /if \(isAdmin\(user\)\) return;/.test(html));

/* =====================================================================
   N. STUDENT USAGE — who did what, and how much
   ===================================================================== */
section('Student usage');

/* Every event a call site can raise must have a LABEL. A key with no entry
   prints its own internal name — "practiceRight" — into a panel a teacher
   reads, which looks like a fault rather than like a missing label. */
const usageKeys = [...html.matchAll(/usageNote\('([a-z]+)'/g)].map(m => m[1]);
ok('every event a call site raises is one the panel can name',
   usageKeys.length >= 8 && usageKeys.every(k => !!S.USAGE_EVENTS[k]),
   'unnamed: ' + usageKeys.filter(k => !S.USAGE_EVENTS[k]).join(', '));
ok('…and every named event says which counter it moves',
   Object.keys(S.USAGE_EVENTS).every(k => !!S.USAGE_EVENTS[k].count && !!S.USAGE_EVENTS[k].label));
eq('an event nobody named still reads as words, not as a blank',
   S.usageLabel('whatever'), 'whatever');

/* THE ONE DOOR. A second writer is a second place to forget the two rules
   below, and a path that logs its own way shows up in no total. */
ok('usageNote and usageAdd are the only things that move a counter',
   (html.match(/_usage\.inc\[field\] = /g) || []).length === 2);
ok('…and usageFlush is the only thing that writes one',
   (html.match(/'tutorUsage\.'/g) || []).length === 1 &&
   (html.match(/tutorUsage\./g) || []).length === 3);

/* A student's device runs all of this, so what leaves it matters. */
function usageRun(user, fn) {
  const writes = [];
  S.db = { collection: () => ({ doc: () => ({ set: (p, o) => { writes.push({ p, o }); return { catch: () => {} }; } }) }) };
  S.firebase = { firestore: { FieldValue: {
    serverTimestamp: () => 'STAMP',
    increment: n => ({ inc: n })
  } } };
  S.usageStart(user);
  fn();
  S.usageFlush(true);
  S.db = null;
  return writes;
}
const student = { uid: 'u1', email: 'kid@example.com' };
const teacher = { uid: 'admin', email: S.ADMIN_EMAIL };

const w = usageRun(student, () => {
  S.usageNote('mark', '  Term 1   Paper\n2  ');
  S.usageAdd('questions', 18);
  S.usageAdd('correct', 11);
});
eq('a run of work is ONE write', w.length, 1);
eq('…and it is a MERGE, never a set', w[0].o && w[0].o.merge, true);
eq('a counter goes up by an INCREMENT, not by a number this tab worked out',
   w[0].p['tutorUsage.questions'], { inc: 18 });
eq('…so two tabs on one account cannot overwrite each other',
   w[0].p['tutorUsage.marked'], { inc: 1 });
eq('the day is counted once, whatever else happened',
   w[0].p['tutorUsage.activeDays'], { inc: 1 });
eq('the sign-in stamp goes with it', w[0].p.tutorLastSeen, 'STAMP');
/* A worksheet's own NAME is the most that ever leaves the device. Not a
   question, not an answer, not a mark on a particular question. */
eq('what a line records is folded to one line and capped',
   w[0].p.tutorRecent[0].d, 'Term 1 Paper 2');
const long = usageRun(student, () => { S.usageNote('chat', 'x'.repeat(400)); });
eq('a long detail is cut rather than written whole', long[0].p.tutorRecent[0].d.length, 80);

const many = usageRun(student, () => {
  for (let i = 0; i < S.USAGE_RECENT_MAX + 12; i++) S.usageNote('hint', 'Q' + i);
});
eq('the recent list is capped', many[0].p.tutorRecent.length, S.USAGE_RECENT_MAX);
eq('…and it is the LAST ones that are kept',
   many[0].p.tutorRecent[many[0].p.tutorRecent.length - 1].d,
   'Q' + (S.USAGE_RECENT_MAX + 11));
eq('…while the counter still counts every one of them',
   many[0].p['tutorUsage.hints'], { inc: S.USAGE_RECENT_MAX + 12 });

/* The teacher's own list is a list of the people they teach. Their own use
   of the app is not usage to report, and recording it would put the teacher
   at the top of their own roster every single day. */
const t = usageRun(teacher, () => { S.usageNote('mark', 'anything'); S.usageAdd('questions', 9); });
eq('the teacher is not recorded', t.length, 0);

/* Signing out FLUSHES what is still in hand — the last few minutes of a
   lesson must not die with the tab — and then records nothing more. Writing
   anything after it would file one student's work under whoever signs in
   next on a shared iPad. */
const bye = (() => {
  const writes = [];
  S.db = { collection: () => ({ doc: () => ({ set: p => { writes.push(p); return { catch: () => {} }; } }) }) };
  S.firebase = { firestore: { FieldValue: { serverTimestamp: () => 'STAMP', increment: n => ({ inc: n }) } } };
  S.usageStart(student);
  S.usageNote('chat');
  S.usageStop();
  const afterStop = writes.length;
  S.usageNote('chat');
  S.usageAdd('questions', 5);
  S.usageFlush(true);
  S.db = null;
  return { afterStop, total: writes.length };
})();
eq('signing out files what is still in hand', bye.afterStop, 1);
eq('…and nothing is recorded once the account has gone', bye.total, 1);

const nothing = usageRun(student, () => {});
eq('a session with nothing in it writes nothing at all', nothing.length, 0);

const zero = usageRun(student, () => { S.usageAdd('questions', 0); S.usageAdd('correct', NaN); });
eq('a count of nothing is not a count', zero.length, 0);

/* ---- What is read back out ---- */
const fresh = S.usageOf({});
eq('an account from before any of this reads as zeros, never as nothing',
   [fresh.questions, fresh.hints, fresh.activeDays], [0, 0, 0]);
eq('…and says it has done nothing', fresh.any, false);
/* Signing in and doing nothing is its own answer, and the panel says it in
   words. Folded into "any" it would show a grid of twelve zeros instead. */
eq('signing in is not, by itself, doing something',
   S.usageOf({ tutorUsage: { sessions: 9 } }).any, false);
eq('…but one worksheet is', S.usageOf({ tutorUsage: { worksheets: 1 } }).any, true);
eq('…and so is a mistake practised',
   S.usageOf({ tutorUsage: { practice: 1 } }).any, true);

/* A blank was not an attempt. Counting it as one reports a child who ran
   out of time as a child who got it wrong — which is the same rule the
   marking, the report and the practice retry all carry. */
const acc = S.usageOf({ tutorUsage: { correct: 6, partial: 0, wrong: 2, blank: 12 } });
eq('accuracy is over what was ATTEMPTED', acc.attempted, 8);
eq('…so a page left blank never counts against them', S.usageAccuracy(acc), 75);
eq('a partial counts half', S.usageAccuracy(S.usageOf({ tutorUsage: { correct: 1, partial: 1 } })), 75);
eq('nothing attempted has no accuracy at all',
   S.usageAccuracy(S.usageOf({ tutorUsage: { hints: 4 } })), null);

const feed = S.usageRecent({ tutorRecent: [{ t: 10, k: 'hint' }, { t: 90, k: 'chat' }, { t: 50, k: 'mark' }] });
eq('the feed reads newest first', feed.map(e => e.k), ['chat', 'mark', 'hint']);
eq('a feed that is not a list is not a crash', S.usageRecent({ tutorRecent: 'oops' }).length, 0);

/* The day key is the student's own evening, not a timezone's. */
eq('the day is a LOCAL day', S.usageDayKey(new Date(2026, 0, 5, 23, 30)), '2026-01-05');

ok('the panel it opens exists', /id="personModal"/.test(html) && /id="personBody"/.test(html));

/* =====================================================================
   N. THE COVER — the front page, on a stack of sheets
   ===================================================================== */
section('The worksheet cover');

/* A field on a document, rendered straight into an <img src>. Only ever a
   picture this app drew — never a url the document happens to be carrying. */
eq('a cover is a picture, not a link', S.coverOf({ cover: 'https://example.com/x.png' }), '');
eq('…nor a script url', S.coverOf({ cover: 'javascript:alert(1)' }), '');
eq('…and a real one is kept', S.coverOf({ cover: 'data:image/jpeg;base64,AAAA' }),
   'data:image/jpeg;base64,AAAA');
eq('a worksheet with no cover has none', S.coverOf({}), '');

/* The stack SAYS how much paper there is rather than being decoration. */
eq('one page is one sheet', S.coverSheets(1), 0);
eq('two pages puts one behind it', S.coverSheets(2), 1);
eq('a whole paper is a stack', S.coverSheets(9), 2);
eq('…and it never grows past two', S.coverSheets(400), 2);

/* =====================================================================
   📚 THE BOOKSHELF — level, then subject, then topic along the shelf
   ===================================================================== */
section('The bookshelf');
{
  const ws = [
    { id: 'a', level: 'P5', subject: 'science', topic: 'Heat', updatedAt: 10 },
    { id: 'b', level: 'P6', subject: 'math', topic: '', updatedAt: 50 },
    { id: 'c', level: 'P5', subject: 'science', topic: '', updatedAt: 90 },
    { id: 'd', level: 'P5', subject: 'science', topic: 'Cells', updatedAt: 20 },
    { id: 'e', level: 'P5', subject: 'math', topic: 'Fractions', updatedAt: 30 },
    { id: 'f', level: '', subject: '', updatedAt: 99 },
    { id: 'g', level: 'P5', subject: 'science', topic: 'heat', updatedAt: 40 },
    { id: 'h', level: 'S1', subject: 'science', updatedAt: 1 },
    { id: 'i', level: 'P3', subject: 'science', updatedAt: 1 }
  ];
  const groups = S.shelfGroups(ws);
  eq('one shelf per level and subject, levels up the ladder, subjects in the centre\'s order, untagged LAST',
     groups.map(g => g.level + '|' + g.subject), ['P3|science', 'P5|science', 'P5|math', 'P6|math', 'S1|science', '|']);
  const p5sci = groups[1];
  eq('along a shelf the papers are filed by topic, a topic\'s newest first, no topic at the end',
     p5sci.items.map(w => w.id), ['d', 'g', 'a', 'c']);
  eq('an untagged worksheet is on its own shelf rather than dropped', groups[5].items.map(w => w.id), ['f']);
  eq('a shelf says what it holds', [S.shelfTitle(p5sci), S.shelfTitle(groups[5])], ['P5 · Science', 'Any level · Any subject']);
  eq('an empty list is no shelves', S.shelfGroups([]), []);
  eq('a Firestore stamp, a Date and a number all order a shelf',
     S.shelfGroups([
       { id: 'x', level: 'P4', subject: 'math', updatedAt: { toMillis: () => 5 } },
       { id: 'y', level: 'P4', subject: 'math', updatedAt: new Date(9) },
       { id: 'z', level: 'P4', subject: 'math', updatedAt: 7 }
     ])[0].items.map(w => w.id), ['y', 'z', 'x']);
  /* THE WHEEL, pinned as a function of distance from the middle. */
  const mid = S.shelfWheelPose(0);
  eq('the card in the middle faces you, full size', [mid.rot, mid.z, mid.scale, mid.op], [0, 0, 1, 1]);
  const l = S.shelfWheelPose(-0.5), r = S.shelfWheelPose(0.5);
  ok('a card to the left turns the opposite way to a card to the right, by the same amount', l.rot === -r.rot && r.rot < 0, JSON.stringify([l, r]));
  ok('…and both sink and shrink the same', l.z === r.z && l.z < 0 && l.scale === r.scale && l.scale < 1);
  ok('the pose is clamped, so a card far along the shelf is not turned edge-on into nothing',
     S.shelfWheelPose(4).rot === S.shelfWheelPose(1).rot && S.shelfWheelPose(4).scale > 0.5 && S.shelfWheelPose(-9).op > 0.5);
  ok('a card nearer the middle is turned less', Math.abs(S.shelfWheelPose(0.2).rot) < Math.abs(S.shelfWheelPose(0.6).rot));
  eq('with motion switched off a card is never turned at all', S.shelfWheelPose(0.7, false), { rot: 0, z: 0, scale: 1, op: 1 });
  ok('junk is the middle pose', S.shelfWheelPose('x').rot === 0 && S.shelfWheelPose(undefined).scale === 1);
  ok('the row is the scroller and snaps to a paper', /\.shelfRow \{[^}]*scroll-snap-type: x mandatory/.test(html) && /\.shelfItem \{[^}]*scroll-snap-align: center/.test(html));
  ok('the wheel is posed off the scroll, one paint a frame', /row\.addEventListener\('scroll', kick, \{ passive: true \}\)/.test(html) && /requestAnimationFrame\(run\)/.test(html));
  ok('the home screen is built from shelfSections over EVERY paper the student has',
     /var entries = shelfEntries\(worksheets, assignmentsForMe\(\)\);[\s\S]{0,1400}var sections = shelfSections\(entries, \{[\s\S]{0,400}\}\);[\s\S]{0,1200}sections\.forEach\(function \(sec\) \{ box\.appendChild\(shelfNode\(sec\)\); \}\);/.test(html));

  /* EVERY PAPER IS ON A SHELF, OPENED OR NOT (v1.25.0). A set worksheet the
     student has not started stands on the shelf beside the ones they have,
     filed by the same fields; one they HAVE started is on the shelf as
     their own copy and never twice. */
  const own = [
    { id: 'w1', assignmentId: 'a1', level: 'P5', subject: 'science', topic: 'Heat', updatedAt: 50 },
    { id: 'w2', level: 'P5', subject: 'science', topic: 'Cells', updatedAt: 40 }
  ];
  const sets = [
    { id: 'a1', name: 'Started', level: 'P5', subject: 'science', topic: 'Heat', createdAt: 10 },
    { id: 'a2', name: 'Fresh', level: 'P5', subject: 'science', topic: 'Heat', createdAt: 60, pageCount: 4, school: 'Nan Hua' },
    { id: 'w2', name: 'The teacher\'s own upload, already on the shelf as their worksheet', level: 'P5', subject: 'science' },
    null
  ];
  const entries = S.shelfEntries(own, sets);
  eq('own worksheets come first, then every set worksheet not yet started, and a started one is not doubled',
     entries.map(e => e.id), ['w1', 'w2', 'set:a2']);
  const fresh = entries[2];
  ok('a set entry carries what the shelf files by — level, subject, topic, school, pages — and is stamped by the set date',
     fresh.set === sets[1] && fresh.level === 'P5' && fresh.subject === 'science' && fresh.topic === 'Heat' &&
     fresh.school === 'Nan Hua' && fresh.pageCount === 4 && fresh.updatedAt === 60 && fresh.name === 'Fresh');
  eq('…so it stands ON the same shelf, beside the started papers on its topic',
     S.shelfGroups(entries).map(g => g.level + '|' + g.subject + ':' + g.items.map(w => w.id).join(',')),
     ['P5|science:w2,set:a2,w1']);
  eq('an empty home is empty', S.shelfEntries([], []), []);
  eq('a set worksheet whose level nobody has answered is still an entry (the filter is the caller\'s)',
     S.shelfEntries([], [{ id: 'a9', name: 'x' }]).map(e => e.id), ['set:a9']);
  ok('the shelf draws a set entry with the set card and every card as a booklet',
     /var card = w\.set \? setCardNode\(w\.set\) : wsCardNode\(w, recent \? \{[\s\S]{0,260}\} : null\);\n\s*card\.classList\.add\('booklet'\);/.test(html));
  ok('a set worksheet not opened yet says so on its cover',
     /if \(!mine\) meta\.appendChild\(chipNode\('✨ Not opened yet', 'chip chipNew'\)\);/.test(html));
  ok('the set record carries the topic and the school the shelf files by',
     /topic: w\.topic \|\| '',\n\s*school: w\.school \|\| '',[\s\S]{0,700}\n\s*guidance: level,/.test(html));
  /* THE WOOD AND THE BOOKLETS, against the stylesheet. Drawn, never a
     picture: a school wifi that blocks the image leaves a broken tile
     behind every shelf. */
  ok('the shelf is drawn in wood from gradients, with no picture to fetch',
     /\.shelf \{[^}]*--wood: #A9743F;[^}]*repeating-linear-gradient\(90deg,/.test(html) &&
     !/\.shelf \{[^}]*url\(/.test(html));
  ok('the plank is the same timber, lit on its edge with a shadow under it',
     /\.shelfPlank \{[^}]*var\(--wood-edge\)[^}]*box-shadow: 0 8px 14px/.test(html));
  ok('a booklet has a spine with two staples, and its sheets fan out at the right edge',
     /\.wsCard\.booklet::before \{[^}]*#2F4858/.test(html) &&
     /\.wsCard\.booklet \{[^}]*1px 0 0 #F2ECDD, 2px 0 0 #E4DCCB/.test(html));
  ok('a set booklet wears the class\'s blue spine', /\.wsCard\.booklet\.setCard::before \{[^}]*#1565C0/.test(html));
  /* =====================================================================
     🗂 SHELVES THE TEACHER MAKES (v1.37.0)
     ---------------------------------------------------------------------
     Every failure here is silent and the bookcase still paints, which is
     why each of these is a case rather than a comment: a paper on a shelf
     nobody draws looks exactly like a paper that was never uploaded.
     ===================================================================== */
  /* ① THE CATALOGUE READER. It is the one door every path that shows or
        writes a shelf goes through, so a record half-written by a failed
        version can never paint a nameless shelf onto the bookcase. */
  eq('junk, nameless and duplicate shelves never reach the bookcase',
     S.shelfNorm([
       { id: 'a', name: 'Prelims', order: 1 },
       null, 'nope', { name: 'no id' }, { id: 'b' },
       { id: 'a', name: 'the same id twice' },
       { id: 'c', name: '  2025   papers  ', order: 0 }
     ]).map(x => x.id + ':' + x.name), ['c:2025 papers', 'a:Prelims']);
  eq('a shelf with no order sorts where it was written, and a name is folded and capped',
     S.shelfNorm([{ id: 'x', name: 'z'.repeat(80) }])[0].name.length, 48);
  eq('a bookcase holds no more shelves than one Firestore document can',
     S.shelfNorm(Array.from({ length: 400 }, (_, i) => ({ id: 's' + i, name: 'n' + i }))).length, 120);
  eq('an empty catalogue is an empty bookcase', S.shelfNorm(undefined), []);
  const cat = S.shelfNorm([
    { id: 's1', name: '2025 papers', order: 0 },
    { id: 's2', name: 'Prelims', order: 1 }
  ]);
  eq('a shelf is found and named by its id', [S.shelfLabel(cat, 's2'), S.shelfLabel(cat, 'gone')], ['Prelims', '']);

  /* ①½ 🗂 THE ORDER OF THE SHELVES THEMSELVES. The one thing that makes
         this whole feature either work or quietly not happen is the
         RENUMBER: `shelfSave` runs `shelfNorm` before it writes, and
         `shelfNorm` sorts by `order` FIRST — so a list whose array order
         was changed and whose `order` fields were not is sorted straight
         back into the arrangement it started in. The write lands, the
         toast says the shelf moved, the bookcase repaints exactly as it
         was, and nothing on any screen says why. */
  const three = S.shelfNorm([
    { id: 's1', name: 'A', order: 0 },
    { id: 's2', name: 'B', order: 1 },
    { id: 's3', name: 'C', order: 2 }
  ]);
  eq('a shelf moved to the front is STILL at the front once the catalogue is re-read',
     S.shelfNorm(S.shelfReorder(three, 's3', 0)).map(s => s.id), ['s3', 's1', 's2']);
  eq('…which is the renumber: every shelf is written back with the place it now stands in',
     S.shelfReorder(three, 's3', 0).map(s => s.order), [0, 1, 2]);
  eq('▼ moves a shelf one place down the bookcase and ▲ one place up',
     [S.shelfReorder(three, 's1', 1).map(s => s.id).join(','),
      S.shelfReorder(three, 's3', 1).map(s => s.id).join(',')],
     ['s2,s1,s3', 's1,s3,s2']);
  eq('a move carries the shelf\'s own name with it, so nothing is renamed by being dragged',
     S.shelfReorder(three, 's3', 0).map(s => s.name), ['C', 'A', 'B']);
  /* A shelf that is no longer on the bookcase cannot be moved, and putting
     it back would be a reorder resurrecting a shelf somebody deleted. */
  eq('a shelf the catalogue no longer has moves nothing and is never put back',
     S.shelfReorder(three, 'gone', 0).map(s => s.id), ['s1', 's2', 's3']);
  eq('a position that is not a number moves nothing at all',
     [S.shelfReorder(three, 's3', 'x').map(s => s.id).join(','),
      S.shelfReorder(three, 's3', undefined).map(s => s.id).join(',')],
     ['s1,s2,s3', 's1,s2,s3']);
  /* An index worked out from a RANK is clamped to the ends — the honest
     answer to "further than the bookcase goes" — where a POSITION on a
     child's page is never clamped (`_markAt`), because there a clamp is a
     guess about which question was meant. */
  eq('a place off either end of the bookcase is pulled to the end, never dropped',
     [S.shelfReorder(three, 's1', 99).map(s => s.id).join(','),
      S.shelfReorder(three, 's3', -5).map(s => s.id).join(',')],
     ['s2,s3,s1', 's3,s1,s2']);
  eq('moving a shelf to where it already stands changes nothing',
     S.shelfReorder(three, 's2', 1).map(s => s.id), ['s1', 's2', 's3']);
  eq('an empty bookcase has nothing to move', S.shelfReorder([], 's1', 0), []);
  ok('the reorder is PURE — the catalogue it was handed is untouched by any of that',
     three.map(s => s.id + ':' + s.order).join(',') === 's1:0,s2:1,s3:2');

  /* ② WHICH SHELF A PAPER IS ON — the whole of “every student has the same
        papers on the same shelves”. The ASSIGNMENT is read over the copy,
        so the teacher moving a paper this morning moves it for the child
        who started it yesterday. Read off each copy instead and the move
        would only ever reach the students who had not begun. */
  const live = [{ id: 'a1', shelf: 's2' }];
  eq('a student\'s copy reads the shelf LIVE off the assignment, never its own stale field',
     S.worksheetShelfId({ id: 'w1', assignmentId: 'a1', shelf: 's1' }, live, true), 's2');
  eq('…and the teacher\'s own paper, which IS the assignment, the same way',
     S.worksheetShelfId({ id: 'a1', shelf: 's1' }, live, true), 's2');
  eq('until the assignment list has arrived the copy\'s own field stands, so a cold start is not a bookcase emptied for a second',
     S.worksheetShelfId({ id: 'w1', assignmentId: 'a1', shelf: 's1' }, live, false), 's1');
  eq('a paper nobody set is the owner\'s own arrangement',
     S.worksheetShelfId({ id: 'own', shelf: 's1' }, live, true), 's1');
  eq('a set worksheet not yet started reads the assignment it IS',
     S.worksheetShelfId({ id: 'set:a1', set: { id: 'a1', shelf: 's2' } }, [], true), 's2');
  eq('nothing anywhere is the unsorted shelf', [S.worksheetShelfId(null, live, true), S.worksheetShelfId({ id: 'x' }, live, true)], ['', '']);

  /* ②½ 📄 WHAT A PAPER IS CALLED, and the whole of “rename it once and the
         class reads the new name”. Same rule as the shelf above and for the
         same reason — a name kept per copy would only ever govern the
         students who had not started yet — with ONE deliberate difference:
         an EMPTY live name is not an answer. */
  const named = [{ id: 'a1', name: 'Prelim 2025' }];
  eq('a student\'s copy reads the name LIVE off the assignment, never its own stale field',
     S.worksheetName({ id: 'w1', assignmentId: 'a1', name: 'Prelim 2024' }, named, true), 'Prelim 2025');
  eq('…and the teacher\'s own paper, which IS the assignment, the same way',
     S.worksheetName({ id: 'a1', name: 'Prelim 2024' }, named, true), 'Prelim 2025');
  eq('until the assignment list has arrived the copy\'s own name stands, so a cold start is not a bookcase of blank cards',
     S.worksheetName({ id: 'w1', assignmentId: 'a1', name: 'Prelim 2024' }, named, false), 'Prelim 2024');
  eq('a paper nobody set is the owner\'s own name',
     S.worksheetName({ id: 'own', name: 'My notes' }, named, true), 'My notes');
  eq('a set worksheet not yet started reads the assignment it IS',
     S.worksheetName({ id: 'set:a1', set: { id: 'a1', name: 'Prelim 2025' } }, [], true), 'Prelim 2025');
  /* THE ONE DIFFERENCE FROM THE SHELF: '' is a real shelf and is not a real
     name, so an assignment set before it was named must not blank a copy
     that has a perfectly good title. */
  eq('an EMPTY live name falls back to the copy\'s own rather than blanking it',
     S.worksheetName({ id: 'w1', assignmentId: 'a1', name: 'Prelim 2024' }, [{ id: 'a1', name: '   ' }], true),
     'Prelim 2024');
  eq('a paper with no name anywhere still reads as something',
     [S.worksheetName({ id: 'x' }, named, true), S.worksheetName({ id: 'set:z', set: { id: 'z' } }, [], true)],
     ['Untitled', 'Worksheet']);
  eq('nothing at all is the empty string', S.worksheetName(null, named, true), '');

  /* A TYPED NAME IS TIDIED AND NEVER INVENTED. An empty answer comes back
     EMPTY so the rename can refuse it — writing “Untitled” over a paper
     that had a title is not what a mis-tap should cost. */
  eq('the whitespace in a pasted title is folded to one line',
     S.wsNameClean('  Nan Hua\n P5   Science \t SA2  '), 'Nan Hua P5 Science SA2');
  eq('nothing typed comes back EMPTY, never a made-up name',
     [S.wsNameClean(''), S.wsNameClean('   '), S.wsNameClean(null), S.wsNameClean(undefined)], ['', '', '', '']);
  eq('a name longer than the cap is cut rather than allowed to be a shelf wide',
     S.wsNameClean('x'.repeat(200)).length, S.WS_NAME_MAX);
  eq('…and a name inside the cap is byte-for-byte what was typed',
     S.wsNameClean('P5 Science SA2 2024'), 'P5 Science SA2 2024');

  /* ③ AN UNKNOWN SHELF ID READS AS UNSORTED. That one line is what makes
        taking a shelf off the bookcase safe — its papers fall back onto
        “Not on a shelf yet” rather than into a section nothing draws, so a
        paper can never be lost by shelf bookkeeping. */
  const shelved = [
    { id: 'p', level: 'P5', subject: 'science', updatedAt: 9, shelf: 's1' },
    { id: 'q', level: 'P5', subject: 'science', updatedAt: 8, shelf: 's2' },
    { id: 'r', level: 'P5', subject: 'science', updatedAt: 7, shelf: 'DELETED' },
    { id: 't', level: 'P5', subject: 'science', updatedAt: 6 }
  ];
  const shelfOf = w => w.shelf || '';
  eq('a paper on a shelf that has gone is back with the unsorted ones, never lost',
     S.shelfGroups(shelved, { shelves: cat, shelfOf }).map(g => g.shelf + ':' + g.items.map(w => w.id).join(',')),
     ['s1:p', 's2:q', ':r,t']);
  eq('the shelves stand in the teacher\'s order and the unsorted one is ALWAYS last',
     S.shelfGroups(shelved, { shelves: S.shelfNorm([{ id: 's2', name: 'Prelims', order: 0 }, { id: 's1', name: '2025 papers', order: 1 }]), shelfOf })
       .map(g => g.shelf), ['s2', 's1', '']);
  /* With no shelves made, this is byte-for-byte the bookcase the app had
     before they existed — which is what makes a centre that never makes
     one completely unaffected. */
  eq('called with nothing, the grouping is exactly what it always was',
     S.shelfGroups(shelved).map(g => g.level + '|' + g.subject + '|' + g.shelf + ':' + g.items.map(w => w.id).join(',')),
     ['P5|science|:p,q,r,t']);
  eq('a shelf says its name, and the class it is under unless that class is the one being shown',
     [S.shelfTitle({ level: 'P5', subject: 'science', shelf: 's1' }, { shelves: cat }),
      S.shelfTitle({ level: 'P5', subject: 'science', shelf: 's1' }, { shelves: cat, scoped: true }),
      S.shelfTitle({ level: 'P5', subject: 'science', shelf: '' }, { shelves: cat, scoped: true }),
      S.shelfTitle({ level: 'P5', subject: 'science', shelf: '' }, { shelves: [] })],
     ['P5 · Science · 2025 papers', '2025 papers', 'Not on a shelf yet', 'P5 · Science']);

  /* ④ THE SCOPE NEVER HIDES WORK. A paper with no level or no subject
        passes every scope, so picking a class can never make somebody's
        own untagged upload disappear — it stands on its own “Any level”
        shelf instead, which is `canSeeWorksheet`'s rule applied to the
        picker. */
  ok('a scope narrows to one class',
     S.shelfInScope({ level: 'P5', subject: 'science' }, { level: 'P5', subject: 'science' }) &&
     !S.shelfInScope({ level: 'P6', subject: 'science' }, { level: 'P5', subject: '' }) &&
     !S.shelfInScope({ level: 'P5', subject: 'math' }, { level: '', subject: 'science' }));
  ok('…and an UNTAGGED paper passes every scope there is',
     S.shelfInScope({ level: '', subject: '' }, { level: 'P5', subject: 'science' }) &&
     S.shelfInScope({ level: 'P5', subject: '' }, { level: 'P5', subject: 'math' }) &&
     S.shelfInScope({ id: 'x' }, { level: 'S1', subject: 'chinese' }));
  ok('an empty scope is every paper', S.shelfInScope({ level: 'P6', subject: 'math' }, {}));

  /* ⑤ 🕒 RECENTLY OPENED. The LATER of `lastOpenedAt` and `updatedAt`,
        because either alone is a shelf that quietly misses half of what
        belongs on it: a paper written on and never re-opened, and a paper
        opened and read without a mark. */
  const T = 1_700_000_000_000;
  eq('the later of opened and saved is when a paper was last worked on',
     [S.shelfRecentStamp({ lastOpenedAt: T, updatedAt: T - 5000 }),
      S.shelfRecentStamp({ lastOpenedAt: T - 5000, updatedAt: T }),
      S.shelfRecentStamp({ updatedAt: T })], [T, T, T]);
  eq('a set worksheet nobody has started has never been opened, whatever the set date says',
     S.shelfRecentStamp({ set: { id: 'a1' }, updatedAt: T }), 0);
  const recent = S.shelfRecentItems([
    { id: 'old', updatedAt: T - 90 * 86400000 },
    { id: 'now', updatedAt: T - 1000 },
    { id: 'yday', updatedAt: T - 26 * 3600000 },
    { id: 'never' },
    { id: 'skew', updatedAt: T + 40 * 86400000 },
    { id: 'set:a', set: { id: 'a' }, updatedAt: T }
  ], { now: T });
  eq('newest first, nothing that was never opened, nothing outside the window',
     recent.map(r => r.w.id), ['now', 'yday']);
  ok('…and a clock a month fast cannot pin a paper to the front of the shelf for ever',
     !recent.some(r => r.w.id === 'skew'));
  eq('the shelf is capped: it is a shelf, not a log',
     S.shelfRecentItems(Array.from({ length: 40 }, (_, i) => ({ id: 'w' + i, updatedAt: T - i * 1000 })), { now: T }).length, 12);
  eq('the stamp comes back WITH the paper, so the card and the shelf cannot disagree about when',
     recent[0].t, T - 1000);
  eq('how long ago, in words',
     [S.shelfAgo(T - 30000, T), S.shelfAgo(T - 20 * 60000, T), S.shelfAgo(T - 5 * 3600000, T),
      S.shelfAgo(T - 30 * 3600000, T), S.shelfAgo(T - 4 * 86400000, T), S.shelfAgo(0, T)],
     ['just now', '20 minutes ago', '5 hours ago', 'yesterday', '4 days ago', '']);

  /* ⑥ THE ONE PLACE A HOME SCREEN BECOMES AN ORDERED LIST OF SHELVES. */
  const home = [
    { id: 'p', level: 'P5', subject: 'science', updatedAt: T - 1000, shelf: 's1' },
    { id: 'q', level: 'P5', subject: 'science', updatedAt: T - 9000, shelf: 's2' },
    { id: 'u', level: 'P6', subject: 'math', updatedAt: T - 3000, shelf: 's1' },
    { id: 'n', level: '', subject: '', updatedAt: T - 4000 }
  ];
  const secAll = S.shelfSections(home, { shelves: cat, shelfOf, now: T });
  eq('🕒 Recently opened leads the bookcase, then the shelves in order, then the unsorted',
     secAll.map(x => x.kind + ':' + (x.shelf || '-')),
     ['recent:recent', 'shelf:s1', 'shelf:s2', 'shelf:s1', 'shelf:-']);
  eq('…and a paper on the recent shelf is STILL standing on its own shelf below it',
     [secAll[0].items.map(w => w.id).join(','), secAll[1].items.map(w => w.id).join(',')],
     ['p,u,n,q', 'p']);
  eq('with one class in view the headings lose the class and keep it on anything else',
     S.shelfSections(home, { shelves: cat, shelfOf, now: T, scope: { level: 'P5', subject: 'science' } })
       .filter(x => x.kind === 'shelf').map(x => x.title),
     ['2025 papers', 'Prelims', 'Any level · Any subject · Not on a shelf yet']);
  eq('…and an untagged paper of somebody\'s own is never filtered away by a scope',
     S.shelfSections(home, { shelves: cat, shelfOf, now: T, scope: { level: 'P5', subject: 'science' } })
       .filter(x => x.kind === 'shelf').map(x => x.items.map(w => w.id).join(',')),
     ['p', 'q', 'n']);
  /* THE EMPTY SHELVES ARE THE TEACHER'S OWN, and only with ONE class in
     view: a shelf is a label with no class of its own, so on “every class”
     there is no heading it could honestly stand under. A shelf you cannot
     see is a shelf you cannot drag onto, and one made a moment ago that
     does not appear reads as a creation that failed. */
  const cat3 = S.shelfNorm(cat.concat([{ id: 's3', name: 'Heat revision', order: 2 }]));
  eq('the teacher sees a shelf with nothing on it yet, in its place, with somewhere to drop',
     S.shelfSections(home, { shelves: cat3, shelfOf, now: T, showEmpty: true, scope: { level: 'P5', subject: 'science' } })
       .filter(x => x.kind === 'shelf').map(x => (x.shelf || '-') + (x.empty ? '!' : '')),
     ['s1', 's2', 's3!', '-!', '-']);
  ok('a student is never shown an empty shelf',
     !S.shelfSections(home, { shelves: cat3, shelfOf, now: T, scope: { level: 'P5', subject: 'science' } })
       .some(x => x.kind === 'shelf' && !x.items.length));
  ok('…and neither is the teacher on “every class”, where a label has no class to stand under',
     !S.shelfSections(home, { shelves: cat3, shelfOf, now: T, showEmpty: true })
       .some(x => x.kind === 'shelf' && !x.items.length));
  ok('nothing at all is no shelves rather than a page of empty ones',
     S.shelfSections([], { shelves: cat, shelfOf, now: T }).length === 0);

  /* ⑦ THE RULES THAT CANNOT BE READ OFF A PURE FUNCTION, against the file.
        The catalogue lives in a collection whose Firestore rules already
        exist — a collection of its own would need a line in another
        repository's rules and would fail CLOSED until somebody deployed
        it, with nothing on any screen to say why. */
  ok('the catalogue is one reserved document in the collection the assignments already use',
     /db\.collection\(ASSIGN_COLLECTION\)\.doc\(SHELF_DOC_ID\)/.test(html) &&
     !/collection\('tutorShelves'\)/.test(html));
  /* 🐛 v1.37.0 NAMED IT `__shelves__` AND FIRESTORE REFUSED EVERY READ AND
     EVERY WRITE — an id matching `__.*__` is RESERVED. Making a shelf
     toasted “Resource id … is invalid because it is reserved”, and the
     READ failed with it too: caught, so the bookcase simply stood there
     with no shelves on it and nothing on the screen said why. A document
     id is data, and this one is typed into the source rather than
     generated, so the SHAPE is what has to be pinned. */
  const shelfDocId = (html.match(/var SHELF_DOC_ID = '([^']*)';/) || [])[1];
  ok('the catalogue\'s document id is an ORDINARY one, never a reserved `__…__` name',
     !!shelfDocId && !/^__.*__$/.test(shelfDocId) && /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(shelfDocId));
  ok('…and no id typed into this file wears that shape, the 🕒 section key included',
     ![...html.matchAll(/var SHELF_\w*ID = '([^']*)';/g)].some(m => /^__.*__$/.test(m[1])));
  ok('…and it can never come back as a worksheet set for a class',
     /active: false,/.test(html) && /if \(d\.id === SHELF_DOC_ID\) return;/.test(html));
  ok('a denied read leaves the bookcase the one this app had before shelves existed, never an error',
     /console\.warn\('shelves: the catalogue could not be read', e\);\n\s*shelves = \[\];/.test(html));
  ok('every write to the bookcase goes through the ONE writer',
     (html.match(/db\.collection\(ASSIGN_COLLECTION\)\.doc\(SHELF_DOC_ID\)\.set\(/g) || []).length === 1);
  /* THE ASSIGNMENT IS WRITTEN FIRST, because it is the record the whole
     class reads: it is what makes “the same papers on the same shelves”
     true, and a teacher's own row that moved while the class's did not is
     the one outcome worth refusing to report as a success. */
  const mover = between('async function moveWorksheetToShelf(', '\n/* ---- Which level and subject are in view', 'the mover');
  ok('the mover writes the ASSIGNMENT before the teacher\'s own row',
     mover.indexOf('db.collection(ASSIGN_COLLECTION).doc(aid).set({ shelf: shelfId }') <
     mover.indexOf('db.collection(COLLECTION).doc(w.id).set({ shelf: shelfId }'));
  ok('…and it refuses anybody but the teacher IN THE HANDLER, not only on the button',
     /async function moveWorksheetToShelf\(id, shelfId\) \{\n\s*if \(!isAdmin\(currentUser\)\)/.test(html));
  ok('…and a shelf that is not on the bookcase any more', /if \(shelfId && !shelfFind\(shelves, shelfId\)\)/.test(mover));
  ok('…and a refused write is NAMED, with the rule to paste',
     /PERMISSION_DENIED/.test(mover) && /assignRulesHint\(\)/.test(mover));
  ok('a copy is never the arrangement: only a paper of the teacher\'s own writes its own row',
     /if \(w && !w\.assignmentId\) \{\n\s*await db\.collection\(COLLECTION\)\.doc\(w\.id\)\.set/.test(mover));
  /* BOTH WAYS OF MOVING A PAPER END AT THE ONE MOVER. `dragstart` is never
     fired by a touchscreen, so a shelf reachable only by dragging is a
     shelf the teacher cannot use on the iPad they teach from. */
  ok('dragging and the 🗂 button both end at the one mover',
     /if \(id && id\.indexOf\(SHELF_DRAG_PREFIX\) !== 0\) moveWorksheetToShelf\(id, g\.shelf \|\| ''\);/.test(html) &&
     /mv\.addEventListener\('click', function \(\) \{ openShelfPick\(w\.id\); \}\);/.test(html));
  ok('the dragged paper is remembered on dragstart, because a shelf may not ask during dragover',
     /var _shelfDragId = '';/.test(html) &&
     /item\.addEventListener\('dragstart', function \(e\) \{\n\s*_shelfDragId = w\.id;/.test(html) &&
     /item\.addEventListener\('dragend', function \(\) \{\n\s*_shelfDragId = '';/.test(html));
  ok('🕒 the recently-opened shelf is not a drop target — it is a view, not a place',
     /if \(teacher && !recent\) \{\n\s*shelf\.dataset\.shelfId/.test(html));
  /* 🗂 THE ORDER OF THE SHELVES IS THE TEACHER'S TOO, and it is written on
     the CATALOGUE every class reads — so a bookcase arranged this morning
     is the bookcase every child opens. Both ways of moving a whole shelf
     end at `moveShelfTo`, exactly as a dragged booklet and the 🗂 button on
     a card both end at `moveWorksheetToShelf`. */
  const shelfMover = between('async function moveShelfTo(', '\n/* 🗂 THE ONE MOVER.', 'the shelf mover');
  ok('the shelf mover refuses anybody but the teacher IN THE HANDLER, not only on the button',
     /async function moveShelfTo\(id, to\) \{\n\s*if \(!isAdmin\(currentUser\)\)/.test(html));
  ok('…and a shelf that is not on the bookcase any more',
     /var s = shelfFind\(shelves, id\);\n\s*if \(!s\)/.test(shelfMover));
  ok('…and it writes through the ONE writer, never a `.set` of its own',
     /if \(!await shelfSave\(next\)\) return false;/.test(shelfMover) && !/\.set\(/.test(shelfMover));
  ok('a shelf that did not move is not reported as one that did',
     /if \(shelfRank\(next, id\) === from\) return false;/.test(shelfMover));
  ok('both ways of moving a WHOLE shelf end at the one shelf mover',
     (html.match(/moveShelfTo\(/g) || []).length === 4 &&
     /if \(g\.shelf && moving !== g\.shelf\) moveShelfTo\(moving, shelfRank\(shelves, g\.shelf\)\);/.test(html) &&
     /moveShelfTo\(g\.shelf, shelfRank\(shelves, g\.shelf\) - 1\);/.test(html) &&
     /moveShelfTo\(g\.shelf, shelfRank\(shelves, g\.shelf\) \+ 1\);/.test(html));
  /* ▲ ▼ ARE THE TOUCH HALF. `dragstart` is never fired by a touchscreen,
     so a bookcase arrangeable only by dragging is one the teacher cannot
     arrange on the iPad they teach from — and they are `shelfTool`, never
     `shelfBtn`, or a phone hides them along with the ‹ › buttons. */
  ok('▲ ▼ survive a phone, because they are not the buttons the phone drops',
     /up\.className = 'iconBtn shelfTool';/.test(html) &&
     /down\.className = 'iconBtn shelfTool';/.test(html) &&
     !/(?:up|down)\.className = '[^']*shelfBtn/.test(html));
  ok('…and the rank is RE-READ when one is pressed, because the button outlives the catalogue it was drawn from',
     /up\.addEventListener\('click', function \(\) \{\n\s*moveShelfTo\(g\.shelf, shelfRank\(shelves, g\.shelf\) - 1\);/.test(html));
  ok('…and they are disabled at the ends rather than silently doing nothing',
     /up\.disabled = !\(rank > 0\);/.test(html) &&
     /down\.disabled = !\(isFinite\(rank\) && rank < shelves\.length - 1\);/.test(html));
  /* THE TWO DRAGS ARE HELD APART, in three ways at once: a global of its
     own, a NAMESPACED payload, and ONE dispatcher that asks which move is
     being made before it does anything. A shelf read as a paper would hand
     a shelf id to `moveWorksheetToShelf` as a worksheet's. */
  ok('a shelf being dragged is remembered in a global of its OWN, never the paper\'s',
     /var _shelfOrderDragId = '';/.test(html) &&
     /grip\.addEventListener\('dragstart', function \(e\) \{\n\s*_shelfOrderDragId = g\.shelf;/.test(html));
  ok('…and it is ALWAYS let go of on dragend, or the next drop moves what was picked up a minute ago',
     /grip\.addEventListener\('dragend', function \(\) \{\n\s*_shelfOrderDragId = '';/.test(html));
  ok('…and its payload is namespaced, so the paper\'s own fallback refuses it',
     /var SHELF_DRAG_PREFIX = 'shelf:';/.test(html) &&
     /setData\('text\/plain', SHELF_DRAG_PREFIX \+ g\.shelf\)/.test(html));
  ok('ONE dispatcher decides which drag it is, and asks about the shelf FIRST',
     /shelf\.addEventListener\('dragover', function \(e\) \{\n\s*if \(_shelfOrderDragId\) \{/.test(html) &&
     /shelf\.addEventListener\('drop', function \(e\) \{[\s\S]{0,200}?if \(_shelfOrderDragId\) \{/.test(html));
  /* A shelf may not be dropped on the unsorted shelf (always last by rule)
     or on itself, and `shelfOrderSlot` returning '' is what withholds the
     `preventDefault` that would make either a drop target. */
  ok('a shelf is never dropped on itself or on the unsorted shelf, which is last by rule',
     /if \(!_shelfOrderDragId \|\| !targetId \|\| targetId === _shelfOrderDragId\) return '';/.test(html) &&
     /var slot = shelfOrderSlot\(g\.shelf\);\n\s*[\s\S]{0,260}?if \(!slot\) return;/.test(html));
  ok('…and the grip is drawn for the teacher alone, and never on 🕒 Recently opened',
     /if \(teacher && !recent && g\.shelf\) \{\n\s*var grip = document\.createElement\('span'\);/.test(html));
  ok('every lit drop target is cleared, whichever of the two drags lit it',
     /lit\[i\]\.classList\.remove\('shelfDrop', 'shelfOrderBefore', 'shelfOrderAfter'\);/.test(html) &&
     /querySelectorAll\('\.shelf\.shelfDrop, \.shelf\.shelfOrderBefore, \.shelf\.shelfOrderAfter'\)/.test(html));
  /* `.shelf::before` / `::after` are the bookcase's own uprights, so the
     drop indicator is an outline and a nudge rather than a third pseudo
     element — and both stand down for a teacher who asked for less motion. */
  ok('the drop indicator moves the shelf rather than borrowing the uprights',
     /\.shelf\.shelfOrderBefore \{ transform: translateY\(12px\); \}/.test(html) &&
     /\.shelf\.shelfOrderBefore, \.shelf\.shelfOrderAfter \{ transition: none; transform: none; \}/.test(html));
  /* 🕒 `lastOpenedAt` must never be the reason a worksheet does not open. */
  ok('when it was last opened is written fire-and-forget, as one merged field',
     /\.set\(\{ lastOpenedAt: firebase\.firestore\.FieldValue\.serverTimestamp\(\) \}, \{ merge: true \}\)\n\s*\.catch\(/.test(html));
  ok('…and locally too, so the shelf is right without waiting for a reload',
     /if \(mine\) mine\.lastOpenedAt = w\.lastOpenedAt;/.test(html));
  /* THE SHELF TRAVELS WITH THE PAPER, or the class is looking at a
     bookcase the teacher never arranged. */
  ok('the push carries the shelf onto the assignment every student reads',
     /shelf: w\.shelf \|\| '',/.test(html));
  ok('…a fresh copy carries it too, for the moment before the list arrives',
     /shelf: a\.shelf \|\| '',/.test(html));
  ok('…and an upload lands on the shelf the pile was sent to',
     /shelf: s\.shelf \|\| '',/.test(html));
  ok('the upload reads its shelf ONCE with the rest of the dialog, never per file',
     /shelf: \(isAdmin\(currentUser\) && \$\('upShelf'\)\) \? String\(\$\('upShelf'\)\.value \|\| ''\) : '',/.test(
       between('function uploadSettings() {', 'async function uploadOne(', 'the upload settings')));
  /* ✎ and 🗑 are deliberately NOT `.shelfBtn`: that class is hidden on a
     phone to give the ‹ › buttons up to swiping, and a teacher who loses
     rename and delete on the device they teach from has lost the feature. */
  ok('the shelf tools survive a phone, because they are not the buttons the phone drops',
     /shelfTool/.test(html) && !/'iconBtn shelfBtn shelfTool'/.test(html) &&
     /\.shelfHead \.shelfTool \{/.test(html));
  ok('taking a shelf off asks first, and says the papers are not going with it',
     /confirm\('Take the shelf “' \+ s\.name \+ '” off the bookcase\?/.test(html));
  ok('the scope is remembered per device and a junk one reads as “every”',
     /var SHELF_SCOPE_KEY = 'tutorShelfScope';/.test(html) &&
     /LEVELS\.indexOf\(String\(raw\.level \|\| ''\)\) >= 0 \? String\(raw\.level\) : ''/.test(html));
  /* Read at LOAD and never from a sign-in hook: `adoptStudents` is the
     obvious place and runs for a STUDENT only, so the teacher — who uses
     the picker most — would find it reset on every single reload. */
  ok('…and it is read at load, not from a hook the teacher never reaches',
     /var shelfScope = \(function \(\) \{/.test(html) && !/loadShelfScope/.test(html));
  ok('the bar is over the bookcase, above the list it governs',
     /<div id="shelfBar" class="shelfBar hidden"><\/div>\n\s*<div id="wsList"><\/div>/.test(html));
  ok('a student never picks their own level, and is offered a subject only when they take more than one',
     /if \(!currentUser \|\| \(!teacher && subs\.length < 2\)\) \{ bar\.classList\.add\('hidden'\); return; \}/.test(html));

  /* AUTO-SET: the teacher's PDF goes onto the shelf its level and subject
     file it under, the moment it is uploaded — and only once both are
     known, because a paper set for no level is on nobody's shelf and looks
     to the teacher exactly like one that went out. */
  ok('the upload dialog ticks "put it on my students\' shelves" for the teacher by default',
     /if \(push\) push\.checked = isAdmin\(currentUser\);/.test(html));
  ok('…and the upload sets it only once the level AND the subject are known, after the read and the key scan',
     /if \(got\.level && got\.subject\) \{\n[\s\S]{0,700}var res = await pushWorksheet\(id, undefined, true, \{ quiet: !solo \}\);/.test(html) &&
     html.indexOf('await keyAutoScan(true, read);') < html.indexOf('if (got.level && got.subject) {'));
  /* IT COUNTED THE ASK, NOT THE ANSWER. `pushed = true` used to be set the
     moment pushWorksheet had been CALLED, so a refused write — the rules
     not allowing it yet, which is the commonest failure there is — was
     reported as a paper the class had been given, and the summary said
     "9 set for the class" over nine papers no child could see. */
  ok('…and a push that FAILED is never counted as one that went out',
     /pushed = !!\(res && res\.ok\);/.test(html) &&
     !/await pushWorksheet\(id\); pushed = true;/.test(html));
  /* A skip that is not NAMED is a paper missing from thirty shelves with
     nothing anywhere to say which one. It was `solo`-only, so in a pile of
     ten it was completely silent. */
  ok('…and every paper the batch could not set is named, with its reason',
     /else if \(out\.setSkip\) notSet\.push\(\{ name: out\.name, why: out\.setSkip \}\);/.test(html) &&
     /if \(notSet\.length\) msg \+= ' NOT set for the class: ' \+ blockedList\(notSet\)/.test(html));
  ok('a card wears its topic and its school', /chipNode\('📖 ' \+ w\.topic, 'chip chipTopic'\)/.test(html) && /chipNode\('🏫 ' \+ w\.school, 'chip chipSchool'\)/.test(html));
  ok('the school and the topic ride every save', /school: wsMeta\.school \|\| '',\n\s*topic: wsMeta\.topic \|\| '',/.test(html));
  ok('…and come back when a worksheet is opened', /wsMeta\.school = w\.school \|\| '';\n\s*wsMeta\.topic = w\.topic \|\| '';/.test(html));
  ok('…and are taken off the paper at upload', /wsMeta\.school = got\.school;\n\s*wsMeta\.topic = got\.topic;/.test(html));

  /* =================================================================
     🎓 A SHELF BELONGS TO ONE CLASS (v1.40.0)

     v1.37.0 made a shelf a LABEL with no class of its own, so “2025
     papers” stood on every bookcase at once — one shelf, eight classes.
     That is wrong for the way the centre actually files: a folder made
     under P6 · Mathematics is a P6 Maths folder, and an empty copy of it
     standing on P3 · Science is clutter nobody made.

     EVERY FAILURE BELOW IS SILENT and the bookcase still paints, so each
     one is pinned twice over — the pure predicate, and the reader that
     has to ask it.
     ================================================================= */
  /* `''` MEANS EVERY CLASS, and that direction is the whole migration:
     every shelf already on a live bookcase carries no level and no
     subject, so reading `''` as “nowhere” would empty a centre's whole
     bookcase on the deploy, with every paper on those shelves falling
     back to “Not on a shelf yet”. */
  ok('a shelf with no class of its own stands on every class, exactly as it did before v1.40.0',
     S.shelfFitsClass({ level: '', subject: '' }, 'P6', 'math') &&
     S.shelfFitsClass({}, 'P3', 'science') &&
     S.shelfFitsClass({ level: '', subject: '' }, '', ''),
     'a shelf made before this has no class — read `\'\'` as “nowhere” and the bookcase empties itself');
  ok('…and a P6 Maths shelf stands on P6 Maths and NOWHERE else',
     S.shelfFitsClass({ level: 'P6', subject: 'math' }, 'P6', 'math') &&
     !S.shelfFitsClass({ level: 'P6', subject: 'math' }, 'P5', 'math') &&
     !S.shelfFitsClass({ level: 'P6', subject: 'math' }, 'P6', 'science') &&
     !S.shelfFitsClass({ level: 'P6', subject: 'math' }, '', ''));
  /* The two halves are asked SEPARATELY, so “every P6 shelf” and “every
     Maths shelf” are both sayable — a shelf is never forced to name both. */
  ok('a shelf can name one half and leave the other open',
     S.shelfFitsClass({ level: 'P6', subject: '' }, 'P6', 'math') &&
     S.shelfFitsClass({ level: 'P6', subject: '' }, 'P6', 'science') &&
     !S.shelfFitsClass({ level: 'P6', subject: '' }, 'P5', 'science') &&
     S.shelfFitsClass({ level: '', subject: 'math' }, 'P4', 'math') &&
     !S.shelfFitsClass({ level: '', subject: 'math' }, 'P4', 'science'));
  ok('no shelf at all fits nothing', !S.shelfFitsClass(null, 'P6', 'math'));
  /* A record from a later version — or a level this build has never heard
     of — reads as EVERY class rather than as a shelf nothing can draw. */
  eq('the catalogue validates the class against this app\'s own ladder and subjects',
     S.shelfNorm([{ id: 'a', name: 'A', level: 'P6', subject: 'math' },
                  { id: 'b', name: 'B', level: 'P9', subject: 'latin' },
                  { id: 'c', name: 'C' }])
       .map(s => s.id + ':' + (s.level || '-') + '/' + (s.subject || '-')),
     ['a:P6/math', 'b:-/-', 'c:-/-']);
  /* A PAPER CAN NEVER BE LOST BY SHELF BOOKKEEPING — the rule the unknown
     id already followed, extended to a shelf of another class: the paper
     falls back onto “Not on a shelf yet” rather than dragging a P6 shelf
     onto the P5 bookcase. */
  {
    const cls = S.shelfNorm([{ id: 'p6m', name: '2025 papers', level: 'P6', subject: 'math', order: 0 },
                             { id: 'any', name: 'Topicals', order: 1 }]);
    const papers = [
      { id: 'a', level: 'P6', subject: 'math', shelf: 'p6m' },
      { id: 'b', level: 'P5', subject: 'science', shelf: 'p6m' },   // another class's shelf
      { id: 'c', level: 'P5', subject: 'science', shelf: 'any' }    // a shelf every class shares
    ];
    const shelfOf = w => w.shelf || '';
    eq('a paper wearing another class\'s shelf id is UNSORTED, never on that shelf',
       S.shelfGroups(papers, { shelves: cls, shelfOf })
         .map(g => g.level + '|' + g.subject + '|' + (g.shelf || '-') + ':' + g.items.map(w => w.id).join(',')),
       ['P5|science|any:c', 'P5|science|-:b', 'P6|math|p6m:a']);
    /* AND THE EMPTY SHELVES ARE NARROWED TOO — that is the reported bug:
       “when i create p6 shelves, empty shelves are linked to the other
       levels as well”. */
    eq('the teacher\'s empty shelves are only the ones this class really has',
       S.shelfSections(papers, { shelves: cls, shelfOf, now: 0, showEmpty: true,
                                 scope: { level: 'P5', subject: 'science' } })
         .filter(x => x.kind === 'shelf').map(x => (x.shelf || '-') + (x.empty ? '!' : '')),
       ['any', '-'],
       'the P6 Maths shelf must not stand empty on the P5 Science bookcase');
    ok('…and a P6 Maths shelf is drawn on the P6 Maths bookcase and on no other',
       S.shelfSections(papers, { shelves: cls, shelfOf, now: 0, showEmpty: true,
                                 scope: { level: 'P6', subject: 'math' } })
         .some(x => x.kind === 'shelf' && x.shelf === 'p6m') &&
       !S.shelfSections(papers, { shelves: cls, shelfOf, now: 0, showEmpty: true,
                                  scope: { level: 'P4', subject: 'math' } })
         .some(x => x.kind === 'shelf' && x.shelf === 'p6m'),
       'a shelf made under one class standing empty on every other is the whole reported fault');
    ok('…and a shelf every class shares is still drawn everywhere',
       ['P3|science', 'P6|math'].every(k => S.shelfSections(papers, {
         shelves: cls, shelfOf, now: 0, showEmpty: true,
         scope: { level: k.split('|')[0], subject: k.split('|')[1] }
       }).some(x => x.kind === 'shelf' && x.shelf === 'any')));
  }
  /* CALLED WITH NOTHING, `shelfGroups` IS STILL BYTE-FOR-BYTE WHAT IT WAS.
     Every centre that has never made a shelf is unaffected, which is the
     property that makes this safe to ship over a live bookcase. */
  eq('with no catalogue in hand a paper keeps whatever shelf it carries',
     S.shelfGroups([{ id: 'a', level: 'P6', subject: 'math', shelf: 'p6m' }],
                   { shelfOf: w => w.shelf || '' }).map(g => g.shelf),
     ['p6m']);
  /* ONE RESOLVER. The mover, the ✎ rename, the 🗂 picker and the drag all
     ask `shelfPaperOf` — four copies of that walk is four chances to read
     a `set:` entry's class off the wrong object. */
  {
    const keepW = S.worksheets, keepA = S.assignments;
    S.worksheets = [{ id: 'w1', assignmentId: 'a1', level: 'P5', subject: 'science' },
                    { id: 'own', level: 'P3', subject: 'science' }];
    S.assignments = [{ id: 'a1', level: 'P6', subject: 'math' }];
    eq('a paper of the student\'s own is its own class',
       (p => p.level + '|' + p.subject)(S.shelfPaperOf('own')), 'P3|science');
    eq('…and a copy\'s own fields win over the assignment\'s, because it IS the paper being moved',
       (p => p.level + '|' + p.subject + '|' + p.aid)(S.shelfPaperOf('w1')), 'P5|science|a1');
    eq('a SET paper that nobody has started is read off the assignment',
       (p => p.level + '|' + p.subject + '|' + (p.w ? 'w' : '-'))(S.shelfPaperOf('set:a1')), 'P6|math|-');
    ok('a paper nobody has comes back with neither, which every caller tests',
       (p => !p.w && !p.live)(S.shelfPaperOf('nope')));
    /* THE DRAG ASKS BEFORE IT LIGHTS UP: a shelf that highlights and then
       refuses is worse than one that never highlighted at all. */
    const keepS = S.shelves;
    S.shelves = S.shelfNorm([{ id: 'p6m', name: '2025', level: 'P6', subject: 'math', order: 0 },
                             { id: 'any', name: 'Topicals', order: 1 }]);
    ok('a shelf refuses the drag it is going to refuse the drop of',
       S.shelfDropOk('p6m', 'set:a1') && !S.shelfDropOk('p6m', 'own') &&
       S.shelfDropOk('any', 'own') && !S.shelfDropOk('gone', 'own'));
    ok('…and “Not on a shelf yet” takes anything, because it is where a refused paper goes',
       S.shelfDropOk('', 'own') && S.shelfDropOk('', 'nope'));
    S.shelves = keepS; S.worksheets = keepW; S.assignments = keepA;
  }
  /* THE SAME NAME ON TWO CLASSES IS TWO SHELVES. Refusing the second
     would refuse the very thing this narrowing is for; the same name on
     the SAME class is still one shelf twice. */
  ok('the duplicate check is per CLASS, never across the whole bookcase',
     /x\.name\.toLowerCase\(\) === nm\.toLowerCase\(\) &&\n\s*String\(x\.level \|\| ''\) === s\.level && String\(x\.subject \|\| ''\) === s\.subject/.test(html));
  /* `undefined` KEEPS the class. Every shelf made before v1.40.0 has
     none, so a careless `|| ''` is indistinguishable from a deliberate
     “every class” — and a caller that only wanted to rename would take a
     shelf's class off it in silence. */
  ok('a rename that says nothing about the class KEEPS it, rather than taking it off',
     /var lv = level === undefined \? String\(had\.level \|\| ''\) : String\(level \|\| ''\);/.test(html) &&
     /var sj = subject === undefined \? String\(had\.subject \|\| ''\) : String\(subject \|\| ''\);/.test(html));
  ok('…and moving a shelf to another class SAYS what happens to the papers that cannot follow',
     /Papers that are not ' \+ \(cls \|\| 'on it'\) \+ ' go back to/.test(html));
  /* REFUSED IN THE MOVER AS WELL AS NARROWED IN THE PICKER. Written
     without the handler check the write lands, the toast says it moved,
     and `shelfGroups` reads the id as unsorted on the very next paint —
     the paper back where it started with nothing on any screen saying why. */
  ok('the mover refuses a shelf of another class IN THE HANDLER, in words',
     /if \(sh && !shelfFitsClass\(sh, p\.level, p\.subject\)\) \{/.test(
       between('async function moveWorksheetToShelf(', '\n/* ---- Which level and subject are in view', 'the mover')));
  ok('…and the 🗂 picker offers only the shelves the mover would accept',
     /var mine = shelves\.filter\(function \(sh\) \{ return shelfFitsClass\(sh, pick\.level, pick\.subject\); \}\);/.test(html));
  /* A SHELF MADE **FOR A PAPER** OPENS ON THAT PAPER'S CLASS, because the
     paper is moved onto it the instant it is made: on the scope's class
     instead, a teacher looking at P5 · Science who makes a shelf for a P6
     Maths paper gets a P5 shelf the move is then refused by, and the shelf
     they just made stands empty on somebody else's bookcase. */
  ok('a shelf made FOR a paper opens on that paper\'s class, never on the class in view',
     /var here = shelfNameThenMove \? shelfPaperOf\(shelfNameThenMove\) : shelfScopeNow\(\);/.test(html) &&
     /var made = await shelfCreate\(nm, lv, sj\);\n\s*if \(made && mv\) await moveWorksheetToShelf\(mv, made\);/.test(html),
     'the create and the move it was made for must never disagree about the class');
  ok('…and COUNTS the ones it left out, so a shelf the teacher made is never silently absent',
     /var hidden = shelves\.length - mine\.length;/.test(html) &&
     /belong' \+ \(hidden === 1 \? 's' : ''\) \+ ' to a different class/.test(html));
  /* THE UPLOAD PICKER IS NARROWED BY THE CLASS BEING UPLOADED TO, and the
     class is chosen AFTER the dialog was built — so it is refilled on
     every change, bound ONCE rather than inside `openUploadModal`, which
     runs on every upload and would stack a listener per opening. */
  ok('the upload\'s shelf picker is narrowed by the level and subject being uploaded to',
     /function fillUploadShelves\(\) \{/.test(html) &&
     /if \(!open && !shelfFitsClass\(sh, lv, sj\)\) return;/.test(html));
  ok('…and it is refilled when either picker changes, from ONE listener bound once',
     /\['upLevel', 'upSubject'\]\.forEach\(function \(id\) \{\n\s*var el = \$\(id\);\n\s*if \(el\) el\.addEventListener\('change', function \(\) \{ fillUploadShelves\(\); \}\);/.test(html) &&
     (html.match(/addEventListener\('change', function \(\) \{ fillUploadShelves\(\); \}\)/g) || []).length === 1);
  ok('…and with no class chosen yet every shelf is offered, with its own class printed beside it',
     /var open = !lv \|\| !sj;/.test(html) &&
     /o\.textContent = '🗂 ' \+ sh\.name \+ \(open && cls \? '  \(' \+ cls \+ '\)' : ''\);/.test(html));
  ok('…and a shelf that has fallen out of the list is never left SELECTED',
     /sel\.value = '';\n\s*for \(var i = 0; i < sel\.options\.length; i\+\+\) if \(sel\.options\[i\]\.value === was\) sel\.value = was;/.test(html));
  /* THE SHELF IS WRITTEN AT CREATION, BEFORE THE READ — which is right, so
     the paper stands on the right shelf from its first paint. But the
     level and the subject may only have been settled by the read a moment
     ago, so a shelf that is not this paper's class is CLEARED and NAMED:
     a shelf the teacher chose and the bookcase silently ignored is the
     shape of fault this whole narrowing exists to end. */
  ok('an upload whose read put it in another class is taken OFF the shelf rather than left wearing it',
     /if \(chosen && !shelfFitsClass\(chosen, got\.level, got\.subject\)\) \{/.test(html) &&
     /\.set\(\{ shelf: '' \}, \{ merge: true \}\)/.test(html));
  ok('…and it is NAMED, on its own and in a pile of ten alike',
     /if \(solo\) toast\('Uploaded, but not on that shelf: ' \+ shelfSkip/.test(html) &&
     /if \(out\.shelfSkip\) offShelf\.push\(\{ name: out\.name, why: out\.shelfSkip \}\);/.test(html) &&
     /if \(offShelf\.length\) msg \+= ' NOT on that shelf: ' \+ blockedList\(offShelf\)/.test(html),
     'a count on its own leaves the teacher to work out which of ten papers is somewhere they did not put it');

  /* =================================================================
     ✎ RENAMING A PAPER — the class reads the new name, and nothing a
     child has written on it moves. Every failure below is silent: the
     rename lands, the toast says it did, and either the class never sees
     it or the teacher's own next auto-save quietly puts the old name back.
     ================================================================= */
  const ren = between('async function renameWorksheet(', '\n/* ---- Which level and subject are in view ----',
                      'the rename');
  ok('renaming refuses anybody but the teacher IN THE HANDLER, not only on the button',
     /if \(!isAdmin\(currentUser\)\) \{ toast\('Only ' \+ setterName\(\) \+ ' renames a paper\.'/.test(ren));
  /* An empty answer must never be written: "Untitled" over a paper that
     had a perfectly good title is not what a mis-tap should cost. */
  ok('…and an empty name is refused rather than written',
     /var nm = wsNameClean\(name\);\n\s*if \(!nm\) \{ toast\('Give it a name first\.'/.test(ren));
  ok('a paper that is no longer on the bookcase is refused',
     /if \(!w && !live\) \{ toast\('That paper is not on your bookcase any more\.'/.test(ren));
  ok('a name that has not changed writes nothing',
     /var was = worksheetName\(w \|\| \{ set: live \}, assignments, assignmentsLoaded\);\n\s*if \(was === nm\) return true;/.test(ren));
  /* ① THE ASSIGNMENT IS WRITTEN FIRST, because it is the record the whole
        class reads. The teacher's own row renamed while the class's was
        not is the outcome worth refusing to report as a success. */
  ok('the assignment the class reads is written FIRST',
     ren.indexOf('db.collection(ASSIGN_COLLECTION).doc(aid).set({ name: nm }, { merge: true })') > -1 &&
     ren.indexOf('db.collection(ASSIGN_COLLECTION)') < ren.indexOf('db.collection(COLLECTION)'));
  /* ② NOTHING BUT THE NAME. One merged field on each document is what
        leaves the ink, the hints, the marking, the mistake book, the key,
        the score and the help level exactly where they were. */
  ok('…and NOTHING but the name is written, on either document',
     (ren.match(/\{ name: nm \}, \{ merge: true \}/g) || []).length === 2 &&
     !/\bannotations\b|\bhints\b|\bmarking\b|\bscore\b|\bkeyPages\b|\bguidance\b/.test(ren));
  /* ③ A copy of somebody else's assignment writing its own row would
        quietly outrank the assignment the next time the list had not
        arrived — the rule `moveWorksheetToShelf` already carries. */
  ok('a copy of somebody else\'s assignment never writes a row of its own',
     /if \(w && !w\.assignmentId\) \{\n\s*await db\.collection\(COLLECTION\)\.doc\(w\.id\)\.set\(\{ name: nm \}, \{ merge: true \}\);/.test(ren));
  /* ④ THE ONE THAT IS EASY TO MISS. `performSave` writes `name: docName`
        on EVERY auto-save, so a rename made while that paper is open and
        not carried into `docName` is undone by the paper's own next save,
        a few seconds later, with nothing on any screen saying so. */
  ok('the open paper\'s title follows, or the next auto-save writes the OLD name straight back',
     /if \(currentDocId && currentDocId === \(w \? w\.id : ''\)\) setWsTitle\(nm\);/.test(ren));
  ok('a refused write is NAMED, with the rules hint',
     /the rules do not allow it yet\. ' \+ assignRulesHint\(\)/.test(ren));
  ok('…and it says the class sees the new name and their work does not move',
     /student’s shelf too\. Their work on it is untouched\./.test(ren));

  /* `setWsTitle` is the ONE door, because `docName` and the bar have to
     move together: a bar changed alone is a label, and a `docName` changed
     alone is a rename nobody can see until the next save writes it. */
  ok('there is ONE writer of the open paper\'s title',
     /function setWsTitle\(name\) \{\n\s*docName = String\(name \|\| ''\) \|\| 'Untitled';/.test(html) &&
     !/\$\('wsTitle'\)\.textContent = docName;/.test(html));
  /* The name is re-read AFTER the assignment list is in hand — the list
     may not have arrived when `loadPdf` ran, so reading it there alone is
     a session spent under the name the copy happens to carry. */
  ok('opening a paper reads its name live, and again once the class list is in',
     /await loadPdf\(new Uint8Array\(buf\), worksheetName\(w, assignments, assignmentsLoaded\)\);/.test(html) &&
     /if \(rule\.by\) wsMeta\.setBy = rule\.by;\n[\s\S]{0,600}setWsTitle\(worksheetName\(w, assignments, assignmentsLoaded\)\);/.test(html));
  ok('the card\'s heading is the live name, never the copy\'s own stale field',
     /h\.textContent = worksheetName\(w, assignments, assignmentsLoaded\);/.test(html));
  ok('the ✎ button is the teacher\'s, beside 🗂 Shelf',
     /ren\.textContent = '✎ Rename';/.test(html) &&
     /ren\.addEventListener\('click', function \(\) \{ openRenameModal\(w\.id\); \}\);/.test(html));
  ok('…and the dialog refuses a student too',
     /function openRenameModal\(id\) \{\n\s*if \(!isAdmin\(currentUser\)\) return;/.test(html));
  ok('the dialog opens on the name it already has, so a rename is an edit rather than a retype',
     /\$\('wsNameInput'\)\.value = was;/.test(html));
  ok('…and Enter confirms it, because renaming is one word and one key',
     /\$\('wsNameInput'\)\.addEventListener\('keydown', function \(e\) \{\n\s*if \(e\.key === 'Enter'\) \{ e\.preventDefault\(\); wsNameConfirm\(\); \}/.test(html));
  ok('the input is capped at the same number the cleaner is',
     new RegExp('id="wsNameInput"[^>]*maxlength="' + S.WS_NAME_MAX + '"').test(html));
}
eq('an unknown page count is not a stack', S.coverSheets(undefined), 0);

/* ---- Drawing it ---- */
function coverStub(opts) {
  const o = opts || {};
  const calls = { fills: [], rendered: 0 };
  const ctx = {
    set fillStyle(v) { calls.fill = v; },
    get fillStyle() { return calls.fill; },
    fillRect: (x, y, w, h) => calls.fills.push([x, y, w, h])
  };
  S.document.createElement = () => ({
    width: 0, height: 0,
    getContext: () => ctx,
    toDataURL: () => o.url || ('data:image/jpeg;base64,' + 'A'.repeat(o.len || 500))
  });
  const page = {
    getViewport: ({ scale }) => ({ width: 600 * scale, height: 850 * scale }),
    render: () => { calls.rendered++; return { promise: Promise.resolve() }; }
  };
  S.studentPages = () => (o.none ? [] : [{ num: o.num || 1, page }]);
  return calls;
}
const drawn = coverStub({});
const coverUrl = await S.makeCoverDataUrl();
ok('the first page the STUDENT has is drawn', drawn.rendered === 1);
/* A PDF page is transparent where nothing is drawn, and a transparent
   canvas flattens to BLACK in a JPEG — the whole page, ink and all. */
eq('the sheet is painted white first', drawn.fill, '#ffffff');
eq('…across the whole of it', drawn.fills.length, 1);
ok('what comes back is a picture', /^data:image\/jpeg/.test(coverUrl));

/* The cover and the body share ONE Firestore document, so a cover that will
   not fit comfortably underneath the body is not stored at all. */
coverStub({ len: S.COVER_MAX + 10 });
eq('a cover too big for the document is refused, not squeezed in',
   await S.makeCoverDataUrl(), '');

coverStub({ none: true });
eq('a worksheet with no pages the student can see has no cover',
   await S.makeCoverDataUrl(), '');

/* ---- Writing it ---- */
function coverWriter() {
  const writes = [];
  S.db = { collection: () => ({ doc: () => ({ set: (p, o) => { writes.push({ p, o }); return Promise.resolve(); } }) }) };
  S.currentUser = { uid: 'u1' };
  return writes;
}
coverStub({});
let cw = coverWriter();
await S.ensureCover('w1', '');
eq('a worksheet without one gets one', cw.length, 1);
eq('…written as a MERGE, never a set', cw[0].o && cw[0].o.merge, true);
ok('…and it is the only field it touches',
   Object.keys(cw[0].p).length === 1 && /^data:image\//.test(cw[0].p.cover));

cw = coverWriter();
await S.ensureCover('w1', 'data:image/jpeg;base64,AAAA');
eq('a worksheet that already has one is never redrawn', cw.length, 0);

cw = coverWriter();
S.db = { collection: () => ({ doc: () => ({ set: () => Promise.reject(new Error('denied')) }) }) };
const keptCover = await S.ensureCover('w1', '');
ok('a cover that could not be saved is never an error at the student',
   /^data:image\//.test(keptCover));
S.db = null;
S.currentUser = null;

/* ---- Where it is made, read out of the file ---- */
/* The 🔑 section exists to keep a marking scheme off the student's screen.
   Putting page 1 of it on the home screen instead is the same leak through
   a side door, so the cover reads `studentPages()` and is made AFTER the
   key scan at upload rather than beside the PDF write. */
ok('the cover is drawn from the pages the STUDENT has',
   /makeCoverDataUrl[\s\S]{0,400}studentPages\(\)/.test(html));
ok('…and it is made after the key scan, never before it',
   html.indexOf('await keyAutoScan(true, read)') < html.indexOf("await ensureCover(id, '')"));
ok('…which itself comes after the paper has been read, so the read\'s key pages are put away too',
   html.indexOf('read = await paperReadEnds()') > 0 &&
   html.indexOf('read = await paperReadEnds()') < html.indexOf('await keyAutoScan(true, read)'));
ok('an older worksheet gets one the first time it is opened',
   /offerLocalBackup\(id[\s\S]{0,320}ensureCover\(id, w\.cover\)/.test(html));
/* A class of thirty costs one render, the same way the key rows travel
   already read. */
ok('a worksheet set for the class carries its cover to every copy',
   /cover: coverOf\(w\)/.test(html) && /cover: coverOf\(a\)/.test(html));
ok('both kinds of card wear one',
   (html.match(/appendChild\(coverNode\(/g) || []).length === 2);
/* The face is in the flow and gives the block its height; the sheets behind
   are ABSOLUTE, so however many pages a worksheet has the card is the same
   size and the grid does not go ragged. */
ok('the sheets behind never change the card\'s size',
   /\.wsSheet \{[\s\S]{0,140}position: absolute;/.test(html));
ok('…and they peek out under the front page rather than beside it',
   /\.wsSheet \{[\s\S]{0,200}bottom: -\d+px; height: \d+px;/.test(html));
ok('a browser with no aspect-ratio still gets a face with a height',
   /@supports not \(aspect-ratio[\s\S]{0,80}\.wsFace \{ height:/.test(html));

/* =====================================================================
   N. A SET WORKSHEET IS THE TEACHER'S — the key, and the help level
   ===================================================================== */
section('What the teacher keeps');

/* ---- The answer key ---- */
S.wsMeta = { level: '', subject: '', guidance: 'method', assignmentId: '', setBy: '', guidanceLocked: false };
S.wsKey = { pages: [], rows: [], path: '', name: '', scanned: false, shared: false, reading: false };
eq('a worksheet of your own: the key is yours', S.keyLocked(), false);
S.wsMeta.assignmentId = 'a1';
eq('one the teacher SET: it is theirs', S.keyLocked(), true);
S.wsMeta.assignmentId = '';
S.wsKey.shared = true;
eq('…and a key that came with the class copy is too', S.keyLocked(), true);

/* The 🔑 window lists every page with a TICK beside it, so a student who can
   open it can untick a key page and read the marking scheme — the one thing
   this whole feature exists to prevent, reached through its own settings
   window. Every way in refuses, because hiding a chip is not a lock. */
[['openKeyModal', /function openKeyModal\(\)[\s\S]{0,400}?if \(keyLocked\(\)\)/],
 ['toggleKeyPage', /function toggleKeyPage\([^)]*\) \{\s*if \(keyLocked\(\)\)/],
 ['detachKeyPdf', /async function detachKeyPdf\(\) \{[\s\S]{0,200}?if \(keyLocked\(\)\)/],
 ['attachKeyPdf', /async function attachKeyPdf\([^)]*\) \{[\s\S]{0,300}?if \(keyLocked\(\)\)/]
].forEach(function (p) {
  ok(p[0] + ' refuses on a worksheet the teacher set', p[1].test(html));
});

/* Taking a worksheet off the class list is not a decision to hand out the
   marking scheme, so — unlike the help level below — this lock is never
   released. */
ok('the key stays the teacher\'s even when the worksheet comes off the list',
   /function keyLocked\(\)[\s\S]{0,400}return !!\(wsMeta\.assignmentId \|\| wsKey\.shared\);/.test(html));

/* The chip must not turn into the page list in words. */
const chipStub = { textContent: '', title: '', classList: {
  cls: {}, toggle(c, on) { this.cls[c] = !!on; }, add(c) { this.cls[c] = true; },
  contains(c) { return !!this.cls[c]; } } };
/* An earlier section replaced `$` with an element factory, so the chip is
   handed over through that same door rather than through document. */
const prevDollar = S.$;
S.$ = () => chipStub;
S.view = 'ws';
S.pages = [{ num: 1 }, { num: 2 }, { num: 3 }];
S.wsKey = { pages: [2, 3], rows: [{ number: '1', answer: '(3)' }], path: 'p.pdf', name: 'key',
            scanned: true, shared: true, reading: false };
S.wsMeta.setBy = 'Mr Chung';
S.renderKeyChip();
ok('a locked chip says WHOSE key it is', /Mr Chung/.test(chipStub.textContent));
ok('…and never which pages are missing',
   !/hidden/.test(chipStub.textContent) && !/\b2\b/.test(chipStub.textContent));
eq('…and it is marked as a label rather than a button', chipStub.classList.contains('locked'), true);
S.wsKey.shared = false;
S.wsMeta.assignmentId = '';
S.renderKeyChip();
ok('a worksheet of your own still says what it has',
   /hidden/.test(chipStub.textContent) && !chipStub.classList.contains('locked'));
S.$ = prevDollar;

/* ---- The help level ---- */
S.assignments = [];
S.assignmentsLoaded = false;
eq('a worksheet of your own is not locked',
   S.guidanceRule({ guidance: 'method' }), { level: 'method', locked: false, by: 'Mr Chung' });

S.assignments = [{ id: 'a1', guidance: 'nudge', guidanceLocked: true, byName: 'Mr Chung' }];
S.assignmentsLoaded = true;
const lockedRule = S.guidanceRule({ assignmentId: 'a1', guidance: 'answer' });
eq('a locked one is locked', lockedRule.locked, true);
/* The teacher's level beats the copy's — INCLUDING a level the student set
   for themselves before it was locked, which is the whole point of a lock. */
eq('…at the teacher\'s level, not the copy\'s', lockedRule.level, 'nudge');

S.assignments = [{ id: 'a1', guidance: 'nudge', guidanceLocked: false, byName: 'Mr Chung' }];
const freeRule = S.guidanceRule({ assignmentId: 'a1', guidance: 'answer' });
eq('an unlocked one is the student\'s own', freeRule.locked, false);
eq('…so the level they chose stands', freeRule.level, 'answer');

/* Taken off the class list, the copy becomes the student's own. Left on the
   copy's own flag it would stay locked for ever, at a level nobody — the
   teacher included — could still change. */
S.assignments = [];
S.assignmentsLoaded = true;
eq('a worksheet taken off the list is unlocked',
   S.guidanceRule({ assignmentId: 'a1', guidance: 'method', guidanceLocked: true }).locked, false);
/* …but "the list has not arrived" is not "the list is empty". */
S.assignmentsLoaded = false;
eq('…and a list that has not loaded yet does not unlock anything',
   S.guidanceRule({ assignmentId: 'a1', guidance: 'method', guidanceLocked: true }).locked, true);
ok('a read that FAILED is never mistaken for an empty list',
   /assignments = \[\];[\s\S]{0,300}assignmentsLoaded = false;/.test(html));

ok('the level is read LIVE from the assignment, so changing it reaches the class',
   /guidanceLocked: locked/.test(html) && /function assignmentFor\(w\)/.test(html));
ok('openGradeModal refuses a locked one',
   /function openGradeModal\([^)]*\) \{[\s\S]{0,400}?guidanceRule\(w\)\.locked : wsMeta\.guidanceLocked/.test(html));
ok('…and so does saving it',
   /async function saveGrade\(\)[\s\S]{0,500}?guidanceRule\(target\)\.locked : wsMeta\.guidanceLocked/.test(html));
ok('the card does not draw a button the student cannot use',
   /if \(!grule\.locked\) \{[\s\S]{0,200}Help level/.test(html));
ok('a student is told WHO set it rather than left with a dead control',
   /function guidanceLockedNote\(\)[\s\S]{0,160}setterName\(\)/.test(html));

/* =====================================================================
   THE TEACHER IS "MR CHUNG", NOT THE NAME ON THEIR GOOGLE ACCOUNT
   ---------------------------------------------------------------------
   A worksheet set for a class came back saying "Set by Zhi Kai Chung" —
   the display name off the admin's sign-in, which is a personal detail
   with no business on a card in front of thirty children. ADMIN_DISPLAY_NAME
   is what the centre calls its teacher and `setterName` is the one door to
   it, so a surface cannot say one thing while another says the other.
   ===================================================================== */
ok('there is one door for the teacher\u2019s name',
   /function setterName\(\) \{ return ADMIN_DISPLAY_NAME; \}/.test(html));
/* A write-side fix alone leaves every worksheet already set saying the full
   name for ever, so the READ goes through the door too. */
ok('nothing student-facing prints the stored setter raw',
   !/byName \|\| ADMIN_DISPLAY_NAME/.test(html) &&
   !/wsMeta\.setBy \+ '\\u2019s'/.test(html),
   'a surface reading byName/setBy directly shows the Google account name on everything already set');
ok('…and the class card names the teacher through it',
   /'📌 Set by ' \+ setterName\(\)/.test(html));
ok('…as do the answer-key line and its chip',
   (html.match(/setterName\(\) \+ '\\u2019s'/g) || []).length >= 2);
/* The stored value is put right going forward as well, so the data stops
   carrying a personal name at all. */
ok('the assignment stores the centre\u2019s name, not the account\u2019s',
   /byName: setterName\(\),/.test(html) && !/byName: currentUser\.displayName/.test(html));
ok('and so does the copy handed to a student', /setBy: setterName\(\),/.test(html));
ok('a copy starts locked or free as the assignment says',
   /guidanceLocked: !!a\.guidanceLocked/.test(html));
/* The level is read live, so on a cold start the list has to be in hand
   before it is asked — otherwise the whole session runs at whatever level
   the copy happens to carry and the lock is a lock nobody applied. */
ok('opening a set worksheet waits for the class list before it reads the level',
   /if \(wsMeta\.assignmentId && !assignmentsLoaded\) \{[^}]*loadAssignments\(\)/.test(html));

/* =====================================================================
   ↻ PRACTISING IT AGAIN
   ---------------------------------------------------------------------
   Marking puts the answer to every question on the screen, so without a way
   back there is exactly ONE honest attempt at any worksheet. This is the
   way back — and it is the only DESTRUCTIVE button a student has, which is
   what every check below is really about. Each failure is silent:

   • Clearing the marking and leaving the hints hides the answers in one
     panel and keeps them in the next — a climbed hint IS the answer.
   • Clearing without pushing the ink onto the undo stack first makes one
     mis-tap the end of an hour's work, with nothing to bring it back.
   • Wiping before the student has confirmed is the same thing with no
     mis-tap needed.
   • Touching the mistake book would delete the record of the very attempt
     being cleared, which is the one thing here worth keeping.
   ===================================================================== */
section('↻ Practise again');

const AGAIN = between('function practiseAgainAvailable()', '/* ================= Marking',
                      'the practise-again section');

ok('it asks before it clears anything', /if \(!confirm\(/.test(AGAIN));
ok('…and returns without writing when the answer is no',
   /if \(!confirm\([\s\S]{0,400}?\)\) return;/.test(AGAIN));
/* The ink is the only copy there is once the save lands. */
ok('the ink goes onto the undo stack BEFORE it is cleared',
   AGAIN.indexOf('pushUndo()') !== -1 &&
   AGAIN.indexOf('pushUndo()') < AGAIN.indexOf('annotations = [];'),
   'without this a mis-tap is an hour of work gone with nothing to bring it back');
ok('the marking goes', /marking = \{ items: \[\], runAt: null, running: false \};/.test(AGAIN));
ok('the hints go with it', /hints = \[\];/.test(AGAIN),
   'a hint climbed to the top holds the answer just as plainly as a marked card');
ok('and so does the ink', /annotations = \[\];/.test(AGAIN));
/* The two things that must NOT go. */
ok('the mistake book is never touched',
   !/mistakes/.test(AGAIN) || !/mistakes\s*=\s*\[\]/.test(AGAIN),
   'the book is the record of the attempt being cleared');
ok('the chat is never cleared', !/chat\s*=\s*\[\]/.test(AGAIN) && !/chatLog\s*=\s*\[\]/.test(AGAIN));
/* The ticks and the hint pins are drawn from marking/hints but live on the
   page, so both painters have to be re-run or last attempt's marks stay on
   a paper that is otherwise blank. */
ok('the ticks and the pins are repainted', /syncMarkPins\(\)/.test(AGAIN) &&
   /renderAllOverlays\(\)/.test(AGAIN));
ok('the new attempt is saved rather than left in the tab', /performSave\(/.test(AGAIN));
/* Invisible, this is a button that appears to do nothing on a paper that
   was already blank — and a student cannot tell a second go from a first. */
ok('the attempt is counted', /attempts = \(parseInt\(attempts, 10\) \|\| 1\) \+ 1;/.test(AGAIN));
ok('…and stored on the worksheet', /attempts: attempts,/.test(html));
ok('…read back when it is opened',
   /attempts = Math\.max\(1, parseInt\(w\.attempts, 10\) \|\| 1\);/.test(html));
ok('…reset when another PDF is loaded', /attempts = 1;/.test(html));
ok('…and shown on the worksheet card',
   /'↻ Attempt ' \+ tries/.test(html));
/* Nothing to clear, or a marking run in flight, and the button is not there:
   one that wipes half a run leaves marking for questions that no longer
   have any ink behind them. */
ok('it is offered only when there is something to clear',
   /marking\.items\.length \|\| hints\.length \|\| annotations\.length/.test(AGAIN));
ok('…and never mid-run', /!marking\.running/.test(AGAIN));
ok('the marking pane draws it', /practiseAgainAvailable\(\)/.test(html) &&
   /again\.addEventListener\('click', practiseAgain\)/.test(html));

/* =====================================================================
   🖨 PRINTING THE PAPER
   ---------------------------------------------------------------------
   Print is the worksheet; Print with the answer key is the worksheet plus
   the key pages. The whole 🔑 section exists to keep a marking scheme off a
   student's screen, and a print button is simply another door to it — so
   the lock is asked here too, in the HANDLER and not only on the button.
   ===================================================================== */
section('🖨 Printing');

const PRINT = between('var PRINT_MAX_SIDE', '/* ================= PRACTISING IT AGAIN',
                      'the printing section');

/* THE ONE THAT MATTERS: printing the key on a worksheet the teacher set. */
ok('printing the key obeys the same lock the 🔑 window does',
   /function printKeyAllowed\(\) \{\s*return !keyLocked\(\) \|\| isAdmin\(currentUser\);/.test(PRINT));
ok('…and the handler refuses, rather than trusting the button',
   /if \(withKey && !printKeyAllowed\(\)\) \{[^}]*keyLockedNote\(\)/.test(PRINT),
   'hiding a button has never been the lock in this app');
ok('…while the button is not drawn either',
   /var can = printHasKeyPages\(\) && printKeyAllowed\(\);/.test(PRINT) &&
   /keyBtn\.classList\.toggle\('hidden', !can\);/.test(PRINT));
ok('…and a student is told whose key it is',
   /: keyLockedNote\(\);/.test(PRINT));

/* A plain print must go through the ONE place "the pages the student has" is
   decided. Print `pages` and the marking scheme comes out of the printer. */
ok('a plain print prints studentPages(), never every page',
   /var wanted = withKey \? pages\.slice\(\) : studentPages\(\);/.test(PRINT),
   'reading `pages` here prints the marking scheme');
ok('…and the button says how many that is',
   /studentPages\(\)\.length \+ ' page'/.test(PRINT));

/* window.print() does not wait for an <img>: the mistake sheet learned this
   the hard way and printed a page of ruled lines with no questions on it. */
ok('every page is decoded before the dialog opens', /await img\.decode\(\)/.test(PRINT));
ok('…with a fallback for a browser that has no decode()',
   /img\.onload = img\.onerror = r/.test(PRINT));
ok('the pages are rasterised through the one door', /await ensurePageRaster\(p\)/.test(PRINT));
ok('…and composited, so what the student wrote prints with them',
   /compositeJpeg\(p, PRINT_MAX_SIDE/.test(PRINT));
ok('a sheet that came out empty says so rather than opening a blank dialog',
   /if \(!sheet\.firstChild\)/.test(PRINT));
ok('the box being typed in is committed first', /commitActiveTextEdit\(\)/.test(PRINT));

/* printThis hides `body > *:not(.printMe)`, so a sheet nested anywhere in
   the app is hidden along with everything around it — a print dialog with
   nothing in it, on a page that looks perfectly right. */
ok('it prints through the one door', /printThis\(sheet\)/.test(PRINT));
ok('#printSheet is a DIRECT CHILD of body',
   /\n<div id="printSheet" class="hidden"><\/div>/.test(html),
   'nested inside the app it is hidden by the print stylesheet along with its parents');
ok('…and hidden on screen', /#printSheet\.hidden \{ display: none; \}/.test(html));
ok('one page per sheet, and the last one carries no break',
   /\.printPage \{[\s\S]{0,200}break-after: page;/.test(html) &&
   /\.printPage:last-child \{ break-after: auto/.test(html));

/* =====================================================================
   ✍️ THE STYLUS, THE PALM AND THE FINGERS
   ---------------------------------------------------------------------
   None of this can be caught by reading a screenshot: a palm threshold set
   below a fingertip eats ordinary scrolling, one set too high lets the heel
   of a hand draw across the worksheet, and a stroke that does not release
   its pointer locks every later touch out of the page for the rest of the
   session — on a screen that looks perfectly right.
   ===================================================================== */
section('The stylus, the palm and the fingers');

const PALM = between("var stylusOnly = (function () {", 'function setStylusOnly(', 'palm rejection');
ok('pencil-only mode is ON unless the device says otherwise',
   /v === null \? true : v === '1'/.test(PALM),
   'a palm that can draw ruins a worksheet before anyone notices');
ok('the palm threshold sits above a fingertip',
   /var PALM_CONTACT = (5[5-9]|[6-9]\d);/.test(PALM),
   'iPads report ordinary fingers at up to ~45px — below that, finger scrolling gets eaten');
ok('a palm is a CONTACT PATCH, and only a touch can be one',
   /e\.pointerType === 'touch' && \(e\.width > PALM_CONTACT \|\| e\.height > PALM_CONTACT\)/.test(PALM),
   'a stylus reports a tiny patch; testing size alone would reject nothing and testing kind alone everything');

const DOWN = between("svg.addEventListener('pointerdown', function (e) {", "if (tool === 'hint')", 'the pointerdown gate');
ok('a palm starts nothing at all', /if \(isPalmTouch\(e\)\) \{ e\.preventDefault\(\); return; \}/.test(DOWN));
ok('a second touch cannot hijack a stroke in progress',
   /activePointerId !== null && e\.pointerId !== activePointerId/.test(DOWN));
ok('…but a stale gesture is cleared rather than locking the page for good',
   /cancelStaleGesture\(\)/.test(DOWN),
   'a pointerup the browser swallowed would otherwise refuse every later touch');
ok('a touch the navigation engine has taken never reaches a tool',
   /e\.pointerType === 'touch' && nav\.mode/.test(DOWN));
ok('in pencil-only mode a finger on a drawing tool does not draw',
   /stylusOnly && e\.pointerType === 'touch' && isDrawTool\(tool\)/.test(DOWN));
ok('the first stylus down switches the mode back on',
   /e\.pointerType === 'pen' && !pencilSeen/.test(DOWN),
   'whoever has just picked a pencil up is about to rest a hand on the screen');

const MOVE = between("svg.addEventListener('pointermove', function (e) {", 'function endStroke(e) {', 'pointermove');
ok('only the pointer that started the stroke may continue it',
   /activePointerId !== null && e\.pointerId !== activePointerId\) return;/.test(MOVE));
const ENDS = between('function endStroke(e) {', "svg.addEventListener('pointerup', endStroke);", 'endStroke');
ok('a palm LIFTING OFF does not end the stroke the pencil is drawing',
   /activePointerId !== null && e\.pointerId !== activePointerId\) return;/.test(ENDS));
ok('…and the pointer is released when the real one lifts',
   /activePointerId = null;/.test(ENDS),
   'a pointer never released locks every later touch out of the page');

/* 💡 hint, 🎤 speak, 🖱️ select and — since v1.42.0 — 🅣 text are deliberately
   NOT draw tools: those are a TAP, and a finger making one is not a palm
   about to ruin the worksheet. Handing them to the pan engine is what makes
   them unusable without a pencil, which is precisely what 🅣 was. */
ok('a tool that leaves a MARK by dragging is one a finger must not drive',
   ['pen', 'highlight', 'line', 'arrow', 'rect', 'ellipse', 'eraser'].every(t => S.isDrawTool(t)));
ok('…and the hint, the mic and select are not',
   !S.isDrawTool('hint') && !S.isDrawTool('speak') && !S.isDrawTool('select'));
ok('🅣 THE TEXT TOOL IS A TAP, so a finger may make one — the reported fault',
   !S.isDrawTool('text'),
   'pencil-only mode is ON by default, so in the draw list the 🅣 button silently did nothing on an iPad');
const TEXTTAP = between("if (tool === 'text') {", '// Everything else draws.', 'the text tap');
ok('…and placing a box really IS a tap: it captures no pointer and drags nothing',
   /startTextBox\(p, pt\);/.test(TEXTTAP) &&
   !/claimPointer|setPointerCapture/.test(TEXTTAP),
   'a tool that only taps has no business being rejected as one that draws');
ok('a stray empty box is a tap that changed its mind, so a palm can leave nothing behind',
   /if \(!String\(a\.text \|\| ''\)\.trim\(\)\) \{[\s\S]{0,160}annotations\.filter/.test(html));
ok('…and a palm-sized patch still starts nothing at all',
   /if \(isPalmTouch\(e\)\) \{ e\.preventDefault\(\); return; \}/.test(DOWN));

/* 🧽 THE ERASER LOOKS LIKE AN ERASER. There is none in the emoji set, so
   🩹 — an adhesive BANDAGE — was standing in for one and read as one. */
const ERASER_BTN = between('<button class="toolBtn" data-tool="eraser"', '</button>', 'the eraser button');
ok('the eraser is DRAWN rather than stood in for by an emoji',
   /<svg class="toolIco"/.test(ERASER_BTN) && !/\u{1FA79}/u.test(html),
   'no vendor’s emoji font can re-draw an SVG as something else');
ok('…with flat fills and no id, gradient or filter, like every other drawing here',
   !/\sid=/.test(ERASER_BTN) && !/Gradient|filter=/.test(ERASER_BTN));
ok('…and it is sized in CSS rather than by the button’s font-size',
   /\.toolIco \{ width: 21px; height: 21px;/.test(html));
ok('…and it still carries its name for a screen reader',
   /aria-label="Eraser"/.test(ERASER_BTN) && /aria-hidden="true"/.test(ERASER_BTN));
ok('…and it is still the eraser TOOL, wired by data-tool like the rest',
   /data-tool="eraser"/.test(ERASER_BTN));

const NAV = between('function navBind() {', '/* Two-finger double-tap', 'the navigation engine');
ok('the engine is bound in CAPTURE, ahead of the page overlay',
   /pointerdown', function \(e\) \{[\s\S]*?\}, true\);/.test(NAV),
   'bound after it, a second finger could never take a stroke over into a pinch');
ok('a resting palm navigates nothing either', /if \(rejectTouch\(e\)\)/.test(NAV));
ok('a second finger on a young stroke throws the accidental dot away',
   /abortYoungStroke\(e\.timeStamp\)/.test(NAV));
ok('…and on an established one KEEPS the ink and pinches',
   /commitTouchStrokeForNav\(\)/.test(NAV),
   'the ink already drawn is the student’s own work');
ok('one finger pans only in pencil-only mode, and only on a drawing tool',
   /nav\.pts\.size === 1 && stylusOnly && isDrawTool\(tool\)/.test(NAV));
ok('the pinch is collected into one zoom per frame',
   /scheduleNavZoom\(\)/.test(NAV),
   'a zoom per pointermove is a forced layout twice a frame on a twenty-page document — that IS the lag');
ok('the browser’s own touch scroll stands down while the engine pans',
   /if \(nav\.mode \|\| penBlocksTouch\(\) \|\| rejectedTouches\.size\) e\.preventDefault\(\)/.test(NAV),
   'the two together double-scroll and fight each other');
ok('a flick carries on with momentum', /startNavMomentum\(\)/.test(NAV));
ok('the pages sharpen up once the gesture is over', /scheduleRaster\(\)/.test(NAV));

ok('the browser’s own pinch-zoom is taken off the scroller',
   /#viewerArea \{[^}]{0,800}touch-action: pan-x pan-y;/.test(html),
   'left on, it zooms the whole app instead of the worksheet and fights the gesture');
ok('the mode is remembered on the device',
   /localStorage\.setItem\('tutorStylusOnly'/.test(html));
ok('the button is a MODE, not a tool',
   /<button class="toolBtn" id="stylusBtn"/.test(html) &&
   !/id="stylusBtn"[^>]*data-tool/.test(html),
   'the tool buttons are wired and lit by data-tool; a mode wearing one would be set as a tool');

/* =====================================================================
   ⚙️ THREE ENGINES, AND WHICHEVER ONE WILL ANSWER
   The way this app dies is not a bug in it: "[429] Your billing account has
   exceeded its monthly spending cap", returned identically to every call on
   every device until the month turns over. Everything pinned here is silent
   — the app carries on looking exactly as it did that morning.
   ===================================================================== */
ok('`window.askGemini` is still the ONE door, and it goes through the loop',
   /window\.askGemini = async function askGemini\([^)]*\) \{\s*return aiAskWith\(prompt, opts, aiEngineOrder\(\)\);/.test(html),
   'a door that calls askGeminiDirect again is every call site back on one engine, with no backup at all');
ok('…and `askGeminiDirect` is reached only through the dispatcher',
   (html.match(/askGeminiDirect\(prompt, opts\)/g) || []).length === 1,
   'a second call site past _aiRun is a call that still dies on the cap with nothing saying why');
ok('the backups are SERVER-KEYED and there is no key box',
   /askOpenAi/.test(html) && /askKimi/.test(html) && !/type="password"/.test(html),
   'this app is opened by children on shared iPads — a key field here is a key typed on the wrong device');
ok('…and no OpenAI-shaped key is in the file',
   !/\bsk-[A-Za-z0-9_-]{16,}/.test(html),
   'a public static site served to every student browser');
ok('a refused route goes to the BACK of the list and never off it',
   /sort\(\(a, b\) => \(aiEngineIsDown\(a\) \? 1 : 0\) - \(aiEngineIsDown\(b\) \? 1 : 0\)\)/.test(html),
   'taken off, the app is dead once the cap has been lifted');
ok('…and the mark expires by itself', /_aiDown\[e\] = Date\.now\(\) \+ AI_DOWN_MS/.test(html));
ok('…and a success clears it', /function _aiMarkUp\(e\) \{ _aiDown\[e\] = 0/.test(html));
ok('an engine name nobody recognises still yields every route',
   /AI_ENGINES\.indexOf\(first\) >= 0[\s\S]{0,120}: AI_ENGINES\.slice\(\)/.test(html),
   'a stale word in the centre-wide setting would take the AI off every device at once');
ok('when nothing answers, EVERY route is named',
   /order\.map\(e => AI_ROUTE_LABEL\[e\] \+ ": " \+ \(_aiWhy\[e\] \|\| "refused"\)\)/.test(html),
   'reporting only the first sends the teacher to the Google console when the job is to deploy a function');
ok('no temperature is sent to a server route',
   !/_aiServerAsk[\s\S]{0,600}temperature/.test(html),
   'a reasoning model runs only at its own default — a temperature is a 400, not a worse answer');
ok('no model is named to Kimi',
   /function askKimiServer\(prompt, opts\) \{ return _aiServerAsk\("askKimi", prompt, opts\); \}/.test(html),
   'Moonshot renames its flagship every release and this app has no box to correct a stale id in');
ok('the callable rides the COMPAT app, which holds the signed-in user',
   /firebase\.app\(\)\.functions\(\)\.httpsCallable/.test(html) &&
   /firebase-functions-compat\.js/.test(html),
   'the modular app carries App Check but no session, and the function refuses a caller it cannot name');
ok('…and a blocked CDN leaves the backup unavailable rather than throwing on load',
   /typeof firebase === "undefined" \|\| !firebase\.functions/.test(html));

/* THE REPLY STREAMS, so the tutor speaks the first sentence while the rest is
   still being written. The live harness drives that from `askGemini` down; the
   door itself is above the section it can load, so it is pinned here. */
ok('the streaming route RETURNS the whole reply as well as streaming it',
   /const result = await model\.generateContentStream\(request\);[\s\S]{0,420}return full\.trim\(\);/.test(html),
   'the side channel is early delivery, never the answer — a route with no stream behind it must be unaffected');
ok('…and it streams the reply SO FAR, never a delta',
   /full \+= delta;[\s\S]{0,60}onStream\(full\)/.test(html),
   'the caller tracks how much it has already spoken, which it cannot do from deltas alone');
ok('a reply asked for as JSON is never streamed',
   /typeof onStream === "function" && !json/.test(html),
   'half an object parses as nothing, and the tolerant parser is what makes a truncated one survivable');
ok('a thinking-level retry stands down once text has been handed over',
   /if \(emitted\) throw e;\s*\n\s*if \(thinkingLevel === AI_THINK_MIN/.test(html),
   'a retry after the first delta speaks a second answer over the top of the first');
ok('NO ROUTE FALLS BACK once a route has emitted',
   /let emitted = false;[\s\S]{0,400}onStream: function \(full\) \{ emitted = true; opts\.onStream\(full\); \}[\s\S]{0,900}if \(emitted\) throw e;/.test(html),
   'half of one engine’s explanation welded to the whole of another’s, read aloud to a child');
ok('…and the stream is offered to every route, not just the first',
   /_aiRun\(engine, prompt, Object\.assign\(\{\}, routeOpts,/.test(html),
   'passing the raw opts would leave `emitted` unset, and the guard above dead');
ok('a call with no onStream is handed its opts unchanged',
   /: opts;/.test(html) && /typeof opts\.onStream === "function"\s*\n?\s*\? Object\.assign/.test(html),
   'every other call site in the app goes down this path and must be byte-for-byte what it was');

/* ONE PAGE, SMALLER, AND PREPARED SIDE BY SIDE. Each of these is seconds a
   student spends listening to nothing. */
ok('the live check narrows the pages it sends',
   /worksheetContextPages\(\{ max: LIVE_CONTEXT_MAX, dominant: LIVE_CONTEXT_DOMINANT \}\)/.test(html),
   'every extra page is another quarter-megabyte uploaded before a word is spoken');
ok('…and `worksheetContextPages()` with no arguments is unchanged for every other caller',
   /var max = \(opts && opts\.max\) \|\| 3;/.test(html),
   'the chat, the hints and visiblePage() all read this');
ok('the notes, the key and the raster are awaited TOGETHER',
   /await Promise\.all\(\[\s*\n\s*Promise\.all\(\[\s*\n\s*aiWithDeadline\(function \(\) \{ return loadTeachingNotes\(\); \}/.test(html),
   'neither needs anything the other produces, so serially the shorter one is pure waiting');
ok('the key and the notes are warmed as the session opens',
   /liveWarmContext\(\);\s*\n\s*liveStatus\('Allow your microphone/.test(html),
   'granting the microphone and exchanging SDP is several seconds the key can be read in for free');
ok('…and a warm-up refusal is swallowed, never shown',
   /function liveWarmContext\(\) \{[\s\S]{0,320}catch \(e\) \{\}[\s\S]{0,200}catch \(e\) \{\}/.test(html),
   'an error on screen about a question nobody has asked yet');

/* THE ENGINE IS THE CENTRE'S SETTING, on the document this app already
   reads. A device-local choice is the bug wearing a feature's clothes. */
ok('the shared setting is a field on config/admin',
   /db\.collection\('config'\)\.doc\('admin'\)\.onSnapshot/.test(html),
   'the same field the Portal and Scan write — one switch moves them all');
ok('…and it is LIVE, not a one-shot read',
   /_aiCfgStop = db\.collection\('config'\)\.doc\('admin'\)\.onSnapshot/.test(html));
ok('…and it comes DOWN on every account change',
   /stopTeachingNotes\(\);\s*\n\s*aiEngineStopShared\(\);/.test(html),
   'one account setting left running governs the next person to sign in on a shared iPad');
ok('the write is a MERGE, always',
   /aiEngine: engine,[\s\S]{0,220}\{ merge: true \}/.test(html),
   'a plain set takes `uid` off the document and every student in the Portal loses the bank');
ok('…and only the admin may write it',
   /async function aiEngineSetShared\(engine\) \{\s*\n\s*if \(!isAdmin\(currentUser\)\) return;/.test(html),
   'hiding the picker is never the lock');
ok('an unset field means Gemini',
   /window\.aiSetEngine\(d\.aiEngine \|\| 'gemini'\)/.test(html),
   'a centre that never touches this must be unaffected');
ok('a failed write is REPORTED',
   /Could not save the centre-wide setting/.test(html),
   'a teacher told nothing would believe the whole centre had moved');

ok('the vendor name is read from the ONE engine door',
   /var st = window\.aiEngines && window\.aiEngines\(\);\s*\n\s*if \(st && st\.vendor\) return st\.vendor;/.test(html),
   'a second reading of the engine state is how the badge says Gemini while ChatGPT is answering');
ok('…and the student side is still Chung GPT, from a literal',
   /function aiEngineName\(\) \{ return 'Chung GPT'; \}/.test(html));

console.log('\n' + (failures
  ? '✗ ' + failures + ' of ' + checks + ' checks failed'
  : '✓ all ' + checks + ' checks passed'));
process.exit(failures ? 1 : 0);
