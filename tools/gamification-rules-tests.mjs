import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addGameServerRules, GAME_RULE, GAME_COLLECTIONS, gameRuleTests, publishGameRules } from './gamification-rules.mjs';

const source = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isPermanentStudentHistoryPath() { return false; }
    function isLiveServerPath() { return false; }
    function isPolymathEnquiryServerPath() { return false; }
    match /{document=**} {
      allow read, write: if !isPermanentStudentHistoryPath() && !isLiveServerPath() && !isPolymathEnquiryServerPath();
    }
  }
}`;
test('protects exactly the reward roots while retaining all existing exclusions', () => {
  const result = addGameServerRules(source);
  assert.ok(result.includes('&& !isLiveServerPath() && !isPolymathEnquiryServerPath() && !isTutorGamePath()'));
  assert.equal(result.replace(GAME_RULE, '').replace(' && !isTutorGamePath()', ''), source);
  assert.equal(addGameServerRules(result), result);
  for (const root of GAME_COLLECTIONS) assert.ok(GAME_RULE.includes("'" + root + "'"));
});
test('unexpected or partly installed rules fail closed', () => {
  assert.throws(() => addGameServerRules(source.replace('!isPolymathEnquiryServerPath()', 'unknownGuard()')));
  assert.throws(() => addGameServerRules(source.replace('return false;', 'return false; // isTutorGamePath')));
  assert.throws(() => addGameServerRules(source + source));
});
test('permission suite covers browser/admin writes and nested reads for all roots', () => {
  const cases = gameRuleTests();
  assert.equal(cases.length, GAME_COLLECTIONS.length * 30);
  assert.ok(cases.every(c => c.expectation === 'DENY'));
  for (const root of GAME_COLLECTIONS) for (const method of ['get','list','create','update','delete'])
    assert.ok(cases.some(c => c.request.path.includes('/' + root) && c.request.method === method));
});
test('a failed permission check cannot publish production rules', async () => {
  const calls = [];
  const request = async (path, options={}) => {
    calls.push([path, options.method]);
    if (path.endsWith('releases/cloud.firestore')) return { rulesetName:'projects/mathgen--app/rulesets/original' };
    if (path.endsWith('/original')) return { source:{files:[{name:'firestore.rules',content:source}]} };
    return { testResults:[] };
  };
  await assert.rejects(publishGameRules({request, deploy:true}), /permission tests failed/);
  assert.ok(!calls.some(c => c[1] === 'PATCH' || c[0].endsWith('/rulesets')));
});
