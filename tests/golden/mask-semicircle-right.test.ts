import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { GlobalFonts } from "@napi-rs/canvas";
import { describe, expect, it } from "vitest";

import { MASK_SEMICIRCLE_RIGHT_MASK_ASSET_ID, MASK_SEMICIRCLE_RIGHT_MASK_ASSET_SHA256, renderWithIntegrationAdapter, type RendererIntegrationInputV1 } from "../../packages/renderer-contract/src/index.js";
import { inspectImageFile } from "../../src/core/image-input.js";
import { renderMaskSemicircleRight } from "../../src/core/mask-semicircle-right.js";

const root = path.resolve(import.meta.dirname, "../..");
GlobalFonts.registerFromPath(path.join(root, "assets/fonts/SpoqaHanSansBold.ttf"), "KBR Spoqa Han Sans Bold");
GlobalFonts.registerFromPath(path.join(root, "assets/fonts/SpoqaHanSansRegular.ttf"), "KBR Spoqa Han Sans Regular");
const inputPath = path.join(root, "fixtures/integration/mask-semicircle-right/valid-black-logo-pass/input.json");
const goldenPath = path.join(root, "fixtures/golden/mask-semicircle-right__valid__golden.png");
const expectedHash = "dca6aa2db0c6593fcedb23dfee5a4d625356c3e8d75083e604c9866f45f530d2";

async function renderOnce(input: RendererIntegrationInputV1): Promise<Buffer> {
  const files = new Map<string, string>([
    ["mask-semicircle-right__image__basic__pass.png", path.join(root, "fixtures/valid/mask-semicircle-right__image__basic__pass.png")],
    ["mask-semicircle-right__logo__black__pass.png", path.join(root, "fixtures/valid/mask-semicircle-right__logo__black__pass.png")],
  ]);
  const maskBytes = await readFile(path.join(root, "assets/masks/kakao-bizboard-mask-semicircle-right-v1.png"));
  let bytes: Buffer | undefined;
  const result = await renderWithIntegrationAdapter(input, {
    resolver: { resolve: async (ref) => {
      const file = files.get(ref.value);
      if (!file) throw new Error(`unknown fixture ${ref.value}`);
      const assetBytes = await readFile(file);
      const metadata = (await inspectImageFile(file)).metadata;
      return { bytes: assetBytes, resolvedMimeType: metadata.detectedMimeType, metadata };
    } },
    maskAsset: { assetId: MASK_SEMICIRCLE_RIGHT_MASK_ASSET_ID, bytes: maskBytes, sha256: MASK_SEMICIRCLE_RIGHT_MASK_ASSET_SHA256 },
    renderMaskSemicircle: async (request) => {
      const rendered = await renderMaskSemicircleRight(request);
      bytes = Buffer.from(rendered.bytes);
      return rendered;
    },
  });
  if (result.status !== "PASS" || !bytes) throw new Error(JSON.stringify(result.validation));
  return bytes;
}

describe("MASK_SEMICIRCLE_RIGHT Windows x64 golden", () => {
  it("produces byte-equal PNG across three executions", async () => {
    const input = JSON.parse(await readFile(inputPath, "utf8")) as RendererIntegrationInputV1;
    const [one, two, three] = await Promise.all([renderOnce(input), renderOnce(input), renderOnce(input)]);
    const hash = (value: Buffer) => createHash("sha256").update(value).digest("hex");
    expect(hash(one)).toBe(expectedHash);
    expect(hash(two)).toBe(expectedHash);
    expect(hash(three)).toBe(expectedHash);
    expect(one.equals(two)).toBe(true);
    expect(one.equals(three)).toBe(true);
    expect(hash(await readFile(goldenPath))).toBe(expectedHash);
  });
});
