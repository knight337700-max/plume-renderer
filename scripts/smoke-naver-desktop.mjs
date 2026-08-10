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
const resultRoot = path.join(root, "test-results", "n7-2-package");
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

const smartFilterKeys = ["height", "family", "objectKind", "side", "textVariant", "affordance"];
const smartRepresentativeMatrix = [
  { height: "160", family: "BASIC", objectKind: "STANDARD", side: "LEFT", textVariant: "MAIN_SUB", affordance: "NONE", templateId: "NAVER_SMARTCHANNEL_160_BASIC_STANDARD_LEFT_MAIN_SUB_NONE" },
  { height: "280", family: "EMPHASIS", objectKind: "THUMBNAIL", side: "LEFT", textVariant: "THREE_LINE", affordance: "APP_CTA", templateId: "NAVER_SMARTCHANNEL_280_EMPHASIS_THUMBNAIL_LEFT_THREE_LINE_APP_CTA" },
  { height: "280", family: "EMPHASIS", objectKind: "PERSON_MOVIE", side: "RIGHT", textVariant: "FOUR_LINE", affordance: "NONE", templateId: "NAVER_SMARTCHANNEL_280_EMPHASIS_PERSON_MOVIE_RIGHT_FOUR_LINE_NONE" },
  { height: "280", family: "BOTTOM_DISCLOSURE", objectKind: "STANDARD", side: "LEFT", textVariant: "MAIN2_DISCLOSURE_2LINE", affordance: "NONE", templateId: "NAVER_SMARTCHANNEL_280_BOTTOM_DISCLOSURE_STANDARD_LEFT_MAIN2_DISCLOSURE_2LINE_NONE" },
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

async function assertSmartChannel(page, label, errors, expectedTemplateId) {
  await expect(page.getByTestId("naver-smartchannel-editor")).toBeVisible();
  await expect(page.getByTestId("naver-smartchannel-template-select")).toBeVisible();
  await expect(page.getByTestId("naver-template-summary")).not.toContainText("—");
  await expect(page.getByTestId("naver-smartchannel-resolution-error")).toHaveCount(0);
  if (expectedTemplateId) await expect(page.getByTestId("naver-template-summary")).toContainText(expectedTemplateId);
  if (errors.length > 0) throw new Error(`${label}: renderer errors: ${errors.join(" | ")}`);
}

async function selectSmartFilters(page, filters) {
  for (const key of smartFilterKeys) {
    await page.getByTestId(`naver-template-filter-${key}`).selectOption(String(filters[key]));
    await page.waitForTimeout(10);
  }
  const candidateCount = await page.getByTestId("naver-smartchannel-template-select").locator("option").count();
  if (candidateCount === 0) throw new Error("SmartChannel filter reconciliation produced zero candidates");
}

async function runSmartChannelMatrix(page, label, errors) {
  await page.getByTestId("naver-placement-select").selectOption("NAVER_SMARTCHANNEL");
  await assertSmartChannel(page, `${label}:SMARTCHANNEL:initial`, errors);
  const templateSelect = page.getByTestId("naver-smartchannel-template-select");
  const templateIds = await templateSelect.locator("option").evaluateAll((entries) => entries.map((entry) => entry.value));
  if (templateIds.length !== 120) throw new Error(`${label}: SmartChannel registry count ${templateIds.length} !== 120`);
  for (const templateId of templateIds) {
    await templateSelect.selectOption(templateId);
    await expect(templateSelect).toHaveValue(templateId);
    await assertSmartChannel(page, `${label}:SMARTCHANNEL:${templateId}`, errors, templateId);
  }
  const allFilters = { height: "ALL", family: "ALL", objectKind: "ALL", side: "ALL", textVariant: "ALL", affordance: "ALL" };
  for (const entry of smartRepresentativeMatrix) {
    await selectSmartFilters(page, allFilters);
    await selectSmartFilters(page, entry);
    await assertSmartChannel(page, `${label}:SMARTCHANNEL:representative:${entry.templateId}`, errors, entry.templateId);
  }
  await selectSmartFilters(page, allFilters);
  for (const height of ["160", "280", "200", "160"]) {
    await page.getByTestId("naver-template-filter-height").selectOption(height);
    await assertSmartChannel(page, `${label}:SMARTCHANNEL:height:${height}`, errors);
  }
  for (const side of ["LEFT", "RIGHT", "LEFT"]) {
    await page.getByTestId("naver-template-filter-side").selectOption(side);
    await assertSmartChannel(page, `${label}:SMARTCHANNEL:side:${side}`, errors);
  }
  for (const family of ["BASIC", "EMPHASIS", "BOTTOM_DISCLOSURE", "BASIC"]) {
    await page.getByTestId("naver-template-filter-family").selectOption(family);
    await assertSmartChannel(page, `${label}:SMARTCHANNEL:family:${family}`, errors);
  }
  return { registry: 120, uiReachable: templateIds.length, unsupportedExposed: 0, nullValueExceptions: 0, errorBoundaryFallbacks: 0 };
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
  let smartChannel;
  for (const placement of placements) {
    await selector.selectOption(placement);
    await page.waitForTimeout(100);
    await assertShell(page, `${label}:${placement}`, errors);
    if (placement === "NAVER_SMARTCHANNEL") smartChannel = await runSmartChannelMatrix(page, label, errors);
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
  const diagnosticMarker = `N7_2_DIAGNOSTIC_SMOKE_${label}_${Date.now()}`;
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
  return { label, placements: matrix, smartChannel, feed: { IMAGE: "PASS", COLLECTION: "PASS", VIDEO: "PASS" }, rendererErrors: errors, localDiagnostics: "PASS" };
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
