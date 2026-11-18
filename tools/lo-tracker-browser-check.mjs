/* 🎯 THE LEARNING OBJECTIVE TRACKER (v1.97.0) and 📚 ITS TOPICS (v1.99.0), in a real browser.
   📚 The tracker opens on topics (Fractions, Ratio, Percentage…), each card
   carrying its objectives; a topic's sheet lists every objective under it,
   ▶ Practise all runs the whole topic in the book's own session, an
   objective opened from a topic offers ‹ back to it, and 🎯 switches to one
   card per objective (remembered on the device).
   On an iPad standing up and lying down, a laptop and a phone: the tracker
   heads the mistake book with no sideways scroll; every objective is a card
   with its score and ▶ Practise; tapping a card opens that objective's sheet
   inside the screen; ▶ Practise starts the book's own session named after
   the objective, and closing it comes back to the objective; the subject
   switch narrows the book underneath too; ✨ opens lo-practice's window;
   and every button is big enough for a finger.
   Every mistake and every marked paper is a fixture; nothing remote is reached.
   Run: PW=<playwright index.mjs> node tools/lo-tracker-browser-check.mjs
   LOT_SCREENSHOTS=<dir> also saves a screenshot of each screen. */
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
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png' };
  res.setHeader('Content-Type', types[path.extname(target)] || 'application/octet-stream');
  res.end(fs.readFileSync(target));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const shots = process.env.LOT_SCREENSHOTS || '';
const scale = Number(process.env.LOT_SCALE || 1);
const errors = [];

/* Runs IN the page: a P5 maths book over eleven objectives (some sorted),
   two science mistakes, and three marked maths papers carrying the
   objective marks, so every card has a score and a trend. */
