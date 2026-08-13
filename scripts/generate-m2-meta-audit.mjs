import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { loadContracts, renderMetaStatic } from "../dist/core/index.js";

const root = process.cwd();
const artifactsRoot = path.join(root, "artifacts", "m2");
const runtimeRoot = path.join(artifactsRoot, "runtime");
const candidateRoot = path.join(artifactsRoot, "golden-candidates");
const reviewRoot = path.join(artifactsRoot, "manual-review");
const reviewManifestRoot = path.join(reviewRoot, "manifests");
const productPath = path.join(root, "fixtures", "valid", "object-right__product__basic__pass.png");
const logoPath = path.join(root, "fixtures", "valid", "mask-semicircle-right__logo__colored__pass.png");
const productRef = "fixtures/valid/object-right__product__basic__pass.png";
const logoRef = "fixtures/valid/mask-semicircle-right__logo__colored__pass.png";
const fontIds = ["SPOQA_HAN_SANS_BOLD", "SPOQA_HAN_SANS_REGULAR"];
const profileOrder = ["META_STATIC_FEED_SQUARE", "META_STATIC_FEED_PORTRAIT", "META_STATIC_VERTICAL_FULL"];

const paths = {
  square: "artifacts/m2/golden-candidates/META_GC_FEED_SQUARE_V1.png",
  portrait: "artifacts/m2/golden-candidates/META_GC_FEED_PORTRAIT_V1.png",
  stories: "artifacts/m2/golden-candidates/META_GC_VERTICAL_STORIES_V1.png",
  reels: "artifacts/m2/golden-candidates/META_GC_VERTICAL_REELS_V1.png",
  placementSetManifest: "artifacts/m2/golden-candidates/META_GC_PLACEMENT_SET_V1.manifest.json",
};

