import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import type {
  CreativeLayoutPlan,
  FormatProfile,
  FreeformFontRegistry,
} from "@kbr/renderer-contract";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

import {
  loadContracts,
  renderFreeform,
  validateFreeformAppliedElements,
  validateFreeformPostRender,
  validateFreeformPreRender,
  type FreeformAssetInput,
  type FreeformRenderRequest,
} from "../../src/core/index.js";
import type { FreeformAssetValidationMetadata } from "../../src/core/freeform-validator.js";
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
      text: "FREEFORM Validator",
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

async function render(request: FreeformRenderRequest, overrides: Partial<Parameters<typeof renderFreeform>[1]> = {}) {
  return renderFreeform(request, {
    projectRoot,
    inputRoot: projectRoot,
    outputRoot: projectRoot,
    publish: false,
    ...overrides,
  });
}

async function contractContext(): Promise<{ contracts: Awaited<ReturnType<typeof loadContracts>>; profile: FormatProfile; fontRegistry: FreeformFontRegistry }> {
  const contracts = await loadContracts(projectRoot);
  const profileRegistry = JSON.parse(await readFile(path.join(projectRoot, "contracts/freeform-format-profiles.json"), "utf8")) as { profiles: FormatProfile[] };
  const profile = profileRegistry.profiles.find((entry) => entry.formatProfileId === profileId);
  if (!profile) throw new Error("test profile missing");
  const fontRegistry = JSON.parse(await readFile(path.join(projectRoot, "contracts/freeform-font-registry.json"), "utf8")) as FreeformFontRegistry;
  return { contracts, profile, fontRegistry };
}

function errorCodes(result: { errors: readonly { code: string }[] }): string[] {
  return result.errors.map((entry) => entry.code);
}

async function assetMetadata(assetId: string, relativePath: string): Promise<FreeformAssetValidationMetadata> {
  const bytes = await readFile(path.join(projectRoot, relativePath));
  const decoded = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let visibleAlpha = false;
  let opaqueBackgroundSuspected = true;
  for (let index = 0; index < decoded.data.length; index += 4) {
    const alpha = decoded.data[index + 3] ?? 0;
    if (alpha >= 8) visibleAlpha = true;
    if (alpha < 250) opaqueBackgroundSuspected = false;
  }
  return {
    assetId,
    digest: createHash("sha256").update(bytes).digest("hex"),
    mimeType: "image/png",
    width: decoded.info.width,
    height: decoded.info.height,
    bytes: bytes.byteLength,
    hasAlpha: true,
    visibleAlpha,
    opaqueBackgroundSuspected,
  };
}

