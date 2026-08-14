import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { loadContracts, renderMetaStatic } from "../dist/core/index.js";

const root = process.cwd();
const checks = [];
const failures = [];
const contexts = ["FACEBOOK_FEED", "INSTAGRAM_FEED", "FACEBOOK_STORIES", "INSTAGRAM_STORIES", "FACEBOOK_REELS", "INSTAGRAM_REELS", "INSTAGRAM_EXPLORE", "FEED", "STORIES", "REELS"];

function check(name, condition, detail) {
  checks.push({ name, status: condition ? "PASS" : "FAIL", detail });
  if (!condition) failures.push(`${name}: ${detail}`);
}
async function readJson(relativePath) { return JSON.parse(await readFile(path.join(root, relativePath), "utf8")); }
async function exists(relativePath) { return stat(path.join(root, relativePath)).then(() => true).catch(() => false); }
async function sha256File(relativePath) { return createHash("sha256").update(await readFile(path.join(root, relativePath))).digest("hex"); }
function basePlan(profileId) { return { schemaVersion: "1.0.0", formatProfileId: profileId, source: "MANUAL", background: { type: "SOLID", color: "#101214" }, elements: [] }; }
function baseRequest(profileId, context) { return { formatProfileId: profileId, layoutMode: "FREEFORM", ...(context ? { placementContext: context } : {}), creativeLayoutPlan: basePlan(profileId), output: { format: "PNG" }, metaStatic: { mode: "SINGLE" } }; }

const versions = await readJson("contracts/contract-versions.json");
const packageJson = await readJson("package.json");
const inputSchema = await readJson("packages/renderer-contract/schema/renderer-integration-input-v1.schema.json");
const planSchema = await readJson("packages/renderer-contract/schema/creative-layout-plan-v1.schema.json");
const inventory = await readJson("artifacts/m2-2/meta-placement-context-contract-inventory.json");
const pipeline = await readJson("artifacts/m2-2/freeform-plan-import-pipeline.json");
const roundtrip = await readJson("artifacts/m2-2/meta-plan-roundtrip-audit.json");
const squareEvidence = await readJson("artifacts/m2-2/meta-square-import-reproduction.json");
const storiesEvidence = await readJson("artifacts/m2-2/meta-stories-context-propagation.json");
const reelsEvidence = await readJson("artifacts/m2-2/meta-reels-context-propagation.json");
const safeZone = await readJson("artifacts/m2-2/meta-safe-zone-target-audit.json");
const byteAudit = await readJson("artifacts/m2-2/meta-300kb-regression.json");
const determinism = await readJson("artifacts/m2-2/meta-determinism.json");
const regression = await readJson("artifacts/m2-2/regression.json");
const registry = await readJson("contracts/audits/meta-golden-candidates-m2-2.json");
const manual = await readJson("artifacts/m2-2/manual-review-summary.json");
const source = await readJson("artifacts/m2-2/candidate-source-provenance.json");

