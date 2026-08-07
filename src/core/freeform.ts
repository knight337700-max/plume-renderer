import { createCanvas, GlobalFonts, ImageData, type Canvas } from "@napi-rs/canvas";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  applyCreativeLayoutPlanDefaults,
  computeFreeformFingerprints,
  stableSortCreativeElements,
  validateCreativeLayoutPlan,
  validateFontReference,
  validateFreeformOutputFormat,
  type CreativeElement,
  type CreativeLayoutPlan,
  type FormatProfile,
  type FreeformFontRegistry,
  type ImagePlacementSpec,
  type OutputFormat,
  type NormalizedRect,
  type RendererValidationIssue,
} from "@kbr/renderer-contract";
import sharp from "sharp";

import type { ContractBundle } from "./contracts.js";
import { loadContracts } from "./contracts.js";
import { canonicalJson } from "./canonical.js";
import { createIssue, sortAndDedupeIssues, splitIssues } from "./errors.js";
import { sha256Bytes, sha256File } from "./hash.js";
import { inspectImageBytes } from "./image-input.js";
import {
  PathSecurityError,
  assertSafeRelativeReference,
  resolveTrustedInputFile,
  resolveTrustedJobDirectory,
} from "./path-security.js";
import { publishArtifacts, PublishError } from "./publish.js";
import { validateRenderedPng } from "./raster.js";
import { SchemaValidators } from "./schema-validation.js";
import type { FreeformAppliedElement, RenderManifest, RenderResponse, ValidationIssue } from "./types.js";

const FREEFORM_FONT_ALIAS_PREFIX = "KBR FREEFORM ";
const REGISTERED_FONTS = new Set<string>();

type FormatProfileRegistry = Readonly<{
  profiles?: readonly FormatProfile[];
  native1200?: FormatProfile;
}>;

type FreeformAssetValue = Readonly<{
  path?: string;
  bytes?: Uint8Array;
  assetRef?: Readonly<{ type?: string; value?: string }>;
  mimeType?: string;
  checksumSha256?: string;
  expectedSha256?: string;
}>;

export type FreeformAssetInput = Readonly<{
  assetId: string;
  mimeType?: "image/png" | "image/jpeg";
  declaredWidth?: number;
  declaredHeight?: number;
  checksumSha256?: string;
  expectedSha256?: string;
  assetRef?: Readonly<{ type?: string; value?: string }>;
  path?: string;
  bytes?: Uint8Array;
}>;

export type FreeformRenderRequest = Readonly<{
  schemaVersion?: string;
  formatProfileId: string;
  layoutMode?: "FREEFORM";
  creativeLayoutPlan?: CreativeLayoutPlan;
  assets?: readonly FreeformAssetInput[] | Readonly<Record<string, FreeformAssetValue | string>>;
  output?: Readonly<{
    mimeType?: "image/png" | "image/jpeg";
    format?: OutputFormat;
    quality?: number;
    directory?: string;
    baseName?: string;
    overwrite?: boolean;
  }>;
  provenance?: Readonly<Record<string, unknown>>;
}>;

export type FreeformRenderOptions = Readonly<{
  projectRoot: string;
  inputRoot: string;
  outputRoot: string;
  contracts?: ContractBundle;
  publish?: boolean;
}>;

export type FreeformRenderResult = Readonly<{
  status: "PASS" | "BLOCKED";
  png: Buffer | null;
  pngDigest: string | null;
  manifestDigest: string | null;
  manifestPath: string | null;
  pngPath: string | null;
  downloadAllowed: boolean;
  formatProfileId: string | null;
  artifactChecksumSha256: string | null;
  pixelFingerprint: string | null;
  requestFingerprint: string | null;
  renderFingerprint: string | null;
  appliedElements: FreeformAppliedElement[];
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}>;

type PixelRect = { x: number; y: number; width: number; height: number };
type RgbaImage = {
  bytes: Buffer;
  width: number;
  height: number;
  hasAlpha: boolean;
};
type ResolvedAsset = {
  assetId: string;
  bytes: Buffer;
  digest: string;
  mimeType: "image/png" | "image/jpeg";
  image: RgbaImage;
};
type RuntimeFreeformAssets = {
  fontRegistry: FreeformFontRegistry;
  fontDigests: Record<string, string>;
  fontPaths: Record<string, string>;
  referenceDigest: { id: string; sha256: string };
};

class FreeformAssetNotFoundError extends Error {
  constructor(reference: string) {
    super(`FREEFORM asset is unavailable: ${reference}`);
    this.name = "FreeformAssetNotFoundError";
  }
}

function emptyResult(
  errors: readonly ValidationIssue[],
  details: Partial<Pick<FreeformRenderResult, "formatProfileId" | "pixelFingerprint" | "requestFingerprint">> = {},
): FreeformRenderResult {
  const sorted = sortAndDedupeIssues(errors);
  const { errors: errorIssues, warnings } = splitIssues(sorted);
  return {
    status: "BLOCKED",
    png: null,
    pngDigest: null,
    manifestDigest: null,
    manifestPath: null,
    pngPath: null,
    downloadAllowed: false,
    formatProfileId: details.formatProfileId ?? null,
    artifactChecksumSha256: null,
    pixelFingerprint: details.pixelFingerprint ?? null,
    requestFingerprint: details.requestFingerprint ?? null,
    renderFingerprint: details.pixelFingerprint ?? null,
    appliedElements: [],
    errors: errorIssues,
    warnings,
  };
}

function issue(
  contracts: ContractBundle,
  code: string,
  pathValue: string,
  details: {
    expected?: unknown;
    actual?: unknown;
    elementId?: string;
    assetId?: string;
    bbox?: ValidationIssue["bbox"];
  } = {},
): ValidationIssue {
  const created = createIssue(contracts.errorRegistry, code, pathValue, details);
  if (details.elementId !== undefined) created.elementId = details.elementId;
  if (details.assetId !== undefined) created.assetId = details.assetId;
  return created;
}

