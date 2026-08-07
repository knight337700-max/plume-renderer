# ADR-0028 — FREEFORM text raster v1

- Status: Accepted
- Phase: F1
- Decision type: `[PROJECT]` / `[DERIVED]`

## Decision

Raster text with the pinned Spoqa font bytes and registry `fontId`; no operating-system
or remote fallback is permitted. F1 supports `NO_WRAP` and `EXPLICIT_NEWLINES` only.
Line height, horizontal alignment, vertical alignment, canonical color, and element
opacity are applied directly in pixel space. `ERROR` overflow blocks the render and
`CLIP` applies the element bounds as a clip rectangle.

The Core uses the pinned Napi Canvas PNG path already used by the Template renderer.
Its deterministic font-size baseline offset is part of the F1 implementation behavior;
it does not alter the existing Template text baselines.

## Deferred behavior

`WORD_WRAP` returns `KBR-FREEFORM-TEXT-WRAP-NOT-SUPPORTED`. Font shrinking, ellipsis,
letter-spacing reduction, and browser/CSS text layout are not allowed.

## Consequences

Text pixel output is stable on the supported Windows x64 runtime when dependency and
font bytes are fixed. Cross-OS pixel tolerance is outside the v1 acceptance boundary.
