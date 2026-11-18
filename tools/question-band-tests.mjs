/* ✂️ THE QUESTION'S OWN BAND (v1.98.0) — question-band.js's pure half and
   the wiring in index.html. Run: node --test tools/question-band-tests.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
require('../question-band.js');
const Q = globalThis.QBand;
const src = readFileSync(join(here, '..', 'question-band.js'), 'utf8');
const html = readFileSync(join(here, '..', 'index.html'), 'utf8');

const it = (s, x, y, h = 0.014, w = 0.05) => ({ s, x, y, h, w });

/* The page from Zhi Kai's screenshot: the end of Q9, the section line, Q10
   "Match." with its boxes, and the footer. */
function screenshotPage() {
  return [
    it('Primary 3 Mathematics Paper', 0.30, 0.025),
    it('9.', 0.08, 0.40), it('Wendy has 30 stickers. She gives 6 stickers to each friend.', 0.13, 0.40, 0.014, 0.6),
    it('How many friends can she give stickers to?', 0.13, 0.43, 0.014, 0.5),
    it('Wendy can give 6 stickers to', 0.20, 0.60, 0.014, 0.25), it('friends.', 0.59, 0.60),
    it('Questions 10 to 14 carry 2 marks each.', 0.12, 0.68, 0.014, 0.4),
    it('10.', 0.12, 0.72), it('Match.', 0.17, 0.72),
    it('3 + 3 + 3', 0.62, 0.75),
    it('3 x 10', 0.31, 0.78), it('10 + 10 + 10', 0.61, 0.80),
    it('7 + 7 + 7 + 7 + 7', 0.60, 0.84),
    it('5 x 7', 0.32, 0.87), it('5 + 5 + 5 + 5 + 5', 0.60, 0.89),
    it('4', 0.49, 0.955), it('www.sgexam.com', 0.75, 0.955, 0.012, 0.15)
  ];
}

test('a question number is read off its label, a part by its stem', () => {
  assert.equal(Q.numOf('10'), 10);
  assert.equal(Q.numOf('Q10'), 10);
  assert.equal(Q.numOf('13(a)'), 13);
  assert.equal(Q.numOf('13b'), 13);
  assert.equal(Q.numOf(''), 0);
  assert.equal(Q.numOf('abc'), 0);
});

test('a line starts a question only with the number as a question number', () => {
  assert.ok(Q.startsQ('10. Match.', 10, true));
  assert.ok(Q.startsQ('10) Match.', 10, true));
  assert.ok(Q.startsQ('10 .', 10, true), 'pdf.js often splits the full stop off');
  assert.ok(Q.startsQ('10', 10, false), 'a lone number in the margin');
  assert.ok(Q.startsQ('Q10 Match', 10, false));
  assert.ok(!Q.startsQ('10 + 10 + 10', 10, false), 'working is not a question');
  assert.ok(!Q.startsQ('10 x 3', 10, false));
  assert.ok(!Q.startsQ('10 cm', 10, false), 'a measurement is not a question');
  assert.ok(!Q.startsQ('11. Next', 10, true), 'another number');
  assert.ok(!Q.startsQ('100. ', 10, true));
  assert.ok(!Q.startsQ('Questions 10 to 14 carry 2 marks each.', 10, false));
  assert.equal(Q.qNumOf('11. Find the', true), 11);
  assert.equal(Q.qNumOf('Questions 10 to 14', false), 0);
});

test('section lines and footers are told apart from the question', () => {
  assert.ok(Q.isSection({ s: 'Questions 10 to 14 carry 2 marks each.' }));
  assert.ok(Q.isSection({ s: 'Questions 15 - 18 carry 3 marks each' }));
  assert.ok(Q.isSection({ s: 'Section B' }));
  assert.ok(Q.isSection({ s: 'End of Paper' }));
  assert.ok(!Q.isSection({ s: 'Match.' }));
  assert.ok(Q.isFooter({ s: 'www.sgexam.com', y: 0.95 }));
  assert.ok(Q.isFooter({ s: '4', y: 0.95 }));
  assert.ok(Q.isFooter({ s: 'Go on to the next page', y: 0.85 }));
  assert.ok(!Q.isFooter({ s: '4', y: 0.5 }), 'a number half way down is not a footer');
});

test('Q10 from the screenshot: only Q10 — no Q9 tail, no section line, no footer', () => {
  const b = Q.locate(screenshotPage(), 10);
  assert.ok(b, 'found');
  assert.ok(b.top > 0.69 && b.top < 0.72, 'starts at the "10." line, below the section line: ' + b.top);
  assert.ok(b.bot > 0.9 && b.bot < 0.955, 'stops above the footer: ' + b.bot);
  assert.equal(b.why, 'footer');
});

test('Q9 stops at the section line', () => {
  const b = Q.locate(screenshotPage(), 9);
  assert.ok(b);
  assert.ok(b.top < 0.40 && b.top > 0.37);
  assert.ok(b.bot <= 0.68 && b.bot > 0.65, 'above "Questions 10 to 14…": ' + b.bot);
  assert.equal(b.why, 'section');
});

test('the next question in the same margin ends it; numbers inside the question do not', () => {
  const page = [
    it('3.', 0.08, 0.10), it('Find the total.', 0.13, 0.10),
    it('4', 0.40, 0.15), it('12', 0.09, 0.20, 0.014, 0.02),   // a number in a table at the left, not punctuated
    it('4.', 0.08, 0.40), it('Next one', 0.13, 0.40)
  ];
  const b = Q.locate(page, 3);
  assert.ok(Math.abs(b.bot - 0.394) < 0.01, 'ends above "4.": ' + b.bot);
  assert.equal(b.why, 'next');
});

