import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { createKakaoBizboardRenderer } from "../dist/core/index.js";

const root = process.cwd();
const sourceCommit = "a6318e0df7940290743b455a26cc168d985e9bee";
const canonicalVersion = "1.21.4";
const ids = ["N2-REP-001", "N2-REP-002", "N2-REP-003", "N2-REP-004", "N2-REP-005", "N2-REP-006"];
const goldenRoot = path.join(root, "fixtures", "golden", "naver-smartchannel");
const artifactRoot = path.join(root, "artifacts", "n7-8");
const diffRoot = path.join(artifactRoot, "golden-diffs");
const outputRoot = path.join(root, ".tmp-n7-8-golden-output");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const relative = (value) => path.relative(root, value).replaceAll(path.sep, "/");

function rectContains(rect, x, y) {
  return x >= rect.x && y >= rect.y && x < rect.x + rect.width && y < rect.y + rect.height;
}

function paddedRect(rect, width, height, padding = 4) {
  const x = Math.max(0, Math.floor(Number(rect.x)) - padding);
  const y = Math.max(0, Math.floor(Number(rect.y)) - padding);
  const right = Math.min(width, Math.ceil(Number(rect.x) + Number(rect.width)) + padding);
  const bottom = Math.min(height, Math.ceil(Number(rect.y) + Number(rect.height)) + padding);
  return { x, y, width: right - x, height: bottom - y };
}

function textRegions(manifest, width, height) {
  return (manifest.smartChannelReport?.textRoles ?? []).flatMap((role) => {
    const regions = [role.box, role.actualRasterBounds].filter(Boolean);
    return regions.map((region) => paddedRect(region, width, height));
  });
}

async function decodedRgba(bytes) {
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

async function diffEvidence(oldBytes, newBytes, oldManifest, newManifest, directory) {
  const oldImage = await decodedRgba(oldBytes);
  const newImage = await decodedRgba(newBytes);
  if (oldImage.width !== newImage.width || oldImage.height !== newImage.height) {
    throw new Error(`Golden dimensions changed: ${oldImage.width}x${oldImage.height} -> ${newImage.width}x${newImage.height}`);
  }
  const { width, height } = oldImage;
  const regions = [...textRegions(oldManifest, width, height), ...textRegions(newManifest, width, height)];
  const diff = Buffer.alloc(width * height * 4);
  let changedPixels = 0;
  let changedOutsideAllowedRegions = 0;
  let channelDeltaSum = 0;
  let maxChannelDelta = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const offset = pixel * 4;
    let changed = false;
    let pixelMaxDelta = 0;
    for (let channel = 0; channel < 4; channel += 1) {
      const delta = Math.abs(oldImage.data[offset + channel] - newImage.data[offset + channel]);
      channelDeltaSum += delta;
      maxChannelDelta = Math.max(maxChannelDelta, delta);
      pixelMaxDelta = Math.max(pixelMaxDelta, delta);
      changed ||= delta > 0;
    }
    if (!changed) continue;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    changedPixels += 1;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    if (!regions.some((region) => rectContains(region, x, y))) changedOutsideAllowedRegions += 1;
    diff[offset] = 255;
    diff[offset + 1] = 0;
    diff[offset + 2] = 255;
    diff[offset + 3] = Math.max(72, pixelMaxDelta);
  }
  const metrics = {
    width,
    height,
    changedPixels,
    changedRatio: changedPixels / (width * height),
    meanAbsDelta: channelDeltaSum / (width * height * 4),
    maxChannelDelta,
    changedBounds: changedPixels === 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 },
    allowedChangeClass: "TEXT_AND_CTA_TEXT_RASTER_ONLY",
    allowedRegions: regions,
    changedOutsideAllowedRegions,
    expectedScopePass: changedPixels > 0 && changedOutsideAllowedRegions === 0,
    oldPixelSha256: sha256(oldImage.data),
    newPixelSha256: sha256(newImage.data),
  };
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "old.png"), oldBytes);
  await writeFile(path.join(directory, "new.png"), newBytes);
  await sharp(diff, { raw: { width, height, channels: 4 } }).png().toFile(path.join(directory, "diff.png"));
  await writeFile(path.join(directory, "metrics.json"), `${JSON.stringify(metrics, null, 2)}\n`, "utf8");
  return metrics;
}

