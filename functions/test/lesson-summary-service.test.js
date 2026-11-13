'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  LIMIT_COLLECTION, TEACHER_TO_MAX, STUDENT_TO_MAX, STUDENT_DAILY_MAX, STUDENT_GAP_MS, MESSAGE_MAX,
  validateBody, isTeacher, isStudent, mediaUrlOk, cleanVideos, notesFor, orderVideos, watchLink, summaryRows,
  buildSummaryMail, createSummaryRepository, createSummaryService
} = require('../lesson-summary-service');
const { MAIL_COLLECTION } = require('../consult-service');
const { ADMIN_EMAIL } = require('../centre-auth');
const { APP_ID } = require('../live-service');

const time = Date.UTC(2026, 10, 13, 6, 0);
const clone = v => v === undefined ? undefined : structuredClone(v);
const URL_OK = 'https://firebasestorage.googleapis.com/v0/b/mathgen--app.firebasestorage.app/o/pdf-annotator%2Flesson-S1-v1.mp4?alt=media&token=t';

function video(id, page, y, title, extra = {}) {
  return { id, type: 'video', page, x: 40, y, label: 'l', url: URL_OK, ts: 1,
    lessonRecording: { version: 1, manifestUrl: URL_OK, duration: 95000, ...(title ? { title } : {}), ...extra } };
}

function store(seed = {}) {
  const records = new Map(Object.entries(clone(seed)));
  const ref = path => ({ path, collection: name => ({ doc: id => ref(path + '/' + name + '/' + id) }) });
  const snap = r => ({ exists: records.has(r.path), data: () => clone(records.get(r.path)) });
  const db = {
    collection: name => ({ doc: id => ref(name + '/' + id) }),
    async runTransaction(run) {
      const writes = [];
      const answer = await run({ get: async r => snap(r), set: (r, value) => writes.push(() => records.set(r.path, clone(value))) });
      writes.forEach(w => w());
      return answer;
    }
  };
  return { records, repository: createSummaryRepository(db) };
}
const teacherUser = { uid: 'teach', email: ADMIN_EMAIL, email_verified: true, firebase: { sign_in_provider: 'google.com' } };
const kidUser = { uid: 'kid', email: 'kid@example.com', email_verified: true, firebase: { sign_in_provider: 'google.com' } };

function teacherSheet(extra = {}) {
  return { name: 'P5 Ratio <b>Practice</b>', level: 'P5', subject: 'math', ownerUid: 'teach',
    videos: [video('vB', 2, 100, 'Q7'), video('vA', 1, 100, 'Q2', { video: true })],
    videoNotes: { vA: { text: '1. Find 1 unit.\n2. Times 3.', at: 1, ms: 95000 }, vZ: { text: 'gone video' } }, ...extra };
}

/* ---- The request ---- */
test('a body is the worksheet, the addresses and (optionally) a message — nothing else', () => {
  assert.deepEqual(validateBody({ worksheetId: 'S1', to: ['Mum@Example.com', 'mum@example.com'] }), { worksheetId: 'S1', to: ['mum@example.com'], message: '' });
  for (const bad of [null, [], 'x', { worksheetId: 'S1' }, { worksheetId: 'S1', to: [] }, { worksheetId: 'bad id!', to: ['a@b.co'] },
    { worksheetId: 'S1', to: ['a@b.co'], subject: 'hi' }, { worksheetId: 'S1', to: ['a@b.co'], html: '<b>' },
    { worksheetId: 'S1', to: ['not an email'] }, { worksheetId: 'S1', to: [42] }, { worksheetId: 'S1', to: ['a@b.co'], message: 7 }]) {
    assert.throws(() => validateBody(bad), /./, JSON.stringify(bad));
  }
  assert.throws(() => validateBody({ worksheetId: 'S1', to: Array.from({ length: TEACHER_TO_MAX + 1 }, (_, i) => 'a' + i + '@b.co') }), /At most/);
});

test('the teacher is the verified Google ADMIN_EMAIL; a student is a supported, unprotected account', () => {
  assert.equal(isTeacher(teacherUser), true);
  assert.equal(isTeacher({ ...teacherUser, email_verified: false }), false);
  assert.equal(isTeacher({ ...teacherUser, firebase: { sign_in_provider: 'password' } }), false);
  assert.equal(isTeacher({ ...teacherUser, centrePractice: true }), false);
  assert.equal(isStudent(kidUser, time), true);
  assert.equal(isStudent(teacherUser, time), false, 'the teacher is never "a student"');
  assert.equal(isStudent({ uid: 'x', firebase: { sign_in_provider: 'anonymous' } }, time), false);
});

