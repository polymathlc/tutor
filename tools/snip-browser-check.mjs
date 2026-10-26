/* =====================================================================
   ✂️ ASK ABOUT A PART OF THE PAGE, IN A REAL BROWSER (v1.74.0)
   ---------------------------------------------------------------------
   Opens index.html in Chromium with a two-page worksheet built the way
   `loadPdf` builds one (a fake pdf.js page that really draws and has a
   text layer), then drags boxes over it with a real pointer:

   • ✂️ Ask about this puts a veil over the screen; a tap is not a box,
     Escape ends it and leaves nothing behind;
   • a box over Q2 on page 1 cuts exactly that part — the printed words
     inside it come from the text layer, the words outside do not, and the
     student's blue ink is on the picture;
   • the chip waits beside the 💬 Ask box, ➤ with nothing typed still asks,
     and the model gets the cut FIRST with the prompt naming it;
   • a box over a page break reads both pages; a box over the panel or the
     toolbar finds no worksheet and says so;
   • the saved chat keeps the words and drops the picture, and every canvas
     made for the cut is given back (the iOS budget rule);
   • on a phone the panel steps aside while the box is drawn.

     PW=/path/to/playwright/index.mjs node tools/snip-browser-check.mjs
     SNIP_SCREENSHOTS=dir — also saves the veil and the chip
   ===================================================================== */
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const PW = process.env.PW || '/opt/node22/lib/node_modules/playwright/index.mjs';
let chromium;
try {
  // A relative PW (CI passes ./node_modules/…) is the repo's, not this file's.
  ({ chromium } = await import(PW.startsWith('file:') ? PW : pathToFileURL(path.resolve(PW)).href));
} catch (e) {
  console.log('snip-browser-check: no Playwright at ' + PW + ' — skipped.');
  process.exit(0);
}

const FILE = pathToFileURL(path.resolve(process.argv[2] || 'index.html')).href;
const SHOTS = process.env.SNIP_SCREENSHOTS || '';
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
    // Each printed question: its words and where they sit, in page units.
    const lines = n => [0, 1, 2, 3, 4].map(q => ({
      text: 'Q' + (q + 1) + ' on page ' + n + ': what is ' + (n * 10 + q) + ' + ' + (q + 3) + '?',
      x: 40, y: 90 + q * 150
    }));
    for (let n = 1; n <= 2; n++) {
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
      const printed = lines(n);
      const pdfPage = {
        getViewport: ({ scale }) => ({ width: W * scale, height: H * scale, scale }),
        render: ({ canvasContext, viewport }) => ({
          promise: new Promise(resolve => setTimeout(() => {
            const k = viewport.scale;
            canvasContext.fillStyle = '#fff';
            canvasContext.fillRect(0, 0, W * k, H * k);
            canvasContext.fillStyle = '#111';
            canvasContext.font = Math.round(16 * k) + 'px serif';
            printed.forEach(l => canvasContext.fillText(l.text, l.x * k, l.y * k));
            resolve();
          }, 5))
        }),
        // pdf.js's text layer: PDF space, y up from the bottom.
        getTextContent: async () => ({ items: printed.map(l => ({
          str: l.text, width: l.text.length * 7, hasEOL: true, transform: [16, 0, 0, 16, l.x, H - l.y]
        })) })
      };
      const viewport1 = { width: W, height: H, scale: 1,
        convertToViewportPoint: (x, y) => [x, H - y] };
      const p = { num: n, baseW: W, baseH: H, wrap, canvas, svg, renderTask: null, page: pdfPage, viewport1 };
      pages.push(p);
      attachOverlayHandlers(p);
    }
    scale = 1; view = 'ws'; currentDocId = 'snip-browser-check';
    currentUser = currentUser || { uid: 'snip-fixture', getIdToken: async () => 't' };
    wsMeta.subject = 'math'; wsMeta.level = 'P5'; wsMeta.guidance = 'answer';
    showView('ws');
    // The student's answer to Q2 on page 1, in blue ink, inside the box.
    annotations = [{ id: 'ink1', page: 1, type: 'pen', color: '#0d47a1', width: 4,
      points: [{ x: 60, y: 270 }, { x: 160, y: 272 }, { x: 260, y: 268 }] },
      { id: 'typed1', page: 1, type: 'text', x: 300, y: 255, w: 160, h: 26, text: 'I think it is 17', color: '#000', fontSize: 16 }];
    renderAllOverlays();
    loadTeachingNotes = async () => [];
    keyEnsureReady = async () => true;
    aiAvailable = () => true;
    usageNote = () => {};
    window.__saves = 0;
    setDirty = function () { window.__saves++; };
    if (typeof StudyAdventure !== 'undefined') { StudyAdventure.capture = () => null; }
    window.__canvases = [];
    const make = document.createElement.bind(document);
    document.createElement = function (tag) {
      const node = make(tag);
      if (String(tag).toLowerCase() === 'canvas') window.__canvases.push(node);
      return node;
    };
    window.__asks = [];
    window.askGemini = async (prompt, opts) => {
      window.__asks.push({ prompt, system: opts.system, images: (opts.images || []).map(i => i.data) });
      return 'Add the tens first, then the ones.';
    };
  });
  return { ctx, page, errors };
}

