# ADR-0068: Google Static Geometry placement and export manifest revision

- Status: Accepted for implementation; pending new user acceptance
- Date: 2026-08-15
- Phase: G3.0.4

## Context

G3.1 froze the Google Static Desktop QA workflow, but its actual production Geometry defaults did
not consume the frozen G2.1 placement plans. Geometry profiles therefore rendered a generic
runtime plan and did not provide a complete canonical export manifest. Uploaded Display Static
profiles also exposed controls that cannot change an exact-canvas passthrough.

## Decision

1. Package a versioned default-placement registry containing all fourteen G2.1-derived plans.
2. Make the registry the runtime source of truth; fixtures, Goldens, and review artifacts are never
   read to decide a default.
3. Require a non-null plan in every Google request. Geometry uses the exact frozen plan; Uploaded
   Display Static uses `NONE` and exact canvas bounds.
4. Serialize the identity transform (`0.5`, `0.5`, `1`) and derive all user changes deterministically
   from that base. Uploaded placement controls are hidden or disabled.
5. Add Google export manifest schema `1.1.0` with canonical request, placement, encoder, source,
   output artifact digest, and delivery provenance. JPEG does not include `outputPngDigest`.
6. Preserve the G3.1 freeze artifacts byte-for-byte and mark them superseded pending reacceptance.

## Consequences

All fourteen default exports can be compared directly with G2.1 Golden bytes, and a repeated
request has one stable identity. The Desktop/package version advances to `0.13.0`; the Canonical
document advances to `1.31.0`; the Google export manifest advances additively to `1.1.0`. Existing
KAKAO/NAVER/META manifests and raster outputs remain unchanged. A new user review/freeze is
required before this correction can be treated as a release basis.

## Non-goals

This ADR does not regenerate Goldens, modify template coordinates, add Google upload/API or
network access, create a G3.2.1 output pack, or record user acceptance.
