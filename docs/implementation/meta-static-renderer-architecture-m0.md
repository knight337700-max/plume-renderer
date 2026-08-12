# META Static Creative Capability Discovery & Renderer Architecture — M0

Phase: `M0_META_STATIC_CREATIVE_CAPABILITY_DISCOVERY_RENDERER_ARCHITECTURE`

Baseline: repository `dbb78d1e1accc509acf18d124bd9c9d0b6b9723e`, canonical document `1.21.4`, Core `0.8.6`, Desktop/package `0.9.12`. M0 is an audit and architecture phase. It adds no META runtime, no Desktop selector, no production renderer, no pixel Golden, and no change to Kakao or NAVER output.

## Official source audit

The audit was retrieved on 2026-08-12 from Meta for Business and Meta/Instagram Help Center pages only. `contracts/audits/meta-official-source-registry.json` contains fourteen rule records with URL, date, official domain, short summary, interpretation, confidence and contract effect. The readable index is `source-guides/meta/m0/official-source-index.md`.

Confirmed official directions:

- Feed photos: 1:1 and 4:5 are recommended mobile/feed ratios.
- Stories: vertical full-screen media; Instagram CTA guidance asks for roughly 14% top and 20% bottom free of key elements.
- Reels: 9:16 is the native direction, key messages belong in a safe zone, and static image ads can participate.
- Carousel: up to ten image/video cards; each may have its own link and Meta may optimize order.
- Advantage+ creative may resize, expand, generate or otherwise transform media for placements.
- Advantage+ placements distribute ads across multiple Meta surfaces; placement delivery is not an asset canvas identity.

The official pages audited in M0 do not establish ad-specific fixed pixel presets, file-size limits, exact Reels safe-zone geometry, placement crop boundaries, Meta UI coordinates, platform fonts or line clamps. These stay `UNRESOLVED` or `SOURCE_REQUIRED`. The repository does not use the obsolete 20-percent image-text rule.

## Composition boundary

META output is an uploadable creative media asset, not a screenshot of Facebook or Instagram.

Renderer-owned pixels include the creative canvas, background, photos, product imagery, embedded logo/copy, shapes and intentional crop/layout. The renderer may enforce artifact ratio, canvas integrity, in-canvas layers, deterministic output, required artifacts and source-backed safe-zone guidance.

Platform-owned data includes primary text, headline, description, call to action, destination URL, Facebook Page or Instagram identity, disclosure, social controls, placement chrome and CTA sticker UI. It may be stored in a separate metadata envelope and shown as a preview annotation, but is never automatically drawn into the exported creative.

Advantage+ transformations are external. The manifest may later state that transformation is expected, but the local renderer cannot predict, reproduce or validate the resulting platform variation.

## Static asset profiles

| Planned profile | Official ratio status | Fixed pixel preset | M1 disposition |
|---|---|---|---|
| `META_STATIC_FEED_SQUARE` | 1:1 confirmed | `UNRESOLVED` | Include after preset approval |
| `META_STATIC_FEED_PORTRAIT` | 4:5 confirmed | `UNRESOLVED` | Include after preset approval |
| `META_STATIC_VERTICAL_FULL` | 9:16 confirmed direction | `UNRESOLVED` | Include after preset approval |
| `META_STATIC_LANDSCAPE` | Landscape orientation exists | ratio and pixels unresolved | Defer |

Asset profile and placement are independent axes. Square/portrait map to general Facebook and Instagram Feed guidance. Vertical-full maps to Facebook/Instagram Stories and Reels. `INSTAGRAM_EXPLORE` remains `SOURCE_REQUIRED` because M0 found no official static profile mapping precise enough to freeze.

No number such as 1080×1080, 1080×1350 or 1080×1920 is frozen by M0. M1 must either capture a current official ad specification or propose a clearly labeled project canvas preset for approval before implementation.

## FREEFORM Core reuse audit

Overall result: `PARTIAL`, with no second FREEFORM renderer required.

