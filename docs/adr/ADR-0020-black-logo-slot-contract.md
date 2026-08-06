# ADR-0020: Optional black LOGO_PRIMARY slot

- Status: Accepted
- Date: 2026-08-06
- Scope: Phase C6 v2

## Context

The semicircle template has a logo guide in its reference image, but the final canvas is
transparent and the v2 product decision allows a result without a logo. A white logo would
also be low-contrast on the intended white preview backdrop. The renderer must therefore
accept a user-supplied black transparent PNG without inventing or recoloring an asset.

## Decision

`IMAGE_PRIMARY` remains required. `LOGO_PRIMARY` is a separate optional slot. If supplied,
the logo must be a PNG with an alpha channel, transparent background, and visible pixels
whose RGB channels are each `<= 32` when `alpha >= 8`. It is trimmed at `alpha >= 1` and
placed with deterministic `ALPHA_TRIM_CONTAIN`, `CONTAIN`, and `CENTER` inside safe box
`(847,24,126,44)`, with maximum upscale `1.5x`. Crop rectangles, candidates, focal points,
manual movement, rotation, fallback, and automatic recolor are forbidden.

No logo is a valid PASS; the cutout remains transparent. An asset without a logo plan is
`KBR-LOGO-PLAN-MISSING`; a logo plan without an asset is `KBR-LOGO-ASSET-MISSING`.
Invalid logo pixels return `KBR-LOGO-COLOR-NOT-BLACK` and are never transformed.

## Consequences

Applied placement metadata uses `blackValidation` when a logo is present. The manifest has
one image placement in no-logo mode and image-plus-logo placements when supplied. Existing
semicircle geometry, mask digest, and previous template Golden bytes remain unchanged. The
Template Contract advances from `1.4.0` to `1.5.0`, the Integration Contract from `1.2.0`
to `1.3.0`, and the Desktop app from `0.6.0` to `0.7.0`; the Canonical document advances
from `1.7.0` to `1.8.0`.

The logo slot is not a Kakao CTA asset. CTA mode remains `NONE` only until approved icon
assets and their compatibility matrix are available.
