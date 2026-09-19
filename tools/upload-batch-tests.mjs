#!/usr/bin/env node
/* =====================================================================
   tools/upload-batch-tests.mjs — 📚 uploading a whole pile of PDFs
   ---------------------------------------------------------------------
   It cuts the REAL upload door out of index.html and runs it in a vm
   against stubs, with `uploadOne` replaced by a recorder — so what is
   tested is the DOOR's own rules, which is where every one of these
   silent failures lives:

   • TWO PAPERS IN FLIGHT AT ONCE is the worst of them. The whole pipeline
     is module globals, so they interleave and each corrupts the other —
     paper 3's key pages hidden on paper 7, paper 5's bytes inside paper
     2's Storage object — and the upload still reports success.
   • The dialog read per file hands paper 2 a blank level, and both
     worksheets look perfectly right on the shelf.
   • One typed name over ten papers is a shelf nobody can search; one
     marking scheme over ten papers keys nine of them wrongly.
   • A failure that sinks the batch loses the nine papers after it; a
     failure that is not NAMED leaves the teacher with no idea which one
     to do again.
   • And a single upload that stops behaving byte-for-byte as it always
     did is a regression nobody asked for.

   Run: node tools/upload-batch-tests.mjs
   ===================================================================== */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const FILE = join(here, '..', 'index.html');
const html = readFileSync(FILE, 'utf8').replace(/\r\n/g, '\n');

let failures = 0, checks = 0;
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

/* ---- The real source ---- */
const START = '/* =====================================================================\n   📚 UPLOADING — ONE PAPER, OR A WHOLE PILE OF THEM';
const END = '/* ---- Changing the help level ---- */';
const a = html.indexOf(START);
if (a === -1) throw new Error('could not find the start of the upload block');
const b = html.indexOf(END, a);
if (b === -1) throw new Error('could not find the end of the upload block');
const source = html.slice(a, b);

