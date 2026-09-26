'use strict';

const { randomUUID } = require('node:crypto');
const { SUBJECTS, LEVELS, POLICY, COMPANIONS, FRAMES, QUESTS, GameError, hash, dayKey, weekInfo, normalize, learnerKey, questionKey,
  initialProfile, dayProgress, questsFor, publicProfile, rankedRows } = require('./gamification-core');

// These four collections MUST remain inaccessible through the browser SDK.
const COLLECTIONS = Object.freeze({ profiles: 'tutorGameProfiles', events: 'tutorGameEvents', boards: 'tutorGameBoards', groups: 'tutorGameGroups' });
const groupId = (level, subject) => level + '_' + subject;
const boardId = (week, level, subject) => week + '_' + groupId(level, subject);
const blankAward = reason => ({ xp: 0, baseXp: 0, questXp: 0, kind: '', duplicate: reason === 'already_rewarded', reason });
function eligible(profile, context) { return profile.memberships?.[context.subject]?.level === context.level; }

function createGameRepository(db) {
  const profiles = db.collection(COLLECTIONS.profiles);
  const events = db.collection(COLLECTIONS.events);
  const boards = db.collection(COLLECTIONS.boards);
  const groups = db.collection(COLLECTIONS.groups);

  async function resolve(uid, studentIndex, subject, expectedKey, allowUnavailableSubject = false) {
    const account = await db.collection('studentProfiles').doc(uid).get();
    const students = (account.data()?.tutorOnboard?.students || []).filter(s => s && normalize(typeof s === 'string' ? s : s.name));
    const student = students[studentIndex];
    if (!student || !LEVELS.includes(student.level)) throw new GameError(409, 'profile_required', 'Complete your student profile to start this adventure.');
    const subjects = student.level === 'P3' ? ['science'] : student.subject === 'both' ? ['math', 'science'] : [student.subject];
    if (!allowUnavailableSubject && !subjects.includes(subject)) throw new GameError(403, 'subject_not_available', 'Choose a subject from this student profile.');
    const key = learnerKey(uid, student.name);
    if (expectedKey && expectedKey !== key) throw new GameError(409, 'profile_changed', 'The active student changed. Refresh your adventure and try again.');
    return { uid, learnerKey: key, subject, level: student.level, student };
  }

  async function snapshot(context, now) {
    const saved = await profiles.doc(context.learnerKey).get();
    const profile = saved.data() || initialProfile(context);
    const week = weekInfo(now);
    const leaderboard = { status: eligible(profile, context) ? 'ready' : 'approval_required', subject: context.subject, level: context.level,
      ...week, rows: [], myRank: null, totalParticipants: 0 };
    if (leaderboard.status === 'ready') {
      const board = await boards.doc(boardId(week.week, context.level, context.subject)).get();
      Object.assign(leaderboard, rankedRows(board.data()?.rows, context.learnerKey));
    }
    return { profile: publicProfile(profile, now), quests: questsFor(profile, now), leaderboard, policy: POLICY, serverTime: now };
  }

  async function preferences(context, changes, now) {
    const ref = profiles.doc(context.learnerKey);
    await db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      const profile = snap.data() || initialProfile(context);
      const xp = profile.xp || 0;
      if (changes.companion && xp < COMPANIONS[changes.companion]) throw new GameError(403, 'companion_locked', 'Keep learning to unlock this companion.');
      if (changes.frame && xp < FRAMES[changes.frame]) throw new GameError(403, 'frame_locked', 'Keep learning to unlock this frame.');
      const week = weekInfo(now).week;
      const refs = Object.entries(profile.memberships || {}).map(([subject, member]) => ({ subject, ref: boards.doc(boardId(week, member.level, subject)) }));
      const currentBoards = await Promise.all(refs.map(item => tx.get(item.ref)));
      if (changes.companion) profile.companion = changes.companion;
      if (changes.frame) profile.frame = changes.frame;
      if (typeof changes.optIn === 'boolean') profile.optIn = changes.optIn;
      for (let i = 0; i < refs.length; i++) {
        const item = refs[i], data = currentBoards[i].data();
        const score = profile.weekly?.week === week ? profile.weekly.bySubject?.[item.subject] || 0 : 0;
        if (!data && (!profile.optIn || !score)) continue;
        const rows = { ...(data?.rows || {}) };
        if (profile.optIn && score > 0) rows[context.learnerKey] = boardRow(profile, score);
        else delete rows[context.learnerKey];
        tx.set(item.ref, { week, rows });
      }
      tx.set(ref, profile);
    });
  }

  async function reserve(context, attempt, now) {
    const fingerprint = questionKey(context.subject, attempt.question, attempt.questionImage);
    const eventRef = events.doc(context.learnerKey + '_' + fingerprint);
    const profileRef = profiles.doc(context.learnerKey);
    // Quotas belong to the authenticated account, so changing a sibling/name
    // cannot bypass paid verification limits.
    const quotaRef = events.doc('_quota_' + hash(context.uid));
    const lease = { id: randomUUID(), key: eventRef.id || context.learnerKey + '_' + fingerprint, learnerKey: context.learnerKey, kind: attempt.kind,
      inputHash: hash(normalize(attempt.answer) + '\n' + (attempt.questionImage ? hash(attempt.questionImage) : '')), subject: context.subject };
    return db.runTransaction(async tx => {
      const [profileSnap, eventSnap, quotaSnap] = await Promise.all([tx.get(profileRef), tx.get(eventRef), tx.get(quotaRef)]);
      const profile = profileSnap.data() || initialProfile(context);
      const event = eventSnap.data() || {};
      if (event.completed && (attempt.kind === 'practice' || event.corrected || !event.wasIncorrect)) return { award: blankAward('already_rewarded') };
      if (attempt.kind === 'correction' && !event.wasIncorrect) return { award: blankAward('practice_first') };
      if (dayProgress(profile, now).xp >= POLICY.dailyXpCap) return { award: blankAward('daily_cap') };
      if (event.pending && event.pendingAt > now - 45000) throw new GameError(409, 'already_checking', 'This answer is already being checked for rewards.');
      if (event.lastInputHash === lease.inputHash && event.lastKind === attempt.kind && event.lastReason && event.lastReason !== 'verification_unavailable') return { award: blankAward(event.lastReason) };
      const quota = quotaSnap.data() || {};
      const day = dayKey(now), minute = Math.floor(now / 60000);
      const dayCount = quota.day === day ? quota.dayCount || 0 : 0;
      const minuteCount = quota.minute === minute ? quota.minuteCount || 0 : 0;
      if (dayCount >= POLICY.verificationsPerDay || minuteCount >= POLICY.verificationsPerMinute) throw new GameError(429, 'reward_check_limit', 'Reward checking is resting for a while. You can keep practising.');
      tx.set(quotaRef, { day, dayCount: dayCount + 1, minute, minuteCount: minuteCount + 1 });
      tx.set(profileRef, profile);
      tx.set(eventRef, { ...event, learnerKey: context.learnerKey, subject: context.subject, pending: lease.id, pendingAt: now });
      return { lease };
    });
  }

  async function release(lease) {
    const ref = events.doc(lease.key);
    await db.runTransaction(async tx => {
      const snap = await tx.get(ref), event = snap.data();
      if (event?.pending === lease.id) tx.set(ref, { ...event, pending: null, pendingAt: null });
    });
  }

  async function award(context, lease, verdict, now) {
    const eventRef = events.doc(lease.key), profileRef = profiles.doc(context.learnerKey);
    return db.runTransaction(async tx => {
      const [profileSnap, eventSnap] = await Promise.all([tx.get(profileRef), tx.get(eventRef)]);
      const profile = profileSnap.data() || initialProfile(context), event = eventSnap.data();
      if (!event || event.pending !== lease.id) return blankAward('already_rewarded');
      const week = weekInfo(now).week, day = dayKey(now);
      const boardRef = boards.doc(boardId(week, context.level, context.subject));
      const board = eligible(profile, context) ? await tx.get(boardRef) : null;
      const finish = reason => {
        tx.set(eventRef, { ...event, pending: null, pendingAt: null, lastInputHash: lease.inputHash, lastKind: lease.kind, lastReason: reason });
        return blankAward(reason);
      };
      if (!verdict.confident || !verdict.relevant) return finish('not_verified');
      if (lease.kind === 'correction' && (!verdict.correct || !event.wasIncorrect || event.corrected)) return finish(verdict.correct ? 'already_rewarded' : 'keep_trying');
      const daily = { ...dayProgress(profile, now), quests: [...(dayProgress(profile, now).quests || [])] };
      if (daily.xp >= POLICY.dailyXpCap) return finish('daily_cap');
      const kind = lease.kind;
      daily.study = 1;
      daily[kind] = (daily[kind] || 0) + 1;
      const baseXp = kind === 'practice' ? POLICY.practiceXp : POLICY.correctionXp;
      let questXp = 0;
      for (const quest of QUESTS) if (daily[quest.id] >= quest.target && !daily.quests.includes(quest.id)) {
        daily.quests.push(quest.id); questXp += quest.xp;
      }
      const xp = Math.min(baseXp + questXp, POLICY.dailyXpCap - daily.xp);
      daily.xp += xp;
      if (profile.lastDay !== day) {
        profile.streak = profile.lastDay === dayKey(now - 86400000) ? (profile.streak || 0) + 1 : 1;
        profile.bestStreak = Math.max(profile.bestStreak || 0, profile.streak);
        profile.studyDays = (profile.studyDays || 0) + 1;
        profile.activeDays = [...(profile.activeDays || []), day].slice(-35);
        profile.lastDay = day;
      }
      profile.xp = (profile.xp || 0) + xp;
      profile[kind === 'practice' ? 'completed' : 'corrected']++;
      profile.daily = daily;
      const weekly = profile.weekly?.week === week ? { ...profile.weekly, bySubject: { ...profile.weekly.bySubject } } : { week, xp: 0, bySubject: {} };
      weekly.xp += xp;
      // Only XP earned while teacher approval is current is competitive; new
      // approval never backfills scores from an unapproved/self-edited profile.
      if (eligible(profile, context)) weekly.bySubject[context.subject] = (weekly.bySubject[context.subject] || 0) + xp;
      profile.weekly = weekly;
      if (eligible(profile, context) && profile.optIn) {
        const rows = { ...(board?.data()?.rows || {}) };
        rows[context.learnerKey] = boardRow(profile, weekly.bySubject[context.subject]);
        tx.set(boardRef, { week, rows });
      }
      tx.set(profileRef, profile);
      tx.set(eventRef, { ...event, pending: null, pendingAt: null, completed: true, wasIncorrect: event.completed ? Boolean(event.wasIncorrect) : !verdict.correct,
        corrected: Boolean(event.corrected || kind === 'correction'), lastInputHash: lease.inputHash, lastKind: kind, lastReason: 'already_rewarded', awardedAt: now });
      return { xp, baseXp: Math.min(baseXp, xp), questXp: Math.max(0, xp - baseXp), kind, duplicate: false, reason: 'earned' };
    });
  }

  function boardRow(profile, xp) { return { alias: profile.alias, companion: profile.companion, frame: profile.frame, xp }; }

  async function inspectMember(context) {
    const snap = await profiles.doc(context.learnerKey).get(), profile = snap.data() || initialProfile(context);
    return { learnerKey: context.learnerKey, alias: profile.alias, memberships: Object.fromEntries(SUBJECTS.map(subject => [subject,
      { registered: Boolean(profile.memberships?.[subject]), approved: profile.memberships?.[subject]?.level === context.level,
        level: profile.memberships?.[subject]?.level || context.level }])) };
  }

  async function approveMember(context, approved, teacherUid, now) {
    const profileRef = profiles.doc(context.learnerKey);
    await db.runTransaction(async tx => {
      const snap = await tx.get(profileRef), profile = snap.data() || initialProfile(context);
      const previous = profile.memberships?.[context.subject];
      const levels = [...new Set([context.level, previous?.level].filter(Boolean))];
      const week = weekInfo(now).week;
      const refs = levels.map(level => ({ level, group: groups.doc(groupId(level, context.subject)), board: boards.doc(boardId(week, level, context.subject)) }));
      const groupSnaps = await Promise.all(refs.map(item => tx.get(item.group)));
      const boardSnaps = await Promise.all(refs.map(item => tx.get(item.board)));
      for (let i = 0; i < refs.length; i++) {
        const item = refs[i], members = { ...(groupSnaps[i].data()?.members || {}) };
        const keep = approved && item.level === context.level;
        if (keep) {
          if (!members[context.learnerKey] && Object.keys(members).length >= POLICY.groupSize) throw new GameError(409, 'group_full', 'This learning group is full.');
          members[context.learnerKey] = true;
        } else delete members[context.learnerKey];
        tx.set(item.group, { level: item.level, subject: context.subject, members });
        if (boardSnaps[i].exists && (!keep || previous?.level !== context.level)) {
          const rows = { ...boardSnaps[i].data().rows }; delete rows[context.learnerKey];
          tx.set(item.board, { week, rows });
        }
      }
      profile.memberships = { ...(profile.memberships || {}) };
      if (approved) profile.memberships[context.subject] = { level: context.level, approvedBy: teacherUid, approvedAt: now };
      else delete profile.memberships[context.subject];
      if (!approved || previous?.level !== context.level) {
        if (profile.weekly?.week === week) profile.weekly.bySubject = { ...profile.weekly.bySubject, [context.subject]: 0 };
      }
      tx.set(profileRef, profile);
    });
    return { ...await inspectMember(context), approved };
  }
  return { resolve, snapshot, preferences, reserve, release, award, inspectMember, approveMember };
}

module.exports = { COLLECTIONS, groupId, boardId, createGameRepository };
