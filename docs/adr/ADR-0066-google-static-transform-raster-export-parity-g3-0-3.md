# ADR-0066: Google Static transform and raster export parity (G3.0.3)

- Status: Accepted for implementation
- Date: 2026-08-15
- Scope: Google Static Desktop QA only

## Context

G3.0.2 provided one canonical request identity for Google Preview and Export, but the production
editor still exposed only a JSON plan and one PNG-default action. Existing common placement
semantics and deterministic PNG/JPEG encoders were already implemented elsewhere in the module.

## Decision

1. Reuse `ImagePlacementPlan` for manual marketing placement. X/Y are normalized crop center
   values and Scale is encoded by normalized crop size. Logo and uploaded-static policies retain
   their frozen policy meaning and use bounded destination rectangles for manual adjustment.
2. Add profile-driven PNG/JPEG selection using the additive G3.0.3 format capability registry.
   Default format is derived from each G2.1 Golden MIME; PNG uses `.png`, JPEG uses `.jpg`.
3. Keep the existing pinned Sharp encoder settings and G2 default JPEG quality 88. No quality
   slider, matte picker, remote encoder, metadata passthrough, or OS-dependent compositing is added.
4. Extend the G3.0.2 canonical builder and strict IPC request with the optional placement plan.
   Main/Core validates asset digest, slot, policy/fit, normalized bounds, format, actual bytes,
   and stale Preview identity. Preview and Export do not reconstruct separate request objects.
5. Keep G2.1 Frozen Golden bytes, architecture, coordinates, and other channel outputs unchanged.

## Consequences

- Drag, zoom, numeric X/Y/Scale, Reset, and format selection are functional through Electron →
  Main → Core, not CSS screenshots.
- Any placement or format mutation invalidates the current PASS result and blocks stale Export
  with `DESKTOP-EXPORT-003` until a new PASS Preview is produced.
- The legacy renderer input schema remains `1.2.0`; the optional Google Desktop IPC extension is
  scoped to the Google request and is not used by KAKAO/NAVER/META.
- G3.1 user acceptance and Golden freeze remain a separate user-directed phase.

## Rejected alternatives

- Capturing DOM/canvas/CSS transforms: would make Preview bytes differ from Core output.
- Storing window coordinates or CSS transform strings: not canonical and not portable.
- Regenerating Frozen Goldens: would hide a default parity regression.
- Introducing Google Ads upload/API, remote assets, or Plume: outside the local Renderer boundary.
