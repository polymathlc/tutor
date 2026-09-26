import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

const source = readFileSync(new URL('../centre-admin.js', import.meta.url), 'utf8');
const students = [{ name: 'Alice', level: 'P5', subject: 'both' }, { name: 'Ben', level: 'P3', subject: 'science' }];
const clone = value => JSON.parse(JSON.stringify(value));
function practiceClaims(overrides = {}) {
  return { centrePractice: true, centreStudentIndex: 1, centrePracticeExpiresAt: Math.floor(Date.now() / 1000) + 3600,
    centreActorUid: 'teacher', centreStudentKey: 'a'.repeat(64), firebase: { sign_in_provider: 'custom' }, ...overrides };
}
function descendants(el) { return el.children.flatMap(child => [child, ...descendants(child)]); }
function harness(options = {}) {
  const h = { calls: [], events: [], notices: [], profile: { tutorOnboard: { students: clone(students) } } };
  function matches(el, selector) {
    if (selector === 'header') return el.tagName === 'HEADER';
    if (selector.startsWith('#')) return el.id === selector.slice(1);
    if (selector === '.modalBack.open') return el.className.includes('modalBack') && el.className.includes('open');
    if (selector.startsWith('[tabindex')) return el.attributes.tabindex === '0';
    return el.tagName === selector.split(':')[0].toUpperCase() && (!selector.includes(':not([disabled])') || !el.disabled);
  }
  function element(tag) {
    const el = { tagName: tag.toUpperCase(), id: '', className: '', children: [], listeners: {}, attributes: {}, value: '', textContent: '', hidden: false, disabled: false, parentNode: null,
      get isConnected() { return this === document.body || !!this.parentNode?.isConnected; },
      get firstChild() { return this.children[0]; },
      appendChild(child) { child.parentNode = this; this.children.push(child); return child; },
      prepend(child) { child.parentNode = this; this.children.unshift(child); },
      replaceChildren(...children) { this.children.forEach(child => { child.parentNode = null; }); this.children = []; children.forEach(child => this.appendChild(child)); },
      remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this); this.parentNode = null; },
      setAttribute(key, value) { this.attributes[key] = String(value); },
      addEventListener(type, fn) { this.listeners[type] = fn; },
      querySelectorAll(selector) { return descendants(this).filter(el => selector.split(',').some(s => matches(el, s.trim()))); },
      querySelector(selector) { return this.querySelectorAll(selector)[0] || null; },
      focus() { document.activeElement = this; },
      reportValidity() { return this.querySelectorAll('input, select').filter(input => input.required).every(input => input.disabled || input.value); },
      async click() { if (!this.disabled) return this.listeners.click?.({ preventDefault() {} }); },
      classList: { remove() {} }
    }; return el;
  }
  const document = { activeElement: null, createElement: element,
    querySelectorAll(selector) { return this.body.querySelectorAll(selector); },
    querySelector(selector) { return this.body.querySelector(selector); },
    getElementById(id) { return this.body.querySelector('#' + id); }
  };
  document.body = element('body'); document.body.appendChild(element('header'));
  const context = { console, document, crypto: webcrypto, Uint8Array, AbortController, Date,
    setTimeout(fn, ms) { const timer = setTimeout(fn, ms); if (ms > 1000) timer.unref(); return timer; }, clearTimeout,
    currentUser: { uid: 'teacher', email: 'teacher@example.test', getIdToken: async () => 'teacher-token' },
    isAdmin: account => account?.uid === 'teacher',
    liveAppCheckToken: async () => 'app-check',
    myStudents: clone(students), _activeIdx: 0,
    activeStudent() { return context.myStudents[context._activeIdx] || null; },
    setActiveIdx(index) { context._activeIdx = index; },
    normStudents(raw) { return (Array.isArray(raw) ? raw : []).map(st => typeof st === 'string' ? { name: st.trim(), level: '', subject: '' } : clone(st)).filter(st => st.name); },
    peopleRef: uid => ({ async get(opts) { h.events.push(['read', uid, opts]); if (h.readError) throw h.readError; return { exists: !h.missing, data: () => clone(h.profile) }; } }),
    peopleLoad: async force => { h.events.push(['refresh', force]); if (h.refreshError) throw h.refreshError; },
    renderPeople: state => h.events.push(['renderPeople', state]),
    toast: text => h.notices.push(text),
    lessonBusy: () => !!options.lessonBusy,
    stopLiveTutor: () => h.events.push(['stopLive']),
    flushSave: () => h.events.push(['flushSave']),
    performSave: async () => { h.events.push(['save']); if (options.saveFails) return false; context.dirty = false; return true; },
    dirty: !!options.dirty, currentDocId: options.dirty ? 'worksheet' : null, savingNow: false,
    firebase: { auth: { Auth: { Persistence: { SESSION: 'session' } } } },
    auth: {
      async signOut() { h.events.push(['signOut']); context.currentUser = null; },
      async setPersistence(value) { h.events.push(['persistence', value]); },
      async signInWithCustomToken(token) { h.events.push(['signInWithCustomToken', token]); }
    },
    location: { reload() { h.events.push(['reload']); } },
    fetch: async (url, opts) => {
      const body = JSON.parse(opts.body); h.calls.push({ url, body, headers: opts.headers }); h.events.push(['api', body.action]);
      const data = h.response ? await h.response(body) : { targetUid: body.targetUid || 'new-student', studentIndex: body.studentIndex || 0, student: body.student || body.expectedStudent || { name: body.name, level: body.level, subject: body.subject }, token: 'student-custom-token' };
      return { ok: !data.status, status: data.status || 200, json: async () => data.status ? data.body : data };
    }
  };
  context.window = context; vm.runInNewContext(source, context, { filename: 'centre-admin.js' });
  h.context = context; h.api = context.CentreAdmin; h.document = document;
  h.buttons = () => document.querySelectorAll('button');
  h.button = text => h.buttons().find(button => button.textContent === text);
  h.field = (id, value) => { const input = document.getElementById(id); input.value = value; return input; };
  h.addForm = () => { h.api.openCreate(); h.field('centreStudentName', 'New Learner'); h.field('centreStudentLevel', 'P4'); h.field('centreStudentSubject', 'math'); };
  h.controls = () => h.api.appendAccountControls(document.body, { id: 'parent-account' });
  return h;
}
async function until(check) {
  for (let i = 0; i < 100; i++) { if (check()) return; await new Promise(resolve => setTimeout(resolve, 1)); }
  assert.ok(check(), 'asynchronous UI should settle');
}

