import { randomUUID } from "node:crypto";
import { access, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { _electron as electron, expect, test, type ElectronApplication, type Page } from "@playwright/test";
import sharp from "sharp";

import { projectRoot } from "../helpers.js";

type Launched = {
  app: ElectronApplication;
  page: Page;
  root: string;
  outputRoot: string;
  sessionRoot: string;
  rendererErrors: string[];
};

async function assertNaverShell(launched: Launched, label: string): Promise<void> {
  await expect(launched.page.getByTestId("desktop-app")).toBeVisible();
  await expect(launched.page.getByTestId("channel-naver")).toBeVisible();
  await expect(launched.page.getByTestId("naver-placement-select")).toBeVisible();
  await expect(launched.page.locator('[data-testid="naver-editor"], [data-testid="renderer-error-boundary"]')).toBeVisible();
  expect(launched.rendererErrors, `${label} renderer errors`).toEqual([]);
}

async function launch(productPath: string): Promise<Launched> {
  const root = path.join(os.tmpdir(), `kbr-naver-e2e-${randomUUID()}`);
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
  const rendererErrors: string[] = [];
  page.on("pageerror", (error) => rendererErrors.push(`${error.name}: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") rendererErrors.push(`console: ${message.text()}`);
  });
  await page.waitForSelector('[data-testid="desktop-app"]');
  await page.getByTestId("channel-naver").click();
  await expect(page.getByTestId("naver-placement-select")).toBeVisible();
  return { app, page, root, outputRoot, sessionRoot, rendererErrors };
}

async function close(launched: Launched): Promise<void> {
  await launched.app.close();
  await expect.poll(async () => (await readdir(launched.sessionRoot)).length).toBe(0);
  await rm(launched.root, { recursive: true, force: true });
}

async function writeDeterministicRasterFixture(prefix: string, width: number, height: number): Promise<string> {
  const raw = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      raw[index] = (x * 29 + y * 17) % 256;
      raw[index + 1] = (x * 11 + y * 37) % 256;
      raw[index + 2] = (x * 43 + y * 7) % 256;
      raw[index + 3] = 255;
    }
  }
  const target = path.join(os.tmpdir(), `${prefix}-${randomUUID()}.jpg`);
  const encoded = await sharp(raw, { raw: { width, height, channels: 4 } }).jpeg({ quality: 95, progressive: false }).toBuffer();
  await writeFile(target, encoded);
  return target;
}

test("NAVER SmartChannel is registry-driven and exports a renderer-composed PNG", async () => {
  const launched = await launch(path.join(projectRoot, "fixtures", "valid", "naver-smartchannel", "N2-REP-001-object.png"));
  try {
    const placementOptions = await launched.page.getByTestId("naver-placement-select").locator("option").count();
    expect(placementOptions).toBe(8);
    await expect(launched.page.getByTestId("naver-smartchannel-template-select").locator("option")).toHaveCount(120);
    await expect(launched.page.getByTestId("naver-smartchannel-font-preflight")).toContainText("configured local font directory required");
    await launched.page.getByTestId("naver-smartchannel-select-object").click();
    await expect(launched.page.getByTestId("naver-smartchannel-editor")).toContainText("N2-REP-001-object.png");
    await expect(launched.page.getByTestId("naver-editor")).toHaveAttribute("data-primary-selected", "true");
    await launched.page.getByTestId("naver-request-preview").click();
    await expect(launched.page.getByTestId("naver-validation-status")).toHaveText("PASS");
    await expect(launched.page.getByTestId("naver-preview-image")).toBeVisible();
    await expect(launched.page.locator(".naver-preview-panel")).toContainText("Final UI");

    await launched.page.getByTestId("naver-select-output").click();
    await launched.page.getByTestId("naver-export").click();
    await expect(launched.page.getByTestId("naver-export-result")).toContainText("RENDERED");
    await expect.poll(async () => {
      try { await access(path.join(launched.outputRoot, "naver-render", "output.png")); return true; } catch { return false; }
    }).toBe(true);
    await expect(access(path.join(launched.outputRoot, "naver-render", "render-manifest.json"))).resolves.toBeUndefined();
  } finally {
    await close(launched);
  }
});

test("NAVER SmartChannel filter changes keep the editor mounted", async () => {
  const launched = await launch(path.join(projectRoot, "fixtures", "valid", "naver-smartchannel", "N2-REP-001-object.png"));
  try {
    await expect(launched.page.getByTestId("naver-smartchannel-editor")).toBeVisible();
    await launched.page.getByTestId("naver-template-filter-height").selectOption("280");
    await expect(launched.page.getByTestId("naver-smartchannel-editor")).toBeVisible();
    await expect(launched.page.getByTestId("naver-template-summary")).not.toContainText("—");
    for (const [key, value] of [["family", "EMPHASIS"], ["objectKind", "THUMBNAIL"], ["side", "LEFT"], ["textVariant", "THREE_LINE"], ["affordance", "APP_CTA"]] as const) {
      const nextValue = value;
      await launched.page.getByTestId(`naver-template-filter-${key}`).selectOption(nextValue);
      await expect(launched.page.getByTestId("naver-template-summary")).not.toContainText("—");
    }
    await expect(launched.page.getByTestId("naver-template-summary")).toContainText("NAVER_SMARTCHANNEL_280_EMPHASIS_THUMBNAIL_LEFT_THREE_LINE_APP_CTA");
    for (const height of ["160", "280", "200", "160"]) {
      await launched.page.getByTestId("naver-template-filter-height").selectOption(height);
      await expect(launched.page.getByTestId("naver-template-summary")).not.toContainText("—");
    }
    await launched.page.getByTestId("naver-smartchannel-field-headline").fill("state snapshot");
    await expect(launched.page.getByTestId("naver-smartchannel-field-headline")).toHaveValue("state snapshot");
    expect(launched.rendererErrors, "SmartChannel filter renderer errors").toEqual([]);
  } finally {
    await close(launched);
  }
});

test("NAVER platform-composed source flow validates and exports source artifacts without final UI", async () => {
  const sourceAsset = path.join(os.tmpdir(), `kbr-naver-source-${randomUUID()}.png`);
  await sharp({ create: { width: 112, height: 112, channels: 4, background: { r: 24, g: 116, b: 205, alpha: 1 } } }).png().toFile(sourceAsset);
  const launched = await launch(sourceAsset);
  try {
    await launched.page.getByTestId("naver-placement-select").selectOption("NAVER_COMMUNICATION_AD");
    await expect(launched.page.getByTestId("naver-communication-variant")).toHaveValue("LIST");
    await expect(launched.page.getByTestId("naver-platform-source-editor")).toContainText("최종 노출 형상은 NAVER가 구성합니다");
    await launched.page.getByTestId("naver-source-asset-NAVER_COMMUNICATION_LIST_IMAGE_112X112").getByRole("button").click();
    await expect(launched.page.getByTestId("naver-source-asset-NAVER_COMMUNICATION_LIST_IMAGE_112X112")).toContainText("112×112");
    await expect(launched.page.getByTestId("naver-editor")).toHaveAttribute("data-primary-selected", "true");
    await launched.page.getByTestId("naver-request-preview").click();
    await expect(launched.page.getByTestId("naver-validation-status")).toHaveText(/PASS|WARNING/u);
    await expect(launched.page.getByTestId("naver-normalized-payload")).toContainText("finalUiRendered=false");
    await launched.page.getByTestId("naver-select-output").click();
    await launched.page.getByTestId("naver-export").click();
    await expect(launched.page.getByTestId("naver-export-result")).toContainText("SOURCE");
    await expect(access(path.join(launched.outputRoot, "naver-render", "source-manifest.json"))).resolves.toBeUndefined();
    await expect(access(path.join(launched.outputRoot, "naver-render", "source-spec.json"))).resolves.toBeUndefined();
    const sourceSpec = JSON.parse(await readFile(path.join(launched.outputRoot, "naver-render", "source-spec.json"), "utf8")) as Record<string, unknown>;
    expect(sourceSpec.compositionMode).toBe("PLATFORM_COMPOSED");
    expect(sourceSpec).not.toHaveProperty("finalCanvas");
    expect(sourceSpec).not.toHaveProperty("finalUiRendered");
    expect((sourceSpec.assets as Array<Record<string, unknown>>)[0]?.pathRef).toMatch(/\.png$/u);
  } finally {
    await close(launched);
    await rm(sourceAsset, { force: true });
  }
});

test("NAVER Mobile DA reuses the existing FREEFORM editor and exports through Core", async () => {
  const sourceAsset = await writeDeterministicRasterFixture("kbr-naver-mobile-da", 1250, 560);
  const launched = await launch(sourceAsset);
  try {
    await launched.page.getByTestId("naver-placement-select").selectOption("NAVER_MOBILE_DA");
    await expect(launched.page.getByTestId("naver-freeform-editor")).toBeVisible();
    await expect(launched.page.getByTestId("naver-placement-select")).toHaveValue("NAVER_MOBILE_DA");
    await expect(launched.page.getByTestId("freeform-format-select")).toHaveValue("NAVER_MOBILE_DA");
    await launched.page.getByTestId("freeform-select-image").click();
    await expect(launched.page.getByTestId("freeform-element-image-1")).toBeVisible();
    for (const [field, value] of [["x", "0.18"], ["y", "0.08"], ["width", "0.64"], ["height", "0.84"]] as const) {
      await launched.page.getByTestId(`freeform-geometry-image-1-${field}`).fill(value);
    }
    await launched.page.getByTestId("freeform-add-text").click();
    await expect(launched.page.getByTestId("freeform-element-text-1")).toBeVisible();
    for (const [field, value] of [["x", "0.192"], ["y", "0.12"], ["width", "0.56"], ["height", "0.16"]] as const) {
      await launched.page.getByTestId(`freeform-geometry-text-1-${field}`).fill(value);
    }
    await launched.page.getByTestId("freeform-output-format").selectOption("JPEG");
    await launched.page.getByTestId("freeform-render-preview").click();
    await expect(launched.page.getByTestId("freeform-status")).not.toHaveText("VALIDATING");
    await expect(launched.page.getByTestId("freeform-status")).toHaveText(/PASS|WARNING/u);
    await launched.page.getByTestId("freeform-select-output").click();
    await launched.page.getByTestId("freeform-export").click();
    await expect(launched.page.getByTestId("freeform-export-result")).toBeVisible();
  } finally {
    await close(launched);
    await rm(sourceAsset, { force: true });
  }
});

test("NAVER Image Banner 1:1 reuses the existing FREEFORM profile without a duplicate renderer", async () => {
  const sourceAsset = await writeDeterministicRasterFixture("kbr-naver-image-banner", 1200, 1200);
  const launched = await launch(sourceAsset);
  try {
    await launched.page.getByTestId("naver-placement-select").selectOption("NAVER_IMAGE_BANNER_1_1");
    await expect(launched.page.getByTestId("naver-freeform-editor")).toBeVisible();
    await expect(launched.page.getByTestId("naver-placement-select")).toHaveValue("NAVER_IMAGE_BANNER_1_1");
    await expect(launched.page.getByTestId("freeform-format-select")).toHaveValue("NAVER_IMAGE_BANNER_1_1");
    await launched.page.getByTestId("freeform-select-image").click();
    await expect(launched.page.getByTestId("freeform-element-image-1")).toBeVisible();
    await launched.page.getByTestId("freeform-add-text").click();
    await expect(launched.page.getByTestId("freeform-element-text-1")).toBeVisible();
    await launched.page.getByTestId("freeform-output-format").selectOption("JPEG");
    await launched.page.getByTestId("freeform-render-preview").click();
    await expect(launched.page.getByTestId("freeform-status")).not.toHaveText("VALIDATING");
    await expect(launched.page.getByTestId("freeform-status")).toHaveText(/PASS|WARNING/u);
  } finally {
    await close(launched);
    await rm(sourceAsset, { force: true });
  }
});

test("NAVER Feed Collection exposes ordered 4..10 item controls and keeps VIDEO disabled", async () => {
  const launched = await launch(path.join(projectRoot, "fixtures", "valid", "naver-smartchannel", "N2-REP-001-object.png"));
  try {
    await assertNaverShell(launched, "initial");
    await launched.page.getByTestId("naver-placement-select").selectOption("NAVER_MOBILE_DA_FEED");
    await assertNaverShell(launched, "feed");
    await launched.page.getByTestId("naver-feed-subtype").selectOption("COLLECTION");
    await assertNaverShell(launched, "collection");
    await expect(launched.page.getByTestId("naver-collection-editor")).toBeVisible();
    await expect(launched.page.locator('article[data-testid^="naver-collection-item-item-"]')).toHaveCount(4);
    await launched.page.getByTestId("naver-collection-add").click();
    await expect(launched.page.locator('article[data-testid^="naver-collection-item-item-"]')).toHaveCount(5);
    await launched.page.getByTestId("naver-feed-subtype").selectOption("VIDEO");
    await assertNaverShell(launched, "video");
    await expect(launched.page.getByTestId("naver-video-disabled")).toContainText("Out of static renderer scope");
    await expect(launched.page.getByTestId("naver-request-preview")).toBeDisabled();
  } finally {
    await close(launched);
  }
});

test("NAVER all placement transitions keep the app shell and editor alive", async () => {
  const launched = await launch(path.join(projectRoot, "fixtures", "valid", "naver-smartchannel", "N2-REP-001-object.png"));
  try {
    const placements = await launched.page.getByTestId("naver-placement-select").locator("option").evaluateAll((entries) => entries.map((entry) => (entry as HTMLOptionElement).value));
    expect(placements).toEqual([
      "NAVER_SMARTCHANNEL",
      "NAVER_MOBILE_DA",
      "NAVER_IMAGE_BANNER_1_1",
      "NAVER_MOBILE_NATIVE",
      "NAVER_PC_NATIVE",
      "NAVER_SHOPPING_NEWS",
      "NAVER_COMMUNICATION_AD",
      "NAVER_MOBILE_DA_FEED",
    ]);
    for (const placement of placements) {
      await launched.page.getByTestId("naver-placement-select").selectOption(placement);
      await assertNaverShell(launched, placement);
    }
    await launched.page.getByTestId("channel-kakao").click();
    await expect(launched.page.getByTestId("mode-template-locked")).toBeVisible();
    await launched.page.getByTestId("channel-naver").click();
    await assertNaverShell(launched, "KAKAO-to-NAVER");
  } finally {
    await close(launched);
  }
});
