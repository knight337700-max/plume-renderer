import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import sharp from "sharp";

const root = process.cwd();
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, ...relativePath.split("/")), "utf8"));
const readText = (relativePath) => fs.readFileSync(path.join(root, ...relativePath.split("/")), "utf8");
const checks = [];
const check = (name, condition, detail) => checks.push({ name, status: condition ? "PASS" : "FAIL", detail });
const hash = (relativePath) => createHash("sha256").update(fs.readFileSync(path.join(root, ...relativePath.split("/")))).digest("hex");

const audit = readJson("contracts/audits/naver-smartchannel-text-input-ui-parity-n7-7-6.json");
const versions = readJson("contracts/contract-versions.json");
const packageJson = readJson("package.json");
const matrix = readJson("artifacts/n7-7-6/smartchannel-280-text-input-matrix.json");
const parity = readJson("artifacts/n7-7-6/smartchannel-280-ui-contract-parity.json");
const mainManifest = readJson("artifacts/n7-7-6/main-two-lines-render-manifest.json");
const fourManifest = readJson("artifacts/n7-7-6/four-line-render-manifest.json");
const regression = readJson("artifacts/n7-7-6/regression-summary.json");
const n775 = readJson("contracts/audits/naver-smartchannel-typography-parity-n7-7-5.json");
const helperText = readText("apps/desktop/shared/src/smartchannel-text-input-fields.ts");
const editorText = readText("apps/desktop/renderer-ui/src/features/naver/NaverDesktopEditor.tsx");