function fixturesInPage() {
  const LO = {
    'P5.FR.2.6': ['Mrs Tan bought 3/4 kg of flour. She used 2/5 of it to bake a cake. How much flour was left?',
      'Ali spent 1/3 of his money on a book and 1/4 of the remainder on a pen. What fraction of his money was left?',
      'A ribbon 5 1/2 m long is cut into pieces of 3/4 m. How many whole pieces are there?'],
    'P5.FR.2.1': ['Find the value of 3 2/5 − 1 3/4.', 'Add 2 1/6 and 1 5/8.'],
    'P5.RAT.1.3': ['$540 is shared between Ben and Cal in the ratio 4 : 5. How much does Cal get?',
      'Divide 84 marbles in the ratio 2 : 3 : 2. How many are in the largest share?'],
    'P5.RAT.1.7': ['The ratio of boys to girls is 3 : 5. There are 24 more girls than boys. How many pupils are there altogether?',
      'Jo and Kim had stickers in the ratio 7 : 3. After Jo gave Kim 20 stickers, they had the same number. How many stickers did Jo have at first?',
      'The ratio of red to blue beads is 2 : 7. If 18 red beads are added, the ratio becomes 1 : 2. How many blue beads are there?'],
    'P5.PCT.1.5': ['A bag cost $80. During a sale it was sold at a 15% discount. What was the sale price?',
      'There were 600 people at a concert. 35% were children. How many adults were there?'],
    'P5.AV.1.3': ['The figure is made up of a rectangle and a triangle. Find the area of the shaded part.'],
    'P5.GEO.1.4': ['In the figure, AB is a straight line. Find ∠x.', 'Find the unknown angle y in the figure.'],
    'P5.DEC.1.3': ['A pen costs $1.35. Sam bought 6 pens and paid with a $10 note. How much change did he get?'],
    'P5.RS.1.3': ['A tap fills 12 ℓ of water in 3 minutes. How long does it take to fill a 50 ℓ tank?'],
    'P5.DA.1.2': ['The average of 4 numbers is 18. When a fifth number is added the average becomes 20. What is the fifth number?'],
    'P5.WN.2.4': ['A baker made 1250 buns and packed them in boxes of 8. How many boxes did he fill?']
  };
  const papers = ['P5 SA1 Nanyang 2024', 'P5 WA2 Rosyth 2024', 'P5 Fractions practice'];
  const now = Date.now();
  const out = [];
  let n = 0;
  Object.keys(LO).forEach((lo, li) => {
    const e = syllabusLo('math', lo);
    LO[lo].forEach((q, qi) => {
      n++;
      out.push({ id: 'm' + n, key: 'm' + n, number: String(4 + n), subject: 'math', level: 'P5', lo, sylTopic: e.tkey, topic: e.topic,
        docName: papers[n % 3], question: q, studentAnswer: ['7/20 kg', '$240', '48', '12'][n % 4], answer: ['9/20 kg', '$300', '64', '16'][n % 4],
        verdict: n % 5 === 0 ? 'partial' : 'wrong', marks: n % 5 === 0 ? '1/2' : '0/2', type: 'open',
        explanation: 'Work out the remainder first, then take the fraction of it.', createdAt: now - n * 25e6,
        cleared: (li === 1 && qi === 0) || (li === 6 && qi === 0) || lo === 'P5.WN.2.4' });
    });
  });
  const sci = syllabusEntries('science').filter(x => x.level === 'P5' || x.level === 'P6');
  [['Why does the ice cube melt faster on the metal tray than on the plastic tray?', 0],
   ['Explain why the shadow of the pole is shorter at noon.', 3]].forEach(([q, k], i) => {
    const e = sci[k] || sci[0];
    out.push({ id: 's' + i, key: 's' + i, number: String(30 + i), subject: 'science', level: 'P5', lo: e ? e.id : '', sylTopic: e ? e.tkey : '',
      topic: e ? e.topic : 'Heat', docName: 'P5 Science SA1', question: q, answer: 'Metal conducts heat better.', verdict: 'wrong',
      marks: '0/2', type: 'open', createdAt: now - i * 864e5 });
  });
  const score = { 'P5.FR.2.6': [5, 14], 'P5.FR.2.1': [6, 9], 'P5.RAT.1.3': [7, 12], 'P5.RAT.1.7': [3, 12], 'P5.PCT.1.5': [8, 12],
    'P5.AV.1.3': [5, 8], 'P5.GEO.1.4': [9, 12], 'P5.DEC.1.3': [7, 8], 'P5.RS.1.3': [4, 6], 'P5.DA.1.2': [5, 6], 'P5.WN.2.4': [11, 12],
    'P5.WN.2.2': [6, 6], 'P5.FR.1.2': [8, 8], 'P5.AV.2.4': [10, 12] };
  const sheets = papers.map((name, k) => ({ id: 'w' + k, name, subject: 'math', level: 'P5',
    diagnostic: { v: 1, subject: 'math', level: 'P5', at: now - (3 - k) * 5e8, rows: Object.keys(score).map(lo => {
      const e = syllabusLo('math', lo); const [g, t] = score[lo];
      const tot = Math.round(t / 3), got = Math.max(0, Math.min(tot, Math.round(g / 3 + (k - 1) * 0.6)));
      return { t: e.tkey, lo, q: 2, tot, got, att: tot, ok: 1, half: 0, no: 1, blank: 0, qs: '' };
    }) } }));
  return { mistakes: out, sheets };
}

async function open(viewport, name) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: scale, hasTouch: name !== 'laptop' });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(name + ': ' + e.message));
  await page.route('https://**/*', r => r.abort());
  await page.goto('http://127.0.0.1:' + server.address().port, { waitUntil: 'networkidle' });
  await page.evaluate('(' + fixturesInPage.toString() + ')').then(() => null);
  await page.evaluate(src => {
    try { localStorage.clear(); } catch (e) {}
    const d = (0, eval)('(' + src + ')')();
    currentUser = { uid: 'lot-fixture', getIdToken: async () => 't' };
    myStudents = [{ name: 'Caius', level: 'P5', subject: 'both' }];
    _activeIdx = 0;
    mistakes = d.mistakes;
    worksheets = d.sheets;
    window.loadMistakes = async () => { renderMistakes(); };
    showView('mistake');
    renderMistakes();
  }, fixturesInPage.toString());
  await page.waitForTimeout(150);
  return { ctx, page };
}

