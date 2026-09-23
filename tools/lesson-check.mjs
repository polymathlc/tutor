/* =====================================================================
   🎬 A VIDEO SOLUTION, RECORDED AND WATCHED — in a real browser
   ---------------------------------------------------------------------
   tools/lesson-tests.mjs pins what the source SAYS: the list's shape, the
   gates, the arithmetic, the hooks. What no reading of the source can say is
   whether a browser really records the teacher's camera, voice and writing
   into one file, whether that file comes back on a STUDENT'S copy as a ▶ on
   the page, and whether pressing it really plays the writing back in time.
   So this does all of it, with Chromium's own fake camera and microphone:

     · the teacher records a lesson named for its question, and it is saved
       as an entry on the worksheet AND on the assignment the class reads;
     · the ▶ pill is on the page, with ⋯ for the teacher and not for a child;
     · a student's copy shows it, plays it, hides their own ink under it, and
       picks up a second video the teacher adds WHILE the copy is open;
     · 🎬 plays both, one after the other;
     · the shelf card carries the 🎬 badge and the chip;
     · the teacher exports it as a 1920 × 1080 file with sound in it;
     · and deletes it, files and all.

   Like tools/browser-check.mjs it needs a real Chromium, so it is a tool you
   reach for rather than a gate:

     node tools/lesson-check.mjs
     PW=/path/to/playwright/index.mjs node tools/lesson-check.mjs
     SHOTS=/some/dir node tools/lesson-check.mjs     # keep the screenshots
   ===================================================================== */
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const PW = process.env.PW || '/opt/node22/lib/node_modules/playwright/index.mjs';
let chromium;
try { ({ chromium } = await import(PW)); }
catch (e) {
  console.log('lesson-check: no Playwright at ' + PW + ' — skipped.');
  console.log('  set PW=/path/to/playwright/index.mjs to run it.');
  process.exit(0);
}

const FILE = pathToFileURL(path.resolve(process.argv[2] || 'index.html')).href;
const SHOTS = process.env.SHOTS || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
const ok = (name, cond, note) => {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (note ? '\n      ' + note : '')); }
};
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') }); };

