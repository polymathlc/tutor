'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  CONSULT_EMAIL, MAIL_COLLECTION, LIMIT_COLLECTION, MIN_GAP_MS, DAILY_MAX, FRESH_MS,
  validateBody, stampMs, cleanText, escapeHtml, dayKey, consultLink, buildConsultMail, buildQuestionMail, QUESTION_MAX,
  createConsultRepository, createConsultService,
  consultOrigin, consultStudent, appWord, APP_WORDS, COM_SG_ORIGINS
} = require('../consult-service');
const { ADMIN_EMAIL, PROTECTED_EMAILS } = require('../centre-auth');
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

  // A bare custom token is not a centre practice account (no claims), so it is refused.
  const custom = service(); custom.user.firebase.sign_in_provider = 'custom';
  assert.equal((await custom.request()).statusCode, 403);
  assert.ok(!custom.calls.some(c => c[0] === 'queue'));
  // v1.69.0: the Science and Maths portals sign students in with a password as well as Google.
  const password = service(); password.user.firebase.sign_in_provider = 'password';
  assert.equal((await password.request()).statusCode, 200);
  assert.ok(password.calls.some(c => c[0] === 'queue'));

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

/* ---------------- v1.65.0: a question left instead of a call ---------------- */

function questionDoc(extra = {}) {
  return consultDoc({ status: 'question', question: { text: 'Why is <i>Q3</i> 40°C?', page: 2, ws: 'ws1', box: [0.1, 0.2, 0.5, 0.6], at: time - 500 }, ...extra });
}

test('a question gets its own email, escaped, with the same constant recipient and link', () => {
  const mail = buildQuestionMail(questionDoc(), ID, time);
  assert.deepEqual(mail.to, [CONSULT_EMAIL]);
  assert.ok(mail.message.subject.startsWith('📝 Ada <b>Lovelace</b> left you a question'), mail.message.subject);
  assert.ok(!/[\r\n]/.test(mail.message.subject));
  assert.ok(mail.message.text.includes('Why is <i>Q3</i> 40°C?'), 'the text part carries the question as typed');
  assert.ok(mail.message.text.includes(consultLink(ID)));
  assert.ok(mail.message.text.includes('page 2 (a part of it, boxed)'));
  assert.ok(!/<i>Q3/.test(mail.message.html), 'nothing a student typed is markup');
  assert.ok(mail.message.html.includes('Why is &lt;i&gt;Q3&lt;/i&gt; 40°C?'));
  assert.ok(mail.message.html.includes(escapeHtml(consultLink(ID))));
  const long = buildQuestionMail(questionDoc({ question: { text: 'x'.repeat(QUESTION_MAX * 3), page: 1, at: time } }), ID, time);
  assert.ok(long.message.text.length < QUESTION_MAX + 1000, 'the question is bounded');
});

test('the question is queued once, as <id>_q, beside the call\'s own email', async () => {
  const s = store();
  s.records.set('tutorConsults/' + ID, consultDoc());
  assert.equal((await s.repository.queue('kid', ID, time)).status, 'queued');
  // The teacher could not take the call; seconds later the question is left.
  s.records.set('tutorConsults/' + ID, { ...s.records.get('tutorConsults/' + ID), ...questionDoc({ emailQueued: time }) });
  assert.deepEqual(await s.repository.queue('kid', ID, time + 5000), { status: 'queued' }, 'not held back by the gap: the same ask');
  const q = s.records.get(MAIL_COLLECTION + '/' + ID + '_q');
  assert.ok(q, 'the question mail has its own id');
  assert.equal(q.kind, 'question');
  assert.deepEqual(q.to, [CONSULT_EMAIL]);
  assert.equal(s.records.get(MAIL_COLLECTION + '/' + ID).kind, 'call');
  assert.equal(s.records.get('tutorConsults/' + ID).questionEmailQueued, time + 5000);
  assert.equal(s.records.get(LIMIT_COLLECTION + '/kid').count, 2, 'the daily ceiling still counts it');
  assert.deepEqual(await s.repository.queue('kid', ID, time + 10 * MIN_GAP_MS), { status: 'already' });
  assert.equal([...s.records.keys()].filter(k => k.startsWith(MAIL_COLLECTION)).length, 2, 'two emails at most per consult');
});

