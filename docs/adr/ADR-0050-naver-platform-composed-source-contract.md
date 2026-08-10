# ADR-0050: Freeze NAVER Platform-Composed Source Contracts

- Status: Accepted
- Date: 2026-08-10
- Phase: N5

## Context

NAVER GFA guides publish source fields and asset requirements for Native, Shopping News,
Communication Ad, and Mobile DA Feed placements, but the platform owns the final native/feed
composition. Flattening those inputs into the local raster Integration Contract would invent
coordinates and would make a platform-generated UI appear deterministic when it is not.

## Decision

Introduce a standalone `PlatformComposedSourceSpec` and a source-profile registry. Freeze
the five official page/attachment revisions and validate only source semantics. Reject final
canvas/coordinate/UI/pixel-fingerprint fields. Keep `finalPresentationOwner` as
`NAVER_PLATFORM`, `runtimeStatus` contract-only/deferred, and preserve the existing
`LayoutMode` axis. Use deterministic NFC normalization and sorted source validation issues.

## Consequences

Positive:

- Official source evidence is reproducible through pinned PDF hashes.
- Source validation can be implemented without claiming a final NAVER UI.
- Existing Kakao, FREEFORM, and SmartChannel raster contracts remain compatible.

Tradeoffs:

- A valid source payload is not a PNG and cannot be downloaded or uploaded by this phase.
- CTA enums, native safe areas, and platform geometry remain explicit unresolved blockers.
- Video and collection require N6/runtime work.

## Alternatives rejected

- Adding a new `LayoutMode`: rejected; composition ownership is orthogonal to layout mode.
- Copying final coordinates from screenshots/PDF illustrations: rejected; not a stable official
  pixel contract.
- Guessing CTA labels or creating icons: rejected; source lists/assets are incomplete.
- Changing the generic Integration Contract: rejected; N5 SourceSpec is intentionally separate.

## Verification

`node scripts/verify-naver-platform-composed-contract.mjs` checks five attachment hashes,
source/profile identity, no final geometry, feed safe areas, no new LayoutMode, runtime
network prohibition, and version alignment. Existing `verify-contract`, integration,
FREEFORM, SmartChannel, and golden checks remain mandatory.
