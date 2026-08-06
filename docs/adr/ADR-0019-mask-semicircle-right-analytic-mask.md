# ADR-0019: MASK_SEMICIRCLE_RIGHT analytic mask

- Status: Accepted
- Date: 2026-08-06
- Scope: Phase C6

## Context

The reference output contains a circular image with a rectangular logo cutout, but the
reference PNG is a tool output rather than a runtime editing surface. A hand-authored
pixel copy would be difficult to audit and could drift from the frozen geometry.

## Decision

Generate a deterministic RGBA mask from the frozen circle/cutout geometry with a fixed
supersampling method, store it under `assets/masks/`, and pin its SHA-256 in
`contracts/mask-assets.json`. Multiply mask alpha by image alpha; preserve non-binary
alpha and never modify the reference fixture.

## Consequences

The renderer has a reproducible mask asset and can reject missing/tampered bytes before
publish. The generated mask is a project implementation asset, not a claim that Kakao
publishes the same internal algorithm. Any geometry change requires a new Template
Contract version and Golden review.
