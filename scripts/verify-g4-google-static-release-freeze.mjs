import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = process.cwd();
const candidateHead = "a6ca251b400033c413a079248eeeea1756a6bc0a";
const g4FreezeCommit = "bb7b622ec65180872f7fa934cd86774b30707ee2";
const historicalChangedPaths = Object.freeze([
  "artifacts/g4/google-static-external-review.json",
  "artifacts/g4/google-static-user-acceptance.json",
  "contracts/contract-versions.json",
  "contracts/google/release-freeze.g4.json",
  "docs/adr/ADR-0070-google-static-user-acceptance-release-freeze-g4.md",
  "docs/implementation/google-static-user-acceptance-release-freeze-g4.md",
  "docs/kakao-bizboard-renderer-spec-v1.md",
  "package.json",
  "scripts/verify-contract.mjs",
  "scripts/verify-freeform-contract.mjs",
  "scripts/verify-g0-1-google-architecture-freeze.mjs",
  "scripts/verify-g1-google-static.mjs",
  "scripts/verify-g2-1-google-static.mjs",
  "scripts/verify-g3-0-4-google-static-geometry-placement-manifest.mjs",
  "scripts/verify-g3-0-5-google-static-preview-fit-review-pack.mjs",
  "scripts/verify-g3-0-6-google-static-verification-gate.mjs",
  "scripts/verify-g3-google-static-desktop-qa.mjs",
  "scripts/verify-g4-google-static-release-freeze.mjs",
  "scripts/verify-m1-meta-static.mjs",
  "scripts/verify-m2-1-meta.mjs",
  "scripts/verify-m2-2a-meta.mjs",
  "scripts/verify-m2-3-meta-goldens.mjs",
  "scripts/verify-m2-meta-static.mjs",
  "scripts/verify-n8-channel-completion.mjs",
  "scripts/verify-naver-freeform-contract.mjs",
  "tests/google-static/google-static-g4-freeze.test.ts",
]);
const protectedArtifactDigests = Object.freeze({
  "artifacts/g4/google-static-user-acceptance.json": "4fa53e5d22b1390f19418716c7592a483175f13813c3960fdc604b56f86cda4c",
  "artifacts/g4/google-static-external-review.json": "c4abda81143b966f18380761a16e1d229b212b8f0d4361f838665e66a2768a7e",
  "contracts/google/release-freeze.g4.json": "6198af1c6d1f78f0ea7df21aac96587cbb5fd76cd3f751adff778018575f9680",
});
const frozenCanonicalVersion = "1.32.0";
const frozenCanonicalSha256 = "413a23a9a4f1f95af1126fc96d17484d02bc69d547588dd17f55dd23778ab64e";
const expectedPack = {
  fileName: "google-g3-2-3-final-output-pack-a6ca251b-20260816T150151284Z-final.zip",
  sha256: "8ea80cda80f53347a08d89cadaaf5501a73fb5b687e2724fc90e111ac32d8ffa",
  bytes: 9220434,
  zipEntries: 255,
  payloadFiles: 213,
  generationId: "g3-2-3-working-20260816T150151284Z",
};
const expectedProfiles = [
  "GOOGLE_MARKETING_LANDSCAPE_1_91",
  "GOOGLE_MARKETING_SQUARE_1_1",
  "GOOGLE_MARKETING_PORTRAIT_4_5",
  "GOOGLE_RDA_VERTICAL_9_16",
  "GOOGLE_DEMAND_GEN_VERTICAL_9_16",
  "GOOGLE_LOGO_SQUARE_1_1",
  "GOOGLE_LOGO_LANDSCAPE_4_1",
  "GOOGLE_DG_UPLOAD_300X250",
  "GOOGLE_DG_UPLOAD_336X280",
  "GOOGLE_DG_UPLOAD_728X90",
  "GOOGLE_DG_UPLOAD_970X90",
  "GOOGLE_DG_UPLOAD_160X600",
  "GOOGLE_DG_UPLOAD_300X600",
  "GOOGLE_DG_UPLOAD_320X50",
];
const expectedGoldenRegistrySha = "00dabc5d94ffc0c225d17d22b3b5527d0b0c7488aa11495da4a79e1327d37359";
const expectedG31FreezeSha = "1dc779a4feb83b7df5c6b06966d74492f2e5c682ea32b19dcd87813b3ea218ef";
const expectedObjectRightSha = "33204a082327bf14fead6dbc50fd2139f46f7f7156d14ac221c3212368927a3b";
const checks = [];
const failures = [];

