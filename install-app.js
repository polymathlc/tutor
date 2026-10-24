/* =====================================================================
   install-app.js — 📲 Study Buddy on the Home Screen (v1.71.0)
   ---------------------------------------------------------------------
   One IIFE exposing `window.StudyBuddyInstall`. It does three things:

   1. REGISTERS sw.js — only on https (GitHub Pages), so the local
      harnesses on http://localhost and file:// run exactly as before and
      no worker is ever left behind by a test.
   2. SHOWS 📲 Install in the header WHEN, AND ONLY WHEN, THE DEVICE CAN
      ACT ON IT:
        • Chrome / Edge / Android: the browser's own `beforeinstallprompt`
          fired, so the button opens the browser's real install dialog.
        • iPhone / iPad: Safari has no install dialog a page can open, so
          the button opens a short panel that says where Add to Home Screen
          is (the Share button). It is never a modal and never pops up by
          itself — a child doing a worksheet is not nagged.
      It is hidden when the app is ALREADY installed (opened from the Home
      Screen) and when it is framed inside the Science portal, where the
      install would be the portal's, not ours.
   3. SAYS SO when the install finishes (`appinstalled`).

   The pure tests of which case applies (`installCase`) take their inputs
   as arguments so tools/pwa-tests.mjs can drive every platform without a
   browser.
   ===================================================================== */
