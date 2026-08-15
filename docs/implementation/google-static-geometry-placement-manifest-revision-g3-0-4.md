# Google Static Geometry Placement and Manifest Revision — G3.0.4

Status: IMPLEMENTED; user acceptance and a new Desktop freeze are intentionally pending.

## Scope

G3.0.4 fixes the production Google Static Desktop default path. The seven Geometry profiles now
load their exact frozen G2.1 placement plans from
`contracts/google/default-placement-plans.g3.0.4.json`. The seven Uploaded Display Static
profiles use an exact-canvas `NONE` plan and have placement controls disabled. The runtime never
consults G2.1 Golden files, artifacts, or test fixtures to choose a default.

The shared request carries the source asset identity, placement plan, and normalized transform.
Electron Main re-validates the plan against the packaged registry before Core rendering. Preview,
Validator, and Export share the resulting canonical request and fingerprint. Reset restores
`x=0.5`, `y=0.5`, `scale=1` and the registry default plan.

## Manifest contract

Google export manifests use additive schema `1.1.0` in
`contracts/google/export-manifest.g3.0.4.schema.json`. The manifest records canonical request,
source and output digests, source/destination geometry, resolved placement, encoder settings,
render fingerprint, and delivery metadata. `outputArtifactDigest` is authoritative. JPEG omits
`outputPngDigest`; PNG may retain it only when it equals the PNG digest. The legacy shared manifest
schema used by KAKAO/NAVER/META remains `1.0.0`.

## Verification

The implementation is covered by:

- `tests/desktop/integration/google-static-g3-0-4.test.ts` for all fourteen profile defaults,
  default Golden equality, transform/reset determinism, missing-plan rejection, and manifest shape;
- `tests/e2e/desktop.spec.ts` through the actual Electron UI, preload IPC, Main, Core, and Validator;
- `scripts/verify-g3-0-4-google-static-geometry-placement-manifest.mjs` for registry, version,
  schema, source-scope, and frozen-artifact invariants.

The existing G2.1 registry, Goldens, G3.1 freeze registry, acceptance evidence, and reference
assets are not regenerated or modified. G3.1 remains historical evidence and is linked by
`contracts/google/desktop-qa-supersession.g3.0.4.json` with status
`SUPERSEDED_PENDING_REACCEPTANCE`. This phase does not create G3.2.1 output-pack evidence or
record user acceptance.

## Version record

| Contract | Previous | Current | Reason |
|---|---:|---:|---|
| Canonical document | 1.30.0 | 1.31.0 | Additive Geometry default and manifest contract |
| Desktop/package | 0.12.0 | 0.13.0 | Production default/runtime correction |
| Google export manifest | 1.0.0 | 1.1.0 | Additive canonical request and artifact metadata |
| Renderer Core | 0.11.0 | 0.11.0 | unchanged raster engine |
| Validator | 1.11.0 | 1.11.0 | unchanged validation semantics |
| Template/Input/Output/Response | unchanged | unchanged | no coordinate or public input/output change |

Runtime network access remains prohibited and no Plume, upload API, OAuth, telemetry, or remote
asset dependency is introduced.