test('a question with no call email waits out the gap; an empty or stale one is refused', async () => {
  const s = store();
  const other = 'Other1234567890abcd';
  s.records.set('tutorConsults/' + other, consultDoc({ createdAt: null, at: time }));
  assert.equal((await s.repository.queue('kid', other, time)).status, 'queued');
  // A DIFFERENT consult's question, a moment after that email: the gap holds.
  s.records.set('tutorConsults/' + ID, questionDoc());
  await assert.rejects(s.repository.queue('kid', ID, time + 1000), err => err.code === 'too_soon');
  assert.equal((await s.repository.queue('kid', ID, time + MIN_GAP_MS)).status, 'queued');
  const s2 = store();
  s2.records.set('tutorConsults/' + ID, questionDoc({ question: { text: '   ', page: 1, at: time } }));
  await assert.rejects(s2.repository.queue('kid', ID, time), err => err.code === 'closed');
  s2.records.set('tutorConsults/' + ID, questionDoc({ question: { text: 'hi', page: 1, at: time - FRESH_MS - 1 } }));
  await assert.rejects(s2.repository.queue('kid', ID, time), err => err.code === 'closed');
  s2.records.set('tutorConsults/' + ID, questionDoc({ status: 'answered' }));
  await assert.rejects(s2.repository.queue('kid', ID, time), err => err.code === 'closed', 'an answered question is not mailed');
  s2.records.set('tutorConsults/' + ID, questionDoc({ studentUid: 'someone-else' }));
  await assert.rejects(s2.repository.queue('kid', ID, time), err => err.code === 'not_found');
  assert.ok(![...s2.records.keys()].some(k => k.startsWith(MAIL_COLLECTION)));
});

/* ---------------- v1.69.0: the Science and Maths portals ask through the same door ---------------- */

const STAFF_EMAIL = PROTECTED_EMAILS.find(email => email !== ADMIN_EMAIL);

test('a password account is a student; the teacher, staff, admins and guests are not, whatever they sign in with', async () => {
  // Every one of these is refused BEFORE App Check is asked and before anything is queued,
  // so a refused account never costs the teacher an email and never learns whether the device is verified.
  const refusals = [
    ['an anonymous guest', u => { u.firebase.sign_in_provider = 'anonymous'; }],
    ['a phone number', u => { u.firebase.sign_in_provider = 'phone'; }],
    ['the teacher on a password', u => { u.firebase.sign_in_provider = 'password'; u.email = ADMIN_EMAIL; }],
    ['the teacher in capitals', u => { u.firebase.sign_in_provider = 'password'; u.email = ADMIN_EMAIL.toUpperCase(); }],
    ['the teacher on Google', u => { u.email = ADMIN_EMAIL; }],
    ['a member of staff', u => { u.firebase.sign_in_provider = 'password'; u.email = STAFF_EMAIL; }],
    ['the teacher behind a linked provider', u => { u.firebase.sign_in_provider = 'password'; u.providerData = [{ email: ADMIN_EMAIL }]; }],
    ['an admin claim', u => { u.firebase.sign_in_provider = 'password'; u.admin = true; }],
    ['a teacher role', u => { u.firebase.sign_in_provider = 'password'; u.role = 'teacher'; }],
    ['a disabled account', u => { u.firebase.sign_in_provider = 'password'; u.disabled = true; }],
    ['an account with no uid', u => { u.firebase.sign_in_provider = 'password'; u.uid = ''; }]
  ];
  assert.ok(STAFF_EMAIL, 'a member of staff is on the protected list');
  for (const [label, change] of refusals) {
    const h = service();
    change(h.user);
    const res = await h.request();
    assert.equal(res.statusCode, 403, label);
    assert.equal(res.body.error.code, 'student_required', label);
    assert.ok(!h.calls.some(c => c[0] === 'queue'), label + ' queues nothing');
    assert.ok(!h.calls.some(c => c[0] === 'appCheck'), label + ' is refused before App Check is asked');
  }
});

