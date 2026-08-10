import { mkdir, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { isSmartChannelRenderRequest, renderSmartChannel, loadContracts } from "../../src/core/index.js";
import { projectRoot } from "../helpers.js";

const ids = ["N2-REP-001", "N2-REP-002", "N2-REP-003", "N2-REP-004", "N2-REP-005", "N2-REP-006"];

async function requestFor(id: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(path.join(projectRoot, "fixtures", "valid", "naver-smartchannel", `${id}.input.json`), "utf8")) as Record<string, unknown>;
}

describe("NAVER SmartChannel N2 template engine", () => {
  it("fails closed for each representative candidate while official fonts are unresolved", async () => {
    const contracts = await loadContracts(projectRoot);
    const outputRoot = await os.tmpdir();
    const temp = path.join(outputRoot, `kbr-n2-vitest-${process.pid}`);
    await mkdir(temp, { recursive: true });
    for (const id of ids) {
      const result = await renderSmartChannel(await requestFor(id), { projectRoot, inputRoot: projectRoot, outputRoot: temp, contracts, publish: false });
      expect(result.status, id).toBe("FAIL");
      expect(result.downloadAllowed, id).toBe(false);
      expect(result.errors.some((issue) => issue.code === "NAVER_SMARTCHANNEL_FONT_UNAVAILABLE"), id).toBe(true);
      const repeated = await renderSmartChannel(await requestFor(id), { projectRoot, inputRoot: projectRoot, outputRoot: temp, contracts, publish: false });
      expect(repeated.errors.map((issue) => issue.code)).toEqual(result.errors.map((issue) => issue.code));
    }
  });

  it("renders source-known templates and rejects unknown template IDs", async () => {
    const contracts = await loadContracts(projectRoot);
    const temp = path.join(os.tmpdir(), `kbr-n2-guards-${process.pid}`);
    await mkdir(temp, { recursive: true });
    const base = await requestFor("N2-REP-001");
    const known = await renderSmartChannel({ ...base, templateId: "NAVER_SMARTCHANNEL_160_BASIC_STANDARD_LEFT_ONE_LINE_NONE", content: { headline: "테스트" } }, { projectRoot, inputRoot: projectRoot, outputRoot: temp, contracts, publish: false });
    expect(known.status).toBe("FAIL");
    expect(known.errors.some((issue) => issue.code === "NAVER_SMARTCHANNEL_FONT_UNAVAILABLE")).toBe(true);
    const unsupportedCta = await renderSmartChannel({ ...base, templateId: "NAVER_SMARTCHANNEL_160_BASIC_STANDARD_LEFT_ONE_LINE_NONE", content: { headline: "테스트", ctaOption: "가입하기" } }, { projectRoot, inputRoot: projectRoot, outputRoot: temp, contracts, publish: false });
    expect(unsupportedCta.status).toBe("FAIL");
    expect(unsupportedCta.errors.some((issue) => issue.code === "NAVER_SMARTCHANNEL_CTA_INVALID")).toBe(true);
    const unknown = await renderSmartChannel({ ...base, templateId: "NAVER_SMARTCHANNEL_NOT_A_TEMPLATE" }, { projectRoot, inputRoot: projectRoot, outputRoot: temp, contracts, publish: false });
    expect(unknown.status).toBe("FAIL");
    expect(unknown.errors[0]?.code).toBe("NAVER_SMARTCHANNEL_TEMPLATE_UNKNOWN");
    expect(isSmartChannelRenderRequest(base)).toBe(true);
    expect(isSmartChannelRenderRequest({ channel: "KAKAO_MOMENT", placement: "BIZBOARD" })).toBe(false);
  });

  it("fails closed when the configured exact font directory is unavailable", async () => {
    const contracts = await loadContracts(projectRoot);
    const temp = path.join(os.tmpdir(), `kbr-n2-font-${process.pid}`);
    await mkdir(temp, { recursive: true });
    const previous = process.env.NAVER_SMARTCHANNEL_FONT_DIR;
    process.env.NAVER_SMARTCHANNEL_FONT_DIR = path.join(temp, "missing-fonts");
    try {
      const result = await renderSmartChannel(await requestFor("N2-REP-001"), { projectRoot, inputRoot: projectRoot, outputRoot: temp, contracts, publish: false });
      expect(result.status).toBe("FAIL");
      expect(result.errors.some((issue) => issue.code === "NAVER_SMARTCHANNEL_FONT_UNAVAILABLE")).toBe(true);
    } finally {
      if (previous === undefined) delete process.env.NAVER_SMARTCHANNEL_FONT_DIR;
      else process.env.NAVER_SMARTCHANNEL_FONT_DIR = previous;
    }
  });

  it("fails deterministically for wrong font, fixed-component, and placement registry digests", async () => {
    const contracts = await loadContracts(projectRoot);
    const temp = path.join(os.tmpdir(), `kbr-n2-integrity-${process.pid}`);
    await mkdir(temp, { recursive: true });
    const wrongFontPolicy = structuredClone(contracts.naverRuntimeFontPolicy) as Record<string, unknown>;
    const runtimeAssets = wrongFontPolicy.runtimeAssets as Array<Record<string, unknown>>;
    const firstRuntimeAsset = runtimeAssets[0];
    if (!firstRuntimeAsset) throw new Error("Naver runtime font policy has no runtime assets");
    firstRuntimeAsset.runtimeDigest = "0".repeat(64);
    const wrongFont = await renderSmartChannel(await requestFor("N2-REP-001"), { projectRoot, inputRoot: projectRoot, outputRoot: temp, contracts: { ...contracts, naverRuntimeFontPolicy: wrongFontPolicy }, publish: false });
    expect(wrongFont.status).toBe("FAIL");
    expect(wrongFont.errors.some((issue) => issue.code === "NAVER_SMARTCHANNEL_FONT_UNAVAILABLE")).toBe(true);

    const wrongPlacement = structuredClone(contracts.naverObjectPlacement) as Record<string, unknown>;
    wrongPlacement.tokens = (wrongPlacement.tokens as Array<Record<string, unknown>>).filter((entry) => entry.token !== "NAVER_SC_160_BASIC_STANDARD_LEFT_NONE");
    const placement = await renderSmartChannel(await requestFor("N2-REP-001"), { projectRoot, inputRoot: projectRoot, outputRoot: temp, contracts: { ...contracts, naverObjectPlacement: wrongPlacement }, publish: false });
    expect(placement.status).toBe("FAIL");
    expect(placement.errors[0]?.code).toBe("NAVER_SMARTCHANNEL_OBJECT_PLACEMENT_UNRESOLVED");
  });
});
