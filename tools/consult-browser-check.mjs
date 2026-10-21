/* =====================================================================
   🙋 THE CONSULT, END TO END, IN TWO REAL BROWSER TABS
   ---------------------------------------------------------------------
   A student tab and a teacher tab, the real index.html in both, a real
   WebRTC call between them (fake camera and microphone, no STUN), and a
   Firestore that is a Map in this process, relayed into both pages. What
   it proves, none of which reading the source can:

     • pressing 🙋 Consult writes a waiting consult and posts ONLY its id to
       the email endpoint;
     • the teacher's tab pops up a card for it without being asked;
     • Join opens the room, the call CONNECTS, and video really flows both
       ways — the student's page to the teacher, the teacher's camera to
       the student;
     • a stroke the teacher draws lands on the STUDENT'S page, in the
       consult layer, and never in `annotations`;
     • ↶ Undo takes it off again, and End ends it on both screens;
     • ✋ Not now on a ringing call asks the student for a question; they
       drag a box on their page and type it; it goes up as `question` with
       a picture, the email endpoint gets the id and nothing else, and the
       teacher's 📝 card opens the recorder, which writes, records, uploads
       and sends; the answer comes back to the student's screen to watch.

   No account, student data, paid call or production service is contacted.

     node tools/consult-browser-check.mjs
     PW=/path/to/playwright/index.mjs node tools/consult-browser-check.mjs
   ===================================================================== */
import { createServer } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const modulePath = process.env.PW || '/opt/node22/lib/node_modules/playwright/index.mjs';
let chromium;
try {
  ({ chromium } = await import(modulePath.startsWith('file:') ? modulePath : pathToFileURL(modulePath).href));
} catch (e) {
  console.log('consult-browser-check: no Playwright at ' + modulePath + ' — skipped.');
  process.exit(0);
}

let pass = 0, fail = 0;
const ok = (name, cond, note) => {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (note ? '\n      ' + note : '')); }
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms = 15000, step = 150) {
  const end = Date.now() + ms;
  let last;
  while (Date.now() < end) {
    try { last = await fn(); if (last) return last; } catch (e) { last = null; }
    await sleep(step);
  }
  return last;
}

