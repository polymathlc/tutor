// ✏️ The model suite (v1.88.0) — Ans Key's bar-model drawing board in Study Buddy.
// These pin what the source must keep saying; tools/model-studio-browser-check.mjs
// drives the real board in Chromium.
//
// model-studio.js and model-studio.css are polymathlc/anskey's files, byte for
// byte. When Ans Key is checked out beside this repo (../anskey or
// ../polymathlc/anskey) the copies are compared, so a fix made in one and not
// the other fails here rather than drifting silently.
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const studio = fs.readFileSync(path.join(ROOT, 'model-studio.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'model-studio.css'), 'utf8');
const code = studio.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const cssCode = css.replace(/\/\*[\s\S]*?\*\//g, '');

function fn(src, name) {
  const at = src.search(new RegExp('(async )?function ' + name + '\\('));
  assert.ok(at >= 0, name + ' exists');
  return src.slice(at, src.indexOf('\n}\n', at) + 2);
}
const GLUE_START = '/* ================= ✏️ Model suite — the model studio\'s glue';
const glueAt = html.indexOf(GLUE_START);
const glue = html.slice(glueAt, html.indexOf('\n})();\n', html.indexOf('msBindWindow();', glueAt)) + 6);
const card = html.slice(html.indexOf('<div class="msFloat" id="msModal">'), html.indexOf('<!-- Where the pages are put to be printed.'));

test('the suite is for drawing only: no question, scenario, model answer or AI marking came across', () => {
  for (const word of ['scenario', 'Scenario', 'askGemini', 'gemini', 'openai', 'fetch(', 'runAiCheck', 'referenceSvg', 'expectedModel', 'CONCEPTS'])
    assert.ok(!code.includes(word), word + ' must not be in model-studio.js');
  assert.ok(card.length > 1000, 'the window markup is there');
  for (const word of ['textarea', 'AI Check', 'Model Answer', 'New Scenario', 'concept'])
    assert.ok(!card.includes(word), word + ' must not be in the window');
  for (const toolName of ['select', 'bar', 'split', 'razor', 'shade', 'label', 'brace', 'arrow', 'divider', 'dotted', 'align', 'pen', 'eraser'])
    assert.ok(card.includes('data-tool="' + toolName + '"'), 'the ' + toolName + ' tool is on the toolbar');
  // The glue never reaches a model either, so the help ceiling has nothing to guard here.
  for (const word of ['askGemini', 'aiAsk', 'fetch(', 'aiGrounding'])
    assert.ok(!glue.includes(word), word + ' must not be in the glue');
});

test('the engine keeps to its window: closure, scoped lookups and scoped CSS', () => {
  assert.ok(/^\(function \(\) \{$/m.test(studio) && studio.trimEnd().endsWith('})();'), 'one closure');
  assert.equal((studio.match(/document\.getElementById\(/g) || []).length, 1, 'only #msCard itself is found by id');
  assert.ok(/msRoot\.addEventListener\('keydown', function \(event\) \{[\s\S]*?event\.stopPropagation\(\);\n\}\);/.test(studio), 'every key stops at the window');
  for (const rule of cssCode.split('}').map(r => r.trim()).filter(r => r && !r.startsWith('@') && !/^(from|to)\b/.test(r))) {
    const selector = rule.split('{')[0].trim();
    if (!selector || /^@|^(from|to)$|font-family|unicode-range|src:/.test(selector)) continue;
    for (const part of selector.split(',')) assert.ok(part.trim().startsWith('#msCard'), 'scoped: ' + part.trim());
  }
  assert.ok(!/:root/.test(cssCode), 'tokens live on #msCard, not :root');
});

test('it is loaded once, versioned with the app, after its window and before the app script', () => {
  const v = html.match(/var APP_VERSION = 'v([0-9.]+)';/)[1];
  assert.ok(html.includes('<script src="model-studio.js?v=' + v + '"></script>'));
  assert.ok(html.includes('<link rel="stylesheet" href="model-studio.css?v=' + v + '">'));
  assert.equal(html.split('<script src="model-studio.js').length - 1, 1, 'one script tag');
  assert.ok(html.indexOf('id="msModal"') < html.indexOf('<script src="model-studio.js'), 'the window exists before its script runs');
  assert.ok(html.indexOf('<script src="model-studio.js') < html.indexOf("'use strict';\n\n/* ====="), 'window.ModelStudio is there before the glue binds to it');
  assert.ok(/id="barModelBtn"[^>]*aria-controls="msModal"/.test(html), 'the toolbar button');
  assert.ok(!/id="barModelBtn"[^>]*data-tool=/.test(html), 'a window, not a tool — setTool must never light or clear it');
});

test('the window is a float of its own, never a .modalBack', () => {
  assert.ok(!/class="[^"]*modalBack[^"]*" id="msModal"/.test(html), 'the Escape sweep and the paste rule read .modalBack.open');
  assert.ok(/\.msFloat \{ position: fixed; inset: 0; z-index: 120; display: none; pointer-events: none; \}/.test(html), 'clicks fall through round the card');
  assert.ok(/\.msFloat \.modalCard \{\n\s*pointer-events: auto;/.test(html));
});

test('a pinned model is an ordinary picture that carries its model — never a new annotation type', () => {
  const pin = fn(html, 'msPinToPage');
  assert.ok(/type: 'image',/.test(pin), 'the picture a paste makes');
  assert.ok(/ms: \{ v: MS_DATA_VERSION, el: elements \}/.test(pin), 'the model rides along on a.ms');
  assert.ok(/ratio: round2\(ratio\)/.test(pin), 'its own shape, so a corner drag keeps it');
  assert.ok(pin.indexOf('msFlush();') < pin.indexOf('msAttachedId = a.id'), 'the scratch board is saved before the picture takes it over');
  assert.ok(pin.indexOf('if (!msCanPin())') >= 0 && pin.lastIndexOf('msCanPin()') > pin.indexOf('api.picture()'), 'refused in the handler, and again after the picture is drawn');
  assert.ok(/epoch !== wsEpoch/.test(pin), 'a worksheet changed while it drew is refused');
  assert.ok(/pushUndo\(\);[\s\S]*annotations\.push\(a\)/.test(pin), 'one undo step');
  assert.ok(/annPastePic\(a\) && !!a\.ms/.test(fn(html, 'annModelStudio')));
  assert.ok(/function annPastePic\(a\) \{ return !!\(a && a\.type === 'image'\); \}/.test(html), 'still the one picture type');
  const chrome = fn(html, 'renderPicChromeOn');
  assert.ok(/annModelStudio\(a\)[\s\S]*Edit model[\s\S]*msEditAttached\(a\.id\)/.test(chrome), '✎ on the picture\'s own row');
});

test('every student may pin a model to their own page; a playing video solution may not be drawn over', () => {
  const can = fn(html, 'msCanPin');
  assert.ok(/view === 'ws' && pages\.length > 0/.test(can));
  assert.ok(/lessonPlayback/.test(can) && /lessonOpening/.test(can));
  assert.ok(!/isAdmin|isStudent|lessonTeacher/.test(can), 'no role gate: it is the student\'s working');
});

test('a model opened from a picture is written to that picture, never to the scratch board', () => {
  const flush = fn(html, 'msFlush');
  const attachedBranch = flush.slice(flush.indexOf('if (msAttachedId)'), flush.indexOf('try {'));
  assert.ok(/att\.ms = \{ v: MS_DATA_VERSION, el: api\.elements\(\) \}/.test(attachedBranch));
  assert.ok(/msRefreshSoon\(\);/.test(attachedBranch), 'the picture follows the drawing');
  assert.ok(/return;\n  \}\n  try \{/.test(flush), 'the attached branch returns before the scratch write');
  assert.ok(/msAttachedId = null;/.test(attachedBranch), 'a deleted picture releases its model');
  const refresh = fn(html, 'msRefreshAttachedPicture');
  assert.ok(refresh.indexOf('elements = api.elements()') < refresh.indexOf('api.picture()'), 'the elements are taken with the picture');
  assert.ok(/epoch !== wsEpoch/.test(refresh), 'a late picture never lands on the next worksheet');
  assert.ok(/msAttachedId = null;\n  return refresh;/.test(fn(html, 'closeModelStudio')), 'closing lets go of the picture at once');
});

test('the worksheet lifecycle: a new worksheet lets go, leaving it closes the window', () => {
  const load = fn(html, 'loadPdf');
  assert.ok(load.indexOf('msWorksheetClosing()') > 0 && load.indexOf('msWorksheetClosing()') < load.indexOf('annotations = [];'), 'before the annotations are replaced');
  const close = fn(html, 'msWorksheetClosing');
  assert.ok(!/setDirty|annotations\.|\.ms = /.test(close), 'letting go writes nothing');
  assert.ok(/if \(v !== 'ws' && typeof closeModelStudio === 'function'\) closeModelStudio\(\);/.test(fn(html, 'showView')));
});

test('the usage panel can name both events', () => {
  assert.ok(/modelsuite: \{ label: 'Opened the model suite'/.test(html));
  assert.ok(/modelpin: \{ label: 'Put a drawn model on the page'/.test(html));
  assert.ok(/usageNote\('modelsuite', docName \|\| ''\)/.test(glue) && /usageNote\('modelpin', docName \|\| ''\)/.test(glue));
});

test('the glue survives a harness slice with a mock document', () => {
  assert.ok(/if \(typeof document === 'undefined' \|\| typeof document\.getElementById !== 'function'\) return;\n  if \(!document\.getElementById\('msModal'\)/.test(glue));
});

const SIBLINGS = [path.join(ROOT, '..', 'anskey'), path.join(ROOT, '..', 'polymathlc', 'anskey')];
const anskey = SIBLINGS.find(p => fs.existsSync(path.join(p, 'model-studio.js')));
test('model-studio.js and .css are Ans Key\'s, byte for byte', { skip: anskey ? false : 'polymathlc/anskey is not checked out beside this repo' }, () => {
  assert.equal(studio, fs.readFileSync(path.join(anskey, 'model-studio.js'), 'utf8'), 'model-studio.js differs from Ans Key\'s — port the fix across');
  assert.equal(css, fs.readFileSync(path.join(anskey, 'model-studio.css'), 'utf8'), 'model-studio.css differs from Ans Key\'s — port the fix across');
});
