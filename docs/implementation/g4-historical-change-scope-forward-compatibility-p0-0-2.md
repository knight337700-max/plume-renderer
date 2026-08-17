# P0.0.2 Implementation Record — G4 Historical Change Scope

## Scope

This phase changes verifier maintenance only. Renderer, Validator, Desktop runtime, canonical contracts, frozen artifacts, and output packs are untouched. [PROJECT]

## Historical boundary

`a6ca251b400033c413a079248eeeea1756a6bc0a..bb7b622ec65180872f7fa934cd86774b30707ee2` is the only historical diff used by G4. The actual Git object range contains 26 paths, and the verifier compares the normalized set exactly. [DERIVED]

## Current-state checks

The current `HEAD` must be a descendant of the G4 freeze commit. The following files remain byte protected: [PROJECT]

- `artifacts/g4/google-static-user-acceptance.json`
- `artifacts/g4/google-static-external-review.json`
- `contracts/google/release-freeze.g4.json`

The existing Canonical forward rule remains valid SemVer greater than or equal to 1.32.0 with a consistent active registry and digest. [INFERRED]

## Compatibility proof

The dedicated verifier covers the current baseline, future descendant states, future benign files, exact historical paths, higher Canonical versions, and fifteen expected-failure mutations. No repository mutation or temporary artifact is retained by the proof. [PROJECT]

## Audit result

G4 assertion count increases from 26 to 31. P0.0.1 remains at 13. Historical exact-path, current ancestry, protected-artifact, and no-current-head-allowlist assertions are present; no protected assertion, failure condition, or test was removed. [DERIVED]
