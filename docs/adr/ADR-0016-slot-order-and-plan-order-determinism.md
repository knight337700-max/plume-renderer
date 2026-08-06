# ADR-0016: Slot order and Plan order determinism

- Status: Accepted
- Date: 2026-08-06

## Context

JSON arrays preserve caller order, but pixel output must not change when a caller serializes
the two plans in a different order.

## Decision

`imageSlotId` is the only connection key. Execution, composition, fingerprints that affect
pixels, and AppliedImagePlacements use the frozen Template order
`IMAGE_PRIMARY`, `IMAGE_SECONDARY`. The request fingerprint intentionally retains original
array order and source provenance.

## Consequences

Plan-order permutations are pixel/artifact equivalent while remaining auditable as distinct
requests. Duplicate, missing, or unknown Slot IDs are deterministic ERRORs.
