import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const compatibility = readJson("contracts/naver-smartchannel-font-compatibility.json");
const policy = readJson("contracts/naver-smartchannel-runtime-font-policy.json");
const contract = readJson("contracts/naver-smartchannel-font-contract.json");
const metrics = readJson("contracts/naver-smartchannel-font-metric-fixtures.json");
const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

expect(compatibility.registryVersion === "1.1.0", "compatibility registry must be v1.1.0");
expect(compatibility.status === "OFFICIAL_ASSETS_UNRESOLVED", "compatibility status must be unresolved");
expect(compatibility.runtimeFontMode === "OFFICIAL_ASSET_REQUIRED", "runtime mode must require official assets");
expect(compatibility.runtimeLookupKey === "fontToken", "runtime lookup key mismatch");
expect(compatibility.approvedDigestAllowlist && Object.keys(compatibility.approvedDigestAllowlist).length === 0, "unresolved registry must not fabricate digests");
expect(compatibility.fonts.length === 3, "official roles count mismatch");
expect(compatibility.fonts.every((font) => font.runtime.localSha256 === null && font.runtime.bundleAllowed === false && font.runtime.commitAllowed === false && font.runtime.networkFetchAllowed === false), "unresolved assets must remain non-bundled and non-network");
expect(!compatibility.fonts.some((font) => String(font.fontToken).includes("APPLE_SD_GOTHIC_NEO")), "Apple runtime IDs must be absent");
expect(policy.runtimeAssets.filter((asset) => asset.required).length === 2, "only Bold and Regular are unconditional");
expect(contract.mediumRequired === false && contract.semiBoldRequired === false, "Medium/SemiBold must not be unconditional");
expect(metrics.status === "BLOCKED_UNRESOLVED_ASSET" && metrics.summary.overflow === 0, "metric fixture status mismatch");

const result = { status: failures.length === 0 ? "PASS" : "FAIL", fontCount: compatibility.fonts.length, runtimeStatus: compatibility.status, failures };
console.log(JSON.stringify(result, null, 2));
if (failures.length > 0) process.exitCode = 1;
