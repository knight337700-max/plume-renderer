import { randomUUID } from "node:crypto";
import { access, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { _electron as electron, expect, test, type ElectronApplication, type Page } from "@playwright/test";

import { deterministicOversizePng } from "../fixtures/freeform-preview-fixtures.js";
import { projectRoot } from "../helpers.js";

type Launched = { app: ElectronApplication; page: Page; root: string; outputRoot: string; sessionRoot: string };

async function launch(options: Readonly<{ oversizedProduct?: boolean }> = {}): Promise<Launched> {
  const root = path.join(os.tmpdir(), `kbr-freeform-e2e-${randomUUID()}`);
  const outputRoot = path.join(root, "output");
  const sessionRoot = path.join(root, "sessions");
  const product = options.oversizedProduct
    ? path.join(root, "freeform-post-render-oversize.png")
    : path.join(projectRoot, "fixtures", "valid", "object-right__product__basic__pass.png");
  const logo = path.join(projectRoot, "fixtures", "valid", "mask-semicircle-right__logo__colored__pass.png");
  await Promise.all([mkdir(outputRoot, { recursive: true }), mkdir(sessionRoot, { recursive: true })]);
  if (options.oversizedProduct) await writeFile(product, await deterministicOversizePng());
  const app = await electron.launch({
    args: [projectRoot],
    cwd: projectRoot,
    env: { ...process.env, KBR_E2E_MODE: "1", KBR_E2E_PRODUCT: product, KBR_E2E_LOGO: logo, KBR_E2E_OUTPUT: outputRoot, KBR_E2E_SESSION_BASE: sessionRoot },
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

test("FREEFORM mode is registry-driven and renders native 2:1 through Core", async () => {
  const launched = await launch();
  try {
    await launched.page.getByTestId("mode-freeform").click();
    await expect(launched.page.getByTestId("freeform-editor")).toBeVisible();
    await expect(launched.page.getByTestId("freeform-format-select")).toHaveValue("KAKAO_DISPLAY_NATIVE_2_1");
    await expect(launched.page.getByTestId("freeform-scroll-option")).toHaveAttribute("disabled", "");
    await launched.page.getByTestId("freeform-select-image").click();
    await launched.page.getByTestId("freeform-select-logo").click();
    await expect(launched.page.getByText("object-right__product__basic__pass.png", { exact: true })).toBeVisible();
    await expect(launched.page.getByText("mask-semicircle-right__logo__colored__pass.png", { exact: false })).toBeVisible();
    await launched.page.getByTestId("freeform-add-text").click();
    await launched.page.getByTestId("freeform-render-preview").click();
    await expect(launched.page.getByTestId("freeform-preview-image")).toBeVisible();
    await expect(launched.page.getByTestId("freeform-status")).toHaveText(/PASS|WARNING/u);
    await launched.page.getByTestId("freeform-select-output").click();
    await expect(launched.page.getByTestId("freeform-export")).toBeEnabled();
    await launched.page.getByTestId("freeform-export").click();
    await expect(launched.page.getByTestId("freeform-export-result")).toBeVisible();
    await expect(access(path.join(launched.outputRoot, "freeform-render", "render-manifest.json"))).resolves.toBeUndefined();
  } finally {
    await close(launched);
  }
});

test("FREEFORM mode can return to Template Locked without changing its entry point", async () => {
  const launched = await launch();
  try {
    await launched.page.getByTestId("mode-freeform").click();
    await launched.page.getByTestId("mode-template-locked").click();
    await expect(launched.page.getByTestId("template-select")).toBeVisible();
    await expect(launched.page.getByTestId("request-preview")).toBeVisible();
  } finally {
    await close(launched);
  }
});

test("FREEFORM JPEG output is Core-encoded and pixel edits make Preview stale", async () => {
  const launched = await launch();
  try {
    await launched.page.getByTestId("mode-freeform").click();
    await launched.page.getByTestId("freeform-select-image").click();
    await expect(launched.page.getByText("object-right__product__basic__pass.png", { exact: true })).toBeVisible();
    await launched.page.getByTestId("freeform-render-preview").click();
    await expect(launched.page.getByTestId("freeform-preview-image")).toBeVisible();
    await launched.page.getByTestId("freeform-output-format").selectOption("JPEG");
    await expect(launched.page.getByTestId("freeform-export")).toBeDisabled();
    await launched.page.getByTestId("freeform-render-preview").click();
    await expect(launched.page.getByTestId("freeform-status")).toHaveText(/PASS|WARNING/u);
    const jpegPreview = launched.page.getByTestId("freeform-preview-image");
    await expect(jpegPreview).toBeVisible();
    await expect(jpegPreview).toHaveAttribute("data-preview-mime", "image/jpeg");
    await expect(jpegPreview).toHaveAttribute("src", /^kbr-preview:\/\/preview\//u);
    await expect.poll(() => jpegPreview.evaluate((image: HTMLImageElement) => ({ width: image.naturalWidth, height: image.naturalHeight }))).toEqual({ width: 1200, height: 600 });
    await launched.page.getByTestId("freeform-select-output").click();
    await expect(launched.page.getByTestId("freeform-export")).toBeEnabled();
    await launched.page.getByTestId("freeform-export").click();
    await expect(launched.page.getByTestId("freeform-export-result")).toBeVisible();
    await expect(access(path.join(launched.outputRoot, "freeform-render", "output.jpg"))).resolves.toBeUndefined();
  } finally {
    await close(launched);
  }
});

test("FREEFORM PNG POST_RENDER file-size ERROR keeps Preview visible and blocks Export", async () => {
  const launched = await launch({ oversizedProduct: true });
  try {
    await launched.page.getByTestId("mode-freeform").click();
    await launched.page.getByTestId("freeform-select-image").click();
    await expect(launched.page.getByText("freeform-post-render-oversize.png", { exact: true })).toBeVisible();
    const plan = {
      schemaVersion: "1.0.0",
      formatProfileId: "KAKAO_DISPLAY_NATIVE_2_1",
      source: "MANUAL",
      background: { type: "SOLID", color: "#FFFFFF" },
      elements: [{
        id: "image-1",
        type: "IMAGE",
        assetId: "asset-primary",
        bounds: { x: 0, y: 0, width: 1, height: 1 },
        zIndex: 0,
        placement: { policy: "CENTER_CONTAIN", source: "MANUAL", fitMode: "CONTAIN", anchor: "CENTER", subjectProtection: "NONE" },
      }],
    };
    await launched.page.getByTestId("freeform-plan-json").fill(JSON.stringify(plan));
    await launched.page.getByTestId("freeform-plan-import").click();
    await launched.page.getByTestId("freeform-render-preview").click();

    const pngPreview = launched.page.getByTestId("freeform-preview-image");
    await expect(pngPreview).toBeVisible();
    await expect(pngPreview).toHaveAttribute("data-preview-mime", "image/png");
    await expect.poll(() => pngPreview.evaluate((image: HTMLImageElement) => ({ width: image.naturalWidth, height: image.naturalHeight }))).toEqual({ width: 1200, height: 600 });
    await expect(launched.page.getByTestId("freeform-status")).toHaveText("ERROR");
    await expect(launched.page.getByTestId("freeform-validation-panel")).toContainText("KBR-FREEFORM-FILE-SIZE-EXCEEDED");
    await expect(launched.page.getByTestId("freeform-validation-panel")).toContainText("POST_RENDER");
    await expect(launched.page.getByTestId("freeform-validation-panel")).toContainText("출력 파일 용량이 매체 허용 기준을 초과했습니다.");
    await expect(launched.page.getByTestId("freeform-validation-panel")).not.toContainText("등록된 번역이 없습니다");
    await expect(launched.page.getByTestId("freeform-preview-eligibility")).toContainText("프리뷰는 생성되었습니다");
    await launched.page.getByTestId("freeform-select-output").click();
    await expect(launched.page.getByTestId("freeform-export")).toBeDisabled();
    await expect(access(path.join(launched.outputRoot, "freeform-render", "output.png"))).rejects.toThrow();
  } finally {
    await close(launched);
  }
});

test("FREEFORM PRE_RENDER invalid crop does not create a Preview Artifact", async () => {
  const launched = await launch();
  try {
    await launched.page.getByTestId("mode-freeform").click();
    await launched.page.getByTestId("freeform-select-image").click();
    await expect(launched.page.getByText("object-right__product__basic__pass.png", { exact: true })).toBeVisible();
    const invalidPlan = {
      schemaVersion: "1.0.0",
      formatProfileId: "KAKAO_DISPLAY_NATIVE_2_1",
      source: "MANUAL",
      background: { type: "SOLID", color: "#FFFFFF" },
      elements: [{
        id: "image-1",
        type: "IMAGE",
        assetId: "asset-primary",
        bounds: { x: 0, y: 0, width: 1, height: 1 },
        zIndex: 0,
        placement: { policy: "MANUAL_CROP", source: "MANUAL", fitMode: "COVER", anchor: "CENTER", subjectProtection: "NONE" },
      }],
    };
    await launched.page.getByTestId("freeform-plan-json").fill(JSON.stringify(invalidPlan));
    await launched.page.getByTestId("freeform-plan-import").click();
    await launched.page.getByTestId("freeform-render-preview").click();

    await expect(launched.page.getByTestId("freeform-preview-image")).toHaveCount(0);
    await expect(launched.page.getByTestId("freeform-status")).toHaveText("ERROR");
    await expect(launched.page.getByTestId("freeform-validation-panel")).toContainText("PRE_RENDER");
    await expect(launched.page.getByTestId("freeform-preview-eligibility")).toContainText("프리뷰를 생성할 수 없습니다");
    await expect(launched.page.getByTestId("freeform-export")).toBeDisabled();
  } finally {
    await close(launched);
  }
});

test("FREEFORM profile allowlist disables unsupported add controls and portrait Safe Zone is metadata-driven", async () => {
  const launched = await launch();
  try {
    await launched.page.getByTestId("mode-freeform").click();
    await launched.page.getByTestId("freeform-format-select").selectOption("KAKAO_BIZBOARD_EXPANDABLE_MULTI_1_1");
    await expect(launched.page.getByTestId("freeform-add-text")).toBeDisabled();
    await expect(launched.page.getByTestId("freeform-add-logo")).toBeDisabled();
    await launched.page.getByTestId("freeform-format-select").selectOption("KAKAO_DISPLAY_NATIVE_9_16");
    await expect(launched.page.getByTestId("freeform-safe-zone-unknown")).toHaveCount(0);
    await expect(launched.page.getByTestId("freeform-safe-zone-overlay")).toBeVisible();
    await launched.page.getByTestId("freeform-select-image").click();
    await expect(launched.page.getByText("object-right__product__basic__pass.png", { exact: true })).toBeVisible();
    await launched.page.getByTestId("freeform-render-preview").click();
    await expect(launched.page.getByTestId("freeform-validation-panel")).toContainText("KBR-");
  } finally {
    await close(launched);
  }
});

test("FREEFORM IMAGE starts neutral and explicit presets write deterministic placement values", async () => {
  const launched = await launch();
  try {
    const page = launched.page;
    await page.getByTestId("mode-freeform").click();
    await page.getByTestId("freeform-select-image").click();
    await expect(page.getByTestId("freeform-geometry-image-1-x")).toHaveValue("0");
    await expect(page.getByTestId("freeform-geometry-image-1-y")).toHaveValue("0");
    await expect(page.getByTestId("freeform-geometry-image-1-width")).toHaveValue("1");
    await expect(page.getByTestId("freeform-geometry-image-1-height")).toHaveValue("1");
    await expect(page.getByTestId("freeform-geometry-image-1-z-index")).toHaveValue("0");
    await expect(page.getByTestId("freeform-geometry-image-1-opacity")).toHaveValue("1");
    await expect(page.getByTestId("freeform-image-policy")).toHaveValue("CENTER_CONTAIN");
    await expect(page.getByTestId("freeform-fit-destination")).toContainText("destination 975×600 @ 112,0");
    await expect(page.getByTestId("freeform-preset-fit-canvas")).toHaveAttribute("title", /이미지 전체/u);
    await expect(page.getByTestId("freeform-preset-fill-canvas")).toHaveAttribute("title", /중앙 기준/u);

    await page.getByTestId("freeform-render-preview").click();
    await expect(page.getByTestId("freeform-preview-image")).toBeVisible();
    await page.getByTestId("freeform-preset-fill-canvas").click();
    await expect(page.getByTestId("freeform-preview-image")).toHaveCount(0);
    await expect(page.getByTestId("freeform-export")).toBeDisabled();
    await expect(page.getByTestId("freeform-image-policy")).toHaveValue("MANUAL_CROP");
    await expect(page.getByTestId("freeform-crop-x")).toHaveValue("0");
    await expect(page.getByTestId("freeform-crop-y")).toHaveValue("0.09375");
    await expect(page.getByTestId("freeform-crop-width")).toHaveValue("1");
    await expect(page.getByTestId("freeform-crop-height")).toHaveValue("0.8125");

    await page.getByTestId("freeform-geometry-image-1-z-index").fill("37");
    await page.getByTestId("freeform-geometry-image-1-opacity").fill("0.42");
    await page.getByTestId("freeform-preset-reset-placement").click();
    await expect(page.getByTestId("freeform-image-policy")).toHaveValue("CENTER_CONTAIN");
    await expect(page.getByTestId("freeform-crop-x")).toHaveCount(0);
    await expect(page.getByTestId("freeform-geometry-image-1-z-index")).toHaveValue("37");
    await expect(page.getByTestId("freeform-geometry-image-1-opacity")).toHaveValue("0.42");

    await page.getByTestId("freeform-geometry-image-1-width").fill("0.8");
    await expect(page.getByTestId("freeform-geometry-image-1-width")).toHaveValue("0.8");
    await page.getByTestId("freeform-preset-fit-canvas").click();
    await expect(page.getByTestId("freeform-geometry-image-1-width")).toHaveValue("1");
    await page.getByTestId("freeform-plan-export").click();
    const exported = JSON.parse(await page.getByTestId("freeform-plan-json").inputValue()) as {
      elements: Array<{ bounds: unknown; zIndex: number; opacity: number; placement: Record<string, unknown> }>;
    };
    expect(exported.elements[0]).toMatchObject({
      bounds: { x: 0, y: 0, width: 1, height: 1 },
      zIndex: 37,
      opacity: 0.42,
      placement: { policy: "CENTER_CONTAIN", source: "MANUAL", fitMode: "CONTAIN" },
    });
    expect(exported.elements[0]?.placement).not.toHaveProperty("cropRect");
    expect(exported.elements[0]?.placement).not.toHaveProperty("cropCandidateId");
    expect(exported.elements[0]?.placement).not.toHaveProperty("focalPoint");
  } finally {
    await close(launched);
  }
});

test("FREEFORM import preserves MANUAL and AGENT geometry until a preset is clicked", async () => {
  const launched = await launch();
  try {
    const page = launched.page;
    await page.getByTestId("mode-freeform").click();
    const importedPlan = {
      schemaVersion: "1.0.0",
      formatProfileId: "KAKAO_DISPLAY_NATIVE_2_1",
      source: "AGENT",
      background: { type: "SOLID", color: "#FFFFFF" },
      elements: [{
        id: "agent-image",
        type: "IMAGE",
        assetId: "agent-asset",
        bounds: { x: 0.52, y: 0.05, width: 0.43, height: 0.9 },
        zIndex: 23,
        opacity: 0.8,
        placement: {
          policy: "CENTER_CONTAIN",
          source: "AGENT",
          fitMode: "CONTAIN",
          anchor: "CENTER_RIGHT",
          subjectProtection: "PREFERRED",
        },
      }],
    };
    await page.getByTestId("freeform-plan-json").fill(JSON.stringify(importedPlan));
    await page.getByTestId("freeform-plan-import").click();

    await expect(page.getByTestId("freeform-geometry-agent-image-x")).toHaveValue("0.52");
    await expect(page.getByTestId("freeform-geometry-agent-image-y")).toHaveValue("0.05");
    await expect(page.getByTestId("freeform-geometry-agent-image-width")).toHaveValue("0.43");
    await expect(page.getByTestId("freeform-geometry-agent-image-height")).toHaveValue("0.9");
    await expect(page.getByTestId("freeform-geometry-agent-image-z-index")).toHaveValue("23");
    await expect(page.getByTestId("freeform-preset-fill-canvas")).toBeDisabled();

    await page.getByTestId("freeform-plan-export").click();
    const preserved = JSON.parse(await page.getByTestId("freeform-plan-json").inputValue()) as typeof importedPlan;
    expect(preserved).toEqual(importedPlan);

    await page.getByTestId("freeform-preset-fit-canvas").click();
    await expect(page.getByTestId("freeform-geometry-agent-image-x")).toHaveValue("0");
    await expect(page.getByTestId("freeform-geometry-agent-image-y")).toHaveValue("0");
    await expect(page.getByTestId("freeform-geometry-agent-image-width")).toHaveValue("1");
    await expect(page.getByTestId("freeform-geometry-agent-image-height")).toHaveValue("1");
    await expect(page.getByTestId("freeform-geometry-agent-image-z-index")).toHaveValue("23");
  } finally {
    await close(launched);
  }
});
