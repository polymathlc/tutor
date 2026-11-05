/* 🔘 A wrong MCQ tried again in the Science portal's format (v1.82.0), in the
   real app. Every account, mistake and AI reply is a fixture; nothing remote
   is reached. Run: PW=<playwright index.mjs> node tools/cer-mcq-browser-check.mjs
   SHOTS=<dir> also saves screenshots of each state. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const modulePath = process.env.PW || '/opt/node22/lib/node_modules/playwright/index.mjs';
const pw = await import(modulePath.startsWith('file:') ? modulePath : pathToFileURL(modulePath).href);
const chromium = pw.chromium || (pw.default && pw.default.chromium);
const browser = await chromium.launch({ ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
const server = createServer((req, res) => {
  const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
  if ((file !== root && !file.startsWith(root + path.sep)) || !fs.existsSync(file)) { res.writeHead(404).end(); return; }
  const target = fs.statSync(file).isDirectory() ? path.join(file, 'index.html') : file;
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
  res.setHeader('Content-Type', types[path.extname(target)] || 'application/octet-stream');
  res.end(fs.readFileSync(target));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.route('https://**/*', route => route.abort());
const shots = process.env.SHOTS || '';
const shot = async name => { if (shots) await page.screenshot({ path: path.join(shots, name + '.png') }); };

