'use strict';

/* =====================================================================
   📝 THE SUMMARY EMAIL — every question's video solution in words, with a
   link to each video, sent to the addresses the reader names (v1.89.0)

   The teacher records a video solution per question (🎬, v1.55.0) and turns
   each one into a few written lines in Study Buddy (lesson-summary.js). Those
   lines are saved on the worksheet and on the assignment beside it as
   `videoNotes` — the same two documents the `videos` list lives on. A
   browser cannot send an email, so this endpoint does it, and the rules it
   is built on are the consult email's, each of them load-bearing:

   - THE BROWSER SENDS IDS AND ADDRESSES, NEVER THE WORDS. The body is
     `{ worksheetId, to, message? }` and nothing else (`validateBody` refuses
     any other key). Every word of the email — the worksheet's name, every
     heading, every written line, every link — is read OFF THE DOCUMENTS
     here, cleaned and escaped. So the endpoint can only ever send what the
     teacher recorded and wrote up, about a worksheet the caller owns: it is
     not a relay for text somebody typed.
   - THE ONE EXCEPTION IS THE TEACHER'S OWN LINE (`message`), which only the
     verified teacher may send. From a student it is refused, not dropped:
     a client sending it has been changed.
   - THE LINKS ARE BUILT, NOT COPIED. ▶ Watch is `JOIN_BASE?ws=<id>&video=<id>`
     from ids that pass `ID_RE`; 🎬 the recording is shown only when the
     stored link is a Firebase Storage link into a lesson folder
     (`mediaUrlOk`, the rule `lessonAssetUrl` keeps in the app).
   - WHO MAY SEND WHAT. The teacher (a verified Google sign-in as
     ADMIN_EMAIL) may send any worksheet, to up to `TEACHER_TO_MAX`
     addresses, `TEACHER_DAILY_MAX` a day. A student — a Google account or a
     centre practice login, never a protected one — may send their OWN
     worksheet only, to up to `STUDENT_TO_MAX` addresses, `STUDENT_DAILY_MAX`
     a day, `STUDENT_GAP_MS` apart. Somebody else's worksheet reads exactly
     like a missing one.
   - THE MAIL GOES THROUGH THE SAME QUEUE THE CONSULT EMAILS DO
     (`MAIL_COLLECTION`, server-only under the shared rules), because the
     "Trigger Email from Firestore" extension watches ONE collection. A
     second collection would be a queue nothing ever sends. `replyTo` is the
     teacher, so a parent's reply reaches Mr Chung.
   - ONE TRANSACTION: the worksheet, the assignment, the limits, the mail.
   ===================================================================== */

const { APP_ID } = require('./live-service');
const { ADMIN_EMAIL, CentreError, isSupportedStudent, protectedIdentity } = require('./centre-auth');
// The consult endpoint's origin rule: GitHub Pages and the polymathlc.com.sg
// mirror Study Buddy is also served from, compared whole.
const { MAIL_COLLECTION, JOIN_BASE, cleanText, escapeHtml, dayKey, stampMs, consultOrigin } = require('./consult-service');

const WORKSHEETS = 'tutorWorksheets';
const ASSIGNMENTS = 'tutorAssignments';
const LIMIT_COLLECTION = 'tutorCentreAdmin/summaryLimits/records';
const MAX_REQUEST_BYTES = 4000;
const ID_RE = /^[A-Za-z0-9_-]{1,128}$/;
const EMAIL_RE = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
const TEACHER_TO_MAX = 10;
const STUDENT_TO_MAX = 3;
const TEACHER_DAILY_MAX = 60;
const STUDENT_DAILY_MAX = 6;
const TEACHER_GAP_MS = 3 * 1000;
const STUDENT_GAP_MS = 30 * 1000;
const MESSAGE_MAX = 500;
const NOTE_MAX = 2400;
const VIDEOS_MAX = 60;
const TITLE_MAX = 40;
const NAME_MAX = 120;
const LESSON_DIRS = Object.freeze(['pdf-annotator', 'tutor-worksheets']);
const QNUM_RE = /^\s*(?:Q(?:uestion)?\.?\s*)?(\d{1,3})\s*([a-z]|\([a-z]\)|\((?:i{1,3}|iv|v)\))?/i;
const ROW = 40;

const plain = value => !!value && typeof value === 'object' && !Array.isArray(value);
const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

class SummaryError extends CentreError {}

