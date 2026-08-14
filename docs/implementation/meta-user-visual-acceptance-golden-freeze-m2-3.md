# META M2.3 — User visual acceptance and Golden freeze

## Decision

M2.3 promotes the four user-approved META static image outputs to the frozen Golden registry.
No Renderer Core, Validator, Desktop UI, CreativeLayoutPlan, crop, encoding, or format behavior was
changed. The current META static image scope is `COMPLETE_FROZEN`; this is not an upload approval.

## Approved contextual Goldens

| Golden | Profile | Context | Canvas | Bytes | Artifact SHA-256 | Validator |
| --- | --- | --- | --- | ---: | --- | --- |
| `META_STATIC_FEED_SQUARE_GOLDEN_V1` | `META_STATIC_FEED_SQUARE` | `INSTAGRAM_FEED` | 1080×1080 | 295358 | `1516d007cec83b8e16e8e6ad70825dcd36490e13b491e51b8868652e608a0ccf` | 0/0/0 |
| `META_STATIC_FEED_PORTRAIT_GOLDEN_V1` | `META_STATIC_FEED_PORTRAIT` | `INSTAGRAM_FEED` | 1080×1350 | 399966 | `de7162cd2d1b6cfe9a9e0f33f62172d156075ceab2ff22ec9a58e68d1bd75c85` | 0/0/0 |
| `META_STATIC_VERTICAL_STORIES_GOLDEN_V1` | `META_STATIC_VERTICAL_FULL` | `INSTAGRAM_STORIES` | 1080×1920 | 637585 | `b958c022962b3641ca32e9cdb7da32e607b0d30ebd0f6b3a996452f58973d988` | 0/0/0 |
| `META_STATIC_VERTICAL_REELS_GOLDEN_V1` | `META_STATIC_VERTICAL_FULL` | `INSTAGRAM_REELS` | 1080×1920 | 637585 | `b958c022962b3641ca32e9cdb7da32e607b0d30ebd0f6b3a996452f58973d988` | 0/0/1 |

`0/0/0` and `0/0/1` are `errorCount/warningCount/infoCount`. Reels' sole INFO is
`KBR-META-REELS-SAFE-ZONE-SOURCE-REQUIRED`; no guessed geometry is used. Stories retains advisory
guide metadata (`top=0.14`, `bottom=0.20`) and does not composite an overlay into the artifact.

## Fingerprints and contextual identity

The registry stores the user-approved pixel and request fingerprints from the QA output envelope.
Stories and Reels intentionally have the same artifact SHA and pixel fingerprint, but remain two
entries because their placement contexts, request fingerprints, and validator semantics differ.
Per-entry request, CreativeLayoutPlan, expected-manifest, and asset-digest-reference fixtures are
under `fixtures/golden/meta/`. Runtime rerender manifests are retained under `artifacts/m2-3/runtime/`
for deterministic audit without replacing the supplied approval identity.

## Freeze and byte-size boundary

`manualAcceptance.status=APPROVED`, `goldenStatus=APPROVED_FROZEN`, and `finalGoldenFrozen=true`
are limited to the current META static image scope. Carousel, Catalog, Dynamic, Video, unsupported
landscape, and future exact Reels safe-zone geometry remain deferred. The old inherited
`maximumBytes=300000` rule is absent; exact placement-specific maximum bytes remain
`NO_EXACT_MAX_PINNED`. The approved artifacts may therefore exceed 300000 bytes.

## Verification

Run:

```powershell
pnpm build
node scripts/generate-m2-3-meta-goldens.mjs
node scripts/verify-m2-3-meta-goldens.mjs
```

The verifier checks registry state, all four supplied artifact hashes and byte sizes, JPEG canvas
dimensions, request/Plan context ownership, validator expectations, Stories/Reels contextual
separation, three-run artifact/fingerprint determinism, stale 300000-byte-rule absence, and Plume
dependency absence. Existing Kakao, NAVER, FREEFORM, M1, M2.1, M2.2, and M2.2a regressions remain
required.

## Version impact

Canonical document, template contract `1.9.0`, input schema `1.2.0`, output schema `2.0.0`, Core
`0.9.0`, Validator `1.9.0`, Desktop `0.10.1`, and package `0.10.1` are unchanged. The additive
META Golden registry is version `1.0.0`. **[PROJECT]**
