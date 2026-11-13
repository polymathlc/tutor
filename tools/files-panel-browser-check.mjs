/* 📂 MY WORKSHEETS, BESIDE THE PAGE and 🗑 ASK BEFORE DELETING (v1.90.0),
   in a real browser. The worksheet screen's side bar opens, lists the
   account's papers (the open one marked, a set paper with Start and no 🗑),
   finds by name, and every 🗑 — in the side bar AND on the bookcase card —
   opens the one confirmation box: Keep it focused, the red button armed a
   moment late, Escape / Keep it / the backdrop delete NOTHING, and only the
   red button deletes. Deleting the OPEN paper lets go of it first, so an
   auto-save cannot write it back. A student's copy of a set paper keeps the
   class's PDF.
   Every paper is a fixture and Firestore / Storage are fakes that record
   what they were asked; nothing remote is reached.
   Run: PW=<playwright index.mjs> node tools/files-panel-browser-check.mjs
   SHOTS=<dir> also saves screenshots (iPad and phone). */
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
if (shots) fs.mkdirSync(shots, { recursive: true });
const errors = [];
const DAY = 864e5;

/* A tiny page-sized cover so the thumbnails are real pictures. */
const COVER = 'data:image/svg+xml;base64,' + Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="60" height="80"><rect width="60" height="80" fill="#fff"/>' +
  '<rect x="6" y="8" width="48" height="6" fill="#333"/><rect x="6" y="20" width="40" height="3" fill="#999"/>' +
  '<rect x="6" y="28" width="44" height="3" fill="#999"/></svg>').toString('base64');

async function open(viewport, opts = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: shots ? 2 : 1, hasTouch: !!opts.touch });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(viewport.width + ': ' + e.message));
  await page.route('https://**/*', r => r.abort());
  await page.goto('http://127.0.0.1:' + server.address().port, { waitUntil: 'networkidle' });
  await page.evaluate(({ now, DAY, COVER }) => {
    try { localStorage.clear(); } catch (e) {}
    /* Firestore and Storage that record what they are asked. */
    window.__calls = [];
    const rec = (op, col, id, extra) => window.__calls.push({ op, col, id, extra, t: Date.now() });
    const docRef = (col, id) => ({
      id,
      get: async () => { rec('get', col, id); return { exists: false, data: () => ({}) }; },
      set: async (d, o) => { rec('set', col, id, o); },
      update: async () => { rec('update', col, id); },
      delete: async () => { rec('delete', col, id); }
    });
    db = { collection: col => ({ doc: id => docRef(col, id), where: () => ({ get: async () => ({ forEach() {} }) }) }) };
    storage = { ref: p => ({ delete: async () => { rec('file', 'storage', p); }, getDownloadURL: async () => 'https://x' }) };
    window.firebase = window.firebase || {};
    firebase.firestore = firebase.firestore || {};
    firebase.firestore.FieldValue = { serverTimestamp: () => 'ts' };
    currentUser = { uid: 'kid', email: 'kid@example.com', getIdToken: async () => 't' };
    myStudents = [{ name: 'Caius', level: 'P5', subject: 'both' }];
    _activeIdx = 0;
    // The list comes from the fixtures, not a query.
    loadWorksheets = async function () { renderWorksheets(); };
    worksheets = [
      { id: 'w1', name: 'Heat revision — Rosyth 2024', level: 'P5', subject: 'science', ownerUid: 'kid', topic: 'Heat',
        pageCount: 8, cover: COVER, storagePath: 'tutor-worksheets/kid/w1.pdf', bodyPath: 'tutor-worksheets/kid/w1.body.json',
        createdAt: now - 20 * DAY, updatedAt: now - 3 * DAY, lastOpenedAt: now - 60e3, score: { correct: 14, attempted: 20 } },
      { id: 'w2', name: 'Fractions drill 2', level: 'P5', subject: 'math', ownerUid: 'kid',
        pageCount: 4, storagePath: 'tutor-worksheets/kid/w2.pdf', createdAt: now - 2 * DAY, updatedAt: now - 2 * DAY },
      { id: 'w3', name: 'Mr Chung’s Area paper (my copy)', level: 'P5', subject: 'math', ownerUid: 'kid', cover: COVER,
        sharedPdf: true, assignmentId: 'a9', storagePath: 'tutor-worksheets/teacher/a9.pdf', pageCount: 6,
        createdAt: now - 6 * DAY, updatedAt: now - 5 * DAY },
      { id: 'w4', name: 'Light and shadows', level: 'P5', subject: 'science', ownerUid: 'kid',
        storagePath: 'tutor-worksheets/kid/w4.pdf', createdAt: now - 9 * DAY, updatedAt: now - 9 * DAY }
    ];
    assignments = [
      { id: 'a9', name: 'Mr Chung’s Area paper', level: 'P5', subject: 'math', createdAt: now - 7 * DAY },
      { id: 'a7', name: 'Magnets practice', level: 'P5', subject: 'science', createdAt: now - 1 * DAY }
    ];
    assignmentsLoaded = true;
    renderWorksheets();
    // Open w1 as the worksheet in view (no PDF needed for the side bar).
    currentDocId = 'w1';
    docName = 'Heat revision — Rosyth 2024';
    showView('ws');
    setWsTitle(docName);
  }, { now: Date.now(), DAY, COVER });
  await page.waitForTimeout(80);
  return { ctx, page };
}

