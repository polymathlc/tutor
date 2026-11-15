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

const ipad = devices && devices['iPad (gen 7)'] ? { ...devices['iPad (gen 7)'] } : { viewport: { width: 810, height: 1080 }, hasTouch: true, isMobile: true };
delete ipad.defaultBrowserType;
await run('iPad (touch)', ipad);
const phone = devices && devices['iPhone 13'] ? { ...devices['iPhone 13'] } : { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };
delete phone.defaultBrowserType;
await run('Phone (touch)', phone);
await run('Laptop (mouse)', { viewport: { width: 1280, height: 800 } });

await browser.close();
console.log('\n' + (fail ? '✗ ' + fail + ' of ' + (pass + fail) + ' checks failed' : '✓ all ' + pass + ' checks passed'));
process.exit(fail ? 1 : 0);
