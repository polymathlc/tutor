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
const source = deadlineSource + syncTextSource + contextSource + html.slice(start, end);
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
  const calls = { media: [], fetch: [], ai: [], toast: [], timers: new Map(), peers: [], audio: [] };
  let nextTimer = 0;
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
    openBuddy() {}, usageNote() {}, setDirty() {}, syncTextEditValue() {},
    escHtml: value => String(value).replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]))
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
