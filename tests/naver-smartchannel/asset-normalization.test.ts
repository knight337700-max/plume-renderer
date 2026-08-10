import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  NAVER_SMARTCHANNEL_OBJECT_MAX_HEIGHT,
  NAVER_SMARTCHANNEL_OBJECT_MAX_OPAQUE_PIXELS,
  NAVER_SMARTCHANNEL_OBJECT_MAX_WIDTH,
  normalizeSmartChannelObject,
} from "../../src/core/index.js";
import { hasIssueMessageTranslation, issueMessage } from "../../apps/desktop/renderer-ui/src/features/validation/messages.js";
import { projectRoot } from "../helpers.js";

type Rgba = { bytes: Buffer; width: number; height: number };
const region = { x: 0, y: 0, width: 260, height: 160 };

function rgba(width: number, height: number, draw: (x: number, y: number) => number): Rgba {
  const bytes = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = Math.max(0, Math.min(255, draw(x, y)));
      const index = (y * width + x) * 4;
      bytes[index] = 80;
      bytes[index + 1] = 120;
      bytes[index + 2] = 180;
      bytes[index + 3] = alpha;
    }
  }
  return { bytes, width, height };
}

function ellipseAsset(width: number, height: number, rx: number, ry: number): Rgba {
  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);
  return rgba(width, height, (x, y) => {
    const dx = (x - cx) / rx;
    const dy = (y - cy) / ry;
    return dx * dx + dy * dy <= 1 ? 255 : 0;
  });
}

function containedBy(inner: { x: number; y: number; width: number; height: number } | null, outer: typeof region): boolean {
  return inner === null || inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height;
}

describe("N7.4 SmartChannel final-alpha asset normalization fixtures", () => {
  it("G1 trims a large transparent source without source-canvas mismatch", async () => {
    const asset = ellipseAsset(2048, 1366, 522, 280);
    const result = await normalizeSmartChannelObject(asset, region);
    expect(result.diagnostics.sourceCanvas).toEqual({ width: 2048, height: 1366 });
    expect(result.diagnostics.normalizedSize.width).toBeLessThanOrEqual(NAVER_SMARTCHANNEL_OBJECT_MAX_WIDTH);
    expect(result.diagnostics.normalizedSize.height).toBeLessThanOrEqual(NAVER_SMARTCHANNEL_OBJECT_MAX_HEIGHT);
    expect(containedBy(result.diagnostics.finalBounds, region)).toBe(true);
  });

  it("G2 normalizes a sofa-equivalent 1044:595 alpha shape to about 260:148", async () => {
    const asset = rgba(2048, 1366, (x, y) => {
      if (x < 500 || x > 1543 || y < 385 || y > 979) return 0;
      const horizontal = y >= 640 && y < 760;
      const vertical = x >= 930 && x < 1030;
      return horizontal || vertical ? 255 : 0;
    });
    const result = await normalizeSmartChannelObject(asset, region);
    expect(result.diagnostics.alphaBounds?.width).toBeGreaterThanOrEqual(1044);
    expect(result.diagnostics.alphaBounds?.width).toBeLessThanOrEqual(1046);
    expect(result.diagnostics.alphaBounds?.height).toBeGreaterThanOrEqual(595);
    expect(result.diagnostics.alphaBounds?.height).toBeLessThanOrEqual(597);
    expect(result.diagnostics.normalizedSize.width).toBe(260);
    expect(result.diagnostics.normalizedSize.height).toBeGreaterThanOrEqual(147);
    expect(result.diagnostics.normalizedSize.height).toBeLessThanOrEqual(149);
    expect(result.diagnostics.opaquePixelCount).toBeLessThanOrEqual(NAVER_SMARTCHANNEL_OBJECT_MAX_OPAQUE_PIXELS);
  });

  it("G3 normalizes a logo-like 469:159 transparent asset", async () => {
    const asset = ellipseAsset(842, 595, 234, 79);
    const result = await normalizeSmartChannelObject(asset, region);
    expect(result.diagnostics.normalizedSize.width).toBe(260);
    expect(result.diagnostics.normalizedSize.height).toBe(88);
    expect(result.diagnostics.opaquePixelCount).toBeLessThanOrEqual(NAVER_SMARTCHANNEL_OBJECT_MAX_OPAQUE_PIXELS);
  });

  it("G4 reports an oversized rendered object when contain is not the selected policy", async () => {
    const result = await normalizeSmartChannelObject(rgba(300, 200, () => 255), region, { contain: false });
    expect(result.diagnostics.normalizedSize).toMatchObject({ width: 300, height: 200 });
    expect(result.diagnostics.normalizedSize.width > NAVER_SMARTCHANNEL_OBJECT_MAX_WIDTH || result.diagnostics.normalizedSize.height > NAVER_SMARTCHANNEL_OBJECT_MAX_HEIGHT).toBe(true);
  });

  it("G5 detects a correctly sized object translated outside the region", async () => {
    const result = await normalizeSmartChannelObject(ellipseAsset(400, 200, 200, 90), region, { offsetX: 4 });
    expect(result.diagnostics.normalizedSize.width).toBe(260);
    expect(containedBy(result.diagnostics.finalBounds, region)).toBe(false);
  });

  it("G6 counts final alpha pixels, not transparent padding, for the 70% rule", async () => {
    const result = await normalizeSmartChannelObject(rgba(260, 160, () => 255), region);
    expect(result.diagnostics.opaquePixelCount).toBeGreaterThan(NAVER_SMARTCHANNEL_OBJECT_MAX_OPAQUE_PIXELS);
    expect(result.diagnostics.maxOpaquePixelCount).toBe(29120);
  });

  it("G7 has only official role IDs and no unconditional Medium/SemiBold dependency", async () => {
    const contract = JSON.parse(await readFile(`${projectRoot}/contracts/naver-smartchannel-font-contract.json`, "utf8")) as { roles: Array<{ id: string; required: boolean; weight: number }>; forbiddenCanonicalIds: string[] };
    const policy = JSON.parse(await readFile(`${projectRoot}/contracts/naver-smartchannel-runtime-font-policy.json`, "utf8")) as { runtimeAssets: Array<{ id: string; required: boolean; weight: number }> };
    expect(policy.runtimeAssets.map((entry) => entry.id)).not.toContain("NAVER_SC_APPLE_SD_GOTHIC_NEO_BOLD");
    expect(policy.runtimeAssets.filter((entry) => entry.required).map((entry) => entry.weight).sort()).toEqual([400, 700]);
    expect(contract.roles.filter((entry) => entry.required).map((entry) => entry.id)).toEqual(["NAVER_SC_NANUM_BARUN_GOTHIC_BOLD", "NAVER_SC_NANUM_BARUN_GOTHIC_REGULAR"]);
    expect(contract.forbiddenCanonicalIds).toHaveLength(4);
  });

  it("G8 translates all SmartChannel validator messages", () => {
    const keys = [
      "naver_smartchannel.asset_dimension_mismatch",
      "naver_smartchannel.object_out_of_region",
      "naver_smartchannel.object_opaque_pixel_limit",
      "naver_smartchannel.font_unavailable",
    ];
    for (const key of keys) expect(hasIssueMessageTranslation(key)).toBe(true);
    expect(issueMessage({ code: "NAVER_SMARTCHANNEL_FONT_UNAVAILABLE", severity: "ERROR", messageKey: "naver_smartchannel.font_unavailable", path: "/fonts/main", expected: { fontId: "NAVER_SC_NANUM_BARUN_GOTHIC_BOLD" }, actual: { status: "UNRESOLVED_ASSET" } })).not.toContain("등록된 번역이 없습니다");
  });
});
