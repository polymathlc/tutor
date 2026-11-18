/* =====================================================================
   ✏️ DRAW ON THE QUESTION — practice-draw.js (window.PracDraw, v1.98.0)
   ---------------------------------------------------------------------
   Zhi Kai: "if the question requires annotation, student must have
   annotating tools on screen to help them practice the question." The
   question was a "Match." — join 3 × 10 and 5 × 7 to the sums that equal
   them — and ✏️ Practise offered only a box to "Write it out again…".
   A matching question, a "circle the odd one out", a "shade 3/4 of the
   figure", a "complete the bar model", a number to write IN a box on the
   picture: none of them can be answered in a text box.

   So every picture of the question in ✏️ Practise (the book, ⚡ Quick
   practice and 🎯 an objective's ▶ Practise all use it) gets a pen. The
   tools sit right above the picture and stay in view while it scrolls:
     ✋ Scroll · ✏️ Pen · 🖍 Highlight · 🧽 Eraser · four colours · ↶ Undo · 🗑 Clear
   and ✅ Check my answer sends the picture WITH the ink on it to the
   marker, which reads the lines, circles and numbers as the answer.

   IT IS ITS OWN SMALL INK, NOT THE WORKSHEET'S. The worksheet's pen is
   tied to pages, zoom, autosave, the marking run and the answer key; a
   practice question is one picture in a window, and its ink is the
   student's working for ONE try — kept on the session (it survives the
   window redrawing itself, and is shown back, read-only, beside the
   answer) and never saved or printed.

   THE STROKES ARE STORED AS FRACTIONS OF THE PICTURE, so a window that
   is resized, an iPad turned round, or the composite sent to the marker
   at the picture's own size all draw the same line in the same place.

   AN APPLE PENCIL ALWAYS WRITES, and once one has been used a finger on
   the picture is a palm and is ignored — the worksheet's own rule. With
   ✋ Scroll a finger scrolls the window as usual and the pencil still
   writes; with a drawing tool a finger (or mouse) draws too.

   The pure half (`wantsDrawing`, `cleanStroke`, `strokeHit`, `inkCount`)
   is pinned by tools/practice-draw-tests.mjs; the rest by
   tools/practice-draw-browser-check.mjs in a real Chromium.
   ===================================================================== */
