export type Severity = "ERROR" | "WARNING" | "INFO";

export type BBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ValidationIssue = {
  code: string;
  severity: Severity;
  path: string;
  messageKey: string;
  expected?: unknown;
  actual?: unknown;
  bbox?: BBox | null;
};

export type NoneCtaInput = {
  mode: "NONE";
  landingType: "DIRECT_URL" | "ADVIEW" | "KAKAO_SERVICE";
  label?: null;
  iconPath?: null;
};

export type AppDownloadCtaInput = {
  mode: "APP_DOWNLOAD";
  landingType: "APP_STORE";
  label: string;
  iconPath: string;
};

export type KakaoServiceCtaInput = {
  mode: "KAKAO_SERVICE_ACTION";
  landingType: string;
  label: string;
  iconPath?: string | null;
};

export type CtaInput = NoneCtaInput | AppDownloadCtaInput | KakaoServiceCtaInput;

export type CanonicalCtaInput =
  | (Omit<NoneCtaInput, "label" | "iconPath"> & { label: null; iconPath: null })
  | (AppDownloadCtaInput & { label: string; iconPath: string })
  | (Omit<KakaoServiceCtaInput, "iconPath"> & { label: string; iconPath: string | null });

export type KakaoBizboardInputV1 = {
  schemaVersion: "1.2.0";
  channel: "KAKAO_MOMENT";
  placement: "BIZBOARD";
  template: "OBJECT_RIGHT";
  canvas?: {
    width: 1029;
    height: 258;
  };
  advertiser: {
    text: string;
    renderMode: "REQUIRE_IN_COPY";
  };
  copy: {
    headline: string;
    subcopy: string;
  };
  cta: CtaInput;
  assets: {
    product: {
      path: string;
      expectedSha256?: string | null;
      alphaTrim?: true;
    };
  };
  render?: {
    templateContractVersion?: "1.1.0";
    includeDebugOverlay?: false;
    pixelRatio?: 1;
  };
  output: {
    directory: string;
    baseName: string;
    overwrite?: boolean;
  };
};

export type CanonicalInput = Omit<KakaoBizboardInputV1, "canvas" | "render" | "cta" | "assets" | "output"> & {
  canvas: {
    width: 1029;
    height: 258;
  };
  cta: CanonicalCtaInput;
  assets: {
    product: {
      path: string;
      expectedSha256: string | null;
      alphaTrim: true;
    };
  };
  render: {
    templateContractVersion: "1.1.0";
    includeDebugOverlay: false;
    pixelRatio: 1;
  };
  output: {
    directory: string;
    baseName: string;
    overwrite: boolean;
  };
};

export type ProductAnalysis = {
  inputWidth: number;
  inputHeight: number;
  trimBox: BBox;
  sourceLayoutBox: BBox;
  ignoredNoiseComponents: number;
  scale: number;
  resizedWidth: number;
  resizedHeight: number;
  destinationX: number;
  destinationY: number;
  placedVisibleBox: BBox;
  resizedRgba: Buffer;
};

export type TextMeasurement = {
  text: string;
  advanceWidth: number;
  bbox: BBox;
  drawX: number;
  baselineY: number;
};

export type LayoutMeasurements = {
  headline: TextMeasurement;
  subcopy: TextMeasurement;
  headlineWidthPx: number;
  subcopyWidthPx: number;
  advertiserMatchedInCopy: boolean;
  advertiserMatchedField: "headline" | "subcopy" | null;
  copyObjectGapPx: number;
  objectOpaqueWidthPx: number;
  objectOpaqueHeightPx: number;
  objectScale: number;
  objectSlot: BBox;
  productPlacedBox: BBox;
  alphaTrimBox: BBox;
};

export type AssetDigest = {
  id: string;
  sha256: string;
};

export type RenderManifest = {
  schemaVersion: "1.0.0";
  canonicalInputDigest: string;
  normalizedInputDigest: string;
  outputPngDigest: string;
  templateContractVersion: "1.1.0";
  inputSchemaVersion: "1.2.0";
  outputSchemaVersion: "2.0.0";
  validatorResult: {
    errorCount: 0;
    warningCount: number;
    infoCount: number;
    issues: ValidationIssue[];
  };
  assetDigests: {
    product: AssetDigest;
    fonts: AssetDigest[];
    approvedIcons: AssetDigest[];
    referenceFixture: AssetDigest;
  };
  manualAcceptanceStatus: {
    status: "NOT_REVIEWED";
    items: Array<{
      id: string;
      status: "NOT_REVIEWED";
      reviewer: null;
      reviewedAt: null;
    }>;
  };
};

export type RenderResponse = {
  schemaVersion: "1.0.0";
  manifestDigest: string | null;
  pngDigest: string | null;
  manifestPath: string | null;
  pngPath: string | null;
  downloadAllowed: boolean;
  status: "PASS" | "FAIL";
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
};

/** @internal Desktop preview result. This is not part of the public JSON Input contract. */
export type InternalPreviewResult = {
  canonicalInputDigest: string | null;
  normalizedInputDigest: string | null;
  productAssetDigest: string | null;
  previewPngDigest: string | null;
  png: Buffer | null;
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
};

export type RendererConfig = {
  projectRoot: string;
  inputRoot: string;
  outputRoot: string;
};

export type ErrorRegistryEntry = {
  code: string;
  severity: Severity;
  messageKey: string;
  condition: string;
  behavior?: string;
};

export type FontAssetRegistry = {
  registryVersion: string;
  status: "RESOLVED_ASSET" | "UNRESOLVED_ASSET";
  requiredAssets: Array<{
    id: string;
    status: "RESOLVED_ASSET" | "UNRESOLVED_ASSET";
    relativePath: string | null;
    fileName: string | null;
    sha256: string | null;
    family?: string;
    fontVersion?: string;
    weight: number;
    style: string;
    usage: string[];
    licenseStatus: string;
  }>;
  renderingBlocker: boolean;
  fallbackAllowed: boolean;
};

export type CtaRegistry = {
  registryVersion: string;
  disabledModeErrorCode: string;
  modes: Array<{
    id: CtaInput["mode"];
    enabled: boolean;
    allowedLabels: Array<string | null>;
    allowedLandingTypes: string[];
    requiredAssetIds: string[];
    disabledReason: string | null;
  }>;
};

export type ReferenceFixtureRegistry = {
  templateContractVersion: "1.1.0";
  fixture: {
    id: string;
    path: string;
    sha256: string;
    png: {
      width: 1029;
      height: 258;
      colorType: "RGBA";
      bitDepth: 8;
    };
    objectSlot: BBox;
  };
};
