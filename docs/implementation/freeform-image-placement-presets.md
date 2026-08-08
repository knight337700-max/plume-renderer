# FREEFORM Image placement presets

Status: `[PROJECT] IMPLEMENTED` in Desktop `0.8.2` (Phase F4C).

This phase changes Desktop manual authoring only. It does not add a Kakao official rule,
change `CreativeLayoutPlan 1.0.0`, or let the Renderer decide layout.

## Root cause and neutral default

The previous values were hand-authored in `FreeformEditor.makeElement()`:

```yaml
bounds: { x: 0.52, y: 0.05, width: 0.43, height: 0.9 }
placementPolicy: CENTER_CONTAIN
zIndex: 10
```

They were neither `[OFFICIAL]` nor a frozen Contract rule. The sequence-based zIndex
increments were also a Desktop example rather than a Contract decision. New IMAGE elements
now use the following `[PROJECT]` neutral authoring state:

```yaml
bounds: { x: 0, y: 0, width: 1, height: 1 }
placement:
  policy: CENTER_CONTAIN
  source: MANUAL
  fitMode: CONTAIN
  anchor: CENTER
  subjectProtection: NONE
zIndex: 0
opacity: 1
```

New TEXT and LOGO elements also start at zIndex `0`. Equal zIndex composition remains
deterministic through the frozen original-elements-array-order rule. Their existing geometry
defaults remain visible Desktop authoring choices: TEXT uses `{x:0.06,y:0.12,w:0.62,h:0.24}`
and LOGO uses `{x:0.76,y:0.06,w:0.18,h:0.14}`. F4C adds no TEXT/LOGO design presets and does
not claim those coordinates as official.

## One-shot IMAGE actions

The selected IMAGE editor exposes three explicit actions above Geometry:

- `FIT_CANVAS` / 캔버스에 맞춤: full-canvas bounds and fresh `CENTER_CONTAIN`; cropRect,
  cropCandidateId, focalPoint, and placement provenance helpers are absent.
- `FILL_CANVAS` / 캔버스 채우기: full-canvas bounds and a fresh `MANUAL_CROP` whose normalized
  centered cropRect is written into the Plan by Desktop.
- `RESET_PLACEMENT` / 배치 초기화: the same bounds and placement as Fit while preserving the
  element's zIndex and opacity.

These are one-shot Plan edits, not constraints. Any later geometry edit is retained. Every
action uses the existing `updatePlan` path, invalidates the current Preview eligibility, and
requires another Core Preview before export.

## Deterministic centered crop

Desktop reads the selected asset dimensions produced by the existing image inspection path.
Those values are the actual oriented dimensions (EXIF orientation is applied during image
inspection). The target is always the selected fixed FormatProfile's Registry canvas; profile
IDs and Safe Zone values are not hardcoded.

For `sourceRatio = sourceWidth/sourceHeight` and
`targetRatio = canvasWidth/canvasHeight`:

- wider source: `{width: targetRatio/sourceRatio, height: 1,
  x: (1-width)/2, y: 0}`;
- taller source: `{width: 1, height: sourceRatio/targetRatio,
  x: 0, y: (1-height)/2}`;
- equal ratio: `{x:0,y:0,width:1,height:1}`.

No `toFixed`, quantization, Safe Zone adjustment, semantic candidate, or Renderer-side crop
inference is used. Existing validation remains authoritative.

For source `2048×1365` and target `1200×600`, Fit predicts destination
`{x:150,y:0,width:900,height:600}`. Fill writes exactly:

```yaml
cropRect:
  x: 0
  y: 0.12490842490842491
  width: 1
  height: 0.7501831501831502
```

## Plan integrity and boundaries

JSON Import hydrates MANUAL, AGENT, and SAVED_CREATIVE geometry unchanged. No default or
preset runs during import. A preset changes placement only after its button is clicked.
Fill is disabled until the selected element has a locally selected asset with inspected
dimensions and a matching fixed Profile.

F4C does not modify Core FREEFORM raster code, validators, PNG/JPEG encoders, fingerprints,
Format Profiles, schemas, or Template behavior. Runtime networking remains prohibited.

## Automated acceptance

`pnpm test:freeform-presets` verifies neutral creation, Fit/Reset cleanup, zIndex/opacity
preservation, wider/taller/equal crop branches, the 2048×1365 case, and three-run byte and
pixel-fingerprint determinism. Desktop E2E verifies imported AGENT geometry preservation,
button-only mutation, Crop Rect Plan serialization, Preview invalidation, disabled export,
and one-shot editing. Existing Template and FREEFORM Golden files are not regenerated.
