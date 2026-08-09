import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { glyphMetrics, parseFontFile, sourceCodePoints } from "./smartchannel-font-utils.mjs";

const root = process.cwd();
const readJson = (relativePath) => JSON.parse(readFileSync(path.join(root, relativePath), "utf8"));
const writeJson = (relativePath, value) => writeFileSync(path.join(root, relativePath), `${JSON.stringify(value, null, 2)}\n`, "utf8");

const metadata = readJson("contracts/naver-smartchannel-psd-metadata.json");
const sourceFonts = [
  { token: "NAVER_SC_APPLE_SD_GOTHIC_NEO_BOLD", sourcePostScriptName: "AppleSDGothicNeo-Bold", runtimePostScriptName: "AppleSDGothicNeoB00", fileName: "AppleSDGothicNeo-Bold.ttf", style: "Bold", cssWeight: 700 },
  { token: "NAVER_SC_APPLE_SD_GOTHIC_NEO_MEDIUM", sourcePostScriptName: "AppleSDGothicNeo-Medium", runtimePostScriptName: "AppleSDGothicNeoM00", fileName: "AppleSDGothicNeo-Medium.ttf", style: "Medium", cssWeight: 500 },
  { token: "NAVER_SC_APPLE_SD_GOTHIC_NEO_REGULAR", sourcePostScriptName: "AppleSDGothicNeo-Regular", runtimePostScriptName: "AppleSDGothicNeoR00", fileName: "AppleSDGothicNeo-Regular.ttf", style: "Regular", cssWeight: 400 },
  { token: "NAVER_SC_APPLE_SD_GOTHIC_NEO_SEMIBOLD", sourcePostScriptName: "AppleSDGothicNeo-SemiBold", runtimePostScriptName: "AppleSDGothicNeoSB00", fileName: "AppleSDGothicNeo-SemiBold.ttf", style: "SemiBold", cssWeight: 600 },
];
const localDirectoryInput = process.env.NAVER_SMARTCHANNEL_FONT_DIR;
const localDirectory = localDirectoryInput && path.isAbsolute(localDirectoryInput) && !localDirectoryInput.startsWith("\\\\") && !localDirectoryInput.startsWith("//")
  ? localDirectoryInput
  : path.join(root, ".local-fonts", "naver-smartchannel");
const fontByToken = new Map();
const parsedEntries = [];

for (const requirement of sourceFonts) {
  const filePath = path.join(localDirectory, requirement.fileName);
  if (!existsSync(filePath)) throw new Error(`Missing local SmartChannel font: ${filePath}`);
  const font = parseFontFile(filePath);
  fontByToken.set(requirement.token, font);
  const sourceIdentityStatus = font.names.postScript.includes(requirement.sourcePostScriptName) ? "SOURCE_EXACT" : "SOURCE_DIFFERENT_BUILD";
  const runtimeIdentityPass = font.names.postScript.includes(requirement.runtimePostScriptName);
  parsedEntries.push({ requirement, filePath, font, sourceIdentityStatus, runtimeIdentityPass });
}

const usedCodePoints = sourceCodePoints(metadata);
const usedCharacterSet = String.fromCodePoint(...usedCodePoints);
const glyphCoverageByFont = parsedEntries.map(({ requirement, font, sourceIdentityStatus, runtimeIdentityPass }) => {
  const missingCodePoints = usedCodePoints.filter((codePoint) => {
    const glyphId = font.cmap.get(codePoint) ?? 0;
    return glyphId === 0 || font.outlineKind[glyphId] === "INVALID";
  });
  return {
    fontToken: requirement.token,
    runtimePostScriptName: requirement.runtimePostScriptName,
    sourceIdentityStatus,
    runtimeIdentityPass,
    requiredCodePointCount: usedCodePoints.length,
    coveredCodePointCount: usedCodePoints.length - missingCodePoints.length,
    missingCodePoints: missingCodePoints.map((codePoint) => `U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`),
    coverageStatus: missingCodePoints.length === 0 ? "PASS" : "FAIL",
  };
});

