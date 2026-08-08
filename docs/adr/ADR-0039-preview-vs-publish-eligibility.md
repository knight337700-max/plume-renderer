# ADR-0039: Separate Preview availability from publish eligibility

- Status: Accepted
- Date: 2026-08-08
- Scope: Desktop FREEFORM Preview

## Context

A FREEFORM artifact can fail compliance only after raster and encoding. Treating that
POST_RENDER ERROR like a PRE_RENDER input error hid useful Preview pixels and made it harder
to correct file-size or output-compliance failures. The ERROR must still block final files.

## Decision

Represent `hasRenderableArtifact`, `previewAllowed`, `publishAllowed`, and
`downloadAllowed` separately. Missing or PRE_RENDER-invalid input cannot produce a Preview.
An encoded artifact with only POST_RENDER errors remains visible in the private session,
while publish and download stay false. Any export attempt against such a token is rejected
in Electron Main before Core publish, and Core publish remains fail-closed.

The Desktop-only internal Preview entry point forces artifact retention with `publish:false`.
It is not exported from the public Core index; default Core result semantics and all public
Renderer contracts remain unchanged.

## Consequences

- Validator severities and stages are preserved rather than downgraded.
- No manifest or final artifact is written for a POST_RENDER ERROR.
- The UI can explain whether the user must fix input or final compliance.
- Existing atomic publish and stale Preview gates remain intact.
