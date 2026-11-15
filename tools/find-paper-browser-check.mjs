/* =====================================================================
   🔎 FIND AN EXAM PAPER, IN A REAL BROWSER (v1.91.0)
   ---------------------------------------------------------------------
   Opens index.html in Chromium as an iPad (touch) and as a phone, signs a
   fake student in, and drives the whole road with real taps:

   • 🔎 Find exam paper opens SG Exam in a NEW TAB inside the tap and the
     upload dialog here, with the 🔎 box at the top;
   • every control in the box is at least 44px tall, the link box is 16px
     text (so Safari does not zoom), and the dialog never scrolls sideways;
   • coming back to the tab (focus) nudges 📋 Paste link;
   • 📋 Paste link reads the clipboard into the box;
   • a link from another site is answered in words and NOTHING is fetched;
   • a good link asks `studyBuddyPaper` with `{ url }` and the ID token +
     App Check headers, and the PDF that comes back goes to `handleUpload`
     as a named application/pdf File;
   • a refusal from the server (a private Drive file) is said in its words.

   The endpoint and SG Exam are faked with page.route, so nothing leaves
   the machine.

     PW=/path/to/playwright/index.mjs node tools/find-paper-browser-check.mjs
     FIND_SCREENSHOTS=dir — also saves the dialog at iPad and phone size
   ===================================================================== */
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const PW = process.env.PW || '/opt/node22/lib/node_modules/playwright/index.mjs';
let chromium, devices;
try {
  ({ chromium, devices } = await import(PW.startsWith('file:') ? PW : pathToFileURL(path.resolve(PW)).href));
} catch (e) {
  try { ({ chromium, devices } = await import('playwright')); }
  catch (e2) { console.log('find-paper-browser-check: no Playwright — skipped.'); process.exit(0); }
}

const FILE = pathToFileURL(path.resolve(process.argv[2] || 'index.html')).href;
const SHOTS = process.env.FIND_SCREENSHOTS || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
const ok = (name, cond, note) => {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (note ? '\n      ' + note : '')); }
};

const PAGE_LINK = 'https://sgexam.com/subject/maths/2025-p5-maths-end-of-year-exam-acs-junior-pdf/';
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
const ENDPOINT = 'https://us-central1-mathgen--app.cloudfunctions.net/studyBuddyPaper';

const browser = await chromium.launch({ ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });

