import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const checks = [];
const failures = [];
const check = (name, condition, detail) => {
  checks.push({ name, status: condition ? "PASS" : "FAIL", detail });
  if (!condition) failures.push(`${name}: ${detail}`);
};
const readJson = async (relative) => JSON.parse(await readFile(path.join(root, relative), "utf8"));
const exists = async (relative) => stat(path.join(root, relative)).then(() => true).catch(() => false);

const profilesRegistry = await readJson("contracts/freeform-format-profiles.json");
const metaProfiles = await readJson("contracts/meta-static-profiles.json");
const placementSchema = await readJson("contracts/meta-static-placement-set.schema.json");
const desktop = await readJson("contracts/desktop-capability-registry.json");
const versions = await readJson("contracts/contract-versions.json");
const errors = await readJson("contracts/error-registry.json");
const manifestSchema = await readJson("contracts/render-manifest.schema.json");
const packageJson = await readJson("package.json");

const expectedIds = ["META_STATIC_FEED_SQUARE", "META_STATIC_FEED_PORTRAIT", "META_STATIC_VERTICAL_FULL"];
const profiles = new Map((profilesRegistry.profiles ?? []).filter((profile) => profile.channelNamespace === "META").map((profile) => [profile.formatProfileId, profile]));
check("meta_profiles", expectedIds.every((id) => profiles.has(id)) && profiles.size === 3, [...profiles.keys()].join(","));
check("project_canvas_presets", profiles.get(expectedIds[0])?.canvas?.width === 1080 && profiles.get(expectedIds[0])?.canvas?.height === 1080 && profiles.get(expectedIds[1])?.canvas?.height === 1350 && profiles.get(expectedIds[2])?.canvas?.height === 1920, JSON.stringify([...profiles.values()].map((profile) => profile.canvas)));
check("ratio_and_pixel_provenance", expectedIds.every((id) => profiles.get(id)?.classification === "PROJECT_OUTPUT_PRESET_V1" && profiles.get(id)?.complianceMetadata?.pixelDimensionsAreMetaMandatory === false), JSON.stringify([...profiles.values()].map((profile) => profile.complianceMetadata)));
check("shape_gate", expectedIds.every((id) => profiles.get(id)?.elementConstraints?.allowShape === true), "META profiles allow SHAPE; legacy profiles remain gated");
check("stories_safe_zone", expectedIds.every((id) => profiles.get(id)?.safeZonePolicy?.storiesNormalizedExclusion?.top === 0.14 && profiles.get(id)?.safeZonePolicy?.storiesNormalizedExclusion?.bottom === 0.2 && profiles.get(id)?.safeZonePolicy?.finalOverlay === false), "top=0.14 bottom=0.20 warning guide only");
check("reels_source_required", expectedIds.every((id) => profiles.get(id)?.complianceMetadata?.reelsSafeZoneGeometry === "SOURCE_REQUIRED_INFO_ONLY"), "no guessed Reels geometry");
check("placement_set_schema", placementSchema.properties?.contractId?.const === "META_STATIC_PLACEMENT_SET_V1" && placementSchema.properties?.compositionMode?.const === "RENDERER_COMPOSED" && JSON.stringify(placementSchema.properties?.order?.const) === JSON.stringify(expectedIds), "fixed order and renderer-composed cardinality");
const metaDesktop = desktop.channels?.find((channel) => channel.id === "META");
check("desktop_meta_selector", Boolean(metaDesktop?.placements?.some((placement) => placement.id === "META_STATIC_IMAGE" && placement.editorType === "FREEFORM_EDITOR")), JSON.stringify(metaDesktop));
check("platform_copy_metadata_only", metaProfiles.platformCopy?.metadataOnly === true && metaProfiles.platformCopy?.fields?.length === 5, JSON.stringify(metaProfiles.platformCopy));
check("unsupported_scope", ["CAROUSEL", "CATALOG", "DYNAMIC", "VIDEO"].every((value) => metaProfiles.unsupported?.includes(value)), JSON.stringify(metaProfiles.unsupported));
check("error_codes", ["KBR-META-STORIES-SAFE-ZONE-WARNING", "KBR-META-REELS-SAFE-ZONE-SOURCE-REQUIRED", "KBR-META-PLACEMENT-SET-INCOMPLETE", "KBR-META-PLACEMENT-SET-CHILD-BLOCKED"].every((code) => errors.codes?.some((entry) => entry.code === code)), "M1 META codes registered");
check("manifest_no_self_digest", !Object.keys(manifestSchema.properties ?? {}).some((key) => /manifest.*digest/i.test(key) && key !== "canonicalInputDigest"), "manifest schema contains no self digest field");
check("version_m1", ["1.22.0", "1.23.0", "1.23.1", "1.24.0", "1.25.0", "1.26.0", "1.27.0", "1.28.0"].includes(versions.documentVersion?.current) && versions.canonicalPhaseM1?.metaRuntimeImplemented === true && ["0.10.0", "0.10.1", "0.11.0"].includes(versions.desktopAppVersion) && ["0.10.0", "0.10.1", "0.11.0"].includes(packageJson.version), JSON.stringify({ document: versions.documentVersion?.current, desktop: versions.desktopAppVersion, package: packageJson.version }));
for (const fixture of [
  "fixtures/meta/feed-square/meta-feed-square-basic.json",
  "fixtures/meta/feed-portrait/meta-feed-portrait-basic.json",
  "fixtures/meta/vertical/meta-vertical-stories-safe.json",
  "fixtures/meta/vertical/meta-vertical-stories-warning.json",
  "fixtures/meta/vertical/meta-vertical-reels.json",
  "fixtures/meta/placement-set/meta-placement-set-basic.json",
]) check(`fixture_${fixture}`, await exists(fixture), fixture);

for (const result of checks) console.log(`${result.status} ${result.name}: ${result.detail}`);
if (failures.length > 0) {
  console.error(JSON.stringify({ status: "FAIL", failures }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ status: "PASS", checks: checks.length, profiles: expectedIds, runtimeNetworkAccess: "PROHIBITED" }, null, 2));
}
