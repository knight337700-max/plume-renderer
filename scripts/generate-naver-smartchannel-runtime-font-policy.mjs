import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

// N7.4 deliberately does not discover, download, or infer a SmartChannel font.
// This generator only projects the frozen official-role contract into the
// runtime policy. A role remains UNRESOLVED_ASSET until an approved binary,
// license evidence, and digest are supplied by a later contract update.
const root = process.cwd();
const readJson = (relativePath) => JSON.parse(readFileSync(path.join(root, relativePath), "utf8"));
const writeJson = (relativePath, value) => writeFileSync(path.join(root, relativePath), `${JSON.stringify(value, null, 2)}\n`, "utf8");

const fontContract = readJson("contracts/naver-smartchannel-font-contract.json");
const typography = readJson("contracts/naver-smartchannel-typography.json");
const sourceAudit = existsSync(path.join(root, "contracts/naver-smartchannel-sf-font-audit.json"))
  ? readJson("contracts/naver-smartchannel-sf-font-audit.json")
  : null;

const runtimeAssets = (fontContract.roles ?? []).map((role) => ({
  id: role.id,
  relativePath: typeof role.assetPath === "string" ? role.assetPath : null,
  runtimePostScriptName: typeof role.runtimePostScriptName === "string" ? role.runtimePostScriptName : null,
  runtimeDigest: typeof role.sha256 === "string" ? role.sha256 : null,
  weight: role.weight,
  required: role.required === true,
  licenseStatus: role.licenseStatus ?? "UNRESOLVED",
  assetStatus: role.assetStatus ?? "UNRESOLVED_ASSET",
  resolutionClass: role.required === false ? "SOURCE_ONLY_NON_RUNTIME" : "MISSING",
  smartChannelAllowed: false,
}));
const requiredUnresolved = runtimeAssets.some((asset) => asset.required && (asset.assetStatus !== "RESOLVED" || !asset.relativePath || !asset.runtimeDigest));
const sourceOnlyNonRuntime = sourceAudit?.sourceOnlyNonRuntime ?? ["SFProDisplay-Bold", "SFUIDisplay-Bold"];
const sourceFonts = (typography.sourceFonts ?? []).map((font) => ({
  postScriptName: font.postScriptName,
  classification: "SOURCE_METADATA_ONLY",
  runtimeRequired: false,
}));

const policy = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://kbr.local/contracts/naver-smartchannel-runtime-font-policy-v1.3.0.json",
  registryVersion: "1.3.0",
  status: "FROZEN_FAIL_CLOSED",
  channel: "NAVER_GFA",
  placement: "SMARTCHANNEL",
  templateContractVersion: "1.10.0",
  fontContractRef: "contracts/naver-smartchannel-font-contract.json",
  sourceFontInventoryRef: "contracts/naver-smartchannel-typography.json",
  sourceOnlyNonRuntime,
  allowedFamilies: fontContract.allowedFamilies,
  fallbackAllowed: false,
  fontResolutionModes: ["BUNDLED_EXACT", "SYSTEM_EXACT", "EXTERNAL_EXACT"],
  runtimeLookupKey: "fontToken",
  fontLookupKey: "fontToken",
  runtimeStatus: requiredUnresolved ? "BLOCKED_UNRESOLVED_OFFICIAL_ASSET" : "READY_APPROVED_OFFICIAL_ASSET",
  runtimeAssets,
  resolutionClasses: ["BUNDLED_EXACT", "SYSTEM_EXACT", "EXTERNAL_EXACT", "MISSING", "SOURCE_ONLY_NON_RUNTIME"],
  requiredSourceFonts: sourceFonts,
  preflight: {
    sequence: ["TRUSTED_LOCAL_PATH", "FILE_EXISTS", "FONT_DECODE", "RUNTIME_POSTSCRIPT_EXACT", "SHA256_EXACT", "PROJECT_COMPATIBILITY_VERIFIED"],
    failClosed: true,
    renderStartAllowedOnlyWhen: "ALL_REQUIRED_APPROVED_ASSETS_PASS",
    errors: ["NAVER_SMARTCHANNEL_FONT_UNAVAILABLE", "NAVER_SMARTCHANNEL_FONT_IDENTITY_MISMATCH", "NAVER_SMARTCHANNEL_FONT_VERSION_MISMATCH"],
  },
  externalExactContract: {
    pathKind: "TRUSTED_ROOT_RELATIVE",
    approvedDigestRequired: true,
    networkUrlAllowed: false,
    pathTraversalAllowed: false,
    symlinkAllowed: false,
    windowsReparsePointAllowed: false,
  },
  unresolvedBlockers: runtimeAssets.filter((asset) => asset.required && asset.assetStatus === "UNRESOLVED_ASSET").map((asset) => asset.id),
  runtimeNetworkAccess: "PROHIBITED",
  localExternalFontResource: {
    directoryEnv: "NAVER_SMARTCHANNEL_FONT_DIR",
    networkRuntimeAllowed: false,
    localOnly: true,
    uiFilePickerImplemented: false,
    bundleBinaries: false,
    status: requiredUnresolved ? "UNRESOLVED_ASSET" : "RESOLVED_APPROVED_ASSET",
  },
};

typography.runtimeFontAssets = runtimeAssets.map((asset) => ({
  id: asset.id,
  relativePath: asset.relativePath,
  sha256: asset.runtimeDigest,
  weight: asset.weight,
  licenseStatus: asset.licenseStatus,
  sourceIdentityToPSD: asset.required ? "ROLE_MAPPING_ONLY" : "SOURCE_ONLY_ENGLISH_MAIN",
  resolution: asset.assetStatus,
  bundleAllowed: false,
  required: asset.required,
}));
typography.runtimeResolution = "OFFICIAL_ASSET_REQUIRED";
typography.runtimeFontMode = "OFFICIAL_ASSET_REQUIRED";
typography.n2Blocking = requiredUnresolved;
typography.sfRuntimeFonts = [];
typography.runtimePolicyRef = "contracts/naver-smartchannel-runtime-font-policy.json";
typography.fontContractRef = "contracts/naver-smartchannel-font-contract.json";
typography.sourceOnlyNonRuntime = sourceOnlyNonRuntime;

writeJson("contracts/naver-smartchannel-runtime-font-policy.json", policy);
writeJson("contracts/naver-smartchannel-typography.json", typography);
console.log(JSON.stringify({ status: policy.status, requiredAssets: runtimeAssets.filter((asset) => asset.required).length, runtimeAssets: runtimeAssets.length, unresolvedBlockers: policy.unresolvedBlockers }));
