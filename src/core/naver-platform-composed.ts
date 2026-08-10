import type { ArtifactCardinality, NaverGfaPlacement } from "@kbr/renderer-contract";

export const NAVER_PLATFORM_SOURCE_SCHEMA_VERSION = "1.0.0" as const;
export type PlatformSourceCountingUnit = "CHARACTER" | "BYTE" | "KOREAN_ENGLISH_WEIGHTED" | "GRAPHEME" | "UNRESOLVED";
export type PlatformSourceSeverity = "ERROR" | "WARNING" | "INFO";

export type PlatformComposedSourceSpec = Readonly<{
  schemaVersion: typeof NAVER_PLATFORM_SOURCE_SCHEMA_VERSION;
  channel: "NAVER_GFA";
  placement: NaverGfaPlacement;
  compositionMode: "PLATFORM_COMPOSED";
  artifactCardinality: ArtifactCardinality;
  sourceProfileId: string;
  fields: Readonly<Record<string, unknown>>;
  assets: readonly PlatformSourceAsset[];
  metadata?: Readonly<Record<string, unknown>>;
}>;

export type PlatformSourceAsset = Readonly<{
  assetId: string;
  assetRole: string;
  sourceProfileId: string;
  mime: string;
  width: number;
  height: number;
  bytes: number;
  sha256?: string;
  hasAlpha?: boolean;
  safeArea?: Readonly<{ x: number; y: number; width: number; height: number }>;
  pathRef?: string;
}>;

export type PlatformSourceFieldRule = Readonly<{
  id: string;
  type?: "STRING" | "ENUM" | "BOOLEAN" | "URI" | string;
  required?: boolean | "UNRESOLVED";
  minLength?: number | null;
  maxLength?: number | null;
  maxLines?: number | null;
  maxCharactersPerLine?: number | null;
  countingUnit?: PlatformSourceCountingUnit;
  allowedValues?: readonly unknown[] | null;
  conditional?: string | null;
}>;

export type PlatformSourceAssetRule = Readonly<{
  id?: string;
  assetRole: string;
  required?: boolean | "UNRESOLVED";
  canvas?: Readonly<{
    width?: number;
    height?: number;
    minimumWidth?: number;
    aspectRatios?: readonly string[];
  }>;
  aspectRatio?: string;
  mime?: readonly string[];
  fileSize?: Readonly<{ minimumBytes?: number; maximumBytes?: number }>;
  alpha?: Readonly<{ allowed?: boolean | "UNRESOLVED" }>;
}>;

export type PlatformComposedProfile = Readonly<{
  id: string;
  placement: NaverGfaPlacement;
  artifactCardinality: ArtifactCardinality;
  fields: readonly PlatformSourceFieldRule[];
  assets: readonly PlatformSourceAssetRule[];
  collection?: Readonly<{ minimumItems?: number; maximumItems?: number }>;
  runtimeStatus?: string;
}>;

export type PlatformSourceValidationIssue = Readonly<{
  code: string;
  severity: PlatformSourceSeverity;
  messageKey: string;
  path: string;
  actual?: unknown;
  expected?: unknown;
}>;

export type PlatformSourceValidationResult = Readonly<{
  status: "PASS" | "WARNING" | "ERROR";
  errors: readonly PlatformSourceValidationIssue[];
  warnings: readonly PlatformSourceValidationIssue[];
  info: readonly PlatformSourceValidationIssue[];
  normalized: PlatformComposedSourceSpec | null;
  finalUiRendered: false;
  pixelFingerprint: null;
}>;

const severityOrder: Record<PlatformSourceSeverity, number> = { ERROR: 0, WARNING: 1, INFO: 2 };

function issue(
  code: string,
  severity: PlatformSourceSeverity,
  messageKey: string,
  path: string,
  actual?: unknown,
  expected?: unknown,
): PlatformSourceValidationIssue {
  return { code, severity, messageKey, path, ...(actual === undefined ? {} : { actual }), ...(expected === undefined ? {} : { expected }) };
}

function sortIssues(issues: readonly PlatformSourceValidationIssue[]): PlatformSourceValidationIssue[] {
  return [...issues].sort((a, b) => {
    const severity = severityOrder[a.severity] - severityOrder[b.severity];
    if (severity !== 0) return severity;
    const path = a.path.localeCompare(b.path);
    if (path !== 0) return path;
    const code = a.code.localeCompare(b.code);
    if (code !== 0) return code;
    return a.messageKey.localeCompare(b.messageKey);
  });
}

