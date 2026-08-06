# ADR-0016: JPG/JPEG Input Support and Explicit EXIF Orientation

- Status: Accepted
- Date: 2026-08-06
- Scope: C4 Amendment

## Context

Thumbnail crop assets may be JPEG or opaque PNG, while OBJECT_RIGHT remains a transparent
PNG-only product template. File extensions and client MIME strings cannot be trusted, and
JPEG EXIF Orientation must not silently change crop coordinates.

## Decision

The Main/Core boundary detects PNG/JPEG from bytes, verifies decoder success, dimensions,
extension agreement, checksum, and alpha policy. JPEG is decoded with explicit orientation
application before normalized crop execution. Session copies retain `.png`, `.jpg`, or
`.jpeg`; Renderer receives metadata and token only. Output remains RGBA PNG-32.

## Consequences

`THUMBNAIL_BOX_RIGHT` accepts PNG/JPEG and `OBJECT_RIGHT` accepts only alpha PNG. Integration
Contract capability metadata is versioned `1.1.0`. Unsupported WebP/GIF/AVIF/BMP/TIFF/SVG
remain blocked. The existing OBJECT_RIGHT pixel Golden is unchanged.
