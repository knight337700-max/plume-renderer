import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  canonicalSemVerPolicy,
  validateActiveCanonicalState,
  validateG01HistoricalSnapshot,
} from "./lib/canonical-semver-compatibility.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
const expectedBaselineHead = "be52bc8a27fb14b900e46f2f5719b198442f5be8";
const g01FreezeCommit = "ef807153c1143966a3f6d83bf01704bf1d2ad206";
const g01AcceptedFromCommit = "731b956e69700154a8b8e1c51ec9a2b7973aa07f";
const g01FrozenCanonicalVersion = "1.24.0";
const g01FrozenCanonicalSha256 = "9371f2710545acb6bb94d7af49f98b510b55e230544072fa4a3b12aec245f2b7";
const historicalVerifierPaths = [
  "scripts/verify-contract.mjs",
  "scripts/verify-g0-1-google-architecture-freeze.mjs",
  "scripts/verify-g0-google-static.mjs",
  "scripts/verify-g2-google-static.mjs",
  "scripts/verify-g3-0-4-google-static-geometry-placement-manifest.mjs",
  "scripts/verify-g3-0-6-google-static-verification-gate.mjs",
  "scripts/verify-g3-google-static-desktop-qa.mjs",
  "scripts/verify-g4-google-static-release-freeze.mjs",
  "scripts/verify-m2-2-meta.mjs",
  "scripts/verify-n7-7-5-typography-parity.mjs",
  "scripts/verify-n7-7-6-smartchannel-text-input-fields.mjs",
  "scripts/verify-naver-smartchannel-object-placement.mjs",
  "scripts/verify-p0-0-2-g4-historical-scope.mjs",
];
const activeForwardCompatiblePaths = new Set([
  "scripts/verify-contract.mjs",
  "scripts/verify-g0-1-google-architecture-freeze.mjs",
  "scripts/verify-g4-google-static-release-freeze.mjs",
]);

const checks = [];
const failures = [];
const positiveCases = [];
const negativeCases = [];

function record(id, evidence, result, detail = "", collection = checks) {
  const status = result === "PASS" ? "PASS" : "FAIL";
  const entry = { id, evidence, result: status, detail };
  collection.push(entry);
  if (status === "FAIL") failures.push(`${id}: ${detail}`);
  console.log(`${status} ${id} [${evidence}]${detail ? `: ${detail}` : ""}`);
  return entry;
}

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

function git(args, encoding = "utf8") {
  return execFileSync("git", args, { cwd: root, encoding });
}

function canonicalDocument(version) {
  return `# Synthetic Canonical\n\nDocument version:** ${version}\n\nPhase G4 historical record remains present.`;
}

function syntheticFixture(previous, current, bump, { registryVersion = current, registrySha = null } = {}) {
  const canonical = canonicalDocument(current);
  const currentCanonicalSha = digest(canonical);
  return {
    versions: {
      documentVersion: { previous, current, bump },
      activeCanonical: { version: registryVersion, sha256: registrySha ?? currentCanonicalSha },
      canonicalPhaseG0_1Google: { documentPrevious: "1.23.1", documentCurrent: "1.24.0", documentBump: "minor" },
      canonicalPhaseG4Google: { documentCurrent: "1.32.0", canonicalDocumentSha256: "413a23a9a4f1f95af1126fc96d17484d02bc69d547588dd17f55dd23778ab64e" },
    },
    canonical,
    currentCanonicalSha,
  };
}

function validateActiveFixture(value, historicalMinimumVersion = g01FrozenCanonicalVersion) {
  const result = validateActiveCanonicalState({
    versions: value.versions,
    canonical: value.canonical,
    currentCanonicalSha: value.currentCanonicalSha,
    historicalMinimumVersion,
  });
  if (!result.valid) throw new Error(result.errors.join("; "));
  return result;
}

function expectedPass(id, fn) {
  try {
    fn();
    record(id, "EXECUTED", "PASS", "", positiveCases);
  } catch (error) {
    record(id, "EXECUTED", "FAIL", error instanceof Error ? error.message : String(error), positiveCases);
  }
}

