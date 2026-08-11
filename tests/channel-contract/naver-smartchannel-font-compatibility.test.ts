import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = resolve(process.cwd());
const readJson = <T>(file: string) => JSON.parse(readFileSync(resolve(root, file), "utf8")) as T;

type Compatibility = {
  status: string;
  fonts: Array<{ fontToken: string; required: boolean; runtime: { status: string; localSha256: string | null; bundleAllowed: boolean; commitAllowed: boolean; networkFetchAllowed: boolean } }>;
  approvedDigestAllowlist: Record<string, string>;
};
type Policy = { runtimeStatus: string; runtimeAssets: Array<{ id: string; required: boolean; weight: number; runtimeDigest: string | null; smartChannelAllowed: boolean }> };

const compatibility = readJson<Compatibility>("contracts/naver-smartchannel-font-compatibility.json");
const policy = readJson<Policy>("contracts/naver-smartchannel-runtime-font-policy.json");

describe("NAVER SmartChannel official font contract", () => {
  it("does not expose Apple SD Gothic Neo as a runtime dependency", () => {
    expect(compatibility.status).toBe("OFFICIAL_ASSETS_RESOLVED_BUNDLED");
    expect(compatibility.fonts.map((font) => font.fontToken)).toEqual([
      "NAVER_SC_NANUM_BARUN_GOTHIC_BOLD",
      "NAVER_SC_NANUM_BARUN_GOTHIC_REGULAR",
      "NAVER_SC_SAN_FRANCISCO_BOLD",
    ]);
    expect(policy.runtimeAssets.map((asset) => asset.id)).not.toContain("NAVER_SC_APPLE_SD_GOTHIC_NEO_BOLD");
    expect(policy.runtimeAssets.filter((asset) => asset.required).map((asset) => asset.weight).sort()).toEqual([400, 700]);
    expect(policy.runtimeStatus).toBe("READY_APPROVED_OFFICIAL_ASSET");
  });

  it("records bundled exact assets without fake digests or fallback", () => {
    expect(compatibility.approvedDigestAllowlist).toEqual({});
    expect(compatibility.fonts.filter((font) => font.required).every((font) => /^[a-f0-9]{64}$/.test(font.runtime.localSha256 ?? "") && font.runtime.bundleAllowed && font.runtime.commitAllowed && !font.runtime.networkFetchAllowed)).toBe(true);
    expect(policy.runtimeAssets.filter((asset) => asset.required).every((asset) => /^[a-f0-9]{64}$/.test(asset.runtimeDigest ?? "") && asset.smartChannelAllowed === true)).toBe(true);
  });
});
