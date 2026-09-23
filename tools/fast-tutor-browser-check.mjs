/* Real-browser fast-tutor checks. All authentication, worksheet content and
   network responses are fixtures; no microphone or paid model is contacted. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const modulePath = process.env.PW || '/opt/node22/lib/node_modules/playwright/index.mjs';
const { chromium } = await import(modulePath.startsWith('file:') ? modulePath : pathToFileURL(modulePath).href);
const browser = await chromium.launch({ ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
const requests = [], held = new Map();
let sequence = 0, replyMode = 'complete';
const englishFirst = 'Look at the three equal groups. Think';
const englishWhole = 'Look at the three equal groups. Think about how to find the amount in one group.';
let first = englishFirst, whole = englishWhole;
const result = { route: 'prepared', questionId: 'q1', responseId: 'q1-nudge-1', cacheKey: 'fixture-cache' };
const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/test-fast') {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw);
    const entry = { id: ++sequence, body, headers: req.headers, closed: false };
    requests.push(entry);
    res.on('close', () => { entry.closed = true; held.delete(entry.id); });
    if (body.action === 'prepare') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ ready: true, cacheKey: 'fixture-cache', questions: [{ id: 'q1', label: 'Question 1' }] }));
      return;
    }
    if (body.preparedOnly && replyMode === 'prepared-miss') {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { code: 'fresh_image_required', message: 'Please send the current worksheet page for this question.' } }));
      return;
    }
    if (replyMode === 'refuse') {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { code: 'unavailable', message: 'Test service unavailable.' } }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store' });
    res.flushHeaders();
    const line = value => res.write(JSON.stringify(value) + '\n');
    const finish = () => { line({ type: 'delta', text: whole }); line({ type: 'done', text: whole, ...result }); res.end(); };
    if (replyMode === 'held' || replyMode === 'partial-error') {
      line({ type: 'delta', text: first });
      held.set(entry.id, replyMode === 'partial-error' ? () => {
        line({ type: 'error', error: { code: 'unavailable', message: 'Test stream interrupted.' } }); res.end();
      } : finish);
    } else if (replyMode === 'before-text') held.set(entry.id, finish);
    else finish();
    return;
  }
  const file = path.resolve(root, '.' + pathname);
  if ((file !== root && !file.startsWith(root + path.sep)) || !fs.existsSync(file)) { res.writeHead(404).end(); return; }
  const target = fs.statSync(file).isDirectory() ? path.join(file, 'index.html') : file;
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp' };
  res.setHeader('Content-Type', types[path.extname(target)] || 'application/octet-stream');
  res.end(fs.readFileSync(target));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const address = 'http://127.0.0.1:' + server.address().port;
const context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, hasTouch: true, reducedMotion: 'reduce' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.route('https://**/*', route => route.abort());

async function installFixture() {
  await page.evaluate(endpoint => {
    window.__sent = [];
    window.__fallback = [];
    window.__done = false;
    window.__failure = '';
    if (typeof fastTutorReset === 'function') { fastTutorReset(); fastTutorState.client = null; FAST_TUTOR_ENDPOINT = endpoint; }
    currentUser = { uid: 'fast-fixture-user', email: 'fixture@example.invalid', getIdToken: async () => 'fixture-token' };
    myStudents = [{ name: 'Test Learner', level: 'P5', subject: 'math' }];
    _activeIdx = 0;
    window.liveAppCheckToken = async () => 'fixture-appcheck';
    window.aiReady = () => true;
    window.__cost = { notes: 0, key: 0, raster: 0, jpeg: 0, encode: 0, hash: 0 };
    loadTeachingNotes = async () => {
      window.__cost.notes++;
      // Match the real listener handoff when the teacher notebook changes.
      if (notesWatching && notesWatching !== notesOwner()) {
        notesWatching = notesOwner(); _notesAttachSeq++; teachingNotes = [];
      }
    };
    keyEnsureReady = async () => { window.__cost.key++; };
    renderPageCanvas = () => {};
    scheduleRaster = () => {};
    kwQuizForLive = () => {};
    mthAfterLive = () => {};
    const container = $('pagesContainer');
    container.replaceChildren();
    const wrap = document.createElement('div');
    wrap.className = 'pageWrap';
    wrap.style.width = '600px'; wrap.style.height = '800px';
    const canvas = document.createElement('canvas');
    canvas.width = 600; canvas.height = 800;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 600, 800);
    ctx.fillStyle = 'black'; ctx.font = '24px sans-serif';
    ctx.fillText('Question 1: Three equal groups contain 12 beads.', 30, 100);
    ctx.fillText('How many beads are in each group?', 30, 145);
    const svg = el('svg', { viewBox: '0 0 600 800', preserveAspectRatio: 'none' });
    svg.classList.add('overlay');
    wrap.append(canvas, svg); container.append(wrap);
    pages = [{ num: 1, baseW: 600, baseH: 800, wrap, canvas, svg, renderTask: null }];
    attachOverlayHandlers(pages[0]);
    annotations = []; editingId = selectedId = null;
    teachingNotes = []; aiStyle = cerStyle = null;
    notesOwnerUid = 'fixture-teacher'; notesLoaded = true; notesLoading = null; notesBusy = false;
    notesWatching = notesOwner(); _notesUnsub = () => {}; _notesPending = [];
    wsKey = { pages: [], rows: [], scanned: true, scanVersion: 2, scanPending: false };
    wsMeta = { level: 'P5', subject: 'math', school: '', topic: 'Equal groups', guidance: 'nudge', assignmentId: '', setBy: '', guidanceLocked: true };
    scale = 1; view = 'ws'; currentDocId = 'fast-browser-fixture'; wsEpoch++;
    showView('ws'); openBuddy('live');
    window.__endpoint = endpoint;
    window.askGemini = async (prompt, opts) => {
      window.__fallback.push({ prompt, system: opts.system });
      return 'Read the question and identify what you need to find.';
    };
  }, address + '/test-fast');
}

