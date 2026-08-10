import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createKakaoBizboardRenderer } from "../dist/core/index.js";

const root = process.cwd();
const ids = ["N2-REP-001", "N2-REP-002", "N2-REP-003", "N2-REP-004", "N2-REP-005", "N2-REP-006"];
const goldenRoot = path.join(root, "fixtures", "golden", "naver-smartchannel");
const outputRoot = path.join(root, ".tmp-n2-golden-output");
await mkdir(goldenRoot, { recursive: true });
await mkdir(outputRoot, { recursive: true });
const renderer = await createKakaoBizboardRenderer({ projectRoot: root, inputRoot: root, outputRoot });
const entries = [];
for (const id of ids) {
  const input = JSON.parse(await readFile(path.join(root, "fixtures", "valid", "naver-smartchannel", `${id}.input.json`), "utf8"));
  const runs = [];
  let last;
  for (let run = 0; run < 3; run += 1) {
    last = await renderer.render(input);
    if (last.status !== "PASS" || !last.pngPath || !last.pngDigest) throw new Error(`${id} failed: ${JSON.stringify(last.errors)}`);
    runs.push(last.pngDigest);
  }
  if (new Set(runs).size !== 1) throw new Error(`${id} is not deterministic: ${runs.join(",")}`);
  const goldenPath = path.join(goldenRoot, `${id}.png`);
  await copyFile(last.pngPath, goldenPath);
  const manifestBytes = await readFile(last.manifestPath);
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  const report = manifest.smartChannelReport;
  const goldenManifestPath = path.join(goldenRoot, `${id}.manifest.json`);
  await writeFile(goldenManifestPath, manifestBytes);
  entries.push({
    id,
    templateId: last.templateId,
    objectPlacementToken: last.objectPlacementToken,
    width: report.canvas.width,
    height: report.canvas.height,
    transparent: true,
    pngSha256: last.pngDigest,
    manifestSha256: last.manifestDigest,
    pixelFingerprint: last.pixelFingerprint,
    requestFingerprint: last.requestFingerprint,
    renderFingerprint: last.renderFingerprint,
    runDigests: runs,
    path: `fixtures/golden/naver-smartchannel/${id}.png`,
    manifestPath: `fixtures/golden/naver-smartchannel/${id}.manifest.json`,
  });
}
await writeFile(path.join(goldenRoot, "registry.json"), `${JSON.stringify({ registryVersion: "1.0.0", status: "FROZEN_REPRESENTATIVE_GOLDENS", candidates: entries }, null, 2)}\n`, "utf8");