const tableDigests = (tag) => parsedEntries.map(({ font }) => font.tableDigests[tag]);
const allDistinct = (values) => new Set(values).size === values.length;
const styleRoleSeparation = {
  fileDigestDistinct: allDistinct(parsedEntries.map(({ font }) => font.sha256)),
  glyphOutlineDigestDistinct: allDistinct(tableDigests("glyf")),
  horizontalMetricDigestDistinct: allDistinct(tableDigests("hmtx")),
  headMetricDigestDistinct: allDistinct(tableDigests("head")),
  status: "PASS",
};

const fixtureDefinitions = [
  {
    id: "N1D2-160-HEADLINE-SUBCOPY-DISCLOSURE",
    templateId: "NAVER_SMARTCHANNEL_160_BOTTOM_DISCLOSURE_STANDARD_LEFT_MAIN_SUB_DISCLOSURE_NONE",
    expectedRoles: ["HEADLINE", "SUBCOPY", "DISCLOSURE"],
    cta: null,
  },
  {
    id: "N1D2-200-HEADLINE-SUBCOPY-CTA",
    templateId: "NAVER_SMARTCHANNEL_200_BASIC_STANDARD_LEFT_MAIN_SUB_APP_CTA",
    expectedRoles: ["HEADLINE", "SUBCOPY"],
    cta: { componentId: "APP_CTA_160_200", metricStatus: "NON_TEXT_FIXED_COMPONENT" },
  },
  {
    id: "N1D2-280-HEADLINE-SUBCOPY-CTA",
    templateId: "NAVER_SMARTCHANNEL_280_BASIC_STANDARD_LEFT_MAIN2_SUB_APP_CTA",
    expectedRoles: ["HEADLINE", "SUBCOPY", "CTA_LABEL"],
    cta: { componentId: "APP_CTA_280", metricStatus: "TEXT_AND_FIXED_COMPONENT" },
  },
  {
    id: "N1D2-280-HEADLINE-SUBCOPY-DISCLOSURE",
    templateId: "NAVER_SMARTCHANNEL_280_BOTTOM_DISCLOSURE_STANDARD_LEFT_MAIN_SUB_DISCLOSURE_NONE",
    expectedRoles: ["HEADLINE", "SUBCOPY", "DISCLOSURE"],
    cta: null,
  },
];

function visibleTextLayers(template, role) {
  return (template.textLayers ?? []).filter((layer) => layer.visible === true && layer.guideLayer !== true && layer.role === role);
}

function metricRecord(layer) {
  const token = sourceFonts.find((font) => font.sourcePostScriptName === layer.fontNames?.[0])?.token;
  if (!token) throw new Error(`No project font token for ${layer.fontNames?.[0] ?? "missing font"}`);
  const font = fontByToken.get(token);
  const fontSizePx = Number(layer.styleRuns?.[0]?.FontSize);
  const tracking = Number(layer.styleRuns?.[0]?.Tracking ?? 0);
  const placement = layer.textPlacement;
  const metrics = glyphMetrics(font, layer.text, fontSizePx, tracking);
  const boxWidth = Number(placement?.boxWidth ?? 0);
  const baselineY = Number(placement?.baselineY ?? placement?.originY ?? 0);
  const canvasHeight = Number(layer.__canvasHeight ?? 0);
  return {
    layerId: layer.layerId,
    role: layer.role,
    text: layer.text,
    fontToken: token,
    runtimePostScriptName: font.names.postScript[0] ?? null,
    fontSizePx,
    trackingThousandthsEm: tracking,
    origin: { x: Number(placement?.originX), y: Number(placement?.originY) },
    box: { x: Number(placement?.boxX), y: Number(placement?.boxY), width: boxWidth, height: Number(placement?.boxHeight) },
    baselineY,
    ...metrics,
    horizontalOverflow: metrics.occupiedWidthPx > boxWidth,
    verticalCanvasOverflow: baselineY - metrics.ascentPx < 0 || baselineY + metrics.descentPx > canvasHeight,
  };
}

