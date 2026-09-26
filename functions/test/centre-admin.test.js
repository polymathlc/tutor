'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createCentreService, validateBody, MAX_REQUEST_BYTES } = require('../centre-admin-service');
const { createCentreRepository, AUDIT_COLLECTION } = require('../centre-admin-repository');
const { ADMIN_EMAIL, PRACTICE_SECONDS, centreStudentKey, isCentrePractice, isSupportedStudent, matchesCentreStudent } = require('../centre-auth');
const { APP_ID } = require('../live-service');
const student = { name: 'Ada', level: 'P5', subject: 'both' };
const second = { name: 'Grace', level: 'P4', subject: 'science' };
const requestId = '61b928f1-29f7-447d-9026-3837440af247';
const time = 1800000000000;
const clone = value => value === undefined ? undefined : structuredClone(value);

function store() {
  const records = new Map();
  const snapshot = ref => ({ exists: records.has(ref.path), data: () => clone(records.get(ref.path)) });
  const doc = path => ({ path, get: async () => snapshot({ path }) });
  const db = {
    collection: name => ({ doc: id => doc(name + '/' + id) }),
    async runTransaction(run) {
      const writes = [];
      const answer = await run({ get: async ref => snapshot(ref),
        set: (ref, value) => writes.push(() => records.set(ref.path, clone(value))),
        update: (ref, value) => writes.push(() => records.set(ref.path, { ...records.get(ref.path), ...clone(value) })) });
      writes.forEach(write => write()); return answer;
    }
  };
  const accounts = new Map(), authCalls = [];
  const auth = {
    async getUser(uid) { authCalls.push(['get', uid]); if (!accounts.has(uid)) throw Object.assign(new Error('not found'), { code: 'auth/user-not-found' }); return clone(accounts.get(uid)); },
    async createUser(data) { authCalls.push(['create', clone(data)]); if (accounts.has(data.uid)) throw Object.assign(new Error('exists'), { code: 'auth/uid-already-exists' }); accounts.set(data.uid, clone(data)); return clone(data); }
  };
  const profile = { name: 'Parent name from another app', email: 'parent@example.com', otherApp: { keep: true }, tutorUsage: { hints: 12 },
    tutorOnboard: { v: 2, parent: 'Parent', fee: '$100 a month', payingFee: true, enrolled: false,
      untouched: 'onboarding metadata', students: [{ ...student, extra: 'preserve' }, second] } };
  records.set('studentProfiles/parent', clone(profile)); accounts.set('parent', { uid: 'parent', email: 'parent@example.com', customClaims: {} });
  const repository = createCentreRepository(db, auth);
  return { records, accounts, authCalls, auth, db, profile, repository };
}
function service() {
  const calls = [], user = { uid: 'teacher', email: ADMIN_EMAIL, email_verified: true, firebase: { sign_in_provider: 'google.com' } };
  const resolved = { targetUid: 'parent', studentIndex: 1, student: second, profile: {}, students: [student, second] };
  const deps = { now: () => time, report: code => calls.push(['report', code]),
    auth: { async verifyIdToken(token, revoked) { calls.push(['verify', token, revoked]); return user; },
      async createCustomToken(uid, claims) { calls.push(['mint', uid, claims]); return 'private-custom-token'; } },
    appCheck: { async verifyToken(token) { calls.push(['appCheck', token]); return { appId: APP_ID }; } },
    repository: Object.fromEntries(['createStudent', 'updateStudent', 'startPractice'].map(method => [method, async (...args) => { calls.push([method, ...args]); return resolved; }])) };
  const instance = createCentreService(deps);
  async function request(body = { action: 'startPractice', targetUid: 'parent', studentIndex: 1, expectedStudent: second }, options = {}) {
    const headers = { origin: 'https://polymathlc.github.io', authorization: 'Bearer id-token', 'x-firebase-appcheck': 'app-check', 'content-type': 'application/json', ...options.headers };
    const req = { method: options.method || 'POST', body, rawBody: options.rawBody, get: key => headers[key.toLowerCase()] };
    const res = { headers: {}, statusCode: 200, set(key, value) { this.headers[key] = value; return this; }, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; }, send(value) { this.body = value; return this; } };
    await instance.handler(req, res); return res;
  }
  return { calls, user, deps, request };
}

