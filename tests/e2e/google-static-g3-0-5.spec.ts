import { randomUUID } from "node:crypto";
import { mkdir, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { _electron as electron, expect, test, type ElectronApplication, type Page } from "@playwright/test";

import { projectRoot } from "../helpers.js";
import { closeElectronTree } from "./electron-cleanup.js";

const profileIds = [
  "GOOGLE_MARKETING_LANDSCAPE_1_91",
  "GOOGLE_MARKETING_SQUARE_1_1",
  "GOOGLE_MARKETING_PORTRAIT_4_5",
  "GOOGLE_RDA_VERTICAL_9_16",
  "GOOGLE_DEMAND_GEN_VERTICAL_9_16",
  "GOOGLE_LOGO_SQUARE_1_1",
  "GOOGLE_LOGO_LANDSCAPE_4_1",
  "GOOGLE_DG_UPLOAD_300X250",
  "GOOGLE_DG_UPLOAD_336X280",
  "GOOGLE_DG_UPLOAD_728X90",
  "GOOGLE_DG_UPLOAD_970X90",
  "GOOGLE_DG_UPLOAD_160X600",
  "GOOGLE_DG_UPLOAD_300X600",
  "GOOGLE_DG_UPLOAD_320X50",
] as const;

const canvasDimensions: Record<string, { width: number; height: number }> = {
  GOOGLE_MARKETING_LANDSCAPE_1_91: { width: 1200, height: 628 },
  GOOGLE_MARKETING_SQUARE_1_1: { width: 1200, height: 1200 },
  GOOGLE_MARKETING_PORTRAIT_4_5: { width: 960, height: 1200 },
  GOOGLE_RDA_VERTICAL_9_16: { width: 900, height: 1600 },
  GOOGLE_DEMAND_GEN_VERTICAL_9_16: { width: 1080, height: 1920 },
  GOOGLE_LOGO_SQUARE_1_1: { width: 1200, height: 1200 },
  GOOGLE_LOGO_LANDSCAPE_4_1: { width: 1200, height: 300 },
  GOOGLE_DG_UPLOAD_300X250: { width: 300, height: 250 },
  GOOGLE_DG_UPLOAD_336X280: { width: 336, height: 280 },
  GOOGLE_DG_UPLOAD_728X90: { width: 728, height: 90 },
  GOOGLE_DG_UPLOAD_970X90: { width: 970, height: 90 },
  GOOGLE_DG_UPLOAD_160X600: { width: 160, height: 600 },
  GOOGLE_DG_UPLOAD_300X600: { width: 300, height: 600 },
  GOOGLE_DG_UPLOAD_320X50: { width: 320, height: 50 },
};

type Launched = { app: ElectronApplication; page: Page; root: string; sessionRoot: string };

async function launch(): Promise<Launched> {
  const root = path.join(os.tmpdir(), `kbr-g305-e2e-${randomUUID()}`);
  const outputRoot = path.join(root, "output");
  const sessionRoot = path.join(root, "sessions");
  await Promise.all([mkdir(outputRoot, { recursive: true }), mkdir(sessionRoot, { recursive: true })]);
  const app = await electron.launch({
    args: ["--disable-gpu", `--user-data-dir=${path.join(root, "electron-user-data")}`, projectRoot],
    cwd: projectRoot,
    env: {
      ...process.env,
      KBR_E2E_MODE: "1",
      KBR_E2E_PRODUCT: path.join(projectRoot, "fixtures", "google", "g2", "source", "g2-GOOGLE_MARKETING_LANDSCAPE_1_91.png"),
      KBR_E2E_OUTPUT: outputRoot,
      KBR_E2E_SESSION_BASE: sessionRoot,
    },
  });
  const page = await app.firstWindow();
  await page.waitForSelector('[data-testid="desktop-app"]');
  await page.getByTestId("channel-google").click();
  return { app, page, root, sessionRoot };
}

async function close(launched: Launched): Promise<void> {
  await closeElectronTree(launched.app);
  await expect.poll(async () => (await readdir(launched.sessionRoot)).length).toBe(0);
  await rm(launched.root, { recursive: true, force: true });
}

async function prepareProfile(page: Page, profileId: string, selectAsset = false): Promise<void> {
  await page.getByTestId("google-profile-select").selectOption(profileId);
  await expect(page.getByTestId("google-profile-summary")).toContainText(profileId);
  if (selectAsset) {
    await page.getByTestId("google-select-asset").click();
    await expect(page.getByTestId("google-asset-metadata")).toContainText("g2-GOOGLE_MARKETING_LANDSCAPE_1_91.png");
  }
  await page.waitForTimeout(80);
  await page.getByTestId("google-request-preview").click();
  await expect(page.getByTestId("google-status")).toHaveText("PASS");
  await expect(page.getByTestId("google-preview-image")).toBeVisible();
}

async function geometry(page: Page): Promise<{ canvas: DOMRectReadOnly; content: DOMRectReadOnly; image: DOMRectReadOnly; overflow: string; scrollWidth: number; clientWidth: number; scrollHeight: number; clientHeight: number }> {
  return page.evaluate(() => {
    const canvas = document.querySelector('[data-testid="google-preview-canvas"]');
    const content = document.querySelector('[data-testid="google-preview-content"]');
    const image = document.querySelector('[data-testid="google-preview-image"]');
    if (!(canvas instanceof HTMLElement) || !(content instanceof HTMLElement) || !(image instanceof HTMLElement)) throw new Error("Google preview geometry elements are missing");
    return {
      canvas: canvas.getBoundingClientRect().toJSON(),
      content: content.getBoundingClientRect().toJSON(),
      image: image.getBoundingClientRect().toJSON(),
      overflow: getComputedStyle(canvas).overflow,
      scrollWidth: canvas.scrollWidth,
      clientWidth: canvas.clientWidth,
      scrollHeight: canvas.scrollHeight,
      clientHeight: canvas.clientHeight,
    };
  });
}

function within(value: number, lower: number, upper: number, tolerance = 1): boolean {
  return value >= lower - tolerance && value <= upper + tolerance;
}

test.describe("G3.0.5 Google Static production preview", () => {
  test("Fit contains every profile across resize and constrained-height viewport", async () => {
    const launched = await launch();
    try {
      let needsAsset = true;
      for (const profileId of profileIds) {
        await prepareProfile(launched.page, profileId, needsAsset);
        needsAsset = false;
        await launched.page.getByTestId("google-fit-view").click();
        const expected = canvasDimensions[profileId];
        if (!expected) throw new Error(`Missing canvas dimensions for ${profileId}`);
        const initialGeometry = await geometry(launched.page);
        expect(initialGeometry.overflow).toBe("hidden");
        expect(initialGeometry.scrollWidth).toBeLessThanOrEqual(initialGeometry.clientWidth + 1);
        expect(initialGeometry.scrollHeight).toBeLessThanOrEqual(initialGeometry.clientHeight + 1);
        expect(within(initialGeometry.content.left, initialGeometry.canvas.left, initialGeometry.canvas.right)).toBe(true);
        expect(within(initialGeometry.content.right, initialGeometry.canvas.left, initialGeometry.canvas.right)).toBe(true);
        expect(within(initialGeometry.content.top, initialGeometry.canvas.top, initialGeometry.canvas.bottom)).toBe(true);
        expect(within(initialGeometry.content.bottom, initialGeometry.canvas.top, initialGeometry.canvas.bottom)).toBe(true);
        expect(initialGeometry.content.width / initialGeometry.content.height).toBeCloseTo(expected.width / expected.height, 2);

        const browserWindow = await launched.app.browserWindow(launched.page);
        await browserWindow.evaluate((window) => window.setSize(1200, 700));
        await launched.page.waitForTimeout(100);
        const constrained = await geometry(launched.page);
        expect(constrained.scrollWidth).toBeLessThanOrEqual(constrained.clientWidth + 1);
        expect(constrained.scrollHeight).toBeLessThanOrEqual(constrained.clientHeight + 1);
        expect(constrained.content.width / constrained.content.height).toBeCloseTo(expected.width / expected.height, 2);

        await browserWindow.evaluate((window) => window.setSize(1500, 920));
        await launched.page.waitForTimeout(100);
        const resized = await geometry(launched.page);
        expect(resized.scrollWidth).toBeLessThanOrEqual(resized.clientWidth + 1);
        expect(resized.scrollHeight).toBeLessThanOrEqual(resized.clientHeight + 1);
        expect(resized.content.width / resized.content.height).toBeCloseTo(expected.width / expected.height, 2);
      }
    } finally {
      await close(launched);
    }
  });

  test("Actual Pixels is 1:1, scrollable, and view-only", async () => {
    const launched = await launch();
    try {
      let needsAsset = true;
      for (const profileId of ["GOOGLE_MARKETING_LANDSCAPE_1_91", "GOOGLE_MARKETING_SQUARE_1_1", "GOOGLE_MARKETING_PORTRAIT_4_5", "GOOGLE_DEMAND_GEN_VERTICAL_9_16", "GOOGLE_DG_UPLOAD_320X50"]) {
        await prepareProfile(launched.page, profileId, needsAsset);
        needsAsset = false;
        const before = await launched.page.getByTestId("google-plan-json").inputValue();
        const statusBefore = await launched.page.getByTestId("google-status").textContent();
        const summaryBefore = JSON.parse(await launched.page.getByTestId("google-contract-summary").textContent() ?? "{}") as {
          canonicalRequest?: unknown;
          renderFingerprint?: string | null;
          placementPlan?: unknown;
        };
        await launched.page.getByTestId("google-actual-view").click();
        const actual = await geometry(launched.page);
        const expected = canvasDimensions[profileId];
        if (!expected) throw new Error(`Missing canvas dimensions for ${profileId}`);
        expect(actual.image.width).toBeCloseTo(expected.width, 0);
        expect(actual.image.height).toBeCloseTo(expected.height, 0);
        expect(actual.overflow).toBe("auto");
        expect(actual.scrollWidth).toBeGreaterThanOrEqual(actual.clientWidth);
        await launched.page.getByTestId("google-fit-view").click();
        expect(await launched.page.getByTestId("google-plan-json").inputValue()).toBe(before);
        expect(await launched.page.getByTestId("google-status").textContent()).toBe(statusBefore);
        const summaryAfterFit = JSON.parse(await launched.page.getByTestId("google-contract-summary").textContent() ?? "{}") as typeof summaryBefore;
        expect(summaryAfterFit.canonicalRequest).toEqual(summaryBefore.canonicalRequest);
        expect(summaryAfterFit.renderFingerprint).toBe(summaryBefore.renderFingerprint);
        expect(summaryAfterFit.placementPlan).toEqual(summaryBefore.placementPlan);
        const browserWindow = await launched.app.browserWindow(launched.page);
        await browserWindow.evaluate((window) => window.setSize(1380, 820));
        await launched.page.waitForTimeout(100);
        const summaryAfterResize = JSON.parse(await launched.page.getByTestId("google-contract-summary").textContent() ?? "{}") as typeof summaryBefore;
        expect(summaryAfterResize.canonicalRequest).toEqual(summaryBefore.canonicalRequest);
        expect(summaryAfterResize.renderFingerprint).toBe(summaryBefore.renderFingerprint);
        expect(summaryAfterResize.placementPlan).toEqual(summaryBefore.placementPlan);
      }
    } finally {
      await close(launched);
    }
  });

  test("pointer uses displayed content rect and letterbox is a no-op", async () => {
    const launched = await launch();
    try {
      await prepareProfile(launched.page, "GOOGLE_MARKETING_SQUARE_1_1", true);
      await launched.page.getByTestId("google-fit-view").click();
      const before = JSON.parse(await launched.page.getByTestId("google-plan-json").inputValue()) as { placementTransform?: { x: number; y: number; scale: number } };
      const box = await geometry(launched.page);
      await launched.page.mouse.move(box.canvas.left + 5, box.canvas.top + box.canvas.height / 2);
      await launched.page.mouse.down();
      await launched.page.mouse.move(box.canvas.left + 30, box.canvas.top + box.canvas.height / 2);
      await launched.page.mouse.up();
      expect(await launched.page.getByTestId("google-plan-json").inputValue()).toBe(JSON.stringify(before, null, 2));

      await launched.page.mouse.move((box.content.left + box.content.right) / 2, (box.content.top + box.content.bottom) / 2);
      await launched.page.mouse.down();
      await launched.page.mouse.move((box.content.left + box.content.right) / 2 + box.content.width * 0.1, (box.content.top + box.content.bottom) / 2 + box.content.height * 0.1);
      await launched.page.mouse.up();
      const afterPointer = JSON.parse(await launched.page.getByTestId("google-plan-json").inputValue()) as typeof before;
      expect(afterPointer.placementTransform?.x).toBeCloseTo((before.placementTransform?.x ?? 0.5) + 0.1, 2);
      expect(afterPointer.placementTransform?.y).toBeCloseTo((before.placementTransform?.y ?? 0.5) + 0.1, 2);
      await launched.page.getByTestId("google-placement-x").fill(String(afterPointer.placementTransform?.x));
      await launched.page.getByTestId("google-placement-y").fill(String(afterPointer.placementTransform?.y));
      expect(JSON.parse(await launched.page.getByTestId("google-plan-json").inputValue())).toEqual(afterPointer);
    } finally {
      await close(launched);
    }
  });

  test("Uploaded Display placement controls and events are locked for all seven profiles", async () => {
    const launched = await launch();
    try {
      let needsAsset = true;
      for (const profileId of profileIds.slice(7)) {
        await prepareProfile(launched.page, profileId, needsAsset);
        needsAsset = false;
        const planBefore = await launched.page.getByTestId("google-plan-json").inputValue();
        await expect(launched.page.getByTestId("google-placement-x")).toBeDisabled();
        await expect(launched.page.getByTestId("google-placement-y")).toBeDisabled();
        await expect(launched.page.getByTestId("google-placement-scale")).toBeDisabled();
        await expect(launched.page.getByTestId("google-placement-zoom-out")).toBeDisabled();
        await expect(launched.page.getByTestId("google-placement-zoom-in")).toBeDisabled();
        await expect(launched.page.getByTestId("google-reset-placement")).toBeDisabled();
        await expect(launched.page.getByTestId("google-plan-json")).toHaveAttribute("readonly", "");
        await expect(launched.page.getByTestId("google-apply-plan")).toBeDisabled();
        await expect(launched.page.getByTestId("google-reset-plan")).toBeDisabled();
        const box = await geometry(launched.page);
        await launched.page.mouse.move((box.canvas.left + box.canvas.right) / 2, (box.canvas.top + box.canvas.bottom) / 2);
        await launched.page.mouse.down();
        await launched.page.mouse.move((box.canvas.left + box.canvas.right) / 2 + 20, (box.canvas.top + box.canvas.bottom) / 2 + 20);
        await launched.page.mouse.up();
        expect(await launched.page.getByTestId("google-plan-json").inputValue()).toBe(planBefore);
        // WHEEL_ZOOM is a placement input and must be a no-op for locked
        // Uploaded Display Static profiles.
        await launched.page.mouse.wheel(0, -240);
        expect(await launched.page.getByTestId("google-plan-json").inputValue()).toBe(planBefore);
      }
    } finally {
      await close(launched);
    }
  });
});
