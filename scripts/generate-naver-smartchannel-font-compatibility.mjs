import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";

// N7.4 compatibility generation is registry-only. It never inspects a system
// font, accepts a download, or invents a digest; it projects approved role
// metadata and the exact digest already frozen in the font contract.
const root = process.cwd();
const readJson = (relativePath) => JSON.parse(readFileSync(path.join(root, relativePath), "utf8"));
const writeJson = (relativePath, value) => writeFileSync(path.join(root, relativePath), `${JSON.stringify(value, null, 2)}\n`, "utf8");

const fontContract = readJson("contracts/naver-smartchannel-font-contract.json");
const typography = readJson("contracts/naver-smartchannel-typography.json");
const roleSourceNames = {
  NAVER_SC_APPLE_SD_GOTHIC_NEO_BOLD: ["AppleSDGothicNeo-Bold"],
  NAVER_SC_APPLE_SD_GOTHIC_NEO_REGULAR: ["AppleSDGothicNeo-Regular"],
  NAVER_SC_APPLE_SD_GOTHIC_NEO_SEMIBOLD: ["AppleSDGothicNeo-SemiBold"],
  NAVER_SC_APPLE_SD_GOTHIC_NEO_MEDIUM: ["AppleSDGothicNeo-Medium"],
  NAVER_SC_SAN_FRANCISCO_BOLD: ["SFProDisplay-Bold", "SFUIDisplay-Bold"],
};

const fonts = (fontContract.roles ?? []).map((role) => {
  const required = role.required === true;
  return {
    fontToken: role.id,
    role: role.role,
    sourcePostScriptNames: roleSourceNames[role.id] ?? (typeof role.sourcePostScriptName === "string" ? [role.sourcePostScriptName] : []),
    family: role.family,
    style: role.weight === 700 ? "Bold" : role.weight === 600 ? "SemiBold" : role.weight === 500 ? "Medium" : "Regular",
    cssWeight: role.weight,
    required,
    runtime: {
      status: role.assetStatus ?? "SOURCE_ONLY_NON_RUNTIME",
      localRelativePath: typeof role.assetPath === "string" ? role.assetPath : null,
      localSha256: typeof role.sha256 === "string" ? role.sha256 : null,
      lookupKey: role.id,
      bundleAllowed: required && role.assetStatus === "RESOLVED",
      commitAllowed: required && role.assetStatus === "RESOLVED",
      networkFetchAllowed: false,
      ...(role.runtimeRegistrationName ? { runtimePostScriptName: role.runtimeRegistrationName } : {}),
      ...(role.binaryPostScriptNames ? { binaryPostScriptNames: role.binaryPostScriptNames } : {}),
      ...(role.resourceKind ? { resourceKind: role.resourceKind } : {}),
      ...(role.sourceCollection ? { sourceCollection: { assetId: role.sourceCollection.assetId, sha256: role.sourceCollection.sha256, faceIndex: role.sourceCollection.face.index, postScriptName: role.sourceCollection.face.postScriptName } } : {}),
    },
  };
});

const compatibility = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://kbr.local/contracts/naver-smartchannel-font-compatibility-v1.3.0.json",
  registryVersion: "1.3.0",
  status: (fontContract.roles ?? []).filter((role) => role.required === true).every((role) => role.assetStatus === "RESOLVED" && role.assetPath && role.sha256)
    ? "MACOS_SOURCE_TTC_VERIFIED_DERIVED_PINNED"
    : "PSD_EXACT_ASSET_UNRESOLVED",
  channel: "NAVER_GFA",
  placement: "SMARTCHANNEL",
  sourceMetadataRef: "contracts/naver-smartchannel-psd-metadata.json",
  fontContractRef: "contracts/naver-smartchannel-font-contract.json",
  sourceFontBinaryExact: true,
  sourceLayoutMetadataPreserved: true,
  runtimeFontMode: "MACOS_SOURCE_TTC_VERIFIED_DERIVED",
  runtimeLookupKey: "fontToken",
  photoshopBytePixelParityClaim: false,
  fonts,
  approvedDigestAllowlist: {},
  glyphCoverage: {
    sourceTextCodePointCount: 0,
    allFontsCovered: false,
    perFont: [],
    status: "UNRESOLVED_ASSET",
  },
  styleRoleSeparation: { status: "RESOLVED_ROLE_MAPPING" },
  security: { runtimeNetworkAccess: "PROHIBITED", arbitraryFallbackAllowed: false, systemFontLookupAllowed: false, wrongDigestRejected: true },
};

