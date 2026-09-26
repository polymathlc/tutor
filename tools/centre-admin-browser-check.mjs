/* Real app DOM with fixture-only Auth, roster and endpoint responses.
   No account, student data, paid call or production service is contacted. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const modulePath = process.env.PW || '/opt/node22/lib/node_modules/playwright/index.mjs';
const { chromium } = await import(modulePath.startsWith('file:') ? modulePath : pathToFileURL(modulePath).href);
const browser = await chromium.launch({ ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
const server = createServer((req, res) => {
  const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
  if ((file !== root && !file.startsWith(root + path.sep)) || !fs.existsSync(file)) { res.writeHead(404).end(); return; }
  const target = fs.statSync(file).isDirectory() ? path.join(file, 'index.html') : file;
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp' };
  res.setHeader('Content-Type', types[path.extname(target)] || 'application/octet-stream'); res.end(fs.readFileSync(target));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const address = 'http://127.0.0.1:' + server.address().port;
const context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, reducedMotion: 'reduce' });
const page = await context.newPage(), errors = [], requests = [];
page.on('pageerror', error => errors.push(error.message));
const sibling = { name: 'Asha Fixture', level: 'P4', subject: 'science' };
const selected = { name: 'Ben Fixture', level: 'P5', subject: 'math' };
const profiles = { 'family-fixture': { name: 'Fixture Parent', email: 'fixture@example.invalid', unrelated: 'keep me',
  tutorOnboard: { v: 2, parent: 'Fixture Parent', enrolled: true, students: [sibling, selected] } } };
let failCreation = false;
await page.exposeFunction('__rosterProfiles', () => profiles);
await page.route('https://**/*', async route => {
  const req = route.request();
  if (!req.url().endsWith('/studyBuddyCentre')) return route.abort();
  const body = req.postDataJSON(); requests.push({ body, headers: req.headers() });
  let data, status = 200;
  if (body.action === 'createStudent') {
    if (failCreation) { failCreation = false; status = 503; data = { error: { message: 'Fixture service unavailable. Retry safely.' } }; }
    else {
      const student = { name: body.name, level: body.level, subject: body.subject };
      profiles['centre-fixture'] = { name: body.name, managed: true,
        tutorOnboard: { v: 2, parent: 'Centre student', enrolled: true, students: [student] } };
      data = { targetUid: 'centre-fixture', studentIndex: 0, student };
    }
  } else if (body.action === 'updateStudent') {
    const profile = profiles[body.targetUid];
    assert.deepEqual(profile.tutorOnboard.students[body.studentIndex], body.expectedStudent, 'update carries the exact displayed student for conflict detection');
    profile.tutorOnboard.students[body.studentIndex] = body.student;
    data = { targetUid: body.targetUid, studentIndex: body.studentIndex, student: body.student };
  } else if (body.action === 'startPractice') {
    data = { token: 'fixture-custom-token', targetUid: body.targetUid, studentIndex: body.studentIndex,
      student: profiles[body.targetUid].tutorOnboard.students[body.studentIndex], expiresAt: Math.floor(Date.now() / 1000) + 14400 };
  } else throw new Error('Unexpected fixture action: ' + body.action);
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
});

async function fixture() {
  await page.goto(address, { waitUntil: 'load' });
  await page.evaluate(() => {
    window.__events = []; window.__notices = []; window.__saveFails = false;
    window.__record = name => { window.__events.push(name); sessionStorage.setItem('centre-test-events', JSON.stringify(window.__events)); };
    window.__teacher = { uid: 'teacher-fixture', email: 'chungzhikai@gmail.com',
      getIdToken: async () => 'fixture-admin-token', getIdTokenResult: async () => ({ claims: { firebase: { sign_in_provider: 'google.com' } } }) };
    currentUser = window.__teacher;
    libsReady = () => true;
    window.toast = text => window.__notices.push(text);
    window.liveAppCheckToken = async () => 'fixture-appcheck';
    window.peopleRef = uid => ({ get: async options => {
      if (options) window.__readOptions = options;
      const profiles = await window.__rosterProfiles();
      return { exists: !!profiles[uid], data: () => profiles[uid] };
    } });
    window.peopleLoad = async () => {
      const profiles = await window.__rosterProfiles();
      _peopleRows = peopleSort(Object.entries(profiles).map(([uid, profile]) => personRow(uid, profile)));
      return _peopleRows;
    };
    if (window.StudyAdventure) { StudyAdventure.sync = () => {}; StudyAdventure.teacherControls = () => {}; }
    window.lessonBusy = () => false;
    window.stopLiveTutor = () => { window.__record('stop'); };
    window.flushSave = () => { window.__record('flush'); };
    window.performSave = async () => { window.__record('save'); if (window.__saveFails) return false; dirty = false; return true; };
    window.auth = {
      signOut: async () => { window.__record('signout'); currentUser = null; },
      setPersistence: async value => { window.__record('persistence:' + value); },
      signInWithCustomToken: async value => { if (value !== 'fixture-custom-token') throw new Error('wrong fixture token'); window.__record('custom-login'); }
    };
    window.firebase = { auth: { Auth: { Persistence: { SESSION: 'session' } } } };
    const originalFetch = window.fetch.bind(window);
    window.fetch = (url, options) => {
      if (String(url).endsWith('/studyBuddyCentre')) window.__record('api:' + JSON.parse(options.body).action);
      return originalFetch(url, options);
    };
    dirty = false; savingNow = false; currentDocId = null; myStudents = []; _activeIdx = 0;
    renderAuth();
  });
}

