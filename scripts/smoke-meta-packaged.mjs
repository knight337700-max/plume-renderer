import { randomUUID } from "node:crypto";
import { access, readFile, readdir, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const root = process.cwd();
const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const executables = [
  path.join(root, "release", "win-unpacked", "Kakao-Bizboard-Local-Renderer.exe"),
  path.join(root, "release", `Kakao-Bizboard-Local-Renderer-${packageJson.version}-x64.exe`),
];

async function exists(filePath) {
  try { await access(filePath); return true; } catch { return false; }
}

async function verifyPackagedUi() {
  const uiRoot = path.join(root, "release", "win-unpacked", "resources", "app", "dist-desktop", "renderer-ui", "assets");
  const names = await readdir(uiRoot);
  const source = (await Promise.all(names.filter((name) => /\.(?:js|css)$/u.test(name)).map((name) => readFile(path.join(uiRoot, name), "utf8")))).join("\n");
  for (const marker of ["channel-meta", "META Static Renderer Lab", "meta-profile-select", "meta-output-mode", "META_STATIC_PLACEMENT_SET_V1", "meta-platform-copy"]) {
    if (!source.includes(marker)) throw new Error(`Packaged META UI marker missing: ${marker}`);
  }
}

async function waitForResult(resultPath, child, timeoutMs = 120_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await exists(resultPath)) return;
    if (child.exitCode !== null && child.exitCode !== 0) throw new Error(`Packaged META process exited with ${child.exitCode}`);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  child.kill();
  throw new Error(`Timed out waiting for ${resultPath}`);
}

await verifyPackagedUi();
const reports = [];
for (const executable of executables) {
  if (!(await exists(executable))) throw new Error(`Packaged executable is missing: ${executable}`);
  const token = randomUUID();
  const resultPath = path.join(os.tmpdir(), `kbr-m1-meta-${token}.json`);
  const child = spawn(executable, [`--smoke-m1-meta=${token}`], { cwd: path.dirname(executable), windowsHide: true, stdio: "ignore" });
  await waitForResult(resultPath, child);
  const result = JSON.parse(await readFile(resultPath, "utf8"));
  if (result.status !== "PASS") throw new Error(`Packaged META smoke failed: ${JSON.stringify(result)}`);
  if (result.runtimeNetworkRequests !== 0) throw new Error(`Packaged META runtime made ${result.runtimeNetworkRequests} network requests`);
  if (!Array.isArray(result.profiles) || result.profiles.length !== 3) throw new Error("Packaged META profile smoke count mismatch");
  const expectedProfiles = [
    ["META_STATIC_FEED_SQUARE", 1080, 1080, "PNG"],
    ["META_STATIC_FEED_PORTRAIT", 1080, 1350, "JPEG"],
    ["META_STATIC_VERTICAL_FULL", 1080, 1920, "PNG"],
  ];
  for (const [profileId, width, height, format] of expectedProfiles) {
    const entry = result.profiles.find((candidate) => candidate.profileId === profileId);
    if (!entry || entry.width !== width || entry.height !== height || entry.format !== format || !/^[a-f0-9]{64}$/u.test(entry.digest)) throw new Error(`Packaged META profile mismatch: ${profileId}`);
  }
  const collection = result.collection;
  if (!collection || JSON.stringify(collection.order) !== JSON.stringify(["META_STATIC_FEED_SQUARE", "META_STATIC_FEED_PORTRAIT", "META_STATIC_VERTICAL_FULL"]) || collection.artifactCount !== 3 || collection.manifestFileName !== "meta-placement-set-manifest.json" || collection.artifactFileNames.length !== 3 || !/^[a-f0-9]{64}$/u.test(collection.collectionFingerprint)) throw new Error(`Packaged META placement set mismatch: ${JSON.stringify(collection)}`);
  reports.push({ executable, executableBytes: (await stat(executable)).size, ...result });
  process.stdout.write(`PASS packaged META smoke: ${path.basename(executable)}\n`);
}
process.stdout.write(`${JSON.stringify({ status: "PASS", packageVersion: packageJson.version, runtimeNetworkRequests: 0, reports }, null, 2)}\n`);
