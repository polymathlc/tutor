/* =====================================================================
   ↔ A BIGGER PRACTICE WINDOW and 🔍 BIGGER DIAGRAMS — practice-size.js
   (window.PracSize, v1.100.0)
   ---------------------------------------------------------------------
   Zhi Kai: "allow me to resize the window for the practice, also allow
   resizing of dgrams using +,- buttons".

   ✏️ Practise (the mistake book's, ⚡ Quick practice's and the tracker's
   ▶ Practise — one window, #pracModal) was a fixed 520px box. On a laptop
   or an iPad lying down that is a third of the screen, and a diagram cut
   out of the paper came out smaller than it was printed.

   ① THE WINDOW. A grip in the bottom-right corner (◢) is dragged with a
     mouse, a finger or an Apple Pencil — pointer events, so all three are
     one road, and `touch-action: none` on the grip so a finger drags the
     window rather than scrolling the page. The window stays CENTRED, so
     the corner moves twice as far as the size changes on each side, and
     the corner stays under the finger. ⤢ in the title bar makes it fill
     the screen and puts it back. Arrow keys move the grip too; a double
     tap on it puts the window back to its usual size.
     The size is remembered on the device as a FRACTION of the screen
     (localStorage `polymath.tutorPracWin`), so an iPad turned round keeps
     the same share of the screen rather than a width that no longer fits.

   ② THE DIAGRAMS. 🔍 − 100% + sits with the drawing tools (and above the
     picture on a multiple-choice question, which has no pen). It matches
     the worksheet toolbar's −/+: a tap is one step, holding keeps going
     and speeds up, letting go stops dead. The percentage resets to 100%.
     The zoom is remembered on the device (`polymath.tutorPracZoom`).
     A picture bigger than the window scrolls sideways inside its own
     strip (`.pracPicScroll`), so the words and the tools stay put.

   THE INK STAYS ON THE PICTURE. practice-draw.js keeps every stroke as
   FRACTIONS of the picture and re-draws when the picture's box changes
   (a ResizeObserver), so making a picture bigger only has to make the
   picture AND the wrapper the ink covers the same new size — which is the
   one thing `applyZoom` must never get wrong (the browser check measures
   that the canvas still lies exactly over the picture, and that a line
   drawn before the zoom is still on the same printed thing after it).

   The pure half (`cleanZoom`, `stepZoom`, `holdRate`, `zoomLabel`,
   `clampWin`, `winFromPref`, `prefFromWin`, `picWidth`) is pinned by
   tools/practice-size-tests.mjs; the rest by
   tools/practice-size-browser-check.mjs in a real Chromium.
   ===================================================================== */
