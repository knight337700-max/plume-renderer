# ADR-0075: Preserve Historical Freezes Across the Existing P0 Candidate

## Status

Accepted for P0.0.4 compatibility remediation. This ADR does not complete P0 and does not start P1.

## Context

The existing P0 candidate is intentionally uncommitted and advances the active Canonical document to 1.33.0. Three historical checks incorrectly treated the current worktree or a fixed historical version as the only valid state. The candidate itself, its contracts, matrix, fixtures, production sources, and package manifest must remain byte-identical.

## Decision

1. G0.1 historical runtime absence is evaluated from the exact accepted G0.1 Git tree (`731b956e69700154a8b8e1c51ec9a2b7973aa07f`), with no current-head or future-path allowlist.
2. Freeform and Naver keep their historical exact branches, while current Canonical acceptance uses the shared strict SemVer transition and active registry/digest validation.
3. Freeform dependency checks inspect runtime package dependencies and production import text only; verifier script names are not runtime dependencies.
4. P0.0.4 uses an external candidate SHA manifest and contract-only expected-failure proof. It does not regenerate or alter the P0 candidate.

## Compatibility and safety

The historical freeze commit, changed-path set, protected artifacts, frozen outputs, and accepted pack remain exact. Unknown versions, digest mismatches, downgrade, ancestry breaks, path mutations, Plume runtime references, live Plume calls, and wildcard policies fail closed. No renderer, validator, desktop, network, or package runtime behavior is changed.

## Consequences

The P0 candidate remains dirty and is not included in the P0.0.4 commit. Handoff regeneration is deferred to P0 finalization. A separate compatibility commit contains only verifier, regression-test, and P0.0.4 documentation changes.
