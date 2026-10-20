'use strict';

/* =====================================================================
   🙋 CONSULT — the email that tells the teacher a student wants help (v1.63.0)

   The student's device writes `tutorConsults/{id}` itself — the pop-ups in
   Study Buddy and Ans Key read that document, so a consult works with no
   server at all. What a browser cannot do is send an email, so this endpoint
   does one thing: it QUEUES ONE EMAIL for a consult that really exists, that
   really belongs to the caller, and that is really still waiting.

   The rules this file is built on, each of them load-bearing:

   - THE ADDRESS IS A CONSTANT, NEVER AN INPUT. `CONSULT_EMAIL` is
     `ADMIN_EMAIL` from centre-auth, and the request body carries the
     consult's id and NOTHING ELSE. A body field naming a recipient would turn
     this endpoint into a mail relay any signed-in student could point at
     anybody; there is no such field, and `validateBody` refuses a body that
     carries one.
   - EVERYTHING THE EMAIL SAYS IS READ OFF THE DOCUMENT, server side, and
     escaped. The student's name and the worksheet's name are words a person
     typed; in an HTML email they are text, never markup.
   - THE QUEUE IS A SERVER-ONLY PATH. The mail document is written under
     `tutorCentreAdmin/`, which the shared rules close to every client
     (`isTutorCentreAdminPath`). So the Trigger Email extension reading that
     collection can only ever send what THIS function wrote — a student
     cannot write a mail document of their own and have it delivered.
   - ONE EMAIL PER CONSULT, BY CONSTRUCTION. The mail document's id IS the
     consult's id, created inside a transaction that refuses when it exists —
     a double tap, a retry and a reload all land on `already`.
   - AND A CEILING PER STUDENT. `MIN_GAP_MS` between two emails from one
     account and `DAILY_MAX` a day (Singapore days), kept server side in
     `tutorCentreAdmin/consultLimits/records/{uid}`. A child who cancels and
     asks again twenty times must not be twenty emails.
   - IT NEEDS NO SECRET. Delivery is the "Trigger Email from Firestore"
     extension's job (its SMTP connection is configured in the extension, in
     the Firebase console), so this function deploys with nothing to set and
     the repository never holds a password. Until the extension is installed
     the document simply waits in the queue; the pop-ups still work.
   ===================================================================== */

const { APP_ID, allowedOrigin } = require('./live-service');
const { ADMIN_EMAIL, CentreError, isSupportedStudent } = require('./centre-auth');

const CONSULT_EMAIL = ADMIN_EMAIL;
const CONSULT_COLLECTION = 'tutorConsults';
const MAIL_COLLECTION = 'tutorCentreAdmin/consultMail/messages';
const LIMIT_COLLECTION = 'tutorCentreAdmin/consultLimits/records';
const JOIN_BASE = 'https://polymathlc.github.io/tutor/';
const ANSKEY_URL = 'https://polymathlc.github.io/anskey/';
const MAX_REQUEST_BYTES = 2000;
const FRESH_MS = 15 * 60 * 1000;
const MIN_GAP_MS = 60 * 1000;
const DAILY_MAX = 12;
const CONSULT_ID = /^[A-Za-z0-9]{12,40}$/;
const NAME_MAX = 80;
const TITLE_MAX = 120;
const TIME_ZONE = 'Asia/Singapore';

const plain = value => !!value && typeof value === 'object' && !Array.isArray(value);

class ConsultError extends CentreError {}

function validateBody(body) {
  if (!plain(body)) throw new ConsultError(400, 'invalid_request', 'Send the consult to notify.');
  const keys = Object.keys(body);
  // The id and nothing else: no recipient, no subject, no text.
  if (keys.length !== 1 || keys[0] !== 'consultId' || typeof body.consultId !== 'string' || !CONSULT_ID.test(body.consultId)) {
    throw new ConsultError(400, 'invalid_request', 'Send the consult to notify.');
  }
  return { consultId: body.consultId };
}

function stampMs(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value && typeof value.toMillis === 'function') { try { return value.toMillis(); } catch { return 0; } }
  if (value && typeof value.seconds === 'number') return value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1e6);
  if (value instanceof Date) return value.getTime();
  return 0;
}

