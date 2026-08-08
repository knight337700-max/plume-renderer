import { randomUUID } from "node:crypto";
import { access, mkdir, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { _electron as electron, expect, test, type ElectronApplication, type Page } from "@playwright/test";

import { projectRoot } from "../helpers.js";

type Launched = { app: ElectronApplication; page: Page; root: string; outputRoot: string; sessionRoot: string };

async function launch(): Promise<Launched> {
  const root = path.join(os.tmpdir(), `kbr-freeform-e2e-${randomUUID()}`);
  const outputRoot = path.join(root, "output");
  const sessionRoot = path.join(root, "sessions");
  const product = path.join(projectRoot, "fixtures", "valid", "object-right__product__basic__pass.png");
  const logo = path.join(projectRoot, "fixtures", "valid", "mask-semicircle-right__logo__colored__pass.png");
  await Promise.all([mkdir(outputRoot, { recursive: true }), mkdir(sessionRoot, { recursive: true })]);
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
    await launched.page.getByTestId("freeform-select-output").click();
    await expect(launched.page.getByTestId("freeform-export")).toBeEnabled();
    await launched.page.getByTestId("freeform-export").click();
    await expect(launched.page.getByTestId("freeform-export-result")).toBeVisible();
    await expect(access(path.join(launched.outputRoot, "freeform-render", "output.jpg"))).resolves.toBeUndefined();
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