test('creates an independent student with admin and app verification, then refreshes roster', async () => {
  const h = harness(); h.addForm(); await h.button('Add student').click();
  assert.equal(h.calls.length, 1);
  assert.deepEqual(clone(h.calls[0].headers), { 'Content-Type': 'application/json', Authorization: 'Bearer teacher-token', 'X-Firebase-AppCheck': 'app-check' });
  assert.match(h.calls[0].body.requestId, /^[0-9a-f-]{36}$/);
  assert.deepEqual({ ...h.calls[0].body, requestId: '' }, { action: 'createStudent', requestId: '', name: 'New Learner', level: 'P4', subject: 'math' });
  assert.ok(h.events.some(event => event[0] === 'refresh' && event[1]));
  assert.ok(h.button('Practise as New Learner'));
});

test('retry after an uncertain create keeps both the request ID and original input', async () => {
  const h = harness(); let failed = false;
  h.response = body => { if (!failed) { failed = true; throw new TypeError('network'); } return { targetUid: 'created', student: body }; };
  h.addForm(); await h.button('Add student').click();
  assert.equal(h.document.getElementById('centreStudentName').disabled, true);
  h.field('centreStudentName', 'Changed after timeout');
  await h.button('Retry adding student').click();
  assert.equal(h.calls[0].body.requestId, h.calls[1].body.requestId);
  assert.equal(h.calls[1].body.name, 'New Learner');
});

test('P3 only offers Science and invalid access is not submitted', async () => {
  const h = harness(); h.addForm(); const level = h.field('centreStudentLevel', 'P3'); level.listeners.change();
  assert.deepEqual(h.document.getElementById('centreStudentSubject').children.map(opt => opt.value), ['science']);
  h.field('centreStudentSubject', 'both'); await h.button('Add student').click();
  assert.equal(h.calls.length, 0);
});

test('English access is accepted for a supported level', async () => {
  const h = harness(); h.addForm(); h.field('centreStudentSubject', 'english'); await h.button('Add student').click();
  assert.equal(h.calls[0].body.subject, 'english'); assert.equal(h.calls[0].body.level, 'P4');
});

test('Chinese access is accepted for Secondary 1', async () => {
  const h = harness(); h.addForm(); h.field('centreStudentLevel', 'S1'); h.field('centreStudentSubject', 'chinese'); await h.button('Add student').click();
  assert.equal(h.calls[0].body.subject, 'chinese'); assert.equal(h.calls[0].body.level, 'S1');
});

test('a missing centre service gives a visible error and no success', async () => {
  const h = harness(); h.response = () => ({ status: 404, body: {} });
  h.addForm(); await h.button('Add student').click();
  assert.match(h.document.querySelectorAll('p').map(el => el.textContent).join(' '), /not available on the server/);
  assert.equal(h.button('Practise as New Learner'), undefined);
  assert.equal(h.events.some(event => event[0] === 'refresh'), false);
});

