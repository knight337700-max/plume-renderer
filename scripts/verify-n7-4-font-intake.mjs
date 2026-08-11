import { createHash } from "node:crypto";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { copyFile, mkdir, readFile, rm } from "node:fs/promises";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

import { loadContracts, renderSmartChannel } from "../dist/core/index.js";

const root = process.cwd();
const desktopRoot = "C:/Users/Lenovo/Desktop";
const logoRelativePath = "kakao/TEST_SOURCE/자코모 로고_블랙-ai.png";
const acceptanceContract = JSON.parse(await readFile(path.join(root, "contracts/naver-smartchannel-actual-asset-acceptance.json"), "utf8"));
const sofaEvidence = acceptanceContract.assets.sofa;
const logoEvidence = acceptanceContract.assets.logo;
const sofaPath = process.env.NAVER_SMARTCHANNEL_ACTUAL_SOFA_PATH ?? sofaEvidence.sourcePath;
const tempRoot = path.join(root, ".tmp-n7-4-font-intake");
const execFileAsync = promisify(execFile);
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function alphaBounds(filePath) {
  const sourceBytes = await readFile(filePath);
  const raw = await sharp(filePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = raw.info.width;
  let minY = raw.info.height;
  let maxX = -1;
  let maxY = -1;
  let count = 0;
  for (let y = 0; y < raw.info.height; y += 1) {
    for (let x = 0; x < raw.info.width; x += 1) {
      const alpha = raw.data[(y * raw.info.width + x) * 4 + 3] ?? 0;
      if (alpha < 1) continue;
      count += 1;
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
  }
  return { sha256: digest(sourceBytes), sourceCanvas: { width: raw.info.width, height: raw.info.height }, alphaBounds: maxX < minX ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }, alphaPixelCount: count };
}

function assertEqual(label, actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${label} mismatch: expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`);
}

async function renderActual(filePath, baseName, expectedSource, evidence) {
  const contracts = await loadContracts(root);
  const inputRoot = path.join(tempRoot, `${baseName}-input`);
  const relativePath = evidence.renderRequest.objectRelativePath ?? path.basename(filePath);
  await mkdir(inputRoot, { recursive: true });
  await copyFile(filePath, path.join(inputRoot, relativePath));
  const request = {
    schemaVersion: "1.0.0",
    channel: "NAVER_GFA",
    placement: "SMARTCHANNEL",
    layoutMode: "TEMPLATE_LOCKED",
    compositionMode: "RENDERER_COMPOSED",
    artifactCardinality: "SINGLE",
    templateId: evidence.renderRequest.templateId,
    content: evidence.renderRequest.content,
    assets: { object: { path: relativePath, expectedSha256: expectedSource.sha256 } },
    output: { directory: ".", baseName: evidence.renderRequest.jobName ?? baseName, overwrite: false },
  };
  const options = { projectRoot: root, inputRoot, outputRoot: tempRoot, contracts };
  const preview = await renderSmartChannel(request, { ...options, publish: false });
  if (preview.status !== "PASS" || preview.report?.object === undefined) throw new Error(`${baseName} preview failed: ${JSON.stringify(preview.errors)}`);
  const object = preview.report.object;
  const forbidden = ["NAVER_SMARTCHANNEL_ASSET_DIMENSION_MISMATCH", "NAVER_SMARTCHANNEL_OBJECT_OUT_OF_REGION", "NAVER_SMARTCHANNEL_OBJECT_OPAQUE_PIXEL_LIMIT"];
  if (preview.errors.some((entry) => forbidden.includes(entry.code))) throw new Error(`${baseName} forbidden validation error: ${JSON.stringify(preview.errors)}`);
  if (preview.errors.length !== evidence.validatorResult.errorCount || preview.warnings.length !== evidence.validatorResult.warningCount) throw new Error(`${baseName} validator result mismatch`);
  if (expectedSource.sha256 !== evidence.sourceDigest) throw new Error(`${baseName} source evidence digest mismatch`);
  assertEqual(`${baseName}.sourceCanvas`, object.sourceCanvas, evidence.sourceCanvas);
  assertEqual(`${baseName}.alphaBounds`, object.alphaBounds, evidence.alphaBounds);
  assertEqual(`${baseName}.normalizedSize`, { width: object.normalizedSize.width, height: object.normalizedSize.height }, evidence.normalizedSize);
  if (evidence.finalBounds) assertEqual(`${baseName}.finalBounds`, object.finalBounds, evidence.finalBounds);
  if (evidence.targetRegion) assertEqual(`${baseName}.targetRegion`, object.targetRegion, evidence.targetRegion);
  assertEqual(`${baseName}.opaquePixelCount`, object.opaquePixelCount, evidence.visibleAlphaPixels);
  const published = await renderSmartChannel(request, { ...options, publish: true });
  if (published.status !== "PASS" || !published.pngPath || !published.manifestPath || !published.pngDigest || !published.manifestDigest) throw new Error(`${baseName} export failed: ${JSON.stringify(published.errors)}`);
  if (published.errors.length !== evidence.validatorResult.errorCount || published.warnings.length !== evidence.validatorResult.warningCount) throw new Error(`${baseName} export validator result mismatch`);
  const pngBytes = await readFile(published.pngPath);
  const manifestBytes = await readFile(published.manifestPath);
  if (digest(pngBytes) !== published.pngDigest || digest(manifestBytes) !== published.manifestDigest) throw new Error(`${baseName} response digest mismatch`);
  const png = await sharp(pngBytes).metadata();
  if (png.format !== "png" || png.width !== 750 || png.height !== 160 || png.hasAlpha !== true) throw new Error(`${baseName} output PNG contract mismatch`);
  if (published.pngDigest !== evidence.outputPngDigest) throw new Error(`${baseName} output PNG evidence digest mismatch`);
  if ((evidence.pixelFingerprint && published.pixelFingerprint !== evidence.pixelFingerprint) || (evidence.renderFingerprint && published.renderFingerprint !== evidence.renderFingerprint)) throw new Error(`${baseName} pixel/render fingerprint evidence mismatch`);
  return { source: expectedSource, diagnostics: object, previewStatus: preview.status, exportStatus: published.status, pngDigest: published.pngDigest, manifestDigest: published.manifestDigest, pixelFingerprint: published.pixelFingerprint, renderFingerprint: published.renderFingerprint, requestFingerprint: published.requestFingerprint };
}

await rm(tempRoot, { recursive: true, force: true });
await mkdir(tempRoot, { recursive: true });
const logoAbsolute = path.join(desktopRoot, logoRelativePath);
const result = { phase: "N7_4_SMARTCHANNEL_ASSET_FONT_RUNTIME_HOTFIX", logo: null, sofa: null, status: "PASS", blockers: [] };
if (!fs.existsSync(logoAbsolute)) {
  result.status = "BLOCKED"; result.blockers.push(`ACTUAL_LOGO_NOT_FOUND:${logoAbsolute}`);
} else {
  const measured = await alphaBounds(logoAbsolute);
  result.logo = await renderActual(logoAbsolute, "actual-logo", measured, logoEvidence);
}

async function runPackagedFontSmoke(executable, filePath, evidence) {
  if (!fs.existsSync(executable)) return { status: "MISSING", executable };
  const token = randomUUID();
  const output = path.join(tempRoot, `packaged-${token}`);
  const resultPath = path.join(tempRoot, `packaged-${token}.json`);
  await mkdir(output, { recursive: true });
  await execFileAsync(executable, [`--smoke-n7-4=${token}`], {
    cwd: path.dirname(executable),
    env: {
      ...process.env,
      KBR_N7_4_OBJECT: filePath,
      KBR_N7_4_TEMPLATE_ID: evidence.renderRequest.templateId,
      KBR_N7_4_HEADLINE: evidence.renderRequest.content.headline,
      KBR_N7_4_SUBCOPY: evidence.renderRequest.content.subcopy ?? "",
      KBR_N7_4_JOB_NAME: evidence.renderRequest.jobName ?? "n7-4-packaged",
      KBR_N7_4_OUTPUT: output,
      KBR_N7_4_RESULT: resultPath,
    },
    windowsHide: true,
    timeout: 90000,
  });
  const packaged = JSON.parse(await readFile(resultPath, "utf8"));
  if (packaged.status !== "PASS") return packaged;
  if (packaged.pngDigest !== evidence.outputPngDigest || (evidence.pixelFingerprint && packaged.pixelFingerprint !== evidence.pixelFingerprint)) {
    throw new Error(`packaged evidence mismatch for ${path.basename(filePath)}`);
  }
  return packaged;
}

const unpackedExecutable = path.join(root, "release", "win-unpacked", "Kakao-Bizboard-Local-Renderer.exe");
const portableExecutable = path.join(root, "release", `Kakao-Bizboard-Local-Renderer-${JSON.parse(await readFile(path.join(root, "package.json"), "utf8")).version}-x64.exe`);
try {
  result.packaged = {
    logo: {
      unpacked: await runPackagedFontSmoke(unpackedExecutable, logoAbsolute, logoEvidence),
      portable: await runPackagedFontSmoke(portableExecutable, logoAbsolute, logoEvidence),
    },
    sofa: {
      unpacked: await runPackagedFontSmoke(unpackedExecutable, sofaPath, sofaEvidence),
      portable: await runPackagedFontSmoke(portableExecutable, sofaPath, sofaEvidence),
    },
  };
  if ([result.packaged.logo.unpacked, result.packaged.logo.portable, result.packaged.sofa.unpacked, result.packaged.sofa.portable].some((entry) => entry.status !== "PASS")) {
    result.status = "BLOCKED";
    result.blockers.push("PACKAGED_SMARTCHANNEL_FONT_SMOKE_FAILED");
  }
} catch (error) {
  result.status = "BLOCKED";
  result.blockers.push(`PACKAGED_SMARTCHANNEL_FONT_SMOKE_ERROR:${error instanceof Error ? error.message : String(error)}`);
}
if (!sofaPath || !fs.existsSync(sofaPath)) {
  result.status = "BLOCKED";
  result.blockers.push("ACTUAL_USER_SOFA_BINARY_NOT_FOUND");
} else {
  const measured = await alphaBounds(sofaPath);
  if (measured.sha256 !== sofaEvidence.sourceDigest) {
    result.status = "BLOCKED";
    result.blockers.push(`ACTUAL_USER_SOFA_DIGEST_MISMATCH:${measured.sha256}`);
  } else {
    result.sofa = await renderActual(sofaPath, "actual-sofa", measured, sofaEvidence);
  }
}
console.log(JSON.stringify(result, null, 2));
await rm(tempRoot, { recursive: true, force: true });
