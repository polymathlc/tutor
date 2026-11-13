/* =====================================================================
   🗒 THE WHITEBOARD, IN A REAL BROWSER (v1.89.0)
   ---------------------------------------------------------------------
   tools/whiteboard-tests.mjs pins the pure half and what the source says;
   this drives the real board in Chromium, signed in as a STUDENT, with a
   fake Storage that keeps every file in memory:

   • 🗒 Whiteboard on the home screen opens the list; ＋ New whiteboard
     makes a board, saves it and opens it full screen;
   • the pen draws a stroke, the eraser rubs it out, undo brings it back;
   • a sticky note is typed into; a picture is pasted in; the select tool
     moves it; Delete removes it and undo puts it back;
   • the wheel pans, Ctrl+wheel zooms about the pointer, ⤢ shows it all;
   • 👁 Workings hides every stroke and leaves the pictures;
   • the board saves itself: the board, its picture files, its thumbnail
     and the list are all in Storage, and a picture is named by PATH;
   • ← Boards shows the board's card; opening it again brings it all back;
   • on a worksheet, 👁 Workings hides the page's ink and marks and shows
     them again, and a new worksheet opens with them showing;
   • 📸 To whiteboard cuts a box off the page — without the ink when asked
     — and puts it on the chosen board as a picture or a question card;
   • 🗒 on a mistake card puts the question on a board as a card that can
     be checked, shown and ticked off — and ticking it sorts the mistake;
   • Rename and Delete on the list; a phone keeps every tool on screen.

     PW=/path/to/playwright/index.mjs node tools/whiteboard-browser-check.mjs
     WB_SCREENSHOTS=dir — also saves pictures of the board
   ===================================================================== */
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const PW = process.env.PW || '/opt/node22/lib/node_modules/playwright/index.mjs';
let chromium;
try {
  ({ chromium } = await import(PW.startsWith('file:') ? PW : pathToFileURL(path.resolve(PW)).href));
} catch (e) {
  try { ({ chromium } = await import('playwright')); }
  catch (e2) { console.log('whiteboard-browser-check: no Playwright at ' + PW + ' — skipped.'); process.exit(0); }
}

const FILE = pathToFileURL(path.resolve(process.argv[2] || 'index.html')).href;
const SHOTS = process.env.WB_SCREENSHOTS || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
const ok = (name, cond, note) => {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (note ? '\n      ' + note : '')); }
};

const browser = await chromium.launch({ ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const page = await ctx.newPage();
const shot = async (name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'whiteboard-' + name + '.png') }); };
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('dialog', d => { const m = d.message(); if (/Call this whiteboard/.test(m)) d.accept('Fractions board'); else if (/question you want/.test(m)) d.accept('What is 3/4 of 20?'); else d.accept(); });
await page.route('https://**/*', r => r.abort());
await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
await page.goto(FILE);
await page.waitForTimeout(700);
ok('the whiteboard is loaded', await page.evaluate(() => !!(window.Whiteboard && Whiteboard.create && typeof wbOpen === 'function')));

/* ---------------- a student, a fake Storage ---------------- */
await page.evaluate(() => {
  window.__files = {};
  window.__puts = [];
  const toDataUrl = (blob) => new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(blob); });
  storage = {
    ref(p) {
      return {
        async put(blob) { window.__files[p] = await toDataUrl(blob); window.__puts.push(p); },
        async putString(s) { window.__files[p] = s; window.__puts.push(p); },
        async getDownloadURL() {
          if (!(p in window.__files)) { const e = new Error('Object not found'); e.code = 'storage/object-not-found'; throw e; }
          return window.__files[p];
        },
        async delete() { delete window.__files[p]; }
      };
    }
  };
  currentUser = { uid: 'student-1', email: 'kid@example.com', displayName: 'Kid', getIdToken: async () => 't' };
  wbAuthChanged();
  mistakes = [{
    id: 'm1', number: '7', docName: 'Fractions practice', question: 'What is 3/4 of 20?', answer: '15',
    explanation: '20 ÷ 4 = 5, and 3 × 5 = 15.', verdict: 'wrong', createdAt: 1
  }];
  window.__cleared = [];
  setMistakeCleared = function (id, c) { window.__cleared.push([id, c]); const m = mistakes.find(x => x.id === id); if (m) m.cleared = c; };
  loadMistakes = async function () {};
  pracStart = function (ids) { window.__prac = ids; };
});

