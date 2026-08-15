# ADR-0067: Freeze the accepted Google Static Desktop QA workflow

- Status: Accepted and frozen
- Date: 2026-08-15
- Phase: G3.1 Google Static Desktop User QA and Freeze
- Accepted statement: `ACCEPT_GOOGLE_G3_DESKTOP_QA`

## Context

G3.0.3 connected the existing Google Static profiles, placement plan, canonical
request identity, and deterministic PNG/JPEG export to the production Electron path.
Those behaviors require an explicit human review boundary before they can be frozen.
Automated tests and Codex inspection are evidence for the review, not a substitute for
the user's acceptance.

## Decision

Freeze the full `GOOGLE_STATIC_DESKTOP_QA` scope at the reviewed source/build identity.
The freeze covers all 14 profiles, 11 diagnostics, Fit/Actual preview, placement
controls, PNG/JPEG local encoding, shared Preview/Validator/Export identity, stale
invalidation, and the offline/no-upload/no-Plume boundary.

The exact user acceptance is recorded in
`artifacts/g3-1/google-static-desktop-user-acceptance.json`. The machine-readable
freeze registry is `contracts/google/desktop-qa-freeze.g3.1.json`, registry version
`1.0.0`, status `FROZEN`.

## Consequences

- G2.1 Golden bytes and all KAKAO/NAVER/META frozen outputs remain unchanged.
- Review screenshots, traces, and transform outputs remain non-normative evidence.
- Runtime code and package dependencies are unchanged after acceptance.
- Canonical documentation advances one minor version to `1.30.0`; Desktop/package and
  Renderer Core/Validator versions remain unchanged.
- The next phase is `G4_GOOGLE_STATIC_CHANNEL_COMPLETENESS_AND_RELEASE_FREEZE`.

## Rejected alternatives

- Freezing from automated test results without the exact user statement.
- Promoting arbitrary transform/JPEG combinations to new Golden fixtures.
- Adding Google Ads upload/API, OAuth, remote assets, telemetry, or Plume integration.
