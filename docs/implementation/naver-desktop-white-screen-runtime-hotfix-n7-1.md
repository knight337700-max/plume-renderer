# Phase N7.1 — NAVER Desktop White-Screen Runtime Hotfix

## Implementation

- `RendererDiagnostics` serializes bounded JSONL events to Electron `app.getPath("userData")/logs/renderer.log`.
- Preload exposes only `reportRendererDiagnostic`; Main validates the payload and verifies the
  trusted sender before appending it.
- Renderer installs `window.error` and `unhandledrejection` listeners before React mount.
- `RendererErrorBoundary` encloses the active editor subtree, records component stack, and keeps
  Channel navigation outside the boundary.
- Naver editor reports its current placement/subtype/template context and renders explicit
  capability/source/profile resolution errors instead of silent profile fallback.
- `scripts/smoke-naver-desktop.mjs` runs the 8-placement matrix and Feed subtype invariant on
  both `release/win-unpacked` and the portable EXE via its local CDP endpoint. No network or
  telemetry is used.

## Reproduction evidence

The pre-change 0.9.0 baseline was run in dev/source, production-equivalent `win-unpacked`, and
portable EXE. All placement transitions remained mounted and emitted no pageerror/console error.
This is recorded as `originalWhiteScreenReproducedInCurrentCheckout: false`; the affected-machine
exception remains required for final root-cause classification.

## Regression boundary

No Core renderer file, raster algorithm, font asset, Naver template geometry, source schema,
collection fingerprint, or golden fixture was changed. Desktop is version `0.9.1`; Core remains
`0.8.0`, canonical document remains `1.21.0`, and runtime network access remains prohibited.