(function (root) {
  'use strict';

  var COLOURS = [
    { c: '#1E5BD8', name: 'Blue' },
    { c: '#D32F2F', name: 'Red' },
    { c: '#1F1F1F', name: 'Black' },
    { c: '#2E7D32', name: 'Green' }
  ];
  var HI_COLOUR = '#FFD54A';
  var PEN_W = 0.0055;        // a pen line, as a fraction of the picture's width
  var HI_W = 0.03;           // a highlighter stroke
  var ERASE_R = 0.022;       // how close the eraser must come to a stroke
  var MAX_POINTS = 4000;     // one stroke
  var MAX_STROKES = 400;     // one picture

  /* ---- pure ---- */

  /* Does the wording ask for something to be DONE on the picture? Then
     the pen is picked up for them; otherwise ✋ Scroll is, and the tools
     are still right there. */
  var DRAW_RE = new RegExp('\\b(?:' + [
    'match(?:es|ing)?', 'join', 'connect', 'draw', 'sketch', 'trace', 'circle', 'underline', 'shade', 'colou?r',
    'tick', 'cross(?:\\s+out)?', 'label', 'mark(?:\\s+(?:the|an?|with|on|it|them|each|all))', 'plot', 'arrow',
    'complete\\s+the\\s+(?:table|diagram|figure|graph|bar|pattern|model|chart|drawing|picture|number\\s+line|grid|shape|line)',
    'fill\\s+in(?:\\s+the)?\\s+(?:box|boxes|blank|blanks|table|grid|missing)', 'in\\s+the\\s+box(?:es)?',
    'on\\s+the\\s+(?:grid|diagram|figure|graph|number\\s+line|picture|clock|map)', 'measure', 'rule\\s+a', 'line\\s+of\\s+symmetry'
  ].join('|') + ')\\b', 'i');
  function wantsDrawing(text) {
    return DRAW_RE.test(String(text == null ? '' : text));
  }

  function clamp01(v) { v = Number(v); return v < 0 ? 0 : v > 1 ? 1 : (isFinite(v) ? v : 0); }
  /* One stroke as it may be kept: points inside the picture, a known tool
     and a colour that is a colour. Anything else is null. */
  function cleanStroke(s) {
    if (!s || !Array.isArray(s.p) || !s.p.length) return null;
    var t = s.t === 'hi' ? 'hi' : 'pen';
    var c = /^#[0-9a-f]{6}$/i.test(String(s.c || '')) ? s.c : (t === 'hi' ? HI_COLOUR : COLOURS[0].c);
    var w = Number(s.w);
    if (!(w > 0 && w < 0.2)) w = t === 'hi' ? HI_W : PEN_W;
    var p = s.p.slice(0, MAX_POINTS).map(function (q) {
      return [clamp01(q && q[0]), clamp01(q && q[1]), q && q[2] > 0 && q[2] <= 1 ? Number(q[2]) : 0.5];
    });
    return { t: t, c: c, w: w, p: p };
  }
  /* Does the eraser at (x, y) touch the stroke? Distances are measured in
     units of the picture's WIDTH, so `aspect` (height / width) turns a step
     down the picture into the same yardstick. */
  function strokeHit(s, x, y, r, aspect) {
    if (!s || !Array.isArray(s.p)) return false;
    aspect = aspect > 0 ? aspect : 1;
    var rr = (r || ERASE_R) + (s.w || 0) / 2;
    function d2seg(ax, ay, bx, by) {
      var dx = bx - ax, dy = by - ay;
      var len = dx * dx + dy * dy;
      var t = len ? ((x - ax) * dx + (y * aspect - ay) * dy) / len : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      var px = ax + t * dx - x, py = ay + t * dy - y * aspect;
      return px * px + py * py;
    }
    for (var i = 0; i < s.p.length; i++) {
      var a = s.p[i], b = s.p[i + 1] || a;
      if (d2seg(a[0], a[1] * aspect, b[0], b[1] * aspect) <= rr * rr) return true;
    }
    return false;
  }
  function inkCount(inks) {
    var n = 0;
    Object.keys(inks || {}).forEach(function (k) { n += (inks[k] || []).length; });
    return n;
  }

  /* ---- drawing a list of strokes onto a 2D context of width W, height H ---- */
  function paint(ctx, strokes, W, H) {
    if (!ctx) return;
    var order = (strokes || []).filter(function (s) { return s.t === 'hi'; })
      .concat((strokes || []).filter(function (s) { return s.t !== 'hi'; }));
    order.forEach(function (s) {
      var pts = s.p;
      if (!pts || !pts.length) return;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = s.c;
      ctx.fillStyle = s.c;
      if (s.t === 'hi') {
        ctx.globalAlpha = 0.42;
        try { ctx.globalCompositeOperation = 'multiply'; } catch (e) { /* plain alpha then */ }
      }
      var base = Math.max(1, s.w * W);
      if (pts.length === 1) {
        ctx.beginPath();
        ctx.arc(pts[0][0] * W, pts[0][1] * H, base / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return;
      }
      if (s.t === 'hi') {
        ctx.lineWidth = base;
        ctx.beginPath();
        ctx.moveTo(pts[0][0] * W, pts[0][1] * H);
        for (var j = 1; j < pts.length; j++) ctx.lineTo(pts[j][0] * W, pts[j][1] * H);
        ctx.stroke();
        ctx.restore();
        return;
      }
      /* A pen line is drawn segment by segment through the midpoints, so it
         is smooth, and each segment takes its own width from the pencil's
         pressure (0.5 when there is none: a finger or a mouse). */
      for (var i = 1; i < pts.length; i++) {
        var p0 = pts[i - 1], p1 = pts[i];
        var pr = (p0[2] + p1[2]) / 2;
        ctx.lineWidth = Math.max(1, base * (0.55 + pr * 0.9));
        ctx.beginPath();
        var mx0 = i > 1 ? (pts[i - 2][0] + p0[0]) / 2 : p0[0];
        var my0 = i > 1 ? (pts[i - 2][1] + p0[1]) / 2 : p0[1];
        var mx1 = (p0[0] + p1[0]) / 2, my1 = (p0[1] + p1[1]) / 2;
        if (i === pts.length - 1) { mx1 = p1[0]; my1 = p1[1]; }
        ctx.moveTo(mx0 * W, my0 * H);
        ctx.quadraticCurveTo(p0[0] * W, p0[1] * H, mx1 * W, my1 * H);
        ctx.stroke();
      }
      ctx.restore();
    });
  }

  /* ---- a session: one practice window's worth of ink ---- */
  function session(opts) {
    opts = opts || {};
    var S = {
      tool: opts.tool === 'pen' || opts.tool === 'hi' || opts.tool === 'erase' ? opts.tool : 'scroll',
      colour: COLOURS[0].c,
      inks: {},
      undo: [],
      readOnly: false,
      penSeen: false,
      layers: [],
      bars: [],
      onChange: typeof opts.onChange === 'function' ? opts.onChange : null
    };

    function changed() { syncBars(); if (S.onChange) { try { S.onChange(S); } catch (e) { /* the host's */ } } }
    /* What is still on screen. A node not yet put in the page is kept (it is
       about to be); one that WAS on screen and has gone is let go. */
    function still(node) {
      if (node.isConnected) { node._pdSeen = true; return true; }
      return !node._pdSeen;
    }
    function live() {
      S.layers = S.layers.filter(function (L) { return still(L.wrap); });
      S.bars = S.bars.filter(still);
    }
    function strokesOf(key) { return S.inks[key] || (S.inks[key] = []); }
    function snapshot(key) { S.undo.push({ key: key, before: strokesOf(key).slice() }); if (S.undo.length > 100) S.undo.shift(); }

    function sizeLayer(L) {
      var r = L.img.getBoundingClientRect();
      var cw = Math.max(1, Math.round(r.width)), ch = Math.max(1, Math.round(r.height));
      var dpr = Math.min(3, (root.devicePixelRatio || 1));
      var W = Math.round(cw * dpr), H = Math.round(ch * dpr);
      if (L.canvas.width !== W || L.canvas.height !== H) { L.canvas.width = W; L.canvas.height = H; }
      L.cw = cw; L.ch = ch;
      redraw(L);
    }
    function redraw(L, extra) {
      var ctx = L.canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, L.canvas.width, L.canvas.height);
      paint(ctx, strokesOf(L.key).concat(extra ? [extra] : []), L.canvas.width, L.canvas.height);
    }
    function touchAction() {
      return S.readOnly || S.tool === 'scroll' ? 'pan-x pan-y pinch-zoom' : 'none';
    }
    function syncLayers() {
      live();
      S.layers.forEach(function (L) {
        L.canvas.style.touchAction = touchAction();
        L.wrap.classList.toggle('pdDrawing', !S.readOnly && S.tool !== 'scroll');
        L.wrap.classList.toggle('pdReadOnly', !!S.readOnly);
        L.canvas.style.cursor = S.readOnly || S.tool === 'scroll' ? '' : (S.tool === 'erase' ? 'cell' : 'crosshair');
      });
    }

    function attach(img, key, how) {
      var doc = img.ownerDocument;
      live();
      var wrap = doc.createElement('div');
      /* A picture that fills the window takes the wrapper's whole width; a
         small figure keeps its own size, and the wrapper hugs it — the ink
         is laid exactly over the picture either way. */
      wrap.className = 'pdWrap' + (how && how.full ? ' pdFull' : '');
      if (img.parentNode) img.parentNode.replaceChild(wrap, img);
      wrap.appendChild(img);
      var canvas = doc.createElement('canvas');
      canvas.className = 'pdInk';
      canvas.setAttribute('aria-label', 'Draw your answer on the question');
      wrap.appendChild(canvas);
      var L = { wrap: wrap, img: img, canvas: canvas, key: String(key), cw: 0, ch: 0, cur: null, pid: null };
      S.layers.push(L);
      var onSize = function () { if (wrap.isConnected) sizeLayer(L); };
      if (img.complete && img.naturalWidth) setTimeout(onSize, 0);
      img.addEventListener('load', onSize);
      if (typeof root.ResizeObserver === 'function') {
        L.ro = new root.ResizeObserver(onSize);
        L.ro.observe(img);
      }
      bind(L);
      syncLayers();
      return wrap;
    }

    function at(L, e) {
      var r = L.canvas.getBoundingClientRect();
      var pr = e.pointerType === 'pen' && e.pressure > 0 ? Math.min(1, e.pressure) : 0.5;
      return [clamp01((e.clientX - r.left) / (r.width || 1)), clamp01((e.clientY - r.top) / (r.height || 1)), pr];
    }
    function eraseAt(L, pt) {
      var list = strokesOf(L.key);
      var aspect = (L.ch || 1) / (L.cw || 1);
      var keep = list.filter(function (s) { return !strokeHit(s, pt[0], pt[1], ERASE_R, aspect); });
      if (keep.length === list.length) return false;
      if (!L.erased) { snapshot(L.key); L.erased = true; }
      S.inks[L.key] = keep;
      redraw(L);
      return true;
    }
    function bind(L) {
      var c = L.canvas;
      c.addEventListener('pointerdown', function (e) {
        if (S.readOnly || L.pid !== null) return;
        if (e.pointerType === 'pen') { S.penSeen = true; }
        var tool = S.tool;
        if (tool === 'scroll') {
          if (e.pointerType !== 'pen') return;       // a finger or mouse scrolls
          tool = 'pen';                              // the pencil always writes
        }
        if (e.pointerType === 'touch' && S.penSeen) return;   // a palm on the glass
        if (e.button > 0) return;
        e.preventDefault();
        try { c.setPointerCapture(e.pointerId); } catch (x) { /* fine */ }
        L.pid = e.pointerId;
        L.erased = false;
        var pt = at(L, e);
        if (tool === 'erase') { L.cur = { erase: true }; eraseAt(L, pt); return; }
        L.cur = { t: tool === 'hi' ? 'hi' : 'pen', c: tool === 'hi' ? HI_COLOUR : S.colour,
                  w: tool === 'hi' ? HI_W : PEN_W, p: [pt] };
        redraw(L, L.cur);
      });
      c.addEventListener('pointermove', function (e) {
        if (L.pid !== e.pointerId || !L.cur) return;
        e.preventDefault();
        var evs = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : null;
        if (!evs || !evs.length) evs = [e];
        if (L.cur.erase) { evs.forEach(function (ev) { eraseAt(L, at(L, ev)); }); return; }
        evs.forEach(function (ev) { if (L.cur.p.length < MAX_POINTS) L.cur.p.push(at(L, ev)); });
        redraw(L, L.cur);
      });
      var end = function (e) {
        if (L.pid !== e.pointerId) return;
        var cur = L.cur;
        L.pid = null;
        L.cur = null;
        try { c.releasePointerCapture(e.pointerId); } catch (x) { /* fine */ }
        if (!cur) return;
        if (cur.erase) { if (L.erased) changed(); L.erased = false; return; }
        if (e.type === 'pointercancel' && cur.p.length < 3) { redraw(L); return; }
        var s = cleanStroke(cur);
        if (!s) { redraw(L); return; }
        snapshot(L.key);
        var list = strokesOf(L.key);
        list.push(s);
        if (list.length > MAX_STROKES) list.shift();
        redraw(L);
        changed();
      };
      c.addEventListener('pointerup', end);
      c.addEventListener('pointercancel', end);
      c.addEventListener('lostpointercapture', function (e) { if (L.pid === e.pointerId) end({ type: 'pointerup', pointerId: e.pointerId }); });
    }

    function redrawAll() { live(); S.layers.forEach(function (L) { redraw(L); }); }
    function setTool(t) {
      S.tool = t === 'pen' || t === 'hi' || t === 'erase' ? t : 'scroll';
      syncLayers();
      syncBars();
    }
    function setColour(c) {
      if (!/^#[0-9a-f]{6}$/i.test(String(c))) return;
      S.colour = c;
      if (S.tool === 'scroll' || S.tool === 'erase' || S.tool === 'hi') S.tool = 'pen';
      syncLayers();
      syncBars();
    }
    function undoOne() {
      var u = S.undo.pop();
      if (!u) return false;
      S.inks[u.key] = u.before;
      redrawAll();
      changed();
      return true;
    }
    function clear(key) {
      var keys = key == null ? Object.keys(S.inks) : [String(key)];
      var any = false;
      keys.forEach(function (k) {
        if ((S.inks[k] || []).length) { snapshot(k); S.inks[k] = []; any = true; }
      });
      if (any) { redrawAll(); changed(); }
      return any;
    }
    function hasInk(key) {
      return key == null ? inkCount(S.inks) > 0 : (S.inks[String(key)] || []).length > 0;
    }
    function setReadOnly(on) { S.readOnly = !!on; syncLayers(); syncBars(); }

    function button(doc, cls, label, title, fn) {
      var b = doc.createElement('button');
      b.type = 'button';
      b.className = 'pdBtn ' + (cls || '');
      b.textContent = label;
      b.title = title;
      b.setAttribute('aria-label', title);
      b.addEventListener('click', function (e) { e.preventDefault(); fn(); });
      return b;
    }
    function toolbar(doc) {
      doc = doc || root.document;
      live();
      var bar = doc.createElement('div');
      bar.className = 'pdBar';
      bar.setAttribute('role', 'toolbar');
      bar.setAttribute('aria-label', 'Drawing tools');
      var tools = doc.createElement('div');
      tools.className = 'pdGroup';
      [['scroll', '✋', 'Scroll (a finger moves the page; an Apple Pencil still writes)'],
       ['pen', '✏️', 'Pen'], ['hi', '🖍', 'Highlighter'], ['erase', '🧽', 'Eraser (rub over a line)']].forEach(function (t) {
        var b = button(doc, 'pdTool', t[1], t[2], function () { setTool(t[0]); });
        b.dataset.tool = t[0];
        tools.appendChild(b);
      });
      bar.appendChild(tools);
      var cols = doc.createElement('div');
      cols.className = 'pdGroup pdColours';
      COLOURS.forEach(function (o) {
        var b = button(doc, 'pdColour', '', o.name + ' pen', function () { setColour(o.c); });
        b.dataset.colour = o.c;
        b.style.setProperty('--pd-c', o.c);
        cols.appendChild(b);
      });
      bar.appendChild(cols);
      var acts = doc.createElement('div');
      acts.className = 'pdGroup';
      acts.appendChild(button(doc, 'pdUndo', '↶', 'Undo', undoOne));
      acts.appendChild(button(doc, 'pdClear', '🗑', 'Rub it all out', function () { clear(); }));
      bar.appendChild(acts);
      S.bars.push(bar);
      syncBars();
      return bar;
    }
    function syncBars() {
      live();
      S.bars.forEach(function (bar) {
        bar.classList.toggle('pdOff', !!S.readOnly);
        Array.prototype.forEach.call(bar.querySelectorAll('.pdTool'), function (b) {
          var on = b.dataset.tool === S.tool;
          b.classList.toggle('on', on);
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
          b.disabled = !!S.readOnly;
        });
        Array.prototype.forEach.call(bar.querySelectorAll('.pdColour'), function (b) {
          var on = b.dataset.colour === S.colour && S.tool === 'pen';
          b.classList.toggle('on', on);
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
          b.disabled = !!S.readOnly;
        });
        var u = bar.querySelector('.pdUndo'), cl = bar.querySelector('.pdClear');
        if (u) u.disabled = !!S.readOnly || !S.undo.length;
        if (cl) cl.disabled = !!S.readOnly || !hasInk();
      });
    }

    /* The picture WITH the ink, as base64 JPEG for the marker. A picture
       that cannot be read back (a server that sent no CORS header) gives
       the ink alone on white at the picture's shape, which still shows
       the marker what was drawn, if not over what. */
    function composite(img, key, maxSide) {
      var doc = img.ownerDocument;
      var nw = img.naturalWidth || img.width, nh = img.naturalHeight || img.height;
      if (!nw || !nh) return null;
      var f = Math.min(1, (maxSide || 1600) / Math.max(nw, nh));
      var W = Math.max(1, Math.round(nw * f)), H = Math.max(1, Math.round(nh * f));
      var c = doc.createElement('canvas');
      c.width = W; c.height = H;
      var ctx = c.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, W, H);
      var withPicture = true;
      try { ctx.drawImage(img, 0, 0, W, H); } catch (e) { withPicture = false; }
      paint(ctx, strokesOf(String(key)), W, H);
      var data = '';
      try { data = c.toDataURL('image/jpeg', 0.88); }
      catch (e) {
        withPicture = false;
        ctx.fillStyle = '#fff';
        c.width = W; c.height = H;
        ctx = c.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, W, H);
        paint(ctx, strokesOf(String(key)), W, H);
        try { data = c.toDataURL('image/jpeg', 0.88); } catch (e2) { data = ''; }
      }
      c.width = 0; c.height = 0;
      return data ? { data: data.split(',')[1], mimeType: 'image/jpeg', withPicture: withPicture } : null;
    }

    S.attach = attach;
    S.toolbar = toolbar;
    S.setTool = setTool;
    S.setColour = setColour;
    S.undoOne = undoOne;
    S.clear = clear;
    S.hasInk = hasInk;
    S.setReadOnly = setReadOnly;
    S.composite = composite;
    S.redraw = redrawAll;
    S.layersFor = function (key) { live(); return S.layers.filter(function (L) { return L.key === String(key); }); };
    return S;
  }

  root.PracDraw = {
    COLOURS: COLOURS,
    PEN_W: PEN_W,
    HI_W: HI_W,
    wantsDrawing: wantsDrawing,
    cleanStroke: cleanStroke,
    strokeHit: strokeHit,
    inkCount: inkCount,
    paint: paint,
    session: session
  };
})(typeof window !== 'undefined' ? window : globalThis);
