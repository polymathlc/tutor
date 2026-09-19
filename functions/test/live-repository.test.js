'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRepository, dayKey, userKey, SESSION_COLLECTION, LIMIT_COLLECTION } = require('../live-repository');
const { LIMITS } = require('../live-service');

function database() {
  const data = new Map();
  let tail = Promise.resolve();
  const snapshot = ref => ({ exists: data.has(ref.path), data: () => structuredClone(data.get(ref.path)) });
  function doc(path) {
    return {
      path, async get() { return snapshot(this); },
      async set(value) { data.set(path, structuredClone(value)); }
    };
  }
  const db = {
    data,
    collection(name) {
      return {
        doc: id => doc(`${name}/${id}`),
        where(field, op, bound) {
          assert.equal(op, '<=');
          return { limit: n => ({ async get() { return { docs: [...data.entries()].filter(([path, value]) => path.startsWith(`${name}/`) && value[field] <= bound).slice(0, n).map(([, value]) => ({ data: () => structuredClone(value) })) }; } }) };
        }
      };
    },
    runTransaction(callback) {
      // Serialized atomic transactions model Firestore's retry-on-conflict
      // behavior; concurrent starts see the committed reservation.
      const promise = tail.then(async () => {
        const pending = [];
        const result = await callback({
          async get(ref) { return snapshot(ref); },
          set(ref, value) { pending.push(() => data.set(ref.path, structuredClone(value))); },
          update(ref, value) { pending.push(() => data.set(ref.path, { ...data.get(ref.path), ...structuredClone(value) })); },
          delete(ref) { pending.push(() => data.delete(ref.path)); }
        });
        for (const write of pending) write();
        return result;
      });
      tail = promise.catch(() => {});
      return promise;
    }
  };
  return db;
}
function setup() {
  const db = database();
  db.data.set('tutorWorksheets/sheet', { ownerUid: 'child' });
  return { db, repo: createRepository(db), now: Date.parse('2026-09-16T01:00:00Z') };
}

test('worksheet ownership is checked inside the reservation transaction', async () => {
  const { db, repo, now } = setup();
  await assert.rejects(repo.reserve('other-child', 'sheet', now, LIMITS), error => error.status === 403);
  await assert.rejects(repo.reserve('child', 'missing', now, LIMITS), error => error.status === 403);
  assert.equal(db.data.size, 1);
});

test('two concurrent starts for the same account cannot allocate two paid calls', async () => {
  const { db, repo, now } = setup();
  const results = await Promise.allSettled([repo.reserve('child', 'sheet', now, LIMITS), repo.reserve('child', 'sheet', now, LIMITS)]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.find(result => result.status === 'rejected').reason.status, 409);
  assert.equal([...db.data.keys()].filter(path => path.startsWith(`${SESSION_COLLECTION}/`)).length, 1);
});

test('activation stores the opaque provider ID and changes cleanup from reservation to lesson expiry', async () => {
  const { db, repo, now } = setup();
  const lease = await repo.reserve('child', 'sheet', now, LIMITS);
  assert.equal(lease.cleanupAt, now + 60000);
  assert.equal(lease.expiresAt, now + 600000);
  await repo.activate(lease, 'live-opaque-provider-id');
  const saved = db.data.get(`${SESSION_COLLECTION}/${lease.id}`);
  assert.equal(saved.sessionId, 'live-opaque-provider-id');
  assert.equal(saved.cleanupAt, lease.expiresAt);
  assert.equal(await repo.find('other-child', 'live-opaque-provider-id'), null);
  assert.equal(await repo.find('child', 'wrong-id'), null);
  assert.equal((await repo.find('child', 'live-opaque-provider-id')).id, lease.id);
  assert.ok(!('sdp' in saved));
});

test('a delayed release cannot unlock or delete a newer lesson', async () => {
  const { db, repo, now } = setup();
  const first = await repo.reserve('child', 'sheet', now, LIMITS);
  await repo.release(first);
  const second = await repo.reserve('child', 'sheet', now + 1000, LIMITS);
  await repo.release(first);
  assert.equal(db.data.get(`${LIMIT_COLLECTION}/${userKey('child')}`).currentLease, second.id);
  assert.deepEqual(Object.keys(db.data.get(`${LIMIT_COLLECTION}/_global`).active), [second.id]);
  assert.ok(db.data.has(`${SESSION_COLLECTION}/${second.id}`));
});

