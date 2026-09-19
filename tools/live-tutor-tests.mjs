#!/usr/bin/env node
/* Run the real live-tutoring browser code with controlled media/network
   boundaries. No microphone, credentials, or paid API calls are needed. */
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import test from 'node:test';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const startMarker = '/* ================= Live tutoring ================= */';
const endMarker = '/* ================= End live tutoring ================= */';
const start = html.indexOf(startMarker);
const end = html.indexOf(endMarker, start + startMarker.length);
assert.ok(start >= 0 && end > start, 'the live tutoring section can be loaded independently');
const deadlineSource = html.slice(html.indexOf('/* ================= AI request deadlines ================= */'),
  html.indexOf('/* ================= End AI request deadlines ================= */'));
const contextSource = html.slice(html.indexOf('/* Read screen rectangles'), start);
const syncTextSource = html.slice(html.indexOf('function syncActiveTextEditValue()'), html.indexOf('function commitActiveTextEdit()'));
/* The 🧩 keyword check and what it stands on: the ladder (which rung it sits
   on), the tolerant JSON parse, the syllabus matcher and the quiz section
   itself. They are cut out of the file rather than stubbed, because the
   gating and the cleaning are the things worth checking. */
const ladderSource = html.slice(html.indexOf('var HINT_RUNGS = ['), html.indexOf('/* ================= THE SCIENCE SYLLABUS'));
const syllabusSource = html.slice(html.indexOf('/* ================= THE SCIENCE SYLLABUS'), html.indexOf('/* ================= End the science syllabus'));
const parseSource = html.slice(html.indexOf('/* ================= Tolerant JSON parse for model output'), html.indexOf('function aiEngineName() {'));
const quizSource = html.slice(html.indexOf('/* ================= THE KEYWORD QUIZ ================='), html.indexOf('/* ================= End the keyword quiz'));
/* ✏️ The maths pad, cut in beside the quiz it replaces — `kwQuizOffReason`
   asks `mathWorksheet()`, so the two only make sense together. */
const mathSource = html.slice(html.indexOf('/* =====================================================================\n   ✏️ THE MATHS PAD'), html.indexOf('/* ================= End the maths pad'));
assert.ok(ladderSource && syllabusSource && parseSource && quizSource && mathSource,
  'the ladder, the syllabus, the JSON parse, the keyword quiz and the maths pad can be loaded independently');
const source = deadlineSource + syncTextSource + ladderSource + syllabusSource + parseSource + contextSource + quizSource + mathSource + html.slice(start, end);
const flattenSource = html.slice(html.indexOf('function drawAnnsOnCtx('), html.indexOf('/* A full-width band of the page'));
const voiceSource = html.slice(html.indexOf('function startVoice(target) {'), html.indexOf('function _voiceClearTimers()'));

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

async function flush() {
  // Drain all nested preparation/fallback promises without a wall-clock sleep.
  await new Promise(resolve => setImmediate(resolve));
}

function node(tagName = 'div') {
  const attrs = new Map();
  const classes = new Set();
  const listeners = new Map();
  return {
    tagName: tagName.toUpperCase(), children: [], style: {}, dataset: {},
    textContent: '', innerHTML: '', disabled: false, hidden: false,
    scrollHeight: 100, scrollTop: 0, clientHeight: 100, isConnected: true,
    getBoundingClientRect() { return this.rect || { top: 0, bottom: 100, left: 0, right: 100, width: 100, height: 100 }; },
    classList: {
      add(...names) { names.forEach(name => classes.add(name)); },
      remove(...names) { names.forEach(name => classes.delete(name)); },
      contains(name) { return classes.has(name); },
      toggle(name, active) {
        const on = active === undefined ? !classes.has(name) : active;
        if (on) classes.add(name); else classes.delete(name);
        return on;
      }
    },
    appendChild(child) { this.children.push(child); child.parentNode = this; return child; },
    append(...children) { children.forEach(child => this.appendChild(child)); },
    replaceChildren(...children) { this.children = []; this.append(...children); },
    setAttribute(name, value) { attrs.set(name, String(value)); },
    getAttribute(name) { return attrs.get(name) ?? null; },
    removeAttribute(name) { attrs.delete(name); },
    addEventListener(name, callback) {
      if (!listeners.has(name)) listeners.set(name, []);
      listeners.get(name).push(callback);
    },
    dispatch(name, event = {}) { (listeners.get(name) || []).forEach(fn => fn(event)); },
    focus() {}, remove() { this.removed = true; },
    querySelector() { return null; }, querySelectorAll() { return []; },
    play() { this.playCount = (this.playCount || 0) + 1; return Promise.resolve(); },
    pause() { this.pauseCount = (this.pauseCount || 0) + 1; }
  };
}

function harness(options = {}) {
  const nodes = new Map();
  const calls = { media: [], fetch: [], ai: [], toast: [], timers: new Map(), peers: [], audio: [], usage: [], undo: [], tools: [], points: [] };
  let nextTimer = 0;
  let annSeq = 0;
  const store = Object.assign({}, options.storage || {});
  const element = id => {
    if (!nodes.has(id)) nodes.set(id, node());
    return nodes.get(id);
  };
  const track = { enabled: true, stopped: 0, stop() { this.stopped++; } };
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
  const document = {
    body: node('body'), getElementById: element, querySelectorAll: () => [], addEventListener() {},
    createTextNode(text) { return { nodeType: 3, textContent: String(text) }; },
    createElement(tag) {
      const result = node(tag);
      if (tag === 'audio') calls.audio.push(result);
      return result;
    }
  };
  class PeerConnection {
    constructor() {
      this.connectionState = 'new';
      this.iceGatheringState = 'complete';
      this.closed = 0;
      this.tracks = [];
      calls.peers.push(this);
    }
    addTrack(...args) { this.tracks.push(args); }
    createDataChannel(label) {
      const channel = node('channel');
      channel.label = label;
      channel.readyState = 'connecting';
      channel.sent = [];
      channel.send = value => channel.sent.push(JSON.parse(value));
      channel.close = () => { channel.readyState = 'closed'; channel.closed = true; };
      channel.open = () => {
        channel.readyState = 'open';
        if (channel.onopen) channel.onopen();
        channel.dispatch('open');
      };
      channel.receive = event => {
        const message = { data: JSON.stringify(event) };
        if (channel.onmessage) channel.onmessage(message);
        channel.dispatch('message', message);
      };
      this.channel = channel;
      return channel;
    }
    async createOffer() {
      return options.createOffer ? options.createOffer(this) : { type: 'offer', sdp: 'offer-sdp' };
    }
    async setLocalDescription(description) {
      if (options.setLocalDescription) await options.setLocalDescription(this, description);
      this.localDescription = description;
    }
    async setRemoteDescription(description) {
      if (options.setRemoteDescription) await options.setRemoteDescription(this, description);
      this.remoteDescription = description;
    }
    close() { this.closed++; this.connectionState = 'closed'; }
    addEventListener() {}
    removeEventListener() {}
  }
  const c = {
    console: { log() {}, warn() {}, error() {} },
    document, $: element, RTCPeerConnection: PeerConnection,
    AbortController, AbortSignal, URL, JSON, Date, Promise, Math, String, Number, Array, Object,
    navigator: { mediaDevices: { getUserMedia: async constraint => {
      calls.media.push(constraint);
      return options.media ? options.media() : stream;
    } } },
    fetch: async (url, init = {}) => {
      calls.fetch.push({ url, ...init });
      if (options.fetch) return options.fetch(url, init);
      const body = JSON.parse(init.body);
      return { ok: true, status: 200, json: async () => body.action === 'stop'
        ? { stopped: true } : { sessionId: 'session-a', sdp: 'v=0\r\nanswer-sdp' } };
    },
    setTimeout(fn, ms) { const id = ++nextTimer; calls.timers.set(id, { fn, ms }); return id; },
    clearTimeout(id) { calls.timers.delete(id); },
    setInterval(fn, ms) { const id = ++nextTimer; calls.timers.set(id, { fn, ms }); return id; },
    clearInterval(id) { calls.timers.delete(id); },
    currentUser: { uid: 'student-a', getIdToken: async () => 'user-token' },
    currentDocId: 'worksheet-a', wsEpoch: 1, view: 'ws',
    wsMeta: { subject: 'science', level: 'p5', guidance: 'nudge' },
    docName: 'Water cycle', voice: { on: false, busy: false, starting: false },
    pages: [{ num: 1, wrap: node(), svg: node(), baseW: 100, baseH: 100 }], aiBusy: false, chat: [],
    annotations: [], editingId: null, selectedId: null,
    studentPages: () => c.pages,
    aiAvailable: () => true, aiEngineName: () => 'Chung GPT',
    loadTeachingNotes: async () => {}, keyEnsureReady: async () => {}, ensurePageRaster: async () => {},
    compositeJpeg: page => 'WORKSHEET_PAGE_' + page.num,
    aiGrounding: kind => '[TEACHER_GROUNDING:' + kind + ']',
    buddyCeilingRule: () => '[NUDGES_ONLY]', keyRuleBlock: () => '[ANSWER_KEY_RULES]',
    subjectLabel: () => 'Science', levelLabel: () => 'Primary 5', guidanceLabel: () => 'Nudges only',
    CHAT_SYS: '[TUTOR_SYSTEM]',
    toast: message => calls.toast.push(message),
    renderMicBtns() {}, renderVoiceBar() {}, renderChat() {},
    openBuddy() {}, usageNote(key, detail) { calls.usage.push({ key, detail }); }, setDirty() {}, syncTextEditValue() {},
    renderHints() {}, hints: [], wsKey: { rows: [] },
    /* What the ✏️ maths pad stands on outside the live section: the
       annotation plumbing a placed model becomes ordinary ink through.
       `tutorMethodRule` is NOT stubbed — the real one is cut in with the
       request deadlines above, and the check asserts on its own words. */
    round2: n => Math.round(n * 100) / 100,
    color: '#1A1A1A', fontSize: 16, tool: 'pen',
    ANN_TEXT_PAD_X: 3, ANN_TEXT_PAD_Y: 2, ANN_TEXT_LINE: 1.35,
    pushUndo() { calls.undo.push(JSON.stringify(c.annotations)); },
    newAnnId() { return 'ann' + (++annSeq); },
    renderOverlay() {}, renderAllOverlays() {},
    setTool(t) { c.tool = t; calls.tools.push(t); },
    localStorage: {
      getItem: key => (key in store ? store[key] : null),
      setItem: (key, value) => { store[key] = String(value); },
      removeItem: key => { delete store[key]; }
    },
    escHtml: value => String(value).replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch])),
    /* 👉 The tutor's finger lives outside the live section, so it is stubbed
       here — RECORDING, not swallowing, because what these checks are about is
       whether a \`[[point …]]\` marker really raises a gesture and is really
       never spoken. The MAKER itself (and its refusal to clamp a point into
       the page) is pinned for real in \`tools/tutor-tests.mjs\`, which has the
       marking's own \`_markAt\` beside it. */
    tutorPointMake: (spec, page) => (spec && spec.at ? { page, shape: spec.shape || 'circle', at: spec.at, to: spec.to || null } : null),
    tutorPointShow(pt) { if (pt) calls.points.push(pt); return !!pt; },
    tutorPointClear() { calls.points.push(null); }
  };
  c.window = {
    isSecureContext: true, RTCPeerConnection: PeerConnection, addEventListener() {},
    aiReady: () => true, liveAppCheckToken: async () => 'app-check-token',
    askGemini: async (prompt, config) => {
      calls.ai.push({ prompt, config });
      return options.ai ? options.ai(prompt, config) : 'Think about where the water goes.';
    }
  };
  Object.assign(c, options.globals || {});
  vm.createContext(c);
  vm.runInContext(source, c, { filename: 'index.html:live-tutoring' });
  Object.assign(c, options.globals || {});
  return { c, calls, nodes, track, stream, element };
}

async function connected(options) {
  const h = harness(options);
  await h.c.startLiveTutor();
  assert.equal(h.c.liveTutor.phase, 'connecting', 'SDP exchange alone does not promise a live tutor');
  const channel = h.c.liveTutor.channel;
  assert.ok(channel, h.c.liveTutor.message);
  channel.open();
  channel.receive({ type: 'session.started' });
  assert.equal(h.c.liveTutor.phase, 'live');
  return h;
}

function comments(channel) {
  return channel.sent.filter(event => event.type === 'session.commentary.append');
}

test('worksheet capture ranks actual visible area and excludes hidden key pages', () => {
  const h = harness();
  h.element('viewerArea').rect = { top: 100, bottom: 900, left: 50, right: 650 };
  const page = (num, top, bottom) => ({ num, wrap: { getBoundingClientRect: () => ({ top, bottom, left: 50, right: 650 }) } });
  const previous = page(1, -890, 110), answer = page(2, 130, 1130), hiddenKey = page(3, 100, 900), offscreen = page(4, 1150, 2150);
  h.c.pages = [previous, answer, hiddenKey, offscreen];
  h.c.studentPages = () => [previous, answer, offscreen];
  assert.equal(h.c.visiblePage().num, 2, 'a sliver of the previous page is not the current page');
  assert.deepEqual(Array.from(h.c.worksheetContextPages(), p => p.num), [2, 1]);
  h.c.studentPages = () => [offscreen];
  assert.equal(h.c.visiblePage(), null, 'do not invent a page when the viewport shows none');
});

test('a live check reads unfinished typed text and composites it with ink without moving the caret', async () => {
  const h = await connected();
  const page = h.c.pages[0], div = { innerText: 'Spring X.\u00a0It exerts great force.\n', scrollHeight: 40 };
  page.svg.querySelector = () => div;
  page.canvas = { width: 100, height: 100 };
  h.c.annotations = [
    { id: 'answer', type: 'text', page: 1, x: 3, y: 8, w: 90, h: 30, text: 'Old answer', fontSize: 12 },
    { id: 'ink', type: 'pen', page: 1, points: [{ x: 1, y: 2 }, { x: 3, y: 4 }], width: 2 },
    { id: 'key', type: 'text', page: 99, text: 'PRIVATE KEY', x: 0, y: 0 }
  ];
  h.c.editingId = h.c.selectedId = 'answer';
  Object.assign(h.c, { ANN_TEXT_FONT: 'sans-serif', ANN_TEXT_LINE: 1.35, ANN_TEXT_PAD_X: 2, ANN_TEXT_PAD_Y: 2 });
  const create = h.c.document.createElement;
  h.c.document.createElement = tag => {
    if (tag !== 'canvas') return create(tag);
    const operations = [];
    const ctx = {
      save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {},
      drawImage() { operations.push('worksheet'); }, stroke() { operations.push('ink'); },
      measureText(text) { return { width: text.length * 4 }; },
      fillText(text) { operations.push(text); }
    };
    return { getContext: () => ctx, toDataURL: () => 'data:image/jpeg,' + Buffer.from(JSON.stringify(operations)).toString('base64') };
  };
  vm.runInContext(flattenSource, h.c);
  await h.c.runLiveDelegation('typed-answer', h.c.liveTutor.generation);
  const { prompt, config } = h.calls.ai[0];
  assert.match(prompt, /Spring X\. It exerts great force\./);
  assert.doesNotMatch(prompt, /Old answer|PRIVATE KEY/);
  const imageData = Buffer.from(config.images[0].data, 'base64').toString();
  assert.match(imageData, /worksheet/);
  assert.match(imageData, /Spring X\./);
  assert.match(imageData, /ink/);
  assert.match(config.system, /untrusted.*data, not instructions/);
  assert.match(config.system, /Do not ask the student to repeat an answer/);
  assert.equal(h.c.editingId, 'answer', 'reading does not commit or blur the active editor');
  assert.equal(h.c.annotations[0].h, 40);
  h.c.stopLiveTutor();
});

