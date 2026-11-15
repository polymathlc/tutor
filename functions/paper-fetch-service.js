'use strict';

/* =====================================================================
   🔎 FIND AN EXAM PAPER — one paper, fetched from a link (v1.91.0)

   Zhi Kai asked to stop "downloading first, then uploading". A web page
   cannot reach into another site open in another tab and take a file out
   of it, and a browser `fetch` of SG Exam or Google Drive is refused by
   CORS. So the app opens the site in a new tab, the person copies the
   paper's link (the page's address, or the "Download Paper" button's
   link), pastes it into Study Buddy, and THIS endpoint fetches that one
   file and hands the PDF back. The browser then uploads it through the
   very same door a picked file goes through (`handleUpload`).

   The rules this file is built on, each of them load-bearing:

   - ONE FILE, THE ONE THE PERSON POINTED AT, ON THEIR PRESS. This is not a
     crawler: nothing here lists a site, follows a link the person did not
     give, or runs on a timer. An SG Exam paper's page is read once, only to
     find the paper's own download link on it.
   - THE HOSTS ARE A FIXED LIST (`START_HOSTS`), compared WHOLE. A server
     that fetches any URL a browser sends is a door into the network it runs
     in (SSRF). Only SG Exam and Google Drive / Docs can be named, and every
     redirect is checked again (`HOP_HOSTS` adds Google's own download
     hosts) — a redirect anywhere else stops the fetch. Plain http is
     refused, and so is a URL carrying a user name, a password or a port.
   - THE ANSWER MUST BE A PDF. The bytes are checked for `%PDF-` at the
     front, whatever the headers say, and the size is capped at
     `MAX_PDF_BYTES` while it streams in, so a huge file is stopped before
     it is held in memory.
   - A PRIVATE FILE IS SAID TO BE PRIVATE. Google answering with its
     sign-in page means the file is not shared publicly; that is reported in
     plain words rather than as "not a PDF".
   - SIGNED-IN USERS OF THIS APP ONLY, with App Check, from this app's
     origins, and a ceiling per account (`PER_WINDOW` in `WINDOW_MS`), the
     rules every endpoint here carries.
   ===================================================================== */

const { APP_ID, allowedOrigin } = require('./live-service');
const { CentreError, isSupportedStudent } = require('./centre-auth');

const START_HOSTS = Object.freeze([
  'sgexam.com', 'www.sgexam.com',
  'drive.google.com', 'docs.google.com', 'drive.usercontent.google.com'
]);
const HOP_HOSTS = Object.freeze(START_HOSTS.slice());
const SITE_HOSTS = Object.freeze(['sgexam.com', 'www.sgexam.com']);
const MAX_REQUEST_BYTES = 4000;
const MAX_URL = 2000;
const MAX_PAGE_BYTES = 3 * 1024 * 1024;
const MAX_PDF_BYTES = 30 * 1024 * 1024;   // a Cloud Functions reply is capped at 32 MB
const MAX_HOPS = 6;
const FETCH_MS = 45000;
const WINDOW_MS = 10 * 60 * 1000;
const PER_WINDOW = 20;
const DRIVE_ID = /^[A-Za-z0-9_-]{10,200}$/;
const NAME_MAX = 120;
const USER_AGENT = 'StudyBuddy-PaperImport/1.0';

class PaperError extends CentreError {}

const plain = value => !!value && typeof value === 'object' && !Array.isArray(value);

/* Is this a host we may be sent to? Exact names, plus any
   `*.googleusercontent.com` for a hop (that is where Drive serves bytes
   from), never as the link the person pastes. */
function hostAllowed(host, hop) {
  const h = String(host || '').toLowerCase();
  if (START_HOSTS.includes(h)) return true;
  if (hop && (HOP_HOSTS.includes(h) || /^[a-z0-9-]+\.googleusercontent\.com$/.test(h))) return true;
  return false;
}

/* The one place a URL string becomes a URL we may fetch. */
function safeUrl(raw, hop) {
  if (typeof raw !== 'string') return null;
  const text = raw.trim();
  if (!text || text.length > MAX_URL) return null;
  let u;
  try { u = new URL(text); } catch { return null; }
  if (u.protocol !== 'https:' || u.username || u.password || u.port) return null;
  if (!hostAllowed(u.hostname, hop)) return null;
  u.hash = '';
  return u;
}

/* Pull a link out of whatever was pasted: "Download Paper https://…" from a
   share sheet, a link with spaces round it, a link with no https:// on it. */
