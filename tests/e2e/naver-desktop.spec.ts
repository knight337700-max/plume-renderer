import { randomUUID } from "node:crypto";
import { access, cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { _electron as electron, expect, test, type ElectronApplication, type Page } from "@playwright/test";
import sharp from "sharp";

import { projectRoot } from "../helpers.js";
import { closeElectronTree } from "./electron-cleanup.js";

type Launched = {
  app: ElectronApplication;
  page: Page;
  root: string;
  outputRoot: string;
  sessionRoot: string;
  rendererErrors: string[];
};

type LaunchAssets = Readonly<{
  primary: string;
  secondary?: string;
  third?: string;
}>;

async function assertNaverShell(launched: Launched, label: string): Promise<void> {
  await expect(launched.page.getByTestId("desktop-app")).toBeVisible();
  await expect(launched.page.getByTestId("channel-naver")).toBeVisible();
  await expect(launched.page.getByTestId("naver-placement-select")).toBeVisible();
  await expect(launched.page.locator('[data-testid="naver-editor"], [data-testid="renderer-error-boundary"]')).toBeVisible();
  expect(launched.rendererErrors, `${label} renderer errors`).toEqual([]);
}

async function launch(productPathOrAssets: string | LaunchAssets): Promise<Launched> {
  const assets = typeof productPathOrAssets === "string" ? { primary: productPathOrAssets } : productPathOrAssets;
  const root = path.join(os.tmpdir(), `kbr-naver-e2e-${randomUUID()}`);
  const outputRoot = path.join(root, "output");
  const sessionRoot = path.join(root, "sessions");
  const rendererErrors: string[] = [];
  await Promise.all([mkdir(outputRoot, { recursive: true }), mkdir(sessionRoot, { recursive: true })]);
  const launchEnv: Record<string, string> = Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
  Object.assign(launchEnv, {
    // Playwright may set FORCE_COLOR for its own reporter. Normalize the
    // Electron child environment so stderr contains renderer diagnostics,
    // not the Node NO_COLOR/FORCE_COLOR warning.
    FORCE_COLOR: "0",
    KBR_E2E_MODE: "1",
    KBR_E2E_PRODUCT: assets.primary,
    ...(assets.secondary ? { KBR_E2E_SECONDARY: assets.secondary } : {}),
    ...(assets.third ? { KBR_E2E_TERTIARY: assets.third } : {}),
    KBR_E2E_OUTPUT: outputRoot,
    KBR_E2E_SESSION_BASE: sessionRoot,
  });
  delete launchEnv.NO_COLOR;
  const app = await electron.launch({
    args: ["--disable-gpu", `--user-data-dir=${path.join(root, "electron-user-data")}`, projectRoot],
    cwd: projectRoot,
    env: launchEnv,
  });
  app.process().stdout?.on("data", (data: Buffer | string) => rendererErrors.push(`main stdout: ${String(data).trim()}`));
  app.process().stderr?.on("data", (data: Buffer | string) => rendererErrors.push(`main stderr: ${String(data).trim()}`));
  app.process().once("exit", (code, signal) => {
    rendererErrors.push(`main exit: code=${code ?? "null"} signal=${signal ?? "none"}`);
  });
  const page = await app.firstWindow();
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
  await closeElectronTree(launched.app);
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

function requiredFixturePath(paths: readonly string[], index: number): string {
  const fixturePath = paths[index];
  if (!fixturePath) throw new Error(`Missing generated fixture at index ${index}`);
  return fixturePath;
}

async function writePlatformRasterFixture(prefix: string, width: number, height: number): Promise<string> {
  const raw = Buffer.alloc(width * height * 3);
  let state = 0x6d2b79f5 ^ width ^ (height << 8);
  for (let index = 0; index < raw.length; index += 1) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    raw[index] = state & 0xff;
  }
  const target = path.join(os.tmpdir(), `${prefix}-${randomUUID()}.jpg`);
  const quality = width * height > 1_000_000 ? 60 : 78;
  await sharp(raw, { raw: { width, height, channels: 3 } })
    .jpeg({ quality, chromaSubsampling: "4:2:0", progressive: false })
    .toFile(target);
  return target;
}

async function previewAndExportPlatformSource(launched: Launched, expectedMode: "SOURCE" | "COLLECTION"): Promise<string> {
  await expect(launched.page.getByTestId("naver-editor")).toHaveAttribute("data-primary-selected", "true");
  await launched.page.getByTestId("naver-request-preview").click();
  await expect(launched.page.getByTestId("naver-validation-status")).not.toHaveText("DIRTY");
  const validationStatus = await launched.page.getByTestId("naver-validation-status").innerText();
  if (validationStatus === "ERROR") throw new Error(await launched.page.getByTestId("naver-validation-panel").innerText());
  expect(validationStatus).toMatch(/PASS|WARNING/u);
  await expect(launched.page.getByTestId("naver-normalized-payload")).toContainText("finalUiRendered=false");
  await launched.page.getByTestId("naver-select-output").click();
  await launched.page.getByTestId("naver-export").click();
  try {
    await expect(launched.page.getByTestId("naver-export-result")).toContainText(expectedMode);
  } catch (error) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    throw new Error(`${error instanceof Error ? error.message : String(error)}\n${launched.rendererErrors.join("\n")}`);
  }
  const jobDirectory = path.join(launched.outputRoot, "naver-render");
  const manifestName = expectedMode === "COLLECTION" ? "collection-manifest.json" : "source-manifest.json";
  await expect(access(path.join(jobDirectory, manifestName))).resolves.toBeUndefined();
  return jobDirectory;
}