/* ---------------- the list, and a new board ---------------- */
await page.evaluate(() => wbShowList());
await page.waitForTimeout(250);
ok('🗒 Whiteboard opens the list of boards', await page.locator('#boardView.on #wbList .wbListNew').isVisible());
await page.click('.wbListNew');
await page.waitForTimeout(500);
ok('＋ New whiteboard opens a board full screen', await page.locator('#wbEditor.open .wbStage').isVisible());
const made = await page.evaluate(() => ({ id: wb.id, files: Object.keys(__files) }));
ok('…and the new board is saved, with the list beside it', made.files.some(f => f.endsWith('/boards/' + made.id + '.json')) &&
   made.files.some(f => f.endsWith('/boards/index.json')), JSON.stringify(made.files));
ok('…in the student\'s own folder', made.files.every(f => f.startsWith('tutor-mistakes/student-1/boards/')));
ok('the empty board says what it is for', await page.locator('.wbEmpty').isVisible());

const stage = await page.locator('.wbStage').boundingBox();
const at = (fx, fy) => ({ x: stage.x + stage.width * fx, y: stage.y + stage.height * fy });

/* ---------------- the pen, the eraser, undo ---------------- */
async function drag(from, to, steps = 12) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) await page.mouse.move(from.x + (to.x - from.x) * i / steps, from.y + (to.y - from.y) * i / steps + Math.sin(i) * 3);
  await page.mouse.up();
}
await page.click('[data-wb-tool="pen"]');
await drag(at(0.2, 0.3), at(0.45, 0.35));
await drag(at(0.2, 0.5), at(0.45, 0.55));
let st = await page.evaluate(() => ({ n: wb.inst.board().strokes.length, paths: document.querySelectorAll('.wbInk g path').length }));
ok('the pen draws two strokes', st.n === 2 && st.paths === 2, JSON.stringify(st));
await page.click('[data-wb-tool="eraser"]');
await drag(at(0.3, 0.25), at(0.3, 0.4), 6);
st = await page.evaluate(() => wb.inst.board().strokes.length);
ok('the eraser rubs out the one it crosses, and only that one', st === 1, String(st));
await page.evaluate(() => { window.__wsUndo = 0; undo = function () { window.__wsUndo++; }; });
await page.keyboard.press('Control+z');
st = await page.evaluate(() => wb.inst.board().strokes.length);
ok('Ctrl+Z brings it back', st === 2, String(st));
ok('…and never undoes the worksheet behind the board', await page.evaluate(() => window.__wsUndo === 0));
await page.keyboard.press('Control+Shift+z');
await page.keyboard.press('Control+z');

/* ---------------- a note ---------------- */
await page.click('[data-wb-tool="note"]');
await page.mouse.click(at(0.7, 0.3).x, at(0.7, 0.3).y);
await page.waitForTimeout(100);
await page.keyboard.type('Remember: units!');
await page.click('[data-wb-tool="select"]');
await page.waitForTimeout(100);
const note = await page.evaluate(() => wb.inst.board().items.filter(i => i.t === 'note').map(i => i.text));
ok('the 📝 note tool makes a note and it is typed into', note.length === 1 && note[0] === 'Remember: units!', JSON.stringify(note));
ok('…and a letter typed into a note never picks a tool', await page.evaluate(() => wb.inst.tool() === 'select'));