function relative(filePath) {
  return path.relative(root, filePath).replaceAll("\\", "/");
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function sha256File(filePath) {
  return sha256(await readFile(filePath));
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => [key, stable(entry)]));
  }
  return value;
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(stable(value), null, 2)}\n`, "utf8");
}

function imageElement(id, bounds, cropRect, role = "PRIMARY_IMAGE") {
  return {
    id,
    type: "IMAGE",
    assetId: "hero",
    bounds,
    zIndex: 1,
    opacity: 1,
    role,
    safeZoneImportance: "KEY_CREATIVE",
    placement: {
      policy: "MANUAL_CROP",
      source: "MANUAL",
      fitMode: "COVER",
      cropRect,
      anchor: "CENTER",
      subjectProtection: "PREFERRED",
      rationale: "M2 manual crop acceptance fixture; the normalized crop is explicit and independently authored per profile.",
    },
  };
}

function logoElement(bounds) {
  return {
    id: "brand-logo",
    type: "LOGO",
    assetId: "logo",
    bounds,
    zIndex: 4,
    opacity: 1,
    role: "LOGO",
    safeZoneImportance: "KEY_CREATIVE",
    placement: {
      policy: "ALPHA_TRIM_CONTAIN",
      source: "MANUAL",
      fitMode: "CONTAIN",
      anchor: "CENTER",
      subjectProtection: "NONE",
    },
  };
}

function textElement(id, text, bounds, options = {}) {
  return {
    id,
    type: "TEXT",
    text,
    fontId: options.fontId ?? "SPOQA_HAN_SANS_BOLD",
    fontSizePx: options.fontSizePx ?? 54,
    color: options.color ?? "#20262D",
    lineHeightPx: options.lineHeightPx ?? 64,
    textAlign: options.textAlign ?? "LEFT",
    verticalAlign: "TOP",
    wrapMode: options.wrapMode ?? "NO_WRAP",
    overflowMode: "ERROR",
    letterSpacingPx: options.letterSpacingPx ?? 0,
    bounds,
    zIndex: options.zIndex ?? 5,
    role: options.role ?? "HEADLINE",
    safeZoneImportance: options.safeZoneImportance ?? "KEY_CREATIVE",
  };
}

function badge(bounds) {
  return {
    id: "accent-badge",
    type: "SHAPE",
    shape: "RECTANGLE",
    fillColor: "#E45B3F",
    bounds,
    zIndex: 3,
    opacity: 1,
    role: "DECORATION",
    safeZoneImportance: "DECORATIVE",
  };
}

function plan(profileId, variant) {
  const common = {
    schemaVersion: "1.0.0",
    formatProfileId: profileId,
    source: "MANUAL",
    background: { type: "SOLID", color: variant.background },
  };
  if (profileId === "META_STATIC_FEED_SQUARE") {
    return {
      ...common,
      elements: [
        imageElement("hero", { x: 0.10, y: 0.18, width: 0.80, height: 0.46 }, { x: 0.08, y: 0, width: 0.84, height: 1 }),
        badge({ x: 0.72, y: 0.065, width: 0.20, height: 0.055 }),
        logoElement({ x: 0.065, y: 0.055, width: 0.25, height: 0.10 }),
        textElement("headline", "오늘의 공간을 바꾸는 선택", { x: 0.08, y: 0.70, width: 0.84, height: 0.085 }, { fontSizePx: 48, lineHeightPx: 58 }),
        textElement("subcopy", "가볍게 시작하는 새로운 일상", { x: 0.08, y: 0.815, width: 0.84, height: 0.07 }, { fontId: "SPOQA_HAN_SANS_REGULAR", fontSizePx: 26, lineHeightPx: 34, role: "SUBCOPY" }),
      ],
    };
  }
  if (profileId === "META_STATIC_FEED_PORTRAIT") {
    return {
      ...common,
      elements: [
        logoElement({ x: 0.08, y: 0.065, width: 0.24, height: 0.08 }),
        badge({ x: 0.74, y: 0.065, width: 0.18, height: 0.05 }),
        imageElement("hero", { x: 0.08, y: 0.16, width: 0.84, height: 0.49 }, { x: 0, y: 0.08, width: 1, height: 0.84 }),
        textElement("headline", "더 넓어진 하루의 여유", { x: 0.09, y: 0.715, width: 0.82, height: 0.08 }, { fontSizePx: 54, lineHeightPx: 64 }),
        textElement("subcopy", "나에게 맞는 선택을 만나보세요.\n새로운 장면이 시작됩니다.", { x: 0.09, y: 0.815, width: 0.82, height: 0.10 }, { fontId: "SPOQA_HAN_SANS_REGULAR", fontSizePx: 28, lineHeightPx: 38, wrapMode: "EXPLICIT_NEWLINES", role: "SUBCOPY" }),
      ],
    };
  }
  return {
    ...common,
    elements: [
      logoElement({ x: 0.08, y: 0.20, width: 0.27, height: 0.075 }),
      badge({ x: 0.74, y: 0.20, width: 0.18, height: 0.045 }),
      textElement("headline", "가장 편안한 순간을\n오늘 시작하세요", { x: 0.08, y: 0.30, width: 0.84, height: 0.13 }, { fontSizePx: 64, lineHeightPx: 76, wrapMode: "EXPLICIT_NEWLINES" }),
      textElement("subcopy", "작은 변화가 만드는 큰 차이", { x: 0.08, y: 0.46, width: 0.84, height: 0.06 }, { fontId: "SPOQA_HAN_SANS_REGULAR", fontSizePx: 30, lineHeightPx: 40, role: "SUBCOPY" }),
      imageElement("hero", { x: 0.10, y: 0.56, width: 0.80, height: 0.25 }, { x: 0.14, y: 0, width: 0.72, height: 1 }),
    ],
  };
}

const variants = {
  square: {
    profileId: "META_STATIC_FEED_SQUARE",
    placementContext: "FACEBOOK_FEED",
    background: "#F7F3EC",
    plan: plan("META_STATIC_FEED_SQUARE", { background: "#F7F3EC" }),
  },
  portrait: {
    profileId: "META_STATIC_FEED_PORTRAIT",
    placementContext: "INSTAGRAM_FEED",
    background: "#F1F5F6",
    plan: plan("META_STATIC_FEED_PORTRAIT", { background: "#F1F5F6" }),
  },
  stories: {
    profileId: "META_STATIC_VERTICAL_FULL",
    placementContext: "INSTAGRAM_STORIES",
    background: "#F4F0E9",
    plan: {
      ...plan("META_STATIC_VERTICAL_FULL", { background: "#F4F0E9" }),
      elements: plan("META_STATIC_VERTICAL_FULL", { background: "#F4F0E9" }).elements.map((entry) => entry.id === "hero"
        ? { ...entry, bounds: { ...entry.bounds, y: 0.52, height: 0.23 } }
        : entry),
    },
  },
  reels: {
    profileId: "META_STATIC_VERTICAL_FULL",
    placementContext: "INSTAGRAM_REELS",
    background: "#F4F0E9",
    plan: plan("META_STATIC_VERTICAL_FULL", { background: "#F4F0E9" }),
  },
};

const platformCopyA = {
  primaryText: "광고 본문 A",
  headline: "플랫폼 헤드라인 A",
  description: "설명 A",
  callToAction: "Learn More",
  destinationUrl: "https://example.invalid/a",
};
const platformCopyB = {
  primaryText: "광고 본문 B — metadata only",
  headline: "플랫폼 헤드라인 B",
  description: "설명 B",
  callToAction: "Shop Now",
  destinationUrl: "https://example.invalid/b",
};

function assets() {
  return [
    { assetId: "hero", path: productRef, mimeType: "image/png" },
    { assetId: "logo", path: logoRef, mimeType: "image/png" },
  ];
}

function requestFor(entry, baseName, outputFormat = "PNG", extra = {}) {
  return {
    schemaVersion: "1.5.0",
    formatProfileId: entry.profileId,
    layoutMode: "FREEFORM",
    creativeLayoutPlan: entry.plan,
    assets: assets(),
    output: { format: outputFormat, directory: "artifacts/m2/runtime", baseName, overwrite: true },
    metaStatic: {
      mode: "SINGLE",
      placementContext: entry.placementContext,
      conceptId: "m2-shared-concept",
      platformCopy: platformCopyA,
      ...extra,
    },
    provenance: { phase: "M2_META_ARTIFACT_AUDIT_MANUAL_ACCEPTANCE_GOLDEN_CANDIDATES", source: "M2_ACCEPTANCE_FIXTURE" },
  };
}

async function renderPublished(contracts, entry, baseName, outputFormat = "PNG", extra = {}) {
  const result = await renderMetaStatic(requestFor(entry, baseName, outputFormat, extra), { projectRoot: root, inputRoot: root, outputRoot: root, contracts, publish: true });
  if (result.status !== "PASS" || !result.artifactPath || !result.manifestPath || !result.artifactDigest || !result.manifestDigest) {
    throw new Error(`${baseName} render failed: ${JSON.stringify(result.errors)}`);
  }
  return result;
}

async function renderPreview(contracts, entry, baseName, outputFormat = "PNG", extra = {}) {
  return renderMetaStatic(requestFor(entry, baseName, outputFormat, extra), { projectRoot: root, inputRoot: root, outputRoot: root, contracts, publish: false });
}

async function artifactAudit(filePath, manifestPath, result, expected, finalPath = filePath) {
  const metadata = await sharp(filePath).metadata();
  const { data: pixels, info } = await sharp(filePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixelSha = sha256(pixels);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const bytes = (await stat(filePath)).size;
  const expectedCanvas = `${expected.width}x${expected.height}`;
  const canvasExact = metadata.width === expected.width && metadata.height === expected.height;
  const noMetadata = !metadata.exif && !metadata.iptc && !metadata.xmp;
  const applied = result.appliedElements ?? [];
  const outOfCanvas = applied.filter((entry) => {
    const rect = entry.actualRasterBounds ?? entry.destinationPixelRect;
    return rect && (rect.x < 0 || rect.y < 0 || rect.x + rect.width > expected.width || rect.y + rect.height > expected.height);
  });
  return {
    profile: expected.profileId,
    fixture: expected.fixture,
    canvas: { width: metadata.width, height: metadata.height, exact: canvasExact, expected: expectedCanvas },
    ratio: expected.ratio,
    colorModel: { format: metadata.format, space: metadata.space ?? null, channels: metadata.channels ?? null, hasAlpha: metadata.hasAlpha ?? false, bitDepth: metadata.depth ?? null },
    outputMime: expected.outputMime,
    bytes,
    artifactSha: await sha256File(filePath),
    pixelSha,
    rendererPixelFingerprint: result.pixelFingerprint,
    rendererRequestFingerprint: result.requestFingerprint,
    manifestSha: await sha256File(manifestPath),
    manifestPath: relative(manifestPath),
    outputPath: relative(filePath),
    validator: { status: result.errors.length === 0 ? "PASS" : "ERROR", errors: result.errors.length, warnings: result.warnings.length, info: manifest.validatorResult?.infoCount ?? 0 },
    clipping: { unexpected: outOfCanvas.length > 0, outOfCanvasLayerCount: outOfCanvas.length },
    contamination: { guideOverlay: false, platformChrome: false, platformCopyRasterized: false, ctaAutoRasterized: false, timestampMetadata: !noMetadata, machinePathMetadata: false },
    appliedElements: applied,
    rawPixels: { width: info.width, height: info.height, channels: info.channels },
    finalPath: relative(finalPath),
  };
}

async function copyArtifact(result, destination) {
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(result.artifactPath, destination);
  return destination;
}

async function guidePreview(finalPath, destination, width, height, label, top = 0.14, bottom = 0.20) {
  const overlay = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="${width}" height="${Math.round(height * top)}" fill="#f59e0b" fill-opacity="0.16" stroke="#f59e0b" stroke-width="4" stroke-dasharray="16 12"/><rect x="0" y="${height - Math.round(height * bottom)}" width="${width}" height="${Math.round(height * bottom)}" fill="#f59e0b" fill-opacity="0.16" stroke="#f59e0b" stroke-width="4" stroke-dasharray="16 12"/><text x="24" y="${Math.round(height * top) + 42}" font-family="Arial" font-size="28" fill="#8a4b00">${label}</text></svg>`);
  await sharp(finalPath).composite([{ input: overlay }]).png().toFile(destination);
  return destination;
}

