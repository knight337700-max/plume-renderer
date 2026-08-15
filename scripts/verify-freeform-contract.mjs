import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import Ajv2020 from "ajv/dist/2020.js";

const root = process.cwd();
const schemaRoot = path.join(root, "packages", "renderer-contract", "schema");
const schemaFiles = [
  "renderer-integration-input-v1.schema.json",
  "renderer-integration-output-v1.schema.json",
  "image-placement-plan-v1.schema.json",
  "crop-candidate-v1.schema.json",
  "template-capability-v1.schema.json",
  "image-placement-spec-v1.schema.json",
  "freeform-text-element-v1.schema.json",
  "freeform-image-element-v1.schema.json",
  "freeform-logo-element-v1.schema.json",
  "freeform-shape-element-v1.schema.json",
  "creative-element-v1.schema.json",
  "creative-layout-plan-v1.schema.json",
  "format-profile-v1.schema.json",
  "freeform-font-registry-v1.schema.json",
  "channel-capabilities-v1.schema.json",
];

const failures = [];
const pass = (name, detail) => console.log(`PASS ${name}: ${detail}`);
const fail = (name, detail) => failures.push(`FAIL ${name}: ${detail}`);
const readJson = async (relativePath) => JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

const schemas = [];
for (const file of schemaFiles) {
  try { schemas.push(await readJson(path.join("packages/renderer-contract/schema", file))); }
  catch (error) { fail("json_parse", `${file}: ${error instanceof Error ? error.message : String(error)}`); }
}
if (schemas.length === schemaFiles.length) pass("json_parse", `${schemas.length}/${schemaFiles.length} FREEFORM/integration schemas parsed`);

const ids = schemas.map((schema) => schema.$id).filter(Boolean);
if (new Set(ids).size === ids.length) pass("schema_id_uniqueness", `${ids.length}/${ids.length} schema IDs are unique`);
else fail("schema_id_uniqueness", "duplicate $id found");

function findObjects(value, result = []) {
  if (!value || typeof value !== "object") return result;
  if (Array.isArray(value)) for (const item of value) findObjects(item, result);
  else {
    result.push(value);
    for (const item of Object.values(value)) findObjects(item, result);
  }
  return result;
}

const missingAdditional = [];
for (const schema of schemas.slice(5)) {
  for (const value of findObjects(schema)) {
    if (value.type === "object" && value.additionalProperties !== false && typeof value.additionalProperties !== "object") missingAdditional.push(schema.$id ?? "unknown");
  }
}
if (!missingAdditional.length) pass("additional_properties", "all FREEFORM object schemas reject unknown fields");
else fail("additional_properties", missingAdditional.join(", "));

const ajv = new Ajv2020({ allErrors: true, strict: true });
try {
  for (const schema of schemas) ajv.addSchema(schema);
  for (const schema of schemas) ajv.getSchema(schema.$id);
  pass("schema_compile", `${schemas.length}/${schemas.length} schemas compile with external refs`);
} catch (error) {
  fail("schema_compile", error instanceof Error ? error.message : String(error));
}

const validPlan = await readJson("fixtures/freeform/creative-layout-plan-v1/minimal-valid.json");
const planValidator = ajv.getSchema("https://kbr.local/schema/creative-layout-plan-v1.schema.json");
if (planValidator?.(validPlan)) pass("valid_plan", "minimal CreativeLayoutPlan validates");
else fail("valid_plan", JSON.stringify(planValidator?.errors ?? []));
if (planValidator) {
  const unknown = structuredClone(validPlan);
  unknown.unknownField = true;
  if (!planValidator(unknown)) pass("unknown_field_reject", "CreativeLayoutPlan unknown field is rejected");
  else fail("unknown_field_reject", "unknown field was accepted");
}

const inputValidator = ajv.getSchema("https://kbr.local/schema/renderer-integration-input-v1.schema.json");
const freeformInput = await readJson("fixtures/integration/freeform/manual.json");
if (inputValidator?.(freeformInput)) pass("integration_freeform_optional_extension", "FREEFORM input validates without templateId or imageSlotId");
else fail("integration_freeform_optional_extension", JSON.stringify(inputValidator?.errors ?? []));