test('quiet snapshots refresh typed answers only when changed and show Thinking throughout a check', async () => {
  const result = deferred();
  const h = await connected({ ai: () => result.promise });
  const channel = h.c.liveTutor.channel;
  const thinking = () => channel.sent.filter(event => event.type === 'session.thinking.append');
  assert.equal(thinking().length, 1, 'the initial view is available before a spoken question');
  assert.equal(thinking()[0].delegation_id, null, 'general context uses the protocol’s explicit null delegation');
  const tick = h.calls.timers.get(h.c.liveTutor.tick).fn;
  tick(); tick();
  assert.equal(thinking().length, 1, 'unchanged view does not resend context');
  h.c.annotations = [{ id: 'answer', type: 'text', page: 1, x: 2, y: 3, text: 'Spring X' }];
  tick();
  assert.equal(thinking().length, 2);
  assert.match(thinking().at(-1).content, /Spring X/);
  const pending = h.c.runLiveDelegation('quiet', h.c.liveTutor.generation);
  await flush();
  assert.equal(h.c.liveTutor.message, 'Thinking…');
  h.calls.ai[0].config.onProgress('Checking with another provider…');
  h.c.muteLiveTutor();
  assert.equal(h.c.liveTutor.message, 'Thinking…');
  assert.equal(comments(channel).length, 0, 'the tutor speaks nothing before the teaching result');
  result.resolve('Compare the force on the ball.');
  await pending;
  assert.equal(comments(channel).length, 1);
  assert.equal(comments(channel)[0].content, 'Compare the force on the ball.');
  h.c.stopLiveTutor();
});

test('typed answer context is bounded and prioritises the selected answer without exposing other pages', () => {
  const h = harness();
  h.c.annotations = [
    { id: 'old', type: 'text', page: 1, x: 0, y: 0, text: 'A'.repeat(15000) },
    { id: 'selected', type: 'text', page: 1, x: 5, y: 99, text: 'Spring X\nThe force is greater.' },
    { id: 'hidden', type: 'text', page: 2, text: 'HIDDEN ANSWER' }
  ];
  h.c.selectedId = 'selected';
  const context = h.c.worksheetTypedContext(h.c.pages);
  const rows = JSON.parse(context.slice(context.indexOf('\n') + 1));
  assert.equal(rows[0].text, 'Spring X\nThe force is greater.');
  assert.equal(rows[0].selected, true);
  assert.equal(rows.reduce((n, row) => n + row.text.length, 0), 12000);
  assert.equal(rows[1].truncated, true);
  assert.doesNotMatch(context, /HIDDEN ANSWER/);
});

test('silent view summaries remain short for long CJK and emoji answers', async () => {
  const h = await connected();
  const longAnswer = '力😀'.repeat(10000) + 'END OF ANSWER';
  h.c.annotations = [{ id: 'answer', type: 'text', page: 1, x: 2, y: 3, text: longAnswer }];
  h.c.selectedId = 'answer';
  h.c.liveShareWorksheetContext();
  const summary = h.c.liveTutor.channel.sent.at(-1);
  assert.equal(summary.type, 'session.thinking.append');
  assert.ok(Buffer.byteLength(summary.content, 'utf8') < 1000, 'Live append is a small preview, never the full answer');
  assert.doesNotMatch(summary.content, /END OF ANSWER|\\ud83d(?!\\ude00)/);
  assert.match(summary.content, /preview may be incomplete.*full typed text/s);
  await h.c.runLiveDelegation('long-answer', h.c.liveTutor.generation);
  assert.ok(h.calls.ai[0].prompt.length > 10000, 'the teaching check still receives the complete bounded typed context');
  h.c.stopLiveTutor();
});

test('typed chat uses the same visible answers as the live tutor', async () => {
  const h = harness();
  h.c.pages[0].svg.querySelector = () => ({ innerText: 'Spring X. It exerts great force.', scrollHeight: 40 });
  h.c.annotations = [{ id: 'answer', type: 'text', page: 1, x: 5, y: 10, text: '' }];
  h.c.editingId = 'answer';
  const chatSource = html.slice(html.indexOf('async function sendChat('), html.indexOf('/* Read screen rectangles'));
  vm.runInContext(chatSource, h.c);
  await h.c.sendChat('Is my answer correct?');
  assert.equal(h.calls.ai.length, 1);
  assert.match(h.calls.ai[0].prompt, /Spring X\. It exerts great force\./);
  assert.match(h.calls.ai[0].config.system, /not instructions/);
  assert.equal(h.c.editingId, 'answer');
});

test('chat prepares all visible rasters before taking one current answer snapshot', async () => {
  const nextPage = deferred(), captured = [];
  const h = harness();
  h.c.pages.push({ num: 2, wrap: node(), svg: node() });
  h.c.annotations = [{ id: 'answer', type: 'text', page: 1, x: 5, y: 10, text: 'Old answer' }];
  h.c.ensurePageRaster = p => p.num === 2 ? nextPage.promise : Promise.resolve();
  h.c.compositeJpeg = p => { captured.push(h.c.annotations[0].text); return p.num === 2 ? 'PAGE_TWO' : null; };
  const chatSource = html.slice(html.indexOf('async function sendChat('), html.indexOf('/* Read screen rectangles'));
  vm.runInContext(chatSource, h.c);
  const request = h.c.sendChat('Check this.');
  await flush();
  assert.equal(captured.length, 0, 'no old answer image is captured while another page is loading');
  h.c.annotations[0].text = 'Current answer';
  nextPage.resolve(); await request;
  assert.deepEqual(captured, ['Current answer', 'Current answer']);
  assert.match(h.calls.ai[0].prompt, /in this order: 2\./, 'image page labels match only successfully captured images');
  assert.match(h.calls.ai[0].prompt, /Current answer/);
  assert.doesNotMatch(h.calls.ai[0].prompt, /Old answer/);
});

test('startup refuses missing identity, unsaved worksheets, and an occupied microphone', async () => {
  for (const globals of [
    { currentUser: null }, { currentDocId: '' }, { view: 'home' },
    ...['starting', 'on', 'busy'].map(flag => ({ voice: { [flag]: true } }))
  ]) {
    const h = harness({ globals });
    await h.c.startLiveTutor();
    assert.equal(h.calls.media.length, 0);
    assert.equal(h.calls.fetch.length, 0);
    assert.equal(h.c.liveTutor.phase, 'idle');
    assert.notEqual(h.c.liveTutor.message, 'Ready when you are.');
  }
});

test('unsupported browsers and a loading AI report why starting is unavailable', async () => {
  for (const change of [
    c => { c.window.isSecureContext = false; },
    c => { c.window.RTCPeerConnection = null; },
    c => { c.navigator.mediaDevices = null; },
    c => { c.window.aiReady = () => false; },
    c => { c.window.liveAppCheckToken = null; }
  ]) {
    const h = harness(); change(h.c);
    await h.c.startLiveTutor();
    assert.equal(h.calls.media.length, 0);
    assert.equal(h.c.liveTutor.phase, 'idle');
    assert.notEqual(h.c.liveTutor.message, 'Ready when you are.');
  }
});

test('the authenticated SDP exchange waits for session.started before enabling tutoring', async () => {
  const h = harness();
  await h.c.startLiveTutor();
  const request = h.calls.fetch[0];
  assert.equal(request.url, h.c.LIVE_ENDPOINT);
  assert.equal(request.headers.Authorization, 'Bearer user-token');
  assert.equal(request.headers['X-Firebase-AppCheck'], 'app-check-token');
  assert.deepEqual(JSON.parse(request.body), { action: 'start', sdp: 'offer-sdp', worksheetId: 'worksheet-a' });
  const channel = h.c.liveTutor.channel;
  channel.open();
  channel.receive({ type: 'session.delegation.created', delegation: { id: 'too-early', target: 'client' } });
  await flush();
  assert.equal(h.calls.ai.length, 0);
  assert.equal(h.c.liveTutor.phase, 'connecting');
  assert.equal(h.element('liveMuteBtn').hidden, true);
  channel.receive({ type: 'session.started' });
  const timerCount = h.calls.timers.size;
  channel.receive({ type: 'session.started' });
  assert.equal(h.calls.timers.size, timerCount, 'a duplicate startup event must not add another lifetime timer');
  assert.equal(h.c.liveTutor.phase, 'live');
  assert.equal(h.element('liveMuteBtn').hidden, false);
  h.c.stopLiveTutor();
});

test('a second Start while permission is pending cannot open another microphone', async () => {
  const permission = deferred();
  const h = harness({ media: () => permission.promise });
  const pending = h.c.startLiveTutor();
  await h.c.startLiveTutor();
  assert.equal(h.calls.media.length, 1);
  h.c.stopLiveTutor();
  permission.resolve(h.stream);
  await pending;
  assert.equal(h.track.stopped, 1);
  assert.equal(h.calls.fetch.length, 0);
  assert.equal(h.c.liveTutor.phase, 'idle');
});

test('microphone denial and a missing device release startup state with a useful message', async () => {
  for (const [name, message] of [['NotAllowedError', /permission was declined/], ['NotFoundError', /No microphone/]]) {
    const h = harness({ media: async () => { throw Object.assign(new Error('unsafe implementation details'), { name }); } });
    await h.c.startLiveTutor();
    assert.equal(h.c.liveTutor.phase, 'idle');
    assert.match(h.c.liveTutor.message, message);
    assert.equal(h.calls.timers.size, 0);
    assert.equal(h.calls.fetch.length, 0);
  }
});

test('backend failures are readable and never display raw provider errors', async () => {
  for (const status of [401, 403, 404, 409, 429, 500, 503]) {
    const h = harness({ fetch: async () => ({ ok: false, status, json: async () => ({ error: 'secret-provider-detail' }) }) });
    await h.c.startLiveTutor();
    assert.equal(h.c.liveTutor.phase, 'idle');
    assert.equal(h.track.stopped, 1);
    assert.equal(h.calls.peers[0].closed, 1);
    assert.equal(h.calls.timers.size, 0);
    assert.doesNotMatch(h.c.liveTutor.message, /secret-provider-detail/);
    assert.notEqual(h.c.liveTutor.message, 'Ready when you are.');
  }
});

test('ending during identity verification prevents a late connection', async () => {
  const token = deferred();
  const h = harness({ globals: { currentUser: { uid: 'student-a', getIdToken: () => token.promise } } });
  const pending = h.c.startLiveTutor();
  await flush();
  h.c.stopLiveTutor();
  token.resolve('late-token');
  await pending;
  assert.equal(h.track.stopped, 1);
  assert.equal(h.calls.peers.length, 0);
  assert.equal(h.calls.fetch.length, 0);
  assert.equal(h.calls.timers.size, 0);
});

test('ending while the server creates a session closes the late remote session', async () => {
  const answer = deferred();
  const h = harness({ fetch: async (_, init) => JSON.parse(init.body).action === 'start'
    ? answer.promise : { ok: true, status: 200, json: async () => ({ stopped: true }) } });
  const pending = h.c.startLiveTutor();
  await flush();
  assert.equal(h.calls.fetch.length, 1);
  h.c.stopLiveTutor();
  answer.resolve({ ok: true, status: 200, json: async () => ({ sessionId: 'late-session', sdp: 'v=0\r\nlate-answer' }) });
  await pending;
  await flush();
  assert.equal(h.c.liveTutor.phase, 'idle');
  assert.equal(h.calls.peers[0].remoteDescription, undefined);
  assert.equal(h.track.stopped, 1);
  assert.deepEqual(JSON.parse(h.calls.fetch[1].body), { action: 'stop', sessionId: 'late-session' });
  assert.equal(h.calls.fetch[1].keepalive, true);
});

test('mute toggles captured audio and End closes all local and remote resources once', async () => {
  const h = await connected();
  const { channel, pc, audio } = h.c.liveTutor;
  h.c.muteLiveTutor();
  assert.equal(h.track.enabled, false);
  assert.equal(h.element('liveMuteBtn').getAttribute('aria-pressed'), 'true');
  h.c.muteLiveTutor();
  assert.equal(h.track.enabled, true);
  assert.equal(h.element('liveMuteBtn').getAttribute('aria-pressed'), 'false');
  h.c.stopLiveTutor();
  h.c.stopLiveTutor();
  await flush();
  assert.equal(h.track.stopped, 1);
  assert.equal(pc.closed, 1);
  assert.equal(channel.closed, true);
  assert.equal(audio.pauseCount, 1);
  assert.equal(audio.srcObject, null);
  assert.equal(audio.removed, true);
  assert.equal(h.calls.timers.size, 0);
  assert.equal(channel.sent.filter(event => event.type === 'session.close').length, 1);
  assert.equal(h.calls.fetch.filter(request => JSON.parse(request.body).action === 'stop').length, 1);
  assert.equal(h.c.liveTutor.phase, 'idle');
});

test('transcript events render speech as text and keep chronological, bounded history', async () => {
  const h = await connected();
  const channel = h.c.liveTutor.channel;
  const spoken = '<img src=x onerror=alert(1)> & "hello"';
  channel.receive({ type: 'session.output_transcript.delta', delta: 'Later', start_ms: 20 });
  channel.receive({ type: 'session.input_transcript.delta', delta: spoken, start_ms: 10 });
  channel.receive({ type: 'session.input_transcript.delta', delta: { malicious: true } });
  assert.equal(h.c.liveTutor.transcript.length, 2);
  assert.equal(h.c.liveTutor.transcript[0].text, spoken);
  const row = h.element('liveTranscript').children[0];
  assert.equal(row.children[1].nodeType, 3);
  assert.equal(row.children[1].textContent, spoken);
  assert.equal(row.innerHTML, '');
  for (let i = 0; i < 155; i++) channel.receive({ type: 'session.input_transcript.delta', delta: 'x'.repeat(4500), start_ms: 100 + i });
  assert.ok(h.c.liveTutor.transcript.length <= 1000);
  assert.ok(h.c.liveTutor.transcript.reduce((count, part) => count + part.text.length, 0) <= 24000);
  assert.ok(h.c.liveTutor.transcript.every(part => part.text.length <= 4000));
  h.c.stopLiveTutor();
});

test('subtitles repeat the tutor\u2019s reply over the page, and only the tutor\u2019s', async () => {
  const h = await connected();
  const channel = h.c.liveTutor.channel, bar = h.element('liveSubs');
  const spoken = '<img src=x onerror=alert(1)> & "hello"';
  channel.receive({ type: 'session.input_transcript.delta', delta: spoken, start_ms: 10 });
  assert.equal(bar.hidden, true, 'a student knows what they just said; it is noise over the question');
  channel.receive({ type: 'session.output_transcript.delta', delta: 'Where does ', start_ms: 20 });
  channel.receive({ type: 'session.output_transcript.delta', delta: 'the water go?', start_ms: 30 });
  assert.equal(bar.hidden, false);
  assert.equal(bar.classList.contains('on'), true);
  assert.equal(bar.textContent, 'Where does the water go?');
  assert.equal(bar.innerHTML, '', 'spoken text is painted as text, never as markup');
  h.c.stopLiveTutor();
});

test('a reply is a cue, not a log: a new answer replaces the last and a pause clears it', async () => {
  const h = await connected();
  const channel = h.c.liveTutor.channel, bar = h.element('liveSubs');
  channel.receive({ type: 'session.output_transcript.delta', delta: 'First reply.', start_ms: 10 });
  channel.receive({ type: 'session.input_transcript.delta', delta: 'I think so', start_ms: 20 });
  assert.equal(bar.textContent, 'First reply.', 'it stays up while the student answers the question it asked');
  channel.receive({ type: 'session.output_transcript.delta', delta: 'Second reply.', start_ms: 30 });
  assert.equal(bar.textContent, 'Second reply.', 'a new reply must not grow onto the last one');
  const hold = [...h.calls.timers.values()].find(timer => timer.ms === h.c.SUBS_HOLD_MS);
  assert.ok(hold, 'a finished reply is taken off the page rather than left there');
  hold.fn();
  assert.equal(bar.hidden, true);
  assert.equal(bar.textContent, '');
  channel.receive({ type: 'session.output_transcript.delta', delta: 'x'.repeat(400), start_ms: 40 });
  assert.equal(bar.textContent.length, h.c.SUBS_MAX_CHARS, 'a long answer scrolls itself instead of covering the worksheet');
  h.c.stopLiveTutor();
});

test('subtitles can be switched off, are remembered, and never outlive the session', async () => {
  const store = new Map();
  const h = await connected({ globals: { localStorage: {
    getItem: key => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value))
  } } });
  const channel = h.c.liveTutor.channel, bar = h.element('liveSubs'), button = h.element('liveSubsBtn');
  channel.receive({ type: 'session.output_transcript.delta', delta: 'Keep going.', start_ms: 10 });
  assert.equal(bar.hidden, false);
  assert.equal(button.textContent, 'Subtitles: on');
  h.c.toggleLiveSubs();
  assert.equal(bar.hidden, true, 'switching them off takes them off the page at once');
  assert.equal(button.textContent, 'Subtitles: off');
  assert.equal(button.getAttribute('aria-pressed'), 'false');
  assert.equal(store.get('tutorLiveSubs'), '0', 'the choice is remembered on the device');
  channel.receive({ type: 'session.output_transcript.delta', delta: ' Still talking.', start_ms: 20 });
  assert.equal(bar.hidden, true);
  h.c.toggleLiveSubs();
  assert.equal(bar.hidden, false, 'the reply still being spoken comes back');
  assert.equal(bar.textContent, 'Keep going. Still talking.', 'switching on mid-answer catches the whole of it');
  assert.equal(store.get('tutorLiveSubs'), '1');
  h.c.stopLiveTutor();
  assert.equal(bar.hidden, true, 'an ended session leaves nothing over the worksheet');
  assert.equal(h.c.liveSubs.text, '');
});

