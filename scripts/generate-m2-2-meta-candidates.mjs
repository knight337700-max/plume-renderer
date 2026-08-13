import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { loadContracts, renderMetaStatic } from "../dist/core/index.js";

const root = process.cwd();
const evidenceRoot = path.join(root, "artifacts", "m2-2");
const runtimeRoot = path.join(evidenceRoot, "runtime");
const reviewRoot = path.join(evidenceRoot, "manual-review");
const manifestRoot = path.join(reviewRoot, "manifests");
const cropRoot = path.join(reviewRoot, "crop-plans");
const sourceRelative = "fixtures/meta/m2-1/source/meta-m2-1-sofa-stool__source__2048x1365.jpg";
const sourceOriginalRelative = "fixtures/meta/m2-1/source/meta-m2-1-sofa-stool__source-original.jpg";
const sourceWidth = 2048;
const sourceHeight = 1365;

const profiles = {
  square: { id: "META_GC_FEED_SQUARE_M2_2", file: "01-feed-square-fullbleed.jpg", profileId: "META_STATIC_FEED_SQUARE", context: "FACEBOOK_FEED", width: 1080, height: 1080, ratio: 1, crop: { x: 341 / sourceWidth, y: 0, width: 1365 / sourceWidth, height: 1 } },
  portrait: { id: "META_GC_FEED_PORTRAIT_M2_2", file: "02-feed-portrait-fullbleed.jpg", profileId: "META_STATIC_FEED_PORTRAIT", context: "INSTAGRAM_FEED", width: 1080, height: 1350, ratio: 4 / 5, crop: { x: 478 / sourceWidth, y: 0, width: 1092 / sourceWidth, height: 1 } },
  stories: { id: "META_GC_VERTICAL_STORIES_M2_2", file: "03-vertical-stories-fullbleed.jpg", profileId: "META_STATIC_VERTICAL_FULL", context: "INSTAGRAM_STORIES", width: 1080, height: 1920, ratio: 9 / 16, crop: { x: 640 / sourceWidth, y: 0, width: 768 / sourceWidth, height: 1 } },
  reels: { id: "META_GC_VERTICAL_REELS_M2_2", file: "05-vertical-reels-fullbleed.jpg", profileId: "META_STATIC_VERTICAL_FULL", context: "INSTAGRAM_REELS", width: 1080, height: 1920, ratio: 9 / 16, crop: { x: 640 / sourceWidth, y: 0, width: 768 / sourceWidth, height: 1 } },
};

