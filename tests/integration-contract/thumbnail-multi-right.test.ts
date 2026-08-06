import { readFile } from "node:fs/promises";
import path from "node:path";

import { GlobalFonts } from "@napi-rs/canvas";
import { describe, expect, it } from "vitest";

import {
  renderWithIntegrationAdapter,
  type RendererIntegrationInputV1,
} from "../../packages/renderer-contract/src/index.js";
import { inspectImageFile } from "../../src/core/image-input.js";
import { renderThumbnailMultiRight } from "../../src/core/thumbnail-multi-right.js";

const root = path.resolve(import.meta.dirname, "../..");
GlobalFonts.registerFromPath(path.join(root, "assets", "fonts", "SpoqaHanSansBold.ttf"), "KBR Spoqa Han Sans Bold");
GlobalFonts.registerFromPath(path.join(root, "assets", "fonts", "SpoqaHanSansRegular.ttf"), "KBR Spoqa Han Sans Regular");

const expectedDigest = "ec3689f320a20bb242f649759228bae27cec1ea74fe9ff4f3fbcea0988f3cd55";

async function loadFixture(directory: string, file = "input.json"): Promise<RendererIntegrationInputV1> {
  return JSON.parse(await readFile(path.join(root, "fixtures", "integration", "thumbnail-multi-right", directory, file), "utf8")) as RendererIntegrationInputV1;
}

async function execute(input: RendererIntegrationInputV1) {
  const imageCache = new Map<string, { bytes: Buffer; metadata: Awaited<ReturnType<typeof inspectImageFile>>["metadata"] }>();
  return renderWithIntegrationAdapter(input, {
    resolver: {
      resolve: async (ref) => {
        const fileName = ref.value.includes("jpeg") || ref.value.endsWith(".jpg") ? "thumbnail-box-right__asset__jpeg__pass.jpg" : "thumbnail-box-right__asset__basic__pass.png";
        const cached = imageCache.get(fileName);
        if (cached) return { bytes: cached.bytes, resolvedMimeType: cached.metadata.detectedMimeType, metadata: cached.metadata };
        const filePath = path.join(root, "fixtures", "valid", fileName);
        const bytes = await readFile(filePath);
        const inspected = await inspectImageFile(filePath);
        imageCache.set(fileName, { bytes, metadata: inspected.metadata });
        return { bytes, resolvedMimeType: inspected.metadata.detectedMimeType, metadata: inspected.metadata };
      },
    },
    renderThumbnailMulti: async (request) => renderThumbnailMultiRight(request),
  });
}

describe("THUMBNAIL_MULTI_RIGHT integration execution", () => {
  it("renders two independent slots with mixed PNG/JPEG and fixed destinations", async () => {
    const result = await execute(await loadFixture("two-assets-manual-pass"));
    expect(result.status).toBe("PASS");
    expect(result.artifact?.checksumSha256).toBe(expectedDigest);
    expect(result.appliedImagePlacements.map((placement) => placement.imageSlotId)).toEqual(["IMAGE_PRIMARY", "IMAGE_SECONDARY"]);
    expect(result.appliedImagePlacements.map((placement) => placement.destinationRect)).toEqual([
      { x: 621, y: 43, width: 172, height: 172 },
      { x: 809, y: 43, width: 172, height: 172 },
    ]);
  });

  it("applies the THUMBNAIL_MULTI_RIGHT copy unit and hard-edge contract before publishing", async () => {
    const input = await loadFixture("two-assets-manual-pass");
    const result = await execute({
      ...input,
      copy: { ...input.copy, headline: "가가가가가가가가가가가가가" },
    });
    expect(result.status).toBe("BLOCKED");
    expect(result.artifact).toBeUndefined();
    expect(result.validation.errors.map((entry) => entry.code)).toContain("KBR-TEXT-COUNT-HEADLINE-001");
  });

  it("allows one asset to be reused with two independent crops", async () => {
    const result = await execute(await loadFixture("same-asset-two-crops-pass"));
    expect(result.status).toBe("PASS");
    expect(result.appliedImagePlacements).toHaveLength(2);
    expect(new Set(result.appliedImagePlacements.map((placement) => placement.assetId))).toEqual(new Set(["room-scene"]));
  });

  it("canonicalizes plan execution by slot order while preserving request provenance", async () => {
    const manual = await loadFixture("plan-order-equivalence", "manual.json");
    const agent = await loadFixture("plan-order-equivalence", "agent.json");
    const [manualResult, agentResult] = await Promise.all([execute(manual), execute(agent)]);
    expect(manualResult.status).toBe("PASS");
    expect(agentResult.status).toBe("PASS");
    expect(manualResult.artifact?.checksumSha256).toBe(agentResult.artifact?.checksumSha256);
    expect(manualResult.pixelFingerprint).toBe(agentResult.pixelFingerprint);
    expect(manualResult.requestFingerprint).not.toBe(agentResult.requestFingerprint);
  });

  it.each([
    ["primary-missing-error", "KBR-PLACEMENT-PLAN-MISSING"],
    ["secondary-missing-error", "KBR-PLACEMENT-PLAN-MISSING"],
    ["duplicate-primary-plan-error", "KBR-PLACEMENT-PLAN-DUPLICATE"],
    ["unknown-slot-error", "KBR-IMAGE-SLOT-NOT-FOUND"],
    ["cross-slot-candidate-error", "KBR-CROP-CANDIDATE-MISMATCH"],
    ["required-subject-clipped-primary-error", "KBR-PROTECTED-SUBJECT-CLIPPED"],
  ])("blocks %s deterministically with %s", async (directory, code) => {
    const result = await execute(await loadFixture(directory));
    expect(result.status).toBe("BLOCKED");
    expect(result.artifact).toBeUndefined();
    expect(result.validation.errors.map((entry) => entry.code)).toContain(code);
  });

  it("allows preferred subject clipping as a warning", async () => {
    const result = await execute(await loadFixture("preferred-subject-clipped-secondary-warning"));
    expect(result.status).toBe("PASS");
    expect(result.validation.errors).toEqual([]);
    expect(result.validation.warnings.map((entry) => entry.code)).toContain("KBR-PROTECTED-SUBJECT-CLIPPED");
  });
});