function valueIsMissing(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === "string" && value.length === 0);
}

function characterLength(value: string): number {
  return Array.from(value).length;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasForbiddenFinalGeometry(value: unknown, path = ""): string | null {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = hasForbiddenFinalGeometry(value[index], `${path}/${index}`);
      if (found) return found;
    }
    return null;
  }
  if (!isPlainObject(value)) return null;
  for (const [key, child] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase();
    if (["canvas", "coordinates", "finalcanvas", "finalcoordinates", "finaluicoordinates", "pixelfingerprint"].includes(normalizedKey)) {
      return `${path}/${key}`;
    }
    const found = hasForbiddenFinalGeometry(child, `${path}/${key}`);
    if (found) return found;
  }
  return null;
}

function normalizeValue(value: unknown): unknown {
  if (typeof value === "string") return value.normalize("NFC");
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (isPlainObject(value)) return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, normalizeValue(child)]));
  return value;
}

/** NFC-only normalization. It does not trim, rewrite, shorten, select CTA labels, or make layout decisions. */
export function normalizePlatformComposedSource(spec: PlatformComposedSourceSpec): PlatformComposedSourceSpec {
  return normalizeValue(spec) as PlatformComposedSourceSpec;
}

function validateField(value: unknown, rule: PlatformSourceFieldRule, path: string): PlatformSourceValidationIssue[] {
  const issues: PlatformSourceValidationIssue[] = [];
  if (rule.required === true && valueIsMissing(value)) {
    issues.push(issue("KBR-NAVER-SOURCE-FIELD-REQUIRED", "ERROR", "naver_source.field_required", path, value, true));
    return issues;
  }
  if (valueIsMissing(value)) return issues;
  if ((rule.type === "STRING" || rule.type === "URI" || rule.countingUnit === "CHARACTER") && typeof value !== "string") {
    issues.push(issue("KBR-NAVER-SOURCE-FIELD-TYPE", "ERROR", "naver_source.field_type", path, typeof value, "string"));
    return issues;
  }
  if (rule.type === "BOOLEAN" && typeof value !== "boolean") {
    issues.push(issue("KBR-NAVER-SOURCE-FIELD-TYPE", "ERROR", "naver_source.field_type", path, typeof value, "boolean"));
    return issues;
  }
  if (typeof value === "string" && rule.countingUnit === "CHARACTER") {
    const length = characterLength(value);
    if (rule.minLength !== null && rule.minLength !== undefined && length < rule.minLength) issues.push(issue("KBR-NAVER-SOURCE-FIELD-LENGTH", "ERROR", "naver_source.field_length", path, length, { minimum: rule.minLength, maximum: rule.maxLength }));
    if (rule.maxLength !== null && rule.maxLength !== undefined && length > rule.maxLength) issues.push(issue("KBR-NAVER-SOURCE-FIELD-LENGTH", "ERROR", "naver_source.field_length", path, length, { minimum: rule.minLength, maximum: rule.maxLength }));
  }
  if (rule.allowedValues && !rule.allowedValues.some((allowed) => Object.is(allowed, value))) {
    issues.push(issue("KBR-NAVER-SOURCE-FIELD-ENUM", "ERROR", "naver_source.field_enum", path, value, rule.allowedValues));
  }
  return issues;
}

function aspectRatioMatches(width: number, height: number, expected: string): boolean {
  if (!expected || expected.includes("|")) return expected.split("|").some((entry) => aspectRatioMatches(width, height, entry));
  const [expectedWidth = Number.NaN, expectedHeight = Number.NaN] = expected.split(":").map(Number);
  if (!Number.isFinite(expectedWidth) || !Number.isFinite(expectedHeight) || expectedHeight === 0) return true;
  return Math.abs(width / height - expectedWidth / expectedHeight) < 1e-6;
}

