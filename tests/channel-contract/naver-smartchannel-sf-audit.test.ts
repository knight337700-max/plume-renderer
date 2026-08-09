import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = resolve(process.cwd());
type AuditFont = { postScriptName: string; classification: string; parentGroups: string[]; visibleLayerCount: number; guideLayerCount: number; outputInclusion: { guideOnlyNonExport: boolean } };
type LocalFont = { approvedForSmartChannel: boolean; bundleAllowed: boolean };
type AuditRecord = { runtimeDecision: string; sourceOnlyNonRuntime: string[]; fonts: AuditFont[] };
type PolicyRecord = { localExternalFontResource: { directoryEnv: string; localOnly: boolean; redistributionClaim: string; files: LocalFont[] } };
const readJson = <T>(file: string) => JSON.parse(readFileSync(resolve(root, file), "utf8")) as T;
const audit = readJson<AuditRecord>("contracts/naver-smartchannel-sf-font-audit.json");
const policy = readJson<PolicyRecord>("contracts/naver-smartchannel-runtime-font-policy.json");

describe("NAVER SmartChannel SF guide-layer audit", () => {
  it("keeps both SF families source-required when they are export-capable text variants", () => {
    expect(audit.runtimeDecision).toBe("SF_EXACT_RUNTIME_REQUIRED");
    expect(audit.sourceOnlyNonRuntime).toEqual([]);
    expect(audit.fonts).toHaveLength(2);
    expect(audit.fonts.map((font) => [font.postScriptName, font.classification])).toEqual([
      ["SFProDisplay-Bold", "EXPORT_RENDERED_TEXT"],
      ["SFUIDisplay-Bold", "EXPORT_RENDERED_TEXT"],
    ]);
    expect(audit.fonts.every((font) => font.parentGroups.some((group) => group.trim().startsWith("TEXT")) && font.visibleLayerCount === 0 && font.guideLayerCount === 0)).toBe(true);
  });

  it("does not approve downloaded local files or make a redistribution claim", () => {
    expect(policy.localExternalFontResource.directoryEnv).toBe("NAVER_SMARTCHANNEL_FONT_DIR");
    expect(policy.localExternalFontResource.localOnly).toBe(true);
    expect(policy.localExternalFontResource.redistributionClaim).toBe("NOT_MADE");
    expect(policy.localExternalFontResource.files).toHaveLength(4);
    expect(policy.localExternalFontResource.files.every((font) => font.approvedForSmartChannel === false && font.bundleAllowed === false)).toBe(true);
  });
});
