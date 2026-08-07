import { readFile } from "node:fs/promises";
import path from "node:path";

import { GlobalFonts } from "@napi-rs/canvas";
import { describe, expect, it } from "vitest";

import {
  MASK_SEMICIRCLE_RIGHT_MASK_ASSET_ID,
  MASK_SEMICIRCLE_RIGHT_MASK_ASSET_SHA256,
  renderWithIntegrationAdapter,
  sha256Hex,
  type RendererIntegrationInputV1,
} from "../../packages/renderer-contract/src/index.js";
import { inspectImageFile } from "../../src/core/image-input.js";
import { renderMaskSemicircleRight } from "../../src/core/mask-semicircle-right.js";

const root = path.resolve(import.meta.dirname, "../..");
GlobalFonts.registerFromPath(path.join(root, "assets", "fonts", "SpoqaHanSansBold.ttf"), "KBR Spoqa Han Sans Bold");
GlobalFonts.registerFromPath(path.join(root, "assets", "fonts", "SpoqaHanSansRegular.ttf"), "KBR Spoqa Han Sans Regular");

const validImage = path.join(root, "fixtures", "valid", "mask-semicircle-right__image__basic__pass.png");
const validLogo = path.join(root, "fixtures", "valid", "mask-semicircle-right__logo__black__pass.png");
const maskPath = path.join(root, "assets", "masks", "kakao-bizboard-mask-semicircle-right-v1.png");

async function loadInput(): Promise<RendererIntegrationInputV1> {
  return JSON.parse(await readFile(path.join(root, "fixtures", "integration", "mask-semicircle-right", "valid-black-logo-pass", "input.json"), "utf8")) as RendererIntegrationInputV1;
}

async function readAsset(filePath: string) {
  const bytes = await readFile(filePath);
  const inspected = await inspectImageFile(filePath);
  return { bytes, metadata: inspected.metadata };
}

async function execute(input: RendererIntegrationInputV1, logoPath = validLogo) {
  const byValue = new Map<string, string>([
    ["mask-semicircle-right__image__basic__pass.png", validImage],
    ["mask-semicircle-right__logo__black__pass.png", logoPath],
  ]);
  const maskBytes = await readFile(maskPath);
  return renderWithIntegrationAdapter(input, {
    resolver: {
      resolve: async (ref) => {
        const filePath = byValue.get(ref.value);
        if (!filePath) throw new Error(`unknown fixture ${ref.value}`);
        const asset = await readAsset(filePath);
        return { bytes: asset.bytes, resolvedMimeType: asset.metadata.detectedMimeType, metadata: asset.metadata };
      },
    },
    maskAsset: { assetId: MASK_SEMICIRCLE_RIGHT_MASK_ASSET_ID, bytes: maskBytes, sha256: MASK_SEMICIRCLE_RIGHT_MASK_ASSET_SHA256 },
    renderMaskSemicircle: renderMaskSemicircleRight,
  });
}

