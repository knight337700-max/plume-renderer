# Google Static Desktop User QA and Freeze — G3.1

## Decision

The exact user statement `ACCEPT_GOOGLE_G3_DESKTOP_QA` was received after the RUN_A
review package was generated. The accepted scope is the complete
`GOOGLE_STATIC_DESKTOP_QA` workflow at the G3.0.3 review identity.

The accepted Desktop build is the Windows x64 local Electron path from source
`6b89c468c580c3078cb992138538565d43159588`. The review manifest, build identity,
contract hashes, screenshots, traces, and non-normative PNG/JPG evidence are fixed in
`artifacts/g3-1/google-static-desktop-review-manifest.json` and
`artifacts/g3-1/google-static-desktop-user-acceptance.json`.

## Frozen scope

- 14 Google Static runtime profiles: 7 Geometry and 7 Uploaded Display Static.
- 11 active global diagnostics, preserving ERROR/WARNING/INFO semantics.
- Fit-to-view and 100% actual-pixel preview modes.
- Drag, zoom, numeric X/Y/Scale, Reset, and synchronized canonical placement state.
- PNG and JPEG actual local raster encoding; JPEG uses `.jpg`, quality 88, 4:2:0,
  progressive false, metadata passthrough false, and the existing opaque canvas matte.
- Shared Preview/Validator/Export canonical request identity and PASS-only local export.
- Stale invalidation for asset, profile, format, placement, delivery metadata, and
  raster identity changes.
- Runtime network requests 0, Google Ads API/OAuth absent, and Plume dependencies absent.

The fourteen G2.1 Golden files and registry remain immutable. Review PNG/JPG files are
`NON_NORMATIVE_REVIEW_EVIDENCE` and are not Golden fixtures.

## Verification

RUN_A automatic prechecks passed before acceptance: `pnpm check`, Google G0 through
G3.0.3 verifiers, 285 Vitest tests, 42 Playwright/Electron tests without retry,
Desktop production build, and handoff verification. Default Desktop/Core/Frozen
equality remained 14/14 byte-equal and runtime network requests remained 0.

RUN_B revalidates the accepted review identity, creates the acceptance evidence and
freeze registry, runs the dedicated G3.1 verifier, then repeats the complete regression
suite. No runtime source, renderer, UI, Core, Validator, Golden, or package dependency
is changed by this freeze.

## Version record

The Canonical document advances from `1.29.0` to `1.30.0` (minor) to record explicit
user acceptance and the Google Static Desktop QA freeze. Desktop/package `0.12.0`,
Renderer Core `0.11.0`, Validator `1.11.0`, Template `1.9.0`, and the frozen Golden
registry `1.0.0` remain unchanged.

## Artifacts

- Acceptance evidence: `artifacts/g3-1/google-static-desktop-user-acceptance.json`
- Freeze registry: `contracts/google/desktop-qa-freeze.g3.1.json`
- Dedicated verifier: `scripts/verify-g3-1-google-static-desktop-freeze.mjs`
- Review package: `artifacts/g3-1/`
- Next phase: `G4_GOOGLE_STATIC_CHANNEL_COMPLETENESS_AND_RELEASE_FREEZE`
