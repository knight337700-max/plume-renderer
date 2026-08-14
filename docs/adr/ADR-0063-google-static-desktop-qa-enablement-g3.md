# ADR-0063: Enable Google Static Desktop QA as an additive local workflow

- Status: Accepted
- Date: 2026-08-14
- Phase: G3

## Decision

Expose the fourteen frozen Google Static profiles in the existing Desktop channel selector using
a dedicated `GoogleStaticEditor`. Reuse the existing Main/Core trusted-root, preview-token,
staging publish, and IPC abstractions. Send only an explicit Google Static placement plan to the
deterministic Core raster path. Activate the eleven frozen Google diagnostics in the global Error
Registry and block Export whenever a Google validation result contains an ERROR.

## Context

G2.1 froze fourteen byte-identical artifacts but intentionally left Desktop Google UI absent. A
QA operator needs to inspect profile metadata, provide a local asset and explicit plan, compare a
Fit preview with 100% actual pixels, and save a local artifact/manifest without implying Google
Ads upload or approval.

## Consequences

Positive:

- The Desktop workflow can exercise every frozen profile without duplicating raster logic.
- Delivery metadata is visibly separated from pixels.
- Existing security and atomic-publish gates are reused.
- KAKAO/NAVER/META behavior and Google G2.1 bytes remain unchanged.

Trade-offs:

- The UI is a QA surface, not a Google Ads upload client.
- Project preset labels and explicit plans remain separate from any future platform UI contract.
- The global Error Registry receives a minor additive version bump.

## Rejected alternatives

- Adding Google Ads API/OAuth/upload: outside local Renderer scope and violates runtime network
  prohibition.
- Reusing the generic Freeform editor: it cannot express the required grouped profile catalog,
  metadata-only boundary, or actual-pixel view without obscuring the Google contract.
- Copying or re-encoding frozen Goldens: prohibited by G2.1 freeze semantics.
