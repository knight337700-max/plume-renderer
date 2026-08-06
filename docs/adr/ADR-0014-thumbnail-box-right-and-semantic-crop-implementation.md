# ADR-0014: Implement THUMBNAIL_BOX_RIGHT with explicit semantic/manual crop

- Status: Accepted
- Date: 2026-08-06
- Tags: renderer, thumbnail, crop, deterministic-output

## Context

C3 exposed placement plans but only OBJECT_RIGHT was executable. The supplied THUMBNAIL_BOX_RIGHT tool output fixes a 315×186 rounded image slot at `(666,36)` and requires a crop-aware placement contract.

## Decision [PROJECT]

Implement one `IMAGE_PRIMARY` slot with two policies: `SEMANTIC_CROP_COVER` and `MANUAL_CROP`. Resolve a direct normalized crop or an explicitly named Candidate; reject missing, conflicting, or unknown crops. Convert normalized bounds with floor/ceil exclusive edges, cover-resize deterministically, and clip the final slot to radius 12px. Apply Subject Protection before rendering and publish only on ERROR 0.

The Integration Adapter receives an injected thumbnail renderer so the serializable contract remains independent of Electron. Desktop Main supplies the Core renderer and the same bytes are used for Preview and Export. The legacy OBJECT_RIGHT callback and pipeline are not modified.

## Consequences

The Capability Registry now has two implemented profiles. Crop and Candidate provenance are visible in `AppliedImagePlacement`; source/rationale do not affect `pixelFingerprint`. Automatic subject detection and candidate generation remain intentionally out of scope.

## Alternatives rejected

- Falling back to a center crop when a plan is incomplete: rejected because it hides a contract error.
- Drawing the gray `Image` guide in final output: rejected because it is a tool guide, not creative content.
- Implementing crop behavior inside Electron UI: rejected; Main/Core and Adapter remain the security and determinism boundary.