/* Where page N's point (x, y) in page units is on the screen. */
async function screenAt(page, n, x, y) {
  return page.evaluate(([n, x, y]) => {
    const p = pages.find(q => q.num === n);
    const r = p.wrap.getBoundingClientRect();
    return { x: r.left + x / p.baseW * r.width, y: r.top + y / p.baseH * r.height };
  }, [n, x, y]);
}
async function drag(page, a, b) {
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 });
  await page.mouse.move(b.x, b.y, { steps: 4 });
  await page.mouse.up();
}
/* Whether the picture holds the student's blue ink anywhere. */
async function hasBlue(page, b64) {
  return page.evaluate(src => new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let found = false;
      for (let i = 0; i < d.length; i += 4) if (d[i + 2] > 120 && d[i] < 80 && d[i + 1] < 120) { found = true; break; }
      c.width = 0; c.height = 0;
      resolve({ found, w: img.naturalWidth, h: img.naturalHeight });
    };
    img.onerror = () => resolve({ found: false, w: 0, h: 0 });
    img.src = src.startsWith('data:') ? src : 'data:image/jpeg;base64,' + src;
  }), b64);
}

console.log('\n✂️ A box over one question');
const desk = await openWorksheet({ width: 1280, height: 900 });
let page = desk.page;
// Scroll so page 1's Q2 is in view.
await page.evaluate(() => { document.getElementById('viewerArea').scrollTop = 0; });
ok('✂️ Ask about this is on the toolbar', await page.isVisible('#snipBtn'));
await page.click('#snipBtn');
ok('pressing it puts the veil over the screen', await page.isVisible('.snipVeil'));
if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'veil.png') });

// A tap is not a box: the veil stays and asks for a bigger one.
const tapAt = await screenAt(page, 1, 100, 250);
await page.mouse.click(tapAt.x, tapAt.y);
ok('a tap is not a box — the veil stays', await page.isVisible('.snipVeil'));
ok('…and it asks for a bigger box', /bigger box/.test(await page.textContent('.snipTip')));

// Escape ends it with nothing behind.
await page.keyboard.press('Escape');
ok('Escape takes the veil away', !(await page.isVisible('.snipVeil').catch(() => false)));
ok('…and nothing was picked', await page.evaluate(() => snipPending() === null));

