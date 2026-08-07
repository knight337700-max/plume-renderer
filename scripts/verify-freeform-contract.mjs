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
if (integrationSchemas.includes("1.5.0")) pass("integration_version_alignment", "Integration schemas align to v1.5.0");
else fail("integration_version_alignment", "v1.5.0 is absent from Integration schemas");

const versions = await readJson("contracts/contract-versions.json");
if (versions.documentVersion?.current === "1.10.0" && versions.integrationContract?.current === "1.5.0" && versions.templateContractVersion === "1.6.0" && versions.desktopAppVersion === "0.7.1") pass("version_policy", "Canonical 1.10.0 / Integration 1.5.0 / Template 1.6.0 / Desktop 0.7.1");
else fail("version_policy", JSON.stringify({ document: versions.documentVersion, integration: versions.integrationContract, template: versions.templateContractVersion, desktop: versions.desktopAppVersion }));
if (versions.creativeLayoutPlan?.schemaVersion === "1.0.0" && versions.creativeLayoutPlan?.implementationStatus === "NOT_IMPLEMENTED") pass("implementation_boundary", "FREEFORM schema is frozen and raster implementation is not started");
else fail("implementation_boundary", "FREEFORM implementation status is not NOT_IMPLEMENTED");

const formatProfiles = await readJson("contracts/freeform-format-profiles.json");
if (formatProfiles.catalogStatus === "CATALOG_NOT_READY" && formatProfiles.native1200?.dimensions === null && formatProfiles.native1200?.implementationStatus === "NOT_IMPLEMENTED") pass("format_profile_catalog", "native 1200 remains CATALOG_NOT_READY without inferred dimensions");
else fail("format_profile_catalog", "native 1200 was inferred or marked implemented");
if (formatProfiles.outputFormats?.PNG?.implementationStatus === "IMPLEMENTED_EXISTING_ENCODER" && formatProfiles.outputFormats?.JPG?.implementationStatus === "NOT_IMPLEMENTED_FREEFORM_V1") pass("output_format_boundary", "FREEFORM PNG reuses existing encoder; JPG remains NOT_IMPLEMENTED");
else fail("output_format_boundary", "FREEFORM output format status mismatch");
const testProfile = formatProfiles.profiles?.find((profile) => profile.formatProfileId === "KBR_FREEFORM_CONTRACT_TEST_1029X258");
if (testProfile?.canvas?.width === 1029 && testProfile?.canvas?.height === 258 && testProfile.layoutMode === "FREEFORM" && JSON.stringify(testProfile.allowedOutputFormats) === JSON.stringify(["PNG"])) pass("format_profile_identity", "internal test FormatProfile owns canvas and PNG capability");
else fail("format_profile_identity", "internal test FormatProfile mismatch");

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
  "KBR-FREEFORM-PLAN-MISSING", "KBR-FREEFORM-PLAN-SCHEMA-INVALID", "KBR-FREEFORM-FORMAT-PROFILE-MISMATCH", "KBR-FREEFORM-CANVAS-PROFILE-MISSING", "KBR-FREEFORM-ELEMENT-ID-DUPLICATE", "KBR-FREEFORM-ELEMENT-TYPE-NOT-SUPPORTED", "KBR-FREEFORM-BOUNDS-OUT-OF-RANGE", "KBR-FREEFORM-ZINDEX-INVALID", "KBR-FREEFORM-TEXT-COLOR-INVALID", "KBR-FREEFORM-TEXT-WRAP-NOT-SUPPORTED", "KBR-FREEFORM-TEXT-OVERFLOW", "KBR-FONT-NOT-REGISTERED", "KBR-FONT-ASSET-MISSING", "KBR-FONT-ASSET-DIGEST-MISMATCH", "KBR-FREEFORM-IMAGE-ASSET-NOT-FOUND", "KBR-FREEFORM-IMAGE-PLACEMENT-INVALID", "KBR-FREEFORM-BACKGROUND-COLOR-INVALID", "KBR-FREEFORM-OUTPUT-FORMAT-NOT-SUPPORTED",
];
const codes = new Set(integrationErrors.codes.map((entry) => entry.code));
if (requiredCodes.every((code) => codes.has(code))) pass("error_registry", `${requiredCodes.length} FREEFORM codes registered`);
else fail("error_registry", requiredCodes.filter((code) => !codes.has(code)).join(", "));
if (codes.size === integrationErrors.codes.length) pass("error_code_uniqueness", `${codes.size}/${codes.size} integration codes unique`);
else fail("error_code_uniqueness", "duplicate integration code found");

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
