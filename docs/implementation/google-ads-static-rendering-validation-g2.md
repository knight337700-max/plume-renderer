# Google Ads static rendering validation and Golden Candidates — G2

Status: IMPLEMENTED — candidate evidence only; visual acceptance and Golden freeze are pending.

## Baseline and gate

- G1 baseline HEAD: `5456780dc2303a680c578d43e53f36333450d6c4`
- G0/G0.1/G1 contract verifiers: PASS before implementation
- Gate A: all eleven frozen Google diagnostic IDs emitted with the registered severity and
  `messageKey`; INFO results are nonblocking and ERROR results are blocking.
- G0.1 Google architecture: frozen `1.0.0`
- Runtime network requests: `0`
- Plume dependencies: `0`

## Renderer

`src/core/google-static-render.ts` renders local source bytes into the exact project preset canvas.
Marketing and logo placement accept only the G1-approved policies; uploaded static profiles require
an explicit element plan. Contain, manual crop, semantic crop, and alpha-trim plans fail closed
when their required rectangles or semantic metadata are absent. PNG/JPEG encoder settings are
pinned and the render fingerprint contains no absolute paths or platform fields.

The renderer is intentionally not a Google upload client, Desktop feature, font loader, or
platform-composition engine. `platformFields` remain metadata-only.

## Candidate set and evidence

- Geometry candidates: `7`
- Demand Gen uploaded display static candidates: `7`
- Total candidates: `14`
- Registry: `contracts/google/golden-candidates.g2.json`
- Registry status: `CANDIDATE`
- Visual acceptance: `PENDING`
- Frozen: `false`
- Preview index: `artifacts/g2/google-static-candidate-index.html`
- Render verification: `artifacts/g2/google-static-rendering-validation-verification.json`
- Delivery verification: `artifacts/g2/google-static-delivery-validation.json`

Every candidate has source, plan, and artifact SHA-256 values. Re-rendering the same source and
plan produces byte-equal output. RDA vertical and Demand Gen vertical retain the expected
transitional/source-required INFO diagnostics. All thirty positive delivery scenarios pass, and
five invalid placement plans produce deterministic errors with publish disabled.

## Verification command

```powershell
pnpm build
node scripts/generate-g2-google-static-candidates.mjs
pnpm verify:g2-google
```

The G2 verifier also confirms exact profile order, canvas/MIME, decimal-byte caps, platform-field
rasterization absence, no frozen Google Goldens, no UI/upload/runtime network scope, and preserved
OBJECT_RIGHT SHA-256.

## Next phase

`G2_1_GOOGLE_STATIC_USER_VISUAL_ACCEPTANCE_AND_GOLDEN_FREEZE` may review these candidates. It must
not treat this registry as approved or frozen without explicit visual acceptance evidence.
