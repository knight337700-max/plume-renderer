import canonicalize from "canonicalize";

export const INTEGRATION_SCHEMA_VERSION = "1.0.0" as const;
export const NORMALIZED_EPSILON = 1e-9;
export const OBJECT_RIGHT_FORMAT_PROFILE_ID = "KAKAO_BIZBOARD_OBJECT_RIGHT" as const;
export const OBJECT_RIGHT_TEMPLATE_ID = "KAKAO_MOMENT_BIZBOARD_OBJECT_RIGHT_1029X258_V1" as const;
export const OBJECT_RIGHT_IMAGE_SLOT_ID = "OBJECT_RIGHT_PRODUCT" as const;
export const THUMBNAIL_BOX_RIGHT_FORMAT_PROFILE_ID = "KAKAO_BIZBOARD_THUMBNAIL_BOX_RIGHT" as const;
export const THUMBNAIL_BOX_RIGHT_TEMPLATE_ID = "KAKAO_MOMENT_BIZBOARD_THUMBNAIL_BOX_RIGHT" as const;
export const THUMBNAIL_BOX_RIGHT_IMAGE_SLOT_ID = "IMAGE_PRIMARY" as const;

export type RendererImageMimeType = "image/png" | "image/jpeg" | "image/webp";
export type AssetRefType = "DESKTOP_ASSET_TOKEN" | "INTEGRATION_ASSET_TOKEN" | "FIXTURE_ASSET_ID";
export type ImagePlacementPolicy = "ALPHA_TRIM_CONTAIN" | "CENTER_CONTAIN" | "SEMANTIC_CROP_COVER" | "MANUAL_CROP";
export type ImageFitMode = "CONTAIN" | "COVER";
export type ImageAnchor =
  | "CENTER"
  | "CENTER_LEFT"
  | "CENTER_RIGHT"
  | "TOP_CENTER"
  | "TOP_LEFT"
  | "TOP_RIGHT"
  | "BOTTOM_CENTER"
  | "BOTTOM_LEFT"
  | "BOTTOM_RIGHT";
export type SubjectProtection = "REQUIRED" | "PREFERRED" | "NONE";
export type PlacementPlanSource = "DETERMINISTIC" | "MANUAL" | "AGENT" | "SAVED_CREATIVE";
export type ValidationSeverity = "INFO" | "WARNING" | "ERROR";

export type NormalizedPoint = Readonly<{ x: number; y: number }>;
export type NormalizedRect = Readonly<{ x: number; y: number; width: number; height: number }>;
export type PixelRect = Readonly<{ x: number; y: number; width: number; height: number }>;

export type RendererAssetAnalysis = Readonly<{
  alphaChannel?: boolean;
  alphaBounds?: NormalizedRect;
  focalPoint?: NormalizedPoint;
  protectedSubjects?: readonly ProtectedSubject[];
}>;

export type RendererAssetDescriptor = Readonly<{
  assetId: string;
  mimeType: RendererImageMimeType;
  declaredWidth?: number;
  declaredHeight?: number;
  checksumSha256?: string;
  assetRef: Readonly<{ type: AssetRefType; value: string }>;
  analysis?: RendererAssetAnalysis;
}>;

export type ProtectedSubject = Readonly<{
  subjectId: string;
  subjectType: "PRODUCT" | "PERSON" | "FACE" | "LOGO" | "TEXT" | "OTHER";
  bounds: NormalizedRect;
}>;

export type ImagePlacementPlan = Readonly<{
  schemaVersion: typeof INTEGRATION_SCHEMA_VERSION;
  imageSlotId: string;
  assetId: string;
  policy: ImagePlacementPolicy;
  source: PlacementPlanSource;
  fitMode: ImageFitMode;
  cropRect?: NormalizedRect;
  focalPoint?: NormalizedPoint;
  anchor: ImageAnchor;
  subjectProtection: SubjectProtection;
  cropCandidateId?: string;
  confidence?: number;
  protectedSubjects?: readonly ProtectedSubject[];
  rationale?: string;
}>;

export type CropCandidate = Readonly<{
  schemaVersion: typeof INTEGRATION_SCHEMA_VERSION;
  candidateId: string;
  assetId: string;
  imageSlotId: string;
  cropRect: NormalizedRect;
  focalPoint?: NormalizedPoint;
  preservedSubjectIds: readonly string[];
  clippedSubjectIds: readonly string[];
  fillRatio: number;
  subjectCoverageRatio: number;
  warnings: readonly string[];
}>;

export type RendererCopyInput = Readonly<{
  advertiser?: string;
  headline?: string;
  subcopy?: string;
  cta?: string;
  slots?: Readonly<Record<string, string>>;
}>;

export type RendererOutputRequest = Readonly<{
  mimeType: "image/png";
  quality?: number;
}>;

export type RendererIntegrationInputV1 = Readonly<{
  schemaVersion: typeof INTEGRATION_SCHEMA_VERSION;
  formatProfileId: string;
  templateId: string;
  copy: RendererCopyInput;
  assets: readonly RendererAssetDescriptor[];
  imagePlacementPlans: readonly ImagePlacementPlan[];
  cropCandidates?: readonly CropCandidate[];
  output: RendererOutputRequest;
}>;

export type RendererValidationIssue = Readonly<{
  code: string;
  severity: ValidationSeverity;
  messageKey: string;
  message?: string;
  path?: string;
  imageSlotId?: string;
  assetId?: string;
  elementId?: string;
  actual?: unknown;
  expected?: unknown;
}>;

export type AppliedImagePlacement = Readonly<{
  imageSlotId: string;
  assetId: string;
  policy: ImagePlacementPolicy;
  source: PlacementPlanSource;
  requestedCropRect?: NormalizedRect;
  resolvedSourceCropRect?: NormalizedRect;
  resolvedSourceCropPixels?: PixelRect;
  destinationRect: PixelRect;
  appliedScale: number;
  appliedAnchor: ImageAnchor;
  alphaTrimApplied: boolean;
  alphaBounds?: NormalizedRect;
  cropCandidateId?: string;
  changedFromRequestedPlan: false;
}>;