test('consultStudent is the one rule, and it reads protected identities first', () => {
  const user = extra => ({ uid: 'kid', email: 'kid@example.com', firebase: {}, ...extra });
  assert.equal(consultStudent(user({ firebase: { sign_in_provider: 'google.com' } }), time), true);
  assert.equal(consultStudent(user({ firebase: { sign_in_provider: 'password' } }), time), true);
  assert.equal(consultStudent(user({ firebase: { sign_in_provider: 'anonymous' } }), time), false);
  assert.equal(consultStudent(user({ firebase: { sign_in_provider: 'custom' } }), time), false, 'a custom token with no centre claims');
  assert.equal(consultStudent(user({ email: ADMIN_EMAIL, firebase: { sign_in_provider: 'password' } }), time), false);
  assert.equal(consultStudent(user({ email: ADMIN_EMAIL, firebase: { sign_in_provider: 'google.com' } }), time), false);
  assert.equal(consultStudent(user({}), time), false, 'no provider at all');
  assert.equal(consultStudent(user({ firebase: undefined }), time), false, 'no firebase block at all');
  assert.equal(consultStudent(null, time), false);
  assert.equal(consultStudent(undefined, time), false);
});

test('the Science portal\'s own address is allowed, exactly, and nothing that merely resembles it', async () => {
  assert.ok(Object.isFrozen(COM_SG_ORIGINS), 'the list cannot be widened at run time');
  for (const origin of COM_SG_ORIGINS) {
    const h = service();
    const res = await h.request(undefined, { headers: { origin } });
    assert.equal(res.statusCode, 200, origin);
    assert.equal(res.headers['Access-Control-Allow-Origin'], origin, origin + ' is echoed back');
    assert.ok(consultOrigin(origin), origin);
  }
  for (const origin of [
    'https://polymathlc.com.sg.evil.example',
    'http://polymathlc.com.sg',
    'https://evil.polymathlc.com.sg',
    'https://polymathlc.com.sg/',
    'https://polymathlc.com',
    'https://polymathlc.com.sg:8443',
    ' https://polymathlc.com.sg',
    'null'
  ]) {
    const h = service();
    const res = await h.request(undefined, { headers: { origin } });
    assert.equal(res.statusCode, 403, origin);
    assert.equal(res.body.error.code, 'origin_not_allowed', origin);
    assert.equal(res.headers['Access-Control-Allow-Origin'], undefined, origin + ' is not echoed');
    assert.ok(!h.calls.some(c => c[0] === 'verify'), origin + ' is refused before a token is read');
    assert.ok(!consultOrigin(origin), origin);
  }
  assert.ok(consultOrigin('https://polymathlc.github.io'), 'the GitHub Pages apps still ask');
  assert.ok(!consultOrigin(undefined));
  assert.ok(!consultOrigin(42));
  assert.ok(!consultOrigin(''));
});

test('the app is a word on the document; anything unknown reads as Study Buddy', () => {
  assert.ok(Object.isFrozen(APP_WORDS));
  assert.deepEqual(Object.keys(APP_WORDS).sort(), ['anskey', 'cer', 'math', 'tutor']);
  for (const key of Object.keys(APP_WORDS)) assert.equal(appWord(key), APP_WORDS[key], key);
  assert.equal(appWord('cer'), 'the Science portal');
  assert.equal(appWord('math'), 'the Maths portal');
  assert.equal(appWord('anskey'), 'Ans Key');
  for (const odd of [undefined, null, 42, '', 'Cer', 'MATH', 'constructor', '__proto__', 'toString', 'hasOwnProperty', {}, [], ['cer']]) {
    assert.equal(appWord(odd), 'Study Buddy', JSON.stringify(odd) + ' is not an app');
  }
});

