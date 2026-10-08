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
test('science MCQ grading uses source option IDs and releases teacher review only after checking', async () => {
  const f = fixture(), result = await f.service.public({ action: 'questions', subject: 'science' });
  assert(!JSON.stringify(result).includes('correctId')); assert(!JSON.stringify(result).includes('PRIVATE'));
  const checked = await f.service.public({ action: 'check', subject: 'science', questionId: 's1', responses: { c: 'metal' } });
  assert.equal(checked.verdict, 'correct'); assert.equal(checked.review.explanation, 'PRIVATE SCIENCE KEY');
  assert.equal(checked.review.mcq[0].correctId, 'metal');
  assert.deepEqual(checked.review.mcq[0].options, [{ id: 'wood', why: '' }]);
  assert.match(checked.review.reasonError, /could not load/);
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

function aiResponse(value) {
  return new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(value) }] }] }), { status: 200 });
}
test('checked science reviews restore authored model answers, diagrams and sandbox app source without leaking on load', async () => {
  const requests = [];
  const f = fixture({ providerOptions: { apiKey: () => 'mock' }, fetchImpl: async (url, options) => {
    requests.push(JSON.parse(options.body)); return aiResponse({ verdict: 'correct', feedback: 'You linked the evidence to the concept.' });
  } });
  f.records.set('users/teacher/questions/s1', { title: 'Respiration', answerKeyImage: 'https://firebasestorage.googleapis.com/whole-answer.png', blocks: [
    { id: 't', type: 'text', content: 'Explain the result.' },
    { id: 'a', type: 'answer', claim: 'CLAIM KEY', evidence: 'EVIDENCE KEY', reasoning: 'REASONING KEY' },
    { id: 'x', type: 'explanation', content: '<p>EXPLANATION KEY</p>', url: 'https://firebasestorage.googleapis.com/explanation.png', scale: 0.5 },
    { id: 'k', type: 'answerKey', content: 'EXTRA KEY', url: 'https://firebasestorage.googleapis.com/part-answer.png' },
    { id: 'w', type: 'widget', title: 'Explore respiration', html: '<button onclick="this.textContent=2">APP KEY</button>', height: 700 }
  ] });
  const initial = await f.service.public({ action: 'questions', subject: 'science' });
  assert(!JSON.stringify(initial).includes('KEY')); assert.equal(requests.length, 0);
  await assert.rejects(f.service.public({ action: 'check', subject: 'science', questionId: 's1', responses: {} }), error => error.code === 'answer_required');
  assert.equal(requests.length, 0);
  const checked = await f.service.public({ action: 'check', subject: 'science', questionId: 's1', responses: { 'a:claim': 'A claim' } });
  assert.equal(requests.length, 1);
  assert.match(checked.review.modelAnswer, /Claim: CLAIM KEY\nEvidence: EVIDENCE KEY\nReasoning: REASONING KEY/);
  assert.equal(checked.review.explanation, 'EXPLANATION KEY');
  assert.deepEqual(checked.review.answerDiagrams.map(item => item.url), ['https://firebasestorage.googleapis.com/whole-answer.png', 'https://firebasestorage.googleapis.com/part-answer.png']);
  assert.equal(checked.review.explanationDiagrams[0].scale, 0.5);
  assert.deepEqual(checked.review.widgets[0], { id: 'w', title: 'Explore respiration', html: '<button onclick="this.textContent=2">APP KEY</button>', height: 700 });
});

test('one diagram-grounded reason call maps reordered IDs exactly and caches only the unchanged question', async () => {
  const requests = [];
  const f = fixture({ providerOptions: { apiKey: () => 'mock' }, fetchImpl: async (url, options) => {
    const body = JSON.parse(options.body); requests.push(body);
    return aiResponse({ explanation: 'The grasshopper uses oxygen and releases carbon dioxide during respiration. Removing carbon dioxide means the ink movement measures only oxygen taken in.', reasons: [{ blockId: 'c', optionId: 'water', why: 'Water vapour is not the carbon dioxide released during respiration.' }, { blockId: 'c', optionId: 'oxygen', why: 'Oxygen is taken in by the grasshopper, so the absorber must remove another gas.' }] });
  } });
  const question = { title: 'Grasshopper', blocks: [
    { id: 't', type: 'text', content: 'Substance M absorbs a certain gas. What is this gas?' },
    { id: 'd', type: 'image', url: 'data:image/png;base64,AAAA' },
    { id: 'c', type: 'mcq', correctId: 'carbon', options: [{ id: 'oxygen', text: 'oxygen' }, { id: 'carbon', text: 'carbon dioxide' }, { id: 'water', text: 'water vapour' }] }
  ] };
  f.records.set('users/teacher/questions/s1', question);
  const check = () => f.service.public({ action: 'check', subject: 'science', questionId: 's1', responses: { c: 'oxygen' } });
  const first = await check();
  assert.equal(first.verdict, 'incorrect'); assert.equal(requests.length, 1);
  assert.equal(requests[0].input[0].content[1].type, 'input_image');
  assert.match(first.review.mcq[0].options[0].why, /^Oxygen/);
  assert.match(first.review.mcq[0].options[1].why, /^Water/);
  assert.match(first.review.explanation, /^The grasshopper/);
  assert(!first.review.mcq[0].options.some(option => option.id === 'carbon'));
  await check(); assert.equal(requests.length, 1, 'Repeat checks reuse the same evidence-grounded notes');
  question.blocks[0].content = 'Changed wording';
  await check(); assert.equal(requests.length, 2, 'Edited wording invalidates cached notes');
});

