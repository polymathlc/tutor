/* tools/cer-mcq-tests.mjs — the pure half of cer-mcq.js (🔘 a wrong MCQ tried
   again in the Science portal's format, v1.82.0), plus the file-level rules:
   it never reaches a model by itself, the app hands it the grounded `lpAsk`,
   and lo-practice's try box takes the host's MCQ through `setMcq`.
   Run: node --test tools/cer-mcq-tests.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const CM = require('../cer-mcq.js');
const LP = require('../lo-practice.js');
const P = CM.pure;
const SRC = readFileSync(join(here, '..', 'cer-mcq.js'), 'utf8');
const CSS = readFileSync(join(here, '..', 'cer-mcq.css'), 'utf8');
const HTML = readFileSync(join(here, '..', 'index.html'), 'utf8');
const LPSRC = readFileSync(join(here, '..', 'lo-practice.js'), 'utf8');

const four = [{ label: '1', text: '12 cm' }, { label: '2', text: '18 cm' }, { label: '3', text: '24 cm' }, { label: '4', text: '36 cm' }];

test('a choice reads the way the portal reads one', () => {
  assert.equal(P.normChoice('(2)'), '2');
  assert.equal(P.normChoice('2.'), '2');
  assert.equal(P.normChoice('Option B'), '2');
  assert.equal(P.normChoice('b'), '2');
  assert.equal(P.normChoice('the answer: 3'), '3');
  assert.equal(P.normChoice(''), '');
  assert.equal(P.normChoice(null), '');
});

test('the options come in ONE shape, numbered underneath, labelled as printed', () => {
  const o = P.optionsOf({ options: four });
  assert.deepEqual(o.map(x => x.n), ['1', '2', '3', '4']);
  assert.deepEqual(o.map(x => x.label), ['1', '2', '3', '4']);
  const lettered = P.optionsOf({ options: [{ text: 'a cat' }, { text: 'a dog' }], letters: true });
  assert.deepEqual(lettered.map(x => x.label), ['A', 'B']);
  const own = P.optionsOf({ options: [{ label: '(A)', text: 'x' }, { label: 'B.', text: 'y' }] });
  assert.deepEqual(own.map(x => x.label), ['A', 'B'], 'the paper’s own label, brackets taken off');
  const pic = P.optionsOf({ options: [], count: 4 });
  assert.equal(pic.length, 4, 'a picture of the options still gives four to choose between');
  assert.ok(pic.every(x => x.text === ''));
  const bare = P.optionsOf({ options: [{ label: '1', text: '(1)' }, { label: '2', text: '(2)' }] });
  assert.ok(bare.every(x => x.text === ''), 'a bare marker is drawn as the label alone');
  assert.equal(P.optionsOf({ options: [{ text: 'only one' }] }).length, 1);
  assert.equal(CM.isMcq({ options: [{ text: 'only one' }] }), false, 'one option is not a choice');
  assert.equal(CM.isMcq({ options: four }), true);
});

test('which option is right: the recorded number first, then the key', () => {
  const o = P.optionsOf({ options: four });
  assert.equal(P.correctIndex(o, '2', ''), 1, 'the recorded option');
  assert.equal(P.correctIndex(o, 'B', ''), 1, 'a letter reads as its number');
  assert.equal(P.correctIndex(o, '', '(3) 24 cm'), 2, 'a key that starts with its label');
  assert.equal(P.correctIndex(o, '', '4'), 3, 'a key that is only the label');
  assert.equal(P.correctIndex(o, '', '36 cm'), 3, 'a key in words names its option');
  assert.equal(P.correctIndex(o, '', '18'), 1, 'a bare number is the option that says it, never option 18');
  assert.equal(P.correctIndex(o, '', 'cm'), -1, 'a key that matches several options is unsure, not a guess');
  assert.equal(P.correctIndex(o, '', ''), -1);
  assert.equal(P.correctIndex(o, '9', ''), -1, 'a number the list does not have');
  const lettered = P.optionsOf({ options: [{ label: 'A', text: 'evaporation' }, { label: 'B', text: 'condensation' }, { label: 'C', text: 'melting' }] });
  assert.equal(P.correctIndex(lettered, '', 'B) condensation'), 1);
  assert.equal(P.correctIndex(lettered, '', 'condensation'), 1);
  assert.equal(P.correctIndex(lettered, 'C', ''), 2);
});

test('the reasons are placed by the option’s OWN number and nothing else', () => {
  const o = P.optionsOf({ options: four });
  const got = P.normItems({ options: [{ n: '(3)', why: 'three' }, { n: '1', why: 'one' }, { n: '9', why: 'nine' }, { n: '1', why: 'again' }] }, o);
  assert.deepEqual(got, { 3: 'three', 1: 'one' }, 'an unknown number is dropped and a repeat is a duplicate');
  const pos = P.normItems(['a', 'b', 'c', 'd'], o);
  assert.deepEqual(pos, { 1: 'a', 2: 'b', 3: 'c', 4: 'd' }, 'unnumbered, one per option: in order');
  assert.deepEqual(P.normItems(['a', 'b'], o), {}, 'a partial unnumbered list cannot be lined up');
  const lettered = P.optionsOf({ options: [{ label: 'A', text: 'x' }, { label: 'B', text: 'y' }] });
  assert.deepEqual(P.normItems({ options: [{ n: 'B', why: 'bee' }] }, lettered), { 2: 'bee' });
  const long = P.normItems({ options: [{ n: '1', why: 'x'.repeat(900) }] }, o);
  assert.ok(long[1].length <= 320, 'the card is a glance, not an essay');
});

test('the model can settle which option is right when the book never recorded it', () => {
  const o = P.optionsOf({ options: four });
  assert.equal(P.correctOf({ correct: '(2)' }, o), 1);
  assert.equal(P.correctOf({ correct: 'D' }, o), 3);
  assert.equal(P.correctOf({ correct: '7' }, o), -1);
  assert.equal(P.correctOf({}, o), -1);
  assert.equal(P.correctOf(null, o), -1);
});

test('the prompt is the portal’s why-not prompt, for any subject', () => {
  const o = P.optionsOf({ options: four });
  const known = P.whyPrompt({ question: 'A ribbon 36 cm long is cut in half. How long is each piece?', subject: 'math', level: 'P4' }, o, 1);
  assert.match(known, /THE QUESTION EXACTLY AS IT IS PRINTED/);
  assert.match(known, /\(1\) 12 cm\n\(2\) 18 cm/);
  assert.match(known, /Option \(2\) is the correct one\./);
  assert.match(known, /For a WRONG option: say what is actually TRUE/);
  assert.match(known, /never algebra/, 'maths: no algebra in the reasons either');
  assert.match(known, /Return ONLY JSON/);
  assert.match(known, /P4 maths teacher/);
  const unknown = P.whyPrompt({ question: 'Which?', key: '18 cm', subject: 'science' }, o, -1);
  assert.match(unknown, /was not recorded/);
  assert.match(unknown, /The answer key printed with the paper says: "18 cm"/);
  assert.match(unknown, /"correct"/);
  assert.match(unknown, /arrowhead and water lily/, 'science keeps the portal’s own example');
  const pic = P.whyPrompt({ question: 'Which shape?' }, P.optionsOf({ count: 4 }), 0);
  assert.match(pic, /the option is drawn in the picture/);
  const hint = P.hintPrompt({ question: 'Which?', subject: 'math' }, o, 1);
  assert.match(hint, /do NOT reveal it or its label/);
  assert.match(hint, /Do NOT state the answer/);
});

test('the file never talks to a model, and never writes HTML from a reply', () => {
  assert.ok(!/askGemini|fetch\(|XMLHttpRequest/.test(SRC), 'the host hands it `ask`');
  const inner = SRC.match(/\.innerHTML\s*=\s*([^;]+);/g) || [];
  assert.ok(inner.every(x => /=\s*''/.test(x)), 'innerHTML is only ever cleared: ' + inner.join(' | '));
  assert.ok(/\.textContent = why;/.test(SRC));
});

test('the ⓘ is armed only after marking or revealing, and only on wrong options', () => {
  const arm = SRC.slice(SRC.indexOf('function arm()'), SRC.indexOf('function disarm()'));
  assert.match(arm, /if \(idx === st\.correct\) return;/);
  const paint = SRC.slice(SRC.indexOf('function paint()'), SRC.indexOf('function feedback('));
  assert.match(paint, /arm\(\);/);
  const calls = (SRC.match(/\barm\(\);/g) || []).length;
  assert.equal(calls, 1, 'paint() is the one door to arm()');
  const open = SRC.slice(SRC.indexOf('function open(lab, idx, pin)'), SRC.indexOf('return {\n      el: wrap'));
  assert.match(open, /if \(!block\.classList\.contains\('wny-on'\)\) return;/, 'the armed class is the gate');
  const reset = SRC.slice(SRC.indexOf('function reset()'), SRC.indexOf('function warmWhy()'));
  assert.match(reset, /disarm\(\);/, 'a reset question keeps no badges');
});

test('the stylesheet carries the portal’s colours', () => {
  assert.match(CSS, /\.cmq-opt\.cmq-right \{ background: #dcfce7; border-color: #16a34a; \}/);
  assert.match(CSS, /\.cmq-opt\.cmq-wrong \{ background: #fee2e2; border-color: #dc2626; \}/);
  assert.match(CSS, /\.cmq-opt\.cmq-picked \{ background: var\(--cmq-blue-light\); border-color: var\(--cmq-blue\); \}/);
  assert.match(CSS, /\.cmq-btn-check \{ background: #16a34a;/);
  assert.match(CSS, /\.cmq-pop \{[\s\S]*z-index: 10200;/, 'above lo-practice’s window (10050)');
});

test('Study Buddy loads it, versioned with the app, and hands it the grounded ask', () => {
  const v = HTML.match(/var APP_VERSION = 'v([0-9.]+)';/)[1];
  assert.ok(HTML.includes('<script src="cer-mcq.js?v=' + v + '"></script>'));
  assert.ok(HTML.includes('<link rel="stylesheet" href="cer-mcq.css?v=' + v + '">'));
  assert.ok(HTML.indexOf('src="cer-mcq.js') > HTML.indexOf('src="lo-practice.js'));
  assert.match(HTML, /ask: lpAsk,\s*\n\s*parse: lpParse,/);
  assert.match(HTML, /function lpAsk\(prompt, opts\) \{[\s\S]{0,400}aiGrounding\('teach'/);
  assert.match(HTML, /LoPractice\.setMcq\(lpMcqNode\)/);
  assert.match(HTML, /if \(asMcq\) \{ pracRenderMcq\(m, body, foot\); return; \}/);
  assert.match(HTML, /questionNodes\(m, 'prac', asMcq \? \{ noOpts: true \} : null\)/, 'the options are not printed twice');
  assert.match(HTML, /retry: false,\s+\/\/ the first ✓ Check is the one that counts/);
  assert.match(HTML, /if \(!m\.cleared\) setMistakeCleared\(m\.id, true\);[\s\S]{0,200}pracRender\(\);\s*\n\s*\}, function \(\) \{/,
    'a right answer files it under Sorted');
});

test('lo-practice’s try box takes the host’s MCQ, and keeps its buttons without one', () => {
  assert.match(LPSRC, /function setMcq\(fn\)/);
  assert.equal(typeof LP.setMcq, 'function');
  const m = LP.fromMistake({ id: 'a', question: 'Half of 36?', type: 'mcq', options: four, option: '2', answer: '(2) 18 cm', subject: 'math' });
  assert.equal(m.opt, '2', 'the recorded option travels');
  const spec = LP.trySpecOfMistake(m);
  assert.equal(spec.m, m);
  let seen = null;
  const fakeDoc = {
    createElement: tag => ({ tag, className: '', children: [], style: {}, setAttribute() {}, appendChild(c) { this.children.push(c); return c; }, addEventListener() {} }),
    createTextNode: t => ({ t })
  };
  LP.setMcq((doc, s) => { seen = s; return { mine: true }; });
  assert.deepEqual(LP.tryNode(fakeDoc, spec), { mine: true });
  assert.equal(seen, spec);
  const open = LP.tryNode(fakeDoc, LP.trySpecOfMistake(LP.fromMistake({ question: 'Say it', answer: '4' })));
  assert.notDeepEqual(open, { mine: true }, 'a written question keeps its own box');
  LP.setMcq(() => null);
  const plain = LP.tryNode(fakeDoc, spec);
  assert.notDeepEqual(plain, { mine: true }, 'nothing back from the host: the plain buttons');
  LP.setMcq(null);
  const p = LP.trySpecOfPractice({ options: ['a', 'b', 'c', 'd'], correct: 2, answer: 'c', working: ['x'] }, m);
  assert.equal(p.m, m);
  assert.equal(p.correct, 2);
});
