'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createAiRouter, MODELS } = require('../ai-router');
const schema = { type: 'object', additionalProperties: false, properties: { answer: { type: 'boolean' } }, required: ['answer'] };
const body = { model: 'old-client-model', reasoning: { effort: 'medium' }, max_output_tokens: 1500, instructions: 'Respect the teacher ceiling.',
  input: [{ role: 'user', content: [{ type: 'input_text', text: 'Check these equal groups.' }, { type: 'input_image', image_url: 'data:image/png;base64,YQ==' }] }],
  text: { format: { type: 'json_schema', strict: true, schema } } };
const credentials = { apiKey: () => 'openai-private', geminiApiKey: () => 'gemini-private', kimiApiKey: () => 'kimi-private' };
const openai = text => Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text }] }] });
const gemini = text => Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text }] } }] });
const kimi = text => Response.json({ choices: [{ finish_reason: 'stop', message: { content: text } }] });
function stream(events) {
  return new Response(events.map(item => 'data: ' + JSON.stringify(item) + '\n\n').join(''), { headers: { 'Content-Type': 'text/event-stream' } });
}
test('text, vision and reasoning use the exact primary model and compatible controls', async () => {
  const seen = [];
  const router = createAiRouter({ ...credentials, fetchImpl: async (url, req) => { seen.push({ url, req, body: JSON.parse(req.body) }); return openai('{"answer":true}'); } });
  assert.deepEqual(await router.run(body), { answer: true }); assert.equal(seen.length, 1);
  assert.equal(seen[0].body.model, 'gpt-6.1-sol'); assert.equal(seen[0].body.reasoning.effort, 'medium');
  assert.equal(seen[0].body.store, false); assert.equal(seen[0].body.input[0].content[1].image_url, body.input[0].content[1].image_url);
  assert.equal(seen[0].body.temperature, undefined); assert.equal(seen[0].body.top_p, undefined);
});
test('a primary quota error falls to Gemini with the same instructions, question, schema and image', async () => {
  const seen = [];
  const router = createAiRouter({ ...credentials, fetchImpl: async (url, req) => {
    seen.push({ url, req, body: JSON.parse(req.body) }); return seen.length === 1 ? new Response('PRIVATE error', { status: 429 }) : gemini('{"answer":false}');
  } });
  assert.deepEqual(await router.run(body), { answer: false }); assert.equal(seen.length, 2);
  assert.match(seen[1].url, /gemini-3\.7-flash:generateContent$/); assert.equal(seen[1].req.headers['x-goog-api-key'], 'gemini-private');
  assert.equal(seen[1].body.systemInstruction.parts[0].text, body.instructions);
  assert.deepEqual(seen[1].body.contents[0].parts[1], { inlineData: { mimeType: 'image/png', data: 'YQ==' } });
  assert.deepEqual(seen[1].body.generationConfig.responseJsonSchema, schema); assert.equal(seen[1].body.generationConfig.thinkingConfig.thinkingLevel, 'medium');
});
test('Gemini failure reaches Kimi without dropping the picture or strict JSON validation', async () => {
  const seen = [];
  const router = createAiRouter({ ...credentials, fetchImpl: async (url, req) => { seen.push({ url, body: JSON.parse(req.body) }); return seen.length < 3 ? new Response('', { status: 503 }) : kimi('{"answer":true}'); } });
  assert.deepEqual(await router.run(body), { answer: true }); assert.equal(seen.length, 3);
  assert.equal(seen[2].body.model, MODELS.kimi); assert.equal(seen[2].body.messages[1].content[1].image_url.url, body.input[0].content[1].image_url);
  assert.equal(seen[2].body.response_format.type, 'json_object'); assert.match(seen[2].body.messages[0].content, /Respect the teacher ceiling/);
  assert.equal(seen[2].body.reasoning_effort, 'high'); assert.equal(seen[2].body.max_completion_tokens, 1500);
  for (const unsupported of ['max_tokens', 'thinking', 'temperature', 'top_p']) assert.equal(seen[2].body[unsupported], undefined);
});
test('missing optional credentials skip only that provider; absent primary can use a backup', async () => {
  const seen = [];
  const router = createAiRouter({ apiKey: () => '', geminiApiKey: () => { throw new Error('unbound secret'); }, kimiApiKey: () => 'private', fetchImpl: async url => { seen.push(url); return kimi('{"answer":false}'); } });
  assert.deepEqual(await router.run(body), { answer: false }); assert.deepEqual(seen, ['https://api.moonshot.ai/v1/chat/completions']);
});
test('malformed and truncated structured results fall through, never becoming a reward verdict', async () => {
  let requests = 0;
  const router = createAiRouter({ ...credentials, fetchImpl: async () => {
    requests++; if (requests === 1) return openai('{"answer":"yes"}');
    if (requests === 2) return Response.json({ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{"answer":true}' }] } }] });
    return kimi('{"answer":false}');
  } });
  assert.deepEqual(await router.run(body), { answer: false }); assert.equal(requests, 3);
});
test('refused reward checks stay false without asking a backup to reverse the refusal', async () => {
  let requests = 0;
  const router = createAiRouter({ ...credentials, fetchImpl: async () => { requests++; return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal' }] }] }); } });
  assert.deepEqual(await router.run(body, { refusalValue: { answer: false } }), { answer: false }); assert.equal(requests, 1);
});
test('a Gemini refused check also remains false without falling through to Kimi', async () => {
  let requests = 0;
  const router = createAiRouter({ ...credentials, fetchImpl: async () => {
    requests++; return requests === 1 ? new Response('', { status: 429 }) : Response.json({ candidates: [{ finishReason: 'SAFETY' }] });
  } });
  assert.deepEqual(await router.run(body, { refusalValue: { answer: false } }), { answer: false }); assert.equal(requests, 2);
});
test('a failed stream before text uses the Gemini backup; backup text is delivered once', async () => {
  let requests = 0; const deltas = [];
  const router = createAiRouter({ ...credentials, fetchImpl: async () => { requests++; return requests === 1 ? stream([{ type: 'response.failed' }]) : gemini('Try counting the equal groups.'); } });
  const streamed = { ...body, text: undefined, stream: true };
  assert.equal(await router.run(streamed, { onDelta: text => deltas.push(text) }), 'Try counting the equal groups.');
  assert.equal(requests, 2); assert.deepEqual(deltas, ['Try counting the equal groups.']);
});
test('a failed stream after delivered text never splices in another provider answer', async () => {
  let requests = 0; const deltas = [];
  const router = createAiRouter({ ...credentials, fetchImpl: async () => { requests++; return stream([{ type: 'response.output_text.delta', delta: 'Look at ' }, { type: 'response.failed' }]); } });
  await assert.rejects(router.run({ ...body, text: undefined, stream: true }, { onDelta: text => deltas.push(text) }), /unavailable/);
  assert.equal(requests, 1); assert.deepEqual(deltas, ['Look at ']);
});
test('cancellation stops failover and sanitises private upstream details', async () => {
  const abort = new AbortController(); let requests = 0;
  const router = createAiRouter({ ...credentials, fetchImpl: async () => { requests++; abort.abort(); throw new Error('PRIVATE credential detail'); } });
  await assert.rejects(router.run(body, { signal: abort.signal }), error => /unavailable/.test(error.message) && !error.message.includes('PRIVATE'));
  assert.equal(requests, 1);
});
test('a hung primary has a bounded slice of the deadline so a backup can answer', async () => {
  let requests = 0;
  const keepAlive = setTimeout(() => {}, 1000);
  try {
    const router = createAiRouter({ ...credentials, fetchImpl: async (_url, req) => {
      requests++; if (requests > 1) return gemini('{"answer":true}');
      return new Promise((resolve, reject) => req.signal.addEventListener('abort', () => reject(new Error('route timed out')), { once: true }));
    } });
    assert.deepEqual(await router.run(body, { timeout: 150 }), { answer: true }); assert.equal(requests, 2);
  } finally { clearTimeout(keepAlive); }
});
