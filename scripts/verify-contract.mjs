import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
const contractsDir = path.join(root, "contracts");

const results = [];

function check(name, condition, detail) {
  results.push({ name, status: condition ? "PASS" : "FAIL", detail });
}

async function sha256(filePath) {
  const bytes = await readFile(filePath);
  return createHash("sha256").update(bytes).digest("hex");
}

function hasKeyDeep(value, targetKey) {
  if (!value || typeof value !== "object") return false;
  if (Object.prototype.hasOwnProperty.call(value, targetKey)) return true;
  return Object.values(value).some((child) => hasKeyDeep(child, targetKey));
}

const contractNames = (await readdir(contractsDir))
  .filter((name) => name.endsWith(".json"))
  .sort();

const contracts = new Map();
let parseOk = true;
for (const name of contractNames) {
  try {
    contracts.set(name, JSON.parse(await readFile(path.join(contractsDir, name), "utf8")));
  } catch (error) {
    parseOk = false;
    results.push({ name: `json:${name}`, status: "FAIL", detail: error.message });
  }
}
check("json_parse", parseOk, `${contracts.size}/${contractNames.length} contract JSON files parsed`);

const schemaIds = [];
for (const [name, value] of contracts) {
  if (typeof value.$id === "string") schemaIds.push({ name, id: value.$id });
}
const uniqueSchemaIds = new Set(schemaIds.map(({ id }) => id));
check(
  "schema_id_uniqueness",
  uniqueSchemaIds.size === schemaIds.length,
  `${uniqueSchemaIds.size}/${schemaIds.length} schema IDs are unique`,
);

const errorRegistry = contracts.get("error-registry.json");
const errorCodes = errorRegistry?.codes?.map(({ code }) => code) ?? [];
check(
  "error_code_uniqueness",
  new Set(errorCodes).size === errorCodes.length,
  `${new Set(errorCodes).size}/${errorCodes.length} error codes are unique`,
);
check(
  "download_error_registered",
  errorCodes.includes("KBR-DOWNLOAD-001"),
  "KBR-DOWNLOAD-001 is present",
);

const ajvMapping = contracts.get("ajv-error-mapping.json");
const requiredAjvKeywords = [
  "required",
  "type",
  "enum",
  "const",
  "additionalProperties",
  "minLength",
  "maxLength",
  "minimum",
  "maximum",
  "pattern",
  "oneOf",
  "anyOf",
];
const mappedKeywords = new Set(ajvMapping?.keywordMappings?.map(({ keyword }) => keyword) ?? []);
const mappedCodes = new Set([
  ajvMapping?.defaultCode,
  ...(ajvMapping?.keywordMappings ?? []).flatMap((entry) => [
    entry.defaultCode,
    ...(entry.pathOverrides ?? []).map(({ code }) => code),
  ]),
]);
check(
  "ajv_keyword_coverage",
  requiredAjvKeywords.every((keyword) => mappedKeywords.has(keyword)),
  `${requiredAjvKeywords.filter((keyword) => mappedKeywords.has(keyword)).length}/${requiredAjvKeywords.length} required keywords mapped`,
);
check(
  "ajv_mapping_registry_integrity",
  [...mappedCodes].every((code) => errorCodes.includes(code)),
  `${mappedCodes.size} mapped KBR codes exist in the Error Registry`,
);

const ctaRegistry = contracts.get("cta-registry.json");
const enabledCtaModes = ctaRegistry?.modes?.filter(({ enabled }) => enabled).map(({ id }) => id) ?? [];
check(
  "cta_registry",
  enabledCtaModes.length === 1 && enabledCtaModes[0] === "NONE",
  `enabled modes: ${enabledCtaModes.join(", ") || "none"}`,
);

const approvedIcons = contracts.get("approved-icons.json");
const iconAssets = approvedIcons?.assets ?? [];
const nonNoneModesDisabled = ctaRegistry?.modes
  ?.filter(({ id }) => id !== "NONE")
  .every(({ enabled }) => enabled === false);