(function () {
  'use strict';

  var deferredPrompt = null;
  var panelOpen = false;

  function $(id) { return document.getElementById(id); }

  /* ---------- the pure decisions ---------- */

  // iPadOS 13+ says "Macintosh" in its user agent; the touch points are
  // what give it away.
  function isAppleTouch(ua, maxTouchPoints) {
    ua = String(ua || '');
    if (/iPhone|iPad|iPod/.test(ua)) return true;
    return /Macintosh/.test(ua) && (maxTouchPoints || 0) > 1;
  }

  /* 'installed' | 'framed' | 'prompt' | 'ios' | 'none'
     env: { standalone, framed, hasPrompt, ua, maxTouchPoints } */
  function installCase(env) {
    env = env || {};
    if (env.standalone) return 'installed';
    if (env.framed) return 'framed';
    if (env.hasPrompt) return 'prompt';
    if (isAppleTouch(env.ua, env.maxTouchPoints)) return 'ios';
    return 'none';
  }

  function shouldRegister(protocol, hasServiceWorker) {
    return protocol === 'https:' && !!hasServiceWorker;
  }

  /* ---------- the live environment ---------- */

  function isStandalone() {
    try {
      if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
      if (window.matchMedia && window.matchMedia('(display-mode: fullscreen)').matches) return true;
    } catch (e) { /* old browsers */ }
    return window.navigator.standalone === true;
  }

  function isFramed() {
    try { return window.top !== window.self; } catch (e) { return true; }
  }

  function currentCase() {
    return installCase({
      standalone: isStandalone(),
      framed: isFramed(),
      hasPrompt: !!deferredPrompt,
      ua: navigator.userAgent,
      maxTouchPoints: navigator.maxTouchPoints
    });
  }

  /* ---------- the button and the panel ---------- */

  function render() {
    var btn = $('installBtn');
    if (!btn) return;
    var c = currentCase();
    btn.hidden = !(c === 'prompt' || c === 'ios');
    btn.setAttribute('data-install-case', c);
    if (btn.hidden) closePanel();
  }

  function iosSteps() {
    var ipad = /iPad/.test(navigator.userAgent) ||
      (/Macintosh/.test(navigator.userAgent) && (navigator.maxTouchPoints || 0) > 1);
    var where = ipad ? 'at the top right of Safari' : 'at the bottom of Safari';
    return '' +
      '<div class="installHead">' +
        '<b>📲 Put Study Buddy on your Home Screen</b>' +
        '<button class="installClose" type="button" id="installClose" aria-label="Close">✕</button>' +
      '</div>' +
      '<ol class="installSteps">' +
        '<li>Tap the <b>Share</b> button <span class="installShare" aria-hidden="true">' +
          '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" ' +
          'stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M8 7l4-4 4 4"/>' +
          '<path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg></span> ' + where + '.</li>' +
        '<li>Scroll down and tap <b>Add to Home Screen</b>.</li>' +
        '<li>Tap <b>Add</b>. Study Buddy opens from its own icon, full screen, with no browser bars.</li>' +
      '</ol>' +
      '<p class="installFoot">You stay signed in, and your worksheets are the same ones you see here.</p>';
  }

  function openPanel() {
    var panel = $('installPanel');
    var btn = $('installBtn');
    if (!panel || !btn) return;
    panel.innerHTML = iosSteps();
    panel.hidden = false;
    panelOpen = true;
    btn.setAttribute('aria-expanded', 'true');
    var close = $('installClose');
    if (close) close.addEventListener('click', function (e) { e.stopPropagation(); closePanel(); });
  }

  function closePanel() {
    var panel = $('installPanel');
    var btn = $('installBtn');
    if (panel) panel.hidden = true;
    if (btn) btn.setAttribute('aria-expanded', 'false');
    panelOpen = false;
  }

  function say(msg, ms) {
    if (typeof window.toast === 'function') { try { window.toast(msg, ms); return; } catch (e) { /* fall through */ } }
  }

  function onButton(e) {
    if (e) e.stopPropagation();
    var c = currentCase();
    if (c === 'prompt' && deferredPrompt) {
      var p = deferredPrompt;
      // A prompt can be shown ONCE; the browser fires a fresh
      // beforeinstallprompt if it is willing to ask again.
      deferredPrompt = null;
      try {
        p.prompt();
        if (p.userChoice && p.userChoice.then) {
          p.userChoice.then(function (choice) {
            if (choice && choice.outcome === 'dismissed') say('No problem — 📲 Install is here whenever you want it.', 3200);
            render();
          }).catch(render);
        }
      } catch (err) { /* the browser refused; nothing to do */ }
      render();
      return;
    }
    if (c === 'ios') {
      if (panelOpen) closePanel(); else openPanel();
    }
  }

  /* ---------- the worker ---------- */

  function register() {
    if (!shouldRegister(location.protocol, 'serviceWorker' in navigator)) return null;
    try {
      return navigator.serviceWorker.register('sw.js', { scope: './' }).catch(function () { return null; });
    } catch (e) { return null; }
  }

  function init() {
    var btn = $('installBtn');
    if (btn && !btn._installBound) {
      btn._installBound = true;
      btn.addEventListener('click', onButton);
    }
    var panel = $('installPanel');
    if (panel && !panel._installBound) {
      panel._installBound = true;
      panel.addEventListener('click', function (e) { e.stopPropagation(); });
    }
    document.addEventListener('click', function () { if (panelOpen) closePanel(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && panelOpen) closePanel(); });
    try {
      var mq = window.matchMedia && window.matchMedia('(display-mode: standalone)');
      if (mq && mq.addEventListener) mq.addEventListener('change', render);
    } catch (e) { /* old browsers */ }
    render();
  }

  window.StudyBuddyInstall = {
    installCase: installCase,
    isAppleTouch: isAppleTouch,
    shouldRegister: shouldRegister,
    currentCase: currentCase,
    render: render,
    register: register,
    openPanel: openPanel,
    closePanel: closePanel
  };

  /* ---------- wiring (only in a page: the tests load this with no DOM) ---------- */

  if (typeof document !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('beforeinstallprompt', function (e) {
      // Keep the browser's own mini-bar from appearing by itself; the
      // 📲 Install button in the header is where the offer lives.
      e.preventDefault();
      deferredPrompt = e;
      render();
    });

    window.addEventListener('appinstalled', function () {
      deferredPrompt = null;
      render();
      say('📲 Study Buddy is on your Home Screen. Open it from there next time.', 4000);
    });

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register);
  }
})();
