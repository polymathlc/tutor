'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  classifyLink, linkFromPasted, safeUrl, hostAllowed, driveLinksIn, pdfLinksIn, titleOf, confirmFormIn,
  fileNameOf, cleanName, isPdf, fetchPaper, validateBody, createLimiter, createPaperService, driveDownloadUrl,
  MAX_PDF_BYTES
} = require('../paper-fetch-service');
const { APP_ID } = require('../live-service');

const DRIVE_ID = '1qsE4K8AN6ByAQhyPOT_FkYVHe6PL16he';
const PAGE = 'https://sgexam.com/subject/maths/2025-p5-maths-end-of-year-exam-acs-junior-pdf/';
const PDF = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(200, 32), Buffer.from('\n%%EOF')]);
const SG_HTML = '<html><head><title>2025 P5 Maths End of Year Exam ACS Junior pdf - SG Exam Free Test Papers</title></head>' +
  '<body><img src="https://sgexam.com/wp-content/uploads/logo.png">' +
  '<a class="btn" href="https://drive.google.com/uc?export=download&amp;id=' + DRIVE_ID + '">Download Paper</a>' +
  '<a href="https://drive.google.com/uc?export=download&amp;id=' + DRIVE_ID + '">again</a></body></html>';

/* A fake web: url → { status, headers, body } or a function of the url. */
function fakeWeb(routes) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, init });
    let r = routes[url];
    if (typeof r === 'function') r = r(url);
    if (!r) r = { status: 404, body: 'nope' };
    const headers = new Map(Object.entries(r.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
    const body = Buffer.isBuffer(r.body) ? r.body : Buffer.from(String(r.body || ''));
    return {
      status: r.status || 200,
      ok: (r.status || 200) >= 200 && (r.status || 200) < 300,
      headers: { get: k => headers.get(String(k).toLowerCase()) || null },
      body: null,
      arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength)
    };
  };
  return { fetch, calls };
}

test('classifyLink reads every link shape a person is likely to paste', () => {
  assert.deepEqual(classifyLink('https://drive.google.com/file/d/' + DRIVE_ID + '/view?usp=sharing'), { kind: 'drive', id: DRIVE_ID });
  assert.deepEqual(classifyLink('https://drive.google.com/open?id=' + DRIVE_ID), { kind: 'drive', id: DRIVE_ID });
  assert.deepEqual(classifyLink('https://drive.google.com/uc?export=download&id=' + DRIVE_ID), { kind: 'drive', id: DRIVE_ID });
  assert.deepEqual(classifyLink('https://drive.usercontent.google.com/download?id=' + DRIVE_ID + '&export=download'), { kind: 'drive', id: DRIVE_ID });
  assert.deepEqual(classifyLink('https://docs.google.com/document/d/' + DRIVE_ID + '/edit'), { kind: 'gdoc', type: 'document', id: DRIVE_ID });
  assert.deepEqual(classifyLink(PAGE), { kind: 'page', url: PAGE });
  assert.deepEqual(classifyLink('https://sgexam.com/'), { kind: 'home' });
  assert.deepEqual(classifyLink('https://drive.google.com/drive/folders/' + DRIVE_ID), { kind: 'folder' });
  assert.deepEqual(classifyLink('https://sgexam.com/wp-content/uploads/2025/p5.pdf'), { kind: 'pdf', url: 'https://sgexam.com/wp-content/uploads/2025/p5.pdf' });
  // Pasted with words round it (an iPad share sheet does this) or with no https://.
  assert.deepEqual(classifyLink('Download Paper ' + PAGE), { kind: 'page', url: PAGE });
  assert.deepEqual(classifyLink('sgexam.com/subject/maths/x/'), { kind: 'page', url: 'https://sgexam.com/subject/maths/x/' });
});

test('only the fixed hosts, only https, no user info or port', () => {
  for (const bad of ['http://sgexam.com/x/', 'https://evil.example/x.pdf', 'https://sgexam.com.evil.example/x/',
    'https://user:pw@sgexam.com/x/', 'https://sgexam.com:8443/x/', 'https://169.254.169.254/latest/meta-data/',
    'https://localhost/x', 'file:///etc/passwd', 'javascript:alert(1)', '', 'not a link']) {
    assert.equal(classifyLink(bad), null, bad);
  }
  assert.equal(hostAllowed('doc-0s-docs.googleusercontent.com', true), true);
  assert.equal(hostAllowed('doc-0s-docs.googleusercontent.com', false), false);
  assert.equal(hostAllowed('evil.googleusercontent.com.example', true), false);
  assert.equal(safeUrl('https://x.googleusercontent.com/a', false), null);
});

