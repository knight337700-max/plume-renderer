import { createCanvas, ImageData } from "@napi-rs/canvas";
import sharp from "sharp";

import type { ContractBundle } from "./contracts.js";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  FONT_ALIAS_BOLD,
  FONT_ALIAS_REGULAR,
  HARD_LIMIT_BYTES,
  HEADLINE_BASELINE_Y,
  SUBCOPY_BASELINE_Y,
  TEXT_DRAW_X,
  WARNING_THRESHOLD_BYTES,
} from "./constants.js";
import { createIssue, sortAndDedupeIssues } from "./errors.js";
import type { CanonicalInput, ProductAnalysis, ValidationIssue } from "./types.js";

export type PngIhdr = {
  width: number;
  height: number;
  bitDepth: number;
  colorType: number;
};

export function inspectPngIhdr(png: Uint8Array): PngIhdr | null {
  const buffer = Buffer.from(png.buffer, png.byteOffset, png.byteLength);
  if (buffer.length < 29 || buffer.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") return null;
  if (buffer.subarray(12, 16).toString("ascii") !== "IHDR") return null;
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    bitDepth: buffer.readUInt8(24),
    colorType: buffer.readUInt8(25),
  };
}

export function renderRgbaPng(input: CanonicalInput, product: ProductAnalysis): Buffer {
  const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
  const context = canvas.getContext("2d");
  const productPixels = new Uint8ClampedArray(
    product.resizedRgba.buffer,
    product.resizedRgba.byteOffset,
    product.resizedRgba.byteLength,
  );
  context.putImageData(
    new ImageData(productPixels, product.resizedWidth, product.resizedHeight),
    product.destinationX,
    product.destinationY,
  );
  context.textBaseline = "alphabetic";
  context.font = `48px "${FONT_ALIAS_BOLD}"`;
  context.fillStyle = "#4C4C4C";
  context.fillText(input.copy.headline, TEXT_DRAW_X, HEADLINE_BASELINE_Y);
  context.font = `39px "${FONT_ALIAS_REGULAR}"`;
  context.fillStyle = "#777777";
  context.fillText(input.copy.subcopy, TEXT_DRAW_X, SUBCOPY_BASELINE_Y);
  return canvas.toBuffer("image/png");
}

export async function validateRenderedPng(
  png: Buffer,
  contracts: ContractBundle,
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  const ihdr = inspectPngIhdr(png);
  if (!ihdr) {
    return [createIssue(contracts.errorRegistry, "KBR-OUTPUT-003", "/output.png")];
  }
  if (ihdr.width !== CANVAS_WIDTH || ihdr.height !== CANVAS_HEIGHT) {
    issues.push(
      createIssue(contracts.errorRegistry, "KBR-OUTPUT-002", "/output.png", {
        expected: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
        actual: { width: ihdr.width, height: ihdr.height },
      }),
    );
  }
  if (ihdr.colorType !== 6 || ihdr.bitDepth !== 8) {
    issues.push(
      createIssue(contracts.errorRegistry, "KBR-OUTPUT-003", "/output.png", {
        expected: { colorType: 6, bitDepth: 8 },
        actual: { colorType: ihdr.colorType, bitDepth: ihdr.bitDepth },
      }),
    );
  }
  let metadata: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
  try {
    metadata = await sharp(png).metadata();
  } catch {
    issues.push(createIssue(contracts.errorRegistry, "KBR-OUTPUT-003", "/output.png"));
    return sortAndDedupeIssues(issues);
  }
  if (!metadata.hasAlpha) issues.push(createIssue(contracts.errorRegistry, "KBR-OUTPUT-004", "/output.png"));
  if (png.byteLength >= HARD_LIMIT_BYTES + 1) {
    issues.push(
      createIssue(contracts.errorRegistry, "KBR-OUTPUT-005", "/output.png", {
        expected: { maximumBytes: HARD_LIMIT_BYTES },
        actual: { bytes: png.byteLength },
      }),
    );
  } else if (png.byteLength >= WARNING_THRESHOLD_BYTES + 1) {
    issues.push(
      createIssue(contracts.errorRegistry, "KBR-OUTPUT-009", "/output.png", {
        expected: { warningThresholdBytes: WARNING_THRESHOLD_BYTES, hardLimitBytes: HARD_LIMIT_BYTES },
        actual: { bytes: png.byteLength },
      }),
    );
  }
  return sortAndDedupeIssues(issues);
}