test('a device that refuses storage still gets subtitles', () => {
  const h = harness({ globals: { localStorage: { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } } } });
  assert.equal(h.c.liveSubs.on, true, 'an unreadable preference is not a reason to turn an aid off');
  h.c.toggleLiveSubs();
  assert.equal(h.c.liveSubs.on, false, 'a refused write must not stop the switch working');
});

/* ---- 🧩 The keyword check in live mode ---- */
const QUIZ_REPLY = JSON.stringify({
  concept: 'Water changes state when heat is gained or lost.',
  sentence: 'The puddle disappears because the water gains heat and changes into [1] by [2].',
  blanks: [
    { n: 1, answer: 'water vapour', alt: ['vapour'], clue: 'water as a gas' },
    { n: 2, answer: 'evaporation', alt: ['evaporating'], clue: 'the process, not the water' }
  ],
  praise: 'Every keyword — now use them in your answer.'
});
function quizHarness(extra = {}) {
  const answers = [];
  return connected({
    globals: Object.assign({ worksheetContextPages: () => [{ num: 3 }], wsMeta: { subject: 'science', level: 'P5', guidance: 'concepts' } }, extra.globals || {}),
    ai: (prompt, config) => {
      answers.push({ prompt, config });
      return /fill-in-the-blank reminder/.test(config.system) ? (extra.quiz ?? QUIZ_REPLY) : 'Think about where the water goes.';
    }
  });
}
/* The quiz's own notes to the tutor. The view summary is a general
   `thinking.append` too, so these are told apart by what they say. */
function thoughts(channel) {
  return channel.sent.filter(event => event.type === 'session.thinking.append' && event.delegation_id === null && /keyword check/i.test(event.content));
}
function inputsOf(box) {
  const out = [];
  const walk = n => { (n.children || []).forEach(c => { if (c.tagName === 'INPUT') out.push(c); walk(c); }); };
  walk(box);
  return out;
}
/* Everything the box shows or holds — text, placeholders and typed values —
   flattened, so an assertion can say a word is nowhere in it. */
function textOf(n) {
  let out = String(n.textContent || '') + ' ' + String(n.value || '') + ' ' + String(n.placeholder || '');
  (n.children || []).forEach(c => { out += ' ' + textOf(c); });
  return out;
}
function buttonsOf(box, cls) {
  const out = [];
  const walk = n => { (n.children || []).forEach(c => { if (c.tagName === 'BUTTON' && String(c.className).includes(cls)) out.push(c); walk(c); }); };
  walk(box);
  return out;
}

test('a keyword check pops up after the spoken reply, built from the question, grounded, keyed and told to the tutor', async () => {
  const h = await quizHarness();
  const channel = h.c.liveTutor.channel, box = h.element('kwQuiz');
  channel.receive({ type: 'session.input_transcript.delta', delta: 'Why does the puddle disappear on a sunny day? Is it evaporation, and where does the water vapour go?', start_ms: 10 });
  channel.receive({ type: 'session.delegation.created', delegation: { id: 'teach-a', target: 'client' } });
  await flush(); await flush();
  assert.equal(h.calls.ai.length, 2, 'the teaching call, then ONE quiz call');
  assert.equal(comments(channel)[0].content, 'Think about where the water goes.', 'the spoken reply is untouched');
  const built = h.calls.ai[1];
  assert.ok(h.calls.ai[0].config.images.length === 1 && !built.config.images, 'the quiz is text only — no page is sent twice');
  assert.match(built.prompt, /Why does the puddle disappear on a sunny day\? Is it evaporation/);
  assert.match(built.prompt, /Think about where the water goes/);
  assert.match(built.prompt, /speech recognition may be imperfect/);
  for (const rule of ['[TEACHER_GROUNDING:hint]', '[ANSWER_KEY_RULES]', 'THE SYLLABUS (MOE Primary Science Syllabus 2023', 'the notes win', 'CONCEPT & KEYWORDS']) {
    assert.ok(built.config.system.includes(rule), rule);
  }
  assert.ok(built.config.system.indexOf('[TEACHER_GROUNDING:hint]') < built.config.system.indexOf('THE SYLLABUS'), 'the notes come before the syllabus');
  assert.equal(box.hidden, false);
  assert.equal(box.classList.contains('on'), true);
  assert.equal(inputsOf(box).length, 2);
  const text = textOf(box);
  assert.ok(text.includes('The puddle disappears because') && !text.includes('evaporation') && !text.includes('water vapour'), 'the sentence is on the box and the missing words are nowhere in it');
  assert.equal(thoughts(channel).length, 1, 'the tutor is told, as context');
  assert.match(thoughts(channel)[0].content, /keyword check box is now on the student/);
  assert.match(thoughts(channel)[0].content, /never read out the missing words/);
  assert.ok(!thoughts(channel)[0].content.includes('evaporation'), 'and is not handed the words either');
  assert.deepEqual(h.calls.usage.map(u => u.key), ['quiz']);
  h.c.stopLiveTutor();
});

test('the check marks each blank, accepts a plural or a listed form, and a solved box tells the tutor', async () => {
  const h = await quizHarness();
  const channel = h.c.liveTutor.channel, box = h.element('kwQuiz');
  await h.c.runLiveDelegation('teach-b', h.c.liveTutor.generation);
  await flush(); await flush();
  let inputs = inputsOf(box);
  assert.equal(inputs.length, 2);
  inputs[0].value = 'Water Vapours';
  inputs[1].value = 'condensation';
  buttonsOf(box, 'kwqCheck')[0].dispatch('click');
  inputs = inputsOf(box);
  assert.equal(inputs[0].className.includes('right'), true, 'a plural of the keyword is the keyword');
  assert.equal(inputs[1].className.includes('wrong'), true);
  assert.equal(inputs[1].value, 'condensation', 'what was typed survives the repaint');
  assert.equal(h.c.kwQuiz.solved, false);
  assert.equal(buttonsOf(box, 'kwqReveal').length, 1, 'Show me appears only after an honest go');
  inputs[1].value = 'evaporating';
  buttonsOf(box, 'kwqCheck')[0].dispatch('click');
  assert.equal(h.c.kwQuiz.solved, true);
  assert.equal(inputsOf(box).every(i => i.disabled), true);
  assert.deepEqual(h.calls.usage.map(u => u.key), ['quiz', 'solved']);
  assert.equal(thoughts(channel).length, 2);
  assert.match(thoughts(channel)[1].content, /filled in every blank/);
  assert.equal(buttonsOf(box, 'kwqDone').length, 1);
  buttonsOf(box, 'kwqDone')[0].dispatch('click');
  assert.equal(box.hidden, true);
  assert.equal(h.c.kwQuiz.open, false);
  h.c.stopLiveTutor();
});

test('no quiz is built on a help level that locks the concepts rung, when quizzes are off, or while one is still open', async () => {
  const locked = await quizHarness({ globals: { wsMeta: { subject: 'science', level: 'P5', guidance: 'nudge' } } });
  await locked.c.runLiveDelegation('teach-c', locked.c.liveTutor.generation);
  await flush(); await flush();
  assert.equal(locked.calls.ai.length, 1, 'nudges only: the rung the quiz sits on is locked, so nothing is asked for');
  assert.equal(locked.c.kwQuiz.open, false);
  assert.equal(locked.element('kwQuiz').classList.contains('on'), false);
  locked.c.stopLiveTutor();

  const off = await quizHarness();
  off.c.setKwQuizPref(false);
  assert.equal(off.element('liveQuizBtn').textContent, 'Keyword quizzes: off');
  assert.equal(off.element('liveQuizBtn').getAttribute('aria-pressed'), 'false');
  await off.c.runLiveDelegation('teach-d', off.c.liveTutor.generation);
  await flush(); await flush();
  assert.equal(off.calls.ai.length, 1, 'switched off: no quiz call at all');
  off.c.stopLiveTutor();

  const busy = await quizHarness();
  await busy.c.runLiveDelegation('teach-e', busy.c.liveTutor.generation);
  await flush(); await flush();
  assert.equal(busy.calls.ai.length, 2);
  busy.c.kwQuiz.lastLiveAt = 0;
  await busy.c.runLiveDelegation('teach-f', busy.c.liveTutor.generation);
  await flush(); await flush();
  assert.equal(busy.calls.ai.length, 3, 'a box still being done is not replaced, so nothing is built');
  busy.c.stopLiveTutor();
});

test('a reply that gives the answer away, or whose blanks do not match its holes, is refused rather than shown', async () => {
  const gives = await quizHarness({ quiz: JSON.stringify({
    concept: 'c', sentence: 'The puddle dried up because of [1].', blanks: [{ n: 1, answer: 'evaporation' }], praise: 'p'
  }), globals: { wsKey: { rows: [{ number: '7', answer: 'Evaporation.', working: '' }] } } });
  await gives.c.runLiveDelegation('teach-g', gives.c.liveTutor.generation);
  await flush(); await flush();
  assert.equal(gives.calls.ai.length, 2, 'the call was made…');
  assert.equal(gives.c.kwQuiz.open, false, '…and the box stayed shut: the blank WAS the paper\'s answer');
  assert.equal(gives.element('kwQuiz').classList.contains('on'), false);
  gives.c.stopLiveTutor();

  const ragged = await quizHarness({ quiz: JSON.stringify({
    concept: 'c', sentence: 'Water turns into [1] and then [2].', blanks: [{ n: 1, answer: 'water vapour' }], praise: 'p'
  }) });
  await ragged.c.runLiveDelegation('teach-h', ragged.c.liveTutor.generation);
  await flush(); await flush();
  assert.equal(ragged.c.kwQuiz.open, false, 'a hole with no blank is a word the box cannot check');
  ragged.c.stopLiveTutor();
});

test('leaving the worksheet or opening another closes the box, and Escape does too', async () => {
  const h = await quizHarness();
  const box = h.element('kwQuiz');
  await h.c.runLiveDelegation('teach-i', h.c.liveTutor.generation);
  await flush(); await flush();
  assert.equal(box.hidden, false);
  h.c.wsEpoch = 2;
  h.c.kwQuizRender();
  assert.equal(box.hidden, true, 'a quiz about the last worksheet never sits over the next one');
  assert.equal(h.c.kwQuiz.open, false);
  h.c.stopLiveTutor();
});

test('a pending dictation permission request prevents live mode and drops a late worksheet recording', async () => {
  const permission = deferred();
  const h = harness({ media: () => permission.promise, globals: { voiceSupported: () => true } });
  vm.runInContext(voiceSource, h.c, { filename: 'index.html:dictation-start' });
  h.c.startVoice({ kind: 'chat' });
  assert.equal(h.c.voice.starting, true);
  await h.c.startLiveTutor();
  assert.equal(h.calls.media.length, 1);
  assert.equal(h.c.liveTutor.phase, 'idle');
  h.c.wsEpoch++;
  permission.resolve(h.stream);
  await flush();
  assert.equal(h.track.stopped, 1);
  assert.equal(h.c.voice.starting, false);
  assert.equal(h.c.voice.on, false);
});

test('live mode holds the microphone when the existing dictation button is pressed', async () => {
  const h = await connected();
  vm.runInContext(voiceSource, h.c, { filename: 'index.html:dictation-start' });
  h.c.startVoice({ kind: 'chat' });
  assert.equal(h.calls.media.length, 1);
  assert.match(h.calls.toast[0], /End live tutoring/);
  h.c.stopLiveTutor();
});

test('delegated teaching uses the current page, latest question, grounding, ceiling, and answer-key rules', async () => {
  const h = await connected({ globals: { worksheetContextPages: () => [{ num: 3 }] } });
  const channel = h.c.liveTutor.channel;
  channel.receive({ type: 'session.input_transcript.delta', delta: 'Why does the puddle disappear?', start_ms: 10 });
  channel.receive({ type: 'session.delegation.created', delegation: { id: 'teach-a', target: 'client' } });
  await flush();
  assert.equal(h.calls.ai.length, 1);
  const { prompt, config } = h.calls.ai[0];
  assert.match(prompt, /Why does the puddle disappear/);
  assert.match(prompt, /Primary 5/);
  assert.match(prompt, /Science/);
  for (const rule of ['[TUTOR_SYSTEM]', '[TEACHER_GROUNDING:teach]', '[NUDGES_ONLY]', '[ANSWER_KEY_RULES]']) assert.ok(config.system.includes(rule), rule);
  assert.deepEqual(JSON.parse(JSON.stringify(config.images)), [{ mimeType: 'image/jpeg', data: 'WORKSHEET_PAGE_3' }]);
  assert.equal(comments(channel).length, 1);
  assert.equal(comments(channel)[0].delegation_id, 'teach-a');
  assert.equal(comments(channel)[0].content, 'Think about where the water goes.');
  assert.equal(h.c.liveTutor.working, false);
  h.c.stopLiveTutor();
});

test('a missing image asks for the question instead of claiming to see the worksheet', async () => {
  const h = await connected({ globals: { worksheetContextPages: () => [] } });
  await h.c.runLiveDelegation('no-page', h.c.liveTutor.generation);
  assert.equal(h.calls.ai[0].config.images.length, 0);
  assert.match(h.calls.ai[0].prompt, /No worksheet image is available.*do not guess/);
  h.c.stopLiveTutor();
});

test('Live waits for the key and sends arithmetic and unitary teaching rules with its answer', async () => {
  const key = deferred();
  const h = await connected({ globals: { keyEnsureReady: () => key.promise } });
  const work = h.c.runLiveDelegation('key-first', h.c.liveTutor.generation);
  await flush();
  assert.equal(h.calls.ai.length, 0, 'no teaching request before the key is ready');
  key.resolve(); await work;
  const config = h.calls.ai[0].config;
  assert.match(config.system, /step-by-step arithmetic and the unitary method/);
  assert.match(config.system, /Do not introduce algebraic unknowns/);
  assert.match(config.system, /ONLY when this is very obviously/);
  assert.match(config.system, /working FIRST/);
  assert.match(config.system, /wait for their reply/);
  h.c.stopLiveTutor();
});

test('an unreadable key is explained aloud without requesting an ungrounded answer', async () => {
  const error = Object.assign(new Error('The answer key is still being read. Please ask again shortly.'), { code: 'ANSWER_KEY_NOT_READY' });
  const h = await connected({ globals: { keyEnsureReady: async () => { throw error; } } });
  await h.c.runLiveDelegation('key-unready', h.c.liveTutor.generation);
  assert.equal(h.calls.ai.length, 0);
  assert.match(comments(h.c.liveTutor.channel)[0].content, /answer key is still being read/);
  assert.equal(h.c.liveTutor.working, false);
  h.c.stopLiveTutor();
});

test('a stalled worksheet check ends within its budget, ignores late output, and allows the next question', async () => {
  const slow = deferred(); let count = 0;
  const h = await connected({ ai: () => ++count === 1 ? slow.promise : 'Find the value of one item.' });
  const channel = h.c.liveTutor.channel;
  const work = h.c.runLiveDelegation('slow-check', h.c.liveTutor.generation);
  await flush();
  const timer = [...h.calls.timers.values()].find(t => t.ms === 35000);
  assert.ok(timer); timer.fn(); await work;
  assert.equal(h.c.liveTutor.working, false);
  assert.equal(h.calls.ai[0].config.signal.aborted, true);
  assert.match(comments(channel)[0].content, /could not check/);
  slow.resolve('Obsolete answer'); await flush();
  assert.equal(comments(channel).length, 1);
  await h.c.runLiveDelegation('next-check', h.c.liveTutor.generation);
  assert.equal(comments(channel).at(-1).content, 'Find the value of one item.');
  h.c.stopLiveTutor();
});

