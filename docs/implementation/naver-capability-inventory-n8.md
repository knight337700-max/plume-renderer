# NAVER Capability Inventory — N8

Phase: `N8_NAVER_REMAINING_FORMATS_DESKTOP_INTEGRATION_CHANNEL_COMPLETION`

Inventory baseline: repository `26773ebcd1b3831958410d051e7c068054a09e1b` (2026-08-12). This inventory was completed before N8 runtime changes. The machine-readable counterpart is `artifacts/n8/naver-capability-inventory.json`.

## Result

The repository already exposes eight NAVER placements through the channel-first Desktop registry. SmartChannel, Mobile DA and Image Banner 1:1 are renderer-composed. The two non-SmartChannel raster formats already reuse FREEFORM Core; no second renderer is needed. Communication Ad, Shopping News, PC Native and Mobile Native are platform-composed source contracts. Mobile DA Feed provides a single-source path and an ordered collection source-artifact path; VIDEO remains disabled because it is outside the static renderer scope.

| Desktop placement | Core/contract reality | Desktop before N8 | Classification | N8 action |
|---|---|---:|---|---|
| SmartChannel | 120-template renderer + validator | Complete | `A_CORE_COMPLETE_DESKTOP_COMPLETE` | Hard freeze and regression only |
| Mobile DA | FREEFORM Core, 1250×560 | Complete | `A_CORE_COMPLETE_DESKTOP_COMPLETE` | Representative Desktop E2E and determinism evidence |
| Image Banner 1:1 | FREEFORM Core, 1200×1200 | Complete | `A_CORE_COMPLETE_DESKTOP_COMPLETE` | Representative Desktop E2E and determinism evidence |
| Communication Ad | Platform-owned final UI; LIST/COMMENT source profiles | Complete | `E_PLATFORM_COMPOSED` | Both variants: source validation and export E2E |
| Shopping News | Platform-owned final UI; one source profile | Complete | `E_PLATFORM_COMPOSED` | Source validation and export E2E |
| PC Native | Platform-owned final UI; one source profile | Complete | `E_PLATFORM_COMPOSED` | Source validation and export E2E |
| Mobile Native | Platform-owned final UI; one source profile | Complete | `E_PLATFORM_COMPOSED` | Source validation and export E2E |
| Mobile DA Feed | Single source + ordered 4..10 item collection | Complete for IMAGE/COLLECTION | `F_COLLECTION_OUTPUT` | IMAGE and COLLECTION preview/export E2E; VIDEO remains disabled |

## Source-of-truth routing

- Channel/placement selection comes from `contracts/desktop-capability-registry.json`.
- Mobile DA and 1:1 form, canvas, output and validation come from `contracts/freeform-format-profiles.json` through the existing `FreeformEditor` and FREEFORM Core.
- Platform-composed fields and required assets are materialized from `contracts/naver-platform-composed-source-profiles.json`. The Desktop does not parse format names to invent fields.
- Collection cardinality, item profile, safe area and ordering are enforced by `src/core/naver-collection.ts` and the existing multi-artifact manifest schema.
- The Desktop controller validates and publishes only the contract-defined deliverable. It does not create a fake NAVER final UI.

## Deliberate non-implementations

`NAVER_FEED_VIDEO_SOURCE_V1` is `NOT_IMPLEMENTED` and its Desktop option is disabled. The reason is `OUT_OF_STATIC_RENDERER_SCOPE`; N8 does not add video handling or a substitute still-image flow. Platform-composed placements do not have a final pixel canvas or renderer-owned font contract because NAVER owns the final presentation. No font is inferred from SmartChannel.

## Inventory conclusion

There are no `CORE_COMPLETE_DESKTOP_MISSING` placements at the N8 start SHA. The implementation gap is acceptance depth: existing E2E proves both renderer-composed FREEFORM routes and one Communication source route, but does not execute every platform-composed placement and Feed collection export. N8 therefore extends representative end-to-end coverage and produces a channel-level matrix without altering the frozen SmartChannel implementation.
