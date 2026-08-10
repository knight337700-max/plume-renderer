# N6 Contract Clarification — NAVER Collection / Multi-Artifact Contract

Status: FROZEN  
Phase: `N6_NAVER_COLLECTION_MULTI_ARTIFACT_CONTRACT`  
Canonical document: `docs/kakao-bizboard-renderer-spec-v1.md` v1.21.0  
Decision date: 2026-08-10 (KST)

## Problem

N5 described NAVER Feed Collection as a deferred collection profile but did not define how
ordered source images, per-item validation, checksums, fingerprints, and publish atomicity
would be represented. A platform-owned Feed carousel cannot be replaced by a locally guessed
final screenshot or a NAVER-specific ad-hoc array schema.

## Decision

Reuse the generic `ArtifactCardinality = COLLECTION` axis and add a platform-neutral
`MultiArtifactCollection` / `MultiArtifactCollectionManifest` contract. N6 implements only
`NAVER_GFA / MOBILE_DA_FEED / COLLECTION` with the frozen image item profile
`NAVER_FEED_COLLECTION_ITEM_IMAGE_600X600`.

- Collection items are ordered by input array order and have stable unique IDs.
- Four through ten items are accepted; fewer or more are deterministic errors.
- The item allowlist contains only the 600×600 RGB JPEG/PNG image profile. Video and still
  alternatives remain registry entries with `NOT_IMPLEMENTED` status.
- Collection-level fields are Feed profile name, ad copy, and platform-defined CTA. Item-level
  fields are landing URL and optional item description (28 characters maximum).
- The source image bytes are preserved; the runtime does not crop, resize, or render a final
  Feed UI. `finalUiRendered=false` and `finalUiChecksum=null` are mandatory.
- Each item receives a byte checksum, source-pixel fingerprint, and item request fingerprint.
  The collection fingerprint includes collection fields and the ordered item fingerprints.
- All item artifacts and one manifest are written to staging and renamed atomically. A single
  validation or publish error blocks the entire collection and leaves no partial publish.

## Evidence and rationale

The official page `https://ads.naver.com/adguide/1480` and its attached
`FEED_AD_GUIDE.pdf` were revalidated. The attachment hash remains
`0e45fdf9dda180551dde06bdef91e726f86823a405e62e00232db7ba407170ef`. Its collection guidance
supports 4–10 items, 600×600 item images, 540×540 centered safe area, 20KB–500KB source
bytes, and item landing/description fields. Final card geometry and interaction remain
platform-owned. **[OFFICIAL] [TOOL_OUTPUT]**

The manifest and fingerprints are project execution semantics, not claims about NAVER's final
UI. Decimal byte constants are materialized from the published KB range. **[DERIVED] [PROJECT]**

## Impact range

- Adds generic multi-artifact TypeScript primitives and schemas.
- Extends the N5 SourceSpec schema additively to accept `collection.items` while preserving
  `schemaVersion: 1.0.0` SINGLE payloads.
- Adds collection source profile metadata, a 1.0.0 manifest schema, N6 Error Registry entries,
  source artifact inspection, deterministic fingerprints, and atomic collection publish.
- Adds source-only fixtures and runtime tests. No official creative is copied into fixtures.
- Updates the renderer core version from 0.7.0 to 0.8.0. Integration (1.8.0), template (1.9.0),
  and Desktop (0.8.2) versions remain unchanged.

## Compatibility

Existing `ArtifactCardinality=SINGLE` validation and all Kakao, FREEFORM, SmartChannel, and
legacy serialization paths remain unchanged. N6 is additive to the separate NAVER SourceSpec
and does not alter the raster Integration Input/Output schemas. Desktop has no collection editor,
reorder UI, or multi-preview in N6.

## Unresolved blockers and explicit limits

1. NAVER final Feed carousel/card UI, typography, spacing, labels, and interaction are not
   rendered and have no local pixel golden.
2. The complete platform CTA label list is unresolved; N6 retains `PLATFORM_DEFINED` and does
   not invent labels or icons.
3. Video and still collection item execution is not implemented.
4. Cross-platform pixel tolerance is outside the initial Windows 10/11 x64 golden contract.
5. No upload approval, Naver API integration, network access, or Desktop integration is claimed.

## Original specification sections changed

- Canonical document header and latest-phase priority: N5 v1.20.0 → N6 v1.21.0.
- NAVER SourceSpec section: additive collection shape and source schema v1.1.0.
- Feed profile/asset section: collection runtime, 4–10 bounds, image-only allowlist, safe area.
- Error/validation section: per-item deterministic collection errors and ordering.
- Output/publish section: ordered item artifacts plus atomic collection manifest.
- Version and acceptance sections: source registry v1.1.0, manifest v1.0.0, core v0.8.0.

