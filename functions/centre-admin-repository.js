'use strict';

const { createHash, randomUUID } = require('node:crypto');
const { CentreError, protectedIdentity, centreStudentKey } = require('./centre-auth');
const { cleanStudent } = require('./centre-admin-service');
// Audit records and creation receipts must be denied to every browser client.
const AUDIT_COLLECTION = 'tutorCentreAdmin';
const hash = value => createHash('sha256').update(value).digest('hex');
const conflict = () => new CentreError(409, 'student_changed', 'This student changed in another session. Refresh the roster and try again.');
function studentEntries(profile) {
  const entries = (Array.isArray(profile?.tutorOnboard?.students) ? profile.tutorOnboard.students : [])
    .map((value, rawIndex) => ({ rawIndex, value, student: typeof value === 'string'
      ? { name: value.trim(), level: '', subject: '' }
      : { name: String(value?.name || '').trim(), level: String(value?.level || ''), subject: String(value?.subject || '') } }))
    .filter(entry => entry.student.name);
  if (entries.length || !String(profile?.name || '').trim()) return entries;
  // Ans Key's hand-added rows predate this app's multi-child onboarding.
  return [{ rawIndex: -1, value: null, student: { name: String(profile.name).trim(),
    level: String(profile.level || ''), subject: String(profile.subject || '') } }];
}
function seedOnboarding(profile, students, time) {
  const existing = profile.tutorOnboard || {};
  const onboard = { ...existing, v: Math.max(2, Number(existing.v) || 0), students };
  // A recorded fee commitment survives an admin access edit. Only a legacy
  // centre record with no billing commitment receives the centre defaults.
  if (profile.managed === true && existing.payingFee !== true && existing.enrolled !== false && !String(existing.fee || '').trim()) {
    Object.assign(onboard, { parent: existing.parent || 'Centre student', enrolled: true, payingFee: false,
      fee: '', at: existing.at || new Date(time).toISOString() });
  }
  return onboard;
}
function selectStudent(profile, index, expected) {
  const entry = studentEntries(profile)[index];
  if (!entry || centreStudentKey(entry.student) !== centreStudentKey(expected)) throw conflict();
  return entry;
}
function rejectProtectedProfile(profile) {
  if (!profile) throw new CentreError(404, 'student_not_found', 'This account is no longer on the roster.');
  if (protectedIdentity(profile)) throw new CentreError(403, 'protected_account', 'Teacher and staff accounts cannot be used for student practice.');
}
function result(targetUid, profile, index) {
  const students = studentEntries(profile).map(entry => entry.student);
  return { targetUid, studentIndex: index, student: students[index], students, profile };
}
function createCentreRepository(db, auth) {
  const profiles = db.collection('studentProfiles'), audit = db.collection(AUDIT_COLLECTION);
  async function safeAuth(targetUid, actorUid, profile, allowCreate = false) {
    if (targetUid === actorUid) throw new CentreError(403, 'protected_account', 'Choose a student account, rather than the teacher account.');
    let account;
    try { account = await auth.getUser(targetUid); }
    catch (error) {
      if (error.code !== 'auth/user-not-found') throw error;
      if (!allowCreate || profile.managed !== true) throw new CentreError(409, 'account_missing', 'This account has no sign-in record. Add a centre student or ask them to sign in once.');
      // A legacy hand-added roster row may never have had a login. Its UID
      // stays the same so its existing work stays attached to this student.
      try { account = await auth.createUser({ uid: targetUid, displayName: studentEntries(profile)[0]?.student.name || 'Centre student' }); }
      catch (createError) {
        if (createError.code !== 'auth/uid-already-exists') throw createError;
        account = await auth.getUser(targetUid);
      }
    }
    if (protectedIdentity(account)) throw new CentreError(403, 'protected_account', 'Teacher, staff and disabled accounts cannot be used for student practice.');
    return account;
  }
  async function createStudent(actorUid, requestId, student, time) {
    const receipt = audit.doc('create_' + hash(actorUid + '|' + requestId));
    const targetUid = 'centre_' + hash(actorUid + '|' + requestId).slice(0, 48), ref = profiles.doc(targetUid);
    const fingerprint = centreStudentKey(student);
    await db.runTransaction(async tx => {
      const saved = (await tx.get(receipt)).data();
      if (saved && (saved.actorUid !== actorUid || saved.fingerprint !== fingerprint || saved.targetUid !== targetUid)) throw conflict();
      if (!saved) {
        if ((await tx.get(ref)).exists) throw conflict();
        tx.set(receipt, { action: 'createStudent', actorUid, targetUid, fingerprint, requestedAt: time, state: 'pending' });
      }
    });
    const initial = { name: student.name, level: student.level, subject: student.subject, managed: true,
      tutorCentre: { createdBy: actorUid, createdAt: time },
      tutorOnboard: { v: 2, parent: 'Centre student', enrolled: true, payingFee: false, fee: '', at: new Date(time).toISOString(), students: [student] } };
    await safeAuth(targetUid, actorUid, initial, true);
    return db.runTransaction(async tx => {
      const [saved, snapshot] = await Promise.all([tx.get(receipt), tx.get(ref)]);
      const data = saved.data();
      if (!data || data.fingerprint !== fingerprint) throw conflict();
      if (data.state === 'complete') {
        if (!snapshot.exists) throw new CentreError(409, 'student_removed', 'This student was already added and has since been removed. Refresh the roster.');
        return result(targetUid, snapshot.data(), 0);
      }
      if (snapshot.exists) throw conflict();
      tx.set(ref, initial);
      tx.set(receipt, { ...data, state: 'complete', completedAt: time });
      return result(targetUid, initial, 0);
    });
  }
  async function updateStudent(actorUid, targetUid, index, student, expected, time) {
    const ref = profiles.doc(targetUid), auditRef = audit.doc('update_' + randomUUID());
    const initial = (await ref.get()).data(); rejectProtectedProfile(initial);
    // Missing Auth on legacy hand-added profiles is repaired when practice
    // starts; editing their roster must still work before that first visit.
    try { await safeAuth(targetUid, actorUid, initial); }
    catch (error) { if (error.code !== 'account_missing' || initial.managed !== true) throw error; }
    return db.runTransaction(async tx => {
      const snapshot = await tx.get(ref), profile = snapshot.data(); rejectProtectedProfile(profile);
      const entry = selectStudent(profile, index, expected);
      // Adventure progress is keyed by the learner's name. An access edit
      // must never silently create a different adventure identity.
      if (student.name !== entry.student.name) throw new CentreError(400, 'student_name_locked', 'Keep this student’s name unchanged when editing level and subject access.');
      const legacy = entry.rawIndex === -1, students = legacy ? [] : profile.tutorOnboard.students.slice();
      students[legacy ? 0 : entry.rawIndex] = { ...(entry.value && typeof entry.value === 'object' ? entry.value : {}), ...student };
      const patch = { tutorOnboard: legacy ? seedOnboarding(profile, students, time) : { ...profile.tutorOnboard, students } };
      if (index === 0) { patch.level = student.level; patch.subject = student.subject; }
      if (!String(profile.name || '').trim() || (index === 0 && profile.name === entry.student.name)) patch.name = student.name;
      tx.update(ref, patch);
      tx.set(auditRef, { action: 'updateStudent', actorUid, targetUid, studentIndex: index, before: entry.student, after: student, at: time });
      return result(targetUid, { ...profile, ...patch }, index);
    });
  }
  async function startPractice(actorUid, targetUid, index, expected, time) {
    const ref = profiles.doc(targetUid), snapshot = await ref.get(), profile = snapshot.data();
    rejectProtectedProfile(profile);
    const entry = selectStudent(profile, index, expected);
    cleanStudent(entry.student);
    await safeAuth(targetUid, actorUid, profile, true);
    const auditRef = audit.doc('practice_' + randomUUID());
    return db.runTransaction(async tx => {
      let current = (await tx.get(ref)).data(); rejectProtectedProfile(current);
      const selected = selectStudent(current, index, expected);
      cleanStudent(selected.student);
      if (selected.rawIndex === -1) {
        const tutorOnboard = seedOnboarding(current, [selected.student], time);
        tx.update(ref, { tutorOnboard });
        current = { ...current, tutorOnboard };
      }
      tx.set(auditRef, { action: 'startPractice', actorUid, targetUid, studentIndex: index, studentKey: centreStudentKey(selected.student), at: time });
      return result(targetUid, current, index);
    });
  }
  return { createStudent, updateStudent, startPractice };
}
module.exports = { AUDIT_COLLECTION, studentEntries, selectStudent, createCentreRepository };
