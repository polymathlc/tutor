import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const focus = require('../tutor-focus.js');

const viewport = { width: 600, height: 800, transform: [1, 0, 0, -1, 0, 800] };
const styles = { regular: { ascent: .8, descent: -.2, vertical: false } };
function item(str, left = 50, baseline = 120, width = 240, extra = {}) {
  return { str, width, height: 12, transform: [12, 0, 0, 12, left, 800 - baseline], fontName: 'regular', dir: 'ltr', ...extra };
}
function index(items, customViewport = viewport, customStyles = styles) { return focus.buildIndex({ items, styles: customStyles }, customViewport); }

test('focus markers accept literal page, optional label and quote, never coordinates', () => {
  assert.deepEqual(focus.parse('p1 | Q7 | diameter 60 cm'), { page: 1, label: 'Q7', quote: 'diameter 60 cm' });
  assert.deepEqual(focus.parse('p12 | exact printed words'), { page: 12, label: '', quote: 'exact printed words' });
  for (const malformed of ['', 'p0 | words', 'p1001 | words', 'p1 400,500 underline', 'p1 | Q7 |', 'p1 | Q7 | words | extra', 'p1 | first\nsecond', null, {}, 'p1 | ' + 'x'.repeat(181)]) assert.equal(focus.parse(malformed), null);
  const literal = '<img src=x onerror=alert(1)>';
  assert.equal(focus.parse('p1 | Q7 | ' + literal).quote, literal);
  assert.equal(focus.parse('p1 | ' + 'Q'.repeat(41) + ' | printed words'), null);
});
test('diameter 60 cm highlights the whole verified text run rather than estimated character positions', () => {
  const data = index([item('7. A circle has a diameter 60 cm. Find its area.', 50, 120, 320)]);
  const result = focus.match(data, 'diameter 60 cm');
  assert.equal(result.status, 'matched');
  assert.deepEqual(result.rects, [{ left: 50, top: 110.4, width: 320, height: 12 }]);
  assert.equal(data.text.slice(data.runs[0].start, data.runs[0].end), '7. a circle has a diameter 60 cm. find its area.');
});
test('split PDF items retain exact text-to-item mapping and return their full measured boxes', () => {
  const data = index([item('diameter', 50, 120, 48), item('60', 103, 120, 12), item('cm', 120, 120, 14)]);
  assert.equal(data.text, 'diameter 60 cm');
  const result = focus.match(data, 'Diameter\u00a060 cm');
  assert.equal(result.status, 'matched'); assert.deepEqual(result.rects.map(x => x.width), [48, 12, 14]);
  assert.deepEqual(data.runs.map(run => data.text.slice(run.start, run.end)), ['diameter', '60', 'cm']);
});
test('adjoining measured runs can form a split word, with no character-width interpolation', () => {
  const data = index([item('dia', 50, 120, 18), item('meter ', 68, 120, 30), item('60 cm', 103, 120, 31)]);
  assert.equal(data.text, 'diameter 60 cm');
  assert.equal(focus.match(data, 'diameter 60 cm').status, 'matched');
});
test('a repeated quote is ambiguous even when only one occurrence has usable geometry', () => {
  const data = index([item('diameter 60 cm', 50, 120, 100), item('diameter 60 cm', 50, 180, 100)]);
  assert.equal(focus.match(data, 'diameter 60 cm').status, 'ambiguous');
  const partlyRotated = index([item('diameter 60 cm'), item('diameter 60 cm', 50, 180, 100, { transform: [0, 12, -12, 0, 50, 620] })]);
  assert.equal(focus.match(partlyRotated, 'diameter 60 cm').status, 'ambiguous');
});
test('normalization preserves decimals, units, exponents and mathematical punctuation', () => {
  const data = index([item('diameter 7.5 cm; area 60 cm²; 9 − 3 = 6; 8 ÷ 2 = 4', 30, 120, 450)]);
  assert.equal(focus.match(data, 'diameter 7.5 cm').status, 'matched');
  assert.equal(focus.match(data, 'diameter 75 cm').status, 'not_found');
  assert.equal(focus.match(data, 'area 60 cm²').status, 'matched');
  assert.equal(focus.match(data, 'area 60 cm2').status, 'not_found');
  assert.equal(focus.match(data, '9 − 3 = 6; 8 ÷ 2 = 4').status, 'matched');
  assert.equal(focus.match(data, '9 3 = 6; 8 2 = 4').status, 'not_found');
  assert.equal(focus.match(index([item('diameter 600 cm')]), 'diameter 60 cm').status, 'not_found');
  assert.equal(focus.match(index([item('diameter 60 cms')]), 'diameter 60 cm').status, 'not_found');
});
test('short quotes, scanned pages and non-text PDF items produce quote cards without guessed boxes', () => {
  assert.equal(focus.match(index([item('60 cm')]), '60 cm').status, 'too_short');
  assert.equal(focus.match(index([]), 'diameter 60 cm').status, 'not_found');
  assert.equal(focus.match(index([{ type: 'beginMarkedContent', id: 'mc0' }]), 'diameter 60 cm').status, 'not_found');
});
test('rotated, skewed, mirrored, vertical, missing-font and out-of-bounds runs never produce boxes', () => {
  for (const extra of [
    { transform: [0, 12, -12, 0, 50, 680] }, { transform: [12, 2, 0, 12, 50, 680] },
    { transform: [-12, 0, 0, 12, 50, 680] }, { dir: 'ttb' }, { fontName: 'missing' },
    { transform: [12, 0, 0, 12, -3, 680] }, { width: 700 }, { height: 0 },
    { transform: [12, 0, 0, 12, 50, 799] }, { width: NaN }
  ]) {
    const result = focus.match(index([item('diameter 60 cm', 50, 120, 100, extra)]), 'diameter 60 cm');
    assert.equal(result.status, 'unreliable', JSON.stringify(extra)); assert.deepEqual(result.rects, []);
  }
  assert.equal(focus.match(index([item('diameter 60 cm')], viewport, { regular: { ascent: .8 } }), 'diameter 60 cm').status, 'unreliable');
  assert.equal(focus.match(index([item('diameter 60 cm')], viewport, { regular: { ...styles.regular, vertical: true } }), 'diameter 60 cm').status, 'unreliable');
});
test('viewport transformation gives canonical measured rectangles at another display scale', () => {
  const double = { width: 1200, height: 1600, transform: [2, 0, 0, -2, 0, 1600] };
  const result = focus.match(index([item('diameter 60 cm', 50, 120, 100)], double), 'diameter 60 cm');
  assert.equal(result.status, 'matched'); assert.deepEqual(result.rects, [{ left: 100, top: 220.8, width: 200, height: 24 }]);
  const rotated = { width: 800, height: 600, transform: [0, 1, 1, 0, 0, 0] };
  assert.equal(focus.match(index([item('diameter 60 cm')], rotated), 'diameter 60 cm').status, 'unreliable');
  const sheared = { width: 600, height: 800, transform: [1, .2, 0, -1, 0, 800] };
  assert.equal(focus.match(index([item('diameter 60 cm')], sheared), 'diameter 60 cm').status, 'unreliable');
});
test('a multi-line quote must occupy neighbouring lines, not distant columns or footers', () => {
  const nearby = index([item('A circle has a', 50, 120, 85, { hasEOL: true }), item('diameter 60 cm', 50, 136, 100)]);
  assert.equal(focus.match(nearby, 'A circle has a diameter 60 cm').status, 'matched');
  const footer = index([item('A circle has a', 50, 120, 85, { hasEOL: true }), item('diameter 60 cm', 50, 700, 100)]);
  assert.equal(focus.match(footer, 'A circle has a diameter 60 cm').status, 'unreliable');
  const columns = index([item('A circle has a', 30, 120, 85), item('diameter 60 cm', 350, 120, 100)]);
  assert.equal(focus.match(columns, 'A circle has a diameter 60 cm').status, 'unreliable');
});
test('browser UMD and Node exports use identical parsing and matching, with no HTML evaluation', () => {
  const browser = vm.createContext({});
  vm.runInContext(fs.readFileSync(new URL('../tutor-focus.js', import.meta.url), 'utf8'), browser);
  assert.equal(typeof browser.TutorFocus.match, 'function');
  const text = '<script>globalThis.pwned=true</script>';
  assert.equal(browser.TutorFocus.parse('p1 | Q7 | ' + text).quote, text);
  assert.equal(browser.pwned, undefined);
  const matched = browser.TutorFocus.match(browser.TutorFocus.buildIndex({ items: [item('diameter 60 cm')], styles }, viewport), 'diameter 60 cm');
  assert.equal(matched.status, 'matched'); assert.deepEqual(JSON.parse(JSON.stringify(matched.rects)), focus.match(index([item('diameter 60 cm')]), 'diameter 60 cm').rects);
});