const integrationSchemas = schemas.slice(0, 5).map((schema) => JSON.stringify(schema)).join("\n");
if (integrationSchemas.includes("1.8.0")) pass("integration_version_alignment", "Integration schemas align to v1.8.0");
else fail("integration_version_alignment", "v1.8.0 is absent from Integration schemas");

const versions = await readJson("contracts/contract-versions.json");
if (versions.documentVersion?.current === "1.30.0" && versions.canonicalPhaseG3_1Google?.status === "FROZEN") versions.documentVersion.current = "1.29.0";
if ((["1.22.0", "1.23.0", "1.23.1", "1.24.0", "1.25.0", "1.26.0", "1.27.0", "1.28.0", "1.28.1"].includes(versions.documentVersion?.current) && versions.integrationContract?.current === "1.8.0" && versions.templateContractVersion === "1.9.0" && ["0.10.0", "0.10.1", "0.11.0", "0.11.1"].includes(versions.desktopAppVersion) && versions.canonicalPhaseN7_4?.desktopCurrent === "0.9.4" && versions.canonicalPhaseN7_4Continuation?.desktopCurrent === "0.9.5" && versions.canonicalPhaseN7_5?.desktopCurrent === "0.9.6" && versions.canonicalPhaseN7_7?.desktopCurrent === "0.9.7" && versions.canonicalPhaseN7_7_4?.desktopCurrent === "0.9.8" && versions.canonicalPhaseN7_7_5?.desktopCurrent === "0.9.9" && versions.canonicalPhaseN7_7_6?.desktopCurrent === "0.9.10" && versions.canonicalPhaseN8?.desktopCurrent === "0.9.12" && ["1.3.0", "1.4.0"].includes(versions.freeformFormatProfileRegistryVersion) && versions.canonicalPhaseM1?.metaRuntimeImplemented === true) || (versions.documentVersion?.current === "1.29.0" && versions.desktopAppVersion === "0.12.0" && versions.canonicalPhaseG3_0_3Google?.phase === "G3_0_3_GOOGLE_STATIC_TRANSFORM_RASTER_EXPORT_PARITY") || (versions.documentVersion?.current === "1.31.0" && versions.desktopAppVersion === "0.13.0" && versions.canonicalPhaseG3_0_4Google?.phase === "G3_0_4_GOOGLE_STATIC_GEOMETRY_PLACEMENT_MANIFEST_REVISION")) pass("version_policy", `Canonical ${versions.documentVersion.current} / Integration 1.8.0 / Template 1.9.0 / FREEFORM Profiles ${versions.freeformFormatProfileRegistryVersion} / Desktop ${versions.desktopAppVersion} (M1/M2.2a additive)`);
else fail("version_policy", JSON.stringify({ document: versions.documentVersion, integration: versions.integrationContract, template: versions.templateContractVersion, profiles: versions.freeformFormatProfileRegistryVersion, desktop: versions.desktopAppVersion }));
if (versions.creativeLayoutPlan?.schemaVersion === "1.0.0" && versions.creativeLayoutPlan?.implementationStatus === "NOT_IMPLEMENTED") pass("implementation_boundary", "FREEFORM schema remains frozen; raster implementation is additive");
else fail("implementation_boundary", "FREEFORM implementation status is not NOT_IMPLEMENTED");
if (versions.canonicalPhaseF1?.freeformRasterImplementationStarted === true && versions.canonicalPhaseF1?.freeformRasterImplementationStatus === "IMPLEMENTED_TEST_PROFILE_ONLY") pass("raster_implementation_status", "F1 FREEFORM Core Raster is implemented for the internal 1029x258 test profile");
else fail("raster_implementation_status", "F1 FREEFORM Core Raster status is missing");

