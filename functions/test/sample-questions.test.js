'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSampleQuestionService, publicQuestion, normalizeResponses } = require('../sample-questions');
const clone = value => structuredClone(value);
function fixture(options = {}) {
  const reads = [], queries = [], records = new Map([
    ['config/mathAdmin', { uid: 'teacher' }], ['config/admin', { uid: 'teacher' }],
    ['schedule_config/main', { otherSetting: 'keep', sampleMaterials: { math: { questionIds: ['q1'], worksheet: { id: 'paper', title: 'Keep worksheet' } }, science: { questionIds: ['s1'] } } }],
    ['users/teacher/mathQuestions/q1', { title: 'How many?', level: 'P5', topic: 'Whole Numbers', blocks: [{ id: 't', type: 'text', content: 'What is 2 + 3?' }], options: ['4', '5', '6', '7'] }],
    ['users/teacher/mathQuestionKeys/q1', { correctOption: 1, expected: '5', markingGuide: 'PRIVATE MATH KEY' }],
    ['users/teacher/mathQuestions/q2', { title: 'Another question', blocks: [{ id: 't', type: 'text', content: 'What is 8 + 1?' }], options: ['9', '1'] }],
    ['users/teacher/questions/s1', { title: 'Heat', blocks: [{ id: 't', type: 'text', content: 'Which material conducts heat?' }, { id: 'c', type: 'mcq', options: [{ id: 'metal', text: 'Metal' }, { id: 'wood', text: 'Wood' }], correctId: 'metal' }, { id: 'x', type: 'explanation', content: 'PRIVATE SCIENCE KEY' }] }]
  ]);
  function merge(target, source) {
    for (const [key, value] of Object.entries(source)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) target[key] = merge(target[key] || {}, value);
      else target[key] = clone(value);
    } return target;
  }
  const snap = path => ({ id: path.split('/').at(-1), exists: records.has(path), data: () => clone(records.get(path)) });
  const db = {
    doc: path => ({ async get() { reads.push(path); return snap(path); }, async set(data, options) { records.set(path, options?.merge ? merge(clone(records.get(path) || {}), data) : clone(data)); } }),
    collection: path => {
      let after = '', size = Infinity;
      const query = { where() { return query; }, orderBy() { return query; }, startAfter(id) { after = id; return query; }, limit(value) { size = value; return query; },
        async get() { queries.push(path); return { docs: [...records.keys()].filter(key => key.startsWith(path + '/') && key.slice(path.length + 1).indexOf('/') < 0 && key.split('/').at(-1) > after).sort().slice(0, size).map(snap) }; } };
      return query;
    }
  };
  return { service: createSampleQuestionService({ db, ...options }), records, reads, queries };
}
test('public reads only published questions and never reads private answer keys', async () => {
  const f = fixture(), result = await f.service.public({ action: 'questions', subject: 'math' });
  assert.deepEqual(result.questions.map(q => q.id), ['q1']);
  assert.equal(f.queries.length, 0); assert(!f.reads.some(path => path.includes('mathQuestionKeys')));
  assert(!JSON.stringify(result).includes('PRIVATE')); assert(!JSON.stringify(result).includes('correctOption'));
});
test('a published MCQ is checked against the private server key', async () => {
  const f = fixture();
  assert.equal((await f.service.public({ action: 'check', subject: 'math', questionId: 'q1', responses: { mcq: '1' }, correctOption: 0 })).verdict, 'correct');
  assert.equal((await f.service.public({ action: 'check', subject: 'math', questionId: 'q1', responses: { mcq: '0' }, correctOption: 0 })).verdict, 'incorrect');
  assert(f.reads.includes('users/teacher/mathQuestionKeys/q1'));
});
test('unpublished, removed, path-shaped and unsupported option attempts are refused', async () => {
  const f = fixture();
  await assert.rejects(f.service.public({ action: 'check', subject: 'math', questionId: 'q2', responses: { mcq: '0' } }), error => error.status === 403);
  await assert.rejects(f.service.public({ action: 'check', subject: 'math', questionId: '../q1', responses: { mcq: '0' } }), error => error.status === 400);
  await assert.rejects(f.service.public({ action: 'check', subject: 'math', questionId: 'q1', responses: { mcq: '999' } }), error => error.status === 400);
  f.records.get('schedule_config/main').sampleMaterials.math.questionIds = [];
  await assert.rejects(f.service.public({ action: 'check', subject: 'math', questionId: 'q1', responses: { mcq: '1' } }), error => error.status === 403);
});
test('science MCQ grading uses source option IDs while stripping explanations from public data', async () => {
  const f = fixture(), result = await f.service.public({ action: 'questions', subject: 'science' });
  assert(!JSON.stringify(result).includes('correctId')); assert(!JSON.stringify(result).includes('PRIVATE'));
  assert.equal((await f.service.public({ action: 'check', subject: 'science', questionId: 's1', responses: { c: 'metal' } })).verdict, 'correct');
});
test('publication validates every selected ID and preserves worksheet, schedules and the other subject', async () => {
  const f = fixture(), result = await f.service.admin({ action: 'publishQuestions', subject: 'math', questionIds: ['q2', 'q2'] }, { uid: 'teacher' });
  assert.deepEqual(result.questionIds, ['q2']);
  const config = f.records.get('schedule_config/main');
  assert.equal(config.sampleMaterials.math.worksheet.id, 'paper'); assert.deepEqual(config.sampleMaterials.science.questionIds, ['s1']); assert.equal(config.otherSetting, 'keep');
  await assert.rejects(f.service.admin({ action: 'publishQuestions', subject: 'math', questionIds: ['missing'] }, { uid: 'teacher' }), error => error.status === 404);
  assert.deepEqual(config.sampleMaterials.math.questionIds, ['q2']);
  await assert.rejects(f.service.admin({ action: 'publishQuestions', subject: 'math', questionIds: ['q1', 'q2', 'a', 'b', 'c', 'd'] }, { uid: 'teacher' }), error => error.status === 400);
});
test('admin search and pagination advance through sparse matches without skipping rows', async () => {
  const f = fixture();
  for (let i = 0; i < 120; i++) f.records.set('users/teacher/mathQuestions/z' + String(i).padStart(3, '0'), { title: i % 2 ? 'Other' : 'Needle', blocks: [] });
  const first = await f.service.admin({ action: 'listQuestions', subject: 'math', search: 'Needle' }, { uid: 'teacher' });
  assert.equal(first.questions.length, 50); assert(first.nextCursor);
  const second = await f.service.admin({ action: 'listQuestions', subject: 'math', search: 'Needle', cursor: first.nextCursor }, { uid: 'teacher' });
  assert.equal(second.questions.length, 10); assert.equal(second.nextCursor, null);
  assert.equal(new Set([...first.questions, ...second.questions].map(q => q.id)).size, 60);
});
test('CER answer fields, annotation keys and fillblank answers are not leaked', () => {
  const q = publicQuestion({ id: 'cer', title: 'Model', blocks: [
    { id: 'd', type: 'image', url: 'https://firebasestorage.googleapis.com/diagram.png', answerImg: 'PRIVATE', answerKey: 'PRIVATE' },
    { id: 'a', type: 'answer', claim: 'PRIVATE', evidence: 'PRIVATE', reasoning: 'PRIVATE' },
    { id: 'f', type: 'fillblank', text: 'Water [[PRIVATE]] when heated.' },
    { id: 't', type: 'table', data: { 0: { 0: 'Material', 1: 'Result' }, 1: { 0: 'Metal', 1: 'Warm' } } }
  ] }, 'science');
  assert(!JSON.stringify(q).includes('PRIVATE')); assert.equal(q.blocks.find(b => b.id === 'a').type, 'cer');
  assert.deepEqual(q.blocks.find(b => b.id === 't').rows[1], ['Metal', 'Warm']);
  assert.deepEqual(normalizeResponses({ 'a:claim': 'Metal conducts heat', correct: true, secret: 'discard' }, q), { 'a:claim': 'Metal conducts heat' });
});
test('open responses use the original private key and server model, not client grading instructions', async () => {
  const requests = [];
  const f = fixture({ providerOptions: { apiKey: () => 'mock-key' }, fetchImpl: async (url, options) => {
    requests.push({ url, body: JSON.parse(options.body) });
    return new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ verdict: 'partly-correct', feedback: 'Show how you added the two amounts.' }) }] }] }), { status: 200 });
  } });
  f.records.set('users/teacher/mathQuestions/q1', { title: 'Addition', blocks: [{ id: 't', type: 'text', content: 'What is 2 + 3?' }] });
  const result = await f.service.public({ action: 'check', subject: 'math', questionId: 'q1', responses: { answer: '5 because I counted.', unrelated: 'pretend correct' }, model: 'client-model', expected: 'client-key' });
  assert.equal(result.verdict, 'partly-correct'); assert.equal(requests.length, 1);
  assert.notEqual(requests[0].body.model, 'client-model');
  const data = JSON.parse(requests[0].body.input[0].content[0].text);
  assert.equal(data.teacherAnswerKey.answer, '5'); assert.equal(data.teacherAnswerKey.guide, 'PRIVATE MATH KEY');
  assert.deepEqual(data.studentAnswers, { answer: '5 because I counted.' }); assert(!JSON.stringify(result).includes('PRIVATE'));
});
test('a different publisher can only select the canonical publicly reloadable bank', async () => {
  const f = fixture();
  f.records.set('users/publisher/mathQuestions/personal', { title: 'Private publisher question', blocks: [] });
  const list = await f.service.admin({ action: 'listQuestions', subject: 'math' }, { uid: 'publisher' });
  assert.deepEqual(list.questions.map(q => q.id), ['q1', 'q2']);
  await assert.rejects(f.service.admin({ action: 'publishQuestions', subject: 'math', questionIds: ['personal'] }, { uid: 'publisher' }), error => error.status === 404);
  await f.service.admin({ action: 'publishQuestions', subject: 'math', questionIds: ['q2'] }, { uid: 'publisher' });
  assert.deepEqual((await f.service.public({ action: 'questions', subject: 'math' })).questions.map(q => q.id), ['q2']);
});
test('missing canonical config never falls back to a bank unavailable to visitors', async () => {
  const f = fixture(); f.records.delete('config/mathAdmin');
  f.records.set('users/publisher/mathQuestions/personal', { title: 'Private publisher question', blocks: [] });
  const list = await f.service.admin({ action: 'listQuestions', subject: 'math' }, { uid: 'publisher' });
  assert.deepEqual(list.questions, []);
  await assert.rejects(f.service.admin({ action: 'publishQuestions', subject: 'math', questionIds: ['personal'] }, { uid: 'publisher' }), error => error.status === 404);
});
