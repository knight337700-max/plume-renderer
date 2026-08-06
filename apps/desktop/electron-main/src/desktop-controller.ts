import { readFile, rm, stat } from "node:fs/promises";
import {
  INTEGRATION_SCHEMA_VERSION,
  THUMBNAIL_BOX_RIGHT_FORMAT_PROFILE_ID,
  THUMBNAIL_BOX_RIGHT_IMAGE_SLOT_ID,
  THUMBNAIL_BOX_RIGHT_TEMPLATE_ID,
  renderWithIntegrationAdapter,
  type RendererIntegrationInputV1,
} from "@kbr/renderer-contract";
import {
  assertDownloadAllowed,
  createKakaoBizboardRenderer,
  loadContracts,
  renderThumbnailBoxRight,
} from "../../../../src/core/index.js";
import { verifyRuntimeAssets } from "../../../../src/core/assets.js";
import { canonicalJson } from "../../../../src/core/canonical.js";
import { sha256Bytes, sha256File } from "../../../../src/core/hash.js";
import { publishArtifacts } from "../../../../src/core/publish.js";
import { resolveTrustedJobDirectory } from "../../../../src/core/path-security.js";
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

function mapIntegrationIssues(
  issues: readonly { code: string; severity: "ERROR" | "WARNING" | "INFO"; messageKey: string; path?: string; expected?: unknown; actual?: unknown }[],
): ValidationIssue[] {
  return issues.map((entry) => ({
    code: entry.code,
    severity: entry.severity,
    messageKey: entry.messageKey,
    path: entry.path ?? "/",
    ...(entry.expected !== undefined ? { expected: entry.expected } : {}),
    ...(entry.actual !== undefined ? { actual: entry.actual } : {}),
  }));
}

