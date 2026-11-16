// 🔗 Study Buddy signed in by the class link or PIN (v1.96.0).
// The pure helpers run in a vm; the wiring is read off the files.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src = fs.readFileSync(new URL('../office-pass.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const ctx = { window: {}, globalThis: {} };
ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(src, ctx);
const P = ctx.OfficePass.pure;
const CODE = 'famA_sA1.0.' + 'aB3-_x'.repeat(3).slice(0, 16);

test('a code is only ever a code, a PIN only four digits', () => {
  assert.equal(P.cleanCode(CODE), CODE);
  assert.equal(P.cleanCode(' ' + CODE + ' '), CODE);
  assert.equal(P.cleanCode('famA_sA1.0'), '');
  assert.equal(P.cleanCode('<script>'), '');
  assert.equal(P.cleanPin('48 21x9'), '4821');
  assert.equal(P.pinReady('4821'), true);
  assert.equal(P.pinReady('482'), false);
});

test('?pass= is read once and taken off the address', () => {
  assert.equal(P.passFromSearch('?pass=' + encodeURIComponent(CODE)), CODE);
  assert.equal(P.passFromSearch('?ws=1&pass=' + CODE), CODE);
  assert.equal(P.passFromSearch('?passx=' + CODE), '');
  assert.equal(P.passFromSearch('?pass=nope'), '');
  assert.equal(P.passFromSearch(''), '');
  assert.equal(P.stripPass('https://x.test/tutor/?pass=' + CODE), 'https://x.test/tutor/');
  assert.equal(P.stripPass('https://x.test/tutor/?ws=1&pass=' + CODE + '#top'), 'https://x.test/tutor/?ws=1#top');
  assert.equal(P.stripPass('https://x.test/tutor/'), 'https://x.test/tutor/');
});

test('refusals are said in words a child can act on', () => {
  assert.match(P.errorWords('pin_wait'), /Wait an hour/);
  assert.match(P.errorWords('pass_unknown'), /new one/);
  assert.equal(P.errorWords('x', 'From the server.'), 'From the server.');
  assert.ok(P.errorWords(''));
  assert.equal(P.ENDPOINT, 'https://us-central1-mathgen--app.cloudfunctions.net/ansKeyLiveClass');
});

test('the server decides: nothing here trusts the code, and nothing is written as markup', () => {
  assert.match(src, /action: 'study', code: code/);
  assert.match(src, /action: 'study', pin: pin/);
  assert.match(src, /'X-Firebase-AppCheck': tokens\[1\]/);
  assert.match(src, /signInWithCustomToken\(data\.token\)/);
  assert.match(src, /anon\.delete\(\)/, 'the throwaway anonymous account is not kept');
  assert.match(src, /history\.replaceState\(null, '', stripPass\(loc\.href\)\)/);
  assert.doesNotMatch(src, /innerHTML|outerHTML|insertAdjacentHTML|document\.write/);
  assert.doesNotMatch(src, /localStorage|sessionStorage/, 'the code is never stored by this file');
});

test('the wiring: the slot, the files, and an anonymous user is never a student', () => {
  assert.match(html, /<div id="officePassSlot"><\/div>/);
  assert.match(html, /<script src="office-pass\.js\?v=/);
  assert.match(html, /<link rel="stylesheet" href="office-pass\.css\?v=/);
  const hook = html.slice(html.indexOf('auth.onAuthStateChanged(async function (user) {'));
  const head = hook.slice(0, hook.indexOf('var authEpoch'));
  assert.match(head, /user && user\.isAnonymous/);
  assert.match(head, /OfficePass\.busy\(\)/);
  assert.match(head, /return;/);
});
