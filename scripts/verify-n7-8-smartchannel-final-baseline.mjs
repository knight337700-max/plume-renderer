import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const failures = [];
const checks = [];
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const readJson = async (relative) => JSON.parse(await readFile(path.join(root, relative), "utf8"));
const check = (name, condition, detail) => {
  checks.push({ name, condition, detail });
  if (!condition) failures.push({ name, detail });
};

const audit = await readJson("contracts/audits/naver-smartchannel-final-baseline-n7-8.json");
const versions = await readJson("contracts/contract-versions.json");
const packageJson = await readJson("package.json");
const registry = await readJson("fixtures/golden/naver-smartchannel/registry.json");
const rebase = await readJson("artifacts/n7-8/golden-rebase-manifest.json");
const topology = await readJson("artifacts/n7-8/golden-topology.json");
const finalValidation = await readJson("artifacts/n7-8/smartchannel-120-final-validation.json");
const sourceFixture = await readJson("artifacts/n7-8/source-fixture-regression.json");
const uiParity = await readJson("artifacts/n7-8/smartchannel-280-ui-contract-parity.json");
const nonSmartChannel = await readJson("artifacts/n7-8/non-smartchannel-regression.json");
const packageSmoke = await readJson("artifacts/n7-8/package-smoke.json");
const handoff = await readJson("artifacts/n7-8/handoff-verification.json");

check("phase", audit.phase.id === "N7_8_SMARTCHANNEL_GOLDEN_REBASE_FINAL_PACKAGE_QA" && audit.phase.status === "PASS" && audit.authorization.rebaseApproved === true, JSON.stringify({ phase: audit.phase, authorization: audit.authorization }));
check("versions", versions.documentVersion.current === "1.21.4" && versions.canonicalPhaseN7_8.rendererCoreVersion === "0.8.6" && versions.canonicalPhaseN7_8.smartChannelTemplateContractVersion === "1.10.0" && versions.canonicalPhaseN7_8.smartChannelTypographyCurrent === "1.6.0" && versions.canonicalPhaseN7_8.validatorCurrent === "1.8.1" && versions.canonicalPhaseN8.smartChannelChanged === false && versions.desktopAppVersion === "0.9.12" && packageJson.version === "0.9.12", JSON.stringify({ historical: versions.canonicalPhaseN7_8, current: versions.canonicalPhaseN8, package: packageJson.version }));
check("scope_frozen", audit.scope.canonicalDocumentChanged === false && audit.scope.rendererCoreChanged === false && audit.scope.smartChannelTemplateContractChanged === false && audit.scope.typographyChanged === false && audit.scope.fontResourcesChanged === false && audit.scope.validatorChanged === false && audit.scope.uiFieldMappingChanged === false && audit.scope.smartChannelGoldensChanged === true && audit.scope.nonSmartChannelGoldensChanged === false, JSON.stringify(audit.scope));
check("topology", topology.status === "PASS" && topology.existingGoldenCount === 6 && topology.exhaustiveFixtureCount === 120 && topology.smartChannelTemplatesTotal === 120 && topology.generatedAdditionalGoldens === 0 && registry.candidates.length === 6, JSON.stringify(topology));
check("registry", registry.registryVersion === "1.0.1" && registry.status === "FROZEN_REPRESENTATIVE_GOLDENS_N7_8" && registry.sourceCommit === "a6318e0df7940290743b455a26cc168d985e9bee", JSON.stringify({ version: registry.registryVersion, status: registry.status, sourceCommit: registry.sourceCommit }));

for (const entry of registry.candidates) {
  const pngBytes = await readFile(path.join(root, entry.path));
  const manifestBytes = await readFile(path.join(root, entry.manifestPath));
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  const metadata = await sharp(pngBytes).metadata();
  const metrics = await readJson(`artifacts/n7-8/golden-diffs/${entry.id}/metrics.json`);
  check(`golden_${entry.id}`, sha256(pngBytes) === entry.pngSha256 && sha256(manifestBytes) === entry.manifestSha256 && manifest.outputPngDigest === entry.pngSha256 && metadata.width === entry.width && metadata.height === entry.height && metadata.hasAlpha === true && entry.runDigests.length === 3 && new Set(entry.runDigests).size === 1 && entry.runDigests[0] === entry.pngSha256 && entry.pixelRunDigests.length === 3 && new Set(entry.pixelRunDigests).size === 1 && entry.intentional === true && entry.deterministic === true && entry.uiOnlyChangeAffectedPixels === false, JSON.stringify({ png: entry.pngSha256, manifest: entry.manifestSha256, deterministic: entry.deterministic }));
  check(`diff_${entry.id}`, metrics.changedPixels > 0 && metrics.changedRatio > 0 && metrics.changedRatio < 0.1 && metrics.changedOutsideAllowedRegions === 0 && metrics.expectedScopePass === true && metrics.oldPixelSha256 !== metrics.newPixelSha256, JSON.stringify({ changedPixels: metrics.changedPixels, changedRatio: metrics.changedRatio, outside: metrics.changedOutsideAllowedRegions }));
}

