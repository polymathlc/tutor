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
  setTimeout, clearTimeout, Blob: class { constructor(p) { this.size = String(p).length; } },
  Math, JSON, Date, String, Number, Array, Object, parseInt, parseFloat, isNaN, Promise
};
vm.createContext(sandbox);
vm.runInContext(SRC_CORE + '\n' + SRC_ANN + '\n' + SRC_BUDDY, sandbox, { filename: 'index.html' });
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
const it3 = S._markNewItem({ question: 'Q', answer: 'A', page: 2 }, 3, 3);
eq('page 2 of the batch starting at 3 is page 5 of the worksheet', it3.page, 5);
const itBad = S._markNewItem({ question: 'Q', answer: 'A', page: 9 }, 3, 3);
eq('a page outside the batch falls back to the batch\'s first page', itBad.page, 4);
const itNone = S._markNewItem({ question: 'Q', answer: 'A' }, 0, 2);
eq('a missing page falls back the same way', itNone.page, 1);
eq('an empty row is not a question', S._markNewItem({}, 0, 1), null);

/* A question straddling a batch boundary is ONE question, not two halves
   each with half an answer. */
const into = [];
S._markFoldRows([{ number: '8', question: 'The first half', answer: '', page: 1 }], 0, 1, into);
S._markFoldRows([{ continuation: true, question: 'the second half.', answer: '42 cm', page: 1,
                   explanation: 'Because…', studentAnswer: '40', verdict: 'wrong', feedback: 'Check the units.' }],
                1, 1, into);
eq('a continuation folds into the question before it', into.length, 1);
eq('…its wording is joined', into[0].question, 'The first half the second half.');
eq('…the answer comes from the half that could see the whole question', into[0].answer, '42 cm');
eq('…the page it ENDS on is remembered', into[0].endPage, 2);
eq('…and the marking is merged in', into[0].verdict, 'wrong');

const two = [];
S._markFoldRows([{ number: '1', question: 'A', answer: 'a', page: 1 },
                 { continuation: true, question: 'B', answer: 'b', page: 1 }], 0, 1, two);
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
   7. Against the FILE itself — the things no unit test can see
   ===================================================================== */
section('Against index.html itself');

/* THE ONE DOOR. `askGemini` is transport: its system prompt has to arrive
   already grounded from the feature that called it. A call site that
   forgets is a feature that quietly stops speaking in the teacher's voice,
   and no other check in this file can see it. */
const callSites = [...html.matchAll(/window\.askGemini\(/g)].map(m => m.index);
ok('there are askGemini call sites to check at all', callSites.length >= 3,
   'found ' + callSites.length);
callSites.forEach((idx, i) => {
  const chunk = html.slice(idx, idx + 900);
  // The bridge's own definition is not a call site.
  if (/window\.askGemini\s*=/.test(html.slice(Math.max(0, idx - 40), idx + 40))) return;
  ok('askGemini call site ' + (i + 1) + ' passes aiGrounding(', /aiGrounding\(/.test(chunk),
     chunk.slice(0, 220).replace(/\s+/g, ' '));
});

/* Both ceiling rules go into the SYSTEM prompt, beside the grounding. A
   hard constraint carried in the user message is one the next question can
   talk over, and the two call sites drifting apart is exactly how the chat
   ends up locked and the marking wide open. */
const markCall = html.slice(html.indexOf('var raw = await window.askGemini(markPrompt'), html.indexOf('var raw = await window.askGemini(markPrompt') + 500);
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

console.log('\n' + (failures
  ? '✗ ' + failures + ' of ' + checks + ' checks failed'
  : '✓ all ' + checks + ' checks passed'));
process.exit(failures ? 1 : 0);