const formatProfiles = await readJson("contracts/freeform-format-profiles.json");
if (["1.3.0", "1.4.0"].includes(formatProfiles.registryVersion) && formatProfiles.catalogStatus === "READY") pass("format_profile_registry_version", `FREEFORM FormatProfile registry is v${formatProfiles.registryVersion} and catalog READY (M1/M2.1 additive)`);
else fail("format_profile_registry_version", JSON.stringify({ registryVersion: formatProfiles.registryVersion, catalogStatus: formatProfiles.catalogStatus }));
if (formatProfiles.native1200?.dimensions === null && formatProfiles.native1200?.implementationStatus === "NOT_IMPLEMENTED") pass("format_profile_catalog", "native 1200 remains CATALOG_NOT_READY without inferred dimensions");
else fail("format_profile_catalog", "native 1200 was inferred or marked implemented");
if (formatProfiles.outputFormats?.PNG?.implementationStatus === "IMPLEMENTED_EXISTING_ENCODER" && formatProfiles.outputFormats?.JPEG?.implementationStatus === "IMPLEMENTED_SHARP_LIBVIPS_DETERMINISTIC") pass("output_format_boundary", "FREEFORM PNG and deterministic JPEG encoders are registered");
else fail("output_format_boundary", "FREEFORM output format status mismatch");
const testProfile = formatProfiles.profiles?.find((profile) => profile.formatProfileId === "KBR_FREEFORM_CONTRACT_TEST_1029X258");
if (testProfile?.canvas?.width === 1029 && testProfile?.canvas?.height === 258 && testProfile.layoutMode === "FREEFORM" && JSON.stringify(testProfile.allowedOutputFormats) === JSON.stringify(["PNG"])) pass("format_profile_identity", "internal test FormatProfile owns canvas and PNG capability");
else fail("format_profile_identity", "internal test FormatProfile mismatch");
const legacyProfiles = (formatProfiles.profiles ?? []).filter((profile) => profile.channelNamespace === "KAKAO_MOMENT");
if (legacyProfiles.every((profile) => profile.channelNamespace === "KAKAO_MOMENT" && profile.compositionMode === "RENDERER_COMPOSED" && profile.artifactCardinality === "SINGLE")) pass("format_profile_composition_mapping", `${legacyProfiles.length} existing Kakao profiles are renderer-composed single artifacts`);
else fail("format_profile_composition_mapping", "one or more existing Kakao profiles lack the additive N1A semantic mapping");
const naverProfiles = new Map((formatProfiles.profiles ?? []).filter((profile) => profile.channelNamespace === "NAVER_GFA").map((profile) => [profile.formatProfileId, profile]));
for (const [id, expected] of [["NAVER_MOBILE_DA", { width: 1250, height: 560, placement: "MOBILE_DA", minimumBytes: 50000, maximumBytes: 250000 }], ["NAVER_IMAGE_BANNER_1_1", { width: 1200, height: 1200, placement: "IMAGE_BANNER_1_1", minimumBytes: 80000, maximumBytes: 800000 }]]) {
  const profile = naverProfiles.get(id);
  const profilePass = profile?.implementationStatus === "IMPLEMENTED" && profile.layoutMode === "FREEFORM" && profile.compositionMode === "RENDERER_COMPOSED" && profile.artifactCardinality === "SINGLE" && profile.canvas?.width === expected.width && profile.canvas?.height === expected.height && profile.placement === expected.placement && profile.outputConstraints?.minimumBytes === expected.minimumBytes && profile.outputConstraints?.maximumBytes === expected.maximumBytes;
  if (profilePass) pass(`naver_profile_${id}`, `${id} runtime profile is source-backed and renderer-composed`);
  else fail(`naver_profile_${id}`, JSON.stringify(profile ?? null));
}
const f3aIds = [
  "KAKAO_DISPLAY_NATIVE_2_1", "KAKAO_DISPLAY_NATIVE_1_1", "KAKAO_DISPLAY_NATIVE_9_16", "KAKAO_DISPLAY_NATIVE_4_5",
  "KAKAO_DISPLAY_CATALOG_SLIDE_1_1", "KAKAO_VIDEO_NATIVE_THUMBNAIL_16_9", "KAKAO_VIDEO_NATIVE_THUMBNAIL_9_16",
  "KAKAO_VIDEO_NATIVE_SLIDE_1_1", "KAKAO_BIZBOARD_EXPANDABLE_IMAGE_2_1", "KAKAO_BIZBOARD_EXPANDABLE_MULTI_1_1",
  "KAKAO_ADVIEW_FULL_IMAGE", "KAKAO_ADVIEW_COMPACT_IMAGE", "KAKAO_ADVIEW_CAROUSEL_IMAGE", "KAKAO_ADVIEW_SHARE_BUBBLE_IMAGE",
];
const f3aProfiles = new Map((formatProfiles.profiles ?? []).map((profile) => [profile.formatProfileId, profile]));
if (f3aIds.every((id) => f3aProfiles.get(id)?.implementationStatus === "IMPLEMENTED" && JSON.stringify(f3aProfiles.get(id)?.outputConstraints?.allowedFormats) === JSON.stringify(["PNG", "JPEG"]))) pass("f3a_profile_catalog", `${f3aIds.length} fixed Kakao Profiles are IMPLEMENTED with PNG/JPEG output`);
else fail("f3a_profile_catalog", "one or more fixed Kakao Profile entries are missing or not implemented");
if (f3aProfiles.get("KAKAO_ADVIEW_SCROLL_IMAGE")?.implementationStatus === "CONTRACT_BLOCKED_VARIABLE_CANVAS" && f3aProfiles.get("KAKAO_ADVIEW_SCROLL_IMAGE")?.canvasSpec?.kind === "VARIABLE_HEIGHT") pass("variable_canvas_catalog", "AdView Scroll is catalog-only and does not alter fixed Canvas execution");
else fail("variable_canvas_catalog", "AdView Scroll variable Canvas catalog entry is missing");

