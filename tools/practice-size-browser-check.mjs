/* ↔ A BIGGER PRACTICE WINDOW and 🔍 BIGGER DIAGRAMS (v1.100.0), in a real browser.
   ① ✏️ Practise opens at its usual size; dragging the corner grip (a mouse, a
     finger, an Apple Pencil) makes it bigger, the corner stays under the
     pointer, and the size is remembered on the device as a share of the
     screen. ⤢ fills the screen and puts it back.
   ② 🔍 − 100% + sit with the drawing tools: a tap is one step, holding keeps
     going, the percentage puts it back. The picture grows, the ink canvas
     stays exactly over it, and a line drawn BEFORE the zoom is still on the
     same spot of the picture after it. The zoom is remembered.
   ③ A multiple-choice question (no pen) gets the −/+ in a bar of its own.
   ④ A phone: a zoomed picture scrolls sideways in its own strip, the page
     never does.
   Run: PW=<playwright index.mjs> node tools/practice-size-browser-check.mjs
   PS_SCREENSHOTS=<dir> saves screenshots (PS_SCALE=2 for sharp ones). */
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
const shots = process.env.PS_SCREENSHOTS || '';
const scale = Number(process.env.PS_SCALE) || 1;
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
      answer: '3.2 m', studentAnswer: '32 m', imagePath: 'tutor-mistakes/u/m2.jpg', shot: 'question', cropV: 2 },
    { ...base, id: 'm3', key: 'm3', docId: 'ws2', page: 2, number: '4', type: 'mcq', question: 'How long is the bar?',
      options: [{ label: '1', text: '32 cm' }, { label: '2', text: '320 cm' }, { label: '3', text: '3200 cm' }, { label: '4', text: '32 m' }], option: '2', answer: '2', studentAnswer: '1',
      blocks: [{ type: 'text', text: 'How long is the bar?' }, { type: 'image', path: 'tutor-mistakes/u/m2.jpg' }], cropV: 2 }
  ];
}

async function open(viewport, keep) {
  const ctx = keep || await browser.newContext({ viewport, deviceScaleFactor: scale, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(viewport.width + ': ' + e.message + ' ' + String(e.stack).split('\n').slice(1,3).join(' ')));
  await page.route('https://**/*', r => r.abort());
  await page.goto('http://127.0.0.1:' + server.address().port, { waitUntil: 'networkidle' });
  await page.evaluate(setup);
  await page.evaluate(([list, clear]) => {
    if (clear) { try { localStorage.clear(); } catch (e) {} }
    currentUser = { uid: 'u', getIdToken: async () => 't' };
    myStudents = [{ name: 'Caius', level: 'P3', subject: 'math' }];
    _activeIdx = 0;
    mistakes = list;
    currentDocId = 'ws1';
    pages = [{ num: 1, page: window.__fakePage, baseW: 595, baseH: 842, renderTask: null }];
    _qbSwept = QB_SWEEP_SESSION;
    showView('mistake');
    renderMistakes();
  }, [fixtures(), !keep]);
  await page.waitForTimeout(150);
  return { ctx, page };
}

const state = page => page.evaluate(() => {
  const card = document.querySelector('#pracModal .modalCard').getBoundingClientRect();
  const grip = document.getElementById('pracGrip').getBoundingClientRect();
  const img = document.querySelector('#pracBody img.pracShot, #pracBody img.pracFig');
  const wrap = img && img.parentNode.classList.contains('pdWrap') ? img.parentNode : null;
  const c = wrap && wrap.querySelector('.pdInk');
  const box = el => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
  const strip = img && img.closest('.pracPicScroll');
  const pct = document.querySelector('#pracBody .psPct');
  return {
    count: document.getElementById('pracCount').textContent,
    card: { x: card.left, y: card.top, w: card.width, h: card.height, right: card.right, bottom: card.bottom },
    grip: { x: grip.left + grip.width / 2, y: grip.top + grip.height / 2, w: grip.width, h: grip.height },
    img: box(img), canvas: box(c),
    canvasPx: c ? { w: c.width, h: c.height } : null,
    strip: strip ? { w: strip.clientWidth, sw: strip.scrollWidth } : null,
    pct: pct ? pct.textContent : '',
    inPdBar: !!document.querySelector('#pracBody .pdBar .psZoom'),
    inOwnBar: !!document.querySelector('#pracBody .psBar .psZoom'),
    zoomBtns: Array.from(document.querySelectorAll('#pracBody .psZoom .pdBtn')).map(b => b.getBoundingClientRect().height),
    pref: localStorage.getItem('polymath.tutorPracWin'),
    zoomPref: localStorage.getItem('polymath.tutorPracZoom'),
    max: document.getElementById('pracMax').getAttribute('aria-pressed'),
    pageW: document.documentElement.scrollWidth, winW: innerWidth, winH: innerHeight,
    ink: prac && prac.draw ? PracDraw.inkCount(prac.draw.inks) : 0
  };
});

/* How much blue ink the canvas holds around a point given as fractions of
   the picture — to see a stroke drawn before a zoom is still THERE after. */
const blueAt = (page, fx, fy) => page.evaluate(([fx, fy]) => {
  const c = document.querySelector('#pracBody .pdInk');
  const g = c.getContext('2d');
  const r = Math.max(4, Math.round(c.width * 0.02));
  const x = Math.round(fx * c.width), y = Math.round(fy * c.height);
  const d = g.getImageData(Math.max(0, x - r), Math.max(0, y - r), r * 2, r * 2).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 150 && d[i + 2] > 150 && d[i] < 90) n++;
  return n;
}, [fx, fy]);