check("version_m2_2", ((versions.documentVersion?.previous === "1.23.0" && versions.documentVersion?.current === "1.23.1") || (versions.documentVersion?.previous === "1.23.1" && versions.documentVersion?.current === "1.24.0" && versions.canonicalPhaseG0_1Google?.architectureStatus === "FROZEN") || (versions.documentVersion?.previous === "1.24.0" && versions.documentVersion?.current === "1.25.0" && versions.canonicalPhaseG1Google?.contractsImplemented === true)) && versions.canonicalPhaseM2_1?.documentCurrent === "1.23.0" && versions.canonicalPhaseM2_2?.documentPrevious === "1.23.0" && versions.canonicalPhaseM2_2?.documentCurrent === "1.23.1" && versions.templateContractVersion === "1.9.0" && versions.inputSchemaVersion?.current === "1.2.0" && versions.outputSchemaVersion?.current === "2.0.0" && versions.renderManifestSchemaVersion === "1.0.0" && versions.responseEnvelopeSchemaVersion === "1.0.0" && versions.canonicalPhaseM2_2?.rendererCoreVersion === "0.9.0" && versions.canonicalPhaseM2_2?.validatorCurrent === "1.9.0" && versions.canonicalPhaseM2_2?.desktopCurrent === "0.10.0" && ["0.10.0", "0.10.1"].includes(versions.desktopAppVersion) && ["0.10.0", "0.10.1"].includes(packageJson.version), JSON.stringify({ document: versions.documentVersion, m2_2: versions.canonicalPhaseM2_2, currentDesktop: versions.desktopAppVersion, currentPackage: packageJson.version }));
check("template_unchanged", versions.templateContractVersion === "1.9.0" && versions.coordinatesChanged === false && versions.canonicalPhaseM2_2?.templateCoordinatesChanged === false, JSON.stringify({ template: versions.templateContractVersion, coordinatesChanged: versions.coordinatesChanged }));
check("request_context_schema", inputSchema.properties?.placementContext?.$ref === "#/$defs/placementContext" && JSON.stringify(inputSchema.$defs?.placementContext?.enum) === JSON.stringify(contexts), JSON.stringify(inputSchema.properties?.placementContext));
check("plan_context_forbidden", planSchema.additionalProperties === false && !("placementContext" in (planSchema.properties ?? {})), JSON.stringify(planSchema.properties));
check("inventory", inventory.status === "PASS" && inventory.owner === "RENDER_REQUEST" && inventory.verticalNoContext?.silentFeedDefault === false && inventory.entries?.some((entry) => entry.classification === "MISSING_BY_DESIGN" && entry.placementContextAllowed === false), JSON.stringify(inventory));
check("import_pipeline", pipeline.status === "PASS" && pipeline.stages?.map((stage) => stage.id).join(",") === "json_parse,schema_validation,canonical_normalization,state_hydration,placement_hydration,cropRect_hydration,form_editor_state,request_serialization,core_renderer_input,manifest_appliedElements", JSON.stringify(pipeline.stages));
check("roundtrip", roundtrip.status === "PASS" && roundtrip.semanticEquality === true && roundtrip.importedPlanRemainsSourceOfTruth === true, JSON.stringify(roundtrip));
check("square_evidence", squareEvidence.status === "PASS" && squareEvidence.renderedPolicy === "MANUAL_CROP" && squareEvidence.renderedFitMode === "COVER" && squareEvidence.fullBleed === true, JSON.stringify(squareEvidence));
check("stories_evidence", storiesEvidence.status === "PASS" && storiesEvidence.requestedContext === "INSTAGRAM_STORIES" && storiesEvidence.resolvedContext === "INSTAGRAM_STORIES" && storiesEvidence.resolution?.source === "EXPLICIT_REQUEST" && storiesEvidence.reelsValidatorRan === false && storiesEvidence.warningCount === 0, JSON.stringify(storiesEvidence));
check("reels_evidence", reelsEvidence.status === "PASS" && reelsEvidence.requestedContext === "INSTAGRAM_REELS" && reelsEvidence.resolvedContext === "INSTAGRAM_REELS" && reelsEvidence.sourceRequiredInfo >= 1 && reelsEvidence.storiesValidatorRan === false && reelsEvidence.guessedGeometry === false, JSON.stringify(reelsEvidence));
check("safe_zone_targets", safeZone.status === "PASS" && safeZone.cleanHero?.warningCount === 0 && safeZone.explicitKeyCreative?.warningProduced === true && safeZone.backgroundPhotoOccupancy === "NO_WARNING", JSON.stringify(safeZone));
check("stale_300kb_absent", byteAudit.status === "PASS" && byteAudit.stale300000RulePresent === false && byteAudit.noReplacementMaximumInvented === true && Object.values(byteAudit.candidateFileSizeErrors ?? {}).every((value) => value === false), JSON.stringify(byteAudit));
check("source_hashes", source.sourceSha256 === "9dd206a7863d4ff6079e1352b54e1d7c1f0b9965e22b39127de244fe345159a5" && source.sourceOriginalSha256 === "ffadcc7954d500fd618e12161ce11396f8858d5d6ab8a52333836dfd03348917", JSON.stringify(source));
check("candidate_registry", registry.phase === "M2_2_META_PLACEMENT_CONTEXT_PROPAGATION_PLAN_IMPORT_CONSISTENCY_HOTFIX" && registry.status === "CANDIDATE_NOT_APPROVED" && registry.manualAcceptanceStatus === "NOT_REVIEWED" && registry.finalGoldenFrozen === false && registry.candidates?.length === 4 && registry.noContactSheet === true, JSON.stringify(registry));
check("manual_review", manual.status === "NOT_REVIEWED" && manual.finalGoldenFrozen === false && manual.contactSheet === false && await exists("artifacts/m2-2/manual-review/README.md") && await exists("artifacts/m2-2/manual-review/04-vertical-stories-guide.png"), JSON.stringify(manual));