/* ---- What a document may say ---- */
test('only playable videos, with real ids, survive; notes only for those videos', () => {
  const list = cleanVideos([video('ok', 1, 1, 'Q1'), { ...video('nourl', 1, 1), url: '' }, video('ok', 1, 1), { id: 'x y' }, null,
    { ...video('nopage', 0, 1) }]);
  assert.deepEqual(list.map(v => v.id), ['ok']);
  const notes = notesFor({ ok: { text: ' One. ' }, other: { text: 'x' }, ['__proto__']: { text: 'y' } }, list);
  assert.deepEqual(notes, { ok: 'One.' });
});
test('recording links: only lesson files in this project\'s Storage', () => {
  assert.equal(mediaUrlOk(URL_OK), true);
  assert.equal(mediaUrlOk('https://firebasestorage.googleapis.com/v0/b/mathgen--app.appspot.com/o/tutor-worksheets%2Fbody.json'), false);
  assert.equal(mediaUrlOk('https://evil.example/pdf-annotator/lesson-x'), false);
});
test('rows are in paper order with links built from ids', () => {
  const vids = cleanVideos([video('c', 1, 500, 'Q10'), video('a', 1, 100, 'Q2'), video('b', 1, 300, '')]);
  assert.deepEqual(orderVideos(vids).map(v => v.id), ['a', 'b', 'c']);
  assert.equal(watchLink('S1', 'a'), 'https://polymathlc.github.io/tutor/?ws=S1&video=a');
  assert.equal(watchLink('S1"', 'a'), '');
  const rows = summaryRows(vids, { a: 'Words' }, 'S1');
  assert.equal(rows[0].heading, 'Q2');
  assert.equal(rows[1].heading, 'Video 2 (page 1)');
  assert.equal(rows[0].text, 'Words');
  assert.equal(rows[0].media, URL_OK);
});

/* ---- The email ---- */
test('the email escapes every word, carries both links, the reply-to and the teacher\'s line', () => {
  const vids = cleanVideos([video('a', 1, 1, 'Q1 <i>'), video('b', 1, 90, 'Q2')]);
  const rows = summaryRows(vids, { a: 'Step <script>alert(1)</script>\nAnswer: 12' }, 'S1');
  const mail = buildSummaryMail({ name: 'P5 <b>Ratio</b>', level: 'P5', subject: 'math' }, rows, { to: ['mum@example.com'], message: 'See Q2 <again>' });
  assert.deepEqual(mail.to, ['mum@example.com']);
  assert.equal(mail.replyTo, ADMIN_EMAIL);
  assert.match(mail.message.subject, /^📝 Summary — P5 <b>Ratio<\/b>/, 'the subject is plain text, as the extension sends it');
  assert.doesNotMatch(mail.message.html, /<script>|<b>Ratio|<i>|<again>/);
  assert.match(mail.message.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;<br>Answer: 12/);
  assert.match(mail.message.html, /href="https:\/\/polymathlc\.github\.io\/tutor\/\?ws=S1&amp;video=a"/);
  assert.match(mail.message.html, /🎬 Recording only/);
  assert.match(mail.message.html, /See Q2 &lt;again&gt;/);
  assert.match(mail.message.text, /Q2 · worked solution \(voice\) · 1:35\n\(Not written up yet — watch the video\.\)/);
  assert.equal(mail.written, 1); assert.equal(mail.total, 2);
});

/* ---- The transaction ---- */
test('the teacher sends their own worksheet: one mail in the consult queue, the limit counted', async () => {
  const { records, repository } = store({ 'tutorWorksheets/S1': teacherSheet() });
  const out = await repository.send(teacherUser, { worksheetId: 'S1', to: ['mum@example.com'], message: 'Hi' }, time, true);
  assert.deepEqual(out, { status: 'queued', written: 1, total: 2, skipped: 1 });
  const mail = records.get(MAIL_COLLECTION + '/summary_teach_' + time);
  assert.ok(mail, 'queued where the Trigger Email extension reads');
  assert.equal(mail.kind, 'summary');
  assert.deepEqual(mail.to, ['mum@example.com']);
  assert.match(mail.message.html, /Hi/);
  assert.match(mail.message.html, /\?ws=S1&amp;video=vA/);
  assert.ok(mail.message.html.indexOf('Q2') < mail.message.html.indexOf('Q7'), 'paper order');
  assert.doesNotMatch(mail.message.html, /gone video/, 'a note for a video no longer there is not sent');
  assert.deepEqual(records.get(LIMIT_COLLECTION + '/teach'), { day: '2026-11-13', count: 1, last: time });
});

