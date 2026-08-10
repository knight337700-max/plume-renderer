import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";

const root = process.cwd();
const strictSource = process.argv.includes("--strict-source");
const sourceRoot = process.env.NAVER_SMARTCHANNEL_SOURCE_ROOT ?? "C:/Users/Lenovo/Desktop/SMARTCHANNEL_GUIDE 12";
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const contract = readJson("contracts/naver-smartchannel-template-contract.json");
const schema = readJson("contracts/naver-smartchannel-template.schema.json");
const typography = readJson("contracts/naver-smartchannel-typography.json");
const fixed = readJson("contracts/naver-smartchannel-fixed-components.json");
const cta = readJson("contracts/naver-smartchannel-cta-options.json");
const metadata = readJson("contracts/naver-smartchannel-psd-metadata.json");
const sourceRevision = readJson("contracts/naver-smartchannel-source-revision.json");
const n2 = readJson("contracts/naver-smartchannel-n2-candidates.json");
const runtimeFontPolicy = readJson("contracts/naver-smartchannel-runtime-font-policy.json");
const fontCompatibility = readJson("contracts/naver-smartchannel-font-compatibility.json");
const metricFixtures = readJson("contracts/naver-smartchannel-font-metric-fixtures.json");
const objectPlacement = readJson("contracts/naver-smartchannel-object-placement.json");
const objectPlacementSchema = readJson("contracts/naver-smartchannel-object-placement.schema.json");

const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };
const templates = contract.templates;
const ids = templates.map((entry) => entry.templateId);
const hashes = templates.map((entry) => entry.source.sha256);

expect(contract.registryVersion === "1.4.0", "template registryVersion must be 1.4.0");
expect(contract.templateContractVersion === "1.10.0", "templateContractVersion must be 1.10.0");
expect(contract.objectPlacementContractRef === "contracts/naver-smartchannel-object-placement.json" && contract.objectPlacementSchemaRef === "contracts/naver-smartchannel-object-placement.schema.json" && contract.objectPlacementStatus === "SOURCE_RESOLVED_PROJECT_CONTRACT", "object placement references/status mismatch");
expect(contract.channel === "NAVER_GFA" && contract.placement === "SMARTCHANNEL", "channel/placement mismatch");
expect(contract.layoutMode === "TEMPLATE_LOCKED" && contract.compositionMode === "RENDERER_COMPOSED" && contract.artifactCardinality === "SINGLE", "composition axes mismatch");
expect(templates.length === 120, `expected 120 templates, got ${templates.length}`);
expect(new Set(ids).size === ids.length, "templateId values are not unique");
expect(new Set(hashes).size === hashes.length, "source SHA-256 values are not unique");
expect(JSON.stringify(contract.sourceCatalog.countsByHeight) === JSON.stringify({ "160": 32, "200": 32, "280": 56 }), "source counts by height mismatch");
expect(contract.sourceCatalog.catalogHashCrossCheck.hashMismatches === 0, "catalog hash mismatch recorded");
expect(contract.sourceCatalog.canvasHeaderCheck.badHeaders === 0, "PSD header mismatch recorded");
expect(schema.$id.endsWith("naver-smartchannel-template-v1.4.0.schema.json"), "template schema id must be v1.4.0");
expect(schema.properties.registryVersion.const === "1.4.0", "template schema registry version mismatch");
expect(schema.properties.templateContractVersion.const === "1.10.0", "template schema contract version mismatch");
try {
  const validate = new Ajv2020({ strict: false, allErrors: true }).compile(schema);
  expect(validate(contract), `template contract does not validate against schema${validate.errors ? `: ${JSON.stringify(validate.errors)}` : ""}`);
} catch (error) {
  expect(false, `template schema compilation failed: ${error instanceof Error ? error.message : String(error)}`);
}
expect(contract.sourceResolutionStatus === "SOURCE_RESOLVED_PROJECT_COMPATIBLE", "source resolution status mismatch");
expect(metadata.sourcePsdCount === 120 && metadata.textLayerCount > 0 && metadata.typographyTokenCount === 25, "PSD metadata extraction summary mismatch");
const metadataTokenIds = new Set((metadata.typographyTokens ?? []).map((token) => token.id));
const metadataTemplates = metadata.templates ?? [];
expect(metadataTemplates.length === 120, "PSD metadata template count mismatch");
expect(metadataTemplates.every((entry) => (entry.textLayers ?? []).every((layer) => typeof layer.typographyTokenId === "string" && metadataTokenIds.has(layer.typographyTokenId))), "text-bearing PSD layers are missing exact typography token references");
expect(metadataTokenIds.size === 25 && metadataTokenIds.size === new Set(typography.tokens.map((token) => token.id)).size && typography.tokens.every((token) => metadataTokenIds.has(token.id)), "typography token registry is not bijective with PSD metadata");
expect(templates.every((entry) => entry.sourceMetadataRef?.templateId === entry.templateId), "template metadata references are incomplete");
expect(templates.every((entry) => entry.source.sourceRevisionRef), "source revision references are incomplete");