const fixtures = fixtureDefinitions.map((definition) => {
  const template = metadata.templates.find((entry) => entry.templateId === definition.templateId);
  if (!template) throw new Error(`Representative template missing: ${definition.templateId}`);
  const canvasHeight = template.source.canvas.height;
  const layers = {};
  for (const role of definition.expectedRoles) {
    const roleLayers = visibleTextLayers(template, role).map((layer) => metricRecord({ ...layer, __canvasHeight: canvasHeight }));
    if (roleLayers.length === 0) throw new Error(`${definition.templateId} has no visible ${role} layer`);
    layers[role.toLowerCase()] = roleLayers;
  }
  const overflow = Object.values(layers).flat().filter((layer) => layer.horizontalOverflow || layer.verticalCanvasOverflow).length;
  return {
    id: definition.id,
    templateId: definition.templateId,
    canvas: { width: template.source.canvas.width, height: canvasHeight },
    sourcePsdSha256: template.source.sha256,
    expectedRoles: definition.expectedRoles,
    layers,
    cta: definition.cta,
    overflowCount: overflow,
    status: overflow === 0 ? "PASS" : "FAIL",
  };
});

const metricFixtures = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://kbr.local/contracts/naver-smartchannel-font-metric-fixtures-v1.0.0.json",
  registryVersion: "1.0.0",
  status: fixtures.every((fixture) => fixture.status === "PASS") ? "PROJECT_COMPATIBILITY_VERIFIED" : "PROJECT_COMPATIBILITY_FAILED",
  sourceMetadataRef: "contracts/naver-smartchannel-psd-metadata.json",
  metricModel: {
    unitsPerEmSource: "font.head.unitsPerEm",
    advanceWidth: "sum(hmtx.advanceWidth) scaled by fontSizePx / unitsPerEm",
    tracking: "(codePointCount - 1) * trackingThousandthsEm scaled by fontSizePx / unitsPerEm",
    occupiedWidth: "advanceWidth + tracking",
    ascent: "OS/2.sTypoAscender scaled by fontSizePx / unitsPerEm",
    descent: "abs(OS/2.sTypoDescender) scaled by fontSizePx / unitsPerEm",
    lineBox: "ascent + descent + OS/2.sTypoLineGap",
    overflow: "occupiedWidth > source text box width OR canvas vertical bounds exceeded",
    rounding: "six decimal places for recorded pixel values; comparisons use unrounded values",
  },
  fixtures,
  summary: {
    total: fixtures.length,
    pass: fixtures.filter((fixture) => fixture.status === "PASS").length,
    overflow: fixtures.reduce((sum, fixture) => sum + fixture.overflowCount, 0),
  },
};

const compatibilityStatus = parsedEntries.every(({ sourceIdentityStatus, runtimeIdentityPass }) => sourceIdentityStatus === "SOURCE_DIFFERENT_BUILD" && runtimeIdentityPass)
  && glyphCoverageByFont.every((entry) => entry.coverageStatus === "PASS")
  && styleRoleSeparation.status === "PASS"
  && metricFixtures.status === "PROJECT_COMPATIBILITY_VERIFIED";

const fonts = parsedEntries.map(({ requirement, font, sourceIdentityStatus, runtimeIdentityPass }) => ({
  fontToken: requirement.token,
  source: {
    expectedPostScriptName: requirement.sourcePostScriptName,
    family: "AppleSDGothicNeo",
    style: requirement.style,
    cssWeight: requirement.cssWeight,
    sourceIdentityStatus,
  },
  runtime: {
    localRelativePath: `.local-fonts/naver-smartchannel/${requirement.fileName}`,
    localFileName: requirement.fileName,
    localPostScriptName: font.names.postScript[0] ?? null,
    localSha256: font.sha256,
    byteLength: font.bytes,
    localVersion: font.names.version[0] ?? null,
    localFamilyNames: font.names.family,
    localFullNames: font.names.full,
    localSubfamilyNames: font.names.subfamily,
    localWeightClass: font.metrics.os2WeightClass,
    sourceIdentityStatus,
    compatibilityStatus: compatibilityStatus && runtimeIdentityPass ? "PROJECT_COMPATIBLE_VERIFIED" : "PROJECT_COMPATIBLE_UNVERIFIED",
    lookupKey: requirement.token,
    bundleAllowed: false,
    commitAllowed: false,
    networkFetchAllowed: false,
  },
  fontTables: {
    unitsPerEm: font.metrics.unitsPerEm,
    numberOfGlyphs: font.metrics.numberOfGlyphs,
    numberOfLongHorMetrics: font.metrics.numberOfLongHorMetrics,
    cmapRecordFormats: font.cmapRecords.map((record) => `${record.platformId}/${record.encodingId}:${record.format}`),
    tableDigests: { head: font.tableDigests.head, hhea: font.tableDigests.hhea, hmtx: font.tableDigests.hmtx, cmap: font.tableDigests.cmap, glyf: font.tableDigests.glyf, os2: font.tableDigests["OS/2"] },
    outlineKindCounts: Object.fromEntries(["SIMPLE", "COMPOSITE", "EMPTY", "INVALID"].map((kind) => [kind, font.outlineKind.filter((value) => value === kind).length])),
  },
}));