try {
  await page.goto('http://127.0.0.1:' + server.address().port, { waitUntil: 'networkidle' });
  const boot = await page.evaluate(() => ({
    cer: typeof CerMcq !== 'undefined' && typeof CerMcq.mount === 'function',
    hook: typeof LoPractice !== 'undefined' && typeof LoPractice.setMcq === 'function'
  }));
  assert.ok(boot.cer, 'cer-mcq.js is loaded');
  assert.ok(boot.hook, 'lo-practice takes the host MCQ');

  await page.evaluate(() => {
    try { localStorage.clear(); } catch (e) {}
    currentUser = { uid: 'mcq-fixture', getIdToken: async () => 'fixture-token' };
    myStudents = [{ name: 'Test Learner', level: 'P4', subject: 'math' }];
    _activeIdx = 0;
    window.aiReady = () => true;
    aiAvailable = () => true;
    loadTeachingNotes = async () => {};
    usageNote = usageAdd = () => {};
    window.__cleared = [];
    setMistakeCleared = async (id, on) => { window.__cleared.push([id, on]); };
    renderMistakes = () => {};
    if (typeof StudyAdventure !== 'undefined') { StudyAdventure.capture = () => null; StudyAdventure.practice = () => {}; }
    window.__asked = [];
    window.askGemini = async (prompt, opts) => {
      window.__asked.push({ prompt, system: (opts && opts.system) || '', json: !!(opts && opts.json) });
      if (!(opts && opts.json)) return 'Think about what "half" means — share 36 into 2 equal parts.';
      const unknown = /was not recorded/.test(prompt);
      return JSON.stringify({
        correct: unknown ? '2' : undefined,
        options: [
          { n: '1', why: 'Half of 36 is 18, not 12 — 12 is a third of 36.' },
          { n: '2', why: '36 ÷ 2 = 18, so each piece is 18 cm.' },
          { n: '3', why: '24 is two thirds of 36, not half of it.' },
          { n: '4', why: '36 cm is the whole ribbon, before it was cut.' }
        ]
      });
    };
    mistakes = [
      { id: 'mA', key: 'mA', docName: 'P4 WA1', number: '5', level: 'P4', subject: 'math', type: 'mcq',
        question: 'A ribbon 36 cm long is cut into 2 equal pieces. How long is each piece?',
        options: [{ label: '1', text: '12 cm' }, { label: '2', text: '18 cm' }, { label: '3', text: '24 cm' }, { label: '4', text: '36 cm' }],
        option: '2', answer: '(2) 18 cm', studentAnswer: '(3) 24 cm', verdict: 'wrong', marks: '0/1',
        explanation: '36 ÷ 2 = 18' },
      { id: 'mB', key: 'mB', docName: 'P4 WA1', number: '6', level: 'P4', subject: 'math', type: 'mcq',
        question: 'A ribbon 36 cm long is cut into 2 equal pieces. How long is each piece? (again)',
        options: [{ label: '1', text: '12 cm' }, { label: '2', text: '18 cm' }, { label: '3', text: '24 cm' }, { label: '4', text: '36 cm' }],
        option: '', answer: '', studentAnswer: '(1)', verdict: 'wrong', marks: '0/1' },
      { id: 'mC', key: 'mC', docName: 'P4 WA1', number: '7', level: 'P4', subject: 'math', type: 'open',
        question: 'Write 3/4 as a decimal.', answer: '0.75', studentAnswer: '0.34', verdict: 'wrong', marks: '0/1' }
    ];
    pracStart(['mA', 'mB', 'mC']);
  });

  /* ① The book's ▶ Practise: the question as the portal's MCQ. */
  const first = await page.evaluate(() => ({
    rows: document.querySelectorAll('#pracBody .cmq-opt').length,
    text: Array.from(document.querySelectorAll('#pracBody .cmq-opt')).map(l => l.textContent.trim()),
    textarea: !!document.querySelector('#pracBody textarea'),
    printedOpts: document.querySelectorAll('#pracBody .pracOpt, #pracBody .mqOpt').length,
    check: !!Array.from(document.querySelectorAll('#pracBody .cmq-btn-check')).find(b => /Check answer/.test(b.textContent)),
    hint: !!Array.from(document.querySelectorAll('#pracBody .cmq-btn')).find(b => /Hint/.test(b.textContent)),
    badges: document.querySelectorAll('#pracBody .cmq-badge').length,
    foot: Array.from(document.querySelectorAll('#pracFoot button')).map(b => b.textContent)
  }));
  assert.equal(first.rows, 4, 'four options to choose between');
  assert.deepEqual(first.text, ['1. 12 cm', '2. 18 cm', '3. 24 cm', '4. 36 cm'], 'drawn "<b>1.</b> words", as the portal draws them');
  assert.equal(first.textarea, false, 'no "write it out again" box for an MCQ');
  assert.equal(first.printedOpts, 0, 'the options are not printed under the question as well');
  assert.ok(first.check && first.hint, '💡 Hint and ✓ Check answer under the options');
  assert.equal(first.badges, 0, 'no ⓘ before marking — it would point at the answer');
  assert.deepEqual(first.foot, ['Show me the answer']);

  await page.click('#pracBody .cmq-opt:nth-child(3)');
  const picked = await page.evaluate(() => ({
    picked: Array.from(document.querySelectorAll('#pracBody .cmq-opt')).map(l => l.classList.contains('cmq-picked')),
    painted: document.querySelectorAll('#pracBody .cmq-right, #pracBody .cmq-wrong').length
  }));
  assert.deepEqual(picked.picked, [false, false, true, false], 'a neutral highlight on the one picked');
  assert.equal(picked.painted, 0, 'never right or wrong before Check');
  await shot('1-picked');

  await page.click('#pracBody .cmq-btn-check');
  await page.waitForFunction(() => document.querySelectorAll('#pracBody .cmq-badge').length > 0);
  const marked = await page.evaluate(() => ({
    green: Array.from(document.querySelectorAll('#pracBody .cmq-opt')).map(l => l.classList.contains('cmq-right')),
    red: Array.from(document.querySelectorAll('#pracBody .cmq-opt')).map(l => l.classList.contains('cmq-wrong')),
    fb: document.querySelector('#pracBody .cmq-feedback').textContent,
    badgesOn: Array.from(document.querySelectorAll('#pracBody .cmq-opt')).map(l => !!l.querySelector('.cmq-badge')),
    why: (document.querySelector('#pracBody .cmq-why') || {}).textContent || '',
    done: prac.done, right: prac.right, revealed: prac.revealed,
    foot: Array.from(document.querySelectorAll('#pracFoot button')).map(b => b.textContent),
    cleared: window.__cleared.slice()
  }));
  assert.deepEqual(marked.green, [false, true, false, false], 'the right option green');
  assert.deepEqual(marked.red, [false, false, true, false], 'the chosen wrong one red');
  assert.match(marked.fb, /✗ Incorrect \(you chose 3\)/);
  assert.match(marked.fb, /Correct answer: 2\) 18 cm/);
  assert.deepEqual(marked.badgesOn, [true, false, true, true], 'an ⓘ on every option but the right one');
  assert.match(marked.why, /36 ÷ 2 = 18/, 'the book’s own Why follows');
  assert.equal(marked.done, 1); assert.equal(marked.right, 0); assert.equal(marked.revealed, true);
  assert.deepEqual(marked.foot, ['Next question']);
  assert.deepEqual(marked.cleared, [], 'a wrong retry stays in the book');

  // The one why-not call: grounded, a vision-shaped JSON ask, the whole list.
  await page.waitForFunction(() => window.__asked.some(a => a.json));
  const ask = await page.evaluate(() => window.__asked.filter(a => a.json));
  assert.equal(ask.length, 1, 'ONE call for the whole option list');
  assert.match(ask[0].prompt, /Option \(2\) is the correct one\./);
  assert.match(ask[0].prompt, /\(3\) 24 cm/);
  assert.ok(ask[0].system.length > 0, 'grounded through lpAsk');

  // Hover the ⓘ on the option they chose: the card says why it is wrong.
  await page.hover('#pracBody .cmq-opt:nth-child(3) .cmq-badge');
  await page.waitForFunction(() => {
    const c = document.querySelector('.cmq-pop');
    return c && c.style.display === 'block' && /two thirds/.test(c.textContent);
  });
  const card = await page.evaluate(() => {
    const c = document.querySelector('.cmq-pop');
    const r = c.getBoundingClientRect();
    return { text: c.textContent, inModal: !!c.closest('#pracModal'), on: r.width > 0 && r.left >= 0 && r.right <= innerWidth,
             z: getComputedStyle(c).zIndex };
  });
  assert.match(card.text, /✗ Why this one is wrong/);
  assert.match(card.text, /you chose this/);
  assert.match(card.text, /24 is two thirds of 36/);
  assert.ok(card.on, 'on screen');
  await shot('2-marked-why');
  // Tap the ⓘ on option 4: it pins, and says ITS reason — never option 3's.
  await page.mouse.move(5, 5);
  await page.click('#pracBody .cmq-opt:nth-child(4) .cmq-badge');
  await page.waitForFunction(() => /whole ribbon/.test((document.querySelector('.cmq-pop') || {}).textContent || ''));
  const pinned = await page.evaluate(() => ({
    pinned: document.querySelector('.cmq-pop').classList.contains('cmq-pinned'),
    radio4: document.querySelector('#pracBody .cmq-opt:nth-child(4) input').checked
  }));
  assert.ok(pinned.pinned, 'a tap pins the card');
  assert.equal(pinned.radio4, false, 'reading why an option is wrong never changes the answer');
  await page.keyboard.press('Escape');

  /* ② No option recorded and no key: ✓ Check asks the ONE call to settle it. */
  await page.click('#pracFoot .btnPrimary');
  await page.waitForSelector('#pracBody .cmq-opt');
  await page.click('#pracBody .cmq-opt:nth-child(2)');
  await page.click('#pracBody .cmq-btn-check');
  await page.waitForFunction(() => /✓ Correct/.test((document.querySelector('#pracBody .cmq-feedback') || {}).textContent || ''));
  const second = await page.evaluate(() => ({
    fb: document.querySelector('#pracBody .cmq-feedback').textContent,
    right: prac.right, done: prac.done, cleared: window.__cleared.slice(),
    badges: document.querySelectorAll('#pracBody .cmq-badge').length,
    unknownAsk: window.__asked.filter(a => /was not recorded/.test(a.prompt)).length,
    happy: /moved to Sorted/.test(document.getElementById('pracBody').textContent)
  }));
  assert.match(second.fb, /✓ Correct \(you chose 2\)/);
  assert.equal(second.unknownAsk, 1, 'the model settled which option is right');
  assert.equal(second.right, 1); assert.equal(second.done, 2);
  assert.deepEqual(second.cleared, [['mB', true]], 'a right answer files it under Sorted');
  assert.equal(second.badges, 3, 'the ⓘ on the three others');
  assert.ok(second.happy);
  await shot('3-correct');

  /* ③ A written question keeps its own box. */
  await page.click('#pracFoot .btnPrimary');
  const third = await page.evaluate(() => ({
    textarea: !!document.querySelector('#pracBody textarea'),
    cmq: !!document.querySelector('#pracBody .cmq')
  }));
  assert.equal(third.textarea, true);
  assert.equal(third.cmq, false);
  await page.evaluate(() => pracClose());

  /* ④ "Show me the answer" on an MCQ: the key and the ⓘ, nothing marked. */
  await page.evaluate(() => { window.__cleared = []; pracStart(['mA']); });
  await page.click('#pracFoot button');
  const shown = await page.evaluate(() => ({
    fb: document.querySelector('#pracBody .cmq-feedback').textContent,
    badges: document.querySelectorAll('#pracBody .cmq-badge').length,
    done: prac.done, right: prac.right, cleared: window.__cleared.length,
    radios: Array.from(document.querySelectorAll('#pracBody .cmq-opt input')).every(r => r.disabled)
  }));
  assert.match(shown.fb, /The answer/);
  assert.match(shown.fb, /Correct answer: 2\) 18 cm/);
  assert.equal(shown.badges, 3);
  assert.equal(shown.done, 1); assert.equal(shown.right, 0); assert.equal(shown.cleared, 0);
  assert.ok(shown.radios, 'locked once shown');
  await page.evaluate(() => pracClose());

  /* ⑤ lo-practice's try box (the objective window and the 👆 hover card). */
  const lp = await page.evaluate(() => {
    const host = document.createElement('div');
    host.id = 'lpFixture';
    document.body.appendChild(host);
    const m = LoPractice.fromMistake(mistakes[0]);
    const node = LoPractice.tryNode(document, LoPractice.trySpecOfMistake(m));
    host.appendChild(node);
    const prac = LoPractice.tryNode(document, LoPractice.trySpecOfPractice(
      { question: 'A rope 48 m long is cut in half. How long is each half?', options: ['12 m', '24 m', '36 m', '48 m'], correct: 1, answer: '24 m', working: ['48 ÷ 2 = 24'] }, m));
    host.appendChild(prac);
    const open = LoPractice.tryNode(document, LoPractice.trySpecOfMistake(LoPractice.fromMistake(mistakes[2])));
    host.appendChild(open);
    return {
      mistake: node.classList.contains('cmq') && node.querySelectorAll('.cmq-opt').length,
      practice: prac.classList.contains('cmq') && Array.from(prac.querySelectorAll('.cmq-opt')).map(l => l.textContent.trim()),
      open: open.classList.contains('lpTry') && !!open.querySelector('input.lpTryIn')
    };
  });
  assert.equal(lp.mistake, 4, 'a mistake card is tried as the portal’s MCQ');
  assert.deepEqual(lp.practice, ['A. 12 m', 'B. 24 m', 'C. 36 m', 'D. 48 m'], 'a fresh practice MCQ too, lettered as it was written');
  assert.equal(lp.open, true, 'a written question keeps the type-in box');
  await page.click('#lpFixture .cmq:nth-of-type(2) .cmq-opt:nth-child(1)');
  await page.click('#lpFixture .cmq:nth-of-type(2) .cmq-btn-check');
  const lpRes = await page.evaluate(() => {
    const c = document.querySelectorAll('#lpFixture .cmq')[1];
    return { fb: c.querySelector('.cmq-feedback').textContent, again: !c.querySelector('.cmq-again').hidden,
             working: (c.querySelector('.cmq-why') || {}).textContent || '' };
  });
  assert.match(lpRes.fb, /✗ Incorrect \(you chose A\)/);
  assert.match(lpRes.fb, /Correct answer: B\) 24 m/);
  assert.ok(lpRes.again, 'in the objective window a wrong pick can be tried again');
  assert.match(lpRes.working, /48 ÷ 2 = 24/);
  await page.click('#lpFixture .cmq:nth-of-type(2) .cmq-again');
  const reset = await page.evaluate(() => {
    const c = document.querySelectorAll('#lpFixture .cmq')[1];
    return { badges: c.querySelectorAll('.cmq-badge').length, painted: c.querySelectorAll('.cmq-right, .cmq-wrong').length,
             checked: Array.from(c.querySelectorAll('input')).some(r => r.checked) };
  });
  assert.deepEqual(reset, { badges: 0, painted: 0, checked: false }, 'a reset question keeps no badges and no colours');

  /* ⑥ 💡 Hint never gives the answer away, and is grounded. */
  await page.click('#lpFixture .cmq:nth-of-type(1) .cmq-btn-outline');
  await page.waitForFunction(() => /Hint:/.test(document.querySelector('#lpFixture .cmq .cmq-hint').textContent));
  const hint = await page.evaluate(() => window.__asked.filter(a => !a.json).at(-1));
  assert.match(hint.prompt, /Do NOT state the answer/);
  assert.ok(hint.system.length > 0);

  assert.deepEqual(errors, [], 'no page errors');
  console.log('✓ cer-mcq browser check passed');
} finally {
  await browser.close();
  server.close();
}