/* ---------------- The static server ---------------- */
const server = createServer((req, res) => {
  const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  if ((file !== root && !file.startsWith(root + path.sep)) || !fs.existsSync(file)) { res.writeHead(404).end(); return; }
  const target = fs.statSync(file).isDirectory() ? path.join(file, 'index.html') : file;
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml' };
  res.setHeader('Content-Type', types[path.extname(target)] || 'application/octet-stream');
  res.end(fs.readFileSync(target));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const address = 'http://127.0.0.1:' + server.address().port + '/';

/* ---------------- The shared Firestore, as a Map ---------------- */
const store = new Map();
const listeners = new Map();      // lid -> { page, kind, path, filters: [[field, value], …] }
const clone = v => v === undefined ? undefined : JSON.parse(JSON.stringify(v));
function applyValue(old, v) {
  if (v && typeof v === 'object' && v.__op === 'union') {
    const base = Array.isArray(old) ? old.slice() : [];
    v.items.forEach(item => { if (!base.some(b => JSON.stringify(b) === JSON.stringify(item))) base.push(item); });
    return base;
  }
  if (v && typeof v === 'object' && v.__op === 'ts') return Date.now();
  return clone(v);
}
function childrenOf(coll) {
  const out = [];
  for (const [p, data] of store) {
    if (p.startsWith(coll + '/') && !p.slice(coll.length + 1).includes('/')) out.push({ id: p.slice(coll.length + 1), data: clone(data) });
  }
  return out;
}
function snapshotFor(l) {
  if (l.kind === 'doc') return { exists: store.has(l.path), id: l.path.split('/').pop(), data: clone(store.get(l.path)) };
  let docs = childrenOf(l.path);
  (l.filters || []).forEach(([f, v]) => { docs = docs.filter(d => d.data && d.data[f] === v); });
  return { docs };
}
function touched(p, l) {
  if (l.kind === 'doc') return l.path === p;
  return p.startsWith(l.path + '/') && !p.slice(l.path.length + 1).includes('/');
}
const writes = [];
function deliver(p) {
  for (const [lid, l] of listeners) {
    if (!touched(p, l)) continue;
    const snap = snapshotFor(l);
    setImmediate(() => l.page.evaluate(([id, s]) => window.__fsDeliver && window.__fsDeliver(id, s), [lid, snap]).catch(() => {}));
  }
}
async function fsCall(page, op) {
  const { kind, path: p } = op;
  if (kind === 'get') return { exists: store.has(p), id: p.split('/').pop(), data: clone(store.get(p)) };
  if (kind === 'list') return { docs: childrenOf(p) };
  if (kind === 'set') {
    const next = {};
    Object.entries(op.data || {}).forEach(([k, v]) => { next[k] = applyValue(undefined, v); });
    store.set(p, next); writes.push(['set', p]); deliver(p); return true;
  }
  if (kind === 'update') {
    if (!store.has(p)) throw new Error('No document to update: ' + p);
    const cur = store.get(p);
    Object.entries(op.data || {}).forEach(([k, v]) => { cur[k] = applyValue(cur[k], v); });
    writes.push(['update', p, Object.keys(op.data || {})]); deliver(p); return true;
  }
  if (kind === 'delete') { store.delete(p); writes.push(['delete', p]); deliver(p); return true; }
  if (kind === 'listen') {
    const l = { page, kind: op.lkind, path: p, filters: op.filters || [] };
    listeners.set(op.lid, l);
    const snap = snapshotFor(l);
    setImmediate(() => page.evaluate(([id, s]) => window.__fsDeliver && window.__fsDeliver(id, s), [op.lid, snap]).catch(() => {}));
    return true;
  }
  if (kind === 'unlisten') { listeners.delete(op.lid); return true; }
  throw new Error('unknown op ' + kind);
}

/* What runs in each page: a Firestore-shaped object over `__fs`. */
function installFake(prefix) {
  const pending = {};
  let seq = 0;
  window.__fsDeliver = (lid, snap) => {
    const fn = pending[lid];
    if (!fn) return;
    if ('exists' in snap) fn({ exists: snap.exists, id: snap.id, data: () => snap.data == null ? undefined : JSON.parse(JSON.stringify(snap.data)) });
    else fn({ docs: snap.docs.map(d => ({ id: d.id, data: () => JSON.parse(JSON.stringify(d.data)) })) });
  };
  const rand = () => { const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'; let s = ''; for (let i = 0; i < 20; i++) s += c[Math.floor(Math.random() * c.length)]; return s; };
  const docRef = p => ({
    id: p.split('/').pop(), path: p,
    collection: name => collRef(p + '/' + name),
    get: async () => { const s = await window.__fs({ kind: 'get', path: p }); return { exists: s.exists, id: s.id, data: () => s.data }; },
    set: data => window.__fs({ kind: 'set', path: p, data }),
    update: data => window.__fs({ kind: 'update', path: p, data }),
    delete: () => window.__fs({ kind: 'delete', path: p }),
    onSnapshot: (fn) => { const lid = prefix + (++seq); pending[lid] = fn; window.__fs({ kind: 'listen', lid, lkind: 'doc', path: p }); return () => { delete pending[lid]; window.__fs({ kind: 'unlisten', lid }); }; }
  });
  // Equality filters only, as many as are chained — what consult.js uses.
  const collRef = (p, filters = []) => ({
    path: p,
    doc: id => docRef(p + '/' + (id || rand())),
    where: (f, op, v) => collRef(p, filters.concat([[f, v]])),
    // The archive asks for the newest first and a ceiling; the rows are sorted
    // again by logSort, so the fake can hand them back as they are.
    orderBy: () => collRef(p, filters),
    limit: () => collRef(p, filters),
    get: async () => { const s = await window.__fs({ kind: 'list', path: p }); return { docs: s.docs.filter(d => filters.every(([f, v]) => d.data[f] === v)).map(d => ({ id: d.id, data: () => d.data })) }; },
    onSnapshot: (fn) => { const lid = prefix + (++seq); pending[lid] = fn; window.__fs({ kind: 'listen', lid, lkind: 'coll', path: p, filters }); return () => { delete pending[lid]; window.__fs({ kind: 'unlisten', lid }); }; }
  });
  // A transaction that re-reads and then writes: one process holds the Map,
  // so reading then writing in order is what a transaction would see.
  const runTransaction = async run => {
    const ups = [];
    const out = await run({
      get: r => r.get(),
      update: (r, data) => { ups.push(() => r.update(data)); },
      set: (r, data) => { ups.push(() => r.set(data)); }
    });
    for (const u of ups) await u();
    return out;
  };
  window.__fakeDb = { collection: name => collRef(name), runTransaction };
  window.firebase = window.firebase || {};
  window.firebase.firestore = window.firebase.firestore || {};
  window.firebase.firestore.FieldValue = {
    arrayUnion: (...items) => ({ __op: 'union', items }),
    serverTimestamp: () => ({ __op: 'ts' })
  };
}

/* ---------------- Two tabs ---------------- */
const browser = await chromium.launch({
  ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}),
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
    '--autoplay-policy=no-user-gesture-required', '--disable-features=WebRtcHideLocalIpsWithMdns']
});
const endpointCalls = [];
async function openTab(name) {
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 }, reducedMotion: 'reduce' });
  await context.grantPermissions(['camera', 'microphone'], { origin: address.replace(/\/$/, '') });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && process.env.CONSULT_DEBUG) console.log('   [' + name + ']', m.text()); });
  await page.route('https://**/*', async route => {
    const req = route.request();
    if (req.url().endsWith('/studyBuddyConsult')) {
      endpointCalls.push({ body: req.postDataJSON(), headers: req.headers(), from: name });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'queued' }) });
    }
    return route.abort();
  });
  await page.exposeFunction('__fs', op => fsCall(page, op));
  await page.goto(address, { waitUntil: 'load' });
  await sleep(400);
  await page.evaluate(installFake, name + '-');
  return { page, errors, context };
}

const student = await openTab('student');
const teacher = await openTab('teacher');

console.log('\n🙋 The student asks');
await student.page.evaluate(() => {
  window.__notices = [];
  window.toast = t => window.__notices.push(t);
  db = window.__fakeDb;
  libsReady = () => true;
  window.TUTOR_CONSULT_ICE = [];
  window.liveAppCheckToken = async () => 'fixture-appcheck';
  currentUser = { uid: 'kid-fixture', email: 'kid@example.invalid', displayName: 'Ada Fixture',
    getIdToken: async () => 'fixture-id-token' };
  window.stopLiveTutor = () => {};
  scheduleRaster = function () {};
  const container = document.getElementById('pagesContainer');
  container.innerHTML = '';
  pages = [];
  const W = 600, H = 800;
  const wrap = document.createElement('div');
  wrap.className = 'pageWrap';
  wrap.style.width = W + 'px'; wrap.style.height = H + 'px';
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const c = canvas.getContext('2d');
  c.fillStyle = '#fff'; c.fillRect(0, 0, W, H);
  c.fillStyle = '#000'; c.font = '28px sans-serif'; c.fillText('Question 1: 3 units = 12', 40, 80);
  const svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'none' });
  svg.classList.add('overlay');
  wrap.appendChild(canvas); wrap.appendChild(svg);
  container.appendChild(wrap);
  // A stand-in pdf.js page, so a zoom or a fit that re-rasterises has a page
  // to measure: the fixture's canvas is already drawn and is simply kept.
  const fakePdfPage = { getViewport: o => ({ width: W * (o && o.scale || 1), height: H * (o && o.scale || 1) }),
    render: () => ({ promise: Promise.resolve(), cancel() {} }) };
  const p = { num: 1, baseW: W, baseH: H, wrap, canvas, svg, renderTask: null, page: fakePdfPage };
  pages.push(p);
  attachOverlayHandlers(p);
  annotations = [];
  scale = 1; view = 'ws'; currentDocId = 'ws-fixture'; docName = 'Heat and Light';
  wsMeta.level = 'P5'; wsMeta.subject = 'science';
  showView('ws');
  window.visiblePage = () => pages[0];
  (function () {
    const Real = window.RTCPeerConnection;
    window.__pcs = [];
    window.RTCPeerConnection = function (cfg) { const pc = new Real(cfg); window.__pcs.push(pc); return pc; };
    window.RTCPeerConnection.prototype = Real.prototype;
  })();
  // The microphone is REFUSED at the press (a child who tapped Block, or a
  // prompt dismissed), and allowed afterwards: the call must ask again.
  const realGum = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  window.__gumCalls = 0; window.__streams = [];
  navigator.mediaDevices.getUserMedia = async c => {
    window.__gumCalls++;
    if (window.__gumCalls === 1) throw new DOMException('refused', 'NotAllowedError');
    const st = await realGum(c); window.__streams.push(st); return st;
  };
  TutorConsult.authChanged(currentUser);
});