// A UTF-8 locale, or Chromium on a bare Linux box names every download
// "download" — the file names here carry an em dash and a middle dot.
const browser = await chromium.launch({ env: { ...process.env, LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' }, args: [
  '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ['camera', 'microphone'], acceptDownloads: true, hasTouch: true });
const page = await ctx.newPage();
await page.addInitScript(() => {
  const chain = () => new Proxy(function () { return chain(); }, {
    get: (t, k) => (k === 'then' ? undefined : chain()),
    apply: () => chain(), construct: () => chain(), set: () => true
  });
  window.pdfjsLib = chain(); window.firebase = chain(); window.grecaptcha = chain();
});
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('dialog', d => d.accept());
const downloads = [];
page.on('download', d => downloads.push(d));
await page.goto(FILE);
await page.waitForTimeout(1200);
ok('the page loads with no uncaught error', errors.length === 0, errors.join('\n      '));

/* One printed page drawn by a stand-in for pdf.js, with question numbers in
   its text layer; a Firestore and a Storage small enough to read; and the
   teacher, signed in, on their own worksheet. */
await page.evaluate(() => {
  const W = 600, H = 780;
  const pdfPage = {
    getViewport: ({ scale }) => ({ width: W * scale, height: H * scale,
      convertToViewportPoint: (x, y) => [x * scale, (H - y) * scale] }),
    render: ({ canvasContext: c, viewport }) => {
      const k = viewport.width / W;
      c.save(); c.scale(k, k);
      c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, W, H);
      c.fillStyle = '#111111'; c.font = '16px serif';
      c.fillText('4.  What is 12 x 3?', 40, 80);
      c.fillText('5.  A tank holds 24 litres. How much is in 3 tanks?', 40, 220);
      for (let y = 260; y < 700; y += 26) c.fillRect(40, y, 480, 1);
      c.restore();
      return { promise: Promise.resolve(), cancel() {} };
    },
    getTextContent: async () => ({ items: [
      { str: '4.', transform: [1, 0, 0, 1, 40, H - 80] }, { str: 'What is 12 x 3?', transform: [1, 0, 0, 1, 64, H - 80] },
      { str: '5.', transform: [1, 0, 0, 1, 40, H - 220] }, { str: 'A tank holds 24 litres.', transform: [1, 0, 0, 1, 64, H - 220] },
      { str: '(1)', transform: [1, 0, 0, 1, 90, H - 250] }] })
  };
  scheduleRaster = function () {};
  const container = document.getElementById('pagesContainer');
  container.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'pageWrap';
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  pdfPage.render({ canvasContext: canvas.getContext('2d'), viewport: pdfPage.getViewport({ scale: 1 }) });
  const svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'none' });
  svg.classList.add('overlay');
  const tag = document.createElement('div'); tag.className = 'pageNumTag'; tag.textContent = 'Page 1';
  wrap.appendChild(canvas); wrap.appendChild(svg); wrap.appendChild(tag);
  container.appendChild(wrap);
  const p = { num: 1, baseW: W, baseH: H, wrap, canvas, svg, page: pdfPage, viewport1: pdfPage.getViewport({ scale: 1 }), renderTask: null };
  pages = [p]; pdfDoc = {}; annotations = []; docName = 'P5 Maths — Tanks and Litres';
  attachOverlayHandlers(p);
  currentUser = { uid: 'teacher', email: ADMIN_EMAIL, displayName: 'Teacher', getIdToken: async () => 'token' };
  currentDocId = 'doc1'; pdfBytes = new Uint8Array([37, 80, 68, 70, 45, 49]);
  wsMeta.assignmentId = ''; wsMeta.level = 'P5'; wsMeta.subject = 'math';
  scale = 1; view = 'ws'; showView('ws');
  // ---- a Firestore small enough to read
  const store = window.__fs = {
    tutorWorksheets: { doc1: { ownerUid: 'teacher', name: 'P5 Maths — Tanks and Litres', level: 'P5', subject: 'math', videos: [], pageCount: 1 } },
    tutorAssignments: { doc1: { active: true, name: 'P5 Maths — Tanks and Litres', level: 'P5', subject: 'math', videos: [], pageCount: 1 } }
  };
  const listeners = window.__listeners = [];
  const copyOf = v => JSON.parse(JSON.stringify(v));
  const docRef = (coll, id) => ({
    id,
    get: async () => ({ exists: !!(store[coll] || {})[id], id, data: () => copyOf(store[coll][id]) }),
    update: async data => {
      if (!(store[coll] || {})[id]) throw Object.assign(new Error('No document to update: ' + coll + '/' + id), { code: 'not-found' });
      Object.assign(store[coll][id], copyOf(data));
      listeners.filter(l => l.coll === coll && l.id === id).forEach(l => l.fn({ exists: true, data: () => copyOf(store[coll][id]) }));
    },
    set: async (data, opts) => {
      store[coll] = store[coll] || {};
      store[coll][id] = (opts && opts.merge) ? Object.assign(store[coll][id] || {}, copyOf(data)) : copyOf(data);
    },
    delete: async () => { delete store[coll][id]; },
    onSnapshot: (fn, bad) => {
      const l = { coll, id, fn, bad };
      listeners.push(l);
      setTimeout(() => { if (listeners.indexOf(l) !== -1) fn({ exists: !!store[coll][id], data: () => copyOf(store[coll][id]) }); }, 0);
      return () => { const i = listeners.indexOf(l); if (i !== -1) listeners.splice(i, 1); };
    }
  });
  db = { collection: coll => ({ doc: id => docRef(coll, id),
    where: () => ({ get: async () => ({ forEach: fn => Object.keys(store[coll] || {}).forEach(k => fn({ id: k, data: () => copyOf(store[coll][k]) })) }) }) }) };
  // ---- a Storage that keeps what it is given
  window.__uploaded = {};
  window.__deleted = [];
  storage = { ref: p2 => ({ fullPath: p2,
    put: blob => { window.__uploaded[p2] = blob; return Promise.resolve(); },
    getDownloadURL: async () => URL.createObjectURL(window.__uploaded[p2]),
    delete: async () => { window.__deleted.push(p2); delete window.__uploaded[p2]; } }) };
  // The two files come back as blob: links, which the real check (Firebase
  // Storage links into a lesson folder) would refuse; lesson-tests pins it.
  lessonAssetUrl = u => u;
  lessonReadManifest = async url => JSON.parse(await (await fetch(url)).text());
  worksheets = [Object.assign({ id: 'doc1' }, store.tutorWorksheets.doc1)];
  assignments = [Object.assign({ id: 'doc1' }, store.tutorAssignments.doc1)]; assignmentsLoaded = true;
  lessonVideosOpen(worksheets[0]);
  setTool('pen');
});

