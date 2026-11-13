/* =====================================================================
   🗒 THE WHITEBOARD — an infinite board a student keeps in the cloud
   ---------------------------------------------------------------------
   Study Buddy v1.89.0. One file, one global: `window.Whiteboard`.

   What it is for. A worksheet is one fixed sheet of paper; a student who
   wants to gather the three questions they keep getting wrong, the diagram
   from page 4 and their own working beside each, had nowhere to put them.
   The board is that place: it goes on for ever in every direction, it
   holds PICTURES cut from worksheets, QUESTIONS TO TRY AGAIN (from the
   mistake book, or cut straight off a page), sticky NOTES and the
   student's own PEN, and it lives in the cloud so it is the same board on
   the iPad at the centre and the laptop at home.

   THE FILE KNOWS NOTHING ABOUT FIREBASE, THE MISTAKE BOOK OR THE WORKSHEET.
   Everything outside the board comes in through the host's `opts` (see
   `create`): where a stored picture's URL comes from, how a question from
   the mistake book is drawn, what ▶ Practise does, how a typed answer is
   checked. That is what lets tools/whiteboard-tests.mjs drive the whole
   pure half in Node, and what keeps the glue in index.html the one place
   that decides where a board is saved.

   THE PURE HALF (`Whiteboard.pure`) IS THE ONE DOOR A BOARD COMES IN BY.
   `cleanBoard` is run on every board read from the cloud, every draft read
   back from the device and every item added by the host. A stroke with a
   NaN in it, a picture whose `src` is a `javascript:` URL, a note ten
   megabytes long — each is refused or trimmed there, once, and nothing
   downstream has to ask again.

   THE PEN NEVER TOUCHES A PICTURE. Ink is its own list (`strokes`) drawn
   in its own SVG layer ABOVE the items, so 👁 Workings can hide every
   stroke at once and the pictures and questions underneath come back
   clean — which is the whole point of the toggle: a clean screenshot of
   what was cut, or of the board, without the student's scribbles over it.

   UNDO IS BY SNAPSHOT, AND SNAPSHOTS ARE CHEAP BY CONSTRUCTION. A snapshot
   is a shallow copy of every item and stroke. That is only safe because
   NOTHING MUTATES A STROKE'S POINT ARRAY IN PLACE — a move makes a new
   array — and pictures are strings, which are shared, not copied. So
   eighty steps of undo on a board holding a dozen pictures costs a few
   hundred small objects, not eighty copies of the pictures.
   ===================================================================== */