expect(typography.registryVersion === "1.3.0", "typography registry version mismatch");
expect(typography.status === "SOURCE_METADATA_FROZEN", "typography source metadata is not frozen");
expect(typography.exactSourceFontIdentity === "PASS", "exact source font identity is not PASS");
expect(typography.tokens.length === 25 && typography.tokens.every((token) => token.classification === "DERIVED_FROM_EXACT_SOURCE_METADATA"), "typography token registry mismatch");
expect(typography.runtimeResolution === "OFFICIAL_ASSET_REQUIRED", "runtime font contract status mismatch");
expect(typography.runtimeFontMode === "OFFICIAL_ASSET_REQUIRED" && JSON.stringify(typography.sfRuntimeFonts ?? []) === JSON.stringify([]), "runtime typography must not claim a project-compatible or SF runtime font");
expect(typography.n2Blocking === true, "unresolved official fonts must block SmartChannel runtime");
expect(typography.runtimeFontAssets.length === 3 && typography.runtimeFontAssets.filter((asset) => asset.required !== false).length === 2 && typography.runtimeFontAssets.every((asset) => asset.resolution !== "PROJECT_COMPATIBLE_VERIFIED" && asset.bundleAllowed === false), "font runtime role registry mismatch");
expect(contract.runtimeFontPolicyRef === "contracts/naver-smartchannel-runtime-font-policy.json", "runtime font policy reference missing");
expect(contract.fontContractRef === "contracts/naver-smartchannel-font-contract.json", "official font contract reference missing");
expect(contract.fontResolutionPolicy?.fallbackAllowed === false && contract.fontResolutionPolicy?.exactIdentityRequired === false && contract.fontResolutionPolicy?.runtimeIdentityRequired === true, "SmartChannel fallback/runtime identity policy mismatch");
expect(contract.fontResolutionPolicy?.sourceIdentityPolicy === "SOURCE_EXACT_OR_PROJECT_COMPATIBLE_VERIFIED_DIFFERENT_BUILD" && contract.fontResolutionPolicy?.runtimeLookupKey === "fontToken", "SmartChannel source/runtime font lookup policy mismatch");
expect(JSON.stringify(contract.fontResolutionPolicy?.allowedModes) === JSON.stringify(["BUNDLED_EXACT", "SYSTEM_EXACT", "EXTERNAL_EXACT"]), "SmartChannel resolution modes mismatch");
expect(runtimeFontPolicy.status === "FROZEN_FAIL_CLOSED" && runtimeFontPolicy.registryVersion === "1.3.0" && runtimeFontPolicy.templateContractVersion === "1.10.0", "runtime font policy status/version mismatch");
expect(runtimeFontPolicy.requiredSourceFonts?.length === 6, "runtime source font inventory must contain six fonts");
expect(runtimeFontPolicy.requiredSourceFonts?.every((font) => font.postScriptName && typeof font.classification === "string" && typeof font.runtimeRequired === "boolean"), "runtime source font inventory is incomplete");
expect(runtimeFontPolicy.fallbackAllowed === false && runtimeFontPolicy.externalExactContract?.networkUrlAllowed === false && runtimeFontPolicy.externalExactContract?.pathTraversalAllowed === false, "external exact security policy mismatch");
expect(runtimeFontPolicy.runtimeStatus === "BLOCKED_UNRESOLVED_OFFICIAL_ASSET" && runtimeFontPolicy.runtimeLookupKey === "fontToken", "runtime font contract mode mismatch");
expect(runtimeFontPolicy.runtimeAssets?.filter((entry) => entry.required).length === 2 && runtimeFontPolicy.runtimeAssets?.every((entry) => entry.required === false || entry.runtimeDigest === null), "official runtime asset gate mismatch");
expect(fontCompatibility.status === "OFFICIAL_ASSETS_UNRESOLVED" && fontCompatibility.runtimeFontMode === "OFFICIAL_ASSET_REQUIRED" && fontCompatibility.sourceFontBinaryExact === false && fontCompatibility.photoshopBytePixelParityClaim === false, "font compatibility registry mismatch");
expect(fontCompatibility.approvedDigestAllowlist && Object.keys(fontCompatibility.approvedDigestAllowlist).length === 0, "unresolved font registry must not contain fake digests");
expect(metricFixtures.status === "BLOCKED_UNRESOLVED_ASSET" && metricFixtures.summary?.overflow === 0, "representative metric fixture gate failed");

