'use strict';

const { createHash, randomUUID } = require('node:crypto');
const VERSION = 'fast-tutor-v1';
const LEVELS = ['nudge', 'concepts', 'method', 'answer'];
const POLICY = Object.freeze({ prepPerDay: 60, paidPerDay: 1200, paidPerMinute: 12, cachedPages: 60, cacheMs: 7 * 86400000, leaseMs: 155000 });
class TeachError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
const hash = value => createHash('sha256').update(String(value)).digest('hex');
const plain = value => value && typeof value === 'object' && !Array.isArray(value);
const clip = (value, max) => typeof value === 'string' ? value.slice(0, max) : '';
const depth = value => { const n = LEVELS.indexOf(value); return n < 0 ? 2 : n; };
function invalid() { throw new TeachError(400, 'invalid_request', 'The teaching request is not valid.'); }
const validImage = value => typeof value === 'string' && value.length <= 1900000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value);
function validate(body) {
  if (!plain(body) || !['prepare', 'reply'].includes(body.action)) invalid();
  if (typeof body.worksheetId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(body.worksheetId)) invalid();
  if (!Number.isInteger(body.page) || body.page < 1 || body.page > 1000) invalid();
  if (body.studentIndex != null && (!Number.isInteger(body.studentIndex) || body.studentIndex < 0 || body.studentIndex > 7)) invalid();
  for (const [key, max] of [['grounding', 48000], ['workContext', 12000], ['message', 3000]]) {
    if (body[key] != null && (typeof body[key] !== 'string' || body[key].length > max)) invalid();
  }
  if (body.action === 'reply' && !body.message?.trim()) invalid();
  if (body.image != null && !validImage(body.image)) invalid();
  if (body.images != null && (!Array.isArray(body.images) || !body.images.length || body.images.length > 2 || body.images.some(x => !plain(x) || !Number.isInteger(x.page) || x.page < 1 || x.page > 1000 || !validImage(x.image)))) invalid();
  if (body.images?.length && (body.action !== 'reply' || body.images[0].page !== body.page || body.images[0].image !== body.image || new Set(body.images.map(x => x.page)).size !== body.images.length)) invalid();
  if (body.action === 'prepare' && !body.image) invalid();
  if (body.sourceHash != null && (typeof body.sourceHash !== 'string' || !/^[a-f0-9]{64}$/.test(body.sourceHash))) invalid();
  if (body.action === 'prepare' && body.sourceHash && body.sourceHash !== hash(body.image)) invalid();
  for (const key of ['cacheKey', 'questionId', 'afterResponseId']) {
    if (body[key] != null && (typeof body[key] !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(body[key]))) invalid();
  }
  if (body.forceFresh != null && typeof body.forceFresh !== 'boolean') invalid();
  if (body.history != null && (!Array.isArray(body.history) || body.history.length > 6 || body.history.some(x => !plain(x) || !['user', 'assistant'].includes(x.role) || typeof x.text !== 'string' || x.text.length > 2000))) invalid();
  return { action: body.action, worksheetId: body.worksheetId, page: body.page, studentIndex: body.studentIndex || 0,
    grounding: body.grounding || '', workContext: body.workContext || '', image: body.image || '', images: body.images || [], message: body.message?.trim() || '',
    sourceHash: body.sourceHash || '', cacheKey: body.cacheKey || '', questionId: body.questionId || '', afterResponseId: body.afterResponseId || '',
    forceFresh: body.forceFresh === true || body.images?.length > 1, history: body.history || [] };
}
function revision(context, body, imageHash) {
  return hash(JSON.stringify({ version: VERSION, uid: context.uid, learner: context.learner, worksheetId: body.worksheetId,
    page: body.page, authority: context.authority, imageHash, grounding: hash(body.grounding) }));
}
function normalizePack(raw, ceiling) {
  if (!plain(raw) || !Array.isArray(raw.questions) || !raw.questions.length || raw.questions.length > 8) throw new Error('Invalid preparation.');
  const questions = raw.questions.map((q, qi) => {
    if (!plain(q) || typeof q.label !== 'string' || !Array.isArray(q.responses)) throw new Error('Invalid preparation.');
    const id = 'q' + (qi + 1);
    const responses = q.responses.filter(r => plain(r) && LEVELS.includes(r.level) && depth(r.level) <= depth(ceiling) && typeof r.text === 'string' && r.text.trim() && r.text.length <= 1600 && ['hint', 'simpler', 'misconception'].includes(r.kind)).slice(0, 12)
      .sort((a, b) => depth(a.level) - depth(b.level))
      // Only a delivered response ID is exposed to the browser. Future rung
      // IDs cannot be guessed to skip through the help ladder.
      .map(r => ({ id: randomUUID(), kind: r.kind, level: r.level, text: r.text.trim(), when: clip(r.when, 400) }));
    if (!responses.some(r => r.kind === 'hint' && r.level === 'nudge')) throw new Error('Preparation has no safe first hint.');
    return { id, label: clip(q.label, 80), summary: clip(q.summary, 600), responses };
  });
  return { questions };
}
const cleanIntent = text => String(text).toLowerCase().replace(/[.!?,'’]/g, '').replace(/\s+/g, ' ').trim();
const SPOKEN_NUMBERS = Object.freeze({ one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20 });
function normalizeQuestionNumber(text) {
  return String(text).replace(/\b(question|number|q)\s+(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\b/gi, (match, prefix, number) => prefix + ' ' + SPOKEN_NUMBERS[number.toLowerCase()]);
}
function explicitQuestion(text) { return /\b(?:question|number|q)\s*(\d+(?:\s*[a-z])?)(?=\b|\s|$)/i.exec(normalizeQuestionNumber(text)); }
function intent(text) {
  const s = cleanIntent(normalizeQuestionNumber(text)).replace(/^(please |can you |could you )/, '').replace(/ please$/, '').replace(/\s+(?:for|on)\s+(?:question|number|q)\s*\d+[a-z]?$/, '');
  if (/^(?:(?:i need |give me )?help(?: me)? with )?(?:question|number|q)\s*\d+[a-z]?$/.test(s)) return 'next';
  if (/^(repeat( that| it)?|say (that|it) again|again)$/.test(s)) return 'repeat';
  if (/^(next( hint| step)?|another hint|give me (a|another|the next) hint|help me( start)?|a hint|hint|how (do i|to) start)$/.test(s)) return 'next';
  if (/^(explain (that|it)( more)? simply|make (that|it) simpler|simpler|i dont understand( that| it)?)$/.test(s)) return 'simpler';
  return '';
}
// Conservatively route all answer/working judgements through fresh visual
// reasoning. The selector can choose explanations, never decide correctness.
function needsFresh(body) {
  return body.forceFresh || /\b(check|correct|wrong|right|answer is|my answer|i got|i wrote|written|handwriting|working|calculated|calculation|instead|another method|different method|is it|did i|am i|look at|can you see|read (it|this|that)|ignore|instructions?|system|prompt|reveal|answer key)\b|[=+×÷]|\d\s*[-*/]\s*\d/i.test(body.message);
}
function chosenQuestion(pack, body) {
  const explicit = explicitQuestion(body.message);
  if (explicit) {
    const label = explicit[1].replace(/\s/g, '').toLowerCase();
    return pack.questions.find(q => q.label.toLowerCase().replace(/^(question|number|q)\s*/i, '').replace(/[^0-9a-z]/g, '') === label) || null;
  }
  return pack.questions.find(q => q.id === body.questionId) || (pack.questions.length === 1 ? pack.questions[0] : null);
}
function candidates(question, body, ceiling) {
  const allowed = question.responses.filter(r => depth(r.level) <= depth(ceiling));
  const previous = allowed.find(r => r.id === body.afterResponseId);
  // A later rung is offered only after a delivered earlier rung. A client
  // cannot raise the server ceiling by inventing a response ID.
  const maximum = previous ? Math.min(depth(ceiling), depth(previous.level) + 1) : 0;
  return allowed.filter(r => depth(r.level) <= maximum);
}
function selectDirect(question, body, ceiling) {
  const kind = intent(body.message), allowed = candidates(question, body, ceiling);
  const previous = allowed.find(r => r.id === body.afterResponseId);
  if (kind === 'repeat') return previous || null;
  if (kind === 'simpler') return previous ? allowed.find(r => r.kind === 'simpler' && r.level === previous.level) || null : null;
  if (kind === 'next') {
    const hints = allowed.filter(r => r.kind === 'hint');
    if (previous && previous.kind !== 'hint') return hints.find(r => depth(r.level) === depth(previous.level)) || null;
    const i = hints.findIndex(r => r.id === previous?.id);
    return hints[i + 1] || null;
  }
  return null;
}
module.exports = { VERSION, LEVELS, POLICY, TeachError, hash, plain, clip, depth, validate, revision, normalizePack, intent, needsFresh, explicitQuestion, chosenQuestion, candidates, selectDirect };
