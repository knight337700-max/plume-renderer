# ADR-0027 — FREEFORM Core Raster dispatch

- Status: Accepted
- Phase: F1
- Decision type: `[PROJECT]`

## Decision

Resolve `layoutMode` at the Renderer entry. The omitted/default mode is the existing
`TEMPLATE_LOCKED` path. `FREEFORM` is routed to a separate Core Raster function that
requires an exact FormatProfile and a `CreativeLayoutPlan`; it never constructs a
Template slot or rewrites existing Template coordinates.

## Rationale

This keeps the F0 contract additive and makes regression proof meaningful: existing
Template code and Golden PNG bytes do not pass through a new common layout abstraction.
The only executable Profile in F1 is the internal 1029×258 test Profile. Native 1200
remains catalog-blocked.

## Consequences

FREEFORM errors are fail-closed before publish. The existing atomic publisher and PNG
validator are reused. UI and Integration adapter expansion remain follow-up work.
