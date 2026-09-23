/* Prepared teaching stays on the server. This client retains only pack handles
   and the last explanation actually delivered to this browser. */
(function (root) {
  'use strict';
  function abortError() { var e = new Error('The question changed.'); e.name = 'AbortError'; return e; }
  function check(signal) { if (signal && signal.aborted) throw abortError(); }
  function canRepeat(message) {
    if (root.FastTutorIntents) return root.FastTutorIntents.classify(message) === 'repeat' && !root.FastTutorIntents.questionNumber(message);
    return /^(?:please\s+)?(?:repeat(?:\s+(?:that|it|the last (?:hint|step|explanation)))?|say (?:that|it) again|can you (?:repeat (?:that|it)|say (?:that|it) again)|again)(?:\s+please)?[.!?\s]*$/i.test(String(message || '').trim());
  }
  function isFreshRequest(message) {
    if (root.FastTutorIntents && root.FastTutorIntents.needsFresh(message)) return true;
    return /\b(?:correct|wrong|check|my (?:answer|work|working)|i (?:got|wrote|think|used)|this|that (?:one|number)|here|there|diagram|drawing|handwriting)\b/i.test(String(message || ''));
  }
  async function sha256(value) {
    var digest = await root.crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value)));
    return Array.from(new Uint8Array(digest)).map(function (x) { return x.toString(16).padStart(2, '0'); }).join('');
  }
  function create(options) {
    options = options || {};
    var packs = new Map(), pending = new Map(), last = null, epoch = 0;
    var requestFetch = options.fetch || root.fetch.bind(root);
    async function send(body, signal) {
      check(signal);
      var headers = await options.headers();
      check(signal);
      var response = await requestFetch(options.endpoint, {
        method: 'POST', headers: headers, body: JSON.stringify(body), signal: signal,
        credentials: 'omit', cache: 'no-store'
      });
      if (!response.ok) {
        var data = await response.json().catch(function () { return {}; });
        var error = new Error(data.error && data.error.message || 'The faster tutor is not available.');
        error.code = data.error && data.error.code; error.status = response.status;
        throw error;
      }
      return response;
    }
    async function prepare(body, contextKey, signal) {
      if (packs.has(contextKey)) return packs.get(contextKey);
      if (pending.has(contextKey)) return pending.get(contextKey);
      var started = epoch;
      var job = (async function () {
        var response = await send(Object.assign({}, body, { action: 'prepare' }), signal);
        var data = await response.json();
        check(signal);
        if (started !== epoch) throw abortError();
        if (!data.ready || typeof data.cacheKey !== 'string') throw new Error('Preparation is not ready.');
        var handle = { cacheKey: data.cacheKey, questions: Array.isArray(data.questions) ? data.questions : [] };
        packs.set(contextKey, handle);
        while (packs.size > 24) packs.delete(packs.keys().next().value);
        return handle;
      })();
      pending.set(contextKey, job);
      try { return await job; } finally { if (pending.get(contextKey) === job) pending.delete(contextKey); }
    }
    async function reply(body, contextKey, config) {
      config = config || {};
      var signal = config.signal, started = epoch, old = last, full = '', emitted = false;
      function current() { check(signal); if (started !== epoch || config.isCurrent && !config.isCurrent()) throw abortError(); }
      function emit(text) {
        current();
        if (typeof text !== 'string' || text === full) return;
        if (full && text.slice(0, full.length) !== full) throw new Error('The tutor response changed while streaming.');
        full = text; emitted = !!full;
        if (config.onStream) config.onStream(full);
      }
      current();
      if (old && old.contextKey === contextKey && canRepeat(body.message) && !body.forceFresh) {
        emit(old.text);
        return Object.assign({}, old, { route: 'repeat' });
      }
      var handle = packs.get(config.packKey || contextKey);
      var payload = Object.assign({}, body, { action: 'reply' });
      if (handle) payload.cacheKey = handle.cacheKey;
      // Writing changes the exact repeat binding, not which printed question
      // the student was discussing. A fresh check keeps that question context.
      if (old && (old.contextKey === contextKey || old.packKey && old.packKey === config.packKey)) {
        if (old.questionId) payload.questionId = old.questionId;
      }
      if (old && old.contextKey === contextKey) {
        if (old.responseId) payload.afterResponseId = old.responseId;
        if (!payload.cacheKey && old.cacheKey) payload.cacheKey = old.cacheKey;
      }
      // A changed or unknown page/work state cannot use a prior hint sequence.
      if (old && old.contextKey !== contextKey || isFreshRequest(body.message)) payload.forceFresh = true;
      try {
        var response = await send(payload, signal);
        current();
        var done = null;
        function receive(line) {
          if (!line.trim()) return;
          var event = JSON.parse(line);
          if (event.type === 'error') {
            var e = new Error(event.error && event.error.message || 'The teaching response was interrupted.');
            e.code = event.error && event.error.code; throw e;
          }
          if (event.type === 'delta') emit(event.text);
          if (event.type === 'done') { emit(event.text); done = event; }
        }
        if (!response.body || typeof response.body.getReader !== 'function') {
          (await response.text()).split(/\r?\n/).forEach(receive);
        } else {
          var reader = response.body.getReader(), decoder = new TextDecoder(), buffer = '';
          try {
            for (;;) {
              var chunk = await reader.read(); current();
              if (chunk.done) { buffer += decoder.decode(); break; }
              buffer += decoder.decode(chunk.value, { stream: true });
              if (buffer.length > 120000) throw new Error('The tutor response was too large.');
              var lines = buffer.split('\n'); buffer = lines.pop(); lines.forEach(receive);
            }
            if (buffer.trim()) receive(buffer);
          } finally { try { await reader.cancel(); } catch (_) {} }
        }
        current();
        if (!done || !full.trim()) throw new Error('The teaching response did not finish.');
        last = { text: full, contextKey: contextKey, packKey: config.packKey || contextKey, questionId: done.questionId || '',
          responseId: done.responseId || '', cacheKey: done.cacheKey || payload.cacheKey || '', route: done.route || 'fresh' };
        return last;
      } catch (error) {
        // No fallback may restart a response that reached the speech pipeline.
        if (emitted) last = null;
        error.emitted = emitted;
        throw error;
      }
    }
    async function tryEarly(body, contextKey, config) {
      config = config || {};
      check(config.signal);
      if (config.isCurrent && !config.isCurrent()) throw abortError();
      var old = last, intent = root.FastTutorIntents && root.FastTutorIntents.classify(body.message);
      if (!old || old.contextKey !== contextKey || body.forceFresh || isFreshRequest(body.message)) return null;
      if (canRepeat(body.message)) {
        if (config.onDispatch) config.onDispatch();
        return reply(body, contextKey, config);
      }
      if (!intent || config.allowPrepared === false || !old.questionId ||
        !(old.cacheKey || packs.has(config.packKey || contextKey))) return null;
      var payload = Object.assign({}, body, { preparedOnly: true });
      delete payload.image; delete payload.images;
      var controller = new AbortController(), timer, cancel, emitted = false;
      var deadline = new Promise(function (_, reject) {
        timer = setTimeout(function () {
          controller.abort(); var e = new Error('The prepared lookup took too long.'); e.name = 'TimeoutError'; reject(e);
        }, config.probeTimeoutMs == null ? 2500 : config.probeTimeoutMs);
        cancel = function () { controller.abort(); reject(abortError()); };
        if (config.signal) config.signal.addEventListener('abort', cancel, { once: true });
      });
      try {
        if (config.onDispatch) config.onDispatch();
        return await Promise.race([deadline, reply(payload, contextKey, Object.assign({}, config, {
          signal: controller.signal, onStream: function (text) {
            emitted = !!text;
            if (config.onStream) config.onStream(text);
          }
        }))]);
      } catch (error) {
        if (emitted || error.emitted) { last = null; error.emitted = true; throw error; }
        check(config.signal);
        if (config.isCurrent && !config.isCurrent()) throw abortError();
        // A miss, a slow lookup or unavailable preparation leaves the exact
        // previous response intact for the normal image-backed request.
        return null;
      } finally {
        clearTimeout(timer); controller.abort();
        if (config.signal && cancel) config.signal.removeEventListener('abort', cancel);
      }
    }
    return { prepare: prepare, reply: reply, tryEarly: tryEarly, ready: function (key) { return packs.has(key); },
      remember: function (text, key) { last = { text: text, contextKey: key, route: 'fallback' }; },
      reset: function () { epoch++; packs.clear(); pending.clear(); last = null; } };
  }
  root.FastTutorClient = { create: create, sha256: sha256, canRepeat: canRepeat, isFreshRequest: isFreshRequest };
})(typeof window !== 'undefined' ? window : globalThis);
