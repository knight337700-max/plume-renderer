import type { FreeformAppliedElement, LayoutMeasurements, ValidationIssue } from "../../../../src/core/types.js";
import type {
  AppliedImagePlacement,
  CreativeLayoutPlan,
  CropCandidate,
  ImagePlacementPlan,
  SupportedInputMimeType,
} from "@kbr/renderer-contract";
import type { PreviewArtifact, PreviewEligibility } from "./preview-artifact.js";

export type UiTemplate = "OBJECT_RIGHT" | "THUMBNAIL_BOX_RIGHT" | "THUMBNAIL_MULTI_RIGHT" | "MASK_SEMICIRCLE_RIGHT";
export type UiLayoutMode = "TEMPLATE_LOCKED" | "FREEFORM";
export type UiFreeformOutputFormat = "PNG" | "JPEG";
export type UiChannel = "KAKAO" | "NAVER";
export type NaverPlacement =
  | "SMARTCHANNEL"
  | "MOBILE_DA"
  | "IMAGE_BANNER_1_1"
  | "MOBILE_NATIVE"
  | "PC_NATIVE"
  | "SHOPPING_NEWS"
  | "COMMUNICATION_AD"
  | "MOBILE_DA_FEED";
export type NaverEditorKind =
  | "TEMPLATE_LOCKED_EDITOR"
  | "FREEFORM_EDITOR"
  | "PLATFORM_SOURCE_EDITOR"
  | "COLLECTION_SOURCE_EDITOR";
export type NaverFeedSubtype = "IMAGE" | "COLLECTION" | "VIDEO";

export type DesktopCapability = Readonly<{
  id: string;
  label: string;
  compositionMode: "RENDERER_COMPOSED" | "PLATFORM_COMPOSED";
  layoutMode: "TEMPLATE_LOCKED" | "FREEFORM" | "PLATFORM_SOURCE";
  artifactCardinality: "SINGLE" | "COLLECTION" | "SINGLE_OR_COLLECTION";
  editorType: NaverEditorKind;
  renderable: boolean;
  sourceProfileId?: string;
  sourceProfileIds?: readonly string[];
  freeformProfileId?: string;
  templateRegistry?: string;
  fontPreflight?: boolean;
  platformOwnedFields?: readonly string[];
  feedSubtypes?: readonly Readonly<{
    id: NaverFeedSubtype;
    enabled: boolean;
    sourceProfileId: string;
    disabledReason?: string;
  }>[];
}>;

export type DesktopChannelCapability = Readonly<{
  id: UiChannel;
  label: string;
  placements: readonly DesktopCapability[];
}>;

export type NaverFieldRule = Readonly<{
  id: string;
  label: string;
  type?: string;
  required?: boolean | "UNRESOLVED";
  minLength?: number | null;
  maxLength?: number | null;
  allowedValues?: readonly unknown[] | null;
  conditional?: string | null;
  platformGenerated?: boolean;
  userEditable?: boolean;
  sourceStatus?: string;
}>;

export type NaverAssetRule = Readonly<{
  id: string;
  assetRole: string;
  required?: boolean | "UNRESOLVED";
  canvas?: Readonly<Record<string, unknown>>;
  mime?: readonly string[];
  fileSize?: Readonly<Record<string, unknown>>;
  alpha?: Readonly<Record<string, unknown>>;
  safeArea?: Readonly<{ x: number; y: number; width: number; height: number }>;
}>;

export type NaverSourceProfile = Readonly<{
  id: string;
  placement: string;
  artifactCardinality: "SINGLE" | "COLLECTION";
  runtime?: string;
  fields: readonly NaverFieldRule[];
  assets: readonly NaverAssetRule[];
  collection?: Readonly<{ minimumItems?: number; maximumItems?: number; itemFields: readonly NaverFieldRule[] }>;
}>;

export type NaverTemplateOption = Readonly<{
  templateId: string;
  height: number;
  family: string;
  objectKind: string;
  side: string;
  textVariant: string;
  affordance: string;
  objectPlacementToken: string;
  textInputFields: readonly NaverSmartChannelTextInputFieldDescriptor[];
}>;

export type NaverSmartChannelTextInputKey =
  | "headline"
  | "headlineLine2"
  | "subcopy"
  | "subcopyLine4"
  | "disclosureLine1"
  | "disclosureLine2"
  | "ctaOption";