const calls = page => page.evaluate(() => window.__calls.slice());
const rows = page => page.$$eval('#filesList .filesRow', rs => rs.map(r => ({
  id: r.dataset.id, name: r.querySelector('.filesName').textContent,
  now: r.classList.contains('filesNow'), set: r.classList.contains('filesSet'),
  del: !!r.querySelector('.filesDel'), meta: r.querySelector('.filesMeta').textContent,
  img: !!r.querySelector('.filesThumb img')
})));
const modalOpen = page => page.$eval('#delModal', m => m.classList.contains('open'));

try {
  /* ① iPad in landscape: open the side bar, read it, search it. */
  {
    const { ctx, page } = await open({ width: 1180, height: 820 });
    assert.equal(await page.isVisible('#filesBtn'), true, '📂 is in the worksheet toolbar');
    assert.equal(await page.isVisible('#filesPanel'), false, 'the side bar starts closed');
    await page.click('#filesBtn');
    await page.waitForTimeout(300);
    assert.equal(await page.isVisible('#filesPanel'), true, '📂 opens it');
    assert.equal(await page.getAttribute('#filesBtn', 'aria-expanded'), 'true');
    const box = await page.$eval('#filesPanel', p => { const r = p.getBoundingClientRect(); return { l: r.left, w: r.width, h: r.height }; });
    assert.ok(Math.abs(box.l) < 2 && box.w >= 300 && box.w <= 362, 'it stands at the left, ' + Math.round(box.w) + 'px wide');
    let r = await rows(page);
    assert.deepEqual(r.map(x => x.id), ['w1', 'w2', 'w3', 'w4', 'a7'], 'mine by last worked on, then the set paper not started');
    assert.ok(r[0].now, 'the open paper says so');
    assert.ok(r[0].img, 'a paper with a cover shows it');
    assert.ok(r.slice(0, 4).every(x => x.del), 'every paper of my own has a 🗑');
    assert.ok(r[4].set && !r[4].del, 'a paper set for the class and not started has Start and no 🗑');
    assert.match(r[0].meta, /P5 · Science · ✅ 14\/20/);
    assert.equal(await page.textContent('#filesCount'), '5');
    if (shots) await page.screenshot({ path: path.join(shots, 'sidebar-ipad.png') });

    await page.fill('#filesSearch', 'fraction');
    r = await rows(page);
    assert.deepEqual(r.map(x => x.id), ['w2'], 'the search finds by name');
    assert.equal(await page.textContent('#filesCount'), '1 of 5');
    await page.fill('#filesSearch', 'zzzz');
    assert.match(await page.textContent('#filesList'), /Nothing matches/);
    await page.fill('#filesSearch', '');
    await page.selectOption('#filesSort', 'name');
    r = await rows(page);
    assert.deepEqual(r.slice(0, 4).map(x => x.id), ['w2', 'w1', 'w4', 'w3'], 'Name A–Z');
    await page.selectOption('#filesSort', 'recent');

    /* ② 🗑 asks. Escape, Keep it and the backdrop delete nothing. */
    await page.click('#filesList .filesRow[data-id="w2"] .filesDel');
    assert.equal(await modalOpen(page), true, '🗑 opens the box');
    assert.equal(await page.isDisabled('#delYes'), true, 'the red button starts disarmed');
    assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), 'delNo', 'Keep it has the focus');
    assert.match(await page.textContent('#delTitle'), /Delete this worksheet\?/);
    const body = await page.textContent('#delBody');
    assert.match(body, /Fractions drill 2/);
    assert.match(body, /cannot be undone/);
    assert.match(body, /What goes/);
    assert.match(body, /The PDF you uploaded/);
    assert.match(body, /mistake book/);
    // A double tap on 🗑 lands on the box before it is armed: nothing happens.
    await page.click('#delYes', { force: true }).catch(() => {});
    assert.equal(await modalOpen(page), true, 'a tap before it is armed is not an answer');
    if (shots) await page.screenshot({ path: path.join(shots, 'confirm-ipad.png') });
    await page.keyboard.press('Escape');
    assert.equal(await modalOpen(page), false, 'Escape closes the box');
    assert.equal(await page.isVisible('#filesPanel'), true, '…and only the box');

    await page.click('#filesList .filesRow[data-id="w2"] .filesDel');
    await page.waitForTimeout(700);
    await page.click('#delNo');
    assert.equal(await modalOpen(page), false);
    await page.click('#filesList .filesRow[data-id="w2"] .filesDel');
    await page.waitForTimeout(700);
    await page.mouse.click(5, 5);    // the backdrop
    assert.equal(await modalOpen(page), false, 'a tap on the backdrop is a no');
    assert.deepEqual((await calls(page)).filter(c => c.op === 'delete' || c.op === 'file'), [], 'nothing was deleted by any no');

    /* ③ Yes deletes it, from the server, the side bar and the bookcase. */
    await page.click('#filesList .filesRow[data-id="w2"] .filesDel');
    await page.waitForTimeout(700);
    assert.equal(await page.isDisabled('#delYes'), false, 'armed after a moment');
    await page.click('#delYes');
    await page.waitForFunction(() => !document.getElementById('delModal').classList.contains('open'));
    let c = await calls(page);
    assert.ok(c.some(x => x.op === 'delete' && x.col === 'tutorWorksheets' && x.id === 'w2'), 'the document went');
    assert.ok(c.some(x => x.op === 'file' && x.id === 'tutor-worksheets/kid/w2.pdf'), 'its own PDF went');
    r = await rows(page);
    assert.ok(!r.some(x => x.id === 'w2'), 'gone from the side bar at once');
    assert.equal(await page.evaluate(() => worksheets.some(w => w.id === 'w2')), false);
    assert.match(await page.textContent('#toast'), /Deleted\./);
    assert.equal(await page.evaluate(() => view), 'ws', 'deleting another paper leaves this one open');

    /* ④ A student's copy of a set paper: the class's PDF stays. */
    await page.click('#filesList .filesRow[data-id="w3"] .filesDel');
    assert.match(await page.textContent('#delTitle'), /Delete your copy\?/);
    assert.match(await page.textContent('#delBody'), /Set for you/);
    assert.ok(!/The PDF you uploaded/.test(await page.textContent('#delBody')));
    await page.waitForTimeout(700);
    await page.click('#delYes');
    await page.waitForFunction(() => !document.getElementById('delModal').classList.contains('open'));
    c = await calls(page);
    assert.ok(c.some(x => x.op === 'delete' && x.id === 'w3'), 'the copy went');
    assert.ok(!c.some(x => x.op === 'file' && x.id === 'tutor-worksheets/teacher/a9.pdf'), 'the class\'s PDF did NOT');
    r = await rows(page);
    assert.ok(r.some(x => x.id === 'a9' && x.set), 'the paper is back as "not started", with Start');

    /* ⑤ The OPEN paper: it lets go first, so the pending auto-save never writes it back. */
    await page.evaluate(() => { setDirty(true); });   // an auto-save is now waiting
    await page.click('#filesList .filesRow[data-id="w1"] .filesDel');
    assert.match(await page.textContent('#delBody'), /open now/);
    await page.waitForTimeout(700);
    await page.click('#delYes');
    await page.waitForFunction(() => !document.getElementById('delModal').classList.contains('open'));
    await page.waitForTimeout(3200);   // past AUTOSAVE_DELAY
    c = await calls(page);
    const gone = c.find(x => x.op === 'delete' && x.id === 'w1');
    assert.ok(gone, 'the open paper was deleted');
    assert.ok(!c.some(x => x.op === 'set' && x.id === 'w1' && x.t >= gone.t), 'and nothing wrote it back');
    assert.equal(await page.evaluate(() => currentDocId), null);
    assert.equal(await page.evaluate(() => view), 'home', 'back on the bookcase');
    assert.equal(await page.isVisible('#filesPanel'), false, 'the side bar went with the worksheet');

    /* ⑥ The bookcase card's Delete is the same box. */
    const before = (await calls(page)).length;
    await page.evaluate(() => { $('homeSignedIn').classList.remove('hidden'); renderWorksheets(); });
    if (shots) await page.screenshot({ path: path.join(shots, 'bookcase-ipad.png') });
    await page.locator('#wsList .wsCardFoot .btnDanger').filter({ visible: true }).first().click();
    assert.equal(await modalOpen(page), true, 'the card\'s Delete opens the same box');
    await page.click('#delNo');
    assert.equal((await calls(page)).filter(x => x.op === 'delete').length,
                 (await calls(page)).slice(0, before).filter(x => x.op === 'delete').length, 'Keep it kept it');
    await ctx.close();
  }

  /* ⑦ A phone: the side bar is nearly the full width and every 🗑 is a 44px target. */
  {
    const { ctx, page } = await open({ width: 390, height: 844 }, { touch: true });
    await page.tap('#filesBtn');
    await page.waitForTimeout(300);
    const m = await page.evaluate(() => {
      const p = document.getElementById('filesPanel').getBoundingClientRect();
      const d = Array.from(document.querySelectorAll('.filesDel')).map(b => b.getBoundingClientRect());
      return { w: p.width, right: p.right, win: innerWidth, del: d.map(r => [Math.round(r.width), Math.round(r.height)]),
               scroll: document.documentElement.scrollWidth };
    });
    assert.ok(m.w <= m.win && m.right <= m.win + 1, 'it fits the screen');
    assert.ok(m.w >= m.win * 0.85, 'and takes most of it (' + Math.round(m.w) + ' of ' + m.win + ')');
    assert.ok(m.del.every(([w, h]) => w >= 44 && h >= 44), '🗑 is a finger-sized target: ' + JSON.stringify(m.del));
    if (shots) await page.screenshot({ path: path.join(shots, 'sidebar-phone.png') });
    await page.tap('#filesList .filesRow[data-id="w4"] .filesDel');
    await page.waitForTimeout(700);
    const card = await page.$eval('#delModal .modalCard', c => { const r = c.getBoundingClientRect(); return { l: r.left, r: r.right }; });
    assert.ok(card.l >= 0 && card.r <= 390, 'the box fits a phone');
    if (shots) await page.screenshot({ path: path.join(shots, 'confirm-phone.png') });
    await page.tap('#delNo');
    // Tapping the scrim closes the side bar.
    await page.tap('#filesClose');
    assert.equal(await page.isVisible('#filesPanel'), false);
    await ctx.close();
  }

  assert.deepEqual(errors, [], 'no page errors');
  console.log('✓ 📂 side bar and 🗑 confirmation: all checks passed');
} finally {
  await browser.close();
  server.close();
}
