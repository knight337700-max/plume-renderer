import { randomUUID } from "node:crypto";
import { access, readFile, readdir, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

import sharp from "sharp";

const root = process.cwd();
const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const expectedPngDigest = "20dc9d62b8650a72115a8d584846399d9cd6dd2c8a0996b4889edb596feb68b1";
const expectedThumbnailPngDigest = "f1111ee8f36fe1d8ccc7aaa445b175906e8a6432027d3e65764158ad40c52996";
const expectedMultiPngDigest = "ec3689f320a20bb242f649759228bae27cec1ea74fe9ff4f3fbcea0988f3cd55";
const expectedMaskPngDigest = "ad5448b368badcf1e5c304dadb8a93d3cbf4fab6f2e4d7d90334a44628d7d145";
const executables = [
  path.join(root, "release", "win-unpacked", "Kakao-Bizboard-Local-Renderer.exe"),
  path.join(root, "release", `Kakao-Bizboard-Local-Renderer-${packageJson.version}-x64.exe`),
];

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

async function waitForResult(resultPath, child, timeoutMs = 120_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await exists(resultPath)) return;
    if (child.exitCode !== null && child.exitCode !== 0) {
      throw new Error(`Packaged process exited with ${child.exitCode} before writing smoke result`);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  child.kill();
  throw new Error(`Timed out waiting for ${resultPath}`);
}

async function verifyRightMargin(pngPath) {
  const raw = await sharp(pngPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (raw.info.width !== 1029 || raw.info.height !== 258 || raw.info.channels !== 4) {
    throw new Error(`Unexpected PNG metadata: ${JSON.stringify(raw.info)}`);
  }
  for (let y = 0; y < 258; y += 1) {
    for (let x = 981; x < 1029; x += 1) {
      if (raw.data[(y * 1029 + x) * 4 + 3] !== 0) throw new Error("Right 48px margin is not transparent");
    }
  }
}

async function verifyPackagedCropUi() {
  const uiRoot = path.join(root, "release", "win-unpacked", "resources", "app", "dist-desktop", "renderer-ui", "assets");
  const assetNames = await readdir(uiRoot);
  const source = (await Promise.all(assetNames.filter((name) => /\.(?:js|css)$/u.test(name)).map((name) => readFile(path.join(uiRoot, name), "utf8")))).join("\n");
  if (source.includes("crop-nudge-row") || source.includes("crop-nudge-group") || source.includes("CROP_RECT_STEPS")) {
    throw new Error("Packaged Crop UI still contains removed custom adjustment controls");
  }
  if (!source.includes("ArrowUp") || (!source.includes('step:"any"') && !source.includes("step:`any`"))) {
    throw new Error("Packaged Crop UI keyboard/step=any contract is missing");
  }
}

await verifyPackagedCropUi();

const reports = [];
for (const executable of executables) {
  if (!(await exists(executable))) throw new Error(`Packaged executable is missing: ${executable}`);
  const token = randomUUID();
  const resultPath = path.join(os.tmpdir(), `kbr-package-smoke-${token}.json`);
  const child = spawn(executable, [`--smoke-test=${token}`], {
    cwd: path.dirname(executable),
    windowsHide: true,
    stdio: "ignore",
  });
  await waitForResult(resultPath, child);
  const result = JSON.parse(await readFile(resultPath, "utf8"));
  if (result.status !== "PASS") throw new Error(`Packaged smoke failed: ${JSON.stringify(result)}`);
  if (result.previewPngDigest !== expectedPngDigest || result.pngDigest !== expectedPngDigest) {
    throw new Error(`Packaged Golden mismatch: ${JSON.stringify(result)}`);
  }
  if (result.thumbnailPreviewPngDigest !== expectedThumbnailPngDigest || result.thumbnailPngDigest !== expectedThumbnailPngDigest) {
    throw new Error(`Packaged Thumbnail Golden mismatch: ${JSON.stringify(result)}`);
  }
  if (!result.decimalThumbnailPreviewPngDigest || result.decimalThumbnailPreviewPngDigest !== result.decimalThumbnailPngDigest || !result.decimalThumbnailManifestDigest || result.decimalThumbnailPngDigest === expectedThumbnailPngDigest) {
    throw new Error(`Packaged decimal Thumbnail mismatch: ${JSON.stringify(result)}`);
  }
  if (!result.keyboardBasePreviewPngDigest || !result.keyboardAdjustedPreviewPngDigest || result.keyboardBasePreviewPngDigest === result.keyboardAdjustedPreviewPngDigest || result.keyboardAdjustedPreviewPngDigest !== result.keyboardAdjustedPngDigest || !result.keyboardAdjustedManifestDigest) {
    throw new Error(`Packaged keyboard Crop adjustment mismatch: ${JSON.stringify(result)}`);
  }
  if (result.multiPreviewPngDigest !== expectedMultiPngDigest || result.multiPngDigest !== expectedMultiPngDigest || !result.multiManifestDigest) {
    throw new Error(`Packaged Thumbnail Multi Golden mismatch: ${JSON.stringify(result)}`);
  }
  if (result.maskPreviewPngDigest !== expectedMaskPngDigest || result.maskPngDigest !== expectedMaskPngDigest || !result.maskManifestDigest) {
    throw new Error(`Packaged MASK Golden mismatch: ${JSON.stringify(result)}`);
  }
  if (!Array.isArray(result.maskAppliedImagePlacements) || result.maskAppliedImagePlacements.length !== 2 || result.maskAppliedImagePlacements[0]?.imageSlotId !== "IMAGE_PRIMARY" || result.maskAppliedImagePlacements[1]?.imageSlotId !== "LOGO_PRIMARY") {
    throw new Error(`Packaged MASK placement contract mismatch: ${JSON.stringify(result)}`);
  }
  if (!result.jpegThumbnailPreviewPngDigest || result.jpegThumbnailPreviewPngDigest !== result.jpegThumbnailPngDigest || !result.jpegThumbnailManifestDigest) {
    throw new Error(`Packaged JPEG Thumbnail mismatch: ${JSON.stringify(result)}`);
  }
  if (result.jpegDetectedMimeType !== "image/jpeg" || result.jpegWidth < 1 || result.jpegHeight < 1) {
    throw new Error(`Packaged JPEG input support failed: ${JSON.stringify(result)}`);
  }
  if (result.blockedNetworkRequestCount !== 0) {
    throw new Error(`Packaged runtime attempted ${result.blockedNetworkRequestCount} network requests`);
  }
  await Promise.all([
    access(result.pngPath),
    access(result.manifestPath),
    access(result.thumbnailPngPath),
    access(result.thumbnailManifestPath),
    access(result.decimalThumbnailPngPath),
    access(result.decimalThumbnailManifestPath),
    access(result.keyboardAdjustedPngPath),
    access(result.keyboardAdjustedManifestPath),
    access(result.multiPngPath),
    access(result.multiManifestPath),
    access(result.maskPngPath),
    access(result.maskManifestPath),
    access(result.jpegThumbnailPngPath),
    access(result.jpegThumbnailManifestPath),
    verifyRightMargin(result.pngPath),
    verifyRightMargin(result.thumbnailPngPath),
    verifyRightMargin(result.decimalThumbnailPngPath),
    verifyRightMargin(result.keyboardAdjustedPngPath),
    verifyRightMargin(result.multiPngPath),
    verifyRightMargin(result.maskPngPath),
    verifyRightMargin(result.jpegThumbnailPngPath),
  ]);
  const report = {
    executable,
    executableBytes: (await stat(executable)).size,
    resultPath,
    ...result,
  };
  reports.push(report);
  process.stdout.write(`PASS packaged smoke: ${path.basename(executable)} ${result.pngDigest}\n`);
}

process.stdout.write(`${JSON.stringify({ status: "PASS", reports }, null, 2)}\n`);
