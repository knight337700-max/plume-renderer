# ADR-0020: Required white LOGO_PRIMARY slot

- Status: Accepted
- Date: 2026-08-06
- Scope: Phase C6

## Context

The semicircle template exposes a logo cutout, while no approved Kakao icon source or
digest is available. Recoloring arbitrary input or inventing an icon would hide an asset
approval blocker.

## Decision

Require a user-supplied PNG `LOGO_PRIMARY` with alpha and transparent background. Trim at
alpha >= 1, inspect visible pixels at alpha >= 8, require RGB >= 240, and place the result
with CONTAIN/CENTER inside safe box `(847,24,126,44)`. Source must be deterministic;
crop, focal point, candidate, recolor, and fallback are forbidden. Register all invalid
conditions in the KBR error registry and block the complete artifact.

## Consequences

Valid white logo bytes are preserved as supplied and are represented in manifests and
applied placement metadata. CTA icons remain unresolved and CTA mode remains NONE-only;
this logo slot is not an approved CTA asset.
