import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { initialProfile, publicProfile, questsFor, learnerKey, weekInfo } = require('../functions/gamification-core.js');
const source = readFileSync(new URL('../adventure.js', import.meta.url), 'utf8');
const now = Date.UTC(2026, 8, 23, 3);
const task = { question: 'Why does ice melt in a warm room?', studentAnswer: 'It loses cold.', marked: true, verdict: 'wrong' };
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
async function until(check) {
  for (let i = 0; i < 200; i++) { if (check()) return; await new Promise(resolve => setTimeout(resolve, 1)); }
  assert.ok(check(), 'the expected asynchronous state should settle');
}
function element(tag = 'div', connected = false) {
  const el = { tagName: tag.toUpperCase(), children: [], listeners: {}, attributes: {}, hidden: false, value: '', textContent: '', parentNode: null,
    get isConnected() { return connected || !!this.parentNode?.isConnected; },
    appendChild(child) { child.parentNode = this; this.children.push(child); return child; },
    replaceChildren(...children) { this.children.forEach(child => { child.parentNode = null; }); this.children = []; children.forEach(child => this.appendChild(child)); },
    addEventListener(type, callback) { this.listeners[type] = callback; },
    setAttribute(name, value) { this.attributes[name] = String(value); },
    getAttribute(name) { return this.attributes[name] ?? null; },
    remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this); this.parentNode = null; },
    scrollIntoView() {}, click() { return this.listeners.click?.({ target: this }); }
  };
  return el;
}
function descendants(el) { return el.children.flatMap(child => [child, ...descendants(child)]); }
function canvasMock(h, encode) {
  const create = h.context.document.createElement, images = [];
  h.context.document.createElement = tag => {
    if (tag !== 'canvas') return create(tag);
    const canvas = { width: 0, height: 0, source: null,
      getContext: () => ({ fillRect() {}, drawImage(source) { canvas.source = source; } }),
      toDataURL(type, quality) { images.push({ width: canvas.width, height: canvas.height, source: canvas.source, type, quality }); return encode ? encode(canvas) : 'data:image/jpeg;base64,' + Buffer.from(canvas.source.label || 'picture').toString('base64'); }
    };
    return canvas;
  };
  return images;
}
function harness(options = {}) {
  const h = { calls: [], renders: [], celebrations: [], closeCount: 0, teacher: !!options.teacher, handler: null };
  const students = options.students || [{ name: 'Alice', level: 'P5', subject: 'both' }, { name: 'Ben', level: 'P4', subject: 'science' }];
  const nodes = new Map(['adventureHome', 'adventureSubjectBar', 'adventureSubject', 'adventureNav', 'adventureRewardStatus', 'adventureRetry', 'wsList'].map(id => [id, element('div', true)]));
  const makeUser = uid => ({ uid, getIdToken: async () => 'token:' + uid });
  const context = { console, setTimeout, clearTimeout, AbortController, TextEncoder, Uint8Array,
    crypto: webcrypto, currentUser: makeUser('parent'), myStudents: students, _activeIdx: options.activeIdx || 0,
    liveAppCheckToken: async () => 'app-check', isAdmin: () => h.teacher,
    activeStudent() { return this.myStudents[this._activeIdx] || this.myStudents[0] || null; },
    studentSubjectList(st) { return st.level === 'P3' ? ['science'] : st.subject === 'both' ? ['math', 'science'] : st.subject ? [st.subject] : []; },
    subjectLabel: sub => ({ math: 'Mathematics', science: 'Science' })[sub] || sub,
    showView() {}, renderMistakes() {}, openPeople() { h.peopleOpened = true; },
    document: { getElementById: id => nodes.get(id) || null, querySelectorAll: () => [], createElement: tag => element(tag) },
    StudyAdventureUI: { mount(config) { h.action = config.onAction; }, render(state) { h.renders.push(structuredClone(state)); }, celebrate(reward) { h.celebrations.push(structuredClone(reward)); }, close() { h.closeCount++; }, open() {} },
    fetch: async (url, opts) => {
      const body = JSON.parse(opts.body), call = { url, body, headers: opts.headers };
      h.calls.push(call);
      const result = h.handler ? await h.handler(body, call) : h.snapshot(body.studentIndex, body.subject);
      if (result?.status) return { ok: false, status: result.status, json: async () => result.data };
      return { ok: true, status: 200, json: async () => structuredClone(result) };
    }
  };
  context.window = context;
  h.snapshot = (index = 0, subject = 'math', values = {}) => {
    const st = students[index] || students[0], profile = { ...initialProfile({ uid: context.currentUser.uid, learnerKey: learnerKey(context.currentUser.uid, st.name) }), ...values };
    return { profile: publicProfile(profile, now), quests: questsFor(profile, now), leaderboard: { status: 'ready', level: st.level, subject, ...weekInfo(now), rows: [], myRank: null, totalParticipants: 0 }, serverTime: now };
  };
  h.context = context; h.nodes = nodes; h.user = makeUser;
  h.last = () => h.renders.at(-1);
  h.ready = () => until(() => h.last()?.profile && !h.last().loading);
  h.switchStudent = index => { context._activeIdx = index; context.StudyAdventure.sync(); };
  h.switchUser = uid => { context.currentUser = makeUser(uid); context.StudyAdventure.sync(); };
  vm.runInNewContext(source, context, { filename: 'adventure.js' });
  h.api = context.StudyAdventure;
  return h;
}

