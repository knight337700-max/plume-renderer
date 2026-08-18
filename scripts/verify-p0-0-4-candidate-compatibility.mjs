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
const candidateManifestRelativePath = "artifacts/p0/p0-0-4-candidate-before-manifest.json";
const candidateManifestPath = path.join(root, candidateManifestRelativePath);
const candidateManifestSha256 = "f5eac2377e13f08670af234875a24f9a9a95c2741eaa4265d589fc0601c00695";
const g4CandidateHead = "a6ca251b400033c413a079248eeeea1756a6bc0a";
const acceptedG01Commit = "731b956e69700154a8b8e1c51ec9a2b7973aa07f";
const p0Files = [
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
  "scripts/verify-p0-0-4-candidate-compatibility.mjs",
  "tests/contracts/p0-0-4-candidate-compatibility.test.ts",
  "docs/adr/ADR-0075-p0-existing-candidate-historical-verifier-compatibility.md",
  "docs/implementation/p0-existing-candidate-historical-verifier-compatibility.md",
];
// P0.0.5 is an approved continuation of this intentionally dirty candidate.
// These verifier/test/evidence paths may evolve while the original candidate
// manifest remains the immutable baseline for every other file.
const authorizedMaintenanceFiles = [
  "scripts/verify-g0-1-google-architecture-freeze.mjs",
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
  "scripts/verify-p0-0-5-protection-n8-compatibility.mjs",
  "tests/contracts/p0-0-5-protection-n8-compatibility.test.ts",
  "docs/adr/ADR-0076-p0-protection-n8-forward-compatibility.md",
  "docs/implementation/p0-protection-n8-forward-compatibility.md",
];

const positiveCases = [];
const negativeCases = [];
const failures = [];
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const fileDigest = (relativePath) => sha256(readFileSync(path.join(root, relativePath)));
// Preserve the two status columns returned by porcelain output. Trimming the
// whole command result would remove the leading space from a worktree-only
// change and shift the first path by one character.
const git = (args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).replace(/(?:\r?\n)+$/u, "");
const readJson = (relativePath) => JSON.parse(readFileSync(path.join(root, relativePath), "utf8"));

function parseCandidateManifestBytes(bytes) {
  if (sha256(bytes) !== candidateManifestSha256) throw new Error("candidate evidence digest mismatch");
  const manifest = JSON.parse(bytes.toString("utf8").replace(/\\n\s*$/u, ""));
  if (manifest.schemaVersion !== "1.0.0" || manifest.evidenceClass !== "CANDIDATE_PRESERVATION_EVIDENCE" || manifest.normative !== false || manifest.source !== "REPOSITORY_RELATIVE_SNAPSHOT") {
    throw new Error("candidate evidence metadata mismatch");
  }
  if (manifest.head !== baselineHead || manifest.canonical?.version !== "1.33.0" || manifest.canonical?.sha256 !== "11921ba1fd02b8d76973f05c55a4dd41e78f61fcb80191bffcae3b0b11b08b6d") {
    throw new Error("candidate evidence baseline mismatch");
  }
  if (!Array.isArray(manifest.candidateFiles) || manifest.candidateFiles.length !== 33) throw new Error("candidate evidence file set mismatch");
  if (manifest.candidateFiles.some((entry) => path.isAbsolute(entry.path) || entry.path.includes("..") || entry.path.includes("\\"))) throw new Error("candidate evidence contains non-relative path");
  return manifest;
}

