# N5 Contract Clarification — NAVER PLATFORM_COMPOSED Source Contract

Status: FROZEN
Phase: `N5_NAVER_PLATFORM_COMPOSED_SOURCE_CONTRACT`
Canonical document: `docs/kakao-bizboard-renderer-spec-v1.md` v1.20.0
Decision date: 2026-08-10 (KST)

## Problem

NAVER GFA Native, Shopping News, Communication Ad, and Mobile DA Feed guides describe
advertiser inputs while the final card/list/feed composition is selected by NAVER. The
existing Renderer Integration Contract is a raster contract and must not be forced to carry
platform-owned final coordinates. Earlier feed notes also combined image, video, and
collection material without a machine-readable source boundary.

## Decision

Freeze a separate `PlatformComposedSourceSpec` (`schemaVersion: 1.0.0`) and nine source
profiles in `contracts/naver-platform-composed-source-profiles.json` for five placements:

- `MOBILE_NATIVE`
- `PC_NATIVE`
- `SHOPPING_NEWS`
- `COMMUNICATION_AD` (LIST and COMMENT variants)
- `MOBILE_DA_FEED` (IMAGE, 2:3 IMAGE, VIDEO, COLLECTION variants)

The SourceSpec validates source fields, source asset metadata, source byte/dimension/MIME
rules, NFC normalization, collection count, and provenance. It rejects final canvas,
final coordinates, final UI, and pixel fingerprints. `finalPresentationOwner` is
`NAVER_PLATFORM`; no final UI raster is produced by N5.

## Evidence and rationale

The official guide pages and linked PDF attachments were inspected and pinned in
`contracts/naver-platform-composed-source-revision.json`. The PDFs are copied unchanged to
`source-guides/naver/platform-composed/`; SHA-256 and page counts are verified by
`scripts/verify-naver-platform-composed-contract.mjs`. Page update and printed PDF update
are both retained when they differ. **[OFFICIAL] [TOOL_OUTPUT]**

Source limits are represented only where the guide publishes them. Decimal byte constants
are derived from the guide's KB/MB units. Missing CTA label lists, promotion-icon labels,
native safe areas, and communication/feed platform UI geometry remain explicitly unresolved;
they are not guessed. **[DERIVED] [INFERRED]**

## Impact

- Adds three machine-readable contracts plus five placement source descriptors, nine profiles,
  N5 error codes, fixtures, source validators, and official PDF provenance.
- Adds a source-only TypeScript validator and exports it from `src/core/index.ts`.
- Adds `verify:naver-platform` to the project check chain.
- Keeps existing Kakao raster Renderer, N4 FREEFORM, SmartChannel 120, Desktop UI, output
  schemas, coordinates, and pixel/request fingerprints unchanged.
- Video runtime is `NOT_IMPLEMENTED`; collection runtime is `DEFERRED_TO_N6`.

## Compatibility and versioning

Canonical document moves from 1.19.0 to 1.20.0 (minor). The Integration Contract remains
1.8.0 because the SourceSpec is a separate public schema and does not alter raster
Input/Output. The integration error registry moves from 1.8.0 to 1.9.0 for additive N5
codes. The new SourceSpec schema and registry start at 1.0.0 because they are new contracts;
the existing template contract remains 1.9.0. **[PROJECT]**

## Unresolved blockers

1. NAVER final UI geometry and placement-specific card/list/feed presentation are platform
   owned and not published as a stable pixel contract.
2. Communication Ad and Feed do not publish complete CTA label lists.
3. Shopping News publishes a promotion-icon count but not the complete label enum.
4. Native and Communication asset safe areas/file-size rules are not complete in the
   inspected attachments.
5. Feed video and collection execution require a later artifact/runtime contract.
6. No N5 renderer, Desktop UI, upload flow, or official-upload approval is claimed.

These are honest contract blockers, not substituted assets or inferred coordinates.

## Original specification sections changed

- Document header and phase-freeze priority: current phase is N5 and document is v1.20.0.
- NAVER channel/composition boundary: source inputs are now separate from raster LayoutMode.
- Source provenance and official-guide evidence: five inspected page/PDF pairs are pinned.
- Field/asset/CTA rules: source-backed values are machine-readable; unknown lists stay
  unresolved.
- Feed boundary: image, video, and collection are distinct source profiles with explicit
  runtime status.
- Version policy and acceptance: SourceSpec is standalone; no template coordinate changed.

## Non-goals

N5 does not implement native UI rendering, feed wrapper rendering, video decoding, collection
multi-artifact publishing, Desktop controls, network access, remote fonts, icon creation, or
final upload approval.