test('the email names the app the student asked from, and the subject never changes', () => {
  const sci = buildConsultMail(consultDoc({ app: 'cer' }), ID, time);
  assert.ok(sci.message.text.startsWith('Ada <b>Lovelace</b> pressed Consult in the Science portal'), sci.message.text);
  assert.ok(sci.message.html.includes('pressed <b>Consult</b> in the Science portal'));
  assert.ok(sci.message.text.includes(consultLink(ID)), 'the Join link is still the tutor room');
  assert.deepEqual(sci.to, [CONSULT_EMAIL]);

  const mathQ = buildQuestionMail(questionDoc({ app: 'math' }), ID, time);
  assert.ok(mathQ.message.text.includes('left you a question in the Maths portal.'), mathQ.message.text);
  assert.ok(!mathQ.message.text.includes('could not reach you on a call'), 'a portal question was never a call');
  assert.ok(mathQ.message.html.includes('left you a question in the Maths portal.'));
  assert.ok(mathQ.message.text.includes(consultLink(ID)), 'the answer link is the same room');

  const keyQ = buildQuestionMail(questionDoc({ app: 'anskey' }), ID, time);
  assert.ok(keyQ.message.text.includes('left you a question in Ans Key.'), keyQ.message.text);

  const tutorQ = buildQuestionMail(questionDoc(), ID, time);
  assert.ok(tutorQ.message.text.startsWith('Ada <b>Lovelace</b> could not reach you on a call, so they left a question in Study Buddy.'),
    tutorQ.message.text);

  const forged = buildQuestionMail(questionDoc({ app: '<script>alert(1)</script>' }), ID, time);
  assert.ok(!forged.message.html.includes('<script>'), 'a forged app is never markup');
  assert.ok(forged.message.text.includes('in Study Buddy'), 'and it reads as Study Buddy');
  const forgedCall = buildConsultMail(consultDoc({ app: '<img src=x onerror=alert(1)>' }), ID, time);
  assert.ok(!forgedCall.message.html.includes('<img'), 'not on a call either');

  for (const app of [undefined, 'tutor', 'anskey', 'cer', 'math']) {
    assert.equal(buildConsultMail(consultDoc({ app }), ID, time).message.subject,
      buildConsultMail(consultDoc(), ID, time).message.subject, 'call subject for ' + app);
    assert.equal(buildQuestionMail(questionDoc({ app }), ID, time).message.subject,
      buildQuestionMail(questionDoc(), ID, time).message.subject, 'question subject for ' + app);
  }
});

test('a question left in the Science portal is queued like any other, as <id>_q, to the same recipient', async () => {
  const s = store();
  s.records.set('tutorConsults/' + ID, questionDoc({ app: 'cer' }));
  assert.deepEqual(await s.repository.queue('kid', ID, time), { status: 'queued' });
  const q = s.records.get(MAIL_COLLECTION + '/' + ID + '_q');
  assert.ok(q, 'the question mail has its own id');
  assert.equal(q.kind, 'question');
  assert.deepEqual(q.to, [CONSULT_EMAIL]);
  assert.ok(q.message.text.includes('the Science portal'), q.message.text);
  assert.ok(!s.records.has(MAIL_COLLECTION + '/' + ID), 'no call email was ever written for it');
  assert.equal(s.records.get(LIMIT_COLLECTION + '/kid').count, 1);
  assert.deepEqual(await s.repository.queue('kid', ID, time + 1000), { status: 'already' }, 'a retried send is not a second email');
});

test('the app never travels in the request; the browser still sends the consult id and nothing else', async () => {
  assert.throws(() => validateBody({ consultId: ID, app: 'cer' }), err => err.status === 400);
  const h = service();
  assert.equal((await h.request({ consultId: ID, app: 'math' })).statusCode, 400);
  assert.ok(!h.calls.some(c => c[0] === 'queue'));
});
