'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRepository, dayKey, userKey, SESSION_COLLECTION, LIMIT_COLLECTION } = require('../live-repository');
const { LIMITS, DURATION_MAX, DURATION_MIN, capOn, liveDuration } = require('../live-service');
/* The rations are OFF by default (v1.33.0), so a test ABOUT a cap has to
   turn one on explicitly. `CAPPED` is that policy and nothing else reads
   it — every other test runs on the shipped LIMITS, which is what a real
   student meets. */
const CAPPED = Object.freeze({ ...LIMITS, startsPerDay: 6, globalStartsPerDay: 100, concurrent: 20 });
const SECONDS = liveDuration(LIMITS);

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
  assert.equal(lease.expiresAt, now + SECONDS * 1000);
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
  for (let i = 0; i < CAPPED.startsPerDay; i++) {
    const lease = await repo.reserve('child', 'sheet', now + i, CAPPED);
    await repo.activate(lease, 'call-' + i);
    await repo.release({ ...lease, sessionId: 'call-' + i });
  }
  await assert.rejects(repo.reserve('child', 'sheet', now, CAPPED), error => error.code === 'daily_limit');
  const next = await repo.reserve('child', 'sheet', now + 86400000, CAPPED);
  assert.ok(next.id);
  assert.equal(db.data.get(`${LIMIT_COLLECTION}/${userKey('child')}`).starts, 1);
  assert.equal(dayKey(Date.parse('2026-09-15T15:59:59Z')), '2026-09-15');
  assert.equal(dayKey(Date.parse('2026-09-15T16:00:00Z')), '2026-09-16');
});

/* ⏱ THE RATIONS ARE OFF (v1.33.0). Three numbers stood between a child
   and the live tutor and all three are `0` now. The COUNT is deliberately
   still kept: it is what the teacher can look at, and it is what the
   refund below takes back off — turn the counter off with the cap and that
   whole path rots into code nothing runs. */
test('with the rations off a student may start as often as they like', async () => {
  const { db, repo, now } = setup();
  for (let i = 0; i < CAPPED.startsPerDay + 12; i++) {
    const lease = await repo.reserve('child', 'sheet', now + i, LIMITS);
    assert.ok(lease.id, 'no start is ever refused for the day\'s count');
    await repo.activate(lease, 'call-' + i);
    await repo.release({ ...lease, sessionId: 'call-' + i });
  }
  assert.equal(db.data.get(`${LIMIT_COLLECTION}/${userKey('child')}`).starts, CAPPED.startsPerDay + 12,
    'the count is still kept, so the teacher can see it and a refund has something to take off');
});

test('…and the centre\'s own two ceilings are off with it', async () => {
  const { db, repo, now } = setup();
  db.data.set(`${LIMIT_COLLECTION}/_global`, { active: {}, day: '2026-09-16', starts: 9999 });
  const many = {};
  for (let i = 0; i < 50; i++) many['other-' + i] = now - 1000;
  db.data.set(`${LIMIT_COLLECTION}/_global`, { active: many, day: '2026-09-16', starts: 9999 });
  const lease = await repo.reserve('child', 'sheet', now, LIMITS);
  assert.ok(lease.id, 'neither the day\'s centre-wide count nor fifty open lessons refuses a start');
});

test('a cap is ON only when it is a real number of at least one', () => {
  assert.equal(capOn(1), true);
  assert.equal(capOn(6), true);
  for (const off of [0, -1, 0.5, NaN, Infinity, null, undefined, '6', {}]) {
    assert.equal(capOn(off), false, `${String(off)} must read as NO cap`);
  }
});

/* The duration is NOT a ration and is NOT removed: the lease's expiry, the
   scheduled sweep and the stale-slot rule are all built on it, so a junk
   value would be a lease that never ends and a paid call that never
   closes. It is CLAMPED rather than trusted. */
/* AND THE LEASE ITSELF CARRIES THE CLAMPED NUMBER. `now + policy.durationSeconds
   * 1000` looks identical while the shipped value is in range, and on a junk one
   it is `NaN` — an expiry that is never past, on a lease the sweep can therefore
   never find, holding a paid call open for ever. */
test('a lease never ends up with an expiry the policy typed wrong', async () => {
  for (const junk of [undefined, null, NaN, Infinity, 'an hour', 0, -5, 999999, 900]) {
    const { repo, now } = setup();
    const lease = await repo.reserve('child', 'sheet', now, { ...LIMITS, durationSeconds: junk });
    assert.ok(Number.isFinite(lease.expiresAt), `durationSeconds: ${String(junk)} must not give a lease with no end`);
    assert.ok(lease.expiresAt >= now + DURATION_MIN * 1000 && lease.expiresAt <= now + DURATION_MAX * 1000);
    assert.equal(lease.expiresAt, now + liveDuration({ durationSeconds: junk }) * 1000);
    assert.ok(Number.isFinite(lease.cleanupAt));
  }
});

test('the session length is clamped, never trusted, and never unbounded', () => {
  assert.equal(liveDuration(LIMITS), 3600);
  assert.equal(liveDuration({ durationSeconds: 1 }), 60);
  assert.equal(liveDuration({ durationSeconds: 0 }), 60, '0 means no cap for a ration and must NOT here');
  assert.equal(liveDuration({ durationSeconds: -5 }), 60);
  assert.equal(liveDuration({ durationSeconds: 999999 }), 14400);
  for (const junk of [undefined, null, NaN, Infinity, 'an hour', {}]) {
    assert.equal(liveDuration({ durationSeconds: junk }), 14400, 'junk is bounded, never endless');
    assert.ok(Number.isFinite(liveDuration({ durationSeconds: junk })));
  }
  assert.equal(liveDuration(undefined), 14400);
});

