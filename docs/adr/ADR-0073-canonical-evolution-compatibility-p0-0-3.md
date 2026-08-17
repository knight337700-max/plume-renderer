# ADR-0073: Generalize Canonical evolution compatibility without reopening freezes

- Status: Accepted for verifier maintenance
- Date: 2026-08-17
- Scope: P0.0.3 Canonical evolution compatibility consolidation

## Context

The G0.1 historical verifier had accumulated a compatibility branch tied to the
current Canonical version `1.32.0`. The general contract verifier likewise used
an exact list of the most recent version transitions. Those checks protected old
records, but they made a valid future Canonical transition fail before the P0
architecture contract could be reviewed.

## Decision

1. Historical freeze records remain exact snapshots. Their version, status,
   provenance, protected paths, and digests are not replaced by a generic rule.
2. The active Canonical transition is validated by the verifier-only helper at
   `scripts/lib/canonical-semver-compatibility.mjs`.
3. The active rule requires `previous`, `current`, and `bump`, valid SemVer,
   non-downgrade ordering, and a bump that matches the actual major/minor/patch
   transition. Minor and major transitions use the repository's zero-reset
   convention.
4. The active document marker, active contract-version registry version, and
   active registry SHA-256 must agree. The G4 historical value is a fallback only
   while the repository still has the frozen version and digest.
5. No renderer, validator, Desktop, asset, Golden, or runtime dependency changes
   are introduced by this phase.

## Consequences

- A future `1.33.0` or higher valid transition does not require a new string
  allowlist entry.
- G0.1, G4, and the contract verifier continue to fail closed on tampering,
  malformed versions, downgrade, registry mismatch, and digest mismatch.
- P0 architecture work is not started by this ADR; the next action is to reissue
  P0 from the post-maintenance baseline.

## Verification

`pnpm verify:p0-0-3` executes eight positive and fourteen negative compatibility
fixtures and audits the thirteen historical verifiers for active pins and global
current-HEAD path gates. The historical G0.1 canonical snapshot is derived from
its exact freeze commit (`ef807153c1143966a3f6d83bf01704bf1d2ad206`) and checked
against its parent boundary and bytes.

**[PROJECT]**
