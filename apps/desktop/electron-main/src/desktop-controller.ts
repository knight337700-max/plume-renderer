import { readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import {
  INTEGRATION_SCHEMA_VERSION,
  MASK_SEMICIRCLE_RIGHT_FORMAT_PROFILE_ID,
  MASK_SEMICIRCLE_RIGHT_IMAGE_SLOT_ID,
  MASK_SEMICIRCLE_RIGHT_LOGO_SLOT_ID,
  MASK_SEMICIRCLE_RIGHT_MASK_ASSET_ID,
  MASK_SEMICIRCLE_RIGHT_MASK_ASSET_PATH,
  MASK_SEMICIRCLE_RIGHT_TEMPLATE_ID,
  THUMBNAIL_BOX_RIGHT_FORMAT_PROFILE_ID,
  THUMBNAIL_BOX_RIGHT_IMAGE_SLOT_ID,
  THUMBNAIL_BOX_RIGHT_TEMPLATE_ID,
  THUMBNAIL_MULTI_RIGHT_FORMAT_PROFILE_ID,
  THUMBNAIL_MULTI_RIGHT_PRIMARY_SLOT_ID,
  THUMBNAIL_MULTI_RIGHT_SECONDARY_SLOT_ID,
  THUMBNAIL_MULTI_RIGHT_TEMPLATE_ID,
  renderWithIntegrationAdapter,
  type RendererIntegrationInputV1,
  type ImagePlacementPlan,
} from "@kbr/renderer-contract";
import {
  assertDownloadAllowed,
  createKakaoBizboardRenderer,
  loadContracts,
  renderThumbnailMultiRight,
  renderThumbnailBoxRight,
  renderMaskSemicircleRight,
  renderNaverFeedCollection,
  renderSmartChannel,
  renderMetaStatic,
  renderMetaStaticPreviewArtifact,
  materializePlatformComposedProfile,
  validatePlatformComposedSource,
  type NaverFeedCollectionRenderRequest,
  type PlatformComposedSourceSpec,
  type PlatformSourceFieldRule,
  type FreeformRenderRequest,
} from "../../../../src/core/index.js";
import { verifyRuntimeAssets } from "../../../../src/core/assets.js";
import { canonicalDigest, canonicalJson } from "../../../../src/core/canonical.js";
import { sha256Bytes, sha256File } from "../../../../src/core/hash.js";
import { publishArtifacts, publishCollectionArtifacts, PublishError } from "../../../../src/core/publish.js";
import { resolveTrustedJobDirectory } from "../../../../src/core/path-security.js";
import type { KakaoBizboardInputV1, ValidationIssue } from "../../../../src/core/types.js";
import { previewMimeType, resolvePreviewEligibility } from "../../shared/src/index.js";
import type {
  AppInfo,
  DesktopCapability,
  DesktopChannelCapability,
  ExportRequest,
  ExportResult,
  NaverCatalog,
  NaverExportRequest,
  NaverExportResult,
  NaverFieldRule,
  NaverPreviewRequest,
  NaverPreviewResult,
  NaverPlatformSourceRequest,
  NaverSourceAssetRequest,
  NaverSourceProfile,
  PreviewResult,
  ProductSelectionResult,
  UiRenderInput,
} from "../../shared/src/index.js";
import { deriveNaverSmartChannelTextInputFields } from "../../shared/src/index.js";
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

function resolveProjectRelativeMaskPath(projectRoot: string): string {
  const root = path.resolve(projectRoot);
  const target = path.resolve(root, MASK_SEMICIRCLE_RIGHT_MASK_ASSET_PATH);
  const relative = path.relative(root, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("MASK asset escaped the project root");
  return target;
}

type DesktopCapabilityRegistryJson = Readonly<{
  channels?: readonly Readonly<{ id: string; label: string; placements?: readonly DesktopCapability[] }>[];
}>;

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function readDesktopCapabilityRegistry(projectRoot: string): Promise<readonly DesktopChannelCapability[]> {
  const registry = JSON.parse(await readFile(path.join(projectRoot, "contracts", "desktop-capability-registry.json"), "utf8")) as DesktopCapabilityRegistryJson;
  return (registry.channels ?? []).map((channel) => ({
    id: channel.id as DesktopChannelCapability["id"],
    label: channel.label,
    placements: channel.placements ?? [],
  }));
}

function naverFieldRuleFromCatalog(
  registry: Record<string, unknown>,
  reference: unknown,
  materialized: PlatformSourceFieldRule | undefined,
): NaverFieldRule | null {
  const catalog = asRecord(registry.fieldCatalog);
  const raw = asRecord(catalog[String(reference)]);
  if (!materialized) return null;
  return {
    ...materialized,
    ...(typeof raw.label === "string" ? { label: raw.label } : { label: materialized.id }),
    ...(typeof raw.platformGenerated === "boolean" ? { platformGenerated: raw.platformGenerated } : {}),
    ...(typeof raw.userEditable === "boolean" ? { userEditable: raw.userEditable } : {}),
    ...(typeof raw.sourceStatus === "string" ? { sourceStatus: raw.sourceStatus } : {}),
  };
}

function naverSourceProfilesFromContracts(registry: Record<string, unknown>): NaverSourceProfile[] {
  const profiles = Array.isArray(registry.profiles) ? registry.profiles : [];
  return profiles.flatMap((entry) => {
    const raw = asRecord(entry);
    if (typeof raw.id !== "string") return [];
    const materialized = materializePlatformComposedProfile(registry, raw.id);
    if (!materialized) return [];
    const fields = Array.isArray(raw.fields)
      ? raw.fields.map((reference) => naverFieldRuleFromCatalog(registry, reference, materialized.fields.find((field) => field.aliases?.includes(String(reference)) || field.id === String(reference)))).filter((field): field is NaverFieldRule => Boolean(field))
      : materialized.fields.map((field) => naverFieldRuleFromCatalog(registry, field.id, field)).filter((field): field is NaverFieldRule => Boolean(field));
    const assets = [...materialized.assets].map((asset) => ({
      id: asset.id ?? asset.assetRole,
      assetRole: asset.assetRole,
      ...(asset.required === undefined ? {} : { required: asset.required }),
      ...(asset.canvas ? { canvas: asset.canvas } : {}),
      ...(asset.mime ? { mime: asset.mime } : {}),
      ...(asset.fileSize ? { fileSize: asset.fileSize } : {}),
      ...(asset.alpha ? { alpha: asset.alpha } : {}),
      ...(asset.safeArea ? { safeArea: asset.safeArea } : {}),
    }));
    const collection = materialized.collection
      ? {
          ...(materialized.collection.minimumItems === undefined ? {} : { minimumItems: materialized.collection.minimumItems }),
          ...(materialized.collection.maximumItems === undefined ? {} : { maximumItems: materialized.collection.maximumItems }),
          itemFields: (materialized.collection.itemFields ?? []).map((field) => naverFieldRuleFromCatalog(registry, field.id, field)).filter((field): field is NaverFieldRule => Boolean(field)),
        }
      : undefined;
    return [{
      id: raw.id,
      placement: materialized.placement,
      artifactCardinality: materialized.artifactCardinality,
      ...(typeof materialized.runtimeStatus === "string" ? { runtime: materialized.runtimeStatus } : {}),
      fields,
      assets,
      ...(collection ? { collection } : {}),
    }];
  });
}

function smartChannelTemplatesFromContracts(registry: Record<string, unknown>, psdMetadata: Record<string, unknown>): NaverCatalog["templates"] {
  return (Array.isArray(registry.templates) ? registry.templates : []).flatMap((entry) => {
    const raw = asRecord(entry);
    if (typeof raw.templateId !== "string") return [];
    return [{
      templateId: raw.templateId,
      height: Number(raw.height),
      family: String(raw.family),
      objectKind: String(raw.objectKind),
      side: String(raw.side),
      textVariant: String(raw.textVariant),
      affordance: String(raw.affordance),
      objectPlacementToken: String(raw.objectPlacementToken),
      textInputFields: deriveNaverSmartChannelTextInputFields(psdMetadata, raw.templateId, String(raw.affordance)),
    }];
  });
}

function smartChannelFontInfo(policy: Record<string, unknown>): NaverCatalog["fontPreflight"] {
  const runtimeAssets = Array.isArray(policy.runtimeAssets) ? policy.runtimeAssets : [];
  return {
    configuredDirectory: null,
    requiredAssets: runtimeAssets.flatMap((entry) => {
      const raw = asRecord(entry);
      if (raw.required === false || typeof raw.id !== "string") return [];
      const relativePath = typeof raw.relativePath === "string" ? raw.relativePath : "";
      const expectedFilename = relativePath ? path.basename(relativePath) : `${raw.id}.ttf`;
      return [{
        token: raw.id,
        expectedFilename,
        expectedSha256: typeof raw.runtimeDigest === "string" ? raw.runtimeDigest : null,
        requiredPostScriptName: String(raw.runtimePostScriptName ?? raw.id),
      }];
    }),
  };
}

function mapIntegrationIssues(
  issues: readonly { code: string; severity: "ERROR" | "WARNING" | "INFO"; messageKey: string; path?: string; imageSlotId?: string; slotRole?: "IMAGE" | "LOGO"; assetId?: string; expected?: unknown; actual?: unknown }[],
): ValidationIssue[] {
  return issues.map((entry) => ({
    code: entry.code,
    severity: entry.severity,
    messageKey: entry.messageKey,
    path: entry.path ?? "/",
    ...(entry.expected !== undefined ? { expected: entry.expected } : {}),
    ...(entry.actual !== undefined ? { actual: entry.actual } : {}),
    ...(entry.imageSlotId !== undefined ? { imageSlotId: entry.imageSlotId } : {}),
    ...(entry.slotRole !== undefined ? { slotRole: entry.slotRole } : {}),
    ...(entry.assetId !== undefined ? { assetId: entry.assetId } : {}),
  }));
}

function mapNaverSourceIssues(
  issues: readonly Readonly<{ code: string; severity: "ERROR" | "WARNING" | "INFO"; messageKey: string; path: string; expected?: unknown; actual?: unknown }>[],
): ValidationIssue[] {
  return issues.map((entry) => ({
    code: entry.code,
    severity: entry.severity,
    messageKey: entry.messageKey,
    path: entry.path,
    ...(entry.expected === undefined ? {} : { expected: entry.expected }),
    ...(entry.actual === undefined ? {} : { actual: entry.actual }),
  }));
}

function naverPreviewFailure(
  request: NaverPreviewRequest,
  errors: ValidationIssue[],
  warnings: ValidationIssue[] = [],
): NaverPreviewResult {
  const isSmartChannel = request.request.kind === "SMARTCHANNEL";
  return {
    requestSequence: request.requestSequence,
    placement: isSmartChannel ? "SMARTCHANNEL" : request.request.placement,
    compositionMode: isSmartChannel ? "RENDERER_COMPOSED" : "PLATFORM_COMPOSED",
    artifactCardinality: isSmartChannel || !request.request.collectionItems ? "SINGLE" : "COLLECTION",
    previewToken: null,
    previewUrl: null,
    validationStatus: "ERROR",
    errors,
    warnings,
    normalizedPayload: null,
    requestFingerprint: null,
    collectionFingerprint: null,
    finalUiRendered: false,
    generatedAt: new Date().toISOString(),
  };
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

type FreeformProfileSummary = Readonly<{
  formatProfileId: string;
  canvas: { width: number; height: number };
}>;

async function readFreeformProfile(projectRoot: string, formatProfileId: string): Promise<FreeformProfileSummary | null> {
  try {
    const registry = JSON.parse(await readFile(path.join(projectRoot, "contracts", "freeform-format-profiles.json"), "utf8")) as {
      profiles?: readonly FreeformProfileSummary[];
    };
    return registry.profiles?.find((profile) => profile.formatProfileId === formatProfileId) ?? null;
  } catch {
    return null;
  }
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

  async selectProductFromPath(sourcePath: string, slot: "PRIMARY" | "SECONDARY" | "TERTIARY" | "LOGO" = "PRIMARY"): Promise<ProductSelectionResult> {
    try {
      const asset = await this.#session.selectProduct(sourcePath, slot);
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

  async selectSecondaryProductFromPath(sourcePath: string): Promise<ProductSelectionResult> {
    return this.selectProductFromPath(sourcePath, "SECONDARY");
  }

  async selectTertiaryProductFromPath(sourcePath: string): Promise<ProductSelectionResult> {
    return this.selectProductFromPath(sourcePath, "TERTIARY");
  }

  async selectLogoFromPath(sourcePath: string): Promise<ProductSelectionResult> {
    return this.selectProductFromPath(sourcePath, "LOGO");
  }

  async clearProduct(): Promise<void> {
    await this.#session.clearProduct();
  }

  async clearSecondaryProduct(): Promise<void> {
    await this.#session.clearProductForSlot("SECONDARY");
  }

  async clearLogo(): Promise<void> {
    await this.#session.clearProductForSlot("LOGO");
  }

  async getNaverCatalog(): Promise<NaverCatalog> {
    const [capabilities, contracts] = await Promise.all([
      readDesktopCapabilityRegistry(this.#projectRoot),
      loadContracts(this.#projectRoot),
    ]);
    const fontPreflight = smartChannelFontInfo(contracts.naverRuntimeFontPolicy);
    return {
      capabilities,
      sourceProfiles: naverSourceProfilesFromContracts(contracts.naverPlatformSourceProfiles),
      templates: smartChannelTemplatesFromContracts(contracts.naverTemplateContract, contracts.naverPsdMetadata),
      fontPreflight,
    };
  }

  #resolveNaverSourceAsset(
    request: NaverPlatformSourceRequest,
    assetToken: string,
  ): SessionAsset {
    const asset = this.#session.getAsset(assetToken);
    if (!request.assets.some((entry) => entry.assetToken === assetToken)) {
      throw new DesktopSecurityError("DESKTOP-ASSET-005", "Naver source asset token is not declared by the request");
    }
    return asset;
  }

  #sourceAssetDescriptor(
    contracts: Awaited<ReturnType<typeof loadContracts>>,
    sourceProfileId: string,
    asset: NaverSourceAssetRequest,
    sessionAsset: SessionAsset,
  ) {
    const profile = materializePlatformComposedProfile(contracts.naverPlatformSourceProfiles, sourceProfileId);
    const rule = profile?.assets.find((entry) => entry.id === asset.sourceProfileId)
      ?? profile?.assets.find((entry) => entry.assetRole === asset.assetRole);
    return {
      assetId: asset.assetId,
      assetRole: asset.assetRole,
      sourceProfileId: asset.sourceProfileId,
      mime: sessionAsset.detectedMimeType,
      width: sessionAsset.width,
      height: sessionAsset.height,
      bytes: sessionAsset.bytes,
      sha256: sessionAsset.sha256,
      hasAlpha: sessionAsset.hasAlpha,
      ...(rule?.safeArea ? { safeArea: rule.safeArea } : {}),
      pathRef: sessionAsset.relativePath,
    };
  }

  #buildNaverSourceSpec(
    request: NaverPlatformSourceRequest,
    contracts: Awaited<ReturnType<typeof loadContracts>>,
  ): { spec: Record<string, unknown>; assets: Map<string, SessionAsset> } {
    const assets = new Map<string, SessionAsset>();
    const descriptors = request.assets.map((entry) => {
      const asset = this.#resolveNaverSourceAsset(request, entry.assetToken);
      assets.set(entry.assetId, asset);
      return this.#sourceAssetDescriptor(contracts, request.sourceProfileId, entry, asset);
    });
    const spec: Record<string, unknown> = {
      schemaVersion: "1.1.0",
      channel: "NAVER_GFA",
      placement: request.placement,
      compositionMode: "PLATFORM_COMPOSED",
      artifactCardinality: request.collectionItems ? "COLLECTION" : "SINGLE",
      sourceProfileId: request.sourceProfileId,
      fields: request.fields,
      assets: descriptors,
      ...(request.collectionItems ? { metadata: { itemCount: request.collectionItems.length } } : {}),
    };
    if (request.collectionItems) {
      spec.collection = {
        ordering: "INPUT_ORDER_PRESERVED",
        items: request.collectionItems.map((item) => {
          const descriptor = request.assets.find((candidate) => candidate.assetId === item.assetId);
          if (!descriptor || descriptor.assetToken !== item.assetToken) throw new DesktopSecurityError("DESKTOP-ASSET-005", `Collection asset ${item.assetId} is not declared with the same session token`);
          const asset = this.#resolveNaverSourceAsset(request, item.assetToken);
          assets.set(item.assetId, asset);
          return {
            id: item.id,
            assetId: item.assetId,
            sourceProfileId: item.sourceProfileId,
            fields: item.fields,
          };
        }),
      };
      const metadata = asRecord(spec.metadata);
      spec.metadata = { ...metadata, itemCount: request.collectionItems.length };
    }
    return { spec, assets };
  }

  async #requestNaverSmartChannel(
    input: NaverPreviewRequest,
    request: Extract<NaverPreviewRequest["request"], { kind: "SMARTCHANNEL" }>,
  ): Promise<NaverPreviewResult> {
    const generatedAt = new Date().toISOString();
    try {
      const object = this.#session.getAsset(request.objectAssetToken);
      const logo = request.advertiserLogoAssetToken ? this.#session.getAsset(request.advertiserLogoAssetToken) : undefined;
      const coreRequest = {
        schemaVersion: "1.0.0" as const,
        channel: "NAVER_GFA" as const,
        placement: "SMARTCHANNEL" as const,
        layoutMode: "TEMPLATE_LOCKED" as const,
        compositionMode: "RENDERER_COMPOSED" as const,
        artifactCardinality: "SINGLE" as const,
        templateId: request.templateId,
        content: request.content,
        assets: {
          object: { path: object.relativePath, expectedSha256: object.sha256 },
          ...(logo ? { advertiserLogo: { path: logo.relativePath, expectedSha256: logo.sha256 } } : {}),
        },
        output: { directory: ".", baseName: request.jobName, overwrite: false },
      };
      const contracts = await loadContracts(this.#projectRoot);
      const result = await renderSmartChannel(coreRequest, {
        projectRoot: this.#projectRoot,
        inputRoot: this.#session.inputRoot,
        outputRoot: this.#session.previewRoot,
        contracts,
        publish: false,
      });
      const errors = result.errors;
      const warnings = result.warnings;
      let previewToken: string | null = null;
      let previewUrl: string | null = null;
      if (result.png) {
        const stored = await this.#session.storePreview(
          result.png,
          result.requestFingerprint ?? "",
          object.sha256,
          result.pngDigest ?? "",
          { SMARTCHANNEL_OBJECT: object.sha256 },
          { publishAllowed: errors.length === 0 },
        );
        previewToken = stored.token;
        previewUrl = `kbr-preview://preview/${stored.token}`;
      } else {
        await this.#session.invalidatePreview();
      }
      return {
        requestSequence: input.requestSequence,
        placement: "SMARTCHANNEL",
        compositionMode: "RENDERER_COMPOSED",
        artifactCardinality: "SINGLE",
        previewToken,
        previewUrl,
        validationStatus: errors.length > 0 ? "ERROR" : warnings.length > 0 ? "WARNING" : "PASS",
        errors,
        warnings,
        normalizedPayload: { ...coreRequest, assets: { object: { path: object.relativePath }, ...(logo ? { advertiserLogo: { path: logo.relativePath } } : {}) } },
        requestFingerprint: result.requestFingerprint ?? null,
        collectionFingerprint: null,
        finalUiRendered: false,
        generatedAt,
      };
    } catch (error) {
      await this.#session.invalidatePreview();
      return {
        ...naverPreviewFailure(input, [{ code: error instanceof DesktopSecurityError ? error.code : "DESKTOP-NAVER-999", severity: "ERROR", messageKey: "desktop.naver_internal_error", path: "/request", actual: error instanceof Error ? error.message : String(error) }]),
        generatedAt,
      };
    }
  }

  async #requestNaverPlatformSource(
    input: NaverPreviewRequest,
    request: Extract<NaverPreviewRequest["request"], { kind: "PLATFORM_SOURCE" }>,
  ): Promise<NaverPreviewResult> {
    try {
      const contracts = await loadContracts(this.#projectRoot);
      const built = this.#buildNaverSourceSpec(request, contracts);
      const profile = materializePlatformComposedProfile(contracts.naverPlatformSourceProfiles, request.sourceProfileId);
      if (!profile) return naverPreviewFailure(input, [{ code: "KBR-NAVER-SOURCE-PROFILE", severity: "ERROR", messageKey: "naver_source.profile", path: "/request/sourceProfileId", actual: request.sourceProfileId }]);
      if (request.collectionItems) {
        const collectionResult = await renderNaverFeedCollection(built.spec as unknown as NaverFeedCollectionRenderRequest, {
          projectRoot: this.#projectRoot,
          inputRoot: this.#session.inputRoot,
          outputRoot: this.#session.previewRoot,
          contracts,
          publish: false,
        });
        const errors = collectionResult.errors;
        const warnings = collectionResult.warnings;
        return {
          requestSequence: input.requestSequence,
          placement: request.placement,
          compositionMode: "PLATFORM_COMPOSED",
          artifactCardinality: "COLLECTION",
          previewToken: null,
          previewUrl: null,
          validationStatus: errors.length > 0 ? "ERROR" : warnings.length > 0 ? "WARNING" : "PASS",
          errors,
          warnings,
          normalizedPayload: collectionResult.manifest ? built.spec : null,
          requestFingerprint: collectionResult.requestFingerprint,
          collectionFingerprint: collectionResult.collectionFingerprint,
          finalUiRendered: false,
          generatedAt: new Date().toISOString(),
        };
      }
      const validation = validatePlatformComposedSource(built.spec as PlatformComposedSourceSpec, profile);
      const errors = mapNaverSourceIssues(validation.errors);
      const warnings = mapNaverSourceIssues(validation.warnings);
      const normalizedPayload = validation.normalized;
      const requestFingerprint = normalizedPayload ? canonicalDigest(normalizedPayload) : null;
      return {
        requestSequence: input.requestSequence,
        placement: request.placement,
        compositionMode: "PLATFORM_COMPOSED",
        artifactCardinality: request.collectionItems ? "COLLECTION" : "SINGLE",
        previewToken: null,
        previewUrl: null,
        validationStatus: errors.length > 0 ? "ERROR" : warnings.length > 0 ? "WARNING" : "PASS",
        errors,
        warnings,
        normalizedPayload,
        requestFingerprint,
        collectionFingerprint: null,
        finalUiRendered: false,
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      return naverPreviewFailure(input, [{ code: error instanceof DesktopSecurityError ? error.code : "DESKTOP-NAVER-999", severity: "ERROR", messageKey: "desktop.naver_source_internal_error", path: "/request", actual: error instanceof Error ? error.message : String(error) }]);
    }
  }

  async requestNaverPreview(input: NaverPreviewRequest): Promise<NaverPreviewResult> {
    if (input.request.kind === "SMARTCHANNEL") return this.#requestNaverSmartChannel(input, input.request);
    return this.#requestNaverPlatformSource(input, input.request);
  }

  async #exportNaverSmartChannel(
    request: NaverExportRequest,
    output: Awaited<ReturnType<DesktopSessionManager["getOutputDirectory"]>>,
  ): Promise<NaverExportResult> {
    try {
      const smart = request.request;
      if (smart.kind !== "SMARTCHANNEL") throw new DesktopSecurityError("DESKTOP-IPC-001", "SmartChannel request is required");
      const object = this.#session.getAsset(smart.objectAssetToken);
      const logo = smart.advertiserLogoAssetToken ? this.#session.getAsset(smart.advertiserLogoAssetToken) : undefined;
      const contracts = await loadContracts(this.#projectRoot);
      const coreRequest = {
        schemaVersion: "1.0.0" as const,
        channel: "NAVER_GFA" as const,
        placement: "SMARTCHANNEL" as const,
        layoutMode: "TEMPLATE_LOCKED" as const,
        compositionMode: "RENDERER_COMPOSED" as const,
        artifactCardinality: "SINGLE" as const,
        templateId: smart.templateId,
        content: smart.content,
        assets: {
          object: { path: object.relativePath, expectedSha256: object.sha256 },
          ...(logo ? { advertiserLogo: { path: logo.relativePath, expectedSha256: logo.sha256 } } : {}),
        },
        output: { directory: ".", baseName: smart.jobName, overwrite: false },
      };
      const result = await renderSmartChannel(coreRequest, {
        projectRoot: this.#projectRoot,
        inputRoot: this.#session.inputRoot,
        outputRoot: output.root,
        contracts,
        publish: true,
      });
      const requestFingerprint = result.requestFingerprint;
      if (result.errors.length > 0 || !result.downloadAllowed || !result.pngPath || !result.manifestPath || !result.pngDigest || !result.manifestDigest || !requestFingerprint) {
        return { status: "BLOCKED", code: "KBR-DOWNLOAD-001", message: "SmartChannel 최종 검증에 실패하여 Download가 차단되었습니다.", errors: result.errors, warnings: result.warnings };
      }
      if (request.previewFingerprint && requestFingerprint !== request.previewFingerprint) {
        await Promise.allSettled([rm(result.pngPath, { force: true }), rm(result.manifestPath, { force: true })]);
        return { status: "BLOCKED", code: "DESKTOP-EXPORT-003", message: "Preview와 현재 SmartChannel 입력이 일치하지 않습니다.", errors: [], warnings: result.warnings };
      }
      const exportToken = this.#session.registerExport(result.pngPath, result.manifestPath);
      return {
        status: "EXPORTED",
        exportToken,
        mode: "RENDERED",
        jobName: smart.jobName,
        manifestFileName: "render-manifest.json",
        artifactFileNames: ["output.png", "render-manifest.json"],
        pngDigest: result.pngDigest,
        manifestDigest: result.manifestDigest,
        requestFingerprint,
        warnings: result.warnings,
      };
    } catch (error) {
      return { status: "ERROR", code: error instanceof DesktopSecurityError ? error.code : "DESKTOP-NAVER-999", message: error instanceof Error ? error.message : "SmartChannel Export 중 오류가 발생했습니다.", errors: [], warnings: [] };
    }
  }

  #finalizeSourceSpec(
    source: Record<string, unknown>,
    fileNames: ReadonlyMap<string, string>,
  ): Record<string, unknown> {
    const assets = Array.isArray(source.assets)
      ? source.assets.map((entry) => {
          const raw = asRecord(entry);
          const assetId = String(raw.assetId ?? "");
          const fileName = fileNames.get(assetId);
          return fileName ? { ...raw, pathRef: fileName } : raw;
        })
      : [];
    return {
      ...source,
      assets,
    };
  }

  async #exportNaverSingleSource(
    request: NaverExportRequest,
    output: Awaited<ReturnType<DesktopSessionManager["getOutputDirectory"]>>,
  ): Promise<NaverExportResult> {
    try {
      const sourceRequest = request.request;
      if (sourceRequest.kind !== "PLATFORM_SOURCE" || sourceRequest.collectionItems) throw new DesktopSecurityError("DESKTOP-IPC-001", "Single platform source request is required");
      const contracts = await loadContracts(this.#projectRoot);
      const built = this.#buildNaverSourceSpec(sourceRequest, contracts);
      const profile = materializePlatformComposedProfile(contracts.naverPlatformSourceProfiles, sourceRequest.sourceProfileId);
      if (!profile) return { status: "BLOCKED", code: "KBR-NAVER-SOURCE-PROFILE", message: "Source profile을 찾을 수 없습니다.", errors: [], warnings: [] };
      const validation = validatePlatformComposedSource(built.spec as PlatformComposedSourceSpec, profile);
      const errors = mapNaverSourceIssues(validation.errors);
      const warnings = mapNaverSourceIssues(validation.warnings);
      if (!validation.normalized || errors.length > 0) return { status: "BLOCKED", code: "KBR-DOWNLOAD-001", message: "Source validation 오류로 Export가 차단되었습니다.", errors, warnings };
      const fingerprint = canonicalDigest(validation.normalized);
      if (request.previewFingerprint && request.previewFingerprint !== fingerprint) return { status: "BLOCKED", code: "DESKTOP-EXPORT-003", message: "Preview와 현재 Source 입력이 일치하지 않습니다.", errors, warnings };

      const fileNames = new Map<string, string>();
      const publishArtifacts: Array<{ fileName: string; bytes: Uint8Array }> = [];
      for (const [assetId, asset] of built.assets) {
        const extension = asset.detectedMimeType === "image/png" ? "png" : "jpg";
        const fileName = `asset-${sha256Bytes(Buffer.from(assetId, "utf8")).slice(0, 16)}.${extension}`;
        fileNames.set(assetId, fileName);
        publishArtifacts.push({ fileName, bytes: await readFile(asset.absolutePath) });
      }
      const finalSpec = this.#finalizeSourceSpec(validation.normalized as unknown as Record<string, unknown>, fileNames);
      const sourceSpecText = canonicalJson(finalSpec);
      publishArtifacts.push({ fileName: "source-spec.json", bytes: Buffer.from(sourceSpecText, "utf8") });
      const sourceManifest = {
        schemaVersion: "1.0.0",
        kind: "PLATFORM_SOURCE_MANIFEST",
        channel: "NAVER_GFA",
        placement: sourceRequest.placement,
        compositionMode: "PLATFORM_COMPOSED",
        artifactCardinality: "SINGLE",
        sourceProfileId: sourceRequest.sourceProfileId,
        requestFingerprint: fingerprint,
        sourceSpecDigest: sha256Bytes(Buffer.from(sourceSpecText, "utf8")),
        finalUiRendered: false,
        validationResult: { errorCount: 0, warningCount: warnings.length, issues: [...warnings] },
        artifactFileNames: publishArtifacts.map((entry) => entry.fileName),
      };
      const manifestText = canonicalJson(sourceManifest);
      const manifestDigest = sha256Bytes(Buffer.from(manifestText, "utf8"));
      const jobDirectory = await resolveTrustedJobDirectory(output.root, ".", sourceRequest.jobName);
      const published = await publishCollectionArtifacts({ outputRoot: output.root, jobDirectory, artifacts: publishArtifacts, manifest: manifestText, manifestFileName: "source-manifest.json", overwrite: false });
      const exportToken = this.#session.registerExport(published.artifactPaths[0] ?? published.manifestPath, published.manifestPath);
      return { status: "EXPORTED", exportToken, mode: "SOURCE", jobName: sourceRequest.jobName, manifestFileName: "source-manifest.json", artifactFileNames: [...publishArtifacts.map((entry) => entry.fileName), "source-manifest.json"], manifestDigest, requestFingerprint: fingerprint, warnings };
    } catch (error) {
      return { status: "ERROR", code: error instanceof DesktopSecurityError ? error.code : error instanceof PublishError ? error.code : "DESKTOP-NAVER-999", message: error instanceof Error ? error.message : "Source Export 중 오류가 발생했습니다.", errors: [], warnings: [] };
    }
  }

  async #exportNaverCollection(
    request: NaverExportRequest,
    output: Awaited<ReturnType<DesktopSessionManager["getOutputDirectory"]>>,
  ): Promise<NaverExportResult> {
    try {
      const sourceRequest = request.request;
      if (sourceRequest.kind !== "PLATFORM_SOURCE" || !sourceRequest.collectionItems) throw new DesktopSecurityError("DESKTOP-IPC-001", "Collection source request is required");
      const contracts = await loadContracts(this.#projectRoot);
      const built = this.#buildNaverSourceSpec(sourceRequest, contracts);
      const source = { ...built.spec, output: { directory: ".", baseName: sourceRequest.jobName, overwrite: false } } as unknown as NaverFeedCollectionRenderRequest;
      const validated = await renderNaverFeedCollection(source, { projectRoot: this.#projectRoot, inputRoot: this.#session.inputRoot, outputRoot: output.root, contracts, publish: false });
      if (validated.errors.length > 0 || !validated.manifest || !validated.requestFingerprint) {
        return { status: "BLOCKED", code: "KBR-DOWNLOAD-001", message: "Collection item validation 오류로 전체 Export가 차단되었습니다.", errors: validated.errors, warnings: validated.warnings };
      }
      if (request.previewFingerprint && request.previewFingerprint !== validated.requestFingerprint) return { status: "BLOCKED", code: "DESKTOP-EXPORT-003", message: "Preview와 현재 Collection 순서/입력이 일치하지 않습니다.", errors: [], warnings: validated.warnings };

      const published = await renderNaverFeedCollection(source, { projectRoot: this.#projectRoot, inputRoot: this.#session.inputRoot, outputRoot: output.root, contracts, publish: true });
      const firstArtifactPath = published.artifactPaths[0];
      if (published.errors.length > 0 || !published.downloadAllowed || !published.manifestPath || !published.manifestDigest || !firstArtifactPath || !published.requestFingerprint) {
        return { status: "BLOCKED", code: "KBR-DOWNLOAD-001", message: "Collection atomic publish가 완료되지 않아 Export가 차단되었습니다.", errors: published.errors, warnings: published.warnings };
      }
      const exportToken = this.#session.registerExport(firstArtifactPath, published.manifestPath);
      return {
        status: "EXPORTED",
        exportToken,
        mode: "COLLECTION",
        jobName: sourceRequest.jobName,
        manifestFileName: "collection-manifest.json",
        artifactFileNames: [...published.artifactPaths.map((entry) => path.basename(entry)), "collection-manifest.json"],
        manifestDigest: published.manifestDigest,
        requestFingerprint: published.requestFingerprint,
        ...(published.collectionFingerprint ? { collectionFingerprint: published.collectionFingerprint } : {}),
        warnings: published.warnings,
      };
    } catch (error) {
      return { status: "ERROR", code: error instanceof DesktopSecurityError ? error.code : error instanceof PublishError ? error.code : "DESKTOP-NAVER-999", message: error instanceof Error ? error.message : "Collection Export 중 오류가 발생했습니다.", errors: [], warnings: [] };
    }
  }

  async exportNaver(request: NaverExportRequest): Promise<NaverExportResult> {
    try {
      const output = this.#session.getOutputDirectory(request.outputDirectoryToken);
      if (request.request.kind === "SMARTCHANNEL") return this.#exportNaverSmartChannel(request, output);
      if (request.request.collectionItems) return this.#exportNaverCollection(request, output);
      return this.#exportNaverSingleSource(request, output);
    } catch (error) {
      return { status: "ERROR", code: error instanceof DesktopSecurityError ? error.code : "DESKTOP-NAVER-999", message: error instanceof Error ? error.message : "Naver Export 중 오류가 발생했습니다.", errors: [], warnings: [] };
    }
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

  #buildThumbnailMultiIntegrationInput(
    input: Omit<UiRenderInput, "requestSequence">,
    slotAssets: ReadonlyMap<string, SessionAsset>,
  ): RendererIntegrationInputV1 {
    const defaultPlan = (imageSlotId: string, assetId: string): ImagePlacementPlan => ({
      schemaVersion: INTEGRATION_SCHEMA_VERSION,
      imageSlotId,
      assetId,
      policy: "SEMANTIC_CROP_COVER",
      source: "AGENT",
      fitMode: "COVER",
      cropRect: { x: 0, y: 0, width: 1, height: 1 },
      anchor: "CENTER",
      subjectProtection: "NONE",
    });
    const plans = input.placementPlans?.length === 2
      ? [...input.placementPlans]
      : [
          input.placementPlan ?? defaultPlan(THUMBNAIL_MULTI_RIGHT_PRIMARY_SLOT_ID, "selected-primary"),
          defaultPlan(THUMBNAIL_MULTI_RIGHT_SECONDARY_SLOT_ID, "selected-secondary"),
        ];
    const assetIds = new Set(plans.map((plan) => plan.assetId));
    const assets = [...assetIds].flatMap((assetId) => {
      const plan = plans.find((candidate) => candidate.assetId === assetId);
      const slotAsset = plan ? slotAssets.get(plan.imageSlotId) : undefined;
      if (!slotAsset) return [];
      return [{
        assetId,
        mimeType: slotAsset.detectedMimeType,
        declaredWidth: slotAsset.width,
        declaredHeight: slotAsset.height,
        checksumSha256: slotAsset.sha256,
        assetRef: { type: "DESKTOP_ASSET_TOKEN" as const, value: slotAsset.token },
      }];
    });
    return {
      schemaVersion: INTEGRATION_SCHEMA_VERSION,
      formatProfileId: THUMBNAIL_MULTI_RIGHT_FORMAT_PROFILE_ID,
      templateId: THUMBNAIL_MULTI_RIGHT_TEMPLATE_ID,
      copy: {
        advertiser: input.advertiser,
        headline: input.headline,
        subcopy: input.subcopy,
        cta: "NONE",
      },
      assets,
      imagePlacementPlans: plans,
      ...(input.cropCandidates && input.cropCandidates.length > 0 ? { cropCandidates: input.cropCandidates } : {}),
      output: { mimeType: "image/png" },
    };
  }

  #buildMaskIntegrationInput(
    input: Omit<UiRenderInput, "requestSequence">,
    imageAsset: SessionAsset,
    logoAsset?: SessionAsset,
  ): RendererIntegrationInputV1 {
    const imagePlan: ImagePlacementPlan = input.placementPlans?.find((plan) => plan.imageSlotId === MASK_SEMICIRCLE_RIGHT_IMAGE_SLOT_ID)
      ?? input.placementPlan
      ?? {
        schemaVersion: INTEGRATION_SCHEMA_VERSION,
        imageSlotId: MASK_SEMICIRCLE_RIGHT_IMAGE_SLOT_ID,
        assetId: "selected-image",
        policy: "MANUAL_CROP",
        source: "MANUAL",
        fitMode: "COVER",
        cropRect: { x: 0, y: 0, width: 1, height: 1 },
        anchor: "CENTER",
        subjectProtection: "NONE",
      };
    const explicitLogoPlan = input.placementPlans?.find((plan) => plan.imageSlotId === MASK_SEMICIRCLE_RIGHT_LOGO_SLOT_ID);
    const logoPlan: ImagePlacementPlan | undefined = explicitLogoPlan ?? (logoAsset ? {
      schemaVersion: INTEGRATION_SCHEMA_VERSION,
      imageSlotId: MASK_SEMICIRCLE_RIGHT_LOGO_SLOT_ID,
      assetId: "selected-logo",
      policy: "ALPHA_TRIM_CONTAIN",
      source: "DETERMINISTIC",
      fitMode: "CONTAIN",
      anchor: "CENTER",
      subjectProtection: "NONE",
    } : undefined);
    const assets: Array<RendererIntegrationInputV1["assets"][number]> = [{
      assetId: imagePlan.assetId,
      mimeType: imageAsset.detectedMimeType,
      declaredWidth: imageAsset.width,
      declaredHeight: imageAsset.height,
      checksumSha256: imageAsset.sha256,
      assetRef: { type: "DESKTOP_ASSET_TOKEN", value: imageAsset.token },
    }];
    if (logoAsset && logoPlan) assets.push({
      assetId: logoPlan.assetId,
      mimeType: logoAsset.detectedMimeType,
      declaredWidth: logoAsset.width,
      declaredHeight: logoAsset.height,
      checksumSha256: logoAsset.sha256,
      assetRef: { type: "DESKTOP_ASSET_TOKEN", value: logoAsset.token },
    });
    return {
      schemaVersion: INTEGRATION_SCHEMA_VERSION,
      formatProfileId: MASK_SEMICIRCLE_RIGHT_FORMAT_PROFILE_ID,
      templateId: MASK_SEMICIRCLE_RIGHT_TEMPLATE_ID,
      copy: { advertiser: input.advertiser, headline: input.headline, subcopy: input.subcopy, cta: "NONE" },
      assets,
      imagePlacementPlans: [imagePlan, ...(logoPlan ? [logoPlan] : [])],
      output: { mimeType: "image/png" },
    };
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
        renderedBytes = Buffer.from(rendered.bytes);
        return rendered;
      },
      assetDigests: { [integrationAsset.assetId]: asset.sha256 },
    });
    return { integrationInput, result, bytes: renderedBytes };
  }

  async #renderThumbnailMultiIntegration(input: Omit<UiRenderInput, "requestSequence">, slotAssets: ReadonlyMap<string, SessionAsset>): Promise<{
    integrationInput: RendererIntegrationInputV1;
    result: Awaited<ReturnType<typeof renderWithIntegrationAdapter>>;
    bytes: Buffer | null;
  }> {
    const integrationInput = this.#buildThumbnailMultiIntegrationInput(input, slotAssets);
    let renderedBytes: Buffer | null = null;
    const runtimeContracts = await loadContracts(this.#projectRoot);
    const runtimeAssets = await verifyRuntimeAssets(this.#projectRoot, runtimeContracts);
    if (runtimeAssets.issues.some((entry) => entry.severity === "ERROR") || !runtimeAssets.assets) throw new Error("Pinned runtime fonts or reference fixture are unavailable");
    const resolvedByToken = new Map<string, Buffer>();
    const result = await renderWithIntegrationAdapter(integrationInput, {
      resolver: {
        resolve: async (assetRef) => {
          if (assetRef.type !== "DESKTOP_ASSET_TOKEN") throw new Error("Desktop asset reference type is invalid");
          const asset = [...slotAssets.values()].find((entry) => entry.token === assetRef.value);
          if (!asset) throw new Error("Desktop asset token is stale or invalid");
          const existing = resolvedByToken.get(asset.token);
          const bytes = existing ?? await readFile(asset.absolutePath);
          resolvedByToken.set(asset.token, bytes);
          return {
            bytes,
            resolvedMimeType: asset.detectedMimeType,
            metadata: { detectedMimeType: asset.detectedMimeType, width: asset.width, height: asset.height, hasAlpha: asset.hasAlpha, exifOrientation: asset.exifOrientation },
          };
        },
      },
      renderThumbnailMulti: async (request) => {
        const rendered = await renderThumbnailMultiRight(request);
        renderedBytes = Buffer.from(rendered.bytes);
        return rendered;
      },
      assetDigests: Object.fromEntries([...slotAssets.values()].map((asset) => [asset.token, asset.sha256])),
    });
    return { integrationInput, result, bytes: renderedBytes };
  }

  async #renderMaskIntegration(input: Omit<UiRenderInput, "requestSequence">, imageAsset: SessionAsset, logoAsset?: SessionAsset): Promise<{
    integrationInput: RendererIntegrationInputV1;
    result: Awaited<ReturnType<typeof renderWithIntegrationAdapter>>;
    bytes: Buffer | null;
  }> {
    const integrationInput = this.#buildMaskIntegrationInput(input, imageAsset, logoAsset);
    const runtimeContracts = await loadContracts(this.#projectRoot);
    const runtimeAssets = await verifyRuntimeAssets(this.#projectRoot, runtimeContracts);
    if (runtimeAssets.issues.some((entry) => entry.severity === "ERROR") || !runtimeAssets.assets) {
      throw new Error("Pinned runtime fonts or reference fixture are unavailable");
    }
    const maskPath = resolveProjectRelativeMaskPath(this.#projectRoot);
    let maskAsset: { assetId: typeof MASK_SEMICIRCLE_RIGHT_MASK_ASSET_ID; bytes: Buffer; sha256: string } | undefined;
    try {
      const maskBytes = await readFile(maskPath);
      maskAsset = { assetId: MASK_SEMICIRCLE_RIGHT_MASK_ASSET_ID, bytes: maskBytes, sha256: sha256Bytes(maskBytes) };
    } catch {
      // Let the integration adapter emit the deterministic KBR-MASK-ASSET-MISSING issue.
      maskAsset = undefined;
    }
    let renderedBytes: Buffer | null = null;
    const tokenAssets = new Map<string, SessionAsset>([[imageAsset.token, imageAsset]]);
    if (logoAsset) tokenAssets.set(logoAsset.token, logoAsset);
    const result = await renderWithIntegrationAdapter(integrationInput, {
      resolver: {
        resolve: async (assetRef) => {
          if (assetRef.type !== "DESKTOP_ASSET_TOKEN") throw new Error("Desktop asset reference type is invalid");
          const asset = tokenAssets.get(assetRef.value);
          if (!asset) throw new Error("Desktop asset token is stale or invalid");
          const bytes = await readFile(asset.absolutePath);
          return {
            bytes,
            resolvedMimeType: asset.detectedMimeType,
            metadata: { detectedMimeType: asset.detectedMimeType, width: asset.width, height: asset.height, hasAlpha: asset.hasAlpha, exifOrientation: asset.exifOrientation },
          };
        },
      },
      ...(maskAsset ? { maskAsset } : {}),
      renderMaskSemicircle: async (request) => {
        const rendered = await renderMaskSemicircleRight(request);
        renderedBytes = Buffer.from(rendered.bytes);
        return rendered;
      },
      assetDigests: Object.fromEntries([...tokenAssets.values()].map((asset) => [asset.token, asset.sha256])),
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

  async #thumbnailMultiPreview(input: UiRenderInput, primaryAsset: SessionAsset): Promise<PreviewResult> {
    const generatedAt = new Date().toISOString();
    try {
      const slotAssets = new Map<string, SessionAsset>([[THUMBNAIL_MULTI_RIGHT_PRIMARY_SLOT_ID, primaryAsset]]);
      if (input.secondaryAssetToken) {
        slotAssets.set(THUMBNAIL_MULTI_RIGHT_SECONDARY_SLOT_ID, this.#session.getAsset(input.secondaryAssetToken));
      }
      const { result, bytes } = await this.#renderThumbnailMultiIntegration(input, slotAssets);
      const errors = mapIntegrationIssues(result.validation.errors);
      const warnings = mapIntegrationIssues(result.validation.warnings);
      const artifact = result.artifact;
      const digestBySlot = Object.fromEntries([...slotAssets.entries()].map(([slot, asset]) => [slot, asset.sha256]));
      if (result.status !== "PASS" || !artifact || !bytes) {
        await this.#session.invalidatePreview();
        return {
          requestSequence: input.requestSequence,
          previewToken: null,
          previewUrl: null,
          canonicalInputDigest: result.requestFingerprint,
          productAssetDigest: primaryAsset.sha256,
          productAssetDigests: digestBySlot,
          previewPngDigest: null,
          pngMetadata: null,
          measurements: null,
          validationStatus: "ERROR",
          errors,
          warnings,
          generatedAt,
          template: "THUMBNAIL_MULTI_RIGHT",
          appliedImagePlacement: null,
          appliedImagePlacements: [],
        };
      }
      const stored = await this.#session.storePreview(bytes, result.requestFingerprint, primaryAsset.sha256, artifact.checksumSha256, digestBySlot);
      return {
        requestSequence: input.requestSequence,
        previewToken: stored.token,
        previewUrl: `kbr-preview://preview/${stored.token}`,
        canonicalInputDigest: result.requestFingerprint,
        productAssetDigest: primaryAsset.sha256,
        productAssetDigests: digestBySlot,
        previewPngDigest: artifact.checksumSha256,
        pngMetadata: { format: "PNG", colorType: "RGBA", bitDepth: 8, hasAlpha: true, width: 1029, height: 258, bytes: artifact.bytes },
        measurements: null,
        validationStatus: warnings.length > 0 ? "WARNING" : "PASS",
        errors,
        warnings,
        generatedAt,
        template: "THUMBNAIL_MULTI_RIGHT",
        appliedImagePlacement: result.appliedImagePlacements[0] ?? null,
        appliedImagePlacements: result.appliedImagePlacements,
      };
    } catch {
      await this.#session.invalidatePreview();
      return {
        requestSequence: input.requestSequence,
        previewToken: null,
        previewUrl: null,
        canonicalInputDigest: null,
        productAssetDigest: null,
        productAssetDigests: {},
        previewPngDigest: null,
        pngMetadata: null,
        measurements: null,
        validationStatus: "ERROR",
        errors: [],
        warnings: [],
        generatedAt,
        template: "THUMBNAIL_MULTI_RIGHT",
        appliedImagePlacement: null,
        appliedImagePlacements: [],
      };
    }
  }

  async #maskPreview(input: UiRenderInput, imageAsset: SessionAsset, logoAsset?: SessionAsset): Promise<PreviewResult> {
    const generatedAt = new Date().toISOString();
    try {
      const { result, bytes } = await this.#renderMaskIntegration(input, imageAsset, logoAsset);
      const errors = mapIntegrationIssues(result.validation.errors);
      const warnings = mapIntegrationIssues(result.validation.warnings);
      const artifact = result.artifact;
      const assetDigests = { IMAGE_PRIMARY: imageAsset.sha256, ...(logoAsset ? { LOGO_PRIMARY: logoAsset.sha256 } : {}) };
      if (result.status !== "PASS" || !artifact || !bytes) {
        await this.#session.invalidatePreview();
        return { requestSequence: input.requestSequence, previewToken: null, previewUrl: null, canonicalInputDigest: result.requestFingerprint, productAssetDigest: imageAsset.sha256, logoAssetDigest: logoAsset?.sha256 ?? null, productAssetDigests: assetDigests, previewPngDigest: null, pngMetadata: null, measurements: null, validationStatus: "ERROR", errors, warnings, generatedAt, template: "MASK_SEMICIRCLE_RIGHT", appliedImagePlacement: null, appliedImagePlacements: [] };
      }
      const stored = await this.#session.storePreview(bytes, result.requestFingerprint, imageAsset.sha256, artifact.checksumSha256, assetDigests);
      return { requestSequence: input.requestSequence, previewToken: stored.token, previewUrl: `kbr-preview://preview/${stored.token}`, canonicalInputDigest: result.requestFingerprint, productAssetDigest: imageAsset.sha256, logoAssetDigest: logoAsset?.sha256 ?? null, productAssetDigests: assetDigests, previewPngDigest: artifact.checksumSha256, pngMetadata: { format: "PNG", colorType: "RGBA", bitDepth: 8, hasAlpha: true, width: 1029, height: 258, bytes: artifact.bytes }, measurements: null, validationStatus: warnings.length > 0 ? "WARNING" : "PASS", errors, warnings, generatedAt, template: "MASK_SEMICIRCLE_RIGHT", appliedImagePlacement: result.appliedImagePlacements[0] ?? null, appliedImagePlacements: result.appliedImagePlacements };
    } catch {
      await this.#session.invalidatePreview();
      return { requestSequence: input.requestSequence, previewToken: null, previewUrl: null, canonicalInputDigest: null, productAssetDigest: imageAsset.sha256, logoAssetDigest: logoAsset?.sha256 ?? null, productAssetDigests: { IMAGE_PRIMARY: imageAsset.sha256, ...(logoAsset ? { LOGO_PRIMARY: logoAsset.sha256 } : {}) }, previewPngDigest: null, pngMetadata: null, measurements: null, validationStatus: "ERROR", errors: [], warnings: [], generatedAt, template: "MASK_SEMICIRCLE_RIGHT", appliedImagePlacement: null, appliedImagePlacements: [] };
    }
  }

  async #buildFreeformRequest(
    input: UiRenderInput | ExportRequest,
    options: { outputRoot?: string; publish?: boolean } = {},
  ): Promise<{ request: FreeformRenderRequest; assets: ReadonlyMap<string, SessionAsset>; profile: FreeformProfileSummary | null }> {
    const freeform = input.freeform;
    if (!freeform) throw new DesktopSecurityError("DESKTOP-IPC-001", "FREEFORM payload is required");
    const assets = new Map<string, SessionAsset>();
    for (const [assetId, token] of Object.entries(freeform.assetTokens)) {
      if (assets.has(assetId)) continue;
      assets.set(assetId, this.#session.getAsset(token));
    }
    const output: NonNullable<FreeformRenderRequest["output"]> = {
      format: freeform.outputFormat,
      mimeType: freeform.outputFormat === "JPEG" ? "image/jpeg" : "image/png",
      ...(freeform.outputQuality !== undefined ? { quality: freeform.outputQuality } : {}),
      ...(options.publish ? { directory: ".", baseName: input.jobName, overwrite: false } : {}),
    };
    const request: FreeformRenderRequest = {
      layoutMode: "FREEFORM",
      formatProfileId: freeform.formatProfileId,
      creativeLayoutPlan: freeform.creativeLayoutPlan,
      assets: [...assets.entries()].map(([assetId, asset]) => ({
        assetId,
        path: asset.relativePath,
        mimeType: asset.detectedMimeType,
        checksumSha256: asset.sha256,
      })),
      output,
      provenance: { source: "DESKTOP_RENDERER_LAB", ...(freeform.metaStatic || freeform.outputMode ? { metaStaticMode: freeform.outputMode ?? "SINGLE" } : {}) },
      ...(freeform.metaStatic || freeform.outputMode ? {
        metaStatic: {
          ...(freeform.outputMode ? { mode: freeform.outputMode } : {}),
          ...(freeform.metaStatic?.placementContext ? { placementContext: freeform.metaStatic.placementContext } : {}),
          ...(freeform.metaStatic?.conceptId ? { conceptId: freeform.metaStatic.conceptId } : {}),
          ...(freeform.metaStatic?.platformCopy ? { platformCopy: freeform.metaStatic.platformCopy } : {}),
          ...(freeform.metaStatic?.variants ? { variants: freeform.metaStatic.variants } : {}),
        },
      } : {}),
    };
    return {
      request,
      assets,
      profile: await readFreeformProfile(this.#projectRoot, freeform.formatProfileId),
    };
  }

  #freeformPreviewMetadata(
    format: "PNG" | "JPEG",
    bytes: number,
    profile: FreeformProfileSummary | null,
  ): NonNullable<PreviewResult["pngMetadata"]> {
    return {
      format,
      colorType: format === "PNG" ? "RGBA" : "RGB",
      bitDepth: 8,
      hasAlpha: format === "PNG",
      width: profile?.canvas.width ?? 0,
      height: profile?.canvas.height ?? 0,
      bytes,
    };
  }

  async #freeformPreview(input: UiRenderInput): Promise<PreviewResult> {
    const generatedAt = new Date().toISOString();
    const empty = (details: {
      errors?: ValidationIssue[];
      warnings?: ValidationIssue[];
      formatProfileId?: string | null;
      artifactFormat?: "PNG" | "JPEG" | null;
      requestFingerprint?: string | null;
      profile?: FreeformProfileSummary | null;
    } = {}): PreviewResult => {
      const errors = details.errors ?? [];
      return {
        requestSequence: input.requestSequence,
        previewToken: null,
        previewUrl: null,
        canonicalInputDigest: details.requestFingerprint ?? null,
        productAssetDigest: null,
        previewPngDigest: null,
        pngMetadata: null,
        measurements: null,
        validationStatus: "ERROR",
        errors,
        warnings: details.warnings ?? [],
        generatedAt,
        formatProfileId: details.formatProfileId ?? input.freeform?.formatProfileId ?? null,
        artifactFormat: details.artifactFormat ?? input.freeform?.outputFormat ?? null,
        artifactDigest: null,
        outputEncoding: null,
        appliedElements: [],
        previewArtifact: null,
        eligibility: resolvePreviewEligibility(errors, false),
      };
    };
    try {
      const built = await this.#buildFreeformRequest(input);
      const result = await renderMetaStaticPreviewArtifact(built.request, {
        projectRoot: this.#projectRoot,
        inputRoot: this.#session.inputRoot,
        outputRoot: this.#session.previewRoot,
        publish: false,
      });
      const assetDigests = Object.fromEntries([...built.assets.entries()].map(([assetId, asset]) => [assetId, asset.sha256]));
      const primaryAsset = [...built.assets.values()][0];
      const encodingFormat = result.outputEncoding?.format === "JPEG"
        ? "JPEG"
        : result.outputEncoding?.format === "PNG"
          ? "PNG"
          : result.artifactFormat;
      const hasRenderableArtifact = Boolean(result.png && result.requestFingerprint && result.artifactDigest && encodingFormat);
      const eligibility = resolvePreviewEligibility(result.errors, hasRenderableArtifact);
      if (!eligibility.previewAllowed || !result.png || !result.requestFingerprint || !result.artifactDigest || !encodingFormat) {
        await this.#session.invalidatePreview();
        return empty({
          errors: result.errors,
          warnings: result.warnings,
          formatProfileId: result.formatProfileId,
          artifactFormat: result.artifactFormat,
          requestFingerprint: result.requestFingerprint,
          profile: built.profile,
        });
      }
      const stored = await this.#session.storePreview(
        result.png,
        result.requestFingerprint,
        primaryAsset?.sha256 ?? sha256Bytes(Buffer.alloc(0)),
        result.artifactDigest,
        assetDigests,
        { format: encodingFormat, publishAllowed: eligibility.publishAllowed },
      );
      const mimeType = previewMimeType(encodingFormat);
      return {
        requestSequence: input.requestSequence,
        previewToken: stored.token,
        previewUrl: `kbr-preview://preview/${stored.token}`,
        canonicalInputDigest: result.requestFingerprint,
        productAssetDigest: primaryAsset?.sha256 ?? null,
        previewPngDigest: result.artifactDigest,
        pngMetadata: this.#freeformPreviewMetadata(encodingFormat, result.png.byteLength, built.profile),
        measurements: null,
        validationStatus: result.errors.length > 0 ? "ERROR" : result.warnings.length > 0 ? "WARNING" : "PASS",
        errors: result.errors,
        warnings: result.warnings,
        generatedAt,
        formatProfileId: result.formatProfileId,
        artifactFormat: encodingFormat,
        artifactDigest: result.artifactDigest,
        outputEncoding: result.outputEncoding,
        appliedElements: result.appliedElements,
        productAssetDigests: assetDigests,
        ...(("mode" in result && result.mode === "PLACEMENT_SET") ? {
          collectionFingerprint: result.collectionFingerprint,
          collectionManifestPath: result.collectionManifestPath,
          collectionArtifactPaths: result.collectionArtifactPaths,
          collectionArtifactFileNames: result.collectionArtifacts.map((artifact) => artifact.fileName),
        } : {}),
        previewArtifact: {
          format: encodingFormat,
          mimeType,
          width: built.profile?.canvas.width ?? 0,
          height: built.profile?.canvas.height ?? 0,
          byteLength: result.png.byteLength,
          artifactDigest: result.artifactDigest,
        },
        eligibility,
      };
    } catch (error) {
      await this.#session.invalidatePreview();
      return empty({ errors: [{ code: error instanceof DesktopSecurityError ? error.code : "DESKTOP-FREEFORM-999", severity: "ERROR", messageKey: "desktop.freeform_internal_error", path: "/freeform", actual: error instanceof Error ? error.message : String(error) }] });
    }
  }

  async #exportFreeform(
    request: ExportRequest,
    previewRecord: Awaited<ReturnType<DesktopSessionManager["getPreview"]>>,
    output: Awaited<ReturnType<DesktopSessionManager["getOutputDirectory"]>>,
  ): Promise<ExportResult> {
    let artifactPath: string | null = null;
    let manifestPath: string | null = null;
    try {
      if (!previewRecord.publishAllowed) {
        return desktopFailure("BLOCKED", "KBR-DOWNLOAD-001", "Preview Artifact가 최종 매체 규격을 통과하지 못해 Export가 차단되었습니다.");
      }
      const built = await this.#buildFreeformRequest(request, { outputRoot: output.root, publish: true });
      const expectedDigests = previewRecord.assetDigests ?? {};
      for (const [assetId, asset] of built.assets) {
        const currentDigest = await sha256File(asset.absolutePath);
        if (currentDigest !== asset.sha256 || (expectedDigests[assetId] !== undefined && expectedDigests[assetId] !== currentDigest)) {
          return desktopFailure("BLOCKED", "DESKTOP-EXPORT-002", `${assetId} Asset이 Preview 이후 변경되었습니다.`);
        }
      }
      const result = await renderMetaStatic(built.request, {
        projectRoot: this.#projectRoot,
        inputRoot: this.#session.inputRoot,
        outputRoot: output.root,
        publish: true,
      });
      if ("mode" in result && result.mode === "PLACEMENT_SET") {
        if (result.status !== "PASS" || !result.downloadAllowed || !result.collectionManifestPath || result.collectionArtifactPaths.length !== 3 || result.errors.length > 0) {
          return desktopFailure("BLOCKED", "KBR-DOWNLOAD-001", "META placement set 최종 재검증에 실패하여 Export가 차단되었습니다.", result.errors, result.warnings);
        }
        if (result.requestFingerprint !== previewRecord.inputDigest || result.pngDigest !== previewRecord.pngDigest) {
          await Promise.allSettled([
            ...result.collectionArtifactPaths.map((filePath) => rm(filePath, { force: true })),
            rm(result.collectionManifestPath, { force: true }),
          ]);
          return desktopFailure("BLOCKED", "DESKTOP-EXPORT-003", "Preview가 현재 META placement set 입력과 일치하지 않습니다.", result.errors, result.warnings);
        }
        const artifactStats = await Promise.all(result.collectionArtifactPaths.map(async (filePath) => ({ path: filePath, digest: await sha256File(filePath), bytes: (await stat(filePath)).size })));
        const manifestDigest = await sha256File(result.collectionManifestPath);
        const expected = result.collectionArtifacts;
        const firstArtifact = artifactStats[0];
        if (!firstArtifact) return desktopFailure("ERROR", "DESKTOP-EXPORT-004", "META placement set 첫 산출물이 없습니다.", result.errors, result.warnings);
        if (artifactStats.some((item, index) => item.digest !== expected[index]?.sha256) || manifestDigest !== result.manifestDigest) {
          await Promise.allSettled([...result.collectionArtifactPaths.map((filePath) => rm(filePath, { force: true })), rm(result.collectionManifestPath, { force: true })]);
          return desktopFailure("ERROR", "DESKTOP-EXPORT-004", "META placement set 저장 digest 검증에 실패했습니다.", result.errors, result.warnings);
        }
        const exportToken = this.#session.registerExport(firstArtifact.path, result.collectionManifestPath);
        return {
          status: "EXPORTED",
          exportToken,
          jobName: request.jobName,
          pngFileName: path.basename(firstArtifact.path),
          manifestFileName: path.basename(result.collectionManifestPath),
          pngDigest: firstArtifact.digest,
          manifestDigest,
          bytes: artifactStats.reduce((sum, item) => sum + item.bytes, 0),
          warnings: result.warnings,
          artifactFileName: path.basename(firstArtifact.path),
          artifactFormat: result.artifactFormat ?? "PNG",
          artifactDigest: firstArtifact.digest,
          ...(result.collectionFingerprint ? { collectionFingerprint: result.collectionFingerprint } : {}),
          collectionManifestFileName: path.basename(result.collectionManifestPath),
          artifactFileNames: artifactStats.map((item) => path.basename(item.path)),
        };
      }
      const errors = result.errors;
      const warnings = result.warnings;
      if (result.status !== "PASS" || !result.downloadAllowed || !result.artifactPath || !result.manifestPath || !result.artifactDigest || !result.manifestDigest || errors.length > 0) {
        return desktopFailure("BLOCKED", "KBR-DOWNLOAD-001", "최종 재검증에 실패하여 Export가 차단되었습니다.", errors, warnings);
      }
      artifactPath = result.artifactPath;
      manifestPath = result.manifestPath;
      if (result.requestFingerprint !== previewRecord.inputDigest || result.artifactDigest !== previewRecord.pngDigest) {
        await Promise.allSettled([rm(artifactPath, { force: true }), rm(manifestPath, { force: true })]);
        return desktopFailure("BLOCKED", "DESKTOP-EXPORT-003", "Preview가 현재 입력과 일치하지 않습니다.", errors, warnings);
      }
      const [actualArtifactDigest, actualManifestDigest, artifactStat] = await Promise.all([
        sha256File(artifactPath),
        sha256File(manifestPath),
        stat(artifactPath),
      ]);
      if (actualArtifactDigest !== result.artifactDigest || actualManifestDigest !== result.manifestDigest) {
        await Promise.allSettled([rm(artifactPath, { force: true }), rm(manifestPath, { force: true })]);
        return desktopFailure("ERROR", "DESKTOP-EXPORT-004", "저장된 산출물 digest 검증에 실패했습니다.", errors, warnings);
      }
      const exportToken = this.#session.registerExport(artifactPath, manifestPath);
      const artifactFileName = path.basename(artifactPath);
      return {
        status: "EXPORTED",
        exportToken,
        jobName: request.jobName,
        pngFileName: artifactFileName,
        manifestFileName: "render-manifest.json",
        pngDigest: actualArtifactDigest,
        manifestDigest: actualManifestDigest,
        bytes: artifactStat.size,
        warnings,
        artifactFileName,
        artifactFormat: result.artifactFormat ?? "PNG",
        artifactDigest: actualArtifactDigest,
      };
    } catch (error) {
      if (artifactPath || manifestPath) {
        await Promise.allSettled([
          artifactPath ? rm(artifactPath, { force: true }) : Promise.resolve(),
          manifestPath ? rm(manifestPath, { force: true }) : Promise.resolve(),
        ]);
      }
      return desktopFailure(
        "ERROR",
        error instanceof DesktopSecurityError ? error.code : "DESKTOP-EXPORT-999",
        error instanceof Error ? error.message : "FREEFORM Export 중 내부 오류가 발생했습니다.",
      );
    }
  }


  async requestPreview(input: UiRenderInput): Promise<PreviewResult> {
    const generatedAt = new Date().toISOString();
    try {
      if (input.layoutMode === "FREEFORM" || input.freeform) return this.#freeformPreview(input);
      const asset = this.#session.getAsset(input.assetToken);
      if (input.template === "THUMBNAIL_BOX_RIGHT") return this.#thumbnailPreview(input, asset);
      if (input.template === "THUMBNAIL_MULTI_RIGHT") return this.#thumbnailMultiPreview(input, asset);
      if (input.template === "MASK_SEMICIRCLE_RIGHT") {
        const logo = input.logoAssetToken ? this.#session.getAsset(input.logoAssetToken) : undefined;
        return this.#maskPreview(input, asset, logo);
      }
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
        templateContractVersion: "1.9.0",
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

  async #exportThumbnailMulti(
    request: ExportRequest,
    primaryAsset: SessionAsset,
    previewRecord: Awaited<ReturnType<DesktopSessionManager["getPreview"]>>,
    output: Awaited<ReturnType<DesktopSessionManager["getOutputDirectory"]>>,
  ): Promise<ExportResult> {
    let publishedPng: string | null = null;
    let publishedManifest: string | null = null;
    try {
      const slotAssets = new Map<string, SessionAsset>([[THUMBNAIL_MULTI_RIGHT_PRIMARY_SLOT_ID, primaryAsset]]);
      if (request.secondaryAssetToken) slotAssets.set(THUMBNAIL_MULTI_RIGHT_SECONDARY_SLOT_ID, this.#session.getAsset(request.secondaryAssetToken));
      const currentDigests = new Map<string, string>();
      for (const asset of new Set(slotAssets.values())) currentDigests.set(asset.token, await sha256File(asset.absolutePath));
      const expectedDigests = previewRecord.assetDigests ?? { [THUMBNAIL_MULTI_RIGHT_PRIMARY_SLOT_ID]: previewRecord.assetDigest };
      for (const [slot, asset] of slotAssets) {
        const current = currentDigests.get(asset.token);
        if (!current || current !== asset.sha256 || (expectedDigests[slot] && expectedDigests[slot] !== current)) return desktopFailure("BLOCKED", "DESKTOP-EXPORT-002", `${slot} Asset이 Preview 이후 변경되었습니다.`);
      }
      const { result, bytes } = await this.#renderThumbnailMultiIntegration(request, slotAssets);
      const errors = mapIntegrationIssues(result.validation.errors);
      const warnings = mapIntegrationIssues(result.validation.warnings);
      if (result.status !== "PASS" || !result.artifact || !bytes || errors.length > 0) return desktopFailure("BLOCKED", "KBR-DOWNLOAD-001", "최종 재검증에 실패하여 Export가 차단되었습니다.", errors, warnings);
      if (result.requestFingerprint !== previewRecord.inputDigest || result.artifact.checksumSha256 !== previewRecord.pngDigest) return desktopFailure("BLOCKED", "DESKTOP-EXPORT-003", "Preview가 현재 입력과 일치하지 않습니다.", errors, warnings);

      const contracts = await loadContracts(this.#projectRoot);
      const fontDigests = contracts.fontRegistry.requiredAssets.flatMap((entry) => entry.sha256 ? [{ id: entry.id, sha256: entry.sha256 }] : []);
      const imageDigests = [...new Map([...slotAssets.values()].map((asset) => [asset.sha256, { id: asset.token, sha256: asset.sha256 }])).values()];
      const manifest = {
        schemaVersion: "1.0.0",
        canonicalInputDigest: result.requestFingerprint,
        normalizedInputDigest: result.requestFingerprint,
        outputPngDigest: result.artifact.checksumSha256,
        templateContractVersion: "1.9.0",
        inputSchemaVersion: "1.2.0",
        outputSchemaVersion: "2.0.0",
        templateId: THUMBNAIL_MULTI_RIGHT_TEMPLATE_ID,
        pixelFingerprint: result.pixelFingerprint,
        requestFingerprint: result.requestFingerprint,
        appliedImagePlacements: result.appliedImagePlacements,
        validatorResult: { errorCount: 0, warningCount: warnings.length, infoCount: result.validation.info.length, issues: [...warnings, ...mapIntegrationIssues(result.validation.info)] },
        assetDigests: {
          product: { id: result.appliedImagePlacements[0]?.assetId ?? THUMBNAIL_MULTI_RIGHT_PRIMARY_SLOT_ID, sha256: primaryAsset.sha256 },
          images: imageDigests,
          fonts: fontDigests,
          approvedIcons: [],
          referenceFixture: { id: contracts.referenceRegistry.fixture.id, sha256: contracts.referenceRegistry.fixture.sha256 },
        },
        manualAcceptanceStatus: thumbnailManualAcceptanceStatus(),
      };
      const manifestText = canonicalJson(manifest);
      const manifestDigest = sha256Bytes(Buffer.from(manifestText, "utf8"));
      const jobDirectory = await resolveTrustedJobDirectory(output.root, ".", request.jobName);
      const published = await publishArtifacts({ outputRoot: output.root, jobDirectory, png: bytes, manifest: manifestText, overwrite: false });
      publishedPng = published.pngPath;
      publishedManifest = published.manifestPath;
      const [actualPngDigest, actualManifestDigest, pngStat] = await Promise.all([sha256File(published.pngPath), sha256File(published.manifestPath), stat(published.pngPath)]);
      if (actualPngDigest !== result.artifact.checksumSha256 || actualManifestDigest !== manifestDigest) {
        await Promise.allSettled([rm(published.pngPath, { force: true }), rm(published.manifestPath, { force: true })]);
        return desktopFailure("ERROR", "DESKTOP-EXPORT-004", "저장된 산출물 digest 검증에 실패했습니다.");
      }
      const exportToken = this.#session.registerExport(published.pngPath, published.manifestPath);
      return { status: "EXPORTED", exportToken, jobName: request.jobName, pngFileName: "output.png", manifestFileName: "render-manifest.json", pngDigest: actualPngDigest, manifestDigest: actualManifestDigest, bytes: pngStat.size, warnings };
    } catch (error) {
      if (publishedPng || publishedManifest) await Promise.allSettled([publishedPng ? rm(publishedPng, { force: true }) : Promise.resolve(), publishedManifest ? rm(publishedManifest, { force: true }) : Promise.resolve()]);
      return desktopFailure("ERROR", error instanceof DesktopSecurityError ? error.code : "DESKTOP-EXPORT-999", error instanceof Error ? error.message : "Export 중 내부 오류가 발생했습니다.");
    }
  }

  async #exportMask(
    request: ExportRequest,
    imageAsset: SessionAsset,
    logoAsset: SessionAsset | undefined,
    previewRecord: Awaited<ReturnType<DesktopSessionManager["getPreview"]>>,
    output: Awaited<ReturnType<DesktopSessionManager["getOutputDirectory"]>>,
  ): Promise<ExportResult> {
    let publishedPng: string | null = null;
    let publishedManifest: string | null = null;
    try {
      const imageDigest = await sha256File(imageAsset.absolutePath);
      const logoDigest = logoAsset ? await sha256File(logoAsset.absolutePath) : null;
      const expectedDigests = previewRecord.assetDigests ?? {};
      if (imageDigest !== imageAsset.sha256 || (logoAsset && logoDigest !== logoAsset.sha256) || expectedDigests.IMAGE_PRIMARY !== imageDigest || (logoAsset && expectedDigests.LOGO_PRIMARY !== logoDigest)) return desktopFailure("BLOCKED", "DESKTOP-EXPORT-002", "MASK 이미지 또는 로고가 Preview 이후 변경되었습니다.");
      const { result, bytes } = await this.#renderMaskIntegration(request, imageAsset, logoAsset);
      const errors = mapIntegrationIssues(result.validation.errors);
      const warnings = mapIntegrationIssues(result.validation.warnings);
      if (result.status !== "PASS" || !result.artifact || !bytes || errors.length > 0) return desktopFailure("BLOCKED", "KBR-DOWNLOAD-001", "최종 재검증에 실패하여 Export가 차단되었습니다.", errors, warnings);
      if (result.requestFingerprint !== previewRecord.inputDigest || result.artifact.checksumSha256 !== previewRecord.pngDigest) return desktopFailure("BLOCKED", "DESKTOP-EXPORT-003", "Preview가 현재 입력과 일치하지 않습니다.", errors, warnings);
      const contracts = await loadContracts(this.#projectRoot);
      const fontDigests = contracts.fontRegistry.requiredAssets.flatMap((entry) => entry.sha256 ? [{ id: entry.id, sha256: entry.sha256 }] : []);
      const maskBytes = await readFile(resolveProjectRelativeMaskPath(this.#projectRoot));
      const maskDigest = sha256Bytes(maskBytes);
      const manifest = {
        schemaVersion: "1.0.0",
        canonicalInputDigest: result.requestFingerprint,
        normalizedInputDigest: result.requestFingerprint,
        outputPngDigest: result.artifact.checksumSha256,
        templateContractVersion: "1.9.0",
        inputSchemaVersion: "1.2.0",
        outputSchemaVersion: "2.0.0",
        templateId: MASK_SEMICIRCLE_RIGHT_TEMPLATE_ID,
        pixelFingerprint: result.pixelFingerprint,
        requestFingerprint: result.requestFingerprint,
        appliedImagePlacements: result.appliedImagePlacements,
        validatorResult: { errorCount: 0, warningCount: warnings.length, infoCount: result.validation.info.length, issues: [...warnings, ...mapIntegrationIssues(result.validation.info)] },
        assetDigests: {
          product: { id: result.appliedImagePlacements.find((placement) => placement.slotRole === "IMAGE")?.assetId ?? MASK_SEMICIRCLE_RIGHT_IMAGE_SLOT_ID, sha256: imageAsset.sha256 },
          images: logoAsset && logoDigest ? [{ id: result.appliedImagePlacements.find((placement) => placement.slotRole === "LOGO")?.assetId ?? MASK_SEMICIRCLE_RIGHT_LOGO_SLOT_ID, sha256: logoDigest }] : [],
          mask: { id: MASK_SEMICIRCLE_RIGHT_MASK_ASSET_ID, sha256: maskDigest },
          fonts: fontDigests,
          approvedIcons: [],
          referenceFixture: { id: contracts.referenceRegistry.fixture.id, sha256: contracts.referenceRegistry.fixture.sha256 },
        },
        manualAcceptanceStatus: thumbnailManualAcceptanceStatus(),
      };
      const manifestText = canonicalJson(manifest);
      const manifestDigest = sha256Bytes(Buffer.from(manifestText, "utf8"));
      const jobDirectory = await resolveTrustedJobDirectory(output.root, ".", request.jobName);
      const published = await publishArtifacts({ outputRoot: output.root, jobDirectory, png: bytes, manifest: manifestText, overwrite: false });
      publishedPng = published.pngPath;
      publishedManifest = published.manifestPath;
      const [actualPngDigest, actualManifestDigest, pngStat] = await Promise.all([sha256File(published.pngPath), sha256File(published.manifestPath), stat(published.pngPath)]);
      if (actualPngDigest !== result.artifact.checksumSha256 || actualManifestDigest !== manifestDigest) {
        await Promise.allSettled([rm(published.pngPath, { force: true }), rm(published.manifestPath, { force: true })]);
        return desktopFailure("ERROR", "DESKTOP-EXPORT-004", "저장된 산출물 digest 검증에 실패했습니다.");
      }
      const exportToken = this.#session.registerExport(published.pngPath, published.manifestPath);
      return { status: "EXPORTED", exportToken, jobName: request.jobName, pngFileName: "output.png", manifestFileName: "render-manifest.json", pngDigest: actualPngDigest, manifestDigest: actualManifestDigest, bytes: pngStat.size, warnings };
    } catch (error) {
      if (publishedPng || publishedManifest) await Promise.allSettled([publishedPng ? rm(publishedPng, { force: true }) : Promise.resolve(), publishedManifest ? rm(publishedManifest, { force: true }) : Promise.resolve()]);
      return desktopFailure("ERROR", error instanceof DesktopSecurityError ? error.code : "DESKTOP-EXPORT-999", error instanceof Error ? error.message : "Export 중 내부 오류가 발생했습니다.");
    }
  }

  async registerOutputDirectory(rootPath: string): Promise<{ token: string; displayName: string }> {
    return this.#session.registerOutputDirectory(rootPath);
  }

  async exportRender(request: ExportRequest): Promise<ExportResult> {
    let publishedPng: string | null = null;
    let publishedManifest: string | null = null;
    try {
      if (request.layoutMode === "FREEFORM" || request.freeform) {
        const previewRecord = this.#session.getPreview(request.previewToken);
        const output = this.#session.getOutputDirectory(request.outputDirectoryToken);
        return this.#exportFreeform(request, previewRecord, output);
      }
      const asset = this.#session.getAsset(request.assetToken);
      const previewRecord = this.#session.getPreview(request.previewToken);
      const output = this.#session.getOutputDirectory(request.outputDirectoryToken);
      if (request.template === "THUMBNAIL_BOX_RIGHT") return this.#exportThumbnail(request, asset, previewRecord, output);
      if (request.template === "THUMBNAIL_MULTI_RIGHT") return this.#exportThumbnailMulti(request, asset, previewRecord, output);
      if (request.template === "MASK_SEMICIRCLE_RIGHT") {
        const logo = request.logoAssetToken ? this.#session.getAsset(request.logoAssetToken) : undefined;
        return this.#exportMask(request, asset, logo, previewRecord, output);
      }
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
    const [contracts, capabilities] = await Promise.all([
      loadContracts(this.#projectRoot),
      readDesktopCapabilityRegistry(this.#projectRoot),
    ]);
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
      channels: capabilities,
    };
  }

  async previewBytes(token: string): Promise<Buffer> {
    return this.#session.readPreview(token);
  }

  async previewArtifact(token: string) {
    return this.#session.readPreviewArtifact(token);
  }

  async exportedManifest(token: string): Promise<unknown> {
    return JSON.parse(await readFile(this.#session.getExport(token).manifestPath, "utf8")) as unknown;
  }
}
