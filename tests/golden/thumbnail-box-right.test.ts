import { readFile } from "node:fs/promises";
import path from "node:path";

import { GlobalFonts } from "@napi-rs/canvas";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { renderThumbnailBoxRight } from "../../src/core/thumbnail-box-right.js";
import { sha256Bytes } from "../../src/core/hash.js";

const root = path.resolve(import.meta.dirname, "../..");
GlobalFonts.registerFromPath(path.join(root, "assets", "fonts", "SpoqaHanSansBold.ttf"), "KBR Spoqa Han Sans Bold");
GlobalFonts.registerFromPath(path.join(root, "assets", "fonts", "SpoqaHanSansRegular.ttf"), "KBR Spoqa Han Sans Regular");

describe("THUMBNAIL_BOX_RIGHT Golden", () => {
  it("is deterministic and excludes the gray guide placeholder", async () => {
    const assetBytes = await readFile(path.join(root, "fixtures", "valid", "thumbnail-box-right__asset__basic__pass.png"));
    const plan = {
      schemaVersion: "1.1.0" as const,
      imageSlotId: "IMAGE_PRIMARY",
      assetId: "thumbnail-basic",
      policy: "SEMANTIC_CROP_COVER" as const,
      source: "DETERMINISTIC" as const,
      fitMode: "COVER" as const,
      cropRect: { x: 0.1, y: 0, width: 0.8, height: 1 },
      anchor: "CENTER" as const,
      subjectProtection: "NONE" as const,
    };
    const request = {
      input: { copy: { advertiser: "자코모", headline: "자코모 프리미엄 소파", subcopy: "거실을 바꾸는 선택" } },
      asset: { assetId: "thumbnail-basic", mimeType: "image/png" as const, assetRef: { type: "FIXTURE_ASSET_ID" as const, value: "thumbnail-basic" } },
      resolvedAsset: { bytes: assetBytes, resolvedMimeType: "image/png" },
      resolvedPlan: plan,
      resolvedSourceCropRect: plan.cropRect,
    };
    const [first, second] = await Promise.all([renderThumbnailBoxRight(request), renderThumbnailBoxRight(request)]);
    expect(sha256Bytes(first.bytes)).toBe("f1111ee8f36fe1d8ccc7aaa445b175906e8a6432027d3e65764158ad40c52996");
    expect(first.bytes.equals(second.bytes)).toBe(true);
    const golden = await readFile(path.join(root, "fixtures", "golden", "thumbnail-box-right__valid__golden.png"));
    expect(first.bytes.equals(golden)).toBe(true);
    const raw = await sharp(first.bytes).raw().toBuffer({ resolveWithObject: true });
    for (let y = 0; y < raw.info.height; y += 1) {
      for (let x = 981; x < raw.info.width; x += 1) expect(raw.data[(y * raw.info.width + x) * 4 + 3]).toBe(0);
    }
    expect(Array.from(raw.data.slice((36 * raw.info.width + 666) * 4, (36 * raw.info.width + 666) * 4 + 3))).not.toEqual([217, 217, 217]);
  });
});
