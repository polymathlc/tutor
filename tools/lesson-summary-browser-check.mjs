/* =====================================================================
   📝 THE SUMMARY, IN A REAL BROWSER (v1.89.0)
   ---------------------------------------------------------------------
   tools/lesson-summary-tests.mjs pins the rules; this drives the real app
   in Chromium, on a worksheet built the way `loadPdf` builds one, with two
   video solutions on it whose recordings are REAL sound files:

   • 📝 appears beside 🎬 only when the worksheet has a video, and opens the
     window over the page, one row per question in paper order;
   • ✍️ Write really downloads the recording, the browser really DECODES it
     (`decodeAudioData` + `OfflineAudioContext`), and the transcription
     door is handed 16 kHz mono WAV pieces; the write-up goes through
     `window.askGemini` grounded like every other call;
   • the written lines are saved with `update` on the teacher's worksheet
     AND on the assignment, and shown on the row;
   • ✎ Edit saves the teacher's own words; 🗑 takes them off;
   • 📧 Send posts the worksheet's id and the addresses — never the words —
     and says it was sent; a wrong address is named and nothing is posted;
   • a student sees the words and the links, and no ✍️ / ✎ / message box;
   • Escape closes it; ▶ from an email link plays THAT video on the page;
   • on a phone the window fits the screen.

     PW=/path/to/playwright/index.mjs node tools/lesson-summary-browser-check.mjs
     LS_SCREENSHOTS=dir — also saves the window
   ===================================================================== */
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const PW = process.env.PW || '/opt/node22/lib/node_modules/playwright/index.mjs';
let chromium;
try {
  ({ chromium } = await import(PW.startsWith('file:') ? PW : pathToFileURL(path.resolve(PW)).href));
} catch (e) {
  console.log('lesson-summary-browser-check: no Playwright at ' + PW + ' — skipped.');
  process.exit(0);
}

const FILE = pathToFileURL(path.resolve(process.argv[2] || 'index.html')).href;
const SHOTS = process.env.LS_SCREENSHOTS || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
const ok = (name, cond, note) => {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (note ? '\n      ' + note : '')); }
};

/* A real recording: 44.1 kHz STEREO 16-bit WAV, `seconds` long, a tone the
   whole way so no piece is skipped as silence. The app must mix it to mono
   and bring it down to 16 kHz. */
function wavFile(seconds, rate = 44100) {
  const n = Math.floor(seconds * rate), ch = 2;
  const buf = Buffer.alloc(44 + n * ch * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * ch * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(ch, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * ch * 2, 28); buf.writeUInt16LE(ch * 2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * ch * 2, 40);
  for (let i = 0, at = 44; i < n; i++) {
    const v = Math.round(Math.sin(i / 9) * 9000);
    buf.writeInt16LE(v, at); buf.writeInt16LE(v, at + 2); at += 4;
  }
  return buf;
}
const LONG = wavFile(170);   // two pieces of speech at 150 s
const SHORT = wavFile(12);
const MEDIA1 = 'https://firebasestorage.googleapis.com/v0/b/mathgen--app.firebasestorage.app/o/pdf-annotator%2Flesson-LS1-v1.wav?alt=media&token=a';
const MEDIA2 = 'https://firebasestorage.googleapis.com/v0/b/mathgen--app.firebasestorage.app/o/pdf-annotator%2Flesson-LS1-v2.wav?alt=media&token=b';
const ENDPOINT = 'https://us-central1-mathgen--app.cloudfunctions.net/studyBuddySummary';

const browser = await chromium.launch({ ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });

async function freshPage(viewport) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const sent = [];
  // Everything off the network is refused, except the two recordings and the endpoint.
  await page.route('https://**/*', r => r.abort());
  await page.route(u => u.href.startsWith('https://firebasestorage.googleapis.com/'), r => {
    const body = r.request().url() === MEDIA1 ? LONG : SHORT;
    return r.fulfill({ status: 200, headers: { 'content-type': 'audio/wav', 'access-control-allow-origin': '*', 'content-length': String(body.length) }, body });
  });
  await page.route(u => u.href.startsWith(ENDPOINT), r => {
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
    sent.push({ body: JSON.parse(r.request().postData() || '{}'), headers: r.request().headers() });
    return r.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: JSON.stringify({ status: 'queued', written: 1, total: 2, skipped: 1 }) });
  });
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto(FILE);
  await page.waitForTimeout(700);
  return { ctx, page, errors, sent };
}