const btnState = await student.page.evaluate(() => {
  const b = document.getElementById('consultBtn');
  return { count: document.querySelectorAll('#consultBtn').length, hidden: b.hidden, text: b.textContent };
});
ok('there is exactly one 🙋 Consult button', btnState.count === 1);
ok('…and a signed-in student can see it', btnState.hidden === false, JSON.stringify(btnState));

await student.page.click('#consultBtn');
const asking = await student.page.evaluate(() => {
  const p = document.getElementById('consultPanel');
  return p ? p.textContent : '';
});
ok('pressing it asks first, naming the teacher', /Ask Mr Chung for help\?/.test(asking), asking);
await student.page.click('#consultPanel button.btnPrimary');

const created = await until(() => [...store.entries()].find(([p, d]) => /^tutorConsults\/[^/]+$/.test(p) && d.status === 'waiting'));
ok('a waiting consult is written to tutorConsults', !!created);
const consultPath = created ? created[0] : '';
const consultId = consultPath.split('/')[1] || '';
const doc = created ? created[1] : {};
ok('…carrying the student, the worksheet and the page in view',
  doc.studentUid === 'kid-fixture' && doc.studentName === 'Ada Fixture' && doc.worksheetId === 'ws-fixture' &&
  doc.worksheetName === 'Heat and Light' && doc.view && doc.view.page === 1 && doc.level === 'P5', JSON.stringify(doc).slice(0, 300));
await until(() => endpointCalls.length > 0, 5000);
ok('the email endpoint is called once', endpointCalls.length === 1, JSON.stringify(endpointCalls.map(c => c.body)));
ok('…with the consult id and NOTHING else in the body',
  endpointCalls[0] && JSON.stringify(Object.keys(endpointCalls[0].body)) === '["consultId"]' && endpointCalls[0].body.consultId === consultId);
ok('…signed in and App Checked', endpointCalls[0] && endpointCalls[0].headers.authorization === 'Bearer fixture-id-token' &&
  endpointCalls[0].headers['x-firebase-appcheck'] === 'fixture-appcheck');
const waitingPanel = await until(() => student.page.evaluate(() => {
  const p = document.getElementById('consultPanel');
  return p && /emailed/.test(p.textContent) ? p.textContent : '';
}), 5000);
ok('the student is told the teacher was emailed', !!waitingPanel, waitingPanel);
ok('a refused microphone is written as off', doc.mic === false, String(doc.mic));
ok('…and the waiting panel offers to turn it on', /Turn on my microphone/.test(waitingPanel || ''), waitingPanel);
ok('the button says it is waiting', /Waiting/.test(await student.page.textContent('#consultBtn')));

console.log('\n🔔 The teacher\'s tab pops up');
await teacher.page.evaluate(() => {
  window.__notices = [];
  window.toast = t => window.__notices.push(t);
  db = window.__fakeDb;
  libsReady = () => true;
  window.TUTOR_CONSULT_ICE = [];
  currentUser = { uid: 'teacher-fixture', email: 'chungzhikai@gmail.com', displayName: 'Teacher',
    getIdToken: async () => 'fixture-admin-token' };
  TutorConsult.authChanged(currentUser);
});
await teacher.page.evaluate(() => {
  (function () {
    const Real = window.RTCPeerConnection;
    window.__pcs = [];
    window.RTCPeerConnection = function (cfg) { const pc = new Real(cfg); window.__pcs.push(pc); return pc; };
    window.RTCPeerConnection.prototype = Real.prototype;
  })();
});
const teacherBtn = await teacher.page.evaluate(() => document.getElementById('consultBtn').hidden);
ok('the teacher is not offered the student\'s button', teacherBtn === true);
const card = await until(() => teacher.page.evaluate(() => {
  const a = document.querySelector('#consultAlerts .consultAlert');
  return a ? a.textContent : '';
}), 6000);
ok('a pop-up names the student without the teacher asking', /Ada Fixture is asking for help/.test(card || ''), card);
ok('…and where they are', /P5 Science · Heat and Light · page 1/.test(card || ''), card);
ok('the tab title counts who is waiting', /^🙋 \(1\) /.test(await teacher.page.title()));

console.log('\n📹 Join connects the call');
await teacher.page.click('#consultAlerts .consultAlert button.btnPrimary');
const room = await until(() => teacher.page.evaluate(() => !!document.getElementById('consultRoom')), 5000);
ok('Join opens the consult room', !!room);
ok('…and the pop-up goes', await until(() => teacher.page.evaluate(() => !document.querySelector('#consultAlerts .consultAlert')), 3000));
const live = await until(() => store.get(consultPath) && store.get(consultPath).status === 'live' && store.get(consultPath).answer, 10000);
ok('the consult goes live with an offer and an answer', !!live);
const connected = await until(async () => {
  const t = await teacher.page.evaluate(() => TutorConsult.state().teacher.connection);
  const s = await student.page.evaluate(() => TutorConsult.state().student.connection);
  return t === 'connected' && s === 'connected' ? [t, s] : null;
}, 20000);
ok('the call CONNECTS on both sides', !!connected,
  JSON.stringify(await teacher.page.evaluate(() => TutorConsult.state().teacher)) + ' / ' +
  JSON.stringify(await student.page.evaluate(() => TutorConsult.state().student)));
