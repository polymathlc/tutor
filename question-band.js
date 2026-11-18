/* =====================================================================
   ✂️ THE QUESTION'S OWN BAND — question-band.js (window.QBand, v1.98.0)
   ---------------------------------------------------------------------
   Zhi Kai, about a ⚡ Quick practice question: "the question has
   question 9 also that means the cropping failed to work". The picture
   for Q10 "Match." carried the end of Q9 ("Wendy can give 6 stickers to
   [ ] friends."), the section line "Questions 10 to 14 carry 2 marks
   each." and the page footer — because the mistake had fallen to tier ③,
   the WHOLE page, and the model's own rectangle (tier ②) is a guess made
   by eye that overshoots in exactly that way when it is made at all.

   A PDF that came from a school or SG Exam almost always carries its
   words as TEXT, with their positions. So the question can be found the
   way a person finds it: the line that starts with its number in the
   left margin is the top, and the next thing that is NOT this question —
   the next number in the same margin, a section line ("Questions 11 to
   15 carry 3 marks each", "Section B", "End of paper"), or the page
   footer (page number, website, "Go on to the next page") — is the
   bottom. Every figure, box and answer line between them is kept,
   because the band runs the full width of the page and is only then
   pulled in to the ink.

   NO AI CALL, NO GUESS. It is free, instant and gives the same picture
   every time. A scanned PDF has no text, `locate` finds nothing, and the
   caller keeps whatever it had — never a crop of the wrong half.

   EVERYTHING ABOVE `cropBand` IS PURE (numbers in, numbers out), so
   tools/question-band-tests.mjs pins it without a browser. The canvas
   half is three small functions and the browser check drives them.
   ===================================================================== */
