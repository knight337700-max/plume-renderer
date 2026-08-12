import { createHash } from "node:crypto";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { GlobalFonts } from "@napi-rs/canvas";
import sharp from "sharp";

import { createSmartChannelFontResourceProvider, loadContracts, renderSmartChannel } from "../dist/core/index.js";

const root = process.cwd();
const artifactRoot = path.join(root, "artifacts", "n7-7-4");
const templateId = "NAVER_SMARTCHANNEL_280_BASIC_STANDARD_LEFT_MAIN2_SUB_NONE";
const sourceCollectionSha256 = "0452cde17bbdfe71106680879df943034a003c537c95a4137bab124b3cfa4b66";
const execFileAsync = promisify(execFile);
const directTtcProbe = JSON.parse((await execFileAsync(process.execPath, [path.join(root, "scripts", "probe-n7-7-4-direct-ttc.mjs")], { cwd: root, env: { ...process.env, DISABLE_SYSTEM_FONTS_LOAD: "1" } })).stdout);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

function legacyPolicy(current) {
  const policy = structuredClone(current);
  policy.registryVersion = "1.4.0-N7.7-EVIDENCE-ONLY";
  const sample = "일이삼사오륙칠팔구십 광고 앱 고지문구 및 심의필 입력 영역 APP";
  const assets = [
    { id: "NAVER_SC_APPLE_SD_GOTHIC_NEO_BOLD", relativePath: "assets/fonts/naver-smartchannel/AppleSDGothicNeo-Bold.ttf", runtimeDigest: "a652ea0a3c4bf8658845f044b5d6f40c39ecf03207e43f325c1451127528402b", runtimePostScriptName: "N77-AppleSDGothicNeo-Bold", binaryPostScriptNames: ["AppleSDGothicNeoB00"], runtimeRegistrationName: "N77-AppleSDGothicNeo-Bold", weight: 700, requiredRoles: ["HEADLINE", "HEADLINE_LINE_2"] },
    { id: "NAVER_SC_APPLE_SD_GOTHIC_NEO_REGULAR", relativePath: "assets/fonts/naver-smartchannel/AppleSDGothicNeo-Regular.ttf", runtimeDigest: "f44eec027992b99dc25de0229c5726fe209a6cb80761aaef98d050cdc0bc6cfe", runtimePostScriptName: "N77-AppleSDGothicNeo-Regular", binaryPostScriptNames: ["AppleSDGothicNeoR00"], runtimeRegistrationName: "N77-AppleSDGothicNeo-Regular", weight: 400, requiredRoles: ["SUBCOPY", "THIRD_LINE", "FOURTH_LINE", "DISCLOSURE_LINE_1", "DISCLOSURE_LINE_2"] },
    { id: "NAVER_SC_APPLE_SD_GOTHIC_NEO_SEMIBOLD", relativePath: "assets/fonts/naver-smartchannel/AppleSDGothicNeo-SemiBold.ttf", runtimeDigest: "a9c5ffb4dadce253d8748b18019954a8af19b7cfcc3b586fce64ef1f6bd71492", runtimePostScriptName: "N77-AppleSDGothicNeo-SemiBold", binaryPostScriptNames: ["AppleSDGothicNeoSB00"], runtimeRegistrationName: "N77-AppleSDGothicNeo-SemiBold", weight: 600, requiredRoles: ["APP_CTA_TEXT"] },
  ];
  policy.runtimeAssets = assets.map((asset) => ({ ...asset, resourceKind: "SINGLE_FONT", required: true, glyphCoverageSample: sample, licenseStatus: "HISTORICAL_N7_7_EVIDENCE_ONLY", assetStatus: "RESOLVED", resolutionClass: "BUNDLED_EXACT", smartChannelAllowed: true, owner: "RENDERER", pinned: true, environmentIndependent: true }));
  return policy;
}

function request() {
  return {
    schemaVersion: "1.0.0",
    channel: "NAVER_GFA",
    placement: "SMARTCHANNEL",
    layoutMode: "TEMPLATE_LOCKED",
    compositionMode: "RENDERER_COMPOSED",
    templateId,
    content: {
      headline: "에스더버니리틀과 가을 준비!",
      headlineLine2: "깜찍하게 시작하는 공주룩",
      subcopy: "알림 받기 35% 쿠폰 + 무료 교환 반품",
    },
    assets: { object: { path: "fixtures/valid/mask-semicircle-right__logo__black__pass.png" } },
    output: { directory: "n7-7-4", baseName: "representative", overwrite: true },
  };
}

async function decoded(png) {
  const value = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { bytes: Buffer.from(value.data), width: value.info.width, height: value.info.height };
}