async function captureN8FormatEvidence(formatId: string, jobDirectory: string): Promise<void> {
  const evidenceRoot = process.env.KBR_N8_EVIDENCE_ROOT;
  if (!evidenceRoot) return;
  const target = path.join(evidenceRoot, formatId);
  await mkdir(path.dirname(target), { recursive: true });
  await cp(jobDirectory, target, { recursive: true, force: true });
}

test("NAVER SmartChannel is registry-driven and exports a renderer-composed PNG", async () => {
  const launched = await launch(path.join(projectRoot, "fixtures", "valid", "mask-semicircle-right__logo__black__pass.png"));
  try {
    const placementOptions = await launched.page.getByTestId("naver-placement-select").locator("option").count();
    expect(placementOptions).toBe(8);
    await expect(launched.page.getByTestId("naver-smartchannel-template-select").locator("option")).toHaveCount(120);
    await expect(launched.page.getByTestId("naver-smartchannel-font-preflight")).toContainText("AppleSDGothicNeo-macOS19-Bold.otf");
    await launched.page.getByTestId("naver-smartchannel-select-object").click();
    await expect(launched.page.getByTestId("naver-smartchannel-editor")).toContainText("mask-semicircle-right__logo__black__pass.png");
    await expect(launched.page.getByTestId("naver-editor")).toHaveAttribute("data-primary-selected", "true");
    await launched.page.getByTestId("naver-request-preview").click();
    await expect(launched.page.getByTestId("naver-validation-status")).toHaveText("PASS");
    await expect(launched.page.getByTestId("naver-validation-panel")).not.toContainText("NAVER_SMARTCHANNEL_FONT_UNAVAILABLE");
    await expect(launched.page.getByTestId("naver-preview-image")).toHaveCount(1);
    await expect(launched.page.locator(".naver-preview-panel")).toContainText("Final UI");

    await launched.page.getByTestId("naver-select-output").click();
    await expect(launched.page.getByTestId("naver-export")).toBeEnabled();
    await launched.page.getByTestId("naver-export").click();
    await expect.poll(async () => access(path.join(launched.outputRoot, "naver-render", "output.png")).then(() => true).catch(() => false)).toBe(true);
    await expect.poll(async () => access(path.join(launched.outputRoot, "naver-render", "render-manifest.json")).then(() => true).catch(() => false)).toBe(true);
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

test("NAVER SmartChannel headline preserves custom and explicit empty values across render wait", async () => {
  const launched = await launch(path.join(projectRoot, "fixtures", "valid", "naver-smartchannel", "N2-REP-001-object.png"));
  try {
    const headline = launched.page.getByTestId("naver-smartchannel-field-headline");
    await expect(headline).toHaveValue("브랜드의 새로운 시작");
    await headline.fill("사용자 작성 헤드라인");
    await expect(headline).toHaveValue("사용자 작성 헤드라인");
    await launched.page.waitForTimeout(2_500);
    await expect(headline).toHaveValue("사용자 작성 헤드라인");

    for (const [key, value] of [["height", "280"], ["family", "EMPHASIS"], ["objectKind", "THUMBNAIL"], ["side", "LEFT"], ["textVariant", "THREE_LINE"], ["affordance", "APP_CTA"]] as const) {
      await launched.page.getByTestId(`naver-template-filter-${key}`).selectOption(value);
      await expect(headline).toHaveValue("사용자 작성 헤드라인");
    }

    await launched.page.getByTestId("naver-smartchannel-select-object").click();
    await expect(launched.page.getByTestId("naver-smartchannel-editor")).toContainText("N2-REP-001-object.png");
    await expect(launched.page.getByTestId("naver-request-preview")).toBeEnabled();
    await launched.page.getByTestId("naver-request-preview").click();
    await expect(launched.page.getByTestId("naver-validation-status")).toHaveText(/PASS|WARNING|ERROR/u);
    await expect(headline).toHaveValue("사용자 작성 헤드라인");

    await headline.fill("");
    await expect(headline).toHaveValue("");
    await launched.page.waitForTimeout(2_500);
    await expect(headline).toHaveValue("");
    await launched.page.getByTestId("naver-request-preview").click();
    await expect.poll(() => headline.inputValue()).toBe("");
    await headline.focus();
    await launched.page.keyboard.insertText("브랜드");
    await expect(headline).toHaveValue("브랜드");
    await headline.fill("");
    await headline.focus();
    await headline.evaluate((element) => {
      const input = element as HTMLInputElement;
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true, data: "ㅎ" }));
      valueSetter?.call(input, "ㅎ");
      input.dispatchEvent(new InputEvent("input", { bubbles: true, data: "ㅎ", inputType: "insertCompositionText", isComposing: true }));
      input.dispatchEvent(new CompositionEvent("compositionupdate", { bubbles: true, data: "한" }));
      valueSetter?.call(input, "한");
      input.dispatchEvent(new InputEvent("input", { bubbles: true, data: "한", inputType: "insertCompositionText", isComposing: true }));
      input.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "한글" }));
      valueSetter?.call(input, "한글");
      input.dispatchEvent(new InputEvent("input", { bubbles: true, data: "한글", inputType: "insertText", isComposing: false }));
    });
    await expect(headline).toHaveValue("한글");
    expect(launched.rendererErrors, "SmartChannel headline renderer errors").toEqual([]);
  } finally {
    await close(launched);
  }
});

