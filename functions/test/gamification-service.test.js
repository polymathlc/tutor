'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createGameService, ADMIN_EMAIL, MAX_REQUEST_BYTES } = require('../gamification-service');
const { APP_ID } = require('../live-service');

function harness() {
  const calls = [], uid = 'signed-in-parent';
  const user = { uid, firebase: { sign_in_provider: 'google.com' } };
  const context = { uid, learnerKey: 'a'.repeat(64), subject: 'science', level: 'P5' };
  const deps = {
    auth: { async verifyIdToken(token, revoked) { calls.push(['auth', token, revoked]); return user; } },
    appCheck: { async verifyToken(token) { calls.push(['appCheck', token]); return { appId: APP_ID }; } },
    repository: {
      async resolve(...args) { calls.push(['resolve', ...args]); return context; },
      async snapshot(...args) { calls.push(['snapshot', ...args]); return { profile: { xp: 15 } }; },
      async preferences(...args) { calls.push(['preferences', ...args]); },
      async reserve(...args) { calls.push(['reserve', ...args]); return { lease: { id: 'server-lease' } }; },
      async award(...args) { calls.push(['award', ...args]); return { xp: 15 }; },
      async release(...args) { calls.push(['release', ...args]); },
      async inspectMember(...args) { calls.push(['inspectMember', ...args]); return { memberships: {} }; },
      async approveMember(...args) { calls.push(['approveMember', ...args]); return { memberships: {} }; }
    },
    provider: { async verify(...args) { calls.push(['verify', ...args]); return { relevant: true, confident: true, correct: false }; } },
    now: () => 1000, report: code => calls.push(['report', code])
  };
  const service = createGameService(deps);
  async function request(body = { action: 'snapshot', studentIndex: 0, subject: 'science' }, options = {}) {
    const headers = { origin: 'https://polymathlc.github.io', authorization: 'Bearer login-token', 'x-firebase-appcheck': 'app-token', 'content-type': 'application/json', ...options.headers };
    const req = { method: options.method || 'POST', body, rawBody: options.rawBody, get: name => headers[name.toLowerCase()] };
    const res = { headers: {}, statusCode: 200, set(k, v) { this.headers[k] = v; return this; }, status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; return this; }, send(body) { this.body = body; return this; } };
    await service.handler(req, res); return res;
  }
  return { calls, user, context, deps, request };
}
const attempt = { action: 'attempt', studentIndex: 0, subject: 'science', kind: 'practice', question: 'Why does ice melt in a warm room?', answer: 'It loses cold.' };

test('auth, revocation and exact App Check app are verified before reading profiles', async () => {
  const h = harness(); const response = await h.request();
  assert.equal(response.statusCode, 200);
  assert.deepEqual(h.calls.slice(0, 3), [['auth', 'login-token', true], ['appCheck', 'app-token'], ['resolve', 'signed-in-parent', 0, 'science', undefined, false]]);
  assert.equal(response.headers['Cache-Control'], 'no-store');
  for (const headers of [{ authorization: '' }, { 'x-firebase-appcheck': '' }]) {
    const other = harness(); assert.ok((await other.request(undefined, { headers })).statusCode >= 400);
    assert.ok(!other.calls.some(row => row[0] === 'resolve'));
  }
  const revoked = harness(); revoked.deps.auth.verifyIdToken = async () => { throw new Error('sensitive error'); };
  assert.equal((await revoked.request()).statusCode, 401);
  const otherApp = harness(); otherApp.deps.appCheck.verifyToken = async () => ({ appId: 'wrong-app' });
  assert.equal((await otherApp.request()).statusCode, 403);
});

test('cross-origin, anonymous and non-Google requests cannot access rewards', async () => {
  const h = harness(); assert.equal((await h.request(undefined, { headers: { origin: 'https://evil.example' } })).statusCode, 403);
  assert.deepEqual(h.calls, []);
  const anonymous = harness(); anonymous.user.firebase.sign_in_provider = 'anonymous';
  assert.equal((await anonymous.request()).statusCode, 403);
  assert.equal((await harness().request(undefined, { method: 'OPTIONS' })).statusCode, 204);
  assert.equal((await harness().request(undefined, { method: 'GET' })).statusCode, 405);
});

test('client XP, verdict, model and target owner are discarded; server verification determines awards', async () => {
  const h = harness();
  const response = await h.request({ ...attempt, xp: 99999, correct: true, uid: 'victim', targetUid: 'victim', model: 'attacker-model', level: 'P3', verdict: 'right' });
  assert.equal(response.statusCode, 200);
  const input = h.calls.find(row => row[0] === 'verify')[1];
  assert.equal(input.level, 'P5');
  assert.equal(input.model, undefined); assert.equal(input.xp, undefined); assert.equal(input.correct, undefined); assert.equal(input.verdict, undefined);
  assert.equal(h.calls.find(row => row[0] === 'resolve')[1], 'signed-in-parent');
  assert.deepEqual(h.calls.find(row => row[0] === 'award')[3], { relevant: true, confident: true, correct: false });
});

test('duplicate awards skip paid verification', async () => {
  const h = harness(); h.deps.repository.reserve = async () => ({ award: { xp: 0, duplicate: true } });
  assert.equal((await h.request(attempt)).body.award.xp, 0);
  assert.ok(!h.calls.some(row => row[0] === 'verify'));
});

test('upstream failures release the lease and return no secret or alleged XP', async () => {
  const h = harness(); h.deps.provider.verify = async () => { throw new Error('secret-api-key'); };
  const response = await h.request(attempt);
  assert.equal(response.statusCode, 503); assert.ok(h.calls.some(row => row[0] === 'release'));
  assert.ok(!h.calls.some(row => row[0] === 'award')); assert.ok(!JSON.stringify(response).includes('secret-api-key'));
});

test('only verified server admin identity can approve or inspect another account', async () => {
  const request = { action: 'approveMember', targetUid: 'parent2', studentIndex: 0, subject: 'science', approved: true };
  for (const claims of [{}, { email: ADMIN_EMAIL, email_verified: false }, { email: 'student@example.com', email_verified: true, admin: true }]) {
    const h = harness(); Object.assign(h.user, claims);
    assert.equal((await h.request(request)).statusCode, 403);
    assert.ok(!h.calls.some(row => row[0] === 'resolve'));
  }
  const h = harness(); Object.assign(h.user, { email: ADMIN_EMAIL, email_verified: true });
  assert.equal((await h.request(request)).statusCode, 200);
  assert.equal(h.calls.find(row => row[0] === 'resolve')[1], 'parent2');
  assert.equal(h.calls.find(row => row[0] === 'approveMember')[3], h.user.uid);
});

test('malformed payloads, blank answers and arbitrary image URLs are rejected before paid work', async () => {
  const invalid = [null, [], { ...attempt, studentIndex: 8 }, { ...attempt, subject: 'other' }, { ...attempt, answer: '  ' },
    { ...attempt, questionImage: 'https://internal.example/metadata' }, { ...attempt, questionImage: 'data:image/svg+xml;base64,YQ==' },
    { ...attempt, learnerKey: 'another-key' }, { action: 'preferences', studentIndex: 0, subject: 'science', companion: ['orbit'] },
    { action: 'preferences', studentIndex: 0, subject: 'science', frame: '__proto__' }];
  for (const input of invalid) {
    const h = harness(); assert.equal((await h.request(input)).statusCode, 400); assert.deepEqual(h.calls, []);
  }
  assert.equal((await harness().request(attempt, { rawBody: { length: MAX_REQUEST_BYTES + 1 } })).statusCode, 413);
});
