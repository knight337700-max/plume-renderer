import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import sharp from "sharp";

const root = process.cwd();
const failures = [];
const checks = [];
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const sha256 = (relativePath) => createHash("sha256").update(fs.readFileSync(path.join(root, relativePath))).digest("hex");
function check(name, condition, detail) {
  checks.push({ name, status: condition ? "PASS" : "FAIL", detail });
  if (!condition) failures.push(`${name}: ${detail}`);
}

const versions = readJson("contracts/contract-versions.json");
const packageJson = readJson("package.json");
const audit = readJson("contracts/audits/naver-smartchannel-typography-parity-n7-7-5.json");
const typography = readJson("contracts/naver-smartchannel-typography.json");
const errors = readJson("contracts/error-registry.json");
const locale = readJson("apps/desktop/renderer-ui/src/i18n/ko-KR.json");
const width = readJson("artifacts/n7-7-5/width-overflow-audit.json");
const vertical = readJson("artifacts/n7-7-5/vertical-raster-alignment-audit.json");
const i18n = readJson("artifacts/n7-7-5/i18n-error-audit.json");
const smoke = readJson("artifacts/n7-7-5/smartchannel-120-smoke.json");
const manifest = readJson("artifacts/n7-7-5/representative-after-current-fixes.manifest.json");

check("phase", audit.phase.id === "N7_7_5_SMARTCHANNEL_TYPOGRAPHY_PARITY_CORRECTION" && audit.phase.status === "PASS", JSON.stringify(audit.phase));
check("versions", versions.documentVersion.current === "1.21.4" && versions.canonicalPhaseN7_7_5.rendererCoreVersion === "0.8.6" && versions.desktopAppVersion === "0.9.9" && packageJson.version === "0.9.9" && errors.registryVersion === "1.8.1" && typography.registryVersion === "1.6.0", JSON.stringify({ document: versions.documentVersion, phase: versions.canonicalPhaseN7_7_5, package: packageJson.version }));
check("template_geometry_frozen", versions.templateContractVersion === "1.9.0" && versions.smartChannelTemplateContractVersion === "1.10.0" && versions.canonicalPhaseN7_7_5.templateCoordinatesChanged === false, JSON.stringify(versions.canonicalPhaseN7_7_5));

const expectedArtifacts = [
  "headline-14-source-pass.png",
  "subcopy-17-source-pass.png",
  "headline-14-boundary-overlay.png",
  "subcopy-17-boundary-overlay.png",
  "representative-after-current-fixes.png",
  "representative-after-current-fixes.manifest.json",
  "width-overflow-audit.json",
  "vertical-raster-alignment-audit.json",
  "i18n-error-audit.json",
  "smartchannel-120-smoke.json",
];
check("artifact_inventory", expectedArtifacts.every((file) => fs.existsSync(path.join(root, "artifacts/n7-7-5", file))), expectedArtifacts.join(", "));
for (const file of expectedArtifacts.filter((entry) => entry.endsWith(".png"))) {
  const metadata = await sharp(path.join(root, "artifacts/n7-7-5", file)).metadata();
  check(`png_${file}`, metadata.format === "png" && metadata.width === 750 && metadata.height === 280 && metadata.hasAlpha === true, JSON.stringify(metadata));
}

const headline14 = width.headline.find((entry) => entry.requestedGraphemeCount === 14);
const subcopy17 = width.subcopy.find((entry) => entry.requestedGraphemeCount === 17);
check("headline_14", headline14?.sourceProven === true && headline14?.decisionBasis === "ACTUAL_RASTER_BOUNDARY" && headline14?.rightBoundary === 704 && headline14?.actualRightEdge === 703 && headline14?.overflow === false && headline14?.clipped === false, JSON.stringify(headline14));
check("subcopy_17", subcopy17?.sourceProven === true && subcopy17?.decisionBasis === "ACTUAL_RASTER_BOUNDARY" && subcopy17?.rightBoundary === 705 && subcopy17?.actualRightEdge === 705 && subcopy17?.overflow === false && subcopy17?.clipped === false, JSON.stringify(subcopy17));
check("extension_matrix", width.headline.map((entry) => entry.overflow).join(",") === "false,false,true" && width.subcopy.map((entry) => entry.overflow).join(",") === "false,false,true", JSON.stringify({ headline: width.headline.map((entry) => entry.overflow), subcopy: width.subcopy.map((entry) => entry.overflow) }));
check("mixed_width", width.mixed.length === 5 && width.mixed.every((entry) => entry.decisionBasis === "ACTUAL_RASTER_BOUNDARY") && width.mixed.find((entry) => entry.text === "ABCDEFGHIJKLMNO")?.graphemeCount === 15 && width.mixed.find((entry) => entry.text === "ABCDEFGHIJKLMNO")?.overflow === false, JSON.stringify(width.mixed));
check("determinism", width.determinism.runs === 3 && width.determinism.pixelIdentical === true && width.determinism.artifactBytesIdentical === true && new Set(width.determinism.outputDigests).size === 1 && new Set(width.determinism.pixelFingerprints).size === 1, JSON.stringify(width.determinism));

