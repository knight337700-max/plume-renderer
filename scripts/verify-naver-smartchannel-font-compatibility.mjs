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

expect(compatibility.registryVersion === "1.3.0", "compatibility registry must be v1.3.0");
expect(compatibility.status === "MACOS_SOURCE_TTC_VERIFIED_DERIVED_PINNED", "compatibility status must record the pinned macOS TTC and verified derived faces");
expect(compatibility.runtimeFontMode === "MACOS_SOURCE_TTC_VERIFIED_DERIVED", "runtime mode must require the pinned macOS TTC and verified derived faces");
expect(compatibility.runtimeLookupKey === "fontToken", "runtime lookup key mismatch");
expect(compatibility.approvedDigestAllowlist && Object.keys(compatibility.approvedDigestAllowlist).length === 0, "digest allowlist must remain empty; role digests are authoritative");
expect(compatibility.fonts.length === 7, "font role registry count mismatch");
expect(compatibility.fonts.filter((font) => font.required).length === 3 && compatibility.fonts.filter((font) => font.required).every((font) => /^[a-f0-9]{64}$/.test(font.runtime.localSha256 ?? "") && font.runtime.bundleAllowed === true && font.runtime.commitAllowed === true && font.runtime.networkFetchAllowed === false), "required assets must be bundled exact and non-network");
expect(compatibility.fonts.filter((font) => font.required).every((font) => String(font.fontToken).includes("APPLE_SD_GOTHIC_NEO")), "required runtime IDs must be Apple exact");
expect(policy.runtimeAssets.filter((asset) => asset.required).length === 3, "Bold, Regular, and SemiBold are required visible roles");
expect(contract.mediumRequired === false && contract.semiBoldRequired === true, "Medium/SemiBold policy mismatch");
expect(metrics.status === "RESOLVED_MACOS_SOURCE_TTC_VERIFIED_DERIVED" && metrics.summary.overflow === 0, "metric fixture status mismatch");
expect(metrics.summary.total >= 6 && metrics.summary.pass === metrics.summary.total && metrics.fixtures.every((fixture) => fixture.deterministic === true && typeof fixture.measuredWidth === "number"), "resolved metric fixtures are incomplete");

const result = { status: failures.length === 0 ? "PASS" : "FAIL", fontCount: compatibility.fonts.length, runtimeStatus: compatibility.status, failures };
console.log(JSON.stringify(result, null, 2));
if (failures.length > 0) process.exitCode = 1;
