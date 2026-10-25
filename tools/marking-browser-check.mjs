/* =====================================================================
   ⚡ THE MARKING RUN, IN A REAL BROWSER (v1.73.0)
   ---------------------------------------------------------------------
   `tools/tutor-tests.mjs` drives the run with fake pictures and a fake
   model, and pins what the source SAYS. Three things it cannot know:

   • whether a page rendered OFF SCREEN, through a real canvas, comes out
     as a real JPEG at the marking's own size with the student's ink on it
     — the whole of the iPad "page could not be read" fault was a canvas
     that came back empty;
   • whether every one of those canvases is really given back;
   • whether 📄 the page strip and the "could not be read" card are on the
     screen, in the right state, and can be pressed — on an iPad and on a
     phone, where the strip must wrap rather than run off the side.

   So this opens index.html in Chromium, builds a four-page worksheet the
   way `loadPdf` does (with a fake pdf.js page that really draws), writes
   on it, hands the app a fake model that cannot read page 3, presses
   ✅ Mark my work, and then ↻ Read page 3 again.

     PW=/path/to/playwright/index.mjs node tools/marking-browser-check.mjs
     MARK_SCREENSHOTS=dir  — also saves the pane at iPad and phone width
   ===================================================================== */
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const PW = process.env.PW || '/opt/node22/lib/node_modules/playwright/index.mjs';
let chromium;
try {
  ({ chromium } = await import(PW));
} catch (e) {
  console.log('marking-browser-check: no Playwright at ' + PW + ' — skipped.');
  console.log('  set PW=/path/to/playwright/index.mjs to run it.');
  process.exit(0);
}

const FILE = pathToFileURL(path.resolve(process.argv[2] || 'index.html')).href;
const SHOTS = process.env.MARK_SCREENSHOTS || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
const ok = (name, cond, note) => {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (note ? '\n      ' + note : '')); }
};

const browser = await chromium.launch({ ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });

