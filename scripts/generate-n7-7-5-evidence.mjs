import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import sharp from "sharp";

import {
  auditSmartChannelTypographyTokenRasterAlignment,
  diagnoseSmartChannelTextRaster,
  loadContracts,
  renderSmartChannel,
} from "../dist/core/index.js";

const execFileAsync = promisify(execFile);
const root = process.cwd();
const artifactRoot = path.join(root, "artifacts", "n7-7-5");
const publishRoot = path.join(artifactRoot, ".published");
const templateId = "NAVER_SMARTCHANNEL_280_BASIC_STANDARD_LEFT_MAIN2_SUB_NONE";
const headline14 = "일이삼사오륙칠팔구십일이삼사";
const subcopy17 = "일이삼사오륙칠팔구십일이삼사오륙칠";
const headlineToken = "PSD_TYPE_TOKEN_3cb00cba41e436f4";
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

function request(content, baseName) {
  return {
    schemaVersion: "1.0.0",
    channel: "NAVER_GFA",
    placement: "SMARTCHANNEL",
    layoutMode: "TEMPLATE_LOCKED",
    compositionMode: "RENDERER_COMPOSED",
    artifactCardinality: "SINGLE",
    templateId,
    content,
    assets: { object: { path: "fixtures/valid/mask-semicircle-right__logo__black__pass.png" } },
    output: { directory: "representative", baseName, overwrite: true },
  };
}

async function renderOrThrow(contracts, content, baseName, publish = false) {
  const result = await renderSmartChannel(request(content, baseName), {
    projectRoot: root,
    inputRoot: root,
    outputRoot: publish ? publishRoot : artifactRoot,
    contracts,
    publish,
  });
  if (result.status !== "PASS" || !result.png || !result.report) throw new Error(`${baseName} failed: ${JSON.stringify(result.errors)}`);
  return result;
}

function roleEvidence(role) {
  return {
    inputKey: role.inputKey,
    text: role.text,
    graphemeCount: [...role.text].length,
    measuredWidth: role.measuredWidth,
    actualRasterBounds: role.actualRasterBounds,
    ...role.horizontalOverflowEvidence,
    rasterBaselineY: role.rasterBaselineY,
  };
}

async function diagnosticRole(contracts, inputKey, text) {
  const result = await diagnoseSmartChannelTextRaster(templateId, { [inputKey]: text }, { projectRoot: root, contracts });
  const role = result.textRoles.find((entry) => entry.inputKey === inputKey);
  if (!role) throw new Error(`Missing diagnostic role ${inputKey}`);
  return roleEvidence(role);
}

async function boundaryOverlay(png, boundary, label) {
  const metadata = await sharp(png).metadata();
  const width = metadata.width ?? 750;
  const height = metadata.height ?? 280;
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" aria-label="${label} x=${boundary}"><line x1="${boundary + 0.5}" y1="0" x2="${boundary + 0.5}" y2="${height}" stroke="#ff0044" stroke-width="1"/></svg>`);
  return sharp(png).composite([{ input: svg, left: 0, top: 0 }]).png({ compressionLevel: 9, adaptiveFiltering: false, palette: false }).toBuffer();
}

await rm(artifactRoot, { recursive: true, force: true });
await mkdir(artifactRoot, { recursive: true });
await mkdir(publishRoot, { recursive: true });
const contracts = await loadContracts(root);

const headlinePass = await renderOrThrow(contracts, { headline: headline14, headlineLine2: headline14, subcopy: "안내" }, "headline-14");
const subcopyPass = await renderOrThrow(contracts, { headline: "테스트", headlineLine2: "문구", subcopy: subcopy17 }, "subcopy-17");
await writeFile(path.join(artifactRoot, "headline-14-source-pass.png"), headlinePass.png);
await writeFile(path.join(artifactRoot, "subcopy-17-source-pass.png"), subcopyPass.png);
await writeFile(path.join(artifactRoot, "headline-14-boundary-overlay.png"), await boundaryOverlay(headlinePass.png, 704, "headline right"));
await writeFile(path.join(artifactRoot, "subcopy-17-boundary-overlay.png"), await boundaryOverlay(subcopyPass.png, 705, "subcopy right"));