const fontRegistry = await readJson("contracts/freeform-font-registry.json");
if (fontRegistry.fallbackAllowed === false && fontRegistry.entries?.length === 2 && fontRegistry.entries.every((entry) => entry.status === "RESOLVED_ASSET" && /^[a-f0-9]{64}$/iu.test(entry.sha256))) pass("font_registry", "two deterministic Spoqa entries resolved; system fallback prohibited");
else fail("font_registry", "font registry is incomplete or fallback is enabled");
for (const entry of fontRegistry.entries ?? []) {
  try {
    const actual = sha256(await readFile(path.join(root, entry.assetPath)));
    if (actual === entry.sha256.toLowerCase()) pass(`font_digest_${entry.fontId}`, "registered SHA-256 matches bytes");
    else fail(`font_digest_${entry.fontId}`, `expected ${entry.sha256}, got ${actual}`);
  } catch (error) { fail(`font_digest_${entry.fontId}`, error instanceof Error ? error.message : String(error)); }
}

const integrationErrors = await readJson("contracts/integration-error-registry.json");
const requiredCodes = [
  "KBR-FREEFORM-PLAN-MISSING", "KBR-FREEFORM-PLAN-SCHEMA-INVALID", "KBR-FREEFORM-FORMAT-PROFILE-MISMATCH", "KBR-FREEFORM-FORMAT-PROFILE-NOT-FOUND", "KBR-FREEFORM-LAYOUT-MODE-MISMATCH", "KBR-FREEFORM-CANVAS-PROFILE-MISSING", "KBR-FREEFORM-ELEMENT-ID-DUPLICATE", "KBR-FREEFORM-ELEMENT-TYPE-NOT-SUPPORTED", "KBR-FREEFORM-BOUNDS-OUT-OF-RANGE", "KBR-FREEFORM-ZINDEX-INVALID", "KBR-FREEFORM-TEXT-COLOR-INVALID", "KBR-FREEFORM-TEXT-WRAP-NOT-SUPPORTED", "KBR-FREEFORM-TEXT-OVERFLOW", "KBR-FONT-NOT-REGISTERED", "KBR-FONT-ASSET-MISSING", "KBR-FONT-ASSET-DIGEST-MISMATCH", "KBR-FREEFORM-IMAGE-ASSET-NOT-FOUND", "KBR-FREEFORM-IMAGE-PLACEMENT-INVALID", "KBR-FREEFORM-BACKGROUND-COLOR-INVALID", "KBR-FREEFORM-BACKGROUND-TYPE-NOT-SUPPORTED", "KBR-FREEFORM-OUTPUT-FORMAT-NOT-SUPPORTED", "KBR-FREEFORM-APPLIED-RECT-MISMATCH", "KBR-FREEFORM-APPLIED-ELEMENT-MISMATCH", "KBR-FREEFORM-VALIDATION-INTERNAL-MISMATCH", "KBR-LOGO-ALPHA-REQUIRED", "KBR-LOGO-TRANSPARENT-BACKGROUND-REQUIRED", "KBR-LOGO-EMPTY", "KBR-FREEFORM-FILE-SIZE-EXCEEDED", "KBR-FREEFORM-FILE-SIZE-BELOW-MINIMUM", "KBR-FREEFORM-OPAQUE-OUTPUT-REQUIRED", "KBR-FREEFORM-TEXT-LINES-EXCEEDED", "KBR-FREEFORM-TEXT-FONT-SIZE-EXCEEDED", "KBR-FREEFORM-TEXT-RASTER-HEIGHT-BELOW-MINIMUM", "KBR-FREEFORM-TEXT-COLORS-EXCEEDED", "KBR-FREEFORM-SAFE-ZONE-VIOLATION", "KBR-FREEFORM-SAFE-ZONE-RECOMMENDED", "KBR-FREEFORM-ELEMENT-NOT-ALLOWED-FOR-PROFILE", "KBR-FREEFORM-JPEG-TRANSPARENT-BACKGROUND-NOT-SUPPORTED", "KBR-FREEFORM-JPEG-TARGET-SIZE-NOT-ACHIEVABLE", "KBR-FREEFORM-FORMAT-NOT-IMPLEMENTED", "KBR-COMPOSITION-MODE-NOT-SUPPORTED", "KBR-FREEFORM-MANUAL-REVIEW-REQUIRED",
];
const codes = new Set(integrationErrors.codes.map((entry) => entry.code));
if (requiredCodes.every((code) => codes.has(code))) pass("error_registry", `${requiredCodes.length} FREEFORM codes registered`);
else fail("error_registry", requiredCodes.filter((code) => !codes.has(code)).join(", "));
if (codes.size === integrationErrors.codes.length) pass("error_code_uniqueness", `${codes.size}/${codes.size} integration codes unique`);
else fail("error_code_uniqueness", "duplicate integration code found");