check("rebase_manifest", rebase.status === "PASS" && rebase.representativeGoldenCount === 6 && rebase.exhaustiveTemplateCount === 120 && rebase.intentionalChangesOnly === true && rebase.deterministic === true && rebase.uiOnlyN7_7_6PixelChange === false && rebase.candidates.every((entry) => !path.isAbsolute(entry.inputFixture) && entry.fontCollectionSha256 === "0452cde17bbdfe71106680879df943034a003c537c95a4137bab124b3cfa4b66"), JSON.stringify({ status: rebase.status, count: rebase.representativeGoldenCount, exhaustive: rebase.exhaustiveTemplateCount }));
check("font_hashes", sha256(await readFile(path.join(root, "assets/fonts/naver-smartchannel/AppleSDGothicNeo.ttc"))) === "0452cde17bbdfe71106680879df943034a003c537c95a4137bab124b3cfa4b66" && sha256(await readFile(path.join(root, "assets/fonts/naver-smartchannel/AppleSDGothicNeo-macOS19-Regular.otf"))) === "f41058fdd3ccdf7233abcef16d8d22f66c7dc35c14a5b4f665043f1ab20c86ff" && sha256(await readFile(path.join(root, "assets/fonts/naver-smartchannel/AppleSDGothicNeo-macOS19-SemiBold.otf"))) === "e6aa5c5757cdb7f1b790dd0bfe6d627a4db2bd90a6751b4290733ae21419ba73" && sha256(await readFile(path.join(root, "assets/fonts/naver-smartchannel/AppleSDGothicNeo-macOS19-Bold.otf"))) === "ae71ed736249e8c07191e6b7ec81d7ec8898f51fdc7d00ea49d2a6592e386cd7", "pinned TTC and derived face hashes");
check("source_fixture", sourceFixture.status === "PASS" && sourceFixture.overflowDecisionBasis === "ACTUAL_RASTER_BOUNDARY" && sourceFixture.headline14.actualRightEdge === 703 && sourceFixture.headline14.rightBoundary === 704 && sourceFixture.headline14.overflow === false && sourceFixture.subcopy17.actualRightEdge === 705 && sourceFixture.subcopy17.rightBoundary === 705 && sourceFixture.subcopy17.overflow === false && sourceFixture.vertical.headline1Top === 77 && sourceFixture.vertical.headline2Top === 125 && sourceFixture.vertical.subcopyTop === 177, JSON.stringify(sourceFixture));
check("ui_parity", uiParity.status === "PASS" && uiParity.templatesChecked === 56 && uiParity.missingFields === 0 && uiParity.extraFields === 0 && uiParity.orderingErrors === 0 && uiParity.representativePlaywright.renderRequestMapping === "PASS", JSON.stringify(uiParity));
check("smartchannel_120", finalValidation.status === "PASS" && finalValidation.templatesAttempted === 120 && finalValidation.templatesPassed === 120 && finalValidation.rendered === 120 && finalValidation.fontErrors === 0 && finalValidation.validatorErrors === 0 && finalValidation.crashes === 0 && finalValidation.threeRunDeterminism === true, JSON.stringify(finalValidation));
check("non_smartchannel", nonSmartChannel.status === "PASS" && nonSmartChannel.kakao.every((entry) => entry.status === "PASS") && Object.values(nonSmartChannel.categories).every((entry) => entry.unchanged === true), JSON.stringify(nonSmartChannel));
check("full_regression", Object.values(audit.acceptance).every((value) => value === "PASS" || value === "PROHIBITED"), JSON.stringify(audit.acceptance));
check("package", packageSmoke.status === "PASS" && packageSmoke.package.version === "0.9.11" && packageSmoke.package.sha256 === sha256(await readFile(path.join(root, packageSmoke.package.path))) && packageSmoke.package.bytes === (await stat(path.join(root, packageSmoke.package.path))).size && packageSmoke.packageSmoke === "PASS" && packageSmoke.desktopSmoke === "PASS" && packageSmoke.runtimeNetworkRequests === 0, JSON.stringify(packageSmoke));
check("handoff", handoff.status === "PASS" && handoff.verifier === "PASS" && handoff.rendererModule === "C:/Users/Lenovo/Desktop/Renderer Module" && handoff.filesVerified > 0 && handoff.fontHashes === "PASS" && handoff.goldenHashes === "PASS" && handoff.sourceShaPolicy === "MATCH_FINAL_REPOSITORY_HEAD_AT_FINAL_SYNC", JSON.stringify(handoff));
check("runtime_boundary", versions.runtimeNetworkAccess === "PROHIBITED" && audit.acceptance.runtimeNetworkAccess === "PROHIBITED", "runtime network access prohibited");

for (const result of checks) console.log(`${result.condition ? "PASS" : "FAIL"} ${result.name}: ${result.detail}`);
if (failures.length > 0) {
  console.error(JSON.stringify({ status: "FAIL", checks: checks.length, failures }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ status: "PASS", checks: checks.length, failures: [] }, null, 2));
}