function validateAsset(asset: PlatformSourceAsset, rule: PlatformSourceAssetRule, path: string): PlatformSourceValidationIssue[] {
  const issues: PlatformSourceValidationIssue[] = [];
  if (rule.canvas?.width !== undefined && asset.width !== rule.canvas.width || rule.canvas?.height !== undefined && asset.height !== rule.canvas.height) {
    issues.push(issue("KBR-NAVER-SOURCE-ASSET-DIMENSION", "ERROR", "naver_source.asset_dimension", path, { width: asset.width, height: asset.height }, rule.canvas));
  }
  if (rule.canvas?.minimumWidth !== undefined && asset.width < rule.canvas.minimumWidth) issues.push(issue("KBR-NAVER-SOURCE-ASSET-DIMENSION", "ERROR", "naver_source.asset_dimension", path, asset.width, { minimumWidth: rule.canvas.minimumWidth }));
  const ratios = rule.canvas?.aspectRatios ?? [];
  if (ratios.length > 0 && !ratios.some((ratio) => aspectRatioMatches(asset.width, asset.height, ratio))) issues.push(issue("KBR-NAVER-SOURCE-ASSET-ASPECT-RATIO", "ERROR", "naver_source.asset_aspect_ratio", path, `${asset.width}:${asset.height}`, ratios));
  if (rule.aspectRatio && !["SAME_AS_VIDEO", "1.5:1"].includes(rule.aspectRatio) && !aspectRatioMatches(asset.width, asset.height, rule.aspectRatio)) issues.push(issue("KBR-NAVER-SOURCE-ASSET-ASPECT-RATIO", "ERROR", "naver_source.asset_aspect_ratio", path, `${asset.width}:${asset.height}`, rule.aspectRatio));
  if (rule.mime && !rule.mime.includes(asset.mime)) issues.push(issue("KBR-NAVER-SOURCE-ASSET-MIME", "ERROR", "naver_source.asset_mime", path, asset.mime, rule.mime));
  if (rule.fileSize?.minimumBytes !== undefined && asset.bytes < rule.fileSize.minimumBytes || rule.fileSize?.maximumBytes !== undefined && asset.bytes > rule.fileSize.maximumBytes) issues.push(issue("KBR-NAVER-SOURCE-ASSET-FILESIZE", "ERROR", "naver_source.asset_filesize", path, asset.bytes, rule.fileSize));
  if (typeof rule.alpha?.allowed === "boolean" && asset.hasAlpha !== undefined && asset.hasAlpha !== rule.alpha.allowed) issues.push(issue("KBR-NAVER-SOURCE-ASSET-ALPHA", "ERROR", "naver_source.asset_alpha", path, asset.hasAlpha, rule.alpha.allowed));
  return issues;
}

