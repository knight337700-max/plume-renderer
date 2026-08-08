# ADR-0041: Keep FREEFORM image presets in Desktop manual authoring

- Status: Accepted
- Date: 2026-08-08
- Classification: `[PROJECT]`
- Scope: Desktop FREEFORM editor only

## Context

The Desktop element factory placed every new IMAGE in a right-side rectangle. Those
coordinates and the generated 10/20/30 zIndex sequence were not Kakao official values and
were not required by the frozen FREEFORM Contract. Treating that example as a runtime
default made a layout decision before the user or an imported Plan did.

`FILL_CANVAS` also requires a crop when source and canvas aspect ratios differ. Moving that
choice into Core would violate the rule that FREEFORM executes explicit Plan geometry and
does not infer a layout or crop.

## Decision

Use full-canvas `CENTER_CONTAIN`, zIndex `0`, and opacity `1` as the neutral new-IMAGE
authoring state. Provide Fit, Fill, and Reset as explicit, one-shot Desktop buttons.

Fit and Reset write full bounds with a fresh `CENTER_CONTAIN` placement. Reset preserves
zIndex and opacity. Fill uses the selected asset's actual oriented dimensions and the
selected Registry Profile canvas to calculate a centered normalized crop, then writes a
fresh `MANUAL_CROP` placement into `CreativeLayoutPlan`. The calculation preserves runtime
floating-point precision and does not use `toFixed`.

Imported and Agent plans are never normalized to the new default. They change only when a
user clicks a preset. Presets use the same Plan update/stale path as direct geometry edits.

## Consequences

- Renderer, raster, validator, encoder, fingerprint, FormatProfile, and schema semantics do
  not change.
- Canvas Fit can intentionally show margins; Fill can intentionally crop source pixels.
- Safe Zone findings remain Validator/manual-review results and do not alter preset output.
- Same-zIndex composition stays deterministic through original array order.
- Desktop advances from `0.8.1` to `0.8.2`; Canonical `1.11.0`, Integration `1.6.0`, Template
  `1.6.0`, and CreativeLayoutPlan `1.0.0` remain unchanged.
