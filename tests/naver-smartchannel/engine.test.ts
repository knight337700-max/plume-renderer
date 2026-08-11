import { mkdir, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { createSmartChannelFontResourceProvider, isSmartChannelRenderRequest, renderSmartChannel, loadContracts } from "../../src/core/index.js";
import { projectRoot } from "../helpers.js";

const ids = ["N2-REP-001", "N2-REP-002", "N2-REP-003", "N2-REP-004", "N2-REP-005", "N2-REP-006"];
type FixtureRequest = Record<string, unknown> & { assets: { object: { path: string } } };

async function requestFor(id: string): Promise<Record<string, unknown>> {
  const request = JSON.parse(await readFile(path.join(projectRoot, "fixtures", "valid", "naver-smartchannel", `${id}.input.json`), "utf8")) as FixtureRequest;
  // The legacy N2 objects are full-canvas precomposites and intentionally
  // exceed the N7.4 70% alpha-pixel gate. Use the sparse logo fixture for the
  // resolved-font engine regression; normalization coverage has separate
  // boundary fixtures.
  request.assets.object.path = "fixtures/valid/mask-semicircle-right__logo__black__pass.png";
  return request;
}

describe("NAVER SmartChannel N2 template engine", () => {
  it("renders each representative candidate with bundled exact fonts deterministically", async () => {
    const contracts = await loadContracts(projectRoot);
    const outputRoot = await os.tmpdir();
    const temp = path.join(outputRoot, `kbr-n2-vitest-${process.pid}`);
    await mkdir(temp, { recursive: true });
    for (const id of ids) {
      const result = await renderSmartChannel(await requestFor(id), { projectRoot, inputRoot: projectRoot, outputRoot: temp, contracts, publish: false });
      expect(result.status, id).toBe("PASS");
      expect(result.downloadAllowed, id).toBe(false);
      expect(result.errors, id).toEqual([]);
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
    expect(known.status).toBe("PASS");
    expect(known.errors).toEqual([]);
    const unsupportedCta = await renderSmartChannel({ ...base, templateId: "NAVER_SMARTCHANNEL_160_BASIC_STANDARD_LEFT_ONE_LINE_NONE", content: { headline: "테스트", ctaOption: "가입하기" } }, { projectRoot, inputRoot: projectRoot, outputRoot: temp, contracts, publish: false });
    expect(unsupportedCta.status).toBe("FAIL");
    expect(unsupportedCta.errors.some((issue) => issue.code === "NAVER_SMARTCHANNEL_CTA_INVALID")).toBe(true);
    const unknown = await renderSmartChannel({ ...base, templateId: "NAVER_SMARTCHANNEL_NOT_A_TEMPLATE" }, { projectRoot, inputRoot: projectRoot, outputRoot: temp, contracts, publish: false });
    expect(unknown.status).toBe("FAIL");
    expect(unknown.errors[0]?.code).toBe("NAVER_SMARTCHANNEL_TEMPLATE_UNKNOWN");
    expect(isSmartChannelRenderRequest(base)).toBe(true);
    expect(isSmartChannelRenderRequest({ channel: "KAKAO_MOMENT", placement: "BIZBOARD" })).toBe(false);
  });

  it("fails closed when an injected renderer font provider is unavailable", async () => {
    const contracts = await loadContracts(projectRoot);
    const temp = path.join(os.tmpdir(), `kbr-n2-font-${process.pid}`);
    await mkdir(temp, { recursive: true });
    const provider = createSmartChannelFontResourceProvider({ id: "MissingResourceProvider", root: path.join(temp, "missing-fonts") });
    const result = await renderSmartChannel(await requestFor("N2-REP-001"), { projectRoot, inputRoot: projectRoot, outputRoot: temp, contracts, fontResourceProvider: provider, publish: false });
    expect(result.status).toBe("FAIL");
    expect(result.errors.some((issue) => issue.code === "NAVER_SMARTCHANNEL_FONT_UNAVAILABLE")).toBe(true);
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
    expect(wrongFont.errors.some((issue) => issue.code === "NAVER_SMARTCHANNEL_FONT_IDENTITY_MISMATCH")).toBe(true);

    const wrongPlacement = structuredClone(contracts.naverObjectPlacement) as Record<string, unknown>;
    wrongPlacement.tokens = (wrongPlacement.tokens as Array<Record<string, unknown>>).filter((entry) => entry.token !== "NAVER_SC_160_BASIC_STANDARD_LEFT_NONE");
    const placement = await renderSmartChannel(await requestFor("N2-REP-001"), { projectRoot, inputRoot: projectRoot, outputRoot: temp, contracts: { ...contracts, naverObjectPlacement: wrongPlacement }, publish: false });
    expect(placement.status).toBe("FAIL");
    expect(placement.errors[0]?.code).toBe("NAVER_SMARTCHANNEL_OBJECT_PLACEMENT_UNRESOLVED");
  });
});