test('unknown reason IDs never attach teaching notes to the wrong option and failed calls can retry', async () => {
  let calls = 0;
  const f = fixture({ providerOptions: { apiKey: () => 'mock' }, fetchImpl: async () => {
    calls++;
    return aiResponse({ reasons: calls === 1 ? [{ blockId: 'c', optionId: 'metal', why: 'Reason for the correct option must not become a wrong reason.' }]
      : [{ blockId: 'c', optionId: 'wood', why: 'Wood is a poor conductor of heat compared with metal.' }] });
  } });
  const first = await f.service.public({ action: 'check', subject: 'science', questionId: 's1', responses: { c: 'wood' } });
  assert.equal(first.verdict, 'incorrect'); assert.match(first.review.reasonError, /retry/);
  assert.equal(first.review.mcq[0].options[0].why, '');
  const second = await f.service.public({ action: 'check', subject: 'science', questionId: 's1', responses: { c: 'wood' } });
  assert.equal(calls, 2); assert.equal(second.review.reasonError, undefined);
  assert.match(second.review.mcq[0].options[0].why, /^Wood/);
});

test('authored reasons avoid another AI request and invalid attempts never unlock reviews', async () => {
  let calls = 0;
  const f = fixture({ providerOptions: { apiKey: () => 'mock' }, fetchImpl: async () => { calls++; throw new Error('Unexpected request'); } });
  f.records.get('users/teacher/questions/s1').blocks[1].options[1].why = 'Wood is a poor conductor of heat.';
  const checked = await f.service.public({ action: 'check', subject: 'science', questionId: 's1', responses: { c: 'wood' } });
  assert.equal(calls, 0); assert.equal(checked.review.mcq[0].options[0].why, 'Wood is a poor conductor of heat.');
  await assert.rejects(f.service.public({ action: 'check', subject: 'science', questionId: 's1', responses: { c: 'invented' } }), error => error.code === 'invalid_choice');
  await assert.rejects(f.service.public({ action: 'check', subject: 'science', questionId: 'unpublished', responses: { c: 'wood' } }), error => error.code === 'question_not_published');
  assert.equal(calls, 0);
});

test('uncertain grading withholds model answers, explanations and apps', async () => {
  const f = fixture({ providerOptions: { apiKey: () => 'mock' }, fetchImpl: async () => aiResponse({ verdict: 'uncertain', feedback: 'More context is needed.' }) });
  f.records.set('users/teacher/questions/s1', { blocks: [{ id: 'a', type: 'plainanswer', content: 'SECRET KEY' }, { id: 'w', type: 'widget', html: 'SECRET APP' }] });
  const result = await f.service.public({ action: 'check', subject: 'science', questionId: 's1', responses: { a: 'My answer' } });
  assert.equal(result.verdict, 'uncertain'); assert.equal(result.review, undefined); assert(!JSON.stringify(result).includes('SECRET'));
});

