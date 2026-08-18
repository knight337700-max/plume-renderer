# P0.0.4 Implementation Record

## Scope

P0.0.4 repairs historical-verifier compatibility around the already-created P0 candidate. The candidate is read from its external pre-edit SHA manifest and is never regenerated.

## Implemented remediation

- `verify-g0-1-google-architecture-freeze.mjs` reads the accepted G0.1 commit tree for the historical Google-runtime absence assertion. The check uses the exact snapshot and does not authorize current-tree directory prefixes or wildcards.
- `verify-freeform-contract.mjs` and `verify-naver-freeform-contract.mjs` preserve historical assertions and validate the active Canonical document through the shared strict SemVer/registry/digest helper.
- Freeform dependency validation is limited to runtime dependencies and production source imports; verifier scripts remain outside that boundary.
- `verify-p0-0-4-candidate-compatibility.mjs` proves candidate preservation, the actual 1.33.0 registry state, G4 historical exactness, P0.0.3/P0.0.2 expected-failure coverage, and fail-closed dependency/path mutations.

## Verification evidence

The dedicated verifier reports 13/13 positive and 16/16 expected-failure cases. The candidate manifest contains 33 files and every candidate byte/hash remains unchanged. The P0.0.4 Vitest test invokes the dedicated verifier directly. The P0 candidate remains an intentionally dirty, unstaged state; no handoff is regenerated.

## Non-goals

No P0 contract, matrix, schema, fixture, Canonical candidate, package manifest, renderer, validator, desktop runtime, asset, Golden, output pack, or production dependency is changed.
