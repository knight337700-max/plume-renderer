# G4 Historical Verifier Forward Compatibility — P0.0.1

## Scope

This maintenance phase resolves the verifier coupling discovered before the P0
architecture freeze. It changes only the G4 verifier, its in-memory compatibility
proof, the package script, and this documentation. P0 contract/architecture work
and P1 remain unstarted.

## Verification model

`validateHistoricalSnapshot` protects the frozen G4 facts: Canonical `1.32.0`
and its SHA-256, candidate source HEAD, accepted pack identity, and fourteen
profile/fourteen Golden cardinalities. `validateCurrentCanonicalState` validates
the current document as SemVer, requires it to be greater than or equal to
`1.32.0`, and checks its version and SHA-256 against the active registry.

The current `1.32.0` baseline uses the exact frozen digest as the only explicit
fallback. Synthetic future fixtures provide an active version/digest pair and
prove that the rule is not an allowlist for `1.33.0`.

## Evidence

- `pnpm verify:g4-google`: 26/26 PASS after revision.
- `pnpm verify:p0-0-1`: 13/13 PASS (3 positive cases and 10 expected failures).
- No Canonical, G4 freeze registry, accepted pack, runtime source, Golden, or
  production dependency was changed.
- No retry, skip, suppression, wildcard, or generic allowlist was added.
