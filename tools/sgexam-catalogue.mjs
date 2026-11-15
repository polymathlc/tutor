// 📚 THE SG EXAM PAPER LIST — collected once a week, read by 🔎 Find exam paper.
//
// "Crawl sgexam.com and save the links and descriptions of the exam files,
// starting from 2026 papers and working backwards, so Find exam paper just
// loads the link." — Zhi Kai, Nov 15 2026.
//
// WHAT IT KEEPS: a LINK and the words describing it (year, level, subject,
// exam, school). Never a copy of a paper. The PDF is fetched only when a
// person taps one, by the `studyBuddyPaper` function, exactly as if they had
// pasted that link (functions/paper-fetch-service.js resolves an SG Exam page
// to its Google Drive file).
//
// HOW IT ASKS: robots.txt first (a Disallow covering a page we want stops
// that page), then the level × subject listing pages ONE AT A TIME with
// CRAWL_GAP_MS between them. About thirty requests a week: a reader
// browsing the site makes more. The listing pages hold every year, newest
// first, so the list is ordered 2026 and back by sorting, not by walking.
//
// IT REFUSES TO SHRINK THE LIST: a run that finds under MIN_KEEP_RATIO of
// the papers already saved (the site changed its layout, or was down) keeps
// the old file and fails loudly, so a bad week never empties the picker.
//
// Pure parts are exported for tools/sgexam-catalogue-tests.mjs; running the
// file does the crawl:  node tools/sgexam-catalogue.mjs [--out papers/sgexam.json]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const SITE = 'https://sgexam.com/';
export const USER_AGENT = 'StudyBuddyPaperList/1.0 (weekly list of paper links; no files kept)';
export const CRAWL_GAP_MS = 4000;
export const MIN_PAPERS = 50;
export const MIN_KEEP_RATIO = 0.6;

export const LEVELS = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];
/* SG Exam's subject slugs → this app's subject ids (`SUBJECTS` in index.html).
   Higher Chinese is kept apart as its own label but files under chinese. */
export const SUBJECT_SLUGS = {
  english: { app: 'english', label: 'English' },
  maths: { app: 'math', label: 'Maths' },
  science: { app: 'science', label: 'Science' },
  chinese: { app: 'chinese', label: 'Chinese' },
  'higher-chinese': { app: 'chinese', label: 'Higher Chinese' }
};

/* The listing pages, as the front page links them: /primary-6-maths/ … */
export function listingPages(html) {
  const out = [];
  const seen = new Set();
  const re = /https?:\/\/(?:www\.)?sgexam\.com\/primary-([1-6])-(english|maths|science|higher-chinese|chinese)\/?/gi;
  let m;
  while ((m = re.exec(html || ''))) {
    const key = m[1] + ':' + m[2].toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ url: SITE + 'primary-' + m[1] + '-' + m[2].toLowerCase() + '/', level: 'P' + m[1], slug: m[2].toLowerCase() });
  }
  return out;
}

/* Every listing page we know of, for when the front page cannot be read. */
export function defaultListingPages() {
  const out = [];
  for (let n = 6; n >= 1; n--) {
    for (const slug of Object.keys(SUBJECT_SLUGS)) {
      if (slug === 'science' && n < 3) continue;
      out.push({ url: SITE + 'primary-' + n + '-' + slug + '/', level: 'P' + n, slug });
    }
  }
  return out;
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', hellip: '…' };
export function decodeEntities(s) {
  return String(s || '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, code) => {
    if (code[0] === '#') {
      const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : all;
    }
    const k = code.toLowerCase();
    return Object.prototype.hasOwnProperty.call(ENTITIES, k) ? ENTITIES[k] : all;
  });
}

