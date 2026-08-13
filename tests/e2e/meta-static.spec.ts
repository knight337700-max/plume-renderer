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