const pageVideo = await until(() => teacher.page.evaluate(() => {
  const v = document.querySelector('#consultRoom video.cRemote');
  return v && v.videoWidth > 0 && v.readyState >= 2 ? v.videoWidth + 'x' + v.videoHeight : '';
}), 15000);
ok('the teacher sees the student\'s PAGE as video', !!pageVideo, String(pageVideo));
ok('…in the page\'s own shape (portrait)', !!pageVideo && Number(pageVideo.split('x')[1]) > Number(pageVideo.split('x')[0]), String(pageVideo));
const camVideo = await until(() => student.page.evaluate(() => {
  const v = document.querySelector('#consultPanel video.consultCamVideo');
  return v && v.videoWidth > 0 && v.readyState >= 2 ? v.videoWidth + 'x' + v.videoHeight : '';
}), 15000);
ok('the student sees the teacher\'s CAMERA in their panel', !!camVideo, String(camVideo));
ok('the room says it is live', /Live/.test(await teacher.page.textContent('#consultRoom .cRoomStatus')));
ok('…and names the student', /Ada Fixture/.test(await teacher.page.textContent('#consultRoom .cRoomName')));
ok('the student\'s button says who they are with', /With Mr Chung/.test(await student.page.textContent('#consultBtn')));
const channel = await until(() => teacher.page.evaluate(() => TutorConsult.state().teacher.channel === 'open'), 8000);
ok('the ink channel opens', !!channel);

console.log('\n🎤 Two-way sound');
async function audioIn(pg) {
  return pg.evaluate(async () => {
    let total = 0;
    for (const pc of window.__pcs || []) {
      if (pc.connectionState !== 'connected') continue;
      const st = await pc.getStats();
      st.forEach(r => { if (r.type === 'inbound-rtp' && r.kind === 'audio') total += r.bytesReceived || 0; });
    }
    return total;
  });
}
async function audioGrows(pg, ms) {
  const a = await audioIn(pg);
  return until(async () => { const b = await audioIn(pg); return b > a + 200 ? b - a : 0; }, ms || 8000);
}
ok('the microphone refused at the press is asked for again when the teacher joins',
  await student.page.evaluate(() => window.__gumCalls >= 2 && TutorConsult.state().student.mic === true),
  JSON.stringify(await student.page.evaluate(() => ({ calls: window.__gumCalls, s: TutorConsult.state().student }))));
ok('the TEACHER hears the student (audio arriving)', !!(await audioGrows(teacher.page)));
ok('the STUDENT hears the teacher (audio arriving)', !!(await audioGrows(student.page)));
ok('the room says the student can be heard', !!(await until(() => teacher.page.evaluate(() =>
  /can be heard/.test(document.querySelector('#consultRoom .cRoomStatus').textContent)), 5000)),
  await teacher.page.textContent('#consultRoom .cRoomStatus'));
await student.page.click('#consultPanel button.consultMute');
ok('the student muting is shown to the teacher', !!(await until(() => teacher.page.evaluate(() =>
  /is muted/.test(document.querySelector('#consultRoom .cRoomStatus').textContent)), 5000)));
await student.page.click('#consultPanel button.consultMute');
ok('…and unmuting too', !!(await until(() => teacher.page.evaluate(() =>
  /can be heard/.test(document.querySelector('#consultRoom .cRoomStatus').textContent)), 5000)));
// The device ends the capture mid-call (an iPad put away, a headset pulled
// out): the microphone comes back by itself, with no second offer.
const revBefore = store.get(consultPath).rev;
await student.page.evaluate(() => {
  const st = window.__streams[window.__streams.length - 1];
  const t = st.getAudioTracks()[0]; t.stop(); t.dispatchEvent(new Event('ended'));
});
ok('a microphone the device ended is opened again', !!(await until(() => student.page.evaluate(() =>
  window.__gumCalls >= 3 && TutorConsult.state().student.mic === true), 6000)));
ok('…and the teacher hears the student again, without a second offer',
  !!(await audioGrows(teacher.page)) && store.get(consultPath).rev === revBefore);

console.log('\n✏️ The teacher writes on the student\'s page');
const annBefore = await student.page.evaluate(() => annotations.length);
const box = await teacher.page.evaluate(() => {
  const r = document.querySelector('#consultRoom .cInk').getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
});
await teacher.page.mouse.move(box.x + box.w * 0.2, box.y + box.h * 0.3);
await teacher.page.mouse.down();
for (let i = 1; i <= 12; i++) await teacher.page.mouse.move(box.x + box.w * (0.2 + i * 0.03), box.y + box.h * (0.3 + (i % 2) * 0.02));
const livePreview = await until(() => student.page.evaluate(() => {
  const layer = document.querySelector('.pageWrap svg.consultInk');
  return layer ? layer.querySelectorAll('path[data-stroke]').length : 0;
}), 4000);
ok('the stroke appears on the student\'s page WHILE it is being written', livePreview > 0);
await teacher.page.mouse.up();
const inkDoc = await until(() => [...store.keys()].find(p => p.startsWith(consultPath + '/ink/')), 5000);
ok('the finished stroke is kept in the consult\'s ink', !!inkDoc);
const studentInk = await until(() => student.page.evaluate(() => {
  const layer = document.querySelector('.pageWrap svg.consultInk');
  if (!layer) return null;
  const path = layer.querySelector('path[data-stroke]');
  return path ? { n: layer.querySelectorAll('path[data-stroke]').length, d: path.getAttribute('d'), stroke: path.getAttribute('stroke'),
    pe: getComputedStyle(layer).pointerEvents, parent: layer.parentNode.className } : null;
}), 5000);
ok('one stroke on the student\'s page', studentInk && studentInk.n === 1, JSON.stringify(studentInk));
ok('…in the teacher\'s magenta', studentInk && studentInk.stroke.toUpperCase() === '#D81B60');
ok('…where the teacher drew it (about a fifth across, three tenths down)', (() => {
  if (!studentInk) return false;
  const m = /^M([\d.]+) ([\d.]+)/.exec(studentInk.d);
  return !!m && Math.abs(Number(m[1]) / 600 - 0.2) < 0.03 && Math.abs(Number(m[2]) / 800 - 0.3) < 0.03;
})(), studentInk && studentInk.d.slice(0, 40));
ok('…in a layer that takes no pointer', studentInk && studentInk.pe === 'none');
ok('…inside the page itself', studentInk && /pageWrap/.test(studentInk.parent));
ok('…and NEVER in the student\'s annotations', (await student.page.evaluate(() => annotations.length)) === annBefore);

