# G1 Google Ads static contracts and profile implementation

Status: IMPLEMENTED

## Baseline

- Phase: `G1_GOOGLE_STATIC_CONTRACTS_AND_PROFILE_IMPLEMENTATION`
- Baseline HEAD: `ef807153c1143966a3f6d83bf01704bf1d2ad206`
- G0.1 architecture: frozen `1.0.0`
- Runtime network requests: `0`
- Plume dependencies: `0`

## Implemented surface

- `contracts/google/static-asset-profiles.g1.json`: seven geometry plus seven Demand Gen
  uploaded-static profiles; legacy Display runtime profiles remain empty.
- `contracts/google/capability-asset-role-mapping.g1.json`: seven frozen capability records and
  role/profile cardinality mapping.
- `contracts/google/target-constraints.g1.json`: decimal-byte limits and PNG/JPEG MIME policy.
- `contracts/google/creative-asset-set-manifest.schema.json`: deterministic collection manifest
  shape with platform fields kept outside raster input.
- `contracts/google/delivery-set-validator.g1.json` and `diagnostics.g1.json`: validator policy
  and the eleven frozen diagnostics.
- `packages/renderer-contract/src/google-static.ts`: public contract types and deterministic issue
  sorting.
- `src/core/google-static.ts`: registry loading, profile resolution, artifact checks, manifest
  checks, and RDA/PMax/Demand Gen delivery validators.
- `scripts/verify-g1-google-static.mjs`: contract and frozen-registry integrity verifier.

## Deliberate non-scope

No Google upload/API, Desktop UI, carousel, Search image runtime, legacy twenty-canvas runtime,
pixel Golden, platform text rasterization, remote font, telemetry, or network implementation was
added. Existing KAKAO/NAVER/META registries and renderer paths remain isolated.

## Verification

The G1 verifier checks the fourteen profile count, exact project presets, seven-capability mapping,
frozen G0.1 hashes, eleven diagnostic IDs/severities, decimal-byte caps, MIME policy, isolated
registry, OBJECT_RIGHT SHA-256, and prohibited scope. Unit tests cover positive RDA/PMax sets,
uploaded-static errors, deterministic ordinals, and transitional INFO behavior.
