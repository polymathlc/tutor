/* Centre students use real, separate Firebase accounts. Only signed server
   claims select the student; an admin credential is never kept for returning. */
(function (global) {
  'use strict';
  var ENDPOINT = 'https://us-central1-mathgen--app.cloudfunctions.net/studyBuddyCentre';
  var LEVELS = ['P3', 'P4', 'P5', 'P6', 'S1'];
  var SUBJECTS = [{ value: 'science', label: 'Science' }, { value: 'math', label: 'Mathematics' }, { value: 'both', label: 'Mathematics and Science' }, { value: 'english', label: 'English' }, { value: 'chinese', label: 'Chinese' }];
  var practice = null, expiryTimer = null, authGeneration = 0, modal = null, busy = false, leaving = false, sessionError = '';

  function user() { return global.currentUser || null; }
  function teacher() { return !!(user() && typeof global.isAdmin === 'function' && global.isAdmin(user()) && !practice); }
  function requireTeacher() { if (!teacher()) throw new Error('Sign in to the admin account to manage students.'); }
  function node(tag, text, className) {
    var el = document.createElement(tag);
    if (text != null) el.textContent = text;
    if (className) el.className = className;
    return el;
  }
  function button(text, onClick, primary) {
    var el = node('button', text, 'btn' + (primary ? ' btnPrimary' : ''));
    el.type = 'button'; el.addEventListener('click', onClick); return el;
  }
  function message(error) { return String(error && error.message || error || 'Please try again.'); }
  function note(text) { if (typeof global.toast === 'function') global.toast(text, 6000); }
  function delay(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }
  function bounded(promise, ms, text) {
    var timer;
    return Promise.race([promise, new Promise(function (_, reject) {
      timer = setTimeout(function () { reject(new Error(text)); }, ms);
    })]).finally(function () { clearTimeout(timer); });
  }
  function cleanStudent(st) {
    return { name: String(st && st.name || '').trim(), level: String(st && st.level || ''), subject: String(st && st.subject || '') };
  }
  function validStudent(st) {
    return !!(st && st.name && st.name.length <= 80 && LEVELS.indexOf(st.level) >= 0 &&
      SUBJECTS.some(function (s) { return s.value === st.subject; }) && (st.level !== 'P3' || st.subject === 'science'));
  }
  function label(st) {
    var s = SUBJECTS.find(function (sub) { return sub.value === st.subject; });
    return (st.level === 'S1' ? 'Sec 1' : st.level || 'Choose level') + ' · ' + (s ? s.label : 'Choose subjects');
  }
  function requestId() {
    if (global.crypto && typeof global.crypto.randomUUID === 'function') return global.crypto.randomUUID();
    if (!global.crypto || typeof global.crypto.getRandomValues !== 'function') throw new Error('Open Study Buddy in a secure browser to add a student.');
    var bytes = new Uint8Array(16); global.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
    return Array.from(bytes).map(function (b, i) { return ([4, 6, 8, 10].indexOf(i) >= 0 ? '-' : '') + b.toString(16).padStart(2, '0'); }).join('');
  }
  async function api(action, payload) {
    requireTeacher();
    var owner = user(), controller = new AbortController(), timer;
    try {
      return await Promise.race([(async function () {
        var tokens = await Promise.all([owner.getIdToken(),
          typeof global.liveAppCheckToken === 'function' ? global.liveAppCheckToken() : Promise.reject(new Error('App verification is unavailable. Reload Study Buddy and try again.'))]);
        if (!tokens[1]) throw new Error('App verification is unavailable. Reload Study Buddy and try again.');
        if (user() !== owner || !teacher()) throw new Error('The signed-in account changed. Open the student again.');
        var response = await global.fetch(ENDPOINT, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tokens[0], 'X-Firebase-AppCheck': tokens[1] },
          body: JSON.stringify(Object.assign({ action: action }, payload)), signal: controller.signal
        });
        var data;
        try { data = await response.json(); } catch (_) { data = null; }
        if (response.status === 404 || response.status === 501) throw new Error('Centre student management is not available on the server yet. Please contact the site administrator.');
        if (!response.ok || !data || data.error) {
          var detail = data && data.error;
          throw new Error(typeof detail === 'string' ? detail : (detail && detail.message) || 'The request could not be completed. Please try again.');
        }
        if (user() !== owner || !teacher()) throw new Error('The signed-in account changed. Open the student again.');
        return data;
      })(), new Promise(function (_, reject) {
        timer = setTimeout(function () { controller.abort(); reject(new Error('The server took too long to respond. Retry this action; adding a student will reuse the same request.')); }, 20000);
      })]);
    } catch (e) {
      if (e && (e.name === 'TypeError' || e.name === 'AbortError')) throw new Error('Cannot reach centre student management. Check the connection and that the centre service has been deployed.');
      throw e;
    } finally { clearTimeout(timer); }
  }
  async function readStudents(targetUid) {
    requireTeacher();
    var owner = user();
    var snap = await bounded(global.peopleRef(targetUid).get({ source: 'server' }), 15000, 'The account could not be read in time. Try again.');
    if (user() !== owner || !teacher()) throw new Error('The signed-in account changed. Open the student again.');
    if (!snap.exists) throw new Error('This account no longer exists. Refresh the student list.');
    var profile = snap.data() || {};
    var students = global.normStudents((profile.tutorOnboard || {}).students);
    if (!students.length && String(profile.name || '').trim()) students = [cleanStudent(profile)];
    return { profile: profile, students: students };
  }
  async function refreshRoster() {
    global._peopleRows = null;
    try { await global.peopleLoad(true); global.renderPeople(); return true; }
    catch (_) { global.renderPeople('The changes were saved, but the list could not be refreshed. Reopen Students to try again.'); return false; }
  }
  function closeModal(force) {
    if (!modal || (busy && !force)) return;
    var old = modal; modal = null;
    old.back.remove();
    if (old.previous && old.previous.isConnected && old.previous.focus) old.previous.focus();
  }
  function makeModal(title, description) {
    closeModal(true);
    var back = node('div', null, 'centreModalBack');
    var card = node('section', null, 'centreModalCard');
    card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'true'); card.setAttribute('aria-labelledby', 'centreDialogTitle');
    var heading = node('h2', title); heading.id = 'centreDialogTitle'; card.appendChild(heading);
    if (description) { var intro = node('p', description, 'centreHelp'); intro.id = 'centreDialogHelp'; card.appendChild(intro); card.setAttribute('aria-describedby', intro.id); }
    var body = node('div', null, 'centreModalBody'); card.appendChild(body);
    var status = node('p', '', 'centreStatus'); status.setAttribute('role', 'alert'); status.setAttribute('aria-live', 'polite'); card.appendChild(status);
    var foot = node('div', null, 'centreModalFoot'); card.appendChild(foot);
    back.appendChild(card); document.body.appendChild(back);
    var view = { back: back, card: card, body: body, status: status, foot: foot, previous: document.activeElement };
    modal = view;
    back.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeModal(); }
      if (event.key !== 'Tab') return;
      var focusable = Array.from(card.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex="0"]'));
      if (!focusable.length) { event.preventDefault(); return; }
      var first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    return view;
  }
  function setBusy(view, value, text) {
    busy = value;
    view.card.setAttribute('aria-busy', value ? 'true' : 'false');
    view.card.querySelectorAll('button, input, select').forEach(function (el) { el.disabled = value; });
    if (text != null) view.status.textContent = text;
  }
  function fields(view, student) {
    var form = node('form', null, 'centreForm');
    var nameLabel = node('label', 'Student name'); nameLabel.htmlFor = 'centreStudentName';
    var name = node('input'); name.id = 'centreStudentName'; name.type = 'text'; name.required = true; name.maxLength = 80; name.autocomplete = 'off'; name.value = student.name || '';
    var levelLabel = node('label', 'Level'); levelLabel.htmlFor = 'centreStudentLevel';
    var level = node('select'); level.id = 'centreStudentLevel'; level.required = true;
    var empty = node('option', 'Choose level'); empty.value = ''; level.appendChild(empty);
    LEVELS.forEach(function (l) { var opt = node('option', l === 'S1' ? 'Secondary 1' : 'Primary ' + l.slice(1)); opt.value = l; level.appendChild(opt); });
    level.value = student.level || '';
    var subjectLabel = node('label', 'Subject access'); subjectLabel.htmlFor = 'centreStudentSubject';
    var subject = node('select'); subject.id = 'centreStudentSubject'; subject.required = true;
    var help = node('p', 'Primary 3 students have access to Science.', 'centreFieldHelp'); help.id = 'centreSubjectHelp'; subject.setAttribute('aria-describedby', help.id);
    function fillSubjects(wanted) {
      subject.replaceChildren();
      SUBJECTS.filter(function (s) { return level.value !== 'P3' || s.value === 'science'; }).forEach(function (s) { var opt = node('option', s.label); opt.value = s.value; subject.appendChild(opt); });
      if (level.value !== 'P3' && SUBJECTS.some(function (s) { return s.value === wanted; })) subject.value = wanted;
      else subject.value = 'science';
      help.hidden = level.value !== 'P3';
    }
    fillSubjects(student.subject);
    level.addEventListener('change', function () { fillSubjects(subject.value); });
    [nameLabel, name, levelLabel, level, subjectLabel, subject, help].forEach(function (el) { form.appendChild(el); });
    view.body.appendChild(form);
    return { form: form, first: name, read: function () { return cleanStudent({ name: name.value, level: level.value, subject: subject.value }); } };
  }
  function openCreate() {
    try { requireTeacher(); } catch (e) { note(message(e)); return; }
    if (busy) return;
    var view = makeModal('Add centre student', 'Create an account for practice at the centre. The student does not need a Gmail address.');
    var inputs = fields(view, {}), id, submitted = null;
    try { id = requestId(); } catch (e) { view.status.textContent = message(e); return; }
    var cancel = button('Cancel', function () { closeModal(); });
    var save = button('Add student', submit, true); view.foot.appendChild(cancel); view.foot.appendChild(save);
    async function submit(event) {
      if (event) event.preventDefault();
      if (busy || modal !== view || !inputs.form.reportValidity()) return;
      var st = submitted || inputs.read(); if (!validStudent(st)) { view.status.textContent = 'Enter a name, level and available subjects.'; return; }
      submitted = st;
      setBusy(view, true, 'Adding student…');
      try {
        var result = await api('createStudent', Object.assign({ requestId: id }, st));
        if (!result.targetUid) throw new Error('The server did not return the new student account. Retry this action.');
        if (result.student && validStudent(result.student)) st = cleanStudent(result.student);
        var refreshed = await refreshRoster();
        view.body.replaceChildren(node('p', st.name + ' has been added to your students.', 'centreCreated'));
        view.body.appendChild(node('p', label(st), 'centreHelp'));
        view.foot.replaceChildren(button('Done', function () { closeModal(); }), button('Practise as ' + st.name, function () { openPractice(result.targetUid, 0, st); }, true));
        setBusy(view, false, refreshed ? '' : 'The student was added. Reopen Students to refresh the list.');
        view.foot.querySelector('button').focus();
      } catch (e) {
        setBusy(view, false, message(e));
        // A timed-out create may already have succeeded. Keep its identity
        // and input together, so a retry can never create a duplicate.
        inputs.form.querySelectorAll('input, select').forEach(function (el) { el.disabled = true; });
        save.textContent = 'Retry adding student';
      }
    }
    inputs.form.addEventListener('submit', submit); inputs.first.focus();
  }
  function openEdit(targetUid, index, expected, onSaved) {
    if (busy) return;
    var view = makeModal('Edit student access', 'Changes apply to this student’s level and subjects.');
    var inputs = fields(view, expected);
    inputs.first.readOnly = true;
    view.foot.appendChild(button('Cancel', function () { closeModal(); }));
    view.foot.appendChild(button('Save access', submit, true));
    async function submit(event) {
      if (event) event.preventDefault();
      if (busy || modal !== view || !inputs.form.reportValidity()) return;
      var st = inputs.read(); st.name = expected.name;
      if (!validStudent(st)) { view.status.textContent = 'Enter a name, level and available subjects.'; return; }
      setBusy(view, true, 'Saving access…');
      try {
        await api('updateStudent', { targetUid: targetUid, studentIndex: index, student: st, expectedStudent: cleanStudent(expected) });
        var refreshed = await refreshRoster();
        if (onSaved) await onSaved();
        var row = refreshed && Array.isArray(global._peopleRows) && global._peopleRows.find(function (entry) { return entry.id === targetUid; });
        var title = document.getElementById('personTitle');
        if (row && title) title.textContent = row.students && row.students.length ? row.students.join(', ') : (row.name || row.email || 'This account');
        setBusy(view, false); closeModal();
        note(st.name + '’s access has been saved.' + (refreshed ? '' : ' Reopen Students to refresh the list.'));
      } catch (e) { setBusy(view, false, message(e)); }
    }
    inputs.form.addEventListener('submit', submit); inputs.first.focus();
  }
  async function settleWork() {
    if (typeof global.lessonBusy === 'function' && global.lessonBusy()) throw new Error('Finish and save the lesson recording before changing accounts.');
    if (typeof global.stopLiveTutor === 'function') global.stopLiveTutor();
    if (typeof global.flushSave === 'function') global.flushSave();
    var until = Date.now() + 15000;
    while (global.savingNow && Date.now() < until) await delay(80);
    if (global.savingNow) throw new Error('The current worksheet is still saving. Please wait and try again.');
    if (global.dirty && global.currentDocId && typeof global.performSave === 'function') {
      var saved = await bounded(global.performSave(true), 15000, 'The current worksheet is still saving. Please wait and try again.');
      if (!saved || global.dirty) throw new Error('The current worksheet could not be saved. Check the connection before changing accounts.');
    }
  }
  function closeAdminDialogs() {
    document.querySelectorAll('.modalBack.open').forEach(function (el) { el.classList.remove('open'); });
  }
  function openPractice(targetUid, index, expected) {
    if (busy) return;
    var view = makeModal('Practise as ' + expected.name, 'Practice will be saved to this student’s account. This ends your admin session on this device. Sign in with Google again to return to admin controls.');
    view.body.appendChild(node('p', label(expected), 'centreAccessSummary'));
    view.foot.appendChild(button('Cancel', function () { closeModal(); }));
    var start = button('Start practice', async function () {
      if (busy) return;
      setBusy(view, true, 'Saving your work and starting practice…');
      var signedOut = false;
      try {
        requireTeacher(); await settleWork();
        var result = await api('startPractice', { targetUid: targetUid, studentIndex: index, expectedStudent: cleanStudent(expected) });
        if (typeof result.token !== 'string' || !result.token || result.targetUid !== targetUid || result.studentIndex !== index) throw new Error('The server did not return the requested practice session. Please try again.');
        closeAdminDialogs();
        await global.auth.signOut(); signedOut = true;
        await global.auth.setPersistence(global.firebase.auth.Auth.Persistence.SESSION);
        await global.auth.signInWithCustomToken(result.token);
        // Reload drops cached teacher worksheets, notes and modal state. The
        // next page must validate signed claims before loading student data.
        global.location.reload();
      } catch (e) {
        setBusy(view, false, message(e) + (signedOut ? ' You are signed out. Close this window and sign in as admin to retry.' : ''));
        if (signedOut) { start.hidden = true; view.foot.firstChild.textContent = 'Close'; }
      }
    }, true);
    view.foot.appendChild(start); start.focus();
  }
  function appendAccountControls(container, row) {
    if (!teacher() || !container || !row || !row.id) return;
    var section = node('section', null, 'centreAccountControls');
    section.setAttribute('aria-label', 'Student account access');
    section.appendChild(node('h3', 'Student access'));
    var content = node('div'); section.appendChild(content); container.appendChild(section);
    async function load() {
      content.replaceChildren(node('p', 'Reading current student access…', 'centreHelp'));
      try {
        var latest = await readStudents(row.id);
        if (!section.isConnected) return;
        content.replaceChildren();
        if (!latest.students.length) { content.appendChild(node('p', 'This account has no student profile yet. Complete its student setup before starting practice.', 'centreHelp')); return; }
        latest.students.forEach(function (st, index) {
          var line = node('div', null, 'centreStudentRow');
          var info = node('div', null, 'centreStudentInfo'); info.appendChild(node('strong', st.name)); info.appendChild(node('span', label(st), 'centreHelp')); line.appendChild(info);
          var actions = node('div', null, 'centreStudentActions');
          actions.appendChild(button('Edit access', function () { openEdit(row.id, index, st, load); }));
          var start = button('Practise as ' + st.name, function () { openPractice(row.id, index, st); }, true);
          if (!validStudent(st)) { start.disabled = true; start.title = 'Set this student’s level and subject access first.'; }
          actions.appendChild(start); line.appendChild(actions); content.appendChild(line);
        });
      } catch (e) {
        content.replaceChildren(node('p', 'Student access could not be read: ' + message(e), 'centreStatus'));
        content.appendChild(button('Retry', load));
      }
    }
    load(); return section;
  }
  function clearSession() {
    authGeneration++; practice = null; sessionError = ''; clearTimeout(expiryTimer); expiryTimer = null; renderSession();
  }
  function protectedAccount(account, claims) {
    var emails = ['chungzhikai@gmail.com', 'abigail.yew@stanfordmanpower.com'];
    if (account.disabled === true || emails.indexOf(String(account.email || '').toLowerCase()) >= 0 || emails.indexOf(String(claims.email || '').toLowerCase()) >= 0) return true;
    if ((account.providerData || []).some(function (provider) { return emails.indexOf(String(provider.email || '').toLowerCase()) >= 0; })) return true;
    if (['admin', 'isAdmin', 'administrator', 'teacher', 'isTeacher', 'staff', 'superAdmin', 'superadmin'].some(function (key) { return !!claims[key]; })) return true;
    function privileged(value) { return typeof value === 'string' && /^(admin|administrator|teacher|staff|owner|superadmin|superuser)$/i.test(value); }
    var roles = claims.roles;
    return privileged(claims.role) || privileged(roles) || (Array.isArray(roles) && roles.some(privileged)) ||
      (!!roles && typeof roles === 'object' && Object.keys(roles).some(function (key) { return roles[key] && privileged(key); }));
  }
  async function authReady(account) {
    clearSession();
    if (!account) return null;
    var generation = authGeneration;
    var result = await bounded(account.getIdTokenResult(), 15000, 'The signed-in account could not be verified. Please sign in again.');
    if (generation !== authGeneration) return null;
    var claims = result.claims || {};
    if (claims.centrePractice !== true) return null;
    var index = claims.centreStudentIndex, expires = claims.centrePracticeExpiresAt, uid = /^[A-Za-z0-9_-]{1,128}$/;
    if (!uid.test(account.uid || '') || !claims.firebase || claims.firebase.sign_in_provider !== 'custom' || protectedAccount(account, claims) ||
        !uid.test(claims.centreActorUid || '') || claims.centreActorUid === account.uid ||
        typeof claims.centreStudentKey !== 'string' || !/^[a-f0-9]{64}$/.test(claims.centreStudentKey) ||
        !Number.isInteger(index) || index < 0 || index > 7 || !Number.isInteger(expires) || expires <= Math.floor(Date.now() / 1000)) throw new Error('This centre practice session has ended or could not be verified. Ask your teacher to start a new session.');
    practice = { uid: account.uid, studentIndex: index, expiresAt: expires };
    if (typeof global.setActiveIdx === 'function') global.setActiveIdx(index);
    expiryTimer = setTimeout(function () { endPractice(true); }, Math.min(2147483647, Math.max(0, expires * 1000 - Date.now())));
    renderSession(); return practice;
  }
  function renderSession() {
    var banner = document.getElementById('centrePracticeBanner');
    if (!practice) { if (banner) banner.remove(); return; }
    if (!banner) {
      banner = node('div', null, 'centrePracticeBanner'); banner.id = 'centrePracticeBanner'; banner.setAttribute('role', 'region'); banner.setAttribute('aria-label', 'Centre practice session');
      var name = node('strong'); name.id = 'centrePracticeName'; banner.appendChild(name);
      var end = button('End centre practice', function () { endPractice(false); }); end.id = 'centrePracticeEnd'; banner.appendChild(end);
      var header = document.querySelector('header');
      if (header) header.appendChild(banner); else document.body.prepend(banner);
    }
    var st = typeof global.activeStudent === 'function' ? global.activeStudent() : null;
    document.getElementById('centrePracticeName').textContent = 'Practising as ' + (st && st.name || 'student') + (sessionError ? ' · ' + sessionError : '');
    document.getElementById('centrePracticeEnd').textContent = sessionError ? 'Retry ending practice' : 'End centre practice';
  }
  async function endPractice(expired) {
    if (!practice || leaving) return;
    leaving = true;
    try {
      await settleWork();
      closeAdminDialogs(); closeModal(true);
      await global.auth.signOut();
      clearSession(); global.location.reload();
    } catch (e) { sessionError = (expired ? 'Practice time has ended. ' : '') + message(e); renderSession(); note(sessionError); }
    finally { leaving = false; }
  }
  global.CentreAdmin = {
    openCreate: openCreate, appendAccountControls: appendAccountControls,
    authReady: authReady, renderSession: renderSession, clearSession: clearSession,
    endPractice: endPractice, isPractice: function () { return !!practice; },
    lockedStudentIndex: function () { return practice ? practice.studentIndex : null; }
  };
})(window);
