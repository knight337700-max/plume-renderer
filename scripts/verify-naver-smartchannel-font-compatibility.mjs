import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { parseFontFile, sourceCodePoints } from "./smartchannel-font-utils.mjs";

const root = process.cwd();
const readJson = (relativePath) => JSON.parse(readFileSync(path.join(root, relativePath), "utf8"));
const compatibility = readJson("contracts/naver-smartchannel-font-compatibility.json");
const metrics = readJson("contracts/naver-smartchannel-font-metric-fixtures.json");
const policy = readJson("contracts/naver-smartchannel-runtime-font-policy.json");
const metadata = readJson("contracts/naver-smartchannel-psd-metadata.json");
const expectedDigests = {
  NAVER_SC_APPLE_SD_GOTHIC_NEO_BOLD: "a652ea0a3c4bf8658845f044b5d6f40c39ecf03207e43f325c1451127528402b",
  NAVER_SC_APPLE_SD_GOTHIC_NEO_MEDIUM: "0ab8f4045a0c5ac30eee01da33f75998c0a8f6f3d65b0952be8dc9ece63bde29",
  NAVER_SC_APPLE_SD_GOTHIC_NEO_REGULAR: "f44eec027992b99dc25de0229c5726fe209a6cb80761aaef98d050cdc0bc6cfe",
  NAVER_SC_APPLE_SD_GOTHIC_NEO_SEMIBOLD: "a9c5ffb4dadce253d8748b18019954a8af19b7cfcc3b586fce64ef1f6bd71492",
};
const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

expect(compatibility.status === "PROJECT_COMPATIBILITY_VERIFIED", "compatibility registry is not verified");
expect(compatibility.runtimeFontMode === "PROJECT_COMPATIBLE_VERIFIED", "runtime mode mismatch");
expect(compatibility.runtimeLookupKey === "fontToken", "runtime lookup must use fontToken");
expect(compatibility.sourceFontBinaryExact === false && compatibility.sourceLayoutMetadataPreserved === true && compatibility.photoshopBytePixelParityClaim === false, "source/parity contract mismatch");
expect(compatibility.fonts?.length === 4, "expected four controlled runtime aliases");
expect(JSON.stringify(compatibility.approvedDigestAllowlist) === JSON.stringify(expectedDigests), "approved local SHA-256 allowlist mismatch");
expect(compatibility.glyphCoverage?.sourceTextCodePointCount === sourceCodePoints(metadata).length, "source glyph code point count mismatch");
expect(compatibility.glyphCoverage?.allFontsCovered === true && compatibility.glyphCoverage?.perFont?.every((entry) => entry.coverageStatus === "PASS" && entry.missingCodePoints.length === 0), "glyph coverage failed");
expect(compatibility.styleRoleSeparation?.fileDigestDistinct === true && compatibility.styleRoleSeparation?.glyphOutlineDigestDistinct === true && compatibility.styleRoleSeparation?.horizontalMetricDigestDistinct === true, "style role separation failed");
expect(metrics.status === "PROJECT_COMPATIBILITY_VERIFIED" && metrics.summary?.pass === metrics.summary?.total && metrics.summary?.overflow === 0, "metric fixtures failed");
expect(policy.n2?.ready === true && policy.n2?.blockers?.length === 0, "N2 is not ready");

const localDirectoryInput = process.env.NAVER_SMARTCHANNEL_FONT_DIR;
const localDirectory = localDirectoryInput && path.isAbsolute(localDirectoryInput) && !localDirectoryInput.startsWith("\\\\") && !localDirectoryInput.startsWith("//")
  ? localDirectoryInput
  : path.join(root, ".local-fonts", "naver-smartchannel");
for (const entry of compatibility.fonts ?? []) {
  const filePath = path.join(localDirectory, entry.runtime.localFileName);
  expect(existsSync(filePath), `missing local font ${entry.runtime.localFileName}`);
  if (!existsSync(filePath)) continue;
  let font;
  try { font = parseFontFile(filePath); } catch (error) { failures.push(`font parse failed ${entry.runtime.localFileName}: ${error instanceof Error ? error.message : String(error)}`); continue; }
  expect(font.sha256 === entry.runtime.localSha256, `digest mismatch ${entry.runtime.localFileName}`);
  expect(font.sha256 === expectedDigests[entry.fontToken], `approved digest mismatch ${entry.runtime.localFileName}`);
  expect(font.names.postScript.includes(entry.runtime.localPostScriptName), `runtime PostScript mismatch ${entry.runtime.localFileName}`);
  expect(entry.source.sourceIdentityStatus === "SOURCE_DIFFERENT_BUILD", `source identity must remain explicit ${entry.runtime.localFileName}`);
  expect(entry.runtime.compatibilityStatus === "PROJECT_COMPATIBLE_VERIFIED", `compatibility status mismatch ${entry.runtime.localFileName}`);
}
expect(policy.localExternalFontResource?.files?.every((entry) => entry.approvedForSmartChannel === true && entry.bundleAllowed === false && entry.redistributionClaim === "NOT_MADE"), "local-only approval policy mismatch");

const result = {
  status: failures.length === 0 ? "PASS" : "FAIL",
  runtimeFontMode: compatibility.runtimeFontMode,
  controlledAliases: compatibility.fonts?.length ?? 0,
  sourceCodePoints: compatibility.glyphCoverage?.sourceTextCodePointCount ?? 0,
  metricFixtures: metrics.summary,
  failures,
};
console.log(JSON.stringify(result, null, 2));
if (failures.length > 0) process.exitCode = 1;
