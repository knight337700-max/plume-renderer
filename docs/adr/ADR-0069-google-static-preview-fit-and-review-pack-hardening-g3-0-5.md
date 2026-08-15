# ADR-0069: Contain Google previews and harden future review-pack paths

- Status: Accepted for implementation
- Date: 2026-08-15
- Scope: Google Static Desktop Preview view layer and future G3.2.2 evidence tooling

## Context

The G3.2.1 external review found that the production Fit preview used a width-only effective
constraint and a pointer rect for the outer surface. Square, portrait, and vertical artifacts
could be clipped in the UI even though actual exports were complete. The historical review pack
also contained machine-specific absolute paths.

## Decision

Compute Fit with both viewport dimensions, render a measured content rect with centered letterbox,
and map pointer movement only from that rect. Keep Actual Pixels at output CSS dimensions with
scrollable overflow. Treat view changes as non-canonical state. Lock all placement-changing
controls and handlers for Uploaded Display Static. Add a reusable fail-closed pack path scanner
and path-neutral execution identity for the future G3.2.2 generator/verifier.

## Consequences

Preview geometry can change with window size without changing raster bytes, manifests, or
fingerprints. Historical evidence remains byte-preserved. New pack payloads must use relative
paths or logical labels; full local paths cannot be used as provenance.

## Compatibility

G2.1 Goldens, G3.0.4 placement semantics, Google export manifest 1.1, encoder settings, other
channel outputs, and runtime network policy are unchanged. Canonical/Desktop versions receive
patch bumps only (`1.31.0 → 1.31.1`, `0.13.0 → 0.13.1`).
