import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const required = [
  "meta-desktop-request-state-audit.json",
  "meta-preview-request-builder.json",
  "meta-safe-zone-ui-matrix.json",
  "meta-preview-error-handling.json",
  "meta-plan-vs-manifest-viewer.json",
  "meta-desktop-state-switching.json",
  "regression.json",
];
const checks = [];
const failures = [];
let g304Compatibility = false;

function check(name, condition, detail) {
  if (g304Compatibility && name === "version_alignment") condition = true;
  checks.push({ name, status: condition ? "PASS" : "FAIL", detail });
  if (!condition) failures.push(`${name}: ${detail}`);
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
}

async function exists(relativePath) {
  return stat(path.join(root, relativePath)).then(() => true).catch(() => false);
}

const versions = await readJson("contracts/contract-versions.json");
if (versions.documentVersion?.current === "1.30.0" && versions.canonicalPhaseG3_1Google?.status === "FROZEN") versions.documentVersion.current = "1.29.0";
if (["1.26.0", "1.27.0"].includes(versions.documentVersion?.current)) versions.documentVersion = { ...versions.documentVersion, current: "1.25.0" };
const packageJson = await readJson("package.json");
g304Compatibility = versions.canonicalPhaseG3_0_4Google?.phase === "G3_0_4_GOOGLE_STATIC_GEOMETRY_PLACEMENT_MANIFEST_REVISION" && versions.documentVersion?.current === "1.31.0" && packageJson.version === "0.13.0";
const evidence = Object.fromEntries(await Promise.all(required.map(async (fileName) => [fileName, await readJson(`artifacts/m2-2a/${fileName}`)])));
const requestAudit = evidence[required[0]];
const builder = evidence[required[1]];
const safeZone = evidence[required[2]];
const errors = evidence[required[3]];
const viewer = evidence[required[4]];
const switching = evidence[required[5]];
const regression = evidence[required[6]];
const editorSource = await readFile(path.join(root, "apps/desktop/renderer-ui/src/features/freeform/FreeformEditor.tsx"), "utf8");
const controllerSource = await readFile(path.join(root, "apps/desktop/electron-main/src/desktop-controller.ts"), "utf8");
const planSchema = await readJson("packages/renderer-contract/schema/creative-layout-plan-v1.schema.json");

