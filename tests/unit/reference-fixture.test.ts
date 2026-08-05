import { readFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { inspectPngIhdr } from "../../src/core/index.js";
import type { BBox } from "../../src/core/types.js";
import { projectRoot } from "../helpers.js";

const referencePath = path.join(projectRoot, "reference", "kakao-tool", "OBJECT_RIGHT.png");

function alphaBox(
  rgba: Uint8Array,
  width: number,
  region: Readonly<{ x: number; y: number; width: number; height: number }>,
): BBox | null {
  let minX = region.x + region.width;
  let minY = region.y + region.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = region.y; y < region.y + region.height; y += 1) {
    for (let x = region.x; x < region.x + region.width; x += 1) {
      const offset = (y * width + x) * 4;
      if ((rgba[offset + 3] ?? 0) > 0) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  return maxX < 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

describe("immutable OBJECT_RIGHT reference fixture", () => {
  it("has the frozen RGBA IHDR and sampled coordinate boxes", async () => {
    const bytes = await readFile(referencePath);
    expect(inspectPngIhdr(bytes)).toEqual({ width: 1029, height: 258, bitDepth: 8, colorType: 6 });

    const raw = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect(alphaBox(raw.data, raw.info.width, { x: 0, y: 0, width: 633, height: 130 })).toEqual({
      x: 49,
      y: 77,
      width: 523,
      height: 45,
    });
    expect(alphaBox(raw.data, raw.info.width, { x: 0, y: 130, width: 633, height: 128 })).toEqual({
      x: 50,
      y: 144,
      width: 533,
      height: 36,
    });

    for (let y = 0; y < 258; y += 1) {
      for (let x = 981; x < 1029; x += 1) {
        expect(raw.data[(y * 1029 + x) * 4 + 3]).toBe(0);
      }
    }
  });
});