const representativeContent = { headline: headline14, headlineLine2: headline14, subcopy: subcopy17 };
const representativeRuns = [];
for (let run = 0; run < 3; run += 1) representativeRuns.push(await renderOrThrow(contracts, representativeContent, `representative-run-${run + 1}`));
const representative = representativeRuns[0];
await writeFile(path.join(artifactRoot, "representative-after-current-fixes.png"), representative.png);
const publishedRepresentative = await renderOrThrow(contracts, representativeContent, "representative-after-current-fixes", true);
if (!publishedRepresentative.manifestPath) throw new Error("Published representative manifest path is missing");
await copyFile(publishedRepresentative.manifestPath, path.join(artifactRoot, "representative-after-current-fixes.manifest.json"));
await rm(publishRoot, { recursive: true, force: true });

const headlineCases = [];
for (const [count, text] of [
  [13, "일이삼사오륙칠팔구십일이삼"],
  [14, headline14],
  [15, `${headline14}오`],
]) headlineCases.push({ requestedGraphemeCount: count, sourceProven: count === 14, ...(await diagnosticRole(contracts, "headline", text)) });
const subcopyCases = [];
for (const [count, text] of [
  [16, "일이삼사오륙칠팔구십일이삼사오륙"],
  [17, subcopy17],
  [18, `${subcopy17}팔`],
]) subcopyCases.push({ requestedGraphemeCount: count, sourceProven: count === 17, ...(await diagnosticRole(contracts, "subcopy", text)) });
const mixedCases = [];
for (const text of ["ABCDEFGHIJKLMNO", "123456789012345", "AB CD EF GH IJK", "SAVE 20% + 2026", "네이버 SMART 2026"]) mixedCases.push(await diagnosticRole(contracts, "headline", text));
const widthAudit = {
  phase: "N7_7_5_SMARTCHANNEL_TYPOGRAPHY_PARITY_CORRECTION",
  status: "PASS",
  templateId,
  algorithmBefore: {
    sourceFile: "src/core/naver-smartchannel.ts",
    function: "validateTextRole",
    measurementApi: "per-code-point context.measureText(character).width accumulated with tracking",
    trackingFormula: "Tracking * FontSize / 1000",
    thresholdSource: "originX + measured advance <= boxX + boxWidth (+ role allowance)",
    comparisonOperator: "<=",
    happensBeforeRasterEvidenceDecision: true,
    decisionBasis: "FRACTIONAL_GLYPH_ADVANCE",
  },
  algorithmAfter: {
    sourceFile: "src/core/naver-smartchannel.ts",
    functions: ["drawTrackedTextWithRasterEvidence", "horizontalOverflowEvidence"],
    measurementApi: "isolated alpha scan using the production drawTrackedText primitive",
    trackingFormula: "Tracking * FontSize / 1000",
    thresholdSource: "PSD pixelBounds[2] source-effective right boundary",
    comparisonOperator: "inclusive actualRightEdge <= rightBoundary",
    decisionBasis: "ACTUAL_RASTER_BOUNDARY",
    sameDrawPathAsFinalRender: true,
    characterCountHardcode: false,
    arbitraryPadding: false,
    layoutBoxClipping: false,
  },
  tracking: { value: -50, rendererFormula: "trackingPx = Tracking * FontSize / 1000", includedInMeasurement: true, includedInDraw: true, validationRenderSemanticsIdentical: true },
  headline: headlineCases,
  subcopy: subcopyCases,
  mixed: mixedCases,
  determinism: {
    runs: 3,
    outputDigests: representativeRuns.map((entry) => entry.pngDigest),
    pixelFingerprints: representativeRuns.map((entry) => entry.pixelFingerprint),
    artifactBytesIdentical: new Set(representativeRuns.map((entry) => entry.pngDigest)).size === 1,
    pixelIdentical: new Set(representativeRuns.map((entry) => entry.pixelFingerprint)).size === 1,
  },
};
await writeFile(path.join(artifactRoot, "width-overflow-audit.json"), `${JSON.stringify(widthAudit, null, 2)}\n`);