test('fillblank keeps sentence spacing and CER adjacent blanks, strips keys on load and grades canonical response keys', async () => {
  const requests = [];
  const f = fixture({ providerOptions: { apiKey: () => 'mock' }, fetchImpl: async (url, options) => { requests.push(JSON.parse(options.body)); return aiResponse({ verdict: 'correct', feedback: 'Correct gases.' }); } });
  f.records.set('users/teacher/questions/s1', { blocks: [{ id: 'f', type: 'fillblank', text: 'The grasshopper releases [[carbon]] [[dioxide]], and uses [[oxygen]].' }] });
  const initial = (await f.service.public({ action: 'questions', subject: 'science' })).questions[0];
  const fill = initial.blocks[0]; assert.equal(fill.type, 'fillblank');
  assert.deepEqual(fill.segments, [{ type: 'text', text: 'The grasshopper releases ' }, { type: 'blank' }, { type: 'text', text: ', and uses ' }, { type: 'blank' }, { type: 'text', text: '.' }]);
  assert(!JSON.stringify(initial).includes('carbon')); assert(!JSON.stringify(initial).includes('oxygen'));
  const result = await f.service.public({ action: 'check', subject: 'science', questionId: 's1', responses: { 'f:blank:0': 'carbon dioxide', 'f:blank:1': 'oxygen', 'f:blank:999': 'discard' } });
  const sent = JSON.parse(requests[0].input[0].content[0].text);
  assert.deepEqual(sent.studentAnswers, { 'f:blank:0': 'carbon dioxide', 'f:blank:1': 'oxygen' });
  assert.deepEqual(sent.teacherAnswerKey[0].blanks, ['carbon dioxide', 'oxygen']);
  assert.equal(result.review.modelAnswer, 'The grasshopper releases carbon dioxide, and uses oxygen.');
});

test('automatic science option labels follow native secondary topics, published custom topics and teacher override', async () => {
  const f = fixture(), q = f.records.get('users/teacher/questions/s1');
  q.topic = 'Atoms and Molecules';
  assert.equal((await f.service.public({ action: 'questions', subject: 'science' })).questions[0].labelStyle, 'letters');
  f.records.set('users/teacher/settings/topics', { custom: { 'Atoms and Molecules': 'P5', 'Custom lab work': 'S1' } });
  assert.equal((await f.service.public({ action: 'questions', subject: 'science' })).questions[0].labelStyle, 'numbers');
  q.topic2 = 'Custom lab work';
  assert.equal((await f.service.public({ action: 'questions', subject: 'science' })).questions[0].labelStyle, 'letters');
  q.mcqLabels = 'numbers';
  assert.equal((await f.service.public({ action: 'questions', subject: 'science' })).questions[0].labelStyle, 'numbers');
});

test('duplicate exact reason IDs fail without placing one reason on another option', async () => {
  const f = fixture({ providerOptions: { apiKey: () => 'mock' }, fetchImpl: async () => aiResponse({ reasons: [
    { blockId: 'c', optionId: 'wood', why: 'First reason.' }, { blockId: 'c', optionId: 'wood', why: 'Conflicting duplicate reason.' }
  ] }) });
  const result = await f.service.public({ action: 'check', subject: 'science', questionId: 's1', responses: { c: 'wood' } });
  assert.equal(result.review.mcq[0].options[0].why, ''); assert.match(result.review.reasonError, /retry/);
});

test('missing conceptual explanation is generated even when all wrong reasons are authored; authored and legacy explanation stay intact', async () => {
  const requests = [];
  const f = fixture({ providerOptions: { apiKey: () => 'mock' }, fetchImpl: async (url, options) => { requests.push(JSON.parse(options.body)); return aiResponse({ reasons: [], explanation: 'Metal transfers heat through the material more readily than wood.' }); } });
  const q = f.records.get('users/teacher/questions/s1'); q.blocks = q.blocks.filter(block => block.type !== 'explanation'); q.blocks[1].options[1].why = 'Wood is a poor conductor.';
  const check = () => f.service.public({ action: 'check', subject: 'science', questionId: 's1', responses: { c: 'metal' } });
  assert.match((await check()).review.explanation, /^Metal transfers/); assert.equal(requests.length, 1);
  assert.equal(JSON.parse(requests[0].input[0].content[0].text).needsExplanation, true);
  q.explanation = 'Legacy teacher explanation'; assert.equal((await check()).review.explanation, q.explanation); assert.equal(requests.length, 1);
  q.blocks.push({ type: 'explanation', content: 'Authored block explanation' }); assert.equal((await check()).review.explanation, 'Authored block explanation'); assert.equal(requests.length, 1);
});

