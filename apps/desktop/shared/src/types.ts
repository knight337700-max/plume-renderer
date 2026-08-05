import type { LayoutMeasurements, ValidationIssue } from "../../../../src/core/types.js";

export type UiRenderInput = {
  assetToken: string;
  advertiser: string;
  headline: string;
  subcopy: string;
  jobName: string;
  requestSequence: number;
};

export type ProductSelectionResult =
  | { status: "CANCELLED" }
  | {
      status: "SELECTED";
      assetToken: string;
      fileName: string;
      bytes: number;
      width: number;
      height: number;
      hasAlpha: boolean;
      sha256: string;
    }
  | { status: "ERROR"; code: string; message: string };

export type PreviewResult = {
  requestSequence: number;
  previewToken: string | null;
  previewUrl: string | null;
  canonicalInputDigest: string | null;
  productAssetDigest: string | null;
  previewPngDigest: string | null;
  pngMetadata: {
    format: "PNG";
    colorType: "RGBA";
    bitDepth: 8;
    hasAlpha: true;
    width: 1029;
    height: 258;
    bytes: number;
  } | null;
  measurements: LayoutMeasurements | null;
  validationStatus: "PASS" | "WARNING" | "ERROR";
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  generatedAt: string;
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
      pngFileName: "output.png";
      manifestFileName: "render-manifest.json";
      pngDigest: string;
      manifestDigest: string;
      bytes: number;
      warnings: ValidationIssue[];
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
  template: "OBJECT_RIGHT";
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
  clearProduct(): Promise<void>;
  requestPreview(input: UiRenderInput): Promise<PreviewResult>;
  selectOutputDirectory(): Promise<OutputDirectoryResult>;
  exportRender(request: ExportRequest): Promise<ExportResult>;
  revealExportedFile(exportToken: string): Promise<void>;
  getAppInfo(): Promise<AppInfo>;
};
