# Google Static Desktop QA — G3.1 user checklist

Status: **AWAITING_USER_ACCEPTANCE**. This package is preparation evidence only; it is not a Golden or freeze registry.

## Launch

1. From the repository root run pnpm desktop:start (or pnpm build:desktop then pnpm exec electron .).
2. Select **GOOGLE** in the real Desktop app.
3. Choose a local asset and an output folder; the recommended sample is fixtures/google/g2/source/g2-GOOGLE_MARKETING_LANDSCAPE_1_91.png.
4. Review only local, offline behavior. Google Ads Upload/API, OAuth, telemetry, CDN, and Plume are outside scope.

## Representative scenarios

- [ ] Basic PNG: Geometry profile → asset → default placement/PNG → Preview/Validator PASS → export .png; verify PNG signature, dimensions, and local output.
- [ ] Drag and Zoom: move the asset on the preview surface, use Scale/Zoom, and confirm X/Y/Scale synchronization; preview and export the changed placement.
- [ ] Numeric and Reset: enter X/Y/Scale values, verify the result, Reset to profile default, rerender, and compare with the default Golden.
- [ ] JPG actual output: Uploaded Display Static representative profile → JPG → placement adjustment → Preview/Validator PASS → export .jpg; verify JPEG SOI/EOI, MIME, dimensions, and deterministic encoder metadata.
- [ ] Small banner: select 320×50 or 468×60 where available; compare Fit and 100% Actual Pixel view and confirm coordinate mapping.
- [ ] Stale and recovery: after PASS change format, placement, asset, profile, or delivery metadata; Export must be blocked until Preview/Validator runs again.
- [ ] Diagnostics: inspect global 11-code diagnostic display and at least one representative validation error.

## Automatic precheck

- G0, G0.1, G1, G2, G2.1, G3, G3.0.1, G3.0.2, and G3.0.3 verifiers: PASS.
- pnpm check: PASS.
- Vitest: 285/285 tests PASS.
- Playwright/Electron: 42/42 tests PASS, no retry.
- Default Desktop/Core/Frozen equality: 14/14 byte-equal.
- Runtime network requests observed: 0.

## Evidence

Screenshots, traces, PNG, and JPG in evidence/ were produced by the actual Electron path and are marked NON_NORMATIVE_REVIEW_EVIDENCE. They must not be promoted to Golden fixtures.

## Response

After direct review, respond exactly with ACCEPT_GOOGLE_G3_DESKTOP_QA for full-scope acceptance, or provide the requested structured rejection:

REJECT_GOOGLE_G3_DESKTOP_QA: with area, optional profile_id, issue, and expected behavior.
