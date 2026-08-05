import path from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import { analyzeAndResizeProduct, loadContracts } from "../../src/core/index.js";
import { projectRoot } from "../helpers.js";

describe("product alpha trim and contain placement", () => {
  let contracts: Awaited<ReturnType<typeof loadContracts>>;

  beforeAll(async () => {
    contracts = await loadContracts(projectRoot);
  });

  async function analyze(relativePath: string) {
    return analyzeAndResizeProduct(path.join(projectRoot, ...relativePath.split("/")), null, contracts);
  }

  it("preserves semi-transparent alpha and follows frozen rounding", async () => {
    const result = await analyze("fixtures/valid/object-right__alpha__hole-shadow__pass.png");
    expect(result.analysis).toBeDefined();
    const analysis = result.analysis;
    if (!analysis) return;

    expect(analysis.resizedWidth).toBe(Math.max(1, Math.round(analysis.trimBox.width * analysis.scale)));
    expect(analysis.resizedHeight).toBe(Math.max(1, Math.round(analysis.trimBox.height * analysis.scale)));
    expect(analysis.destinationX).toBe(666 + Math.floor((315 - analysis.resizedWidth) / 2));
    expect(analysis.destinationY).toBe(Math.floor((258 - analysis.resizedHeight) / 2));

    const alpha = [...analysis.resizedRgba].filter((_, index) => index % 4 === 3);
    expect(alpha.some((value) => value > 0 && value < 255)).toBe(true);
  });

  it("keeps alpha>=1 for trim while ignoring isolated layout noise", async () => {
    const result = await analyze("fixtures/valid/object-right__alpha__threshold-noise__warning.png");
    expect(result.analysis?.trimBox).toEqual({ x: 2, y: 2, width: 243, height: 143 });
    expect(result.analysis?.sourceLayoutBox).toEqual({ x: 15, y: 25, width: 230, height: 120 });
    expect(result.issues.map(({ code }) => code).includes("KBR-ASSET-012")).toBe(true);
  });

  it("rejects a fully transparent product", async () => {
    const result = await analyze("fixtures/invalid/object-right__alpha__fully-transparent__error.png");
    expect(result.analysis).toBeUndefined();
    expect(result.issues.map(({ code }) => code)).toContain("KBR-ASSET-005");
  });

  it("rejects a suspected opaque background", async () => {
    const result = await analyze("fixtures/invalid/object-right__alpha__opaque-background__error.png");
    expect(result.issues.map(({ code }) => code)).toContain("KBR-ASSET-006");
  });

  it("rejects contain scale over 1.5x", async () => {
    const result = await analyze("fixtures/invalid/object-right__alpha__upscale-over-1_5__error.png");
    expect(result.analysis).toBeUndefined();
    expect(result.issues.map(({ code }) => code)).toContain("KBR-ASSET-008");
  });
});