function textOf(html) {
  return decodeEntities(String(html || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/* "2026-P6-Maths-Prelim Exam-ACS Junior.pdf" → its parts. Some older names
   carry no extension, some use spaces round the dashes, a few put the school
   before the exam; anything that does not start with a year is not a paper. */
export function parseTitle(raw) {
  let t = textOf(raw).replace(/\.pdf$/i, '').trim();
  const m = /^((?:19|20)\d\d)\s*-\s*P\s*([1-6])\s*-\s*(.+)$/i.exec(t);
  if (!m) return null;
  const year = Number(m[1]);
  const level = 'P' + m[2];
  const parts = m[3].split(/\s*-\s*/).map(x => x.trim()).filter(Boolean);
  let subject = '';
  if (parts.length && /^(higher\s*chinese|hcl|chinese|cl|english|eng|maths?|mathematics|science|sci)$/i.test(parts[0])) {
    subject = parts.shift();
  }
  const exam = parts.length > 1 ? parts.slice(0, -1).join(' - ') : (parts[0] || '');
  const school = parts.length > 1 ? parts[parts.length - 1] : '';
  return { year, level, subjectWord: subject, exam, school, title: t };
}

/* Which links on a listing page are papers. Kept: a link on SG Exam itself
   (a paper's own page, or a PDF it hosts) or a Google Drive / Docs file,
   whose words OR address start with a year and a level. */
export function paperLinksIn(html, page) {
  const out = [];
  const seen = new Set();
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html || ''))) {
    const hrefM = /\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(m[1]);
    if (!hrefM) continue;
    let href = decodeEntities(hrefM[2] ?? hrefM[3] ?? hrefM[4] ?? '').trim();
    let u;
    try { u = new URL(href, page.url); } catch { continue; }
    if (u.protocol === 'http:') u.protocol = 'https:';
    if (u.protocol !== 'https:') continue;
    const host = u.hostname.toLowerCase();
    const onSite = host === 'sgexam.com' || host === 'www.sgexam.com';
    const onDrive = host === 'drive.google.com' || host === 'docs.google.com' || host === 'drive.usercontent.google.com';
    if (!onSite && !onDrive) continue;
    if (onSite && (/^\/(primary-[1-6]-[a-z-]+\/?)?$/.test(u.pathname) || /^\/(wp-|tag\/|category\/|page\/|feed)/.test(u.pathname))) continue;
    u.hash = '';
    const words = textOf(m[2]);
    let slugWords = '';
    try { slugWords = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() || '').replace(/[-_]+/g, ' '); } catch { slugWords = ''; }
    let p = parseTitle(words);
    if (!p && onSite) {
      // A link whose words are a button ("Download") still names the paper in its address.
      const s = /^((?:19|20)\d\d)\s+p\s*([1-6])\s+(.+)$/i.exec(slugWords.replace(/\s+pdf$/i, ''));
      if (s) p = parseTitle(s[1] + '-P' + s[2] + '-' + s[3]);
    }
    if (!p || p.level !== page.level) continue;
    const url = u.toString();
    if (seen.has(url)) continue;
    seen.add(url);
    const sub = SUBJECT_SLUGS[page.slug];
    out.push({
      t: p.title, u: url, y: p.year, l: p.level, s: sub.app, sl: sub.label,
      e: p.exam, sc: p.school
    });
  }
  return out;
}

/* robots.txt, read the simple way: the groups for "*" and for our own name,
   Disallow / Allow prefixes, longest match wins. No file = everything allowed. */
export function robotsRules(txt) {
  const rules = [];
  let applies = false;
  let inGroupHead = false;
  for (const raw of String(txt || '').split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === 'user-agent') {
      const mine = val === '*' || /studybuddypaperlist/i.test(val);
      applies = inGroupHead ? (applies || mine) : mine;
      inGroupHead = true;
      continue;
    }
    inGroupHead = false;
    if (!applies) continue;
    if (key === 'disallow' || key === 'allow') rules.push({ allow: key === 'allow', path: val });
  }
  return rules;
}
export function robotsAllows(rules, path) {
  let best = null;
  for (const r of rules || []) {
    if (!r.path) continue;                        // "Disallow:" with nothing = allow all
    const prefix = r.path.replace(/\*.*$/, '').replace(/\$$/, '');
    if (!path.startsWith(prefix)) continue;
    if (!best || prefix.length > best.len || (prefix.length === best.len && r.allow)) best = { len: prefix.length, allow: r.allow };
  }
  return best ? best.allow : true;
}