/* The worksheet, the teacher (or a student), the two videos, a fake Firestore. */
async function setUp(page, who) {
  await page.evaluate(({ who, MEDIA1, MEDIA2 }) => {
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
      c2.fillStyle = '#111'; c2.font = '16px serif';
      c2.fillText((n * 3) + '. A ribbon is cut into parts. Find the length of one part.', 30, 60);
      const svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'none' });
      svg.classList.add('overlay');
      wrap.appendChild(canvas); wrap.appendChild(svg);
      container.appendChild(wrap);
      const p = { num: n, baseW: W, baseH: H, wrap, canvas, svg, renderTask: null,
        page: { getViewport: ({ scale }) => ({ width: W * scale, height: H * scale, scale }), render: () => ({ promise: Promise.resolve() }), getTextContent: async () => ({ items: [] }) },
        viewport1: { width: W, height: H, scale: 1, convertToViewportPoint: (x, y) => [x, H - y] } };
      pages.push(p);
      attachOverlayHandlers(p);
    }
    scale = 1; currentDocId = 'LS1'; docName = 'P5 Ribbons';
    currentUser = who === 'teacher'
      ? { uid: 'teach', email: 'chungzhikai@gmail.com', displayName: 'T', getIdToken: async () => 'id-token' }
      : { uid: 'kid', email: 'kid@example.com', displayName: 'Kid', getIdToken: async () => 'id-token' };
    wsMeta.name = 'P5 Ribbons'; wsMeta.subject = 'math'; wsMeta.level = 'P5';
    wsMeta.assignmentId = who === 'teacher' ? '' : 'LS1';
    window.liveAppCheckToken = async () => 'app-check';
    // A Firestore that keeps what is written, and counts how.
    window.__docs = { 'tutorWorksheets/LS1': { ownerUid: 'teach', videos: [] }, 'tutorAssignments/LS1': { videos: [] } };
    window.__writes = [];
    db = { collection: (c) => ({ doc: (id) => ({
      get: async () => ({ exists: !!window.__docs[c + '/' + id], data: () => JSON.parse(JSON.stringify(window.__docs[c + '/' + id] || {})) }),
      update: async (v) => { window.__writes.push({ path: c + '/' + id, how: 'update', keys: Object.keys(v) }); Object.assign(window.__docs[c + '/' + id], JSON.parse(JSON.stringify(v))); },
      set: async (v) => { window.__writes.push({ path: c + '/' + id, how: 'set' }); window.__docs[c + '/' + id] = v; }
    }) }) };
    // The two AI doors, recorded.
    window.__heard = [];
    window.transcribeAudio = async (b64, mime, hint) => {
      const bin = atob(b64);
      const rate = bin.charCodeAt(24) | (bin.charCodeAt(25) << 8) | (bin.charCodeAt(26) << 16);
      const channels = bin.charCodeAt(22);
      window.__heard.push({ mime, rate, channels, bytes: bin.length, hint, riff: bin.slice(0, 4) });
      return 'Okay so um first we find one unit, twelve divided by three is four.';
    };
    window.__asked = [];
    window.askGemini = async (prompt, opts) => { window.__asked.push({ prompt, system: opts.system }); return '1. Find one unit: 12 ÷ 3 = 4.\n2. Then find 5 units.'; };
    const rec = (title, url, extra) => ({ id: title === 'Q6' ? 'vQ6' : 'vQ3', type: 'video', page: title === 'Q6' ? 2 : 1, x: 40, y: 80, label: title, url, ts: 1,
      lessonRecording: { version: 1, manifestUrl: url, manifestPath: '', audioPath: '', duration: extra.ms, pdfHash: '', title, ...(extra.video ? { video: true } : {}) } });
    wsVideos = [rec('Q6', MEDIA2, { ms: 12000 }), rec('Q3', MEDIA1, { ms: 170000, video: true })];
    wsVideoNotes = who === 'teacher' ? {} : { vQ3: { v: 1, text: '1. Find one unit: 12 ÷ 3 = 4.', at: 1, ms: 170000 } };
    showView('ws');
    renderVideoPills(true);
  }, { who, MEDIA1, MEDIA2 });
  await page.waitForTimeout(150);
}