check(
  "approved_icon_gate",
  iconAssets.length > 0 || nonNoneModesDisabled === true,
  `${iconAssets.length} approved icons; non-NONE modes disabled=${nonNoneModesDisabled}`,
);

const versions = contracts.get("contract-versions.json");
check(
  "template_contract_version",
  versions?.templateContractVersion === "1.3.0" &&
    versions?.coordinatesChanged === true &&
    versions?.xCoordinatesChanged === false &&
    versions?.baselineDeltaPx === 4,
  `version=${versions?.templateContractVersion}; baselineDeltaPx=${versions?.baselineDeltaPx}; xCoordinatesChanged=${versions?.xCoordinatesChanged}`,
);

const inputSchema = contracts.get("input.schema.json");
const outputSchema = contracts.get("output.schema.json");
const manifestSchema = contracts.get("render-manifest.schema.json");
const responseSchema = contracts.get("response-envelope.schema.json");
check(
  "schema_versions",
  inputSchema?.properties?.schemaVersion?.const === "1.2.0" &&
    outputSchema?.properties?.schemaVersion?.const === "2.0.0" &&
    manifestSchema?.properties?.schemaVersion?.const === "1.0.0" &&
    responseSchema?.properties?.schemaVersion?.const === "1.0.0",
  "input=1.2.0 output=2.0.0 manifest=1.0.0 response=1.0.0",
);
check(
  "public_execution_modes",
  !Object.prototype.hasOwnProperty.call(inputSchema?.properties ?? {}, "dryRun") &&
    !Object.prototype.hasOwnProperty.call(inputSchema?.properties ?? {}, "validateOnly"),
  "dryRun and validateOnly are absent from public Input Schema",
);

const fixtureRegistry = contracts.get("reference-fixture.json");
const fixture = fixtureRegistry?.fixture;
const fixturePath = path.join(root, ...(fixture?.path?.split("/") ?? []));
const actualFixtureHash = await sha256(fixturePath);
check(
  "reference_hash",
  actualFixtureHash === fixture?.sha256,
  `expected=${fixture?.sha256}; actual=${actualFixtureHash}`,
);

