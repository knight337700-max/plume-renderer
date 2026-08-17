# ADR-0070 — Google Static User Acceptance and Release Freeze

- Status: Accepted
- Phase: `G4_GOOGLE_STATIC_USER_ACCEPTANCE_AND_RELEASE_FREEZE`
- Date: 2026-08-17

## Decision

Record the user's acceptance of the verified G3.2.3 review pack as a normative
release-freeze record while preserving the pack's non-normative evidence class.
Freeze the existing fourteen Google profiles, fourteen G2.1 Goldens, deterministic
PNG/JPEG policy, Preview/Validator/Export identity, and offline runtime boundary.

## Context

The G3.2.3 pack was independently reviewed and its identity is fixed by source
HEAD, generation ID, byte count, ZIP entry count, payload count, and SHA-256. A
release freeze needs a durable acceptance record and a registry that remains
verifiable even when the external ZIP is unavailable.

## Consequences

G4 changes only acceptance, review, freeze evidence, Canonical/version metadata,
verifier/test coverage, and the handoff snapshot. Renderer production behavior,
Golden files, channel outputs, package runtime versions, network policy, and Plume
boundary remain unchanged. Any future baseline change requires a new version and
new acceptance.
