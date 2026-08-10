import { mkdir, readFile } from "node:fs/promises";
import { execFile, spawn } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import { _electron as electron, chromium, expect } from "@playwright/test";

const execFileAsync = promisify(execFile);
const root = process.cwd();
const packageVersion = JSON.parse(await (await import("node:fs/promises")).readFile(path.join(root, "package.json"), "utf8")).version;
const unpackedExe = path.join(root, "release", "win-unpacked", "Kakao-Bizboard-Local-Renderer.exe");
const portableExe = path.join(root, "release", `Kakao-Bizboard-Local-Renderer-${packageVersion}-x64.exe`);
const resultRoot = path.join(root, "test-results", "n7-1-package");
await mkdir(resultRoot, { recursive: true });

const placements = [
  "NAVER_SMARTCHANNEL",
  "NAVER_MOBILE_DA",
  "NAVER_IMAGE_BANNER_1_1",
  "NAVER_MOBILE_NATIVE",
  "NAVER_PC_NATIVE",
  "NAVER_SHOPPING_NEWS",
  "NAVER_COMMUNICATION_AD",
  "NAVER_MOBILE_DA_FEED",
];

async function assertShell(page, label, errors) {
  await expect(page.getByTestId("desktop-app")).toBeVisible();
  await expect(page.getByTestId("channel-naver")).toBeVisible();
  await expect(page.getByTestId("naver-placement-select")).toBeVisible();
  const editorOrFallback = page.locator('[data-testid="naver-editor"], [data-testid="renderer-error-boundary"]');
  await expect(editorOrFallback).toBeVisible();
  const bodyText = (await page.locator("body").innerText()).trim();
  if (bodyText.length === 0) throw new Error(`${label}: blank body`);
  if (errors.length > 0) throw new Error(`${label}: renderer errors: ${errors.join(" | ")}`);
}

async function runMatrix(label, page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(`${error.name}: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") errors.push(`console: ${message.text()}`); });
  await page.waitForSelector('[data-testid="desktop-app"]', { timeout: 60_000 });
  await page.getByTestId("channel-naver").click();
  await page.waitForSelector('[data-testid="naver-placement-select"]', { timeout: 30_000 });
  const selector = page.getByTestId("naver-placement-select");
  const actualPlacements = await selector.locator("option").evaluateAll((entries) => entries.map((entry) => entry.value));
  if (JSON.stringify(actualPlacements) !== JSON.stringify(placements)) throw new Error(`${label}: placement registry mismatch`);
  const matrix = {};
  for (const placement of placements) {
    await selector.selectOption(placement);
    await page.waitForTimeout(100);
    await assertShell(page, `${label}:${placement}`, errors);
    matrix[placement] = "PASS";
  }
  await selector.selectOption("NAVER_MOBILE_DA_FEED");
  for (const subtype of ["IMAGE", "COLLECTION", "VIDEO"]) {
    await page.getByTestId("naver-feed-subtype").selectOption(subtype);
    await page.waitForTimeout(100);
    await assertShell(page, `${label}:FEED:${subtype}`, errors);
    if (subtype === "VIDEO") {
      if (!(await page.getByTestId("naver-request-preview").isDisabled())) throw new Error(`${label}: VIDEO preview is not disabled`);
      await expect(page.getByTestId("naver-video-disabled")).toBeVisible();
    }
  }
  await page.getByTestId("channel-kakao").click();
  await expect(page.getByTestId("mode-template-locked")).toBeVisible();
  await page.getByTestId("channel-naver").click();
  await assertShell(page, `${label}:KAKAO-to-NAVER`, errors);
  const diagnosticMarker = `N7_1_DIAGNOSTIC_SMOKE_${label}_${Date.now()}`;
  await page.evaluate((marker) => window.kbrDesktop.reportRendererDiagnostic({ kind: "console_error", message: marker }), diagnosticMarker);
  const logPath = path.join(process.env.APPDATA ?? "", "Kakao Bizboard Local Renderer (Unofficial)", "logs", "renderer.log");
  let logContainsMarker = false;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try { logContainsMarker = (await readFile(logPath, "utf8")).includes(diagnosticMarker); } catch { /* Main may still be flushing */ }
    if (logContainsMarker) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!logContainsMarker) throw new Error(`${label}: local diagnostic log marker was not written`);
  await page.screenshot({ path: path.join(resultRoot, `${label}.png`), fullPage: true });
  return { label, placements: matrix, feed: { IMAGE: "PASS", COLLECTION: "PASS", VIDEO: "PASS" }, rendererErrors: errors, localDiagnostics: "PASS" };
}

async function runUnpacked() {
  const app = await electron.launch({ executablePath: unpackedExe, args: [], cwd: path.dirname(unpackedExe), timeout: 60_000 });
  try { return await runMatrix("unpacked", await app.firstWindow()); } finally { await app.close(); }
}

async function runPortable() {
  const port = 9261;
  const wrapper = spawn(portableExe, [`--remote-debugging-port=${port}`], { cwd: path.dirname(portableExe), windowsHide: false, stdio: "ignore" });
  let browser;
  try {
    let ready = false;
    for (let attempt = 0; attempt < 240; attempt += 1) {
      try { const response = await fetch(`http://127.0.0.1:${port}/json/version`); if (response.ok) { ready = true; break; } } catch { /* portable bootstrap is still extracting */ }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (!ready) throw new Error("portable remote debugging endpoint unavailable");
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
    const page = browser.contexts()[0]?.pages()[0];
    if (!page) throw new Error("portable renderer page missing");
    return await runMatrix("portable", page);
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (wrapper.exitCode === null) {
      await execFileAsync("taskkill", ["/PID", String(wrapper.pid), "/T", "/F"]).catch(() => {});
    }
  }
}

const results = [];
results.push(await runUnpacked());
results.push(await runPortable());
console.log(JSON.stringify({ status: "PASS", results }, null, 2));