function freeformIssuesToCore(contracts: ContractBundle, values: readonly RendererValidationIssue[]): ValidationIssue[] {
  return values.map((value) => {
    const pathValue = value.path ?? "/creativeLayoutPlan";
    return issue(contracts, value.code, pathValue, {
      ...(value.actual !== undefined ? { actual: value.actual } : {}),
      ...(value.expected !== undefined ? { expected: value.expected } : {}),
      ...(value.elementId !== undefined ? { elementId: value.elementId } : {}),
      ...(value.assetId !== undefined ? { assetId: value.assetId } : {}),
    });
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeNfc(value: unknown): unknown {
  if (typeof value === "string") return value.normalize("NFC");
  if (Array.isArray(value)) return value.map((item) => normalizeNfc(item));
  if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeNfc(item)]));
  return value;
}

export function isFreeformRenderRequest(value: unknown): value is FreeformRenderRequest {
  return isRecord(value) && value.layoutMode === "FREEFORM";
}

export function normalizedRectToPixelRect(
  rect: NormalizedRect,
  canvas: Readonly<{ width: number; height: number }>,
): PixelRect {
  const x = Math.floor(rect.x * canvas.width);
  const y = Math.floor(rect.y * canvas.height);
  const right = Math.ceil((rect.x + rect.width) * canvas.width);
  const bottom = Math.ceil((rect.y + rect.height) * canvas.height);
  return { x, y, width: right - x, height: bottom - y };
}

function parseColor(color: string): { red: number; green: number; blue: number; alpha: number } | null {
  const match = /^#([0-9A-Fa-f]{6})([0-9A-Fa-f]{2})?$/u.exec(color);
  if (!match) return null;
  const value = match[1];
  if (!value) return null;
  return {
    red: Number.parseInt(value.slice(0, 2), 16),
    green: Number.parseInt(value.slice(2, 4), 16),
    blue: Number.parseInt(value.slice(4, 6), 16),
    alpha: Number.parseInt(match[2] ?? "FF", 16) / 255,
  };
}

function rgbaCss(color: string): string {
  const parsed = parseColor(color);
  if (!parsed) throw new Error(`Invalid canonical color: ${color}`);
  return `rgba(${parsed.red}, ${parsed.green}, ${parsed.blue}, ${parsed.alpha})`;
}

type AlphaData = Uint8Array | Uint8ClampedArray;

function alphaAt(data: AlphaData, index: number): number {
  return data[index * 4 + 3] ?? 0;
}

function alphaBox(data: AlphaData, width: number, height: number, threshold: number): PixelRect | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (alphaAt(data, y * width + x) < threshold) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return maxX < 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

type Component = PixelRect & { count: number };

function visibleComponents(data: AlphaData, width: number, height: number): Component[] {
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  const components: Component[] = [];
  for (let start = 0; start < width * height; start += 1) {
    if (visited[start] === 1 || alphaAt(data, start) < 8) continue;
    visited[start] = 1;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    let count = 0;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    while (head < tail) {
      const current = queue[head++];
      if (current === undefined) break;
      const x = current % width;
      const y = Math.floor(current / width);
      count += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const next = ny * width + nx;
          if (visited[next] === 1 || alphaAt(data, next) < 8) continue;
          visited[next] = 1;
          queue[tail++] = next;
        }
      }
    }
    components.push({ x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1, count });
  }
  return components;
}

function unionBoxes(boxes: readonly PixelRect[]): PixelRect {
  const minX = Math.min(...boxes.map((box) => box.x));
  const minY = Math.min(...boxes.map((box) => box.y));
  const maxX = Math.max(...boxes.map((box) => box.x + box.width));
  const maxY = Math.max(...boxes.map((box) => box.y + box.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function meaningfulAlphaBox(data: AlphaData, width: number, height: number): PixelRect | null {
  const visible = visibleComponents(data, width, height).sort(
    (left, right) => right.count - left.count || left.y - right.y || left.x - right.x,
  );
  const mainVisible = visible[0];
  if (!mainVisible) return null;
  // Trace at alpha >= 1 so anti-aliased fringe is retained, then discard
  // components that contain only a negligible layout-visible island.
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  const selected: PixelRect[] = [];
  for (let start = 0; start < width * height; start += 1) {
    if (visited[start] === 1 || alphaAt(data, start) < 1) continue;
    visited[start] = 1;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    let count = 0;
    let visibleCount = 0;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    while (head < tail) {
      const current = queue[head++];
      if (current === undefined) break;
      const x = current % width;
      const y = Math.floor(current / width);
      count += 1;
      if (alphaAt(data, current) >= 8) visibleCount += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const next = ny * width + nx;
          if (visited[next] === 1 || alphaAt(data, next) < 1) continue;
          visited[next] = 1;
          queue[tail++] = next;
        }
      }
    }
    if (visibleCount / mainVisible.count >= 0.0005 && count > 0) {
      selected.push({ x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 });
    }
  }
  return selected.length > 0 ? unionBoxes(selected) : null;
}

function cropRectToPixels(rect: NormalizedRect, width: number, height: number): PixelRect | null {
  const crop = normalizedRectToPixelRect(rect, { width, height });
  if (crop.x < 0 || crop.y < 0 || crop.x + crop.width > width || crop.y + crop.height > height) return null;
  if (crop.width < 1 || crop.height < 1) return null;
  return crop;
}

function anchorOffset(
  anchor: ImagePlacementSpec["anchor"],
  slot: PixelRect,
  width: number,
  height: number,
): { x: number; y: number } {
  const freeX = slot.width - width;
  const freeY = slot.height - height;
  const horizontal = anchor.endsWith("LEFT") || anchor === "TOP_LEFT" || anchor === "BOTTOM_LEFT"
    ? 0
    : anchor.endsWith("RIGHT") || anchor === "TOP_RIGHT" || anchor === "BOTTOM_RIGHT"
      ? freeX
      : Math.floor(freeX / 2);
  const vertical = anchor.startsWith("TOP") || anchor === "TOP_LEFT" || anchor === "TOP_RIGHT"
    ? 0
    : anchor.startsWith("BOTTOM") || anchor === "BOTTOM_LEFT" || anchor === "BOTTOM_RIGHT"
      ? freeY
      : Math.floor(freeY / 2);
  return { x: slot.x + horizontal, y: slot.y + vertical };
}

async function decodeRgba(bytes: Buffer): Promise<RgbaImage> {
  const metadata = await sharp(bytes, { failOn: "error" }).metadata();
  const raw = await sharp(bytes, { failOn: "error" })
    .rotate()
    .toColourspace("srgb")
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    bytes: raw.data,
    width: raw.info.width,
    height: raw.info.height,
    hasAlpha: Boolean(metadata.hasAlpha) || raw.info.channels === 4,
  };
}

