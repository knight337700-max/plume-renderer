# G4 Google Static User Acceptance and Release Freeze

## Scope

G4 records the explicit user acceptance of the G3.2.3 output pack and freezes the
Google Static release baseline. It does not regenerate, modify, or reclassify the
G3.2.3 review pack, and it does not change Renderer Core, Validator, Desktop UI,
profiles, placement policy, or Golden bytes.

## Accepted candidate

- Candidate source HEAD: `a6ca251b400033c413a079248eeeea1756a6bc0a`
- Pack: `google-g3-2-3-final-output-pack-a6ca251b-20260816T150151284Z-final.zip`
- Pack SHA-256: `8ea80cda80f53347a08d89cadaaf5501a73fb5b687e2724fc90e111ac32d8ffa`
- Pack bytes: `9220434`
- ZIP entries: `255`; payload files: `213`
- Generation ID: `g3-2-3-working-20260816T150151284Z`
- Pack evidence class remains `NON_NORMATIVE_REVIEW_EVIDENCE`.

The user decision is recorded in
`artifacts/g4/google-static-user-acceptance.json`. The independent external review
record is `artifacts/g4/google-static-external-review.json`; its supplied review
result is 3044/3044 PASS, with 24/24 required cases and 32/32 output artifacts.

## Freeze decisions

`contracts/google/release-freeze.g4.json` is the normative G4 registry. It freezes
the fourteen existing Google profiles, fourteen G2.1 Golden identities, PNG/JPEG
export formats, Preview Fit/Actual behavior, pass-only export, stale invalidation,
Uploaded Display Static control lock, and runtime network requests at zero.

The Canonical document advances from `1.31.1` to `1.32.0` (minor) solely to record
acceptance and release freeze. Desktop/package `0.13.1`, Renderer Core `0.11.0`,
Validator `1.11.0`, Google export manifest `1.1.0`, Template `1.9.0`, and Golden
registry `1.0.0` remain unchanged. KAKAO, NAVER, META, and Google frozen outputs
remain unchanged.

## Verification boundary

`scripts/verify-g4-google-static-release-freeze.mjs` checks the three G4 records,
their digests and identity, Canonical/version references, profile and Golden sets,
historical G3.1 and G2.1 digests, path privacy, and the allowed-change boundary.
The G4 contract test provides a second machine-readable check of record linkage and
profile/Golden cardinality. Existing historical verifiers remain strict about their
own phase records while accepting the frozen G4 document version as a later
compatibility state.

Any future change requires a new Canonical version, new candidate, complete
regression, and new explicit user acceptance. G5 is not started by G4.
