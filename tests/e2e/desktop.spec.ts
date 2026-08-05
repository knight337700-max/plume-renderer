import { randomUUID } from "node:crypto";
import { access, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { _electron as electron, expect, test, type ElectronApplication, type Page } from "@playwright/test";

import { sha256File } from "../../src/core/hash.js";
import { projectRoot } from "../helpers.js";

const GOLDEN_SHA256 = "b67c95b239884e21270190cb2ba8019fcc68016af8ef22cf1c904315f1f2b4b9";

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