test('maps real backend profiles, quest progress, badges, week timing and private league status', async () => {
  const h = harness(); await h.ready();
  h.handler = () => {
    const data = h.snapshot(0, 'math', { xp: 435, completed: 12, corrected: 1, daily: { day: '2026-09-23', study: 1, practice: 3, correction: 1 }, activeDays: ['2026-09-23'] });
    data.leaderboard.status = 'approval_required'; return data;
  };
  await h.api.refresh();
  const state = h.last();
  assert.equal(state.profile.lifetimeXp, 435);
  assert.equal(state.profile.level, 3); assert.equal(state.profile.levelProgress, 35);
  assert.equal(state.profile.levelTarget, 200);
  assert.ok(state.profile.badges.every(b => b.earned));
  assert.ok(state.profile.badges.some(b => b.label === 'Comeback kid'));
  assert.equal(state.quests.find(q => q.id === 'practice').current, 3);
  assert.ok(state.quests.every(q => q.title && q.description));
  assert.equal(state.today, '2026-09-23'); assert.deepEqual(state.activeDays, ['2026-09-23']);
  assert.equal(state.leaderboard.approved, false); assert.match(state.leaderboard.reason, /teacher/);
  assert.equal(state.leaderboard.weekEndsAt, weekInfo(now).resetsAt);
});

test('an explicit unavailable worksheet subject is never credited to the default league', async () => {
  const h = harness({ students: [{ name: 'Ben', level: 'P4', subject: 'science' }] }); await h.ready();
  const captured = h.api.capture('math'); assert.equal(captured, null);
  h.api.marked([task], captured);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.calls.filter(c => c.body.action === 'attempt').length, 0);
  assert.equal(h.api.capture().subject, 'science');
});

test('a valid other-subject attempt keeps the chosen dashboard and leaderboard subject', async () => {
  const h = harness(); await h.ready();
  h.handler = body => { const data = h.snapshot(0, body.subject, { xp: 15, completed: 1 }); if (body.action === 'attempt') data.award = { xp: 15, kind: 'practice' }; return data; };
  h.api.marked([task], h.api.capture('science'));
  await until(() => h.celebrations.length === 1);
  assert.equal(h.calls.find(c => c.body.action === 'attempt').body.subject, 'science');
  assert.equal(h.last().leaderboard.groupLabel, 'P5 · Mathematics');
  assert.equal(h.last().profile.lifetimeXp, 15);
});

