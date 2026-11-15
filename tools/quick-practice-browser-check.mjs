/* ⚡ QUICK PRACTICE (v1.94.0), in a real browser.
   The window opens from the mistake book's bar, fits an iPad standing up,
   lying down and a phone with no sideways scroll, its buttons are big
   enough for a finger, a preset or their own number starts ✏️ Practise on
   that many questions, and the finish screen offers another round.
   Every mistake is a fixture; nothing remote is reached.
   Run: PW=<playwright index.mjs> node tools/quick-practice-browser-check.mjs
   QP_SCREENSHOTS=<dir> also saves a screenshot of each screen size. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const modulePath = process.env.PW || '/opt/node22/lib/node_modules/playwright/index.mjs';
const pw = await import(modulePath.startsWith('file:') ? modulePath : pathToFileURL(modulePath).href);
const chromium = pw.chromium || (pw.default && pw.default.chromium);
const browser = await chromium.launch({ ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
const server = createServer((req, res) => {
  const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
  if ((file !== root && !file.startsWith(root + path.sep)) || !fs.existsSync(file)) { res.writeHead(404).end(); return; }
  const target = fs.statSync(file).isDirectory() ? path.join(file, 'index.html') : file;
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
  res.setHeader('Content-Type', types[path.extname(target)] || 'application/octet-stream');
  res.end(fs.readFileSync(target));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const shots = process.env.QP_SCREENSHOTS || '';
const errors = [];

/* Twelve maths mistakes over three topics, two science ones, two sorted. */
function fixtures() {
  const base = { docName: 'Fixture paper', level: 'P5', verdict: 'wrong', marks: '0/2', type: 'open' };
  const out = [];
  ['Fractions', 'Decimals', 'Ratio'].forEach((topic, t) => {
    for (let i = 0; i < 4; i++) {
      const n = t * 4 + i + 1;
      out.push({ ...base, id: 'm' + n, key: 'm' + n, number: String(n), subject: 'math', topic,
                 question: topic + ' question ' + n + ': work it out.', studentAnswer: '1', answer: '2' });
    }
  });
  out.push({ ...base, id: 's1', key: 's1', number: '1', subject: 'science', topic: 'Heat', question: 'Why does ice melt?', answer: 'It gains heat.' });
  out.push({ ...base, id: 's2', key: 's2', number: '2', subject: 'science', topic: 'Light', question: 'What is a shadow?', answer: 'Light blocked.', cleared: true });
  out.push({ ...base, id: 'm13', key: 'm13', number: '13', subject: 'math', topic: 'Ratio', question: 'Ratio question 13.', answer: '3', cleared: true });
  return out;
}

async function open(viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(viewport.width + ': ' + e.message));
  await page.route('https://**/*', r => r.abort());
  await page.goto('http://127.0.0.1:' + server.address().port, { waitUntil: 'networkidle' });
  await page.evaluate(list => {
    try { localStorage.clear(); } catch (e) {}
    currentUser = { uid: 'qp-fixture', getIdToken: async () => 't' };
    myStudents = [{ name: 'Caius', level: 'P5', subject: 'both' }];
    _activeIdx = 0;
    mistakes = list;
    showView('mistake');
    renderMistakes();
  }, fixtures());
  await page.waitForTimeout(120);
  return { ctx, page };
}

const measure = page => page.evaluate(() => {
  const card = document.querySelector('#qpModal .modalCard').getBoundingClientRect();
  const targets = Array.from(document.querySelectorAll('#qpModal .qpChip, #qpModal #qpOwn, #qpFoot .btn'))
    .map(b => { const r = b.getBoundingClientRect(); return { t: b.textContent || b.id, h: Math.round(r.height), w: Math.round(r.width), right: r.right }; });
  return {
    open: document.getElementById('qpModal').classList.contains('open'),
    card: { left: card.left, right: card.right, top: card.top, bottom: card.bottom, w: card.width },
    targets,
    chips: Array.from(document.querySelectorAll('#qpModal .qpChip')).map(b => b.textContent),
    on: Array.from(document.querySelectorAll('#qpModal .qpChip.on')).map(b => b.textContent),
    go: document.getElementById('qpGo') && document.getElementById('qpGo').textContent,
    note: (document.querySelector('#qpModal .qpNote') || {}).textContent || '',
    pageW: document.documentElement.scrollWidth, winW: innerWidth, winH: innerHeight
  };
});

async function fits(page, label) {
  const m = await measure(page);
  assert.ok(m.open, label + ': the window is open');
  assert.ok(m.card.left >= 0 && m.card.right <= m.winW + 0.5, label + ': the window is inside the screen sideways');
  assert.ok(m.card.top >= 0 && m.card.bottom <= m.winH + 0.5, label + ': the window is inside the screen top to bottom');
  m.targets.forEach(t => {
    assert.ok(t.h >= 44, label + ': "' + t.t + '" is a finger-sized ' + t.h + 'px tall');
    assert.ok(t.right <= m.card.right + 0.5, label + ': "' + t.t + '" stays inside the window');
  });
  assert.ok(m.pageW <= m.winW, label + ': no sideways scroll');
  return m;
}

