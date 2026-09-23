'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createTeachProvider, MODELS, teachingInstructions } = require('../fast-tutor-provider');

const context = { ceiling: 'method', authority: { level: 'P5', subject: 'math', keyRows: [{ q: '1', answer: '4' }] } };
const body = { page: 3, image: 'data:image/jpeg;base64,YWJj', grounding: 'Use bar models.', workContext: 'A handwritten attempt.', message: 'Check my work', history: [] };
const completed = text => ({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(text) }] }] });
function sse(events, split = 17) {
  const bytes = new TextEncoder().encode(events.map(event => 'data: ' + JSON.stringify(event) + '\n\n').join(''));
  return new Response(new ReadableStream({ start(controller) {
    for (let i = 0; i < bytes.length; i += split) controller.enqueue(bytes.slice(i, i + split));
    controller.close();
  } }), { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}
test('preparation fixes Astra medium reasoning and a strict bounded schema without storing provider data', async () => {
  let sent;
  const provider = createTeachProvider({ apiKey: () => 'private', fetchImpl: async (url, req) => {
    assert.equal(url, 'https://api.openai.com/v1/responses'); assert.equal(req.headers.Authorization, 'Bearer private');
    sent = JSON.parse(req.body); return Response.json(completed({ questions: [] }));
  } });
  assert.deepEqual(await provider.prepare(context, body), { questions: [] });
  assert.equal(sent.model, MODELS.prepare); assert.equal(sent.reasoning.effort, 'medium'); assert.equal(sent.store, false);
  assert.equal(sent.text.format.strict, true); assert.equal(sent.text.format.schema.properties.questions.maxItems, 8);
  assert.equal(sent.input[0].content[1].image_url, body.image);
  assert.match(sent.instructions, /NEVER calculate/); assert.match(sent.instructions, /task data/);
});
test('selector fixes Luna none reasoning, bounds available response IDs, and receives no student image or key', async () => {
  let sent;
  const provider = createTeachProvider({ apiKey: () => 'private', fetchImpl: async (url, req) => {
    sent = JSON.parse(req.body); return Response.json(completed({ responseId: 'opaque-id', confidence: .95 }));
  } });
  const result = await provider.select(context, body, { label: '1', summary: 'Equal groups' }, [{ id: 'opaque-id', text: 'Look at the groups.', when: 'Needs nudge', level: 'nudge' }]);
  assert.equal(result.responseId, 'opaque-id'); assert.equal(sent.model, MODELS.select); assert.equal(sent.reasoning.effort, 'none');
  assert.deepEqual(sent.text.format.schema.properties.responseId.enum, ['FRESH', 'opaque-id']);
  assert.equal(JSON.stringify(sent.input).includes('image_url'), false); assert.equal(JSON.stringify(sent.input).includes('serverAnswerKey'), false);
});
test('fresh teaching forwards deltas while the stream is arriving and requires completed status', async () => {
  let sent; const deltas = [];
  const provider = createTeachProvider({ apiKey: () => 'private', fetchImpl: async (url, req) => {
    sent = JSON.parse(req.body);
    return sse([{ type: 'response.output_text.delta', delta: '[[point p3 100,200 underline]] ' }, { type: 'response.output_text.delta', delta: '看看 these groups.' }, { type: 'response.completed', response: { status: 'completed' } }], 3);
  } });
  const result = await provider.fresh(context, body, text => deltas.push(text));
  assert.deepEqual(deltas, ['[[point p3 100,200 underline]] ', '[[point p3 100,200 underline]] 看看 these groups.']);
  assert.equal(result, deltas[1]); assert.equal(sent.stream, true); assert.equal(sent.reasoning.effort, 'low'); assert.equal(sent.store, false);
});
test('upstream truncation, refusal and failure cannot masquerade as a completed answer', async () => {
  for (const ending of [null, { type: 'response.incomplete' }, { type: 'response.failed', response: { error: 'PRIVATE' } }, { type: 'response.refusal.delta', delta: 'No' }]) {
    const provider = createTeachProvider({ apiKey: () => 'private', fetchImpl: async () => sse([{ type: 'response.output_text.delta', delta: 'Partial' }, ...(ending ? [ending] : [])]) });
    await assert.rejects(provider.fresh(context, body, () => {}), /stream|response/);
  }
});
test('request abort signals are forwarded and upstream error bodies never leak', async () => {
  const controller = new AbortController(); let linked;
  const provider = createTeachProvider({ apiKey: () => 'private', fetchImpl: async (url, req) => {
    linked = req.signal; controller.abort(); assert.equal(linked.aborted, true);
    return new Response('SECRET upstream payload', { status: 401 });
  } });
  await assert.rejects(provider.fresh(context, body, () => {}, controller.signal), error => error.code === 'teaching_unavailable' && !error.message.includes('SECRET'));
  assert.equal(linked.aborted, true);
});
test('teacher ceiling is repeated in every provider path and structured response refuses incomplete output', async () => {
  assert.match(teachingInstructions({ ...context, ceiling: 'nudge' }), /NO named method/);
  const provider = createTeachProvider({ apiKey: () => 'private', fetchImpl: async () => Response.json({ status: 'incomplete', output: [] }) });
  await assert.rejects(provider.prepare(context, body), /Incomplete/);
  const unconfigured = createTeachProvider({ apiKey: () => '', fetchImpl: async () => { throw new Error('must not call'); } });
  await assert.rejects(unconfigured.prepare(context, body), error => error.code === 'teaching_not_configured');
});
test('fresh reasoning labels both attached pages correctly without duplicating the first image', async () => {
  let sent;
  const provider = createTeachProvider({ apiKey: () => 'private', fetchImpl: async (url, req) => {
    sent = JSON.parse(req.body); return sse([{ type: 'response.output_text.delta', delta: 'Compare the two diagrams.' }, { type: 'response.completed', response: { status: 'completed' } }]);
  } });
  const images = [{ page: 3, image: body.image }, { page: 4, image: 'data:image/jpeg;base64,cGFnZTQ=' }];
  await provider.fresh(context, { ...body, images }, () => {});
  const content = sent.input[0].content;
  assert.equal(content.filter(x => x.type === 'input_image').length, 2);
  assert.equal(content.some(x => x.text === 'Current worksheet page 4:'), true);
  assert.deepEqual(JSON.parse(content[0].text).attachedPages, [3, 4]);
});
