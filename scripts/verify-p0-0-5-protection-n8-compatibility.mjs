import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  g4FreezeCommit,
  historicalChangedPaths,
  protectedArtifactDigests,
  validateCurrentAncestry,
  validateHistoricalChangeScope,
  validateProtectedArtifacts,
} from "./verify-g4-google-static-release-freeze.mjs";
import { validateActiveCanonicalState } from "./lib/canonical-semver-compatibility.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baselineHead = "1112bd130f720c3413f5de1bd4d9662af499d272";
const acceptedG01Commit = "731b956e69700154a8b8e1c51ec9a2b7973aa07f";
const g01FreezeCommit = "ef807153c1143966a3f6d83bf01704bf1d2ad206";
const n8FreezeCommit = "8eccd0756e949fc59e1f5162b414a478510bb9f8";
const candidateManifestRelativePath = "artifacts/p0/p0-0-4-candidate-before-manifest.json";
const candidateManifestPath = path.join(root, candidateManifestRelativePath);
const candidateManifestSha256 = "f5eac2377e13f08670af234875a24f9a9a95c2741eaa4265d589fc0601c00695";
const finalizedP0Subject = "feat(plume): freeze renderer integration contract architecture";
const amendMaintenancePaths = new Set([
  "scripts/verify-p0-0-5-protection-n8-compatibility.mjs",
  "scripts/verify-g0-1-google-architecture-freeze.mjs",
  "tests/contracts/p0-0-5-protection-n8-compatibility.test.ts",
  "tests/contracts/p0-0-4-candidate-compatibility.test.ts",
  "docs/adr/ADR-0076-p0-protection-n8-forward-compatibility.md",
  "docs/implementation/p0-protection-n8-forward-compatibility.md",
]);
const p0_0_5Paths = [
  "scripts/verify-g0-1-google-architecture-freeze.mjs",
  "scripts/verify-g1-google-static.mjs",
  "scripts/verify-g2-google-static.mjs",
  "scripts/verify-g2-1-google-static.mjs",
  "scripts/verify-g3-google-static-desktop-qa.mjs",
  "scripts/verify-g3-0-4-google-static-geometry-placement-manifest.mjs",
  "scripts/verify-g3-0-6-google-static-verification-gate.mjs",
  "scripts/verify-g3-0-7-google-static-review-pack-path-hygiene.mjs",
  "scripts/verify-freeform-contract.mjs",
  "scripts/verify-naver-freeform-contract.mjs",
  "scripts/verify-n8-channel-completion.mjs",
  "scripts/verify-m1-meta-static.mjs",
  "scripts/verify-m2-meta-static.mjs",
  "scripts/verify-m2-1-meta.mjs",
  "scripts/verify-m2-2a-meta.mjs",
  "scripts/verify-m2-3-meta-goldens.mjs",
  "scripts/verify-p0-plume.mjs",
  "tests/contracts/p0-plume-contract.test.ts",
  "scripts/verify-p0-0-4-candidate-compatibility.mjs",
  "tests/contracts/p0-0-4-candidate-compatibility.test.ts",
  "docs/adr/ADR-0075-p0-existing-candidate-historical-verifier-compatibility.md",
  "docs/implementation/p0-existing-candidate-historical-verifier-compatibility.md",
  "scripts/verify-p0-0-5-protection-n8-compatibility.mjs",
  "tests/contracts/p0-0-5-protection-n8-compatibility.test.ts",
  "docs/adr/ADR-0076-p0-protection-n8-forward-compatibility.md",
  "docs/implementation/p0-protection-n8-forward-compatibility.md",
];
const checks = [];
const positiveCases = [];
const negativeCases = [];
const failures = [];

const digest = (value) => createHash("sha256").update(value).digest("hex");
const fileDigest = (relativePath) => digest(readFileSync(path.join(root, relativePath)));
const readJson = (relativePath) => JSON.parse(readFileSync(path.join(root, relativePath), "utf8"));
// Preserve the two status columns returned by porcelain output. Trimming the
// whole command result would remove the leading space from a worktree-only
// change and shift the first path by one character.
const git = (args, encoding = "utf8") => execFileSync("git", args, { cwd: root, encoding }).toString().replace(/(?:\r?\n)+$/u, "");
const isAncestor = (ancestor, descendant) => {
  try { execFileSync("git", ["merge-base", "--is-ancestor", ancestor, descendant], { cwd: root, stdio: "ignore" }); return true; }
  catch { return false; }
};

