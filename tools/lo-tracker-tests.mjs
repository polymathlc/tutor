/* 🎯 THE LEARNING OBJECTIVE TRACKER (v1.97.0) — the pure model, and the
   wiring in index.html. Run: node --test tools/lo-tracker-tests.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const T = require('../lo-tracker.js');
const P = T.pure;
const src = readFileSync(join(here, '..', 'lo-tracker.js'), 'utf8');
const css = readFileSync(join(here, '..', 'lo-tracker.css'), 'utf8');
const html = readFileSync(join(here, '..', 'index.html'), 'utf8');

const item = (id, lo, extra = {}) => ({ id, lo, loTitle: 'title of ' + lo, loText: 'objective ' + lo, topic: 'Topic ' + lo.split('.')[1],
  topicKey: 'k ' + lo, order: null, level: 'P5', createdAt: 1, docName: 'Paper', cleared: false, ...extra });
const row = (lo, got, att, extra = {}) => ({ lo, sylTopic: 'k ' + lo, topic: 'Topic ' + lo.split('.')[1], objective: 'objective ' + lo,
  level: 'P5', order: 5, awarded: got, attempted: att, total: att, papers: 2, history: [], ...extra });

test('a card per objective, mistakes and marks together', () => {
  const cards = P.build(
    [item('a', 'P5.FR.2.6'), item('b', 'P5.FR.2.6', { cleared: true }), item('c', 'P5.RAT.1.7')],
    [row('P5.FR.2.6', 3, 10), row('P5.WN.2.2', 6, 6)]);
  assert.equal(cards.length, 3, 'two with mistakes and one with marks only');
  const fr = cards.find(c => c.lo === 'P5.FR.2.6');
  assert.deepEqual(fr.open, ['a']);
  assert.deepEqual(fr.sorted, ['b']);
  assert.equal(fr.pct, 30);
  assert.equal(fr.code, 'FR 2.6');
  assert.equal(fr.level, 'P5');
  assert.equal(fr.title, 'Objective P5.FR.2.6', 'the objective in words, first letter capital');
  const wn = cards.find(c => c.lo === 'P5.WN.2.2');
  assert.equal(wn.total, 0);
  assert.equal(wn.status, 'secure', 'full marks and nothing to redo is secure');
});

test('the status is decided in one place, by the same bands as 📈', () => {
  assert.equal(T.SECURE_PCT, 80);
  assert.equal(T.CLOSE_PCT, 50);
  assert.equal(P.statusOf({ pct: 49, open: [] }), 'work');
  assert.equal(P.statusOf({ pct: 50, open: ['x'] }), 'close');
  assert.equal(P.statusOf({ pct: 90, open: ['x'] }), 'close', 'a strong score with something left to redo is not finished');
  assert.equal(P.statusOf({ pct: 90, open: [] }), 'secure');
  assert.equal(P.statusOf({ pct: null, open: ['x'] }), 'redo', 'no marks yet, mistakes open');
  assert.equal(P.statusOf({ pct: null, open: [] }), 'secure');
});

test('a mistake with no objective is filed under its topic, and one with neither is gathered last', () => {
  const cards = P.build([
    { id: 't1', lo: '', topic: 'Heat', topicKey: 'Heat', cleared: false },
    { id: 'u1', lo: '', topic: '', topicKey: '', cleared: false }
  ], []);
  assert.equal(cards.length, 2);
  const heat = cards.find(c => c.key === 't:Heat');
  assert.equal(heat.title, 'Heat');
  const un = cards.find(c => c.key === '~unfiled');
  assert.match(un.title, /Not filed/);
  assert.equal(P.summary(cards).open, 2, 'the counts add up to the book');
});

test('the order: needs most work, most to redo, syllabus', () => {
  const cards = P.build(
    [item('a', 'P5.A.1.1'), item('b', 'P5.B.1.1'), item('c', 'P5.B.1.1'), item('d', 'P5.C.1.1'), item('e', 'P5.C.1.1'), item('f', 'P5.C.1.1')],
    [row('P5.A.1.1', 2, 10, { order: 3 }), row('P5.B.1.1', 7, 10, { order: 1 }), row('P5.C.1.1', 6, 10, { order: 2 }), row('P5.D.1.1', 10, 10, { order: 0 })]);
  assert.deepEqual(P.sortCards(cards, 'priority').map(c => c.lo), ['P5.A.1.1', 'P5.C.1.1', 'P5.B.1.1', 'P5.D.1.1']);
  assert.deepEqual(P.sortCards(cards, 'mistakes').map(c => c.lo), ['P5.C.1.1', 'P5.B.1.1', 'P5.A.1.1', 'P5.D.1.1']);
  assert.deepEqual(P.sortCards(cards, 'syllabus').map(c => c.lo), ['P5.D.1.1', 'P5.B.1.1', 'P5.C.1.1', 'P5.A.1.1']);
  assert.equal(P.nextUp(cards).lo, 'P5.A.1.1', 'the weakest with something to redo is next up');
  assert.deepEqual(P.filterCards(cards, 'secure').map(c => c.lo), ['P5.D.1.1']);
  assert.equal(P.filterCards(cards, 'focus').length, 3);
});

test('the hero numbers', () => {
  const cards = P.build([item('a', 'P5.A.1.1'), item('b', 'P5.A.1.1', { cleared: true }), item('c', 'P5.B.1.1', { cleared: true })],
    [row('P5.A.1.1', 3, 10), row('P5.B.1.1', 9, 10)]);
  const s = P.summary(cards);
  assert.equal(s.open, 1);
  assert.equal(s.sorted, 2);
  assert.equal(s.cleared, 67);
  assert.equal(s.pct, 60, 'marks got over marks attempted, across every objective');
  assert.equal(s.focus, 1);
  assert.equal(s.secure, 1);
  assert.equal(P.summary([]).pct, null, 'nothing marked is no mastery, never 0%');
});

test('the trend is paper by paper, oldest first, with how far it moved', () => {
  const t = P.trendOf([
    { at: 3, awarded: 4, attempted: 4, name: 'C' },
    { at: 1, awarded: 1, attempted: 4, name: 'A' },
    { at: 2, awarded: 0, attempted: 0, name: 'blank' },
    { at: 2, awarded: 2, attempted: 4, name: 'B' }
  ]);
  assert.deepEqual(t.points.map(p => p.name), ['A', 'B', 'C'], 'a paper where nothing was attempted is not a point');
  assert.equal(t.delta, 75);
  assert.equal(P.trendOf([]).delta, null);
  const many = P.trendOf(Array.from({ length: 12 }, (_, i) => ({ at: i, awarded: i, attempted: 12 })));
  assert.equal(many.points.length, 8, 'at most eight papers on a card');
  assert.equal(many.points[7].at, 11, '…the newest eight');
});

test('codes, sentences and the ring arithmetic', () => {
  assert.deepEqual(P.codeOf('P6.PCT.1.4'), { level: 'P6', code: 'PCT 1.4' });
  assert.deepEqual(P.codeOf('heat-gain', 'p5'), { level: 'P5', code: '' }, 'a science id prints no code');
  assert.equal(P.sentence('  finding  GST and cm³ '), 'Finding GST and cm³');
  const r = P.ringPath(50, 10);
  assert.ok(Math.abs(r.dash - r.c / 2) < 1e-9);
  assert.equal(P.ringPath(null, 10).dash, 0);
  assert.equal(P.ringPath(140, 10).dash, P.ringPath(100, 10).dash, 'clamped');
  const pts = P.sparkPoints([{ pct: 0 }, { pct: 100 }], 100, 30, 4);
  assert.deepEqual(pts, [[4, 26], [96, 4]]);
});

test('💰 the tracker never reaches a model, Firestore or the network', () => {
  assert.ok(!/askGemini|aiAsk|fetch\(|XMLHttpRequest|firestore|\.collection\(|localStorage/.test(src));
  assert.ok(!/innerHTML\s*=\s*[^'"]/.test(src.replace(/innerHTML = ''/g, '')), 'only ever emptied with innerHTML, never filled');
});

test('index.html loads it, versioned with the app, and wires every door', () => {
  const v = html.match(/var APP_VERSION = 'v([0-9.]+)';/)[1];
  assert.ok(html.includes('<script src="lo-tracker.js?v=' + v + '"></script>'));
  assert.ok(html.includes('<link rel="stylesheet" href="lo-tracker.css?v=' + v + '">'));
  assert.ok(/<div id="lotHost"><\/div>/.test(html), 'the host sits in the mistake book');
  assert.ok(/function renderMistakes\(\) \{\n  if \(!\$\('mistFilters'\)\) return;\n  renderLoTracker\(\);/.test(html), 'drawn every time the book is');
  const glue = html.slice(html.indexOf('function lotEnv()'), html.indexOf('function renderLoTracker()'));
  assert.ok(/pracStart\(ids, \{ title:/.test(glue), '▶ Practise is the book\'s own session');
  assert.ok(/lpOpen\(\[lotGroupOf\(c\)\]/.test(glue), '✨ fresh questions are lo-practice\'s window');
  assert.ok(/mwsExport\(ids, !!withKey\)/.test(glue), '🖨 is the book\'s own sheet');
  assert.ok(/qpOpen\(false\)/.test(glue), '⚡ is quick practice');
  assert.ok(/mistakeCard\(m\)/.test(glue), 'the mistakes are the book\'s own cards');
  assert.ok(/if \(lotReturn && lotReady\(\) && view === 'mistake'\) LoTracker\.openFocus\(lotReturn\);/.test(html),
    'closing a session started from an objective goes back to that objective');
  assert.ok(/tracker: \{ label: 'Practised a learning objective'/.test(html), 'the usage event has a name the panel can print');
  assert.ok(/id="progTracker"/.test(html) || /trk\.id = 'progTracker'/.test(html), '📈 My progress links to the tracker');
});

test('the stylesheet is scoped and fits a finger', () => {
  const sel = css.replace(/\/\*[\s\S]*?\*\//g, '').match(/(^|\})\s*([^{}@]+)\{/g) || [];
  sel.map(s => s.replace(/^\}?\s*/, '').replace(/\{$/, '').trim()).filter(Boolean).forEach(s => {
    if (/^(from|to|\d+%)$/.test(s)) return;
    s.split(',').forEach(part => {
      assert.ok(/\.lot|#mistakeView/.test(part), 'scoped selector: ' + part.trim());
    });
  });
  assert.match(css, /\.lot-btn \{[^}]*min-height: 44px/);
  assert.match(css, /\.lot-segBtn \{[^}]*min-height: 40px/);
  assert.match(css, /prefers-reduced-motion/);
});