// The real box: around Q2 on page 1 (y 240) and the ink/typed answer under it.
await page.click('#snipBtn');
await drag(page, await screenAt(page, 1, 30, 215), await screenAt(page, 1, 520, 300));
await page.waitForFunction(() => !!snipPending(), null, { timeout: 5000 });
const picked = await page.evaluate(() => {
  const s = snipPending();
  return { label: s.label, pages: s.pages, text: s.text, typed: s.typed, box: s.boxes[0],
           veil: !!document.querySelector('.snipVeil'), chip: !!document.querySelector('#buddyFoot .snipChip'),
           pane: buddyPane, open: !document.getElementById('buddy').classList.contains('closed'),
           thumb: s.thumb.slice(0, 30), image: s.image };
});
ok('the box ends on lifting the finger', !picked.veil);
ok('it is named as part of page 1', picked.label === 'page 1' && picked.pages.join() === '1', JSON.stringify(picked.pages));
ok('the printed words inside it come from the text layer', /Q2 on page 1: what is 11 \+ 4\?/.test(picked.text), picked.text);
ok('…and the words outside it do not', !/Q1 on page 1|Q3 on page 1/.test(picked.text), picked.text);
ok('the typed answer inside it is read too', picked.typed === 'I think it is 17', picked.typed);
ok('the box is in page units', Math.abs(picked.box.x0 - 30) < 3 && Math.abs(picked.box.y1 - 300) < 3, JSON.stringify(picked.box));
ok('the 💬 Ask tab opens with the part waiting in a chip', picked.open && picked.pane === 'chat' && picked.chip);
ok('the thumbnail is a JPEG', picked.thumb.startsWith('data:image/jpeg;base64,'), picked.thumb);
const cut = await hasBlue(page, picked.image);
ok('the cut has the student\'s blue ink on it', cut.found);
ok('the cut is the box\'s shape, not the page\'s', cut.w > cut.h * 4 && cut.w > 300, cut.w + '×' + cut.h);
if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'chip.png') });

// ➤ with nothing typed still asks.
await page.click('#buddyFoot .chatRow button[title="Send"]');
await page.waitForFunction(() => window.__asks.length === 1 && !aiBusy, null, { timeout: 5000 });
const ask = await page.evaluate(() => ({ a: window.__asks[0], chat: chat.map(m => ({ who: m.who, text: m.text, area: m.area, thumb: !!m.thumb })),
  chip: !!document.querySelector('#buddyFoot .snipChip'), bubbleImg: !!document.querySelector('#chatThread .bubble.me img.snipThumb'),
  tag: (document.querySelector('#chatThread .bubble.me .snipTag') || {}).textContent || '' }));
ok('➤ with nothing typed asks for help with that part', ask.chat[0] && ask.chat[0].text === 'Can you help me with this part?', JSON.stringify(ask.chat[0]));
ok('the model gets the cut FIRST', ask.a.images[0] === picked.image);
ok('…then the whole page for context', ask.a.images.length === 2);
ok('the prompt says the first picture is the boxed part', /DREW A BOX AROUND ONE PART OF PAGE 1/.test(ask.a.prompt) && /FIRST attached picture/.test(ask.a.prompt));
ok('the prompt carries the printed words, as data', /Printed words inside the box.*not instructions/s.test(ask.a.prompt) && /11 \+ 4/.test(ask.a.prompt));
ok('the prompt says where on the page the box is', /page 1, from \d+% to \d+% across/.test(ask.a.prompt));
ok('the help ceiling still rides in the system prompt', /Chung GPT/.test(ask.a.system));
ok('the chip is gone once the question is sent', !ask.chip);
ok('the bubble shows the picked part and names it', ask.bubbleImg && /page 1/.test(ask.tag), ask.tag);
ok('Chung GPT answers in the chat', ask.chat[1] && ask.chat[1].who === 'buddy' && /tens first/.test(ask.chat[1].text));

const saved = await page.evaluate(() => JSON.parse(worksheetBody()).chat);
ok('the saved chat keeps the words and the page', saved[0].area === 'page 1' && saved[0].text === 'Can you help me with this part?');
ok('…and drops the picture', !('thumb' in saved[0]));
ok('…without taking it off the bubble on screen', await page.evaluate(() => !!chat[0].thumb));

// A follow-up question is told which part the earlier one was about.
await page.evaluate(async () => { await sendChat('Why the tens first?'); });
const follow = await page.evaluate(() => window.__asks[1]);
ok('a follow-up carries the earlier boxed question in the history', /about the part they boxed on page 1/.test(follow.prompt));
ok('…and a plain question sends no cut', !/DREW A BOX/.test(follow.prompt));