test('teacher identity, revocation and App Check are required before any mutation or token mint', async () => {
  for (const claims of [{ email: 'other@example.com', admin: true }, { email_verified: false }, { firebase: { sign_in_provider: 'custom' } }, { centrePractice: true }]) {
    const h = service(); Object.assign(h.user, claims);
    assert.equal((await h.request()).statusCode, 403);
    assert.ok(!h.calls.some(call => ['startPractice', 'mint'].includes(call[0])));
  }
  const forged = service(); forged.deps.auth.verifyIdToken = async () => { throw new Error('forged token secret'); };
  assert.equal((await forged.request()).statusCode, 401);
  assert.ok(!forged.calls.some(call => call[0] === 'mint'));
  for (const headers of [{ authorization: '' }, { 'x-firebase-appcheck': '' }]) {
    const h = service(); assert.ok((await h.request(undefined, { headers })).statusCode >= 400);
    assert.ok(!h.calls.some(call => call[0] === 'startPractice'));
  }
  const wrongApp = service(); wrongApp.deps.appCheck.verifyToken = async () => ({ appId: 'other-app' });
  assert.equal((await wrongApp.request()).statusCode, 403);
});

test('practice token is bounded to the resolved account, child and four-hour expiry; no admin token is returned', async () => {
  const h = service(), response = await h.request();
  assert.equal(response.statusCode, 200);
  assert.deepEqual(h.calls.slice(0, 2), [['verify', 'id-token', true], ['appCheck', 'app-check']]);
  const claim = h.calls.find(call => call[0] === 'mint');
  assert.equal(claim[1], 'parent');
  assert.deepEqual(claim[2], { centrePractice: true, centreActorUid: 'teacher', centreStudentIndex: 1,
    centreStudentKey: centreStudentKey(second), centrePracticeExpiresAt: time / 1000 + PRACTICE_SECONDS });
  assert.equal(response.headers['Cache-Control'], 'no-store');
  assert.equal(response.body.token, 'private-custom-token');
  assert.equal(response.body.profile, undefined);
});

test('CORS, methods, body limits and invalid student fields fail without side effects', async () => {
  const h = service();
  assert.equal((await h.request(undefined, { headers: { origin: 'https://attacker.example' } })).statusCode, 403);
  assert.deepEqual(h.calls, []);
  assert.equal((await h.request(undefined, { method: 'OPTIONS' })).statusCode, 204);
  assert.equal((await h.request(undefined, { method: 'GET' })).statusCode, 405);
  assert.equal((await h.request(undefined, { rawBody: { length: MAX_REQUEST_BYTES + 1 } })).statusCode, 413);
  const base = { action: 'createStudent', requestId, ...student };
  for (const body of [null, [], { ...base, requestId: 'not-uuid' }, { ...base, name: '' }, { ...base, level: 'P1' },
    { ...base, level: 'P3', subject: 'math' }, { ...base, subject: 'history' },
    { action: 'startPractice', targetUid: '../teacher', studentIndex: 0, expectedStudent: student },
    { action: 'startPractice', targetUid: 'parent', studentIndex: 8, expectedStudent: student },
    { action: 'startPractice', targetUid: 'parent', studentIndex: 0 }]) {
    const invalid = service(); assert.equal((await invalid.request(body)).statusCode, 400); assert.deepEqual(invalid.calls, []);
  }
  assert.equal(validateBody({ ...base, level: 'S1', subject: 'math' }).student.level, 'S1');
  for (const subject of ['english', 'chinese']) {
    const h = service();
    assert.equal((await h.request({ ...base, subject })).statusCode, 200);
    assert.equal(h.calls.find(call => call[0] === 'createStudent')[3].subject, subject);
    assert.throws(() => validateBody({ ...base, level: 'P3', subject }), { code: 'invalid_student' });
  }
});

test('creation retries return one no-email Auth account and one profile without changing later edits', async () => {
  const h = store();
  const first = await h.repository.createStudent('teacher', requestId, student, time);
  const later = h.records.get('studentProfiles/' + first.targetUid); later.externalMetadata = 'keep'; later.tutorUsage = { hints: 2 };
  const retry = await h.repository.createStudent('teacher', requestId, student, time + 100);
  assert.equal(first.targetUid, retry.targetUid);
  assert.equal(h.authCalls.filter(call => call[0] === 'create').length, 1);
  assert.equal(h.accounts.get(first.targetUid).email, undefined);
  assert.equal(first.profile.email, undefined);
  assert.equal(first.profile.tutorCentre.createdBy, 'teacher');
  assert.equal(first.profile.tutorOnboard.v, 2);
  assert.equal(first.profile.tutorOnboard.enrolled, true);
  assert.equal(first.profile.tutorOnboard.payingFee, false);
  assert.equal(retry.profile.externalMetadata, 'keep');
  await assert.rejects(h.repository.createStudent('teacher', requestId, second, time), { code: 'student_changed' });
  assert.equal([...h.records.keys()].filter(key => key.startsWith(AUDIT_COLLECTION + '/create_')).length, 1);
});

