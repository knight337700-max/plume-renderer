import { execFileSync } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const baseline = "dbb78d1e1accc509acf18d124bd9c9d0b6b9723e";
const failures = [];
const checks = [];
const check = (name, condition, detail) => {
  checks.push({ name, status: condition ? "PASS" : "FAIL", detail });
  if (!condition) failures.push(`${name}: ${detail}`);
};
const readJson = async (relative) => JSON.parse(await readFile(path.join(root, relative), "utf8"));
const exists = async (relative) => stat(path.join(root, relative)).then((entry) => entry.isFile() || entry.isDirectory()).catch(() => false);

const registry = await readJson("contracts/audits/meta-official-source-registry.json");
const officialAudit = await readJson("artifacts/m0/meta-official-source-audit.json");
const capability = await readJson("artifacts/m0/meta-static-capability-matrix.json");
const placements = await readJson("artifacts/m0/meta-placement-compatibility-matrix.json");
const reuse = await readJson("artifacts/m0/freeform-reuse-audit.json");
const safeZones = await readJson("artifacts/m0/meta-safe-zone-audit.json");
const scope = await readJson("artifacts/m0/meta-scope-classification.json");
const regression = await readJson("artifacts/m0/regression-summary.json");
const versions = await readJson("contracts/contract-versions.json");
const desktop = await readJson("contracts/desktop-capability-registry.json");
const packageJson = await readJson("package.json");

