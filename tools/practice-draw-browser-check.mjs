/* ✏️ DRAW ON THE QUESTION and ✂️ THE QUESTION'S OWN BAND (v1.98.0), in a
   real browser.
   ① A mistake filed as the WHOLE page (Zhi Kai's "Match." question, with the
     end of Q9, the section line and the footer on it) is cut again by its
     printed number when ✏️ Practise reaches it: only Q10 is left.
   ② The pen is on screen above the picture (picked up already, because the
     question is a "Match."), lines drawn with a finger land on the picture,
     ✅ Check sends the picture WITH the ink to the marker, and afterwards the
     drawing stays, read-only, beside the answer.
   ③ An ordinary picture question gets the tools with ✋ Scroll picked.
   ④ It fits an iPad standing up and a phone, with no sideways scroll.
   The worksheet page is a fixture drawn on a canvas with its words handed
   to pdf.js's text API shape; nothing remote is reached.
   Run: PW=<playwright index.mjs> node tools/practice-draw-browser-check.mjs
   PD_SCREENSHOTS=<dir> saves screenshots (PD_SCALE=2 for sharp ones). */
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
const shots = process.env.PD_SCREENSHOTS || '';
const scale = Number(process.env.PD_SCALE) || 1;
const errors = [];

/* Runs IN the page: the fixture worksheet page, fake Storage and Firestore. */
function setup() {
  const W = 595, H = 842;
  /* What is printed, top to bottom: [text, x, top, size, bold]. */
  const TEXT = [
    ['Primary 3 Mathematics  Paper 2', 200, 24, 10, false],
    ['9.', 48, 330, 12, true], ['Wendy has 30 stickers. She gives 6 stickers to each of her friends.', 78, 330, 12, false],
    ['How many friends can she give stickers to?', 78, 350, 12, false],
    ['Wendy can give 6 stickers to', 150, 470, 12, true], ['friends.', 352, 470, 12, true],
    ['Questions 10 to 14 carry 2 marks each.', 70, 540, 12, true],
    ['10.', 70, 570, 12, true], ['Match.', 98, 570, 12, true],
    ['3 + 3 + 3', 384, 612, 12, true],
    ['3 x 10', 162, 640, 12, true],
    ['10 + 10 + 10', 376, 660, 12, true],
    ['7 + 7 + 7 + 7 + 7', 362, 708, 12, true],
    ['5 x 7', 166, 736, 12, true],
    ['5 + 5 + 5 + 5 + 5', 362, 756, 12, true],
    ['4', 293, 805, 10, false], ['www.sgexam.com', 450, 805, 9, false]
  ];
  /* The boxes: [x, top, w, h]. */
  const BOXES = [[290, 462, 70, 24], [140, 628, 80, 28], [140, 724, 80, 28],
                 [350, 600, 95, 26], [350, 648, 95, 26], [350, 696, 95, 26], [350, 744, 95, 26]];
  const DOTS = [[228, 642], [228, 738], [342, 613], [342, 661], [342, 709], [342, 757]];
  const fakePage = {
    getViewport: ({ scale: s }) => ({ width: W * s, height: H * s, scale: s, transform: [s, 0, 0, -s, 0, H * s] }),
    getTextContent: async () => ({
      items: TEXT.map(([str, x, top, size]) => ({ str, transform: [size, 0, 0, size, x, H - (top + size)], width: str.length * size * 0.5, height: size }))
    }),
    render: ({ canvasContext: ctx, viewport }) => ({
      promise: (async () => {
        ctx.save();
        ctx.scale(viewport.scale, viewport.scale);
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#111';
        TEXT.forEach(([str, x, top, size, bold]) => {
          ctx.font = (bold ? 'bold ' : '') + size + 'px Arial';
          ctx.fillText(str, x, top + size);
        });
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 1;
        BOXES.forEach(([x, y, w, h]) => ctx.strokeRect(x, y, w, h));
        DOTS.forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill(); });
        ctx.restore();
      })()
    })
  };
  window.__fakePage = fakePage;
  /* Storage: paths → data URLs, all in memory. */
  const files = {};
  window.__files = files;
  window.storage = {
    ref: p => ({
      putString: async d => { files[p] = d; },
      getDownloadURL: async () => { if (!files[p]) throw new Error('none'); return files[p]; },
      delete: async () => { delete files[p]; }
    })
  };
  const writes = [];
  window.__writes = writes;
  window.mistakesCollRef = () => ({ doc: id => ({ set: async (patch, o) => { writes.push({ id, patch, o }); }, update: async () => {} }) });
  window.mistakeMirrorSync = async () => null;
  window.usageNote = () => {};
  window.usageAdd = () => {};
  window.loadTeachingNotes = async () => null;
  /* The whole page as it was filed: tier ③. */
  return (async () => {
    const c = document.createElement('canvas');
    const s = 1600 / H;
    c.width = Math.round(W * s); c.height = Math.round(H * s);
    await fakePage.render({ canvasContext: c.getContext('2d'), viewport: fakePage.getViewport({ scale: s }) }).promise;
    files['tutor-mistakes/u/m1.jpg'] = c.toDataURL('image/jpeg', 0.86);
    /* A small figure for an ordinary picture question. */
    const f = document.createElement('canvas');
    f.width = 400; f.height = 220;
    const g = f.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, 400, 220);
    g.strokeStyle = '#111'; g.lineWidth = 3;
    g.strokeRect(40, 60, 320, 50);
    g.font = 'bold 20px Arial'; g.fillStyle = '#111';
    g.fillText('A bar of 320 cm', 120, 160);
    files['tutor-mistakes/u/m2.jpg'] = f.toDataURL('image/jpeg', 0.9);
  })();
}

