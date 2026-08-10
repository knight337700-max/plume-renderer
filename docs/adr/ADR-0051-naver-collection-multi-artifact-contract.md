# ADR-0051: NAVER Collection Multi-Artifact Source Contract

- Status: Accepted
- Date: 2026-08-10
- Phase: N6

## Context

NAVER Feed Collection is a platform-composed payload. The renderer can validate and preserve
source images, but it does not own the final carousel/card wrapper or its pixel geometry. N5's
deferred collection profile needed an execution model that could be reused by future carousel
channels without introducing a NAVER-only array contract.

## Decision

Reuse the existing orthogonal `ArtifactCardinality` enum and define generic ordered
multi-artifact primitives. Implement the NAVER Feed image-only collection runtime:

- 4–10 ordered items with unique stable IDs;
- item source profile `NAVER_FEED_COLLECTION_ITEM_IMAGE_600X600` only;
- source bytes preserved without crop/resize/final UI composition;
- item byte checksum, decoded-pixel fingerprint, item request fingerprint, and ordered
  collection/request fingerprints;
- one strict collection manifest with `finalUiRendered=false` and no UI checksum;
- flush/close staging writes and manifest-last atomic rename;
- fail-closed validation and publish, with `partialPublish=false`.

## Consequences

Positive:

- A valid collection is a deterministic ordered payload rather than a misleading screenshot.
- Item and collection identity can be compared across runs and future platform adapters.
- Existing SINGLE raster contracts remain untouched.
- The item image allowlist prevents accidental video/still or unapproved asset execution.

Tradeoffs:

- N6 returns multiple source artifacts, not one final Feed PNG.
- The complete CTA label list and platform final UI remain unresolved.
- Desktop editing and reorder controls are deferred to N7.

## Alternatives rejected

- Rendering a synthetic Feed carousel screenshot: rejected; final presentation is NAVER-owned.
- Sorting items by ID or asset digest: rejected; input order is the contract.
- A NAVER-only `items[]` schema unrelated to cardinality: rejected; future Meta/Google
  multi-artifact adapters need the same generic model.
- Converting or re-encoding source images: rejected; item bytes are source artifacts and their
  SHA-256 is part of the manifest.
- Publishing items as they validate: rejected; one failure must block the entire collection.

## Verification

`node scripts/verify-naver-platform-composed-contract.mjs` checks the additive SourceSpec/schema,
generic manifest, source registry, attachment provenance, item bounds and fixtures. The N6
collection test covers valid 4/10, invalid 3/11, duplicate IDs, invalid asset/profile/safe-area
and nested collection errors, deterministic repeated fingerprints, order sensitivity, and
atomic publish. The full project check remains the regression gate.