test('foreign targets, repeats, and stale events are ignored while corrections queue only the latest question', async () => {
  const answers = [deferred(), deferred()];
  let requested = 0;
  const h = await connected({ ai: () => answers[requested++].promise });
  const channel = h.c.liveTutor.channel;
  channel.receive({ type: 'session.delegation.created', delegation: { id: 'server-job', target: 'server' } });
  h.c.handleLiveEvent({ type: 'session.delegation.created', delegation: { id: 'old-job', target: 'client' } }, h.c.liveTutor.generation - 1);
  channel.receive({ type: 'session.delegation.created', delegation: { id: 'teach-a', target: 'client' } });
  channel.receive({ type: 'session.delegation.created', delegation: { id: 'teach-a', target: 'client' } });
  await flush();
  assert.equal(h.calls.ai.length, 1);
  channel.receive({ type: 'session.delegation.created', delegation: { id: 'teach-b', target: 'client' } });
  channel.receive({ type: 'session.input_transcript.delta', delta: 'Actually, why does steam condense?', start_ms: 50 });
  channel.receive({ type: 'session.delegation.created', delegation: { id: 'teach-c', target: 'client' } });
  assert.equal(comments(channel).length, 0, 'waiting for a correction must not speak an obsolete answer');
  answers[0].resolve('Obsolete answer.');
  await flush();
  assert.equal(h.calls.ai.length, 2);
  assert.match(h.calls.ai[1].prompt, /Actually, why does steam condense/);
  assert.equal(comments(channel).length, 0);
  answers[1].resolve('Think about what cooling does.');
  await flush();
  assert.equal(comments(channel).length, 1);
  assert.equal(comments(channel)[0].delegation_id, 'teach-c');
  assert.equal(comments(channel)[0].content, 'Think about what cooling does.');
  h.c.stopLiveTutor();
});

test('ending while teaching is pending discards the late answer and cannot revive the session', async () => {
  const answer = deferred();
  const h = await connected({ ai: () => answer.promise });
  const channel = h.c.liveTutor.channel;
  const pending = h.c.runLiveDelegation('teach-a', h.c.liveTutor.generation);
  await flush();
  h.c.stopLiveTutor();
  await flush();
  const endedMessage = h.c.liveTutor.message;
  answer.resolve('Late answer must not be spoken.');
  await pending;
  assert.equal(comments(channel).length, 0);
  assert.equal(h.c.liveTutor.message, endedMessage);
  assert.equal(h.c.liveTutor.phase, 'idle');
});

test('a worksheet change discards a pending answer', async () => {
  const answer = deferred();
  const h = await connected({ ai: () => answer.promise });
  const channel = h.c.liveTutor.channel;
  const pending = h.c.runLiveDelegation('teach-a', h.c.liveTutor.generation);
  await flush();
  h.c.wsEpoch++;
  h.c.currentDocId = 'worksheet-b';
  answer.resolve('Wrong worksheet answer.');
  await pending;
  assert.equal(comments(channel).length, 0);
  h.c.stopLiveTutor();
});

test('tightening the help level while teaching is pending ends the session before the answer can speak', async () => {
  const answer = deferred();
  const h = await connected({ ai: () => answer.promise });
  const channel = h.c.liveTutor.channel;
  const pending = h.c.runLiveDelegation('teach-a', h.c.liveTutor.generation);
  await flush();
  h.c.wsMeta.guidance = 'concepts';
  answer.resolve('Answer based on an older ceiling.');
  await pending;
  await flush();
  assert.equal(comments(channel).length, 0);
  assert.equal(h.c.liveTutor.phase, 'idle');
  assert.match(h.c.liveTutor.message, /help level changed/);
});

test('a failed teaching request replies with a retry invitation, never a raw error', async () => {
  const h = await connected({ ai: async () => { throw new Error('private-provider-detail'); } });
  const channel = h.c.liveTutor.channel;
  await h.c.runLiveDelegation('teach-a', h.c.liveTutor.generation);
  assert.match(comments(channel)[0].content, /try your question again/);
  assert.doesNotMatch(JSON.stringify(comments(channel)), /private-provider-detail/);
  assert.equal(h.c.liveTutor.working, false);
  h.c.stopLiveTutor();
});

test('failure of an obsolete teaching request stays silent while the latest question is answered', async () => {
  const old = deferred();
  let requests = 0;
  const h = await connected({ ai: () => ++requests === 1 ? old.promise : Promise.resolve('Latest teaching step.') });
  const channel = h.c.liveTutor.channel;
  channel.receive({ type: 'session.delegation.created', delegation: { id: 'old-question', target: 'client' } });
  await flush();
  channel.receive({ type: 'session.delegation.created', delegation: { id: 'new-question', target: 'client' } });
  old.reject(new Error('The obsolete request failed.'));
  await flush();
  assert.equal(comments(channel).length, 1, 'the superseded error must not interrupt the corrected question');
  assert.equal(comments(channel)[0].delegation_id, 'new-question');
  assert.equal(comments(channel)[0].content, 'Latest teaching step.');
  h.c.stopLiveTutor();
});

/* ---------------------------------------------------------------------------
   THE ANSWER ARRIVES SOONER
   Four changes, one aim: shorten the wall-clock between a spoken question and
   the first word of the reply. Every one of them fails SILENTLY — the tutor
   still answers, just as slowly as before, or (worse) says something twice —
   so each is pinned here.
   ------------------------------------------------------------------------ */

/* A stream the test drives by hand. `chunk(text)` is the model having written
   `text` SO FAR, which is exactly the shape `askGeminiDirect` hands to
   `onStream`: the whole reply to date, never a delta. `end()` resolves the
   call with the last thing streamed, as the real route does. */
function stream() {
  const done = deferred();
  let last = '', push = null, calls = 0;
  return {
    ai: (prompt, config) => {
      // Only the FIRST question is this stream. A question asked after it gets
      // a call of its own that stays open, so anything spoken afterwards is
      // provably the obsolete answer leaking rather than the new one arriving.
      if (++calls > 1) return new Promise(() => {});
      push = config.onStream;
      return done.promise;
    },
    chunk(text) { last = text; if (push) push(text); },
    end(text) { if (text !== undefined) this.chunk(text); done.resolve(last.trim()); return flush(); },
    get onStream() { return push; }
  };
}

test('the first finished sentence is spoken while the rest is still being written, and is never said twice', async () => {
  const s = stream();
  const h = await connected({ ai: s.ai });
  const channel = h.c.liveTutor.channel;
  const work = h.c.runLiveDelegation('teach-a', h.c.liveTutor.generation);
  await flush();

  s.chunk('Look at the arrow on the diagram.');
  assert.equal(comments(channel).length, 0,
    'a stop with nothing after it is where the reply has got to, not the end of a sentence');
  s.chunk('Look at the arrow on the diagram. What');
  assert.equal(comments(channel).length, 1, 'the first finished sentence goes before the reply is complete');
  assert.equal(comments(channel)[0].content, 'Look at the arrow on the diagram.');
  assert.equal(comments(channel)[0].delegation_id, 'teach-a');

  await s.end('Look at the arrow on the diagram. What does it point to?');
  await work;
  assert.equal(comments(channel).length, 2, 'the remainder is one further append, never the whole reply again');
  assert.equal(comments(channel)[1].content, 'What does it point to?');
  assert.equal(comments(channel).map(e => e.content).join(' '),
    'Look at the arrow on the diagram. What does it point to?',
    'every word of the reply is spoken exactly once');
  h.c.stopLiveTutor();
});

test('a reply that never streams is still spoken whole, in one append, filler and all removed', async () => {
  // Either backup engine goes through a Cloud Function callable that cannot
  // carry a stream, so `onStream` is simply never called. That path must be
  // byte-for-byte what it was before streaming existed.
  const h = await connected({ ai: () => 'Okay, let me check the worksheet. Water evaporates in the heat.' });
  const channel = h.c.liveTutor.channel;
  await h.c.runLiveDelegation('teach-a', h.c.liveTutor.generation);
  assert.equal(comments(channel).length, 1);
  assert.equal(comments(channel)[0].content, 'Water evaporates in the heat.');
  assert.ok(typeof h.calls.ai[0].config.onStream === 'function',
    'the door is always offered the stream; a route without one just never calls it');
  h.c.stopLiveTutor();
});

test('opening filler is consumed rather than spoken, and is not re-sent as part of the remainder', async () => {
  const s = stream();
  const h = await connected({ ai: s.ai });
  const channel = h.c.liveTutor.channel;
  const work = h.c.runLiveDelegation('teach-a', h.c.liveTutor.generation);
  await flush();

  s.chunk('Let me check the worksheet. Look');
  assert.equal(comments(channel).length, 0, 'a first chunk that is nothing but filler says nothing');
  s.chunk('Let me check the worksheet. Look at the arrow on the diagram. What');
  assert.equal(comments(channel).length, 1);
  assert.equal(comments(channel)[0].content, 'Look at the arrow on the diagram.');

  await s.end('Let me check the worksheet. Look at the arrow on the diagram. What does it point to?');
  await work;
  assert.equal(comments(channel).length, 2);
  assert.doesNotMatch(JSON.stringify(comments(channel)), /Let me check/,
    'filler consumed early must not come back in the tail');
  h.c.stopLiveTutor();
});

test('every chunk is scrubbed, so streaming and not streaming say the same thing', async () => {
  const reply = 'Water evaporates in the heat. Let me check the answer key. The vapour rises.';
  const whole = await connected({ ai: () => reply });
  await whole.c.runLiveDelegation('teach-a', whole.c.liveTutor.generation);
  const spokenWhole = comments(whole.c.liveTutor.channel).map(e => e.content).join(' ');
  whole.c.stopLiveTutor();

  const s = stream();
  const h = await connected({ ai: s.ai });
  const work = h.c.runLiveDelegation('teach-a', h.c.liveTutor.generation);
  await flush();
  s.chunk('Water evaporates in the heat. Let');
  await s.end(reply);
  await work;
  const spokenStream = comments(h.c.liveTutor.channel).map(e => e.content).join(' ');
  assert.doesNotMatch(spokenWhole, /Let me check/);
  assert.doesNotMatch(spokenStream, /Let me check/,
    'a filler sentence in the TAIL is dropped too, or the split changes what the tutor says');
  assert.equal(spokenStream, spokenWhole);
  h.c.stopLiveTutor();
});

test('a short opening is held back so the one early append is spent on teaching', async () => {
  const s = stream();
  const h = await connected({ ai: s.ai });
  const channel = h.c.liveTutor.channel;
  const work = h.c.runLiveDelegation('teach-a', h.c.liveTutor.generation);
  await flush();
  s.chunk('Good try. Now count the squares along the base.');
  assert.equal(comments(channel).length, 0, '"Good try." alone is not worth the early append');
  await s.end('Good try. Now count the squares along the base. How many are there?');
  await work;
  assert.match(comments(channel)[0].content, /^Good try\. Now count the squares along the base\.$/,
    'what was held back is spoken with the teaching that follows it, never dropped');
  assert.equal(comments(channel).map(e => e.content).join(' '),
    'Good try. Now count the squares along the base. How many are there?');
  h.c.stopLiveTutor();
});

test('a reply is split across at most LIVE_STREAM_MAX_APPENDS, with the last reserved for the remainder', async () => {
  const s = stream();
  const h = await connected({ ai: s.ai });
  const channel = h.c.liveTutor.channel;
  const work = h.c.runLiveDelegation('teach-a', h.c.liveTutor.generation);
  await flush();
  const sentences = ['Look at the arrow on the diagram.', 'It points at the water surface.',
    'That is where evaporation happens.', 'What do you think the arrow shows?'];
  let so_far = '';
  for (const part of sentences) {
    so_far = so_far ? so_far + ' ' + part : part;
    s.chunk(so_far + ' X');
  }
  await s.end(so_far);
  await work;
  assert.equal(comments(channel).length, h.c.LIVE_STREAM_MAX_APPENDS);
  assert.equal(comments(channel).map(e => e.content).join(' ').replace(/ X$/, ''), so_far,
    'holding the last append back is what stops a long reply being left half-spoken');
  h.c.stopLiveTutor();
});

test('a newer question silences the old answer even with an append still to spend', async () => {
  /* The interruption lands BEFORE the first sentence has finished, so there is
     budget left and the ONLY thing that can stop the stale answer being spoken
     is the check that the student has moved on. Interrupt later and the append
     budget stops it anyway, which would make this test pass with that check
     removed — a guard nothing pins is a guard that quietly goes. */
  const s = stream();
  const h = await connected({ ai: s.ai });
  const channel = h.c.liveTutor.channel;
  const work = h.c.runLiveDelegation('teach-a', h.c.liveTutor.generation);
  await flush();
  s.chunk('Look at the arrow');
  assert.equal(comments(channel).length, 0, 'nothing has finished yet');
  channel.receive({ type: 'session.delegation.created', delegation: { id: 'teach-b', target: 'client' } });
  s.chunk('Look at the arrow on the diagram. What does it point to? The water surface.');
  assert.equal(comments(channel).length, 0,
    'a finished sentence is not spoken once the question it answers is stale');
  await s.end();
  await work;
  await flush();
  assert.equal(comments(channel).filter(event => event.delegation_id === 'teach-a').length, 0);
  assert.doesNotMatch(JSON.stringify(comments(channel)), /water surface/i);
  assert.equal(h.calls.ai.length, 2, 'the newer question is asked, not swallowed');
  assert.equal(h.c.liveTutor.phase, 'live', 'a superseded answer is not a lost connection');
  h.c.stopLiveTutor();
});

test('an answer already part-spoken stops where it is, and its tail is never said', async () => {
  // Streaming means a first sentence can be out of the door before the student
  // interrupts. That much is unavoidable; everything after it is not.
  const s = stream();
  const h = await connected({ ai: s.ai });
  const channel = h.c.liveTutor.channel;
  const work = h.c.runLiveDelegation('teach-a', h.c.liveTutor.generation);
  await flush();
  s.chunk('Look at the arrow on the diagram. What');
  assert.equal(comments(channel).length, 1);
  channel.receive({ type: 'session.delegation.created', delegation: { id: 'teach-b', target: 'client' } });
  s.chunk('Look at the arrow on the diagram. What does it point to? The water surface.');
  await s.end();
  await work;
  await flush();
  const stale = comments(channel).filter(event => event.delegation_id === 'teach-a');
  assert.equal(stale.length, 1, 'the obsolete answer is spoken as far as it got and no further');
  assert.equal(stale[0].content, 'Look at the arrow on the diagram.');
  assert.doesNotMatch(JSON.stringify(comments(channel)), /water surface/i);
  h.c.stopLiveTutor();
});

test('ending mid-stream speaks nothing further and does not revive the session', async () => {
  const s = stream();
  const h = await connected({ ai: s.ai });
  const channel = h.c.liveTutor.channel;
  const work = h.c.runLiveDelegation('teach-a', h.c.liveTutor.generation);
  await flush();
  s.chunk('Look at the arrow on the diagram. What');
  assert.equal(comments(channel).length, 1);
  h.c.stopLiveTutor();
  await flush();
  s.chunk('Look at the arrow on the diagram. What does it point to? Try it now.');
  await s.end();
  await work;
  assert.equal(comments(channel).length, 1);
  assert.equal(h.c.liveTutor.phase, 'idle');
});

test('a route that returns more than it streamed still has its tail spoken', async () => {
  // The streaming route returns exactly what it last streamed, so this never
  // fires today. It is pinned because the failure it guards against — the end
  // of an answer silently never said — shows on no screen.
  const done = deferred();
  const h = await connected({
    ai: (prompt, config) => { config.onStream('Look at the arrow on the diagram. What'); return done.promise; }
  });
  const channel = h.c.liveTutor.channel;
  const work = h.c.runLiveDelegation('teach-a', h.c.liveTutor.generation);
  await flush();
  done.resolve('Look at the arrow on the diagram. What does it point to?');
  await work;
  assert.equal(comments(channel).map(e => e.content).join(' '),
    'Look at the arrow on the diagram. What does it point to?');
  h.c.stopLiveTutor();
});

/* ------------------------------------------------------------------------
   👉 THE TUTOR POINTS AT THE PAGE

   A spoken reply is TEXT, streamed, so there is no second field to put a
   gesture in — a reply asked for as JSON is never streamed at all. So the
   tutor opens with ONE marker and the marker is consumed off the FRONT of
   the reply through the very same `cursor` the opening filler is.

   EVERY FAILURE HERE IS HEARD BY A CHILD. A marker that is not consumed is
   read aloud as "open bracket open bracket point four one two"; one that is
   consumed twice points at the wrong thing; one that holds the reply up is a
   tutor that has gone quiet.
   ------------------------------------------------------------------------ */

