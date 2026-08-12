import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];
const checks = [];
const required = [
  {
    id: "NAVER_SC_APPLE_SD_GOTHIC_NEO_BOLD",
    file: "assets/fonts/naver-smartchannel/AppleSDGothicNeo-Bold.ttf",
    sha256: "a652ea0a3c4bf8658845f044b5d6f40c39ecf03207e43f325c1451127528402b",
    names: ["AppleSDGothicNeoB00"],
    roles: ["HEADLINE", "HEADLINE_LINE_2"],
  },
  {
    id: "NAVER_SC_APPLE_SD_GOTHIC_NEO_REGULAR",
    file: "assets/fonts/naver-smartchannel/AppleSDGothicNeo-Regular.ttf",
    sha256: "f44eec027992b99dc25de0229c5726fe209a6cb80761aaef98d050cdc0bc6cfe",
    names: ["AppleSDGothicNeoR00"],
    roles: ["SUBCOPY", "THIRD_LINE", "FOURTH_LINE", "DISCLOSURE_LINE_1", "DISCLOSURE_LINE_2"],
  },
  {
    id: "NAVER_SC_APPLE_SD_GOTHIC_NEO_SEMIBOLD",
    file: "assets/fonts/naver-smartchannel/AppleSDGothicNeo-SemiBold.ttf",
    sha256: "a9c5ffb4dadce253d8748b18019954a8af19b7cfcc3b586fce64ef1f6bd71492",
    names: ["AppleSDGothicNeoSB00"],
    roles: ["APP_CTA_TEXT"],
  },
];

function check(name, condition, detail) {
  checks.push({ name, status: condition ? "PASS" : "FAIL", detail });
  if (!condition) failures.push(`${name}: ${detail}`);
}

function readJson(relativePath) {
  try { return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8")); }
  catch (error) { failures.push(`${relativePath}: ${error instanceof Error ? error.message : String(error)}`); return null; }
}

function u16(bytes, offset) {
  return offset >= 0 && offset + 2 <= bytes.length ? (bytes[offset] << 8) | bytes[offset + 1] : null;
}

function u32(bytes, offset) {
  return offset >= 0 && offset + 4 <= bytes.length
    ? ((bytes[offset] * 0x1000000) + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3])
    : null;
}

function decodeUtf16(bytes) {
  let value = "";
  for (let index = 0; index + 1 < bytes.length; index += 2) value += String.fromCharCode((bytes[index] << 8) | bytes[index + 1]);
  return value.replaceAll("\u0000", "").trim();
}

function fontPostScriptNames(bytes) {
  const signature = Buffer.from(bytes.subarray(0, 4)).toString("latin1");
  if (!["OTTO", "true", "typ1", "\0\x01\0\0"].includes(signature)) return [];
  const tableCount = u16(bytes, 4);
  if (tableCount === null) return [];
  let nameOffset = null;
  let nameLength = null;
  for (let index = 0; index < tableCount; index += 1) {
    const row = 12 + index * 16;
    const tag = Buffer.from(bytes.subarray(row, row + 4)).toString("latin1");
    if (tag === "name") { nameOffset = u32(bytes, row + 8); nameLength = u32(bytes, row + 12); break; }
  }
  if (nameOffset === null || nameLength === null) return [];
  const count = u16(bytes, nameOffset + 2);
  const strings = u16(bytes, nameOffset + 4);
  if (count === null || strings === null) return [];
  const values = new Set();
  for (let index = 0; index < count; index += 1) {
    const record = nameOffset + 6 + index * 12;
    const platform = u16(bytes, record);
    const nameId = u16(bytes, record + 6);
    const length = u16(bytes, record + 8);
    const valueOffset = u16(bytes, record + 10);
    if (platform === null || nameId !== 6 || length === null || valueOffset === null) continue;
    const start = nameOffset + strings + valueOffset;
    if (start < nameOffset || start + length > nameOffset + nameLength) continue;
    const value = platform === 0 || platform === 3
      ? decodeUtf16(bytes.subarray(start, start + length))
      : Buffer.from(bytes.subarray(start, start + length)).toString("utf8").replaceAll("\0", "").trim();
    if (value) values.add(value);
  }
  return [...values].sort();
}

async function digest(relativePath) {
  return createHash("sha256").update(await readFile(path.join(root, relativePath))).digest("hex");
}

const correction = readJson("contracts/audits/naver-smartchannel-runtime-font-correction-n7-7.json");
const priorAudit = readJson("contracts/audits/naver-smartchannel-typography-audit.json");
const policy = readJson("contracts/naver-smartchannel-runtime-font-policy.json");
const compatibility = readJson("contracts/naver-smartchannel-font-compatibility.json");
const fontContract = readJson("contracts/naver-smartchannel-font-contract.json");
const assetManifest = readJson("contracts/naver-smartchannel-font-asset-manifest.json");
const typography = readJson("contracts/naver-smartchannel-typography.json");
const templateContract = readJson("contracts/naver-smartchannel-template-contract.json");
const versions = readJson("contracts/contract-versions.json");

