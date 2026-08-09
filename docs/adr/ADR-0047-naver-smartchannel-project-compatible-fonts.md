# ADR-0047: Approve Verified Project-Compatible SmartChannel Font Builds

- Status: Accepted — N1D.2
- Date: 2026-08-09

## Context

The user-specified Apple SD Gothic Neo archive files have PostScript aliases
`AppleSDGothicNeoB00`, `M00`, `R00`, and `SB00`, not the PSD source strings. Treating the
name mismatch as an absolute blocker would conflate source provenance with runtime safety.
The previous SF audit also treated hidden source variants as export-capable without computing
effective composite contribution.

## Decision

Permit a controlled source-different build only when the project compatibility registry records
the local digest, actual SFNT identity/tables, complete source glyph coverage, distinct style data,
and overflow-free representative metrics. Runtime lookup uses a `fontToken`; source PS names
remain provenance metadata. Reclassify SF layers using effective visibility and contribution:
hidden layers with zero contribution are `HIDDEN_SOURCE_TEXT` and are not runtime required.

## Consequences

N2 readiness is true for the current local-only environment. This does not claim Photoshop
byte/pixel parity, font redistribution rights, or Naver upload approval. Renderer/UI/Golden work
remains a later phase.
