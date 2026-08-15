import { describe, expect, it } from "vitest";

import { isPointInsidePreviewContent, normalizedPointerDelta, resolveFitPreviewGeometry } from "../../../apps/desktop/renderer-ui/src/features/google/google-preview-geometry.js";

describe("Google Static preview view geometry", () => {
  it("uses the smaller width/height scale and never exceeds the viewport", () => {
    const result = resolveFitPreviewGeometry({ width: 858, height: 475 }, { width: 1200, height: 1200 });
    expect(result).not.toBeNull();
    expect(result?.scale).toBeCloseTo(475 / 1200);
    expect(result?.width).toBeLessThanOrEqual(858);
    expect(result?.height).toBeLessThanOrEqual(475);
  });

  it("rejects zero or non-finite measurements", () => {
    expect(resolveFitPreviewGeometry({ width: 0, height: 475 }, { width: 1200, height: 628 })).toBeNull();
    expect(resolveFitPreviewGeometry({ width: Number.NaN, height: 475 }, { width: 1200, height: 628 })).toBeNull();
  });

  it("maps pointer movement against the displayed content rect", () => {
    const rect = { left: 100, top: 50, width: 600, height: 300 };
    expect(isPointInsidePreviewContent({ x: 400, y: 200 }, rect)).toBe(true);
    expect(isPointInsidePreviewContent({ x: 20, y: 200 }, rect)).toBe(false);
    expect(normalizedPointerDelta({ x: 400, y: 200 }, { x: 550, y: 275 }, rect)).toEqual({ x: 0.25, y: 0.25 });
  });
});
