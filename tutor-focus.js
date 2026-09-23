/* Quote-based worksheet focus. The AI supplies printed words, never positions.
   Only PDF text with a unique, geometrically trustworthy match may be marked. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TutorFocus = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var LIMITS = Object.freeze({ quote: 180, label: 40, minQuote: 8, items: 20000, text: 500000, rects: 8 });
  function finite(value) { return typeof value === 'number' && Number.isFinite(value); }
  function normalize(text) {
    // NFC preserves mathematical distinctions: 7.5 is not 75, cm² is not
    // cm2, and subtraction/division signs cannot disappear from a quote.
    return String(text).normalize('NFC').toLowerCase().replace(/\s+/gu, ' ').trim();
  }
  function parse(content) {
    if (typeof content !== 'string' || content.length > LIMITS.quote + LIMITS.label + 24 || /[\u0000-\u001f\u007f-\u009f]/.test(content)) return null;
    var parts = content.split('|').map(function (part) { return part.trim(); });
    if (parts.length !== 2 && parts.length !== 3) return null;
    var page = /^p([1-9]\d{0,3})$/i.exec(parts[0]);
    if (!page || Number(page[1]) > 1000) return null;
    var label = parts.length === 3 ? parts[1] : '', quote = parts[parts.length - 1];
    if (!quote || quote.length > LIMITS.quote || label.length > LIMITS.label) return null;
    // Return literal strings. Consumers must use textContent, never innerHTML.
    return { page: Number(page[1]), label: label, quote: quote };
  }
  function matrix(value) {
    return value && value.length === 6 && Array.prototype.every.call(value, finite);
  }
  function multiply(a, b) {
    return [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
      a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
      a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
  }
  function validViewport(viewport) {
    if (!viewport || !finite(viewport.width) || !finite(viewport.height) || viewport.width <= 0 || viewport.height <= 0 || viewport.width > 20000 || viewport.height > 20000 || !matrix(viewport.transform)) return false;
    var m = viewport.transform, sx = Math.hypot(m[0], m[1]), sy = Math.hypot(m[2], m[3]);
    return sx > 0 && sy > 0 && Math.abs(sx - sy) <= Math.max(sx, sy) * 0.0001 &&
      Math.abs(m[0] * m[2] + m[1] * m[3]) <= sx * sy * 0.0001;
  }
  function geometry(item, styles, viewport) {
    if (!matrix(item.transform) || !finite(item.width) || item.width <= 0 || !finite(item.height) || item.height <= 0 || item.dir && item.dir !== 'ltr') return null;
    if (!styles || typeof item.fontName !== 'string' || !Object.prototype.hasOwnProperty.call(styles, item.fontName)) return null;
    var style = styles[item.fontName];
    if (!style || style.vertical || !finite(style.ascent) || !finite(style.descent) || style.ascent <= 0 || style.ascent > 1.5 || style.descent > 0 || style.descent < -0.6 || style.ascent - style.descent < 0.4) return null;
    var tx = multiply(viewport.transform, item.transform), height = Math.hypot(tx[2], tx[3]);
    // Only upright text in the displayed page is accepted. Rotated, skewed,
    // mirrored and vertical runs get a quote card with no guessed rectangle.
    if (!(height > 0) || tx[0] <= 0 || tx[3] >= 0 || Math.abs(tx[1]) > Math.abs(tx[0]) * 0.0001 || Math.abs(tx[2]) > height * 0.0001) return null;
    var scale = Math.hypot(viewport.transform[0], viewport.transform[1]);
    var rect = { left: tx[4], top: tx[5] - height * style.ascent, width: item.width * scale, height: height * (style.ascent - style.descent) };
    if (![rect.left, rect.top, rect.width, rect.height].every(finite) || rect.width <= 0 || rect.height <= 0 || rect.left < 0 || rect.top < 0 || rect.left + rect.width > viewport.width || rect.top + rect.height > viewport.height) return null;
    // The complete PDF.js text item is the smallest supported box. Substring
    // lengths never become estimated character positions or partial widths.
    return { rect: rect, baseline: tx[5], fontHeight: height };
  }
  function separator(previous, current, explicitSpace) {
    if (!previous) return '';
    if (explicitSpace || previous.eol) return ' ';
    if (previous.geometry && current.geometry) {
      var p = previous.geometry, q = current.geometry, tolerance = Math.min(p.fontHeight, q.fontHeight) * 0.02;
      var gap = q.rect.left - (p.rect.left + p.rect.width);
      // Some fonts split one word into adjoining items. Concatenate only
      // when the two measured advances touch on the same baseline.
      if (Math.abs(p.baseline - q.baseline) <= tolerance && Math.abs(gap) <= tolerance) return '';
    }
    return ' ';
  }
  function buildIndex(content, viewport) {
    var result = { width: viewport && viewport.width || 0, height: viewport && viewport.height || 0, text: '', runs: [], reliable: validViewport(viewport) };
    if (!result.reliable || !content || !Array.isArray(content.items) || content.items.length > LIMITS.items) { result.reliable = false; return result; }
    var previous = null, trailingSpace = false;
    for (var i = 0; i < content.items.length; i++) {
      var item = content.items[i];
      if (!item || typeof item.str !== 'string') continue;
      if (item.str.length + result.text.length > LIMITS.text) { result.reliable = false; result.text = ''; result.runs = []; return result; }
      var text = normalize(item.str);
      if (!text) { if (item.str || item.hasEOL) trailingSpace = true; continue; }
      var run = { start: 0, end: 0, item: i, eol: item.hasEOL === true, geometry: geometry(item, content.styles, viewport) };
      result.text += separator(previous, run, trailingSpace || /^\s/u.test(item.str));
      run.start = result.text.length;
      result.text += text;
      run.end = result.text.length;
      result.runs.push(run); previous = run;
      trailingSpace = /\s$/u.test(item.str);
    }
    return result;
  }
  function wordCharacter(value) { return Boolean(value) && /[\p{L}\p{N}]/u.test(value); }
  function han(value) { return Boolean(value) && /\p{Script=Han}/u.test(value); }
  function bounded(text, quote, start) {
    var end = start + quote.length, first = quote[0], last = quote[quote.length - 1];
    return !(wordCharacter(first) && !han(first) && wordCharacter(text[start - 1])) &&
      !(wordCharacter(last) && !han(last) && wordCharacter(text[end]));
  }
  function connected(runs, index) {
    if (runs.length > LIMITS.rects) return false;
    for (var i = 1; i < runs.length; i++) {
      var p = runs[i - 1].geometry, q = runs[i].geometry, height = Math.max(p.fontHeight, q.fontHeight);
      var delta = q.baseline - p.baseline, gap = q.rect.left - (p.rect.left + p.rect.width);
      if (Math.abs(delta) <= height * 0.2) {
        if (gap < -height * 0.05 || gap > height * 2) return false;
      } else {
        // Reading order alone is insufficient for two distant columns or a
        // footer: a multi-line quote must occupy neighbouring printed lines.
        if (delta < height * 0.6 || delta > height * 2.2 || q.rect.left > p.rect.left + p.rect.width || Math.abs(q.rect.left - p.rect.left) > index.width * 0.6) return false;
      }
    }
    return true;
  }
  function match(index, quote) {
    function result(status, rects) { return { status: status, rects: rects || [], quote: typeof quote === 'string' ? quote : '' }; }
    if (typeof quote !== 'string' || quote.length > LIMITS.quote || /[\u0000-\u001f\u007f-\u009f]/.test(quote)) return result('invalid');
    var needle = normalize(quote);
    if (needle.replace(/\s/gu, '').length < LIMITS.minQuote) return result('too_short');
    if (!index || !index.reliable || typeof index.text !== 'string' || !Array.isArray(index.runs)) return result('unreliable');
    var at = -1, found = [];
    while ((at = index.text.indexOf(needle, at + 1)) !== -1) {
      if (bounded(index.text, needle, at)) found.push(at);
      if (found.length > 1) return result('ambiguous');
    }
    if (!found.length) return result('not_found');
    var start = found[0], end = start + needle.length;
    var runs = index.runs.filter(function (run) { return run.end > start && run.start < end; });
    if (!runs.length || runs.some(function (run) { return !run.geometry; }) || !connected(runs, index)) return result('unreliable');
    return result('matched', runs.map(function (run) {
      var rect = run.geometry.rect;
      return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    }));
  }
  return Object.freeze({ LIMITS: LIMITS, parse: parse, buildIndex: buildIndex, match: match });
});
