# ADR-0018: Simplify Crop adjustment controls to keyboard input

- **Status:** Accepted
- **Date:** 2026-08-06
- **Scope:** Renderer Lab Crop Rect UI

## Context

C5a introduced separate decimal fields and repeated fine/normal/coarse `-`/`+`
button rows below every field. The repeated controls made the Lab visually dense and
the old `0.001` native step conflicted with the requested keyboard interaction. Direct
decimal typing must remain lossless.

## Decision

Remove all custom increment/decrement buttons, their wrappers, handlers, and CSS.
Use `type=number`, `min=0`, `max=1`, `step=any`, and `inputMode=decimal`. Handle
`keydown` explicitly for both Box Right and each Multi slot:

- Arrow Up/Down: `±0.1`
- Shift + Arrow: `±0.01`
- Alt + Arrow: `±0.001`

The existing deterministic decimal string arithmetic is reused, so `0.2 + 0.1`
serializes as `0.3`. A result outside the normalized contract is rejected without
clamping or changing the current valid draft. Focused Crop inputs call
`preventDefault()` for wheel events; page scrolling outside the input remains normal.
One group-level hint describes all three keyboard steps.

## Alternatives considered

1. **Native `step=0.1`:** rejected because it produces browser `stepMismatch` for
   direct values such as `0.05` and `0.125`.
2. **Keep the repeated buttons:** rejected because the controls are redundant with
   keyboard input and obscure the four decimal fields.
3. **Clamp keyboard results:** rejected by the normalized Crop contract.
4. **Round to one decimal:** rejected because manual decimal precision must be kept.

## Consequences

- The Lab has a smaller, consistent control surface.
- Keyboard adjustment is deterministic and shared by Box and both Multi slots.
- Direct JSON and text decimal precision remains unchanged.
- Wheel scrolling cannot accidentally alter a focused Crop value.
- Core, Template Contract, Integration Contract, and Golden PNGs remain unchanged.

## Versioning

Canonical document `1.6.1 → 1.6.2` and Desktop `0.5.1 → 0.5.2` are patch changes.
Template Contract `1.3.0` and Integration Contract `1.1.0` remain unchanged.
