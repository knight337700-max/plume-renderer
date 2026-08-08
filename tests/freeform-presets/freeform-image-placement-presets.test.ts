import { describe, expect, it } from "vitest";

import {
  applyImagePlacementPreset,
  calculateContainedDestination,
  centeredCoverCropRect,
  createNeutralImageElement,
} from "../../apps/desktop/renderer-ui/src/features/freeform/image-placement-presets.js";
import { renderFreeform, type FreeformRenderRequest } from "../../src/core/index.js";
import type { CreativeLayoutPlan } from "@kbr/renderer-contract";
import { projectRoot } from "../helpers.js";

const canvas2To1 = { width: 1200, height: 600 } as const;

describe("FREEFORM Desktop image placement presets", () => {
  it("creates a neutral full-canvas IMAGE without a design-side position", () => {
    expect(createNeutralImageElement("image-1", "asset-primary")).toEqual({
      id: "image-1",
      type: "IMAGE",
      assetId: "asset-primary",
      bounds: { x: 0, y: 0, width: 1, height: 1 },
      zIndex: 0,
      opacity: 1,
      placement: {
        policy: "CENTER_CONTAIN",
        source: "MANUAL",
        fitMode: "CONTAIN",
        anchor: "CENTER",
        subjectProtection: "NONE",
      },
    });
  });

  it("applies Fit and Reset as one-shot placement edits while preserving layer values", () => {
    const importedAgentElement = {
      ...createNeutralImageElement("image-1", "asset-primary"),
      bounds: { x: 0.52, y: 0.05, width: 0.43, height: 0.9 },
      zIndex: 37,
      opacity: 0.42,
      placement: {
        policy: "SEMANTIC_CROP_COVER" as const,
        source: "AGENT" as const,
        fitMode: "COVER" as const,
        cropCandidateId: "agent-candidate",
        focalPoint: { x: 0.4, y: 0.6 },
        anchor: "TOP_CENTER" as const,
        subjectProtection: "PREFERRED" as const,
        confidence: 0.87,
        rationale: "agent layout",
      },
    };

    for (const preset of ["FIT_CANVAS", "RESET_PLACEMENT"] as const) {
      const applied = applyImagePlacementPreset(importedAgentElement, preset);
      expect(applied.bounds).toEqual({ x: 0, y: 0, width: 1, height: 1 });
      expect(applied.placement).toEqual({
        policy: "CENTER_CONTAIN",
        source: "MANUAL",
        fitMode: "CONTAIN",
        anchor: "CENTER",
        subjectProtection: "NONE",
      });
      expect(applied.zIndex).toBe(37);
      expect(applied.opacity).toBe(0.42);
    }
  });

  it("calculates exact centered cover crops for landscape, portrait, and equal ratios", () => {
    expect(centeredCoverCropRect({ width: 2400, height: 600 }, canvas2To1)).toEqual({
      x: 0.25,
      y: 0,
      width: 0.5,
      height: 1,
    });
    expect(centeredCoverCropRect({ width: 600, height: 1200 }, canvas2To1)).toEqual({
      x: 0,
      y: 0.375,
      width: 1,
      height: 0.25,
    });
    expect(centeredCoverCropRect({ width: 2000, height: 1000 }, canvas2To1)).toEqual({
      x: 0,
      y: 0,
      width: 1,
      height: 1,
    });
  });

  it("keeps runtime precision for the 2048x1365 to 1200x600 acceptance case", () => {
    const source = { width: 2048, height: 1365 } as const;
    const crop = centeredCoverCropRect(source, canvas2To1);
    const expectedHeight = (2048 / 1365) / 2;
    expect(crop).toEqual({
      x: 0,
      y: (1 - expectedHeight) / 2,
      width: 1,
      height: expectedHeight,
    });
    expect(calculateContainedDestination(source, canvas2To1)).toEqual({
      x: 150,
      y: 0,
      width: 900,
      height: 600,
    });
  });

  it("writes Fill as an explicit MANUAL_CROP and produces deterministic Core pixels", async () => {
    const source = { width: 260, height: 160 } as const;
    const image = applyImagePlacementPreset(
      createNeutralImageElement("image-1", "asset-primary"),
      "FILL_CANVAS",
      { source, canvas: canvas2To1 },
    );
    expect(image.placement).toEqual({
      policy: "MANUAL_CROP",
      source: "MANUAL",
      fitMode: "COVER",
      cropRect: { x: 0, y: 0.09375, width: 1, height: 0.8125 },
      anchor: "CENTER",
      subjectProtection: "NONE",
    });

    const plan: CreativeLayoutPlan = {
      schemaVersion: "1.0.0",
      formatProfileId: "KAKAO_DISPLAY_NATIVE_2_1",
      source: "MANUAL",
      background: { type: "SOLID", color: "#FFFFFFFF" },
      elements: [image],
    };
    const request: FreeformRenderRequest = {
      layoutMode: "FREEFORM",
      formatProfileId: plan.formatProfileId,
      creativeLayoutPlan: plan,
      assets: [{
        assetId: "asset-primary",
        path: "fixtures/valid/object-right__product__basic__pass.png",
        mimeType: "image/png",
      }],
      output: { format: "PNG" },
    };
    const options = { projectRoot, inputRoot: projectRoot, outputRoot: projectRoot, publish: false } as const;
    const runs = await Promise.all([
      renderFreeform(request, options),
      renderFreeform(request, options),
      renderFreeform(request, options),
    ]);

    expect(runs[0]?.pngDigest).toMatch(/^[a-f0-9]{64}$/u);
    expect(runs[0]?.pixelFingerprint).toMatch(/^[a-f0-9]{64}$/u);
    expect(runs.map((result) => result.pngDigest)).toEqual([runs[0]?.pngDigest, runs[0]?.pngDigest, runs[0]?.pngDigest]);
    expect(runs.map((result) => result.pixelFingerprint)).toEqual([runs[0]?.pixelFingerprint, runs[0]?.pixelFingerprint, runs[0]?.pixelFingerprint]);
    expect(runs.every((result) => result.png && result.appliedElements[0]?.destinationPixelRect.width === 1200)).toBe(true);
  });
});
