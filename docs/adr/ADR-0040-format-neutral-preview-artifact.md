# ADR-0040: Use a format-neutral private Preview artifact

- Status: Accepted
- Date: 2026-08-08
- Scope: Electron Main, shared Desktop model, and Renderer UI

## Context

F4 generated a correct JPEG but represented it with a CSP-blocked `data:` URL. Existing
Preview session fields and protocol headers also assumed PNG. The compatibility manifest
field `outputPngDigest` cannot be used to infer the actual format.

## Decision

Store canonical `PNG | JPEG` format and `image/png | image/jpeg` MIME metadata with each
opaque Preview token. Determine the mapping from Core `outputEncoding.format`, with the
artifact format as the internal fallback. Serve bytes through `kbr-preview:` with the stored
Content-Type. Do not add `data:`, `blob:`, `file:`, or absolute-path access to Renderer UI.

Keep PNG-named compatibility fields until a separately versioned public contract change.
The additive Desktop `PreviewArtifact` metadata reports format, MIME, dimensions, byte
length, and artifact digest without transporting raw bytes through public IPC.

## Consequences

- JPEG and PNG use one secure transport and CSP policy.
- No Blob/object URL is created, so lifecycle follows token replacement, invalidation, and
  session cleanup rather than browser URL revocation.
- UI Preview pixels come directly from Core artifact bytes and preserve their aspect ratio.