/* ================= The teacher ================= */
console.log('📝 The teacher');
{
  const { ctx, page, errors, sent } = await freshPage({ width: 1280, height: 900 });
  ok('the summary module is loaded', await page.evaluate(() => !!(window.LessonSummary && LessonSummary.pure)));
  await page.evaluate(() => { showView('ws'); });
  ok('no 📝 on a worksheet with no videos', await page.evaluate(() => { wsVideos = []; lessonPlaylistSync(); return document.getElementById('summaryBtn').hidden; }));
  await setUp(page, 'teacher');
  ok('📝 shows beside 🎬 once there is a video', await page.evaluate(() => !document.getElementById('summaryBtn').hidden && !document.getElementById('playlistBtn').hidden));
  await page.click('#summaryBtn');
  await page.waitForSelector('#lsModal.open');
  const heads = await page.$$eval('#lsModal .lsQ', ns => ns.map(n => n.textContent));
  ok('one row per question, in paper order', JSON.stringify(heads) === '["Q3","Q6"]', JSON.stringify(heads));
  ok('the teacher sees ✍️ Write all', await page.isVisible('#lsModal .lsAll'));
  ok('…and the line-from-you box', await page.isVisible('#lsModal .lsMsg'));
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'summary-before.png') });

  await page.click('#lsModal li[data-ls-id="vQ3"] .lsWrite');
  await page.waitForFunction(() => !!document.querySelector('#lsModal li[data-ls-id="vQ3"] .lsText'), null, { timeout: 30000 }).catch(() => {});
  const heard = await page.evaluate(() => window.__heard);
  ok('the recording was decoded and cut into two pieces of speech', heard.length === 2, JSON.stringify(heard.map(h => h.bytes)));
  ok('…each a 16 kHz MONO WAV', heard.every(h => h.mime === 'audio/wav' && h.riff === 'RIFF' && h.rate === 16000 && h.channels === 1), JSON.stringify(heard[0]));
  ok('…of the right length (≤ 150 s of 16-bit samples)', heard.every(h => h.bytes <= 44 + 150 * 16000 * 2 + 2) && heard[0].bytes > 100 * 16000 * 2, String(heard[0] && heard[0].bytes));
  ok('…and told which part each is', /part 2 of 2/.test(heard[1] && heard[1].hint));
  const asked = await page.evaluate(() => window.__asked);
  ok('ONE write-up for the video', asked.length === 1);
  const method = await page.evaluate(() => tutorMethodRule());
  ok('…grounded like every other call: the rule first, the method rule last', asked[0] && asked[0].system.indexOf('Write ONLY what the teacher said') >= 0 &&
    method.length > 20 && asked[0].system.endsWith(method));
  ok('…with the transcript as JSON data', asked[0] && /as JSON data:\n"Okay so um first we find one unit/.test(asked[0].prompt));
  const shown = await page.$eval('#lsModal li[data-ls-id="vQ3"] .lsText', n => n.innerText).catch(() => '');
  ok('the written lines are on the row', /1\. Find one unit: 12 ÷ 3 = 4\.\n2\. Then find 5 units\./.test(shown), shown);
  const docs = await page.evaluate(() => ({ ws: window.__docs['tutorWorksheets/LS1'].videoNotes, set: window.__docs['tutorAssignments/LS1'].videoNotes, writes: window.__writes }));
  ok('saved on the teacher\'s worksheet', !!(docs.ws && docs.ws.vQ3 && /12 ÷ 3/.test(docs.ws.vQ3.text)));
  ok('…and on the assignment, for every copy', !!(docs.set && docs.set.vQ3));
  ok('…with `update`, never `set`', docs.writes.length === 2 && docs.writes.every(w => w.how === 'update' && w.keys.join() === 'videoNotes'), JSON.stringify(docs.writes));
  ok('the word-for-word transcript is kept on this device', await page.isVisible('#lsModal li[data-ls-id="vQ3"] .lsRaw'));

  // ✎ Edit
  await page.click('#lsModal li[data-ls-id="vQ3"] button:has-text("Edit")');
  await page.fill('#lsModal .lsEditBox', 'My own words for Q3.');
  await page.click('#lsModal .lsSave');
  await page.waitForTimeout(150);
  ok('✎ Edit saves the teacher\'s own words', await page.evaluate(() => window.__docs['tutorWorksheets/LS1'].videoNotes.vQ3.text === 'My own words for Q3.' && window.__docs['tutorWorksheets/LS1'].videoNotes.vQ3.edited === true));

  // 📧 Send — a bad address first
  await page.fill('#lsModal .lsTo', 'mum@example.com, not-an-address');
  await page.click('#lsModal .lsSend');
  await page.waitForTimeout(100);
  ok('a wrong address is named and nothing is posted', /not-an-address/.test(await page.textContent('#lsModal .lsSendMsg')) && sent.length === 0);
  await page.fill('#lsModal .lsTo', 'Mum@Example.com; dad@example.com');
  await page.fill('#lsModal .lsMsg', 'Please go through Q3 tonight.');
  await page.click('#lsModal .lsSend');
  await page.waitForFunction(() => /Sent to/.test((document.querySelector('#lsModal .lsSendMsg') || {}).textContent || ''), null, { timeout: 5000 }).catch(() => {});
  ok('📧 Send posted once', sent.length === 1);
  ok('…the worksheet id, the addresses and the teacher\'s line — never the words', sent[0] && JSON.stringify(Object.keys(sent[0].body).sort()) === '["message","to","worksheetId"]' &&
    sent[0].body.worksheetId === 'LS1' && JSON.stringify(sent[0].body.to) === '["mum@example.com","dad@example.com"]', JSON.stringify(sent[0] && sent[0].body));
  ok('…signed in and App-Checked', sent[0] && sent[0].headers.authorization === 'Bearer id-token' && sent[0].headers['x-firebase-appcheck'] === 'app-check');
  ok('…and the window says it was sent', /Sent to mum@example\.com, dad@example\.com/.test(await page.textContent('#lsModal .lsSendMsg')));
  ok('the addresses are remembered on this device', await page.evaluate(() => localStorage.getItem('polymath.summaryTo')) === 'Mum@Example.com; dad@example.com');

  // 🗑
  await page.click('#lsModal li[data-ls-id="vQ3"] .lsDrop');
  await page.waitForTimeout(150);
  ok('🗑 takes the written lines off both documents', await page.evaluate(() => !window.__docs['tutorWorksheets/LS1'].videoNotes.vQ3 && !window.__docs['tutorAssignments/LS1'].videoNotes.vQ3));

  // Escape
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  ok('Escape closes the window', !(await page.evaluate(() => LessonSummary.isOpen())));

  // ▶ from an email link
  await page.evaluate(() => { window.__played = []; lessonPlay = function (v) { window.__played.push(v.id); }; summaryPlayWhenReady('vQ6', wsEpoch - 1); });
  await page.waitForTimeout(900);
  ok('▶ from an email link plays THAT video on the page', JSON.stringify(await page.evaluate(() => window.__played)) === '["vQ6"]');
  ok('no page errors (teacher)', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

/* ================= A student ================= */
console.log('📝 A student');
{
  const { ctx, page, errors, sent } = await freshPage({ width: 390, height: 844 });
  await setUp(page, 'student');
  await page.click('#summaryBtn').catch(async () => { await page.evaluate(() => summaryOpen()); });
  await page.waitForSelector('#lsModal.open');
  ok('a student sees the teacher\'s words', /12 ÷ 3 = 4/.test(await page.textContent('#lsModal li[data-ls-id="vQ3"]')));
  ok('…and no ✍️, ✎, 🗑 or message box', (await page.$$('#lsModal .lsWrite, #lsModal .lsAll, #lsModal .lsDrop, #lsModal .lsMsg')).length === 0);
  ok('…but the ▶ Watch and 🎬 Recording links', (await page.$$('#lsModal .lsWatch')).length === 2 && (await page.$$('#lsModal a.lsLink')).length === 2);
  ok('the recording link is the lesson file itself', await page.$eval('#lsModal li[data-ls-id="vQ3"] a.lsLink', a => a.href) === MEDIA1);
  const fits = await page.evaluate(() => { const c = document.querySelector('#lsModal .modalCard').getBoundingClientRect(); return c.left >= 0 && c.right <= innerWidth + 0.5 && document.documentElement.scrollWidth <= innerWidth; });
  ok('on a phone the window fits the screen', fits);
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'summary-phone.png') });
  await page.fill('#lsModal .lsTo', 'a@x.co, b@x.co, c@x.co, d@x.co');
  await page.click('#lsModal .lsSend');
  await page.waitForTimeout(100);
  ok('a student is held to three addresses before anything is posted', /At most 3/.test(await page.textContent('#lsModal .lsSendMsg')) && sent.length === 0);
  await page.fill('#lsModal .lsTo', 'mum@example.com');
  await page.click('#lsModal .lsSend');
  await page.waitForFunction(() => /Sent to/.test((document.querySelector('#lsModal .lsSendMsg') || {}).textContent || ''), null, { timeout: 5000 }).catch(() => {});
  ok('a student\'s send carries no message and their copy\'s id', sent.length === 1 && !('message' in sent[0].body) && sent[0].body.worksheetId === 'LS1');
  ok('no page errors (student)', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

await browser.close();
console.log('\n' + (fail ? '✗ ' + fail + ' of ' + (pass + fail) + ' checks failed' : '✓ all ' + pass + ' checks passed'));
process.exit(fail ? 1 : 0);
