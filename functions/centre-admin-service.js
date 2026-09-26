'use strict';

const { APP_ID, allowedOrigin } = require('./live-service');
const { ADMIN_EMAIL, PRACTICE_SECONDS, UID, CentreError, centreStudentKey } = require('./centre-auth');
const MAX_REQUEST_BYTES = 12000;
const LEVELS = Object.freeze(['P3', 'P4', 'P5', 'P6', 'S1']);
const plain = value => value && typeof value === 'object' && !Array.isArray(value);
function cleanStudent(value, complete = true) {
  if (!plain(value) || typeof value.name !== 'string' || value.name.trim().length > 80 ||
      typeof value.level !== 'string' || value.level.length > 20 || typeof value.subject !== 'string' || value.subject.length > 20) {
    throw new CentreError(400, 'invalid_student', 'Enter a student name, level and subject.');
  }
  const student = { name: value.name.trim(), level: value.level, subject: value.subject };
  if (complete && (!student.name || !LEVELS.includes(student.level) ||
      !(student.level === 'P3' ? ['science'] : ['science', 'math', 'both', 'english', 'chinese']).includes(student.subject))) {
    throw new CentreError(400, 'invalid_student', 'Choose a valid level and subject. Primary 3 offers Science.');
  }
  return student;
}
function validateBody(body) {
  if (!plain(body) || !['createStudent', 'updateStudent', 'startPractice'].includes(body.action)) {
    throw new CentreError(400, 'invalid_request', 'Choose a student management action.');
  }
  if (body.action === 'createStudent') {
    if (typeof body.requestId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(body.requestId)) {
      throw new CentreError(400, 'invalid_request', 'Reload the student form and try again.');
    }
    return { action: body.action, requestId: body.requestId.toLowerCase(), student: cleanStudent(body) };
  }
  if (typeof body.targetUid !== 'string' || !UID.test(body.targetUid) || !Number.isInteger(body.studentIndex) || body.studentIndex < 0 || body.studentIndex > 7) {
    throw new CentreError(400, 'invalid_student', 'Choose a student from the roster.');
  }
  return { action: body.action, targetUid: body.targetUid, studentIndex: body.studentIndex,
    expectedStudent: cleanStudent(body.expectedStudent, false),
    ...(body.action === 'updateStudent' ? { student: cleanStudent(body.student) } : {}) };
}
function createCentreService({ auth, appCheck, repository, now = Date.now, report = () => {} }) {
  async function identify(req) {
    const match = /^Bearer ([^\s]+)$/.exec(req.get('authorization') || '');
    if (!match) throw new CentreError(401, 'sign_in_required', 'Sign in as the teacher to manage students.');
    let user;
    try { user = await auth.verifyIdToken(match[1], true); }
    catch { throw new CentreError(401, 'sign_in_required', 'Sign in again as the teacher.'); }
    if (!user.uid || user.firebase?.sign_in_provider !== 'google.com' || user.email_verified !== true ||
        String(user.email || '').toLowerCase() !== ADMIN_EMAIL || user.centrePractice === true) {
      throw new CentreError(403, 'teacher_required', 'Only the teacher can manage students and start centre practice.');
    }
    try {
      const token = req.get('x-firebase-appcheck');
      if (!token || (await appCheck.verifyToken(token)).appId !== APP_ID) throw new Error('wrong app');
    } catch { throw new CentreError(403, 'app_check_required', 'Refresh Study Buddy to verify this device.'); }
    return user;
  }
  async function handler(req, res) {
    res.set('Cache-Control', 'no-store'); res.set('Vary', 'Origin');
    const origin = req.get('origin');
    if (!allowedOrigin(origin)) return res.status(403).json({ error: { code: 'origin_not_allowed', message: 'Open student management from Study Buddy.' } });
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Firebase-AppCheck');
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'POST') return res.status(405).json({ error: { code: 'method_not_allowed', message: 'Use POST for student requests.' } });
    try {
      if (!/^application\/json(?:;|$)/i.test(req.get('content-type') || '')) throw new CentreError(415, 'invalid_request', 'Send a JSON student request.');
      if ((req.rawBody?.length || 0) > MAX_REQUEST_BYTES) throw new CentreError(413, 'invalid_request', 'This student request is too large.');
      const body = validateBody(req.body), user = await identify(req), time = now();
      let result;
      if (body.action === 'createStudent') result = await repository.createStudent(user.uid, body.requestId, body.student, time);
      else if (body.action === 'updateStudent') result = await repository.updateStudent(user.uid, body.targetUid, body.studentIndex, body.student, body.expectedStudent, time);
      else {
        result = await repository.startPractice(user.uid, body.targetUid, body.studentIndex, body.expectedStudent, time);
        const expiresAt = Math.floor(time / 1000) + PRACTICE_SECONDS;
        const token = await auth.createCustomToken(result.targetUid, { centrePractice: true, centreActorUid: user.uid,
          centreStudentIndex: result.studentIndex, centreStudentKey: centreStudentKey(result.student), centrePracticeExpiresAt: expiresAt });
        result = { token, targetUid: result.targetUid, studentIndex: result.studentIndex, student: result.student, expiresAt };
      }
      return res.status(200).json(result);
    } catch (error) {
      if (error instanceof CentreError) return res.status(error.status).json({ error: { code: error.code, message: error.message } });
      report('centre_request_failed');
      return res.status(503).json({ error: { code: 'centre_unavailable', message: 'Student management is unavailable just now. Try again; student creation will not be duplicated.' } });
    }
  }
  return { handler };
}
module.exports = { MAX_REQUEST_BYTES, LEVELS, cleanStudent, validateBody, createCentreService };