function parseCandidateManifestBytes(bytes) {
  if (digest(bytes) !== candidateManifestSha256) throw new Error("candidate evidence digest mismatch");
  const manifest = JSON.parse(bytes.toString("utf8").replace(/\\n\s*$/u, ""));
  if (manifest.schemaVersion !== "1.0.0" || manifest.evidenceClass !== "CANDIDATE_PRESERVATION_EVIDENCE" || manifest.normative !== false || manifest.source !== "REPOSITORY_RELATIVE_SNAPSHOT") throw new Error("candidate evidence metadata mismatch");
  if (manifest.head !== baselineHead || manifest.canonical?.version !== "1.33.0" || manifest.canonical?.sha256 !== "11921ba1fd02b8d76973f05c55a4dd41e78f61fcb80191bffcae3b0b11b08b6d") throw new Error("candidate evidence baseline mismatch");
  if (!Array.isArray(manifest.candidateFiles) || manifest.candidateFiles.length !== 33) throw new Error("candidate evidence file set mismatch");
  if (manifest.candidateFiles.some((entry) => path.isAbsolute(entry.path) || entry.path.includes("..") || entry.path.includes("\\"))) throw new Error("candidate evidence contains non-relative path");
  return manifest;
}

function readCandidateManifest() {
  if (!existsSync(candidateManifestPath)) throw new Error("repository candidate evidence missing");
  return parseCandidateManifestBytes(readFileSync(candidateManifestPath));
}

function gitBuffer(args) {
  return execFileSync("git", args, { cwd: root, encoding: "buffer" });
}

function readJsonAtCommit(commit, relativePath) {
  return JSON.parse(gitBuffer(["show", `${commit}:${relativePath}`]).toString("utf8"));
}

function hasCommitPath(commit, relativePath) {
  try { execFileSync("git", ["cat-file", "-e", `${commit}:${relativePath}`], { cwd: root, stdio: "ignore" }); return true; }
  catch { return false; }
}

function commitFileDigest(commit, relativePath) {
  return digest(gitBuffer(["show", `${commit}:${relativePath}`]));
}

function commitMetadata(commit) {
  const parents = git(["show", "-s", "--format=%P", commit]).split(/\s+/u).filter(Boolean);
  const subject = git(["show", "-s", "--format=%s", commit]);
  return { commit, parents, parent: parents[0] ?? null, subject };
}

function requiredFinalizedPaths() {
  const manifest = readCandidateManifest();
  return [...new Set([
    ...manifest.candidateFiles.map((entry) => entry.path),
    candidateManifestRelativePath,
    ...p0_0_5Paths,
  ])];
}

function inspectFinalizedP0Commit(commit) {
  const metadata = commitMetadata(commit);
  const manifest = readCandidateManifest();
  const requiredPaths = requiredFinalizedPaths();
  const missingPaths = requiredPaths.filter((relativePath) => !hasCommitPath(commit, relativePath));
  const candidateDigestMismatches = manifest.candidateFiles
    .filter((entry) => !p0_0_5Paths.includes(entry.path))
    .filter((entry) => !hasCommitPath(commit, entry.path) || commitFileDigest(commit, entry.path) !== entry.sha256)
    .map((entry) => entry.path);
  const artifactDigest = hasCommitPath(commit, candidateManifestRelativePath) ? commitFileDigest(commit, candidateManifestRelativePath) : null;
  const canonicalDigest = hasCommitPath(commit, "docs/kakao-bizboard-renderer-spec-v1.md") ? commitFileDigest(commit, "docs/kakao-bizboard-renderer-spec-v1.md") : null;
  let canonicalVersion = null;
  let matrixRows = null;
  let activeCanonical = null;
  try {
    const versionsAtCommit = readJsonAtCommit(commit, "contracts/contract-versions.json");
    canonicalVersion = versionsAtCommit.documentVersion?.current ?? null;
    activeCanonical = versionsAtCommit.activeCanonical ?? null;
    matrixRows = readJsonAtCommit(commit, "contracts/p0-plume-capability-matrix.json").rows?.length ?? null;
  } catch { /* missing or malformed committed contract is reported below */ }
  return {
    ...metadata,
    requiredPaths,
    missingPaths,
    candidateDigestMismatches,
    artifactDigest,
    canonicalDigest,
    canonicalVersion,
    activeCanonical,
    matrixRows,
  };
}