test('a creation failure after reserving the receipt can be retried without duplicates', async () => {
  const h = store(), original = h.auth.createUser;
  h.auth.createUser = async () => { throw new Error('temporary outage'); };
  await assert.rejects(h.repository.createStudent('teacher', requestId, student, time));
  assert.equal([...h.records.keys()].filter(key => key.startsWith('studentProfiles/')).length, 1);
  h.auth.createUser = original;
  const retried = await h.repository.createStudent('teacher', requestId, student, time);
  assert.ok(h.records.has('studentProfiles/' + retried.targetUid));
});

test('editing a child preserves siblings, account metadata, usage and onboarding fields', async () => {
  const h = store(), changed = { ...second, level: 'P6', subject: 'both' };
  const updated = await h.repository.updateStudent('teacher', 'parent', 1, changed, second, time);
  assert.deepEqual(updated.profile.tutorOnboard.students[0], h.profile.tutorOnboard.students[0]);
  assert.deepEqual(updated.profile.tutorOnboard.students[1], changed);
  assert.equal(updated.profile.tutorOnboard.parent, 'Parent');
  assert.equal(updated.profile.tutorOnboard.untouched, 'onboarding metadata');
  assert.equal(updated.profile.tutorOnboard.payingFee, true);
  assert.deepEqual(updated.profile.tutorUsage, { hints: 12 });
  assert.deepEqual(updated.profile.otherApp, { keep: true });
  assert.equal(updated.profile.name, h.profile.name);
  assert.equal(updated.profile.level, undefined);
  assert.equal([...h.records.keys()].filter(key => key.startsWith(AUDIT_COLLECTION + '/update_')).length, 1);
  await assert.rejects(h.repository.updateStudent('teacher', 'parent', 1, second, second, time), { code: 'student_changed' });
  assert.deepEqual(h.records.get('studentProfiles/parent').tutorOnboard.students[1], changed);
});

test('legacy names and filtered blank entries preserve underlying roster positions', async () => {
  const h = store(), profile = h.records.get('studentProfiles/parent');
  profile.tutorOnboard.students = ['', 'Ada', second];
  await h.repository.updateStudent('teacher', 'parent', 0, student, { name: 'Ada', level: '', subject: '' }, time);
  const saved = h.records.get('studentProfiles/parent');
  assert.deepEqual(saved.tutorOnboard.students, ['', student, second]);
  assert.equal(saved.level, 'P5'); assert.equal(saved.subject, 'both');
});

test('existing student names cannot change because they identify saved adventure progress', async () => {
  const h = store();
  await assert.rejects(h.repository.updateStudent('teacher', 'parent', 0, { ...student, name: 'Different child' }, student, time), { code: 'student_name_locked' });
  assert.deepEqual(h.records.get('studentProfiles/parent'), h.profile);
});

test('a hand-added top-level legacy profile can start centre practice and receives a usable onboarding row', async () => {
  const h = store(); h.accounts.delete('parent');
  h.records.set('studentProfiles/parent', { ...student, managed: true, otherApp: { keep: true } });
  const opened = await h.repository.startPractice('teacher', 'parent', 0, student, time);
  assert.deepEqual(opened.students, [student]);
  assert.equal(opened.profile.tutorOnboard.v, 2);
  assert.equal(opened.profile.tutorOnboard.parent, 'Centre student');
  assert.equal(opened.profile.tutorOnboard.enrolled, true);
  assert.equal(opened.profile.tutorOnboard.payingFee, false);
  assert.deepEqual(h.records.get('studentProfiles/parent').otherApp, { keep: true });
  assert.equal(h.accounts.get('parent').email, undefined);
});

