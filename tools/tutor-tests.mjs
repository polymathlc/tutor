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
const html = readFileSync(FILE, 'utf8');

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

/* ---- A sandbox with just enough world to evaluate them ---- */
const noop = () => {};
const domStub = {
  getElementById: () => null,
  querySelectorAll: () => [],
  createElement: () => ({ style: {}, classList: { add: noop, remove: noop, toggle: noop },
                          appendChild: noop, setAttribute: noop, addEventListener: noop, focus: noop }),
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
  Math, JSON, Date, String, Number, Array, Object, parseInt, parseFloat, isNaN, Promise
};
vm.createContext(sandbox);
vm.runInContext(SRC_CORE + '\n' + SRC_ANN + '\n' + SRC_KEY + '\n' + SRC_BUDDY +
                '\n' + SRC_SIZE + '\n' + SRC_BODY + '\n' + SRC_STAMP + '\n' + SRC_SAVE +
                '\n' + SRC_PRAC + '\n' + SRC_PEOPLE + '\n' + SRC_COVER + '\n' + SRC_GUIDE,
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
  KEY_EYE_SYS:  'asks which PAGES are the answer key. It returns page numbers, not science said to anybody.'
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

/* Both ceiling rules go into the SYSTEM prompt, beside the grounding. A
   hard constraint carried in the user message is one the next question can
   talk over, and the two call sites drifting apart is exactly how the chat
   ends up locked and the marking wide open. */
const markCall = html.slice(html.indexOf('var raw = await window.askGemini(markPrompt'), html.indexOf('var raw = await window.askGemini(markPrompt') + 900);
ok('the marking sends its blank rule in the SYSTEM prompt', /system:\s*MARK_SYS \+ markBlankRule\(\)/.test(markCall),
   markCall.replace(/\s+/g, ' ').slice(0, 240));
const chatCall = html.slice(html.indexOf('var out = await window.askGemini('), html.indexOf('var out = await window.askGemini(') + 400);
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
ok('the hint prompt carries the answer key', /aiGrounding\('hint'\)\s*\+\s*keyRuleBlock\(\)/.test(hintCall),
   hintCall.replace(/\s+/g, ' ').slice(0, 240));
ok('the marking prompt carries the answer key', /aiGrounding\('mark'\)\s*\+\s*keyRuleBlock\(\)/.test(markCall),
   markCall.replace(/\s+/g, ' ').slice(0, 260));
ok('the chat carries it too, behind the ceiling rule',
   /buddyCeilingRule\(\)\s*\+\s*aiGrounding\('teach'\)\s*\+\s*keyRuleBlock\(\)/.test(chatCall),
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
const del = html.slice(html.indexOf('async function deleteWorksheet'),
                       html.indexOf('async function deleteWorksheet') + 1100);
ok('deleting a copy never deletes the class\'s shared PDF',
   /w\.storagePath && !w\.sharedPdf/.test(del), del.replace(/\s+/g, ' ').slice(0, 300));

/* Setting work for the class writes to a collection every student reads, so
   hiding the button is not the lock. */
ok('only the teacher can set a worksheet, checked in the handler',
   /async function pushWorksheet\([^)]*\) \{[\s\S]{0,120}if \(!isAdmin\(currentUser\)\) return;/.test(html),
   'pushWorksheet does not re-check isAdmin');
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
ok('a picture that will not load takes itself off the sheet',
   /im\.onerror = function \(\) \{ m\._sheetUrl = ''; res\(\); \}/.test(html));
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

eq('the centre takes P3 to P5', S.STUDENT_LEVELS, ['P3', 'P4', 'P5']);
eq('three subjects are offered', S.STUDENT_SUBJECTS.map(function (x) { return x.value; }),
   ['science', 'math', 'both']);
eq('P3 offers Science and nothing else', S.levelSubjects('P3'), ['science']);
eq('P4 offers all three', S.levelSubjects('P4'), ['science', 'math', 'both']);
ok('P3 + Mathematics is refused', !S.subjectOkForLevel('P3', 'math'));
ok('P3 + Both is refused', !S.subjectOkForLevel('P3', 'both'));
ok('P5 + Mathematics is allowed', S.subjectOkForLevel('P5', 'math'));
/* A P6 row set up in Ans Key before the range narrowed keeps every subject
   rather than being silently re-tagged. */
eq('a level from outside the range keeps all three', S.levelSubjects('P6'),
   ['science', 'math', 'both']);

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
   /var level = \(!isAdmin\(currentUser\) && upSt && upSt\.level\) \? upSt\.level/.test(html));
ok('the students are dropped on every account change',
   /myStudents = \[\];[\s\S]{0,120}currentDocId = null;/.test(html));

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
   html.indexOf('await keyAutoScan(true)') < html.indexOf("await ensureCover(id, '')"));
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
   /function guidanceLockedNote\(by\)/.test(html));
ok('a copy starts locked or free as the assignment says',
   /guidanceLocked: !!a\.guidanceLocked/.test(html));
/* The level is read live, so on a cold start the list has to be in hand
   before it is asked — otherwise the whole session runs at whatever level
   the copy happens to carry and the lock is a lock nobody applied. */
ok('opening a set worksheet waits for the class list before it reads the level',
   /if \(wsMeta\.assignmentId && !assignmentsLoaded\) \{[^}]*loadAssignments\(\)/.test(html));

console.log('\n' + (failures
  ? '✗ ' + failures + ' of ' + checks + ' checks failed'
  : '✓ all ' + checks + ' checks passed'));
process.exit(failures ? 1 : 0);