export type RendererIntegrationOutputV1 = Readonly<{
  schemaVersion: typeof INTEGRATION_SCHEMA_VERSION;
  status: "PASS" | "BLOCKED";
  artifact?: Readonly<{
    mimeType: "image/png";
    width: number;
    height: number;
    bytes: number;
    checksumSha256: string;
  }>;
  appliedImagePlacements: readonly AppliedImagePlacement[];
  validation: Readonly<{
    errors: readonly RendererValidationIssue[];
    warnings: readonly RendererValidationIssue[];
    info: readonly RendererValidationIssue[];
  }>;
  requestFingerprint: string;
  pixelFingerprint: string;
  renderFingerprint: string;
}>;

export type ImplementationStatus = "NOT_IMPLEMENTED" | "PARTIAL" | "IMPLEMENTED";
export type SemanticPlacement = "NOT_REQUIRED" | "OPTIONAL" | "REQUIRED";
export type ImagePlacementCapability = Readonly<{
  schemaVersion: typeof INTEGRATION_SCHEMA_VERSION;
  implementationStatus: ImplementationStatus;
  defaultPolicy: ImagePlacementPolicy;
  semanticPlacement: SemanticPlacement;
  allowedPolicies: readonly ImagePlacementPolicy[];
  supportsManualCrop: boolean;
  supportsAgentPlacement: boolean;
  imageSlotIds?: readonly string[];
}>;

export type AssetResolverResult = Readonly<{ bytes: Uint8Array; resolvedMimeType: string }>;
export interface RendererAssetResolver {
  resolve(assetRef: RendererAssetDescriptor["assetRef"]): Promise<AssetResolverResult>;
}

export type ContractValidationContext = Readonly<{
  allowedPolicies?: readonly ImagePlacementPolicy[];
  requiredImageSlotIds?: readonly string[];
  allowedImageSlotIds?: readonly string[];
  unusedAssetSeverity?: "WARNING" | "ERROR";
}>;

const severityOrder: Record<ValidationSeverity, number> = { ERROR: 0, WARNING: 1, INFO: 2 };

export function issue(
  code: string,
  severity: ValidationSeverity,
  messageKey: string,
  details: Omit<RendererValidationIssue, "code" | "severity" | "messageKey"> = {},
): RendererValidationIssue {
  return { code, severity, messageKey, ...details };
}

