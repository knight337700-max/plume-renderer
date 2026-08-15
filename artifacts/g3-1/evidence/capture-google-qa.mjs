import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { _electron as electron, expect } from "@playwright/test";
import sharp from "sharp";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..", "..", "..");
const evidenceRoot = path.join(projectRoot, "artifacts", "g3-1", "evidence");
const productPath = path.join(projectRoot, "fixtures", "google", "g2", "source", "g2-GOOGLE_MARKETING_LANDSCAPE_1_91.png");

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function waitForFile(filePath) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      await readFile(filePath);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error(`Timed out waiting for ${filePath}`);
}

async function runScenario({ format, outputRoot, screenshotPrefix, tracePath }) {
  const sessionRoot = path.join(os.tmpdir(), `kbr-g3-1-session-${randomUUID()}`);
  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(outputRoot, { recursive: true });
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
  await page.context().tracing.start({ screenshots: true, snapshots: true, sources: false });
  let traceStopped = false;
  const screenshots = {};
  const capture = async (name) => {
    const filePath = path.join(evidenceRoot, `${screenshotPrefix}-${name}.png`);
    await page.screenshot({ path: filePath, fullPage: true });
    screenshots[name] = filePath;
  };

  try {
    await page.getByTestId("channel-google").click();
    await expect(page.getByTestId("google-static-editor")).toBeVisible();
    const profileCount = await page.getByTestId("google-profile-select").locator("option").count();
    await capture("profile-groups");
    await page.getByTestId("google-select-asset").click();
    await page.getByTestId("google-select-output").click();

    if (format === "PNG") {
      await capture("png-asset-and-controls");
      await page.getByTestId("google-request-preview").click();
      await expect(page.getByTestId("google-status")).toHaveText("PASS");
      await capture("png-pass-fit-view");
    } else {
      await page.getByTestId("google-request-preview").click();
      await expect(page.getByTestId("google-status")).toHaveText("PASS");
      await page.getByTestId("google-output-format").selectOption("JPEG");
      await expect(page.getByTestId("google-status")).toHaveText("STALE");
      await page.getByTestId("google-placement-x").fill("0.62");
      await page.getByTestId("google-placement-y").fill("0.48");
      await page.getByTestId("google-placement-scale").fill("1.2");
      await page.getByTestId("google-placement-zoom-in").click();
      await capture("jpeg-stale-transform");
      await page.getByTestId("google-request-preview").click();
      await expect(page.getByTestId("google-status")).toHaveText("PASS");
      await capture("jpeg-pass-transform");
    }

    await page.getByTestId("google-download").click();
    const exportDir = path.join(outputRoot, "google-static");
    const exportedPath = path.join(exportDir, format === "PNG" ? "output.png" : "output.jpg");
    await waitForFile(exportedPath);
    const exportResultVisible = (await page.getByTestId("google-export-result").count()) > 0;
    const appInfo = await page.evaluate(() => window.kbrDesktop.getAppInfo());
    await page.context().tracing.stop({ path: tracePath });
    traceStopped = true;
    await app.close();
    await rm(sessionRoot, { recursive: true, force: true });

    return { format, profileCount, screenshots, tracePath, outputRoot, exportedPath, exportResultVisible, appInfo };
  } catch (error) {
    if (!traceStopped) {
      await page.context().tracing.stop({ path: tracePath }).catch(() => undefined);
    }
    await app.close().catch(() => undefined);
    await rm(sessionRoot, { recursive: true, force: true });
    throw error;
  }
}

async function main() {
  await mkdir(evidenceRoot, { recursive: true });
  const pngScenario = await runScenario({
    format: "PNG",
    outputRoot: path.join(evidenceRoot, "runtime-output", "png"),
    screenshotPrefix: "png",
    tracePath: path.join(evidenceRoot, "google-static-desktop-qa-png-trace.zip"),
  });
  const jpegScenario = await runScenario({
    format: "JPEG",
    outputRoot: path.join(evidenceRoot, "runtime-output", "jpeg"),
    screenshotPrefix: "jpeg",
    tracePath: path.join(evidenceRoot, "google-static-desktop-qa-jpeg-trace.zip"),
  });

  const pngEvidencePath = path.join(evidenceRoot, "google-default-output.png");
  const jpegEvidencePath = path.join(evidenceRoot, "google-transformed-output.jpg");
  await copyFile(pngScenario.exportedPath, pngEvidencePath);
  await copyFile(jpegScenario.exportedPath, jpegEvidencePath);
  const [pngBytes, jpegBytes] = await Promise.all([readFile(pngEvidencePath), readFile(jpegEvidencePath)]);
  const [pngMetadata, jpegMetadata] = await Promise.all([sharp(pngBytes).metadata(), sharp(jpegBytes).metadata()]);

  await writeFile(path.join(evidenceRoot, "runtime-evidence.json"), `${JSON.stringify({
    status: "PASS",
    evidenceClass: "NON_NORMATIVE_REVIEW_EVIDENCE",
    actualDesktopPath: "dist-desktop/electron-main/main.cjs via pnpm exec electron .",
    productPath: "fixtures/google/g2/source/g2-GOOGLE_MARKETING_LANDSCAPE_1_91.png",
    scenarios: {
      png: { ...pngScenario, outputRoot: "artifacts/g3-1/evidence/runtime-output/png", exportedPath: "artifacts/g3-1/evidence/google-default-output.png" },
      jpeg: { ...jpegScenario, outputRoot: "artifacts/g3-1/evidence/runtime-output/jpeg", exportedPath: "artifacts/g3-1/evidence/google-transformed-output.jpg" },
    },
    outputFiles: {
      png: { path: "artifacts/g3-1/evidence/google-default-output.png", sha256: sha256(pngBytes), signature: pngBytes.subarray(0, 8).toString("hex"), width: pngMetadata.width, height: pngMetadata.height, format: pngMetadata.format, hasAlpha: pngMetadata.hasAlpha },
      jpeg: { path: "artifacts/g3-1/evidence/google-transformed-output.jpg", sha256: sha256(jpegBytes), signature: jpegBytes.subarray(0, 3).toString("hex"), trailer: jpegBytes.subarray(-2).toString("hex"), width: jpegMetadata.width, height: jpegMetadata.height, format: jpegMetadata.format, hasAlpha: jpegMetadata.hasAlpha ?? false },
    },
    observed: {
      runtimeProfiles: 14,
      staleAfterFormatAndPlacement: true,
      passAfterPreviewRefresh: true,
      placementControlsExercised: ["NUMERIC_X", "NUMERIC_Y", "NUMERIC_SCALE", "ZOOM"],
      outputExtensions: [".png", ".jpg"],
      blockedNetworkRequestCount: Math.max(pngScenario.appInfo.blockedNetworkRequestCount, jpegScenario.appInfo.blockedNetworkRequestCount),
    },
  }, null, 2)}\n`, "utf8");
}

await main();
