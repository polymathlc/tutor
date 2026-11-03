// 🔬 A Science-portal worksheet photographed before cer v1.451.3 says so when opened (v1.75.1).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const grab = (start, end) => { const a = html.indexOf(start); const b = html.indexOf(end, a); assert.ok(a >= 0 && b > a, 'missing ' + start); return html.slice(a, b); };
const src = grab('function stampOf(t) {', '\n}\n') + '\n}\n' + grab('var CER_PHOTO_FIX_AT', 'async function openWorksheet(id) {');
const box = {}; vm.runInNewContext(src, box);
const ts = (iso) => ({ toMillis: () => Date.parse(iso) });
test('a CER export made before the fix went live is flagged', () => {
  assert.equal(box.cerPhotoIsOld({ source: 'cer', createdAt: ts('2026-11-03T16:50:00Z') }), true);
  assert.equal(box.cerPhotoIsOld({ source: 'cer', createdAt: { seconds: Date.parse('2026-10-30T09:00:00Z') / 1000 } }), true);
});
test('a fresh CER export, a non-CER worksheet, or one with no date is left alone', () => {
  assert.equal(box.cerPhotoIsOld({ source: 'cer', createdAt: ts('2026-11-03T17:30:00Z') }), false);
  assert.equal(box.cerPhotoIsOld({ createdAt: ts('2026-10-01T00:00:00Z') }), false);
  assert.equal(box.cerPhotoIsOld({ source: 'cer' }), false);
  assert.equal(box.cerPhotoIsOld(null), false);
});
test('openWorksheet shows the notice, and the message says how to fix it', () => {
  const open = grab('async function openWorksheet(id) {', '\nfunction stampOf');
  assert.match(open, /if \(cerPhotoIsOld\(w\)\)[^\n]*toast\(CER_PHOTO_OLD_MSG/);
  assert.match(box.CER_PHOTO_OLD_MSG, /Send the worksheet to Study Buddy again from the Science portal/);
});