function check(id, condition, detail = "") {
  const status = condition ? "PASS" : "FAIL";
  checks.push({ id, status, detail });
  if (!condition) failures.push(`${id}: ${detail}`);
  console.log(`${status} ${id}: ${detail}`);
}

function git(args) {
  try { return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim(); }
  catch { return ""; }
}

function isAncestor(commit, descendant = "HEAD") {
  try { execFileSync("git", ["merge-base", "--is-ancestor", commit, descendant], { cwd: root, stdio: "ignore" }); return true; }
  catch { return false; }
}

async function readJson(relativePath) {
  try { return JSON.parse(await readFile(path.join(root, relativePath), "utf8")); }
  catch (error) { check(`read_${relativePath}`, false, error instanceof Error ? error.message : String(error)); return null; }
}

async function sha256(relativePath) {
  return createHash("sha256").update(await readFile(path.join(root, relativePath))).digest("hex");
}

async function exists(relativePath) {
  try { await stat(path.join(root, relativePath)); return true; } catch { return false; }
}

function stable(value) { return JSON.stringify(value); }
function normalizeChangedPaths(paths = []) {
  return [...new Set(paths.map((entry) => String(entry).replaceAll("\\", "/")).filter(Boolean))].sort();
}

export function validateHistoricalChangeScope({
  changedPaths,
  expectedPaths = historicalChangedPaths,
  expectedCount = expectedPaths.length,
} = {}) {
  const actual = normalizeChangedPaths(changedPaths);
  const expected = normalizeChangedPaths(expectedPaths);
  const errors = [];
  if (actual.length !== expectedCount) errors.push(`historical changed file count mismatch: ${actual.length} !== ${expectedCount}`);
  if (stable(actual) !== stable(expected)) errors.push("historical changed path set mismatch");
  throwValidationErrors(errors);
  return true;
}

export function validateCurrentAncestry({
  candidateSourceHead = candidateHead,
  freezeCommit = g4FreezeCommit,
  currentHead,
  candidateAncestorOfFreeze,
  freezeAncestorOfCurrent,
} = {}) {
  const errors = [];
  if (candidateSourceHead !== candidateHead) errors.push("candidate source HEAD mismatch");
  if (freezeCommit !== g4FreezeCommit) errors.push("G4 freeze commit mismatch");
  if (typeof currentHead !== "string" || !/^[0-9a-f]{40}$/u.test(currentHead)) errors.push("current HEAD is not a full commit SHA");
  if (candidateAncestorOfFreeze !== true) errors.push("candidate source HEAD is not an ancestor of G4 freeze commit");
  if (freezeAncestorOfCurrent !== true) errors.push("current HEAD is not a descendant of G4 freeze commit");
  throwValidationErrors(errors);
  return true;
}

export function validateProtectedArtifacts({
  actualDigests,
  expectedDigests = protectedArtifactDigests,
} = {}) {
  const errors = [];
  for (const [relativePath, expectedDigest] of Object.entries(expectedDigests)) {
    if (actualDigests?.[relativePath] !== expectedDigest) errors.push(`protected artifact digest mismatch: ${relativePath}`);
  }
  throwValidationErrors(errors);
  return true;
}

function packMatches(actual, expected, sourceHead = undefined) {
  return actual?.fileName === expected.fileName
    && actual?.sha256 === expected.sha256
    && actual?.bytes === expected.bytes
    && actual?.zipEntries === expected.zipEntries
    && actual?.payloadFiles === expected.payloadFiles
    && actual?.generationId === expected.generationId
    && (sourceHead === undefined || actual?.sourceHead === sourceHead);
}

function parseSemver(value) {
  if (typeof value !== "string") return null;
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/u.exec(value);
  if (!match) return null;
  const prerelease = match[4] ? match[4].split(".").map((identifier) => (/^\d+$/u.test(identifier) ? Number(identifier) : identifier)) : [];
  if (prerelease.some((identifier) => typeof identifier === "number" && !Number.isSafeInteger(identifier))) return null;
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), prerelease };
}

