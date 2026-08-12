import fs from "node:fs";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";

const root = process.cwd();
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const policy = readJson("contracts/naver-smartchannel-runtime-font-policy.json");
const fontContract = readJson("contracts/naver-smartchannel-font-contract.json");
const schema = readJson("contracts/naver-smartchannel-font-preflight.schema.json");
const typography = readJson("contracts/naver-smartchannel-typography.json");
const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

expect(policy.registryVersion === "1.5.0", "runtime font policy must be v1.5.0");
expect(policy.templateContractVersion === "1.10.0", "runtime font policy template version must be 1.10.0");
expect(policy.status === "FROZEN_FAIL_CLOSED_MACOS_SOURCE_TTC", "runtime font policy must freeze the macOS source TTC mapping");
expect(policy.runtimeStatus === "READY_MACOS_SOURCE_TTC_VERIFIED_DERIVED", "runtime status must expose the verified macOS TTC resources");
expect(policy.fallbackAllowed === false, "SmartChannel fallback must be disabled");
expect(JSON.stringify(policy.fontResolutionModes) === JSON.stringify(["BUNDLED_EXACT", "EXTERNAL_EXACT"]), "font resolution modes mismatch");
expect(policy.runtimeAssets.length === 7, "runtime role registry must include Apple, legacy, Medium, and SF source records");
expect(policy.runtimeAssets.filter((asset) => asset.required).map((asset) => asset.id).sort().join(",") === "NAVER_SC_APPLE_SD_GOTHIC_NEO_BOLD,NAVER_SC_APPLE_SD_GOTHIC_NEO_REGULAR,NAVER_SC_APPLE_SD_GOTHIC_NEO_SEMIBOLD", "required role IDs mismatch");
expect(policy.runtimeAssets.filter((asset) => asset.required).every((asset) => asset.assetStatus === "RESOLVED" && /^[a-f0-9]{64}$/.test(asset.runtimeDigest ?? "") && asset.resolutionClass === "BUNDLED_EXACT" && asset.smartChannelAllowed === true && asset.resourceKind === "DERIVED_STANDALONE_FACE" && asset.sourceCollection?.sha256 === "0452cde17bbdfe71106680879df943034a003c537c95a4137bab124b3cfa4b66"), "required assets must be verified standalone faces derived from the pinned TTC");
expect(policy.runtimeAssets.some((asset) => asset.id === "NAVER_SC_SAN_FRANCISCO_BOLD" && asset.required === false), "SF role must be optional");
expect(policy.runtimeAssets.filter((asset) => asset.required).every((asset) => asset.owner === "RENDERER" && asset.pinned === true && asset.environmentIndependent === true), "required resources must be renderer-owned and environment independent");
expect(fontContract.allowedFamilies.includes("AppleSDGothicNeo") && fontContract.allowedFamilies.includes("NanumBarunGothic") && fontContract.allowedFamilies.includes("San Francisco"), "font family allowlist mismatch");
expect(fontContract.fallbackAllowed === false && fontContract.mediumRequired === false && fontContract.semiBoldRequired === true, "weight/fallback policy mismatch");
expect(typography.runtimeFontAssets.length === 7 && typography.n2Blocking === false, "typography registry must record corrected runtime assets");
for (const asset of policy.runtimeAssets.filter((entry) => entry.required)) {
  expect(typeof asset.relativePath === "string" && !path.isAbsolute(asset.relativePath) && !asset.relativePath.includes(".."), `${asset.id} relative path must be trusted`);
  expect(fs.existsSync(path.join(root, "assets", "fonts", "naver-smartchannel", path.basename(asset.relativePath))), `${asset.id} bundled binary missing`);
  expect(typeof asset.runtimePostScriptName === "string" && asset.runtimePostScriptName.startsWith("AppleSDGothicNeo-"), `${asset.id} PostScript identity mismatch`);
}
try {
  const validate = new Ajv2020({ strict: false, allErrors: true }).compile(schema);
  const blockedFixture = {
    templateContractVersion: "1.10.0",
    fallbackAllowed: false,
    fontRequirements: [{ requiredPostScriptName: "AppleSDGothicNeo-Bold", resolutionMode: ["EXTERNAL_EXACT"], fallbackAllowed: false }],
    status: "BLOCKED",
    renderStartAllowed: false,
    errors: [{ code: "NAVER_SMARTCHANNEL_FONT_UNAVAILABLE", messageKey: "naver_smartchannel.font_unavailable", path: "/fonts/main" }],
    warnings: [],
  };
  expect(validate(blockedFixture), `font preflight schema fixture invalid: ${JSON.stringify(validate.errors)}`);
} catch (error) {
  failures.push(`font preflight schema compilation failed: ${error instanceof Error ? error.message : String(error)}`);
}

const result = { status: failures.length === 0 ? "PASS" : "FAIL", requiredAssets: policy.runtimeAssets.filter((asset) => asset.required).length, runtimeStatus: policy.runtimeStatus, failures };
console.log(JSON.stringify(result, null, 2));
if (failures.length > 0) process.exitCode = 1;