test("NAVER SmartChannel 280 fields follow canonical descriptors and preserve values across modes", async () => {
  const launched = await launch(path.join(projectRoot, "fixtures", "valid", "naver-smartchannel", "N2-REP-005-object.png"));
  const fieldKeys = () => launched.page.locator("[data-smartchannel-input-key]").evaluateAll((entries) => entries.map((entry) => entry.getAttribute("data-smartchannel-input-key")));
  try {
    const templateSelect = launched.page.getByTestId("naver-smartchannel-template-select");
    await templateSelect.selectOption("NAVER_SMARTCHANNEL_280_BASIC_STANDARD_LEFT_MAIN_TWO_LINES_NONE");
    expect(await fieldKeys()).toEqual(["headline", "headlineLine2"]);
    await expect(launched.page.getByText("메인 카피 2행", { exact: true })).toBeVisible();
    await launched.page.getByTestId("naver-smartchannel-field-headline").fill("보존되는 첫째 줄");
    await launched.page.getByTestId("naver-smartchannel-field-headlineLine2").fill("보존되는 둘째 줄");

    await templateSelect.selectOption("NAVER_SMARTCHANNEL_280_EMPHASIS_THUMBNAIL_LEFT_MAIN_TWO_LINES_NONE");
    expect(await fieldKeys()).toEqual(["headline", "headlineLine2"]);
    await expect(launched.page.getByTestId("naver-smartchannel-field-headline")).toHaveValue("보존되는 첫째 줄");
    await expect(launched.page.getByTestId("naver-smartchannel-field-headlineLine2")).toHaveValue("보존되는 둘째 줄");

    await templateSelect.selectOption("NAVER_SMARTCHANNEL_280_EMPHASIS_PERSON_MOVIE_RIGHT_FOUR_LINE_NONE");
    expect(await fieldKeys()).toEqual(["headline", "headlineLine2", "subcopy", "subcopyLine4"]);
    await launched.page.getByTestId("naver-smartchannel-field-subcopy").fill("보존되는 셋째 줄");
    await launched.page.getByTestId("naver-smartchannel-field-subcopyLine4").fill("보존되는 넷째 줄");

    await templateSelect.selectOption("NAVER_SMARTCHANNEL_280_BASIC_STANDARD_LEFT_ONE_LINE_NONE");
    expect(await fieldKeys()).toEqual(["headline"]);
    await templateSelect.selectOption("NAVER_SMARTCHANNEL_280_EMPHASIS_PERSON_MOVIE_RIGHT_FOUR_LINE_NONE");
    expect(await fieldKeys()).toEqual(["headline", "headlineLine2", "subcopy", "subcopyLine4"]);
    await expect(launched.page.getByTestId("naver-smartchannel-field-headlineLine2")).toHaveValue("보존되는 둘째 줄");
    await expect(launched.page.getByTestId("naver-smartchannel-field-subcopy")).toHaveValue("보존되는 셋째 줄");
    await expect(launched.page.getByTestId("naver-smartchannel-field-subcopyLine4")).toHaveValue("보존되는 넷째 줄");
    expect(launched.rendererErrors).toEqual([]);
  } finally {
    await close(launched);
  }
});