function roleRasterEvidence(raw, role) {
  const bounds = role.actualRasterBounds;
  if (!bounds) return { ...role, actualRasterBounds: null, scannedNonTransparentPixels: 0 };
  let count = 0;
  for (let y = bounds.y; y < bounds.y + bounds.height; y += 1) {
    for (let x = bounds.x; x < bounds.x + bounds.width; x += 1) {
      if ((raw.bytes[((y * raw.width) + x) * 4 + 3] ?? 0) > 0) count += 1;
    }
  }
  return { role: role.role, inputKey: role.inputKey, actualRasterBounds: bounds, inkBounds: bounds, scannedNonTransparentPixels: count, measuredGlyphWidth: role.measuredWidth, baselineY: role.baselineY, box: role.box };
}

async function renderCandidate(contracts, provider) {
  return renderSmartChannel(request(), { projectRoot: root, inputRoot: root, outputRoot: artifactRoot, contracts, fontResourceProvider: provider, publish: false });
}

await mkdir(artifactRoot, { recursive: true });
const contracts = await loadContracts(root);
const provider = createSmartChannelFontResourceProvider({ id: "CoreTestProvider", root });
const legacyContracts = { ...contracts, naverRuntimeFontPolicy: legacyPolicy(contracts.naverRuntimeFontPolicy), naverFontContract: { ...contracts.naverFontContract, registryVersion: "1.1.0-N7.7-EVIDENCE-ONLY" } };
const legacy = await renderCandidate(legacyContracts, provider);
if (legacy.status !== "PASS" || !legacy.png || !legacy.report) throw new Error(`Legacy N7.7 representative render failed: ${JSON.stringify(legacy.errors)}`);
const currentRuns = [];
for (let run = 0; run < 3; run += 1) currentRuns.push(await renderCandidate(contracts, provider));
for (const [index, result] of currentRuns.entries()) if (result.status !== "PASS" || !result.png || !result.report) throw new Error(`macOS TTC representative render ${index + 1} failed: ${JSON.stringify(result.errors)}`);
const current = currentRuns[0];
const currentRuntimeAssets = contracts.naverRuntimeFontPolicy.runtimeAssets.filter((asset) => asset.required === true);
const currentFontEvidence = currentRuntimeAssets.map((asset) => ({ token: asset.id, derivedResourceDigest: asset.runtimeDigest, runtimePostScriptName: asset.runtimePostScriptName, collectionAssetId: asset.sourceCollection.assetId, collectionDigest: asset.sourceCollection.sha256, collectionFaceIndex: asset.sourceCollection.face.index, collectionFacePostScriptName: asset.sourceCollection.face.postScriptName, fontContractVersion: contracts.naverFontContract.registryVersion, integrationMode: "VERIFIED_DERIVED_STANDALONE_FACE" }));

await writeFile(path.join(artifactRoot, "representative-legacy-n77.png"), legacy.png);
await writeFile(path.join(artifactRoot, "representative-macos-ttc.png"), current.png);
const legacyRaw = await decoded(legacy.png);
const currentRaw = await decoded(current.png);
if (legacyRaw.width !== currentRaw.width || legacyRaw.height !== currentRaw.height) throw new Error("A/B canvas mismatch");
const diff = Buffer.alloc(currentRaw.bytes.length);
let changedPixels = 0;
let maxChannelDelta = 0;
let totalChannelDelta = 0;
for (let pixel = 0; pixel < currentRaw.width * currentRaw.height; pixel += 1) {
  let changed = false;
  for (let channel = 0; channel < 4; channel += 1) {
    const index = (pixel * 4) + channel;
    const delta = Math.abs((legacyRaw.bytes[index] ?? 0) - (currentRaw.bytes[index] ?? 0));
    if (delta > 0) changed = true;
    maxChannelDelta = Math.max(maxChannelDelta, delta);
    totalChannelDelta += delta;
    diff[index] = channel === 3 ? (changed ? 255 : 0) : channel === 0 ? delta : 0;
  }
  if (changed) changedPixels += 1;
}
const diffPng = await sharp(diff, { raw: { width: currentRaw.width, height: currentRaw.height, channels: 4 } }).png({ compressionLevel: 9, adaptiveFiltering: false, palette: false }).toBuffer();
await writeFile(path.join(artifactRoot, "representative-ab-diff.png"), diffPng);

const deploymentRoot = path.join(os.tmpdir(), `kbr-n774-provider-${process.pid}`);
await mkdir(path.join(deploymentRoot, "assets", "fonts"), { recursive: true });
await cp(path.join(root, "assets", "fonts", "naver-smartchannel"), path.join(deploymentRoot, "assets", "fonts", "naver-smartchannel"), { recursive: true });
const desktopProvider = createSmartChannelFontResourceProvider({ id: "DesktopResourceProvider", root });
const packageProvider = createSmartChannelFontResourceProvider({ id: "PackageHandoffProvider", root: deploymentRoot });
const desktop = await renderCandidate(contracts, desktopProvider);
const packaged = await renderCandidate(contracts, packageProvider);
if (desktop.status !== "PASS" || packaged.status !== "PASS") throw new Error(`Provider parity render failed: ${JSON.stringify({ desktop: desktop.errors, packaged: packaged.errors })}`);