await rm(outputRoot, { recursive: true, force: true });
await rm(diffRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });
await mkdir(diffRoot, { recursive: true });

const oldRegistry = JSON.parse(await readFile(path.join(goldenRoot, "registry.json"), "utf8"));
if (JSON.stringify(oldRegistry.candidates.map((entry) => entry.id)) !== JSON.stringify(ids)) {
  throw new Error("SmartChannel representative Golden topology is not exactly the approved six candidates");
}
const renderer = await createKakaoBizboardRenderer({ projectRoot: root, inputRoot: root, outputRoot });
const prepared = [];

for (const id of ids) {
  const inputPath = path.join(root, "fixtures", "valid", "naver-smartchannel", `${id}.input.json`);
  const input = JSON.parse(await readFile(inputPath, "utf8"));
  const oldEntry = oldRegistry.candidates.find((entry) => entry.id === id);
  const oldPngPath = path.join(root, oldEntry.path);
  const oldManifestPath = path.join(root, oldEntry.manifestPath);
  const oldBytes = await readFile(oldPngPath);
  const oldManifestBytes = await readFile(oldManifestPath);
  const oldManifest = JSON.parse(oldManifestBytes.toString("utf8"));
  const runs = [];
  const pixelRuns = [];
  let result;
  for (let run = 0; run < 3; run += 1) {
    result = await renderer.render(input);
    if (result.status !== "PASS" || !result.pngPath || !result.manifestPath || !result.pngDigest) {
      throw new Error(`${id} failed: ${JSON.stringify(result.errors)}`);
    }
    const bytes = await readFile(result.pngPath);
    runs.push(result.pngDigest);
    pixelRuns.push(sha256((await decodedRgba(bytes)).data));
  }
  if (new Set(runs).size !== 1 || new Set(pixelRuns).size !== 1) {
    throw new Error(`${id} is not three-run byte/pixel deterministic`);
  }
  const newBytes = await readFile(result.pngPath);
  const newManifestBytes = await readFile(result.manifestPath);
  const newManifest = JSON.parse(newManifestBytes.toString("utf8"));
  const metrics = await diffEvidence(oldBytes, newBytes, oldManifest, newManifest, path.join(diffRoot, id));
  if (!metrics.expectedScopePass) {
    throw new Error(`${id} diff escaped text-only expected scope: ${metrics.changedOutsideAllowedRegions}`);
  }
  const fontDigests = Object.fromEntries((newManifest.smartChannelReport?.fonts ?? []).map((font) => [font.token, font.digest]));
  prepared.push({
    id,
    templateId: result.templateId,
    objectPlacementToken: result.objectPlacementToken,
    width: newManifest.smartChannelReport.canvas.width,
    height: newManifest.smartChannelReport.canvas.height,
    transparent: true,
    oldPngSha256: sha256(oldBytes),
    pngSha256: result.pngDigest,
    oldManifestSha256: sha256(oldManifestBytes),
    manifestSha256: result.manifestDigest,
    pixelSha256: pixelRuns[0],
    pixelFingerprint: result.pixelFingerprint,
    requestFingerprint: result.requestFingerprint,
    renderFingerprint: result.renderFingerprint,
    runDigests: runs,
    pixelRunDigests: pixelRuns,
    path: `fixtures/golden/naver-smartchannel/${id}.png`,
    manifestPath: `fixtures/golden/naver-smartchannel/${id}.manifest.json`,
    inputFixture: relative(inputPath),
    fontCollectionSha256: "0452cde17bbdfe71106680879df943034a003c537c95a4137bab124b3cfa4b66",
    runtimeFaceDigests: fontDigests,
    templateContractVersion: newManifest.templateContractVersion,
    smartChannelTemplateContractVersion: "1.10.0",
    canonicalVersion,
    reasonForRebase: "SOURCE_FONT_CORRECTION",
    reasonTaxonomy: [
      "SOURCE_FONT_CORRECTION",
      ...(newManifest.smartChannelReport.textRoles.some((role) => role.role === "HEADLINE" && role.rasterBaselineY === role.baselineY - 1)
        ? ["HEADLINE_VERTICAL_PARITY_CORRECTION"]
        : []),
      "ACTUAL_RASTER_PARITY_CORRECTION",
    ],
    uiOnlyChangeAffectedPixels: false,
    intentional: true,
    deterministic: true,
    sourceCommit,
    diffMetrics: metrics,
    newBytes,
    newManifestBytes,
  });
}