/* Newest first; then P6 → P1; then subject; then exam and school. */
export function sortPapers(list) {
  const so = { english: 0, math: 1, science: 2, chinese: 3 };
  return list.slice().sort((a, b) =>
    (b.y - a.y) || (b.l.localeCompare(a.l)) || ((so[a.s] ?? 9) - (so[b.s] ?? 9)) ||
    a.sl.localeCompare(b.sl) || a.e.localeCompare(b.e) || a.sc.localeCompare(b.sc) || a.u.localeCompare(b.u));
}

export function catalogueOf(papers, at) {
  const seen = new Set();
  const kept = [];
  for (const p of sortPapers(papers)) {
    if (seen.has(p.u)) continue;
    seen.add(p.u);
    kept.push(p);
  }
  return { source: SITE, fetchedAt: at, count: kept.length, papers: kept };
}

/* ---------------- the crawl ---------------- */
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function get(url) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,text/plain' }, redirect: 'follow' });
  return { status: res.status, text: res.status === 200 ? await res.text() : '' };
}

async function crawl(outPath) {
  const robots = await get(SITE + 'robots.txt').catch(() => ({ status: 0, text: '' }));
  const rules = robots.status === 200 ? robotsRules(robots.text) : [];
  console.log('robots.txt:', robots.status, rules.length + ' rule(s) for us');
  await sleep(CRAWL_GAP_MS);

  let pages = [];
  if (robotsAllows(rules, '/')) {
    const home = await get(SITE).catch(() => ({ status: 0, text: '' }));
    pages = listingPages(home.text);
    console.log('front page:', home.status, pages.length + ' listing page(s)');
    await sleep(CRAWL_GAP_MS);
  }
  if (pages.length < 10) pages = defaultListingPages();

  const papers = [];
  const diag = [];
  for (const page of pages) {
    const path = new URL(page.url).pathname;
    if (!robotsAllows(rules, path)) { console.log('skipped (robots.txt):', path); continue; }
    let got;
    try { got = await get(page.url); } catch (e) { got = { status: 0, text: '' }; }
    const found = got.status === 200 ? paperLinksIn(got.text, page) : [];
    console.log(path, got.status, found.length + ' paper(s)');
    papers.push(...found);
    if (!found.length && got.text && diag.length < 1) diag.push({ path, html: got.text });
    await sleep(CRAWL_GAP_MS);
  }

  const cat = catalogueOf(papers, new Date().toISOString());
  console.log('papers found:', cat.count);
  const before = existsSync(outPath) ? (JSON.parse(readFileSync(outPath, 'utf8')).count || 0) : 0;
  if (cat.count < MIN_PAPERS || cat.count < before * MIN_KEEP_RATIO) {
    // Say what the page looked like, so the parser can be fixed from the log.
    for (const d of diag) {
      console.log('--- links on', d.path, '(first 40) ---');
      const re = /<a\b[^>]*>[\s\S]*?<\/a>/gi;
      let m, n = 0;
      while ((m = re.exec(d.html)) && n < 40) { console.log(m[0].replace(/\s+/g, ' ').slice(0, 300)); n++; }
    }
    console.error(`Only ${cat.count} papers (had ${before}); the saved list was left as it was.`);
    process.exit(1);
  }
  writeFileSync(outPath, JSON.stringify(cat) + '\n');
  console.log('wrote', outPath);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const i = process.argv.indexOf('--out');
  crawl(i > 0 ? process.argv[i + 1] : 'papers/sgexam.json').catch(e => { console.error(e); process.exit(1); });
}
