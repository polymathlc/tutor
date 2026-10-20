/* =====================================================================
   🙋 CONSULT — a student asks for Mr Chung, and he joins their page (v1.63.0)
   ---------------------------------------------------------------------
   One button on the worksheet bar. A student who is stuck presses it, a
   document goes up in `tutorConsults`, and the teacher is told twice over:

   - an EMAIL, queued by the `studyBuddyConsult` function, to the ONE
     address the function knows (`CONSULT_EMAIL` in
     functions/consult-service.js). This file never names an address and
     never sends one; the harness checks that it does not.
   - a POP-UP on any screen of Study Buddy or Ans Key the teacher already
     has open, from a live listener on the waiting consults.

   Either one opens the CONSULT ROOM: the student's page as live video
   (the page they are on, their own ink on it, and a teal frame round the
   part of it that is on their screen), with a drawing layer over it. What
   the teacher writes there appears on the STUDENT'S page as they write
   it, and the teacher's camera and microphone play in a small window on
   the student's screen.

   THE RULES THAT HOLD IT TOGETHER

   - THE TEACHER'S INK IS NEVER AN ANNOTATION. It is drawn into an SVG of
     its own (`svg.consultInk`) laid over the page, `pointer-events: none`,
     and it is never put in `annotations` — so it cannot be erased, undone
     or saved, it never prints, and `drawAnnsOnCtx` never draws it. Put it
     in `annotations` and the next marking run reads the teacher's working
     as the child's own, which is the fault the tutor's finger and its
     working already document.
   - THE PAGE IS SENT AS A PICTURE OF THE PAGE, NOT OF THE SCREEN. A canvas
     mirror of the page in view is redrawn a few times a second and sent
     with `captureStream`, because `getDisplayMedia` does not exist on the
     iPads these worksheets are written on. The mirror is the whole page,
     so the teacher's coordinates are the PAGE's (0..1 across, 0..1 down)
     and land in the same place whatever the student's zoom or scroll.
   - THE INK TRAVELS TWICE, AND THE SECOND COPY IS THE TRUTH. While the pen
     is down the stroke goes over the data channel so the child sees it
     being written; when the pen comes up it is written to
     `tutorConsults/{id}/ink/{strokeId}`, and that is what both screens
     draw from. So a connection that never forms still delivers every
     stroke, and a teacher who reloads finds their writing still there.
   - A CONNECTION THAT WILL NOT FORM FALLS BACK TO PICTURES. STUN alone
     cannot cross every school network, so after `FALLBACK_AFTER_MS`
     without a connection the student's device writes a still of the page
     to `frames/latest` every `SNAP_EVERY_MS`, and the teacher draws on
     that instead. Slower, and the drawing still works.
   - EVERYTHING THE STUDENT SEES IS TEXT, NEVER MARKUP. A name, a
     worksheet title and a status line are all `textContent`.
   - NOTHING HERE TOUCHES THE SAVE, THE MARKING OR THE MISTAKE BOOK.
   ===================================================================== */
