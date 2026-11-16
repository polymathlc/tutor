/* 🔗 SIGNED IN BY THE CLASS LINK OR PIN (v1.96.0)
   ------------------------------------------------------------------------
   Every child on the centre's /office roster has a personal live-class link
   and a four-number PIN (Ans Key v1.210.0). The SAME link, opened here as
   `…/tutor/?pass=<code>`, or the same PIN typed on the sign-in card, signs the
   child in as THEMSELVES — no Google account, no first-sign-in questions — and
   Study Buddy shows their own level and subjects, read from /office.

   How, and why each step is there:
   1. The page signs in ANONYMOUSLY first, only so it has an ID token to send:
      Ans Key's `ansKeyLiveClass` service checks the ID token and App Check on
      every request. The auth hook in index.html ignores an anonymous user
      (`OfficePass.busy()` says it is ours; one left over is signed out).
   2. `{action:'study', code|pin}` goes to the SERVER, which checks the code's
      MAC and generation (a ↻ New link kills the old one) or the PIN (counted:
      five wrong an hour per device, thirty in all), writes the child's roster
      row from /office (`studentProfiles/office-<family>-<child>`, merge) and
      mints a custom token for that uid with `officePass: true`.
   3. The throwaway anonymous account is deleted and the custom token signs in.
      From then on it is an ordinary Firebase session, remembered by the
      browser like any sign-in, and Sign out ends it.

   Nothing here decides who the child is: the code and the PIN are only ever
   checked by the server. A link is taken off the address bar the moment it is
   read, so a reload or a shared screenshot of the address carries nothing.
   Everything on screen is written with textContent.                       */
