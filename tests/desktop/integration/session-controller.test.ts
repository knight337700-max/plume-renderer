import { access, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";

import { DesktopController } from "../../../apps/desktop/electron-main/src/desktop-controller.js";
import { DesktopSessionManager } from "../../../apps/desktop/electron-main/src/session/session-manager.js";
import type { UiRenderInput } from "../../../apps/desktop/shared/src/index.js";
import { sha256Bytes } from "../../../src/core/hash.js";
import { deterministicOversizePng } from "../../fixtures/freeform-preview-fixtures.js";
import { createTempRoot, projectRoot, removeTempRoot } from "../../helpers.js";

type Context = {
  root: string;
  session: DesktopSessionManager;
  controller: DesktopController;
  outputRoot: string;
};

const contexts: Context[] = [];

async function setup(label: string): Promise<Context> {
  const root = await createTempRoot(`desktop-${label}`);
  const sessionBase = path.join(root, "sessions");
  const outputRoot = path.join(root, "output");
  await mkdir(outputRoot, { recursive: true });
  const session = new DesktopSessionManager(sessionBase);
  await session.initialize();
  const controller = new DesktopController({
    projectRoot,
    session,
    appVersion: "0.2.0-test",
    blockedNetworkRequestCount: () => 0,
  });
  const context = { root, session, controller, outputRoot };
  contexts.push(context);
  return context;
}

function uiInput(assetToken: string, jobName = "desktop-output"): UiRenderInput {
  return {
    assetToken,
    advertiser: "자코모",
    headline: "자코모 프리미엄 소파",
    subcopy: "거실을 바꾸는 선택",
    jobName,
    requestSequence: 1,
  };
}

function freeformInput(
  assetToken: string,
  outputFormat: "PNG" | "JPEG",
  jobName: string,
  placement: Readonly<Record<string, unknown>> = {
    policy: "CENTER_CONTAIN",
    source: "MANUAL",
    fitMode: "CONTAIN",
    anchor: "CENTER",
    subjectProtection: "NONE",
  },
): UiRenderInput {
  return {
    assetToken,
    advertiser: "FREEFORM",
    headline: "FREEFORM",
    subcopy: "FREEFORM",
    jobName,
    requestSequence: 1,
    layoutMode: "FREEFORM",
    freeform: {
      formatProfileId: "KAKAO_DISPLAY_NATIVE_2_1",
      creativeLayoutPlan: {
        schemaVersion: "1.0.0",
        formatProfileId: "KAKAO_DISPLAY_NATIVE_2_1",
        source: "MANUAL",
        background: { type: "SOLID", color: "#FFFFFF" },
        elements: [{
          id: "image-1",
          type: "IMAGE",
          assetId: "image",
          bounds: { x: 0, y: 0, width: 1, height: 1 },
          zIndex: 0,
          placement: placement as never,
        }],
      },
      assetTokens: { image: assetToken },
      outputFormat,
      ...(outputFormat === "JPEG" ? { outputQuality: 92 as const } : {}),
    },
  };
}

async function selectFixture(context: Context, fixture: string) {
  const result = await context.controller.selectProductFromPath(path.join(projectRoot, ...fixture.split("/")));
  expect(result.status, JSON.stringify(result)).toBe("SELECTED");
  if (result.status !== "SELECTED") throw new Error("Fixture selection failed");
  return result;
}

afterEach(async () => {
  for (const context of contexts.splice(0)) {
    await context.session.cleanup();
    await removeTempRoot(context.root);
  }
});

describe("Desktop session, Preview, and Export integration", () => {
  it("serves a valid FREEFORM JPEG Preview through the format-neutral token protocol", async () => {
    const context = await setup("freeform-jpeg-preview");
    const selected = await selectFixture(context, "fixtures/valid/object-right__product__basic__pass.png");
    const input = freeformInput(selected.assetToken, "JPEG", "freeform-jpeg-preview");
    const preview = await context.controller.requestPreview(input);

    expect(preview.errors).toEqual([]);
    expect(preview.previewUrl).toMatch(/^kbr-preview:\/\/preview\//u);
    expect(preview.previewArtifact).toMatchObject({
      format: "JPEG",
      mimeType: "image/jpeg",
      width: 1200,
      height: 600,
    });
    expect(preview.eligibility).toEqual({ hasRenderableArtifact: true, previewAllowed: true, publishAllowed: true, downloadAllowed: true });
    if (!preview.previewToken) throw new Error("JPEG Preview token missing");
    const artifact = await context.controller.previewArtifact(preview.previewToken);
    expect(artifact.mimeType).toBe("image/jpeg");
    expect((await sharp(artifact.bytes).metadata()).format).toBe("jpeg");

    const output = await context.controller.registerOutputDirectory(context.outputRoot);
    const exported = await context.controller.exportRender({ ...input, previewToken: preview.previewToken, outputDirectoryToken: output.token });
    expect(exported.status).toBe("EXPORTED");
    if (exported.status === "EXPORTED") {
      await expect(access(path.join(context.outputRoot, input.jobName, "output.jpg"))).resolves.toBeUndefined();
    }
  });

  it("retains a FREEFORM PNG POST_RENDER failure for Preview but blocks publish", async () => {
    const context = await setup("freeform-post-render");
    const fixturePath = path.join(context.root, "freeform-post-render-oversize.png");
    await writeFile(fixturePath, await deterministicOversizePng());
    const selected = await context.controller.selectProductFromPath(fixturePath);
    expect(selected.status).toBe("SELECTED");
    if (selected.status !== "SELECTED") return;
    const input = freeformInput(selected.assetToken, "PNG", "freeform-post-render");
    const preview = await context.controller.requestPreview(input);

    expect(preview.validationStatus).toBe("ERROR");
    expect(preview.errors).toContainEqual(expect.objectContaining({
      code: "KBR-FREEFORM-FILE-SIZE-EXCEEDED",
      stage: "POST_RENDER",
    }));
    expect(preview.previewToken).not.toBeNull();
    expect(preview.previewArtifact).toMatchObject({ format: "PNG", mimeType: "image/png", width: 1200, height: 600 });
    expect(preview.eligibility).toEqual({ hasRenderableArtifact: true, previewAllowed: true, publishAllowed: false, downloadAllowed: false });
    if (!preview.previewToken) return;
    expect((await context.controller.previewArtifact(preview.previewToken)).byteLength).toBeGreaterThan(500_000);

    const output = await context.controller.registerOutputDirectory(context.outputRoot);
    const exported = await context.controller.exportRender({ ...input, previewToken: preview.previewToken, outputDirectoryToken: output.token });
    expect(exported.status).toBe("BLOCKED");
    expect(await readdir(context.outputRoot)).toEqual([]);
  });

  it("does not create a Preview Artifact for a FREEFORM PRE_RENDER error", async () => {
    const context = await setup("freeform-pre-render");
    const selected = await selectFixture(context, "fixtures/valid/object-right__product__basic__pass.png");
    const input = freeformInput(selected.assetToken, "PNG", "freeform-pre-render", {
      policy: "MANUAL_CROP",
      source: "MANUAL",
      fitMode: "COVER",
      anchor: "CENTER",
      subjectProtection: "NONE",
    });
    const preview = await context.controller.requestPreview(input);

    expect(preview.validationStatus).toBe("ERROR");
    expect(preview.previewToken).toBeNull();
    expect(preview.previewUrl).toBeNull();
    expect(preview.errors.some(({ stage }) => stage === "PRE_RENDER")).toBe(true);
    expect(preview.eligibility).toEqual({ hasRenderableArtifact: false, previewAllowed: false, publishAllowed: false, downloadAllowed: false });
  });

  it("copies a selected product into the private session without exposing its absolute path", async () => {
    const context = await setup("select");
    const selected = await selectFixture(context, "fixtures/valid/object-right__product__basic__pass.png");

    expect(selected.displayName).toBe("object-right__product__basic__pass.png");
    expect(selected).not.toHaveProperty("absolutePath");
    expect(selected).not.toHaveProperty("path");
    await expect(access(path.join(context.session.inputRoot, "product.png"))).resolves.toBeUndefined();
    expect(context.session.getAsset(selected.assetToken).relativePath).toBe("product.png");
    expect(selected.detectedMimeType).toBe("image/png");
    expect(selected.checksumSha256).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("accepts JPEG, preserves the session extension, and returns only safe metadata", async () => {
    const context = await setup("jpeg-select");
    const selected = await selectFixture(context, "fixtures/valid/thumbnail-box-right__asset__jpeg__pass.jpg");

    expect(selected.detectedMimeType).toBe("image/jpeg");
    expect(selected.displayName).toContain(".jpg");
    expect(selected.hasAlpha).toBe(false);
    expect(selected.checksumSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(selected).not.toHaveProperty("absolutePath");
    expect(selected).not.toHaveProperty("path");
    await expect(access(path.join(context.session.inputRoot, "product.jpg"))).resolves.toBeUndefined();
    expect(context.session.getAsset(selected.assetToken).relativePath).toBe("product.jpg");
  });

  it("renders JPEG with THUMBNAIL_BOX_RIGHT and blocks JPEG in OBJECT_RIGHT", async () => {
    const context = await setup("jpeg-thumbnail");
    const selected = await selectFixture(context, "fixtures/valid/thumbnail-box-right__asset__jpeg__pass.jpg");
    const thumbnailInput: UiRenderInput = {
      ...uiInput(selected.assetToken, "jpeg-thumbnail"),
      template: "THUMBNAIL_BOX_RIGHT",
      placementPlan: {
        schemaVersion: "1.1.0",
        imageSlotId: "IMAGE_PRIMARY",
        assetId: "selected-product",
        policy: "SEMANTIC_CROP_COVER",
        source: "DETERMINISTIC",
        fitMode: "COVER",
        cropRect: { x: 0, y: 0, width: 1, height: 1 },
        anchor: "CENTER",
        subjectProtection: "NONE",
      },
    };
    const thumbnailPreview = await context.controller.requestPreview(thumbnailInput);
    expect(thumbnailPreview.validationStatus).toBe("PASS");
    expect(thumbnailPreview.previewToken).not.toBeNull();

    const objectPreview = await context.controller.requestPreview(uiInput(selected.assetToken, "jpeg-object"));
    expect(objectPreview.validationStatus).toBe("ERROR");
    expect(objectPreview.errors.map(({ code }) => code)).toContain("KBR-ASSET-MIME-NOT-ALLOWED");
  });

  it("renders THUMBNAIL_MULTI_RIGHT with two independent plans and one reused Asset", async () => {
    const context = await setup("multi-reuse");
    const selected = await selectFixture(context, "fixtures/valid/thumbnail-box-right__asset__basic__pass.png");
    const secondary = await context.controller.selectSecondaryProductFromPath(path.join(projectRoot, "fixtures/valid/thumbnail-box-right__asset__basic__pass.png"));
    expect(secondary.status).toBe("SELECTED");
    const input: UiRenderInput = {
      ...uiInput(selected.assetToken, "multi-reuse"),
      template: "THUMBNAIL_MULTI_RIGHT",
      ...(secondary.status === "SELECTED" ? { secondaryAssetToken: secondary.assetToken } : {}),
      placementPlans: [
        {
          schemaVersion: "1.1.0",
          imageSlotId: "IMAGE_SECONDARY",
          assetId: "reused-image",
          policy: "MANUAL_CROP",
          source: "MANUAL",
          fitMode: "COVER",
          cropRect: { x: 0.2, y: 0, width: 0.8, height: 1 },
          anchor: "CENTER",
          subjectProtection: "NONE",
        },
        {
          schemaVersion: "1.1.0",
          imageSlotId: "IMAGE_PRIMARY",
          assetId: "reused-image",
          policy: "MANUAL_CROP",
          source: "MANUAL",
          fitMode: "COVER",
          cropRect: { x: 0, y: 0, width: 0.8, height: 1 },
          anchor: "CENTER",
          subjectProtection: "NONE",
        },
      ],
    };
    const preview = await context.controller.requestPreview(input);
    expect(preview.validationStatus).toBe("PASS");
    expect(preview.appliedImagePlacements?.map((placement) => placement.imageSlotId)).toEqual(["IMAGE_PRIMARY", "IMAGE_SECONDARY"]);
    expect(preview.appliedImagePlacements?.map((placement) => placement.destinationRect)).toEqual([
      { x: 621, y: 43, width: 172, height: 172 },
      { x: 809, y: 43, width: 172, height: 172 },
    ]);
    if (!preview.previewToken || secondary.status !== "SELECTED") throw new Error("Multi Preview missing");
    const previewBytes = await context.controller.previewBytes(preview.previewToken);
    const output = await context.controller.registerOutputDirectory(context.outputRoot);
    const exported = await context.controller.exportRender({ ...input, previewToken: preview.previewToken, outputDirectoryToken: output.token });
    expect(exported.status).toBe("EXPORTED");
    if (exported.status !== "EXPORTED") return;
    const paths = context.controller.getExportPaths(exported.exportToken);
    expect((await readFile(paths.pngPath)).equals(previewBytes)).toBe(true);
    const manifest = JSON.parse(await readFile(paths.manifestPath, "utf8")) as { appliedImagePlacements?: unknown[] };
    expect(manifest.appliedImagePlacements).toHaveLength(2);
  });

  it("returns Preview PASS for an inset-alpha product", async () => {
    const context = await setup("preview-pass");
    const selected = await selectFixture(context, "fixtures/valid/object-right__product__inset-alpha__pass.png");
    const preview = await context.controller.requestPreview(uiInput(selected.assetToken, "preview-pass"));

    expect(preview.validationStatus).toBe("PASS");
    expect(preview.errors).toEqual([]);
    expect(preview.warnings).toEqual([]);
    expect(preview.previewToken).not.toBeNull();
  });

  it("returns Preview WARNING without blocking export", async () => {
    const context = await setup("preview-warning");
    const selected = await selectFixture(context, "fixtures/valid/object-right__product__basic__pass.png");
    const preview = await context.controller.requestPreview(uiInput(selected.assetToken, "preview-warning"));

    expect(preview.validationStatus).toBe("WARNING");
    expect(preview.errors).toEqual([]);
    expect(preview.warnings.map(({ code }) => code)).toContain("KBR-LAYOUT-009");
  });

  it("keeps Guide-off Preview bytes byte-equal to the Core atomic export", async () => {
    const context = await setup("byte-equal");
    const selected = await selectFixture(context, "fixtures/valid/object-right__product__basic__pass.png");
    const input = uiInput(selected.assetToken, "byte-equal");
    const preview = await context.controller.requestPreview(input);
    expect(preview.previewToken).not.toBeNull();
    if (!preview.previewToken) return;
    const previewBytes = await context.controller.previewBytes(preview.previewToken);
    const output = await context.controller.registerOutputDirectory(context.outputRoot);
    const exported = await context.controller.exportRender({
      ...input,
      previewToken: preview.previewToken,
      outputDirectoryToken: output.token,
    });
    expect(exported.status).toBe("EXPORTED");
    if (exported.status !== "EXPORTED") return;
    const paths = context.controller.getExportPaths(exported.exportToken);
    const exportedBytes = await readFile(paths.pngPath);

    expect(exportedBytes.equals(previewBytes)).toBe(true);
    expect(sha256Bytes(exportedBytes)).toBe(preview.previewPngDigest);
    expect(sha256Bytes(exportedBytes)).toBe(exported.pngDigest);
    await expect(access(paths.manifestPath)).resolves.toBeUndefined();

    const raw = await sharp(exportedBytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let y = 0; y < 258; y += 1) {
      for (let x = 981; x < 1029; x += 1) {
        expect(raw.data[(y * 1029 + x) * 4 + 3]).toBe(0);
      }
    }
  });

  it("returns Preview ERROR for a fully transparent product and writes no final files", async () => {
    const context = await setup("transparent");
    const selected = await selectFixture(context, "fixtures/invalid/object-right__alpha__fully-transparent__error.png");
    const preview = await context.controller.requestPreview(uiInput(selected.assetToken, "transparent"));

    expect(preview.validationStatus).toBe("ERROR");
    expect(preview.previewToken).toBeNull();
    expect(preview.errors.map(({ code }) => code)).toContain("KBR-ASSET-005");
    expect(await readdir(context.outputRoot)).toEqual([]);
  });

  it("blocks stale Preview after input changes", async () => {
    const context = await setup("stale-input");
    const selected = await selectFixture(context, "fixtures/valid/object-right__product__basic__pass.png");
    const input = uiInput(selected.assetToken, "stale-input");
    const preview = await context.controller.requestPreview(input);
    if (!preview.previewToken) throw new Error("Preview missing");
    const output = await context.controller.registerOutputDirectory(context.outputRoot);
    const result = await context.controller.exportRender({
      ...input,
      headline: "자코모 프리미엄 소파 변경",
      previewToken: preview.previewToken,
      outputDirectoryToken: output.token,
    });

    expect(result.status).toBe("BLOCKED");
    expect(await readdir(context.outputRoot)).toEqual([]);
  });

  it("invalidates the previous Preview when product is replaced", async () => {
    const context = await setup("replace-product");
    const first = await selectFixture(context, "fixtures/valid/object-right__product__basic__pass.png");
    const preview = await context.controller.requestPreview(uiInput(first.assetToken, "replace-product"));
    if (!preview.previewToken) throw new Error("Preview missing");
    const second = await selectFixture(context, "fixtures/valid/object-right__product__inset-alpha__pass.png");
    const output = await context.controller.registerOutputDirectory(context.outputRoot);
    const result = await context.controller.exportRender({
      ...uiInput(second.assetToken, "replace-product"),
      previewToken: preview.previewToken,
      outputDirectoryToken: output.token,
    });

    expect(result.status).toBe("ERROR");
    expect(result.status === "ERROR" ? result.code : "").toBe("DESKTOP-PREVIEW-001");
  });

  it("blocks overwrite and leaves the first completed pair intact", async () => {
    const context = await setup("overwrite");
    const selected = await selectFixture(context, "fixtures/valid/object-right__product__basic__pass.png");
    const input = uiInput(selected.assetToken, "same-job");
    const preview = await context.controller.requestPreview(input);
    if (!preview.previewToken) throw new Error("Preview missing");
    const output = await context.controller.registerOutputDirectory(context.outputRoot);
    const request = { ...input, previewToken: preview.previewToken, outputDirectoryToken: output.token };
    const first = await context.controller.exportRender(request);
    const second = await context.controller.exportRender(request);

    expect(first.status).toBe("EXPORTED");
    expect(second.status).toBe("BLOCKED");
    expect(second.status === "BLOCKED" ? second.errors.map(({ code }) => code) : []).toContain("KBR-INPUT-010");
    expect((await stat(path.join(context.outputRoot, "same-job", "output.png"))).size).toBeGreaterThan(0);
    expect((await stat(path.join(context.outputRoot, "same-job", "render-manifest.json"))).size).toBeGreaterThan(0);
  });

  it("removes session input and Preview data on cleanup", async () => {
    const context = await setup("cleanup");
    const selected = await selectFixture(context, "fixtures/valid/object-right__product__basic__pass.png");
    await context.controller.requestPreview(uiInput(selected.assetToken, "cleanup"));
    const sessionRoot = context.session.sessionRoot;
    await context.session.cleanup();
    await expect(access(sessionRoot)).rejects.toThrow();
  });
});