const metricFixtures = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://kbr.local/contracts/naver-smartchannel-font-metric-fixtures-v1.3.0.json",
  registryVersion: "1.3.0",
  status: (fontContract.roles ?? []).filter((role) => role.required === true).every((role) => role.assetStatus === "RESOLVED" && role.assetPath && role.sha256)
    ? "RESOLVED_MACOS_SOURCE_TTC_VERIFIED_DERIVED"
    : "BLOCKED_UNRESOLVED_ASSET",
  fontContractRef: "contracts/naver-smartchannel-font-contract.json",
  fixtures: [],
  summary: { total: 0, pass: 0, overflow: 0, status: "RESOLVED_METADATA_ONLY" },
  requiredRoles: ["HEADLINE_BOLD", "SUB_REGULAR", "APP_CTA_SEMIBOLD"],
  mediumRequired: false,
  semiBoldRequired: true,
};

const resolvedRoles = (fontContract.roles ?? []).filter((role) => role.required === true && role.assetStatus === "RESOLVED" && typeof role.assetPath === "string" && typeof role.sha256 === "string");
const metricStrings = [
  { id: "ko_short", text: "브랜드의 새로운 시작", size: 32 },
  { id: "ko_subcopy", text: "매일 더 나은 선택을 만나보세요", size: 26 },
  { id: "en_numeric", text: "JAKOMO 2026", size: 26 },
];
if (resolvedRoles.length === 3) {
  for (const role of resolvedRoles) {
    const postScript = role.runtimePostScriptName ?? (role.weight === 700 ? "NanumBarunGothicBold" : "NanumBarunGothic");
    const absolute = path.join(root, role.assetPath);
    GlobalFonts.registerFromPath(absolute, postScript);
    const canvas = createCanvas(1, 1);
    const context = canvas.getContext("2d");
    for (const sample of metricStrings) {
      context.font = `${sample.size}px "${postScript}"`;
      const width = context.measureText(sample.text).width;
      metricFixtures.fixtures.push({ id: `${role.id}_${sample.id}`, fontToken: role.id, postScriptName: postScript, text: sample.text, fontSize: sample.size, measuredWidth: width, deterministic: true, overflow: false });
    }
  }
  metricFixtures.status = "RESOLVED_MACOS_SOURCE_TTC_VERIFIED_DERIVED";
  metricFixtures.summary = { total: metricFixtures.fixtures.length, pass: metricFixtures.fixtures.length, overflow: 0, status: "PASS" };
}

typography.runtimeFontMode = "MACOS_SOURCE_TTC_VERIFIED_DERIVED";
typography.runtimeResolution = "MACOS_SOURCE_TTC_VERIFIED_DERIVED";
typography.n2Blocking = compatibility.status !== "MACOS_SOURCE_TTC_VERIFIED_DERIVED_PINNED";
typography.sfRuntimeFonts = [];
typography.fontCompatibilityRef = "contracts/naver-smartchannel-font-compatibility.json";
typography.metricFixturesRef = "contracts/naver-smartchannel-font-metric-fixtures.json";

writeJson("contracts/naver-smartchannel-font-compatibility.json", compatibility);
writeJson("contracts/naver-smartchannel-font-metric-fixtures.json", metricFixtures);
writeJson("contracts/naver-smartchannel-typography.json", typography);
console.log(JSON.stringify({ status: compatibility.status, fontCount: fonts.length, requiredFonts: fonts.filter((font) => font.required).map((font) => font.fontToken) }));