test("NAVER SmartChannel 280 distinct Desktop fields reach distinct render roles", async () => {
  const cases = [
    {
      templateId: "NAVER_SMARTCHANNEL_280_BASIC_STANDARD_LEFT_MAIN_TWO_LINES_NONE",
      fixture: "mask-semicircle-right__logo__black__pass.png",
      fixtureDirectory: "valid",
      jobName: "n7-7-6-main-two-basic",
      content: { headline: "기본 첫째 줄", headlineLine2: "기본 둘째 줄" },
    },
    {
      templateId: "NAVER_SMARTCHANNEL_280_EMPHASIS_THUMBNAIL_LEFT_MAIN_TWO_LINES_NONE",
      fixture: "N2-REP-004-object.png",
      fixtureDirectory: path.join("valid", "naver-smartchannel"),
      jobName: "n7-7-6-main-two-emphasis",
      content: { headline: "강조 첫째 줄", headlineLine2: "강조 둘째 줄" },
    },
    {
      templateId: "NAVER_SMARTCHANNEL_280_EMPHASIS_PERSON_MOVIE_RIGHT_FOUR_LINE_NONE",
      fixture: "N2-REP-005-object.png",
      fixtureDirectory: path.join("valid", "naver-smartchannel"),
      jobName: "n7-7-6-four-line",
      content: { headline: "헤드라인 첫째 줄", headlineLine2: "헤드라인 둘째 줄", subcopy: "서브카피 셋째 줄", subcopyLine4: "서브카피 넷째 줄" },
    },
  ] as const;

  for (const testCase of cases) {
    const launched = await launch(path.join(projectRoot, "fixtures", testCase.fixtureDirectory, testCase.fixture));
    try {
      await launched.page.getByTestId("naver-smartchannel-template-select").selectOption(testCase.templateId);
      for (const [field, value] of Object.entries(testCase.content)) {
        await launched.page.getByTestId(`naver-smartchannel-field-${field}`).fill(value);
      }
      await launched.page.getByTestId("naver-job-name").fill(testCase.jobName);
      await launched.page.getByTestId("naver-smartchannel-select-object").click();
      await expect(launched.page.getByTestId("naver-smartchannel-editor")).toContainText(testCase.fixture);
      await expect(launched.page.getByTestId("naver-editor")).toHaveAttribute("data-primary-selected", "true");
      await launched.page.getByTestId("naver-request-preview").click();
      await expect(launched.page.getByTestId("naver-validation-status")).toHaveText("PASS");
      await launched.page.getByTestId("naver-select-output").click();
      await launched.page.getByTestId("naver-export").click();
      const manifestPath = path.join(launched.outputRoot, testCase.jobName, "render-manifest.json");
      await expect.poll(() => access(manifestPath).then(() => true).catch(() => false)).toBe(true);
      const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as { smartChannelReport: { textRoles: Array<{ inputKey: string; text: string }> } };
      const mapped = Object.fromEntries(manifest.smartChannelReport.textRoles.map((entry) => [entry.inputKey, entry.text]));
      expect(mapped).toMatchObject(testCase.content);
      expect(new Set(Object.values(mapped)).size).toBe(Object.keys(mapped).length);
      expect(launched.rendererErrors, testCase.templateId).toEqual([]);
    } finally {
      await close(launched);
    }
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
    await captureN8FormatEvidence("communication-list", path.join(launched.outputRoot, "naver-render"));
    expect(sourceSpec.compositionMode).toBe("PLATFORM_COMPOSED");
    expect(sourceSpec).not.toHaveProperty("finalCanvas");
    expect(sourceSpec).not.toHaveProperty("finalUiRendered");
    expect((sourceSpec.assets as Array<Record<string, unknown>>)[0]?.pathRef).toMatch(/\.png$/u);
  } finally {
    await close(launched);
    await rm(sourceAsset, { force: true });
  }
});

