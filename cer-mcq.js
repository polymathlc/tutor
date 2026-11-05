/* =====================================================================
   🔘 A WRONG MCQ, TRIED AGAIN IN THE SCIENCE PORTAL'S OWN FORMAT (cer-mcq.js)

   When a question a student got wrong was multiple choice, Study Buddy
   used to hand it back with a text box ("Write it out again…") or a row of
   plain buttons. This draws it the way the Science portal (polymathlc/cer)
   draws every MCQ in practice, so a child meets the same thing in both
   apps:

     · the options as full-width rows, a radio and "<b>1.</b> the words"
       (`renderImportedBlockStudent`, case 'mcq');
     · picking one only HIGHLIGHTS it, in a neutral blue — never right or
       wrong before ✓ Check answer (`markMcqChoice`);
     · 💡 Hint and ✓ Check answer under the options (`_partActionsHtml`),
       the hint in the brass box, never giving the answer away
       (`hintQuestionPart`);
     · marked: the right option GREEN, the chosen wrong one RED, and
       "✗ Incorrect (you chose 3)" with "Correct answer: 2) …" beneath
       (`_mcqPaintResult` + the local MCQ mark);
     · 🔎 WHY NOT THIS ONE — every option the student did not get right
       grows an ⓘ on its right-hand edge once it is marked. Hover it (tap
       it on a touch screen) and a card says why that option is wrong,
       against the evidence actually printed in the question
       (`wnyArm`, `_wnyPrompt`, `_wnyNormItems`, `_wnyPlace`).

   The rules the portal's version holds are held here too, word for word
   where they apply:

     • IT IS A VISION CALL. A distractor is wrong because of what the
       figure, the table or the numbers SHOW, so the host's pictures of the
       question go with it (`spec.images`).
     • It arms only AFTER marking (or after "Show me the answer"). Armed a
       moment earlier it is an answer key: the badges sit on the WRONG
       options, so before marking they would point straight at the right one.
     • ONE call covers the WHOLE option list, never one per option.
     • An answer is placed against an option by the option's OWN number and
       nothing else (`normItems`). A reason under the wrong option reads
       perfectly and teaches a child something untrue.
     • A badge goes on the wrong options only: the right one is already
       painted green with the answer beside it.

   Two things are new, because a mistake book is not a question bank:

     • THE RIGHT OPTION MAY NOT BE RECORDED. A filed mistake carries the
       paper's key as words ("(2) 36 cm") and sometimes the option's number.
       `correctIndex` reads either. When neither names an option, the ONE
       why-not call is asked to work out which option is right as well, so a
       question with no recorded option can still be marked — and the
       reasons come back in the same reply.
     • THIS FILE NEVER TALKS TO A MODEL ITSELF. The host hands it `ask`
       (Study Buddy's grounded `lpAsk`) and `parse`, exactly like
       lo-practice.js, so the routing, the rationing and the teacher's
       notes stay the app's.

   EVERYTHING the student or a model wrote is put in with textContent.
   ===================================================================== */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  if (root) root.CerMcq = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function (root) {
  'use strict';

  var VERSION = 1;
  var WNY_HOVER_MS = 160;      // hover intent — a cursor crossing the list must not fire four cards
  var WNY_HIDE_MS = 160;       // grace on the way out, so moving INTO the card doesn't close it
  var WNY_WHY_MAX = 320;       // characters kept: the card is a glance, not an essay
  var OPTS_MAX = 8;
  var CACHE_PREFIX = 'cmq1:';
  var IMG_SIDE = 1100;         // longest side of a picture sent with the call
  var IMG_MAX = 4;
  var LETTERS = 'ABCDEFGH';

  /* ---------------------------------------------------------------
     PURE HELPERS — no document, no model. The node tests drive these.
     --------------------------------------------------------------- */
  function str(v, max) {
    var s = String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
    return max ? s.slice(0, max) : s;
  }
  function hash(s) {
    var h = 5381, t = String(s == null ? '' : s);
    for (var i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36) + t.length.toString(36);
  }
  /* The portal's `_normMcqChoice`: "(2)", "2.", "Option B", "b" all become
     the canonical NUMBER as a string — "2". A–H read as 1–8. */
  function normChoice(raw) {
    var s = String(raw == null ? '' : raw).trim().toUpperCase();
    if (!s) return '';
    s = s.replace(/^(?:THE\s+)?(?:OPTION|CHOICE|ANSWER|ANS|CHOSEN)\b[\s:.#-]{0,12}/, '').replace(/^[\s(\[{]+/, '');
    var lead = s.match(/^(\d+|[A-H])(?![A-Z0-9])/);
    if (lead) return /\d/.test(lead[1]) ? String(parseInt(lead[1], 10)) : String(lead[1].charCodeAt(0) - 64);
    var digits = s.match(/\d+/);
    return digits ? String(parseInt(digits[0], 10)) : '';
  }
  /* How an option is DRAWN. The paper's own label when it has one ("1",
     "A"), else the position in the style asked for. */
  function labelOf(opt, i, letters) {
    var own = str(opt && opt.label, 4).replace(/[()\s.]/g, '');
    if (own) return own;
    return letters ? LETTERS.charAt(i) || String(i + 1) : String(i + 1);
  }
  /* An option whose whole text is its own bracketed marker — the "(3)" a
     picture option is given — is drawn as the label alone, as the portal's
     `mcqOptionText` does. */
  var BARE_RE = /^\s*\(?\s*([1-9]|[A-Ha-h])\s*\)?\s*\.?\s*$/;
  function optionText(opt, i) {
    var t = str(opt && opt.text, 400);
    var m = t.match(BARE_RE);
    if (m && normChoice(m[1]) === String(i + 1)) return '';
    return t;
  }
  /* The options in ONE shape: [{ n: "1", label: "1"|"A", text, correct }].
     `n` is the canonical number every comparison uses; `label` is only
     what is drawn. A picture question with no word options is given
     `count` empty rows, so (1)…(4) can still be chosen between. */
  function optionsOf(spec) {
    var list = Array.isArray(spec && spec.options) ? spec.options.slice(0, OPTS_MAX) : [];
    var letters = !!(spec && spec.letters);
    var out = list.map(function (o, i) {
      return { n: String(i + 1), label: labelOf(o, i, letters), text: optionText(o, i) };
    });
    var count = Math.min(OPTS_MAX, Number(spec && spec.count) || 0);
    if (out.length < 2 && count >= 2) {
      out = [];
      for (var i = 0; i < count; i++) out.push({ n: String(i + 1), label: letters ? LETTERS.charAt(i) : String(i + 1), text: '' });
    }
    return out;
  }
  function wordsOf(s) {
    return String(s == null ? '' : s).toLowerCase().replace(/[’']/g, '')
      .replace(/[^a-z0-9.½\/%]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  /* WHICH OPTION IS RIGHT, from what the mistake book kept.
       ① `option` — the correct option's number or letter, as the marking
         read it off the paper's key ("2", "B");
       ② the key's own words, when they START with a label ("(2) 36 cm");
       ③ the key's words matched against ONE option's words.
     -1 when none of them names exactly one option. A guess here would mark
     a child wrong for the right answer, so an unsure key is unsure. */
  function correctIndex(opts, option, key) {
    var list = opts || [];
    if (!list.length) return -1;
    var byNum = function (raw) {
      var n = normChoice(raw);
      if (!n) return -1;
      for (var i = 0; i < list.length; i++) {
        if (normChoice(list[i].label) === n && /^[A-Ha-h1-9]$/.test(String(list[i].label))) return i;
      }
      var k = parseInt(n, 10) - 1;
      return k >= 0 && k < list.length ? k : -1;
    };
    var o = str(option, 12);
    if (o && /^\(?\s*(?:[1-9]|[A-Ha-h])\s*\)?\.?$/.test(o)) {
      var a = byNum(o);
      if (a >= 0) return a;
    }
    var k = str(key, 400);
    if (!k) return -1;
    var head = /^\(?\s*([1-9]|[A-Ha-h])\s*[).:]?(?:\s|$)/.exec(k);
    if (head && (/[()\.:]/.test(head[0]) || k.length <= 2 || /^\(?\s*[1-9]\s*\)/.test(k))) {
      var b = byNum(head[1]);
      if (b >= 0) return b;
    }
    var bare = wordsOf(k.replace(/^\(?\s*(?:[1-9]|[A-Ha-h])\s*[).:]\s*/, ''));
    if (!bare) return -1;
    var hits = [];
    list.forEach(function (x, i) {
      var w = wordsOf(x.text);
      if (!w) return;
      if (w === bare) hits.push(i);
    });
    if (hits.length === 1) return hits[0];
    if (!hits.length) {
      list.forEach(function (x, i) {
        var w = wordsOf(x.text);
        if (w && w.length > 2 && (bare.indexOf(w) >= 0 || w.indexOf(bare) >= 0)) hits.push(i);
      });
      if (hits.length === 1) return hits[0];
    }
    return -1;
  }
  function clean(v) {
    return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, WNY_WHY_MAX);
  }
  /* The portal's `_wnyNormItems`, unchanged in substance: the model's
     reasons put back against the options they were written about, by the
     entry's OWN number ("(2)", "2." and "B" all land on option 2), a number
     the list does not have is dropped, a repeat is a duplicate. Positional
     order is the fallback ONLY when nothing at all was numbered and there is
     exactly one entry per option. */
  function normItems(parsed, opts) {
    var raw = Array.isArray(parsed) ? parsed
      : ((parsed && (parsed.options || parsed.items || parsed.reasons)) || []);
    var list = Array.isArray(raw) ? raw : [];
    var options = opts || [];
    var known = {};
    options.forEach(function (o) { known[String(o && o.n)] = 1; });
    var out = {};
    var numbered = 0;
    list.forEach(function (it) {
      if (!it || typeof it !== 'object') return;
      var src = it.n != null ? it.n : (it.option != null ? it.option : (it.number != null ? it.number : it.letter));
      var n = labelToNum(src, options);
      if (!n || !known[n]) return;
      numbered++;
      if (out[n]) return;
      var why = clean(it.why != null ? it.why : (it.reason != null ? it.reason : it.text));
      if (why) out[n] = why;
    });
    if (!numbered && list.length === options.length) {
      options.forEach(function (o, i) {
        var it = list[i];
        var why = clean(it && typeof it === 'object' ? (it.why != null ? it.why : it.reason) : it);
        if (why) out[String(o && o.n)] = why;
      });
    }
    return out;
  }
  /* A label as DRAWN ("B" on a lettered paper, "2" on a numbered one) back
     to the canonical number. An exact label match first, so a paper that
     prints its options A–D is read by its letters and not by position. */
  function labelToNum(raw, opts) {
    var s = String(raw == null ? '' : raw).trim().replace(/^\(\s*|\s*\)$/g, '').replace(/\.$/, '');
    var list = opts || [];
    for (var i = 0; i < list.length; i++) {
      if (s && String(list[i].label).toUpperCase() === s.toUpperCase()) return String(list[i].n);
    }
    return normChoice(raw);
  }
  /* "Option (2) is the correct one" — or, when the book never recorded it,
     the model is asked to settle it first and say so in `correct`. */
  function correctOf(parsed, opts) {
    if (!parsed || typeof parsed !== 'object') return -1;
    var c = parsed.correct != null ? parsed.correct : (parsed.answer != null ? parsed.answer : parsed.right);
    if (c == null || c === '') return -1;
    var n = labelToNum(c, opts);
    var k = parseInt(n, 10) - 1;
    return k >= 0 && k < (opts || []).length ? k : -1;
  }
  function subjectWord(sub) {
    var s = String(sub || '').toLowerCase();
    if (/^(math|maths|mathematics)/.test(s)) return 'maths';
    if (/^sci/.test(s)) return 'science';
    if (/^eng/.test(s)) return 'English';
    if (/^(chi|cl|mt|mother)/.test(s)) return 'Chinese';
    return s ? s : '';
  }
  /* The portal's `_wnyPrompt`, for any subject. The options go in AS THE
     STUDENT SAW THEM, and the reply is read back by the label printed. */
  function whyPrompt(spec, opts, correct) {
    var sub = subjectWord(spec && spec.subject);
    var lvl = str(spec && spec.level, 20);
    var who = 'You are a patient Singapore ' + (lvl ? lvl + ' ' : 'primary-school ') + (sub ? sub + ' ' : '') + 'teacher.';
    var printed = opts.map(function (o) {
      return '(' + o.label + ') ' + (o.text || '(the option is drawn in the picture — read it there)');
    }).join('\n');
    var q = str(spec && spec.question, 2400);
    var key = str(spec && spec.key, 400);
    var lines = [];
    lines.push(who + ' A student has just answered the multiple-choice question below' +
      (correct >= 0 ? ' and has been told which option was right.' : '.') +
      ' They are now going through the options one at a time asking "why is that one wrong?".');
    lines.push('');
    lines.push('THE QUESTION EXACTLY AS IT IS PRINTED:\n' + (q || '(the question is in the attached picture)'));
    lines.push('');
    lines.push('THE OPTIONS:\n' + printed);
    lines.push('');
    if (correct >= 0) {
      lines.push('Option (' + opts[correct].label + ') is the correct one.');
    } else {
      lines.push('Which option is correct was not recorded.' + (key ? ' The answer key printed with the paper says: "' + key + '".' : '') +
        ' Work it out carefully from the question first, and say which option it is in "correct".');
    }
    lines.push('');
    lines.push('Any diagram, figure, table, graph or the options themselves may be ATTACHED to this message as a picture. Read it. ' +
      'Most of these options are wrong because of something the picture, the table or the numbers actually show, and a reason that does not point at that evidence is no use to the student.');
    lines.push('');
    lines.push('For EVERY option write "why", addressed to the student as "you":');
    lines.push('- For a WRONG option: say what is actually TRUE — naming the things, counting them, quoting the row, the label or the number — and then why that makes this option wrong. ' +
      (sub === 'maths'
        ? '"Half of 36 is 18, not 12, so this one is wrong." "This is what you get if you add instead of take away." Where it helps, name the slip that leads to this option. Primary-school methods only: never algebra, never "let x be". '
        : '"There are only 2 populations of producer, arrowhead and water lily, so this one is wrong." "The bulb at X still lights, so that part of the circuit is not broken." ') +
      'Never write only "this is incorrect" or "this does not match": name what it should have been.');
    lines.push('- For the CORRECT option: one sentence on why it IS right, on the same evidence.');
    lines.push('Max 40 words each. Plain sentences a 10-year-old reads. No markdown, no bullet characters, no mention of any option label other than the one the entry is about, and never open with "The answer is".');
    lines.push('');
    var a = opts[0] ? opts[0].label : '1', b = opts[1] ? opts[1].label : '2';
    lines.push('Return ONLY JSON: {"correct":"<the label of the correct option>","options":[{"n":"' + a + '","why":"..."},{"n":"' + b + '","why":"..."}]} — one entry per option, in order, "n" being the option label exactly as printed above.');
    return lines.join('\n');
  }
  /* The portal's `hintQuestionPart`, for an MCQ. Never the answer, never the
     right option's label. */
  function hintPrompt(spec, opts, correct) {
    var sub = subjectWord(spec && spec.subject);
    var q = str(spec && spec.question, 1600);
    return 'You are a ' + (sub ? sub + ' ' : '') + 'teacher. A student is stuck on ONE multiple-choice question and asked for a hint.\n' +
      'Question: "' + (q || '(see the attached picture)') + '".\n' +
      'The options: ' + opts.map(function (o) { return '(' + o.label + ') ' + (o.text || '(in the picture)'); }).join(' | ') + '.\n' +
      (correct >= 0 ? 'The correct option (do NOT reveal it or its label): (' + opts[correct].label + ').\n' : '') +
      'Give ONE short hint (1-2 sentences, max 35 words) addressed to "you" that nudges the student toward the answer — point at the idea to think about or where in the question to look. ' +
      (sub === 'maths' ? 'Primary-school methods only, never algebra. ' : '') +
      'Do NOT state the answer or the correct option. Return ONLY the hint text — no preamble.';
  }

  /* ---------------------------------------------------------------
     THE CALL, cached per option list. The PROMPT is the cache key, so an
     edited question can never be served the previous wording's reasons;
     the in-memory promise folds the two or three hovers fired while the
     first call is in the air into one request; localStorage keeps it for
     the next time the same mistake is tried.
     --------------------------------------------------------------- */
  var _mem = {};
  function store() {
    try { return root && root.localStorage ? root.localStorage : null; } catch (e) { return null; }
  }
  function cacheGet(k) { var s = store(); if (!s) return null; try { return s.getItem(k); } catch (e) { return null; } }
  function cacheSet(k, v) { var s = store(); if (!s) return; try { s.setItem(k, v); } catch (e) {} }
  function cacheDrop(k) { var s = store(); if (!s) return; try { s.removeItem(k); } catch (e) {} }

  function loadWhy(spec, opts, correct) {
    var prompt = whyPrompt(spec, opts, correct);
    var key = CACHE_PREFIX + hash(prompt);
    if (_mem[key]) return _mem[key];
    if (!spec || typeof spec.ask !== 'function') return Promise.resolve(null);
    var p = Promise.resolve().then(function () {
      var raw = cacheGet(key);
      if (raw != null) return raw;
      var imgs = typeof spec.images === 'function' ? spec.images() : Promise.resolve([]);
      return Promise.resolve(imgs).catch(function () { return []; }).then(function (list) {
        var media = (list || []).filter(function (x) { return x && x.data; }).slice(0, IMG_MAX);
        var o = { json: true, temperature: 0.2, maxOutputTokens: 600 + opts.length * 220 };
        if (media.length) o.images = media;
        return spec.ask(prompt, o);
      }).then(function (r) {
        var s = String(r == null ? '' : r);
        if (s) cacheSet(key, s);
        return s;
      });
    }).then(function (raw) {
      var parse = typeof spec.parse === 'function' ? spec.parse : function (x) { try { return JSON.parse(x); } catch (e) { return null; } };
      var parsed = parse(raw);
      if (!parsed) throw new Error('unreadable reply');
      return { why: normItems(parsed, opts), correct: correct >= 0 ? correct : correctOf(parsed, opts) };
    }).catch(function (e) {
      if (root && root.console) root.console.warn('Why-not-this-one failed:', e);
      delete _mem[key];
      // A cached bad reply would make every retry fail instantly on it.
      cacheDrop(key);
      return null;
    });
    _mem[key] = p;
    return p;
  }

  /* ---------------------------------------------------------------
     PICTURES — a link (or data: URL) drawn through a canvas, so the call
     carries a small JPEG, never a network fetch from the model's side.
     --------------------------------------------------------------- */
  function imageData(doc, url) {
    return new Promise(function (resolve) {
      var u = String(url || '');
      if (!u || !doc || !doc.createElement) { resolve(null); return; }
      var settled = false;
      var done = function (v) { if (!settled) { settled = true; resolve(v); } };
      setTimeout(function () { done(null); }, 9000);
      var Img = (doc.defaultView && doc.defaultView.Image) || (root && root.Image);
      if (!Img) { done(null); return; }
      var im = new Img();
      if (!/^data:/i.test(u)) im.crossOrigin = 'anonymous';
      im.onload = function () {
        try {
          var w = im.naturalWidth || im.width, h = im.naturalHeight || im.height;
          if (!w || !h) { done(null); return; }
          var k = Math.min(1, IMG_SIDE / Math.max(w, h));
          var c = doc.createElement('canvas');
          c.width = Math.max(1, Math.round(w * k));
          c.height = Math.max(1, Math.round(h * k));
          var g = c.getContext('2d');
          if (!g) { done(null); return; }
          g.fillStyle = '#fff';          // a PNG's transparency would flatten to BLACK in a JPEG
          g.fillRect(0, 0, c.width, c.height);
          g.drawImage(im, 0, 0, c.width, c.height);
          var d = c.toDataURL('image/jpeg', 0.86);
          var at = d.indexOf(',');
          done(at > 0 ? { mimeType: 'image/jpeg', data: d.slice(at + 1) } : null);
        } catch (e) { done(null); }
      };
      im.onerror = function () { done(null); };
      im.src = u;
    });
  }
  /* A list of links (or promises of links) → the pictures that loaded. */
  function imagesFrom(doc, urls) {
    return Promise.all((urls || []).slice(0, IMG_MAX).map(function (u) {
      return Promise.resolve(u).then(function (x) { return x ? imageData(doc, x) : null; }, function () { return null; });
    })).then(function (list) { return list.filter(Boolean); });
  }

  /* ---------------------------------------------------------------
     THE CARD — one per document, the portal's #wnyPop.
     --------------------------------------------------------------- */
  var CARDS = [];   // [{ doc, el, host, timer, hideTimer, showing, pinned }]
  function cardFor(doc, hostEl) {
    for (var i = 0; i < CARDS.length; i++) if (CARDS[i].doc === doc) {
      var c0 = CARDS[i];
      var h0 = popHostOf(doc, hostEl);
      if (c0.el.parentNode !== h0) h0.appendChild(c0.el);
      return c0;
    }
    var c = { doc: doc, el: null, timer: 0, hideTimer: 0, showing: '', pinned: false };
    var el = doc.createElement('div');
    el.className = 'cmq-pop';
    el.setAttribute('role', 'dialog');
    el.addEventListener('mouseenter', function () { clearTimeout(c.hideTimer); });
    el.addEventListener('mouseleave', function () { if (!c.pinned) hideSoon(c); });
    el.addEventListener('click', function (ev) { if (ev.target && ev.target.closest && ev.target.closest('[data-cmq-close]')) hide(c); });
    c.el = el;
    popHostOf(doc, hostEl).appendChild(el);
    var win = doc.defaultView;
    // A fixed card whose anchor has scrolled away points at nothing.
    if (win) {
      win.addEventListener('scroll', function () { hide(c); }, true);
      win.addEventListener('resize', function () { hide(c); });
    }
    /* Escape closes the CARD, and only the card: caught on the way down,
       so a modal's own Escape (the ▶ Practise window) is not closed with it
       while all the student meant was to put the reason away. */
    (win || doc).addEventListener('keydown', function (ev) {
      if (ev.key !== 'Escape') return;
      if (c.el && c.el.style.display === 'block') { hide(c); ev.stopPropagation(); }
    }, true);
    doc.addEventListener('click', function (ev) {
      if (!c.pinned) return;
      if (c.el.contains(ev.target) || (ev.target.closest && ev.target.closest('.cmq-badge'))) return;
      hide(c);
    });
    CARDS.push(c);
    return c;
  }
  /* The card lives inside the nearest FIXED box round the question (a
     modal, a hover preview) when there is one, so moving the pointer into
     the card is not "leaving" a hover preview — which would close the very
     question the card is about. Otherwise the body. */
  function popHostOf(doc, el) {
    var win = doc.defaultView;
    var n = el;
    while (n && n.nodeType === 1 && n !== doc.body) {
      try {
        var cs = win && win.getComputedStyle ? win.getComputedStyle(n) : null;
        if (cs && cs.position === 'fixed' && (!cs.transform || cs.transform === 'none')) return n;
      } catch (e) { /* keep walking */ }
      n = n.parentNode;
    }
    return doc.body;
  }
  function hide(c) {
    clearTimeout(c.timer); clearTimeout(c.hideTimer);
    c.showing = ''; c.pinned = false;
    if (c.el) { c.el.style.display = 'none'; c.el.classList.remove('cmq-pinned'); }
  }
  function hideSoon(c) { clearTimeout(c.hideTimer); c.hideTimer = setTimeout(function () { hide(c); }, WNY_HIDE_MS); }
  /* Beside the ⓘ first, then under or over it, clamped to the window last —
     the portal's `_wnyPlace`. Hung off the badge, not the row: a row is
     full width, so there is never room to its right. */
  function place(c, lab) {
    var el = c.el, win = c.doc.defaultView || root;
    var anchor = (lab && lab.querySelector && lab.querySelector('.cmq-badge')) || lab;
    if (!anchor || !anchor.getBoundingClientRect) return;
    var r = anchor.getBoundingClientRect();
    el.style.visibility = 'hidden';
    el.style.left = '0px'; el.style.top = '0px';
    var w = el.offsetWidth, h = el.offsetHeight;
    var GAP = 12, PAD = 10;
    var vw = win.innerWidth, vh = win.innerHeight;
    var left = r.right + GAP, top = r.top - 4;
    if (left + w > vw - PAD) {
      var leftSide = r.left - GAP - w;
      if (leftSide >= PAD) left = leftSide;
      else {
        left = r.left;
        top = r.bottom + GAP;
        if (top + h > vh - PAD) top = r.top - GAP - h;
      }
    }
    el.style.left = Math.round(Math.max(PAD, Math.min(left, vw - w - PAD))) + 'px';
    el.style.top = Math.round(Math.max(PAD, Math.min(top, vh - h - PAD))) + 'px';
    el.style.visibility = '';
  }
  function cardBody(doc, opt, isRight, why, state, chosen, pinned) {
    var frag = doc.createElement('div');
    var head = doc.createElement('div');
    head.className = 'cmq-head';
    var num = doc.createElement('span');
    num.className = 'cmq-num';
    num.textContent = opt.label;
    head.appendChild(num);
    var word = doc.createElement('span');
    word.className = 'cmq-word';
    word.textContent = opt.text || 'Option ' + opt.label;
    head.appendChild(word);
    if (chosen && String(chosen) === String(opt.n)) {
      var y = doc.createElement('span');
      y.className = 'cmq-yours';
      y.textContent = 'you chose this';
      head.appendChild(y);
    }
    if (pinned) {
      var x = doc.createElement('button');
      x.type = 'button';
      x.className = 'cmq-close';
      x.setAttribute('data-cmq-close', '1');
      x.setAttribute('aria-label', 'Close');
      x.textContent = '✕';
      head.appendChild(x);
    }
    frag.appendChild(head);
    var v = doc.createElement('div');
    v.className = 'cmq-verdict ' + (isRight ? 'ok' : 'no');
    v.textContent = isRight ? '✓ This one is right' : '✗ Why this one is wrong';
    frag.appendChild(v);
    if (state === 'loading') {
      var l = doc.createElement('div');
      l.className = 'cmq-load';
      var dots = doc.createElement('span');
      dots.className = 'cmq-dots';
      for (var i = 0; i < 3; i++) dots.appendChild(doc.createElement('i'));
      l.appendChild(dots);
      l.appendChild(doc.createTextNode('Reading the question…'));
      frag.appendChild(l);
    } else if (state === 'off') {
      var off = doc.createElement('div');
      off.className = 'cmq-note';
      off.textContent = 'This needs Chung GPT to be switched on for this account.';
      frag.appendChild(off);
    } else if (!why) {
      var none = doc.createElement('div');
      none.className = 'cmq-note';
      none.textContent = 'No reason came back for this option. Move away and hover it again to try once more.';
      frag.appendChild(none);
    } else {
      var t = doc.createElement('div');
      t.className = 'cmq-txt';
      t.textContent = why;
      frag.appendChild(t);
    }
    return frag;
  }

  /* ---------------------------------------------------------------
     MOUNT — the question's options, Hint, Check, feedback and ⓘ.
     spec: {
       options: [{ label, text }], count, letters,
       correct: index | -1, option: the recorded right option ("2"/"B"),
       key: the answer key's words, question, subject, level,
       explanation, working: [steps], images: () => Promise<[{mimeType,data}]>,
       ask(prompt, opts) → Promise<raw>, parse(raw) → object, aiOn() → bool,
       hint: bool (default true), retry: bool (default true),
       onChecked({ ok, chosen, correct, label }), onRevealed()
     }
     Returns { el, check, reveal, reset, state }.
     --------------------------------------------------------------- */
  var _uid = 0;
  function mount(doc, spec) {
    spec = spec || {};
    doc = doc || (root && root.document);
    var opts = optionsOf(spec);
    var id = 'cmq' + (++_uid);
    var st = {
      correct: typeof spec.correct === 'number' && spec.correct >= 0 && spec.correct < opts.length
        ? spec.correct : correctIndex(opts, spec.option, spec.key),
      chosen: '',          // the canonical number picked
      marked: false,
      revealed: false,
      busy: false,
      why: null,
      armed: false
    };
    var mk = function (tag, cls, text) {
      var e = doc.createElement(tag);
      if (cls) e.className = cls;
      if (text != null) e.textContent = text;
      return e;
    };
    var aiOn = function () { try { return typeof spec.aiOn === 'function' ? !!spec.aiOn() : typeof spec.ask === 'function'; } catch (e) { return false; } };

    var wrap = mk('div', 'cmq');
    wrap.setAttribute('data-cmq', id);
    var block = mk('div', 'mcq-block cmq-block');
    block.setAttribute('data-block', id);
    var labs = [];
    opts.forEach(function (o, i) {
      var lab = mk('label', 'cmq-opt');
      var r = mk('input');
      r.type = 'radio';
      r.name = id;
      r.value = o.n;
      r.addEventListener('change', function () { pick(i); });
      lab.appendChild(r);
      var sp = mk('span', 'cmq-optText');
      sp.appendChild(mk('b', null, o.label + '.'));
      if (o.text) sp.appendChild(doc.createTextNode(' ' + o.text));
      lab.appendChild(sp);
      lab.setAttribute('data-n', o.n);
      block.appendChild(lab);
      labs.push(lab);
    });
    wrap.appendChild(block);

    var actions = mk('div', 'part-actions cmq-actions');
    var hintBtn = null;
    if (spec.hint !== false) {
      hintBtn = mk('button', 'cmq-btn cmq-btn-outline part-ai-btn', '💡 Hint');
      hintBtn.type = 'button';
      hintBtn.title = 'Get a hint for this question — it won’t give away the answer';
      hintBtn.addEventListener('click', function () { askHint(); });
      actions.appendChild(hintBtn);
    }
    var checkBtn = mk('button', 'cmq-btn cmq-btn-check part-ai-btn', '✓ Check answer');
    checkBtn.type = 'button';
    checkBtn.title = 'Check your answer';
    checkBtn.addEventListener('click', function () { check(); });
    actions.appendChild(checkBtn);
    var againBtn = mk('button', 'cmq-btn cmq-btn-outline cmq-again', '↺ Try again');
    againBtn.type = 'button';
    againBtn.hidden = true;
    againBtn.addEventListener('click', function () { reset(); });
    actions.appendChild(againBtn);
    wrap.appendChild(actions);
    var hintBox = mk('div', 'part-hint-box cmq-hint');
    hintBox.hidden = true;
    wrap.appendChild(hintBox);
    var fb = mk('div', 'mcq-feedback cmq-feedback');
    fb.setAttribute('aria-live', 'polite');
    wrap.appendChild(fb);
    var extra = mk('div', 'cmq-extra');
    wrap.appendChild(extra);

    /* Visual feedback when a student picks: a NEUTRAL highlight only —
       never right or wrong before Check (the portal's `markMcqChoice`). */
    function pick(i) {
      if (st.marked || st.revealed) return;
      st.chosen = opts[i] ? opts[i].n : '';
      labs.forEach(function (l, k) { l.classList.toggle('cmq-picked', k === i); });
    }
    function setBusy(on, text) {
      st.busy = !!on;
      checkBtn.disabled = !!on || st.marked || st.revealed;
      if (hintBtn) hintBtn.disabled = !!on || st.marked || st.revealed;
      checkBtn.textContent = on ? (text || 'Checking…') : '✓ Check answer';
    }
    function lock(on) {
      labs.forEach(function (l) { var r = l.querySelector('input'); if (r) r.disabled = !!on; });
      wrap.classList.toggle('cmq-done', !!on);
    }
    /* The ONE painter for a marked question (the portal's `_mcqPaintResult`):
       right option green, the chosen wrong one red, then the ⓘ. */
    function paint() {
      labs.forEach(function (l, k) {
        l.classList.remove('cmq-picked', 'cmq-right', 'cmq-wrong');
        if (k === st.correct) l.classList.add('cmq-right');
        if (st.chosen && opts[k].n === st.chosen && k !== st.correct) l.classList.add('cmq-wrong');
      });
      arm();
    }
    function feedback(ok) {
      fb.innerHTML = '';
      var head = mk('span', ok ? 'cmq-fbHead cmq-fbOk' : 'cmq-fbHead cmq-fbNo', ok ? '✓ Correct' : '✗ Incorrect');
      if (st.revealed && !st.marked) { head = mk('span', 'cmq-fbHead cmq-fbShown', '👀 The answer'); }
      fb.appendChild(head);
      if (st.chosen && st.marked) {
        var o = opts[parseInt(st.chosen, 10) - 1];
        fb.appendChild(mk('span', 'cmq-fbChose', ' (you chose ' + (o ? o.label : st.chosen) + ')'));
      }
      if (st.correct >= 0 && (!ok || st.revealed)) {
        var c = opts[st.correct];
        var line = mk('div', 'cmq-fbKey');
        line.appendChild(mk('strong', null, 'Correct answer: '));
        line.appendChild(doc.createTextNode(c.label + ')' + (c.text ? ' ' + c.text : '')));
        fb.appendChild(line);
      }
      if (st.correct < 0) {
        fb.appendChild(mk('div', 'cmq-fbKey', spec.key ? 'Answer key: ' + spec.key : 'There is no answer key on this one.'));
      }
      if (opts.length > 1 && st.armed && st.correct >= 0) {
        fb.appendChild(mk('div', 'cmq-fbTip', 'ⓘ Hover — or tap — the ⓘ beside any other option to see why it is wrong.'));
      }
      extra.innerHTML = '';
      var steps = (Array.isArray(spec.working) ? spec.working : []).filter(Boolean);
      var expl = str(spec.explanation, 900);
      if (expl || steps.length) {
        var box = mk('div', 'cmq-why');
        box.appendChild(mk('div', 'cmq-whyHead', steps.length ? 'Working' : 'Why'));
        if (expl) box.appendChild(mk('div', 'cmq-whyTxt', expl));
        if (steps.length) {
          var ol = mk('ol', 'cmq-steps');
          steps.forEach(function (s) { ol.appendChild(mk('li', null, String(s))); });
          box.appendChild(ol);
        }
        extra.appendChild(box);
      }
    }
    function finish(ok) {
      paint();
      feedback(ok);
      lock(true);
      checkBtn.hidden = true;
      if (hintBtn) hintBtn.hidden = true;
      againBtn.hidden = !(spec.retry !== false && st.marked && !ok);
      setBusy(false);
    }
    /* Marking is deterministic when the right option is known — no call.
       When it is not, the ONE why-not call settles it (and brings the
       reasons with it). */
    function check() {
      if (st.busy || st.marked || st.revealed) return Promise.resolve(null);
      if (!st.chosen) {
        say('Choose an option first.');
        return Promise.resolve(null);
      }
      if (st.correct >= 0) return Promise.resolve(done());
      if (!aiOn()) {
        say(spec.key ? 'This one has no option marked as correct — compare with the key: ' + spec.key : 'There is no answer key on this one.');
        return Promise.resolve(null);
      }
      setBusy(true, 'Checking…');
      return loadWhy(spec, opts, -1).then(function (res) {
        if (res) { st.why = res.why; if (res.correct >= 0) st.correct = res.correct; }
        setBusy(false);
        if (st.correct < 0) {
          say('That did not go through — try ✓ Check answer again in a moment.');
          return null;
        }
        return done();
      });
      function done() {
        st.marked = true;
        var ok = String(opts[st.correct].n) === String(st.chosen);
        finish(ok);
        var res = { ok: ok, chosen: st.chosen, correct: st.correct,
          label: (opts[parseInt(st.chosen, 10) - 1] || {}).label || st.chosen,
          rightLabel: opts[st.correct].label };
        if (typeof spec.onChecked === 'function') { try { spec.onChecked(res); } catch (e) {} }
        warmWhy();
        return res;
      }
    }
    function say(text) {
      fb.innerHTML = '';
      fb.appendChild(mk('span', 'cmq-fbSay', text));
    }
    /* "Show me the answer": the key and the ⓘ, with nothing marked. */
    function reveal() {
      if (st.marked || st.revealed) return Promise.resolve(null);
      st.revealed = true;
      st.chosen = st.chosen || '';
      var go = function () {
        finish(false);
        if (typeof spec.onRevealed === 'function') { try { spec.onRevealed(); } catch (e) {} }
        warmWhy();
      };
      if (st.correct >= 0 || !aiOn()) { go(); return Promise.resolve(true); }
      setBusy(true, 'Finding it…');
      return loadWhy(spec, opts, -1).then(function (res) {
        if (res) { st.why = res.why; if (res.correct >= 0) st.correct = res.correct; }
        go();
        return true;
      });
    }
    function reset() {
      st.marked = false; st.revealed = false; st.chosen = '';
      disarm();
      labs.forEach(function (l) {
        l.classList.remove('cmq-picked', 'cmq-right', 'cmq-wrong');
        var r = l.querySelector('input'); if (r) r.checked = false;
      });
      lock(false);
      fb.innerHTML = '';
      extra.innerHTML = '';
      hintBox.hidden = true; hintBox.innerHTML = '';
      checkBtn.hidden = false;
      if (hintBtn) hintBtn.hidden = false;
      againBtn.hidden = true;
      setBusy(false);
    }
    /* The reasons are asked for as soon as the question is marked, so the
       first ⓘ a student opens is usually already there. One call, cached. */
    function warmWhy() {
      if (st.why || !aiOn() || st.correct < 0 || opts.length < 2) return;
      loadWhy(spec, opts, st.correct).then(function (res) { if (res && !st.why) st.why = res.why; });
    }
    function askHint() {
      if (st.busy || !hintBtn) return;
      if (!aiOn()) { hintBox.hidden = false; hintBox.textContent = 'Hints need Chung GPT to be switched on.'; return; }
      var orig = hintBtn.textContent;
      hintBtn.disabled = true; hintBtn.textContent = 'Thinking…';
      var media = typeof spec.images === 'function' ? spec.images() : Promise.resolve([]);
      Promise.resolve(media).catch(function () { return []; }).then(function (list) {
        var o = { temperature: 0.5, maxOutputTokens: 400 };
        var imgs = (list || []).filter(function (x) { return x && x.data; }).slice(0, IMG_MAX);
        if (imgs.length) o.images = imgs;
        return spec.ask(hintPrompt(spec, opts, st.correct), o);
      }).then(function (raw) {
        var h = String(raw || '').trim().replace(/^["“]|["”]$/g, '');
        hintBox.innerHTML = '';
        hintBox.appendChild(mk('strong', 'cmq-hintHead', '💡 Hint: '));
        hintBox.appendChild(doc.createTextNode(h || 'Re-read the question and think about which idea it is testing.'));
        hintBox.hidden = false;
      }, function (e) {
        hintBox.hidden = false;
        hintBox.textContent = 'Could not get a hint: ' + ((e && e.message) || e);
      }).then(function () { hintBtn.disabled = false; hintBtn.textContent = orig; });
    }

    /* ---- 🔎 the ⓘ — armed only after marking or revealing ---- */
    function arm() {
      if (st.correct < 0 || opts.length < 2) return;
      st.armed = true;
      block.classList.add('wny-on');
      labs.forEach(function (lab, idx) {
        var o = opts[idx];
        if (lab.getAttribute('data-cmq-bound') !== '1') {
          lab.setAttribute('data-cmq-bound', '1');
          lab.addEventListener('mouseenter', function () { if (!coarse()) queue(lab, idx, false); });
          lab.addEventListener('mouseleave', function () {
            var c = cardFor(doc, wrap);
            clearTimeout(c.timer);
            if (!c.pinned) hideSoon(c);
          });
        }
        if (idx === st.correct) return;            // nothing to defend on the right answer
        if (lab.querySelector('.cmq-badge')) return;
        var b = mk('button', 'cmq-badge wny-badge', 'ⓘ');
        b.type = 'button';
        b.title = 'Why is this one wrong?';
        b.setAttribute('aria-label', 'Why option ' + o.label + ' is wrong');
        // Inside the <label>: a plain click would also tick the radio.
        b.addEventListener('mousedown', function (ev) { ev.preventDefault(); });
        b.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); toggle(lab, idx); });
        b.addEventListener('focus', function () { queue(lab, idx, true); });
        b.addEventListener('blur', function () { var c = cardFor(doc, wrap); if (c.pinned) hide(c); });
        lab.appendChild(b);
      });
    }
    function disarm() {
      st.armed = false;
      block.classList.remove('wny-on');
      Array.prototype.forEach.call(block.querySelectorAll('.cmq-badge'), function (b) { b.parentNode.removeChild(b); });
      var c = cardFor(doc, wrap);
      hide(c);
    }
    function coarse() {
      try { var w = doc.defaultView; return !!(w && w.matchMedia && w.matchMedia('(hover: none)').matches); } catch (e) { return false; }
    }
    function token(idx) { return id + '|' + idx; }
    function queue(lab, idx, pin) {
      var c = cardFor(doc, wrap);
      clearTimeout(c.timer); clearTimeout(c.hideTimer);
      if (pin) { open(lab, idx, true); return; }
      c.timer = setTimeout(function () { open(lab, idx, false); }, WNY_HOVER_MS);
    }
    function toggle(lab, idx) {
      var c = cardFor(doc, wrap);
      if (c.pinned && c.showing === token(idx)) { hide(c); return; }
      queue(lab, idx, true);
    }
    function open(lab, idx, pin) {
      // The armed class is the gate, checked HERE, because hover, tap and
      // keyboard all pass this way and a reset question must answer none.
      if (!block.classList.contains('wny-on')) return;
      var o = opts[idx];
      if (!o) return;
      var c = cardFor(doc, wrap);
      var tk = token(idx);
      c.showing = tk;
      c.pinned = !!pin;
      c.el.classList.toggle('cmq-pinned', !!pin);
      var on = aiOn();
      var draw = function (why, state) {
        c.el.innerHTML = '';
        c.el.appendChild(cardBody(doc, o, idx === st.correct, why, state, st.chosen, c.pinned));
        c.el.style.display = 'block';
        c.el.scrollTop = 0;
        place(c, lab);
      };
      if (st.why && st.why[o.n]) { draw(st.why[o.n], 'ready'); return; }
      draw(null, on ? 'loading' : 'off');
      if (!on) return;
      loadWhy(spec, opts, st.correct).then(function (res) {
        if (res && res.why) st.why = res.why;
        if (c.showing !== tk) return;   // the student has moved on — never overwrite a newer card
        var why = res && res.why ? res.why[o.n] : null;
        draw(why, why ? 'ready' : 'none');
      });
    }

    return {
      el: wrap,
      check: check,
      reveal: reveal,
      reset: reset,
      pick: function (i) {
        var l = labs[i];
        if (!l) return;
        var r = l.querySelector('input');
        if (r && !r.disabled) { r.checked = true; pick(i); }
      },
      state: function () {
        return { correct: st.correct, chosen: st.chosen, marked: st.marked, revealed: st.revealed, armed: st.armed,
                 why: st.why ? Object.assign({}, st.why) : null, options: opts.slice() };
      }
    };
  }

  /* Is this a question to draw as an MCQ at all? Two options at least —
     words, or a picture of them with their count. */
  function isMcq(spec) { return optionsOf(spec).length >= 2; }

  return {
    VERSION: VERSION,
    mount: mount,
    isMcq: isMcq,
    imageData: imageData,
    imagesFrom: imagesFrom,
    pure: {
      normChoice: normChoice,
      optionsOf: optionsOf,
      correctIndex: correctIndex,
      normItems: normItems,
      correctOf: correctOf,
      labelToNum: labelToNum,
      whyPrompt: whyPrompt,
      hintPrompt: hintPrompt,
      hash: hash,
      CACHE_PREFIX: CACHE_PREFIX
    },
    _reset: function () { _mem = {}; }
  };
});
