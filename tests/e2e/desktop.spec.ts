import { randomUUID } from "node:crypto";
import { access, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { _electron as electron, expect, test, type ElectronApplication, type Page } from "@playwright/test";

import { sha256File } from "../../src/core/hash.js";
import { projectRoot } from "../helpers.js";

const GOLDEN_SHA256 = "20dc9d62b8650a72115a8d584846399d9cd6dd2c8a0996b4889edb596feb68b1";
const THUMBNAIL_GOLDEN_SHA256 = "f1111ee8f36fe1d8ccc7aaa445b175906e8a6432027d3e65764158ad40c52996";

type Launched = {
  app: ElectronApplication;
  page: Page;
  root: string;
  outputRoot: string;
  sessionRoot: string;
};

async function launch(productPath: string): Promise<Launched> {
  const root = path.join(os.tmpdir(), `kbr-e2e-${randomUUID()}`);
  const outputRoot = path.join(root, "output");
  const sessionRoot = path.join(root, "sessions");
  await Promise.all([mkdir(outputRoot, { recursive: true }), mkdir(sessionRoot, { recursive: true })]);
  const app = await electron.launch({
    args: [projectRoot],
    cwd: projectRoot,
    env: {
      ...process.env,
      KBR_E2E_MODE: "1",
      KBR_E2E_PRODUCT: productPath,
      KBR_E2E_OUTPUT: outputRoot,
      KBR_E2E_SESSION_BASE: sessionRoot,
    },
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

async function fillValidForm(page: Page, jobName: string): Promise<void> {
  await page.getByTestId("input-advertiser").fill("자코모");
  await page.getByTestId("input-headline").fill("자코모 프리미엄 소파");
  await page.getByTestId("input-subcopy").fill("거실을 바꾸는 선택");
  await page.getByTestId("input-jobName").fill(jobName);
}

test("valid Desktop workflow renders Preview and atomically exports the Golden PNG", async () => {
  const launched = await launch(
    path.join(projectRoot, "fixtures", "valid", "object-right__product__basic__pass.png"),
  );
  try {
    const rendererGlobals = await launched.page.evaluate(() => ({
      process: typeof (window as unknown as { process?: unknown }).process,
      require: typeof (window as unknown as { require?: unknown }).require,
      bridge: typeof window.kbrDesktop,
    }));
    expect(rendererGlobals).toEqual({ process: "undefined", require: "undefined", bridge: "object" });

    await launched.page.getByTestId("select-product").click();
    await expect(launched.page.getByTestId("product-metadata")).toContainText("object-right__product__basic__pass.png");
    await fillValidForm(launched.page, "desktop-e2e");
    await launched.page.getByTestId("request-preview").click();
    await expect(launched.page.getByTestId("workflow-status")).toHaveText(/VALID_(?:PASS|WARNING)/u);
    await expect(launched.page.getByTestId("preview-image")).toBeVisible();
    await expect(launched.page.getByTestId("guide-overlay")).toBeVisible();

    await launched.page.getByTestId("select-output").click();
    await expect(launched.page.getByTestId("export-render")).toBeEnabled();
    await launched.page.getByTestId("export-render").click();
    await expect(launched.page.getByTestId("workflow-status")).toHaveText("EXPORTED");
    await expect(launched.page.getByTestId("export-result")).toContainText(GOLDEN_SHA256);

    const pngPath = path.join(launched.outputRoot, "desktop-e2e", "output.png");
    const manifestPath = path.join(launched.outputRoot, "desktop-e2e", "render-manifest.json");
    await expect.poll(async () => sha256File(pngPath)).toBe(GOLDEN_SHA256);
    await expect(access(manifestPath)).resolves.toBeUndefined();

    const appInfo = await launched.page.evaluate(() => window.kbrDesktop.getAppInfo());
    expect(appInfo.blockedNetworkRequestCount).toBe(0);

    await launched.page.getByTestId("input-headline").fill("자코모 프리미엄 소파 변경");
    await expect(launched.page.getByTestId("workflow-status")).toHaveText("DIRTY");
    await expect(launched.page.getByTestId("export-render")).toBeDisabled();
  } finally {
    await close(launched);
  }
});

test("fully transparent PNG produces Core ERROR and cannot export", async () => {
  const launched = await launch(
    path.join(projectRoot, "fixtures", "invalid", "object-right__alpha__fully-transparent__error.png"),
  );
  try {
    await launched.page.getByTestId("select-product").click();
    await fillValidForm(launched.page, "transparent-e2e");
    await launched.page.getByTestId("request-preview").click();
    await expect(launched.page.getByTestId("workflow-status")).toHaveText("VALID_ERROR");
    await expect(launched.page.getByTestId("issue-list")).toContainText("KBR-ASSET-005");
    await launched.page.getByTestId("select-output").click();
    await expect(launched.page.getByTestId("export-render")).toBeDisabled();
    expect(await readdir(launched.outputRoot)).toEqual([]);
  } finally {
    await close(launched);
  }
});

test("corrupt PNG and injected privileged fields are rejected", async () => {
  const corruptRoot = path.join(os.tmpdir(), `kbr-e2e-corrupt-${randomUUID()}`);
  await mkdir(corruptRoot, { recursive: true });
  const corruptPath = path.join(corruptRoot, "corrupt.png");
  await writeFile(corruptPath, Buffer.from("89504e470d0a1a0a00000000", "hex"));
  const launched = await launch(corruptPath);
  try {
    await launched.page.getByTestId("select-product").click();
    await expect(launched.page.getByTestId("workflow-status")).toHaveText("INTERNAL_ERROR");
    await expect(launched.page.getByTestId("product-metadata")).toHaveCount(0);

    const injection = await launched.page.evaluate(async () => {
      try {
        await window.kbrDesktop.requestPreview({
          assetToken: "0b3b1ad0-ef9e-4fb9-9e08-e9d3e8bcb792",
          advertiser: "a",
          headline: "a",
          subcopy: "b",
          jobName: "job",
          requestSequence: 1,
          downloadAllowed: true,
          assetPath: "C:/outside.png",
          cta: { mode: "APP_DOWNLOAD" },
        } as never);
        return "ACCEPTED";
      } catch {
        return "REJECTED";
      }
    });
    expect(injection).toBe("REJECTED");
  } finally {
    await close(launched);
    await rm(corruptRoot, { recursive: true, force: true });
  }
});

test("Renderer Lab imports and exports the same strict PlacementPlan JSON path", async () => {
  const launched = await launch(
    path.join(projectRoot, "fixtures", "valid", "object-right__product__basic__pass.png"),
  );
  try {
    await expect(launched.page.getByTestId("placement-plan-status")).toHaveText(/PASS/u);
    await launched.page.getByTestId("placement-plan-json").fill(JSON.stringify({
      schemaVersion: "1.1.0",
      imageSlotId: "OBJECT_RIGHT_PRODUCT",
      assetId: "selected-product",
      policy: "ALPHA_TRIM_CONTAIN",
      source: "MANUAL",
      fitMode: "CONTAIN",
      anchor: "CENTER",
      subjectProtection: "NONE",
      unknownField: true,
    }));
    await launched.page.getByTestId("placement-plan-import").click();
    await expect(launched.page.getByTestId("placement-plan-status")).toHaveText(/BLOCKED/u);

    await launched.page.getByTestId("placement-plan-json").fill(JSON.stringify({
      schemaVersion: "1.1.0",
      imageSlotId: "OBJECT_RIGHT_PRODUCT",
      assetId: "selected-product",
      policy: "ALPHA_TRIM_CONTAIN",
      source: "MANUAL",
      fitMode: "CONTAIN",
      anchor: "CENTER",
      subjectProtection: "NONE",
    }));
    await launched.page.getByTestId("placement-plan-import").click();
    await expect(launched.page.getByTestId("placement-plan-status")).toContainText("source=MANUAL");
    await launched.page.getByTestId("placement-plan-export").click();
    await expect(launched.page.getByTestId("placement-plan-json")).toHaveValue(/"source":"MANUAL"/u);

    await launched.page.getByTestId("placement-agent-fixture").click();
    await expect(launched.page.getByTestId("placement-plan-status")).toContainText("source=AGENT");
    await expect(launched.page.getByTestId("placement-plan-json")).toHaveValue(/"source"\s*:\s*"AGENT"/u);
  } finally {
    await close(launched);
  }
});

test("THUMBNAIL_BOX_RIGHT Lab executes direct semantic crop and exports the same PNG", async () => {
  const launched = await launch(
    path.join(projectRoot, "fixtures", "valid", "thumbnail-box-right__asset__basic__pass.png"),
  );
  try {
    await launched.page.getByTestId("select-product").click();
    await fillValidForm(launched.page, "thumbnail-box-e2e");
    await launched.page.getByTestId("template-select").selectOption("THUMBNAIL_BOX_RIGHT");
    await launched.page.getByTestId("crop-rect-input").fill("0.1,0,0.8,1");
    await launched.page.getByTestId("crop-rect-apply").click();
    await launched.page.getByTestId("request-preview").click();
    await expect(launched.page.getByTestId("workflow-status")).toHaveText(/VALID_(?:PASS|WARNING)/u);
    await expect(launched.page.getByTestId("preview-image")).toBeVisible();
    await expect(launched.page.getByTestId("applied-destination-rect")).toContainText("x=666, y=36, w=315, h=186");
    await launched.page.getByTestId("select-output").click();
    await launched.page.getByTestId("export-render").click();
    await expect(launched.page.getByTestId("workflow-status")).toHaveText("EXPORTED");
    await expect(launched.page.getByTestId("export-result")).toContainText(THUMBNAIL_GOLDEN_SHA256);
    await expect.poll(async () => sha256File(path.join(launched.outputRoot, "thumbnail-box-e2e", "output.png"))).toBe(THUMBNAIL_GOLDEN_SHA256);
  } finally {
    await close(launched);
  }
});

test("THUMBNAIL_BOX_RIGHT preserves decimal Crop Rect values through Preview and Export", async () => {
  const launched = await launch(
    path.join(projectRoot, "fixtures", "valid", "thumbnail-box-right__asset__jpeg__pass.jpg"),
  );
  try {
    await launched.page.getByTestId("select-product").click();
    await fillValidForm(launched.page, "thumbnail-decimal-e2e");
    await launched.page.getByTestId("template-select").selectOption("THUMBNAIL_BOX_RIGHT");
    await launched.page.getByTestId("crop-rect-width").fill("0.5");
    await launched.page.getByTestId("crop-rect-height").fill("0.8125");
    const xInput = launched.page.getByTestId("crop-rect-x");
    await xInput.fill("0.2");
    await xInput.press("ArrowUp");
    expect(await xInput.inputValue()).toBe("0.3");
    await xInput.press("Shift+ArrowUp");
    expect(await xInput.inputValue()).toBe("0.31");
    await xInput.press("Alt+ArrowUp");
    expect(await xInput.inputValue()).toBe("0.311");
    await launched.page.getByTestId("crop-rect-y").fill("0.0835");
    expect(await launched.page.locator(".crop-nudge-row").count()).toBe(0);
    expect(await launched.page.locator('[data-testid^="crop-rect-x-"][data-testid$="-up"]').count()).toBe(0);
    await xInput.hover();
    await launched.page.mouse.wheel(0, 100);
    expect(await xInput.inputValue()).toBe("0.311");
    await expect(launched.page.getByTestId("placement-plan-json")).toHaveValue(/"x":\s*0\.311/u);
    await expect(launched.page.getByTestId("placement-plan-json")).toHaveValue(/"height":\s*0\.8125/u);
    await launched.page.getByTestId("request-preview").click();
    await expect(launched.page.getByTestId("workflow-status")).toHaveText(/VALID_(?:PASS|WARNING)/u);
    await expect(launched.page.getByTestId("applied-crop")).toContainText('"x":0.311');
    await launched.page.getByTestId("select-output").click();
    await launched.page.getByTestId("export-render").click();
    await expect(launched.page.getByTestId("workflow-status")).toHaveText("EXPORTED");
    await expect.poll(async () => access(path.join(launched.outputRoot, "thumbnail-decimal-e2e", "output.png")).then(() => true).catch(() => false)).toBe(true);
  } finally {
    await close(launched);
  }
});

test("THUMBNAIL_BOX_RIGHT accepts JPEG input and keeps the final artifact as RGBA PNG", async () => {
  const launched = await launch(
    path.join(projectRoot, "fixtures", "valid", "thumbnail-box-right__asset__jpeg__pass.jpg"),
  );
  try {
    await launched.page.getByTestId("select-product").click();
    await expect(launched.page.getByTestId("product-metadata")).toContainText("image/jpeg");
    await fillValidForm(launched.page, "thumbnail-jpeg-e2e");
    await launched.page.getByTestId("template-select").selectOption("THUMBNAIL_BOX_RIGHT");
    await launched.page.getByTestId("request-preview").click();
    await expect(launched.page.getByTestId("workflow-status")).toHaveText(/VALID_(?:PASS|WARNING)/u);
    await launched.page.getByTestId("select-output").click();
    await launched.page.getByTestId("export-render").click();
    await expect(launched.page.getByTestId("workflow-status")).toHaveText("EXPORTED");
    const outputPath = path.join(launched.outputRoot, "thumbnail-jpeg-e2e", "output.png");
    await expect.poll(async () => access(outputPath).then(() => true).catch(() => false)).toBe(true);
    const metadata = await import("sharp").then(({ default: sharp }) => sharp(outputPath).metadata());
    expect(metadata.format).toBe("png");
    expect(metadata.width).toBe(1029);
    expect(metadata.height).toBe(258);
    expect(metadata.hasAlpha).toBe(true);
  } finally {
    await close(launched);
  }
});

test("THUMBNAIL_MULTI_RIGHT renders two independent Lab slots with explicit Asset reuse", async () => {
  const launched = await launch(
    path.join(projectRoot, "fixtures", "valid", "thumbnail-box-right__asset__basic__pass.png"),
  );
  try {
    await launched.page.getByTestId("template-select").selectOption("THUMBNAIL_MULTI_RIGHT");
    await launched.page.getByTestId("select-product").click();
    await expect(launched.page.getByTestId("product-metadata")).toContainText("image/png");
    await launched.page.getByTestId("reuse-primary-product").click();
    await fillValidForm(launched.page, "thumbnail-multi-e2e");
    await expect(launched.page.getByTestId("slot-panel-IMAGE_PRIMARY")).toBeVisible();
    await expect(launched.page.getByTestId("slot-panel-IMAGE_SECONDARY")).toContainText("image/png");
    await launched.page.getByTestId("crop-PRIMARY-width").fill("0.5");
    await launched.page.getByTestId("crop-PRIMARY-height").fill("0.8125");
    await launched.page.getByTestId("crop-PRIMARY-x").fill("0.125");
    await launched.page.getByTestId("crop-PRIMARY-y").fill("0.0835");
    await launched.page.getByTestId("crop-SECONDARY-width").fill("0.5");
    await launched.page.getByTestId("crop-SECONDARY-height").fill("0.75");
    await launched.page.getByTestId("crop-SECONDARY-x").fill("0.375");
    await launched.page.getByTestId("crop-SECONDARY-y").fill("0.125");
    const primaryY = launched.page.getByTestId("crop-PRIMARY-y");
    await primaryY.press("Shift+ArrowUp");
    expect(await primaryY.inputValue()).toBe("0.0935");
    expect(await launched.page.getByTestId("crop-SECONDARY-x").inputValue()).toBe("0.375");
    await launched.page.getByTestId("placement-plan-export").click();
    await expect(launched.page.getByTestId("placement-plan-json")).toHaveValue(/"x":\s*0\.125/u);
    await expect(launched.page.getByTestId("placement-plan-json")).toHaveValue(/"x":\s*0\.375/u);
    await launched.page.getByTestId("request-preview").click();
    await expect(launched.page.getByTestId("workflow-status")).toHaveText(/VALID_(?:PASS|WARNING)/u);
    await expect(launched.page.getByTestId("preview-image")).toBeVisible();
    await expect(launched.page.getByTestId("applied-crop-PRIMARY")).toContainText('"x":0.125');
    await expect(launched.page.getByTestId("applied-crop-SECONDARY")).toContainText('"x":0.375');
    await expect(launched.page.getByTestId("applied-destination-PRIMARY")).toContainText('"x":621');
    await expect(launched.page.getByTestId("applied-destination-SECONDARY")).toContainText('"x":809');
    await launched.page.getByTestId("select-output").click();
    await expect(launched.page.getByTestId("export-render")).toBeEnabled();
    await launched.page.getByTestId("export-render").click();
    await expect(launched.page.getByTestId("workflow-status")).toHaveText("EXPORTED");

    const manifestPath = path.join(launched.outputRoot, "thumbnail-multi-e2e", "render-manifest.json");
    const pngPath = path.join(launched.outputRoot, "thumbnail-multi-e2e", "output.png");
    await expect.poll(async () => access(manifestPath).then(() => true).catch(() => false)).toBe(true);
    await expect.poll(async () => access(pngPath).then(() => true).catch(() => false)).toBe(true);
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as { templateId?: string; appliedImagePlacements?: unknown[] };
    expect(manifest.templateId).toBe("KAKAO_MOMENT_BIZBOARD_THUMBNAIL_MULTI_RIGHT");
    expect(manifest.appliedImagePlacements).toHaveLength(2);
  } finally {
    await close(launched);
  }
});
