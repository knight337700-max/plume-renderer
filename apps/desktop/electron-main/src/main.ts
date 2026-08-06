import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  protocol,
  session as electronSession,
  shell,
} from "electron";

import type { UiRenderInput } from "../../shared/src/index.js";
import { INTEGRATION_SCHEMA_VERSION } from "@kbr/renderer-contract";
import { DesktopController } from "./desktop-controller.js";
import { registerDesktopIpc } from "./ipc/register-ipc.js";
import { DesktopSessionManager } from "./session/session-manager.js";
import {
  BLOCKED_NETWORK_PATTERNS,
  isAllowedRendererNavigation,
  secureWebPreferences,
} from "./security/window-security.js";

const APP_PROTOCOL = "kbr-app";
const PREVIEW_PROTOCOL = "kbr-preview";
const RENDERER_URL = `${APP_PROTOCOL}://app/index.html`;
const SMOKE_TOKEN_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

protocol.registerSchemesAsPrivileged([
  { scheme: APP_PROTOCOL, privileges: { standard: true, secure: true, supportFetchAPI: true } },
  { scheme: PREVIEW_PROTOCOL, privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);
app.enableSandbox();
app.setName("Kakao Bizboard Local Renderer (Unofficial)");

let desktopSession: DesktopSessionManager | null = null;
let cleanupComplete = false;
let blockedNetworkRequestCount = 0;

function projectRoot(): string {
  return app.isPackaged ? app.getAppPath() : path.resolve(__dirname, "../..");
}

function mimeType(filePath: string): string {
  switch (path.extname(filePath).toLowerCase()) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".png":
      return "image/png";
    case ".svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}

function safeUiPath(url: URL): string | null {
  if (url.hostname !== "app") return null;
  const uiRoot = path.join(projectRoot(), "dist-desktop", "renderer-ui");
  const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
  if (relative.includes("\0") || relative.split("/").includes("..")) return null;
  const target = path.resolve(uiRoot, ...relative.split("/"));
  const fromRoot = path.relative(uiRoot, target);
  if (fromRoot === "" || fromRoot.startsWith(`..${path.sep}`) || path.isAbsolute(fromRoot)) {
    return relative === "index.html" ? target : null;
  }
  return target;
}

async function registerLocalProtocols(controller: DesktopController): Promise<void> {
  await protocol.handle(APP_PROTOCOL, async (request) => {
    if (request.method !== "GET") return new Response(null, { status: 405 });
    const target = safeUiPath(new URL(request.url));
    if (!target) return new Response(null, { status: 403 });
    try {
      return new Response(Uint8Array.from(await readFile(target)), {
        status: 200,
        headers: { "Content-Type": mimeType(target), "Cache-Control": "no-store" },
      });
    } catch {
      return new Response(null, { status: 404 });
    }
  });

  await protocol.handle(PREVIEW_PROTOCOL, async (request) => {
    if (request.method !== "GET") return new Response(null, { status: 405 });
    const url = new URL(request.url);
    const token = url.pathname.replace(/^\/+/, "");
    if (url.hostname !== "preview" || !SMOKE_TOKEN_PATTERN.test(token)) {
      return new Response(null, { status: 403 });
    }
    try {
      return new Response(Uint8Array.from(await controller.previewBytes(token)), {
        status: 200,
        headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
      });
    } catch {
      return new Response(null, { status: 404 });
    }
  });
}

function configureRuntimeNetworkPolicy(): void {
  const runtimeSession = electronSession.defaultSession;
  runtimeSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  runtimeSession.setPermissionCheckHandler(() => false);
  runtimeSession.webRequest.onBeforeRequest(
    { urls: [...BLOCKED_NETWORK_PATTERNS] },
    (_details, callback) => {
      blockedNetworkRequestCount += 1;
      callback({ cancel: true });
    },
  );
}

function createWindow(controller: DesktopController): BrowserWindow {
  const development = !app.isPackaged && process.env.KBR_DESKTOP_DEVTOOLS === "1";
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1080,
    minHeight: 720,
    show: false,
    title: "카카오 비즈보드 로컬 Renderer — 비공식 도구",
    backgroundColor: "#f4f5f7",
    autoHideMenuBar: true,
    webPreferences: secureWebPreferences(
      path.join(projectRoot(), "dist-desktop", "preload", "index.cjs"),
      development,
    ),
  });
  Menu.setApplicationMenu(null);
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, target) => {
    if (!isAllowedRendererNavigation(target, RENDERER_URL)) event.preventDefault();
  });
  window.webContents.on("will-attach-webview", (event) => event.preventDefault());
  window.webContents.on("devtools-opened", () => {
    if (!development) window.webContents.closeDevTools();
  });
  window.once("ready-to-show", () => window.show());

  const e2eMode = !app.isPackaged && process.env.KBR_E2E_MODE === "1";
  registerDesktopIpc({
    ipcMain,
    window,
    rendererUrl: RENDERER_URL,
    controller,
    dialog,
    shell,
    ...(e2eMode && process.env.KBR_E2E_PRODUCT ? { e2eProductPath: process.env.KBR_E2E_PRODUCT } : {}),
    ...(e2eMode && process.env.KBR_E2E_LOGO ? { e2eLogoPath: process.env.KBR_E2E_LOGO } : {}),
    ...(e2eMode && process.env.KBR_E2E_OUTPUT ? { e2eOutputPath: process.env.KBR_E2E_OUTPUT } : {}),
  });
  void window.loadURL(RENDERER_URL);
  return window;
}