function fixtures() {
  const base = { docName: 'P3 Maths Paper 2', level: 'P3', subject: 'math', verdict: 'wrong', marks: '0/2', type: 'open', topic: 'Multiplication' };
  return [
    { ...base, id: 'm1', key: 'm1', docId: 'ws1', page: 1, number: '10',
      question: 'Match. [The left column shows 3 × 10 and 5 × 7. The right column shows 3 + 3 + 3, 10 + 10 + 10, 7 + 7 + 7 + 7 + 7, and 5 + 5 + 5 + 5 + 5, with dots for drawing matching lines.]',
      answer: '3 × 10 → 10 + 10 + 10; 5 × 7 → 7 + 7 + 7 + 7 + 7', studentAnswer: '',
      imagePath: 'tutor-mistakes/u/m1.jpg', shot: 'page' },
    { ...base, id: 'm2', key: 'm2', docId: 'ws2', page: 2, number: '3', question: 'How long is the bar in metres?',
      answer: '3.2 m', studentAnswer: '32 m', imagePath: 'tutor-mistakes/u/m2.jpg', shot: 'question', cropV: 2 }
  ];
}

async function open(viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: scale, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(viewport.width + ': ' + e.message));
  await page.route('https://**/*', r => r.abort());
  await page.goto('http://127.0.0.1:' + server.address().port, { waitUntil: 'networkidle' });
  await page.evaluate(setup);
  await page.evaluate(list => {
    try { localStorage.clear(); } catch (e) {}
    currentUser = { uid: 'u', getIdToken: async () => 't' };
    myStudents = [{ name: 'Caius', level: 'P3', subject: 'math' }];
    _activeIdx = 0;
    mistakes = list;
    /* The worksheet the first mistake came from is the one open, so its
       page is cut from pdf.js's own words. */
    currentDocId = 'ws1';
    pages = [{ num: 1, page: window.__fakePage, baseW: 595, baseH: 842, renderTask: null }];
    /* The book's own quiet sweep is checked on its own below; here ✏️
       Practise is what reaches the old picture. */
    _qbSwept = QB_SWEEP_SESSION;
    showView('mistake');
    renderMistakes();
  }, fixtures());
  await page.waitForTimeout(150);
  return { ctx, page };
}