console.log('\n⏺ The teacher’s own worksheet offers the recorder');
const tools0 = await page.evaluate(() => ({ group: !$('lessonTools').hidden, rec: !$('lessonRecordBtn').hidden, pl: !$('playlistBtn').hidden }));
ok('⏺ is on the toolbar for the teacher on their own worksheet', tools0.group && tools0.rec, JSON.stringify(tools0));
ok('…and 🎬 is not, with nothing to play yet', !tools0.pl);

console.log('\n🏷 The Record window guesses which question is on screen');
await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} lessonOpenModal(); });
await page.waitForFunction(() => $('lessonTitleInput').value !== '', null, { timeout: 5000 }).catch(() => {});
const guess = await page.evaluate(() => $('lessonTitleInput').value);
ok('it offers "Q4", the first question number down the margin', guess === 'Q4', JSON.stringify(guess));
const keyStops = await page.evaluate(() => {
  const before = tool;
  $('lessonTitleInput').dispatchEvent(new KeyboardEvent('keydown', { key: 'h', bubbles: true }));
  return { before, after: tool };
});
ok('a letter typed in the window never reaches the one-letter tools behind it', keyStops.after === keyStops.before, JSON.stringify(keyStops));
await page.evaluate(() => { $('lessonTitleInput').value = 'Q5'; });
await shot(page, '1-record-window');

console.log('\n⏺ A short lesson with the camera, named for its question');
await page.selectOption('#lessonCamSelect', { index: 1 });
await page.waitForFunction(() => $('lessonCamPreview').videoWidth > 0, null, { timeout: 8000 }).catch(() => {});
await page.evaluate(() => lessonStart());
await page.waitForFunction(() => lessonCapture && lessonCapture.phase === 'recording', null, { timeout: 10000 }).catch(() => {});
const recording = await page.evaluate(() => ({ phase: lessonCapture && lessonCapture.phase, bar: !$('lessonBar').hidden,
  dot: $('lessonRecordBtn').classList.contains('active'), modal: $('lessonModal').classList.contains('open'),
  preview: !!$('lessonCamPreview').srcObject, live: !!$('lessonLiveCam').srcObject }));
