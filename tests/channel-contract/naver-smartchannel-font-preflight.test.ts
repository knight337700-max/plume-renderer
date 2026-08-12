import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  assertSmartChannelFallbackProhibited,
  compareFontCollectionFaceToStandalone,
  inspectFontCollection,
  inspectFontCollectionFaceGlyphCoverage,
  inspectFontIdentity,
  isTrustedFontReference,
  preflightExternalExactFont,
} from "../../src/core/index.js";

const root = process.cwd();
const boldReference = "assets/fonts/SpoqaHanSansBold.ttf";
const boldPath = path.join(root, boldReference);
const boldDigest = "5a6b9b258145e243dfd5f70cc869119c6af708843658e380304bdfe3d4f4eaef";

describe("NAVER SmartChannel fail-closed font preflight helper", () => {
  it("inventories the pinned macOS TTC and verifies derived face table equivalence", async () => {
    const collection = await readFile(path.join(root, "assets/fonts/naver-smartchannel/AppleSDGothicNeo.ttc"));
    const inventory = inspectFontCollection(collection);
    expect(inventory?.faceCount).toBe(18);
    for (const expected of [
      { index: 0, postScriptName: "AppleSDGothicNeo-Regular", fileName: "AppleSDGothicNeo-macOS19-Regular.otf" },
      { index: 4, postScriptName: "AppleSDGothicNeo-SemiBold", fileName: "AppleSDGothicNeo-macOS19-SemiBold.otf" },
      { index: 6, postScriptName: "AppleSDGothicNeo-Bold", fileName: "AppleSDGothicNeo-macOS19-Bold.otf" },
    ]) {
      expect(inventory?.faces[expected.index]).toMatchObject({ index: expected.index, postScriptNames: [expected.postScriptName], versions: ["19.0d2e1"], unitsPerEm: 1000, glyphCount: 18662, outlineFormat: "CFF" });
      expect(inspectFontCollectionFaceGlyphCoverage(collection, expected.index, "가나다라마바사아자차카타파하 APP").covered).toBe(true);
      const derived = await readFile(path.join(root, "assets/fonts/naver-smartchannel", expected.fileName));
      expect(compareFontCollectionFaceToStandalone(collection, expected.index, derived)?.every((table) => table.status === "IDENTICAL" || table.status === "SEMANTICALLY_IDENTICAL_CHECKSUM_ADJUSTMENT_ONLY")).toBe(true);
    }
  });

  it("accepts a trusted exact resource when identity, digest, and version match", async () => {
    const bytes = await readFile(boldPath);
    const identity = inspectFontIdentity(bytes);
    expect(identity?.postScriptNames).toContain("SpoqaHanSans-Bold");
    const result = await preflightExternalExactFont(
      { requiredPostScriptName: "SpoqaHanSans-Bold", allowedResolutionModes: ["EXTERNAL_EXACT"], expectedSha256: boldDigest, expectedVersion: "Version 2.000" },
      { path: boldReference, expectedPostScriptName: "SpoqaHanSans-Bold", expectedSha256: boldDigest, expectedVersion: "Version 2.000" },
      { trustedRoot: root },
    );
    expect(result).toMatchObject({ status: "PASS", renderStartAllowed: true, resolutionMode: "EXTERNAL_EXACT", digest: boldDigest });
  });

  it.each([
    ["wrong PostScript name", { requiredPostScriptName: "Not-A-Real-Font" }, "NAVER_SMARTCHANNEL_FONT_IDENTITY_MISMATCH"],
    ["wrong digest", { expectedSha256: "0".repeat(64) }, "NAVER_SMARTCHANNEL_FONT_IDENTITY_MISMATCH"],
    ["wrong version", { expectedVersion: "Version 99.000" }, "NAVER_SMARTCHANNEL_FONT_VERSION_MISMATCH"],
  ] as const)("blocks %s", async (_label, overrides, code) => {
    const requirement = { requiredPostScriptName: "SpoqaHanSans-Bold", allowedResolutionModes: ["EXTERNAL_EXACT"] as const, expectedSha256: boldDigest, expectedVersion: "Version 2.000" };
    Object.assign(requirement, overrides);
    const result = await preflightExternalExactFont(requirement, { path: boldReference, expectedPostScriptName: "SpoqaHanSans-Bold", expectedSha256: boldDigest, expectedVersion: "Version 2.000" }, { trustedRoot: root });
    expect(result.status).toBe("BLOCKED");
    expect(result.renderStartAllowed).toBe(false);
    expect(result.issues.map((entry) => entry.code)).toContain(code);
  });

  it("blocks missing and unsafe external resources and prohibits fallback", async () => {
    const missing = await preflightExternalExactFont({ requiredPostScriptName: "NanumBarunGothicBold", allowedResolutionModes: ["EXTERNAL_EXACT"] }, { path: "assets/fonts/missing.ttf", expectedPostScriptName: "NanumBarunGothicBold", expectedSha256: boldDigest }, { trustedRoot: root });
    expect(missing).toMatchObject({ status: "BLOCKED", renderStartAllowed: false });
    expect(missing.issues[0]?.code).toBe("NAVER_SMARTCHANNEL_FONT_UNAVAILABLE");
    for (const reference of ["../outside.ttf", "folder/..", "C:/outside.ttf", "https://example.test/font.ttf", "\\\\server\\share\\font.ttf"]) {
      expect(isTrustedFontReference(reference)).toBe(false);
    }
    expect(() => assertSmartChannelFallbackProhibited(false)).not.toThrow();
    expect(() => assertSmartChannelFallbackProhibited(true)).toThrow();
  });

});
