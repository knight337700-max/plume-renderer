# ADR-0031: FREEFORM applied-element integrity

- Status: Accepted
- Date: 2026-08-08
- Scope: `[PROJECT]` FREEFORM Validator F2

## Context

The manifest's `appliedElements` is evidence of what the raster path applied. If it is
recomputed by a second approximation, the PNG, manifest, and validator can disagree while
each appears locally valid.

## Decision

The raster path creates the single `appliedElements` source of truth. Each entry records the
actual element ID/type, normalized bounds, integer destination pixel rectangle, z-index and
original index, opacity, asset and font digests, placement policy, requested/resolved crop,
text metrics/color/wrap/overflow and clip flags where applicable. POST_RENDER validates count,
stable order, identity, bounds, crop, digest and canvas containment against the frozen Plan and
resolved asset metadata. A mismatch emits a stable `KBR-FREEFORM-APPLIED-*` error and blocks
publish.

The deterministic normalized-to-pixel conversion and existing F1 contain/crop calculations
are reused; no crop or layout is inferred by the Validator.

## Consequences

Manifest evidence is auditable and tamper detection is deterministic. The F1 basic PNG bytes
and all Template Locked Goldens remain unchanged. Additive evidence fields do not require a
public schema version bump in F2.

## Alternatives rejected

- Recompute approximate rectangles in the manifest: creates split sources of truth.
- Trust caller-supplied applied elements: allows tampered evidence.
- Validate only PNG dimensions: misses asset/crop/font evidence drift.
