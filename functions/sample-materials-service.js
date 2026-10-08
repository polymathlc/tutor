'use strict';

const { createHash, randomBytes, randomUUID } = require('node:crypto');
const { sessionConfig } = require('./live-service');
const { ADMIN_EMAIL } = require('./centre-auth');
const { normalizeLevel } = require('./learner-guidance');
const BUCKET = 'mathgen--app.firebasestorage.app';
const MAX_PDF_BYTES = 10 * 1024 * 1024;
const TRIAL_SECONDS = 5 * 60;
const GUEST_SECONDS = 15 * 60;
const QUESTION_LIMIT = 15;
const IP_LIMIT = 25;
const DAILY_LIMIT = 300;
class SampleError extends Error { constructor(status, code, message) { super(message); this.status = status; this.code = code; } }
const hash = value => createHash('sha256').update(value).digest('hex');
function allowedOrigin(origin) { return ['https://polymathlc.github.io', 'https://polymathlc.com.sg', 'https://www.polymathlc.com.sg'].includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(origin || ''); }
function subjectOf(body) { if (!['math', 'science'].includes(body?.subject)) throw new SampleError(400, 'invalid_subject', 'Choose Maths or Science.'); return body.subject; }
function validWorksheet(value, subject) {
  if (!value || typeof value.id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value.id) || typeof value.title !== 'string' || !value.title.trim()) return false;
  if (value.storagePath !== `sample_materials/${subject}/${value.id}.pdf`) return false;
  try { const url = new URL(value.pdfUrl); return url.protocol === 'https:' && url.hostname === 'firebasestorage.googleapis.com' && url.pathname === `/v0/b/${BUCKET}/o/${encodeURIComponent(value.storagePath)}` && url.searchParams.get('alt') === 'media' && !!url.searchParams.get('token'); } catch { return false; }
}
function validateTeaching(body) {
  if (typeof body.message !== 'string' || !body.message.trim() || body.message.length > 1000 || !Number.isInteger(body.page) || body.page < 1 || body.page > 30) throw new SampleError(400, 'invalid_question', 'Ask a short question about this worksheet page.');
  if (typeof body.image !== 'string' || body.image.length > 1800000 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(body.image)) throw new SampleError(400, 'invalid_page', 'The worksheet page could not be read. Please try again.');
  if (body.working != null && (typeof body.working !== 'string' || body.working.length > 2000)) throw new SampleError(400, 'invalid_working', 'Shorten your working and try again.');
  if (body.history != null && (!Array.isArray(body.history) || body.history.length > 6 || body.history.some(item => !item || !['student', 'buddy'].includes(item.role) || typeof item.text !== 'string' || item.text.length > 2000))) throw new SampleError(400, 'invalid_history', 'Refresh the sample lesson to continue.');
}
function validateSdp(sdp) { if (typeof sdp !== 'string' || Buffer.byteLength(sdp) > 64000 || !/^v=0\r?\n/.test(sdp) || !/\r?\nm=audio /.test(sdp)) throw new SampleError(400, 'invalid_audio', 'The microphone connection could not be prepared.'); }
function createSampleRepository(db) {
  const config = db.collection('schedule_config').doc('main'), sessions = db.collection('sampleMaterialsSessions'), limits = db.collection('sampleMaterialsLimits');
  async function selected(subject) { const snap = await config.get(); return snap.data()?.sampleMaterials?.[subject]?.worksheet; }
  async function open(subject, ip, now, worksheetId = '') {
    const token = randomBytes(32).toString('hex'), id = hash(token), day = new Date(now + 8 * 3600000).toISOString().slice(0, 10);
    const owner = limits.doc(hash(ip || 'unknown') + '_' + day), global = limits.doc('_global_' + day);
    await db.runTransaction(async tx => { const [ownerSnap, globalSnap] = await Promise.all([tx.get(owner), tx.get(global)]); const count = ownerSnap.data()?.starts || 0, total = globalSnap.data()?.starts || 0;
      if (count >= IP_LIMIT || total >= DAILY_LIMIT) throw new SampleError(429, 'trial_limit', 'The sample suite is busy. Please try again later.');
      tx.set(owner, { starts: count + 1, expiresAt: now + 2 * 86400000 }); tx.set(global, { starts: total + 1, expiresAt: now + 2 * 86400000 });
      tx.set(sessions.doc(id), { subject, worksheetId, createdAt: now, expiresAt: now + GUEST_SECONDS * 1000, questions: 0, liveStarts: 0 });
    }); return { token, expiresAt: now + GUEST_SECONDS * 1000 };
  }
  async function use(token, subject, now, action) {
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw new SampleError(401, 'trial_required', 'Open this sample again to start a lesson.');
    const ref = sessions.doc(hash(token));
    return db.runTransaction(async tx => { const snap = await tx.get(ref), data = snap.data();
      if (!data || data.subject !== subject || data.expiresAt <= now) throw new SampleError(401, 'trial_expired', 'Your sample session has ended. Open the sample again to continue.');
      if (action === 'start') { if (data.liveStarts >= 1) throw new SampleError(429, 'voice_trial_used', 'Your voice trial has ended. You can continue with the text tutor.'); tx.update(ref, { liveStarts: data.liveStarts + 1, liveExpiresAt: now + TRIAL_SECONDS * 1000, pending: true }); }
      else if (['ask', 'check'].includes(action)) { if (data.questions >= QUESTION_LIMIT) throw new SampleError(429, 'question_trial_used', 'You have finished this sample lesson. Contact us to try a full lesson.'); tx.update(ref, { questions: data.questions + 1 }); }
      return { ...data, id: ref.id, liveExpiresAt: action === 'start' ? now + TRIAL_SECONDS * 1000 : data.liveExpiresAt };
    });
  }
  async function activate(guest, sessionId) { await sessions.doc(guest.id).update({ sessionId, pending: false }); }
  async function recover(guest, sessionId) { await sessions.doc(guest.id).set({ subject: guest.subject, sessionId, pending: false, liveExpiresAt: guest.liveExpiresAt }, { merge: true }); }
  async function release(guest) { await sessions.doc(guest.id).update({ sessionId: null, pending: false, liveStarts: Math.max(0, guest.liveStarts || 0), liveExpiresAt: require('firebase-admin/firestore').FieldValue.delete() }); }
  async function find(token, subject) { if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return null; const snap = await sessions.doc(hash(token)).get(); return snap.exists && snap.data().subject === subject ? { ...snap.data(), id: snap.id } : null; }
  async function clear(guest) { await sessions.doc(guest.id).update({ sessionId: null, pending: false, liveExpiresAt: require('firebase-admin/firestore').FieldValue.delete() }); }
  async function expired(now) { const snap = await sessions.where('liveExpiresAt', '<=', now).limit(50).get(); return snap.docs.map(doc => ({ ...doc.data(), id: doc.id })); }
  async function publish(subject, worksheet) { await config.set({ sampleMaterials: { [subject]: { worksheet } } }, { mergeFields: [`sampleMaterials.${subject}.worksheet`] }); }
  return { selected, open, use, activate, recover, release, find, clear, expired, publish };
}
function createSampleService({ auth, repository, liveProvider, teachProvider, questionService, bucket, now = Date.now, report = () => {} }) {
  async function close(guest) { if (guest.sessionId) await liveProvider.close(guest.sessionId); await repository.clear(guest); }
  async function publicAction(body, req) {
    const subject = subjectOf(body);
    if (body.action === 'initialize' || (body.action === 'questions' && !body.token)) {
      const worksheet = body.action === 'initialize' ? await repository.selected(subject) : null;
      if (body.action === 'initialize' && !validWorksheet(worksheet, subject)) throw new SampleError(404, 'worksheet_not_published', 'A sample worksheet will be available here soon.');
      const guest = await repository.open(subject, req.ip, now(), worksheet?.id || '');
      if (body.action === 'questions') return { ...await questionService.public(body), ...guest };
      return { ...guest, worksheet: { id: worksheet.id, title: worksheet.title, pdfUrl: worksheet.pdfUrl, level: normalizeLevel(worksheet.level) || '' } };
    }
    // Stopping a paid call is possible even after the guest token expires.
    if (body.action === 'stop') { const guest = await repository.find(body.token, subject); if (guest?.sessionId && guest.sessionId === body.sessionId) await close(guest); return { stopped: true }; }
    if (!['ask', 'start', 'questions', 'check'].includes(body.action)) throw new SampleError(400, 'invalid_action', 'Choose a valid sample activity.');
    if (body.action === 'ask') validateTeaching(body);
    if (body.action === 'start') validateSdp(body.sdp);
    // Validate publication before spending a guest's limited requests.
    const current = await repository.selected(subject);
    const known = await repository.find(body.token, subject);
    if (['ask', 'start'].includes(body.action) && (!validWorksheet(current, subject) || !known?.worksheetId || known.worksheetId !== current.id)) throw new SampleError(409, 'worksheet_changed', 'This worksheet has changed. Open the sample again.');
    const guest = await repository.use(body.token, subject, now(), body.action);
    if (['questions', 'check'].includes(body.action)) return questionService.public(body);
    if (body.action === 'ask') {
      const text = await teachProvider.fresh({ ceiling: 'method', authority: { level: normalizeLevel(current.level), subject: subject === 'math' ? 'Maths' : 'Science', keyRows: [] } }, { message: body.message, page: body.page, image: body.image, workContext: body.working || '', history: body.history || [], grounding: [] });
      return { text: String(text).slice(0, 2000) };
    }
    let session;
    try { const config = sessionConfig({ worksheetLevel: normalizeLevel(current.level) }); config.instructions += `\nThis is a short public ${subject === 'math' ? 'Maths' : 'Science'} worksheet trial. Do not ask for student identity. Teach only from the delegated worksheet tutor.`;
      session = await liveProvider.create(body.sdp, config); await repository.activate(guest, session.sessionId);
      return { sessionId: session.sessionId, sdp: session.sdp, expiresAt: guest.liveExpiresAt, maxDurationSeconds: TRIAL_SECONDS };
    } catch (error) {
      const sessionId = session?.sessionId || error.sessionId;
      if (sessionId) { try { await repository.recover(guest, sessionId); } catch { report('sample_recovery_failed'); } try { await close({ ...guest, sessionId }); } catch { report('sample_close_retry_needed'); } }
      else { try { await repository.release(guest); } catch { report('sample_release_retry_needed'); } }
      throw error;
    }
  }
  async function adminAction(body, req) {
    const match = /^Bearer ([^\s]+)$/.exec(req.get('authorization') || ''); let user;
    try { if (match) user = await auth.verifyIdToken(match[1], true); } catch { /* Return the same authentication error. */ }
    if (!user || String(user.email || '').toLowerCase() !== ADMIN_EMAIL || user.email_verified !== true || user.firebase?.sign_in_provider !== 'google.com') throw new SampleError(403, 'admin_required', 'Sign in with your administrator Google account to publish sample materials.');
    const subject = subjectOf(body);
    if (['listQuestions', 'publishQuestions'].includes(body.action)) return questionService.admin(body, user);
    if (body.action !== 'uploadWorksheet') throw new SampleError(400, 'invalid_action', 'Choose a valid sample publishing action.');
    if (typeof body.title !== 'string' || !body.title.trim() || body.title.length > 160 || typeof body.pdfBase64 !== 'string' || body.pdfBase64.length > Math.ceil(MAX_PDF_BYTES / 3) * 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(body.pdfBase64)) throw new SampleError(400, 'invalid_pdf', 'Choose a PDF up to 10 MB and give it a short title.');
    const bytes = Buffer.from(body.pdfBase64, 'base64'); if (bytes.length > MAX_PDF_BYTES || bytes.length < 8 || bytes.subarray(0, 5).toString('ascii') !== '%PDF-') throw new SampleError(400, 'invalid_pdf', 'Choose a valid PDF up to 10 MB.');
    const id = randomUUID(), storagePath = `sample_materials/${subject}/${id}.pdf`, downloadToken = randomUUID(), file = bucket.file(storagePath);
    await file.save(bytes, { resumable: false, metadata: { contentType: 'application/pdf', cacheControl: 'public,max-age=3600', metadata: { firebaseStorageDownloadTokens: downloadToken } } });
    const worksheet = { id, title: body.title.trim(), level: normalizeLevel(body.level) || '', storagePath, pdfUrl: `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(storagePath)}?alt=media&token=${downloadToken}`, updatedAt: now() };
    try { await repository.publish(subject, worksheet); } catch (error) { try { await file.delete(); } catch { report('sample_upload_cleanup_failed'); } throw error; }
    return { worksheet };
  }
  function wrapper(action, admin = false) { return async (req, res) => {
    res.set('Cache-Control', 'no-store'); res.set('Vary', 'Origin'); const origin = req.get('origin');
    if (!allowedOrigin(origin)) return res.status(403).json({ error: { code: 'origin_not_allowed', message: 'Open sample materials from Polymath Learning Centre.' } });
    res.set('Access-Control-Allow-Origin', origin); res.set('Access-Control-Allow-Methods', 'POST, OPTIONS'); res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'POST') return res.status(405).json({ error: { code: 'method_not_allowed', message: 'Use POST for sample materials.' } });
    try {
      let body = req.body;
      const simpleCleanup = !admin && /^text\/plain(?:;|$)/i.test(req.get('content-type') || '');
      if (simpleCleanup) { if (req.rawBody?.length > 2048 || typeof body !== 'string') throw new SampleError(400, 'invalid_request', 'Send a valid cleanup request.'); try { body = JSON.parse(body); } catch { throw new SampleError(400, 'invalid_request', 'Send a valid cleanup request.'); } if (body?.action !== 'stop') throw new SampleError(400, 'invalid_request', 'Use JSON for sample activities.'); }
      if ((!simpleCleanup && !/^application\/json(?:;|$)/i.test(req.get('content-type') || '')) || !body || typeof body !== 'object' || Array.isArray(body)) throw new SampleError(400, 'invalid_request', 'Send a valid sample request.');
      if (req.rawBody?.length > (admin ? 15 * 1024 * 1024 : body.action === 'check' && body.subject === 'science' ? 8 * 1024 * 1024 : 2 * 1024 * 1024)) throw new SampleError(413, 'request_too_large', 'This sample request is too large.');
      return res.status(200).json(await action(body, req));
    } catch (error) { if (error instanceof SampleError || (Number.isInteger(error.status) && error.status >= 400 && error.status < 500 && typeof error.code === 'string')) return res.status(error.status).json({ error: { code: error.code, message: error.message } });
      report(admin ? 'sample_admin_request_failed' : 'sample_request_failed'); return res.status(503).json({ error: { code: 'sample_unavailable', message: 'Sample materials are unavailable just now. Please try again shortly.' } }); }
  }; }
  async function sweep() { const leases = await repository.expired(now()); let failures = 0; for (let i = 0; i < leases.length; i += 5) { const result = await Promise.allSettled(leases.slice(i, i + 5).map(close)); failures += result.filter(item => item.status === 'rejected').length; } if (failures) throw new Error('Some sample calls could not be closed.'); }
  return { handler: wrapper(publicAction), adminHandler: wrapper(adminAction, true), sweep };
}
module.exports = { BUCKET, MAX_PDF_BYTES, TRIAL_SECONDS, GUEST_SECONDS, QUESTION_LIMIT, IP_LIMIT, DAILY_LIMIT, SampleError, allowedOrigin, subjectOf, validWorksheet, validateTeaching, createSampleRepository, createSampleService };
