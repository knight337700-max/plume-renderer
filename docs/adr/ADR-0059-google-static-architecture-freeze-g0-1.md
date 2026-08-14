# ADR-0059: Freeze the Google Ads static architecture at G0.1

- Status: Accepted and frozen
- Date: 2026-08-14
- Scope: G0.1 Google Ads static architecture acceptance and contract freeze

## Context

G0 completed official-source-only discovery and proposed a boundary for seven Google
static delivery capabilities. The project accepted that architecture for freeze. The
freeze must preserve unresolved source conflicts and must not activate a Google runtime
profile or alter the already frozen KAKAO, NAVER, or META outputs.

## Decision

1. Freeze the G0 capability matrix, provenance, geometry, delivery semantics, diagnostic
   namespace, and unresolved-rule set as Google architecture version `1.0.0`.
2. Keep renderer primitives reusable where geometry permits, but do not merge campaign
   delivery semantics into one `GOOGLE_STATIC` format profile.
3. Keep RDA, Performance Max, and Demand Gen platform-composed fields outside local
   raster output. Uploaded Display static remains renderer-composed.
4. Keep each image as a `SINGLE` artifact and represent delivery sets as separate
   `COLLECTION` manifests.
5. Preserve the Google Display migration lifecycle boundary in the capability contract.
   No sunset date is invented.
6. Keep official mandatory rules, official recommendations, and project presets as
   separate classifications. Unresolved conflicts remain
   `UNRESOLVED_FAIL_CLOSED` and cannot become mandatory runtime rules.
7. G1 may implement the frozen contracts, but G1 must not change this architecture
   contract as part of implementation.

## Consequences

- Canonical documentation advances from `1.23.1` to `1.24.0`; template, input/output,
  Core, Validator, and Desktop/package versions remain unchanged.
- A deterministic freeze registry pins every authoritative Google architecture record by
  repository-relative path and SHA-256 without a recursive registry self-hash.
- G1 has an explicit gate: it opens only after every freeze verification passes.
- Runtime network access remains prohibited and no Plume, queue, database, cloud, or
  Google upload integration is introduced.

## Rejected alternatives

- Reopening G0 research during freeze: rejected because this phase accepts the reviewed
  architecture; new research belongs to a future contract version.
- Resolving source discrepancies by inference: rejected because it would convert
  recommendations or ambiguous values into unsupported official rules.
- Adding Google runtime profiles during freeze: rejected; runtime implementation belongs
  to `G1_GOOGLE_STATIC_CONTRACTS_AND_PROFILE_IMPLEMENTATION`.

## Records

- `contracts/google/architecture-freeze.g0.1.json`
- `contracts/google/architecture.g0.json`
- `contracts/google/capabilities.g0.json`
- `contracts/google/asset-geometry.g0.json`
- `contracts/google/delivery-contracts.g0.json`
- `contracts/google/provenance.g0.json`
- `contracts/google/diagnostics.g0.json`

**[PROJECT]**