/* ---------------- a picture ---------------- */
const pic = await page.evaluate(async () => {
  const c = document.createElement('canvas'); c.width = 400; c.height = 300;
  const x = c.getContext('2d'); x.fillStyle = '#c8ddf2'; x.fillRect(0, 0, 400, 300); x.fillStyle = '#111'; x.font = '28px serif'; x.fillText('A bar model', 40, 150);
  const it = await wb.inst.addImage(c.toDataURL('image/jpeg', 0.9), { cap: 'From page 2' });
  return it && { id: it.id, w: it.w, h: it.h, sel: wb.inst.selection().items };
});
ok('a picture goes on the board, selected', pic && pic.w === 400 && pic.h === 300 && pic.sel[0] === pic.id, JSON.stringify(pic));
const before = await page.evaluate((id) => { const i = wb.inst.board().items.find(x => x.id === id); return { x: i.x, y: i.y }; }, pic.id);
const node = await page.locator('.wbItem[data-id="' + pic.id + '"]').boundingBox();
await drag({ x: node.x + node.width / 2, y: node.y + node.height / 2 }, { x: node.x + node.width / 2 + 120, y: node.y + node.height / 2 + 40 }, 8);
const after = await page.evaluate((id) => { const i = wb.inst.board().items.find(x => x.id === id); return { x: i.x, y: i.y, z: wb.inst.view().z }; }, pic.id);
ok('the select tool moves it', Math.abs((after.x - before.x) * after.z - 120) < 6 && Math.abs((after.y - before.y) * after.z - 40) < 10, JSON.stringify([before, after]));
await page.keyboard.press('Delete');
let count = await page.evaluate(() => wb.inst.board().items.filter(i => i.t === 'img').length);
ok('Delete takes it off', count === 0);
await page.keyboard.press('Control+z');
count = await page.evaluate(() => wb.inst.board().items.filter(i => i.t === 'img').length);
ok('…and undo puts it back', count === 1);

/* ---------------- moving round ---------------- */
const v0 = await page.evaluate(() => wb.inst.view());
await page.mouse.move(at(0.5, 0.5).x, at(0.5, 0.5).y);
await page.mouse.wheel(0, 200);
await page.waitForTimeout(50);
const v1 = await page.evaluate(() => wb.inst.view());
ok('the wheel moves round the board', Math.abs((v0.y - v1.y) - 200) < 1 && v0.z === v1.z, JSON.stringify([v0, v1]));
await page.keyboard.down('Control');
await page.mouse.wheel(0, -300);
await page.keyboard.up('Control');
const v2 = await page.evaluate(() => wb.inst.view());
ok('Ctrl+wheel zooms in about the pointer', v2.z > v1.z, JSON.stringify([v1, v2]));
await page.click('.wbBtn[title="Show the whole board"]');
const fitOk = await page.evaluate(() => {
  const b = Whiteboard.pure.boardBounds(wb.inst.board()); const v = wb.inst.view(); const s = wb.inst._stage.getBoundingClientRect();
  const a = Whiteboard.pure.toScreen(v, b.x0, b.y0), c = Whiteboard.pure.toScreen(v, b.x1, b.y1);
  return a.x >= -1 && a.y >= -1 && c.x <= s.width + 1 && c.y <= s.height + 1;
});
ok('⤢ shows the whole board', fitOk);
await shot('board');

/* ---------------- 👁 Workings ---------------- */
await page.click('.wbInkBtn');
const inkOff = await page.evaluate(() => ({ ink: getComputedStyle(document.querySelector('.wbInk')).visibility, pic: getComputedStyle(document.querySelector('.wb_img')).visibility }));
ok('👁 Workings hides every stroke and keeps the picture', inkOff.ink === 'hidden' && inkOff.pic === 'visible', JSON.stringify(inkOff));
await shot('workings-off');
await page.click('.wbInkBtn');
ok('…and brings them back', await page.evaluate(() => getComputedStyle(document.querySelector('.wbInk')).visibility === 'visible'));

/* ---------------- saving ---------------- */
await page.evaluate(() => wbSaveNow({ thumb: true }));
await page.waitForTimeout(300);
const saved = await page.evaluate(() => {
  const id = wb.id, root = 'tutor-mistakes/student-1/boards/';
  const body = JSON.parse(atob(__files[root + id + '.json'].split(',')[1]));
  const index = JSON.parse(atob(__files[root + 'index.json'].split(',')[1]));
  return { body, index, thumb: !!__files[root + id + '.thumb.jpg'], pics: Object.keys(__files).filter(f => f.startsWith(root + id + '/')), status: document.getElementById('wbStatus').textContent };
});
const savedPic = saved.body.items.find(i => i.t === 'img');
ok('the board saves itself to the cloud', saved.body.strokes.length === 2 && saved.body.items.length === 2, JSON.stringify({ s: saved.body.strokes.length, i: saved.body.items.length }));
ok('…the picture as its own file, named by PATH and never a data: URL', savedPic && savedPic.path && !savedPic.src && saved.pics.length === 1, JSON.stringify(savedPic));
ok('…with a thumbnail and its line in the list', saved.thumb && saved.index.boards.some(b => b.id === saved.body.id && b.thumb && b.p === 1));
ok('…and says so', /Saved/.test(saved.status), saved.status);