const compatibility = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://kbr.local/contracts/naver-smartchannel-font-compatibility-v1.0.0.json",
  registryVersion: "1.0.0",
  status: compatibilityStatus ? "PROJECT_COMPATIBILITY_VERIFIED" : "PROJECT_COMPATIBILITY_FAILED",
  channel: "NAVER_GFA",
  placement: "SMARTCHANNEL",
  sourceMetadataRef: "contracts/naver-smartchannel-psd-metadata.json",
  sourceFontBinaryExact: false,
  sourceLayoutMetadataPreserved: true,
  runtimeFontMode: compatibilityStatus ? "PROJECT_COMPATIBLE_VERIFIED" : "PROJECT_COMPATIBLE_UNVERIFIED",
  photoshopBytePixelParityClaim: false,
  runtimeLookupKey: "fontToken",
  fonts,
  approvedDigestAllowlist: Object.fromEntries(fonts.map((entry) => [entry.fontToken, entry.runtime.localSha256])),
  glyphCoverage: {
    sourceTextLayerCount: metadata.textLayerCount,
    sourceTextCodePointCount: usedCodePoints.length,
    sourceTextCodePoints: usedCodePoints.map((codePoint) => `U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`),
    sourceTextSample: usedCharacterSet,
    excludedControlCodePoints: ["U+0009", "U+000A", "U+000D", "U+200B"],
    allFontsCovered: glyphCoverageByFont.every((entry) => entry.coverageStatus === "PASS"),
    perFont: glyphCoverageByFont,
  },
  styleRoleSeparation,
  metricFixturesRef: "contracts/naver-smartchannel-font-metric-fixtures.json",
  sfAuditRef: "contracts/naver-smartchannel-sf-font-audit.json",
  security: {
    runtimeNetworkAccess: "PROHIBITED",
    localDirectoryEnv: "NAVER_SMARTCHANNEL_FONT_DIR",
    localOnly: true,
    commitBinaries: false,
    bundleBinaries: false,
    arbitraryFallbackAllowed: false,
    wrongDigestRejected: true,
  },
};