try {
  /* ① iPad standing up: open from the book, the presets, a preset starts. */
  {
    const { ctx, page } = await open({ width: 820, height: 1180 });
    assert.equal(await page.locator('#qpBookBtn').count(), 1, 'the book has ⚡ Quick practice');
    const first = await page.evaluate(() => document.querySelector('#mistTools .btn').id);
    assert.equal(first, 'qpBookBtn', '⚡ Quick practice is the first button in the book’s bar');
    await page.locator('#qpBookBtn').tap();
    await page.waitForTimeout(80);
    let m = await fits(page, 'iPad portrait');
    if (shots) await page.screenshot({ path: path.join(shots, 'qp-ipad-portrait.png') });
    assert.ok(m.chips.includes('All subjects'), 'a subject choice when the book holds two');
    assert.ok(m.chips.some(c => /^Mathematics/.test(c)) && m.chips.some(c => /^Science/.test(c)), 'both subjects named');
    assert.deepEqual(m.chips.filter(c => /^\d+$|^All \d+$/.test(c)), ['5', '10', '15'], 'presets up to the fifteen the book holds');
    assert.deepEqual(m.on, ['All subjects', '5'], 'five, from every subject, to begin with');
    assert.equal(m.go, '▶ Start 5 questions');

    await page.locator('#qpModal .qpChip', { hasText: /^10$/ }).tap();
    m = await measure(page);
    assert.equal(m.go, '▶ Start 10 questions');
    await page.locator('#qpGo').tap();
    await page.waitForTimeout(80);
    const s = await page.evaluate(() => ({
      prac: document.getElementById('pracModal').classList.contains('open'),
      qp: document.getElementById('qpModal').classList.contains('open'),
      title: document.getElementById('pracTitle').textContent,
      count: document.getElementById('pracCount').textContent,
      ids: prac && prac.ids.slice(),
      sorted: prac && prac.ids.filter(id => mistakeById(id).cleared).length
    }));
    assert.ok(s.prac && !s.qp, 'Start closes the window and opens ✏️ Practise');
    assert.equal(s.title, '⚡ Quick practice');
    assert.equal(s.count, 'Question 1 of 10');
    assert.equal(new Set(s.ids).size, 10, 'ten different questions');
    assert.equal(s.sorted, 0, 'nothing sorted while there are questions still to redo');

    // The finish screen offers another round of the same size.
    await page.evaluate(() => { prac.done = 10; prac.right = 4; pracRender(true); });
    assert.equal(await page.locator('#qpAgain').textContent(), '⚡ 10 more');
    await page.evaluate(() => { prac.ids.forEach(qpStamp); });
    const before = await page.evaluate(() => prac.ids.slice());
    await page.locator('#qpAgain').tap();
    await page.waitForTimeout(60);
    const after = await page.evaluate(() => prac.ids.slice());
    const fresh = await page.evaluate(b => mistakes.filter(m => !m.cleared && !b.includes(m.id)).map(m => m.id), before);
    assert.ok(fresh.every(id => after.includes(id)), 'another round takes every question still to redo that was not just done');
    assert.equal(after.length, 10);
    await page.evaluate(() => pracClose());
    await ctx.close();
  }

  /* ② iPad lying down: their own number, and a top-up from Sorted. */
  {
    const { ctx, page } = await open({ width: 1180, height: 820 });
    await page.evaluate(() => qpOpen(false));
    await page.waitForTimeout(60);
    await page.locator('#qpModal .qpChip', { hasText: /^Science/ }).tap();
    let m = await fits(page, 'iPad landscape');
    if (shots) await page.screenshot({ path: path.join(shots, 'qp-ipad-landscape.png') });
    assert.deepEqual(m.chips.filter(c => /^\d+$|^All \d+$/.test(c)), ['All 2'], 'science holds two, so the only choice is both');
    await page.locator('#qpOwn').fill('2');
    m = await measure(page);
    assert.equal(m.go, '▶ Start 2 questions');
    assert.match(m.note, /plus 1 you sorted before/, 'the window says a sorted one is coming back');
    await page.locator('#qpModal .qpChip', { hasText: 'All subjects' }).tap();
    await page.locator('#qpOwn').fill('12');
    m = await measure(page);
    assert.equal(m.go, '▶ Start 12 questions', 'their own number');
    assert.deepEqual(m.on, ['All subjects'], 'no preset lit while their own number is in');
    await page.locator('#qpOwn').press('Enter');
    await page.waitForTimeout(60);
    assert.equal(await page.locator('#pracCount').textContent(), 'Question 1 of 12', 'Enter starts it');
    const pref = await page.evaluate(() => JSON.parse(localStorage.getItem('polymath.tutorQuickPref')));
    assert.equal(pref.n, 12, 'the number is remembered for next time');
    await ctx.close();
  }

  /* ③ A phone, and an empty book. */
  {
    const { ctx, page } = await open({ width: 390, height: 844 });
    await page.evaluate(() => qpOpen(false));
    await page.waitForTimeout(60);
    await fits(page, 'phone');
    if (shots) await page.screenshot({ path: path.join(shots, 'qp-phone.png') });
    await page.evaluate(() => { qpClose(); mistakes = []; qpOpen(false); });
    await page.waitForTimeout(40);
    const t = await page.locator('#qpBody').textContent();
    assert.match(t, /mistake book is empty/, 'an empty book says so instead of offering nothing');
    await ctx.close();
  }

  assert.deepEqual(errors, [], 'no page errors');
  console.log('quick-practice-browser-check: ok');
} finally {
  await browser.close();
  server.close();
}
