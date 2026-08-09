# ADR-0045: Freeze NAVER SmartChannel Runtime Font Policy

- Status: Accepted — N1D
- Date: 2026-08-09
- Scope: SmartChannel Template Locked contract and preflight only

## Context

Source PSD metadata requires six exact PostScript names. The repository's licensed Spoqa
assets are not source matches, and no lawful, deterministic Windows bundle/system path for the
Apple/SF source binaries was confirmed.

## Decision

Freeze the six-font inventory and a fail-closed resolution policy. Only
`BUNDLED_EXACT`, `SYSTEM_EXACT`, and `EXTERNAL_EXACT` are valid. External exact resources must
be trusted-root relative and pass decode, PostScript, digest, and declared-version checks.
Missing, identity mismatch, or version mismatch prevents render start. Spoqa remains available
to its existing Kakao/FREEFORM scopes but is never aliased to a SmartChannel source font.

## Consequences

N1D policy and tests can pass while N2 remains not ready. No Apple font is copied, downloaded,
converted, or bundled. A later product/rights-holder decision is required to supply a lawful
exact Windows runtime resource. Existing Kakao/FREEFORM contracts and fingerprints are unchanged.

## Evidence

Apple official references are recorded in the policy registry and canonical §34.3:
[Apple Developer Fonts](https://developer.apple.com/fonts/index.html),
[included macOS fonts](https://support.apple.com/en-us/120414), and
[Apple System Fonts](https://developer.apple.com/fonts/system-fonts/).
