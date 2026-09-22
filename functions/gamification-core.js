'use strict';

const { createHash } = require('node:crypto');

const SUBJECTS = ['math', 'science', 'english', 'chinese'];
const LEVELS = ['P3', 'P4', 'P5', 'P6', 'S1'];
const POLICY = Object.freeze({ practiceXp: 10, correctionXp: 15, dailyXpCap: 200, verificationsPerDay: 120, verificationsPerMinute: 30, groupSize: 300 });
const COMPANIONS = Object.freeze({ orbit: 0, pip: 400, nova: 800 });
const FRAMES = Object.freeze({ none: 0, sunrise: 400, starlight: 800 });
const QUESTS = Object.freeze([
  { id: 'study', label: 'Make time to learn', target: 1, xp: 5 },
  { id: 'practice', label: 'Practise three questions', target: 3, xp: 15 },
  { id: 'correction', label: 'Turn a mistake into progress', target: 1, xp: 20 }
]);
class GameError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
const hash = value => createHash('sha256').update(value).digest('hex');
const dayKey = now => new Date(now + 8 * 3600000).toISOString().slice(0, 10);
function weekInfo(now) {
  const local = new Date(now + 8 * 3600000);
  const monday = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - (local.getUTCDay() + 6) % 7);
  return { week: new Date(monday).toISOString().slice(0, 10), resetsAt: monday + 7 * 86400000 - 8 * 3600000 };
}
function normalize(value) { return String(value || '').normalize('NFKC').toLowerCase().replace(/\s+/gu, ' ').trim(); }
function learnerKey(uid, name) { return hash(uid + '\n' + normalize(name)); }
function questionKey(subject, question, image) {
  // Ignore worksheet IDs, question numbering and cosmetic whitespace. Reuploading
  // or moving an unchanged question cannot mint another reward.
  // Mathematical punctuation is content: removing '/' or '.' would merge
  // fractions and decimals, and removing '-' would merge different problems.
  const text = normalize(question).replace(/^(?:(?:question|q)\s*\d+[.)\]:]\s*|\d+[.)\]:]\s+)/u, '').replace(/\s+/gu, '').replace(/[?!.。！？]+$/gu, '');
  return hash(subject + '\n' + (text.length >= 12 ? text : text + '\n' + (image ? hash(image) : '')));
}
function aliasFor(key) {
  const first = ['Brave', 'Curious', 'Bright', 'Kind', 'Clever', 'Happy', 'Cosmic', 'Mighty'];
  const second = ['Comet', 'Otter', 'Panda', 'Falcon', 'Star', 'Lynx', 'Dolphin', 'Maple'];
  return first[parseInt(key.slice(0, 2), 16) % first.length] + ' ' + second[parseInt(key.slice(2, 4), 16) % second.length] + ' ' + key.slice(4, 8).toUpperCase();
}
function initialProfile(context) {
  return { uid: context.uid, learnerKey: context.learnerKey, alias: aliasFor(context.learnerKey), companion: 'orbit', frame: 'none', optIn: false,
    xp: 0, completed: 0, corrected: 0, streak: 0, bestStreak: 0, studyDays: 0, activeDays: [], memberships: {}, daily: {}, weekly: {} };
}
function dayProgress(profile, now) {
  return profile.daily?.day === dayKey(now) ? profile.daily : { day: dayKey(now), study: 0, practice: 0, correction: 0, xp: 0, quests: [] };
}
function questsFor(profile, now) {
  const day = dayProgress(profile, now);
  return QUESTS.map(q => ({ ...q, progress: Math.min(q.target, day[q.id] || 0), done: (day[q.id] || 0) >= q.target }));
}
function publicProfile(profile, now) {
  const xp = profile.xp || 0;
  const week = weekInfo(now).week;
  const activeDays = (profile.activeDays || []).slice(-35);
  const tests = [
    ['first-step', 'First steps', profile.completed >= 1], ['comeback', 'Comeback kid', profile.corrected >= 1],
    ['steady-three', 'Three-day spark', profile.bestStreak >= 3], ['ten-questions', 'Curious explorer', profile.completed >= 10],
    ['level-three', 'Adventure unlocked', xp >= 400], ['level-five', 'Star scholar', xp >= 800],
    ['ten-comebacks', 'Resilience star', profile.corrected >= 10]
  ];
  // A missed day should visibly end the streak without a scheduled writer.
  const yesterday = dayKey(now - 86400000);
  const streak = [dayKey(now), yesterday].includes(profile.lastDay) ? profile.streak : 0;
  return { learnerKey: profile.learnerKey, alias: profile.alias, companion: profile.companion, frame: profile.frame, optIn: profile.optIn,
    xp, level: Math.floor(xp / 200) + 1, levelProgress: xp % 200, nextLevelXp: 200,
    completed: profile.completed || 0, corrected: profile.corrected || 0, streak: streak || 0, bestStreak: profile.bestStreak || 0,
    studyDays: profile.studyDays || 0, activeDays, currentWeekDays: activeDays.filter(day => day >= week), weeklyXp: profile.weekly?.week === week ? profile.weekly.xp : 0,
    badges: tests.map(([id, label, earned]) => ({ id, label, earned: Boolean(earned) })),
    unlockedCompanions: Object.keys(COMPANIONS).filter(id => xp >= COMPANIONS[id]), unlockedFrames: Object.keys(FRAMES).filter(id => xp >= FRAMES[id]) };
}
function rankedRows(rows, key) {
  const sorted = Object.entries(rows || {}).filter(([, row]) => row.xp > 0).sort((a, b) => b[1].xp - a[1].xp || a[0].localeCompare(b[0]));
  let lastXp = -1, rank = 0;
  const all = sorted.map(([id, row], index) => {
    if (row.xp !== lastXp) rank = index + 1;
    lastXp = row.xp;
    return { alias: row.alias, companion: row.companion, frame: row.frame, xp: row.xp, rank, isYou: id === key };
  });
  const me = all.findIndex(row => row.isYou);
  const visible = new Set([0, 1, 2]);
  if (me >= 0) for (let i = Math.max(0, me - 2); i <= Math.min(all.length - 1, me + 2); i++) visible.add(i);
  else for (let i = 3; i < Math.min(10, all.length); i++) visible.add(i);
  return { rows: all.filter((_, i) => visible.has(i)), myRank: me >= 0 ? all[me].rank : null, totalParticipants: all.length };
}

module.exports = { SUBJECTS, LEVELS, POLICY, COMPANIONS, FRAMES, QUESTS, GameError, hash, dayKey, weekInfo, normalize, learnerKey, questionKey, initialProfile, dayProgress, questsFor, publicProfile, rankedRows };
