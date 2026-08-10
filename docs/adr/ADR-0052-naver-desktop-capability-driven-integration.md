# ADR-0052: Capability-Driven NAVER Desktop Integration

- Status: Accepted
- Date: 2026-08-10
- Decision owners: Renderer project

## Context

Naver contracts had frozen placement/source semantics but the Desktop entry point exposed only
Kakao mode controls. A mode-first UI could conflate renderer-composed pixels with NAVER-owned
platform presentation.

## Decision

Use a machine-readable capability registry as the Desktop navigation source of truth. The UI
selects Channel first, then Placement, then the editor type declared by the capability:
renderer-composed SmartChannel/FREEFORM or platform-composed Source/Collection. The Electron
Main process maps each request to existing Core functions and enforces strict session-token,
path, validation, fingerprint, and atomic-publish gates.

## Consequences

- Adding a placement is a registry/capability change with an explicit editor and artifact
  cardinality; it does not require a mode-first UI branch.
- Existing FREEFORM editor behavior is reused for Naver Mobile DA/Image Banner.
- Platform-composed previews show normalized source provenance only and never claim final UI.
- The Desktop public version advances `0.8.2 → 0.9.0`; frozen template/source/core versions and
  Kakao goldens do not change.
- Missing exact external SmartChannel fonts remain a deterministic preflight blocker; runtime
  download/fallback is prohibited.

## Rejected alternatives

- A single mode selector before Channel: rejected because it hides placement ownership.
- A new final-UI mock renderer for Naver Native/Feed: rejected because final geometry is
  platform-owned and not in the source contract.
- Duplicating the FREEFORM editor: rejected because it would create divergent placement rules.
