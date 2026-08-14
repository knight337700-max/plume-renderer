# ADR-0060 — Google static contracts and profiles (G1)

- Status: Accepted
- Date: 2026-08-14
- Decision owner: Local Renderer Project
- Supersedes: ADR-0059 (G0.1 architecture freeze remains authoritative for the boundary)

## Context

G0.1 froze the Google Ads static capability boundary but deliberately left runtime profile
resolution and delivery-set validation unimplemented. The next gate needs executable contracts
without changing the frozen KAKAO, NAVER, META, or Google composition decisions.

## Decision

1. Keep Google static profiles in a dedicated registry,
   `contracts/google/static-asset-profiles.g1.json`, rather than adding them to the legacy generic
   freeform catalog.
2. Implement fourteen profiles: seven geometry profiles and seven Demand Gen uploaded-static
   presets. Every artifact is `SINGLE`; every delivery is a `COLLECTION`; every profile is
   `FREEFORM`.
3. Represent platform-composed text, CTA, URL, and layout as `platformFields` metadata. The
   Renderer never rasterizes those fields.
4. Validate encoded PNG/JPEG artifacts with deterministic decimal-byte caps and the eleven frozen
   Google diagnostic IDs. RDA, PMax non-retail, Demand Gen single-image, and Demand Gen uploaded
   static validators are the only G1 delivery validators.
5. Preserve G0.1 architecture version `1.0.0`, legacy twenty-canvas runtime count `0`, and all
   frozen registry hashes.

## Versioning and compatibility

Canonical document `1.24.0 → 1.25.0` is a minor change. Renderer Core `0.9.0 → 0.10.0` and
Validator `1.9.0 → 1.10.0` are minor changes because new Google behavior is executable. Input
`1.2.0`, output `2.0.0`, template `1.9.0`, and Desktop/package `0.10.1` remain unchanged.
The dedicated Google contract/profile registries start at `1.0.0`; the Google architecture
remains `1.0.0`.

## Consequences

The Core can resolve and validate a Google asset set locally and deterministically, but it does
not upload to Google, compose platform-owned text, expose Desktop UI, render legacy Display slots,
or create pixel Goldens. These remain explicit G2-or-later scope.