const measure = page => page.evaluate(() => {
  const box = n => { const r = n.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; };
  const host = document.getElementById('lotHost');
  const sheet = document.querySelector('#lotFocus.open .lot-sheet');
  return {
    winW: innerWidth, winH: innerHeight,
    pageW: document.getElementById('mistakeView').scrollWidth,
    viewW: document.getElementById('mistakeView').clientWidth,
    host: host && box(host),
    hero: !!document.querySelector('#lotHost .lot-hero'),
    title: (document.querySelector('.lot-heroTitle') || {}).textContent || '',
    kpis: Array.from(document.querySelectorAll('.lot-kpi')).map(k => k.querySelector('.lot-kpiNum').textContent + ' ' + k.querySelector('.lot-kpiLab').textContent),
    cards: Array.from(document.querySelectorAll('#lotHost .lot-card')).map(c => ({ key: c.dataset.lot, ...box(c), status: c.className })),
    targets: Array.from(document.querySelectorAll('#lotHost .lot-btn, #lotHost .lot-segBtn, #lotHost select, #lotHost .lot-loRowBtn, #lotFocus.open .lot-btn, #lotFocus.open .lot-close, #lotFocus.open .lot-back'))
      .filter(b => b.offsetParent).map(b => ({ t: (b.textContent || b.tagName).trim().slice(0, 30), h: Math.round(b.getBoundingClientRect().height) })),
    sheet: sheet && box(sheet),
    sheetTitle: sheet ? sheet.querySelector('.lot-sheetTitle').textContent : '',
    sheetLos: sheet ? sheet.querySelectorAll('.lot-loItem').length : 0,
    back: sheet && sheet.querySelector('.lot-back') ? sheet.querySelector('.lot-back').textContent : '',
    sheetCards: sheet ? sheet.querySelectorAll('.mistCard').length : 0,
    firstInBook: (() => { const a = host && host.nextElementSibling; return a ? a.id : ''; })()
  };
});

async function checkFits(page, label) {
  const m = await measure(page);
  assert.ok(m.hero, label + ': the tracker heads the mistake book');
  assert.ok(m.pageW <= m.viewW + 1, label + ': no sideways scroll (' + m.pageW + ' > ' + m.viewW + ')');
  assert.ok(m.cards.length > 0, label + ': objective cards drawn');
  m.cards.forEach(c => assert.ok(c.l >= 0 && c.r <= m.winW + 0.5, label + ': card ' + c.key + ' is inside the screen'));
  m.targets.forEach(t => assert.ok(t.h >= 36, label + ': "' + t.t + '" is ' + t.h + 'px tall, big enough for a finger'));
  return m;
}

async function shot(page, file) {
  if (shots) await page.screenshot({ path: path.join(shots, file) });
}