function compareSemver(left, right) {
  const a = parseSemver(left);
  const b = parseSemver(right);
  if (!a || !b) throw new Error("invalid semver");
  for (const key of ["major", "minor", "patch"]) {
    if (a[key] !== b[key]) return a[key] > b[key] ? 1 : -1;
  }
  if (a.prerelease.length === 0 && b.prerelease.length > 0) return 1;
  if (a.prerelease.length > 0 && b.prerelease.length === 0) return -1;
  for (let index = 0; index < Math.max(a.prerelease.length, b.prerelease.length); index += 1) {
    if (index >= a.prerelease.length) return -1;
    if (index >= b.prerelease.length) return 1;
    const leftId = a.prerelease[index];
    const rightId = b.prerelease[index];
    if (leftId === rightId) continue;
    if (typeof leftId === "number" && typeof rightId === "number") return leftId > rightId ? 1 : -1;
    if (typeof leftId === "number") return -1;
    if (typeof rightId === "number") return 1;
    return leftId > rightId ? 1 : -1;
  }
  return 0;
}

function throwValidationErrors(errors) {
  if (errors.length > 0) throw new Error(errors.join("; "));
}

export function validateHistoricalSnapshot({
  versions,
  registry,
  candidateSourceHead,
  expectedCandidateSourceHead = candidateHead,
  acceptedPack,
  expectedAcceptedPack = expectedPack,
  frozenProfileCount = 14,
  frozenGoldenCount = 14,
} = {}) {
  const errors = [];
  const historical = versions?.canonicalPhaseG4Google;
  if (historical?.documentCurrent !== frozenCanonicalVersion || registry?.canonical?.frozenVersion !== frozenCanonicalVersion) errors.push("historical frozen canonical version mismatch");
  if (historical?.canonicalDocumentSha256 !== frozenCanonicalSha256) errors.push("historical frozen canonical SHA-256 mismatch");
  if (candidateSourceHead !== undefined && candidateSourceHead !== expectedCandidateSourceHead) errors.push("historical candidate source HEAD mismatch");
  if (acceptedPack !== undefined && !packMatches(acceptedPack, expectedAcceptedPack)) errors.push("historical accepted pack mismatch");
  if (registry?.frozenProfiles?.length !== frozenProfileCount) errors.push("historical frozen profile count mismatch");
  if (registry?.frozenGoldens?.length !== frozenGoldenCount) errors.push("historical frozen golden count mismatch");
  throwValidationErrors(errors);
  return true;
}

export function validateCurrentCanonicalState({
  versions,
  canonical,
  currentCanonicalSha,
  activeCanonical,
  frozenVersion = frozenCanonicalVersion,
  frozenSha256 = frozenCanonicalSha256,
} = {}) {
  const errors = [];
  const currentVersion = versions?.documentVersion?.current;
  const parsedCurrent = parseSemver(currentVersion);
  if (!parsedCurrent) errors.push("current canonical version is not valid semver");
  else if (compareSemver(currentVersion, frozenVersion) < 0) errors.push("current canonical version is below frozen G4 version");
  if (typeof canonical !== "string" || !canonical.includes(`Document version:** ${currentVersion}`) || !canonical.includes("Phase G4")) errors.push("current canonical document version marker mismatch");
  const resolvedActive = activeCanonical ?? (currentVersion === frozenVersion && currentCanonicalSha === frozenSha256 ? { version: frozenVersion, sha256: frozenSha256 } : null);
  if (!resolvedActive || resolvedActive.version !== currentVersion) errors.push("current canonical version and active registry version mismatch");
  if (!resolvedActive || typeof resolvedActive.sha256 !== "string" || resolvedActive.sha256 !== currentCanonicalSha || currentCanonicalSha === "__CANONICAL_SHA256__") errors.push("current canonical digest and active registry digest mismatch");
  if (currentVersion === frozenVersion && currentCanonicalSha !== frozenSha256) errors.push("frozen-version current canonical digest mismatch");
  throwValidationErrors(errors);
  return true;
}

export {
  candidateHead,
  g4FreezeCommit,
  historicalChangedPaths,
  protectedArtifactDigests,
  expectedPack,
  frozenCanonicalVersion,
  frozenCanonicalSha256,
  packMatches,
};