test('a stale pending cleanup snapshot cannot delete a session activated since its read', async () => {
  const { db, repo, now } = setup();
  const lease = await repo.reserve('child', 'sheet', now, LIMITS);
  const stale = (await repo.expired(now + 61000))[0];
  await repo.activate(lease, 'newly-active-call');
  await repo.release(stale);
  assert.equal(db.data.get(`${SESSION_COLLECTION}/${lease.id}`).sessionId, 'newly-active-call');
  assert.equal(db.data.get(`${LIMIT_COLLECTION}/${userKey('child')}`).currentLease, lease.id);
});

test('per-user starts stay counted after stops and reset at Singapore midnight', async () => {
  const { db, repo, now } = setup();
  // A lesson that really RAN and was then stopped: the provider call was
  // made, so the start is spent. Activating it is what makes it one.
  for (let i = 0; i < LIMITS.startsPerDay; i++) {
    const lease = await repo.reserve('child', 'sheet', now + i, LIMITS);
    await repo.activate(lease, 'call-' + i);
    await repo.release({ ...lease, sessionId: 'call-' + i });
  }
  await assert.rejects(repo.reserve('child', 'sheet', now, LIMITS), error => error.code === 'daily_limit');
  const next = await repo.reserve('child', 'sheet', now + 86400000, LIMITS);
  assert.ok(next.id);
  assert.equal(db.data.get(`${LIMIT_COLLECTION}/${userKey('child')}`).starts, 1);
  assert.equal(dayKey(Date.parse('2026-09-15T15:59:59Z')), '2026-09-15');
  assert.equal(dayKey(Date.parse('2026-09-15T16:00:00Z')), '2026-09-16');
});

/* THE REPORTED FAULT. The allowance is spent in `reserve`, before the
   provider is ever asked, so every attempt that failed to connect — a
   refused microphone, an SDP the provider would not take, a rate limit at
   the other end — cost one of the six. After six the endpoint answered 429
   and the app said "Live tutoring is busy. Please try again in a little
   while", about something that was not coming back until midnight. */
test('a start that never became a paid call is given back', async () => {
  const { db, repo, now } = setup();
  for (let i = 0; i < LIMITS.startsPerDay + 4; i++) {
    const lease = await repo.reserve('child', 'sheet', now + i, LIMITS);
    await repo.release(lease);                     // the provider was never reached
    assert.equal(db.data.get(`${LIMIT_COLLECTION}/${userKey('child')}`).starts, 0,
      'an attempt that never connected is not a lesson used');
  }
  const after = await repo.reserve('child', 'sheet', now, LIMITS);
  assert.ok(after.id, 'and the day is still open');
});

test('a refund is never taken twice, and never off another day', async () => {
  const { db, repo, now } = setup();
  // One lesson that really ran, so the day's count is 1 and a second refund
  // would show as 0 rather than being swallowed by the floor at nothing.
  const ran = await repo.reserve('child', 'sheet', now, LIMITS);
  await repo.activate(ran, 'ran-1');
  await repo.release({ ...ran, sessionId: 'ran-1' });
  const failed = await repo.reserve('child', 'sheet', now + 1, LIMITS);
  assert.equal(db.data.get(`${LIMIT_COLLECTION}/${userKey('child')}`).starts, 2);
  await repo.release(failed);
  await repo.release(failed);    // a retried stop must not buy a second lesson
  assert.equal(db.data.get(`${LIMIT_COLLECTION}/${userKey('child')}`).starts, 1);
  // …and a release that lands after midnight leaves tomorrow's count alone.
  // It is deliberately NOT activated: an activated lease returns at the
  // sessionId guard above, so the day check would never be reached and a
  // test written that way passes with the check taken out.
  const overnight = await repo.reserve('child', 'sheet', now, LIMITS);
  db.data.set(`${LIMIT_COLLECTION}/${userKey('child')}`,
    { ...db.data.get(`${LIMIT_COLLECTION}/${userKey('child')}`), day: dayKey(now + 86400000), starts: 2 });
  await repo.release(overnight);
  assert.equal(db.data.get(`${LIMIT_COLLECTION}/${userKey('child')}`).starts, 2,
    'a refund that lands after midnight must not take one off tomorrow');
});