const component = (id) => fixed.components.find((entry) => entry.id === id);
expect(component("LANDING_ICON_COMPACT")?.status === "FROZEN", "compact landing icon is not frozen");
expect(component("LANDING_ICON_280")?.status === "FROZEN", "280 landing icon is not frozen");
expect(component("APP_CTA_160_200")?.status === "FROZEN", "160/200 CTA is not frozen");
expect(component("APP_CTA_280")?.status === "FROZEN", "280 CTA is not frozen");
expect(fixed.specialGeometry?.disclosure160TwoLine?.status === "FROZEN", "160 disclosure geometry is not frozen");
expect(fixed.specialGeometry?.disclosure160TwoLine?.invariants?.line1ToLine2BaselineGapPx?.[0] === 24, "160 disclosure baseline gap must be 24px");
expect(fixed.specialGeometry?.landingIcon200OnePixel?.status === "RESOLVED" && fixed.specialGeometry?.landingIcon200OnePixel?.classification === "PSD_AUTHORING_INCONSISTENCY", "200 landing icon one-pixel classification mismatch");
expect(fixed.specialGeometry?.thumbnail280CurrentRule?.status === "FROZEN" && fixed.specialGeometry?.thumbnail280CurrentRule?.width === 200 && fixed.specialGeometry?.thumbnail280CurrentRule?.height === 200, "280 thumbnail current rule mismatch");
expect(component("OBJECT_MAX_GUIDE_260")?.status === "DEFERRED_NON_BLOCKING" && component("OBJECT_MAX_GUIDE_260")?.n2Blocking === false, "260 semantics defer gate failed");

expect(cta.status === "SOURCE_CONFIRMED", "CTA registry status mismatch");
expect(cta.compact160200.allowedLabels.length === 11, "compact CTA allowed label count mismatch");
expect(cta.options280.length === 11 && cta.options280.every((entry) => entry.sourceOccurrences.length === 8), "280 CTA option source occurrence mismatch");
expect(cta.compact160200.chevron?.assetPngFormat === "RGBA_PNG", "compact CTA chevron asset format mismatch");

expect(sourceRevision.status === "SOURCE_CONFIRMED", "source revision status mismatch");
expect(sourceRevision.sourceRevision.hashSetMatch === true && sourceRevision.sourceRevision.hashMismatches === 0, "official/local source revision mismatch");
expect(sourceRevision.currentOfficialRules.thumbnail280.width === 200 && sourceRevision.currentOfficialRules.thumbnail280.height === 200 && sourceRevision.currentOfficialRules.thumbnail280.sourcePsdMatches === true, "current official 280 thumbnail rule mismatch");
expect(sourceRevision.currentOfficialRules.logoVerticalMargin24.top === 24 && sourceRevision.currentOfficialRules.logoVerticalMargin24.bottom === 24, "official logo vertical margin evidence missing");
expect(sourceRevision.currentOfficialRules.guide160200Changed.value === false, "160/200 guide change classification mismatch");

