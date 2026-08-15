import { access, mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { ImagePlacementPlan } from "@kbr/renderer-contract";
import { DesktopController } from "../../../apps/desktop/electron-main/src/desktop-controller.js";
import { DesktopSessionManager } from "../../../apps/desktop/electron-main/src/session/session-manager.js";
import { defaultGoogleStaticRequest } from "../../../apps/desktop/shared/src/index.js";
import type { ProductSelectionResult, UiRenderInput } from "../../../apps/desktop/shared/src/index.js";
import profilesRegistry from "../../../contracts/google/static-asset-profiles.g1.json" with { type: "json" };
import { sha256Bytes, sha256File } from "../../../src/core/hash.js";
import { createTempRoot, projectRoot, removeTempRoot } from "../../helpers.js";

type Context = { root: string; outputRoot: string; session: DesktopSessionManager; controller: DesktopController };
const contexts: Context[] = [];

async function setup(label: string): Promise<Context> {
  const root = await createTempRoot(`desktop-google-${label}`);
  const outputRoot = path.join(root, "output");
  await mkdir(outputRoot, { recursive: true });
  const session = new DesktopSessionManager(path.join(root, "sessions"));
  await session.initialize();
  const controller = new DesktopController({ projectRoot, session, appVersion: "0.11.0-test", blockedNetworkRequestCount: () => 0 });
  const context = { root, outputRoot, session, controller };
  contexts.push(context);
  return context;
}

async function selectSource(context: Context, profileId: string) {
  const selected = await context.controller.selectProductFromPath(path.join(projectRoot, "fixtures/google/g2/source", `g2-${profileId}.png`));
  expect(selected.status).toBe("SELECTED");
  if (selected.status !== "SELECTED") throw new Error("Google source fixture selection failed");
  return selected;
}

async function readPlan(profileId: string, selected: Extract<ProductSelectionResult, { status: "SELECTED" }>) {
  const profile = [...profilesRegistry.geometryProfiles, ...profilesRegistry.uploadedDisplayStaticProfiles].find((entry) => entry.profileId === profileId);
  if (!profile) throw new Error(`Profile missing: ${profileId}`);
  return defaultGoogleStaticRequest(profile, selected);
}

afterEach(async () => {
  for (const context of contexts.splice(0)) {
    await context.session.cleanup();
    await removeTempRoot(context.root);
  }
});

describe("Google Static Desktop QA controller", () => {
  it("renders the frozen landscape Golden and exports one atomic artifact pair", async () => {
    const context = await setup("golden");
    const profileId = "GOOGLE_MARKETING_LANDSCAPE_1_91";
    const selected = await selectSource(context, profileId);
    const plan = await readPlan(profileId, selected);
    const googleStatic: NonNullable<UiRenderInput["googleStatic"]> = { ...plan, profileId, capabilityId: "GOOGLE_RDA_ASSET_SET" };
    const input: UiRenderInput = {
      assetToken: selected.assetToken,
      advertiser: "",
      headline: "",
      subcopy: "",
      jobName: "google-landscape",
      requestSequence: 1,
      googleStatic,
    };
    const preview = await context.controller.requestPreview(input);
    expect(preview.validationStatus).toBe("PASS");
    expect(preview.errors).toEqual([]);
    expect(preview.previewToken).toMatch(/^[0-9a-f-]{36}$/u);
    expect(preview.previewPngDigest).toBe("04cd7330f288ee37f701edef3f030ae1d682a7a77da71ddccef990eefb048658");
    expect(preview.pngMetadata).toMatchObject({ format: "PNG", width: 1200, height: 628 });
    expect(preview.googleStatic?.deliveryCardinality).toBe("COLLECTION");
    if (!preview.previewToken) throw new Error("Google preview token missing");
    const output = await context.controller.registerOutputDirectory(context.outputRoot);
    const exported = await context.controller.exportRender({ ...input, previewToken: preview.previewToken, outputDirectoryToken: output.token });
    expect(exported.status).toBe("EXPORTED");
    if (exported.status !== "EXPORTED") return;
    const artifactPath = path.join(context.outputRoot, input.jobName, "output.png");
    await expect(access(artifactPath)).resolves.toBeUndefined();
    expect(await sha256File(artifactPath)).toBe(exported.artifactDigest);
    const manifest = JSON.parse(await readFile(path.join(context.outputRoot, input.jobName, "render-manifest.json"), "utf8")) as Record<string, unknown>;
    expect(manifest).not.toHaveProperty("manifestDigest");
    expect(manifest.outputArtifactDigest).toBe(exported.artifactDigest);
  });

  it("keeps metadata outside raster bytes and blocks invalid profile publication", async () => {
    const context = await setup("metadata-boundary");
    const profileId = "GOOGLE_DG_UPLOAD_300X250";
    const selected = await selectSource(context, profileId);
    const plan = await readPlan(profileId, selected);
    const googleStaticRequest: NonNullable<UiRenderInput["googleStatic"]> = { ...plan, profileId, capabilityId: "GOOGLE_DEMAND_GEN_UPLOADED_DISPLAY_STATIC", deliveryMetadata: { targetName: "A" } };
    const base: UiRenderInput = {
      assetToken: selected.assetToken,
      advertiser: "",
      headline: "",
      subcopy: "",
      jobName: "google-uploaded",
      requestSequence: 1,
      googleStatic: googleStaticRequest,
    };
    const googleStatic = base.googleStatic;
    if (!googleStatic) throw new Error("Google Static request is missing");
    const first = await context.controller.requestPreview(base);
    expect(first.validationStatus).toBe("PASS");
    const firstDigest = first.previewPngDigest;
    if (!first.previewToken) throw new Error("Google preview token missing");
    const output = await context.controller.registerOutputDirectory(context.outputRoot);
    const exported = await context.controller.exportRender({ ...base, previewToken: first.previewToken, outputDirectoryToken: output.token });
    expect(exported.status).toBe("EXPORTED");
    const stale = await context.controller.exportRender({ ...base, googleStatic: { ...googleStatic, deliveryMetadata: { targetName: "B" } }, previewToken: first.previewToken, outputDirectoryToken: output.token });
    expect(stale).toMatchObject({ status: "BLOCKED", code: "DESKTOP-EXPORT-003" });
    const second = await context.controller.requestPreview({ ...base, requestSequence: 2, googleStatic: { ...googleStatic, deliveryMetadata: { targetName: "B", fieldOnly: true } } });
    expect(second.validationStatus).toBe("PASS");
    expect(second.previewPngDigest).toBe(firstDigest);

    const invalid = await context.controller.requestPreview({ ...base, requestSequence: 3, googleStatic: { ...googleStatic, profileId: "GOOGLE_UNKNOWN_PROFILE" } });
    expect(invalid.validationStatus).toBe("ERROR");
    expect(invalid.previewToken).toBeNull();
    expect(invalid.errors.map((issue) => issue.code)).toContain("KBR-GOOGLE-ASSET-PROFILE-UNKNOWN");
    const blocked = await context.controller.exportRender({ ...base, previewToken: invalid.previewToken ?? "00000000-0000-4000-8000-000000000000", outputDirectoryToken: output.token });
    expect(blocked.status).not.toBe("EXPORTED");
    expect(await stat(context.outputRoot).then(() => true)).toBe(true);
    expect(sha256Bytes(Buffer.from("metadata-only"))).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("selects the requested raster format and blocks export until a JPEG preview is current", async () => {
    const context = await setup("format-parity");
    const profileId = "GOOGLE_MARKETING_LANDSCAPE_1_91";
    const selected = await selectSource(context, profileId);
    const plan = await readPlan(profileId, selected);
    const base: UiRenderInput = {
      assetToken: selected.assetToken,
      advertiser: "",
      headline: "",
      subcopy: "",
      jobName: "google-format-parity",
      requestSequence: 1,
      googleStatic: { ...plan, profileId, capabilityId: "GOOGLE_RDA_ASSET_SET" },
    };
    const preview = await context.controller.requestPreview(base);
    expect(preview.validationStatus).toBe("PASS");
    if (!preview.previewToken) throw new Error("Google preview token missing");
    const baseGoogleStatic = base.googleStatic;
    if (!baseGoogleStatic) throw new Error("Google Static request missing");
    const output = await context.controller.registerOutputDirectory(context.outputRoot);
    const jpegRequest: UiRenderInput = {
      ...base,
      requestSequence: 2,
      googleStatic: { ...baseGoogleStatic, outputFormat: "JPEG", jpegQuality: 88 },
    };
    const stale = await context.controller.exportRender({ ...jpegRequest, previewToken: preview.previewToken, outputDirectoryToken: output.token });
    expect(stale).toMatchObject({ status: "BLOCKED", code: "DESKTOP-EXPORT-003" });

    const jpegPreview = await context.controller.requestPreview(jpegRequest);
    expect(jpegPreview.validationStatus).toBe("PASS");
    expect(jpegPreview.pngMetadata).toMatchObject({ format: "JPEG", width: 1200, height: 628 });
    if (!jpegPreview.previewToken) throw new Error("JPEG preview token missing");
    const exported = await context.controller.exportRender({ ...jpegRequest, previewToken: jpegPreview.previewToken, outputDirectoryToken: output.token });
    expect(exported.status).toBe("EXPORTED");
    if (exported.status !== "EXPORTED") return;
    expect(exported.artifactFormat).toBe("JPEG");
    const artifactPath = path.join(context.outputRoot, base.jobName, "output.jpg");
    const artifact = await readFile(artifactPath);
    expect(artifact.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
    expect(artifact.subarray(-2)).toEqual(Buffer.from([0xff, 0xd9]));
  });

  it("propagates a common manual placement plan through preview, stale export, and publish", async () => {
    const context = await setup("placement-parity");
    const profileId = "GOOGLE_MARKETING_LANDSCAPE_1_91";
    const selected = await selectSource(context, profileId);
    const plan = await readPlan(profileId, selected);
    const base: UiRenderInput = {
      assetToken: selected.assetToken,
      advertiser: "",
      headline: "",
      subcopy: "",
      jobName: "google-placement-parity",
      requestSequence: 1,
      googleStatic: { ...plan, profileId, capabilityId: "GOOGLE_RDA_ASSET_SET" },
    };
    const baseGoogleStatic = base.googleStatic;
    if (!baseGoogleStatic) throw new Error("Google Static request missing");
    const first = await context.controller.requestPreview(base);
    expect(first.validationStatus).toBe("PASS");
    if (!first.previewToken) throw new Error("Google preview token missing");
    const cropRect = { x: 0.2, y: 0, width: 0.7, height: 1 };
    const placementPlan: ImagePlacementPlan = {
      schemaVersion: "1.8.0",
      imageSlotId: "GOOGLE_STATIC_PRIMARY",
      assetId: selected.checksumSha256,
      policy: "MANUAL_CROP",
      source: "MANUAL",
      fitMode: "COVER",
      cropRect,
      anchor: "CENTER",
      subjectProtection: "NONE",
    };
    const changedSourceRect = {
      x: Math.floor(cropRect.x * selected.width),
      y: Math.floor(cropRect.y * selected.height),
      width: Math.ceil((cropRect.x + cropRect.width) * selected.width) - Math.floor(cropRect.x * selected.width),
      height: Math.ceil((cropRect.y + cropRect.height) * selected.height) - Math.floor(cropRect.y * selected.height),
    };
    const changedRequest: UiRenderInput = {
      ...base,
      requestSequence: 2,
      googleStatic: {
        ...baseGoogleStatic,
        placementPlan,
        sourceRect: changedSourceRect,
      },
    };
    const output = await context.controller.registerOutputDirectory(context.outputRoot);
    const stale = await context.controller.exportRender({ ...changedRequest, previewToken: first.previewToken, outputDirectoryToken: output.token });
    expect(stale).toMatchObject({ status: "BLOCKED", code: "DESKTOP-EXPORT-003" });
    const second = await context.controller.requestPreview(changedRequest);
    expect(second.validationStatus).toBe("PASS");
    expect(second.previewPngDigest).not.toBe(first.previewPngDigest);
    if (!second.previewToken) throw new Error("Manual placement preview token missing");
    const exported = await context.controller.exportRender({ ...changedRequest, previewToken: second.previewToken, outputDirectoryToken: output.token });
    expect(exported.status).toBe("EXPORTED");
    if (exported.status !== "EXPORTED") throw new Error("Manual placement export did not complete");
    expect(exported.artifactFormat).toBe("PNG");
  });
});
