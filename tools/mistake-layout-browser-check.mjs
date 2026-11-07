/* ↔ THE MISTAKE BOOK USES THE SCREEN (v1.87.0), in a real browser.
   A topic with ONE mistake used to be a 300px strip down the left of an
   iPad in landscape with the rest of the screen empty (`auto-fill` kept a
   track for every card that was not there). Now the grid is `auto-fit`, and
   a card that is wide enough puts its notes (what you wrote, Chung GPT says,
   the idea, the answer) BESIDE the question instead of under it.
   Every mistake is a fixture; nothing remote is reached.
   Run: PW=<playwright index.mjs> node tools/mistake-layout-browser-check.mjs
   SHOTS=<dir> also saves a screenshot of each screen size. */
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
const shots = process.env.SHOTS || '';
const errors = [];

/* One topic with a single mistake (the screenshot's case: "Whole Numbers ·
   1"), one with three, and a skipped one with no notes at all. */
function fixtures() {
  const opts = [{ label: '1', text: '3609' }, { label: '2', text: '3980' }, { label: '3', text: '3709' }, { label: '4', text: '3970' }];
  const base = { docName: 'Pei Chun 2023 Math', level: 'P4', subject: 'math', verdict: 'wrong', marks: '0/2' };
  return [
    { ...base, id: 'w1', key: 'w1', number: '2', type: 'mcq', topic: 'Whole Numbers: Numbers up to 10 000',
      question: 'Look at the number pattern below and find the missing number in the box.\n4309, 4109, 3909, ?, 3509, 3309',
      options: opts, option: '3', studentAnswer: '1', answer: '(3) 3709',
      feedback: 'Your choice, 3609, is 300 less than 3909, but this pattern decreases by 200 each time. Subtract 200 from 3909 and choose option 3.',
      explanation: 'Each number is 200 less than the one before it: 3909 − 200 = 3709.' },
    ...['5', '6', '7'].map(n => ({ ...base, id: 'f' + n, key: 'f' + n, number: n, type: 'open', topic: 'Fractions',
      question: 'Write 3/4 as a decimal. (' + n + ')', studentAnswer: '0.34', answer: '0.75',
      feedback: 'You wrote the digits of the fraction side by side. 3/4 means 3 ÷ 4.' })),
    { ...base, id: 's9', key: 's9', number: '9', type: 'open', topic: 'Decimals', question: 'Round 4.56 to 1 decimal place.',
      skipped: true, studentAnswer: '' }
  ];
}

async function open(viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(viewport.width + ': ' + e.message));
  await page.route('https://**/*', r => r.abort());
  await page.goto('http://127.0.0.1:' + server.address().port, { waitUntil: 'networkidle' });
  await page.evaluate(list => {
    try { localStorage.clear(); } catch (e) {}
    currentUser = { uid: 'layout-fixture', getIdToken: async () => 't' };
    myStudents = [{ name: 'Caius', level: 'P4', subject: 'math' }];
    _activeIdx = 0;
    mistakes = list;
    showView('mistake');
    renderMistList();
  }, fixtures());
  await page.waitForTimeout(120);
  return { ctx, page };
}

const measure = page => page.evaluate(() => {
  const main = document.querySelector('#mistakeView main').getBoundingClientRect();
  const cards = Array.from(document.querySelectorAll('#mistList .mistCard')).map(c => {
    const r = c.getBoundingClientRect();
    const side = c.querySelector('.mistSide'), notes = c.querySelector('.mistNotes');
    const sr = side && side.getBoundingClientRect(), nr = notes && notes.getBoundingClientRect();
    return {
      id: c.dataset.mid, w: Math.round(r.width), left: Math.round(r.left), top: Math.round(r.top),
      beside: !!(sr && nr && nr.left >= sr.right - 1 && Math.abs(nr.top - sr.top) < 2),
      stacked: !!(sr && nr && nr.top >= sr.bottom - 1),
      notes: !!notes,
      boxes: notes ? Array.from(notes.children).map(b => b.className.split(' ')[0]) : []
    };
  });
  return { mainW: Math.round(main.width), pageW: document.documentElement.scrollWidth, winW: innerWidth,
           cards, by: Object.fromEntries(cards.map(c => [c.id, c])) };
});

try {
  /* ① iPad in landscape — the screen in the report. */
  {
    const { ctx, page } = await open({ width: 1366, height: 1024 });
    const m = await measure(page);
    if (shots) await page.screenshot({ path: path.join(shots, 'ipad-landscape.png'), fullPage: true });
    const { w1: lone, f5: f1, f6: f2, f7: f3, s9: skip } = m.by;
    assert.equal(m.cards.length, 5);
    assert.ok(lone.w > m.mainW * 0.85, 'a lone card takes the row (' + lone.w + ' of ' + m.mainW + '), not a 300px strip');
    assert.ok(lone.beside, 'on a wide card the notes stand beside the question');
    assert.deepEqual(lone.boxes.slice(0, 2), ['youBox', 'whyBox'], 'What you wrote, then Chung GPT says, on the notes side');
    assert.ok(lone.boxes.includes('ansBox'), 'the answer is on the notes side');
    assert.equal(f1.top, f2.top, 'three cards of one topic share a row');
    assert.equal(f2.top, f3.top, 'three cards of one topic share a row');
    assert.ok(f1.left < f2.left && f2.left < f3.left, 'side by side, left to right');
    assert.ok(skip.notes, 'a skipped card still says how it got into the book');
    assert.ok(m.pageW <= m.winW, 'no sideways scroll');
    await ctx.close();
  }

  /* ② iPad in portrait: the three share a row or two; the lone card still wide. */
  {
    const { ctx, page } = await open({ width: 820, height: 1180 });
    const m = await measure(page);
    if (shots) await page.screenshot({ path: path.join(shots, 'ipad-portrait.png'), fullPage: true });
    assert.ok(m.by.w1.w > m.mainW * 0.85, 'lone card takes the row in portrait too');
    assert.ok(m.by.f5.top === m.by.f6.top, 'two to a row in portrait');
    assert.ok(m.pageW <= m.winW, 'no sideways scroll');
    await ctx.close();
  }

  /* ③ A phone: one full-width column, and every card stacks as it always did. */
  {
    const { ctx, page } = await open({ width: 390, height: 844 });
    const m = await measure(page);
    if (shots) await page.screenshot({ path: path.join(shots, 'phone.png'), fullPage: true });
    m.cards.forEach((c, i) => {
      assert.ok(c.w > m.mainW * 0.9, 'card ' + i + ' is the full column on a phone');
      if (c.notes) assert.ok(c.stacked, 'card ' + i + ' notes sit under the question on a phone');
    });
    assert.ok(m.pageW <= m.winW, 'no sideways scroll on a phone (' + m.pageW + ' > ' + m.winW + ')');
    await ctx.close();
  }

  assert.deepEqual(errors, [], 'no page errors');
  console.log('mistake-layout-browser-check: ok');
} finally {
  await browser.close();
  server.close();
}