const png = await readFile(fixturePath);
const signature = png.subarray(0, 8).toString("hex");
const ihdrType = png.subarray(12, 16).toString("ascii");
const ihdr = {
  width: png.readUInt32BE(16),
  height: png.readUInt32BE(20),
  bitDepth: png.readUInt8(24),
  colorType: png.readUInt8(25),
};
check(
  "reference_png_ihdr",
  signature === "89504e470d0a1a0a" && ihdrType === "IHDR" && ihdr.width === 1029 && ihdr.height === 258 && ihdr.bitDepth === 8 && ihdr.colorType === 6,
  JSON.stringify(ihdr),
);
check(
  "template_coordinates",
  fixture?.objectSlot?.x === 666 &&
    fixture?.objectSlot?.y === 0 &&
    fixture?.objectSlot?.width === 315 &&
    fixture?.objectSlot?.height === 258,
  JSON.stringify(fixture?.objectSlot),
);
const thumbnailFixture = fixtureRegistry?.templates?.thumbnailBoxRight;
const thumbnailFixturePath = path.join(root, ...(thumbnailFixture?.path?.split("/") ?? []));
let actualThumbnailHash = null;
try {
  actualThumbnailHash = await sha256(thumbnailFixturePath);
} catch {
  actualThumbnailHash = null;
}
check(
  "thumbnail_reference_hash",
  actualThumbnailHash === thumbnailFixture?.sha256,
  `expected=${thumbnailFixture?.sha256}; actual=${actualThumbnailHash}`,
);
check(
  "thumbnail_coordinates",
  thumbnailFixture?.png?.width === 1029 &&
    thumbnailFixture?.png?.height === 258 &&
    thumbnailFixture?.imageSlot?.id === "IMAGE_PRIMARY" &&
    thumbnailFixture?.imageSlot?.x === 666 &&
    thumbnailFixture?.imageSlot?.y === 36 &&
    thumbnailFixture?.imageSlot?.width === 315 &&
    thumbnailFixture?.imageSlot?.height === 186,
  JSON.stringify(thumbnailFixture?.imageSlot),
);
const thumbnailMultiFixture = fixtureRegistry?.templates?.thumbnailMultiRight;
const thumbnailMultiFixturePath = path.join(root, ...(thumbnailMultiFixture?.path?.split("/") ?? []));
let actualThumbnailMultiHash = null;
try {
  actualThumbnailMultiHash = await sha256(thumbnailMultiFixturePath);
} catch {
  actualThumbnailMultiHash = null;
}
check(
  "thumbnail_multi_reference_hash",
  actualThumbnailMultiHash === thumbnailMultiFixture?.sha256,
  `expected=${thumbnailMultiFixture?.sha256}; actual=${actualThumbnailMultiHash}`,
);
const multiSlots = thumbnailMultiFixture?.imageSlots ?? [];
check(
  "thumbnail_multi_coordinates",
  thumbnailMultiFixture?.png?.width === 1029 &&
    thumbnailMultiFixture?.png?.height === 258 &&
    thumbnailMultiFixture?.text?.hardRightEdgeExclusive === 588 &&
    thumbnailMultiFixture?.slotGapPx === 16 &&
    thumbnailMultiFixture?.rightTransparentMarginPx === 48 &&
    thumbnailMultiFixture?.topMarginPx === 43 &&
    thumbnailMultiFixture?.bottomMarginPx === 43 &&
    multiSlots.length === 2 &&
    multiSlots[0]?.id === "IMAGE_PRIMARY" &&
    multiSlots[0]?.order === 0 &&
    multiSlots[0]?.x === 621 &&
    multiSlots[0]?.y === 43 &&
    multiSlots[0]?.width === 172 &&
    multiSlots[0]?.height === 172 &&
    multiSlots[0]?.cornerRadiusPx === 12 &&
    multiSlots[1]?.id === "IMAGE_SECONDARY" &&
    multiSlots[1]?.order === 1 &&
    multiSlots[1]?.x === 809 &&
    multiSlots[1]?.y === 43 &&
    multiSlots[1]?.width === 172 &&
    multiSlots[1]?.height === 172 &&
    multiSlots[1]?.cornerRadiusPx === 12,
  JSON.stringify({ text: thumbnailMultiFixture?.text, slots: multiSlots }),
);

check(
  "manifest_no_self_digest",
  !hasKeyDeep(manifestSchema?.properties ?? {}, "manifestDigest") &&
    !hasKeyDeep(manifestSchema?.properties ?? {}, "manifestSha256"),
  "persisted manifest has no self-digest field",
);

const outputPng = outputSchema?.properties?.png?.properties;
check(
  "png_contract",
  outputPng?.format?.const === "PNG" &&
    outputPng?.colorType?.const === "RGBA" &&
    outputPng?.bitDepth?.const === 8 &&
    outputPng?.hasAlpha?.const === true &&
    outputPng?.width?.const === 1029 &&
    outputPng?.height?.const === 258,
  "PNG IHDR contract is RGBA color type 6, 8-bit channels, 1029x258",
);
check(
  "size_constants",
  versions?.fileSizePolicy?.hardLimitBytes === 300000 &&
    versions?.fileSizePolicy?.warningThresholdBytes === 270000 &&
    outputPng?.bytes?.maximum === 300000,
  JSON.stringify(versions?.fileSizePolicy),
);
check(
  "artifact_counts",
  outputSchema?.properties?.pngCount?.const === 1 &&
    outputSchema?.properties?.manifestCount?.const === 1 &&
    outputSchema?.properties?.responseEnvelopeCount?.const === 1,
  "pngCount=1 manifestCount=1 responseEnvelopeCount=1",
);
check(
  "runtime_network_policy",
  versions?.runtimeNetworkAccess === "PROHIBITED",
  `runtimeNetworkAccess=${versions?.runtimeNetworkAccess}`,
);

