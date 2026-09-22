'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createGameRepository, COLLECTIONS, boardId } = require('../gamification-repository');
const { POLICY, dayKey, weekInfo, learnerKey, questionKey, rankedRows, hash } = require('../gamification-core');

function database() {
  const data = new Map(); let tail = Promise.resolve();
  const snapshot = ref => ({ exists: data.has(ref.path), data: () => structuredClone(data.get(ref.path)) });
  const doc = path => ({ path, id: path.split('/').pop(), async get() { return snapshot(this); } });
  return { data, collection: name => ({ doc: id => doc(name + '/' + id) }),
    runTransaction(callback) {
      const next = tail.then(async () => {
        const writes = []; let wrote = false;
        const result = await callback({ async get(ref) { assert.equal(wrote, false, 'Firestore requires all reads before writes'); return snapshot(ref); },
          set(ref, value) { wrote = true; writes.push(() => data.set(ref.path, structuredClone(value))); } });
        for (const write of writes) write();
        return result;
      });
      tail = next.catch(() => {}); return next;
    }
  };
}
async function setup() {
  const db = database();
  db.data.set('studentProfiles/parent', { tutorOnboard: { students: [{ name: 'Alice', level: 'P5', subject: 'both' }, { name: 'Ben', level: 'P4', subject: 'science' }] }, tutorUsage: { marked: 90000 } });
  const repo = createGameRepository(db), now = Date.parse('2026-09-23T02:00:00Z');
  const context = await repo.resolve('parent', 0, 'science');
  const attempt = { kind: 'practice', question: 'Why does ice melt when placed in a warm room?', answer: 'It loses coldness.' };
  return { db, repo, now, context, attempt };
}
const wrong = { relevant: true, confident: true, correct: false };
const right = { relevant: true, confident: true, correct: true };
async function earn(h, attempt = h.attempt, verdict = wrong, now = h.now, context = h.context) {
  const reserved = await h.repo.reserve(context, attempt, now);
  return reserved.award || h.repo.award(context, reserved.lease, verdict, now);
}

test('profiles are scoped to authenticated account and stable student name, with no usage backfill', async () => {
  const h = await setup();
  assert.equal((await h.repo.snapshot(h.context, h.now)).profile.xp, 0);
  assert.equal(h.context.learnerKey, learnerKey('parent', 'alice'));
  assert.notEqual(h.context.learnerKey, (await h.repo.resolve('parent', 1, 'science')).learnerKey);
  await assert.rejects(h.repo.resolve('stranger', 0, 'science'), e => e.code === 'profile_required');
  await assert.rejects(h.repo.resolve('parent', 1, 'math'), e => e.code === 'subject_not_available');
  await assert.rejects(h.repo.resolve('parent', 1, 'science', h.context.learnerKey), e => e.code === 'profile_changed');
});