// Publish only after all six deterministic renders and expected-scope checks pass.
for (const entry of prepared) {
  await writeFile(path.join(goldenRoot, `${entry.id}.png`), entry.newBytes);
  await writeFile(path.join(goldenRoot, `${entry.id}.manifest.json`), entry.newManifestBytes);
}

const candidates = prepared.map(({ newBytes, newManifestBytes, oldPngSha256, oldManifestSha256, inputFixture, fontCollectionSha256, runtimeFaceDigests, templateContractVersion, smartChannelTemplateContractVersion, canonicalVersion: entryCanonicalVersion, reasonForRebase, reasonTaxonomy, uiOnlyChangeAffectedPixels, intentional, deterministic, sourceCommit: entrySourceCommit, diffMetrics, pixelSha256, pixelRunDigests, ...entry }) => ({
  ...entry,
  pixelSha256,
  pixelRunDigests,
  inputFixture,
  fontCollectionSha256,
  runtimeFaceDigests,
  templateContractVersion,
  smartChannelTemplateContractVersion,
  canonicalVersion: entryCanonicalVersion,
  reasonForRebase,
  reasonTaxonomy,
  uiOnlyChangeAffectedPixels,
  intentional,
  deterministic,
  sourceCommit: entrySourceCommit,
  oldPngSha256,
  oldManifestSha256,
  changedPixels: diffMetrics.changedPixels,
  changedRatio: diffMetrics.changedRatio,
}));

const registry = {
  registryVersion: "1.0.1",
  status: "FROZEN_REPRESENTATIVE_GOLDENS_N7_8",
  topology: "SIX_REPRESENTATIVE_GOLDENS_WITH_120_TEMPLATE_EXHAUSTIVE_VALIDATION",
  sourceCommit,
  candidates,
};
await writeFile(path.join(goldenRoot, "registry.json"), `${JSON.stringify(registry, null, 2)}\n`, "utf8");

const manifest = {
  phase: "N7_8_SMARTCHANNEL_GOLDEN_REBASE_FINAL_PACKAGE_QA",
  status: "PASS",
  sourceCommit,
  canonicalVersion,
  goldenRegistryVersion: registry.registryVersion,
  productionRenderPath: true,
  representativeGoldenCount: candidates.length,
  exhaustiveTemplateCount: 120,
  intentionalChangesOnly: true,
  deterministic: true,
  uiOnlyN7_7_6PixelChange: false,
  candidates: candidates.map((entry) => ({
    id: entry.id,
    templateId: entry.templateId,
    inputFixture: entry.inputFixture,
    oldPngSha256: entry.oldPngSha256,
    outputPngSha256: entry.pngSha256,
    pixelSha256: entry.pixelSha256,
    requestFingerprint: entry.requestFingerprint,
    renderFingerprint: entry.renderFingerprint,
    fontCollectionSha256: entry.fontCollectionSha256,
    runtimeFaceDigests: entry.runtimeFaceDigests,
    templateContractVersion: entry.templateContractVersion,
    smartChannelTemplateContractVersion: entry.smartChannelTemplateContractVersion,
    canonicalVersion: entry.canonicalVersion,
    reasonForRebase: entry.reasonForRebase,
    reasonTaxonomy: entry.reasonTaxonomy,
    intentional: entry.intentional,
    sourceCommit: entry.sourceCommit,
    diffMetricsPath: `artifacts/n7-8/golden-diffs/${entry.id}/metrics.json`,
  })),
};
await writeFile(path.join(artifactRoot, "golden-rebase-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
await writeFile(path.join(artifactRoot, "golden-topology.json"), `${JSON.stringify({
  phase: manifest.phase,
  status: "PASS",
  existingGoldenCount: 6,
  representativeGoldens: ids,
  exhaustiveFixtureCount: 120,
  smartChannelTemplatesTotal: 120,
  policy: "PRESERVE_EXISTING_SIX_REPRESENTATIVE_GOLDENS",
  generatedAdditionalGoldens: 0,
}, null, 2)}\n`, "utf8");
await rm(outputRoot, { recursive: true, force: true });
console.log(JSON.stringify({ status: "PASS", rebased: candidates.length, deterministic: true, intentionalChangesOnly: true }, null, 2));