async function drawLine(page, box, fx0, fy0, fx1, fy1) {
  await page.mouse.move(box.x + box.w * fx0, box.y + box.h * fy0);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) {
    const t = i / 12;
    await page.mouse.move(box.x + box.w * (fx0 + (fx1 - fx0) * t), box.y + box.h * (fy0 + (fy1 - fy0) * t));
  }
  await page.mouse.up();
}

/* A drag made of pointer events of one kind ('touch' or 'pen'), as a finger
   or an Apple Pencil sends them. */
const pointerDrag = (page, sel, kind, dx, dy) => page.evaluate(([sel, kind, dx, dy]) => {
  const el = document.querySelector(sel);
  const r = el.getBoundingClientRect();
  const x0 = r.left + r.width / 2, y0 = r.top + r.height / 2;
  const ev = (type, x, y) => el.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, pointerId: 7, pointerType: kind, isPrimary: true,
    clientX: x, clientY: y, pressure: type === 'pointerup' ? 0 : 0.5, button: 0, buttons: type === 'pointerup' ? 0 : 1
  }));
  ev('pointerdown', x0, y0);
  for (let i = 1; i <= 10; i++) ev('pointermove', x0 + dx * i / 10, y0 + dy * i / 10);
  ev('pointerup', x0 + dx, y0 + dy);
}, [sel, kind, dx, dy]);

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, msg + ' (' + a + ' vs ' + b + ')');

