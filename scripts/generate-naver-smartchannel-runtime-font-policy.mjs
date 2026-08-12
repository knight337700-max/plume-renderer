import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

// Registry projection only: this generator never discovers, downloads, or
// substitutes a font. Resolved roles are emitted exactly as approved by the
// frozen font contract and are expected to point at bundled project-relative
// binaries.
const root = process.cwd();
const readJson = (relativePath) => JSON.parse(readFileSync(path.join(root, relativePath), "utf8"));
const writeJson = (relativePath, value) => writeFileSync(path.join(root, relativePath), `${JSON.stringify(value, null, 2)}\n`, "utf8");

const fontContract = readJson("contracts/naver-smartchannel-font-contract.json");
const typography = readJson("contracts/naver-smartchannel-typography.json");
const sourceAudit = existsSync(path.join(root, "contracts/naver-smartchannel-sf-font-audit.json"))
  ? readJson("contracts/naver-smartchannel-sf-font-audit.json")
  : null;
const glyphCoverageSample = "일이삼사오륙칠팔구십 광고 앱 고지문구 및 심의필 입력 영역 APP";

const runtimeAssets = (fontContract.roles ?? []).map((role) => ({
  id: role.id,
  relativePath: typeof role.assetPath === "string" ? role.assetPath : null,
  runtimePostScriptName: typeof role.runtimePostScriptName === "string" ? role.runtimePostScriptName : null,
  binaryPostScriptNames: Array.isArray(role.binaryPostScriptNames) ? role.binaryPostScriptNames : [],
  runtimeRegistrationName: typeof role.runtimeRegistrationName === "string" ? role.runtimeRegistrationName : null,
  runtimeDigest: typeof role.sha256 === "string" ? role.sha256 : null,
  resourceKind: role.resourceKind ?? (role.required === true ? "DERIVED_STANDALONE_FACE" : "SOURCE_ONLY_NON_RUNTIME"),
  ...(role.sourceCollection ? { sourceCollection: role.sourceCollection } : {}),
  weight: role.weight,
  required: role.required === true,
  ...(Array.isArray(role.requiredRoles) ? { requiredRoles: role.requiredRoles } : {}),
  ...(role.required === true ? { glyphCoverageSample } : {}),
  licenseStatus: role.licenseStatus ?? (role.owner === "LEGACY_OTHER_FORMAT" ? "LEGACY_OTHER_FORMAT" : "SOURCE_ONLY_NON_RUNTIME"),
  assetStatus: role.assetStatus ?? "UNRESOLVED_ASSET",
  resolutionClass: role.required === false ? (role.owner === "LEGACY_OTHER_FORMAT" ? "LEGACY_OTHER_FORMAT" : "SOURCE_ONLY_NON_RUNTIME") : (role.assetStatus === "RESOLVED" ? "BUNDLED_EXACT" : "MISSING"),
  smartChannelAllowed: role.required === true && role.assetStatus === "RESOLVED" && typeof role.assetPath === "string" && typeof role.sha256 === "string",
  owner: role.owner ?? (role.required === true ? "RENDERER" : "SOURCE_ONLY"),
  pinned: role.required === true && role.pinned === true,
  environmentIndependent: role.required === true && role.environmentIndependent === true,
  ...(role.required === false ? { runtimeRequired: false } : {}),
}));
const requiredUnresolved = runtimeAssets.some((asset) => asset.required && (asset.assetStatus !== "RESOLVED" || !asset.relativePath || !asset.runtimeDigest));
const sourceOnlyNonRuntime = ["AppleSDGothicNeo-Medium", ...(sourceAudit?.sourceOnlyNonRuntime ?? ["SFProDisplay-Bold", "SFUIDisplay-Bold"])].filter((value, index, all) => all.indexOf(value) === index);
const sourceFonts = (typography.sourceFonts ?? []).map((font) => {
  const runtimeRole = (fontContract.roles ?? []).find((role) => role.required === true && role.sourcePostScriptName === font.postScriptName);
  return {
    postScriptName: font.postScriptName,
    classification: runtimeRole ? "SOURCE_CONFIRMED" : "SOURCE_ONLY_NON_RUNTIME",
    runtimeRequired: Boolean(runtimeRole),
    runtimeFontToken: runtimeRole?.id ?? null,
    binarySha256: runtimeRole?.sourceCollection?.sha256 ?? (runtimeRole?.sha256 ?? null),
  };
});

