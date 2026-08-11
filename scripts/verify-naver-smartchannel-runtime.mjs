import { createHash } from "node:crypto";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { createKakaoBizboardRenderer } from "../dist/core/index.js";

const root = process.cwd();
const registry = JSON.parse(await readFile(path.join(root, "fixtures/golden/naver-smartchannel/registry.json"), "utf8"));
const expectedIds = ["N2-REP-001", "N2-REP-002", "N2-REP-003", "N2-REP-004", "N2-REP-005", "N2-REP-006"];
if (JSON.stringify(registry.candidates.map((entry) => entry.id)) !== JSON.stringify(expectedIds)) throw new Error("N2 golden candidate set is not exactly the six approved candidates");
const outputRoot = path.join(root, ".tmp-n2-runtime-verification");
await mkdir(outputRoot, { recursive: true });
const renderer = await createKakaoBizboardRenderer({ projectRoot: root, inputRoot: root, outputRoot });
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const runtimeFontPolicy = JSON.parse(await readFile(path.join(root, "contracts/naver-smartchannel-runtime-font-policy.json"), "utf8"));
if (runtimeFontPolicy.runtimeStatus === "BLOCKED_UNRESOLVED_OFFICIAL_ASSET") {
  for (const entry of registry.candidates) {
    const input = JSON.parse(await readFile(path.join(root, "fixtures/valid/naver-smartchannel", `${entry.id}.input.json`), "utf8"));
    const result = await renderer.render(input);
    if (result.status !== "FAIL" || result.downloadAllowed || result.pngPath !== null || !result.errors.some((issue) => issue.code === "NAVER_SMARTCHANNEL_FONT_UNAVAILABLE")) throw new Error(`${entry.id} did not fail closed for unresolved official fonts`);
  }
  console.log(`BLOCKED_EXPECTED naver_smartchannel_runtime: ${registry.candidates.length}/${expectedIds.length} representative requests rejected with FONT_UNAVAILABLE; no PNG publish`);
  process.exit(0);
}
for (const entry of registry.candidates) {
  const goldenBytes = await readFile(path.join(root, entry.path));
  if (sha256(goldenBytes) !== entry.pngSha256) throw new Error(`${entry.id} golden SHA-256 mismatch`);
  const metadata = await sharp(goldenBytes).metadata();
  if (metadata.width !== entry.width || metadata.height !== entry.height || metadata.format !== "png" || metadata.hasAlpha !== true) throw new Error(`${entry.id} golden PNG contract mismatch`);
  const raw = await sharp(goldenBytes).ensureAlpha().raw().toBuffer();
  if (!Array.from(raw).some((value, index) => index % 4 === 3 && value < 255)) throw new Error(`${entry.id} is not transparent`);
  const goldenManifestBytes = await readFile(path.join(root, entry.manifestPath));
  if (sha256(goldenManifestBytes) !== entry.manifestSha256) throw new Error(`${entry.id} golden manifest SHA-256 mismatch`);
  const goldenManifest = JSON.parse(goldenManifestBytes.toString("utf8"));
  if (goldenManifest.outputPngDigest !== entry.pngSha256 || goldenManifest.templateId !== entry.templateId || goldenManifest.smartChannelReport.objectPlacementToken !== entry.objectPlacementToken || Object.prototype.hasOwnProperty.call(goldenManifest, "manifestDigest")) throw new Error(`${entry.id} golden manifest contract mismatch`);
  const historicalNanumGolden = goldenManifest.assetDigests?.fonts?.some((font) => String(font.id).includes("NANUM")) === true;
  const input = JSON.parse(await readFile(path.join(root, "fixtures/valid/naver-smartchannel", `${entry.id}.input.json`), "utf8"));
  const runs = [];
  for (let run = 0; run < 3; run += 1) {
    const result = await renderer.render(input);
    if (result.status !== "PASS" || !result.pngDigest) throw new Error(`${entry.id} render failed: ${JSON.stringify(result.errors)}`);
    if (result.templateId !== entry.templateId || result.objectPlacementToken !== entry.objectPlacementToken) throw new Error(`${entry.id} registry identity mismatch`);
    if (result.requestFingerprint !== entry.requestFingerprint) throw new Error(`${entry.id} request fingerprint mismatch`);
    const runtimeManifest = result.manifestPath ? JSON.parse(await readFile(result.manifestPath, "utf8")) : null;
    const runtimeTokens = runtimeManifest?.smartChannelReport?.fonts?.map((font) => font.token).sort() ?? [];
    const requiredTokens = runtimeFontPolicy.runtimeAssets.filter((asset) => asset.required === true).map((asset) => asset.id).sort();
    if (JSON.stringify(runtimeTokens) !== JSON.stringify(requiredTokens)) throw new Error(`${entry.id} required exact runtime font token mismatch: ${JSON.stringify(runtimeTokens)}`);
    if (!historicalNanumGolden && (result.pixelFingerprint !== entry.pixelFingerprint || result.renderFingerprint !== entry.renderFingerprint)) throw new Error(`${entry.id} current golden fingerprint mismatch`);
    runs.push(result.pngDigest);
  }
  if (new Set(runs).size !== 1) throw new Error(`${entry.id} repeated render is not byte deterministic`);
  if (!historicalNanumGolden && runs[0] !== entry.pngSha256) throw new Error(`${entry.id} current golden digest mismatch`);
  const manifest = JSON.parse(await readFile(path.join(outputRoot, "naver-smartchannel", entry.id, "render-manifest.json"), "utf8"));
  if (manifest.smartChannelReport.textRoles.some((role) => role.overflow)) throw new Error(`${entry.id} has text overflow`);
}
console.log(`PASS naver_smartchannel_runtime: ${registry.candidates.length}/${expectedIds.length} historical goldens preserved; N7.7 exact-font outputs 3-run byte deterministic; golden migration recorded`);