async function account() {
  await page.locator('#peopleBtn').click();
  await page.locator('.peopleRow').filter({ hasText: 'Ben Fixture' }).click();
  await page.locator('.centreStudentRow').filter({ hasText: 'Ben Fixture' }).waitFor();
}

async function fits(selector, label) {
  const box = await page.locator(selector).boundingBox();
  const width = page.viewportSize().width;
  assert.ok(box && box.x >= -1 && box.x + box.width <= width + 1, label + ' fits the viewport');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, label + ' does not overflow the page');
}

async function shot(name) {
  if (!process.env.CENTRE_SCREENSHOT_DIR) return;
  fs.mkdirSync(process.env.CENTRE_SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(process.env.CENTRE_SCREENSHOT_DIR, name + '.png'), fullPage: true });
}

try {
  await fixture();
  assert.deepEqual(errors, [], 'the real app loads without uncaught exceptions');
  await page.locator('#peopleBtn').click();
  await page.locator('#peopleAddStudent').click();
  assert.match(await page.getByRole('dialog').innerText(), /does not need a Gmail address/);
  assert.equal(await page.getByRole('dialog').locator('input[type=email]').count(), 0, 'centre creation does not ask for an email');
  await page.getByRole('button', { name: 'Add student', exact: true }).click();
  assert.equal(requests.length, 0, 'missing fields cannot submit');
  await page.getByLabel('Student name', { exact: true }).fill('Cara <Fixture>');
  await page.getByRole('dialog').getByLabel('Level', { exact: true }).selectOption('P3');
  assert.deepEqual(await page.getByLabel('Subject access').locator('option').evaluateAll(options => options.map(option => option.value)), ['science']);
  await page.getByRole('dialog').getByLabel('Level', { exact: true }).selectOption('P4');
  await page.getByLabel('Subject access').selectOption('both');
  await fits('.centreModalCard', 'desktop creation dialog'); await shot('centre-create-desktop');
  await page.setViewportSize({ width: 390, height: 844 });
  await fits('.centreModalCard', 'mobile creation dialog'); await shot('centre-create-mobile');
  failCreation = true;
  await page.getByRole('button', { name: 'Add student', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Fixture service unavailable' }).waitFor();
  const requestId = requests.at(-1).body.requestId;
  assert.equal(await page.getByLabel('Student name', { exact: true }).isDisabled(), true, 'uncertain creation retries retain the original student');
  await page.getByRole('button', { name: 'Retry adding student', exact: true }).click();
  await page.getByRole('button', { name: 'Practise as Cara <Fixture>', exact: true }).waitFor();
  assert.equal(requests.at(-1).body.requestId, requestId, 'retry uses the original creation receipt');
  assert.match(requestId, /^[a-f0-9-]{36}$/i);
  assert.equal(requests.at(-1).body.email, undefined);
  assert.equal(profiles['centre-fixture'].email, undefined);
  assert.equal(await page.getByRole('dialog').locator('fixture').count(), 0, 'student names remain literal text');
  assert.equal(requests.at(-1).headers.authorization, 'Bearer fixture-admin-token');
  assert.equal(requests.at(-1).headers['x-firebase-appcheck'], 'fixture-appcheck');
  await page.getByRole('dialog').getByRole('button', { name: 'Done', exact: true }).click();

  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.locator('.peopleRow').filter({ hasText: 'Ben Fixture' }).click();
  let selectedRow = page.locator('.centreStudentRow').filter({ hasText: 'Ben Fixture' });
  await selectedRow.getByRole('button', { name: 'Edit access', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Level', { exact: true }).selectOption('P6');
  await page.getByLabel('Subject access').selectOption('both');
  await page.getByRole('button', { name: 'Save access', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('.centreModalCard'));
  const update = requests.find(request => request.body.action === 'updateStudent').body;
  assert.equal(update.targetUid, 'family-fixture'); assert.equal(update.studentIndex, 1);
  assert.deepEqual(update.expectedStudent, selected);
  assert.deepEqual(profiles['family-fixture'].tutorOnboard.students[0], sibling, 'editing one child preserves the sibling');
  assert.equal(profiles['family-fixture'].unrelated, 'keep me');
  assert.deepEqual(profiles['family-fixture'].tutorOnboard.students[1], { name: 'Ben Fixture', level: 'P6', subject: 'both' });
  assert.deepEqual(await page.evaluate(() => window.__readOptions), { source: 'server' });
  await fits('.centreAccountControls', 'desktop student access'); await shot('centre-access-desktop');
  await page.setViewportSize({ width: 390, height: 844 });
  await fits('.centreAccountControls', 'mobile student access'); await shot('centre-access-mobile');
  await selectedRow.getByRole('button', { name: 'Practise as Ben Fixture', exact: true }).click();
  await fits('.centreModalCard', 'mobile practice confirmation');
  assert.match(await page.getByRole('dialog').innerText(), /ends your admin session/);
  await page.evaluate(() => { window.__events = []; dirty = true; currentDocId = 'fixture-worksheet'; window.__saveFails = true; });
  const beforeFailedSave = requests.length;
  await page.getByRole('button', { name: 'Start practice', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'could not be saved' }).waitFor();
  assert.equal(requests.length, beforeFailedSave, 'unsaved teacher work prevents starting practice');
  assert.ok(!(await page.evaluate(() => window.__events)).includes('signout'));
  await page.evaluate(() => { window.__events = []; window.__saveFails = false; });
  await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), page.getByRole('button', { name: 'Start practice', exact: true }).click()]);
  const handoff = await page.evaluate(() => JSON.parse(sessionStorage.getItem('centre-test-events')));
  assert.deepEqual(handoff.slice(0, 7),
    ['stop', 'flush', 'save', 'api:startPractice', 'signout', 'persistence:session', 'custom-login'],
    'practice saves teacher work, ends the admin session, uses session persistence, then signs in with the student token');
  assert.ok(handoff.slice(7).every(event => ['stop', 'flush'].includes(event)), 'page teardown only repeats safe cleanup');
  const start = requests.at(-1).body;
  assert.equal(start.targetUid, 'family-fixture'); assert.equal(start.studentIndex, 1);
  assert.deepEqual(start.expectedStudent, profiles['family-fixture'].tutorOnboard.students[1]);

  await page.setViewportSize({ width: 1280, height: 1000 });
  await fixture();
  await page.evaluate(async students => {
    currentUser = { uid: 'family-fixture', email: 'fixture@example.invalid', getIdToken: async () => 'fixture-student-token',
      getIdTokenResult: async () => ({ claims: { centrePractice: true, centreStudentIndex: 1,
        centrePracticeExpiresAt: Math.floor(Date.now() / 1000) + 14400, centreStudentKey: 'a'.repeat(64),
        centreActorUid: 'teacher-fixture', firebase: { sign_in_provider: 'custom' } } }) };
    myStudents = students; _activeIdx = 0;
    await CentreAdmin.authReady(currentUser); renderAuth();
    setActiveIdx(0); renderAuth();
  }, profiles['family-fixture'].tutorOnboard.students);
  assert.equal(await page.evaluate(() => _activeIdx), 1, 'signed claims lock the chosen child');
  assert.match(await page.locator('#whoAmI').innerText(), /Ben Fixture/);
  assert.match(await page.locator('#centrePracticeBanner').innerText(), /Practising as Ben Fixture/);
  assert.equal(await page.locator('#peopleBtn').isVisible(), false, 'student practice has no admin roster button');
  await page.locator('#whoAmI').click();
  assert.equal(await page.evaluate(() => _activeIdx), 1, 'practice header cannot switch siblings');
  await fits('#centrePracticeBanner', 'desktop session banner'); await shot('centre-practice-desktop');
  await page.setViewportSize({ width: 390, height: 844 });
  await fits('#centrePracticeBanner', 'mobile session banner'); await shot('centre-practice-mobile');
  const beforeDenied = requests.length;
  await page.evaluate(() => { CentreAdmin.openCreate(); CentreAdmin.appendAccountControls(document.body, { id: 'family-fixture' }); });
  assert.equal(await page.getByRole('dialog').count(), 0, 'student cannot open creation directly');
  assert.equal(await page.locator('.centreAccountControls').count(), 0, 'student cannot append admin actions directly');
  assert.equal(requests.length, beforeDenied);

  await page.evaluate(() => { window.__events = []; dirty = true; currentDocId = 'student-worksheet'; });
  await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), page.getByRole('button', { name: 'End centre practice', exact: true }).click()]);
  const ending = await page.evaluate(() => JSON.parse(sessionStorage.getItem('centre-test-events')));
  assert.deepEqual(ending.slice(0, 4), ['stop', 'flush', 'save', 'signout'], 'ending practice saves student work before signing out');
  assert.ok(!ending.includes('custom-login'), 'ending practice never restores an admin credential');

  await fixture(); await account();
  await page.evaluate(() => { currentUser = { uid: 'ordinary-student', email: 'student@example.invalid' }; renderAuth(); });
  selectedRow = page.locator('.centreStudentRow').filter({ hasText: 'Ben Fixture' });
  await selectedRow.getByRole('button', { name: 'Edit access', exact: true }).click();
  await page.getByRole('button', { name: 'Save access', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Sign in to the admin account' }).waitFor();
  assert.equal(requests.length, beforeDenied, 'stale admin controls recheck the account before sending mutations');
  assert.deepEqual(errors, [], 'all real DOM checks finish without uncaught exceptions');
  console.log('Centre admin browser checks passed: no-email creation, safe retry, sibling-preserving access edits, current profile reads, unsaved-work guard, student sign-in order, claim-locked header, admin denial, and desktop/mobile layout.');
} finally {
  await browser.close(); await new Promise(resolve => server.close(resolve));
}

