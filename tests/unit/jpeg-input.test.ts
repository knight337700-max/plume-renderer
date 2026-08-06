import { readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";

import {
  inspectImageFile,
  inspectImageBytes,
} from "../../src/core/image-input.js";
import { analyzeAndResizeProduct } from "../../src/core/product-image.js";
import { loadContracts } from "../../src/core/contracts.js";
import { projectRoot } from "../helpers.js";

const tempFiles: string[] = [];

afterEach(async () => {
  await Promise.all(tempFiles.splice(0).map(async (file) => {
    try {
      await rm(file, { force: true });
    } catch {
      // best-effort fixture cleanup
    }
  }));
});

describe("PNG/JPEG input inspection", () => {
  it.each([
    [1, 80, 40],
    [3, 80, 40],
    [6, 40, 80],
    [8, 40, 80],
  ])("applies EXIF Orientation %s before dimensions and crop coordinates", async (orientation, width, height) => {
    const inspected = await inspectImageFile(path.join(projectRoot, "fixtures", "valid", `jpeg-orientation-${orientation}.jpg`));
    expect(inspected.metadata.detectedMimeType).toBe("image/jpeg");
    expect(inspected.metadata.width).toBe(width);
    expect(inspected.metadata.height).toBe(height);
    expect(inspected.metadata.hasAlpha).toBe(false);
    expect(inspected.metadata.exifOrientation).toBe(orientation);
  });

  it("accepts JPEG and preserves JPEG bytes while decoding to normalized metadata", async () => {
    const file = await inspectImageFile(path.join(projectRoot, "fixtures", "valid", "thumbnail-box-right__asset__jpeg__pass.jpg"));
    expect(file.metadata).toMatchObject({ detectedMimeType: "image/jpeg", width: 260, height: 160, hasAlpha: false });
    expect(file.bytes.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
  });

  it("rejects fake extensions, unsupported signatures, and corrupt JPEG bytes deterministically", async () => {
    const pngBytes = await readFile(path.join(projectRoot, "fixtures", "valid", "thumbnail-box-right__asset__basic__pass.png"));
    const fakeJpeg = path.join(os.tmpdir(), `kbr-fake-extension-${Date.now()}.jpg`);
    await writeFile(fakeJpeg, pngBytes);
    tempFiles.push(fakeJpeg);
    await expect(inspectImageFile(fakeJpeg)).rejects.toMatchObject({ code: "KBR-ASSET-MIME-EXTENSION-MISMATCH" });

    await expect(inspectImageBytes(Buffer.from("RIFF0000WEBP", "ascii"))).rejects.toMatchObject({ code: "KBR-ASSET-MIME-NOT-ALLOWED" });
    await expect(inspectImageBytes(Buffer.from([0xff, 0xd8, 0xff, 0xd9]))).rejects.toMatchObject({ code: "KBR-IMAGE-DECODE-FAILED" });

    const fakeCoreJpeg = path.join(os.tmpdir(), `kbr-core-fake-extension-${Date.now()}.jpg`);
    await writeFile(fakeCoreJpeg, pngBytes);
    tempFiles.push(fakeCoreJpeg);
    const contracts = await loadContracts(projectRoot);
    const coreResult = await analyzeAndResizeProduct(fakeCoreJpeg, null, contracts);
    expect(coreResult.issues.map((entry) => entry.code)).toContain("KBR-ASSET-MIME-EXTENSION-MISMATCH");
  });

  it("keeps OBJECT_RIGHT PNG-only and alpha-required", async () => {
    const contracts = await loadContracts(projectRoot);
    const jpegPath = path.join(projectRoot, "fixtures", "valid", "thumbnail-box-right__asset__jpeg__pass.jpg");
    const jpeg = await analyzeAndResizeProduct(jpegPath, null, contracts);
    expect(jpeg.issues.map((entry) => entry.code)).toContain("KBR-ASSET-MIME-NOT-ALLOWED");

    const opaquePngPath = path.join(os.tmpdir(), `kbr-opaque-${Date.now()}.png`);
    await sharp({ create: { width: 32, height: 32, channels: 3, background: "white" } }).png().toFile(opaquePngPath);
    tempFiles.push(opaquePngPath);
    const opaque = await analyzeAndResizeProduct(opaquePngPath, null, contracts);
    expect(opaque.issues.map((entry) => entry.code)).toContain("KBR-ALPHA-CHANNEL-REQUIRED");
  });
});
