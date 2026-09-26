'use strict';

const { createHash } = require('node:crypto');
const ADMIN_EMAIL = 'chungzhikai@gmail.com';
// The shared Maths backend can grant these emails an admin claim. Neither
// account may be handed to a student, even before that claim is granted.
const PROTECTED_EMAILS = Object.freeze([ADMIN_EMAIL, 'abigail.yew@stanfordmanpower.com']);
const PRACTICE_SECONDS = 4 * 60 * 60;
const UID = /^[A-Za-z0-9_-]{1,128}$/;
class CentreError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
function hasAdminRole(claims = {}) {
  if (['admin', 'isAdmin', 'administrator', 'teacher', 'isTeacher', 'staff', 'superAdmin', 'superadmin'].some(key => !!claims[key])) return true;
  const privileged = value => typeof value === 'string' && /^(admin|administrator|teacher|staff|owner|superadmin|superuser)$/i.test(value);
  const roles = claims.roles;
  return privileged(claims.role) || privileged(roles) || (Array.isArray(roles) && roles.some(privileged)) ||
    (!!roles && typeof roles === 'object' && Object.entries(roles).some(([key, enabled]) => enabled && privileged(key)));
}
function protectedIdentity(user) {
  return !user || user.disabled === true || PROTECTED_EMAILS.includes(String(user.email || '').toLowerCase()) ||
    (user.providerData || []).some(provider => PROTECTED_EMAILS.includes(String(provider.email || '').toLowerCase())) ||
    hasAdminRole(user.customClaims || user);
}
function centreStudentKey(student) {
  return createHash('sha256').update(JSON.stringify([String(student?.name || '').trim(), String(student?.level || ''), String(student?.subject || '')])).digest('hex');
}
function isCentrePractice(user, nowMs = Date.now()) {
  return !!user && UID.test(user.uid || '') && user.firebase?.sign_in_provider === 'custom' &&
    !protectedIdentity(user) && user.centrePractice === true && UID.test(user.centreActorUid || '') &&
    user.centreActorUid !== user.uid && Number.isInteger(user.centreStudentIndex) && user.centreStudentIndex >= 0 && user.centreStudentIndex <= 7 &&
    typeof user.centreStudentKey === 'string' && /^[a-f0-9]{64}$/.test(user.centreStudentKey) &&
    Number.isInteger(user.centrePracticeExpiresAt) && user.centrePracticeExpiresAt > Math.floor(nowMs / 1000);
}
function isSupportedStudent(user, nowMs = Date.now()) {
  return !!user?.uid && (user.firebase?.sign_in_provider === 'google.com' || isCentrePractice(user, nowMs));
}
function matchesCentreStudent(user, index, student, nowMs = Date.now()) {
  if (user?.firebase?.sign_in_provider === 'google.com') return true;
  return isCentrePractice(user, nowMs) && user.centreStudentIndex === index &&
    (student === undefined || user.centreStudentKey === centreStudentKey(student));
}
module.exports = { ADMIN_EMAIL, PROTECTED_EMAILS, PRACTICE_SECONDS, UID, CentreError, hasAdminRole, protectedIdentity,
  centreStudentKey, isCentrePractice, isSupportedStudent, matchesCentreStudent };
