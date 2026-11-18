/* ✏️ DRAW ON THE QUESTION (v1.98.0) — practice-draw.js's pure half and the
   wiring in ✏️ Practise. Run: node --test tools/practice-draw-tests.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
require('../practice-draw.js');
const D = globalThis.PracDraw;
const src = readFileSync(join(here, '..', 'practice-draw.js'), 'utf8');
const css = readFileSync(join(here, '..', 'practice-draw.css'), 'utf8');
const html = readFileSync(join(here, '..', 'index.html'), 'utf8');

test('questions answered ON the picture pick the pen up for the student', () => {
  [
    'Match.',
    'Match each number sentence to its answer.',
    'Join the dots to make the shape.',
    'Circle the odd one out.',
    'Shade 3/4 of the figure.',
    'Draw a line of symmetry on the figure.',
    'Complete the bar model below.',
    'Tick the correct box.',
    'Write the missing number in the box.',
    'Label the parts of the plant.',
    'Plot the points on the grid.',
    'Colour the triangles red.'
  ].forEach(q => assert.ok(D.wantsDrawing(q), q));
  [
    'What is 3 x 10?',
    'Wendy has 30 stickers. How many friends can she give 6 stickers to?',
    'Explain why the ice melted.',
    '',
    null
  ].forEach(q => assert.ok(!D.wantsDrawing(q), String(q)));
});

test('a stroke is kept only as fractions of the picture, with a known tool and colour', () => {
  const s = D.cleanStroke({ t: 'pen', c: '#D32F2F', w: 0.006, p: [[0.1, 0.2, 0.7], [1.4, -2, 3], ['x', 0.5]] });
  assert.equal(s.t, 'pen');
  assert.equal(s.c, '#D32F2F');
  assert.deepEqual(s.p[1], [1, 0, 0.5], 'clamped inside the picture; a pressure over 1 is not a pressure');
  assert.deepEqual(s.p[2], [0, 0.5, 0.5]);
  const odd = D.cleanStroke({ t: 'spray', c: 'javascript:1', w: 9, p: [[0.5, 0.5]] });
  assert.equal(odd.t, 'pen');
  assert.equal(odd.c, D.COLOURS[0].c);
  assert.equal(odd.w, D.PEN_W);
  assert.equal(D.cleanStroke({ p: [] }), null);
  assert.equal(D.cleanStroke(null), null);
  assert.equal(D.cleanStroke({ t: 'hi', p: [[0, 0]] }).w, D.HI_W);
});

test('the eraser touches a stroke it rubs over, and not one beside it', () => {
  const line = { t: 'pen', w: 0.005, p: [[0.1, 0.5], [0.9, 0.5]] };
  assert.ok(D.strokeHit(line, 0.5, 0.505, 0.02, 1));
  assert.ok(!D.strokeHit(line, 0.5, 0.6, 0.02, 1));
  // On a tall picture a step down is a longer way: 0.05 of the height of a
  // picture twice as tall as it is wide is 0.1 of its width.
  assert.ok(D.strokeHit(line, 0.5, 0.51, 0.02, 2));
  assert.ok(!D.strokeHit(line, 0.5, 0.55, 0.02, 2));
  assert.ok(D.strokeHit({ t: 'pen', w: 0.005, p: [[0.3, 0.3]] }, 0.305, 0.3, 0.02, 1), 'a dot');
});

test('ink is counted across pictures', () => {
  assert.equal(D.inkCount({}), 0);
  assert.equal(D.inkCount({ q0: [{}, {}], q1: [{}] }), 3);
});

test('a finger scrolls unless a drawing tool is picked; a pencil always writes; a palm never does', () => {
  assert.match(src, /if \(tool === 'scroll'\) \{\s*if \(e\.pointerType !== 'pen'\) return;/);
  assert.match(src, /if \(e\.pointerType === 'touch' && S\.penSeen\) return;/);
  assert.match(src, /return S\.readOnly \|\| S\.tool === 'scroll' \? 'pan-x pan-y pinch-zoom' : 'none';/);
});

test('every tool is a finger-sized target and the bar stays in view', () => {
  assert.match(css, /\.pdBtn \{[\s\S]*?min-height: 44px;/);
  assert.match(css, /\.pdBar \{[\s\S]*?position: sticky;/);
  assert.match(css, /@media print \{ \.pdBar, \.pdInk \{ display: none !important; \} \}/);
});

test('no model, network or storage in practice-draw.js', () => {
  assert.ok(!/askGemini|fetch\(|firebase|firestore|localStorage|storage\./i.test(src));
});

test('✏️ Practise puts the pen on the question and marks what was drawn', () => {
  const v = html.match(/var APP_VERSION = 'v([0-9.]+)';/)[1];
  assert.ok(html.includes('<script src="practice-draw.js?v=' + v + '"></script>'));
  assert.ok(html.includes('<link rel="stylesheet" href="practice-draw.css?v=' + v + '">'));
  assert.match(html, /var drawn = asMcq \? null : pracDrawMount\(m, body, qNodes\);/, 'every non-MCQ picture gets the pen');
  assert.match(html, /n\.tagName === 'IMG' && !n\.classList\.contains\('mqOptsPic'\)/);
  assert.match(html, /if \(!mine && !drew\) \{/, 'a drawing alone is an answer');
  assert.match(html, /images: inked\.length \? inked\.map/, 'and it is sent to the marker');
  assert.match(html, /if \(inked\.length\) lines\.push\(pracDrawPromptLine\(inked\)\);/);
  assert.match(html, /prac\.draw = null;\s+\/\/ ✏️ a fresh page for the next question/);
  assert.match(html, /S\.setReadOnly\(!!prac\.revealed \|\| !!prac\.busy\);/, 'read-only once marked');
  assert.match(html, /if \(cors\) img\.crossOrigin = 'anonymous';/, 'the picture can be read back for the marker');
  // The ink is the session's and is never saved with the mistake.
  const block = html.slice(html.indexOf('✏️ DRAW ON THE QUESTION — the pen in ✏️ Practise'), html.indexOf('function pracRender(finished)'));
  assert.ok(block.length > 500);
  assert.ok(!/mistakesCollRef|\.set\(|\.update\(/.test(block), 'the ink is never written to the book');
});
