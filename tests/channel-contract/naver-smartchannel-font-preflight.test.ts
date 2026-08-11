import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  assertSmartChannelFallbackProhibited,
  inspectFontIdentity,
  isTrustedFontReference,
  preflightExternalExactFont,
} from "../../src/core/index.js";

const root = process.cwd();
const boldReference = "assets/fonts/SpoqaHanSansBold.ttf";
const boldPath = path.join(root, boldReference);
const boldDigest = "5a6b9b258145e243dfd5f70cc869119c6af708843658e380304bdfe3d4f4eaef";

describe("NAVER SmartChannel fail-closed font preflight helper", () => {
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