describe("MASK_SEMICIRCLE_RIGHT integration execution", () => {
  it("renders the restored semicircle with ordered image and color-unrestricted logo overlay", async () => {
    const result = await execute(await loadInput());
    expect(result.status).toBe("PASS");
    expect(result.appliedImagePlacements.map((placement) => placement.imageSlotId)).toEqual(["IMAGE_PRIMARY", "LOGO_PRIMARY"]);
    expect(result.appliedImagePlacements.map((placement) => placement.slotRole)).toEqual(["IMAGE", "LOGO"]);
    expect(result.appliedImagePlacements[0]?.destinationRect).toEqual({ x: 621, y: 45, width: 360, height: 213 });
    const logoPlacement = result.appliedImagePlacements[1];
    if (!logoPlacement) throw new Error("Logo placement is missing");
    expect(logoPlacement.destinationRect.x).toBeGreaterThanOrEqual(847);
    expect(logoPlacement.destinationRect.y).toBeGreaterThanOrEqual(24);
    expect(logoPlacement.destinationRect.x + logoPlacement.destinationRect.width).toBeLessThanOrEqual(973);
    expect(logoPlacement.destinationRect.y + logoPlacement.destinationRect.height).toBeLessThanOrEqual(68);
    expect(result.appliedImagePlacements[0]?.maskAssetId).toBe(MASK_SEMICIRCLE_RIGHT_MASK_ASSET_ID);
    expect(result.artifact?.mimeType).toBe("image/png");
    expect(result.artifact?.width).toBe(1029);
    expect(result.artifact?.height).toBe(258);
  });

  it("is deterministic and independent of input placement-plan order", async () => {
    const input = await loadInput();
    const reversed = { ...input, imagePlacementPlans: [...input.imagePlacementPlans].reverse() };
    const [first, second, third, reordered] = await Promise.all([execute(input), execute(input), execute(input), execute(reversed)]);
    expect(first.status).toBe("PASS");
    expect(second.artifact?.checksumSha256).toBe(first.artifact?.checksumSha256);
    expect(third.artifact?.checksumSha256).toBe(first.artifact?.checksumSha256);
    expect(reordered.artifact?.checksumSha256).toBe(first.artifact?.checksumSha256);
    expect(first.pixelFingerprint).toBe(reordered.pixelFingerprint);
  });

  it.each([
    ["colored", "fixtures/valid/mask-semicircle-right__logo__colored__pass.png"],
    ["white", "fixtures/valid/mask-semicircle-right__logo__white__pass.png"],
  ] as const)("accepts %s transparent logo colors without recoloring", async (_name, relativePath) => {
    const result = await execute(await loadInput(), path.join(root, relativePath));
    expect(result.status).toBe("PASS");
    expect(result.appliedImagePlacements.map((placement) => placement.imageSlotId)).toEqual(["IMAGE_PRIMARY", "LOGO_PRIMARY"]);
  });

  it.each([
    ["opaque", "fixtures/invalid/mask-semicircle-right__logo__opaque-background__error.png", "KBR-LOGO-TRANSPARENT-BACKGROUND-REQUIRED"],
    ["empty", "fixtures/invalid/mask-semicircle-right__logo__empty__error.png", "KBR-LOGO-EMPTY"],
  ] as const)("blocks %s logos deterministically", async (_name, relativePath, code) => {
    const result = await execute(await loadInput(), path.join(root, relativePath));
    expect(result.status).toBe("BLOCKED");
    expect(result.artifact).toBeUndefined();
    expect(result.validation.errors.map((entry) => entry.code)).toContain(code);
  });

  it("blocks crop rect and crop candidate fields on the logo plan", async () => {
    const input = await loadInput();
    const logoPlan = input.imagePlacementPlans.find((plan) => plan.imageSlotId === "LOGO_PRIMARY");
    if (!logoPlan) throw new Error("Logo plan is missing");
    const cropRectResult = await execute({ ...input, imagePlacementPlans: input.imagePlacementPlans.map((plan) => plan.imageSlotId === "LOGO_PRIMARY" ? { ...plan, cropRect: { x: 0, y: 0, width: 1, height: 1 } } : plan) });
    expect(cropRectResult.status).toBe("BLOCKED");
    expect(cropRectResult.validation.errors.map((entry) => entry.code)).toContain("KBR-CROP-RECT-FORBIDDEN");
    const candidateResult = await execute({ ...input, cropCandidates: [{ schemaVersion: input.schemaVersion, candidateId: "logo-candidate", assetId: "mask-logo", imageSlotId: "LOGO_PRIMARY", cropRect: { x: 0, y: 0, width: 1, height: 1 }, preservedSubjectIds: [], clippedSubjectIds: [], fillRatio: 1, subjectCoverageRatio: 1, warnings: [] }], imagePlacementPlans: input.imagePlacementPlans.map((plan) => plan.imageSlotId === "LOGO_PRIMARY" ? { ...plan, cropCandidateId: "logo-candidate" } : plan) });
    expect(candidateResult.status).toBe("BLOCKED");
    expect(candidateResult.validation.errors.map((entry) => entry.code)).toContain("KBR-CROP-CANDIDATE-MISMATCH");
  });

  it("allows a missing optional logo plan when no second asset is supplied", async () => {
    const input = await loadInput();
    const noLogo = { ...input, assets: input.assets.filter((asset) => asset.assetId !== "mask-logo"), imagePlacementPlans: input.imagePlacementPlans.filter((plan) => plan.imageSlotId !== "LOGO_PRIMARY") };
    const result = await execute(noLogo);
    expect(result.status).toBe("PASS");
    expect(result.appliedImagePlacements.map((placement) => placement.imageSlotId)).toEqual(["IMAGE_PRIMARY"]);
  });

  it("blocks a second asset without an optional logo plan", async () => {
    const input = await loadInput();
    const result = await execute({ ...input, imagePlacementPlans: input.imagePlacementPlans.filter((plan) => plan.imageSlotId !== "LOGO_PRIMARY") });
    expect(result.status).toBe("BLOCKED");
    expect(result.validation.errors.map((entry) => entry.code)).toContain("KBR-LOGO-PLAN-MISSING");
  });

  it("blocks a logo plan whose asset is absent", async () => {
    const input = await loadInput();
    const result = await execute({ ...input, assets: input.assets.filter((asset) => asset.assetId !== "mask-logo") });
    expect(result.status).toBe("BLOCKED");
    expect(result.validation.errors.map((entry) => entry.code)).toContain("KBR-LOGO-ASSET-MISSING");
  });

  it("blocks a tampered mask asset digest", async () => {
    const input = await loadInput();
    const maskBytes = await readFile(maskPath);
    const result = await renderWithIntegrationAdapter(input, {
      resolver: { resolve: async (ref) => {
        const filePath = ref.value.includes("logo") ? validLogo : validImage;
        const asset = await readAsset(filePath);
        return { bytes: asset.bytes, resolvedMimeType: asset.metadata.detectedMimeType, metadata: asset.metadata };
      } },
      maskAsset: { assetId: MASK_SEMICIRCLE_RIGHT_MASK_ASSET_ID, bytes: maskBytes, sha256: await sha256Hex("tampered") },
      renderMaskSemicircle: renderMaskSemicircleRight,
    });
    expect(result.status).toBe("BLOCKED");
    expect(result.validation.errors.map((entry) => entry.code)).toContain("KBR-MASK-ASSET-DIGEST-MISMATCH");
  });
});
