import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const readText = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const readJson = (rel) => JSON.parse(readText(rel));
const sha256 = (rel) => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, rel))).digest('hex');
const checks = [];
const pass = (id, detail = {}) => { checks.push({ id, status: 'PASS', ...detail }); };
const fail = (id, detail = {}) => { checks.push({ id, status: 'FAIL', ...detail }); };
const assert = (condition, id, detail = {}) => (condition ? pass(id, detail) : fail(id, detail));
const exists = (rel) => fs.existsSync(path.join(root, rel));
const expectedPlanSha = '4d0de339bc62095b99735914dde14f936a33bcedd0ca03db573c57a89681898a';
const expectedCropSha = '65fc5aa17eb87f38ebe369aa3b4902b512a06cf2710f6b0f6e70b3015f3ec788';
const protectedFiles = [
  'scripts/lib/canonical-semver-compatibility.mjs', 'scripts/verify-contract.mjs',
  'scripts/verify-g4-google-static-release-freeze.mjs', 'scripts/verify-p0-0-1-g4-forward-compatibility.mjs', 'scripts/verify-p0-0-2-g4-historical-scope.mjs',
  'scripts/verify-p0-0-3-canonical-compatibility.mjs', 'tests/contracts/canonical-semver-compatibility.test.ts', 'tests/google-static/google-static-g0-1-canonical-compatibility.test.ts',
  'tests/google-static/google-static-g4-verifier-forward-compatibility.test.ts', 'tests/google-static/google-static-g4-historical-scope.test.ts',
];
const changedFiles = (() => {
  try {
    const out = execFileSync('git', ['diff', '--name-only', '1112bd130f720c3413f5de1bd4d9662af499d272'], { cwd: root, encoding: 'utf8' });
    return out.split(/\r?\n/).filter(Boolean);
  } catch { return []; }
})();
assert(!changedFiles.some((file) => protectedFiles.includes(file)), 'protected-files-unchanged', { changedProtectedFiles: changedFiles.filter((file) => protectedFiles.includes(file)) });

// P0.0.4 intentionally changed the G0.1 verifier implementation. Protect its
// historical meaning and the frozen evidence instead of requiring byte equality
// for that maintenance source file.
const g01AcceptedCommit = '731b956e69700154a8b8e1c51ec9a2b7973aa07f';
const g01FreezeCommit = 'ef807153c1143966a3f6d83bf01704bf1d2ad206';
const g01FrozenCanonicalVersion = '1.24.0';
const g01FrozenCanonicalSha256 = '9371f2710545acb6bb94d7af49f98b510b55e230544072fa4a3b12aec245f2b7';
const g4ProtectedArtifactDigests = {
  'artifacts/g4/google-static-user-acceptance.json': '4fa53e5d22b1390f19418716c7592a483175f13813c3960fdc604b56f86cda4c',
  'artifacts/g4/google-static-external-review.json': 'c4abda81143b966f18380761a16e1d229b212b8f0d4361f838665e66a2768a7e',
  'contracts/google/release-freeze.g4.json': '6198af1c6d1f78f0ea7df21aac96587cbb5fd76cd3f751adff778018575f9680',
};

function git(args, encoding = 'utf8') {
  try { return execFileSync('git', args, { cwd: root, encoding }).toString(); } catch { return ''; }
}

function isAncestor(ancestor, descendant) {
  try { execFileSync('git', ['merge-base', '--is-ancestor', ancestor, descendant], { cwd: root, stdio: 'ignore' }); return true; }
  catch { return false; }
}

function historicalFile(commit, relativePath) {
  return git(['show', `${commit}:${relativePath}`]);
}

const g01Source = readText('scripts/verify-g0-1-google-architecture-freeze.mjs');
const g01RuntimeSectionStart = g01Source.indexOf('const historicalFiles =');
const g01RuntimeSectionEnd = g01Source.indexOf('check("runtime_google_profiles_absent"');
const g01RuntimeSection = g01RuntimeSectionStart >= 0 && g01RuntimeSectionEnd > g01RuntimeSectionStart
  ? g01Source.slice(g01RuntimeSectionStart, g01RuntimeSectionEnd)
  : '';