function thumbnailManualAcceptanceStatus(): {
  status: "NOT_REVIEWED";
  items: Array<{ id: string; status: "NOT_REVIEWED"; reviewer: null; reviewedAt: null }>;
} {
  return {
    status: "NOT_REVIEWED",
    items: ["M-001", "M-002", "M-003", "M-004", "M-005", "M-006"].map((id) => ({
      id,
      status: "NOT_REVIEWED" as const,
      reviewer: null,
      reviewedAt: null,
    })),
  };
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
        displayName: asset.fileName,
        detectedMimeType: asset.detectedMimeType,
        bytes: asset.bytes,
        width: asset.width,
        height: asset.height,
        hasAlpha: asset.hasAlpha,
        checksumSha256: asset.sha256,
      };
    } catch (error) {
      return {
        status: "ERROR",
        code: error instanceof DesktopSecurityError ? error.code : "DESKTOP-ASSET-999",
        message: error instanceof Error ? error.message : "제품 이미지를 처리할 수 없습니다.",
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

  #buildThumbnailIntegrationInput(input: Omit<UiRenderInput, "requestSequence">, asset?: SessionAsset): RendererIntegrationInputV1 {
    const placementPlan = input.placementPlan ?? {
      schemaVersion: INTEGRATION_SCHEMA_VERSION,
      imageSlotId: THUMBNAIL_BOX_RIGHT_IMAGE_SLOT_ID,
      assetId: "selected-product",
      policy: "SEMANTIC_CROP_COVER" as const,
      source: "DETERMINISTIC" as const,
      fitMode: "COVER" as const,
      anchor: "CENTER" as const,
      subjectProtection: "NONE" as const,
    };
    const assetId = placementPlan.assetId;
    const base: RendererIntegrationInputV1 = {
      schemaVersion: INTEGRATION_SCHEMA_VERSION,
      formatProfileId: THUMBNAIL_BOX_RIGHT_FORMAT_PROFILE_ID,
      templateId: THUMBNAIL_BOX_RIGHT_TEMPLATE_ID,
      copy: {
        advertiser: input.advertiser,
        headline: input.headline,
        subcopy: input.subcopy,
        cta: "NONE",
      },
      assets: [{
        assetId,
        mimeType: asset?.detectedMimeType ?? "image/png",
        ...(asset ? { declaredWidth: asset.width, declaredHeight: asset.height, checksumSha256: asset.sha256 } : {}),
        assetRef: { type: "DESKTOP_ASSET_TOKEN", value: input.assetToken },
      }],
      imagePlacementPlans: [placementPlan],
      output: { mimeType: "image/png" },
    };
    if (input.cropCandidates && input.cropCandidates.length > 0) return { ...base, cropCandidates: input.cropCandidates };
    return base;
  }

  async #renderThumbnailIntegration(input: Omit<UiRenderInput, "requestSequence">, asset: SessionAsset): Promise<{
    integrationInput: RendererIntegrationInputV1;
    result: Awaited<ReturnType<typeof renderWithIntegrationAdapter>>;
    bytes: Buffer | null;
  }> {
    const integrationInput = this.#buildThumbnailIntegrationInput(input, asset);
    const runtimeContracts = await loadContracts(this.#projectRoot);
    const runtimeAssets = await verifyRuntimeAssets(this.#projectRoot, runtimeContracts);
    if (runtimeAssets.issues.some((entry) => entry.severity === "ERROR") || !runtimeAssets.assets) {
      throw new Error("Pinned runtime fonts or reference fixture are unavailable");
    }
    const resolvedBytes = await readFile(asset.absolutePath);
    const integrationAsset = integrationInput.assets[0];
    if (!integrationAsset) throw new Error("Thumbnail integration asset is missing");
    let renderedBytes: Buffer | null = null;
    const result = await renderWithIntegrationAdapter(integrationInput, {
      resolver: {
        resolve: async (assetRef) => {
          if (assetRef.type !== "DESKTOP_ASSET_TOKEN" || assetRef.value !== asset.token) {
            throw new Error("Desktop asset token is stale or invalid");
          }
          return {
            bytes: resolvedBytes,
            resolvedMimeType: asset.detectedMimeType,
            metadata: {
              detectedMimeType: asset.detectedMimeType,
              width: asset.width,
              height: asset.height,
              hasAlpha: asset.hasAlpha,
              exifOrientation: asset.exifOrientation,
            },
          };
        },
      },
      renderThumbnail: async (request) => {
        const rendered = await renderThumbnailBoxRight(request);
        renderedBytes = rendered.bytes;
        return rendered;
      },
      assetDigests: { [integrationAsset.assetId]: asset.sha256 },
    });
    return { integrationInput, result, bytes: renderedBytes };
  }

  async #thumbnailPreview(input: UiRenderInput, asset: SessionAsset): Promise<PreviewResult> {
    const generatedAt = new Date().toISOString();
    try {
      const { result, bytes } = await this.#renderThumbnailIntegration(input, asset);
      const errors = mapIntegrationIssues(result.validation.errors);
      const warnings = mapIntegrationIssues(result.validation.warnings);
      const artifact = result.artifact;
      if (result.status !== "PASS" || !artifact || !bytes) {
        await this.#session.invalidatePreview();
        return {
          requestSequence: input.requestSequence,
          previewToken: null,
          previewUrl: null,
          canonicalInputDigest: result.requestFingerprint,
          productAssetDigest: asset.sha256,
          previewPngDigest: null,
          pngMetadata: null,
          measurements: null,
          validationStatus: "ERROR",
          errors,
          warnings,
          generatedAt,
          template: "THUMBNAIL_BOX_RIGHT",
          appliedImagePlacement: null,
        };
      }
      const stored = await this.#session.storePreview(bytes, result.requestFingerprint, asset.sha256, artifact.checksumSha256);
      return {
        requestSequence: input.requestSequence,
        previewToken: stored.token,
        previewUrl: `kbr-preview://preview/${stored.token}`,
        canonicalInputDigest: result.requestFingerprint,
        productAssetDigest: asset.sha256,
        previewPngDigest: artifact.checksumSha256,
        pngMetadata: {
          format: "PNG",
          colorType: "RGBA",
          bitDepth: 8,
          hasAlpha: true,
          width: 1029,
          height: 258,
          bytes: artifact.bytes,
        },
        measurements: null,
        validationStatus: warnings.length > 0 ? "WARNING" : "PASS",
        errors,
        warnings,
        generatedAt,
        template: "THUMBNAIL_BOX_RIGHT",
        appliedImagePlacement: result.appliedImagePlacements[0] ?? null,
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
        template: "THUMBNAIL_BOX_RIGHT",
        appliedImagePlacement: null,
      };
    }
  }


  async requestPreview(input: UiRenderInput): Promise<PreviewResult> {
    const generatedAt = new Date().toISOString();
    try {
      const asset = this.#session.getAsset(input.assetToken);
      if (input.template === "THUMBNAIL_BOX_RIGHT") return this.#thumbnailPreview(input, asset);
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

  async #exportThumbnail(
    request: ExportRequest,
    asset: SessionAsset,
    previewRecord: Awaited<ReturnType<DesktopSessionManager["getPreview"]>>,
    output: Awaited<ReturnType<DesktopSessionManager["getOutputDirectory"]>>,
  ): Promise<ExportResult> {
    let publishedPng: string | null = null;
    let publishedManifest: string | null = null;
    try {
      const currentAssetDigest = await sha256File(asset.absolutePath);
      if (currentAssetDigest !== asset.sha256 || currentAssetDigest !== previewRecord.assetDigest) {
        return desktopFailure("BLOCKED", "DESKTOP-EXPORT-002", "제품 자산이 Preview 이후 변경되었습니다.");
      }
      const { result, bytes } = await this.#renderThumbnailIntegration(request, asset);
      const errors = mapIntegrationIssues(result.validation.errors);
      const warnings = mapIntegrationIssues(result.validation.warnings);
      if (result.status !== "PASS" || !result.artifact || !bytes || errors.length > 0) {
        return desktopFailure("BLOCKED", "KBR-DOWNLOAD-001", "최종 재검증에 실패하여 Export가 차단되었습니다.", errors, warnings);
      }
      if (result.requestFingerprint !== previewRecord.inputDigest || result.artifact.checksumSha256 !== previewRecord.pngDigest) {
        return desktopFailure("BLOCKED", "DESKTOP-EXPORT-003", "Preview가 현재 입력과 일치하지 않습니다.", errors, warnings);
      }

      const contracts = await loadContracts(this.#projectRoot);
      const fontDigests = contracts.fontRegistry.requiredAssets.flatMap((entry) =>
        entry.sha256 ? [{ id: entry.id, sha256: entry.sha256 }] : [],
      );
      const manifest = {
        schemaVersion: "1.0.0",
        canonicalInputDigest: result.requestFingerprint,
        normalizedInputDigest: result.requestFingerprint,
        outputPngDigest: result.artifact.checksumSha256,
        templateContractVersion: "1.3.0",
        inputSchemaVersion: "1.2.0",
        outputSchemaVersion: "2.0.0",
        validatorResult: {
          errorCount: 0,
          warningCount: warnings.length,
          infoCount: result.validation.info.length,
          issues: [...warnings, ...mapIntegrationIssues(result.validation.info)],
        },
        assetDigests: {
          product: { id: result.appliedImagePlacements[0]?.assetId ?? "IMAGE_PRIMARY", sha256: asset.sha256 },
          fonts: fontDigests,
          approvedIcons: [],
          referenceFixture: { id: contracts.referenceRegistry.fixture.id, sha256: contracts.referenceRegistry.fixture.sha256 },
        },
        manualAcceptanceStatus: thumbnailManualAcceptanceStatus(),
      };
      const manifestText = canonicalJson(manifest);
      const manifestDigest = sha256Bytes(Buffer.from(manifestText, "utf8"));
      const jobDirectory = await resolveTrustedJobDirectory(output.root, ".", request.jobName);
      const published = await publishArtifacts({
        outputRoot: output.root,
        jobDirectory,
        png: bytes,
        manifest: manifestText,
        overwrite: false,
      });
      publishedPng = published.pngPath;
      publishedManifest = published.manifestPath;
      const [actualPngDigest, actualManifestDigest, pngStat] = await Promise.all([
        sha256File(published.pngPath),
        sha256File(published.manifestPath),
        stat(published.pngPath),
      ]);
      if (actualPngDigest !== result.artifact.checksumSha256 || actualManifestDigest !== manifestDigest) {
        await Promise.allSettled([rm(published.pngPath, { force: true }), rm(published.manifestPath, { force: true })]);
        return desktopFailure("ERROR", "DESKTOP-EXPORT-004", "저장된 산출물 digest 검증에 실패했습니다.");
      }
      const exportToken = this.#session.registerExport(published.pngPath, published.manifestPath);
      return {
        status: "EXPORTED",
        exportToken,
        jobName: request.jobName,
        pngFileName: "output.png",
        manifestFileName: "render-manifest.json",
        pngDigest: actualPngDigest,
        manifestDigest: actualManifestDigest,
        bytes: pngStat.size,
        warnings,
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
      if (request.template === "THUMBNAIL_BOX_RIGHT") return this.#exportThumbnail(request, asset, previewRecord, output);
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