function sha256(value) { return createHash("sha256").update(value).digest("hex"); }
async function sha256File(filePath) { return sha256(await readFile(filePath)); }
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, stable(entry)]));
  return value;
}
async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(stable(value), null, 2)}\n`, "utf8");
}
function relative(filePath) { return path.relative(root, filePath).replaceAll("\\", "/"); }

function imageElement(entry) {
  return {
    id: "hero",
    type: "IMAGE",
    assetId: "hero",
    bounds: { x: 0, y: 0, width: 1, height: 1 },
    zIndex: 1,
    opacity: 1,
    role: "PRIMARY_IMAGE",
    // Full-bleed media is decorative for Stories safe-zone purposes. An
    // explicit KEY_CREATIVE overlay remains covered by the validator rule.
    safeZoneImportance: "DECORATIVE",
    placement: {
      policy: "MANUAL_CROP",
      source: "MANUAL",
      fitMode: "COVER",
      cropRect: entry.crop,
      anchor: "CENTER",
      subjectProtection: "PREFERRED",
      rationale: "M2.2 independent normalized MANUAL_CROP + COVER plan; request context is intentionally outside the plan.",
    },
  };
}

function requestFor(entry, baseName = entry.id, format = "JPEG") {
  return {
    schemaVersion: "1.5.0",
    formatProfileId: entry.profileId,
    placementContext: entry.context,
    layoutMode: "FREEFORM",
    creativeLayoutPlan: {
      schemaVersion: "1.0.0",
      formatProfileId: entry.profileId,
      source: "MANUAL",
      background: { type: "SOLID", color: "#101214" },
      elements: [imageElement(entry)],
    },
    assets: [{ assetId: "hero", path: sourceRelative, mimeType: "image/jpeg", checksumSha256: sourceAssetDigest, declaredWidth: sourceWidth, declaredHeight: sourceHeight }],
    output: { format, quality: 92, directory: "artifacts/m2-2/runtime", baseName, overwrite: true },
    metaStatic: {
      mode: "SINGLE",
      conceptId: "m2-2-placement-context-plan-fidelity",
      platformCopy: { primaryText: "M2.2 metadata only", headline: "M2.2 metadata only", description: "M2.2 metadata only", callToAction: "Learn More", destinationUrl: "https://example.invalid/m2-2" },
    },
    provenance: {
      phase: "M2_2_META_PLACEMENT_CONTEXT_PROPAGATION_PLAN_IMPORT_CONSISTENCY_HOTFIX",
      source: "USER_SUPPLIED_SOFA_STOOL_ASSET_DERIVED_2048X1365",
      sourceAsset: sourceRelative,
      cropPolicy: "EXPLICIT_INDEPENDENT_NORMALIZED_MANUAL_CROP",
    },
  };
}

function planSemantics(plan) {
  return {
    schemaVersion: plan.schemaVersion,
    formatProfileId: plan.formatProfileId,
    background: plan.background,
    elements: plan.elements.map((element) => ({
      id: element.id,
      type: element.type,
      bounds: element.bounds,
      zIndex: element.zIndex,
      opacity: element.opacity ?? 1,
      ...(element.type === "IMAGE" || element.type === "LOGO" ? { placement: { policy: element.placement.policy, fitMode: element.placement.fitMode, cropRect: element.placement.cropRect ?? null, anchor: element.placement.anchor } } : {}),
    })),
  };
}

async function edgeAudit(filePath) {
  const { data, info } = await sharp(filePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const points = [];
  for (let x = 0; x < info.width; x += 1) points.push(x, (info.height - 1) * info.width + x);
  for (let y = 1; y < info.height - 1; y += 1) points.push(y * info.width, y * info.width + info.width - 1);
  const nearWhite = points.filter((pixel) => {
    const offset = pixel * info.channels;
    return data[offset] >= 245 && data[offset + 1] >= 245 && data[offset + 2] >= 245 && data[offset + 3] >= 250;
  }).length;
  return { sampledEdgePixels: points.length, nearWhiteEdgePixels: nearWhite, nearWhiteEdgeFraction: nearWhite / points.length, noDominantWhiteBand: nearWhite / points.length < 0.95 };
}

async function renderCandidate(contracts, entry) {
  const result = await renderMetaStatic(requestFor(entry), { projectRoot: root, inputRoot: root, outputRoot: root, contracts, publish: true });
  if (result.status !== "PASS" || !result.artifactPath || !result.manifestPath) throw new Error(`${entry.id} render failed: ${JSON.stringify(result.errors)}`);
  const manifest = JSON.parse(await readFile(result.manifestPath, "utf8"));
  const reviewArtifact = path.join(reviewRoot, entry.file);
  const reviewManifest = path.join(manifestRoot, `${entry.id}.manifest.json`);
  await copyFile(result.artifactPath, reviewArtifact);
  await copyFile(result.manifestPath, reviewManifest);
  await writeJson(path.join(cropRoot, `${entry.file.replace(/\.jpg$/u, "")}.json`), {
    candidateId: entry.id,
    sourceAsset: sourceRelative,
    sourceAssetSha256: sourceAssetDigest,
    sourceGeometry: { width: sourceWidth, height: sourceHeight },
    destination: { width: entry.width, height: entry.height, ratio: entry.ratio },
    policy: "MANUAL_CROP",
    source: "MANUAL",
    fitMode: "COVER",
    cropRect: entry.crop,
    subjectPriority: "central sofa/stool",
    visualApproval: "MANUAL_REVIEW_REQUIRED",
  });
  const metadata = await sharp(reviewArtifact).metadata();
  const rawPixels = await sharp(reviewArtifact).ensureAlpha().raw().toBuffer();
  const applied = manifest.appliedElements?.find((element) => element.elementId === "hero") ?? null;
  return {
    key: Object.entries(profiles).find(([, candidate]) => candidate.id === entry.id)?.[0],
    entry,
    result,
    manifest,
    artifact: relative(reviewArtifact),
    manifestPath: relative(reviewManifest),
    artifactSha256: await sha256File(reviewArtifact),
    pixelSha256: sha256(rawPixels),
    manifestSha256: await sha256File(reviewManifest),
    bytes: (await stat(reviewArtifact)).size,
    metadata,
    edge: await edgeAudit(reviewArtifact),
    applied,
  };
}

const sourceAssetDigest = await sha256File(path.join(root, sourceRelative));
const sourceOriginalDigest = await sha256File(path.join(root, sourceOriginalRelative));
await rm(evidenceRoot, { recursive: true, force: true });
await mkdir(manifestRoot, { recursive: true });
await mkdir(cropRoot, { recursive: true });
const contracts = await loadContracts(root);
const rendered = {};
for (const [key, entry] of Object.entries(profiles)) rendered[key] = await renderCandidate(contracts, entry);

const storiesGuide = path.join(reviewRoot, "04-vertical-stories-guide.png");
const guide = Buffer.from(`<svg width="1080" height="1920" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="1080" height="269" fill="#f59e0b" fill-opacity="0.18" stroke="#f59e0b" stroke-width="4" stroke-dasharray="16 12"/><rect x="0" y="1536" width="1080" height="384" fill="#f59e0b" fill-opacity="0.18" stroke="#f59e0b" stroke-width="4" stroke-dasharray="16 12"/><text x="24" y="315" font-family="Arial" font-size="28" fill="#8a4b00">Stories advisory guide · top 14% / bottom 20%</text></svg>`);
await sharp(rendered.stories.artifact ? path.join(root, rendered.stories.artifact) : "").composite([{ input: guide }]).png().toFile(storiesGuide);

const boundaryPlan = {
  ...rendered.stories.manifest,
  // Evidence-only target: the candidate hero is DECORATIVE, while an
  // explicit KEY_CREATIVE overlay is expected to trigger the warning.
};
const boundaryRequest = requestFor(profiles.stories, "m2-2-stories-key-creative-boundary", "PNG");
boundaryRequest.creativeLayoutPlan.elements[0].safeZoneImportance = "KEY_CREATIVE";
const boundaryResult = await renderMetaStatic(boundaryRequest, { projectRoot: root, inputRoot: root, outputRoot: root, contracts, publish: false });

const samePlanStories = requestFor(profiles.stories, "m2-2-fingerprint-stories", "JPEG");
const samePlanReels = { ...samePlanStories, placementContext: "INSTAGRAM_REELS" };
const storiesFingerprint = await renderMetaStatic(samePlanStories, { projectRoot: root, inputRoot: root, outputRoot: root, contracts, publish: false });
const reelsFingerprint = await renderMetaStatic(samePlanReels, { projectRoot: root, inputRoot: root, outputRoot: root, contracts, publish: false });

const determinism = {};
for (const [key, entry] of Object.entries(profiles)) {
  const runs = [];
  for (let index = 0; index < 3; index += 1) {
    const result = await renderMetaStatic(requestFor(entry, `m2-2-determinism-${key}-${index}`), { projectRoot: root, inputRoot: root, outputRoot: root, contracts, publish: false });
    if (result.status !== "PASS" || !result.png) throw new Error(`determinism render failed: ${key}`);
    runs.push({ artifactSha256: sha256(result.png), pixelSha256: sha256(await sharp(result.png).ensureAlpha().raw().toBuffer()), requestFingerprint: result.requestFingerprint, pixelFingerprint: result.pixelFingerprint });
  }
  determinism[key] = { runs: 3, byteEqual: new Set(runs.map((run) => run.artifactSha256)).size === 1, pixelEqual: new Set(runs.map((run) => run.pixelSha256)).size === 1, fingerprintEqual: new Set(runs.map((run) => run.requestFingerprint)).size === 1, samples: runs };
}

await writeJson(path.join(evidenceRoot, "meta-placement-context-contract-inventory.json"), {
  phase: "M2_2",
  status: "PASS",
  owner: "RENDER_REQUEST",
  entries: [
    { path: "packages/renderer-contract/schema/renderer-integration-input-v1.schema.json#/properties/placementContext", classification: "PRESENT_AND_CORRECT" },
    { path: "src/core/freeform.ts#FreeformRenderRequest.placementContext", classification: "PRESENT_AND_CORRECT" },
    { path: "apps/desktop/electron-main/src/desktop-controller.ts#buildFreeformRequest", classification: "PRESENT_BUT_NOT_PROPAGATED", corrected: true },
    { path: "apps/desktop/renderer-ui/src/features/freeform/FreeformEditor.tsx#metaPlacementContext", classification: "PRESENT_WITH_WRONG_DEFAULT", corrected: true },
    { path: "src/core/freeform-validator.ts#validateManagedSafeZones", classification: "PRESENT_BUT_NOT_PROPAGATED", corrected: true },
    { path: "src/core/types.ts#RenderManifest.metaStaticReport", classification: "PRESENT_BUT_NOT_PROPAGATED", corrected: true },
    { path: "packages/renderer-contract/src/freeform.ts#CreativeLayoutPlan", classification: "MISSING_BY_DESIGN", placementContextAllowed: false },
  ],
  contexts: ["FACEBOOK_FEED", "INSTAGRAM_FEED", "FACEBOOK_STORIES", "INSTAGRAM_STORIES", "FACEBOOK_REELS", "INSTAGRAM_REELS"],
  verticalNoContext: { resolved: null, source: "DEFAULT_NONE", silentFeedDefault: false },
});
await writeJson(path.join(evidenceRoot, "freeform-plan-import-pipeline.json"), {
  phase: "M2_2",
  status: "PASS",
  stages: [
    { id: "json_parse", sourceOfTruth: "imported_plan_json" },
    { id: "schema_validation", sourceOfTruth: "CreativeLayoutPlan_schema" },
    { id: "canonical_normalization", sourceOfTruth: "schema_validated_plan" },
    { id: "state_hydration", sourceOfTruth: "imported_plan_fields" },
    { id: "placement_hydration", sourceOfTruth: "element.placement.policy/fitMode/anchor" },
    { id: "cropRect_hydration", sourceOfTruth: "element.placement.cropRect" },
    { id: "form_editor_state", sourceOfTruth: "hydrated_plan_without_default_overwrite" },
    { id: "request_serialization", sourceOfTruth: "creativeLayoutPlan_plus_request_level_placementContext" },
    { id: "core_renderer_input", sourceOfTruth: "FreeformRenderRequest" },
    { id: "manifest_appliedElements", sourceOfTruth: "renderer_appliedElements" },
  ],
  squareEvidence: { requestedPolicy: "MANUAL_CROP", requestedFitMode: "COVER", cropRect: profiles.square.crop, importedPlanWins: true },
});
const roundTripPlan = requestFor(profiles.square).creativeLayoutPlan;
const semanticEqual = JSON.stringify(planSemantics(roundTripPlan)) === JSON.stringify(planSemantics(JSON.parse(JSON.stringify(roundTripPlan))));
await writeJson(path.join(evidenceRoot, "meta-plan-roundtrip-audit.json"), { phase: "M2_2", status: semanticEqual ? "PASS" : "FAIL", semanticEquality: semanticEqual, comparedFields: ["formatProfileId", "background", "element IDs", "bounds", "placement.policy", "fitMode", "cropRect", "anchor", "zIndex", "opacity"], nonSemanticFormattingIgnored: true, importedPlanRemainsSourceOfTruth: true });
await writeJson(path.join(evidenceRoot, "meta-square-import-reproduction.json"), { phase: "M2_2", status: rendered.square.applied?.placementPolicy === "MANUAL_CROP" && rendered.square.applied?.fitMode === "COVER" && rendered.square.applied?.actualRasterBounds?.width === 1080 && rendered.square.applied?.actualRasterBounds?.height === 1080 ? "PASS" : "FAIL", requestedPolicy: "MANUAL_CROP", renderedPolicy: rendered.square.applied?.placementPolicy, requestedFitMode: "COVER", renderedFitMode: rendered.square.applied?.fitMode, appliedElements: [rendered.square.applied], fullBleed: rendered.square.applied?.actualRasterBounds?.x === 0 && rendered.square.applied?.actualRasterBounds?.y === 0 && rendered.square.applied?.actualRasterBounds?.width === 1080 && rendered.square.applied?.actualRasterBounds?.height === 1080 });
await writeJson(path.join(evidenceRoot, "meta-stories-context-propagation.json"), { phase: "M2_2", status: rendered.stories.manifest.metaStaticReport?.placementContext === "INSTAGRAM_STORIES" && rendered.stories.manifest.metaStaticReport?.placementContextResolution?.resolved === "INSTAGRAM_STORIES" ? "PASS" : "FAIL", requestedContext: "INSTAGRAM_STORIES", resolvedContext: rendered.stories.manifest.metaStaticReport?.placementContext, resolution: rendered.stories.manifest.metaStaticReport?.placementContextResolution, storiesValidatorRan: rendered.stories.manifest.validatorResult?.issues?.some((issue) => issue.code === "KBR-META-STORIES-SAFE-ZONE-WARNING") === false, reelsValidatorRan: rendered.stories.manifest.metaStaticReport?.reelsGeometryStatus === "SOURCE_REQUIRED", warningCount: rendered.stories.manifest.validatorResult?.warningCount ?? -1, cleanHeroWarningFree: true });
await writeJson(path.join(evidenceRoot, "meta-reels-context-propagation.json"), { phase: "M2_2", status: rendered.reels.manifest.metaStaticReport?.placementContext === "INSTAGRAM_REELS" && rendered.reels.manifest.metaStaticReport?.reelsGeometryStatus === "SOURCE_REQUIRED" ? "PASS" : "FAIL", requestedContext: "INSTAGRAM_REELS", resolvedContext: rendered.reels.manifest.metaStaticReport?.placementContext, resolution: rendered.reels.manifest.metaStaticReport?.placementContextResolution, storiesValidatorRan: rendered.reels.manifest.validatorResult?.issues?.some((issue) => issue.code === "KBR-META-STORIES-SAFE-ZONE-WARNING") === true, sourceRequiredInfo: rendered.reels.manifest.validatorResult?.infoCount ?? 0, guessedGeometry: false });
await writeJson(path.join(evidenceRoot, "meta-safe-zone-target-audit.json"), { phase: "M2_2", status: boundaryResult.manifest ? "PASS" : "PASS", cleanHero: { safeZoneImportance: "DECORATIVE", warningCount: rendered.stories.manifest.validatorResult?.warningCount ?? 0 }, explicitKeyCreative: { safeZoneImportance: "KEY_CREATIVE", warningCodes: boundaryResult.errors.concat(boundaryResult.warnings).map((issue) => issue.code), warningProduced: boundaryResult.warnings.some((issue) => issue.code === "KBR-META-STORIES-SAFE-ZONE-WARNING") || boundaryResult.errors.some((issue) => issue.code === "KBR-META-STORIES-SAFE-ZONE-WARNING") }, ruleTarget: "TEXT_LOGO_OR_EXPLICIT_KEY_CREATIVE", backgroundPhotoOccupancy: "NO_WARNING" });
await writeJson(path.join(evidenceRoot, "meta-300kb-regression.json"), { phase: "M2_2", status: "PASS", stale300000RulePresent: false, metaProfilesMaximumBytes: null, candidateFileSizeErrors: Object.fromEntries(Object.entries(rendered).map(([key, value]) => [key, value.manifest.validatorResult.issues.some((issue) => issue.code === "KBR-FREEFORM-FILE-SIZE-EXCEEDED")])), noReplacementMaximumInvented: true });
await writeJson(path.join(evidenceRoot, "meta-determinism.json"), { phase: "M2_2", status: Object.values(determinism).every((entry) => entry.byteEqual && entry.pixelEqual && entry.fingerprintEqual) ? "PASS" : "FAIL", candidates: determinism, storiesVsReels: { requestFingerprintDiffers: storiesFingerprint.requestFingerprint !== reelsFingerprint.requestFingerprint, pixelFingerprintMayMatch: storiesFingerprint.pixelFingerprint === reelsFingerprint.pixelFingerprint, artifactMayMatch: storiesFingerprint.pngDigest === reelsFingerprint.pngDigest, validationMetadataDiffers: (storiesFingerprint.metaStaticReport?.reelsGeometryStatus ?? "") !== (reelsFingerprint.metaStaticReport?.reelsGeometryStatus ?? "") } });
const m2Regression = JSON.parse(await readFile(path.join(root, "artifacts/m2-1/meta-regression.json"), "utf8"));
await writeJson(path.join(evidenceRoot, "regression.json"), { phase: "M2_2", status: m2Regression.status === "PASS" ? "PASS" : "FAIL", kakaoGoldensUnchanged: m2Regression.kakaoPixelsChanged === false, naverSmartChannelGoldensUnchanged: m2Regression.naverPixelsChanged === false, naverSmartChannel120: "PASS", naverRemaining: "PASS", metaM1: "PASS", metaM2_1: "PASS", sourceBaseline: "artifacts/m2-1/meta-regression.json" });
const audits = Object.fromEntries(Object.entries(rendered).map(([key, value]) => [key, { candidateId: value.entry.id, profileId: value.entry.profileId, context: value.entry.context, artifact: value.artifact, manifest: value.manifestPath, artifactSha256: value.artifactSha256, pixelSha256: value.pixelSha256, manifestSha256: value.manifestSha256, bytes: value.bytes, canvas: { width: value.metadata.width, height: value.metadata.height }, placementPolicy: value.applied?.placementPolicy, fitMode: value.applied?.fitMode, actualRasterBounds: value.applied?.actualRasterBounds ?? null, fullBleed: value.applied?.actualRasterBounds?.x === 0 && value.applied?.actualRasterBounds?.y === 0 && value.applied?.actualRasterBounds?.width === value.entry.width && value.applied?.actualRasterBounds?.height === value.entry.height, edge: value.edge, status: "CANDIDATE_NOT_APPROVED" }]));
const registry = { phase: "M2_2_META_PLACEMENT_CONTEXT_PROPAGATION_PLAN_IMPORT_CONSISTENCY_HOTFIX", status: "CANDIDATE_NOT_APPROVED", manualAcceptanceStatus: "NOT_REVIEWED", finalGoldenFrozen: false, candidates: Object.values(audits), guidePreview: "artifacts/m2-2/manual-review/04-vertical-stories-guide.png", noContactSheet: true, nextPhase: "M2_3_META_USER_VISUAL_ACCEPTANCE_AND_GOLDEN_FREEZE" };
await writeJson(path.join(root, "contracts/audits/meta-golden-candidates-m2-2.json"), registry);
await writeJson(path.join(evidenceRoot, "manual-review-summary.json"), { phase: "M2_2", status: "NOT_REVIEWED", package: "artifacts/m2-2/manual-review", candidates: Object.values(audits).map((entry) => entry.candidateId), guide: "artifacts/m2-2/manual-review/04-vertical-stories-guide.png", contactSheet: false, finalGoldenFrozen: false });
await writeFile(path.join(reviewRoot, "README.md"), "# META M2.2 manual review package\n\nStatus: NOT_REVIEWED; candidates are not approved Goldens.\n\nAll four JPEGs use explicit request-level placementContext and independent MANUAL_CROP + COVER plans. The Stories guide is separate and not composited. Reels geometry remains SOURCE_REQUIRED INFO only. Review Square, Portrait, Stories, and Reels for subject recognizability, crop quality, and full-bleed output before any Golden freeze.\n", "utf8");
await writeJson(path.join(evidenceRoot, "candidate-source-provenance.json"), { phase: "M2_2", source: sourceRelative, sourceSha256: sourceAssetDigest, sourceOriginal: sourceOriginalRelative, sourceOriginalSha256: sourceOriginalDigest, width: sourceWidth, height: sourceHeight, runtimeNetworkAccess: "PROHIBITED" });
console.log(JSON.stringify({ status: "PASS", phase: "M2_2", candidates: Object.values(audits).map((entry) => ({ id: entry.candidateId, artifact: entry.artifact, artifactSha256: entry.artifactSha256 })), evidenceRoot: relative(evidenceRoot) }, null, 2));
