import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

// N7.4 compatibility generation is registry-only. It must never inspect a
// system font, accept a downloaded binary, or emit a digest for an unresolved
// official asset. Source PostScript names remain metadata used to map the
// frozen PSD typography tokens to the approved role token once assets exist.
const root = process.cwd();
const readJson = (relativePath) => JSON.parse(readFileSync(path.join(root, relativePath), "utf8"));
const writeJson = (relativePath, value) => writeFileSync(path.join(root, relativePath), `${JSON.stringify(value, null, 2)}\n`, "utf8");

const fontContract = readJson("contracts/naver-smartchannel-font-contract.json");
const typography = readJson("contracts/naver-smartchannel-typography.json");
const roleSourceNames = {
  NAVER_SC_NANUM_BARUN_GOTHIC_BOLD: ["AppleSDGothicNeo-Bold", "AppleSDGothicNeo-Medium", "AppleSDGothicNeo-SemiBold"],
  NAVER_SC_NANUM_BARUN_GOTHIC_REGULAR: ["AppleSDGothicNeo-Regular"],
  NAVER_SC_SAN_FRANCISCO_BOLD: ["SFProDisplay-Bold", "SFUIDisplay-Bold"],
};

const fonts = (fontContract.roles ?? []).map((role) => {
  const required = role.required === true;
  return {
    fontToken: role.id,
    role: role.role,
    sourcePostScriptNames: roleSourceNames[role.id] ?? [],
    family: role.family,
    style: role.weight === 700 ? "Bold" : "Regular",
    cssWeight: role.weight,
    required,
    runtime: {
      status: role.assetStatus ?? "UNRESOLVED_ASSET",
      localRelativePath: null,
      localSha256: null,
      lookupKey: role.id,
      bundleAllowed: false,
      commitAllowed: false,
      networkFetchAllowed: false,
    },
  };
});

const compatibility = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://kbr.local/contracts/naver-smartchannel-font-compatibility-v1.1.0.json",
  registryVersion: "1.1.0",
  status: "OFFICIAL_ASSETS_UNRESOLVED",
  channel: "NAVER_GFA",
  placement: "SMARTCHANNEL",
  sourceMetadataRef: "contracts/naver-smartchannel-psd-metadata.json",
  fontContractRef: "contracts/naver-smartchannel-font-contract.json",
  sourceFontBinaryExact: false,
  sourceLayoutMetadataPreserved: true,
  runtimeFontMode: "OFFICIAL_ASSET_REQUIRED",
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
  styleRoleSeparation: { status: "NOT_EVALUABLE_WITHOUT_APPROVED_ASSETS" },
  security: { runtimeNetworkAccess: "PROHIBITED", arbitraryFallbackAllowed: false, wrongDigestRejected: true },
};

const metricFixtures = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://kbr.local/contracts/naver-smartchannel-font-metric-fixtures-v1.1.0.json",
  registryVersion: "1.1.0",
  status: "BLOCKED_UNRESOLVED_ASSET",
  fontContractRef: "contracts/naver-smartchannel-font-contract.json",
  fixtures: [],
  summary: { total: 0, pass: 0, overflow: 0, status: "NOT_EVALUABLE_WITHOUT_APPROVED_ASSETS" },
  requiredRoles: ["MAIN_BOLD", "SUB_REGULAR", "DISCLAIMER_REGULAR"],
  mediumRequired: false,
  semiBoldRequired: false,
};

typography.runtimeFontMode = "OFFICIAL_ASSET_REQUIRED";
typography.runtimeResolution = "OFFICIAL_ASSET_REQUIRED";
typography.n2Blocking = true;
typography.sfRuntimeFonts = [];
typography.fontCompatibilityRef = "contracts/naver-smartchannel-font-compatibility.json";
typography.metricFixturesRef = "contracts/naver-smartchannel-font-metric-fixtures.json";

writeJson("contracts/naver-smartchannel-font-compatibility.json", compatibility);
writeJson("contracts/naver-smartchannel-font-metric-fixtures.json", metricFixtures);
writeJson("contracts/naver-smartchannel-typography.json", typography);
console.log(JSON.stringify({ status: compatibility.status, fontCount: fonts.length, requiredFonts: fonts.filter((font) => font.required).map((font) => font.fontToken) }));