test('late sibling rewards cannot overwrite the active sibling or celebrate in their account', async () => {
  const h = harness(); await h.ready();
  const old = deferred(), oldContext = h.api.capture('math');
  h.handler = body => {
    if (body.action === 'attempt' && body.studentIndex === 0) return old.promise;
    const data = h.snapshot(body.studentIndex, body.subject, body.action === 'attempt' ? { xp: 15, completed: 1 } : {});
    if (body.action === 'attempt') data.award = { xp: 15, kind: 'practice' }; return data;
  };
  h.api.marked([task], oldContext);
  await until(() => h.calls.some(c => c.body.action === 'attempt'));
  h.switchStudent(1); await until(() => h.last()?.profile?.learnerKey === learnerKey('parent', 'Ben'));
  h.api.marked([task], oldContext); // A marking call that finished after switching is also stale.
  h.api.marked([task], h.api.capture('science'));
  old.resolve({ ...h.snapshot(0, 'math', { xp: 15, completed: 1 }), award: { xp: 15, kind: 'practice' } });
  await until(() => h.celebrations.length === 1);
  const attempts = h.calls.filter(c => c.body.action === 'attempt');
  assert.equal(attempts.length, 2); assert.deepEqual(attempts.map(c => c.body.studentIndex), [0, 1]);
  assert.equal(attempts[1].body.learnerKey, learnerKey('parent', 'Ben'));
  assert.equal(h.last().profile.learnerKey, learnerKey('parent', 'Ben'));
  assert.ok(h.closeCount >= 2, 'switching learners dismisses the previous private modal');
});

test('changing account while authentication is pending prevents the old attempt from being sent', async () => {
  const h = harness(); await h.ready();
  const token = deferred(); h.context.currentUser.getIdToken = () => token.promise;
  h.api.marked([task], h.api.capture('math'));
  h.switchUser('another-parent');
  await until(() => h.last()?.profile?.learnerKey === learnerKey('another-parent', 'Alice'));
  token.resolve('old-account-token'); await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.calls.filter(c => c.body.action === 'attempt').length, 0);
  assert.equal(h.celebrations.length, 0);
});

test('the first request is name-bound and follows activeStudent fallback when a saved index is stale', async () => {
  const h = harness({ activeIdx: 7 }); await h.ready();
  assert.equal(h.calls[0].body.studentIndex, 0);
  assert.equal(h.calls[0].body.learnerKey, learnerKey('parent', 'Alice'));
  assert.equal(h.calls[0].headers['X-Firebase-AppCheck'], 'app-check');
  assert.equal(h.calls[0].headers.Authorization, 'Bearer token:parent');
});

test('duplicate queued attempts collapse and a transient failure stays retryable', async () => {
  const h = harness(); await h.ready();
  let attempts = 0;
  h.handler = body => {
    if (body.action !== 'attempt') return h.snapshot();
    attempts++;
    if (attempts === 1) return { status: 503, data: { error: { code: 'game_unavailable', message: 'Please retry shortly.' } } };
    return { ...h.snapshot(0, 'math', { xp: 15, completed: 1 }), award: { xp: 15, kind: 'practice' } };
  };
  const c = h.api.capture('math'); h.api.marked([task, task], c);
  await until(() => h.last()?.error === 'Please retry shortly.');
  assert.equal(attempts, 1); assert.match(h.nodes.get('adventureRewardStatus').textContent, /1 practice reward/);
  await h.action('refresh');
  assert.equal(attempts, 2); assert.equal(h.celebrations.length, 1);
  assert.deepEqual(h.calls.filter(c => c.body.action === 'attempt').map(c => c.body.question), [task.question, task.question]);
  assert.doesNotMatch(h.nodes.get('adventureRewardStatus').textContent, /waiting to sync/);
});

test('an in-flight server verification conflict is retained for retry, then deduplicated by the server', async () => {
  const h = harness(); await h.ready(); let attempts = 0;
  h.handler = body => {
    if (body.action !== 'attempt') return h.snapshot();
    if (++attempts === 1) return { status: 409, data: { error: { code: 'already_checking', message: 'Already checking.' } } };
    return { ...h.snapshot(0, 'math', { xp: 15 }), award: { xp: 0, reason: 'already_rewarded', duplicate: true } };
  };
  h.api.marked([task], h.api.capture()); await until(() => h.last()?.error === 'Already checking.');
  assert.match(h.nodes.get('adventureRewardStatus').textContent, /waiting to sync/);
  await h.action('refresh'); assert.equal(attempts, 2); assert.equal(h.celebrations.length, 0);
  assert.equal(h.last().profile.lifetimeXp, 15);
});