check("correction_phase", correction?.phase?.id === "N7_7_SMARTCHANNEL_PSD_EXACT_RUNTIME_FONT_CORRECTION" && correction?.phase?.status === "PASS", JSON.stringify(correction?.phase));
check("prior_audit_preserved", priorAudit?.phase?.id === "N7_6_SMARTCHANNEL_GLOBAL_TYPOGRAPHY_AUDIT" && priorAudit?.phase?.status === "MISMATCH_FOUND" && priorAudit?.source?.psdCount?.total === 120 && priorAudit?.summary?.tokenAudit?.total === 25, JSON.stringify({ phase: priorAudit?.phase, psdCount: priorAudit?.source?.psdCount?.total, tokens: priorAudit?.summary?.tokenAudit?.total }));
check("version_policy", versions?.documentVersion?.current === "1.21.4" && versions?.canonicalPhaseN7_7?.rendererCoreVersion === "0.8.4" && versions?.canonicalPhaseN7_7?.desktopCurrent === "0.9.7" && versions?.canonicalPhaseN7_7_6?.rendererCoreVersion === "0.8.6" && versions?.canonicalPhaseN7_7_6?.desktopCurrent === "0.9.10" && versions?.templateContractVersion === "1.9.0", JSON.stringify({ historical: versions?.canonicalPhaseN7_7, current: versions?.canonicalPhaseN7_7_6 }));
check("template_contract_frozen", correction?.phase?.templateContractVersion === "1.9.0" && correction?.phase?.smartChannelTemplateContractVersion === "1.10.0" && correction?.representative?.geometryChanged === false && versions?.canonicalPhaseN7_7?.templateCoordinatesChanged === false, JSON.stringify({ templateContractVersion: correction?.phase?.templateContractVersion, smartChannelTemplateContractVersion: correction?.phase?.smartChannelTemplateContractVersion, geometryChanged: correction?.representative?.geometryChanged, coordinatesChanged: versions?.canonicalPhaseN7_7?.templateCoordinatesChanged }));
check("required_roles", JSON.stringify(policy?.runtimeAssets?.filter((asset) => asset.required).map((asset) => asset.id).sort()) === JSON.stringify(required.map((asset) => asset.id).sort()), JSON.stringify(policy?.runtimeAssets?.filter((asset) => asset.required).map((asset) => asset.id)));
check("no_nanum_required", (policy?.runtimeAssets ?? []).filter((asset) => asset.required).every((asset) => !String(asset.id).includes("NANUM")) && correction?.tokenPolicy?.nanumSmartChannelRequired === false, "Nanum remains a SmartChannel runtime requirement");
check("source_only_roles", JSON.stringify(correction?.sourceOnlyNonRuntime?.map((entry) => entry.label).sort()) === JSON.stringify(["AppleSDGothicNeo-Medium", "SFProDisplay-Bold", "SFUIDisplay-Bold"].sort()) && correction?.sourceOnlyNonRuntime?.every((entry) => entry.runtimeRequired === false && entry.status === "SOURCE_ONLY_NON_RUNTIME"), JSON.stringify(correction?.sourceOnlyNonRuntime));
check("runtime_policy", policy?.fallbackAllowed === false && policy?.runtimeNetworkAccess === "PROHIBITED" && JSON.stringify(policy?.fontResolutionModes) === JSON.stringify(["BUNDLED_EXACT", "EXTERNAL_EXACT"]) && policy?.resourceProviderContract?.systemFontLookupAllowed === false && policy?.resourceProviderContract?.windowsAbsoluteFontPathAllowed === false, JSON.stringify({ modes: policy?.fontResolutionModes, fallback: policy?.fallbackAllowed, network: policy?.runtimeNetworkAccess, provider: policy?.resourceProviderContract }));
check("provider_parity", correction?.acceptanceEvidence?.providerParity?.status === "PASS" && correction?.acceptanceEvidence?.providerParity?.sameFontSha256 === true && correction?.acceptanceEvidence?.providerParity?.samePixelFingerprint === true && correction?.acceptanceEvidence?.providerParity?.samePngDigest === true, JSON.stringify(correction?.acceptanceEvidence?.providerParity));
check("environment_independence", correction?.environmentIndependence?.status === "PASS" && correction?.environmentIndependence?.sameFontBytes === true && correction?.environmentIndependence?.sameFontSha256 === true && correction?.environmentIndependence?.samePixelFingerprint === true && correction?.environmentIndependence?.samePngDigest === true, JSON.stringify(correction?.environmentIndependence));
check("exhaustive_acceptance", correction?.acceptanceEvidence?.templatesRendered === 120 && correction?.acceptanceEvidence?.templatesPassed === 120 && correction?.acceptanceEvidence?.fontResolutionFailures === 0 && correction?.acceptanceEvidence?.newValidationErrors === 0 && correction?.acceptanceEvidence?.deterministicThreeRuns === true, JSON.stringify(correction?.acceptanceEvidence));