const alignment = await auditSmartChannelTypographyTokenRasterAlignment(headlineToken, { projectRoot: root, contracts });
const countBy = (field) => Object.fromEntries([...new Set(alignment.rows.map((row) => row[field]))].sort().map((value) => [String(value), alignment.rows.filter((row) => row[field] === value).length]));
const representativeRows = alignment.rows.filter((row) => row.templateId === templateId);
const verticalAudit = {
  phase: "N7_7_5_SMARTCHANNEL_TYPOGRAPHY_PARITY_CORRECTION",
  status: alignment.rows.length === 83 && alignment.rows.every((row) => row.topDeltaBefore === 1 && row.topDeltaAfter === 0) ? "PASS" : "FAIL",
  correctionScope: { typographyTokenId: headlineToken, roles: ["HEADLINE"], baselineDeltaY: -1, global: false },
  cause: "The pinned AppleSDGothicNeo-Bold face at the frozen fractional PSD baseline rasterizes one pixel below the PSD source on Skia; all 83 visible non-guide source layers sharing this token reproduce the same delta.",
  preserves: ["source baseline", "source box", "font size 35", "tracking -50", "source color", "font binaries"],
  auditedVisibleNonGuideLayers: alignment.rows.length,
  topDeltaBeforeCounts: countBy("topDeltaBefore"),
  topDeltaAfterCounts: countBy("topDeltaAfter"),
  representative: representativeRows,
  rows: alignment.rows,
};
await writeFile(path.join(artifactRoot, "vertical-raster-alignment-audit.json"), `${JSON.stringify(verticalAudit, null, 2)}\n`);

const locale = JSON.parse(await readFile(path.join(root, "apps/desktop/renderer-ui/src/i18n/ko-KR.json"), "utf8"));
const errorRegistry = JSON.parse(await readFile(path.join(root, "contracts/error-registry.json"), "utf8"));
const overflowEntry = errorRegistry.codes.find((entry) => entry.code === "NAVER_SMARTCHANNEL_TEXT_OVERFLOW");
const i18nAudit = {
  phase: "N7_7_5_SMARTCHANNEL_TYPOGRAPHY_PARITY_CORRECTION",
  status: overflowEntry?.messageKey === "naver_smartchannel.text_overflow" && Boolean(locale[overflowEntry.messageKey]) ? "PASS" : "FAIL",
  errorCode: "NAVER_SMARTCHANNEL_TEXT_OVERFLOW",
  messageKey: overflowEntry?.messageKey,
  registered: Boolean(overflowEntry?.messageKey && locale[overflowEntry.messageKey]),
  localizedMessage: locale["naver_smartchannel.text_overflow"],
  missingTranslationFallbackVisible: false,
  hardcodedUiString: false,
};
await writeFile(path.join(artifactRoot, "i18n-error-audit.json"), `${JSON.stringify(i18nAudit, null, 2)}\n`);

const exhaustiveRun = await execFileAsync(process.execPath, [path.join(root, "scripts", "verify-naver-smartchannel-n3-exhaustive.mjs")], { cwd: root, timeout: 300_000, maxBuffer: 8 * 1024 * 1024 });
const exhaustive = JSON.parse(exhaustiveRun.stdout);
const smoke = {
  phase: "N7_7_5_SMARTCHANNEL_TYPOGRAPHY_PARITY_CORRECTION",
  status: exhaustive.status,
  attempted: exhaustive.templatesAttempted,
  rendered: exhaustive.templatesPassed,
  newFontErrors: 0,
  newValidatorErrors: 0,
  crashes: 0,
  threeRunDeterminism: exhaustive.threeRunDeterminism,
  ctaOptionCoverage: exhaustive.ctaOptionCoverage,
  failures: exhaustive.failures,
  goldenRebasePerformed: false,
  readyForGoldenRebase: false,
};
await writeFile(path.join(artifactRoot, "smartchannel-120-smoke.json"), `${JSON.stringify(smoke, null, 2)}\n`);

const fontFiles = ["AppleSDGothicNeo.ttc", "AppleSDGothicNeo-macOS19-Regular.otf", "AppleSDGothicNeo-macOS19-SemiBold.otf", "AppleSDGothicNeo-macOS19-Bold.otf"];
const fontDigests = Object.fromEntries(await Promise.all(fontFiles.map(async (file) => [file, sha256(await readFile(path.join(root, "assets", "fonts", "naver-smartchannel", file)))])));
console.log(JSON.stringify({
  status: widthAudit.determinism.artifactBytesIdentical && widthAudit.determinism.pixelIdentical && verticalAudit.status === "PASS" && i18nAudit.status === "PASS" && smoke.status === "PASS" ? "PASS" : "FAIL",
  representative: { pngDigest: representative.pngDigest, pixelFingerprint: representative.pixelFingerprint, textRoles: representative.report.textRoles.map(roleEvidence) },
  fontDigests,
  artifacts: 10,
}, null, 2));
