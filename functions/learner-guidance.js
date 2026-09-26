(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TutorLevelGuidance = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const VERSION = 'worksheet-level-v1';
  const LEVELS = Object.freeze({
    P3: { label: 'Primary 3', teaching: 'Start with concrete objects, simple pictures or familiar everyday examples. Explain one observation or action at a time before naming an abstract idea.' },
    P4: { label: 'Primary 4', teaching: 'Use a familiar example or simple visual to explain one relationship at a time. Connect each new step to something the student can already see or knows.' },
    P5: { label: 'Primary 5', teaching: 'Link related ideas in short sequences. Explain why each small step follows from the previous one, with a familiar example when a concept is new.' },
    P6: { label: 'Primary 6', teaching: 'Scaffold multi-step questions with careful reasoning, revealing one manageable step at a time. Explain symbolic notation only when the worksheet requires it, and connect it to the meaning of the question.' },
    S1: { label: 'Secondary 1', teaching: 'Use a respectful early-secondary tone. Bridge from familiar primary-school ideas to new secondary-school terms and variables. Define new notation and explain what each variable represents before using it.' }
  });
  function normalizeLevel(value) {
    if (typeof value !== 'string' || value.length > 40) return '';
    const text = value.trim();
    const primary = /^(?:p|pri|primary)[\s-]*([3-6])$/i.exec(text);
    if (primary) return 'P' + primary[1];
    return /^(?:s|sec|secondary)[\s-]*1$/i.test(text) ? 'S1' : '';
  }
  function resolve(worksheetLevel, studentLevel) {
    const worksheet = normalizeLevel(worksheetLevel), student = normalizeLevel(studentLevel);
    const level = worksheet || student;
    return { level, label: level ? LEVELS[level].label : 'general beginner support', source: worksheet ? 'worksheet' : student ? 'student' : 'default' };
  }
  function instructions(worksheetLevel, studentLevel) {
    const guidance = resolve(worksheetLevel, studentLevel);
    return [
      guidance.level
        ? 'Language and teaching target: ' + guidance.label + ' (' + guidance.level + '), from ' + (guidance.source === 'worksheet' ? 'the worksheet level. This takes priority over the student profile level.' : 'the student profile because the worksheet has no recognised level.')
        : 'The worksheet and student profile have no recognised level. Use general beginner support: begin with simple, concrete language and check understanding before adding complexity. Do not invent a school level or age.',
      guidance.level ? LEVELS[guidance.level].teaching : 'Use a familiar example and ask one brief question if you need to check the student\'s prior knowledge.',
      'Use short, plain sentences and one manageable teaching step at a time. Define a new term in everyday words when it first appears. Use familiar examples while preserving correct subject terms, scientific accuracy and the meaning of the question.',
      'Keep methods and notation appropriate to the worksheet level and the teacher\'s syllabus. Do not introduce unnecessary advanced methods or notation. Be respectful and encouraging; do not talk down to the student or assume an exact age or date of birth.',
      'If the student is confused, simplify the vocabulary and reduce the step size; do not reveal more of the answer. These language guidelines never raise the allowed help ceiling or override the teacher\'s restrictions.'
    ].join('\n');
  }
  return Object.freeze({ VERSION, normalizeLevel, resolve, instructions });
});
