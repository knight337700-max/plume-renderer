# ADR-0043: Freeze NAVER SmartChannel templates from the source PSD whitelist

- Status: Accepted for N1B contract, runtime deferred
- Date: 2026-08-09
- Scope: `NAVER_GFA/SMARTCHANNEL`

## Context

N1A intentionally stopped before Naver pixel implementation. The provided SmartChannel source
contains 120 PSDs across 750×160, 750×200 and 750×280. A renderer must not invent missing sides,
affordances or text variants, and source filenames alone are not a stable digest identity because
20 catalog basenames differ from the extracted source root.

## Decision

Use a source-whitelist registry with one template ID per PSD and one PSD per template ID. Match
source records by SHA-256, retain the actual source filename plus catalog filename, and record PSD
header canvas dimensions. Keep height-specific geometry primitives; do not scale templates. Register
landing-icon/APP_CTA combinations as disabled until approved assets and metrics exist. Keep N1B
runtime `CONTRACT_ONLY`.

The `THREE_LINE` label is retained as a source-backed project naming clarification because the N2
candidate and source filenames use it; it does not create a Cartesian variant.

## Consequences

- The registry is deterministic and auditable without committing proprietary PSD binaries.
- N2 may resolve representative PSDs by ID, but it cannot render text or fixed affordances yet.
- Typography and fixed-component status remain explicit blockers rather than hidden assumptions.
- Existing Kakao renderer paths remain outside the Naver registry and retain their geometry.

## Rejected alternatives

- Generating missing combinations by mirroring, height scaling or auto-reflow.
- Treating observed icon raster bounds as approved canonical asset boxes.
- Guessing Photoshop typography from visible strings or guide pixels.
- Bundling external PSDs or downloading assets at runtime.