test('a student\'s copy reads the ASSIGNMENT\'s videos and words, and links to the shared id', async () => {
  const { records, repository } = store({
    'tutorWorksheets/C9': { name: 'P5 Ratio', ownerUid: 'kid', assignmentId: 'S1', level: 'P5', subject: 'math', videos: [] },
    'tutorAssignments/S1': { ...teacherSheet(), active: true }
  });
  await repository.send(kidUser, { worksheetId: 'C9', to: ['mum@example.com'], message: '' }, time, false);
  const mail = records.get(MAIL_COLLECTION + '/summary_kid_' + time);
  assert.match(mail.message.html, /\?ws=S1&amp;video=vA/, 'the link opens the reader\'s own copy of the set paper');
  assert.match(mail.message.html, /Find 1 unit\./);
});

test('somebody else\'s worksheet reads as missing; a withdrawn paper has nothing; nothing written is refused', async () => {
  const s = store({
    'tutorWorksheets/S1': teacherSheet(),
    'tutorWorksheets/C1': { ownerUid: 'kid', assignmentId: 'GONE' },
    'tutorWorksheets/C2': { ownerUid: 'kid', assignmentId: 'OFF' },
    'tutorAssignments/OFF': { ...teacherSheet(), active: false },
    'tutorWorksheets/S2': teacherSheet({ ownerUid: 'kid', videoNotes: {} })
  });
  await assert.rejects(s.repository.send(kidUser, { worksheetId: 'S1', to: ['a@b.co'], message: '' }, time, false), e => e.code === 'not_found');
  await assert.rejects(s.repository.send(kidUser, { worksheetId: 'NOPE', to: ['a@b.co'], message: '' }, time, false), e => e.code === 'not_found');
  await assert.rejects(s.repository.send(kidUser, { worksheetId: 'C1', to: ['a@b.co'], message: '' }, time, false), e => e.code === 'no_videos');
  await assert.rejects(s.repository.send(kidUser, { worksheetId: 'C2', to: ['a@b.co'], message: '' }, time, false), e => e.code === 'no_videos');
  await assert.rejects(s.repository.send(kidUser, { worksheetId: 'S2', to: ['a@b.co'], message: '' }, time, false), e => e.code === 'nothing_written');
  assert.equal([...s.records.keys()].filter(k => k.startsWith(MAIL_COLLECTION)).length, 0, 'no mail on any refusal');
});

test('a student is held to the gap and the daily ceiling; the day turns over in Singapore', async () => {
  const s = store({ 'tutorWorksheets/S2': teacherSheet({ ownerUid: 'kid' }) });
  const body = { worksheetId: 'S2', to: ['a@b.co'], message: '' };
  await s.repository.send(kidUser, body, time, false);
  await assert.rejects(s.repository.send(kidUser, body, time + 1000, false), e => e.code === 'too_soon');
  let t = time;
  for (let i = 1; i < STUDENT_DAILY_MAX; i++) { t += STUDENT_GAP_MS + 1; await s.repository.send(kidUser, body, t, false); }
  await assert.rejects(s.repository.send(kidUser, body, t + STUDENT_GAP_MS + 1, false), e => e.code === 'daily_limit');
  const tomorrow = Date.UTC(2026, 10, 13, 16, 30); // 00:30 on the 14th in Singapore
  assert.equal((await s.repository.send(kidUser, body, tomorrow, false)).status, 'queued');
});

/* ---- The endpoint ---- */
function service(user, overrides = {}) {
  const calls = [];
  const deps = {
    now: () => time, report: code => calls.push(['report', code]),
    auth: { async verifyIdToken(token, revoked) { calls.push(['verify', token, revoked]); return user; } },
    appCheck: { async verifyToken() { return { appId: APP_ID }; } },
    repository: { async send(u, body, t, teacher) { calls.push(['send', u.uid, body, teacher]); return { status: 'queued', written: 1, total: 1, skipped: 0 }; } },
    ...overrides
  };
  const instance = createSummaryService(deps);
  async function request(body, options = {}) {
    const headers = { origin: 'https://polymathlc.github.io', authorization: 'Bearer t', 'x-firebase-appcheck': 'ac', 'content-type': 'application/json', ...options.headers };
    const req = { method: options.method || 'POST', body, rawBody: options.rawBody, get: k => headers[k.toLowerCase()] };
    const res = { headers: {}, statusCode: 200, set(k, v) { this.headers[k] = v; return this; }, status(v) { this.statusCode = v; return this; },
      json(v) { this.body = v; return this; }, send(v) { this.body = v; return this; } };
    await instance.handler(req, res);
    return res;
  }
  return { calls, request };
}