for (const testCase of [
  {
    name: "Mobile Native",
    placement: "NAVER_MOBILE_NATIVE",
    sourceProfileId: "NAVER_MOBILE_NATIVE_SOURCE_V1",
    assets: [
      { id: "NAVER_NATIVE_THUMBNAIL_342X228", width: 342, height: 228 },
      { id: "NAVER_NATIVE_PROFILE_300X300", width: 300, height: 300 },
    ],
  },
  {
    name: "PC Native",
    placement: "NAVER_PC_NATIVE",
    sourceProfileId: "NAVER_PC_NATIVE_SOURCE_V1",
    assets: [
      { id: "NAVER_NATIVE_THUMBNAIL_342X228", width: 342, height: 228 },
      { id: "NAVER_NATIVE_PROFILE_300X300", width: 300, height: 300 },
    ],
  },
  {
    name: "Shopping News",
    placement: "NAVER_SHOPPING_NEWS",
    sourceProfileId: "NAVER_SHOPPING_NEWS_SOURCE_V1",
    assets: [
      { id: "NAVER_SHOPPING_NEWS_IMAGE_750X500", width: 750, height: 500 },
    ],
  },
] as const) {
  test(`NAVER ${testCase.name} uses its canonical source profile through preview, validator and export`, async () => {
    const fixturePaths = await Promise.all(testCase.assets.map((asset, index) => writePlatformRasterFixture(`kbr-n8-${testCase.placement.toLowerCase()}-${index}`, asset.width, asset.height)));
    const launched = await launch({ primary: requiredFixturePath(fixturePaths, 0), ...(fixturePaths[1] ? { secondary: fixturePaths[1] } : {}), ...(fixturePaths[2] ? { third: fixturePaths[2] } : {}) });
    try {
      await launched.page.getByTestId("naver-placement-select").selectOption(testCase.placement);
      await expect(launched.page.getByTestId("naver-platform-source-editor")).toBeVisible();
      for (const asset of testCase.assets) {
        const card = launched.page.getByTestId(`naver-source-asset-${asset.id}`);
        await card.getByRole("button").click();
        await expect(card).toContainText(`${asset.width}×${asset.height}`);
      }
      const jobDirectory = await previewAndExportPlatformSource(launched, "SOURCE");
      await captureN8FormatEvidence(testCase.placement.toLowerCase().replaceAll("naver_", "").replaceAll("_", "-"), jobDirectory);
      const sourceSpec = JSON.parse(await readFile(path.join(jobDirectory, "source-spec.json"), "utf8")) as Record<string, unknown>;
      const manifest = JSON.parse(await readFile(path.join(jobDirectory, "source-manifest.json"), "utf8")) as Record<string, unknown>;
      expect(sourceSpec).toMatchObject({ sourceProfileId: testCase.sourceProfileId, compositionMode: "PLATFORM_COMPOSED", artifactCardinality: "SINGLE" });
      expect(sourceSpec).not.toHaveProperty("finalCanvas");
      expect(manifest).toMatchObject({ sourceProfileId: testCase.sourceProfileId, finalUiRendered: false });
      expect(launched.rendererErrors).toEqual([]);
    } finally {
      await close(launched);
      await Promise.all(fixturePaths.map((filePath) => rm(filePath, { force: true })));
    }
  });
}