test('linkFromPasted picks the link out of text', () => {
  assert.equal(linkFromPasted('look: ' + PAGE + ' thanks'), PAGE);
  assert.equal(linkFromPasted('(' + PAGE + ').'), PAGE);
  assert.equal(linkFromPasted('nothing here'), '');
});

test('an SG Exam paper page gives its Download Paper Drive link, and its title', () => {
  const links = driveLinksIn(SG_HTML);
  assert.deepEqual(links, [{ kind: 'drive', id: DRIVE_ID }]);
  assert.equal(titleOf(SG_HTML), '2025 P5 Maths End of Year Exam ACS Junior');
  assert.deepEqual(pdfLinksIn('<a href="/wp-content/uploads/a.pdf">x</a><a href="https://evil.example/b.pdf">y</a>', PAGE),
    ['https://sgexam.com/wp-content/uploads/a.pdf']);
});

test('Google’s virus-scan page is read for its confirm form', () => {
  const html = '<form id="download-form" action="https://drive.usercontent.google.com/download" method="get">' +
    '<input type="hidden" name="id" value="' + DRIVE_ID + '"><input type="hidden" name="export" value="download">' +
    '<input type="hidden" name="confirm" value="t"><input type="hidden" name="uuid" value="abc-123"></form>';
  const u = new URL(confirmFormIn(html, 'https://drive.usercontent.google.com/download?id=x'));
  assert.equal(u.hostname, 'drive.usercontent.google.com');
  assert.equal(u.searchParams.get('id'), DRIVE_ID);
  assert.equal(u.searchParams.get('uuid'), 'abc-123');
  assert.equal(confirmFormIn('<p>hello</p>', 'https://drive.google.com/'), null);
});

test('names and PDF sniffing', () => {
  assert.equal(fileNameOf('attachment; filename="P5 Maths SA2.pdf"'), 'P5 Maths SA2');
  assert.equal(fileNameOf("attachment; filename*=UTF-8''P6%20Science%20Prelim.pdf"), 'P6 Science Prelim');
  assert.equal(cleanName('a/b\\c:d.pdf'), 'a b c d');
  assert.equal(isPdf(PDF), true);
  assert.equal(isPdf(Buffer.from('<html>')), false);
});

test('fetchPaper: SG Exam page → Drive → PDF, every hop checked', async () => {
  const web = fakeWeb({
    [PAGE]: { body: SG_HTML, headers: { 'content-type': 'text/html' } },
    [driveDownloadUrl(DRIVE_ID)]: { status: 303, headers: { location: 'https://doc-08-4k-docs.googleusercontent.com/docs/x' } },
    'https://doc-08-4k-docs.googleusercontent.com/docs/x': { body: PDF, headers: { 'content-type': 'application/pdf', 'content-disposition': 'attachment; filename="acs.pdf"' } }
  });
  const got = await fetchPaper(PAGE, { fetch: web.fetch });
  assert.ok(isPdf(got.bytes));
  assert.equal(got.name, '2025 P5 Maths End of Year Exam ACS Junior');
  assert.equal(got.source, 'drive');
  assert.deepEqual(web.calls.map(c => c.url), [PAGE, driveDownloadUrl(DRIVE_ID), 'https://doc-08-4k-docs.googleusercontent.com/docs/x']);
  web.calls.forEach(c => assert.equal(c.init.redirect, 'manual'));
});

test('fetchPaper: a Drive link straight, through the virus-scan form', async () => {
  const form = '<form id="download-form" action="https://drive.usercontent.google.com/download">' +
    '<input type="hidden" name="id" value="' + DRIVE_ID + '"><input type="hidden" name="confirm" value="t"><input type="hidden" name="uuid" value="u1"></form>';
  const web = fakeWeb({
    [driveDownloadUrl(DRIVE_ID)]: { body: form, headers: { 'content-type': 'text/html' } },
    ['https://drive.usercontent.google.com/download?id=' + DRIVE_ID + '&confirm=t&uuid=u1']: { body: PDF, headers: { 'content-disposition': 'attachment; filename="big.pdf"' } }
  });
  const got = await fetchPaper('https://drive.google.com/file/d/' + DRIVE_ID + '/view', { fetch: web.fetch });
  assert.equal(got.name, 'big');
  assert.ok(isPdf(got.bytes));
});