// The laser: a dot the student sees and nothing written.
await teacher.page.click('#consultRoom .cMode[data-mode="laser"]');
await teacher.page.mouse.move(box.x + box.w * 0.5, box.y + box.h * 0.5);
await teacher.page.mouse.down();
await teacher.page.mouse.move(box.x + box.w * 0.52, box.y + box.h * 0.5);
const laser = await until(() => student.page.evaluate(() => !!document.querySelector('.pageWrap svg.consultInk [data-laser]')), 3000);
await teacher.page.mouse.up();
ok('the pointer shows on the student\'s page as a dot', !!laser);
ok('…and writes nothing', [...store.keys()].filter(p => p.startsWith(consultPath + '/ink/')).length === 1);
await teacher.page.click('#consultRoom .cMode[data-mode="pen"]');

console.log('\n🔍 The teacher moves the student\'s page');
const scaleBefore = await student.page.evaluate(() => scale);
await teacher.page.click('#consultRoom button[title="Zoom their page in"]');
const zoomed = await until(() => student.page.evaluate(s => scale > s + 0.01 ? scale : 0, scaleBefore), 5000);
ok('+ zooms the STUDENT\'s page in', !!zoomed, 'before ' + scaleBefore + ' after ' + zoomed);
const navNoteText = await student.page.evaluate(() => {
  const n = document.querySelector('#consultPanel .consultNav');
  return n && !n.hidden ? n.textContent : '';
});
ok('…and the student is told who moved it', /moved your page/.test(navNoteText), navNoteText);
const zoomLabel = await until(() => teacher.page.evaluate(() => {
  const z = document.querySelector('#consultRoom .cZoom');
  return z && /\d+%/.test(z.textContent) ? z.textContent : '';
}), 5000);
ok('the teacher\'s toolbar reads the student\'s zoom back', !!zoomLabel, String(zoomLabel));
await teacher.page.click('#consultRoom button[title="Zoom their page out"]');
const back = await until(() => student.page.evaluate(z => scale < z - 0.01 ? scale : 0, zoomed), 5000);
ok('− zooms it back out', !!back, String(back));
const annNav = await student.page.evaluate(() => annotations.length);
ok('…and moving the page wrote nothing on it', annNav === annBefore);
await teacher.page.click('#consultRoom .cMode[data-mode="move"]');
const inkBeforeMove = [...store.keys()].filter(p => p.startsWith(consultPath + '/ink/')).length;
await teacher.page.mouse.move(box.x + box.w * 0.5, box.y + box.h * 0.5);
await teacher.page.mouse.down();
for (let i = 1; i <= 6; i++) await teacher.page.mouse.move(box.x + box.w * 0.5, box.y + box.h * (0.5 - i * 0.03));
await teacher.page.mouse.up();
await sleep(600);
ok('✋ Move drags the page and draws nothing', [...store.keys()].filter(p => p.startsWith(consultPath + '/ink/')).length === inkBeforeMove);
await teacher.page.click('#consultRoom .cMode[data-mode="pen"]');
await teacher.page.click('#consultRoom button[title="Fit their page to the width of their screen"]');
await sleep(400);
ok('↔ Fit is obeyed without an error', student.errors.length === 0, student.errors.join(' | '));

console.log('\n📱 On a phone the panel can be moved off the question');
await student.page.setViewportSize({ width: 390, height: 700 });
await sleep(300);
const fits = await student.page.evaluate(() => {
  const r = document.getElementById('consultPanel').getBoundingClientRect();
  return { l: r.left, t: r.top, r: r.right, b: r.bottom };
});
ok('the panel stays inside a phone screen', fits.l >= 0 && fits.r <= 390 && fits.t >= 0 && fits.b <= 700, JSON.stringify(fits));
const head = await student.page.evaluate(() => {
  const h = document.querySelector('#consultPanel .consultHead');
  const r = h.getBoundingClientRect();
  return { x: r.x + 20, y: r.y + r.height / 2 };
});
await student.page.mouse.move(head.x, head.y);
await student.page.mouse.down();
for (let i = 1; i <= 8; i++) await student.page.mouse.move(head.x, head.y - i * 30);
await student.page.mouse.up();
const moved = await student.page.evaluate(() => {
  const p = document.getElementById('consultPanel');
  const r = p.getBoundingClientRect();
  return { moved: p.classList.contains('consultMoved'), t: r.top, b: r.bottom };
});
ok('dragging its heading moves it', moved.moved && moved.t < fits.t, JSON.stringify(moved));
ok('…and never off the screen', moved.t >= 0, JSON.stringify(moved));
await student.page.setViewportSize({ width: 900, height: 700 });
await sleep(200);

console.log('\n↶ Undo and End');
await teacher.page.click('#consultRoom button[title="Take back your last stroke"]');
const gone = await until(() => student.page.evaluate(() => {
  const layer = document.querySelector('.pageWrap svg.consultInk');
  return !layer || layer.querySelectorAll('path[data-stroke]').length === 0;
}), 5000);
ok('Undo takes the stroke off the student\'s page', !!gone);
ok('…and out of the consult\'s ink', ![...store.keys()].some(p => p.startsWith(consultPath + '/ink/')));

// One more stroke, so the end screen has writing to keep.
await teacher.page.mouse.move(box.x + box.w * 0.6, box.y + box.h * 0.6);
await teacher.page.mouse.down();
await teacher.page.mouse.move(box.x + box.w * 0.7, box.y + box.h * 0.65);
await teacher.page.mouse.up();
await until(() => student.page.evaluate(() => !!document.querySelector('.pageWrap svg.consultInk path[data-stroke]')), 5000);