test('the pointer marker is read, raises a gesture, and is never spoken', async () => {
  const s = stream();
  const h = await connected({ ai: s.ai });
  const channel = h.c.liveTutor.channel;
  const work = h.c.runLiveDelegation('teach-a', h.c.liveTutor.generation);
  await flush();
  s.chunk('[[point p2 412,300 underline]] Look at the arrow on the diagram. What');
  assert.equal(comments(channel).length, 1);
  assert.equal(comments(channel)[0].content, 'Look at the arrow on the diagram.',
    'not one character of the marker reaches the speaker');
  const raised = h.calls.points.filter(Boolean);
  assert.equal(raised.length, 1, 'one marker is one gesture');
  assert.equal(JSON.stringify(raised[0]),
    JSON.stringify({ page: 2, shape: 'underline', at: [412, 300], to: null }));

  await s.end('[[point p2 412,300 underline]] Look at the arrow on the diagram. What does it point to?');
  await work;
  assert.equal(comments(channel).map(e => e.content).join(' '),
    'Look at the arrow on the diagram. What does it point to?',
    'the marker cannot come back as part of the remainder either');
  assert.equal(h.calls.points.filter(Boolean).length, 1, 'and it is never raised twice');
  h.c.stopLiveTutor();
});

test('a marker still being written holds the reply back rather than speaking half of it', async () => {
  const s = stream();
  const h = await connected({ ai: s.ai });
  const channel = h.c.liveTutor.channel;
  const work = h.c.runLiveDelegation('teach-a', h.c.liveTutor.generation);
  await flush();
  s.chunk('[[point p1 412,3');
  assert.equal(comments(channel).length, 0, 'an OPEN marker waits for its close');
  assert.equal(h.calls.points.filter(Boolean).length, 0);
  s.chunk('[[point p1 412,300 circle]] Look at the arrow on the diagram. What');
  assert.equal(comments(channel).length, 1, 'and the next chunk finishes it');
  assert.equal(comments(channel)[0].content, 'Look at the arrow on the diagram.');
  await s.end('[[point p1 412,300 circle]] Look at the arrow on the diagram. What does it point to?');
  await work;
  h.c.stopLiveTutor();
});

test('\u2026and an unfinished marker is never half-CONSUMED, which is how the closing brackets get spoken', async () => {
  /* The guard bites when the half-written marker happens to contain what
     reads as the end of a sentence — a model correcting itself mid-marker.
     Flushed, that half is consumed (the cursor moves past it) and nothing is
     said; the REST of the marker is then no longer at the front, so the next
     flush speaks "…underline]] Look at the arrow." aloud and the gesture is
     never raised at all. Both halves of that are silent in the source. */
  const s = stream();
  const h = await connected({ ai: s.ai });
  const channel = h.c.liveTutor.channel;
  const work = h.c.runLiveDelegation('teach-a', h.c.liveTutor.generation);
  await flush();
  s.chunk('[[point p1 412,300 circle. Actually ');
  s.chunk('[[point p1 412,300 circle. Actually underline]] Look at the arrow. What');
  await s.end('[[point p1 412,300 circle. Actually underline]] Look at the arrow. What next?');
  await work;
  const said = comments(channel).map(e => e.content).join(' ');
  assert.ok(!/\]\]|\[\[/.test(said), 'a bracket read to a child is the one thing this must never do: ' + said);
  assert.equal(said, 'Look at the arrow. What next?');
  assert.equal(h.calls.points.filter(Boolean).length, 1, 'and the gesture still goes up');
  h.c.stopLiveTutor();
});

test('a second position rides with the marker', async () => {
  const s = stream();
  const h = await connected({ ai: s.ai });
  const work = h.c.runLiveDelegation('teach-a', h.c.liveTutor.generation);
  await flush();
  await s.end('[[point p3 412,300 412,700 underline]] Read the two numbers again.');
  await work;
  assert.equal(JSON.stringify(h.calls.points.filter(Boolean)[0]),
    JSON.stringify({ page: 3, shape: 'underline', at: [412, 300], to: [412, 700] }));
  h.c.stopLiveTutor();
});

test('a marker nobody could read is DROPPED, never spoken and never guessed at', async () => {
  const s = stream();
  const h = await connected({ ai: s.ai });
  const channel = h.c.liveTutor.channel;
  const work = h.c.runLiveDelegation('teach-a', h.c.liveTutor.generation);
  await flush();
  await s.end('[[point somewhere near the top]] Look at the arrow on the diagram.');
  await work;
  assert.equal(h.calls.points.filter(Boolean).length, 0,
    'a gesture placed on a guess teaches the wrong question with a straight face');
  assert.equal(comments(channel).map(e => e.content).join(' '), 'Look at the arrow on the diagram.',
    'and the teaching is still spoken, without the brackets');
  h.c.stopLiveTutor();
});

test('a stray bracket anywhere in the reply is never read aloud', async () => {
  const s = stream();
  const h = await connected({ ai: s.ai });
  const channel = h.c.liveTutor.channel;
  const work = h.c.runLiveDelegation('teach-a', h.c.liveTutor.generation);
  await flush();
  await s.end('Look at the diagram. [[point 1,2 box]] What does the arrow point to?');
  await work;
  assert.equal(comments(channel).map(e => e.content).join(' '),
    'Look at the diagram. What does the arrow point to?',
    '"open bracket open bracket point one comma two box" read to a child is the one thing this must never do');
  h.c.stopLiveTutor();
});

test('asking a NEW question takes the last gesture off the page before the answer is written', async () => {
  const s = stream();
  const h = await connected({ ai: s.ai });
  const work = h.c.runLiveDelegation('teach-a', h.c.liveTutor.generation);
  await flush();
  assert.deepEqual(h.calls.points, [null],
    'the finger comes down the moment the tutor moves on, not when the new reply lands');
  await s.end('Look at the arrow on the diagram.');
  await work;
  h.c.stopLiveTutor();
});

test('the marker names its own page, and its digits are never read as a position', () => {
  const c = harness().c;
  assert.equal(JSON.stringify(c.livePointSpec(' p12 412,300 underline ', 1)),
    JSON.stringify({ page: 12, shape: 'underline', at: [412, 300] }),
    'left in, "p12" would be read as the first coordinate and the finger would land at the top of the page');
  assert.deepEqual(c.livePointSpec(' 412,300 circle ', 4).page, 4,
    'a marker that names no page means the page the student is looking at');
  assert.equal(c.livePointSpec(' 412,300 circle ', 0), null,
    'and with no page to fall back on it is refused rather than drawn on page one');
  assert.equal(c.livePointSpec(' 412 ', 1), null, 'one number is not a position');
  assert.equal(c.livePointSpec('', 1), null);
  assert.equal(c.livePointSpec(' 412,300 ', 1).shape, '',
    'an unnamed shape is left for tutorPointMake to default, not guessed here');
});

test('the strip removes a whole marker and an unclosed one, and nothing else', () => {
  const c = harness().c;
  assert.equal(c.livePointStrip('[[point 1,2 box]] Say this.'), 'Say this.');
  assert.equal(c.livePointStrip('Say this. [[oops'), 'Say this.');
  assert.equal(c.livePointStrip('Say this.'), 'Say this.');
  assert.equal(c.livePointStrip('The bracket [ and ] on their own survive.'),
    'The bracket [ and ] on their own survive.',
    'a single bracket is prose — a child reading "[3]" out of a question would lose it');
});

test('a streamed reply that is nothing but filler falls back to asking the question again', async () => {
  const s = stream();
  const h = await connected({ ai: s.ai });
  const channel = h.c.liveTutor.channel;
  const work = h.c.runLiveDelegation('teach-a', h.c.liveTutor.generation);
  await flush();
  await s.end('Okay, let me check the worksheet for you.');
  await work;
  assert.equal(comments(channel).length, 1);
  assert.match(comments(channel)[0].content, /say the question again/);
  h.c.stopLiveTutor();
});

test('the keyword check is built from what was actually spoken, once, after the reply', async () => {
  const s = stream();
  const quizzes = [];
  const h = await connected({ ai: s.ai, globals: { kwQuizForLive: (gen, question, reply) => quizzes.push(reply) } });
  const work = h.c.runLiveDelegation('teach-a', h.c.liveTutor.generation);
  await flush();
  s.chunk('Look at the arrow on the diagram. What');
  assert.equal(quizzes.length, 0, 'a box mid-answer would arrive before the tutor had finished speaking');
  await s.end('Look at the arrow on the diagram. What does it point to?');
  await work;
  assert.deepEqual(quizzes, ['Look at the arrow on the diagram. What does it point to?']);
  h.c.stopLiveTutor();
});

test('a live check sends the page under the student’s eye, not three, and a smaller picture', async () => {
  const shots = [];
  const h = await connected({ globals: { compositeJpeg: (page, px, quality) => { shots.push({ page: page.num, px, quality }); return 'PAGE_' + page.num; } } });
  h.element('viewerArea').rect = { top: 100, bottom: 900, left: 50, right: 650 };
  const page = (num, top, bottom) => ({ num, wrap: { getBoundingClientRect: () => ({ top, bottom, left: 50, right: 650 }) } });
  const sliver = page(1, -890, 110), reading = page(2, 130, 1130);
  h.c.pages = [sliver, reading];
  h.c.studentPages = () => h.c.pages;
  await h.c.runLiveDelegation('one-page', h.c.liveTutor.generation);
  assert.deepEqual(shots.map(s => s.page), [2], 'a sliver of the page above is not what the question is about');
  assert.equal(shots[0].px, h.c.LIVE_PAGE_PX);
  assert.equal(shots[0].quality, h.c.LIVE_PAGE_QUALITY);
  assert.ok(h.c.LIVE_PAGE_PX < 1300, 'the picture is smaller than it was, because bytes are seconds');
  h.c.stopLiveTutor();
});

test('a student straddling two pages is still sent both, and never more than two', () => {
  const h = harness();
  h.element('viewerArea').rect = { top: 0, bottom: 900, left: 50, right: 650 };
  const page = (num, top, bottom) => ({ num, wrap: { getBoundingClientRect: () => ({ top, bottom, left: 50, right: 650 }) } });
  const a = page(1, 0, 300), b = page(2, 300, 600), c = page(3, 600, 900);
  h.c.pages = [a, b, c];
  h.c.studentPages = () => h.c.pages;
  const live = { max: h.c.LIVE_CONTEXT_MAX, dominant: h.c.LIVE_CONTEXT_DOMINANT };
  assert.equal(h.c.worksheetContextPages(live).length, 2,
    'no page dominates, so the question may be about either — but three is a third of a megabyte for nothing');
  assert.equal(h.c.worksheetContextPages().length, 3,
    'called with nothing this is byte-for-byte what every other caller has always had');
  h.c.pages = [page(1, 0, 860), page(2, 860, 1200)];
  h.c.studentPages = () => h.c.pages;
  assert.deepEqual(h.c.worksheetContextPages(live).map(p => p.num), [1]);
});

test('the notes, the key and the worksheet picture are prepared side by side, not one after the other', async () => {
  const key = deferred();
  const rastered = [];
  const h = await connected({ globals: {
    keyEnsureReady: () => key.promise,
    ensurePageRaster: async page => { rastered.push(page.num); }
  } });
  const work = h.c.runLiveDelegation('parallel', h.c.liveTutor.generation);
  await flush();
  assert.deepEqual(rastered, [1], 'the page is drawn while the key is still being read, not afterwards');
  assert.equal(h.calls.ai.length, 0, 'the teaching request still waits for the key');
  key.resolve();
  await work;
  assert.equal(h.calls.ai.length, 1);
  h.c.stopLiveTutor();
});

test('the key and the notes are read while the microphone is still being granted', async () => {
  const permission = deferred();
  let notes = 0, keys = 0;
  const h = harness({
    media: () => permission.promise,
    globals: { loadTeachingNotes: async () => { notes++; }, keyEnsureReady: async () => { keys++; } }
  });
  const started = h.c.startLiveTutor();
  await flush();
  assert.equal(h.calls.media.length, 1, 'the microphone has been asked for and not yet granted');
  assert.equal(notes, 1, 'the first question used to wear the whole answer-key pass');
  assert.equal(keys, 1);
  permission.resolve(h.stream);
  await started;
  h.c.stopLiveTutor();
});

test('warming the key cannot put an error on screen about a question nobody has asked', async () => {
  const h = harness({ globals: {
    loadTeachingNotes: async () => { throw new Error('notes are unreachable'); },
    keyEnsureReady: () => { throw new Error('the key cannot be read'); }
  } });
  await h.c.startLiveTutor();
  await flush();
  assert.equal(h.c.liveTutor.phase, 'connecting', 'a warm-up refusal is met again, and reported, by the check that needs it');
  assert.doesNotMatch(h.c.liveTutor.message + JSON.stringify(h.calls.toast), /unreachable|cannot be read/);
  h.c.stopLiveTutor();
});

test('autoplay failure exposes Enable sound and a successful retry removes it', async () => {
  const h = await connected();
  h.c.liveTutor.audio.play = async () => { throw new Error('autoplay blocked'); };
  h.c.playLiveAudio();
  await flush();
  assert.equal(h.element('livePlaybackBtn').hidden, false);
  h.c.liveTutor.audio.play = async () => {};
  h.c.playLiveAudio();
  await flush();
  assert.equal(h.element('livePlaybackBtn').hidden, true);
  h.c.stopLiveTutor();
});

test('startup timeout and session.closed stop the microphone', async () => {
  const pendingPermission = deferred();
  const waiting = harness({ media: () => pendingPermission.promise });
  const start = waiting.c.startLiveTutor();
  waiting.calls.timers.get(waiting.c.liveTutor.startup).fn();
  pendingPermission.resolve(waiting.stream);
  await start;
  assert.equal(waiting.track.stopped, 1);
  assert.match(waiting.c.liveTutor.message, /timed out/);
  const h = await connected();
  h.c.liveTutor.channel.receive({ type: 'session.closed' });
  assert.equal(h.track.enabled, false);
  await flush();
  assert.equal(h.track.stopped, 1);
  assert.equal(h.c.liveTutor.phase, 'idle');
  assert.equal(h.calls.timers.size, 0);
});

test('End silences immediately, blocks restart, and waits for acknowledgement before closing the transport', async () => {
  const h = await connected({ fetch: async (_, init) => ({ ok: true, status: 200,
    json: async () => JSON.parse(init.body).action === 'start'
      ? { sessionId: 'session-a', sdp: 'v=0\r\nanswer' } : { stopped: false }
  }) });
  const { channel, pc, audio } = h.c.liveTutor;
  h.c.stopLiveTutor();
  assert.equal(h.track.enabled, false);
  assert.equal(audio.pauseCount, 1);
  assert.equal(h.track.stopped, 0);
  assert.equal(pc.closed, 0);
  assert.equal(h.c.liveTutor.phase, 'closing');
  assert.equal(h.element('liveEndBtn').disabled, true);
  await h.c.startLiveTutor();
  assert.equal(h.calls.media.length, 1);
  channel.receive({ type: 'session.input_transcript.delta', delta: 'Late speech' });
  assert.equal(h.c.liveTutor.transcript.length, 0);
  channel.receive({ type: 'session.closed' });
  assert.equal(h.c.liveTutor.phase, 'idle');
  assert.equal(h.track.stopped, 1);
  assert.equal(pc.closed, 1);
  assert.equal(h.calls.timers.size, 0);
});

test('End has a bounded local cleanup when the remote close request fails', async () => {
  const h = await connected({ fetch: async (_, init) => {
    if (JSON.parse(init.body).action === 'stop') throw new Error('offline');
    return { ok: true, status: 200, json: async () => ({ sessionId: 'session-a', sdp: 'v=0\r\nanswer' }) };
  } });
  h.c.stopLiveTutor();
  await flush();
  assert.equal(h.track.enabled, false);
  assert.equal(h.c.liveTutor.phase, 'closing');
  const cleanup = [...h.calls.timers.values()].find(timer => timer.ms === 3000);
  assert.ok(cleanup, 'an unacknowledged close has a short cleanup deadline');
  cleanup.fn();
  assert.equal(h.c.liveTutor.phase, 'idle');
  assert.equal(h.track.stopped, 1);
  assert.equal(h.calls.timers.size, 0);
});

test('End during offer creation or local setup never continues the SDP request', async () => {
  for (const phase of ['createOffer', 'setLocalDescription']) {
    const paused = deferred();
    const options = {
      [phase]: peer => { peer.iceGatheringState = 'gathering'; return paused.promise; }
    };
    const h = harness(options);
    const pending = h.c.startLiveTutor();
    await flush();
    assert.equal(h.calls.peers.length, 1);
    h.c.stopLiveTutor();
    paused.resolve({ type: 'offer', sdp: 'late-offer' });
    await pending;
    assert.equal(h.calls.fetch.length, 0);
    assert.equal(h.track.stopped, 1);
    assert.equal(h.calls.timers.size, 0, 'a cancelled connection cannot create another ICE timer');
  }
});

