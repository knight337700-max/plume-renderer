import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import fs from "node:fs";
import { isDeepStrictEqual } from "node:util";
import sharp from "sharp";

const root = process.cwd();
const contractPath = `${root}/contracts/naver-smartchannel-actual-asset-acceptance.json`;
const contract = JSON.parse(await readFile(contractPath, "utf8"));
const sofa = contract.assets?.sofa;
const manifestPath = process.env.NAVER_SMARTCHANNEL_ACTUAL_SOFA_MANIFEST_PATH ?? sofa?.manifestPath;
const sourcePath = process.env.NAVER_SMARTCHANNEL_ACTUAL_SOFA_PATH ?? sofa?.sourcePath;

function fail(message) {
  throw new Error(message);
}

function equal(label, actual, expected) {
  if (!isDeepStrictEqual(actual, expected)) fail(`${label} mismatch: expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`);
}

if (contract.status !== "PASS") fail(`acceptance registry status is ${contract.status}`);
if (contract.acceptanceRule?.actualUserBinaryRequired !== true) fail("actual user binary requirement is not enabled");
if (contract.acceptanceRule?.exactSourceDimensionsRequired !== false) fail("exact source dimensions are still required");
if (contract.acceptanceRule?.sourceCanvasUsedAsLimit !== false) fail("source canvas is incorrectly used as a limit");
if (!Array.isArray(contract.acceptanceRule?.requiredPipeline) || contract.acceptanceRule.requiredPipeline.length !== 9) fail("required pipeline is incomplete");
if (!sourcePath || !fs.existsSync(sourcePath)) fail(`actual sofa source is missing: ${sourcePath}`);
if (!manifestPath || !fs.existsSync(manifestPath)) fail(`actual sofa manifest is missing: ${manifestPath}`);

const sourceBytes = await readFile(sourcePath);
const sourceDigest = createHash("sha256").update(sourceBytes).digest("hex");
if (sourceDigest !== sofa.sourceDigest) fail(`source digest mismatch: ${sourceDigest}`);
const sourceRaw = await sharp(sourcePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
equal("sourceCanvas", { width: sourceRaw.info.width, height: sourceRaw.info.height }, sofa.sourceCanvas);
let minX = sourceRaw.info.width;
let minY = sourceRaw.info.height;
let maxX = -1;
let maxY = -1;
for (let y = 0; y < sourceRaw.info.height; y += 1) {
  for (let x = 0; x < sourceRaw.info.width; x += 1) {
    if ((sourceRaw.data[(y * sourceRaw.info.width + x) * 4 + 3] ?? 0) < 1) continue;
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
}
equal("alphaBounds", { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }, sofa.alphaBounds);

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const report = manifest.smartChannelReport?.object;
if (!report) fail("actual sofa manifest has no SmartChannel object report");
if (manifest.templateId !== sofa.renderRequest.templateId) fail("templateId evidence mismatch");
if (manifest.outputPngDigest !== sofa.outputPngDigest) fail("output PNG digest evidence mismatch");
if (manifest.pixelFingerprint !== sofa.pixelFingerprint || manifest.renderFingerprint !== sofa.renderFingerprint || manifest.requestFingerprint !== sofa.requestFingerprint) fail("fingerprint evidence mismatch");
equal("manifest sourceDigest", report.sourceDigest, sofa.sourceDigest);
equal("manifest sourceCanvas", report.sourceCanvas, sofa.sourceCanvas);
equal("manifest alphaBounds", report.alphaBounds, sofa.alphaBounds);
equal("manifest normalizedSize", { width: report.normalizedSize.width, height: report.normalizedSize.height }, sofa.normalizedSize);
equal("manifest finalBounds", report.finalBounds, sofa.finalBounds);
equal("manifest targetRegion", report.targetRegion, sofa.targetRegion);
equal("manifest visibleAlphaPixels", report.opaquePixelCount, sofa.visibleAlphaPixels);
equal("manifest validatorResult", manifest.validatorResult, sofa.validatorResult);
if (manifest.manualAcceptanceStatus?.status !== "NOT_REVIEWED") fail("manual acceptance status must remain NOT_REVIEWED");
for (const [stage, status] of Object.entries(sofa.pipeline)) if (status !== "PASS") fail(`pipeline stage ${stage} is ${status}`);

console.log(JSON.stringify({
  status: "PASS",
  sourcePath,
  sourceDigest,
  sourceCanvas: sofa.sourceCanvas,
  alphaBounds: sofa.alphaBounds,
  normalizedSize: sofa.normalizedSize,
  finalBounds: sofa.finalBounds,
  targetRegion: sofa.targetRegion,
  visibleAlphaPixels: sofa.visibleAlphaPixels,
  validatorResult: sofa.validatorResult,
  outputPngDigest: manifest.outputPngDigest,
  pixelFingerprint: manifest.pixelFingerprint,
  requestFingerprint: manifest.requestFingerprint,
  manualAcceptanceStatus: manifest.manualAcceptanceStatus.status,
}));