test('global concurrency and daily ceilings are independently enforced', async () => {
  for (const state of [{ active: 'fresh' }, { starts: 100 }]) {
    const { db, repo, now } = setup();
    const globalState = state.active
      ? { active: { other: now - 1000 }, day: '2026-09-16', starts: 1 }
      : { active: {}, day: '2026-09-16', starts: 100 };
    db.data.set(`${LIMIT_COLLECTION}/_global`, globalState);
    await assert.rejects(repo.reserve('child', 'sheet', now, { ...LIMITS, concurrent: 1 }), error => error.code === 'live_busy');
    assert.ok(!db.data.has(`${LIMIT_COLLECTION}/${userKey('child')}`));
  }
});

/* A SLOT LETS GO OF ITSELF. The scheduled sweep clears an abandoned
   reservation, but it is a SEPARATE function: deploy the endpoint without
   it and a handful of dropped tabs takes live mode away from the whole
   school permanently, with every screen saying "try again in a little
   while". An entry written before this shipped is `true` rather than a
   time, and is let go for exactly the same reason. */
test('a concurrency slot older than a whole lesson is let go', async () => {
  for (const age of [LIMITS.durationSeconds * 1000 + 120000, 'legacy']) {
    const { db, repo, now } = setup();
    const held = age === 'legacy' ? true : now - age;
    db.data.set(`${LIMIT_COLLECTION}/_global`, { active: { orphan: held }, day: '2026-09-16', starts: 1 });
    const lease = await repo.reserve('child', 'sheet', now, { ...LIMITS, concurrent: 1 });
    assert.ok(lease.id, 'a stale slot cannot hold live mode shut for ever');
    assert.deepEqual(Object.keys(db.data.get(`${LIMIT_COLLECTION}/_global`).active), [lease.id]);
  }
});

test('…but a slot from a lesson that really is running is kept', async () => {
  const { db, repo, now } = setup();
  db.data.set(`${LIMIT_COLLECTION}/_global`, { active: { live: now - 60000 }, day: '2026-09-16', starts: 1 });
  await assert.rejects(repo.reserve('child', 'sheet', now, { ...LIMITS, concurrent: 1 }), error => error.code === 'live_busy');
});

/* A SLOT THIS BUILD TAKES CARRIES THE TIME IT WAS TAKEN, and the check has
   to be made against a slot `reserve` really WROTE rather than one the
   harness planted: written as a flag it reads as `1` through `Number`, so
   the very next start sweeps it — and the ceiling the whole school shares
   stops holding at all, which looks exactly like live mode working. */
test('a slot a lesson is holding is not swept by the next start', async () => {
  const { db, repo, now } = setup();
  db.data.set('tutorWorksheets/other-sheet', { ownerUid: 'other-child' });
  const held = await repo.reserve('child', 'sheet', now, { ...LIMITS, concurrent: 1 });
  assert.equal(typeof db.data.get(`${LIMIT_COLLECTION}/_global`).active[held.id], 'number',
    'a slot with no time on it can never be told from an abandoned one');
  await assert.rejects(repo.reserve('other-child', 'other-sheet', now + 1000, { ...LIMITS, concurrent: 1 }),
    error => error.code === 'live_busy');
});

test('expired query includes abandoned reservations and excludes active lessons', async () => {
  const { repo, now } = setup();
  const pending = await repo.reserve('child', 'sheet', now, LIMITS);
  assert.deepEqual((await repo.expired(now + 61000)).map(lease => lease.id), [pending.id]);
  await repo.activate(pending, 'live-active');
  assert.deepEqual(await repo.expired(now + 61000), []);
  assert.deepEqual((await repo.expired(now + 600000)).map(lease => lease.id), [pending.id]);
});

test('user IDs cannot escape bookkeeping document paths', () => {
  assert.match(userKey('../other/user'), /^[a-f0-9]{64}$/);
});
