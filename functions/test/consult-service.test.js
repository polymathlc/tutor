'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  CONSULT_EMAIL, MAIL_COLLECTION, LIMIT_COLLECTION, MIN_GAP_MS, DAILY_MAX, FRESH_MS,
  validateBody, stampMs, cleanText, escapeHtml, dayKey, consultLink, buildConsultMail,
  createConsultRepository, createConsultService
} = require('../consult-service');
const { ADMIN_EMAIL } = require('../centre-auth');
const { APP_ID } = require('../live-service');

const time = Date.UTC(2026, 9, 20, 2, 30); // 10:30 in Singapore
const ID = 'AbCdEf1234567890xyZ1';
const clone = value => value === undefined ? undefined : structuredClone(value);

function store() {
  const records = new Map();
  const ref = path => ({ path, collection: name => ({ doc: id => ref(path + '/' + name + '/' + id) }) });
  const snap = r => ({ exists: records.has(r.path), data: () => clone(records.get(r.path)) });
  const db = {
    collection: name => ({ doc: id => ref(name + '/' + id) }),
    async runTransaction(run) {
      const writes = [];
      const answer = await run({
        get: async r => snap(r),
        set: (r, value) => writes.push(() => records.set(r.path, clone(value))),
        update: (r, value) => writes.push(() => {
          if (!records.has(r.path)) throw new Error('No document to update');
          records.set(r.path, { ...records.get(r.path), ...clone(value) });
        })
      });
      writes.forEach(w => w());
      return answer;
    }
  };
  return { records, db, repository: createConsultRepository(db) };
}

function consultDoc(extra = {}) {
  return { v: 1, status: 'waiting', studentUid: 'kid', studentName: 'Ada <b>Lovelace</b>',
    worksheetName: 'P5 Heat & Light', level: 'P5', subject: 'science', view: { page: 3 }, at: time - 2000,
    createdAt: { seconds: (time - 1000) / 1000, nanoseconds: 0 }, ...extra };
}

function service(overrides = {}) {
  const calls = [];
  const user = { uid: 'kid', email: 'kid@example.com', email_verified: true, firebase: { sign_in_provider: 'google.com' } };
  const deps = {
    now: () => time, report: code => calls.push(['report', code]),
    auth: { async verifyIdToken(token, revoked) { calls.push(['verify', token, revoked]); return user; } },
    appCheck: { async verifyToken(token) { calls.push(['appCheck', token]); return { appId: APP_ID }; } },
    repository: { async queue(uid, id, t) { calls.push(['queue', uid, id, t]); return { status: 'queued' }; } },
    ...overrides
  };
  const instance = createConsultService(deps);
  async function request(body = { consultId: ID }, options = {}) {
    const headers = { origin: 'https://polymathlc.github.io', authorization: 'Bearer id-token', 'x-firebase-appcheck': 'app-check',
      'content-type': 'application/json', ...options.headers };
    const req = { method: options.method || 'POST', body, rawBody: options.rawBody, get: key => headers[key.toLowerCase()] };
    const res = { headers: {}, statusCode: 200, set(k, v) { this.headers[k] = v; return this; },
      status(v) { this.statusCode = v; return this; }, json(v) { this.body = v; return this; }, send(v) { this.body = v; return this; } };
    await instance.handler(req, res);
    return res;
  }
  return { calls, user, deps, request };
}

test('the recipient is the teacher and nobody else, as a constant', () => {
  assert.equal(CONSULT_EMAIL, 'chungzhikai@gmail.com');
  assert.equal(CONSULT_EMAIL, ADMIN_EMAIL);
  const mail = buildConsultMail(consultDoc(), ID, time);
  assert.deepEqual(mail.to, ['chungzhikai@gmail.com']);
  assert.deepEqual(Object.keys(mail).sort(), ['message', 'to']);
  for (const key of ['cc', 'bcc', 'replyTo', 'from', 'toUids']) assert.equal(mail[key], undefined);
});

test('a body may carry the consult id and nothing else — no recipient, subject or text', () => {
  assert.deepEqual(validateBody({ consultId: ID }), { consultId: ID });
  for (const body of [null, [], 'x', {}, { consultId: 'short' }, { consultId: ID + '!' }, { consultId: 42 },
    { consultId: ID, to: 'someone@example.com' }, { consultId: ID, email: 'x@y.z' }, { consultId: ID, subject: 'hi' },
    { consultId: '../../mail/x' }]) {
    assert.throws(() => validateBody(body), err => err.status === 400 && err.code === 'invalid_request', JSON.stringify(body));
  }
});

