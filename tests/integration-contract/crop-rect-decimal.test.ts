import { describe, expect, it } from "vitest";

import {
  INTEGRATION_SCHEMA_VERSION,
  computeFingerprints,
  normalizedRectToPixelRect,
  parsePlacementPlan,
  serializePlacementPlan,
  validateNormalizedRect,
  type ImagePlacementPlan,
  type RendererIntegrationInputV1,
} from "../../packages/renderer-contract/src/index.js";
import {
  CROP_KEYBOARD_STEPS,
  adjustCropRectDraft,
  cropRectToDraft,
  validateCropRectDraft,
} from "../../apps/desktop/renderer-ui/src/features/placement/crop-rect.js";

const baseCrop = { x: 0.123456, y: 0.078125, width: 0.654321, height: 0.8125 } as const;
const basePlan: ImagePlacementPlan = {
  schemaVersion: INTEGRATION_SCHEMA_VERSION,
  imageSlotId: "IMAGE_PRIMARY",
  assetId: "asset-1",
  policy: "MANUAL_CROP",
  source: "MANUAL",
  fitMode: "COVER",
  cropRect: baseCrop,
  anchor: "CENTER",
  subjectProtection: "NONE",
};

const inputFor = (plan: ImagePlacementPlan): RendererIntegrationInputV1 => ({
  schemaVersion: INTEGRATION_SCHEMA_VERSION,
  formatProfileId: "TEST",
  templateId: "TEST",
  copy: {},
  assets: [{ assetId: "asset-1", mimeType: "image/png", assetRef: { type: "FIXTURE_ASSET_ID", value: "asset-1" } }],
  imagePlacementPlans: [plan],
  output: { mimeType: "image/png" },
});

describe("decimal Crop Rect contract", () => {
  it.each([0.5, 0.125, 0.0001, 0.999999])("accepts finite decimal value %s", (value) => {
    expect(validateNormalizedRect({ x: 0, y: 0, width: value, height: value })).toEqual([]);
  });

  it("rejects negative, zero-size, non-finite, and over-bound values without correction", () => {
    expect(validateNormalizedRect({ x: -0.0001, y: 0, width: 0.5, height: 0.5 })).not.toEqual([]);
    expect(validateNormalizedRect({ x: 0, y: 0, width: 0, height: 0.5 })).not.toEqual([]);
    expect(validateNormalizedRect({ x: 0, y: 0, width: 0.5, height: 0 })).not.toEqual([]);
    expect(validateNormalizedRect({ x: Number.NaN, y: 0, width: 0.5, height: 0.5 })).not.toEqual([]);
    expect(validateNormalizedRect({ x: Number.POSITIVE_INFINITY, y: 0, width: 0.5, height: 0.5 })).not.toEqual([]);
    expect(validateNormalizedRect({ x: 0.500001, y: 0, width: 0.5, height: 0.5 })).not.toEqual([]);
    expect(validateNormalizedRect({ x: 0, y: 0.500001, width: 0.5, height: 0.5 })).not.toEqual([]);
  });

  it("keeps fine normalized changes visible in the deterministic pixel conversion", () => {
    const first = normalizedRectToPixelRect({ x: 0.1, y: 0.2, width: 0.4, height: 0.4 }, 10000, 10000);
    const second = normalizedRectToPixelRect({ x: 0.1005, y: 0.2, width: 0.4, height: 0.4 }, 10000, 10000);
    const narrower = normalizedRectToPixelRect({ x: 0.1, y: 0.2, width: 0.3999, height: 0.4 }, 10000, 10000);
    expect(second.x).toBe(first.x + 5);
    expect(narrower.width).toBeLessThan(first.width);
    expect(normalizedRectToPixelRect({ x: 0.1005, y: 0.2, width: 0.4, height: 0.4 }, 10000, 10000)).toEqual(second);
  });

  it("round-trips six-decimal values through Plan JSON without loss", () => {
    const serialized = serializePlacementPlan(basePlan);
    const parsed = parsePlacementPlan(JSON.parse(serialized));
    expect(parsed.errors).toEqual([]);
    expect(parsed.plan?.cropRect).toEqual(basePlan.cropRect);
    expect(JSON.parse(serialized).cropRect).toEqual(basePlan.cropRect);
  });

  it("includes decimal normalized values in request and pixel fingerprints", async () => {
    const first = inputFor(basePlan);
    const second = inputFor({ ...basePlan, cropRect: { ...baseCrop, x: 0.123556 } });
    const firstFingerprint = await computeFingerprints(first, { "asset-1": "a".repeat(64) }, first.imagePlacementPlans);
    const secondFingerprint = await computeFingerprints(second, { "asset-1": "a".repeat(64) }, second.imagePlacementPlans);
    expect(firstFingerprint.requestFingerprint).not.toBe(secondFingerprint.requestFingerprint);
    expect(firstFingerprint.pixelFingerprint).not.toBe(secondFingerprint.pixelFingerprint);
    expect((await computeFingerprints(first, { "asset-1": "a".repeat(64) }, first.imagePlacementPlans)).requestFingerprint).toBe(firstFingerprint.requestFingerprint);
  });
});

describe("Renderer Lab decimal edit buffer", () => {
  it("preserves incomplete intermediate strings instead of converting them to zero", () => {
    const draft = { ...cropRectToDraft({ x: 0, y: 0, width: 1, height: 1 }), x: "0." };
    expect(validateCropRectDraft(draft).reason).toBe("INCOMPLETE");
    expect(draft.x).toBe("0.");
    expect(validateCropRectDraft({ ...draft, x: "0.123456", width: "0.8" }).rect).toEqual({ x: 0.123456, y: 0, width: 0.8, height: 1 });
    expect(validateCropRectDraft({ ...draft, x: "" }).reason).toBe("INCOMPLETE");
  });

  it("provides deterministic keyboard adjustment values without clamping", () => {
    expect(CROP_KEYBOARD_STEPS).toEqual({ default: 0.1, shift: 0.01, alt: 0.001 });
    const draft = cropRectToDraft({ x: 0, y: 0, width: 1, height: 1 });
    const normal = adjustCropRectDraft({ ...draft, x: "0.2" }, "x", CROP_KEYBOARD_STEPS.default);
    const shift = adjustCropRectDraft({ ...draft, x: "0.2" }, "x", CROP_KEYBOARD_STEPS.shift);
    const alt = adjustCropRectDraft({ ...draft, x: "0.2" }, "x", CROP_KEYBOARD_STEPS.alt);
    expect(normal.x).toBe("0.3");
    expect(shift.x).toBe("0.21");
    expect(alt.x).toBe("0.201");
    expect(adjustCropRectDraft({ ...draft, x: "0.2" }, "x", -CROP_KEYBOARD_STEPS.default).x).toBe("0.1");
    const outOfBounds = adjustCropRectDraft(draft, "x", -CROP_KEYBOARD_STEPS.alt);
    expect(validateCropRectDraft(outOfBounds).reason).toBe("OUT_OF_BOUNDS");
    expect(adjustCropRectDraft({ ...draft, x: "0.2" }, "x", 0.1).x).not.toBe("0.30000000000000004");
  });
});
