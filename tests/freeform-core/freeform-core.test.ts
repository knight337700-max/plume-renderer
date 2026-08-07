import { createHash } from "node:crypto";
import { readFile as readBytes, readFile as readText } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

import {
  createKakaoBizboardRenderer,
  renderFreeform,
  type FreeformAssetInput,
  type FreeformRenderRequest,
} from "../../src/core/index.js";
import type { CreativeLayoutPlan } from "@kbr/renderer-contract";
import { createTempRoot, projectRoot, removeTempRoot } from "../helpers.js";

const profileId = "KBR_FREEFORM_CONTRACT_TEST_1029X258";
const imagePath = "fixtures/valid/object-right__product__basic__pass.png";
const logoPath = "fixtures/valid/mask-semicircle-right__logo__colored__pass.png";

const basePlan = (): CreativeLayoutPlan => ({
  schemaVersion: "1.0.0",
  formatProfileId: profileId,
  source: "MANUAL",
  background: { type: "SOLID", color: "#FFFFFFFF" },
  elements: [
    {
      id: "image",
      type: "IMAGE",
      assetId: "image",
      bounds: { x: 0.58, y: 0.08, width: 0.36, height: 0.84 },
      zIndex: 0,
      placement: { policy: "CENTER_CONTAIN", source: "MANUAL", fitMode: "CONTAIN", anchor: "CENTER", subjectProtection: "NONE" },
    },
    {
      id: "headline",
      type: "TEXT",
      text: "FREEFORM Core",
      fontId: "SPOQA_HAN_SANS_BOLD",
      fontSizePx: 38,
      color: "#202020",
      lineHeightPx: 46,
      textAlign: "LEFT",
      verticalAlign: "TOP",
      wrapMode: "NO_WRAP",
      overflowMode: "ERROR",
      bounds: { x: 0.04, y: 0.1, width: 0.45, height: 0.24 },
      zIndex: 10,
    },
    {
      id: "logo",
      type: "LOGO",
      assetId: "logo",
      bounds: { x: 0.04, y: 0.68, width: 0.2, height: 0.22 },
      zIndex: 20,
      placement: { policy: "ALPHA_TRIM_CONTAIN", source: "MANUAL", fitMode: "CONTAIN", anchor: "CENTER", subjectProtection: "NONE" },
    },
  ],
});

function requestFor(plan: CreativeLayoutPlan, extras: Partial<FreeformRenderRequest> = {}): FreeformRenderRequest {
  return {
    layoutMode: "FREEFORM",
    formatProfileId: profileId,
    creativeLayoutPlan: plan,
    assets: [
      { assetId: "image", path: imagePath, mimeType: "image/png" } as FreeformAssetInput,
      { assetId: "logo", path: logoPath, mimeType: "image/png" } as FreeformAssetInput,
    ],
    ...extras,
  };
}

async function render(request: FreeformRenderRequest) {
  return renderFreeform(request, { projectRoot, inputRoot: projectRoot, outputRoot: projectRoot, publish: false });
}