export type NaverSmartChannelTextInputFieldDescriptor = Readonly<{
  key: NaverSmartChannelTextInputKey;
  role: "HEADLINE" | "SUBCOPY" | "DISCLOSURE" | "CTA_LABEL";
  required: true;
  order: number;
  labelKey: string;
  sourceLayerName: string;
}>;

export type NaverFontPreflightInfo = Readonly<{
  configuredDirectory: string | null;
  requiredAssets: readonly Readonly<{
    token: string;
    expectedFilename: string;
    expectedSha256: string | null;
    requiredPostScriptName: string;
  }>[];
}>;

export type NaverCatalog = Readonly<{
  capabilities: readonly DesktopChannelCapability[];
  sourceProfiles: readonly NaverSourceProfile[];
  templates: readonly NaverTemplateOption[];
  fontPreflight: NaverFontPreflightInfo;
}>;

export type NaverSmartChannelRequest = Readonly<{
  kind: "SMARTCHANNEL";
  templateId: string;
  content: Readonly<Record<string, string>>;
  objectAssetToken: string;
  advertiserLogoAssetToken?: string;
  jobName: string;
}>;

export type NaverSourceAssetRequest = Readonly<{
  assetId: string;
  assetRole: string;
  sourceProfileId: string;
  assetToken: string;
}>;

export type NaverCollectionItemRequest = Readonly<{
  id: string;
  assetId: string;
  sourceProfileId: string;
  assetToken: string;
  fields: Readonly<Record<string, unknown>>;
}>;

export type NaverPlatformSourceRequest = Readonly<{
  kind: "PLATFORM_SOURCE";
  placement: Exclude<NaverPlacement, "SMARTCHANNEL" | "MOBILE_DA" | "IMAGE_BANNER_1_1">;
  sourceProfileId: string;
  fields: Readonly<Record<string, unknown>>;
  assets: readonly NaverSourceAssetRequest[];
  collectionItems?: readonly NaverCollectionItemRequest[];
  jobName: string;
}>;

export type NaverPreviewRequest = Readonly<{
  requestSequence: number;
  request: NaverSmartChannelRequest | NaverPlatformSourceRequest;
}>;

export type NaverPreviewResult = Readonly<{
  requestSequence: number;
  placement: NaverPlacement;
  compositionMode: "RENDERER_COMPOSED" | "PLATFORM_COMPOSED";
  artifactCardinality: "SINGLE" | "COLLECTION";
  previewToken: string | null;
  previewUrl: string | null;
  validationStatus: "PASS" | "WARNING" | "ERROR";
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  normalizedPayload: unknown | null;
  requestFingerprint: string | null;
  collectionFingerprint: string | null;
  finalUiRendered: false;
  generatedAt: string;
}>;

export type NaverExportRequest = Readonly<{
  request: NaverSmartChannelRequest | NaverPlatformSourceRequest;
  previewToken?: string;
  previewFingerprint?: string;
  outputDirectoryToken: string;
}>;

export type NaverExportResult =
  | Readonly<{
      status: "EXPORTED";
      exportToken: string;
      mode: "RENDERED" | "SOURCE" | "COLLECTION";
      jobName: string;
      manifestFileName: string;
      artifactFileNames: readonly string[];
      pngDigest?: string;
      manifestDigest?: string;
      requestFingerprint?: string;
      collectionFingerprint?: string;
      warnings: ValidationIssue[];
    }>
  | Readonly<{
      status: "BLOCKED" | "ERROR";
      code: string;
      message: string;
      errors: ValidationIssue[];
      warnings: ValidationIssue[];
    }>;

export type UiFreeformRequest = {
  formatProfileId: string;
  creativeLayoutPlan: CreativeLayoutPlan;
  assetTokens: Readonly<Record<string, string>>;
  outputFormat: UiFreeformOutputFormat;
  outputQuality?: number | "AUTO_FIT";
};

export type UiRenderInput = {
  assetToken: string;
  secondaryAssetToken?: string;
  logoAssetToken?: string;
  advertiser: string;
  headline: string;
  subcopy: string;
  jobName: string;
  requestSequence: number;
  template?: UiTemplate;
  layoutMode?: UiLayoutMode;
  freeform?: UiFreeformRequest;
  placementPlan?: ImagePlacementPlan;
  placementPlans?: readonly ImagePlacementPlan[];
  cropCandidates?: readonly CropCandidate[];
};

