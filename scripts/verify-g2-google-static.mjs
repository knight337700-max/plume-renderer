import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import sharp from "sharp";

const argRoot = process.argv.find((arg) => arg.startsWith("--root="))?.slice("--root=".length);
const root = path.resolve(argRoot ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."));
const checks = [];
const failures = [];
const expectedObjectRightSha256 = "33204a082327bf14fead6dbc50fd2139f46f7f7156d14ac221c3212368927a3b";
const baselineCommit = "5456780dc2303a680c578d43e53f36333450d6c4";
const frozenDiagnosticCodes = [
  ["KBR-GOOGLE-ASSET-PROFILE-UNKNOWN", "ERROR"],
  ["KBR-GOOGLE-ASSET-CANVAS-MISMATCH", "ERROR"],
  ["KBR-GOOGLE-ASSET-MIME-UNSUPPORTED", "ERROR"],
  ["KBR-GOOGLE-ASSET-BYTES-EXCEEDED", "ERROR"],
  ["KBR-GOOGLE-SET-REQUIRED-ROLE-MISSING", "ERROR"],
  ["KBR-GOOGLE-SET-ROLE-CARDINALITY-EXCEEDED", "ERROR"],
  ["KBR-GOOGLE-TEXT-LIMIT-EXCEEDED", "ERROR"],
  ["KBR-GOOGLE-PMAX-BRAND-ASSOCIATION-MODE-MISMATCH", "ERROR"],
  ["KBR-GOOGLE-RDA-VERTICAL-SOURCE-DISCREPANCY", "INFO"],
  ["KBR-GOOGLE-DEMANDGEN-SAFE-ZONE-SOURCE-REQUIRED", "INFO"],
  ["KBR-GOOGLE-LIFECYCLE-TRANSITIONAL", "INFO"],
];

function check(id, condition, detail) {
  const status = condition ? "PASS" : "FAIL";
  checks.push({ id, status, detail });
  if (!condition) failures.push(id + ": " + detail);
}

async function exists(relativePath) {
  try { await stat(path.join(root, relativePath)); return true; } catch { return false; }
}

async function readJson(relativePath) {
  try { return JSON.parse(await readFile(path.join(root, relativePath), "utf8")); }
  catch (error) {
    check("json_" + relativePath, false, error instanceof Error ? error.message : String(error));
    return null;
  }
}

async function sha256(relativePath) {
  return createHash("sha256").update(await readFile(path.join(root, relativePath))).digest("hex");
}

function resultFromIssues(issues) {
  const errors = issues.filter((issue) => issue.severity === "ERROR");
  const warnings = issues.filter((issue) => issue.severity === "WARNING");
  const info = issues.filter((issue) => issue.severity === "INFO");
  return { status: errors.length > 0 ? "ERROR" : "PASS", errors, warnings, info };
}

function cloneArtifact(candidate, ordinal, overrides = {}) {
  return {
    artifactId: candidate.profileId + "-audit-" + ordinal,
    assetProfileId: candidate.profileId,
    role: candidate.assetRole,
    ordinal,
    width: candidate.canvas.width,
    height: candidate.canvas.height,
    mime: candidate.mime,
    bytes: candidate.encodedBytes,
    animation: false,
    ...(candidate.placementPolicy !== "NONE" ? { placementPolicy: candidate.placementPolicy } : {}),
    ...(candidate.placementPolicy === "NONE" ? { placementPlan: { explicitElementPlan: true } } : {}),
    ...overrides,
  };
}

function ordered(...assets) {
  return assets.map((asset, ordinal) => ({ ...asset, ordinal, artifactId: asset.artifactId + "-ordered-" + ordinal }));
}

function targetForCapability(capabilityId) {
  if (capabilityId === "GOOGLE_RDA_ASSET_SET") return "RDA";
  if (capabilityId === "GOOGLE_PMAX_ASSET_GROUP_STATIC") return "PMAX";
  if (capabilityId === "GOOGLE_DEMAND_GEN_SINGLE_IMAGE") return "DEMAND_GEN";
  return "DEMAND_GEN_UPLOADED_DISPLAY_STATIC";
}

function rdaFields() {
  return { SHORT_HEADLINE: ["Short"], LONG_HEADLINE: ["Long"], DESCRIPTION: ["Description"], BUSINESS_NAME: ["Business"] };
}

function pmaxFields(associationLevel = "CampaignAsset") {
  return { HEADLINE: ["One", "Two", "Three"], LONG_HEADLINE: ["Long"], DESCRIPTION: ["Description", "Second"], BUSINESS_NAME: ["Business"], PMAX_ASSOCIATION_LEVEL: associationLevel };
}

function demandGenFields() {
  return { HEADLINE: ["Headline"], DESCRIPTION: ["Description"], BUSINESS_NAME: ["Business"] };
}

const packageJson = await readJson("package.json");
const versions = await readJson("contracts/contract-versions.json");
const g3Implemented = versions?.canonicalPhaseG3Google?.phase === "G3_GOOGLE_STATIC_DESKTOP_QA_ENABLEMENT" && versions?.canonicalPhaseG3Google?.desktopUiAdded === true;
const architecture = await readJson("contracts/google/architecture-freeze.g0.1.json");
const diagnostics = await readJson("contracts/google/diagnostics.g1.json");
const profiles = await readJson("contracts/google/static-asset-profiles.g1.json");
const registry = await readJson("contracts/google/golden-candidates.g2.json");
const evidence = await readJson("artifacts/g2/google-static-rendering-validation-verification.json");
const deliveryEvidence = await readJson("artifacts/g2/google-static-delivery-validation.json");
const globalErrors = await readJson("contracts/error-registry.json");
const contractText = await readFile(path.join(root, "docs/kakao-bizboard-renderer-spec-v1.md"), "utf8").catch(() => "");

let core = null;
try {
  core = await import(pathToFileURL(path.join(root, "dist", "core", "index.js")).href);
} catch (error) {
  check("core_runtime_import", false, error instanceof Error ? error.message : String(error));
}

let contracts = null;
if (core) {
  try { contracts = await core.loadGoogleStaticContracts(root); }
  catch (error) { check("g1_contract_runtime_load", false, error instanceof Error ? error.message : String(error)); }
}

let lineage = true;
try { execFileSync("git", ["merge-base", "--is-ancestor", baselineCommit, "HEAD"], { cwd: root, stdio: "ignore" }); }
catch { lineage = false; }
check("precheck_baseline_lineage", lineage, baselineCommit);
check("g1_completion_gate", evidence?.g1CompletionGate?.status === "PASS" && evidence?.status === "PASS", JSON.stringify(evidence?.g1CompletionGate));
check("diagnostic_frozen_count", diagnostics?.count === 11 && diagnostics?.codes?.length === 11, JSON.stringify({ count: diagnostics?.count }));
check("architecture_frozen", architecture?.status === "FROZEN" && architecture?.googleArchitectureVersion === "1.0.0", JSON.stringify({ status: architecture?.status, version: architecture?.googleArchitectureVersion }));
check("runtime_profile_count", profiles?.profileCount === 14 && profiles?.geometryProfiles?.length === 7 && profiles?.uploadedDisplayStaticProfiles?.length === 7 && profiles?.legacyDisplayRuntimeProfiles?.length === 0, JSON.stringify({ profileCount: profiles?.profileCount }));
check("candidate_registry_status", registry?.status === "CANDIDATE" && registry?.frozen === false && registry?.visualAcceptance === "PENDING", JSON.stringify({ status: registry?.status, frozen: registry?.frozen, visualAcceptance: registry?.visualAcceptance }));
check("candidate_counts", registry?.candidateCount === 14 && registry?.geometryCandidateCount === 7 && registry?.demandGenUploadedStaticCandidateCount === 7, JSON.stringify({ total: registry?.candidateCount }));
const frozenProfileOrder = [...(profiles?.geometryProfiles ?? []), ...(profiles?.uploadedDisplayStaticProfiles ?? [])].map((profile) => profile.profileId);
check("candidate_order", JSON.stringify(registry?.candidates?.map((candidate) => candidate.profileId)) === JSON.stringify(frozenProfileOrder), "candidate order follows frozen profile order");

const candidateByProfile = new Map((registry?.candidates ?? []).map((candidate) => [candidate.profileId, candidate]));
const gateCases = {};
if (core && contracts && registry?.candidates?.length === 14) {
  const land = cloneArtifact(candidateByProfile.get("GOOGLE_MARKETING_LANDSCAPE_1_91"), 0);
  const square = cloneArtifact(candidateByProfile.get("GOOGLE_MARKETING_SQUARE_1_1"), 1);
  const rdaVertical = cloneArtifact(candidateByProfile.get("GOOGLE_RDA_VERTICAL_9_16"), 2);
  const dgVertical = cloneArtifact(candidateByProfile.get("GOOGLE_DEMAND_GEN_VERTICAL_9_16"), 2);
  const uploaded = cloneArtifact(candidateByProfile.get("GOOGLE_DG_UPLOAD_300X250"), 0);
  gateCases.unknown_profile = resultFromIssues(core.validateGoogleStaticArtifact({ ...uploaded, assetProfileId: "UNKNOWN_PROFILE" }, contracts));
  gateCases.wrong_canvas = resultFromIssues(core.validateGoogleStaticArtifact({ ...uploaded, width: uploaded.width + 1 }, contracts));
  gateCases.unsupported_mime = resultFromIssues(core.validateGoogleStaticArtifact({ ...uploaded, mime: "image/gif" }, contracts));
  gateCases.bytes_exceeded = resultFromIssues(core.validateGoogleStaticArtifact({ ...uploaded, bytes: 150001 }, contracts, { target: "DEMAND_GEN_UPLOADED_DISPLAY_STATIC" }));
  gateCases.required_role_missing = core.validateGoogleRdaDeliverySet({ schemaVersion: "1.0.0", capabilityId: "GOOGLE_RDA_ASSET_SET", lifecycleSnapshot: "TRANSITIONAL", assets: ordered(land), platformFields: rdaFields() }, contracts);
  gateCases.cardinality_exceeded = core.validateGoogleRdaDeliverySet({ schemaVersion: "1.0.0", capabilityId: "GOOGLE_RDA_ASSET_SET", lifecycleSnapshot: "TRANSITIONAL", assets: ordered(...Array.from({ length: 16 }, (_, ordinal) => cloneArtifact(candidateByProfile.get("GOOGLE_MARKETING_LANDSCAPE_1_91"), ordinal)), square), platformFields: rdaFields() }, contracts);
  gateCases.text_limit_exceeded = core.validateGoogleRdaDeliverySet({ schemaVersion: "1.0.0", capabilityId: "GOOGLE_RDA_ASSET_SET", lifecycleSnapshot: "TRANSITIONAL", assets: ordered(land, square), platformFields: { ...rdaFields(), SHORT_HEADLINE: ["x".repeat(31)] } }, contracts);
  gateCases.pmax_mode_mismatch = core.validateGooglePerformanceMaxDeliverySet({ schemaVersion: "1.0.0", capabilityId: "GOOGLE_PMAX_ASSET_GROUP_STATIC", lifecycleSnapshot: "ACTIVE", brandGuidelinesEnabled: true, assets: ordered(land, square), platformFields: pmaxFields("AssetGroupAsset") }, contracts);
  gateCases.rda_vertical_info = core.validateGoogleRdaDeliverySet({ schemaVersion: "1.0.0", capabilityId: "GOOGLE_RDA_ASSET_SET", lifecycleSnapshot: "TRANSITIONAL", assets: ordered(land, square, rdaVertical), platformFields: rdaFields() }, contracts);
  gateCases.demandgen_safe_zone_info = core.validateGoogleDemandGenSingleImageDeliverySet({ schemaVersion: "1.0.0", capabilityId: "GOOGLE_DEMAND_GEN_SINGLE_IMAGE", lifecycleSnapshot: "ACTIVE_EVOLVING", assets: ordered(land, square, dgVertical, cloneArtifact(candidateByProfile.get("GOOGLE_LOGO_SQUARE_1_1"), 3)), platformFields: demandGenFields() }, contracts);
  gateCases.lifecycle_transitional = core.validateGoogleCreativeAssetSetManifest({ schemaVersion: "1.0.0", capabilityId: "GOOGLE_LEGACY_UPLOADED_DISPLAY_STATIC", lifecycleSnapshot: "TRANSITIONAL", assets: [uploaded] }, contracts);
}
const expectedGateCodes = {
  unknown_profile: "KBR-GOOGLE-ASSET-PROFILE-UNKNOWN",
  wrong_canvas: "KBR-GOOGLE-ASSET-CANVAS-MISMATCH",
  unsupported_mime: "KBR-GOOGLE-ASSET-MIME-UNSUPPORTED",
  bytes_exceeded: "KBR-GOOGLE-ASSET-BYTES-EXCEEDED",
  required_role_missing: "KBR-GOOGLE-SET-REQUIRED-ROLE-MISSING",
  cardinality_exceeded: "KBR-GOOGLE-SET-ROLE-CARDINALITY-EXCEEDED",
  text_limit_exceeded: "KBR-GOOGLE-TEXT-LIMIT-EXCEEDED",
  pmax_mode_mismatch: "KBR-GOOGLE-PMAX-BRAND-ASSOCIATION-MODE-MISMATCH",
  rda_vertical_info: "KBR-GOOGLE-RDA-VERTICAL-SOURCE-DISCREPANCY",
  demandgen_safe_zone_info: "KBR-GOOGLE-DEMANDGEN-SAFE-ZONE-SOURCE-REQUIRED",
  lifecycle_transitional: "KBR-GOOGLE-LIFECYCLE-TRANSITIONAL",
};
for (const [name, expectedCode] of Object.entries(expectedGateCodes)) {
  const result = gateCases[name];
  const issues = result ? [...result.errors, ...result.warnings, ...result.info] : [];
  const emitted = issues.find((issue) => issue.code === expectedCode);
  const definition = diagnostics?.codes?.find((entry) => entry.code === expectedCode);
  check("diagnostic_emission_" + name, Boolean(emitted) && Boolean(definition) && emitted.severity === definition.severity && emitted.messageKey === definition.messageKey, JSON.stringify({ expectedCode, emitted: emitted ? { severity: emitted.severity, messageKey: emitted.messageKey } : null }));
}
const emittedIssues = Object.values(gateCases).flatMap((result) => [...result.errors, ...result.warnings, ...result.info]);
check("diagnostic_unknown_code_not_silent", emittedIssues.every((issue) => diagnostics?.codes?.some((entry) => entry.code === issue.code)), "all emitted Gate A codes resolve in frozen registry");
check("diagnostic_info_non_blocking", [gateCases.rda_vertical_info, gateCases.demandgen_safe_zone_info, gateCases.lifecycle_transitional].every((result) => result?.status === "PASS"), JSON.stringify({ rda: gateCases.rda_vertical_info?.status, demandGen: gateCases.demandgen_safe_zone_info?.status, lifecycle: gateCases.lifecycle_transitional?.status }));
check("diagnostic_error_blocking", [gateCases.unknown_profile, gateCases.bytes_exceeded, gateCases.required_role_missing, gateCases.text_limit_exceeded, gateCases.pmax_mode_mismatch].every((result) => result?.status === "ERROR"), "ERROR diagnostics produce ERROR validation status");
check("diagnostic_global_registry_deferred", g3Implemented ? JSON.stringify(globalErrors ?? {}).includes("KBR-GOOGLE-") : !JSON.stringify(globalErrors ?? {}).includes("KBR-GOOGLE-"), g3Implemented ? "G3 Google diagnostics are active global Error Registry entries" : "Google diagnostics are not active global Error Registry entries");
check("g1_completion_invariants", evidence?.g1CompletionGate?.objectRightSha256 === expectedObjectRightSha256 && evidence?.g1CompletionGate?.frozenChannelsOutputChanges === 0 && evidence?.g1CompletionGate?.runtimeNetworkRequests === 0 && Array.isArray(evidence?.g1CompletionGate?.plumeDependencies ?? []), JSON.stringify(evidence?.g1CompletionGate));

for (const candidate of registry?.candidates ?? []) {
  const profile = [...(profiles?.geometryProfiles ?? []), ...(profiles?.uploadedDisplayStaticProfiles ?? [])].find((entry) => entry.profileId === candidate.profileId);
  const artifactPath = candidate.artifactRelativePath;
  const sourcePath = candidate.sourceFixtureRelativePath;
  const planPath = candidate.layoutPlanRelativePath;
  const artifactExists = await exists(artifactPath);
  const sourceExists = await exists(sourcePath);
  const planExists = await exists(planPath);
  check("candidate_exists_" + candidate.profileId, artifactExists && sourceExists && planExists, JSON.stringify({ artifactExists, sourceExists, planExists }));
  if (!artifactExists || !sourceExists || !planExists || !profile || !core || !contracts) continue;
  const artifactBytes = await readFile(path.join(root, artifactPath));
  const sourceBytes = await readFile(path.join(root, sourcePath));
  const plan = await readJson(planPath);
  const artifactDigest = createHash("sha256").update(artifactBytes).digest("hex");
  const sourceDigest = createHash("sha256").update(sourceBytes).digest("hex");
  const planDigest = createHash("sha256").update(await readFile(path.join(root, planPath))).digest("hex");
  const metadata = await sharp(artifactBytes, { failOn: "error" }).metadata();
  check("candidate_canvas_" + candidate.profileId, candidate.canvas.width === profile.projectOutputPreset.width && candidate.canvas.height === profile.projectOutputPreset.height && metadata.width === profile.projectOutputPreset.width && metadata.height === profile.projectOutputPreset.height, JSON.stringify({ expected: profile.projectOutputPreset, actual: { width: metadata.width, height: metadata.height } }));
  check("candidate_mime_" + candidate.profileId, (candidate.mime === "image/png" && metadata.format === "png") || (candidate.mime === "image/jpeg" && metadata.format === "jpeg"), JSON.stringify({ candidate: candidate.mime, actual: metadata.format }));
  check("candidate_hash_" + candidate.profileId, artifactDigest === candidate.artifactSha256 && artifactBytes.byteLength === candidate.encodedBytes && sourceDigest === candidate.sourceFixtureSha256 && planDigest === candidate.layoutPlanSha256, JSON.stringify({ artifact: artifactDigest, registry: candidate.artifactSha256, bytes: artifactBytes.byteLength }));
  const capCheck = candidate.capabilityContexts.every((capabilityId) => {
    const max = profile.maxBytesByTarget[targetForCapability(capabilityId)];
    return max === undefined || candidate.encodedBytes <= max;
  });
  check("candidate_byte_cap_" + candidate.profileId, capCheck, JSON.stringify(candidate.projectMaxBytesByTarget));
  const rerender = await core.renderGoogleStaticCandidate(sourceBytes, plan, contracts);
  check("candidate_repeat_" + candidate.profileId, Buffer.compare(rerender.bytes, artifactBytes) === 0 && rerender.renderFingerprint === candidate.renderFingerprint && createHash("sha256").update(rerender.bytes).digest("hex") === candidate.artifactSha256, candidate.renderFingerprint);
  const artifactValidation = candidate.capabilityContexts.map((capabilityId) => {
    const issueList = core.validateGoogleStaticArtifact({ artifactId: candidate.profileId + "-verification", assetProfileId: candidate.profileId, role: candidate.assetRole, ordinal: 0, width: candidate.canvas.width, height: candidate.canvas.height, mime: candidate.mime, bytes: candidate.encodedBytes, animation: false, ...(candidate.placementPolicy !== "NONE" ? { placementPolicy: candidate.placementPolicy } : {}) }, contracts, { target: targetForCapability(capabilityId) });
    return { capabilityId, issueList };
  });
  check("candidate_profile_validation_" + candidate.profileId, artifactValidation.every((entry) => entry.issueList.length === 0), JSON.stringify(artifactValidation.map((entry) => ({ capabilityId: entry.capabilityId, codes: entry.issueList.map((issue) => issue.code) }))));
}

check("expected_info_diagnostics", deliveryEvidence?.scenarios?.some((scenario) => scenario.name === "rda.valid_with_optional_vertical_info" && scenario.info.includes("KBR-GOOGLE-RDA-VERTICAL-SOURCE-DISCREPANCY")) && deliveryEvidence?.scenarios?.some((scenario) => scenario.name === "demand_gen.valid_with_vertical_info" && scenario.info.includes("KBR-GOOGLE-DEMANDGEN-SAFE-ZONE-SOURCE-REQUIRED")), "RDA and Demand Gen vertical INFO diagnostics are present");
check("delivery_scenarios", deliveryEvidence?.status === "PASS" && deliveryEvidence?.scenarios?.length >= 30 && deliveryEvidence?.scenarios?.every((scenario) => scenario.passed === true), JSON.stringify({ status: deliveryEvidence?.status, scenarios: deliveryEvidence?.scenarios?.length }));
check("negative_placement_scenarios", deliveryEvidence?.negativePlacementCases?.length >= 5 && deliveryEvidence?.negativePlacementCases?.every((scenario) => scenario.passed === true && scenario.publishAllowed === false), JSON.stringify(deliveryEvidence?.negativePlacementCases));
check("error_publish_blocked", deliveryEvidence?.errorArtifactPublishAllowed === false, String(deliveryEvidence?.errorArtifactPublishAllowed));
check("platform_field_rasterization_absent", deliveryEvidence?.platformFieldRasterizationAbsent === true && evidence?.renderingValidation?.platformFieldRasterizationAbsent === true, "platform fields remain metadata-only");
const previewHtml = await readFile(path.join(root, "artifacts/g2/google-static-candidate-index.html"), "utf8").catch(() => "");
check("preview_index", previewHtml.includes("GOOGLE_MARKETING_LANDSCAPE_1_91") && (previewHtml.match(/<article>/g) ?? []).length === 14, "14 candidate previews are indexed");
check("legacy_display_runtime_zero", profiles?.legacyDisplayRuntimeProfiles?.length === 0 && !(registry?.candidates ?? []).some((candidate) => candidate.profileId.includes("LEGACY")), "legacy Display runtime is not active");
check("google_upload_absent", !(await exists("src/core/google-upload")) && !(await exists("apps/desktop/electron-main/google-upload")) && !JSON.stringify(packageJson?.dependencies ?? {}).toLowerCase().includes("googleapis"), "Google Ads upload integration is absent");
check("desktop_google_ui_absent", g3Implemented ? await exists("apps/desktop/renderer-ui/src/features/google/GoogleStaticEditor.tsx") : !(await exists("apps/desktop/renderer-ui/src/google")), g3Implemented ? "G3 Google UI is additive and present" : "Desktop Google UI is absent");
check("google_frozen_golden_scope", !(await exists("contracts/google/goldens.g1.json")) && (await exists("contracts/google/goldens.g2.1.json")) && (await exists("fixtures/golden/google")), "G2 candidates remain historical while G2.1 owns the additive frozen Google Golden scope");
const renderSource = await readFile(path.join(root, "src/core/google-static-render.ts"), "utf8").catch(() => "");
check("plume_absent", !JSON.stringify(packageJson ?? {}).toLowerCase().includes("plume") && !renderSource.toLowerCase().includes("plume"), "no Plume dependency");
let frozenDiff = "";
try {
  const rawFrozenDiff = execFileSync("git", ["diff", "--name-only", baselineCommit, "HEAD", "--", "fixtures/golden", "contracts/goldens", "artifacts/n7-8", "artifacts/n8", "artifacts/m2-3"], { cwd: root, encoding: "utf8" }).trim();
  frozenDiff = rawFrozenDiff.split(/\r?\n/).filter((entry) => entry && !entry.replaceAll("\\", "/").startsWith("fixtures/golden/google/")).join("\n");
}
catch { frozenDiff = "ERROR"; }
check("frozen_channels_output_changes", frozenDiff === "", frozenDiff || "0 frozen output files changed");
check("object_right_sha256", await sha256("reference/kakao-tool/OBJECT_RIGHT.png") === expectedObjectRightSha256, expectedObjectRightSha256);
check("handoff_phase_text", contractText.includes("G2_GOOGLE_STATIC_RENDERING_VALIDATION_AND_GOLDEN_CANDIDATES") && contractText.includes("golden candidates"), "canonical G2 section is present");
check("g2_evidence_registry_consistency", evidence?.registry === "contracts/google/golden-candidates.g2.json" && evidence?.candidates?.total === 14 && evidence?.architecture?.version === "1.0.0", JSON.stringify(evidence));

for (const result of checks) console.log(result.status + " " + result.id + ": " + result.detail);
const status = failures.length === 0 ? "PASS" : "FAIL";
console.log(JSON.stringify({ status, checks: checks.length, passed: checks.filter((entry) => entry.status === "PASS").length, failed: failures, root }, null, 2));
if (status !== "PASS") process.exitCode = 1;