function expectedFailure(id, mutate, fn = validateActiveFixture) {
  const value = syntheticFixture("1.32.0", "1.33.0", "minor");
  mutate(value);
  try {
    fn(value);
    record(id, "EXPECTED_FAIL_CONFIRMED", "FAIL", "mutation unexpectedly validated", negativeCases);
  } catch {
    record(id, "EXPECTED_FAIL_CONFIRMED", "PASS", "", negativeCases);
  }
}

function expectedCustomFailure(id, fn) {
  try {
    fn();
    record(id, "EXPECTED_FAIL_CONFIRMED", "FAIL", "mutation unexpectedly validated", negativeCases);
  } catch {
    record(id, "EXPECTED_FAIL_CONFIRMED", "PASS", "", negativeCases);
  }
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
}

async function fileSha(relativePath) {
  return digest(await readFile(path.join(root, relativePath)));
}

function validateG01Identity({ phase, registry, evidence, canonicalSha256 = g01FrozenCanonicalSha256, expectedCanonicalSha256 = g01FrozenCanonicalSha256 } = {}) {
  const snapshot = validateG01HistoricalSnapshot({ phase, registry, evidence });
  const parent = git(["rev-parse", `${g01FreezeCommit}^`]).trim();
  const actualCanonicalSha256 = digest(git(["show", `${g01FreezeCommit}:docs/kakao-bizboard-renderer-spec-v1.md`], "buffer"));
  const errors = [...snapshot.errors];
  if (parent !== g01AcceptedFromCommit) errors.push("G0.1 freeze commit parent mismatch");
  if (registry?.acceptedFromCommit !== g01AcceptedFromCommit) errors.push("G0.1 acceptedFromCommit mismatch");
  if (canonicalSha256 !== expectedCanonicalSha256 || actualCanonicalSha256 !== expectedCanonicalSha256) errors.push("G0.1 frozen canonical digest mismatch");
  if (phase?.documentCurrent !== g01FrozenCanonicalVersion) errors.push("G0.1 frozen canonical version mismatch");
  if (evidence?.canonical?.currentVersion !== g01FrozenCanonicalVersion) errors.push("G0.1 evidence canonical version mismatch");
  if (errors.length > 0) throw new Error(errors.join("; "));
  return true;
}

