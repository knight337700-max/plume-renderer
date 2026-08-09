import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const readJson = (relativePath) => JSON.parse(readFileSync(path.join(root, relativePath), "utf8"));
const readJsonIfPresent = (relativePath) => existsSync(path.join(root, relativePath)) ? readJson(relativePath) : null;
const writeJson = (relativePath, value) => writeFileSync(path.join(root, relativePath), `${JSON.stringify(value, null, 2)}\n`, "utf8");

function uint16(bytes, offset) {
  return offset + 2 <= bytes.length ? (bytes[offset] << 8) | bytes[offset + 1] : null;
}

function uint32(bytes, offset) {
  return offset + 4 <= bytes.length ? (bytes[offset] * 0x1000000) + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3] : null;
}

function utf16be(bytes) {
  let value = "";
  for (let i = 0; i + 1 < bytes.length; i += 2) value += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
  return value.replaceAll("\u0000", "").trim();
}

function fontIdentity(filePath) {
  const bytes = readFileSync(filePath);
  const signature = bytes.subarray(0, 4).toString("latin1");
  if (!["OTTO", "true", "typ1", "\u0000\u0001\u0000\u0000"].includes(signature)) return null;
  const count = uint16(bytes, 4);
  if (count === null) return null;
  const tables = new Map();
  for (let i = 0; i < count; i += 1) {
    const offset = 12 + (i * 16);
    const tag = bytes.subarray(offset, offset + 4).toString("latin1");
    const tableOffset = uint32(bytes, offset + 8);
    const length = uint32(bytes, offset + 12);
    if (tableOffset === null || length === null || tableOffset + length > bytes.length) return null;
    tables.set(tag, { offset: tableOffset, length });
  }
  const name = tables.get("name");
  if (!name) return null;
  const nameCount = uint16(bytes, name.offset + 2);
  const stringOffset = uint16(bytes, name.offset + 4);
  if (nameCount === null || stringOffset === null) return null;
  const values = new Map();
  for (let i = 0; i < nameCount; i += 1) {
    const record = name.offset + 6 + (i * 12);
    const platform = uint16(bytes, record);
    const nameId = uint16(bytes, record + 6);
    const length = uint16(bytes, record + 8);
    const valueOffset = uint16(bytes, record + 10);
    if (platform === null || nameId === null || length === null || valueOffset === null) return null;
    const start = name.offset + stringOffset + valueOffset;
    const raw = bytes.subarray(start, start + length);
    const value = platform === 0 || platform === 3 ? utf16be(raw) : raw.toString("utf8").replaceAll("\u0000", "").trim();
    if (!value) continue;
    const set = values.get(nameId) ?? new Set();
    set.add(value);
    values.set(nameId, set);
  }
  const names = (id) => [...(values.get(id) ?? new Set())].sort();
  const os2 = tables.get("OS/2");
  return {
    sha256: createHash("sha256").update(bytes).digest("hex"),
    sizeBytes: bytes.length,
    postScriptNames: names(6),
    familyNames: names(1),
    versions: names(5),
    weightClass: os2 && os2.length >= 6 ? uint16(bytes, os2.offset + 4) : null,
  };
}

const typography = readJson("contracts/naver-smartchannel-typography.json");
const metadata = readJson("contracts/naver-smartchannel-psd-metadata.json");
const fontRegistry = readJson("contracts/font-asset-registry.json");
const sfFontAudit = readJsonIfPresent("contracts/naver-smartchannel-sf-font-audit.json");
const sourceFonts = new Map(typography.sourceFonts.map((font) => [font.postScriptName, {
  family: font.family,
  style: font.style,
  weight: font.weight,
  sourcePsdCount: 0,
  typographyTokens: new Set(),
  languageUsage: { korean: false, latin: false, numeric: false },
}]));
for (const template of metadata.templates) {
  const fontsSeenInPsd = new Set();
  for (const layer of template.textLayers) {
    const text = String(layer.text ?? "");
    for (const postScriptName of layer.fontNames ?? []) {
      const font = sourceFonts.get(postScriptName);
      if (!font) continue;
      if (!fontsSeenInPsd.has(postScriptName)) {
        font.sourcePsdCount += 1;
        fontsSeenInPsd.add(postScriptName);
      }
      if (layer.typographyTokenId) font.typographyTokens.add(layer.typographyTokenId);
      font.languageUsage.korean ||= /\p{Script=Hangul}/u.test(text);
      font.languageUsage.latin ||= /[A-Za-z]/.test(text);
      font.languageUsage.numeric ||= /\p{Number}/u.test(text);
    }
  }
}