test('concurrent duplicate attempts reserve once and repeated marking/reupload cannot award twice', async () => {
  const h = await setup();
  const attempts = await Promise.allSettled([h.repo.reserve(h.context, h.attempt, h.now), h.repo.reserve(h.context, h.attempt, h.now)]);
  assert.equal(attempts.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(attempts.find(r => r.status === 'rejected').reason.code, 'already_checking');
  const lease = attempts.find(r => r.status === 'fulfilled').value.lease;
  assert.equal((await h.repo.award(h.context, lease, wrong, h.now)).xp, 15);
  assert.equal((await h.repo.award(h.context, lease, wrong, h.now)).xp, 0);
  assert.equal((await earn(h, { ...h.attempt, worksheetId: 'reupload', question: 'Q12.  WHY does ice melt when placed in a warm room?' })).duplicate, true);
  assert.equal((await h.repo.snapshot(h.context, h.now)).profile.completed, 1);
});

test('correction XP requires a previous independently verified wrong attempt and a verified correct retry', async () => {
  const h = await setup();
  const retry = { ...h.attempt, kind: 'correction', answer: 'The ice gains heat from the warmer surroundings.' };
  assert.equal((await earn(h, retry, right)).reason, 'practice_first');
  await earn(h);
  const incorrect = await earn(h, { ...retry, answer: 'Ice becomes solid.' }, wrong);
  assert.equal(incorrect.reason, 'keep_trying');
  assert.equal((await earn(h, retry, right)).xp, 35);
  assert.equal((await earn(h, retry, right)).xp, 0);
  const snap = await h.repo.snapshot(h.context, h.now);
  assert.equal(snap.profile.xp, 50); assert.equal(snap.profile.corrected, 1);
  assert.equal(snap.quests.find(q => q.id === 'correction').done, true);
});

test('a correct first attempt cannot be farmed with fake subsequent correction events', async () => {
  const h = await setup(); await earn(h, h.attempt, right);
  assert.equal((await earn(h, { ...h.attempt, kind: 'correction', answer: 'Changed answer' }, right)).xp, 0);
  assert.equal((await h.repo.snapshot(h.context, h.now)).profile.corrected, 0);
});

test('unconfident or irrelevant content cannot earn and identical rejected work is cached', async () => {
  const h = await setup();
  assert.equal((await earn(h, h.attempt, { ...right, confident: false })).reason, 'not_verified');
  assert.equal((await h.repo.reserve(h.context, h.attempt, h.now)).award.reason, 'not_verified');
  assert.equal((await earn(h, { ...h.attempt, answer: 'A revised relevant attempt.' }, { ...right, relevant: false })).xp, 0);
  assert.equal((await h.repo.snapshot(h.context, h.now)).profile.xp, 0);
});

test('daily quests award once across subjects, XP is capped, and the Singapore day resets independently', async () => {
  const h = await setup();
  for (let i = 0; i < 25; i++) await earn(h, { ...h.attempt, question: `Explain why substance number ${i} changes on heating.` });
  const snap = await h.repo.snapshot(h.context, h.now);
  assert.equal(snap.profile.xp, POLICY.dailyXpCap);
  assert.equal(snap.quests.find(q => q.id === 'practice').done, true);
  const nextDay = h.now + 86400000;
  assert.equal((await earn(h, { ...h.attempt, question: 'Describe how a different material changes on cooling.' }, wrong, nextDay)).xp, 15);
  const next = await h.repo.snapshot(h.context, nextDay);
  assert.equal(next.profile.streak, 2); assert.equal(next.profile.studyDays, 2);
  assert.equal(next.quests.find(q => q.id === 'practice').progress, 1);
});

test('only teacher-approved level and subject are competitive, and changing browser profile level cannot move scores', async () => {
  const h = await setup();
  await h.repo.preferences(h.context, { optIn: true }, h.now);
  await earn(h);
  assert.equal((await h.repo.snapshot(h.context, h.now)).leaderboard.status, 'approval_required');
  await h.repo.approveMember(h.context, true, 'teacher', h.now);
  assert.equal((await h.repo.snapshot(h.context, h.now)).leaderboard.totalParticipants, 0, 'no retroactive competitive points');
  await earn(h, { ...h.attempt, question: 'What happens to water when it boils?' });
  const snap = await h.repo.snapshot(h.context, h.now);
  assert.equal(snap.leaderboard.rows[0].xp, 10); assert.equal(snap.leaderboard.rows[0].isYou, true);
  const math = await h.repo.resolve('parent', 0, 'math');
  assert.equal((await h.repo.snapshot(math, h.now)).leaderboard.status, 'approval_required');
  h.db.data.get('studentProfiles/parent').tutorOnboard.students[0].level = 'P6';
  const moved = await h.repo.resolve('parent', 0, 'science');
  assert.equal((await h.repo.snapshot(moved, h.now)).leaderboard.status, 'approval_required');
  const stale = await h.repo.inspectMember(moved);
  assert.deepEqual(stale.memberships.science, { registered: true, approved: false, level: 'P5' });
  assert.deepEqual(stale.memberships.math, { registered: false, approved: false, level: 'P6' });
  await earn(h, { ...h.attempt, question: 'Explain how water vapour condenses on a cold surface.' }, wrong, h.now, moved);
  assert.equal(h.db.data.get(COLLECTIONS.boards + '/' + boardId(weekInfo(h.now).week, 'P5', 'science')).rows[h.context.learnerKey].xp, 10);
});

test('opt out and teacher revocation immediately remove rows; peers never receive UID or names', async () => {
  const h = await setup();
  await h.repo.approveMember(h.context, true, 'teacher', h.now);
  await h.repo.preferences(h.context, { optIn: true }, h.now);
  await earn(h);
  let snap = await h.repo.snapshot(h.context, h.now);
  assert.equal(snap.leaderboard.totalParticipants, 1);
  assert.ok(!JSON.stringify(snap.leaderboard).includes('Alice'));
  assert.ok(!JSON.stringify(snap.leaderboard).includes('parent'));
  await h.repo.preferences(h.context, { optIn: false }, h.now);
  assert.equal((await h.repo.snapshot(h.context, h.now)).leaderboard.totalParticipants, 0);
  await h.repo.preferences(h.context, { optIn: true }, h.now);
  assert.equal((await h.repo.snapshot(h.context, h.now)).leaderboard.totalParticipants, 1);
  await h.repo.approveMember(h.context, false, 'teacher', h.now);
  snap = await h.repo.snapshot(h.context, h.now);
  assert.equal(snap.leaderboard.status, 'approval_required');
  assert.equal(Object.keys(h.db.data.get(COLLECTIONS.boards + '/' + boardId(weekInfo(h.now).week, 'P5', 'science')).rows).length, 0);
});

test('weeks reset at Monday Singapore midnight without deleting lifetime XP; shared ranks are accurate', async () => {
  const before = Date.parse('2026-09-27T15:59:59Z'), after = before + 1000;
  assert.equal(dayKey(before), '2026-09-27'); assert.equal(dayKey(after), '2026-09-28');
  assert.equal(weekInfo(before).week, '2026-09-21'); assert.equal(weekInfo(after).week, '2026-09-28');
  assert.equal(weekInfo(before).resetsAt, after);
  const h = await setup(); await h.repo.approveMember(h.context, true, 'teacher', before);
  await h.repo.preferences(h.context, { optIn: true }, before); await earn(h, h.attempt, right, before);
  const reset = await h.repo.snapshot(h.context, after);
  assert.equal(reset.profile.xp, 15); assert.equal(reset.profile.weeklyXp, 0); assert.equal(reset.leaderboard.totalParticipants, 0);
  const ranks = rankedRows({ a: { alias: 'A', xp: 30 }, b: { alias: 'B', xp: 30 }, c: { alias: 'C', xp: 20 } }, 'c');
  assert.deepEqual(ranks.rows.map(r => r.rank), [1, 1, 3]); assert.equal(ranks.myRank, 3);
});

test('server enforces companion/frame unlocks and missed days end the visible streak', async () => {
  const h = await setup();
  await assert.rejects(h.repo.preferences(h.context, { companion: 'nova' }, h.now), e => e.code === 'companion_locked');
  await assert.rejects(h.repo.preferences(h.context, { frame: 'sunrise' }, h.now), e => e.code === 'frame_locked');
  await earn(h);
  assert.equal((await h.repo.snapshot(h.context, h.now + 3 * 86400000)).profile.streak, 0);
  const profile = h.db.data.get(COLLECTIONS.profiles + '/' + h.context.learnerKey); profile.xp = 800;
  await h.repo.preferences(h.context, { companion: 'nova', frame: 'starlight' }, h.now);
  const snap = await h.repo.snapshot(h.context, h.now);
  assert.equal(snap.profile.level, 5); assert.equal(snap.profile.companion, 'nova'); assert.equal(snap.profile.frame, 'starlight');
});

test('failed or expired verification leases can retry without stale results receiving XP', async () => {
  const h = await setup();
  const old = (await h.repo.reserve(h.context, h.attempt, h.now)).lease;
  const current = (await h.repo.reserve(h.context, h.attempt, h.now + 46000)).lease;
  await h.repo.release(old);
  assert.equal((await h.repo.award(h.context, old, right, h.now + 46001)).xp, 0);
  assert.equal((await h.repo.award(h.context, current, right, h.now + 46002)).xp, 15);
});

test('renaming a student does not reset the paid verification quota', async () => {
  const h = await setup();
  h.db.data.set(COLLECTIONS.events + '/_quota_' + hash('parent'), { day: dayKey(h.now), dayCount: POLICY.verificationsPerDay });
  h.db.data.get('studentProfiles/parent').tutorOnboard.students[0].name = 'Renamed student';
  const context = await h.repo.resolve('parent', 0, 'science');
  await assert.rejects(h.repo.reserve(context, h.attempt, h.now), e => e.code === 'reward_check_limit');
});

test('fingerprints preserve meaningful answer-independent identity across case, spacing and question numbering', () => {
  assert.equal(questionKey('science', 'Q1. Why does ice melt in a warm room?', ''), questionKey('science', 'WHY does ice melt in a warm room?', ''));
  assert.notEqual(questionKey('science', 'Why does ice melt in a warm room?', ''), questionKey('science', 'Why does water boil in a hot pan?', ''));
  assert.notEqual(questionKey('math', 'Calculate 20 - 15 now.', ''), questionKey('math', 'Calculate 20 + 15 now.', ''));
  assert.notEqual(questionKey('math', 'Calculate 20.5 plus 15.', ''), questionKey('math', 'Calculate 205 plus 15.', ''));
  assert.notEqual(questionKey('math', 'Calculate 2/5 plus 15.', ''), questionKey('math', 'Calculate 25 plus 15.', ''));
  assert.notEqual(questionKey('math', '20.5 plus fifteen?', ''), questionKey('math', '5 plus fifteen?', ''));
});

test('parallel distinct completions award each daily quest once and never exceed the daily cap', async () => {
  const h = await setup();
  const attempts = [1, 2, 3, 4].map(i => ({ ...h.attempt, question: `Explain why object number ${i} melts in sunlight.` }));
  const leases = await Promise.all(attempts.map(attempt => h.repo.reserve(h.context, attempt, h.now)));
  const awards = await Promise.all(leases.map(({ lease }) => h.repo.award(h.context, lease, right, h.now)));
  assert.equal(awards.reduce((sum, award) => sum + award.xp, 0), 60);
  assert.equal((await h.repo.snapshot(h.context, h.now)).profile.xp, 60);
  const profile = h.db.data.get(COLLECTIONS.profiles + '/' + h.context.learnerKey);
  profile.daily.xp = 195;
  const a = { ...h.attempt, question: 'Explain why plant number five needs sunlight.' }, b = { ...h.attempt, question: 'Explain why plant number six needs sunlight.' };
  const reserved = await Promise.all([a, b].map(attempt => h.repo.reserve(h.context, attempt, h.now)));
  const capped = await Promise.all(reserved.map(({ lease }) => h.repo.award(h.context, lease, right, h.now)));
  assert.equal(capped.reduce((sum, award) => sum + award.xp, 0), 5);
  assert.equal(h.db.data.get(COLLECTIONS.profiles + '/' + h.context.learnerKey).daily.xp, 200);
});

test('a clearer question image can retry an unverified answer without resetting question identity', async () => {
  const h = await setup();
  await earn(h, { ...h.attempt, questionImage: 'data:image/png;base64,YQ==' }, { ...right, confident: false });
  assert.equal((await earn(h, { ...h.attempt, questionImage: 'data:image/png;base64,Yg==' }, right)).xp, 15);
  assert.equal((await earn(h, { ...h.attempt, questionImage: 'data:image/png;base64,Yw==' }, right)).xp, 0);
});

test('teacher revocation can remove an old subject after a parent edits enrolment', async () => {
  const h = await setup();
  const approved = await h.repo.approveMember(h.context, true, 'teacher', h.now);
  assert.equal(approved.approved, true);
  h.db.data.get('studentProfiles/parent').tutorOnboard.students[0].subject = 'math';
  await assert.rejects(h.repo.resolve('parent', 0, 'science'), e => e.code === 'subject_not_available');
  const adminContext = await h.repo.resolve('parent', 0, 'science', undefined, true);
  const result = await h.repo.approveMember(adminContext, false, 'teacher', h.now);
  assert.equal(result.approved, false); assert.equal(result.memberships.science.approved, false); assert.equal(result.memberships.science.registered, false);
});
