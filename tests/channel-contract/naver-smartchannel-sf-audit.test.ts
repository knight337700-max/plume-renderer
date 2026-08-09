import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = resolve(process.cwd());
type AuditFont = { postScriptName: string; classification: string; parentGroups: string[]; visibleLayerCount: number; guideLayerCount: number; effectiveVisibility: { compositeContributionCount: number }; outputInclusion: { nonExport: boolean } };
type LocalFont = { approvedForSmartChannel: boolean; bundleAllowed: boolean };
type AuditRecord = { runtimeDecision: string; sourceOnlyNonRuntime: string[]; exportContributingFonts: string[]; fonts: AuditFont[] };
type PolicyRecord = { localExternalFontResource: { directoryEnv: string; localOnly: boolean; redistributionClaim: string; files: LocalFont[] } };
const readJson = <T>(file: string) => JSON.parse(readFileSync(resolve(root, file), "utf8")) as T;
const audit = readJson<AuditRecord>("contracts/naver-smartchannel-sf-font-audit.json");
const policy = readJson<PolicyRecord>("contracts/naver-smartchannel-runtime-font-policy.json");

describe("NAVER SmartChannel SF guide-layer audit", () => {
  it("removes hidden SF variants from runtime requirements after effective composite audit", () => {
    expect(audit.runtimeDecision).toBe("SF_SOURCE_ONLY_NON_RUNTIME");
    expect(audit.sourceOnlyNonRuntime).toEqual(["SFProDisplay-Bold", "SFUIDisplay-Bold"]);
    expect(audit.exportContributingFonts).toEqual([]);
    expect(audit.fonts).toHaveLength(2);
    expect(audit.fonts.map((font) => [font.postScriptName, font.classification])).toEqual([
      ["SFProDisplay-Bold", "HIDDEN_SOURCE_TEXT"],
      ["SFUIDisplay-Bold", "HIDDEN_SOURCE_TEXT"],
    ]);
    expect(audit.fonts.every((font) => font.parentGroups.some((group) => group.trim().startsWith("TEXT")) && font.visibleLayerCount === 0 && font.guideLayerCount === 0)).toBe(true);
    expect(audit.fonts.every((font) => font.effectiveVisibility.compositeContributionCount === 0 && font.outputInclusion.nonExport)).toBe(true);
  });

  it("does not approve downloaded local files or make a redistribution claim", () => {
    expect(policy.localExternalFontResource.directoryEnv).toBe("NAVER_SMARTCHANNEL_FONT_DIR");
    expect(policy.localExternalFontResource.localOnly).toBe(true);
    expect(policy.localExternalFontResource.redistributionClaim).toBe("NOT_MADE");
    expect(policy.localExternalFontResource.files).toHaveLength(4);
    expect(policy.localExternalFontResource.files.every((font) => font.approvedForSmartChannel === true && font.bundleAllowed === false)).toBe(true);
  });
});
