# ADR-0029: FREEFORM validation stages

- Status: Accepted
- Date: 2026-08-08
- Scope: `[PROJECT]` FREEFORM Validator F2

## Context

F1 rendered a frozen internal FREEFORM test profile, but input failures and raster/artifact
failures did not have one explicit stage contract. A caller must know whether raster was
allowed and whether a returned issue came from the plan or from the artifact.

## Decision

FREEFORM validation has exactly two stages: `PRE_RENDER` and `POST_RENDER`. Input shape,
FormatProfile/LayoutMode, Plan, assets, placement, fonts, text contract, background, and
unsupported features are PRE_RENDER. PNG, appliedElements, pixel rectangles, overflow ink,
decode, dimensions, and checksum are POST_RENDER. Any ERROR in either stage blocks publish
and download; any PRE_RENDER ERROR also skips raster and PNG encoding.

Runtime FREEFORM issues always carry `stage`. The schema keeps the field additive for legacy
TEMPLATE_LOCKED responses. Ordering is deterministic and does not expose AJV or filesystem
prose.

## Consequences

The Core can fail closed before allocating a canvas for invalid input. Post-render evidence is
separable from input diagnostics, and repeated validation has stable ordering. Existing
TEMPLATE_LOCKED issue payloads and Golden bytes remain unchanged.

## Alternatives rejected

- One mixed validation stage: cannot prove raster was skipped.
- Warning-only invalid input: would permit partial or unsupported artifacts.
- Aesthetic validation: outside a renderer compliance boundary.
