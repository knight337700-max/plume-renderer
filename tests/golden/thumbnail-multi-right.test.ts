import { readFile } from "node:fs/promises";
import path from "node:path";

import { GlobalFonts } from "@napi-rs/canvas";
import { describe, expect, it } from "vitest";

import { renderThumbnailMultiRight } from "../../src/core/thumbnail-multi-right.js";
import { sha256Bytes } from "../../src/core/hash.js";

const root = path.resolve(import.meta.dirname, "../..");
GlobalFonts.registerFromPath(path.join(root, "assets", "fonts", "SpoqaHanSansBold.ttf"), "KBR Spoqa Han Sans Bold");
GlobalFonts.registerFromPath(path.join(root, "assets", "fonts", "SpoqaHanSansRegular.ttf"), "KBR Spoqa Han Sans Regular");

describe("THUMBNAIL_MULTI_RIGHT Golden", () => {
  it("is byte deterministic across three runs and preserves the transparent boundaries", async () => {
    const [png, jpeg] = await Promise.all([
      readFile(path.join(root, "fixtures", "valid", "thumbnail-box-right__asset__basic__pass.png")),
      readFile(path.join(root, "fixtures", "valid", "thumbnail-box-right__asset__jpeg__pass.jpg")),
    ]);
    const primary = {
      schemaVersion: "1.1.0" as const,
      imageSlotId: "IMAGE_PRIMARY",
      assetId: "multi-png",
      policy: "MANUAL_CROP" as const,
      source: "MANUAL" as const,
      fitMode: "COVER" as const,
      cropRect: { x: 0, y: 0, width: 1, height: 1 },
      anchor: "CENTER" as const,
      subjectProtection: "NONE" as const,
    };
    const secondary = { ...primary, imageSlotId: "IMAGE_SECONDARY", assetId: "multi-jpeg" };
    const request = {
      input: { copy: { headline: "자코모 프리미엄 소파", subcopy: "거실을 바꾸는 선택" } },
      slots: [
        { imageSlotId: "IMAGE_PRIMARY", asset: { assetId: "multi-png", mimeType: "image/png" as const, assetRef: { type: "FIXTURE_ASSET_ID" as const, value: "multi-png" } }, resolvedAsset: { bytes: png, resolvedMimeType: "image/png" }, resolvedPlan: primary, resolvedSourceCropRect: primary.cropRect },
        { imageSlotId: "IMAGE_SECONDARY", asset: { assetId: "multi-jpeg", mimeType: "image/jpeg" as const, assetRef: { type: "FIXTURE_ASSET_ID" as const, value: "multi-jpeg" } }, resolvedAsset: { bytes: jpeg, resolvedMimeType: "image/jpeg" }, resolvedPlan: secondary, resolvedSourceCropRect: secondary.cropRect },
      ],
    };
    const outputs = await Promise.all([1, 2, 3].map(() => renderThumbnailMultiRight(request)));
    const digests = outputs.map((output) => sha256Bytes(output.bytes));
    expect(digests).toEqual([
      "ec3689f320a20bb242f649759228bae27cec1ea74fe9ff4f3fbcea0988f3cd55",
      "ec3689f320a20bb242f649759228bae27cec1ea74fe9ff4f3fbcea0988f3cd55",
      "ec3689f320a20bb242f649759228bae27cec1ea74fe9ff4f3fbcea0988f3cd55",
    ]);
    const golden = await readFile(path.join(root, "fixtures", "golden", "thumbnail-multi-right__valid__golden.png"));
    expect(outputs[0]?.bytes.equals(golden)).toBe(true);
    const { default: sharp } = await import("sharp");
    const raw = await sharp(outputs[0]?.bytes).raw().toBuffer({ resolveWithObject: true });
    for (let y = 0; y < 258; y += 1) {
      for (const x of [0, 620, 793, 808, 981, 1028]) expect(raw.data[(y * 1029 + x) * 4 + 3]).toBe(0);
    }
  });
});