test('a printed "10." beats a "10" that is something else', () => {
  const page = [
    it('10', 0.05, 0.20), it('cm', 0.08, 0.20),          // "10 cm" in the margin
    it('9.', 0.08, 0.10), it('Q nine', 0.13, 0.10),
    it('10.', 0.08, 0.50), it('Real ten', 0.13, 0.50),
    it('11.', 0.08, 0.70), it('Eleven', 0.13, 0.70)
  ];
  const b = Q.locate(page, 10);
  assert.ok(b.top > 0.47 && b.top < 0.5, 'the real Q10: ' + b.top);
  assert.ok(b.bot < 0.7);
});

test('a page with no such number, or no words at all, finds nothing', () => {
  assert.equal(Q.locate(screenshotPage(), 23), null);
  assert.equal(Q.locate([], 10), null);
  assert.equal(Q.locate(null, 10), null);
  assert.equal(Q.locate(screenshotPage(), 0), null);
});

test('a question continued over the page starts under the running header', () => {
  const page2 = [
    it('Primary 3 Mathematics Paper', 0.30, 0.025),
    it('(b) How many more?', 0.13, 0.12, 0.014, 0.3),
    it('Ans:', 0.6, 0.30),
    it('12.', 0.08, 0.40), it('Twelve', 0.13, 0.40)
  ];
  const b = Q.locate(page2, 11, { cont: true });
  assert.ok(b.top > 0.09 && b.top < 0.12, 'below the header: ' + b.top);
  assert.ok(b.bot < 0.40 && b.bot > 0.38);
  const fresh = [it('12.', 0.08, 0.10), it('Twelve', 0.13, 0.10)];
  assert.equal(Q.locate(fresh, 11, { cont: true }), null, 'a page that starts a new question carried nothing over');
});

test('pdf.js items are turned into page fractions, top down', () => {
  // A 600 × 800 page at scale 1: the viewport flips y.
  const vt = [1, 0, 0, -1, 0, 800];
  const items = Q.fromPdf([{ str: '10.', transform: [12, 0, 0, 12, 60, 200], width: 14, height: 12 },
                           { str: '   ', transform: [12, 0, 0, 12, 0, 0], width: 1 }], vt, 600, 800);
  assert.equal(items.length, 1, 'blank items are dropped');
  assert.ok(Math.abs(items[0].x - 0.1) < 1e-9);
  assert.ok(Math.abs(items[0].y - (800 - 200 - 12) / 800) < 1e-9, 'y is the top of the glyphs');
  assert.ok(Math.abs(items[0].h - 12 / 800) < 1e-9);
  // …and at scale 2 the fractions are the same.
  const two = Q.fromPdf([{ str: '10.', transform: [12, 0, 0, 12, 60, 200], width: 14 }], [2, 0, 0, -2, 0, 1600], 1200, 1600);
  assert.ok(Math.abs(two[0].x - 0.1) < 1e-9 && Math.abs(two[0].y - items[0].y) < 1e-9);
});

test('the ink box finds the drawing and ignores a speck', () => {
  const w = 20, h = 10, data = new Uint8ClampedArray(w * h * 4).fill(255);
  const dark = (x, y) => { const i = (y * w + x) * 4; data[i] = data[i + 1] = data[i + 2] = 0; };
  for (let x = 4; x <= 12; x++) { dark(x, 3); dark(x, 6); }
  dark(18, 9);                                              // one speck
  const b = Q.inkBox(data, w, h);
  assert.deepEqual(b, { x0: 4, y0: 3, x1: 12, y1: 6 });
  assert.equal(Q.inkBox(new Uint8ClampedArray(w * h * 4).fill(255), w, h), null);
});

test('the app uses it: filing, setting out again, and the old pictures', () => {
  assert.ok(html.includes('<script src="question-band.js?v=' + html.match(/var APP_VERSION = 'v([0-9.]+)';/)[1] + '"></script>'));
  assert.match(html, /band = await qbandCrop\(qbOpenSource, it\)/, 'filing cuts by the number first');
  assert.match(html, /mbRebuild\(it, ref\.id, context, \{ noQcrop: !!band \}\)/, 'and then asks no model to cut or redraw it');
  assert.match(html, /var patch = \{ cropV: QB_V \};/, 'a new mistake is never cut again');
  assert.match(html, /if \(where && where\.src\) crop = await qbandCrop\(where\.src, m\);/, '🧩 set out again uses it too');
  assert.match(html, /if \(typeof qbQueue === 'function'\) qbQueue\(ids, true\);/, 'a practice session queues its own questions first');
  assert.match(html, /if \(view === 'mistake' && typeof qbSweep === 'function'\) qbSweep\(\);/, 'the book cuts a few old ones');
  assert.match(html, /if \(\(Number\(m\.cropV\) \|\| 0\) >= QB_V\) return false;/);
  assert.match(html, /if \(tier !== 'question' && tier !== 'page'\) return false;/, 'blocks are left alone');
  // The old picture goes only after the new one is written.
  const recrop = html.slice(html.indexOf('async function qbRecrop('), html.indexOf('var _qbShowTimer'));
  assert.ok(recrop.indexOf('.set(patch, { merge: true })') < recrop.indexOf('storage.ref(oldPath).delete()'));
  // A picture being drawn on is not swapped under the pen.
  assert.match(html, /!\(pracDrawOf\(m\) && pracDrawOf\(m\)\.hasInk\(\)\)/);
});

test('no model, network or Firestore inside question-band.js', () => {
  assert.ok(!/askGemini|fetch\(|firebase|firestore|storage\./i.test(src));
});

test('the build prompt tells the model where a question starts and stops', () => {
  assert.match(html, /never takes in the end of the previous ' \+\s*\n\s*'question/);
  assert.match(html, /Questions 10 to 14 ' \+\s*\n\s*'carry 2 marks each/);
});