/* ---- The request ---- */
function cleanEmails(list, max) {
  if (!Array.isArray(list) || !list.length) throw new SummaryError(400, 'invalid_request', 'Name at least one email address.');
  if (list.length > max) throw new SummaryError(400, 'too_many', 'At most ' + max + ' addresses at a time.');
  const out = [];
  for (const raw of list) {
    if (typeof raw !== 'string') throw new SummaryError(400, 'invalid_email', 'One of those is not an email address.');
    const e = raw.trim().toLowerCase();
    if (!e || e.length > 254 || !EMAIL_RE.test(e)) throw new SummaryError(400, 'invalid_email', '“' + cleanText(raw, 60) + '” is not an email address.');
    if (!out.includes(e)) out.push(e);
  }
  return out;
}
function validateBody(body) {
  if (!plain(body)) throw new SummaryError(400, 'invalid_request', 'Send the worksheet and the addresses.');
  const keys = Object.keys(body);
  if (keys.some(k => !['worksheetId', 'to', 'message'].includes(k))) throw new SummaryError(400, 'invalid_request', 'Send the worksheet and the addresses only.');
  if (typeof body.worksheetId !== 'string' || !ID_RE.test(body.worksheetId)) throw new SummaryError(400, 'invalid_request', 'Send the worksheet to summarise.');
  // The upper bound here is the teacher's; a student's is checked once we know who is asking.
  const to = cleanEmails(body.to, TEACHER_TO_MAX);
  if (own(body, 'message') && typeof body.message !== 'string') throw new SummaryError(400, 'invalid_request', 'The message must be text.');
  const message = own(body, 'message') ? body.message : '';
  if (message.length > MESSAGE_MAX * 2) throw new SummaryError(400, 'invalid_request', 'That message is too long.');
  return { worksheetId: body.worksheetId, to, message };
}

/* ---- Who is asking ---- */
function isTeacher(user) {
  return !!user && !!user.uid && user.firebase?.sign_in_provider === 'google.com' && user.email_verified === true &&
    String(user.email || '').toLowerCase() === ADMIN_EMAIL && user.centrePractice !== true;
}
function isStudent(user, nowMs = Date.now()) {
  return !!user && !!user.uid && !protectedIdentity(user) && isSupportedStudent(user, nowMs);
}

