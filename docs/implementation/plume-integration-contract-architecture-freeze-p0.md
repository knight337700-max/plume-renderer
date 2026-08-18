# P0 PLUME Integration Contract Architecture Freeze

## Result

P0 freezes a neutral boundary for future PLUME consumption without adding a PLUME
runtime. The machine-readable source of truth is
`contracts/p0-plume-architecture-freeze.json` and its 170-row capability matrix.

## Canonical flow

```text
asset bytes + target profile + capability hints
  -> manual or external authoring candidate
  -> user/system selection
  -> schema and profile validation
  -> immutable ImagePlacementPlan 1.8.0 + provenance
  -> standalone deterministic Renderer
  -> Validator
  -> publish only when ERROR = 0
```

`PlacementCapabilityHints 1.0.0` is advisory and read-only. The optional
`PlacementProvenanceEnvelope 1.0.0` stays outside core placement input. Timestamp and
producer metadata are excluded from pixel-affecting plan digests. All normalized
geometry is finite and bounded; silent clamp, implicit units, and fallback inference
are forbidden.

## Evidence and inventory

The matrix counts active/frozen keys exactly once: KAKAO 21, NAVER 132, META STATIC 3,
and GOOGLE STATIC 14. Source registry paths, versions, and SHA-256 values are recorded
per row. Unresolved behavior-affecting rows and duplicate keys are zero. The 16
contract-only invalid fixtures each carry a deterministic error code and
`EXPECTED_FAIL_CONFIRMED` evidence.

## Boundaries and exclusions

This phase does not implement a PLUME adapter, SDK, network call, queue, retry,
desktop behavior, raster behavior, profile geometry, output, Golden, or accepted-pack
change. P1 is explicitly not started.