check("official_registry", registry.registryVersion === "1.0.0" && registry.officialMetaOnly === true && registry.rules.length >= 10 && registry.unresolvedRules.length >= 8, `${registry.rules.length} rules / ${registry.unresolvedRules.length} unresolved`);
const requiredRuleFields = ["rule_id", "category", "source_url", "retrieved_at", "official_domain", "source_excerpt_summary", "interpretation", "confidence", "contract_effect"];
check("official_rule_shape", registry.rules.every((rule) => requiredRuleFields.every((field) => typeof rule[field] === "string" && rule[field].length > 0)), "all required provenance fields present");
check("official_domains_only", registry.rules.every((rule) => /^https:\/\/(?:www\.)?facebook\.com\//u.test(rule.source_url) && /(?:^|\.)facebook\.com$/u.test(rule.official_domain)), "facebook.com official sources only");
check("official_audit", officialAudit.status === "PASS" && officialAudit.officialMetaOnly === true && officialAudit.thirdPartyRulesUsed === 0 && officialAudit.speculativePixelRulesAdded === 0 && officialAudit.longSourceExcerptsStored === false, JSON.stringify(officialAudit));

const profiles = new Map(capability.assetProfiles.map((entry) => [entry.assetProfileId, entry]));
check("asset_profiles", capability.status === "PASS" && profiles.get("META_STATIC_FEED_SQUARE")?.aspectRatio === "1:1" && profiles.get("META_STATIC_FEED_PORTRAIT")?.aspectRatio === "4:5" && profiles.get("META_STATIC_VERTICAL_FULL")?.aspectRatio === "9:16", JSON.stringify([...profiles.keys()]));
check("pixel_presets_unresolved", ["META_STATIC_FEED_SQUARE", "META_STATIC_FEED_PORTRAIT", "META_STATIC_VERTICAL_FULL"].every((id) => profiles.get(id)?.pixelSizeStatus === "UNRESOLVED" && profiles.get(id)?.pixelSize === null), "no speculative pixel preset");
check("landscape_deferred", profiles.get("META_STATIC_LANDSCAPE")?.officialStatus === "DEFER" && profiles.get("META_STATIC_LANDSCAPE")?.aspectRatio === null, JSON.stringify(profiles.get("META_STATIC_LANDSCAPE")));
check("placement_set", capability.placementSet?.status === "SUPPORTED_PLANNED" && capability.placementSet?.profiles?.length === 3 && capability.placementSet?.automaticCenterCropOnly === false && capability.placementSet?.layerIdParityRequired === true, JSON.stringify(capability.placementSet));
check("placement_axis", placements.status === "PASS" && placements.assetProfileAndPlacementAreSeparateAxes === true && placements.placements.length === 7 && placements.placements.find((entry) => entry.placementId === "INSTAGRAM_EXPLORE")?.status === "SOURCE_REQUIRED", `${placements.placements.length} placements`);

const stories = safeZones.policies.find((entry) => entry.id === "META_STORIES_KEY_CONTENT_SAFE_ZONE");
const reels = safeZones.policies.find((entry) => entry.id === "META_REELS_KEY_CONTENT_SAFE_ZONE");
check("stories_safe_zone", stories?.geometry?.topExclusion === 0.14 && stories?.geometry?.bottomExclusion === 0.2 && stories?.qualifier === "ROUGHLY" && stories?.enforcement === "WARNING_AND_GUIDE_OVERLAY" && stories?.finalArtifactOverlay === false, JSON.stringify(stories));
check("reels_safe_zone", reels?.status === "SOURCE_REQUIRED" && reels?.geometry === null && reels?.enforcement === "INFO_SOURCE_REQUIRED_NO_GEOMETRY", JSON.stringify(reels));
check("safe_zone_separation", safeZones.safeZoneTypesSeparated === true && safeZones.thirdPartySafeZonePixelsUsed === false && safeZones.errorSeverityAssignedToAdvisoryRule === false, JSON.stringify(safeZones));

check("composition_boundary", scope.rendererScope?.classification === "STATIC_CREATIVE_MEDIA" && scope.platformOwned?.classification === "PLATFORM_COMPOSED" && scope.platformOwned?.renderedIntoMedia === false && scope.advantagePlusCreative?.status === "EXTERNAL_PLATFORM_TRANSFORMATION", JSON.stringify({ renderer: scope.rendererScope?.classification, platform: scope.platformOwned?.classification }));
check("scope_classification", scope.carousel?.status === "DEFER_AFTER_M1" && scope.collectionCatalog?.status === "PLATFORM_COMPOSED" && scope.video?.status === "OUT_OF_M0_STATIC_IMPLEMENTATION" && scope.font?.metaPlatformFontCreated === false, JSON.stringify({ carousel: scope.carousel?.status, collection: scope.collectionCatalog?.status, video: scope.video?.status }));
check("freeform_reuse", reuse.status === "PASS" && reuse.overallReuse === "PARTIAL" && reuse.newFreeformRendererRequired === false && reuse.schemaForkRequired === false && reuse.components.length >= 14, `${reuse.components.length} components`);

check("desktop_not_exposed", capability.runtimeImplemented === false && capability.desktopExposed === false && desktop.channels.every((channel) => channel.id !== "META"), desktop.channels.map((channel) => channel.id).join(","));
check("versions_unchanged", versions.documentVersion.current === "1.21.4" && versions.canonicalPhaseM0.rendererCoreVersion === "0.8.6" && versions.desktopAppVersion === "0.9.12" && packageJson.version === "0.9.12" && versions.canonicalPhaseM0.metaRuntimeImplemented === false, JSON.stringify({ canonical: versions.documentVersion.current, core: versions.canonicalPhaseM0.rendererCoreVersion, desktop: versions.desktopAppVersion, package: packageJson.version }));
check("regression_summary", regression.status === "PASS" && regression.auditOnly === true && regression.productionPixelsChanged === false && regression.fullCheck?.status === "PASS" && regression.fullCheck?.vitestTests === 262 && regression.fullCheck?.playwrightTests === 34 && regression.packageSmoke?.status === "PASS" && regression.desktopSmoke?.status === "PASS" && regression.packageSmoke?.runtimeNetworkRequests === 0 && regression.metaRuntimeImplemented === false, JSON.stringify({ fullCheck: regression.fullCheck?.status, package: regression.packageSmoke?.status, desktop: regression.desktopSmoke?.status, network: regression.packageSmoke?.runtimeNetworkRequests }));

for (const file of [
  "docs/implementation/meta-static-renderer-architecture-m0.md",
  "docs/adr/ADR-0057-meta-static-creative-composition-boundary.md",
  "source-guides/meta/m0/official-source-index.md",
]) check(`file_${file}`, await exists(file), file);

const frozenPaths = [
  "fixtures/golden",
  "assets/fonts/naver-smartchannel",
  "assets/naver-smartchannel",
  "contracts/naver-smartchannel-template-contract.json",
  "contracts/naver-smartchannel-typography.json",
  "contracts/naver-smartchannel-object-placement.json",
  "src/core/naver-smartchannel.ts",
  "src/core/freeform.ts",
  "src/core/freeform-validator.ts",
  "src/core/naver-platform-composed.ts",
  "src/core/naver-collection.ts",
];
const frozenDiff = execFileSync("git", ["diff", "--name-only", baseline, "--", ...frozenPaths], { cwd: root, encoding: "utf8" }).trim();
check("frozen_runtime_paths", frozenDiff.length === 0, frozenDiff || "no changes");

for (const result of checks) console.log(`${result.status} ${result.name}: ${result.detail}`);
if (failures.length > 0) {
  console.error(JSON.stringify({ status: "FAIL", checks: checks.length, failures }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ status: "PASS", checks: checks.length, officialRules: registry.rules.length, unresolvedRules: registry.unresolvedRules.length, productionPixelsChanged: false }, null, 2));
}
