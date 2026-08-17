/**
 * Verifier-only Canonical SemVer compatibility rules.
 *
 * This module deliberately has no renderer/runtime dependencies.  Historical
 * snapshots are supplied by the caller; the active transition is validated
 * independently so a new phase does not need a new hard-coded version branch.
 */

const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/u;

export function parseCanonicalSemVer(value) {
  if (typeof value !== "string") return null;
  const match = SEMVER_PATTERN.exec(value);
  if (!match) return null;
  const prerelease = match[4]
    ? match[4].split(".").map((identifier) => (/^\d+$/u.test(identifier) ? Number(identifier) : identifier))
    : [];
  if (prerelease.some((identifier, index) => typeof identifier === "number" && (!Number.isSafeInteger(identifier) || /^0\d+$/u.test(match[4].split(".")[index])))) return null;
  return {
    raw: value,
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease,
    build: match[5] ? match[5].split(".") : [],
  };
}

export function compareCanonicalSemVer(left, right) {
  const a = typeof left === "string" ? parseCanonicalSemVer(left) : left;
  const b = typeof right === "string" ? parseCanonicalSemVer(right) : right;
  if (!a || !b) throw new Error("invalid canonical semver");
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

export function classifyCanonicalTransition(previous, current, bump) {
  const previousSemVer = parseCanonicalSemVer(previous);
  const currentSemVer = parseCanonicalSemVer(current);
  const errors = [];
  if (!previousSemVer || !currentSemVer) errors.push("previous/current canonical version is not valid semver");
  if (!["none", "patch", "minor", "major"].includes(bump)) errors.push("canonical bump must be none, patch, minor, or major");
  if (errors.length > 0) return { valid: false, errors, previous: previousSemVer, current: currentSemVer };

  const order = compareCanonicalSemVer(previousSemVer, currentSemVer);
  if (order > 0) errors.push("canonical version downgrade is not allowed");
  if (bump === "none") {
    if (order !== 0 || previousSemVer.raw !== currentSemVer.raw) errors.push("bump none requires an unchanged version");
  } else if (order === 0) {
    errors.push("a changed canonical phase requires current to be greater than previous");
  } else if (bump === "patch") {
    if (currentSemVer.major !== previousSemVer.major || currentSemVer.minor !== previousSemVer.minor || currentSemVer.patch <= previousSemVer.patch) {
      errors.push("patch bump requires the same major/minor and an increased patch");
    }
  } else if (bump === "minor") {
    if (currentSemVer.major !== previousSemVer.major || currentSemVer.minor <= previousSemVer.minor || currentSemVer.patch !== 0) {
      errors.push("minor bump requires an increased minor and a zero current patch");
    }
  } else if (bump === "major") {
    if (currentSemVer.major <= previousSemVer.major || currentSemVer.minor !== 0 || currentSemVer.patch !== 0) {
      errors.push("major bump requires an increased major and zero current minor/patch");
    }
  }
  return { valid: errors.length === 0, errors, previous: previousSemVer, current: currentSemVer, order };
}

export function validateCanonicalTransition({ documentVersion } = {}) {
  const previous = documentVersion?.previous;
  const current = documentVersion?.current;
  const bump = documentVersion?.bump;
  if (typeof previous !== "string" || typeof current !== "string" || typeof bump !== "string") {
    return { valid: false, errors: ["documentVersion.previous, current, and bump are required"] };
  }
  return classifyCanonicalTransition(previous, current, bump);
}

export function resolveActiveCanonical({ versions, currentCanonicalSha, historicalFallback } = {}) {
  const explicit = versions?.activeCanonical ?? versions?.currentCanonical;
  if (explicit) return explicit;
  if (historicalFallback && versions?.documentVersion?.current === historicalFallback.version && currentCanonicalSha === historicalFallback.sha256) {
    return { version: historicalFallback.version, sha256: historicalFallback.sha256, source: "HISTORICAL_FALLBACK" };
  }
  return null;
}

export function validateActiveCanonicalState({
  versions,
  canonical,
  currentCanonicalSha,
  activeCanonical,
  historicalMinimumVersion,
  historicalFallback,
} = {}) {
  const errors = [];
  const transition = validateCanonicalTransition({ documentVersion: versions?.documentVersion });
  errors.push(...(transition.errors ?? []));
  const currentVersion = versions?.documentVersion?.current;
  const parsedCurrent = parseCanonicalSemVer(currentVersion);
  const parsedMinimum = parseCanonicalSemVer(historicalMinimumVersion);
  if (!parsedCurrent) errors.push("current canonical version is not valid semver");
  if (parsedCurrent && parsedMinimum && compareCanonicalSemVer(parsedCurrent, parsedMinimum) < 0) errors.push("current canonical version is below the historical frozen version");
  if (typeof canonical !== "string" || !canonical.includes(`Document version:** ${currentVersion}`)) errors.push("current canonical document version marker mismatch");
  if (typeof currentCanonicalSha !== "string" || !/^[a-f0-9]{64}$/u.test(currentCanonicalSha)) errors.push("current canonical digest is missing or malformed");
  const resolved = activeCanonical ?? resolveActiveCanonical({ versions, currentCanonicalSha, historicalFallback });
  if (!resolved || resolved.version !== currentVersion) errors.push("current canonical version and active registry version mismatch");
  if (!resolved || resolved.sha256 !== currentCanonicalSha) errors.push("current canonical digest and active registry digest mismatch");
  return { valid: errors.length === 0, errors, transition, activeCanonical: resolved };
}

export function validateG01HistoricalSnapshot({ phase, registry, evidence, expected } = {}) {
  const errors = [];
  const exact = expected ?? {
    phase: "G0_1_GOOGLE_ARCHITECTURE_ACCEPTANCE_AND_FREEZE",
    documentPrevious: "1.23.1",
    documentCurrent: "1.24.0",
    documentBump: "minor",
    googleArchitectureVersion: "1.0.0",
    registryVersion: "1.0.0",
    registryStatus: "FROZEN",
    evidenceStatus: "PASS",
    evidenceArchitectureStatus: "FROZEN",
  };
  if (phase?.phase !== exact.phase || phase?.documentPrevious !== exact.documentPrevious || phase?.documentCurrent !== exact.documentCurrent || phase?.documentBump !== exact.documentBump) errors.push("G0.1 historical canonical snapshot mismatch");
  if (registry?.registryVersion !== exact.registryVersion || registry?.status !== exact.registryStatus || registry?.googleArchitectureVersion !== exact.googleArchitectureVersion) errors.push("G0.1 historical registry snapshot mismatch");
  if (evidence && (evidence?.status !== exact.evidenceStatus || evidence?.architectureStatus !== exact.evidenceArchitectureStatus || evidence?.phase !== exact.phase)) errors.push("G0.1 historical evidence snapshot mismatch");
  return { valid: errors.length === 0, errors };
}

export const canonicalSemVerPolicy = Object.freeze({
  strict: true,
  prereleaseAndBuildMetadata: "SUPPORTED_AS_SEMVER",
  minorPatchReset: true,
  majorMinorPatchReset: true,
});
