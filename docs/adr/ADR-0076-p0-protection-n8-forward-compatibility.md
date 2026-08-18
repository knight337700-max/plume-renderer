# ADR-0076: P0 protection and N8 forward compatibility

- Status: Candidate maintenance, uncommitted
- Scope: P0.0.5 verifier compatibility closure

## Decision

1. G0.1 historical runtime absence is evaluated from the exact `731b956e...`
   accepted tree, but only in structurally defined production runtime roots and
   active profile registries. Documentation, architecture contracts, freeze
   evidence, and verifier sources are not runtime implementations.
2. The P0 verifier protects the G0.1 verifier by semantic assertions and exact
   frozen artifact digests rather than source-byte equality. Historical commit,
   ancestry, Canonical digest, accepted pack identity, and negative cases remain
   fail-closed.
3. N8 preserves its historical version policy and validates the active Canonical
   through the shared strict SemVer/active-registry/digest helper. A valid active
   Canonical at or above the historical minimum is accepted without a version
   allowlist.
4. No Renderer, Validator, Desktop production behavior, runtime dependency,
   Golden, output pack, commit, or handoff is changed in this phase.

## Evidence

`scripts/verify-p0-0-5-protection-n8-compatibility.mjs` runs the actual G0.1,
P0, N8, P0.0.4, Kakao, and Naver verifiers and exercises positive and expected-
failure mutations for runtime scope, protected artifacts, Canonical registry,
SemVer, and ancestry.

The P0 candidate remains intentionally dirty and the final atomic P0 commit is
deferred.
