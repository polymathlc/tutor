/* Public worksheet interactions with mocked PDFs, microphone and paid APIs. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const { chromium } = await import(pathToFileURL(process.env.PW || '/opt/node22/lib/node_modules/playwright/index.mjs').href);
const server = createServer((req, res) => { const name = new URL(req.url, 'http://localhost').pathname.slice(1) || 'sample.html'; if (!['sample.html', 'sample.js', 'sample.css'].includes(name)) { res.writeHead(404).end(); return; } res.setHeader('Content-Type', name.endsWith('.js') ? 'application/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html'); res.end(fs.readFileSync(path.join(root, name))); });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch();
const origin = 'http://127.0.0.1:' + server.address().port;
try {
  for (const [subject, width] of [['math', 1200], ['science', 390]]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } }), requests = [], errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      window.sampleMedia = { starts: 0, stops: 0 };
      Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: async () => { window.sampleMedia.starts++; const track = { enabled: true, stop() { window.sampleMedia.stops++; }, onended: null }; return { getTracks: () => [track], getAudioTracks: () => [track] }; } } });
      window.RTCPeerConnection = class { constructor() { this.iceGatheringState = 'complete'; } addTrack() {} createDataChannel() { return this.channel = { readyState: 'open', send() {}, close() {} }; } async createOffer() { return { type: 'offer', sdp: 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n' }; } async setLocalDescription(value) { this.localDescription = value; } async setRemoteDescription() { setTimeout(() => this.channel.onmessage?.({ data: JSON.stringify({ type: 'session.started' }) }), 1); } close() {} };
    });
    await page.route('**/pdf.min.js', route => route.fulfill({ contentType: 'application/javascript', body: `window.pdfjsLib={GlobalWorkerOptions:{},getDocument(){return {promise:Promise.resolve({numPages:2,async getPage(number){return {getViewport(){return {width:600,height:840}},render({canvasContext:ctx}){ctx.fillStyle='white';ctx.fillRect(0,0,600,840);ctx.fillStyle='black';ctx.font='20px sans-serif';ctx.fillText('Sample question '+number,40,70);return {promise:Promise.resolve()}}}}})}}};` }));
    await page.route('**/studyBuddySample', async route => {
      const body = route.request().postDataJSON(); requests.push(body);
      const response = body.action === 'initialize' ? { token: 'a'.repeat(64), expiresAt: Date.now() + 900000, worksheet: { title: subject + ' worksheet', pdfUrl: 'https://example.test/sample.pdf' } }
        : body.action === 'start' ? { sessionId: 'live-test', sdp: 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n', expiresAt: Date.now() + 300000 }
        : body.action === 'ask' ? { text: '[[focus p1 | Q1 | Sample question]] Try the first step.' } : { stopped: true };
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(response), headers: { 'Access-Control-Allow-Origin': '*' } });
    });
    await page.goto(origin + '/sample.html?subject=' + subject); await page.locator('#liveStatus').filter({ hasText: 'Listening' }).waitFor();
    assert.equal(await page.locator('#liveEnabled').isChecked(), true); assert.equal(requests.filter(r => r.action === 'start').length, 1); assert.ok(requests.every(r => r.subject === subject));
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow');
    const ink = await page.locator('#inkCanvas').boundingBox(); await page.mouse.move(ink.x + 30, ink.y + 80); await page.mouse.down(); await page.mouse.move(ink.x + 90, ink.y + 110); await page.mouse.up();
    await page.locator('#working').fill('My first step'); await page.locator('#question').fill('How do I start?'); await page.locator('#ask').click(); await page.locator('.message').filter({ hasText: 'Try the first step.' }).waitFor();
    const ask = requests.find(r => r.action === 'ask'); assert.equal(ask.working, 'My first step'); assert.equal(ask.page, 1); assert.match(ask.image, /^data:image\/jpeg;base64,/); assert.equal(await page.locator('#conversation').innerText().then(text => text.includes('[[focus')), false);
    await page.locator('#next').click(); await page.locator('#pageLabel').filter({ hasText: 'Page 2 of 2' }).waitFor(); await page.locator('#previous').click(); await page.locator('#pageLabel').filter({ hasText: 'Page 1 of 2' }).waitFor();
    await page.locator('#stop').click(); await page.waitForFunction(() => window.sampleMedia.stops === 1); await page.waitForTimeout(50); assert.equal(requests.filter(r => r.action === 'stop').length, 1); assert.equal(await page.locator('#mute').isVisible(), false);
    await page.locator('#start').click(); await page.locator('#liveStatus').filter({ hasText: 'Listening' }).waitFor(); await page.evaluate(() => dispatchEvent(new PageTransitionEvent('pagehide'))); await page.waitForFunction(() => window.sampleMedia.stops === 2); await page.waitForTimeout(50); assert.equal(requests.filter(r => r.action === 'stop').length, 2, 'The iframe pagehide handler requests cleanup'); assert.deepEqual(errors, []); await page.close();
  }
  const page = await browser.newPage(); await page.route('**/pdf.min.js', route => route.fulfill({ contentType: 'application/javascript', body: '' })); await page.route('**/studyBuddySample', route => route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: { message: 'A sample worksheet will be available here soon.' } }) })); await page.goto(origin + '/sample.html?subject=science'); await page.locator('#notice').filter({ hasText: 'available here soon' }).waitFor(); assert.equal(await page.locator('#workspace').isVisible(), false); await page.close();
  console.log('Sample worksheet browser checks passed: Maths/Science, desktop/mobile, PDF writing, text help, default live mode, media cleanup and unpublished state.');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
