import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { GlobalFonts } from "@napi-rs/canvas";
import { MASK_SEMICIRCLE_RIGHT_MASK_ASSET_ID, MASK_SEMICIRCLE_RIGHT_MASK_ASSET_SHA256, renderWithIntegrationAdapter } from "../packages/renderer-contract/dist/index.js";
import { inspectImageFile } from "../dist/core/image-input.js";
import { renderMaskSemicircleRight } from "../dist/core/mask-semicircle-right.js";

const root = process.cwd();
GlobalFonts.registerFromPath(path.join(root, "assets/fonts/SpoqaHanSansBold.ttf"), "KBR Spoqa Han Sans Bold");
GlobalFonts.registerFromPath(path.join(root, "assets/fonts/SpoqaHanSansRegular.ttf"), "KBR Spoqa Han Sans Regular");
const input = JSON.parse(await readFile(path.join(root, "fixtures/integration/mask-semicircle-right/valid-white-logo-pass/input.json"), "utf8"));
const fixtureRoot = path.join(root, "fixtures", "valid");
const resolver = {
  resolve: async (ref) => {
    const fileName = ref.value.includes("logo") ? "mask-semicircle-right__logo__white__pass.png" : "mask-semicircle-right__image__basic__pass.png";
    const filePath = path.join(fixtureRoot, fileName);
    const bytes = await readFile(filePath);
    const inspected = await inspectImageFile(filePath);
    return { bytes, resolvedMimeType: inspected.metadata.detectedMimeType, metadata: inspected.metadata };
  },
};
const maskPath = path.join(root, "assets/masks/kakao-bizboard-mask-semicircle-right-v1.png");
let renderedBytes;
const result = await renderWithIntegrationAdapter(input, {
  resolver,
  maskAsset: { assetId: MASK_SEMICIRCLE_RIGHT_MASK_ASSET_ID, bytes: await readFile(maskPath), sha256: MASK_SEMICIRCLE_RIGHT_MASK_ASSET_SHA256 },
  renderMaskSemicircle: async (request) => {
    const rendered = await renderMaskSemicircleRight(request);
    renderedBytes = rendered.bytes;
    return rendered;
  },
});
if (result.status !== "PASS" || !result.artifact) throw new Error(`MASK golden generation failed: ${JSON.stringify(result.validation)}`);
if (!renderedBytes) throw new Error("MASK golden bytes unavailable");
await writeFile(path.join(root, "fixtures/golden/mask-semicircle-right__valid__golden.png"), renderedBytes);
console.log(`MASK golden ${result.artifact.checksumSha256}`);