function linkFromPasted(raw) {
  if (typeof raw !== 'string') return '';
  const text = raw.trim();
  const m = /https?:\/\/[^\s"'<>]+/i.exec(text);
  if (m) return m[0].replace(/[).,;]+$/, '');
  if (/^(www\.)?(sgexam\.com|drive\.google\.com|docs\.google\.com)\//i.test(text)) return 'https://' + text.split(/\s/)[0];
  return '';
}

/* What a link IS. Pure, so the harness pins every shape a person is likely
   to paste:
     drive.google.com/file/d/ID/view, /open?id=ID, /uc?id=ID&export=download,
     drive.usercontent.google.com/download?id=ID,
     docs.google.com/document|presentation|spreadsheets/d/ID/… (exported as PDF),
     an SG Exam page (read once for its download link),
     an SG Exam .pdf file. */
function classifyLink(raw) {
  const u = safeUrl(linkFromPasted(raw) || raw, false);
  if (!u) return null;
  const host = u.hostname.toLowerCase();
  const path = u.pathname;
  if (host === 'drive.google.com' || host === 'drive.usercontent.google.com') {
    let id = '';
    const m = /^\/file\/d\/([^/]+)/.exec(path);
    if (m) id = m[1];
    else id = u.searchParams.get('id') || '';
    if (/^\/drive\/folders\//.test(path)) return { kind: 'folder' };
    return DRIVE_ID.test(id) ? { kind: 'drive', id } : null;
  }
  if (host === 'docs.google.com') {
    const m = /^\/(document|presentation|spreadsheets)\/d\/([^/]+)/.exec(path);
    if (m && DRIVE_ID.test(m[2])) return { kind: 'gdoc', type: m[1], id: m[2] };
    const f = /^\/file\/d\/([^/]+)/.exec(path);
    if (f && DRIVE_ID.test(f[1])) return { kind: 'drive', id: f[1] };
    const id = u.searchParams.get('id') || '';
    return DRIVE_ID.test(id) ? { kind: 'drive', id } : null;
  }
  if (SITE_HOSTS.includes(host)) {
    if (/\.pdf$/i.test(path)) return { kind: 'pdf', url: u.toString() };
    if (path === '/' || path === '') return { kind: 'home' };
    return { kind: 'page', url: u.toString() };
  }
  return null;
}

/* Where Drive serves a file's bytes. `confirm=t` skips the "can't scan this
   for viruses" page Google shows for larger files. */
function driveDownloadUrl(id) {
  return 'https://drive.usercontent.google.com/download?id=' + encodeURIComponent(id) + '&export=download&confirm=t';
}
function gdocExportUrl(type, id) {
  if (type === 'spreadsheets') return 'https://docs.google.com/spreadsheets/d/' + encodeURIComponent(id) + '/export?format=pdf';
  return 'https://docs.google.com/' + type + '/d/' + encodeURIComponent(id) + '/export?format=pdf';
}

function decodeEntities(s) {
  return String(s)
    .replace(/&amp;/g, '&').replace(/&#0*38;/g, '&').replace(/&#x0*26;/gi, '&')
    .replace(/&quot;/g, '"').replace(/&#0*39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\\u0026/g, '&').replace(/\\\//g, '/');
}

/* Every Google Drive / Docs file named on an HTML page, in the order the
   page names them, without repeats. On an SG Exam paper's page the first is
   its "Download Paper" button. */
function driveLinksIn(html) {
  const text = decodeEntities(html || '');
  const out = [];
  const seen = new Set();
  const re = /https?:\/\/(?:drive\.google\.com|docs\.google\.com|drive\.usercontent\.google\.com)\/[^\s"'<>)]+/gi;
  let m;
  while ((m = re.exec(text))) {
    const c = classifyLink(m[0].replace(/^http:/i, 'https:'));
    if (!c || (c.kind !== 'drive' && c.kind !== 'gdoc')) continue;
    const key = c.kind + ':' + c.id;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

/* A PDF linked straight from the page (an SG Exam upload), same site only. */
function pdfLinksIn(html, base) {
  const text = decodeEntities(html || '');
  const out = [];
  const re = /href\s*=\s*["']([^"']+\.pdf(?:\?[^"']*)?)["']/gi;
  let m;
  while ((m = re.exec(text))) {
    let u;
    try { u = new URL(m[1], base); } catch { continue; }
    if (u.protocol !== 'https:' || !SITE_HOSTS.includes(u.hostname.toLowerCase())) continue;
    if (!out.includes(u.toString())) out.push(u.toString());
  }
  return out;
}

/* The page's own title, which on SG Exam is the paper's name. */
function titleOf(html) {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html || '');
  if (!m) return '';
  return cleanName(decodeEntities(m[1]).split(/\s+[|–—-]\s+(?:SG ?Exam|Free Test Papers).*$/i)[0]);
}

/* Google's "can't scan this file for viruses" page is a form. Read its
   action and hidden fields so the download can go ahead. */
function confirmFormIn(html, base) {
  const text = html || '';
  const form = /<form[^>]+id=["']download-form["'][^>]*>([\s\S]*?)<\/form>/i.exec(text) ||
    /<form[^>]+action=["'][^"']*download[^"']*["'][^>]*>([\s\S]*?)<\/form>/i.exec(text);
  if (!form) {
    const href = /href=["']([^"']*\/uc\?export=download[^"']*confirm=[^"']+)["']/i.exec(text);
    if (!href) return null;
    try { return new URL(decodeEntities(href[1]), base).toString(); } catch { return null; }
  }
  const action = /action=["']([^"']+)["']/i.exec(form[0]);
  if (!action) return null;
  let u;
  try { u = new URL(decodeEntities(action[1]), base); } catch { return null; }
  const re = /<input[^>]+type=["']hidden["'][^>]*>/gi;
  let m;
  while ((m = re.exec(form[1]))) {
    const name = /name=["']([^"']+)["']/i.exec(m[0]);
    const value = /value=["']([^"']*)["']/i.exec(m[0]);
    if (name) u.searchParams.set(decodeEntities(name[1]), value ? decodeEntities(value[1]) : '');
  }
  return u.toString();
}

function cleanName(value) {
  if (typeof value !== 'string') return '';
  const folded = value.replace(/[\u0000-\u001F\u007F]+/g, ' ').replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ').replace(/\.pdf$/i, '').replace(/\s+pdf$/i, '').trim();
  return folded.length > NAME_MAX ? folded.slice(0, NAME_MAX).trim() : folded;
}

/* The file name Google or the site gave the download, if any. */
function fileNameOf(disposition) {
  const d = String(disposition || '');
  const star = /filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/.exec(d);
  if (star) { try { return cleanName(decodeURIComponent(star[1].trim().replace(/^"|"$/g, ''))); } catch { /* fall through */ } }
  const plainName = /filename\s*=\s*"([^"]+)"/.exec(d) || /filename\s*=\s*([^;]+)/.exec(d);
  return plainName ? cleanName(plainName[1].trim()) : '';
}

function isPdf(bytes) {
  return !!bytes && bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2D;
}

/* Read a body up to `max` bytes, refusing (not truncating) a bigger one. */
async function readCapped(res, max) {
  const declared = Number(res.headers.get('content-length') || 0);
  if (declared && declared > max) throw new PaperError(413, 'too_large', 'That paper is too big to bring in (over ' + Math.round(max / 1048576) + ' MB).');
  if (!res.body || typeof res.body.getReader !== 'function') {
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > max) throw new PaperError(413, 'too_large', 'That paper is too big to bring in.');
    return buf;
  }
  const reader = res.body.getReader();
  const parts = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > max) {
      try { await reader.cancel(); } catch { /* ignore */ }
      throw new PaperError(413, 'too_large', 'That paper is too big to bring in (over ' + Math.round(max / 1048576) + ' MB).');
    }
    parts.push(Buffer.from(value));
  }
  return Buffer.concat(parts, total);
}

/* One GET, following redirects BY HAND so every hop's host is checked. */
async function getChecked(fetchImpl, startUrl, signal) {
  let url = safeUrl(startUrl, true);
  if (!url) throw new PaperError(400, 'bad_link', 'That link is not one Study Buddy can bring a paper in from.');
  for (let hop = 0; hop <= MAX_HOPS; hop++) {
    const res = await fetchImpl(url.toString(), {
      method: 'GET', redirect: 'manual', signal,
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/pdf,text/html;q=0.8,*/*;q=0.5' }
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) throw new PaperError(502, 'fetch_failed', 'The site sent the paper somewhere it did not say.');
      let next;
      try { next = new URL(loc, url); } catch { next = null; }
      if (next && /(^|\.)accounts\.google\.com$/i.test(next.hostname)) {
        throw new PaperError(403, 'private', 'That file is private on Google Drive, so it cannot be brought in. Download it and upload it instead.');
      }
      const ok = next && safeUrl(next.toString(), true);
      if (!ok) throw new PaperError(502, 'off_site', 'The link went to a site Study Buddy does not fetch from.');
      url = ok;
      continue;
    }
    return { res, url };
  }
  throw new PaperError(502, 'fetch_failed', 'The link went round in circles.');
}

/* Fetch the PDF behind one link. `deps.fetch` is injected so the harness
   drives it with a fake web. Returns { bytes, name, source }. */
async function fetchPaper(rawLink, deps = {}) {
  const fetchImpl = deps.fetch || globalThis.fetch;
  const signal = deps.signal;
  const link = linkFromPasted(rawLink) || (typeof rawLink === 'string' ? rawLink.trim() : '');
  const c = classifyLink(link);
  if (!c) throw new PaperError(400, 'bad_link', 'Paste the link of one paper from SG Exam, or a Google Drive link to a PDF.');
  if (c.kind === 'home') throw new PaperError(400, 'pick_paper', 'That is SG Exam’s front page. Open one paper first, then copy its link.');
  if (c.kind === 'folder') throw new PaperError(400, 'folder', 'That is a whole Google Drive folder. Open one paper in it and copy that link.');

  let name = '';
  let target = c;
  if (c.kind === 'page') {
    const { res } = await getChecked(fetchImpl, c.url, signal);
    if (res.status === 404) throw new PaperError(404, 'not_found', 'That page was not found on SG Exam.');
    if (res.status === 403 || res.status === 429 || res.status === 503) {
      throw new PaperError(502, 'site_refused', 'SG Exam would not let Study Buddy read that page just now. Try again in a minute, or download and upload it.');
    }
    if (!res.ok) throw new PaperError(502, 'fetch_failed', 'SG Exam did not answer properly (' + res.status + ').');
    const buf = await readCapped(res, MAX_PAGE_BYTES);
    if (isPdf(buf)) return { bytes: buf, name: cleanName(decodeURIComponent(c.url.split('/').pop() || '')) || 'Exam paper', source: 'sgexam' };
    const html = buf.toString('utf8');
    name = titleOf(html);
    const drives = driveLinksIn(html);
    const pdfs = pdfLinksIn(html, c.url);
    if (drives.length) target = drives[0];
    else if (pdfs.length) target = { kind: 'pdf', url: pdfs[0] };
    else throw new PaperError(404, 'no_paper', 'No paper was found on that page. Open the paper’s own page (the one with “Download Paper”) and copy its link.');
  }

  let fileUrl;
  if (target.kind === 'drive') fileUrl = driveDownloadUrl(target.id);
  else if (target.kind === 'gdoc') fileUrl = gdocExportUrl(target.type, target.id);
  else fileUrl = target.url;

  for (let attempt = 0; attempt < 2; attempt++) {
    const { res, url } = await getChecked(fetchImpl, fileUrl, signal);
    if (res.status === 404) throw new PaperError(404, 'not_found', 'That file was not found. It may have been removed.');
    if (res.status === 401 || res.status === 403) {
      throw new PaperError(403, 'private', 'That file is private, so it cannot be brought in. Download it and upload it instead.');
    }
    if (res.status === 429) throw new PaperError(429, 'site_busy', 'Google Drive is busy with that file just now. Try again in a few minutes.');
    if (!res.ok) throw new PaperError(502, 'fetch_failed', 'The file did not come back properly (' + res.status + ').');
    const bytes = await readCapped(res, MAX_PDF_BYTES);
    if (isPdf(bytes)) {
      const fromHeader = fileNameOf(res.headers.get('content-disposition'));
      return { bytes, name: name || fromHeader || 'Exam paper', source: target.kind === 'pdf' ? 'sgexam' : 'drive' };
    }
    const html = bytes.toString('utf8');
    // Google's sign-in page in place of the file.
    if (/accounts\.google\.com\/(?:ServiceLogin|v3\/signin)/i.test(html) || /<title>\s*Google Drive:\s*Sign-in/i.test(html)) {
      throw new PaperError(403, 'private', 'That file is private on Google Drive, so it cannot be brought in. Download it and upload it instead.');
    }
    if (/quota exceeded|too many users have viewed or downloaded/i.test(html)) {
      throw new PaperError(429, 'site_busy', 'Google Drive says too many people downloaded that file today. Try again tomorrow, or download and upload it.');
    }
    const next = attempt === 0 ? confirmFormIn(html, url) : null;
    if (next && safeUrl(next, true)) { fileUrl = next; continue; }
    throw new PaperError(415, 'not_pdf', 'That link is not a PDF. Study Buddy can bring in PDF papers only.');
  }
  throw new PaperError(415, 'not_pdf', 'That link is not a PDF.');
}

function validateBody(body) {
  if (!plain(body)) throw new PaperError(400, 'invalid_request', 'Send the paper’s link.');
  const keys = Object.keys(body);
  if (keys.length !== 1 || keys[0] !== 'url' || typeof body.url !== 'string' || !body.url.trim() || body.url.length > MAX_URL) {
    throw new PaperError(400, 'invalid_request', 'Send the paper’s link.');
  }
  return { url: body.url };
}

/* A small ceiling per account per instance. The endpoint runs on at most a
   few instances, so this bounds an account to a few dozen fetches in ten
   minutes, which is more than a person bringing papers in by hand needs. */
function createLimiter(now = Date.now, per = PER_WINDOW, windowMs = WINDOW_MS) {
  const seen = new Map();
  return function allow(uid) {
    const t = now();
    const list = (seen.get(uid) || []).filter(x => t - x < windowMs);
    if (list.length >= per) { seen.set(uid, list); return false; }
    list.push(t);
    seen.set(uid, list);
    if (seen.size > 5000) for (const k of seen.keys()) { seen.delete(k); if (seen.size <= 4000) break; }
    return true;
  };
}

function createPaperService({ auth, appCheck, fetch: fetchImpl = globalThis.fetch, now = Date.now, report = () => {}, limiter } = {}) {
  const allow = limiter || createLimiter(now);
  async function identify(req) {
    const match = /^Bearer ([^\s]+)$/.exec(req.get('authorization') || '');
    if (!match) throw new PaperError(401, 'sign_in_required', 'Sign in to bring in a paper.');
    let user;
    try { user = await auth.verifyIdToken(match[1], true); }
    catch { throw new PaperError(401, 'sign_in_required', 'Sign in again to bring in a paper.'); }
    if (!isSupportedStudent(user, now())) throw new PaperError(403, 'account_required', 'Sign in with your Study Buddy account to bring in a paper.');
    try {
      const token = req.get('x-firebase-appcheck');
      if (!token || (await appCheck.verifyToken(token)).appId !== APP_ID) throw new Error('wrong app');
    } catch { throw new PaperError(403, 'app_check_required', 'Refresh the page to verify this device.'); }
    return user;
  }
  async function handler(req, res) {
    res.set('Cache-Control', 'no-store'); res.set('Vary', 'Origin');
    const origin = req.get('origin');
    if (!allowedOrigin(origin)) return res.status(403).json({ error: { code: 'origin_not_allowed', message: 'Bring papers in from Study Buddy.' } });
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Firebase-AppCheck');
    res.set('Access-Control-Expose-Headers', 'X-Paper-Name, X-Paper-Source');
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'POST') return res.status(405).json({ error: { code: 'method_not_allowed', message: 'Use POST.' } });
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = setTimeout(() => { if (controller) controller.abort(); }, FETCH_MS);
    try {
      if (!/^application\/json(?:;|$)/i.test(req.get('content-type') || '')) throw new PaperError(415, 'invalid_request', 'Send the link as JSON.');
      if ((req.rawBody?.length || 0) > MAX_REQUEST_BYTES) throw new PaperError(413, 'invalid_request', 'That request is too large.');
      const body = validateBody(req.body);
      const user = await identify(req);
      if (!allow(user.uid)) throw new PaperError(429, 'too_many', 'That is a lot of papers in a short time. Wait a few minutes and try again.');
      const paper = await fetchPaper(body.url, { fetch: fetchImpl, signal: controller ? controller.signal : undefined });
      res.set('Content-Type', 'application/pdf');
      res.set('X-Paper-Name', encodeURIComponent(paper.name || 'Exam paper'));
      res.set('X-Paper-Source', paper.source);
      return res.status(200).send(paper.bytes);
    } catch (error) {
      if (error instanceof CentreError) return res.status(error.status).json({ error: { code: error.code, message: error.message } });
      if (error && error.name === 'AbortError') {
        return res.status(504).json({ error: { code: 'timeout', message: 'The site took too long to send the paper. Try again.' } });
      }
      report('paper_fetch_failed');
      return res.status(502).json({ error: { code: 'fetch_failed', message: 'The paper could not be fetched just now. Try again, or download and upload it.' } });
    } finally {
      clearTimeout(timer);
    }
  }
  return { handler };
}

module.exports = {
  START_HOSTS, HOP_HOSTS, SITE_HOSTS, MAX_PDF_BYTES, MAX_PAGE_BYTES, MAX_HOPS, PER_WINDOW, WINDOW_MS,
  PaperError, hostAllowed, safeUrl, linkFromPasted, classifyLink, driveDownloadUrl, gdocExportUrl,
  driveLinksIn, pdfLinksIn, titleOf, confirmFormIn, cleanName, fileNameOf, isPdf, readCapped,
  fetchPaper, validateBody, createLimiter, createPaperService
};
