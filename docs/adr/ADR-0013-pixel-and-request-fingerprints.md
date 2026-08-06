# ADR-0013: Pixel and Request Fingerprints

- Status: Accepted
- Date: 2026-08-06
- Scope: Determinism and provenance

## Context

A single render fingerprint cannot both prove byte/pixel reproducibility and preserve differences between a manual plan and an Agent plan.

## Decision

Record three values: the actual final byte `artifactChecksumSha256`, a pixel-affecting `pixelFingerprint`, and a full-request `requestFingerprint`. `renderFingerprint` is retained only as an alias of `pixelFingerprint`. Pixel fingerprint canonical input includes actual asset digests, policy/fit/resolved crop, anchor, encoding, copy, format/template, and Template Contract version; it excludes source, confidence, rationale, warnings, timestamps, absolute paths, and reference token strings. Focal point is included only when the implementation uses it for pixels; the current implementation does not.

## Consequences

Manual and Agent plans with identical placement produce the same pixel fingerprint and artifact bytes while their request fingerprints remain distinguishable. Three identical runs must be byte-deterministic on the frozen Windows x64 environment.
