# ADR-0044 — Resolve SmartChannel Source Assets and Typography from Official PSD Layers

- Status: Accepted for N1C contract/source gate
- Date: 2026-08-09
- Scope: NAVER_GFA / SMARTCHANNEL

## Context

N1B had 120 source-whitelisted PSDs but left text metadata, source font identity, fixed UI
components, special geometry, and current 280 guide revision unresolved. Runtime rendering was
intentionally out of scope.

## Decision

Use the current official guide download and local external PSD root as source authorities. Verify
the 120 non-Mac PSD SHA-256 set, extract exact layer metadata with a local-only pinned
`psd-tools` toolchain, and register only source layers for landing icons and CTA components.
Persist source metadata and asset digests in machine-readable registries; do not copy font
binaries from PSD/OS/Adobe caches and do not synthesize missing combinations.

The licensed Spoqa runtime files remain available for the existing Kakao contract, but are marked
`LICENSED_BUT_NOT_SOURCE_MATCH` for SmartChannel. N2 pixel Goldens cannot claim exact runtime font
matching until an exact source-compatible font resource is approved.

## Consequences

- Canonical document `1.13.0 → 1.14.0` and Template Contract `1.7.0 → 1.8.0`.
- Integration `1.8.0`, Desktop `0.8.2`, and CreativeLayoutPlan `1.0.0` remain unchanged.
- Landing icons, CTA labels/chevrons/buttons, disclosure baselines and 280 `200×200` geometry
  become source-backed registry facts.
- 260 guide semantics, logo margin validation, export registration, and placement availability
  remain explicitly deferred without affecting N2 pixel geometry.
- SmartChannel Renderer, Desktop UI, Preview, Download, and network behavior remain absent.