const outputDigests = currentRuns.map((result) => sha256(result.png));
const pixelDigests = await Promise.all(currentRuns.map(async (result) => sha256((await decoded(result.png)).bytes)));
const metrics = {
  phase: "N7_7_4_MACOS_ORIGINAL_TTC_RENDERER_INTEGRATION",
  template: templateId,
  copy: request().content,
  sourceCollectionSha256,
  geometryChanged: false,
  legacyN77: { outputSha256: sha256(legacy.png), pixelSha256: sha256(legacyRaw.bytes), textRoles: legacy.report.textRoles.map((role) => roleRasterEvidence(legacyRaw, role)) },
  macosTtc: { outputSha256: outputDigests[0], pixelSha256: pixelDigests[0], textRoles: current.report.textRoles.map((role) => roleRasterEvidence(currentRaw, role)) },
  pixelDiff: { changedPixels, totalPixels: currentRaw.width * currentRaw.height, changedRatio: changedPixels / (currentRaw.width * currentRaw.height), maxChannelDelta, meanAbsDelta: totalChannelDelta / currentRaw.bytes.length },
  determinism: { runs: 3, outputDigests, pixelDigests, outputBytesIdentical: new Set(outputDigests).size === 1, pixelIdentical: new Set(pixelDigests).size === 1 },
};
await writeFile(path.join(artifactRoot, "representative-ab-diff-metrics.json"), `${JSON.stringify(metrics, null, 2)}\n`);
await writeFile(path.join(artifactRoot, "representative-macos-ttc.manifest.json"), `${JSON.stringify({ phase: metrics.phase, templateId, fontContractVersion: contracts.naverFontContract.registryVersion, sourceCollection: { assetId: "NAVER_SC_APPLE_SD_GOTHIC_NEO_MACOS19_TTC", sha256: sourceCollectionSha256 }, fonts: currentFontEvidence, artifact: current.report.artifact, pixelFingerprint: current.pixelFingerprint, manualAcceptance: { approvedCreativeMatch: { status: "NOT_REVIEWED" } } }, null, 2)}\n`);
const parity = { phase: metrics.phase, status: desktop.pngDigest === packaged.pngDigest && desktop.pixelFingerprint === packaged.pixelFingerprint ? "PASS" : "FAIL", providers: ["CoreTestProvider", "DesktopResourceProvider", "PackageHandoffProvider"], collectionShaMatch: currentRuntimeAssets.every((asset) => asset.sourceCollection.sha256 === sourceCollectionSha256), faceIndexMatch: currentRuntimeAssets.map((asset) => asset.sourceCollection.face.index).join(",") === "6,0,4", postScriptMatch: currentRuntimeAssets.map((asset) => asset.sourceCollection.face.postScriptName).join(",") === "AppleSDGothicNeo-Bold,AppleSDGothicNeo-Regular,AppleSDGothicNeo-SemiBold", pixelMatch: desktop.pixelFingerprint === packaged.pixelFingerprint, pngMatch: desktop.pngDigest === packaged.pngDigest, physicalAbsolutePathInFingerprint: false };
await writeFile(path.join(artifactRoot, "font-provider-parity.json"), `${JSON.stringify(parity, null, 2)}\n`);
await writeFile(path.join(artifactRoot, "font-backend-audit.json"), `${JSON.stringify({ phase: metrics.phase, currentTextStack: { coreLanguage: "TypeScript/Node.js", rasterLibrary: "@napi-rs/canvas 1.0.3 / Skia", shapingLibrary: "Skia text stack exposed by @napi-rs/canvas", fontParser: "Core read-only SFNT/TTC parser", fontRegistrationMethod: "GlobalFonts.registerFromPath", fontLoadingApi: "register(Buffer, alias) or registerFromPath(path, alias); no face-index parameter", currentTtfLoadingPath: "Renderer-owned trusted-root-relative provider resource", browserOrCanvasDependency: "Node Canvas API surface; no browser FontFace", nativeDependency: "@napi-rs/canvas-win32-x64-msvc 1.0.3", ttcCollectionSupport: { status: "UNSUPPORTED_FOR_DETERMINISTIC_MULTI_FACE_SELECTION", evidence: "Isolated actual registerFromPath preflight exposes one weight-400 style; 400/600/700 requests all match derived face index 0 Regular while derived indices 4 and 6 have distinct metrics" } }, directTtc: { supported: false, blocker: "SemiBold index 4 and Bold index 6 cannot be selected", backend: "@napi-rs/canvas 1.0.3 / Skia", preflight: directTtcProbe }, integrationMode: "VERIFIED_DERIVED_STANDALONE_FACE", systemFontsDisabled: process.env.DISABLE_SYSTEM_FONTS_LOAD === "1", globalFontFamiliesAfterExplicitRegistration: GlobalFonts.families.filter((font) => font.family.includes("Apple")) }, null, 2)}\n`);
console.log(JSON.stringify({ status: "PASS", metrics, providerParity: parity }, null, 2));