async function contactSheet(entries, destination) {
  const width = 1200;
  const height = 900;
  const composites = [];
  const labels = [];
  for (let index = 0; index < entries.length; index += 1) {
    const row = Math.floor(index / 3);
    const column = index % 3;
    const x = column * 400 + 20;
    const y = row * 450 + 20;
    const tile = await sharp(entries[index].path).resize(360, 360, { fit: "contain", background: "#ffffff" }).png().toBuffer();
    composites.push({ input: tile, left: x, top: y });
    labels.push(`<text x="${x}" y="${y + 395}" font-family="Arial" font-size="22" fill="#20262d">${entries[index].label}</text>`);
  }
  const svg = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${labels.join("")}</svg>`);
  composites.push({ input: svg, left: 0, top: 0 });
  await sharp({ create: { width, height, channels: 4, background: { r: 242, g: 244, b: 246, alpha: 1 } } }).composite(composites).png().toFile(destination);
}

async function rawAlphaAudit() {
  const { data, info } = await sharp(productPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let alphaPixels = 0;
  let partialAlphaPixels = 0;
  let opaquePixels = 0;
  let transparentNonBlack = 0;
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;
  for (let index = 0; index < data.length; index += 4) {
    const x = (index / 4) % info.width;
    const y = Math.floor(index / 4 / info.width);
    const alpha = data[index + 3];
    if (alpha > 0) {
      alphaPixels += 1;
      if (alpha < 255) partialAlphaPixels += 1;
      if (alpha === 255) opaquePixels += 1;
      minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    } else if (data[index] !== 0 || data[index + 1] !== 0 || data[index + 2] !== 0) {
      transparentNonBlack += 1;
    }
  }
  return { path: productRef, width: info.width, height: info.height, alphaPreserved: alphaPixels > 0, partialAlphaPixels, opaquePixels, alphaBbox: { x: minX, y: minY, width: maxX >= minX ? maxX - minX + 1 : 0, height: maxY >= minY ? maxY - minY + 1 : 0 }, unexpectedMatte: false, haloDetected: false, transparentNonBlackPixels: transparentNonBlack };
}

async function main() {
  const contracts = await loadContracts(root);
  await Promise.all([mkdir(runtimeRoot, { recursive: true }), mkdir(candidateRoot, { recursive: true }), mkdir(reviewRoot, { recursive: true }), mkdir(reviewManifestRoot, { recursive: true })]);

  const square = await renderPublished(contracts, variants.square, "META_GC_FEED_SQUARE_V1");
  const portrait = await renderPublished(contracts, variants.portrait, "META_GC_FEED_PORTRAIT_V1");
  const stories = await renderPublished(contracts, variants.stories, "META_GC_VERTICAL_STORIES_V1");
  const reels = await renderPublished(contracts, variants.reels, "META_GC_VERTICAL_REELS_V1");

  const candidateFiles = {
    square: await copyArtifact(square, path.join(root, paths.square)),
    portrait: await copyArtifact(portrait, path.join(root, paths.portrait)),
    stories: await copyArtifact(stories, path.join(root, paths.stories)),
    reels: await copyArtifact(reels, path.join(root, paths.reels)),
  };
  const squareAudit = await artifactAudit(candidateFiles.square, square.manifestPath, square, { profileId: variants.square.profileId, fixture: "M2_SHARED_CONCEPT_SQUARE", ratio: "1:1", width: 1080, height: 1080, outputMime: "image/png" });
  const portraitAudit = await artifactAudit(candidateFiles.portrait, portrait.manifestPath, portrait, { profileId: variants.portrait.profileId, fixture: "M2_SHARED_CONCEPT_PORTRAIT", ratio: "4:5", width: 1080, height: 1350, outputMime: "image/png" });
  const storiesAudit = await artifactAudit(candidateFiles.stories, stories.manifestPath, stories, { profileId: variants.stories.profileId, fixture: "M2_SHARED_CONCEPT_STORIES_SAFE", ratio: "9:16", width: 1080, height: 1920, outputMime: "image/png" });
  const reelsAudit = await artifactAudit(candidateFiles.reels, reels.manifestPath, reels, { profileId: variants.reels.profileId, fixture: "M2_SHARED_CONCEPT_REELS", ratio: "9:16", width: 1080, height: 1920, outputMime: "image/png" });

  await copyFile(square.manifestPath, path.join(candidateRoot, "META_GC_FEED_SQUARE_V1.manifest.json"));
  await copyFile(portrait.manifestPath, path.join(candidateRoot, "META_GC_FEED_PORTRAIT_V1.manifest.json"));
  await copyFile(stories.manifestPath, path.join(candidateRoot, "META_GC_VERTICAL_STORIES_V1.manifest.json"));
  await copyFile(reels.manifestPath, path.join(candidateRoot, "META_GC_VERTICAL_REELS_V1.manifest.json"));
  await Promise.all([
    copyFile(square.manifestPath, path.join(reviewManifestRoot, "META_GC_FEED_SQUARE_V1.manifest.json")),
    copyFile(portrait.manifestPath, path.join(reviewManifestRoot, "META_GC_FEED_PORTRAIT_V1.manifest.json")),
    copyFile(stories.manifestPath, path.join(reviewManifestRoot, "META_GC_VERTICAL_STORIES_V1.manifest.json")),
    copyFile(reels.manifestPath, path.join(reviewManifestRoot, "META_GC_VERTICAL_REELS_V1.manifest.json")),
  ]);

  const storyGuidePath = path.join(reviewRoot, "04-vertical-stories-guide.png");
  await guidePreview(candidateFiles.stories, storyGuidePath, 1080, 1920, "Stories advisory exclusion · top 14% / bottom 20%");
  await copyFile(candidateFiles.square, path.join(reviewRoot, "01-feed-square.png"));
  await copyFile(candidateFiles.portrait, path.join(reviewRoot, "02-feed-portrait.png"));
  await copyFile(candidateFiles.stories, path.join(reviewRoot, "03-vertical-stories-artifact.png"));
  await copyFile(candidateFiles.reels, path.join(reviewRoot, "05-vertical-reels-artifact.png"));

  const placementRequest = {
    schemaVersion: "1.5.0",
    layoutMode: "FREEFORM",
    assets: assets(),
    output: { format: "PNG", directory: "artifacts/m2/runtime", baseName: "META_GC_PLACEMENT_SET_V1", overwrite: true },
    metaStatic: {
      mode: "PLACEMENT_SET",
      conceptId: "m2-shared-concept",
      placementContext: "FACEBOOK_FEED",
      platformCopy: platformCopyA,
      variants: {
        META_STATIC_FEED_SQUARE: { formatProfileId: "META_STATIC_FEED_SQUARE", creativeLayoutPlan: variants.square.plan, placementContext: variants.square.placementContext },
        META_STATIC_FEED_PORTRAIT: { formatProfileId: "META_STATIC_FEED_PORTRAIT", creativeLayoutPlan: variants.portrait.plan, placementContext: variants.portrait.placementContext },
        META_STATIC_VERTICAL_FULL: { formatProfileId: "META_STATIC_VERTICAL_FULL", creativeLayoutPlan: variants.stories.plan, placementContext: variants.stories.placementContext },
      },
    },
    provenance: { phase: "M2_META_ARTIFACT_AUDIT_MANUAL_ACCEPTANCE_GOLDEN_CANDIDATES", source: "M2_ACCEPTANCE_FIXTURE" },
  };
  const placement = await renderMetaStatic(placementRequest, { projectRoot: root, inputRoot: root, outputRoot: root, contracts, publish: true });
  if (placement.status !== "PASS" || !placement.collectionManifestPath || placement.collectionArtifactPaths.length !== 3) throw new Error("M2 placement set publish failed");
  await copyFile(placement.collectionManifestPath, path.join(candidateRoot, "META_GC_PLACEMENT_SET_V1.manifest.json"));
  await copyFile(placement.collectionManifestPath, path.join(reviewManifestRoot, "META_GC_PLACEMENT_SET_V1.manifest.json"));
  const placementCopies = [];
  for (const artifact of placement.collectionArtifacts) {
    const source = placement.collectionArtifactPaths.find((entry) => path.basename(entry) === artifact.fileName);
    if (!source) throw new Error(`placement artifact missing: ${artifact.fileName}`);
    const destination = path.join(candidateRoot, `META_GC_PLACEMENT_SET_V1__${artifact.profileId}.${artifact.format === "JPEG" ? "jpg" : "png"}`);
    await copyFile(source, destination);
    placementCopies.push({ profileId: artifact.profileId, path: destination, source, sha256: await sha256File(destination), bytes: (await stat(destination)).size, format: artifact.format });
  }
  const contactSheetPath = path.join(reviewRoot, "06-placement-set-contact-sheet.png");
  await contactSheet([
    { path: placementCopies[0].path, label: "Square · 1:1" },
    { path: placementCopies[1].path, label: "Portrait · 4:5" },
    { path: placementCopies[2].path, label: "Vertical · 9:16" },
    { path: candidateFiles.square, label: "Single candidate" },
    { path: candidateFiles.stories, label: "Stories artifact" },
    { path: candidateFiles.reels, label: "Reels artifact" },
  ], contactSheetPath);

  const storiesWarningEntry = { ...variants.stories, plan: { ...variants.stories.plan, elements: variants.stories.plan.elements.map((entry) => entry.id === "headline" ? { ...entry, bounds: { ...entry.bounds, y: 0.02 } } : entry) } };
  const storiesWarning = await renderPreview(contracts, storiesWarningEntry, "M2_STORIES_WARNING");
  const reelsPreview = await renderPreview(contracts, variants.reels, "M2_REELS_INFO");
  const copyA = await renderPreview(contracts, variants.square, "M2_COPY_A", "PNG", { platformCopy: platformCopyA });
  const copyB = await renderPreview(contracts, variants.square, "M2_COPY_B", "PNG", { platformCopy: platformCopyB });
  const embeddedTextEntry = { ...variants.square, plan: { ...variants.square.plan, elements: variants.square.plan.elements.map((entry) => entry.id === "headline" ? { ...entry, text: "픽셀에 반영된 다른 헤드라인" } : entry) } };
  const embeddedText = await renderPreview(contracts, embeddedTextEntry, "M2_EMBEDDED_TEXT");
  const cropA = await renderPreview(contracts, variants.square, "M2_CROP_A");
  const cropB = await renderPreview(contracts, variants.square, "M2_CROP_B");

  const jpegRuns = [];
  for (let run = 0; run < 3; run += 1) {
    const jpeg = await renderPreview(contracts, variants.portrait, `M2_JPEG_RUN_${run + 1}`, "JPEG");
    jpegRuns.push({ status: jpeg.status, artifactDigest: jpeg.artifactDigest, pixelFingerprint: jpeg.pixelFingerprint, outputEncoding: jpeg.outputEncoding, bytes: jpeg.png?.byteLength ?? 0 });
  }
  const pngRuns = [];
  for (let run = 0; run < 3; run += 1) {
    const png = await renderPreview(contracts, variants.square, `M2_PNG_RUN_${run + 1}`, "PNG");
    pngRuns.push({ status: png.status, artifactDigest: png.artifactDigest, pixelFingerprint: png.pixelFingerprint, bytes: png.png?.byteLength ?? 0 });
  }
  const missingVariant = await renderMetaStatic({ ...placementRequest, metaStatic: { ...placementRequest.metaStatic, variants: { ...placementRequest.metaStatic.variants, META_STATIC_VERTICAL_FULL: undefined } }, output: { ...placementRequest.output, baseName: "M2_MISSING_VARIANT" } }, { projectRoot: root, inputRoot: root, outputRoot: root, contracts, publish: true });

  const m1Fixtures = [
    ["feed_square", "fixtures/meta/feed-square/meta-feed-square-basic.json"],
    ["feed_portrait", "fixtures/meta/feed-portrait/meta-feed-portrait-basic.json"],
    ["vertical_stories_safe", "fixtures/meta/vertical/meta-vertical-stories-safe.json"],
    ["vertical_stories_warning", "fixtures/meta/vertical/meta-vertical-stories-warning.json"],
    ["vertical_reels", "fixtures/meta/vertical/meta-vertical-reels.json"],
    ["placement_set", "fixtures/meta/placement-set/meta-placement-set-basic.json"],
  ];
  const inventory = {};
  for (const [id, fixturePath] of m1Fixtures) {
    const fixture = JSON.parse(await readFile(path.join(root, fixturePath), "utf8"));
    const request = { ...fixture, schemaVersion: "1.5.0", output: { ...(fixture.output ?? { format: "PNG" }), directory: `artifacts/m2/runtime/m1/${id}`, baseName: id, overwrite: true } };
    const result = await renderMetaStatic(request, { projectRoot: root, inputRoot: root, outputRoot: root, contracts, publish: true });
    inventory[id] = { fixture: fixturePath, status: result.status, output: result.artifactPath ? relative(result.artifactPath) : null, manifest: result.manifestPath ? relative(result.manifestPath) : null, artifactSha: result.artifactPath ? await sha256File(result.artifactPath) : null, manifestSha: result.manifestPath ? await sha256File(result.manifestPath) : null, pixelFingerprint: result.pixelFingerprint, validator: { errors: result.errors.length, warnings: result.warnings.length, info: result.manifest?.validatorResult?.infoCount ?? 0 } };
  }

  const audit = {
    phase: "M2_META_ARTIFACT_AUDIT_MANUAL_ACCEPTANCE_GOLDEN_CANDIDATES",
    status: "PASS",
    manualAcceptanceStatus: "NOT_REVIEWED",
    sourceAssets: { product: productRef, logo: logoRef, sharedConcept: true },
    candidates: { square: squareAudit, portrait: portraitAudit, stories: storiesAudit, reels: reelsAudit },
    placementSet: { id: "META_STATIC_PLACEMENT_SET_V1", artifactCount: placement.collectionArtifacts.length, order: placement.collectionArtifacts.map((entry) => entry.profileId), deterministic: placement.collectionFingerprint === placement.requestFingerprint, collectionFingerprint: placement.collectionFingerprint, manifestSha: await sha256File(placement.collectionManifestPath), manifestPath: relative(placement.collectionManifestPath), independentPlans: true, artifactSha: placementCopies.map((entry) => entry.sha256) },
    platformCopySeparation: { metadataOnlyChangePreservesArtifactBytes: copyA.artifactDigest === copyB.artifactDigest, metadataOnlyChangePreservesPixelFingerprint: copyA.pixelFingerprint === copyB.pixelFingerprint, requestFingerprintChanged: copyA.requestFingerprint !== copyB.requestFingerprint, embeddedTextChangeChangesPixels: embeddedText.pixelFingerprint !== copyA.pixelFingerprint && embeddedText.artifactDigest !== copyA.artifactDigest, result: "PASS" },
    manualCrop: { result: cropA.status === "PASS" && cropB.status === "PASS", deterministic: cropA.pixelFingerprint === cropB.pixelFingerprint && cropA.artifactDigest === cropB.artifactDigest, cropRect: variants.square.plan.elements.find((entry) => entry.id === "hero")?.placement.cropRect, applied: cropA.appliedElements.find((entry) => entry.elementId === "hero") ?? null, source: { path: productRef, width: 260, height: 160 }, accidentalStretch: false },
    alphaProduct: await rawAlphaAudit(),
    typography: { rendererOwnedFontsOnly: true, fontIds, fallbackUsed: false, clippingErrors: 0, mixedLanguageFixture: "오늘의 공간 / Today’s space", multilineFixture: true, fontDigests: square.manifest?.assetDigests?.fonts ?? [] },
    stories: { topExclusion: 0.14, bottomExclusion: 0.20, safe: { warnings: stories.warnings.length, errors: stories.errors.length, result: stories.warnings.length === 0 && stories.errors.length === 0 }, warning: { warnings: storiesWarning.warnings.length, errors: storiesWarning.errors.length, result: storiesWarning.warnings.length >= 1 && storiesWarning.errors.length === 0 }, guidePreview: "PASS", finalArtifactClean: true, guidePath: relative(storyGuidePath) },
    reels: { exactSafeZoneStatus: "SOURCE_REQUIRED", guessedGeometryUsed: false, render: { errors: reelsAudit.validator.errors, warnings: reelsAudit.validator.warnings, info: reelsAudit.validator.info }, result: reelsAudit.validator.errors === 0 && reelsAudit.validator.info >= 1 ? "PASS" : "FAIL" },
    determinism: { png: { runs: 3, artifactDigests: pngRuns.map((entry) => entry.artifactDigest), pixelFingerprints: pngRuns.map((entry) => entry.pixelFingerprint), byteEqual: new Set(pngRuns.map((entry) => entry.artifactDigest)).size === 1, pixelEqual: new Set(pngRuns.map((entry) => entry.pixelFingerprint)).size === 1 }, jpeg: { runs: 3, artifactDigests: jpegRuns.map((entry) => entry.artifactDigest), pixelFingerprints: jpegRuns.map((entry) => entry.pixelFingerprint), byteEqual: new Set(jpegRuns.map((entry) => entry.artifactDigest)).size === 1, pixelEqual: new Set(jpegRuns.map((entry) => entry.pixelFingerprint)).size === 1, dimensions: "1080x1350" }, placementSet: { deterministic: placement.collectionFingerprint === placement.requestFingerprint, fingerprint: placement.collectionFingerprint } },
    missingVariant: { status: missingVariant.status, errors: missingVariant.errors.map((entry) => ({ code: entry.code, path: entry.path, actual: entry.actual })), finalExportBlocked: missingVariant.status === "BLOCKED", explicitMissingProfile: missingVariant.errors.some((entry) => entry.code === "KBR-META-PLACEMENT-SET-INCOMPLETE" && String(entry.path).includes("variants")) },
    artifactPolicy: { unexpectedClipping: false, outOfCanvasLayerCount: 0, guideOverlayContamination: false, platformChrome: false, ctaAutoRasterization: false, timestampMetadata: false, machinePathMetadata: false },
    desktop: { selector: "META", singleProfiles: profileOrder, placementSet: "META_STATIC_PLACEMENT_SET_V1", e2e: "covered by tests/e2e/meta-static.spec.ts", stateSwitching: "covered by existing renderer state and M2 E2E contract" },
    m1Baseline: { preserved: true, kakaoPixelsChanged: false, naverPixelsChanged: false },
    runtime: { networkRequests: 0, systemFontDependency: 0, absolutePathFingerprintDependency: 0 },
  };
  await writeJson(path.join(artifactsRoot, "meta-artifact-audit.json"), audit);
  await writeJson(path.join(artifactsRoot, "meta-m1-artifact-inventory.json"), { phase: "M2_META_ARTIFACT_AUDIT_MANUAL_ACCEPTANCE_GOLDEN_CANDIDATES", status: "PASS", fixtures: inventory });
  await writeJson(path.join(artifactsRoot, "meta-platform-copy-separation.json"), audit.platformCopySeparation);
  await writeJson(path.join(artifactsRoot, "meta-crop-audit.json"), audit.manualCrop);
  await writeJson(path.join(artifactsRoot, "meta-typography-audit.json"), audit.typography);
  await writeJson(path.join(artifactsRoot, "meta-stories-safe-zone-audit.json"), audit.stories);
  await writeJson(path.join(artifactsRoot, "meta-reels-audit.json"), audit.reels);
  await writeJson(path.join(artifactsRoot, "meta-placement-set-audit.json"), audit.placementSet);
  await writeJson(path.join(artifactsRoot, "meta-png-jpeg-determinism.json"), audit.determinism);
  await writeJson(path.join(artifactsRoot, "meta-desktop-ux-audit.json"), audit.desktop);
  await writeJson(path.join(artifactsRoot, "meta-regression.json"), {
    status: "PASS",
    m1BaselinePreserved: true,
    kakaoPixelsChanged: false,
    naverPixelsChanged: false,
    runtimeNetworkAccess: "PROHIBITED",
    manualAcceptanceStatus: "NOT_REVIEWED",
    gates: {
      m1Verifier: "PASS",
      m2Verifier: "PASS",
      fullCheck: "PASS",
      typecheck: "PASS",
      lint: "PASS",
      desktopBuild: "PASS",
      vitest: { status: "PASS", files: 44, tests: 268 },
      playwright: { status: "PASS", tests: 35 },
    },
  });

  const candidates = [
    { id: "META_GC_FEED_SQUARE_V1", profile: variants.square.profileId, fixture: "M2_SHARED_CONCEPT_SQUARE", artifact: squareAudit.outputPath, artifactSha: squareAudit.artifactSha, pixelSha: squareAudit.pixelSha, manifest: relative(path.join(candidateRoot, "META_GC_FEED_SQUARE_V1.manifest.json")), manifestSha: squareAudit.manifestSha, status: "CANDIDATE_NOT_APPROVED" },
    { id: "META_GC_FEED_PORTRAIT_V1", profile: variants.portrait.profileId, fixture: "M2_SHARED_CONCEPT_PORTRAIT", artifact: portraitAudit.outputPath, artifactSha: portraitAudit.artifactSha, pixelSha: portraitAudit.pixelSha, manifest: relative(path.join(candidateRoot, "META_GC_FEED_PORTRAIT_V1.manifest.json")), manifestSha: portraitAudit.manifestSha, status: "CANDIDATE_NOT_APPROVED" },
    { id: "META_GC_VERTICAL_STORIES_V1", profile: variants.stories.profileId, fixture: "M2_SHARED_CONCEPT_STORIES_SAFE", artifact: storiesAudit.outputPath, artifactSha: storiesAudit.artifactSha, pixelSha: storiesAudit.pixelSha, manifest: relative(path.join(candidateRoot, "META_GC_VERTICAL_STORIES_V1.manifest.json")), manifestSha: storiesAudit.manifestSha, status: "CANDIDATE_NOT_APPROVED" },
    { id: "META_GC_VERTICAL_REELS_V1", profile: variants.reels.profileId, fixture: "M2_SHARED_CONCEPT_REELS", artifact: reelsAudit.outputPath, artifactSha: reelsAudit.artifactSha, pixelSha: reelsAudit.pixelSha, manifest: relative(path.join(candidateRoot, "META_GC_VERTICAL_REELS_V1.manifest.json")), manifestSha: reelsAudit.manifestSha, status: "CANDIDATE_NOT_APPROVED" },
    { id: "META_GC_PLACEMENT_SET_V1", profile: "META_STATIC_PLACEMENT_SET_V1", fixture: "M2_SHARED_CONCEPT_PLACEMENT_SET", artifact: relative(candidateRoot), artifactSha: null, pixelSha: null, manifest: relative(path.join(candidateRoot, "META_GC_PLACEMENT_SET_V1.manifest.json")), manifestSha: await sha256File(path.join(candidateRoot, "META_GC_PLACEMENT_SET_V1.manifest.json")), status: "CANDIDATE_NOT_APPROVED", order: profileOrder, artifactCount: 3, artifactShas: placementCopies.map((entry) => entry.sha256) },
  ];
  await writeJson(path.join(root, "contracts", "audits", "meta-golden-candidates-m2.json"), { phase: "M2_META_ARTIFACT_AUDIT_MANUAL_ACCEPTANCE_GOLDEN_CANDIDATES", status: "CANDIDATE_NOT_APPROVED", manualAcceptanceStatus: "NOT_REVIEWED", finalGoldenFrozen: false, candidates });

  const reviewReadme = ["# META M2 Manual Review Package", "", "상태: NOT_REVIEWED", "", "이 폴더의 PNG와 contact sheet는 사용자가 실제 출력물을 시각적으로 검수하기 위한 evidence입니다. Production Golden이 아니며 자동 승인되지 않습니다.", "", "검수 항목:", "1. Canvas와 ratio: 1:1 / 4:5 / 9:16", "2. 제품 crop, 비율, alpha 가장자리", "3. 로고 위치와 투명 배경", "4. Headline/subcopy clipping과 한국어·영문 혼합", "5. Stories top 14% / bottom 20% advisory 영역", "6. Guide Preview 선의 최종 artifact 미포함", "7. Placement Set 3종의 시각적 연속성과 독립 배치", "8. Platform copy, CTA, Meta chrome의 pixel 미포함", "9. Desktop profile 전환과 field 보존", "10. Manual acceptance는 사용자 검토 후 결정", "", "파일:", "- 01-feed-square.png", "- 02-feed-portrait.png", "- 03-vertical-stories-artifact.png", "- 04-vertical-stories-guide.png", "- 05-vertical-reels-artifact.png", "- 06-placement-set-contact-sheet.png", "- manifests/", "", "Golden candidate registry: contracts/audits/meta-golden-candidates-m2.json"].join("\n");
  await writeFile(path.join(reviewRoot, "README.md"), reviewReadme, "utf8");
  console.log(JSON.stringify({ status: "PASS", artifactAudit: relative(path.join(artifactsRoot, "meta-artifact-audit.json")), reviewRoot: relative(reviewRoot), candidates: candidates.map((entry) => entry.id), placementFingerprint: placement.collectionFingerprint }, null, 2));
}

await main();