(function (global) {
  'use strict';

  var ENDPOINT = 'https://us-central1-mathgen--app.cloudfunctions.net/ansKeyLiveClass';
  var WAIT_LIBS_MS = 12000;
  var CALL_MS = 20000;
  var CODE_RE = /^[A-Za-z0-9-]{1,60}_[A-Za-z0-9-]{1,60}\.\d{1,6}\.[A-Za-z0-9_-]{8,64}$/;

  /* ---------------- pure ---------------- */
  function str(v) { return v == null ? '' : String(v); }
  function cleanCode(v) {
    var c = str(v).trim();
    return CODE_RE.test(c) ? c : '';
  }
  function cleanPin(v) { return str(v).replace(/\D+/g, '').slice(0, 4); }
  function pinReady(v) { return /^\d{4}$/.test(str(v)); }
  // `?pass=<code>` (also `&pass=`); the first readable one wins.
  function passFromSearch(search) {
    var q = str(search).replace(/^\?/, '');
    if (!q) return '';
    var out = '';
    q.split('&').forEach(function (part) {
      if (out) return;
      var i = part.indexOf('=');
      if (i < 0 || part.slice(0, i) !== 'pass') return;
      var v = part.slice(i + 1);
      try { v = decodeURIComponent(v.replace(/\+/g, ' ')); } catch (e) { v = ''; }
      out = cleanCode(v);
    });
    return out;
  }
  // The address with `pass` taken off and everything else kept.
  function stripPass(href) {
    var h = str(href);
    var hashAt = h.indexOf('#');
    var hash = hashAt >= 0 ? h.slice(hashAt) : '';
    var base = hashAt >= 0 ? h.slice(0, hashAt) : h;
    var qAt = base.indexOf('?');
    if (qAt < 0) return h;
    var keep = base.slice(qAt + 1).split('&').filter(function (part) {
      return part && part.split('=')[0] !== 'pass';
    });
    return base.slice(0, qAt) + (keep.length ? '?' + keep.join('&') : '') + hash;
  }
  // A refusal from the server, in the words a child can act on.
  function errorWords(code, message) {
    var m = str(message);
    if (m) return m;
    switch (code) {
      case 'pass_unknown': return 'That link is not working any more. Ask your teacher for a new one.';
      case 'pin_unknown': return 'That PIN is not right. Check the four numbers your teacher gave you.';
      case 'pin_wait': return 'Too many wrong PINs. Wait an hour, or open your personal link instead.';
      case 'not_on_roster': return 'Your name is not on the class list this month. Ask your teacher.';
      case 'app_check_required': return 'Refresh the page and try again.';
      default: return 'Could not sign you in just now. Try again in a moment.';
    }
  }
  var pure = { cleanCode: cleanCode, cleanPin: cleanPin, pinReady: pinReady, passFromSearch: passFromSearch,
    stripPass: stripPass, errorWords: errorWords, ENDPOINT: ENDPOINT };

  /* ---------------- the sign-in ---------------- */
  var S = { busy: false, status: '', bad: false, seq: 0, pin: '' };

  function authOf() { return global.auth || null; }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  async function libsReady() {
    var until = Date.now() + WAIT_LIBS_MS;
    while (Date.now() < until) {
      if (authOf() && typeof global.liveAppCheckToken === 'function') return true;
      await sleep(150);
    }
    return !!authOf() && typeof global.liveAppCheckToken === 'function';
  }
  function say(text, bad) {
    S.status = str(text); S.bad = !!bad;
    paint();
  }
  async function postStudy(user, payload) {
    var tokens = await Promise.all([user.getIdToken(), global.liveAppCheckToken()]);
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, CALL_MS) : null;
    try {
      var res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tokens[0], 'X-Firebase-AppCheck': tokens[1] },
        body: JSON.stringify(payload),
        signal: ctl ? ctl.signal : undefined
      });
      var data = null;
      try { data = await res.json(); } catch (e) { data = null; }
      if (!res.ok || !data || !data.token) {
        var err = data && data.error || {};
        var e2 = new Error(errorWords(err.code, err.message));
        e2.code = err.code || 'failed';
        throw e2;
      }
      return data;
    } finally { if (timer) clearTimeout(timer); }
  }

  // `what` is { code } or { pin }.
  async function signInWith(what) {
    if (S.busy) return false;
    var code = what && what.code ? cleanCode(what.code) : '';
    var pin = what && what.pin != null ? cleanPin(what.pin) : '';
    if (!code && !pinReady(pin)) { say(what && what.code ? errorWords('pass_unknown') : 'Type the four numbers of your PIN.', true); return false; }
    var auth = authOf();
    var current = auth && auth.currentUser;
    if (current && !current.isAnonymous) {
      var who = current.displayName || current.email || 'the student signed in now';
      if (!global.confirm('Sign out ' + who + ' and sign in with this ' + (code ? 'link' : 'PIN') + '?')) return false;
    }
    S.busy = true;
    var seq = ++S.seq;
    say(code ? 'Opening your Study Buddy…' : 'Checking your PIN…', false);
    var anon = null;
    try {
      if (!(await libsReady())) throw new Error('Study Buddy is still loading. Refresh the page and try again.');
      auth = authOf();
      if (auth.currentUser && !auth.currentUser.isAnonymous) await auth.signOut();
      var cred = auth.currentUser && auth.currentUser.isAnonymous ? { user: auth.currentUser } : await auth.signInAnonymously();
      anon = cred && cred.user;
      if (!anon) throw new Error('Could not sign you in just now. Try again in a moment.');
      var data = await postStudy(anon, code ? { action: 'study', code: code } : { action: 'study', pin: pin });
      if (seq !== S.seq) return false;
      // The anonymous account was only ever a way to ask; it is not kept.
      try { await anon.delete(); } catch (e) { /* signing in below replaces it anyway */ }
      anon = null;
      await auth.signInWithCustomToken(data.token);
      S.pin = '';
      var me = data.me || {};
      say('', false);
      if (typeof global.toast === 'function') global.toast('Welcome, ' + (me.name || 'there') + '! You are signed in.', 4000);
      return true;
    } catch (e) {
      if (anon) { try { await anon.delete(); } catch (x) { try { await authOf().signOut(); } catch (y) {} } }
      if (seq === S.seq) say((e && e.message) || errorWords(''), true);
      return false;
    } finally {
      if (seq === S.seq) S.busy = false;
      paint();
    }
  }

  /* ---------------- the card ---------------- */
  var mountEl = null;
  function node(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function paint() {
    if (!mountEl) return;
    while (mountEl.firstChild) mountEl.removeChild(mountEl.firstChild);
    var box = node('div', 'opBox');
    box.appendChild(node('div', 'opHead', '🔢 Have a PIN from your teacher?'));
    box.appendChild(node('p', 'opSub', 'Type the four numbers on your class card, or scan its 📖 Study Buddy code. No Google account needed.'));
    var row = node('div', 'opRow');
    var input = node('input', 'opPin');
    input.type = 'text'; input.inputMode = 'numeric'; input.autocomplete = 'one-time-code';
    input.maxLength = 4; input.placeholder = '0000'; input.value = S.pin;
    input.setAttribute('aria-label', 'Your four-number PIN');
    input.disabled = S.busy;
    var go = node('button', 'btn btnPrimary opGo', S.busy ? 'Signing in…' : 'Go');
    go.type = 'button';
    go.disabled = S.busy || !pinReady(S.pin);
    input.addEventListener('input', function () {
      var v = cleanPin(input.value);
      if (v !== input.value) input.value = v;
      S.pin = v;
      go.disabled = S.busy || !pinReady(v);
    });
    input.addEventListener('keydown', function (e) {
      e.stopPropagation();
      if (e.key === 'Enter' && pinReady(S.pin)) signInWith({ pin: S.pin });
    });
    go.addEventListener('click', function () { signInWith({ pin: S.pin }); });
    row.appendChild(input); row.appendChild(go);
    box.appendChild(row);
    if (S.status) {
      var st = node('p', 'opStatus' + (S.bad ? ' bad' : ''), S.status);
      st.setAttribute('role', S.bad ? 'alert' : 'status');
      box.appendChild(st);
    }
    mountEl.appendChild(box);
  }
  function mount(el) { mountEl = el || null; paint(); }

  /* ---------------- ?pass= on arrival ---------------- */
  function boot() {
    var loc = global.location;
    if (!loc) return;
    var code = passFromSearch(loc.search);
    if (!code && /[?&]pass=/.test(str(loc.search))) {
      try { global.history.replaceState(null, '', stripPass(loc.href)); } catch (e) {}
      say(errorWords('pass_unknown'), true);
      return;
    }
    if (!code) return;
    // Off the address bar first: a reload must not sign in again, and the
    // address shown (or shared) no longer carries the child's link.
    try { global.history.replaceState(null, '', stripPass(loc.href)); } catch (e) {}
    signInWith({ code: code });
  }

  global.OfficePass = {
    pure: pure, mount: mount, boot: boot, signInWith: signInWith,
    busy: function () { return S.busy; }
  };
  if (typeof document !== 'undefined') {
    var slot = function () { var el = document.getElementById('officePassSlot'); if (el) mount(el); boot(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', slot);
    else slot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