async function openWorksheet(viewport) {
  const ctx = await browser.newContext({ viewport, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(FILE);
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    scheduleRaster = function () {};
    const container = document.getElementById('pagesContainer');
    container.innerHTML = '';
    pages = [];
    const W = 595, H = 842;
    for (let n = 1; n <= 4; n++) {
      const wrap = document.createElement('div');
      wrap.className = 'pageWrap';
      wrap.style.width = W + 'px';
      wrap.style.height = H + 'px';
      const canvas = document.createElement('canvas');
      const svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'none' });
      svg.classList.add('overlay');
      wrap.appendChild(canvas);
      wrap.appendChild(svg);
      container.appendChild(wrap);
      /* A pdf.js page that really DRAWS: printed questions, so the JPEG the
         model is handed is a page and not a blank. */
      const pdfPage = {
        getViewport: ({ scale }) => ({ width: W * scale, height: H * scale, scale }),
        render: ({ canvasContext, viewport }) => ({
          promise: new Promise(resolve => setTimeout(() => {
            const k = viewport.scale;
            canvasContext.fillStyle = '#111';
            canvasContext.font = Math.round(18 * k) + 'px serif';
            for (let q = 0; q < 6; q++) {
              canvasContext.fillText((n * 10 + q) + ') Combine the sentences using the word given.', 40 * k, (90 + q * 120) * k);
              canvasContext.fillRect(40 * k, (130 + q * 120) * k, 480 * k, 1.2 * k);
            }
            resolve();
          }, 5))
        })
      };
      const p = { num: n, baseW: W, baseH: H, wrap, canvas, svg, renderTask: null, page: pdfPage };
      pages.push(p);
      attachOverlayHandlers(p);
    }
    scale = 1.56; view = 'ws'; currentDocId = 'marking-browser-check';
    wsMeta.subject = 'english'; wsMeta.level = 'P3'; wsMeta.guidance = 'answer';
    showView('ws');
    // A student's answers, as ink: a pen line on every page.
    annotations = [1, 2, 3, 4].map(n => ({
      id: 'ink' + n, page: n, type: 'pen', color: '#0d47a1', width: 3,
      points: [{ x: 60, y: 140 }, { x: 200, y: 150 }, { x: 320, y: 145 }, { x: 460, y: 152 }]
    }));
    renderAllOverlays();
    // Nothing here is signed in or online: every door the run leans on is
    // answered, and the model is the fake below.
    loadTeachingNotes = async () => [];
    keyEnsureReady = async () => true;
    setDirty = function () {};
    window.aiReady = () => true;
    if (typeof StudyAdventure !== 'undefined') { StudyAdventure.marked = () => {}; }
    MARK_RETRY_WAIT_MS = 20;
    /* The canvases the marking draws on, so the check can ask whether every
       one of them was given back. */
    window.__markCanvases = [];
    const make = document.createElement.bind(document);
    document.createElement = function (tag) {
      const node = make(tag);
      if (String(tag).toLowerCase() === 'canvas') window.__markCanvases.push(node);
      return node;
    };
    window.__asks = [];
    window.__inFlight = 0;
    window.__most = 0;
    window.__unreadable = { 3: true };
    window.askGemini = async (prompt, opts) => {
      const num = Number((/picture is page (\d+)/.exec(prompt) || [])[1]);
      const data = (opts.images && opts.images[0] && opts.images[0].data) || '';
      window.__asks.push({ num, carry: /ended part-way/.test(prompt), lane: opts.lane, keep: opts.keepOnTimeout,
                           thinking: opts.thinkingLevel, bytes: data.length, jpeg: data.slice(0, 4), data });
      window.__inFlight++;
      window.__most = Math.max(window.__most, window.__inFlight);
      await new Promise(r => setTimeout(r, 120 + num * 30));
      window.__inFlight--;
      if (window.__unreadable[num]) throw new Error('route refused');
      return JSON.stringify({ questions: [
        { continuation: false, number: String(num * 10), page: 1, type: 'open',
          question: 'Combine the sentences on page ' + num + '.', answer: 'Since it was raining, we stayed at home.',
          explanation: 'Since gives the reason.', studentAnswer: 'it was raining, we decided to stay at home',
          verdict: num === 2 ? 'correct' : 'wrong', marks: num === 2 ? '1/1' : '0/1', at: [150, 700],
          feedback: 'Start with Since.', topic: 'Synthesis', lo: '', objective: 'Join two sentences.' },
        { continuation: false, number: String(num * 10 + 1), page: 1, type: 'open',
          question: 'A second question on page ' + num + '.', answer: 'b', explanation: 'b.', studentAnswer: '',
          verdict: '', marks: '0/1', at: [400, 700], feedback: '', topic: 'Synthesis', lo: '', objective: '' }
      ] });
    };
  });
  return { ctx, page, errors };
}

console.log('\n⚡ Every page at once, from the PDF');
const ipad = await openWorksheet({ width: 1180, height: 820 });
const page = ipad.page;
const startedAt = Date.now();
await page.evaluate(() => {
  openBuddy('marking');
  const btn = [...document.querySelectorAll('#buddyFoot button, .buddyFoot button, button')]
    .find(b => /Mark my work/.test(b.textContent));
  window.__clicked = !!btn;
  if (btn) btn.click(); else runMarking();
});
await page.waitForTimeout(250);
const mid = await page.evaluate(() => ({
  running: marking.running,
  chips: [...document.querySelectorAll('.markPage')].map(b => b.className.replace('markPage ', '')),
  progress: document.getElementById('markProgText').textContent
}));
ok('✅ Mark my work is the button that starts it', await page.evaluate(() => window.__clicked));
ok('while it runs, the strip shows every page and which are being read',
   mid.running && mid.chips.length === 4 && mid.chips.some(c => c === 'mp-reading'), JSON.stringify(mid));
ok('…and the progress says pages are read side by side', /3 at a time|of 4 pages marked/.test(mid.progress), mid.progress);

