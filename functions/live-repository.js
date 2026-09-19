'use strict';

const { randomUUID, createHash } = require('node:crypto');
const { LiveError } = require('./live-service');

// These collections are server-only; do not add client read/write rules for
// them. Admin SDK bypasses the shared project's default-deny Firestore rules.
const SESSION_COLLECTION = 'studyBuddyLiveSessions';
const LIMIT_COLLECTION = 'studyBuddyLiveLimits';
function userKey(uid) { return createHash('sha256').update(uid).digest('hex'); }
function dayKey(now) { return new Date(now + 8 * 3600000).toISOString().slice(0, 10); }

function createRepository(db) {
  const sessions = db.collection(SESSION_COLLECTION);
  const limits = db.collection(LIMIT_COLLECTION);
  const globalRef = limits.doc('_global');

  async function reserve(uid, worksheetId, now, policy) {
    const id = randomUUID();
    const ownerKey = userKey(uid);
    const ownerRef = limits.doc(ownerKey);
    const day = dayKey(now);
    const lease = {
      id, uid, ownerKey, worksheetId, sessionId: null,
      createdAt: now, expiresAt: now + policy.durationSeconds * 1000,
      cleanupAt: now + 60000
    };
    await db.runTransaction(async tx => {
      const [worksheet, owner, global] = await Promise.all([
        tx.get(db.collection('tutorWorksheets').doc(worksheetId)), tx.get(ownerRef), tx.get(globalRef)
      ]);
      if (!worksheet.exists || worksheet.data().ownerUid !== uid) {
        throw new LiveError(403, 'worksheet_not_owned', 'Open one of your saved worksheets before starting a live lesson.');
      }
      const ownerData = owner.data() || {};
      const globalData = global.data() || {};
      if (ownerData.currentLease) throw new LiveError(409, 'lesson_already_active', 'A live lesson is already open on this account. End it before starting another.');
      const starts = ownerData.day === day ? Number(ownerData.starts || 0) : 0;
      if (starts >= policy.startsPerDay) {
        throw new LiveError(429, 'daily_limit', `You have used today's ${policy.startsPerDay} live lessons. They come back at midnight; the text buddy is still there in the meantime.`);
      }
      /* A SLOT LETS GO OF ITSELF. Every entry carries the moment it was
         taken, and one older than a whole lesson plus a minute cannot be a
         lesson still running — it is a reservation whose release never
         landed, because the tab was closed, the network dropped or the
         close itself failed. The scheduled sweep clears those too, but it
         is a SEPARATE function: deploy the endpoint without it and a
         handful of dropped tabs takes live mode away from the whole school
         PERMANENTLY, with every screen saying "try again in a little
         while" about something that is never going to come back. An entry
         written before this shipped is `true` rather than a number, and is
         let go for exactly the same reason. */
      const active = {};
      const staleBefore = now - (policy.durationSeconds * 1000 + 60000);
      Object.keys(globalData.active || {}).forEach(key => {
        if (Number(globalData.active[key]) > staleBefore) active[key] = globalData.active[key];
      });
      const globalStarts = globalData.day === day ? Number(globalData.starts || 0) : 0;
      if (Object.keys(active).length >= policy.concurrent || globalStarts >= policy.globalStartsPerDay) {
        throw new LiveError(429, 'live_busy', 'Live tutoring is busy or has reached today\'s allowance. Please use the text buddy and try again later.');
      }
      active[id] = now;
      tx.set(ownerRef, { day, starts: starts + 1, currentLease: id });
      tx.set(globalRef, { day, starts: globalStarts + 1, active });
      tx.set(sessions.doc(id), lease);
    });
    return lease;
  }

  async function activate(lease, sessionId) {
    await db.runTransaction(async tx => {
      const ref = sessions.doc(lease.id);
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error('Live reservation expired.');
      tx.update(ref, { sessionId, cleanupAt: lease.expiresAt });
    });
  }

  async function recover(lease) {
    // Keep the provider ID discoverable if activation failed after the paid
    // call was created. Do not postpone the expiry of the original lease.
    await sessions.doc(lease.id).set({ ...lease, cleanupAt: Date.now() });
  }

  async function release(lease) {
    await db.runTransaction(async tx => {
      const ownerRef = limits.doc(lease.ownerKey);
      const sessionRef = sessions.doc(lease.id);
      const [owner, global, current] = await Promise.all([tx.get(ownerRef), tx.get(globalRef), tx.get(sessionRef)]);
      // A sweeper may have read a pending reservation just before creation
      // finished. Never delete its newly activated, still-paid session.
      if (!lease.sessionId && current.data()?.sessionId) return;
      const ownerData = owner.data() || {};
      const globalData = global.data() || {};
      const active = { ...(globalData.active || {}) };
      delete active[lease.id];
      /* A START THAT NEVER BECAME A CALL IS NOT A LESSON USED. The day's
         allowance is spent in `reserve`, BEFORE the provider is ever
         asked — so a microphone the student refused, an SDP the provider
         rejected and a rate limit at the other end each cost one of the
         six and left the app saying "busy, try again in a little while",
         which after the sixth was never going to come true. That is the
         reported fault.

         It is given back ONLY when no session id was ever attached: a
         lesson that really ran and was then stopped still counts, which is
         what `startsPerDay` is for, and the harness pins both halves. The
         session document must still exist, or a second release would
         refund the same start twice; and the day must still be the
         lease's own, or a refund at midnight takes one off tomorrow. */
      const refund = !lease.sessionId && current.exists && ownerData.day === dayKey(Number(lease.createdAt) || Date.now());
      // A delayed stop for an old call must never unlock a newer lesson.
      if (ownerData.currentLease === lease.id) {
        tx.set(ownerRef, {
          ...ownerData,
          currentLease: null,
          starts: Math.max(0, Number(ownerData.starts || 0) - (refund ? 1 : 0))
        });
      }
      if (global.exists) tx.set(globalRef, { ...globalData, active });
      tx.delete(sessionRef);
    });
  }

  async function find(uid, sessionId) {
    const owner = await limits.doc(userKey(uid)).get();
    const id = owner.data()?.currentLease;
    if (!id) return null;
    const snap = await sessions.doc(id).get();
    const lease = snap.data();
    return lease?.uid === uid && lease.sessionId === sessionId ? lease : null;
  }

  async function expired(now) {
    const snap = await sessions.where('cleanupAt', '<=', now).limit(40).get();
    return snap.docs.map(doc => doc.data());
  }

  return { reserve, activate, recover, release, find, expired };
}

module.exports = { createRepository, dayKey, userKey, SESSION_COLLECTION, LIMIT_COLLECTION };