test('a delayed older snapshot cannot undo a newer saved preference', async () => {
  const h = harness(); await h.ready(); const preference = deferred(), refresh = deferred();
  h.handler = body => body.action === 'preferences' ? preference.promise : refresh.promise;
  const saving = h.action('optIn', { optIn: true });
  await until(() => h.calls.some(c => c.body.action === 'preferences'));
  const loading = h.api.refresh();
  await until(() => h.calls.filter(c => c.body.action === 'snapshot').length === 2);
  preference.resolve({ ...h.snapshot(0, 'math', { optIn: true }), serverTime: now + 2000 }); await saving;
  refresh.resolve({ ...h.snapshot(0, 'math', { optIn: false }), serverTime: now + 1000 }); await loading;
  assert.equal(h.last().profile.optIn, true); assert.equal(h.last().saving, false);
});

test('malformed successful API responses do not reset earned progress', async () => {
  const h = harness(); await h.ready();
  h.handler = () => h.snapshot(0, 'math', { xp: 200 }); await h.api.refresh();
  h.handler = () => ({}); await h.api.refresh();
  assert.equal(h.last().profile.lifetimeXp, 200); assert.match(h.last().error, /read your progress/);
});

test('teacher controls inspect each subject and read approval from the returned memberships', async () => {
  const h = harness({ teacher: true });
  h.handler = body => {
    const memberships = { math: { approved: body.action === 'approveMember' ? body.approved : false, level: 'P5' }, science: { approved: true, level: 'P5' } };
    return { learnerKey: learnerKey('student-parent', 'Alice'), alias: 'Curious Comet', memberships };
  };
  const host = element('div', true);
  h.api.teacherControls({ id: 'student-parent', learners: [{ name: 'Alice', level: 'P5', subject: 'both' }] }, host);
  await until(() => descendants(host).filter(el => el.tagName === 'BUTTON').length === 2);
  assert.deepEqual(h.calls.map(c => c.body.subject).sort(), ['math', 'science']);
  let math = descendants(host).find(el => el.tagName === 'BUTTON' && el.textContent.includes('Mathematics'));
  assert.equal(math.getAttribute('aria-pressed'), 'false'); await math.click();
  math = descendants(host).find(el => el.tagName === 'BUTTON' && el.textContent.includes('Mathematics'));
  assert.equal(math.getAttribute('aria-pressed'), 'true'); await math.click();
  math = descendants(host).find(el => el.tagName === 'BUTTON' && el.textContent.includes('Mathematics'));
  assert.equal(math.getAttribute('aria-pressed'), 'false');
  assert.deepEqual(h.calls.filter(c => c.body.action === 'approveMember').map(c => c.body.approved), [true, false]);
});

test('a teacher can revoke memberships from a previous subject or grade after profile edits', async () => {
  const h = harness({ teacher: true });
  h.handler = body => ({ memberships: {
    science: { approved: false, registered: true, level: 'P5' },
    math: { approved: false, registered: !(body.action === 'approveMember'), level: body.action === 'approveMember' ? 'P6' : 'P5' }
  } });
  const host = element('div', true);
  h.api.teacherControls({ id: 'student-parent', learners: [{ name: 'Alice', level: 'P6', subject: 'science' }] }, host);
  await until(() => descendants(host).filter(el => el.tagName === 'BUTTON').length === 3);
  const previousMath = descendants(host).find(el => el.textContent === 'Revoke prior Mathematics · P5');
  assert.ok(previousMath); await previousMath.click();
  const request = h.calls.find(c => c.body.action === 'approveMember');
  assert.equal(request.body.subject, 'math'); assert.equal(request.body.approved, false);
  assert.equal(descendants(host).filter(el => el.tagName === 'BUTTON' && /Mathematics/.test(el.textContent)).length, 0);
  assert.ok(descendants(host).some(el => el.textContent === 'Revoke prior Science · P5'));
});