await page.waitForFunction(() => !marking.running && !_markFiling, null, { timeout: 30000 });
const tookMs = Date.now() - startedAt;
const done = await page.evaluate(async () => {
  const one = window.__asks.find(a => a.num === 1);
  const size = await new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve([img.naturalWidth, img.naturalHeight]);
    img.onerror = () => resolve([0, 0]);
    img.src = 'data:image/jpeg;base64,' + one.data;
  });
  // Is the student's blue ink really on the picture the model read?
  const blue = await new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      const k = img.naturalWidth / 595;
      const px = g.getImageData(Math.round(200 * k), Math.round(150 * k) - 3, 1, 7).data;
      let found = false;
      for (let i = 0; i < px.length; i += 4) if (px[i + 2] > 120 && px[i] < 90) found = true;
      c.width = 0; c.height = 0;
      resolve(found);
    };
    img.onerror = () => resolve(false);
    img.src = 'data:image/jpeg;base64,' + one.data;
  });
  return {
    asks: window.__asks.map(a => ({ num: a.num, lane: a.lane, keep: a.keep, thinking: a.thinking, bytes: a.bytes, jpeg: a.jpeg })),
    most: window.__most,
    size, blue,
    items: marking.items.map(it => it.number + '@' + it.page),
    unread: marking.unread.slice(),
    chips: [...document.querySelectorAll('.markPage')].map(b => ({ cls: b.className.replace('markPage ', ''), label: b.getAttribute('aria-label'), disabled: b.disabled })),
    card: (document.querySelector('.markUnread') || {}).textContent || '',
    cardBtn: (document.querySelector('.markUnread .btn') || {}).textContent || '',
    leaked: window.__markCanvases.filter(c => c.width > 0 && !pages.some(p => p.canvas === c)).length,
    made: window.__markCanvases.length
  };
});
const firstAsks = done.asks.filter(a => a.num !== 3);
ok('every page is asked for on its own, from a real JPEG', done.asks.every(a => a.jpeg === '/9j/' && a.bytes > 600),
   JSON.stringify(done.asks.map(a => a.jpeg + ':' + a.bytes)));
ok('…rendered at the marking\'s own size, whatever the zoom on screen', Math.max(...done.size) === 1600, JSON.stringify(done.size));
ok('…with the student\'s ink on it', done.blue === true);
ok('…at most three in the air at once', done.most >= 2 && done.most <= 3, 'most in flight: ' + done.most);
ok('…in the foreground lane, keeping the engine on a timeout', firstAsks.every(a => a.lane === 'fg' && a.keep === true));
ok('…and the page that would not come back was tried three times, the last at medium',
   done.asks.filter(a => a.num === 3).map(a => a.thinking).join() === 'high,high,medium',
   JSON.stringify(done.asks.filter(a => a.num === 3)));
ok('every canvas the marking drew on was given back', done.leaked === 0, done.leaked + ' of ' + done.made + ' still hold pixels');
ok('the paper comes back in paper order, without the page that could not be read',
   done.items.join() === '10@1,11@1,20@2,21@2,40@4,41@4', done.items.join());
ok('…and that page is named on the marking', done.unread.join() === '3');
ok('a card ABOVE the score says so, in words', /Page 3 could not be read yet/.test(done.card) && /not in your score/.test(done.card), done.card);
ok('…with ↻ on it', /Read page 3 again/.test(done.cardBtn), done.cardBtn);
ok('the strip shows three pages read and one that was not',
   done.chips.map(c => c.cls).join() === 'mp-done,mp-done,mp-unread,mp-done', JSON.stringify(done.chips));
ok('…every chip says what it is in words, not only in colour', done.chips.every(c => /^Page \d — /.test(c.label)));
ok('…and can be pressed now the run is over', done.chips.every(c => !c.disabled));
console.log('    a four-page paper took ' + tookMs + ' ms with a 0.15–0.25 s fake model and three tries at page 3');

if (SHOTS) {
  await page.screenshot({ path: path.join(SHOTS, 'ipad-unread.png') });
  await page.locator('.markPages').screenshot({ path: path.join(SHOTS, 'ipad-strip.png') });
}

console.log('\n↻ Read it again');
await page.evaluate(() => {
  window.__unreadable = {};
  window.__asks = [];
  document.querySelector('.markUnread .btn').click();
});
await page.waitForFunction(() => !marking.running && !_markFiling, null, { timeout: 30000 });
const again = await page.evaluate(() => ({
  asks: window.__asks.map(a => a.num),
  items: marking.items.map(it => it.number + '@' + it.page),
  unread: marking.unread.slice(),
  card: !!document.querySelector('.markUnread'),
  chips: [...document.querySelectorAll('.markPage')].map(b => b.className.replace('markPage ', ''))
}));
ok('↻ reads ONLY the page that could not be read', again.asks.join() === '3', again.asks.join());
ok('…and puts its questions back in their place in the paper',
   again.items.join() === '10@1,11@1,20@2,21@2,30@3,31@3,40@4,41@4', again.items.join());