ok('it is recording, with the bar up and the red dot lit', recording.phase === 'recording' && recording.bar && recording.dot, JSON.stringify(recording));
ok('…and the window let go of its preview before the recording opened its own', !recording.modal && !recording.preview && recording.live, JSON.stringify(recording));
await page.evaluate(() => { annotations.push({ id: 'ink1', page: 1, type: 'pen', color: '#1565C0', width: 4, points: [{ x: 80, y: 300 }, { x: 260, y: 330 }] }); renderAllOverlays(); setDirty(true); });
await page.waitForTimeout(1100);
await page.evaluate(() => { annotations[0].points.push({ x: 420, y: 380 }, { x: 480, y: 460 }); renderAllOverlays(); setDirty(true); });
await page.waitForTimeout(1400);
await shot(page, '2-recording');
await page.evaluate(() => lessonStop());
await page.waitForFunction(() => !lessonCapture && !lessonPending && window.__fs.tutorWorksheets.doc1.videos.length === 1, null, { timeout: 15000 }).catch(() => {});
const saved = await page.evaluate(() => ({
  w: window.__fs.tutorWorksheets.doc1.videos, a: window.__fs.tutorAssignments.doc1.videos,
  files: Object.keys(window.__uploaded), bar: !$('lessonBar').hidden, toast: $('toast').textContent,
  inAnnotations: annotations.some(x => x.type === 'video' || x.lessonRecording)
}));
const v1 = saved.w[0];
ok('it is saved as ONE entry on the teacher’s worksheet', saved.w.length === 1, JSON.stringify(saved));
ok('…and the same entry on the assignment every copy reads', JSON.stringify(saved.a) === JSON.stringify(saved.w));
ok('…never as an annotation a child could erase or the marking could read', !saved.inAnnotations);
ok('…named for its question, with the camera flagged', v1 && /^Q5 · video solution · 0:0[2-4]$/.test(v1.label) &&
   v1.lessonRecording.title === 'Q5' && v1.lessonRecording.video === true, v1 && v1.label);
ok('…its two files side by side in the lesson folder the rules guard', saved.files.length === 2 &&
   saved.files.every(f => /^pdf-annotator\/lesson-doc1-/.test(f)) && saved.files.some(f => /\.json$/.test(f)), saved.files.join(', '));
ok('…and the teacher is told the class can watch it now', /Every student with this worksheet can watch it now/.test(saved.toast), saved.toast);
const manifest = await page.evaluate(async () => {
  const k = Object.keys(window.__uploaded).find(x => x.endsWith('.json'));
  return JSON.parse(await window.__uploaded[k].text());
});
ok('the replay file names the teacher’s worksheet and remembers the viewer it was taught in',
   manifest.worksheetId === 'doc1' && manifest.viewport && manifest.viewport.w > 200, JSON.stringify({ id: manifest.worksheetId, vp: manifest.viewport }));

console.log('\n▶ The pill is on the page');
const pill = await page.evaluate(() => {
  const n = document.querySelector('.pageWrap .vidPills .vidPill');
  const r = n && n.getBoundingClientRect(), wr = pages[0].wrap.getBoundingClientRect();
  return { there: !!n, text: n && n.querySelector('.vidPillText').textContent, more: !!(n && n.querySelector('.vidPillMore')),
    inside: !!r && r.left >= wr.left && r.right <= wr.right + 1 && r.top >= wr.top, h: r && r.height,
    pl: !$('playlistBtn').hidden, inOverlay: !!pages[0].svg.querySelector('.vidPill') };
});
ok('a ▶ pill beside the question, saying which one', pill.there && /^Q5 · video solution/.test(pill.text), JSON.stringify(pill));
ok('…inside the page and big enough to tap', pill.inside && pill.h >= 30, JSON.stringify(pill));
ok('…with ⋯ for the teacher', pill.more);
ok('…drawn beside the ink rather than in it', !pill.inOverlay);
ok('🎬 is on the toolbar now there is something to play', pill.pl);
await shot(page, '3-pill');

console.log('\n✥ The teacher drags the pill to where it belongs');
const moved = await page.evaluate(async () => {
  const go = document.querySelector('.vidPillGo'), r = go.getBoundingClientRect();
  const at = (type, dx, dy) => go.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 11,
    pointerType: 'mouse', isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: r.left + 20 + dx, clientY: r.top + 10 + dy }));
  at('pointerdown', 0, 0); at('pointermove', 30, 40); at('pointermove', 60, 120); at('pointerup', 60, 120);
  go.dispatchEvent(new MouseEvent('click', { bubbles: true }));   // the click that follows a drag
  await new Promise(res => setTimeout(res, 300));
  return { saved: window.__fs.tutorWorksheets.doc1.videos[0], mirror: window.__fs.tutorAssignments.doc1.videos[0], playing: !!lessonPlayback || !!lessonOpening };
});
ok('a drag moves it, and the move is saved on both documents', moved.saved.y > v1.y + 80 && moved.mirror.y === moved.saved.y,
   JSON.stringify({ was: v1.y, now: moved.saved.y, mirror: moved.mirror.y }));