const runtimeAssets = fontRegistry.requiredAssets.map((asset) => {
  const absolutePath = path.join(root, asset.relativePath);
  const identity = fontIdentity(absolutePath);
  return {
    id: asset.id,
    relativePath: asset.relativePath,
    runtimePostScriptName: identity?.postScriptNames[0] ?? null,
    runtimeDigest: identity?.sha256 ?? asset.sha256,
    runtimeVersion: identity?.versions[0] ?? asset.fontVersion,
    weight: asset.weight,
    licenseStatus: asset.licenseStatus,
    resolutionClass: "LICENSED_BUT_NOT_SOURCE_MATCH",
    smartChannelAllowed: false,
  };
});
const runtimeByPostScript = new Map(runtimeAssets.map((asset) => [asset.runtimePostScriptName, asset]));

const localFontDirectory = process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "Microsoft", "Windows", "Fonts") : null;
const localCandidates = [];
if (localFontDirectory && existsSync(localFontDirectory)) {
  const names = ["APPLESDGOTHICNEOB.TTF", "APPLESDGOTHICNEOEB.TTF", "APPLESDGOTHICNEOM.TTF", "APPLESDGOTHICNEOR.TTF", "APPLESDGOTHICNEOSB.TTF", "APPLESDGOTHICNEOH.TTF"];
  for (const fileName of names) {
    const filePath = path.join(localFontDirectory, fileName);
    if (!existsSync(filePath)) continue;
    const identity = fontIdentity(filePath);
    if (!identity) continue;
    localCandidates.push({
      pathReference: `%LOCALAPPDATA%/Microsoft/Windows/Fonts/${fileName}`,
      fileName,
      postScriptNames: identity.postScriptNames,
      sha256: identity.sha256,
      version: identity.versions[0] ?? null,
      provenance: "UNRESOLVED",
      approvedForSmartChannel: false,
    });
  }
}

const externalFontDirectoryInput = process.env.NAVER_SMARTCHANNEL_FONT_DIR;
const externalFontDirectory = externalFontDirectoryInput && path.isAbsolute(externalFontDirectoryInput) && !externalFontDirectoryInput.startsWith("\\\\")
  ? externalFontDirectoryInput
  : path.join(root, ".local-fonts", "naver-smartchannel");
const externalFontFiles = [
  ["AppleSDGothicNeo-Bold", "AppleSDGothicNeo-Bold.ttf", 700],
  ["AppleSDGothicNeo-Medium", "AppleSDGothicNeo-Medium.ttf", 500],
  ["AppleSDGothicNeo-Regular", "AppleSDGothicNeo-Regular.ttf", 400],
  ["AppleSDGothicNeo-SemiBold", "AppleSDGothicNeo-SemiBold.ttf", 600],
];
const externalFontCandidates = externalFontFiles.map(([requiredPostScriptName, fileName, expectedWeight]) => {
  const filePath = path.join(externalFontDirectory, fileName);
  const identity = existsSync(filePath) ? fontIdentity(filePath) : null;
  const postScriptMatch = identity?.postScriptNames.includes(requiredPostScriptName) === true;
  const weightMatch = identity?.weightClass === expectedWeight;
  return {
    requiredPostScriptName,
    relativePath: fileName,
    sourceUrl: `https://raw.githubusercontent.com/fonts-archive/AppleSDGothicNeo/main/${fileName}`,
    localDirectoryEnv: "NAVER_SMARTCHANNEL_FONT_DIR",
    localDirectoryReference: externalFontDirectoryInput ? "<NAVER_SMARTCHANNEL_FONT_DIR>" : ".local-fonts/naver-smartchannel",
    exists: Boolean(identity),
    byteLength: identity?.sizeBytes ?? null,
    sha256: identity?.sha256 ?? null,
    actualPostScriptNames: identity?.postScriptNames ?? [],
    actualFamilyNames: identity?.familyNames ?? [],
    actualVersion: identity?.versions[0] ?? null,
    actualWeightClass: identity?.weightClass ?? null,
    expectedWeight,
    postScriptMatch,
    weightMatch,
    identityStatus: identity === null ? "UNAVAILABLE" : postScriptMatch && weightMatch ? "EXACT_IDENTITY_PASS" : "IDENTITY_MISMATCH",
    provenance: "USER_SPECIFIED_GITHUB_ARCHIVE_LOCAL_ONLY",
    licenseStatus: "NOT_CONFIRMED",
    redistributionClaim: "NOT_MADE",
    bundleAllowed: false,
    approvedForSmartChannel: false,
  };
});
const externalExactResolved = externalFontCandidates.length === 4 && externalFontCandidates.every((entry) => entry.identityStatus === "EXACT_IDENTITY_PASS");
const sfGuideOnly = sfFontAudit?.runtimeDecision === "SF_SOURCE_ONLY_NON_RUNTIME";