const expected = [
  ["square", "META_GC_FEED_SQUARE_M2_2", "01-feed-square-fullbleed.jpg", 1080, 1080, "FACEBOOK_FEED"],
  ["portrait", "META_GC_FEED_PORTRAIT_M2_2", "02-feed-portrait-fullbleed.jpg", 1080, 1350, "INSTAGRAM_FEED"],
  ["stories", "META_GC_VERTICAL_STORIES_M2_2", "03-vertical-stories-fullbleed.jpg", 1080, 1920, "INSTAGRAM_STORIES"],
  ["reels", "META_GC_VERTICAL_REELS_M2_2", "05-vertical-reels-fullbleed.jpg", 1080, 1920, "INSTAGRAM_REELS"],
];
for (const [key, id, file, width, height, context] of expected) {
  const candidate = registry.candidates?.find((entry) => entry.candidateId === id);
  check(`${key}_registry`, candidate?.status === "CANDIDATE_NOT_APPROVED" && candidate?.context === context && candidate?.placementPolicy === "MANUAL_CROP" && candidate?.fitMode === "COVER", JSON.stringify(candidate));
  check(`${key}_files`, Boolean(candidate?.artifact) && Boolean(candidate?.manifest) && await exists(candidate?.artifact ?? "") && await exists(candidate?.manifest ?? "") && await exists(`artifacts/m2-2/manual-review/${file}`), JSON.stringify({ artifact: candidate?.artifact, manifest: candidate?.manifest }));
  if (candidate?.artifact && await exists(candidate.artifact) && candidate.manifest && await exists(candidate.manifest)) {
    const info = await sharp(path.join(root, candidate.artifact)).metadata();
    const manifest = await readJson(candidate.manifest);
    const artifactHash = await sha256File(candidate.artifact);
    check(`${key}_canvas`, info.format === "jpeg" && info.width === width && info.height === height, JSON.stringify({ format: info.format, width: info.width, height: info.height }));
    check(`${key}_hashes`, artifactHash === candidate.artifactSha256 && await sha256File(candidate.manifest) === candidate.manifestSha256, JSON.stringify({ artifactHash, manifestHash: await sha256File(candidate.manifest) }));
    check(`${key}_manifest_context`, manifest.metaStaticReport?.placementContext === context && manifest.metaStaticReport?.placementContextResolution?.resolved === context && manifest.metaStaticReport?.placementContextResolution?.source === "EXPLICIT_REQUEST", JSON.stringify(manifest.metaStaticReport));
    check(`${key}_manifest_clean`, manifest.validatorResult?.errorCount === 0 && !manifest.validatorResult?.issues?.some((issue) => issue.code === "KBR-FREEFORM-FILE-SIZE-EXCEEDED"), JSON.stringify(manifest.validatorResult));
    check(`${key}_full_bleed`, candidate.fullBleed === true && candidate.actualRasterBounds?.x === 0 && candidate.actualRasterBounds?.y === 0 && candidate.actualRasterBounds?.width === width && candidate.actualRasterBounds?.height === height, JSON.stringify(candidate.actualRasterBounds));
  }
  check(`${key}_determinism`, determinism.candidates?.[key]?.runs === 3 && determinism.candidates[key].byteEqual === true && determinism.candidates[key].pixelEqual === true && determinism.candidates[key].fingerprintEqual === true, JSON.stringify(determinism.candidates?.[key]));
}