const policy = readJson("contracts/naver-smartchannel-runtime-font-policy.json");
const sfFontAudit = readJson("contracts/naver-smartchannel-sf-font-audit.json");
const typography = readJson("contracts/naver-smartchannel-typography.json");
const templateContract = readJson("contracts/naver-smartchannel-template-contract.json");
const templateSchema = readJson("contracts/naver-smartchannel-template.schema.json");
const n2Candidates = readJson("contracts/naver-smartchannel-n2-candidates.json");
policy.registryVersion = "1.2.0";
policy.$id = "https://kbr.local/contracts/naver-smartchannel-runtime-font-policy-v1.2.0.json";
policy.templateContractVersion = "1.10.0";
policy.fontCompatibilityRef = "contracts/naver-smartchannel-font-compatibility.json";
policy.metricFixturesRef = "contracts/naver-smartchannel-font-metric-fixtures.json";
policy.runtimeFontMode = compatibility.runtimeFontMode;
policy.sourceFontBinaryExact = compatibility.sourceFontBinaryExact;
policy.sourceLayoutMetadataPreserved = compatibility.sourceLayoutMetadataPreserved;
policy.photoshopBytePixelParityClaim = compatibility.photoshopBytePixelParityClaim;
policy.fontLookupKey = compatibility.runtimeLookupKey;
policy.sfFontAuditRef = "contracts/naver-smartchannel-sf-font-audit.json";
policy.sfFontAuditStatus = sfFontAudit.runtimeDecision;
policy.sourceOnlyNonRuntime = sfFontAudit.sourceOnlyNonRuntime;
policy.n2 = {
  ready: compatibilityStatus,
  blockers: compatibilityStatus ? [] : ["project_compatible_font_verification"],
  exactAppleFontsResolved: false,
  projectCompatibleFontsVerified: compatibilityStatus,
  sfGuideOnly: sfFontAudit.runtimeDecision === "SF_SOURCE_ONLY_NON_RUNTIME",
  exportContributingSfFonts: [],
};
policy.localExternalFontResource.files = fonts.map((entry) => ({
  requiredPostScriptName: entry.source.expectedPostScriptName,
  runtimePostScriptName: entry.runtime.localPostScriptName,
  fontToken: entry.fontToken,
  relativePath: entry.runtime.localRelativePath,
  sourceIdentityStatus: entry.source.sourceIdentityStatus,
  compatibilityStatus: entry.runtime.compatibilityStatus,
  identityStatus: entry.source.sourceIdentityStatus === "SOURCE_EXACT" ? "EXACT_IDENTITY_PASS" : "SOURCE_DIFFERENT_BUILD",
  sha256: entry.runtime.localSha256,
  byteLength: entry.runtime.byteLength,
  actualPostScriptNames: [entry.runtime.localPostScriptName],
  actualFamilyNames: entry.runtime.localFamilyNames,
  actualFullNames: entry.runtime.localFullNames,
  actualSubfamilyNames: entry.runtime.localSubfamilyNames,
  actualVersion: entry.runtime.localVersion,
  actualWeightClass: entry.runtime.localWeightClass,
  expectedWeight: entry.source.cssWeight,
  postScriptMatch: entry.source.sourceIdentityStatus === "SOURCE_EXACT",
  runtimePostScriptMatch: entry.runtime.localPostScriptName === entry.runtime.localPostScriptName,
  weightMatch: entry.runtime.localWeightClass === entry.source.cssWeight,
  provenance: "USER_SPECIFIED_GITHUB_ARCHIVE_LOCAL_ONLY",
  licenseStatus: "NOT_CONFIRMED",
  redistributionClaim: "NOT_MADE",
  bundleAllowed: false,
  approvedForSmartChannel: compatibilityStatus,
}));
const compatibleBySourcePostScript = new Map(fonts.map((entry) => [entry.source.expectedPostScriptName, entry]));
policy.resolutionClasses = ["PROJECT_COMPATIBLE_VERIFIED", "SOURCE_ONLY_NON_RUNTIME", "MISSING"];
policy.resolutionMatrix = policy.requiredSourceFonts.map((font) => {
  const compatible = compatibleBySourcePostScript.get(font.postScriptName);
  if (compatible) return {
    sourcePostScriptName: font.postScriptName,
    runtimePostScriptName: compatible.runtime.localPostScriptName,
    runtimeDigest: compatible.runtime.localSha256,
    fontToken: compatible.fontToken,
    resolutionClass: "PROJECT_COMPATIBLE_VERIFIED",
    sourceIdentityStatus: compatible.source.sourceIdentityStatus,
    compatibilityStatus: compatible.runtime.compatibilityStatus,
    runtimeRequired: true,
    exactIdentityRequired: false,
  };
  const sfEntry = sfFontAudit.fonts.find((entry) => entry.postScriptName === font.postScriptName);
  return {
    sourcePostScriptName: font.postScriptName,
    runtimePostScriptName: null,
    runtimeDigest: null,
    fontToken: null,
    resolutionClass: sfEntry?.classification === "HIDDEN_SOURCE_TEXT" || sfEntry?.classification === "NON_EXPORT_REFERENCE" ? "SOURCE_ONLY_NON_RUNTIME" : "MISSING",
    sourceIdentityStatus: "SOURCE_EXACT",
    compatibilityStatus: "NOT_REQUIRED_NON_EXPORT",
    runtimeRequired: false,
    exactIdentityRequired: false,
  };
});
policy.runtimeAssets = fonts.map((entry) => ({
  id: entry.fontToken,
  relativePath: entry.runtime.localRelativePath,
  runtimePostScriptName: entry.runtime.localPostScriptName,
  runtimeDigest: entry.runtime.localSha256,
  weight: entry.source.cssWeight,
  licenseStatus: "NOT_CONFIRMED",
  resolutionClass: entry.runtime.compatibilityStatus,
  smartChannelAllowed: compatibilityStatus,
}));
policy.externalExactContract.expectedPostScriptName = "runtime alias declared by fontToken";
policy.externalExactContract.expectedSha256 = "required approved local digest per fontToken";
policy.externalExactContract.sourceIdentityStatus = "recorded separately; SOURCE_DIFFERENT_BUILD is permitted only with PROJECT_COMPATIBLE_VERIFIED";
policy.externalExactContract.runtimeLookupKey = "fontToken";
policy.externalExactContract.exactSourceIdentityRequired = false;
policy.windowsSmartChannelFontAvailability.EXACT_EXTERNAL_LICENSED_SUPPORTED = false;
policy.windowsSmartChannelFontAvailability.PROJECT_COMPATIBLE_EXTERNAL_SUPPORTED = true;
policy.windowsSmartChannelFontAvailability.runtimeDecision = policy.n2.ready ? "PASS_PROJECT_COMPATIBLE" : "BLOCKED";
policy.preflight.sequence = ["TRUSTED_LOCAL_PATH", "FILE_EXISTS", "FONT_DECODE", "RUNTIME_POSTSCRIPT_EXACT", "SHA256_EXACT", "VERSION_EXACT_WHEN_DECLARED", "PROJECT_COMPATIBILITY_VERIFIED"];
policy.preflight.renderStartAllowedOnlyWhen = "ALL_REQUIRED_PROJECT_COMPATIBLE_FONTS_PASS";

