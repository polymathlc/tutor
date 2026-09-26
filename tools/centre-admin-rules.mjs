// Add centre administration protection to the CURRENT shared project rules.
// Never deploy a repository-local replacement for this project's rules.
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { GAME_RULE, gameRuleTests, preservedRuleTests } from './gamification-rules.mjs';

export const CENTRE_COLLECTION = 'tutorCentreAdmin';
export const CENTRE_RULE = `
    // BEGIN tutor-centre-admin-server-only-v1
    // Centre students, practice authorizations and audit records are server-owned.
    function isTutorCentreAdminPath() {
      return request.path[3] == 'tutorCentreAdmin';
    }
    // END tutor-centre-admin-server-only-v1
`;

export function addCentreAdminServerRules(source) {
  if (typeof source !== 'string') throw new Error('No production rules source.');
  const scopes = [...source.matchAll(/^[ \t]*match\s+\/databases\/\{\w+\}\/documents\s*\{/gm)];
  if (scopes.length !== 1 || !/service\s+cloud\.firestore\s*\{/.test(source))
    throw new Error('Unrecognized production Firestore scope.');
  const hasRule = source.includes(CENTRE_RULE);
  if (!hasRule && /tutor-centre-admin-server-only-v1|isTutorCentreAdminPath/.test(source))
    throw new Error('Existing centre protection differs; review it before changing rules.');
  const blanket = /(^[ \t]*match\s+\/\{\w+=\*\*\}\s*\{\s*allow\s+read\s*,\s*write\s*:\s*if\s+)(true|!isPermanentStudentHistoryPath\(\))((?: && !(?:isLiveServerPath|isPolymathEnquiryServerPath)\(\))*)((?: && !isTutorGamePath\(\))?)((?: && !isTutorCentreAdminPath\(\))?)(\s*;\s*\})/gm;
  const matches = [...source.matchAll(blanket)];
  if (matches.length !== 1)
    throw new Error('Expected exactly one recognized shared catch-all; review current rules.');
  const match = matches[0];
  if (source.includes(GAME_RULE) !== (match[4] === ' && !isTutorGamePath()'))
    throw new Error('Incomplete Adventure protection; refusing to change shared rules.');
  const protectedAlready = match[5] === ' && !isTutorCentreAdminPath()';
  if (hasRule !== protectedAlready)
    throw new Error('Incomplete centre protection; refusing to guess a repair.');
  if (hasRule) return source;
  const narrowed = match[1] + match[2] + match[3] + match[4] + ' && !isTutorCentreAdminPath()' + match[6];
  let updated = source.slice(0, match.index) + narrowed + source.slice(match.index + match[0].length);
  const index = scopes[0].index + scopes[0][0].length;
  updated = updated.slice(0, index) + CENTRE_RULE + updated.slice(index);
  const restored = updated.replace(CENTRE_RULE, '').replace(narrowed, match[0]);
  if (restored !== source) throw new Error('Unrelated rules changed unexpectedly.');
  return updated;
}

function permissionCase(path, method, uid, admin = false) {
  const data = { test: true };
  return { expectation: 'DENY', request: {
    path: '/databases/(default)/documents/' + path, method,
    auth: uid ? { uid, token: { sub: uid, admin } } : null,
    ...(['create', 'update'].includes(method) ? { resource: { data } } : {})
  }, ...(method !== 'create' ? { resource: { data } } : {}) };
}

export function centreAdminRuleTests() {
  // Authenticated clients, including admins, must use the server endpoints.
  // Descendant checks cover student records, practice sessions and audit logs.
  const documents = [CENTRE_COLLECTION + '/probe',
    CENTRE_COLLECTION + '/students/records/probe',
    CENTRE_COLLECTION + '/sessions/records/probe',
    CENTRE_COLLECTION + '/audit/records/probe'];
  const collections = [CENTRE_COLLECTION, CENTRE_COLLECTION + '/students/records',
    CENTRE_COLLECTION + '/sessions/records', CENTRE_COLLECTION + '/audit/records'];
  return [null, 'centre-test-member', 'centre-test-admin'].flatMap(uid => [
    ...documents.flatMap(path => ['get', 'create', 'update', 'delete'].map(method =>
      permissionCase(path, method, uid, uid === 'centre-test-admin'))),
    ...collections.map(path => permissionCase(path, 'list', uid, uid === 'centre-test-admin'))
  ]);
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

export async function publishCentreAdminRules({ request, project = 'mathgen--app', deploy = false, readOnly = false }) {
  if (project !== 'mathgen--app') throw new Error('Unexpected shared Firebase project.');
  if (deploy && readOnly) throw new Error('Read-only and apply modes cannot be combined.');
  const releasePath = `projects/${project}/releases/cloud.firestore`;
  const previous = await request(releasePath);
  const validRuleset = name => typeof name === 'string'
    && name.startsWith(`projects/${project}/rulesets/`) && !!name.slice(`projects/${project}/rulesets/`.length)
    && !name.slice(`projects/${project}/rulesets/`.length).includes('/');
  if (!validRuleset(previous.rulesetName)) throw new Error('Unexpected current ruleset path.');
  const production = await request(previous.rulesetName);
  const files = production.source?.files;
  if (!Array.isArray(files) || files.length !== 1 || typeof files[0].name !== 'string')
    throw new Error('Unexpected shared rules source bundle.');
  const original = files[0].content;
  const content = addCentreAdminServerRules(original);
  const hash = createHash('sha256').update(content).digest('hex');
  const changed = content !== original;
  if (readOnly) return { mode: 'read', ruleset: previous.rulesetName, changeNeeded: changed, sourceSha256: hash };
  const source = { files: [{ ...files[0], content }] };
  const preserved = [...preservedRuleTests(original), ...(original.includes(GAME_RULE) ? gameRuleTests() : [])];
  await validate(request, project, production.source, preserved);
  const testCases = [...preserved, ...centreAdminRuleTests()];
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
  if (live.rulesetName !== candidate.name) throw new Error('Could not verify the published centre protection.');
  return { mode: 'apply', changed: true, validated: testCases.length, previousRuleset: previous.rulesetName,
    ruleset: live.rulesetName, sourceSha256: hash };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const flags = process.argv.slice(2);
  const cliIndex = flags.indexOf('--firebase-tools');
  const cliRoot = cliIndex >= 0 ? flags.splice(cliIndex, 2)[1] : null;
  if (!cliRoot || cliRoot.startsWith('--') || flags.some(flag => !['--read', '--apply'].includes(flag)) || flags.length > 1)
    throw new Error('Pass --firebase-tools <installed-package-directory>, plus --read, --apply, or no mode flag to test.');
  // Reuse Firebase CLI authentication without accessing or printing credentials.
  const require = createRequire(import.meta.url);
  const cli = name => require(resolve(cliRoot, 'lib', name));
  const { Command } = cli('command');
  const { requireAuth } = cli('requireAuth');
  const { logger } = cli('logger');
  const { Client } = cli('apiv2');
  logger.silent = true;
  const command = new Command('centre:rules').before(requireAuth).action(async options => {
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
    console.log(JSON.stringify(await publishCentreAdminRules({ request, deploy: flags.includes('--apply'), readOnly: flags.includes('--read') }), null, 2));
  });
  await command.runner()({ project: 'mathgen--app', projectId: 'mathgen--app', projectNumber: '165654161198',
    nonInteractive: true, cwd: process.cwd() });
}
