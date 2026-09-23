import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import vm from 'node:vm';

const source = readFileSync(new URL('../fast-tutor.js', import.meta.url), 'utf8');
const intentSource = readFileSync(new URL('../functions/fast-tutor-intents.js', import.meta.url), 'utf8');
function harness(fetch) {
  const c = vm.createContext({ fetch, crypto: webcrypto, TextEncoder, TextDecoder, Uint8Array, AbortController, Map, Set, setTimeout, clearTimeout });
  vm.runInContext(intentSource, c);
  vm.runInContext(source, c);
  const calls = [];
  const client = c.FastTutorClient.create({ endpoint: '/teach', headers: async () => ({ Authorization: 'Bearer test' }),
    fetch: async (url, init) => { calls.push(JSON.parse(init.body)); return fetch(url, init); } });
  return { client, calls, api: c.FastTutorClient };
}
const ready = () => Response.json({ ready: true, cacheKey: 'pack1', questions: [{ id: 'q1', label: '1' }] });
const done = (text = 'Find the value of one item.', extra = {}) => ({ type: 'done', text, route: 'prepared', questionId: 'q1', responseId: 'step1', cacheKey: 'pack1', ...extra });
const lines = events => new Response(events.map(x => JSON.stringify(x)).join('\n') + '\n', { headers: { 'Content-Type': 'application/x-ndjson' } });
const base = { worksheetId: 'worksheet1', page: 1, message: 'Next hint' };
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }

test('preparing the same stable page shares one request and caches only its handle', async () => {
  const wait = deferred(), h = harness(async () => { await wait.promise; return ready(); });
  const a = h.client.prepare(base, 'page'), b = h.client.prepare(base, 'page');
  await Promise.resolve(); wait.resolve();
  const [one, two] = await Promise.all([a, b]);
  assert.equal(h.calls.length, 1); assert.equal(one, two); assert.equal(one.cacheKey, 'pack1');
  await h.client.prepare(base, 'page'); assert.equal(h.calls.length, 1);
  assert.deepEqual(Object.keys(one).sort(), ['cacheKey', 'questions']);
});

test('reset rejects preparation finishing for an old learner and does not restore its handle', async () => {
  const wait = deferred(), h = harness(async () => { await wait.promise; return ready(); });
  const job = h.client.prepare(base, 'old'); h.client.reset(); wait.resolve();
  await assert.rejects(job, { name: 'AbortError' }); assert.equal(h.client.ready('old'), false);
});

test('real streamed bytes survive chunk and UTF-8 boundaries and deliver cumulative text', async () => {
  const first = 'Read 一 unit first. ', all = first + 'What is its value?';
  const bytes = new TextEncoder().encode(JSON.stringify({ type: 'delta', text: first }) + '\n' + JSON.stringify(done(all)) + '\n');
  const h = harness(async () => new Response(new ReadableStream({ start(controller) {
    for (let i = 0; i < bytes.length; i += 5) controller.enqueue(bytes.slice(i, i + 5)); controller.close();
  } })));
  const emitted = [], result = await h.client.reply(base, 'work', { onStream: x => emitted.push(x) });
  assert.equal(result.text, all); assert.deepEqual(emitted, [first, all]);
});

test('only an explicit repeat under the exact same binding avoids a network request', async () => {
  const h = harness(async () => lines([done()]));
  await h.client.reply(base, 'work');
  const repeated = await h.client.reply({ ...base, message: 'Please say that again.' }, 'work');
  assert.equal(repeated.route, 'repeat'); assert.equal(h.calls.length, 1);
  await h.client.reply({ ...base, message: 'Repeat that but for question 2' }, 'work');
  assert.equal(h.calls.length, 2);
  await h.client.reply({ ...base, message: 'Repeat that' }, 'new-work');
  assert.equal(h.calls.length, 3); assert.equal(h.calls[2].forceFresh, true);
});

test('a stable prepared page survives a pen edit while the changed working is freshly checked', async () => {
  const h = harness(async (_url, init) => JSON.parse(init.body).action === 'prepare' ? ready() : lines([done('Try one item.', { responseId: '', route: 'fresh' })]));
  await h.client.prepare(base, 'page');
  await h.client.reply(base, 'blank', { packKey: 'page' });
  await h.client.reply({ ...base, message: 'Check my working' }, 'ink', { packKey: 'page' });
  assert.equal(h.calls[2].cacheKey, 'pack1'); assert.equal(h.calls[2].forceFresh, true);
  assert.equal(h.calls[2].questionId, 'q1'); assert.equal(h.calls[2].afterResponseId, undefined);
  await h.client.reply(base, 'ink', { packKey: 'page' });
  assert.equal(h.calls[3].cacheKey, 'pack1'); assert.equal(h.calls[3].questionId, 'q1');
  assert.equal(h.calls[3].forceFresh, undefined); assert.equal(h.calls[3].afterResponseId, undefined);
});

