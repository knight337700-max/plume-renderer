# NAVER Channel Completion — N8

Phase: `N8_NAVER_REMAINING_FORMATS_DESKTOP_INTEGRATION_CHANNEL_COMPLETION`

Baseline: repository `26773ebcd1b3831958410d051e7c068054a09e1b`, Desktop/package `0.9.11`. N8 keeps canonical document `1.21.4`, renderer Core `0.8.6`, SmartChannel template `1.10.0`, and SmartChannel typography `1.6.0` unchanged. Desktop/package advances to `0.9.12`; the independently versioned platform-composed runtime advances from `1.1.0` to `1.1.1`.

## Inventory summary

The repository contains eight selectable NAVER placements. SmartChannel, Mobile DA, and Image Banner 1:1 are renderer-composed and were already connected to Desktop. Communication Ad, Shopping News, PC Native, and Mobile Native preserve platform-composed semantics. Mobile DA Feed supports deterministic IMAGE source output and an ordered COLLECTION of 4–10 source artifacts; VIDEO remains disabled as `OUT_OF_STATIC_RENDERER_SCOPE`.

The complete pre-change inventory and classification are recorded in `artifacts/n8/naver-capability-inventory.json` and `docs/implementation/naver-capability-inventory-n8.md`. No parallel format registry or second renderer was introduced.

| Format | Canonical profile | Composition/cardinality | N8 result |
|---|---|---|---|
| SmartChannel | `NAVER_SMARTCHANNEL` | Renderer-composed / single | `COMPLETE_FROZEN` |
| Mobile DA | `NAVER_MOBILE_DA` | Renderer-composed / single | `COMPLETE` |
| Image Banner 1:1 | `NAVER_IMAGE_BANNER_1_1` | Renderer-composed / single | `COMPLETE` |
| Communication Ad | `NAVER_COMMUNICATION_AD` | Platform-composed / single | `PLATFORM_COMPOSED`, LIST and COMMENT complete |
| Shopping News | `NAVER_SHOPPING_NEWS` | Platform-composed / single | `PLATFORM_COMPOSED` |
| PC Native | `NAVER_PC_NATIVE` | Platform-composed / single | `PLATFORM_COMPOSED` |
| Mobile Native | `NAVER_MOBILE_NATIVE` | Platform-composed / single | `PLATFORM_COMPOSED` |
| Mobile DA Feed | `NAVER_MOBILE_DA_FEED` | Platform-composed / single or collection | IMAGE and COLLECTION complete; VIDEO deliberately disabled |

## Desktop architecture and contract mapping

Desktop continues to read channel and placement metadata from `contracts/desktop-capability-registry.json`. FREEFORM fields come from `contracts/freeform-format-profiles.json`; platform source fields and required assets come from `contracts/naver-platform-composed-source-profiles.json`; collection cardinality and ordering come from the existing collection Core. SmartChannel-only controls are not copied to other formats and format-name string heuristics are not used.

N8 corrected four integration gaps without changing renderer-owned pixels:

1. A general PNG/JPEG tertiary source slot replaces accidental reuse of the SmartChannel PNG-only logo slot for platform source assets.
2. Assets with the same role resolve by exact `sourceProfileId` before the role fallback, preserving Feed source selection.
3. An exact declared source canvas is authoritative over a rounded marketing aspect-ratio label, so a valid 1200×628 16:9 source is accepted deterministically.
4. Desktop delegates collection validation and atomic publish to the existing collection Core. It does not republish a second copy or introduce ZIP output.

For platform-composed products, Desktop exports deterministic source assets, `source-spec.json`, and `source-manifest.json`. It never synthesizes a NAVER-owned final advertising UI. Collection export preserves user-defined item order and emits the existing `collection-manifest.json` plus item artifacts.

## End-to-end acceptance

`tests/e2e/naver-desktop.spec.ts` exercises every completed placement through actual Electron UI selection, contract-driven fields, source selection or canonical input, preview, validator, and export. Representative evidence is retained below `artifacts/n8/formats/` for Mobile DA, Image Banner 1:1, Mobile/PC Native, Shopping News, Communication LIST/COMMENT, Feed IMAGE, and Feed COLLECTION.

The machine-readable matrix in `artifacts/n8/naver-desktop-format-matrix.json` records eight selectable formats with no missing or extra canonical fields and no request-mapping errors. Feed VIDEO is visibly disabled and is not counted as a completed static-renderer capability.

## Determinism and regressions

Renderer-composed formats retain their established deterministic Golden coverage. Platform-composed JSON and copied-asset manifests use deterministic canonical serialization and digests. Collection item order is part of its deterministic manifest contract. Runtime network access remains prohibited.

SmartChannel is hard-frozen against the N7.8 baseline: 120/120 exhaustive templates render, validator/font/crash counts remain zero, three-run determinism passes, the six representative Golden files are unchanged, and no frozen implementation, font, template, typography, placement, or registry path changed. Kakao and non-SmartChannel NAVER Golden digests are verified by `artifacts/n8/non-smartchannel-regression.json`.

## Package and handoff QA

- Windows portable package: `release/Kakao-Bizboard-Local-Renderer-0.9.12-x64.exe`
- Package smoke: recorded in `artifacts/n8/package-smoke.json`
- Renderer Module synchronization: `C:/Users/Lenovo/Desktop/Renderer Module`
- Handoff verification: recorded in `artifacts/n8/handoff-verification.json`

Both evidence files are finalized only after their respective binary and copied-tree verifiers pass.

## Remaining NAVER work

`NAVER_FEED_VIDEO_SOURCE_V1` remains `NOT_IMPLEMENTED_NOT_EXPOSED_FOR_EXECUTION`. Video is outside this static raster/source renderer's scope; implementing it requires a separately approved video-source contract, validator, preview behavior, artifact/publish contract, and acceptance fixtures. No missing source evidence was hidden with inferred UI, fonts, or assets.

## Next recommended work

`N9_NAVER_SOURCE_ARTIFACT_UX_AND_EXTERNAL_ACCEPTANCE`: improve inspection of platform-composed source artifacts and run external product-owner acceptance without altering renderer-owned SmartChannel or FREEFORM pixels.