async function startClientReply(message = 'Help with question 1.', key = 'fixture-context') {
  await page.evaluate(({ message, key }) => {
    window.__done = false; window.__failure = null; window.__deltas = [];
    window.__controller = new AbortController();
    window.__task = window.__client.reply({ worksheetId: currentDocId, page: 1, studentIndex: 0,
      grounding: 'Only a nudge; never disclose the answer.', image: window.__image, workContext: '', message }, key, {
      signal: window.__controller.signal,
      onStream: text => window.__deltas.push(text)
    }).then(value => { window.__result = value; window.__done = true; }, error => {
      window.__failure = { name: error.name, emitted: !!error.emitted, message: error.message };
      window.__done = true;
    });
  }, { message, key });
}

async function finished() { await page.waitForFunction(() => window.__done); }
function releaseHeld() {
  const [id, finish] = held.entries().next().value || [];
  assert.ok(finish, 'a fixture response is waiting for permission to complete');
  held.delete(id); finish();
}

async function startLiveReply(message, id, keep = false) {
  await page.evaluate(({ message, id, keep }) => {
    clearTimeout(fastTutorState.timer); fastTutorState.timer = null;
    if (!keep) {
      window.__sent = []; window.__fallback = []; window.__liveTasks = {};
      liveTutor.generation++; liveTutor.phase = 'live'; liveTutor.epoch = wsEpoch;
      liveTutor.worksheetId = currentDocId; liveTutor.guidance = wsMeta.guidance;
      liveTutor.delegations = new Set(); liveTutor.pendingDelegation = null; liveTutor.working = false;
      liveTutor.checkController = null; liveTutor.contextSnapshot = null;
      liveTutor.channel = { readyState: 'open', send: value => window.__sent.push(JSON.parse(value)), close() { this.readyState = 'closed'; } };
    }
    liveTutor.transcript = [{ who: 'student', text: message, start: Date.now(), end: Date.now() + 1 }];
    window.__liveTasks[id] = { done: false };
    runLiveDelegation(id, liveTutor.generation).then(() => { window.__liveTasks[id].done = true; }, error => {
      window.__liveTasks[id] = { done: true, error: error.message };
    });
  }, { message, id, keep });
}
async function liveFinished(id) { await page.waitForFunction(id => window.__liveTasks[id]?.done, id); }
async function spoken(id) { return page.evaluate(id => window.__sent.filter(x => x.type === 'session.commentary.append' && x.delegation_id === id).map(x => x.content), id); }
async function waitForRequest(predicate) {
  const until = Date.now() + 5000;
  while (!requests.some(predicate)) {
    assert.ok(Date.now() < until, 'the expected fixture network request was sent');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}
async function resetCost() {
  await page.evaluate(() => {
    clearTimeout(fastTutorState.timer); fastTutorState.timer = null;
    window.__cost = { notes: 0, key: 0, raster: 0, jpeg: 0, encode: 0, hash: 0 };
  });
}
async function cost() { return page.evaluate(() => window.__cost); }
function assertNoImage(body, label) {
  assert.equal(Boolean(body.image || body.images?.length), false, label + ' does not upload a worksheet image');
}
async function assertNoPreparation(label) {
  assert.deepEqual(await cost(), { notes: 0, key: 0, raster: 0, jpeg: 0, encode: 0, hash: 0 }, label + ' skips note/key waits, rasterisation, image encoding and hashing');
}

try {
  await page.goto(address, { waitUntil: 'load' });
  assert.deepEqual(errors, [], 'the complete app loads without uncaught errors');
  await installFixture();
  // Tests below exercise the production client and live delegation together.
  assert.equal(await page.locator('#lessonVideo').count(), 1, 'recorded video player remains available');
  assert.equal(await page.locator('#stylusBtn').count(), 1, 'worksheet pen controls remain available');
  assert.equal(await page.locator('.pageWrap canvas').first().evaluate(canvas => canvas.width), 600, 'worksheet raster remains available');
  assert.deepEqual(errors, [], 'fixture setup leaves worksheet and video UI intact');
  if (!(await page.evaluate(() => !!window.FastTutorClient))) await page.addScriptTag({ url: address + '/fast-tutor.js' });
  await page.evaluate(() => {
    const raster = ensurePageRaster, jpeg = pageJpegForModel, encode = HTMLCanvasElement.prototype.toDataURL, hash = FastTutorClient.sha256;
    ensurePageRaster = function (...args) { window.__cost.raster++; return raster.apply(this, args); };
    pageJpegForModel = function (...args) { window.__cost.jpeg++; return jpeg.apply(this, args); };
    HTMLCanvasElement.prototype.toDataURL = function (...args) { window.__cost.encode++; return encode.apply(this, args); };
    FastTutorClient.sha256 = function (...args) { window.__cost.hash++; return hash.apply(this, args); };
  });
  await page.evaluate(() => {
    window.__image = pages[0].canvas.toDataURL('image/jpeg');
    window.__client = FastTutorClient.create({ endpoint: window.__endpoint, headers: async () => ({
      'Content-Type': 'application/json', Authorization: 'Bearer fixture-token', 'X-Firebase-AppCheck': 'fixture-appcheck'
    }) });
  });

  const prepStart = requests.length;
  const handles = await page.evaluate(async () => {
    const body = { worksheetId: currentDocId, page: 1, studentIndex: 0,
      grounding: 'Only a nudge; never disclose the answer.', image: window.__image, workContext: '' };
    return Promise.all([window.__client.prepare(body, 'fixture-context'), window.__client.prepare(body, 'fixture-context')]);
  });
  assert.equal(requests.length - prepStart, 1, 'simultaneous warm-ups prepare a page once');
  assert.deepEqual(handles[0], handles[1], 'warm-ups share the same prepared handle');
  assert.deepEqual(Object.keys(handles[0]).sort(), ['cacheKey', 'questions'], 'background preparation does not disclose a hint bank or complete answers');
  assert.equal(requests.at(-1).headers.authorization, 'Bearer fixture-token');
  assert.equal(requests.at(-1).headers['x-firebase-appcheck'], 'fixture-appcheck');

  replyMode = 'held';
  await startClientReply();
  await page.waitForFunction(() => window.__deltas.length > 0);
  assert.equal(await page.evaluate(() => window.__done), false, 'first text arrives while the network response is still open');
  assert.equal(requests.at(-1).body.cacheKey, 'fixture-cache', 'warm preparation is reused');
  releaseHeld();
  await finished();
  assert.equal(await page.evaluate(() => window.__result.text), whole, 'the streamed tail is retained');
  assert.equal(await page.evaluate(() => window.__failure), null);

  const beforeRepeat = requests.length;
  await startClientReply('Repeat that please.'); await finished();
  assert.equal(requests.length, beforeRepeat, 'repeat requires no network round trip');
  assert.equal(await page.evaluate(() => window.__result.route), 'repeat');
  assert.equal(await page.evaluate(() => window.__result.text), whole);

  replyMode = 'complete';
  await startClientReply('Next hint please.'); await finished();
  assert.equal(requests.at(-1).body.questionId, 'q1', 'next hint remains bound to the identified question');
  assert.equal(requests.at(-1).body.afterResponseId, 'q1-nudge-1', 'next hint carries the previously delivered step');

  await startClientReply('Is my working correct?'); await finished();
  assert.equal(requests.at(-1).body.forceFresh, true, 'checking student work requests fresh reasoning');
  await startClientReply('Repeat that please.', 'a-different-worksheet-context'); await finished();
  assert.equal(requests.at(-1).body.forceFresh, true, 'a changed worksheet cannot replay the previous answer');

  replyMode = 'before-text';
  await startClientReply('Help with question 2.', 'abort-fixture');
  await page.waitForFunction(() => window.__controller && !window.__done);
  await page.evaluate(() => window.__controller.abort()); await finished();
  assert.equal(await page.evaluate(() => window.__failure.name), 'AbortError', 'interruption cancels the active network request');
  assert.equal(await page.evaluate(() => window.__deltas.length), 0, 'an interrupted request does not provide stale text');

  replyMode = 'partial-error';
  await startClientReply('Help with question 1.', 'error-fixture');
  await page.waitForFunction(() => window.__deltas.length > 0);
  releaseHeld(); await finished();
  assert.equal(await page.evaluate(() => window.__failure.emitted), true, 'stream failures report that speech already started');

  replyMode = 'refuse';
  await startClientReply('Help with question 1.', 'refused-fixture'); await finished();
  assert.equal(await page.evaluate(() => window.__failure.emitted), false, 'pre-stream failures allow a clean fallback');

  replyMode = 'complete';
  await page.evaluate(() => window.__client.reset());
  const beforeResetRepeat = requests.length;
  await startClientReply('Repeat that please.'); await finished();
  assert.equal(requests.length - beforeResetRepeat, 1, 'reset discards all previous-account reply state');
  assert.equal(requests.at(-1).body.cacheKey, undefined, 'reset discards prepared handles');

  // Run the same transport through the real worksheet-to-voice integration.
  await page.evaluate(async () => {
    fastTutorReset();
    await fastTutorPrepareNext();
    clearTimeout(fastTutorState.timer); fastTutorState.timer = null;
  });
  assert.equal(requests.at(-1).body.action, 'prepare', 'worksheet warm-up reaches the authenticated preparation endpoint');
  assert.match(requests.at(-1).body.grounding, /HELP LEVEL.*NUDGE/, 'preparation keeps the worksheet help ceiling');
  assert.match(requests.at(-1).body.grounding, /MATHEMATICS TEACHING METHOD/, 'preparation retains arithmetic teaching preferences');
  assert.match(requests.at(-1).body.image, /^data:image\/jpeg;base64,/, 'preparation includes the real page raster');
  assert.equal(await page.locator('#livePreparation').isVisible(), true, 'preparation status is available on the live card');

  replyMode = 'held';
  await startLiveReply('Help with question 1.', 'live-first');
  await page.waitForFunction(() => window.__sent.some(x => x.type === 'session.commentary.append'));
  assert.equal(await page.evaluate(() => window.__liveTasks['live-first'].done), false, 'first useful speech is dispatched before model completion');
  assert.deepEqual(await spoken('live-first'), ['Look at the three equal groups.']);
  assert.equal(requests.at(-1).body.cacheKey, 'fixture-cache', 'live speech uses the worksheet warm-up');
  releaseHeld(); await liveFinished('live-first');
  assert.equal((await spoken('live-first')).join(' '), whole, 'live speech delivers the complete reply without duplication');
  assert.equal(await page.evaluate(() => window.__fallback.length), 0);

  const liveRepeatStart = requests.length;
  await resetCost();
  await startLiveReply('Repeat that please.', 'live-repeat'); await liveFinished('live-repeat');
  assert.equal(requests.length, liveRepeatStart, 'the actual live tutor repeats immediately without a model call');
  assert.equal((await spoken('live-repeat')).join(' '), whole);
  await assertNoPreparation('Local repeat');

  replyMode = 'complete';
  await resetCost();
  await startLiveReply('Next hint please.', 'live-next'); await liveFinished('live-next');
  assert.equal(requests.at(-1).body.questionId, 'q1');
  assert.equal(requests.at(-1).body.afterResponseId, 'q1-nudge-1');
  assert.equal(requests.at(-1).body.preparedOnly, true, 'next hint uses the early prepared lookup');
  assertNoImage(requests.at(-1).body, 'Prepared next hint');
  await assertNoPreparation('Prepared next hint');

  for (const [message, id] of [
    ['Could you give me another clue please?', 'live-clue'],
    ['Can you explain that more simply?', 'live-simpler']
  ]) {
    const start = requests.length;
    await resetCost(); await startLiveReply(message, id); await liveFinished(id);
    assert.equal(requests.length - start, 1, 'a safe natural request performs one prepared lookup: ' + message);
    assert.equal(requests.at(-1).body.preparedOnly, true, 'the shared classifier recognises: ' + message);
    assertNoImage(requests.at(-1).body, message);
    await assertNoPreparation(message);
  }
  const naturalRepeatStart = requests.length;
  await resetCost(); await startLiveReply('Could you repeat that please?', 'live-natural-repeat'); await liveFinished('live-natural-repeat');
  assert.equal(requests.length, naturalRepeatStart, 'a natural repeat request also avoids the network');
  await assertNoPreparation('Natural repeat');

  replyMode = 'prepared-miss';
  const beforeMiss = requests.length;
  await resetCost(); await startLiveReply('Next hint please.', 'live-prepared-miss'); await liveFinished('live-prepared-miss');
  const missed = requests.slice(beforeMiss).filter(x => x.body.action === 'reply');
  assert.equal(missed.length, 2, 'a prepared miss performs one lookup and one full teaching request');
  assert.equal(missed[0].body.preparedOnly, true); assertNoImage(missed[0].body, 'Missed prepared lookup');
  assert.notEqual(missed[1].body.preparedOnly, true);
  assert.match(missed[1].body.image, /^data:image\/jpeg;base64,/, 'a miss resumes with the current worksheet image');
  assert.equal((await cost()).raster, 1, 'a prepared miss rasterises the page only once');
  assert.equal((await cost()).jpeg, 1, 'a prepared miss composites the worksheet only once');
  assert.equal(await page.evaluate(() => window.__fallback.length), 0, 'a prepared miss stays on the streaming tutor');

  replyMode = 'complete';
  for (const [message, id] of [
    ['Next hint please, but my answer is 12.', 'live-mixed-answer'],
    ['Could you explain why equal groups matter?', 'live-unmatched']
  ]) {
    const start = requests.length;
    await resetCost(); await startLiveReply(message, id); await liveFinished(id);
    const asks = requests.slice(start).filter(x => x.body.action === 'reply');
    assert.equal(asks.length, 1, 'an unmatched or mixed request bypasses speculative lookup: ' + message);
    assert.notEqual(asks[0].body.preparedOnly, true);
    assert.match(asks[0].body.image, /^data:image\/jpeg;base64,/, 'an unmatched or mixed request includes current working');
    if (id === 'live-mixed-answer') assert.equal(asks[0].body.forceFresh, true, 'a shortcut phrase cannot hide a supplied answer');
  }

  replyMode = 'before-text';
  const beforeLookupInterrupt = sequence;
  await resetCost(); await startLiveReply('Next hint please.', 'live-lookup-interrupt');
  await waitForRequest(x => x.id > beforeLookupInterrupt && x.body.preparedOnly);
  await page.evaluate(() => handleLiveEvent({ type: 'session.input_transcript.delta', delta: 'Actually, I mean a different question.', start_ms: Date.now(), end_ms: Date.now() + 1 }, liveTutor.generation));
  await liveFinished('live-lookup-interrupt');
  assert.deepEqual(await spoken('live-lookup-interrupt'), [], 'an interrupted prepared lookup never speaks stale guidance');
  await assertNoPreparation('Interrupted prepared lookup');
  assert.equal(await page.evaluate(() => window.__fallback.length), 0);

  replyMode = 'partial-error';
  const beforeLookupPartial = sequence;
  await resetCost(); await startLiveReply('Next hint please.', 'live-lookup-partial');
  await page.waitForFunction(() => window.__sent.some(x => x.type === 'session.commentary.append'));
  assert.ok(requests.some(x => x.id > beforeLookupPartial && x.body.preparedOnly), 'partial response test uses the early lookup');
  releaseHeld(); await liveFinished('live-lookup-partial');
  assert.equal(await page.evaluate(() => window.__fallback.length), 0, 'a prepared lookup never starts a fallback after speech begins');
  await assertNoPreparation('Partially spoken prepared lookup');

  // Cached text is reusable only for exactly the same pupil, page, working,
  // teacher references and help limit, after those references have settled.
  for (const kind of ['working', 'page', 'worksheet', 'student', 'guidance', 'notes', 'style', 'correction-style', 'teacher', 'user']) {
    await installFixture(); replyMode = 'complete';
    await startLiveReply('Help with question 1.', 'seed-' + kind); await liveFinished('seed-' + kind);
    await page.evaluate(kind => {
      if (kind === 'working') annotations.push({ id: 'new-working', type: 'text', page: 1, x: 20, y: 200, w: 120, text: '12 + 3 = 15' });
      if (kind === 'page') pages[0].num = 2;
      if (kind === 'worksheet') { currentDocId = 'another-fixture-worksheet'; wsEpoch++; }
      if (kind === 'student') _activeIdx = 1;
      if (kind === 'guidance') wsMeta.guidance = 'concepts';
      if (kind === 'notes') teachingNotes = [{ id: 'changed-note', guidance: 'Use a revised teaching preference.' }];
      if (kind === 'style') aiStyle = { edits: [{ q: 'Question 1', better: 'Use a revised explanation.', subject: 'math' }] };
      if (kind === 'correction-style') cerStyle = { v: 2, edits: [{ q: 'Question 1', better: 'Follow the updated correction.', subject: 'math' }] };
      if (kind === 'teacher') notesOwnerUid = 'another-fixture-teacher';
      if (kind === 'user') currentUser = { uid: 'another-fixture-account', getIdToken: async () => 'another-fixture-token' };
    }, kind);
    const start = requests.length;
    await resetCost(); await startLiveReply('Repeat that please.', 'cache-changed-' + kind); await liveFinished('cache-changed-' + kind);
    const asks = requests.slice(start).filter(x => x.body.action === 'reply');
    assert.equal(asks.length, 1, kind + ' changes prevent local replay of the previous explanation');
    assert.notEqual(asks[0].body.preparedOnly, true, kind + ' changes skip the cached-only shortcut');
    assert.match(asks[0].body.image, /^data:image\/jpeg;base64,/, kind + ' changes require the current worksheet image');
    assert.equal((await cost()).raster, 1, kind + ' changes pass through page preparation once');
  }

  for (const kind of ['notes', 'key']) {
    await installFixture(); replyMode = 'complete';
    await startLiveReply('Help with question 1.', 'seed-pending-' + kind); await liveFinished('seed-pending-' + kind);
    await page.evaluate(kind => {
      const pending = new Promise(resolve => { window.__resolveReference = resolve; });
      if (kind === 'notes') {
        notesLoading = pending;
        loadTeachingNotes = async () => { window.__cost.notes++; await pending; };
      } else {
        wsKey.reading = true;
        keyEnsureReady = async () => { window.__cost.key++; await pending; };
      }
    }, kind);
    await resetCost(); await startLiveReply('Repeat that please.', 'pending-' + kind);
    await page.waitForFunction(kind => window.__cost[kind] > 0, kind);
    assert.equal(await page.evaluate(kind => window.__liveTasks['pending-' + kind].done, kind), false, 'repeat waits while ' + kind + ' are being refreshed');
    assert.deepEqual(await spoken('pending-' + kind), [], 'pending ' + kind + ' cannot expose cached guidance early');
    await page.evaluate(kind => { if (kind === 'notes') notesLoading = null; else wsKey.reading = false; window.__resolveReference(); }, kind);
    await liveFinished('pending-' + kind);
    assert.equal((await spoken('pending-' + kind)).join(' '), whole, 'teaching resumes after ' + kind + ' settle');
  }

  await installFixture(); replyMode = 'complete';
  await startLiveReply('Help with question 1.', 'seed-different-question'); await liveFinished('seed-different-question');
  const differentQuestionStart = requests.length;
  await startLiveReply('Repeat that for question 2.', 'live-different-question'); await liveFinished('live-different-question');
  assert.equal(requests.length - differentQuestionStart, 1, 'naming a different question cannot locally replay the old question');

  replyMode = 'refuse';
  await startLiveReply('Help with question 2.', 'live-fallback'); await liveFinished('live-fallback');
  assert.equal(await page.evaluate(() => window.__fallback.length), 1, 'a refusal before any streamed text uses the existing tutor');
  assert.match((await spoken('live-fallback')).join(' '), /identify what you need to find/);

  replyMode = 'partial-error';
  await startLiveReply('Help with question 2.', 'live-partial');
  await page.waitForFunction(() => window.__sent.some(x => x.type === 'session.commentary.append'));
  releaseHeld(); await liveFinished('live-partial');
  assert.equal(await page.evaluate(() => window.__fallback.length), 0, 'a partial spoken explanation never starts a different model response');
  assert.equal((await spoken('live-partial')).filter(x => x === 'Look at the three equal groups.').length, 1);

  replyMode = 'before-text';
  const beforeInterrupt = sequence;
  await startLiveReply('Help with question 1.', 'live-obsolete');
  await waitForRequest(x => x.id > beforeInterrupt && x.body.action === 'reply');
  replyMode = 'complete';
  await startLiveReply('I mean question 2.', 'live-new', true);
  await liveFinished('live-obsolete');
  await page.waitForFunction(() => !liveTutor.working && window.__sent.some(x => x.delegation_id === 'live-new' && x.type === 'session.commentary.append'));
  assert.deepEqual(await spoken('live-obsolete'), [], 'a newer question cancels the obsolete response before it speaks');
  assert.equal((await spoken('live-new')).join(' '), whole);
  assert.equal(await page.evaluate(() => window.__fallback.length), 0);

  await installFixture();
  first = '请先看看题目一共有多少组，并注意每一组的数量是不是相同。接下来';
  whole = '请先看看题目一共有多少组，并注意每一组的数量是不是相同。接下来再找出题目要求的数量。';
  replyMode = 'held';
  await startLiveReply('第一题怎么开始？', 'live-chinese');
  await page.waitForFunction(() => window.__sent.some(x => x.type === 'session.commentary.append'));
  assert.equal(await page.evaluate(() => window.__liveTasks['live-chinese'].done), false, 'Chinese guidance starts before the complete response arrives');
  assert.deepEqual(await spoken('live-chinese'), ['请先看看题目一共有多少组，并注意每一组的数量是不是相同。']);
  releaseHeld(); await liveFinished('live-chinese');
  assert.equal((await spoken('live-chinese')).join(''), whole, 'Chinese speech retains its final sentence');
  first = englishFirst; whole = englishWhole;

  await installFixture();
  const visiblePages = await page.evaluate(() => {
    const firstPage = pages[0];
    firstPage.baseH = 240; firstPage.wrap.style.height = '240px';
    firstPage.svg.setAttribute('viewBox', '0 0 600 240');
    const wrap = document.createElement('div');
    wrap.className = 'pageWrap'; wrap.style.width = '600px'; wrap.style.height = '240px';
    const canvas = document.createElement('canvas'); canvas.width = 600; canvas.height = 240;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 600, 240);
    ctx.fillStyle = 'black'; ctx.font = '24px sans-serif'; ctx.fillText('Question 2: Explain the comparison.', 20, 70);
    const svg = el('svg', { viewBox: '0 0 600 240', preserveAspectRatio: 'none' }); svg.classList.add('overlay');
    wrap.append(canvas, svg); $('pagesContainer').append(wrap);
    const secondPage = { num: 2, baseW: 600, baseH: 240, wrap, canvas, svg, renderTask: null };
    pages.push(secondPage); attachOverlayHandlers(secondPage);
    scale = 1; applyScale(); $('viewerArea').scrollTop = 0;
    return worksheetContextPages({ max: LIVE_CONTEXT_MAX, dominant: LIVE_CONTEXT_DOMINANT }).map(p => p.num).sort();
  });
  assert.deepEqual(visiblePages, [1, 2], 'the comparison fixture shows both worksheet pages');
  replyMode = 'held';
  await startLiveReply('Compare these two questions.', 'live-two-pages');
  await page.waitForFunction(() => window.__sent.some(x => x.type === 'session.commentary.append'));
  assert.deepEqual(requests.at(-1).body.images.map(item => item.page).sort(), [1, 2], 'fresh streaming includes both visible pages');
  assert.equal(await page.evaluate(() => window.__fallback.length), 0, 'two-page checks retain the streaming route');
  releaseHeld(); await liveFinished('live-two-pages');
  assert.equal((await spoken('live-two-pages')).join(' '), whole);

  // A response in flight must not survive a change of pupil, worksheet,
  // teacher guidance, notebook reference, or student working.
  const staleSpeech = [];
  for (const kind of ['user', 'student', 'worksheet', 'guidance', 'notes', 'style', 'correction-style', 'working']) {
    await installFixture();
    replyMode = 'before-text';
    const start = sequence, id = 'changed-' + kind;
    await startLiveReply('Help with question 1.', id);
    await waitForRequest(x => x.id > start && x.body.action === 'reply');
    await page.evaluate(kind => {
      if (kind === 'user') currentUser = { uid: 'another-pupil', getIdToken: async () => 'other-token' };
      if (kind === 'student') _activeIdx = 1;
      if (kind === 'worksheet') { currentDocId = 'another-worksheet'; wsEpoch++; }
      if (kind === 'guidance') wsMeta.guidance = 'concepts';
      if (kind === 'notes') teachingNotes = [{ id: 'new-note', guidance: 'Use an updated teaching preference.' }];
      if (kind === 'style') aiStyle = { edits: [{ q: 'Question 1', better: 'Use a revised explanation.', subject: 'math' }] };
      if (kind === 'correction-style') cerStyle = { v: 2, edits: [{ q: 'Question 1', better: 'Follow the updated correction.', subject: 'math' }] };
      if (kind === 'working') annotations.push({ id: 'new-work', type: 'text', page: 1, x: 20, y: 200, w: 120, text: '12 + 3 = 15' });
    }, kind);
    releaseHeld(); await liveFinished(id);
    const stale = await spoken(id);
    if (stale.length) staleSpeech.push({ kind, stale });
    assert.equal(await page.evaluate(() => window.__fallback.length), 0, kind + ' changes do not start a stale fallback');
  }
  assert.deepEqual(staleSpeech, [], 'context changes discard all stale spoken guidance, including error messages');

  await installFixture();
  // Real live streaming shows an exact quote before PDF text extraction finishes.
  // A scanned worksheet keeps the same useful card without inventing a position.
  await page.evaluate(() => {
    tutorFocusClear();
    const p = pages[0], ctx = p.canvas.getContext('2d');
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 600, 800);
    ctx.fillStyle = 'black'; ctx.font = '20px Arial';
    ctx.fillText('7  What is the area of a circle with diameter 60 cm?', 30, 100);
    ctx.fillText('(Take π = 3.14)', 30, 135);
    p.viewport1 = { width: 600, height: 800, transform: [1, 0, 0, -1, 0, 800] };
    window.__focusText = {
      styles: { F1: { ascent: .8, descent: -.2 } },
      items: [{ str: '7 What is the area of a circle with diameter 60 cm?', width: 520, height: 20,
        transform: [20, 0, 0, 20, 30, 700], fontName: 'F1', dir: 'ltr' }]
    };
    p.page = { getTextContent: () => new Promise(resolve => { window.__releaseFocusText = () => resolve(window.__focusText); }) };
  });
  first = '[[focus p1 | Q7 | diameter 60 cm]] First use the diameter to find the radius. Then';
  whole = '[[focus p1 | Q7 | diameter 60 cm]] First use the diameter to find the radius. Then use it to calculate the area.';
  replyMode = 'held';
  await startLiveReply('Help with question 7.', 'focus-circle');
  await page.waitForFunction(() => window.__sent.some(x => x.type === 'session.commentary.append'));
  assert.equal(await page.locator('#tutorFocus q').innerText(), 'diameter 60 cm');
  assert.equal(await page.locator('#tutorFocus').isVisible(), true, 'focus is visible before text extraction completes');
  assert.deepEqual(await spoken('focus-circle'), ['First use the diameter to find the radius.'], 'focus metadata never reaches speech');
  assert.equal(await page.locator('g[data-focus]').count(), 0, 'no position is guessed while text is pending');
  releaseHeld(); await liveFinished('focus-circle');
  assert.equal((await spoken('focus-circle')).join(' '), 'First use the diameter to find the radius. Then use it to calculate the area.');
  await page.evaluate(() => window.__releaseFocusText());
  await page.waitForFunction(() => tutorFocusState.items[0]?.status === 'matched');
  assert.equal(await page.locator('g[data-focus] rect').count(), 1);
  assert.deepEqual(await page.locator('g[data-focus] rect').evaluate(node => ['x', 'y', 'width', 'height'].map(name => Number(node.getAttribute(name)))), [30, 84, 520, 20], 'highlight follows the whole measured PDF text run');
  assert.equal(await page.locator('g[data-point]').count(), 0, 'the inaccurate coordinate underline is absent');
  if (process.env.FOCUS_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.FOCUS_SCREENSHOT_DIR, 'focus-desktop.png') });
  const focusPersistence = await page.evaluate(() => {
    const marker = pages[0].svg.querySelector('g[data-focus]');
    annotations.push({ id: 'focus-ink', type: 'text', page: 1, x: 35, y: 175, w: 150, text: 'r = 30' });
    renderOverlay(pages[0]); scale = 1.5; applyScale();
    const svg = pages[0].svg;
    return { same: marker === svg.querySelector('g[data-focus]'), underInk: svg.firstElementChild === marker,
      persisted: JSON.stringify(annotations).includes('diameter'), pointer: marker.getAttribute('pointer-events') };
  });
  assert.deepEqual(focusPersistence, { same: true, underInk: true, persisted: false, pointer: 'none' }, 'verified focus survives zoom and writing without becoming student work');
  await page.getByRole('button', { name: 'Close focus for page 1' }).click();
  assert.equal(await page.locator('#tutorFocus').isVisible(), false);
  assert.equal(await page.locator('g[data-focus]').count(), 0);

  await installFixture();
  await page.evaluate(() => { tutorFocusClear(); tutorFocusShow({ page: 1, label: 'Q7', quote: 'diameter 60 cm' }); });
  await page.waitForFunction(() => tutorFocusState.items[0]?.status === 'quote');
  assert.match(await page.locator('#tutorFocus').innerText(), /Find these words on page 1/);
  assert.equal(await page.locator('g[data-focus]').count(), 0, 'scans show a quote without estimated coordinates');
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.locator('#tutorFocus q').isVisible(), true, 'the quote stays visible on mobile');
  const mobileBox = await page.locator('#tutorFocus').boundingBox();
  assert.ok(mobileBox.x >= 0 && mobileBox.x + mobileBox.width <= 391, 'focus fits the narrow screen');
  if (process.env.FOCUS_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.FOCUS_SCREENSHOT_DIR, 'focus-mobile.png') });
  const voicePhase = await page.evaluate(() => liveTutor.phase);
  await page.getByRole('button', { name: 'Show page', exact: true }).click();
  assert.equal(await page.locator('#buddy').isVisible(), false, 'Show page clears the mobile panel from the worksheet');
  assert.equal(await page.locator('#buddyFab').isVisible(), true, 'live controls remain reachable after showing the page');
  assert.equal(await page.evaluate(() => liveTutor.phase), voicePhase, 'Show page keeps the voice session connected');
  await page.locator('#buddyFab').click();
  assert.equal(await page.locator('#buddy').isVisible(), true, 'the tutor controls reopen');
  assert.equal(await page.evaluate(() => liveTutor.phase), voicePhase, 'reopening the controls keeps the same voice session');
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.evaluate(() => {
    tutorFocusClear();
    tutorFocusShow({ page: 1, label: 'Q7', quote: '<img src=x onerror=alert(1)>' });
  });
  assert.equal(await page.locator('#tutorFocus img').count(), 0, 'quotes are rendered as literal text');
  assert.equal(await page.locator('#tutorFocus q').innerText(), '<img src=x onerror=alert(1)>');
  await page.evaluate(() => { wsKey.pages = [1]; applyKeyVisibility(); });
  assert.equal(await page.locator('#tutorFocus').isVisible(), false, 'a page hidden as an answer key loses its focus card');
  assert.equal(await page.evaluate(() => tutorFocusShow({ page: 1, label: 'Q7', quote: 'diameter 60 cm' })), false, 'answer-key pages cannot be revealed through focus');

  await installFixture();
  whole = '[[point p1 0.12 0.25 0.35 0.02 underline]] Read the diameter first.';
  replyMode = 'complete';
  await startLiveReply('Help with question 7.', 'focus-old-cache'); await liveFinished('focus-old-cache');
  assert.equal((await spoken('focus-old-cache')).join(' '), 'Read the diameter first.');
  assert.equal(await page.locator('g[data-point]').count(), 0, 'old cached pointer metadata is consumed without drawing');
  first = englishFirst; whole = englishWhole;

  await installFixture();
  const beforeVideoFocus = requests.length;
  await page.evaluate(async () => { lessonPlayback = { fixture: true }; await fastTutorPrepareNext(); lessonPlayback = null; });
  assert.equal(requests.length, beforeVideoFocus, 'preparation does not compete with a playing recorded lesson');
  assert.equal(await page.locator('#lessonVideo').count(), 1, 'video lesson player survives tutor interactions');
  assert.equal(await page.locator('#stylusBtn').count(), 1, 'worksheet pen controls survive tutor interactions');
  assert.deepEqual(errors, [], 'real browser client checks finish without uncaught errors');
  console.log('Fast tutor browser checks passed: exact quote focus, verified PDF highlighting, scan and mobile fallback, hidden-key guards, legacy marker removal, zero-preparation repeat, image-free prepared follow-ups, one retry after a miss, streaming, interruption, stale-context protection, and worksheet/video UI.');
} finally {
  for (const finish of held.values()) finish();
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
