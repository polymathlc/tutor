/* Study Adventure connects existing learning events to server-owned rewards.
   No grades, XP or leaderboard rows are trusted from local storage. */
(function (global) {
  'use strict';
  var ENDPOINT = 'https://us-central1-mathgen--app.cloudfunctions.net/studyBuddyGame';
  var state = null, identity = '', generation = 0, pending = [], draining = false, selectedSubject = '';
  var ui = global.StudyAdventureUI, mounted = false, lastAward = '', refreshPromise = null, profileOwner = null;
  var requestSequence = 0, acceptedSequence = 0, acceptedServerTime = 0, preferencePending = false;
  function user() { return global.currentUser || null; }
  function teacher() { return typeof global.isAdmin === 'function' && global.isAdmin(user()); }
  function student() { return typeof global.activeStudent === 'function' ? global.activeStudent() : null; }
  function subjects() { var s = student(); return s && typeof global.studentSubjectList === 'function' ? global.studentSubjectList(s) : []; }
  function context(subject) {
    var u = user(), s = student(), allowed = subjects();
    if (!u || teacher() || !s) return null;
    // A worksheet's explicit subject must never silently become another league.
    if (subject != null && subject !== '' && allowed.indexOf(subject) < 0) return null;
    var sub = allowed.indexOf(subject) >= 0 ? subject : (allowed.indexOf(selectedSubject) >= 0 ? selectedSubject : allowed[0]);
    if (!sub) return null;
    var index = Array.isArray(global.myStudents) ? global.myStudents.indexOf(s) : Number(global._activeIdx);
    if (!Number.isInteger(index) || index < 0 || index > 7) index = 0;
    var c = { uid: u.uid, studentIndex: index, subject: sub, studentName: s.name, level: s.level, generation: generation };
    if (profileOwner && learnerIdentity(profileOwner) === learnerIdentity(c) && state && state.profile) c.learnerKey = state.profile.learnerKey;
    return c;
  }
  function learnerIdentity(c) { return c ? JSON.stringify([c.uid, c.studentIndex, c.studentName, c.level]) : ''; }
  function key(c) { return c ? JSON.stringify([c.uid, c.studentIndex, c.studentName, c.level, c.subject]) : ''; }
  function current(c) { var now = context(c && c.subject); return !!(c && now && key(now) === key(c) && c.generation === generation); }
  async function expectedLearnerKey(c) {
    if (c.learnerKey) return c.learnerKey;
    // Bind a first request to the captured learner even before their snapshot
    // arrives. The server rejects if the saved sibling order changed meanwhile.
    var normalized = String(c.studentName || '').normalize('NFKC').toLowerCase().replace(/\s+/gu, ' ').trim();
    var bytes = new TextEncoder().encode(c.uid + '\n' + normalized);
    var digest = await global.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }
  async function request(body, c) {
    var u = user();
    if (!u || (c && !current(c))) throw new Error('The active learner changed. Please refresh your adventure.');
    for (var n = 0; !global.liveAppCheckToken && n < 30; n++) await new Promise(function (r) { setTimeout(r, 200); });
    if (!global.liveAppCheckToken) throw new Error('Adventure could not verify this device. Refresh the page to try again.');
    var tokens = await Promise.all([u.getIdToken(), global.liveAppCheckToken(), c ? expectedLearnerKey(c) : null]);
    if (user() !== u || (c && !current(c))) throw new Error('The active learner changed. Please refresh your adventure.');
    var payload = Object.assign({}, body);
    if (c) { payload.studentIndex = c.studentIndex; payload.subject = c.subject; payload.learnerKey = tokens[2]; }
    var order = ++requestSequence;
    var control = new AbortController(), timer = setTimeout(function () { control.abort(); }, 70000), response;
    try {
      response = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json',
        Authorization: 'Bearer ' + tokens[0], 'X-Firebase-AppCheck': tokens[1] }, body: JSON.stringify(payload), signal: control.signal });
    } catch (e) { throw new Error('Adventure could not connect. Your worksheet is safe; retry rewards when you are online.'); }
    finally { clearTimeout(timer); }
    var data = await response.json().catch(function () { return {}; });
    if (user() !== u || (c && !current(c))) throw new Error('The active learner changed. Please refresh your adventure.');
    if (!response.ok) {
      var message = data.error && data.error.message;
      var error = new Error(typeof message === 'string' ? message : response.status === 404 || response.status === 503
        ? 'Adventure rewards are being prepared. You can keep learning and retry shortly.'
        : 'Adventure could not update. Please refresh and try again.');
      error.status = response.status; error.code = data.error && data.error.code; throw error;
    }
    if (data && typeof data === 'object') data._adventureOrder = order;
    return data;
  }
  function mapSnapshot(data) {
    if (!data || !data.profile || !Array.isArray(data.quests) || !data.leaderboard || !Number.isFinite(data.profile.xp)) throw new Error('Adventure could not read your progress. Please try again.');
    var p = data.profile || {}, board = data.leaderboard || {};
    var descriptions = { study: 'Make space for one question today.', practice: 'Small questions add up to big progress.', correction: 'Revisit your mistake book and try again.' };
    return { loading: false, error: '', signedIn: true, isTeacher: false, saving: preferencePending,
      today: Number.isFinite(data.serverTime) ? new Date(data.serverTime + 8 * 3600000).toISOString().slice(0, 10) : undefined,
      profile: Object.assign({}, p, { lifetimeXp: p.xp || 0, weeklyXp: p.weeklyXp || 0,
        levelTarget: 200, activeDays: p.activeDays || [], badges: (p.badges || []).filter(function (b) { return b.earned; }) }),
      activeDays: p.currentWeekDays || p.activeDays || [],
      quests: (data.quests || []).map(function (q) { return { id: q.id, title: q.label, description: q.description || descriptions[q.id] || '', current: q.progress, target: q.target, xp: q.xp || 0 }; }),
      leaderboard: { entries: board.rows || [], available: board.status === 'ready', approved: board.status === 'ready',
        reason: board.status === 'approval_required' ? 'Your teacher needs to approve this learner’s level and subject before you can join the weekly league.' : '',
        groupLabel: [board.level, board.subject === 'math' ? 'Mathematics' : board.subject === 'science' ? 'Science' : board.subject].filter(Boolean).join(' · '),
        weekEndsAt: board.resetsAt, myRank: board.myRank, totalParticipants: board.totalParticipants || 0 } };
  }
  function paint() {
    if (!ui || !mounted) return;
    ui.render(state || { loading: true });
    var p = state && state.profile, companion = p && p.companion || 'orbit';
    document.querySelectorAll('[data-adventure-companion]').forEach(function (img) {
      var pose = img.getAttribute('data-adventure-companion') || 'welcome';
      var path = 'assets/companions/' + companion + '-' + pose + '.webp';
      if (img.getAttribute('src') !== path) img.src = path;
    });
    var badge = document.getElementById('adventureNav');
    if (badge) { badge.hidden = !user(); badge.textContent = teacher() ? '✦ Adventure' : '✦ Level ' + (p && p.level || 1); }
    var status = document.getElementById('adventureRewardStatus');
    if (status) { status.textContent = pending.length ? pending.length + ' practice reward' + (pending.length === 1 ? '' : 's') + ' waiting to sync' : lastAward;
      status.hidden = !status.textContent; }
  }
  function accept(data, c) {
    if (!current(c) || c.subject !== context().subject) return false;
    var stamp = Number(data.serverTime) || 0, order = Number(data._adventureOrder) || 0;
    if ((stamp && stamp < acceptedServerTime) || (stamp === acceptedServerTime && order < acceptedSequence)) return false;
    var mapped = mapSnapshot(data);
    acceptedServerTime = stamp; acceptedSequence = order; profileOwner = Object.assign({}, c); state = mapped; paint();
    return true;
  }
  async function refresh() {
    var c = context(); if (!c) return;
    if (refreshPromise) return refreshPromise;
    state = Object.assign({}, state || {}, { loading: true, error: '' }); paint();
    var work = request({ action: 'snapshot' }, c).then(function (data) { accept(data, c); }).catch(function (e) {
      if (current(c)) { state = Object.assign({}, state || {}, { loading: false, error: e.message }); paint(); }
    });
    refreshPromise = work;
    await work;
    if (refreshPromise === work) refreshPromise = null;
  }
  function reset() { generation++; pending = []; identity = ''; state = null; profileOwner = null; lastAward = ''; refreshPromise = null; selectedSubject = ''; acceptedSequence = 0; acceptedServerTime = 0; preferencePending = false; if (ui && ui.close) ui.close(); paint(); }
  function sync() {
    mount();
    var c = context(), next = key(c), host = document.getElementById('adventureHome'), bar = document.getElementById('adventureSubjectBar');
    if (host) host.hidden = !c && !teacher();
    if (bar) bar.hidden = !c || subjects().length < 2;
    if (!c) {
      if (identity) reset();
      if (teacher() && ui && mounted) state = { isTeacher: true, profile: { alias: 'Your learning community', companion: 'orbit', level: 1 }, quests: [], leaderboard: { entries: [], available: false } };
      paint(); return;
    }
    if (next === identity) { paint(); return; }
    generation++; pending = []; refreshPromise = null; state = null; profileOwner = null; lastAward = ''; identity = next; selectedSubject = c.subject; acceptedSequence = 0; acceptedServerTime = 0; preferencePending = false;
    if (ui && ui.close) ui.close();
    var select = document.getElementById('adventureSubject');
    if (select) { select.replaceChildren(); subjects().forEach(function (s) { var option = document.createElement('option'); option.value = s; option.textContent = global.subjectLabel(s); select.appendChild(option); }); select.value = c.subject; }
    refresh();
  }
  async function drain() {
    if (draining) return;
    draining = true;
    try {
      while (pending.length) {
        var entry = pending[0];
        if (!current(entry.context)) { pending.shift(); continue; }
        try {
          var data = await request(Object.assign({ action: 'attempt' }, entry.body), entry.context);
          if (pending[0] === entry) pending.shift();
          if (!current(entry.context)) continue;
          var oldBadges = state && state.profile ? (state.profile.badges || []).map(function (b) { return b.id; }) : [];
          if (entry.context.subject === context().subject) accept(data, entry.context);
          else await refresh();
          var award = data.award || {};
          if (!current(entry.context)) continue;
          if (award.xp > 0) {
            var message = award.kind === 'correction' ? 'A comeback worth celebrating!' : 'Your practice paid off!';
            lastAward = '+' + award.xp + ' XP · ' + message;
            var earned = (data.profile && data.profile.badges || []).filter(function (b) { return b.earned && oldBadges.indexOf(b.id) < 0; });
            if (ui) ui.celebrate({ xp: award.xp, message: message, badges: earned });
          } else if (award.reason && ['duplicate', 'already_rewarded'].indexOf(award.reason) < 0) lastAward = ({ not_verified: 'This question could not be verified for XP. Keep learning — your worksheet marks are saved.', practice_first: 'Comeback XP starts with a practice attempt recorded in your adventure.', keep_trying: 'Keep trying — comeback XP arrives when you correct the mistake.', daily_cap: 'Daily XP goal reached. Great work today!' })[award.reason] || 'Progress checked — keep exploring.';
          paint();
        } catch (e) {
          if (!current(entry.context)) { if (pending[0] === entry) pending.shift(); continue; }
          if (pending[0] === entry && (e.status === 400 || e.status === 422 || (e.status === 409 && e.code !== 'already_checking'))) pending.shift();
          state = Object.assign({}, state || {}, { loading: false, error: e.message }); paint(); break;
        }
      }
    } finally { draining = false; }
  }
  function questionText(item) {
    var q = String(item.question || '').trim();
    if (Array.isArray(item.options) && item.options.length) q += '\n' + item.options.map(function (o) { return typeof o === 'string' ? o : String(o.label || '') + ': ' + String(o.text || ''); }).join('\n');
    return q;
  }
  function queue(item, answer, kind, c, questionImage) {
    if (!c || !current(c)) return;
    var q = questionText(item), a = String(answer || '').trim();
    if (!q || !a || pending.length >= 60) return;
    var fingerprint = JSON.stringify([key(c), kind, q, a]);
    var picture = typeof questionImage === 'string' && questionImage.length <= 1400000 && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(questionImage) ? questionImage : '';
    if (pending.some(function (p) { return p.fingerprint === fingerprint && (p.body.questionImage || '') === picture; })) return;
    var body = { question: q.slice(0, 6000), answer: a.slice(0, 3000), kind: kind };
    if (picture) body.questionImage = picture;
    pending.push({ context: Object.assign({}, c), fingerprint: fingerprint, body: body });
    paint(); drain();
  }
  function compressedPicture(source) {
    try {
      if (!source || !(source.width > 0) || !(source.height > 0)) return '';
      var canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
      if (!ctx) return '';
      for (var side = 900; side >= 450; side -= 225) {
        var ratio = Math.min(1, side / Math.max(source.width, source.height));
        canvas.width = Math.max(1, Math.round(source.width * ratio)); canvas.height = Math.max(1, Math.round(source.height * ratio));
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
        var uri = canvas.toDataURL('image/jpeg', 0.7);
        if (uri.length <= 1400000 && /^data:image\/jpeg;base64,/.test(uri)) return uri;
      }
    } catch (e) { /* A missing/tainted diagram must not block a text attempt. */ }
    return '';
  }
  function marked(items, c) {
    if (!c || !current(c)) return;
    var pictures = Object.create(null);
    (items || []).forEach(function (item) {
      if (!item.marked || item.verdict === 'blank') return;
      var pageNum = Number(item.page);
      // Capture the student's current page now; never read another worksheet
      // later when a queued verification reaches the front of the queue.
      if (!Object.prototype.hasOwnProperty.call(pictures, pageNum)) {
        var page = Array.isArray(global.pages) && global.pages.find(function (p) { return p.num === pageNum; });
        pictures[pageNum] = compressedPicture(page && page.canvas);
      }
      queue(item, item.studentAnswer, 'practice', c, pictures[pageNum]);
    });
  }
  async function practice(item, answer, c) {
    if (!c || !current(c)) return;
    var picture = '', timer;
    try {
      if (typeof global.mistakeImageUrl === 'function' && typeof global.mbStoredPage === 'function') {
        var loading = (async function () {
          var url = await global.mistakeImageUrl(item);
          if (!url || !current(c)) return '';
          var source = await global.mbStoredPage(url);
          return current(c) ? compressedPicture(source) : '';
        })();
        picture = await Promise.race([loading, new Promise(function (resolve) { timer = setTimeout(function () { resolve(''); }, 8000); })]);
      }
    } catch (e) { /* Reward verification can still use the saved question text. */ }
    finally { clearTimeout(timer); }
    if (current(c)) queue(item, answer, 'correction', c, picture);
  }
  async function action(name, payload) {
    if (name === 'leaderboard') { if (!teacher()) await refresh(); return; }
    if (name === 'practice') { global.showView('home'); var list = document.getElementById('wsList'); if (list) list.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    if (name === 'mistakes') { global.showView('mistake'); global.renderMistakes(); return; }
    if (name === 'refresh') { await refresh(); await drain(); return; }
    if (teacher()) { if (typeof global.openPeople === 'function') global.openPeople(); return; }
    if (['companion', 'frame', 'optIn'].indexOf(name) < 0 || preferencePending) return;
    var c = context(); if (!c) return;
    preferencePending = true; state = Object.assign({}, state || {}, { saving: true }); paint();
    try { accept(await request(Object.assign({ action: 'preferences' }, payload), c), c); }
    catch (e) { if (current(c)) { state = Object.assign({}, state || {}, { error: e.message }); paint(); } }
    finally { if (current(c)) { preferencePending = false; state = Object.assign({}, state || {}, { saving: false }); paint(); } }
  }
  function mount() {
    if (mounted || !ui) return;
    var host = document.getElementById('adventureHome'); if (!host) return;
    ui.mount({ homeHost: host, onAction: action }); mounted = true;
    var nav = document.getElementById('adventureNav'); if (nav) nav.addEventListener('click', function () { if (teacher()) global.openPeople(); else ui.open('collection'); });
    var selector = document.getElementById('adventureSubject'); if (selector) selector.addEventListener('change', function () { selectedSubject = selector.value; sync(); });
    var retry = document.getElementById('adventureRetry'); if (retry) retry.addEventListener('click', function () { action('refresh'); });
  }
  function teacherControls(row, host) {
    if (!teacher() || !row || !host || !(row.learners || []).length) return;
    var box = document.createElement('section'); box.className = 'adventureTeacher card';
    var h = document.createElement('h3'); h.textContent = 'Weekly league membership'; box.appendChild(h);
    var note = document.createElement('p'); note.className = 'sub'; note.textContent = 'Approve each learner for their level and subject. Students choose whether to appear, using a private adventure alias.'; box.appendChild(note); host.appendChild(box);
    row.learners.forEach(function (learner, index) {
      var line = document.createElement('div'); line.className = 'adventureMember';
      var title = document.createElement('strong'); title.textContent = learner.name; line.appendChild(title); box.appendChild(line);
      var status = document.createElement('span'); status.textContent = 'Loading membership…'; line.appendChild(status);
      var controls = document.createElement('div'); controls.className = 'adventureMemberControls'; line.appendChild(controls);
      var availableSubjects = global.studentSubjectList(learner);
      function renderMemberships(memberships) {
        controls.replaceChildren();
        var allSubjects = availableSubjects.slice();
        Object.keys(memberships || {}).forEach(function (sub) {
          var m = memberships[sub];
          if (m && (m.registered || m.approved || m.level !== learner.level) && allSubjects.indexOf(sub) < 0) allSubjects.push(sub);
        });
        function addControl(sub, requested, labelText, approved) {
          var button = document.createElement('button'); button.className = 'btn btnSm'; button.type = 'button'; button.textContent = labelText; button.setAttribute('aria-pressed', String(approved));
          button.addEventListener('click', async function () {
            button.disabled = true;
            try {
              var result = await request({ action: 'approveMember', targetUid: row.id, studentIndex: index, subject: sub, approved: requested });
              if (!teacher() || !box.isConnected) return;
              status.textContent = ''; renderMemberships(result.memberships || Object.assign({}, memberships, { [sub]: { approved: !!result.approved, registered: !!result.approved, level: learner.level } }));
            } catch (e) { if (teacher() && box.isConnected) status.textContent = e.message; }
            finally { button.disabled = false; }
          }); controls.appendChild(button);
        }
        allSubjects.forEach(function (sub) {
          var member = memberships[sub] || {}, approved = !!member.approved;
          var registered = typeof member.registered === 'boolean' ? member.registered : approved || (!!member.level && member.level !== learner.level);
          var available = availableSubjects.indexOf(sub) >= 0;
          if (available) addControl(sub, !approved, (approved ? '✓ Approved · ' : 'Approve · ') + global.subjectLabel(sub) + ' · ' + learner.level, approved);
          if (registered && (!available || !approved)) addControl(sub, false, 'Revoke prior ' + global.subjectLabel(sub) + ' · ' + member.level, true);
        });
      }
      function load() {
        Promise.all(availableSubjects.map(function (subject) { return request({ action: 'inspectMember', targetUid: row.id, studentIndex: index, subject: subject }); })).then(function (snapshots) {
          if (!teacher() || !box.isConnected) return;
          status.textContent = '';
          var memberships = {}; snapshots.forEach(function (data) { Object.assign(memberships, data.memberships || {}); }); renderMemberships(memberships);
        }).catch(function (e) { if (!teacher() || !box.isConnected) return; status.textContent = e.message; var retry = document.createElement('button'); retry.className = 'btn btnSm'; retry.textContent = 'Retry'; retry.onclick = function () { retry.remove(); load(); }; line.appendChild(retry); });
      }
      load();
    });
  }
  global.StudyAdventure = { sync: sync, reset: reset, capture: context, marked: marked, practice: practice, teacherControls: teacherControls,
    refresh: refresh, open: function (view) { if (ui) ui.open(view); }, questionText: questionText };
  mount(); sync();
})(window);
