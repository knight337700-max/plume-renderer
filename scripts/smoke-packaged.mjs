import { randomUUID } from "node:crypto";
import { access, readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

import sharp from "sharp";

const root = process.cwd();
const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const expectedPngDigest = "20dc9d62b8650a72115a8d584846399d9cd6dd2c8a0996b4889edb596feb68b1";
const expectedThumbnailPngDigest = "f1111ee8f36fe1d8ccc7aaa445b175906e8a6432027d3e65764158ad40c52996";
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
    access(result.jpegThumbnailPngPath),
    access(result.jpegThumbnailManifestPath),
    verifyRightMargin(result.pngPath),
    verifyRightMargin(result.thumbnailPngPath),
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