const adapter = typography.rasterAlignmentAdapters?.find((entry) => entry.id === "PSD_TO_SKIA_HEADLINE_BOLD_35_KO_MINUS_1Y");
check("alignment_adapter", adapter?.baselineDeltaY === -1 && adapter?.typographyTokenIds?.join(",") === "PSD_TYPE_TOKEN_3cb00cba41e436f4" && adapter?.roles?.join(",") === "HEADLINE", JSON.stringify(adapter));
check("vertical_83", vertical.status === "PASS" && vertical.auditedVisibleNonGuideLayers === 83 && vertical.topDeltaBeforeCounts?.["1"] === 83 && vertical.topDeltaAfterCounts?.["0"] === 83 && vertical.rows.every((row) => row.baselineDeltaY === -1 && row.topDeltaBefore === 1 && row.topDeltaAfter === 0), JSON.stringify({ count: vertical.auditedVisibleNonGuideLayers, before: vertical.topDeltaBeforeCounts, after: vertical.topDeltaAfterCounts }));
const h1 = manifest.smartChannelReport.textRoles.find((entry) => entry.inputKey === "headline");
const h2 = manifest.smartChannelReport.textRoles.find((entry) => entry.inputKey === "headlineLine2");
const sub = manifest.smartChannelReport.textRoles.find((entry) => entry.inputKey === "subcopy");
check("representative_vertical", h1?.actualRasterBounds?.y === 77 && h2?.actualRasterBounds?.y === 125 && sub?.actualRasterBounds?.y === 177 && h1?.baselineY === 106.45703125 && h2?.baselineY === 154.45703125 && sub?.baselineY === 201.45703125, JSON.stringify({ h1, h2, sub }));

const error = errors.codes.find((entry) => entry.code === "NAVER_SMARTCHANNEL_TEXT_OVERFLOW");
check("i18n", error?.messageKey === "naver_smartchannel.text_overflow" && locale[error.messageKey] === "텍스트가 스마트채널 허용 영역을 벗어났습니다." && i18n.status === "PASS" && i18n.missingTranslationFallbackVisible === false, JSON.stringify({ error, message: locale[error?.messageKey], audit: i18n }));
check("smartchannel_120", smoke.status === "PASS" && smoke.attempted === 120 && smoke.rendered === 120 && smoke.newFontErrors === 0 && smoke.newValidatorErrors === 0 && smoke.crashes === 0 && smoke.threeRunDeterminism === true && smoke.goldenRebasePerformed === false && smoke.readyForGoldenRebase === false, JSON.stringify(smoke));

const fontHashes = {
  "assets/fonts/naver-smartchannel/AppleSDGothicNeo.ttc": "0452cde17bbdfe71106680879df943034a003c537c95a4137bab124b3cfa4b66",
  "assets/fonts/naver-smartchannel/AppleSDGothicNeo-macOS19-Regular.otf": "f41058fdd3ccdf7233abcef16d8d22f66c7dc35c14a5b4f665043f1ab20c86ff",
  "assets/fonts/naver-smartchannel/AppleSDGothicNeo-macOS19-SemiBold.otf": "e6aa5c5757cdb7f1b790dd0bfe6d627a4db2bd90a6751b4290733ae21419ba73",
  "assets/fonts/naver-smartchannel/AppleSDGothicNeo-macOS19-Bold.otf": "ae71ed736249e8c07191e6b7ec81d7ec8898f51fdc7d00ea49d2a6592e386cd7",
};
check("font_hashes_unchanged", Object.entries(fontHashes).every(([file, digest]) => sha256(file) === digest), JSON.stringify(Object.fromEntries(Object.keys(fontHashes).map((file) => [file, sha256(file)]))));
const coreText = fs.readFileSync(path.join(root, "src/core/naver-smartchannel.ts"), "utf8");
check("algorithm_source", coreText.includes("ACTUAL_RASTER_BOUNDARY") && coreText.includes("actualRightEdge = raster.bounds ? raster.bounds.x + raster.bounds.width - 1") && !/graphemeCount\s*===\s*(14|17)|text\.length\s*===\s*(14|17)/u.test(coreText), "actual raster boundary without 14/17 exception");
check("golden_not_rebased", audit.scope.goldensChanged === false && audit.acceptance.goldenRebasePerformed === false && audit.acceptance.readyForGoldenRebase === false, JSON.stringify(audit.acceptance));
check("runtime_boundary", !/\bfetch\s*\(|https?:\/\//u.test(coreText) && !/plume/iu.test(coreText) && versions.canonicalPhaseN7_7_5.runtimeNetworkAccess === "PROHIBITED", "no runtime network or plume dependency");

for (const result of checks) console.log(`${result.status} ${result.name}: ${result.detail}`);
console.log(JSON.stringify({ status: failures.length === 0 ? "PASS" : "FAIL", checks: checks.length, failures }, null, 2));
if (failures.length > 0) process.exitCode = 1;

