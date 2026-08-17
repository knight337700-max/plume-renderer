# ADR-0072 — G4 Historical Change-Scope Forward Compatibility

Status: Accepted for P0.0.2 verifier maintenance  
Date: 2026-08-17

## Context

The G4 release-freeze verifier previously compared the G4 candidate source commit with the current repository `HEAD`. That made every later contract, documentation, or test addition look like a historical G4 violation. [DERIVED]

## Decision

The verifier now separates two scopes. [PROJECT]

1. The historical G4 file set is computed from the real Git range `a6ca251b400033c413a079248eeeea1756a6bc0a..bb7b622ec65180872f7fa934cd86774b30707ee2` and compared with its exact 26-path set.
2. The current repository is checked only for ancestry from `bb7b622ec65180872f7fa934cd86774b30707ee2`, protected G4 evidence byte identity, and the existing forward-compatible Canonical rule.
3. No current-`HEAD` future-path allowlist, wildcard, directory-prefix exception, or failure suppression is introduced.

The protected evidence is the user-acceptance record, external-review record, and G4 freeze registry. [PROJECT]

## Consequences

Future descendant files are not coupled to the historical G4 path set. Mutating or deleting protected evidence, changing the freeze boundary, or breaking ancestry fails closed. [DERIVED]

The frozen Canonical version, accepted pack identity, profile/golden counts, and runtime invariants remain unchanged. [INFERRED]

## Verification

P0.0.2 exercises six compatibility positives and fifteen mutation negatives using pure validation functions plus the real Git historical object range. [PROJECT]
