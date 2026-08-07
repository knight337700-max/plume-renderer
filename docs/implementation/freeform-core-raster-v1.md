# FREEFORM Core Raster v1 (Phase F1)

Status: `IMPLEMENTED_TEST_PROFILE_ONLY`  
Profile: `KBR_FREEFORM_CONTRACT_TEST_1029X258` (1029×258, PNG, Windows x64 target)

## Boundary

The F1 branch is selected only when `layoutMode` is `FREEFORM`. Existing inputs that
omit the field remain `TEMPLATE_LOCKED` and use the unchanged Kakao Bizboard renderer.
F1 does not implement the Native 1200 catalog, UI editing, remote services, Plume,
Agent execution, or any automatic layout generation.

## Execution

```text
FREEFORM request
  → FormatProfile resolve
  → CreativeLayoutPlan validation/default materialization
  → pinned font and project-relative asset digest checks
  → normalized bounds (floor/ceil exclusive pixel rect)
  → stable zIndex + original array order
  → background
  → IMAGE / LOGO placement or TEXT raster
  → RGBA PNG validation
  → appliedElements and JCS fingerprints
  → staging manifest + PNG atomic publish
```

Supported image policies are `ALPHA_TRIM_CONTAIN`, `CENTER_CONTAIN`,
`SEMANTIC_CROP_COVER`, and `MANUAL_CROP`. `MANUAL_CROP` requires the supplied normalized
`cropRect`; semantic crop uses the supplied crop or focal point and never invents an
Agent crop candidate. Alpha trim preserves the meaningful alpha-connected content while
using alpha ≥ 1 for retained fringe and alpha ≥ 8 for visible-component selection.

Text uses only `SPOQA_HAN_SANS_REGULAR` and `SPOQA_HAN_SANS_BOLD` from the registry.
`NO_WRAP` and `EXPLICIT_NEWLINES` are rasterized; `WORD_WRAP` returns
`KBR-FREEFORM-TEXT-WRAP-NOT-SUPPORTED`. `ERROR` overflow blocks publish and `CLIP`
clips to the element pixel bounds. Font fallback and automatic shrink are forbidden.

`SHAPE` remains contract-only and returns `KBR-FREEFORM-ELEMENT-TYPE-NOT-SUPPORTED`.
JPG output returns `KBR-FREEFORM-OUTPUT-FORMAT-NOT-SUPPORTED`.

## Output evidence

`appliedElements` records element type, normalized bounds, destination pixels, zIndex,
original array index, opacity, asset/font digest, and resolved crop pixels. The persisted
manifest has no self-reference. `artifactChecksumSha256` is the final PNG byte digest;
`pixelFingerprint` excludes source/rationale/confidence, while `requestFingerprint`
includes the canonical request provenance.

The F1 test suite covers transparent and solid backgrounds, deterministic repeats,
MANUAL/AGENT pixel equivalence, z-order, text wrapping/overflow, all four image
policies, LOGO alpha trim, invalid input fail-closed behavior, atomic publish, and the
four pre-existing Template Golden hashes.
