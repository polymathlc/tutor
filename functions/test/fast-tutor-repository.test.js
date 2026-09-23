'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createTeachRepository } = require('../fast-tutor-repository');
const { POLICY, hash } = require('../fast-tutor-core');

function database() {
  const data = new Map(); let tail = Promise.resolve();
  const snapshot = ref => ({ exists: data.has(ref.path), data: () => structuredClone(data.get(ref.path)) });
  function collection(path) { return { doc: id => doc(path + '/' + id) }; }
  function doc(path) { return { path, id: path.split('/').at(-1), collection: name => collection(path + '/' + name), async get() { return snapshot(this); }, async set(value) { data.set(path, structuredClone(value)); } }; }
  return { data, collection,
    runTransaction(fn) {
      const pending = tail.then(async () => {
        const writes = [];
        const result = await fn({ async get(ref) { return snapshot(ref); }, set(ref, value) { writes.push(() => data.set(ref.path, structuredClone(value))); }, update(ref, value) { writes.push(() => data.set(ref.path, { ...data.get(ref.path), ...structuredClone(value) })); }, delete(ref) { writes.push(() => data.delete(ref.path)); } });
        writes.forEach(write => write()); return result;
      }); tail = pending.catch(() => {}); return pending;
    }
  };
}
function setup() {
  const db = database(), repo = createTeachRepository(db);
  db.data.set('tutorWorksheets/sheet', { ownerUid: 'child', pageCount: 20, guidance: 'answer', assignmentId: 'assigned', subject: 'math', level: 'P5', body: JSON.stringify({ key: { rows: [{ q: '1', answer: 'old' }], pages: [] } }) });
  db.data.set('tutorAssignments/assigned', { active: true, guidanceLocked: true, guidance: 'concepts', level: 'P5', subject: 'math', keyRows: [{ q: '1', answer: '4' }], keyPages: [19] });
  db.data.set('studentProfiles/child', { tutorOnboard: { students: [{ name: 'First', level: 'P5' }, { name: 'Second', level: 'P5' }] } });
  return { db, repo, body: { worksheetId: 'sheet', page: 1, studentIndex: 0 }, now: Date.parse('2026-09-24T02:00:00Z') };
}
test('worksheet ownership, page bounds and hidden key pages are checked on the server', async () => {
  const { repo, body } = setup();
  await assert.rejects(repo.resolve('other', body), error => error.code === 'worksheet_not_owned');
  await assert.rejects(repo.resolve('child', { ...body, page: 21 }), error => error.code === 'invalid_page');
  await assert.rejects(repo.resolve('child', { ...body, page: 19 }), error => error.code === 'key_page');
});
test('teacher assignment overrides client and worksheet ceiling/key but a withdrawn assignment unlocks the copy', async () => {
  const { db, repo, body } = setup();
  const context = await repo.resolve('child', { ...body, ceiling: 'answer', keyRows: [{ answer: 'fake' }] });
  assert.equal(context.ceiling, 'concepts'); assert.deepEqual(context.authority.keyRows, [{ q: '1', answer: '4' }]);
  db.data.set('tutorAssignments/assigned', { ...db.data.get('tutorAssignments/assigned'), active: false });
  const withdrawn = await repo.resolve('child', body); assert.equal(withdrawn.ceiling, 'method'); assert.equal(withdrawn.authority.worksheetGuidance, 'answer'); assert.equal(withdrawn.authority.locked, false);
});
test('live tutoring preserves the final student step even when full answers are enabled on the worksheet', async () => {
  const { db, repo, body } = setup();
  db.data.get('tutorAssignments/assigned').guidance = 'answer';
  const context = await repo.resolve('child', body);
  assert.equal(context.ceiling, 'method'); assert.equal(context.authority.worksheetGuidance, 'answer');
  db.data.get('tutorAssignments/assigned').guidance = 'method';
  const changed = await repo.resolve('child', body);
  assert.equal(changed.ceiling, 'method'); assert.notDeepEqual(changed.authority, context.authority);
});
test('learner identity and assignment content changes invalidate authoritative cache context', async () => {
  const { db, repo, body } = setup();
  const first = await repo.resolve('child', body), sibling = await repo.resolve('child', { ...body, studentIndex: 1 });
  assert.notEqual(first.learner, sibling.learner);
  db.data.get('tutorAssignments/assigned').keyRows = [{ q: '1', answer: 'revised' }];
  const changed = await repo.resolve('child', body); assert.notEqual(first.authority.assignmentRevision, changed.authority.assignmentRevision);
});
test('paid reservations cap concurrency and burst usage but never touch existing live session limits', async () => {
  const { db, repo, body, now } = setup(), context = await repo.resolve('child', body);
  const rootPath = 'studyBuddyLiveLimits/' + hash('child'), original = { currentLease: 'active-call', starts: 5, day: '2026-09-24' };
  db.data.set(rootPath, original);
  const first = await repo.reserve(context, body, 'prepare', now);
  await assert.rejects(repo.reserve(context, body, 'prepare', now), error => error.code === 'teaching_busy');
  const replies = await Promise.all([repo.reserve(context, body, 'reply', now), repo.reserve(context, body, 'reply', now)]);
  await assert.rejects(repo.reserve(context, body, 'reply', now), error => error.code === 'teaching_busy');
  await Promise.all([repo.release(first), ...replies.map(lease => repo.release(lease))]);
  assert.deepEqual(db.data.get(rootPath), original);
  for (let i = 3; i < POLICY.paidPerMinute; i++) { const lease = await repo.reserve(context, body, 'reply', now); await repo.release(lease); }
  await assert.rejects(repo.reserve(context, body, 'reply', now), error => error.code === 'teaching_limit');
});
test('expired reservations recover and delayed release cannot erase another active reservation', async () => {
  const { db, repo, body, now } = setup(), context = await repo.resolve('child', body);
  const first = await repo.reserve(context, body, 'prepare', now), next = await repo.reserve(context, body, 'prepare', now + POLICY.leaseMs + 1);
  await repo.release(first);
  const usage = db.data.get('studyBuddyLiveLimits/' + hash('child') + '/teachingUsage/current');
  assert.ok(usage.active[next.id]); assert.equal(usage.active[first.id], undefined);
});
test('cache keys are stable per worksheet-page and an LRU bounds retained documents', async () => {
  const { db, repo, body, now } = setup(), context = await repo.resolve('child', body);
  await repo.save(context, body, { cacheKey: 'before' }); await repo.save(context, body, { cacheKey: 'after' });
  assert.equal((await repo.read(context, body)).cacheKey, 'after');
  for (let i = 0; i < POLICY.cachedPages + 3; i++) {
    const target = { ...body, worksheetId: 'sheet' + i }, at = now + i * 86400000;
    const lease = await repo.reserve(context, target, 'prepare', at);
    await repo.save(context, target, { cacheKey: 'pack' + i }); await repo.release(lease);
  }
  const cachePaths = [...db.data.keys()].filter(path => path.includes('/teachingPacks/'));
  // One direct save above bypassed reserve only in this test fixture.
  assert.equal(cachePaths.length, POLICY.cachedPages + 1);
  assert.equal((await repo.read(context, { ...body, worksheetId: 'sheet0' })), null);
  assert.equal([...db.data.keys()].some(path => path.startsWith('teachingPacks/')), false);
});
