'use strict';

const { randomUUID } = require('node:crypto');
const { TeachError, POLICY, hash, LEVELS, clip } = require('./fast-tutor-core');
const { dayKey } = require('./live-repository');

function createTeachRepository(db) {
  const root = uid => db.collection('studyBuddyLiveLimits').doc(hash(uid));
  const packRef = (uid, worksheetId, page) => root(uid).collection('teachingPacks').doc(hash(worksheetId) + '_' + page);
  const usageRef = uid => root(uid).collection('teachingUsage').doc('current');
  async function resolve(uid, body) {
    const [worksheetSnap, profileSnap] = await Promise.all([
      db.collection('tutorWorksheets').doc(body.worksheetId).get(), db.collection('studentProfiles').doc(uid).get()
    ]);
    const w = worksheetSnap.data();
    if (!w || w.ownerUid !== uid) throw new TeachError(403, 'worksheet_not_owned', 'Open one of your saved worksheets to use the tutor.');
    if (Number(w.pageCount) > 0 && body.page > Number(w.pageCount)) throw new TeachError(400, 'invalid_page', 'Open a page from this worksheet.');
    let a = null;
    if (w.assignmentId) {
      if (typeof w.assignmentId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(w.assignmentId)) throw new TeachError(409, 'worksheet_changed', 'Reopen this worksheet to refresh its teaching settings.');
      const snap = await db.collection('tutorAssignments').doc(w.assignmentId).get();
      if (snap.exists && snap.data().active) a = snap.data();
    }
    const guidance = a?.guidanceLocked ? a.guidance : w.guidance;
    const worksheetGuidance = LEVELS.includes(guidance) ? guidance : 'method';
    // Live tutoring has always left the final step to the learner, including
    // worksheets whose separate on-demand hint ladder allows full answers.
    const ceiling = worksheetGuidance === 'answer' ? 'method' : worksheetGuidance;
    let savedBody = {};
    if (typeof w.body === 'string' && w.body.length < 1000000) { try { savedBody = JSON.parse(w.body); } catch { /* data is only supplementary */ } }
    const keyPages = [...new Set([...(Array.isArray(w.keyPages) ? w.keyPages : []), ...(Array.isArray(a?.keyPages) ? a.keyPages : []), ...(Array.isArray(savedBody.key?.pages) ? savedBody.key.pages : [])].map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= 1000))];
    if (keyPages.includes(body.page)) throw new TeachError(403, 'key_page', 'Choose a question page for your lesson.');
    const rows = Array.isArray(a?.keyRows) ? a.keyRows : Array.isArray(savedBody.key?.rows) ? savedBody.key.rows : [];
    const students = profileSnap.data()?.tutorOnboard?.students || [];
    const student = students.filter(s => s && (typeof s === 'string' ? s.trim() : String(s.name || '').trim()))[body.studentIndex];
    const learner = hash(uid + '|' + body.studentIndex + '|' + (typeof student === 'string' ? student : student?.name || 'account'));
    const authority = {
      ceiling, worksheetGuidance, level: clip(a?.level || w.level, 40), subject: clip(a?.subject || w.subject, 40), pageCount: Number(w.pageCount) || 0,
      assignmentId: w.assignmentId || '', locked: Boolean(a?.guidanceLocked), storagePath: clip(a?.storagePath || w.storagePath, 1000),
      keyPath: clip(a?.keyPath || w.keyPath || savedBody.key?.path, 1000), keyPages,
      keyRows: rows.slice(0, 400), bodyPath: clip(w.bodyPath, 1000),
      // Assignment writes are teacher-owned. createdAt changes when it is
      // republished; hashing its entire teaching metadata invalidates old packs.
      assignmentRevision: a ? hash(JSON.stringify({ guidance: a.guidance, keyRows: a.keyRows || [], keyPages: a.keyPages || [], keyPath: a.keyPath || '', createdAt: a.createdAt || null, updatedAt: a.updatedAt || null })) : ''
    };
    return { uid, learner, authority, ceiling };
  }
  async function read(context, body) { return (await packRef(context.uid, body.worksheetId, body.page).get()).data() || null; }
  async function reserve(context, body, kind, now) {
    const id = randomUUID(), ref = usageRef(context.uid), pageRef = packRef(context.uid, body.worksheetId, body.page);
    const lease = { id, uid: context.uid, kind, pageId: pageRef.id, createdAt: now };
    await db.runTransaction(async tx => {
      const snap = await tx.get(ref), data = snap.data() || {};
      const active = Object.fromEntries(Object.entries(data.active || {}).filter(([, v]) => v.at > now - POLICY.leaseMs));
      if (Object.values(active).filter(v => v.kind === kind).length >= (kind === 'prepare' ? 1 : 2)) throw new TeachError(409, 'teaching_busy', 'The tutor is already preparing guidance.');
      const day = dayKey(now), minute = Math.floor(now / 60000);
      const dayCount = data.day === day ? Number(data.dayCount || 0) : 0;
      const prepCount = data.day === day ? Number(data.prepCount || 0) : 0;
      const minuteCount = data.minute === minute ? Number(data.minuteCount || 0) : 0;
      if (dayCount >= POLICY.paidPerDay || minuteCount >= POLICY.paidPerMinute || (kind === 'prepare' && prepCount >= POLICY.prepPerDay)) throw new TeachError(429, 'teaching_limit', 'Fast preparation is resting. Your usual tutor is still available.');
      active[id] = { at: now, kind };
      let pages = Array.isArray(data.pages) ? data.pages.filter(p => p.id !== pageRef.id) : [];
      if (kind === 'prepare') {
        pages.push({ id: pageRef.id, at: now });
        while (pages.length > POLICY.cachedPages) tx.delete(root(context.uid).collection('teachingPacks').doc(pages.shift().id));
      } else pages = data.pages || [];
      tx.set(ref, { day, dayCount: dayCount + 1, prepCount: prepCount + (kind === 'prepare' ? 1 : 0), minute, minuteCount: minuteCount + 1, active, pages });
    });
    return lease;
  }
  async function release(lease) {
    const ref = usageRef(lease.uid);
    await db.runTransaction(async tx => {
      const snap = await tx.get(ref), data = snap.data();
      if (!data?.active?.[lease.id]) return;
      const active = { ...data.active }; delete active[lease.id];
      tx.update(ref, { active });
    });
  }
  async function save(context, body, pack) { await packRef(context.uid, body.worksheetId, body.page).set(pack); }
  return { resolve, read, reserve, release, save };
}
module.exports = { createTeachRepository };