check("phase", audit.phase.id === "N7_7_6_SMARTCHANNEL_280_TEXT_INPUT_SCHEMA_UI_FIELD_MAPPING_CORRECTION" && audit.phase.status === "PASS", JSON.stringify(audit.phase));
const m1MetaRuntime = versions.canonicalPhaseM1?.metaRuntimeImplemented === true;
check("versions", (m1MetaRuntime || (versions.documentVersion.current === "1.21.4" && versions.desktopAppVersion === "0.9.12" && packageJson.version === "0.9.12")) && versions.canonicalPhaseN7_7_6.rendererCoreVersion === "0.8.6" && versions.canonicalPhaseN7_7_6.smartChannelTemplateContractVersion === "1.10.0" && versions.canonicalPhaseN8.rendererCoreVersion === "0.8.6", JSON.stringify({ document: versions.documentVersion.current, historical: versions.canonicalPhaseN7_7_6, current: versions.canonicalPhaseN8, m1: versions.canonicalPhaseM1, package: packageJson.version }));
check("scope_freeze", audit.scope.canonicalDocumentChanged === false && audit.scope.rendererCoreChanged === false && audit.scope.typographyChanged === false && audit.scope.fontChanged === false && audit.scope.validatorChanged === false && audit.scope.goldensChanged === false, JSON.stringify(audit.scope));
check("contract_driven_helper", /entry\.visible !== false/u.test(helperText) && /textPlacement/u.test(helperText) && !/MAIN_TWO_LINES|FOUR_LINE/u.test(helperText), "PSD role/order derivation without template or mode names");
check("desktop_same_descriptors", !/function templateFields/u.test(editorText) && /selectedTemplate\?\.textInputFields/u.test(editorText) && /smartFields\.map\(\(field\) => \[field\.key/u.test(editorText), "UI and request consume selected template descriptors");

const requiredArtifacts = [
  "smartchannel-280-text-input-matrix.json",
  "smartchannel-280-ui-contract-parity.json",
  "main-two-lines-basic-desktop.png",
  "main-two-lines-emphasis-desktop.png",
  "four-line-desktop.png",
  "main-two-lines-render-manifest.json",
  "four-line-render-manifest.json",
  "regression-summary.json",
];
check("artifact_inventory", requiredArtifacts.every((name) => fs.existsSync(path.join(root, "artifacts", "n7-7-6", name))), requiredArtifacts.join(", "));
for (const name of requiredArtifacts.filter((entry) => entry.endsWith(".png"))) {
  const metadata = await sharp(path.join(root, "artifacts", "n7-7-6", name)).metadata();
  check(`screenshot_${name}`, metadata.format === "png" && (metadata.width ?? 0) > 400 && (metadata.height ?? 0) > 500, JSON.stringify({ width: metadata.width, height: metadata.height, format: metadata.format }));
}

const mainTwoRows = matrix.matrix.filter((entry) => entry.textVariant === "MAIN_TWO_LINES");
const fourRows = matrix.matrix.filter((entry) => entry.textVariant === "FOUR_LINE");
const ordinaryFour = fourRows.filter((entry) => entry.family === "EMPHASIS");
const bottomFour = fourRows.find((entry) => entry.family === "BOTTOM_DISCLOSURE");
check("matrix_280", matrix.status === "PASS" && matrix.templates === 56 && matrix.matrix.length === 56, JSON.stringify({ status: matrix.status, templates: matrix.templates }));
check("main_two_lines_8", mainTwoRows.length === 8 && mainTwoRows.every((entry) => entry.canonicalKeys[0] === "headline" && entry.canonicalKeys[1] === "headlineLine2"), JSON.stringify(mainTwoRows.map((entry) => ({ id: entry.templateId, keys: entry.canonicalKeys }))));
check("ordinary_four_line_5", ordinaryFour.length === 5 && ordinaryFour.every((entry) => JSON.stringify(entry.canonicalKeys) === JSON.stringify(["headline", "headlineLine2", "subcopy", "subcopyLine4"])), JSON.stringify(ordinaryFour.map((entry) => ({ id: entry.templateId, keys: entry.canonicalKeys }))));
check("bottom_disclosure_source_role", JSON.stringify(bottomFour?.canonicalKeys) === JSON.stringify(["headline", "headlineLine2", "subcopy", "disclosureLine1"]), JSON.stringify(bottomFour));
check("ui_contract_parity", parity.status === "PASS" && parity.templatesChecked === 56 && parity.missingFields === 0 && parity.extraFields === 0 && parity.orderingErrors === 0, JSON.stringify({ status: parity.status, templates: parity.templatesChecked, missing: parity.missingFields, extra: parity.extraFields, order: parity.orderingErrors }));

const roleMap = (manifest) => Object.fromEntries(manifest.smartChannelReport.textRoles.map((entry) => [entry.inputKey, entry.text]));
const mainMapping = roleMap(mainManifest);
const fourMapping = roleMap(fourManifest);
check("main_two_render_mapping", mainMapping.headline === "첫 번째 헤드라인" && mainMapping.headlineLine2 === "두 번째 헤드라인" && new Set(Object.values(mainMapping)).size === Object.keys(mainMapping).length, JSON.stringify(mainMapping));
check("four_line_render_mapping", fourMapping.headline === "헤드라인 첫째 줄" && fourMapping.headlineLine2 === "헤드라인 둘째 줄" && fourMapping.subcopy === "서브카피 셋째 줄" && fourMapping.subcopyLine4 === "서브카피 넷째 줄" && new Set(Object.values(fourMapping)).size === 4, JSON.stringify(fourMapping));

check("n7_7_5_regression", n775.overflow.after.decisionBasis === "ACTUAL_RASTER_BOUNDARY" && n775.overflow.headline14.actualRightEdge === 703 && n775.overflow.headline14.overflow === false && n775.overflow.subcopy17.actualRightEdge === 705 && n775.overflow.subcopy17.overflow === false && n775.verticalParity.representative.headline1.runtimeAfter === 77 && n775.verticalParity.representative.headline2.runtimeAfter === 125 && n775.verticalParity.representative.subcopy.runtimeAfter === 177, JSON.stringify({ overflow: n775.overflow, vertical: n775.verticalParity.representative }));
const fontHashes = {
  ttc: hash("assets/fonts/naver-smartchannel/AppleSDGothicNeo.ttc"),
  regular: hash("assets/fonts/naver-smartchannel/AppleSDGothicNeo-macOS19-Regular.otf"),
  semibold: hash("assets/fonts/naver-smartchannel/AppleSDGothicNeo-macOS19-SemiBold.otf"),
  bold: hash("assets/fonts/naver-smartchannel/AppleSDGothicNeo-macOS19-Bold.otf"),
};
check("font_hashes_unchanged", fontHashes.ttc === "0452cde17bbdfe71106680879df943034a003c537c95a4137bab124b3cfa4b66" && fontHashes.regular === "f41058fdd3ccdf7233abcef16d8d22f66c7dc35c14a5b4f665043f1ab20c86ff" && fontHashes.semibold === "e6aa5c5757cdb7f1b790dd0bfe6d627a4db2bd90a6751b4290733ae21419ba73" && fontHashes.bold === "ae71ed736249e8c07191e6b7ec81d7ec8898f51fdc7d00ea49d2a6592e386cd7", JSON.stringify(fontHashes));
check("final_regression", regression.status === "PASS" && regression.n7_7_5Regression === "PASS" && regression.fullCheck === "PASS" && regression.packageSmoke === "PASS" && regression.desktopSmoke === "PASS" && regression.handoffVerifier === "PASS", JSON.stringify(regression));
check("golden_not_rebased", regression.goldenRebasePerformed === false && regression.readyForGoldenRebase === false, JSON.stringify({ performed: regression.goldenRebasePerformed, ready: regression.readyForGoldenRebase }));
check("runtime_boundary", !/\bfetch\s*\(|https?:\/\//u.test(helperText) && !/plume/iu.test(helperText + editorText), "no runtime network or plume dependency");

for (const result of checks) console.log(`${result.status} ${result.name}: ${result.detail}`);
const failures = checks.filter((entry) => entry.status === "FAIL");
console.log(JSON.stringify({ status: failures.length === 0 ? "PASS" : "FAIL", checks: checks.length, failures: failures.map((entry) => entry.name) }, null, 2));
if (failures.length > 0) process.exitCode = 1;