await teacher.page.click('#consultRoom button.cEnd');
const ended = await until(() => store.get(consultPath) && store.get(consultPath).status === 'ended', 5000);
ok('End ends the consult', !!ended);
ok('…ended by the teacher', store.get(consultPath) && store.get(consultPath).endedBy === 'teacher');
ok('…the room closes', await until(() => teacher.page.evaluate(() => !document.getElementById('consultRoom')), 4000));
const endPanel = await until(() => student.page.evaluate(() => {
  const p = document.getElementById('consultPanel');
  return p && /ended the consult/.test(p.textContent) ? p.textContent : '';
}), 5000);
ok('the student is told the teacher ended it', !!endPanel, endPanel);
ok('…the call is closed on the student\'s side', (await student.page.evaluate(() => TutorConsult.state().student.connection)) === '');
ok('…and the teacher\'s writing stays on the page to work from',
  await student.page.evaluate(() => !!document.querySelector('.pageWrap svg.consultInk path[data-stroke]')));
await student.page.click('#consultPanel button.btnGhost');
ok('Clear takes the writing off', await until(() => student.page.evaluate(() => !document.querySelector('.pageWrap svg.consultInk path[data-stroke]')), 3000));
ok('…and the button goes back to Consult', /^🙋 Consult$/.test((await student.page.textContent('#consultBtn')).trim()));
ok('no pop-up is left on the teacher\'s screen', await teacher.page.evaluate(() => !document.querySelector('#consultAlerts .consultAlert')));

