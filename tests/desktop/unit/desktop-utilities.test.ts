import { describe, expect, it } from "vitest";

import { exportRequestSchema, parseIpcPayload, previewRequestSchema } from "../../../apps/desktop/electron-main/src/ipc/schemas.js";
import { isSafeJobName } from "../../../apps/desktop/electron-main/src/security/safe-filename.js";
import { guideGeometry } from "../../../apps/desktop/renderer-ui/src/features/preview/guide-geometry.js";
import { formatBytes, formatProductMetadata } from "../../../apps/desktop/renderer-ui/src/features/product-file/format.js";

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
});