describe("FREEFORM Core Raster v1", () => {
  it("renders a transparent/solid IMAGE + TEXT + LOGO plan with applied elements", async () => {
    const result = await render(requestFor(basePlan()));
    expect(result.status).toBe("PASS");
    expect(result.errors).toEqual([]);
    expect(result.png).toBeInstanceOf(Buffer);
    expect(result.pngDigest).toMatch(/^[a-f0-9]{64}$/u);
    expect(result.pngDigest).toBe("569df2962ee6281b4da3c84b45fb3a873a2129e091fc342bbf0c0deea9cfa52e");
    expect(result.appliedElements.map((element) => element.elementId)).toEqual(["image", "headline", "logo"]);
    expect(result.appliedElements[0]?.destinationPixelRect).toEqual({ x: 605, y: 20, width: 354, height: 218 });
    expect(result.appliedElements[1]?.destinationPixelRect).toEqual({ x: 41, y: 25, width: 464, height: 63 });
    expect(result.appliedElements[2]?.elementType).toBe("LOGO");
    const metadata = await sharp(result.png as Buffer).metadata();
    expect(metadata.width).toBe(1029);
    expect(metadata.height).toBe(258);
    expect(metadata.hasAlpha).toBe(true);

    const transparent = await render(requestFor({ ...basePlan(), background: { type: "TRANSPARENT" } }));
    expect(transparent.status).toBe("PASS");
    const transparentPixels = await sharp(transparent.png as Buffer).raw().toBuffer({ resolveWithObject: true });
    expect(transparentPixels.data[3]).toBe(0);
  });

  it("is byte deterministic across three runs and keeps manual/agent pixels equal", async () => {
    const manual = requestFor(basePlan(), { provenance: { requestId: "manual" } });
    const runs = await Promise.all([render(manual), render(manual), render(manual)]);
    expect(runs[0]?.pngDigest).toBe(runs[1]?.pngDigest);
    expect(runs[1]?.pngDigest).toBe(runs[2]?.pngDigest);
    expect(runs[0]?.pixelFingerprint).toBe(runs[1]?.pixelFingerprint);
    expect(runs[0]?.requestFingerprint).toBe(runs[1]?.requestFingerprint);
    const agentPlan = { ...basePlan(), source: "AGENT" as const };
    const agent = await render(requestFor(agentPlan, { provenance: { requestId: "agent" } }));
    expect(agent.pngDigest).toBe(runs[0]?.pngDigest);
    expect(agent.pixelFingerprint).toBe(runs[0]?.pixelFingerprint);
    expect(agent.requestFingerprint).not.toBe(runs[0]?.requestFingerprint);
  });

  it("supports explicit newlines, CLIP overflow, and all image placement policies", async () => {
    const newlinePlan = basePlan();
    const newlineText = newlinePlan.elements.find((element) => element.id === "headline");
    if (!newlineText || newlineText.type !== "TEXT") throw new Error("fixture text missing");
    const changed = {
      ...newlinePlan,
      elements: newlinePlan.elements.map((element) => element.id === "headline"
        ? { ...element, text: "Line one\nLine two", wrapMode: "EXPLICIT_NEWLINES" as const, bounds: { x: 0.04, y: 0.05, width: 0.45, height: 0.5 }, lineHeightPx: 44 }
        : element),
    };
    expect((await render(requestFor(changed))).status).toBe("PASS");
    const clipPlan = {
      ...basePlan(),
      elements: basePlan().elements.map((element) => element.id === "headline"
        ? { ...element, text: "A very long line that is intentionally clipped", bounds: { x: 0.04, y: 0.1, width: 0.08, height: 0.2 }, overflowMode: "CLIP" as const }
        : element),
    };
    expect((await render(requestFor(clipPlan))).status).toBe("PASS");
    const cropPlan = {
      ...basePlan(),
      elements: basePlan().elements.map((element) => element.type === "IMAGE" && element.id === "image"
        ? { ...element, placement: { ...element.placement, policy: "MANUAL_CROP" as const, fitMode: "COVER" as const, cropRect: { x: 0.1, y: 0.2, width: 0.7, height: 0.6 } } }
        : element),
    };
    const cropped = await render(requestFor(cropPlan));
    expect(cropped.status).toBe("PASS");
    expect(cropped.appliedElements.find((element) => element.elementId === "image")?.resolvedSourceCropPixels).toEqual({ x: 26, y: 32, width: 182, height: 96 });

    const semanticPlan = {
      ...basePlan(),
      elements: basePlan().elements.map((element) => element.type === "IMAGE" && element.id === "image"
        ? { ...element, placement: { ...element.placement, policy: "SEMANTIC_CROP_COVER" as const, fitMode: "COVER" as const, focalPoint: { x: 0.5, y: 0.5 } } }
        : element),
    };
    const semantic = await render(requestFor(semanticPlan));
    expect(semantic.status).toBe("PASS");
    expect(semantic.appliedElements.find((element) => element.elementId === "image")?.resolvedSourceCropPixels).toBeTruthy();
  });

  it("preserves original array order for equal zIndex values", async () => {
    const plan = {
      ...basePlan(),
      elements: basePlan().elements.map((element) => ({ ...element, zIndex: 5 })),
    };
    const result = await render(requestFor(plan));
    expect(result.status).toBe("PASS");
    expect(result.appliedElements.map((element) => element.elementId)).toEqual(["image", "headline", "logo"]);
  });

  it("fails closed for missing plans, invalid bounds, duplicate ids, unsupported features, and JPG", async () => {
    const missing = await render({ layoutMode: "FREEFORM", formatProfileId: profileId });
    expect(missing.errors.map((entry) => entry.code)).toContain("KBR-FREEFORM-PLAN-MISSING");
    const firstElement = basePlan().elements[0];
    if (!firstElement) throw new Error("fixture element missing");
    const invalidBounds = { ...basePlan(), elements: [{ ...firstElement, bounds: { x: 0.9, y: 0, width: 0.2, height: 0.2 } }] };
    expect((await render(requestFor(invalidBounds))).errors.map((entry) => entry.code)).toContain("KBR-FREEFORM-BOUNDS-OUT-OF-RANGE");
    const mismatchedPlan = { ...basePlan(), formatProfileId: "KBR_FREEFORM_OTHER_PROFILE" };
    expect((await render(requestFor(mismatchedPlan))).errors.map((entry) => entry.code)).toContain("KBR-FREEFORM-FORMAT-PROFILE-MISMATCH");
    const duplicate = { ...basePlan(), elements: [...basePlan().elements, { ...firstElement, id: "headline" }] };
    expect((await render(requestFor(duplicate))).errors.map((entry) => entry.code)).toContain("KBR-FREEFORM-ELEMENT-ID-DUPLICATE");
    const wordWrap = { ...basePlan(), elements: basePlan().elements.map((element) => element.type === "TEXT" ? { ...element, wrapMode: "WORD_WRAP" as const } : element) };
    expect((await render(requestFor(wordWrap))).errors.map((entry) => entry.code)).toContain("KBR-FREEFORM-TEXT-WRAP-NOT-SUPPORTED");
    const shape = { ...basePlan(), elements: [...basePlan().elements, { id: "shape", type: "SHAPE" as const, shape: "RECTANGLE" as const, fillColor: "#FF0000", bounds: { x: 0, y: 0, width: 0.1, height: 0.1 }, zIndex: 1 }] };
    expect((await render(requestFor(shape))).errors.map((entry) => entry.code)).toContain("KBR-FREEFORM-ELEMENT-TYPE-NOT-SUPPORTED");
    const jpg = await render(requestFor(basePlan(), { output: { format: "JPG" } }));
    expect(jpg.errors.map((entry) => entry.code)).toContain("KBR-FREEFORM-OUTPUT-FORMAT-NOT-SUPPORTED");
    const missingAsset = { ...basePlan(), elements: basePlan().elements.map((element) => element.id === "image" ? { ...element, assetId: "unknown" } : element) };
    expect((await render(requestFor(missingAsset))).errors.map((entry) => entry.code)).toContain("KBR-FREEFORM-IMAGE-ASSET-NOT-FOUND");
    const unknownFont = { ...basePlan(), elements: basePlan().elements.map((element) => element.type === "TEXT" ? { ...element, fontId: "UNKNOWN_FONT" } : element) };
    expect((await render(requestFor(unknownFont))).errors.map((entry) => entry.code)).toContain("KBR-FONT-NOT-REGISTERED");
  });

  it("publishes FREEFORM artifacts atomically through the existing Core entry", async () => {
    const outputRoot = await createTempRoot("freeform-publish");
    try {
      const renderer = await createKakaoBizboardRenderer({ projectRoot, inputRoot: projectRoot, outputRoot });
      const response = await renderer.render({ ...requestFor(basePlan()), output: { directory: "jobs", baseName: "freeform", overwrite: false } });
      expect(response.status).toBe("PASS");
      expect(response.downloadAllowed).toBe(true);
      expect(response.manifestPath).toBeTruthy();
      expect(response.pngPath).toBeTruthy();
      const manifest = JSON.parse(await readText(response.manifestPath as string, "utf8")) as Record<string, unknown>;
      expect(manifest).not.toHaveProperty("manifestDigest");
      expect(manifest).toHaveProperty("appliedElements");
      expect(response.artifactChecksumSha256).toBe(response.pngDigest);
    } finally {
      await removeTempRoot(outputRoot);
    }
  });

  it("keeps the existing TEMPLATE_LOCKED Golden bytes unchanged", async () => {
    const bytes = await readBytes(path.join(projectRoot, "fixtures/golden/object-right__stable__golden.png"));
    expect(createHash("sha256").update(bytes).digest("hex")).toBe("20dc9d62b8650a72115a8d584846399d9cd6dd2c8a0996b4889edb596feb68b1");
  });
});
