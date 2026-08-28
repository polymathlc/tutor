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

/* ---- A sandbox with just enough world to evaluate them ---- */
const noop = () => {};
const domStub = {
  getElementById: () => null,
  querySelectorAll: () => [],
  createElement: () => ({ style: {}, classList: { add: noop, remove: noop, toggle: noop },
                          appendChild: noop, setAttribute: noop, addEventListener: noop }),
  addEventListener: noop
};
const sandbox = {
  console,
  document: domStub,
  window: {},
  localStorage: { getItem: () => '', setItem: noop },
  db: null, auth: null, storage: null, firebase: null,
  // The answer-key block reads these at CALL time; they are declared in
  // parts of the file this harness deliberately does not evaluate.
  pages: [], annotations: [], wsEpoch: 0, view: '', currentDocId: '', pdfDoc: null,
  STORAGE_DIR: 'tutor-worksheets', ADMIN_DISPLAY_NAME: 'Mr Chung',
  setTimeout, clearTimeout, Blob: class { constructor(p) { this.size = String(p).length; } },
  Math, JSON, Date, String, Number, Array, Object, parseInt, parseFloat, isNaN, Promise
};
vm.createContext(sandbox);
vm.runInContext(SRC_CORE + '\n' + SRC_ANN + '\n' + SRC_KEY + '\n' + SRC_BUDDY, sandbox, { filename: 'index.html' });
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
eq('…its marks are dropped', blank.marks, '');
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
   /function pushWorksheet\(id\) \{\s*if \(!isAdmin\(currentUser\)\) return;/.test(html.replace(/\s+/g, ' ').replace(/async function/g, 'function')) ||
   /async function pushWorksheet\(id\) \{[\s\S]{0,120}if \(!isAdmin\(currentUser\)\) return;/.test(html),
   'pushWorksheet does not re-check isAdmin');

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


console.log('\n' + (failures
  ? '✗ ' + failures + ' of ' + checks + ' checks failed'
  : '✓ all ' + checks + ' checks passed'));
process.exit(failures ? 1 : 0);
