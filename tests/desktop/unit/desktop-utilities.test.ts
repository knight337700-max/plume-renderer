import { describe, expect, it } from "vitest";

import { exportRequestSchema, parseIpcPayload, previewRequestSchema } from "../../../apps/desktop/electron-main/src/ipc/schemas.js";
import { isSafeJobName } from "../../../apps/desktop/electron-main/src/security/safe-filename.js";
import { previewMimeType, resolvePreviewEligibility } from "../../../apps/desktop/shared/src/index.js";
import { guideGeometry } from "../../../apps/desktop/renderer-ui/src/features/preview/guide-geometry.js";
import { formatBytes, formatProductMetadata } from "../../../apps/desktop/renderer-ui/src/features/product-file/format.js";
import { hasIssueMessageTranslation, issueMessage } from "../../../apps/desktop/renderer-ui/src/features/validation/messages.js";
import integrationErrorRegistry from "../../../contracts/integration-error-registry.json" with { type: "json" };

const validPreview = {
  assetToken: "0b3b1ad0-ef9e-4fb9-9e08-e9d3e8bcb792",
  advertiser: "자코모",
  headline: "자코모 프리미엄 소파",
  subcopy: "거실을 바꾸는 선택",
  jobName: "bizboard-output",
  requestSequence: 1,
};

describe("Desktop utilities", () => {
  it.each(["job-1", "bizboard_output", "result.2026"])("accepts safe job name %s", (name) => {
    expect(isSafeJobName(name)).toBe(true);
  });

  it.each(["../escape", "CON", "LPT1.png", "trailing.", "has space", "C:/absolute"])(
    "rejects unsafe or reserved job name %s",
    (name) => expect(isSafeJobName(name)).toBe(false),
  );

  it("uses strict IPC payload schemas", () => {
    expect(parseIpcPayload(previewRequestSchema, validPreview)).toEqual(validPreview);
    expect(() => parseIpcPayload(previewRequestSchema, { ...validPreview, downloadAllowed: true })).toThrow("DESKTOP-IPC-001");
    expect(() => parseIpcPayload(previewRequestSchema, { ...validPreview, assetPath: "C:/secret.png" })).toThrow("DESKTOP-IPC-001");
    expect(() => parseIpcPayload(previewRequestSchema, { ...validPreview, cta: { mode: "APP_DOWNLOAD" } })).toThrow("DESKTOP-IPC-001");
  });

  it("requires only opaque tokens for export", () => {
    const validExport = {
      ...validPreview,
      previewToken: "c758ce81-f6a0-4471-bb41-adf7706f9218",
      outputDirectoryToken: "a0989085-049e-42cd-825f-996f7d86e86e",
    };
    delete (validExport as Partial<typeof validExport>).requestSequence;
    expect(parseIpcPayload(exportRequestSchema, validExport)).toEqual(validExport);
    expect(() => parseIpcPayload(exportRequestSchema, { ...validExport, outputPath: "C:/outside" })).toThrow();
  });

  it("converts frozen guide coordinates without changing source pixels", () => {
    expect(guideGeometry(1029)).toEqual({
      scale: 1,
      objectSlot: { x: 666, y: 0, width: 315, height: 258 },
      textHardRightEdge: 633,
      minimumGap: 33,
      rightMargin: 48,
    });
    expect(guideGeometry(514.5).objectSlot).toEqual({ x: 333, y: 0, width: 157.5, height: 129 });
  });

  it("formats product metadata without exposing a path", () => {
    expect(formatBytes(12_345)).toContain("12,345");
    expect(formatProductMetadata({ width: 260, height: 160, bytes: 12_345, hasAlpha: true })).toBe(
      "260×160 · 12,345 bytes · alpha 있음",
    );
  });

  it("maps Preview formats to canonical MIME types", () => {
    expect(previewMimeType("PNG")).toBe("image/png");
    expect(previewMimeType("JPEG")).toBe("image/jpeg");
  });

  it("separates Preview availability from publish and download eligibility", () => {
    expect(resolvePreviewEligibility([
      { severity: "ERROR", stage: "PRE_RENDER" },
    ], false)).toEqual({ hasRenderableArtifact: false, previewAllowed: false, publishAllowed: false, downloadAllowed: false });
    expect(resolvePreviewEligibility([
      { severity: "ERROR", stage: "POST_RENDER" },
    ], true)).toEqual({ hasRenderableArtifact: true, previewAllowed: true, publishAllowed: false, downloadAllowed: false });
    expect(resolvePreviewEligibility([], true)).toEqual({ hasRenderableArtifact: true, previewAllowed: true, publishAllowed: true, downloadAllowed: true });
  });

  it("has Korean translations for every registered FREEFORM issue", () => {
    const freeformCodes = integrationErrorRegistry.codes.filter(({ code }) => code.startsWith("KBR-FREEFORM-"));
    expect(freeformCodes).not.toHaveLength(0);
    expect(freeformCodes.filter(({ messageKey }) => !hasIssueMessageTranslation(messageKey))).toEqual([]);
  });

  it("includes raw byte evidence in the file-size exceeded message", () => {
    expect(issueMessage({
      code: "KBR-FREEFORM-FILE-SIZE-EXCEEDED",
      severity: "ERROR",
      stage: "POST_RENDER",
      path: "/output.png",
      messageKey: "freeform.file_size_exceeded",
      actual: { bytes: 800_782 },
      expected: { maximumBytes: 500_000, comparator: "LTE" },
    })).toContain("현재 800782 bytes / 최대 500000 bytes");
  });
});