const textContract = contracts.get("text-contract.json");
check(
  "text_contract",
  textContract?.templateContractVersion === "1.3.0" &&
    textContract?.headlineBaselineY === 120 &&
    textContract?.subcopyBaselineY === 178 &&
    textContract?.textStartX === 48 &&
    textContract?.hardRightEdgeExclusive === 633 &&
    textContract?.maximumOccupiedWidthPx === 585 &&
    textContract?.warningWidthThresholdPx === 527 &&
    textContract?.headlineMaxKoreanEquivalentUnits === 12 &&
    textContract?.subcopyMaxKoreanEquivalentUnits === 15,
  "baseline=120/178; x=48; hardRight=633; width=585; warning=527; units=12/15",
);

const fontRegistry = contracts.get("font-asset-registry.json");
if (fontRegistry?.status === "UNRESOLVED_ASSET") {
  const unresolvedFontIntegrity = fontRegistry.requiredAssets.every(
    (asset) => asset.status === "UNRESOLVED_ASSET" && asset.sha256 === null && asset.fileName === null,
  );
  check(
    "font_asset_integrity",
    unresolvedFontIntegrity,
    `${fontRegistry.requiredAssets.length} required fonts; status=UNRESOLVED_ASSET`,
  );
} else {
  let resolvedFontIntegrity = fontRegistry?.status === "RESOLVED_ASSET";
  const fontDetails = [];
  for (const asset of fontRegistry?.requiredAssets ?? []) {
    const assetPath = path.join(root, ...asset.relativePath.split("/"));
    let actual = null;
    try {
      actual = await sha256(assetPath);
    } catch {
      resolvedFontIntegrity = false;
    }
    if (actual !== asset.sha256 || asset.status !== "RESOLVED_ASSET") resolvedFontIntegrity = false;
    fontDetails.push(`${asset.id}:${actual ?? "missing"}`);
  }
  check(
    "font_asset_integrity",
    resolvedFontIntegrity,
    fontDetails.join(", "),
  );
}

const integrationErrors = contracts.get("integration-error-registry.json");
const integrationCodes = integrationErrors?.codes?.map(({ code }) => code) ?? [];
check(
  "integration_error_code_uniqueness",
  new Set(integrationCodes).size === integrationCodes.length && integrationCodes.length >= 24,
  `${new Set(integrationCodes).size}/${integrationCodes.length} integration error codes are unique`,
);
const capabilityRegistry = contracts.get("template-capabilities.json");
const implementedCapabilities = capabilityRegistry?.capabilities?.filter(({ implementationStatus }) => implementationStatus === "IMPLEMENTED") ?? [];
check(
  "integration_capability_gate",
  implementedCapabilities.length === 3 &&
    implementedCapabilities.some(({ formatProfileId }) => formatProfileId === "KAKAO_BIZBOARD_OBJECT_RIGHT") &&
    implementedCapabilities.some(({ formatProfileId }) => formatProfileId === "KAKAO_BIZBOARD_THUMBNAIL_BOX_RIGHT") &&
    implementedCapabilities.some(({ formatProfileId }) => formatProfileId === "KAKAO_BIZBOARD_THUMBNAIL_MULTI_RIGHT"),
  `implemented=${implementedCapabilities.map(({ formatProfileId }) => formatProfileId).join(",")}`,
);
check(
  "integration_contract_version",
  versions?.integrationContract?.current === "1.1.0" && versions?.canonicalPhaseC4JpegSupport?.documentCurrent === "1.5.1" && versions?.canonicalPhaseC4JpegSupport?.templateContractVersion === "1.3.0",
  JSON.stringify(versions?.integrationContract),
);
check(
  "canonical_document_version",
  versions?.documentVersion?.current === "1.6.2" && versions?.templateContractVersion === "1.3.0",
  `document=${versions?.documentVersion?.current}; template=${versions?.templateContractVersion}`,
);

for (const result of results) {
  process.stdout.write(`${result.status} ${result.name}: ${result.detail}\n`);
}

if (results.some(({ status }) => status === "FAIL")) process.exitCode = 1;
