import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const checks = [];
const failures = [];
const expectedObjectRightSha256 = "33204a082327bf14fead6dbc50fd2139f46f7f7156d14ac221c3212368927a3b";
const baseline = "ef807153c1143966a3f6d83bf01704bf1d2ad206";
const g0Codes = [
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
  if (!condition) failures.push(`${id}: ${detail}`);
}

async function json(relativePath) {
  try { return JSON.parse(await readFile(path.join(root, relativePath), "utf8")); }
  catch (error) { check(`json_${relativePath}`, false, error instanceof Error ? error.message : String(error)); return null; }
}

async function exists(relativePath) {
  try { await stat(path.join(root, relativePath)); return true; } catch { return false; }
}

async function sha256(relativePath) {
  return createHash("sha256").update(await readFile(path.join(root, relativePath))).digest("hex");
}

const versions = await json("contracts/contract-versions.json");
const g2Implemented = versions?.canonicalPhaseG2Google?.phase === "G2_GOOGLE_STATIC_RENDERING_VALIDATION_AND_GOLDEN_CANDIDATES" && versions?.canonicalPhaseG2Google?.renderingValidationImplemented === true;
const g2_1Implemented = versions?.canonicalPhaseG2_1Google?.phase === "G2_1_GOOGLE_STATIC_USER_VISUAL_ACCEPTANCE_AND_GOLDEN_FREEZE" && versions?.canonicalPhaseG2_1Google?.visualAcceptance === "ACCEPTED";
const g3_0_3Implemented = versions?.canonicalPhaseG3_0_3Google?.phase === "G3_0_3_GOOGLE_STATIC_TRANSFORM_RASTER_EXPORT_PARITY";
const g3Implemented = g3_0_3Implemented || (versions?.canonicalPhaseG3Google?.phase === "G3_GOOGLE_STATIC_DESKTOP_QA_ENABLEMENT" && versions?.canonicalPhaseG3Google?.desktopUiAdded === true);
const g3RevisionImplemented = !g3_0_3Implemented && versions?.canonicalPhaseG3_0_2Google?.phase === "G3_0_2_GOOGLE_STATIC_DESKTOP_QA_REVISION";
const freeze = await json("contracts/google/architecture-freeze.g0.1.json");
const architecture = await json("contracts/google/architecture.g0.json");
const capabilities = await json("contracts/google/capabilities.g0.json");
const geometry = await json("contracts/google/asset-geometry.g0.json");
const delivery = await json("contracts/google/delivery-contracts.g0.json");
const diagnostics0 = await json("contracts/google/diagnostics.g0.json");
const profiles = await json("contracts/google/static-asset-profiles.g1.json");
const mapping = await json("contracts/google/capability-asset-role-mapping.g1.json");
const constraints = await json("contracts/google/target-constraints.g1.json");
const manifestSchema = await json("contracts/google/creative-asset-set-manifest.schema.json");
const deliveryValidator = await json("contracts/google/delivery-set-validator.g1.json");
const diagnostics = await json("contracts/google/diagnostics.g1.json");
const packageJson = await json("package.json");
const canonical = await readFile(path.join(root, "docs/kakao-bizboard-renderer-spec-v1.md"), "utf8").catch(() => "");