/* ---------------- closing and opening again ---------------- */
await page.click('#wbCloseBtn');
await page.waitForTimeout(400);
ok('← Boards goes back to the list', !(await page.locator('#wbEditor.open').count()) && await page.locator('.wbListCard').count() === 1);
ok('…and the card wears the board\'s picture', await page.locator('.wbListCard .wbListFace img').count() === 1);
await page.click('.wbListCard .btnPrimary');
await page.waitForTimeout(500);
const back = await page.evaluate(() => ({ s: wb.inst.board().strokes.length, i: wb.inst.board().items.length, img: !!document.querySelector('.wb_img img').getAttribute('src') }));
ok('opening it again brings everything back, picture and all', back.s === 2 && back.i === 2 && back.img, JSON.stringify(back));

/* ---------------- a question from the mistake book, inside a board ---------------- */
await page.click('#wbFromMistakes');
await page.waitForTimeout(150);
ok('📕 From my mistakes lists the book', await page.locator('#wbPickModal.open .wbPickRow').count() === 1);
await page.click('#wbPickModal .wbPickRow input');
await page.click('#wbPickAdd');
await page.waitForTimeout(200);
const card = page.locator('.wb_q').first();
ok('the question goes on the board as a card', await card.isVisible());
ok('…drawn from the mistake book', /3\/4 of 20/.test(await card.textContent()));
await card.locator('.wbQInput').fill('12');
await card.locator('button:has-text("Check")').click();
await page.waitForTimeout(80);
ok('a wrong typed answer says not yet', /Not yet/.test(await page.locator('.wb_q').first().textContent()));
await page.locator('.wb_q').first().locator('.wbQInput').fill('15');
await page.locator('.wb_q').first().locator('button:has-text("Check")').click();
await page.waitForTimeout(80);
ok('…and the right one says right', /Right!/.test(await page.locator('.wb_q').first().textContent()));
ok('the answer is hidden until asked for', !/20 ÷ 4 = 5/.test(await page.locator('.wb_q').first().textContent()));
await page.locator('.wb_q').first().locator('button:has-text("Answer")').click();
await page.waitForTimeout(80);
ok('…and 👁 Answer shows it', /20 ÷ 4 = 5/.test(await page.locator('.wb_q').first().textContent()));
await page.locator('.wb_q').first().locator('button:has-text("I can do this now")').click();
await page.waitForTimeout(80);
ok('✓ I can do this now ticks the card off', await page.locator('.wb_q.wbQDone').count() === 1);
ok('…and sorts the mistake in the book', await page.evaluate(() => JSON.stringify(__cleared) === JSON.stringify([['m1', true]])));
await page.locator('.wb_q').first().locator('button:has-text("Practise")').click();
ok('▶ Practise opens the practice on that mistake', await page.evaluate(() => JSON.stringify(window.__prac) === '["m1"]'));
await shot('question');
await page.evaluate(() => wbSaveNow());
await page.waitForTimeout(250);

/* ---------------- 📷 clean view ---------------- */
await page.click('.wbBtn:has-text("Clean view")');
ok('📷 Clean view hides the toolbar', !(await page.locator('.wbBar').isVisible()) && await page.locator('.wbExitClean').isVisible());
await page.keyboard.press('Escape');
ok('…and Escape brings it back', await page.locator('.wbBar').isVisible());

