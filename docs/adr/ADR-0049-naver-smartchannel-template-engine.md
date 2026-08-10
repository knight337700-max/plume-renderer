# ADR-0049: Registry-driven NAVER SmartChannel N2 template engine

- Status: Accepted
- Date: 2026-08-10
- Scope: Core renderer only

## Context

N2A froze 120 SmartChannel template mappings and 39 object placement tokens, but the
repository had no raster runtime. Enabling all 120 variants or copying coordinates into
candidate-specific renderers would make the source-backed contract non-deterministic.

## Decision

Add one `SmartChannelTemplateEngine` for `NAVER_GFA + SMARTCHANNEL`. It resolves the exact
template, candidate whitelist, object placement token, source asset rule, typography metadata,
font preflight, and fixed components from the registries. Only the six N2 candidates are
runtime-enabled. Unknown and known-but-disabled templates fail closed. Output is a transparent
RGBA PNG at the registry canvas height, published through the existing atomic publisher.

## Consequences

- A single registry-driven implementation can expand to N3 without six duplicated renderers.
- Missing, mismatched, or untrusted local fonts prevent render start.
- N2 goldens are project-owned synthetic fixtures and do not claim Photoshop byte parity or
  NAVER upload approval.
- Desktop UI, platform-composed placements, and non-candidate templates remain unimplemented.