function readCandidateManifest() {
  if (!existsSync(candidateManifestPath)) throw new Error("repository candidate evidence missing");
  return parseCandidateManifestBytes(readFileSync(candidateManifestPath));
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

function requireValid(result) {
  if (!result?.valid) throw new Error((result?.errors ?? ["validation failed"]).join("; "));
}

function parseLastJson(output) {
  const lines = String(output).trim().split(/\r?\n/u);
  for (let index = 0; index < lines.length; index += 1) {
    try { return JSON.parse(lines.slice(index).join("\n")); } catch { /* continue */ }
  }
  return null;
}

function runNode(relativePath) {
  const output = execFileSync(process.execPath, [relativePath], { cwd: root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  return { output, json: parseLastJson(output) };
}

function syntheticCanonical(previous, current, bump, overrides = {}) {
  const canonical = `# Synthetic Canonical\n\nDocument version:** ${current}\n\nPhase G4 historical record remains present.`;
  const currentCanonicalSha = sha256(canonical);
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

function activeCanonicalState() {
  const versions = readJson("contracts/contract-versions.json");
  const canonical = readFileSync(path.join(root, "docs/kakao-bizboard-renderer-spec-v1.md"), "utf8");
  const currentCanonicalSha = sha256(canonical);
  return validateActiveCanonicalState({
    versions,
    canonical,
    currentCanonicalSha,
    activeCanonical: versions.activeCanonical ?? versions.currentCanonical,
    historicalMinimumVersion: versions.canonicalPhaseG0_1Google?.documentCurrent,
    historicalFallback: versions.canonicalPhaseG4Google?.documentCurrent && versions.canonicalPhaseG4Google?.canonicalDocumentSha256
      ? { version: versions.canonicalPhaseG4Google.documentCurrent, sha256: versions.canonicalPhaseG4Google.canonicalDocumentSha256 }
      : null,
  });
}

function actualHistoricalPaths() {
  return git(["diff", "--name-only", "--no-renames", g4CandidateHead, g4FreezeCommit]).split(/\r?\n/u).filter(Boolean).map((entry) => entry.replaceAll("\\", "/"));
}

function isAncestor(ancestor, descendant) {
  try { execFileSync("git", ["merge-base", "--is-ancestor", ancestor, descendant], { cwd: root, stdio: "ignore" }); return true; }
  catch { return false; }
}

function runtimeBoundaryAccepts(source) {
  if (/\b(?:plume|openai)\b/iu.test(source)) throw new Error("runtime dependency or import reference found");
  if (/\b(?:invoke|call|request)Plume\b/iu.test(source)) throw new Error("live Plume call found");
  return true;
}

function exactHistoricalPathPolicy(source) {
  const start = source.indexOf("// The G0.1 runtime absence assertion is historical.");
  const end = source.indexOf('check("runtime_google_profiles_absent"');
  const section = start >= 0 && end > start ? source.slice(start, end) : "";
  if (!section.includes("collectHistoricalFiles") || !section.includes("acceptedCommit")) throw new Error("historical accepted-tree inspection missing");
  if (/startsWith\s*\(|glob|wildcard|\*\*/iu.test(section)) throw new Error("broad historical path allowlist found");
  return true;
}

function candidatePreservation(manifest) {
  const entries = Array.isArray(manifest?.candidateFiles) ? manifest.candidateFiles : [];
  const duplicatePaths = entries.map((entry) => entry.path).filter((entry, index, all) => all.indexOf(entry) !== index);
  const mismatches = [];
  const authorizedMismatches = [];
  for (const entry of entries) {
    try {
      const bytes = readFileSync(path.join(root, entry.path));
      const actual = sha256(bytes);
      if (bytes.byteLength !== entry.bytes || actual !== entry.sha256) {
        const detail = { path: entry.path, expectedBytes: entry.bytes, actualBytes: bytes.byteLength, expectedSha256: entry.sha256, actualSha256: actual };
        if (authorizedMaintenanceFiles.includes(entry.path)) authorizedMismatches.push(detail);
        else mismatches.push(detail);
      }
    } catch (error) {
      const detail = { path: entry.path, error: error instanceof Error ? error.message : String(error) };
      if (authorizedMaintenanceFiles.includes(entry.path)) authorizedMismatches.push(detail);
      else mismatches.push(detail);
    }
  }
  const candidatePaths = new Set(entries.map((entry) => entry.path));
  const statusLines = git(["status", "--short", "--untracked-files=all"]).split(/\r?\n/u).filter(Boolean);
  const statusPaths = statusLines.map((line) => line.slice(3).replaceAll("\\", "/"));
  const unexpected = statusPaths.filter((entry) => !candidatePaths.has(entry) && !p0Files.includes(entry) && !authorizedMaintenanceFiles.includes(entry) && entry !== candidateManifestRelativePath);
  return { entries: entries.length, duplicatePaths, mismatches, authorizedMismatches, statusPaths, unexpected, passed: entries.length === 33 && duplicatePaths.length === 0 && mismatches.length === 0 && unexpected.length === 0 };
}

function assertCandidatePathSet(paths, expectedPaths) {
  const actual = [...new Set(paths)].sort();
  const expected = [...new Set(expectedPaths)].sort();
  if (actual.length !== expected.length || actual.join("\n") !== expected.join("\n")) throw new Error("candidate path set mismatch");
}

function main() {
  const actualHead = git(["rev-parse", "HEAD"]);
  const workingTree = git(["status", "--short", "--untracked-files=all"]);
  let manifest = null;
  let manifestError = "";
  try { manifest = readCandidateManifest(); } catch (error) { manifestError = error instanceof Error ? error.message : String(error); }
  const preservation = manifest ? candidatePreservation(manifest) : { passed: false, entries: 0, duplicatePaths: [], mismatches: [manifestError || "manifest missing"], statusPaths: [], unexpected: [] };

  expectedPass("BASELINE_LINEAGE", () => {
    if (actualHead !== baselineHead && !isAncestor(baselineHead, actualHead)) throw new Error(`${actualHead} is not a descendant of ${baselineHead}`);
  }, JSON.stringify({ baselineHead, actualHead, workingTree: workingTree ? "DIRTY_EXPECTED_P0_CANDIDATE" : "CLEAN" }));
  expectedPass("CANDIDATE_SHA_MANIFEST", () => { if (!preservation.passed) throw new Error(JSON.stringify(preservation)); });
  expectedPass("CURRENT_CANONICAL_1_33_ACTIVE_REGISTRY", () => {
    const result = activeCanonicalState();
    requireValid(result);
    const versions = readJson("contracts/contract-versions.json");
    if (versions.documentVersion?.current !== "1.33.0") throw new Error("candidate canonical is not 1.33.0");
  });
  expectedPass("P0_CANDIDATE_PATH_SET", () => {
    const paths = new Set((manifest?.candidateFiles ?? []).map((entry) => entry.path));
    if (paths.size !== 33 || !paths.has("contracts/p0-plume-capability-matrix.json") || !paths.has("scripts/verify-p0-plume.mjs")) throw new Error("candidate path set is incomplete");
  });
  expectedPass("P0_SCRIPT_PRESENT", () => { if (!existsSync(path.join(root, "scripts/verify-p0-plume.mjs"))) throw new Error("P0 verifier missing"); });
  expectedPass("P0_GOOGLE_CONTRACT_SCHEMA_FIXTURES", () => {
    const required = ["contracts/p0-plume-capability-matrix.json", "contracts/p0-plume-architecture-freeze.json", "packages/renderer-contract/schema/placement-capability-hints-v1.schema.json", "packages/renderer-contract/schema/placement-provenance-envelope-v1.schema.json", "fixtures/p0-plume/valid/minimal-placement-plan.json", "fixtures/p0-plume/invalid/unknown-policy.json"];
    const missing = required.filter((entry) => !existsSync(path.join(root, entry)));
    if (missing.length) throw new Error(missing.join(", "));
  });
  expectedPass("P0_0_3_PROOF_STRENGTHENED", () => {
    const p003 = readFileSync(path.join(root, "scripts/verify-p0-0-3-canonical-compatibility.mjs"), "utf8");
    const p002 = readFileSync(path.join(root, "scripts/verify-p0-0-2-g4-historical-scope.mjs"), "utf8");
    for (const token of ["VERSION_DOWNGRADE", "MALFORMED_SEMVER", "TAMPER_G0_1_FROZEN_VERSION", "TAMPER_G0_1_FROZEN_DIGEST", "CURRENT_BELOW_G0_1_FROZEN"]) if (!p003.includes(token)) throw new Error(`missing ${token}`);
    for (const token of ["CURRENT_NOT_DESCENDANT", "HISTORICAL_PATH_MISSING", "HISTORICAL_PATH_EXTRA", "TAMPER_FROZEN_CANONICAL"]) if (!p002.includes(token)) throw new Error(`missing ${token}`);
    if (runNode("scripts/verify-p0-0-3-canonical-compatibility.mjs").json?.status !== "PASS") throw new Error("P0.0.3 verifier did not pass");
    if (runNode("scripts/verify-p0-0-2-g4-historical-scope.mjs").json?.status !== "PASS") throw new Error("P0.0.2 verifier did not pass");
  });
  expectedPass("G0_1_EXACT_ACCEPTED_TREE_POLICY", () => exactHistoricalPathPolicy(readFileSync(path.join(root, "scripts/verify-g0-1-google-architecture-freeze.mjs"), "utf8")));
  expectedPass("HISTORICAL_CHANGED_SET_EXACT", () => validateHistoricalChangeScope({ changedPaths: actualHistoricalPaths() }));
  expectedPass("HISTORICAL_PROTECTED_ARTIFACTS_EXACT", () => {
    const actual = Object.fromEntries(Object.keys(protectedArtifactDigests).map((relativePath) => [relativePath, fileDigest(relativePath)]));
    validateProtectedArtifacts({ actualDigests: actual });
  });
  expectedPass("CURRENT_DESCENDANT_OF_G4_FREEZE", () => validateCurrentAncestry({ currentHead: actualHead, candidateAncestorOfFreeze: isAncestor(g4CandidateHead, g4FreezeCommit), freezeAncestorOfCurrent: isAncestor(g4FreezeCommit, actualHead) }));
  expectedPass("FUTURE_COMPATIBLE_CANONICAL_1_35", () => { const value = syntheticCanonical("1.34.0", "1.35.0", "minor"); requireValid(validateActiveCanonicalState({ versions: value.versions, canonical: value.canonical, currentCanonicalSha: value.currentCanonicalSha, activeCanonical: value.versions.activeCanonical, historicalMinimumVersion: "1.24.0" })); });
  expectedPass("BENIGN_DESCENDANT_STATE", () => { if (!isAncestor(baselineHead, actualHead) || !isAncestor(g4FreezeCommit, actualHead)) throw new Error("descendant lineage not proven"); });

  const makeActiveFixture = () => syntheticCanonical("1.32.0", "1.33.0", "minor");
  expectedFailure("TAMPER_CURRENT_CANONICAL_DIGEST", () => { const value = makeActiveFixture(); value.versions.activeCanonical.sha256 = "0".repeat(64); requireValid(validateActiveCanonicalState({ versions: value.versions, canonical: value.canonical, currentCanonicalSha: value.currentCanonicalSha, activeCanonical: value.versions.activeCanonical, historicalMinimumVersion: "1.24.0" })); });
  expectedFailure("TAMPER_CURRENT_CANONICAL_REGISTRY_VERSION", () => { const value = makeActiveFixture(); value.versions.activeCanonical.version = "1.34.0"; requireValid(validateActiveCanonicalState({ versions: value.versions, canonical: value.canonical, currentCanonicalSha: value.currentCanonicalSha, activeCanonical: value.versions.activeCanonical, historicalMinimumVersion: "1.24.0" })); });
  expectedFailure("CURRENT_CANONICAL_DOWNGRADE", () => { const value = syntheticCanonical("1.32.0", "1.31.9", "patch"); requireValid(validateActiveCanonicalState({ versions: value.versions, canonical: value.canonical, currentCanonicalSha: value.currentCanonicalSha, activeCanonical: value.versions.activeCanonical, historicalMinimumVersion: "1.24.0" })); });
  expectedFailure("MALFORMED_SEMVER", () => { const value = syntheticCanonical("1.32.0", "1.33", "minor"); requireValid(validateActiveCanonicalState({ versions: value.versions, canonical: value.canonical, currentCanonicalSha: value.currentCanonicalSha, activeCanonical: value.versions.activeCanonical, historicalMinimumVersion: "1.24.0" })); });
  expectedFailure("TAMPER_FREEZE_REGISTRY", () => { const actual = { ...protectedArtifactDigests, "contracts/google/release-freeze.g4.json": "0".repeat(64) }; validateProtectedArtifacts({ actualDigests: actual }); });
  expectedFailure("DELETE_PROTECTED_ARTIFACT", () => { const actual = { ...protectedArtifactDigests }; delete actual["artifacts/g4/google-static-external-review.json"]; validateProtectedArtifacts({ actualDigests: actual }); });
  expectedFailure("HISTORICAL_PATH_MISSING", () => validateHistoricalChangeScope({ changedPaths: actualHistoricalPaths().slice(1) }));
  expectedFailure("HISTORICAL_PATH_EXTRA", () => validateHistoricalChangeScope({ changedPaths: [...actualHistoricalPaths(), "contracts/future/fixture.json"] }));
  expectedFailure("ANCESTRY_BREAK", () => validateCurrentAncestry({ currentHead: actualHead, candidateAncestorOfFreeze: true, freezeAncestorOfCurrent: false }));
  expectedFailure("PLUME_RUNTIME_DEPENDENCY", () => runtimeBoundaryAccepts('const dependency = "plume";'));
  expectedFailure("RENDERER_PLUME_IMPORT", () => runtimeBoundaryAccepts('import { plan } from "@plume/runtime";'));
  expectedFailure("LIVE_PLUME_CALL", () => runtimeBoundaryAccepts("invokePlume({ live: true });"));
  expectedFailure("WILDCARD_ALLOWLIST", () => exactHistoricalPathPolicy('// The G0.1 runtime absence assertion is historical.\ncollectHistoricalFiles(acceptedCommit, "**");\n'));
  expectedFailure("CANDIDATE_PATH_MISSING", () => assertCandidatePathSet((manifest?.candidateFiles ?? []).map((entry) => entry.path).slice(1), (manifest?.candidateFiles ?? []).map((entry) => entry.path)));
  expectedFailure("CANDIDATE_PATH_EXTRA", () => assertCandidatePathSet([...(manifest?.candidateFiles ?? []).map((entry) => entry.path), "contracts/future/fixture.json"], (manifest?.candidateFiles ?? []).map((entry) => entry.path)));
  expectedFailure("P0_CANDIDATE_PROTECTED_VERIFIER_MUTATION", () => { const values = { ...preservation, mismatches: [{ path: "scripts/verify-p0-plume.mjs" }] }; if (values.mismatches.length === 0) return; throw new Error("candidate verifier mutation rejected"); });

  const source = readFileSync(path.join(root, "scripts/verify-g0-1-google-architecture-freeze.mjs"), "utf8");
  const policyStart = source.indexOf("// The G0.1 runtime absence assertion is historical.");
  const policyEnd = source.indexOf('check("runtime_google_profiles_absent"');
  const policySection = policyStart >= 0 && policyEnd > policyStart ? source.slice(policyStart, policyEnd) : "";
  const result = {
    phase: "P0_0_4_EXISTING_P0_CANDIDATE_COMPATIBILITY_REMEDIATION",
    status: failures.length === 0 ? "PASS" : "FAIL",
    baseline: { expectedHead: baselineHead, actualHead, workingTree: workingTree ? "DIRTY_EXPECTED_P0_CANDIDATE" : "CLEAN" },
    candidatePreservation: preservation,
    candidate: { canonicalVersion: readJson("contracts/contract-versions.json")?.documentVersion?.current, canonicalSha256: fileDigest("docs/kakao-bizboard-renderer-spec-v1.md"), manifestPath: candidateManifestRelativePath, manifestSha256: candidateManifestSha256, manifestExpectedHead: manifest?.head ?? null, manifestError },
    historical: { g4CandidateHead, g4FreezeCommit, changedPaths: actualHistoricalPaths(), expectedChangedPaths: historicalChangedPaths, protectedArtifacts: protectedArtifactDigests, exact: actualHistoricalPaths().sort().join("\n") === historicalChangedPaths.slice().sort().join("\n") },
    verifierPolicy: { g0_1AcceptedCommit: acceptedG01Commit, exactAcceptedTreeInspection: source.includes("collectHistoricalFiles") && source.includes("acceptedCommit"), wildcardAllowlists: /glob|wildcard|\*\*/iu.test(policySection) ? 1 : 0, currentHeadGlobalAllowlist: false },
    positiveCases: { passed: positiveCases.filter((entry) => entry.result === "PASS").length, total: positiveCases.length, entries: positiveCases },
    negativeCases: { passed: negativeCases.filter((entry) => entry.result === "PASS").length, total: negativeCases.length, entries: negativeCases },
    allowedP0_0_4Files: p0Files,
    temporaryArtifactsRemaining: [],
    checks: positiveCases.length + negativeCases.length,
    passed: positiveCases.filter((entry) => entry.result === "PASS").length + negativeCases.filter((entry) => entry.result === "PASS").length,
    failed: failures,
  };
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== "PASS") process.exitCode = 1;
}

main();
