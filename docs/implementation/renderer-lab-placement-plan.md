# Renderer Lab Placement Plan

The Desktop Lab uses the same `parsePlacementPlan` and `serializePlacementPlan` functions as the Integration Contract. The Template selector exposes `OBJECT_RIGHT` and `THUMBNAIL_BOX_RIGHT`; the selected capability controls which policy and crop controls are enabled.

`OBJECT_RIGHT` remains fixed to `ALPHA_TRIM_CONTAIN + CONTAIN`, with crop controls visibly disabled and the reason shown. `THUMBNAIL_BOX_RIGHT` enables `SEMANTIC_CROP_COVER` and `MANUAL_CROP`, `COVER`, anchor, subject protection, normalized direct Crop Rect editing, and a deterministic Candidate selector. A missing Crop is sent to Core and produces `KBR-CROP-RECT-REQUIRED`; the Lab never invents a center Crop.

Import rejects unknown fields and malformed JSON with stable KBR error codes. Import does not fill missing values or change `source`. Export emits canonical JSON. The Agent fixture button passes through the same parser and preserves `source=AGENT`, so MANUAL and AGENT provenance share the same execution contract and only the request fingerprint differs when pixel-affecting values are equal. Applied `resolvedSourceCropRect`, source pixel Rect, and destination Rect are displayed from the Core result. Preview and Export call the same Main-process Integration Adapter path; export is enabled only after ERROR 0.

Preview/Export continue to use the existing Main/Core pipeline and download gate. A stale or ERROR Core result cannot be exported. The Lab is a local renderer surface only; it performs no network request and has no Agent or Plume client.