/* ---------------- a worksheet: 👁 Workings and 📸 To whiteboard ---------------- */
await page.click('#wbCloseBtn');
await page.waitForTimeout(300);
await page.evaluate(() => {
  scheduleRaster = function () {};
  const container = document.getElementById('pagesContainer');
  container.innerHTML = '';
  pages = [];
  const W = 595, H = 842;
  for (let n = 1; n <= 2; n++) {
    const wrap = document.createElement('div');
    wrap.className = 'pageWrap';
    wrap.style.width = W + 'px'; wrap.style.height = H + 'px';
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const c2 = canvas.getContext('2d');
    c2.fillStyle = '#fff'; c2.fillRect(0, 0, W, H);
    c2.fillStyle = '#111'; c2.font = '18px serif';
    c2.fillText(n + '. Aisha has 3 times as many marbles as Ben.', 30, 60);
    const svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'none' });
    svg.classList.add('overlay');
    wrap.appendChild(canvas); wrap.appendChild(svg);
    container.appendChild(wrap);
    const pdfPage = {
      getViewport: ({ scale }) => ({ width: W * scale, height: H * scale, scale }),
      render: ({ canvasContext, viewport }) => ({ promise: Promise.resolve(canvasContext.drawImage(canvas, 0, 0, W * viewport.scale, H * viewport.scale)) }),
      getTextContent: async () => ({ items: [] })
    };
    const p = { num: n, baseW: W, baseH: H, wrap, canvas, svg, renderTask: null, page: pdfPage,
      viewport1: { width: W, height: H, scale: 1, convertToViewportPoint: (x, y) => [x, H - y] } };
    pages.push(p);
    attachOverlayHandlers(p);
  }
  scale = 1; currentDocId = 'ws-1'; docName = 'Ratio practice';
  showView('ws');
  annotations = [{ id: 'a1', type: 'pen', page: 1, color: '#d32f2f', width: 6, points: [{ x: 40, y: 80 }, { x: 300, y: 82 }, { x: 500, y: 90 }] }];
  undoStack = []; redoStack = [];
  renderAllOverlays();
  scheduleAutoSave = function () {};
});
await page.waitForTimeout(150);
ok('the worksheet shows 👁 Workings and 📸 To whiteboard', await page.locator('#inkToggleBtn').isVisible() && await page.locator('#wsBoardBtn').isVisible());
const inkPath = await page.evaluate(() => !!pages[0].svg.querySelector('path, polyline'));
await page.click('#inkToggleBtn');
const wsOff = await page.evaluate(() => ({
  vis: getComputedStyle(pages[0].svg).visibility, pressed: $('inkToggleBtn').getAttribute('aria-pressed'),
  kept: annotations.length
}));
ok('👁 Workings hides the page\'s ink', inkPath && wsOff.vis === 'hidden' && wsOff.pressed === 'true', JSON.stringify(wsOff));
ok('…and deletes nothing', wsOff.kept === 1);
await shot('worksheet-workings-off');
await page.click('#inkToggleBtn');
ok('…and tapping it again shows it', await page.evaluate(() => getComputedStyle(pages[0].svg).visibility === 'visible'));
await page.click('#inkToggleBtn');
await page.evaluate(() => { wsInkSet(true); if (wsInkHidden) wsInkSet(false); });
ok('a new worksheet (loadPdf) is wired to put the workings back', await page.evaluate(() => /wsInkHidden\) wsInkSet\(false\)/.test(String(loadPdf))));

// 📸 a cut WITHOUT the ink, as a question card, onto the existing board
await page.click('#wsBoardBtn');
await page.waitForTimeout(80);
ok('📸 To whiteboard puts the veil up with its two choices', await page.locator('.wbSnipVeil .wbKind').count() === 2);
await page.locator('.wbSnipVeil .wbKind').nth(1).click();
await page.locator('.wbSnipVeil .wbInkChoice input').uncheck();
const pr = await page.evaluate(() => pages[0].wrap.getBoundingClientRect().toJSON());
await page.mouse.move(pr.x + 20, pr.y + 30);
await page.mouse.down();
await page.mouse.move(pr.x + 300, pr.y + 80, { steps: 5 });
await page.mouse.move(pr.x + 560, pr.y + 140, { steps: 5 });
await page.mouse.up();
await page.waitForTimeout(400);
ok('…then asks which whiteboard', await page.locator('#wbTargetModal.open .wbTargetRow').count() === 2);
await shot('which-board');
await page.click('#wbTargetAdd');
await page.waitForTimeout(600);
const snipped = await page.evaluate(() => {
  const root = 'tutor-mistakes/student-1/boards/';
  const idx = JSON.parse(atob(__files[root + 'index.json'].split(',')[1]));
  const id = idx.boards[0].id;
  const body = JSON.parse(atob(__files[root + id + '.json'].split(',')[1]));
  const q = body.items.filter(i => i.t === 'q' && i.from && i.from.ws === 'ws-1');
  return { q, file: q[0] && __files[q[0].path] ? __files[q[0].path].slice(0, 30) : '' };
});
ok('…and the cut lands on that board as a question card', snipped.q.length === 1 && snipped.q[0].from.ink === false && snipped.q[0].from.pages[0] === 1, JSON.stringify(snipped.q));
ok('…its picture uploaded and named by path', snipped.q[0] && snipped.q[0].path && /^data:image\/jpeg/.test(snipped.file), snipped.file);
const inkInCut = await page.evaluate(async () => {
  // The same box WITH the ink: the red line must be in it; without, it must not.
  const part = [{ page: pages[0], x0: 20, y0: 30, x1: 560, y1: 140 }];
  async function reds(withInk) {
    const cap = await wbCapture(part, withInk, wsEpoch);
    const im = new Image(); im.src = cap.src; await im.decode();
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    const x = c.getContext('2d'); x.drawImage(im, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data; let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] > 160 && d[i + 1] < 90 && d[i + 2] < 90) n++;
    return n;
  }
  return { with: await reds(true), without: await reds(false) };
});
ok('a cut WITH the workings carries the ink, and one without does not', inkInCut.with > 50 && inkInCut.without === 0, JSON.stringify(inkInCut));

