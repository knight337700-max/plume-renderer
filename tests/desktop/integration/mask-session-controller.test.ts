import { access, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { DesktopController } from "../../../apps/desktop/electron-main/src/desktop-controller.js";
import { DesktopSessionManager } from "../../../apps/desktop/electron-main/src/session/session-manager.js";
import type { UiRenderInput } from "../../../apps/desktop/shared/src/index.js";
import { INTEGRATION_SCHEMA_VERSION } from "../../../packages/renderer-contract/src/index.js";
import { createTempRoot, projectRoot, removeTempRoot } from "../../helpers.js";

const contexts: Array<{ root: string; session: DesktopSessionManager; controller: DesktopController }> = [];

async function setup() {
  const root = await createTempRoot("desktop-mask");
  const session = new DesktopSessionManager(path.join(root, "sessions"));
  await session.initialize();
  const controller = new DesktopController({ projectRoot, session, appVersion: "0.7.0-test", blockedNetworkRequestCount: () => 0 });
  const context = { root, session, controller };
  contexts.push(context);
  return context;
}

afterEach(async () => {
  for (const context of contexts.splice(0)) {
    await context.session.cleanup();
    await removeTempRoot(context.root);
  }
});

describe("MASK_SEMICIRCLE_RIGHT desktop controller", () => {
  it("selects a PNG black logo, previews the two slots, and atomically exports a manifest", async () => {
    const context = await setup();
    const image = await context.controller.selectProductFromPath(path.join(projectRoot, "fixtures/valid/mask-semicircle-right__image__basic__pass.png"));
    const logo = await context.controller.selectLogoFromPath(path.join(projectRoot, "fixtures/valid/mask-semicircle-right__logo__black__pass.png"));
    expect(image.status).toBe("SELECTED");
    expect(logo.status).toBe("SELECTED");
    if (image.status !== "SELECTED" || logo.status !== "SELECTED") return;
    const input: UiRenderInput = {
      assetToken: image.assetToken,
      logoAssetToken: logo.assetToken,
      advertiser: "자코모",
      headline: "자코모 프리미엄 소파",
      subcopy: "거실을 바꾸는 선택",
      jobName: "mask-session-output",
      requestSequence: 1,
      template: "MASK_SEMICIRCLE_RIGHT",
      placementPlans: [
        { schemaVersion: INTEGRATION_SCHEMA_VERSION, imageSlotId: "IMAGE_PRIMARY", assetId: "selected-image", policy: "MANUAL_CROP", source: "MANUAL", fitMode: "COVER", cropRect: { x: 0, y: 0, width: 1, height: 1 }, anchor: "CENTER", subjectProtection: "NONE" },
        { schemaVersion: INTEGRATION_SCHEMA_VERSION, imageSlotId: "LOGO_PRIMARY", assetId: "selected-logo", policy: "ALPHA_TRIM_CONTAIN", source: "DETERMINISTIC", fitMode: "CONTAIN", anchor: "CENTER", subjectProtection: "NONE" },
      ],
    };
    const preview = await context.controller.requestPreview(input);
    expect(preview.validationStatus).toBe("WARNING");
    expect(preview.previewToken).not.toBeNull();
    expect(preview.appliedImagePlacements?.map((placement) => placement.imageSlotId)).toEqual(["IMAGE_PRIMARY", "LOGO_PRIMARY"]);
    const outputRoot = path.join(context.root, "output");
    await mkdir(outputRoot, { recursive: true });
    const output = await context.controller.registerOutputDirectory(outputRoot);
    if (!preview.previewToken) return;
    const exported = await context.controller.exportRender({ ...input, previewToken: preview.previewToken, outputDirectoryToken: output.token });
    expect(exported.status).toBe("EXPORTED");
    if (exported.status !== "EXPORTED") return;
    const paths = context.controller.getExportPaths(exported.exportToken);
    await expect(access(paths.pngPath)).resolves.toBeUndefined();
    const manifest = JSON.parse(await readFile(paths.manifestPath, "utf8")) as Record<string, unknown>;
    expect(manifest.templateId).toBe("KAKAO_MOMENT_BIZBOARD_MASK_SEMICIRCLE_RIGHT");
    expect(manifest.templateContractVersion).toBe("1.5.0");
    expect((manifest.assetDigests as Record<string, unknown>).mask).toEqual({ id: "KAKAO_BIZBOARD_MASK_SEMICIRCLE_RIGHT_V1", sha256: "6b4d6f9a30fe29faf46f94c000d9436bee0cbf384c9204bf45b1ce3ef35d51eb" });
  });

  it("previews and exports with no LOGO_PRIMARY asset or plan", async () => {
    const context = await setup();
    const image = await context.controller.selectProductFromPath(path.join(projectRoot, "fixtures/valid/mask-semicircle-right__image__basic__pass.png"));
    expect(image.status).toBe("SELECTED");
    if (image.status !== "SELECTED") return;
    const input: UiRenderInput = {
      assetToken: image.assetToken,
      advertiser: "자코모",
      headline: "자코모 프리미엄 소파",
      subcopy: "거실을 바꾸는 선택",
      jobName: "mask-session-no-logo",
      requestSequence: 2,
      template: "MASK_SEMICIRCLE_RIGHT",
      placementPlans: [
        { schemaVersion: INTEGRATION_SCHEMA_VERSION, imageSlotId: "IMAGE_PRIMARY", assetId: "selected-image", policy: "MANUAL_CROP", source: "MANUAL", fitMode: "COVER", cropRect: { x: 0, y: 0, width: 1, height: 1 }, anchor: "CENTER", subjectProtection: "NONE" },
      ],
    };
    const preview = await context.controller.requestPreview(input);
    expect(preview.validationStatus).toBe("PASS");
    expect(preview.appliedImagePlacements?.map((placement) => placement.imageSlotId)).toEqual(["IMAGE_PRIMARY"]);
    const outputRoot = path.join(context.root, "output");
    await mkdir(outputRoot, { recursive: true });
    const output = await context.controller.registerOutputDirectory(outputRoot);
    if (!preview.previewToken) return;
    const exported = await context.controller.exportRender({ ...input, previewToken: preview.previewToken, outputDirectoryToken: output.token });
    expect(exported.status).toBe("EXPORTED");
  });
});
