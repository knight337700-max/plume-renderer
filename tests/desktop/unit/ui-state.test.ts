import { describe, expect, it } from "vitest";

import type { PreviewResult, ProductSelectionResult } from "../../../apps/desktop/shared/src/index.js";
import {
  canExport,
  initialUiState,
  uiReducer,
} from "../../../apps/desktop/renderer-ui/src/app/state.js";

const product: Extract<ProductSelectionResult, { status: "SELECTED" }> = {
  status: "SELECTED",
  assetToken: "0b3b1ad0-ef9e-4fb9-9e08-e9d3e8bcb792",
  fileName: "product.png",
  bytes: 100,
  width: 260,
  height: 160,
  hasAlpha: true,
  sha256: "a".repeat(64),
};

function preview(requestSequence: number, validationStatus: PreviewResult["validationStatus"] = "PASS"): PreviewResult {
  return {
    requestSequence,
    previewToken: "c758ce81-f6a0-4471-bb41-adf7706f9218",
    previewUrl: "kbr-preview://preview/c758ce81-f6a0-4471-bb41-adf7706f9218",
    canonicalInputDigest: "b".repeat(64),
    productAssetDigest: product.sha256,
    previewPngDigest: "c".repeat(64),
    pngMetadata: { format: "PNG", colorType: "RGBA", bitDepth: 8, hasAlpha: true, width: 1029, height: 258, bytes: 10_000 },
    measurements: null,
    validationStatus,
    errors: validationStatus === "ERROR" ? [{ code: "KBR-TEXT-007", severity: "ERROR", path: "/copy", messageKey: "text.advertiser_not_in_copy" }] : [],
    warnings: validationStatus === "WARNING" ? [{ code: "KBR-LAYOUT-009", severity: "WARNING", path: "/assets/product/path", messageKey: "layout.object_near_slot_edge" }] : [],
    generatedAt: "2026-08-05T00:00:00.000Z",
  };
}

describe("Desktop UI state model", () => {
  it("invalidates PASS immediately when input changes", () => {
    let state = uiReducer(initialUiState, { type: "PRODUCT_SELECTED", product });
    state = uiReducer(state, { type: "PREVIEW_STARTED", requestSequence: 2 });
    state = uiReducer(state, { type: "PREVIEW_RESOLVED", result: preview(2) });
    expect(state.phase).toBe("VALID_PASS");

    state = uiReducer(state, { type: "FIELD_CHANGED", field: "headline", value: "변경" });
    expect(state.phase).toBe("DIRTY");
    expect(state.preview).toBeNull();
    expect(canExport(state)).toBe(false);
  });

  it("ignores a stale asynchronous Preview result", () => {
    let state = uiReducer(initialUiState, { type: "PRODUCT_SELECTED", product });
    state = uiReducer(state, { type: "PREVIEW_STARTED", requestSequence: 7 });
    state = uiReducer(state, { type: "FIELD_CHANGED", field: "subcopy", value: "최신 입력" });
    const afterDirty = state;
    state = uiReducer(state, { type: "PREVIEW_RESOLVED", result: preview(7) });
    expect(state).toEqual(afterDirty);
    expect(state.phase).toBe("DIRTY");
  });

  it("allows export for current PASS or WARNING only", () => {
    for (const status of ["PASS", "WARNING"] as const) {
      let state = uiReducer(initialUiState, { type: "PRODUCT_SELECTED", product });
      state = uiReducer(state, { type: "PREVIEW_STARTED", requestSequence: 3 });
      state = uiReducer(state, { type: "PREVIEW_RESOLVED", result: preview(3, status) });
      state = uiReducer(state, {
        type: "OUTPUT_SELECTED",
        output: { status: "SELECTED", outputDirectoryToken: "a0989085-049e-42cd-825f-996f7d86e86e", displayName: "output" },
      });
      expect(canExport(state)).toBe(true);
    }
  });

  it("blocks export for ERROR and while validating", () => {
    let state = uiReducer(initialUiState, { type: "PRODUCT_SELECTED", product });
    state = uiReducer(state, { type: "PREVIEW_STARTED", requestSequence: 4 });
    expect(canExport(state)).toBe(false);
    state = uiReducer(state, { type: "PREVIEW_RESOLVED", result: preview(4, "ERROR") });
    expect(state.phase).toBe("VALID_ERROR");
    expect(canExport(state)).toBe(false);
  });
});
