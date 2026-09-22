'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { MODEL, createGameProvider } = require('../gamification-provider');

const input = { question: 'What is 3 times 7?', answer: '21', subject: 'math', level: 'P4', questionImage: 'data:image/png;base64,YQ==' };
function response(result, status = 'completed') { return { ok: true, async json() { return { status, output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(result) }] }] }; } }; }

test('verification fixes model, disables storage and sends a strict schema with optional image', async () => {
  let request;
  const provider = createGameProvider({ apiKey: () => 'private-token', fetchImpl: async (url, options) => { request = { url, ...options }; return response({ relevant: true, confident: true, correct: true }); } });
  assert.deepEqual(await provider.verify(input), { relevant: true, confident: true, correct: true });
  const body = JSON.parse(request.body);
  assert.equal(request.url, 'https://api.openai.com/v1/responses'); assert.equal(body.model, MODEL); assert.equal(body.store, false);
  assert.equal(body.text.format.strict, true); assert.equal(body.text.format.schema.additionalProperties, false);
  assert.match(body.instructions, /untrusted task data/); assert.match(body.instructions, /Solve the academic question yourself/);
  assert.equal(body.input[0].content[1].image_url, input.questionImage);
  assert.ok(!JSON.stringify(body).includes('private-token'));
});

test('missing key, failed, incomplete or malformed provider outputs fail closed', async () => {
  await assert.rejects(createGameProvider({ apiKey: () => '' }).verify(input), error => error.code === 'game_not_configured');
  for (const upstream of [{ ok: false, status: 429 }, response({ relevant: true, confident: true, correct: true }, 'incomplete'), response({ relevant: 'yes', correct: true, confident: true }), response(null)]) {
    const provider = createGameProvider({ apiKey: () => 'private-token', fetchImpl: async () => upstream });
    await assert.rejects(provider.verify(input));
  }
});

test('a provider refusal never creates a correct or relevant verdict', async () => {
  const provider = createGameProvider({ apiKey: () => 'private-token', fetchImpl: async () => ({ ok: true, async json() { return { status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'No.' }] }] }; } }) });
  assert.deepEqual(await provider.verify(input), { relevant: false, correct: false, confident: false });
});
