# ADR-0020: Optional LOGO_PRIMARY overlay slot

- Status: Accepted; supersedes the black-only C6 v2 slot decision
- Date: 2026-08-07
- Scope: Phase C6b

## Context

The semicircle reference has a logo placement guide, but the guide must not carve the
image shape. C6 v2 also imposed a black-only restriction that rejected valid white and
brand-color transparent logos. The renderer needs deterministic optional overlay behavior
without inventing or recoloring assets.

## Decision

`IMAGE_PRIMARY` remains required and `LOGO_PRIMARY` is an optional separate overlay slot.
When present, the logo must be a PNG with an alpha channel and transparent background;
there is no color restriction. Black, white, and brand-color pixels are preserved exactly.
The plan is fixed to `ALPHA_TRIM_CONTAIN`, `CONTAIN`, `CENTER`, `DETERMINISTIC` inside
safe box `(847,24,126,44)` and maximum upscale `1.5x`. Crop rectangles, candidates,
focal points, manual movement, rotation, fallback, and automatic recolor are forbidden.

No logo is a valid PASS and produces one applied placement. A logo asset without a plan is
`KBR-LOGO-PLAN-MISSING`; a plan without an asset is `KBR-LOGO-ASSET-MISSING`. Opaque and
empty logos are blocked by their dedicated errors. `KBR-LOGO-COLOR-NOT-BLACK`,
`blackMonochromeRequired`, `whiteMonochromeRequired`, and `blackValidation` are not part
of the current contract.

## Consequences

Composition order is image mask first, logo overlay second, then validation. The output
schema no longer exposes black-validation metadata. Integration Contract advances from
`1.3.0` to `1.4.0`; Template Contract advances from `1.5.0` to `1.6.0`; the Canonical
document advances from `1.8.0` to `1.9.0`; Desktop advances from `0.7.0` to `0.7.1`.
The CTA registry remains `NONE` only and this logo slot is not a CTA asset.