/* THE ACCOUNT'S OWN LOCK LETS GO OF ITSELF (v1.33.0). `currentLease` is
   cleared by `release`, so a tab closed mid-lesson left it set and every
   later start on that account was refused for ever — the one limit a
   student could hit that would never come back. A lock written before this
   shipped carries no `leaseAt` and is let go for the same reason a legacy
   `active[key] = true` is. */
test('an account lock left behind by a closed tab is let go', async () => {
  for (const held of [{ currentLease: 'ghost', leaseAt: 1, day: '2026-09-16', starts: 1 },
                      { currentLease: 'ghost', day: '2026-09-16', starts: 1 }]) {
    const { db, repo, now } = setup();
    db.data.set(`${LIMIT_COLLECTION}/${userKey('child')}`, { ...held });
    const lease = await repo.reserve('child', 'sheet', now, LIMITS);
    assert.ok(lease.id, 'a stale account lock cannot shut live mode for ever');
    assert.equal(db.data.get(`${LIMIT_COLLECTION}/${userKey('child')}`).currentLease, lease.id);
  }
});

test('…but a lesson that really is open still refuses a second one', async () => {
  const { db, repo, now } = setup();
  const first = await repo.reserve('child', 'sheet', now, LIMITS);
  assert.equal(db.data.get(`${LIMIT_COLLECTION}/${userKey('child')}`).leaseAt, now,
    'a lock with no time on it can never be told from an abandoned one');
  await assert.rejects(repo.reserve('child', 'sheet', now + 60000, LIMITS),
    error => error.code === 'lesson_already_active');
  await repo.release(first);
  assert.equal(db.data.get(`${LIMIT_COLLECTION}/${userKey('child')}`).currentLease, null,
    'release frees the lock itself — the stale rule is the net under it, not the way out');
  assert.ok((await repo.reserve('child', 'sheet', now + 61000, LIMITS)).id, 'and it frees on release');
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

/* TWO CEILINGS, TWO ANSWERS. "Twenty are running right now" comes back in
   minutes; "the centre has used today's allowance" comes back at midnight.
   One sentence for both is the very fault v1.32.0 fixed at the client end
   of the same wire, so they carry different codes and different words. */
test('global concurrency and daily ceilings are independently enforced', async () => {
  for (const state of [{ active: true, code: 'live_busy' }, { starts: 100, code: 'daily_limit' }]) {
    const { db, repo, now } = setup();
    const globalState = state.active
      ? { active: { other: now - 1000 }, day: '2026-09-16', starts: 1 }
      : { active: {}, day: '2026-09-16', starts: 100 };
    db.data.set(`${LIMIT_COLLECTION}/_global`, globalState);
    await assert.rejects(repo.reserve('child', 'sheet', now, { ...CAPPED, concurrent: 1 }),
      error => error.code === state.code && !/busy or has reached/.test(error.message));
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
  for (const age of [SECONDS * 1000 + 120000, 'legacy']) {
    const { db, repo, now } = setup();
    const held = age === 'legacy' ? true : now - age;
    db.data.set(`${LIMIT_COLLECTION}/_global`, { active: { orphan: held }, day: '2026-09-16', starts: 1 });
    const lease = await repo.reserve('child', 'sheet', now, { ...CAPPED, concurrent: 1 });
    assert.ok(lease.id, 'a stale slot cannot hold live mode shut for ever');
    assert.deepEqual(Object.keys(db.data.get(`${LIMIT_COLLECTION}/_global`).active), [lease.id]);
  }
});

test('…but a slot from a lesson that really is running is kept', async () => {
  const { db, repo, now } = setup();
  db.data.set(`${LIMIT_COLLECTION}/_global`, { active: { live: now - 60000 }, day: '2026-09-16', starts: 1 });
  await assert.rejects(repo.reserve('child', 'sheet', now, { ...CAPPED, concurrent: 1 }), error => error.code === 'live_busy');
});

/* A SLOT THIS BUILD TAKES CARRIES THE TIME IT WAS TAKEN, and the check has
   to be made against a slot `reserve` really WROTE rather than one the
   harness planted: written as a flag it reads as `1` through `Number`, so
   the very next start sweeps it — and the ceiling the whole school shares
   stops holding at all, which looks exactly like live mode working. */
test('a slot a lesson is holding is not swept by the next start', async () => {
  const { db, repo, now } = setup();
  db.data.set('tutorWorksheets/other-sheet', { ownerUid: 'other-child' });
  const held = await repo.reserve('child', 'sheet', now, { ...CAPPED, concurrent: 1 });
  assert.equal(typeof db.data.get(`${LIMIT_COLLECTION}/_global`).active[held.id], 'number',
    'a slot with no time on it can never be told from an abandoned one');
  await assert.rejects(repo.reserve('other-child', 'other-sheet', now + 1000, { ...CAPPED, concurrent: 1 }),
    error => error.code === 'live_busy');
});

test('expired query includes abandoned reservations and excludes active lessons', async () => {
  const { repo, now } = setup();
  const pending = await repo.reserve('child', 'sheet', now, LIMITS);
  assert.deepEqual((await repo.expired(now + 61000)).map(lease => lease.id), [pending.id]);
  await repo.activate(pending, 'live-active');
  assert.deepEqual(await repo.expired(now + 61000), []);
  assert.deepEqual((await repo.expired(now + SECONDS * 1000)).map(lease => lease.id), [pending.id]);
});

test('user IDs cannot escape bookkeeping document paths', () => {
  assert.match(userKey('../other/user'), /^[a-f0-9]{64}$/);
});