test("NAVER Communication COMMENT variant resolves its distinct canonical field and asset contract", async () => {
  const sourceAsset = await writePlatformRasterFixture("kbr-n8-communication-comment", 300, 300);
  const launched = await launch(sourceAsset);
  try {
    await launched.page.getByTestId("naver-placement-select").selectOption("NAVER_COMMUNICATION_AD");
    await launched.page.getByTestId("naver-communication-variant").selectOption("COMMENT");
    await expect(launched.page.getByTestId("naver-source-field-adCopy")).toBeVisible();
    const card = launched.page.getByTestId("naver-source-asset-NAVER_COMMUNICATION_COMMENT_PROFILE_300X300");
    await card.getByRole("button").click();
    const jobDirectory = await previewAndExportPlatformSource(launched, "SOURCE");
    await captureN8FormatEvidence("communication-comment", jobDirectory);
    const sourceSpec = JSON.parse(await readFile(path.join(jobDirectory, "source-spec.json"), "utf8")) as Record<string, unknown>;
    expect(sourceSpec).toMatchObject({ sourceProfileId: "NAVER_COMMUNICATION_AD_COMMENT_SOURCE_V1", compositionMode: "PLATFORM_COMPOSED" });
  } finally {
    await close(launched);
    await rm(sourceAsset, { force: true });
  }
});

test("NAVER Feed IMAGE validates all canonical source assets and exports no synthetic final UI", async () => {
  const fixturePaths = await Promise.all([
    writePlatformRasterFixture("kbr-n8-feed-profile", 300, 300),
    writePlatformRasterFixture("kbr-n8-feed-square", 1200, 1200),
    writePlatformRasterFixture("kbr-n8-feed-wide", 1200, 628),
  ]);
  const launched = await launch({ primary: requiredFixturePath(fixturePaths, 0), secondary: requiredFixturePath(fixturePaths, 1), third: requiredFixturePath(fixturePaths, 2) });
  try {
    await launched.page.getByTestId("naver-placement-select").selectOption("NAVER_MOBILE_DA_FEED");
    await expect(launched.page.getByTestId("naver-feed-subtype")).toHaveValue("IMAGE");
    for (const [id, dimensions] of [
      ["NAVER_FEED_PROFILE_IMAGE_300X300", "300×300"],
      ["NAVER_FEED_IMAGE_1_1", "1200×1200"],
      ["NAVER_FEED_IMAGE_16_9", "1200×628"],
    ] as const) {
      const card = launched.page.getByTestId(`naver-source-asset-${id}`);
      await card.getByRole("button").click();
      // Wait for the async Main-process asset selection to commit before
      // requesting validation; otherwise the previous token can be rendered.
      await expect(card.locator("span").first()).toContainText(dimensions);
    }
    const jobDirectory = await previewAndExportPlatformSource(launched, "SOURCE");
    await captureN8FormatEvidence("mobile-da-feed-image", jobDirectory);
    const sourceSpec = JSON.parse(await readFile(path.join(jobDirectory, "source-spec.json"), "utf8")) as Record<string, unknown>;
    expect(sourceSpec).toMatchObject({ sourceProfileId: "NAVER_FEED_IMAGE_SOURCE_V1", artifactCardinality: "SINGLE" });
    expect(sourceSpec).not.toHaveProperty("finalCanvas");
  } finally {
    await close(launched);
    await Promise.all(fixturePaths.map((filePath) => rm(filePath, { force: true })));
  }
});