- `CreativeLayoutPlan`, normalized bounds, z-order, images, logos, explicit-line text, shapes, renderer-owned fonts and deterministic PNG/JPEG are reusable.
- `MANUAL_CROP` is fully reusable and remains sufficient without an Agent. `SEMANTIC_CROP_COVER` remains optional because candidate generation is outside M0.
- Each ratio uses an existing per-profile plan. A small M1 placement-set wrapper can group plans and require stable semantic layer IDs such as `PRODUCT_HERO`, `BRAND_LOGO`, `HEADLINE`, `SUBCOPY` and `BADGE`.
- Existing format profiles require fixed canvases, so ratio-only profiles cannot be enabled until pixel presets are approved.
- Existing generic collection output is partial reuse only: its frozen schema describes `PLATFORM_COMPOSED` source artifacts. M1 needs an additive renderer-composed placement-set manifest without changing NAVER semantics.
- The validator needs additive profile ratio, placement-set completeness and safe-zone WARNING checks.
- Platform copy needs a separate non-pixel envelope; it does not belong in `CreativeLayoutPlan` text layers.

## Safe-zone model

Official platform obstruction zones and project comfort zones remain separate types with separate provenance.

`META_STORIES_KEY_CONTENT_SAFE_ZONE` stores normalized top `0.14` and bottom `0.20` exclusions with qualifier `ROUGHLY`. Intersections by key semantic roles produce a WARNING and can be displayed in Placement Guide Preview. The overlay is not included in the final media.

`META_REELS_KEY_CONTENT_SAFE_ZONE` has no geometry. The audited page points to official checker assets, but M0 did not obtain their exact current bytes and provenance. Its state is `SOURCE_REQUIRED`; no third-party pixel geometry is substituted.

## Output and UX architecture

M1 should provide SINGLE mode for one asset profile and PLACEMENT_SET mode for an explicit ordered collection of square, portrait and vertical variants. It must not treat three automatic center crops as a complete design solution. Each variant may override bounds/crops while preserving semantic layer IDs.

Desktop design after M1 completion:

1. Channel `META` → Creative Type `Static Image`.
2. Output selection: Feed Square, Feed Portrait, Stories/Reels Vertical or Placement Set.
3. Creative layout: image/logo/embedded copy/shapes/manual placement.
4. Platform Metadata: primary text/headline/description/CTA/destination, visibly separate from embedded creative copy.
5. Artifact Preview: exact downloadable pixels.
6. Placement Guide Preview: non-exported safe-zone and placement annotations.

M0 does not expose this incomplete UI.

## Carousel, commerce and video

Carousel static-card generation is a valid future ordered collection with maximum ten cards, but is deferred until after the initial placement set. Per-card link/headline and platform order optimization are metadata/platform concerns.

Collection, Catalog, Dynamic Ads and Instant Experience presentation are `PLATFORM_COMPOSED`. M0 does not reproduce the commerce UI. Video and Reels video rendering are `OUT_OF_M0_STATIC_IMPLEMENTATION`.

## M1 recommendation

Phase: `M1_META_STATIC_ASSET_PROFILES_PLACEMENT_SET_RENDERER`

1. Resolve and approve fixed canvas presets for 1:1, 4:5 and 9:16, explicitly distinguishing official values from project presets.
2. Register three META FREEFORM profiles and reuse existing raster, crop, font and deterministic PNG/JPEG paths.
3. Define a separate `MetaPlatformCopyMetadata` envelope that cannot affect pixels or fingerprints unless explicitly declared as non-pixel request metadata.
4. Define a placement-set wrapper over existing `CreativeLayoutPlan` objects with shared semantic layer IDs and explicit per-profile overrides.
5. Add a renderer-composed ordered collection manifest while preserving the NAVER platform-composed manifest unchanged.
6. Add Stories WARNING/guide overlay; keep Reels geometry disabled until its official source is captured.
7. Add Core/validator/determinism tests, representative fixtures, Desktop integration and package smoke.
8. Keep Carousel, Catalog/Collection UI and video deferred.

M1 must not start pixel implementation until item 1 is approved.

## Freeze and version result

M0 changes audit records, architecture documentation, a verifier and handoff metadata only. Canonical `1.21.4`, Core `0.8.6`, Desktop/package `0.9.12`, SmartChannel templates/typography and every frozen Golden remain unchanged. Runtime network access remains prohibited.
