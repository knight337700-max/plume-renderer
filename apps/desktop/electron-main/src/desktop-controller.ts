import { readFile, rm, stat } from "node:fs/promises";
import {
  assertDownloadAllowed,
  createKakaoBizboardRenderer,
  loadContracts,
} from "../../../../src/core/index.js";
import { sha256File } from "../../../../src/core/hash.js";
import type { KakaoBizboardInputV1, ValidationIssue } from "../../../../src/core/types.js";
import type {
  AppInfo,
  ExportRequest,
  ExportResult,
  PreviewResult,
  ProductSelectionResult,
  UiRenderInput,
} from "../../shared/src/index.js";
import { assertSafeJobName } from "./security/safe-filename.js";
import {
  DesktopSecurityError,
  type DesktopSessionManager,
  type SessionAsset,
} from "./session/session-manager.js";

function desktopFailure(
  status: "BLOCKED" | "ERROR",
  code: string,
  message: string,
  errors: ValidationIssue[] = [],
  warnings: ValidationIssue[] = [],
): ExportResult {
  return { status, code, message, errors, warnings };
}

function extractMaximum(schema: Record<string, unknown>, pathParts: string[]): number {
  let current: unknown = schema;
  for (const part of pathParts) {
    if (typeof current !== "object" || current === null || !(part in current)) return 0;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "number" ? current : 0;
}

export type DesktopControllerConfig = {
  projectRoot: string;
  session: DesktopSessionManager;
  appVersion: string;
  blockedNetworkRequestCount(): number;
};

export class DesktopController {
  readonly #projectRoot: string;
  readonly #session: DesktopSessionManager;
  readonly #appVersion: string;
  readonly #blockedNetworkRequestCount: () => number;

  constructor(config: DesktopControllerConfig) {
    this.#projectRoot = config.projectRoot;
    this.#session = config.session;
    this.#appVersion = config.appVersion;
    this.#blockedNetworkRequestCount = config.blockedNetworkRequestCount;
  }

  async selectProductFromPath(sourcePath: string): Promise<ProductSelectionResult> {
    try {
      const asset = await this.#session.selectProduct(sourcePath);
      return {
        status: "SELECTED",
        assetToken: asset.token,
        fileName: asset.fileName,
        bytes: asset.bytes,
        width: asset.width,
        height: asset.height,
        hasAlpha: asset.hasAlpha,
        sha256: asset.sha256,
      };
    } catch (error) {
      return {
        status: "ERROR",
        code: error instanceof DesktopSecurityError ? error.code : "DESKTOP-ASSET-999",
        message: error instanceof Error ? error.message : "제품 PNG를 처리할 수 없습니다.",
      };
    }
  }

  async clearProduct(): Promise<void> {
    await this.#session.clearProduct();
  }

  #buildInput(input: Omit<UiRenderInput, "requestSequence">, asset: SessionAsset): KakaoBizboardInputV1 {
    assertSafeJobName(input.jobName);
    return {
      schemaVersion: "1.2.0",
      channel: "KAKAO_MOMENT",
      placement: "BIZBOARD",
      template: "OBJECT_RIGHT",
      advertiser: { text: input.advertiser, renderMode: "REQUIRE_IN_COPY" },
      copy: { headline: input.headline, subcopy: input.subcopy },
      cta: { mode: "NONE", landingType: "DIRECT_URL" },
      assets: {
        product: {
          path: asset.relativePath,
          expectedSha256: asset.sha256,
          alphaTrim: true,
        },
      },
      output: { directory: ".", baseName: input.jobName, overwrite: false },
    };
  }

  async requestPreview(input: UiRenderInput): Promise<PreviewResult> {
    const generatedAt = new Date().toISOString();
    try {
      const asset = this.#session.getAsset(input.assetToken);
      const coreInput = this.#buildInput(input, asset);
      const renderer = await createKakaoBizboardRenderer({
        projectRoot: this.#projectRoot,
        inputRoot: this.#session.inputRoot,
        outputRoot: this.#session.previewRoot,
      });
      const preview = await renderer.previewInternal(coreInput);
      if (
        !preview.png ||
        !preview.canonicalInputDigest ||
        !preview.productAssetDigest ||
        !preview.previewPngDigest
      ) {
        await this.#session.invalidatePreview();
        return {
          requestSequence: input.requestSequence,
          previewToken: null,
          previewUrl: null,
          canonicalInputDigest: preview.canonicalInputDigest,
          productAssetDigest: preview.productAssetDigest,
          previewPngDigest: null,
          pngMetadata: null,
          measurements: preview.measurements,
          validationStatus: "ERROR",
          errors: preview.errors,
          warnings: preview.warnings,
          generatedAt,
        };
      }
      const stored = await this.#session.storePreview(
        preview.png,
        preview.canonicalInputDigest,
        preview.productAssetDigest,
        preview.previewPngDigest,
      );
      return {
        requestSequence: input.requestSequence,
        previewToken: stored.token,
        previewUrl: `kbr-preview://preview/${stored.token}`,
        canonicalInputDigest: preview.canonicalInputDigest,
        productAssetDigest: preview.productAssetDigest,
        previewPngDigest: preview.previewPngDigest,
        pngMetadata: preview.pngMetadata,
        measurements: preview.measurements,
        validationStatus: preview.validationStatus,
        errors: preview.errors,
        warnings: preview.warnings,
        generatedAt,
      };
    } catch {
      await this.#session.invalidatePreview();
      return {
        requestSequence: input.requestSequence,
        previewToken: null,
        previewUrl: null,
        canonicalInputDigest: null,
        productAssetDigest: null,
        previewPngDigest: null,
        pngMetadata: null,
        measurements: null,
        validationStatus: "ERROR",
        errors: [],
        warnings: [],
        generatedAt,
      };
    }
  }

  async registerOutputDirectory(rootPath: string): Promise<{ token: string; displayName: string }> {
    return this.#session.registerOutputDirectory(rootPath);
  }

  async exportRender(request: ExportRequest): Promise<ExportResult> {
    let publishedPng: string | null = null;
    let publishedManifest: string | null = null;
    try {
      const asset = this.#session.getAsset(request.assetToken);
      const previewRecord = this.#session.getPreview(request.previewToken);
      const output = this.#session.getOutputDirectory(request.outputDirectoryToken);
      const currentAssetDigest = await sha256File(asset.absolutePath);
      if (currentAssetDigest !== asset.sha256 || currentAssetDigest !== previewRecord.assetDigest) {
        return desktopFailure("BLOCKED", "DESKTOP-EXPORT-002", "제품 자산이 Preview 이후 변경되었습니다.");
      }

      const coreInput = this.#buildInput(request, asset);
      const renderer = await createKakaoBizboardRenderer({
        projectRoot: this.#projectRoot,
        inputRoot: this.#session.inputRoot,
        outputRoot: output.root,
      });
      const revalidated = await renderer.previewInternal(coreInput);
      if (
        revalidated.validationStatus === "ERROR" ||
        revalidated.errors.length > 0 ||
        !revalidated.canonicalInputDigest ||
        !revalidated.productAssetDigest ||
        !revalidated.previewPngDigest
      ) {
        return desktopFailure(
          "BLOCKED",
          "KBR-DOWNLOAD-001",
          "최종 재검증에 실패하여 Export가 차단되었습니다.",
          revalidated.errors,
          revalidated.warnings,
        );
      }
      if (
        revalidated.canonicalInputDigest !== previewRecord.inputDigest ||
        revalidated.productAssetDigest !== previewRecord.assetDigest ||
        revalidated.previewPngDigest !== previewRecord.pngDigest
      ) {
        return desktopFailure("BLOCKED", "DESKTOP-EXPORT-003", "Preview가 현재 입력과 일치하지 않습니다.");
      }

      const response = await renderer.render(coreInput);
      if (!response.downloadAllowed || !response.pngPath || !response.manifestPath) {
        return desktopFailure(
          "BLOCKED",
          "KBR-DOWNLOAD-001",
          "Core download gate가 Export를 차단했습니다.",
          response.errors,
          response.warnings,
        );
      }
      const contracts = await loadContracts(this.#projectRoot);
      assertDownloadAllowed(response, contracts);
      publishedPng = response.pngPath;
      publishedManifest = response.manifestPath;
      const [actualPngDigest, actualManifestDigest, pngStat] = await Promise.all([
        sha256File(response.pngPath),
        sha256File(response.manifestPath),
        stat(response.pngPath),
      ]);
      if (
        actualPngDigest !== response.pngDigest ||
        actualManifestDigest !== response.manifestDigest ||
        actualPngDigest !== previewRecord.pngDigest
      ) {
        await Promise.allSettled([rm(response.pngPath, { force: true }), rm(response.manifestPath, { force: true })]);
        return desktopFailure("ERROR", "DESKTOP-EXPORT-004", "저장된 산출물 digest 검증에 실패했습니다.");
      }
      const exportToken = this.#session.registerExport(response.pngPath, response.manifestPath);
      return {
        status: "EXPORTED",
        exportToken,
        jobName: request.jobName,
        pngFileName: "output.png",
        manifestFileName: "render-manifest.json",
        pngDigest: actualPngDigest,
        manifestDigest: actualManifestDigest,
        bytes: pngStat.size,
        warnings: response.warnings,
      };
    } catch (error) {
      if (publishedPng || publishedManifest) {
        await Promise.allSettled([
          publishedPng ? rm(publishedPng, { force: true }) : Promise.resolve(),
          publishedManifest ? rm(publishedManifest, { force: true }) : Promise.resolve(),
        ]);
      }
      return desktopFailure(
        "ERROR",
        error instanceof DesktopSecurityError ? error.code : "DESKTOP-EXPORT-999",
        error instanceof Error ? error.message : "Export 중 내부 오류가 발생했습니다.",
      );
    }
  }

  getExportPaths(exportToken: string): { pngPath: string; manifestPath: string } {
    return this.#session.getExport(exportToken);
  }

  async getAppInfo(): Promise<AppInfo> {
    const contracts = await loadContracts(this.#projectRoot);
    return {
      name: "카카오 비즈보드 로컬 Renderer",
      version: this.#appVersion,
      template: "OBJECT_RIGHT",
      canvas: { width: 1029, height: 258 },
      ctaMode: "NONE",
      runtimeNetworkAccess: "PROHIBITED",
      signed: false,
      limits: {
        advertiser: extractMaximum(contracts.inputSchema, ["properties", "advertiser", "properties", "text", "maxLength"]),
        headline: extractMaximum(contracts.inputSchema, ["properties", "copy", "properties", "headline", "maxLength"]),
        subcopy: extractMaximum(contracts.inputSchema, ["properties", "copy", "properties", "subcopy", "maxLength"]),
        jobName: extractMaximum(contracts.inputSchema, ["properties", "output", "properties", "baseName", "maxLength"]),
      },
      blockedNetworkRequestCount: this.#blockedNetworkRequestCount(),
    };
  }

  async previewBytes(token: string): Promise<Buffer> {
    return this.#session.readPreview(token);
  }

  async exportedManifest(token: string): Promise<unknown> {
    return JSON.parse(await readFile(this.#session.getExport(token).manifestPath, "utf8")) as unknown;
  }
}