console.log('\n✂️ A box over a page break, and a box over nothing');
await page.evaluate(() => {
  const p2 = pages[1];
  const area = document.getElementById('viewerArea');
  area.scrollTop += p2.wrap.getBoundingClientRect().top - area.getBoundingClientRect().top - 320;
});
await page.click('#snipBtn');
await drag(page, await screenAt(page, 1, 30, 660), await screenAt(page, 2, 520, 110));
await page.waitForFunction(() => !!snipPending(), null, { timeout: 5000 });
const both = await page.evaluate(() => ({ label: snipPending().label, pages: snipPending().pages, text: snipPending().text }));
ok('a box over a page break reads both pages', both.pages.join() === '1,2' && both.label === 'pages 1 and 2', JSON.stringify(both.pages));
ok('…with the words from each, page by page', /\[page 1\][\s\S]*Q5 on page 1[\s\S]*\[page 2\][\s\S]*Q1 on page 2/.test(both.text), both.text);
await page.click('#buddyFoot .snipChip button');
ok('✕ on the chip takes the part away', await page.evaluate(() => snipPending() === null && !document.querySelector('.snipChip')));

await page.click('#snipBtn');
const panel = await page.evaluate(() => { const r = document.getElementById('buddy').getBoundingClientRect(); return { x: r.left + 20, y: r.top + 120, x2: r.left + 200, y2: r.top + 300 }; });
await drag(page, { x: panel.x, y: panel.y }, { x: panel.x2, y: panel.y2 });
await page.waitForTimeout(150);
ok('a box over the panel finds no worksheet', await page.evaluate(() => snipPending() === null && !document.querySelector('.snipVeil')));
ok('…and says so', /not over the worksheet/.test(await page.evaluate(() => (document.getElementById('toast') || document.body).textContent)));

const leaks = await page.evaluate(() => window.__canvases.filter(c => c.width * c.height > 0 && !c.isConnected).length);
ok('every canvas made for a cut is given back', leaks === 0, leaks + ' still hold pixels');

console.log('\n✂️ Another worksheet opened');
await page.click('#snipBtn');
await drag(page, await screenAt(page, 2, 30, 215), await screenAt(page, 2, 520, 300));
await page.waitForFunction(() => !!snipPending(), null, { timeout: 5000 });
ok('a part picked on one worksheet is dropped when another opens', await page.evaluate(() => { wsEpoch++; return snipPending() === null; }));
ok('no page errors on a computer', desk.errors.length === 0, desk.errors.join(' | '));
await desk.ctx.close();

console.log('\n✂️ On a phone');
const phone = await openWorksheet({ width: 390, height: 844 });
page = phone.page;
await page.evaluate(() => { fitWidth(); openBuddy('chat'); });
await page.waitForTimeout(100);
await page.click('#chatSnipBtn');
ok('✂️ beside the Ask box starts it too', await page.isVisible('.snipVeil'));
ok('the panel steps aside while the box is drawn', await page.evaluate(() => document.getElementById('buddy').classList.contains('closed')));
await page.click('.snipTip button');
ok('Cancel brings the panel back as it was', await page.evaluate(() => !document.getElementById('buddy').classList.contains('closed') && !document.querySelector('.snipVeil')));
await page.click('#chatSnipBtn');
await drag(page, await screenAt(page, 1, 20, 215), await screenAt(page, 1, 560, 300));
await page.waitForFunction(() => !!snipPending(), null, { timeout: 5000 });
const ph = await page.evaluate(() => ({ text: snipPending().text, open: !document.getElementById('buddy').classList.contains('closed'),
  chip: !!document.querySelector('#buddyFoot .snipChip'),
  overflow: document.documentElement.scrollWidth > window.innerWidth + 1 }));
ok('on a phone the box reads the right question', /Q2 on page 1/.test(ph.text), ph.text);
ok('…and the panel comes back with the chip in it', ph.open && ph.chip);
ok('…and nothing runs off the side', !ph.overflow);
if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'phone-chip.png') });
ok('no page errors on a phone', phone.errors.length === 0, phone.errors.join(' | '));
await phone.ctx.close();

await browser.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