test('End cancels an in-progress ICE wait without keeping a timer or making a request', async () => {
  const h = harness({ setLocalDescription: async peer => { peer.iceGatheringState = 'gathering'; } });
  const pending = h.c.startLiveTutor();
  await flush();
  assert.ok(h.c.liveTutor.cancelIce);
  h.c.stopLiveTutor();
  await pending;
  assert.equal(h.calls.fetch.length, 0);
  assert.equal(h.track.stopped, 1);
  assert.equal(h.calls.timers.size, 0);
  assert.equal(h.c.liveTutor.cancelIce, null);
});

test('the ten-minute limit closes a live session and releases its microphone', async () => {
  const h = await connected();
  h.c.liveTutor.startedAt = Date.now() - h.c.LIVE_MAX_MS - 1;
  h.calls.timers.get(h.c.liveTutor.tick).fn();
  assert.equal(h.track.enabled, false);
  await flush();
  assert.equal(h.track.stopped, 1);
  assert.equal(h.c.liveTutor.phase, 'idle');
  assert.match(h.c.liveTutor.message, /10-minute session has ended/);
});

test('a recoverable live response error invites retry while a startup error closes the connection', async () => {
  const h = await connected();
  h.c.liveTutor.channel.receive({ type: 'error', error: { message: 'private-provider-error' } });
  assert.equal(h.c.liveTutor.phase, 'live');
  assert.match(h.c.liveTutor.message, /try asking again/);
  assert.doesNotMatch(h.c.liveTutor.message, /private-provider-error/);
  h.c.stopLiveTutor();
  const startup = harness();
  await startup.c.startLiveTutor();
  startup.c.liveTutor.channel.receive({ type: 'error' });
  await flush();
  assert.equal(startup.c.liveTutor.phase, 'idle');
  assert.equal(startup.track.stopped, 1);
});

/* ---- THE LIVE ORB and the filler scrubber (v1.19.0, sand since v1.20.0) ----
   The orb is a particle model the JS steps and a canvas it draws on. The
   harness has no canvas and no requestAnimationFrame, so the drawing is a
   no-op and every paint SETTLES the grains onto their targets — which is
   exactly what lets the states be pinned by geometry: the logo is the mask,
   thinking is a ring, talking is a row. The physics is pinned by stepping the
   model by hand: the ring turns, the wave rises with the level, a gust blows
   the M apart and it drifts back — and, the half that matters, none of it
   sets a timer. The scrubber is pinned in both directions: "let me check"
   goes, "let me know" stays. */
test('the orb is the WHOLE logo, solid, in a glass sphere: it breaks apart only to think or talk, and sets no timer', async () => {
  const idle = harness();
  idle.c.renderLiveTutor();
  assert.equal(idle.element('liveOrb').getAttribute('data-state'), 'logo');
  assert.equal(idle.calls.timers.size, 0, 'the orb is driven off the frame clock, never a timer');
  const h = await connected();
  const orb = h.element('liveOrb'), float = h.element('liveOrbFloat');
  assert.equal(orb.getAttribute('data-state'), 'listening');
  assert.equal(float.getAttribute('data-state'), 'listening', 'the floating orb over the worksheet is painted by the same call');
  assert.equal(float.classList.contains('on'), true, 'the float shows while a session runs');
  const canvases = n => (n.children || []).filter(c => String(c.tagName).toLowerCase() === 'canvas').length + (n.children || []).reduce((a, c) => a + canvases(c), 0);
  assert.equal(canvases(orb), 1, 'the sand is drawn on ONE canvas, not as DOM nodes');
  // The shape is the artwork, and the logo is SOLID BY CONSTRUCTION: every
  // cell of the mask is a grain, each grain's home is the exact centre of its
  // cell, and a grain is drawn wide enough to cover its cell corner to corner.
  const cells = h.c.liveOrbMaskCells();
  assert.ok(cells.length > 2000, 'the mask is the whole logo, cell by cell');
  assert.ok(cells.every(cell => cell.c >= 0 && cell.c < 6 && cell.px < h.c.LIVE_ORB_MASK_W && cell.py < h.c.LIVE_ORB_MASK_H));
  assert.equal(h.c.LIVE_ORB_STRIDE, 1, 'the card draws every cell');
  assert.ok(h.c.LIVE_ORB_STRIDE_FLOAT > 1, 'the float draws every second cell');
  assert.ok(h.c.LIVE_ORB_GRAIN_COVER >= Math.SQRT1_2 && h.c.LIVE_ORB_GRAIN_COVER < 1, 'a grain covers its own cell corner to corner, so the settled logo has no gaps');
  assert.equal(h.c.LIVE_ORB_IDLE_GUSTS, false, 'idle: the logo stands whole — nothing blows it apart');
  const model = orb.orbModel, floatModel = float.orbModel;
  assert.equal(model.grains.length, cells.length, 'one grain per cell of the logo');
  assert.equal(model.pitch, h.c.liveOrbPitch(1));
  assert.ok(floatModel.grains.length > 400 && floatModel.grains.length < cells.length / 3, 'the float carries a quarter of the grains');
  assert.equal(floatModel.pitch, h.c.liveOrbPitch(h.c.LIVE_ORB_STRIDE_FLOAT), 'each covering a bigger cell');
  const teal = model.grains.filter(g => g.c <= 2).length, magenta = model.grains.filter(g => g.c >= 3).length;
  assert.ok(teal > 400 && magenta > 400, 'the teal block and the magenta ribbon are both there');
  assert.ok(model.grains.every(g => g.hx > 0 && g.hx < 100 && g.hy > 0 && g.hy < 100), 'every home is on the grid');
  const teals = model.grains.filter(g => g.c <= 2).reduce((a, g) => a + g.hx, 0) / teal;
  const magentas = model.grains.filter(g => g.c >= 3).reduce((a, g) => a + g.hx, 0) / magenta;
  assert.ok(teals < 50 && magentas > 50, 'the block is on the left of the M and the ribbon on the right');
  for (let i = 1; i < model.grains.length; i++) assert.ok(model.grains[i - 1].c <= model.grains[i].c, 'grains are grouped by colour so the renderer draws six paths');
  assert.deepEqual(h.c.liveOrbGrains(2).map(g => g.hx), h.c.liveOrbGrains(2).map(g => g.hx), 'the sand is deterministic');
  // The homes are an exact lattice: every grain has a neighbour exactly one
  // pitch away (the logo is one connected shape), and no two share a cell.
  const homes = new Set(model.grains.map(g => g.hx.toFixed(4) + ',' + g.hy.toFixed(4)));
  assert.equal(homes.size, model.grains.length, 'no two grains share a home');
  const pitch = model.pitch;
  const neighbour = g => [[pitch, 0], [-pitch, 0], [0, pitch], [0, -pitch]].some(([dx, dy]) => homes.has((g.hx + dx).toFixed(4) + ',' + (g.hy + dy).toFixed(4)));
  assert.ok(model.grains.every(neighbour), 'every home touches another home one pitch away — no spacing between the particles');
  // Listening: settled, every grain is at (or within a breath of) its home.
  assert.ok(model.grains.every(g => Math.hypot(g.x - g.hx, g.y - g.hy) < 3), 'listening is the M');
  assert.equal(model.sandy, 0, 'and the grains are solid tiles, not sand');
  // The subtitles hold is the one timer a reply legitimately arms; the orb adds none.
  const orbTimers = () => [...h.calls.timers.values()].filter(t => t.ms !== h.c.SUBS_HOLD_MS).length;
  const timersBefore = orbTimers();
  const result = deferred();
  h.c.window.askGemini = async () => result.promise;
  const pending = h.c.runLiveDelegation('orb', h.c.liveTutor.generation);
  await flush();
  assert.equal(orb.getAttribute('data-state'), 'thinking');
  assert.equal(h.c.liveTutor.message, 'Thinking…', 'the status still says Thinking under the spinning ring');
  const onRing = g => Math.abs(Math.hypot(g.x - 50, g.y - 50) - h.c.LIVE_ORB_RING_R) <= h.c.LIVE_ORB_RING_BAND / 2 + 0.01;
  assert.ok(model.grains.every(onRing), 'thinking is every grain on ONE ring of sand');
  assert.ok(floatModel.grains.every(onRing), 'the float too');
  assert.equal(model.sandy, 1, 'broken apart, the grains are sand of their own sizes');
  // The physics: stepping the model in thinking turns the ring.
  const angle = g => Math.atan2(g.y - 50, g.x - 50);
  const before = model.grains.slice(0, 40).map(angle);
  // The paint settled the ring at the wall clock, so the physics steps on from it.
  let t = Date.now() / 1000;
  for (let i = 0; i < 60; i++) { h.c.liveOrbStep(model, 'thinking', 1 / 60, t, 0); t += 1 / 60; }
  let turned = 0;
  model.grains.slice(0, 40).forEach((g, i) => { let d = angle(g) - before[i]; while (d < -Math.PI) d += 2 * Math.PI; while (d > Math.PI) d -= 2 * Math.PI; turned += d; });
  assert.ok(turned / 40 > 0.8, 'a second of thinking turns the ring, the way the target turns');
  assert.ok(model.grains.every(g => Math.abs(Math.hypot(g.x - 50, g.y - 50) - h.c.LIVE_ORB_RING_R) < h.c.LIVE_ORB_RING_BAND + 4), 'and the grains stay in the ring while it turns');
  result.resolve('Compare the two beakers.');
  await pending;
  assert.equal(orb.getAttribute('data-state'), 'listening');
  h.c.liveTutor.channel.receive({ type: 'session.output_transcript.delta', delta: 'Compare ' });
  assert.equal(orb.getAttribute('data-state'), 'talking', 'a reply arriving is the tutor speaking');
  assert.ok(model.level > 0, 'the transcript pulse gives the row a level');
  const xs = model.grains.map(g => g.x), ys = model.grains.map(g => g.y);
  assert.ok(Math.min(...xs) < 15 && Math.max(...xs) > 85, 'talking is a row across the orb');
  assert.ok(Math.min(...ys) < 50 && Math.max(...ys) > 50 && ys.every(y => Math.abs(y - 50) < 25), 'whose grains rise AND fall about the middle');
  assert.equal(model.sandy, 1, 'talking breaks the logo apart into sand');
  // Louder is taller: the wave's height follows the level.
  const spread = level => { const m = { ...model, grains: model.grains.map(g => ({ ...g })) }; h.c.liveOrbSettle(m, 'talking', 3, level); const y = m.grains.map(g => g.y); return Math.max(...y) - Math.min(...y); };
  assert.ok(spread(1) > spread(0) * 2, 'a voice at full level swells the row far past silence');
  h.c.liveTutor.spokeAt = Date.now() - h.c.LIVE_ORB_TALK_MS - 1;
  h.calls.timers.get(h.c.liveTutor.tick).fn();
  assert.equal(orb.getAttribute('data-state'), 'listening', 'the tick lets the row settle back without a timer of its own');
  assert.equal(model.sandy, 0, 'and the grains are tiles of the logo again');
  h.c.muteLiveTutor();
  assert.equal(orb.getAttribute('data-state'), 'muted');
  assert.equal(orbTimers(), timersBefore, 'the orb added no timer');
  h.c.stopLiveTutor();
  await flush();
  assert.equal(h.calls.timers.size, 0);
  assert.equal(orb.getAttribute('data-state'), 'logo');
  assert.equal(float.classList.contains('on'), false);
  assert.equal(h.c.liveTutor.spokeAt, 0);
  // Idle: the logo STANDS. Ten seconds of stepping moves nothing and blows
  // nothing apart — only thinking and talking break the logo.
  const away = () => model.grains.reduce((a, g) => a + Math.hypot(g.x - g.hx, g.y - g.hy), 0) / model.grains.length;
  assert.ok(away() < 0.01, 'stopped, the sand is settled on the M');
  t = 200; model.nextGust = t;
  for (let i = 0; i < 600; i++) { t += 1 / 60; h.c.liveOrbStep(model, 'logo', 1 / 60, t, 0); }
  assert.equal(model.gust, null, 'no gust while idle');
  assert.equal(away(), 0, 'and the logo has not moved by a hair: every grain exactly on its home');
  assert.ok(model.grains.every(g => g.vx === 0 && g.vy === 0), 'nothing is moving');
  // The physics still knows how to break the logo and re-form it: a step into
  // thinking scatters the tiles, and the way back settles them exactly home.
  h.c.liveOrbStep(model, 'thinking', 1 / 60, t, 0);
  for (let i = 0; i < 30; i++) { t += 1 / 60; h.c.liveOrbStep(model, 'thinking', 1 / 60, t, 0); }
  assert.ok(away() > 5, 'thinking breaks the logo apart');
  for (let i = 0; i < 600; i++) { t += 1 / 60; h.c.liveOrbStep(model, 'logo', 1 / 60, t, 0); }
  assert.equal(away(), 0, 'and it re-forms exactly, grain for grain');
  assert.ok(model.sandy < 0.01, 'as solid tiles');
  // The gust machinery is kept, switched off; with it on it still works, off
  // the frame clock — the timer count above is the proof.
  h.c.LIVE_ORB_IDLE_GUSTS = true;
  model.nextGust = t;
  h.c.liveOrbStep(model, 'logo', 1 / 60, t, 0);
  assert.ok(model.gust, 'with gusts on, the idle gust arrives on the frame clock');
  for (let i = 0; i < 40; i++) { t += 1 / 60; h.c.liveOrbStep(model, 'logo', 1 / 60, t, 0); }
  assert.ok(away() > 0.8, 'the gust moves the sand off the M');
  for (let i = 0; i < 420; i++) { t += 1 / 60; h.c.liveOrbStep(model, 'logo', 1 / 60, t, 0); }
  assert.equal(model.gust, null, 'the gust has passed');
  assert.ok(away() < 0.9, 'and the sand has drifted back into the M');
  h.c.LIVE_ORB_IDLE_GUSTS = false;
  assert.equal(h.calls.timers.size, 0, 'still no timer');
});

test('a spoken reply is scrubbed of "let me check" and thinking sounds, and teaching is never touched', async () => {
  const strip = harness().c.liveStripFiller;
  assert.equal(strip('Let me check the worksheet. The ball speeds up because gravity pulls it. What happens next?'),
    'The ball speeds up because gravity pulls it. What happens next?');
  assert.equal(strip('Okay, let me think about this. Hmm. Look at the graph: which line rises fastest?'),
    'Look at the graph: which line rises fastest?');
  assert.equal(strip('One moment. Let me take a quick look at your answer. You wrote 24, but the unit is missing.'),
    'You wrote 24, but the unit is missing.');
  assert.equal(strip('I’ll check that for you. The key word is condense. Let me check that for you.'),
    'The key word is condense.');
  assert.equal(strip('The mass is 24 g. Hmm, what is the unit?'), 'The mass is 24 g. What is the unit?');
  assert.equal(strip('Let me know when you have tried it, then read the second sentence again.'),
    'Let me know when you have tried it, then read the second sentence again.', '"let me KNOW" is teaching');
  assert.equal(strip('Look at the diagram first. Which arrow points to the stem?'),
    'Look at the diagram first. Which arrow points to the stem?');
  assert.equal(strip('Wait, that is not right: 2.5 kg is heavier than 1.8 kg.'),
    'Wait, that is not right: 2.5 kg is heavier than 1.8 kg.');
  assert.equal(strip('Try 2.5 kg first. e.g. weigh it, then compare.'), 'Try 2.5 kg first. e.g. weigh it, then compare.');
  assert.equal(strip('Let me check.'), '', 'a reply that was ALL filler is empty, so the fallback line speaks');
  const h = await connected({ ai: () => 'Let me think… Hmm. Water turns into vapour when it gains heat. So what does the puddle do at noon?' });
  const channel = h.c.liveTutor.channel;
  await h.c.runLiveDelegation('scrub', h.c.liveTutor.generation);
  assert.equal(comments(channel)[0].content, 'Water turns into vapour when it gains heat. So what does the puddle do at noon?');
  assert.match(h.calls.ai[0].config.system, /READ ALOUD[\s\S]*never open with, or include, "let me check", "let me think"/i);
  h.c.stopLiveTutor();
  const all = await connected({ ai: () => 'Let me check the worksheet.' });
  await all.c.runLiveDelegation('all-filler', all.c.liveTutor.generation);
  assert.equal(comments(all.c.liveTutor.channel)[0].content, 'I could not read that clearly. Please say the question again.');
  all.c.stopLiveTutor();
});