const policy = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://kbr.local/contracts/naver-smartchannel-runtime-font-policy-v1.5.0.json",
  registryVersion: "1.5.0",
  status: "FROZEN_FAIL_CLOSED_MACOS_SOURCE_TTC",
  channel: "NAVER_GFA",
  placement: "SMARTCHANNEL",
  templateContractVersion: "1.10.0",
  fontContractRef: "contracts/naver-smartchannel-font-contract.json",
  sourceFontInventoryRef: "contracts/naver-smartchannel-typography.json",
  sourceOnlyNonRuntime,
  allowedFamilies: fontContract.allowedFamilies,
  fallbackAllowed: false,
  fontResolutionModes: ["BUNDLED_EXACT", "EXTERNAL_EXACT"],
  runtimeLookupKey: "fontToken",
  fontLookupKey: "fontToken",
  runtimeStatus: requiredUnresolved ? "BLOCKED_UNRESOLVED_MACOS_SOURCE_TTC_ASSET" : "READY_MACOS_SOURCE_TTC_VERIFIED_DERIVED",
  runtimeAssets,
  resolutionClasses: ["BUNDLED_EXACT", "EXTERNAL_EXACT", "LEGACY_OTHER_FORMAT", "MISSING", "SOURCE_ONLY_NON_RUNTIME"],
  requiredSourceFonts: sourceFonts,
  preflight: {
    sequence: ["LOGICAL_TOKEN_LOOKUP", "RENDERER_COLLECTION_RESOURCE_PROVIDER", "COLLECTION_SHA256_EXACT", "COLLECTION_DECODE", "FACE_INDEX_EXISTS", "FACE_POSTSCRIPT_IDENTITY_EXACT", "FACE_VERSION_EXACT", "FACE_GLYPH_COVERAGE_EXACT", "DERIVED_RESOURCE_SHA256_EXACT", "TABLE_EQUIVALENCE_EXACT", "EXPLICIT_BINARY_REGISTRATION"],
    failClosed: true,
    renderStartAllowedOnlyWhen: "ALL_REQUIRED_APPROVED_ASSETS_PASS",
    errors: ["FONT_RESOURCE_MISSING", "FONT_RESOURCE_SHA_MISMATCH", "FONT_COLLECTION_FACE_NOT_FOUND", "FONT_COLLECTION_FACE_IDENTITY_MISMATCH", "FONT_COLLECTION_UNSUPPORTED", "FONT_DERIVED_RESOURCE_PROVENANCE_MISMATCH"],
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
  resourceProviderContract: { environmentIndependent: true, systemFontLookupAllowed: false, windowsAbsoluteFontPathAllowed: false, deploymentAdapters: ["DesktopResourceProvider", "TestDeploymentResourceProvider"], fingerprintMaterial: ["fontToken", "collectionAssetId", "collectionDigest", "faceIndex", "facePostScriptName", "fontContractVersion"], physicalAbsolutePathIncluded: false },
};

typography.runtimeFontAssets = runtimeAssets.map((asset) => ({
  id: asset.id,
  relativePath: asset.relativePath,
  sha256: asset.runtimeDigest,
  ...(asset.sourceCollection ? { sourceCollectionSha256: asset.sourceCollection.sha256, sourceCollectionFaceIndex: asset.sourceCollection.face?.index } : {}),
  weight: asset.weight,
  ...(asset.runtimePostScriptName ? { runtimePostScriptName: asset.runtimePostScriptName } : {}),
  licenseStatus: asset.licenseStatus,
  sourceIdentityToPSD: asset.required ? "PSD_EXACT_ROLE_MAPPING" : "SOURCE_ONLY_NON_RUNTIME",
  resolution: asset.assetStatus,
  bundleAllowed: asset.assetStatus === "RESOLVED" && asset.resolutionClass === "BUNDLED_EXACT",
  required: asset.required,
}));
typography.runtimeResolution = "MACOS_SOURCE_TTC_VERIFIED_DERIVED";
typography.runtimeFontMode = "MACOS_SOURCE_TTC_VERIFIED_DERIVED";
typography.n2Blocking = requiredUnresolved;
typography.sfRuntimeFonts = [];
typography.runtimePolicyRef = "contracts/naver-smartchannel-runtime-font-policy.json";
typography.fontContractRef = "contracts/naver-smartchannel-font-contract.json";
typography.sourceOnlyNonRuntime = sourceOnlyNonRuntime;

writeJson("contracts/naver-smartchannel-runtime-font-policy.json", policy);
writeJson("contracts/naver-smartchannel-typography.json", typography);
console.log(JSON.stringify({ status: policy.status, requiredAssets: runtimeAssets.filter((asset) => asset.required).length, runtimeAssets: runtimeAssets.length, unresolvedBlockers: policy.unresolvedBlockers }));