describe("FREEFORM Validator & Compliance Hardening", () => {
  it("validates the frozen profile and produces stage-tagged deterministic PRE_RENDER issues", async () => {
    const { contracts, profile, fontRegistry } = await contractContext();
    const valid = validateFreeformPreRender(requestFor(basePlan()), { contracts, formatProfile: profile, fontRegistry });
    expect(valid).toEqual([]);

    const invalid = requestFor({
      ...basePlan(),
      background: { type: "GRADIENT" } as never,
      elements: [
        { ...basePlan().elements[0], id: "duplicate", bounds: { x: 0.9, y: 0, width: 0.2, height: 0.2 }, zIndex: Number.NaN },
        { ...basePlan().elements[1], id: "duplicate" },
      ] as never,
    });
    const runs = [1, 2, 3].map(() => validateFreeformPreRender(invalid, { contracts, formatProfile: profile, fontRegistry }));
    expect(JSON.stringify(runs[0])).toBe(JSON.stringify(runs[1]));
    expect(JSON.stringify(runs[1])).toBe(JSON.stringify(runs[2]));
    expect(runs[0]?.every((entry) => entry.stage === "PRE_RENDER")).toBe(true);
    expect(runs[0]?.map((entry) => entry.code)).toContain("KBR-FREEFORM-BACKGROUND-TYPE-NOT-SUPPORTED");
    expect(runs[0]?.map((entry) => entry.code)).toContain("KBR-FREEFORM-BOUNDS-OUT-OF-RANGE");
    expect(runs[0]?.map((entry) => entry.code)).toContain("KBR-FREEFORM-ZINDEX-INVALID");
    expect(runs[0]?.map((entry) => entry.code)).toContain("KBR-FREEFORM-ELEMENT-ID-DUPLICATE");
  });

  it("blocks profile, layout mode, background, unsupported output, and invalid feature contracts before raster", async () => {
    const malformed = await render(null as never);
    expect(malformed.status).toBe("BLOCKED");
    expect(malformed.png).toBeNull();
    expect(errorCodes(malformed)).toContain("KBR-INPUT-002");

    const mismatch = await render(requestFor({ ...basePlan(), formatProfileId: "UNKNOWN_PROFILE" }));
    expect(mismatch.status).toBe("BLOCKED");
    expect(mismatch.png).toBeNull();
    expect(errorCodes(mismatch)).toContain("KBR-FREEFORM-FORMAT-PROFILE-MISMATCH");

    const wrongMode = await render({ ...requestFor(basePlan()), layoutMode: "TEMPLATE_LOCKED" } as never);
    expect(wrongMode.status).toBe("BLOCKED");
    expect(wrongMode.png).toBeNull();
    expect(errorCodes(wrongMode)).toContain("KBR-FREEFORM-LAYOUT-MODE-MISMATCH");
    expect(wrongMode.errors.every((entry) => entry.stage === "PRE_RENDER")).toBe(true);

    const unsupported = await render(requestFor({ ...basePlan(), background: { type: "GRADIENT" } as never }, { output: { format: "JPG" } }));
    expect(unsupported.status).toBe("BLOCKED");
    expect(unsupported.png).toBeNull();
    expect(errorCodes(unsupported)).toEqual(expect.arrayContaining([
      "KBR-FREEFORM-BACKGROUND-TYPE-NOT-SUPPORTED",
      "KBR-FREEFORM-OUTPUT-FORMAT-NOT-SUPPORTED",
    ]));

    const shape = await render(requestFor({
      ...basePlan(),
      elements: [...basePlan().elements, { id: "shape", type: "SHAPE", shape: "RECTANGLE", fillColor: "#FF0000", bounds: { x: 0, y: 0, width: 0.1, height: 0.1 }, zIndex: 30 }],
    } as never));
    expect(shape.status).toBe("BLOCKED");
    expect(shape.png).toBeNull();
    expect(errorCodes(shape)).toContain("KBR-FREEFORM-ELEMENT-TYPE-NOT-SUPPORTED");
  });

  it("fails closed for missing, mismatched, undecodable, and dimension-mismatched assets", async () => {
    const missing = await render(requestFor({ ...basePlan(), elements: basePlan().elements.map((element) => element.id === "image" ? { ...element, assetId: "missing" } : element) }));
    expect(missing.status).toBe("BLOCKED");
    expect(missing.png).toBeNull();
    expect(errorCodes(missing)).toContain("KBR-FREEFORM-IMAGE-ASSET-NOT-FOUND");
    expect(missing.errors.every((entry) => entry.stage === "PRE_RENDER")).toBe(true);

    const mimeMismatch = await render(requestFor(basePlan(), {
      assets: [
        { assetId: "image", path: imagePath, mimeType: "image/jpeg" } as never,
        { assetId: "logo", path: logoPath, mimeType: "image/png" },
      ],
    }));
    expect(mimeMismatch.status).toBe("BLOCKED");
    expect(mimeMismatch.png).toBeNull();
    expect(errorCodes(mimeMismatch)).toContain("KBR-ASSET-MIME-EXTENSION-MISMATCH");

    const decodeFailure = await render(requestFor(basePlan(), {
      assets: [
        { assetId: "image", bytes: Buffer.from("not-an-image"), mimeType: "image/png" } as never,
        { assetId: "logo", path: logoPath, mimeType: "image/png" },
      ],
    }));
    expect(decodeFailure.status).toBe("BLOCKED");
    expect(decodeFailure.png).toBeNull();
    expect(errorCodes(decodeFailure)).toContain("KBR-ASSET-MIME-NOT-ALLOWED");

    const dimensionMismatch = await render(requestFor(basePlan(), {
      assets: [
        { assetId: "image", path: imagePath, mimeType: "image/png", declaredWidth: 1 } as never,
        { assetId: "logo", path: logoPath, mimeType: "image/png" },
      ],
    }));
    expect(dimensionMismatch.status).toBe("BLOCKED");
    expect(dimensionMismatch.png).toBeNull();
    expect(errorCodes(dimensionMismatch)).toContain("KBR-ASSET-DIMENSION-MISMATCH");
  });

  it("enforces image placement semantics without crop inference", async () => {
    const manualMissing = await render(requestFor({
      ...basePlan(),
      elements: basePlan().elements.map((element) => element.id === "image" && element.type === "IMAGE"
        ? { ...element, placement: { ...element.placement, policy: "MANUAL_CROP", fitMode: "COVER" } }
        : element),
    }));
    expect(manualMissing.status).toBe("BLOCKED");
    expect(errorCodes(manualMissing)).toContain("KBR-CROP-RECT-REQUIRED");

    const containCrop = await render(requestFor({
      ...basePlan(),
      elements: basePlan().elements.map((element) => element.id === "image" && element.type === "IMAGE"
        ? { ...element, placement: { ...element.placement, cropRect: { x: 0, y: 0, width: 1, height: 1 } } }
        : element),
    }));
    expect(containCrop.status).toBe("BLOCKED");
    expect(errorCodes(containCrop)).toContain("KBR-CROP-RECT-FORBIDDEN");

    const semanticMissing = await render(requestFor({
      ...basePlan(),
      elements: basePlan().elements.map((element) => element.id === "image" && element.type === "IMAGE"
        ? { ...element, placement: { ...element.placement, policy: "SEMANTIC_CROP_COVER", fitMode: "COVER" } }
        : element),
    }));
    expect(semanticMissing.status).toBe("BLOCKED");
    expect(errorCodes(semanticMissing)).toContain("KBR-CROP-RECT-REQUIRED");

    const semanticRequested = await render(requestFor({
      ...basePlan(),
      elements: basePlan().elements.map((element) => element.id === "image" && element.type === "IMAGE"
        ? { ...element, placement: { ...element.placement, policy: "SEMANTIC_CROP_COVER", fitMode: "COVER", focalPoint: { x: 0.5, y: 0.5 } } }
        : element),
    }));
    expect(semanticRequested.status).toBe("PASS");
  });

  it("enforces text registry, color, wrap, and raster overflow boundaries", async () => {
    const unknownFont = await render(requestFor({
      ...basePlan(),
      elements: basePlan().elements.map((element) => element.type === "TEXT" ? { ...element, fontId: "UNKNOWN_FONT" } : element),
    }));
    expect(unknownFont.status).toBe("BLOCKED");
    expect(unknownFont.png).toBeNull();
    expect(errorCodes(unknownFont)).toContain("KBR-FONT-NOT-REGISTERED");

    const invalidColor = await render(requestFor({
      ...basePlan(),
      elements: basePlan().elements.map((element) => element.type === "TEXT" ? { ...element, color: "red" } : element),
    }));
    expect(invalidColor.status).toBe("BLOCKED");
    expect(errorCodes(invalidColor)).toContain("KBR-FREEFORM-TEXT-COLOR-INVALID");

    const wordWrap = await render(requestFor({
      ...basePlan(),
      elements: basePlan().elements.map((element) => element.type === "TEXT" ? { ...element, wrapMode: "WORD_WRAP" } : element),
    }));
    expect(wordWrap.status).toBe("BLOCKED");
    expect(errorCodes(wordWrap)).toContain("KBR-FREEFORM-TEXT-WRAP-NOT-SUPPORTED");

    const clip = await render(requestFor({
      ...basePlan(),
      elements: basePlan().elements.map((element) => element.type === "TEXT"
        ? { ...element, text: "A deliberately long line that must clip", bounds: { x: 0.04, y: 0.1, width: 0.08, height: 0.2 }, overflowMode: "CLIP" as const }
        : element),
    }));
    expect(clip.status).toBe("PASS");
    const appliedText = clip.appliedElements.find((element) => element.elementId === "headline");
    expect(appliedText?.overflowDetected).toBe(true);
    expect(appliedText?.clipped).toBe(true);
    expect(clip.errors).toEqual([]);

    const overflowError = await render(requestFor({
      ...basePlan(),
      elements: basePlan().elements.map((element) => element.type === "TEXT"
        ? { ...element, text: "A deliberately long line that must error", bounds: { x: 0.04, y: 0.1, width: 0.08, height: 0.2 }, overflowMode: "ERROR" as const }
        : element),
    }));
    expect(overflowError.status).toBe("BLOCKED");
    expect(overflowError.png).toBeNull();
    expect(errorCodes(overflowError)).toContain("KBR-FREEFORM-TEXT-OVERFLOW");
    expect(overflowError.errors.every((entry) => entry.stage === "POST_RENDER")).toBe(true);
  });

  it("requires transparent, non-empty PNG logos without imposing a color rule", async () => {
    const opaqueLogo = await sharp({
      create: { width: 24, height: 24, channels: 4, background: { r: 240, g: 20, b: 20, alpha: 1 } },
    }).png().toBuffer();
    const opaque = await render(requestFor(basePlan(), {
      assets: [
        { assetId: "image", path: imagePath, mimeType: "image/png" },
        { assetId: "logo", bytes: opaqueLogo, mimeType: "image/png" },
      ],
    }));
    expect(opaque.status).toBe("BLOCKED");
    expect(errorCodes(opaque)).toContain("KBR-LOGO-TRANSPARENT-BACKGROUND-REQUIRED");

    const emptyLogo = await sharp({
      create: { width: 24, height: 24, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    }).png().toBuffer();
    const empty = await render(requestFor(basePlan(), {
      assets: [
        { assetId: "image", path: imagePath, mimeType: "image/png" },
        { assetId: "logo", bytes: emptyLogo, mimeType: "image/png" },
      ],
    }));
    expect(empty.status).toBe("BLOCKED");
    expect(errorCodes(empty)).toContain("KBR-LOGO-EMPTY");

    const colored = await render(requestFor(basePlan()));
    expect(colored.status).toBe("PASS");
  });

  it("rejects tampered applied elements and post-render artifacts deterministically", async () => {
    const { contracts, profile } = await contractContext();
    const result = await render(requestFor(basePlan()));
    expect(result.status).toBe("PASS");
    const image = await assetMetadata("image", imagePath);
    const logo = await assetMetadata("logo", logoPath);
    const resolvedAssets = new Map([[image.assetId, image], [logo.assetId, logo]]);
    const tampered = result.appliedElements.map((element) => element.elementId === "image"
      ? { ...element, destinationPixelRect: { ...element.destinationPixelRect, x: element.destinationPixelRect.x + 1 } }
      : element);
    const integrityIssues = validateFreeformAppliedElements(basePlan(), profile, tampered, contracts, { resolvedAssets });
    expect(integrityIssues.map((entry) => entry.code)).toContain("KBR-FREEFORM-APPLIED-RECT-MISMATCH");
    expect(integrityIssues.every((entry) => entry.stage === "POST_RENDER")).toBe(true);

    const checksumIssues = await validateFreeformPostRender({
      contracts,
      profile,
      plan: basePlan(),
      appliedElements: result.appliedElements,
      resolvedAssets,
      fontDigests: {
        SPOQA_HAN_SANS_BOLD: "0".repeat(64),
      },
      png: result.png,
      expectedArtifactChecksumSha256: "0".repeat(64),
    });
    expect(checksumIssues.map((entry) => entry.code)).toContain("KBR-FREEFORM-VALIDATION-INTERNAL-MISMATCH");
    expect(checksumIssues.map((entry) => entry.code)).toContain("KBR-FREEFORM-APPLIED-ELEMENT-MISMATCH");
    expect(checksumIssues.every((entry) => entry.stage === "POST_RENDER")).toBe(true);

    const malformed = await validateFreeformPostRender({
      contracts,
      profile,
      plan: basePlan(),
      appliedElements: result.appliedElements,
      resolvedAssets,
      png: Buffer.from("not-png"),
    });
    expect(malformed.map((entry) => entry.code)).toContain("KBR-OUTPUT-003");
    expect(malformed.every((entry) => entry.stage === "POST_RENDER")).toBe(true);
  });

  it("keeps MANUAL and AGENT validation and pixels equivalent while allowing request fingerprints to differ", async () => {
    const manual = await render(requestFor(basePlan(), { provenance: { requestId: "manual" } }));
    const agent = await render(requestFor({ ...basePlan(), source: "AGENT" }, { provenance: { requestId: "agent" } }));
    expect(manual.status).toBe("PASS");
    expect(agent.status).toBe("PASS");
    expect(agent.errors).toEqual(manual.errors);
    expect(agent.warnings).toEqual(manual.warnings);
    expect(agent.pngDigest).toBe(manual.pngDigest);
    expect(agent.pixelFingerprint).toBe(manual.pixelFingerprint);
    expect(agent.requestFingerprint).not.toBe(manual.requestFingerprint);
  });

  it("does not expose absolute paths in output validation failures", async () => {
    const outputRoot = await createTempRoot("freeform-validator-path");
    try {
      const result = await render(requestFor(basePlan(), { output: { directory: "..\\outside", baseName: "blocked", overwrite: false } }), { outputRoot, publish: true });
      expect(result.status).toBe("BLOCKED");
      expect(result.png).toBeNull();
      expect(errorCodes(result)).toContain("KBR-INPUT-009");
      expect(JSON.stringify(result.errors)).not.toContain(outputRoot);
      expect(JSON.stringify(result.errors)).not.toContain(projectRoot);
    } finally {
      await removeTempRoot(outputRoot);
    }
  });
});