test('worksheet diagrams are captured once per page and stay bound while queued work changes', async () => {
  const h = harness(); await h.ready(); const images = canvasMock(h), first = deferred();
  h.context.pages = [{ num: 2, canvas: { width: 1600, height: 2000, label: 'original diagram' } }];
  let count = 0;
  h.handler = body => {
    if (body.action === 'attempt' && ++count === 1) return first.promise;
    return { ...h.snapshot(), award: { xp: 0, reason: 'already_rewarded' } };
  };
  h.api.marked([{ ...task, page: 2 }, { ...task, page: 2, question: 'Why does water condense on a cold glass?' }], h.api.capture());
  assert.equal(images.length, 1); assert.equal(images[0].width, 720); assert.equal(images[0].height, 900); assert.equal(images[0].quality, 0.7);
  await until(() => h.calls.some(c => c.body.action === 'attempt'));
  h.context.pages = [{ num: 2, canvas: { width: 1000, height: 1000, label: 'a different worksheet' } }];
  first.resolve({ ...h.snapshot(), award: { xp: 0, reason: 'already_rewarded' } });
  await until(() => h.calls.filter(c => c.body.action === 'attempt').length === 2);
  const pictures = h.calls.filter(c => c.body.action === 'attempt').map(c => c.body.questionImage);
  assert.equal(pictures[0], pictures[1]); assert.equal(Buffer.from(pictures[1].split(',')[1], 'base64').toString(), 'original diagram');
});

test('unreadable or oversized images fall back to text without losing the practice attempt', async () => {
  const h = harness(); await h.ready(); const images = canvasMock(h, () => 'data:image/jpeg;base64,' + 'A'.repeat(1400000));
  h.context.pages = [{ num: 1, canvas: { width: 2000, height: 3000 } }];
  h.api.marked([{ ...task, page: 1 }], h.api.capture());
  await until(() => h.calls.some(c => c.body.action === 'attempt'));
  const attempt = h.calls.find(c => c.body.action === 'attempt');
  assert.equal(attempt.body.questionImage, undefined); assert.equal(attempt.body.question, task.question);
  assert.deepEqual(images.map(image => image.height), [900, 675, 450]);
});

test('mistake diagrams are loaded from their stored image and cannot follow a sibling switch', async () => {
  const h = harness(); await h.ready(); const images = canvasMock(h), stored = deferred();
  h.context.mistakeImageUrl = async () => 'https://storage.example/own-mistake.jpg';
  h.context.mbStoredPage = async url => { assert.equal(url, 'https://storage.example/own-mistake.jpg'); return stored.promise; };
  const checking = h.api.practice(task, 'It gains heat.', h.api.capture('math'));
  h.switchStudent(1); await until(() => h.last()?.profile?.learnerKey === learnerKey('parent', 'Ben'));
  stored.resolve({ width: 800, height: 1000, label: 'the old sibling’s mistake' }); await checking;
  assert.equal(images.length, 0); assert.equal(h.calls.filter(c => c.body.action === 'attempt').length, 0);
});

test('a saved mistake diagram accompanies its correction when the learner stays active', async () => {
  const h = harness(); await h.ready(); canvasMock(h);
  h.context.mistakeImageUrl = async () => 'https://storage.example/own-mistake.jpg';
  h.context.mbStoredPage = async () => ({ width: 800, height: 1000, label: 'a diagram about heat' });
  await h.api.practice(task, 'It gains heat.', h.api.capture());
  await until(() => h.calls.some(c => c.body.action === 'attempt'));
  const body = h.calls.find(c => c.body.action === 'attempt').body;
  assert.equal(body.kind, 'correction'); assert.match(body.questionImage, /^data:image\/jpeg;base64,/);
  assert.equal(body.answer, 'It gains heat.');
});