test('renders every child from the latest server profile and edits one with its expected identity', async () => {
  const h = harness(); h.controls(); await until(() => h.button('Practise as Ben'));
  const title = h.document.createElement('h2'); title.id = 'personTitle'; title.textContent = 'Ben (P3 Science)'; h.document.body.appendChild(title);
  h.context.peopleLoad = async () => { h.context._peopleRows = [{ id: 'parent-account', students: ['Alice (P5 Both)', 'Ben (P4 Both)'] }]; };
  assert.equal(h.buttons().filter(button => button.textContent === 'Edit access').length, 2);
  await h.buttons().filter(button => button.textContent === 'Edit access')[1].click();
  assert.equal(h.document.getElementById('centreStudentName').readOnly, true);
  h.field('centreStudentLevel', 'P4'); h.field('centreStudentSubject', 'both'); await h.button('Save access').click();
  assert.deepEqual(h.calls[0].body, { action: 'updateStudent', targetUid: 'parent-account', studentIndex: 1, student: { name: 'Ben', level: 'P4', subject: 'both' }, expectedStudent: students[1] });
  assert.deepEqual(clone(h.events.find(event => event[0] === 'read')[2]), { source: 'server' });
  assert.equal(title.textContent, 'Alice (P5 Both), Ben (P4 Both)');
});

test('legacy single-student accounts can have their level and subjects completed', async () => {
  const h = harness(); h.profile = { name: 'Older Student', level: '', subject: '' }; h.controls();
  await until(() => h.button('Practise as Older Student'));
  assert.equal(h.button('Practise as Older Student').disabled, true);
  await h.button('Edit access').click();
  h.field('centreStudentLevel', 'P6'); h.field('centreStudentSubject', 'math'); await h.button('Save access').click();
  assert.deepEqual(h.calls[0].body.expectedStudent, { name: 'Older Student', level: '', subject: '' });
  assert.equal(h.calls[0].body.studentIndex, 0);
});

test('account read failures show retry and never offer practice from a cached row', async () => {
  const h = harness(); h.readError = new Error('permission denied'); h.controls(); await until(() => h.button('Retry'));
  assert.equal(h.buttons().some(button => button.textContent.startsWith('Practise as')), false);
  assert.match(h.document.querySelectorAll('p').map(el => el.textContent).join(' '), /could not be read/);
});

test('practice saves current work, requests a chosen child, signs out, sets session persistence, and reloads', async () => {
  const h = harness({ dirty: true }); h.controls(); await until(() => h.button('Practise as Ben'));
  await h.button('Practise as Ben').click(); await h.button('Start practice').click();
  assert.deepEqual(h.calls[0].body, { action: 'startPractice', targetUid: 'parent-account', studentIndex: 1, expectedStudent: students[1] });
  const actions = h.events.map(event => event[0]);
  assert.ok(actions.indexOf('save') < actions.indexOf('api'));
  assert.ok(actions.indexOf('signOut') < actions.indexOf('persistence'));
  assert.ok(actions.indexOf('persistence') < actions.indexOf('signInWithCustomToken'));
  assert.ok(actions.indexOf('signInWithCustomToken') < actions.indexOf('reload'));
  assert.deepEqual(h.events.find(event => event[0] === 'persistence'), ['persistence', 'session']);
});

test('failed worksheet save prevents issuing a practice token or changing account', async () => {
  const h = harness({ dirty: true, saveFails: true }); h.controls(); await until(() => h.button('Practise as Alice'));
  await h.button('Practise as Alice').click(); await h.button('Start practice').click();
  assert.equal(h.calls.length, 0); assert.equal(h.events.some(event => event[0] === 'signOut'), false);
  assert.match(h.document.querySelectorAll('p').map(el => el.textContent).join(' '), /could not be saved/);
});

test('unfinished recording prevents changing account', async () => {
  const h = harness({ lessonBusy: true }); h.controls(); await until(() => h.button('Practise as Alice'));
  await h.button('Practise as Alice').click(); await h.button('Start practice').click();
  assert.equal(h.calls.length, 0); assert.equal(h.events.some(event => event[0] === 'signOut'), false);
});

test('practice selection comes only from signed, unexpired claims and ending signs out', async () => {
  const h = harness(); const claims = practiceClaims();
  h.context.currentUser = { uid: 'parent-account', getIdTokenResult: async () => ({ claims }) };
  await h.api.authReady(h.context.currentUser);
  assert.equal(h.api.isPractice(), true); assert.equal(h.api.lockedStudentIndex(), 1); assert.equal(h.context._activeIdx, 1);
  assert.equal(h.document.getElementById('centrePracticeName').textContent, 'Practising as Ben');
  await h.api.endPractice(false);
  assert.equal(h.api.isPractice(), false); assert.equal(h.document.getElementById('centrePracticeBanner'), null);
  assert.ok(h.events.some(event => event[0] === 'signOut')); assert.ok(h.events.some(event => event[0] === 'reload'));
});