test('the email escapes what a person typed and links to the consult', () => {
  const mail = buildConsultMail(consultDoc({ studentName: 'Ada <script>alert(1)</script>\r\nBcc: x@y.z', worksheetName: 'Q1 "quote" & <i>' }), ID, time);
  assert.ok(!mail.message.html.includes('<script>'));
  assert.ok(mail.message.html.includes('&lt;script&gt;'));
  assert.ok(mail.message.html.includes('&quot;quote&quot; &amp; &lt;i&gt;'));
  assert.ok(!/[\r\n]/.test(mail.message.subject), 'no line break can reach the subject header');
  assert.ok(mail.message.text.includes(consultLink(ID)));
  assert.ok(mail.message.html.includes('href="https://polymathlc.github.io/tutor/?consult=' + ID + '"'));
  assert.ok(mail.message.text.includes('P5 Science'));
  assert.ok(mail.message.text.includes('page 3'));
  assert.ok(/Singapore time/.test(mail.message.text));
  assert.ok(/10:30/.test(mail.message.text), mail.message.text);
  const bare = buildConsultMail({}, ID, time);
  assert.ok(bare.message.subject.startsWith('🙋 A student is asking for help'));
  assert.ok(!bare.message.text.includes('Worksheet:'));
});

test('helpers: stamps, text, escaping and Singapore days', () => {
  assert.equal(stampMs(5), 5);
  assert.equal(stampMs({ toMillis: () => 7 }), 7);
  assert.equal(stampMs({ seconds: 2, nanoseconds: 5e6 }), 2005);
  assert.equal(stampMs(new Date(9)), 9);
  assert.equal(stampMs(null), 0);
  assert.equal(stampMs('soon'), 0);
  assert.equal(cleanText('  a\tb\n\nc  ', 20), 'a b c');
  assert.equal(cleanText('x'.repeat(30), 10).length, 10);
  assert.equal(cleanText(7, 10), '');
  assert.equal(escapeHtml(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  // 23:30 UTC is already tomorrow in Singapore.
  assert.equal(dayKey(Date.UTC(2026, 9, 20, 23, 30)), '2026-10-21');
  assert.equal(consultLink(ID), 'https://polymathlc.github.io/tutor/?consult=' + ID);
});

test('queue writes one mail document under the server-only path, the limit and the stamp', async () => {
  const s = store();
  s.records.set('tutorConsults/' + ID, consultDoc());
  assert.deepEqual(await s.repository.queue('kid', ID, time), { status: 'queued' });
  assert.ok(MAIL_COLLECTION.startsWith('tutorCentreAdmin/'));
  assert.ok(LIMIT_COLLECTION.startsWith('tutorCentreAdmin/'));
  const mail = s.records.get(MAIL_COLLECTION + '/' + ID);
  assert.deepEqual(mail.to, [CONSULT_EMAIL]);
  assert.equal(mail.consultId, ID);
  assert.equal(mail.studentUid, 'kid');
  assert.deepEqual(s.records.get(LIMIT_COLLECTION + '/kid'), { day: dayKey(time), count: 1, last: time });
  assert.equal(s.records.get('tutorConsults/' + ID).emailQueued, time);
  // The same consult again is ONE email, whatever the gap.
  assert.deepEqual(await s.repository.queue('kid', ID, time + 10 * MIN_GAP_MS), { status: 'already' });
  assert.equal([...s.records.keys()].filter(k => k.startsWith(MAIL_COLLECTION)).length, 1);
});

test('another account\'s consult reads as missing, and closed or stale consults are refused', async () => {
  const s = store();
  await assert.rejects(s.repository.queue('kid', ID, time), err => err.code === 'not_found');
  s.records.set('tutorConsults/' + ID, consultDoc({ studentUid: 'someone-else' }));
  await assert.rejects(s.repository.queue('kid', ID, time), err => err.code === 'not_found' && err.status === 404);
  for (const extra of [{ status: 'live' }, { status: 'ended' }, { status: 'cancelled' },
    { createdAt: { seconds: (time - FRESH_MS - 1000) / 1000 } }, { createdAt: null, at: 0 },
    { createdAt: { seconds: (time + FRESH_MS + 1000) / 1000 } }]) {
    s.records.set('tutorConsults/' + ID, consultDoc(extra));
    await assert.rejects(s.repository.queue('kid', ID, time), err => err.code === 'closed', JSON.stringify(extra));
  }
  assert.ok(![...s.records.keys()].some(k => k.startsWith(MAIL_COLLECTION)));
  // A consult written before the server stamp landed falls back to `at`.
  s.records.set('tutorConsults/' + ID, consultDoc({ createdAt: null }));
  assert.deepEqual(await s.repository.queue('kid', ID, time), { status: 'queued' });
});

test('one account is throttled per minute and per Singapore day', async () => {
  const s = store();
  const ids = Array.from({ length: DAILY_MAX + 2 }, (_, i) => 'Consult' + String(i).padStart(8, '0'));
  ids.forEach(id => s.records.set('tutorConsults/' + id, consultDoc({ createdAt: null, at: time })));
  assert.equal((await s.repository.queue('kid', ids[0], time)).status, 'queued');
  await assert.rejects(s.repository.queue('kid', ids[1], time + MIN_GAP_MS - 1), err => err.code === 'too_soon' && err.status === 429);
  let t = time;
  for (let i = 1; i < DAILY_MAX; i++) {
    t += MIN_GAP_MS;
    s.records.set('tutorConsults/' + ids[i], consultDoc({ createdAt: null, at: t }));
    assert.equal((await s.repository.queue('kid', ids[i], t)).status, 'queued', 'email ' + (i + 1));
  }
  t += MIN_GAP_MS;
  s.records.set('tutorConsults/' + ids[DAILY_MAX], consultDoc({ createdAt: null, at: t }));
  await assert.rejects(s.repository.queue('kid', ids[DAILY_MAX], t), err => err.code === 'daily_limit');
  // A new Singapore day starts the count again.
  const tomorrow = Date.UTC(2026, 9, 21, 2, 0);
  s.records.set('tutorConsults/' + ids[DAILY_MAX + 1], consultDoc({ createdAt: null, at: tomorrow }));
  assert.equal((await s.repository.queue('kid', ids[DAILY_MAX + 1], tomorrow)).status, 'queued');
  assert.equal(s.records.get(LIMIT_COLLECTION + '/kid').count, 1);
});

test('sign-in, revocation, a student identity and App Check come before the queue', async () => {
  const ok = service();
  const res = await ok.request();
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { status: 'queued' });
  assert.deepEqual(ok.calls.slice(0, 3), [['verify', 'id-token', true], ['appCheck', 'app-check'], ['queue', 'kid', ID, time]]);

  const noToken = service();
  assert.equal((await noToken.request(undefined, { headers: { authorization: '' } })).statusCode, 401);
  assert.ok(!noToken.calls.some(c => c[0] === 'queue'));

  const forged = service(); forged.deps.auth.verifyIdToken = async () => { throw new Error('bad'); };
  assert.equal((await forged.request()).statusCode, 401);

  const custom = service(); custom.user.firebase.sign_in_provider = 'password';
  assert.equal((await custom.request()).statusCode, 403);
  assert.ok(!custom.calls.some(c => c[0] === 'queue'));

  const noApp = service();
  assert.equal((await noApp.request(undefined, { headers: { 'x-firebase-appcheck': '' } })).statusCode, 403);
  const wrongApp = service(); wrongApp.deps.appCheck.verifyToken = async () => ({ appId: 'other' });
  assert.equal((await wrongApp.request()).statusCode, 403);
  assert.ok(!wrongApp.calls.some(c => c[0] === 'queue'));
});

test('origin, method, content type, size and body are checked', async () => {
  const h = service();
  const bad = await h.request(undefined, { headers: { origin: 'https://evil.example' } });
  assert.equal(bad.statusCode, 403);
  assert.equal(bad.headers['Access-Control-Allow-Origin'], undefined);
  assert.equal((await h.request(undefined, { method: 'OPTIONS' })).statusCode, 204);
  assert.equal((await h.request(undefined, { method: 'GET' })).statusCode, 405);
  assert.equal((await h.request(undefined, { headers: { 'content-type': 'text/plain' } })).statusCode, 415);
  assert.equal((await h.request(undefined, { rawBody: Buffer.alloc(5000) })).statusCode, 413);
  assert.equal((await h.request({ consultId: ID, to: 'x@y.z' })).statusCode, 400);
  assert.ok(!h.calls.some(c => c[0] === 'queue'));
  const local = await h.request(undefined, { headers: { origin: 'http://localhost:8080' } });
  assert.equal(local.statusCode, 200);
});

test('a repository refusal is passed through with its code; anything else is a quiet 503', async () => {
  const s = store();
  const h = service({ repository: s.repository });
  const missing = await h.request();
  assert.equal(missing.statusCode, 404);
  assert.equal(missing.body.error.code, 'not_found');
  const broken = service({ repository: { async queue() { throw new Error('database secret detail'); } } });
  const res = await broken.request();
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.error.code, 'consult_unavailable');
  assert.ok(!JSON.stringify(res.body).includes('secret'));
  assert.deepEqual(broken.calls.filter(c => c[0] === 'report'), [['report', 'consult_request_failed']]);
});

test('the endpoint is exported without a secret and the file names no other address', () => {
  const fs = require('node:fs'), path = require('node:path');
  const index = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
  const block = index.slice(index.indexOf('exports.studyBuddyConsult'), index.indexOf('consultService.handler'));
  assert.ok(block.length > 0, 'studyBuddyConsult is exported');
  assert.ok(!/secrets/.test(block), 'the consult endpoint binds no secret');
  const src = fs.readFileSync(path.join(__dirname, '..', 'consult-service.js'), 'utf8');
  const emails = src.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [];
  assert.deepEqual(emails, [], 'the recipient comes from centre-auth, never a literal here');
});
