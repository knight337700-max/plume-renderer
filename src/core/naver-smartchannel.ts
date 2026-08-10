import { readFile } from "node:fs/promises";
import path from "node:path";

import { createCanvas, GlobalFonts, ImageData, type Canvas } from "@napi-rs/canvas";
import sharp from "sharp";

import type { ContractBundle } from "./contracts.js";
import { canonicalDigest, canonicalJson } from "./canonical.js";
import { createIssue, sortAndDedupeIssues, splitIssues } from "./errors.js";
import { sha256Bytes } from "./hash.js";
import { inspectImageFile } from "./image-input.js";
import {
  evaluateFontIdentity,
  getSmartChannelFontDirectory,
  inspectFontIdentity,
  preflightExternalExactFont,
  type SmartChannelFontRequirement,
} from "./naver-smartchannel-font-preflight.js";
import { PathSecurityError, resolveTrustedInputFile, resolveTrustedJobDirectory, resolveTrustedRoot } from "./path-security.js";
import { publishArtifacts, PublishError } from "./publish.js";
import { inspectPngIhdr } from "./raster.js";
import { SchemaValidators } from "./schema-validation.js";
import type {
  BBox,
  RenderManifest,
  RenderResponse,
  SmartChannelReport,
  SmartChannelTextRoleReport,
  ValidationIssue,
} from "./types.js";

export const NAVER_SMARTCHANNEL_FORMAT_PROFILE_ID = "NAVER_GFA_SMARTCHANNEL";
export const NAVER_SMARTCHANNEL_CANVAS_WIDTH = 750;
export const NAVER_SMARTCHANNEL_HEIGHTS = [160, 200, 280] as const;
const NAVER_SMARTCHANNEL_PNG_ENCODER_VERSION = "napi-rs-canvas-png-v1";

type SmartChannelJson = Record<string, unknown>;
type SmartChannelAsset = { path: string; expectedSha256?: string | null };
type SmartChannelContent = {
  headline?: string;
  headlineLine2?: string;
  subcopy?: string;
  subcopyLine4?: string;
  disclosureLine1?: string;
  disclosureLine2?: string;
  ctaOption?: string;
};

export type SmartChannelRenderRequest = {
  schemaVersion?: "1.0.0";
  channel: "NAVER_GFA";
  placement: "SMARTCHANNEL";
  layoutMode?: "TEMPLATE_LOCKED";
  compositionMode?: "RENDERER_COMPOSED";
  artifactCardinality?: "SINGLE";
  templateId: string;
  content: SmartChannelContent;
  assets: { object: SmartChannelAsset; advertiserLogo?: SmartChannelAsset };
  output: { directory: string; baseName: string; overwrite?: boolean };
};

export type SmartChannelRenderOptions = {
  projectRoot: string;
  inputRoot: string;
  outputRoot: string;
  contracts: ContractBundle;
  publish?: boolean;
};

export type SmartChannelRenderResult = RenderResponse & {
  png?: Buffer | null;
  report?: SmartChannelReport;
};

type NaverTemplate = {
  templateId: string;
  height: number;
  family: string;
  objectKind: string;
  side: string;
  textVariant: string;
  affordance: string;
  objectPlacementToken: string;
};

type NaverPlacementToken = {
  token: string;
  runtimeEnabled: boolean;
  sourceAssetRuleId: string;
  coordinateSpace: { type: string; canvas?: { width: number; height: number }; width?: number; height?: number };
  placementFrame: { x: number; y?: number; width: number; height?: number };
  fitMode: string;
  placementPolicy: string;
  sourceFrame?: { width: number; height: number; canvasTransform?: number[] } | undefined;
};

type NaverTextLayer = {
  layerPath: string;
  name: string;
  visible?: boolean;
  role: "HEADLINE" | "SUBCOPY" | "DISCLOSURE" | "CTA_LABEL";
  fontNames: string[];
  styleRuns: Array<Record<string, string>>;
  textPlacement: { originX: number; baselineY: number; boxX: number; boxY: number; boxWidth: number; boxHeight: number };
  pixelBounds: number[];
  typographyTokenId?: string;
};

type ResolvedFont = { token: string; path: string; digest: string; runtimePostScriptName: string };
type DecodedRgba = { bytes: Buffer; width: number; height: number };

const registeredNaverFonts = new Set<string>();

function jsonObject(value: unknown): SmartChannelJson {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as SmartChannelJson : {};
}

