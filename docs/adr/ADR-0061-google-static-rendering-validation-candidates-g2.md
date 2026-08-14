# ADR-0061 — Google static rendering validation and Golden Candidates (G2)

- Status: Accepted
- Date: 2026-08-14
- Decision owner: Local Renderer Project
- Supersedes: ADR-0060 for the current Google implementation phase; G0.1 architecture freeze remains authoritative

## Context

G1 supplied fourteen executable Google static profiles and delivery validators, but no
deterministic raster evidence. G2 must prove local rendering and delivery validation without
introducing Google UI, upload integration, user-approved Goldens, fonts, or network access.

## Decision

1. Add a local deterministic renderer at `src/core/google-static-render.ts` for the seven geometry
   profiles and seven uploaded-display-static profiles. It uses only local bytes, profile presets,
   explicit placement plans, and pinned encoder settings.
2. Keep platform-owned text, CTA, URL, and other `platformFields` metadata-only. They are not
   rasterized and cannot change the rendered bytes.
3. Generate exactly fourteen review artifacts in frozen profile order. Register them in
   `contracts/google/golden-candidates.g2.json` with status `CANDIDATE`; visual acceptance remains
   `PENDING` and `googleGoldenFrozen` remains `false`.
4. Validate repeat-render byte equality, source/plan/artifact digests, exact canvas and MIME,
   decimal-byte caps, placement policy, expected transitional INFO diagnostics, and delivery-set
   behavior. Negative placement plans must block publish.
5. Preserve the G0.1 architecture version `1.0.0`, all frozen channel outputs, zero runtime
   network requests, and zero Plume dependencies.

## Versioning and compatibility

Canonical document `1.25.0 → 1.26.0` is a minor change. Renderer Core `0.10.0 → 0.11.0` and
Validator `1.10.0 → 1.11.0` are minor changes because deterministic Google rendering and the
runtime cardinality/mode checks are additive. Input `1.2.0`, output `2.0.0`, template `1.9.0`,
architecture `1.0.0`, and Desktop/package `0.10.1` remain unchanged. The candidate registry starts
at `0.1.0` because it is review evidence, not a frozen output contract.

## Consequences

The repository now has reproducible candidate PNG/JPEG artifacts and a review index, but those
files are not user-approved Goldens. Google upload/API, Desktop UI, font fallback, platform text
rasterization, legacy Display runtime, and runtime network access remain out of scope.
