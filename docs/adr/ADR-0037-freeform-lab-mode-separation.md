# ADR-0037: Separate Template Locked and Freeform Renderer Lab modes

- Status: Accepted
- Date: 2026-08-08
- Scope: Desktop Renderer Lab UI

## Context

The existing Template Locked editor exposes fixed 1029×258 Kakao Bizboard controls and
has regression Goldens. F3A adds fixed-canvas FREEFORM Profiles and JPEG output, but those
controls have different semantics and cannot safely be mixed into the template form.

## Decision

Add an explicit `TEMPLATE_LOCKED | FREEFORM` mode selector. Keep the existing Template
Locked component and state path unchanged. Render a separate Freeform editor component
that sends a strict `layoutMode: FREEFORM` payload through the existing IPC bridge.

The controller dispatches the Freeform branch to the existing Core `renderFreeform`
function for both preview and publish. No UI raster implementation or Template slot
translation is introduced.

## Consequences

- Existing four Template workflows retain their selectors, coordinates, and Golden bytes.
- Freeform can evolve independently while sharing asset token security and Core Validator.
- Switching modes does not imply that a Template plan is a valid Freeform plan (or vice versa).
- The Desktop package receives a minor version bump from 0.7.1 to 0.8.0.