(function (root) {
  'use strict';

  var ZOOM_MIN = 0.5;
  var ZOOM_MAX = 3;
  var ZOOM_STEP = 1.2;          // one tap of − or +
  var HOLD_MS = 380;            // pressed this long, a tap becomes a hold
  var WIN_MIN_W = 320;
  var WIN_MIN_H = 300;
  var WIN_EDGE = 8;             // the window never touches the screen's edge
  var KEY_STEP = 32;            // an arrow key on the grip

  /* ---- pure ---- */

  function cleanZoom(z) {
    z = Number(z);
    if (!isFinite(z) || z <= 0) return 1;
    z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
    return Math.round(z * 100) / 100;
  }
  /* One tap. A step that would cross 100% stops ON it, so the way back to
     the picture's own size is always a tap away and never "96%, 115%". */
  function stepZoom(z, dir) {
    z = cleanZoom(z);
    var next = dir < 0 ? z / ZOOM_STEP : z * ZOOM_STEP;
    if ((z < 1 && next > 1) || (z > 1 && next < 1)) next = 1;
    return cleanZoom(next);
  }
  /* While held: how many times bigger per second, easing up the longer it
     is held (the worksheet's −/+ speed up the same way). */
  function holdRate(ms) {
    ms = Math.max(0, Number(ms) || 0);
    var t = Math.min(1, ms / 1600);
    return 1.5 + t * 1.7;       // ×1.5 a second at first, ×3.2 after 1.6 s
  }
  function zoomLabel(z) { return Math.round(cleanZoom(z) * 100) + '%'; }

  /* The window's size, inside the screen and never smaller than usable. On
     a screen smaller than the minimum the screen wins. */
  function clampWin(win, view) {
    view = view || {};
    var maxW = Math.max(200, (Number(view.w) || 0) - WIN_EDGE * 2);
    var maxH = Math.max(200, (Number(view.h) || 0) - WIN_EDGE * 2);
    var w = Number(win && win.w), h = Number(win && win.h);
    if (!isFinite(w)) w = maxW;
    if (!isFinite(h)) h = maxH;
    w = Math.max(Math.min(WIN_MIN_W, maxW), Math.min(maxW, w));
    h = Math.max(Math.min(WIN_MIN_H, maxH), Math.min(maxH, h));
    return { w: Math.round(w), h: Math.round(h) };
  }
  /* What is kept: fractions of the screen, or { max: true }. Anything else
     is nothing (the usual size). */
  function cleanPref(p) {
    if (!p || typeof p !== 'object') return null;
    if (p.max === true) return { max: true };
    var fw = Number(p.fw), fh = Number(p.fh);
    if (!(fw > 0 && fw <= 1.01 && fh > 0 && fh <= 1.01)) return null;
    return { fw: Math.round(fw * 1000) / 1000, fh: Math.round(fh * 1000) / 1000 };
  }
  function winFromPref(pref, view) {
    pref = cleanPref(pref);
    if (!pref) return null;
    if (pref.max) return clampWin({ w: Infinity, h: Infinity }, view);
    return clampWin({ w: pref.fw * view.w, h: pref.fh * view.h }, view);
  }
  function prefFromWin(win, view) {
    if (!win || !view || !(view.w > 0) || !(view.h > 0)) return null;
    return cleanPref({ fw: Math.min(1, win.w / view.w), fh: Math.min(1, win.h / view.h) });
  }
  /* How wide a picture is drawn. At 100% it is what the stylesheet gives
     it: a whole-question cut-out (`full`) fills the window, a small figure
     keeps its own size unless that is wider than the window. The zoom
     multiplies THAT, so 100% always looks exactly as it did before. */
  function picWidth(full, natural, container, zoom) {
    container = Math.max(1, Number(container) || 0);
    natural = Number(natural) || 0;
    var base = full ? container : (natural > 0 ? Math.min(natural, container) : container);
    return Math.max(24, Math.round(base * cleanZoom(zoom)));
  }

  /* ---- storage (a device that refuses it still works, unremembered) ---- */
  function readJson(key) {
    try { var v = root.localStorage && root.localStorage.getItem(key); return v ? JSON.parse(v) : null; }
    catch (e) { return null; }
  }
  function writeJson(key, v) {
    try {
      if (!root.localStorage) return;
      if (v == null) root.localStorage.removeItem(key);
      else root.localStorage.setItem(key, JSON.stringify(v));
    } catch (e) { /* not remembered, still works */ }
  }

  /* ---- ② the pictures ---- */

  /* Every picture of the question in `body`: the cut-out and the figures,
     never an MCQ's options picture (that is the choices, not a diagram). */
  function picturesIn(body) {
    if (!body || !body.querySelectorAll) return [];
    return Array.prototype.filter.call(body.querySelectorAll('img.pracShot, img.pracFig'), function (img) {
      return !img.classList.contains('mqOptsPic');
    });
  }
  /* The box the size is set on: the ink's wrapper when there is one (the
     ink canvas covers the wrapper, so the two must be the same size), else
     the picture itself. */
  function boxOf(img) {
    var p = img.parentNode;
    return p && p.classList && p.classList.contains('pdWrap') ? p : img;
  }
  /* Each picture goes in a strip of its own that scrolls sideways when the
     picture is wider than the window. */
  function stripOf(img, doc) {
    var box = boxOf(img);
    var p = box.parentNode;
    if (p && p.classList && p.classList.contains('pracPicScroll')) return p;
    if (!p) return null;
    var strip = (doc || img.ownerDocument).createElement('div');
    strip.className = 'pracPicScroll';
    p.insertBefore(strip, box);
    strip.appendChild(box);
    return strip;
  }
  function applyZoom(body, zoom) {
    zoom = cleanZoom(zoom);
    picturesIn(body).forEach(function (img) {
      var strip = stripOf(img);
      var box = boxOf(img);
      var full = img.classList.contains('pracShot');
      if (zoom === 1) {
        box.style.width = ''; box.style.maxWidth = '';
        img.style.width = ''; img.style.maxWidth = '';
        if (strip) strip.classList.remove('pracZoomed');
        return;
      }
      if (!full && !img.naturalWidth) {
        /* A figure not loaded yet has no size of its own: it is sized the
           moment it arrives. */
        if (!img._psWait) {
          img._psWait = true;
          img.addEventListener('load', function () { img._psWait = false; applyZoom(body, img._psZoom || zoom); }, { once: true });
        }
        img._psZoom = zoom;
        return;
      }
      var cw = strip ? strip.clientWidth : (body.clientWidth || 0);
      var w = picWidth(full, img.naturalWidth, cw, zoom);
      box.style.maxWidth = 'none';
      box.style.width = w + 'px';
      if (box !== img) { img.style.maxWidth = 'none'; img.style.width = '100%'; }
      if (strip) strip.classList.toggle('pracZoomed', w > cw + 0.5);
    });
  }

  /* 🔍 − 100% + — tap a step, hold to keep going. `get()` / `set(z)` are
     the host's: it keeps the number and redraws. */
  function zoomGroup(doc, get, set) {
    doc = doc || root.document;
    var g = doc.createElement('div');
    g.className = 'pdGroup psZoom';
    g.setAttribute('role', 'group');
    g.setAttribute('aria-label', 'Picture size');
    var icon = doc.createElement('span');
    icon.className = 'psIcon';
    icon.textContent = '🔍';
    icon.setAttribute('aria-hidden', 'true');
    g.appendChild(icon);
    var label;
    function sync() {
      var z = cleanZoom(get());
      label.textContent = zoomLabel(z);
      minus.disabled = z <= ZOOM_MIN;
      plus.disabled = z >= ZOOM_MAX;
    }
    function holdButton(dir, text, title) {
      var b = doc.createElement('button');
      b.type = 'button';
      b.className = 'pdBtn psBtn';
      b.dataset.zoom = dir < 0 ? 'out' : 'in';
      b.textContent = text;
      b.title = title;
      b.setAttribute('aria-label', title);
      b.style.touchAction = 'none';
      var hold = null;
      function stop() {
        if (!hold) return;
        clearTimeout(hold.timer);
        if (hold.raf && root.cancelAnimationFrame) root.cancelAnimationFrame(hold.raf);
        hold = null;
      }
      function frame(t) {
        if (!hold) return;
        var dt = Math.min(0.1, Math.max(0, (t - hold.last) / 1000));
        hold.last = t;
        var rate = holdRate(t - hold.from);
        var z = cleanZoom(get());
        var next = cleanZoom(dir < 0 ? z / Math.pow(rate, dt) : z * Math.pow(rate, dt));
        if (next !== z) { set(next); sync(); }
        if ((dir < 0 && next <= ZOOM_MIN) || (dir > 0 && next >= ZOOM_MAX)) { stop(); return; }
        hold.raf = root.requestAnimationFrame(frame);
      }
      b.addEventListener('pointerdown', function (e) {
        if (e.button > 0 || b.disabled) return;
        e.preventDefault();
        try { b.setPointerCapture(e.pointerId); } catch (x) { /* fine */ }
        stop();
        set(stepZoom(get(), dir));      // the tap's step lands at once
        sync();
        hold = { timer: 0, raf: 0, from: 0, last: 0 };
        hold.timer = setTimeout(function () {
          if (!hold || !root.requestAnimationFrame) return;
          var now = root.performance && root.performance.now ? root.performance.now() : Date.now();
          hold.from = now; hold.last = now;
          hold.raf = root.requestAnimationFrame(frame);
        }, HOLD_MS);
      });
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (ev) { b.addEventListener(ev, stop); });
      /* The keyboard (Enter / Space) is a click with no pointer. */
      b.addEventListener('click', function (e) {
        e.preventDefault();
        if (e.detail === 0) { set(stepZoom(get(), dir)); sync(); }
      });
      return b;
    }
    var minus = holdButton(-1, '−', 'Smaller picture (hold to keep going)');
    label = doc.createElement('button');
    label.type = 'button';
    label.className = 'pdBtn psPct';
    label.title = 'Back to the picture’s own size';
    label.setAttribute('aria-label', 'Picture size — tap for 100%');
    label.addEventListener('click', function (e) { e.preventDefault(); set(1); sync(); });
    var plus = holdButton(1, '+', 'Bigger picture (hold to keep going)');
    g.appendChild(minus);
    g.appendChild(label);
    g.appendChild(plus);
    g._psSync = sync;
    sync();
    return g;
  }

  /* ---- ① the window ---- */

  function viewSize() {
    var d = root.document && root.document.documentElement;
    return { w: root.innerWidth || (d && d.clientWidth) || 1024, h: root.innerHeight || (d && d.clientHeight) || 768 };
  }

  /* Binds the grip and ⤢ to one window. `o`: { back, card, grip, max, key,
     onSize }. Returns { apply, reset, toggleMax, pref }. */
  function bindWindow(o) {
    var back = o.back, card = o.card, grip = o.grip, maxBtn = o.max;
    var key = o.key || 'polymath.tutorPracWin';
    var pref = cleanPref(readJson(key));

    function setSize(win) {
      if (!win) {
        back.classList.remove('psSized', 'psMax');
        card.style.width = ''; card.style.height = ''; card.style.maxWidth = ''; card.style.maxHeight = '';
      } else {
        back.classList.add('psSized');
        back.classList.toggle('psMax', !!(pref && pref.max));
        card.style.maxWidth = 'none'; card.style.maxHeight = 'none';
        card.style.width = win.w + 'px'; card.style.height = win.h + 'px';
      }
      if (maxBtn) {
        var on = !!(pref && pref.max);
        maxBtn.textContent = on ? '🗗' : '⤢';
        maxBtn.title = on ? 'Back to the size it was' : 'Fill the screen';
        maxBtn.setAttribute('aria-label', maxBtn.title);
        maxBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      }
      if (typeof o.onSize === 'function') { try { o.onSize(); } catch (e) { /* the host's */ } }
    }
    function apply() { setSize(winFromPref(pref, viewSize())); }
    function save(p) { pref = cleanPref(p); writeJson(key, pref); apply(); }
    function reset() { save(null); }
    var beforeMax = null;
    function toggleMax() {
      if (pref && pref.max) save(beforeMax);
      else { beforeMax = pref; save({ max: true }); }
    }

    /* The drag. The window is centred, so it grows by twice what the
       corner moves on each axis — which keeps the corner under the finger. */
    var drag = null;
    grip.addEventListener('pointerdown', function (e) {
      if (e.button > 0) return;
      e.preventDefault();
      e.stopPropagation();
      try { grip.setPointerCapture(e.pointerId); } catch (x) { /* fine */ }
      var r = card.getBoundingClientRect();
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, w: r.width, h: r.height };
      back.classList.add('psSized', 'psDragging');
    });
    grip.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      e.preventDefault();
      var view = viewSize();
      var win = clampWin({ w: drag.w + 2 * (e.clientX - drag.x), h: drag.h + 2 * (e.clientY - drag.y) }, view);
      pref = prefFromWin(win, view);
      setSize(win);
    });
    function end(e) {
      if (!drag || (e && e.pointerId != null && e.pointerId !== drag.id)) return;
      drag = null;
      back.classList.remove('psDragging');
      try { grip.releasePointerCapture(e.pointerId); } catch (x) { /* fine */ }
      writeJson(key, pref);
    }
    grip.addEventListener('pointerup', end);
    grip.addEventListener('pointercancel', end);
    grip.addEventListener('lostpointercapture', end);
    grip.addEventListener('dblclick', function (e) { e.preventDefault(); reset(); });
    grip.addEventListener('keydown', function (e) {
      var dx = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      var dy = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
      if (!dx && !dy) return;
      e.preventDefault();
      e.stopPropagation();
      var r = card.getBoundingClientRect();
      var view = viewSize();
      var win = clampWin({ w: r.width + dx * KEY_STEP * 2, h: r.height + dy * KEY_STEP * 2 }, view);
      save(prefFromWin(win, view));
    });
    if (maxBtn) maxBtn.addEventListener('click', function (e) { e.preventDefault(); toggleMax(); });
    var onView = function () { if (back.classList.contains('open')) apply(); };
    root.addEventListener('resize', onView);
    root.addEventListener('orientationchange', onView);
    apply();
    return { apply: apply, reset: reset, toggleMax: toggleMax, pref: function () { return pref; } };
  }

  root.PracSize = {
    ZOOM_MIN: ZOOM_MIN,
    ZOOM_MAX: ZOOM_MAX,
    ZOOM_STEP: ZOOM_STEP,
    HOLD_MS: HOLD_MS,
    WIN_MIN_W: WIN_MIN_W,
    WIN_MIN_H: WIN_MIN_H,
    cleanZoom: cleanZoom,
    stepZoom: stepZoom,
    holdRate: holdRate,
    zoomLabel: zoomLabel,
    clampWin: clampWin,
    cleanPref: cleanPref,
    winFromPref: winFromPref,
    prefFromWin: prefFromWin,
    picWidth: picWidth,
    readJson: readJson,
    writeJson: writeJson,
    picturesIn: picturesIn,
    applyZoom: applyZoom,
    zoomGroup: zoomGroup,
    bindWindow: bindWindow
  };
})(typeof window !== 'undefined' ? window : globalThis);
