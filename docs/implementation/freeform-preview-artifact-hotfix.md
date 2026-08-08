# FREEFORM Preview Artifact hotfix

Status: `IMPLEMENTED` in Desktop `0.8.1`.

## Root cause

The F4 controller returned FREEFORM images as `data:` URLs. Desktop CSP intentionally allows
only local application resources and `kbr-preview:` images, so a JPEG result could have a
valid Core artifact and a visible `<img>` element while its pixels were rejected by CSP.
The existing E2E asserted element visibility but not `naturalWidth`/`naturalHeight`.

Separately, `renderFreeform` and the Desktop adapter treated every Core ERROR as if raster
had never completed. Encoded PNG bytes were discarded when the file-size validator added a
POST_RENDER error, coupling Preview availability to publish eligibility.

## Implementation

`DesktopSessionManager` now stores Preview format, MIME, byte length, digest, and publish
eligibility with the opaque token. The `kbr-preview:` protocol reads that record and sends
the canonical Content-Type. Renderer UI receives metadata and the token URL only; it never
receives a local absolute path or `file:` URL.

The Core raster, PNG/JPEG encoders, validators, profile limits, and fingerprints are
unchanged. A Desktop-only internal Preview entry point retains artifacts and forces
`publish:false`. Public Core calls still return no artifact on ERROR. When encoded bytes
exist, the Preview response stays `BLOCKED`, keeps all ERROR
severities/stages, sets `downloadAllowed=false`, writes no manifest, and exposes the bytes
only to the private Preview session.

Eligibility is deterministic:

- PRE_RENDER ERROR: no artifact, Preview/publish/download blocked.
- POST_RENDER ERROR plus artifact: Preview allowed, publish/download blocked.
- No ERROR plus artifact: Preview/publish/download allowed.

F3A FREEFORM message keys have Korean Desktop translations. File-size messages preserve
raw `actual`/`expected` evidence and add a readable current/max byte sentence.

## Verification

Tests assert JPEG MIME and 1200×600 natural dimensions, oversized PNG Preview retention,
POST_RENDER stage propagation, publish denial, PRE_RENDER artifact absence, translation
coverage, token-only CSP, and unchanged Template/FREEFORM Golden digests.