test("NAVER Feed VIDEO remains explicitly disabled and never invokes runtime", async () => {
  const launched = await launch(path.join(projectRoot, "fixtures", "valid", "naver-smartchannel", "N2-REP-001-object.png"));
  try {
    await launched.page.getByTestId("naver-placement-select").selectOption("NAVER_MOBILE_DA_FEED");
    await launched.page.getByTestId("naver-feed-subtype").selectOption("VIDEO");
    await expect(launched.page.getByTestId("naver-video-disabled")).toContainText("Out of static renderer scope");
    await expect(launched.page.getByTestId("naver-request-preview")).toBeDisabled();
  } finally {
    await close(launched);
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
    await captureN8FormatEvidence("mobile-da", path.join(launched.outputRoot, "freeform-render"));
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
    await launched.page.getByTestId("freeform-select-output").click();
    await launched.page.getByTestId("freeform-export").click();
    await expect(launched.page.getByTestId("freeform-export-result")).toBeVisible();
    await captureN8FormatEvidence("image-banner-1x1", path.join(launched.outputRoot, "freeform-render"));
  } finally {
    await close(launched);
    await rm(sourceAsset, { force: true });
  }
});

test("NAVER Feed Collection preserves item order and exports all artifacts", async () => {
  const fixturePaths = await Promise.all([
    writePlatformRasterFixture("kbr-n8-feed-collection-profile", 300, 300),
    writePlatformRasterFixture("kbr-n8-feed-collection-item", 600, 600),
  ]);
  const launched = await launch({ primary: requiredFixturePath(fixturePaths, 0), secondary: requiredFixturePath(fixturePaths, 1) });
  try {
    await assertNaverShell(launched, "initial");
    await launched.page.getByTestId("naver-placement-select").selectOption("NAVER_MOBILE_DA_FEED");
    await assertNaverShell(launched, "feed");
    await launched.page.getByTestId("naver-feed-subtype").selectOption("COLLECTION");
    await assertNaverShell(launched, "collection");
    await expect(launched.page.getByTestId("naver-collection-editor")).toBeVisible();
    await expect(launched.page.locator('article[data-testid^="naver-collection-item-item-"]')).toHaveCount(4);
    await launched.page.getByTestId("naver-source-asset-NAVER_FEED_PROFILE_IMAGE_300X300").getByRole("button").click();
    await launched.page.getByTestId("naver-source-asset-NAVER_FEED_COLLECTION_ITEM_IMAGE_600X600").getByRole("button").click();
    await launched.page.getByTestId("naver-collection-item-item-1").getByRole("button", { name: "↓" }).click();
    const jobDirectory = await previewAndExportPlatformSource(launched, "COLLECTION");
    await captureN8FormatEvidence("mobile-da-feed-collection", jobDirectory);
    const manifest = JSON.parse(await readFile(path.join(jobDirectory, "collection-manifest.json"), "utf8")) as { itemCount: number; finalUiRendered: boolean; items: Array<{ itemId: string; index: number }> };
    expect(manifest.itemCount).toBe(4);
    expect(manifest.finalUiRendered).toBe(false);
    expect(manifest.items.map((entry) => entry.itemId)).toEqual(["item-2", "item-1", "item-3", "item-4"]);
    expect(manifest.items.map((entry) => entry.index)).toEqual([0, 1, 2, 3]);
  } finally {
    await close(launched);
    await Promise.all(fixturePaths.map((filePath) => rm(filePath, { force: true })));
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