export type ProductSelectionResult =
  | { status: "CANCELLED" }
  | {
      status: "SELECTED";
      assetToken: string;
      displayName: string;
      detectedMimeType: SupportedInputMimeType;
      bytes: number;
      width: number;
      height: number;
      hasAlpha: boolean;
      checksumSha256: string;
    }
  | { status: "ERROR"; code: string; message: string };

export type PreviewResult = {
  requestSequence: number;
  previewToken: string | null;
  previewUrl: string | null;
  canonicalInputDigest: string | null;
  productAssetDigest: string | null;
  logoAssetDigest?: string | null;
  previewPngDigest: string | null;
  pngMetadata: {
    format: "PNG" | "JPEG";
    colorType: "RGBA" | "RGB";
    bitDepth: 8;
    hasAlpha: boolean;
    width: number;
    height: number;
    bytes: number;
  } | null;
  measurements: LayoutMeasurements | null;
  validationStatus: "PASS" | "WARNING" | "ERROR";
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  generatedAt: string;
  template?: UiTemplate;
  appliedImagePlacement?: AppliedImagePlacement | null;
  appliedImagePlacements?: readonly AppliedImagePlacement[];
  productAssetDigests?: Readonly<Record<string, string>>;
  formatProfileId?: string | null;
  artifactFormat?: UiFreeformOutputFormat | null;
  artifactDigest?: string | null;
  outputEncoding?: Readonly<Record<string, unknown>> | null;
  appliedElements?: readonly FreeformAppliedElement[];
  previewArtifact?: PreviewArtifact | null;
  eligibility?: PreviewEligibility;
};

export type OutputDirectoryResult =
  | { status: "CANCELLED" }
  | { status: "SELECTED"; outputDirectoryToken: string; displayName: string }
  | { status: "ERROR"; code: string; message: string };

export type ExportRequest = Omit<UiRenderInput, "requestSequence"> & {
  previewToken: string;
  outputDirectoryToken: string;
};

export type ExportResult =
  | {
      status: "EXPORTED";
      exportToken: string;
      jobName: string;
      pngFileName: string;
      manifestFileName: "render-manifest.json";
      pngDigest: string;
      manifestDigest: string;
      bytes: number;
      warnings: ValidationIssue[];
      artifactFileName?: string;
      artifactFormat?: UiFreeformOutputFormat;
      artifactDigest?: string;
    }
  | {
      status: "BLOCKED" | "ERROR";
      code: string;
      message: string;
      errors: ValidationIssue[];
      warnings: ValidationIssue[];
    };

export type AppInfo = {
  name: string;
  version: string;
  template: UiTemplate;
  canvas: { width: 1029; height: 258 };
  ctaMode: "NONE";
  runtimeNetworkAccess: "PROHIBITED";
  signed: false;
  limits: {
    advertiser: number;
    headline: number;
    subcopy: number;
    jobName: number;
  };
  blockedNetworkRequestCount: number;
  channels?: readonly DesktopChannelCapability[];
};

export type RendererDiagnostic = Readonly<{
  kind: "window_error" | "unhandled_rejection" | "react_error_boundary" | "console_error" | "renderer_crash" | "renderer_unresponsive";
  timestamp?: string;
  channel?: UiChannel;
  placement?: string;
  subtype?: string;
  templateId?: string;
  selectedDimensions?: Readonly<Partial<Pick<NaverTemplateOption, "height" | "family" | "objectKind" | "side" | "textVariant" | "affordance">>>;
  name?: string;
  message: string;
  stack?: string;
  componentStack?: string;
  source?: "renderer" | "electron-main";
}>;

export type DesktopApi = {
  selectProductPng(): Promise<ProductSelectionResult>;
  selectSecondaryProductPng(): Promise<ProductSelectionResult>;
  selectLogoPng(): Promise<ProductSelectionResult>;
  clearProduct(): Promise<void>;
  clearSecondaryProduct(): Promise<void>;
  clearLogo(): Promise<void>;
  requestPreview(input: UiRenderInput): Promise<PreviewResult>;
  selectOutputDirectory(): Promise<OutputDirectoryResult>;
  exportRender(request: ExportRequest): Promise<ExportResult>;
  getNaverCatalog(): Promise<NaverCatalog>;
  requestNaverPreview(input: NaverPreviewRequest): Promise<NaverPreviewResult>;
  exportNaver(request: NaverExportRequest): Promise<NaverExportResult>;
  revealExportedFile(exportToken: string): Promise<void>;
  getAppInfo(): Promise<AppInfo>;
  reportRendererDiagnostic(diagnostic: RendererDiagnostic): Promise<void>;
};