test('the endpoint: origin, preflight, method, JSON, size, sign-in, App Check — the family\'s rules', async () => {
  const s = service(kidUser);
  assert.equal((await s.request({}, { headers: { origin: 'https://evil.example' } })).statusCode, 403);
  assert.equal((await s.request({}, { headers: { origin: 'https://polymathlc.com.sg.example' } })).statusCode, 403);
  assert.equal((await s.request({}, { method: 'OPTIONS' })).statusCode, 204);
  assert.equal((await s.request({}, { method: 'GET' })).statusCode, 405);
  assert.equal((await s.request({ worksheetId: 'S1', to: ['a@b.co'] }, { headers: { 'content-type': 'text/plain' } })).statusCode, 415);
  assert.equal((await s.request({ worksheetId: 'S1', to: ['a@b.co'] }, { rawBody: Buffer.alloc(5000) })).statusCode, 413);
  assert.equal((await s.request({ worksheetId: 'S1', to: ['a@b.co'] }, { headers: { authorization: '' } })).statusCode, 401);
  const noCheck = service(kidUser, { appCheck: { async verifyToken() { return { appId: 'other' }; } } });
  assert.equal((await noCheck.request({ worksheetId: 'S1', to: ['a@b.co'] })).statusCode, 403);
  const ok = await s.request({ worksheetId: 'S1', to: ['a@b.co'] }, { headers: { origin: 'https://www.polymathlc.com.sg' } });
  assert.equal(ok.statusCode, 200, 'the mirror Study Buddy is also served from');
  assert.deepEqual(s.calls.find(c => c[0] === 'verify'), ['verify', 't', true], 'revocation is checked');
});

test('a student: at most three addresses and no message of their own; the teacher: ten and a message', async () => {
  const kid = service(kidUser);
  assert.equal((await kid.request({ worksheetId: 'S1', to: ['a@b.co', 'b@b.co', 'c@b.co', 'd@b.co'] })).statusCode, 400);
  assert.equal(STUDENT_TO_MAX, 3);
  const msg = await kid.request({ worksheetId: 'S1', to: ['a@b.co'], message: 'buy now at spam.example' });
  assert.equal(msg.statusCode, 403);
  assert.equal(msg.body.error.code, 'teacher_only');
  assert.equal((await kid.request({ worksheetId: 'S1', to: ['a@b.co'], message: '' })).statusCode, 200);
  const teach = service(teacherUser);
  const r = await teach.request({ worksheetId: 'S1', to: ['a@b.co', 'b@b.co', 'c@b.co', 'd@b.co'], message: 'Please read Q7' });
  assert.equal(r.statusCode, 200);
  assert.equal(teach.calls.find(c => c[0] === 'send')[3], true, 'sent as the teacher');
  assert.equal((await teach.request({ worksheetId: 'S1', to: ['a@b.co'], message: 'x'.repeat(MESSAGE_MAX + 1) })).statusCode, 400);
  const anon = service({ uid: 'g', firebase: { sign_in_provider: 'anonymous' } });
  assert.equal((await anon.request({ worksheetId: 'S1', to: ['a@b.co'] })).statusCode, 403);
});

test('a fault inside is a 503 with words, and reported by code', async () => {
  const s = service(kidUser, { repository: { async send() { throw new Error('firestore down'); } } });
  const r = await s.request({ worksheetId: 'S1', to: ['a@b.co'] });
  assert.equal(r.statusCode, 503);
  assert.match(r.body.error.message, /Mail app/);
  assert.deepEqual(s.calls.filter(c => c[0] === 'report'), [['report', 'summary_request_failed']]);
});

test('index.js exports the endpoint with the consult\'s shape', () => {
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'index.js'), 'utf8');
  assert.match(src, /exports\.studyBuddySummary = onRequest\(\{[\s\S]*?invoker: 'public'[\s\S]*?\}, summaryService\.handler\);/);
  assert.doesNotMatch(src.slice(src.indexOf('exports.studyBuddySummary')), /^[^\n]*secrets:[^\n]*\n[^\n]*summaryService/m, 'it needs no secret');
});