(function (root) {
  'use strict';

  var VERSION = '1.0.0';

  /* ------------------------------------------------------------------
     Constants. Every limit is a guard against a board that has grown
     past what one JSON file in Storage and one phone's memory should
     hold — not a design choice a student would ever bump into.
     ------------------------------------------------------------------ */
  var PALETTE = ['#1f1f1f', '#1565c0', '#c62828', '#2e7d32', '#6a1b9a', '#ef6c00'];
  var HL_PALETTE = ['#fff176', '#a5d6a7', '#90caf9', '#f8bbd0'];
  var NOTE_COLORS = ['#fff3a8', '#ffd6e0', '#d4f1ff', '#dff5d8'];
  var SIZES = [2, 4, 8];             // pen widths in board units (S M L)
  var HL_SIZES = [14, 22, 32];       // the highlighter is wide by nature
  var ERASER_R = 10;                 // screen px the eraser reaches either side
  var Z_MIN = 0.1, Z_MAX = 4;        // 10% to 400%
  var GRID = 24;                     // the dot grid, in board units
  var PTS_MAX = 6000;                // numbers in one stroke (3000 points)
  var STROKES_MAX = 4000;
  var ITEMS_MAX = 300;
  var HISTORY_MAX = 80;
  var TEXT_MAX = 4000;
  var QTEXT_MAX = 2000;
  var TITLE_MAX = 80;
  var SIMPLIFY_TOL = 0.6;            // board units; a stroke loses no visible shape
  var NOTE_W = 220, NOTE_H = 150;
  var Q_W = 440, Q_H = 340;
  var IMG_MAX_W = 560;               // a pasted picture lands at most this wide
  var EXPORT_MAX_PX = 2400;
  var TAP_MS = 350, TAP_PX = 6;
  var TOOLS = ['hand', 'select', 'pen', 'hl', 'eraser', 'note'];

  /* ==================================================================
     THE PURE HALF — no DOM, no clock except where it is passed in.
     ================================================================== */

  function num(v, d) { v = Number(v); return isFinite(v) ? v : d; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function r1(v) { return Math.round(v * 10) / 10; }
  function newId(prefix) {
    return (prefix || '') + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function cleanId(v) {
    v = String(v == null ? '' : v);
    return /^[A-Za-z0-9_-]{1,40}$/.test(v) ? v : '';
  }
  function cleanColor(c, fallback) {
    c = String(c == null ? '' : c);
    return /^#[0-9a-f]{6}$/i.test(c) ? c.toLowerCase() : fallback;
  }
  function cleanText(s, max) {
    // Control characters other than the newline and tab are never wanted in
    // a note, and a NUL in a JSON file is a file some readers choke on.
    return String(s == null ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').slice(0, max);
  }
  /* A Storage path is plain: letters, digits, `_ - . /`, never `..`, never
     a scheme. The host turns it into a URL; a path that could be anything
     else is the door to something that is not the student's picture. */
  function cleanPath(p) {
    p = String(p == null ? '' : p);
    return /^[A-Za-z0-9_\-./]{1,300}$/.test(p) && p.indexOf('..') < 0 && p.charAt(0) !== '/' ? p : '';
  }
  /* What may go straight into an <img src>: a picture made on this device
     (data:image/…) or an https link. Never javascript:, never http:. A
     blob: URL is allowed while the board is OPEN and dropped on save
     (`forSave`), because it means nothing on any other device. */
  function cleanSrc(s, allowBlob) {
    s = String(s == null ? '' : s);
    if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=\s]+$/i.test(s)) return s;
    if (/^https:\/\/[^\s"'<>]+$/i.test(s)) return s;
    if (allowBlob && /^blob:[^\s"'<>]+$/i.test(s)) return s;
    return '';
  }
  function cleanView(v) {
    v = v || {};
    return { x: r1(clamp(num(v.x, 0), -1e7, 1e7)), y: r1(clamp(num(v.y, 0), -1e7, 1e7)),
             z: Math.round(clamp(num(v.z, 1), Z_MIN, Z_MAX) * 1000) / 1000 };
  }
  function cleanFrom(f) {
    if (!f || typeof f !== 'object') return null;
    var out = {};
    var doc = cleanText(f.doc, 120).trim();
    if (doc) out.doc = doc;
    var ws = cleanId(f.ws);
    if (ws) out.ws = ws;
    if (Array.isArray(f.pages)) {
      var pg = f.pages.map(function (n) { return Math.round(num(n, 0)); })
        .filter(function (n) { return n > 0 && n < 10000; }).slice(0, 3);
      if (pg.length) out.pages = pg;
    }
    if (f.ink != null) out.ink = !!f.ink;
    return Object.keys(out).length ? out : null;
  }

  /* ONE STROKE. The point list is flat — x0, y0, x1, y1 … — rounded to a
     tenth of a board unit, which is far below anything a pen can draw and
     keeps a board's JSON about a third of the size of full doubles. */
  function cleanStroke(s) {
    if (!s || typeof s !== 'object' || !Array.isArray(s.p)) return null;
    var raw = s.p, p = [];
    for (var i = 0; i + 1 < raw.length && p.length < PTS_MAX; i += 2) {
      var x = Number(raw[i]), y = Number(raw[i + 1]);
      if (!isFinite(x) || !isFinite(y) || Math.abs(x) > 1e7 || Math.abs(y) > 1e7) continue;
      p.push(r1(x), r1(y));
    }
    if (p.length < 2) return null;
    var hl = !!s.hl;
    return {
      id: cleanId(s.id) || newId('s'),
      c: cleanColor(s.c, hl ? HL_PALETTE[0] : PALETTE[0]),
      w: Math.round(clamp(num(s.w, 3), 0.5, 80) * 10) / 10,
      hl: hl ? 1 : 0,
      p: p
    };
  }

  /* ONE ITEM: a picture, a note or a question to try again. Every field a
     renderer reads is decided here, so a renderer never has to wonder
     whether `w` is a number. */
  function cleanItem(it, opts) {
    if (!it || typeof it !== 'object') return null;
    opts = opts || {};
    var t = String(it.t || '');
    if (t !== 'img' && t !== 'note' && t !== 'q') return null;
    var base = {
      id: cleanId(it.id) || newId(t),
      t: t,
      x: r1(clamp(num(it.x, 0), -1e7, 1e7)),
      y: r1(clamp(num(it.y, 0), -1e7, 1e7)),
      w: r1(clamp(num(it.w, t === 'note' ? NOTE_W : t === 'q' ? Q_W : 320), 40, 6000)),
      h: r1(clamp(num(it.h, t === 'note' ? NOTE_H : t === 'q' ? Q_H : 240), 30, 9000))
    };
    var from = cleanFrom(it.from);
    if (from) base.from = from;
    if (t === 'img') {
      var path = cleanPath(it.path), src = cleanSrc(it.src, opts.allowBlob);
      // A picture with nowhere to come from is an empty frame on the board.
      if (!path && !src) return null;
      if (path) base.path = path;
      if (src) base.src = src;
      var cap = cleanText(it.cap, 200).trim();
      if (cap) base.cap = cap;
      return base;
    }
    if (t === 'note') {
      base.text = cleanText(it.text, TEXT_MAX);
      base.color = NOTE_COLORS.indexOf(it.color) >= 0 ? it.color : NOTE_COLORS[0];
      base.fs = Math.round(clamp(num(it.fs, 18), 12, 48));
      return base;
    }
    // t === 'q'
    var mid = cleanId(it.mid);
    if (mid) base.mid = mid;
    var qn = cleanText(it.num, 12).trim();
    if (qn) base.num = qn;
    var doc = cleanText(it.doc, 120).trim();
    if (doc) base.doc = doc;
    base.text = cleanText(it.text, QTEXT_MAX);
    var ans = cleanText(it.answer, 1000).trim();
    if (ans) base.answer = ans;
    var why = cleanText(it.why, 2000).trim();
    if (why) base.why = why;
    var qp = cleanPath(it.path), qs = cleanSrc(it.src, opts.allowBlob);
    if (qp) base.path = qp;
    if (qs) base.src = qs;
    var tried = cleanText(it.tried, 500);
    if (tried) base.tried = tried;
    if (it.verdict === 'right' || it.verdict === 'wrong') base.verdict = it.verdict;
    base.done = !!it.done;
    base.shown = !!it.shown;
    // A question card with no words AND no picture asks nothing.
    if (!base.text.trim() && !base.path && !base.src && !base.mid) return null;
    return base;
  }

  /* THE ONE DOOR A BOARD COMES IN BY. Duplicate ids are renamed rather
     than dropped (two strokes sharing an id would make the eraser take
     both), and the lists are capped. */
  function cleanBoard(raw, opts) {
    raw = raw && typeof raw === 'object' ? raw : {};
    var now = num(opts && opts.now, Date.now());
    var b = {
      v: 1,
      id: cleanId(raw.id) || newId('b'),
      title: cleanText(raw.title, TITLE_MAX).replace(/\s+/g, ' ').trim() || 'My whiteboard',
      created: Math.round(num(raw.created, now)),
      updated: Math.round(num(raw.updated, now)),
      who: cleanText(raw.who, 60).trim(),
      view: cleanView(raw.view),
      items: [],
      strokes: []
    };
    var seen = {};
    function fresh(x, prefix) {
      if (seen[x.id]) x.id = newId(prefix);
      seen[x.id] = 1;
      return x;
    }
    (Array.isArray(raw.items) ? raw.items : []).forEach(function (it) {
      if (b.items.length >= ITEMS_MAX) return;
      var c = cleanItem(it, opts);
      if (c) b.items.push(fresh(c, c.t));
    });
    (Array.isArray(raw.strokes) ? raw.strokes : []).forEach(function (s) {
      if (b.strokes.length >= STROKES_MAX) return;
      var c = cleanStroke(s);
      if (c) b.strokes.push(fresh(c, 's'));
    });
    return b;
  }

  function newBoard(title, opts) {
    var now = num(opts && opts.now, Date.now());
    return cleanBoard({ id: newId('b'), title: title, created: now, updated: now,
      who: opts && opts.who, view: { x: 0, y: 0, z: 1 } }, { now: now });
  }

  /* What goes up to the cloud. A picture that has been uploaded keeps only
     its PATH — the data: URL it was made from would double the file, and
     every board would carry every picture twice. A picture whose upload
     failed keeps its data: URL, so it is still saved, just bigger. A blob:
     URL means nothing on another device and never leaves this one. */
  function forSave(board) {
    var b = cleanBoard(board, { allowBlob: true });
    b.items = b.items.map(function (it) {
      var c = Object.assign({}, it);
      if (c.path && c.src) delete c.src;
      if (c.src && /^blob:/i.test(c.src)) delete c.src;
      return c;
    }).filter(function (it) { return it.t !== 'img' || it.path || it.src; });
    return b;
  }

  /* The few numbers the board list shows, from the board alone. */
  function summary(board) {
    var items = (board && board.items) || [];
    var qs = items.filter(function (it) { return it.t === 'q'; });
    return {
      items: items.length,
      pictures: items.filter(function (it) { return it.t === 'img'; }).length,
      notes: items.filter(function (it) { return it.t === 'note'; }).length,
      questions: qs.length,
      done: qs.filter(function (q) { return q.done; }).length,
      strokes: ((board && board.strokes) || []).length
    };
  }

  function byteSize(obj) {
    var s = typeof obj === 'string' ? obj : JSON.stringify(obj);
    var n = 0;
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      n += c < 0x80 ? 1 : c < 0x800 ? 2 : (c >= 0xD800 && c <= 0xDBFF) ? (i++, 4) : 3;
    }
    return n;
  }

  /* ---- Strokes: thinning and drawing ---- */

  /* Ramer–Douglas–Peucker on the flat list. A pen sampled at 240 Hz lays
     down far more points than the shape needs; this keeps the corners and
     drops the rest, with a tolerance well under a pixel at 100%. */
  function simplify(pts, tol) {
    var n = Math.floor(pts.length / 2);
    if (n <= 2) return pts.slice(0, n * 2);
    tol = tol == null ? SIMPLIFY_TOL : tol;
    var keep = new Uint8Array(n);
    keep[0] = 1; keep[n - 1] = 1;
    var stack = [[0, n - 1]];
    var t2 = tol * tol;
    while (stack.length) {
      var seg = stack.pop(), a = seg[0], b = seg[1];
      var ax = pts[a * 2], ay = pts[a * 2 + 1], bx = pts[b * 2], by = pts[b * 2 + 1];
      var best = -1, bestD = t2;
      for (var i = a + 1; i < b; i++) {
        var d = segDist2(pts[i * 2], pts[i * 2 + 1], ax, ay, bx, by);
        if (d > bestD) { bestD = d; best = i; }
      }
      if (best > 0) { keep[best] = 1; stack.push([a, best], [best, b]); }
    }
    var out = [];
    for (var k = 0; k < n; k++) if (keep[k]) out.push(pts[k * 2], pts[k * 2 + 1]);
    return out;
  }

  function segDist2(px, py, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay;
    var len = dx * dx + dy * dy;
    var t = len ? clamp(((px - ax) * dx + (py - ay) * dy) / len, 0, 1) : 0;
    var x = ax + t * dx - px, y = ay + t * dy - py;
    return x * x + y * y;
  }

  /* A smooth path through the points: a quadratic through each midpoint,
     the way a pen line is drawn everywhere else in the family. A single
     point is a dot, drawn as a zero-length line with a round cap. */
  function strokePath(pts) {
    var n = Math.floor(pts.length / 2);
    if (!n) return '';
    var f = function (v) { return Math.round(v * 10) / 10; };
    if (n === 1) return 'M' + f(pts[0]) + ' ' + f(pts[1]) + 'l0.01 0';
    if (n === 2) return 'M' + f(pts[0]) + ' ' + f(pts[1]) + 'L' + f(pts[2]) + ' ' + f(pts[3]);
    var d = 'M' + f(pts[0]) + ' ' + f(pts[1]);
    for (var i = 1; i < n - 1; i++) {
      var x = pts[i * 2], y = pts[i * 2 + 1];
      var mx = (x + pts[i * 2 + 2]) / 2, my = (y + pts[i * 2 + 3]) / 2;
      d += 'Q' + f(x) + ' ' + f(y) + ' ' + f(mx) + ' ' + f(my);
    }
    d += 'L' + f(pts[(n - 1) * 2]) + ' ' + f(pts[(n - 1) * 2 + 1]);
    return d;
  }

  function strokeBounds(s) {
    var p = s.p, minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (var i = 0; i + 1 < p.length; i += 2) {
      if (p[i] < minX) minX = p[i];
      if (p[i] > maxX) maxX = p[i];
      if (p[i + 1] < minY) minY = p[i + 1];
      if (p[i + 1] > maxY) maxY = p[i + 1];
    }
    var h = (s.w || 0) / 2;
    return { x0: minX - h, y0: minY - h, x1: maxX + h, y1: maxY + h };
  }
  function itemBounds(it) { return { x0: it.x, y0: it.y, x1: it.x + it.w, y1: it.y + it.h }; }
  function unionBounds(a, b) {
    if (!a) return b; if (!b) return a;
    return { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) };
  }
  function boardBounds(board, opts) {
    var out = null;
    (board.items || []).forEach(function (it) { out = unionBounds(out, itemBounds(it)); });
    if (!(opts && opts.noInk)) (board.strokes || []).forEach(function (s) { out = unionBounds(out, strokeBounds(s)); });
    return out;
  }
  function rectsMeet(a, b) { return a.x0 <= b.x1 && a.x1 >= b.x0 && a.y0 <= b.y1 && a.y1 >= b.y0; }

  /* Does the eraser at (x, y) with reach r touch this stroke? Every
     segment is measured, not only the points: a long straight line has two
     points and a whole length between them. */
  function hitStroke(s, x, y, r) {
    var p = s.p, reach = r + (s.w || 0) / 2, r2 = reach * reach;
    var b = strokeBounds(s);
    if (x < b.x0 - r || x > b.x1 + r || y < b.y0 - r || y > b.y1 + r) return false;
    if (p.length === 2) { var dx = p[0] - x, dy = p[1] - y; return dx * dx + dy * dy <= r2; }
    for (var i = 0; i + 3 < p.length; i += 2) {
      if (segDist2(x, y, p[i], p[i + 1], p[i + 2], p[i + 3]) <= r2) return true;
    }
    return false;
  }
  /* The eraser drags: what lies between the last spot and this one is
     erased too, or a quick swipe leaves islands of ink between samples. */
  function hitStrokeAlong(s, x0, y0, x1, y1, r) {
    var len = Math.hypot(x1 - x0, y1 - y0);
    var steps = Math.max(1, Math.ceil(len / Math.max(1, r)));
    for (var i = 0; i <= steps; i++) {
      var t = i / steps;
      if (hitStroke(s, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r)) return true;
    }
    return false;
  }
  function strokeInRect(s, rect) {
    var p = s.p;
    if (!rectsMeet(strokeBounds(s), rect)) return false;
    for (var i = 0; i + 1 < p.length; i += 2) {
      if (p[i] >= rect.x0 && p[i] <= rect.x1 && p[i + 1] >= rect.y0 && p[i + 1] <= rect.y1) return true;
    }
    return false;
  }
  function moveStroke(s, dx, dy) {
    var p = new Array(s.p.length);
    for (var i = 0; i + 1 < s.p.length; i += 2) { p[i] = r1(s.p[i] + dx); p[i + 1] = r1(s.p[i + 1] + dy); }
    return Object.assign({}, s, { p: p });
  }

  /* ---- The view: board units ↔ screen pixels ----
     screen = board × z + (x, y). */
  function toWorld(v, sx, sy) { return { x: (sx - v.x) / v.z, y: (sy - v.y) / v.z }; }
  function toScreen(v, wx, wy) { return { x: wx * v.z + v.x, y: wy * v.z + v.y }; }
  /* Zoom about a screen point: the board under that point stays under it,
     the way every map and every drawing app on a phone behaves. */
  function zoomAt(v, sx, sy, factor) {
    var nz = clamp(v.z * factor, Z_MIN, Z_MAX);
    var w = toWorld(v, sx, sy);
    return { x: sx - w.x * nz, y: sy - w.y * nz, z: nz };
  }
  /* The whole board on screen, never closer than `maxZ` — a board holding
     one small note should not open at 400%. An empty board is the origin
     in the middle of the screen at 100%. */
  function fitView(bounds, vw, vh, pad, maxZ) {
    pad = pad == null ? 40 : pad;
    if (!bounds) return { x: Math.round(vw / 2), y: Math.round(vh / 3), z: 1 };
    var bw = Math.max(1, bounds.x1 - bounds.x0), bh = Math.max(1, bounds.y1 - bounds.y0);
    var z = Math.min((vw - pad * 2) / bw, (vh - pad * 2) / bh, maxZ == null ? 1 : maxZ);
    z = clamp(z, Z_MIN, Z_MAX);
    var cx = (bounds.x0 + bounds.x1) / 2, cy = (bounds.y0 + bounds.y1) / 2;
    return { x: r1(vw / 2 - cx * z), y: r1(vh / 2 - cy * z), z: Math.round(z * 1000) / 1000 };
  }

  /* ---- Where a new thing goes ----
     Somewhere free near (x, y): the first spot on a widening ring of grid
     positions that overlaps no item. A picture dropped exactly on top of
     the last one is a picture the student thinks did not arrive. */
  function freeSpot(board, x, y, w, h, gap) {
    gap = gap == null ? 24 : gap;
    var items = (board && board.items) || [];
    function clear(px, py) {
      var r = { x0: px - gap / 2, y0: py - gap / 2, x1: px + w + gap / 2, y1: py + h + gap / 2 };
      for (var i = 0; i < items.length; i++) if (rectsMeet(r, itemBounds(items[i]))) return false;
      return true;
    }
    if (clear(x, y)) return { x: r1(x), y: r1(y) };
    var stepX = Math.max(40, (w + gap) / 2), stepY = Math.max(40, (h + gap) / 2);
    for (var ring = 1; ring < 40; ring++) {
      for (var i = -ring; i <= ring; i++) {
        var cand = [[i, -ring], [ring, i], [-i, ring], [-ring, -i]];
        for (var k = 0; k < cand.length; k++) {
          var px = x + cand[k][0] * stepX, py = y + cand[k][1] * stepY;
          if (clear(px, py)) return { x: r1(px), y: r1(py) };
        }
      }
    }
    return { x: r1(x), y: r1(y) };
  }
  /* Where a batch sent from elsewhere lands: to the RIGHT of everything
     already on the board, top-aligned with it, so a board that is opened
     afterwards shows what was there and what is new side by side. */
  function placeBatch(board, sizes, opts) {
    opts = opts || {};
    var gap = opts.gap == null ? 40 : opts.gap;
    var cols = Math.max(1, opts.cols || 2);
    var b = boardBounds(board, { noInk: false });
    var x0 = opts.x != null ? opts.x : (b ? b.x1 + 80 : 0);
    var y0 = opts.y != null ? opts.y : (b ? b.y0 : 0);
    var out = [], colW = [], rowH = [];
    sizes.forEach(function (s, i) {
      var c = i % cols, r = Math.floor(i / cols);
      colW[c] = Math.max(colW[c] || 0, s.w);
      rowH[r] = Math.max(rowH[r] || 0, s.h);
    });
    sizes.forEach(function (s, i) {
      var c = i % cols, r = Math.floor(i / cols);
      var x = x0, y = y0;
      for (var k = 0; k < c; k++) x += colW[k] + gap;
      for (var j = 0; j < r; j++) y += rowH[j] + gap;
      out.push({ x: r1(x), y: r1(y) });
    });
    return out;
  }
  /* A picture's size on the board: its own pixels, no wider than
     IMG_MAX_W at 100%, and no smaller than something you can see. */
  function fitImageSize(nw, nh, maxW) {
    nw = Math.max(1, num(nw, 320)); nh = Math.max(1, num(nh, 240));
    maxW = maxW || IMG_MAX_W;
    var k = Math.min(1, maxW / nw);
    var w = Math.max(60, nw * k), h = Math.max(40, nh * (w / nw));
    return { w: r1(w), h: r1(h) };
  }

  /* ---- Undo ---- */
  function snapshot(board) {
    return {
      items: board.items.map(function (it) { return Object.assign({}, it); }),
      strokes: board.strokes.map(function (s) { return Object.assign({}, s); })
    };
  }
  function History(max) { this.max = max || HISTORY_MAX; this.undos = []; this.redos = []; }
  History.prototype.push = function (snap) {
    this.undos.push(snap);
    if (this.undos.length > this.max) this.undos.shift();
    this.redos = [];
  };
  History.prototype.undo = function (current) {
    if (!this.undos.length) return null;
    this.redos.push(current);
    return this.undos.pop();
  };
  History.prototype.redo = function (current) {
    if (!this.redos.length) return null;
    this.undos.push(current);
    return this.redos.pop();
  };
  History.prototype.clear = function () { this.undos = []; this.redos = []; };
  History.prototype.canUndo = function () { return this.undos.length > 0; };
  History.prototype.canRedo = function () { return this.redos.length > 0; };

  /* Words wrapped to a width, for the exported picture. `measure` is the
     canvas's measureText width, passed in so this stays pure. */
  function wrapLines(text, maxW, measure, maxLines) {
    var out = [];
    String(text == null ? '' : text).split('\n').forEach(function (para) {
      var words = para.split(/\s+/).filter(Boolean);
      if (!words.length) { out.push(''); return; }
      var line = '';
      words.forEach(function (w) {
        var tryLine = line ? line + ' ' + w : w;
        if (measure(tryLine) <= maxW || !line) line = tryLine;
        else { out.push(line); line = w; }
      });
      if (line) out.push(line);
    });
    if (maxLines && out.length > maxLines) { out = out.slice(0, maxLines); out[maxLines - 1] += ' …'; }
    return out;
  }

  /* The date as a board's default title says it: "Whiteboard · 13 Nov". */
  function defaultTitle(now) {
    var d = new Date(num(now, Date.now()));
    var m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
    return 'Whiteboard · ' + d.getDate() + ' ' + m;
  }

  /* ---- The list of boards (index.json beside them) ----
     One small file says which boards there are, so the list opens without
     reading every board. It is a CONVENIENCE: a board's own file is the
     truth, and an entry that disagrees with it is put right the next time
     that board is saved. */
  var INDEX_MAX = 200;
  function indexEntry(board, extra) {
    extra = extra || {};
    var s = summary(board);
    var e = {
      id: cleanId(board.id), title: cleanText(board.title, TITLE_MAX).trim() || 'My whiteboard',
      created: Math.round(num(board.created, 0)), updated: Math.round(num(board.updated, 0)),
      n: s.items, q: s.questions, d: s.done, p: s.pictures, s: s.strokes
    };
    var who = cleanText(board.who, 60).trim();
    if (who) e.who = who;
    var th = cleanPath(extra.thumb);
    if (th) { e.thumb = th; e.thumbAt = Math.round(num(extra.thumbAt, e.updated)); }
    return e.id ? e : null;
  }
  function cleanIndexEntry(e) {
    if (!e || typeof e !== 'object' || !cleanId(e.id)) return null;
    var out = {
      id: cleanId(e.id), title: cleanText(e.title, TITLE_MAX).replace(/\s+/g, ' ').trim() || 'My whiteboard',
      created: Math.round(num(e.created, 0)), updated: Math.round(num(e.updated, 0)),
      n: Math.max(0, Math.round(num(e.n, 0))), q: Math.max(0, Math.round(num(e.q, 0))),
      d: Math.max(0, Math.round(num(e.d, 0))), p: Math.max(0, Math.round(num(e.p, 0))),
      s: Math.max(0, Math.round(num(e.s, 0)))
    };
    var who = cleanText(e.who, 60).trim();
    if (who) out.who = who;
    var th = cleanPath(e.thumb);
    if (th) { out.thumb = th; out.thumbAt = Math.round(num(e.thumbAt, out.updated)); }
    return out;
  }
  function cleanIndex(raw) {
    var list = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.boards) ? raw.boards : []);
    var byId = {};
    list.forEach(function (e) {
      var c = cleanIndexEntry(e);
      if (!c) return;
      if (!byId[c.id] || byId[c.id].updated < c.updated) byId[c.id] = c;
    });
    return Object.keys(byId).map(function (k) { return byId[k]; })
      .sort(function (a, b) { return b.updated - a.updated; }).slice(0, INDEX_MAX);
  }
  /* A thumbnail kept from before survives a save that did not make a new
     one — a board saved twice in ten seconds keeps its picture. */
  function indexUpsert(list, entry) {
    var c = cleanIndexEntry(entry);
    if (!c) return cleanIndex(list);
    var old = (list || []).filter(function (e) { return e && e.id === c.id; })[0];
    if (old && !c.thumb && old.thumb) { c.thumb = old.thumb; c.thumbAt = old.thumbAt; }
    return cleanIndex((list || []).filter(function (e) { return e && e.id !== c.id; }).concat([c]));
  }
  function indexRemove(list, id) {
    return cleanIndex((list || []).filter(function (e) { return e && e.id !== id; }));
  }

  var pure = {
    VERSION: VERSION, PALETTE: PALETTE, HL_PALETTE: HL_PALETTE, NOTE_COLORS: NOTE_COLORS,
    SIZES: SIZES, HL_SIZES: HL_SIZES, Z_MIN: Z_MIN, Z_MAX: Z_MAX, ITEMS_MAX: ITEMS_MAX,
    STROKES_MAX: STROKES_MAX, PTS_MAX: PTS_MAX, HISTORY_MAX: HISTORY_MAX, TOOLS: TOOLS,
    Q_W: Q_W, Q_H: Q_H, NOTE_W: NOTE_W, NOTE_H: NOTE_H, IMG_MAX_W: IMG_MAX_W,
    newId: newId, cleanId: cleanId, cleanPath: cleanPath, cleanSrc: cleanSrc, cleanText: cleanText,
    cleanView: cleanView, cleanStroke: cleanStroke, cleanItem: cleanItem, cleanBoard: cleanBoard,
    newBoard: newBoard, forSave: forSave, summary: summary, byteSize: byteSize,
    simplify: simplify, strokePath: strokePath, strokeBounds: strokeBounds, itemBounds: itemBounds,
    boardBounds: boardBounds, unionBounds: unionBounds, rectsMeet: rectsMeet,
    hitStroke: hitStroke, hitStrokeAlong: hitStrokeAlong, strokeInRect: strokeInRect, moveStroke: moveStroke,
    toWorld: toWorld, toScreen: toScreen, zoomAt: zoomAt, fitView: fitView,
    freeSpot: freeSpot, placeBatch: placeBatch, fitImageSize: fitImageSize,
    snapshot: snapshot, History: History, wrapLines: wrapLines, defaultTitle: defaultTitle,
    indexEntry: indexEntry, cleanIndex: cleanIndex, indexUpsert: indexUpsert, indexRemove: indexRemove, INDEX_MAX: INDEX_MAX
  };

  /* ==================================================================
     THE BOARD ON SCREEN
     ================================================================== */

  var SVGNS = 'http://www.w3.org/2000/svg';

  function h(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function btn(label, title, cls) {
    var b = h('button', 'wbBtn' + (cls ? ' ' + cls : ''));
    b.type = 'button';
    b.innerHTML = '';
    /* "🖼️ Picture" is drawn as the picture and the word, so a phone can
       keep the picture and drop the word (whiteboard.css) and every tool
       still fits across the screen. */
    var m = /^(\S+)\s+(.+)$/.exec(String(label || ''));
    if (m && !/[A-Za-z0-9]/.test(m[1])) {
      b.appendChild(h('span', 'wbIco', m[1]));
      b.appendChild(h('span', 'wbWord', ' ' + m[2]));
    } else b.textContent = label;
    if (title) { b.title = title; b.setAttribute('aria-label', title); }
    return b;
  }
  function typingIn(t) {
    if (!t || !t.closest) return false;
    return !!t.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]');
  }

  /* create(host, opts) — mounts a board into `host` and returns the
     instance. `opts`:
       imageUrl(path)           → Promise of a URL for a stored picture
       renderQuestion(item, el) → true when the host drew the question in el
       checkAnswer(item, text)  → true / false / null (null: no key to check by)
       canPractise(item)        → whether ▶ Practise is offered on a card
       onAction(kind, item)     → 'practise' | 'done' | 'undone' | 'checked'
       onChange(reason)         → the board changed (save it)
       onView()                 → the view moved (no save needed)
       toast(msg)               → a short message
       extraTools: [{ label, title, onClick }] — host buttons on the bar
       pickFile()               → optional; the host's own picture picker
  */
  function create(host, opts) {
    opts = opts || {};
    var doc = host.ownerDocument || document;
    var win = doc.defaultView || window;

    var board = newBoard('');
    var hist = new History(HISTORY_MAX);
    var tool = 'pen';
    var penColor = PALETTE[0], hlColor = HL_PALETTE[0], noteColor = NOTE_COLORS[0];
    var sizeIx = 1;
    var inkOn = true;
    var clean = false;
    var sel = { items: {}, strokes: {} };
    var editing = null;         // id of the note being typed in
    var urlCache = {};          // storage path → URL
    var nodes = {};             // item id → DOM node
    var paths = {};             // stroke id → <path>
    var destroyed = false;
    var penSeen = false;
    var spaceDown = false;
    var lastTap = null;

    host.classList.add('wbHost');
    host.innerHTML = '';

    /* ---- The bar ---- */
    var bar = h('div', 'wbBar');
    bar.setAttribute('role', 'toolbar');
    bar.setAttribute('aria-label', 'Whiteboard tools');
    var toolBtns = {};
    var TOOL_INFO = {
      hand:   ['✋', 'Move around the board (hold Space, or drag with two fingers)'],
      select: ['🖱️', 'Select, move, resize and delete (V)'],
      pen:    ['✏️', 'Pen (P)'],
      hl:     ['🖍️', 'Highlighter (H)'],
      eraser: ['🧽', 'Eraser — drag across ink to rub it out (E)'],
      note:   ['📝', 'Sticky note — tap where it goes (N)']
    };
    var gTools = h('div', 'wbGroup');
    TOOLS.forEach(function (t) {
      var b = btn(TOOL_INFO[t][0], TOOL_INFO[t][1], 'wbTool');
      b.setAttribute('data-wb-tool', t);
      b.addEventListener('click', function () { setTool(t); });
      toolBtns[t] = b;
      gTools.appendChild(b);
    });
    bar.appendChild(gTools);

    var gColors = h('div', 'wbGroup wbColors');
    bar.appendChild(gColors);
    var gSizes = h('div', 'wbGroup wbSizes');
    bar.appendChild(gSizes);

    var gEdit = h('div', 'wbGroup');
    var undoBtn = btn('↶', 'Undo (Ctrl+Z)');
    var redoBtn = btn('↷', 'Redo (Ctrl+Shift+Z)');
    undoBtn.addEventListener('click', function () { undo(); });
    redoBtn.addEventListener('click', function () { redo(); });
    gEdit.appendChild(undoBtn); gEdit.appendChild(redoBtn);
    bar.appendChild(gEdit);

    var gAdd = h('div', 'wbGroup');
    var picBtn = btn('🖼️ Picture', 'Put a picture on the board (or paste one with Ctrl+V)', 'wbWide');
    var fileIn = h('input');
    fileIn.type = 'file'; fileIn.accept = 'image/*'; fileIn.multiple = true; fileIn.hidden = true;
    picBtn.addEventListener('click', function () {
      if (typeof opts.pickFile === 'function') opts.pickFile(); else fileIn.click();
    });
    fileIn.addEventListener('change', function () {
      var files = Array.prototype.slice.call(fileIn.files || []);
      fileIn.value = '';
      addFiles(files);
    });
    var qBtn = btn('❓ Question', 'Write a question to try again', 'wbWide');
    qBtn.addEventListener('click', function () { addTypedQuestion(); });
    gAdd.appendChild(picBtn); gAdd.appendChild(fileIn); gAdd.appendChild(qBtn);
    (opts.extraTools || []).forEach(function (x) {
      var b = btn(x.label, x.title || x.label, 'wbWide');
      if (x.id) b.id = x.id;
      b.addEventListener('click', function () { x.onClick(api); });
      gAdd.appendChild(b);
    });
    bar.appendChild(gAdd);

    var gView = h('div', 'wbGroup');
    var inkBtn = btn('👁️ Workings', 'Show or hide everything written with the pen — for a clean screenshot', 'wbWide wbInkBtn');
    inkBtn.setAttribute('aria-pressed', 'true');
    inkBtn.addEventListener('click', function () { setInkVisible(!inkOn); });
    var zOut = btn('−', 'Zoom out');
    var zLab = h('span', 'wbZoom', '100%');
    var zIn = btn('+', 'Zoom in');
    var fitBtn = btn('⤢', 'Show the whole board');
    zOut.addEventListener('click', function () { zoomBy(1 / 1.25); });
    zIn.addEventListener('click', function () { zoomBy(1.25); });
    fitBtn.addEventListener('click', function () { fit(); });
    var cleanBtn = btn('📷 Clean view', 'Hide the toolbar and grid for a screenshot', 'wbWide');
    cleanBtn.addEventListener('click', function () { setClean(true); });
    var exportBtn = btn('⬇️ Save picture', 'Save the board (or what is selected) as a picture', 'wbWide');
    exportBtn.addEventListener('click', function () { downloadPicture(); });
    [inkBtn, zOut, zLab, zIn, fitBtn, cleanBtn, exportBtn].forEach(function (n) { gView.appendChild(n); });
    bar.appendChild(gView);
    host.appendChild(bar);

    /* ---- The stage ---- */
    var stage = h('div', 'wbStage');
    stage.tabIndex = 0;
    stage.setAttribute('role', 'application');
    stage.setAttribute('aria-label', 'Whiteboard — draw, drag pictures and questions, pinch or scroll to move around');
    var world = h('div', 'wbWorld');
    var itemsLayer = h('div', 'wbItems');
    var ink = doc.createElementNS(SVGNS, 'svg');
    ink.setAttribute('class', 'wbInk');
    ink.setAttribute('width', '1');
    ink.setAttribute('height', '1');
    var inkG = doc.createElementNS(SVGNS, 'g');
    var live = doc.createElementNS(SVGNS, 'path');
    live.setAttribute('class', 'wbLive');
    live.setAttribute('fill', 'none');
    live.setAttribute('stroke-linecap', 'round');
    live.setAttribute('stroke-linejoin', 'round');
    ink.appendChild(inkG);
    ink.appendChild(live);
    world.appendChild(itemsLayer);
    world.appendChild(ink);
    stage.appendChild(world);
    var selBox = h('div', 'wbSelBox');
    selBox.hidden = true;
    var handle = h('div', 'wbHandle');
    handle.title = 'Drag to resize';
    selBox.appendChild(handle);
    stage.appendChild(selBox);
    var selBar = h('div', 'wbSelBar');
    selBar.hidden = true;
    var delBtn = btn('🗑️', 'Delete what is selected (Delete)');
    var dupBtn = btn('⧉', 'Duplicate');
    var frontBtn = btn('⬆︎', 'Bring to the front');
    var selPicBtn = btn('⬇️', 'Save what is selected as a picture');
    delBtn.addEventListener('click', function () { removeSelected(); });
    dupBtn.addEventListener('click', function () { duplicateSelected(); });
    frontBtn.addEventListener('click', function () { bringToFront(); });
    selPicBtn.addEventListener('click', function () { downloadPicture(true); });
    [dupBtn, frontBtn, selPicBtn, delBtn].forEach(function (n) { selBar.appendChild(n); });
    stage.appendChild(selBar);
    var marquee = h('div', 'wbMarquee');
    marquee.hidden = true;
    stage.appendChild(marquee);
    var hint = h('div', 'wbEmpty');
    hint.innerHTML = '';
    hint.appendChild(h('b', '', 'Your whiteboard goes on for ever.'));
    hint.appendChild(h('span', '', 'Write with the pen, add pictures, notes and questions to try again. Pinch, scroll or use ✋ to move around.'));
    stage.appendChild(hint);
    host.appendChild(stage);
    var exitClean = btn('✕ Exit clean view', 'Show the toolbar again', 'wbExitClean');
    exitClean.addEventListener('click', function () { setClean(false); });
    host.appendChild(exitClean);

    /* ---- The colours and sizes follow the tool in hand ---- */
    function renderSwatches() {
      gColors.innerHTML = '';
      gSizes.innerHTML = '';
      var list = tool === 'hl' ? HL_PALETTE : tool === 'note' ? NOTE_COLORS : PALETTE;
      var cur = tool === 'hl' ? hlColor : tool === 'note' ? noteColor : penColor;
      var showColors = tool === 'pen' || tool === 'hl' || tool === 'note';
      gColors.hidden = !showColors;
      if (showColors) list.forEach(function (c) {
        var s = btn('', 'Colour ' + c, 'wbSwatch' + (c === cur ? ' on' : ''));
        s.style.setProperty('--sw', c);
        s.setAttribute('aria-pressed', c === cur ? 'true' : 'false');
        s.addEventListener('click', function () {
          if (tool === 'hl') hlColor = c; else if (tool === 'note') noteColor = c; else penColor = c;
          renderSwatches();
        });
        gColors.appendChild(s);
      });
      var showSizes = tool === 'pen' || tool === 'hl';
      gSizes.hidden = !showSizes;
      if (showSizes) ['S', 'M', 'L'].forEach(function (lab, i) {
        var b = btn('', 'Size ' + lab, 'wbSize' + (i === sizeIx ? ' on' : ''));
        var dot = h('span', 'wbDot');
        dot.style.width = dot.style.height = (4 + i * 4) + 'px';
        b.appendChild(dot);
        b.setAttribute('aria-pressed', i === sizeIx ? 'true' : 'false');
        b.addEventListener('click', function () { sizeIx = i; renderSwatches(); });
        gSizes.appendChild(b);
      });
    }

    function setTool(t) {
      if (TOOLS.indexOf(t) < 0) return;
      if (editing) finishEdit();
      tool = t;
      Object.keys(toolBtns).forEach(function (k) {
        toolBtns[k].classList.toggle('on', k === t);
        toolBtns[k].setAttribute('aria-pressed', k === t ? 'true' : 'false');
      });
      stage.setAttribute('data-tool', t);
      if (t !== 'select') clearSelection();
      renderSwatches();
    }

    function setInkVisible(on) {
      inkOn = !!on;
      host.classList.toggle('wbInkOff', !inkOn);
      inkBtn.setAttribute('aria-pressed', inkOn ? 'true' : 'false');
      inkBtn.querySelector('.wbIco').textContent = inkOn ? '👁️' : '🙈';
      inkBtn.querySelector('.wbWord').textContent = inkOn ? ' Workings' : ' Workings off';
      inkBtn.classList.toggle('on', !inkOn);
      // A hidden stroke cannot be selected, moved or rubbed out by mistake.
      if (!inkOn) { sel.strokes = {}; renderSelection(); }
    }
    function setClean(on) {
      clean = !!on;
      host.classList.toggle('wbClean', clean);
      if (clean) clearSelection();
      if (!clean) try { stage.focus({ preventScroll: true }); } catch (e) {}
    }

    /* ---- The view ---- */
    function stageSize() {
      var r = stage.getBoundingClientRect();
      return { w: r.width || stage.clientWidth || 800, h: r.height || stage.clientHeight || 600, left: r.left, top: r.top };
    }
    function applyView() {
      var v = board.view;
      world.style.transform = 'translate(' + v.x + 'px,' + v.y + 'px) scale(' + v.z + ')';
      var g = GRID * v.z;
      // Below 40% the dots would be a grey fog; they fade out instead.
      stage.style.backgroundSize = g + 'px ' + g + 'px';
      stage.style.backgroundPosition = v.x + 'px ' + v.y + 'px';
      stage.classList.toggle('wbFarOut', v.z < 0.4);
      zLab.textContent = Math.round(v.z * 100) + '%';
      renderSelection();
    }
    var viewTimer = null;
    function viewChanged() {
      applyView();
      if (typeof opts.onView === 'function') {
        clearTimeout(viewTimer);
        viewTimer = setTimeout(function () { if (!destroyed) opts.onView(); }, 600);
      }
    }
    function zoomBy(f, sx, sy) {
      var s = stageSize();
      board.view = zoomAt(board.view, sx == null ? s.w / 2 : sx, sy == null ? s.h / 2 : sy, f);
      viewChanged();
    }
    function fit(rect) {
      var s = stageSize();
      board.view = fitView(rect || boardBounds(board, { noInk: !inkOn }), s.w, s.h, 48, 1);
      viewChanged();
    }
    function centreWorld() {
      var s = stageSize();
      return toWorld(board.view, s.w / 2, s.h / 2);
    }

    /* ---- Drawing the board ---- */
    function itemNode(it) {
      var n = h('div', 'wbItem wb_' + it.t);
      n.setAttribute('data-id', it.id);
      if (it.t === 'img') {
        var im = h('img', 'wbPic');
        im.alt = it.cap || 'A picture on the whiteboard';
        im.draggable = false;
        n.appendChild(im);
        if (it.cap) n.appendChild(h('div', 'wbCap', it.cap));
      } else if (it.t === 'note') {
        var tx = h('div', 'wbNoteText');
        n.appendChild(tx);
      }
      // A question card is built by `updateNode`, the one place it is drawn.
      return n;
    }
    function picSrcOf(it, img) {
      if (it.src) { img.src = it.src; return; }
      if (!it.path) return;
      if (urlCache[it.path]) { img.src = urlCache[it.path]; return; }
      if (typeof opts.imageUrl !== 'function') return;
      var want = it.path;
      Promise.resolve(opts.imageUrl(want)).then(function (u) {
        if (!u || destroyed) return;
        urlCache[want] = u;
        if (img.isConnected) img.src = u;
      }).catch(function () {});
    }
    function updateNode(n, it) {
      n.style.left = it.x + 'px';
      n.style.top = it.y + 'px';
      n.style.width = it.w + 'px';
      if (it.t === 'img') {
        n.style.height = it.h + 'px';
        var im = n.querySelector('img.wbPic');
        if (n._item !== it || !im.getAttribute('src')) picSrcOf(it, im);
        var cap = n.querySelector('.wbCap');
        if (it.cap && !cap) { cap = h('div', 'wbCap'); n.appendChild(cap); }
        if (cap) cap.textContent = it.cap || '';
      } else if (it.t === 'note') {
        n.style.minHeight = NOTE_H + 'px';
        n.style.background = it.color;
        var tx = n.querySelector('.wbNoteText');
        tx.style.fontSize = it.fs + 'px';
        if (editing !== it.id && tx.textContent !== it.text) tx.textContent = it.text;
        n.classList.toggle('wbNoteEmpty', !it.text.trim() && editing !== it.id);
      } else if (n._item !== it) {
        n.innerHTML = '';
        buildQuestion(n, it);
      }
      n._item = it;
    }

    /* A QUESTION TO TRY AGAIN. The card is the question, a dashed space
       to try it in with the pen (the board's ink goes over it), a box to
       type an answer into when there is a key to check it by, the answer
       behind a button, and "I can do this now". */
    function buildQuestion(n, it) {
      n.classList.toggle('wbQDone', !!it.done);
      var head = h('div', 'wbQHead');
      head.appendChild(h('span', 'wbQTag', it.done ? '✅ Got it' : '❓ Try again'));
      var bits = [];
      if (it.num) bits.push('Q' + it.num);
      if (it.doc) bits.push(it.doc);
      if (bits.length) head.appendChild(h('span', 'wbQFrom', bits.join(' · ')));
      n.appendChild(head);
      var body = h('div', 'wbQBody');
      var drew = false;
      if (typeof opts.renderQuestion === 'function') {
        try { drew = !!opts.renderQuestion(it, body); } catch (e) { drew = false; body.innerHTML = ''; }
      }
      if (!drew) {
        if (it.src || it.path) {
          var im = h('img', 'wbQPic');
          im.alt = 'The question';
          im.draggable = false;
          picSrcOf(it, im);
          body.appendChild(im);
        }
        if (it.text && it.text.trim()) body.appendChild(h('div', 'wbQText', it.text));
      }
      n.appendChild(body);
      var tryZone = h('div', 'wbQTry');
      tryZone.appendChild(h('span', '', '✍️ Try it here — write with the pen'));
      n.appendChild(tryZone);

      var foot = h('div', 'wbQFoot');
      if (it.answer && typeof opts.checkAnswer === 'function') {
        var row = h('div', 'wbQType');
        var inp = h('input', 'wbQInput');
        inp.type = 'text';
        inp.placeholder = 'Type your answer';
        inp.value = it.tried || '';
        inp.setAttribute('aria-label', 'Your answer');
        var chk = btn('✓ Check', 'Check your answer');
        var verdict = h('span', 'wbQVerdict');
        if (it.verdict === 'right') { verdict.textContent = '✅ Right!'; verdict.className = 'wbQVerdict right'; }
        else if (it.verdict === 'wrong') { verdict.textContent = '✗ Not yet — try again'; verdict.className = 'wbQVerdict wrong'; }
        function check() {
          var v = inp.value.trim();
          if (!v) { inp.focus(); return; }
          var ok = opts.checkAnswer(it, v);
          if (ok == null) { toast('There is no answer to check this one against — use 👁 Answer.'); return; }
          updateItem(it.id, { tried: v, verdict: ok ? 'right' : 'wrong' }, 'check');
          if (typeof opts.onAction === 'function') opts.onAction('checked', Object.assign({}, it, { tried: v, verdict: ok ? 'right' : 'wrong' }));
        }
        chk.addEventListener('click', check);
        inp.addEventListener('keydown', function (e) {
          e.stopPropagation();
          if (e.key === 'Enter') { e.preventDefault(); check(); }
        });
        row.appendChild(inp); row.appendChild(chk); row.appendChild(verdict);
        n.appendChild(row);
      }
      if (it.answer || it.why) {
        var ansBtn = btn(it.shown ? '🙈 Hide answer' : '👁️ Answer', it.shown ? 'Hide the answer' : 'Show the answer');
        ansBtn.addEventListener('click', function () { updateItem(it.id, { shown: !it.shown }, 'answer'); });
        foot.appendChild(ansBtn);
      }
      var doneBtn = btn(it.done ? '↩︎ Still to redo' : '✓ I can do this now',
        it.done ? 'Put it back as one to try again' : 'Tick it off — you can do this one now');
      doneBtn.addEventListener('click', function () {
        var now = !it.done;
        updateItem(it.id, { done: now }, 'done');
        if (typeof opts.onAction === 'function') opts.onAction(now ? 'done' : 'undone', it);
      });
      foot.appendChild(doneBtn);
      if (typeof opts.canPractise === 'function' && opts.canPractise(it)) {
        var pr = btn('▶ Practise', 'Practise it with Chung GPT marking your answer');
        pr.addEventListener('click', function () { if (typeof opts.onAction === 'function') opts.onAction('practise', it); });
        foot.appendChild(pr);
      }
      n.appendChild(foot);
      if (it.shown && (it.answer || it.why)) {
        var ab = h('div', 'wbQAns');
        if (it.answer) { ab.appendChild(h('b', '', 'The answer')); ab.appendChild(h('div', '', it.answer)); }
        if (it.why) { ab.appendChild(h('b', '', it.answer ? 'Why' : 'Where to start')); ab.appendChild(h('div', '', it.why)); }
        n.appendChild(ab);
      }
    }

    function renderItems() {
      var keep = {};
      board.items.forEach(function (it, i) {
        keep[it.id] = 1;
        var n = nodes[it.id];
        if (!n) { n = nodes[it.id] = itemNode(it); }
        if (n._item !== it) updateNode(n, it);
        if (itemsLayer.children[i] !== n) itemsLayer.insertBefore(n, itemsLayer.children[i] || null);
      });
      Object.keys(nodes).forEach(function (id) {
        if (!keep[id]) { var n = nodes[id]; if (n.parentNode) n.parentNode.removeChild(n); delete nodes[id]; }
      });
      measureHeights();
      hint.hidden = board.items.length > 0 || board.strokes.length > 0;
    }
    /* Notes and question cards grow with what is in them, so their height
       is READ back off the page: the selection box, the fit and the next
       free spot all need to know where the card really ends. It is a
       derived number, never an undo step. */
    function measureHeights() {
      board.items.forEach(function (it) {
        if (it.t === 'img') return;
        var n = nodes[it.id];
        if (!n || !n.isConnected) return;
        var hh = n.offsetHeight;
        if (hh && Math.abs(hh - it.h) > 1) it.h = r1(hh);
      });
    }
    function strokeStyle(p, s) {
      p.setAttribute('stroke', s.c);
      p.setAttribute('stroke-width', s.w);
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke-linecap', s.hl ? 'butt' : 'round');
      p.setAttribute('stroke-linejoin', 'round');
      p.setAttribute('class', s.hl ? 'wbHl' : 'wbPen');
    }
    function renderStrokes() {
      var keep = {};
      board.strokes.forEach(function (s, i) {
        keep[s.id] = 1;
        var p = paths[s.id];
        if (!p) {
          p = paths[s.id] = doc.createElementNS(SVGNS, 'path');
          p.setAttribute('data-id', s.id);
        }
        if (p._s !== s) {
          strokeStyle(p, s);
          p.setAttribute('d', strokePath(s.p));
          p._s = s;
        }
        if (inkG.childNodes[i] !== p) inkG.insertBefore(p, inkG.childNodes[i] || null);
      });
      Object.keys(paths).forEach(function (id) {
        if (!keep[id]) { var p = paths[id]; if (p.parentNode) p.parentNode.removeChild(p); delete paths[id]; }
      });
    }
    function renderAll() {
      renderItems();
      renderStrokes();
      applyView();
      undoBtn.disabled = !hist.canUndo();
      redoBtn.disabled = !hist.canRedo();
    }

    /* ---- Changes ---- */
    var dirty = false;
    function changed(reason) {
      dirty = true;
      board.updated = Date.now();
      renderAll();
      if (typeof opts.onChange === 'function') opts.onChange(reason || 'edit');
    }
    function record() { hist.push(snapshot(board)); }
    function restore(snap) {
      board.items = snap.items;
      board.strokes = snap.strokes;
      clearSelection();
      changed('undo');
    }
    function undo() {
      if (editing) finishEdit();
      var s = hist.undo(snapshot(board));
      if (s) restore(s);
    }
    function redo() {
      var s = hist.redo(snapshot(board));
      if (s) restore(s);
    }
    function findItem(id) {
      for (var i = 0; i < board.items.length; i++) if (board.items[i].id === id) return i;
      return -1;
    }
    /* Every change to an item REPLACES the object, so a snapshot taken
       before it still holds the old one. */
    function updateItem(id, patch, reason, noHistory) {
      var i = findItem(id);
      if (i < 0) return null;
      if (!noHistory) record();
      var next = cleanItem(Object.assign({}, board.items[i], patch), { allowBlob: true });
      if (!next) return null;
      next.id = id;
      board.items = board.items.slice();
      board.items[i] = next;
      changed(reason || 'edit');
      return next;
    }
    function addItem(raw, opts2) {
      opts2 = opts2 || {};
      if (board.items.length >= ITEMS_MAX) { toast('This board is full — start a new one for more.'); return null; }
      var it = cleanItem(raw, { allowBlob: true });
      if (!it) return null;
      if (findItem(it.id) >= 0) it.id = newId(it.t);
      if (!opts2.noHistory) record();
      if (raw.x == null || raw.y == null || opts2.free) {
        var c = raw.x == null || raw.y == null ? centreWorld() : { x: it.x + it.w / 2, y: it.y + it.h / 2 };
        var spot = freeSpot(board, c.x - it.w / 2, c.y - it.h / 2, it.w, it.h);
        it.x = spot.x; it.y = spot.y;
      }
      board.items = board.items.concat([it]);
      if (!opts2.quiet) changed(opts2.reason || 'add');
      return it;
    }
    function toast(m) { if (typeof opts.toast === 'function') opts.toast(m); }

    /* ---- Adding things ---- */
    function addImage(src, o) {
      o = o || {};
      return new Promise(function (resolve) {
        var im = new Image();
        im.onload = function () {
          var size = fitImageSize(im.naturalWidth, im.naturalHeight, o.maxW || IMG_MAX_W / Math.max(0.5, Math.min(2, board.view.z)));
          var it = addItem({ t: 'img', src: src, path: o.path, cap: o.cap, from: o.from, w: size.w, h: size.h,
            x: o.x, y: o.y }, { reason: 'picture', free: o.free });
          if (it && o.select !== false) { setTool('select'); selectOnly(it.id); }
          resolve(it);
        };
        im.onerror = function () { toast('That picture could not be opened.'); resolve(null); };
        im.src = src;
      });
    }
    function addFiles(files) {
      var pics = files.filter(function (f) { return /^image\//.test(f.type); });
      if (!pics.length) { if (files.length) toast('Only pictures can go on the board.'); return; }
      pics.slice(0, 10).forEach(function (f) {
        var read = typeof opts.readImage === 'function' ? Promise.resolve(opts.readImage(f)) : readAsDataUrl(f);
        read.then(function (src) { if (src) addImage(src, { cap: '' }); });
      });
    }
    function readAsDataUrl(f) {
      return new Promise(function (resolve) {
        var r = new FileReader();
        r.onload = function () { resolve(String(r.result || '')); };
        r.onerror = function () { resolve(''); };
        r.readAsDataURL(f);
      });
    }
    function addNote(text, at) {
      var c = at || centreWorld();
      var it = addItem({ t: 'note', text: text || '', color: noteColor, x: c.x - NOTE_W / 2, y: c.y - NOTE_H / 2,
        w: NOTE_W, h: NOTE_H }, { reason: 'note', free: !at });
      return it;
    }
    function addQuestion(q, o) {
      o = o || {};
      var raw = Object.assign({ t: 'q', w: Q_W, h: Q_H }, q);
      var it = addItem(raw, { reason: 'question', free: raw.x == null, noHistory: o.noHistory, quiet: o.quiet });
      return it;
    }
    /* Several questions at once go in a tidy grid to the right of what is
       there, one undo step for the lot, and the view goes to them. */
    function addQuestions(list) {
      list = (list || []).filter(Boolean);
      if (!list.length) return [];
      record();
      var spots = placeBatch(board, list.map(function () { return { w: Q_W, h: Q_H + 60 }; }), { cols: 2 });
      var out = [];
      list.forEach(function (q, i) {
        var it = addQuestion(Object.assign({}, q, { x: spots[i].x, y: spots[i].y }), { noHistory: true, quiet: true });
        if (it) out.push(it);
      });
      changed('questions');
      if (out.length) {
        var b = null;
        out.forEach(function (it) { b = unionBounds(b, itemBounds(it)); });
        fit({ x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 + 200 });
      }
      return out;
    }
    function addTypedQuestion() {
      var text = win.prompt ? win.prompt('Write the question you want to try again:') : '';
      if (!text || !text.trim()) return;
      var it = addQuestion({ text: text.trim() });
      if (it) { setTool('select'); selectOnly(it.id); }
    }

    /* ---- Notes: typing ---- */
    function beginEdit(id) {
      var i = findItem(id);
      if (i < 0 || board.items[i].t !== 'note') return;
      if (editing && editing !== id) finishEdit();
      editing = id;
      var n = nodes[id];
      if (!n) return;
      var tx = n.querySelector('.wbNoteText');
      n.classList.add('wbEditing');
      n.classList.remove('wbNoteEmpty');
      tx.contentEditable = 'true';
      tx.setAttribute('role', 'textbox');
      tx.setAttribute('aria-multiline', 'true');
      tx.setAttribute('aria-label', 'Note');
      try { tx.focus({ preventScroll: true }); } catch (e) { tx.focus(); }
      var range = doc.createRange();
      range.selectNodeContents(tx);
      range.collapse(false);
      var s = win.getSelection && win.getSelection();
      if (s) { s.removeAllRanges(); s.addRange(range); }
      tx.onblur = function () { if (editing === id) finishEdit(); };
      tx.onkeydown = function (e) {
        e.stopPropagation();
        if (e.key === 'Escape') { e.preventDefault(); tx.blur(); }
      };
      tx.oninput = function () { measureHeights(); renderSelection(); };
    }
    function finishEdit() {
      var id = editing;
      editing = null;
      var n = nodes[id];
      var i = findItem(id);
      if (!n || i < 0) return;
      var tx = n.querySelector('.wbNoteText');
      tx.contentEditable = 'false';
      tx.onblur = tx.onkeydown = tx.oninput = null;
      n.classList.remove('wbEditing');
      var text = cleanText(tx.innerText != null ? tx.innerText : tx.textContent, TEXT_MAX).replace(/\n$/, '');
      var it = board.items[i];
      if (!text.trim()) {
        // An empty note is a yellow square saying nothing; it goes.
        record();
        board.items = board.items.filter(function (x) { return x.id !== id; });
        changed('note');
        return;
      }
      if (text !== it.text) updateItem(id, { text: text }, 'note');
      else renderItems();
    }

    /* ---- Selection ---- */
    function selCount() { return Object.keys(sel.items).length + Object.keys(sel.strokes).length; }
    function clearSelection() { sel = { items: {}, strokes: {} }; renderSelection(); }
    function selectOnly(id) { sel = { items: {}, strokes: {} }; sel.items[id] = 1; renderSelection(); }
    function selectionBounds() {
      var b = null;
      board.items.forEach(function (it) { if (sel.items[it.id]) b = unionBounds(b, itemBounds(it)); });
      board.strokes.forEach(function (s) { if (sel.strokes[s.id]) b = unionBounds(b, strokeBounds(s)); });
      return b;
    }
    function renderSelection() {
      var n = selCount();
      Object.keys(nodes).forEach(function (id) { nodes[id].classList.toggle('wbSel', !!sel.items[id]); });
      if (!n || clean) { selBox.hidden = true; selBar.hidden = true; return; }
      var b = selectionBounds();
      if (!b) { selBox.hidden = true; selBar.hidden = true; return; }
      var a = toScreen(board.view, b.x0, b.y0), c = toScreen(board.view, b.x1, b.y1);
      selBox.hidden = false;
      selBox.style.left = (a.x - 4) + 'px';
      selBox.style.top = (a.y - 4) + 'px';
      selBox.style.width = (c.x - a.x + 8) + 'px';
      selBox.style.height = (c.y - a.y + 8) + 'px';
      var one = Object.keys(sel.items);
      handle.hidden = !(one.length === 1 && !Object.keys(sel.strokes).length);
      selBar.hidden = false;
      var s = stageSize();
      selBar.style.left = clamp(a.x, 4, Math.max(4, s.w - 190)) + 'px';
      selBar.style.top = (a.y - 46 < 4 ? c.y + 10 : a.y - 46) + 'px';
    }
    function removeSelected() {
      if (!selCount()) return;
      record();
      board.items = board.items.filter(function (it) { return !sel.items[it.id]; });
      board.strokes = board.strokes.filter(function (s) { return !sel.strokes[s.id]; });
      clearSelection();
      changed('delete');
    }
    function duplicateSelected() {
      if (!selCount()) return;
      record();
      var next = { items: {}, strokes: {} };
      var addI = [], addS = [];
      board.items.forEach(function (it) {
        if (!sel.items[it.id]) return;
        var c = Object.assign({}, it, { id: newId(it.t), x: it.x + 30, y: it.y + 30 });
        addI.push(c); next.items[c.id] = 1;
      });
      board.strokes.forEach(function (s) {
        if (!sel.strokes[s.id]) return;
        var c = moveStroke(s, 30, 30); c.id = newId('s');
        addS.push(c); next.strokes[c.id] = 1;
      });
      board.items = board.items.concat(addI).slice(0, ITEMS_MAX);
      board.strokes = board.strokes.concat(addS).slice(0, STROKES_MAX);
      sel = next;
      changed('duplicate');
    }
    function bringToFront() {
      if (!selCount()) return;
      record();
      var front = board.items.filter(function (it) { return sel.items[it.id]; });
      board.items = board.items.filter(function (it) { return !sel.items[it.id]; }).concat(front);
      var sf = board.strokes.filter(function (s) { return sel.strokes[s.id]; });
      board.strokes = board.strokes.filter(function (s) { return !sel.strokes[s.id]; }).concat(sf);
      changed('order');
    }
    function itemAt(wx, wy) {
      for (var i = board.items.length - 1; i >= 0; i--) {
        var it = board.items[i];
        if (wx >= it.x && wx <= it.x + it.w && wy >= it.y && wy <= it.y + it.h) return it;
      }
      return null;
    }
    function strokeAt(wx, wy, r) {
      if (!inkOn) return null;
      for (var i = board.strokes.length - 1; i >= 0; i--) if (hitStroke(board.strokes[i], wx, wy, r)) return board.strokes[i];
      return null;
    }

    /* ---- Pointers ----
       A pen draws. A mouse draws. A FINGER draws too, until a pencil has
       been used on this board — after that a finger moves the board and a
       resting palm is not a scribble, the rule the worksheet's ✍️ mode
       carries. Two fingers always pinch and move. */
    var ptrs = {};
    var g = null;             // the gesture in progress
    function ptrCount() { return Object.keys(ptrs).length; }
    function local(e) {
      var r = stage.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    function wantsPan(e) {
      if (tool === 'hand' || spaceDown || e.button === 1) return true;
      if (e.pointerType === 'touch' && penSeen && tool !== 'select' && tool !== 'note') return true;
      return false;
    }
    function onDown(e) {
      if (destroyed) return;
      var t = e.target;
      if (t.closest && (t.closest('.wbSelBar') || t.closest('.wbItem button') || t.closest('.wbItem input') ||
          t.closest('.wbItem.wbEditing'))) return;
      if (e.button != null && e.button > 1) return;
      // A palm landing while the pencil writes is not a second finger: it is
      // ignored outright, so it can neither pinch nor end the stroke.
      if (e.pointerType === 'touch' && g && g.kind === 'draw' && g.pen) return;
      if (e.pointerType === 'pen') penSeen = true;
      if (editing) finishEdit();
      var p = local(e);
      ptrs[e.pointerId] = { x: p.x, y: p.y, type: e.pointerType };
      try { stage.setPointerCapture(e.pointerId); } catch (x) {}
      e.preventDefault();
      try { stage.focus({ preventScroll: true }); } catch (x) {}

      if (ptrCount() === 2) {
        // A second finger: whatever the first one started becomes a pinch.
        // A stroke a finger had begun is dropped, not committed — it was the
        // start of a pinch, never writing.
        if (g && g.kind === 'draw') { live.setAttribute('d', ''); }
        var ids = Object.keys(ptrs), a = ptrs[ids[0]], b = ptrs[ids[1]];
        g = { kind: 'pinch', d0: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), m0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
              v0: Object.assign({}, board.view) };
        return;
      }
      if (ptrCount() > 2) return;

      var w = toWorld(board.view, p.x, p.y);
      if (e.target === handle) {
        var only = Object.keys(sel.items)[0], ix = findItem(only);
        if (ix >= 0) {
          record();
          g = { kind: 'resize', id: only, start: w, orig: Object.assign({}, board.items[ix]), id0: e.pointerId };
          return;
        }
      }
      if (wantsPan(e)) { g = { kind: 'pan', s: p, v0: Object.assign({}, board.view), id0: e.pointerId }; stage.classList.add('wbPanning'); return; }
      if (tool === 'pen' || tool === 'hl') {
        if (!inkOn) setInkVisible(true);   // writing while the workings are hidden would be writing blind
        var hl = tool === 'hl';
        g = { kind: 'draw', id0: e.pointerId, pen: e.pointerType === 'pen', pts: [r1(w.x), r1(w.y)], hl: hl,
              c: hl ? hlColor : penColor, w: (hl ? HL_SIZES : SIZES)[sizeIx] };
        strokeStyle(live, { c: g.c, w: g.w, hl: hl ? 1 : 0 });
        live.setAttribute('d', strokePath(g.pts));
        return;
      }
      if (tool === 'eraser') {
        g = { kind: 'erase', id0: e.pointerId, last: w, hit: {}, recorded: false };
        eraseAlong(w, w);
        return;
      }
      if (tool === 'note') {
        g = { kind: 'tap', id0: e.pointerId, s: p, w: w, t: Date.now() };
        return;
      }
      if (tool === 'select') {
        var r = ERASER_R / board.view.z;
        var it = itemAt(w.x, w.y);
        var st = it ? null : strokeAt(w.x, w.y, r);
        var hitSel = (it && sel.items[it.id]) || (st && sel.strokes[st.id]);
        if (!hitSel) {
          if (!e.shiftKey) sel = { items: {}, strokes: {} };
          if (it) sel.items[it.id] = 1;
          else if (st) sel.strokes[st.id] = 1;
          renderSelection();
        }
        if (it || st) {
          g = { kind: 'move', id0: e.pointerId, start: w, s: p, moved: false, t: Date.now(), tapItem: it && it.id,
                origI: board.items.filter(function (x) { return sel.items[x.id]; }).map(function (x) { return Object.assign({}, x); }),
                origS: board.strokes.filter(function (x) { return sel.strokes[x.id]; }) };
          return;
        }
        g = { kind: 'marquee', id0: e.pointerId, s: p, start: w, add: e.shiftKey };
        return;
      }
    }
    function onMove(e) {
      if (destroyed || ptrs[e.pointerId] == null) return;
      var p = local(e);
      ptrs[e.pointerId].x = p.x; ptrs[e.pointerId].y = p.y;
      if (!g) return;
      e.preventDefault();
      if (g.kind === 'pinch') {
        var ids = Object.keys(ptrs);
        if (ids.length < 2) return;
        var a = ptrs[ids[0]], b = ptrs[ids[1]];
        var d = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
        var m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        var v = zoomAt(g.v0, g.m0.x, g.m0.y, d / g.d0);
        board.view = { x: v.x + (m.x - g.m0.x), y: v.y + (m.y - g.m0.y), z: v.z };
        viewChanged();
        return;
      }
      if (e.pointerId !== g.id0) return;
      if (g.kind === 'pan') {
        board.view = { x: g.v0.x + (p.x - g.s.x), y: g.v0.y + (p.y - g.s.y), z: g.v0.z };
        viewChanged();
        return;
      }
      var w = toWorld(board.view, p.x, p.y);
      if (g.kind === 'draw') {
        var evs = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : null;
        if (evs && evs.length) {
          evs.forEach(function (ce) {
            var q = local(ce), cw = toWorld(board.view, q.x, q.y);
            pushPt(cw);
          });
        } else pushPt(w);
        live.setAttribute('d', strokePath(g.pts));
        return;
      }
      if (g.kind === 'erase') { eraseAlong(g.last, w); g.last = w; return; }
      if (g.kind === 'move') {
        var dx = w.x - g.start.x, dy = w.y - g.start.y;
        if (!g.moved && Math.hypot(p.x - g.s.x, p.y - g.s.y) < TAP_PX) return;
        if (!g.moved) { g.moved = true; record(); }
        var byId = {};
        g.origI.forEach(function (o) { byId[o.id] = Object.assign({}, o, { x: r1(o.x + dx), y: r1(o.y + dy) }); });
        board.items = board.items.map(function (it) { return byId[it.id] || it; });
        var sById = {};
        g.origS.forEach(function (o) { sById[o.id] = 1; });
        // Strokes move by a transform while dragging, and get their new
        // points once, on lift — rewriting a long stroke on every pixel of
        // a drag is what makes moving a page of working stutter.
        Object.keys(sById).forEach(function (id) { if (paths[id]) paths[id].setAttribute('transform', 'translate(' + dx + ' ' + dy + ')'); });
        g.dx = dx; g.dy = dy;
        renderItems();
        renderSelection();
        return;
      }
      if (g.kind === 'resize') {
        var o = g.orig, nw = Math.max(40, o.w + (w.x - g.start.x));
        var patch = { w: r1(nw) };
        if (o.t === 'img') patch.h = r1(o.h * (nw / o.w));
        var i = findItem(g.id);
        if (i >= 0) {
          board.items = board.items.slice();
          board.items[i] = Object.assign({}, board.items[i], patch);
          renderItems(); renderSelection();
        }
        return;
      }
      if (g.kind === 'marquee') {
        var x0 = Math.min(g.s.x, p.x), y0 = Math.min(g.s.y, p.y);
        marquee.hidden = false;
        marquee.style.left = x0 + 'px'; marquee.style.top = y0 + 'px';
        marquee.style.width = Math.abs(p.x - g.s.x) + 'px'; marquee.style.height = Math.abs(p.y - g.s.y) + 'px';
        g.end = w;
        return;
      }
    }
    function pushPt(w) {
      var n = g.pts.length;
      var x = r1(w.x), y = r1(w.y);
      if (n >= 2 && Math.abs(g.pts[n - 2] - x) < 0.05 && Math.abs(g.pts[n - 1] - y) < 0.05) return;
      if (n < PTS_MAX) g.pts.push(x, y);
    }
    function eraseAlong(a, b) {
      if (!inkOn) return;
      var r = ERASER_R / board.view.z;
      var gone = board.strokes.filter(function (s) { return hitStrokeAlong(s, a.x, a.y, b.x, b.y, r); });
      if (!gone.length) return;
      if (!g.recorded) { record(); g.recorded = true; }
      var drop = {};
      gone.forEach(function (s) { drop[s.id] = 1; g.hit[s.id] = 1; });
      board.strokes = board.strokes.filter(function (s) { return !drop[s.id]; });
      renderStrokes();
    }
    function onUp(e) {
      if (ptrs[e.pointerId] == null) return;
      delete ptrs[e.pointerId];
      try { stage.releasePointerCapture(e.pointerId); } catch (x) {}
      if (!g) return;
      var cancelled = e.type === 'pointercancel';
      if (g.kind === 'pinch') {
        // One finger lifted: the gesture is over. The other finger does
        // nothing until it lifts too, so a pinch never ends in a scribble.
        if (ptrCount() === 0) g = null;
        else g = { kind: 'idle' };
        return;
      }
      if (g.kind === 'idle') { if (ptrCount() === 0) g = null; return; }
      if (e.pointerId !== g.id0) return;
      var kind = g.kind, gg = g;
      g = null;
      stage.classList.remove('wbPanning');
      if (kind === 'draw') {
        live.setAttribute('d', '');
        if (cancelled) return;
        var pts = simplify(gg.pts, SIMPLIFY_TOL / Math.max(0.25, board.view.z));
        if (board.strokes.length >= STROKES_MAX) { toast('This board has as much writing as it can hold — start a new one.'); return; }
        var s = cleanStroke({ id: newId('s'), c: gg.c, w: gg.w, hl: gg.hl, p: pts });
        if (!s) return;
        record();
        board.strokes = board.strokes.concat([s]);
        changed('ink');
        return;
      }
      if (kind === 'erase') { if (gg.recorded) changed('erase'); return; }
      if (kind === 'pan') { return; }
      if (kind === 'tap') {
        if (cancelled) return;
        var p = local(e);
        if (Math.hypot(p.x - gg.s.x, p.y - gg.s.y) > TAP_PX * 2) return;
        var onNote = itemAt(gg.w.x, gg.w.y);
        if (onNote && onNote.t === 'note') { beginEdit(onNote.id); return; }
        var it = addNote('', { x: gg.w.x, y: gg.w.y });
        if (it) { renderItems(); beginEdit(it.id); }
        return;
      }
      if (kind === 'move') {
        if (gg.moved) {
          if (gg.dx || gg.dy) {
            var moveIds = {};
            gg.origS.forEach(function (o) { moveIds[o.id] = 1; });
            board.strokes = board.strokes.map(function (s) {
              if (!moveIds[s.id]) return s;
              if (paths[s.id]) paths[s.id].removeAttribute('transform');
              return moveStroke(s, gg.dx, gg.dy);
            });
          }
          changed('move');
          return;
        }
        // A tap. Twice on a note is "type in it".
        var now = Date.now();
        if (gg.tapItem && lastTap && lastTap.id === gg.tapItem && now - lastTap.t < TAP_MS * 1.4) {
          var ti = board.items[findItem(gg.tapItem)];
          if (ti && ti.t === 'note') { lastTap = null; beginEdit(ti.id); return; }
        }
        lastTap = gg.tapItem ? { id: gg.tapItem, t: now } : null;
        return;
      }
      if (kind === 'resize') { changed('resize'); return; }
      if (kind === 'marquee') {
        marquee.hidden = true;
        if (!gg.end) { if (!gg.add) clearSelection(); return; }
        var rect = { x0: Math.min(gg.start.x, gg.end.x), y0: Math.min(gg.start.y, gg.end.y),
                     x1: Math.max(gg.start.x, gg.end.x), y1: Math.max(gg.start.y, gg.end.y) };
        if (!gg.add) sel = { items: {}, strokes: {} };
        board.items.forEach(function (it) { if (rectsMeet(rect, itemBounds(it))) sel.items[it.id] = 1; });
        if (inkOn) board.strokes.forEach(function (s) { if (strokeInRect(s, rect)) sel.strokes[s.id] = 1; });
        renderSelection();
        return;
      }
    }
    function onWheel(e) {
      if (destroyed) return;
      if (e.target.closest && e.target.closest('.wbItem input')) return;
      e.preventDefault();
      var p = local(e);
      var dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      var dx = e.deltaMode === 1 ? e.deltaX * 16 : e.deltaX;
      if (e.ctrlKey || e.metaKey) {
        zoomBy(Math.exp(-dy * 0.0025), p.x, p.y);
        return;
      }
      if (e.shiftKey && !dx) { dx = dy; dy = 0; }
      board.view = { x: board.view.x - dx, y: board.view.y - dy, z: board.view.z };
      viewChanged();
    }
    function onKey(e) {
      if (destroyed || !host.isConnected || host.offsetParent === null) return;
      if (typingIn(e.target)) return;
      var k = e.key;
      var mod = e.ctrlKey || e.metaKey;
      if (k === ' ' && !mod) { if (!spaceDown) { spaceDown = true; stage.classList.add('wbSpace'); } e.preventDefault(); return; }
      if (mod && (k === 'z' || k === 'Z')) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (mod && (k === 'y' || k === 'Y')) { e.preventDefault(); redo(); return; }
      if (mod && (k === 'a' || k === 'A')) {
        e.preventDefault(); setTool('select');
        sel = { items: {}, strokes: {} };
        board.items.forEach(function (it) { sel.items[it.id] = 1; });
        if (inkOn) board.strokes.forEach(function (s) { sel.strokes[s.id] = 1; });
        renderSelection();
        return;
      }
      if (mod) return;
      if ((k === 'Delete' || k === 'Backspace') && selCount()) { e.preventDefault(); removeSelected(); return; }
      if (k === 'Escape') {
        if (clean) { setClean(false); e.preventDefault(); return; }
        if (selCount()) { clearSelection(); e.preventDefault(); }
        return;
      }
      var map = { v: 'select', p: 'pen', h: 'hl', e: 'eraser', n: 'note' };
      var t = map[String(k).toLowerCase()];
      if (t) { setTool(t); e.preventDefault(); return; }
      if (k === '+' || k === '=') { zoomBy(1.25); e.preventDefault(); return; }
      if (k === '-' || k === '_') { zoomBy(1 / 1.25); e.preventDefault(); return; }
      if (k === '0') { fit(); e.preventDefault(); return; }
    }
    function onKeyUp(e) { if (e.key === ' ') { spaceDown = false; stage.classList.remove('wbSpace'); } }
    function onPaste(e) {
      if (destroyed || !host.isConnected || host.offsetParent === null) return;
      if (typingIn(e.target)) return;
      var items = (e.clipboardData && e.clipboardData.items) || [];
      var files = [];
      for (var i = 0; i < items.length; i++) {
        if (items[i].kind === 'file') { var f = items[i].getAsFile(); if (f) files.push(f); }
      }
      if (files.length) { e.preventDefault(); addFiles(files); return; }
      var text = e.clipboardData && e.clipboardData.getData('text/plain');
      if (text && text.trim()) { e.preventDefault(); addNote(text.trim().slice(0, TEXT_MAX)); }
    }
    function onDrop(e) {
      e.preventDefault();
      var files = Array.prototype.slice.call((e.dataTransfer && e.dataTransfer.files) || []);
      if (files.length) addFiles(files);
    }
    function onDragOver(e) { e.preventDefault(); }
    function onBlur() { spaceDown = false; stage.classList.remove('wbSpace'); }
    function onResize() { renderSelection(); }

    stage.addEventListener('pointerdown', onDown);
    stage.addEventListener('pointermove', onMove);
    stage.addEventListener('pointerup', onUp);
    stage.addEventListener('pointercancel', onUp);
    stage.addEventListener('lostpointercapture', function (e) { if (ptrs[e.pointerId] != null) onUp({ type: 'pointercancel', pointerId: e.pointerId }); });
    stage.addEventListener('wheel', onWheel, { passive: false });
    // Safari's own pinch on a trackpad would zoom the PAGE, not the board.
    stage.addEventListener('gesturestart', function (e) { e.preventDefault(); });
    stage.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
    stage.addEventListener('dragover', onDragOver);
    stage.addEventListener('drop', onDrop);
    stage.addEventListener('contextmenu', function (e) { if (tool !== 'select') e.preventDefault(); });
    doc.addEventListener('keydown', onKey);
    doc.addEventListener('keyup', onKeyUp);
    doc.addEventListener('paste', onPaste);
    win.addEventListener('blur', onBlur);
    win.addEventListener('resize', onResize);

    /* ---- The picture of the board ---- */
    function loadImg(src) {
      return new Promise(function (resolve) {
        if (!src) { resolve(null); return; }
        var im = new Image();
        if (/^https:/i.test(src)) im.crossOrigin = 'anonymous';
        im.onload = function () { resolve(im); };
        im.onerror = function () { resolve(null); };
        im.src = src;
      });
    }
    function srcFor(it) {
      if (it.src) return Promise.resolve(it.src);
      if (it.path && urlCache[it.path]) return Promise.resolve(urlCache[it.path]);
      if (it.path && typeof opts.imageUrl === 'function') {
        return Promise.resolve(opts.imageUrl(it.path)).then(function (u) { if (u) urlCache[it.path] = u; return u || ''; }).catch(function () { return ''; });
      }
      // A question the host drew: its first picture, if it has one.
      var n = nodes[it.id], im = n && n.querySelector('.wbQBody img');
      return Promise.resolve(im && im.currentSrc ? im.currentSrc : '');
    }
    function roundRect(ctx, x, y, w, hh, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + hh, r);
      ctx.arcTo(x + w, y + hh, x, y + hh, r);
      ctx.arcTo(x, y + hh, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }
    async function drawItem(ctx, it) {
      if (it.t === 'img') {
        var im = await loadImg(await srcFor(it));
        if (im) ctx.drawImage(im, it.x, it.y, it.w, it.h);
        else { ctx.fillStyle = '#eeeeee'; ctx.fillRect(it.x, it.y, it.w, it.h); }
        if (it.cap) { ctx.fillStyle = '#555'; ctx.font = '14px sans-serif'; ctx.fillText(it.cap, it.x, it.y + it.h + 18); }
        return;
      }
      if (it.t === 'note') {
        ctx.fillStyle = it.color;
        ctx.shadowColor = 'rgba(0,0,0,.15)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
        ctx.fillRect(it.x, it.y, it.w, it.h);
        ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
        ctx.fillStyle = '#222';
        ctx.font = it.fs + 'px sans-serif';
        var lines = wrapLines(it.text, it.w - 28, function (s) { return ctx.measureText(s).width; }, 40);
        lines.forEach(function (l, i) { ctx.fillText(l, it.x + 14, it.y + 14 + it.fs * (i + 1) * 1.25); });
        return;
      }
      // A question card, drawn plainly: frame, head, picture, words, the try box.
      ctx.fillStyle = '#ffffff';
      roundRect(ctx, it.x, it.y, it.w, it.h, 12);
      ctx.fill();
      ctx.strokeStyle = it.done ? '#43a047' : '#b39ddb';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = it.done ? '#2e7d32' : '#5e35b1';
      ctx.font = 'bold 15px sans-serif';
      var head = (it.done ? '✅ Got it' : '❓ Try again') + (it.num ? ' · Q' + it.num : '') + (it.doc ? ' · ' + it.doc : '');
      ctx.fillText(head.slice(0, 70), it.x + 14, it.y + 26);
      var y = it.y + 40;
      var im2 = await loadImg(await srcFor(it));
      if (im2) {
        var sz = fitImageSize(im2.naturalWidth, im2.naturalHeight, it.w - 28);
        var maxH = Math.max(60, it.h * 0.55);
        var k = Math.min(1, maxH / sz.h);
        ctx.drawImage(im2, it.x + 14, y, sz.w * k, sz.h * k);
        y += sz.h * k + 10;
      }
      if (it.text && it.text.trim()) {
        ctx.fillStyle = '#222';
        ctx.font = '15px sans-serif';
        var tl = wrapLines(it.text, it.w - 28, function (s) { return ctx.measureText(s).width; }, 12);
        tl.forEach(function (l) { y += 19; if (y < it.y + it.h - 10) ctx.fillText(l, it.x + 14, y); });
      }
    }
    async function exportPng(o) {
      o = o || {};
      var b = o.selection ? selectionBounds() : null;
      if (!b) b = boardBounds(board, { noInk: !(o.ink == null ? inkOn : o.ink) });
      if (!b) return null;
      var pad = o.pad == null ? 24 : o.pad;
      var bw = b.x1 - b.x0 + pad * 2, bh = b.y1 - b.y0 + pad * 2;
      var maxPx = o.maxPx || EXPORT_MAX_PX;
      var k = Math.min(o.scale || 2, maxPx / Math.max(bw, bh));
      var c = doc.createElement('canvas');
      c.width = Math.max(1, Math.round(bw * k));
      c.height = Math.max(1, Math.round(bh * k));
      var ctx = c.getContext('2d');
      try {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.setTransform(k, 0, 0, k, (pad - b.x0) * k, (pad - b.y0) * k);
        var only = o.selection && selCount();
        for (var i = 0; i < board.items.length; i++) {
          var it = board.items[i];
          if (only && !sel.items[it.id]) continue;
          await drawItem(ctx, it);
        }
        var withInk = o.ink == null ? inkOn : !!o.ink;
        if (withInk) board.strokes.forEach(function (s) {
          if (only && !sel.strokes[s.id]) return;
          ctx.save();
          if (s.hl) { ctx.globalAlpha = 0.38; ctx.globalCompositeOperation = 'multiply'; }
          ctx.strokeStyle = s.c;
          ctx.lineWidth = s.w;
          ctx.lineCap = s.hl ? 'butt' : 'round';
          ctx.lineJoin = 'round';
          if (typeof Path2D === 'function') ctx.stroke(new Path2D(strokePath(s.p)));
          ctx.restore();
        });
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        return c.toDataURL(o.type || 'image/png', o.quality || 0.9);
      } catch (e) {
        // A picture from somewhere without CORS taints the canvas; the
        // board is fine, it simply cannot be saved as one picture.
        return null;
      } finally {
        c.width = 0; c.height = 0;
      }
    }
    async function downloadPicture(selection) {
      var url = await exportPng({ selection: !!selection });
      if (!url) { toast(board.items.length || board.strokes.length ? 'The board could not be saved as a picture.' : 'The board is empty.'); return; }
      var a = doc.createElement('a');
      a.href = url;
      a.download = (board.title || 'whiteboard').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 60) + '.png';
      doc.body.appendChild(a);
      a.click();
      a.remove();
    }

    /* ---- The instance ---- */
    function load(raw) {
      if (editing) finishEdit();
      board = cleanBoard(raw, { allowBlob: true });
      hist.clear();
      clearSelection();
      Object.keys(nodes).forEach(function (id) { var n = nodes[id]; if (n.parentNode) n.parentNode.removeChild(n); });
      nodes = {};
      Object.keys(paths).forEach(function (id) { var p = paths[id]; if (p.parentNode) p.parentNode.removeChild(p); });
      paths = {};
      dirty = false;
      renderAll();
      /* The view the board was saved at was another screen's: a board saved
         on a laptop and opened on a phone can open on empty dots, with
         everything off to the side and nothing saying where. So whenever
         the saved view shows none of the board, it opens fitted. */
      var v = raw && raw.view;
      var fresh = !v || (v.x === 0 && v.y === 0 && v.z === 1);
      win.requestAnimationFrame(function () {
        if (destroyed) return;
        if (fresh) { fit(); return; }
        var bb = boardBounds(board);
        if (!bb) return;
        var s = stageSize();
        var a = toScreen(board.view, bb.x0, bb.y0), c = toScreen(board.view, bb.x1, bb.y1);
        if (c.x < 0 || c.y < 0 || a.x > s.w || a.y > s.h) fit();
      });
    }
    function getBoard() {
      if (editing) {
        // A note being typed in is read as it stands, without ending the typing.
        var n = nodes[editing], i = findItem(editing);
        if (n && i >= 0) {
          var tx = n.querySelector('.wbNoteText');
          var text = cleanText(tx.innerText != null ? tx.innerText : tx.textContent, TEXT_MAX);
          if (text !== board.items[i].text) { board.items = board.items.slice(); board.items[i] = Object.assign({}, board.items[i], { text: text }); }
        }
      }
      return {
        v: 1, id: board.id, title: board.title, created: board.created, updated: board.updated, who: board.who,
        view: Object.assign({}, board.view),
        items: board.items.slice(), strokes: board.strokes.slice()
      };
    }
    /* The host uploaded a picture: the item keeps its picture on screen and
       gains the path it is saved under. Not an undo step — it is not
       something the student did. */
    function setItemPath(id, path) {
      var i = findItem(id), p = cleanPath(path);
      if (i < 0 || !p) return;
      var it = board.items[i];
      if (it.src) urlCache[p] = it.src;
      board.items = board.items.slice();
      board.items[i] = Object.assign({}, it, { path: p });
      // The node keeps showing what it shows; only the item object moved on.
      if (nodes[id]) nodes[id]._item = board.items[i];
    }
    function setTitle(t) {
      board.title = cleanText(t, TITLE_MAX).replace(/\s+/g, ' ').trim() || 'My whiteboard';
      changed('title');
    }
    function refresh() {
      // Re-draw every question card (the mistake book arrived, say).
      board.items.forEach(function (it) { if (it.t === 'q' && nodes[it.id]) nodes[it.id]._item = null; });
      renderAll();
    }
    function destroy() {
      destroyed = true;
      clearTimeout(viewTimer);
      doc.removeEventListener('keydown', onKey);
      doc.removeEventListener('keyup', onKeyUp);
      doc.removeEventListener('paste', onPaste);
      win.removeEventListener('blur', onBlur);
      win.removeEventListener('resize', onResize);
      host.innerHTML = '';
      host.classList.remove('wbHost', 'wbInkOff', 'wbClean');
    }

    var api = {
      load: load, board: getBoard, setTool: setTool, tool: function () { return tool; },
      setInkVisible: setInkVisible, inkVisible: function () { return inkOn; },
      setClean: setClean, isClean: function () { return clean; },
      addImage: addImage, addNote: addNote, addQuestion: addQuestion, addQuestions: addQuestions, addFiles: addFiles,
      undo: undo, redo: redo, fit: fit, zoomBy: zoomBy, view: function () { return Object.assign({}, board.view); },
      exportPng: exportPng, downloadPicture: downloadPicture,
      thumb: function () { return exportPng({ maxPx: 360, type: 'image/jpeg', quality: 0.72, pad: 16, ink: true }); },
      setItemPath: setItemPath, setTitle: setTitle, refresh: refresh, destroy: destroy,
      select: function (ids) { sel = { items: {}, strokes: {} }; (ids || []).forEach(function (id) { sel.items[id] = 1; }); renderSelection(); },
      selection: function () { return { items: Object.keys(sel.items), strokes: Object.keys(sel.strokes) }; },
      removeSelected: removeSelected,
      isDirty: function () { return dirty; }, markSaved: function () { dirty = false; },
      canUndo: function () { return hist.canUndo(); }, canRedo: function () { return hist.canRedo(); },
      updateItem: function (id, patch) { return updateItem(id, patch, 'edit'); },
      urlFor: function (path) { return urlCache[path] || ''; },
      _stage: stage
    };
    setTool('pen');
    setInkVisible(true);
    renderAll();
    return api;
  }

  root.Whiteboard = { VERSION: VERSION, pure: pure, create: create };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.Whiteboard;
})(typeof window !== 'undefined' ? window : globalThis);