export function sortIssues(issues: readonly RendererValidationIssue[]): RendererValidationIssue[] {
  return [...issues].sort((a, b) => {
    const severity = severityOrder[a.severity] - severityOrder[b.severity];
    if (severity !== 0) return severity;
    const path = (a.path ?? "").localeCompare(b.path ?? "");
    if (path !== 0) return path;
    const code = a.code.localeCompare(b.code);
    if (code !== 0) return code;
    return a.messageKey.localeCompare(b.messageKey);
  });
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function validateNormalizedPoint(value: unknown, path = ""): RendererValidationIssue[] {
  const errors: RendererValidationIssue[] = [];
  if (!value || typeof value !== "object") {
    return [issue("KBR-FOCAL-POINT-OUT-OF-BOUNDS", "ERROR", "placement.focal_point_invalid", { path })];
  }
  const point = value as Partial<NormalizedPoint>;
  if (!isFiniteNumber(point.x) || !isFiniteNumber(point.y) || point.x < -NORMALIZED_EPSILON || point.x > 1 + NORMALIZED_EPSILON || point.y < -NORMALIZED_EPSILON || point.y > 1 + NORMALIZED_EPSILON) {
    errors.push(issue("KBR-FOCAL-POINT-OUT-OF-BOUNDS", "ERROR", "placement.focal_point_out_of_bounds", { path }));
  }
  return errors;
}

export function validateNormalizedRect(value: unknown, path = ""): RendererValidationIssue[] {
  const errors: RendererValidationIssue[] = [];
  if (!value || typeof value !== "object") {
    return [issue("KBR-CROP-RECT-OUT-OF-BOUNDS", "ERROR", "placement.crop_rect_invalid", { path })];
  }
  const rect = value as Partial<NormalizedRect>;
  const validNumbers = [rect.x, rect.y, rect.width, rect.height].every(isFiniteNumber);
  const inBounds = validNumbers && rect.x! >= -NORMALIZED_EPSILON && rect.y! >= -NORMALIZED_EPSILON && rect.width! > 0 && rect.height! > 0 && rect.width! <= 1 + NORMALIZED_EPSILON && rect.height! <= 1 + NORMALIZED_EPSILON && rect.x! + rect.width! <= 1 + NORMALIZED_EPSILON && rect.y! + rect.height! <= 1 + NORMALIZED_EPSILON;
  if (!inBounds) errors.push(issue("KBR-CROP-RECT-OUT-OF-BOUNDS", "ERROR", "placement.crop_rect_out_of_bounds", { path }));
  return errors;
}

export function normalizedRectToPixelRect(rect: NormalizedRect, sourceWidth: number, sourceHeight: number): PixelRect {
  const validation = validateNormalizedRect(rect);
  if (!isFiniteNumber(sourceWidth) || !isFiniteNumber(sourceHeight) || sourceWidth <= 0 || sourceHeight <= 0 || validation.length > 0) {
    throw new RangeError("Normalized rect or source dimensions are invalid");
  }
  const left = Math.floor(rect.x * sourceWidth);
  const top = Math.floor(rect.y * sourceHeight);
  const right = Math.ceil((rect.x + rect.width) * sourceWidth);
  const bottom = Math.ceil((rect.y + rect.height) * sourceHeight);
  if (left < 0 || top < 0 || right > sourceWidth || bottom > sourceHeight || right <= left || bottom <= top) {
    throw new RangeError("Normalized rect exceeds source bounds");
  }
  return { x: left, y: top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
}

const policyFit: Record<ImagePlacementPolicy, ImageFitMode> = {
  ALPHA_TRIM_CONTAIN: "CONTAIN",
  CENTER_CONTAIN: "CONTAIN",
  SEMANTIC_CROP_COVER: "COVER",
  MANUAL_CROP: "COVER",
};

export function validatePlacementPlan(
  plan: ImagePlacementPlan,
  assets: ReadonlyMap<string, RendererAssetDescriptor>,
  candidates: ReadonlyMap<string, CropCandidate>,
  context: ContractValidationContext = {},
): RendererValidationIssue[] {
  const errors: RendererValidationIssue[] = [];
  const path = `/imagePlacementPlans/${plan.imageSlotId}`;
  if (!assets.has(plan.assetId)) errors.push(issue("KBR-ASSET-NOT-FOUND", "ERROR", "asset.not_found", { path: `${path}/assetId`, assetId: plan.assetId }));
  if (context.allowedImageSlotIds && !context.allowedImageSlotIds.includes(plan.imageSlotId)) errors.push(issue("KBR-IMAGE-SLOT-NOT-FOUND", "ERROR", "placement.image_slot_not_found", { path: `${path}/imageSlotId`, imageSlotId: plan.imageSlotId }));
  if (context.allowedPolicies && !context.allowedPolicies.includes(plan.policy)) errors.push(issue("KBR-PLACEMENT-POLICY-NOT-ALLOWED", "ERROR", "placement.policy_not_allowed", { path: `${path}/policy`, actual: plan.policy, expected: context.allowedPolicies }));
  if (policyFit[plan.policy] !== plan.fitMode) errors.push(issue("KBR-PLACEMENT-POLICY-NOT-ALLOWED", "ERROR", "placement.fit_mode_not_allowed", { path: `${path}/fitMode`, actual: plan.fitMode, expected: policyFit[plan.policy] }));
  if (plan.confidence !== undefined && (!isFiniteNumber(plan.confidence) || plan.confidence < 0 || plan.confidence > 1)) errors.push(issue("KBR-PLACEMENT-POLICY-NOT-ALLOWED", "ERROR", "placement.confidence_invalid", { path: `${path}/confidence` }));
  errors.push(...validateNormalizedRectList(plan.protectedSubjects, `${path}/protectedSubjects`));
  if (plan.focalPoint) errors.push(...validateNormalizedPoint(plan.focalPoint, `${path}/focalPoint`));
  if (plan.cropRect) errors.push(...validateNormalizedRect(plan.cropRect, `${path}/cropRect`));

  const hasCrop = plan.cropRect !== undefined;
  const hasCandidate = plan.cropCandidateId !== undefined;
  if (hasCrop && hasCandidate) errors.push(issue("KBR-CROP-RECT-FORBIDDEN", "ERROR", "placement.crop_and_candidate_mutually_exclusive", { path }));
  if ((plan.policy === "ALPHA_TRIM_CONTAIN" || plan.policy === "CENTER_CONTAIN") && (hasCrop || hasCandidate)) {
    errors.push(issue("KBR-CROP-RECT-FORBIDDEN", "ERROR", "placement.crop_forbidden_for_policy", { path }));
  }
  if (plan.policy === "SEMANTIC_CROP_COVER" && !hasCrop && !hasCandidate) errors.push(issue("KBR-CROP-RECT-REQUIRED", "ERROR", "placement.semantic_crop_required", { path }));
  if (plan.policy === "MANUAL_CROP" && !hasCrop) errors.push(issue("KBR-CROP-RECT-REQUIRED", "ERROR", "placement.manual_crop_required", { path }));
  if (plan.policy === "MANUAL_CROP" && hasCandidate) errors.push(issue("KBR-CROP-CANDIDATE-MISMATCH", "ERROR", "placement.manual_candidate_forbidden", { path }));
  if (plan.policy === "MANUAL_CROP" && plan.source !== "MANUAL") errors.push(issue("KBR-PLACEMENT-POLICY-NOT-ALLOWED", "ERROR", "placement.manual_source_required", { path: `${path}/source`, actual: plan.source, expected: "MANUAL" }));
  if (hasCandidate) {
    const candidate = candidates.get(plan.cropCandidateId!);
    if (!candidate) errors.push(issue("KBR-CROP-CANDIDATE-NOT-FOUND", "ERROR", "placement.crop_candidate_not_found", { path: `${path}/cropCandidateId`, actual: plan.cropCandidateId }));
    else {
      errors.push(...validateNormalizedRect(candidate.cropRect, `${path}/cropCandidateId`));
      if (candidate.assetId !== plan.assetId || candidate.imageSlotId !== plan.imageSlotId) errors.push(issue("KBR-CROP-CANDIDATE-MISMATCH", "ERROR", "placement.crop_candidate_mismatch", { path: `${path}/cropCandidateId`, actual: { assetId: candidate.assetId, imageSlotId: candidate.imageSlotId }, expected: { assetId: plan.assetId, imageSlotId: plan.imageSlotId } }));
      if (!isFiniteNumber(candidate.fillRatio) || candidate.fillRatio < 0 || candidate.fillRatio > 1 || !isFiniteNumber(candidate.subjectCoverageRatio) || candidate.subjectCoverageRatio < 0 || candidate.subjectCoverageRatio > 1) errors.push(issue("KBR-CROP-CANDIDATE-MISMATCH", "ERROR", "placement.crop_candidate_ratio_invalid", { path: `${path}/cropCandidateId` }));
    }
  }
  if (plan.subjectProtection === "REQUIRED" && (!plan.protectedSubjects || plan.protectedSubjects.length === 0)) errors.push(issue("KBR-PROTECTED-SUBJECT-DATA-MISSING", "ERROR", "placement.protected_subject_data_missing", { path: `${path}/protectedSubjects` }));
  return errors;
}

function validateNormalizedRectList(subjects: readonly ProtectedSubject[] | undefined, path: string): RendererValidationIssue[] {
  if (!subjects) return [];
  return subjects.flatMap((subject, index) => validateNormalizedRect(subject.bounds, `${path}/${index}/bounds`));
}

export function validateProtectedSubjects(
  plan: ImagePlacementPlan,
  cropRect: NormalizedRect | undefined,
): RendererValidationIssue[] {
  if (!cropRect || plan.subjectProtection === "NONE" || !plan.protectedSubjects?.length) return [];
  const issues: RendererValidationIssue[] = [];
  for (const [index, subject] of plan.protectedSubjects.entries()) {
    const outside = subject.bounds.x < cropRect.x - NORMALIZED_EPSILON || subject.bounds.y < cropRect.y - NORMALIZED_EPSILON || subject.bounds.x + subject.bounds.width > cropRect.x + cropRect.width + NORMALIZED_EPSILON || subject.bounds.y + subject.bounds.height > cropRect.y + cropRect.height + NORMALIZED_EPSILON;
    if (outside) issues.push(issue("KBR-PROTECTED-SUBJECT-CLIPPED", plan.subjectProtection === "REQUIRED" ? "ERROR" : "WARNING", "placement.protected_subject_clipped", { path: `/imagePlacementPlans/${plan.imageSlotId}/protectedSubjects/${index}`, imageSlotId: plan.imageSlotId }));
  }
  return issues;
}

export function resolveCropRect(plan: ImagePlacementPlan, candidates: ReadonlyMap<string, CropCandidate>): NormalizedRect | undefined {
  if (plan.cropRect) return plan.cropRect;
  if (plan.cropCandidateId) return candidates.get(plan.cropCandidateId)?.cropRect;
  return undefined;
}

export function validateIntegrationInput(input: RendererIntegrationInputV1, context: ContractValidationContext = {}): RendererValidationIssue[] {
  const errors: RendererValidationIssue[] = [];
  if (input.schemaVersion !== INTEGRATION_SCHEMA_VERSION) errors.push(issue("KBR-INPUT-002", "ERROR", "input.schema_version_invalid", { path: "/schemaVersion", expected: INTEGRATION_SCHEMA_VERSION, actual: input.schemaVersion }));
  if (!input.formatProfileId) errors.push(issue("KBR-INPUT-002", "ERROR", "input.format_profile_missing", { path: "/formatProfileId" }));
  if (!input.templateId) errors.push(issue("KBR-INPUT-002", "ERROR", "input.template_id_missing", { path: "/templateId" }));
  const assets = new Map<string, RendererAssetDescriptor>();
  for (const [index, asset] of input.assets.entries()) {
    if (assets.has(asset.assetId)) errors.push(issue("KBR-ASSET-NOT-FOUND", "ERROR", "asset.duplicate_id", { path: `/assets/${index}/assetId`, assetId: asset.assetId }));
    assets.set(asset.assetId, asset);
    const refValue = asset.assetRef.value;
    const absoluteRef = refValue.includes("\0") || /^[a-zA-Z]:[\\/]/u.test(refValue) || refValue.startsWith("/") || refValue.startsWith("\\\\") || refValue.split(/[\\/]+/u).includes("..");
    if (absoluteRef) errors.push(issue("KBR-ASSET-REF-UNRESOLVED", "ERROR", "asset.ref_must_be_serializable_token", { path: `/assets/${index}/assetRef/value`, actual: refValue }));
    if (asset.declaredWidth !== undefined && (!Number.isInteger(asset.declaredWidth) || asset.declaredWidth <= 0)) errors.push(issue("KBR-ASSET-DIMENSION-MISMATCH", "ERROR", "asset.declared_dimension_invalid", { path: `/assets/${index}/declaredWidth` }));
    if (asset.declaredHeight !== undefined && (!Number.isInteger(asset.declaredHeight) || asset.declaredHeight <= 0)) errors.push(issue("KBR-ASSET-DIMENSION-MISMATCH", "ERROR", "asset.declared_dimension_invalid", { path: `/assets/${index}/declaredHeight` }));
  }
  const candidates = new Map<string, CropCandidate>();
  for (const [index, candidate] of (input.cropCandidates ?? []).entries()) {
    if (candidates.has(candidate.candidateId)) errors.push(issue("KBR-CROP-CANDIDATE-MISMATCH", "ERROR", "placement.duplicate_candidate_id", { path: `/cropCandidates/${index}/candidateId` }));
    candidates.set(candidate.candidateId, candidate);
  }
  const plansBySlot = new Map<string, ImagePlacementPlan>();
  for (const [index, plan] of input.imagePlacementPlans.entries()) {
    if (plansBySlot.has(plan.imageSlotId)) errors.push(issue("KBR-PLACEMENT-PLAN-DUPLICATE", "ERROR", "placement.plan_duplicate", { path: `/imagePlacementPlans/${index}/imageSlotId`, imageSlotId: plan.imageSlotId }));
    plansBySlot.set(plan.imageSlotId, plan);
    errors.push(...validatePlacementPlan(plan, assets, candidates, context));
    errors.push(...validateProtectedSubjects(plan, resolveCropRect(plan, candidates)));
  }
  for (const slot of context.requiredImageSlotIds ?? []) if (!plansBySlot.has(slot)) errors.push(issue("KBR-PLACEMENT-PLAN-MISSING", "ERROR", "placement.plan_missing", { path: "/imagePlacementPlans", imageSlotId: slot }));
  const usedAssets = new Set(input.imagePlacementPlans.map((plan) => plan.assetId));
  for (const asset of input.assets) if (!usedAssets.has(asset.assetId)) errors.push(issue("KBR-ASSET-UNUSED", context.unusedAssetSeverity ?? "WARNING", "asset.unused", { path: "/assets", assetId: asset.assetId }));
  if (input.output.mimeType !== "image/png") errors.push(issue("KBR-OUTPUT-INVALID", "ERROR", "output.mime_type_not_implemented", { path: "/output/mimeType", actual: input.output.mimeType, expected: "image/png" }));
  if (input.output.quality !== undefined && (!isFiniteNumber(input.output.quality) || input.output.quality < 0 || input.output.quality > 100)) errors.push(issue("KBR-OUTPUT-INVALID", "ERROR", "output.quality_invalid", { path: "/output/quality" }));
  return sortIssues(errors);
}

export function canonicalJson(value: unknown): string {
  const result = canonicalize(value);
  if (result === undefined) throw new TypeError("Value is not JSON-serializable");
  return result;
}

export function serializePlacementPlan(plan: ImagePlacementPlan): string {
  return canonicalJson(plan);
}

export function parsePlacementPlan(value: unknown): { plan: ImagePlacementPlan | null; errors: RendererValidationIssue[] } {
  if (!value || typeof value !== "object") return { plan: null, errors: [issue("KBR-INPUT-002", "ERROR", "input.schema_mismatch", { path: "" })] };
  const candidate = value as Partial<ImagePlacementPlan>;
  const errors: RendererValidationIssue[] = [];
  const allowed = new Set(["schemaVersion", "imageSlotId", "assetId", "policy", "source", "fitMode", "cropRect", "focalPoint", "anchor", "subjectProtection", "cropCandidateId", "confidence", "protectedSubjects", "rationale"]);
  for (const key of Object.keys(value)) if (!allowed.has(key)) errors.push(issue("KBR-INPUT-002", "ERROR", "input.additional_property", { path: `/${key}` }));
  if (candidate.schemaVersion !== INTEGRATION_SCHEMA_VERSION) errors.push(issue("KBR-INPUT-002", "ERROR", "input.schema_version_invalid", { path: "/schemaVersion", expected: INTEGRATION_SCHEMA_VERSION }));
  if (typeof candidate.imageSlotId !== "string" || !candidate.imageSlotId) errors.push(issue("KBR-INPUT-002", "ERROR", "input.type_invalid", { path: "/imageSlotId" }));
  if (typeof candidate.assetId !== "string" || !candidate.assetId) errors.push(issue("KBR-INPUT-002", "ERROR", "input.type_invalid", { path: "/assetId" }));
  if (!candidate.policy || !["ALPHA_TRIM_CONTAIN", "CENTER_CONTAIN", "SEMANTIC_CROP_COVER", "MANUAL_CROP"].includes(candidate.policy)) errors.push(issue("KBR-INPUT-002", "ERROR", "input.enum_invalid", { path: "/policy" }));
  if (!candidate.source || !["DETERMINISTIC", "MANUAL", "AGENT", "SAVED_CREATIVE"].includes(candidate.source)) errors.push(issue("KBR-INPUT-002", "ERROR", "input.enum_invalid", { path: "/source" }));
  if (!candidate.fitMode || !["CONTAIN", "COVER"].includes(candidate.fitMode)) errors.push(issue("KBR-INPUT-002", "ERROR", "input.enum_invalid", { path: "/fitMode" }));
  if (!candidate.anchor || !["CENTER", "CENTER_LEFT", "CENTER_RIGHT", "TOP_CENTER", "TOP_LEFT", "TOP_RIGHT", "BOTTOM_CENTER", "BOTTOM_LEFT", "BOTTOM_RIGHT"].includes(candidate.anchor)) errors.push(issue("KBR-INPUT-002", "ERROR", "input.enum_invalid", { path: "/anchor" }));
  if (!candidate.subjectProtection || !["REQUIRED", "PREFERRED", "NONE"].includes(candidate.subjectProtection)) errors.push(issue("KBR-INPUT-002", "ERROR", "input.enum_invalid", { path: "/subjectProtection" }));
  if (candidate.cropRect !== undefined) {
    if (!candidate.cropRect || typeof candidate.cropRect !== "object") errors.push(issue("KBR-INPUT-002", "ERROR", "input.type_invalid", { path: "/cropRect" }));
    else {
      for (const key of Object.keys(candidate.cropRect)) if (!["x", "y", "width", "height"].includes(key)) errors.push(issue("KBR-INPUT-002", "ERROR", "input.additional_property", { path: `/cropRect/${key}` }));
      for (const key of ["x", "y", "width", "height"] as const) if (!isFiniteNumber(candidate.cropRect[key])) errors.push(issue("KBR-INPUT-002", "ERROR", "input.type_invalid", { path: `/cropRect/${key}` }));
    }
  }
  if (candidate.focalPoint !== undefined) {
    if (!candidate.focalPoint || typeof candidate.focalPoint !== "object") errors.push(issue("KBR-INPUT-002", "ERROR", "input.type_invalid", { path: "/focalPoint" }));
    else {
      for (const key of Object.keys(candidate.focalPoint)) if (!["x", "y"].includes(key)) errors.push(issue("KBR-INPUT-002", "ERROR", "input.additional_property", { path: `/focalPoint/${key}` }));
      if (!isFiniteNumber(candidate.focalPoint.x)) errors.push(issue("KBR-INPUT-002", "ERROR", "input.type_invalid", { path: "/focalPoint/x" }));
      if (!isFiniteNumber(candidate.focalPoint.y)) errors.push(issue("KBR-INPUT-002", "ERROR", "input.type_invalid", { path: "/focalPoint/y" }));
    }
  }
  if (candidate.protectedSubjects !== undefined) {
    if (!Array.isArray(candidate.protectedSubjects)) errors.push(issue("KBR-INPUT-002", "ERROR", "input.type_invalid", { path: "/protectedSubjects" }));
    else for (const [index, subject] of candidate.protectedSubjects.entries()) {
      if (!subject || typeof subject !== "object") errors.push(issue("KBR-INPUT-002", "ERROR", "input.type_invalid", { path: `/protectedSubjects/${index}` }));
      else {
        for (const key of Object.keys(subject)) if (!["subjectId", "subjectType", "bounds"].includes(key)) errors.push(issue("KBR-INPUT-002", "ERROR", "input.additional_property", { path: `/protectedSubjects/${index}/${key}` }));
        if (typeof subject.subjectId !== "string" || !subject.subjectId) errors.push(issue("KBR-INPUT-002", "ERROR", "input.type_invalid", { path: `/protectedSubjects/${index}/subjectId` }));
        if (!["PRODUCT", "PERSON", "FACE", "LOGO", "TEXT", "OTHER"].includes(subject.subjectType as string)) errors.push(issue("KBR-INPUT-002", "ERROR", "input.enum_invalid", { path: `/protectedSubjects/${index}/subjectType` }));
        if (!subject.bounds || typeof subject.bounds !== "object") errors.push(issue("KBR-INPUT-002", "ERROR", "input.type_invalid", { path: `/protectedSubjects/${index}/bounds` }));
        else for (const key of Object.keys(subject.bounds)) if (!["x", "y", "width", "height"].includes(key)) errors.push(issue("KBR-INPUT-002", "ERROR", "input.additional_property", { path: `/protectedSubjects/${index}/bounds/${key}` }));
      }
    }
  }
  if (errors.length > 0) return { plan: null, errors: sortIssues(errors) };
  return { plan: candidate as ImagePlacementPlan, errors: [] };
}

export const CAPABILITIES: Readonly<Record<string, ImagePlacementCapability>> = Object.freeze({
  KAKAO_BIZBOARD_OBJECT_RIGHT: Object.freeze({ schemaVersion: INTEGRATION_SCHEMA_VERSION, implementationStatus: "IMPLEMENTED", defaultPolicy: "ALPHA_TRIM_CONTAIN", semanticPlacement: "NOT_REQUIRED", allowedPolicies: ["ALPHA_TRIM_CONTAIN"] as const, supportsManualCrop: false, supportsAgentPlacement: false, imageSlotIds: [OBJECT_RIGHT_IMAGE_SLOT_ID] as const }),
  KAKAO_BIZBOARD_THUMBNAIL_BOX_RIGHT: Object.freeze({ schemaVersion: INTEGRATION_SCHEMA_VERSION, implementationStatus: "IMPLEMENTED", defaultPolicy: "SEMANTIC_CROP_COVER", semanticPlacement: "REQUIRED", allowedPolicies: ["SEMANTIC_CROP_COVER", "MANUAL_CROP"] as const, supportsManualCrop: true, supportsAgentPlacement: true, imageSlotIds: [THUMBNAIL_BOX_RIGHT_IMAGE_SLOT_ID] as const }),
  KAKAO_BIZBOARD_THUMBNAIL_MULTI_RIGHT: Object.freeze({ schemaVersion: INTEGRATION_SCHEMA_VERSION, implementationStatus: "NOT_IMPLEMENTED", defaultPolicy: "SEMANTIC_CROP_COVER", semanticPlacement: "REQUIRED", allowedPolicies: ["SEMANTIC_CROP_COVER", "MANUAL_CROP"] as const, supportsManualCrop: false, supportsAgentPlacement: false }),
  KAKAO_BIZBOARD_MASK_SEMICIRCLE_RIGHT: Object.freeze({ schemaVersion: INTEGRATION_SCHEMA_VERSION, implementationStatus: "NOT_IMPLEMENTED", defaultPolicy: "SEMANTIC_CROP_COVER", semanticPlacement: "REQUIRED", allowedPolicies: ["SEMANTIC_CROP_COVER", "MANUAL_CROP"] as const, supportsManualCrop: false, supportsAgentPlacement: false }),
  KAKAO_NATIVE_1200: Object.freeze({ schemaVersion: INTEGRATION_SCHEMA_VERSION, implementationStatus: "NOT_IMPLEMENTED", defaultPolicy: "SEMANTIC_CROP_COVER", semanticPlacement: "REQUIRED", allowedPolicies: ["SEMANTIC_CROP_COVER", "MANUAL_CROP"] as const, supportsManualCrop: false, supportsAgentPlacement: false }),
  NAVER_GFA_IMAGE_BANNER: Object.freeze({ schemaVersion: INTEGRATION_SCHEMA_VERSION, implementationStatus: "NOT_IMPLEMENTED", defaultPolicy: "SEMANTIC_CROP_COVER", semanticPlacement: "REQUIRED", allowedPolicies: ["SEMANTIC_CROP_COVER", "MANUAL_CROP"] as const, supportsManualCrop: false, supportsAgentPlacement: false }),
});

export function getCapability(formatProfileId: string): ImagePlacementCapability | null {
  return CAPABILITIES[formatProfileId] ?? null;
}

export async function sha256Hex(bytes: Uint8Array | string): Promise<string> {
  const data = typeof bytes === "string" ? new TextEncoder().encode(bytes) : bytes;
  const digest = await globalThis.crypto.subtle.digest("SHA-256", data as Uint8Array<ArrayBuffer>);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export async function computeFingerprints(input: RendererIntegrationInputV1, assetDigests: Readonly<Record<string, string>>, resolvedPlans: readonly ImagePlacementPlan[]): Promise<{ requestFingerprint: string; pixelFingerprint: string }> {
  const requestFingerprint = await sha256Hex(canonicalJson(input));
  const pixelInput = {
    formatProfileId: input.formatProfileId,
    templateId: input.templateId,
    copy: input.copy,
    assets: input.assets.map((asset) => ({ assetId: asset.assetId, mimeType: asset.mimeType, digest: assetDigests[asset.assetId] ?? "" })),
    imagePlacementPlans: resolvedPlans.map((plan) => ({ imageSlotId: plan.imageSlotId, assetId: plan.assetId, policy: plan.policy, fitMode: plan.fitMode, cropRect: plan.cropRect, anchor: plan.anchor, subjectProtection: plan.subjectProtection })),
    output: input.output,
    templateContractVersion: "1.3.0",
  };
  const pixelFingerprint = await sha256Hex(canonicalJson(pixelInput));
  return { requestFingerprint, pixelFingerprint };
}

export type LegacyObjectRightInput = Readonly<{
  channel: "KAKAO_MOMENT";
  placement: "BIZBOARD";
  template: "OBJECT_RIGHT";
  advertiser: string;
  copy: { headline: string; subcopy: string };
  cta: { mode: "NONE"; label: "" };
  product: { relativePath: string; expectedSha256: string };
  output: { directory: string; baseName: string; overwrite: false };
  canvas: { width: 1029; height: 258 };
}>;

export type LegacyRenderResult = Readonly<{
  bytes: Uint8Array;
  width: number;
  height: number;
  mimeType: "image/png";
  appliedImagePlacement?: AppliedImagePlacement;
}>;

export type ThumbnailRenderRequest = Readonly<{
  input: RendererIntegrationInputV1;
  asset: RendererAssetDescriptor;
  resolvedAsset: AssetResolverResult;
  resolvedPlan: ImagePlacementPlan;
  resolvedSourceCropRect: NormalizedRect;
}>;

export type IntegrationAdapterDependencies = Readonly<{
  resolver: RendererAssetResolver;
  renderLegacy?: (input: LegacyObjectRightInput, resolvedAsset: AssetResolverResult) => Promise<LegacyRenderResult>;
  renderThumbnail?: (request: ThumbnailRenderRequest) => Promise<LegacyRenderResult>;
  assetDigests?: Readonly<Record<string, string>>;
}>;

function inspectResolvedPng(bytes: Uint8Array): { width: number; height: number; hasAlpha: boolean } | null {
  if (bytes.byteLength < 26 || bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47 || bytes[4] !== 0x0d || bytes[5] !== 0x0a || bytes[6] !== 0x1a || bytes[7] !== 0x0a) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(12) !== 0x49484452) return null;
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  const colorType = view.getUint8(25);
  return { width, height, hasAlpha: colorType === 4 || colorType === 6 };
}

export async function renderWithIntegrationAdapter(
  input: RendererIntegrationInputV1,
  dependencies: IntegrationAdapterDependencies,
): Promise<RendererIntegrationOutputV1> {
  const capability = getCapability(input.formatProfileId);
  const context: ContractValidationContext = capability
    ? {
        allowedPolicies: capability.allowedPolicies,
        ...(capability.imageSlotIds ? { requiredImageSlotIds: capability.imageSlotIds, allowedImageSlotIds: capability.imageSlotIds } : {}),
      }
    : {};
  const initialIssues = capability && capability.implementationStatus === "IMPLEMENTED"
    ? validateIntegrationInput(input, context)
    : [issue("KBR-TEMPLATE-CONSTRAINT-VIOLATION", "ERROR", "template.capability_not_implemented", { path: "/formatProfileId", actual: input.formatProfileId })];
  if (input.formatProfileId === OBJECT_RIGHT_FORMAT_PROFILE_ID && input.templateId !== OBJECT_RIGHT_TEMPLATE_ID) initialIssues.push(issue("KBR-TEMPLATE-CONSTRAINT-VIOLATION", "ERROR", "template.template_id_mismatch", { path: "/templateId", actual: input.templateId, expected: OBJECT_RIGHT_TEMPLATE_ID }));
  if (input.formatProfileId === THUMBNAIL_BOX_RIGHT_FORMAT_PROFILE_ID && input.templateId !== THUMBNAIL_BOX_RIGHT_TEMPLATE_ID) initialIssues.push(issue("KBR-TEMPLATE-CONSTRAINT-VIOLATION", "ERROR", "template.template_id_mismatch", { path: "/templateId", actual: input.templateId, expected: THUMBNAIL_BOX_RIGHT_TEMPLATE_ID }));
  const assetDigests: Record<string, string> = { ...(dependencies.assetDigests ?? {}) };
  const resolvedPlans = input.imagePlacementPlans.map((plan) => {
    const candidate = input.cropCandidates?.find((item) => item.candidateId === plan.cropCandidateId);
    return candidate && !plan.cropRect ? { ...plan, cropRect: candidate.cropRect } : plan;
  });
  const issues = [...initialIssues];
  let renderResult: LegacyRenderResult | undefined;
  if (issues.every((entry) => entry.severity !== "ERROR")) {
    const asset = input.assets.find((entry) => entry.assetId === input.imagePlacementPlans[0]?.assetId);
    if (!asset) issues.push(issue("KBR-ASSET-NOT-FOUND", "ERROR", "asset.not_found", { path: "/imagePlacementPlans/0/assetId" }));
    else {
      try {
        const resolved = await dependencies.resolver.resolve(asset.assetRef);
        const digest = await sha256Hex(resolved.bytes);
        assetDigests[asset.assetId] = digest;
        if (asset.checksumSha256 && asset.checksumSha256.toLowerCase() !== digest) issues.push(issue("KBR-ASSET-CHECKSUM-MISMATCH", "ERROR", "asset.checksum_mismatch", { path: "/assets", assetId: asset.assetId, actual: digest, expected: asset.checksumSha256 }));
        if (resolved.resolvedMimeType !== asset.mimeType) issues.push(issue("KBR-IMAGE-DECODE-FAILED", "ERROR", "asset.mime_type_mismatch", { path: "/assets", assetId: asset.assetId }));
        const pngMetadata = resolved.resolvedMimeType === "image/png" ? inspectResolvedPng(resolved.bytes) : null;
        if (resolved.resolvedMimeType === "image/png" && !pngMetadata) issues.push(issue("KBR-IMAGE-DECODE-FAILED", "ERROR", "asset.image_decode_failed", { path: "/assets", assetId: asset.assetId }));
        else if (pngMetadata) {
          if (asset.declaredWidth !== undefined && asset.declaredWidth !== pngMetadata.width || asset.declaredHeight !== undefined && asset.declaredHeight !== pngMetadata.height) issues.push(issue("KBR-ASSET-DIMENSION-MISMATCH", "ERROR", "asset.dimension_mismatch", { path: "/assets", assetId: asset.assetId, actual: { width: pngMetadata.width, height: pngMetadata.height }, expected: { width: asset.declaredWidth, height: asset.declaredHeight } }));
          if (input.imagePlacementPlans.some((plan) => plan.assetId === asset.assetId && plan.policy === "ALPHA_TRIM_CONTAIN") && !pngMetadata.hasAlpha) issues.push(issue("KBR-ALPHA-CHANNEL-REQUIRED", "ERROR", "asset.alpha_channel_required", { path: "/assets", assetId: asset.assetId }));
        }
        const copy = input.copy;
        if (!copy.advertiser || !copy.headline || !copy.subcopy) issues.push(issue("KBR-INPUT-007", "ERROR", "input.required_string_missing", { path: "/copy" }));
        if (issues.every((entry) => entry.severity !== "ERROR")) {
          const plan = resolvedPlans.find((entry) => entry.imageSlotId === input.imagePlacementPlans[0]?.imageSlotId);
          if (input.formatProfileId === THUMBNAIL_BOX_RIGHT_FORMAT_PROFILE_ID) {
            if (!dependencies.renderThumbnail) issues.push(issue("KBR-OUTPUT-INVALID", "ERROR", "output.thumbnail_renderer_missing", { path: "/artifact" }));
            else if (!plan?.cropRect) issues.push(issue("KBR-CROP-RECT-REQUIRED", "ERROR", "placement.semantic_crop_required", { path: "/imagePlacementPlans/0/cropRect" }));
            else {
              renderResult = await dependencies.renderThumbnail({ input, asset, resolvedAsset: resolved, resolvedPlan: plan, resolvedSourceCropRect: plan.cropRect });
            }
          } else if (dependencies.renderLegacy) {
            renderResult = await dependencies.renderLegacy({ channel: "KAKAO_MOMENT", placement: "BIZBOARD", template: "OBJECT_RIGHT", advertiser: copy.advertiser!, copy: { headline: copy.headline!, subcopy: copy.subcopy! }, cta: { mode: "NONE", label: "" }, product: { relativePath: `integration/${asset.assetId}`, expectedSha256: digest }, output: { directory: "integration-output", baseName: "output", overwrite: false }, canvas: { width: 1029, height: 258 } }, resolved);
          } else {
            issues.push(issue("KBR-OUTPUT-INVALID", "ERROR", "output.renderer_missing", { path: "/artifact" }));
          }
        }
      } catch (error) {
        issues.push(issue("KBR-ASSET-REF-UNRESOLVED", "ERROR", "asset.ref_unresolved", { path: "/assets", assetId: asset.assetId, message: error instanceof Error ? error.message : String(error) }));
      }
    }
  }
  const fingerprints = await computeFingerprints(input, assetDigests, resolvedPlans);
  const sorted = sortIssues(issues);
  const errors = sorted.filter((entry) => entry.severity === "ERROR");
  const warnings = sorted.filter((entry) => entry.severity === "WARNING");
  const info = sorted.filter((entry) => entry.severity === "INFO");
  if (!renderResult || errors.length > 0) return { schemaVersion: INTEGRATION_SCHEMA_VERSION, status: "BLOCKED", appliedImagePlacements: [], validation: { errors, warnings, info }, ...fingerprints, renderFingerprint: fingerprints.pixelFingerprint };
  if (renderResult.mimeType !== "image/png" || renderResult.width !== 1029 || renderResult.height !== 258) {
    const outputError = issue("KBR-OUTPUT-INVALID", "ERROR", "output.artifact_contract_invalid", { path: "/artifact", actual: { mimeType: renderResult.mimeType, width: renderResult.width, height: renderResult.height }, expected: { mimeType: "image/png", width: 1029, height: 258 } });
    return { schemaVersion: INTEGRATION_SCHEMA_VERSION, status: "BLOCKED", appliedImagePlacements: [], validation: { errors: [outputError], warnings, info }, ...fingerprints, renderFingerprint: fingerprints.pixelFingerprint };
  }
  if (!renderResult.appliedImagePlacement) {
    const placementError = issue("KBR-OUTPUT-INVALID", "ERROR", "output.applied_placement_missing", { path: "/appliedImagePlacements" });
    return { schemaVersion: INTEGRATION_SCHEMA_VERSION, status: "BLOCKED", appliedImagePlacements: [], validation: { errors: [placementError], warnings, info }, ...fingerprints, renderFingerprint: fingerprints.pixelFingerprint };
  }
  const requestedPlan = input.imagePlacementPlans.find((plan) => plan.imageSlotId === renderResult.appliedImagePlacement!.imageSlotId);
  if (renderResult.appliedImagePlacement.changedFromRequestedPlan !== false || !requestedPlan || renderResult.appliedImagePlacement.assetId !== requestedPlan.assetId || renderResult.appliedImagePlacement.policy !== requestedPlan.policy) {
    const placementError = issue("KBR-OUTPUT-INVALID", "ERROR", "output.applied_placement_changed", { path: "/appliedImagePlacements/0", expected: { changedFromRequestedPlan: false, imageSlotId: requestedPlan?.imageSlotId, assetId: requestedPlan?.assetId, policy: requestedPlan?.policy }, actual: renderResult.appliedImagePlacement });
    return { schemaVersion: INTEGRATION_SCHEMA_VERSION, status: "BLOCKED", appliedImagePlacements: [], validation: { errors: [placementError], warnings, info }, ...fingerprints, renderFingerprint: fingerprints.pixelFingerprint };
  }
  const artifactChecksum = await sha256Hex(renderResult.bytes);
  return { schemaVersion: INTEGRATION_SCHEMA_VERSION, status: "PASS", artifact: { mimeType: "image/png", width: renderResult.width, height: renderResult.height, bytes: renderResult.bytes.byteLength, checksumSha256: artifactChecksum }, appliedImagePlacements: [renderResult.appliedImagePlacement], validation: { errors, warnings, info }, ...fingerprints, renderFingerprint: fingerprints.pixelFingerprint };
}