/* =====================================================================
   ✏️ THE MATHS PAD
   ---------------------------------------------------------------------
   Every failure below is SILENT and the app goes on looking right:

   • A keyword check on a maths worksheet is the wrong tool asked for
     confidently — and a student told "fill in the blanks" about a sum has
     been handed a question nobody can answer.
   • A working line that a help level can switch off is the one thing a
     maths student has, taken away by a rule that was never about it.
   • A drawn model offered below the method rung is the method handed over
     by a box the ladder never gated.
   • The answer written into the segment the question is ASKING for is the
     answer with a box round it, printed first and read first.
   • An arithmetic slip called "right" teaches a child something false, in
     a green box, with a tick beside it.
   ===================================================================== */

function maths(options = {}) {
  const h = harness(options);
  h.c.wsMeta = { subject: 'math', level: 'P5', guidance: options.guidance || 'method' };
  return h;
}

test('a maths worksheet has no keyword check, and the note says why it has none', () => {
  const h = maths();
  assert.equal(h.c.mathWorksheet(), true);
  assert.equal(h.c.kwQuizOffReason(), 'maths');
  assert.equal(h.c.kwQuizAllowed(), false, 'recalling a wording is not what a maths answer needs');
  assert.match(h.c.kwQuizLockedNote(), /maths worksheet/i);
  assert.doesNotMatch(h.c.kwQuizLockedNote(), /help level/i,
    'a maths student told their help level forbids it goes looking for a setting that has nothing to do with it');
  // …and the science side is untouched, at every level.
  h.c.wsMeta = { subject: 'science', level: 'P5', guidance: 'concepts' };
  assert.equal(h.c.mathWorksheet(), false);
  assert.equal(h.c.kwQuizOffReason(), '');
  assert.equal(h.c.kwQuizAllowed(), true);
  h.c.wsMeta.guidance = 'nudge';
  assert.equal(h.c.kwQuizOffReason(), 'level');
  assert.match(h.c.kwQuizLockedNote(), /Nudges only/);
  // 'both' is Ans Key's legacy pairing and is NOT maths: half a science
  // worksheet still wants its keywords.
  h.c.wsMeta = { subject: 'both', level: 'P5', guidance: 'concepts' };
  assert.equal(h.c.mathWorksheet(), false);
  assert.equal(h.c.kwQuizAllowed(), true);
});

test('the working line is offered at EVERY help level, and the drawn model only from "How to do it"', () => {
  const h = maths();
  const at = level => { h.c.wsMeta.guidance = level; return [h.c.mthAllowed(), h.c.mthModelAllowed(), h.c.mthAnswerAllowed()]; };
  assert.deepEqual(at('nudge'), [true, false, false], 'asking for the next step tells a student nothing at all');
  assert.deepEqual(at('concepts'), [true, false, false]);
  assert.deepEqual(at('method'), [true, true, false], 'a model IS the method');
  assert.deepEqual(at('answer'), [true, true, true]);
  h.c.wsMeta.guidance = 'nudge';
  assert.match(h.c.mthModelLockedNote(), /Nudges only/);
  assert.match(h.c.mthModelLockedNote(), /working line below is still yours/, 'the one thing they DO have is named');
  // A level this build has never heard of falls back to the default rather
  // than to the top — the ladder's own rule, and the pad inherits it.
  h.c.wsMeta.guidance = 'whatever-comes-next';
  assert.deepEqual([h.c.mthModelAllowed(), h.c.mthAnswerAllowed()], [true, false]);
  // …and nothing at all is offered on a science worksheet.
  h.c.wsMeta = { subject: 'science', level: 'P5', guidance: 'answer' };
  assert.deepEqual([h.c.mthAllowed(), h.c.mthModelAllowed()], [false, false]);
});

test('the unknown is never filled in below the answer rung, whatever the model returns', () => {
  const h = maths();
  const spec = {
    why: 'Ali and Siti share the stickers.',
    bars: [
      { label: 'Ali', segments: [{ text: '48', units: 3 }, { text: '360', units: 1, unknown: true }] },
      { label: 'Siti', segments: [{ text: '48', units: 3, ask: true }] }
    ],
    total: '408 in all', note: 'Find one unit first.'
  };
  const held = h.c.mthModelClean(JSON.parse(JSON.stringify(spec)));
  assert.equal(held.bars[0].segments[1].text, '?', 'the value the question asks for is the answer with a box round it');
  assert.equal(held.bars[0].segments[0].text, '48', 'a number the question STATES is theirs to read off the page');
  assert.equal(held.bars[1].segments[0].ask, true);
  assert.equal(held.bars[0].segments[1].ask, false, 'the unknown is never also a labelling exercise');
  // At the top of the ladder the worked answer is allowed, so it stands.
  h.c.wsMeta.guidance = 'answer';
  const shown = h.c.mthModelClean(JSON.parse(JSON.stringify(spec)));
  assert.equal(shown.bars[0].segments[1].text, '360');
  // A segment marked unknown with nothing in it still reads as the unknown.
  h.c.wsMeta.guidance = 'answer';
  const bare = h.c.mthModelClean({ bars: [{ label: 'x', segments: [{ text: '', units: 1, unknown: true }] }] });
  assert.equal(bare.bars[0].segments[0].text, '?');
});

test('a model that would render perfectly and read as nonsense is bounded, and an empty one is refused', () => {
  const h = maths();
  assert.equal(h.c.mthModelClean(null), null);
  assert.equal(h.c.mthModelClean({ bars: [] }), null, 'a model with no bars is a blank box');
  assert.equal(h.c.mthModelClean({ bars: [{ label: 'a', segments: [] }] }), null);
  assert.equal(h.c.mthModelClean({ bars: 'lots' }), null);
  const big = h.c.mthModelClean({
    bars: Array.from({ length: 40 }, () => ({
      label: 'a name far longer than any bar in any model anybody has ever drawn',
      segments: Array.from({ length: 40 }, () => ({ text: 'a whole sentence written into a box the width of a number', units: 5000 }))
    }))
  });
  assert.equal(big.bars.length, 5);
  assert.equal(big.bars[0].segments.length, 10);
  assert.equal(big.bars[0].segments[0].units, 24, 'one part three hundred times another is not a bar model');
  assert.ok(big.bars[0].segments[0].text.length <= 14);
  assert.ok(big.bars[0].label.length <= 22);
  // Junk units become ONE rather than nothing: a zero-width segment is a
  // segment the student cannot see and cannot label.
  const odd = h.c.mthModelClean({ bars: [{ label: '', segments: [{ text: '4', units: 0 }, { text: '5', units: -3 }, { text: '6', units: 'two' }] }] });
  assert.deepEqual(Array.from(odd.bars[0].segments, s => s.units), [1, 1, 1]);
});

test('which segments a student is asked to label, and a model that marked none asks for the unknowns', () => {
  const h = maths();
  const marked = h.c.mthModelClean({ bars: [{ label: 'A', segments: [{ text: '5', units: 1, ask: true }, { text: '?', units: 1, unknown: true }] }] });
  assert.deepEqual(Array.from(h.c.mthModelBlanks(marked)), ['0:0']);
  const none = h.c.mthModelClean({ bars: [{ label: 'A', segments: [{ text: '5', units: 1 }, { text: '?', units: 1, unknown: true }] }] });
  assert.deepEqual(Array.from(h.c.mthModelBlanks(none)), ['0:1'], 'a model with every part filled in is a picture, not an exercise');
  const flat = h.c.mthModelClean({ bars: [{ label: 'A', segments: [{ text: '5', units: 1 }] }] });
  assert.deepEqual(Array.from(h.c.mthModelBlanks(flat)), [], 'nothing to ask for is not the same as asking for everything');
});

test('the palette is ONE row of working symbols, and the degree sign', () => {
  const h = maths();
  const rows = h.c.MTH_SYMBOLS;
  /* IT WAS FOUR ROWS AND THIRTY KEYS (v1.29.1). A child stuck on the next
     line of working needs × and ÷; a wall of ⊥, ⅔ and ≈ is a wall
     they read past. A row added back is the wall added back. */
  assert.equal(rows.length, 1, 'a second row is the wall coming back');
  assert.equal(rows[0].label, 'Working');
  assert.equal(rows[0].keys.join(' '), '+ − × ÷ = ( ) °');
  /* The two rules a key has to pass, stated as the test rather than left to
     the comment: it is HARD TO TYPE on a school keyboard, and it belongs in
     a line of WORKING. */
  const flat = rows.reduce((a, r) => a.concat(r.keys), []);
  ['<', '>', '%', ':'].forEach(k =>
    assert.ok(flat.indexOf(k) === -1, k + ' is on the keyboard they already have'));
  ['≤', '≥', '≈', '≠'].forEach(k =>
    assert.ok(flat.indexOf(k) === -1, 'a comparison is not a step of arithmetic'));
  ['∠', '△', '∥', '⊥', '→'].forEach(k =>
    assert.ok(flat.indexOf(k) === -1, 'a shape is not a step of arithmetic'));
  ['½', '⅓', '²', '√', 'π'].forEach(k =>
    assert.ok(flat.indexOf(k) === -1, 'a number form is not a step of arithmetic'));
  /* THE DEGREE SIGN IS THE ONE THAT STAYS, and it is the one the teacher
     asked for by name: unreachable on a school keyboard, and it ends an
     ordinary P5 answer. */
  assert.ok(flat.indexOf('°') !== -1, 'the degree sign is the exception, and it is kept');
  /* Every key still reaches the check as ordinary text through the same one
     inserter, so nothing here can become a second way of typing a step. */
  assert.ok(flat.every(k => typeof k === 'string' && k.length >= 1));
});

test('the palette keys are small, and a finger still gets a big one', () => {
  /* The keys were shrunk with the rows (v1.29.1). The floor is the phone
     rule: the same shrink on a sheet a child taps with a FINGER is how a
     learning aid turns into one they keep mis-hitting — on a desktop and an
     iPad it is a mouse or a pencil, and both are precise. */
  const key = /\.mthKey \{\s*min-width: (\d+)px; min-height: (\d+)px;[^}]*font-size: ([\d.]+)rem;/.exec(html);
  assert.ok(key, '.mthKey must still declare its own size');
  assert.ok(Number(key[1]) <= 30 && Number(key[2]) <= 30, 'the keys are meant to be small now');
  assert.ok(Number(key[3]) < 1, 'and the symbol on them with it');
  const phone = /\.mthPalLabel \{ width: 100%; \}[\s\S]{0,400}?\.mthKey \{[^}]*min-width: (\d+)px/.exec(html);
  assert.ok(phone, 'the phone sheet must put a finger-sized key back');
  assert.ok(Number(phone[1]) >= 36, 'a finger needs the key it always had');
});

test('the app checks the arithmetic itself, and only ever overrules a "right"', () => {
  const h = maths();
  // The palette's own − × ÷ are folded into real operators: a student who
  // pressed the key and one who typed the hyphen wrote the same sum.
  assert.equal(h.c.mthArith('12 × 5 = 60').ok, true);
  assert.equal(h.c.mthArith('12 x 5 = 60'), null, 'a letter x is not the app’s to read as a multiplication');
  assert.equal(h.c.mthArith('60 ÷ 5 = 12').ok, true);
  assert.equal(h.c.mthArith('60 − 12 = 48').ok, true, 'U+2212 is not the hyphen a keyboard gives');
  assert.equal(h.c.mthArith('60 - 12 = 48').ok, true);
  assert.equal(h.c.mthArith('1,200 + 300 = 1500').ok, true);
  assert.equal(h.c.mthArith('12 × 5 = 70').ok, false);
  assert.equal(h.c.mthArith('0.1 + 0.2 = 0.3').ok, true, '0.30000000000000004 is not a thing to teach a child');
  assert.equal(h.c.mthArith('5 ÷ 0 = 0'), null);
  // NARROW on purpose: anything that is not `number op number = number` is
  // the tutor's to judge, because a half-understood step wrongly called
  // wrong is far worse than one the model has to look at.
  assert.equal(h.c.mthArith('1 unit = 12'), null);
  assert.equal(h.c.mthArith('12 × 5'), null);
  assert.equal(h.c.mthArith('Ali has 12 sweets'), null);
  assert.equal(h.c.mthArith(''), null);
  // A sum that does not come out is not a correct step whatever the model says…
  const bad = h.c.mthWorkClean({ verdict: 'right', note: 'Good.', done: true }, '12 × 5 = 70');
  assert.equal(bad.verdict, 'close');
  assert.equal(bad.done, false);
  assert.match(bad.note, /not equal/);
  // …and in the OTHER direction it says nothing: a sum that comes out can
  // still be entirely the wrong step.
  const wrongStep = h.c.mthWorkClean({ verdict: 'wrong', note: 'That is not what the question asks for.' }, '12 × 5 = 60');
  assert.equal(wrongStep.verdict, 'wrong');
});

test('a verdict nobody recognises is "close", never "right" and never "wrong"', () => {
  const h = maths();
  assert.equal(h.c.mthWorkClean({ verdict: 'perfect', note: 'x' }, 'anything').verdict, 'close');
  assert.equal(h.c.mthWorkClean({ verdict: 'RIGHT', note: 'x' }, 'anything').verdict, 'right');
  assert.equal(h.c.mthWorkClean({}, 'anything').verdict, 'close');
  assert.equal(h.c.mthWorkClean(null, 'anything'), null);
  assert.equal(h.c.mthWorkClean('right', 'anything'), null);
  // "done" is only ever reachable from a step that really stands.
  assert.equal(h.c.mthWorkClean({ verdict: 'close', done: true, note: 'x' }, 'a').done, false);
  assert.equal(h.c.mthWorkClean({ verdict: 'right', done: true, note: 'x' }, 'a').done, true);
  assert.equal(h.c.mthWorkClean({ verdict: 'right', done: 'yes', note: 'x' }, 'a').done, false);
  // A reply with no words still says something a student can act on.
  assert.ok(h.c.mthWorkClean({ verdict: 'wrong' }, 'a').note.length > 10);
});

test('the step check is grounded, carries the key, the method rule and the ceiling, and is never a mark', async () => {
  const h = maths();
  h.c.window.askGemini = async (prompt, config) => {
    h.calls.ai.push({ prompt, config });
    return JSON.stringify({ verdict: 'right', note: 'Good — one unit is 12.', next: 'Now find 5 units.', done: false });
  };
  h.c.mthShow({ from: 'hint', question: 'Ali has 60 sweets in 5 equal bags.', ask: 'How many are in one bag?' });
  h.c.mthPad.typed = '60 ÷ 5 = 12';
  await h.c.mthWorkCheck();
  const { prompt, config } = h.calls.ai[0];
  assert.match(config.system, /\[TEACHER_GROUNDING:hint\]/, 'the key facts build a nudge; the marking standards are for a mark');
  assert.match(config.system, /\[ANSWER_KEY_RULES\]/);
  assert.match(config.system, /MATHEMATICS TEACHING METHOD/, 'arithmetic and the unitary method, never algebra dressed up as units');
  assert.match(config.system, /\[NUDGES_ONLY\]/);
  assert.match(config.system, /note NEVER states the value the student was asked to find/);
  assert.equal(config.json, true);
  assert.match(prompt, /Ali has 60 sweets/);
  assert.match(prompt, /60 ÷ 5 = 12/);
  assert.match(prompt, /comes out correctly/, 'what the app already knows goes over as evidence, not as the verdict');
  // A step that stands is cleared out of the line so the next one is typed
  // into an empty box; the ask moves on; the chain remembers it.
  assert.equal(h.c.mthPad.typed, '');
  assert.equal(h.c.mthPad.ask, 'Now find 5 units.');
  assert.deepEqual(Array.from(h.c.mthPad.steps, st => ({ text: st.text, verdict: st.verdict })), [{ text: '60 ÷ 5 = 12', verdict: 'right' }]);
  assert.deepEqual(h.calls.usage.filter(u => u.key === 'mathstep').map(u => ({ key: u.key, detail: u.detail })),
    [{ key: 'mathstep', detail: 'right' }]);
});

