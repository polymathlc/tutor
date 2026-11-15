// node --test tools/sgexam-catalogue-tests.mjs — the SG Exam paper list's pure parts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  parseTitle, paperLinksIn, listingPages, defaultListingPages, robotsRules, robotsAllows,
  catalogueOf, sortPapers, decodeEntities
} from './sgexam-catalogue.mjs';

const P6M = { url: 'https://sgexam.com/primary-6-maths/', level: 'P6', slug: 'maths' };

test('a paper name is read into its parts', () => {
  const p = parseTitle('2026-P6-Maths-Prelim Exam-ACS Junior.pdf');
  assert.deepEqual([p.year, p.level, p.subjectWord, p.exam, p.school], [2026, 'P6', 'Maths', 'Prelim Exam', 'ACS Junior']);
  assert.equal(p.title, '2026-P6-Maths-Prelim Exam-ACS Junior');
  const q = parseTitle('2016-P6-Maths-SA1-CHIJ');
  assert.deepEqual([q.year, q.exam, q.school], [2016, 'SA1', 'CHIJ']);
  assert.equal(parseTitle('Download Paper'), null);
  assert.equal(parseTitle('Primary 6 Maths'), null);
});

test('links on a listing page: papers kept, menus and other sites dropped', () => {
  const html = `
    <a href="https://sgexam.com/primary-6-maths/">P6 Maths</a>
    <a href="https://sgexam.com/">Home</a>
    <a href="https://sgexam.com/subject/maths/2026-p6-maths-prelim-exam-acs-junior-pdf/"><strong><code>2026-P6-Maths-Prelim Exam-ACS Junior.pdf</code></strong></a>
    <a href='https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUv/view'>2025-P6-Maths-Prelim Exam-Ai Tong.pdf</a>
    <a href="https://evil.example/2025-P6-Maths-SA2-X.pdf">2025-P6-Maths-SA2-X.pdf</a>
    <a href="https://sgexam.com/subject/maths/2024-p6-maths-sa2-nan-hua-pdf/">Download</a>
    <a href="https://sgexam.com/subject/maths/2024-p5-maths-sa2-nan-hua-pdf/">2024-P5-Maths-SA2-Nan Hua.pdf</a>
    <a href="https://sgexam.com/wp-content/uploads/2020/01/x.pdf">2020-P6-Maths-SA2-Rosyth.pdf</a>
    <a href="https://sgexam.com/subject/maths/2026-p6-maths-prelim-exam-acs-junior-pdf/#x">2026-P6-Maths-Prelim Exam-ACS Junior.pdf</a>`;
  const got = paperLinksIn(html, P6M);
  assert.deepEqual(got.map(p => p.u), [
    'https://sgexam.com/subject/maths/2026-p6-maths-prelim-exam-acs-junior-pdf/',
    'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUv/view',
    'https://sgexam.com/subject/maths/2024-p6-maths-sa2-nan-hua-pdf/'
  ], 'other sites, other levels, wp- uploads and duplicates are not papers here');
  assert.deepEqual(got[0], { t: '2026-P6-Maths-Prelim Exam-ACS Junior', u: got[0].u, y: 2026, l: 'P6', s: 'math', sl: 'Maths', e: 'Prelim Exam', sc: 'ACS Junior' });
  assert.equal(got[2].y, 2024, 'a "Download" button still names its paper in the address');
});

test('Higher Chinese is its own label and files under chinese', () => {
  const got = paperLinksIn('<a href="/subject/hcl/2025-p5-hcl">2025-P5-Higher Chinese-SA2-Tao Nan.pdf</a>',
    { url: 'https://sgexam.com/primary-5-higher-chinese/', level: 'P5', slug: 'higher-chinese' });
  assert.equal(got.length, 1);
  assert.equal(got[0].s, 'chinese');
  assert.equal(got[0].sl, 'Higher Chinese');
  assert.equal(got[0].u, 'https://sgexam.com/subject/hcl/2025-p5-hcl', 'a relative link is made whole');
});

test('the listing pages come off the front page, once each', () => {
  const pages = listingPages('<a href="https://sgexam.com/primary-6-maths/">x</a><a href="https://sgexam.com/primary-6-maths/">y</a><a href="https://sgexam.com/primary-5-higher-chinese/">z</a>');
  assert.deepEqual(pages.map(p => [p.level, p.slug]), [['P6', 'maths'], ['P5', 'higher-chinese']]);
  const all = defaultListingPages();
  assert.equal(all.length, 28, 'P1–P6 × 5 subjects, no Science at P1/P2');
  assert.ok(!all.some(p => p.slug === 'science' && (p.level === 'P1' || p.level === 'P2')));
});

test('robots.txt is obeyed', () => {
  const rules = robotsRules('User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nDisallow: /wp-admin/\nAllow: /wp-admin/admin-ajax.php\nDisallow: /primary-1-\n');
  assert.equal(robotsAllows(rules, '/primary-6-maths/'), true);
  assert.equal(robotsAllows(rules, '/primary-1-maths/'), false);
  assert.equal(robotsAllows(rules, '/wp-admin/admin-ajax.php'), true);
  assert.equal(robotsAllows(robotsRules('User-agent: *\nDisallow: /\n'), '/primary-6-maths/'), false);
  assert.equal(robotsAllows(robotsRules('User-agent: *\nDisallow:\n'), '/'), true);
  assert.equal(robotsAllows([], '/anything'), true, 'no robots.txt allows everything');
});

test('the list is newest first and has no duplicate links', () => {
  const a = { t: 'a', u: 'u1', y: 2024, l: 'P6', s: 'math', sl: 'Maths', e: 'SA2', sc: 'A' };
  const b = { ...a, u: 'u2', y: 2026 };
  const c = { ...a, u: 'u3', y: 2026, l: 'P5' };
  const cat = catalogueOf([a, c, b, { ...a }], '2026-11-15T00:00:00Z');
  assert.deepEqual(cat.papers.map(p => p.u), ['u2', 'u3', 'u1']);
  assert.equal(cat.count, 3);
  assert.equal(sortPapers([a, b])[0].y, 2026);
});

test('entities in link words are decoded', () => {
  assert.equal(decodeEntities('Ai Tong &amp; Co &#8211; x'), 'Ai Tong & Co – x');
});

test('a saved list, when there is one, is well formed and keeps links only', () => {
  let cat;
  try { cat = JSON.parse(readFileSync(new URL('../papers/sgexam.json', import.meta.url), 'utf8')); } catch { return; }
  assert.equal(cat.count, cat.papers.length);
  for (const p of cat.papers.slice(0, 500)) {
    assert.match(p.u, /^https:\/\/(?:www\.)?(sgexam\.com|drive\.google\.com|docs\.google\.com|drive\.usercontent\.google\.com)\//);
    assert.ok(Number.isInteger(p.y) && /^P[1-6]$/.test(p.l));
  }
});