function jsonArray(value: unknown): SmartChannelJson[] {
  return Array.isArray(value) ? value.filter((entry): entry is SmartChannelJson => entry !== null && typeof entry === "object" && !Array.isArray(entry)) : [];
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function numberArray(value: unknown): number[] {
  return Array.isArray(value) ? value.filter((entry): entry is number => typeof entry === "number") : [];
}

function textValue(value: unknown): string | undefined {
  return typeof value === "string" ? value.normalize("NFC").trim() : undefined;
}

function failure(contracts: ContractBundle, issues: readonly ValidationIssue[], detail: { png?: Buffer | null; report?: SmartChannelReport } = {}): SmartChannelRenderResult {
  const sorted = sortAndDedupeIssues(issues);
  const { errors, warnings } = splitIssues(sorted);
  return {
    schemaVersion: "1.0.0",
    manifestDigest: null,
    pngDigest: null,
    manifestPath: null,
    pngPath: null,
    downloadAllowed: false,
    status: "FAIL",
    errors: errors.length > 0 ? errors : [createIssue(contracts.errorRegistry, "NAVER_SMARTCHANNEL_INPUT_INVALID", "/")],
    warnings,
    formatProfileId: NAVER_SMARTCHANNEL_FORMAT_PROFILE_ID,
    png: detail.png ?? null,
    ...(detail.report ? { report: detail.report } : {}),
  };
}

function templates(contract: Record<string, unknown>): NaverTemplate[] {
  return jsonArray(contract.templates).map((entry) => ({
    templateId: String(entry.templateId),
    height: Number(entry.height),
    family: String(entry.family),
    objectKind: String(entry.objectKind),
    side: String(entry.side),
    textVariant: String(entry.textVariant),
    affordance: String(entry.affordance),
    objectPlacementToken: String(entry.objectPlacementToken),
  }));
}

function placementTokens(contract: Record<string, unknown>): NaverPlacementToken[] {
  return jsonArray(contract.tokens).map((entry) => ({
    token: String(entry.token),
    runtimeEnabled: entry.runtimeEnabled === true,
    sourceAssetRuleId: String(entry.sourceAssetRuleId),
    coordinateSpace: jsonObject(entry.coordinateSpace) as NaverPlacementToken["coordinateSpace"],
    placementFrame: jsonObject(entry.placementFrame) as unknown as NaverPlacementToken["placementFrame"],
    fitMode: String(entry.fitMode),
    placementPolicy: String(entry.placementPolicy),
    ...(entry.sourceFrame ? { sourceFrame: jsonObject(entry.sourceFrame) as unknown as NaverPlacementToken["sourceFrame"] } : {}),
  }));
}

function normalizedPlacementFrame(token: NaverPlacementToken, canvasHeight: number): BBox {
  const sourceFrame = token.placementFrame;
  const coordinateCanvas = token.coordinateSpace.canvas;
  const height = Number(sourceFrame.height ?? coordinateCanvas?.height ?? canvasHeight);
  return {
    x: Number(sourceFrame.x),
    y: Number(sourceFrame.y ?? 0),
    width: Number(sourceFrame.width),
    height,
  };
}

function issueFor(contracts: ContractBundle, code: string, pathValue: string, expected?: unknown, actual?: unknown, stage: "PRE_RENDER" | "POST_RENDER" = "PRE_RENDER"): ValidationIssue {
  return createIssue(contracts.errorRegistry, code, pathValue, { expected, actual, stage, formatProfileId: NAVER_SMARTCHANNEL_FORMAT_PROFILE_ID });
}

function parseFillColor(value: string | undefined): string {
  if (!value) throw new Error("Typography token has no FillColor");
  const match = value.match(/Values':\s*\[([^\]]+)/u);
  if (!match?.[1]) throw new Error("Typography token FillColor is not parseable");
  const values = match[1].split(",").map((item) => Number(item.trim()));
  const redValue = values[1];
  const greenValue = values[2];
  const blueValue = values[3];
  if (redValue === undefined || greenValue === undefined || blueValue === undefined || [redValue, greenValue, blueValue].some((item) => !Number.isFinite(item))) throw new Error("Typography token FillColor is incomplete");
  const red = Math.round(redValue * 255).toString(16).padStart(2, "0");
  const green = Math.round(greenValue * 255).toString(16).padStart(2, "0");
  const blue = Math.round(blueValue * 255).toString(16).padStart(2, "0");
  return `#${red}${green}${blue}`;
}

function sourceFontToToken(fontName: string, compatibility: Record<string, unknown>): string | undefined {
  const match = jsonArray(compatibility.fonts).find((entry) => String(jsonObject(entry.source).expectedPostScriptName) === fontName);
  return match ? String(match.fontToken) : undefined;
}

function fontByToken(fonts: readonly ResolvedFont[], token: string): ResolvedFont | undefined {
  return fonts.find((font) => font.token === token);
}

function typographyForLayer(layer: NaverTextLayer, typography: Record<string, unknown>): { fontNames: string[]; styleRuns: Array<Record<string, string>> } | null {
  const token = jsonArray(typography.tokens).find((entry) => String(entry.id) === String(layer.typographyTokenId));
  if (!token) return null;
  const metadata = jsonObject(token.metadata);
  const fontNames = stringArray(metadata.fontNames);
  const styleRuns = jsonArray(metadata.styleRuns).map((entry) => Object.fromEntries(Object.entries(entry).filter(([, value]) => typeof value === "string")) as Record<string, string>);
  return fontNames.length > 0 && styleRuns.length > 0 ? { fontNames, styleRuns } : null;
}

async function preflightFonts(projectRoot: string, contracts: ContractBundle): Promise<{ fonts: ResolvedFont[]; issues: ValidationIssue[] }> {
  const policy = jsonObject(contracts.naverRuntimeFontPolicy);
  const runtimeAssets = jsonArray(policy.runtimeAssets);
  const issues: ValidationIssue[] = [];
  let fontRoot: string | null = getSmartChannelFontDirectory();
  if (!fontRoot) {
    const fallback = path.join(projectRoot, ".local-fonts", "naver-smartchannel");
    try {
      fontRoot = await resolveTrustedRoot(fallback);
    } catch {
      fontRoot = null;
    }
  }
  const fonts: ResolvedFont[] = [];
  const glyphCoverage = jsonObject(contracts.naverFontCompatibility.glyphCoverage);
  if (glyphCoverage.allFontsCovered !== true || jsonArray(glyphCoverage.perFont).some((entry) => entry.coverageStatus !== "PASS")) {
    issues.push(issueFor(contracts, "NAVER_SMARTCHANNEL_FONT_UNAVAILABLE", "/fonts/glyphCoverage", "all approved runtime fonts cover the frozen code points", glyphCoverage));
  }
  for (const asset of runtimeAssets) {
    const token = String(asset.id);
    const relativePath = String(asset.relativePath);
    const fileName = path.basename(relativePath);
    if (!fontRoot) {
      issues.push(issueFor(contracts, "NAVER_SMARTCHANNEL_FONT_UNAVAILABLE", `/fonts/${token}`, "trusted local font directory", "missing"));
      continue;
    }
    const requirement: SmartChannelFontRequirement = {
      requiredPostScriptName: String(asset.runtimePostScriptName),
      runtimePostScriptName: String(asset.runtimePostScriptName),
      fontToken: token,
      sourceIdentityStatus: "SOURCE_DIFFERENT_BUILD",
      compatibilityStatus: "PROJECT_COMPATIBLE_VERIFIED",
      allowedResolutionModes: ["EXTERNAL_EXACT"],
      expectedSha256: String(asset.runtimeDigest),
    };
    const result = await preflightExternalExactFont(requirement, {
      path: fileName,
      expectedPostScriptName: String(asset.runtimePostScriptName),
      expectedSha256: String(asset.runtimeDigest),
    }, { trustedRoot: fontRoot });
    if (result.status !== "PASS" || !result.resolvedPath || !result.digest) {
      for (const preflightIssue of result.issues) issues.push(issueFor(contracts, preflightIssue.code, `/fonts/${token}`, preflightIssue.expected, preflightIssue.actual));
      continue;
    }
    const bytes = await readFile(result.resolvedPath);
    const identity = inspectFontIdentity(bytes);
    if (!identity) {
      issues.push(issueFor(contracts, "NAVER_SMARTCHANNEL_FONT_UNAVAILABLE", `/fonts/${token}`, "decodable font", "undecodable"));
      continue;
    }
    const identityResult = evaluateFontIdentity(requirement, "EXTERNAL_EXACT", { postScriptNames: identity.postScriptNames, digest: result.digest, versions: identity.versions });
    if (identityResult.status !== "PASS") {
      for (const preflightIssue of identityResult.issues) issues.push(issueFor(contracts, preflightIssue.code, `/fonts/${token}`, preflightIssue.expected, preflightIssue.actual));
      continue;
    }
    if (!registeredNaverFonts.has(String(asset.runtimePostScriptName))) {
      const registered = GlobalFonts.registerFromPath(result.resolvedPath, String(asset.runtimePostScriptName));
      if (registered === null) {
        issues.push(issueFor(contracts, "NAVER_SMARTCHANNEL_FONT_UNAVAILABLE", `/fonts/${token}`, "registered font", "registerFromPath returned null"));
        continue;
      }
      registeredNaverFonts.add(String(asset.runtimePostScriptName));
    }
    fonts.push({ token, path: result.resolvedPath, digest: result.digest, runtimePostScriptName: String(asset.runtimePostScriptName) });
  }
  return { fonts, issues: sortAndDedupeIssues(issues) };
}

async function decodeRgba(bytes: Buffer): Promise<DecodedRgba> {
  const decoded = await sharp(bytes, { failOn: "error" }).rotate().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { bytes: Buffer.from(decoded.data), width: decoded.info.width, height: decoded.info.height };
}

function putImageData(canvas: Canvas, image: DecodedRgba, x: number, y: number): void {
  canvas.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(image.bytes.buffer, image.bytes.byteOffset, image.bytes.byteLength), image.width, image.height), x, y);
}

