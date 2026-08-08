# ADR-0038: Drive the Freeform selector from the canonical FormatProfile registry

- Status: Accepted
- Date: 2026-08-08
- Scope: Desktop Renderer Lab UI

## Context

F3A defines fourteen implemented Kakao Moment fixed profiles and one variable-canvas
catalog-only profile. A second hardcoded list in the UI would drift from Core capabilities
and would make display names and safe-zone metadata unreliable.

## Decision

Build the selector and summary from `contracts/freeform-format-profiles.json`. The registry
provides additive `displayName` metadata. Profiles marked `IMPLEMENTED` are selectable;
catalog-only/variable-canvas profiles are rendered as disabled options. Element add
controls mirror `elementConstraints` only as capability hints; Core remains the final
validator, including JSON Import.

The UI reads canvas, output formats, byte limits, opacity requirement, safe-zone metadata,
and collection rules from the selected profile. It draws a Safe Zone only when numeric
geometry is explicitly present; unknown geometry is shown as manual review without an
inferred rectangle.

## Consequences

- Adding a profile requires registry/Core contract work, not a UI list edit.
- Human labels stay reviewable alongside the canonical ID.
- UI-only zoom, selection, and Safe Zone visibility cannot affect plan fingerprints.