test('a step that does not stand is LEFT in the line to fix, and a blank one costs no call', async () => {
  const h = maths({ ai: async () => JSON.stringify({ verdict: 'wrong', note: 'That is not what the question asks for yet.' }) });
  h.c.mthShow({ from: 'hint', question: 'Q' });
  h.c.mthPad.typed = '';
  await h.c.mthWorkCheck();
  assert.equal(h.calls.ai.length, 0, 'an empty line is not a question worth asking a model');
  assert.match(h.c.mthPad.note, /Type one line of working/);
  h.c.mthPad.typed = '60 + 5 = 65';
  await h.c.mthWorkCheck();
  assert.equal(h.c.mthPad.typed, '60 + 5 = 65', 'a step to fix is a step still in front of them');
  assert.equal(h.c.mthPad.verdict, 'wrong');
});

test('the symbol palette writes at the caret, never at the end, and never past the cap', () => {
  const h = maths();
  const input = { value: '60  5 = 12', selectionStart: 3, selectionEnd: 3, focus() {}, setSelectionRange(a) { this.selectionStart = this.selectionEnd = a; } };
  h.c.mthPad.input = input;
  h.c.mthInsert('÷');
  assert.equal(input.value, '60 ÷ 5 = 12', 'a student who went back to fix the first number wants it where they are looking');
  assert.equal(input.selectionStart, 4, 'and the caret after it, ready for the next character');
  assert.equal(h.c.mthPad.typed, '60 ÷ 5 = 12');
  // A selection is REPLACED, the way typing would.
  Object.assign(input, { value: '12 + 5', selectionStart: 3, selectionEnd: 4 });
  h.c.mthInsert('×');
  assert.equal(input.value, '12 × 5');
  // The cap is the cap: a line longer than it is not one line of working.
  input.value = 'x'.repeat(160); input.selectionStart = input.selectionEnd = 160;
  h.c.mthInsert('°');
  assert.equal(input.value.length, 160);
  h.c.mthPad.input = null;
  h.c.mthInsert('×');   // nothing to write into is not a crash
});

test('a model is drawn to the same proportions in the pad and on the page, with no hairline gap', () => {
  const h = maths();
  const spec = h.c.mthModelClean({
    bars: [{ label: 'Ali', segments: [{ text: '12', units: 3 }, { text: '?', units: 1, unknown: true }] }],
    total: '48 in all'
  });
  const lay = h.c.mthModelLayout(spec, 330);
  const bar = lay.bars[0];
  assert.equal(bar.segments.length, 2);
  // Three units against one: the whole point of a bar model, and the same
  // number the pad's flexbox grows on.
  assert.ok(Math.abs(bar.segments[0].w / bar.segments[1].w - 3) < 0.05, JSON.stringify(bar.segments));
  // The LAST segment takes whatever is left, so rounding can never leave a
  // sliver of white at the end of a bar. Three equal parts is the case that
  // proves it: a third of the width does not round cleanly, so a bar built
  // by adding up rounded widths comes up short every single time.
  const thirds = h.c.mthModelLayout(h.c.mthModelClean({
    bars: [{ label: 'Ali', segments: [{ text: '1', units: 1 }, { text: '1', units: 1 }, { text: '?', units: 1, unknown: true }] }]
  }), 330);
  const tbar = thirds.bars[0];
  assert.equal(tbar.segments[2].x + tbar.segments[2].w, thirds.labelW + tbar.w,
    'a bar that stops short of its own end is a bar model with a sliver of white in it');
  const right = bar.segments[1].x + bar.segments[1].w;
  assert.equal(right, lay.labelW + bar.w);
  assert.ok(lay.total && lay.total.y > bar.y + bar.h, 'the total is drawn under the bars, not through them');
  // A model with no names at all gives its whole width to the bars.
  const plain = h.c.mthModelLayout(h.c.mthModelClean({ bars: [{ label: '', segments: [{ text: '4', units: 1 }] }] }), 330);
  assert.equal(plain.labelW, 0);
  assert.equal(plain.bars[0].x, 0);
});

test('a placed model is ORDINARY INK, in one undo step, clamped onto the paper', () => {
  const h = maths();
  h.c.pages = [{ num: 1, wrap: node(), svg: node(), baseW: 400, baseH: 500 }];
  h.c.annotations = [];
  h.c.mthPad.model = h.c.mthModelClean({
    bars: [{ label: 'Ali', segments: [{ text: '12', units: 3 }, { text: '?', units: 1, unknown: true }] }],
    total: '48 in all'
  });
  assert.equal(h.c.mthModelPlace(h.c.pages[0], { x: 20, y: 40 }), true);
  const made = h.c.annotations;
  assert.ok(made.length >= 6, JSON.stringify(made.map(a => a.type)));
  // Nothing but the types both renderers, the bounds, the hit test, the
  // eraser and the print path already know.
  assert.deepEqual([...new Set(Array.from(made, a => a.type))].sort(), ['line', 'rect', 'text']);
  assert.ok(made.every(a => a.page === 1 && a.id));
  assert.equal(h.calls.undo.length, 1, 'one Ctrl+Z takes the whole model back off again');
  assert.ok(made.some(a => a.type === 'text' && a.text === 'Ali'));
  assert.ok(made.some(a => a.type === 'text' && a.text === '?'));
  assert.ok(made.some(a => a.type === 'line' && a.heads === 'both'), 'the total is a span, so it has a head at each end');
  // Clamped onto the paper: a model half off the bottom is one nobody can
  // read, and it would be measured into the marking.
  h.c.annotations = [];
  h.c.mthModelPlace(h.c.pages[0], { x: 9999, y: 9999 });
  const far = h.c.annotations;
  assert.ok(far.every(a => (a.x === undefined || a.x >= 0) && (a.y === undefined || a.y >= 0)));
  assert.ok(far.every(a => a.type !== 'rect' || a.x + a.w <= 400.5), JSON.stringify(far.filter(a => a.type === 'rect')));
  // A page that is not on screen any more places nothing at all.
  h.c.annotations = [];
  assert.equal(h.c.mthModelPlace({ num: 99 }, { x: 10, y: 10 }), false);
  assert.equal(h.c.annotations.length, 0);
});

test('placing is a ONE-SHOT mode nobody can be left stranded in', () => {
  const h = maths();
  h.c.tool = 'pen';
  h.c.mthPad.model = h.c.mthModelClean({ bars: [{ label: 'A', segments: [{ text: '4', units: 1 }] }] });
  h.c.mthArmPlace();
  assert.equal(h.c.tool, 'model');
  assert.equal(h.c.mthPad.prevTool, 'pen');
  assert.match(h.calls.toast.at(-1), /Tap the page/);
  // Arming twice must not remember 'model' as the thing to go back to.
  h.c.mthArmPlace();
  assert.equal(h.c.mthPad.prevTool, 'pen');
  // With no model there is nothing to arm.
  h.c.tool = 'pen';
  h.c.mthPad.model = null;
  h.c.mthArmPlace();
  assert.equal(h.c.tool, 'pen');
});

test('labels are checked here and free, and "Show me" waits for one honest go', () => {
  const h = maths();
  h.c.mthPad.model = h.c.mthModelClean({
    bars: [{ label: 'Ali', segments: [{ text: '$12', units: 1, ask: true }, { text: '?', units: 1, unknown: true }] }]
  });
  h.c.mthPad.open = true;
  h.c.mthPad.epoch = h.c.wsEpoch;
  h.c.mthPad.modelTyped = { '0:0': '12' };
  h.c.mthModelCheck();
  assert.equal(h.calls.ai.length, 0, 'a number the question states needs no model to compare it');
  assert.equal(h.c.mthPad.modelMarks['0:0'], 'right', 'a currency sign is not a different answer');
  assert.equal(h.c.mthPad.reveal, true);
  assert.equal(h.c.mthPad.modelTries, 1);
  // A wrong one is wrong, and an empty round says so in its own words.
  Object.assign(h.c.mthPad, { modelTyped: { '0:0': '15' }, modelMarks: {}, reveal: false, modelTries: 0 });
  h.c.mthModelCheck();
  assert.equal(h.c.mthPad.modelMarks['0:0'], 'wrong');
  assert.equal(h.c.mthPad.reveal, false, '"Show me" is a button, never something that happens to you');
  Object.assign(h.c.mthPad, { modelTyped: {}, modelMarks: {}, modelTries: 0 });
  h.c.mthModelCheck();
  assert.match(h.c.mthPad.note, /Put a number in each empty part/);
  assert.equal(h.c.mthPad.modelTries, 1, 'a round with nothing typed is still a go, so "Show me" is one press away');
});

test('the model is never built below the method rung, and the refusal is in the HANDLER', async () => {
  const h = maths({ guidance: 'concepts' });
  h.c.window.askGemini = async () => { throw new Error('a model must not be asked for at this level'); };
  assert.equal(await h.c.mthModelFor({}), null);
  assert.equal(h.calls.ai.length, 0, 'a hidden button is not a lock');
  assert.match(h.calls.toast.at(-1), /Concepts & keywords|help level/);
});

test('the model build carries the ceiling, and the pad says what it shows', async () => {
  const h = maths();
  h.c.window.askGemini = async (prompt, config) => {
    h.calls.ai.push({ prompt, config });
    return JSON.stringify({
      why: 'Four equal parts make the whole.',
      bars: [{ label: 'Ali', segments: [{ text: '12', units: 3 }, { text: '360', units: 1, unknown: true }] }],
      total: '48 in all', note: 'Find one unit first.'
    });
  };
  h.c.mthShow({ from: 'hint', question: 'Ali has 48 sweets in 4 equal bags.' });
  const spec = await h.c.mthModelFor({});
  const { config } = h.calls.ai[0];
  assert.match(config.system, /\[TEACHER_GROUNDING:hint\]/);
  assert.match(config.system, /\[ANSWER_KEY_RULES\]/);
  assert.match(config.system, /MATHEMATICS TEACHING METHOD/);
  assert.match(config.system, /final answer is NOT allowed/, 'the ceiling reaches the drawing, not just the words');
  assert.equal(config.json, true);
  assert.equal(spec.bars[0].segments[1].text, '?');
  assert.equal(h.c.mthPad.mode, 'model');
  assert.equal(h.c.mthPad.reveal, false, 'it opens for them to LABEL — the model they label is the model they learn');
  // At the top of the ladder the prompt says so instead.
  h.c.wsMeta.guidance = 'answer';
  await h.c.mthModelFor({});
  assert.match(h.calls.ai[1].config.system, /full answer is allowed/);
});

test('the live tutor raises the working line after it has spoken, as context and never as speech', async () => {
  const h = maths({ ai: async () => 'Start by finding the cost of one pen. What do you divide?' });
  await h.c.startLiveTutor();
  const channel = h.c.liveTutor.channel;
  channel.open();
  channel.receive({ type: 'session.started' });
  await h.c.runLiveDelegation('teach', h.c.liveTutor.generation);
  assert.equal(h.c.mthPad.open, true);
  assert.equal(h.c.mthPad.mode, 'work');
  assert.match(h.c.mthPad.ask, /finding the cost of one pen/);
  // The tutor is TOLD, in a general thinking append that can never make it
  // talk — and it is told AFTER the teaching was sent.
  const told = channel.sent.filter(e => e.type === 'session.thinking.append' && /working line is now on the student/.test(e.content || ''));
  assert.equal(told.length, 1);
  assert.equal(told[0].delegation_id, null);
  const spoke = channel.sent.filter(e => e.type === 'session.commentary.append');
  assert.equal(spoke.length, 1, 'the box is not a second thing to say');
  assert.ok(channel.sent.indexOf(spoke[0]) < channel.sent.indexOf(told[0]));
  assert.match(told[0].content, /symbol palette/);
  h.c.stopLiveTutor();
});

test('a running chain of working is not thrown away because the tutor spoke again', async () => {
  const h = maths({ ai: async () => 'Good. Now find five units.' });
  await h.c.startLiveTutor();
  h.c.liveTutor.channel.open();
  h.c.liveTutor.channel.receive({ type: 'session.started' });
  await h.c.runLiveDelegation('a', h.c.liveTutor.generation);
  h.c.mthPad.steps = [{ text: '60 ÷ 5 = 12', verdict: 'right' }];
  h.c.mthPad.lastLiveAt = 0;     // past the gap, so the next reply may raise it
  await h.c.runLiveDelegation('b', h.c.liveTutor.generation);
  assert.deepEqual(Array.from(h.c.mthPad.steps, st => ({ text: st.text, verdict: st.verdict })), [{ text: '60 ÷ 5 = 12', verdict: 'right' }],
    'a student part way through their working has not finished it because the tutor spoke');
  assert.match(h.c.mthPad.ask, /five units/);
  // …but a box that has been finished starts the next one clean.
  h.c.mthPad.done = true;
  h.c.mthPad.lastLiveAt = 0;
  await h.c.runLiveDelegation('c', h.c.liveTutor.generation);
  assert.deepEqual(Array.from(h.c.mthPad.steps), []);
  h.c.stopLiveTutor();
});

test('the pad is not raised on a science worksheet, is switchable off, and never twice in a breath', async () => {
  const h = harness({ ai: async () => 'Think about where the water goes.' });
  h.c.wsMeta = { subject: 'science', level: 'P5', guidance: 'method' };
  await h.c.startLiveTutor();
  h.c.liveTutor.channel.open();
  h.c.liveTutor.channel.receive({ type: 'session.started' });
  await h.c.runLiveDelegation('sci', h.c.liveTutor.generation);
  assert.equal(h.c.mthPad.open, false, 'a working line on a science worksheet is the wrong tool the other way round');
  h.c.stopLiveTutor();

  const m = maths({ ai: async () => 'Find one unit first.' });
  m.c.setMthPref(false);
  await m.c.startLiveTutor();
  m.c.liveTutor.channel.open();
  m.c.liveTutor.channel.receive({ type: 'session.started' });
  await m.c.runLiveDelegation('off', m.c.liveTutor.generation);
  assert.equal(m.c.mthPad.open, false, 'a box a student switched off is a box that stays off');
  m.c.setMthPref(true);
  await m.c.runLiveDelegation('on', m.c.liveTutor.generation);
  assert.equal(m.c.mthPad.open, true);
  // Within the gap a second reply does not raise it again — a box that
  // popped on every "yes" is a box that gets closed unread.
  m.c.mthClose();
  await m.c.runLiveDelegation('again', m.c.liveTutor.generation);
  assert.equal(m.c.mthPad.open, false);
  m.c.stopLiveTutor();
});

test('only ONE floating box stands over the page, and neither outlives its worksheet', () => {
  const h = maths();
  h.c.mthShow({ from: 'hint', question: 'Q', ask: 'Find one unit.' });
  assert.equal(h.c.mthPad.open, true);
  // The keyword check cannot be offered on a maths worksheet at all, but a
  // box that opened anyway must still take the other one down.
  h.c.wsMeta.subject = 'science';
  h.c.kwQuizShow({ concept: 'c', sentence: 'a [1] b', blanks: [{ n: 1, answer: 'x' }], praise: 'p' }, { from: 'hint' });
  assert.equal(h.c.kwQuiz.open, true);
  assert.equal(h.c.mthPad.open, false);
  h.c.wsMeta.subject = 'math';
  h.c.mthShow({ from: 'hint', question: 'Q' });
  assert.equal(h.c.kwQuiz.open, false);
  assert.equal(h.c.mthPad.open, true);
  // A pad about the last worksheet must not sit over this one.
  h.c.wsEpoch++;
  h.c.mthRender();
  assert.equal(h.c.mthPad.open, false);
  assert.equal(h.element('mthPad').hidden, true);
});

test('a hint opens the working line off what the hint actually said, and costs no call', () => {
  const h = maths();
  const hint = {
    id: 'h1', number: '7', question: 'Ali has 60 sweets in 5 equal bags.',
    rungs: [{ key: 'nudge', text: 'Look at how many bags there are.' },
            { key: 'concepts', text: 'This is a sharing question.' },
            { key: 'method', text: 'Find how many are in one bag first.' }],
    shown: 2
  };
  h.c.hints = [hint];
  h.c.mthAfterHint(hint, h.c.wsEpoch);
  assert.equal(h.calls.ai.length, 0, 'the hint has just said what to do; asking a model to say it again is a wait for nothing');
  assert.equal(h.c.mthPad.open, true);
  assert.equal(h.c.mthPad.number, '7');
  assert.equal(h.c.mthPad.ask, 'This is a sharing question.', 'the LAST rung they have been shown');
  assert.doesNotMatch(h.c.mthPad.context, /one bag first/, 'a rung still folded away is one the ladder has not handed over');
  // A worksheet that has moved on since is not one to open a box about.
  h.c.mthClose();
  h.c.mthAfterHint(hint, h.c.wsEpoch - 1);
  assert.equal(h.c.mthPad.open, false);
});