test('fetchPaper refuses a redirect off the list, a private file, a non-PDF and a giant', async () => {
  const off = fakeWeb({ [driveDownloadUrl(DRIVE_ID)]: { status: 302, headers: { location: 'https://evil.example/x' } } });
  await assert.rejects(fetchPaper('https://drive.google.com/open?id=' + DRIVE_ID, { fetch: off.fetch }), { code: 'off_site' });

  const priv = fakeWeb({ [driveDownloadUrl(DRIVE_ID)]: { status: 302, headers: { location: 'https://accounts.google.com/ServiceLogin?x' } } });
  await assert.rejects(fetchPaper('https://drive.google.com/open?id=' + DRIVE_ID, { fetch: priv.fetch }), { code: 'private' });

  const html = fakeWeb({ [driveDownloadUrl(DRIVE_ID)]: { body: '<html>just a page</html>' } });
  await assert.rejects(fetchPaper('https://drive.google.com/open?id=' + DRIVE_ID, { fetch: html.fetch }), { code: 'not_pdf' });

  const big = fakeWeb({ [driveDownloadUrl(DRIVE_ID)]: { body: PDF, headers: { 'content-length': String(MAX_PDF_BYTES + 1) } } });
  await assert.rejects(fetchPaper('https://drive.google.com/open?id=' + DRIVE_ID, { fetch: big.fetch }), { code: 'too_large' });

  const nopaper = fakeWeb({ [PAGE]: { body: '<html><title>x</title>no links</html>' } });
  await assert.rejects(fetchPaper(PAGE, { fetch: nopaper.fetch }), { code: 'no_paper' });

  await assert.rejects(fetchPaper('https://sgexam.com/', { fetch: nopaper.fetch }), { code: 'pick_paper' });
  await assert.rejects(fetchPaper('https://evil.example/x.pdf', { fetch: nopaper.fetch }), { code: 'bad_link' });
  assert.equal(nopaper.calls.length, 1, 'refused links never reach the network');
});

test('validateBody takes the url and nothing else', () => {
  assert.deepEqual(validateBody({ url: PAGE }), { url: PAGE });
  assert.throws(() => validateBody({ url: PAGE, to: 'x' }));
  assert.throws(() => validateBody({}));
  assert.throws(() => validateBody(null));
});

test('the limiter caps an account', () => {
  let t = 0;
  const allow = createLimiter(() => t, 2, 1000);
  assert.equal(allow('a'), true);
  assert.equal(allow('a'), true);
  assert.equal(allow('a'), false);
  assert.equal(allow('b'), true);
  t = 1001;
  assert.equal(allow('a'), true);
});

function fakeRes() {
  const r = { headers: {}, statusCode: 0, body: undefined };
  r.set = (k, v) => { r.headers[k.toLowerCase()] = v; return r; };
  r.status = c => { r.statusCode = c; return r; };
  r.json = b => { r.body = b; return r; };
  r.send = b => { r.body = b; return r; };
  return r;
}
function fakeReq(headers, body) {
  const h = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return { method: 'POST', body, rawBody: Buffer.from(JSON.stringify(body || {})), get: k => h[k.toLowerCase()] };
}

test('the endpoint: origin, sign-in, App Check, then the PDF with its name', async () => {
  const web = fakeWeb({
    [PAGE]: { body: SG_HTML },
    [driveDownloadUrl(DRIVE_ID)]: { body: PDF }
  });
  const svc = createPaperService({
    auth: { verifyIdToken: async t => { if (t !== 'good') throw new Error('bad'); return { uid: 'u1', firebase: { sign_in_provider: 'google.com' } }; } },
    appCheck: { verifyToken: async t => ({ appId: t === 'ac' ? APP_ID : 'other' }) },
    fetch: web.fetch
  });
  const okHeaders = { origin: 'https://polymathlc.github.io', 'content-type': 'application/json', authorization: 'Bearer good', 'x-firebase-appcheck': 'ac' };

  let res = fakeRes();
  await svc.handler(fakeReq({ ...okHeaders, origin: 'https://evil.example' }, { url: PAGE }), res);
  assert.equal(res.statusCode, 403);

  res = fakeRes();
  await svc.handler(fakeReq({ ...okHeaders, authorization: 'Bearer bad' }, { url: PAGE }), res);
  assert.equal(res.statusCode, 401);

  res = fakeRes();
  await svc.handler(fakeReq({ ...okHeaders, 'x-firebase-appcheck': 'nope' }, { url: PAGE }), res);
  assert.equal(res.statusCode, 403);
  assert.equal(web.calls.length, 0, 'nothing is fetched before the caller is known');

  res = fakeRes();
  await svc.handler(fakeReq(okHeaders, { url: PAGE }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['content-type'], 'application/pdf');
  assert.equal(decodeURIComponent(res.headers['x-paper-name']), '2025 P5 Maths End of Year Exam ACS Junior');
  assert.match(res.headers['access-control-expose-headers'], /X-Paper-Name/);
  assert.ok(isPdf(res.body));

  res = fakeRes();
  await svc.handler(fakeReq(okHeaders, { url: 'https://evil.example/x.pdf' }), res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error.code, 'bad_link');
});