/** Validates source payload constraints only; it never renders, crops, truncates, or computes a final pixel fingerprint. */
export function validatePlatformComposedSource(spec: PlatformComposedSourceSpec, profile: PlatformComposedProfile): PlatformSourceValidationResult {
  const issues: PlatformSourceValidationIssue[] = [];
  const forbiddenPath = hasForbiddenFinalGeometry(spec);
  if (forbiddenPath) issues.push(issue("KBR-NAVER-SOURCE-FINAL-GEOMETRY-FORBIDDEN", "ERROR", "naver_source.final_geometry_forbidden", forbiddenPath));
  if (spec.schemaVersion !== NAVER_PLATFORM_SOURCE_SCHEMA_VERSION) issues.push(issue("KBR-NAVER-SOURCE-SCHEMA-VERSION", "ERROR", "naver_source.schema_version", "/schemaVersion", spec.schemaVersion, NAVER_PLATFORM_SOURCE_SCHEMA_VERSION));
  if (spec.channel !== "NAVER_GFA") issues.push(issue("KBR-NAVER-SOURCE-CHANNEL", "ERROR", "naver_source.channel", "/channel", spec.channel, "NAVER_GFA"));
  if (spec.compositionMode !== "PLATFORM_COMPOSED") issues.push(issue("KBR-NAVER-SOURCE-COMPOSITION", "ERROR", "naver_source.composition_mode", "/compositionMode", spec.compositionMode, "PLATFORM_COMPOSED"));
  if (spec.placement !== profile.placement) issues.push(issue("KBR-NAVER-SOURCE-PLACEMENT", "ERROR", "naver_source.placement", "/placement", spec.placement, profile.placement));
  if (spec.sourceProfileId !== profile.id) issues.push(issue("KBR-NAVER-SOURCE-PROFILE", "ERROR", "naver_source.profile", "/sourceProfileId", spec.sourceProfileId, profile.id));
  if (spec.artifactCardinality !== profile.artifactCardinality) issues.push(issue("KBR-NAVER-SOURCE-CARDINALITY", "ERROR", "naver_source.cardinality", "/artifactCardinality", spec.artifactCardinality, profile.artifactCardinality));

  const knownFields = new Set(profile.fields.map((field) => field.id));
  for (const [fieldId, value] of Object.entries(spec.fields ?? {})) {
    if (!knownFields.has(fieldId)) issues.push(issue("KBR-NAVER-SOURCE-FIELD-UNKNOWN", "ERROR", "naver_source.field_unknown", `/fields/${fieldId}`, value));
  }
  for (const rule of profile.fields) issues.push(...validateField(spec.fields?.[rule.id], rule, `/fields/${rule.id}`));

  const rulesByRole = new Map<string, PlatformSourceAssetRule[]>();
  for (const rule of profile.assets) rulesByRole.set(rule.assetRole, [...(rulesByRole.get(rule.assetRole) ?? []), rule]);
  for (const [role, rules] of rulesByRole) {
    const assets = spec.assets.filter((asset) => asset.assetRole === role);
    const required = rules.some((rule) => rule.required === true);
    if (required && assets.length === 0) issues.push(issue("KBR-NAVER-SOURCE-ASSET-REQUIRED", "ERROR", "naver_source.asset_required", "/assets", undefined, role));
    for (const asset of assets) {
      const matchingRule = rules.find((rule) => rule.id !== undefined && rule.id === asset.sourceProfileId)
        ?? rules.find((rule) => rule.id === undefined && rule.assetRole === asset.assetRole)
        ?? (rules.length === 1 ? rules[0] : undefined);
      if (!matchingRule) issues.push(issue("KBR-NAVER-SOURCE-ASSET-PROFILE", "ERROR", "naver_source.asset_profile", `/assets/${asset.assetId}`, asset.sourceProfileId, rules.map((rule) => rule.id)));
      else issues.push(...validateAsset(asset, matchingRule, `/assets/${asset.assetId}`));
    }
  }
  for (const asset of spec.assets) {
    if (!rulesByRole.has(asset.assetRole)) issues.push(issue("KBR-NAVER-SOURCE-ASSET-UNKNOWN", "ERROR", "naver_source.asset_unknown", `/assets/${asset.assetId}`, asset.assetRole));
  }
  if (profile.artifactCardinality === "COLLECTION" && profile.collection) {
    const itemCount = isPlainObject(spec.metadata) && typeof spec.metadata.itemCount === "number" ? spec.metadata.itemCount : null;
    if (itemCount === null) issues.push(issue("KBR-NAVER-SOURCE-COLLECTION-COUNT", "ERROR", "naver_source.collection_count_required", "/metadata/itemCount"));
    else if (profile.collection.minimumItems !== undefined && itemCount < profile.collection.minimumItems || profile.collection.maximumItems !== undefined && itemCount > profile.collection.maximumItems) issues.push(issue("KBR-NAVER-SOURCE-COLLECTION-COUNT", "ERROR", "naver_source.collection_count", "/metadata/itemCount", itemCount, profile.collection));
  }
  if (profile.runtimeStatus && profile.runtimeStatus !== "IMPLEMENTED") issues.push(issue("KBR-NAVER-SOURCE-RUNTIME-DEFERRED", "WARNING", "naver_source.runtime_deferred", "/sourceProfileId", profile.runtimeStatus));

  const sorted = sortIssues(issues);
  const errors = sorted.filter((entry) => entry.severity === "ERROR");
  const warnings = sorted.filter((entry) => entry.severity === "WARNING");
  const info = sorted.filter((entry) => entry.severity === "INFO");
  return {
    status: errors.length > 0 ? "ERROR" : warnings.length > 0 ? "WARNING" : "PASS",
    errors,
    warnings,
    info,
    normalized: errors.length > 0 ? null : normalizePlatformComposedSource(spec),
    finalUiRendered: false,
    pixelFingerprint: null,
  };
}

export function platformComposedSourceHasFinalPixelOutput(result: PlatformSourceValidationResult): false {
  return result.finalUiRendered;
}
