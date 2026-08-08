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
};

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
  revealExportedFile(exportToken: string): Promise<void>;
  getAppInfo(): Promise<AppInfo>;
};