(function (global) {
  'use strict';

  var ENDPOINT = 'https://us-central1-mathgen--app.cloudfunctions.net/studyBuddyConsult';
  var JOIN_BASE = 'https://polymathlc.github.io/tutor/';
  var COLLECTION = 'tutorConsults';
  var ICE_DEFAULT = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];

  // A waiting consult older than this is not a pop-up any more: the child
  // has very likely gone home. The email still has its link.
  var WAIT_FRESH_MS = 30 * 60 * 1000;
  // …and one whose device has stopped saying it is there is not either. A
  // closed tab cannot mark its own consult ended, but it stops beating.
  var SEEN_FRESH_MS = 2 * 60 * 1000;
  var HEARTBEAT_MS = 20 * 1000;
  // A live consult whose teacher has stopped beating for this long, on a
  // connection that is not up, goes back to waiting so the pop-up returns.
  var TEACHER_GONE_MS = 75 * 1000;

  // The page mirror. The long side is what makes printed text readable on
  // the teacher's screen; the frame rate is a page, not a film.
  var MIRROR_LONG = 1600;
  var MIRROR_MS = 200;
  var MIRROR_FORCE_MS = 700;      // repaint at least this often so a new joiner gets a frame
  var MIRROR_FPS = 6;
  var VIDEO_BITRATE = 2500000;

  // The picture fallback, for a network the call cannot cross.
  var FALLBACK_AFTER_MS = 12000;
  var SNAP_EVERY_MS = 2500;
  var SNAP_LONG = 1100;
  var SNAP_QUALITY = 0.6;
  var SNAP_MAX_CHARS = 700000;    // a Firestore document dies at a megabyte

  // The teacher's pen.
  var STROKE_MAX_POINTS = 600;
  var INK_COLORS = [
    { c: '#D81B60', name: 'Magenta' },
    { c: '#1E88E5', name: 'Blue' },
    { c: '#2E7D32', name: 'Green' },
    { c: '#1A1A1A', name: 'Black' }
  ];
  var INK_WIDTHS = [
    { w: 0.003, name: 'Fine' },
    { w: 0.005, name: 'Medium' },
    { w: 0.009, name: 'Thick' }
  ];
  var INK_W_MIN = 0.001, INK_W_MAX = 0.03;
  var INK_DOCS_MAX = 400;
  var LIVE_SEND_MS = 45;
  var LASER_SEND_MS = 60;
  var LASER_MS = 1600;

  var NAME_MAX = 60;
  var TITLE_MAX = 120;
  var NOTIFY_TIMEOUT_MS = 15000;

  /* ===================================================================
     PURE HELPERS — no DOM, no Firestore, no clock unless handed one. The
     harness pins these directly, so they are kept free of side effects.
     =================================================================== */

  function consultIdOk(id) {
    return typeof id === 'string' && /^[A-Za-z0-9]{12,40}$/.test(id);
  }

  function consultLink(id) {
    return consultIdOk(id) ? JOIN_BASE + '?consult=' + encodeURIComponent(id) : '';
  }

  function readConsultParam(search) {
    try {
      var id = new URLSearchParams(String(search || '')).get('consult') || '';
      return consultIdOk(id) ? id : '';
    } catch (e) { return ''; }
  }

  /* One line, no control characters, bounded. A name is a word somebody
     typed into a roster, and a title is whatever a PDF called itself. */
  function cleanText(s, max) {
    return String(s == null ? '' : s)
      .replace(/[\u0000-\u001F\u007F-\u009F\u2028\u2029]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, max || NAME_MAX);
  }

  function clamp01(v) {
    v = Number(v);
    if (!isFinite(v)) return 0;
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }

  function round4(v) { return Math.round(clamp01(v) * 10000) / 10000; }

  /* Evenly thins a long stroke rather than cutting its end off: a stroke
     cut short is a word the teacher wrote with its last letter missing. The
     first and the last point are always kept. */
  function decimate(points, max) {
    max = max || STROKE_MAX_POINTS;
    if (!Array.isArray(points) || points.length <= max) return Array.isArray(points) ? points.slice() : [];
    var out = [], step = (points.length - 1) / (max - 1);
    for (var i = 0; i < max - 1; i++) out.push(points[Math.round(i * step)]);
    out.push(points[points.length - 1]);
    return out;
  }

  function packPoints(points) {
    var flat = [];
    decimate(points || [], STROKE_MAX_POINTS).forEach(function (pt) {
      if (!pt || pt.length < 2 || !isFinite(Number(pt[0])) || !isFinite(Number(pt[1]))) return;
      flat.push(round4(pt[0]), round4(pt[1]));
    });
    return flat;
  }

  function unpackPoints(flat) {
    var out = [];
    if (!Array.isArray(flat)) return out;
    var n = Math.min(flat.length, STROKE_MAX_POINTS * 2);
    for (var i = 0; i + 1 < n; i += 2) {
      var x = Number(flat[i]), y = Number(flat[i + 1]);
      if (!isFinite(x) || !isFinite(y)) continue;
      out.push([clamp01(x), clamp01(y)]);
    }
    return out;
  }

  function inkColorOk(c) { return typeof c === 'string' && /^#[0-9A-Fa-f]{6}$/.test(c); }
  function inkWidth(w) {
    w = Number(w);
    if (!isFinite(w)) return INK_WIDTHS[1].w;
    return Math.min(INK_W_MAX, Math.max(INK_W_MIN, w));
  }
  function strokeIdOk(id) { return typeof id === 'string' && /^[A-Za-z0-9_-]{6,40}$/.test(id); }

  /* THE ONE DOOR A STROKE COMES IN BY — the data channel and the ink
     collection alike. A document under the shared rules can be written by
     something other than this app, so nothing is drawn that has not been
     read back through here. */
  function cleanStroke(raw) {
    if (!raw || typeof raw !== 'object') return null;
    if (!strokeIdOk(raw.id)) return null;
    var page = Number(raw.page);
    if (!(page >= 1 && page <= 2000 && Math.floor(page) === page)) return null;
    var pts = unpackPoints(raw.p);
    if (!pts.length) return null;
    return {
      id: raw.id,
      ws: typeof raw.ws === 'string' ? raw.ws.slice(0, 200) : '',
      page: page,
      c: inkColorOk(raw.c) ? raw.c : INK_COLORS[0].c,
      w: inkWidth(raw.w),
      pts: pts,
      at: Number(raw.at) || 0,
      done: raw.done !== false
    };
  }

  /* A smooth path through the points, in the drawing's own units. One point
     is a dot — a tap with the pen is a full stop, not nothing. */
  function strokePathD(pts, W, H) {
    if (!pts || !pts.length) return '';
    function f(v) { return Math.round(v * 100) / 100; }
    var p0 = pts[0];
    if (pts.length === 1) return 'M' + f(p0[0] * W) + ' ' + f(p0[1] * H) + 'l0.01 0';
    if (pts.length === 2) {
      return 'M' + f(p0[0] * W) + ' ' + f(p0[1] * H) + 'L' + f(pts[1][0] * W) + ' ' + f(pts[1][1] * H);
    }
    var d = 'M' + f(p0[0] * W) + ' ' + f(p0[1] * H);
    for (var i = 1; i < pts.length - 1; i++) {
      var a = pts[i], b = pts[i + 1];
      var mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      d += 'Q' + f(a[0] * W) + ' ' + f(a[1] * H) + ' ' + f(mx * W) + ' ' + f(my * H);
    }
    var last = pts[pts.length - 1];
    return d + 'L' + f(last[0] * W) + ' ' + f(last[1] * H);
  }

  /* An ICE candidate travels as a string tagged with the negotiation it
     belongs to — the shape Ans Key's live cameras already use. A teacher
     who rejoins bumps `rev`, and a candidate left over from the last
     connection must never be handed to the new one. */
  function packCandidate(c, rev) {
    if (!c || !c.candidate) return '';
    return JSON.stringify({
      r: rev,
      c: String(c.candidate),
      m: c.sdpMid == null ? null : String(c.sdpMid),
      i: c.sdpMLineIndex == null ? null : Number(c.sdpMLineIndex)
    });
  }

  function unpackCandidates(list, rev, seen) {
    var out = [];
    if (!Array.isArray(list)) return out;
    seen = seen || {};
    for (var i = 0; i < list.length; i++) {
      var raw = list[i];
      if (typeof raw !== 'string' || seen[raw]) continue;
      var v = null;
      try { v = JSON.parse(raw); } catch (e) { v = null; }
      if (!v || v.r !== rev || typeof v.c !== 'string' || !v.c) continue;
      seen[raw] = true;
      out.push({ candidate: v.c, sdpMid: v.m == null ? null : v.m, sdpMLineIndex: v.i == null ? null : v.i });
    }
    return out;
  }

  /* The student answers an offer it has not answered yet. */
  function needsAnswer(data, handledRev) {
    if (!data || data.status !== 'live' || !data.offer || typeof data.offer.sdp !== 'string' || !data.offer.sdp) return false;
    var rev = Number(data.rev);
    if (!isFinite(rev) || rev < 1) return false;
    return rev !== handledRev;
  }

  function stampMs(v) {
    if (v == null) return 0;
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    if (typeof v.toMillis === 'function') { try { return v.toMillis(); } catch (e) { return 0; } }
    if (v instanceof Date) return v.getTime();
    var n = Number(v);
    return isFinite(n) ? n : 0;
  }

  /* Whether a consult is one the teacher should be shown a pop-up for: it
     is waiting, it was asked for recently, and the device that asked for it
     is still there. A stamp in the future (a fast clock) is not "fresh for
     ever"; it is read as now. */
  function consultFresh(data, now) {
    if (!data || data.status !== 'waiting') return false;
    var at = Math.min(stampMs(data.at), now), seen = Math.min(stampMs(data.seen) || at, now);
    if (!at) return false;
    return now - at < WAIT_FRESH_MS && now - seen < SEEN_FRESH_MS;
  }

  function consultAgo(ms) {
    ms = Math.max(0, Number(ms) || 0);
    var m = Math.floor(ms / 60000);
    if (m < 1) return 'just now';
    if (m === 1) return '1 min ago';
    if (m < 60) return m + ' min ago';
    var h = Math.floor(m / 60);
    return h === 1 ? '1 hour ago' : h + ' hours ago';
  }

  function consultSummary(data) {
    if (!data) return '';
    var bits = [];
    var lvl = cleanText(data.level, 12), sub = cleanText(data.subject, 20);
    if (lvl || sub) bits.push([lvl, subjectWord(sub)].filter(Boolean).join(' '));
    var title = cleanText(data.worksheetName, TITLE_MAX);
    if (title) bits.push(title);
    var page = data.view && Number(data.view.page);
    if (page >= 1) bits.push('page ' + page);
    return bits.join(' · ');
  }

  function subjectWord(s) {
    var map = { math: 'Maths', science: 'Science', both: 'Maths & Science', english: 'English', chinese: 'Chinese' };
    return map[s] || s;
  }

  /* A page mirror of the page's own shape, long side bounded, sides even
     (some encoders refuse an odd width). */
  function mirrorSize(baseW, baseH, long) {
    long = long || MIRROR_LONG;
    baseW = Number(baseW) || 0; baseH = Number(baseH) || 0;
    if (!(baseW > 0 && baseH > 0)) return { w: Math.round(long * 0.7071 / 2) * 2, h: long };
    var k = long / Math.max(baseW, baseH);
    return { w: Math.max(2, Math.round(baseW * k / 2) * 2), h: Math.max(2, Math.round(baseH * k / 2) * 2) };
  }

  /* The largest box of the page's shape that fits the area. */
  function fitStage(areaW, areaH, aspect) {
    areaW = Math.max(0, Number(areaW) || 0); areaH = Math.max(0, Number(areaH) || 0);
    aspect = Number(aspect) > 0 ? Number(aspect) : 1.4142;
    if (!areaW || !areaH) return { w: 0, h: 0 };
    var w = areaW, h = w * aspect;
    if (h > areaH) { h = areaH; w = h / aspect; }
    return { w: Math.floor(w), h: Math.floor(h) };
  }

  /* A pointer on the stage as a point on the page. Off the stage by more
     than a hair is not a point at all — a stroke must not be smeared along
     the edge of the page because the pen wandered past it. */
  function normFromRect(clientX, clientY, rect, slack) {
    if (!rect || !(rect.width > 0) || !(rect.height > 0)) return null;
    var x = (clientX - rect.left) / rect.width, y = (clientY - rect.top) / rect.height;
    slack = slack == null ? 0.02 : slack;
    if (x < -slack || x > 1 + slack || y < -slack || y > 1 + slack) return null;
    return [clamp01(x), clamp01(y)];
  }

  /* The part of the page on the student's screen, as a box on the page.
     Null when none of it is. */
  function visibleBox(pageRect, areaRect) {
    if (!pageRect || !areaRect || !(pageRect.width > 0) || !(pageRect.height > 0)) return null;
    var l = Math.max(pageRect.left, areaRect.left), r = Math.min(pageRect.right, areaRect.right);
    var t = Math.max(pageRect.top, areaRect.top), b = Math.min(pageRect.bottom, areaRect.bottom);
    if (r <= l || b <= t) return null;
    return [
      round4((l - pageRect.left) / pageRect.width), round4((t - pageRect.top) / pageRect.height),
      round4((r - pageRect.left) / pageRect.width), round4((b - pageRect.top) / pageRect.height)
    ];
  }

  /* What can come over the data channel, read once. Anything else is
     dropped without a word. */
  function parseMessage(raw) {
    var m = null;
    if (typeof raw !== 'string' || raw.length > 64000) return null;
    try { m = JSON.parse(raw); } catch (e) { return null; }
    if (!m || typeof m !== 'object') return null;
    if (m.t === 'ink') { var s = cleanStroke(m); return s ? { t: 'ink', stroke: s } : null; }
    if (m.t === 'drop') return strokeIdOk(m.id) ? { t: 'drop', id: m.id } : null;
    if (m.t === 'clear') return { t: 'clear' };
    if (m.t === 'laser') {
      var page = Number(m.page);
      if (!(page >= 1 && page <= 2000)) return null;
      return { t: 'laser', ws: typeof m.ws === 'string' ? m.ws.slice(0, 200) : '', page: page, x: clamp01(m.x), y: clamp01(m.y) };
    }
    if (m.t === 'view') return { t: 'view', view: cleanView(m.view) };
    if (m.t === 'nav') { var n = cleanNav(m); return n ? n : null; }
    return null;
  }

  /* ---------------- The teacher moves the student's page ----------------
     A NAV is an instruction, never a picture: "zoom by this much", "fit the
     width", "next page", "put this spot in the middle", "scroll by this
     much". The student's own app does the moving, through the very same
     zoomAt / fitWidth / scroll the child's own fingers use, so nothing here
     can leave the worksheet in a state the child could not have put it in.

     Every number is clamped HERE, once: a factor past NAV_ZOOM_MAX is one
     tap turning the page into a single word, and a pan past one page is a
     teacher's slip throwing the child to the end of the paper. A nav with
     no id is refused, because the id is what stops the same instruction
     arriving twice — once on the channel and once on the document — and
     being obeyed twice. */
  var NAV_OPS = { zoom: 1, fit: 1, page: 1, center: 1, pan: 1 };
  var NAV_ZOOM_MIN = 0.5, NAV_ZOOM_MAX = 2;
  var NAV_PAN_MAX = 1;
  var NAV_FRESH_MS = 60 * 1000;
  function navIdOk(id) { return typeof id === 'string' && /^[A-Za-z0-9_-]{6,40}$/.test(id); }
  function cleanNav(m) {
    if (!m || typeof m !== 'object') return null;
    if (!navIdOk(m.id) || !NAV_OPS[m.op]) return null;
    var out = { t: 'nav', id: m.id, op: m.op, ws: typeof m.ws === 'string' ? m.ws.slice(0, 200) : '' };
    var at = Number(m.at);
    out.at = at > 0 && isFinite(at) ? Math.floor(at) : 0;
    if (m.op === 'zoom') {
      var f = Number(m.f);
      if (!(f > 0) || !isFinite(f)) return null;
      out.f = Math.round(Math.min(NAV_ZOOM_MAX, Math.max(NAV_ZOOM_MIN, f)) * 10000) / 10000;
      if (out.f === 1) return null;
      var zp = Number(m.page);
      if (zp >= 1 && zp <= 2000 && m.x != null && m.y != null && isFinite(Number(m.x)) && isFinite(Number(m.y))) {
        out.page = Math.floor(zp); out.x = clamp01(m.x); out.y = clamp01(m.y);
      }
    } else if (m.op === 'page') {
      var step = Number(m.step);
      if (step !== 1 && step !== -1) return null;
      out.step = step;
    } else if (m.op === 'center') {
      var cp = Number(m.page);
      if (!(cp >= 1 && cp <= 2000)) return null;
      if (!isFinite(Number(m.x)) || !isFinite(Number(m.y))) return null;
      out.page = Math.floor(cp); out.x = clamp01(m.x); out.y = clamp01(m.y);
    } else if (m.op === 'pan') {
      var dx = Number(m.dx), dy = Number(m.dy);
      if (!isFinite(dx)) dx = 0;
      if (!isFinite(dy)) dy = 0;
      dx = Math.max(-NAV_PAN_MAX, Math.min(NAV_PAN_MAX, dx));
      dy = Math.max(-NAV_PAN_MAX, Math.min(NAV_PAN_MAX, dy));
      if (Math.abs(dx) < 0.0005 && Math.abs(dy) < 0.0005) return null;
      // Signed: round4 clamps to 0..1, which would throw every leftward or
      // upward pan away.
      out.dx = Math.round(dx * 10000) / 10000; out.dy = Math.round(dy * 10000) / 10000;
    }
    return out;
  }

  /* Whether a nav read off the DOCUMENT is still worth obeying. The channel
     is instant; the document is the fallback, and a nav left on it from a
     minute ago — a reconnect, a reload — must never move a page the child
     has since moved for themselves. The clocks are two devices', so the
     window is generous rather than exact. */
  function navFresh(n, t) {
    if (!n || !n.at) return false;
    return Math.abs((t || Date.now()) - n.at) < NAV_FRESH_MS;
  }

  /* The zoom the teacher's toolbar shows, as a whole percentage. */
  function zoomPercent(z) {
    z = Number(z);
    if (!(z > 0) || !isFinite(z)) return '';
    return Math.round(z * 100) + '%';
  }

  /* Two continuous navs folded into one, for the DOCUMENT fallback. Over the
     channel every drag step goes as it happens; when the channel is down the
     same steps would be a Firestore write each, a dozen a second, so they are
     gathered and written as one every NAV_DOC_MS. Two pans add, two zooms
     multiply (and keep the LATEST point, which is where the fingers are
     now). Anything else does not fold, and the caller writes the first
     before starting on the second. The result is clamped exactly as
     cleanNav clamps, so a long drag cannot fold into a jump past one page. */
  var NAV_STEP = 1.25;
  var NAV_NOTE_MS = 2200;
  var NAV_DOC_MS = 400;
  function navMerge(a, b) {
    if (!a || !b || a.op !== b.op || a.ws !== b.ws) return null;
    if (a.op === 'pan') {
      var dx = Math.max(-NAV_PAN_MAX, Math.min(NAV_PAN_MAX, (Number(a.dx) || 0) + (Number(b.dx) || 0)));
      var dy = Math.max(-NAV_PAN_MAX, Math.min(NAV_PAN_MAX, (Number(a.dy) || 0) + (Number(b.dy) || 0)));
      return { t: 'nav', id: b.id, op: 'pan', ws: b.ws, at: b.at, dx: Math.round(dx * 10000) / 10000, dy: Math.round(dy * 10000) / 10000 };
    }
    if (a.op === 'zoom') {
      var f = Math.max(NAV_ZOOM_MIN, Math.min(NAV_ZOOM_MAX, (Number(a.f) || 1) * (Number(b.f) || 1)));
      var out = { t: 'nav', id: b.id, op: 'zoom', ws: b.ws, at: b.at, f: Math.round(f * 10000) / 10000 };
      var src = b.page ? b : (a.page ? a : null);
      if (src) { out.page = src.page; out.x = src.x; out.y = src.y; }
      return out;
    }
    return null;
  }

  /* Two fingers on the stage: how far apart, and the point between them. */
  function pinchSpan(p1, p2) {
    if (!p1 || !p2) return null;
    var dx = p2.x - p1.x, dy = p2.y - p1.y;
    return { d: Math.sqrt(dx * dx + dy * dy), x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  }

  /* The page after or before the one in view, among the pages the student
     HAS — a key page the teacher hid is not a page to step onto. Null at
     either end, so the caller can say so rather than doing nothing. */
  function stepPage(nums, current, step) {
    if (!Array.isArray(nums) || !nums.length) return null;
    var list = nums.filter(function (n) { return typeof n === 'number' && n >= 1; }).sort(function (a, b) { return a - b; });
    if (!list.length) return null;
    var i = list.indexOf(current);
    if (i < 0) {
      // Not on a page the student has: the nearest one in the direction asked.
      for (var k = 0; k < list.length; k++) if (step > 0 ? list[k] > current : list[list.length - 1 - k] < current) return step > 0 ? list[k] : list[list.length - 1 - k];
      return null;
    }
    var j = i + (step > 0 ? 1 : -1);
    return j >= 0 && j < list.length ? list[j] : null;
  }

  function cleanView(v) {
    if (!v || typeof v !== 'object') return { ws: '', page: 0, n: 0, aspect: 1.4142, title: '', zoom: 0, box: null };
    var aspect = Number(v.aspect);
    return {
      ws: typeof v.ws === 'string' ? v.ws.slice(0, 200) : '',
      page: Number(v.page) >= 1 ? Math.floor(Number(v.page)) : 0,
      n: Number(v.n) >= 0 ? Math.floor(Number(v.n)) : 0,
      aspect: aspect > 0.2 && aspect < 5 ? aspect : 1.4142,
      title: cleanText(v.title, TITLE_MAX),
      zoom: cleanZoom(v.zoom),
      box: cleanBox(v.box)
    };
  }

  /* How far the student is zoomed in, and the part of the page on their
     screen. Both are what the teacher's toolbar READS, never what decides
     anything on the student's side — a zoom out of the app's own range is
     nothing at all, and a box that is not four numbers in order is no box. */
  function cleanZoom(z) {
    z = Number(z);
    return z >= 0.25 && z <= 4 ? Math.round(z * 1000) / 1000 : 0;
  }
  function cleanBox(b) {
    if (!Array.isArray(b) || b.length !== 4) return null;
    var o = b.map(function (x) { return round4(clamp01(x)); });
    if (!(o[2] > o[0]) || !(o[3] > o[1])) return null;
    return o;
  }
  /* The zoom changed enough to be worth telling the document about. A box
     changes on every scroll and goes over the channel only. */
  function sameZoom(a, b) {
    return !!a && !!b && Math.abs((a.zoom || 0) - (b.zoom || 0)) < 0.005;
  }

  function sameView(a, b) {
    return !!a && !!b && a.ws === b.ws && a.page === b.page && a.n === b.n &&
      Math.abs((a.aspect || 0) - (b.aspect || 0)) < 0.0005 && a.title === b.title;
  }

  function strokeOnView(s, view) {
    return !!s && !!view && view.page >= 1 && s.page === view.page && s.ws === view.ws;
  }

  function rid(n) {
    n = n || 16;
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789', out = '';
    var bytes = null;
    try {
      if (global.crypto && global.crypto.getRandomValues) { bytes = new Uint8Array(n); global.crypto.getRandomValues(bytes); }
    } catch (e) { bytes = null; }
    for (var i = 0; i < n; i++) out += chars[(bytes ? bytes[i] : Math.floor(Math.random() * 256)) % chars.length];
    return out;
  }

  function statusWords(status, endedBy) {
    if (status === 'waiting') return 'Waiting for ' + teacherName() + '…';
    if (status === 'live') return teacherName() + ' is with you';
    if (status === 'cancelled') return 'You cancelled the consult.';
    if (status === 'ended') return endedBy === 'teacher' ? teacherName() + ' ended the consult.' : 'The consult has ended.';
    return '';
  }

  function notifyWords(result) {
    if (!result) return '';
    if (result.ok) return '📧 ' + teacherName() + ' has been emailed.';
    if (result.code === 'too_soon' || result.code === 'already') return '📧 ' + teacherName() + ' was emailed a moment ago.';
    if (result.code === 'daily_limit') return 'Today’s email alerts are used up — ' + teacherName() + ' will still see a pop-up if Study Buddy or Ans Key is open.';
    return 'The email could not be sent just now. ' + teacherName() + ' will still see a pop-up if Study Buddy or Ans Key is open.';
  }

  /* ===================================================================
     The app around this file — read lazily, so the harness can run the
     pure half with none of it present.
     =================================================================== */
  function teacherName() {
    try { if (typeof global.setterName === 'function') return global.setterName() || 'Mr Chung'; } catch (e) {}
    return 'Mr Chung';
  }
  function user() { return global.currentUser || null; }
  function admin() {
    var u = user();
    try { return !!u && typeof global.isAdmin === 'function' && global.isAdmin(u); } catch (e) { return false; }
  }
  function practice() {
    try { return typeof global.CentreAdmin !== 'undefined' && global.CentreAdmin && global.CentreAdmin.isPractice && global.CentreAdmin.isPractice(); }
    catch (e) { return false; }
  }
  function db() { return global.db || null; }
  function fv() {
    try { return global.firebase && global.firebase.firestore && global.firebase.firestore.FieldValue || null; } catch (e) { return null; }
  }
  function serverStamp() { var F = fv(); return F && F.serverTimestamp ? F.serverTimestamp() : Date.now(); }
  function arrayUnion(items) {
    var F = fv();
    return F && F.arrayUnion ? F.arrayUnion.apply(F, items) : items;
  }
  function now() { return Date.now(); }
  function $(id) { return global.document ? global.document.getElementById(id) : null; }
  function el(tag, cls, text) {
    var n = global.document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function svgEl(tag, attrs) {
    var n = global.document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }
  function btn(text, cls, onClick, title) {
    var b = el('button', 'btn btnSm' + (cls ? ' ' + cls : ''), text);
    b.type = 'button';
    if (title) { b.title = title; b.setAttribute('aria-label', title); }
    b.addEventListener('click', onClick);
    return b;
  }
  function toast(msg, ms) { try { if (typeof global.toast === 'function') global.toast(msg, ms || 5000); } catch (e) {} }
  function usage(key, detail) { try { if (typeof global.usageNote === 'function') global.usageNote(key, detail); } catch (e) {} }
  function ice() { return Array.isArray(global.TUTOR_CONSULT_ICE) ? global.TUTOR_CONSULT_ICE : ICE_DEFAULT; }
  function RTC() { return global.RTCPeerConnection || null; }
  function sdpOf(d) { return d ? { type: d.type, sdp: d.sdp } : null; }
  function consultRef(id) { var d = db(); return d ? d.collection(COLLECTION).doc(id) : null; }

  function studentName() {
    try {
      if (typeof global.activeStudent === 'function') {
        var st = global.activeStudent();
        if (st && st.name) return cleanText(st.name, NAME_MAX);
      }
    } catch (e) {}
    var u = user();
    return cleanText((u && u.displayName) || 'A student', NAME_MAX) || 'A student';
  }
  function studentLevelSubject() {
    var meta = global.wsMeta || {};
    var st = null;
    try { st = typeof global.activeStudent === 'function' ? global.activeStudent() : null; } catch (e) { st = null; }
    return {
      level: cleanText(meta.level || (st && st.level) || '', 12),
      subject: cleanText(meta.subject || (st && st.subject) || '', 20)
    };
  }

  function onWorksheet() {
    return global.view === 'ws' && Array.isArray(global.pages) && global.pages.length > 0;
  }
  function currentPage() {
    if (!onWorksheet()) return null;
    try { if (typeof global.visiblePage === 'function') return global.visiblePage() || null; } catch (e) {}
    return null;
  }
  function studentPageCount() {
    try { if (typeof global.studentPages === 'function') return global.studentPages().length; } catch (e) {}
    return Array.isArray(global.pages) ? global.pages.length : 0;
  }
  function currentView() {
    var p = currentPage();
    if (!p) return cleanView(null);
    var box = null;
    try {
      var area = global.document.getElementById('viewerArea');
      if (p.wrap && area) box = visibleBox(p.wrap.getBoundingClientRect(), area.getBoundingClientRect());
    } catch (e) { box = null; }
    return cleanView({
      ws: global.currentDocId || '', page: p.num, n: studentPageCount(),
      aspect: p.baseW > 0 ? p.baseH / p.baseW : 1.4142, title: global.docName || '',
      zoom: typeof global.scale === 'number' ? global.scale : 0, box: box
    });
  }

  /* ===================================================================
     STUDENT — asking, waiting, answering, and the teacher's ink
     =================================================================== */
  var S = {
    id: '', ref: null, unsub: null, inkUnsub: null, data: null, status: '', endedBy: '',
    pc: null, handledRev: null, rev: 0, buf: [], docReady: false, seenTc: {},
    mic: null, micOn: true, channel: null, remote: null,
    mirror: null, mirrorTimer: null, lastDraw: 0, lastSig: '',
    strokes: {}, live: {}, laser: null, laserTimer: null,
    heartbeat: null, supervisor: null, lastSnap: 0, liveSince: 0, connectedAt: 0,
    notify: null, panel: null, minimized: false, asking: false, busy: false, gen: 0,
    view: null, soundBlocked: false,
    seenNav: {}, seenNavOrder: [], navNoteAt: 0, navNoteText: '', navNoteTimer: null
  };

  function studentAvailable() {
    var u = user();
    return !!u && !admin() && onWorksheet();
  }

  function syncButton() {
    var b = $('consultBtn');
    if (!b) return;
    var u = user();
    b.hidden = !u || admin();
    var on = !!S.id && (S.status === 'waiting' || S.status === 'live');
    b.classList.toggle('consultOn', on);
    b.textContent = on ? (S.status === 'live' ? '🙋 With ' + teacherName() : '🙋 Waiting…') : '🙋 Consult';
    b.title = on ? 'Your consult with ' + teacherName() : 'Ask ' + teacherName() + ' to join you on this worksheet';
  }

  function onButton() {
    if (!user()) { toast('Sign in to ask ' + teacherName() + ' for help.'); return; }
    if (admin()) { toast('This is the button students press to call you.'); return; }
    if (S.id && (S.status === 'waiting' || S.status === 'live')) { S.minimized = false; renderPanel(); return; }
    if (!onWorksheet()) { toast('Open a worksheet first, so ' + teacherName() + ' can see it.'); return; }
    S.asking = true;
    S.minimized = false;
    renderPanel();
  }

  async function startConsult() {
    if (S.busy) return;
    var u = user(), d = db();
    if (!u || !d) { toast('Study Buddy is still connecting. Try again in a moment.'); return; }
    if (typeof global.lessonCapture !== 'undefined' && global.lessonCapture) {
      toast('Finish the recording first.'); return;
    }
    S.busy = true; S.asking = false;
    var gen = ++S.gen;
    try {
      // The live tutor holds the microphone. A consult with a person
      // replaces a conversation with the machine.
      try { if (typeof global.liveActive === 'function' && global.liveActive() && typeof global.stopLiveTutor === 'function') global.stopLiveTutor(); } catch (e) {}
      // Asked for in the same tap, so the permission prompt is an answer to
      // the button rather than a surprise. Refused is fine: the teacher can
      // still see the page and write on it.
      await openMic();
      if (gen !== S.gen) { stopMic(); return; }
      var ref = d.collection(COLLECTION).doc();
      var view = currentView();
      var ls = studentLevelSubject();
      var t = now();
      var doc = {
        v: 1, status: 'waiting',
        studentUid: u.uid, studentName: studentName(),
        worksheetId: global.currentDocId || '', worksheetName: cleanText(global.docName || '', TITLE_MAX),
        level: ls.level, subject: ls.subject,
        view: view, mic: !!S.mic,
        at: t, seen: t, createdAt: serverStamp(),
        rev: 0, offer: null, answer: null, arev: null, tc: [], sc: []
      };
      await ref.set(doc);
      if (gen !== S.gen) { try { await ref.update({ status: 'cancelled', endedAt: now() }); } catch (e) {} return; }
      S.id = ref.id; S.ref = ref; S.data = doc; S.status = 'waiting'; S.endedBy = '';
      S.view = view; S.strokes = {}; S.live = {}; S.notify = { pending: true };
      ensureMirror();
      startHeartbeat();
      watchOwn();
      watchInk();
      renderPanel(); syncButton();
      usage('consult', cleanText(global.docName || '', 80));
      notifyTeacher(S.id).then(function (result) {
        if (gen !== S.gen) return;
        S.notify = result; renderPanel();
      });
    } catch (e) {
      console.warn('consult: could not be asked for', e);
      toast('Could not reach ' + teacherName() + ' just now: ' + ((e && e.message) || e), 7000);
      if (gen === S.gen) resetStudent(true);
    } finally {
      S.busy = false;
    }
  }

  /* The email. The body carries the consult's id and NOTHING ELSE — the
     server reads everything it puts in the email off the document, and the
     address it sends to is its own constant. */
  async function notifyTeacher(id) {
    var u = user();
    if (!u || !consultIdOk(id)) return { ok: false, code: 'invalid' };
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () { if (controller) controller.abort(); }, NOTIFY_TIMEOUT_MS);
    try {
      if (typeof global.liveAppCheckToken !== 'function') return { ok: false, code: 'app_check' };
      var tokens = await Promise.all([u.getIdToken(), global.liveAppCheckToken()]);
      var res = await global.fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tokens[0], 'X-Firebase-AppCheck': tokens[1] },
        body: JSON.stringify({ consultId: id }),
        signal: controller ? controller.signal : undefined
      });
      var body = null;
      try { body = await res.json(); } catch (e) { body = null; }
      if (res.ok) return { ok: true, code: (body && body.status) || 'queued' };
      return { ok: false, code: (body && body.error && body.error.code) || ('http_' + res.status),
        message: (body && body.error && body.error.message) || '' };
    } catch (e) {
      return { ok: false, code: 'network', message: String((e && e.message) || e) };
    } finally {
      clearTimeout(timer);
    }
  }

  async function openMic() {
    stopMic();
    try {
      if (!global.navigator || !global.navigator.mediaDevices || !global.navigator.mediaDevices.getUserMedia) return null;
      S.mic = await global.navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false
      });
      S.micOn = true;
      return S.mic;
    } catch (e) {
      S.mic = null;
      return null;
    }
  }
  function stopMic() {
    if (S.mic) { try { S.mic.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} }
    S.mic = null;
  }
  function toggleMic() {
    S.micOn = !S.micOn;
    if (S.mic) S.mic.getAudioTracks().forEach(function (t) { t.enabled = S.micOn; });
    renderPanel();
  }

  function startHeartbeat() {
    stopHeartbeat();
    S.heartbeat = setInterval(function () {
      if (!S.ref || !(S.status === 'waiting' || S.status === 'live')) return;
      S.ref.update({ seen: now() }).catch(function () {});
    }, HEARTBEAT_MS);
    S.supervisor = setInterval(supervise, 1000);
  }
  function stopHeartbeat() {
    if (S.heartbeat) clearInterval(S.heartbeat);
    if (S.supervisor) clearInterval(S.supervisor);
    S.heartbeat = null; S.supervisor = null;
  }

  function watchOwn() {
    if (S.unsub) { try { S.unsub(); } catch (e) {} }
    var id = S.id, ref = S.ref;
    S.unsub = ref.onSnapshot(function (snap) {
      if (S.id !== id) return;
      if (!snap.exists) { finishStudent('ended', 'teacher'); return; }
      onOwn(snap.data() || {});
    }, function (err) { console.warn('consult: lost the listener', err); });
  }

  function watchInk() {
    if (S.inkUnsub) { try { S.inkUnsub(); } catch (e) {} }
    var id = S.id;
    S.inkUnsub = S.ref.collection('ink').onSnapshot(function (qs) {
      if (S.id !== id) return;
      var next = {};
      (qs.docs || []).forEach(function (d) {
        var s = cleanStroke(Object.assign({}, d.data() || {}, { id: d.id }));
        if (s) next[s.id] = s;
      });
      S.strokes = next;
      // A committed stroke replaces its own live preview.
      Object.keys(S.live).forEach(function (k) { if (next[k]) delete S.live[k]; });
      renderStudentInk();
    }, function (err) { console.warn('consult: ink listener', err); });
  }

  async function onOwn(data) {
    S.data = data;
    var was = S.status;
    S.status = data.status || '';
    if (S.status === 'cancelled' || S.status === 'ended') {
      finishStudent(S.status, data.endedBy || '');
      return;
    }
    if (S.status === 'waiting' && was === 'live') {
      // The teacher's tab went away. Their writing stays; the call does not.
      closePc();
      S.handledRev = null;
    }
    if (needsAnswer(data, S.handledRev)) await answer(data);
    // The document's copy of a nav, for a call whose channel never opened
    // (a school network that blocks WebRTC). A stale one is never obeyed.
    if (S.status === 'live' && data.nav) {
      var nv = cleanNav(data.nav);
      if (nv && navFresh(nv, now())) applyNav(nv);
      else if (nv) navSeen(nv.id);
    }
    var pc = S.pc;
    if (pc && pc.remoteDescription && Number(data.rev) === S.rev) {
      unpackCandidates(data.tc, S.rev, S.seenTc).forEach(function (c) {
        pc.addIceCandidate(c).catch(function () {});
      });
    }
    renderPanel(); syncButton();
  }

  async function answer(data) {
    var Peer = RTC();
    var rev = Number(data.rev);
    S.handledRev = rev;
    closePc();
    S.rev = rev; S.seenTc = {}; S.buf = []; S.docReady = false; S.liveSince = now(); S.connectedAt = 0;
    if (!Peer) return;
    var pc;
    try { pc = new Peer({ iceServers: ice() }); } catch (e) { return; }
    S.pc = pc;
    pc.onicecandidate = function (ev) {
      if (S.pc !== pc || !ev.candidate) return;
      var s = packCandidate(ev.candidate, rev);
      if (!s) return;
      if (S.docReady) S.ref.update({ sc: arrayUnion([s]) }).catch(function () {});
      else S.buf.push(s);
    };
    pc.ontrack = function (ev) {
      if (S.pc !== pc) return;
      var stream = (ev.streams && ev.streams[0]) || null;
      if (!stream) {
        stream = S.remote && S.remote.getTracks ? S.remote : new global.MediaStream();
        try { stream.addTrack(ev.track); } catch (e) {}
      }
      S.remote = stream;
      renderPanel();
      playRemote();
    };
    pc.ondatachannel = function (ev) {
      if (S.pc !== pc) return;
      bindStudentChannel(ev.channel);
    };
    pc.onconnectionstatechange = function () {
      if (S.pc !== pc) return;
      if (pc.connectionState === 'connected') { S.connectedAt = now(); tuneSender(pc); }
      renderPanel();
    };
    try {
      await pc.setRemoteDescription(data.offer);
      var mirrorTrack = ensureMirror();
      var micTrack = S.mic ? S.mic.getAudioTracks()[0] : null;
      (pc.getTransceivers ? pc.getTransceivers() : []).forEach(function (tr) {
        var kind = tr.receiver && tr.receiver.track ? tr.receiver.track.kind : '';
        var track = kind === 'video' ? mirrorTrack : kind === 'audio' ? micTrack : null;
        try {
          if (track) { tr.sender.replaceTrack(track); tr.direction = 'sendrecv'; }
          else tr.direction = 'recvonly';
        } catch (e) {}
      });
      var ans = await pc.createAnswer();
      await pc.setLocalDescription(ans);
      if (S.pc !== pc) return;
      var buf = S.buf.slice(); S.buf = [];
      await S.ref.update({ answer: sdpOf(pc.localDescription || ans), arev: rev, sc: buf, seen: now(), mic: !!micTrack });
      S.docReady = true;
      if (S.buf.length) {
        var late = S.buf.slice(); S.buf = [];
        S.ref.update({ sc: arrayUnion(late) }).catch(function () {});
      }
      unpackCandidates(data.tc, rev, S.seenTc).forEach(function (c) { pc.addIceCandidate(c).catch(function () {}); });
      sendView(true);
    } catch (e) {
      console.warn('consult: could not answer', e);
    }
  }

  function tuneSender(pc) {
    try {
      pc.getSenders().forEach(function (sender) {
        if (!sender.track || sender.track.kind !== 'video' || !sender.getParameters) return;
        var params = sender.getParameters();
        if (!params.encodings || !params.encodings.length) params.encodings = [{}];
        params.encodings[0].maxBitrate = VIDEO_BITRATE;
        try { params.degradationPreference = 'maintain-resolution'; } catch (e) {}
        sender.setParameters(params).catch(function () {});
      });
    } catch (e) {}
  }

  function bindStudentChannel(ch) {
    S.channel = ch;
    ch.onopen = function () { sendView(true); };
    ch.onmessage = function (ev) {
      var m = parseMessage(ev.data);
      if (!m) return;
      if (m.t === 'ink') {
        if (!S.strokes[m.stroke.id] || !m.stroke.done) S.live[m.stroke.id] = m.stroke;
        renderStudentInk();
      } else if (m.t === 'drop') {
        delete S.live[m.id]; delete S.strokes[m.id]; renderStudentInk();
      } else if (m.t === 'clear') {
        S.live = {}; S.strokes = {}; renderStudentInk();
      } else if (m.t === 'laser') {
        S.laser = { ws: m.ws, page: m.page, x: m.x, y: m.y, at: now() };
        renderLaser();
      } else if (m.t === 'nav') {
        applyNav(m);
      }
    };
  }

  /* ---------------- The teacher moves the page ----------------
     The ONE door a nav comes in by, from the channel and the document
     alike. It is obeyed only while the call is live, only on the worksheet
     the teacher is looking at, and only once: the id is remembered, so the
     copy that arrives on the document a moment after the channel's is
     dropped rather than zooming the page a second time. */
  var NAV_SEEN_MAX = 80;
  function navSeen(id) {
    if (S.seenNav[id]) return true;
    S.seenNav[id] = 1;
    S.seenNavOrder.push(id);
    while (S.seenNavOrder.length > NAV_SEEN_MAX) delete S.seenNav[S.seenNavOrder.shift()];
    return false;
  }
  function pageByNum(n) {
    var list = Array.isArray(global.pages) ? global.pages : [];
    for (var i = 0; i < list.length; i++) if (list[i] && list[i].num === n) return list[i];
    return null;
  }
  function studentPageNums() {
    var list = null;
    try { if (typeof global.studentPages === 'function') list = global.studentPages(); } catch (e) { list = null; }
    if (!Array.isArray(list)) list = Array.isArray(global.pages) ? global.pages : [];
    return list.map(function (p) { return p && p.num; }).filter(function (n) { return typeof n === 'number'; });
  }
  function applyNav(m) {
    if (!m || !m.id || navSeen(m.id)) return false;
    if (S.status !== 'live' || !onWorksheet()) return false;
    if (m.ws && m.ws !== (global.currentDocId || '')) return false;
    var area = global.document.getElementById('viewerArea');
    if (!area) return false;
    var ar = area.getBoundingClientRect();
    var cur = currentPage();
    var p = null, r = null;
    try {
      if (m.op === 'zoom') {
        var cx = ar.left + ar.width / 2, cy = ar.top + ar.height / 2;
        if (m.page) {
          p = pageByNum(m.page);
          if (p && p.wrap) {
            r = p.wrap.getBoundingClientRect();
            var px = r.left + m.x * r.width, py = r.top + m.y * r.height;
            // Zoom about the teacher's spot only when it is on the child's
            // screen; zooming about a point off the screen throws the page.
            if (px >= ar.left && px <= ar.right && py >= ar.top && py <= ar.bottom) { cx = px; cy = py; }
          }
        }
        if (typeof global.zoomAt === 'function') global.zoomAt(cx, cy, m.f);
        else if (typeof global.zoomBy === 'function') global.zoomBy(m.f);
        else return false;
      } else if (m.op === 'fit') {
        if (typeof global.fitWidth !== 'function') return false;
        global.fitWidth();
      } else if (m.op === 'page') {
        var next = stepPage(studentPageNums(), cur ? cur.num : 0, m.step);
        p = next ? pageByNum(next) : null;
        if (!p || !p.wrap) { navNote(m.step > 0 ? 'That is the last page.' : 'That is the first page.'); return false; }
        r = p.wrap.getBoundingClientRect();
        area.scrollTop += r.top - ar.top - 8;
      } else if (m.op === 'center') {
        p = pageByNum(m.page);
        if (!p || !p.wrap) return false;
        r = p.wrap.getBoundingClientRect();
        area.scrollLeft += (r.left + m.x * r.width) - (ar.left + ar.width / 2);
        area.scrollTop += (r.top + m.y * r.height) - (ar.top + ar.height / 2);
      } else if (m.op === 'pan') {
        p = cur;
        if (!p || !p.wrap) return false;
        r = p.wrap.getBoundingClientRect();
        area.scrollLeft += m.dx * r.width;
        area.scrollTop += m.dy * r.height;
      } else return false;
    } catch (e) { return false; }
    navNote();
    drawMirror(true);
    sendView(true);
    return true;
  }

  /* A page that moves by itself under a child's pencil reads as the app
     going wrong, so it SAYS who moved it — briefly, and without a timer
     per nav: one note, re-armed. */
  function navNote(text) {
    S.navNoteAt = now();
    S.navNoteText = text || '';
    var host = S.panel && S.panel.querySelector('.consultNav');
    if (host) { host.textContent = text || (teacherName() + ' moved your page'); host.hidden = false; }
    if (S.navNoteTimer) clearTimeout(S.navNoteTimer);
    S.navNoteTimer = setTimeout(function () {
      S.navNoteTimer = null;
      var h = S.panel && S.panel.querySelector('.consultNav');
      if (h) h.hidden = true;
    }, NAV_NOTE_MS);
  }

  function sendView(force) {
    var v = currentView();
    var changed = !sameView(v, S.view) || !sameZoom(v, S.view);
    S.view = v;
    if (S.channel && S.channel.readyState === 'open') {
      try { S.channel.send(JSON.stringify({ t: 'view', view: v })); } catch (e) {}
    }
    if ((changed || force) && S.ref && (S.status === 'waiting' || S.status === 'live')) {
      S.ref.update({ view: v }).catch(function () {});
    }
  }

  function closePc() {
    var pc = S.pc;
    S.pc = null;
    if (S.channel) { try { S.channel.onmessage = S.channel.onopen = null; S.channel.close(); } catch (e) {} }
    S.channel = null;
    if (pc) {
      try { pc.ontrack = pc.onicecandidate = pc.ondatachannel = pc.onconnectionstatechange = null; } catch (e) {}
      try { pc.close(); } catch (e) {}
    }
    S.remote = null;
    S.live = {};
  }

  function playRemote() {
    var v = S.panel && S.panel.querySelector('video.consultCamVideo');
    if (!v || !S.remote) return;
    if (v.srcObject !== S.remote) v.srcObject = S.remote;
    var p = null;
    try { p = v.play(); } catch (e) { p = null; }
    if (p && p.catch) p.then(function () { S.soundBlocked = false; renderSoundBtn(); }, function () { S.soundBlocked = true; renderSoundBtn(); });
  }
  function renderSoundBtn() {
    var b = S.panel && S.panel.querySelector('.consultSound');
    if (b) b.hidden = !S.soundBlocked;
  }

  /* What the supervisor watches, once a second: the teacher who stopped
     beating, and the connection that never formed. */
  function supervise() {
    if (!S.ref) return;
    var t = now();
    if (S.status === 'live') {
      var connected = !!(S.pc && S.pc.connectionState === 'connected');
      var tseen = stampMs(S.data && S.data.tseen);
      if (!connected && tseen && t - tseen > TEACHER_GONE_MS) {
        S.ref.update({ status: 'waiting', teacherLeft: true, offer: null, answer: null, tc: [], sc: [] }).catch(function () {});
        return;
      }
      var since = S.liveSince || t;
      if (!connected && t - since > FALLBACK_AFTER_MS && t - S.lastSnap > SNAP_EVERY_MS) {
        S.lastSnap = t;
        pushSnapshot();
      }
    }
    sendView(false);
  }

  function pushSnapshot() {
    if (!S.ref || !S.mirror || !S.mirror.canvas) return;
    try {
      drawMirror(true);
      var src = S.mirror.canvas;
      var k = Math.min(1, SNAP_LONG / Math.max(src.width, src.height));
      var c = global.document.createElement('canvas');
      c.width = Math.max(2, Math.round(src.width * k)); c.height = Math.max(2, Math.round(src.height * k));
      c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
      var url = c.toDataURL('image/jpeg', SNAP_QUALITY);
      if (url.length > SNAP_MAX_CHARS) url = c.toDataURL('image/jpeg', 0.4);
      if (url.length > SNAP_MAX_CHARS) return;
      S.ref.collection('frames').doc('latest').set({ img: url, view: S.view || currentView(), at: now() }).catch(function () {});
    } catch (e) { /* a tainted canvas or a full quota is a missed frame, nothing more */ }
  }

  /* ---------------- The page mirror ---------------- */
  function ensureMirror() {
    if (S.mirror && S.mirror.track && S.mirror.track.readyState !== 'ended') return S.mirror.track;
    var c = global.document.createElement('canvas');
    var size = mirrorSize(0, 0);
    c.width = size.w; c.height = size.h;
    var ctx = c.getContext('2d');
    S.mirror = { canvas: c, ctx: ctx, stream: null, track: null, pageNum: 0 };
    drawMirror(true);
    try {
      if (c.captureStream) {
        S.mirror.stream = c.captureStream(MIRROR_FPS);
        S.mirror.track = S.mirror.stream.getVideoTracks()[0] || null;
        if (S.mirror.track && 'contentHint' in S.mirror.track) S.mirror.track.contentHint = 'detail';
      }
    } catch (e) { S.mirror.track = null; }
    if (S.mirrorTimer) clearInterval(S.mirrorTimer);
    S.mirrorTimer = setInterval(function () { drawMirror(false); }, MIRROR_MS);
    return S.mirror.track;
  }

  function stopMirror() {
    if (S.mirrorTimer) clearInterval(S.mirrorTimer);
    S.mirrorTimer = null;
    if (S.mirror && S.mirror.stream) { try { S.mirror.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} }
    S.mirror = null;
  }

  function annSignature(p) {
    var anns = Array.isArray(global.annotations) ? global.annotations : [];
    var n = 0, pts = 0, last = '';
    for (var i = 0; i < anns.length; i++) {
      var a = anns[i];
      if (!a || a.page !== p.num) continue;
      n++;
      if (a.points) pts += a.points.length;
      last = a.id + ':' + (a.x || 0) + ',' + (a.y || 0) + ',' + (a.w || 0) + ',' + (a.h || 0) + ':' + String(a.text || '').length;
    }
    return n + '|' + pts + '|' + last;
  }

  function drawMirror(force) {
    var m = S.mirror;
    if (!m) return;
    var p = currentPage();
    var ctx = m.ctx, c = m.canvas;
    var t = now();
    if (!p) {
      if (!force && m.pageNum === 0 && t - S.lastDraw < MIRROR_FORCE_MS) return;
      var sz = mirrorSize(0, 0, 900);
      if (c.width !== sz.w || c.height !== sz.h) { c.width = sz.w; c.height = sz.h; }
      ctx.fillStyle = '#F7F6F4'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.fillStyle = '#55554F';
      ctx.font = '28px "Century Gothic", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(studentName() + ' is not on a worksheet', c.width / 2, c.height / 2 - 10);
      ctx.font = '20px "Century Gothic", sans-serif';
      ctx.fillText('The page will appear here when they open one.', c.width / 2, c.height / 2 + 26);
      m.pageNum = 0; S.lastDraw = t;
      return;
    }
    var vis = null;
    try {
      var area = $('viewerArea');
      if (area && p.wrap && p.wrap.getBoundingClientRect) vis = visibleBox(p.wrap.getBoundingClientRect(), area.getBoundingClientRect());
    } catch (e) { vis = null; }
    var sig = p.num + '|' + annSignature(p) + '|' + (vis ? vis.join(',') : '') + '|' + (p.canvas && p.canvas.width);
    if (!force && sig === S.lastSig && t - S.lastDraw < MIRROR_FORCE_MS) return;
    S.lastSig = sig; S.lastDraw = t;
    var size = mirrorSize(p.baseW, p.baseH);
    if (c.width !== size.w || c.height !== size.h) { c.width = size.w; c.height = size.h; }
    ctx.save();
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, c.width, c.height);
    if (p.canvas && p.canvas.width && p.canvas.height) {
      try { ctx.drawImage(p.canvas, 0, 0, c.width, c.height); } catch (e) {}
    } else if (typeof global.ensurePageRaster === 'function') {
      try { global.ensurePageRaster(p); } catch (e) {}
    }
    try {
      if (typeof global.syncActiveTextEditValue === 'function' && t - (S.lastTextSync || 0) > 900) {
        S.lastTextSync = t; global.syncActiveTextEditValue();
      }
    } catch (e) {}
    try {
      if (typeof global.drawAnnsOnCtx === 'function') global.drawAnnsOnCtx(ctx, c.width / p.baseW, c.height / p.baseH, global.annotations || [], p.num);
    } catch (e) {}
    // The part of the page on the student's screen: the rest is dimmed a
    // little and the window is framed in teal, the colour the ruler uses,
    // because it is the app's mark and not the paper's.
    if (vis && (vis[0] > 0.001 || vis[1] > 0.001 || vis[2] < 0.999 || vis[3] < 0.999)) {
      var x0 = vis[0] * c.width, y0 = vis[1] * c.height, x1 = vis[2] * c.width, y1 = vis[3] * c.height;
      ctx.fillStyle = 'rgba(26,26,26,0.10)';
      ctx.fillRect(0, 0, c.width, y0);
      ctx.fillRect(0, y1, c.width, c.height - y1);
      ctx.fillRect(0, y0, x0, y1 - y0);
      ctx.fillRect(x1, y0, c.width - x1, y1 - y0);
      ctx.strokeStyle = 'rgba(0,137,123,0.9)';
      ctx.lineWidth = Math.max(3, c.width / 300);
      ctx.strokeRect(x0 + 1, y0 + 1, Math.max(0, x1 - x0 - 2), Math.max(0, y1 - y0 - 2));
    }
    ctx.restore();
    m.pageNum = p.num;
  }

  /* ---------------- The teacher's ink on the student's page ---------------- */
  function studentStrokes() {
    var all = {};
    Object.keys(S.strokes).forEach(function (k) { all[k] = S.strokes[k]; });
    Object.keys(S.live).forEach(function (k) { all[k] = S.live[k]; });
    return Object.keys(all).map(function (k) { return all[k]; })
      .sort(function (a, b) { return (a.at || 0) - (b.at || 0); });
  }

  function inkLayer(p, make) {
    if (!p || !p.wrap) return null;
    var layer = p.wrap.querySelector ? p.wrap.querySelector('svg.consultInk') : null;
    if (!layer && make) {
      layer = svgEl('svg', { viewBox: '0 0 ' + p.baseW + ' ' + p.baseH, preserveAspectRatio: 'none', 'aria-hidden': 'true' });
      layer.setAttribute('class', 'consultInk');
      p.wrap.appendChild(layer);
    }
    return layer;
  }

  function renderStudentInk() {
    var list = Array.isArray(global.pages) ? global.pages : [];
    var ws = global.currentDocId || '';
    var strokes = studentStrokes();
    list.forEach(function (p) {
      var mine = strokes.filter(function (s) { return s.ws === ws && s.page === p.num; });
      var layer = inkLayer(p, mine.length > 0);
      if (!layer) return;
      while (layer.firstChild) layer.removeChild(layer.firstChild);
      mine.forEach(function (s) {
        layer.appendChild(svgEl('path', {
          d: strokePathD(s.pts, p.baseW, p.baseH), fill: 'none', stroke: s.c,
          'stroke-width': String(Math.max(0.5, s.w * p.baseW)), 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
          'data-stroke': s.id
        }));
      });
    });
    renderLaser();
  }

  function renderLaser() {
    var list = Array.isArray(global.pages) ? global.pages : [];
    var L = S.laser, ws = global.currentDocId || '';
    list.forEach(function (p) {
      var layer = inkLayer(p, !!(L && L.ws === ws && L.page === p.num));
      if (!layer) return;
      var old = layer.querySelector ? layer.querySelector('[data-laser]') : null;
      if (old) layer.removeChild(old);
      if (!L || L.ws !== ws || L.page !== p.num || now() - L.at > LASER_MS) return;
      var r = Math.max(4, p.baseW * 0.012);
      var g = svgEl('g', { 'data-laser': '1' });
      g.appendChild(svgEl('circle', { cx: String(L.x * p.baseW), cy: String(L.y * p.baseH), r: String(r * 1.9), fill: 'rgba(216,27,96,0.18)' }));
      g.appendChild(svgEl('circle', { cx: String(L.x * p.baseW), cy: String(L.y * p.baseH), r: String(r), fill: '#D81B60', 'class': 'consultLaser' }));
      layer.appendChild(g);
    });
    if (S.laserTimer) clearTimeout(S.laserTimer);
    if (L) S.laserTimer = setTimeout(function () { if (S.laser === L) { S.laser = null; renderLaser(); } }, LASER_MS + 50);
  }

  function clearStudentInk() {
    S.strokes = {}; S.live = {}; S.laser = null;
    var list = Array.isArray(global.pages) ? global.pages : [];
    list.forEach(function (p) {
      var layer = inkLayer(p, false);
      if (layer && layer.parentNode) layer.parentNode.removeChild(layer);
    });
  }

  /* ---------------- The student's panel ---------------- */
  function panelRoot() {
    if (S.panel && S.panel.isConnected) return S.panel;
    var root = el('div', 'consultPanel');
    root.id = 'consultPanel';
    root.setAttribute('role', 'region');
    root.setAttribute('aria-label', 'Consult with ' + teacherName());
    global.document.body.appendChild(root);
    S.panel = root;
    return root;
  }

  /* The panel can be DRAGGED by its head. On a phone it covers the bottom
     of the screen, which is very often exactly where the question is; a
     card that cannot be moved is a card the child has to minimise just to
     read their own page. The position is kept for the visit (S.panelPos)
     and pulled back onto the screen on every render and every resize, so a
     tablet turned on its side never leaves the panel off the edge. */
  function clampPanelPos(pos, w, h, vw, vh, margin) {
    if (!pos) return null;
    var m = margin == null ? 8 : margin;
    var x = Number(pos.x), y = Number(pos.y);
    if (!isFinite(x) || !isFinite(y)) return null;
    var maxX = Math.max(m, vw - w - m), maxY = Math.max(m, vh - h - m);
    return { x: Math.round(Math.min(maxX, Math.max(m, x))), y: Math.round(Math.min(maxY, Math.max(m, y))) };
  }

  function viewportSize() {
    var vv = global.visualViewport;
    return {
      w: (vv && vv.width) || global.innerWidth || 0,
      h: (vv && vv.height) || global.innerHeight || 0
    };
  }

  function placePanel(root) {
    if (!root || !S.panelPos) return;
    var r = root.getBoundingClientRect ? root.getBoundingClientRect() : { width: 0, height: 0 };
    var vp = viewportSize();
    var p = clampPanelPos(S.panelPos, r.width || 0, r.height || 0, vp.w, vp.h, 8);
    if (!p) { S.panelPos = null; return; }
    S.panelPos = p;
    root.style.left = p.x + 'px';
    root.style.top = p.y + 'px';
    root.style.right = 'auto';
    root.style.bottom = 'auto';
    root.classList.add('consultMoved');
  }

  function bindPanelDrag(root, head) {
    head.classList.add('consultDrag');
    head.addEventListener('pointerdown', function (e) {
      if (e.button > 0) return;
      // A tap on a button in the head is a button press, never a drag.
      if (e.target && e.target.closest && e.target.closest('button')) return;
      var r = root.getBoundingClientRect();
      var drag = { id: e.pointerId, ox: e.clientX - r.left, oy: e.clientY - r.top, sx: e.clientX, sy: e.clientY, moved: false };
      try { head.setPointerCapture(e.pointerId); } catch (err) {}
      function move(ev) {
        if (ev.pointerId !== drag.id) return;
        if (!drag.moved && Math.abs(ev.clientX - drag.sx) + Math.abs(ev.clientY - drag.sy) < 6) return;
        drag.moved = true;
        S.panelPos = { x: ev.clientX - drag.ox, y: ev.clientY - drag.oy };
        placePanel(root);
        ev.preventDefault();
      }
      function up(ev) {
        if (ev.pointerId !== drag.id) return;
        head.removeEventListener('pointermove', move);
        head.removeEventListener('pointerup', up);
        head.removeEventListener('pointercancel', up);
        head.removeEventListener('lostpointercapture', up);
      }
      head.addEventListener('pointermove', move);
      head.addEventListener('pointerup', up);
      head.addEventListener('pointercancel', up);
      head.addEventListener('lostpointercapture', up);
    });
    if (!S.panelResizeBound && global.addEventListener) {
      S.panelResizeBound = true;
      var again = function () { if (S.panel) placePanel(S.panel); };
      global.addEventListener('resize', again);
      global.addEventListener('orientationchange', again);
      if (global.visualViewport && global.visualViewport.addEventListener) global.visualViewport.addEventListener('resize', again);
    }
  }

  function renderPanel() {
    if (!global.document || !global.document.body) return;
    var showing = S.asking || !!S.id;
    if (!showing) {
      if (S.panel && S.panel.parentNode) S.panel.parentNode.removeChild(S.panel);
      S.panel = null;
      return;
    }
    var root = panelRoot();
    var keepVideo = root.querySelector('video.consultCamVideo');
    while (root.firstChild) root.removeChild(root.firstChild);
    root.classList.toggle('consultMin', !!S.minimized && S.status === 'live');

    var head = el('div', 'consultHead');
    head.appendChild(el('span', 'consultIcon', '🙋'));
    var title = el('div', 'consultTitle', S.asking ? 'Ask ' + teacherName() + ' for help?' : (statusWords(S.status, S.endedBy) || 'Consult'));
    head.appendChild(title);
    if (S.status === 'live') {
      head.appendChild(btn(S.minimized ? '▢' : '–', 'btnGhost consultMinBtn', function () { S.minimized = !S.minimized; renderPanel(); },
        S.minimized ? 'Show the video' : 'Make the window smaller'));
    }
    root.appendChild(head);
    bindPanelDrag(root, head);
    placePanel(root);

    if (S.asking) {
      root.appendChild(el('p', 'consultText', teacherName() + ' will get an email and a pop-up. When he joins, he can see this page, write on it to show you, and talk to you on video.'));
      var row = el('div', 'consultRow');
      row.appendChild(btn('Ask for help', 'btnPrimary', function () { startConsult(); }, 'Ask ' + teacherName() + ' to join'));
      row.appendChild(btn('Not now', 'btnGhost', function () { S.asking = false; renderPanel(); }));
      root.appendChild(row);
      return;
    }

    if (S.status === 'waiting') {
      var waitedFor = S.data && stampMs(S.data.at) ? consultAgo(now() - stampMs(S.data.at)) : '';
      root.appendChild(el('p', 'consultText', S.data && S.data.teacherLeft
        ? teacherName() + '’s connection dropped. Stay here — he can join again.'
        : 'Keep working — ' + teacherName() + ' will appear here when he joins.' + (waitedFor ? ' (asked ' + waitedFor + ')' : '')));
      var note = S.notify && S.notify.pending ? 'Sending ' + teacherName() + ' an email…' : notifyWords(S.notify);
      if (note) root.appendChild(el('p', 'consultNote', note));
      if (!S.mic) root.appendChild(el('p', 'consultNote', '🎤 Your microphone is off, so ' + teacherName() + ' will not hear you. He can still see your page and talk to you.'));
      var r2 = el('div', 'consultRow');
      r2.appendChild(btn('Cancel', 'btnGhost', function () { endStudent('cancelled'); }, 'Cancel the consult'));
      root.appendChild(r2);
      return;
    }

    if (S.status === 'live') {
      var cam = el('div', 'consultCam');
      var v = keepVideo || el('video', 'consultCamVideo');
      v.autoplay = true; v.setAttribute('playsinline', ''); v.playsInline = true;
      cam.appendChild(v);
      var hasVideo = !!(S.remote && S.remote.getVideoTracks && S.remote.getVideoTracks().length);
      if (!hasVideo) cam.appendChild(el('div', 'consultCamNone', S.pc && S.pc.connectionState === 'connected'
        ? teacherName() + '’s camera is off' : 'Connecting to ' + teacherName() + '…'));
      var sound = btn('🔊 Tap to hear ' + teacherName(), 'btnPrimary consultSound', function () { S.soundBlocked = false; playRemote(); renderSoundBtn(); });
      sound.hidden = !S.soundBlocked;
      cam.appendChild(sound);
      root.appendChild(cam);
      // Where the teacher's own hand on THIS screen is announced — "Mr Chung
      // zoomed in" — so a page that moved by itself is never a mystery.
      var navLine = el('p', 'consultNote consultNav');
      navLine.setAttribute('aria-live', 'polite');
      // The panel is rebuilt on every change of state, and a nav changes the
      // view the panel describes — so a note that is still fresh is drawn
      // again rather than lost to the very rebuild the nav caused.
      var fresh = S.navNoteAt && now() - S.navNoteAt < NAV_NOTE_MS;
      navLine.textContent = fresh ? (S.navNoteText || (teacherName() + ' moved your page')) : '';
      navLine.hidden = !fresh;
      root.appendChild(navLine);
      var state = S.pc ? S.pc.connectionState : '';
      if (state && state !== 'connected') {
        root.appendChild(el('p', 'consultNote', state === 'failed'
          ? 'The video could not connect on this network. ' + teacherName() + ' can still see your page and write on it.'
          : 'Connecting…'));
      }
      var r3 = el('div', 'consultRow');
      if (S.mic) r3.appendChild(btn(S.micOn ? '🎤 Mute me' : '🎤 Unmute me', 'btnGhost', toggleMic, S.micOn ? 'Mute your microphone' : 'Unmute your microphone'));
      r3.appendChild(btn('End', 'btnGhost consultEnd', function () { endStudent('ended'); }, 'End the consult'));
      root.appendChild(r3);
      if (S.remote && v.srcObject !== S.remote) playRemote();
      return;
    }

    // Ended or cancelled. The teacher's writing STAYS on the page until the
    // student clears it — it is guidance to work from, not a call artefact.
    var anyInk = Object.keys(S.strokes).length > 0;
    if (anyInk) root.appendChild(el('p', 'consultText', teacherName() + '’s writing stays on your page until you clear it. It is not part of your answer and it is never marked.'));
    var r4 = el('div', 'consultRow');
    if (anyInk) r4.appendChild(btn('Clear ' + teacherName() + '’s writing', 'btnGhost', function () { resetStudent(false); }));
    r4.appendChild(btn(anyInk ? 'Keep it' : 'Close', 'btnGhost', function () {
      if (anyInk) { S.panelClosed = true; root.hidden = true; } else resetStudent(false);
    }));
    root.appendChild(r4);
  }

  async function endStudent(status) {
    var ref = S.ref;
    if (ref) {
      try {
        await ref.update({ status: status, endedBy: 'student', endedAt: now(), offer: null, answer: null, tc: [], sc: [] });
      } catch (e) { /* the listener below still ends it locally */ }
    }
    finishStudent(status, 'student');
  }

  /* The call is over: the connection, the microphone, the mirror and the
     listeners all come down. The ink is KEPT (see the ended panel). */
  function finishStudent(status, endedBy) {
    if (S.unsub) { try { S.unsub(); } catch (e) {} }
    if (S.inkUnsub) { try { S.inkUnsub(); } catch (e) {} }
    S.unsub = null; S.inkUnsub = null;
    stopHeartbeat();
    closePc();
    stopMic();
    stopMirror();
    S.status = status; S.endedBy = endedBy || '';
    S.handledRev = null;
    renderStudentInk();
    renderPanel(); syncButton();
    if (status === 'cancelled' && !Object.keys(S.strokes).length) resetStudent(false);
  }

  function resetStudent(silent) {
    S.gen++;
    if (S.unsub) { try { S.unsub(); } catch (e) {} }
    if (S.inkUnsub) { try { S.inkUnsub(); } catch (e) {} }
    S.unsub = null; S.inkUnsub = null;
    stopHeartbeat(); closePc(); stopMic(); stopMirror();
    clearStudentInk();
    S.id = ''; S.ref = null; S.data = null; S.status = ''; S.endedBy = ''; S.asking = false;
    if (S.navNoteTimer) { clearTimeout(S.navNoteTimer); S.navNoteTimer = null; }
    S.seenNav = {}; S.seenNavOrder = [];
    S.notify = null; S.minimized = false; S.panelClosed = false; S.view = null; S.panelPos = null;
    renderPanel(); syncButton();
    if (!silent) { /* nothing more to say */ }
  }

  /* The student's tab is going away: a consult nobody is in is not a pop-up
     the teacher should still be shown. Best effort — a write in `pagehide`
     may never land, and the heartbeat's silence covers that case. */
  function studentPageHide() {
    if (S.ref && (S.status === 'waiting' || S.status === 'live')) {
      try { S.ref.update({ status: 'ended', endedBy: 'student', endedAt: now(), offer: null, answer: null, tc: [], sc: [] }); } catch (e) {}
    }
  }

  /* ===================================================================
     TEACHER — the consult room
     =================================================================== */
  var T = {
    id: '', ref: null, unsub: null, inkUnsub: null, frameUnsub: null, data: null,
    pc: null, rev: 0, buf: [], docReady: false, seenSc: {}, channel: null,
    local: null, micOn: true, camOn: true, remote: null,
    view: null, strokes: {}, order: [], drawing: null, lastSend: 0, lastLaser: 0,
    color: INK_COLORS[0].c, width: INK_WIDTHS[1].w, mode: 'pen',
    heartbeat: null, root: null, snap: null, gen: 0, ending: false, connectedOnce: false
  };

  async function openRoom(id) {
    if (!admin()) { toast('Only the teacher can join a consult.'); return false; }
    if (!consultIdOk(id)) { toast('That consult link is not right.'); return false; }
    if (T.id === id && T.root) { T.root.hidden = false; return true; }
    if (T.id) await leaveRoom(false);
    var d = db();
    if (!d) { toast('Study Buddy is still connecting. Try the link again in a moment.'); return false; }
    var gen = ++T.gen;
    var ref = d.collection(COLLECTION).doc(id);
    var snap;
    try { snap = await ref.get(); } catch (e) { toast('Could not open the consult: ' + ((e && e.message) || e), 7000); return false; }
    if (gen !== T.gen) return false;
    if (!snap.exists) { toast('That consult is no longer there.', 6000); return false; }
    var data = snap.data() || {};
    if (data.status === 'ended' || data.status === 'cancelled') {
      toast(cleanText(data.studentName, NAME_MAX) + (data.status === 'cancelled' ? ' cancelled this consult.' : '’s consult has already ended.'), 7000);
      return false;
    }
    T.id = id; T.ref = ref; T.data = data; T.view = cleanView(data.view);
    T.strokes = {}; T.order = []; T.ending = false; T.connectedOnce = false;
    buildRoom();
    renderRoom();
    await openLocalMedia();
    if (gen !== T.gen) return false;
    renderSelf();
    watchRoom();
    await negotiate();
    T.heartbeat = setInterval(function () {
      if (T.ref) T.ref.update({ tseen: now() }).catch(function () {});
    }, HEARTBEAT_MS);
    return true;
  }

  async function openLocalMedia() {
    stopLocal();
    var md = global.navigator && global.navigator.mediaDevices;
    if (!md || !md.getUserMedia) { T.local = null; return; }
    try {
      T.local = await md.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
    } catch (e) {
      try { T.local = await md.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false }); }
      catch (e2) { T.local = null; }
    }
    T.micOn = true; T.camOn = !!(T.local && T.local.getVideoTracks().length);
  }
  function stopLocal() {
    if (T.local) { try { T.local.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} }
    T.local = null;
  }

  async function negotiate() {
    if (T.negotiating) return;
    T.negotiating = true;
    try { await negotiateOnce(); } finally { T.negotiating = false; }
  }

  async function negotiateOnce() {
    var Peer = RTC();
    closeTeacherPc();
    if (!Peer || !T.ref) { renderRoom(); return; }
    var rev = Math.max(Number(T.data && T.data.rev) || 0, T.rev) + 1;
    T.rev = rev; T.buf = []; T.docReady = false; T.seenSc = {};
    var pc;
    try { pc = new Peer({ iceServers: ice() }); } catch (e) { renderRoom(); return; }
    T.pc = pc;
    var audio = T.local ? T.local.getAudioTracks()[0] : null;
    var video = T.local ? T.local.getVideoTracks()[0] : null;
    try {
      pc.addTransceiver(audio || 'audio', audio ? { direction: 'sendrecv', streams: [T.local] } : { direction: 'recvonly' });
      pc.addTransceiver(video || 'video', video ? { direction: 'sendrecv', streams: [T.local] } : { direction: 'recvonly' });
    } catch (e) {
      // An older engine with no transceivers: send what there is and ask
      // for the rest by offer options.
      if (T.local) T.local.getTracks().forEach(function (t) { pc.addTrack(t, T.local); });
    }
    var ch = pc.createDataChannel('ink', { ordered: true });
    bindTeacherChannel(ch);
    pc.onicecandidate = function (ev) {
      if (T.pc !== pc || !ev.candidate) return;
      var s = packCandidate(ev.candidate, rev);
      if (!s) return;
      if (T.docReady) T.ref.update({ tc: arrayUnion([s]) }).catch(function () {});
      else T.buf.push(s);
    };
    pc.ontrack = function (ev) {
      if (T.pc !== pc) return;
      var stream = (ev.streams && ev.streams[0]) || null;
      if (!stream) {
        stream = T.remote || new global.MediaStream();
        try { stream.addTrack(ev.track); } catch (e) {}
      }
      T.remote = stream;
      attachRemote();
    };
    pc.onconnectionstatechange = function () {
      if (T.pc !== pc) return;
      if (pc.connectionState === 'connected') T.connectedOnce = true;
      renderRoomStatus();
      renderStageSource();
    };
    try {
      var offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      if (T.pc !== pc) return;
      var buf = T.buf.slice(); T.buf = [];
      await T.ref.update({
        status: 'live', teacherUid: (user() && user().uid) || '', teacherName: teacherName(),
        offer: sdpOf(pc.localDescription || offer), rev: rev, tc: buf, answer: null, arev: null, sc: [],
        joinedAt: now(), tseen: now(), teacherLeft: false
      });
      T.docReady = true;
      if (T.buf.length) {
        var late = T.buf.slice(); T.buf = [];
        T.ref.update({ tc: arrayUnion(late) }).catch(function () {});
      }
    } catch (e) {
      console.warn('consult: could not offer', e);
      toast('Could not start the call: ' + ((e && e.message) || e), 7000);
    }
    renderRoomStatus();
  }

  function bindTeacherChannel(ch) {
    T.channel = ch;
    ch.onmessage = function (ev) {
      var m = parseMessage(ev.data);
      if (!m) return;
      if (m.t === 'view') setTeacherView(m.view);
    };
    ch.onopen = function () { renderRoomStatus(); };
  }

  function closeTeacherPc() {
    var pc = T.pc;
    T.pc = null;
    if (T.channel) { try { T.channel.onmessage = T.channel.onopen = null; T.channel.close(); } catch (e) {} }
    T.channel = null;
    if (pc) {
      try { pc.ontrack = pc.onicecandidate = pc.onconnectionstatechange = null; } catch (e) {}
      try { pc.close(); } catch (e) {}
    }
    T.remote = null;
  }

  function watchRoom() {
    var id = T.id;
    if (T.unsub) { try { T.unsub(); } catch (e) {} }
    T.unsub = T.ref.onSnapshot(function (snap) {
      if (T.id !== id) return;
      if (!snap.exists) { roomEnded('The consult was removed.'); return; }
      onRoomDoc(snap.data() || {});
    }, function (err) { console.warn('consult: room listener', err); });
    if (T.inkUnsub) { try { T.inkUnsub(); } catch (e) {} }
    T.inkUnsub = T.ref.collection('ink').onSnapshot(function (qs) {
      if (T.id !== id) return;
      var next = {}, order = [];
      (qs.docs || []).forEach(function (d) {
        var s = cleanStroke(Object.assign({}, d.data() || {}, { id: d.id }));
        if (s) { next[s.id] = s; order.push(s); }
      });
      // A stroke still being written is this tab's own and is kept.
      if (T.drawing) next[T.drawing.id] = T.drawing;
      Object.keys(T.strokes).forEach(function (k) { if (T.strokes[k].pending && !next[k]) next[k] = T.strokes[k]; });
      T.strokes = next;
      T.order = order.sort(function (a, b) { return (a.at || 0) - (b.at || 0); }).map(function (s) { return s.id; });
      renderTeacherInk();
    }, function (err) { console.warn('consult: ink listener', err); });
    if (T.frameUnsub) { try { T.frameUnsub(); } catch (e) {} }
    T.frameUnsub = T.ref.collection('frames').doc('latest').onSnapshot(function (snap) {
      if (T.id !== id) return;
      var f = snap.exists ? snap.data() || {} : null;
      T.snap = f && typeof f.img === 'string' && /^data:image\/jpeg;base64,/.test(f.img) ? f : null;
      if (T.snap && T.snap.view) setTeacherView(cleanView(T.snap.view));
      renderStageSource();
    }, function () {});
  }

  function onRoomDoc(data) {
    T.data = data;
    if (data.status === 'ended' || data.status === 'cancelled') {
      if (!T.ending) roomEnded(data.endedBy === 'student'
        ? cleanText(data.studentName, NAME_MAX) + ' ended the consult.'
        : 'The consult has ended.');
      return;
    }
    if (data.view) setTeacherView(cleanView(data.view));
    var pc = T.pc;
    if (pc && data.answer && Number(data.arev) === T.rev && pc.signalingState === 'have-local-offer') {
      pc.setRemoteDescription(data.answer).catch(function (e) { console.warn('consult: bad answer', e); });
    }
    if (pc && pc.remoteDescription) {
      unpackCandidates(data.sc, T.rev, T.seenSc).forEach(function (c) { pc.addIceCandidate(c).catch(function () {}); });
    } else if (pc && data.answer && Number(data.arev) === T.rev) {
      // Candidates that arrive with the answer are added once it is set.
      setTimeout(function () {
        if (T.pc === pc && pc.remoteDescription) unpackCandidates(T.data && T.data.sc, T.rev, T.seenSc).forEach(function (c) { pc.addIceCandidate(c).catch(function () {}); });
      }, 300);
    }
    // The student's device put the consult back to waiting (the teacher's
    // tab was silent): this tab is plainly here, so it offers again.
    // Only once this tab's own offer has landed (`docReady`) and never while
    // one is being made: the first snapshot of a consult the teacher has
    // just opened still says `waiting`, and answering it with a second offer
    // would race the first.
    if (data.status === 'waiting' && T.pc && T.docReady && !T.negotiating && !T.ending) negotiate();
    renderRoomHead();
  }

  /* The view is STORED even when it is the "same" page: `sameView` ignores
     the zoom and the visible box, and those are exactly what the teacher's
     zoom label and the box on the stage show. Returning early on a same
     page is a label stuck on the zoom the consult opened at. */
  function setTeacherView(v) {
    var same = sameView(v, T.view);
    T.view = v;
    if (same) { renderZoomLabel(); renderViewBox(); return; }
    renderRoomHead();
    sizeStage();
    renderTeacherInk();
    renderZoomLabel();
    renderViewBox();
  }

  /* ---------------- The room's DOM ---------------- */
  function buildRoom() {
    if (T.root && T.root.isConnected) { T.root.hidden = false; return; }
    var root = el('div', 'consultRoom');
    root.id = 'consultRoom';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Consult');

    var bar = el('div', 'cRoomBar');
    var who = el('div', 'cRoomWho');
    who.appendChild(el('b', 'cRoomName', ''));
    who.appendChild(el('span', 'cRoomWhere', ''));
    bar.appendChild(who);
    bar.appendChild(el('div', 'cRoomStatus', 'Connecting…'));

    var tools = el('div', 'cRoomTools');
    var modes = el('div', 'cGroup');
    modes.appendChild(roomToolBtn('✏️', 'pen', 'Pen — write on the page'));
    modes.appendChild(roomToolBtn('👉', 'laser', 'Point — a dot the student sees, nothing is written'));
    modes.appendChild(roomToolBtn('✋', 'move', 'Move — drag to scroll their page, tap to bring a spot to the middle, pinch to zoom'));
    tools.appendChild(modes);
    /* 🔍 THE TEACHER STEERS THE STUDENT'S PAGE. Every button is an
       instruction the student's own app carries out (applyNav) — the same
       zoom and scroll the child's fingers use — so nothing here can put the
       worksheet somewhere the child could not have put it themselves. */
    var nav = el('div', 'cGroup cNav');
    nav.appendChild(btn('−', 'btnGhost cNavBtn', function () { navZoomStep(1 / NAV_STEP); }, 'Zoom their page out'));
    var zl = el('span', 'cZoom', '');
    zl.title = 'How far the student is zoomed in';
    nav.appendChild(zl);
    nav.appendChild(btn('+', 'btnGhost cNavBtn', function () { navZoomStep(NAV_STEP); }, 'Zoom their page in'));
    nav.appendChild(btn('↔ Fit', 'btnGhost cNavBtn', function () { sendNav('fit', {}); }, 'Fit their page to the width of their screen'));
    nav.appendChild(btn('◀', 'btnGhost cNavBtn', function () { sendNav('page', { step: -1 }); }, 'Their previous page'));
    nav.appendChild(btn('▶', 'btnGhost cNavBtn', function () { sendNav('page', { step: 1 }); }, 'Their next page'));
    tools.appendChild(nav);
    var colors = el('div', 'cGroup cColors');
    INK_COLORS.forEach(function (ic) {
      var b = el('button', 'cSwatch');
      b.type = 'button'; b.title = ic.name; b.setAttribute('aria-label', ic.name + ' ink');
      b.style.background = ic.c; b.setAttribute('data-color', ic.c);
      b.addEventListener('click', function () { T.color = ic.c; T.mode = 'pen'; renderTools(); });
      colors.appendChild(b);
    });
    tools.appendChild(colors);
    var widths = el('div', 'cGroup cWidths');
    INK_WIDTHS.forEach(function (iw) {
      var b = el('button', 'cWidth');
      b.type = 'button'; b.title = iw.name; b.setAttribute('aria-label', iw.name + ' pen');
      b.setAttribute('data-width', String(iw.w));
      var dot = el('span', 'cWidthDot'); dot.style.width = dot.style.height = Math.round(iw.w * 1400) + 'px';
      b.appendChild(dot);
      b.addEventListener('click', function () { T.width = iw.w; T.mode = 'pen'; renderTools(); });
      widths.appendChild(b);
    });
    tools.appendChild(widths);
    var edit = el('div', 'cGroup');
    edit.appendChild(btn('↶ Undo', 'btnGhost', teacherUndo, 'Take back your last stroke'));
    edit.appendChild(btn('🧹 Clear', 'btnGhost', teacherClear, 'Clear everything you wrote'));
    tools.appendChild(edit);
    var media = el('div', 'cGroup');
    media.appendChild(btn('🎤', 'btnGhost cMic', toggleTeacherMic, 'Mute or unmute your microphone'));
    media.appendChild(btn('📷', 'btnGhost cCam', toggleTeacherCam, 'Turn your camera off or on'));
    tools.appendChild(media);
    tools.appendChild(btn('End consult', 'btnPrimary cEnd', function () { leaveRoom(true); }, 'End the consult for both of you'));
    bar.appendChild(tools);
    root.appendChild(bar);

    var main = el('div', 'cRoomMain');
    var stage = el('div', 'cStage');
    var video = el('video', 'cRemote');
    video.autoplay = true; video.setAttribute('playsinline', ''); video.playsInline = true;
    stage.appendChild(video);
    var img = el('img', 'cSnap'); img.alt = ''; img.hidden = true;
    stage.appendChild(img);
    var ink = svgEl('svg', { viewBox: '0 0 1000 1414', preserveAspectRatio: 'none' });
    ink.setAttribute('class', 'cInk');
    stage.appendChild(ink);
    // What the student can see of the page, outlined — so the teacher knows
    // whether the spot they are about to write on is on the child's screen.
    var vb = el('div', 'cViewBox');
    vb.hidden = true;
    stage.appendChild(vb);
    stage.appendChild(el('div', 'cStageNote', ''));
    main.appendChild(stage);
    var sound = btn('🔊 Turn on sound', 'btnPrimary cSound', function () { playTeacherRemote(true); });
    sound.hidden = true;
    main.appendChild(sound);
    root.appendChild(main);

    var self = el('video', 'cSelf');
    self.muted = true; self.autoplay = true; self.setAttribute('playsinline', ''); self.playsInline = true;
    root.appendChild(self);

    global.document.body.appendChild(root);
    T.root = root;
    bindStage(ink);
    if (!T.onResize) {
      // A tablet turned on its side changes the room's shape without always
      // firing `resize` straight away (iOS fires `orientationchange` first
      // and settles the size a beat later), and the on-screen keyboard only
      // moves the VISUAL viewport. All three re-fit the stage.
      T.onResize = function () {
        sizeStage(); renderViewBox();
        if (T.resizeLate) clearTimeout(T.resizeLate);
        T.resizeLate = setTimeout(function () { T.resizeLate = null; sizeStage(); renderViewBox(); }, 350);
      };
      global.addEventListener('resize', T.onResize);
      global.addEventListener('orientationchange', T.onResize);
      if (global.visualViewport && global.visualViewport.addEventListener) global.visualViewport.addEventListener('resize', T.onResize);
    }
    renderTools();
    renderZoomLabel();
    renderViewBox();
  }

  function roomToolBtn(text, mode, title) {
    var b = btn(text, 'btnGhost cMode', function () { T.mode = mode; renderTools(); }, title);
    b.setAttribute('data-mode', mode);
    return b;
  }

  function renderTools() {
    if (!T.root) return;
    Array.prototype.forEach.call(T.root.querySelectorAll('.cMode'), function (b) {
      b.classList.toggle('on', b.getAttribute('data-mode') === T.mode);
    });
    Array.prototype.forEach.call(T.root.querySelectorAll('.cSwatch'), function (b) {
      b.classList.toggle('on', T.mode === 'pen' && b.getAttribute('data-color') === T.color);
    });
    Array.prototype.forEach.call(T.root.querySelectorAll('.cWidth'), function (b) {
      b.classList.toggle('on', T.mode === 'pen' && Number(b.getAttribute('data-width')) === T.width);
    });
    var mic = T.root.querySelector('.cMic'), cam = T.root.querySelector('.cCam');
    var hasMic = !!(T.local && T.local.getAudioTracks().length), hasCam = !!(T.local && T.local.getVideoTracks().length);
    if (mic) { mic.disabled = !hasMic; mic.classList.toggle('off', !T.micOn || !hasMic); mic.textContent = T.micOn && hasMic ? '🎤' : '🔇'; }
    if (cam) { cam.disabled = !hasCam; cam.classList.toggle('off', !T.camOn || !hasCam); }
    var ink = T.root.querySelector('.cInk');
    if (ink) ink.setAttribute('data-mode', T.mode);
  }

  function renderRoom() { renderRoomHead(); renderRoomStatus(); sizeStage(); renderTeacherInk(); renderStageSource(); }

  function renderRoomHead() {
    if (!T.root) return;
    var d = T.data || {};
    var name = T.root.querySelector('.cRoomName'), where = T.root.querySelector('.cRoomWhere');
    if (name) name.textContent = cleanText(d.studentName, NAME_MAX) || 'A student';
    var v = T.view || cleanView(d.view);
    var bits = [];
    var ls = [cleanText(d.level, 12), subjectWord(cleanText(d.subject, 20))].filter(Boolean).join(' ');
    if (ls) bits.push(ls);
    if (v.title) bits.push(v.title);
    if (v.page >= 1) bits.push('page ' + v.page + (v.n ? ' of ' + v.n : ''));
    else bits.push('not on a worksheet just now');
    if (where) where.textContent = bits.join(' · ');
  }

  function renderZoomLabel() {
    if (!T.root) return;
    var z = T.root.querySelector('.cZoom');
    if (z) z.textContent = (T.view && zoomPercent(T.view.zoom)) || '—';
    var on = !!(T.view && T.view.page >= 1);
    Array.prototype.forEach.call(T.root.querySelectorAll('.cNavBtn'), function (b) { b.disabled = !on; });
  }

  function renderViewBox() {
    if (!T.root) return;
    var vb = T.root.querySelector('.cViewBox');
    if (!vb) return;
    var box = T.view && T.view.page >= 1 ? T.view.box : null;
    // A box that is the whole page says nothing worth an outline.
    var whole = box && box[0] <= 0.005 && box[1] <= 0.005 && box[2] >= 0.995 && box[3] >= 0.995;
    if (!box || whole) { vb.hidden = true; return; }
    vb.hidden = false;
    vb.style.left = (box[0] * 100) + '%';
    vb.style.top = (box[1] * 100) + '%';
    vb.style.width = Math.max(0, (box[2] - box[0]) * 100) + '%';
    vb.style.height = Math.max(0, (box[3] - box[1]) * 100) + '%';
  }

  function renderRoomStatus() {
    if (!T.root) return;
    var s = T.root.querySelector('.cRoomStatus');
    var state = T.pc ? T.pc.connectionState : '';
    var text = '';
    if (!T.pc) text = 'Video is not available in this browser — the page will come as pictures.';
    else if (state === 'connected') text = '● Live';
    else if (state === 'failed') text = 'Video could not connect — showing pictures of the page instead.';
    else if (T.data && T.data.answer && Number(T.data.arev) === T.rev) text = 'Connecting…';
    else text = 'Calling ' + (cleanText(T.data && T.data.studentName, NAME_MAX) || 'the student') + '…';
    if (s) { s.textContent = text; s.classList.toggle('live', state === 'connected'); }
    renderTools();
  }

  function sizeStage() {
    if (!T.root) return;
    var main = T.root.querySelector('.cRoomMain'), stage = T.root.querySelector('.cStage'), ink = T.root.querySelector('.cInk');
    if (!main || !stage) return;
    var aspect = (T.view && T.view.aspect) || 1.4142;
    var r = main.getBoundingClientRect ? main.getBoundingClientRect() : { width: 0, height: 0 };
    var box = fitStage(r.width - 24, r.height - 24, aspect);
    if (box.w && box.h) { stage.style.width = box.w + 'px'; stage.style.height = box.h + 'px'; }
    if (ink) ink.setAttribute('viewBox', '0 0 1000 ' + Math.round(1000 * aspect));
  }

  function attachRemote() {
    if (!T.root) return;
    var v = T.root.querySelector('video.cRemote');
    if (!v) return;
    if (v.srcObject !== T.remote) v.srcObject = T.remote;
    playTeacherRemote(false);
    renderStageSource();
  }

  function playTeacherRemote(fromTap) {
    var v = T.root && T.root.querySelector('video.cRemote');
    var b = T.root && T.root.querySelector('.cSound');
    if (!v) return;
    var p = null;
    try { p = v.play(); } catch (e) { p = null; }
    if (p && p.then) p.then(function () { if (b) b.hidden = true; }, function () {
      // Sound refused without a tap: play muted so the page still moves,
      // and offer the tap.
      if (!fromTap) { v.muted = true; try { v.play().catch(function () {}); } catch (e) {} }
      if (b) b.hidden = false;
    });
    if (fromTap) { v.muted = false; if (b) b.hidden = true; }
  }

  function renderSelf() {
    if (!T.root) return;
    var self = T.root.querySelector('video.cSelf');
    if (!self) return;
    var hasCam = !!(T.local && T.local.getVideoTracks().length);
    self.hidden = !hasCam || !T.camOn;
    if (hasCam && self.srcObject !== T.local) { self.srcObject = T.local; try { self.play().catch(function () {}); } catch (e) {} }
  }

  function renderStageSource() {
    if (!T.root) return;
    var v = T.root.querySelector('video.cRemote'), img = T.root.querySelector('img.cSnap'), note = T.root.querySelector('.cStageNote');
    var connected = !!(T.pc && T.pc.connectionState === 'connected');
    var hasVideo = !!(T.remote && T.remote.getVideoTracks && T.remote.getVideoTracks().length);
    var useSnap = !(connected && hasVideo) && !!T.snap;
    if (img) {
      img.hidden = !useSnap;
      if (useSnap && img.getAttribute('src') !== T.snap.img) img.setAttribute('src', T.snap.img);
    }
    if (v) v.style.visibility = useSnap ? 'hidden' : 'visible';
    if (note) {
      var text = '';
      if (!(connected && hasVideo) && !T.snap) text = 'Waiting for ' + (cleanText(T.data && T.data.studentName, NAME_MAX) || 'the student') + '’s page…';
      if (T.view && T.view.page < 1 && (connected || T.snap)) text = '';
      note.textContent = text;
      note.hidden = !text;
    }
  }

  /* ---------------- Drawing on the stage ----------------
     Three things a finger can do here, and the stage tells them apart:
       • ONE finger in ✏️ pen mode writes, in 👉 point mode points, and in
         ✋ move mode DRAGS the student's page (a tap brings that spot to
         the middle of their screen);
       • TWO fingers, in ANY mode, pinch-zoom the student's page — the
         gesture every tablet user already knows, and the one that makes the
         ✋ button optional on an iPad. A second finger landing mid-stroke
         takes the stroke back: half a word written by the first finger of a
         pinch is ink nobody meant;
       • a mouse wheel with Ctrl (a laptop trackpad's pinch arrives as one)
         zooms, and in ✋ move mode a plain wheel scrolls. */
  var MOVE_TAP_PX = 8;
  var PINCH_MIN_RATIO = 0.06;
  var MOVE_SEND_MS = 70;
  var WHEEL_SEND_MS = 120;

  function bindStage(ink) {
    T.pointers = {};
    ink.addEventListener('pointerdown', function (e) {
      if (e.button > 0) return;
      var pt = stagePoint(e, ink);
      if (!pt) return;
      if (!T.view || T.view.page < 1) { toast('The student is not on a worksheet just now.', 3500); return; }
      e.preventDefault();
      try { ink.setPointerCapture(e.pointerId); } catch (err) {}
      T.pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(T.pointers);
      if (ids.length >= 2) { startPinch(ink); return; }
      if (T.mode === 'move') {
        T.moving = { pointer: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, moved: false, pt: pt, last: 0, dx: 0, dy: 0 };
        return;
      }
      if (T.mode === 'laser') { sendLaser(pt, true); T.lasering = e.pointerId; return; }
      T.drawing = { id: rid(20), ws: T.view.ws, page: T.view.page, c: T.color, w: T.width, pts: [pt], at: now(), pending: true, pointer: e.pointerId };
      T.strokes[T.drawing.id] = T.drawing;
      renderTeacherInk();
      sendLive(true);
    });
    ink.addEventListener('pointermove', function (e) {
      if (T.pointers && T.pointers[e.pointerId]) T.pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (T.pinch) { pinchMove(ink); return; }
      if (T.mode === 'move') { moveDrag(e, ink); return; }
      var pt = stagePoint(e, ink);
      if (T.mode === 'laser') {
        if (pt && (T.lasering === e.pointerId || e.pointerType === 'mouse')) sendLaser(pt, false);
        return;
      }
      var d = T.drawing;
      if (!d || d.pointer !== e.pointerId) return;
      var evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      if (!evs || !evs.length) evs = [e];
      evs.forEach(function (ce) {
        var q = stagePoint(ce, ink);
        if (q) d.pts.push(q);
      });
      if (d.pts.length > STROKE_MAX_POINTS * 3) d.pts = decimate(d.pts, STROKE_MAX_POINTS * 2);
      renderTeacherInk();
      sendLive(false);
    });
    function finish(e) {
      if (T.pointers) delete T.pointers[e.pointerId];
      if (T.pinch) {
        // The pinch ends when the fingers lift; whatever is left down is
        // not the start of a stroke or a drag — it is a finger on its way up.
        if (Object.keys(T.pointers || {}).length < 2) { flushPinch(); T.pinch = null; }
        return;
      }
      if (T.moving && T.moving.pointer === e.pointerId) { endMove(e.type === 'pointercancel'); return; }
      if (T.lasering === e.pointerId) { T.lasering = null; return; }
      var d = T.drawing;
      if (!d || d.pointer !== e.pointerId) return;
      T.drawing = null;
      if (e.type === 'pointercancel' && d.pts.length < 3) { abandonStroke(d); return; }
      commitStroke(d);
    }
    ink.addEventListener('pointerup', finish);
    ink.addEventListener('pointercancel', finish);
    ink.addEventListener('lostpointercapture', function (e) { if (T.pointers && T.pointers[e.pointerId]) finish(e); });
    ink.addEventListener('wheel', function (e) { stageWheel(e, ink); }, { passive: false });
  }

  /* A stroke the teacher never finished — the first finger of a pinch, a
     cancelled touch — is taken back off both screens, never saved. */
  function abandonStroke(d) {
    if (!d) return;
    delete T.strokes[d.id];
    renderTeacherInk();
    if (T.channel && T.channel.readyState === 'open') { try { T.channel.send(JSON.stringify({ t: 'drop', id: d.id })); } catch (e) {} }
  }

  function startPinch(ink) {
    if (T.drawing) { var d = T.drawing; T.drawing = null; abandonStroke(d); }
    T.moving = null; T.lasering = null;
    var ids = Object.keys(T.pointers);
    var sp = pinchSpan(T.pointers[ids[0]], T.pointers[ids[1]]);
    if (!sp || !(sp.d > 0)) { T.pinch = null; return; }
    T.pinch = { ids: ids.slice(0, 2), d0: sp.d, x: sp.x, y: sp.y, last: 0, f: 1, cx: sp.x, cy: sp.y };
  }

  function pinchMove(ink) {
    var P = T.pinch;
    if (!P) return;
    var sp = pinchSpan(T.pointers[P.ids[0]], T.pointers[P.ids[1]]);
    if (!sp || !(sp.d > 0)) return;
    var ratio = sp.d / P.d0;
    // Two fingers sliding together without spreading is a PAN.
    var r = ink.getBoundingClientRect ? ink.getBoundingClientRect() : null;
    if (r && r.width > 0 && Math.abs(ratio - 1) < PINCH_MIN_RATIO) {
      var pdx = (P.x - sp.x) / r.width, pdy = (P.y - sp.y) / r.height;
      if (Math.abs(pdx) > 0.01 || Math.abs(pdy) > 0.01) {
        if (now() - P.last >= MOVE_SEND_MS) {
          P.last = now(); P.x = sp.x; P.y = sp.y;
          sendNav('pan', { dx: pdx, dy: pdy }, true);
        }
      }
      return;
    }
    if (Math.abs(ratio - 1) < PINCH_MIN_RATIO) return;
    if (now() - P.last < MOVE_SEND_MS * 2) return;
    P.last = now();
    var pt = normFromRect(sp.x, sp.y, r, 0.5);
    var extra = { f: ratio };
    if (pt && T.view) { extra.page = T.view.page; extra.x = pt[0]; extra.y = pt[1]; }
    sendNav('zoom', extra, true);
    P.d0 = sp.d; P.x = sp.x; P.y = sp.y;
  }

  function flushPinch() { flushNavDoc(); }

  function moveDrag(e, ink) {
    var M = T.moving;
    if (!M || M.pointer !== e.pointerId) return;
    var r = ink.getBoundingClientRect ? ink.getBoundingClientRect() : null;
    if (!r || !(r.width > 0) || !(r.height > 0)) return;
    if (!M.moved && Math.abs(e.clientX - M.x0) < MOVE_TAP_PX && Math.abs(e.clientY - M.y0) < MOVE_TAP_PX) return;
    M.moved = true;
    // The teacher drags the student's VIEW the way the outline on the stage
    // should go — the same sign the outline moves in.
    M.dx += (e.clientX - M.x) / r.width;
    M.dy += (e.clientY - M.y) / r.height;
    M.x = e.clientX; M.y = e.clientY;
    if (now() - M.last < MOVE_SEND_MS) return;
    sendMoveBit();
  }

  function sendMoveBit() {
    var M = T.moving;
    if (!M || (Math.abs(M.dx) < 0.0005 && Math.abs(M.dy) < 0.0005)) return;
    M.last = now();
    var dx = M.dx, dy = M.dy;
    M.dx = 0; M.dy = 0;
    sendNav('pan', { dx: dx, dy: dy }, true);
  }

  function endMove(cancelled) {
    var M = T.moving;
    T.moving = null;
    if (!M) return;
    if (M.moved) {
      T.moving = M; sendMoveBit(); T.moving = null;
      flushNavDoc();
      return;
    }
    if (!cancelled && M.pt && T.view) sendNav('center', { page: T.view.page, x: M.pt[0], y: M.pt[1] });
  }

  function stageWheel(e, ink) {
    if (!T.view || T.view.page < 1) return;
    var zooming = !!e.ctrlKey;
    if (!zooming && T.mode !== 'move') return;
    e.preventDefault();
    var r = ink.getBoundingClientRect ? ink.getBoundingClientRect() : null;
    if (!r || !(r.width > 0)) return;
    var unit = e.deltaMode === 1 ? 16 : (e.deltaMode === 2 ? r.height : 1);
    T.wheel = T.wheel || { f: 1, dx: 0, dy: 0, last: 0, pt: null };
    var Wh = T.wheel;
    if (zooming) {
      Wh.f *= Math.exp(-e.deltaY * unit * 0.0025);
      Wh.pt = normFromRect(e.clientX, e.clientY, r, 0.5);
    } else {
      Wh.dx += (e.deltaX * unit) / r.width;
      Wh.dy += (e.deltaY * unit) / r.height;
    }
    if (now() - Wh.last < WHEEL_SEND_MS) return;
    Wh.last = now();
    if (Math.abs(Wh.f - 1) >= 0.02) {
      var extra = { f: Wh.f };
      if (Wh.pt) { extra.page = T.view.page; extra.x = Wh.pt[0]; extra.y = Wh.pt[1]; }
      sendNav('zoom', extra, true);
      Wh.f = 1;
    }
    if (Math.abs(Wh.dx) > 0.002 || Math.abs(Wh.dy) > 0.002) {
      sendNav('pan', { dx: Wh.dx, dy: Wh.dy }, true);
      Wh.dx = 0; Wh.dy = 0;
    }
    if (T.wheelFlush) clearTimeout(T.wheelFlush);
    T.wheelFlush = setTimeout(function () { T.wheelFlush = null; flushNavDoc(); }, NAV_DOC_MS);
  }

  function navZoomStep(f) {
    sendNav('zoom', { f: f });
  }

  /* THE ONE DOOR a nav leaves the teacher's tab by. Over the channel it goes
     at once; a DISCRETE one (a button, a tap) is ALSO written to the
     document, so a student whose channel has not opened — a school network
     that blocks the call — is still steered, and the id stops it being
     obeyed twice. A CONTINUOUS one (a drag, a pinch) goes to the document
     only when there is no channel, and then folded (navMerge) and written
     once every NAV_DOC_MS rather than a dozen times a second. */
  function sendNav(op, extra, continuous) {
    if (!T.ref || !T.view || T.view.page < 1) { toast('The student is not on a worksheet just now.', 3500); return false; }
    var raw = { t: 'nav', id: rid(16), op: op, ws: T.view.ws, at: now() };
    Object.keys(extra || {}).forEach(function (k) { raw[k] = extra[k]; });
    var m = cleanNav(raw);
    if (!m) return false;
    var open = !!(T.channel && T.channel.readyState === 'open');
    if (open) { try { T.channel.send(JSON.stringify(m)); } catch (e) { open = false; } }
    if (!continuous) { writeNavDoc(m); return true; }
    if (open) return true;
    if (T.navAcc) {
      var merged = navMerge(T.navAcc, m);
      if (merged) T.navAcc = merged;
      else { flushNavDoc(); T.navAcc = m; }
    } else T.navAcc = m;
    if (!T.navTimer) T.navTimer = setTimeout(function () { T.navTimer = null; flushNavDoc(); }, NAV_DOC_MS);
    return true;
  }

  function flushNavDoc() {
    if (T.navTimer) { clearTimeout(T.navTimer); T.navTimer = null; }
    var acc = T.navAcc;
    T.navAcc = null;
    if (!acc) return;
    // A fresh id and clock: the folded nav is one instruction, and the
    // student must not take it for any of the steps it was folded from.
    var raw = {};
    Object.keys(acc).forEach(function (k) { raw[k] = acc[k]; });
    raw.id = rid(16); raw.at = now();
    var m = cleanNav(raw);
    if (m) writeNavDoc(m);
  }

  function writeNavDoc(m) {
    if (!T.ref || !m) return;
    T.ref.update({ nav: m }).catch(function (e) { console.warn('consult: nav not written', e); });
  }

  function stagePoint(e, ink) {
    var r = ink.getBoundingClientRect ? ink.getBoundingClientRect() : null;
    return normFromRect(e.clientX, e.clientY, r, T.drawing ? 0.08 : 0.02);
  }

  function strokeWire(s, done) {
    return { t: 'ink', id: s.id, ws: s.ws, page: s.page, c: s.c, w: s.w, p: packPoints(s.pts), at: s.at, done: !!done };
  }

  function sendLive(force) {
    var d = T.drawing;
    if (!d || !T.channel || T.channel.readyState !== 'open') return;
    var t = now();
    if (!force && t - T.lastSend < LIVE_SEND_MS) return;
    T.lastSend = t;
    try { T.channel.send(JSON.stringify(strokeWire(d, false))); } catch (e) {}
  }

  function sendLaser(pt, force) {
    if (!T.view || T.view.page < 1) return;
    var t = now();
    if (!force && t - T.lastLaser < LASER_SEND_MS) return;
    T.lastLaser = t;
    if (T.channel && T.channel.readyState === 'open') {
      try { T.channel.send(JSON.stringify({ t: 'laser', ws: T.view.ws, page: T.view.page, x: pt[0], y: pt[1] })); } catch (e) {}
    }
  }

  function commitStroke(d) {
    var wire = strokeWire(d, true);
    if (T.channel && T.channel.readyState === 'open') { try { T.channel.send(JSON.stringify(wire)); } catch (e) {} }
    if (!T.ref) return;
    if (T.order.length >= INK_DOCS_MAX) { toast('That is a lot of writing — clear some before adding more.', 5000); return; }
    T.order.push(d.id);
    T.ref.collection('ink').doc(d.id).set({ ws: wire.ws, page: wire.page, c: wire.c, w: wire.w, p: wire.p, at: wire.at, by: 'teacher' })
      .then(function () { if (T.strokes[d.id]) delete T.strokes[d.id].pending; })
      .catch(function (e) { console.warn('consult: stroke not saved', e); toast('A stroke could not be saved: ' + ((e && e.message) || e), 5000); });
  }

  function teacherUndo() {
    if (!T.ref) return;
    var mine = T.order.filter(function (id) { return !!T.strokes[id]; });
    var id = mine[mine.length - 1];
    if (!id) return;
    T.order = T.order.filter(function (x) { return x !== id; });
    delete T.strokes[id];
    renderTeacherInk();
    if (T.channel && T.channel.readyState === 'open') { try { T.channel.send(JSON.stringify({ t: 'drop', id: id })); } catch (e) {} }
    T.ref.collection('ink').doc(id).delete().catch(function () {});
  }

  async function teacherClear() {
    if (!T.ref) return;
    var ids = Object.keys(T.strokes);
    T.strokes = {}; T.order = [];
    renderTeacherInk();
    if (T.channel && T.channel.readyState === 'open') { try { T.channel.send(JSON.stringify({ t: 'clear' })); } catch (e) {} }
    try {
      var qs = await T.ref.collection('ink').get();
      (qs.docs || []).forEach(function (d) { if (ids.indexOf(d.id) === -1) ids.push(d.id); });
    } catch (e) {}
    ids.forEach(function (id) { T.ref.collection('ink').doc(id).delete().catch(function () {}); });
  }

  function renderTeacherInk() {
    if (!T.root) return;
    var ink = T.root.querySelector('.cInk');
    if (!ink) return;
    var aspect = (T.view && T.view.aspect) || 1.4142;
    var W = 1000, H = 1000 * aspect;
    while (ink.firstChild) ink.removeChild(ink.firstChild);
    Object.keys(T.strokes).map(function (k) { return T.strokes[k]; })
      .filter(function (s) { return strokeOnView(s, T.view); })
      .sort(function (a, b) { return (a.at || 0) - (b.at || 0); })
      .forEach(function (s) {
        ink.appendChild(svgEl('path', {
          d: strokePathD(s.pts, W, H), fill: 'none', stroke: s.c, 'stroke-width': String(Math.max(0.8, s.w * W)),
          'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'data-stroke': s.id
        }));
      });
  }

  function toggleTeacherMic() {
    if (!T.local) return;
    T.micOn = !T.micOn;
    T.local.getAudioTracks().forEach(function (t) { t.enabled = T.micOn; });
    renderTools();
  }
  function toggleTeacherCam() {
    if (!T.local) return;
    T.camOn = !T.camOn;
    T.local.getVideoTracks().forEach(function (t) { t.enabled = T.camOn; });
    renderTools(); renderSelf();
  }

  function roomEnded(text) {
    T.ending = true;
    toast(text, 6000);
    teardownRoom();
  }

  /* `end` true: the teacher pressed End — it ends for both. False: the room
     is being left without ending it (another consult opened, a sign-out). */
  async function leaveRoom(end) {
    T.ending = true;
    var ref = T.ref;
    if (ref && end) {
      try { await ref.update({ status: 'ended', endedBy: 'teacher', endedAt: now(), offer: null, answer: null, tc: [], sc: [] }); }
      catch (e) { toast('Could not end the consult cleanly: ' + ((e && e.message) || e), 6000); }
      try { await ref.collection('frames').doc('latest').delete(); } catch (e) {}
    } else if (ref) {
      try { await ref.update({ status: 'waiting', teacherLeft: true, offer: null, answer: null, tc: [], sc: [] }); } catch (e) {}
    }
    teardownRoom();
  }

  function teardownRoom() {
    T.gen++;
    if (T.unsub) { try { T.unsub(); } catch (e) {} }
    if (T.inkUnsub) { try { T.inkUnsub(); } catch (e) {} }
    if (T.frameUnsub) { try { T.frameUnsub(); } catch (e) {} }
    T.unsub = T.inkUnsub = T.frameUnsub = null;
    if (T.heartbeat) clearInterval(T.heartbeat);
    T.heartbeat = null;
    // A drag folded for the document is written before the room goes, so
    // the last bit of a scroll is not lost; then every timer comes down.
    flushNavDoc();
    if (T.wheelFlush) { clearTimeout(T.wheelFlush); T.wheelFlush = null; }
    if (T.resizeLate) { clearTimeout(T.resizeLate); T.resizeLate = null; }
    T.wheel = null; T.pinch = null; T.moving = null; T.pointers = {};
    if (T.onResize) {
      global.removeEventListener('resize', T.onResize);
      global.removeEventListener('orientationchange', T.onResize);
      if (global.visualViewport && global.visualViewport.removeEventListener) global.visualViewport.removeEventListener('resize', T.onResize);
      T.onResize = null;
    }
    closeTeacherPc();
    stopLocal();
    if (T.root && T.root.parentNode) T.root.parentNode.removeChild(T.root);
    T.root = null;
    T.id = ''; T.ref = null; T.data = null; T.view = null; T.strokes = {}; T.order = []; T.drawing = null; T.snap = null;
    T.rev = 0;
    renderAlerts();
  }

  /* The teacher's tab is going away mid-consult: it goes back to WAITING,
     not ended, so the pop-up comes back and a reload rejoins it. */
  function teacherPageHide() {
    if (T.ref && !T.ending) {
      try { T.ref.update({ status: 'waiting', teacherLeft: true, offer: null, answer: null, tc: [], sc: [] }); } catch (e) {}
    }
  }

  /* ===================================================================
     TEACHER — the pop-up on any Study Buddy screen
     =================================================================== */
  var W = { unsub: null, items: {}, dismissed: {}, root: null, tick: null, seenIds: {}, baseTitle: '' };

  function startWatcher() {
    stopWatcher();
    var d = db();
    if (!d || !admin()) return;
    W.unsub = d.collection(COLLECTION).where('status', '==', 'waiting').onSnapshot(function (qs) {
      var next = {};
      (qs.docs || []).forEach(function (doc) { next[doc.id] = doc.data() || {}; });
      var fresh = Object.keys(next).filter(function (id) { return !W.seenIds[id] && consultFresh(next[id], now()); });
      W.items = next;
      fresh.forEach(function (id) { W.seenIds[id] = true; });
      if (fresh.length) chime();
      renderAlerts();
    }, function (err) { console.warn('consult: the waiting list could not be read', err); });
    W.tick = setInterval(renderAlerts, 30000);
  }
  function stopWatcher() {
    if (W.unsub) { try { W.unsub(); } catch (e) {} }
    if (W.tick) clearInterval(W.tick);
    W.unsub = null; W.tick = null; W.items = {};
    renderAlerts();
  }

  function waitingList() {
    var t = now();
    return Object.keys(W.items)
      .filter(function (id) { return !W.dismissed[id] && id !== T.id && consultFresh(W.items[id], t); })
      .map(function (id) { return { id: id, data: W.items[id] }; })
      .sort(function (a, b) { return stampMs(a.data.at) - stampMs(b.data.at); });
  }

  function renderAlerts() {
    if (!global.document || !global.document.body) return;
    var list = admin() ? waitingList() : [];
    updateTitle(list.length);
    if (!list.length) {
      if (W.root && W.root.parentNode) W.root.parentNode.removeChild(W.root);
      W.root = null;
      return;
    }
    if (!W.root || !W.root.isConnected) {
      W.root = el('div', 'consultAlerts');
      W.root.id = 'consultAlerts';
      W.root.setAttribute('role', 'alert');
      global.document.body.appendChild(W.root);
    }
    while (W.root.firstChild) W.root.removeChild(W.root.firstChild);
    list.forEach(function (item) {
      var card = el('div', 'consultAlert');
      var top = el('div', 'consultAlertTop');
      top.appendChild(el('span', 'consultIcon', '🙋'));
      var words = el('div', 'consultAlertWords');
      words.appendChild(el('b', '', (cleanText(item.data.studentName, NAME_MAX) || 'A student') + (item.data.teacherLeft ? ' is waiting for you to come back' : ' is asking for help')));
      words.appendChild(el('span', 'consultAlertWhere', [consultSummary(item.data), consultAgo(now() - stampMs(item.data.at))].filter(Boolean).join(' · ')));
      top.appendChild(words);
      card.appendChild(top);
      var row = el('div', 'consultRow');
      row.appendChild(btn('Join', 'btnPrimary', function () { openRoom(item.id); renderAlerts(); }, 'Join this consult now'));
      row.appendChild(btn('Later', 'btnGhost', function () { W.dismissed[item.id] = true; renderAlerts(); }, 'Hide this pop-up — the email still has the link'));
      card.appendChild(row);
      W.root.appendChild(card);
    });
  }

  function updateTitle(n) {
    if (!global.document) return;
    var t = global.document.title || '';
    var base = t.replace(/^🙋 \(\d+\) /, '');
    global.document.title = n > 0 ? '🙋 (' + n + ') ' + base : base;
  }

  /* Two soft notes, so a teacher in another window hears it. A browser that
     refuses sound without a tap simply stays quiet; the pop-up is the alert. */
  function chime() {
    try {
      var AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return;
      var ac = W.ac || (W.ac = new AC());
      if (ac.state === 'suspended' && ac.resume) ac.resume().catch(function () {});
      [[880, 0], [1320, 0.16]].forEach(function (n) {
        var o = ac.createOscillator(), g = ac.createGain();
        o.type = 'sine'; o.frequency.value = n[0];
        g.gain.setValueAtTime(0.0001, ac.currentTime + n[1]);
        g.gain.exponentialRampToValueAtTime(0.18, ac.currentTime + n[1] + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + n[1] + 0.32);
        o.connect(g); g.connect(ac.destination);
        o.start(ac.currentTime + n[1]); o.stop(ac.currentTime + n[1] + 0.35);
      });
    } catch (e) {}
  }

  /* ===================================================================
     The link, the account and the wiring
     =================================================================== */
  var pendingJoin = '';
  function takeParam() {
    try {
      var id = readConsultParam(global.location && global.location.search);
      if (!id) return;
      pendingJoin = id;
      // Read ONCE and taken off the address bar, the rule `?ws=` follows: a
      // reload must not rejoin a consult that has ended.
      var url = new URL(global.location.href);
      url.searchParams.delete('consult');
      global.history.replaceState(null, '', url.pathname + (url.search || '') + url.hash);
    } catch (e) {}
  }

  var lastUid = null;
  function authChanged(u) {
    var uid = u ? u.uid : '';
    if (uid !== lastUid) {
      // One account's consult is never the next person's.
      if (S.id || S.asking) resetStudent(true);
      if (T.id) teardownRoom();
      stopWatcher();
      W.dismissed = {}; W.seenIds = {};
    }
    lastUid = uid;
    syncButton();
    if (!u) {
      if (pendingJoin) toast('Sign in as the teacher to join the consult.', 7000);
      return;
    }
    if (admin() && !practice()) {
      startWatcher();
      if (pendingJoin) { var id = pendingJoin; pendingJoin = ''; openRoom(id); }
    } else if (pendingJoin) {
      pendingJoin = '';
      toast('That consult link is for the teacher.', 6000);
    }
  }

  function wire() {
    var b = $('consultBtn');
    if (b && !b._consultWired) { b._consultWired = true; b.addEventListener('click', onButton); }
    if (!wire.done) {
      wire.done = true;
      global.addEventListener('pagehide', function () { studentPageHide(); teacherPageHide(); });
      global.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        if (S.asking) { S.asking = false; renderPanel(); }
      });
    }
    syncButton();
  }

  var pure = {
    ENDPOINT: ENDPOINT, JOIN_BASE: JOIN_BASE, COLLECTION: COLLECTION,
    WAIT_FRESH_MS: WAIT_FRESH_MS, SEEN_FRESH_MS: SEEN_FRESH_MS, STROKE_MAX_POINTS: STROKE_MAX_POINTS,
    INK_COLORS: INK_COLORS, INK_WIDTHS: INK_WIDTHS, INK_W_MIN: INK_W_MIN, INK_W_MAX: INK_W_MAX,
    MIRROR_LONG: MIRROR_LONG, SNAP_MAX_CHARS: SNAP_MAX_CHARS,
    consultIdOk: consultIdOk, consultLink: consultLink, readConsultParam: readConsultParam,
    cleanText: cleanText, clamp01: clamp01, decimate: decimate, packPoints: packPoints, unpackPoints: unpackPoints,
    inkColorOk: inkColorOk, inkWidth: inkWidth, strokeIdOk: strokeIdOk, cleanStroke: cleanStroke, strokePathD: strokePathD,
    packCandidate: packCandidate, unpackCandidates: unpackCandidates, needsAnswer: needsAnswer, stampMs: stampMs,
    consultFresh: consultFresh, consultAgo: consultAgo, consultSummary: consultSummary, subjectWord: subjectWord,
    mirrorSize: mirrorSize, fitStage: fitStage, normFromRect: normFromRect, visibleBox: visibleBox,
    parseMessage: parseMessage, cleanView: cleanView, sameView: sameView, strokeOnView: strokeOnView,
    statusWords: statusWords, notifyWords: notifyWords, rid: rid,
    NAV_ZOOM_MIN: NAV_ZOOM_MIN, NAV_ZOOM_MAX: NAV_ZOOM_MAX, NAV_PAN_MAX: NAV_PAN_MAX, NAV_FRESH_MS: NAV_FRESH_MS,
    NAV_STEP: NAV_STEP, NAV_DOC_MS: NAV_DOC_MS,
    cleanNav: cleanNav, navFresh: navFresh, zoomPercent: zoomPercent, stepPage: stepPage,
    navMerge: navMerge, pinchSpan: pinchSpan, clampPanelPos: clampPanelPos
  };

  global.TutorConsult = {
    pure: pure,
    wire: wire,
    authChanged: authChanged,
    syncButton: syncButton,
    openRoom: openRoom,
    leaveRoom: leaveRoom,
    startConsult: startConsult,
    endStudent: endStudent,
    // Read-only views of the two sides, for the harness and the console.
    state: function () {
      return {
        student: { id: S.id, status: S.status, rev: S.rev, strokes: Object.keys(S.strokes).length, live: Object.keys(S.live).length,
          connection: S.pc ? S.pc.connectionState : '', mic: !!S.mic, asking: S.asking },
        teacher: { id: T.id, rev: T.rev, strokes: Object.keys(T.strokes).length, connection: T.pc ? T.pc.connectionState : '',
          channel: T.channel ? T.channel.readyState : '', view: T.view, mode: T.mode },
        waiting: waitingList().map(function (w) { return w.id; })
      };
    },
    _internals: { S: S, T: T, W: W, renderStudentInk: renderStudentInk, renderAlerts: renderAlerts, drawMirror: drawMirror,
      onOwn: onOwn, onRoomDoc: onRoomDoc, notifyTeacher: notifyTeacher, currentView: currentView, takeParam: takeParam,
      pendingJoin: function () { return pendingJoin; } }
  };

  takeParam();
  if (global.document) {
    if (global.document.readyState === 'loading') global.document.addEventListener('DOMContentLoaded', wire);
    else wire();
  }
})(typeof window !== 'undefined' ? window : globalThis);