/* ---- The world the door runs in ---- */
function makeCtx() {
  const state = {
    fields: { upName: { value: '' }, upLevel: { value: 'P5' }, upSubject: { value: 'math' },
              upPush: { checked: false }, wsTitle: { textContent: '' } },
    modalClosed: false,
    toasts: [],
    views: [],
    listLoads: 0,
    calls: [],          // one entry per uploadOne
    inFlight: 0,
    maxInFlight: 0,
    fail: null,         // a file name whose upload throws
    pushAll: false      // the recorder reports every paper as set for the class
  };
  const ctx = {
    console: { warn() {}, error() {} },
    setTimeout,
    JSON, Math, String, Array, Object, Promise, Boolean, Number, RegExp, Error,
    upGrade: 'method',
    upKeyFile: null,
    currentUser: { uid: 'u1', email: 'chungzhikai@gmail.com' },
    ADMIN_EMAIL: 'chungzhikai@gmail.com',
    isAdmin(u) { return !!u && u.email === 'chungzhikai@gmail.com'; },
    activeStudent() { return null; },
    studentSubjectList() { return ['math']; },
    $(id) {
      if (id === 'uploadModal') return { classList: { remove() { state.modalClosed = true; } } };
      return state.fields[id] || { value: '', textContent: '' };
    },
    toast(msg, ms) { state.toasts.push(String(msg)); },
    showView(v) { state.views.push(v); },
    async loadWorksheets() { state.listLoads++; },
    _state: state
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(source, ctx);
  // The recorder REPLACES the real one after the source has been
  // evaluated — a function declaration would otherwise hoist over it.
  ctx.uploadOne = async function (file, s, keyFile, solo) {
    state.inFlight++;
    state.maxInFlight = Math.max(state.maxInFlight, state.inFlight);
    // A copy, because `s` is ONE object shared across the whole loop.
    const seen = { name: file.name, keyFile: keyFile ? keyFile.name : null, solo: solo,
                   level: s.level, subject: s.subject, grade: s.grade, push: s.push,
                   typedName: s.typedName, step: s.step, modalClosed: state.modalClosed,
                   upKeyFile: ctx.upKeyFile };
    await new Promise(function (r) { setTimeout(r, 0); });
    state.inFlight--;
    state.calls.push(seen);
    if (state.fail && file.name === state.fail) throw new Error('boom');
    return { id: 'id-' + file.name, name: file.name.replace(/\.pdf$/i, ''),
             pushed: !!state.pushAll, level: s.level, subject: s.subject };
  };
  return ctx;
}
function f(name, type) { return { name: name, type: type === undefined ? 'application/pdf' : type }; }
function names(ctx) { return ctx._state.calls.map(function (c) { return c.name; }); }
function lastToast(ctx) { const t = ctx._state.toasts; return t[t.length - 1] || ''; }

/* ===================================================================== */
section('📄 What counts as a PDF');
{
  const ctx = makeCtx();
  ok('a PDF by its mime type', ctx.isPdfFile({ name: 'x', type: 'application/pdf' }));
  ok('a PDF by its extension', ctx.isPdfFile({ name: 'paper.pdf', type: '' }));
  ok('…whatever the case', ctx.isPdfFile({ name: 'PAPER.PDF', type: '' }));
  ok('a picture is not', !ctx.isPdfFile({ name: 'shot.png', type: 'image/png' }));
  ok('nothing is not', !ctx.isPdfFile(null));
  eq('the name loses its extension', ctx.pdfBaseName({ name: 'P5 Heat.pdf' }), 'P5 Heat');
  eq('…whatever the case', ctx.pdfBaseName({ name: 'P5 Heat.PDF' }), 'P5 Heat');
  eq('…and a name with no extension is left alone', ctx.pdfBaseName({ name: 'P5 Heat' }), 'P5 Heat');
}

section('📚 One at a time, in the picker’s order');
{
  const ctx = makeCtx();
  await ctx.handleUpload([f('a.pdf'), f('b.pdf'), f('c.pdf')]);
  eq('every paper went up', names(ctx), ['a.pdf', 'b.pdf', 'c.pdf']);
  eq('NEVER two in flight at once', ctx._state.maxInFlight, 1);
  ok('…and the batch says so as it goes',
     ctx._state.calls.map(function (c) { return c.step; }).join('|') ===
     '📚 1 of 3 · |📚 2 of 3 · |📚 3 of 3 · ');
}

section('🏷 A name belongs to ONE paper');
{
  const ctx = makeCtx();
  const typed = { typedName: 'P5 Science — Heat revision' };
  eq('a single upload takes the typed name',
     ctx.uploadName(f('scan001.pdf'), typed, true), { name: 'P5 Science — Heat revision', typed: true });
  eq('…and one of several takes its OWN file name',
     ctx.uploadName(f('scan001.pdf'), typed, false), { name: 'scan001', typed: false });
  eq('a blank box leaves the file name even on its own',
     ctx.uploadName(f('scan001.pdf'), { typedName: '' }, true), { name: 'scan001', typed: false });
  ok('`typed` can never disagree with the name it came back with',
     ['a', ''].every(function (t) {
       return [true, false].every(function (so) {
         const r = ctx.uploadName(f('scan001.pdf'), { typedName: t }, so);
         return r.typed === (r.name === t && !!t);
       });
     }),
     'it is what lets the read replace a name — a false true silently keeps a file name on the shelf');
}
{
  const ctx = makeCtx();
  ctx._state.fields.upName.value = 'P5 Science — Heat revision';
  await ctx.handleUpload([f('only.pdf')]);
  eq('the typed name reaches a single upload', ctx._state.calls[0].typedName, 'P5 Science — Heat revision');
  ok('…and it knows it is on its own', ctx._state.calls[0].solo === true);
}
{
  const ctx = makeCtx();
  ctx._state.fields.upName.value = 'P5 Science — Heat revision';
  await ctx.handleUpload([f('one.pdf'), f('two.pdf')]);
  ok('a batch is never solo, which is what makes the rule above bite',
     ctx._state.calls.every(function (c) { return c.solo === false; }));
}

section('🔑 A key belongs to ONE paper too');
{
  const ctx = makeCtx();
  ctx.upKeyFile = { name: 'scheme.pdf' };
  await ctx.handleUpload([f('one.pdf'), f('two.pdf'), f('three.pdf')]);
  eq('it goes on the first paper and no other',
     ctx._state.calls.map(function (c) { return c.keyFile; }), ['scheme.pdf', null, null]);
  ok('…and the summary says which paper got it', /answer key went on “one”/.test(lastToast(ctx)),
     lastToast(ctx));
  eq('the held key is cleared before the first paper starts', ctx._state.calls[0].upKeyFile, null);
}

section('⚙️ The dialog is read ONCE, before the loop');
{
  const ctx = makeCtx();
  ctx._state.fields.upLevel.value = 'P4';
  const p = ctx.handleUpload([f('one.pdf'), f('two.pdf')]);
  // The dialog is cleared and reopened while the loop is still running.
  ctx._state.fields.upLevel.value = '';
  ctx._state.fields.upSubject.value = '';
  await p;
  eq('every paper of the batch takes the level that was chosen',
     ctx._state.calls.map(function (c) { return c.level; }), ['P4', 'P4']);
  ok('…and the dialog was shut before the first paper started',
     ctx._state.calls[0].modalClosed === true);
}

section('💥 A failure never sinks the batch');
{
  const ctx = makeCtx();
  ctx._state.fail = 'b.pdf';
  await ctx.handleUpload([f('a.pdf'), f('b.pdf'), f('c.pdf')]);
  eq('the papers after it still go up', names(ctx), ['a.pdf', 'b.pdf', 'c.pdf']);
  ok('the count is of what really landed', /2 worksheets uploaded/.test(lastToast(ctx)), lastToast(ctx));
  ok('…and the one that failed is NAMED', /Could not be read: b/.test(lastToast(ctx)), lastToast(ctx));
}

section('🚫 Anything that is not a PDF');
{
  const ctx = makeCtx();
  await ctx.handleUpload([f('a.pdf'), f('notes.png', 'image/png'), f('b.pdf')]);
  eq('the PDFs still go up', names(ctx), ['a.pdf', 'b.pdf']);
  ok('…and what was skipped is named', /Not PDFs, so skipped: notes\.png/.test(lastToast(ctx)), lastToast(ctx));
}
{
  const ctx = makeCtx();
  await ctx.handleUpload([f('notes.png', 'image/png')]);
  eq('a pile with no PDF in it uploads nothing', ctx._state.calls.length, 0);
  ok('…and says so', /not a PDF/i.test(lastToast(ctx)), lastToast(ctx));
  ok('…and the dialog is left OPEN so the choice can be made again',
     ctx._state.modalClosed === false);
}
{
  const ctx = makeCtx();
  await ctx.handleUpload([]);
  eq('nothing at all uploads nothing', ctx._state.calls.length, 0);
}

section('📏 The cap on one go');
{
  const ctx = makeCtx();
  const many = [];
  for (let i = 0; i < ctx.UPLOAD_MAX_FILES + 2; i++) many.push(f('p' + i + '.pdf'));
  await ctx.handleUpload(many);
  eq('only the cap goes up', ctx._state.calls.length, ctx.UPLOAD_MAX_FILES);
  ok('…and the ones left out are counted, never dropped in silence',
     /2 more were left out/.test(lastToast(ctx)), lastToast(ctx));
}

section('🏠 Where the upload ends');
{
  const ctx = makeCtx();
  await ctx.handleUpload([f('a.pdf'), f('b.pdf')]);
  eq('a batch ends on the shelf', ctx._state.views, ['home']);
  ok('…with the shelf reloaded first', ctx._state.listLoads >= 1);
}
{
  const ctx = makeCtx();
  await ctx.handleUpload([f('a.pdf')]);
  eq('a single upload is left exactly where uploadOne put it', ctx._state.views, []);
  ok('…and gets no batch summary over the top of it',
     !/worksheets uploaded/.test(ctx._state.toasts.join(' ')));
}

section('📌 What was set for the class');
{
  const ctx = makeCtx();
  ctx._state.pushAll = true;
  await ctx.handleUpload([f('a.pdf'), f('b.pdf')]);
  ok('the summary counts them', /2 set for the class/.test(lastToast(ctx)), lastToast(ctx));
}

/* ===================================================================== */
section('📚 What the source has to keep saying');

ok('the picker takes more than one PDF',
   /<input type="file" id="fileInput" accept="application\/pdf,\.pdf" multiple hidden>/.test(html),
   'without `multiple` the whole feature is one file at a time again');
ok('…and the change handler hands the WHOLE list to the one door',
   /\$\('fileInput'\)\.addEventListener\('change'[\s\S]{0,420}if \(list\.length\) handleUpload\(list\);/.test(html),
   'handing it files[0] drops every paper but the first, silently');
ok('the answer-key picker is still ONE file',
   /<input type="file" id="upKeyInput" accept="application\/pdf,\.pdf" hidden>/.test(html) &&
   /<input type="file" id="keyFileInput" accept="application\/pdf,\.pdf" hidden>/.test(html),
   'a marking scheme belongs to one worksheet');

ok('the name rule is read from ONE place',
   /var nm = uploadName\(file, s, solo\);\n\s*var name = nm\.name, nameTyped = nm\.typed;/.test(html),
   'computing `nameTyped` separately is how a file name ends up flagged as one somebody typed');
ok('handleUpload is the ONE door and it takes a LIST',
   /async function handleUpload\(files\) \{/.test(html));
ok('…and it is the only thing that calls uploadOne',
   (html.match(/uploadOne\(/g) || []).length === 2,
   'a second caller is a second pipeline, and the two drift');
ok('the papers are awaited ONE AT A TIME',
   /for \(var n = 0; n < pdfs\.length; n\+\+\) \{[\s\S]{0,700}await uploadOne\(pdfs\[n\], s, n === 0 \? s\.keyFile : null, solo\);/.test(html),
   'Promise.all here interleaves the module globals and each paper corrupts the other');
ok('the dialog is read and shut BEFORE the first await',
   /var s = uploadSettings\(\);\n\s*upKeyFile = null;\n\s*\$\('uploadModal'\)\.classList\.remove\('open'\);/.test(html));
ok('every paper is caught on its own',
   /try \{[\s\S]{0,420}\} catch \(e\) \{[\s\S]{0,200}failed\.push\(pdfBaseName\(pdfs\[n\]\)\);/.test(html),
   'one failure that escapes the loop loses every paper after it');
ok('a batch goes back to the shelf',
   /if \(solo\) return;[\s\S]{0,120}await loadWorksheets\(\);\n\s*showView\('home'\);/.test(html));
ok('…and a single upload returns before any of that',
   source.indexOf('if (solo) return;') < source.indexOf("showView('home');"),
   'scoped to the upload block: showView(\'home\') appears elsewhere in the file');

ok('every paper is OPENED, batch or not',
   /\/\/ EVERY paper is opened, batch or not[\s\S]{0,320}showView\('ws'\);\n\s*if \(solo\) \{/.test(html),
   'the read rasterises the pages, and a hidden view fits them to a width of nothing');
ok('the buddy and the "Ready" line are the single upload’s alone',
   /if \(solo\) \{\n\s*if \(window\.innerWidth > 900\) openBuddy\('hints'\); else closeBuddy\(\);/.test(html));

ok('the dialog says a pile is fine',
   /hold Ctrl \(⌘ on a Mac\) and pick as many as you like/.test(html));
ok('…and that a key goes on the first of them',
   /with several PDFs chosen it goes on the first of\n\s*them/.test(html));
ok('…and that the name box is for a single paper',
   /this box is only used for a single paper/.test(html));

console.log('\n' + (failures
  ? '✗ ' + failures + ' of ' + checks + ' checks failed'
  : '✓ all ' + checks + ' checks passed'));
process.exit(failures ? 1 : 0);