ok('…and the card goes, because nothing is unread', again.unread.length === 0 && !again.card);
ok('…and every chip is ✓', again.chips.every(c => c === 'mp-done'), again.chips.join());

console.log('\n✅ Mark it again, with one answer changed');
await page.evaluate(() => {
  window.__asks = [];
  annotations.push({ id: 'fix2', page: 2, type: 'pen', color: '#0d47a1', width: 3, points: [{ x: 80, y: 400 }, { x: 300, y: 410 }] });
  renderAllOverlays();
  runMarking();
});
await page.waitForFunction(() => !marking.running && !_markFiling, null, { timeout: 30000 });
const remark = await page.evaluate(() => ({
  asks: window.__asks.map(a => a.num),
  chips: [...document.querySelectorAll('.markPage')].map(b => b.className.replace('markPage ', '')),
  items: marking.items.length
}));
ok('only the page that changed is read again', remark.asks.join() === '2', remark.asks.join());
ok('…the rest come straight back, marked ⏩ ahead', remark.chips.join() === 'mp-ahead,mp-done,mp-ahead,mp-ahead', remark.chips.join());
ok('…and the paper is whole', remark.items === 8);

console.log('\n📄 Tapping a page reads it afresh');
await page.evaluate(() => { window.__asks = []; document.querySelectorAll('.markPage')[3].click(); });
await page.waitForFunction(() => !marking.running && !_markFiling, null, { timeout: 30000 });
const tapped = await page.evaluate(() => window.__asks.map(a => a.num));
ok('tapping page 4 reads page 4, and only page 4', tapped.join() === '4', tapped.join());
ok('no error was thrown on the iPad', ipad.errors.length === 0, ipad.errors.join('\n      '));
await ipad.ctx.close();

console.log('\n📱 On a phone');
const phone = await openWorksheet({ width: 390, height: 844 });
await phone.page.evaluate(() => {
  pages.forEach(p => { p.wrap.style.width = '342px'; });
  openBuddy('marking');
  runMarking();
});
await phone.page.waitForFunction(() => !marking.running && !_markFiling, null, { timeout: 30000 });
const fit = await phone.page.evaluate(() => {
  const strip = document.querySelector('.markPagesRow');
  const card = document.querySelector('.markUnread');
  const chips = [...document.querySelectorAll('.markPage')].map(b => b.getBoundingClientRect());
  const pane = document.getElementById('pane-marking').getBoundingClientRect();
  return {
    stripFits: strip ? strip.scrollWidth <= strip.clientWidth + 1 : false,
    cardFits: card ? card.getBoundingClientRect().right <= window.innerWidth + 1 : false,
    chipsInside: chips.every(r => r.right <= pane.right + 1 && r.left >= pane.left - 1),
    tallEnough: chips.every(r => r.height >= 34),
    pageScroll: document.documentElement.scrollWidth <= window.innerWidth + 1
  };
});
ok('the strip wraps inside the pane rather than running off the side', fit.stripFits && fit.chipsInside, JSON.stringify(fit));
ok('…the could-not-be-read card fits the screen', fit.cardFits, JSON.stringify(fit));
ok('…the chips are big enough for a thumb', fit.tallEnough);
ok('…and nothing scrolls the page sideways', fit.pageScroll);
if (SHOTS) {
  await phone.page.screenshot({ path: path.join(SHOTS, 'phone-unread.png') });
  await phone.page.locator('.markPages').screenshot({ path: path.join(SHOTS, 'phone-strip.png') });
}
ok('no error was thrown on the phone', phone.errors.length === 0, phone.errors.join('\n      '));
await phone.ctx.close();

await browser.close();
console.log('\n' + (fail ? '✗ ' + fail + ' of ' + (pass + fail) + ' failed' : '✓ all ' + pass + ' passed'));
process.exit(fail ? 1 : 0);