const state = page => page.evaluate(() => {
  const img = document.querySelector('#pracBody .pdWrap img');
  const bar = document.querySelector('#pracBody .pdBar');
  const card = document.querySelector('#pracModal .modalCard').getBoundingClientRect();
  const on = bar ? Array.from(bar.querySelectorAll('.pdTool.on')).map(b => b.dataset.tool) : [];
  return {
    count: document.getElementById('pracCount').textContent,
    bar: !!bar && getComputedStyle(bar).display !== 'none',
    barH: bar ? bar.getBoundingClientRect().height : 0,
    tool: on[0] || '',
    img: img ? { w: img.naturalWidth, h: img.naturalHeight, src: img.src.slice(0, 30), shown: img.getBoundingClientRect().width } : null,
    canvas: (() => { const c = document.querySelector('#pracBody .pdInk'); if (!c) return null; const r = c.getBoundingClientRect(); return { w: r.width, h: r.height, ta: c.style.touchAction }; })(),
    imgBox: img ? (() => { const r = img.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; })() : null,
    targets: bar ? Array.from(bar.querySelectorAll('.pdBtn')).map(b => { const r = b.getBoundingClientRect(); return { h: r.height, right: r.right }; }) : [],
    card: { left: card.left, right: card.right },
    pageW: document.documentElement.scrollWidth, winW: innerWidth,
    placeholder: (document.getElementById('pracAnswer') || {}).placeholder || '',
    label: (document.querySelector('#pracBody .boxLabel') || {}).textContent || '',
    ink: prac && prac.draw ? PracDraw.inkCount(prac.draw.inks) : 0,
    m1: (() => { const m = mistakeById('m1'); return { cropV: m.cropV, shot: m.shot, path: m.imagePath }; })()
  };
});

/* Draw a line across the picture from (fx0, fy0) to (fx1, fy1), as
   fractions of it, with the mouse (a finger draws the same way). */
async function drawLine(page, box, fx0, fy0, fx1, fy1) {
  await page.mouse.move(box.x + box.w * fx0, box.y + box.h * fy0);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) {
    const t = i / 12;
    await page.mouse.move(box.x + box.w * (fx0 + (fx1 - fx0) * t), box.y + box.h * (fy0 + (fy1 - fy0) * t));
  }
  await page.mouse.up();
}