ok('…and the click that ends a drag does not start the video', !moved.playing);

console.log('\n▶ The teacher replays it — and is offered ⬇ 1080p');
await page.click('.vidPillGo');
await page.waitForFunction(() => lessonPlayback && document.querySelector('.lessonReplayOverlay path'), null, { timeout: 8000 }).catch(() => {});
const replay = await page.evaluate(() => ({ on: !!lessonPlayback, video: lessonPlayback && lessonPlayback.video,
  win: !$('lessonCamWin').hidden, exportBtn: !$('lessonExportBtn').hidden, title: $('lessonPlayerTitle').textContent,
  ink: document.querySelectorAll('.lessonReplayOverlay path').length }));
ok('the replay opens with the video window up', replay.on && replay.video && replay.win, JSON.stringify(replay));
ok('…says which question it is', /^Q5 · /.test(replay.title), replay.title);
ok('…and offers ⬇ 1080p to the teacher', replay.exportBtn);
await page.waitForTimeout(1500);
await page.evaluate(() => lessonExitPlayback());

console.log('\n👩‍🎓 A student’s copy shows it, and plays it');
await page.evaluate(() => {
  // The same PDF, opened as a child's copy of the set paper.
  currentUser = { uid: 'kid', email: 'kid@example.com', displayName: 'Kid' };
  lessonRoleChanged();
  currentDocId = 'copy1'; wsMeta.assignmentId = 'doc1';
  annotations = [{ id: 'kidInk', page: 1, type: 'pen', color: '#E53935', width: 3, points: [{ x: 60, y: 600 }, { x: 300, y: 640 }] }];
  renderAllOverlays();
  assignments = [Object.assign({ id: 'doc1' }, JSON.parse(JSON.stringify(window.__fs.tutorAssignments.doc1)))];
  lessonVideosOpen({ id: 'copy1', assignmentId: 'doc1' });
});
await page.waitForTimeout(200);
const kid = await page.evaluate(() => {
  const n = document.querySelector('.vidPill');
  return { pill: !!n, more: !!(n && n.querySelector('.vidPillMore')), rec: !$('lessonRecordBtn').hidden, pl: !$('playlistBtn').hidden,
    watching: window.__listeners.filter(l => l.coll === 'tutorAssignments' && l.id === 'doc1').length };
});
ok('the pill is on the child’s copy too', kid.pill, JSON.stringify(kid));
ok('…without the teacher’s ⋯', !kid.more);
ok('…and a child is offered 🎬 and never ⏺', kid.pl && !kid.rec, JSON.stringify(kid));
ok('…and the copy follows the teacher’s list live', kid.watching === 1, String(kid.watching));
const refused = await page.evaluate(async () => { await lessonOpen(); return { modal: $('lessonModal').classList.contains('open'), toast: $('toast').textContent }; });
ok('a child cannot open the recorder, even by calling it', !refused.modal && /Only the teacher/.test(refused.toast), JSON.stringify(refused));
const renamed = await page.evaluate(async () => { const before = JSON.stringify(window.__fs.tutorWorksheets.doc1.videos); await lessonVideoRename(wsVideos[0].id); return before === JSON.stringify(window.__fs.tutorWorksheets.doc1.videos); });
ok('…nor rename or move one from the console', renamed);