test('ordinary working and open line blocks pass their native model content to grading and review', async () => {
  const requests = [];
  const f = fixture({ providerOptions: { apiKey: () => 'mock' }, fetchImpl: async (url, options) => { requests.push(JSON.parse(options.body)); return aiResponse({ verdict: 'correct', feedback: 'Good working.' }); } });
  f.records.set('users/teacher/questions/s1', { blocks: [{ id: 'o', type: 'openLines', content: 'OPEN LINE KEY' }, { id: 'w', type: 'workingSpace', content: 'WORKING KEY' }, { id: 'x', type: 'explanation', content: 'Explanation' }] });
  const result = await f.service.public({ action: 'check', subject: 'science', questionId: 's1', responses: { o: 'My answer', w: 'My working' } });
  const key = JSON.parse(requests[0].input[0].content[0].text).teacherAnswerKey;
  assert.equal(key[0].answer, 'OPEN LINE KEY'); assert.equal(key[1].answer, 'WORKING KEY');
  assert.equal(result.review.modelAnswer, 'OPEN LINE KEY\nWORKING KEY');
});

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6YQAAAAASUVORK5CYII=';
test('authored drawing pads hide keys on load and mark student composites against the correct labeled diagrams and teacher images', async () => {
  const requests = [];
  const f = fixture({ providerOptions: { apiKey: () => 'mock' }, fetchImpl: async (url, options) => { requests.push(JSON.parse(options.body)); return aiResponse({ verdict: 'correct', feedback: 'Your arrow and label are accurate.' }); } });
  f.records.set('users/teacher/questions/s1', { annotation: true, blocks: [
    { id: 'diagram', type: 'image', url: PNG, answerImg: PNG, answerKey: 'Arrow points to the leaf.', caption: 'Diagram 2', scale: 0.5 },
    { id: 'scratch', type: 'workingSpace', annotate: true, answerImg: PNG, answerKey: 'A labeled drawing.', height: 500 },
    { id: 'reference', type: 'image', url: PNG, annotate: false },
    { id: 'x', type: 'explanation', content: 'Light reaches the leaf.' }
  ] });
  const initial = (await f.service.public({ action: 'questions', subject: 'science' })).questions[0];
  assert.equal(initial.blocks[0].annotate, true); assert.equal(initial.blocks[0].caption, 'Diagram 2'); assert.equal(initial.blocks[0].scale, 0.5);
  assert.equal(initial.blocks[1].type, 'annotation'); assert.equal(initial.blocks[2].annotate, undefined);
  assert(!initial.blocks.some(block => block.id === 'answer')); assert(!JSON.stringify(initial).includes('answerImg')); assert(!JSON.stringify(initial).includes('Arrow points'));
  const result = await f.service.public({ action: 'check', subject: 'science', questionId: 's1', responses: { diagram: PNG, scratch: PNG } });
  assert.equal(result.verdict, 'correct'); assert.equal(requests.length, 1, 'Drawing-only answers must reach AI grading');
  const content = requests[0].input[0].content, sent = JSON.parse(content[0].text);
  assert.equal(sent.studentAnswers.diagram, '[Student drawing attached with this block ID]');
  assert.equal(sent.teacherAnswerKey.find(block => block.id === 'diagram').answer, 'Arrow points to the leaf.');
  assert.equal(sent.teacherAnswerKey.find(block => block.id === 'scratch').answer, 'A labeled drawing.');
  for (const id of ['diagram', 'scratch']) {
    const studentIndex = content.findIndex(part => part.text === 'Student drawing to mark, block ID: ' + id);
    assert.equal(content[studentIndex + 1].image_url, PNG);
    const keyIndex = content.findIndex(part => part.text === 'Teacher model answer image for comparison, block ID: ' + id);
    assert.equal(content[keyIndex + 1].image_url, PNG);
  }
  assert.equal(result.review.answerDiagrams[0].url, PNG);
});

test('drawings reject URLs, forged pad IDs, malformed PNGs and oversized dimensions/data before any model call', async () => {
  let calls = 0;
  const f = fixture({ providerOptions: { apiKey: () => 'mock' }, fetchImpl: async () => { calls++; throw new Error('Unexpected call'); } });
  f.records.set('users/teacher/questions/s1', { blocks: [{ id: 'pad', type: 'workingSpace', annotate: true, answerKey: 'A labeled plant.' }] });
  const check = responses => f.service.public({ action: 'check', subject: 'science', questionId: 's1', responses });
  await assert.rejects(check({ pad: 'https://example.test/drawing.png' }), error => error.code === 'invalid_annotation');
  await assert.rejects(check({ pad: 'data:image/png;base64,AAAA' }), error => error.code === 'invalid_annotation');
  await assert.rejects(check({ invented: PNG }), error => error.code === 'invalid_annotation');
  await assert.rejects(check({ pad: 'data:image/png;base64,' + 'A'.repeat(1800000) }), error => error.code === 'invalid_annotation');
  const oversized = Buffer.from(PNG.split(',')[1], 'base64'); oversized.writeUInt32BE(3001, 16);
  await assert.rejects(check({ pad: 'data:image/png;base64,' + oversized.toString('base64') }), error => error.code === 'invalid_annotation');
  await assert.rejects(check({ pad: '' }), error => error.code === 'answer_required');
  assert.equal(calls, 0);
});
