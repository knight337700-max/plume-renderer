# ADR-0062 — Google static visual acceptance gate before Golden freeze (G2.1)

- Status: Accepted and implemented — Golden registry frozen
- Date: 2026-08-14
- Decision owner: Local Renderer Project
- Supersedes: none

## Context

G2 produced fourteen deterministic Google static candidate artifacts. Automated rendering and
validation can prove bytes, dimensions, MIME, and diagnostics, but cannot substitute for the
requested user visual review. The user explicitly supplied `ACCEPT_ALL_GOOGLE_G2_CANDIDATES`.

## Decision

1. Freeze candidate identity in `artifacts/g2-1/google-static-review-manifest.json` using the
   candidate registry hash, preview index hash, repository-relative paths, artifact hashes, and
   render fingerprints.
2. Present every original candidate through the G2 index with native-size and 2× inspection
   paths. Candidate files are not regenerated or overwritten during review.
3. Require the exact user statement `ACCEPT_ALL_GOOGLE_G2_CANDIDATES`; it was received for the
   complete `ALL_14` set and is recorded in `artifacts/g2-1/google-static-visual-acceptance.json`.
4. Keep the G2 candidate registry as historical evidence and copy exact candidate bytes into
   `fixtures/golden/google/`. The frozen registry is `contracts/google/goldens.g2.1.json` v1.0.0.
5. Make the dedicated G2.1 verifier prove candidate/frozen byte equality, metadata identity, and
   three-run deterministic rerender equality for all fourteen entries.

## Consequences

Canonical advances from 1.26.0 to 1.27.0 (minor) to record the acceptance and freeze. Runtime
contracts remain unchanged. Network access, Google upload/API, Desktop Google UI, and Plume
integration remain absent. The next phase is `G3_GOOGLE_STATIC_DESKTOP_QA_ENABLEMENT`.
