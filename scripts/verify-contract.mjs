import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

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
for (const code of [
  "NAVER_SMARTCHANNEL_FONT_UNAVAILABLE",
  "NAVER_SMARTCHANNEL_FONT_IDENTITY_MISMATCH",
  "NAVER_SMARTCHANNEL_FONT_VERSION_MISMATCH",
  "NAVER_SMARTCHANNEL_OBJECT_OPAQUE_PIXEL_LIMIT",
]) {
  check(`error_code_${code}`, errorCodes.includes(code), `${code} is present`);
}
check(
  "download_error_registered",
  errorCodes.includes("KBR-DOWNLOAD-001"),
  "KBR-DOWNLOAD-001 is present",
);
check(
  "error_registry_version",
  ["1.9.0", "1.10.0"].includes(errorRegistry?.registryVersion),
  `errorRegistry=${errorRegistry?.registryVersion ?? "missing"}`,
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
  versions?.templateContractVersion === "1.9.0" &&
    versions?.coordinatesChanged === false &&
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
const maskFixture = fixtureRegistry?.templates?.maskSemicircleRight;
const maskFixturePath = path.join(root, ...(maskFixture?.path?.split("/") ?? []));
let actualMaskHash = null;
try { actualMaskHash = await sha256(maskFixturePath); } catch { actualMaskHash = null; }
check(
  "mask_reference_hash",
  actualMaskHash === maskFixture?.sha256 && maskFixture?.sha256 === "90a2e948d979b204867c837485ca0d4b391de4ca44c22ca36e9f3f53862ac75e",
  `expected=${maskFixture?.sha256}; actual=${actualMaskHash}`,
);
const mask = maskFixture?.mask;
check(
  "mask_geometry",
  maskFixture?.png?.width === 1029 && maskFixture?.png?.height === 258 &&
    mask?.circle?.centerX === 801 && mask?.circle?.centerY === 225 && mask?.circle?.radius === 180 &&
    mask?.imageDestination?.x === 621 && mask?.imageDestination?.y === 45 && mask?.imageDestination?.width === 360 && mask?.imageDestination?.height === 213 &&
    mask?.rightExclusive === 981 && mask?.bottomExclusive === 258 &&
    mask?.restoredRegionStrategy === "circle-arc-without-logo-cutout" &&
    maskFixture?.logoSlot?.id === "LOGO_PRIMARY" && maskFixture?.logoSlot?.required === false && maskFixture?.logoSlot?.container?.x === 839 && maskFixture?.logoSlot?.safeBox?.x === 847 && maskFixture?.logoSlot?.colorRestriction === "NONE",
  JSON.stringify(maskFixture),
);

const maskAssetRegistry = contracts.get("mask-assets.json");
const maskAsset = maskAssetRegistry?.assets?.find(({ id }) => id === "KAKAO_BIZBOARD_MASK_SEMICIRCLE_RIGHT_V1");
const maskAssetPath = path.join(root, ...(maskAsset?.path?.split("/") ?? []));
let actualMaskAssetHash = null;
try { actualMaskAssetHash = await sha256(maskAssetPath); } catch { actualMaskAssetHash = null; }
let maskAssetIhdr = null;
let maskAlphaBbox = null;
let maskMetadataFree = false;
try {
  const rawPng = await readFile(maskAssetPath);
  const chunkTypes = [];
  let offset = 8;
  while (offset + 12 <= rawPng.length) {
    const length = rawPng.readUInt32BE(offset);
    const type = rawPng.toString("ascii", offset + 4, offset + 8);
    const end = offset + 12 + length;
    if (end > rawPng.length) throw new Error("truncated PNG chunk");
    chunkTypes.push(type);
    offset = end;
  }
  maskMetadataFree = offset === rawPng.length && chunkTypes.every((type) => type === "IHDR" || type === "IDAT" || type === "IEND");
  const raw = await sharp(maskAssetPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  maskAssetIhdr = raw.info;
  let minX = raw.info.width;
  let minY = raw.info.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < raw.info.height; y += 1) {
    for (let x = 0; x < raw.info.width; x += 1) {
      if (raw.data[(y * raw.info.width + x) * raw.info.channels + raw.info.channels - 1] > 0) {
        minX = Math.min(minX, x); minY = Math.min(minY, y);
        maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      }
    }
  }
  maskAlphaBbox = maxX >= 0 ? { minX, minY, maxX, maxY } : null;
} catch {
  maskAssetIhdr = null;
}
check(
  "mask_asset_registry",
  maskAsset?.path === "assets/masks/kakao-bizboard-mask-semicircle-right-v1.png" &&
    actualMaskAssetHash === maskAsset?.sha256 &&
    maskAsset?.sha256 === "eb9ea4859e2b75384ac814add59ce9636ce865ad5bae5a33f76d46210bfa6027" &&
    maskAssetIhdr?.width === 1029 && maskAssetIhdr?.height === 258 && maskAssetIhdr?.channels === 4 &&
    maskAlphaBbox?.minX === 621 && maskAlphaBbox?.minY === 45 && maskAlphaBbox?.maxX === 980 && maskAlphaBbox?.maxY === 257 &&
    maskMetadataFree,
  `expected=${maskAsset?.sha256}; actual=${actualMaskAssetHash}; ihdr=${JSON.stringify(maskAssetIhdr)}; alphaBbox=${JSON.stringify(maskAlphaBbox)}; metadataFree=${maskMetadataFree}`,
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
  textContract?.templateContractVersion === "1.9.0" &&
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
check(
  "integration_error_registry_version",
  integrationErrors?.registryVersion === "1.9.0" && versions?.integrationErrorRegistryVersion === "1.9.0",
  `integrationErrorRegistry=${integrationErrors?.registryVersion ?? "missing"}`,
);
const capabilityRegistry = contracts.get("template-capabilities.json");
const implementedCapabilities = capabilityRegistry?.capabilities?.filter(({ implementationStatus }) => implementationStatus === "IMPLEMENTED") ?? [];
check(
  "integration_capability_gate",
  implementedCapabilities.length === 4 &&
    implementedCapabilities.some(({ formatProfileId }) => formatProfileId === "KAKAO_BIZBOARD_OBJECT_RIGHT") &&
    implementedCapabilities.some(({ formatProfileId }) => formatProfileId === "KAKAO_BIZBOARD_THUMBNAIL_BOX_RIGHT") &&
    implementedCapabilities.some(({ formatProfileId }) => formatProfileId === "KAKAO_BIZBOARD_THUMBNAIL_MULTI_RIGHT") &&
    implementedCapabilities.some(({ formatProfileId }) => formatProfileId === "KAKAO_BIZBOARD_MASK_SEMICIRCLE_RIGHT"),
  `implemented=${implementedCapabilities.map(({ formatProfileId }) => formatProfileId).join(",")}`,
);
const channelRegistry = contracts.get("channel-capabilities.json");
const naverPlacements = ["SMARTCHANNEL", "MOBILE_DA", "IMAGE_BANNER_1_1", "MOBILE_NATIVE", "PC_NATIVE", "SHOPPING_NEWS", "COMMUNICATION_AD", "MOBILE_DA_FEED"];
const channelEntries = channelRegistry?.capabilities ?? [];
const naverEntries = channelEntries.filter(({ channel }) => channel === "NAVER_GFA");
const existingProfileMappings = channelRegistry?.legacyProfileMappings ?? [];
check(
  "channel_namespace",
  JSON.stringify(channelRegistry?.channels) === JSON.stringify(["KAKAO_MOMENT", "NAVER_GFA", "META"]) && channelRegistry?.channels?.includes("KAKAO_MOMENT") && channelRegistry?.channels?.includes("NAVER_GFA") && channelRegistry?.channels?.includes("META"),
  `channels=${channelRegistry?.channels?.join(",") ?? "missing"}`,
);
check(
  "composition_cardinality_axes",
  JSON.stringify(channelRegistry?.compositionModes) === JSON.stringify(["RENDERER_COMPOSED", "PLATFORM_COMPOSED"]) && JSON.stringify(channelRegistry?.artifactCardinalities) === JSON.stringify(["SINGLE", "COLLECTION"]),
  `composition=${channelRegistry?.compositionModes?.join(",") ?? "missing"}; cardinality=${channelRegistry?.artifactCardinalities?.join(",") ?? "missing"}`,
);
check(
  "naver_placement_namespace",
  JSON.stringify(channelRegistry?.naverGfaPlacements) === JSON.stringify(naverPlacements) && naverPlacements.every((placement) => naverEntries.some((entry) => entry.placement === placement)),
  `registered=${channelRegistry?.naverGfaPlacements?.length ?? 0}; capabilities=${naverEntries.length}`,
);
check(
  "legacy_profile_semantics",
  existingProfileMappings.length > 0 && existingProfileMappings.every((entry) => entry.channel === "KAKAO_MOMENT" && entry.compositionMode === "RENDERER_COMPOSED" && ["TEMPLATE_LOCKED", "FREEFORM"].includes(entry.layoutMode) && entry.artifactCardinality === "SINGLE"),
  `${existingProfileMappings.length} existing profiles map to renderer-composed single artifacts`,
);
check(
  "platform_composed_not_flattened",
  naverEntries.filter((entry) => entry.compositionMode === "PLATFORM_COMPOSED").every((entry) => entry.layoutMode === undefined && entry.runtimeStatus === "DEFERRED") && naverEntries.some((entry) => entry.placement === "MOBILE_DA_FEED" && Array.isArray(entry.compositionModes)),
  "platform-composed placements have no raster layout and feed remains mixed/profile-dependent",
);
check(
  "integration_contract_version",
  versions?.integrationContract?.current === "1.8.0" && versions?.canonicalPhaseC4JpegSupport?.documentCurrent === "1.5.1" && versions?.canonicalPhaseC4JpegSupport?.templateContractVersion === "1.3.0",
  JSON.stringify(versions?.integrationContract),
);
const historicalDocumentVersionValid =
  (versions?.documentVersion?.previous === "1.23.0" && versions?.documentVersion?.current === "1.23.1")
  || (versions?.documentVersion?.previous === "1.23.1" && versions?.documentVersion?.current === "1.24.0" && versions?.canonicalPhaseG0_1Google?.architectureStatus === "FROZEN")
  || (versions?.documentVersion?.previous === "1.24.0" && versions?.documentVersion?.current === "1.25.0" && versions?.canonicalPhaseG1Google?.phase === "G1_GOOGLE_STATIC_CONTRACTS_AND_PROFILE_IMPLEMENTATION" && versions?.canonicalPhaseG1Google?.contractsImplemented === true)
  || (versions?.documentVersion?.previous === "1.25.0" && versions?.documentVersion?.current === "1.26.0" && versions?.canonicalPhaseG2Google?.phase === "G2_GOOGLE_STATIC_RENDERING_VALIDATION_AND_GOLDEN_CANDIDATES" && versions?.canonicalPhaseG2Google?.renderingValidationImplemented === true)
  || (versions?.documentVersion?.previous === "1.26.0" && versions?.documentVersion?.current === "1.27.0" && versions?.canonicalPhaseG2_1Google?.phase === "G2_1_GOOGLE_STATIC_USER_VISUAL_ACCEPTANCE_AND_GOLDEN_FREEZE")
  || (versions?.documentVersion?.previous === "1.27.0" && versions?.documentVersion?.current === "1.28.0" && versions?.canonicalPhaseG3Google?.phase === "G3_GOOGLE_STATIC_DESKTOP_QA_ENABLEMENT" && versions?.canonicalPhaseG3Google?.desktopUiAdded === true)
  || (versions?.documentVersion?.previous === "1.28.0" && versions?.documentVersion?.current === "1.28.1" && versions?.documentVersion?.bump === "patch" && versions?.canonicalPhaseG3_0_2Google?.phase === "G3_0_2_GOOGLE_STATIC_DESKTOP_QA_REVISION");
check(
  "canonical_document_version",
  historicalDocumentVersionValid && versions?.canonicalPhaseN7_7_5?.documentCurrent === "1.21.4" && versions?.canonicalPhaseN7_7_6?.documentCurrent === "1.21.4" && versions?.canonicalPhaseN8?.documentCurrent === "1.21.4" && versions?.canonicalPhaseN8?.rendererCoreVersion === "0.8.6" && versions?.canonicalPhaseN8?.desktopCurrent === "0.9.12" && versions?.canonicalPhaseN8?.documentCurrent === "1.21.4" && versions?.canonicalPhaseM1?.documentPrevious === "1.21.4" && versions?.canonicalPhaseM1?.documentCurrent === "1.22.0" && versions?.canonicalPhaseM1?.rendererCoreVersion === "0.9.0" && versions?.canonicalPhaseM1?.desktopCurrent === "0.10.0" && versions?.canonicalPhaseM2_1?.documentPrevious === "1.22.0" && versions?.canonicalPhaseM2_1?.documentCurrent === "1.23.0" && versions?.canonicalPhaseM2_1?.rendererCoreVersion === "0.9.0" && versions?.canonicalPhaseM2_1?.validatorCurrent === "1.9.0" && versions?.canonicalPhaseM2_2?.documentPrevious === "1.23.0" && versions?.canonicalPhaseM2_2?.documentCurrent === "1.23.1" && versions?.freeformFormatProfileRegistryVersion === "1.4.0" && versions?.templateContractVersion === "1.9.0" && versions?.smartChannelTemplateContractVersion === "1.10.0",
  `document=${versions?.documentVersion?.previous}->${versions?.documentVersion?.current}; template=${versions?.templateContractVersion}`,
);

const assetNormalization = contracts.get("naver-smartchannel-asset-normalization.json");
const fontContract = contracts.get("naver-smartchannel-font-contract.json");
const typographyContract = contracts.get("naver-smartchannel-typography.json");
const runtimeFontPolicy = contracts.get("naver-smartchannel-runtime-font-policy.json");
const fontCompatibility = contracts.get("naver-smartchannel-font-compatibility.json");
check(
  "naver_smartchannel_asset_normalization",
  assetNormalization?.object?.maxWidth === 260 && assetNormalization?.object?.maxHeight === 160 && assetNormalization?.object?.maxOpaquePixelCount === 29120 && assetNormalization?.alpha?.trimPreserveThreshold === 1 && assetNormalization?.alpha?.layoutVisibleThreshold === 8 && assetNormalization?.alpha?.connectivity === 8 && Array.isArray(assetNormalization?.pipeline) && assetNormalization.pipeline.join("→") === "DECODE→ALPHA_BOUNDS→ALPHA_TRIM→PLACEMENT_POLICY→CONTAIN_SCALE→FINAL_RENDERED_BOUNDS→REGION_VALIDATION→RENDERED_ALPHA_PIXEL_COUNT",
  "pipeline=decode→alpha bounds→alpha trim→placement policy→contain scale→final rendered bounds→region validation→rendered alpha pixel count",
);
check(
  "naver_smartchannel_official_font_contract",
  fontContract?.fallbackAllowed === false &&
    fontContract?.mediumRequired === false &&
    fontContract?.semiBoldRequired === true &&
    JSON.stringify(fontContract?.roles?.filter(({ required }) => required).map(({ id }) => id)) === JSON.stringify(["NAVER_SC_APPLE_SD_GOTHIC_NEO_BOLD", "NAVER_SC_APPLE_SD_GOTHIC_NEO_REGULAR", "NAVER_SC_APPLE_SD_GOTHIC_NEO_SEMIBOLD"]) &&
    runtimeFontPolicy?.runtimeStatus === "READY_MACOS_SOURCE_TTC_VERIFIED_DERIVED" &&
    runtimeFontPolicy?.runtimeAssets?.filter(({ required }) => required).length === 3 &&
    runtimeFontPolicy?.runtimeAssets?.filter(({ required }) => required).every(({ relativePath, runtimeDigest, resolutionClass, smartChannelAllowed }) => typeof relativePath === "string" && /^[a-f0-9]{64}$/.test(runtimeDigest ?? "") && resolutionClass === "BUNDLED_EXACT" && smartChannelAllowed === true) &&
    typographyContract?.runtimeFontMode === "MACOS_SOURCE_TTC_VERIFIED_DERIVED" &&
    JSON.stringify(typographyContract?.sfRuntimeFonts ?? []) === JSON.stringify([]) &&
    fontCompatibility?.runtimeFontMode === "MACOS_SOURCE_TTC_VERIFIED_DERIVED" &&
    fontCompatibility?.approvedDigestAllowlist && Object.keys(fontCompatibility.approvedDigestAllowlist).length === 0 &&
    runtimeFontPolicy?.runtimeAssets?.filter(({ required }) => required).every(({ id }) => String(id).includes("APPLE_SD_GOTHIC_NEO")),
  "PSD-exact Apple roles=Bold+Regular+SemiBold; optional source-only SF; no fallback; no fake digests",
);

for (const result of results) {
  process.stdout.write(`${result.status} ${result.name}: ${result.detail}\n`);
}

if (results.some(({ status }) => status === "FAIL")) process.exitCode = 1;