const requiredFonts = [...sourceFonts.entries()].sort(([left], [right]) => left.localeCompare(right, "en")).map(([postScriptName, value]) => ({
  postScriptName,
  family: value.family,
  style: value.style,
  weight: value.weight,
  sourcePsdCount: value.sourcePsdCount,
  typographyTokens: [...value.typographyTokens].sort(),
  languageUsage: value.languageUsage,
}));
const resolutionMatrix = requiredFonts.map((font) => {
  const runtime = font.postScriptName === "AppleSDGothicNeo-Bold" ? runtimeByPostScript.get("SpoqaHanSans-Bold") :
    font.postScriptName === "AppleSDGothicNeo-Regular" ? runtimeByPostScript.get("SpoqaHanSans-Regular") : undefined;
  return {
    sourcePostScriptName: font.postScriptName,
    runtimePostScriptName: runtime?.runtimePostScriptName ?? null,
    runtimeDigest: runtime?.runtimeDigest ?? null,
    resolutionClass: runtime ? "LICENSED_BUT_NOT_SOURCE_MATCH" : "MISSING",
    runtimeAssetId: runtime?.id ?? null,
    exactIdentityRequired: true,
  };
});

const policy = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://kbr.local/contracts/naver-smartchannel-runtime-font-policy-v1.1.0.json",
  registryVersion: "1.1.0",
  status: "FROZEN_FAIL_CLOSED",
  channel: "NAVER_GFA",
  placement: "SMARTCHANNEL",
  templateContractVersion: "1.10.0",
  sourceFontInventoryRef: "contracts/naver-smartchannel-typography.json",
  sfFontAuditRef: "contracts/naver-smartchannel-sf-font-audit.json",
  sfFontAuditStatus: sfFontAudit?.runtimeDecision ?? "AUDIT_NOT_AVAILABLE",
  sourceOnlyNonRuntime: sfFontAudit?.sourceOnlyNonRuntime ?? [],
  localExternalFontResource: {
    directoryEnv: "NAVER_SMARTCHANNEL_FONT_DIR",
    directoryReference: externalFontDirectoryInput ? "<NAVER_SMARTCHANNEL_FONT_DIR>" : ".local-fonts/naver-smartchannel",
    source: "https://github.com/fonts-archive/AppleSDGothicNeo",
    branch: "main",
    localOnly: true,
    networkRuntimeAllowed: false,
    redistributionClaim: "NOT_MADE",
    files: externalFontCandidates,
  },
  requiredSourceFonts: requiredFonts,
  resolutionClasses: ["EXACT_BUNDLED_LICENSED", "EXACT_SYSTEM", "EXACT_EXTERNAL_LICENSED", "LICENSED_BUT_NOT_SOURCE_MATCH", "MISSING"],
  resolutionMatrix,
  runtimeAssets,
  windowsSmartChannelFontAvailability: {
    platform: "WINDOWS_10_11_X64",
    EXACT_SYSTEM: false,
    EXACT_BUNDLED_LICENSED: false,
    EXACT_EXTERNAL_LICENSED_SUPPORTED: true,
    observedLocalCandidates: localCandidates,
    runtimeDecision: "BLOCKED",
  },
  appleFontDistribution: {
    apple_sd_gothic_neo: {
      systemAvailability: "Apple official documentation lists Apple SD Gothic Neo on Apple platforms and macOS system fonts",
      standaloneOfficialDownload: "NOT_FOUND",
      officialWindowsRedistributablePath: "NOT_FOUND",
      windowsRedistributionPermission: "UNKNOWN",
      projectBundlingPermission: "NOT_CONFIRMED",
      evidence: [
        "https://support.apple.com/en-us/120414",
        "https://developer.apple.com/fonts/system-fonts/",
        "https://developer.apple.com/fonts/index.html",
      ],
    },
    sf: {
      systemAvailability: "Apple official font resources target Apple operating systems",
      standaloneOfficialDownload: "FOUND_APPLE_DEVELOPER_RESOURCE",
      officialWindowsRedistributablePath: "NOT_FOUND",
      windowsRedistributionPermission: "NOT_CONFIRMED",
      projectBundlingPermission: "NOT_CONFIRMED",
      evidence: [
        "https://developer.apple.com/fonts/index.html",
        "https://developer.apple.com/support/downloads/terms/apple-design-resources/Apple-Design-Resources-License-20230621-English.pdf",
      ],
    },
  },
  fontResolutionModes: ["BUNDLED_EXACT", "SYSTEM_EXACT", "EXTERNAL_EXACT"],
  fallbackAllowed: false,
  externalExactContract: {
    schemaVersion: "1.0.0",
    pathKind: "TRUSTED_ROOT_RELATIVE",
    path: "<runtime-selected-local-font-file>",
    expectedPostScriptName: "required per source font",
    expectedSha256: "required approved digest",
    expectedVersion: "required when source version is known",
    approvedDigestRequired: true,
    networkUrlAllowed: false,
    pathTraversalAllowed: false,
    symlinkAllowed: false,
    windowsReparsePointAllowed: false,
    uiFilePickerImplemented: false,
  },
  preflight: {
    sequence: ["TRUSTED_LOCAL_PATH", "FILE_EXISTS", "FONT_DECODE", "POSTSCRIPT_EXACT", "SHA256_EXACT", "VERSION_EXACT_WHEN_DECLARED"],
    failClosed: true,
    renderStartAllowedOnlyWhen: "ALL_REQUIRED_SOURCE_FONTS_PASS",
    errors: [
      "NAVER_SMARTCHANNEL_FONT_UNAVAILABLE",
      "NAVER_SMARTCHANNEL_FONT_IDENTITY_MISMATCH",
      "NAVER_SMARTCHANNEL_FONT_VERSION_MISMATCH",
    ],
  },
  n2: {
    ready: externalExactResolved && sfGuideOnly,
    blockers: externalExactResolved && sfGuideOnly ? [] : ["runtime_font_exact_match_to_psd"],
    exactAppleFontsResolved: externalExactResolved,
    sfGuideOnly,
  },
};