test('legacy access edits seed students while preserving billing commitments and other fields', async () => {
  for (const managed of [true, false]) {
    const h = store();
    h.records.set('studentProfiles/parent', { ...student, managed,
      tutorOnboard: { v: 1, parent: 'Parent', payingFee: true, fee: '$100 a month', enrolled: false, note: 'keep' } });
    const changed = { ...student, level: 'P6' };
    const saved = await h.repository.updateStudent('teacher', 'parent', 0, changed, student, time);
    assert.deepEqual(saved.students, [changed]);
    assert.equal(saved.profile.tutorOnboard.v, 2);
    assert.equal(saved.profile.tutorOnboard.parent, 'Parent');
    assert.equal(saved.profile.tutorOnboard.payingFee, true);
    assert.equal(saved.profile.tutorOnboard.fee, '$100 a month');
    assert.equal(saved.profile.tutorOnboard.enrolled, false);
    assert.equal(saved.profile.tutorOnboard.note, 'keep');
  }
});

test('practice refuses protected or disabled Auth identities and the teacher UID', async () => {
  for (const properties of [{ email: ADMIN_EMAIL }, { email: 'abigail.yew@stanfordmanpower.com' }, { disabled: true }, { customClaims: { admin: true } },
    { customClaims: { role: 'teacher' } }, { customClaims: { roles: ['owner'] } }, { customClaims: { roles: { administrator: true } } },
    { providerData: [{ email: ADMIN_EMAIL }] }]) {
    const h = store(); Object.assign(h.accounts.get('parent'), properties);
    await assert.rejects(h.repository.startPractice('teacher', 'parent', 0, student, time), { code: 'protected_account' });
    assert.equal([...h.records.keys()].filter(key => key.startsWith(AUDIT_COLLECTION + '/practice_')).length, 0);
  }
  const h = store(); await assert.rejects(h.repository.startPractice('parent', 'parent', 0, student, time), { code: 'protected_account' });
  h.records.get('studentProfiles/parent').email = ADMIN_EMAIL;
  await assert.rejects(h.repository.startPractice('teacher', 'parent', 0, student, time), { code: 'protected_account' });
});

test('practice can create Auth for a managed legacy row, refuses unmanaged missing accounts and stale selections', async () => {
  const h = store(); h.accounts.delete('parent');
  await assert.rejects(h.repository.startPractice('teacher', 'parent', 0, student, time), { code: 'account_missing' });
  assert.equal(h.accounts.size, 0);
  h.records.get('studentProfiles/parent').managed = true;
  const opened = await h.repository.startPractice('teacher', 'parent', 0, student, time);
  assert.equal(opened.targetUid, 'parent'); assert.ok(h.accounts.has('parent'));
  assert.equal(h.accounts.get('parent').email, undefined);
  await assert.rejects(h.repository.startPractice('teacher', 'parent', 1, student, time), { code: 'student_changed' });
  const audit = [...h.records.entries()].find(([key]) => key.startsWith(AUDIT_COLLECTION + '/practice_'))[1];
  assert.equal(audit.actorUid, 'teacher'); assert.equal(audit.targetUid, 'parent'); assert.equal(audit.token, undefined);
});

test('custom student support requires a server-issued scoped identity and rejects expired or sibling requests', () => {
  const user = { uid: 'parent', firebase: { sign_in_provider: 'custom' }, centrePractice: true, centreActorUid: 'teacher',
    centreStudentIndex: 0, centreStudentKey: centreStudentKey(student), centrePracticeExpiresAt: time / 1000 + PRACTICE_SECONDS };
  assert.ok(isCentrePractice(user, time)); assert.ok(isSupportedStudent(user, time));
  assert.ok(matchesCentreStudent(user, 0, student, time));
  assert.equal(matchesCentreStudent(user, 1, second, time), false);
  assert.equal(matchesCentreStudent(user, 0, { ...student, level: 'P6' }, time), false);
  assert.equal(isCentrePractice(user, time + PRACTICE_SECONDS * 1000), false);
  for (const mutation of [{ centrePractice: false }, { centreActorUid: 'parent' }, { centreStudentIndex: 8 },
    { centreStudentKey: '' }, { email: ADMIN_EMAIL }, { admin: true }, { firebase: { sign_in_provider: 'anonymous' } }]) {
    assert.equal(isCentrePractice({ ...user, ...mutation }, time), false);
  }
});

test('unexpected failures report only a safe code and never leak custom tokens or credentials', async () => {
  const h = service(); h.deps.auth.createCustomToken = async () => { throw new Error('private-token-and-key'); };
  const response = await h.request();
  assert.equal(response.statusCode, 503);
  assert.ok(!JSON.stringify(response).includes('private-token-and-key'));
  assert.deepEqual(h.calls.at(-1), ['report', 'centre_request_failed']);
});