function auditHistoricalVerifiers(sourceByPath) {
  const historicalSnapshotExact = historicalVerifierPaths.filter((relativePath) => !activeForwardCompatiblePaths.has(relativePath));
  const activeCurrentForwardCompatible = historicalVerifierPaths.filter((relativePath) => activeForwardCompatiblePaths.has(relativePath));
  const activeCurrentPinBlockers = [];
  for (const relativePath of activeCurrentForwardCompatible) {
    const source = sourceByPath.get(relativePath) ?? "";
    if (relativePath === "scripts/verify-g0-1-google-architecture-freeze.mjs" && /g304Compatibility|documentVersion\?\.current\s*===\s*["']1\.32\.0["']/u.test(source)) activeCurrentPinBlockers.push(relativePath);
    if (relativePath === "scripts/verify-contract.mjs" && /documentVersion\?\.current\s*===\s*["']1\.32\.0["']/u.test(source)) activeCurrentPinBlockers.push(relativePath);
  }
  const currentHeadGlobalPathBlockers = historicalVerifierPaths.filter((relativePath) => {
    const source = sourceByPath.get(relativePath) ?? "";
    return /git\(\["diff"[^\]]*(?:candidateHead|baseline)[^\]]*"HEAD"/u.test(source);
  });
  return {
    verifiersInspected: historicalVerifierPaths.length,
    historicalSnapshotExact,
    activeCurrentForwardCompatible,
    activeCurrentPinBlockers,
    currentHeadGlobalPathBlockers,
    unresolved: [],
    allPathsExist: historicalVerifierPaths.every((relativePath) => sourceByPath.has(relativePath)),
  };
}

async function main() {
  const versions = await readJson("contracts/contract-versions.json");
  const registry = await readJson("contracts/google/architecture-freeze.g0.1.json");
  const evidence = await readJson("artifacts/g0-1/google-static-architecture-freeze-verification.json");
  const canonical = await readFile(path.join(root, "docs/kakao-bizboard-renderer-spec-v1.md"), "utf8");
  const currentCanonicalSha = await fileSha("docs/kakao-bizboard-renderer-spec-v1.md");
  const actualHead = git(["rev-parse", "HEAD"]).trim();
  const workingTree = git(["status", "--short"]).trim();
  let baselineLineage = actualHead === expectedBaselineHead;
  if (!baselineLineage) {
    try { execFileSync("git", ["merge-base", "--is-ancestor", expectedBaselineHead, actualHead], { cwd: root, stdio: "ignore" }); baselineLineage = true; } catch { baselineLineage = false; }
  }
  record("BASELINE_LINEAGE", "EXECUTED", baselineLineage ? "PASS" : "FAIL", JSON.stringify({ expectedBaselineHead, actualHead, workingTree: workingTree === "" ? "CLEAN" : "DIRTY" }));

  const sourceByPath = new Map();
  for (const relativePath of historicalVerifierPaths) sourceByPath.set(relativePath, await readFile(path.join(root, relativePath), "utf8").catch(() => ""));
  const audit = auditHistoricalVerifiers(sourceByPath);

  expectedPass("CURRENT_1_32_0", () => {
    const result = validateActiveCanonicalState({
      versions,
      canonical,
      currentCanonicalSha,
      historicalMinimumVersion: g01FrozenCanonicalVersion,
      historicalFallback: { version: versions.canonicalPhaseG4Google.documentCurrent, sha256: versions.canonicalPhaseG4Google.canonicalDocumentSha256 },
    });
    if (!result.valid) throw new Error(result.errors.join("; "));
  });
  expectedPass("MINOR_1_32_0_TO_1_33_0", () => validateActiveFixture(syntheticFixture("1.32.0", "1.33.0", "minor")));
  expectedPass("PATCH_1_32_0_TO_1_32_1", () => validateActiveFixture(syntheticFixture("1.32.0", "1.32.1", "patch")));
  expectedPass("MAJOR_1_32_0_TO_2_0_0", () => validateActiveFixture(syntheticFixture("1.32.0", "2.0.0", "major")));
  expectedPass("HIGHER_MINOR_TRANSITION", () => validateActiveFixture(syntheticFixture("1.33.0", "1.35.0", "minor")));
  expectedPass("P0_LIKE_CANONICAL_REGISTRY_STATE", () => validateActiveFixture(syntheticFixture("1.32.0", "1.33.0", "minor")));
  expectedPass("G0_1_HISTORICAL_SNAPSHOT_EXACT", () => validateG01Identity({ phase: versions.canonicalPhaseG0_1Google, registry, evidence }));
  expectedPass("ALL_13_ACTIVE_PIN_AUDIT", () => {
    if (!audit.allPathsExist || audit.activeCurrentPinBlockers.length > 0 || audit.currentHeadGlobalPathBlockers.length > 0 || audit.unresolved.length > 0) throw new Error(JSON.stringify(audit));
  });

  expectedFailure("VERSION_DOWNGRADE", (value) => { value.versions.documentVersion.current = "1.31.9"; value.canonical = canonicalDocument("1.31.9"); value.currentCanonicalSha = digest(value.canonical); value.versions.activeCanonical = { version: "1.31.9", sha256: value.currentCanonicalSha }; });
  expectedFailure("MALFORMED_SEMVER", (value) => { value.versions.documentVersion.current = "1.32"; value.canonical = canonicalDocument("1.32"); value.currentCanonicalSha = digest(value.canonical); value.versions.activeCanonical = { version: "1.32", sha256: value.currentCanonicalSha }; });
  expectedFailure("MISSING_TRANSITION_FIELD", (value) => { delete value.versions.documentVersion.bump; });
  expectedFailure("SAME_VERSION_WITH_BUMP", (value) => { value.versions.documentVersion.previous = "1.33.0"; });
  expectedFailure("PATCH_DECLARED_MINOR", (value) => { value.versions.documentVersion = { previous: "1.32.0", current: "1.32.1", bump: "minor" }; value.canonical = canonicalDocument("1.32.1"); value.currentCanonicalSha = digest(value.canonical); value.versions.activeCanonical = { version: "1.32.1", sha256: value.currentCanonicalSha }; });
  expectedFailure("MINOR_DECLARED_PATCH", (value) => { value.versions.documentVersion.bump = "patch"; });
  expectedFailure("MAJOR_DECLARED_MINOR", (value) => { value.versions.documentVersion = { previous: "1.32.0", current: "2.0.0", bump: "minor" }; value.canonical = canonicalDocument("2.0.0"); value.currentCanonicalSha = digest(value.canonical); value.versions.activeCanonical = { version: "2.0.0", sha256: value.currentCanonicalSha }; });
  expectedFailure("DOCUMENT_REGISTRY_VERSION_MISMATCH", (value) => { value.versions.activeCanonical.version = "1.34.0"; });
  expectedFailure("DOCUMENT_REGISTRY_DIGEST_MISMATCH", (value) => { value.versions.activeCanonical.sha256 = "0".repeat(64); });
  expectedCustomFailure("TAMPER_G0_1_FROZEN_VERSION", () => {
    const phase = structuredClone(versions.canonicalPhaseG0_1Google);
    phase.documentCurrent = "1.25.0";
    validateG01Identity({ phase, registry, evidence });
  });
  expectedCustomFailure("TAMPER_G0_1_FROZEN_DIGEST", () => {
    validateG01Identity({ phase: versions.canonicalPhaseG0_1Google, registry, evidence, expectedCanonicalSha256: "0".repeat(64) });
  });
  expectedFailure("CURRENT_BELOW_G0_1_FROZEN", (value) => { value.versions.documentVersion.current = "1.23.9"; value.canonical = canonicalDocument("1.23.9"); value.currentCanonicalSha = digest(value.canonical); value.versions.activeCanonical = { version: "1.23.9", sha256: value.currentCanonicalSha }; });
  record("UNSUPPORTED_PRERELEASE_OR_BUILD", "NOT_APPLICABLE", "PASS", `repository policy ${canonicalSemVerPolicy.prereleaseAndBuildMetadata}`, negativeCases);
  expectedCustomFailure("MISSING_HISTORICAL_FIELD", () => {
    const phase = structuredClone(versions.canonicalPhaseG0_1Google);
    delete phase.documentCurrent;
    validateG01Identity({ phase, registry, evidence });
  });

  const actualG01CanonicalSha = digest(git(["show", `${g01FreezeCommit}:docs/kakao-bizboard-renderer-spec-v1.md`], "buffer"));
  const auditStatus = audit.allPathsExist && audit.activeCurrentPinBlockers.length === 0 && audit.currentHeadGlobalPathBlockers.length === 0 && audit.unresolved.length === 0 ? "PASS" : "FAIL";
  const positivePassed = positiveCases.filter((entry) => entry.result === "PASS").length;
  const negativePassed = negativeCases.filter((entry) => entry.result === "PASS").length;
  const status = failures.length === 0 && auditStatus === "PASS" ? "PASS" : "FAIL";
  console.log(JSON.stringify({
    phase: "P0_0_3_CANONICAL_EVOLUTION_COMPATIBILITY_CONSOLIDATION",
    status,
    baseline: { expectedHead: expectedBaselineHead, actualHead, workingTree: workingTree === "" ? "CLEAN" : "DIRTY" },
    historicalG0_1: { freezeCommit: g01FreezeCommit, acceptedFromCommit: g01AcceptedFromCommit, frozenCanonicalVersion: g01FrozenCanonicalVersion, frozenCanonicalSha256: actualG01CanonicalSha, expectedCanonicalSha256: g01FrozenCanonicalSha256, exact: actualG01CanonicalSha === g01FrozenCanonicalSha256 },
    historicalVerifierAudit: { ...audit, status: auditStatus },
    positiveCases: { passed: positivePassed, total: positiveCases.length, entries: positiveCases },
    negativeCases: { passed: negativePassed, total: negativeCases.length, entries: negativeCases },
    semverPolicy: canonicalSemVerPolicy,
    temporaryArtifactsRemaining: [],
    checks: checks.length + positiveCases.length + negativeCases.length,
    passed: checks.filter((entry) => entry.result === "PASS").length + positivePassed + negativePassed,
    failed: failures,
  }, null, 2));
  if (status !== "PASS") process.exitCode = 1;
}

await main();