try {
  /* ① + ② a laptop / iPad lying down. */
  {
    const vp = { width: 1180, height: 820 };
    const { ctx, page } = await open(vp);
    await page.evaluate(() => pracStart(['m1', 'm2', 'm3'], { quick: { n: 3, subject: 'math' } }));
    await page.waitForFunction(() => mistakeById('m1').cropV === 2, null, { timeout: 8000 });
    await page.waitForTimeout(400);
    let s = await state(page);
    near(s.card.w, 520, 1, 'the usual size to begin with');
    assert.ok(s.grip.w >= 44 && s.grip.h >= 44, 'a finger-sized grip');
    near(s.grip.x, s.card.right - 22, 2, 'the grip is in the bottom-right corner');
    assert.equal(s.pct, '100%');
    assert.ok(s.inPdBar, '−/+ sit with the drawing tools');
    s.zoomBtns.forEach(h => assert.ok(h >= 44, 'finger-sized −/+'));
    if (shots) await page.screenshot({ path: path.join(shots, 'practice-size-before.png') });

    // Drag the corner out with the mouse: the corner follows the pointer.
    await page.mouse.move(s.grip.x, s.grip.y);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(s.grip.x + 15 * i, s.grip.y + 3 * i);
    await page.mouse.up();
    let t = await state(page);
    near(t.card.w, 520 + 300, 3, 'wider by twice what the corner moved');
    near(t.card.h, s.card.h + 60, 3, 'taller by twice what the corner moved');
    near(t.grip.x, s.grip.x + 150, 3, 'the corner stayed under the pointer');
    const pref = JSON.parse(t.pref);
    near(pref.fw, 820 / 1180, 0.01, 'remembered as a share of the screen');
    assert.ok(t.img.w > s.img.w + 200, 'the question picture fills the bigger window');
    near(t.canvas.w, t.img.w, 1.5, 'the ink canvas grew with it'); near(t.canvas.h, t.img.h, 1.5, '…both ways');

    // A line drawn now…
    await page.evaluate(() => document.querySelector('#pracBody .pdWrap').scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(80);
    t = await state(page);
    await drawLine(page, t.img, 0.33, 0.31, 0.6, 0.38);
    t = await state(page);
    assert.equal(t.ink, 1);
    const at0 = await blueAt(page, 0.465, 0.345);
    assert.ok(at0 > 10, 'ink in the middle of the line: ' + at0);
    assert.ok((await blueAt(page, 0.465, 0.8)) === 0, 'and none far from it');

    // …is still in the same place on the picture after + + +.
    const plus = page.locator('#pracBody .psBtn[data-zoom="in"]');
    for (let i = 0; i < 3; i++) await plus.click();
    await page.waitForTimeout(250);
    let z = await state(page);
    assert.equal(z.pct, '173%', 'three taps of + is three steps');
    near(z.img.w, t.img.w * 1.728, 3, 'the picture is that much bigger');
    near(z.canvas.w, z.img.w, 1.5, 'the ink canvas lies exactly over the bigger picture');
    near(z.canvas.h, z.img.h, 1.5, '…both ways');
    near(z.canvas.x, z.img.x, 1.5, '…at the same place'); near(z.canvas.y, z.img.y, 1.5, '…at the same place');
    assert.ok(z.canvasPx.w > t.canvasPx.w * 1.6, 'and is drawn at the new size, not stretched');
    assert.ok((await blueAt(page, 0.465, 0.345)) > 10, 'the line drawn before the zoom is on the same spot of the picture');
    assert.ok((await blueAt(page, 0.465, 0.8)) === 0, 'and nowhere else');
    assert.ok(z.strip.sw > z.strip.w, 'a picture wider than the window scrolls in its own strip');
    assert.ok(z.pageW <= z.winW, 'the page itself never scrolls sideways');
    assert.equal(z.zoomPref, '1.73', 'the zoom is remembered');
    // Draw again at this size: it lands where the pointer is.
    await page.evaluate(() => { const s = document.querySelector('#pracBody .pracPicScroll'); s.scrollLeft = 0; document.querySelector('#pracBody .pdWrap').scrollIntoView({ block: 'center' }); });
    await page.waitForTimeout(80);
    z = await state(page);
    const visW = Math.min(z.img.w, z.strip.w);
    await drawLine(page, { x: z.img.x, y: z.img.y, w: visW, h: z.img.h }, 0.2, 0.75, 0.5, 0.75);
    if (shots) await page.screenshot({ path: path.join(shots, 'practice-size-bigger.png') });
    // − back down: both lines still where they were drawn on the picture.
    const minus = page.locator('#pracBody .psBtn[data-zoom="out"]');
    for (let i = 0; i < 3; i++) await minus.click();
    await page.waitForTimeout(250);
    z = await state(page);
    assert.equal(z.pct, '100%');
    near(z.img.w, t.img.w, 2, 'back to the size it was');
    assert.ok((await blueAt(page, 0.465, 0.345)) > 10, 'the first line is still on its spot');
    const fx2 = (0.2 + 0.5) / 2 * visW / (t.img.w * 1.728);
    assert.ok((await blueAt(page, fx2, 0.75)) > 10, 'the line drawn while zoomed in is on its spot at 100% too');

    // Hold + : keeps going while held.
    const pb = await plus.boundingBox();
    await page.mouse.move(pb.x + pb.width / 2, pb.y + pb.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(1100);
    await page.mouse.up();
    z = await state(page);
    const held = parseInt(z.pct, 10);
    assert.ok(held >= 150, 'holding + keeps zooming: ' + z.pct);
    await page.waitForTimeout(200);
    assert.equal((await state(page)).pct, z.pct, 'letting go stops it');
    near(z.canvas.w, z.img.w, 1.5, 'ink canvas still over the picture after a hold');
    // The percentage puts it back.
    await page.locator('#pracBody .psPct').click();
    assert.equal((await state(page)).pct, '100%');
    await plus.click();
    assert.equal((await state(page)).pct, '120%');

    // ⤢ fills the screen and puts it back.
    await page.locator('#pracMax').click();
    z = await state(page);
    assert.equal(z.max, 'true');
    near(z.card.w, vp.width - 16, 1, 'fills the screen across');
    near(z.card.h, vp.height - 16, 1, '…and down');
    if (shots) await page.screenshot({ path: path.join(shots, 'practice-size-full.png') });
    await page.locator('#pracMax').click();
    z = await state(page);
    assert.equal(z.max, 'false');
    near(z.card.w, 820, 3, 'back to the size it was dragged to');

    // ③ The MCQ: −/+ in a bar of its own, and the next question keeps the zoom.
    await page.evaluate(() => { prac.i = 2; prac.draw = null; pracRender(); });
    await page.waitForTimeout(300);
    z = await state(page);
    assert.equal(z.count, 'Question 3 of 3');
    assert.ok(z.inOwnBar, 'an MCQ gets the −/+ in its own bar');
    assert.equal(z.pct, '120%', 'the zoom carries on to the next question');
    if (shots) await page.screenshot({ path: path.join(shots, 'practice-size-mcq.png') });

    // Closed and opened again: the size and the zoom come back.
    await page.evaluate(() => pracClose());
    await page.evaluate(() => pracStart(['m2']));
    await page.waitForTimeout(300);
    z = await state(page);
    near(z.card.w, 820, 3, 'the window opens at the size it was left');
    assert.equal(z.pct, '120%');
    // Double-tap the grip: the usual size again.
    await page.locator('#pracGrip').dblclick();
    z = await state(page);
    near(z.card.w, 520, 1, 'double-tap puts the usual size back');
    assert.equal(z.pref, null, 'and forgets the size');

    // A finger and an Apple Pencil drag it too.
    await pointerDrag(page, '#pracGrip', 'touch', 100, 40);
    z = await state(page);
    near(z.card.w, 720, 3, 'a finger drags the corner');
    await pointerDrag(page, '#pracGrip', 'pen', 60, 0);
    z = await state(page);
    near(z.card.w, 840, 3, 'an Apple Pencil drags the corner');
    // Arrow keys on the grip.
    await page.locator('#pracGrip').focus();
    await page.keyboard.press('ArrowLeft');
    near((await state(page)).card.w, 840 - 64, 3, 'an arrow key resizes');
    // Never past the screen, never too small to use.
    await pointerDrag(page, '#pracGrip', 'touch', 2000, 2000);
    z = await state(page);
    near(z.card.w, vp.width - 16, 1, 'clamped to the screen');
    await pointerDrag(page, '#pracGrip', 'touch', -3000, -3000);
    z = await state(page);
    near(z.card.w, 320, 1, 'never narrower than usable');
    near(z.card.h, 300, 1, 'never shorter than usable');
    await ctx.close();
  }

  /* iPad standing up, a size remembered as a share: turning to it keeps the share. */
  {
    const { ctx, page } = await open({ width: 820, height: 1180 });
    await page.evaluate(() => localStorage.setItem('polymath.tutorPracWin', JSON.stringify({ fw: 0.9, fh: 0.8 })));
    // The fixture's worksheet page has no on-screen wrap; the app's own resize redraw would trip on it.
    await page.evaluate(() => { pages = []; pracWin = null; pracStart(['m2']); });
    await page.waitForTimeout(300);
    let s = await state(page);
    near(s.card.w, 738, 2, '90% of an iPad standing up');
    near(s.card.h, 944, 2, '80% of its height');
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.waitForTimeout(200);
    s = await state(page);
    near(s.card.w, 1062, 2, 'turned round, still 90% across');
    near(s.card.h, 656, 2, '…and 80% down');
    if (shots) {
      await page.setViewportSize({ width: 820, height: 1180 });
      await page.evaluate(() => { pracZoomSet(1.5); });
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(shots, 'practice-size-ipad-portrait.png') });
    }
    await ctx.close();
  }

  /* ④ A phone. */
  {
    const { ctx, page } = await open({ width: 390, height: 844 });
    await page.evaluate(() => pracStart(['m1']));
    await page.waitForFunction(() => mistakeById('m1').cropV === 2, null, { timeout: 8000 });
    await page.waitForTimeout(300);
    let s = await state(page);
    assert.ok(s.grip.x + s.grip.w / 2 <= s.winW, 'the grip is on screen');
    for (let i = 0; i < 4; i++) await page.locator('#pracBody .psBtn[data-zoom="in"]').click();
    await page.waitForTimeout(250);
    s = await state(page);
    assert.equal(s.pct, '208%');
    assert.ok(s.strip.sw > s.strip.w, 'the zoomed picture scrolls in its strip');
    assert.ok(s.pageW <= s.winW, 'no sideways scroll on a phone');
    near(s.canvas.w, s.img.w, 1.5, 'the ink canvas still covers the picture');
    const tools = await page.evaluate(() => Array.from(document.querySelectorAll('#pracBody .pdBar .pdBtn')).map(b => b.getBoundingClientRect().right));
    tools.forEach(r => assert.ok(r <= s.card.right + 0.5, 'every tool inside the window'));
    if (shots) await page.screenshot({ path: path.join(shots, 'practice-size-phone.png') });
    await ctx.close();
  }

  assert.deepEqual(errors, [], 'no page errors');
  console.log('✓ practice window resize and picture zoom checked');
} finally {
  await browser.close();
  server.close();
}