const g01SemanticChecks = {
  acceptedCommitPinned: g01Source.includes(`const acceptedCommit = "${g01AcceptedCommit}"`),
  acceptedTreeInspection: g01Source.includes('collectHistoricalFiles(commit, ".")') && g01Source.includes('collectHistoricalRuntimeFiles(acceptedCommit)'),
  exactRuntimeScope: g01Source.includes('productionRuntimePath = /^(?:src\\/|apps\\/|packages\\/|fixtures\\/golden\\/)/u'),
  activeRegistryScope: g01Source.includes('contracts/freeform-format-profiles.json') && g01Source.includes('contracts/desktop-capability-registry.json'),
  currentWorktreeNotUsedForHistoricalAbsence: !g01RuntimeSection.includes('collectFiles(') && !g01RuntimeSection.includes('path.join(root, relativePath)'),
  noWildcardHistoricalPolicy: !/glob|wildcard|\*\*/iu.test(g01RuntimeSection),
  historicalAssertionPresent: g01Source.includes('historicalGoogleHits.length === 0'),
  runtimeTextAndPathInspection: g01Source.includes('google|GOOGLE/u.test(relativePath)') && g01Source.includes('readHistoricalFile(acceptedCommit, relativePath)'),
};
assert(Object.values(g01SemanticChecks).every(Boolean), 'g0-1-semantic-protection', g01SemanticChecks);

