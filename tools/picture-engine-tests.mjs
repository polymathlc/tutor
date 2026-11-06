// 🖼 THE PICTURE MODEL — ChatGPT Images 2.6 (server key) leads, Gemini behind it (v1.85.0)
//
// Run: node --test tools/picture-engine-tests.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, '..', 'index.html'), 'utf8');
const start = html.indexOf('const AI_IMAGE_MODELS = [');
const end = html.indexOf('🎙️ TRANSCRIPTION', start);
const block = html.slice(start, html.lastIndexOf('/* ====', end));

function build({ functions = true, gemini = true, server, geminiReply } = {}) {
  const calls = { server: [], gemini: [] };
  const window = {};
  const firebase = functions ? { functions: {} } : undefined;
  const _aiCallable = (name, timeout) => async payload => { calls.server.push({ name, timeout, payload }); return server(payload); };
  const getAI = () => ({});
  const GoogleAIBackend = function () {};
  const getGenerativeModel = (_ai, { model }) => ({ model, generateContent: async parts => { calls.gemini.push({ model, parts }); return geminiReply(model); } });
  const app = {};
  const fn = new Function('window', 'firebase', '_aiCallable', 'getAI', 'GoogleAIBackend', 'getGenerativeModel', 'app', 'console', 'setTimeout',
    (gemini ? '' : 'getAI = () => { throw new Error("no AI"); };\n') + block + '\nreturn { OPENAI_IMAGE_MODEL, OPENAI_IMAGE_DOWN_MS };');
  const quiet = { warn() {}, log() {} };
  const out = fn(window, firebase, _aiCallable, getAI, GoogleAIBackend, getGenerativeModel, app, quiet, (f) => f());
  return { window, calls, ...out };
}
const geminiPicture = () => ({ response: { inlineDataParts: () => [{ inlineData: { mimeType: 'image/png', data: 'R0VN' } }] } });

test('the server route draws first, on gpt-image-2.6-sunburst, as an edit of the crop', async () => {
  const api = build({ server: () => ({ data: { b64: 'U0VSVkVS', mimeType: 'image/png', model: 'gpt-image-2.6-sunburst' } }), geminiReply: geminiPicture });
  assert.equal(api.OPENAI_IMAGE_MODEL, 'gpt-image-2.6-sunburst');
  assert.equal(api.window.imageAiReady(), true);
  const out = await api.window.askGeminiImage('clean it', 'data:image/jpeg;base64,QUJD');
  assert.equal(out, 'data:image/png;base64,U0VSVkVS');
  assert.equal(api.calls.server.length, 1);
  assert.equal(api.calls.server[0].name, 'openAiImage');
  const p = api.calls.server[0].payload;
  assert.equal(p.model, 'gpt-image-2.6-sunburst');
  assert.equal(p.size, 'auto', 'an edit keeps the crop shape');
  assert.deepEqual(p.images, [{ mimeType: 'image/jpeg', data: 'QUJD' }]);
  assert.equal('inputFidelity' in p, false, 'the 2.x family refuses input_fidelity');
  assert.equal(api.calls.gemini.length, 0, 'Gemini is never asked when ChatGPT answers');
  assert.equal(api.window.imageLastModel(), 'gpt-image-2.6-sunburst');
  assert.match(api.window.imageRouteNote(), /ChatGPT Images 2\.6 \(gpt-image-2\.6-sunburst\)/);
});

test('a route fault falls through to Gemini and marks ChatGPT down, so the next figure skips it', async () => {
  const api = build({ server: () => { const e = new Error('No OpenAI key is configured on the server.'); e.code = 'functions/failed-precondition'; throw e; }, geminiReply: geminiPicture });
  assert.equal(await api.window.askGeminiImage('clean it', 'data:image/png;base64,QUJD'), 'data:image/png;base64,R0VN');
  assert.equal(api.window.imageLastModel(), 'gemini-3.1-flash-image-preview');
  await api.window.askGeminiImage('clean it', 'data:image/png;base64,QUJD');
  assert.equal(api.calls.server.length, 1, 'marked down, not paid for again');
  assert.equal(api.calls.gemini.length, 2);
});

test('with no Gemini model the server route alone is enough, and its error is what is thrown', async () => {
  const ok = build({ gemini: false, server: () => ({ data: { b64: 'QQ==' } }), geminiReply: geminiPicture });
  assert.equal(ok.window.imageAiReady(), true);
  assert.equal(await ok.window.askGeminiImage('draw', ''), 'data:image/png;base64,QQ==');
  assert.equal(ok.calls.server[0].payload.size, '1024x1024', 'a picture from nothing is square');
  const bad = build({ gemini: false, server: () => { throw new Error('boom'); }, geminiReply: geminiPicture });
  await assert.rejects(() => bad.window.askGeminiImage('draw', ''), /boom/);
});

test('without the functions SDK the app still cleans up with Gemini', async () => {
  const api = build({ functions: false, server: () => { throw new Error('never'); }, geminiReply: geminiPicture });
  assert.equal(api.window.imageAiReady(), true);
  assert.equal(await api.window.askGeminiImage('clean', 'data:image/png;base64,QUJD'), 'data:image/png;base64,R0VN');
  assert.equal(api.calls.server.length, 0);
  assert.match(api.window.imageRouteNote(), /^Pictures are redrawn by gemini-3\.1-flash-image-preview\.$/);
});

test('figures go up one at a time', async () => {
  let active = 0, peak = 0;
  const api = build({ server: async () => { active++; peak = Math.max(peak, active); await new Promise(r => setImmediate(r)); active--; return { data: { b64: 'QQ==' } }; }, geminiReply: geminiPicture });
  await Promise.all([1, 2, 3].map(() => api.window.askGeminiImage('clean', 'data:image/png;base64,QUJD')));
  assert.equal(peak, 1);
  assert.equal(api.calls.server.length, 3);
});