(function (root) {
  'use strict';

  var MARGIN_X = 0.24;      // a question number sits in the left quarter of the page
  var COL_SLACK = 0.045;    // …and the next one in the same column, give or take
  var HEADER_B = 0.075;     // a running header ends this far down
  var FOOTER_Y = 0.9;       // a footer starts this far down
  var PAD_TOP = 0.012;      // breathing space above the number's line
  var PAD_BOT = 0.006;      // …and above whatever ends the question
  var MIN_BAND = 0.03;      // a band thinner than this is not a question

  /* The question's own number: "10", "Q10", "13(a)" and "13b" are 10, 10,
     13 and 13. A part is found by its STEM's number, which is right — the
     stem is what the part cannot be answered without. */
  function numOf(label) {
    var mm = /(\d{1,3})/.exec(String(label == null ? '' : label));
    var n = mm ? parseInt(mm[1], 10) : 0;
    return n > 0 && n < 200 ? n : 0;
  }

  /* pdf.js text items → { s, x, y, w, h } as FRACTIONS of the page, y the
     TOP of the glyphs measured down from the top. `vt` is the viewport's
     transform at any scale (vw, vh its size), so nothing here needs pdf.js
     itself — the harness hands in plain arrays. */
  function mul(a, b) {
    return [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
            a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
            a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
  }
  function fromPdf(items, vt, vw, vh) {
    var out = [];
    if (!Array.isArray(items) || !vt || !(vw > 0) || !(vh > 0)) return out;
    var sx = Math.sqrt(vt[0] * vt[0] + vt[1] * vt[1]) || 1;
    items.forEach(function (it) {
      var s = it && typeof it.str === 'string' ? it.str.replace(/\s+/g, ' ').trim() : '';
      if (!s || !Array.isArray(it.transform)) return;
      var m = mul(vt, it.transform);
      var fh = Math.sqrt(m[2] * m[2] + m[3] * m[3]) || (Number(it.height) || 0) * sx;
      if (!(fh > 0)) return;
      var x = m[4], base = m[5];
      out.push({ s: s, x: x / vw, y: (base - fh) / vh, w: Math.max(0, (Number(it.width) || 0) * sx) / vw, h: fh / vh });
    });
    return out;
  }

  /* Items that share a baseline are one line, read left to right. */
  function linesOf(items) {
    var list = (items || []).filter(function (it) {
      return it && typeof it.s === 'string' && it.s.trim() && isFinite(it.x) && isFinite(it.y) && it.h > 0;
    }).slice().sort(function (a, b) { return (a.y + a.h) - (b.y + b.h) || a.x - b.x; });
    var lines = [];
    list.forEach(function (it) {
      var base = it.y + it.h;
      var last = lines[lines.length - 1];
      if (last && Math.abs(last.base - base) <= Math.max(last.h, it.h) * 0.5) {
        last.parts.push(it);
        last.y = Math.min(last.y, it.y);
        last.b = Math.max(last.b, base);
        last.h = Math.max(last.h, it.h);
        return;
      }
      lines.push({ parts: [it], y: it.y, b: base, base: base, h: it.h });
    });
    return lines.map(function (l) {
      l.parts.sort(function (a, b) { return a.x - b.x; });
      return {
        s: l.parts.map(function (p) { return p.s; }).join(' ').replace(/\s+/g, ' ').trim(),
        x: l.parts[0].x,
        x1: Math.max.apply(null, l.parts.map(function (p) { return p.x + (p.w || 0); })),
        y: l.y, b: l.b, h: l.h
      };
    });
  }

  /* Does this line START question `n`? "10. Match.", "10) …", "10 Match",
     "Q10", or a lone "10" in the margin. NOT "10 + 10 + 10" or "10 × 3"
     (a number at the start of working or an option box), and the caller
     also asks for the left margin. `strict` wants the printed full stop or
     bracket, which is what a question number nearly always carries. */
  function startsQ(text, n, strict) {
    var t = String(text || '').trim();
    var mm = /^(?:Q(?:uestion)?\s*)?\(?(\d{1,3})(\s*[.):])?(?:\s+|$)?/i.exec(t);
    if (!mm || parseInt(mm[1], 10) !== n) return false;
    var rest = t.slice(mm[0].length);
    if (mm[2]) return /^(?:\s|$|[A-Za-z(\[“"'])/.test(rest) || rest === '';
    if (strict) return false;
    if (rest === '') return true;
    return /^[A-Za-z(\[“"']/.test(rest) && !/^(?:cm|mm|m|km|kg|g|ml|l|h|min|s|am|pm|x)\b/i.test(rest);
  }
  /* Any question number at all, and which. */
  function qNumOf(text, strict) {
    var mm = /^(?:Q(?:uestion)?\s*)?\(?(\d{1,3})/i.exec(String(text || '').trim());
    if (!mm) return 0;
    var n = parseInt(mm[1], 10);
    return startsQ(text, n, strict) ? n : 0;
  }
  var SECTION_RE = /^(?:questions?\s+\d+\s*(?:to|-|–|—|and)\s*\d+|for\s+questions?\s+\d+|section\s+[a-z0-9]\b|booklet\s+[a-z0-9]\b|paper\s+[12]\b|part\s+[a-z0-9]\b|end\s+of\s+(?:the\s+)?(?:paper|section|booklet|test|exam))/i;
  function isSection(line) { return SECTION_RE.test(String(line && line.s || '')); }
  var FOOTER_RE = /(?:www\.|https?:|\.com\b|\.sg\b|©|copyright|^page\s+\d|^\d{1,3}$|^-\s*\d+\s*-$|turn\s+over|next\s+page|go\s+on\b|continue[sd]?\s+on)/i;
  function isFooter(line) {
    if (!line) return false;
    var s = String(line.s || '');
    if (line.y >= FOOTER_Y && (s.length <= 40 || FOOTER_RE.test(s))) return true;
    return line.y >= 0.8 && /(?:turn\s+over|next\s+page|go\s+on\s+to)/i.test(s);
  }
  function isHeader(line) {
    return !!line && line.b <= HEADER_B && String(line.s || '').length <= 80;
  }

  /* THE BAND, as fractions of the page: { top, bot, x } or null.
     opts.cont: this page CONTINUES the question from the page before, so it
     starts at the first line under the running header rather than at a
     number. */
  function locate(items, n, opts) {
    opts = opts || {};
    var lines = linesOf(items);
    if (!lines.length) return null;
    var start = null, startIdx = -1, strict = true;
    if (opts.cont) {
      for (var c = 0; c < lines.length; c++) {
        if (!isHeader(lines[c]) && !isFooter(lines[c])) { start = lines[c]; startIdx = c; break; }
      }
      if (!start || qNumOf(start.s, false) || isSection(start)) return null;   // nothing carried over
    } else {
      if (!(n > 0)) return null;
      var cands = [];
      lines.forEach(function (l, i) {
        if (l.x > MARGIN_X || isHeader(l) || isFooter(l)) return;
        if (startsQ(l.s, n, true)) cands.push({ l: l, i: i, rank: 0 });
        else if (startsQ(l.s, n, false)) cands.push({ l: l, i: i, rank: 1 });
      });
      if (!cands.length) return null;
      /* The printed "10." beats a bare "10", and between equals the one in
         the column the OTHER question numbers stand in wins — a "10 cm" in
         a table that happens to sit at the left is not question 10. */
      var colXs = lines.filter(function (l) { return l.x <= MARGIN_X && qNumOf(l.s, true); })
                       .map(function (l) { return l.x; }).sort(function (a, b) { return a - b; });
      var col = colXs.length ? colXs[Math.floor(colXs.length / 2)] : null;
      cands.sort(function (a, b) {
        if (a.rank !== b.rank) return a.rank - b.rank;
        if (col !== null) {
          var da = Math.abs(a.l.x - col), db = Math.abs(b.l.x - col);
          if (Math.abs(da - db) > 0.01) return da - db;
        }
        return a.l.y - b.l.y;
      });
      start = cands[0].l; startIdx = cands[0].i;
      /* A paper that prints "10." is ended by the next "11." — not by a bare
         "12" in a table that happens to sit in the margin. One that prints
         bare numbers is ended by a bare number. */
      strict = cands[0].rank === 0;
    }
    var end = 1, endWhy = 'page';
    for (var k = startIdx + 1; k < lines.length; k++) {
      var l = lines[k];
      if (l.y < start.b - start.h * 0.3) continue;              // the rest of the number's own line
      var other = l.x <= MARGIN_X && (opts.cont ? true : Math.abs(l.x - start.x) <= COL_SLACK) ? qNumOf(l.s, strict) : 0;
      if (other && other !== n) { end = l.y; endWhy = 'next'; break; }
      if (isSection(l)) { end = l.y; endWhy = 'section'; break; }
      if (isFooter(l)) { end = l.y; endWhy = 'footer'; break; }
    }
    var top = Math.max(0, start.y - Math.max(PAD_TOP, start.h * 0.5));
    var bot = Math.min(1, end - (endWhy === 'page' ? 0 : PAD_BOT));
    if (bot - top < MIN_BAND) return null;
    return { top: top, bot: bot, x: start.x, why: endWhy };
  }

  /* ---- the pixels ---- */

  /* The rectangle round the ink in an RGBA buffer, or null for a blank one.
     Ink is anything clearly darker than paper; a row or column needs a few
     dark pixels to count, so a speck of scanner dust is not a question. */
  function inkBox(data, w, h, thr) {
    thr = thr || 200;
    var rowN = new Array(h).fill(0), colN = new Array(w).fill(0);
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var i = (y * w + x) * 4;
        var a = data[i + 3];
        if (a < 40) continue;
        var l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        if (l < thr) { rowN[y]++; colN[x]++; }
      }
    }
    var need = 2;
    var y0 = 0, y1 = h - 1, x0 = 0, x1 = w - 1;
    while (y0 < h && rowN[y0] < need) y0++;
    while (y1 > y0 && rowN[y1] < need) y1--;
    while (x0 < w && colN[x0] < need) x0++;
    while (x1 > x0 && colN[x1] < need) x1--;
    if (y0 >= h || x0 >= w || y1 <= y0 || x1 <= x0) return null;
    return { x0: x0, y0: y0, x1: x1, y1: y1 };
  }

  /* Cut the band out of a rendered page and pull it in to the ink, with a
     little white round it. Returns a canvas, or null. */
  function cropBand(doc, canvas, band, opts) {
    opts = opts || {};
    if (!doc || !canvas || !band) return null;
    var W = canvas.width, H = canvas.height;
    if (!W || !H) return null;
    var by0 = Math.max(0, Math.floor(band.top * H)), by1 = Math.min(H, Math.ceil(band.bot * H));
    var bh = by1 - by0;
    if (bh < 12) return null;
    var probeMax = 900;
    var s = Math.min(1, probeMax / Math.max(W, bh));
    var pw = Math.max(1, Math.round(W * s)), ph = Math.max(1, Math.round(bh * s));
    var probe = doc.createElement('canvas');
    probe.width = pw; probe.height = ph;
    var pctx = probe.getContext('2d', { willReadFrequently: true });
    pctx.fillStyle = '#fff';
    pctx.fillRect(0, 0, pw, ph);
    pctx.drawImage(canvas, 0, by0, W, bh, 0, 0, pw, ph);
    var box = inkBox(pctx.getImageData(0, 0, pw, ph).data, pw, ph);
    probe.width = 0; probe.height = 0;
    if (!box) return null;
    var pad = Math.round(Math.max(10, W * 0.018));
    var x = Math.max(0, Math.floor(box.x0 / s) - pad);
    var x2 = Math.min(W, Math.ceil((box.x1 + 1) / s) + pad);
    var y = Math.max(by0, by0 + Math.floor(box.y0 / s) - pad);
    var y2 = Math.min(by1, by0 + Math.ceil((box.y1 + 1) / s) + pad);
    var w = x2 - x, h = y2 - y;
    if (w < 24 || h < 24) return null;
    var maxSide = opts.maxSide || 2000;
    var f = Math.min(1, maxSide / Math.max(w, h));
    var out = doc.createElement('canvas');
    out.width = Math.max(1, Math.round(w * f));
    out.height = Math.max(1, Math.round(h * f));
    var ctx = out.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(canvas, x, y, w, h, 0, 0, out.width, out.height);
    return out;
  }

  /* A question over a page break is its two pieces, one under the other,
     with a faint rule where the page turned. */
  function stack(doc, pieces) {
    pieces = (pieces || []).filter(Boolean);
    if (!pieces.length) return null;
    if (pieces.length === 1) return pieces[0];
    var gap = 28;
    var w = Math.max.apply(null, pieces.map(function (p) { return p.width; }));
    var h = pieces.reduce(function (a, p) { return a + p.height; }, 0) + gap * (pieces.length - 1);
    var out = doc.createElement('canvas');
    out.width = w; out.height = h;
    var ctx = out.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    var y = 0;
    pieces.forEach(function (p, i) {
      ctx.drawImage(p, 0, y);
      y += p.height;
      if (i < pieces.length - 1) {
        ctx.strokeStyle = '#d6d6d6';
        ctx.setLineDash([8, 6]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(12, y + gap / 2);
        ctx.lineTo(w - 12, y + gap / 2);
        ctx.stroke();
        ctx.setLineDash([]);
        y += gap;
      }
    });
    return out;
  }

  root.QBand = {
    numOf: numOf,
    fromPdf: fromPdf,
    linesOf: linesOf,
    startsQ: startsQ,
    qNumOf: qNumOf,
    isSection: isSection,
    isFooter: isFooter,
    isHeader: isHeader,
    locate: locate,
    inkBox: inkBox,
    cropBand: cropBand,
    stack: stack,
    MARGIN_X: MARGIN_X
  };
})(typeof window !== 'undefined' ? window : globalThis);