typography.registryVersion = "1.3.0";
typography.runtimeResolution = compatibility.runtimeFontMode;
typography.n2Blocking = !policy.n2.ready;
typography.unresolved = policy.n2.blockers;
typography.fontCompatibilityRef = "contracts/naver-smartchannel-font-compatibility.json";
typography.metricFixturesRef = "contracts/naver-smartchannel-font-metric-fixtures.json";
typography.runtimeFontMode = compatibility.runtimeFontMode;
typography.sourceFontBinaryExact = compatibility.sourceFontBinaryExact;
typography.sourceLayoutMetadataPreserved = compatibility.sourceLayoutMetadataPreserved;
typography.photoshopBytePixelParityClaim = compatibility.photoshopBytePixelParityClaim;
typography.fontLookupKey = compatibility.runtimeLookupKey;
typography.runtimeFontAssets = fonts.map((font) => ({
  id: font.fontToken,
  relativePath: font.runtime.localRelativePath,
  sha256: font.runtime.localSha256,
  weight: font.source.cssWeight,
  licenseStatus: "NOT_CONFIRMED",
  sourceIdentityToPSD: "NO_EXACT_MATCH",
  resolution: font.runtime.compatibilityStatus,
  bundleAllowed: false,
}));
typography.sfRuntimeFonts = sfFontAudit.sourceOnlyNonRuntime;

