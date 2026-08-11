import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const failures = [];
const checks = [];

async function json(relativePath) {
  const absolute = path.join(root, relativePath);
  try {
    return JSON.parse(await readFile(absolute, "utf8"));
  } catch (error) {
    failures.push(`${relativePath}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

async function exists(filePath) {
  try {
    await readFile(filePath);
    return true;
  } catch {
    return false;
  }
}

function check(name, condition, detail) {
  checks.push({ name, condition: Boolean(condition), detail });
  if (!condition) failures.push(`${name}: ${detail}`);
}

async function sha256(relativePath) {
  const bytes = await readFile(path.join(root, relativePath));
  return createHash("sha256").update(bytes).digest("hex");
}

const revision = await json("contracts/naver-platform-composed-source-revision.json");
const profiles = await json("contracts/naver-platform-composed-source-profiles.json");
const schema = await json("contracts/naver-platform-composed-source.schema.json");
const multiArtifactManifestSchema = await json("contracts/multi-artifact-manifest.schema.json");
const genericMultiArtifactSchema = await json("packages/renderer-contract/schema/multi-artifact-v1.schema.json");
const capabilities = await json("contracts/channel-capabilities.json");
const versions = await json("contracts/contract-versions.json");
const fixtureManifest = await json("fixtures/naver-platform-composed/fixture-manifest.json");
const errorRegistry = await json("contracts/error-registry.json");
const sourceFiles = [
  ["contracts/naver-mobile-native-source.json", "MOBILE_NATIVE"],
  ["contracts/naver-pc-native-source.json", "PC_NATIVE"],
  ["contracts/naver-shopping-news-source.json", "SHOPPING_NEWS"],
  ["contracts/naver-communication-ad-source.json", "COMMUNICATION_AD"],
  ["contracts/naver-feed-source.json", "MOBILE_DA_FEED"],
];
const sourceDescriptors = [];
for (const [file, placement] of sourceFiles) sourceDescriptors.push({ file, placement, descriptor: await json(file) });

check("schema_identity", schema?.$id === "https://kbr.local/schema/naver-platform-composed-source-v1.1.0.schema.json" && schema?.properties?.compositionMode?.const === "PLATFORM_COMPOSED" && JSON.stringify(schema?.properties?.schemaVersion?.enum) === JSON.stringify(["1.0.0", "1.1.0"]), JSON.stringify({ id: schema?.$id, version: schema?.properties?.schemaVersion?.enum, compositionMode: schema?.properties?.compositionMode?.const }));
check("multi_artifact_schema_identity", multiArtifactManifestSchema?.$id === "https://kbr.local/schema/multi-artifact-manifest-v1.0.0.schema.json" && genericMultiArtifactSchema?.$id === "https://kbr.local/schema/multi-artifact-v1.schema.json", "generic multi-artifact schema and manifest are present");
check("schema_has_no_final_canvas", schema?.allOf?.some((entry) => entry?.not?.required?.includes("finalCanvas")) === true && schema?.allOf?.some((entry) => entry?.not?.required?.includes("finalCoordinates")) === true, "public SourceSpec schema rejects final geometry");
check("source_revision_identity", revision?.channel === "NAVER_GFA" && revision?.compositionMode === "PLATFORM_COMPOSED" && revision?.sourceStatus === "SOURCE_CONFIRMED", JSON.stringify(revision && { channel: revision.channel, compositionMode: revision.compositionMode, sourceStatus: revision.sourceStatus }));
check("source_revision_count", Object.keys(revision?.sources ?? {}).sort().join(",") === ["COMMUNICATION_AD", "MOBILE_DA_FEED", "MOBILE_NATIVE", "PC_NATIVE", "SHOPPING_NEWS"].join(","), Object.keys(revision?.sources ?? {}));
check("profile_registry_identity", profiles?.registryVersion === "1.1.0" && profiles?.channel === "NAVER_GFA" && profiles?.compositionMode === "PLATFORM_COMPOSED" && profiles?.finalPresentationOwner === "NAVER_PLATFORM" && profiles?.finalPixelGeometry === "NOT_APPLICABLE", JSON.stringify(profiles && { registryVersion: profiles.registryVersion, channel: profiles.channel, compositionMode: profiles.compositionMode, finalPresentationOwner: profiles.finalPresentationOwner }));
check("profile_count", profiles?.profiles?.length === 9, String(profiles?.profiles?.length));
check("field_refs_resolve", (profiles?.profiles ?? []).every((profile) => profile.fields.every((field) => profiles.fieldCatalog?.[field])), "every profile field ref resolves");
check("asset_refs_resolve", (profiles?.profiles ?? []).every((profile) => profile.assets.every((asset) => profiles.assetCatalog?.[asset])), "every profile asset ref resolves");
check("layout_mode_axis_unchanged", !JSON.stringify(profiles).includes("CONSTRAINED"), "no new LayoutMode is introduced");
check("source_descriptor_identity", sourceDescriptors.every(({ descriptor, placement }) => {
  const owner = descriptor?.finalPresentationOwner ?? descriptor?.presentation?.finalPresentationOwner;
  return ["1.0.0", "1.1.0"].includes(descriptor?.schemaVersion) && descriptor.channel === "NAVER_GFA" && descriptor.compositionMode === "PLATFORM_COMPOSED" && descriptor.placement === placement && owner === "NAVER_PLATFORM";
}), "five source descriptors preserve NAVER platform ownership");
check("source_descriptor_no_final_geometry", sourceDescriptors.every(({ descriptor }) => !Object.prototype.hasOwnProperty.call(descriptor ?? {}, "finalCanvas") && !Object.prototype.hasOwnProperty.call(descriptor ?? {}, "finalCoordinates") && !Object.prototype.hasOwnProperty.call(descriptor ?? {}, "pixelFingerprint")), "source descriptors contain no final pixel geometry");

const expectedAttachments = {
  MOBILE_NATIVE: { file: "Native_M_DA_total_PF.pdf", sha256: "e4c944b2153d56692d57a2951715dd108136dbf8aaaea204254f2466cb45f738", pages: 13, pageUpdate: "2026-02-24" },
  PC_NATIVE: { file: "Native_P_DA_total_PF.pdf", sha256: "f9453631e223cf00a3e99f8b28b5aa68b0c6d55e4315e060aac30c94f504dd75", pages: 28, pageUpdate: "2026-01-07" },
  SHOPPING_NEWS: { file: "shoppinginformAD.pdf", sha256: "29aedba675ad2dbec3e3fc40ff5937016bae58faecbb91f2d6d65fcc7bc75d6c", pages: 12, pageUpdate: "2025-09-09" },
  COMMUNICATION_AD: { file: "naver_communication_ad.pdf", sha256: "8e58032444e1cfd6ddd1cfa1b32f5ee901133f30ff9ecacc3883ae32bfe6b616", pages: 3, pageUpdate: "2023-04-25" },
  MOBILE_DA_FEED: { file: "FEED_AD_GUIDE.pdf", sha256: "0e45fdf9dda180551dde06bdef91e726f86823a405e62e00232db7ba407170ef", pages: 20, pageUpdate: "2026-04-15" },
};
for (const [placement, expected] of Object.entries(expectedAttachments)) {
  const source = revision?.sources?.[placement];
  const actual = await sha256(`source-guides/naver/platform-composed/${expected.file}`).catch(() => null);
  check(`attachment_${placement}`, source?.attachmentFileName === expected.file && source?.attachmentSha256 === expected.sha256 && source?.attachmentPages === expected.pages && source?.pageUpdate === expected.pageUpdate && actual === expected.sha256, JSON.stringify({ expected, registry: source && { file: source.attachmentFileName, sha256: source.attachmentSha256, pages: source.attachmentPages, pageUpdate: source.pageUpdate }, actual }));
}

const naverCapabilities = (capabilities?.capabilities ?? []).filter((entry) => ["MOBILE_NATIVE", "PC_NATIVE", "SHOPPING_NEWS", "COMMUNICATION_AD", "MOBILE_DA_FEED"].includes(entry.placement));
check("capability_boundary", naverCapabilities.length === 5 && naverCapabilities.every((entry) => entry.channel === "NAVER_GFA" && (entry.compositionMode === "PLATFORM_COMPOSED" || entry.compositionModes?.includes("PLATFORM_COMPOSED")) && entry.runtimeStatus === "DEFERRED" && entry.layoutMode === undefined && (!entry.layoutModes || entry.layoutModes.every((mode) => ["TEMPLATE_LOCKED", "FREEFORM"].includes(mode)))), JSON.stringify(naverCapabilities));
check("feed_profiles", profiles?.profiles?.some((profile) => profile.id === "NAVER_FEED_IMAGE_SOURCE_V1" && profile.placement === "MOBILE_DA_FEED") === true && profiles?.profiles?.some((profile) => profile.id === "NAVER_FEED_COLLECTION_SOURCE_V1" && profile.runtimeStatus === "IMPLEMENTED_SOURCE_ARTIFACT_ONLY" && profile.collection?.minimumItems === 4 && profile.collection?.maximumItems === 10 && profile.collection?.ordering === "INPUT_ORDER_PRESERVED" && JSON.stringify(profile.collection?.itemSourceProfileIds) === JSON.stringify(["NAVER_FEED_COLLECTION_ITEM_IMAGE_600X600"]) && profile.finalUiRuntime === "NOT_IMPLEMENTED") === true, "image, video, and image-only collection source boundaries are explicit");
check("feed_known_safe_areas", profiles?.assetCatalog?.NAVER_FEED_IMAGE_1_1?.safeArea?.width === 1080 && profiles?.assetCatalog?.NAVER_FEED_IMAGE_16_9?.safeArea?.height === 508 && profiles?.assetCatalog?.NAVER_FEED_IMAGE_2_3?.safeArea?.y === 300 && profiles?.assetCatalog?.NAVER_FEED_PROFILE_IMAGE_300X300?.safeArea?.width === 246, "feed safe areas match inspected PDF values");
check("runtime_network", revision?.runtimeNetworkAccess === "PROHIBITED", revision?.runtimeNetworkAccess);
const naverErrorCodes = new Set((errorRegistry?.codes ?? []).filter((entry) => entry.code?.startsWith("KBR-NAVER-SOURCE-")).map((entry) => entry.code));
const fixtureErrorCodes = new Set((fixtureManifest?.requiredErrorFixtures ?? []).map((entry) => entry.code));
check("fixture_error_coverage", fixtureErrorCodes.size === naverErrorCodes.size && [...naverErrorCodes].every((code) => fixtureErrorCodes.has(code)), JSON.stringify({ registry: naverErrorCodes.size, fixtures: fixtureErrorCodes.size }));
check("fixture_minimums", fixtureManifest?.implementedFixtures?.some((entry) => entry.kind === "CTA_NONE") === true && fixtureManifest?.implementedFixtures?.some((entry) => entry.kind === "FINAL_GEOMETRY_REJECTION") === true, "CTA NONE and final-geometry fixture requirements are present");
const fixturePaths = [
  ...(fixtureManifest?.implementedFixtures ?? []).map((entry) => entry.path),
  ...(fixtureManifest?.requiredErrorFixtures ?? []).filter((entry) => entry.minimumFixture?.startsWith("collection/")).map((entry) => entry.minimumFixture),
];
const missingFixtures = [];
for (const relativePath of fixturePaths) if (!await exists(path.join(root, "fixtures/naver-platform-composed", relativePath))) missingFixtures.push(relativePath);
check("fixture_files_present", missingFixtures.length === 0, JSON.stringify({ missing: missingFixtures }));
check("version_alignment", versions?.documentVersion?.current === "1.21.1" && versions?.templateContractVersion === "1.9.0" && versions?.canonicalPhaseN6?.rendererCoreVersion === "0.8.0" && versions?.platformComposedSourceSchemaVersion === "1.1.0" && versions?.platformComposedSourceRegistryVersion === "1.1.0" && versions?.multiArtifactManifestSchemaVersion === "1.0.0" && versions?.desktopAppVersion === "0.9.6" && versions?.canonicalPhaseN7_1?.desktopCurrent === "0.9.1" && versions?.canonicalPhaseN7_2?.desktopCurrent === "0.9.2" && versions?.canonicalPhaseN7_3?.desktopCurrent === "0.9.3" && versions?.canonicalPhaseN7_4?.desktopCurrent === "0.9.4" && versions?.canonicalPhaseN7_4Continuation?.desktopCurrent === "0.9.5" && versions?.canonicalPhaseN7_5?.desktopCurrent === "0.9.6" && versions?.integrationErrorRegistryVersion === "1.9.0", JSON.stringify(versions && { document: versions.documentVersion, template: versions.templateContractVersion, rendererCore: versions.canonicalPhaseN6?.rendererCoreVersion, sourceSchema: versions.platformComposedSourceSchemaVersion, sourceRegistry: versions.platformComposedSourceRegistryVersion, manifest: versions.multiArtifactManifestSchemaVersion, desktop: versions.desktopAppVersion, n7_2: versions.canonicalPhaseN7_2, n7_3: versions.canonicalPhaseN7_3, n7_4: versions.canonicalPhaseN7_4, n7_5: versions.canonicalPhaseN7_5, continuation: versions.canonicalPhaseN7_4Continuation, integrationErrorRegistry: versions.integrationErrorRegistryVersion }));

for (const result of checks) console.log(`${result.condition ? "PASS" : "FAIL"} ${result.name}: ${result.detail}`);
if (failures.length > 0) {
  console.error(JSON.stringify({ status: "FAIL", failures }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ status: "PASS", checks: checks.length, placements: 5, profileCount: profiles?.profiles?.length ?? 0, finalUiRendered: false }, null, 2));
}
