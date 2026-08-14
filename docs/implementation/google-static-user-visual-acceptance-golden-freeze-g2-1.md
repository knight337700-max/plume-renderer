# Google Static user visual acceptance and Golden freeze — G2.1

Status: `COMPLETED` / `FROZEN`

## Boundary

G2.1 completed the explicit user visual decision. The exact statement
`ACCEPT_ALL_GOOGLE_G2_CANDIDATES` accepted the complete fourteen-artifact set (`ALL_14`). The
candidate registry remains historical (`CANDIDATE`, `frozen=false`, `visualAcceptance=PENDING`);
the accepted bytes are copied exactly into the separate frozen Golden scope.

## Baseline and precheck

- Baseline HEAD: `27b15aaefa2ecbe0ad37c588e395330cf1e3b28f`
- Precheck evidence: `artifacts/g2-1/precheck.json`
- G0, G0.1, G1: `PASS`
- G2: `PASS_137_OF_137`
- Frozen diagnostic emission: 11 registered IDs, public emission active, global registry deferred
- Frozen channel output changes: `0`
- Runtime network requests: `0`
- Plume dependencies: `0`

## Immutable review identity

- Candidate registry: `contracts/google/golden-candidates.g2.json`
- Preview index: `artifacts/g2/google-static-candidate-index.html`
- Candidate registry SHA-256: `5adbdd834ae9d6a7824f8991993492112f4e1d678a3427f593e240932d905226`
- Preview index SHA-256: `e0ae566bcaaa59b6c8764695758ecd0afdf1743381738699835332bc9dce77a0`
- Review manifest: `artifacts/g2-1/google-static-review-manifest.json`
- Review manifest SHA-256: `111f28635def6faf5170e7842691b18c8bb1b36e7bcf581b0f57625a9251763e`
- Manifest status: `AWAITING_USER_DECISION`
- Candidate set: 7 geometry + 7 Demand Gen uploaded display static = 14
- Artifact order: G2 frozen profile order
- Identity paths: repository-relative POSIX paths only
- Candidate bytes: pinned; no render or overwrite during review

The index provides an original artifact link, a native-size viewport, and a 2× viewport for every
candidate. The review checklist is in `artifacts/g2-1/README.md`.

## Codex visual precheck

All fourteen original artifacts were opened at the available high-resolution view. The files were
readable, their canvas dimensions and MIME values matched the candidate registry, and no blank,
corrupt, or obviously clipped artifact was found. This is only a Codex precheck; it is not user
visual acceptance.

## Acceptance and promotion

The approval statement supplied by the user was:

```text
ACCEPT_ALL_GOOGLE_G2_CANDIDATES
```

Acceptance evidence is `artifacts/g2-1/google-static-visual-acceptance.json` (SHA-256
`bacb0b133d1c833f85fb7b28b6cd0bb27d51eb669f81c7c981f895ab4a9a46b3`). The promotion copied bytes
without rerendering or recompressing. All fourteen candidate/frozen byte pairs, metadata, source
and plan digests, and three-run render outputs are equal. The frozen registry is
`contracts/google/goldens.g2.1.json` (registry version `1.0.0`, SHA-256
`00dabc5d94ffc0c225d17d22b3b5527d0b0c7488aa11495da4a79e1327d37359`) with seven geometry and
seven Demand Gen uploaded-display entries.

## Version impact and handoff

Canonical is now `1.26.0 → 1.27.0` (minor) solely for the freeze record. Architecture `1.0.0`,
candidate registry `0.1.0`, Renderer Core `0.11.0`, Validator `1.11.0`, Template `1.9.0`, Input
`1.2.0`, Output `2.0.0`, and Desktop/package `0.10.1` remain unchanged. Runtime network access,
Google upload/API, Desktop Google UI, platform-field rasterization, and Plume remain absent.

The dedicated verifier is `scripts/verify-g2-1-google-static.mjs`; the intentional freeze commit
message is `test(google): freeze accepted static goldens`. The next phase is
`G3_GOOGLE_STATIC_DESKTOP_QA_ENABLEMENT`.
