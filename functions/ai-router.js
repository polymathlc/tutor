'use strict';

// Server-only text/vision/reasoning routing. Speech and generated images have
// separate protocols and never enter this chain.
const MODELS = Object.freeze({ openai: 'gpt-6.1-sol', gemini: 'gemini-3.7-flash', kimi: 'kimi-k3' });
class AiRoutingError extends Error {
  constructor(configured) { super(configured ? 'AI providers unavailable.' : 'AI providers not configured.'); this.configured = configured; }
}
function parts(body, kind) {
  return (body.input || []).flatMap(item => (item.content || []).map(part => {
    if (part.type === 'input_text') return kind === 'gemini' ? { text: part.text } : { type: 'text', text: part.text };
    if (part.type !== 'input_image') throw new Error('Unsupported AI input.');
    if (kind === 'kimi') return { type: 'image_url', image_url: { url: part.image_url } };
    const match = /^data:(image\/[A-Za-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(part.image_url);
    if (!match) throw new Error('Unsupported AI image.');
    return { inlineData: { mimeType: match[1], data: match[2] } };
  }));
}
function openAiText(payload) {
  if (payload.status !== 'completed') throw new Error('Incomplete AI response.');
  const outputs = (payload.output || []).filter(item => item.type === 'message').flatMap(item => item.content || []);
  if (outputs.some(item => item.type === 'refusal')) return { refused: true, text: '' };
  const text = outputs.filter(item => item.type === 'output_text').map(item => item.text).join('');
  if (!text.trim()) throw new Error('Empty AI response.');
  return { text };
}
function validateSchema(value, schema) {
  if (!schema) return;
  if (schema.enum && !schema.enum.includes(value)) throw new Error('Invalid AI enum.');
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid AI object.');
    for (const key of schema.required || []) if (!(key in value)) throw new Error('Missing AI field.');
    for (const [key, item] of Object.entries(value)) {
      if (!schema.properties?.[key]) { if (schema.additionalProperties === false) throw new Error('Unexpected AI field.'); }
      else validateSchema(item, schema.properties[key]);
    }
  } else if (schema.type === 'array') {
    if (!Array.isArray(value) || (schema.maxItems != null && value.length > schema.maxItems)) throw new Error('Invalid AI array.');
    for (const item of value) validateSchema(item, schema.items);
  } else if (schema.type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value) || (schema.minimum != null && value < schema.minimum) || (schema.maximum != null && value > schema.maximum)) throw new Error('Invalid AI number.');
  } else if (schema.type && typeof value !== schema.type) throw new Error('Invalid AI field type.');
}
async function readStream(response, onDelta) {
  if (!response.body) throw new Error('No AI stream.');
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let pending = '', text = '', completed = false;
  function event(chunk) {
    const data = chunk.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
    if (!data || data === '[DONE]') return;
    const item = JSON.parse(data);
    if (item.type === 'response.output_text.delta') {
      if (typeof item.delta !== 'string') throw new Error('Malformed AI delta.');
      text += item.delta;
      if (text.length > 12000) throw new Error('AI response too large.');
      if (item.delta) onDelta(text);
    } else if (item.type === 'response.completed') {
      if (item.response?.status && item.response.status !== 'completed') throw new Error('Incomplete AI stream.');
      completed = true;
    } else if (['response.failed', 'response.incomplete', 'error', 'response.refusal.delta'].includes(item.type)) throw new Error('AI stream failed.');
  }
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      if (pending.length > 250000) throw new Error('AI event too large.');
      const chunks = pending.split(/\r?\n\r?\n/); pending = chunks.pop();
      for (const chunk of chunks) event(chunk);
    }
    pending += decoder.decode(); if (pending.trim()) event(pending);
    if (!completed || !text.trim()) throw new Error('Incomplete AI stream.');
    return text;
  } finally { try { await reader.cancel(); } catch {} reader.releaseLock(); }
}
function createAiRouter({ apiKey, geminiApiKey = () => '', kimiApiKey = () => '', fetchImpl = fetch }) {
  async function run(body, { timeout = 90000, signal, onDelta, refusalValue } = {}) {
    let emitted = false;
    const routes = [];
    for (const [provider, keyFn] of [['openai', apiKey], ['gemini', geminiApiKey], ['kimi', kimiApiKey]]) {
      try { const key = keyFn?.(); if (key) routes.push({ provider, key }); } catch { /* Optional secret unavailable. */ }
    }
    const configured = routes.length > 0;
    const linked = signal ? AbortSignal.any([signal, AbortSignal.timeout(timeout)]) : AbortSignal.timeout(timeout);
    // Reserve time for the configured backups instead of letting one hung
    // provider consume the whole request's deadline.
    const routeTimeout = Math.max(1, Math.min(45000, Math.floor(timeout / Math.max(1, routes.length))));
    const schema = body.text?.format?.schema;
    for (const { provider, key } of routes) {
      if (signal?.aborted || linked.aborted) throw new AiRoutingError(configured);
      try {
        const routeSignal = AbortSignal.any([linked, AbortSignal.timeout(routeTimeout)]);
        let url, headers = { 'Content-Type': 'application/json' }, request;
        if (provider === 'openai') {
          url = 'https://api.openai.com/v1/responses'; headers.Authorization = 'Bearer ' + key;
          request = { store: false, ...body, model: MODELS.openai };
        } else if (provider === 'gemini') {
          url = 'https://generativelanguage.googleapis.com/v1beta/models/' + MODELS.gemini + ':generateContent'; headers['x-goog-api-key'] = key;
          request = { systemInstruction: { parts: [{ text: body.instructions || '' }] }, contents: [{ role: 'user', parts: parts(body, provider) }],
            generationConfig: { maxOutputTokens: body.max_output_tokens, thinkingConfig: { thinkingLevel: body.reasoning?.effort === 'medium' ? 'medium' : 'low' } } };
          if (schema) Object.assign(request.generationConfig, { responseMimeType: 'application/json', responseJsonSchema: schema });
        } else {
          url = 'https://api.moonshot.ai/v1/chat/completions'; headers.Authorization = 'Bearer ' + key;
          const instructions = (body.instructions || '') + (schema ? '\nReturn JSON only matching this schema: ' + JSON.stringify(schema) : '');
          request = { model: MODELS.kimi, messages: [{ role: 'system', content: instructions }, { role: 'user', content: parts(body, provider) }],
            reasoning_effort: ['max', 'xhigh'].includes(body.reasoning?.effort) ? 'max' : ['medium', 'high'].includes(body.reasoning?.effort) ? 'high' : 'low',
            max_completion_tokens: Math.max(1024, body.max_output_tokens) };
          if (schema) request.response_format = { type: 'json_object' };
        }
        const response = await fetchImpl(url, { method: 'POST', headers, signal: routeSignal, body: JSON.stringify(request) });
        if (!response.ok) throw new Error('AI request failed.');
        if (provider === 'openai' && body.stream) {
          return await readStream(response, text => { emitted = true; onDelta?.(text); });
        }
        const payload = await response.json(); let result;
        if (provider === 'openai') result = openAiText(payload);
        else if (provider === 'gemini') {
          const candidate = payload.candidates?.[0];
          if (payload.promptFeedback?.blockReason || ['SAFETY', 'RECITATION', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII'].includes(candidate?.finishReason)) result = { refused: true };
          else {
            if (candidate?.finishReason !== 'STOP') throw new Error('Incomplete AI response.');
            result = { text: (candidate.content?.parts || []).filter(part => !part.thought).map(part => part.text || '').join('') };
          }
        } else {
          const choice = payload.choices?.[0];
          if (choice?.finish_reason !== 'stop') throw new Error('Incomplete AI response.');
          result = choice.message?.refusal ? { refused: true } : { text: choice.message?.content };
        }
        if (result.refused) {
          if (refusalValue !== undefined) return refusalValue;
          throw new Error('AI response refused.');
        }
        if (typeof result.text !== 'string' || !result.text.trim()) throw new Error('Empty AI response.');
        if (schema) { const value = JSON.parse(result.text); validateSchema(value, schema); return value; }
        if (body.stream) { emitted = true; onDelta?.(result.text); }
        return result.text;
      } catch {
        // Never merge a second provider's answer into speech already delivered.
        // Cancellation also ends the chain; only failures before delivery retry.
        if (emitted || signal?.aborted || linked.aborted) throw new AiRoutingError(configured);
      }
    }
    throw new AiRoutingError(configured);
  }
  return { run };
}
module.exports = { MODELS, AiRoutingError, createAiRouter, validateSchema };
