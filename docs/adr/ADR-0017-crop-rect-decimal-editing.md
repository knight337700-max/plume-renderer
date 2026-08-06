# ADR-0017: Crop Rect decimal editing

- **Status:** Accepted
- **Date:** 2026-08-06
- **Scope:** Renderer Lab UI and normalized Crop Rect input path

## Context

The C5 Core already accepted normalized floating-point Crop Rect values, but the Lab
offered only a tuple input. A number-only React state would also destroy intermediate
values such as `""` and `"0."`. C5a must enable fine crop adjustments without changing
template coordinates, pixel conversion, or Golden output.

## Decision

Use per-field string edit buffers for `x`, `y`, `width`, and `height` in
`THUMBNAIL_BOX_RIGHT` and both `THUMBNAIL_MULTI_RIGHT` slots. A complete finite decimal
draft is validated with the existing `NORMALIZED_EPSILON=1e-9` contract before it can
replace the current Plan. Invalid or incomplete input is shown as an error and never
clamped or silently restored.

The UI uses `type=number`, `min=0`, `max=1`, `step=0.001`, and `inputMode=decimal`.
Nudges are fixed at fine `0.0001`, normal `0.001`, and coarse `0.01`; Shift/Alt Arrow
shortcuts select fine/coarse. Direct UI typing accepts at least six decimal places and
does not round values. Because the existing JSON Schema already uses `number`, the
Contract continues to accept any finite JSON number in bounds; no
`KBR-CROP-PRECISION-EXCEEDED` code is introduced.

The existing normalized-to-pixel conversion remains:

```text
left=floor(x*sourceWidth)
top=floor(y*sourceHeight)
right=ceil((x+width)*sourceWidth)
bottom=ceil((y+height)*sourceHeight)
```

Request fingerprints continue to include normalized decimal input. The existing
pixelFingerprint implementation is not redefined in this patch.

## Alternatives considered

1. **Hard six-decimal Contract limit:** rejected because the current schema already
   allows finite numbers and narrowing compatibility would require a new error contract.
2. **Round every input to six places:** rejected because it loses user data and violates
   the no-rounding rule.
3. **Change Core pixel math:** rejected because Core already preserves decimals through
   floor/ceil conversion and C5 Golden regression must remain byte-equal.
4. **Canvas drag editor:** deferred; C5a only clarifies deterministic numeric editing.

## Consequences

- Box and Multi slot edits can move/resize crops at pixel-visible increments.
- Manual and Agent Plans share the same JSON parser/serializer.
- OBJECT_RIGHT remains unchanged and exposes no Crop controls.
- Decimal E2E and packaged smoke coverage is required in addition to existing Golden
  tests.

## Versioning

Canonical document `1.6.0 → 1.6.1` and Desktop `0.5.0 → 0.5.1` are patch changes.
Template Contract `1.3.0` and Integration Contract `1.1.0` remain unchanged.