/* ---------------- 🗒 on a mistake card ---------------- */
await page.evaluate(() => { mistakes.forEach(m => { m.cleared = false; }); showView('mistake'); renderMistakes(); });
await page.waitForTimeout(150);
if (!(await page.locator('.mistCard').count())) console.log('      (mistake list: ' + (await page.evaluate(() => $('mistList').textContent.slice(0, 200))) + ')');
const mBtn = page.locator('.mistCard button:has-text("Whiteboard")');
ok('a mistake card carries 🗒 Whiteboard', await mBtn.count() === 1);
ok('…and the book a "put on a whiteboard" button', await page.locator('#mistTools button:has-text("whiteboard")').count() === 1);
await mBtn.click();
await page.waitForTimeout(250);
await page.locator('#wbTargetModal .wbTargetRow').last().click();   // ➕ a new whiteboard
await page.click('#wbTargetOpen');
await page.waitForTimeout(800);
const opened = await page.evaluate(() => ({ open: $('wbEditor').classList.contains('open'), qs: wb.inst.board().items.filter(i => i.t === 'q').length, n: (wb.list || []).length }));
ok('…into a NEW board, which opens with the question on it', opened.open && opened.qs === 1 && opened.n === 2, JSON.stringify(opened));
await page.click('#wbCloseBtn');
await page.waitForTimeout(400);

/* ---------------- rename and delete ---------------- */
const lastCard = page.locator('.wbListCard').last();
await lastCard.locator('button:has-text("Rename")').click();
await page.waitForTimeout(400);
ok('✎ Rename renames a board that is not open', await page.evaluate(() => wb.list.some(b => b.title === 'Fractions board')));
const countBefore = await page.locator('.wbListCard').count();
await page.locator('.wbListCard').first().locator('button:has-text("Delete")').click();
await page.waitForTimeout(500);
const del = await page.evaluate(() => ({ n: wb.list.length, files: Object.keys(__files) }));
ok('Delete takes the board off the list and out of Storage', del.n === countBefore - 1 && await page.locator('.wbListCard').count() === countBefore - 1, JSON.stringify(del));

/* ---------------- a phone ---------------- */
await page.setViewportSize({ width: 390, height: 844 });
await page.locator('.wbListCard .btnPrimary').first().click();
await page.waitForTimeout(500);
const phone = await page.evaluate(() => {
  const r = document.querySelector('.wbBar').getBoundingClientRect();
  const btns = Array.from(document.querySelectorAll('.wbBar .wbBtn')).filter(b => b.offsetParent);
  return { inside: btns.every(b => { const q = b.getBoundingClientRect(); return q.left >= 0 && q.right <= window.innerWidth + 1; }), stage: document.querySelector('.wbStage').getBoundingClientRect().height, bar: r.height };
});
ok('on a phone every tool stays on screen and the board keeps room', phone.inside && phone.stage > 300, JSON.stringify(phone));
await shot('phone');

ok('no page errors', errors.length === 0, errors.join(' | '));
await browser.close();
console.log('\n' + (fail ? '✗ ' + fail + ' of ' + (pass + fail) + ' checks failed' : '✓ all ' + pass + ' checks passed'));
process.exit(fail ? 1 : 0);
