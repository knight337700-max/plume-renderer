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

expect(policy.registryVersion === "1.3.0", "runtime font policy must be v1.3.0");
expect(policy.templateContractVersion === "1.10.0", "runtime font policy template version must be 1.10.0");
expect(policy.status === "FROZEN_FAIL_CLOSED", "runtime font policy must be frozen fail-closed");
expect(policy.runtimeStatus === "READY_APPROVED_OFFICIAL_ASSET", "runtime status must expose bundled approved official assets");
expect(policy.fallbackAllowed === false, "SmartChannel fallback must be disabled");
expect(JSON.stringify(policy.fontResolutionModes) === JSON.stringify(["BUNDLED_EXACT", "SYSTEM_EXACT", "EXTERNAL_EXACT"]), "font resolution modes mismatch");
expect(policy.runtimeAssets.length === 3, "official runtime role registry must contain two required roles and one optional SF role");
expect(policy.runtimeAssets.filter((asset) => asset.required).map((asset) => asset.id).sort().join(",") === "NAVER_SC_NANUM_BARUN_GOTHIC_BOLD,NAVER_SC_NANUM_BARUN_GOTHIC_REGULAR", "required role IDs mismatch");
expect(policy.runtimeAssets.filter((asset) => asset.required).every((asset) => asset.assetStatus === "RESOLVED" && /^[a-f0-9]{64}$/.test(asset.runtimeDigest ?? "") && asset.resolutionClass === "BUNDLED_EXACT" && asset.smartChannelAllowed === true), "required official assets must be bundled exact assets with digests");
expect(policy.runtimeAssets.some((asset) => asset.id === "NAVER_SC_SAN_FRANCISCO_BOLD" && asset.required === false), "SF role must be optional");
expect(!policy.runtimeAssets.some((asset) => String(asset.id).includes("APPLE_SD_GOTHIC_NEO")), "Apple runtime IDs must be removed");
expect(fontContract.allowedFamilies.includes("NanumBarunGothic") && fontContract.allowedFamilies.includes("Sandoll Neo Gothic") && fontContract.allowedFamilies.includes("San Francisco"), "official family allowlist mismatch");
expect(fontContract.fallbackAllowed === false && fontContract.mediumRequired === false && fontContract.semiBoldRequired === false, "official weight/fallback policy mismatch");
expect(typography.runtimeFontAssets.length === 3 && typography.n2Blocking === false, "typography registry must record resolved runtime assets");
for (const asset of policy.runtimeAssets.filter((entry) => entry.required)) {
  expect(typeof asset.relativePath === "string" && !path.isAbsolute(asset.relativePath) && !asset.relativePath.includes(".."), `${asset.id} relative path must be trusted`);
  expect(fs.existsSync(path.join(root, "assets", "fonts", "naver-smartchannel", path.basename(asset.relativePath))), `${asset.id} bundled binary missing`);
  expect(asset.runtimePostScriptName === (asset.id.endsWith("BOLD") ? "NanumBarunGothicBold" : "NanumBarunGothic"), `${asset.id} PostScript identity mismatch`);
}
try {
  const validate = new Ajv2020({ strict: false, allErrors: true }).compile(schema);
  const blockedFixture = {
    templateContractVersion: "1.10.0",
    fallbackAllowed: false,
    fontRequirements: [{ requiredPostScriptName: "NanumBarunGothicBold", resolutionMode: ["EXTERNAL_EXACT"], fallbackAllowed: false }],
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