typography.runtimePolicyRef = "contracts/naver-smartchannel-runtime-font-policy.json";
typography.sfFontAuditRef = "contracts/naver-smartchannel-sf-font-audit.json";
typography.sourceOnlyNonRuntime = sfFontAudit?.sourceOnlyNonRuntime ?? [];
typography.requiredSourceFonts = requiredFonts;
typography.runtimeResolution = "LICENSED_BUT_NOT_SOURCE_MATCH";
typography.n2Blocking = true;
writeJson("contracts/naver-smartchannel-runtime-font-policy.json", policy);
writeJson("contracts/naver-smartchannel-typography.json", typography);
console.log(JSON.stringify({ status: policy.status, requiredSourceFonts: requiredFonts.length, licensedMismatch: resolutionMatrix.filter((entry) => entry.resolutionClass === "LICENSED_BUT_NOT_SOURCE_MATCH").length, missing: resolutionMatrix.filter((entry) => entry.resolutionClass === "MISSING").length, localCandidates: localCandidates.length, externalFontCandidates: externalFontCandidates.length, externalExactResolved, sfGuideOnly }));

// N1D.2 makes the compatibility registry the canonical runtime-policy projection.
// Keep this legacy generator useful for source extraction while ensuring a direct
// invocation cannot leave the repository at the superseded N1D.1 policy shape.
await import("./generate-naver-smartchannel-font-compatibility.mjs");