test('a partial answer cannot fall back or make repeat return an earlier unrelated explanation', async () => {
  let count = 0;
  const h = harness(async () => ++count !== 2 ? lines([done('Earlier safe hint.')]) :
    lines([{ type: 'delta', text: 'A partially delivered new hint. ' }, { type: 'error', error: { code: 'provider_failed' } }]));
  await h.client.reply(base, 'work');
  await assert.rejects(h.client.reply(base, 'work'), e => e.emitted === true);
  const repeated = await h.client.reply({ ...base, message: 'repeat' }, 'work');
  assert.equal(repeated.route, 'prepared'); assert.equal(h.calls.length, 3);
});

test('no done event means an interrupted response, even if HTTP succeeded', async () => {
  const h = harness(async () => lines([{ type: 'delta', text: 'Half an answer. ' }]));
  await assert.rejects(h.client.reply(base, 'work'), e => e.emitted === true && /did not finish/.test(e.message));
});

test('replacing an already emitted prefix is rejected instead of speaking a second answer', async () => {
  const h = harness(async () => lines([{ type: 'delta', text: 'First answer. ' }, done('Different answer.')]));
  const chunks = [];
  await assert.rejects(h.client.reply(base, 'work', { onStream: x => chunks.push(x) }), e => e.emitted === true);
  assert.deepEqual(chunks, ['First answer. ']);
});

test('changed question context cancels before even the first text is emitted', async () => {
  const wait = deferred(), h = harness(async () => { await wait.promise; return lines([done()]); });
  let current = true, emitted = false;
  const job = h.client.reply(base, 'work', { isCurrent: () => current, onStream: () => { emitted = true; } });
  current = false; wait.resolve();
  await assert.rejects(job, { name: 'AbortError' }); assert.equal(emitted, false);
});

test('a pre-aborted request never obtains credentials or calls the server', async () => {
  const h = harness(async () => lines([done()])), controller = new AbortController(); controller.abort();
  await assert.rejects(h.client.reply(base, 'work', { signal: controller.signal }), { name: 'AbortError' });
  assert.equal(h.calls.length, 0);
});

test('an HTTP failure before text leaves fallback permitted and preserves the error category', async () => {
  const h = harness(async () => Response.json({ error: { code: 'quota_exceeded', message: 'Busy' } }, { status: 429 }));
  await assert.rejects(h.client.reply(base, 'work'), e => e.status === 429 && e.code === 'quota_exceeded' && e.emitted === false);
});

test('broad correctness and pointing requests are never direct prepared selections', () => {
  const h = harness(async () => lines([done()]));
  for (const message of ['Is my answer correct?', 'Check my work', 'I wrote 12', 'This number here', 'Look at the diagram']) assert.equal(h.api.isFreshRequest(message), true);
  for (const message of ['Next hint', 'Repeat that', 'Explain more simply']) assert.equal(h.api.isFreshRequest(message), false);
  assert.equal(h.api.canRepeat('Repeat the answer to question 4'), false);
});

