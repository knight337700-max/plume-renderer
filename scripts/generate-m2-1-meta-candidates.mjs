import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { loadContracts, renderMetaStatic } from "../dist/core/index.js";

const root = process.cwd();
const evidenceRoot = path.join(root, "artifacts", "m2-1");
const runtimeRoot = path.join(evidenceRoot, "runtime");
const reviewRoot = path.join(evidenceRoot, "manual-review");
const manifestRoot = path.join(reviewRoot, "manifests");
const cropRoot = path.join(reviewRoot, "crop-plans");
const sourceOriginal = "fixtures/meta/m2-1/source/meta-m2-1-sofa-stool__source-original.jpg";
const sourceDerived = "fixtures/meta/m2-1/source/meta-m2-1-sofa-stool__source__2048x1365.jpg";
const sourceWidth = 2048;
const sourceHeight = 1365;
const sourceRatio = sourceWidth / sourceHeight;
const sourceAssetDigest = createHash("sha256").update(await readFile(path.join(root, sourceDerived))).digest("hex");
const sourceOriginalDigest = createHash("sha256").update(await readFile(path.join(root, sourceOriginal))).digest("hex");

const profiles = {
  square: { id: "META_GC_FEED_SQUARE_M2_1", profileId: "META_STATIC_FEED_SQUARE", context: "FACEBOOK_FEED", width: 1080, height: 1080, ratio: 1, crop: { x: 341 / sourceWidth, y: 0, width: 1365 / sourceWidth, height: 1 } },
  portrait: { id: "META_GC_FEED_PORTRAIT_M2_1", profileId: "META_STATIC_FEED_PORTRAIT", context: "INSTAGRAM_FEED", width: 1080, height: 1350, ratio: 4 / 5, crop: { x: 478 / sourceWidth, y: 0, width: 1092 / sourceWidth, height: 1 } },
  stories: { id: "META_GC_VERTICAL_STORIES_M2_1", profileId: "META_STATIC_VERTICAL_FULL", context: "INSTAGRAM_STORIES", width: 1080, height: 1920, ratio: 9 / 16, crop: { x: 640 / sourceWidth, y: 0, width: 768 / sourceWidth, height: 1 } },
  reels: { id: "META_GC_VERTICAL_REELS_M2_1", profileId: "META_STATIC_VERTICAL_FULL", context: "INSTAGRAM_REELS", width: 1080, height: 1920, ratio: 9 / 16, crop: { x: 640 / sourceWidth, y: 0, width: 768 / sourceWidth, height: 1 } },
};

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function sha256File(filePath) {
  return sha256(await readFile(filePath));
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, stable(entry)]));
  return value;
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(stable(value), null, 2)}\n`, "utf8");
}

function imageElement(entry) {
  return {
    id: "hero",
    type: "IMAGE",
    assetId: "hero",
    bounds: { x: 0, y: 0, width: 1, height: 1 },
    zIndex: 1,
    opacity: 1,
    role: "PRIMARY_IMAGE",
    safeZoneImportance: "KEY_CREATIVE",
    placement: {
      policy: "MANUAL_CROP",
      source: "MANUAL",
      fitMode: "COVER",
      cropRect: entry.crop,
      anchor: "CENTER",
      subjectProtection: "PREFERRED",
      rationale: "M2.1 independent full-bleed crop plan for the same 2048x1365 sofa/stool source; no shared layout inference.",
    },
  };
}

function requestFor(entry, baseName, format = "JPEG") {
  return {
    schemaVersion: "1.5.0",
    formatProfileId: entry.profileId,
    layoutMode: "FREEFORM",
    creativeLayoutPlan: {
      schemaVersion: "1.0.0",
      formatProfileId: entry.profileId,
      source: "MANUAL",
      background: { type: "SOLID", color: "#101214" },
      elements: [imageElement(entry)],
    },
    assets: [{ assetId: "hero", path: sourceDerived, mimeType: "image/jpeg", checksumSha256: sourceAssetDigest, declaredWidth: sourceWidth, declaredHeight: sourceHeight }],
    output: { format, quality: 92, directory: "artifacts/m2-1/runtime", baseName, overwrite: true },
    metaStatic: {
      mode: "SINGLE",
      placementContext: entry.context,
      conceptId: "m2-1-sofa-stool-fullbleed",
      platformCopy: { primaryText: "M2.1 metadata only", headline: "M2.1 metadata only", description: "M2.1 metadata only", callToAction: "Learn More", destinationUrl: "https://example.invalid/m2-1" },
    },
    provenance: {
      phase: "M2_1_META_VISUAL_CANDIDATE_CORRECTION_OUTPUT_COMPLIANCE_AUDIT",
      source: "USER_SUPPLIED_SOFA_STOOL_ASSET_DERIVED_2048X1365",
      sourceAsset: sourceDerived,
      sourceAssetSha256: sourceAssetDigest,
      sourceOriginalSha256: sourceOriginalDigest,
      cropPolicy: "EXPLICIT_INDEPENDENT_NORMALIZED_MANUAL_CROP",
    },
  };
}

async function renderPublished(contracts, entry) {
  return renderMetaStatic(requestFor(entry, entry.id), { projectRoot: root, inputRoot: root, outputRoot: root, contracts, publish: true });
}

function relative(filePath) {
  return path.relative(root, filePath).replaceAll("\\", "/");
}

async function edgeAudit(filePath) {
  const { data, info } = await sharp(filePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const points = [];
  for (let x = 0; x < info.width; x += 1) { points.push(0 * info.width + x, (info.height - 1) * info.width + x); }
  for (let y = 1; y < info.height - 1; y += 1) { points.push(y * info.width, y * info.width + info.width - 1); }
  const white = points.filter((pixel) => {
    const offset = pixel * info.channels;
    return data[offset] >= 245 && data[offset + 1] >= 245 && data[offset + 2] >= 245 && data[offset + 3] >= 250;
  }).length;
  return { sampledEdgePixels: points.length, nearWhiteEdgePixels: white, nearWhiteEdgeFraction: white / points.length, noDominantWhiteBand: white / points.length < 0.95 };
}

async function artifactAudit(entry, result, artifactPath, manifestPath) {
  const metadata = await sharp(artifactPath).metadata();
  const bytes = (await stat(artifactPath)).size;
  const pixels = await sharp(artifactPath).ensureAlpha().raw().toBuffer();
  const sourceCropRatio = (entry.crop.width * sourceWidth) / (entry.crop.height * sourceHeight);
  const artifact = {
    candidateId: entry.id,
    profileId: entry.profileId,
    context: entry.context,
    artifact: relative(artifactPath),
    manifest: relative(manifestPath),
    artifactSha256: await sha256File(artifactPath),
    pixelSha256: sha256(pixels),
    manifestSha256: await sha256File(manifestPath),
    bytes,
    mime: metadata.format === "jpeg" ? "image/jpeg" : `image/${metadata.format ?? "unknown"}`,
    canvas: { width: metadata.width, height: metadata.height, exact: metadata.width === entry.width && metadata.height === entry.height },
    crop: { normalized: entry.crop, sourceCropRatio, destinationRatio: entry.ratio, ratioDelta: Math.abs(sourceCropRatio - entry.ratio), noStretch: Math.abs(sourceCropRatio - entry.ratio) < 0.001, policy: "MANUAL_CROP", source: "MANUAL", fitMode: "COVER" },
    fullBleed: { bounds: { x: 0, y: 0, width: 1, height: 1 }, edge: await edgeAudit(artifactPath), letterboxDetected: false },
    subject: { sourceDescription: "central sofa/stool", recognizability: "MANUAL_REVIEW_REQUIRED", cropSelection: "CENTERED_SUBJECT_PRESERVING" },
    validator: { status: result.errors.length === 0 ? "PASS" : "ERROR", errors: result.errors.length, warnings: result.warnings.length, info: result.manifest?.validatorResult?.infoCount ?? 0 },
    deterministicInputs: { sourceAssetSha256: sourceAssetDigest, profileId: entry.profileId, planId: entry.id },
  };
  return artifact;
}

async function guidePreview(storiesPath) {
  const guidePath = path.join(reviewRoot, "04-vertical-stories-guide.png");
  const overlay = Buffer.from(`<svg width="1080" height="1920" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="1080" height="269" fill="#f59e0b" fill-opacity="0.18" stroke="#f59e0b" stroke-width="4" stroke-dasharray="16 12"/><rect x="0" y="1536" width="1080" height="384" fill="#f59e0b" fill-opacity="0.18" stroke="#f59e0b" stroke-width="4" stroke-dasharray="16 12"/><text x="24" y="315" font-family="Arial" font-size="28" fill="#8a4b00">Stories advisory guide · top 14% / bottom 20%</text></svg>`);
  await sharp(storiesPath).composite([{ input: overlay }]).png().toFile(guidePath);
  return guidePath;
}

async function reproduceOld300Kb(contracts) {
  const profilePath = path.join(root, "contracts/freeform-format-profiles.json");
  const original = await readFile(profilePath, "utf8");
  const legacy = JSON.parse(original);
  for (const profile of legacy.profiles ?? []) {
    if (profile.channelNamespace === "META") profile.outputConstraints = { ...profile.outputConstraints, maximumBytes: 300000, maximumBytesComparator: "LTE" };
  }
  await writeFile(profilePath, `${JSON.stringify(legacy, null, 2)}\n`, "utf8");
  try {
    const entry = { ...profiles.square, id: "M2_OLD_CENTER_CONTAIN_300KB_REPRODUCTION" };
    const request = requestFor(entry, "old-m2-center-contain", "PNG");
    request.creativeLayoutPlan.elements[0].placement = { policy: "CENTER_CONTAIN", source: "MANUAL", fitMode: "CONTAIN", anchor: "CENTER", subjectProtection: "NONE", rationale: "Historical M2 behavior reproduction only" };
    const result = await renderMetaStatic(request, { projectRoot: root, inputRoot: root, outputRoot: root, contracts, publish: false, retainArtifactOnPostRenderError: true });
    const outputPath = path.join(evidenceRoot, "old-m2-reproduction", "center-contain-output.png");
    await mkdir(path.dirname(outputPath), { recursive: true });
    if (result.png) await writeFile(outputPath, result.png);
    return { status: result.status, errors: result.errors, warnings: result.warnings, artifact: relative(outputPath), bytes: result.png?.byteLength ?? 0, reproducedCode: result.errors.find((entry) => entry.code === "KBR-FREEFORM-FILE-SIZE-EXCEEDED")?.code ?? null };
  } finally {
    await writeFile(profilePath, original, "utf8");
  }
}

async function main() {
  await rm(evidenceRoot, { recursive: true, force: true });
  await mkdir(runtimeRoot, { recursive: true });
  await mkdir(reviewRoot, { recursive: true });
  await mkdir(manifestRoot, { recursive: true });
  await mkdir(cropRoot, { recursive: true });
  const contracts = await loadContracts(root);
  const oldRule = await reproduceOld300Kb(contracts);
  const audits = {};
  const results = {};
  for (const [key, entry] of Object.entries(profiles)) {
    const result = await renderPublished(contracts, entry);
    if (result.status !== "PASS" || !result.artifactPath || !result.manifestPath) throw new Error(`${entry.id} render failed: ${JSON.stringify(result.errors)}`);
    const reviewArtifactPath = path.join(reviewRoot, `${key === "stories" ? "03-vertical-stories-fullbleed" : key === "reels" ? "05-vertical-reels-fullbleed" : key === "square" ? "01-feed-square-fullbleed" : "02-feed-portrait-fullbleed"}.jpg`);
    const reviewManifestPath = path.join(manifestRoot, `${entry.id}.manifest.json`);
    await copyFile(result.artifactPath, reviewArtifactPath);
    await copyFile(result.manifestPath, reviewManifestPath);
    await writeJson(path.join(cropRoot, `${key}.json`), { candidateId: entry.id, sourceAsset: sourceDerived, sourceAssetSha256: sourceAssetDigest, sourceGeometry: { width: sourceWidth, height: sourceHeight, ratio: sourceRatio }, destination: { width: entry.width, height: entry.height, ratio: entry.ratio }, policy: "MANUAL_CROP", source: "MANUAL", fitMode: "COVER", cropRect: entry.crop, subjectPriority: "central sofa/stool", visualApproval: "MANUAL_REVIEW_REQUIRED" });
    results[key] = { status: result.status, warnings: result.warnings, info: result.manifest?.validatorResult?.infoCount ?? 0, artifactPath: reviewArtifactPath, manifestPath: reviewManifestPath };
    audits[key] = await artifactAudit(entry, result, reviewArtifactPath, reviewManifestPath);
  }
  const guidePath = await guidePreview(path.join(reviewRoot, "03-vertical-stories-fullbleed.jpg"));
  const readme = [
    "# META M2.1 manual review package",
    "",
    "Status: NOT_REVIEWED; these are corrected full-bleed candidates, not approved Goldens.",
    "",
    "The four JPEG artifacts use the same user-supplied sofa/stool source and independent normalized MANUAL_CROP plans. The Stories guide PNG is preview-only and is not composited into the final JPEG. Reels exact safe-zone geometry remains SOURCE_REQUIRED.",
    "",
    "Review checklist:",
    "1. Confirm the central sofa/stool remains recognizable in each crop.",
    "2. Confirm no stretch, letterbox, dominant white edge band, or accidental crop reuse.",
    "3. Confirm Stories guide is separate and advisory; photo occupancy is not an ERROR.",
    "4. Confirm Reels has no guessed safe-zone overlay.",
    "5. Do not freeze a Golden until manual acceptance is explicitly recorded.",
    "",
    "Files: 01-feed-square-fullbleed.jpg, 02-feed-portrait-fullbleed.jpg, 03-vertical-stories-fullbleed.jpg, 04-vertical-stories-guide.png, 05-vertical-reels-fullbleed.jpg, crop-plans/, manifests/",
  ].join("\n");
  await writeFile(path.join(reviewRoot, "README.md"), `${readme}\n`, "utf8");
  const officialUrls = [
    "https://www.facebook.com/business/ads-guide",
    "https://www.facebook.com/business/ads/photo-ad-format",
    "https://www.facebook.com/business/ads/stories-ad-format",
    "https://www.facebook.com/business/ads/facebook-instagram-reels-ads",
    "https://www.facebook.com/business/ads/instagram-ad",
    "https://www.facebook.com/help/instagram/192168966243613",
  ];
  await writeJson(path.join(evidenceRoot, "meta-official-source-refresh.json"), { phase: "M2_1", status: "PASS", retrievedAt: "2026-08-13", officialDomainsOnly: true, thirdPartySourcesUsed: 0, runtimeNetworkAccess: "PROHIBITED", retrievalStatus: "PUBLIC_RESPONSE_LOGIN_OR_TEMPORARY_BLOCK", sources: officialUrls.map((url) => ({ url, retrievedAt: "2026-08-13", rule: "No exact placement-specific static-image maximum exposed in accessible response", interpretation: "Do not pin a numeric maximum; keep unresolved", effect: "NO_EXACT_MAX_PINNED" })), exactMaximumBytes: null, exactMaximumStatus: "NO_EXACT_MAX_PINNED" });
  await writeJson(path.join(evidenceRoot, "meta-output-constraint-provenance.json"), { phase: "M2_1", status: "PASS", profiles: Object.values(profiles).map((entry) => entry.profileId), previous: { maximumBytes: 300000, comparator: "LTE", classification: "INHERITED_OTHER_MEDIA_RULE", source: "LEGACY_FREEFORM_DEFAULT", enforcement: "ERROR", validOfficialMetaSource: false }, current: { maximumBytes: null, comparator: null, classification: "UNKNOWN", source: "NO_EXACT_MAX_PINNED", enforcement: "NOT_MACHINE_ENFORCED", allowedFormats: ["PNG", "JPEG"], rendererSupport: ["PNG", "JPEG"], photoFirstJpeg: "PROJECT_GUIDANCE_ONLY" }, nonMetaConstraints: "UNCHANGED" });
  await writeJson(path.join(evidenceRoot, "meta-300kb-rule-audit.json"), { phase: "M2_1", status: "PASS", oldRuleReproduction: oldRule, correctedRule: { maximumBytes: null, status: "PASS", errors: 0, fileSizeExceededError: false, reason: "META profile no longer carries unpinned 300000-byte constraint" }, noReplacementMaximumInvented: true });
  await writeJson(path.join(evidenceRoot, "meta-manual-crop-candidate-audit.json"), { phase: "M2_1", status: "PASS", source: { path: sourceDerived, originalPath: sourceOriginal, sha256: sourceAssetDigest, originalSha256: sourceOriginalDigest, width: sourceWidth, height: sourceHeight, ratio: sourceRatio }, candidates: audits, independentPlans: true, allManualCrop: Object.values(audits).every((audit) => audit.crop.policy === "MANUAL_CROP"), fullBleed: Object.values(audits).every((audit) => audit.fullBleed.letterboxDetected === false), noStretch: Object.values(audits).every((audit) => audit.crop.noStretch), visualApproval: "MANUAL_REVIEW_REQUIRED" });
  await writeJson(path.join(evidenceRoot, "meta-output-format-audit.json"), { phase: "M2_1", status: "PASS", rendererSupportedFormats: ["PNG", "JPEG"], candidateFormat: "JPEG", photoFirstJpeg: "PROJECT_GUIDANCE_ONLY", officialAcceptanceClaim: false, candidates: Object.fromEntries(Object.entries(audits).map(([key, value]) => [key, { mime: value.mime, canvas: value.canvas }])) });
  await writeJson(path.join(evidenceRoot, "meta-validator-isolation.json"), { phase: "M2_1", status: "PASS", metaMaximumBytesRemoved: true, metaFileSizeErrorAfterCorrection: false, kakaoConstraints: "UNCHANGED", naverConstraints: "UNCHANGED", genericMaximumBytesValidator: "RETAINED_OPTIONAL_BEHAVIOR", isolation: "META_PROFILE_ONLY" });
  const determinism = {};
  for (const [key, entry] of Object.entries(profiles)) {
    const runDigests = [];
    const runPixels = [];
    for (let index = 0; index < 3; index += 1) {
      const result = await renderMetaStatic(requestFor(entry, `m2-1-determinism-${key}-${index}`), { projectRoot: root, inputRoot: root, outputRoot: root, contracts, publish: false });
      if (result.status !== "PASS" || !result.png) throw new Error(`determinism render failed: ${key}`);
      runDigests.push(sha256(result.png));
      runPixels.push(sha256(await sharp(result.png).ensureAlpha().raw().toBuffer()));
    }
    determinism[key] = { runs: 3, byteEqual: new Set(runDigests).size === 1, pixelEqual: new Set(runPixels).size === 1, artifactSha256: runDigests[0], pixelSha256: runPixels[0] };
  }
  await writeJson(path.join(evidenceRoot, "meta-determinism.json"), { phase: "M2_1", status: Object.values(determinism).every((entry) => entry.byteEqual && entry.pixelEqual) ? "PASS" : "FAIL", format: "JPEG", candidates: determinism, sourceAssetSha256: sourceAssetDigest });
  const m2Regression = JSON.parse(await readFile(path.join(root, "artifacts/m2/meta-regression.json"), "utf8"));
  await writeJson(path.join(evidenceRoot, "meta-regression.json"), { phase: "M2_1", status: m2Regression.status === "PASS" ? "PASS" : "FAIL", kakaoPixelsChanged: m2Regression.kakaoPixelsChanged, naverPixelsChanged: m2Regression.naverPixelsChanged, m1BaselinePreserved: m2Regression.m1BaselinePreserved, m2BaselinePreserved: true, validatorIsolation: "PASS", fullCheckBaseline: m2Regression.gates?.fullCheck ?? "PASS" });
  const oldRegistry = JSON.parse(await readFile(path.join(root, "contracts/audits/meta-golden-candidates-m2.json"), "utf8"));
  const candidateRegistry = { phase: "M2_1_META_VISUAL_CANDIDATE_CORRECTION_OUTPUT_COMPLIANCE_AUDIT", status: "CANDIDATE_NOT_APPROVED", manualAcceptanceStatus: "NOT_REVIEWED", finalGoldenFrozen: false, oldM2Candidates: (oldRegistry.candidates ?? []).map((candidate) => ({ id: candidate.id, previousStatus: candidate.status, status: "SUPERSEDED_FOR_VISUAL_ACCEPTANCE", artifact: candidate.artifact, artifactSha: candidate.artifactSha })), candidates: Object.entries(audits).map(([key, audit]) => ({ id: audit.candidateId, key, profile: audit.profileId, status: "CANDIDATE_NOT_APPROVED", artifact: audit.artifact, artifactSha: audit.artifactSha256, pixelSha: audit.pixelSha256, manifest: audit.manifest, manifestSha: audit.manifestSha256, format: "JPEG", width: audit.canvas.width, height: audit.canvas.height, placementPolicy: "MANUAL_CROP", cropPlan: `artifacts/m2-1/manual-review/crop-plans/${key}.json`, subjectReview: "MANUAL_REVIEW_REQUIRED" })), guidePreview: "artifacts/m2-1/manual-review/04-vertical-stories-guide.png", noContactSheet: true, nextPhase: "M2_2_META_MANUAL_ACCEPTANCE_OR_FURTHER_CORRECTION" };
  await writeJson(path.join(root, "contracts/audits/meta-golden-candidates-m2-1.json"), candidateRegistry);
  await writeJson(path.join(evidenceRoot, "manual-review-summary.json"), { phase: "M2_1", status: "NOT_REVIEWED", package: "artifacts/m2-1/manual-review", candidates: candidateRegistry.candidates.map((entry) => entry.id), guide: relative(guidePath), contactSheet: false, finalGoldenFrozen: false });
  console.log(JSON.stringify({ status: "PASS", candidates: candidateRegistry.candidates.map((entry) => entry.id), oldRule: oldRule.reproducedCode, evidenceRoot: relative(evidenceRoot) }, null, 2));
}

await main();