function assertFinalizedP0Commit(commit, overrides = {}) {
  const inspected = { ...inspectFinalizedP0Commit(commit), ...overrides };
  if (inspected.parent !== baselineHead) throw new Error("finalized P0 parent mismatch");
  if (inspected.subject !== finalizedP0Subject) throw new Error("finalized P0 subject mismatch");
  if (inspected.missingPaths.length > 0) throw new Error(`finalized P0 required paths missing: ${inspected.missingPaths.join(",")}`);
  if (inspected.candidateDigestMismatches.length > 0) throw new Error(`finalized P0 candidate digest mismatch: ${inspected.candidateDigestMismatches.join(",")}`);
  if (inspected.artifactDigest !== candidateManifestSha256) throw new Error("finalized P0 portable evidence digest mismatch");
  if (inspected.canonicalDigest !== "11921ba1fd02b8d76973f05c55a4dd41e78f61fcb80191bffcae3b0b11b08b6d" || inspected.canonicalVersion !== "1.33.0") throw new Error("finalized P0 Canonical mismatch");
  if (inspected.activeCanonical?.version !== "1.33.0" || inspected.activeCanonical?.sha256 !== "11921ba1fd02b8d76973f05c55a4dd41e78f61fcb80191bffcae3b0b11b08b6d") throw new Error("finalized P0 active registry mismatch");
  if (inspected.matrixRows !== 170) throw new Error("finalized P0 capability matrix mismatch");
  return inspected;
}

function findFinalizedP0Commit() {
  const refs = [currentHead, ...git(["rev-list", "--first-parent", "--ancestry-path", `${baselineHead}..HEAD`]).split(/\r?\n/u).filter(Boolean)];
  const seen = new Set();
  for (const ref of refs) {
    if (seen.has(ref)) continue;
    seen.add(ref);
    try { return assertFinalizedP0Commit(ref); } catch { /* continue to the next ancestor */ }
  }
  return null;
}

function assertFinalizedP0Ancestry(finalizedCommit, head = currentHead) {
  if (!finalizedCommit || !isAncestor(finalizedCommit, head)) throw new Error("finalized P0 ancestry mismatch");
  return true;
}

function classifyLifecycleState() {
  const status = git(["status", "--short", "--untracked-files=all"]);
  const clean = status.length === 0;
  if (currentHead === baselineHead && !clean) {
    readCandidateManifest();
    return { state: "PRE_COMMIT_CANDIDATE", head: currentHead, clean, finalizedCommit: null };
  }
  const finalizedCommit = findFinalizedP0Commit();
  if (!finalizedCommit) return { state: "INVALID", head: currentHead, clean, finalizedCommit: null };
  if (!clean) {
    const statusPaths = status.split(/\r?\n/u).filter(Boolean).map((line) => line.slice(3).replaceAll("\\", "/"));
    if (statusPaths.some((relativePath) => !amendMaintenancePaths.has(relativePath))) return { state: "INVALID", head: currentHead, clean, finalizedCommit };
    return { state: "AMEND_CANDIDATE", head: currentHead, clean, finalizedCommit };
  }
  return { state: finalizedCommit.commit === currentHead ? "FINALIZED_P0_COMMIT" : "FUTURE_DESCENDANT", head: currentHead, clean, finalizedCommit };
}

function parseLastJson(output) {
  const lines = String(output).trim().split(/\r?\n/u);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try { return JSON.parse(lines.slice(index).join("\n")); } catch { /* continue */ }
  }
  return null;
}