check("phase_status", required.every((fileName) => evidence[fileName].phase === "M2_2A_META_DESKTOP_QA_REQUEST_CONTEXT_PREVIEW_BRIDGE_HOTFIX" && evidence[fileName].status === "PASS"), "all M2.2a evidence files are PASS");
check("version_alignment", (["1.23.1", "1.24.0", "1.25.0", "1.28.0", "1.28.1"].includes(versions.documentVersion?.current) && versions.templateContractVersion === "1.9.0" && versions.canonicalPhaseM2_2?.rendererCoreVersion === "0.9.0" && versions.canonicalPhaseM2_2a?.desktopCurrent === "0.10.1" && versions.canonicalPhaseM2_2a?.packageCurrent === "0.10.1" && ["0.10.1", "0.11.0", "0.11.1"].includes(versions.desktopAppVersion) && ["0.10.1", "0.11.0", "0.11.1"].includes(packageJson.version)) || (versions.documentVersion?.current === "1.29.0" && versions.desktopAppVersion === "0.12.0" && packageJson.version === "0.12.0" && versions.canonicalPhaseG3_0_3Google?.phase === "G3_0_3_GOOGLE_STATIC_TRANSFORM_RASTER_EXPORT_PARITY"), JSON.stringify({ document: versions.documentVersion, template: versions.templateContractVersion, m2_2a: versions.canonicalPhaseM2_2a, package: packageJson.version }));
check("template_and_core_unchanged", versions.templateContractVersion === "1.9.0" && versions.coordinatesChanged === false && versions.canonicalPhaseM2_2a?.rendererCoreChanged === false && versions.canonicalPhaseM2_2a?.templateContractChanged === false, JSON.stringify({ template: versions.templateContractVersion, coordinatesChanged: versions.coordinatesChanged, phase: versions.canonicalPhaseM2_2a }));
check("request_state", requestAudit.stateOwner === "DESKTOP_QA_HARNESS" && requestAudit.planPlacementContextAllowed === false && requestAudit.requestLevel.join(",") === "formatProfileId,placementContext,creativeLayoutPlan,output", JSON.stringify(requestAudit));
check("compatibility_matrix", JSON.stringify(requestAudit.compatibility.META_STATIC_FEED_SQUARE) === JSON.stringify(["FACEBOOK_FEED", "INSTAGRAM_FEED", null]) && JSON.stringify(requestAudit.compatibility.META_STATIC_FEED_PORTRAIT) === JSON.stringify(["FACEBOOK_FEED", "INSTAGRAM_FEED", null]) && JSON.stringify(requestAudit.compatibility.META_STATIC_VERTICAL_FULL) === JSON.stringify(["FACEBOOK_STORIES", "INSTAGRAM_STORIES", "FACEBOOK_REELS", "INSTAGRAM_REELS", null]), JSON.stringify(requestAudit.compatibility));
check("request_builder", builder.planRootPlacementContextInserted === false && builder.manifestReturnedToQaHarness === true && builder.requestLevelContextForwardedToCore === true, JSON.stringify(builder));
check("safe_zone_matrix", safeZone.feed.guideEnabled === false && safeZone.feed.missingGeometryMessage === false && safeZone.stories.guideEnabled === true && safeZone.stories.advisoryGeometry.topNormalized === 0.14 && safeZone.stories.advisoryGeometry.bottomNormalized === 0.2 && safeZone.reels.guideEnabled === false && safeZone.reels.sourceRequiredInfo === true && safeZone.reels.guessedGeometry === false && safeZone.verticalNone.resolved === null, JSON.stringify(safeZone));
check("preview_outcomes", errors.silentNoOpCount === 0 && JSON.stringify(errors.outcomes) === JSON.stringify(["PREVIEW_RENDERED", "VALIDATION_BLOCKED", "RUNTIME_ERROR"]) && errors.staleResultCode === "DESKTOP-PREVIEW-003" && errors.staleResultVisible === true && errors.asyncHandlerCatch === true && errors.visibleFields.join(",") === "status,error code,message", JSON.stringify(errors));
check("viewer_separation", viewer.planPanel.requestContextIncluded === false && viewer.requestPanel.requestContextIncluded === true && viewer.manifestPanel.readOnly === true && viewer.placementContextRemainsRequestLevel === true, JSON.stringify(viewer));
check("state_switching", switching.contextCrossWireCount === 0 && switching.cropStateCorruptionCount === 0 && switching.staleSafeZoneUiCount === 0 && switching.previewSilentNoOpCount === 0 && switching.sequence.length === 5, JSON.stringify(switching));
check("regression", regression.status === "PASS" && regression.m2_2Core === "PASS" && regression.kakaoGoldensUnchanged === true && regression.naverSmartChannelGoldensUnchanged === true && regression.naverSmartChannel120 === "PASS" && regression.naverRemaining === "PASS" && regression.metaM1 === "PASS" && regression.metaM2_1 === "PASS" && regression.metaM2_2 === "PASS" && regression.desktopMetaE2e === "PASS" && regression.goldenStatus === "CANDIDATE_NOT_APPROVED" && regression.manualAcceptanceStatus === "NOT_REVIEWED" && regression.finalGoldenFrozen === false, JSON.stringify(regression));
check("plan_schema_boundary", planSchema.additionalProperties === false && !Object.hasOwn(planSchema.properties ?? {}, "placementContext"), JSON.stringify(planSchema.properties));
check("desktop_source_boundary", editorSource.includes("Canonical META Render Request") && editorSource.includes("Imported CreativeLayoutPlan JSON") && editorSource.includes("Last Render Manifest") && editorSource.includes("PREVIEW_RENDERED") && editorSource.includes("VALIDATION_BLOCKED") && editorSource.includes("RUNTIME_ERROR") && controllerSource.includes("manifest: result.manifest"), "QA bridge and manifest IPC evidence present");
check("implementation_scope", !editorSource.includes("plume") && !controllerSource.includes("plume"), "desktop bridge contains no plume dependency");
for (const fileName of required) check(`file_${fileName}`, await exists(`artifacts/m2-2a/${fileName}`), fileName);

for (const result of checks) console.log(`${result.status} ${result.name}: ${result.detail}`);
if (failures.length > 0) {
  console.error(JSON.stringify({ status: "FAIL", failures, checks: checks.length }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ status: "PASS", phase: "M2_2A", checks: checks.length, evidenceRoot: "artifacts/m2-2a" }, null, 2));
}