function cleanText(value, max) {
  if (typeof value !== 'string') return '';
  // Control characters out (a header injected through a name is the classic
  // mail-form fault), whitespace folded, length bounded.
  const folded = value.replace(/[\u0000-\u001F\u007F]+/g, ' ').replace(/\s+/g, ' ').trim();
  return folded.length > max ? folded.slice(0, max - 1).trimEnd() + '…' : folded;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

function subjectWord(s) {
  return { math: 'Maths', science: 'Science', both: 'Maths & Science', english: 'English', chinese: 'Chinese' }[s] || '';
}

function dayKey(ms) {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
}

function clockWords(ms) {
  return new Intl.DateTimeFormat('en-SG', { timeZone: TIME_ZONE, weekday: 'short', day: 'numeric', month: 'short',
    hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(ms));
}

function consultLink(id) {
  return JOIN_BASE + '?consult=' + encodeURIComponent(id);
}

function consultAgeMs(data) {
  return stampMs(data && data.createdAt) || stampMs(data && data.at);
}

/* The one place the email is written. Pure, so the harness pins exactly what
   leaves the server: the recipient, the link, the escaping. */
function buildConsultMail(data, consultId, time) {
  const name = cleanText(data && data.studentName, NAME_MAX) || 'A student';
  const sheet = cleanText(data && data.worksheetName, TITLE_MAX);
  const level = cleanText(data && data.level, 12);
  const subject = subjectWord(cleanText(data && data.subject, 20));
  const page = data && data.view && Number(data.view.page) >= 1 ? Math.floor(Number(data.view.page)) : 0;
  const link = consultLink(consultId);
  const when = clockWords(time);
  const where = [[level, subject].filter(Boolean).join(' '), sheet, page ? 'page ' + page : ''].filter(Boolean).join(' · ');
  const subjectLine = '🙋 ' + name + ' is asking for help' + (sheet ? ' — ' + sheet : '');
  const text = [
    name + ' pressed Consult in Study Buddy and is waiting for you.',
    where ? 'Worksheet: ' + where : null,
    'Asked: ' + when + ' (Singapore time)',
    '',
    'Join them (opens their page, your camera and a pen): ' + link,
    '',
    'If Study Buddy or Ans Key is already open, a pop-up there has a Join button too.',
    'The link stops working once the student ends the consult or leaves the page.'
  ].filter(line => line !== null).join('\n');
  const html = '<div style="font-family:Century Gothic,Segoe UI,Arial,sans-serif;color:#1A1A1A;line-height:1.5;max-width:520px">'
    + '<p style="font-size:17px;margin:0 0 12px"><b>' + escapeHtml(name) + '</b> pressed <b>Consult</b> in Study Buddy and is waiting for you.</p>'
    + (where ? '<p style="margin:0 0 6px;color:#55554F">' + escapeHtml(where) + '</p>' : '')
    + '<p style="margin:0 0 18px;color:#8A8A84;font-size:13px">' + escapeHtml(when) + ' (Singapore time)</p>'
    + '<p style="margin:0 0 18px"><a href="' + escapeHtml(link) + '" style="display:inline-block;background:#FFE0B2;border:1px solid #FFCC80;'
    + 'border-radius:11px;padding:12px 22px;color:#1A1A1A;text-decoration:none;font-weight:700">Join ' + escapeHtml(name) + '</a></p>'
    + '<p style="margin:0 0 6px;color:#55554F;font-size:13px">You will see their page live, can write on it and talk to them on video.</p>'
    + '<p style="margin:0;color:#8A8A84;font-size:12px">If Study Buddy or <a href="' + escapeHtml(ANSKEY_URL) + '">Ans Key</a> is already open, '
    + 'a pop-up there has a Join button too. The link stops working once the consult ends.</p>'
    + '</div>';
  return { to: [CONSULT_EMAIL], message: { subject: subjectLine, text, html } };
}

function createConsultRepository(db) {
  const docAt = path => {
    const parts = path.split('/');
    let ref = db.collection(parts[0]).doc(parts[1]);
    for (let i = 2; i < parts.length; i += 2) ref = ref.collection(parts[i]).doc(parts[i + 1]);
    return ref;
  };
  async function queue(uid, consultId, time) {
    const consultRef = docAt(CONSULT_COLLECTION + '/' + consultId);
    const mailRef = docAt(MAIL_COLLECTION + '/' + consultId);
    const limitRef = docAt(LIMIT_COLLECTION + '/' + uid);
    return db.runTransaction(async tx => {
      const [consult, mail, limit] = await Promise.all([tx.get(consultRef), tx.get(mailRef), tx.get(limitRef)]);
      // Somebody else's consult reads exactly like a missing one: the answer
      // must not confirm that an id exists.
      if (!consult.exists) throw new ConsultError(404, 'not_found', 'That consult was not found.');
      const data = consult.data() || {};
      if (data.studentUid !== uid) throw new ConsultError(404, 'not_found', 'That consult was not found.');
      if (mail.exists) return { status: 'already' };
      if (data.status !== 'waiting') throw new ConsultError(409, 'closed', 'That consult has already ended.');
      const age = consultAgeMs(data);
      if (!age || time - age > FRESH_MS || age - time > FRESH_MS) throw new ConsultError(409, 'closed', 'That consult is too old to email about.');
      const lim = limit.exists ? (limit.data() || {}) : {};
      const today = dayKey(time);
      const last = Number(lim.last) || 0;
      if (last && time - last < MIN_GAP_MS) throw new ConsultError(429, 'too_soon', 'Mr Chung was emailed a moment ago.');
      const count = lim.day === today ? (Number(lim.count) || 0) : 0;
      if (count >= DAILY_MAX) throw new ConsultError(429, 'daily_limit', 'Today’s consult emails are used up. Mr Chung will still see a pop-up.');
      tx.set(mailRef, { ...buildConsultMail(data, consultId, time), consultId, studentUid: uid, createdAt: time });
      tx.set(limitRef, { day: today, count: count + 1, last: time });
      tx.update(consultRef, { emailQueued: time });
      return { status: 'queued' };
    });
  }
  return { queue };
}

function createConsultService({ auth, appCheck, repository, now = Date.now, report = () => {} }) {
  async function identify(req) {
    const match = /^Bearer ([^\s]+)$/.exec(req.get('authorization') || '');
    if (!match) throw new ConsultError(401, 'sign_in_required', 'Sign in to ask for a consult.');
    let user;
    try { user = await auth.verifyIdToken(match[1], true); }
    catch { throw new ConsultError(401, 'sign_in_required', 'Sign in again to ask for a consult.'); }
    if (!isSupportedStudent(user, now())) throw new ConsultError(403, 'student_required', 'Sign in with your Study Buddy account to ask for a consult.');
    try {
      const token = req.get('x-firebase-appcheck');
      if (!token || (await appCheck.verifyToken(token)).appId !== APP_ID) throw new Error('wrong app');
    } catch { throw new ConsultError(403, 'app_check_required', 'Refresh Study Buddy to verify this device.'); }
    return user;
  }
  async function handler(req, res) {
    res.set('Cache-Control', 'no-store'); res.set('Vary', 'Origin');
    const origin = req.get('origin');
    if (!allowedOrigin(origin)) return res.status(403).json({ error: { code: 'origin_not_allowed', message: 'Ask for a consult from Study Buddy.' } });
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Firebase-AppCheck');
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'POST') return res.status(405).json({ error: { code: 'method_not_allowed', message: 'Use POST to ask for a consult.' } });
    try {
      if (!/^application\/json(?:;|$)/i.test(req.get('content-type') || '')) throw new ConsultError(415, 'invalid_request', 'Send a JSON consult request.');
      if ((req.rawBody?.length || 0) > MAX_REQUEST_BYTES) throw new ConsultError(413, 'invalid_request', 'This consult request is too large.');
      const body = validateBody(req.body);
      const user = await identify(req);
      const result = await repository.queue(user.uid, body.consultId, now());
      return res.status(200).json(result);
    } catch (error) {
      if (error instanceof CentreError) return res.status(error.status).json({ error: { code: error.code, message: error.message } });
      report('consult_request_failed');
      return res.status(503).json({ error: { code: 'consult_unavailable', message: 'The email could not be sent just now. Mr Chung will still see a pop-up.' } });
    }
  }
  return { handler };
}

module.exports = {
  CONSULT_EMAIL, CONSULT_COLLECTION, MAIL_COLLECTION, LIMIT_COLLECTION, JOIN_BASE, MAX_REQUEST_BYTES,
  FRESH_MS, MIN_GAP_MS, DAILY_MAX, ConsultError, validateBody, stampMs, cleanText, escapeHtml, dayKey,
  consultLink, buildConsultMail, createConsultRepository, createConsultService
};
