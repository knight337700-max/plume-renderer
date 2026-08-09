# ADR-0042: Freeze NAVER Channel and Composition Axes

- Status: Accepted
- Date: 2026-08-09 (KST)
- Phase: N1A
- Scope: Contract and capability metadata only

## Context

The existing local Renderer has two independent implementation paths represented by
`TEMPLATE_LOCKED` and `FREEFORM`. Naver GFA includes placements where the platform,
rather than this Renderer, composes the final ad UI. A single layout enum cannot state
that ownership without changing the existing Kakao contract.

## Decision

Add these orthogonal, serializable axes:

```text
ChannelId          = KAKAO_MOMENT | NAVER_GFA
CompositionMode    = RENDERER_COMPOSED | PLATFORM_COMPOSED
ArtifactCardinality= SINGLE | COLLECTION
LayoutMode         = TEMPLATE_LOCKED | FREEFORM (unchanged)
```

Placement identifiers are channel-scoped. N1A registers the eight Naver GFA placement
namespaces, but it does not create a pixel FormatProfile or raster output for any of
them. Existing Kakao and FREEFORM profiles materialize as renderer-composed single
artifacts with their existing layout mode. A platform-composed dispatch is rejected
with `KBR-COMPOSITION-MODE-NOT-SUPPORTED` and cannot publish a raster.

## Alternatives rejected

1. Renaming or extending `LayoutMode`: would reinterpret an existing public enum and
   risk changing Kakao fingerprints.
2. A global placement enum: would lose the channel-scoped meaning of Naver names.
3. Placeholder SmartChannel canvas profiles: would imply unverified geometry and make
   N1B PSD evidence look canonical before review.
4. Flattening `MOBILE_DA_FEED` to FREEFORM/SINGLE: would erase its mixed/profile-
   dependent semantics.

## Consequences

The Integration Contract has an additive minor bump (`1.6.0 → 1.7.0`) while legacy
versions remain accepted. Canonical documentation has a minor bump
(`1.11.0 → 1.12.0`). Template `1.6.0`, CreativeLayoutPlan `1.0.0`, Desktop `0.8.2`,
existing fingerprints, PNG/JPEG output, Validator semantics, and Golden bytes remain
unchanged. Naver raster implementation, platform composition, Collections, and UI are
explicitly deferred.
