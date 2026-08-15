# Google Static Preview/Export fingerprint revision (G3.0.2)

Status: `IMPLEMENTED` · Phase `G3_0_2_GOOGLE_STATIC_DESKTOP_QA_REVISION`

## Defect

The real Electron Desktop path accepted a Google Static Preview with `deliveryMetadata`, then
constructed Export from the plan alone. Main/Core intentionally included delivery metadata in the
request fingerprint, so an unchanged Preview was rejected with `DESKTOP-EXPORT-003` and no file
could be published.

## Correction

`apps/desktop/shared/src/google-static-request.ts` now owns the canonical Google Static request
builder and deterministic metadata normalization. The Preview and Export handlers call that same
builder, and Main/Core canonicalizes the request again at the trusted boundary before rendering and
fingerprinting. Metadata remains identity-only and is never rasterized. The stale comparison was
left intact, so an asset, profile, plan, encoding, or metadata change still blocks Export with
`DESKTOP-EXPORT-003`.

## Regression coverage

- `tests/e2e/desktop.spec.ts` drives the actual Electron UI, preload IPC, and Main/Core controller;
  a PASS Preview containing non-empty metadata now creates both `output.png` and
  `render-manifest.json`.
- `tests/desktop/integration/google-static-session-controller.test.ts` exports the unchanged
  request and then proves a metadata change is stale-blocked.
- G3.0.1's exact eight-path allowlist remains unchanged. G3.0.2 records its four changed
  production paths explicitly in `contracts/contract-versions.json` and its dedicated verifier.

## Contract and version impact

Canonical document `1.28.0 → 1.28.1` (patch); Desktop/package `0.11.0 → 0.11.1` (patch). Template,
Core, Validator, Input/Output schemas, manifest/response schemas, coordinates, frozen Goldens, and
all raster bytes remain unchanged. No G3.1 user-acceptance or freeze artifacts are created.

## Verification commands

```text
pnpm verify:g3-0-2-google
pnpm exec vitest run tests/desktop/integration/google-static-session-controller.test.ts
pnpm exec playwright test tests/e2e/desktop.spec.ts -g "Google Static Preview with delivery metadata exports"
```

Runtime network access, upload/API integration, OAuth, telemetry, and Plume dependencies remain
prohibited.
