/* One deliberately small whole-utterance classifier, shared by the browser
   and teaching endpoint. A match selects existing guidance; it never judges
   an answer, interprets handwriting, or guesses a student's intended method. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FastTutorIntents = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var numbers = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20 };
  function normalized(text) {
    if (typeof text !== 'string' || text.length > 3000) return '';
    return text.toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/\s+/g, ' ').trim()
      .replace(/\b(question|number|q)\s+(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\b/g,
        function (_, prefix, value) { return prefix + ' ' + numbers[value]; });
  }
  function questionMatches(text) {
    var found = [], match, re = /\b(?:question|number|q)\s*(\d+(?:\s*[a-z])?)(?=\b|\s|$)/g;
    while ((match = re.exec(text))) found.push(match[1].replace(/\s/g, ''));
    return found;
  }
  function questionNumber(text) {
    var found = questionMatches(normalized(text));
    return found.length === 1 ? found[0] : '';
  }
  function unwrapped(text) {
    var value = normalized(text).replace(/[.!?]+$/, '').trim();
    // Only punctuation belonging to a polite wrapper is removed. Internal
    // commas, semicolons and sentence breaks cannot join two requests.
    for (var i = 0; i < 2; i++) value = value.replace(/,?\s+(?:please|thanks|thank you)$/, '').trim();
    value = value.replace(/^please,?\s+/, '');
    value = value.replace(/^(?:can|could|would|will) you(?: please)?\s+/, '');
    value = value.replace(/^(?:may|can|could) i(?: please)? (?:have|get)\s+/, '');
    value = value.replace(/^please\s+/, '');
    return value;
  }
  function confusion(text) { return /^i (?:don't|dont|do not) understand(?: (?:that|it))?$/.test(text); }
  function unsafe(text) {
    if (questionMatches(text).length > 1) return true;
    if (confusion(unwrapped(text))) return false;
    return /\b(?:check|correct|wrong|right|answer|answers|i got|i wrote|i used|i think|written|handwriting|working|calculated|calculation|instead|another method|different method|is it|did i|am i|look at|can you see|read (?:it|this|that)|ignore|instructions?|system|prompt|reveal|not|never|without|no|don't|dont|cannot|can't|cant)\b|[=+\u00d7\u00f7]|\d\s*[-*/]\s*\d/i.test(text);
  }
  function needsFresh(text) { return unsafe(normalized(text)); }
  function classify(text) {
    var original = normalized(text), value = unwrapped(text);
    if (!value || unsafe(original)) return '';
    // An explicit question suffix is useful only when the endpoint can match
    // that single printed label. The endpoint, not this classifier, resolves it.
    value = value.replace(/\s+(?:for|on|with)\s+(?:question|number|q)\s*\d+[a-z]?$/, '');
    if (/^(?:question|number|q)\s*\d+[a-z]?$/.test(value)) return 'next';
    if (/^(?:repeat(?: (?:that|it|the (?:last )?(?:hint|step|explanation)))?|say (?:that|it|the (?:last )?(?:hint|step|explanation)) again|tell me (?:that|it) again|go over (?:that|it) again|again)$/.test(value)) return 'repeat';
    if (/^(?:next(?: (?:hint|step|clue))?|(?:a |another |one more |the next |some )?(?:hint|clue)|(?:give|show|tell|offer) me (?:(?:a|another|one more|the next|some) )?(?:hint|clue|step)|(?:i need|i want|i would like|i'd like|id like) (?:a|another|one more|the next|some) (?:hint|clue)|help(?: me)?(?: start| get started)?|i need (?:some )?help|how (?:do i|can i|to) (?:start|begin)|what(?:'s|s| is) (?:the )?next(?: (?:step|hint|clue))?|what (?:should|do) i do next|go on|continue|carry on)$/.test(value)) return 'next';
    if (confusion(value) || /^(?:simpler|more simply|explain(?: (?:that|it))?(?: (?:more )?simply| in (?:simpler|simple) words)|make (?:that|it|the explanation) simpler|(?:put|say) (?:that|it) in (?:simpler|simple) words|say (?:that|it) more simply|use (?:simpler|simple) words|simplify (?:that|it)|break (?:that|it) down)$/.test(value)) return 'simpler';
    return '';
  }
  return Object.freeze({ classify: classify, questionNumber: questionNumber, needsFresh: needsFresh });
});
