/* =====================================================================
   🎯 THE LEARNING OBJECTIVE TRACKER — the mistake book, read objective by
   objective, with one press into practising each one again (lo-tracker.js)

   Zhi Kai (2026-11-18): "Build a super professional polished and sleek
   interface for the mistakes tracking platform which conveniently clicks
   into each learning objectives mistakes to practice again. This will be
   our corner stone to marketing our tuition services in the coming year."

   WHAT IT IS. The top of 📕 the mistake book. Three layers, each one tap
   deeper than the last:
     ① THE HERO — who, which subject, how they are doing overall (a mastery
        ring from the marks), and four numbers a parent reads in a second:
        still to redo, sorted, objectives to work on, objectives secure.
     ② THE OBJECTIVES — one card per learning objective the student has a
        mistake on OR a mark for, ordered by what needs the most work. Each
        card: its own ring (marks got over marks attempted, across every
        marked paper), the syllabus code, the objective in words, a bar of
        to-redo against sorted, the trend over papers, and ▶ Practise N.
     ③ THE OBJECTIVE — tap a card and a sheet slides in with that one
        objective: the score paper by paper, ▶ Practise the ones to redo,
        ✨ fresh practice questions on the same skill, 🖨 a worksheet of
        them, and the mistakes themselves, drawn by the book's own card.

   IT OWNS NO DATA AND NO BEHAVIOUR THAT ALREADY EXISTS. The host (index.html,
   `lotEnv()`) hands it the mistakes in a small neutral shape, the diagnostic
   rows `progressRows` already adds up, and a door for every action — the
   book's own ✏️ Practise session (`pracStart`), lo-practice's window for
   fresh questions (`lpOpen`), the printed sheet (`mwsExport`), ⚡ Quick
   practice and the book's own `mistakeCard`. A fix to any of those reaches
   the tracker without touching this file, and nothing here can drift from
   the book underneath it.

   📚 v1.99.0 adds the level above: TOPICS (Fractions, Percentage…), each
   holding its objectives, practisable as a whole — see `📚 THE TOPICS`.

   IT NEVER ASKS A MODEL, never reads or writes Firestore, never fetches.
   The harness (tools/lo-tracker-tests.mjs) pins that.

   THE MODEL IS PURE (`build`, `statusOf`, `sortCards`, `summary`, `codeOf`,
   `sentence`, `trendOf`, `ringPath`), so the harness checks the numbers
   without a browser; the DOM half only draws what the model says.

   Every word that came from a model or a worksheet (an objective's wording
   the marking chose, a paper's name) is painted with textContent.
   ===================================================================== */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  if (root) root.LoTracker = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function (root) {
  'use strict';

  /* ---------------- The thresholds, named once ----------------
     The same three bands the 📈 progress table prints (Strong ≥ 80,
     Getting there ≥ 50, Revise below), so a parent comparing the two
     screens never sees one objective called two different things. */
  var SECURE_PCT = 80;
  var CLOSE_PCT = 50;
  /* How many papers the trend line shows at most. More than this on a
     card 340px wide is a smear, not a line. */
  var TREND_MAX = 8;
  /* The cards drawn before "Show N more". A term of maths touches forty
     objectives; forty cards on a phone is a wall. */
  var PAGE = 12;

  var STATUS = {
    work:   { rank: 0, label: 'Needs work',    short: 'Needs work' },
    close:  { rank: 1, label: 'Getting there', short: 'Getting there' },
    redo:   { rank: 2, label: 'To redo',       short: 'To redo' },
    secure: { rank: 3, label: 'Secure',        short: 'Secure' }
  };

  var SORTS = [
    ['priority', 'Needs most work'],
    ['mistakes', 'Most to redo'],
    ['syllabus', 'Syllabus order']
  ];
  var FILTERS = [
    ['focus', 'To work on'],
    ['all', 'All objectives'],
    ['secure', 'Secure']
  ];

  /* ================================================================
     THE PURE MODEL
     ================================================================ */

  function num(x) { var n = Number(x); return isFinite(n) ? n : 0; }
  function str(x) { return x == null ? '' : String(x); }

  /* "solving word problems involving ratio" → "Solving word problems
     involving ratio". Only the FIRST letter, so "cm³" and "GST" survive. */
  function sentence(s) {
    var t = str(s).replace(/\s+/g, ' ').trim();
    if (!t) return '';
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  /* The syllabus code as a person reads it: P5.FR.2.6 → { level: 'P5',
     code: 'FR 2.6' }. A science id (`heat-gain`) has no printed code, so
     the chip shows the level alone. */
  function codeOf(lo, level) {
    var id = str(lo).trim();
    var m = /^(P[1-6])\.([A-Z]+)\.(\d+)\.(\d+)$/i.exec(id);
    if (m) return { level: m[1].toUpperCase(), code: m[2].toUpperCase() + ' ' + m[3] + '.' + m[4] };
    return { level: str(level).toUpperCase(), code: '' };
  }

  /* A rate over what was ATTEMPTED — the rule `diagPct` follows: a blank
     is not a wrong answer. Null when nothing was attempted. */
  function pctOf(got, att) {
    return att > 0 ? Math.round((got / att) * 100) : null;
  }

  /* THE ONE PLACE A CARD'S STATUS IS DECIDED.
     · a score under 50% is Needs work, under 80% Getting there;
     · 80% and over is Secure only when nothing is left to redo — a strong
       score with two questions still wrong in the book is not finished;
     · no score at all (a mistake filed from a paper marked before the
       objectives were kept) is To redo while anything is open, else Secure. */
  function statusOf(card) {
    var open = (card && card.open ? card.open.length : 0);
    var p = card ? card.pct : null;
    if (p === null || p === undefined) return open > 0 ? 'redo' : 'secure';
    if (p < CLOSE_PCT) return 'work';
    if (p < SECURE_PCT) return 'close';
    return open > 0 ? 'close' : 'secure';
  }

  /* The score paper by paper, oldest first, and how far it has moved from
     the first paper to the last. */
  function trendOf(history) {
    var pts = (Array.isArray(history) ? history : []).filter(function (h) {
      return h && num(h.attempted) > 0;
    }).map(function (h) {
      return { at: num(h.at), pct: pctOf(num(h.awarded), num(h.attempted)), name: str(h.name) };
    }).sort(function (a, b) { return a.at - b.at; });
    if (pts.length > TREND_MAX) pts = pts.slice(pts.length - TREND_MAX);
    var delta = pts.length > 1 ? pts[pts.length - 1].pct - pts[0].pct : null;
    return { points: pts, delta: delta };
  }

  /* BUILD — the mistakes and the diagnostic rows, as one card per
     objective.

     `items`: [{ id, cleared, lo, loTitle, loText, topic, topicKey, order,
                 level, createdAt, docName }] — the host's neutral shape.
     `rows`:  the subject's `progressRows(...).rows` — { lo, sylTopic, topic,
              objective, level, order, awarded, attempted, total, papers,
              history, labelled }.

     A card is keyed by the objective id when there is one, else by the
     topic (a question the marking could only place to a topic is still a
     weakness with a name). A mistake with neither is gathered under one
     "Not yet filed" card, last, so the counts add up to the book. */
  var UNFILED = '~unfiled';
  function keyOfItem(m) {
    if (m.lo) return 'lo:' + m.lo;
    if (m.topicKey) return 't:' + m.topicKey;
    return UNFILED;
  }
  function keyOfRow(r) {
    if (r.lo) return 'lo:' + r.lo;
    if (r.sylTopic) return 't:' + r.sylTopic;
    return '';
  }
  function emptyCard(key) {
    return {
      key: key, lo: '', title: '', short: '', topic: '', topicKey: '', level: '', order: Infinity,
      open: [], sorted: [], got: 0, att: 0, tot: 0, papers: 0, history: [], pct: null,
      last: 0, docs: []
    };
  }
  function build(items, rows) {
    var by = {}, cards = [];
    function card(key) {
      if (!by[key]) { by[key] = emptyCard(key); cards.push(by[key]); }
      return by[key];
    }
    (Array.isArray(rows) ? rows : []).forEach(function (r) {
      if (!r || typeof r !== 'object') return;
      var k = keyOfRow(r);
      if (!k) return;
      var c = card(k);
      c.lo = c.lo || str(r.lo);
      c.title = c.title || sentence(r.objective || (r.lo ? '' : r.topic));
      c.short = c.short || str(r.objective);
      c.topic = c.topic || str(r.topic);
      c.topicKey = c.topicKey || str(r.sylTopic);
      c.level = c.level || str(r.level);
      if (isFinite(num(r.order)) && r.order != null) c.order = Math.min(c.order, num(r.order));
      c.got += num(r.awarded);
      c.att += num(r.attempted);
      c.tot += num(r.total);
      c.papers = Math.max(c.papers, num(r.papers));
      (r.history || []).forEach(function (h) { c.history.push(h); });
    });
    (Array.isArray(items) ? items : []).forEach(function (m) {
      if (!m || !m.id) return;
      var k = keyOfItem(m);
      var c = card(k);
      if (k === UNFILED) {
        c.title = 'Not filed under an objective yet';
        c.topic = 'Marked before objectives were kept';
      } else {
        c.lo = c.lo || str(m.lo);
        c.title = c.title || sentence(m.loText || m.loTitle || (m.lo ? m.lo : m.topic));
        c.short = c.short || str(m.loTitle);
        c.topic = c.topic || str(m.topic);
        c.topicKey = c.topicKey || str(m.topicKey);
        c.level = c.level || str(m.level);
        if (m.order != null && isFinite(num(m.order))) c.order = Math.min(c.order, num(m.order));
      }
      (m.cleared ? c.sorted : c.open).push(m.id);
      c.last = Math.max(c.last, num(m.createdAt));
      var dn = str(m.docName);
      if (dn && c.docs.indexOf(dn) < 0) c.docs.push(dn);
    });
    cards.forEach(function (c) {
      c.pct = pctOf(c.got, c.att);
      c.status = statusOf(c);
      c.trend = trendOf(c.history);
      var cd = codeOf(c.lo, c.level);
      c.code = cd.code;
      c.level = c.level || cd.level;
      if (!c.title) c.title = sentence(c.topic) || 'Untitled objective';
      c.lost = Math.max(0, c.att - c.got);
      c.total = c.open.length + c.sorted.length;
    });
    return cards;
  }

  /* THE ORDER.
     priority — Needs work, then Getting there, then To redo, then Secure;
                inside a band the lowest score, then the most to redo.
     mistakes — the most still to redo first.
     syllabus — the syllabus's own order, which is how a tutor reads it. */
  function sortCards(cards, how) {
    var list = (cards || []).slice();
    var ord = function (c) { return c.order === Infinity ? 1e12 : c.order; };
    var pct = function (c) { return c.pct === null ? 101 : c.pct; };
    var cmp;
    if (how === 'mistakes') {
      cmp = function (a, b) { return (b.open.length - a.open.length) || (pct(a) - pct(b)) || (ord(a) - ord(b)); };
    } else if (how === 'syllabus') {
      cmp = function (a, b) { return (ord(a) - ord(b)) || a.title.localeCompare(b.title); };
    } else {
      cmp = function (a, b) {
        return (STATUS[a.status].rank - STATUS[b.status].rank) || (pct(a) - pct(b)) ||
          (b.open.length - a.open.length) || (b.lost - a.lost) || (ord(a) - ord(b));
      };
    }
    return list.sort(cmp);
  }
  function filterCards(cards, filter) {
    return (cards || []).filter(function (c) {
      if (filter === 'secure') return c.status === 'secure';
      if (filter === 'focus') return c.status !== 'secure';
      return true;
    });
  }

  /* The four numbers in the hero, and the overall ring. */
  function summary(cards) {
    var s = { open: 0, sorted: 0, focus: 0, secure: 0, objectives: 0, got: 0, att: 0, pct: null, cleared: null };
    (cards || []).forEach(function (c) {
      s.objectives++;
      s.open += c.open.length;
      s.sorted += c.sorted.length;
      if (c.status === 'secure') s.secure++; else s.focus++;
      s.got += c.got; s.att += c.att;
    });
    s.pct = pctOf(s.got, s.att);
    s.cleared = (s.open + s.sorted) > 0 ? Math.round((s.sorted / (s.open + s.sorted)) * 100) : null;
    return s;
  }

  /* The next objective to practise: the first card in priority order with
     something left to redo. */
  function nextUp(cards) {
    var list = sortCards(cards, 'priority');
    for (var i = 0; i < list.length; i++) if (list[i].open.length) return list[i];
    return null;
  }

  /* ================================================================
     📚 THE TOPICS (v1.99.0) — the same book, one level up
     ================================================================
     Zhi Kai: "also allow another more general view of mistakes like
     fractions, percentage rather than individual learning objectives.
     put the learning objectives under the topics so practicing a topic
     like fractions is possible."

     A TOPIC IS WHAT A PARENT READS ON THE SYLLABUS. In maths that is the
     sub-strand — Whole Numbers, Fractions, Decimals, Percentage, Ratio,
     Rate and Speed, Area and Volume, Geometry, Data Analysis — which is
     the part of a card's topic line before the colon ("Fractions: Four
     Operations" → "Fractions"). So P4 and P5 Fractions are ONE topic,
     because to a parent they are. In science the card's topic is already
     the portal's own topic (Heat, Light, Magnets), so it is used whole.
     A mistake not filed under anything stays its own group, last.

     A topic card is the SAME SHAPE as an objective card (open, sorted,
     got, att, pct, status, trend, order…) so `statusOf`, `sortCards`,
     `filterCards`, `summary` and `nextUp` read it unchanged: a topic is
     Secure by exactly the rule an objective is, over its marks together.
     Its objectives ride on it as `children`, weakest first, and its open
     ids are theirs in that order — so ▶ Practise Fractions starts with
     the weakest objective in Fractions. */
  var UNFILED_TOPIC = 'Not filed yet';
  function topicNameOf(c) {
    if (!c) return '';
    if (c.key === UNFILED) return UNFILED_TOPIC;
    var t = str(c.topic).replace(/\s+/g, ' ').trim();
    if (!t) return sentence(c.title) || UNFILED_TOPIC;
    var i = t.indexOf(': ');
    return i > 0 ? t.slice(0, i).trim() : t;
  }
  /* The part of the topic line after the colon — "Four Operations" —
     which is how a topic card says what is inside it. */
  function subTopicOf(c) {
    var t = str(c && c.topic).replace(/\s+/g, ' ').trim();
    var i = t.indexOf(': ');
    return i > 0 ? t.slice(i + 2).trim() : '';
  }
  /* The papers of every objective in a topic, added up paper by paper:
     a paper is its name and its date, so two objectives marked on the
     same paper are one point on the topic's trend, not two. */
  function mergeHistory(cards) {
    var by = {}, out = [];
    (cards || []).forEach(function (c) {
      (c.history || []).forEach(function (h) {
        if (!h) return;
        var k = num(h.at) + '|' + str(h.name);
        if (!by[k]) { by[k] = { at: num(h.at), name: str(h.name), awarded: 0, attempted: 0 }; out.push(by[k]); }
        by[k].awarded += num(h.awarded);
        by[k].attempted += num(h.attempted);
      });
    });
    return out.sort(function (a, b) { return a.at - b.at; });
  }
  function levelSpan(levels) {
    var l = levels.filter(Boolean).slice().sort();
    if (!l.length) return '';
    if (l.length === 1) return l[0];
    return l[0] + '–' + l[l.length - 1].replace(/^P/, '');
  }
  function buildTopics(cards) {
    var by = {}, topics = [];
    (cards || []).forEach(function (c) {
      var name = topicNameOf(c);
      var k = 'g:' + name.toLowerCase();
      var t = by[k];
      if (!t) {
        t = by[k] = {
          key: k, kind: 'topic', name: name, title: name, short: '', topic: '', topicKey: '', lo: '', code: '',
          level: '', levels: [], subs: [], children: [], order: Infinity,
          open: [], sorted: [], got: 0, att: 0, tot: 0, history: [], papers: 0, last: 0, docs: [],
          unfiled: c.key === UNFILED
        };
        topics.push(t);
      }
      t.children.push(c);
      t.got += c.got; t.att += c.att; t.tot += c.tot;
      t.order = Math.min(t.order, c.order);
      t.last = Math.max(t.last, c.last || 0);
      if (c.level && t.levels.indexOf(c.level) < 0) t.levels.push(c.level);
      var sub = subTopicOf(c);
      if (sub && sub.toLowerCase() !== name.toLowerCase() && t.subs.indexOf(sub) < 0) t.subs.push(sub);
      (c.docs || []).forEach(function (d) { if (t.docs.indexOf(d) < 0) t.docs.push(d); });
    });
    topics.forEach(function (t) {
      t.children = sortCards(t.children, 'priority');
      t.children.forEach(function (c) {
        c.open.forEach(function (id) { t.open.push(id); });
        c.sorted.forEach(function (id) { t.sorted.push(id); });
      });
      t.history = mergeHistory(t.children);
      t.papers = t.history.length || t.docs.length;
      t.pct = pctOf(t.got, t.att);
      t.status = statusOf(t);
      t.trend = trendOf(t.history);
      t.level = levelSpan(t.levels);
      t.lost = Math.max(0, t.att - t.got);
      t.total = t.open.length + t.sorted.length;
      t.focusN = t.children.filter(function (c) { return c.status !== 'secure'; }).length;
      t.topic = t.subs.join(' · ');
    });
    /* "Not filed yet" is never a topic's peer in syllabus order. */
    topics.forEach(function (t) { if (t.unfiled) t.order = Infinity; });
    return topics;
  }

  /* An SVG arc for a ring: the circumference and the dash for a share. */
  function ringPath(pct, r) {
    var c = 2 * Math.PI * r;
    var p = pct === null || pct === undefined ? 0 : Math.max(0, Math.min(100, pct));
    return { c: c, dash: (c * p) / 100 };
  }

  /* The sparkline's points in a box w × h, 0% at the bottom. */
  function sparkPoints(points, w, h, pad) {
    pad = pad || 3;
    var n = points.length;
    if (!n) return [];
    return points.map(function (p, i) {
      var x = n === 1 ? w / 2 : pad + (i * (w - pad * 2)) / (n - 1);
      var y = pad + ((100 - p.pct) * (h - pad * 2)) / 100;
      return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
    });
  }

  /* ================================================================
     THE DRAWING
     ================================================================ */

  var SVGNS = 'http://www.w3.org/2000/svg';
  /* `view` is 'topics' (📚 the general view, the default) or 'objectives'
     (🎯 one card per learning objective, as v1.97.0 drew it). The host may
     hand in the one it remembers (`env.view`) and hear a change
     (`env.onView`); this file keeps nothing in storage. `focusFrom` is the
     topic whose sheet an objective's sheet was opened from, so ‹ goes back. */
  var VIEWS = [['topics', 'Topics'], ['objectives', 'Learning objectives']];
  var state = { env: null, host: null, sort: 'priority', filter: 'focus', shown: PAGE, focusKey: '', focusTab: 'open', focusFrom: '',
    view: 'topics', cards: [], topics: [] };

  function el(doc, tag, cls, text) {
    var e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function svg(doc, tag, attrs) {
    var e = doc.createElementNS(SVGNS, tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    return e;
  }
  function btn(doc, cls, text, onClick, title) {
    var b = el(doc, 'button', cls, text);
    b.type = 'button';
    if (title) b.title = title;
    if (onClick) b.addEventListener('click', function (ev) { ev.stopPropagation(); onClick(ev); });
    return b;
  }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }

  /* A ring with the number in the middle. `tone` is the status, or 'hero'. */
  function ringNode(doc, pct, size, tone, label) {
    var wrap = el(doc, 'div', 'lot-ring lot-ring--' + tone);
    wrap.style.width = size + 'px';
    wrap.style.height = size + 'px';
    var stroke = size >= 100 ? 10 : (size >= 64 ? 7 : 5);
    var r = (size - stroke) / 2;
    var g = ringPath(pct, r);
    var s = svg(doc, 'svg', { viewBox: '0 0 ' + size + ' ' + size, width: size, height: size, 'aria-hidden': 'true' });
    s.appendChild(svg(doc, 'circle', { cx: size / 2, cy: size / 2, r: r, 'class': 'lot-ringTrack', 'stroke-width': stroke, fill: 'none' }));
    if (pct !== null && pct !== undefined) {
      s.appendChild(svg(doc, 'circle', {
        cx: size / 2, cy: size / 2, r: r, 'class': 'lot-ringArc', 'stroke-width': stroke, fill: 'none',
        'stroke-linecap': 'round', 'stroke-dasharray': g.dash + ' ' + g.c,
        transform: 'rotate(-90 ' + size / 2 + ' ' + size / 2 + ')'
      }));
    }
    wrap.appendChild(s);
    var mid = el(doc, 'div', 'lot-ringMid');
    var big = el(doc, 'span', 'lot-ringNum', pct === null || pct === undefined ? '—' : String(pct));
    if (pct !== null && pct !== undefined) big.appendChild(el(doc, 'small', '', '%'));
    mid.appendChild(big);
    if (label) mid.appendChild(el(doc, 'span', 'lot-ringCap', label));
    wrap.appendChild(mid);
    wrap.setAttribute('role', 'img');
    wrap.setAttribute('aria-label', (label ? label + ': ' : '') + (pct === null || pct === undefined ? 'no marks yet' : pct + ' per cent'));
    return wrap;
  }

  function sparkNode(doc, trend, w, h) {
    var pts = trend.points;
    var wrap = el(doc, 'div', 'lot-spark');
    if (pts.length < 2) {
      wrap.appendChild(el(doc, 'span', 'lot-sparkNone', pts.length === 1 ? '1 paper so far' : 'No marks yet'));
      return wrap;
    }
    var xy = sparkPoints(pts, w, h, 4);
    var s = svg(doc, 'svg', { viewBox: '0 0 ' + w + ' ' + h, width: w, height: h, 'aria-hidden': 'true', 'class': 'lot-sparkSvg' });
    var area = 'M' + xy[0][0] + ' ' + (h - 2) + ' ' + xy.map(function (p) { return 'L' + p[0] + ' ' + p[1]; }).join(' ') +
      ' L' + xy[xy.length - 1][0] + ' ' + (h - 2) + ' Z';
    s.appendChild(svg(doc, 'path', { d: area, 'class': 'lot-sparkArea' }));
    s.appendChild(svg(doc, 'polyline', { points: xy.map(function (p) { return p.join(','); }).join(' '), 'class': 'lot-sparkLine', fill: 'none' }));
    var last = xy[xy.length - 1];
    s.appendChild(svg(doc, 'circle', { cx: last[0], cy: last[1], r: 3, 'class': 'lot-sparkDot' }));
    wrap.appendChild(s);
    var d = trend.delta;
    var dl = el(doc, 'span', 'lot-delta ' + (d > 0 ? 'up' : (d < 0 ? 'down' : 'flat')),
      (d > 0 ? '▲ ' + d : (d < 0 ? '▼ ' + Math.abs(d) : '● 0')) + '%');
    dl.title = 'From the first paper to the latest';
    wrap.appendChild(dl);
    wrap.setAttribute('aria-label', 'Trend over ' + pts.length + ' papers: ' + pts.map(function (p) { return p.pct + '%'; }).join(', '));
    return wrap;
  }

  /* To redo against sorted, as one bar. */
  function meterNode(doc, c) {
    var wrap = el(doc, 'div', 'lot-meter');
    var bar = el(doc, 'div', 'lot-meterBar');
    var all = c.total || 0;
    if (all) {
      var o = el(doc, 'span', 'lot-meterOpen');
      o.style.width = ((c.open.length / all) * 100) + '%';
      var s = el(doc, 'span', 'lot-meterDone');
      s.style.width = ((c.sorted.length / all) * 100) + '%';
      bar.appendChild(s);
      bar.appendChild(o);
    }
    wrap.appendChild(bar);
    var lab = el(doc, 'div', 'lot-meterLab');
    if (!all) lab.appendChild(el(doc, 'span', 'lot-muted', 'No mistakes filed'));
    else {
      var a = el(doc, 'span', 'lot-meterOpenLab', plural(c.open.length, 'to redo', 'to redo'));
      var b = el(doc, 'span', 'lot-meterDoneLab', c.sorted.length + ' sorted');
      lab.appendChild(a);
      lab.appendChild(b);
    }
    wrap.appendChild(lab);
    return wrap;
  }

  function chipsNode(doc, c) {
    var row = el(doc, 'div', 'lot-chips');
    if (c.level) row.appendChild(el(doc, 'span', 'lot-chip lot-chipLevel', c.level));
    if (c.code) row.appendChild(el(doc, 'span', 'lot-chip lot-chipCode', c.code));
    var st = el(doc, 'span', 'lot-pill lot-pill--' + c.status, STATUS[c.status].label);
    row.appendChild(st);
    return row;
  }

  function cardNode(doc, c, isNext) {
    var env = state.env;
    var card = el(doc, 'article', 'lot-card lot-card--' + c.status + (isNext ? ' lot-card--next' : ''));
    card.setAttribute('data-lot', c.key);
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', 'Open ' + c.title + ' — ' + STATUS[c.status].label +
      (c.pct === null ? '' : ', ' + c.pct + ' per cent') + ', ' + plural(c.open.length, 'mistake') + ' to redo');
    card.addEventListener('click', function () { openFocus(c.key); });
    card.addEventListener('keydown', function (e) {
      if (e.target !== card) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openFocus(c.key); }
    });
    if (isNext) card.appendChild(el(doc, 'span', 'lot-nextFlag', '★ Start here'));

    var top = el(doc, 'div', 'lot-cardTop');
    top.appendChild(ringNode(doc, c.pct, 58, c.status));
    var words = el(doc, 'div', 'lot-cardWords');
    words.appendChild(chipsNode(doc, c));
    var t = el(doc, 'h4', 'lot-cardTitle', c.title);
    words.appendChild(t);
    if (c.topic) words.appendChild(el(doc, 'div', 'lot-cardTopic', c.topic));
    top.appendChild(words);
    card.appendChild(top);

    var mid = el(doc, 'div', 'lot-cardMid');
    mid.appendChild(meterNode(doc, c));
    mid.appendChild(sparkNode(doc, c.trend, 96, 30));
    card.appendChild(mid);

    var foot = el(doc, 'div', 'lot-cardFoot');
    if (c.open.length) {
      foot.appendChild(btn(doc, 'lot-btn lot-btnPrimary', '▶ Practise ' + c.open.length,
        function () { practise(c, c.open); }, 'Try the ' + plural(c.open.length, 'question') + ' still to redo on this objective'));
    } else if (c.sorted.length) {
      foot.appendChild(btn(doc, 'lot-btn lot-btnSoft', '↻ Revise ' + c.sorted.length,
        function () { practise(c, c.sorted); }, 'Every one is sorted — practise them again to keep them sharp'));
    }
    if (env && env.canFresh && env.canFresh(c)) {
      foot.appendChild(btn(doc, 'lot-btn lot-btnGhost', '✨ New questions',
        function () { env.fresh(c); }, 'Fresh practice questions on this skill, with the answer and the working'));
    }
    var go = el(doc, 'span', 'lot-open', 'Open');
    go.appendChild(el(doc, 'span', 'lot-openArrow', '›'));
    foot.appendChild(go);
    card.appendChild(foot);
    return card;
  }

  /* 📚 A TOPIC CARD — the topic's own ring, bar and trend over every one of
     its objectives, and the objectives themselves listed inside it, the
     weakest first, each one a door straight into its own sheet. */
  var TOPIC_ROWS = 3;
  function loRowNode(doc, c, onOpen, compact) {
    var r = el(doc, compact ? 'button' : 'div', 'lot-loRow lot-loRow--' + c.status + (compact ? ' lot-loRowBtn' : ''));
    if (compact) r.type = 'button';
    r.setAttribute('data-lo', c.key);
    var dot = el(doc, 'span', 'lot-loDot');
    dot.setAttribute('aria-hidden', 'true');
    r.appendChild(dot);
    var words = el(doc, 'span', 'lot-loWords');
    var t = el(doc, 'span', 'lot-loTitle', c.title);
    words.appendChild(t);
    if (!compact) {
      var meta = el(doc, 'span', 'lot-loMeta');
      if (c.level) meta.appendChild(el(doc, 'span', 'lot-chip lot-chipLevel', c.level));
      if (c.code) meta.appendChild(el(doc, 'span', 'lot-chip lot-chipCode', c.code));
      meta.appendChild(el(doc, 'span', 'lot-pill lot-pill--' + c.status, STATUS[c.status].label));
      words.insertBefore(meta, t);
    }
    r.appendChild(words);
    var nums = el(doc, 'span', 'lot-loNums');
    nums.appendChild(el(doc, 'span', 'lot-loPct', c.pct === null ? '—' : c.pct + '%'));
    if (c.open.length) nums.appendChild(el(doc, 'span', 'lot-loOpen', c.open.length + ' to redo'));
    else if (c.sorted.length) nums.appendChild(el(doc, 'span', 'lot-loDone', '✓ ' + c.sorted.length + ' sorted'));
    r.appendChild(nums);
    r.setAttribute('aria-label', 'Open ' + c.title + ' — ' + STATUS[c.status].label +
      (c.pct === null ? '' : ', ' + c.pct + ' per cent') + ', ' + plural(c.open.length, 'mistake') + ' to redo');
    if (compact) {
      r.addEventListener('click', function (ev) { ev.stopPropagation(); onOpen(c); });
    }
    return r;
  }

  function topicCardNode(doc, t, isNext) {
    var env = state.env;
    var card = el(doc, 'article', 'lot-card lot-card--topic lot-card--' + t.status + (isNext ? ' lot-card--next' : ''));
    card.setAttribute('data-lot', t.key);
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', 'Open the topic ' + t.title + ' — ' + STATUS[t.status].label +
      (t.pct === null ? '' : ', ' + t.pct + ' per cent') + ', ' + plural(t.children.length, 'learning objective') + ', ' +
      plural(t.open.length, 'mistake') + ' to redo');
    card.addEventListener('click', function () { openFocus(t.key); });
    card.addEventListener('keydown', function (e) {
      if (e.target !== card) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openFocus(t.key); }
    });
    if (isNext) card.appendChild(el(doc, 'span', 'lot-nextFlag', '★ Start here'));

    var top = el(doc, 'div', 'lot-cardTop');
    top.appendChild(ringNode(doc, t.pct, 66, t.status));
    var words = el(doc, 'div', 'lot-cardWords');
    var chips = el(doc, 'div', 'lot-chips');
    if (t.level) chips.appendChild(el(doc, 'span', 'lot-chip lot-chipLevel', t.level));
    chips.appendChild(el(doc, 'span', 'lot-chip lot-chipCount', plural(t.children.length, 'objective')));
    chips.appendChild(el(doc, 'span', 'lot-pill lot-pill--' + t.status, STATUS[t.status].label));
    words.appendChild(chips);
    words.appendChild(el(doc, 'h4', 'lot-cardTitle lot-topicTitle', t.title));
    if (t.topic) words.appendChild(el(doc, 'div', 'lot-cardTopic', t.topic));
    top.appendChild(words);
    card.appendChild(top);

    var list = el(doc, 'div', 'lot-loList');
    t.children.slice(0, TOPIC_ROWS).forEach(function (c) {
      list.appendChild(loRowNode(doc, c, function (x) { openFocus(x.key, { from: t.key }); }, true));
    });
    if (t.children.length > TOPIC_ROWS) {
      list.appendChild(el(doc, 'div', 'lot-loMore', '+ ' + plural(t.children.length - TOPIC_ROWS, 'more objective')));
    }
    card.appendChild(list);

    var mid = el(doc, 'div', 'lot-cardMid');
    mid.appendChild(meterNode(doc, t));
    mid.appendChild(sparkNode(doc, t.trend, 96, 30));
    card.appendChild(mid);

    var foot = el(doc, 'div', 'lot-cardFoot');
    if (t.open.length) {
      foot.appendChild(btn(doc, 'lot-btn lot-btnPrimary', '▶ Practise ' + t.open.length,
        function () { practise(t, t.open); }, 'Every question still to redo in ' + t.title + ', the weakest objective first'));
    } else if (t.sorted.length) {
      foot.appendChild(btn(doc, 'lot-btn lot-btnSoft', '↻ Revise ' + t.sorted.length,
        function () { practise(t, t.sorted); }, 'Every one is sorted — practise the whole topic again to keep it sharp'));
    }
    if (env && env.canFresh && env.canFresh(t)) {
      foot.appendChild(btn(doc, 'lot-btn lot-btnGhost', '✨ New questions',
        function () { env.fresh(t); }, 'Fresh practice questions across ' + t.title + ', with the answer and the working'));
    }
    var go = el(doc, 'span', 'lot-open', 'Open');
    go.appendChild(el(doc, 'span', 'lot-openArrow', '›'));
    foot.appendChild(go);
    card.appendChild(foot);
    return card;
  }

  function practise(c, ids) {
    var env = state.env;
    if (!env || !ids || !ids.length) return;
    env.practise(ids.slice(), c);
  }

  function kpi(doc, n, label, tone, sub) {
    var k = el(doc, 'div', 'lot-kpi lot-kpi--' + tone);
    k.appendChild(el(doc, 'div', 'lot-kpiNum', String(n)));
    k.appendChild(el(doc, 'div', 'lot-kpiLab', label));
    if (sub) k.appendChild(el(doc, 'div', 'lot-kpiSub', sub));
    return k;
  }

  function heroNode(doc, cards, sum) {
    var env = state.env;
    var hero = el(doc, 'section', 'lot-hero');
    hero.setAttribute('aria-label', 'Learning objective tracker');
    var glow = el(doc, 'div', 'lot-heroGlow');
    glow.setAttribute('aria-hidden', 'true');
    hero.appendChild(glow);

    var main = el(doc, 'div', 'lot-heroMain');
    var lead = el(doc, 'div', 'lot-heroLead');
    lead.appendChild(el(doc, 'div', 'lot-eyebrow', 'Mistake tracker · ' + (env.subjectLabel || 'All subjects')));
    var name = state.view === 'topics'
      ? (env.studentName ? env.studentName + '’s progress by topic' : 'Your progress by topic')
      : (env.studentName ? env.studentName + '’s learning objectives' : 'Your learning objectives');
    lead.appendChild(el(doc, 'h2', 'lot-heroTitle', name));
    var topicsView = state.view === 'topics';
    var sub = sum.objectives
      ? (topicsView
        ? plural(state.topics.length, 'topic') + ' and ' + plural(cards.length, 'learning objective') + ' tracked' +
          (env.papers ? ' across ' + plural(env.papers, 'marked paper') : '') +
          '. Tap a topic to see its objectives, or practise the whole topic in one go.'
        : plural(sum.objectives, 'objective') + ' tracked' + (env.papers ? ' across ' + plural(env.papers, 'marked paper') : '') +
          '. Tap any objective to see its mistakes and practise them again.')
      : 'Mark a worksheet and every question you miss is filed here under the learning objective it tests.';
    lead.appendChild(el(doc, 'p', 'lot-heroSub', sub));

    if (env.subjects && env.subjects.length > 1) {
      var seg = el(doc, 'div', 'lot-seg lot-segHero');
      seg.setAttribute('role', 'tablist');
      seg.setAttribute('aria-label', 'Subject');
      env.subjects.forEach(function (s) {
        var b = btn(doc, 'lot-segBtn' + (s.key === env.subject ? ' on' : ''), s.label, function () { env.onSubject(s.key); });
        b.setAttribute('role', 'tab');
        b.setAttribute('aria-selected', s.key === env.subject ? 'true' : 'false');
        if (s.n != null) b.appendChild(el(doc, 'span', 'lot-segN', String(s.n)));
        seg.appendChild(b);
      });
      lead.appendChild(seg);
    }
    main.appendChild(lead);

    var side = el(doc, 'div', 'lot-heroSide');
    side.appendChild(ringNode(doc, sum.pct, 132, 'hero', 'mastery'));
    var cap = el(doc, 'div', 'lot-heroRingCap', sum.pct === null ? 'Mastery appears once a paper is marked'
      : 'Marks got over marks attempted, every marked paper');
    side.appendChild(cap);
    main.appendChild(side);
    hero.appendChild(main);

    var kpis = el(doc, 'div', 'lot-kpis');
    kpis.appendChild(kpi(doc, sum.open, 'Still to redo', 'open'));
    kpis.appendChild(kpi(doc, sum.sorted, 'Sorted', 'done', sum.cleared === null ? '' : sum.cleared + '% of the book'));
    kpis.appendChild(kpi(doc, sum.focus, (topicsView ? 'Topics' : 'Objectives') + ' to work on', 'focus'));
    kpis.appendChild(kpi(doc, sum.secure, (topicsView ? 'Topics' : 'Objectives') + ' secure', 'secure'));
    hero.appendChild(kpis);

    var acts = el(doc, 'div', 'lot-heroActs');
    var next = nextUp(cards);
    if (next) {
      var nb = btn(doc, 'lot-btn lot-btnHero', '▶ Start with the weakest', function () { practise(next, next.open); },
        'Practise ' + next.title);
      acts.appendChild(nb);
      acts.appendChild(el(doc, 'span', 'lot-heroNext', next.title));
    }
    if (env.quick) acts.appendChild(btn(doc, 'lot-btn lot-btnGlass', '⚡ Quick practice', function () { env.quick(); },
      'Practise a few questions from the whole book, picked for you'));
    hero.appendChild(acts);
    return hero;
  }

  /* 📚 / 🎯 — the two ways to read the book, as one switch above the list.
     It says how many of each there are, so a parent sees at once that the
     nine topics hold the twenty objectives. */
  function viewBarNode(doc, cards) {
    var env = state.env;
    var bar = el(doc, 'div', 'lot-viewBar');
    var words = el(doc, 'div', 'lot-viewWords');
    var topicsView = state.view === 'topics';
    words.appendChild(el(doc, 'h3', 'lot-sectionTitle', topicsView ? 'Topics' : 'Learning objectives'));
    words.appendChild(el(doc, 'p', 'lot-viewSub', topicsView
      ? 'Each topic holds its learning objectives. Practise a whole topic, or open it to work on one objective.'
      : 'Every learning objective on its own, with its topic underneath.'));
    bar.appendChild(words);
    var seg = el(doc, 'div', 'lot-seg lot-segView');
    seg.setAttribute('role', 'tablist');
    seg.setAttribute('aria-label', 'Read the book by');
    VIEWS.forEach(function (v) {
      var on = state.view === v[0];
      var b = btn(doc, 'lot-segBtn' + (on ? ' on' : ''), (v[0] === 'topics' ? '📚 ' : '🎯 ') + v[1], function () {
        if (state.view === v[0]) return;
        state.view = v[0]; state.shown = PAGE;
        if (env && env.onView) env.onView(v[0]);
        draw();
      });
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.setAttribute('data-view', v[0]);
      b.appendChild(el(doc, 'span', 'lot-segN', String(v[0] === 'topics' ? state.topics.length : cards.length)));
      seg.appendChild(b);
    });
    bar.appendChild(seg);
    return bar;
  }

  function toolbarNode(doc, cards) {
    var bar = el(doc, 'div', 'lot-tools');
    var topicsView = state.view === 'topics';
    var seg = el(doc, 'div', 'lot-seg');
    seg.setAttribute('role', 'tablist');
    seg.setAttribute('aria-label', topicsView ? 'Which topics' : 'Which objectives');
    FILTERS.forEach(function (f) {
      var n = filterCards(cards, f[0]).length;
      var label = f[0] === 'all' ? (topicsView ? 'All topics' : f[1]) : f[1];
      var b = btn(doc, 'lot-segBtn' + (state.filter === f[0] ? ' on' : ''), label, function () {
        state.filter = f[0]; state.shown = PAGE; draw();
      });
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', state.filter === f[0] ? 'true' : 'false');
      b.appendChild(el(doc, 'span', 'lot-segN', String(n)));
      seg.appendChild(b);
    });
    bar.appendChild(seg);
    var wrap = el(doc, 'label', 'lot-sort');
    wrap.appendChild(el(doc, 'span', '', 'Order'));
    var sel = el(doc, 'select', '');
    sel.setAttribute('aria-label', topicsView ? 'Order the topics' : 'Order the objectives');
    SORTS.forEach(function (s) {
      var o = el(doc, 'option', '', s[1]);
      o.value = s[0];
      if (state.sort === s[0]) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener('change', function () { state.sort = sel.value; draw(); });
    wrap.appendChild(sel);
    bar.appendChild(wrap);
    return bar;
  }

  function emptyNode(doc, filter, any) {
    var e = el(doc, 'div', 'lot-empty');
    e.appendChild(el(doc, 'div', 'lot-emptyIcon', any ? (filter === 'secure' ? '🌱' : '🏆') : '🎯'));
    var what = state.view === 'topics' ? 'topic' : 'objective';
    e.appendChild(el(doc, 'div', 'lot-emptyTitle', !any ? 'Nothing to track yet'
      : (filter === 'secure' ? 'No ' + what + ' is secure yet' : 'Every ' + what + ' is secure')));
    e.appendChild(el(doc, 'div', 'lot-emptySub', !any
      ? 'Mark a worksheet and each question missed is filed here under its learning objective, ready to practise again.'
      : (filter === 'secure' ? 'Keep practising — ' + (what === 'topic' ? 'a topic' : 'an objective') + ' turns green at ' + SECURE_PCT + '% with nothing left to redo.'
        : 'Nothing is left to redo. Fresh questions keep them sharp.')));
    return e;
  }

  /* Syllabus order reads in topics, so the cards are grouped under them;
     the other orders are one list, because a heading between every card
     would undo the order that was asked for. */
  function gridNode(doc, list, next) {
    var out = el(doc, 'div', 'lot-gridWrap');
    if (state.view === 'topics') {
      var tg = el(doc, 'div', 'lot-grid lot-gridTopics');
      list.forEach(function (t) { tg.appendChild(topicCardNode(doc, t, next && next.key === t.key)); });
      out.appendChild(tg);
      return out;
    }
    if (state.sort === 'syllabus') {
      var groups = [], by = {};
      list.forEach(function (c) {
        var k = c.topic || 'Other';
        if (!by[k]) { by[k] = { name: k, cards: [] }; groups.push(by[k]); }
        by[k].cards.push(c);
      });
      groups.forEach(function (g) {
        var h = el(doc, 'div', 'lot-topicHead');
        h.appendChild(el(doc, 'span', 'lot-topicName', g.name));
        var open = g.cards.reduce(function (a, c) { return a + c.open.length; }, 0);
        h.appendChild(el(doc, 'span', 'lot-topicN', plural(g.cards.length, 'objective') + (open ? ' · ' + open + ' to redo' : '')));
        out.appendChild(h);
        var grid = el(doc, 'div', 'lot-grid');
        g.cards.forEach(function (c) { grid.appendChild(cardNode(doc, c, next && next.key === c.key)); });
        out.appendChild(grid);
      });
      return out;
    }
    var grid = el(doc, 'div', 'lot-grid');
    list.forEach(function (c) { grid.appendChild(cardNode(doc, c, next && next.key === c.key)); });
    out.appendChild(grid);
    return out;
  }

  function draw() {
    var env = state.env, host = state.host;
    if (!env || !host) return;
    var doc = host.ownerDocument || root.document;
    var cards = build(env.items || [], env.rows || []);
    state.cards = cards;
    state.topics = buildTopics(cards);
    if (env.view === 'topics' || env.view === 'objectives') { state.view = env.view; env.view = ''; }
    var units = state.view === 'topics' ? state.topics : cards;
    var sum = summary(units);
    host.innerHTML = '';
    host.classList.add('lot');
    host.appendChild(heroNode(doc, cards, sum));
    if (!cards.length) {
      host.appendChild(emptyNode(doc, 'all', false));
      syncFocus();
      return;
    }
    host.appendChild(viewBarNode(doc, cards));
    host.appendChild(toolbarNode(doc, units));
    var list = sortCards(filterCards(units, state.filter), state.sort);
    if (!list.length) host.appendChild(emptyNode(doc, state.filter, true));
    else {
      var next = state.sort === 'priority' && state.filter !== 'secure' ? nextUp(units) : null;
      var shown = list.slice(0, state.shown);
      host.appendChild(gridNode(doc, shown, next));
      if (list.length > shown.length) {
        var more = btn(doc, 'lot-btn lot-btnMore', 'Show ' + Math.min(PAGE, list.length - shown.length) + ' more of ' +
          (list.length - shown.length), function () { state.shown += PAGE; draw(); });
        host.appendChild(more);
      }
    }
    syncFocus();
  }

  /* ================================================================
     ③ THE OBJECTIVE — the sheet
     ================================================================ */
  function focusRoot() {
    var doc = (state.host && state.host.ownerDocument) || root.document;
    var back = doc.getElementById('lotFocus');
    if (back) return back;
    back = el(doc, 'div', 'modalBack lot-focusBack');
    back.id = 'lotFocus';
    back.setAttribute('role', 'dialog');
    back.setAttribute('aria-modal', 'true');
    back.setAttribute('aria-labelledby', 'lotFocusTitle');
    back.addEventListener('click', function (e) { if (e.target === back) closeFocus(); });
    var sheet = el(doc, 'div', 'lot-sheet');
    sheet.id = 'lotSheet';
    sheet.tabIndex = -1;
    back.appendChild(sheet);
    doc.body.appendChild(back);
    return back;
  }
  function isFocusOpen() {
    var doc = (state.host && state.host.ownerDocument) || root.document;
    var b = doc && doc.getElementById('lotFocus');
    return !!(b && b.classList.contains('open'));
  }
  /* `opts.from` — the topic this objective was opened from (its sheet, or
     a row on its card), so the objective's sheet offers ‹ back to it. */
  function openFocus(key, opts) {
    var c = findCard(key);
    if (!c) return;
    var from = opts && opts.from && findCard(opts.from) ? opts.from : '';
    state.focusFrom = c.kind === 'topic' ? '' : from;
    state.focusKey = key;
    state.focusTab = c.open.length ? 'open' : 'sorted';
    var back = focusRoot();
    back.classList.add('open');
    drawFocus();
    var sheet = back.querySelector('.lot-sheet');
    if (sheet) { sheet.scrollTop = 0; try { sheet.focus({ preventScroll: true }); } catch (e) { /* old Safari */ } }
    if (state.env && state.env.onFocus) state.env.onFocus(c);
  }
  function closeFocus() {
    var doc = (state.host && state.host.ownerDocument) || root.document;
    var b = doc && doc.getElementById('lotFocus');
    if (b) b.classList.remove('open');
    state.focusKey = '';
    state.focusFrom = '';
  }
  function findCard(key) {
    for (var i = 0; i < state.cards.length; i++) if (state.cards[i].key === key) return state.cards[i];
    for (var j = 0; j < state.topics.length; j++) if (state.topics[j].key === key) return state.topics[j];
    return null;
  }
  /* After the book changes (a question sorted in ✏️ Practise, a card
     deleted), an open sheet is drawn again from the new numbers — or
     closed when its objective has gone from the book altogether. */
  function syncFocus() {
    if (!state.focusKey || !isFocusOpen()) return;
    if (!findCard(state.focusKey)) { closeFocus(); return; }
    drawFocus();
  }

  function statNode(doc, n, label) {
    var s = el(doc, 'div', 'lot-stat');
    s.appendChild(el(doc, 'div', 'lot-statNum', String(n)));
    s.appendChild(el(doc, 'div', 'lot-statLab', label));
    return s;
  }

  /* The score paper by paper as columns — taller is better — named under
     each, newest on the right. */
  function papersNode(doc, c) {
    var pts = c.trend.points;
    var box = el(doc, 'div', 'lot-papers');
    var head = el(doc, 'div', 'lot-blockHead');
    head.appendChild(el(doc, 'h4', '', 'Paper by paper'));
    if (c.trend.delta !== null) {
      var d = c.trend.delta;
      head.appendChild(el(doc, 'span', 'lot-delta ' + (d > 0 ? 'up' : (d < 0 ? 'down' : 'flat')),
        (d > 0 ? '▲ ' + d + '% since the first paper' : (d < 0 ? '▼ ' + Math.abs(d) + '% since the first paper' : 'Holding steady'))));
    }
    box.appendChild(head);
    if (!pts.length) {
      box.appendChild(el(doc, 'p', 'lot-muted', 'No marks on this ' + (c.kind === 'topic' ? 'topic' : 'objective') +
        ' yet — these mistakes were filed before the objective tracking began.'));
      return box;
    }
    var cols = el(doc, 'div', 'lot-cols');
    pts.forEach(function (p) {
      var col = el(doc, 'div', 'lot-col');
      var tone = p.pct >= SECURE_PCT ? 'secure' : (p.pct >= CLOSE_PCT ? 'close' : 'work');
      var barBox = el(doc, 'div', 'lot-colBox');
      var bar = el(doc, 'div', 'lot-colBar lot-colBar--' + tone);
      bar.style.height = Math.max(4, p.pct) + '%';
      barBox.appendChild(bar);
      col.appendChild(el(doc, 'div', 'lot-colPct', p.pct + '%'));
      col.appendChild(barBox);
      var nm = el(doc, 'div', 'lot-colName', p.name || 'Paper');
      nm.title = p.name || '';
      col.appendChild(nm);
      cols.appendChild(col);
    });
    box.appendChild(cols);
    return box;
  }

  /* 📚 The objectives inside a topic, on its sheet: every one, weakest
     first, each a row with its own ring, its score and what is left to
     redo, ▶ to practise just that one, and a tap to open its own sheet
     (which then offers ‹ back to this topic). */
  function topicObjectivesNode(doc, t) {
    var box = el(doc, 'div', 'lot-papers lot-topicLos');
    var head = el(doc, 'div', 'lot-blockHead');
    head.appendChild(el(doc, 'h4', '', 'Learning objectives in ' + t.title));
    head.appendChild(el(doc, 'span', 'lot-muted', t.focusN ? t.focusN + ' to work on' : 'All secure'));
    box.appendChild(head);
    var list = el(doc, 'div', 'lot-loRows');
    t.children.forEach(function (c) {
      var row = el(doc, 'div', 'lot-loItem lot-loItem--' + c.status);
      row.setAttribute('data-lo', c.key);
      row.tabIndex = 0;
      row.setAttribute('role', 'button');
      var open = function () { openFocus(c.key, { from: t.key }); };
      row.addEventListener('click', open);
      row.addEventListener('keydown', function (e) {
        if (e.target !== row) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
      });
      row.appendChild(ringNode(doc, c.pct, 46, c.status));
      var info = loRowNode(doc, c, open, false);
      row.setAttribute('aria-label', info.getAttribute('aria-label'));
      row.appendChild(info);
      var right = el(doc, 'div', 'lot-loItemActs');
      if (c.open.length) {
        right.appendChild(btn(doc, 'lot-btn lot-btnSoftTeal', '▶ ' + c.open.length, function () { practise(c, c.open); },
          'Practise the ' + plural(c.open.length, 'mistake') + ' to redo on this objective'));
      }
      var arrow = el(doc, 'span', 'lot-openArrow', '›');
      arrow.setAttribute('aria-hidden', 'true');
      right.appendChild(arrow);
      row.appendChild(right);
      list.appendChild(row);
    });
    box.appendChild(list);
    return box;
  }

  function drawFocus() {
    var env = state.env;
    var c = findCard(state.focusKey);
    var back = focusRoot();
    var sheet = back.querySelector('.lot-sheet');
    if (!c || !sheet || !env) return;
    var doc = sheet.ownerDocument;
    var keepScroll = sheet.scrollTop;
    sheet.innerHTML = '';
    sheet.className = 'lot-sheet lot-sheet--' + c.status;

    var isTopic = c.kind === 'topic';
    var parent = !isTopic && state.focusFrom ? findCard(state.focusFrom) : null;
    if (isTopic) sheet.className += ' lot-sheet--topic';

    var grab = el(doc, 'div', 'lot-grab');
    grab.setAttribute('aria-hidden', 'true');
    sheet.appendChild(grab);

    var head = el(doc, 'div', 'lot-sheetHead');
    head.appendChild(ringNode(doc, c.pct, 92, c.status, 'score'));
    var words = el(doc, 'div', 'lot-sheetWords');
    if (parent) {
      var backBtn = btn(doc, 'lot-back', '‹ ' + parent.title, function () { openFocus(parent.key); }, 'Back to the topic ' + parent.title);
      backBtn.setAttribute('aria-label', 'Back to the topic ' + parent.title);
      words.appendChild(backBtn);
    }
    if (isTopic) {
      var tchips = el(doc, 'div', 'lot-chips');
      tchips.appendChild(el(doc, 'span', 'lot-chip lot-chipTopic', '📚 Topic'));
      if (c.level) tchips.appendChild(el(doc, 'span', 'lot-chip lot-chipLevel', c.level));
      tchips.appendChild(el(doc, 'span', 'lot-pill lot-pill--' + c.status, STATUS[c.status].label));
      words.appendChild(tchips);
    } else {
      words.appendChild(chipsNode(doc, c));
    }
    var h = el(doc, 'h2', 'lot-sheetTitle', c.title);
    h.id = 'lotFocusTitle';
    words.appendChild(h);
    var line = isTopic
      ? plural(c.children.length, 'learning objective') + (c.topic ? ' · ' + c.topic : '')
      : c.topic;
    if (line) words.appendChild(el(doc, 'div', 'lot-sheetTopic', (env.subjectLabel ? env.subjectLabel + ' · ' : '') + line));
    head.appendChild(words);
    var x = btn(doc, 'lot-close', '✕', closeFocus, 'Close');
    x.setAttribute('aria-label', 'Close');
    head.appendChild(x);
    sheet.appendChild(head);

    var stats = el(doc, 'div', 'lot-stats');
    stats.appendChild(statNode(doc, c.open.length, 'still to redo'));
    stats.appendChild(statNode(doc, c.sorted.length, 'sorted'));
    stats.appendChild(statNode(doc, c.att ? (Math.round(c.got * 10) / 10) + '/' + (Math.round(c.att * 10) / 10) : '—', 'marks got'));
    if (isTopic) {
      stats.appendChild(statNode(doc, c.focusN + '/' + c.children.length, 'objectives to work on'));
    } else {
      stats.appendChild(statNode(doc, c.papers || c.docs.length || 0, (c.papers || c.docs.length) === 1 ? 'paper' : 'papers'));
    }
    sheet.appendChild(stats);

    var acts = el(doc, 'div', 'lot-sheetActs');
    if (c.open.length) {
      acts.appendChild(btn(doc, 'lot-btn lot-btnPrimary lot-btnBig', isTopic
        ? '▶ Practise all ' + plural(c.open.length, 'mistake') + ' in ' + c.title
        : '▶ Practise the ' + plural(c.open.length, 'mistake') + ' to redo',
        function () { practise(c, c.open); }));
    } else if (c.sorted.length) {
      acts.appendChild(btn(doc, 'lot-btn lot-btnPrimary lot-btnBig', isTopic
        ? '↻ Revise all ' + c.sorted.length + ' in ' + c.title
        : '↻ Revise all ' + c.sorted.length + ' again',
        function () { practise(c, c.sorted); }));
    }
    if (env.canFresh && env.canFresh(c)) {
      acts.appendChild(btn(doc, 'lot-btn lot-btnSecondary lot-btnBig', isTopic ? '✨ Fresh questions on ' + c.title : '✨ Fresh practice questions',
        function () { env.fresh(c); }, isTopic ? 'New questions across every objective in ' + c.title + ', with the answer and the working'
          : 'New questions on the same skill, with the answer and the working'));
    }
    var ids = c.open.concat(c.sorted);
    if (ids.length && env.print) {
      var pr = el(doc, 'div', 'lot-printRow');
      var keyBox = el(doc, 'label', 'lot-check');
      var cb = el(doc, 'input', '');
      cb.type = 'checkbox';
      cb.id = 'lotPrintKey';
      keyBox.appendChild(cb);
      keyBox.appendChild(el(doc, 'span', '', 'with the answers'));
      pr.appendChild(btn(doc, 'lot-btn lot-btnGhost', '🖨 Print a worksheet of ' + (c.open.length || ids.length),
        function () { env.print(c.open.length ? c.open : ids, cb.checked, c); }, 'Print them — or save as a PDF from the print dialog'));
      pr.appendChild(keyBox);
      acts.appendChild(pr);
    }
    sheet.appendChild(acts);

    if (isTopic) sheet.appendChild(topicObjectivesNode(doc, c));
    sheet.appendChild(papersNode(doc, c));

    var list = el(doc, 'div', 'lot-mistakes');
    var lh = el(doc, 'div', 'lot-blockHead');
    lh.appendChild(el(doc, 'h4', '', 'The mistakes'));
    var tabs = el(doc, 'div', 'lot-seg lot-segSm');
    tabs.setAttribute('role', 'tablist');
    [['open', 'To redo', c.open], ['sorted', 'Sorted', c.sorted]].forEach(function (t) {
      var b = btn(doc, 'lot-segBtn' + (state.focusTab === t[0] ? ' on' : ''), t[1], function () { state.focusTab = t[0]; drawFocus(); });
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', state.focusTab === t[0] ? 'true' : 'false');
      b.appendChild(el(doc, 'span', 'lot-segN', String(t[2].length)));
      tabs.appendChild(b);
    });
    lh.appendChild(tabs);
    list.appendChild(lh);
    var want = state.focusTab === 'sorted' ? c.sorted : c.open;
    if (!want.length) {
      list.appendChild(el(doc, 'p', 'lot-muted lot-pad', state.focusTab === 'sorted'
        ? 'Nothing sorted yet — get one right in ▶ Practise and it moves here.'
        : 'Nothing left to redo in this ' + (isTopic ? 'topic' : 'objective') + '. 🎉'));
    } else {
      var grid = el(doc, 'div', 'lot-mistGrid');
      want.forEach(function (id) {
        var node = env.cardNode ? env.cardNode(id) : null;
        if (node) grid.appendChild(node);
      });
      list.appendChild(grid);
    }
    sheet.appendChild(list);
    sheet.scrollTop = keepScroll;
  }

  /* ================================================================
     THE DOOR
     ================================================================ */
  /* `env` — see the header. Mounting again (every `renderMistakes`) keeps
     the order, the filter and an open sheet as they were. */
  function mount(host, env) {
    if (!host) return;
    if (state.host !== host) { state.shown = PAGE; }
    state.host = host;
    state.env = env || {};
    draw();
  }
  function reset() {
    state.sort = 'priority'; state.filter = 'focus'; state.shown = PAGE; state.view = 'topics';
  }

  return {
    pure: {
      build: build, buildTopics: buildTopics, topicNameOf: topicNameOf, subTopicOf: subTopicOf, mergeHistory: mergeHistory,
      levelSpan: levelSpan, statusOf: statusOf, sortCards: sortCards, filterCards: filterCards, summary: summary,
      nextUp: nextUp, codeOf: codeOf, sentence: sentence, trendOf: trendOf, ringPath: ringPath,
      sparkPoints: sparkPoints, pctOf: pctOf
    },
    mount: mount,
    reset: reset,
    openFocus: openFocus,
    closeFocus: closeFocus,
    isFocusOpen: isFocusOpen,
    focusKey: function () { return state.focusKey; },
    cards: function () { return state.cards.slice(); },
    topics: function () { return state.topics.slice(); },
    view: function () { return state.view; },
    VIEWS: VIEWS,
    SECURE_PCT: SECURE_PCT,
    CLOSE_PCT: CLOSE_PCT,
    PAGE: PAGE,
    SORTS: SORTS,
    FILTERS: FILTERS,
    STATUS: STATUS
  };
});