let lineage = true;
try { execFileSync("git", ["merge-base", "--is-ancestor", baseline, "HEAD"], { cwd: root, stdio: "ignore" }); }
catch { lineage = false; }
check("baseline_lineage", lineage, baseline);
check("canonical_version", (g3_0_3Implemented && versions?.documentVersion?.previous === "1.28.1" && versions?.documentVersion?.current === "1.29.0" && versions?.documentVersion?.bump === "minor") || (g3RevisionImplemented && versions?.documentVersion?.previous === "1.28.0" && versions?.documentVersion?.current === "1.28.1" && versions?.documentVersion?.bump === "patch") || (g3Implemented && versions?.documentVersion?.previous === "1.27.0" && versions?.documentVersion?.current === "1.28.0" && versions?.documentVersion?.bump === "minor") || (g2_1Implemented && versions?.documentVersion?.previous === "1.26.0" && versions?.documentVersion?.current === "1.27.0" && versions?.documentVersion?.bump === "minor" && /Document version:\*\* 1\.27\.0/u.test(canonical)) || (!g2_1Implemented && g2Implemented && versions?.documentVersion?.previous === "1.25.0" && versions?.documentVersion?.current === "1.26.0" && versions?.documentVersion?.bump === "minor" && /Document version:\*\* 1\.26\.0/u.test(canonical)) || (!g2Implemented && versions?.documentVersion?.previous === "1.24.0" && versions?.documentVersion?.current === "1.25.0" && versions?.documentVersion?.bump === "minor" && /Document version:\*\* 1\.25\.0/u.test(canonical)), JSON.stringify(versions?.documentVersion));
check("architecture_preserved", versions?.canonicalPhaseG1Google?.googleArchitecturePrevious === "1.0.0" && versions?.canonicalPhaseG1Google?.googleArchitectureVersion === "1.0.0" && versions?.canonicalPhaseG1Google?.googleArchitectureBump === "none" && freeze?.status === "FROZEN" && freeze?.googleArchitectureVersion === "1.0.0", JSON.stringify(versions?.canonicalPhaseG1Google));
check("g1_phase", versions?.canonicalPhaseG1Google?.phase === "G1_GOOGLE_STATIC_CONTRACTS_AND_PROFILE_IMPLEMENTATION" && versions?.canonicalPhaseG1Google?.contractsImplemented === true && versions?.canonicalPhaseG1Google?.profileResolutionImplemented === true && versions?.canonicalPhaseG1Google?.deliveryValidatorsImplemented === true, JSON.stringify(versions?.canonicalPhaseG1Google));
check("frozen_architecture_counts", architecture?.architectureStatus === "FROZEN" && capabilities?.capabilities?.length === 7 && geometry?.profiles?.length === 7 && geometry?.uploadedDisplayPresets?.demandGenRecommendedSubset?.length === 7 && geometry?.uploadedDisplayPresets?.legacyDisplaySupportedCanvases?.length === 20 && freeze?.counts?.capabilities === 7 && freeze?.counts?.demandGenUploadedPresets === 7 && freeze?.counts?.legacyDisplayCanvases === 20 && freeze?.counts?.unresolvedRules === 9 && freeze?.counts?.diagnostics === 11, JSON.stringify(freeze?.counts));
check("g1_profile_counts", profiles?.status === "IMPLEMENTED" && profiles?.googleArchitectureVersion === "1.0.0" && profiles?.profileCount === 14 && profiles?.geometryProfiles?.length === 7 && profiles?.uploadedDisplayStaticProfiles?.length === 7 && profiles?.legacyDisplayRuntimeProfiles?.length === 0 && mapping?.capabilityCount === 7 && mapping?.capabilities?.length === 7, JSON.stringify({ profileCount: profiles?.profileCount, capabilities: mapping?.capabilityCount }));
check("g1_profile_order", JSON.stringify(profiles?.geometryProfiles?.map((entry) => entry.profileId)) === JSON.stringify(["GOOGLE_MARKETING_LANDSCAPE_1_91", "GOOGLE_MARKETING_SQUARE_1_1", "GOOGLE_MARKETING_PORTRAIT_4_5", "GOOGLE_RDA_VERTICAL_9_16", "GOOGLE_DEMAND_GEN_VERTICAL_9_16", "GOOGLE_LOGO_SQUARE_1_1", "GOOGLE_LOGO_LANDSCAPE_4_1"]) && JSON.stringify(profiles?.uploadedDisplayStaticProfiles?.map((entry) => entry.profileId)) === JSON.stringify(["GOOGLE_DG_UPLOAD_300X250", "GOOGLE_DG_UPLOAD_336X280", "GOOGLE_DG_UPLOAD_728X90", "GOOGLE_DG_UPLOAD_970X90", "GOOGLE_DG_UPLOAD_160X600", "GOOGLE_DG_UPLOAD_300X600", "GOOGLE_DG_UPLOAD_320X50"]), "deterministic registry order");
const allProfiles = [...(profiles?.geometryProfiles ?? []), ...(profiles?.uploadedDisplayStaticProfiles ?? [])];
check("profile_invariants", allProfiles.every((entry) => entry.layoutMode === "FREEFORM" && entry.artifactCardinality === "SINGLE" && entry.deliveryCardinality === "COLLECTION" && entry.compositionMode === (entry.role === "UPLOADED_DISPLAY_STATIC" ? "RENDERER_COMPOSED" : "PLATFORM_COMPOSED") && Array.isArray(entry.targetIds) && entry.targetIds.length > 0 && Array.isArray(entry.sourceRuleIds) && Array.isArray(entry.allowedPlacementPolicies) && typeof entry.projectOutputPreset?.width === "number" && typeof entry.projectOutputPreset?.height === "number"), "FREEFORM/SINGLE/COLLECTION profiles with explicit composition axes, source rules, and presets");
check("exact_geometry_presets", JSON.stringify(profiles?.geometryProfiles?.map((entry) => [entry.profileId, entry.projectOutputPreset?.width, entry.projectOutputPreset?.height])) === JSON.stringify([["GOOGLE_MARKETING_LANDSCAPE_1_91", 1200, 628], ["GOOGLE_MARKETING_SQUARE_1_1", 1200, 1200], ["GOOGLE_MARKETING_PORTRAIT_4_5", 960, 1200], ["GOOGLE_RDA_VERTICAL_9_16", 900, 1600], ["GOOGLE_DEMAND_GEN_VERTICAL_9_16", 1080, 1920], ["GOOGLE_LOGO_SQUARE_1_1", 1200, 1200], ["GOOGLE_LOGO_LANDSCAPE_4_1", 1200, 300]]), "seven geometry project presets");
check("placement_policy", JSON.stringify(profiles?.placementPolicyDefaults?.marketingImage?.allowed) === JSON.stringify(["CENTER_CONTAIN", "MANUAL_CROP", "SEMANTIC_CROP_COVER"]) && profiles?.placementPolicyDefaults?.marketingImage?.default === "CENTER_CONTAIN" && JSON.stringify(profiles?.placementPolicyDefaults?.logo?.allowed) === JSON.stringify(["CENTER_CONTAIN", "ALPHA_TRIM_CONTAIN"]) && profiles?.placementPolicyDefaults?.logo?.default === "ALPHA_TRIM_CONTAIN" && profiles?.placementPolicyDefaults?.uploadedStatic?.default === "NONE" && profiles?.placementPolicyDefaults?.uploadedStatic?.requiresElementPlan === true, "approved placement policy matrix");
check("mime_and_bytes", JSON.stringify(profiles?.rendererOutputMime) === JSON.stringify(["image/png", "image/jpeg"]) && constraints?.byteUnit === "decimal-byte" && constraints?.constraints?.some((entry) => entry.targetId === "RDA" && entry.maxBytes === 5120000) && constraints?.constraints?.some((entry) => entry.targetId === "PMAX" && entry.maxBytes === 5120000) && constraints?.constraints?.some((entry) => entry.targetId === "DEMAND_GEN" && entry.maxBytes === 5000000) && constraints?.constraints?.some((entry) => entry.targetId === "DEMAND_GEN" && entry.roles?.includes("LOGO") && entry.maxBytes === 150000) && constraints?.constraints?.some((entry) => entry.targetId === "DEMAND_GEN_UPLOADED_DISPLAY_STATIC" && entry.maxBytes === 150000), JSON.stringify(constraints));
check("composition_boundary", profiles?.platformTextRasterization === false && mapping?.compositionBoundary?.legacyRuntimeProfiles === 0 && mapping?.compositionBoundary?.platformComposedProfiles?.length === 3 && mapping?.compositionBoundary?.rendererComposedProfiles?.length === 1, JSON.stringify(mapping?.compositionBoundary));
check("manifest_contract", manifestSchema?.$id && manifestSchema?.required?.includes("capabilityId") && manifestSchema?.required?.includes("lifecycleSnapshot") && manifestSchema?.required?.includes("assets") && manifestSchema?.properties?.platformFields?.type === "object" && manifestSchema?.$defs?.asset?.required?.includes("ordinal"), manifestSchema?.$id ?? "missing");
check("delivery_validator_contract", deliveryValidator?.status === "IMPLEMENTED" && deliveryValidator?.platformComposedTextIsNotRasterInput === true && deliveryValidator?.validators?.length === 4 && deliveryValidator?.pmaxBrandAssociationModes?.length === 2, JSON.stringify(deliveryValidator));
check("diagnostics_frozen", diagnostics?.status === "IMPLEMENTED" && diagnostics?.count === 11 && diagnostics?.codes?.length === 11 && JSON.stringify(diagnostics?.codes?.map((entry) => [entry.code, entry.severity])) === JSON.stringify(g0Codes) && diagnostics0?.codes?.length === 11, JSON.stringify(diagnostics?.codes?.map((entry) => [entry.code, entry.severity])));
check("runtime_scope", !(await exists("apps/desktop/renderer-ui/src/google")) && (g2_1Implemented || !(await exists("fixtures/golden/google"))) && !(await exists("apps/desktop/electron-main/google-upload")) && !(await exists("src/core/google-upload")) && !(await exists("contracts/google/goldens.g1.json")), "no Desktop/upload runtime scope; G2.1 frozen Goldens are additive");
const freeformProfilesText = await readFile(path.join(root, "contracts/freeform-format-profiles.json"), "utf8").catch(() => "");
check("registry_isolated", !/GOOGLE_/u.test(freeformProfilesText), "Google registry is separate from legacy generic profile registry");
check("no_prohibited_dependencies", !JSON.stringify(packageJson?.dependencies ?? {}).toLowerCase().includes("plume") && !JSON.stringify(packageJson?.dependencies ?? {}).toLowerCase().includes("railway") && !JSON.stringify(packageJson?.scripts ?? {}).toLowerCase().includes("google upload"), "no Plume or upload dependency");
check("object_right_fixture", await sha256("reference/kakao-tool/OBJECT_RIGHT.png") === expectedObjectRightSha256, expectedObjectRightSha256);
const authoritative = freeze?.authoritativeRecords ?? [];
const authoritativeHashes = await Promise.all(authoritative.map(async (record) => ({ path: record.path, expected: record.sha256, actual: await sha256(record.path).catch(() => null) })));
check("frozen_record_hashes", authoritativeHashes.every((record) => record.expected === record.actual), JSON.stringify(authoritativeHashes));
check("package_script", packageJson?.scripts?.["verify:g1-google"] === "node scripts/verify-g1-google-static.mjs" && packageJson?.scripts?.check?.includes("pnpm verify:g1-google"), "G1 verifier registered");
check("canonical_scope_text", canonical.includes("## 55. Phase G1") && canonical.includes("G2_GOOGLE_STATIC_RENDERING_VALIDATION_AND_GOLDEN_CANDIDATES") && canonical.includes("platformFields") && canonical.includes("5,120,000"), "canonical G1 contract section");

for (const result of checks) console.log(`${result.status} ${result.id}: ${result.detail}`);
const status = failures.length === 0 ? "PASS" : "FAIL";
console.log(JSON.stringify({ status, checks: checks.length, passed: checks.filter((entry) => entry.status === "PASS").length, failed: failures }, null, 2));
if (status !== "PASS") process.exitCode = 1;