const g01Registry = readJson('contracts/google/architecture-freeze.g0.1.json');
const g01Evidence = readJson('artifacts/g0-1/google-static-architecture-freeze-verification.json');
const g01FreezeParent = git(['rev-parse', `${g01FreezeCommit}^`]).trim();
const g01FreezeCanonicalSha256 = crypto.createHash('sha256').update(execFileSync('git', ['show', `${g01FreezeCommit}:docs/kakao-bizboard-renderer-spec-v1.md`], { cwd: root, encoding: 'buffer' })).digest('hex');
assert(g01Registry.acceptedFromCommit === g01AcceptedCommit && g01Evidence.acceptedFromCommit === g01AcceptedCommit && g01FreezeParent === g01AcceptedCommit && g01FreezeCanonicalSha256 === g01FrozenCanonicalSha256, 'g0-1-historical-snapshot-exact', {
  acceptedFromCommit: g01Registry.acceptedFromCommit,
  evidenceAcceptedFromCommit: g01Evidence.acceptedFromCommit,
  freezeParent: g01FreezeParent,
  freezeCanonicalSha256: g01FreezeCanonicalSha256,
  expectedCanonicalSha256: g01FrozenCanonicalSha256,
});
assert(isAncestor(g01AcceptedCommit, g01FreezeCommit) && isAncestor(g01FreezeCommit, 'HEAD'), 'g0-1-freeze-ancestry', { acceptedFromCommit: g01AcceptedCommit, freezeCommit: g01FreezeCommit, currentHead: git(['rev-parse', 'HEAD']).trim() });
assert(g01Registry.status === 'FROZEN' && g01Evidence.status === 'PASS' && g01Evidence.runtimeNetworkRequests === 0 && g01Evidence.frozenChannelOutputChanges === 0, 'g0-1-frozen-evidence-integrity', { registryStatus: g01Registry.status, evidenceStatus: g01Evidence.status, runtimeNetworkRequests: g01Evidence.runtimeNetworkRequests, frozenChannelOutputChanges: g01Evidence.frozenChannelOutputChanges });
const g4DigestMismatches = Object.entries(g4ProtectedArtifactDigests).filter(([relativePath, expected]) => sha256(relativePath) !== expected).map(([relativePath]) => relativePath);
assert(g4DigestMismatches.length === 0, 'protected-frozen-artifact-digests', { mismatches: g4DigestMismatches, expected: g4ProtectedArtifactDigests });
const g4Freeze = readJson('contracts/google/release-freeze.g4.json');
assert(g4Freeze.acceptedPack?.sha256 === '8ea80cda80f53347a08d89cadaaf5501a73fb5b687e2724fc90e111ac32d8ffa' && g4Freeze.acceptedPack?.bytes === 9220434 && g4Freeze.acceptedPack?.zipEntries === 255, 'accepted-pack-identity', { acceptedPack: g4Freeze.acceptedPack });
const productionChangedFiles = changedFiles.filter((file) => /^(src|apps|packages\/renderer-contract\/src|fixtures\/golden)\//u.test(file));
assert(productionChangedFiles.length === 0, 'production-runtime-unchanged', { productionChangedFiles });

const versions = readJson('contracts/contract-versions.json');
const canonical = readText('docs/kakao-bizboard-renderer-spec-v1.md');
assert(/\*\*Document version:\*\* 1\.33\.0/.test(canonical), 'canonical-version-1.33.0');
assert(versions.documentVersion?.current === '1.33.0', 'contract-version-registry-current');
assert(versions.activeCanonical?.version === '1.33.0' && versions.activeCanonical?.sha256 === sha256('docs/kakao-bizboard-renderer-spec-v1.md'), 'active-canonical-digest');
assert(versions.canonicalPhaseP0Plume?.p1Started === false, 'p1-not-started');

assert(exists('packages/renderer-contract/schema/image-placement-plan-v1.schema.json') && sha256('packages/renderer-contract/schema/image-placement-plan-v1.schema.json') === expectedPlanSha, 'image-placement-plan-reused', { version: '1.8.0', sha256: expectedPlanSha });
assert(exists('packages/renderer-contract/schema/crop-candidate-v1.schema.json') && sha256('packages/renderer-contract/schema/crop-candidate-v1.schema.json') === expectedCropSha, 'crop-candidate-reused', { version: '1.8.0', sha256: expectedCropSha });

const schemaPaths = ['packages/renderer-contract/schema/placement-capability-hints-v1.schema.json', 'packages/renderer-contract/schema/placement-provenance-envelope-v1.schema.json'];
const schemaIds = schemaPaths.map((rel) => readJson(rel).$id);
assert(new Set(schemaIds).size === schemaIds.length, 'neutral-schema-id-uniqueness');
assert(schemaPaths.every((rel) => readJson(rel).properties.schemaVersion.const === '1.0.0'), 'neutral-schema-version');
const matrix = readJson('contracts/p0-plume-capability-matrix.json');
assert(matrix.status === 'FROZEN' && matrix.registryVersion === '1.0.0', 'capability-matrix-frozen');
const rows = Array.isArray(matrix.rows) ? matrix.rows : [];
assert(rows.length === 170, 'profile-count-total', { passed: rows.length, total: 170 });
const counts = Object.fromEntries(['KAKAO', 'NAVER', 'META_STATIC', 'GOOGLE'].map((platform) => [platform, rows.filter((row) => row.platform === platform).length]));
assert(counts.KAKAO === 21 && counts.NAVER === 132 && counts.META_STATIC === 3 && counts.GOOGLE === 14, 'profile-count-by-platform', { counts });
const keys = rows.map((row) => `${row.platform}:${row.profileId}`);
assert(new Set(keys).size === keys.length, 'profile-key-uniqueness', { duplicates: keys.filter((key, index) => keys.indexOf(key) !== index) });
assert(rows.every((row) => row.evidenceClass !== 'UNRESOLVED' && row.sourceContract?.path && /^[a-f0-9]{64}$/.test(row.sourceContract.sha256)), 'profile-source-contracts-resolved');
assert(rows.every((row) => row.compositionMode !== 'PLATFORM_COMPOSED' || row.rendererOwnsPixels === false), 'platform-composed-not-rasterized');
assert(matrix.missingActiveOrFrozenProfiles.length === 0 && matrix.duplicateKeys.length === 0 && matrix.behaviorAffectingUnresolvedRows.length === 0, 'matrix-completeness');

const hints = readJson('contracts/placement-capability-hints.json');
const provenance = readJson('contracts/placement-provenance-envelope.json');
assert(hints.contractVersion === '1.0.0' && hints.status === 'FROZEN' && hints.authoringOnly === true, 'capability-hints-boundary');
assert(provenance.contractVersion === '1.0.0' && provenance.status === 'FROZEN' && provenance.neutral === true && provenance.producerIsAdvisory === true, 'provenance-boundary');
const freeze = readJson('contracts/p0-plume-architecture-freeze.json');
assert(freeze.registryVersion === '1.0.0' && freeze.status === 'FROZEN', 'architecture-freeze-registry');
assert(freeze.dependencyDirection === 'PLUME_TO_RENDERER_ONLY' && freeze.rendererDependsOnPlume === false && freeze.livePlumeCallDuringRender === false && freeze.runtimeNetworkAccess === 'PROHIBITED', 'dependency-boundary');
assert(freeze.p1Started === false && freeze.nextPhase === 'AWAIT_P1_INSTRUCTION', 'next-phase-boundary');
assert(freeze.failClosedRules.length === 16 && new Set(freeze.failClosedRules.map((rule) => rule.errorCode)).size === 16, 'fail-closed-registry');

const validDir = 'fixtures/p0-plume/valid';
const invalidDir = 'fixtures/p0-plume/invalid';
const validFiles = fs.readdirSync(path.join(root, validDir)).filter((file) => file.endsWith('.json'));
const invalidFiles = fs.readdirSync(path.join(root, invalidDir)).filter((file) => file.endsWith('.json'));
assert(validFiles.length === 3, 'valid-fixture-count', { passed: validFiles.length, total: 3 });
assert(invalidFiles.length === 16, 'invalid-fixture-count', { passed: invalidFiles.length, total: 16 });
const invalidResults = invalidFiles.map((file) => readJson(path.join(invalidDir, file).replace(`${root}${path.sep}`, '').replaceAll('\\', '/')));
assert(invalidResults.every((fixture) => fixture.valid === false && fixture.expected?.severity === 'ERROR' && fixture.expected?.publishAllowed === false && fixture.expected?.evidence === 'EXPECTED_FAIL_CONFIRMED'), 'invalid-fixtures-expected-fail', { passed: invalidResults.length, total: invalidResults.length });
assert(new Set(invalidResults.map((fixture) => fixture.expected.errorCode)).size === invalidResults.length, 'invalid-error-code-uniqueness');
assert(validFiles.every((file) => { const fixture = readJson(`${validDir}/${file}`); return fixture.valid === true && fixture.expected?.evidence === 'EXECUTED'; }), 'valid-fixtures-parse');

const p0Paths = ['contracts/p0-plume-capability-matrix.json', 'contracts/placement-capability-hints.json', 'contracts/placement-provenance-envelope.json', 'contracts/p0-plume-architecture-freeze.json', ...schemaPaths, ...validFiles.map((file) => `${validDir}/${file}`), ...invalidFiles.map((file) => `${invalidDir}/${file}`)];
const forbiddenPath = /(file:\/\/|^[A-Za-z]:[\\/]|^\\\\|(?:^|[\\/])Users[\\/]|(?:^|[\\/])home[\\/]|\.\.[\\/])/i;
const collectStrings = (value, key = '') => {
  if (typeof value === 'string') return [{ key, value }];
  if (Array.isArray(value)) return value.flatMap((item) => collectStrings(item, key));
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([childKey, child]) => collectStrings(child, childKey));
  return [];
};
const hygieneViolations = p0Paths.flatMap((rel) => {
  const values = collectStrings(readJson(rel));
  const bad = values.some(({ key, value }) => {
    if (forbiddenPath.test(value)) return true;
    if (key === '$schema') return false;
    return [...value.matchAll(/https?:\/\/[^"'\s)]+/gi)].some((match) => !match[0].startsWith('https://kbr.local/'));
  });
  return bad ? [rel] : [];
});
assert(hygieneViolations.length === 0, 'p0-path-hygiene', { violations: hygieneViolations });

const result = {
  verifier: 'P0_PLUME_INTEGRATION_CONTRACT_AND_ARCHITECTURE_FREEZE_FINAL_RERUN', version: '1.0.0', status: checks.every((x) => x.status === 'PASS') ? 'PASS' : 'FAIL',
  checks, passed: checks.filter((x) => x.status === 'PASS').length, total: checks.length,
  profiles: { total: rows.length, byPlatform: counts }, invalidFixtures: { passed: invalidResults.filter((x) => x.expected.evidence === 'EXPECTED_FAIL_CONFIRMED').length, total: invalidResults.length },
  protectedChangedFiles: changedFiles.filter((file) => protectedFiles.includes(file)),
  g0_1SemanticProtection: { passed: Object.values(g01SemanticChecks).every(Boolean), checks: g01SemanticChecks, acceptedFromCommit: g01AcceptedCommit, freezeCommit: g01FreezeCommit, frozenCanonicalVersion: g01FrozenCanonicalVersion, frozenCanonicalSha256: g01FrozenCanonicalSha256, freezeCanonicalSha256: g01FreezeCanonicalSha256, g4ProtectedArtifactDigests, g4DigestMismatches, productionChangedFiles },
  canonicalSha256: sha256('docs/kakao-bizboard-renderer-spec-v1.md'),
};
console.log(JSON.stringify(result, null, 2));
if (result.status !== 'PASS') process.exitCode = 1;