await page.click('.vidPillGo');
await page.waitForFunction(() => lessonPlayback && document.querySelector('.lessonReplayOverlay path'), null, { timeout: 8000 }).catch(() => {});
await page.waitForTimeout(2200);
const kidPlay = await page.evaluate(() => {
  const ov = pages[0].svg, rp = document.querySelector('.lessonReplayOverlay');
  return { on: !!lessonPlayback, exportBtn: !$('lessonExportBtn').hidden, ownInk: getComputedStyle(ov).visibility,
    ink: rp ? rp.querySelectorAll('path').length : 0, t: lessonMedia().currentTime, pillHidden: getComputedStyle(document.querySelector('.vidPills')).visibility };
});
ok('the child plays it: the teacher’s writing appears on their page', kidPlay.on && kidPlay.ink >= 1, JSON.stringify(kidPlay));
ok('…their own ink is out of the way while it plays', kidPlay.ownInk === 'hidden' && kidPlay.pillHidden === 'hidden', JSON.stringify(kidPlay));
ok('…the clock is running', kidPlay.t > 0.5, String(kidPlay.t));
ok('…and ⬇ 1080p is not offered to a child', !kidPlay.exportBtn);
await shot(page, '4-student-replay');
await page.keyboard.press('Escape');
const escaped = await page.evaluate(() => ({ on: !!lessonPlayback, ownInk: getComputedStyle(pages[0].svg).visibility }));
ok('Escape closes it and gives the child their page back', !escaped.on && escaped.ownInk === 'visible', JSON.stringify(escaped));

console.log('\n🎬 A second video, added while the copy is open, arrives by itself');
await page.evaluate(() => {
  const first = window.__fs.tutorWorksheets.doc1.videos[0];
  const second = JSON.parse(JSON.stringify(first));
  second.id = 'second1'; second.y = first.y + 200; second.label = 'Q6 · video solution · 0:03'; second.lessonRecording.title = 'Q6';
  const both = [first, second];
  const ref = db.collection('tutorAssignments').doc('doc1');
  window.__fs.tutorWorksheets.doc1.videos = both;
  return ref.update({ videos: both });
});
await page.waitForTimeout(200);
const live = await page.evaluate(() => ({ pills: document.querySelectorAll('.vidPill').length, toast: $('toast').textContent,
  count: $('playlistBtn').querySelector('.plCount').textContent }));
ok('the second pill is on the page', live.pills === 2, JSON.stringify(live));
ok('…the child is told who added it', /has added a video solution/.test(live.toast), live.toast);
ok('…and 🎬 counts both', live.count === '2', live.count);

console.log('\n🎬 Play all: one after the other');
await page.click('#playlistBtn');
const panel = await page.evaluate(() => ({ open: !$('playlistPanel').hidden, rows: Array.from(document.querySelectorAll('#playlistList .plText b')).map(b => b.textContent),
  exports: document.querySelectorAll('#playlistList .plExport').length }));
ok('the list is in question order', panel.open && panel.rows.length === 2 && /^Q5/.test(panel.rows[0]) && /^Q6/.test(panel.rows[1]), JSON.stringify(panel));
ok('…with no ⬇ 1080p for a child', panel.exports === 0);
await page.click('#playlistAll');
await page.waitForFunction(() => lessonPlaylist && lessonPlaylist.index === 0 && lessonPlayback, null, { timeout: 8000 }).catch(() => {});
await page.waitForFunction(() => lessonPlaylist && lessonPlaylist.phase === 'next', null, { timeout: 12000 }).catch(() => {});
const upNext = await page.evaluate(() => ({ phase: lessonPlaylist && lessonPlaylist.phase, status: $('playlistStatus').textContent }));
ok('when the first ends it says what is next', upNext.phase === 'next' && /Up next in \d — 2 of 2 · Q6/.test(upNext.status), JSON.stringify(upNext));
await page.waitForFunction(() => lessonPlaylist && lessonPlaylist.index === 1 && lessonPlayback, null, { timeout: 8000 }).catch(() => {});
const second = await page.evaluate(() => ({ index: lessonPlaylist && lessonPlaylist.index, title: $('lessonPlayerTitle').textContent }));
ok('…and plays it by itself', second.index === 1 && /^Q6/.test(second.title), JSON.stringify(second));
await page.click('#lessonPlayerClose');
const stopped = await page.evaluate(() => ({ pl: !!lessonPlaylist, bar: !$('playlistBar').hidden }));
ok('closing the video ends the playlist', !stopped.pl && !stopped.bar, JSON.stringify(stopped));