async function run(label, opts) {
  console.log('\n' + label);
  const ctx = await browser.newContext(opts);
  try { await ctx.grantPermissions(['clipboard-read', 'clipboard-write']); } catch (e) { /* not every channel */ }
  const asked = [];
  let answer = 'pdf';
  // Nothing leaves the machine: every outside request is answered here.
  await ctx.route('**/*', route => {
    const url = route.request().url();
    if (url.startsWith('file:')) return route.continue();
    if (url === ENDPOINT) {
      const req = route.request();
      if (req.method() === 'OPTIONS') {
        return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'POST' } });
      }
      asked.push({ body: req.postData(), headers: req.headers() });
      if (answer === 'private') {
        return route.fulfill({ status: 403, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ error: { code: 'private', message: 'That file is private on Google Drive, so it cannot be brought in. Download it and upload it instead.' } }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/pdf', body: PDF,
        headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Expose-Headers': 'X-Paper-Name',
          'X-Paper-Name': encodeURIComponent('2025 P5 Maths End of Year Exam ACS Junior') } });
    }
    if (/^https:\/\/(www\.)?sgexam\.com\//.test(url)) {
      return route.fulfill({ status: 200, contentType: 'text/html', body: '<title>SG Exam</title><h1>SG Exam (stub)</h1>' });
    }
    return route.abort();
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(FILE);
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    currentUser = { uid: 'u1', email: 'student@example.com', displayName: 'Test', getIdToken: async () => 'id-token' };
    window.liveAppCheckToken = async () => 'app-check';
    window.__uploads = [];
    handleUpload = async function (files) {
      const f = files[0];
      const head = new Uint8Array(await f.slice(0, 5).arrayBuffer());
      window.__uploads.push({ name: f.name, type: f.type, size: f.size, head: String.fromCharCode.apply(null, head) });
      document.getElementById('uploadModal').classList.remove('open');
    };
    showView('home');
    document.getElementById('homeSignedIn').classList.remove('hidden');
    document.getElementById('signedOutCard').classList.add('hidden');
  });

  const findBtn = page.locator('#findPaperBtn');
  ok('🔎 Find exam paper is on the home screen', await findBtn.isVisible());
  const fb = await findBtn.boundingBox();
  ok('…and it is finger-sized (≥ 44px tall)', fb && fb.height >= 44, fb && ('height ' + fb.height));

  const popupWait = ctx.waitForEvent('page', { timeout: 5000 }).catch(() => null);
  if (opts.hasTouch) await findBtn.tap(); else await findBtn.click();
  const popup = await popupWait;
  ok('SG Exam opens in a new tab, inside the tap', !!popup && /sgexam\.com/.test(popup.url()), popup ? popup.url() : 'no new tab');
  ok('…and the upload dialog is open here', await page.locator('#uploadModal.open').count() === 1);
  ok('…with the 🔎 box showing', await page.locator('#upFind').isVisible());
  ok('…with no list, the paste road stays up front and the rest is under Advanced options',
    await page.locator('#upLink').isVisible() && !(await page.locator('#upName').isVisible()));
  ok('…and an Open SG Exam link that opens a new tab', await page.locator('#upFindSites a[target=_blank][href="https://sgexam.com/"]').count() === 1);
  ok('…and no error on the page', errors.length === 0, errors.join(' | '));

  // Sizes for a finger, and no sideways scroll.
  const sizes = await page.evaluate(() => {
    const ids = ['upLink', 'upLinkPaste', 'upLinkGo'];
    const out = {};
    ids.forEach(id => { const r = document.getElementById(id).getBoundingClientRect(); out[id] = { h: r.height, w: r.width, right: r.right }; });
    out.font = parseFloat(getComputedStyle(document.getElementById('upLink')).fontSize);
    const card = document.querySelector('#uploadModal .modalCard');
    out.cardOverflow = card.scrollWidth - card.clientWidth;
    out.vw = window.innerWidth;
    const site = document.querySelector('#upFindSites a').getBoundingClientRect();
    out.site = site.height;
    return out;
  });
  ok('the link box, 📋 and ⬇ are all ≥ 44px tall',
    sizes.upLink.h >= 44 && sizes.upLinkPaste.h >= 44 && sizes.upLinkGo.h >= 44 && sizes.site >= 44, JSON.stringify(sizes));
  ok('the link box is 16px text (Safari does not zoom in)', sizes.font >= 16, 'font ' + sizes.font);
  ok('nothing in the box runs off the screen', ['upLink', 'upLinkPaste', 'upLinkGo'].every(id => sizes[id].right <= sizes.vw + 0.5), JSON.stringify(sizes));
  ok('the dialog does not scroll sideways', sizes.cardOverflow <= 1, 'overflow ' + sizes.cardOverflow);

  // Back in the tab with nothing pasted: 📋 is pointed at.
  if (popup) await popup.close();
  await page.bringToFront();
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  ok('coming back nudges 📋 Paste link', await page.locator('#upFind.nudge').count() === 1);
  ok('…and says what to do', /Paste link/.test(await page.locator('#upLinkMsg').textContent()));
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, label.replace(/\W+/g, '-') + '-dialog.png') });

  // A link from another site: words, and no fetch.
  await page.fill('#upLink', 'https://example.com/paper.pdf');
  if (opts.hasTouch) await page.locator('#upLinkGo').tap(); else await page.locator('#upLinkGo').click();
  await page.waitForTimeout(150);
  ok('a link from another site is answered in words', /SG Exam or a Google Drive link/.test(await page.locator('#upLinkMsg').textContent()));
  ok('…and nothing was fetched', asked.length === 0);

  // 📋 Paste link reads the clipboard.
  let pasted = false;
  try {
    await page.evaluate(t => navigator.clipboard.writeText(t), 'Download Paper ' + PAGE_LINK);
    await page.fill('#upLink', '');
    if (opts.hasTouch) await page.locator('#upLinkPaste').tap(); else await page.locator('#upLinkPaste').click();
    await page.waitForTimeout(250);
    pasted = (await page.inputValue('#upLink')).includes(PAGE_LINK);
  } catch (e) { pasted = false; }
  if (!pasted) await page.fill('#upLink', PAGE_LINK);
  ok('📋 Paste link puts the copied link in the box', pasted, 'clipboard not available in this browser; typed instead');
  ok('…and the nudge stops', await page.locator('#upFind.nudge').count() === 0);

  // ⬇ Bring it in.
  if (opts.hasTouch) await page.locator('#upLinkGo').tap(); else await page.locator('#upLinkGo').click();
  await page.waitForFunction(() => window.__uploads.length > 0, null, { timeout: 5000 }).catch(() => {});
  const ups = await page.evaluate(() => window.__uploads);
  ok('the endpoint is asked once, with the link and nothing else', asked.length === 1 &&
    JSON.stringify(JSON.parse(asked[0].body)) === JSON.stringify({ url: PAGE_LINK }), asked.map(a => a.body).join(' | '));
  ok('…carrying the sign-in and App Check tokens', asked[0] && asked[0].headers.authorization === 'Bearer id-token' &&
    asked[0].headers['x-firebase-appcheck'] === 'app-check');
  ok('the paper goes to the upload as a named PDF file', ups.length === 1 && ups[0].type === 'application/pdf' &&
    ups[0].name === '2025 P5 Maths End of Year Exam ACS Junior.pdf' && ups[0].head === '%PDF-', JSON.stringify(ups));

  // A refusal is said in the server's words.
  await page.evaluate(() => openUploadModal());
  ok('the box is empty again next time', (await page.inputValue('#upLink')) === '');
  answer = 'private';
  await page.fill('#upLink', 'https://drive.google.com/file/d/1qsE4K8AN6ByAQhyPOT_FkYVHe6PL16he/view');
  await page.press('#upLink', 'Enter');
  await page.waitForFunction(() => /private/.test(document.getElementById('upLinkMsg').textContent), null, { timeout: 5000 }).catch(() => {});
  ok('a private Drive file is said to be private', /private/.test(await page.locator('#upLinkMsg').textContent()));
  ok('…the dialog stays open, the buttons come back', await page.locator('#uploadModal.open').count() === 1 &&
    !(await page.locator('#upLinkGo').isDisabled()));
  ok('…and nothing was uploaded', (await page.evaluate(() => window.__uploads.length)) === 1);
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, label.replace(/\W+/g, '-') + '-refused.png') });
  ok('no page errors along the way', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

/* ---------------- 📚 the SG Exam list (v1.92.0) ---------------- */
const LIST = { source: 'https://sgexam.com/', count: 0, papers: [] };
const row = (y, l, sl, s, e, sc, slug) => ({ t: `${y}-${l}-${sl}-${e}-${sc}`, u: `https://sgexam.com/subject/${slug}/${y}-${l.toLowerCase()}-${sc.toLowerCase().replace(/\W+/g, '-')}/`, y, l, s, sl, e, sc });
for (const [y, sc] of [[2026, 'ACS Junior'], [2026, 'Nan Hua'], [2025, 'Ai Tong'], [2025, 'Tao Nan'], [2024, 'Rosyth']]) {
  LIST.papers.push(row(y, 'P5', 'Maths', 'math', 'SA2', sc, 'maths'));
}
for (let i = 0; i < 45; i++) LIST.papers.push(row(2020 + (i % 6), 'P6', 'Science', 'science', 'Prelim Exam', 'School ' + String(i).padStart(2, '0'), 'science'));
LIST.papers.push({ ...row(2026, 'P5', 'Maths', 'math', 'SA2', 'Evil', 'maths'), u: 'https://evil.example/2026-p5.pdf' });
LIST.count = LIST.papers.length;

async function runList(label, opts) {
  console.log('\n' + label + ' — picking from the SG Exam list');
  const ctx = await browser.newContext(opts);
  const asked = [];
  await ctx.addInitScript(list => {
    const real = window.fetch.bind(window);
    window.fetch = (url, init) => /papers\/sgexam\.json/.test(String(url))
      ? Promise.resolve(new Response(JSON.stringify(list), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      : real(url, init);
  }, LIST);
  await ctx.route('**/*', route => {
    const url = route.request().url();
    if (url.startsWith('file:')) return route.continue();
    if (url === ENDPOINT) {
      const req = route.request();
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'POST' } });
      asked.push(req.postData());
      return route.fulfill({ status: 200, contentType: 'application/pdf', body: PDF,
        headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Expose-Headers': 'X-Paper-Name', 'X-Paper-Name': encodeURIComponent('2025 P5 Maths SA2 Ai Tong') } });
    }
    return route.abort();
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(FILE);
  await page.waitForTimeout(800);
  await page.evaluate(async () => {
    currentUser = { uid: 'u1', email: 'student@example.com', displayName: 'Test', getIdToken: async () => 'id-token' };
    window.liveAppCheckToken = async () => 'app-check';
    activeStudent = () => ({ name: 'Ann', level: 'P5', subject: 'math' });
    window.__uploads = [];
    handleUpload = async function (files) {
      window.__uploads.push({ name: files[0].name, type: files[0].type });
      document.getElementById('uploadModal').classList.remove('open');
    };
    showView('home');
    document.getElementById('homeSignedIn').classList.remove('hidden');
    document.getElementById('signedOutCard').classList.add('hidden');
    await paperListLoad();
  });
  const tap = async sel => { if (opts.hasTouch) await page.locator(sel).first().tap(); else await page.locator(sel).first().click(); };

  const popupWait = ctx.waitForEvent('page', { timeout: 1500 }).catch(() => null);
  await tap('#findPaperBtn');
  const popup = await popupWait;
  ok('with the list in hand, 🔎 opens NO new tab', !popup, popup ? popup.url() : '');
  ok('…the dialog is open with the picker showing', await page.locator('#uploadModal.open').count() === 1 && await page.locator('#upPick').isVisible());
  ok('…and the paste road is folded away', !(await page.evaluate(() => document.getElementById('upPaste').open)));
  // ⚙ (v1.94.0) The simple view: the list and nothing else.
  ok('…titled Find an exam paper', /Find an exam paper/.test(await page.locator('#upTitle').textContent()));
  ok('…everything else is folded under ⚙ Advanced options',
    await page.locator('#upAdvHead').isVisible() && !(await page.evaluate(() => document.getElementById('upAdv').open)) &&
    !(await page.locator('#upName').isVisible()) && !(await page.locator('#upLink').isVisible()) &&
    !(await page.locator('#upPickYear').isVisible()) && !(await page.locator('#upGradeGrid').isVisible()));
  ok('…and the upload button waits there too', !(await page.locator('#upGo').isVisible()) &&
    (await page.locator('#upCancel').textContent()) === 'Close');
  const advBox = await page.locator('#upAdvHead').boundingBox();
  ok('…Advanced options is finger-sized', advBox && advBox.height >= 44, advBox && ('height ' + advBox.height));
  ok('it starts on the student’s own level and subject',
    (await page.inputValue('#upPickLevel')) === 'P5' && (await page.inputValue('#upPickSubject')) === 'Maths');
  const rows = await page.locator('#upPickList .upPickRow').count();
  ok('…listing that level and subject’s papers, and never a link to another site', rows === 5, 'rows ' + rows);
  ok('…newest first, under year headings',
    (await page.locator('#upPickList .upPickYear').first().textContent()) === '2026' &&
    (await page.locator('#upPickList .upPickYear').count()) === 3);
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, label.replace(/\W+/g, '-') + '-simple.png') });
  await tap('#upAdvHead');
  // The details' toggle event is a task of its own: wait for the foot to follow.
  await page.waitForFunction(() => !document.getElementById('upGo').classList.contains('hidden'), null, { timeout: 2000 }).catch(() => {});
  ok('opening Advanced options shows the year, the link box and the upload',
    await page.locator('#upPickYear').isVisible() && await page.locator('#upPaste').isVisible() &&
    await page.locator('#upName').isVisible() && await page.locator('#upGo').isVisible() &&
    (await page.locator('#upCancel').textContent()) === 'Cancel');
  const sz = await page.evaluate(() => {
    const r = document.querySelector('#upPickList .upPickRow').getBoundingClientRect();
    const card = document.querySelector('#uploadModal .modalCard');
    return {
      row: r.height,
      sel: ['upPickLevel', 'upPickSubject', 'upPickYear', 'upPickSearch'].map(id => document.getElementById(id).getBoundingClientRect().height),
      font: ['upPickLevel', 'upPickSearch'].map(id => parseFloat(getComputedStyle(document.getElementById(id)).fontSize)),
      overflow: card.scrollWidth - card.clientWidth
    };
  });
  ok('rows and filters are finger-sized, 16px text, no sideways scroll',
    sz.row >= 44 && sz.sel.every(h => h >= 44) && sz.font.every(f => f >= 16) && sz.overflow <= 1, JSON.stringify(sz));
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, label.replace(/\W+/g, '-') + '-list.png') });

  await page.fill('#upPickSearch', 'nan hua');
  ok('search narrows by school', (await page.locator('#upPickList .upPickRow').count()) === 1);
  await page.fill('#upPickSearch', '');
  await page.selectOption('#upPickYear', '2025');
  ok('a year shows only that year', (await page.locator('#upPickList .upPickRow').count()) === 2);

  await page.selectOption('#upPickLevel', 'P6');
  await page.selectOption('#upPickSubject', 'Science');
  ok('another level and subject: 40 shown, then Show more',
    (await page.locator('#upPickList .upPickRow').count()) === 40 && await page.locator('#upPickMore').isVisible(),
    String(await page.locator('#upPickList .upPickRow').count()));
  await tap('#upPickMore');
  ok('…Show more shows the rest', (await page.locator('#upPickList .upPickRow').count()) === 45 && !(await page.locator('#upPickMore').isVisible()));

  await page.selectOption('#upPickLevel', 'P5');
  await page.selectOption('#upPickSubject', 'Maths');
  await page.selectOption('#upPickYear', '2025');
  const want = LIST.papers.find(p => p.sc === 'Ai Tong').u;
  await tap(`#upPickList .upPickRow[data-url="${want}"]`);
  await page.waitForFunction(() => window.__uploads.length > 0, null, { timeout: 5000 }).catch(() => {});
  ok('tapping a paper asks for THAT link, once', asked.length === 1 && JSON.parse(asked[0]).url === want, asked.join(' | '));
  const ups = await page.evaluate(() => window.__uploads);
  ok('…and it is uploaded as a named PDF', ups.length === 1 && ups[0].name === '2025 P5 Maths SA2 Ai Tong.pdf' && ups[0].type === 'application/pdf', JSON.stringify(ups));
  // ⬆ Upload is the full dialog, as before: no Advanced heading, everything open.
  await page.evaluate(() => openUploadModal());
  ok('⬆ Upload still shows the whole dialog, with no Advanced heading',
    !(await page.locator('#upAdvHead').isVisible()) && await page.locator('#upName').isVisible() &&
    await page.locator('#upGo').isVisible() && /Upload a worksheet/.test(await page.locator('#upTitle').textContent()));
  ok('no page errors along the way', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

const ipad = devices && devices['iPad (gen 7)'] ? { ...devices['iPad (gen 7)'] } : { viewport: { width: 810, height: 1080 }, hasTouch: true, isMobile: true };
delete ipad.defaultBrowserType;
await run('iPad (touch)', ipad);
const phone = devices && devices['iPhone 13'] ? { ...devices['iPhone 13'] } : { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };
delete phone.defaultBrowserType;
await run('Phone (touch)', phone);
await run('Laptop (mouse)', { viewport: { width: 1280, height: 800 } });
await runList('iPad (touch)', ipad);
await runList('Phone (touch)', phone);
await runList('Laptop (mouse)', { viewport: { width: 1280, height: 800 } });

await browser.close();
console.log('\n' + (fail ? '✗ ' + fail + ' of ' + (pass + fail) + ' checks failed' : '✓ all ' + pass + ' checks passed'));
process.exit(fail ? 1 : 0);
