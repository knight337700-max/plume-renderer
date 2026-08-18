# ADR-0074 — Neutral PLUME-to-Renderer Placement Contract Boundary

- Status: Accepted for P0 architecture freeze
- Date: 2026-08-17
- Scope: Contract and architecture only

## Context

PLUME or another authoring system may propose placement, but the standalone Renderer
must remain deterministic and independent of PLUME. The existing `ImagePlacementPlan`
and `CropCandidate` contracts are already versioned at `1.8.0` and are used by the
current renderer boundary.

## Decision

The data flow is one-way: external authoring (manual or agent) produces a candidate;
selection and validation materialize an immutable `ImagePlacementPlan`; the Renderer
consumes only that canonical data plus asset/font bytes; Validator gates publication.
`PlacementCapabilityHints 1.0.0` is a read-only authoring snapshot and
`PlacementProvenanceEnvelope 1.0.0` is optional metadata outside the core input.
Producer name/version is advisory and never selects render behavior. Frozen profile
contracts and Validator authority override conflicting hints. Unknown versions,
policies, profile/capability mismatches, digest mismatches, invalid geometry,
locked transforms, ownership mismatches, and missing references fail closed.

## Consequences

Manual and future PLUME-authored plans use the same canonical path and can be replayed
offline. No PLUME, queue, database, cloud, or runtime network dependency is introduced.
The complete active/frozen inventory is frozen as 170 rows (KAKAO 21, NAVER 132,
META STATIC 3, GOOGLE STATIC 14). Platform-composed rows remain platform-owned and
are not rasterized by this Renderer.

## Compatibility

`ImagePlacementPlan 1.8.0` and `CropCandidate 1.8.0` are reused without downgrade or
in-place redefinition. Canonical documentation advances from `1.32.0` to `1.33.0`;
Renderer Core, Validator, Desktop, template, and Google export versions are unchanged.
P1 may implement an adapter and harness, but it is not part of this decision.
