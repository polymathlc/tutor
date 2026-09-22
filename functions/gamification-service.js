'use strict';

const { APP_ID, allowedOrigin } = require('./live-service');
const { SUBJECTS, COMPANIONS, FRAMES, GameError } = require('./gamification-core');
const ADMIN_EMAIL = 'chungzhikai@gmail.com';
const MAX_REQUEST_BYTES = 1500000;

function validateBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || !['snapshot', 'preferences', 'attempt', 'inspectMember', 'approveMember'].includes(body.action)) {
    throw new GameError(400, 'invalid_request', 'Choose a valid adventure action.');
  }
  if (!Number.isInteger(body.studentIndex) || body.studentIndex < 0 || body.studentIndex > 7 || !SUBJECTS.includes(body.subject)) {
    throw new GameError(400, 'invalid_student', 'Choose your student profile and subject.');
  }
  const clean = { action: body.action, studentIndex: body.studentIndex, subject: body.subject };
  if (body.learnerKey !== undefined) {
    if (typeof body.learnerKey !== 'string' || !/^[a-f0-9]{64}$/.test(body.learnerKey)) throw new GameError(400, 'invalid_student', 'Refresh your adventure profile.');
    clean.learnerKey = body.learnerKey;
  }
  if (['inspectMember', 'approveMember'].includes(body.action)) {
    if (typeof body.targetUid !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(body.targetUid)) throw new GameError(400, 'invalid_student', 'Choose a student from the roster.');
    clean.targetUid = body.targetUid;
    if (body.action === 'approveMember') {
      if (typeof body.approved !== 'boolean') throw new GameError(400, 'invalid_request', 'Choose whether to approve this group.');
      clean.approved = body.approved;
    }
  }
  if (body.action === 'preferences') {
    if (body.companion !== undefined) {
      if (typeof body.companion !== 'string' || !Object.hasOwn(COMPANIONS, body.companion)) throw new GameError(400, 'invalid_companion', 'Choose one of your adventure companions.');
      clean.companion = body.companion;
    }
    if (body.frame !== undefined) {
      if (typeof body.frame !== 'string' || !Object.hasOwn(FRAMES, body.frame)) throw new GameError(400, 'invalid_frame', 'Choose one of your adventure frames.');
      clean.frame = body.frame;
    }
    if (body.optIn !== undefined) {
      if (typeof body.optIn !== 'boolean') throw new GameError(400, 'invalid_request', 'Choose whether to join the leaderboard.');
      clean.optIn = body.optIn;
    }
  }
  if (body.action === 'attempt') {
    if (!['practice', 'correction'].includes(body.kind)) throw new GameError(400, 'invalid_request', 'Choose a practice or correction attempt.');
    if (typeof body.question !== 'string' || body.question.trim().length < 4 || body.question.length > 8000 || typeof body.answer !== 'string' || !body.answer.trim() || body.answer.length > 4000) {
      throw new GameError(400, 'invalid_attempt', 'A question and your own answer are needed for rewards.');
    }
    clean.kind = body.kind; clean.question = body.question.trim(); clean.answer = body.answer.trim();
    if (body.questionImage !== undefined && body.questionImage !== '') {
      if (typeof body.questionImage !== 'string' || body.questionImage.length > 1400000 || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(body.questionImage)) {
        throw new GameError(400, 'invalid_image', 'Use a small question image for reward checking.');
      }
      clean.questionImage = body.questionImage;
    }
  }
  return clean;
}

function createGameService({ auth, appCheck, repository, provider, now = Date.now, report = () => {} }) {
  async function identify(req) {
    const match = /^Bearer ([^\s]+)$/.exec(req.get('authorization') || '');
    if (!match) throw new GameError(401, 'sign_in_required', 'Sign in to save your adventure.');
    const token = req.get('x-firebase-appcheck');
    if (!token) throw new GameError(403, 'app_check_required', 'Refresh Study Buddy to verify your adventure.');
    let user;
    try { user = await auth.verifyIdToken(match[1], true); }
    catch { throw new GameError(401, 'sign_in_required', 'Sign in again to save your adventure.'); }
    if (!user.uid || user.firebase?.sign_in_provider !== 'google.com') throw new GameError(403, 'sign_in_required', 'Use Google sign-in to save your adventure.');
    try {
      const claims = await appCheck.verifyToken(token);
      if (claims.appId !== APP_ID) throw new Error('wrong app');
    } catch { throw new GameError(403, 'app_check_required', 'Refresh Study Buddy to verify your adventure.'); }
    return user;
  }

  async function handler(req, res) {
    res.set('Cache-Control', 'no-store'); res.set('Vary', 'Origin');
    const origin = req.get('origin');
    if (!allowedOrigin(origin)) return res.status(403).json({ error: { code: 'origin_not_allowed', message: 'Open your adventure from Study Buddy.' } });
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Firebase-AppCheck');
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'POST') return res.status(405).json({ error: { code: 'method_not_allowed', message: 'Use POST for adventure requests.' } });
    try {
      if (!/^application\/json(?:;|$)/i.test(req.get('content-type') || '')) throw new GameError(415, 'invalid_request', 'Send a JSON adventure request.');
      if ((req.rawBody?.length || 0) > MAX_REQUEST_BYTES) throw new GameError(413, 'invalid_request', 'This reward request is too large.');
      const body = validateBody(req.body);
      const user = await identify(req);
      const adminAction = ['inspectMember', 'approveMember'].includes(body.action);
      if (adminAction && !(user.email_verified === true && user.email?.toLowerCase() === ADMIN_EMAIL)) throw new GameError(403, 'teacher_required', 'Only the teacher can approve learning groups.');
      const context = await repository.resolve(adminAction ? body.targetUid : user.uid, body.studentIndex, body.subject, body.learnerKey,
        adminAction && (body.action === 'inspectMember' || body.approved === false));
      if (body.action === 'inspectMember') return res.status(200).json(await repository.inspectMember(context));
      if (body.action === 'approveMember') return res.status(200).json(await repository.approveMember(context, body.approved, user.uid, now()));
      if (body.action === 'preferences') await repository.preferences(context, body, now());
      let award;
      if (body.action === 'attempt') {
        const reservation = await repository.reserve(context, body, now());
        award = reservation.award;
        if (reservation.lease) {
          try {
            const verdict = await provider.verify({ ...body, level: context.level });
            award = await repository.award(context, reservation.lease, verdict, now());
          } catch (error) {
            try { await repository.release(reservation.lease); } catch { report('game_verification_release_failed'); }
            throw error;
          }
        }
      }
      return res.status(200).json({ ...await repository.snapshot(context, now()), ...(award ? { award } : {}) });
    } catch (error) {
      if (error instanceof GameError) return res.status(error.status).json({ error: { code: error.code, message: error.message } });
      report('game_request_failed');
      return res.status(503).json({ error: { code: 'game_unavailable', message: 'Your work is saved. Adventure rewards are unavailable just now; please try again.' } });
    }
  }
  return { handler };
}
module.exports = { ADMIN_EMAIL, MAX_REQUEST_BYTES, validateBody, createGameService };