function alphaBounds(image: DecodedRgba, threshold = 8): BBox | null {
  let minX = image.width;
  let minY = image.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      if ((image.bytes[(y * image.width + x) * 4 + 3] ?? 0) < threshold) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return maxX < minX ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function transformedAlphaBounds(image: DecodedRgba, token: NaverPlacementToken): BBox | null {
  const source = alphaBounds(image);
  if (!source) return null;
  if (token.coordinateSpace.type === "FULL_CANVAS_SOURCE") return source;
  if (token.coordinateSpace.type === "SLOT_LOCAL_SOURCE") return { ...source, x: source.x + Number(token.placementFrame.x), y: source.y + Number(token.placementFrame.y ?? 0) };
  const transform = token.sourceFrame?.canvasTransform;
  if (!transform) return null;
  const x = Number(transform[0]);
  const y = Number(transform[1]);
  const width = Number(transform[2]) - x;
  const height = Number(transform[5]) - y;
  const transformed = { x: Math.round(x + (source.x / image.width) * width), y: Math.round(y + (source.y / image.height) * height), width: Math.max(1, Math.round((source.width / image.width) * width)), height: Math.max(1, Math.round((source.height / image.height) * height)) };
  const canvas = token.coordinateSpace.canvas;
  if (!canvas) return transformed;
  const left = Math.max(0, transformed.x);
  const top = Math.max(0, transformed.y);
  const right = Math.min(canvas.width, transformed.x + transformed.width);
  const bottom = Math.min(canvas.height, transformed.y + transformed.height);
  return right <= left || bottom <= top ? null : { x: left, y: top, width: right - left, height: bottom - top };
}

function containedBy(inner: BBox | null, outer: BBox): boolean {
  return inner === null || inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height;
}

async function verifiedAsset(relativePath: string, expectedSha256: string | null | undefined, contracts: ContractBundle, inputRoot: string, pointer: string): Promise<{ path: string; bytes: Buffer; digest: string; mime: "image/png" | "image/jpeg"; image: DecodedRgba } | null> {
  let filePath: string;
  try {
    filePath = await resolveTrustedInputFile(inputRoot, relativePath);
  } catch (error) {
    throw issueFor(contracts, error instanceof PathSecurityError ? "KBR-INPUT-009" : "NAVER_SMARTCHANNEL_ASSET_MISSING", pointer, "trusted input file", error instanceof Error ? error.message : String(error));
  }
  try {
    const inspected = await inspectImageFile(filePath);
    const digest = sha256Bytes(inspected.bytes);
    if (expectedSha256 && expectedSha256.toLowerCase() !== digest) throw issueFor(contracts, "NAVER_SMARTCHANNEL_ASSET_DIGEST_MISMATCH", pointer, expectedSha256.toLowerCase(), digest);
    const image = await decodeRgba(inspected.bytes);
    return { path: filePath, bytes: inspected.bytes, digest, mime: inspected.metadata.detectedMimeType, image };
  } catch (error) {
    if ((error as ValidationIssue).code && (error as ValidationIssue).messageKey) throw error;
    throw issueFor(contracts, "NAVER_SMARTCHANNEL_ASSET_MISSING", pointer, "decodable PNG/JPEG", error instanceof Error ? error.message : String(error));
  }
}

function requiredSourceDimensions(token: NaverPlacementToken, height: number): { width: number; height: number } {
  if (token.coordinateSpace.type === "FULL_CANVAS_SOURCE") return { width: NAVER_SMARTCHANNEL_CANVAS_WIDTH, height };
  if (token.coordinateSpace.type === "SLOT_LOCAL_SOURCE") return { width: Number(token.coordinateSpace.width), height: Number(token.coordinateSpace.height) };
  return { width: Number(token.sourceFrame?.width), height: Number(token.sourceFrame?.height) };
}

function drawSourceObject(canvas: Canvas, image: DecodedRgba, token: NaverPlacementToken): void {
  const context = canvas.getContext("2d");
  if (token.coordinateSpace.type === "FULL_CANVAS_SOURCE") {
    putImageData(canvas, image, 0, 0);
    return;
  }
  if (token.coordinateSpace.type === "SLOT_LOCAL_SOURCE") {
    putImageData(canvas, image, Number(token.placementFrame.x), Number(token.placementFrame.y ?? 0));
    return;
  }
  const transform = token.sourceFrame?.canvasTransform;
  if (!transform || transform.length < 8) throw new Error("SmartChannel source transform is missing");
  const x = Number(transform[0]);
  const y = Number(transform[1]);
  const width = Number(transform[2]) - x;
  const height = Number(transform[5]) - y;
  const sourceCanvas = createCanvas(image.width, image.height);
  putImageData(sourceCanvas, image, 0, 0);
  context.drawImage(sourceCanvas, x, y, width, height);
}

async function drawVerifiedFixedAsset(canvas: Canvas, projectRoot: string, assetPath: string, expectedSha256: string, x: number, y: number, contracts: ContractBundle, id: string): Promise<{ id: string; digest: string; x: number; y: number; width: number; height: number } | null> {
  try {
    const filePath = await resolveTrustedInputFile(projectRoot, assetPath);
    const bytes = await readFile(filePath);
    const digest = sha256Bytes(bytes);
    if (digest !== expectedSha256.toLowerCase()) throw new Error(`digest:${digest}`);
    const image = await decodeRgba(bytes);
    putImageData(canvas, image, x, y);
    return { id, digest, x, y, width: image.width, height: image.height };
  } catch (error) {
    throw issueFor(contracts, "NAVER_SMARTCHANNEL_FIXED_COMPONENT_INVALID", `/fixedComponents/${id}`, expectedSha256, error instanceof Error ? error.message : String(error));
  }
}

function drawTrackedText(context: ReturnType<Canvas["getContext"]>, text: string, layer: NaverTextLayer, font: ResolvedFont, color: string, style: Record<string, string>): number {
  const fontSize = Number(style.FontSize);
  const trackingValue = Number(style.Tracking);
  if (!Number.isFinite(fontSize) || !Number.isFinite(trackingValue) || fontSize <= 0) throw new Error("Typography token has invalid FontSize or Tracking");
  const tracking = trackingValue * fontSize / 1000;
  context.font = `${fontSize}px "${font.runtimePostScriptName}"`;
  context.textBaseline = "alphabetic";
  context.fillStyle = color;
  let x = layer.role === "CTA_LABEL" ? layer.textPlacement.boxX : layer.textPlacement.originX;
  for (const character of [...text]) {
    context.fillText(character, x, layer.textPlacement.baselineY);
    x += context.measureText(character).width + tracking;
  }
  const startX = layer.role === "CTA_LABEL" ? layer.textPlacement.boxX : layer.textPlacement.originX;
  return Math.max(0, x - startX - (text.length > 0 ? tracking : 0));
}

function layerInputKey(role: NaverTextLayer["role"], index: number): keyof SmartChannelContent {
  if (role === "HEADLINE") return index === 0 ? "headline" : "headlineLine2";
  if (role === "SUBCOPY") return index === 0 ? "subcopy" : "subcopyLine4";
  if (role === "DISCLOSURE") return index === 0 ? "disclosureLine1" : "disclosureLine2";
  return "ctaOption";
}

function visibleTextLayers(metadata: Record<string, unknown>, templateId: string): NaverTextLayer[] {
  const template = jsonArray(metadata.templates).find((entry) => String(entry.templateId) === templateId);
  return jsonArray(template?.textLayers).filter((entry) => entry.visible !== false && ["HEADLINE", "SUBCOPY", "DISCLOSURE"].includes(String(entry.role))).sort((left, right) => Number(jsonObject(left.textPlacement).boxY) - Number(jsonObject(right.textPlacement).boxY)) as unknown as NaverTextLayer[];
}

function validateTemplateContent(
  contracts: ContractBundle,
  template: NaverTemplate,
  metadata: Record<string, unknown>,
  content: SmartChannelContent,
): ValidationIssue[] {
  const layers = visibleTextLayers(metadata, template.templateId);
  const requiredKeys = new Set<keyof SmartChannelContent>();
  const roleCounters = new Map<NaverTextLayer["role"], number>();
  for (const layer of layers) {
    const index = roleCounters.get(layer.role) ?? 0;
    roleCounters.set(layer.role, index + 1);
    requiredKeys.add(layerInputKey(layer.role, index));
  }
  if (template.affordance === "APP_CTA") requiredKeys.add("ctaOption");

  const issues: ValidationIssue[] = [];
  for (const key of requiredKeys) {
    const value = content[key];
    if (typeof value !== "string" || value.length === 0) {
      issues.push(issueFor(contracts, key === "ctaOption" ? "NAVER_SMARTCHANNEL_CTA_INVALID" : "NAVER_SMARTCHANNEL_TEXT_REQUIRED", `/content/${key}`, "required source-backed content field", value));
    }
  }
  if (template.affordance !== "APP_CTA" && content.ctaOption !== undefined) {
    issues.push(issueFor(contracts, "NAVER_SMARTCHANNEL_CTA_INVALID", "/content/ctaOption", "ctaOption is only allowed for APP_CTA templates", content.ctaOption));
  }
  const allowedKeys = new Set<keyof SmartChannelContent>([...requiredKeys]);
  for (const key of Object.keys(content) as Array<keyof SmartChannelContent>) {
    if (!allowedKeys.has(key) && content[key] !== undefined) {
      issues.push(issueFor(contracts, "NAVER_SMARTCHANNEL_INPUT_INVALID", `/content/${key}`, "field supported by the selected source template", content[key]));
    }
  }
  return issues;
}

function ctaTextLayer(metadata: Record<string, unknown>, templateId: string, label: string): NaverTextLayer | null {
  const template = jsonArray(metadata.templates).find((entry) => String(entry.templateId) === templateId);
  const layer = jsonArray(template?.textLayers).find((entry) => entry.visible !== false && entry.role === "CTA_LABEL" && String(entry.name) === label);
  return layer ? layer as unknown as NaverTextLayer : null;
}

function validateInputShape(request: unknown, contracts: ContractBundle): { request?: SmartChannelRenderRequest; issues: ValidationIssue[] } {
  const value = jsonObject(request);
  const issues: ValidationIssue[] = [];
  if (value.schemaVersion !== undefined && value.schemaVersion !== "1.0.0") issues.push(issueFor(contracts, "NAVER_SMARTCHANNEL_INPUT_INVALID", "/schemaVersion", "1.0.0", value.schemaVersion));
  if (value.channel !== "NAVER_GFA") issues.push(issueFor(contracts, "NAVER_SMARTCHANNEL_INPUT_INVALID", "/channel", "NAVER_GFA", value.channel));
  if (value.placement !== "SMARTCHANNEL") issues.push(issueFor(contracts, "NAVER_SMARTCHANNEL_INPUT_INVALID", "/placement", "SMARTCHANNEL", value.placement));
  if (value.artifactCardinality !== undefined && value.artifactCardinality !== "SINGLE") issues.push(issueFor(contracts, "NAVER_SMARTCHANNEL_INPUT_INVALID", "/artifactCardinality", "SINGLE", value.artifactCardinality));
  if (typeof value.templateId !== "string" || value.templateId.length === 0) issues.push(issueFor(contracts, "NAVER_SMARTCHANNEL_INPUT_INVALID", "/templateId", "non-empty string", value.templateId));
  const content = jsonObject(value.content);
  const assets = jsonObject(value.assets);
  const object = jsonObject(assets.object);
  const output = jsonObject(value.output);
  if (typeof content.headline !== "string" || content.headline.trim().length === 0) issues.push(issueFor(contracts, "NAVER_SMARTCHANNEL_TEXT_REQUIRED", "/content/headline", "non-empty string", content.headline));
  if (typeof object.path !== "string" || object.path.length === 0) issues.push(issueFor(contracts, "NAVER_SMARTCHANNEL_ASSET_MISSING", "/assets/object/path", "trusted relative path", object.path));
  if (typeof output.directory !== "string" || typeof output.baseName !== "string") issues.push(issueFor(contracts, "NAVER_SMARTCHANNEL_INPUT_INVALID", "/output", "directory and baseName", output));
  if (issues.length > 0) return { issues };
  const logo = jsonObject(assets.advertiserLogo);
  const normalizedAssets: SmartChannelRenderRequest["assets"] = {
    object: { path: String(object.path), expectedSha256: typeof object.expectedSha256 === "string" ? object.expectedSha256.toLowerCase() : null },
    ...(typeof logo.path === "string" ? { advertiserLogo: { path: String(logo.path), expectedSha256: typeof logo.expectedSha256 === "string" ? logo.expectedSha256.toLowerCase() : null } } : {}),
  };
  return {
    request: {
      schemaVersion: "1.0.0",
      channel: "NAVER_GFA",
      placement: "SMARTCHANNEL",
      layoutMode: "TEMPLATE_LOCKED",
      compositionMode: "RENDERER_COMPOSED",
      artifactCardinality: "SINGLE",
      templateId: String(value.templateId),
      content: Object.fromEntries(Object.entries(content).map(([key, item]) => [key, textValue(item)]).filter((entry): entry is [string, string] => entry[1] !== undefined)) as SmartChannelContent,
      assets: normalizedAssets,
      output: { directory: String(output.directory), baseName: String(output.baseName), overwrite: output.overwrite === true },
    },
    issues,
  };
}

function validateTextRole(layer: NaverTextLayer, width: number): boolean {
  const boxRight = layer.textPlacement.boxX + layer.textPlacement.boxWidth;
  // NAPI canvas reports fractional advances for the project-compatible font build;
  // the frozen PSD pixel boxes include a small anti-aliasing allowance for CTA rows.
  const allowance = layer.role === "CTA_LABEL" ? 4 : 0.01;
  const startX = layer.role === "CTA_LABEL" ? layer.textPlacement.boxX : layer.textPlacement.originX;
  return startX + width <= boxRight + allowance;
}

export function isSmartChannelRenderRequest(value: unknown): value is SmartChannelRenderRequest {
  const input = jsonObject(value);
  return input.channel === "NAVER_GFA" && input.placement === "SMARTCHANNEL";
}

export async function renderSmartChannel(requestValue: unknown, options: SmartChannelRenderOptions): Promise<SmartChannelRenderResult> {
  const { contracts } = options;
  const schemaValidation = new SchemaValidators(contracts).validateNaverInput(requestValue);
  if (!schemaValidation.valid) return failure(contracts, schemaValidation.issues);
  const shaped = validateInputShape(requestValue, contracts);
  if (!shaped.request) return failure(contracts, shaped.issues);
  const request = shaped.request;
  const templateRegistry = contracts.naverTemplateContract;
  const template = templates(templateRegistry).find((entry) => entry.templateId === request.templateId);
  if (!template) return failure(contracts, [...shaped.issues, issueFor(contracts, "NAVER_SMARTCHANNEL_TEMPLATE_UNKNOWN", "/templateId", "known registry template", request.templateId)]);
  const token = placementTokens(contracts.naverObjectPlacement).find((entry) => entry.token === template.objectPlacementToken);
  if (!token || !token.runtimeEnabled) return failure(contracts, [...shaped.issues, issueFor(contracts, "NAVER_SMARTCHANNEL_OBJECT_PLACEMENT_UNRESOLVED", "/templateId", "runtimeEnabled placement token", template.objectPlacementToken)]);
  const metadata = contracts.naverPsdMetadata;
  const contentIssues = validateTemplateContent(contracts, template, metadata, request.content);
  if (contentIssues.some(({ severity }) => severity === "ERROR")) return failure(contracts, [...shaped.issues, ...contentIssues]);
  const preflight = await preflightFonts(options.projectRoot, contracts);
  const preIssues = [...shaped.issues, ...contentIssues, ...preflight.issues];
  let jobDirectory: string;
  try {
    jobDirectory = await resolveTrustedJobDirectory(options.outputRoot, request.output.directory, request.output.baseName);
  } catch (error) {
    return failure(contracts, [...preIssues, issueFor(contracts, "KBR-INPUT-009", "/output", "trusted output descendant", error instanceof Error ? error.message : String(error))]);
  }
  let objectAsset: Awaited<ReturnType<typeof verifiedAsset>>;
  try {
    objectAsset = await verifiedAsset(request.assets.object.path, request.assets.object.expectedSha256, contracts, options.inputRoot, "/assets/object/path");
  } catch (error) {
    return failure(contracts, [...preIssues, error as ValidationIssue]);
  }
  if (!objectAsset) return failure(contracts, [...preIssues, issueFor(contracts, "NAVER_SMARTCHANNEL_ASSET_MISSING", "/assets/object/path")]);
  const sourceRule = jsonArray(contracts.naverObjectPlacement.sourceAssetRules).find((entry) => String(entry.id) === token.sourceAssetRuleId);
  const expectedMime = stringArray(sourceRule?.acceptedMime);
  const expectedDimensions = requiredSourceDimensions(token, template.height);
  const actualDimensions = { width: objectAsset.image.width, height: objectAsset.image.height };
  const assetIssues: ValidationIssue[] = [];
  if (!expectedMime.includes(objectAsset.mime)) assetIssues.push(issueFor(contracts, "NAVER_SMARTCHANNEL_ASSET_MIME_INVALID", "/assets/object", expectedMime, objectAsset.mime));
  if (actualDimensions.width !== expectedDimensions.width || actualDimensions.height !== expectedDimensions.height) assetIssues.push(issueFor(contracts, "NAVER_SMARTCHANNEL_ASSET_DIMENSION_MISMATCH", "/assets/object", expectedDimensions, actualDimensions));
  const expectedObjectRegion = normalizedPlacementFrame(token, template.height);
  const actualObjectBounds = transformedAlphaBounds(objectAsset.image, token);
  if (!containedBy(actualObjectBounds, expectedObjectRegion)) assetIssues.push(issueFor(contracts, "NAVER_SMARTCHANNEL_OBJECT_OUT_OF_REGION", "/assets/object", expectedObjectRegion, actualObjectBounds));
  if (assetIssues.length > 0 || preIssues.some(({ severity }) => severity === "ERROR")) return failure(contracts, [...preIssues, ...assetIssues]);

  const content = request.content;
  const canvas = createCanvas(NAVER_SMARTCHANNEL_CANVAS_WIDTH, template.height);
  drawSourceObject(canvas, objectAsset.image, token);
  const context = canvas.getContext("2d");
  const layers = visibleTextLayers(metadata, request.templateId);
  const textReports: SmartChannelTextRoleReport[] = [];
  const roleCounters = new Map<string, number>();
  const textIssues: ValidationIssue[] = [];
  for (const layer of layers) {
    const index = roleCounters.get(layer.role) ?? 0;
    roleCounters.set(layer.role, index + 1);
    const inputKey = layerInputKey(layer.role, index);
    const text = content[inputKey];
    if (!text) {
      textIssues.push(issueFor(contracts, "NAVER_SMARTCHANNEL_TEXT_REQUIRED", `/content/${inputKey}`, "text for visible source role", layer.name));
      continue;
    }
    if (/\r|\n|\t/u.test(text)) {
      textIssues.push(issueFor(contracts, "NAVER_SMARTCHANNEL_INPUT_INVALID", `/content/${inputKey}`, "single-line NFC text", text));
      continue;
    }
    const typography = typographyForLayer(layer, contracts.naverTypography);
    if (!typography) {
      textIssues.push(issueFor(contracts, "NAVER_SMARTCHANNEL_INPUT_INVALID", `/template/${request.templateId}/typographyTokenId`, "registered typography token", layer.typographyTokenId));
      continue;
    }
    const fontToken = sourceFontToToken(typography.fontNames[0] ?? "", contracts.naverFontCompatibility);
    if (!fontToken) {
      textIssues.push(issueFor(contracts, "NAVER_SMARTCHANNEL_FONT_UNAVAILABLE", `/content/${inputKey}`, "approved runtime typography font", typography.fontNames[0]));
      continue;
    }
    const font = fontByToken(preflight.fonts, fontToken);
    if (!font) continue;
    const style = typography.styleRuns[0];
    if (!style) {
      textIssues.push(issueFor(contracts, "NAVER_SMARTCHANNEL_INPUT_INVALID", `/template/${request.templateId}/typographyTokenId`, "typography token style run", layer.typographyTokenId));
      continue;
    }
    const width = drawTrackedText(context, text, layer, font, parseFillColor(style.FillColor), style);
    const overflow = !validateTextRole(layer, width) || layer.textPlacement.boxX + width > NAVER_SMARTCHANNEL_CANVAS_WIDTH;
    if (overflow) textIssues.push(issueFor(contracts, "NAVER_SMARTCHANNEL_TEXT_OVERFLOW", `/content/${inputKey}`, { maxWidth: layer.textPlacement.boxWidth }, width, "POST_RENDER"));
    textReports.push({ role: layer.role, inputKey, text, sourceLayer: layer.name, typographyTokenId: String(layer.typographyTokenId ?? ""), box: { x: layer.textPlacement.boxX, y: layer.textPlacement.boxY, width: layer.textPlacement.boxWidth, height: layer.textPlacement.boxHeight }, expectedOrigin: { x: layer.textPlacement.originX, y: layer.textPlacement.baselineY }, actualRasterBounds: layer.pixelBounds.length >= 4 ? { x: Number(layer.pixelBounds[0]), y: Number(layer.pixelBounds[1]), width: Number(layer.pixelBounds[2]) - Number(layer.pixelBounds[0]), height: Number(layer.pixelBounds[3]) - Number(layer.pixelBounds[1]) } : null, baselineY: layer.textPlacement.baselineY, measuredWidth: width, overflow });
  }

  const fixedComponents: SmartChannelReport["fixedComponents"] = [];
  const fixedRegistry = jsonArray(contracts.naverFixedComponents.components);
  if (template.affordance === "LANDING_ICON") {
    const componentId = template.height === 280 ? "LANDING_ICON_280" : "LANDING_ICON_COMPACT";
    const component = fixedRegistry.find((entry) => String(entry.id) === componentId);
    const asset = jsonObject(component?.asset);
    const placement = template.height === 280 ? jsonObject(component?.placement) : jsonObject(jsonObject(component?.heightPlacements)[String(template.height)]);
    try {
      const fixed = await drawVerifiedFixedAsset(canvas, options.projectRoot, String(asset.assetPath), String(asset.assetPngSha256), Number(placement.x), Number(placement.y), contracts, componentId);
      if (fixed) fixedComponents.push(fixed);
    } catch (error) { textIssues.push(error as ValidationIssue); }
  }
  if (template.affordance === "APP_CTA") {
    const label = content.ctaOption;
    if (template.height === 160 || template.height === 200) {
      const compact = jsonObject(contracts.naverCtaOptions.compact160200);
      const allowedLabels = stringArray(compact.allowedLabels);
      const labelAssets = jsonObject(compact.labelAssets);
      const selected = label ? jsonObject(labelAssets[label]) : {};
      const sourceBounds = numberArray(selected.sourcePixelBounds);
      const placementY = Number(jsonObject(compact.placements)[String(template.height)] && jsonObject(jsonObject(compact.placements)[String(template.height)]).y);
      if (!label || !allowedLabels.includes(label) || typeof selected.assetPath !== "string" || typeof selected.assetPngSha256 !== "string" || sourceBounds.length < 2 || !Number.isFinite(placementY)) {
        textIssues.push(issueFor(contracts, "NAVER_SMARTCHANNEL_CTA_INVALID", "/content/ctaOption", "registered compact CTA label asset", label));
      } else {
        try {
          const fixed = await drawVerifiedFixedAsset(canvas, options.projectRoot, String(selected.assetPath), String(selected.assetPngSha256), Number(sourceBounds[0]), placementY, contracts, `APP_CTA_${template.height}_${label}`);
          if (fixed) fixedComponents.push(fixed);
        } catch (error) { textIssues.push(error as ValidationIssue); }
      }
    } else {
      const options280 = jsonArray(contracts.naverCtaOptions.options280);
      const option = label ? options280.find((entry) => String(entry.label) === label) : undefined;
      const occurrence = jsonArray(option?.sourceOccurrences).find((entry) => String(entry.templateId) === request.templateId);
      if (!label || !option || !occurrence) {
        textIssues.push(issueFor(contracts, "NAVER_SMARTCHANNEL_CTA_INVALID", "/content/ctaOption", "registered CTA option occurrence", label));
      } else {
        const button = jsonObject(occurrence.button);
        const chevron = jsonObject(occurrence.chevron);
        const buttonAsset = jsonObject(button.asset);
        const chevron280 = jsonObject(contracts.naverCtaOptions.chevron280);
        const chevronAsset = { ...chevron280, ...jsonObject(chevron.asset) };
        try {
          const buttonBounds = numberArray(button.visibleBounds);
          if (buttonBounds.length < 2 || typeof buttonAsset.assetPath !== "string" || typeof buttonAsset.assetPngSha256 !== "string") throw issueFor(contracts, "NAVER_SMARTCHANNEL_CTA_INVALID", "/content/ctaOption", "button asset and visible bounds from CTA registry", occurrence.button);
          const buttonComponent = await drawVerifiedFixedAsset(canvas, options.projectRoot, String(buttonAsset.assetPath), String(buttonAsset.assetPngSha256), Number(buttonBounds[0]), Number(buttonBounds[1]), contracts, `APP_CTA_280_BUTTON_${String(option.id)}`);
          if (buttonComponent) fixedComponents.push(buttonComponent);
          const chevronBounds = numberArray(chevron.visibleBounds).length >= 2 ? numberArray(chevron.visibleBounds) : numberArray(chevron280.visibleBounds);
          if (chevronBounds.length < 2 || typeof chevronAsset.assetPath !== "string" || typeof chevronAsset.assetPngSha256 !== "string") throw issueFor(contracts, "NAVER_SMARTCHANNEL_CTA_INVALID", "/content/ctaOption", "chevron asset and visible bounds from CTA registry", occurrence.chevron);
          const chevronComponent = await drawVerifiedFixedAsset(canvas, options.projectRoot, String(chevronAsset.assetPath), String(chevronAsset.assetPngSha256), Number(chevronBounds[0]), Number(chevronBounds[1]), contracts, "APP_CTA_280_CHEVRON");
          if (chevronComponent) fixedComponents.push(chevronComponent);
          const ctaLayer = ctaTextLayer(metadata, request.templateId, label);
          if (!ctaLayer) throw issueFor(contracts, "NAVER_SMARTCHANNEL_CTA_INVALID", "/content/ctaOption", "CTA label layer from PSD metadata", label);
          const ctaTypography = typographyForLayer(ctaLayer, contracts.naverTypography);
          if (!ctaTypography) throw issueFor(contracts, "NAVER_SMARTCHANNEL_INPUT_INVALID", `/template/${request.templateId}/typographyTokenId`, "registered CTA typography token", ctaLayer.typographyTokenId);
          const ctaFontToken = sourceFontToToken(ctaTypography.fontNames[0] ?? "", contracts.naverFontCompatibility);
          const ctaFont = ctaFontToken ? fontByToken(preflight.fonts, ctaFontToken) : undefined;
          if (!ctaFont) throw issueFor(contracts, "NAVER_SMARTCHANNEL_FONT_UNAVAILABLE", "/content/ctaOption", "approved runtime CTA typography font", ctaTypography.fontNames[0]);
          const style = ctaTypography.styleRuns[0];
          if (!style) throw issueFor(contracts, "NAVER_SMARTCHANNEL_INPUT_INVALID", `/template/${request.templateId}/typographyTokenId`, "CTA typography token style run", ctaLayer.typographyTokenId);
          const ctaWidth = drawTrackedText(context, label, ctaLayer, ctaFont, parseFillColor(style.FillColor), style);
          const ctaOverflow = !validateTextRole(ctaLayer, ctaWidth);
          if (ctaOverflow) textIssues.push(issueFor(contracts, "NAVER_SMARTCHANNEL_TEXT_OVERFLOW", "/content/ctaOption", { maxWidth: ctaLayer.textPlacement.boxWidth }, ctaWidth, "POST_RENDER"));
          textReports.push({ role: "CTA_LABEL", inputKey: "ctaOption", text: label, sourceLayer: ctaLayer.name, typographyTokenId: String(ctaLayer.typographyTokenId ?? ""), box: { x: ctaLayer.textPlacement.boxX, y: ctaLayer.textPlacement.boxY, width: ctaLayer.textPlacement.boxWidth, height: ctaLayer.textPlacement.boxHeight }, expectedOrigin: { x: ctaLayer.textPlacement.originX, y: ctaLayer.textPlacement.baselineY }, actualRasterBounds: ctaLayer.pixelBounds.length >= 4 ? { x: Number(ctaLayer.pixelBounds[0]), y: Number(ctaLayer.pixelBounds[1]), width: Number(ctaLayer.pixelBounds[2]) - Number(ctaLayer.pixelBounds[0]), height: Number(ctaLayer.pixelBounds[3]) - Number(ctaLayer.pixelBounds[1]) } : null, baselineY: ctaLayer.textPlacement.baselineY, measuredWidth: ctaWidth, overflow: ctaOverflow });
        } catch (error) { textIssues.push(error as ValidationIssue); }
      }
    }
  }
  if (textIssues.some(({ severity }) => severity === "ERROR")) return failure(contracts, [...preIssues, ...assetIssues, ...textIssues]);

  const png = canvas.toBuffer("image/png");
  const pngDigest = sha256Bytes(png);
  const ihdr = inspectPngIhdr(png);
  const postIssues: ValidationIssue[] = [];
  if (!ihdr || ihdr.width !== NAVER_SMARTCHANNEL_CANVAS_WIDTH || ihdr.height !== template.height || ihdr.colorType !== 6 || ihdr.bitDepth !== 8) postIssues.push(issueFor(contracts, "NAVER_SMARTCHANNEL_OUTPUT_INVALID", "/output.png", { width: NAVER_SMARTCHANNEL_CANVAS_WIDTH, height: template.height, colorType: 6, bitDepth: 8 }, ihdr ?? "invalid PNG", "POST_RENDER"));
  const raw = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (raw.info.channels !== 4 || !Array.from(raw.data).some((_, index) => index % 4 === 3 && (raw.data[index] ?? 0) < 255)) {
    postIssues.push(issueFor(contracts, "NAVER_SMARTCHANNEL_OUTPUT_INVALID", "/output.png", "transparent RGBA PNG", "opaque or missing alpha", "POST_RENDER"));
  }
  if (postIssues.length > 0) return failure(contracts, [...preIssues, ...assetIssues, ...textIssues, ...postIssues], { png });

  const requestFingerprint = canonicalDigest(request);
  const fixedDigestInputs = fixedComponents.map((entry) => ({ id: entry.id, digest: entry.digest, x: entry.x, y: entry.y, width: entry.width, height: entry.height }));
  const objectFrame = normalizedPlacementFrame(token, template.height);
  const pixelFingerprint = canonicalDigest({ rendererPixelContract: "naver-smartchannel-raster-v1", encoderVersion: NAVER_SMARTCHANNEL_PNG_ENCODER_VERSION, templateContractVersion: String(templateRegistry.templateContractVersion), templateId: request.templateId, objectPlacementToken: token.token, objectDigest: objectAsset.digest, objectFrame: token.placementFrame, text: content, textMetadata: textReports.map((entry) => ({ role: entry.role, sourceLayer: entry.sourceLayer, typographyTokenId: entry.typographyTokenId, box: entry.box, baselineY: entry.baselineY })), fixedComponents: fixedDigestInputs, fonts: preflight.fonts.map((font) => ({ token: font.token, digest: font.digest, runtimePostScriptName: font.runtimePostScriptName })) });
  const renderFingerprint = pixelFingerprint;
  const report: SmartChannelReport = { templateId: request.templateId, objectPlacementToken: token.token, canvas: { width: NAVER_SMARTCHANNEL_CANVAS_WIDTH, height: template.height, format: "PNG", colorType: "RGBA", bitDepth: 8, hasAlpha: true }, object: { placementToken: token.token, expectedRegion: objectFrame, actualRasterBounds: transformedAlphaBounds(objectAsset.image, token), sourceRuleId: token.sourceAssetRuleId, sourceMimeType: objectAsset.mime, sourceDigest: objectAsset.digest, frame: { x: objectFrame.x, y: objectFrame.y, width: expectedDimensions.width, height: expectedDimensions.height }, transform: token.coordinateSpace.type === "SMART_OBJECT_FRAME_SOURCE" ? "SOURCE_TRANSFORM" : "NONE" }, textRoles: textReports, fixedComponents, fonts: preflight.fonts.map((font) => ({ token: font.token, runtimePostScriptName: font.runtimePostScriptName, digest: font.digest })), artifact: { pngDigest, bytes: png.byteLength } };
  const issueGroups = splitIssues(sortAndDedupeIssues([...preIssues, ...assetIssues, ...textIssues, ...postIssues]));
  const manifest: RenderManifest = {
    schemaVersion: "1.0.0",
    canonicalInputDigest: requestFingerprint,
    normalizedInputDigest: requestFingerprint,
    outputPngDigest: pngDigest,
    templateContractVersion: "1.9.0",
    inputSchemaVersion: "1.2.0",
    outputSchemaVersion: "2.0.0",
    validatorResult: { errorCount: 0, warningCount: issueGroups.warnings.length, infoCount: issueGroups.infos.length, issues: [...issueGroups.warnings, ...issueGroups.infos] },
    assetDigests: { product: { id: "NAVER_SMARTCHANNEL_OBJECT", sha256: objectAsset.digest }, fonts: preflight.fonts.map((font) => ({ id: font.token, sha256: font.digest })), approvedIcons: fixedComponents.map((entry) => ({ id: entry.id, sha256: entry.digest })), referenceFixture: { id: "NAVER_SMARTCHANNEL_TEMPLATE_CONTRACT", sha256: canonicalDigest(templateRegistry) }, images: [{ id: "NAVER_SMARTCHANNEL_OBJECT", sha256: objectAsset.digest }] },
    templateId: request.templateId,
    formatProfileId: NAVER_SMARTCHANNEL_FORMAT_PROFILE_ID,
    pixelFingerprint,
    requestFingerprint,
    renderFingerprint,
    smartChannelReport: report,
    manualAcceptanceStatus: { status: "NOT_REVIEWED", items: ["M-001", "M-002", "M-003", "M-004", "M-005", "M-006"].map((id) => ({ id, status: "NOT_REVIEWED" as const, reviewer: null, reviewedAt: null })) },
  };
  const manifestValidators: SchemaValidators = new SchemaValidators(contracts);
  manifestValidators.assertManifest(manifest);
  const manifestText = canonicalJson(manifest);
  const manifestDigest = sha256Bytes(Buffer.from(manifestText, "utf8"));
  const expectedManifestPath = path.join(jobDirectory, "render-manifest.json");
  const expectedPngPath = path.join(jobDirectory, "output.png");
  const response: SmartChannelRenderResult = { schemaVersion: "1.0.0", manifestDigest, pngDigest, manifestPath: expectedManifestPath, pngPath: expectedPngPath, downloadAllowed: options.publish !== false, status: "PASS", errors: [], warnings: issueGroups.warnings, formatProfileId: NAVER_SMARTCHANNEL_FORMAT_PROFILE_ID, templateId: request.templateId, objectPlacementToken: token.token, pixelFingerprint, requestFingerprint, renderFingerprint, artifactFormat: "PNG", artifactDigest: pngDigest, artifactPath: expectedPngPath, png, report };
  if (options.publish === false) return response;
  try {
    const published = await publishArtifacts({ outputRoot: options.outputRoot, jobDirectory, png, manifest: manifestText, overwrite: request.output.overwrite === true });
    return { ...response, manifestPath: published.manifestPath, pngPath: published.pngPath, artifactPath: published.artifactPath };
  } catch (error) {
    return failure(contracts, [...preIssues, ...assetIssues, ...textIssues, issueFor(contracts, error instanceof PublishError ? error.code : "KBR-SYSTEM-004", "/output", undefined, error instanceof Error ? error.message : String(error))]);
  }
}