test('source fingerprint uses SHA-256 and is stable', async () => {
  const h = harness(async () => lines([done()]));
  assert.equal(await h.api.sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('early repeat speaks the existing explanation without preparation, headers or network', async () => {
  const h = harness(async () => lines([done()]));
  await h.client.reply(base, 'work', { packKey: 'page' });
  const chunks = [], before = h.calls.length;
  const result = await h.client.tryEarly({ ...base, message: 'Could you say that again, please?' }, 'work', { packKey: 'page', onStream: text => chunks.push(text) });
  assert.equal(h.calls.length, before); assert.equal(result.route, 'repeat'); assert.deepEqual(chunks, [result.text]);
});

test('early next uses only an image-free server lookup with the prior question and step', async () => {
  const h = harness(async () => lines([done()]));
  await h.client.reply(base, 'work', { packKey: 'page' });
  await h.client.tryEarly({ ...base, message: 'Could you give me another clue, please?', image: 'must-not-send', images: ['must-not-send'] }, 'work', { packKey: 'page' });
  const request = h.calls.at(-1);
  assert.equal(request.preparedOnly, true); assert.equal(request.image, undefined); assert.equal(request.images, undefined);
  assert.equal(request.questionId, 'q1'); assert.equal(request.afterResponseId, 'step1'); assert.equal(request.cacheKey, 'pack1');
});

test('an early lookup miss preserves question context for exactly one ordinary continuation', async () => {
  const h = harness(async (_url, init) => JSON.parse(init.body).preparedOnly ?
    Response.json({ error: { code: 'fresh_image_required' } }, { status: 409 }) : lines([done()]));
  await h.client.reply(base, 'work', { packKey: 'page' });
  assert.equal(await h.client.tryEarly(base, 'work', { packKey: 'page' }), null);
  await h.client.reply({ ...base, image: 'current-image' }, 'work', { packKey: 'page' });
  assert.equal(h.calls.length, 3); assert.equal(h.calls[2].preparedOnly, undefined);
  assert.equal(h.calls[2].questionId, 'q1'); assert.equal(h.calls[2].afterResponseId, 'step1');
});

test('unknown, correctness, changed-work and two-page next requests never start an early lookup', async () => {
  const h = harness(async () => lines([done()]));
  await h.client.reply(base, 'work', { packKey: 'page' });
  for (const message of ['Why does division work?', 'Can you give me a hint and check my answer?', 'Look at this number']) {
    assert.equal(await h.client.tryEarly({ ...base, message }, 'work', { packKey: 'page' }), null);
  }
  assert.equal(await h.client.tryEarly(base, 'edited-work', { packKey: 'page' }), null);
  assert.equal(await h.client.tryEarly(base, 'work', { packKey: 'page', allowPrepared: false }), null);
  assert.equal(h.calls.length, 1);
  assert.equal((await h.client.tryEarly({ ...base, message: 'repeat' }, 'work', { allowPrepared: false })).route, 'repeat');
});

test('repeat with an explicit different question never replays the old local response', async () => {
  const h = harness(async (_url, init) => JSON.parse(init.body).preparedOnly ?
    Response.json({ error: { code: 'fresh_image_required' } }, { status: 409 }) : lines([done()]));
  await h.client.reply(base, 'work', { packKey: 'page' });
  const chunks = [];
  const result = await h.client.tryEarly({ ...base, message: 'Repeat that for question two' }, 'work', { packKey: 'page', onStream: text => chunks.push(text) });
  assert.equal(result, null); assert.equal(h.calls.length, 2); assert.deepEqual(chunks, []);
});

test('a slow probe stops promptly without cancelling its ordinary continuation', async () => {
  const h = harness(async (_url, init) => {
    if (!JSON.parse(init.body).preparedOnly) return lines([done()]);
    return new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }));
  });
  await h.client.reply(base, 'work', { packKey: 'page' });
  const outer = new AbortController();
  assert.equal(await h.client.tryEarly(base, 'work', { packKey: 'page', signal: outer.signal, probeTimeoutMs: 10 }), null);
  assert.equal(outer.signal.aborted, false);
  const result = await h.client.reply({ ...base, image: 'current-image' }, 'work', { packKey: 'page', signal: outer.signal });
  assert.equal(result.text, done().text); assert.equal(h.calls.length, 3);
});

test('cancelling a probe remains cancellation instead of a miss eligible for fallback', async () => {
  const waiting = deferred(), h = harness(async (_url, init) => {
    if (!JSON.parse(init.body).preparedOnly) return lines([done()]);
    waiting.resolve();
    return new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }));
  });
  await h.client.reply(base, 'work', { packKey: 'page' });
  const outer = new AbortController(), job = h.client.tryEarly(base, 'work', { packKey: 'page', signal: outer.signal });
  await waiting.promise; outer.abort();
  await assert.rejects(job, { name: 'AbortError' }); assert.equal(h.calls.length, 2);
});

test('partial text from an early lookup can never become a miss and duplicate spoken guidance', async () => {
  const h = harness(async (_url, init) => JSON.parse(init.body).preparedOnly ?
    lines([{ type: 'delta', text: 'The first useful sentence. ' }, { type: 'error', error: { code: 'broken_stream' } }]) : lines([done()]));
  await h.client.reply(base, 'work', { packKey: 'page' });
  await assert.rejects(h.client.tryEarly(base, 'work', { packKey: 'page' }), error => error.emitted === true);
  assert.equal(h.calls.length, 2);
});
