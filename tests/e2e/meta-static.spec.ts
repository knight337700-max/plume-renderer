import { randomUUID } from "node:crypto";
import { access, mkdir, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { _electron as electron, expect, test, type ElectronApplication, type Page } from "@playwright/test";

import { projectRoot } from "../helpers.js";

type Launched = { app: ElectronApplication; page: Page; root: string; outputRoot: string; sessionRoot: string };

async function launch(): Promise<Launched> {
  const root = path.join(os.tmpdir(), `kbr-meta-e2e-${randomUUID()}`);
  const outputRoot = path.join(root, "output");
  const sessionRoot = path.join(root, "sessions");
  const product = path.join(projectRoot, "fixtures", "valid", "object-right__product__basic__pass.png");
  await Promise.all([mkdir(outputRoot, { recursive: true }), mkdir(sessionRoot, { recursive: true })]);
  const app = await electron.launch({
    args: [projectRoot],
    cwd: projectRoot,
    env: { ...process.env, KBR_E2E_MODE: "1", KBR_E2E_PRODUCT: product, KBR_E2E_OUTPUT: outputRoot, KBR_E2E_SESSION_BASE: sessionRoot },
  });
  const page = await app.firstWindow();
  await page.waitForSelector('[data-testid="desktop-app"]');
  return { app, page, root, outputRoot, sessionRoot };
}

async function close(launched: Launched): Promise<void> {
  await launched.app.close();
  await expect.poll(async () => (await readdir(launched.sessionRoot)).length).toBe(0);
  await rm(launched.root, { recursive: true, force: true });
}

test("META selector renders a project preset and exports the ordered placement set", async () => {
  const launched = await launch();
  try {
    await launched.page.getByTestId("channel-meta").click();
    await expect(launched.page.getByText("META Static Renderer Lab", { exact: true })).toBeVisible();
    await expect(launched.page.getByTestId("meta-profile-select")).toHaveValue("META_STATIC_FEED_SQUARE");
    await expect(launched.page.getByTestId("meta-platform-copy")).toContainText("metadata only");

    await launched.page.getByTestId("freeform-select-image").click();
    await expect(launched.page.getByText("object-right__product__basic__pass.png", { exact: true })).toBeVisible();
    await launched.page.getByTestId("meta-platform-headline").fill("Meta headline metadata");
    await launched.page.getByTestId("meta-profile-select").selectOption("META_STATIC_VERTICAL_FULL");
    await launched.page.getByTestId("meta-placement-context").selectOption("INSTAGRAM_STORIES");
    await expect(launched.page.getByTestId("meta-safe-zone-guide")).toBeVisible();
    await launched.page.getByTestId("freeform-render-preview").click();
    await expect(launched.page.getByTestId("freeform-preview-image")).toBeVisible();
    await expect(launched.page.getByTestId("freeform-status")).toHaveText(/PASS|WARNING/u);
    await expect(launched.page.getByTestId("freeform-preview-image")).toHaveAttribute("data-preview-format", "PNG");

    await launched.page.getByTestId("meta-output-mode").selectOption("PLACEMENT_SET");
    await expect(launched.page.getByTestId("meta-placement-tab-META_STATIC_FEED_SQUARE")).toBeVisible();
    await expect(launched.page.getByTestId("meta-placement-tab-META_STATIC_FEED_PORTRAIT")).toBeVisible();
    await expect(launched.page.getByTestId("meta-placement-tab-META_STATIC_VERTICAL_FULL")).toBeVisible();
    await launched.page.getByTestId("freeform-render-preview").click();
    await expect(launched.page.getByTestId("freeform-preview-image")).toBeVisible();
    await expect(launched.page.getByTestId("freeform-status")).toHaveText(/PASS|WARNING/u);

    await launched.page.getByTestId("freeform-select-output").click();
    await expect(launched.page.getByTestId("freeform-export")).toBeEnabled();
    await launched.page.getByTestId("freeform-export").click();
    await expect(launched.page.getByTestId("freeform-export-result")).toBeVisible();
    await expect(access(path.join(launched.outputRoot, "freeform-render", "meta-placement-set-manifest.json"))).resolves.toBeUndefined();
    expect(await launched.page.evaluate(() => window.kbrDesktop.getAppInfo())).toMatchObject({ blockedNetworkRequestCount: 0 });
  } finally {
    await close(launched);
  }
});

test("vertical META profile starts neutral and propagates explicit Stories context", async () => {
  const launched = await launch();
  try {
    await launched.page.getByTestId("channel-meta").click();
    await launched.page.getByTestId("meta-profile-select").selectOption("META_STATIC_VERTICAL_FULL");
    await expect(launched.page.getByTestId("meta-placement-context")).toHaveValue("");
    await expect(launched.page.getByTestId("meta-safe-zone-guide")).toHaveCount(0);
    await launched.page.getByTestId("meta-placement-context").selectOption("INSTAGRAM_STORIES");
    await expect(launched.page.getByTestId("meta-safe-zone-guide")).toBeVisible();
    await launched.page.getByTestId("freeform-render-preview").click();
    await expect(launched.page.getByTestId("freeform-preview-image")).toBeVisible();
    await expect(launched.page.getByTestId("freeform-status")).toHaveText(/PASS|WARNING/u);
  } finally {
    await close(launched);
  }
});

test("META QA bridge keeps Feed safe-zone guidance disabled and exposes manifest context", async () => {
  const launched = await launch();
  try {
    const page = launched.page;
    await page.getByTestId("channel-meta").click();
    await page.getByTestId("freeform-select-image").click();
    await expect(page.getByTestId("meta-profile-select")).toHaveValue("META_STATIC_FEED_SQUARE");
    await expect(page.getByTestId("meta-placement-context")).toHaveValue("FACEBOOK_FEED");
    await expect(page.getByTestId("freeform-safe-zone-toggle")).toBeDisabled();
    await expect(page.getByTestId("meta-safe-zone-guide")).toHaveCount(0);
    await expect(page.getByTestId("freeform-manual-review")).not.toContainText("공식 Safe Zone geometry가 없어 자동으로 그리지 않습니다.");
    await expect(page.getByTestId("meta-request-format-profile")).toHaveText("META_STATIC_FEED_SQUARE");
    await expect(page.getByTestId("meta-request-placement-context")).toHaveText("FACEBOOK_FEED");
    await page.getByTestId("freeform-render-preview").click();
    await expect(page.getByTestId("freeform-preview-image")).toBeVisible();
    await expect(page.getByTestId("freeform-preview-outcome-status")).toHaveText("PREVIEW_RENDERED");
    await expect(page.getByTestId("meta-render-manifest-viewer")).toContainText("Last Render Manifest");
    await expect(page.getByTestId("meta-manifest-format-profile")).toHaveText("META_STATIC_FEED_SQUARE");
    await expect(page.getByTestId("meta-manifest-requested-context")).toHaveText("FACEBOOK_FEED");
    await expect(page.getByTestId("meta-manifest-resolved-context")).toHaveText("FACEBOOK_FEED");
    await expect(page.getByTestId("freeform-plan-import-panel")).toContainText("Imported CreativeLayoutPlan JSON");
  } finally {
    await close(launched);
  }
});

test("META QA bridge routes Stories and Reels Preview without a silent no-op", async () => {
  const launched = await launch();
  try {
    const page = launched.page;
    await page.getByTestId("channel-meta").click();
    await page.getByTestId("freeform-select-image").click();
    await expect(page.getByText("object-right__product__basic__pass.png", { exact: true })).toBeVisible();
    await page.getByTestId("meta-profile-select").selectOption("META_STATIC_VERTICAL_FULL");
    await expect(page.getByTestId("meta-placement-context")).toHaveValue("");
    await page.getByTestId("meta-placement-context").selectOption("INSTAGRAM_STORIES");
    await expect(page.getByTestId("meta-safe-zone-guide")).toBeVisible();
    await expect(page.getByTestId("freeform-safe-zone-toggle")).toBeEnabled();
    await page.getByTestId("freeform-render-preview").click();
    await expect(page.getByTestId("freeform-preview-image")).toBeVisible();
    await expect(page.getByTestId("freeform-preview-outcome-status")).toHaveText("PREVIEW_RENDERED");
    await expect(page.getByTestId("meta-manifest-requested-context")).toHaveText("INSTAGRAM_STORIES");
    await expect(page.getByTestId("meta-manifest-resolved-context")).toHaveText("INSTAGRAM_STORIES");
    await expect(page.getByTestId("meta-reels-source-required")).toHaveCount(0);

    await page.getByTestId("meta-placement-context").selectOption("INSTAGRAM_REELS");
    await expect(page.getByTestId("meta-safe-zone-guide")).toHaveCount(0);
    await expect(page.getByTestId("freeform-safe-zone-toggle")).toBeDisabled();
    await expect(page.getByTestId("meta-reels-source-required")).toBeVisible();
    await page.getByTestId("freeform-render-preview").click();
    await expect(page.getByTestId("freeform-preview-image")).toBeVisible();
    await expect(page.getByTestId("freeform-preview-outcome-status")).toHaveText("PREVIEW_RENDERED");
    await expect(page.getByTestId("meta-manifest-requested-context")).toHaveText("INSTAGRAM_REELS");
    await expect(page.getByTestId("meta-manifest-resolved-context")).toHaveText("INSTAGRAM_REELS");
  } finally {
    await close(launched);
  }
});

test("META QA bridge preserves imported Plan placement across context/profile switches and reports invalid Plan roots", async () => {
  const launched = await launch();
  try {
    const page = launched.page;
    await page.getByTestId("channel-meta").click();
    await page.getByTestId("freeform-select-image").click();
    await expect(page.getByText("object-right__product__basic__pass.png", { exact: true })).toBeVisible();
    const importedPlan = {
      schemaVersion: "1.0.0",
      formatProfileId: "META_STATIC_FEED_SQUARE",
      source: "MANUAL",
      background: { type: "SOLID", color: "#FFFFFF" },
      elements: [{
        id: "hero",
        type: "IMAGE",
        assetId: "asset-primary",
        bounds: { x: 0, y: 0, width: 1, height: 1 },
        zIndex: 2,
        opacity: 0.82,
        placement: {
          policy: "MANUAL_CROP",
          source: "MANUAL",
          fitMode: "COVER",
          cropRect: { x: 0.125, y: 0, width: 0.75, height: 1 },
          anchor: "CENTER",
          subjectProtection: "PREFERRED",
        },
      }],
    };
    await page.getByTestId("freeform-plan-json").fill(JSON.stringify(importedPlan));
    await page.getByTestId("freeform-plan-import").click();
    await expect(page.getByTestId("freeform-image-policy")).toHaveValue("MANUAL_CROP");
    await expect(page.getByTestId("freeform-crop-x")).toHaveValue("0.125");
    await expect(page.getByTestId("freeform-geometry-hero-opacity")).toHaveValue("0.82");
    await page.getByTestId("meta-profile-select").selectOption("META_STATIC_VERTICAL_FULL");
    await expect(page.getByTestId("meta-placement-context")).toHaveValue("");
    await expect(page.getByTestId("freeform-image-policy")).toHaveValue("MANUAL_CROP");
    await page.getByTestId("freeform-render-preview").click();
    await expect(page.getByTestId("freeform-preview-image")).toBeVisible();
    await expect(page.getByTestId("meta-manifest-requested-context")).toHaveText("null");
    await expect(page.getByTestId("meta-manifest-resolved-context")).toHaveText("null");
    await page.getByTestId("meta-placement-context").selectOption("INSTAGRAM_REELS");
    await page.getByTestId("meta-profile-select").selectOption("META_STATIC_FEED_PORTRAIT");
    await expect(page.getByTestId("meta-placement-context")).toHaveValue("FACEBOOK_FEED");
    await expect(page.getByTestId("freeform-image-policy")).toHaveValue("MANUAL_CROP");
    await page.getByTestId("meta-placement-context").selectOption("INSTAGRAM_FEED");
    await page.getByTestId("freeform-render-preview").click();
    await expect(page.getByTestId("freeform-preview-image")).toBeVisible();
    await expect(page.getByTestId("meta-manifest-format-profile")).toHaveText("META_STATIC_FEED_PORTRAIT");
    await expect(page.getByText("공식 Safe Zone geometry가 없어 자동으로 그리지 않습니다.", { exact: true })).toHaveCount(0);

    const invalidPlan = { ...importedPlan, placementContext: "INSTAGRAM_REELS" };
    await page.getByTestId("freeform-plan-json").fill(JSON.stringify(invalidPlan));
    await page.getByTestId("freeform-plan-import").click();
    await expect(page.getByTestId("freeform-preview-outcome-status")).toHaveText("VALIDATION_BLOCKED");
    await expect(page.getByTestId("freeform-preview-outcome-code")).toHaveText("KBR-FREEFORM-PLAN-SCHEMA-INVALID");
    await expect(page.getByTestId("freeform-notice")).toContainText("MOVE_PLACEMENT_CONTEXT_TO_RENDER_REQUEST");
  } finally {
    await close(launched);
  }
});
