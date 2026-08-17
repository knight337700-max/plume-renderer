import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const candidateHead = "a6ca251b400033c413a079248eeeea1756a6bc0a";
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

function isAncestor(commit) {
  try { execFileSync("git", ["merge-base", "--is-ancestor", commit, "HEAD"], { cwd: root, stdio: "ignore" }); return true; }
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
function packMatches(actual, expected, sourceHead = undefined) {
  return actual?.fileName === expected.fileName
    && actual?.sha256 === expected.sha256
    && actual?.bytes === expected.bytes
    && actual?.zipEntries === expected.zipEntries
    && actual?.payloadFiles === expected.payloadFiles
    && actual?.generationId === expected.generationId
    && (sourceHead === undefined || actual?.sourceHead === sourceHead);
}

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

  check("candidate_head_ancestor", currentHead === candidateHead || isAncestor(candidateHead), candidateHead);
  check("phase_record", registry?.phase === "G4_GOOGLE_STATIC_USER_ACCEPTANCE_AND_RELEASE_FREEZE" && registry?.status === "FROZEN" && versions?.canonicalPhaseG4Google?.status === "FROZEN", JSON.stringify({ phase: registry?.phase, status: registry?.status }));
  check("canonical_version", versions?.documentVersion?.previous === "1.31.1" && versions?.documentVersion?.current === "1.32.0" && versions?.documentVersion?.bump === "minor" && /Document version:\*\* 1\.32\.0/u.test(canonical) && canonical.includes("Phase G4"), JSON.stringify(versions?.documentVersion));
  check("canonical_hash_recorded", currentCanonicalSha === versions?.canonicalPhaseG4Google?.canonicalDocumentSha256 && currentCanonicalSha !== "__CANONICAL_SHA256__", currentCanonicalSha ?? "missing");
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
  check("g4_path_privacy", !forbiddenPattern.test(g4Text) && !g4Text.includes("__CANONICAL_SHA256__") && !g4Text.includes("__USER_ACCEPTANCE_SHA256__") && !g4Text.includes("__EXTERNAL_REVIEW_SHA256__"), "no absolute paths, external URLs, or placeholders");
  const changed = git(["diff", "--name-only", candidateHead, "HEAD"]).split(/\r?\n/u).filter(Boolean).map((entry) => entry.replaceAll("\\", "/"));
  const allowed = new Set([
    "docs/kakao-bizboard-renderer-spec-v1.md", "contracts/contract-versions.json", "contracts/google/release-freeze.g4.json",
    "artifacts/g4/google-static-user-acceptance.json", "artifacts/g4/google-static-external-review.json",
    "docs/implementation/google-static-user-acceptance-release-freeze-g4.md", "docs/adr/ADR-0070-google-static-user-acceptance-release-freeze-g4.md",
    "scripts/verify-g4-google-static-release-freeze.mjs", "scripts/verify-contract.mjs", "scripts/verify-freeform-contract.mjs", "scripts/verify-naver-freeform-contract.mjs", "scripts/verify-g3-google-static-desktop-qa.mjs",
    "scripts/verify-g3-0-4-google-static-geometry-placement-manifest.mjs", "scripts/verify-g3-0-5-google-static-preview-fit-review-pack.mjs",
    "scripts/verify-g3-0-6-google-static-verification-gate.mjs", "scripts/verify-g0-1-google-architecture-freeze.mjs", "scripts/verify-g1-google-static.mjs", "scripts/verify-g2-1-google-static.mjs", "scripts/verify-n8-channel-completion.mjs", "scripts/verify-m1-meta-static.mjs", "scripts/verify-m2-meta-static.mjs", "scripts/verify-m2-1-meta.mjs", "scripts/verify-m2-2a-meta.mjs", "scripts/verify-m2-3-meta-goldens.mjs", "tests/google-static/google-static-g4-freeze.test.ts", "package.json",
  ]);
  const disallowed = changed.filter((entry) => !allowed.has(entry));
  const runtimeChanged = changed.filter((entry) => /^(?:apps|src|packages|fixtures|reference)\//u.test(entry));
  check("allowed_change_boundary", disallowed.length === 0 && runtimeChanged.length === 0, JSON.stringify({ disallowed, runtimeChanged }));
  check("frozen_output_invariants", registry?.runtimePolicy?.runtimeNetworkRequests === 0 && registry?.frozenGoldens?.length === 14 && registry?.evidencePolicy?.acceptedPackReclassified === false, "KAKAO/NAVER/META/Google frozen outputs unchanged");
  const passed = checks.filter((entry) => entry.status === "PASS").length;
  console.log(JSON.stringify({ phase: "G4_GOOGLE_STATIC_USER_ACCEPTANCE_AND_RELEASE_FREEZE", status: failures.length === 0 ? "PASS" : "FAIL", checks: checks.length, passed, failed: failures, candidateHead, currentHead }, null, 2));
  if (failures.length > 0) process.exitCode = 1;
}

await main();
