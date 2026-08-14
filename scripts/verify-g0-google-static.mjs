import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const baseline = "be0c4198e5f1d4b433f9654409021db34710e29c";
const expectedObjectRightSha256 = "33204a082327bf14fead6dbc50fd2139f46f7f7156d14ac221c3212368927a3b";
const checks = [];
const failures = [];

function check(id, condition, detail) {
  const status = condition ? "PASS" : "FAIL";
  checks.push({ id, status, detail });
  if (!condition) failures.push(`${id}: ${detail}`);
}

async function readJson(relativePath) {
  try {
    return JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
  } catch (error) {
    check(`json_${relativePath}`, false, error instanceof Error ? error.message : String(error));
    return null;
  }
}

async function exists(relativePath) {
  try {
    await stat(path.join(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function sha256(relativePath) {
  return createHash("sha256").update(await readFile(path.join(root, relativePath))).digest("hex");
}

async function collectFiles(relativePath) {
  const absolute = path.join(root, relativePath);
  let entries;
  try { entries = await readdir(absolute, { withFileTypes: true }); } catch { return []; }
  const files = [];
  for (const entry of entries) {
    const child = path.join(relativePath, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(child));
    else if (entry.isFile()) files.push(child.replaceAll("\\", "/"));
  }
  return files;
}

const architecture = await readJson("contracts/google/architecture.g0.json");
const capabilities = await readJson("contracts/google/capabilities.g0.json");
const geometry = await readJson("contracts/google/asset-geometry.g0.json");
const delivery = await readJson("contracts/google/delivery-contracts.g0.json");
const provenance = await readJson("contracts/google/provenance.g0.json");
const diagnostics = await readJson("contracts/google/diagnostics.g0.json");
const evidence = await readJson("artifacts/g0/google-static-discovery-verification.json");
const versions = await readJson("contracts/contract-versions.json");
const packageJson = await readJson("package.json");
const canonical = await readFile(path.join(root, "docs/kakao-bizboard-renderer-spec-v1.md"), "utf8").catch(() => "");

let baselineReachable = true;
try {
  execFileSync("git", ["merge-base", "--is-ancestor", baseline, "HEAD"], { cwd: root, stdio: "ignore" });
} catch { baselineReachable = false; }
check("baseline_lineage", baselineReachable, baseline);
check("g0_phase", architecture?.phase === "G0_GOOGLE_ADS_STATIC_CAPABILITY_DISCOVERY_AND_ARCHITECTURE" && capabilities?.phase === architecture?.phase && geometry?.phase === architecture?.phase && delivery?.phase === architecture?.phase && provenance?.phase === architecture?.phase && diagnostics?.phase === architecture?.phase, architecture?.phase ?? "missing");
check("architecture_status", architecture?.status === "FREEZE_CANDIDATE" && architecture?.repositoryApplication === "APPLIED_ARCHITECTURE_ONLY" && evidence?.status === "PASS", JSON.stringify({ architecture: architecture?.status, repositoryApplication: architecture?.repositoryApplication, evidence: evidence?.status }));
check("baseline_record", architecture?.baseline?.sourceCommitSha === baseline && architecture?.baseline?.workingTreeAtBaseline === "CLEAN" && architecture?.baseline?.frozenChannels?.join(",") === "KAKAO,NAVER,META_STATIC" && architecture?.baseline?.frozenOutputChanges === 0, JSON.stringify(architecture?.baseline));

const implementation = architecture?.implementation ?? {};
check("runtime_boundary", implementation.runtimeProfilesAdded === false && implementation.rendererCodeAdded === false && implementation.validatorRuntimeAdded === false && implementation.goldensAdded === false && implementation.desktopUiAdded === false && implementation.uploadIntegrationAdded === false && implementation.runtimeNetworkAccess === "PROHIBITED" && Array.isArray(implementation.plumeDependencies) && implementation.plumeDependencies.length === 0, JSON.stringify(implementation));
check("capability_registry", capabilities?.status === "FREEZE_CANDIDATE" && capabilities?.implementationStatus === "ARCHITECTURE_ONLY" && capabilities?.runtimeEnabled === false && capabilities?.capabilities?.length === 7, JSON.stringify({ count: capabilities?.capabilities?.length, runtimeEnabled: capabilities?.runtimeEnabled }));
check("composition_boundary", architecture?.compositionBoundary?.displayAndPmaxProfilesMerged === false && architecture?.compositionBoundary?.singleArtifact === true && architecture?.compositionBoundary?.deliveryCollectionSeparate === true && architecture?.compositionBoundary?.platformComposed?.includes("GOOGLE_RDA_ASSET_SET") && architecture?.compositionBoundary?.rendererComposed?.includes("GOOGLE_DEMAND_GEN_UPLOADED_DISPLAY_STATIC"), JSON.stringify(architecture?.compositionBoundary));

const expectedCapabilities = new Map([
  ["GOOGLE_RDA_ASSET_SET", ["TRANSITIONAL", "PLATFORM_COMPOSED", "SINGLE", "COLLECTION"]],
  ["GOOGLE_PMAX_ASSET_GROUP_STATIC", ["ACTIVE", "PLATFORM_COMPOSED", "SINGLE", "COLLECTION"]],
  ["GOOGLE_DEMAND_GEN_SINGLE_IMAGE", ["ACTIVE_EVOLVING", "PLATFORM_COMPOSED", "SINGLE", "COLLECTION"]],
  ["GOOGLE_DEMAND_GEN_UPLOADED_DISPLAY_STATIC", ["ACTIVE_EVOLVING", "RENDERER_COMPOSED", "SINGLE", "COLLECTION"]],
  ["GOOGLE_LEGACY_UPLOADED_DISPLAY_STATIC", ["TRANSITIONAL", "RENDERER_COMPOSED", "SINGLE", "COLLECTION"]],
  ["GOOGLE_DEMAND_GEN_CAROUSEL", ["ACTIVE_EVOLVING", "PLATFORM_COMPOSED", "SINGLE", "COLLECTION"]],
  ["GOOGLE_SEARCH_IMAGE_ASSET", ["ACTIVE", "PLATFORM_COMPOSED", "SINGLE", "COLLECTION"]],
]);
check("capability_semantics", [...expectedCapabilities.entries()].every(([id, expected]) => {
  const entry = capabilities?.capabilities?.find((candidate) => candidate.capabilityId === id);
  return entry && [entry.lifecycle, entry.compositionMode, entry.artifactCardinality, entry.deliveryCardinality].every((value, index) => value === expected[index]);
}), JSON.stringify(capabilities?.capabilities?.map((entry) => ({ id: entry.capabilityId, lifecycle: entry.lifecycle, composition: entry.compositionMode, artifact: entry.artifactCardinality, delivery: entry.deliveryCardinality }))));

check("geometry_registry", geometry?.status === "PROPOSED_NOT_RUNTIME" && geometry?.profiles?.length === 7 && geometry?.projectPresetPolicy?.includes("not mandatory"), JSON.stringify({ profiles: geometry?.profiles?.length, status: geometry?.status }));
check("demand_gen_presets", geometry?.uploadedDisplayPresets?.demandGenRecommendedSubset?.length === 7 && JSON.stringify(geometry.uploadedDisplayPresets.demandGenRecommendedSubset.map(({ width, height }) => [width, height])) === JSON.stringify([[300, 250], [336, 280], [728, 90], [970, 90], [160, 600], [300, 600], [320, 50]]), JSON.stringify(geometry?.uploadedDisplayPresets?.demandGenRecommendedSubset));
check("legacy_display_canvases", geometry?.uploadedDisplayPresets?.legacyDisplaySupportedCanvases?.length === 20 && geometry?.uploadedDisplayPresets?.regionallyAvailableExcluded === true, JSON.stringify({ count: geometry?.uploadedDisplayPresets?.legacyDisplaySupportedCanvases?.length, regionalExclusion: geometry?.uploadedDisplayPresets?.regionallyAvailableExcluded }));
check("size_policy", geometry?.sizePolicy?.unit === "decimal-byte" && geometry?.sizePolicy?.rdaBytes === 5120000 && geometry?.sizePolicy?.pmaxBytes === 5120000 && geometry?.sizePolicy?.demandGenMarketingBytes === 5000000 && geometry?.sizePolicy?.demandGenLogoBytes === 150000 && geometry?.sizePolicy?.uploadedDisplayStaticBytes === 150000, JSON.stringify(geometry?.sizePolicy));
check("mime_policy", JSON.stringify(geometry?.mimePolicy?.rendererOutput) === JSON.stringify(["image/png", "image/jpeg"]) && geometry?.mimePolicy?.gifEmission === false, JSON.stringify(geometry?.mimePolicy));

check("delivery_contracts", delivery?.status === "PROPOSED_NOT_RUNTIME" && delivery?.contracts?.length === 5 && delivery?.deferredContracts?.length === 2 && delivery?.validationLayers?.artifact?.blocking === true && delivery?.validationLayers?.deliverySet?.blocking === true && delivery?.validationLayers?.platformIntegration?.blocking === false, JSON.stringify({ contracts: delivery?.contracts?.length, deferred: delivery?.deferredContracts?.length }));
check("diagnostics_not_active", diagnostics?.status === "PROPOSED_NOT_ACTIVE" && diagnostics?.activeRuntimeRegistration === false && diagnostics?.codes?.length === 11 && diagnostics?.codes?.every((entry) => entry.code.startsWith("KBR-GOOGLE-") && entry.code.length > 11), JSON.stringify({ status: diagnostics?.status, count: diagnostics?.codes?.length }));
check("official_source_policy", provenance?.status === "PASS" && provenance?.sourcePolicy === "GOOGLE_OFFICIAL_ONLY" && provenance?.sourceDomainPolicy?.thirdPartyRulesUsed === 0 && provenance?.sourceDomainPolicy?.longSourceExcerptsStored === false && provenance?.sources?.length === 12 && provenance?.sources?.every((source) => ["support.google.com", "developers.google.com"].includes(source.sourceDomain) && /^https:\/\/(?:support|developers)\.google\.com\//u.test(source.url)), JSON.stringify({ sources: provenance?.sources?.length, policy: provenance?.sourcePolicy }));
check("unresolved_fail_closed", provenance?.unresolvedRules?.length === 9 && provenance.unresolvedRules.every((rule) => typeof rule.id === "string" && typeof rule.g1Behavior === "string" && rule.g1Behavior.length > 0), JSON.stringify({ count: provenance?.unresolvedRules?.length }));

const activePaths = ["contracts/freeform-format-profiles.json", "src", "apps", "packages", "fixtures/golden"];
const activeFiles = (await Promise.all(activePaths.map(collectFiles))).flat();
const activeGoogleHits = [];
for (const relativePath of activeFiles) {
  const text = await readFile(path.join(root, relativePath), "utf8").catch(() => "");
  if (/google|GOOGLE/u.test(text)) activeGoogleHits.push(relativePath);
}
check("active_google_runtime_absent", activeGoogleHits.length === 0, activeGoogleHits.join(",") || "no active Google profile/runtime text");
check("google_runtime_paths_absent", !(await exists("src/core/google")) && !(await exists("apps/desktop/renderer/src/google")) && !(await exists("fixtures/golden/google")), "no Google runtime or golden directories");
const googleCodes = new Set((diagnostics?.codes ?? []).map((entry) => entry.code));
const activeErrorRegistryText = await readFile(path.join(root, "contracts/error-registry.json"), "utf8").catch(() => "");
const activeIntegrationErrorText = await readFile(path.join(root, "contracts/integration-error-registry.json"), "utf8").catch(() => "");
check("diagnostics_not_in_active_registry", [...googleCodes].every((code) => !activeErrorRegistryText.includes(code) && !activeIntegrationErrorText.includes(code)), "Google diagnostics are not active Error Registry entries");

const frozenDiff = execFileSync("git", ["diff", "--name-only", baseline, "--", "src", "apps", "packages", "contracts/freeform-format-profiles.json", "fixtures/golden"], { cwd: root, encoding: "utf8" }).trim();
check("frozen_runtime_paths", frozenDiff.length === 0, frozenDiff || "no frozen runtime/profile/golden changes from baseline");

const objectRightHash = await sha256("reference/kakao-tool/OBJECT_RIGHT.png").catch(() => null);
check("object_right_fixture", objectRightHash === expectedObjectRightSha256, JSON.stringify({ expected: expectedObjectRightSha256, actual: objectRightHash }));
check("template_contract", versions?.templateContractVersion === "1.9.0" && architecture?.baseline?.frozenOutputChanges === 0 && /x=666, y=0, w=315, h=258/u.test(canonical) && /1029×258/u.test(canonical), JSON.stringify({ template: versions?.templateContractVersion, coordinates: "x=666,y=0,w=315,h=258", canvas: "1029x258" }));
check("canonical_version_unchanged", canonical.startsWith("# Kakao Bizboard Local Renderer Specification v1") && /Document version:\*\* 1\.23\.1/u.test(canonical) && canonical.includes("Phase G0") && versions?.canonicalPhaseG0Google?.documentCurrent === "1.23.1" && versions?.canonicalPhaseG0Google?.documentBump === "none", JSON.stringify({ document: versions?.canonicalPhaseG0Google?.documentCurrent, bump: versions?.canonicalPhaseG0Google?.documentBump }));
check("runtime_versions_unchanged", versions?.canonicalPhaseG0Google?.templateContractVersion === "1.9.0" && versions?.canonicalPhaseG0Google?.inputSchemaVersion === "1.2.0" && versions?.canonicalPhaseG0Google?.outputSchemaVersion === "2.0.0" && versions?.canonicalPhaseG0Google?.rendererCoreVersion === "0.9.0" && versions?.canonicalPhaseG0Google?.validatorCurrent === "1.9.0" && versions?.canonicalPhaseG0Google?.desktopCurrent === "0.10.1" && versions?.canonicalPhaseG0Google?.packageCurrent === "0.10.1", JSON.stringify(versions?.canonicalPhaseG0Google));
check("evidence_consistency", evidence?.phase === architecture?.phase && evidence?.architecture?.capabilityCount === 7 && evidence?.architecture?.demandGenUploadedPresetCount === 7 && evidence?.architecture?.legacyDisplayCanvasCount === 20 && evidence?.diagnostics?.count === 11 && evidence?.sourcePolicy?.unresolvedRuleCount === 9, JSON.stringify(evidence));
check("package_boundary", !JSON.stringify(packageJson?.dependencies ?? {}).toLowerCase().includes("plume") && !JSON.stringify(packageJson?.devDependencies ?? {}).toLowerCase().includes("plume") && packageJson?.scripts?.["verify:g0-google"] === "node scripts/verify-g0-google-static.mjs", "no Plume dependency and G0 verifier script registered");

for (const result of checks) console.log(`${result.status} ${result.id}: ${result.detail}`);
const status = failures.length === 0 ? "PASS" : "FAIL";
console.log(JSON.stringify({ status, checks: checks.length, passed: checks.filter((entry) => entry.status === "PASS").length, failed: failures, baseline, objectRightSha256: objectRightHash }, null, 2));
if (status !== "PASS") process.exitCode = 1;