async function resizeCrop(image: RgbaImage, crop: PixelRect, width: number, height: number): Promise<Buffer> {
  const extracted = await sharp(image.bytes, { raw: { width: image.width, height: image.height, channels: 4 } })
    .extract({ left: crop.x, top: crop.y, width: crop.width, height: crop.height })
    .resize(width, height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .raw()
    .toBuffer();
  return extracted;
}

function outputFormat(request: FreeformRenderRequest): OutputFormat {
  if (request.output?.format) return request.output.format;
  return request.output?.mimeType === "image/jpeg" ? "JPG" : "PNG";
}

function assetEntries(request: FreeformRenderRequest): Array<{ assetId: string; value: FreeformAssetValue }> {
  if (!request.assets) return [];
  if (Array.isArray(request.assets)) {
    return request.assets.map((asset) => ({ assetId: asset.assetId, value: asset }));
  }
  return Object.entries(request.assets).map(([assetId, value]) => ({
    assetId,
    value: typeof value === "string" ? { path: value } : value,
  }));
}

async function resolveAssetPath(
  value: string,
  kind: string | undefined,
  projectRoot: string,
  inputRoot: string,
): Promise<string> {
  assertSafeRelativeReference(value.replaceAll("\\", "/"));
  const candidates = kind === "FIXTURE_ASSET_ID"
    ? [projectRoot, inputRoot]
    : [inputRoot, projectRoot];
  for (const root of candidates) {
    const resolved = await resolveTrustedInputFile(root, value.replaceAll("\\", "/"));
    try {
      const inspected = await readFile(resolved);
      if (inspected.byteLength > 0) return resolved;
    } catch {
      // Try the next trusted root. No untrusted path is ever used.
    }
  }
  throw new FreeformAssetNotFoundError(value);
}

async function resolveAssets(
  request: FreeformRenderRequest,
  options: FreeformRenderOptions,
  contracts: ContractBundle,
): Promise<{ assets: Map<string, ResolvedAsset>; issues: ValidationIssue[] }> {
  const assets = new Map<string, ResolvedAsset>();
  const issues: ValidationIssue[] = [];
  for (const entry of assetEntries(request)) {
    if (assets.has(entry.assetId)) {
      issues.push(issue(contracts, "KBR-ASSET-NOT-FOUND", `/assets/${entry.assetId}`, { assetId: entry.assetId, actual: "duplicate assetId" }));
      continue;
    }
    const value = entry.value;
    try {
      let bytes: Buffer;
      if (value.bytes !== undefined) bytes = Buffer.from(value.bytes);
      else {
        const reference = value.path ?? value.assetRef?.value;
        if (!reference) {
          issues.push(issue(contracts, "KBR-FREEFORM-IMAGE-ASSET-NOT-FOUND", "/assets", { assetId: entry.assetId }));
          continue;
        }
        const filePath = await resolveAssetPath(reference, value.assetRef?.type, options.projectRoot, options.inputRoot);
        bytes = await readFile(filePath);
      }
      const inspected = await inspectImageBytes(bytes);
      const detectedMime = inspected.detectedMimeType;
      if (value.mimeType !== undefined && value.mimeType !== detectedMime) {
        issues.push(issue(contracts, "KBR-ASSET-MIME-EXTENSION-MISMATCH", `/assets/${entry.assetId}`, {
          actual: detectedMime,
          expected: value.mimeType,
          assetId: entry.assetId,
        }));
        continue;
      }
      const digest = sha256Bytes(bytes);
      const expectedDigest = value.checksumSha256 ?? value.expectedSha256;
      if (expectedDigest !== undefined && expectedDigest.toLowerCase() !== digest) {
        issues.push(issue(contracts, "KBR-ASSET-CHECKSUM-MISMATCH", `/assets/${entry.assetId}`, {
          actual: digest,
          expected: expectedDigest,
          assetId: entry.assetId,
        }));
        continue;
      }
      assets.set(entry.assetId, {
        assetId: entry.assetId,
        bytes,
        digest,
        mimeType: detectedMime,
        image: await decodeRgba(bytes),
      });
    } catch (error) {
      const code = error instanceof PathSecurityError
        ? "KBR-INPUT-009"
        : error instanceof FreeformAssetNotFoundError
          ? "KBR-FREEFORM-IMAGE-ASSET-NOT-FOUND"
          : "KBR-IMAGE-DECODE-FAILED";
      issues.push(issue(contracts, code, `/assets/${entry.assetId}`, { assetId: entry.assetId, actual: error instanceof Error ? error.message : String(error) }));
    }
  }
  return { assets, issues };
}

async function loadRuntimeFreeformAssets(
  projectRoot: string,
  contracts: ContractBundle,
): Promise<{ runtime?: RuntimeFreeformAssets; issues: ValidationIssue[] }> {
  const issues: ValidationIssue[] = [];
  const registryPath = path.join(projectRoot, "contracts", "freeform-font-registry.json");
  let fontRegistry: FreeformFontRegistry;
  try {
    fontRegistry = JSON.parse(await readFile(registryPath, "utf8")) as FreeformFontRegistry;
  } catch {
    return { issues: [issue(contracts, "KBR-SYSTEM-001", "/assets/fonts")] };
  }
  const fontDigests: Record<string, string> = {};
  const fontPaths: Record<string, string> = {};
  for (const entry of fontRegistry.entries) {
    const referenceIssues = validateFontReference(entry.fontId, fontRegistry, `/assets/fonts/${entry.fontId}`);
    issues.push(...freeformIssuesToCore(contracts, referenceIssues));
    if (referenceIssues.length > 0 || entry.status !== "RESOLVED_ASSET") continue;
    try {
      assertSafeRelativeReference(entry.assetPath);
      const filePath = path.resolve(projectRoot, ...entry.assetPath.split("/"));
      const digest = await sha256File(filePath);
      if (digest !== entry.sha256.toLowerCase()) {
        issues.push(issue(contracts, "KBR-FONT-ASSET-DIGEST-MISMATCH", `/assets/fonts/${entry.fontId}`, { actual: digest, expected: entry.sha256 }));
        continue;
      }
      fontDigests[entry.fontId] = digest;
      fontPaths[entry.fontId] = filePath;
      const alias = `${FREEFORM_FONT_ALIAS_PREFIX}${entry.fontId}`;
      if (!REGISTERED_FONTS.has(alias)) {
        const result = GlobalFonts.registerFromPath(filePath, alias);
        if (result === null) {
          issues.push(issue(contracts, "KBR-SYSTEM-003", `/assets/fonts/${entry.fontId}`));
          continue;
        }
        REGISTERED_FONTS.add(alias);
      }
    } catch {
      issues.push(issue(contracts, "KBR-FONT-ASSET-MISSING", `/assets/fonts/${entry.fontId}`, { actual: entry.assetPath }));
    }
  }
  try {
    const referencePath = path.join(projectRoot, ...contracts.referenceRegistry.fixture.path.split("/"));
    const digest = await sha256File(referencePath);
    if (digest !== contracts.referenceRegistry.fixture.sha256) {
      issues.push(issue(contracts, "KBR-ASSET-007", "/referenceFixture", { actual: digest, expected: contracts.referenceRegistry.fixture.sha256 }));
    }
    return issues.length > 0
      ? { issues: sortAndDedupeIssues(issues) }
      : {
          runtime: {
            fontRegistry,
            fontDigests,
            fontPaths,
            referenceDigest: { id: contracts.referenceRegistry.fixture.id, sha256: digest },
          },
          issues,
        };
  } catch {
    issues.push(issue(contracts, "KBR-ASSET-001", "/referenceFixture"));
    return { issues: sortAndDedupeIssues(issues) };
  }
}

function applyPlacementCrop(
  placement: ImagePlacementSpec,
  image: RgbaImage,
  elementId: string,
  contracts: ContractBundle,
  targetRatio = 1,
): { crop: PixelRect; alphaTrimApplied: boolean; errors: ValidationIssue[]; requestedCrop?: NormalizedRect } {
  const errors: ValidationIssue[] = [];
  let requestedCrop: NormalizedRect | undefined;
  if (placement.policy === "ALPHA_TRIM_CONTAIN") {
    const meaningful = meaningfulAlphaBox(image.bytes, image.width, image.height);
    if (!meaningful) {
      errors.push(issue(contracts, "KBR-ASSET-005", `/elements/${elementId}/placement`, { elementId }));
      return { crop: { x: 0, y: 0, width: 1, height: 1 }, alphaTrimApplied: true, errors };
    }
    return { crop: meaningful, alphaTrimApplied: true, errors };
  }
  if (placement.policy === "CENTER_CONTAIN") return { crop: { x: 0, y: 0, width: image.width, height: image.height }, alphaTrimApplied: false, errors };
  if (placement.cropRect !== undefined) {
    requestedCrop = placement.cropRect;
    const crop = cropRectToPixels(placement.cropRect, image.width, image.height);
    if (!crop) errors.push(issue(contracts, "KBR-FREEFORM-IMAGE-PLACEMENT-INVALID", `/elements/${elementId}/placement/cropRect`, { elementId }));
    return { crop: crop ?? { x: 0, y: 0, width: 1, height: 1 }, alphaTrimApplied: false, errors, ...(requestedCrop ? { requestedCrop } : {}) };
  }
  if (placement.policy === "MANUAL_CROP") {
    errors.push(issue(contracts, "KBR-FREEFORM-IMAGE-PLACEMENT-INVALID", `/elements/${elementId}/placement/cropRect`, { elementId, expected: "cropRect" }));
    return { crop: { x: 0, y: 0, width: 1, height: 1 }, alphaTrimApplied: false, errors };
  }
  if (placement.policy === "SEMANTIC_CROP_COVER" && placement.focalPoint !== undefined) {
    const sourceRatio = image.width / image.height;
    let cropWidth = 1;
    let cropHeight = 1;
    if (sourceRatio > targetRatio) cropWidth = targetRatio / sourceRatio;
    else cropHeight = sourceRatio / targetRatio;
    const left = Math.min(1 - cropWidth, Math.max(0, placement.focalPoint.x - cropWidth / 2));
    const top = Math.min(1 - cropHeight, Math.max(0, placement.focalPoint.y - cropHeight / 2));
    const derived: NormalizedRect = { x: left, y: top, width: cropWidth, height: cropHeight };
    const crop = cropRectToPixels(derived, image.width, image.height);
    if (!crop) errors.push(issue(contracts, "KBR-FREEFORM-IMAGE-PLACEMENT-INVALID", `/elements/${elementId}/placement/focalPoint`, { elementId }));
    return { crop: crop ?? { x: 0, y: 0, width: 1, height: 1 }, alphaTrimApplied: false, errors };
  }
  errors.push(issue(contracts, "KBR-FREEFORM-IMAGE-PLACEMENT-INVALID", `/elements/${elementId}/placement/cropRect`, { elementId, expected: "cropRect or focalPoint" }));
  return { crop: { x: 0, y: 0, width: 1, height: 1 }, alphaTrimApplied: false, errors };
}

async function renderImageElement(
  context: ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
  asset: ResolvedAsset,
  element: Extract<CreativeElement, { type: "IMAGE" | "LOGO" }>,
  slot: PixelRect,
  contracts: ContractBundle,
  elementIndex: number,
): Promise<{ applied?: FreeformAppliedElement; errors: ValidationIssue[] }> {
  const placement = applyPlacementCrop(element.placement, asset.image, element.id, contracts, slot.width / slot.height);
  if (placement.errors.length > 0) return { errors: placement.errors };
  const crop = placement.crop;
  const cover = element.placement.fitMode === "COVER" || element.placement.policy === "SEMANTIC_CROP_COVER";
  const scale = cover
    ? Math.max(slot.width / crop.width, slot.height / crop.height)
    : Math.min(slot.width / crop.width, slot.height / crop.height);
  const resizedWidth = Math.max(1, Math.round(crop.width * scale));
  const resizedHeight = Math.max(1, Math.round(crop.height * scale));
  const destination = cover
    ? { x: slot.x, y: slot.y }
    : anchorOffset(element.placement.anchor, slot, resizedWidth, resizedHeight);
  const resizedRgba = await resizeCrop(asset.image, crop, resizedWidth, resizedHeight);
  const resizedCanvas = createCanvas(resizedWidth, resizedHeight);
  resizedCanvas.getContext("2d").putImageData(
    new ImageData(new Uint8ClampedArray(resizedRgba.buffer, resizedRgba.byteOffset, resizedRgba.byteLength), resizedWidth, resizedHeight),
    0,
    0,
  );
  context.save();
  context.globalAlpha = element.opacity ?? 1;
  if (cover) {
    context.beginPath();
    context.rect(slot.x, slot.y, slot.width, slot.height);
    context.clip();
  }
  context.drawImage(resizedCanvas, destination.x, destination.y, resizedWidth, resizedHeight);
  context.restore();
  return {
    applied: {
      elementId: element.id,
      elementType: element.type,
      normalizedBounds: element.bounds,
      destinationPixelRect: cover ? slot : { x: destination.x, y: destination.y, width: resizedWidth, height: resizedHeight },
      zIndex: element.zIndex,
      originalArrayIndex: elementIndex,
      opacity: element.opacity ?? 1,
      assetId: element.assetId,
      assetDigest: asset.digest,
      ...(placement.requestedCrop ? { requestedCropRect: placement.requestedCrop } : {}),
      ...(placement.alphaTrimApplied || element.placement.policy !== "CENTER_CONTAIN" ? { resolvedSourceCropPixels: crop } : {}),
    },
    errors: [],
  };
}

function scanVisibleCanvas(canvas: Canvas, width: number, height: number): PixelRect | null {
  const data = canvas.getContext("2d").getImageData(0, 0, width, height).data;
  return alphaBox(data, width, height, 8);
}

function drawSpacedText(
  context: ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
  text: string,
  x: number,
  baseline: number,
  letterSpacing: number,
): void {
  if (letterSpacing === 0) {
    context.fillText(text, x, baseline);
    return;
  }
  let cursor = x;
  for (const glyph of Array.from(text)) {
    context.fillText(glyph, cursor, baseline);
    cursor += context.measureText(glyph).width + letterSpacing;
  }
}

function lineWidth(
  context: ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
  text: string,
  letterSpacing: number,
): number {
  if (letterSpacing === 0) return context.measureText(text).width;
  const glyphs = Array.from(text);
  return glyphs.reduce((sum, glyph) => sum + context.measureText(glyph).width, 0) + Math.max(0, glyphs.length - 1) * letterSpacing;
}

function renderTextElement(
  mainContext: ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
  element: Extract<CreativeElement, { type: "TEXT" }>,
  slot: PixelRect,
  canvasSize: Readonly<{ width: number; height: number }>,
  fontAlias: string,
  contracts: ContractBundle,
  elementIndex: number,
): { applied?: FreeformAppliedElement; errors: ValidationIssue[] } {
  const lines = element.wrapMode === "EXPLICIT_NEWLINES" ? element.text.split("\n") : [element.text];
  const isolated = createCanvas(canvasSize.width, canvasSize.height);
  const context = isolated.getContext("2d");
  context.textBaseline = "alphabetic";
  context.font = `${element.fontSizePx}px "${fontAlias}"`;
  context.fillStyle = rgbaCss(element.color);
  // Napi Canvas exposes font metrics for diagnostics, but its bitmap ascent can
  // vary by glyph run. A font-size baseline offset keeps the contract's pixel
  // bounds deterministic for all pinned Spoqa glyphs without auto-shrinking.
  const ascent = element.fontSizePx;
  const totalHeight = element.lineHeightPx * lines.length;
  const top = element.verticalAlign === "TOP"
    ? slot.y
    : element.verticalAlign === "BOTTOM"
      ? slot.y + slot.height - totalHeight
      : slot.y + Math.floor((slot.height - totalHeight) / 2);
  const letterSpacing = element.letterSpacingPx ?? 0;
  lines.forEach((line, lineIndex) => {
    const width = lineWidth(context, line, letterSpacing);
    const x = element.textAlign === "LEFT"
      ? slot.x
      : element.textAlign === "RIGHT"
        ? slot.x + slot.width - width
        : slot.x + Math.floor((slot.width - width) / 2);
    drawSpacedText(context, line, x, top + ascent + lineIndex * element.lineHeightPx, letterSpacing);
  });
  const visible = scanVisibleCanvas(isolated, canvasSize.width, canvasSize.height);
  const errors: ValidationIssue[] = [];
  if (!visible) errors.push(issue(contracts, "KBR-FREEFORM-TEXT-OVERFLOW", `/elements/${element.id}`, { elementId: element.id, expected: "visible glyphs", actual: "none" }));
  else {
    const outside = visible.x < slot.x || visible.y < slot.y || visible.x + visible.width > slot.x + slot.width || visible.y + visible.height > slot.y + slot.height;
    if (outside && element.overflowMode === "ERROR") {
      errors.push(issue(contracts, "KBR-FREEFORM-TEXT-OVERFLOW", `/elements/${element.id}/bounds`, { elementId: element.id, bbox: visible, expected: slot }));
    }
  }
  if (errors.length > 0) return { errors };
  mainContext.save();
  mainContext.globalAlpha = element.opacity ?? 1;
  if (element.overflowMode === "CLIP") {
    mainContext.beginPath();
    mainContext.rect(slot.x, slot.y, slot.width, slot.height);
    mainContext.clip();
  }
  mainContext.drawImage(isolated as never, 0, 0);
  mainContext.restore();
  return {
    applied: {
      elementId: element.id,
      elementType: element.type,
      normalizedBounds: element.bounds,
      destinationPixelRect: slot,
      zIndex: element.zIndex,
      originalArrayIndex: elementIndex,
      opacity: element.opacity ?? 1,
      fontId: element.fontId,
    },
    errors,
  };
}

function manifestAcceptanceStatus(): RenderManifest["manualAcceptanceStatus"] {
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

function defaultOutput(request: FreeformRenderRequest): { directory: string; baseName: string; overwrite: boolean } {
  return {
    directory: request.output?.directory ?? "freeform",
    baseName: request.output?.baseName ?? "render",
    overwrite: request.output?.overwrite ?? false,
  };
}

function freeformResponseFromResult(result: FreeformRenderResult): RenderResponse {
  return {
    schemaVersion: "1.0.0",
    manifestDigest: result.manifestDigest,
    pngDigest: result.pngDigest,
    manifestPath: result.manifestPath,
    pngPath: result.pngPath,
    downloadAllowed: result.downloadAllowed,
    status: result.status === "PASS" ? "PASS" : "FAIL",
    errors: result.errors,
    warnings: result.warnings,
    ...(result.formatProfileId ? { formatProfileId: result.formatProfileId } : {}),
    ...(result.artifactChecksumSha256 ? { artifactChecksumSha256: result.artifactChecksumSha256 } : {}),
    ...(result.pixelFingerprint ? { pixelFingerprint: result.pixelFingerprint } : {}),
    ...(result.requestFingerprint ? { requestFingerprint: result.requestFingerprint } : {}),
    ...(result.renderFingerprint ? { renderFingerprint: result.renderFingerprint } : {}),
    appliedElements: result.appliedElements,
  };
}

export { freeformResponseFromResult };

export async function renderFreeform(
  request: FreeformRenderRequest,
  options: FreeformRenderOptions,
): Promise<FreeformRenderResult> {
  const contracts = options.contracts ?? await loadContracts(options.projectRoot);
  const formatProfileId = request.formatProfileId;
  if (request.layoutMode !== "FREEFORM") {
    return emptyResult([issue(contracts, "KBR-FREEFORM-PLAN-SCHEMA-INVALID", "/layoutMode", { actual: request.layoutMode, expected: "FREEFORM" })], { formatProfileId });
  }
  if (request.creativeLayoutPlan === undefined) {
    return emptyResult([issue(contracts, "KBR-FREEFORM-PLAN-MISSING", "/creativeLayoutPlan")], { formatProfileId });
  }
  const profileRegistryPath = path.join(options.projectRoot, "contracts", "freeform-format-profiles.json");
  let profileRegistry: FormatProfileRegistry;
  try {
    profileRegistry = JSON.parse(await readFile(profileRegistryPath, "utf8")) as FormatProfileRegistry;
  } catch {
    return emptyResult([issue(contracts, "KBR-FREEFORM-CANVAS-PROFILE-MISSING", "/formatProfileId", { actual: formatProfileId })], { formatProfileId });
  }
  const profile = profileRegistry.profiles?.find((candidate) => candidate.formatProfileId === formatProfileId);
  const profileIssues: ValidationIssue[] = [];
  if (!profile || profile.layoutMode !== "FREEFORM" || profile.canvas.width < 1 || profile.canvas.height < 1) {
    profileIssues.push(issue(contracts, "KBR-FREEFORM-CANVAS-PROFILE-MISSING", "/formatProfileId", { actual: formatProfileId }));
  }
  if (profile && profile.implementationStatus !== "IMPLEMENTED") {
    profileIssues.push(issue(contracts, "KBR-FREEFORM-CANVAS-PROFILE-MISSING", "/formatProfileId", { actual: profile.implementationStatus, expected: "IMPLEMENTED" }));
  }
  if (profile && profile.formatProfileId !== request.creativeLayoutPlan.formatProfileId) {
    profileIssues.push(issue(contracts, "KBR-FREEFORM-FORMAT-PROFILE-MISMATCH", "/creativeLayoutPlan/formatProfileId", { actual: request.creativeLayoutPlan.formatProfileId, expected: profile.formatProfileId }));
  }
  const output = outputFormat(request);
  if (profile) profileIssues.push(...freeformIssuesToCore(contracts, validateFreeformOutputFormat(output, profile)));
  const planIssues = freeformIssuesToCore(contracts, validateCreativeLayoutPlan(request.creativeLayoutPlan, {
    formatProfileId,
    ...(profile ? { profile } : {}),
    requireProfile: true,
  }));
  const defaults = normalizeNfc(applyCreativeLayoutPlanDefaults(request.creativeLayoutPlan)) as CreativeLayoutPlan;
  const runtimeResult = await loadRuntimeFreeformAssets(options.projectRoot, contracts);
  const runtimeAssets = runtimeResult.runtime;
  const issues = sortAndDedupeIssues([...profileIssues, ...planIssues, ...runtimeResult.issues]);
  const errorIssues = issues.filter((entry) => entry.severity === "ERROR");
  if (errorIssues.length > 0 || !profile || !runtimeAssets) {
    return emptyResult(issues.length > 0 ? issues : [issue(contracts, "KBR-SYSTEM-001", "/assets")], {
      formatProfileId,
    });
  }
  const resolvedAssetsResult = await resolveAssets(request, options, contracts);
  const allIssues = sortAndDedupeIssues([...issues, ...resolvedAssetsResult.issues]);
  const assetDigests: Record<string, string> = { ...runtimeAssets.fontDigests };
  for (const asset of resolvedAssetsResult.assets.values()) assetDigests[asset.assetId] = asset.digest;
  let fingerprints: { pixelFingerprint: string; requestFingerprint: string } | undefined;
  try {
    const requestProvenance = {
      ...(request.provenance ?? {}),
      assetReferences: assetEntries(request)
        .sort((left, right) => left.assetId.localeCompare(right.assetId, "en"))
        .map(({ assetId, value }) => ({
          assetId,
          ...(value.path ? { path: value.path.replaceAll("\\", "/") } : {}),
          ...(value.assetRef ? { assetRef: value.assetRef } : {}),
          ...(value.mimeType ? { mimeType: value.mimeType } : {}),
          ...(value.checksumSha256 ? { checksumSha256: value.checksumSha256 } : {}),
          ...(value.expectedSha256 ? { expectedSha256: value.expectedSha256 } : {}),
        })),
      assetDigests,
    };
    fingerprints = await computeFreeformFingerprints(defaults, assetDigests, profile, requestProvenance);
  } catch {
    // If canonicalization cannot run, the plan is already invalid and remains fail-closed.
  }
  if (allIssues.some((entry) => entry.severity === "ERROR")) {
    return emptyResult(allIssues, {
      formatProfileId,
      ...(fingerprints ? { pixelFingerprint: fingerprints.pixelFingerprint, requestFingerprint: fingerprints.requestFingerprint } : {}),
    });
  }
  const canvas = createCanvas(profile.canvas.width, profile.canvas.height);
  const context = canvas.getContext("2d");
  if (defaults.background.type === "SOLID") {
    context.fillStyle = rgbaCss(defaults.background.color);
    context.fillRect(0, 0, profile.canvas.width, profile.canvas.height);
  }
  const appliedElements: FreeformAppliedElement[] = [];
  const renderIssues: ValidationIssue[] = [];
  const ordered = stableSortCreativeElements(defaults.elements);
  for (const element of ordered) {
    const originalArrayIndex = defaults.elements.indexOf(element);
    const slot = normalizedRectToPixelRect(element.bounds, profile.canvas);
    if (element.type === "SHAPE") {
      renderIssues.push(issue(contracts, "KBR-FREEFORM-ELEMENT-TYPE-NOT-SUPPORTED", `/elements/${originalArrayIndex}/type`, { elementId: element.id, actual: "SHAPE" }));
      continue;
    }
    if (element.type === "IMAGE" || element.type === "LOGO") {
      const asset = resolvedAssetsResult.assets.get(element.assetId);
      if (!asset) {
        renderIssues.push(issue(contracts, "KBR-FREEFORM-IMAGE-ASSET-NOT-FOUND", `/elements/${originalArrayIndex}/assetId`, { elementId: element.id, assetId: element.assetId }));
        continue;
      }
      const rendered = await renderImageElement(context, asset, element, slot, contracts, originalArrayIndex);
      renderIssues.push(...rendered.errors);
      if (rendered.applied) {
        rendered.applied.assetDigest = asset.digest;
        appliedElements.push(rendered.applied);
        assetDigests[asset.assetId] = asset.digest;
      }
      continue;
    }
    if (element.type === "TEXT") {
      const registryEntry = runtimeAssets.fontRegistry.entries.find((entry) => entry.fontId === element.fontId);
      if (!registryEntry) {
        renderIssues.push(issue(contracts, "KBR-FONT-NOT-REGISTERED", `/elements/${originalArrayIndex}/fontId`, { elementId: element.id, actual: element.fontId }));
        continue;
      }
      const fontAlias = `${FREEFORM_FONT_ALIAS_PREFIX}${element.fontId}`;
      const rendered = renderTextElement(context, element, slot, profile.canvas, fontAlias, contracts, originalArrayIndex);
      renderIssues.push(...rendered.errors);
      if (rendered.applied) {
        const fontDigest = runtimeAssets.fontDigests[element.fontId];
        appliedElements.push(fontDigest ? { ...rendered.applied, fontAssetDigest: fontDigest } : rendered.applied);
      }
    }
  }
  const sortedRenderIssues = sortAndDedupeIssues([...allIssues, ...renderIssues]);
  if (sortedRenderIssues.some((entry) => entry.severity === "ERROR")) {
    return emptyResult(sortedRenderIssues, {
      formatProfileId,
      ...(fingerprints ? { pixelFingerprint: fingerprints.pixelFingerprint, requestFingerprint: fingerprints.requestFingerprint } : {}),
    });
  }
  const png = canvas.toBuffer("image/png");
  const outputIssues = await validateRenderedPng(png, contracts);
  const finalIssues = sortAndDedupeIssues([...sortedRenderIssues, ...outputIssues]);
  if (finalIssues.some((entry) => entry.severity === "ERROR")) {
    return emptyResult(finalIssues, {
      formatProfileId,
      ...(fingerprints ? { pixelFingerprint: fingerprints.pixelFingerprint, requestFingerprint: fingerprints.requestFingerprint } : {}),
    });
  }
  const pngDigest = sha256Bytes(png);
  const imageAssetDigests = [...resolvedAssetsResult.assets.values()]
    .sort((left, right) => left.assetId.localeCompare(right.assetId, "en"))
    .map((asset) => ({ id: asset.assetId, sha256: asset.digest }));
  const manifest: RenderManifest = {
    schemaVersion: "1.0.0",
    canonicalInputDigest: fingerprints?.requestFingerprint ?? sha256Bytes(Buffer.from(canonicalJson(defaults), "utf8")),
    normalizedInputDigest: fingerprints?.pixelFingerprint ?? sha256Bytes(Buffer.from(canonicalJson(defaults), "utf8")),
    outputPngDigest: pngDigest,
    templateContractVersion: "1.6.0",
    inputSchemaVersion: "1.2.0",
    outputSchemaVersion: "2.0.0",
    validatorResult: {
      errorCount: 0,
      warningCount: finalIssues.filter((entry) => entry.severity === "WARNING").length,
      infoCount: finalIssues.filter((entry) => entry.severity === "INFO").length,
      issues: finalIssues,
    },
    assetDigests: {
      product: imageAssetDigests[0] ?? { id: "FREEFORM_NONE", sha256: sha256Bytes(Buffer.alloc(0)) },
      fonts: Object.entries(runtimeAssets.fontDigests).map(([id, sha256]) => ({ id, sha256 })).sort((left, right) => left.id.localeCompare(right.id, "en")),
      approvedIcons: [],
      referenceFixture: runtimeAssets.referenceDigest,
      images: imageAssetDigests,
    },
    formatProfileId,
    appliedElements,
    ...(fingerprints?.pixelFingerprint ? { pixelFingerprint: fingerprints.pixelFingerprint } : {}),
    ...(fingerprints?.requestFingerprint ? { requestFingerprint: fingerprints.requestFingerprint } : {}),
    manualAcceptanceStatus: manifestAcceptanceStatus(),
  };
  const schemaValidators: SchemaValidators = new SchemaValidators(contracts);
  schemaValidators.assertManifest(manifest);
  const manifestText = canonicalJson(manifest);
  const manifestDigest = sha256Bytes(Buffer.from(manifestText, "utf8"));
  const finalOutput = defaultOutput(request);
  let jobDirectory: string | undefined;
  if (options.publish !== false) {
    try {
      jobDirectory = await resolveTrustedJobDirectory(options.outputRoot, finalOutput.directory, finalOutput.baseName);
    } catch (error) {
      return emptyResult([issue(contracts, "KBR-INPUT-009", "/output", { actual: error instanceof Error ? error.message : String(error) })], {
        formatProfileId,
        ...(fingerprints ? { pixelFingerprint: fingerprints.pixelFingerprint, requestFingerprint: fingerprints.requestFingerprint } : {}),
      });
    }
    try {
      const published = await publishArtifacts({
        outputRoot: options.outputRoot,
        jobDirectory,
        png,
        manifest: manifestText,
        overwrite: finalOutput.overwrite,
      });
      return {
        status: "PASS",
        png,
        pngDigest,
        manifestDigest,
        manifestPath: published.manifestPath,
        pngPath: published.pngPath,
        downloadAllowed: true,
        formatProfileId,
        artifactChecksumSha256: pngDigest,
        pixelFingerprint: fingerprints?.pixelFingerprint ?? null,
        requestFingerprint: fingerprints?.requestFingerprint ?? null,
        renderFingerprint: fingerprints?.pixelFingerprint ?? null,
        appliedElements,
        errors: [],
        warnings: splitIssues(finalIssues).warnings,
      };
    } catch (error) {
      const code = error instanceof PublishError ? error.code : "KBR-SYSTEM-004";
      return emptyResult([issue(contracts, code, "/output", { actual: error instanceof Error ? error.message : String(error) })], {
        formatProfileId,
        ...(fingerprints ? { pixelFingerprint: fingerprints.pixelFingerprint, requestFingerprint: fingerprints.requestFingerprint } : {}),
      });
    }
  }
  return {
    status: "PASS",
    png,
    pngDigest,
    manifestDigest,
    manifestPath: null,
    pngPath: null,
    downloadAllowed: false,
    formatProfileId,
    artifactChecksumSha256: pngDigest,
    pixelFingerprint: fingerprints?.pixelFingerprint ?? null,
    requestFingerprint: fingerprints?.requestFingerprint ?? null,
    renderFingerprint: fingerprints?.pixelFingerprint ?? null,
    appliedElements,
    errors: [],
    warnings: splitIssues(finalIssues).warnings,
  };
}

export { freeformResponseFromResult as toFreeformRenderResponse };
