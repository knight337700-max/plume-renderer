# NAVER SmartChannel Template Contract — N1B

This document describes the contract artifacts only. It is not a renderer implementation.

## Registry artifacts

- `contracts/naver-smartchannel-template-contract.json`: 120 identity/provenance records, source
  counts, geometry primitives, whitelist policy and runtime boundary.
- `contracts/naver-smartchannel-template.schema.json`: structural schema for the registry.
- `contracts/naver-smartchannel-typography.json`: source metadata status and existing licensed
  runtime font references; unresolved PSD identity is deliberate.
- `contracts/naver-smartchannel-fixed-components.json`: landing icon, APP CTA, 260 guide and export
  instruction status.
- `contracts/naver-smartchannel-n2-candidates.json`: six registry-only representative candidates.

## Source verification

`scripts/generate-naver-smartchannel-contract.mjs` is a development-time inventory generator. It
reads the external source root and the provided YAML catalog, derives identity axes from the source
filename, reads only PSD header fields, and writes deterministic JSON registries. It is not imported
by Core or Desktop runtime.

`scripts/verify-naver-smartchannel-contract.mjs` validates counts, unique IDs/digests, canvas/header
claims, unresolved status, and (when the source root is present) rechecks every recorded SHA-256.
Use `node scripts/verify-naver-smartchannel-contract.mjs --strict-source` for the local Gate.

## Runtime boundary

No Naver raster dispatch, image resampling, PSD text parsing, font fallback, fixed icon/CTA drawing,
Desktop UI, Preview, Download, network, or upload behavior is present in N1B.