for (const asset of required) {
  const absolute = path.join(root, asset.file);
  const exists = fs.existsSync(absolute);
  let actualDigest = null;
  let actualNames = [];
  if (exists) {
    actualDigest = await digest(asset.file);
    actualNames = fontPostScriptNames(new Uint8Array(await readFile(absolute)));
  }
  check(`${asset.id}_exists`, exists, asset.file);
  check(`${asset.id}_sha256`, actualDigest === asset.sha256, JSON.stringify({ expected: asset.sha256, actual: actualDigest }));
  check(`${asset.id}_postscript_identity`, asset.names.every((name) => actualNames.includes(name)), JSON.stringify({ expected: asset.names, actual: actualNames }));
}

const roleMapping = correction?.roleMapping ?? {};
check("role_mapping", Object.entries(roleMapping).every(([role, token]) => required.find((asset) => asset.id === token)?.roles.includes(role) === true), JSON.stringify(roleMapping));
check("font_contract_required", (fontContract?.roles ?? []).filter((role) => role.required).map((role) => role.id).sort().join(",") === required.map((asset) => asset.id).sort().join(","), JSON.stringify(fontContract?.roles?.filter((role) => role.required).map((role) => role.id)));
check("compatibility_required", (compatibility?.fonts ?? []).filter((font) => font.required).map((font) => font.fontToken).sort().join(",") === required.map((asset) => asset.id).sort().join(","), JSON.stringify(compatibility?.fonts?.filter((font) => font.required).map((font) => font.fontToken)));
check("asset_manifest_required", (assetManifest?.files ?? []).filter((file) => file.runtime === true).filter((file) => file.bundled === true).length === 3, JSON.stringify(assetManifest?.files?.filter((file) => file.runtime === true).map((file) => file.fileName)));
check("typography_correction", typography?.runtimeCorrection?.phase === "N7_7_4_MACOS_ORIGINAL_TTC_RENDERER_INTEGRATION" && typography?.runtimeCorrection?.tokenIdsPreserved === true && typography?.runtimeResolution === "MACOS_SOURCE_TTC_VERIFIED_DERIVED", JSON.stringify(typography?.runtimeCorrection));
check("template_count", templateContract?.templates?.length === 120 && templateContract?.sourceResolutionStatus === "SOURCE_RESOLVED_RENDERER_OWNED_PSD_EXACT", JSON.stringify({ count: templateContract?.templates?.length, status: templateContract?.sourceResolutionStatus }));

const coreFiles = ["src/core/naver-smartchannel.ts", "src/core/naver-smartchannel-font-preflight.ts", "src/core/index.ts", "apps/desktop/electron-main/src/desktop-controller.ts", "apps/desktop/renderer-ui/src/features/naver/NaverDesktopEditor.tsx"];
const coreTexts = await Promise.all(coreFiles.map((file) => readFile(path.join(root, file), "utf8")));
const coreText = coreTexts.join("\n");
const runtimeCoreText = coreTexts.slice(0, 3).join("\n");
check("core_no_system_mode", !coreText.includes("SYSTEM_EXACT") && !coreText.includes("NAVER_SMARTCHANNEL_FONT_DIR") && !coreText.includes("C:\\Windows\\Fonts"), "no SYSTEM_EXACT mode, environment font directory, or Windows system font path");
const fingerprintSource = coreText.slice(coreText.indexOf("const fontFingerprintMaterial"), coreText.indexOf("const renderFingerprint"));
check("core_logical_fingerprint", fingerprintSource.includes("font.token") && fingerprintSource.includes("font.collectionDigest") && fingerprintSource.includes("font.collectionFaceIndex") && !fingerprintSource.includes("font.path") && !fingerprintSource.includes("resolvedPath"), fingerprintSource || "pixel fingerprint construction not found");
check("core_no_network", !/\bfetch\s*\(|https?:\/\//u.test(runtimeCoreText), "no fetch call or URL appears in SmartChannel runtime core");
check("no_plume_dependency", !/plume/iu.test(fs.readFileSync(path.join(root, "package.json"), "utf8")) && !/plume/iu.test(coreText), "active runtime has no plume dependency or reference");
check("golden_migration_recorded", correction?.goldenMigration?.status === "RECORDED_EXPECTED_CHANGE" && correction?.fingerprintMigration?.geometryChange === false, JSON.stringify({ golden: correction?.goldenMigration, fingerprint: correction?.fingerprintMigration }));

for (const result of checks) console.log(`${result.status} ${result.name}: ${result.detail}`);
console.log(JSON.stringify({ status: failures.length === 0 ? "PASS" : "FAIL", checks: checks.length, failures }, null, 2));
if (failures.length > 0) process.exitCode = 1;