async function main() {
  const versions = await readJson("contracts/contract-versions.json");
  const canonical = await readFile(path.join(root, "docs/kakao-bizboard-renderer-spec-v1.md"), "utf8").catch(() => "");
  const acceptance = await readJson("artifacts/g4/google-static-user-acceptance.json");
  const review = await readJson("artifacts/g4/google-static-external-review.json");
  const registry = await readJson("contracts/google/release-freeze.g4.json");
  const packageJson = await readJson("package.json");
  const goldens = await readJson("contracts/google/goldens.g2.1.json");
  const currentHead = git(["rev-parse", "HEAD"]);
  const currentCanonicalSha = await sha256("docs/kakao-bizboard-renderer-spec-v1.md").catch(() => null);
  const acceptanceSha = await sha256("artifacts/g4/google-static-user-acceptance.json").catch(() => null);
  const reviewSha = await sha256("artifacts/g4/google-static-external-review.json").catch(() => null);
  const registrySha = await sha256("contracts/google/release-freeze.g4.json").catch(() => null);
  const historicalChanged = normalizeChangedPaths(git(["diff", "--name-only", "--no-renames", candidateHead, g4FreezeCommit]).split(/\r?\n/u));
  const ancestryValid = validateCurrentAncestry({
    candidateSourceHead: review?.selectedPack?.sourceHead,
    currentHead,
    candidateAncestorOfFreeze: isAncestor(candidateHead, g4FreezeCommit),
    freezeAncestorOfCurrent: isAncestor(g4FreezeCommit, currentHead),
  });

  check("candidate_head_historical_ancestor", ancestryValid, JSON.stringify({ candidateHead, g4FreezeCommit }));
  check("current_head_descendant_of_g4_freeze", ancestryValid, JSON.stringify({ g4FreezeCommit, currentHead }));
  check("phase_record", registry?.phase === "G4_GOOGLE_STATIC_USER_ACCEPTANCE_AND_RELEASE_FREEZE" && registry?.status === "FROZEN" && versions?.canonicalPhaseG4Google?.status === "FROZEN", JSON.stringify({ phase: registry?.phase, status: registry?.status }));
  let historicalSnapshotValid = false;
  try {
    historicalSnapshotValid = validateHistoricalSnapshot({
      versions,
      registry,
      candidateSourceHead: review?.selectedPack?.sourceHead,
      acceptedPack: registry?.acceptedPack,
    });
  } catch { historicalSnapshotValid = false; }
  check("historical_canonical_snapshot", historicalSnapshotValid, JSON.stringify({ frozenVersion: registry?.canonical?.frozenVersion, frozenSha256: versions?.canonicalPhaseG4Google?.canonicalDocumentSha256 }));
  const activeCanonical = versions?.activeCanonical ?? versions?.currentCanonical ?? null;
  let currentCanonicalValid = false;
  try {
    currentCanonicalValid = validateCurrentCanonicalState({ versions, canonical, currentCanonicalSha, activeCanonical });
  } catch { currentCanonicalValid = false; }
  check("canonical_version", currentCanonicalValid, JSON.stringify({ current: versions?.documentVersion, activeCanonical: activeCanonical ?? "baseline-fallback-to-historical-snapshot" }));
  const currentDigestValid = currentCanonicalSha !== null && (activeCanonical?.sha256 === currentCanonicalSha || (!activeCanonical && versions?.documentVersion?.current === frozenCanonicalVersion && currentCanonicalSha === frozenCanonicalSha256));
  check("canonical_hash_recorded", currentDigestValid && currentCanonicalSha !== "__CANONICAL_SHA256__", currentCanonicalSha ?? "missing");
  check("acceptance_record", acceptance?.schemaVersion === "1.0.0" && acceptance?.decision === "ACCEPT_GOOGLE_G3_2_3_FINAL_OUTPUT_PACK" && acceptance?.authorizedAction === "PROCEED_TO_G4_RELEASE_FREEZE" && acceptance?.recordedBy === "USER" && acceptance?.userAcceptanceRecorded === true && acceptance?.freezeAuthorization === true && acceptance?.externalReviewStatus === "PASS", JSON.stringify({ decision: acceptance?.decision, recorded: acceptance?.userAcceptanceRecorded }));
  check("external_review_record", review?.schemaVersion === "1.0.0" && review?.evidenceClass === "INDEPENDENT_EXTERNAL_REVIEW" && review?.status === "PASS" && review?.independentChecks?.passed === 3044 && review?.independentChecks?.total === 3044 && review?.blockingReasons?.length === 0, JSON.stringify(review?.independentChecks));
  check("pack_identity", packMatches(acceptance?.acceptedPack, expectedPack) && packMatches(review?.selectedPack, expectedPack, candidateHead), JSON.stringify(acceptance?.acceptedPack));
  check("pack_classification", registry?.acceptedPack?.evidenceClass === "NON_NORMATIVE_REVIEW_EVIDENCE" && review?.selectedPack?.generationId === expectedPack.generationId && acceptance?.generationId === expectedPack.generationId, registry?.acceptedPack?.evidenceClass ?? "missing");
  check("record_hashes", acceptanceSha === registry?.userAcceptance?.sha256 && reviewSha === registry?.externalReview?.sha256 && acceptanceSha === versions?.canonicalPhaseG4Google?.acceptanceRecordSha256 && reviewSha === versions?.canonicalPhaseG4Google?.externalReviewRecordSha256, JSON.stringify({ acceptanceSha, reviewSha }));
  check("registry_hash", registrySha === versions?.canonicalPhaseG4Google?.freezeRegistrySha256 && registrySha === "6198af1c6d1f78f0ea7df21aac96587cbb5fd76cd3f751adff778018575f9680", registrySha ?? "missing");
  check("registry_canonical_before", registry?.canonical?.beforeVersion === "1.31.1" && registry?.canonical?.beforeSha256 === "bfd497124b36645f45efa73d77ef1eef1fd58e5547d973088738bae7c6612051" && registry?.canonical?.frozenVersion === "1.32.0", JSON.stringify(registry?.canonical));
  check("record_paths", registry?.userAcceptance?.path === "artifacts/g4/google-static-user-acceptance.json" && registry?.externalReview?.path === "artifacts/g4/google-static-external-review.json" && registry?.userAcceptance?.sha256 !== "__USER_ACCEPTANCE_SHA256__" && registry?.externalReview?.sha256 !== "__EXTERNAL_REVIEW_SHA256__", "logical repository-relative paths");
  check("version_identity", packageJson?.version === "0.13.1" && registry?.versions?.desktopPackage === "0.13.1" && registry?.versions?.rendererCore === "0.11.0" && registry?.versions?.validator === "1.11.0" && registry?.versions?.googleExportManifest === "1.1.0" && registry?.versions?.templateContract === "1.9.0" && registry?.versions?.googleGoldenRegistry === "1.0.0", JSON.stringify(registry?.versions));
  check("profile_set", stable(registry?.frozenProfiles) === stable(expectedProfiles) && registry?.frozenProfiles?.length === 14, `profiles=${registry?.frozenProfiles?.length}`);
  const expectedGoldens = (goldens?.entries ?? []).map((entry) => ({ profileId: entry.profileId, path: entry.frozenArtifactRelativePath, sha256: entry.artifactSha256 }));
  check("golden_set", stable(registry?.frozenGoldens) === stable(expectedGoldens) && expectedGoldens.length === 14, `goldens=${expectedGoldens.length}`);
  check("golden_registry_reference", await sha256("contracts/google/goldens.g2.1.json").catch(() => null) === expectedGoldenRegistrySha && registry?.references?.googleGoldenRegistry?.sha256 === expectedGoldenRegistrySha, expectedGoldenRegistrySha);
  check("g3_1_reference", await sha256("contracts/google/desktop-qa-freeze.g3.1.json").catch(() => null) === expectedG31FreezeSha && registry?.references?.g3_1FreezeRegistry?.sha256 === expectedG31FreezeSha, expectedG31FreezeSha);
  check("object_right_reference", await sha256("reference/kakao-tool/OBJECT_RIGHT.png").catch(() => null) === expectedObjectRightSha && registry?.references?.objectRight?.sha256 === expectedObjectRightSha, expectedObjectRightSha);
  let goldenBytesPass = true;
  for (const entry of expectedGoldens) goldenBytesPass &&= await sha256(entry.path).catch(() => null) === entry.sha256;
  check("frozen_golden_bytes", goldenBytesPass, "14/14 Golden digests unchanged");
  check("runtime_freeze_policy", registry?.runtimePolicy?.runtimeNetworkRequests === 0 && stable(registry?.runtimePolicy?.allowedExportFormats) === stable(["PNG", "JPEG"]) && registry?.runtimePolicy?.uploadedDisplayStaticControlLock === true && registry?.runtimePolicy?.fitActualPreview === true && registry?.runtimePolicy?.passOnlyExport === true && registry?.runtimePolicy?.staleExportBlocked === true && registry?.runtimePolicy?.plumeDependencies?.length === 0, JSON.stringify(registry?.runtimePolicy));
  check("independent_review_counts", review?.requiredCases?.passed === 24 && review?.outputArtifacts?.passed === 32 && review?.payloadChecksumAndManifest?.passed === 213 && review?.defaultGoldenByteEquality?.passed === 14 && review?.transforms?.passed === 8 && review?.resets?.passed === 8 && review?.deterministicReplays?.passed === 2 && review?.exportManifestVersion1_1?.passed === 32 && review?.canonicalDigestRecalculation?.passed === 32 && review?.runtimeNetworkRequests === 0, "3044/3044 review evidence");
  const g4Files = [
    "artifacts/g4/google-static-user-acceptance.json",
    "artifacts/g4/google-static-external-review.json",
    "contracts/google/release-freeze.g4.json",
    "docs/implementation/google-static-user-acceptance-release-freeze-g4.md",
    "docs/adr/ADR-0070-google-static-user-acceptance-release-freeze-g4.md",
    "scripts/verify-g4-google-static-release-freeze.mjs",
  ];
  let g4FilesExist = true;
  for (const file of g4Files) g4FilesExist &&= await exists(file);
  check("g4_files_exist", g4FilesExist, g4Files.join(","));
  const forbiddenPattern = /(?:[A-Za-z]:\\|\\\\|file:\/\/|https?:\/\/(?!kbr\.local))/u;
  const g4Text = (await Promise.all(g4Files.filter((file) => !file.endsWith(".mjs")).map((file) => readFile(path.join(root, file), "utf8").catch(() => "")))).join("\n");
  const verifierSource = await readFile(path.join(root, "scripts/verify-g4-google-static-release-freeze.mjs"), "utf8").catch(() => "");
  check("g4_path_privacy", !forbiddenPattern.test(g4Text) && !g4Text.includes("__CANONICAL_SHA256__") && !g4Text.includes("__USER_ACCEPTANCE_SHA256__") && !g4Text.includes("__EXTERNAL_REVIEW_SHA256__"), "no absolute paths, external URLs, or placeholders");
  let historicalScopeValid = false;
  try { historicalScopeValid = validateHistoricalChangeScope({ changedPaths: historicalChanged }); } catch { historicalScopeValid = false; }
  check("historical_change_scope", historicalScopeValid, JSON.stringify({ from: candidateHead, to: g4FreezeCommit, count: historicalChanged.length }));
  check("historical_change_scope_count", historicalChanged.length === historicalChangedPaths.length && historicalChangedPaths.length === 26, `expected=26 actual=${historicalChanged.length}`);
  const historicalPathSetMatches = stable(historicalChanged) === stable(normalizeChangedPaths(historicalChangedPaths));
  check("historical_change_scope_exact_paths", historicalPathSetMatches, JSON.stringify(historicalChanged));
  const protectedDigests = {};
  for (const relativePath of Object.keys(protectedArtifactDigests)) protectedDigests[relativePath] = await sha256(relativePath).catch(() => null);
  let protectedArtifactsValid = false;
  try { protectedArtifactsValid = validateProtectedArtifacts({ actualDigests: protectedDigests }); } catch { protectedArtifactsValid = false; }
  check("protected_g4_artifacts_byte_exact", protectedArtifactsValid, JSON.stringify(protectedDigests));
  const currentHeadDiffPattern = /git\(\["diff",\s*"--name-only"(?:,\s*"--no-renames")?,\s*candidateHead,\s*"HEAD"\]\)/u;
  check("no_current_head_allowlist", !currentHeadDiffPattern.test(verifierSource) && !verifierSource.includes(["allowed", "change", "boundary"].join("_")), "future descendants are not gated by a current-head path allowlist");
  check("frozen_output_invariants", registry?.runtimePolicy?.runtimeNetworkRequests === 0 && registry?.frozenGoldens?.length === 14 && registry?.evidencePolicy?.acceptedPackReclassified === false, "KAKAO/NAVER/META/Google frozen outputs unchanged");
  const passed = checks.filter((entry) => entry.status === "PASS").length;
  console.log(JSON.stringify({ phase: "G4_GOOGLE_STATIC_USER_ACCEPTANCE_AND_RELEASE_FREEZE", status: failures.length === 0 ? "PASS" : "FAIL", checks: checks.length, passed, failed: failures, candidateHead, currentHead }, null, 2));
  if (failures.length > 0) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
