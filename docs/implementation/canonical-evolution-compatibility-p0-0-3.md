# P0.0.3 Canonical evolution compatibility consolidation

## Scope

This record covers verifier-only maintenance. It does not implement P0 placement
contracts, a PLUME adapter, or any renderer/UI behavior.

## Changes

- Added `scripts/lib/canonical-semver-compatibility.mjs`, a shared pure helper
  for strict SemVer parsing/comparison, bump classification, active registry and
  digest consistency, and G0.1 historical snapshot checks.
- Replaced the G0.1 `g304Compatibility` current-version override with active
  Canonical validation while retaining the historical architecture assertions.
- Replaced the general verifier's current-root exact transition chain with a
  parsed active transition plus an independent exact historical phase snapshot.
- Added `scripts/verify-p0-0-3-canonical-compatibility.mjs`, its two focused
  tests, and the `verify:p0-0-3` package command.

## Compatibility proof

The focused verifier proves baseline `1.32.0`, minor/patch/major transitions,
higher minor transitions, a P0-like active registry state, and the exact G0.1
snapshot. It rejects downgrade, malformed/missing transition fields, wrong bump
types, document/registry version or digest mismatch, G0.1 version/digest tamper,
below-freeze current versions, and missing historical fields. Prerelease/build
metadata is supported because that is the existing G4 SemVer policy; therefore
the corresponding negative fixture is recorded as not applicable.

## Invariants

- Canonical document and `contracts/contract-versions.json` were not edited.
- G0.1/G4/P0.0.1/P0.0.2 records and protected verifiers were not edited except
  the explicitly permitted G0.1 and general contract verifier maintenance.
- Runtime source, package dependencies, output/golden bytes, and network policy
  are unchanged.
- Temporary fixtures are in-memory only; no temporary artifacts remain.

**[PROJECT]**