expect(n2.status === "REGISTRY_ONLY" && n2.candidates.length === 6, "N2 representative registry mismatch");
expect(n2.readiness?.ready === true && n2.readiness?.blockers?.length === 0 && n2.readiness?.runtimeFontMode === "PROJECT_COMPATIBLE_VERIFIED", "N2 readiness mismatch");
try {
  const validatePlacement = new Ajv2020({ strict: false, allErrors: true }).compile(objectPlacementSchema);
  expect(validatePlacement(objectPlacement), `object placement contract does not validate against schema${validatePlacement.errors ? `: ${JSON.stringify(validatePlacement.errors)}` : ""}`);
} catch (error) {
  expect(false, `object placement schema compilation failed: ${error instanceof Error ? error.message : String(error)}`);
}
expect(objectPlacement.registryVersion === "1.0.0" && objectPlacement.templateContractVersion === "1.10.0" && objectPlacement.tokens?.length === 39 && objectPlacement.templateMappings?.length === 120, "object placement registry summary mismatch");
expect(objectPlacement.n2Gate?.candidateTemplatesResolved === true && objectPlacement.n2Gate?.unresolvedCandidateCount === 0 && objectPlacement.n2Gate?.ready === true, "object placement N2 gate mismatch");

function walk(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(absolute));
    else if (entry.name.toLowerCase().endsWith(".psd")) files.push(absolute);
  }
  return files;
}

function digest(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function collectAssetPaths(value, found = []) {
  if (!value || typeof value !== "object") return found;
  if (typeof value.assetPath === "string") found.push(value);
  for (const child of Object.values(value)) collectAssetPaths(child, found);
  return found;
}

for (const asset of collectAssetPaths(fixed).concat(collectAssetPaths(cta))) {
  const absolute = path.join(root, asset.assetPath);
  expect(fs.existsSync(absolute), `missing extracted fixed asset ${asset.assetPath}`);
  if (fs.existsSync(absolute) && asset.assetPngSha256) expect(digest(absolute) === asset.assetPngSha256, `fixed asset digest mismatch ${asset.assetPath}`);
}

let sourceStatus = "NOT_AVAILABLE_EXTERNAL_ROOT";
if (fs.existsSync(sourceRoot)) {
  sourceStatus = "PASS";
  const filesByHash = new Map();
  for (const filePath of walk(sourceRoot)) filesByHash.set(digest(filePath), filePath);
  expect(filesByHash.size >= 120, `source root contains fewer than 120 distinct PSD digests (${filesByHash.size})`);
  for (const entry of templates) {
    const filePath = filesByHash.get(entry.source.sha256);
    expect(Boolean(filePath), `missing source PSD for ${entry.templateId}`);
    if (!filePath) continue;
    const bytes = fs.readFileSync(filePath);
    const width = bytes.readUInt32BE(18);
    const height = bytes.readUInt32BE(14);
    expect(bytes.subarray(0, 4).toString("ascii") === "8BPS" && bytes.readUInt16BE(4) === 1, `invalid PSD header for ${entry.templateId}`);
    expect(width === 750 && height === entry.height, `PSD canvas mismatch for ${entry.templateId}`);
  }
} else if (strictSource) {
  failures.push(`source root not found: ${sourceRoot}`);
}

const result = {
  status: failures.length === 0 ? "PASS" : "FAIL",
  sourceStatus,
  templateCount: templates.length,
  typographyTokenCount: typography.tokens.length,
  sourceRevision: sourceRevision.sourceRevision,
  n2Ready: n2.readiness?.ready === true,
  failures,
};
console.log(JSON.stringify(result, null, 2));
if (failures.length > 0) process.exitCode = 1;
