# ADR-0021: Add source-backed Naver FREEFORM image profiles

- Status: Accepted
- Date: 2026-08-10
- Scope: Renderer Core / FREEFORM FormatProfile registry

## Context

Naver Mobile DA and Image Banner 1:1 are static image artifacts with official dimensions,
MIME and byte limits. The existing FREEFORM Core already owns raster composition and
deterministic encoders; a parallel Naver renderer would duplicate behavior and risk
changing the frozen layout contract.

## Decision

Register `NAVER_MOBILE_DA` and `NAVER_IMAGE_BANNER_1_1` as `FREEFORM` +
`RENDERER_COMPOSED` + `SINGLE` profiles. Store source-backed constraints in the profile,
apply validation before/after rasterization, and leave the input CreativeLayoutPlan schema
unchanged. Feed remains a platform-composed boundary and is not flattened.

## Consequences

The profile registry and Renderer Core receive additive minor versions. Existing Kakao and
SmartChannel fingerprints and bytes remain regression gates. Desktop does not expose Naver
selectors. Source rules without an exact machine algorithm are recorded as unresolved
metadata rather than heuristic errors.