console.log('\n🔗 The email link');
await teacher.page.evaluate(id => TutorConsult._internals.T && 0, consultId);
const linkTab = await (async () => {
  const context = await browser.newContext({ viewport: { width: 900, height: 700 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('https://**/*', route => route.abort());
  await page.exposeFunction('__fs', op => fsCall(page, op));
  await page.goto(address + '?consult=' + consultId + '&x=1', { waitUntil: 'load' });
  await sleep(300);
  return { page, errors, context };
})();
const linkState = await linkTab.page.evaluate(() => ({ search: location.search, pending: TutorConsult._internals.pendingJoin() }));
ok('a ?consult= link is read once and taken off the address bar', linkState.search === '?x=1' && linkState.pending.length > 0, JSON.stringify(linkState));
await linkTab.page.evaluate(installFake, 'link-');
await linkTab.page.evaluate(() => {
  window.__notices = []; window.toast = t => window.__notices.push(t);
  db = window.__fakeDb; libsReady = () => true;
  currentUser = { uid: 'teacher-fixture', email: 'chungzhikai@gmail.com', getIdToken: async () => 't' };
  TutorConsult.authChanged(currentUser);
});
const linkNotice = await until(() => linkTab.page.evaluate(() => window.__notices.join(' | ')), 4000);
ok('…and joining an ended consult says so instead of opening an empty room', /already ended/.test(linkNotice || ''), linkNotice);

console.log('\n✋ Not now — the student leaves a question instead');
await student.page.click('#consultBtn');
await student.page.click('#consultPanel button.btnPrimary');
const ring2 = await until(() => [...store.entries()].find(([p, d]) => /^tutorConsults\/[^/]+$/.test(p) && p !== consultPath && d.status === 'waiting'));
ok('a second consult rings', !!ring2);
const qPath = ring2 ? ring2[0] : '';
const qId = qPath.split('/')[1] || '';
const callButtons = await until(() => teacher.page.evaluate(() => {
  const bs = [...document.querySelectorAll('#consultAlerts .consultAlert button')].map(b => b.textContent.trim());
  return bs.length ? bs : null;
}), 6000);
ok('the call card is Join · ✋ Not now · Hide', JSON.stringify(callButtons) === JSON.stringify(['Join', '✋ Not now', 'Hide']), JSON.stringify(callButtons));
await teacher.page.evaluate(() => [...document.querySelectorAll('#consultAlerts .consultAlert button')].find(b => /Not now/.test(b.textContent)).click());
ok('✋ Not now turns the call into `later`', !!(await until(() => store.get(qPath) && store.get(qPath).status === 'later', 5000)));
ok('…and its card goes', await until(() => teacher.page.evaluate(() => !document.querySelector('#consultAlerts .consultAlert')), 4000));
const picking = await until(() => student.page.evaluate(() =>
  document.body.classList.contains('consultPicking') && /Tap the page/.test(document.getElementById('consultPanel').textContent)), 5000);
ok('the student is asked to show where on the page', !!picking);
// Back to a laptop's width: at 900px Study Buddy's own side panel covers
// most of the page, and a question is asked on the page, not on that.
await student.page.setViewportSize({ width: 1200, height: 900 });
await sleep(300);
// The drag goes where the page really is on screen: the worksheet's own
// bars sit over part of it, so the box is placed in the part a finger can reach.
const wr = await student.page.evaluate(() => {
  const r = document.querySelector('.pageWrap').getBoundingClientRect();
  const inWrap = (x, y) => { const e = document.elementFromPoint(x, y); return !!(e && e.closest('.pageWrap')); };
  let top = -1, bottom = -1;
  const x = r.x + r.width * 0.3;
  for (let y = Math.max(0, r.y); y < Math.min(innerHeight, r.bottom); y += 4) {
    if (inWrap(x, y)) { if (top < 0) top = y; bottom = y; } else if (top >= 0) break;
  }
  return { x: r.x, y: r.y, w: r.width, h: r.height, top, bottom };
});
const annBeforeQ = await student.page.evaluate(() => annotations.length);
const y0 = wr.top + 20, y1 = Math.min(wr.bottom - 20, y0 + wr.h * 0.2);
const dragBox = [0.1, (y0 - wr.y) / wr.h, 0.5, (y1 - wr.y) / wr.h];
await student.page.mouse.move(wr.x + wr.w * 0.1, y0);
await student.page.mouse.down();
for (let i = 1; i <= 8; i++) await student.page.mouse.move(wr.x + wr.w * (0.1 + i * 0.05), y0 + (y1 - y0) * i / 8);
await student.page.mouse.up();
const form = await until(() => student.page.evaluate(() => {
  const st = TutorConsult.state().picking;
  return st && st.form && document.querySelector('#consultPanel textarea.consultQText') ? st : null;
}), 3000);
ok('a drag draws a box and opens the question form', !!form && Array.isArray(form.box), JSON.stringify(form));
ok('…the box is where it was dragged', !!form && form.box && form.box.every((v, i) => Math.abs(v - dragBox[i]) < 0.02),
  JSON.stringify(form && form.box) + ' vs ' + JSON.stringify(dragBox));
ok('…drawn inside the page, and nothing written in annotations', await student.page.evaluate(n =>
  !!document.querySelector('.pageWrap .consultQBox') && annotations.length === n, annBeforeQ));
await student.page.fill('#consultPanel textarea.consultQText', 'Why is 1 unit 4? <b>help</b>');
const callsBefore = endpointCalls.length;
await student.page.click('#consultPanel button.consultQSend');
const qDoc = await until(() => store.get(qPath) && store.get(qPath).status === 'question' ? store.get(qPath) : null, 6000);
ok('Send turns the consult into a `question`', !!qDoc);
ok('…with the text, the page and the box', !!qDoc && qDoc.question && qDoc.question.text === 'Why is 1 unit 4? <b>help</b>' &&
  qDoc.question.page === 1 && Array.isArray(qDoc.question.box) && qDoc.question.ws === 'ws-fixture', JSON.stringify(qDoc && qDoc.question));
const frame = store.get(qPath + '/frames/question');
ok('…and a picture of the page, box drawn on it, for the teacher', !!frame && /^data:image\/jpeg;base64,/.test(frame.img || ''));
await until(() => endpointCalls.length > callsBefore, 5000);
const qCall = endpointCalls[endpointCalls.length - 1];
ok('the email endpoint is told, with the id and NOTHING else', endpointCalls.length === callsBefore + 1 &&
  JSON.stringify(Object.keys(qCall.body)) === '["consultId"]' && qCall.body.consultId === qId, JSON.stringify(endpointCalls.slice(callsBefore).map(c => c.body)));
ok('the pick comes down and the button is Consult again', await until(() => student.page.evaluate(() =>
  !document.body.classList.contains('consultPicking') && !document.querySelector('.consultQBox') &&
  /^🙋 Consult$/.test(document.getElementById('consultBtn').textContent.trim())), 4000));

console.log('\n📝 The teacher answers it with a recording');
await teacher.page.evaluate(() => {
  window.__uploads = [];
  storage = {
    ref: path => ({
      put: (blob, meta) => {
        const task = {
          snapshot: { ref: { getDownloadURL: async () => 'https://firebasestorage.googleapis.com/v0/b/fixture/o/' + encodeURIComponent(path) + '?alt=media' } },
          on: (ev, progress, fail, done) => {
            window.__uploads.push({ path, size: blob.size, type: meta && meta.contentType });
            setTimeout(() => { progress({ bytesTransferred: blob.size, totalBytes: blob.size }); done(); }, 20);
          }
        };
        return task;
      },
      delete: async () => {}
    })
  };
});
const qCard = await until(() => teacher.page.evaluate(() => {
  const a = document.querySelector('#consultAlerts .consultAlertQ');
  return a ? a.textContent : '';
}), 6000);
ok('a 📝 card names the student and quotes the question', /Ada Fixture left a question/.test(qCard || '') && /Why is 1 unit 4\? <b>help<\/b>/.test(qCard || ''), qCard);
ok('…as text, never markup', await teacher.page.evaluate(() => !document.querySelector('#consultAlerts b b, #consultAlerts .consultAlertQText b')));
await teacher.page.evaluate(() => [...document.querySelectorAll('#consultAlerts .consultAlertQ button')].find(b => /Answer/.test(b.textContent)).click());
const win = await until(() => teacher.page.evaluate(() => {
  const w = document.querySelector('.caBack');
  return w ? w.querySelector('.caQText').textContent : '';
}), 6000);
ok('📝 Answer opens the recorder with their question', /Why is 1 unit 4/.test(win || ''), win);
const stage = await teacher.page.evaluate(() => { const r = document.querySelector('.caBack canvas.caStage').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
await teacher.page.mouse.move(stage.x + stage.w * 0.3, stage.y + stage.h * 0.3);
await teacher.page.mouse.down();
for (let i = 1; i <= 8; i++) await teacher.page.mouse.move(stage.x + stage.w * (0.3 + i * 0.03), stage.y + stage.h * 0.35);
await teacher.page.mouse.up();
ok('the pen writes in the recorder', await teacher.page.evaluate(() => ConsultAnswer._internals.state().strokes.length === 1));
await teacher.page.click('.caBack button.caRec');
await until(() => teacher.page.evaluate(() => /Stop/.test(document.querySelector('.caBack button.caRec').textContent)), 5000);
await sleep(1600);
await teacher.page.click('.caBack button.caRec');
const review = await until(() => teacher.page.evaluate(() => {
  const r = document.querySelector('.caBack .caReview');
  return r && !r.hidden;
}), 8000);
ok('⏹ Stop gives a recording to watch back', !!review);
await teacher.page.click('.caBack button.caSend');
const answered = await until(() => store.get(qPath) && store.get(qPath).status === 'answered' ? store.get(qPath) : null, 10000);
ok('Send uploads it and marks the question answered', !!answered,
  JSON.stringify(await teacher.page.evaluate(() => document.querySelector('.caBack .caStatus') && document.querySelector('.caBack .caStatus').textContent)));
const ups = await teacher.page.evaluate(() => window.__uploads);
ok('…one file, in the guarded lesson folder', ups.length === 1 && /^pdf-annotator\/lesson-consult/.test(ups[0].path) && ups[0].size > 0, JSON.stringify(ups));
ok('…and the reply is a Firebase Storage link', !!answered && answered.reply && /^https:\/\/firebasestorage\.googleapis\.com\//.test(answered.reply.url));
ok('the recorder closes', await until(() => teacher.page.evaluate(() => !document.querySelector('.caBack')), 4000));
ok('…and the 📝 card goes', await until(() => teacher.page.evaluate(() => !document.querySelector('#consultAlerts .consultAlertQ')), 4000));

console.log('\n🎬 The answer comes back to the student');
const reply = await until(() => student.page.evaluate(() => {
  const c = document.querySelector('.consultReplies .consultReply');
  return c ? c.textContent : '';
}), 6000);
ok('a card says the teacher answered, with their question', /answered your question/.test(reply || '') && /Why is 1 unit 4/.test(reply || ''), reply);
await student.page.evaluate(() => [...document.querySelectorAll('.consultReplies .consultReply button')].find(b => /Watch/.test(b.textContent)).click());
const src = await until(() => student.page.evaluate(() => {
  const v = document.querySelector('.consultReplyPlayer video.consultReplyMedia');
  return v ? v.getAttribute('src') : '';
}), 4000);
ok('▶ Watch plays the recording', !!answered && src === answered.reply.url, String(src));
await student.page.keyboard.press('Escape');
await student.page.evaluate(() => { const p = document.querySelector('.consultReplyPlayer .consultMinBtn'); if (p) p.click(); });
await student.page.evaluate(() => [...document.querySelectorAll('.consultReplies .consultReply button')].find(b => /^Done$/.test(b.textContent.trim())).click());
ok('Done marks it watched', !!(await until(() => store.get(qPath) && store.get(qPath).replySeen, 5000)));
ok('…and the card goes', await until(() => student.page.evaluate(() => !document.querySelector('.consultReplies .consultReply')), 4000));
ok('nothing the consult did is in the student\'s annotations', (await student.page.evaluate(() => annotations.length)) === annBeforeQ);

console.log('\n📚 Where it is all kept');
// The student's library: every answer the teacher sent, kept after Done.
const libBtn = await until(() => student.page.evaluate(() => { const b = document.getElementById('consultLogBtn'); return b && !b.hidden ? b.textContent : ''; }), 4000);
ok('the student has a 🎬 My answers button', /My answers/.test(libBtn || ''), libBtn);
await student.page.click('#consultLogBtn');
const libText = await until(() => student.page.evaluate(() => {
  const w = document.querySelector('.caLogBack.caLib');
  return w && !/Loading/.test(w.textContent) ? w.textContent : '';
}), 5000);
ok('…which keeps the answer after Done, with their question', /Answers \(1\)/.test(libText || '') && /Why is 1 unit 4/.test(libText || ''), libText);
await student.page.evaluate(() => [...document.querySelectorAll('.caLogBack.caLib button')].find(b => /Watch/.test(b.textContent)).click());
const libSrc = await until(() => student.page.evaluate(() => { const v = document.querySelector('.caPlayBack video.caPlayMedia'); return v ? v.getAttribute('src') : ''; }), 4000);
ok('…and ▶ Watch plays it again', !!answered && libSrc === answered.reply.url, String(libSrc));
await student.page.keyboard.press('Escape');
ok('Escape closes the player first', await until(() => student.page.evaluate(() => !document.querySelector('.caPlayBack') && !!document.querySelector('.caLogBack.caLib')), 3000));
await student.page.keyboard.press('Escape');
ok('…and then the library', await until(() => student.page.evaluate(() => !document.querySelector('.caLogBack')), 3000));
ok('a student is never shown the teacher\'s log', await student.page.evaluate(() => ConsultAnswer.openLog() === false && !document.querySelector('.caLogTeacher')));

// The teacher's log: every call and question, and the videos sent.
const logBtn = await until(() => teacher.page.evaluate(() => { const b = document.getElementById('consultLogBtn'); return b && !b.hidden ? b.textContent : ''; }), 4000);
ok('the teacher has a 🙋 Consults button', /Consults/.test(logBtn || ''), logBtn);
await teacher.page.click('#consultLogBtn');
const logAll = async () => {
  await teacher.page.evaluate(() => [...document.querySelectorAll('.caLogTeacher .caChip')].find(b => /^All/.test(b.textContent)).click());
  return until(() => teacher.page.evaluate(() => {
    const w = document.querySelector('.caLogTeacher .caLogList');
    return w && !/Loading/.test(w.textContent) ? w.textContent : '';
  }), 5000);
};
const logText = await logAll();
ok('the log lists the answered question with the video sent', /Answered · watched/.test(logText || '') && /Why is 1 unit 4/.test(logText || ''), logText);
ok('…and the call that was talked through', /Talked/.test(logText || ''), logText);
const logBtns = await teacher.page.evaluate(() => [...document.querySelectorAll('.caLogTeacher .caState-watched button')].map(b => b.textContent.trim()));
ok('…with ▶ Watch and 📝 Answer again on it', logBtns.includes('▶ Watch') && logBtns.includes('📝 Answer again'), JSON.stringify(logBtns));
await teacher.page.fill('.caLogTeacher .caSearch', 'zzzz nothing');
ok('a search that matches nothing says so', await until(() => teacher.page.evaluate(() => /Nothing matches/.test(document.querySelector('.caLogTeacher .caLogList').textContent)), 3000));
await teacher.page.fill('.caLogTeacher .caSearch', 'unit ada');
ok('…and every word of a search must match', await until(() => teacher.page.evaluate(() => document.querySelectorAll('.caLogTeacher .caLogRow').length === 1), 3000));
await teacher.page.keyboard.press('Escape');
ok('Escape closes the log', await until(() => teacher.page.evaluate(() => !document.querySelector('.caLogBack')), 3000));
ok('…and nothing the archive did is in the student\'s annotations', (await student.page.evaluate(() => annotations.length)) === annBeforeQ);

console.log('\n🧯 Nothing threw');
ok('no uncaught error in the student\'s tab', student.errors.length === 0, student.errors.join('\n      '));
ok('no uncaught error in the teacher\'s tab', teacher.errors.length === 0, teacher.errors.join('\n      '));
ok('no uncaught error in the link tab', linkTab.errors.length === 0, linkTab.errors.join('\n      '));

await browser.close();
server.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