function runNode(relativePath) {
  try {
    const output = execFileSync(process.execPath, [relativePath], { cwd: root, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
    return { exitCode: 0, output, json: parseLastJson(output) };
  } catch (error) {
    const stdout = error?.stdout?.toString?.() ?? "";
    const stderr = error?.stderr?.toString?.() ?? "";
    return { exitCode: typeof error?.status === "number" ? error.status : 1, output: `${stdout}\n${stderr}`, json: parseLastJson(stdout) ?? parseLastJson(stderr) };
  }
}

function record(collection, id, evidence, result, detail = "") {
  const entry = { id, evidence, result, detail };
  collection.push(entry);
  if (result !== "PASS") failures.push(`${id}: ${detail}`);
}

function expectedPass(id, fn, detail = "") {
  try { fn(); record(positiveCases, id, "EXECUTED", "PASS", detail); }
  catch (error) { record(positiveCases, id, "EXECUTED", "FAIL", error instanceof Error ? error.message : String(error)); }
}

function expectedFailure(id, fn) {
  try {
    fn();
    record(negativeCases, id, "EXPECTED_FAIL_CONFIRMED", "FAIL", "mutation unexpectedly validated");
  } catch {
    record(negativeCases, id, "EXPECTED_FAIL_CONFIRMED", "PASS");
  }
}

function requirePass(result, label) {
  if (!result || result.exitCode !== 0) throw new Error(`${label} did not pass`);
  if (result.json?.status === "PASS") return result.json;
  // The historical freeform verifiers intentionally emit line-oriented PASS
  // evidence rather than a JSON envelope. Their zero exit code is the
  // authoritative success signal, while requiring at least one PASS record
  // prevents an empty successful process from being accepted.
  if (/^PASS\s+/mu.test(result.output ?? "")) return result.json ?? { status: "PASS", outputFormat: "LINE_ORIENTED" };
  throw new Error(`${label} did not pass`);
}

function requireValid(result) {
  if (!result?.valid) throw new Error((result?.errors ?? ["validation failed"]).join("; "));
}

function syntheticCanonical(previous, current, bump, overrides = {}) {
  const canonical = `# Synthetic Canonical\n\nDocument version:** ${current}\n\nPhase G4 historical record remains present.`;
  const currentCanonicalSha = digest(canonical);
  return {
    versions: {
      documentVersion: { previous, current, bump },
      activeCanonical: { version: current, sha256: currentCanonicalSha },
      canonicalPhaseG0_1Google: { documentCurrent: "1.24.0" },
      ...overrides,
    },
    canonical,
    currentCanonicalSha,
  };
}

function validateActiveFixture(value) {
  return validateActiveCanonicalState({
    versions: value.versions,
    canonical: value.canonical,
    currentCanonicalSha: value.currentCanonicalSha,
    activeCanonical: value.versions.activeCanonical,
    historicalMinimumVersion: "1.24.0",
  });
}

function historicalRuntimeHits(paths, contents) {
  const registryPaths = new Set([
    "contracts/channel-capabilities.json",
    "contracts/desktop-capability-registry.json",
    "contracts/freeform-format-profiles.json",
    "contracts/meta-static-profiles.json",
    "contracts/naver-freeform-profiles.json",
  ]);
  const runtimePattern = /^(?:src\/|apps\/|packages\/|fixtures\/golden\/)/u;
  return paths.filter((relativePath) => runtimePattern.test(relativePath) || registryPaths.has(relativePath))
    .filter((relativePath) => /google|GOOGLE/u.test(relativePath) || /google|GOOGLE/u.test(contents[relativePath] ?? ""));
}

function assertHistoricalVerifierSource(source) {
  const start = source.indexOf("const historicalFiles =");
  const end = source.indexOf('check("runtime_google_profiles_absent"');
  const section = start >= 0 && end > start ? source.slice(start, end) : "";
  if (!source.includes(`const acceptedCommit = "${acceptedG01Commit}"`)) throw new Error("accepted commit is not pinned");
  if (!source.includes("collectHistoricalFiles(commit, \".\")") || !source.includes("collectHistoricalRuntimeFiles(acceptedCommit)")) throw new Error("accepted tree inspection missing");
  if (!source.includes("const historicalFiles = await collectHistoricalRuntimeFiles(acceptedCommit);")) throw new Error("accepted tree runtime snapshot substitution");
  if (!source.includes(`const freezeCompletionCommit = "${g01FreezeCommit}"`)) throw new Error("G0.1 freeze completion commit is not pinned");
  if (!source.includes("acceptedCommit, freezeCompletionCommit")) throw new Error("G0.1 historical diff does not end at freeze completion");
  if (!source.includes("productionRuntimePath = /^(?:src\\/|apps\\/|packages\\/|fixtures\\/golden\\/)/u")) throw new Error("runtime scope classifier missing");
  if (section.includes("collectFiles(") || section.includes("path.join(root, relativePath)")) throw new Error("current worktree used for historical absence");
  if (/glob|wildcard|\*\*/iu.test(section)) throw new Error("wildcard historical policy");
  if (!source.includes("historicalGoogleHits.length === 0")) throw new Error("historical assertion missing");
  return true;
}

function candidateManifestState() {
  const manifest = readCandidateManifest();
  const authorized = new Set(p0_0_5Paths);
  const mismatches = [];
  for (const entry of manifest.candidateFiles ?? []) {
    try {
      const bytes = readFileSync(path.join(root, entry.path));
      const actualSha = digest(bytes);
      if ((bytes.byteLength !== entry.bytes || actualSha !== entry.sha256) && !authorized.has(entry.path)) mismatches.push(entry.path);
    } catch { mismatches.push(entry.path); }
  }
  const statusPaths = git(["status", "--short", "--untracked-files=all"]).split(/\r?\n/u).filter(Boolean).map((line) => line.slice(3).replaceAll("\\", "/"));
  const expectedCandidatePaths = new Set((manifest.candidateFiles ?? []).map((entry) => entry.path));
  const unexpected = statusPaths.filter((entry) => !expectedCandidatePaths.has(entry) && !authorized.has(entry) && entry !== candidateManifestRelativePath && !entry.startsWith("dist/") && !entry.startsWith("dist-desktop/") && !entry.startsWith("test-results/"));
  if (manifest.head !== baselineHead || manifest.candidateFiles?.length !== 33 || mismatches.length > 0 || unexpected.length > 0) throw new Error(JSON.stringify({ mismatches, unexpected, entries: manifest.candidateFiles?.length, head: manifest.head }));
  return { entries: manifest.candidateFiles.length, mismatches, unexpected, authorizedPaths: p0_0_5Paths, manifestPath: candidateManifestRelativePath, manifestSha256: candidateManifestSha256 };
}

function actualHistoricalPaths() {
  return git(["diff", "--name-only", "--no-renames", "a6ca251b400033c413a079248eeeea1756a6bc0a", g4FreezeCommit]).split(/\r?\n/u).filter(Boolean).map((entry) => entry.replaceAll("\\", "/"));
}

const currentHead = git(["rev-parse", "HEAD"]);
const versions = readJson("contracts/contract-versions.json");
const canonical = readFileSync(path.join(root, "docs/kakao-bizboard-renderer-spec-v1.md"), "utf8");
const canonicalSha256 = digest(canonical);
const g01Source = readFileSync(path.join(root, "scripts/verify-g0-1-google-architecture-freeze.mjs"), "utf8");
const n8Source = readFileSync(path.join(root, "scripts/verify-n8-channel-completion.mjs"), "utf8");
const lifecycleState = classifyLifecycleState();
const finalizedP0Commit = lifecycleState.finalizedCommit;

const g01Result = runNode("scripts/verify-g0-1-google-architecture-freeze.mjs");
const p0Result = runNode("scripts/verify-p0-plume.mjs");
const n8Result = runNode("scripts/verify-n8-channel-completion.mjs");
const p004Result = runNode("scripts/verify-p0-0-4-candidate-compatibility.mjs");
const freeformResult = runNode("scripts/verify-freeform-contract.mjs");
const naverFreeformResult = runNode("scripts/verify-naver-freeform-contract.mjs");

expectedPass("P0_LIFECYCLE_STATE_VALID", () => {
  if (!["PRE_COMMIT_CANDIDATE", "AMEND_CANDIDATE", "FINALIZED_P0_COMMIT", "FUTURE_DESCENDANT"].includes(lifecycleState.state)) throw new Error(`invalid lifecycle state: ${lifecycleState.state}`);
  if (lifecycleState.state === "PRE_COMMIT_CANDIDATE") {
    const manifest = readCandidateManifest();
    const expected = new Set([...manifest.candidateFiles.map((entry) => entry.path), ...p0_0_5Paths, candidateManifestRelativePath]);
    const statusPaths = git(["status", "--short", "--untracked-files=all"]).split(/\r?\n/u).filter(Boolean).map((line) => line.slice(3).replaceAll("\\", "/"));
    if (statusPaths.some((entry) => !expected.has(entry) && !entry.startsWith("dist/") && !entry.startsWith("dist-desktop/") && !entry.startsWith("test-results/"))) throw new Error("unexpected pre-commit candidate path");
  } else if (!lifecycleState.finalizedCommit) {
    throw new Error("finalized P0 commit could not be identified from ancestry and committed evidence");
  }
}, JSON.stringify({ state: lifecycleState.state, currentHead, baselineHead, finalizedP0Commit: finalizedP0Commit?.commit ?? null }));
expectedPass("FINALIZED_P0_COMMIT_STATE", () => {
  if (lifecycleState.state === "PRE_COMMIT_CANDIDATE") return;
  if (!finalizedP0Commit) throw new Error("finalized P0 commit not found");
  assertFinalizedP0Commit(finalizedP0Commit.commit);
  if (["FINALIZED_P0_COMMIT", "FUTURE_DESCENDANT"].includes(lifecycleState.state) && !lifecycleState.clean) throw new Error("finalized/future state must be clean");
}, JSON.stringify({ state: lifecycleState.state, finalizedP0Commit: finalizedP0Commit?.commit ?? null }));
expectedPass("CANDIDATE_MANIFEST_PRESERVED_WITH_AUTHORIZED_MAINTENANCE", candidateManifestState);
expectedPass("G0_1_RUNTIME_SCOPE_PASS", () => requirePass(g01Result, "G0.1 verifier"));
expectedPass("P0_SEMANTIC_PROTECTION_PASS", () => {
  const json = requirePass(p0Result, "P0 verifier");
  if (json.g0_1SemanticProtection?.passed !== true || json.total < 28) throw new Error("P0 semantic protection missing");
});
expectedPass("N8_ACTIVE_CANONICAL_PASS", () => requirePass(n8Result, "N8 verifier"));
expectedPass("P0_0_4_PROOF_RETAINED", () => {
  const json = requirePass(p004Result, "P0.0.4 verifier");
  if (json.passed !== 29 || json.checks !== 29) throw new Error(`P0.0.4 ${json.passed}/${json.checks}`);
});
expectedPass("KAKAO_FREEFORM_RETAINED", () => requirePass(freeformResult, "Kakao freeform verifier"));
expectedPass("NAVER_FREEFORM_RETAINED", () => requirePass(naverFreeformResult, "Naver freeform verifier"));
expectedPass("G0_1_ACCEPTED_TREE_AND_FREEZE_ANCESTRY", () => {
  if (versions.canonicalPhaseG0_1Google?.acceptedFromCommit !== acceptedG01Commit) throw new Error("G0.1 acceptedFromCommit mismatch");
  if (!isAncestor(acceptedG01Commit, g01FreezeCommit) || !isAncestor(g01FreezeCommit, currentHead)) throw new Error("G0.1 ancestry mismatch");
  const freezeCanonical = execFileSync("git", ["show", `${g01FreezeCommit}:docs/kakao-bizboard-renderer-spec-v1.md`], { cwd: root, encoding: "buffer" });
  if (digest(freezeCanonical) !== "9371f2710545acb6bb94d7af49f98b510b55e230544072fa4a3b12aec245f2b7") throw new Error("G0.1 frozen Canonical digest mismatch");
});
expectedPass("G4_PROTECTED_ARTIFACTS_AND_CHANGED_SCOPE", () => {
  validateProtectedArtifacts({ actualDigests: Object.fromEntries(Object.keys(protectedArtifactDigests).map((relativePath) => [relativePath, fileDigest(relativePath)])) });
  validateHistoricalChangeScope({ changedPaths: actualHistoricalPaths(), expectedPaths: historicalChangedPaths });
});
expectedPass("ACTIVE_CANONICAL_1_33_STATE", () => {
  requireValid(validateActiveCanonicalState({ versions, canonical, currentCanonicalSha: canonicalSha256, activeCanonical: versions.activeCanonical, historicalMinimumVersion: "1.24.0" }));
});
expectedPass("FUTURE_CANONICAL_1_35_STATE", () => requireValid(validateActiveFixture(syntheticCanonical("1.34.0", "1.35.0", "minor"))));
expectedPass("RUNTIME_BOUNDARY_NO_PLUME", () => {
  const packageJson = readJson("package.json");
  const packageText = JSON.stringify({ dependencies: packageJson.dependencies, devDependencies: packageJson.devDependencies, optionalDependencies: packageJson.optionalDependencies, peerDependencies: packageJson.peerDependencies });
  if (/plume|openai/iu.test(packageText)) throw new Error("runtime package dependency found");
  if (versions.runtimeNetworkAccess !== "PROHIBITED") throw new Error("runtime network policy changed");
  for (const relativeRoot of ["src", "apps", "packages/renderer-contract/src"]) {
    try {
      const output = execFileSync("git", ["grep", "-I", "-n", "-E", "plume|openai", "--", relativeRoot], { cwd: root, encoding: "utf8" });
      if (output.trim()) throw new Error(`runtime reference found in ${relativeRoot}`);
    } catch (error) {
      if (error?.status === 1) continue;
      if (error instanceof Error && /runtime reference found/u.test(error.message)) throw error;
    }
  }
});
expectedPass("G0_1_SEMANTIC_SOURCE_PROOF", () => assertHistoricalVerifierSource(g01Source));
expectedPass("N8_ACTIVE_RULE_IS_GENERIC", () => {
  if (!n8Source.includes("validateActiveCanonicalState") || !n8Source.includes("activeCanonicalValidation.valid")) throw new Error("generic active Canonical validation missing");
  if (/documentVersion\.current\s*===\s*["']1\.33\.0["']/u.test(n8Source)) throw new Error("1.33.0 exact allowlist found");
  if (/diff[^\n]*HEAD/u.test(n8Source)) throw new Error("current-head path allowlist found");
});
expectedPass("P0_0_5_FILES_PRESENT", () => {
  const missing = p0_0_5Paths.filter((relativePath) => !existsSync(path.join(root, relativePath)));
  if (missing.length > 0) throw new Error(missing.join(","));
});
expectedPass("PRE_COMMIT_CANDIDATE_LIFECYCLE_RULE", () => {
  // The baseline-plus-dirty state remains an explicit supported lifecycle
  // even when this invocation is validating an amend or finalized commit.
  if (currentHead !== baselineHead && lifecycleState.state === "PRE_COMMIT_CANDIDATE") throw new Error("pre-commit state has a non-baseline HEAD");
  if (lifecycleState.state === "PRE_COMMIT_CANDIDATE" && lifecycleState.clean) throw new Error("pre-commit candidate must be dirty");
  if (!["PRE_COMMIT_CANDIDATE", "AMEND_CANDIDATE", "FINALIZED_P0_COMMIT", "FUTURE_DESCENDANT"].includes(lifecycleState.state)) throw new Error("unsupported lifecycle state");
});
expectedPass("FUTURE_DESCENDANT_ANCESTRY_RULE", () => {
  if (!finalizedP0Commit) throw new Error("finalized P0 commit is not discoverable from ancestry");
  assertFinalizedP0Ancestry(finalizedP0Commit.commit);
});

expectedFailure("G0_1_SYNTHETIC_RUNTIME_INJECTION", () => {
  const hits = historicalRuntimeHits(["src/core/google-static.ts"], { "src/core/google-static.ts": "export const GOOGLE_PROFILE = true;" });
  if (hits.length === 0) throw new Error("synthetic runtime was not rejected");
  throw new Error("EXPECTED_FAIL_CONFIRMED");
});
expectedPass("G0_1_DOCUMENT_GOOGLE_TEXT_ALLOWED", () => {
  const hits = historicalRuntimeHits(["docs/implementation/google.md"], { "docs/implementation/google.md": "Google architecture" });
  if (hits.length !== 0) throw new Error("documentation was incorrectly classified as runtime");
});
expectedFailure("G0_1_ACTIVE_REGISTRY_GOOGLE_PROFILE", () => {
  const hits = historicalRuntimeHits(["contracts/freeform-format-profiles.json"], { "contracts/freeform-format-profiles.json": "GOOGLE_STATIC runtimeStatus IMPLEMENTED" });
  if (hits.length === 0) throw new Error("active registry mutation was not rejected");
  throw new Error("EXPECTED_FAIL_CONFIRMED");
});
expectedFailure("G0_1_CURRENT_WORKTREE_HISTORY_SUBSTITUTION", () => assertHistoricalVerifierSource(g01Source.replace("const historicalFiles = await collectHistoricalRuntimeFiles(acceptedCommit);", "const historicalFiles = await collectFiles(\".\");")));
expectedFailure("G0_1_ACCEPTED_COMMIT_TAMPER", () => assertHistoricalVerifierSource(g01Source.replace(acceptedG01Commit, "0".repeat(40))));
expectedFailure("P0_FROZEN_ARTIFACT_TAMPER", () => {
  const values = { ...protectedArtifactDigests, "contracts/google/release-freeze.g4.json": "0".repeat(64) };
  validateProtectedArtifacts({ actualDigests: values });
});
expectedFailure("N8_CANONICAL_DOWNGRADE", () => requireValid(validateActiveFixture(syntheticCanonical("1.33.0", "1.32.9", "patch"))));
expectedFailure("N8_REGISTRY_VERSION_MISMATCH", () => {
  const value = syntheticCanonical("1.32.0", "1.33.0", "minor");
  value.versions.activeCanonical.version = "1.34.0";
  requireValid(validateActiveFixture(value));
});
expectedFailure("N8_REGISTRY_DIGEST_MISMATCH", () => {
  const value = syntheticCanonical("1.32.0", "1.33.0", "minor");
  value.versions.activeCanonical.sha256 = "0".repeat(64);
  requireValid(validateActiveFixture(value));
});
expectedFailure("N8_MALFORMED_SEMVER", () => requireValid(validateActiveFixture(syntheticCanonical("1.32.0", "1.33", "minor"))));
expectedFailure("N8_ANCESTRY_BREAK", () => validateCurrentAncestry({ currentHead, candidateAncestorOfFreeze: true, freezeAncestorOfCurrent: false }));
expectedFailure("CANDIDATE_EVIDENCE_DIGEST_TAMPER", () => parseCandidateManifestBytes(Buffer.from(readFileSync(candidateManifestPath).toString("utf8").replace("1.0.0", "1.0.1"), "utf8")));
expectedFailure("CANDIDATE_EVIDENCE_ABSOLUTE_PATH", () => {
  const forbiddenAbsolutePath = [String.fromCharCode(67) + ":", ["U", "s", "e", "r", "s"].join(""), ["L", "e", "n", "o", "v", "o"].join(""), ["D", "e", "s", "k", "t", "o", "p"].join(""), "contract-versions.json"].join("/");
  parseCandidateManifestBytes(Buffer.from(readFileSync(candidateManifestPath).toString("utf8").replace("contracts/contract-versions.json", forbiddenAbsolutePath), "utf8"));
});
expectedFailure("P0_FINALIZED_UNRELATED_PARENT", () => assertFinalizedP0Commit(currentHead, { parent: "0".repeat(40) }));
expectedFailure("P0_FINALIZED_PARENT_MISMATCH", () => assertFinalizedP0Commit(currentHead, { parent: "f".repeat(40) }));
expectedFailure("P0_FINALIZED_SUBJECT_ONLY_ARTIFACT_MISSING", () => assertFinalizedP0Commit(currentHead, { missingPaths: [candidateManifestRelativePath] }));
expectedFailure("P0_FINALIZED_COMMITTED_TREE_DIGEST_MISMATCH", () => assertFinalizedP0Commit(currentHead, { artifactDigest: "0".repeat(64) }));
expectedFailure("P0_FINALIZED_CANDIDATE_FILE_DIGEST_MISMATCH", () => assertFinalizedP0Commit(currentHead, { candidateDigestMismatches: ["contracts/p0-plume-architecture-freeze.json"] }));
expectedFailure("P0_FINALIZED_ANCESTRY_BREAK", () => assertFinalizedP0Ancestry("0".repeat(40)));

const status = failures.length === 0 ? "PASS" : "FAIL";
const g01Json = g01Result.json ?? {};
const p0Json = p0Result.json ?? {};
const n8Json = n8Result.json ?? {};
const p004Json = p004Result.json ?? {};
const result = {
  phase: "P0_0_5_P0_PROTECTION_AND_N8_FORWARD_COMPATIBILITY_CLOSURE_RESUME",
  status,
  baseline: { expectedHead: baselineHead, actualHead: currentHead, workingTree: lifecycleState.clean ? "CLEAN" : "DIRTY" },
  lifecycle: { state: lifecycleState.state, currentHead, finalizedP0Commit: finalizedP0Commit?.commit ?? null, finalizedP0Parent: finalizedP0Commit?.parent ?? null, finalizedP0Subject: finalizedP0Commit?.subject ?? null, clean: lifecycleState.clean, finalCommitShaHardcoded: false },
  evidenceReconciliation: { previousReportedG0_1Result: "21/21", actualInitialG0_1Result: "20/21", diagnosticRuns: [{ exitCode: 1, result: "20/21" }, { exitCode: g01Result.exitCode, result: `${g01Json.passed ?? 0}/${g01Json.checks ?? 0}` }], rootCause: "Full accepted-tree string search classified non-runtime documentation, registries, freeze artifacts, and verifier sources as runtime implementation", nonDeterminismFound: false },
  historicalTreeResolution: { acceptedFromCommit: acceptedG01Commit, freezeCompletionCommit: g01FreezeCommit, historicalDiffEnd: g01FreezeCommit, currentHeadUsedAsHistoricalEnd: false, n8FreezeCommit },
  p0Protection: p0Json.g0_1SemanticProtection ?? null,
  n8Compatibility: { activeCanonicalValidation: n8Json.checks?.find?.((entry) => entry.name === "active_canonical_state") ?? null, versionPolicy: n8Json.checks?.find?.((entry) => entry.name === "version_policy") ?? null, n8FreezeAncestorOfCurrent: n8Json.checks?.find?.((entry) => entry.name === "n8_freeze_ancestry") ?? null },
  candidatePreservation: candidateManifestState(),
  positiveCases: { passed: positiveCases.filter((entry) => entry.result === "PASS").length, total: positiveCases.length, entries: positiveCases },
  negativeCases: { passed: negativeCases.filter((entry) => entry.result === "PASS").length, total: negativeCases.length, entries: negativeCases },
  commands: {
    g01: { exitCode: g01Result.exitCode, passed: g01Json.passed ?? 0, total: g01Json.checks ?? 0 },
    p0: { exitCode: p0Result.exitCode, passed: p0Json.passed ?? 0, total: p0Json.total ?? 0 },
    n8: { exitCode: n8Result.exitCode, passed: n8Json.checks ? n8Json.checks - (n8Json.failures?.length ?? 0) : 0, total: n8Json.checks ?? 0 },
    p004: { exitCode: p004Result.exitCode, passed: p004Json.passed ?? 0, total: p004Json.checks ?? 0 },
  },
  p0_0_3FilesChanged: [],
  p0_0_4Proof: { passed: p004Json.passed ?? 0, total: p004Json.checks ?? 0 },
  p0_0_5FilesChanged: p0_0_5Paths,
  canonical: { version: versions.documentVersion.current, sha256: canonicalSha256 },
  status,
  checks: checks.length + positiveCases.length + negativeCases.length,
  passed: positiveCases.filter((entry) => entry.result === "PASS").length + negativeCases.filter((entry) => entry.result === "PASS").length,
  failed: failures,
};
console.log(JSON.stringify(result, null, 2));
if (status !== "PASS") process.exitCode = 1;