test('expired, malformed and ordinary-user claims never create a practice session', async () => {
  const h = harness();
  for (const claims of [
    practiceClaims({ centreStudentIndex: 0, centrePracticeExpiresAt: 1 }),
    practiceClaims({ centreStudentIndex: -1 }), practiceClaims({ centreStudentIndex: '1' }),
    practiceClaims({ centrePracticeExpiresAt: Math.floor(Date.now() / 1000) + 3600.5 }),
    practiceClaims({ firebase: { sign_in_provider: 'google.com' } }), practiceClaims({ firebase: {} }),
    practiceClaims({ centreActorUid: 'student' }), practiceClaims({ centreActorUid: '' }), practiceClaims({ centreActorUid: 'invalid/uid' }),
    practiceClaims({ centreStudentKey: 'A'.repeat(64) }), practiceClaims({ centreStudentKey: 'a'.repeat(63) }), practiceClaims({ centreStudentKey: '' }),
    practiceClaims({ email: 'CHUNGZHIKAI@gmail.com' }), practiceClaims({ email: 'abigail.yew@stanfordmanpower.com' }),
    practiceClaims({ admin: true }), practiceClaims({ roles: ['teacher'] }), practiceClaims({ role: 'owner' }), practiceClaims({ roles: { staff: true } })
  ]) {
    await assert.rejects(h.api.authReady({ uid: 'student', getIdTokenResult: async () => ({ claims }) }), /session has ended/);
    assert.equal(h.api.isPractice(), false);
  }
  assert.equal(await h.api.authReady({ uid: 'student', getIdTokenResult: async () => ({ claims: {} }) }), null);
  assert.equal(h.api.lockedStudentIndex(), null);
});

test('protected account email and provider identities cannot enter centre practice', async () => {
  const h = harness();
  for (const fields of [{ email: 'chungzhikai@gmail.com' }, { providerData: [{ email: 'abigail.yew@stanfordmanpower.com' }] }, { disabled: true }]) {
    await assert.rejects(h.api.authReady({ uid: 'student', ...fields, getIdTokenResult: async () => ({ claims: practiceClaims() }) }), /could not be verified/);
    assert.equal(h.api.isPractice(), false);
  }
});

test('expiry waits for worksheet save before signing out', async () => {
  const h = harness({ dirty: true });
  h.context.currentUser = { uid: 'parent-account', getIdTokenResult: async () => ({ claims: practiceClaims() }) };
  await h.api.authReady(h.context.currentUser);
  let completeSave;
  h.context.performSave = () => new Promise(resolve => { h.events.push(['save']); completeSave = () => { h.context.dirty = false; resolve(true); }; });
  const ending = h.api.endPractice(true);
  await until(() => completeSave);
  assert.equal(h.events.some(event => event[0] === 'signOut'), false);
  assert.equal(h.api.isPractice(), true);
  completeSave(); await ending;
  assert.ok(h.events.some(event => event[0] === 'signOut'));
  assert.equal(h.api.isPractice(), false);
});

test('failed save at expiry keeps student signed in with a visible retry', async () => {
  const h = harness({ dirty: true, saveFails: true });
  h.context.currentUser = { uid: 'parent-account', getIdTokenResult: async () => ({ claims: practiceClaims() }) };
  await h.api.authReady(h.context.currentUser); await h.api.endPractice(true);
  assert.equal(h.api.isPractice(), true); assert.equal(h.events.some(event => event[0] === 'signOut'), false);
  assert.match(h.document.getElementById('centrePracticeName').textContent, /Practice time has ended.*could not be saved/);
  assert.ok(h.button('Retry ending practice'));
  h.context.performSave = async () => { h.context.dirty = false; return true; };
  await h.button('Retry ending practice').click();
  await until(() => !h.api.isPractice());
  assert.equal(h.api.isPractice(), false); assert.ok(h.events.some(event => event[0] === 'signOut'));
});

test('signing out while claims load cannot restore the old practice session', async () => {
  const h = harness(); let resolve;
  const pending = h.api.authReady({ uid: 'student', getIdTokenResult: () => new Promise(done => { resolve = done; }) });
  h.api.clearSession(); resolve({ claims: practiceClaims({ centreStudentIndex: 0 }) });
  assert.equal(await pending, null); assert.equal(h.api.isPractice(), false);
});
