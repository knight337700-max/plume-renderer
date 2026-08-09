import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = resolve(process.cwd());
const readJson = <T>(file: string) => JSON.parse(readFileSync(resolve(root, file), "utf8")) as T;

type FontEntry = {
  fontToken: string;
  source: { expectedPostScriptName: string; sourceIdentityStatus: string; cssWeight: number };
  runtime: { localPostScriptName: string; localSha256: string; compatibilityStatus: string; lookupKey: string; bundleAllowed: boolean; commitAllowed: boolean; networkFetchAllowed: boolean };
};
type Compatibility = {
  status: string;
  sourceFontBinaryExact: boolean;
  sourceLayoutMetadataPreserved: boolean;
  runtimeFontMode: string;
  runtimeLookupKey: string;
  photoshopBytePixelParityClaim: boolean;
  fonts: FontEntry[];
  approvedDigestAllowlist: Record<string, string>;
  glyphCoverage: { sourceTextCodePointCount: number; allFontsCovered: boolean; perFont: Array<{ coverageStatus: string; missingCodePoints: string[] }> };
  styleRoleSeparation: { fileDigestDistinct: boolean; glyphOutlineDigestDistinct: boolean; horizontalMetricDigestDistinct: boolean };
};
type MetricFixtures = { status: string; fixtures: Array<{ expectedRoles: string[]; status: string }>; summary: { total: number; pass: number; overflow: number } };
type Policy = { localExternalFontResource: { files: Array<{ fontToken: string; sha256: string; approvedForSmartChannel: boolean; bundleAllowed: boolean; sourceIdentityStatus: string; compatibilityStatus: string }> } };

const compatibility = readJson<Compatibility>("contracts/naver-smartchannel-font-compatibility.json");
const metrics = readJson<MetricFixtures>("contracts/naver-smartchannel-font-metric-fixtures.json");
const policy = readJson<Policy>("contracts/naver-smartchannel-runtime-font-policy.json");

describe("NAVER SmartChannel project-compatible Apple SD Gothic Neo builds", () => {
  const expectedDigests = {
    NAVER_SC_APPLE_SD_GOTHIC_NEO_BOLD: "a652ea0a3c4bf8658845f044b5d6f40c39ecf03207e43f325c1451127528402b",
    NAVER_SC_APPLE_SD_GOTHIC_NEO_MEDIUM: "0ab8f4045a0c5ac30eee01da33f75998c0a8f6f3d65b0952be8dc9ece63bde29",
    NAVER_SC_APPLE_SD_GOTHIC_NEO_REGULAR: "f44eec027992b99dc25de0229c5726fe209a6cb80761aaef98d050cdc0bc6cfe",
    NAVER_SC_APPLE_SD_GOTHIC_NEO_SEMIBOLD: "a9c5ffb4dadce253d8748b18019954a8af19b7cfcc3b586fce64ef1f6bd71492",
  };
  it("keeps source identity separate from controlled runtime aliases", () => {
    expect(compatibility.status).toBe("PROJECT_COMPATIBILITY_VERIFIED");
    expect(compatibility.sourceFontBinaryExact).toBe(false);
    expect(compatibility.sourceLayoutMetadataPreserved).toBe(true);
    expect(compatibility.runtimeFontMode).toBe("PROJECT_COMPATIBLE_VERIFIED");
    expect(compatibility.runtimeLookupKey).toBe("fontToken");
    expect(compatibility.photoshopBytePixelParityClaim).toBe(false);
    expect(compatibility.fonts).toHaveLength(4);
    expect(compatibility.approvedDigestAllowlist).toEqual(expectedDigests);
    expect(compatibility.fonts.every((font) => font.source.sourceIdentityStatus === "SOURCE_DIFFERENT_BUILD" && font.runtime.compatibilityStatus === "PROJECT_COMPATIBLE_VERIFIED" && font.runtime.lookupKey === font.fontToken)).toBe(true);
    expect(new Set(compatibility.fonts.map((font) => font.runtime.localSha256)).size).toBe(4);
    expect(compatibility.fonts.every((font) => font.runtime.bundleAllowed === false && font.runtime.commitAllowed === false && font.runtime.networkFetchAllowed === false)).toBe(true);
  });

  it("covers every source text code point in every approved runtime file", () => {
    expect(compatibility.glyphCoverage.sourceTextCodePointCount).toBeGreaterThan(0);
    expect(compatibility.glyphCoverage.allFontsCovered).toBe(true);
    expect(compatibility.glyphCoverage.perFont).toHaveLength(4);
    expect(compatibility.glyphCoverage.perFont.every((font) => font.coverageStatus === "PASS" && font.missingCodePoints.length === 0)).toBe(true);
  });

  it("keeps distinct glyph outlines and horizontal metrics for each style role", () => {
    expect(compatibility.styleRoleSeparation.fileDigestDistinct).toBe(true);
    expect(compatibility.styleRoleSeparation.glyphOutlineDigestDistinct).toBe(true);
    expect(compatibility.styleRoleSeparation.horizontalMetricDigestDistinct).toBe(true);
  });

  it("passes frozen representative metric fixtures without overflow", () => {
    expect(metrics.status).toBe("PROJECT_COMPATIBILITY_VERIFIED");
    expect(metrics.fixtures.length).toBeGreaterThanOrEqual(3);
    expect(metrics.summary).toMatchObject({ total: metrics.fixtures.length, pass: metrics.fixtures.length, overflow: 0 });
    expect(metrics.fixtures.map((fixture) => fixture.expectedRoles)).toEqual(expect.arrayContaining([
      ["HEADLINE", "SUBCOPY", "DISCLOSURE"],
      ["HEADLINE", "SUBCOPY"],
      ["HEADLINE", "SUBCOPY", "CTA_LABEL"],
    ]));
  });

  it("allowlists the four local digests and rejects arbitrary fallback by policy", () => {
    expect(policy.localExternalFontResource.files).toHaveLength(4);
    expect(policy.localExternalFontResource.files.every((font) => font.approvedForSmartChannel && !font.bundleAllowed && font.sourceIdentityStatus === "SOURCE_DIFFERENT_BUILD" && font.compatibilityStatus === "PROJECT_COMPATIBLE_VERIFIED" && /^[a-f0-9]{64}$/.test(font.sha256))).toBe(true);
  });
});
