import { createHash } from "node:crypto";

import {
  candidateHead,
  expectedPack,
  frozenCanonicalSha256,
  frozenCanonicalVersion,
  validateCurrentCanonicalState,
  validateHistoricalSnapshot,
} from "./verify-g4-google-static-release-freeze.mjs";

const frozenPack = structuredClone(expectedPack);
const frozenVersions = {
  canonicalPhaseG4Google: {
    documentCurrent: frozenCanonicalVersion,
    canonicalDocumentSha256: frozenCanonicalSha256,
  },
  documentVersion: { previous: "1.31.1", current: frozenCanonicalVersion, bump: "minor" },
};
const frozenRegistry = {
  canonical: { frozenVersion: frozenCanonicalVersion },
  acceptedPack: structuredClone(frozenPack),
  frozenProfiles: Array.from({ length: 14 }, (_, index) => ({ profileId: `PROFILE_${index + 1}` })),
  frozenGoldens: Array.from({ length: 14 }, (_, index) => ({ profileId: `PROFILE_${index + 1}` })),
};

function digest(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function canonicalDocument(version) {
  return `# Synthetic Canonical\n\nDocument version:** ${version}\n\nPhase G4 historical record remains present.`;
}

function fixture(version = frozenCanonicalVersion) {
  const canonical = canonicalDocument(version);
  const currentCanonicalSha = version === frozenCanonicalVersion ? frozenCanonicalSha256 : digest(canonical);
  return {
    versions: structuredClone({ ...frozenVersions, documentVersion: { ...frozenVersions.documentVersion, current: version } }),
    registry: structuredClone(frozenRegistry),
    canonical,
    currentCanonicalSha,
    activeCanonical: version === frozenCanonicalVersion ? null : { version, sha256: digest(canonical) },
    candidateSourceHead: candidateHead,
  };
}

function runFixture(value) {
  validateHistoricalSnapshot({
    versions: value.versions,
    registry: value.registry,
    candidateSourceHead: value.candidateSourceHead,
    acceptedPack: value.registry.acceptedPack,
  });
  validateCurrentCanonicalState({
    versions: value.versions,
    canonical: value.canonical,
    currentCanonicalSha: value.currentCanonicalSha,
    activeCanonical: value.activeCanonical,
  });
}

const checks = [];
const failures = [];

function record(id, evidence, result, detail = "") {
  const status = result === "PASS" ? "PASS" : "FAIL";
  checks.push({ id, evidence, result: status, detail });
  if (status === "FAIL") failures.push(`${id}: ${detail}`);
  console.log(`${status} ${id} [${evidence}]${detail ? `: ${detail}` : ""}`);
}

function positive(id, value) {
  try {
    runFixture(value);
    record(id, "EXECUTED", "PASS");
  } catch (error) {
    record(id, "EXECUTED", "FAIL", error instanceof Error ? error.message : String(error));
  }
}

function expectedFailure(id, mutate, target = "historical") {
  const value = fixture();
  mutate(value);
  try {
    if (target === "historical") {
      validateHistoricalSnapshot({
        versions: value.versions,
        registry: value.registry,
        candidateSourceHead: value.candidateSourceHead,
        acceptedPack: value.registry.acceptedPack,
      });
    } else {
      validateCurrentCanonicalState({
        versions: value.versions,
        canonical: value.canonical,
        currentCanonicalSha: value.currentCanonicalSha,
        activeCanonical: value.activeCanonical,
      });
    }
    record(id, "EXPECTED_FAIL_CONFIRMED", "FAIL", "mutation unexpectedly validated");
  } catch {
    record(id, "EXPECTED_FAIL_CONFIRMED", "PASS");
  }
}

positive("CURRENT_1_32_0", fixture());
positive("FUTURE_1_33_0", fixture("1.33.0"));
positive("FUTURE_HIGHER_SEMVER", fixture("1.34.0"));

expectedFailure("TAMPER_FROZEN_VERSION", (value) => { value.registry.canonical.frozenVersion = "1.31.0"; });
expectedFailure("TAMPER_FROZEN_CANONICAL_SHA", (value) => { value.versions.canonicalPhaseG4Google.canonicalDocumentSha256 = "0".repeat(64); });
expectedFailure("TAMPER_ACCEPTED_PACK_SHA", (value) => { value.registry.acceptedPack.sha256 = "0".repeat(64); });
expectedFailure("TAMPER_CANDIDATE_HEAD", (value) => { value.candidateSourceHead = "deadbeef"; });
expectedFailure("TAMPER_FROZEN_COUNTS", (value) => { value.registry.frozenProfiles = value.registry.frozenProfiles.slice(0, 13); });
expectedFailure("CURRENT_VERSION_DOWNGRADE", (value) => {
  value.versions.documentVersion.current = "1.31.9";
  value.canonical = canonicalDocument("1.31.9");
  value.currentCanonicalSha = digest(value.canonical);
  value.activeCanonical = { version: "1.31.9", sha256: value.currentCanonicalSha };
}, "current");
expectedFailure("CURRENT_VERSION_REGISTRY_MISMATCH", (value) => {
  value.versions.documentVersion.current = "1.33.0";
  value.canonical = canonicalDocument("1.33.0");
  value.currentCanonicalSha = digest(value.canonical);
  value.activeCanonical = { version: "1.33.1", sha256: value.currentCanonicalSha };
}, "current");
expectedFailure("CURRENT_DIGEST_REGISTRY_MISMATCH", (value) => {
  value.versions.documentVersion.current = "1.33.0";
  value.canonical = canonicalDocument("1.33.0");
  value.currentCanonicalSha = digest(value.canonical);
  value.activeCanonical = { version: "1.33.0", sha256: "0".repeat(64) };
}, "current");
expectedFailure("MALFORMED_SEMVER", (value) => {
  value.versions.documentVersion.current = "1.33";
  value.canonical = canonicalDocument("1.33");
  value.currentCanonicalSha = digest(value.canonical);
  value.activeCanonical = { version: "1.33", sha256: value.currentCanonicalSha };
}, "current");
expectedFailure("MISSING_HISTORICAL_FIELD", (value) => { delete value.versions.canonicalPhaseG4Google.documentCurrent; });

const passed = checks.filter((entry) => entry.result === "PASS").length;
console.log(JSON.stringify({ phase: "P0_0_1_G4_HISTORICAL_VERIFIER_FORWARD_COMPATIBILITY", status: failures.length === 0 ? "PASS" : "FAIL", checks: checks.length, passed, failed: failures }));
if (failures.length > 0) process.exitCode = 1;
