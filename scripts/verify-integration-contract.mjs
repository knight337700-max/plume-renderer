import { access, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const schemaRoot = path.join(root, "packages", "renderer-contract", "schema");
const schemaFiles = [
  "renderer-integration-input-v1.schema.json",
  "renderer-integration-output-v1.schema.json",
  "image-placement-plan-v1.schema.json",
  "crop-candidate-v1.schema.json",
  "template-capability-v1.schema.json",
];

const failures = [];
const pass = (name, detail) => console.log(`PASS ${name}: ${detail}`);
const fail = (name, detail) => failures.push(`FAIL ${name}: ${detail}`);
const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));

const schemas = [];
for (const file of schemaFiles) {
  try {
    const value = await readJson(path.join(schemaRoot, file));
    schemas.push(value);
  } catch (error) {
    fail("json_parse", `${file}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
if (schemas.length === schemaFiles.length) pass("json_parse", `${schemas.length}/${schemaFiles.length} integration schemas parsed`);

const ids = schemas.map((schema) => schema.$id).filter(Boolean);
if (new Set(ids).size === ids.length) pass("schema_id_uniqueness", `${ids.length}/${ids.length} integration schema IDs are unique`);
else fail("schema_id_uniqueness", "duplicate $id found");

function findObjects(value, result = []) {
  if (!value || typeof value !== "object") return result;
  if (Array.isArray(value)) {
    for (const item of value) findObjects(item, result);
  } else {
    result.push(value);
    for (const item of Object.values(value)) findObjects(item, result);
  }
  return result;
}

const missingAdditional = [];
for (const schema of schemas) {
  for (const value of findObjects(schema)) {
    if (value.type === "object" && value.additionalProperties !== false && typeof value.additionalProperties !== "object") missingAdditional.push(schema.$id ?? "unknown");
  }
}
if (missingAdditional.length === 0) pass("additional_properties", "all object schemas explicitly reject unknown fields");
else fail("additional_properties", missingAdditional.join(", "));

if (schemas.every((schema) => JSON.stringify(schema).includes("1.7.0"))) pass("schema_versioning", "all Integration Contract schemas declare v1.7.0");
else fail("schema_versioning", "one or more schemas do not declare v1.7.0");

const registry = await readJson(path.join(root, "contracts", "integration-error-registry.json"));
const registryCodes = registry.codes.map((entry) => entry.code);
if (new Set(registryCodes).size === registryCodes.length) pass("error_code_uniqueness", `${registryCodes.length}/${registryCodes.length} integration error codes are unique`);
else fail("error_code_uniqueness", "duplicate integration error code found");

const requiredCodes = [
  "KBR-PLACEMENT-PLAN-MISSING", "KBR-PLACEMENT-POLICY-NOT-ALLOWED", "KBR-PLACEMENT-PLAN-DUPLICATE", "KBR-ASSET-NOT-FOUND", "KBR-ASSET-UNUSED", "KBR-ASSET-CHECKSUM-MISMATCH", "KBR-ASSET-DIMENSION-MISMATCH", "KBR-ASSET-MIME-NOT-ALLOWED", "KBR-ASSET-MIME-EXTENSION-MISMATCH", "KBR-IMAGE-SLOT-NOT-FOUND", "KBR-IMAGE-SLOT-ASSET-COUNT", "KBR-CROP-RECT-REQUIRED", "KBR-CROP-RECT-FORBIDDEN", "KBR-CROP-RECT-OUT-OF-BOUNDS", "KBR-CROP-CANDIDATE-NOT-FOUND", "KBR-CROP-CANDIDATE-MISMATCH", "KBR-FOCAL-POINT-OUT-OF-BOUNDS", "KBR-PROTECTED-SUBJECT-CLIPPED", "KBR-PROTECTED-SUBJECT-DATA-MISSING", "KBR-ALPHA-CHANNEL-REQUIRED", "KBR-ALPHA-TRIM-FAILED", "KBR-IMAGE-DECODE-FAILED", "KBR-IMAGE-DIMENSION-INVALID", "KBR-EXIF-ORIENTATION-INVALID", "KBR-IMAGE-SLOT-OVERFLOW", "KBR-TEMPLATE-CONSTRAINT-VIOLATION", "KBR-TEXT-COUNT-HEADLINE-001", "KBR-TEXT-COUNT-SUBCOPY-001", "KBR-TEXT-004", "KBR-TEXT-005", "KBR-TEXT-WIDTH-HEADLINE-W001", "KBR-TEXT-WIDTH-SUBCOPY-W001", "KBR-SEMANTIC-PLACEMENT-REQUIRED", "KBR-OUTPUT-INVALID", "KBR-ASSET-REF-UNRESOLVED",
  "KBR-LOGO-ASSET-MISSING", "KBR-LOGO-PLAN-MISSING", "KBR-LOGO-ALPHA-REQUIRED", "KBR-LOGO-TRANSPARENT-BACKGROUND-REQUIRED", "KBR-LOGO-EMPTY", "KBR-LOGO-SLOT-OVERFLOW", "KBR-LOGO-UPSCALE-LIMIT", "KBR-LOGO-ASSET-DUPLICATE", "KBR-MASK-ASSET-MISSING", "KBR-MASK-ASSET-DIGEST-MISMATCH",
];
if (requiredCodes.every((code) => registryCodes.includes(code))) pass("required_error_codes", `${requiredCodes.length}/${requiredCodes.length} required integration codes registered`);
else fail("required_error_codes", "one or more required integration codes missing");

const contract = await readJson(path.join(root, "contracts", "contract-versions.json"));
if (contract.templateContractVersion === "1.6.0") pass("template_contract", "templateContractVersion is 1.6.0");
else fail("template_contract", `expected 1.6.0, got ${contract.templateContractVersion}`);
if (contract.integrationContract?.current === "1.7.0") pass("integration_contract_version", "Integration Contract is v1.7.0");
else fail("integration_contract_version", `expected Integration Contract v1.7.0, got ${contract.integrationContract?.current ?? "missing"}`);

const capabilities = await readJson(path.join(root, "contracts", "template-capabilities.json"));
const enabled = capabilities.capabilities.filter((entry) => entry.implementationStatus === "IMPLEMENTED").map((entry) => entry.formatProfileId);
if (enabled.length === 4 && enabled.includes("KAKAO_BIZBOARD_OBJECT_RIGHT") && enabled.includes("KAKAO_BIZBOARD_THUMBNAIL_BOX_RIGHT") && enabled.includes("KAKAO_BIZBOARD_THUMBNAIL_MULTI_RIGHT") && enabled.includes("KAKAO_BIZBOARD_MASK_SEMICIRCLE_RIGHT")) pass("capability_gate", "OBJECT_RIGHT, THUMBNAIL_BOX_RIGHT, THUMBNAIL_MULTI_RIGHT, and MASK_SEMICIRCLE_RIGHT are IMPLEMENTED");
else fail("capability_gate", `implemented=${enabled.join(",")}`);
const objectCapability = capabilities.capabilities.find((entry) => entry.formatProfileId === "KAKAO_BIZBOARD_OBJECT_RIGHT");
const thumbnailCapability = capabilities.capabilities.find((entry) => entry.formatProfileId === "KAKAO_BIZBOARD_THUMBNAIL_BOX_RIGHT");
if (JSON.stringify(objectCapability?.allowedInputMimeTypes) === JSON.stringify(["image/png"]) && objectCapability?.alphaChannelRequired === true && JSON.stringify(thumbnailCapability?.allowedInputMimeTypes) === JSON.stringify(["image/png", "image/jpeg"]) && thumbnailCapability?.alphaChannelRequired === false) pass("capability_mime_gate", "OBJECT_RIGHT=alpha PNG only; THUMBNAIL_BOX_RIGHT=PNG/JPEG without alpha requirement");
else fail("capability_mime_gate", "template input MIME or alpha requirement mismatch");
const multiCapability = capabilities.capabilities.find((entry) => entry.formatProfileId === "KAKAO_BIZBOARD_THUMBNAIL_MULTI_RIGHT");
if (multiCapability?.implementationStatus === "IMPLEMENTED" && JSON.stringify(multiCapability.imageSlotIds) === JSON.stringify(["IMAGE_PRIMARY", "IMAGE_SECONDARY"]) && JSON.stringify(multiCapability.allowedInputMimeTypes) === JSON.stringify(["image/png", "image/jpeg"]) && multiCapability.minimumAssets === 1 && multiCapability.maximumAssets === 2 && multiCapability.requiredPlacementPlans === 2) pass("multi_slot_capability", "THUMBNAIL_MULTI_RIGHT has two required slots and PNG/JPEG 1..2 asset range");
else fail("multi_slot_capability", "THUMBNAIL_MULTI_RIGHT capability metadata mismatch");
const maskCapability = capabilities.capabilities.find((entry) => entry.formatProfileId === "KAKAO_BIZBOARD_MASK_SEMICIRCLE_RIGHT");
if (maskCapability?.implementationStatus === "IMPLEMENTED" && JSON.stringify(maskCapability.imageSlotIds) === JSON.stringify(["IMAGE_PRIMARY", "LOGO_PRIMARY"]) && maskCapability.minimumAssets === 1 && maskCapability.maximumAssets === 2 && maskCapability.requiredPlacementPlans === 1 && maskCapability.slotCapabilities?.find((entry) => entry.slotId === "IMAGE_PRIMARY")?.required === true && maskCapability.slotCapabilities?.find((entry) => entry.slotId === "LOGO_PRIMARY")?.required === false && maskCapability.slotCapabilities?.find((entry) => entry.slotId === "LOGO_PRIMARY")?.colorRestriction === "NONE" && !Object.prototype.hasOwnProperty.call(maskCapability.slotCapabilities?.find((entry) => entry.slotId === "LOGO_PRIMARY") ?? {}, "blackMonochromeRequired")) pass("mask_slot_capability", "MASK_SEMICIRCLE_RIGHT has required image and optional color-unrestricted overlay logo capability");
else fail("mask_slot_capability", "MASK_SEMICIRCLE_RIGHT capability metadata mismatch");

const fixtureDirectories = [
  "alpha-trim-contain",
  "center-contain",
  "manual-crop",
  "agent-semantic-crop",
  "invalid",
  "equivalence",
  "thumbnail-box-right",
  "thumbnail-multi-right",
  "mask-semicircle-right",
];
const multiFixtureDirectories = [
  "two-assets-manual-pass",
  "two-assets-agent-pass",
  "mixed-policies-pass",
  "same-asset-two-crops-pass",
  "jpeg-png-mixed-pass",
  "primary-missing-error",
  "secondary-missing-error",
  "duplicate-primary-plan-error",
  "unknown-slot-error",
  "primary-candidate-pass",
  "secondary-candidate-pass",
  "cross-slot-candidate-error",
  "required-subject-clipped-primary-error",
  "preferred-subject-clipped-secondary-warning",
  "plan-order-equivalence",
  "manual-agent-equivalence",
];
const missingFixtures = [];
for (const directory of fixtureDirectories) {
  try { await access(path.join(root, "fixtures", "integration", directory)); } catch { missingFixtures.push(directory); }
}
if (missingFixtures.length === 0) pass("fixture_layout", `${fixtureDirectories.length}/${fixtureDirectories.length} integration fixture directories present`);
else fail("fixture_layout", missingFixtures.join(", "));
const missingMultiFixtures = [];
for (const directory of multiFixtureDirectories) {
  try { await access(path.join(root, "fixtures", "integration", "thumbnail-multi-right", directory)); } catch { missingMultiFixtures.push(directory); }
}
if (missingMultiFixtures.length === 0) pass("thumbnail_multi_fixture_layout", `${multiFixtureDirectories.length}/${multiFixtureDirectories.length} THUMBNAIL_MULTI_RIGHT fixture directories present`);
else fail("thumbnail_multi_fixture_layout", missingMultiFixtures.join(", "));
const maskFixtureDirectories = ["valid-black-logo-pass", "jpeg-image-no-logo-pass", "jpeg-image-black-logo-pass", "logo-missing-plan-error", "logo-plan-missing-asset-error", "colored-logo-pass", "white-logo-pass", "opaque-logo-error", "empty-logo-error", "logo-crop-forbidden-error", "logo-upscale-error", "image-missing-error", "required-subject-clipped-error", "mask-digest-error", "plan-order-equivalence", "manual-agent-equivalence"];
const missingMaskFixtures = [];
for (const directory of maskFixtureDirectories) {
  try { await access(path.join(root, "fixtures", "integration", "mask-semicircle-right", directory)); } catch { missingMaskFixtures.push(directory); }
}
if (missingMaskFixtures.length === 0) pass("mask_fixture_layout", `${maskFixtureDirectories.length}/${maskFixtureDirectories.length} MASK_SEMICIRCLE_RIGHT fixture directories present`);
else fail("mask_fixture_layout", missingMaskFixtures.join(", "));

const serializedSchemaText = schemas.map((schema) => JSON.stringify(schema)).join("\n");
if (!/Blob|Uint8Array|absolutePath|absolute path/iu.test(serializedSchemaText)) pass("json_serializable", "JSON Schemas do not expose Blob, Uint8Array, or absolute paths");
else fail("json_serializable", "forbidden runtime/absolute path type found in JSON Schemas");

if (failures.length) {
  for (const failure of failures) console.error(failure);
  process.exitCode = 1;
} else {
  console.log(`PASS integration_contract_verification: ${schemaFiles.length} schemas, ${registryCodes.length} error codes`);
}