console.log('\n📚 The shelf says which papers have one');
const shelf = await page.evaluate(() => {
  const own = wsCardNode({ id: 'doc1', name: 'P5 Maths', level: 'P5', subject: 'math', videos: window.__fs.tutorWorksheets.doc1.videos, pageCount: 1 });
  const set = setCardNode(Object.assign({ id: 'doc1' }, window.__fs.tutorAssignments.doc1));
  const none = wsCardNode({ id: 'doc9', name: 'Plain', level: 'P5', subject: 'math', pageCount: 1 });
  const copy = wsCardNode({ id: 'copy1', assignmentId: 'doc1', name: 'P5 Maths', level: 'P5', subject: 'math', pageCount: 1 });
  const badge = n => { const b = n.querySelector('.wsCover .vidBadge'); return b ? b.textContent : ''; };
  const chip = n => { const c = n.querySelector('.chipVideo'); return c ? c.textContent : ''; };
  return { own: [badge(own), chip(own)], set: [badge(set), chip(set)], none: [badge(none), chip(none)], copy: [badge(copy), chip(copy)] };
});
ok('the teacher’s card: a 🎬 badge on the cover and a chip', shelf.own[0] === '2' && /2 video solutions/.test(shelf.own[1]), JSON.stringify(shelf.own));
ok('the set paper on a child’s shelf carries the same', shelf.set[0] === '2' && /2 video solutions/.test(shelf.set[1]), JSON.stringify(shelf.set));
ok('…so does a copy already begun, read live off the assignment', shelf.copy[0] === '2', JSON.stringify(shelf.copy));
ok('a paper with none carries neither', !shelf.none[0] && !shelf.none[1], JSON.stringify(shelf.none));

console.log('\n⬇ The teacher exports it as a 1080p video');
await page.evaluate(() => {
  currentUser = { uid: 'teacher', email: ADMIN_EMAIL, displayName: 'Teacher' };
  lessonRoleChanged();
  currentDocId = 'doc1'; wsMeta.assignmentId = '';
  annotations = [];
  renderAllOverlays();
  worksheets = [Object.assign({ id: 'doc1' }, JSON.parse(JSON.stringify(window.__fs.tutorWorksheets.doc1)))];
  lessonVideosOpen(worksheets[0]);
});
await page.evaluate(() => lessonPillMenu(pages[0], wsVideos[0].id, document.querySelector('.vidPill')));
const menu = await page.evaluate(() => Array.from(document.querySelectorAll('.vidMenu button')).map(b => b.textContent));
ok('⋯ offers watch, rename, export and delete', menu.length === 4 && /1080p/.test(menu[2]) && /Delete/.test(menu[3]), JSON.stringify(menu));
await page.evaluate(() => document.querySelectorAll('.vidMenu button')[2].click());
await page.waitForFunction(() => lessonExportJob && lessonExportJob.phase === 'ready', null, { timeout: 15000 }).catch(() => {});
const ready = await page.evaluate(() => ({ phase: lessonExportJob && lessonExportJob.phase, open: $('lessonExportModal').classList.contains('open'),
  info: $('lessonExportInfo').textContent, layout: lessonExportJob && lessonExportJob.layoutKind }));
