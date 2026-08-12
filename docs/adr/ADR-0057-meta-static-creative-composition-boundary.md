# ADR-0057: META Static Creative Media Boundary

- Status: Accepted for M1 design
- Date: 2026-08-12
- Decision owners: Renderer project

## Context

Meta accepts creative media and then composes identity, copy, CTA, disclosure, social controls and placement chrome. Treating each placement as a pixel-exact application template would mix renderer-owned media with mutable platform UI and would require unsupported coordinate and font guesses.

The existing FREEFORM Core already executes normalized image, logo, text and shape layers with deterministic PNG/JPEG output. Its current generic collection manifest, however, represents platform-composed source artifacts, and the current format profiles require fixed pixel canvases.

## Decision

Model META in two independent axes: an uploadable static `assetProfile` and a `placementCompatibility` mapping. The initial planned geometry families are 1:1 feed square, 4:5 feed portrait and 9:16 vertical full. Their fixed pixel presets remain unresolved until official evidence or an explicitly approved project preset is contracted. Landscape is deferred.

Creative media is `RENDERER_COMPOSED`. Primary text, headline, description, CTA, destination, identity and platform chrome are `PLATFORM_COMPOSED` metadata and are never automatically baked into the creative pixels. Advantage+ output is an external platform transformation.

M1 will reuse `CreativeLayoutPlan` per asset variant and preserve semantic layer IDs across variants. It may add an outer placement-set request and a renderer-composed ordered artifact manifest, but it must not fork the FREEFORM plan or weaken the frozen NAVER collection schema. Safe-zone overlays are QA views only and never enter exported pixels.

## Consequences

- M0 exposes no META selector and changes no production pixels.
- Stories' approximate 14% top and 20% bottom guidance is a WARNING/guide, never an ERROR.
- Exact Reels safe-zone geometry remains `SOURCE_REQUIRED`.
- Carousel static cards and catalog/Collection UI are deferred beyond the initial M1 placement set.
- No Meta platform font, UI coordinate, line clamp, fixed pixel preset or file-size constant is inferred.

## Rejected alternatives

- Meta application-screen templates: rejected because platform chrome is not renderer-owned.
- Automatic center-crop as the only placement-set adaptation: rejected because each ratio may require an intentional layout.
- Reusing the NAVER platform-composed collection manifest for rendered META assets: rejected because its ownership semantics are intentionally different.
