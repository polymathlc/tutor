import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addGameServerRules, GAME_RULE, gameRuleTests } from './gamification-rules.mjs';
import { addCentreAdminServerRules, CENTRE_RULE, CENTRE_COLLECTION,
  centreAdminRuleTests, publishCentreAdminRules } from './centre-admin-rules.mjs';

const original = `rules_version = '2';
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
const source = addGameServerRules(original);

test('centre protection retains every unrelated rule and composes with repeated Adventure deploys', () => {
  const result = addCentreAdminServerRules(source);
  assert.ok(result.includes('&& !isTutorGamePath() && !isTutorCentreAdminPath()'));
  assert.equal(result.replace(CENTRE_RULE, '').replace(' && !isTutorCentreAdminPath()', ''), source);
  assert.equal(addCentreAdminServerRules(result), result);
  assert.equal(addCentreAdminServerRules(addGameServerRules(result)), result);
  assert.ok(result.includes(GAME_RULE));
  assert.ok(CENTRE_RULE.includes("'" + CENTRE_COLLECTION + "'"));
});

test('centre protection supports the recognized starter catch-all and either installation order', () => {
  const starter = original.replace('!isPermanentStudentHistoryPath() && !isLiveServerPath() && !isPolymathEnquiryServerPath()', 'true');
  assert.ok(addCentreAdminServerRules(starter).includes('if true && !isTutorCentreAdminPath()'));
  const reverse = addGameServerRules(addCentreAdminServerRules(original));
  assert.ok(reverse.includes('&& !isTutorGamePath() && !isTutorCentreAdminPath()'));
  assert.equal(addCentreAdminServerRules(reverse), reverse);
});

test('unexpected, duplicate and partial centre protection fails closed', () => {
  const installed = addCentreAdminServerRules(source);
  for (const content of [undefined, '', source + source,
    source.replace('!isPolymathEnquiryServerPath()', 'unknownGuard()'),
    installed.replace(CENTRE_RULE, ''),
    installed.replace(' && !isTutorCentreAdminPath()', ''),
    installed.replace("== 'tutorCentreAdmin'", "== 'someOtherCollection'"),
    source.replace(' && !isTutorGamePath()', ''),
    source.replace(GAME_RULE, '')]) assert.throws(() => addCentreAdminServerRules(content));
});

test('permission tests deny every operation for anonymous, member and admin clients including descendants', () => {
  const cases = centreAdminRuleTests();
  assert.equal(cases.length, 60);
  assert.ok(cases.every(c => c.expectation === 'DENY'));
  for (const uid of [null, 'centre-test-member', 'centre-test-admin']) {
    const requests = cases.filter(c => (c.request.auth?.uid || null) === uid).map(c => c.request);
    assert.equal(requests.length, 20);
    for (const method of ['get', 'list', 'create', 'update', 'delete'])
      assert.ok(requests.some(r => r.method === method));
    for (const path of ['students/records', 'sessions/records', 'audit/records'])
      assert.ok(requests.some(r => r.path.includes(path)));
    if (uid === 'centre-test-admin') assert.ok(requests.every(r => r.auth.token.admin));
  }
});

function mockRulesApi({ content = source, failValidation = 0, compilationError = false,
  race = false, invalidCandidate = false, unverifiedRelease = false } = {}) {
  const calls = [];
  let releaseReads = 0;
  let validations = 0;
  let applied = false;
  const request = async (path, options = {}) => {
    calls.push({ path, ...options });
    if (path.endsWith('releases/cloud.firestore')) {
      if (options.method === 'PATCH') { applied = true; return {}; }
      releaseReads++;
      return { rulesetName: 'projects/mathgen--app/rulesets/'
        + (applied && !unverifiedRelease ? 'candidate' : 'original'),
      updateTime: race && releaseReads > 1 ? 'changed' : 'initial' };
    }
    if (path.endsWith('/original')) return { source: { files: [{ name: 'firestore.rules', content }] } };
    if (path.endsWith(':test')) {
      validations++;
      return { testResults: options.body.testSuite.testCases.map((_, i) =>
        ({ state: failValidation === validations && i === 0 ? 'FAILURE' : 'SUCCESS' })),
      ...(compilationError ? { issues: [{ severity: 'ERROR' }] } : {}) };
    }
    if (path.endsWith('/rulesets')) return { name: invalidCandidate
      ? 'projects/another-project/rulesets/candidate' : 'projects/mathgen--app/rulesets/candidate' };
    throw new Error('Unexpected mock request: ' + path);
  };
  return { calls, request };
}

test('publishes only the verified candidate after validating preserved and new permissions', async () => {
  const api = mockRulesApi();
  const result = await publishCentreAdminRules({ request: api.request, deploy: true });
  assert.equal(result.changed, true);
  assert.equal(result.ruleset, 'projects/mathgen--app/rulesets/candidate');
  const tests = api.calls.filter(c => c.path.endsWith(':test'));
  assert.equal(tests.length, 2);
  assert.ok(tests[0].body.testSuite.testCases.length >= gameRuleTests().length);
  assert.equal(tests[1].body.testSuite.testCases.length - tests[0].body.testSuite.testCases.length, 60);
  assert.equal(tests[0].body.source.files[0].content, source);
  assert.equal(tests[1].body.source.files[0].content, addCentreAdminServerRules(source));
  const mutation = api.calls.find(c => c.method === 'PATCH');
  assert.equal(mutation.body.release.rulesetName, result.ruleset);
  assert.equal(api.calls.at(-1).path, 'projects/mathgen--app/releases/cloud.firestore');
});

test('permission or compilation failures cannot create or publish a ruleset', async () => {
  for (const options of [{ failValidation: 1 }, { failValidation: 2 }, { compilationError: true }]) {
    const api = mockRulesApi(options);
    await assert.rejects(publishCentreAdminRules({ request: api.request, deploy: true }), /permission tests failed/);
    assert.ok(!api.calls.some(c => c.method === 'PATCH' || c.path.endsWith('/rulesets')));
  }
});

test('a concurrently changed release cannot be overwritten', async () => {
  const api = mockRulesApi({ race: true });
  await assert.rejects(publishCentreAdminRules({ request: api.request, deploy: true }), /Active rules changed/);
  assert.ok(!api.calls.some(c => c.method === 'PATCH'));
});

test('unexpected candidate and unverified publication are reported', async () => {
  const invalid = mockRulesApi({ invalidCandidate: true });
  await assert.rejects(publishCentreAdminRules({ request: invalid.request, deploy: true }), /candidate ruleset path/);
  assert.ok(!invalid.calls.some(c => c.method === 'PATCH'));
  const unverified = mockRulesApi({ unverifiedRelease: true });
  await assert.rejects(publishCentreAdminRules({ request: unverified.request, deploy: true }), /Could not verify/);
});

test('read, test and repeated apply modes avoid writes', async () => {
  const read = mockRulesApi();
  assert.equal((await publishCentreAdminRules({ request: read.request, readOnly: true })).changeNeeded, true);
  assert.ok(read.calls.every(c => !c.method));
  const trial = mockRulesApi();
  assert.equal((await publishCentreAdminRules({ request: trial.request })).changeNeeded, true);
  assert.ok(!trial.calls.some(c => c.method === 'PATCH' || c.path.endsWith('/rulesets')));
  const repeat = mockRulesApi({ content: addCentreAdminServerRules(source) });
  assert.equal((await publishCentreAdminRules({ request: repeat.request, deploy: true })).changed, false);
  assert.ok(!repeat.calls.some(c => c.method === 'PATCH' || c.path.endsWith('/rulesets')));
});

test('unexpected projects and conflicting modes fail before any network request', async () => {
  const api = mockRulesApi();
  await assert.rejects(publishCentreAdminRules({ request: api.request, project: 'other-project' }), /Unexpected/);
  await assert.rejects(publishCentreAdminRules({ request: api.request, deploy: true, readOnly: true }), /cannot be combined/);
  assert.equal(api.calls.length, 0);
});
