'use strict';
(() => {
  const ENDPOINT = 'https://us-central1-mathgen--app.cloudfunctions.net/studyBuddySample';
  const $ = id => document.getElementById(id);
  const subject = new URLSearchParams(location.search).get('subject') === 'science' ? 'science' : 'math';
  const state = { token: '', pdf: null, page: 1, ink: new Map(), history: [], asking: false, rendering: false, generation: 0, pc: null, stream: null, channel: null, audio: null, sessionId: '', phase: 'idle', muted: false, transcript: '', timer: null, controller: null, delegated: new Set(), startup: null };
  const canvas = $('pdfCanvas'), ink = $('inkCanvas');
  let stroke = null;
  function status(text) { $('liveStatus').textContent = text; }
  function bubble(text, kind = 'buddy') { const node = document.createElement('div'); node.className = 'message ' + kind; node.textContent = text; $('conversation').appendChild(node); while ($('conversation').children.length > 30) $('conversation').firstChild.remove(); node.scrollIntoView({ block: 'nearest' }); return node; }
  async function request(body, signal, keepalive = false) {
    const response = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': keepalive ? 'text/plain;charset=UTF-8' : 'application/json' }, body: JSON.stringify({ ...body, token: state.token, subject }), signal: signal || AbortSignal.timeout(100000), keepalive });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error?.message || 'The sample tutor is unavailable just now.');
    return result;
  }
  function controls() { const active = state.phase !== 'idle'; $('start').hidden = active; $('start').disabled = !state.pdf || !$('liveEnabled').checked; $('stop').hidden = !active; $('mute').hidden = state.phase !== 'live'; $('mute').textContent = state.muted ? 'Unmute microphone' : 'Mute microphone'; }
  function paintInk() {
    const ctx = ink.getContext('2d'); ctx.clearRect(0, 0, ink.width, ink.height);
    for (const line of state.ink.get(state.page) || []) {
      ctx.strokeStyle = line.tool === 'highlighter' ? 'rgba(251,196,39,.35)' : '#176b50'; ctx.lineWidth = line.tool === 'highlighter' ? 18 : 2.8; ctx.lineCap = ctx.lineJoin = 'round'; ctx.beginPath();
      line.points.forEach((p, i) => { const x = p.x * ink.width, y = p.y * ink.height; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
    }
  }
  async function render() {
    if (state.rendering) return; state.rendering = true;
    $('previous').disabled = $('next').disabled = true;
    try { const page = await state.pdf.getPage(state.page), viewport = page.getViewport({ scale: 1.4 }); canvas.width = ink.width = Math.round(viewport.width); canvas.height = ink.height = Math.round(viewport.height); await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise; paintInk(); $('pageLabel').textContent = 'Page ' + state.page + ' of ' + state.pdf.numPages; }
    finally { state.rendering = false; $('previous').disabled = state.page === 1; $('next').disabled = state.page === state.pdf.numPages; }
  }
  function point(event) { const rect = ink.getBoundingClientRect(); return { x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) }; }
  ink.addEventListener('pointerdown', event => { if (state.rendering || event.button !== 0) return; ink.setPointerCapture(event.pointerId); stroke = { tool: $('tool').value, points: [point(event)] }; const lines = state.ink.get(state.page) || []; if (lines.length >= 300) lines.shift(); lines.push(stroke); state.ink.set(state.page, lines); });
  ink.addEventListener('pointermove', event => { if (!stroke) return; if (stroke.points.length < 4000) stroke.points.push(point(event)); paintInk(); });
  ink.addEventListener('pointerup', () => { if (stroke?.points.length === 1) { const p = stroke.points[0]; stroke.points.push({ x: p.x + .001, y: p.y + .001 }); paintInk(); } stroke = null; });
  ink.addEventListener('pointercancel', () => { stroke = null; });
  $('undo').onclick = () => { (state.ink.get(state.page) || []).pop(); paintInk(); };
  $('clear').onclick = () => { state.ink.delete(state.page); paintInk(); };
  $('previous').onclick = () => { if (!state.rendering && state.page > 1) { state.page--; render(); } };
  $('next').onclick = () => { if (!state.rendering && state.page < state.pdf.numPages) { state.page++; render(); } };
  function snapshot() { const shot = document.createElement('canvas'); const scale = Math.min(1, 1000 / canvas.width); shot.width = Math.round(canvas.width * scale); shot.height = Math.round(canvas.height * scale); const ctx = shot.getContext('2d'); ctx.drawImage(canvas, 0, 0, shot.width, shot.height); ctx.drawImage(ink, 0, 0, shot.width, shot.height); return shot.toDataURL('image/jpeg', .65); }
  function cleanReply(text) { return String(text || '').replace(/\[\[focus[^\]]*\]\]/g, '').trim(); }
  async function teach(message, signal) { while (state.rendering) { if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError'); await new Promise(resolve => setTimeout(resolve, 25)); } const result = await request({ action: 'ask', message, page: state.page, image: snapshot(), working: $('working').value, history: state.history.slice(-6) }, signal); return cleanReply(result.text); }
  async function ask(message) {
    if (state.asking || state.rendering || !state.pdf) return; state.asking = true; $('ask').disabled = $('hint').disabled = $('check').disabled = true;
    bubble(message, 'student'); const pending = bubble('Thinking…');
    try { const text = await teach(message); pending.textContent = text; state.history.push({ role: 'student', text: message }, { role: 'buddy', text }); state.history = state.history.slice(-6); }
    catch (error) { pending.classList.add('error'); pending.textContent = error.message; }
    finally { state.asking = false; $('ask').disabled = $('hint').disabled = $('check').disabled = false; }
  }
  $('askForm').onsubmit = event => { event.preventDefault(); const text = $('question').value.trim(); if (text) { $('question').value = ''; ask(text); } };
  $('hint').onclick = () => ask('Give me one small hint for the question on this page.');
  $('check').onclick = () => ask('Check my visible working and tell me one thing to improve. Ask me which question if it is unclear.');
  function send(event) { if (state.channel?.readyState === 'open') state.channel.send(JSON.stringify(event)); }
  function endLive(text = 'Your microphone is off. You can continue with the text tutor.') {
    state.generation++; clearTimeout(state.timer); clearTimeout(state.startup); state.controller?.abort(); state.controller = null;
    const sessionId = state.sessionId; state.sessionId = ''; state.phase = 'idle'; state.delegated.clear();
    send({ type: 'session.close' }); if (state.channel) { state.channel.onclose = null; state.channel.close(); } if (state.pc) { state.pc.onconnectionstatechange = null; state.pc.close(); } state.stream?.getTracks().forEach(track => track.stop()); state.audio?.remove(); state.pc = state.stream = state.channel = state.audio = null; $('play').hidden = true;
    if (sessionId) request({ action: 'stop', sessionId }, undefined, true).catch(() => {});
    status(text); controls();
  }
  async function delegation(id, generation) {
    if (state.delegated.has(id)) return; state.delegated.add(id); state.controller?.abort(); const controller = state.controller = new AbortController();
    const message = state.transcript.trim().slice(-1000) || 'Help me with the visible worksheet question one step at a time.'; state.transcript = ''; status('Thinking…');
    send({ type: 'session.thinking.append', delegation_id: id, content: 'The worksheet tutor is checking the current page and student working. Wait silently for its teaching result.' });
    try { const text = await teach(message, controller.signal); if (generation !== state.generation || controller.signal.aborted) return; bubble(text); state.history.push({ role: 'student', text: message }, { role: 'buddy', text }); state.history = state.history.slice(-6); send({ type: 'session.commentary.append', delegation_id: id, content: text }); status('Listening — ask a question or interrupt at any time.'); }
    catch (error) { if (generation === state.generation && !controller.signal.aborted) { send({ type: 'session.commentary.append', delegation_id: id, content: 'I could not check the worksheet just now. Please try the text tutor.' }); status(error.message); } }
  }
  async function playAudio() { try { await state.audio?.play(); $('play').hidden = true; } catch { $('play').hidden = false; status('Tap Enable tutor audio to hear your tutor.'); } }
  async function startLive() {
    if (state.phase !== 'idle' || !state.pdf || !$('liveEnabled').checked) return;
    if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) { status('Use the text tutor below, or open this page in a browser with microphone support.'); return; }
    const generation = ++state.generation; state.phase = 'connecting'; state.muted = false; state.transcript = ''; controls(); status('Allow your microphone to start the conversation…');
    state.startup = setTimeout(() => { if (generation === state.generation) endLive('The connection timed out. Tap Start live tutor to retry.'); }, 60000);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      if (generation !== state.generation) { stream.getTracks().forEach(track => track.stop()); return; } state.stream = stream;
      stream.getTracks().forEach(track => { track.onended = () => { if (generation === state.generation) endLive('The microphone was disconnected.'); }; });
      const pc = state.pc = new RTCPeerConnection(); state.audio = document.createElement('audio'); state.audio.autoplay = true; state.audio.setAttribute('playsinline', ''); $('audioHost').appendChild(state.audio);
      pc.ontrack = event => { if (generation !== state.generation) return; state.audio.srcObject = event.streams[0] || new MediaStream([event.track]); playAudio(); };
      stream.getTracks().forEach(track => pc.addTrack(track, stream)); const channel = state.channel = pc.createDataChannel('oai-events');
      channel.onclose = () => { if (generation === state.generation) endLive('The conversation ended. Your microphone is off.'); };
      pc.onconnectionstatechange = () => { if (generation === state.generation && ['failed', 'closed'].includes(pc.connectionState)) endLive('The audio connection was lost. You can use the text tutor.'); };
      channel.onmessage = event => {
        if (generation !== state.generation) return; let data; try { data = JSON.parse(event.data); } catch { return; }
        if (data.type === 'session.started') { state.phase = 'live'; clearTimeout(state.startup); controls(); status('Listening — ask a question or interrupt at any time.'); }
        else if (data.type === 'session.input_transcript.delta' && typeof data.delta === 'string') { state.controller?.abort(); state.transcript = (state.transcript + data.delta).slice(-2000); }
        else if (data.type === 'session.delegation.created' && data.delegation?.target === 'client' && data.delegation.id) delegation(data.delegation.id, generation);
        else if (data.type === 'session.closed') endLive('The conversation ended. Your microphone is off.');
        else if (data.type === 'error') status('The tutor could not complete that response. Please try the text tutor.');
      };
      await pc.setLocalDescription(await pc.createOffer());
      if (pc.iceGatheringState !== 'complete') await new Promise(resolve => { const timer = setTimeout(done, 5000); function done() { clearTimeout(timer); pc.removeEventListener('icegatheringstatechange', changed); resolve(); } function changed() { if (pc.iceGatheringState === 'complete') done(); } pc.addEventListener('icegatheringstatechange', changed); });
      if (generation !== state.generation) return;
      const answer = await request({ action: 'start', sdp: pc.localDescription.sdp });
      if (generation !== state.generation) { request({ action: 'stop', sessionId: answer.sessionId }, undefined, true).catch(() => {}); return; }
      state.sessionId = answer.sessionId; state.timer = setTimeout(() => endLive('Your voice trial has ended. Continue with the text tutor below.'), Math.max(0, answer.expiresAt - Date.now())); await pc.setRemoteDescription({ type: 'answer', sdp: answer.sdp });
    } catch (error) { if (generation === state.generation) endLive(error.name === 'NotAllowedError' ? 'Microphone permission is needed for live tutoring. Tap Start live tutor when you are ready, or type below.' : error.message || 'Live tutoring could not start. Try the text tutor below.'); }
  }
  $('start').onclick = startLive; $('stop').onclick = () => endLive(); $('play').onclick = playAudio;
  $('mute').onclick = () => { state.muted = !state.muted; state.stream?.getAudioTracks().forEach(track => { track.enabled = !state.muted; }); status(state.muted ? 'Microphone muted. You can still hear your tutor.' : 'Listening — ask a question.'); controls(); };
  $('liveEnabled').onchange = () => { $('liveEnabled').checked ? startLive() : endLive(); controls(); };
  addEventListener('pagehide', () => endLive());
  async function boot() {
    $('subjectLabel').textContent = (subject === 'science' ? 'Science' : 'Maths') + ' · Study Buddy';
    try {
      const result = await request({ action: 'initialize' }); state.token = result.token; $('title').textContent = result.worksheet.title;
      if (!window.pdfjsLib) throw new Error('The PDF reader could not load. Refresh this page to try again.'); pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      state.pdf = await pdfjsLib.getDocument({ url: result.worksheet.pdfUrl, withCredentials: false, isEvalSupported: false }).promise; if (state.pdf.numPages > 30) throw new Error('Choose a sample worksheet with at most 30 pages.');
      $('workspace').hidden = false; await render(); $('notice').textContent = 'Write on the worksheet, ask for a hint, or talk with your tutor.'; bubble('Choose a question and have a go. I can help you with one step at a time.'); controls(); startLive();
    } catch (error) { $('notice').textContent = error.message; status('The sample worksheet is not ready yet.'); }
  }
  boot();
})();
