import fs from "node:fs";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";

const root = process.cwd();
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const policy = readJson("contracts/naver-smartchannel-runtime-font-policy.json");
const schema = readJson("contracts/naver-smartchannel-font-preflight.schema.json");
const typography = readJson("contracts/naver-smartchannel-typography.json");
const contract = readJson("contracts/naver-smartchannel-template-contract.json");
const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

const required = [
  ["AppleSDGothicNeo-Bold", 120, true, true, true, 14],
  ["AppleSDGothicNeo-Medium", 8, true, false, false, 1],
  ["AppleSDGothicNeo-Regular", 88, true, true, true, 6],
  ["AppleSDGothicNeo-SemiBold", 8, true, false, false, 1],
  ["SFProDisplay-Bold", 56, false, true, false, 2],
  ["SFUIDisplay-Bold", 64, false, true, false, 1],
];
const inventory = new Map((policy.requiredSourceFonts ?? []).map((font) => [font.postScriptName, font]));
expect(policy.registryVersion === "1.0.0", "runtime font policy registry must be v1.0.0");
expect(policy.templateContractVersion === "1.9.0", "runtime font policy template version must be 1.9.0");
expect(policy.status === "FROZEN_FAIL_CLOSED", "runtime font policy must be frozen fail-closed");
expect(policy.fallbackAllowed === false, "SmartChannel fallback must be disabled");
expect(JSON.stringify(policy.fontResolutionModes) === JSON.stringify(["BUNDLED_EXACT", "SYSTEM_EXACT", "EXTERNAL_EXACT"]), "font resolution modes mismatch");
for (const [postScriptName, sourcePsdCount, korean, latin, numeric, tokenCount] of required) {
  const font = inventory.get(postScriptName);
  expect(Boolean(font), `missing source font ${postScriptName}`);
  if (!font) continue;
  expect(font.sourcePsdCount === sourcePsdCount, `${postScriptName} source PSD count mismatch`);
  expect(font.typographyTokens?.length === tokenCount, `${postScriptName} token count mismatch`);
  expect(font.languageUsage?.korean === korean && font.languageUsage?.latin === latin && font.languageUsage?.numeric === numeric, `${postScriptName} language usage mismatch`);
}
expect(inventory.size === 6, `expected six distinct source fonts, got ${inventory.size}`);
const policyTokenIds = (policy.requiredSourceFonts ?? []).flatMap((font) => font.typographyTokens ?? []);
const typographyTokenIds = (typography.tokens ?? []).map((token) => token.id);
expect(policyTokenIds.length === 25 && new Set(policyTokenIds).size === 25, "required source-font token mapping must contain 25 unique tokens");
expect(JSON.stringify([...new Set(policyTokenIds)].sort()) === JSON.stringify([...new Set(typographyTokenIds)].sort()), "required source-font token mapping is not bijective with typography registry");
const counts = Object.fromEntries(policy.resolutionClasses.map((key) => [key, 0]));
for (const entry of policy.resolutionMatrix ?? []) counts[entry.resolutionClass] = (counts[entry.resolutionClass] ?? 0) + 1;
expect(counts.EXACT_BUNDLED_LICENSED === 0, "bundled exact must remain unavailable");
expect(counts.EXACT_SYSTEM === 0, "system exact must remain unavailable");
expect(counts.EXACT_EXTERNAL_LICENSED === 0, "external exact is supported but not currently resolved");
expect(counts.LICENSED_BUT_NOT_SOURCE_MATCH === 2, "Spoqa mismatch count must be two");
expect(counts.MISSING === 4, "missing source font count must be four");
expect(policy.runtimeAssets?.every((asset) => asset.smartChannelAllowed === false && asset.resolutionClass === "LICENSED_BUT_NOT_SOURCE_MATCH"), "non-source runtime assets must be prohibited for SmartChannel");
expect(policy.windowsSmartChannelFontAvailability?.EXACT_SYSTEM === false, "Windows exact system availability must be false");
expect(policy.windowsSmartChannelFontAvailability?.EXACT_BUNDLED_LICENSED === false, "Windows exact bundled availability must be false");
expect(policy.windowsSmartChannelFontAvailability?.EXACT_EXTERNAL_LICENSED_SUPPORTED === true, "trusted external exact support must be true");
expect(policy.windowsSmartChannelFontAvailability?.observedLocalCandidates?.every((entry) => entry.approvedForSmartChannel === false && entry.provenance === "UNRESOLVED"), "unresolved local candidates must not be approved");
expect(policy.externalExactContract?.pathKind === "TRUSTED_ROOT_RELATIVE", "external path kind mismatch");
expect(policy.externalExactContract?.approvedDigestRequired === true && policy.externalExactContract?.networkUrlAllowed === false && policy.externalExactContract?.pathTraversalAllowed === false && policy.externalExactContract?.symlinkAllowed === false && policy.externalExactContract?.windowsReparsePointAllowed === false, "external exact security guard mismatch");
expect(policy.preflight?.failClosed === true && policy.preflight?.renderStartAllowedOnlyWhen === "ALL_REQUIRED_SOURCE_FONTS_PASS", "preflight fail-closed rule mismatch");
expect(policy.n2?.ready === false && policy.n2?.blockers?.length === 1 && policy.n2.blockers[0] === "runtime_font_exact_match_to_psd", "N2 blocker mismatch");
expect(typography.runtimePolicyRef === "contracts/naver-smartchannel-runtime-font-policy.json", "typography policy reference missing");
expect(contract.fontResolutionPolicy?.fallbackAllowed === false, "template fallback policy mismatch");

try {
  const validate = new Ajv2020({ strict: false, allErrors: true }).compile(schema);
  const blockedFixture = {
    templateContractVersion: "1.9.0",
    fallbackAllowed: false,
    fontRequirements: [{ requiredPostScriptName: "AppleSDGothicNeo-Bold", resolutionMode: ["EXTERNAL_EXACT"], fallbackAllowed: false }],
    status: "BLOCKED",
    renderStartAllowed: false,
    errors: [{ code: "NAVER_SMARTCHANNEL_FONT_UNAVAILABLE", messageKey: "naver_smartchannel.font_unavailable", path: "/font/path" }],
    warnings: [],
  };
  expect(validate(blockedFixture), `font preflight schema fixture invalid: ${JSON.stringify(validate.errors)}`);
} catch (error) {
  failures.push(`font preflight schema compilation failed: ${error instanceof Error ? error.message : String(error)}`);
}

const result = { status: failures.length === 0 ? "PASS" : "FAIL", requiredSourceFonts: inventory.size, resolutionCounts: counts, failures };
console.log(JSON.stringify(result, null, 2));
if (failures.length > 0) process.exitCode = 1;
