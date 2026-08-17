# ADR-0071 — G4 Historical Verifier Forward Compatibility (P0.0.1)

- Status: Accepted
- Phase: `P0_0_1_G4_HISTORICAL_VERIFIER_FORWARD_COMPATIBILITY`
- Date: 2026-08-17

## Decision

Separate the immutable G4 snapshot assertions from validation of the current
Canonical document. The historical layer continues to require the exact G4
version, digest, candidate source, accepted pack, and frozen cardinalities. The
current layer accepts valid SemVer at or above `1.32.0` and requires the current
document version and digest to match the active version registry.

The baseline repository has no separate active digest field because its current
Canonical is still the frozen `1.32.0` snapshot. The verifier therefore uses an
explicit, exact baseline fallback only for that state; a future version requires
an active `{ version, sha256 }` record. No wildcard, warning downgrade, skip, or
environment bypass is introduced.

## Consequences

`pnpm verify:g4-google` remains strict about every G4 historical fact while no
longer coupling future Canonical versions to the historical `1.32.0` value.
`verify:p0-0-1` proves the baseline, synthetic `1.33.0`, and a higher SemVer,
plus ten expected-failure mutations. Canonical, freeze records, runtime source,
outputs, and Goldens remain unchanged.