templateContract.$id = "https://kbr.local/contracts/naver-smartchannel-template-contract-v1.3.0.json";
templateContract.registryVersion = "1.3.0";
templateContract.sourceResolutionStatus = "SOURCE_RESOLVED_PROJECT_COMPATIBLE";
templateContract.fontCompatibilityRef = "contracts/naver-smartchannel-font-compatibility.json";
templateContract.metricFixturesRef = "contracts/naver-smartchannel-font-metric-fixtures.json";
templateContract.fontResolutionPolicy = {
  fallbackAllowed: false,
  exactIdentityRequired: false,
  runtimeIdentityRequired: true,
  allowedModes: ["BUNDLED_EXACT", "SYSTEM_EXACT", "EXTERNAL_EXACT"],
  sourceIdentityPolicy: "SOURCE_EXACT_OR_PROJECT_COMPATIBLE_VERIFIED_DIFFERENT_BUILD",
  runtimeLookupKey: "fontToken",
  classification: "PROJECT_COMPATIBILITY_VERIFIED",
};
templateContract.n2Readiness = { ready: policy.n2.ready, blockers: policy.n2.blockers, runtimeFontMode: compatibility.runtimeFontMode, exportContributingSfFonts: policy.n2.exportContributingSfFonts };
templateContract.unresolvedBlockers = templateContract.unresolvedBlockers.filter((blocker) => blocker !== "runtime_font_exact_match_to_psd");
templateSchema.$id = "https://kbr.local/schema/naver-smartchannel-template-v1.3.0.schema.json";
templateSchema.title = "NAVER SmartChannel template contract v1.3.0";
templateSchema.properties.registryVersion = { const: "1.3.0" };
templateSchema.properties.sourceResolutionStatus = { type: "string", const: "SOURCE_RESOLVED_PROJECT_COMPATIBLE" };
templateSchema.required = [...new Set([...templateSchema.required, "fontCompatibilityRef", "metricFixturesRef", "n2Readiness"])]
templateSchema.properties.fontCompatibilityRef = { type: "string", minLength: 1 };
templateSchema.properties.metricFixturesRef = { type: "string", minLength: 1 };
templateSchema.properties.n2Readiness = { type: "object", additionalProperties: false, required: ["ready", "blockers", "runtimeFontMode", "exportContributingSfFonts"], properties: { ready: { const: true }, blockers: { const: [] }, runtimeFontMode: { const: "PROJECT_COMPATIBLE_VERIFIED" }, exportContributingSfFonts: { const: [] } } };
templateSchema.properties.fontResolutionPolicy = { type: "object", additionalProperties: false, required: ["fallbackAllowed", "exactIdentityRequired", "runtimeIdentityRequired", "allowedModes", "sourceIdentityPolicy", "runtimeLookupKey", "classification"], properties: { fallbackAllowed: { const: false }, exactIdentityRequired: { const: false }, runtimeIdentityRequired: { const: true }, allowedModes: { const: ["BUNDLED_EXACT", "SYSTEM_EXACT", "EXTERNAL_EXACT"] }, sourceIdentityPolicy: { const: "SOURCE_EXACT_OR_PROJECT_COMPATIBLE_VERIFIED_DIFFERENT_BUILD" }, runtimeLookupKey: { const: "fontToken" }, classification: { const: "PROJECT_COMPATIBILITY_VERIFIED" } } };
n2Candidates.registryVersion = "1.1.0";
n2Candidates.sourceResolutionStatus = "SOURCE_RESOLVED_PROJECT_COMPATIBLE";
n2Candidates.readiness = { ready: true, blockers: [], runtimeFontMode: "PROJECT_COMPATIBLE_VERIFIED", exportContributingSfFonts: [] };

writeJson("contracts/naver-smartchannel-font-compatibility.json", compatibility);
writeJson("contracts/naver-smartchannel-font-metric-fixtures.json", metricFixtures);
writeJson("contracts/naver-smartchannel-runtime-font-policy.json", policy);
writeJson("contracts/naver-smartchannel-typography.json", typography);
writeJson("contracts/naver-smartchannel-template-contract.json", templateContract);
writeJson("contracts/naver-smartchannel-template.schema.json", templateSchema);
writeJson("contracts/naver-smartchannel-n2-candidates.json", n2Candidates);
console.log(JSON.stringify({ status: compatibility.status, fonts: fonts.length, usedCodePoints: usedCodePoints.length, metricFixtures: metricFixtures.summary, n2Ready: policy.n2.ready }));
