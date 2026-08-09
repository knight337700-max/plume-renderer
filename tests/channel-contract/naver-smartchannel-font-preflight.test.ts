import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  assertSmartChannelFallbackProhibited,
  getSmartChannelFontDirectory,
  inspectFontIdentity,
  isTrustedFontReference,
  preflightExternalExactFont,
} from "../../src/core/index.js";

const root = process.cwd();
const boldReference = "assets/fonts/SpoqaHanSansBold.ttf";
const boldPath = path.join(root, boldReference);
const boldDigest = "5a6b9b258145e243dfd5f70cc869119c6af708843658e380304bdfe3d4f4eaef";
const localAppleBoldReference = ".local-fonts/naver-smartchannel/AppleSDGothicNeo-Bold.ttf";
const localAppleBoldDigest = "a652ea0a3c4bf8658845f044b5d6f40c39ecf03207e43f325c1451127528402b";

describe("NAVER SmartChannel exact font preflight", () => {
  it("accepts an exact trusted external resource when identity, digest, and version match", async () => {
    const bytes = await readFile(boldPath);
    const identity = inspectFontIdentity(bytes);
    expect(identity?.postScriptNames).toContain("SpoqaHanSans-Bold");
    expect(identity?.versions).toContain("Version 2.000");
    const result = await preflightExternalExactFont(
      {
        requiredPostScriptName: "SpoqaHanSans-Bold",
        allowedResolutionModes: ["EXTERNAL_EXACT"],
        expectedSha256: boldDigest,
        expectedVersion: "Version 2.000",
      },
      {
        path: boldReference,
        expectedPostScriptName: "SpoqaHanSans-Bold",
        expectedSha256: boldDigest,
        expectedVersion: "Version 2.000",
      },
      { trustedRoot: root },
    );
    expect(result).toMatchObject({ status: "PASS", renderStartAllowed: true, resolutionMode: "EXTERNAL_EXACT", digest: boldDigest });
  });

  it("accepts a controlled source-different runtime alias by token and runtime identity", async () => {
    const result = await preflightExternalExactFont(
      {
        requiredPostScriptName: "AppleSDGothicNeo-Bold",
        sourcePostScriptName: "AppleSDGothicNeo-Bold",
        runtimePostScriptName: "AppleSDGothicNeoB00",
        fontToken: "NAVER_SC_APPLE_SD_GOTHIC_NEO_BOLD",
        sourceIdentityStatus: "SOURCE_DIFFERENT_BUILD",
        compatibilityStatus: "PROJECT_COMPATIBLE_VERIFIED",
        allowedResolutionModes: ["EXTERNAL_EXACT"],
        expectedSha256: localAppleBoldDigest,
        expectedVersion: "Version 1.0",
      },
      {
        path: localAppleBoldReference,
        expectedPostScriptName: "AppleSDGothicNeoB00",
        expectedSha256: localAppleBoldDigest,
        expectedVersion: "Version 1.0",
      },
      { trustedRoot: root },
    );
    expect(result).toMatchObject({ status: "PASS", renderStartAllowed: true, fontToken: "NAVER_SC_APPLE_SD_GOTHIC_NEO_BOLD", sourceIdentityStatus: "SOURCE_DIFFERENT_BUILD", compatibilityStatus: "PROJECT_COMPATIBLE_VERIFIED" });
  });

  it("rejects a wrong controlled alias even when the source identity is preserved", async () => {
    const result = await preflightExternalExactFont(
      {
        requiredPostScriptName: "AppleSDGothicNeo-Bold",
        runtimePostScriptName: "AppleSDGothicNeo-B00-WRONG",
        fontToken: "NAVER_SC_APPLE_SD_GOTHIC_NEO_BOLD",
        allowedResolutionModes: ["EXTERNAL_EXACT"],
        expectedSha256: localAppleBoldDigest,
        expectedVersion: "Version 1.0",
      },
      {
        path: localAppleBoldReference,
        expectedPostScriptName: "AppleSDGothicNeo-B00-WRONG",
        expectedSha256: localAppleBoldDigest,
        expectedVersion: "Version 1.0",
      },
      { trustedRoot: root },
    );
    expect(result.status).toBe("BLOCKED");
    expect(result.issues.map((entry) => entry.code)).toContain("NAVER_SMARTCHANNEL_FONT_IDENTITY_MISMATCH");
  });

  it.each([
    ["wrong PostScript name", { requiredPostScriptName: "AppleSDGothicNeo-Bold" }, "NAVER_SMARTCHANNEL_FONT_IDENTITY_MISMATCH"],
    ["wrong digest", { requiredPostScriptName: "SpoqaHanSans-Bold", expectedSha256: "0".repeat(64) }, "NAVER_SMARTCHANNEL_FONT_IDENTITY_MISMATCH"],
    ["wrong version", { requiredPostScriptName: "SpoqaHanSans-Bold", expectedVersion: "Version 99.000" }, "NAVER_SMARTCHANNEL_FONT_VERSION_MISMATCH"],
  ] as const)("blocks %s", async (_label, overrides, code) => {
    const requirement = {
      requiredPostScriptName: "SpoqaHanSans-Bold",
      allowedResolutionModes: ["EXTERNAL_EXACT"] as const,
      expectedSha256: boldDigest,
      expectedVersion: "Version 2.000",
    };
    Object.assign(requirement, overrides);
    const result = await preflightExternalExactFont(
      requirement,
      { path: boldReference, expectedPostScriptName: "SpoqaHanSans-Bold", expectedSha256: boldDigest, expectedVersion: "Version 2.000" },
      { trustedRoot: root },
    );
    expect(result.status).toBe("BLOCKED");
    expect(result.renderStartAllowed).toBe(false);
    expect(result.issues.map((entry) => entry.code)).toContain(code);
  });

  it("blocks missing and unsafe external resources", async () => {
    const missing = await preflightExternalExactFont(
      { requiredPostScriptName: "SpoqaHanSans-Bold", allowedResolutionModes: ["EXTERNAL_EXACT"] },
      { path: "assets/fonts/missing.ttf", expectedPostScriptName: "SpoqaHanSans-Bold", expectedSha256: boldDigest },
      { trustedRoot: root },
    );
    expect(missing).toMatchObject({ status: "BLOCKED", renderStartAllowed: false });
    expect(missing.issues[0]?.code).toBe("NAVER_SMARTCHANNEL_FONT_UNAVAILABLE");

    for (const reference of ["../outside.ttf", "folder/..", "C:/outside.ttf", "https://example.test/font.ttf", "\\\\server\\share\\font.ttf"]) {
      expect(isTrustedFontReference(reference)).toBe(false);
      const result = await preflightExternalExactFont(
        { requiredPostScriptName: "SpoqaHanSans-Bold", allowedResolutionModes: ["EXTERNAL_EXACT"] },
        { path: reference, expectedPostScriptName: "SpoqaHanSans-Bold", expectedSha256: boldDigest },
        { trustedRoot: root },
      );
      expect(result).toMatchObject({ status: "BLOCKED", renderStartAllowed: false });
      expect(result.issues[0]?.code).toBe("NAVER_SMARTCHANNEL_FONT_UNAVAILABLE");
    }
  });

  it("does not permit SmartChannel fallback", () => {
    expect(() => assertSmartChannelFallbackProhibited(false)).not.toThrow();
    expect(() => assertSmartChannelFallbackProhibited(true)).toThrow();
  });

  it("accepts only an absolute non-UNC NAVER_SMARTCHANNEL_FONT_DIR", () => {
    expect(getSmartChannelFontDirectory({ NAVER_SMARTCHANNEL_FONT_DIR: root })).toBe(root);
    expect(getSmartChannelFontDirectory({ NAVER_SMARTCHANNEL_FONT_DIR: "relative/fonts" })).toBeNull();
    expect(getSmartChannelFontDirectory({ NAVER_SMARTCHANNEL_FONT_DIR: "\\\\server\\share\\fonts" })).toBeNull();
  });
});
