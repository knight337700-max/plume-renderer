# ADR-0060 — META M2.1 output compliance and manual-crop candidate boundary

- Status: Accepted for M2.1 audit
- Date: 2026-08-13

## Context

M2 produced valid FREEFORM `CENTER_CONTAIN` artifacts, but those layouts were not suitable visual
Golden candidates for a full-bleed META review. The three META profiles also carried a 300000-byte
hard ERROR whose current official source could not be pinned.

## Decision

Keep `CENTER_CONTAIN` as a generic renderer policy and preserve the M2 artifacts as historical
evidence. New META review candidates must use independent normalized `MANUAL_CROP` rectangles with
`source=MANUAL`, `fitMode=COVER`, and the same source asset. Remove `maximumBytes=300000` from META
profiles only; retain optional generic and non-META byte constraints. Keep Stories as a guide-only
14%/20% warning policy and Reels as exact-geometry `SOURCE_REQUIRED`.

## Consequences

Candidate output is full-bleed JPEG at the three project canvases, with deterministic crop evidence
and no visual Golden approval. The profile registry and Canonical document receive minimal minor
version bumps; runtime Core, Validator, and coordinates do not.
