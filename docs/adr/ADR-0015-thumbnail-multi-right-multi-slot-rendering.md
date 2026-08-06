# ADR-0015: THUMBNAIL_MULTI_RIGHT multi-slot rendering

- Status: Accepted
- Date: 2026-08-06

## Context

THUMBNAIL_MULTI_RIGHT requires two fixed 172×172 rounded image slots while retaining the
existing transparent Canvas and text contract.

## Decision

Implement a dedicated deterministic rasterizer with independent per-slot Crop, mask, Asset,
Candidate, and Subject Protection. Composite order is PRIMARY then SECONDARY, and no guide
or placeholder pixels are emitted.

## Consequences

The existing single-slot renderer remains unchanged. Multi-slot output always reports two
`AppliedImagePlacement` records and blocks the artifact when either slot is invalid.
