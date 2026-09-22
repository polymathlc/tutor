// Narrow only the Study Adventure bookkeeping namespaces in the CURRENT shared rules.
// Never deploy an app-local replacement for this shared project's rules.
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const GAME_COLLECTIONS = Object.freeze([
  'tutorGameProfiles', 'tutorGameEvents', 'tutorGameBoards', 'tutorGameGroups'
]);
export const GAME_RULE = `
    // BEGIN tutor-game-server-only-v1
    // Adventure rewards, profiles and league membership are server-owned.
    function isTutorGamePath() {
      return request.path[3] in [
        'tutorGameProfiles', 'tutorGameEvents',
        'tutorGameBoards', 'tutorGameGroups'
      ];
    }
    // END tutor-game-server-only-v1
`;

export function addGameServerRules(source) {
  if (typeof source !== 'string') throw new Error('No production rules source.');
  const scope = /^[ \t]*match\s+\/databases\/\{\w+\}\/documents\s*\{/gm;
  const scopes = [...source.matchAll(scope)];
  if (scopes.length !== 1 || !/service\s+cloud\.firestore\s*\{/.test(source))
    throw new Error('Unrecognized production Firestore scope.');
  const hasRule = source.includes(GAME_RULE);
  if (!hasRule && /tutor-game-server-only-v1|isTutorGamePath/.test(source))
    throw new Error('Existing Game protection differs; review it before changing rules.');
  const blanket = /(^[ \t]*match\s+\/\{\w+=\*\*\}\s*\{\s*allow\s+read\s*,\s*write\s*:\s*if\s+)(true|!isPermanentStudentHistoryPath\(\))((?: && !(?:isLiveServerPath|isPolymathEnquiryServerPath)\(\))*)((?: && !isTutorGamePath\(\))?)(\s*;\s*\})/gm;
  const matches = [...source.matchAll(blanket)];
  if (matches.length !== 1)
    throw new Error('Expected exactly one recognized shared catch-all; review current rules.');
  const match = matches[0];
  const protectedAlready = match[4] === ' && !isTutorGamePath()';
  if (hasRule !== protectedAlready)
    throw new Error('Incomplete Game protection; refusing to guess a repair.');
  if (hasRule) return source;
  const narrowed = match[1] + match[2] + match[3] + ' && !isTutorGamePath()' + match[5];
  let updated = source.slice(0, match.index) + narrowed + source.slice(match.index + match[0].length);
  const index = scopes[0].index + scopes[0][0].length;
  updated = updated.slice(0, index) + GAME_RULE + updated.slice(index);
  const restored = updated.replace(GAME_RULE, '').replace(narrowed, match[0]);
  if (restored !== source) throw new Error('Unrelated rules changed unexpectedly.');
  return updated;
}

function permissionCase(root, method, uid, expectation, data = { test: true }, admin = false) {
  return { expectation, request: {
    path: '/databases/(default)/documents/' + root, method,
    auth: uid ? { uid, token: { sub: uid, admin } } : null,
    ...(['create', 'update'].includes(method) ? { resource: { data } } : {})
  }, ...(method !== 'create' ? { resource: { data } } : {}) };
}

export function gameRuleTests() {
  // Exercise documents, descendants and collection listing for anonymous,
  // signed-in and admin-claim clients. Admin SDK service calls bypass rules.
  return GAME_COLLECTIONS.flatMap(root => [null, 'live-test-user', 'live-test-admin'].flatMap(uid => {
    const admin = uid === 'live-test-admin';
    const documents = [root + '/test', root + '/test/nested/child'];
    return [
      ...documents.flatMap(path => ['get', 'create', 'update', 'delete'].map(method =>
        permissionCase(path, method, uid, 'DENY', { test: true }, admin))),
      ...[root, root + '/test/nested'].map(path => permissionCase(path, 'list', uid, 'DENY', { test: true }, admin))
    ];
  }));
}

export function preservedRuleTests(source) {
  // Current shared starter rules allow these unrelated paths. Tests run on
  // BOTH source versions, so unexpected legacy permissions block publication.
  const roots = ['users/probe', 'users/probe/settings/profile', 'scienceQuestions/probe',
    'scanPapers/probe', 'pdfAnnotator/probe', 'tutorWorksheets/probe',
    'studyBuddyGameSessionsArchive/probe', 'users/probe/studyBuddyGameSessions/nested'];
  const cases = roots.flatMap(root => ['get', 'list', 'create', 'update', 'delete'].map(method =>
    permissionCase(root, method, null, 'ALLOW')));
  if (source.includes('permanent-student-question-history-v1')) {
    const root = 'users/history-test-owner/questionHistory/math-' + 'a'.repeat(64) + '/entries/' + 'b'.repeat(64);
    const data = { kind: 'id', value: 'history-test-question', at: 1 };
    cases.push(permissionCase(root, 'get', 'history-test-owner', 'ALLOW', data),
      permissionCase(root, 'create', 'history-test-owner', 'ALLOW', data),
      permissionCase(root, 'get', null, 'DENY', data),
      permissionCase(root, 'get', 'another-user', 'DENY', data),
      permissionCase(root, 'update', 'history-test-owner', 'DENY', data),
      permissionCase(root, 'delete', 'history-test-owner', 'DENY', data));
  }
  return cases;
}

async function validate(request, project, source, testCases) {
  const result = await request(`projects/${project}:test`, {
    method: 'POST', body: { source, testSuite: { testCases } }
  });
  const failed = (result.testResults || []).flatMap((test, index) => test.state === 'SUCCESS' ? [] : [index]);
  if ((result.issues || []).some(issue => issue.severity === 'ERROR')
    || result.testResults?.length !== testCases.length || failed.length)
    throw new Error('Shared rules permission tests failed; active rules were not changed. '
      + JSON.stringify({ failedCaseIndexes: failed, expectedResults: testCases.length,
        receivedResults: result.testResults?.length || 0,
        compilationErrors: (result.issues || []).filter(issue => issue.severity === 'ERROR').length }));
}

export async function publishGameRules({ request, project = 'mathgen--app', deploy = false, readOnly = false }) {
  if (project !== 'mathgen--app') throw new Error('Unexpected shared Firebase project.');
  if (deploy && readOnly) throw new Error('Read-only and apply modes cannot be combined.');
  const releasePath = `projects/${project}/releases/cloud.firestore`;
  const previous = await request(releasePath);
  const validRuleset = name => typeof name === 'string'
    && name.startsWith(`projects/${project}/rulesets/`) && !name.slice(`projects/${project}/rulesets/`.length).includes('/');
  if (!validRuleset(previous.rulesetName)) throw new Error('Unexpected current ruleset path.');
  const production = await request(previous.rulesetName);
  const files = production.source?.files;
  if (!Array.isArray(files) || files.length !== 1 || typeof files[0].name !== 'string')
    throw new Error('Unexpected shared rules source bundle.');
  const original = files[0].content;
  const content = addGameServerRules(original);
  const hash = createHash('sha256').update(content).digest('hex');
  const changed = content !== original;
  if (readOnly) return { mode: 'read', ruleset: previous.rulesetName, changeNeeded: changed, sourceSha256: hash };
  const source = { files: [{ ...files[0], content }] };
  const preserved = preservedRuleTests(original);
  await validate(request, project, production.source, preserved);
  const testCases = [...preserved, ...gameRuleTests()];
  await validate(request, project, source, testCases);
  if (!deploy || !changed) return { mode: deploy ? 'apply' : 'test', changed: false, changeNeeded: changed,
    validated: testCases.length, ruleset: previous.rulesetName, sourceSha256: hash };
  const candidate = await request(`projects/${project}/rulesets`, { method: 'POST', body: { source } });
  if (!validRuleset(candidate.name)) throw new Error('Unexpected candidate ruleset path.');
  const latest = await request(releasePath);
  if (latest.rulesetName !== previous.rulesetName || latest.updateTime !== previous.updateTime)
    throw new Error('Active rules changed during validation. Retry against the latest rules.');
  await request(releasePath, { method: 'PATCH', body: {
    release: { name: releasePath, rulesetName: candidate.name }, updateMask: 'rulesetName'
  } });
  const live = await request(releasePath);
  if (live.rulesetName !== candidate.name) throw new Error('Could not verify the published Game protection.');
  return { mode: 'apply', changed: true, validated: testCases.length, previousRuleset: previous.rulesetName,
    ruleset: live.rulesetName, sourceSha256: hash };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const flags = process.argv.slice(2);
  const cliIndex = flags.indexOf('--firebase-tools');
  const cliRoot = cliIndex >= 0 ? flags.splice(cliIndex, 2)[1] : null;
  if (!cliRoot || cliRoot.startsWith('--') || flags.some(flag => !['--read', '--apply'].includes(flag)) || flags.length > 1)
    throw new Error('Pass --firebase-tools <installed-package-directory>, plus --read, --apply, or no mode flag to test.');
  // The existing Firebase CLI session owns authentication. This program never
  // reads credential values, signs in, or prints request/response headers.
  const require = createRequire(import.meta.url);
  const cli = name => require(resolve(cliRoot, 'lib', name));
  const { Command } = cli('command');
  const { requireAuth } = cli('requireAuth');
  const { logger } = cli('logger');
  const { Client } = cli('apiv2');
  logger.silent = true;
  const command = new Command('game:rules').before(requireAuth).action(async options => {
    if (options.projectId !== 'mathgen--app') throw new Error('Unexpected shared Firebase project.');
    const client = new Client({ urlPrefix: 'https://firebaserules.googleapis.com', apiVersion: 'v1' });
    const request = async (path, requestOptions = {}) => {
      try {
        const response = await client.request({ method: requestOptions.method || 'GET', path,
          ...(requestOptions.body ? { body: requestOptions.body } : {}),
          skipLog: { reqHeaders: true, reqBody: true, resHeaders: true, resBody: true } });
        return response.body;
      } catch (error) {
        throw new Error('Firebase rules request failed (HTTP ' + (error.status || error.statusCode || 'unknown') + ').');
      }
    };
    console.log(JSON.stringify(await publishGameRules({ request, deploy: flags.includes('--apply'), readOnly: flags.includes('--read') }), null, 2));
  });
  await command.runner()({ project: 'mathgen--app', projectId: 'mathgen--app', projectNumber: '165654161198',
    nonInteractive: true, cwd: process.cwd() });
}