/* ---- What a document may say (the app's own cleaners, ported) ---- */
function mediaUrlOk(value) {
  if (typeof value !== 'string' || !value) return false;
  let u;
  try { u = new URL(value); } catch { return false; }
  if (u.protocol !== 'https:' || u.hostname !== 'firebasestorage.googleapis.com') return false;
  if (!/^\/v0\/b\/mathgen--app\.(?:firebasestorage\.app|appspot\.com)\/o\//.test(u.pathname)) return false;
  let path = '';
  try { path = decodeURIComponent(u.pathname).split('/o/')[1] || ''; } catch { return false; }
  return LESSON_DIRS.some(d => path.startsWith(d + '/lesson-'));
}
function cleanVideos(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const v of list) {
    if (out.length >= VIDEOS_MAX) break;
    if (!plain(v) || typeof v.id !== 'string' || !ID_RE.test(v.id) || seen.has(v.id)) continue;
    const r = v.lessonRecording;
    if (!plain(r) || typeof v.url !== 'string' || !v.url) continue;
    if (!(Number.isInteger(v.page) && v.page >= 1 && v.page <= 10000)) continue;
    seen.add(v.id);
    out.push({
      id: v.id, page: v.page, x: Number(v.x) || 0, y: Number(v.y) || 0, url: v.url,
      title: typeof r.title === 'string' ? cleanText(r.title, TITLE_MAX) : '',
      video: r.video === true, duration: Math.max(0, Number(r.duration) || 0)
    });
  }
  return out;
}
function cleanNoteText(value) {
  if (typeof value !== 'string') return '';
  let s = value.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  s = s.replace(/\n{3,}/g, '\n\n');
  return s.length > NOTE_MAX ? s.slice(0, NOTE_MAX - 1).trimEnd() + '…' : s;
}
function notesFor(map, videos) {
  const out = {};
  if (!plain(map)) return out;
  const keep = new Set(videos.map(v => v.id));
  for (const id of Object.keys(map)) {
    if (!own(map, id) || !ID_RE.test(id) || !keep.has(id) || !plain(map[id])) continue;
    const text = cleanNoteText(map[id].text);
    if (text) out[id] = text;
  }
  return out;
}
function questionOf(v) {
  const m = v.title ? v.title.match(QNUM_RE) : null;
  return m ? { n: Number(m[1]) || 0, part: String(m[2] || '').replace(/[()]/g, '').toLowerCase() } : { n: 0, part: '' };
}
function orderVideos(list) {
  return list.slice().sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page;
    const qa = questionOf(a), qb = questionOf(b);
    if (qa.n && qb.n && qa.n !== qb.n) return qa.n - qb.n;
    if (qa.n && qb.n && qa.part !== qb.part) return qa.part < qb.part ? -1 : 1;
    const ra = Math.round(a.y / ROW), rb = Math.round(b.y / ROW);
    if (ra !== rb) return ra - rb;
    return a.x - b.x;
  });
}
function clock(ms) {
  const s = Math.max(0, Math.round((Number(ms) || 0) / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const p = n => (n < 10 ? '0' : '') + n;
  return h ? h + ':' + p(m) + ':' + p(r) : m + ':' + p(r);
}
function headingOf(v, i) {
  if (v.title) return /^\d{1,3}[a-z]?$/i.test(v.title) ? 'Q' + v.title : v.title;
  return 'Video ' + (i + 1) + ' (page ' + v.page + ')';
}
function watchLink(wsId, videoId) {
  if (!ID_RE.test(String(wsId || '')) || !ID_RE.test(String(videoId || ''))) return '';
  return JOIN_BASE + '?ws=' + encodeURIComponent(wsId) + '&video=' + encodeURIComponent(videoId);
}
function summaryRows(videos, notes, linkWs) {
  return orderVideos(videos).map((v, i) => ({
    id: v.id, heading: headingOf(v, i), kind: v.video ? 'video solution' : 'worked solution (voice)',
    duration: clock(v.duration), page: v.page, text: notes[v.id] || '',
    watch: watchLink(linkWs, v.id), media: mediaUrlOk(v.url) ? v.url : ''
  }));
}
function subjectWord(s) {
  return { math: 'Maths', science: 'Science', both: 'Maths & Science', english: 'English', chinese: 'Chinese' }[s] || '';
}

/* ---- The email: pure, so the harness pins exactly what leaves ---- */
function buildSummaryMail(sheet, rows, opts = {}) {
  const name = cleanText(sheet && sheet.name, NAME_MAX) || 'a worksheet';
  const tag = [cleanText(sheet && sheet.level, 12), subjectWord(cleanText(sheet && sheet.subject, 20))].filter(Boolean).join(' ');
  const message = cleanNoteText(typeof opts.message === 'string' ? opts.message : '').slice(0, MESSAGE_MAX);
  const written = rows.filter(r => r.text).length;
  const subjectLine = '📝 Summary — ' + name + ' (video solutions in words)';
  const text = [
    'Summary of “' + name + '”' + (tag ? ' (' + tag + ')' : '') + ' — the video solutions in words.',
    'Explained by Mr Chung.',
    message || null,
    ...rows.map(r => [
      r.heading + ' · ' + r.kind + ' · ' + r.duration,
      r.text || '(Not written up yet — watch the video.)',
      r.watch ? '▶ Watch it on the worksheet (sign in to Study Buddy): ' + r.watch : null,
      r.media ? '🎬 The recording on its own (no sign-in): ' + r.media : null
    ].filter(Boolean).join('\n')),
    '— Polymath Study Buddy. Reply to this email to reach Mr Chung.'
  ].filter(line => line !== null).join('\n\n');
  const linkBtn = (href, words, bg, border) => '<a href="' + escapeHtml(href) + '" style="display:inline-block;background:' + bg + ';border:1px solid ' + border +
    ';border-radius:10px;padding:8px 14px;margin:0 8px 6px 0;color:#1A1A1A;text-decoration:none;font-weight:700;font-size:14px">' + escapeHtml(words) + '</a>';
  const rowHtml = r => '<div style="border:1px solid #ECECEA;border-radius:12px;padding:12px 16px;margin:0 0 12px">'
    + '<p style="margin:0 0 6px"><b style="font-size:16px">' + escapeHtml(r.heading) + '</b> '
    + '<span style="color:#8A8A84;font-size:13px">' + escapeHtml(r.kind + ' · ' + r.duration + ' · page ' + r.page) + '</span></p>'
    + (r.text
      ? '<div style="margin:0 0 10px;padding:8px 12px;background:#F7F6F4;border-left:4px solid #5E35B1;border-radius:6px;line-height:1.55">'
        + r.text.split('\n').map(line => line ? escapeHtml(line) : '').join('<br>') + '</div>'
      : '<p style="margin:0 0 10px;color:#8A8A84;font-style:italic">Not written up yet — watch the video.</p>')
    + (r.watch ? linkBtn(r.watch, '▶ Watch on the worksheet', '#FFE0B2', '#FFCC80') : '')
    + (r.media ? linkBtn(r.media, '🎬 Recording only', '#EDE7F6', '#D1C4E9') : '')
    + '</div>';
  const html = '<div style="font-family:Century Gothic,Segoe UI,Arial,sans-serif;color:#1A1A1A;line-height:1.5;max-width:600px">'
    + '<p style="font-size:18px;margin:0 0 4px"><b>📝 ' + escapeHtml(name) + '</b></p>'
    + '<p style="margin:0 0 14px;color:#55554F">' + escapeHtml((tag ? tag + ' · ' : '') + 'the video solutions in words, explained by Mr Chung') + '</p>'
    + (message ? '<blockquote style="margin:0 0 16px;padding:10px 14px;border-left:4px solid #E8A54B;background:#FFF8EC;border-radius:6px">'
      + message.split('\n').map(escapeHtml).join('<br>') + '</blockquote>' : '')
    + rows.map(rowHtml).join('')
    + '<p style="margin:16px 0 0;color:#8A8A84;font-size:12px">▶ opens the worksheet in Study Buddy with the video playing on the page (sign in first). '
    + '🎬 plays the recording on its own, with no sign-in. Reply to this email to reach Mr Chung.</p>'
    + '</div>';
  return { to: opts.to || [], replyTo: ADMIN_EMAIL, message: { subject: subjectLine, text, html }, written, total: rows.length };
}

/* ---- The repository: one transaction ---- */
function createSummaryRepository(db) {
  const docAt = path => {
    const parts = path.split('/');
    let ref = db.collection(parts[0]).doc(parts[1]);
    for (let i = 2; i < parts.length; i += 2) ref = ref.collection(parts[i]).doc(parts[i + 1]);
    return ref;
  };
  async function send(user, body, time, teacher) {
    const sheetRef = docAt(WORKSHEETS + '/' + body.worksheetId);
    const limitRef = docAt(LIMIT_COLLECTION + '/' + user.uid);
    const mailRef = docAt(MAIL_COLLECTION + '/summary_' + user.uid + '_' + time);
    return db.runTransaction(async tx => {
      const [sheet, limit] = await Promise.all([tx.get(sheetRef), tx.get(limitRef)]);
      if (!sheet.exists) throw new SummaryError(404, 'not_found', 'That worksheet was not found.');
      const data = sheet.data() || {};
      // Somebody else's worksheet reads exactly like a missing one.
      if (!teacher && data.ownerUid !== user.uid) throw new SummaryError(404, 'not_found', 'That worksheet was not found.');
      let source = data, linkWs = body.worksheetId;
      if (typeof data.assignmentId === 'string' && data.assignmentId) {
        if (!ID_RE.test(data.assignmentId)) throw new SummaryError(404, 'not_found', 'That worksheet was not found.');
        const set = await tx.get(docAt(ASSIGNMENTS + '/' + data.assignmentId));
        const a = set.exists ? (set.data() || {}) : null;
        // A paper taken off the class list has no videos (the shelf's rule).
        source = a && a.active !== false ? a : {};
        linkWs = data.assignmentId;
      }
      const videos = cleanVideos(source.videos);
      if (!videos.length) throw new SummaryError(409, 'no_videos', 'This worksheet has no video solutions to summarise.');
      const notes = notesFor(source.videoNotes, videos);
      const rows = summaryRows(videos, notes, linkWs);
      if (!rows.some(r => r.text)) throw new SummaryError(409, 'nothing_written', 'Nothing is written up yet — the teacher writes the summary first.');

      const lim = limit.exists ? (limit.data() || {}) : {};
      const today = dayKey(time);
      const last = Number(lim.last) || 0;
      const gap = teacher ? TEACHER_GAP_MS : STUDENT_GAP_MS;
      if (last && time - last < gap) throw new SummaryError(429, 'too_soon', 'A summary was sent a moment ago — wait a few seconds.');
      const count = lim.day === today ? (Number(lim.count) || 0) : 0;
      if (count >= (teacher ? TEACHER_DAILY_MAX : STUDENT_DAILY_MAX)) {
        throw new SummaryError(429, 'daily_limit', 'Today’s summary emails are used up. ✉️ Mail app still works.');
      }
      const built = buildSummaryMail({ name: source.name || data.name, level: data.level || source.level, subject: data.subject || source.subject },
        rows, { to: body.to, message: teacher ? body.message : '' });
      tx.set(mailRef, { to: built.to, replyTo: built.replyTo, message: built.message, kind: 'summary',
        worksheetId: body.worksheetId, senderUid: user.uid, createdAt: time });
      tx.set(limitRef, { day: today, count: count + 1, last: time });
      return { status: 'queued', written: built.written, total: built.total, skipped: built.total - built.written };
    });
  }
  return { send };
}

/* ---- The endpoint ---- */
function createSummaryService({ auth, appCheck, repository, now = Date.now, report = () => {} }) {
  async function identify(req) {
    const match = /^Bearer ([^\s]+)$/.exec(req.get('authorization') || '');
    if (!match) throw new SummaryError(401, 'sign_in_required', 'Sign in to send a summary.');
    let user;
    try { user = await auth.verifyIdToken(match[1], true); }
    catch { throw new SummaryError(401, 'sign_in_required', 'Sign in again to send a summary.'); }
    const teacher = isTeacher(user);
    if (!teacher && !isStudent(user, now())) throw new SummaryError(403, 'student_required', 'Sign in with your Study Buddy account to send a summary.');
    try {
      const token = req.get('x-firebase-appcheck');
      if (!token || (await appCheck.verifyToken(token)).appId !== APP_ID) throw new Error('wrong app');
    } catch { throw new SummaryError(403, 'app_check_required', 'Refresh Study Buddy to verify this device.'); }
    return { user, teacher };
  }
  async function handler(req, res) {
    res.set('Cache-Control', 'no-store'); res.set('Vary', 'Origin');
    const origin = req.get('origin');
    if (!consultOrigin(origin)) return res.status(403).json({ error: { code: 'origin_not_allowed', message: 'Send a summary from Study Buddy.' } });
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Firebase-AppCheck');
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'POST') return res.status(405).json({ error: { code: 'method_not_allowed', message: 'Use POST to send a summary.' } });
    try {
      if (!/^application\/json(?:;|$)/i.test(req.get('content-type') || '')) throw new SummaryError(415, 'invalid_request', 'Send a JSON summary request.');
      if ((req.rawBody?.length || 0) > MAX_REQUEST_BYTES) throw new SummaryError(413, 'invalid_request', 'This summary request is too large.');
      const body = validateBody(req.body);
      const { user, teacher } = await identify(req);
      if (!teacher && body.to.length > STUDENT_TO_MAX) throw new SummaryError(400, 'too_many', 'At most ' + STUDENT_TO_MAX + ' addresses at a time.');
      if (!teacher && body.message.trim()) throw new SummaryError(403, 'teacher_only', 'Only the teacher adds a message.');
      if (teacher && body.message.length > MESSAGE_MAX) throw new SummaryError(400, 'invalid_request', 'Keep the message under ' + MESSAGE_MAX + ' characters.');
      const result = await repository.send(user, body, now(), teacher);
      return res.status(200).json(result);
    } catch (error) {
      if (error instanceof CentreError) return res.status(error.status).json({ error: { code: error.code, message: error.message } });
      report('summary_request_failed');
      return res.status(503).json({ error: { code: 'summary_unavailable', message: 'The summary could not be sent just now. ✉️ Mail app still works.' } });
    }
  }
  return { handler };
}

module.exports = {
  WORKSHEETS, ASSIGNMENTS, LIMIT_COLLECTION, MAX_REQUEST_BYTES, TEACHER_TO_MAX, STUDENT_TO_MAX,
  TEACHER_DAILY_MAX, STUDENT_DAILY_MAX, TEACHER_GAP_MS, STUDENT_GAP_MS, MESSAGE_MAX, NOTE_MAX,
  SummaryError, validateBody, cleanEmails, isTeacher, isStudent, mediaUrlOk, cleanVideos, notesFor,
  orderVideos, headingOf, watchLink, summaryRows, buildSummaryMail, createSummaryRepository, createSummaryService,
  stampMs
};