ok('the export window opens, ready', ready.phase === 'ready' && ready.open && /1920 × 1080/.test(ready.info), JSON.stringify(ready));
await shot(page, '5-export-window');
await page.click('#lessonExportGo');
await page.waitForFunction(() => lessonExportJob && (lessonExportJob.phase === 'done' || lessonExportJob.phase === 'failed'), null, { timeout: 40000 }).catch(() => {});
const done = await page.evaluate(() => { const j = lessonExportJob; return { phase: j && j.phase, size: j && j.blob && j.blob.size, type: j && j.blob && j.blob.type, name: j && j.name, duration: j && j.duration }; });
ok('it writes one file', done.phase === 'done' && done.size > 20000, JSON.stringify(done));
ok('…named for the worksheet and the question', /^P5 Maths — Tanks and Litres — Q5 · video solution \(1080p\)\.(mp4|webm)$/.test(done.name || ''), done.name);
const probe = await page.evaluate(async () => {
  const url = URL.createObjectURL(lessonExportJob.blob);
  const v = document.createElement('video'); v.muted = true; v.src = url;
  await new Promise((res, rej) => { v.onloadedmetadata = res; v.onerror = () => rej(new Error('unplayable')); setTimeout(res, 6000); });
  if (!isFinite(v.duration)) { v.currentTime = 1e6; await new Promise(res => { v.ontimeupdate = res; setTimeout(res, 3000); }); }
  const out = { w: v.videoWidth, h: v.videoHeight, duration: v.duration };
  try {
    const buf = await lessonExportJob.blob.arrayBuffer();
    const ac = new OfflineAudioContext(1, 48000, 48000);
    const audio = await ac.decodeAudioData(buf);
    const d = audio.getChannelData(0); let peak = 0;
    for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
    out.peak = peak;
  } catch (e) { out.audioError = String(e && e.message || e); }
  return out;
});
ok('…a 1920 × 1080 video', probe.w === 1920 && probe.h === 1080, JSON.stringify(probe));
ok('…as long as the lesson', Math.abs(probe.duration - done.duration / 1000) < 1, JSON.stringify({ file: probe.duration, lesson: done.duration }));
ok('…with the lesson’s sound in it', probe.peak > 0.01, JSON.stringify(probe));
await page.evaluate(() => lessonExportClose(true));

console.log('\n🗑 The teacher deletes one, files and all');
const deleted = await page.evaluate(async () => {
  const gone = wsVideos[0];
  await lessonVideoDelete(gone.id);
  return { w: window.__fs.tutorWorksheets.doc1.videos.map(v => v.id), a: window.__fs.tutorAssignments.doc1.videos.map(v => v.id),
    files: window.__deleted.slice(), pills: document.querySelectorAll('.vidPill').length, gone: gone.id };
});
ok('it goes from the worksheet and the assignment', deleted.w.indexOf(deleted.gone) === -1 && deleted.a.indexOf(deleted.gone) === -1 && deleted.w.length === 1, JSON.stringify(deleted));
ok('…its pill goes from the page', deleted.pills === 1);
ok('…and its two files are deleted', deleted.files.length === 2 && deleted.files.every(f => /^pdf-annotator\/lesson-/.test(f)), JSON.stringify(deleted.files));

console.log('\n🚪 Leaving the worksheet while recording saves what was recorded');
await page.evaluate(() => { lessonOpenModal(); });
await page.waitForTimeout(300);
await page.evaluate(() => { $('lessonTitleInput').value = 'Q7'; lessonDevChooseCam(''); });
await page.evaluate(() => lessonStart());
await page.waitForFunction(() => lessonCapture && lessonCapture.phase === 'recording', null, { timeout: 10000 }).catch(() => {});
await page.waitForTimeout(1500);
await page.evaluate(() => showView('home'));
await page.waitForFunction(() => !lessonCapture && !lessonPending && window.__fs.tutorWorksheets.doc1.videos.length === 2, null, { timeout: 15000 }).catch(() => {});
const left = await page.evaluate(() => ({ n: window.__fs.tutorWorksheets.doc1.videos.length,
  last: window.__fs.tutorWorksheets.doc1.videos[1], cap: !!lessonCapture }));
ok('the recording stopped and was saved from the shelf', left.n === 2 && !left.cap, JSON.stringify(left).slice(0, 300));
ok('…as a worked solution — voice and writing, no camera', left.last && /^Q7 · worked solution · 0:0[1-3]$/.test(left.last.label) && !left.last.lessonRecording.video,
   left.last && left.last.label);

ok('no uncaught error anywhere along the way', errors.length === 0, errors.join('\n      '));
console.log('\n' + (fail ? '✗ ' + fail + ' failed, ' + pass + ' passed' : '✓ all ' + pass + ' passed'));
await browser.close();
process.exit(fail ? 1 : 0);