const contracts = await loadContracts(root);
const stories = await renderMetaStatic(baseRequest("META_STATIC_VERTICAL_FULL", "INSTAGRAM_STORIES"), { projectRoot: root, inputRoot: root, outputRoot: root, contracts, publish: false });
const reels = await renderMetaStatic(baseRequest("META_STATIC_VERTICAL_FULL", "INSTAGRAM_REELS"), { projectRoot: root, inputRoot: root, outputRoot: root, contracts, publish: false });
const generic = await renderMetaStatic(baseRequest("META_STATIC_VERTICAL_FULL"), { projectRoot: root, inputRoot: root, outputRoot: root, contracts, publish: false });
const unknown = await renderMetaStatic(baseRequest("META_STATIC_VERTICAL_FULL", "UNKNOWN_CONTEXT"), { projectRoot: root, inputRoot: root, outputRoot: root, contracts, publish: false });
const invalidPlan = await renderMetaStatic({ ...baseRequest("META_STATIC_VERTICAL_FULL"), creativeLayoutPlan: { ...basePlan("META_STATIC_VERTICAL_FULL"), placementContext: "INSTAGRAM_REELS" } }, { projectRoot: root, inputRoot: root, outputRoot: root, contracts, publish: false });
check("runtime_request_context", stories.status === "PASS" && stories.metaStaticReport?.placementContext === "INSTAGRAM_STORIES" && reels.status === "PASS" && reels.metaStaticReport?.placementContext === "INSTAGRAM_REELS", JSON.stringify({ stories: stories.metaStaticReport, reels: reels.metaStaticReport }));
check("runtime_vertical_neutral", generic.status === "PASS" && generic.metaStaticReport?.placementContext === null && generic.metaStaticReport?.placementContextResolution?.source === "DEFAULT_NONE" && generic.metaStaticReport?.reelsGeometryStatus === "NOT_APPLICABLE", JSON.stringify(generic.metaStaticReport));
check("runtime_unknown_fail_closed", unknown.status === "BLOCKED" && unknown.errors.some((issue) => issue.code === "KBR-INPUT-002"), JSON.stringify(unknown.errors));
check("runtime_plan_boundary", invalidPlan.status === "BLOCKED" && invalidPlan.errors.some((issue) => issue.code === "KBR-FREEFORM-PLAN-SCHEMA-INVALID"), JSON.stringify(invalidPlan.errors));
check("fingerprint_semantics", determinism.storiesVsReels?.requestFingerprintDiffers === true && determinism.storiesVsReels?.pixelFingerprintMayMatch === true && determinism.storiesVsReels?.artifactMayMatch === true && determinism.storiesVsReels?.validationMetadataDiffers === true, JSON.stringify(determinism.storiesVsReels));
check("regression", regression.status === "PASS" && regression.kakaoGoldensUnchanged === true && regression.naverSmartChannelGoldensUnchanged === true && regression.naverSmartChannel120 === "PASS" && regression.naverRemaining === "PASS" && regression.metaM1 === "PASS" && regression.metaM2_1 === "PASS", JSON.stringify(regression));
check("reference_fixture", await exists("fixtures/meta/m2-1/source/meta-m2-1-sofa-stool__source__2048x1365.jpg") && await sha256File("fixtures/meta/m2-1/source/meta-m2-1-sofa-stool__source__2048x1365.jpg") === source.sourceSha256, source.sourceSha256);

for (const result of checks) console.log(`${result.status} ${result.name}: ${result.detail}`);
if (failures.length > 0) {
  console.error(JSON.stringify({ status: "FAIL", failures, checks: checks.length }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ status: "PASS", checks: checks.length, candidates: registry.candidates.map((entry) => entry.candidateId), manualAcceptanceStatus: registry.manualAcceptanceStatus, finalGoldenFrozen: registry.finalGoldenFrozen }, null, 2));
}