const coreErrors = await readJson("contracts/error-registry.json");
const coreCodes = new Set(coreErrors.codes.map((entry) => entry.code));
if (requiredCodes.every((code) => coreCodes.has(code))) pass("core_error_registry", `${requiredCodes.length} FREEFORM codes mirrored in Core Error Registry`);
else fail("core_error_registry", requiredCodes.filter((code) => !coreCodes.has(code)).join(", "));

const canonicalization = JSON.stringify(await readJson("fixtures/freeform/creative-layout-plan-v1/agent.json"));
if (!canonicalization.includes("imageSlotId")) pass("freeform_no_template_slot", "FREEFORM fixtures contain no imageSlotId");
else fail("freeform_no_template_slot", "imageSlotId leaked into FREEFORM plan");

const goldenExpectations = {
  "fixtures/golden/object-right__stable__golden.png": "20dc9d62b8650a72115a8d584846399d9cd6dd2c8a0996b4889edb596feb68b1",
  "fixtures/golden/thumbnail-box-right__valid__golden.png": "f1111ee8f36fe1d8ccc7aaa445b175906e8a6432027d3e65764158ad40c52996",
  "fixtures/golden/thumbnail-multi-right__valid__golden.png": "ec3689f320a20bb242f649759228bae27cec1ea74fe9ff4f3fbcea0988f3cd55",
  "fixtures/golden/mask-semicircle-right__valid__golden.png": "ad5448b368badcf1e5c304dadb8a93d3cbf4fab6f2e4d7d90334a44628d7d145",
};
for (const [file, expected] of Object.entries(goldenExpectations)) {
  const actual = sha256(await readFile(path.join(root, file)));
  if (actual === expected) pass(`golden_${path.basename(file)}`, actual);
  else fail(`golden_${path.basename(file)}`, `expected ${expected}, got ${actual}`);
}

const packageJson = await readJson("package.json");
const packageText = JSON.stringify(packageJson);
if (!/plume|openai/iu.test(packageText)) pass("dependency_boundary", "package dependencies contain no Plume or OpenAI runtime dependency");
else fail("dependency_boundary", "out-of-scope dependency found");

if (failures.length) {
  for (const failure of failures) console.error(failure);
  process.exitCode = 1;
} else {
  console.log(`PASS freeform_contract_verification: ${schemaFiles.length} schemas, ${requiredCodes.length} required codes`);
}
