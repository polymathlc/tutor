import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
function runtime(call) {
  const source = html.slice(html.indexOf('const AI_ENGINES ='), html.indexOf('/* `onStream` is an OPTIONAL EARLY-DELIVERY'));
  const sandbox = { window: {}, geminiModel: {}, Date, console: { warn() {} },
    firebase: { functions: {}, app: () => ({ functions: () => ({ httpsCallable: name => body => call(body, name) }) }) },
    aiWithDeadline: fn => fn(undefined), aiThrowIfAborted: () => {}, askGeminiDirect: async () => 'Gemini answer' };
  vm.runInNewContext(source, sandbox);
  return sandbox;
}
test('all text/vision/thinking tasks start with ChatGPT, followed by Gemini and Kimi', () => {
  const { window } = runtime();
  assert.deepEqual(Array.from(window.aiEngines().order), ['ChatGPT (server key)', 'Gemini', 'Kimi (server key)']);
  assert.deepEqual(Array.from(window.aiEngines().teachOrder), Array.from(window.aiEngines().order));
  window.aiSetEngine('unrecognised'); assert.equal(window.aiEngines().preferred, 'openai');
  window.aiSetEngine('kimi'); assert.equal(window.aiEngines().preferred, 'kimi');
});
test('OpenAI receives the default model, images and valid reasoning effort; unsupported effort becomes low', async () => {
  const seen = [];
  const { window } = runtime(async body => { seen.push(body); return { data: { text: 'Read the groups.', model: 'gpt-6.1-sol' } }; });
  for (const thinkingLevel of ['high', 'none', 'minimal']) await window.askGemini('Help', { thinkingLevel, images: [{ mimeType: 'image/png', data: 'YQ==' }], json: true });
  assert.deepEqual(seen.map(item => item.reasoningEffort), ['high', 'low', 'low']);
  assert.equal(seen[0].model, 'gpt-6.1-sol'); assert.equal(seen[0].media[0].data, 'YQ==');
  assert.equal(seen[0].temperature, undefined); assert.equal(window.aiEngines().models.openai, 'gpt-6.1-sol');
});
test('unmarked legacy defaults migrate while deliberate shared teacher choices survive', () => {
  const source = html.slice(html.indexOf('function aiEngineSavedPreference('), html.indexOf('var _aiCfgStop'));
  const sandbox = {}; vm.runInNewContext(source, sandbox);
  for (const value of [{}, { aiEngine: 'gemini' }, { aiEngine: 'kimi' }, { aiEngine: 'invalid', aiEngineManual: true }]) assert.equal(sandbox.aiEngineSavedPreference(value), 'openai');
  for (const value of [{ aiEngine: 'gemini', aiEngineBy: 'teacher@example.test' }, { aiEngine: 'kimi', aiEngineAt: '2026-09-30' }, { aiEngine: 'gemini', aiEngineManual: true }]) assert.equal(sandbox.aiEngineSavedPreference(value), value.aiEngine);
});
test('a failing OpenAI route selects Gemini without losing the question image', async () => {
  let asked = 0;
  const sandbox = runtime(async () => { asked++; throw new Error('Quota exhausted'); });
  const { window } = sandbox;
  sandbox.askGeminiDirect = async (prompt, opts) => { assert.equal(prompt, 'Help'); assert.equal(opts.images[0].data, 'YQ=='); return 'Gemini answer'; };
  assert.equal(await window.askGemini('Help', { images: [{ mimeType: 'image/png', data: 'YQ==' }] }), 'Gemini answer');
  assert.equal(asked, 1); assert.equal(window.aiEngines().fellBack, true);
  assert.equal(window.aiEngines().vendor, 'Gemini');
});
test('Kimi answers when both preferred providers fail, and receives the picture', async () => {
  const asked = [];
  const sandbox = runtime(async (body, name) => {
    asked.push(name);
    if (name === 'askOpenAi') throw new Error('OpenAI unavailable');
    assert.equal(body.media[0].data, 'YQ=='); assert.equal(body.model, undefined);
    return { data: { text: 'Kimi answer', model: 'kimi-k3' } };
  });
  sandbox.askGeminiDirect = async () => { throw new Error('Gemini unavailable'); };
  assert.equal(await sandbox.window.askGemini('Help', { images: [{ data: 'YQ==' }] }), 'Kimi answer');
  assert.deepEqual(asked, ['askOpenAi', 'askKimi']); assert.equal(sandbox.window.aiEngines().vendor, 'Kimi');
});
test('Gemini initialisation failure does not prevent a configured shared OpenAI route', async () => {
  const sandbox = runtime(async () => ({ data: { text: 'OpenAI answer', model: 'gpt-6.1-sol' } }));
  sandbox.geminiModel = null;
  assert.equal(sandbox.window.aiReady(), true);
  assert.equal(await sandbox.window.askGemini('Help'), 'OpenAI answer');
  assert.deepEqual(Array.from(sandbox.window.aiEngines().order), ['ChatGPT (server key)', 'Kimi (server key)']);
});
