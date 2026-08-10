# ADR-0055: Keep SmartChannel copy in editor-owned state

## Status

Accepted for Desktop `0.9.3` (N7.3).

## Context

The SmartChannel controlled input rendered `smartContent[field] || DEFAULT_TEXT[field]`. An
intentional empty string is falsy, so clearing `headline` immediately restored the seeded copy.
The preview request builder repeated the fallback. The user-reported delayed reset was therefore
a deterministic Desktop value-fallback defect; no asynchronous response needed to overwrite state.

## Decision

Hydrate `smartContent` once from `DEFAULT_TEXT`, then use it as the sole source for all SmartChannel
text inputs and preview/export requests. Use nullish reads so `""` remains a user value. Never
write preview results or defaults back into content state. Filter/template selection state and
preview state remain separate, preserving content through compatible template transitions.

## Consequences

Clearing a field is stable, Korean user input is not replaced by a default, and preview/export
cannot silently rehydrate copy. Fields shared by multiple source-backed templates retain their
values. The change is confined to Desktop UI state and regression tests; Core pixels, contracts,
fonts, geometry, fingerprints, and runtime network policy are unchanged. Desktop bumps
`0.9.2 → 0.9.3`.
