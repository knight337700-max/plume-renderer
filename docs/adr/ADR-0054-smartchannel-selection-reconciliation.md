# ADR-0054: Reconcile SmartChannel selections from source-backed candidates

## Status

Accepted for Desktop `0.9.2` (N7.2).

## Context

The 0.9.1 SmartChannel filter handler stored `event.currentTarget.value` inside a functional
React state updater. React could execute that updater after event dispatch, when
`currentTarget` was null. The result was a packaged-editor runtime exception and Error Boundary
fallback. Independent of that event bug, changing an upper filter could leave lower dimensions
pointing at a template that no longer existed.

## Decision

Snapshot event values before scheduling state updates. Derive every filter option and selected
template from the ordered, source-backed 120-template registry. After an upper-dimension change,
preserve valid lower selections and reset invalid ones to the first canonical candidate. Keep an
explicit unresolved state if the registry yields no candidate; never synthesize an unsupported
Cartesian combination or silently use another template.

## Consequences

SmartChannel option changes remain mounted in dev and packaged Desktop runs, and future diagnostics
include the selected dimensions. The change is confined to Desktop UI state and tests. Core pixels,
contracts, fonts, geometry, fingerprints and runtime network policy are unchanged. Desktop bumps
`0.9.1 → 0.9.2`.

