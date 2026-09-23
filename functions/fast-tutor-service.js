'use strict';

const { APP_ID, allowedOrigin } = require('./live-service');
const { POLICY, TeachError, hash, validate, revision, normalizePack, needsFresh, explicitQuestion, chosenQuestion, candidates, selectDirect } = require('./fast-tutor-core');

function createTeachService({ auth, appCheck, repository, provider, now = Date.now, report = () => {} }) {
  function checkPages(context, body) {
    for (const item of body.images) {
      if ((context.authority.keyPages || []).includes(item.page)) throw new TeachError(403, 'key_page', 'Choose a question page for your lesson.');
      if (context.authority.pageCount > 0 && item.page > context.authority.pageCount) throw new TeachError(400, 'invalid_page', 'Open a page from this worksheet.');
    }
  }
  async function identify(req) {
    const match = /^Bearer ([^\s]+)$/.exec(req.get('authorization') || '');
    if (!match) throw new TeachError(401, 'sign_in_required', 'Sign in again to use the tutor.');
    let user;
    try { user = await auth.verifyIdToken(match[1], true); }
    catch { throw new TeachError(401, 'sign_in_required', 'Sign in again to use the tutor.'); }
    if (!user.uid || user.firebase?.sign_in_provider !== 'google.com') throw new TeachError(403, 'sign_in_required', 'Use Google sign-in to use the tutor.');
    try {
      const token = req.get('x-firebase-appcheck');
      if (!token || (await appCheck.verifyToken(token)).appId !== APP_ID) throw new Error('Wrong app.');
    } catch { throw new TeachError(403, 'app_check_required', 'Refresh Study Buddy to verify the app.'); }
    return user.uid;
  }
  async function run(uid, body, emit, signal) {
    const context = await repository.resolve(uid, body);
    checkPages(context, body);
    const cached = await repository.read(context, body);
    // The base worksheet is stable while the student writes. Its fingerprint
    // invalidates preparation; current ink is only input to fresh reasoning.
    const imageHash = body.action === 'prepare' ? body.sourceHash || hash(body.image) : body.sourceHash || cached?.imageHash || '';
    const cacheKey = revision(context, body, imageHash);
    const usable = cached?.cacheKey === cacheKey && cached.expiresAt > now() && (body.action === 'prepare' || body.cacheKey === cacheKey);
    const summary = pack => ({ ready: true, cacheKey: pack.cacheKey, questions: pack.questions.map(q => ({ id: q.id, label: q.label })) });
    if (body.action === 'prepare') {
      if (usable) return summary(cached);
      const lease = await repository.reserve(context, body, 'prepare', now());
      try {
        const pack = normalizePack(await provider.prepare(context, body, signal), context.ceiling);
        if (signal.aborted) throw signal.reason || new Error('Cancelled.');
        // A teacher can lower the ceiling while preparation is running.
        const freshContext = await repository.resolve(uid, body);
        if (revision(freshContext, body, imageHash) !== cacheKey) throw new TeachError(409, 'worksheet_changed', 'The teaching settings changed. Please try again.');
        const record = { ...pack, cacheKey, imageHash, createdAt: now(), expiresAt: now() + POLICY.cacheMs };
        await repository.save(context, body, record);
        return summary(record);
      } finally { await repository.release(lease); }
    }
    let selected = null, question = usable ? chosenQuestion(cached, body) : null, route = 'fresh', lease;
    try {
      if (usable && !needsFresh(body)) {
        if (question) {
          selected = selectDirect(question, body, context.ceiling);
          if (selected) route = 'prepared';
          else {
            lease = await repository.reserve(context, body, 'reply', now());
            try {
              const choices = candidates(question, body, context.ceiling);
              const decision = await provider.select(context, body, question, choices, signal);
              if (Number.isFinite(decision.confidence) && decision.confidence >= 0.90 && decision.confidence <= 1) selected = choices.find(x => x.id === decision.responseId) || null;
              if (selected) route = 'selector';
            } catch (error) {
              if (signal.aborted) throw error;
              // Timeout/low confidence in a tiny routing model does not block
              // the lesson. The fresh reasoning path remains available.
              report('teaching_selector_fallback');
            }
          }
        }
      }
      if (selected) {
        // Recheck after an asynchronous selector before emitting anything.
        if (revision(await repository.resolve(uid, body), body, imageHash) !== cacheKey) throw new TeachError(409, 'worksheet_changed', 'The teaching settings changed. Please ask again.');
        emit({ type: 'delta', text: selected.text });
        return { type: 'done', text: selected.text, route, questionId: question.id, responseId: selected.id, cacheKey };
      }
      if (!body.image) throw new TeachError(409, 'fresh_image_required', 'Please send the current worksheet page for this question.');
      if (!lease) lease = await repository.reserve(context, body, 'reply', now());
      const freshContext = await repository.resolve(uid, body);
      checkPages(freshContext, body);
      const text = await provider.fresh(freshContext, body, text => { if (!signal.aborted) emit({ type: 'delta', text }); }, signal);
      if (signal.aborted) throw signal.reason || new Error('Cancelled.');
      const changedQuestion = /\b(next|different|another)\s+(question|one)\b/i.test(body.message);
      const unclearReference = !explicitQuestion(body.message) && /\b(?:this|that)\s+(?:question|one|diagram|part)\b|\b(?:here|there|highlighted|circled|pointing)\b/i.test(body.message);
      const knownQuestion = question && !changedQuestion && !unclearReference ? question.id : '';
      return { type: 'done', text, route: 'fresh', questionId: knownQuestion, cacheKey: usable ? cacheKey : '' };
    } finally { if (lease) await repository.release(lease); }
  }
  async function handler(req, res) {
    const controller = new AbortController();
    res.on?.('close', () => { if (!res.writableFinished) controller.abort(); });
    let streaming = false;
    const emit = event => {
      if (controller.signal.aborted || res.destroyed) return;
      if (!streaming) {
        res.status(200); res.set('Content-Type', 'application/x-ndjson; charset=utf-8');
        res.set('X-Accel-Buffering', 'no'); res.flushHeaders?.(); streaming = true;
      }
      res.write(JSON.stringify(event) + '\n');
      res.flush?.();
    };
    res.set('Cache-Control', 'no-store'); res.set('Vary', 'Origin');
    const origin = req.get('origin');
    if (!allowedOrigin(origin)) return res.status(403).json({ error: { code: 'origin_not_allowed', message: 'Open the tutor from Study Buddy.' } });
    res.set('Access-Control-Allow-Origin', origin); res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Firebase-AppCheck');
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'POST') return res.status(405).json({ error: { code: 'method_not_allowed', message: 'Use POST for teaching requests.' } });
    try {
      if (!/^application\/json(?:;|$)/i.test(req.get('content-type') || '')) throw new TeachError(415, 'invalid_request', 'Send a JSON teaching request.');
      if (req.rawBody?.length > 6000000) throw new TeachError(413, 'invalid_request', 'This teaching request is too large.');
      const body = validate(req.body), uid = await identify(req);
      const result = await run(uid, body, emit, controller.signal);
      if (controller.signal.aborted) return;
      if (body.action === 'prepare') return res.status(200).json(result);
      emit(result); res.end();
    } catch (error) {
      if (controller.signal.aborted || res.destroyed) return;
      const known = error instanceof TeachError;
      if (!known) report('teaching_request_failed');
      const payload = { error: { code: known ? error.code : 'teaching_unavailable', message: known ? error.message : 'The tutor could not check this just now. Please try again.' } };
      if (streaming) { emit({ type: 'error', ...payload }); return res.end(); }
      return res.status(known ? error.status : 503).json(payload);
    }
  }
  return { handler, run };
}
module.exports = { createTeachService };