function smokeToken(): string | null {
  const argument = process.argv.find((value) => value.startsWith("--smoke-test="));
  if (!argument) return null;
  const token = argument.slice("--smoke-test=".length);
  return SMOKE_TOKEN_PATTERN.test(token) ? token : null;
}

async function runPackagedSmoke(
  token: string,
  controller: DesktopController,
  sessionManager: DesktopSessionManager,
): Promise<number> {
  const resultPath = path.join(os.tmpdir(), `kbr-package-smoke-${token}.json`);
  const outputRoot = path.join(os.tmpdir(), `kbr-package-smoke-output-${token}`);
  const productPath = path.join(
    projectRoot(),
    "fixtures",
    "valid",
    "object-right__product__basic__pass.png",
  );
  const jpegProductPath = path.join(
    projectRoot(),
    "fixtures",
    "valid",
    "thumbnail-box-right__asset__jpeg__pass.jpg",
  );
  const maskLogoPath = path.join(projectRoot(), "fixtures", "valid", "mask-semicircle-right__logo__white__pass.png");
  const maskImagePath = path.join(projectRoot(), "fixtures", "valid", "mask-semicircle-right__image__basic__pass.png");
  await mkdir(outputRoot, { recursive: true });
  try {
    const product = await controller.selectProductFromPath(productPath);
    if (product.status !== "SELECTED") throw new Error(`Product selection failed: ${product.status}`);
    const input: UiRenderInput = {
      assetToken: product.assetToken,
      advertiser: "자코모",
      headline: "자코모 프리미엄 소파",
      subcopy: "거실을 바꾸는 선택",
      jobName: "package-smoke",
      requestSequence: 1,
    };
    const preview = await controller.requestPreview(input);
    if (!preview.previewToken || preview.validationStatus === "ERROR") throw new Error("Preview failed");
    const selectedOutput = await controller.registerOutputDirectory(outputRoot);
    const exported = await controller.exportRender({
      ...input,
      previewToken: preview.previewToken,
      outputDirectoryToken: selectedOutput.token,
    });
    if (exported.status !== "EXPORTED") throw new Error(`Export failed: ${exported.code}`);
    const paths = controller.getExportPaths(exported.exportToken);
    const thumbnailInput: UiRenderInput = {
      assetToken: product.assetToken,
      advertiser: "자코모",
      headline: "자코모 프리미엄 소파",
      subcopy: "거실을 바꾸는 선택",
      jobName: "package-smoke-thumbnail",
      requestSequence: 2,
      template: "THUMBNAIL_BOX_RIGHT",
      placementPlan: {
        schemaVersion: INTEGRATION_SCHEMA_VERSION,
        imageSlotId: "IMAGE_PRIMARY",
        assetId: "selected-product",
        policy: "SEMANTIC_CROP_COVER",
        source: "DETERMINISTIC",
        fitMode: "COVER",
        cropRect: { x: 0.1, y: 0, width: 0.8, height: 1 },
        anchor: "CENTER",
        subjectProtection: "NONE",
      },
    };
    const thumbnailPreview = await controller.requestPreview(thumbnailInput);
    if (!thumbnailPreview.previewToken || thumbnailPreview.validationStatus === "ERROR") throw new Error("Thumbnail preview failed");
    const thumbnailExport = await controller.exportRender({
      ...thumbnailInput,
      previewToken: thumbnailPreview.previewToken,
      outputDirectoryToken: selectedOutput.token,
    });
    if (thumbnailExport.status !== "EXPORTED") throw new Error(`Thumbnail export failed: ${thumbnailExport.code}`);
    const thumbnailPaths = controller.getExportPaths(thumbnailExport.exportToken);
    const thumbnailPlan = thumbnailInput.placementPlan;
    if (!thumbnailPlan) throw new Error("Thumbnail placement plan is missing");
    const decimalThumbnailInput: UiRenderInput = {
      ...thumbnailInput,
      jobName: "package-smoke-thumbnail-decimal",
      requestSequence: 5,
      placementPlan: {
        ...thumbnailPlan,
        schemaVersion: thumbnailPlan.schemaVersion,
        imageSlotId: thumbnailPlan.imageSlotId,
        assetId: thumbnailPlan.assetId,
        policy: thumbnailPlan.policy,
        source: thumbnailPlan.source,
        fitMode: thumbnailPlan.fitMode,
        anchor: thumbnailPlan.anchor,
        subjectProtection: thumbnailPlan.subjectProtection,
        cropRect: { x: 0.125, y: 0.0835, width: 0.734, height: 0.8125 },
      },
    };
    const decimalThumbnailPreview = await controller.requestPreview(decimalThumbnailInput);
    if (!decimalThumbnailPreview.previewToken || decimalThumbnailPreview.validationStatus === "ERROR") throw new Error("Decimal thumbnail preview failed");
    const decimalThumbnailExport = await controller.exportRender({
      ...decimalThumbnailInput,
      previewToken: decimalThumbnailPreview.previewToken,
      outputDirectoryToken: selectedOutput.token,
    });
    if (decimalThumbnailExport.status !== "EXPORTED") throw new Error(`Decimal thumbnail export failed: ${decimalThumbnailExport.code}`);
    const decimalThumbnailPaths = controller.getExportPaths(decimalThumbnailExport.exportToken);
    const keyboardAdjustmentBasePlan = {
      ...thumbnailPlan,
      schemaVersion: thumbnailPlan.schemaVersion,
      imageSlotId: thumbnailPlan.imageSlotId,
      assetId: thumbnailPlan.assetId,
      policy: thumbnailPlan.policy,
      source: thumbnailPlan.source,
      fitMode: thumbnailPlan.fitMode,
      anchor: thumbnailPlan.anchor,
      subjectProtection: thumbnailPlan.subjectProtection,
      cropRect: { x: 0, y: 0, width: 0.5, height: 1 },
    };
    const keyboardAdjustmentPlan = { ...keyboardAdjustmentBasePlan, cropRect: { x: 0.1, y: 0, width: 0.5, height: 1 } };
    const keyboardAdjustmentBaseInput: UiRenderInput = {
      ...thumbnailInput,
      jobName: "package-smoke-thumbnail-keyboard-base",
      requestSequence: 6,
      placementPlan: keyboardAdjustmentBasePlan,
    };
    const keyboardAdjustmentInput: UiRenderInput = {
      ...keyboardAdjustmentBaseInput,
      jobName: "package-smoke-thumbnail-keyboard-adjusted",
      requestSequence: 7,
      placementPlan: keyboardAdjustmentPlan,
    };
    const keyboardBasePreview = await controller.requestPreview(keyboardAdjustmentBaseInput);
    const keyboardAdjustedPreview = await controller.requestPreview(keyboardAdjustmentInput);
    if (!keyboardBasePreview.previewToken || keyboardBasePreview.validationStatus === "ERROR" || !keyboardAdjustedPreview.previewToken || keyboardAdjustedPreview.validationStatus === "ERROR") throw new Error("Keyboard crop adjustment preview failed");
    const keyboardAdjustedExport = await controller.exportRender({
      ...keyboardAdjustmentInput,
      previewToken: keyboardAdjustedPreview.previewToken,
      outputDirectoryToken: selectedOutput.token,
    });
    if (keyboardAdjustedExport.status !== "EXPORTED") throw new Error(`Keyboard crop adjustment export failed: ${keyboardAdjustedExport.code}`);
    const keyboardAdjustedPaths = controller.getExportPaths(keyboardAdjustedExport.exportToken);
    const multiSecondary = await controller.selectSecondaryProductFromPath(jpegProductPath);
    if (multiSecondary.status !== "SELECTED") throw new Error("Thumbnail multi secondary selection failed");
    const multiInput: UiRenderInput = {
      assetToken: product.assetToken,
      secondaryAssetToken: multiSecondary.assetToken,
      advertiser: "자코모",
      headline: "자코모 프리미엄 소파",
      subcopy: "거실을 바꾸는 선택",
      jobName: "package-smoke-thumbnail-multi",
      requestSequence: 3,
      template: "THUMBNAIL_MULTI_RIGHT",
      placementPlans: [
        { schemaVersion: INTEGRATION_SCHEMA_VERSION, imageSlotId: "IMAGE_PRIMARY", assetId: "selected-primary", policy: "SEMANTIC_CROP_COVER", source: "AGENT", fitMode: "COVER", cropRect: { x: 0, y: 0, width: 1, height: 1 }, anchor: "CENTER", subjectProtection: "NONE" },
        { schemaVersion: INTEGRATION_SCHEMA_VERSION, imageSlotId: "IMAGE_SECONDARY", assetId: "selected-secondary", policy: "MANUAL_CROP", source: "MANUAL", fitMode: "COVER", cropRect: { x: 0, y: 0, width: 1, height: 1 }, anchor: "CENTER", subjectProtection: "NONE" },
      ],
    };
    const multiPreview = await controller.requestPreview(multiInput);
    if (!multiPreview.previewToken || multiPreview.validationStatus === "ERROR") throw new Error("Thumbnail multi preview failed");
    const multiExport = await controller.exportRender({ ...multiInput, previewToken: multiPreview.previewToken, outputDirectoryToken: selectedOutput.token });
    if (multiExport.status !== "EXPORTED") throw new Error(`Thumbnail multi export failed: ${multiExport.code}`);
    const multiPaths = controller.getExportPaths(multiExport.exportToken);
    const maskImage = await controller.selectProductFromPath(maskImagePath);
    if (maskImage.status !== "SELECTED") throw new Error("MASK image selection failed");
    const logo = await controller.selectLogoFromPath(maskLogoPath);
    if (logo.status !== "SELECTED") throw new Error("MASK logo selection failed");
    const maskInput: UiRenderInput = {
      assetToken: maskImage.assetToken,
      logoAssetToken: logo.assetToken,
      advertiser: "자코모",
      headline: "자코모 프리미엄 소파",
      subcopy: "거실을 바꾸는 선택",
      jobName: "package-smoke-mask-semicircle",
      requestSequence: 8,
      template: "MASK_SEMICIRCLE_RIGHT",
      placementPlans: [
        { schemaVersion: INTEGRATION_SCHEMA_VERSION, imageSlotId: "IMAGE_PRIMARY", assetId: "selected-image", policy: "MANUAL_CROP", source: "MANUAL", fitMode: "COVER", cropRect: { x: 0, y: 0, width: 1, height: 1 }, anchor: "CENTER", subjectProtection: "NONE" },
        { schemaVersion: INTEGRATION_SCHEMA_VERSION, imageSlotId: "LOGO_PRIMARY", assetId: "selected-logo", policy: "ALPHA_TRIM_CONTAIN", source: "DETERMINISTIC", fitMode: "CONTAIN", anchor: "CENTER", subjectProtection: "NONE" },
      ],
    };
    const maskPreview = await controller.requestPreview(maskInput);
    if (!maskPreview.previewToken || maskPreview.validationStatus === "ERROR") throw new Error(`MASK preview failed: ${JSON.stringify(maskPreview.errors)}`);
    const maskExport = await controller.exportRender({ ...maskInput, previewToken: maskPreview.previewToken, outputDirectoryToken: selectedOutput.token });
    if (maskExport.status !== "EXPORTED") throw new Error(`MASK export failed: ${maskExport.code}`);
    const maskPaths = controller.getExportPaths(maskExport.exportToken);
    const jpegProduct = await controller.selectProductFromPath(jpegProductPath);
    if (jpegProduct.status !== "SELECTED" || jpegProduct.detectedMimeType !== "image/jpeg") throw new Error("JPEG product selection failed");
    const jpegThumbnailInput: UiRenderInput = {
      assetToken: jpegProduct.assetToken,
      advertiser: "자코모",
      headline: "자코모 프리미엄 소파",
      subcopy: "거실을 바꾸는 선택",
      jobName: "package-smoke-thumbnail-jpeg",
      requestSequence: 4,
      template: "THUMBNAIL_BOX_RIGHT",
      placementPlan: {
        schemaVersion: INTEGRATION_SCHEMA_VERSION,
        imageSlotId: "IMAGE_PRIMARY",
        assetId: "selected-product",
        policy: "SEMANTIC_CROP_COVER",
        source: "DETERMINISTIC",
        fitMode: "COVER",
        cropRect: { x: 0.1, y: 0, width: 0.8, height: 1 },
        anchor: "CENTER",
        subjectProtection: "NONE",
      },
    };
    const jpegThumbnailPreview = await controller.requestPreview(jpegThumbnailInput);
    if (!jpegThumbnailPreview.previewToken || jpegThumbnailPreview.validationStatus === "ERROR") throw new Error("JPEG thumbnail preview failed");
    const jpegThumbnailExport = await controller.exportRender({
      ...jpegThumbnailInput,
      previewToken: jpegThumbnailPreview.previewToken,
      outputDirectoryToken: selectedOutput.token,
    });
    if (jpegThumbnailExport.status !== "EXPORTED") throw new Error(`JPEG thumbnail export failed: ${jpegThumbnailExport.code}`);
    const jpegThumbnailPaths = controller.getExportPaths(jpegThumbnailExport.exportToken);
    await writeFile(
      resultPath,
      JSON.stringify({
        status: "PASS",
        previewPngDigest: preview.previewPngDigest,
        pngDigest: exported.pngDigest,
        manifestDigest: exported.manifestDigest,
        pngPath: paths.pngPath,
        manifestPath: paths.manifestPath,
        thumbnailPreviewPngDigest: thumbnailPreview.previewPngDigest,
        thumbnailPngDigest: thumbnailExport.pngDigest,
        thumbnailManifestDigest: thumbnailExport.manifestDigest,
        thumbnailPngPath: thumbnailPaths.pngPath,
        thumbnailManifestPath: thumbnailPaths.manifestPath,
        decimalThumbnailPreviewPngDigest: decimalThumbnailPreview.previewPngDigest,
        decimalThumbnailPngDigest: decimalThumbnailExport.pngDigest,
        decimalThumbnailManifestDigest: decimalThumbnailExport.manifestDigest,
        decimalThumbnailPngPath: decimalThumbnailPaths.pngPath,
        decimalThumbnailManifestPath: decimalThumbnailPaths.manifestPath,
        keyboardBasePreviewPngDigest: keyboardBasePreview.previewPngDigest,
        keyboardAdjustedPreviewPngDigest: keyboardAdjustedPreview.previewPngDigest,
        keyboardAdjustedPngDigest: keyboardAdjustedExport.pngDigest,
        keyboardAdjustedManifestDigest: keyboardAdjustedExport.manifestDigest,
        keyboardAdjustedPngPath: keyboardAdjustedPaths.pngPath,
        keyboardAdjustedManifestPath: keyboardAdjustedPaths.manifestPath,
        multiPreviewPngDigest: multiPreview.previewPngDigest,
        multiPngDigest: multiExport.pngDigest,
        multiManifestDigest: multiExport.manifestDigest,
        multiPngPath: multiPaths.pngPath,
        multiManifestPath: multiPaths.manifestPath,
        maskPreviewPngDigest: maskPreview.previewPngDigest,
        maskPngDigest: maskExport.pngDigest,
        maskManifestDigest: maskExport.manifestDigest,
        maskPngPath: maskPaths.pngPath,
        maskManifestPath: maskPaths.manifestPath,
        maskAppliedImagePlacements: maskPreview.appliedImagePlacements,
        jpegThumbnailPreviewPngDigest: jpegThumbnailPreview.previewPngDigest,
        jpegThumbnailPngDigest: jpegThumbnailExport.pngDigest,
        jpegThumbnailManifestDigest: jpegThumbnailExport.manifestDigest,
        jpegThumbnailPngPath: jpegThumbnailPaths.pngPath,
        jpegThumbnailManifestPath: jpegThumbnailPaths.manifestPath,
        jpegDetectedMimeType: jpegProduct.detectedMimeType,
        jpegWidth: jpegProduct.width,
        jpegHeight: jpegProduct.height,
        blockedNetworkRequestCount,
      }),
      "utf8",
    );
    return 0;
  } catch (error) {
    await writeFile(
      resultPath,
      JSON.stringify({ status: "FAIL", message: error instanceof Error ? error.message : String(error) }),
      "utf8",
    );
    return 1;
  } finally {
    await sessionManager.cleanup();
    cleanupComplete = true;
  }
}

app.on("before-quit", (event) => {
  if (!desktopSession || cleanupComplete) return;
  event.preventDefault();
  void desktopSession.cleanup().finally(() => {
    cleanupComplete = true;
    app.quit();
  });
});

app.on("window-all-closed", () => app.quit());

void app.whenReady().then(async () => {
  const e2eSessionRoot = !app.isPackaged && process.env.KBR_E2E_MODE === "1"
    ? process.env.KBR_E2E_SESSION_BASE
    : undefined;
  const baseRoot = e2eSessionRoot || path.join(app.getPath("temp"), "kbr-session");
  await DesktopSessionManager.cleanupStaleSessions(baseRoot);
  desktopSession = new DesktopSessionManager(baseRoot);
  await desktopSession.initialize();
  const controller = new DesktopController({
    projectRoot: projectRoot(),
    session: desktopSession,
    appVersion: app.getVersion(),
    blockedNetworkRequestCount: () => blockedNetworkRequestCount,
  });
  configureRuntimeNetworkPolicy();
  await registerLocalProtocols(controller);

  const token = smokeToken();
  if (token) {
    const exitCode = await runPackagedSmoke(token, controller, desktopSession);
    app.exit(exitCode);
    return;
  }
  createWindow(controller);
});
