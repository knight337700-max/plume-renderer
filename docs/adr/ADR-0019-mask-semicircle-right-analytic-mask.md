# ADR-0019: MASK_SEMICIRCLE_RIGHT restored analytic mask

- Status: Accepted; supersedes the C6 cutout implementation
- Date: 2026-08-07
- Scope: Phase C6b

## Context

The immutable reference image includes a `logo` guide at the upper right. The prior C6
implementation treated that guide as a rectangular mask cutout, which broke the visible
semicircle when no logo was supplied. The guide is not a shape instruction and is not an
approved Kakao asset.

## Decision

Generate a deterministic RGBA mask from the frozen circle `(801,225,r=180)` only, using
the existing 8x supersampling pass and metadata stripping. The mask is applied to
`IMAGE_PRIMARY` at `(621,45,360,213)`. The logo guide is never subtracted from the mask;
the restored region is the same analytic arc that continues the existing shape. Pin the
runtime mask SHA-256 and validate it before rendering.

## Consequences

The runtime mask digest changes, and the C6b MASK Golden changes accordingly. A malformed
or tampered mask blocks Preview and Export. The immutable guide PNG remains read-only and
is not used as a runtime mask. LOGO_PRIMARY is composited later as an independent overlay
so its presence cannot alter the semicircle alpha.