try {
  /* ① + ② iPad standing up. */
  {
    const { ctx, page } = await open({ width: 820, height: 1180 });
    // The picture as it was filed: the whole page.
    const before = await page.evaluate(async () => {
      const m = mistakeById('m1');
      return { tier: mistakeTier(m), wants: qbWants(m) };
    });
    assert.deepEqual(before, { tier: 'page', wants: true }, 'a whole-page mistake wants cutting again');

    await page.evaluate(() => pracStart(['m1', 'm2'], { quick: { n: 2, subject: 'math' } }));
    await page.waitForFunction(() => mistakeById('m1').cropV === 2, null, { timeout: 8000 });
    await page.waitForTimeout(300);
    let s = await state(page);
    assert.equal(s.m1.shot, 'question', 'cut down to the question');
    assert.notEqual(s.m1.path, 'tutor-mistakes/u/m1.jpg', 'a new picture');
    const files = await page.evaluate(() => Object.keys(__files));
    assert.ok(!files.includes('tutor-mistakes/u/m1.jpg'), 'the whole page is deleted once the cut is saved');
    const w = await page.evaluate(() => __writes.find(x => x.id === 'm1'));
    assert.equal(w.patch.cropV, 2);
    assert.deepEqual(w.o, { merge: true });
    assert.ok(s.img, 'the question picture is on screen');
    /* The band runs from the "10." line (570/842 of the page) to above the
       footer (805/842): about 0.28 of the page's height, at the page's own
       width give or take the ink. The whole page is 1.41 times as tall as it
       is wide; Q10 alone is about a third of that. */
    const ratio = s.img.h / s.img.w;
    assert.ok(ratio < 0.75 && ratio > 0.25, 'only Q10 is left (height/width ' + ratio.toFixed(2) + ')');
    // What is in it: read the band's pixels — no Q9 box at the top.
    const top = await page.evaluate(async () => {
      const img = document.querySelector('#pracBody .pdWrap img');
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      // The first inked row: should be the "10. Match." line, near the top.
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let first = -1, last = -1;
      for (let y = 0; y < c.height; y++) {
        let n = 0;
        for (let x = 0; x < c.width; x++) { const i = (y * c.width + x) * 4; if (d[i] < 128) n++; }
        if (n > 2) { if (first < 0) first = y; last = y; }
      }
      return { first, last, h: c.height };
    });
    assert.ok(top.first >= 0 && top.first < top.h * 0.15, 'the question starts at the top of the picture');
    assert.ok(top.last > top.h * 0.8, 'and its last box is near the bottom');

    assert.equal(s.count, 'Question 1 of 2');
    assert.ok(s.bar, 'the drawing tools are on screen');
    assert.equal(s.tool, 'pen', 'a "Match." question picks the pen up');
    assert.equal(s.canvas.ta, 'none', 'with the pen a finger draws rather than scrolls');
    assert.ok(Math.abs(s.canvas.w - s.imgBox.w) < 1.5 && Math.abs(s.canvas.h - s.imgBox.h) < 1.5, 'the ink lies exactly over the picture');
    assert.match(s.label, /draw it on the picture/);
    s.targets.forEach(t => assert.ok(t.h >= 44, 'a finger-sized tool'));
    assert.ok(s.pageW <= s.winW, 'no sideways scroll');

    // Draw the two matching lines: 3 x 10 → 10 + 10 + 10, 5 x 7 → 7+7+7+7+7.
    await page.evaluate(() => document.querySelector('#pracBody .pdWrap').scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(80);
    s = await state(page);
    await drawLine(page, s.imgBox, 0.33, 0.31, 0.6, 0.38);
    await drawLine(page, s.imgBox, 0.33, 0.73, 0.6, 0.55);
    s = await state(page);
    assert.equal(s.ink, 2, 'two lines drawn');
    // The ink is drawn: the canvas has coloured pixels.
    const blue = await page.evaluate(() => {
      const c = document.querySelector('#pracBody .pdInk');
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200 && d[i + 2] > 150 && d[i] < 90) n++;
      return n;
    });
    assert.ok(blue > 200, 'blue ink on the picture');
    if (shots) await page.screenshot({ path: path.join(shots, 'practice-draw-ipad.png') });

    // ↶ Undo takes the last line off; the eraser rubs one out.
    await page.locator('#pracBody .pdUndo').click();
    assert.equal((await state(page)).ink, 1, 'undo');
    await drawLine(page, s.imgBox, 0.33, 0.73, 0.6, 0.55);
    assert.equal((await state(page)).ink, 2);

    // ✅ Check: the marker gets the picture with the ink on it.
    await page.evaluate(() => {
      window.aiReady = () => true;
      window.__asked = null;
      window.askGemini = async (prompt, opts) => {
        window.__asked = { prompt, n: (opts.images || []).length, img: (opts.images || [])[0] };
        return JSON.stringify({ verdict: 'correct', feedback: 'Both lines join the right sums.' });
      };
    });
    await page.locator('#pracFoot .btnPrimary', { hasText: 'Check my answer' }).click();
    await page.waitForFunction(() => prac && prac.revealed, null, { timeout: 5000 });
    const asked = await page.evaluate(() => window.__asked);
    assert.equal(asked.n, 1, 'one picture sent');
    assert.equal(asked.img.mimeType, 'image/jpeg');
    assert.ok(asked.img.data.length > 4000, 'with the question and the ink on it');
    assert.match(asked.prompt, /DREW their answer on the attached picture/);
    assert.match(asked.prompt, /nothing typed — their answer is DRAWN/);
    // The picture sent carries the printed question AND blue ink.
    const sent = await page.evaluate(async () => {
      const im = new Image();
      im.src = 'data:image/jpeg;base64,' + window.__asked.img.data;
      await im.decode();
      const c = document.createElement('canvas');
      c.width = im.width; c.height = im.height;
      const g = c.getContext('2d');
      g.drawImage(im, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let blue = 0, black = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 2] > 150 && d[i] < 90 && d[i + 1] < 140) blue++;
        if (d[i] < 70 && d[i + 1] < 70 && d[i + 2] < 70) black++;
      }
      return { blue, black };
    });
    assert.ok(sent.blue > 100 && sent.black > 100, 'printed question and ink both in the picture sent: ' + JSON.stringify(sent));
    s = await state(page);
    assert.ok(!s.bar, 'the tools go once it is marked');
    assert.equal(s.ink, 2, 'the drawing stays to compare');
    assert.equal(await page.locator('#pracBody .pracDrawnNote').count(), 1);
    assert.equal(await page.locator('#pracBody .verdict.mCorrect').count(), 1, 'marked from the drawing');
    if (shots) await page.screenshot({ path: path.join(shots, 'practice-draw-ipad-marked.png') });

    /* ③ The next question has an ordinary picture: tools, but ✋ Scroll. */
    await page.locator('#pracFoot .btnPrimary', { hasText: 'Next question' }).click();
    await page.waitForTimeout(250);
    s = await state(page);
    assert.equal(s.count, 'Question 2 of 2');
    assert.ok(s.bar, 'the tools are there for any picture');
    assert.equal(s.tool, 'scroll', 'a question not answered on the picture leaves a finger scrolling');
    assert.equal(s.ink, 0, 'a fresh page');
    assert.match(s.canvas.ta, /pan-y/);
    // A typed answer still works on its own, with no picture sent.
    await page.locator('#pracAnswer').fill('3.2 m');
    await page.locator('#pracFoot .btnPrimary', { hasText: 'Check my answer' }).click();
    await page.waitForFunction(() => prac && prac.revealed, null, { timeout: 5000 });
    assert.equal(await page.evaluate(() => window.__asked.n), 0, 'no picture when nothing was drawn');
    await ctx.close();
  }

  /* The book cuts a few old pictures by itself when it is opened. */
  {
    const { ctx, page } = await open({ width: 1180, height: 820 });
    await page.evaluate(() => { _qbSwept = 0; _qbTried = {}; renderMistakes(); });
    await page.waitForFunction(() => mistakeById('m1').cropV === 2, null, { timeout: 8000 });
    assert.equal(await page.evaluate(() => mistakeById('m1').shot), 'question', 'opening the book cut it');
    await ctx.close();
  }

  /* ④ A phone: the tools wrap inside the window, no sideways scroll. */
  {
    const { ctx, page } = await open({ width: 390, height: 844 });
    await page.evaluate(() => pracStart(['m1']));
    await page.waitForFunction(() => mistakeById('m1').cropV === 2, null, { timeout: 8000 });
    await page.waitForTimeout(300);
    const s = await state(page);
    assert.ok(s.bar);
    s.targets.forEach(t => assert.ok(t.right <= s.card.right + 0.5, 'every tool inside the window'));
    assert.ok(s.pageW <= s.winW, 'no sideways scroll on a phone');
    if (shots) await page.screenshot({ path: path.join(shots, 'practice-draw-phone.png') });
    await ctx.close();
  }

  assert.deepEqual(errors, [], 'no page errors');
  console.log('✓ practice drawing and question cut-outs checked');
} finally {
  await browser.close();
  server.close();
}