try {
  /* 📚 iPad standing up, TOPICS: the default view, a topic into its sheet, ▶ the whole topic and back,
     an objective under it and ‹ back, an objective straight off a topic card. */
  {
    const { ctx, page } = await open({ width: 820, height: 1180 }, 'ipad');
    let m = await checkFits(page, 'iPad portrait, topics');
    await shot(page, 'lot-topics-ipad-portrait.png');
    assert.equal(await page.evaluate(() => LoTracker.view()), 'topics', 'the tracker opens on topics');
    assert.equal(m.title, 'Caius’s progress by topic');
    assert.deepEqual(m.kpis, ['16 Still to redo', '3 Sorted', '8 Topics to work on', '1 Topics secure']);
    assert.equal(m.cards.length, 8, 'To work on: every topic but Whole Numbers');
    assert.equal(m.cards[0].key, 'g:ratio', 'the weakest topic comes first');
    assert.match(m.cards[0].status, /lot-card--topic.*lot-card--next/, '…marked ★ Start here');
    const fracRows = await page.locator('#lotHost .lot-card[data-lot="g:fractions"] .lot-loRowBtn').count();
    assert.equal(fracRows, 3, 'the Fractions card carries its three objectives');
    assert.match(await page.locator('#lotHost .lot-viewBar').textContent(), /Topics9.*Learning objectives14/,
      'the switch says nine topics hold fourteen objectives');

    // Open Fractions.
    await page.locator('#lotHost .lot-card[data-lot="g:fractions"] .lot-topicTitle').tap();
    await page.waitForTimeout(350);
    m = await measure(page);
    assert.ok(m.sheet, 'tapping a topic opens its sheet');
    assert.ok(m.sheet.l >= -0.5 && m.sheet.r <= m.winW + 0.5 && m.sheet.b <= m.winH + 0.5, 'the sheet is inside the screen');
    assert.equal(m.sheetTitle, 'Fractions');
    assert.equal(m.sheetLos, 3, 'the topic\'s sheet lists its objectives');
    assert.equal(m.sheetCards, 4, '…and the four mistakes still to redo across them');
    m.targets.forEach(t => assert.ok(t.h >= 36, 'topic sheet: "' + t.t + '" is finger-sized'));
    await shot(page, 'lot-topics-ipad-portrait-sheet.png');

    // ▶ Practise all → the whole topic in one session, weakest objective first.
    await page.locator('#lotFocus .lot-sheetActs .lot-btnPrimary').tap();
    await page.waitForTimeout(80);
    const s = await page.evaluate(() => ({
      prac: document.getElementById('pracModal').classList.contains('open'),
      title: document.getElementById('pracTitle').textContent,
      count: document.getElementById('pracCount').textContent,
      los: prac.ids.map(id => mistakeById(id).lo)
    }));
    assert.ok(s.prac, '▶ Practise all opens ✏️ Practise');
    assert.match(s.title, /^📚 Fractions/, 'the session is named after the topic');
    assert.equal(s.count, 'Question 1 of 4');
    assert.deepEqual(s.los, ['P5.FR.2.6', 'P5.FR.2.6', 'P5.FR.2.6', 'P5.FR.2.1'], 'every Fractions mistake, the weakest objective first');
    await page.evaluate(async () => { await setMistakeCleared(prac.ids[0], true).catch(() => {}); mistakeById(prac.ids[0]).cleared = true; pracClose(); });
    await page.waitForTimeout(350);
    let back = await page.evaluate(() => ({ open: LoTracker.isFocusOpen(), key: LoTracker.focusKey(),
      tabs: Array.from(document.querySelectorAll('#lotFocus .lot-segSm .lot-segN')).map(x => x.textContent) }));
    assert.ok(back.open && back.key === 'g:fractions', 'closing the session goes back to the topic');
    assert.deepEqual(back.tabs, ['3', '2'], '…where one has moved from To redo to Sorted');

    // An objective under the topic, and ‹ back.
    await page.locator('#lotFocus .lot-loItem').first().tap();
    await page.waitForTimeout(300);
    m = await measure(page);
    assert.match(m.sheetTitle, /word problems involving addition, subtraction and multiplication/i);
    assert.equal(m.back, '‹ Fractions', 'an objective opened from its topic offers the way back');
    await shot(page, 'lot-topics-ipad-portrait-objective.png');
    await page.locator('#lotFocus .lot-back').tap();
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => LoTracker.focusKey()), 'g:fractions', '‹ goes back to the topic');
    await page.keyboard.press('Escape');

    // A row on a topic card opens that objective, not the topic.
    await page.locator('#lotHost .lot-card[data-lot="g:ratio"] .lot-loRowBtn').first().tap();
    await page.waitForTimeout(300);
    m = await measure(page);
    assert.equal(await page.evaluate(() => LoTracker.focusKey()), 'lo:P5.RAT.1.7');
    assert.equal(m.back, '‹ Ratio');
    await page.keyboard.press('Escape');

    // 🎯 Learning objectives — remembered on the device.
    await page.locator('#lotHost .lot-segView .lot-segBtn[data-view="objectives"]').tap();
    await page.waitForTimeout(80);
    assert.equal(await page.evaluate(() => localStorage.getItem('polymath.tutorLotView')), 'objectives');
    await page.evaluate(() => { LoTracker.reset(); renderMistakes(); });
    assert.equal(await page.evaluate(() => LoTracker.view()), 'objectives', 'the choice comes back from the device');
    await ctx.close();
  }

  /* ① iPad standing up, OBJECTIVES: the hero, the cards, a card into its sheet, ▶ Practise and back. */
  {
    const { ctx, page } = await open({ width: 820, height: 1180 }, 'ipad');
    await page.locator('#lotHost .lot-segView .lot-segBtn[data-view="objectives"]').tap();
    await page.waitForTimeout(80);
    let m = await checkFits(page, 'iPad portrait');
    await shot(page, 'lot-ipad-portrait.png');
    assert.equal(m.title, 'Caius’s learning objectives');
    assert.deepEqual(m.kpis, ['16 Still to redo', '3 Sorted', '10 Objectives to work on', '4 Objectives secure'],
      'the four numbers: maths was picked, the subject with the most to redo');
    assert.equal(m.cards[0].key, 'lo:P5.RAT.1.7', 'the weakest objective comes first');
    assert.match(m.cards[0].status, /lot-card--next/, '…marked ★ Start here');
    assert.equal(await page.locator('#lotHost .lot-card').count(), 10, 'To work on shows the ten that are not secure');

    // The secure tab, and back.
    await page.locator('#lotHost .lot-segBtn', { hasText: 'Secure' }).tap();
    assert.equal(await page.locator('#lotHost .lot-card').count(), 4);
    await page.locator('#lotHost .lot-segBtn', { hasText: 'To work on' }).tap();

    // Syllabus order groups the cards under their topics.
    await page.locator('#lotHost .lot-sort select').selectOption('syllabus');
    assert.ok(await page.locator('#lotHost .lot-topicHead').count() >= 5, 'syllabus order is grouped by topic');
    await page.locator('#lotHost .lot-sort select').selectOption('priority');

    // Tap the card → its sheet.
    await page.locator('#lotHost .lot-card').first().tap();
    await page.waitForTimeout(350);
    m = await measure(page);
    assert.ok(m.sheet, 'tapping an objective opens its sheet');
    assert.ok(m.sheet.l >= -0.5 && m.sheet.r <= m.winW + 0.5 && m.sheet.b <= m.winH + 0.5, 'the sheet is inside the screen');
    assert.match(m.sheetTitle, /2-step word problems involving ratio/i);
    assert.equal(m.sheetCards, 3, 'the sheet shows the three mistakes still to redo, as the book draws them');
    m.targets.forEach(t => assert.ok(t.h >= 36, 'sheet: "' + t.t + '" is finger-sized'));
    await shot(page, 'lot-ipad-portrait-sheet.png');

    // ▶ Practise → the book's own session, titled with the objective.
    await page.locator('#lotFocus .lot-btnPrimary').first().tap();
    await page.waitForTimeout(80);
    const s = await page.evaluate(() => ({
      prac: document.getElementById('pracModal').classList.contains('open'),
      sheet: LoTracker.isFocusOpen(),
      title: document.getElementById('pracTitle').textContent,
      count: document.getElementById('pracCount').textContent,
      ids: prac && prac.ids.slice()
    }));
    assert.ok(s.prac && !s.sheet, '▶ Practise opens ✏️ Practise over the book and puts the sheet away');
    assert.match(s.title, /^🎯 /, 'the session is named after the objective');
    assert.equal(s.count, 'Question 1 of 3');
    // Get one right, close: back on the objective, with the bar moved.
    await page.evaluate(async () => { await setMistakeCleared(prac.ids[0], true).catch(() => {}); mistakeById(prac.ids[0]).cleared = true; pracClose(); });
    await page.waitForTimeout(350);
    const back = await page.evaluate(() => ({ open: LoTracker.isFocusOpen(), key: LoTracker.focusKey(),
      tabs: Array.from(document.querySelectorAll('#lotFocus .lot-segSm .lot-segN')).map(x => x.textContent) }));
    assert.ok(back.open && back.key === 'lo:P5.RAT.1.7', 'closing the session goes back to the objective');
    assert.deepEqual(back.tabs, ['2', '1'], '…where one has moved from To redo to Sorted');

    // Escape closes the sheet (the one .modalBack sweep).
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => LoTracker.isFocusOpen()), false, 'Escape closes the sheet');
    await ctx.close();
  }

  /* ② iPad lying down: the subject switch narrows the book too; ✨ opens lo-practice. */
  {
    const { ctx, page } = await open({ width: 1180, height: 820 }, 'ipadL');
    await checkFits(page, 'iPad landscape');
    await shot(page, 'lot-ipad-landscape.png');
    // 📚 ✨ on a topic opens lo-practice on every one of its objectives.
    await page.locator('#lotHost .lot-card[data-lot="g:fractions"] .lot-btnGhost').click();
    await page.waitForTimeout(150);
    const lp = await page.evaluate(() => ({ open: LoPractice.isOpen(), title: (document.querySelector('.lp-title, .lpTitle, [class*="lp"] h2') || {}).textContent || '' }));
    assert.ok(lp.open, '✨ on a topic opens lo-practice\'s window');
    await page.evaluate(() => LoPractice.close && LoPractice.close());
    await page.waitForTimeout(80);
    await page.locator('#lotHost .lot-segView .lot-segBtn[data-view="objectives"]').click();
    await page.waitForTimeout(80);
    const cols = await page.evaluate(() => {
      const tops = Array.from(document.querySelectorAll('#lotHost .lot-card')).slice(0, 3).map(c => Math.round(c.getBoundingClientRect().top));
      return tops.filter(t => t === tops[0]).length;
    });
    assert.ok(cols >= 3, 'three cards side by side on a landscape iPad');
    await page.locator('#lotHost .lot-segHero .lot-segBtn', { hasText: 'Science' }).tap();
    await page.waitForTimeout(80);
    const sci = await page.evaluate(() => ({ sub: mistSubject, eyebrow: document.querySelector('.lot-eyebrow').textContent,
      book: mistakesShown().every(m => m.subject === 'science') }));
    assert.equal(sci.sub, 'science', 'the subject switch is the book\'s subject too');
    assert.match(sci.eyebrow, /Science/);
    assert.ok(sci.book, '…so the list underneath shows science only');
    await page.locator('#lotHost .lot-segHero .lot-segBtn', { hasText: 'Mathematics' }).tap();
    await page.locator('#lotHost .lot-card').first().locator('.lot-btnGhost').tap();
    await page.waitForTimeout(150);
    assert.ok(await page.evaluate(() => LoPractice.isOpen()), '✨ New questions opens lo-practice\'s window');
    await ctx.close();
  }

  /* ③ A laptop: four numbers in a row, the sheet slides in from the side. */
  {
    const { ctx, page } = await open({ width: 1440, height: 900 }, 'laptop');
    await checkFits(page, 'laptop, topics');
    await shot(page, 'lot-topics-laptop.png');
    await page.locator('#lotHost .lot-card[data-lot="g:ratio"] .lot-topicTitle').click();
    await page.waitForTimeout(350);
    const tm = await measure(page);
    assert.ok(tm.sheet && Math.round(tm.sheet.r) === tm.winW && tm.sheet.w <= 760.5, 'a topic\'s side sheet on the right');
    assert.equal(tm.sheetLos, 2);
    await shot(page, 'lot-topics-laptop-sheet.png');
    await page.keyboard.press('Escape');
    await page.locator('#lotHost .lot-segView .lot-segBtn[data-view="objectives"]').click();
    await page.waitForTimeout(80);
    await checkFits(page, 'laptop');
    await shot(page, 'lot-laptop.png');
    const kpiRow = await page.evaluate(() => new Set(Array.from(document.querySelectorAll('.lot-kpi')).map(k => Math.round(k.getBoundingClientRect().top))).size);
    assert.equal(kpiRow, 1, 'the four numbers sit in one row');
    await page.locator('#lotHost .lot-card').nth(1).click();
    await page.waitForTimeout(350);
    const m = await measure(page);
    assert.ok(m.sheet && Math.round(m.sheet.r) === m.winW && m.sheet.w <= 760.5, 'a side sheet on the right, at most 760px');
    await shot(page, 'lot-laptop-sheet.png');
    await ctx.close();
  }

  /* ④ A phone: everything stacks, the sheet rises from the bottom; an empty book says so. */
  {
    const { ctx, page } = await open({ width: 390, height: 844 }, 'phone');
    await checkFits(page, 'phone, topics');
    await shot(page, 'lot-topics-phone.png');
    await page.locator('#lotHost .lot-card[data-lot="g:fractions"] .lot-topicTitle').tap();
    await page.waitForTimeout(350);
    const pm = await measure(page);
    assert.ok(pm.sheet && pm.sheet.w <= 390.5 && Math.round(pm.sheet.b) === 844, 'a topic\'s bottom sheet on a phone');
    await shot(page, 'lot-topics-phone-sheet.png');
    await page.keyboard.press('Escape');
    await page.locator('#lotHost .lot-segView .lot-segBtn[data-view="objectives"]').tap();
    await page.waitForTimeout(80);
    await checkFits(page, 'phone');
    await shot(page, 'lot-phone.png');
    await page.locator('#lotHost .lot-card').first().tap();
    await page.waitForTimeout(350);
    const m = await measure(page);
    assert.ok(m.sheet && m.sheet.w <= 390.5 && Math.round(m.sheet.b) === 844, 'a bottom sheet on a phone');
    await shot(page, 'lot-phone-sheet.png');
    await page.evaluate(() => { LoTracker.closeFocus(); mistakes = []; worksheets = []; renderMistakes(); });
    const t = await page.locator('#lotHost').textContent();
    assert.match(t, /Nothing to track yet/, 'an empty book says what will appear');
    await ctx.close();
  }

  assert.deepEqual(errors, [], 'no page errors');
  console.log('lo-tracker-browser-check: ok');
} finally {
  await browser.close();
  server.close();
}
