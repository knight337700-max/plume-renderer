import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  candidateHead,
  g4FreezeCommit,
  historicalChangedPaths,
  protectedArtifactDigests,
  frozenCanonicalSha256,
  frozenCanonicalVersion,
  validateCurrentAncestry,
  validateCurrentCanonicalState,
  validateHistoricalChangeScope,
  validateHistoricalSnapshot,
  validateProtectedArtifacts,
} from "./verify-g4-google-static-release-freeze.mjs";

const root = process.cwd();
const expectedHistoricalCount = 26;
const checks = [];
const failures = [];

function record(id, evidence, result, detail = "") {
  const status = result === "PASS" ? "PASS" : "FAIL";
  checks.push({ id, evidence, result: status, detail });
  if (status === "FAIL") failures.push(`${id}: ${detail}`);
  console.log(`${status} ${id} [${evidence}]${detail ? `: ${detail}` : ""}`);
}

function digest(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function git(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

function actualHistoricalPaths() {
  return git(["diff", "--name-only", "--no-renames", candidateHead, g4FreezeCommit])
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((entry) => entry.replaceAll("\\", "/"));
}

function canonicalDocument(version) {
  return `# Synthetic Canonical\n\nDocument version:** ${version}\n\nPhase G4 historical record remains present.`;
}

function currentFixture(version = frozenCanonicalVersion) {
  const canonical = canonicalDocument(version);
  const currentCanonicalSha = version === frozenCanonicalVersion ? frozenCanonicalSha256 : digest(canonical);
  return {
    versions: {
      canonicalPhaseG4Google: {
        documentCurrent: frozenCanonicalVersion,
        canonicalDocumentSha256: frozenCanonicalSha256,
      },
      documentVersion: { previous: "1.31.1", current: version, bump: "minor" },
    },
    canonical,
    currentCanonicalSha,
    activeCanonical: version === frozenCanonicalVersion ? null : { version, sha256: currentCanonicalSha },
  };
}

function historicalFixture() {
  return {
    versions: {
      canonicalPhaseG4Google: {
        documentCurrent: frozenCanonicalVersion,
        canonicalDocumentSha256: frozenCanonicalSha256,
      },
      documentVersion: { previous: "1.31.1", current: frozenCanonicalVersion, bump: "minor" },
    },
    registry: {
      canonical: { frozenVersion: frozenCanonicalVersion },
      frozenProfiles: Array.from({ length: 14 }, (_, index) => ({ profileId: `PROFILE_${index + 1}` })),
      frozenGoldens: Array.from({ length: 14 }, (_, index) => ({ profileId: `PROFILE_${index + 1}` })),
    },
    candidateSourceHead: candidateHead,
  };
}

function currentAncestry(overrides = {}) {
  return {
    candidateSourceHead: candidateHead,
    freezeCommit: g4FreezeCommit,
    currentHead: "eb5f91f3f914a42e9ebb3fba8e111bc37352ae10",
    candidateAncestorOfFreeze: true,
    freezeAncestorOfCurrent: true,
    ...overrides,
  };
}

function actualProtectedDigests() {
  return structuredClone(protectedArtifactDigests);
}

function expectPass(id, fn) {
  try {
    fn();
    record(id, "EXECUTED", "PASS");
  } catch (error) {
    record(id, "EXECUTED", "FAIL", error instanceof Error ? error.message : String(error));
  }
}

function expectFailure(id, fn) {
  try {
    fn();
    record(id, "EXPECTED_FAIL_CONFIRMED", "FAIL", "mutation unexpectedly validated");
  } catch {
    record(id, "EXPECTED_FAIL_CONFIRMED", "PASS");
  }
}

function validateBaselineState() {
  const historical = historicalFixture();
  validateCurrentAncestry(currentAncestry());
  validateHistoricalChangeScope({ changedPaths: actualHistoricalPaths() });
  validateHistoricalSnapshot({
    versions: historical.versions,
    registry: historical.registry,
    candidateSourceHead: historical.candidateSourceHead,
    expectedCandidateSourceHead: candidateHead,
  });
  validateProtectedArtifacts({ actualDigests: actualProtectedDigests() });
  const current = currentFixture();
  validateCurrentCanonicalState(current);
}

expectPass("CURRENT_BASELINE", validateBaselineState);
expectPass("FUTURE_P0_LIKE_DESCENDANT", () => {
  validateCurrentAncestry(currentAncestry({ currentHead: "f".repeat(40) }));
  validateHistoricalChangeScope({ changedPaths: actualHistoricalPaths() });
  validateCurrentCanonicalState(currentFixture("1.33.0"));
});
expectPass("FUTURE_BENIGN_PATH_DESCENDANT", () => {
  validateCurrentAncestry(currentAncestry());
  validateHistoricalChangeScope({ changedPaths: actualHistoricalPaths() });
  validateCurrentCanonicalState(currentFixture("1.34.0"));
});
expectPass("CURRENT_CANONICAL_1_33_0", () => validateCurrentCanonicalState(currentFixture("1.33.0")));
expectPass("CURRENT_CANONICAL_HIGHER_SEMVER", () => validateCurrentCanonicalState(currentFixture("2.0.0")));
expectPass("HISTORICAL_CHANGED_SET_EXACT", () => validateHistoricalChangeScope({ changedPaths: actualHistoricalPaths() }));

expectFailure("CURRENT_NOT_DESCENDANT", () => validateCurrentAncestry(currentAncestry({ freezeAncestorOfCurrent: false })));
expectFailure("WRONG_FREEZE_COMMIT", () => validateCurrentAncestry(currentAncestry({ freezeCommit: "0".repeat(40) })));
expectFailure("HISTORICAL_PATH_MISSING", () => validateHistoricalChangeScope({ changedPaths: actualHistoricalPaths().slice(1) }));
expectFailure("HISTORICAL_PATH_EXTRA", () => validateHistoricalChangeScope({ changedPaths: [...actualHistoricalPaths(), "contracts/future/fixture.json"] }));
expectFailure("TAMPER_FREEZE_REGISTRY", () => {
  const values = actualProtectedDigests();
  values["contracts/google/release-freeze.g4.json"] = "0".repeat(64);
  validateProtectedArtifacts({ actualDigests: values });
});
expectFailure("TAMPER_USER_ACCEPTANCE", () => {
  const values = actualProtectedDigests();
  values["artifacts/g4/google-static-user-acceptance.json"] = "0".repeat(64);
  validateProtectedArtifacts({ actualDigests: values });
});
expectFailure("TAMPER_EXTERNAL_REVIEW", () => {
  const values = actualProtectedDigests();
  values["artifacts/g4/google-static-external-review.json"] = "0".repeat(64);
  validateProtectedArtifacts({ actualDigests: values });
});
expectFailure("TAMPER_ACCEPTED_PACK_SHA", () => {
  const historical = historicalFixture();
  validateHistoricalSnapshot({
    versions: historical.versions,
    registry: historical.registry,
    candidateSourceHead: historical.candidateSourceHead,
    acceptedPack: { sha256: "0".repeat(64) },
    expectedAcceptedPack: { sha256: "1".repeat(64) },
  });
});
expectFailure("TAMPER_FROZEN_CANONICAL", () => {
  const historical = historicalFixture();
  historical.versions.canonicalPhaseG4Google.canonicalDocumentSha256 = "0".repeat(64);
  validateHistoricalSnapshot(historical);
});
expectFailure("TAMPER_CANDIDATE_HEAD", () => {
  const historical = historicalFixture();
  historical.candidateSourceHead = "0".repeat(40);
  validateHistoricalSnapshot(historical);
});
expectFailure("DELETE_PROTECTED_ARTIFACT", () => {
  const values = actualProtectedDigests();
  delete values["artifacts/g4/google-static-external-review.json"];
  validateProtectedArtifacts({ actualDigests: values });
});
expectFailure("CURRENT_CANONICAL_DOWNGRADE", () => validateCurrentCanonicalState(currentFixture("1.31.9")));
expectFailure("CURRENT_VERSION_REGISTRY_MISMATCH", () => {
  const value = currentFixture("1.33.0");
  value.activeCanonical.version = "1.33.1";
  validateCurrentCanonicalState(value);
});
expectFailure("CURRENT_DIGEST_REGISTRY_MISMATCH", () => {
  const value = currentFixture("1.33.0");
  value.activeCanonical.sha256 = "0".repeat(64);
  validateCurrentCanonicalState(value);
});
expectFailure("MALFORMED_SEMVER", () => validateCurrentCanonicalState(currentFixture("1.32")));

const source = await readFile(path.join(root, "scripts/verify-g4-google-static-release-freeze.mjs"), "utf8");
const actualPaths = actualHistoricalPaths();
const pathPolicyValid = historicalChangedPaths.length === expectedHistoricalCount
  && historicalChangedPaths.every((entry) => entry === entry.trim() && !/[?*]/u.test(entry))
  && !/git\(\["diff",\s*"--name-only"(?:,\s*"--no-renames")?,\s*candidateHead,\s*"HEAD"\]\)/u.test(source)
  && !source.includes(["allowed", "change", "boundary"].join("_"));
record("EXACT_HISTORICAL_ALLOWLIST_NO_WILDCARDS", "EXECUTED", pathPolicyValid ? "PASS" : "FAIL", JSON.stringify({ expected: expectedHistoricalCount, actual: actualPaths.length }));
record("CURRENT_HEAD_NOT_HISTORICAL_DIFF_END", "EXECUTED", actualPaths.length === expectedHistoricalCount ? "PASS" : "FAIL");

const passed = checks.filter((entry) => entry.result === "PASS").length;
console.log(JSON.stringify({
  phase: "P0_0_2_G4_HISTORICAL_CHANGE_SCOPE_FORWARD_COMPATIBILITY",
  status: failures.length === 0 ? "PASS" : "FAIL",
  checks: checks.length,
  passed,
  failed: failures,
  positives: checks.filter((entry) => entry.evidence === "EXECUTED").length,
  negatives: checks.filter((entry) => entry.evidence === "EXPECTED_FAIL_CONFIRMED").length,
  expectedHistoricalCount,
  actualHistoricalCount: actualPaths.length,
}));
if (failures.length > 0) process.exitCode = 1;
