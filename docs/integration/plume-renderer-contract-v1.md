# Renderer Integration Contract v1

Status: Historical C3 snapshot · superseded by the current independent Integration Contract v1.4.0

This document defines an agent-independent boundary around the local Renderer. The Renderer consumes a serializable JSON request and a runtime `RendererAssetResolver`; it does not import or call Plume, OpenAI, a queue, a database, Railway, or a remote service. A Lab-authored plan and a future Agent-authored plan are equivalent inputs when their pixel-affecting placement values are equivalent.

## Boundary

```text
RendererIntegrationInputV1 (JSON)
  -> strict Schema + deterministic KBR validation
  -> RuntimeAssetResolver(assetRef)
  -> bytes/digest/decode/dimension/alpha checks
  -> Capability + ImagePlacementPlan resolution
  -> existing Renderer Input Adapter
  -> RendererIntegrationOutputV1
```

The JSON layer contains no `Blob`, `Uint8Array`, or absolute path. `assetRef` is a portable reference token; only the runtime resolver knows how to obtain bytes. A resolver failure is `KBR-ASSET-REF-UNRESOLVED`. Declared checksum and dimensions are checked against resolved bytes. `analysis` is advisory and never overrides decoded bytes.

## Placement

`ALPHA_TRIM_CONTAIN` and `CENTER_CONTAIN` use `CONTAIN` and forbid crops. `SEMANTIC_CROP_COVER` uses `COVER` and requires exactly one direct `cropRect` or `cropCandidateId`. `MANUAL_CROP` uses `COVER`, requires a direct crop, and forbids a candidate. The Renderer never invents a crop, clamps a rect, selects a candidate, or changes a policy. Normalized values are finite and bounded with epsilon `1e-9`; pixel conversion is floor/ceil with a minimum `1×1`.

Protected subjects are checked against the applied crop: REQUIRED clipping blocks, PREFERRED clipping warns, and NONE produces no clipping issue. Empty REQUIRED data is an error; there is no object-detection fallback.

## Current capability

At the time of this historical snapshot, the `IMPLEMENTED` production capabilities were
limited to OBJECT_RIGHT and the two thumbnail profiles. The current independent contract
also implements `KAKAO_BIZBOARD_MASK_SEMICIRCLE_RIGHT`; consult the Canonical document and
`contracts/template-capabilities.json` rather than this archived C3 status paragraph.

The integration adapter keeps the legacy C2a Renderer Input and its output untouched. It supplies normalized placement metadata and the actual output checksum in the integration response. Existing Core/CLI Input Schema versions remain unchanged.

## Output and fingerprints

An ERROR produces `status=BLOCKED` with no artifact metadata. A PASS contains applied crop/destination records and an actual PNG checksum. `pixelFingerprint` excludes provenance (`source`, confidence, rationale, warnings, timestamps, absolute paths, and token strings) and includes only pixel-affecting input, actual asset digests, resolved crop, anchor/encoding, and Template Contract `1.2.0`. `requestFingerprint` is the canonical full request. `renderFingerprint` has the same meaning as `pixelFingerprint` for compatibility.

## Fixtures and acceptance

Fixtures under `fixtures/integration` cover contain, manual crop, Agent semantic crop, candidates, invalid geometry, subject protection, checksum/dimension mismatch, unsupported capability, and Manual/Agent equivalence. `pnpm test:integration-contract` verifies the five v1 schemas, stable error codes, geometry/policy/candidate rules, resolver/adapter behavior, and fingerprint determinism. The C2a OBJECT_RIGHT Golden remains byte-equal (`20dc9d62b8650a72115a8d584846399d9cd6dd2c8a0996b4889edb596feb68b1`).
