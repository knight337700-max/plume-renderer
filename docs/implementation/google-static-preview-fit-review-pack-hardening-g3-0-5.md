# Google Static Preview Fit and review-pack path hardening (G3.0.5)

Status: IMPLEMENTED · Desktop UI/evidence tooling patch · user acceptance not recorded

## Scope and baseline

The implementation started from `d23bd3447b1242b4773c06ea85c0f4a72b313c1d` with a clean
working tree. It preserves G2.1 Goldens, G3.1 freeze evidence, the G3.0.4 placement registry,
Google export manifest `1.1.0`, encoder settings, and KAKAO/NAVER/META outputs.

## Root-cause audit

The production Electron build was exercised before the UI change. The preview surface was
approximately `858×475` CSS pixels, while `.google-canvas-fit .google-canvas-inner` used a fixed
`16 / 9` aspect wrapper. The image had width-only effective sizing because the parent had no
definite height; square and portrait images therefore exceeded the rendered surface vertically.
The pointer handlers also called `event.currentTarget.getBoundingClientRect()` on the outer
surface, so letterbox pixels were treated as canvas coordinates. The audit record is
`artifacts/g3-0-5/google-static-preview-fit-root-cause-audit.json`.

The fix gives the app shell and preview panel a bounded production viewport, measures the actual
canvas content with `ResizeObserver`, applies `min(viewportWidth/canvasWidth,
viewportHeight/canvasHeight)`, and maps pointer movement against that content rect. Fit uses
hidden overflow only after the content is mathematically contained; Actual Pixels keeps the
inner canvas at output dimensions with scrollable overflow.

## Uploaded Display behavior

All seven `UPLOADED_DISPLAY_STATIC` profiles remain `NONE` exact-canvas. Numeric fields, zoom,
reset, explicit plan editing/apply, and pointer mutation are disabled/read-only and guarded by
no-op event handlers. Format selection and export remain enabled.

## Review-pack hardening

The repository did not contain a G3.2.2 generator to rewrite. A reusable policy module and
fail-closed future verifier were added:

- `scripts/google-review-pack-path-policy.mjs`
- `scripts/verify-g3-2-2-google-static-review-pack-hygiene.mjs`

They permit pack-relative/repository-relative paths or logical labels such as `DESKTOP_ROOT`,
produce basename-only execution identity, and scan JSON/HTML/MD/TXT for drive, UNC, home/temp,
external URI, and `NOT_EXPOSED` payloads. The historical G3.2.1 ZIP is not sanitized, copied, or
reclassified.

## Verification

Pure geometry/policy tests and the production Electron G3.0.5 matrix cover all 14 profiles,
constrained height and resize, Actual Pixels, pointer/letterbox behavior, view-only invariants,
and all seven Uploaded Display locks. The existing G3.0.4 verifier remains the authority for
default Golden, transform, reset, replay, manifest, and frozen-channel checks.

Version changes are patch-only: Canonical `1.31.0 → 1.31.1` and Desktop/package `0.13.0 →
0.13.1`. Core, Validator, template, input/output schemas, response envelope, Google manifest,
coordinates, Goldens, and freeze registries are unchanged. Runtime network remains prohibited;
G3.2.2, acceptance, freeze, and G4 are not started.
