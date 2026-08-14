import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  loadGoogleStaticContracts,
  renderGoogleStaticCandidate,
} from "../../src/core/index.js";
import type { GoogleStaticRenderError } from "../../src/core/index.js";

const root = path.resolve(process.cwd());

async function fixture(profileId: string) {
  const source = await readFile(path.join(root, `fixtures/google/g2/source/g2-${profileId}.png`));
  const plan = JSON.parse(await readFile(path.join(root, `fixtures/google/g2/plans/g2-${profileId}.json`), "utf8"));
  return { source, plan };
}

describe("Google G2 deterministic rendering", () => {
  it("keeps the fourteen-candidate registry pending and ordered", async () => {
    const registry = JSON.parse(await readFile(path.join(root, "contracts/google/golden-candidates.g2.json"), "utf8"));
    expect(registry.status).toBe("CANDIDATE");
    expect(registry.frozen).toBe(false);
    expect(registry.visualAcceptance).toBe("PENDING");
    expect(registry.candidates).toHaveLength(14);
    expect(registry.candidates.map((entry: { profileId: string }) => entry.profileId)).toEqual([
      "GOOGLE_MARKETING_LANDSCAPE_1_91",
      "GOOGLE_MARKETING_SQUARE_1_1",
      "GOOGLE_MARKETING_PORTRAIT_4_5",
      "GOOGLE_RDA_VERTICAL_9_16",
      "GOOGLE_DEMAND_GEN_VERTICAL_9_16",
      "GOOGLE_LOGO_SQUARE_1_1",
      "GOOGLE_LOGO_LANDSCAPE_4_1",
      "GOOGLE_DG_UPLOAD_300X250",
      "GOOGLE_DG_UPLOAD_336X280",
      "GOOGLE_DG_UPLOAD_728X90",
      "GOOGLE_DG_UPLOAD_970X90",
      "GOOGLE_DG_UPLOAD_160X600",
      "GOOGLE_DG_UPLOAD_300X600",
      "GOOGLE_DG_UPLOAD_320X50",
    ]);
  });

  it("renders a candidate byte-for-byte identically on repeat", async () => {
    const contracts = await loadGoogleStaticContracts(root);
    const { source, plan } = await fixture("GOOGLE_MARKETING_LANDSCAPE_1_91");
    const first = await renderGoogleStaticCandidate(source, plan, contracts);
    const second = await renderGoogleStaticCandidate(source, plan, contracts);
    expect(first.bytes.equals(second.bytes)).toBe(true);
    expect(first.renderFingerprint).toBe(second.renderFingerprint);
    expect(first.width).toBe(1200);
    expect(first.height).toBe(628);
  });

  it("fails closed for crop plans that omit their source rectangle", async () => {
    const contracts = await loadGoogleStaticContracts(root);
    const { source, plan } = await fixture("GOOGLE_MARKETING_LANDSCAPE_1_91");
    await expect(renderGoogleStaticCandidate(source, { ...plan, sourceRect: undefined }, contracts)).rejects.toMatchObject({
      code: "KBR-G2-CROP-RECT-REQUIRED",
    } satisfies Partial<GoogleStaticRenderError>);
  });
});
